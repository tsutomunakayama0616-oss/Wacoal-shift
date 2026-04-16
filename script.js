// スタッフ初期データ
let staffs = [
    { name: "スタッフ1", type: "full", paidDays: 0 },
    { name: "スタッフ2", type: "full", paidDays: 0 },
    { name: "スタッフ3", type: "full", paidDays: 0 },
    { name: "スタッフ4", type: "full", paidDays: 0 },
    { name: "非常勤1", type: "part", paidDays: 0 }
];

window.onload = () => {
    const now = new Date();
    const monthInput = document.getElementById('targetMonth');
    if (monthInput) monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    renderStaffList();
    generateTable();
};

function renderStaffList() {
    const list = document.getElementById('staffList');
    if (!list) return;
    list.innerHTML = staffs.map((s, i) => `
        <div class="staff-item">
            <input type="text" value="${s.name}" onchange="staffs[${i}].name=this.value; generateTable();" style="width:100%">
            <select onchange="staffs[${i}].type=this.value; updateSummary();" style="width:100%; margin:5px 0;">
                <option value="full" ${s.type==='full'?'selected':''}>常勤</option>
                <option value="part" ${s.type==='part'?'selected':''}>非常勤</option>
            </select>
            <div style="font-size:12px;">
                有給: <input type="number" value="${s.paidDays}" onchange="staffs[${i}].paidDays=parseInt(this.value)||0; updateSummary();" style="width:40px">日
                <button onclick="removeStaff(${i})" style="color:red; background:none; border:none; float:right; cursor:pointer;">削除</button>
            </div>
        </div>
    `).join('');
}

function addStaff() { staffs.push({ name: "新規", type: "full", paidDays: 0 }); renderStaffList(); generateTable(); }
function removeStaff(idx) { staffs.splice(idx, 1); renderStaffList(); generateTable(); }

function generateTable() {
    const monthInput = document.getElementById('targetMonth');
    const [year, month] = monthInput.value.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const defaultNeed = document.getElementById('defaultNeedCount').value;

    let dRow = '<th>名前</th>', wRow = '<th>曜</th>', hRow = '<th>定休日</th>';
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month - 1, d);
        const dayOfWeek = date.getDay();
        const dayClass = dayOfWeek === 6 ? 'sat' : dayOfWeek === 0 ? 'sun' : '';
        dRow += `<th>${d}</th>`;
        wRow += `<th class="${dayClass}">${["日","月","火","水","木","金","土"][dayOfWeek]}</th>`;
        hRow += `<td><button onclick="setColumnHoliday(${d})" style="font-size:10px">休</button></td>`;
    }
    document.getElementById('dateRow').innerHTML = dRow;
    document.getElementById('dayRow').innerHTML = wRow;
    document.getElementById('holidayRow').innerHTML = hRow;
    
    document.getElementById('shiftBody').innerHTML = staffs.map((staff, sIdx) => {
        let cells = `<td>${staff.name}</td>`;
        for (let d = 1; d <= daysInMonth; d++) {
            cells += `<td><select class="shift-select" data-staff="${sIdx}" data-day="${d}" onchange="updateSummary()">
                <option value="">-</option><option value="出勤">出</option><option value="公休">公</option><option value="希望休">希</option><option value="有給">有</option>
            </select></td>`;
        }
        return `<tr>${cells}</tr>`;
    }).join('');

    let fRow = '<td>目標人数</td>';
    for (let d = 1; d <= daysInMonth; d++) {
        fRow += `<td><input type="number" class="need-count-input" data-day="${d}" value="${defaultNeed}"></td>`;
    }
    document.getElementById('shiftFoot').innerHTML = `<tr>${fRow}</tr>`;
    updateSummary();
}

function setColumnHoliday(day) {
    document.querySelectorAll(`.shift-select[data-day="${day}"]`).forEach(s => s.value = "公休");
    const need = document.querySelector(`.need-count-input[data-day="${day}"]`);
    if(need) need.value = 0;
    updateSummary();
}

