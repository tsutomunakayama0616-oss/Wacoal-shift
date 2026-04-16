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
            <input type="text" value="${s.name}" style="width:100%;" onchange="staffs[${i}].name=this.value; generateTable();">
            <select onchange="staffs[${i}].type=this.value; updateSummary();" style="width:100%; margin:8px 0;">
                <option value="full" ${s.type==='full'?'selected':''}>常勤</option>
                <option value="part" ${s.type==='part'?'selected':''}>非常勤</option>
            </select>
            <div style="font-size:12px;">
                有給: <input type="number" value="${s.paidDays}" style="width:40px;" onchange="staffs[${i}].paidDays=parseInt(this.value)||0; updateSummary();">
                <button onclick="removeStaff(${i})" style="float:right; color:red; cursor:pointer; border:none; background:none;">削除</button>
            </div>
        </div>
    `).join('');
}

function addStaff() { staffs.push({ name: "新規", type: "full", paidDays: 0 }); renderStaffList(); generateTable(); }
function removeStaff(idx) { staffs.splice(idx, 1); renderStaffList(); generateTable(); }

function generateTable() {
    const dateVal = document.getElementById('targetMonth').value;
    const [year, month] = dateVal.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    let dRow = '<th>名前</th>', wRow = '<th>曜</th>', hRow = '<th>定休日</th>';
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month - 1, d);
        const dayOfWeek = date.getDay();
        const dayClass = dayOfWeek === 6 ? 'sat' : dayOfWeek === 0 ? 'sun' : '';
        dRow += `<th>${d}</th>`;
        wRow += `<th class="${dayClass}">${["日","月","火","水","木","金","土"][dayOfWeek]}</th>`;
        hRow += `<td><button class="holiday-btn" onclick="setColumnHoliday(${d})">休み</button></td>`;
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
    let fRow = '<td>必要人数</td>';
    for (let d = 1; d <= daysInMonth; d++) {
        fRow += `<td><input type="number" class="need-count-input" data-day="${d}" value="3"></td>`;
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
    const dateVal = document.getElementById('targetMonth').value;
    const [year, month] = dateVal.split('-').map(Number);
    const daysInMonth = needInputs.length;
    const sundays = [];
    for (let d = 1; d <= daysInMonth; d++) if (new Date(year, month - 1, d).getDay() === 0) sundays.push(d - 1);

    let finalGrid = null;
    let errorLog = Array(daysInMonth).fill(0).map(() => ({ totalFail: 0, reasons: {} }));

    for (let trial = 0; trial < 2000; trial++) {
        let grid = staffs.map((_, sIdx) => Array.from({length: daysInMonth}, (_, d) => {
            const sel = selects.find(s => parseInt(s.dataset.staff) === sIdx && parseInt(s.dataset.day) === d+1);
            return (sel && sel.value !== "" && sel.value !== "出勤") ? sel.value : "";
        }));

        // 有給配置
        grid.forEach((row, sIdx) => {
            let needed = staffs[sIdx].paidDays - row.filter(v => v === "有給").length;
            let empty = row.map((v, i) => v === "" ? i : -1).filter(i => i !== -1);
            for (let i = 0; i < needed && empty.length > 0; i++) {
                let r = Math.floor(Math.random() * empty.length);
                row[empty[r]] = "有給";
                empty.splice(r, 1);
            }
        });

        let success = true;
        for (let d = 0; d < daysInMonth; d++) {
            const need = parseInt(needInputs[d].value) || 0;
            let cand = staffs.map((_, i) => i).filter(sIdx => {
                if (grid[sIdx][d] !== "") return false;
                let streak = 0;
                for (let i = d - 1; i >= 0; i--) {
                    if (grid[sIdx][i] === "出勤" || grid[sIdx][i] === "有給") streak++;
                    else break;
                }
                if (streak >= 6) {
                    errorLog[d].reasons["6連勤制限"] = (errorLog[d].reasons["6連勤制限"] || 0) + 1;
                    return false;
                }
                if (staffs[sIdx].type === 'part' && grid[sIdx].filter(v => v === "出勤").length >= 10) {
                    errorLog[d].reasons["非常勤10日上限"] = (errorLog[d].reasons["非常勤10日上限"] || 0) + 1;
                    return false;
                }
                return true;
            });

            cand.sort((a, b) => {
                if (staffs[a].type === 'part' || staffs[b].type === 'part') {
                    return grid[a].filter(v => v === "出勤").length - grid[b].filter(v => v === "出勤").length;
                }
                if (sundays.includes(d)) {
                    const countA = sundays.filter(sunIdx => grid[a][sunIdx] === "出勤").length;
                    const countB = sundays.filter(sunIdx => grid[b][sunIdx] === "出勤").length;
                    return countA - countB;
                }
                return Math.random() - 0.5;
            });

            for (let sIdx of cand) {
                if (grid.filter(row => row[d] === "出勤").length >= need) break;
                grid[sIdx][d] = "出勤";
            }

            if (grid.filter(row => row[d] === "出勤").length < need) {
                errorLog[d].totalFail++;
                success = false;
                break;
            }
        }

        if (success) {
            grid.forEach(row => { for (let i = 0; i < row.length; i++) if (row[i] === "") row[i] = "公休"; });
            finalGrid = grid;
            break;
        }
    }

    if (finalGrid) {
        selects.forEach(sel => {
            const sIdx = parseInt(sel.dataset.staff);
            const dIdx = parseInt(sel.dataset.day) - 1;
            sel.value = finalGrid[sIdx][dIdx];
        });
        updateSummary();
        alert("自動生成が完了しました！");
    } else {
        // エラー詳細の作成
        let worstDayIdx = 0;
        let maxFails = -1;
        errorLog.forEach((log, i) => { if(log.totalFail > maxFails) { maxFails = log.totalFail; worstDayIdx = i; } });

        const failDay = worstDayIdx + 1;
        const dayNames = ["日","月","火","水","木","金","土"];
        const failDayName = dayNames[new Date(year, month - 1, failDay).getDay()];
        
        // 空白を公休で埋める（表示用）
        selects.forEach(sel => { if (sel.value === "") sel.value = "公休"; });
        updateSummary();

        let message = `【シフト作成エラー】\n\n`;
        message += `特に「${failDay}日(${failDayName})」でスタッフが足りません。\n`;
        message += `この日の必要人数を「${parseInt(needInputs[worstDayIdx].value) - 1}人」に減らすと解決する可能性があります。\n\n`;
        message += `理由の傾向:\n`;
        const reasons = errorLog[worstDayIdx].reasons;
        if (Object.keys(reasons).length > 0) {
            for (let r in reasons) message += `・${r}により出勤不可のスタッフがいます\n`;
        } else {
            message += `・休み設定(公休・希望休)が多すぎて出勤できる人がいません\n`;
        }

        alert(message);
    }
}

function updateSummary() {
    const selects = document.querySelectorAll('.shift-select');
    document.getElementById('summaryList').innerHTML = staffs.map((s, idx) => {
        const my = Array.from(selects).filter(sel => parseInt(sel.dataset.staff) === idx);
        const c = { "出勤":0, "公休":0, "希望休":0, "有給":0 };
        my.forEach(sel => { if(c[sel.value] !== undefined) c[sel.value]++; });
        return `<div class="summary-row"><strong>${s.name}</strong><br>出勤:${c["出勤"]} / 有給:${c["有給"]} / 休み:${c["公
