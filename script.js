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
    const monthInput = document.getElementById('targetMonth');
    const [year, month] = monthInput.value.split('-').map(Number);

    for (let attempt = 0; attempt < 50; attempt++) {
        let success = true;
        let grid = staffs.map((_, sIdx) => Array.from({length: daysInMonth}, (_, d) => {
            const sel = selects.find(s => parseInt(s.dataset.staff) === sIdx && parseInt(s.dataset.day) === d+1);
            return (sel && sel.value !== "" && sel.value !== "出勤") ? sel.value : "";
        }));

        staffs.forEach((s, sIdx) => {
            let needed = s.paidDays - grid[sIdx].filter(v => v === "有給").length;
            for(let i=0; i<500 && needed > 0; i++) {
                let d = Math.floor(Math.random() * daysInMonth);
                if (grid[sIdx][d] === "") { grid[sIdx][d] = "有給"; needed--; }
            }
        });

        let dailyTargets = needInputs.map(input => parseInt(input.value) || 0);

        for (let d = 0; d < daysInMonth; d++) {
            let target = dailyTargets[d];
            if (target === 0) {
                grid.forEach(row => { if(row[d] === "") row[d] = "公休"; });
                continue;
            }

            let candidates = staffs.map((_, i) => i).filter(sIdx => {
                if (grid[sIdx][d] !== "") return false;
                let sPrev = 0; for (let i=d-1; i>=0; i--) { if(grid[sIdx][i]==="出勤") sPrev++; else break; }
                let sNext = 0; for (let i=d+1; i<daysInMonth; i++) { if(grid[sIdx][i]==="出勤") sNext++; else break; }
                if (sPrev + sNext >= 4) return false;

                if (staffs[sIdx].type === 'part') {
                    let weekStart = Math.floor(d / 7) * 7;
                    let weekEnd = Math.min(weekStart + 7, daysInMonth);
                    let weeklyCount = grid[sIdx].slice(weekStart, weekEnd).filter(v => v === "出勤" || v === "有給").length;
                    if (weeklyCount >= 3) return false;
                }
                return true;
            });

            candidates.sort((a, b) => {
                const sundayCount = (idx) =>
                    grid[idx].filter((v, i) => {
                        let date = new Date(year, month - 1, i + 1);
                        return date.getDay() === 0 && v === "出勤";
                    }).length;
                return sundayCount(a) - sundayCount(b) + (Math.random() - 0.5);
            });

            let assigned = grid.filter(row => row[d] === "出勤").length;
            for (let sIdx of candidates) {
                if (assigned >= target) break;
                grid[sIdx][d] = "出勤";
                assigned++;
            }

            let minAllowed = (target === 3) ? 2 : target;
            if (assigned < minAllowed) { success = false; break; }
        }

        if (!success) continue;

        grid.forEach((row, sIdx) => {
            let isFull = (staffs[sIdx].type === 'full');
            let targetOff = isFull ? 9 : (daysInMonth - 10);

            for (let i = 0; i < daysInMonth; i++) {
                if (row[i] === "") {
                    let sP = 0; for (let j=i-1; j>=0; j--) { if(row[j]==="出勤") sP++; else break; }
                    let sN = 0; for (let j=i+1; j<daysInMonth; j++) { if(row[j]==="出勤") sN++; else break; }
                    
                    let weekStart = Math.floor(i / 7) * 7;
                    let weekEnd = weekStart + 7;
                    let weeklyCount = row.slice(weekStart, weekEnd).filter(v=>"出勤"===v).length;

                    let currentCount = grid.filter(r => r[i] === "出勤").length;
                    let target = dailyTargets[i];
                    let limit = isFull ? 4 : 2;

                    if (currentCount < target && sP + sN < limit) {
                        if (staffs[sIdx].type === 'part' && weeklyCount >= 3) {
                            row[i] = "公休";
                        } else {
                            row[i] = "出勤";
                        }
                    } else {
                        row[i] = "公休";
                    }
                }
            }

            let safety = 0;
            while (row.filter(v => v === "公休" || v === "希望休").length < targetOff && safety < 100) {
                let maxS = 0, bestIdx = -1, cur = 0;
                for(let i=0; i<daysInMonth; i++){
                    if(row[i]==="出勤"){ cur++; if(cur > maxS){ maxS = cur; bestIdx = i; } }
                    else cur = 0;
                }
                if(bestIdx !== -1) {
                    if (row[bestIdx] === "出勤") {
                        let currentCount = grid.filter(r => r[bestIdx] === "出勤").length;
                        let target = dailyTargets[bestIdx];
                        if (currentCount > target) {
                            row[bestIdx] = "公休";
                        }
                    }
                } else break;
                safety++;
            }
        });

        // 【最終人数チェックおよび補充ロジック】
        for (let d = 0; d < daysInMonth; d++) {
            let target = dailyTargets[d];
            let workers = staffs.map((_, i) => i).filter(sIdx => grid[sIdx][d] === "出勤");

            if (target === 3) {
                if (!(workers.length === 2 || workers.length === 3)) {
                    success = false;
                    break;
                }
                continue;
            }

            // 多すぎる場合 → 減らす
            while (workers.length > target) {
                let idx = workers.pop();
                grid[idx][d] = "公休";
            }

            // 【修正箇所】少なすぎる場合 → 補充する
            if (workers.length < target) {
                let candidates = staffs.map((_, i) => i).filter(sIdx => {
                    return grid[sIdx][d] === "公休"; // 公休から戻す
                });

                while (workers.length < target && candidates.length > 0) {
                    let idx = candidates.pop();
                    grid[idx][d] = "出勤";
                    workers.push(idx);
                }
            }

            // それでも足りなければ失敗
            if (workers.length < target) {
                success = false;
                break;
            }
        }

        if (!success) continue;

        selects.forEach(sel => {
            const sIdx = parseInt(sel.dataset.staff);
            const dIdx = parseInt(sel.dataset.day) - 1;
            sel.value = grid[sIdx][dIdx];
        });
        updateSummary();
        alert(`自動生成が完了しました（試行回数: ${attempt + 1}回）`);
        return;
    }

    alert("エラー: 50回試行しましたが、条件を満たすシフトが見つかりませんでした。希望休が多すぎるか、人数設定が厳しすぎます。");
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
