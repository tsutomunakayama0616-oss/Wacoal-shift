/**
 * スタッフ初期データ
 */
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

    if (monthInput) {
        monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        monthInput.addEventListener('change', generateTable);
    }

    renderStaffList();
    generateTable();
};

/**
 * リセット（完全動作版）
 */
function resetShift() {
    if (!confirm("入力されているシフトをすべてリセットしますか？")) return;

    // シフト初期化
    document.querySelectorAll('.shift-select').forEach(sel => {
        sel.value = "";
    });

    // 目標人数も初期値に戻す
    const defaultNeed = document.getElementById('defaultNeedCount').value;
    document.querySelectorAll('.need-count-input').forEach(input => {
        input.value = defaultNeed;
    });

    updateSummary();
}

/**
 * 連勤チェック
 */
function canWork(row, d, limit) {
    let prev = 0;
    for (let i = d - 1; i >= 0; i--) {
        if (row[i] === "出勤") prev++; else break;
    }
    let next = 0;
    for (let i = d + 1; i < row.length; i++) {
        if (row[i] === "出勤") next++; else break;
    }
    return (prev + next + 1) <= limit;
}

function countWork(row) { return row.filter(v => v === "出勤").length; }
function countOff(row) { return row.filter(v => ["公休", "希望休", "有給"].includes(v)).length; }

/**
 * 自動生成（簡易安定版）
 */
function autoFillShift() {
    const selects = Array.from(document.querySelectorAll('.shift-select'));
    const needInputs = Array.from(document.querySelectorAll('.need-count-input'));
    const daysInMonth = needInputs.length;

    let grid = staffs.map(() => Array(daysInMonth).fill("公休"));

    // シンプル配置（安定優先）
    for (let s = 0; s < staffs.length; s++) {
        let row = grid[s];

        if (staffs[s].type === "full") {
            let workDays = daysInMonth - 9;
            let assigned = 0;
            while (assigned < workDays) {
                let d = Math.floor(Math.random() * daysInMonth);
                if (row[d] === "公休" && canWork(row, d, 4)) {
                    row[d] = "出勤";
                    assigned++;
                }
            }
        } else {
            let assigned = 0;
            while (assigned < 10) {
                let d = Math.floor(Math.random() * daysInMonth);
                if (row[d] === "公休" && canWork(row, d, 2)) {
                    row[d] = "出勤";
                    assigned++;
                }
            }
        }
    }

    // UI反映
    selects.forEach(sel => {
        const s = parseInt(sel.dataset.staff);
        const d = parseInt(sel.dataset.day) - 1;
        sel.value = grid[s][d];
    });

    updateSummary();
    alert("自動生成完了！");
}

/**
 * テーブル生成（holidayボタン確実表示）
 */
function generateTable() {
    const monthInput = document.getElementById('targetMonth');
    if (!monthInput) return;

    const [year, month] = monthInput.value.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const defaultNeed = document.getElementById('defaultNeedCount').value;

    let dRow = '<th>名前</th>';
    let wRow = '<th>曜</th>';
    let hRow = '<th>一括</th>';

    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month - 1, d);
        const day = date.getDay();

        dRow += `<th>${d}</th>`;
        wRow += `<th>${["日","月","火","水","木","金","土"][day]}</th>`;
        hRow += `<td><button onclick="setColumnHoliday(${d})">休</button></td>`;
    }

    document.getElementById('dateRow').innerHTML = dRow;
    document.getElementById('dayRow').innerHTML = wRow;
    document.getElementById('holidayRow').innerHTML = hRow;

    // 本体
    document.getElementById('shiftBody').innerHTML = staffs.map((s, i) => {
        let cells = `<td>${s.name}</td>`;
        for (let d = 1; d <= daysInMonth; d++) {
            cells += `<td>
                <select class="shift-select" data-staff="${i}" data-day="${d}" onchange="updateSummary()">
                    <option value="">-</option>
                    <option value="出勤">出</option>
                    <option value="公休">公</option>
                    <option value="希望休">希</option>
                    <option value="有給">有</option>
                </select>
            </td>`;
        }
        return `<tr>${cells}</tr>`;
    }).join('');

    // 目標人数
    let fRow = '<td>目標</td>';
    for (let d = 1; d <= daysInMonth; d++) {
        fRow += `<td><input type="number" class="need-count-input" value="${defaultNeed}" style="width:30px"></td>`;
    }
    document.getElementById('shiftFoot').innerHTML = `<tr>${fRow}</tr>`;

    updateSummary();
}

/**
 * 一括休日
 */
function setColumnHoliday(day) {
    document.querySelectorAll(`.shift-select[data-day="${day}"]`).forEach(s => {
        if (!["希望休", "有給"].includes(s.value)) {
            s.value = "公休";
        }
    });

    updateSummary();
}

/**
 * スタッフUI
 */
function renderStaffList() {
    const list = document.getElementById('staffList');
    if (!list) return;

    list.innerHTML = staffs.map((s, i) => `
        <div>
            <input value="${s.name}" onchange="staffs[${i}].name=this.value;generateTable();">
            <select onchange="staffs[${i}].type=this.value">
                <option value="full" ${s.type==="full"?"selected":""}>常勤</option>
                <option value="part" ${s.type==="part"?"selected":""}>非常勤</option>
            </select>
            <button onclick="removeStaff(${i})">削除</button>
        </div>
    `).join('');
}

function addStaff() {
    staffs.push({ name: "新規", type: "full", paidDays: 0 });
    renderStaffList();
    generateTable();
}

function removeStaff(i) {
    staffs.splice(i, 1);
    renderStaffList();
    generateTable();
}

/**
 * 集計
 */
function updateSummary() {
    const selects = document.querySelectorAll('.shift-select');
    const summary = document.getElementById('summaryList');

    if (!summary) return;

    summary.innerHTML = staffs.map((s, i) => {
        const my = Array.from(selects).filter(sel => parseInt(sel.dataset.staff) === i);
        const work = my.filter(sel => sel.value === "出勤").length;
        const off = my.filter(sel => ["公休","希望休","有給"].includes(sel.value)).length;
        return `<div>${s.name}：出 ${work} / 休 ${off}</div>`;
    }).join('');
}
