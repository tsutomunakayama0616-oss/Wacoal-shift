// スタッフ初期データ
let staffs = [
    { name: "スタッフ1", type: "full", paidDays: 0 },
    { name: "スタッフ2", type: "full", paidDays: 0 },
    { name: "スタッフ3", type: "full", paidDays: 0 },
    { name: "スタッフ4", type: "full", paidDays: 0 },
    { name: "非常勤1", type: "part", paidDays: 0 }
];

window.onload = () => {
    const now = new Date();
    const monthInput = document.getElementById('targetMonth');
    if (monthInput) monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    renderStaffList();
    generateTable();
};

// 連勤チェック関数
function canWork(gridRow, dayIdx, limit) {
    let prev = 0;
    for (let i = dayIdx - 1; i >= 0; i--) {
        if (gridRow[i] === "出勤") prev++; else break;
    }
    let next = 0;
    for (let i = dayIdx + 1; i < gridRow.length; i++) {
        if (gridRow[i] === "出勤") next++; else break;
    }
    return (prev + next + 1) <= limit;
}

// UI生成系（変更なしのため省略）
function renderStaffList() {
    const list = document.getElementById('staffList');
    if (!list) return;
    list.innerHTML = staffs.map((s, i) => `
        <div class="staff-item">
            <input type="text" value="${s.name}" onchange="staffs[${i}].name=this.value; generateTable();" style="width:100%">
            <select onchange="staffs[${i}].type=this.value; updateSummary();" style="width:100%; margin:5px 0;">
                <option value="full" ${s.type==='full'?'selected':''}>常勤</option>
                <option value="part" ${s.type==='part'?'selected':''}>非常勤</option>
            </select>
            <div style="font-size:12px;">
                有給: <input type="number" value="${s.paidDays}" onchange="staffs[${i}].paidDays=parseInt(this.value)||0; updateSummary();" style="width:40px">日
                <button onclick="removeStaff(${i})" style="color:red; background:none; border:none; float:right; cursor:pointer;">削除</button>
            </div>
        </div>
    `).join('');
}
function addStaff() { staffs.push({ name: "新規", type: "full", paidDays: 0 }); renderStaffList(); generateTable(); }
function removeStaff(idx) { staffs.splice(idx, 1); renderStaffList(); generateTable(); }
function generateTable() {
    const monthInput = document.getElementById('targetMonth');
    const [year, month] = monthInput.value.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const defaultNeed = document.getElementById('defaultNeedCount').value;
    let dRow = '<th>名前</th>', wRow = '<th>曜</th>', hRow = '<th>定休日</th>';
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month - 1, d);
        const dayOfWeek = date.getDay();
        const dayClass = dayOfWeek === 6 ? 'sat' : dayOfWeek === 0 ? 'sun' : '';
        dRow += `<th>${d}</th>`;
        wRow += `<th class="${dayClass}">${["日","月","火","水","木","金","土"][dayOfWeek]}</th>`;
        hRow += `<td><button onclick="setColumnHoliday(${d})" style="font-size:10px">休</button></td>`;
    }
    document.getElementById('dateRow').innerHTML = dRow;
    document.getElementById('dayRow').innerHTML = wRow;
    document.getElementById('holidayRow').innerHTML = hRow;
    document.getElementById('shiftBody').innerHTML = staffs.map((staff, sIdx) => {
        let cells = `<td>${staff.name}</td>`;
        for (let d = 1; d <= daysInMonth; d++) {
            cells += `<td><select class="shift-select" data-staff="${sIdx}" data-day="${d}" onchange="updateSummary()">
                <option value="">-</option><option value="出勤">出</option><option value="公休">公</option><option value="希望休">希</option><option value="有給">有</option>
            </select></td>`;
        }
        return `<tr>${cells}</tr>`;
    }).join('');
    let fRow = '<td>目標人数</td>';
    for (let d = 1; d <= daysInMonth; d++) { fRow += `<td><input type="number" class="need-count-input" data-day="${d}" value="${defaultNeed}"></td>`; }
    document.getElementById('shiftFoot').innerHTML = `<tr>${fRow}</tr>`;
    updateSummary();
}
function setColumnHoliday(day) {
    document.querySelectorAll(`.shift-select[data-day="${day}"]`).forEach(s => s.value = "公休");
    const need = document.querySelector(`.need-count-input[data-day="${day}"]`);
    if(need) need.value = 0;
    updateSummary();
}

