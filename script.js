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

    // 1. 各スタッフの状態と「公休ノルマ」の計算
    let staffData = staffs.map((s, idx) => {
        const mySels = Array.from(selects).filter(sel => parseInt(sel.dataset.staff) === idx);
        const hopeCount = mySels.filter(sel => sel.value === "希望休").length;
        // 事前に「公」を選んでいる場合もカウントに含める
        const preOffCount = mySels.filter(sel => sel.value === "公休").length;
        
        return {
            config: s,
            sels: mySels,
            streak: 0,
            totalWork: 0,
            remainingOff: (s.type === 'part') ? 0 : Math.max(0, 9 - hopeCount - preOffCount)
        };
    });

    // 2. 初期リセット（希望休・事前に選んだ公休以外は一旦「出勤」へ）
    staffData.forEach(s => {
        s.sels.forEach(sel => { 
            if(sel.value !== "希望休" && sel.value !== "公休") sel.value = "出勤"; 
        });
    });

    // 3. 有給をランダムに配置
    staffData.forEach(s => {
        let available = s.sels.filter(sel => sel.value === "出勤");
        for(let i=0; i < s.config.paidDays && available.length > 0; i++){
            let r = Math.floor(Math.random() * available.length);
            available[r].value = "有給";
            available.splice(r, 1);
        }
    });

    // 4. メインアルゴリズム（日ごとに処理）
    for (let d = 0; d < daysInMonth; d++) {
        const need = parseInt(needInputs[d].value);

        // A. 強制休息チェック（4連勤防止 & 非常勤上限）
        staffData.forEach(s => {
            const cur = s.sels[d];
            if (cur.value === "希望休" || cur.value === "公休") return;

            let mustRest = (s.streak >= 3); // 次で4連勤になる
            if (s.config.type === 'part' && s.totalWork >= 10) mustRest = true; // 非常勤10日上限

            if (mustRest) {
                cur.value = "公休";
                if(s.config.type === 'full') s.remainingOff--;
            }
        });

        // B. 人数調整（必要人数を超えている場合、連勤が長い順 または 公休が足りない順に休ませる）
        let workers = staffData.filter(s => s.sels[d].value === "出勤" || s.sels[d].value === "有給");
        while (workers.length > need) {
            let candidates = workers.filter(s => s.sels[d].value === "出勤");
            if (candidates.length === 0) break;

            // 優先度：1.連勤が長い人 2.公休ノルマがまだ残っている常勤
            candidates.sort((a, b) => b.streak - a.streak || b.remainingOff - a.remainingOff);
            
            let target = candidates[0];
            target.sels[d].value = "公休";
            if(target.config.type === 'full') target.remainingOff--;
            
            workers = staffData.filter(s => s.sels[d].value === "出勤" || s.sels[d].value === "有給");
        }

        // C. 当日の状態を更新
        staffData.forEach(s => {
            const val = s.sels[d].value;
            if (val === "出勤" || val === "有給") {
                s.streak++;
                s.totalWork++;
            } else {
                s.streak = 0;
            }
        });
    }

    // 5. 【追加】それでも公休が9日に満たない常勤スタッフへの最終割り当て
    staffData.forEach(s => {
        if (s.config.type === 'full' && s.remainingOff > 0) {
            // 出勤日の中からランダム（かつ連勤を分断する位置）に公休を差し込む
            let availableForOff = s.sels.map((sel, idx) => ({sel, idx}))
                                       .filter(item => item.sel.value === "出勤");
            
            // なるべく連勤が長い箇所から休ませる
            while (s.remainingOff > 0 && availableForOff.length > 0) {
                let r = Math.floor(Math.random() * availableForOff.length);
                availableForOff[r].sel.value = "公休";
                availableForOff.splice(r, 1);
                s.remainingOff--;
            }
        }
    });

    updateSummary();
    alert("「合計公休9日」と「4連勤防止」を適用して作成しました。");
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
                出勤:${c["出勤"]+c["有給"]} / 公休計:${c["公休"]+c["希望休"]} (公:${c["公休"]} 希:${c["希望休"]}) / 有給:${c["有給"]}
            </div>`;
    }).join('');
}
