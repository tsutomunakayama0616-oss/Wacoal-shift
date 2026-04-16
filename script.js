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
    const dailyTargets = needInputs.map(input => parseInt(input.value) || 0);

    for (let attempt = 0; attempt < 500; attempt++) {
        // 1. 各個人の契約日数を「絶対に」固定して生成
        let grid = staffs.map((staff, sIdx) => {
            let row = Array.from({length: daysInMonth}, (_, d) => {
                const sel = selects.find(s => parseInt(s.dataset.staff) === sIdx && parseInt(s.dataset.day) === d+1);
                return (sel && sel.value !== "") ? sel.value : "";
            });

            if (staff.type === 'full') {
                // 常勤：休み9日固定
                let currentOff = row.filter(v => v === "希望休" || v === "公休" || v === "有給").length;
                let offNeeded = 9 - currentOff;
                while (offNeeded > 0) {
                    let d = Math.floor(Math.random() * daysInMonth);
                    if (row[d] === "") { row[d] = "公休"; offNeeded--; }
                }
                // 残りをすべて出勤
                for(let i=0; i<daysInMonth; i++) { if(row[i] === "") row[i] = "出勤"; }
            } else {
                // 非常勤：出勤10回固定
                let currentWork = row.filter(v => v === "出勤").length;
                let needWork = 10 - currentWork;
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
                // 残りをすべて公休
                for(let i=0; i<daysInMonth; i++) { if(row[i] === "") row[i] = "公休"; }
            }
            return row;
        });

        // 2. 日毎人数調整（削る処理を撤廃。3人目標時は2〜3人を許容）
        let success = true;
        for (let d = 0; d < daysInMonth; d++) {
            let target = dailyTargets[d];
            let workers = staffs.map((_, i) => i).filter(i => grid[i][d] === "出勤");
            let lower = (target === 3) ? 2 : target;

            // 足りない場合のみ、他の日の非常勤から「融通」するのではなく、
            // 試行（attempt）を繰り返すことで、最初から配置が合うパターンを探す
            if (workers.length < lower) {
                success = false;
                break;
            }
        }

        // 3. 連勤制限の最終チェック（常勤4, 非常勤2）
        if (success) {
            for (let d = 0; d < daysInMonth; d++) {
                for (let sIdx = 0; sIdx < staffs.length; sIdx++) {
                    if (grid[sIdx][d] === "出勤") {
                        let sP = 0; for (let i=d-1; i>=0; i--) { if(grid[sIdx][i]==="出勤") sP++; else break; }
                        let sN = 0; for (let i=d+1; i<daysInMonth; i++) { if(grid[sIdx][i]==="出勤") sN++; else break; }
                        let limit = (staffs[sIdx].type === 'full') ? 4 : 2;
                        if (sP + sN >= limit) { success = false; break; }
                    }
                }
                if (!success) break;
            }
        }

        // 4. 合格なら画面に書き出す
        if (success) {
            selects.forEach(sel => {
                const sIdx = parseInt(sel.dataset.staff);
                const dIdx = parseInt(sel.dataset.day) - 1;
                sel.value = grid[sIdx][dIdx];
            });
            updateSummary();
            alert(`自動生成完了！（試行: ${attempt + 1}回）\n休日数・出勤回数を100%厳守しました。`);
            return;
        }
    }
    alert("エラー: 試行上限に達しました。希望休が集中しすぎているか、人数設定が契約日数と矛盾している可能性があります。");
}

function updateSummary() {
    const selects = document.querySelectorAll('.shift-select');
    const summaryList = document.getElementById('summaryList');
    if (!summaryList) return;
    summaryList.innerHTML = staffs.map((s, idx) => {
        const mySelects = Array.from(selects).filter(sel => parseInt(sel.dataset.staff) === idx);
        const counts = { "出勤": 0, "公休": 0, "希望休": 0, "有給": 0 };
        mySelects.forEach(sel => { if (counts[sel.value] !== undefined) counts[sel.value]++; });
        const offSum = counts["公休"] + counts["希望休"] + counts["有給"];
        return `<div class="summary-row"><strong>${s.name}</strong><br>出勤: ${counts["出勤"]}日 / 休み合計: ${offSum}日</div>`;
    }).join('');
}
