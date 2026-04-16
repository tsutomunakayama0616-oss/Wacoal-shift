function autoFillShift() {
    const selects = document.querySelectorAll('.shift-select');
    const needInputs = document.querySelectorAll('.need-count-input');
    const [year, month] = document.getElementById('targetMonth').value.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    let bestGrid = null;

    for (let t = 0; t < 1000; t++) {

        // 初期化（希望休は保持）
        let grid = staffs.map((_, sIdx) => {
            return Array.from({length: daysInMonth}, (_, d) => {
                let sel = Array.from(selects).find(s =>
                    parseInt(s.dataset.staff) === sIdx &&
                    parseInt(s.dataset.day) === d + 1
                );
                return (sel.value === "希望休") ? "希望休" : "";
            });
        });

        // ① 有給をランダム配置（希望休は上書きしない）
        staffs.forEach((staff, sIdx) => {
            let emptyIdx = grid[sIdx]
                .map((v, i) => v === "" ? i : -1)
                .filter(i => i !== -1)
                .sort(() => Math.random() - 0.5);

            for (let i = 0; i < staff.paidDays && i < emptyIdx.length; i++) {
                grid[sIdx][emptyIdx[i]] = "有給";
            }
        });

        // 日曜インデックス取得
        let sundays = [];
        for (let d = 0; d < daysInMonth; d++) {
            if (new Date(year, month - 1, d + 1).getDay() === 0) {
                sundays.push(d);
            }
        }

        // 日曜出勤カウント
        let sundayWorkCount = staffs.map(() => 0);

        // ② 日ごとに出勤割り当て
        let fail = false;

        for (let d = 0; d < daysInMonth; d++) {
            const need = parseInt(needInputs[d].value) || 0;

            let assigned = 0;
            const isSunday = sundays.includes(d);

            let candidates = staffs.map((_, sIdx) => sIdx).filter(sIdx => {

                if (grid[sIdx][d] !== "") return false; // 希望休・有給優先

                // 非常勤：10日制限
                if (staffs[sIdx].type === 'part') {
                    let workCount = grid[sIdx].filter(v => v === "出勤").length;
                    if (workCount >= 10) return false;
                }

                // 4連勤チェック（有給でリセット）
                let streak = 0;
                for (let i = d - 1; i >= 0; i--) {
                    if (grid[sIdx][i] === "出勤") streak++;
                    else if (grid[sIdx][i] === "有給") break;
                    else break;
                }
                if (streak >= 3) return false;

                return true;
            });

            // ⭐ 日曜は「日曜出勤が少ない人」を優先
            candidates.sort((a, b) => {
                if (isSunday) {
                    return sundayWorkCount[a] - sundayWorkCount[b];
                } else {
                    const workA = grid[a].filter(v => v === "出勤").length;
                    const workB = grid[b].filter(v => v === "出勤").length;
                    return workA - workB;
                }
            });

            // 少しランダム性
            candidates = candidates.sort(() => Math.random() - 0.5);

            for (let sIdx of candidates) {
                if (assigned >= need) break;

                grid[sIdx][d] = "出勤";
                assigned++;

                if (isSunday) sundayWorkCount[sIdx]++;
            }

            if (assigned < need) {
                fail = true;
                break;
            }
        }

        if (fail) continue;

        // ③ 残りを公休に
        grid.forEach(row => {
            row.forEach((v, i) => {
                if (v === "") row[i] = "公休";
            });
        });

        // ④ 最終チェック
        let valid = true;

        for (let d = 0; d < daysInMonth; d++) {
            const need = parseInt(needInputs[d].value) || 0;
            const actual = grid.filter(row => row[d] === "出勤").length;
            if (actual < need) {
                valid = false;
                break;
            }
        }

        if (!valid) continue;

        bestGrid = grid;
        break;
    }

    if (bestGrid) {
        selects.forEach(sel => {
            const sIdx = parseInt(sel.dataset.staff);
            const d = parseInt(sel.dataset.day) - 1;
            sel.value = bestGrid[sIdx][d];
        });
        updateSummary();
        alert("生成成功：希望休最優先＋日曜公平で作成しました");
    } else {
        alert("生成失敗：条件が厳しすぎます");
    }
}
