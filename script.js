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
                有給:<input type="number" value="${s.paidDays}" min="0" onchange="staffs[${i}].paidDays=parseInt(this.value)">日
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
    const [year, month] = document.getElementById('targetMonth').value.split('-').map(Number);
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
            const dayOfWeek = new Date(year, month - 1, d).getDay();
            const className = dayOfWeek === 6 ? 'sat' : dayOfWeek === 0 ? 'sun' : '';
            cells += `<td class="${className}">
                <select class="shift-select" data-staff="${sIdx}" data-day="${d}">
                    <option value="出勤">出</option><option value="公休">公</option>
                    <option value="希望休">希</option><option value="有給">有</option>
                </select>
            </td>`;
        }
        return `<tr>${cells}</tr>`;
    }).join('');

    let footHtml = '<td>必要人数</td>';
    for (let d = 1; d <= daysInMonth; d++) footHtml += `<td><input type="number" class="need-count-input" data-day="${d}" value="3"></td>`;
    document.getElementById('shiftFoot').innerHTML = `<tr>${footHtml}</tr>`;
}

function autoFillShift() {
    const selects = document.querySelectorAll('.shift-select');
    const needInputs = document.querySelectorAll('.need-count-input');
    const daysInMonth = new Date(...document.getElementById('targetMonth').value.split('-')).getDate();

    // 1. 各スタッフの状態初期化
    let staffData = staffs.map((s, idx) => {
        const mySels = Array.from(selects).filter(sel => parseInt(sel.dataset.staff) === idx);
        
        // 希望休(希)と事前入力された(公)を一旦カウント
        const preHopeCount = mySels.filter(sel => sel.value === "希望休").length;
        const preOffCount = mySels.filter(sel => sel.value === "公休").length;

        return {
            config: s,
            sels: mySels,
            streak: 0,
            workDays: 0,
            offTarget: 9, // 常勤の目標
            currentOff: preHopeCount + preOffCount // 希＋公の合計
        };
    });

    // 2. リセット（希望休と事前入力公休以外は「出勤」）
    staffData.forEach(s => {
        s.sels.forEach(sel => {
            if(sel.value !== "希望休" && sel.value !== "公休") sel.value = "出勤";
        });
    });

    // 3. 有給配置
    staffData.forEach(s => {
        let available = s.sels.filter(sel => sel.value === "出勤");
        for(let i=0; i < s.config.paidDays && available.length > 0; i++){
            let r = Math.floor(Math.random() * available.length);
            available[r].value = "有給";
            available.splice(r, 1);
        }
    });

    // 4. メインループ（日ごとの判定）
    for (let d = 0; d < daysInMonth; d++) {
        const need = parseInt(needInputs[d].value);

        // A. 個人の絶対制約チェック
        staffData.forEach(s => {
            const cur = s.sels[d];
            if (cur.value === "希望休" || cur.value === "公休") return;

            // 制約1: 4連勤防止
            const isStreakLimit = (s.streak >= 3);
            // 制約2: 非常勤10日上限
            const isPartLimit = (s.config.type === 'part' && s.workDays >= 10);

            if (isStreakLimit || isPartLimit) {
                cur.value = "公休";
                s.currentOff++;
            }
        });

        // B. 必要人数による調整（出勤者が多すぎる場合、公休が足りない人を優先して休ませる）
        let workers = staffData.filter(s => s.sels[d].value === "出勤" || s.sels[d].value === "有給");
        while (workers.length > need) {
            let candidates = workers.filter(s => s.sels[d].value === "出勤");
            if (candidates.length === 0) break;

            // 優先順位: 1.連勤が長い 2.公休がまだ目標(9日)に達していない常勤
            candidates.sort((a, b) => {
                const aNeedOff = (a.config.type === 'full' && a.currentOff < a.offTarget);
                const bNeedOff = (b.config.type === 'full' && b.currentOff < b.offTarget);
                if (bNeedOff !== aNeedOff) return bNeedOff ? 1 : -1;
                return b.streak - a.streak;
            });

            const target = candidates[0];
            target.sels[d].value = "公休";
            target.currentOff++;
            workers = staffData.filter(s => s.sels[d].value === "出勤" || s.sels[d].value === "有給");
        }

        // C. カウント更新
        staffData.forEach(s => {
            const val = s.sels[d].value;
            if (val === "出勤" || val === "有給") {
                s.streak++;
                s.workDays++;
            } else {
                s.streak = 0;
            }
        });
    }

    // 5. 常勤の公休9日ノルマ最終調整（足りない場合、出勤日から削る）
    staffData.forEach(s => {
        if (s.config.type === 'full') {
            let availableForOff = s.sels.map((sel, idx) => ({sel, idx}))
                                       .filter(item => item.sel.value === "出勤");
            
            while (s.currentOff < s.offTarget && availableForOff.length > 0) {
                // 連勤を崩しやすいようにランダムに選ぶ
                let r = Math.floor(Math.random() * availableForOff.length);
                availableForOff[r].sel.value = "公休";
                availableForOff.splice(r, 1);
                s.currentOff++;
            }
        } else if (s.config.type === 'part') {
            // 非常勤で10日を超えてしまっている場合の最終調整（基本はループ内で止まるが念のため）
            let works = s.sels.filter(sel => sel.value === "出勤");
            let total = s.sels.filter(sel => sel.value === "出勤" || sel.value === "有給").length;
            while (total > 10 && works.length > 0) {
                works[0].value = "公休";
                works.shift();
                total--;
            }
        }
    });

    updateSummary();
    alert("「公休9日(希望含む)」「4連勤防止」「非常勤上限10日」を徹底して作成しました。");
}

function updateSummary() {
    const list = document.getElementById('summaryList');
    const selects = document.querySelectorAll('.shift-select');
    list.innerHTML = staffs.map((s, idx) => {
        const mySels = Array.from(selects).filter(sel => parseInt(sel.dataset.staff) === idx);
        const c = { "出勤":0, "公休":0, "希望休":0, "有給":0 };
        mySels.forEach(sel => c[sel.value]++);
        return `
            <div class="summary-row">
                <span class="summary-name">${s.name} (${s.type==='full'?'常勤':'非常勤'})</span>
                出勤:${c["出勤"]+c["有給"]} / 公休計:${c["公休"]+c["希望休"]} / 有給:${c["有給"]}
            </div>`;
    }).join('');
}
