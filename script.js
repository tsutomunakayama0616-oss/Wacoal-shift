let staffs = [
    { name: "常勤1", type: "full", paidDays: 0 },
    { name: "常勤2", type: "full", paidDays: 0 },
    { name: "常勤3", type: "full", paidDays: 0 },
    { name: "常勤4", type: "full", paidDays: 0 },
    { name: "非常勤1", type: "part", paidDays: 0 }
];

window.onload = () => {
    const now = new Date();
    document.getElementById('targetMonth').value =
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    renderStaffList();
    generateTable();
};

function renderStaffList() {
    const list = document.getElementById('staffList');
    list.innerHTML = staffs.map((s, i) => `
        <div class="staff-item">
            <div class="staff-row-top">
                <input type="text" value="${s.name}" onchange="staffs[${i}].name=this.value; generateTable();">
                <button onclick="removeStaff(${i})" style="color:red; border:none; background:none; cursor:pointer;">×</button>
            </div>
            <div class="staff-row-bottom">
                <select onchange="staffs[${i}].type=this.value">
                    <option value="full" ${s.type==='full'?'selected':''}>常勤</option>
                    <option value="part" ${s.type==='part'?'selected':''}>非常勤</option>
                </select>
                有給:<input type="number" value="${s.paidDays}" min="0"
                onchange="staffs[${i}].paidDays=parseInt(this.value)||0">日
            </div>
        </div>
    `).join('');
}

function addStaff() {
    staffs.push({ name: "新規", type: "full", paidDays: 0 });
    renderStaffList();
    generateTable();
}

function removeStaff(index) {
    staffs.splice(index, 1);
    renderStaffList();
    generateTable();
}

function generateTable() {
    const dateVal = document.getElementById('targetMonth').value;
    if (!dateVal) return;

    const [year, month] = dateVal.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    document.getElementById('dateRow').innerHTML =
        '<th>名前</th>' +
        Array.from({ length: daysInMonth }, (_, i) => `<th>${i + 1}</th>`).join('');

    let dayHtml = '<th>曜</th>';
    for (let d = 1; d <= daysInMonth; d++) {
        const dow = new Date(year, month - 1, d).getDay();
        const className = dow === 6 ? 'sat' : dow === 0 ? 'sun' : '';
        dayHtml += `<th class="${className}">${["日","月","火","水","木","金","土"][dow]}</th>`;
    }
    document.getElementById('dayRow').innerHTML = dayHtml;

    document.getElementById('shiftBody').innerHTML = staffs.map((staff, sIdx) => {
        let cells = `<td>${staff.name}</td>`;
        for (let d = 1; d <= daysInMonth; d++) {
            cells += `<td>
                <select class="shift-select" data-staff="${sIdx}" data-day="${d}">
                    <option value="" selected>-</option>
                    <option value="出勤">出</option>
                    <option value="公休">公</option>
                    <option value="希望休">希</option>
                    <option value="有給">有</option>
                </select>
            </td>`;
        }
        return `<tr>${cells}</tr>`;
    }).join('');

    let footHtml = '<td>必要人数</td>';
    for (let d = 1; d <= daysInMonth; d++) {
        footHtml += `<td><input type="number" class="need-count-input" data-day="${d}" value="3"></td>`;
    }
    document.getElementById('shiftFoot').innerHTML = `<tr>${footHtml}</tr>`;

    updateSummary();
}

