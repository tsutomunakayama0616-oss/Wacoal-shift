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

// 補助関数：あるスタッフが「仕事（出勤・有給・希）」をしているか判定
function isWorking(sel) {
    return sel && (sel.value === "出勤" || sel.value === "有給" || sel.value === "希望休");
}

function autoFillShift() {
    const selects = document.querySelectorAll('.shift-select');
    const needInputs = document.querySelectorAll('.need-count-input');
    const daysInMonth = new Date(...document.getElementById('targetMonth').value.split('-').map(Number)).getDate();

    let staffData = staffs.map((s, idx) => ({
        config: s,
        sels: Array.from(selects).filter(sel => parseInt(sel.dataset.staff) === idx)
    }));

    // [1] 強制初期化：希望休以外をすべて「公休」へ
    staffData.forEach(s => {
        s.sels.forEach(sel => {
            if (sel.value !== "希望休") sel.value = "公休";
        });
    });

    // [2] 有給のランダム配置
    staffData.forEach(s => {
        let available = s.sels.filter(sel => sel.value === "公休");
        for(let i=0; i < s.config.paidDays && available.length > 0; i++){
            let r = Math.floor(Math.random() * available.length);
            available[r].value = "有給";
            available.splice(r, 1);
        }
    });

    // [3] メインロジック：日ごとに「必要人数」に達するまで「出勤」を割り当てる
    for (let d = 0; d < daysInMonth; d++) {
        const need = parseInt(needInputs[d].value);
        
        // その日の現在の出勤者数をカウント
        let currentWorkers = staffData.filter(s => isWorking(s.sels[d]));

        // 足りない分を出勤させる
        while (currentWorkers.length < need) {
            // 候補者：今「公休」で、今日出勤しても4連勤にならない人
            let candidates = staffData.filter(s => {
                if (s.sels[d].value !== "公休") return false;
                
                // 直近3日間の連勤をチェック
                let streak = 0;
                for (let i = d - 1; i >= 0; i--) {
                    if (isWorking(s.sels[i])) streak++;
                    else break;
                }
                if (streak >= 3) return false; // 4連勤禁止

                // 非常勤10日上限
                if (s.config.type === 'part') {
                    let totalWork = s.sels.filter(sel => isWorking(sel)).length;
                    if (totalWork >= 10) return false;
                }
                return true;
            });

            // 候補がゼロなら、やむを得ず「公休」の人から選ぶ（連勤制限を一時的に無視して人数を優先）
            if (candidates.length === 0) {
                candidates = staffData.filter(s => s.sels[d].value === "公休");
            }

            if (candidates.length === 0) break; // 全員出勤でも足りない場合

            // 出勤数が少ない人を優先して出勤に
            candidates.sort((a, b) => {
                let aCount = a.sels.filter(sel => isWorking(sel)).length;
                let bCount = b.sels.filter(sel => isWorking(sel)).length;
                return aCount - bCount;
            });

            candidates[0].sels[d].value = "出勤";
            currentWorkers = staffData.filter(s => isWorking(s.sels[d]));
        }
    }

    // [4] 常勤の公休9日死守
    staffData.forEach(s => {
        if (s.config.type === 'full') {
            let getOffs = () => s.sels.filter(sel => sel.value === "公休" || sel.value === "希望休").length;
            while (getOffs() < 9) {
                let workSels = s.sels.map((sel, idx) => ({sel, idx})).filter(item => item.sel.value === "出勤");
                if (workSels.length === 0) break;
                // 連勤が長い箇所を優先的に休みへ
                workSels.sort((a, b) => {
                    let getS = (idx) => {
                        let st = 0;
                        for(let i=idx; i>=0; i--) if(isWorking(s.sels[i])) st++; else break;
                        return st;
                    };
                    return getS(b.idx) - getS(a.idx);
                });
                workSels[0].sel.value = "公休";
            }
        }
    });

    updateSummary();
    alert("修正完了：必要人数優先、4連勤禁止(3連勤まで)、非常勤10日制限を適用しました。");
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
                出勤計:${c["出勤"]+c["有給"]+c["希望休"]} / 公休計:${c["公休"]+c["希望休"]} / 有給:${c["有給"]}
            </div>`;
    }).join('');
}
