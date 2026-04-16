let staffs = [
    { name: "常勤1", type: "full", paidDays: 0 },
    { name: "常勤2", type: "full", paidDays: 0 },
    { name: "常勤3", type: "full", paidDays: 0 },
    { name: "常勤4", type: "full", paidDays: 0 },
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
            <div class="staff-row-top">
                <input type="text" value="${s.name}" onchange="staffs[${i}].name=this.value; generateTable();">
                <button onclick="removeStaff(${i})" style="color:red; border:none; background:none; cursor:pointer;">×</button>
            </div>
            <div class="staff-row-bottom">
                <select onchange="staffs[${i}].type=this.value">
                    <option value="full" ${s.type==='full'?'selected':''}>常勤</option>
                    <option value="part" ${s.type==='part'?'selected':''}>非常勤</option>
                </select>
                有給:<input type="number" value="${s.paidDays}" min="0" onchange="staffs[${i}].paidDays=parseInt(this.value)||0">日
            </div>
        </div>
    `).join('');
}

function addStaff() {
    staffs.push({ name: "新規", type: "full", paidDays: 0 });
    renderStaffList(); generateTable();
}

function removeStaff(index) {
    staffs.splice(index, 1);
    renderStaffList(); generateTable();
}

function generateTable() {
    const dateVal = document.getElementById('targetMonth').value;
    if(!dateVal) return;
    const [year, month] = dateVal.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    document.getElementById('dateRow').innerHTML = '<th>名前</th>' + Array.from({length: daysInMonth}, (_, i) => `<th>${i+1}</th>`).join('');
    
    let dayHtml = '<th>曜</th>';
    for (let d = 1; d <= daysInMonth; d++) {
        const dayOfWeek = new Date(year, month - 1, d).getDay();
        const className = dayOfWeek === 6 ? 'sat' : dayOfWeek === 0 ? 'sun' : '';
        dayHtml += `<th class="${className}">${["日","月","火","水","木","金","土"][dayOfWeek]}</th>`;
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
    for (let d = 1; d <= daysInMonth; d++) footHtml += `<td><input type="number" class="need-count-input" data-day="${d}" value="3"></td>`;
    document.getElementById('shiftFoot').innerHTML = `<tr>${footHtml}</tr>`;
    
    updateSummary();
}

// 連勤・回数制限をチェックする共通関数
function canAssignWork(sIdx, d, tempGrid, staffType) {
    // 【条件1】出勤4連勤の禁止（出のみカウント）
    let streak = 0;
    for (let i = d - 1; i >= 0; i--) {
        if (tempGrid[sIdx][i] === "出勤") streak++;
        else break;
    }
    if (streak >= 3) return false;

    // 後方の連勤もチェック（調整用）
    let postStreak = 0;
    for (let i = d + 1; i < tempGrid[sIdx].length; i++) {
        if (tempGrid[sIdx][i] === "出勤") postStreak++;
        else break;
    }
    if (streak + postStreak >= 3) return false;

    // 【条件2】非常勤の出勤10日制限
    if (staffType === 'part') {
        let count = tempGrid[sIdx].filter(v => v === "出勤").length;
        if (count >= 10) return false;
    }

    return true;
}

function autoFillShift() {
    const selects = document.querySelectorAll('.shift-select');
    const needInputs = document.querySelectorAll('.need-count-input');
    const dateVal = document.getElementById('targetMonth').value;
    const [year, month] = dateVal.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    // メモリ上で計算
    let grid = staffs.map((_, sIdx) => {
        return Array.from({length: daysInMonth}, (_, d) => {
            let sel = Array.from(selects).find(s => parseInt(s.dataset.staff) === sIdx && parseInt(s.dataset.day) === d + 1);
            return sel.value; // 現在の値をコピー（希望休や有給を保持）
        });
    });

    // 1. 公休・出勤を一旦クリア
    grid = grid.map(row => row.map(v => (v === "出勤" || v === "公休") ? "" : v));

    // 2. 日ごとに「出勤」を割り当て
    for (let d = 0; d < daysInMonth; d++) {
        const need = parseInt(needInputs[d].value) || 0;
        let staffIndices = staffs.map((_, i) => i).sort(() => Math.random() - 0.5);

        for (let sIdx of staffIndices) {
            if (grid.filter(row => row[d] === "出勤").length >= need) break;
            if (grid[sIdx][d] === "" && canAssignWork(sIdx, d, grid, staffs[sIdx].type)) {
                grid[sIdx][d] = "出勤";
            }
        }
    }

    // 3. 常勤の休み9日調整（ここを厳格化）
    grid.forEach((row, sIdx) => {
        if (staffs[sIdx].type !== 'full') return;
        
        // 空欄を一旦公休に
        row.forEach((v, i) => { if(v === "") row[i] = "公休"; });

        let getOffs = () => row.filter(v => v === "公休" || v === "希望休");

        // 休み不足の場合：出勤を公休に変える（これは制限に触れないので安全）
        while (getOffs().length < 9) {
            let workIdx = row.map((v, i) => v === "出勤" ? i : -1).filter(i => i !== -1);
            if (workIdx.length === 0) break;
            workIdx.sort((a, b) => {
                let sA = 0; for(let i=a; i>=0 && row[i]==="出勤"; i--) sA++;
                let sB = 0; for(let i=b; i>=0 && row[i]==="出勤"; i--) sB++;
                return sB - sA; // 連勤が長い方を優先
            });
            row[workIdx[0]] = "公休";
        }

        // 休みすぎの場合：公休を出勤に変える（ここで制限をチェック！）
        while (getOffs().length > 9) {
            let offIdx = row.map((v, i) => v === "公休" ? i : -1).filter(i => i !== -1);
            let target = offIdx.find(i => canAssignWork(sIdx, i, grid, staffs[sIdx].type));
            if (target !== undefined) row[target] = "出勤";
            else break; // 制限によりこれ以上出勤にできない
        }
    });

    // 非常勤の空欄を公休で埋める
    grid.forEach(row => row.forEach((v, i) => { if(v === "") row[i] = "公休"; }));

    // 4. 画面に反映
    selects.forEach(sel => {
        const sIdx = parseInt(sel.dataset.staff);
        const d = parseInt(sel.dataset.day) - 1;
        sel.value = grid[sIdx][d];
    });

    updateSummary();
    alert("生成が完了しました。4連勤および非常勤の回数を厳格にチェックしました。");
}

function updateSummary() {
    const list = document.getElementById('summaryList');
    const selects = document.querySelectorAll('.shift-select');
    list.innerHTML = staffs.map((s, idx) => {
        const mySels = Array.from(selects).filter(sel => parseInt(sel.dataset.staff) === idx);
        const c = { "出勤":0, "公休":0, "希望休":0, "有給":0, "":0 };
        mySels.forEach(sel => { if(c.hasOwnProperty(sel.value)) c[sel.value]++; else c[""]++; });
        return `
            <div class="summary-row" style="padding: 5px; border-bottom: 1px solid #ddd;">
                <strong>${s.name}</strong> (${s.type==='full'?'常勤':'非常勤'})<br>
                出:${c["出勤"]} | 公:${c["公休"]} | 希:${c["希望休"]} | 有:${c["有給"]} | <span style="color:blue">休み計:${c["公休"]+c["希望休"]}</span>
            </div>`;
    }).join('');
}