function autoFillShift() {
    const selects = document.querySelectorAll('.shift-select');
    const needInputs = document.querySelectorAll('.need-count-input');
    const [year, month] = document.getElementById('targetMonth').value.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    let bestGrid = null;

    for (let t = 0; t < 1000; t++) {

        // 希望休は固定
        let grid = staffs.map((_, sIdx) => {
            return Array.from({ length: daysInMonth }, (_, d) => {
                let sel = Array.from(selects).find(s =>
                    parseInt(s.dataset.staff) === sIdx &&
                    parseInt(s.dataset.day) === d + 1
                );
                return (sel.value === "希望休") ? "希望休" : "";
            });
        });

        // 有給ランダム
        staffs.forEach((staff, sIdx) => {
            let empty = grid[sIdx]
                .map((v, i) => v === "" ? i : -1)
                .filter(i => i !== -1)
                .sort(() => Math.random() - 0.5);

            for (let i = 0; i < staff.paidDays && i < empty.length; i++) {
                grid[sIdx][empty[i]] = "有給";
            }
        });

        // 日曜抽出
        let sundays = [];
        for (let d = 0; d < daysInMonth; d++) {
            if (new Date(year, month - 1, d + 1).getDay() === 0) sundays.push(d);
        }

        let sundayCount = staffs.map(() => 0);

        let fail = false;

        for (let d = 0; d < daysInMonth; d++) {
            const need = parseInt(needInputs[d].value) || 0;
            const isSunday = sundays.includes(d);

            let assigned = 0;

            let candidates = staffs.map((_, i) => i).filter(sIdx => {

                if (grid[sIdx][d] !== "") return false;

                if (staffs[sIdx].type === 'part') {
                    if (grid[sIdx].filter(v => v === "出勤").length >= 10) return false;
                }

                let streak = 0;
                for (let i = d - 1; i >= 0; i--) {
                    if (grid[sIdx][i] === "出勤") streak++;
                    else if (grid[sIdx][i] === "有給") break;
                    else break;
                }
                if (streak >= 3) return false;

                return true;
            });

            candidates.sort((a, b) => {
                if (isSunday) {
                    return sundayCount[a] - sundayCount[b];
                } else {
                    const wa = grid[a].filter(v => v === "出勤").length;
                    const wb = grid[b].filter(v => v === "出勤").length;
                    return wa - wb;
                }
            });

            candidates = candidates.sort(() => Math.random() - 0.5);

            for (let sIdx of candidates) {
                if (assigned >= need) break;

                grid[sIdx][d] = "出勤";
                assigned++;

                if (isSunday) sundayCount[sIdx]++;
            }

            if (assigned < need) {
                fail = true;
                break;
            }
        }

        if (fail) continue;

        // 残り公休
        grid.forEach(row => {
            row.forEach((v, i) => {
                if (v === "") row[i] = "公休";
            });
        });

        // 最終チェック
        let valid = true;
        for (let d = 0; d < daysInMonth; d++) {
            const need = parseInt(needInputs[d].value) || 0;
            const actual = grid.filter(r => r[d] === "出勤").length;
            if (actual < need) {
                valid = false;
                break;
            }
        }

        if (!valid) continue;

        bestGrid = grid;
        break;
    }

    if (bestGrid) {
        document.querySelectorAll('.shift-select').forEach(sel => {
            const sIdx = parseInt(sel.dataset.staff);
            const d = parseInt(sel.dataset.day) - 1;
            sel.value = bestGrid[sIdx][d];
        });
        updateSummary();
        alert("生成成功（希望休最優先＋日曜公平）");
    } else {
        alert("条件が厳しすぎます");
    }
}

function updateSummary() {
    const list = document.getElementById('summaryList');
    const selects = document.querySelectorAll('.shift-select');

    list.innerHTML = staffs.map((s, idx) => {
        const my = Array.from(selects).filter(sel => parseInt(sel.dataset.staff) === idx);

        const c = { "出勤":0, "公休":0, "希望休":0, "有給":0, "":0 };
        my.forEach(sel => {
            if (c.hasOwnProperty(sel.value)) c[sel.value]++;
            else c[""]++;
        });

        return `
        <div style="padding:5px;border-bottom:1px solid #ddd;">
            <strong>${s.name}</strong> (${s.type==='full'?'常勤':'非常勤'})<br>
            出:${c["出勤"]} 公:${c["公休"]} 希:${c["希望休"]} 有:${c["有給"]}
        </div>`;
    }).join('');
}
