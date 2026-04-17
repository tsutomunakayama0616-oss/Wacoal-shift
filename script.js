let staffs = [
    { name: "スタッフA", type: "full", paidDays: 0 },
    { name: "スタッフB", type: "full", paidDays: 0 },
    { name: "スタッフC", type: "full", paidDays: 0 },
    { name: "スタッフD", type: "full", paidDays: 0 },
    { name: "スタッフE", type: "part", paidDays: 0 }
];

const MAX_CONTINUOUS_WORK = 4; // 5連勤禁止（最大4連勤）

window.onload = () => {
    const now = new Date();
    const mInput = document.getElementById('targetMonth');
    mInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    mInput.addEventListener('change', generateTable);
    renderStaffList();
    generateTable();
};

function countOff(row) { return row.filter(v => ["公休", "希望休", "有給"].includes(v)).length; }

// 連勤チェックロジック（指定日を「出勤」に変えた場合に上限を超えないか）
function canWork(row, idx, limit) {
    let continuous = 1;
    // 前方向にカウント
    for (let i = idx - 1; i >= 0; i--) {
        if (row[i] === "出勤") continuous++; else break;
    }
    // 後方向にカウント
    for (let i = idx + 1; i < row.length; i++) {
        if (row[i] === "出勤") continuous++; else break;
    }
    return continuous <= limit;
}

function autoFillShift() {
    const selects = Array.from(document.querySelectorAll('.shift-select'));
    const needInputs = Array.from(document.querySelectorAll('.need-count-input'));
    const days = needInputs.length;
    const dailyTargets = needInputs.map(input => parseInt(input.value) || 0);

    // 1. 初期化 & 有給の物理配置
    let grid = staffs.map((staff, sIdx) => {
        let row = Array.from({length: days}, (_, d) => {
            const sel = selects.find(s => parseInt(s.dataset.staff) === sIdx && parseInt(s.dataset.day) === d+1);
            return (sel && sel.value !== "") ? sel.value : "";
        });

        let p = staff.paidDays;
        let safety = 0;
        while (p > 0 && safety < 100) {
            let d = Math.floor(Math.random() * days);
            if (row[d] === "") { row[d] = "有給"; p--; }
            safety++;
        }

        // 常勤の基本公休（9日）を散らす
        if (staff.type === 'full') {
            let o = 9 - countOff(row);
            while (o > 0) {
                let d = Math.floor(Math.random() * days);
                if (row[d] === "") { row[d] = "公休"; o--; }
            }
            // 空きを連勤制約内で埋める
            for(let i=0; i<days; i++) {
                if(row[i] === "") {
                    row[i] = canWork(row, i, MAX_CONTINUOUS_WORK) ? "出勤" : "公休";
                }
            }
        } else {
            for(let i=0; i<days; i++) if(row[i] === "") row[i] = "公休";
        }
        return row;
    });

    // 2. 人数不足の解消（連勤制約を優先しつつ補充）
    for (let d = 0; d < days; d++) {
        let target = dailyTargets[d];
        let workers = staffs.map((_, i) => i).filter(i => grid[i][d] === "出勤");
        
        if (workers.length < target) {
            let candidates = staffs.map((_, i) => i).filter(i => {
                const sel = selects.find(s => parseInt(s.dataset.staff) === i && parseInt(s.dataset.day) === d+1);
                if (sel && (sel.value !== "" && sel.value !== "出勤")) return false; // 休み固定は不可
                if (grid[i][d] === "出勤") return false;
                return canWork(grid[i], d, MAX_CONTINUOUS_WORK);
            });
            // 休みが多い順にソートして補充
            candidates.sort((a, b) => countOff(grid[b]) - countOff(grid[a]));
            for (let idx of candidates) {
                if (workers.length >= target) break;
                grid[idx][d] = "出勤";
                workers.push(idx);
            }
        }
    }

    // 3. 常勤9休の最終確定調整（連勤制約を絶対に壊さない）
    for (let s = 0; s < staffs.length; s++) {
        let row = grid[s];
        if (staffs[s].type === "full") {
            // 多すぎる休みを減らす
            while (countOff(row) > 9) {
                let changed = false;
                for (let d = 0; d < days; d++) {
                    if (countOff(row) <= 9) break;
                    if (row[d] === "公休" && canWork(row, d, MAX_CONTINUOUS_WORK)) {
                        const sel = selects.find(ui => parseInt(ui.dataset.staff) === s && parseInt(ui.dataset.day) === d+1);
                        if (!sel || (sel.value !== "希望休" && sel.value !== "有給")) {
                            row[d] = "出勤"; changed = true;
                        }
                    }
                }
                if (!changed) break;
            }
            // 少なすぎる休みを増やす（ここは連勤制約に引っかからないので単純置換）
            while (countOff(row) < 9) {
                let changed = false;
                for (let d = 0; d < days; d++) {
                    if (countOff(row) >= 9) break;
                    if (row[d] === "出勤") {
                        const sel = selects.find(ui => parseInt(ui.dataset.staff) === s && parseInt(ui.dataset.day) === d+1);
                        if (!sel || sel.value !== "出勤") {
                            row[d] = "公休"; changed = true;
                        }
                    }
                }
                if (!changed) break;
            }
        }
    }

    // UI反映
    selects.forEach(sel => {
        sel.value = grid[parseInt(sel.dataset.staff)][parseInt(sel.dataset.day) - 1];
    });
    updateSummary();
    alert("生成完了：最大4連勤以内で調整しました。");
}

