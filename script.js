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
            <input type="text" value="${s.name}" style="width:100%; margin-bottom:5px;" onchange="staffs[${i}].name=this.value; generateTable();">
            <select style="width:100%;" onchange="staffs[${i}].type=this.value; updateSummary();">
                <option value="full" ${s.type==='full'?'selected':''}>常勤</option>
                <option value="part" ${s.type==='part'?'selected':''}>非常勤</option>
            </select>
            <div style="margin-top:8px;">
                有給: <input type="number" value="${s.paidDays}" min="0" style="width:50px;" onchange="staffs[${i}].paidDays=parseInt(this.value)||0; updateSummary();">日
                <button onclick="removeStaff(${i})" style="padding:2px 5px; background:#ff4d4d; color:white; float:right;">×</button>
            </div>
        </div>
    `).join('');
}

function addStaff() { staffs.push({ name: "新規", type: "full", paidDays: 0 }); renderStaffList(); generateTable(); }
function removeStaff(idx) { staffs.splice(idx, 1); renderStaffList(); generateTable(); }

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
            cells += `<td><select class="shift-select" data-staff="${sIdx}" data-day="${d}" onchange="updateSummary()"><option value="">-</option><option value="出勤">出</option><option value="公休">公</option><option value="希望休">希</option><option value="有給">有</option></select></td>`;
        }
        return `<tr>${cells}</tr>`;
    }).join('');
    updateSummary();
}

function autoFillShift() {
    const selects = document.querySelectorAll('.shift-select');
    const [year, month] = document.getElementById('targetMonth').value.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const need = 3; // 1日あたりの必要人数

    let finalGrid = null;
    for (let t = 0; t < 1000; t++) {
        let grid = staffs.map((_, sIdx) => Array.from({length: daysInMonth}, (_, d) => {
            let val = Array.from(selects).find(s => parseInt(s.dataset.staff) === sIdx && parseInt(s.dataset.day) === d + 1).value;
            return (val === "希望休") ? "希望休" : "";
        }));

        // 1. 有給配置
        grid.forEach((row, sIdx) => {
            let needed = staffs[sIdx].paidDays;
            let emptyIdx = row.map((v, i) => v === "" ? i : -1).filter(i => i !== -1);
            for (let i = 0; i < needed && emptyIdx.length > 0; i++) {
                let r = Math.floor(Math.random() * emptyIdx.length);
                row[emptyIdx[r]] = "有給";
                emptyIdx.splice(r, 1);
            }
        });

        // 2. 出勤配置（4連勤・非常勤10日制限）
        let fail = false;
        for (let d = 0; d < daysInMonth; d++) {
            let candidates = staffs.map((_, i) => i).filter(sIdx => {
                if (grid[sIdx][d] !== "") return false;
                let streak = 0;
                for (let i = d - 1; i >= 0 && grid[sIdx][i] === "出勤"; i--) streak++;
                if (streak >= 3) return false;
                if (staffs[sIdx].type === 'part' && grid[sIdx].filter(v => v === "出勤").length >= 10) return false;
                return true;
            }).sort(() => Math.random() - 0.5);

            for (let sIdx of candidates) {
                if (grid.filter(row => row[d] === "出勤").length >= need) break;
                grid[sIdx][d] = "出勤";
            }
            if (grid.filter(row => row[d] === "出勤").length < need) { fail = true; break; }
        }
        if (fail) continue;

        // 3. 常勤休み9日調整
        let adjFail = false;
        grid.forEach((row, sIdx) => {
            row.forEach((v, i) => { if(v==="") row[i] = "公休"; });
            if (staffs[sIdx].type !== 'full') return;
            let getOffs = () => row.filter(v => v === "公休" || v === "希望休");
            while (getOffs().length < 9) {
                let w = row.map((v, i) => v === "出勤" ? i : -1).filter(i => i !== -1);
                if (w.length === 0) { adjFail = true; break; }
                w.sort((a,b) => {
                    let s = (idx) => { let c=0; for(let j=idx; j>=0 && row[j]==="出勤"; j--) c++; return c; };
                    return s(b) - s(a);
                });
                row[w[0]] = "公休";
            }
            while (getOffs().length > 9) {
                let o = row.map((v, i) => v === "公休" ? i : -1).filter(i => i !== -1);
                let target = o.find(idx => {
                    let s = 0; for(let j=idx-1; j>=0 && row[j]==="出勤"; j--) s++;
                    let ps = 0; for(let j=idx+1; j<daysInMonth && row[j]==="出勤"; j++) ps++;
                    return (s + ps) < 3;
                });
                if (target !== undefined) row[target] = "出勤"; else { adjFail = true; break; }
            }
        });
        if (!adjFail) { finalGrid = grid; break; }
    }

    if (finalGrid) {
        selects.forEach(sel => { sel.value = finalGrid[sel.dataset.staff][sel.dataset.day - 1]; });
        updateSummary();
        alert("スマホ最適化版：生成完了");
    } else {
        alert("条件が厳しすぎます。スタッフ数や必要人数を見直してください。");
    }
}

function updateSummary() {
    const list = document.getElementById('summaryList');
    const selects = document.querySelectorAll('.shift-select');
    list.innerHTML = staffs.map((s, idx) => {
        const mySels = Array.from(selects).filter(sel => parseInt(sel.dataset.staff) === idx);
        const c = { "出勤":0, "公休":0, "希望休":0, "有給":0, "":0 };
        mySels.forEach(sel => { if(c.hasOwnProperty(sel.value)) c[sel.value]++; });
        return `<div class="summary-row"><strong>${s.name}</strong> (${s.type==='full'?'常勤':'非常勤'})<br>出:${c["出勤"]}回 / 有給:${c["有給"]}日 / 休み計:${c["公休"]+c["希望休"]}日</div>`;
    }).join('');
}
