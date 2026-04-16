/**
 * スタッフ初期データ
 */
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

/**
 * 補助関数群
 */
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

/**
 * メイン：自動生成ロジック
 */
function autoFillShift() {
    const selects = Array.from(document.querySelectorAll('.shift-select'));
    const needInputs = Array.from(document.querySelectorAll('.need-count-input'));
    const daysInMonth = needInputs.length;
    const dailyTargets = needInputs.map(input => parseInt(input.value) || 0);

    // --- 1. 初期配置（有給配置 ＋ 暫定配置） ---
    let grid = staffs.map((staff, sIdx) => {
        let row = Array.from({length: daysInMonth}, (_, d) => {
            const sel = selects.find(s => parseInt(s.dataset.staff) === sIdx && parseInt(s.dataset.day) === d+1);
            return (sel && sel.value !== "") ? sel.value : "";
        });

        // 有給の自動配置
        let paidNeeded = staff.paidDays;
        let safety = 0;
        while (paidNeeded > 0 && safety < 100) {
            let d = Math.floor(Math.random() * daysInMonth);
            if (row[d] === "") { row[d] = "有給"; paidNeeded--; }
            safety++;
        }

        if (staff.type === 'full') {
            let offNeeded = 9 - countOff(row);
            while (offNeeded > 0) {
                let d = Math.floor(Math.random() * daysInMonth);
                if (row[d] === "") { row[d] = "公休"; offNeeded--; }
            }
            for(let i=0; i<daysInMonth; i++) {
                if(row[i] === "") row[i] = canWork(row, i, 4) ? "出勤" : "公休";
            }
        } else {
            for(let i=0; i<daysInMonth; i++) { if(row[i] === "") row[i] = "公休"; }
        }
        return row;
    });

    // --- 2. 連勤破壊フェーズ ---
    let changed = true;
    while (changed) {
        changed = false;
        for (let s = 0; s < staffs.length; s++) {
            let limit = (staffs[s].type === 'full') ? 4 : 2;
            for (let d = 0; d < daysInMonth; d++) {
                if (grid[s][d] === "出勤" && !canWork(grid[s], d, limit)) {
                    grid[s][d] = "公休";
                    changed = true;
                }
            }
        }
    }

    // --- 3. 人数調整：多すぎ削減 ---
    for (let d = 0; d < daysInMonth; d++) {
        let target = dailyTargets[d];
        let workers = staffs.map((_, i) => i).filter(i => grid[i][d] === "出勤");
        while (workers.length > target) {
            let candidates = workers.filter(i => {
                const sel = selects.find(s => parseInt(s.dataset.staff) === i && parseInt(s.dataset.day) === d+1);
                if (sel && ["希望休", "有給", "出勤"].includes(sel.value)) return false;
                if (staffs[i].type === "part" && countWork(grid[i]) <= 10) return false;
                return true;
            });
            if (candidates.length === 0) break;
            let idx = candidates[Math.floor(Math.random() * candidates.length)];
            grid[idx][d] = "公休";
            workers = workers.filter(w => w !== idx);
        }
    }

    // --- 4. 不足補填フェーズ（精度向上版） ---
    for (let d = 0; d < daysInMonth; d++) {
        let target = dailyTargets[d];
        let workers = staffs.map((_, i) => i).filter(i => grid[i][d] === "出勤");
        
        if (workers.length < target) {
            let candidates = staffs.map((_, i) => i).filter(i => {
                const sel = selects.find(s => parseInt(s.dataset.staff) === i && parseInt(s.dataset.day) === d+1);
                if (sel && ["希望休", "有給", "公休"].includes(sel.value)) return false;
                if (grid[i][d] !== "公休") return false;
                if (staffs[i].type === "part" && countWork(grid[i]) >= 10) return false;
                
                // 【核心】9休を下回る（8休以下になる）なら追加禁止
                // 逆に言えば、休みが10日以上ある常勤はここでの補填対象になる
                if (staffs[i].type === "full" && countOff(grid[i]) <= 9) return false;
                
                return true;
            });

            // ソート強化：出勤が少ない ＋ 休みが多すぎる人を優先
            candidates.sort((a, b) => {
                let workDiff = countWork(grid[a]) - countWork(grid[b]);
                if (workDiff !== 0) return workDiff;
                return countOff(grid[b]) - countOff(grid[a]);
            });

            for (let pass = 0; pass < 2; pass++) {
                for (let idx of candidates) {
                    if (workers.length >= target) break;
                    let limit = (staffs[idx].type === 'full') ? 4 : 2;
                    if (pass === 0 && !canWork(grid[idx], d, limit)) continue;
                    grid[idx][d] = "出勤";
                    workers.push(idx);
                }
            }
        }
    }

    // --- 5. 最終補正（双方向是正） ---
    for (let s = 0; s < staffs.length; s++) {
        let row = grid[s];
        let safety = 0;
        
        if (staffs[s].type === "part") {
            while (countWork(row) < 10 && safety < 200) {
                let d = Math.floor(Math.random() * daysInMonth);
                if (row[d] === "公休" && canWork(row, d, 2)) {
                    const sel = selects.find(ui => parseInt(ui.dataset.staff) === s && parseInt(ui.dataset.day) === d+1);
                    if (!sel || (sel.value !== "希望休" && sel.value !== "有給")) row[d] = "出勤";
                }
                safety++;
            }
        }

        if (staffs[s].type === "full") {
            // 足りない(8休以下)なら増やす
            while (countOff(row) < 9 && safety < 200) {
                let d = Math.floor(Math.random() * daysInMonth);
                if (row[d] === "出勤") {
                    const sel = selects.find(ui => parseInt(ui.dataset.staff) === s && parseInt(ui.dataset.day) === d+1);
                    if (!sel || sel.value !== "出勤") row[d] = "公休";
                }
                safety++;
            }
            // 多すぎる(10休以上)なら減らす
            safety = 0;
            while (countOff(row) > 9 && safety < 200) {
                let d = Math.floor(Math.random() * daysInMonth);
                if (row[d] === "公休") {
                    const sel = selects.find(ui => parseInt(ui.dataset.staff) === s && parseInt(ui.dataset.day) === d+1);
                    if ((!sel || (sel.value !== "希望休" && sel.value !== "有給")) && canWork(row, d, 4)) row[d] = "出勤";
                }
                safety++;
            }
        }
    }

    // 反映
    selects.forEach(sel => {
        sel.value = grid[parseInt(sel.dataset.staff)][parseInt(sel.dataset.day) - 1];
    });
    updateSummary();
    alert("自動生成が完了しました！");
}

