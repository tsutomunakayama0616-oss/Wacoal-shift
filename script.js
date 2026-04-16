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
    // 試行回数を減らし、1回あたりの質を高める
    for (let trial = 0; trial < 5000; trial++) {
        let grid = staffs.map((_, sIdx) => Array.from({length: daysInMonth}, (_, d) => {
            const sel = selects.find(s => parseInt(s.dataset.staff) === sIdx && parseInt(s.dataset.day) === d+1);
            return (sel && (sel.value !== "" && sel.value !== "出勤")) ? sel.value : "";
        }));

        let dailyTargets = needInputs.map(input => parseInt(input.value) || 0);

        // 1. 各日の目標人数を埋める（3連勤制限を厳守）
        let success = true;
        for (let d = 0; d < daysInMonth; d++) {
            let target = dailyTargets[d];
            if (target === 0) continue;

            let assigned = grid.filter(row => row[d] === "出勤").length;
            if (assigned >= target) continue;

            let cand = staffs.map((_, i) => i).filter(sIdx => {
                if (grid[sIdx][d] !== "") return false;
                let streak = 0;
                for (let i = d - 1; i >= 0; i--) {
                    if (grid[sIdx][i] === "出勤" || grid[sIdx][i] === "有給") streak++;
                    else break;
                }
                return streak < 3; // 4連勤禁止
            });

            // 出勤回数が少なく、かつ前日が休みの人を優先（ローテーションの安定）
            cand.sort((a, b) => {
                let countA = grid[a].filter(v => v === "出勤").length;
                let countB = grid[b].filter(v => v === "出勤").length;
                return countA - countB + (Math.random() - 0.5);
            });

            for (let sIdx of cand) {
                if (assigned >= target) break;
                grid[sIdx][d] = "出勤";
                assigned++;
            }
            if (assigned < (target >= 2 ? 2 : target)) { success = false; break; }
        }

        // 2. 常勤の休みを9日に調整 / 非常勤を10日に調整
        if (success) {
            grid.forEach((row, sIdx) => {
                let isFull = (staffs[sIdx].type === 'full');
                let targetOff = isFull ? 9 : (daysInMonth - 10);
                
                // 空欄を埋める
                for (let i = 0; i < daysInMonth; i++) {
                    if (row[i] === "") {
                        let streak = 0;
                        for (let j = i - 1; j >= 0; j--) { if (row[j] === "出勤") streak++; else break; }
                        if (streak < 3 && row.filter(v=>v==="出勤").length < (isFull ? 99 : 10)) {
                            row[i] = "出勤";
                        } else {
                            row[i] = "公休";
                        }
                    }
                }

                // 休みが多すぎる・少なすぎる場合の微調整
                let currentOff = row.filter(v => v === "公休" || v === "希望休").length;
                if (currentOff < targetOff) {
                    // 休みを増やす
                    let workIdx = row.map((v, i) => v === "出勤" ? i : -1).filter(i => i !== -1);
                    while (row.filter(v => v === "公休" || v === "希望休").length < targetOff && workIdx.length > 0) {
                        row[workIdx.pop()] = "公休";
                    }
                } else if (currentOff > targetOff) {
                    // 休みを減らす
                    let offIdx = row.map((v, i) => v === "公休" ? i : -1).filter(i => i !== -1);
                    while (row.filter(v => v === "公休" || v === "希望休").length > targetOff && offIdx.length > 0) {
                        let idx = offIdx.pop();
                        let streak = 0;
                        for (let j = idx - 1; j >= 0; j--) { if (row[j] === "出勤") streak++; else break; }
                        if (streak < 3) row[idx] = "出勤";
                    }
                }
            });

            // 3. 最終バリデーション
            grid.forEach((row, sIdx) => {
                // 休み数チェック
                let offCount = row.filter(v => v === "公休" || v === "希望休").length;
                if (staffs[sIdx].type === 'full' && offCount !== 9) success = false;
                if (staffs[sIdx].type === 'part' && row.filter(v => v === "出勤").length !== 10) success = false;
                // 3連勤チェック
                let streak = 0;
                row.forEach(v => {
                    if (v === "出勤" || v === "有給") streak++; else streak = 0;
                    if (streak > 3) success = false;
                });
            });
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
        alert("完成しました！");
    } else {
        alert("条件が厳しく、3連勤制限を守ったまま作成できませんでした。数日だけ目標人数を減らしてください。");
    }
}

function updateSummary() {
    const selects = document.querySelectorAll('.shift-select');
    const summaryList = document.getElementById('summaryList');
    if (!summaryList) return;
    summaryList.innerHTML = staffs.map((s, idx) => {
        const mySelects = Array.from(selects).filter(sel => parseInt(sel.dataset.staff) === idx);
        const counts = { "出勤": 0, "公休": 0, "希望休": 0, "有給": 0 };
        mySelects.forEach(sel => { if (counts[sel.value] !== undefined) counts[sel.value]++; });
        return `<div class="summary-row"><strong>${s.name}</strong><br>出勤: ${counts["出勤"]} / 休み: ${counts["公休"] + counts["希望休"]}日</div>`;
    }).join('');
}
