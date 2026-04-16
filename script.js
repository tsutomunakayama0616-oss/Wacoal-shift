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
            // value="" を selected にし、それ以外から selected を外しました
            cells += `<td class="${className}">
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
    
    // テーブル生成直後に集計をリセット表示
    updateSummary();
}

function isWorking(val) {
    return val === "出勤" || val === "有給" || val === "希望休";
}

function autoFillShift() {
    const dateVal = document.getElementById('targetMonth').value;
    const parts = dateVal.split('-');
    const daysInMonth = new Date(parseInt(parts[0]), parseInt(parts[1]), 0).getDate();

    const selects = document.querySelectorAll('.shift-select');
    const needInputs = document.querySelectorAll('.need-count-input');

    let staffData = staffs.map((s, idx) => ({
        config: s,
        sels: Array.from(selects).filter(sel => parseInt(sel.dataset.staff) === idx)
    }));

    // [1] 有給のランダム配置（まだ何も入力されていない空欄のみ）
    staffData.forEach(s => {
        let available = s.sels.filter(sel => sel.value === "");
        for(let i=0; i < s.config.paidDays && available.length > 0; i++){
            let r = Math.floor(Math.random() * available.length);
            available[r].value = "有給";
            available.splice(r, 1);
        }
    });

    // [2] メイン割り当て：日ごとに必要人数を埋める
    for (let d = 0; d < daysInMonth; d++) {
        const need = parseInt(needInputs[d].value) || 0;
        
        let safety = 0;
        while (staffData.filter(s => isWorking(s.sels[d].value)).length < need && safety < 100) {
            safety++;
            let candidates = staffData.filter(s => s.sels[d].value === "");
            if (candidates.length === 0) break;

            candidates.sort((a, b) => {
                // 4連勤回避
                let aStrk = 0; for(let i=d-1; i>=0 && isWorking(a.sels[i].value); i--) aStrk++;
                let bStrk = 0; for(let i=d-1; i>=0 && isWorking(b.sels[i].value); i--) bStrk++;
                if ((aStrk >= 3) !== (bStrk >= 3)) return aStrk >= 3 ? 1 : -1;

                // 非常勤10日制限
                if (a.config.type === 'part' && a.sels.filter(sel => isWorking(sel.value)).length >= 10) return 1;
                if (b.config.type === 'part' && b.sels.filter(sel => isWorking(sel.value)).length >= 10) return -1;

                return a.sels.filter(sel => isWorking(sel.value)).length - b.sels.filter(sel => isWorking(sel.value)).length;
            });
            candidates[0].sels[d].value = "出勤";
        }
    }

    // [3] 空欄を「公休」で埋める ＆ 常勤の休み合計(公休+希)を9日に調整
    staffData.forEach(s => {
        s.sels.forEach(sel => { if(sel.value === "") sel.value = "公休"; });

        if (s.config.type === 'full') {
            const targetOff = 9;
            let currentOffSels = () => s.sels.filter(sel => sel.value === "公休" || sel.value === "希望休");
            
            // 休みが多すぎる場合：公休を出勤に変える
            while (currentOffSels().length > targetOff) {
                let target = s.sels.find(sel => sel.value === "公休");
                if(!target) break;
                target.value = "出勤";
            }
            // 休みが足りない場合：出勤を公休に変える
            while (currentOffSels().length < targetOff) {
                let workSels = s.sels.filter(sel => sel.value === "出勤");
                if(workSels.length === 0) break;
                // 連勤解消を優先
                workSels.sort((a, b) => {
                    let getS = (sel) => {
                        let idx = parseInt(sel.dataset.day) - 1;
                        let st = 0; for(let i=idx; i>=0 && isWorking(s.sels[i].value); i--) st++;
                        return st;
                    };
                    return getS(b) - getS(a);
                });
                workSels[0].value = "公休";
            }
        }
    });

    updateSummary();
    alert("生成完了：常勤の休み(公休+希望休)を9日に調整しました。");
}

function updateSummary() {
    const list = document.getElementById('summaryList');
    const selects = document.querySelectorAll('.shift-select');
    list.innerHTML = staffs.map((s, idx) => {
        const mySels = Array.from(selects).filter(sel => parseInt(sel.dataset.staff) === idx);
        const c = { "出勤":0, "公休":0, "希望休":0, "有給":0, "":0 };
        mySels.forEach(sel => {
            if (c.hasOwnProperty(sel.value)) c[sel.value]++;
            else c[""]++;
        });
        
        return `
            <div class="summary-row" style="padding: 8px; border-bottom: 1px solid #ddd; font-size: 0.9em;">
                <strong>${s.name}</strong> (${s.type==='full'?'常勤':'非常勤'})<br>
                <span>出勤: ${c["出勤"]}</span> | 
                <span>公休: ${c["公休"]}</span> | 
                <span>希望休: ${c["希望休"]}</span> | 
                <span>有給: ${c["有給"]}</span> | 
                <span style="color: blue;">休み計(公+希): ${c["公休"] + c["希望休"]}</span>
            </div>`;
    }).join('');
}
