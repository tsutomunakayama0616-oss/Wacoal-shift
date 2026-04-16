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

function autoFillShift() {
    const dateVal = document.getElementById('targetMonth').value;
    const [year, month] = dateVal.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const selects = document.querySelectorAll('.shift-select');
    const needInputs = document.querySelectorAll('.need-count-input');

    let grid = staffs.map((_, sIdx) => {
        return Array.from({length: daysInMonth}, (_, d) => {
            return Array.from(selects).find(sel => parseInt(sel.dataset.staff) === sIdx && parseInt(sel.dataset.day) === d + 1);
        });
    });

    // 初期化：自動生成前に手動入力を保持しつつ、前の自動生成結果をクリア
    grid.forEach(row => row.forEach(sel => { if(sel.value === "出勤" || sel.value === "公休") sel.value = ""; }));

    // 1. 有給をランダムに配置（空欄のみ）
    grid.forEach((row, sIdx) => {
        let emptyIndices = row.map((sel, i) => sel.value === "" ? i : -1).filter(i => i !== -1);
        for(let i=0; i < staffs[sIdx].paidDays && emptyIndices.length > 0; i++){
            let r = Math.floor(Math.random() * emptyIndices.length);
            row[emptyIndices[r]].value = "有給";
            emptyIndices.splice(r, 1);
        }
    });

    // 2. 日ごとに「出勤」を割り当て
    for (let d = 0; d < daysInMonth; d++) {
        const need = parseInt(needInputs[d].value) || 0;
        
        let candidates = staffs.map((_, i) => i)
            .filter(sIdx => {
                if (grid[sIdx][d].value !== "") return false;
                
                // 【制限1】出勤の4連勤チェック
                let streak = 0;
                for (let i = d - 1; i >= 0; i--) {
                    if (grid[sIdx][i].value === "出勤") streak++;
                    else break;
                }
                if (streak >= 3) return false;

                // 【制限2】非常勤の出勤10日制限
                if (staffs[sIdx].type === 'part') {
                    let currentWorkCount = grid[sIdx].filter(sel => sel.value === "出勤").length;
                    if (currentWorkCount >= 10) return false;
                }

                return true;
            })
            .sort((a, b) => {
                // 出勤が少ない人を優先して割り当てる（平準化）
                let countA = grid[a].filter(sel => sel.value === "出勤").length;
                let countB = grid[b].filter(sel => sel.value === "出勤").length;
                return countA - countB;
            });

        // 必要な人数分だけ「出勤」にする
        for (let sIdx of candidates) {
            if (grid.filter(row => row[d].value === "出勤").length >= need) break;
            grid[sIdx][d].value = "出勤";
        }
    }

    // 3. 常勤の休み調整（合計9日）
    grid.forEach((row, sIdx) => {
        // 空欄をすべて公休に
        row.forEach(sel => { if(sel.value === "") sel.value = "公休"; });
        
        if (staffs[sIdx].type === 'full') {
            const getOffs = () => row.filter(sel => sel.value === "公休" || sel.value === "希望休");
            
            // 休み不足（9日未満）の場合：出勤を公休に変える
            while (getOffs().length < 9) {
                let workSels = row.filter(sel => sel.value === "出勤");
                if (workSels.length === 0) break;
                
                // 出勤の連勤が長い箇所を優先的に休ませる
                workSels.sort((a, b) => {
                    let getS = (s) => {
                        let idx = parseInt(s.dataset.day) - 1;
                        let st = 0; for(let i=idx; i>=0 && row[i].value === "出勤"; i--) st++;
                        return st;
                    };
                    return getS(b) - getS(a);
                });
                workSels[0].value = "公休";
            }
            
            // 休みすぎ（9日超）の場合：公休を出勤に変える
            while (getOffs().length > 9) {
                let offSel = row.find(sel => sel.value === "公休");
                if (!offSel) break;
                offSel.value = "出勤";
            }
        }
    });

    updateSummary();
    alert("修正完了：4連勤制限(出勤のみ対象)および非常勤10日制限を適用しました。");
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
