let staffs = [
    { name: "常勤1", paidDays: 0 },
    { name: "常勤2", paidDays: 0 },
    { name: "常勤3", paidDays: 0 },
    { name: "常勤4", paidDays: 0 },
    { name: "非常勤1", paidDays: 0 }
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
            有給:<input type="number" class="paid-input" value="${s.paidDays}" min="0" onchange="staffs[${i}].paidDays=parseInt(this.value)">日
            <button class="remove-btn" onclick="removeStaff(${i})">削除</button>
        </div>
    `).join('');
}

function addStaff() {
    staffs.push({ name: "新スタッフ", paidDays: 0 });
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
        const dayLabels = ["日", "月", "火", "水", "木", "金", "土"];
        const className = dayOfWeek === 6 ? 'sat' : dayOfWeek === 0 ? 'sun' : '';
        dayHtml += `<th class="${className}">${dayLabels[dayOfWeek]}</th>`;
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

    // 必要人数の入力行
    let footHtml = '<td>必要人数</td>';
    for (let d = 1; d <= daysInMonth; d++) {
        footHtml += `<td><input type="number" class="need-count-input" data-day="${d}" value="3" min="0" max="${staffs.length}"></td>`;
    }
    shiftFoot.innerHTML = `<tr>${footHtml}</tr>`;
}

function autoFillShift() {
    const selects = document.querySelectorAll('.shift-select');
    const needInputs = document.querySelectorAll('.need-count-input');
    const [year, month] = document.getElementById('targetMonth').value.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    // 1. 下準備：各自の公休残数と現在の連勤状態を管理
    let staffData = staffs.map((s, idx) => {
        const staffSelects = Array.from(selects).filter(sel => parseInt(sel.dataset.staff) === idx);
        // 希望休(希)と、事前に手動設定された公休(公)をカウント
        const preOffCount = staffSelects.filter(sel => sel.value === "希望休" || sel.value === "公休").length;
        return {
            selects: staffSelects,
            remainingOff: Math.max(0, 9 - preOffCount),
            remainingPaid: s.paidDays,
            workStreak: 0
        };
    });

    // 2. 有給の自動配置（希望休・公休以外にランダムに配置）
    staffData.forEach(data => {
        let availableForPaid = data.selects.filter(sel => sel.value === "出勤");
        for(let i=0; i < data.remainingPaid && availableForPaid.length > 0; i++){
            let randIdx = Math.floor(Math.random() * availableForPaid.length);
            availableForPaid[randIdx].value = "有給";
            availableForPaid.splice(randIdx, 1);
        }
    });

    // 3. メインロジック：日ごとに「休ませる人」を決める
    for (let d = 1; d <= daysInMonth; d++) {
        const dIdx = d - 1;
        const needCount = parseInt(needInputs[dIdx].value);
        
        // すでに休み（希・公）の人をカウント
        let currentOff = staffData.filter(data => data.selects[dIdx].value === "希望休" || data.selects[dIdx].value === "公休").length;
        let currentWorkers = staffs.length - currentOff;

        // もし出勤予定人数が必要人数より多ければ、誰かを公休にする
        // かつ、4連勤防止や公休残数がある人を優先
        while (currentWorkers > needCount) {
            // 公休にできる候補者を探す（既に出勤/有給の人の中から）
            let candidates = staffData.filter(data => 
                (data.selects[dIdx].value === "出勤" || data.selects[dIdx].value === "有給") && data.remainingOff > 0
            );

            if (candidates.length === 0) break;

            // 優先順位：1.連勤が長い人 2.公休残が多い人
            candidates.sort((a, b) => {
                if (b.workStreak !== a.workStreak) return b.workStreak - a.workStreak;
                return b.remainingOff - a.remainingOff;
            });

            const target = candidates[0];
            target.selects[dIdx].value = "公休";
            target.remainingOff--;
            currentWorkers--;
        }

        // その日の連勤数を更新
        staffData.forEach(data => {
            const val = data.selects[dIdx].value;
            if (val === "出勤" || val === "有給") {
                data.workStreak++;
            } else {
                data.workStreak = 0;
            }
        });
    }

    // 4. まだ公休が余っている場合、4連勤を超えないように最終調整
    staffData.forEach(data => {
        if (data.remainingOff > 0) {
            let streak = 0;
            data.selects.forEach(sel => {
                if (sel.value === "出勤" || sel.value === "有給") {
                    streak++;
                    if (streak >= 4 && data.remainingOff > 0 && sel.value === "出勤") {
                        sel.value = "公休";
                        data.remainingOff--;
                        streak = 0;
                    }
                } else {
                    streak = 0;
                }
            });
        }
    });

    alert("必要人数と連勤条件を考慮してシフトを作成しました。");
}
