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

function isWorkVal(v) { return v === "出勤" || v === "有給" || v === "希望休"; }

function autoFillShift() {
    const selects = document.querySelectorAll('.shift-select');
    const needInputs = document.querySelectorAll('.need-count-input');
    const [y, m] = document.getElementById('targetMonth').value.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();

    // [1] 全セレクトボックスの状態をメモリ上に展開
    let grid = staffs.map((s, sIdx) => {
        return Array.from({length: daysInMonth}, (_, d) => {
            let sel = Array.from(selects).find(sel => parseInt(sel.dataset.staff) === sIdx && parseInt(sel.dataset.day) === d + 1);
            return { val: sel.value, sel: sel };
        });
    });

    // [2] 事前に有給を配置（空欄のみ）
    grid.forEach((row, sIdx) => {
        let emptyIndices = row.map((c, i) => c.val === "" ? i : -1).filter(i => i !== -1);
        for(let i=0; i < staffs[sIdx].paidDays && emptyIndices.length > 0; i++){
            let r = Math.floor(Math.random() * emptyIndices.length);
            row[emptyIndices[r]].val = "有給";
            emptyIndices.splice(r, 1);
        }
    });

    // [3] メイン割り当て
    for (let d = 0; d < daysInMonth; d++) {
        const need = parseInt(needInputs[d].value) || 0;
        
        let attempt = 0;
        while (grid.filter(s => s[d].val === "出勤").length < need && attempt < 50) {
            attempt++;
            
            // 候補者探し
            let candidates = staffs.map((_, i) => i).filter(sIdx => grid[sIdx][d].val === "");
            
            candidates.sort((a, b) => {
                // 4連勤チェック (優先)
                let aStr = 0; for(let i=d-1; i>=0 && isWorkVal(grid[a][i].val); i--) aStr++;
                let bStr = 0; for(let i=d-1; i>=0 && isWorkVal(grid[b][i].val); i--) bStr++;
                if (aStr !== bStr) return aStr - bStr; // 連勤が短い人を優先

                // 累計出勤が少ない人を優先
                let aCount = grid[a].filter(c => isWorkVal(c.val)).length;
                let bCount = grid[b].filter(c => isWorkVal(c.val)).length;
                return aCount - bCount;
            });

            if (candidates.length > 0) {
                grid[candidates[0]][d].val = "出勤";
            } else {
                break; // 割り当て不能
            }
        }
    }

    // [4] 常勤の休み合計9日調整
    grid.forEach((row, sIdx) => {
        row.forEach(c => { if(c.val === "") c.val = "公休"; }); // 残りを公休に
        if (staffs[sIdx].type !== 'full') return;

        let getOffs = () => row.filter(c => c.val === "公休" || c.val === "希望休");
        
        // 休みを9日に増やす
        while (getOffs().length < 9) {
            let workDays = row.map((c, i) => ({val: c.val, i})).filter(x => x.val === "出勤");
            if (workDays.length === 0) break;
            // 4連勤に近い場所、あるいは連勤が長い場所を優先して公休に
            workDays.sort((a, b) => {
                let getS = (idx) => {
                    let s = 0; for(let i=idx; i>=0 && isWorkVal(row[i].val); i--) s++;
                    return s;
                };
                return getS(b.i) - getS(a.i);
            });
            row[workDays[0].i].val = "公休";
        }
        // 休みを9日に減らす（休みすぎの場合）
        while (getOffs().length > 9) {
            let offDay = row.find(c => c.val === "公休");
            if (!offDay) break;
            offDay.val = "出勤";
        }
    });

    // [5] 最終結果を画面に反映
    grid.forEach(row => {
        row.forEach(cell => {
            cell.sel.value = cell.val;
        });
    });

    updateSummary();
    alert("シフトを生成しました。\n※人数が極端に不足している日は、4連勤制限より人数確保を優先しています。");
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