function autoFillShift() {
    const selects = Array.from(document.querySelectorAll('.shift-select'));
    const needInputs = Array.from(document.querySelectorAll('.need-count-input'));
    const daysInMonth = needInputs.length;
    const monthInput = document.getElementById('targetMonth');
    const [year, month] = monthInput.value.split('-').map(Number);
    const dailyTargets = needInputs.map(input => parseInt(input.value) || 0);

    for (let attempt = 0; attempt < 200; attempt++) {
        let success = true;
        
        // 1. 各スタッフの「休みの日数」を最初に確定（常勤9日・非常勤出勤10日以外）
        let grid = staffs.map((staff, sIdx) => {
            let row = Array.from({length: daysInMonth}, (_, d) => {
                const sel = selects.find(s => parseInt(s.dataset.staff) === sIdx && parseInt(s.dataset.day) === d+1);
                return (sel && (sel.value === "希望休" || sel.value === "公休" || sel.value === "有給")) ? sel.value : "";
            });
            
            let isFull = (staff.type === 'full');
            let targetOffCount = isFull ? 9 : (daysInMonth - 10);
            let currentOff = row.filter(v => v === "希望休" || v === "公休").length;

            let offNeeded = targetOffCount - currentOff;
            let safety = 0;
            while (offNeeded > 0 && safety < 500) {
                let d = Math.floor(Math.random() * daysInMonth);
                if (row[d] === "") { row[d] = "公休"; offNeeded--; }
                safety++;
            }
            // 休み以外の枠をすべて「出勤」として初期化
            for(let i=0; i<daysInMonth; i++) { if(row[i] === "") row[i] = "出勤"; }
            return row;
        });

        // 2. 制約チェック（連勤・頻度）
        // ※ここでは「出勤」を維持したまま、ルール違反があればこの回をリセットして再試行する
        for (let d = 0; d < daysInMonth; d++) {
            staffs.forEach((_, sIdx) => {
                if (grid[sIdx][d] !== "出勤") return;

                // 連勤制限（常勤4/非常勤2）
                let sP = 0; for (let i=d-1; i>=0; i--) { if(grid[sIdx][i]==="出勤") sP++; else break; }
                let sN = 0; for (let i=d+1; i<daysInMonth; i++) { if(grid[sIdx][i]==="出勤") sN++; else break; }
                let limit = (staffs[sIdx].type === 'full') ? 4 : 2;

                // 非常勤週制限（週3まで）
                let weekS = Math.floor(d / 7) * 7;
                let weeklyCount = grid[sIdx].slice(weekS, weekS+7).filter(v => v === "出勤").length;

                if (sP + sN >= limit || (staffs[sIdx].type === 'part' && weeklyCount > 3)) {
                    success = false; 
                }
            });
            if (!success) break;
        }
        if (!success) continue;

        // 3. 人員調整（3人を2人にする緩和ルール適用）
        for (let d = 0; d < daysInMonth; d++) {
            let count = grid.filter(row => row[d] === "出勤").length;
            let target = dailyTargets[d];

            if (target === 3) {
                // 3人目標時は2人または3人であればOK
                if (!(count === 2 || count === 3)) { success = false; break; }
            } else {
                // それ以外の目標人数は厳密にチェック
                if (count !== target) { success = false; break; }
            }
        }
        if (!success) continue;

        // 4. 休日数（9日等）の最終厳守チェック
        staffs.forEach((s, i) => {
            let totalOff = grid[i].filter(v => v === "公休" || v === "希望休").length;
            let targetOff = (s.type === 'full') ? 9 : (daysInMonth - 10);
            if (totalOff !== targetOff) success = false;
        });
        if (!success) continue;

        // 5. 日曜出勤の公平性（簡易チェック：特定の人に偏りすぎていないか）
        // ※この attempt ループを繰り返すことで、偏りの少ないパターンが選ばれる
        let sunCounts = staffs.map((_, sIdx) => 
            grid[sIdx].filter((v, i) => new Date(year, month - 1, i + 1).getDay() === 0 && v === "出勤").length
        );
        if (Math.max(...sunCounts) - Math.min(...sunCounts) > 2) { success = false; continue; }

        // すべてのチェックを通過
        selects.forEach(sel => {
            const sIdx = parseInt(sel.dataset.staff);
            const dIdx = parseInt(sel.dataset.day) - 1;
            sel.value = grid[sIdx][dIdx];
        });
        updateSummary();
        alert(`自動生成完了！（試行: ${attempt + 1}回）\n休日数厳守・人員調整（3→2）ルール適用済み`);
        return;
    }

    alert("エラー: 条件（休日数9日厳守・連勤制限・目標人数）をすべて満たす配置が見つかりませんでした。希望休を減らすか、人数設定を見直してください。");
}

function updateSummary() {
    const selects = document.querySelectorAll('.shift-select');
    const summary = document.getElementById('summaryList');
    if (!summary) return;
    summary.innerHTML = staffs.map((s, idx) => {
        const my = Array.from(selects).filter(sel => parseInt(sel.dataset.staff) === idx);
        const c = { "出勤":0, "公休":0, "希望休":0, "有給":0 };
        my.forEach(sel => { if(c[sel.value] !== undefined) c[sel.value]++; });
        let targetOff = (s.type === 'full') ? 9 : (new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - 10);
        return `<div class="summary-row"><strong>${s.name}</strong><br>出勤: ${c["出勤"]} / 休み: ${c["公休"] + c["希望休"]}日 (目標:${targetOff}日)</div>`;
    }).join('');
}
