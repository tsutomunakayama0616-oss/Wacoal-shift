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

// スタッフリスト描画
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

// テーブル生成
function generateTable() {
    const monthInput = document.getElementById('targetMonth');
    if (!monthInput) return;
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

// 自動生成メインロジック
function autoFillShift() {
    const selects = Array.from(document.querySelectorAll('.shift-select'));
    const needInputs = Array.from(document.querySelectorAll('.need-count-input'));
    const daysInMonth = needInputs.length;

    // 1. 希望休・公休等の保持
    let grid = staffs.map((_, sIdx) => Array.from({length: daysInMonth}, (_, d) => {
        const sel = selects.find(s => parseInt(s.dataset.staff) === sIdx && parseInt(s.dataset.day) === d+1);
        return (sel && (sel.value !== "" && sel.value !== "出勤")) ? sel.value : "";
    }));

    // 2. 有給の事前配置
    staffs.forEach((s, sIdx) => {
        let currentPaid = grid[sIdx].filter(v => v === "有給").length;
        let needed = s.paidDays - currentPaid;
        let attempts = 0;
        while (needed > 0 && attempts < 500) {
            let d = Math.floor(Math.random() * daysInMonth);
            if (grid[sIdx][d] === "") {
                grid[sIdx][d] = "有給";
                needed--;
            }
            attempts++;
        }
    });

    let dailyTargets = needInputs.map(input => parseInt(input.value) || 0);

    // 3. 各日の割り当て（連勤と人数制限の適用）
    for (let d = 0; d < daysInMonth; d++) {
        let target = dailyTargets[d];
        if (target === 0) {
            grid.forEach(row => { if(row[d] === "") row[d] = "公休"; });
            continue;
        }

        // 【修正】出勤4日間連続を上限とする（5連勤禁止）
        let candidates = staffs.map((_, i) => i).filter(sIdx => {
            if (grid[sIdx][d] !== "") return false;
            let workStreak = 0;
            for (let i = d - 1; i >= 0; i--) {
                if (grid[sIdx][i] === "出勤") workStreak++;
                else break; // 出勤以外（有給・公休）ならリセット
            }
            return workStreak < 4; // 4連勤中ならOK、4連勤済み（今日が5日目）なら不可
        });

        // 公平性のために出勤が少ない順にソート
        candidates.sort((a, b) => {
            let countA = grid[a].filter(v => v === "出勤").length;
            let countB = grid[b].filter(v => v === "出勤").length;
            return countA - countB + (Math.random() - 0.5);
        });

        let assignedCount = grid.filter(row => row[d] === "出勤" || row[d] === "有給").length;
        for (let sIdx of candidates) {
            if (assignedCount >= target) break;
            grid[sIdx][d] = "出勤";
            assignedCount++;
        }

        // 【修正】人数ルールの厳格適用
        // 目標が3人なら2人でも続行。0, 4, 5人は絶対。
        let minAllowed = target;
        if (target === 3) minAllowed = 2;

        if (assignedCount < minAllowed) {
            alert(`【エラー】${d + 1}日の出勤人数を確保できません。\n現在：${assignedCount}名 / 目標：${target}名\n\n原因：5連勤禁止ルール、または希望休の重複です。\n※目標3人の日は2人まで許容していますが、それすら足りない状態です。`);
            return;
        }
    }

    // 4. 休日数の最終調整（公休を使用）
    grid.forEach((row, sIdx) => {
        let isFull = (staffs[sIdx].type === 'full');
        let targetOff = isFull ? 9 : (daysInMonth - 10);

        // 未入力部分を埋める
        for (let i = 0; i < daysInMonth; i++) {
            if (row[i] === "") {
                let streak = 0;
                for (let j = i - 1; j >= 0; j--) { if (row[j] === "出勤") streak++; else break; }
                // ここでも4連勤制限をチェック
                if (streak < 4 && row.filter(v=>v==="出勤").length < (isFull ? 31 : 10)) {
                    row[i] = "出勤";
                } else {
                    row[i] = "公休";
                }
            }
        }

        // 休みが足りない場合、連勤制限に抵触しないようランダムに出勤を公休へ
        let safety = 0;
        while (row.filter(v => v === "公休" || v === "希望休").length < targetOff && safety < 100) {
            let works = row.map((v, i) => v === "出勤" ? i : -1).filter(i => i !== -1);
            if (works.length === 0) break;
            row[works[Math.floor(Math.random() * works.length)]] = "公休";
            safety++;
        }
    });

    // 5. 結果反映
    selects.forEach(sel => {
        const sIdx = parseInt(sel.dataset.staff);
        const dIdx = parseInt(sel.dataset.day) - 1;
        sel.value = grid[sIdx][dIdx];
    });
    updateSummary();
    alert("自動作成が完了しました。");
}

function updateSummary() {
    const selects = document.querySelectorAll('.shift-select');
    const summary = document.getElementById('summaryList');
    if (!summary) return;
    summary.innerHTML = staffs.map((s, idx) => {
        const my = Array.from(selects).filter(sel => parseInt(sel.dataset.staff) === idx);
        const c = { "出勤":0, "公休":0, "希望休":0, "有給":0 };
        my.forEach(sel => { if(c[sel.value] !== undefined) c[sel.value]++; });
        return `<div class="summary-row"><strong>${s.name}</strong><br>出勤: ${c["出勤"]} / 休み: ${c["公休"] + c["希望休"]}日</div>`;
    }).join('');
}
