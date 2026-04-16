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

    // 1. データ構造の準備
    let staffData = staffs.map((s, idx) => ({
        config: s,
        sels: Array.from(selects).filter(sel => parseInt(sel.dataset.staff) === idx),
        streak: 0,
        workDays: 0,
        offCount: 0
    }));

    // 2. 初期化：希望休以外を「出勤」にリセットし、有給を先に埋める
    staffData.forEach(s => {
        s.sels.forEach(sel => {
            if (sel.value !== "希望休") sel.value = "出勤";
        });
        // 有給のランダム配置
        let available = s.sels.filter(sel => sel.value === "出勤");
        for(let i=0; i < s.config.paidDays && available.length > 0; i++){
            let r = Math.floor(Math.random() * available.length);
            available[r].value = "有給";
            available.splice(r, 1);
        }
    });

    // 3. 日ごとのメイン処理：引き算方式
    for (let d = 0; d < daysInMonth; d++) {
        const need = parseInt(needInputs[d].value);
        
        // 当日の連勤情報を更新
        staffData.forEach(s => {
            const prevVal = d > 0 ? s.sels[d-1].value : "";
            if (prevVal === "出勤" || prevVal === "有給") {
                s.streak = s.streak; // 継続
            } else {
                s.streak = 0;
            }
        });

        // 出勤候補者（出勤・有給）
        let workers = staffData.filter(s => s.sels[d].value === "出勤" || s.sels[d].value === "有給");

        // 枠に余裕がある場合、以下の優先順位で「公休」を割り当てる
        // 1. 4連勤になる人（最優先で休ませる）
        // 2. 非常勤の10日上限に達した人
        // 3. 公休数がまだ少ない常勤（バランス調整）
        while (workers.length > need) {
            let candidates = workers.filter(s => s.sels[d].value === "出勤"); // 有給は削らない
            if (candidates.length === 0) break;

            candidates.sort((a, b) => {
                // A: 4連勤チェック（3連勤の次は優先度高）
                const aLimit = a.streak >= 3 ? 1 : 0;
                const bLimit = b.streak >= 3 ? 1 : 0;
                if (aLimit !== bLimit) return bLimit - aLimit;

                // B: 非常勤の上限
                const aPartLimit = (a.config.type === 'part' && a.workDays >= 10) ? 1 : 0;
                const bPartLimit = (b.config.type === 'part' && b.workDays >= 10) ? 1 : 0;
                if (aPartLimit !== bPartLimit) return bPartLimit - aPartLimit;

                // C: 公休が9日に達していない常勤を優先
                const aOffNeed = (a.config.type === 'full' && (a.sels.filter(sel => sel.value === "公休" || sel.value === "希望休").length < 9)) ? 1 : 0;
                const bOffNeed = (b.config.type === 'full' && (b.sels.filter(sel => sel.value === "公休" || sel.value === "希望休").length < 9)) ? 1 : 0;
                if (aOffNeed !== bOffNeed) return bOffNeed - aOffNeed;

                // D: 単純な連勤数
                return b.streak - a.streak;
            });

            // 最も休ませるべき人を公休に
            candidates[0].sels[d].value = "公休";
            workers = staffData.filter(s => s.sels[d].value === "出勤" || s.sels[d].value === "有給");
        }

        // 確定後の連勤数・出勤数カウント更新
        staffData.forEach(s => {
            const val = s.sels[d].value;
            if (val === "出勤" || val === "有給") {
                s.streak++;
                s.workDays++;
            } else {
                s.streak = 0;
                s.offCount++;
            }
        });
    }

    // 4. 最終調整：公休9日の死守（必要人数を維持しつつ、出勤日を公休へ）
    staffData.forEach(s => {
        let totalOff = s.sels.filter(sel => sel.value === "公休" || sel.value === "希望休").length;
        if (s.config.type === 'full' && totalOff < 9) {
            let diff = 9 - totalOff;
            let workDays = s.sels.map((sel, idx) => ({sel, idx})).filter(item => item.sel.value === "出勤");
            
            // 4連勤が発生している箇所を優先的に探して削る
            workDays.sort((a, b) => {
                // その日の前後を見て連勤が長い順
                return getStreakAt(s.sels, b.idx) - getStreakAt(s.sels, a.idx);
            });

            for(let i=0; i<diff && i<workDays.length; i++) {
                workDays[i].sel.value = "公休";
            }
        }
    });

    updateSummary();
    alert("出勤人数を最優先し、4連勤禁止と公休数を適用しました。");
}

// 特定位置の連勤数を計算する補助関数
function getStreakAt(sels, idx) {
    let s = 0;
    for(let i=idx; i>=0; i--) {
        if(sels[i].value === "出勤" || sels[i].value === "有給") s++;
        else break;
    }
    return s;
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
