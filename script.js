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
    const daysInMonth = new Date(...document.getElementById('targetMonth').value.split('-').map(Number)).getDate();

    let staffData = staffs.map((s, idx) => ({
        config: s,
        sels: Array.from(selects).filter(sel => parseInt(sel.dataset.staff) === idx),
        offTarget: 9
    }));

    // [1] 全リセット（希望休以外を「公休」へ）
    staffData.forEach(s => {
        s.sels.forEach(sel => { if(sel.value !== "希望休") sel.value = "公休"; });
    });

    // [2] 有給を配置
    staffData.forEach(s => {
        let available = s.sels.filter(sel => sel.value === "公休");
        for(let i=0; i < s.config.paidDays && available.length > 0; i++){
            let r = Math.floor(Math.random() * available.length);
            available[r].value = "有給";
            available.splice(r, 1);
        }
    });

    // [3] 日ごとに「必要人数」を埋める（足し算方式）
    for (let d = 0; d < daysInMonth; d++) {
        const need = parseInt(needInputs[d].value);
        let currentWorkers = staffData.filter(s => ["出勤", "有給", "希望休"].includes(s.sels[d].value));
        
        while (currentWorkers.length < need) {
            let candidates = staffData.filter(s => s.sels[d].value === "公休");
            if (candidates.length === 0) break;

            // 出勤させる優先順位
            candidates.sort((a, b) => {
                // A: 3連勤中（今日出ると4連勤になる）人を後回しにする
                const aStreak = getStreakBefore(a.sels, d);
                const bStreak = getStreakBefore(b.sels, d);
                const aLimit = aStreak >= 3 ? 1 : 0;
                const bLimit = bStreak >= 3 ? 1 : 0;
                if (aLimit !== bLimit) return aLimit - bLimit;

                // B: 非常勤の上限（10日）を考慮
                const aWorkCount = getWorkCountSoFar(a.sels, d);
                const bWorkCount = getWorkCountSoFar(b.sels, d);
                const aPartFull = (a.config.type === 'part' && aWorkCount >= 10) ? 1 : 0;
                const bPartFull = (b.config.type === 'part' && bWorkCount >= 10) ? 1 : 0;
                if (aPartFull !== bPartFull) return aPartFull - bPartFull;

                // C: 出勤数が少ない人を優先
                return aWorkCount - bWorkCount;
            });

            candidates[0].sels[d].value = "出勤";
            currentWorkers = staffData.filter(s => ["出勤", "有給", "希望休"].includes(s.sels[d].value));
        }
    }

    // [4] 強制4連勤修正（どうしても4連勤が発生した場合のスワップ）
    for (let d = 3; d < daysInMonth; d++) {
        staffData.forEach(s => {
            if (getStreakBefore(s.sels, d + 1) >= 4 && s.sels[d].value === "出勤") {
                // 今日(d)を公休にして、代わりに「今日休みで連勤にならない人」を探す
                let substitute = staffData.find(other => 
                    other.sels[d].value === "公休" && 
                    getStreakBefore(other.sels, d) < 3 && 
                    getStreakAfter(other.sels, d, daysInMonth) < 3 &&
                    !(other.config.type === 'part' && getWorkCountTotal(other.sels) >= 10)
                );
                if (substitute) {
                    s.sels[d].value = "公休";
                    substitute.sels[d].value = "出勤";
                }
            }
        });
    }

    // [5] 常勤の公休9日確保（不足分を削る）
    staffData.forEach(s => {
        if (s.config.type === 'full') {
            let currentOffs = s.sels.filter(sel => sel.value === "公休" || sel.value === "希望休").length;
            while (currentOffs < 9) {
                // 最も連勤が長い箇所の「出勤」を「公休」に変える
                let workDays = s.sels.map((sel, idx) => ({sel, idx})).filter(item => item.sel.value === "出勤");
                if (workDays.length === 0) break;
                workDays.sort((a, b) => getStreakBefore(s.sels, b.idx + 1) - getStreakBefore(s.sels, a.idx + 1));
                workDays[0].sel.value = "公休";
                currentOffCount = s.sels.filter(sel => sel.value === "公休" || sel.value === "希望休").length;
                currentOffs++;
            }
        }
    });

    updateSummary();
    alert("【修正完了】必要人数を維持し、4連勤禁止・非常勤10日を適用しました。");
}

function getStreakBefore(sels, d) {
    let streak = 0;
    for (let i = d - 1; i >= 0; i--) {
        if (["出勤", "有給", "希望休"].includes(sels[i].value)) streak++;
        else break;
    }
    return streak;
}

function getStreakAfter(sels, d, daysInMonth) {
    let streak = 0;
    for (let i = d + 1; i < daysInMonth; i++) {
        if (["出勤", "有給", "希望休"].includes(sels[i].value)) streak++;
        else break;
    }
    return streak;
}

function getWorkCountSoFar(sels, d) {
    return sels.slice(0, d).filter(sel => ["出勤", "有給", "希望休"].includes(sel.value)).length;
}

function getWorkCountTotal(sels) {
    return sels.filter(sel => ["出勤", "有給", "希望休"].includes(sel.value)).length;
}

function updateSummary() {
    const list = document.getElementById('summaryList');
    const selects = document.querySelectorAll('.shift-select');
    list.innerHTML = staffs.map((s, idx) => {
        const mySels = Array.from(selects).filter(sel => parseInt(sel.dataset.staff) === idx);
        const c = { "出勤":0, "公休":0, "希望休":0, "有給":0 };
        mySels.forEach(sel => c[sel.value]++);
        const workTotal = c["出勤"] + c["有給"] + c["希望休"];
        const offTotal = c["公休"] + c["希望休"];
        return `
            <div class="summary-row">
                <span class="summary-name">${s.name} (${s.type==='full'?'常勤':'非常勤'})</span>
                出勤計:${workTotal} / 公休計:${offTotal} (公:${c["公休"]} 希:${c["希望休"]}) / 有給:${c["有給"]}
            </div>`;
    }).join('');
}
