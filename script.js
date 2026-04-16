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
    const selects = document.querySelectorAll('.shift-select');
    const needInputs = document.querySelectorAll('.need-count-input');
    const [year, month] = document.getElementById('targetMonth').value.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    let finalGrid = null;
    
    // 成功するまで最大200回試行
    for (let trial = 0; trial < 200; trial++) {
        let tempGrid = staffs.map((_, sIdx) => {
            return Array.from({length: daysInMonth}, (_, d) => {
                let sel = Array.from(selects).find(s => parseInt(s.dataset.staff) === sIdx && parseInt(s.dataset.day) === d + 1);
                // 有給と希望休は固定して保持
                return (sel.value === "有給" || sel.value === "希望休") ? sel.value : "";
            });
        });

        // 1. 有給の自動配置（設定された不足分をランダムに）
        tempGrid.forEach((row, sIdx) => {
            let currentPaid = row.filter(v => v === "有給").length;
            let needed = staffs[sIdx].paidDays - currentPaid;
            let emptyIndices = row.map((v, i) => v === "" ? i : -1).filter(i => i !== -1);
            for (let i = 0; i < needed && emptyIndices.length > 0; i++) {
                let r = Math.floor(Math.random() * emptyIndices.length);
                row[emptyIndices[r]] = "有給";
                emptyIndices.splice(r, 1);
            }
        });

        // 2. 日ごとに「出勤」を割り当て（ここが一番重要）
        let failed = false;
        for (let d = 0; d < daysInMonth; d++) {
            const need = parseInt(needInputs[d].value) || 0;
            
            let candidates = staffs.map((_, i) => i).filter(sIdx => {
                if (tempGrid[sIdx][d] !== "") return false;
                // 出勤4連勤チェック
                let streak = 0;
                for (let i = d - 1; i >= 0 && tempGrid[sIdx][i] === "出勤"; i--) streak++;
                if (streak >= 3) return false;
                // 非常勤10日制限
                if (staffs[sIdx].type === 'part' && tempGrid[sIdx].filter(v => v === "出勤").length >= 10) return false;
                return true;
            }).sort(() => Math.random() - 0.5);

            for (let sIdx of candidates) {
                if (tempGrid.filter(row => row[d] === "出勤").length >= need) break;
                tempGrid[sIdx][d] = "出勤";
            }

            // 必要人数が埋まらなかったらこの回は失敗
            if (tempGrid.filter(row => row[d] === "出勤").length < need) {
                failed = true;
                break;
            }
        }
        if (failed) continue;

        // 3. 常勤の休みを9日に調整（公休の挿入）
        let adjustSuccess = true;
        tempGrid.forEach((row, sIdx) => {
            if (staffs[sIdx].type !== 'full') {
                row.forEach((v, i) => { if(v==="") row[i] = "公休"; });
                return;
            }
            
            // 残りをまず公休で埋める
            row.forEach((v, i) => { if(v==="") row[i] = "公休"; });
            
            let getOffs = () => row.filter(v => v === "公休" || v === "希望休");

            // 休み不足の場合：出勤を公休に変える
            while (getOffs().length < 9) {
                let works = row.map((v, i) => v === "出勤" ? i : -1).filter(i => i !== -1);
                if (works.length === 0) { adjustSuccess = false; break; }
                // 連勤が長いところを優先
                works.sort((a, b) => {
                    let s = (idx) => { let c=0; for(let j=idx; j>=0 && row[j]==="出勤"; j--) c++; return c; };
                    return s(b) - s(a);
                });
                row[works[0]] = "公休";
            }
            // 休みすぎの場合：公休を出勤に変える（ここでも4連勤チェックを徹底）
            while (getOffs().length > 9) {
                let offs = row.map((v, i) => v === "公休" ? i : -1).filter(i => i !== -1);
                let target = offs.find(idx => {
                    let s = 0; for(let j=idx-1; j>=0 && row[j]==="出勤"; j--) s++;
                    let postS = 0; for(let j=idx+1; j<daysInMonth && row[j]==="出勤"; j++) postS++;
                    return (s + postS) < 3;
                });
                if (target !== undefined) row[target] = "出勤";
                else { adjustSuccess = false; break; }
            }
        });

        if (adjustSuccess) {
            finalGrid = tempGrid;
            break;
        }
    }

    if (finalGrid) {
        selects.forEach(sel => {
            const sIdx = parseInt(sel.dataset.staff);
            const d = parseInt(sel.dataset.day) - 1;
            sel.value = finalGrid[sIdx][d];
        });
        updateSummary();
        alert("修正完了：4連勤(出)と非常勤10日制限を100%遵守して生成しました。");
    } else {
        alert("条件が厳しすぎて、制限を守ったまま必要人数を確保できませんでした。スタッフを増やすか、必要人数を調整してください。");
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
