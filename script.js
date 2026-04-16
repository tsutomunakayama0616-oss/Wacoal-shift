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
    const daysInMonth = new Date(...document.getElementById('targetMonth').value.split('-').map((v,i)=>i===1?parseInt(v):parseInt(v))).getDate();

    // 何回かやり直して成功するまで繰り返す
    let success = false;
    for (let attempt = 0; attempt < 50; attempt++) {
        // [1] リセットと事前入力の取得
        let grid = staffs.map((s, sIdx) => {
            return Array.from({length: daysInMonth}, (_, d) => {
                let sel = Array.from(selects).find(sel => parseInt(sel.dataset.staff) === sIdx && parseInt(sel.dataset.day) === d + 1);
                return { val: sel.value, sel: sel };
            });
        });

        // 空欄を埋めるためのシャッフル用インデックス
        let staffIndices = staffs.map((_, i) => i);

        // [2] 日ごとに割り当て
        let dailyFail = false;
        for (let d = 0; d < daysInMonth; d++) {
            const need = parseInt(needInputs[d].value) || 0;
            
            // 既に「出勤」になっている人を数える
            let currentWorkCount = grid.filter(s => s[d].val === "出勤").length;
            
            // 足りない分を割り当てる
            let shuffled = [...staffIndices].sort(() => Math.random() - 0.5);
            for (let sIdx of shuffled) {
                if (currentWorkCount >= need) break;
                if (grid[sIdx][d].val !== "") continue; // 既に希望休などがある

                // 4連勤チェック
                let streak = 0;
                for (let prev = d - 1; prev >= 0; prev--) {
                    if (isWorkVal(grid[sIdx][prev].val)) streak++;
                    else break;
                }
                
                if (streak < 3) {
                    grid[sIdx][d].val = "出勤";
                    currentWorkCount++;
                }
            }

            if (currentWorkCount < need) { dailyFail = true; break; }
        }

        if (dailyFail) continue;

        // [3] 常勤の休み9日調整（公+希）
        staffs.forEach((staff, sIdx) => {
            if (staff.type !== 'full') return;
            
            // 残った空欄を埋める
            grid[sIdx].forEach(cell => { if(cell.val === "") cell.val = "公休"; });

            let getOffs = () => grid[sIdx].filter(c => c.val === "公休" || c.val === "希望休");
            
            // 休み不足を解消
            let safety = 0;
            while (getOffs().length < 9 && safety < 100) {
                safety++;
                let workDays = grid[sIdx].filter(c => c.val === "出勤");
                if (workDays.length === 0) break;
                // 連勤が長いところを優先して公休に
                workDays.sort((a, b) => {
                    let dIdx = grid[sIdx].indexOf(a);
                    let streak = 0;
                    for (let i = dIdx; i >= 0 && isWorkVal(grid[sIdx][i].val); i--) streak++;
                    return 10 - streak; // 降順
                });
                workDays[0].val = "公休";
            }
            // 休みすぎを解消
            while (getOffs().length > 9) {
                let offDay = grid[sIdx].find(c => c.val === "公休");
                if (!offDay) break;
                offDay.val = "出勤";
            }
        });

        // [4] 全員（非常勤含む）の空欄を公休で埋める
        grid.forEach(row => row.forEach(c => { if(c.val === "") c.val = "公休"; }));

        // [5] 最終チェック：4連勤と必要人数
        let finalCheck = true;
        for (let d = 0; d < daysInMonth; d++) {
            if (grid.filter(s => s[d].val === "出勤").length < parseInt(needInputs[d].value)) finalCheck = false;
        }
        grid.forEach(row => {
            let sCount = 0;
            row.forEach(c => {
                if (isWorkVal(c.val)) sCount++;
                else sCount = 0;
                if (sCount >= 4) finalCheck = false;
            });
        });

        if (finalCheck) {
            // 反映
            grid.forEach(row => row.forEach(c => c.sel.value = c.val));
            success = true;
            break;
        }
    }

    if (!success) {
        alert("条件が厳しすぎて生成できませんでした。人数を増やすか休みを減らしてください。");
    } else {
        updateSummary();
        alert("4連勤なし・出勤人数厳守で生成しました。");
    }
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
