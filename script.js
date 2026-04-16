let staffs = [
    { name: "スタッフ1", type: "full", paidDays: 0 },
    { name: "スタッフ2", type: "full", paidDays: 0 },
    { name: "スタッフ3", type: "full", paidDays: 0 },
    { name: "スタッフ4", type: "full", paidDays: 0 },
    { name: "非常勤1", type: "part", paidDays: 0 }
];

window.onload = () => {
    const now = new Date();
    document.getElementById('targetMonth').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    renderStaffList();
    generateTable();
};

function renderStaffList() {
    const list = document.getElementById('staffList');
    list.innerHTML = staffs.map((s, i) => `
        <div class="staff-item">
            <input type="text" value="${s.name}" style="width:100%;" onchange="staffs[${i}].name=this.value; generateTable();">
            <select onchange="staffs[${i}].type=this.value; updateSummary();" style="width:100%; margin:8px 0;">
                <option value="full" ${s.type==='full'?'selected':''}>常勤</option>
                <option value="part" ${s.type==='part'?'selected':''}>非常勤</option>
            </select>
            <div style="font-size:12px;">
                有給付与: <input type="number" value="${s.paidDays}" style="width:40px;" onchange="staffs[${i}].paidDays=parseInt(this.value)||0; updateSummary();">日
                <button onclick="removeStaff(${i})" style="float:right; color:red; cursor:pointer;">削除</button>
            </div>
        </div>
    `).join('');
}

function addStaff() { staffs.push({ name: "新規スタッフ", type: "full", paidDays: 0 }); renderStaffList(); generateTable(); }
function removeStaff(idx) { staffs.splice(idx, 1); renderStaffList(); generateTable(); }

function generateTable() {
    const dateVal = document.getElementById('targetMonth').value;
    if(!dateVal) return;
    const [year, month] = dateVal.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    let dRow = '<th>名前</th>';
    let wRow = '<th>曜</th>';
    let hRow = '<th>定休日</th>';
    
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month - 1, d);
        const dayOfWeek = date.getDay();
        const dayName = ["日","月","火","水","木","金","土"][dayOfWeek];
        const dayClass = dayOfWeek === 6 ? 'sat' : dayOfWeek === 0 ? 'sun' : '';
        dRow += `<th>${d}</th>`;
        wRow += `<th class="${dayClass}">${dayName}</th>`;
        hRow += `<td><button class="holiday-btn" onclick="setColumnHoliday(${d})">休み</button></td>`;
    }
    document.getElementById('dateRow').innerHTML = dRow;
    document.getElementById('dayRow').innerHTML = wRow;
    document.getElementById('holidayRow').innerHTML = hRow;

    document.getElementById('shiftBody').innerHTML = staffs.map((staff, sIdx) => {
        let cells = `<td style="font-weight:bold;">${staff.name}</td>`;
        for (let d = 1; d <= daysInMonth; d++) {
            cells += `<td><select class="shift-select" data-staff="${sIdx}" data-day="${d}" onchange="updateSummary()"><option value="">-</option><option value="出勤">出</option><option value="公休">公</option><option value="希望休">希</option><option value="有給">有</option></select></td>`;
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
    const selects = document.querySelectorAll(`.shift-select[data-day="${day}"]`);
    selects.forEach(s => s.value = "公休");
    const needInput = document.querySelector(`.need-count-input[data-day="${day}"]`);
    if(needInput) needInput.value = 0;
    updateSummary();
}

function autoFillShift() {
    const selects = document.querySelectorAll('.shift-select');
    const needInputs = document.querySelectorAll('.need-count-input');
    const daysInMonth = needInputs.length;

    let finalGrid = null;
    for (let trial = 0; trial < 1500; trial++) {
        let grid = staffs.map((_, sIdx) => Array.from({length: daysInMonth}, (_, d) => {
            const el = Array.from(selects).find(s => parseInt(s.dataset.staff) === sIdx && parseInt(s.dataset.day) === d+1);
            return (el.value !== "" && el.value !== "出勤") ? el.value : "";
        }));

        grid.forEach((row, sIdx) => {
            let needed = staffs[sIdx].paidDays - row.filter(v => v === "有給").length;
            let emptyIdx = row.map((v, i) => v === "" ? i : -1).filter(i => i !== -1);
            for (let i = 0; i < needed && emptyIdx.length > 0; i++) {
                let r = Math.floor(Math.random() * emptyIdx.length);
                row[emptyIdx[r]] = "有給";
                emptyIdx.splice(r, 1);
            }
        });

        let success = true;
        for (let d = 0; d < daysInMonth; d++) {
            const need = parseInt(needInputs[d].value) || 0;
            let candidates = staffs.map((_, i) => i).filter(sIdx => {
                if (grid[sIdx][d] !== "") return false;
                let streak = 0;
                for (let i = d - 1; i >= 0 && grid[sIdx][i] === "出勤"; i--) streak++;
                if (streak >= 3) return false;
                if (staffs[sIdx].type === 'part' && grid[sIdx].filter(v => v === "出勤").length >= 10) return false;
                return true;
            }).sort(() => Math.random() - 0.5);

            for (let sIdx of candidates) {
                if (grid.filter(row => row[d] === "出勤").length >= need) break;
                grid[sIdx][d] = "出勤";
            }
            if (grid.filter(row => row[d] === "出勤").length < need) { success = false; break; }
        }
        if (!success) continue;

        grid.forEach((row, sIdx) => {
            row.forEach((v, i) => { if(v === "") row[i] = "公休"; });
            if (staffs[sIdx].type === 'full') {
                let getOff = () => row.filter(v => v === "公休" || v === "希望休").length;
                while (getOff() < 9) {
                    let w = row.map((v, i) => v === "出勤" ? i : -1).filter(i => i !== -1);
                    if (w.length === 0) break;
                    row[w[0]] = "公休";
                }
            }
        });
        finalGrid = grid; break;
    }

    if (finalGrid) {
        selects.forEach(sel => { sel.value = finalGrid[parseInt(sel.dataset.staff)][parseInt(sel.dataset.day)-1]; });
        updateSummary();
        alert("生成完了！");
    } else {
        alert("条件に合う案が見つかりません。人数を調整してください。");
    }
}

function updateSummary() {
    const list = document.getElementById('summaryList');
    const selects = document.querySelectorAll('.shift-select');
    list.innerHTML = staffs.map((s, idx) => {
        const mySels = Array.from(selects).filter(sel => parseInt(sel.dataset.staff) === idx);
        const counts = { "出勤": 0, "公休": 0, "希望休": 0, "有給": 0 };
        mySels.forEach(sel => { if (counts[sel.value] !== undefined) counts[sel.value]++; });
        return `<div class="summary-row"><strong>${s.name}</strong><br>出勤: ${counts["出勤"]} / 有給: ${counts["有給"]} / 休み: ${counts["公休"]+counts["希望休"]}</div>`;
    }).join('');
}
