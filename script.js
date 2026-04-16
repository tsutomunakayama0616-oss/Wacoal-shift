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
    const dateVal = document.getElementById('targetMonth').value;
    const parts = dateVal.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
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
                    <option value="出勤">出</option>
                    <option value="公休" selected>公</option>
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
}

// 判定：出勤扱い（出・有・希）かどうか
function isWork(sel) {
    if(!sel) return false;
    return sel.value === "出勤" || sel.value === "有給" || sel.value === "希望休";
}

function autoFillShift() {
    const dateVal = document.getElementById('targetMonth').value;
    const parts = dateVal.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const daysInMonth = new Date(year, month, 0).getDate();

    const selects = document.querySelectorAll('.shift-select');
    const needInputs = document.querySelectorAll('.need-count-input');

    let staffData = staffs.map((s, idx) => ({
        config: s,
        sels: Array.from(selects).filter(sel => parseInt(sel.dataset.staff) === idx)
    }));

    // [1] 初期化：希望休以外をすべて「公休」へ
    staffData.forEach(s => {
        s.sels.forEach(sel => { if (sel.value !== "希望休") sel.value = "公休"; });
    });

    // [2] 有給配置
    staffData.forEach(s => {
        let available = s.sels.filter(sel => sel.value === "公休");
        for(let i=0; i < s.config.paidDays && available.length > 0; i++){
            let r = Math.floor(Math.random() * available.length);
            available[r].value = "有給";
            available.splice(r, 1);
        }
    });

    // [3] メイン割り当てループ（日ごとに処理）
    for (let d = 0; d < daysInMonth; d++) {
        const need = parseInt(needInputs[d].value) || 0;
        
        // 人数が足りない間ループ
        let safetyCounter = 0;
        while (staffData.filter(s => isWork(s.sels[d])).length < need && safetyCounter < 100) {
            safetyCounter++;
            
            // 候補：現在「公休」の人
            let candidates = staffData.filter(s => s.sels[d].value === "公休");
            if (candidates.length === 0) break;

            // ソート：連勤・非常勤制限・出勤数の順で判定
            candidates.sort((a, b) => {
                // A: 4連勤回避 (前3日が仕事なら優先度を下げる)
                let aStreak = 0; for(let i=d-1; i>=0 && isWork(a.sels[i]); i--) aStreak++;
                let bStreak = 0; for(let i=d-1; i>=0 && isWork(b.sels[i]); i--) bStreak++;
                let aLimit = aStreak >= 3 ? 1 : 0;
                let bLimit = bStreak >= 3 ? 1 : 0;
                if (aLimit !== bLimit) return aLimit - bLimit;

                // B: 非常勤10日制限
                if (a.config.type !== b.config.type) {
                    if (a.config.type === 'part' && a.sels.filter(isWork).length >= 10) return 1;
                    if (b.config.type === 'part' && b.sels.filter(isWork).length >= 10) return -1;
                }

                // C: 累計出勤数が少ない順
                return a.sels.filter(isWork).length - b.sels.filter(isWork).length;
            });

            // 最優先の候補を「出勤」にする
            candidates[0].sels[d].value = "出勤";
        }
    }

    // [4] 常勤の公休9日確保（出勤が多すぎる場合のみ削る）
    staffData.forEach(s => {
        if (s.config.type === 'full') {
            while (s.sels.filter(sel => sel.value === "公休" || sel.value === "希望休").length < 9) {
                let workDays = s.sels.filter(sel => sel.value === "出勤");
                if (workDays.length === 0) break;
                // 適当に一つを公休に戻す
                workDays[0].value = "公休";
            }
        }
    });

    updateSummary();
    alert("シフトを自動生成しました。");
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
                出勤計:${c["出勤"]+c["有給"]+c["希望休"]} / 公休計:${c["公休"]+c["希望休"]}
            </div>`;
    }).join('');
}