/**
 * UI管理関数群 (HTML側のIDに依存)
 */
function renderStaffList() {
    const list = document.getElementById('staffList');
    if (!list) return;
    list.innerHTML = staffs.map((s, i) => `
        <div class="staff-item" style="border:1px solid #ddd; padding:8px; margin-bottom:5px; border-radius:5px; background:#f9f9f9;">
            <input type="text" value="${s.name}" onchange="staffs[${i}].name=this.value; generateTable();" style="width:60%">
            <select onchange="staffs[${i}].type=this.value; updateSummary();">
                <option value="full" ${s.type==='full'?'selected':''}>常勤</option>
                <option value="part" ${s.type==='part'?'selected':''}>非常勤</option>
            </select>
            <div style="font-size:11px; margin-top:5px;">
                有給日数: <input type="number" value="${s.paidDays}" onchange="staffs[${i}].paidDays=parseInt(this.value)||0; updateSummary();" style="width:30px">
                <button onclick="removeStaff(${i})" style="color:red; float:right; border:none; background:none; cursor:pointer;">削除</button>
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
    for (let d = 1; d <= daysInMonth; d++) { fRow += `<td><input type="number" class="need-count-input" data-day="${d}" value="${defaultNeed}" style="width:25px"></td>`; }
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
        const counts = { "出勤": 0, "公休": 0, "希望休": 0, "有給": 0 };
        mySelects.forEach(sel => { if (counts[sel.value] !== undefined) counts[sel.value]++; });
        return `<div style="padding:2px; border-bottom:1px solid #eee;"><b>${s.name}</b>: 出 ${counts["出勤"]} / 休 ${counts["公休"]+counts["希望休"]+counts["有給"]}</div>`;
    }).join('');
}
