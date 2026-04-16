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
    if (!monthInput) return;
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
    for (let d = 1; d <= daysInMonth; d++) {
        fRow += `<td><input type="number" class="need-count-input" data-day="${d}" value="${defaultNeed}"></td>`;
    }
    document.getElementById('shiftFoot').innerHTML = `<tr>${fRow}</tr>`;
    updateSummary();
}

function setColumnHoliday(day) {
    document.querySelectorAll(`.shift-select[data-day="${day}"]`).forEach(s => s.value = "公休");
    const need = document.querySelector(`.need-count-input[data-day="${day}"]`);
    if(need) need.value = 0;
    updateSummary();
}

function autoFillShift() {
    const selects = Array.from(document.querySelectorAll('.shift-select'));
    const needInputs = Array.from(document.querySelectorAll('.need-count-input'));
    const daysInMonth = needInputs.length;

    let finalGrid = null;
    for (let trial = 0; trial < 50000; trial++) {
        let grid = staffs.map((_, sIdx) => Array.from({length: daysInMonth}, (_, d) => {
            const sel = selects.find(s => parseInt(s.dataset.staff) === sIdx && parseInt(s.dataset.day) === d+1);
            return (sel && (sel.value !== "" && sel.value !== "出勤")) ? sel.value : "";
        }));

        let dailyTargets = needInputs.map(input => parseInt(input.value) || 0);

        // 1. 非常勤の10日出勤を「優先的に」分散配置
        grid.forEach((row, sIdx) => {
            if (staffs[sIdx].type === 'part') {
                let count = 0;
                let attempts = 0;
                while (count < 10 && attempts < 1000) {
                    let r = Math.floor(Math.random() * daysInMonth);
                    if (row[r] === "" && dailyTargets[r] > 0) {
                        let streak = 0;
                        for (let i = r-1; i >= 0; i--) { if(row[i]==="出勤") streak++; else break; }
                        if (streak < 3) { row[r] = "出勤"; count++; }
                    }
                    attempts++;
                }
            }
        });

        // 2. 日ごとに目標人数を埋める
        let success = true;
        for (let d = 0; d < daysInMonth; d++) {
            let target = dailyTargets[d];
            let assigned = grid.filter(row => row[d] === "出勤").length;

            if (assigned < target) {
                let cand = staffs.map((_, i) => i).filter(sIdx => {
                    if (grid[sIdx][d] !== "") return false;
                    let streak = 0;
                    for (let i = d - 1; i >= 0; i--) {
                        if (grid[sIdx][i] === "出勤" || grid[sIdx][i] === "有給") streak++;
                        else break;
                    }
                    return streak < 3;
                });

                // 出勤が少ない人を優先
                cand.sort((a, b) => (grid[a].filter(v=>v==="出勤").length - grid[b].filter(v=>v==="出勤").length) + (Math.random()-0.5));

                for (let sIdx of cand) {
                    if (assigned >= target) break;
                    grid[sIdx][d] = "出勤";
                    assigned++;
                }
            }
            if (assigned < (target >= 2 ? 2 : target)) { success = false; break; }
        }

        // 3. 常勤の休みが「9日」になるよう、余分な出勤を削る、または足りない公休を足す
        if (success) {
            grid.forEach((row, sIdx) => {
                if (staffs[sIdx].type === 'full') {
                    let offCount = row.filter(v => v === "公休" || v === "希望休").length;
                    
                    // 休みが足りない場合：出勤を公休に変える（連勤制限に配慮しながら）
                    if (offCount < 9) {
                        let workIndices = row.map((v, i) => v === "出勤" ? i : -1).filter(i => i !== -1);
                        let toRemove = 9 - offCount;
                        for (let i = 0; i < toRemove && workIndices.length > 0; i++) {
                            let r = Math.floor(Math.random() * workIndices.length);
                            row[workIndices[r]] = "公休";
                            workIndices.splice(r, 1);
                        }
                    }
                    
                    // 休みが多すぎる場合（基本はないはず）：公休を出勤に変える（3連勤制限に配慮）
                    if (row.filter(v => v === "公休" || v === "希望休").length > 9) {
                        let offIndices = row.map((v, i) => v === "公休" ? i : -1).filter(i => i !== -1);
                        let toWork = row.filter(v => v === "公休" || v === "希望休").length - 9;
                        for (let i = 0; i < toWork && offIndices.length > 0; i++) {
                            let idx = offIndices.pop();
                            row[idx] = "出勤";
                        }
                    }
                } else {
                    // 非常勤の空欄を公休で埋める
                    for (let i = 0; i < row.length; i++) { if (row[i] === "") row[i] = "公休"; }
                }
            });

            // 最終チェック：常勤の休みが9日、3連勤制限、1日の人数
            grid.forEach((row, sIdx) => {
                if (staffs[sIdx].type === 'full' && row.filter(v => v === "公休" || v === "希望休").length !== 9) success = false;
                if (staffs[sIdx].type === 'part' && row.filter(v => v === "出勤").length !== 10) success = false;
                // 連勤チェック
                let currentStreak = 0;
                row.forEach(v => {
                    if (v === "出勤" || v === "有給") currentStreak++;
                    else currentStreak = 0;
                    if (currentStreak > 3) success = false;
                });
            });
            // 各日の最低人数チェック
            for (let d = 0; d < daysInMonth; d++) {
                if (dailyTargets[d] > 0 && grid.filter(r => r[d] === "出勤").length < 2) success = false;
            }
        }

        if (success) { finalGrid = grid; break; }
    }

    if (finalGrid) {
        selects.forEach(sel => {
            const sIdx = parseInt(sel.dataset.staff);
            const dIdx = parseInt(sel.dataset.day) - 1;
            sel.value = finalGrid[sIdx][dIdx];
        });
        updateSummary();
        alert("作成完了：3連勤制限と休み9日を優先して調整しました。");
    } else {
        alert("条件が厳しすぎます。3連勤制限（4連勤禁止）を守りつつ全員を月9日休ませるには、スタッフ5名では組み合わせが非常に限られます。");
    }
}

function updateSummary() {
    const selects = document.querySelectorAll('.shift-select');
    const summary = document.getElementById('summaryList');
    if (!summary) return;
    summary.innerHTML = staffs.map((s, idx) => {
        const my = Array.from(selects).filter(sel => parseInt(sel.dataset.staff) === idx);
        const c = { "出勤":0, "公休":0, "希望休":0, "有給":0 };
        my.forEach(sel => { if(c[sel.value] !== undefined) c[sel.value]++; });
        return `<div class="summary-row"><strong>${s.name}</strong><br>出勤: ${c["出勤"]} / 休み: ${c["公休"] + c["希望休"]}日</div>`;
    }).join('');
}
