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
    }
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
    // 試行回数を増やして複雑なパズルを解きやすくする
    for (let trial = 0; trial < 30000; trial++) {
        let grid = staffs.map((_, sIdx) => Array.from({length: daysInMonth}, (_, d) => {
            const sel = selects.find(s => parseInt(s.dataset.staff) === sIdx && parseInt(s.dataset.day) === d+1);
            return (sel && (sel.value !== "" && sel.value !== "出勤")) ? sel.value : "";
        }));

        let dailyTargets = needInputs.map(input => parseInt(input.value) || 0);

        // 1. 非常勤の出勤10日をランダムにばらけさせる（分散）
        grid.forEach((row, sIdx) => {
            if (staffs[sIdx].type === 'part') {
                let count = 0;
                let attempts = 0;
                while (count < 10 && attempts < 500) {
                    let r = Math.floor(Math.random() * daysInMonth);
                    // なるべく間隔を空け、かつ目標人数がある日に配置
                    let nearWork = false;
                    for (let j = Math.max(0, r-1); j <= Math.min(daysInMonth-1, r+1); j++) { if(row[j]==="出勤") nearWork = true; }
                    if (row[r] === "" && dailyTargets[r] > 0 && !nearWork) {
                        row[r] = "出勤";
                        count++;
                    }
                    attempts++;
                }
                while (count < 10) { // 隙間に埋める
                    let r = Math.floor(Math.random() * daysInMonth);
                    if (row[r] === "" && dailyTargets[r] > 0) { row[r] = "出勤"; count++; }
                    if (attempts++ > 1000) break;
                }
            }
        });

        // 2. 常勤の休み9日を配置
        grid.forEach((row, sIdx) => {
            if (staffs[sIdx].type === 'full') {
                let neededOff = 9 - row.filter(v => v === "希望休" || v === "公休").length;
                let emptyIndices = row.map((v, i) => v === "" ? i : -1).filter(i => i !== -1);
                for (let i = 0; i < neededOff && emptyIndices.length > 0; i++) {
                    let r = Math.floor(Math.random() * emptyIndices.length);
                    row[emptyIndices[r]] = "公休";
                    emptyIndices.splice(r, 1);
                }
            }
        });

        // 3. 有給を配置
        grid.forEach((row, sIdx) => {
            let needed = staffs[sIdx].paidDays - row.filter(v => v === "有給").length;
            let emptyIndices = row.map((v, i) => v === "" ? i : -1).filter(i => i !== -1);
            for (let i = 0; i < needed && emptyIndices.length > 0; i++) {
                let r = Math.floor(Math.random() * emptyIndices.length);
                row[emptyIndices[r]] = "有給";
                emptyIndices.splice(r, 1);
            }
        });

        // 4. メイン割り当て（3連勤制限を最優先）
        let success = true;
        for (let d = 0; d < daysInMonth; d++) {
            let target = dailyTargets[d];
            if (target === 0) continue;

            let assigned = grid.filter(row => row[d] === "出勤").length;
            
            let cand = staffs.map((_, i) => i).filter(sIdx => {
                if (grid[sIdx][d] !== "") return false;
                let streak = 0;
                for (let i = d - 1; i >= 0; i--) {
                    if (grid[sIdx][i] === "出勤" || grid[sIdx][i] === "有給") streak++;
                    else break;
                }
                return streak < 3; // 3連勤まで
            });

            // 出勤日数が少ない順に割り当てる（平準化）
            cand.sort((a, b) => (grid[a].filter(v=>v==="出勤").length - grid[b].filter(v=>v==="出勤").length) + (Math.random()-0.5));

            for (let sIdx of cand) {
                if (assigned >= target) break;
                grid[sIdx][d] = "出勤";
                assigned++;
            }

            // 【柔軟ルール】目標3人以上でも、2人確保できていれば「成功」とする
            let minLimit = (target >= 3) ? 2 : target;
            if (assigned < minLimit) { success = false; break; }
        }

        // 5. 最終整合性チェック
        if (success) {
            grid.forEach((row, sIdx) => {
                for (let i = 0; i < row.length; i++) {
                    if (row[i] === "") {
                        if (staffs[sIdx].type === 'part') row[i] = "公休";
                        else {
                            let streak = 0;
                            for (let j = i - 1; j >= 0; j--) { if (row[j] === "出勤" || row[j] === "有給") streak++; else break; }
                            // 空欄は埋めるが、ここでも3連勤制限をチェック
                            if (streak < 3) row[i] = "出勤";
                            else row[i] = "公休";
                        }
                    }
                }
                // 常勤の休みが9日に満たない場合はNG（パズル失敗）
                if (staffs[sIdx].type === 'full' && row.filter(v => v === "公休" || v === "希望休").length < 9) success = false;
                // 非常勤の出勤が10日でない場合はNG
                if (staffs[sIdx].type === 'part' && row.filter(v => v === "出勤").length !== 10) success = false;
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
        alert("自動生成が完了しました！\n※3連勤制限を優先し、一部の日は2名体制で調整しました。");
    } else {
        alert("条件が厳しく、シフトを完成させられませんでした。以下の調整を試してください：\n1. 同じ日に希望休が重なりすぎていないか確認\n2. スタッフを1名増やす");
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
        return `<div class="summary-row"><strong>${s.name}</strong> (${s.type==='full'?'常勤':'非常勤'})<br>出勤: ${c["出勤"]} / 休み: ${c["公休"] + c["希望休"]}日</div>`;
    }).join('');
}