function generateTable() {
    const mVal = document.getElementById('targetMonth').value;
    if(!mVal) return;
    const [y, m] = mVal.split('-').map(Number);
    const days = new Date(y, m, 0).getDate();
    const dNeed = document.getElementById('defaultNeedCount').value;

    let dR = '<th>名前</th>', wR = '<th>曜</th>', hR = '<th>一括</th>';
    for (let d = 1; d <= days; d++) {
        const date = new Date(y, m - 1, d);
        const dayW = date.getDay();
        const cls = dayW === 6 ? 'sat' : dayW === 0 ? 'sun' : '';
        dR += `<th>${d}</th>`;
        wR += `<th class="${cls}">${["日","月","火","水","木","金","土"][dayW]}</th>`;
        hR += `<td><button onclick="setColumnHoliday(${d})" style="font-size:10px">休</button></td>`;
    }
    document.getElementById('dateRow').innerHTML = dR;
    document.getElementById('dayRow').innerHTML = wR;
    document.getElementById('holidayRow').innerHTML = hR;

    document.getElementById('shiftBody').innerHTML = staffs.map((s, i) => {
        let cells = `<td style="background:#eee; font-weight:bold;">${s.name}</td>`;
        for (let d = 1; d <= days; d++) {
            cells += `<td><select class="shift-select" data-staff="${i}" data-day="${d}" onchange="updateSummary()">
                <option value="">-</option><option value="出勤">出</option><option value="公休">公</option><option value="希望休">希</option><option value="有給">有</option>
            </select></td>`;
        }
        return `<tr>${cells}</tr>`;
    }).join('');

    let fR = '<td>目標</td>';
    for (let d = 1; d <= days; d++) fR += `<td><input type="number" class="need-count-input" value="${dNeed}" style="width:25px"></td>`;
    document.getElementById('shiftFoot').innerHTML = `<tr>${fR}</tr>`;
    updateSummary();
}

function setColumnHoliday(d) {
    document.querySelectorAll(`.shift-select[data-day="${d}"]`).forEach(s => {
        if (!["希望休", "有給", "出勤"].includes(s.value)) s.value = "公休";
    });
    updateSummary();
}

function renderStaffList() {
    document.getElementById('staffList').innerHTML = staffs.map((s, i) => `
        <div class="staff-item">
            <input type="text" value="${s.name}" onchange="staffs[${i}].name=this.value; generateTable();" style="width:100px">
            <select onchange="staffs[${i}].type=this.value; updateSummary();">
                <option value="full" ${s.type==='full'?'selected':''}>常勤</option>
                <option value="part" ${s.type==='part'?'selected':''}>非常勤</option>
            </select>
            <div style="margin-top:5px; font-size:0.8rem;">
                有給: <input type="number" value="${s.paidDays}" onchange="staffs[${i}].paidDays=parseInt(this.value)||0; updateSummary();" style="width:35px"> 日
                <button onclick="removeStaff(${i})" style="color:red; border:none; background:none; float:right">削除</button>
            </div>
        </div>
    `).join('');
}

function addStaff() { staffs.push({ name: "新規", type: "full", paidDays: 0 }); renderStaffList(); generateTable(); }
function removeStaff(idx) { staffs.splice(idx, 1); renderStaffList(); generateTable(); }
function updateSummary() {
    const sels = document.querySelectorAll('.shift-select');
    document.getElementById('summaryList').innerHTML = staffs.map((s, idx) => {
        const my = Array.from(sels).filter(sel => parseInt(sel.dataset.staff) === idx);
        const c = { "出勤": 0, "公休": 0, "希望休": 0, "有給": 0 };
        my.forEach(sel => { if (c[sel.value] !== undefined) c[sel.value]++; });
        const off = c["公休"] + c["希望休"] + c["有給"];
        return `<div style="font-size:0.8rem; margin-bottom:5px; padding-bottom:5px; border-bottom:1px solid #eee;">
            <b>${s.name}</b><br>出勤: ${c["出勤"]}日 / 休み: ${off}日
        </div>`;
    }).join('');
}
