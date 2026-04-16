let staffs = [
    { name: "スタッフ1", type: "full", paidDays: 0 },
    { name: "スタッフ2", type: "full", paidDays: 0 },
    { name: "スタッフ3", type: "full", paidDays: 0 },
    { name: "スタッフ4", type: "full", paidDays: 0 },
    { name: "スタッフ5", type: "part", paidDays: 0 }
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
            <input type="text" value="${s.name}" style="width:100%" onchange="staffs[${i}].name=this.value; generateTable();">
            <select onchange="staffs[${i}].type=this.value; updateSummary();" style="width:100%; margin:5px 0;">
                <option value="full" ${s.type==='full'?'selected':''}>常勤</option>
                <option value="part" ${s.type==='part'?'selected':''}>非常勤</option>
            </select>
            有給:<input type="number" value="${s.paidDays}" style="width:40px;" onchange="staffs[${i}].paidDays=parseInt(this.value)||0; updateSummary();">
            <button onclick="removeStaff(${i})" style="color:red; float:right;">×</button>
        </div>
    `).join('');
}

function addStaff() { staffs.push({ name: "新規", type: "full", paidDays: 0 }); renderStaffList(); generateTable(); }
function removeStaff(idx) { staffs.splice(idx, 1); renderStaffList(); generateTable(); }

function generateTable() {
    const dateVal = document.getElementById('targetMonth').value;
    if(!dateVal) return;
    const [year, month] = dateVal.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    document.getElementById('dateRow').innerHTML = '<th>名前</th>' + Array.from({length: daysInMonth}, (_, i) => `<th>${i+1}</th>`).join('');
    
    let dayHtml = '<th>曜</th>';
    let holHtml = '<th>定休日</th>';
    for (let d = 1; d <= daysInMonth; d++) {
        const dayOfWeek = new Date(year, month - 1, d).getDay();
        const className = dayOfWeek === 6 ? 'sat' : dayOfWeek === 0 ? 'sun' : '';
        dayHtml += `<th class="${className}">${["日","月","火","水","木","金","土"][dayOfWeek]}</th>`;
        holHtml += `<td><div class="holiday-btn" onclick="setHoliday(${d})">休み</div></td>`;
    }
    document.getElementById('dayRow').innerHTML = dayHtml;
    document.getElementById('holidayRow').innerHTML = holHtml;

    document.getElementById('shiftBody').innerHTML = staffs.map((staff, sIdx) => {
        let cells = `<td>${staff.name}</td>`;
        for (let d = 1; d <= daysInMonth; d++) {
            cells += `<td><select class="shift-select" data-staff="${sIdx}" data-day="${d}" onchange="updateSummary()"><option value="">-</option><option value="出勤">出</option><option value="公休">公</option><option value="希望休">希</option><option value="有給">有</option></select></td>`;
        }
        return `<tr>${cells}</tr>`;
    }).join('');

    let footHtml = '<td>必要人数</td>';
    for (let d = 1; d <= daysInMonth; d++) {
        footHtml += `<td><input type="number" class="need-count-input" value="3" style="width:35px; text-align:center;"></td>`;
    }
    document.getElementById('shiftFoot').innerHTML = `<tr>${footHtml}</tr>`;
    updateSummary();
}

// 【新機能】特定の日の全員を「公休」にする
function setHoliday(day) {
    const selects = document.querySelectorAll(`.shift-select[data-day="${day}"]`);
    selects.forEach(s => s.value = "公休");
    const needInput = document.querySelector(`.need-count-input[data-day="${day}"]`);
    if(needInput) needInput.value = 0; // 休みなので必要人数を0に
    updateSummary();
}

function autoFillShift() {
    const selects = document.querySelectorAll('.shift-select');
    const needInputs = document.querySelectorAll('.need-count-input');
    const [year, month] = document.getElementById('targetMonth').value.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    let finalGrid = null;
    for (let t = 0; t < 1000; t++) {
        let grid = staffs.map((_, sIdx) => Array.from({length: daysInMonth}, (_, d) => {
            let val = Array.from(selects).find(s => parseInt(s.dataset.staff) === sIdx && parseInt(s.dataset.day) === d + 1).value;
            // 「希望休」「公休」「有給」が既に入っている場合はそのまま固定
            return (val !== "" && val !== "出勤") ? val : "";
        }));

        // 1. 指定された「有給日数」の不足分をランダムに配置
        grid.forEach((row, sIdx) => {
            let currentPaid = row.filter(v => v === "有給").length;
            let needed = staffs[sIdx].paidDays - currentPaid;
            let emptyIdx = row.map((v, i) => v === "" ? i : -1).filter(i => i !== -1);
            for (let i = 0; i < needed && emptyIdx.length > 0; i++) {
                let r = Math.floor(Math.random() * emptyIdx.length);
                row[emptyIdx[r]] = "有給";
                emptyIdx.splice(r, 1);
            }
        });

        // 2. 出勤配置（必要人数・4連勤・非常勤10日制限）
        let fail = false;
        for (let d = 0; d < daysInMonth; d++) {
            const dailyNeed = parseInt(needInputs[d].value) || 0;
            let currentStaffCount = grid.filter(row => row[d] === "出勤").length;

            let candidates = staffs.map((_, i) => i).filter(sIdx => {
                if (grid[sIdx][d] !== "") return false;
                let streak = 0;
                for (let i = d - 1; i >= 0 && grid[sIdx][i] === "出勤"; i--) streak++;
                if (streak >= 3) return false;
                if (staffs[sIdx].type === 'part' && grid[sIdx].filter(v => v === "出勤").length >= 10) return false;
                return true;
            }).sort(() => Math.random() - 0.5);

            for (let sIdx of candidates) {
                if (grid.filter(row => row[d] === "出勤").length >= dailyNeed) break;
                grid[sIdx][d] = "出勤";
            }
            if (grid.filter(row => row[d] === "出勤").length < dailyNeed) { fail = true; break; }
        }
        if (fail) continue;

        // 3. 常勤の休み9日調整（公休＋希望休）
        let adjFail = false;
        grid.forEach((row, sIdx) => {
            row.forEach((v, i) => { if(v==="") row[i] = "公休"; });
            if (staffs[sIdx].type !== 'full') return;
            let getOffs = () => row.filter(v => v === "公休" || v === "希望休");
            while (getOffs().length < 9) {
                let w = row.map((v, i) => v === "出勤" ? i : -1).filter(i => i !== -1);
                if (w.length === 0) { adjFail = true; break; }
                row[w[0]] = "公休";
            }
            while (getOffs().length > 9) {
                let o = row.map((v, i) => v === "公休" ? i : -1).filter(i => i !== -1);
                let target = o.find(idx => {
                    let s = 0; for(let j=idx-1; j>=0 && row[j]==="出勤"; j--) s++;
                    let ps = 0; for(let j=idx+1; j<daysInMonth && row[j]==="出勤"; j++) ps++;
                    return (s + ps) < 3;
                });
                if (target !== undefined) row[target] = "出勤"; else { adjFail = true; break; }
            }
        });
        if (!adjFail) { finalGrid = grid; break; }
    }

    if (finalGrid) {
        selects.forEach(sel => { sel.value = finalGrid[sel.dataset.staff][sel.dataset.day - 1]; });
        updateSummary();
        alert("生成完了！定休日・必要人数をすべて守りました。");
    } else {
        alert("エラー：条件が厳しすぎます。設定を見直してください。");
    }
}

function updateSummary() {
    const list = document.getElementById('summaryList');
    const selects = document.querySelectorAll('.shift-select');
    list.innerHTML = staffs.map((s, idx) => {
        const mySels = Array.from(selects).filter(sel => parseInt(sel.dataset.staff) === idx);
        const c = { "出勤":0, "公休":0, "希望休":0, "有給":0, "":0 };
        mySels.forEach(sel => { if(c.hasOwnProperty(sel.value)) c[sel.value]++; });
        return `<div class="summary-row"><strong>${s.name}</strong><br>出勤:${c["出勤"]} / 有給:${c["有給"]} / 休み:${c["公休"]+c["希望休"]}</div>`;
    }).join('');
}
