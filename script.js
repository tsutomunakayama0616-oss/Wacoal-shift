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
    if (monthInput) {
        monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        monthInput.addEventListener('change', generateTable);
    }
    renderStaffList();
    generateTable();
};

function resetShift() {
    if (!confirm("入力されたシフトをすべて消去して初期状態に戻しますか？")) return;
    document.querySelectorAll('.shift-select').forEach(sel => sel.value = "");
    updateSummary();
}

function canWork(grid, sIdx, dIdx, limit) {
    let row = grid[sIdx];
    let prev = 0;
    for (let i = dIdx - 1; i >= 0; i--) {
        if (row[i] === "出勤") prev++; else break;
    }
    let next = 0;
    for (let i = dIdx + 1; i < row.length; i++) {
        if (row[i] === "出勤") next++; else break;
    }
    return (prev + next + 1) <= limit;
}

/**
 * 自動生成ロジック
 */
function autoFillShift() {
    const selects = Array.from(document.querySelectorAll('.shift-select'));
    const needInputs = Array.from(document.querySelectorAll('.need-count-input'));
    const daysInMonth = needInputs.length;
    const dailyTargets = needInputs.map(input => parseInt(input.value) || 0);

    // 1. グリッドの初期化（希望休・有給を固定）
    let grid = staffs.map((staff, sIdx) => {
        return Array.from({length: daysInMonth}, (_, d) => {
            const sel = selects.find(s => parseInt(s.dataset.staff) === sIdx && parseInt(s.dataset.day) === d+1);
            return (sel && (sel.value === "希望休" || sel.value === "有給")) ? sel.value : "";
        });
    });

    // 2. 目標人数の確保（非常勤は10回まで）
    for (let d = 0; d < daysInMonth; d++) {
        let safety = 0;
        while (countWorkers(grid, d) < dailyTargets[d] && safety < 100) {
            let candidates = staffs.map((_, i) => i).filter(sIdx => {
                if (grid[sIdx][d] !== "") return false;
                let limit = staffs[sIdx].type === 'full' ? 4 : 2;
                
                // 非常勤は10回を超えないようにガード
                if (staffs[sIdx].type === 'part' && countStaffWorkDays(grid[sIdx]) >= 10) return false;
                
                return canWork(grid, sIdx, d, limit);
            });

            if (candidates.length === 0) break;
            candidates.sort((a, b) => countStaffWorkDays(grid[a]) - countStaffWorkDays(grid[b]));
            grid[candidates[0]][d] = "出勤";
            safety++;
        }
    }

    // 3. 帳尻合わせ（常勤9休・非常勤10出）
    staffs.forEach((staff, sIdx) => {
        let safety = 0;
        if (staff.type === 'full') {
            // 常勤：休みが9日を超えるなら出勤を増やす
            while (countStaffOffDays(grid[sIdx]) > 9 && safety < 100) {
                let offDays = grid[sIdx].map((v, i) => v === "" || v === "公休" ? i : -1).filter(i => i !== -1);
                offDays.sort(() => Math.random() - 0.5);
                let targetDay = offDays.find(d => canWork(grid, sIdx, d, 4));
                if (targetDay !== undefined) { grid[sIdx][targetDay] = "出勤"; } else { break; }
                safety++;
            }
        } else {
            // 非常勤：出勤が10回未満なら出勤を増やす
            while (countStaffWorkDays(grid[sIdx]) < 10 && safety < 100) {
                let offDays = grid[sIdx].map((v, i) => v === "" || v === "公休" ? i : -1).filter(i => i !== -1);
                offDays.sort(() => Math.random() - 0.5);
                let targetDay = offDays.find(d => canWork(grid, sIdx, d, 2));
                if (targetDay !== undefined) { grid[sIdx][targetDay] = "出勤"; } else { break; }
                safety++;
            }
        }
    });

    // 4. 空白を「公休」で埋める
    for (let s = 0; s < staffs.length; s++) {
        for (let d = 0; d < daysInMonth; d++) {
            if (grid[s][d] === "") grid[s][d] = "公休";
        }
    }

    // 反映
    selects.forEach(sel => {
        sel.value = grid[parseInt(sel.dataset.staff)][parseInt(sel.dataset.day) - 1];
    });

    updateSummary();
    checkViolations(grid, dailyTargets);
}

function countWorkers(grid, day) { return grid.filter(row => row[day] === "出勤").length; }
function countStaffWorkDays(row) { return row.filter(v => v === "出勤").length; }
function countStaffOffDays(row) { return row.filter(v => v === "" || v === "公休" || v === "希望休" || v === "有給").length; }

function checkViolations(grid, targets) {
    let messages = [];
    for (let d = 0; d < targets.length; d++) {
        let actual = countWorkers(grid, d);
        if (actual < targets[d]) messages.push(`${d+1}日: 人数不足（目標${targets[d]}名）`);
    }
    staffs.forEach((s, i) => {
        if (s.type === 'full') {
            let offs = countStaffOffDays(grid[i]);
            if (offs !== 9) messages.push(`${s.name}: 休みが${offs}日（9日必要）`);
        } else {
            let works = countStaffWorkDays(grid[i]);
            if (works !== 10) messages.push(`${s.name}: 出勤が${works}回（10回必要）`);
        }
    });

    if (messages.length > 0) {
        alert("【条件未達成】\n" + messages.slice(0, 5).join("\n"));
    } else {
        alert("すべての条件をクリアしました！");
    }
}

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
            <div style="font-size:11px;">
                有給: <input type="number" value="${s.paidDays}" onchange="staffs[${i}].paidDays=parseInt(this.value)||0; updateSummary();" style="width:35px">
                <button onclick="removeStaff(${i})" style="color:red; background:none; border:none; float:right;">削除</button>
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
    
    let dRow = '<th>名前</th>', wRow = '<th>曜</th>', hRow = '<th>一括</th>';
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month - 1, d);
        const dayClass = date.getDay() === 6 ? 'sat' : date.getDay() === 0 ? 'sun' : '';
        dRow += `<th>${d}</th>`;
        wRow += `<th class="${dayClass}">${["日","月","火","水","木","金","土"][date.getDay()]}</th>`;
        hRow += `<td><button onclick="setColumnHoliday(${d})" style="font-size:9px">休</button></td>`;
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
    
    let fRow = '<td>目標</td>';
    for (let d = 1; d <= daysInMonth; d++) fRow += `<td><input type="number" class="need-count-input" data-day="${d}" value="${defaultNeed}" style="width:25px"></td>`;
    document.getElementById('shiftFoot').innerHTML = `<tr>${fRow}</tr>`;
    updateSummary();
}

function setColumnHoliday(day) {
    document.querySelectorAll(`.shift-select[data-day="${day}"]`).forEach(s => s.value = "公休");
    const need = document.querySelector(`.need-count-input[data-day="${day}"]`);
    if(need) need.value = 0;
    updateSummary();
}

function updateSummary() {
    const selects = document.querySelectorAll('.shift-select');
    const summaryList = document.getElementById('summaryList');
    if (!summaryList) return;
    summaryList.innerHTML = staffs.map((s, idx) => {
        const mySelects = Array.from(selects).filter(sel => parseInt(sel.dataset.staff) === idx);
        const c = { "出勤": 0, "公休": 0, "希望休": 0, "有給": 0 };
        mySelects.forEach(sel => { if (c[sel.value] !== undefined) c[sel.value]++; });
        return `<div class="summary-row"><strong>${s.name}</strong>: 出勤${c["出勤"]} / 休み${c["公休"]+c["希望休"]+c["有給"]}</div>`;
    }).join('');
}
