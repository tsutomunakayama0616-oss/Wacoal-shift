let staffs = [
    { name: "スタッフ1", type: "full", paidDays: 2 },
    { name: "スタッフ2", type: "full", paidDays: 2 },
    { name: "スタッフ3", type: "full", paidDays: 2 },
    { name: "スタッフ4", type: "full", paidDays: 2 },
    { name: "非常勤1", type: "part", paidDays: 1 }
];

let prevMonthEnd = Array(staffs.length).fill(0);

window.onload = () => {
    const now = new Date();
    targetMonth.value =
        `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

    renderStaffList();
    generateTable();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js');
    }
};

/**
 * 連勤チェック（前月含む）
 */
function canWork(row, d, limit, prev) {
    let streak = prev;
    for (let i = d - 1; i >= 0; i--) {
        if (row[i] === "出勤") streak++;
        else break;
    }
    return streak < limit;
}

/**
 * 自動生成（完成版）
 */
function autoFillShift() {

    const selects = [...document.querySelectorAll('.shift-select')];
    const needs = [...document.querySelectorAll('.need-count-input')];
    const days = needs.length;

    let grid = staffs.map(() => Array(days).fill("公休"));
    let workCount = Array(staffs.length).fill(0);

    // ----------------------
    // ① 希望休（最優先）
    // ----------------------
    selects.forEach(sel => {
        if (sel.value === "希望休") {
            grid[sel.dataset.staff][sel.dataset.day-1] = "希望休";
        }
    });

    // ----------------------
    // ② 有給（固定配置・消費しない）
    // ----------------------
    for (let s = 0; s < staffs.length; s++) {

        let daysList = [...Array(days).keys()]
            .sort(() => Math.random() - 0.5);

        let count = 0;

        for (let d of daysList) {
            if (count >= staffs[s].paidDays) break;

            if (grid[s][d] === "公休") {
                grid[s][d] = "有給";
                count++;
            }
        }
    }

    // ----------------------
    // ③ need充足＋公平性
    // ----------------------
    for (let d = 0; d < days; d++) {

        let need = parseInt(needs[d].value) || 0;
        let loopGuard = 0;

        while (
            grid.filter(r => r[d] === "出勤").length < need &&
            loopGuard < 5000
        ) {

            let order = staffs.map((_, i)=>i)
                .sort((a,b)=>workCount[a]-workCount[b]);

            for (let s of order) {

                if (
                    grid[s][d] === "公休" &&
                    canWork(
                        grid[s],
                        d,
                        staffs[s].type==="full"?4:2,
                        prevMonthEnd[s]
                    )
                ) {
                    grid[s][d] = "出勤";
                    workCount[s]++;
                    break;
                }
            }

            loopGuard++;
        }
    }

    // ----------------------
    // ④ 前月連勤更新
    // ----------------------
    prevMonthEnd = grid.map(row => {
        let count = 0;
        for (let i=row.length-1;i>=0;i--) {
            if (row[i]==="出勤") count++;
            else break;
        }
        return count;
    });

    // ----------------------
    // ⑤ UI反映
    // ----------------------
    selects.forEach(sel=>{
        sel.value = grid[sel.dataset.staff][sel.dataset.day-1];
    });

    checkShortage(grid, needs);
    updateSummary();

    alert("自動生成完了（有給固定版）");
}

/**
 * 不足チェック
 */
function checkShortage(grid, needs){
    let msg=[];
    for(let d=0;d<needs.length;d++){
        let assigned=grid.filter(r=>r[d]==="出勤").length;
        if(assigned<needs[d].value){
            msg.push(`${d+1}日：不足${needs[d].value-assigned}`);
        }
    }
    if(msg.length>0){
        alert("人員不足\n"+msg.join("\n"));
    }
}

/**
 * 以下UI系（そのまま）
 */
function generateTable(){
    const [y,m]=targetMonth.value.split('-');
    const days=new Date(y,m,0).getDate();

    let dRow="<th>名前</th>";
    let wRow="<th>曜</th>";
    let hRow="<th>一括</th>";

    for(let d=1;d<=days;d++){
        let day=new Date(y,m-1,d).getDay();
        dRow+=`<th>${d}</th>`;
        wRow+=`<th>${["日","月","火","水","木","金","土"][day]}</th>`;
        hRow+=`<td><button onclick="setColumnHoliday(${d})">休</button></td>`;
    }

    dateRow.innerHTML=dRow;
    dayRow.innerHTML=wRow;
    holidayRow.innerHTML=hRow;

    shiftBody.innerHTML=staffs.map((s,i)=>{
        let row=`<td>${s.name}</td>`;
        for(let d=1;d<=days;d++){
            row+=`<td>
            <select class="shift-select" data-staff="${i}" data-day="${d}" onchange="updateSummary()">
                <option value=""></option>
                <option value="出勤">出</option>
                <option value="公休">公</option>
                <option value="希望休">希</option>
                <option value="有給">有</option>
            </select></td>`;
        }
        return `<tr>${row}</tr>`;
    }).join('');

    let f="<td>必要</td>";
    for(let i=0;i<days;i++){
        f+=`<td><input class="need-count-input" value="3"></td>`;
    }
    shiftFoot.innerHTML=`<tr>${f}</tr>`;
}

function updateSummary(){
    const selects=document.querySelectorAll('.shift-select');
    summaryList.innerHTML=staffs.map((s,i)=>{
        let my=[...selects].filter(x=>x.dataset.staff==i);
        let w=my.filter(x=>x.value==="出勤").length;
        let p=my.filter(x=>x.value==="有給").length;
        return `${s.name} 出:${w} 有:${p}`;
    }).join("<br>");
}

function renderStaffList(){
    staffList.innerHTML=staffs.map((s,i)=>`
    <div>
        <input value="${s.name}" onchange="staffs[${i}].name=this.value">
        <select onchange="staffs[${i}].type=this.value">
            <option value="full">常勤</option>
            <option value="part">非常勤</option>
        </select>
        有給:<input type="number" value="${s.paidDays}"
        onchange="staffs[${i}].paidDays=parseInt(this.value)||0">
    </div>
    `).join('');
}

function addStaff(){
    staffs.push({name:"新規",type:"full",paidDays:0});
    renderStaffList();
    generateTable();
}

function resetShift(){
    document.querySelectorAll('.shift-select').forEach(s=>s.value="");
}

function setColumnHoliday(day){
    document.querySelectorAll(`[data-day="${day}"]`)
    .forEach(s=>{
        if(s.value!=="希望休") s.value="公休";
    });
}

/**
 * 保存・読込
 */
function saveData(){
    const data={
        staffs,
        shifts:[...document.querySelectorAll('.shift-select')].map(s=>s.value)
    };
    localStorage.setItem("shiftData",JSON.stringify(data));
    alert("保存しました");
}

function loadData(){
    const data=JSON.parse(localStorage.getItem("shiftData"));
    if(!data) return;

    staffs=data.staffs;
    renderStaffList();
    generateTable();

    document.querySelectorAll('.shift-select')
    .forEach((s,i)=>s.value=data.shifts[i]);

    alert("読込完了");
}