// --- メイン：自動生成ロジック ---
function autoFillShift() {
    const selects = Array.from(document.querySelectorAll('.shift-select'));
    const needInputs = Array.from(document.querySelectorAll('.need-count-input'));
    const daysInMonth = needInputs.length;
    const dailyTargets = needInputs.map(input => parseInt(input.value) || 0);

    // 1. 【個人制約】をベースに土台を作る
    let grid = staffs.map((staff, sIdx) => {
        let row = Array.from({length: daysInMonth}, (_, d) => {
            const sel = selects.find(s => parseInt(s.dataset.staff) === sIdx && parseInt(s.dataset.day) === d+1);
            return (sel && sel.value !== "") ? sel.value : "";
        });
        if (staff.type === 'full') {
            let offNeeded = 9 - row.filter(v => v === "希望休" || v === "公休" || v === "有給").length;
            while (offNeeded > 0) {
                let d = Math.floor(Math.random() * daysInMonth);
                if (row[d] === "") { row[d] = "公休"; offNeeded--; }
            }
            for(let i=0; i<daysInMonth; i++) { if(row[i] === "") row[i] = "出勤"; }
        } else {
            let needWork = 10 - row.filter(v => v === "出勤").length;
            let safety = 0;
            while (needWork > 0 && safety < 1000) {
                let d = Math.floor(Math.random() * daysInMonth);
                if (row[d] === "") {
                    let weekS = Math.floor(d / 7) * 7;
                    let weeklyCount = row.slice(weekS, weekS+7).filter(v => v === "出勤").length;
                    if (weeklyCount < 3) { row[d] = "出勤"; needWork--; }
                }
                safety++;
            }
            for(let i=0; i<daysInMonth; i++) { if(row[i] === "") row[i] = "公休"; }
        }
        return row;
    });

    // 2. 【連勤破壊】フェーズ（最優先）
    for (let s = 0; s < staffs.length; s++) {
        let limit = (staffs[s].type === 'full') ? 4 : 2;
        for (let d = 0; d < daysInMonth; d++) {
            if (grid[s][d] !== "出勤") continue;
            let count = 1;
            let i = d - 1; while (i >= 0 && grid[s][i] === "出勤") { count++; i--; }
            i = d + 1; while (i < daysInMonth && grid[s][i] === "出勤") { count++; i++; }
            if (count > limit) { grid[s][d] = "公休"; }
        }
    }

    // 3. 【人数削り】フェーズ（過多を調整）
    for (let d = 0; d < daysInMonth; d++) {
        let target = dailyTargets[d];
        let upper = (target === 3) ? 3 : target;
        let workers = staffs.map((_, i) => i).filter(i => grid[i][d] === "出勤");

        while (workers.length > upper) {
            let idx = workers[Math.floor(Math.random() * workers.length)];
            grid[idx][d] = "公休";
            workers = workers.filter(w => w !== idx);
        }
    }

    // 4. 【人数補填】フェーズ（不足を調整）
    for (let d = 0; d < daysInMonth; d++) {
        let target = dailyTargets[d];
        let lower = (target === 3) ? 2 : target;
        let workers = staffs.map((_, i) => i).filter(i => grid[i][d] === "出勤");

        if (workers.length < lower) {
            let candidates = staffs.map((_, i) => i).filter(i => {
                if (!(grid[i][d] === "公休" || grid[i][d] === "希望休")) return false;
                let limit = (staffs[i].type === 'full') ? 4 : 2;
                if (!canWork(grid[i], d, limit)) return false;

                if (staffs[i].type === 'full') {
                    let offCount = grid[i].filter(v => v === "公休" || v === "希望休" || v === "有給").length;
                    return offCount > 9;
                }
                if (staffs[i].type === 'part') {
                    let workCount = grid[i].filter(v => v === "出勤").length;
                    return workCount < 10;
                }
                return false;
            });
            candidates.sort(() => Math.random() - 0.5);
            for (let idx of candidates) {
                if (workers.length >= lower) break;
                grid[idx][d] = "出勤";
                workers.push(idx);
            }
        }
    }

    // 書き戻し
    selects.forEach(sel => {
        const sIdx = parseInt(sel.dataset.staff);
        const dIdx = parseInt(sel.dataset.day) - 1;
        sel.value = grid[sIdx][dIdx];
    });
    updateSummary();
    alert("自動生成が完了しました！\n連勤を優先的に破壊しつつ、人数を調整しました。");
}

function updateSummary() {
    const selects = document.querySelectorAll('.shift-select');
    const summaryList = document.getElementById('summaryList');
    if (!summaryList) return;
    summaryList.innerHTML = staffs.map((s, idx) => {
        const mySelects = Array.from(selects).filter(sel => parseInt(sel.dataset.staff) === idx);
        const counts = { "出勤": 0, "公休": 0, "希望休": 0, "有給": 0 };
        mySelects.forEach(sel => { if (counts[sel.value] !== undefined) counts[sel.value]++; });
        return `<div class="summary-row"><strong>${s.name}</strong><br>出勤: ${counts["出勤"]}日 / 休み: ${counts["公休"] + counts["希望休"] + counts["有給"]}日</div>`;
    }).join('');
}
