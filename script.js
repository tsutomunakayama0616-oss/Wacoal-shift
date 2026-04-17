// 初期スタッフ構成（常勤A-D, 非常勤E）
let staffs = [
    { name: "スタッフA", type: "full", paidDays: 0 },
    { name: "スタッフB", type: "full", paidDays: 0 },
    { name: "スタッフC", type: "full", paidDays: 0 },
    { name: "スタッフD", type: "full", paidDays: 0 },
    { name: "スタッフE", type: "part", paidDays: 0 }
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

function countWork(row) { return row.filter(v => v === "出勤").length; }
function countOff(row) { return row.filter(v => ["公休", "希望休", "有給"].includes(v)).length; }

function autoFillShift() {
    const selects = Array.from(document.querySelectorAll('.shift-select'));
    const needInputs = Array.from(document.querySelectorAll('.need-count-input'));
    const daysInMonth = needInputs.length;
    const dailyTargets = needInputs.map(input => parseInt(input.value) || 0);

    // 1. グリッド初期化 & 有給配置
    let grid = staffs.map((staff, sIdx) => {
        let row = Array.from({length: daysInMonth}, (_, d) => {
            const sel = selects.find(s => parseInt(s.dataset.staff) === sIdx && parseInt(s.dataset.day) === d+1);
            return (sel && sel.value !== "") ? sel.value : "";
        });

        // 有給の自動反映
        let paidNeeded = staff.paidDays;
        let safety = 0;
        while (paidNeeded > 0 && safety < 100) {
            let d = Math.floor(Math.random() * daysInMonth);
            if (row[d] === "") { row[d] = "有給"; paidNeeded--; }
            safety++;
        }

        // 暫定埋め
        if (staff.type === 'full') {
            let offNeeded = 9 - countOff(row);
            while (offNeeded > 0) {
                let d = Math.floor(Math.random() * daysInMonth);
                if (row[d] === "") { row[d] = "公休"; offNeeded--; }
            }
            for(let i=0; i<daysInMonth; i++) if(row[i] === "") row[i] = "出勤";
        } else {
            for(let i=0; i<daysInMonth; i++) if(row[i] === "") row[i] = "公休";
        }
        return row;
    });

    // 2. 人数調整：不足補填 (休み多い常勤を優先して仕事に回す)
    for (let d = 0; d < daysInMonth; d++) {
        let target = dailyTargets[d];
        let workers = staffs.map((_, i) => i).filter(i => grid[i][d] === "出勤");
        
        if (workers.length < target) {
            let candidates = staffs.map((_, i) => i).filter(i => {
                const sel = selects.find(s => parseInt(s.dataset.staff) === i && parseInt(s.dataset.day) === d+1);
                if (sel && ["希望休", "有給", "公休"].includes(sel.value)) return false;
                if (grid[i][d] !== "公休") return false;
                if (staffs[i].type === "full" && countOff(grid[i]) <= 9) return false;
                return true;
            });
            candidates.sort((a, b) => countOff(grid[b]) - countOff(grid[a]));
            for (let idx of candidates) {
                if (workers.length >= target) break;
                grid[idx][d] = "出勤";
                workers.push(idx);
            }
        }
    }

    // 3. 最終確定収束（常勤9休絶対防衛）
    for (let s = 0; s < staffs.length; s++) {
        let row = grid[s];
        if (staffs[s].type === "full") {
            while (countOff(row) > 9) {
                let changed = false;
                for (let d = 0; d < daysInMonth; d++) {
                    if (countOff(row) <= 9) break;
                    if (row[d] === "公休" && canWork(row, d, 4)) {
                        const sel = selects.find(ui => parseInt(ui.dataset.staff) === s && parseInt(ui.dataset.day) === d+1);
                        if (!sel || (sel.value !== "希望休" && sel.value !== "有給")) {
                            row[d] = "出勤"; changed = true;
                        }
                    }
                }
                if (!changed) break;
            }
            while (countOff(row) < 9) {
                let changed = false;
                for (let d = 0; d < daysInMonth; d++) {
                    if (countOff(row) >= 9) break;
                    if (row[d] === "出勤") {
                        const sel = selects.find(ui => parseInt(ui.dataset.staff) === s && parseInt(ui.dataset.day) === d+1);
                        if (!sel || sel.value !== "出勤") {
                            row[d] = "公休"; changed = true;
                        }
                    }
                }
                if (!changed) break;
            }
        }
    }

    selects.forEach(sel => {
        sel.value = grid[parseInt(sel.dataset.staff)][parseInt(sel.dataset.day) - 1];
    });
    updateSummary();
}

function generateTable() {
    const monthInput = document.getElementById('targetMonth');
    const [year, month] = monthInput.value.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const defaultNeed = document.getElementById('defaultNeedCount').value;

    let dRow = '<th>名前</th>', wRow = '<th>曜</th>', hRow = '<th>一括</th>';
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
        let cells = `<td style="background:#eee; font-weight:bold;">${staff.name}</td>`;
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
    document.querySelectorAll(`.shift-select[data-day="${day}"]`).forEach(s => {
        if (!["希望休", "有給", "出勤"].includes(s.value)) s.value = "公休";
    });
    const need = document.querySelector(`.need-count-input[data-day="${day}"]`);
    if(need) need.value = 0;
    updateSummary();
}

function renderStaffList() {
    const list = document.getElementById('staffList');
    if (!list) return;
    list.innerHTML = staffs.map((s, i) => `
        <div class="staff-item">
            <input type="text" value="${s.name}" onchange="staffs[${i}].name=this.value; generateTable();" style="width:120px">
            <select onchange="staffs[${i}].type=this.value; updateSummary();">
                <option value="full" ${s.type==='full'?'selected':''}>常勤</option>
                <option value="part" ${s.type==='part'?'selected':''}>非常勤</option>
            </select><br>
            <div style="margin-top:5px">
                有給: <input type="number" value="${s.paidDays}" onchange="staffs[${i}].paidDays=parseInt(this.value)||0; updateSummary();" style="width:35px"> 日
                <button onclick="removeStaff(${i})" style="color:red; border:none; background:none; cursor:pointer; float:right">削除</button>
            </div>
        </div>
    `).join('');
}

function addStaff() { staffs.push({ name: "新規", type: "full", paidDays: 0 }); renderStaffList(); generateTable(); }
function removeStaff(idx) { staffs.splice(idx, 1); renderStaffList(); generateTable(); }
function updateSummary() {
    const selects = document.querySelectorAll('.shift-select');
    const summaryList = document.getElementById('summaryList');
    if (!summaryList) return;
    summaryList.innerHTML = staffs.map((s, idx) => {
        const mySelects = Array.from(selects).filter(sel => parseInt(sel.dataset.staff) === idx);
        const counts = { "出勤": 0, "公休": 0, "希望休": 0, "有給": 0 };
        mySelects.forEach(sel => { if (counts[sel.value] !== undefined) counts[sel.value]++; });
        const totalOff = counts["公休"] + counts["希望休"] + counts["有給"];
        return `<div style="font-size:12px; margin-bottom:5px;"><b>${s.name}</b><br>出: ${counts["出勤"]} / 休: ${totalOff} (有給:${counts["有給"]})</div>`;
    }).join('');
}
