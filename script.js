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
    // 成功率を高めるため、内部ロジックを「休みを後から差し込む」方式に整理
    for (let trial = 0; trial < 1000; trial++) {
        let grid = staffs.map((_, sIdx) => Array.from({length: daysInMonth}, (_, d) => {
            const sel = selects.find(s => parseInt(s.dataset.staff) === sIdx && parseInt(s.dataset.day) === d+1);
            return (sel && (sel.value !== "" && sel.value !== "出勤")) ? sel.value : "";
        }));

        let dailyTargets = needInputs.map(input => parseInt(input.value) || 0);

        // 1. 各日の出勤を割り当てる（5連勤回避）
        let success = true;
        for (let d = 0; d < daysInMonth; d++) {
            let target = dailyTargets[d];
            if (target === 0) {
                grid.forEach(row => { if(row[d]==="") row[d]="公休"; });
                continue;
            }

            let assigned = grid.filter(row => row[d] === "出勤").length;
            let cand = staffs.map((_, i) => i).filter(sIdx => {
                if (grid[sIdx][d] !== "") return false;
                let streak = 0;
                for (let i = d - 1; i >= 0; i--) {
                    if (grid[sIdx][i] === "出勤" || grid[sIdx][i] === "有給") streak++;
                    else break;
                }
                return streak < 4; // 5連勤禁止
            });

            // 休みが必要な人（休みが足りない常勤）を優先的に休ませるため、出勤が多い人を後回しにする
            cand.sort((a, b) => (grid[a].filter(v=>v==="出勤").length - grid[b].filter(v=>v==="出勤").length) + (Math.random()-0.5));

            for (let sIdx of cand) {
                if (assigned >= target) break;
                grid[sIdx][d] = "出勤";
                assigned++;
            }
            
            // 最低2人は死守
            if (assigned < (target >= 2 ? 2 : target)) { success = false; break; }
        }

        if (success) {
            // 2. 休み日数の強制調整
            grid.forEach((row, sIdx) => {
                let isFull = (staffs[sIdx].type === 'full');
                let targetOff = isFull ? 9 : (daysInMonth - 10);

                // 未設定を一旦すべて出勤にする
                for (let i = 0; i < daysInMonth; i++) { if(row[i] === "") row[i] = "出勤"; }

                // 休みが足りない場合、連勤が長い箇所から削る
                let attempts = 0;
                while (row.filter(v => v === "公休" || v === "希望休").length < targetOff && attempts < 100) {
                    let maxStreak = 0;
                    let targetIdx = -1;
                    let currentStreak = 0;
                    for(let i=0; i<daysInMonth; i++) {
                        if(row[i]==="出勤") currentStreak++;
                        else {
                            if(currentStreak > maxStreak) { maxStreak = currentStreak; targetIdx = i - 1; }
                            currentStreak = 0;
                        }
                    }
                    if(currentStreak > maxStreak) targetIdx = daysInMonth - 1;
                    
                    if(targetIdx !== -1 && row[targetIdx] === "出勤") {
                        row[targetIdx] = "公休";
                    } else {
                        // どこでもいいから出勤を公休に変える
                        let idxs = row.map((v,i)=>v==="出勤"?i:-1).filter(i=>i!==-1);
                        if(idxs.length > 0) row[idxs[Math.floor(Math.random()*idxs.length)]] = "公休";
                    }
                    attempts++;
                }
            });

            // 3. 最終チェック（全スタッフの条件を満たしているか）
            let valid = true;
            grid.forEach((row, sIdx) => {
                let off = row.filter(v => v === "公休" || v === "希望休").length;
                if (staffs[sIdx].type === 'full' && off !== 9) valid = false;
                if (staffs[sIdx].type === 'part' && row.filter(v => v === "出勤").length !== 10) valid = false;
                
                let streak = 0;
                row.forEach(v => {
                    if (v === "出勤") streak++; else streak = 0;
                    if (streak > 4) valid = false;
                });
            });

            // 各日の最低人数チェック
            for (let d = 0; d < daysInMonth; d++) {
                if (dailyTargets[d] > 0 && grid.filter(r => r[d] === "出勤").length < 2) valid = false;
            }

            if (valid) { finalGrid = grid; break; }
        }
    }

    if (finalGrid) {
        selects.forEach(sel => {
            const sIdx = parseInt(sel.dataset.staff);
            const dIdx = parseInt(sel.dataset.day) - 1;
            sel.value = finalGrid[sIdx][dIdx];
        });
        updateSummary();
        alert("成功しました！5連勤を回避しつつ、休みを調整しました。");
    } else {
        alert("やはり条件が厳しいようです。スタッフ5名体制では「全員を9日休ませる」と「毎日3人確保」の両立が非常に難しいため、数日（特に日曜や土曜）の目標人数を「2」に減らしてみてください。");
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
