// 初期スタッフデータ
let staffs = [
    { name: "常勤1", paidDays: 0 },
    { name: "常勤2", paidDays: 0 },
    { name: "常勤3", paidDays: 0 },
    { name: "常勤4", paidDays: 0 },
    { name: "非常勤1", paidDays: 0 }
];

const SHIFT_TYPES = { WORK: "出勤", OFF: "公休", HOPE: "希望休", PAID: "有給" };

// ページ読み込み時の初期化
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
            <input type="text" value="${s.name}" onchange="staffs[${i}].name=this.value; generateTable();">
            有給希望:<input type="number" class="paid-input" value="${s.paidDays}" min="0" max="10" onchange="staffs[${i}].paidDays=parseInt(this.value)">日
            <button class="remove-btn" onclick="removeStaff(${i})">削除</button>
        </div>
    `).join('');
}

function addStaff() {
    staffs.push({ name: "新スタッフ", paidDays: 0 });
    renderStaffList();
    generateTable();
}

function removeStaff(index) {
    staffs.splice(index, 1);
    renderStaffList();
    generateTable();
}

function generateTable() {
    const [year, month] = document.getElementById('targetMonth').value.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const dateRow = document.getElementById('dateRow');
    const dayRow = document.getElementById('dayRow');
    const shiftBody = document.getElementById('shiftBody');

    dateRow.innerHTML = '<th>名前</th>' + Array.from({length: daysInMonth}, (_, i) => `<th>${i+1}</th>`).join('');
    
    let dayHtml = '<th>曜日</th>';
    for (let d = 1; d <= daysInMonth; d++) {
        const dayOfWeek = new Date(year, month - 1, d).getDay();
        const dayLabels = ["日", "月", "火", "水", "木", "金", "土"];
        const className = dayOfWeek === 6 ? 'sat' : dayOfWeek === 0 ? 'sun' : '';
        dayHtml += `<th class="${className}">${dayLabels[dayOfWeek]}</th>`;
    }
    dayRow.innerHTML = dayHtml;

    shiftBody.innerHTML = staffs.map((staff, sIdx) => {
        let cells = `<td>${staff.name}</td>`;
        for (let d = 1; d <= daysInMonth; d++) {
            const dayOfWeek = new Date(year, month - 1, d).getDay();
            const className = dayOfWeek === 6 ? 'sat' : dayOfWeek === 0 ? 'sun' : '';
            cells += `<td class="${className}">
                <select class="shift-select" data-staff="${sIdx}" data-day="${d}">
                    <option value="出勤">出</option>
                    <option value="公休">公</option>
                    <option value="希望休">希</option>
                    <option value="有給">有</option>
                </select>
            </td>`;
        }
        return `<tr>${cells}</tr>`;
    }).join('');
}

function autoFillShift() {
    const selects = document.querySelectorAll('.shift-select');
    const [year, month] = document.getElementById('targetMonth').value.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    staffs.forEach((staff, sIdx) => {
        const staffSelects = Array.from(selects).filter(sel => parseInt(sel.dataset.staff) === sIdx);
        
        // 1. 現状の希望休をカウント
        let hopeCount = staffSelects.filter(sel => sel.value === "希望休").length;
        let remainingOff = Math.max(0, 9 - hopeCount);
        let remainingPaid = staff.paidDays;

        // 2. 有給をランダムに配置（希望休・公休以外）
        let availableDays = Array.from({length: daysInMonth}, (_, i) => i).filter(i => staffSelects[i].value === "出勤");
        for(let i=0; i<remainingPaid && availableDays.length > 0; i++) {
            let randIdx = Math.floor(Math.random() * availableDays.length);
            staffSelects[availableDays[randIdx]].value = "有給";
            availableDays.splice(randIdx, 1);
        }

        // 3. 公休の配置（4連勤防止ロジック）
        let workStreak = 0;
        staffSelects.forEach((sel, dIdx) => {
            // 出勤系の判定（出勤・有給は連勤にカウント）
            if (sel.value === "出勤" || sel.value === "有給") {
                workStreak++;
            } else {
                workStreak = 0;
            }

            // 4連勤になりそうな場合、または公休がまだ必要でランダム要素に合致した場合
            if (workStreak >= 4 && remainingOff > 0 && sel.value === "出勤") {
                sel.value = "公休";
                remainingOff--;
                workStreak = 0;
            }
        });

        // 4. 残りの公休をランダムに埋める
        availableDays = Array.from({length: daysInMonth}, (_, i) => i).filter(i => staffSelects[i].value === "出勤");
        while(remainingOff > 0 && availableDays.length > 0) {
            let randIdx = Math.floor(Math.random() * availableDays.length);
            staffSelects[availableDays[randIdx]].value = "公休";
            availableDays.splice(randIdx, 1);
            remainingOff--;
        }
    });
    alert("シフトの自動入力が完了しました。連勤数などを最終確認してください。");
}
