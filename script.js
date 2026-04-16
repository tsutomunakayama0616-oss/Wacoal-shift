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
            <input type="text" value="${s.name}" onchange="staffs[${i}].name=this.value; generateTable();">
            <select onchange="staffs[${i}].type=this.value">
                <option value="full" ${s.type==='full'?'selected':''}>常勤</option>
                <option value="part" ${s.type==='part'?'selected':''}>非常勤</option>
            </select>
            <button onclick="removeStaff(${i})" style="color:red; background:none; border:none; cursor:pointer; font-weight:bold;">×</button>
        </div>
    `).join('');
}

function addStaff() {
    staffs.push({ name: "新スタッフ", type: "full", paidDays: 0 });
    renderStaffList();
    generateTable();
}

function removeStaff(index) {
    staffs.splice(index, 1);
    renderStaffList();
    generateTable();
}

function generateTable() {
    const [year, month] = document.getElementById('targetMonth').value.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const dateRow = document.getElementById('dateRow');
    const dayRow = document.getElementById('dayRow');
    const shiftBody = document.getElementById('shiftBody');
    const shiftFoot = document.getElementById('shiftFoot');

    dateRow.innerHTML = '<th>名前</th>' + Array.from({length: daysInMonth}, (_, i) => `<th>${i+1}</th>`).join('');
    
    let dayHtml = '<th>曜日</th>';
    for (let d = 1; d <= daysInMonth; d++) {
        const dayOfWeek = new Date(year, month - 1, d).getDay();
        const className = dayOfWeek === 6 ? 'sat' : dayOfWeek === 0 ? 'sun' : '';
        dayHtml += `<th class="${className}">${["日","月","火","水","木","金","土"][dayOfWeek]}</th>`;
    }
    dayRow.innerHTML = dayHtml;

    shiftBody.innerHTML = staffs.map((staff, sIdx) => {
        let cells = `<td>${staff.name}</td>`;
        for (let d = 1; d <= daysInMonth; d++) {
            const dayOfWeek = new Date(year, month - 1, d).getDay();
            const className = dayOfWeek === 6 ? 'sat' : dayOfWeek === 0 ? 'sun' : '';
            cells += `<td class="${className}">
                <select class="shift-select" data-staff="${sIdx}" data-day="${d}">
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
    shiftFoot.innerHTML = `<tr>${footHtml}</tr>`;
}

function autoFillShift() {
    const selects = document.querySelectorAll('.shift-select');
    const needInputs = document.querySelectorAll('.need-count-input');
    const [year, month] = document.getElementById('targetMonth').value.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    let staffState = staffs.map((s, idx) => ({
        info: s,
        selects: Array.from(selects).filter(sel => parseInt(sel.dataset.staff) === idx),
        offCount: 0,
        workCount: 0,
        streak: 0
    }));

    // メインロジック：日ごとに判定
    for (let d = 0; d < daysInMonth; d++) {
        const need = parseInt(needInputs[d].value);

        // 1. 強制制約チェック (4連勤防止 & 非常勤上限)
        staffState.forEach(state => {
            const current = state.selects[d];
            if (current.value === "公休" || current.value === "希望休") {
                state.streak = 0;
                return;
            }

            // 【重要】3連勤後の4日目は強制的に休み
            let mustRest = false;
            if (state.streak >= 3) mustRest = true;
            if (state.info.type === 'part' && state.workCount >= 10) mustRest = true;

            if (mustRest && current.value === "出勤") {
                current.value = "公休";
                state.streak = 0;
            }
        });

        // 2. 出勤人数が過剰な場合に休ませる
        let workers = staffState.filter(s => s.selects[d].value === "出勤" || s.selects[d].value === "有給");
        while (workers.length > need) {
            let candidates = workers.filter(s => s.selects[d].value === "出勤");
            if (candidates.length === 0) break;

            // 連勤が長い順 > 常勤優先 の順で休ませる
            candidates.sort((a, b) => b.streak - a.streak || (b.info.type === 'full' ? 1 : -1));
            
            let target = candidates[0];
            target.selects[d].value = "公休";
            workers = staffState.filter(s => s.selects[d].value === "出勤" || s.selects[d].value === "有給");
        }

        // 3. 連勤状態の更新
        staffState.forEach(state => {
            const val = state.selects[d].value;
            if (val === "出勤" || val === "有給") {
                state.streak++;
                state.workCount++;
            } else {
                state.streak = 0;
                state.offCount++;
            }
        });
    }

    updateSummary();
    alert("シフトの自動作成が完了しました。左側の集計欄をご確認ください。");
}

function updateSummary() {
    const summaryList = document.getElementById('summaryList');
    const selects = document.querySelectorAll('.shift-select');
    
    summaryList.innerHTML = staffs.map((s, idx) => {
        const mySelects = Array.from(selects).filter(sel => parseInt(sel.dataset.staff) === idx);
        const counts = { "出勤": 0, "公休": 0, "希望休": 0, "有給": 0 };
        mySelects.forEach(sel => counts[sel.value]++);
        
        return `
            <div class="summary-row">
                <div class="summary-name">${s.name} (${s.type==='full'?'常勤':'非常勤'})</div>
                <div>出勤計: ${counts["出勤"]+counts["有給"]}日</div>
                <div>公休: ${counts["公休"]}日</div>
                <div>希望休: ${counts["希望休"]}日</div>
                <div>有給: ${counts["有給"]}日</div>
            </div>
        `;
    }).join('');
}
