let mdb;

function initMonthlyPage() {
    initDatabase();
    mdb = initMonthlyEvalsDB();
    populateMonthlyGrades();
    populateMonthlySubjects();
    populateMonthlyMonths();
    loadMonthlyForEntry();
    rebuildMonthlyViewHeaders();
}

function populateMonthlyGrades() {
    ["gradeSelect", "viewGradeSelect"].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const db = getDatabase();
        sel.innerHTML = '<option value="">اختر الصف</option>';
        db.grades.forEach(g => {
            const o = document.createElement("option");
            o.value = g.id;
            o.textContent = g.name;
            sel.appendChild(o);
        });
    });
}

function populateMonthlyMonths() {
    ["monthSelect", "viewMonthSelect"].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = "";
        getMonthsList().forEach(m => {
            const o = document.createElement("option");
            o.value = m.id;
            o.textContent = m.name;
            sel.appendChild(o);
        });
    });
}

function populateMonthlySubjects() {
    const sel = document.getElementById("subjectSelect");
    if (!sel) return;
    const gradeId = parseInt(document.getElementById("gradeSelect")?.value || 0);
    const currentSubjects = getSubjects(gradeId);
    sel.innerHTML = "";

    // Link grades to teacher's subject if logged in as teacher
    const session = typeof getCurrentSession === "function" ? getCurrentSession() : null;
    const teacherSubject = (session && session.role === "teacher" && session.subject) ? session.subject.trim() : null;

    currentSubjects.forEach(s => {
        const o = document.createElement("option");
        o.value = s.id;
        o.textContent = s.name;
        o.dataset.maxScore = s.maxScore;
        sel.appendChild(o);
    });

    if (teacherSubject) {
        let matched = false;
        for (let i = 0; i < sel.options.length; i++) {
            if (sel.options[i].textContent.includes(teacherSubject) || teacherSubject.includes(sel.options[i].textContent)) {
                sel.selectedIndex = i;
                matched = true;
                break;
            }
        }
        if (!matched) {
            const customOpt = document.createElement("option");
            customOpt.value = 999;
            customOpt.textContent = teacherSubject;
            customOpt.dataset.maxScore = 100;
            sel.prepend(customOpt);
            sel.selectedIndex = 0;
        }
    }

    sel.onchange = updateMonthlySubjectHeader;
    updateMonthlySubjectHeader();
}

function updateMonthlySubjectHeader() {
    const sel = document.getElementById("subjectSelect");
    const header = document.getElementById("monthlySubjectHeader");
    if (!sel || !header) return;
    const name = sel.options[sel.selectedIndex]?.textContent || "الدرجة الشهرية";
    header.textContent = `${name} (من 100)`;
    loadMonthlyForEntry();
}

function populateMonthlyClasses() {
    populateMonthlySubjects();
    populateClassesGeneric("gradeSelect", "classSelect", loadMonthlyForEntry);
}

function populateMonthlyViewClasses() {
    rebuildMonthlyViewHeaders();
    populateClassesGeneric("viewGradeSelect", "viewClassSelect", loadMonthlyView);
}

function populateClassesGeneric(gradeId, classId, onChange) {
    const gradeSelect = document.getElementById(gradeId);
    const classSelect = document.getElementById(classId);
    if (!classSelect) return;

    const gid = parseInt(gradeSelect?.value);
    classSelect.innerHTML = '<option value="">اختر الفصل</option>';

    if (!gid) { onChange?.(); return; }

    getClassesByGrade(gid).forEach(c => {
        const o = document.createElement("option");
        o.value = c.id;
        o.textContent = `فصل ${c.name}`;
        classSelect.appendChild(o);
    });
    onChange?.();
}

function rebuildMonthlyViewHeaders() {
    const viewThead = document.querySelector("#monthlyViewContainer table thead tr");
    if (!viewThead) return;
    viewThead.innerHTML = "";
    const baseHeaders = ["🏆 الرتبة", "🆔 id", "👤 اسم الطالب", "🚻 الجنس"];
    baseHeaders.forEach(h => {
        const th = document.createElement("th");
        th.textContent = h;
        viewThead.appendChild(th);
    });
    const gradeId = parseInt(document.getElementById("viewGradeSelect")?.value || 0);
    const currentSubjects = getSubjects(gradeId);
    currentSubjects.forEach(s => {
        const th = document.createElement("th");
        th.textContent = s.name;
        viewThead.appendChild(th);
    });
    const th1 = document.createElement("th"); th1.textContent = "📊 المجموع"; viewThead.appendChild(th1);
    const th2 = document.createElement("th"); th2.textContent = "🎯 النسبة"; viewThead.appendChild(th2);
    const th3 = document.createElement("th"); th3.textContent = "🏅 التقدير"; viewThead.appendChild(th3);
}

function loadMonthlyForEntry() {
    const table = document.getElementById("monthlyEntryTable");
    if (!table) return;
    table.innerHTML = "";

    const classSelect = document.getElementById("classSelect");
    const classId = classSelect ? parseInt(classSelect.value) : null;
    const subjectSelect = document.getElementById("subjectSelect");
    const subjectId = subjectSelect ? parseInt(subjectSelect.value) : null;
    const monthSelect = document.getElementById("monthSelect");
    const monthId = monthSelect ? parseInt(monthSelect.value) : 9;

    if (!classId) {
        table.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:24px;color:#888;">اختر الصف والفصل والمادة والشهر أولاً</td></tr>';
        return;
    }

    const students = getStudentsByClass(classId);

    if (students.length === 0) {
        table.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:24px;color:#888;">لا يوجد طلاب في هذا الفصل</td></tr>';
        return;
    }

    const saved = getMonthlyEvalsByClassAndSubject(classId, subjectId, monthId);

    students.forEach((student, idx) => {
        const row = document.createElement("tr");
        row.dataset.studentId = student.id;

        const existing = saved.find(r => r.studentId === student.id);
        const comp = existing?.components || {};
        let exam = comp.exam;
        let homework = comp.homework;
        let participation = comp.participation;
        let behavior = comp.behavior;
        let practical = comp.practical;
        let oral = comp.oral;

        // Backward compatibility if legacy single score exists without components
        if (existing && existing.score !== undefined && exam === undefined) {
            exam = existing.score;
        }

        const hasScores = (exam !== undefined || homework !== undefined || participation !== undefined ||
            behavior !== undefined || practical !== undefined || oral !== undefined);

        const eVal = parseFloat(exam) || 0;
        const hVal = parseFloat(homework) || 0;
        const pVal = parseFloat(participation) || 0;
        const bVal = parseFloat(behavior) || 0;
        const prVal = parseFloat(practical) || 0;
        const oVal = parseFloat(oral) || 0;

        const total = hasScores ? Math.round((eVal + hVal + pVal + bVal + prVal + oVal) * 10) / 10 : "";
        const info = getGradeClass(total !== "" ? total : 0, 100);

        row.innerHTML = `
            <td>${idx + 1}</td>
            <td dir="ltr" style="font-family:monospace;font-size:13px;">${student.nationalId}</td>
            <td>${student.name}</td>
            <td><input type="number" min="0" max="50" step="0.5" class="result-edit-input" style="width:60px; text-align:center;" data-student-id="${student.id}" data-comp="exam" value="${exam ?? ''}" oninput="updateMonthlyStudentRow(${student.id})" placeholder="0-50"></td>
            <td><input type="number" min="0" max="5" step="0.5" class="result-edit-input" style="width:48px; text-align:center;" data-student-id="${student.id}" data-comp="homework" value="${homework ?? ''}" oninput="updateMonthlyStudentRow(${student.id})" placeholder="0-5"></td>
            <td><input type="number" min="0" max="5" step="0.5" class="result-edit-input" style="width:48px; text-align:center;" data-student-id="${student.id}" data-comp="participation" value="${participation ?? ''}" oninput="updateMonthlyStudentRow(${student.id})" placeholder="0-5"></td>
            <td><input type="number" min="0" max="10" step="0.5" class="result-edit-input" style="width:48px; text-align:center;" data-student-id="${student.id}" data-comp="behavior" value="${behavior ?? ''}" oninput="updateMonthlyStudentRow(${student.id})" placeholder="0-10"></td>
            <td><input type="number" min="0" max="15" step="0.5" class="result-edit-input" style="width:52px; text-align:center;" data-student-id="${student.id}" data-comp="practical" value="${practical ?? ''}" oninput="updateMonthlyStudentRow(${student.id})" placeholder="0-15"></td>
            <td><input type="number" min="0" max="15" step="0.5" class="result-edit-input" style="width:52px; text-align:center;" data-student-id="${student.id}" data-comp="oral" value="${oral ?? ''}" oninput="updateMonthlyStudentRow(${student.id})" placeholder="0-15"></td>
            <td id="mtotal_${student.id}" style="font-weight:bold; font-size:15px; color:#1e293b; text-align:center;">${total !== "" ? total : '-'}</td>
            <td id="mgrade_${student.id}" class="result-grade ${total !== '' ? info.class : ''}">
                ${total !== '' ? info.label : '-'}
            </td>
        `;
        table.appendChild(row);
    });
}

function updateMonthlyStudentRow(studentId) {
    const row = document.querySelector(`tr[data-student-id="${studentId}"]`);
    if (!row) return;

    const examInput = row.querySelector('input[data-comp="exam"]');
    const hwInput = row.querySelector('input[data-comp="homework"]');
    const partInput = row.querySelector('input[data-comp="participation"]');
    const behInput = row.querySelector('input[data-comp="behavior"]');
    const practInput = row.querySelector('input[data-comp="practical"]');
    const oralInput = row.querySelector('input[data-comp="oral"]');

    const hasAny = (examInput?.value !== "" || hwInput?.value !== "" ||
        partInput?.value !== "" || behInput?.value !== "" ||
        practInput?.value !== "" || oralInput?.value !== "");

    const totalCell = document.getElementById("mtotal_" + studentId);
    const gradeCell = document.getElementById("mgrade_" + studentId);

    if (!hasAny) {
        if (totalCell) totalCell.textContent = "-";
        if (gradeCell) {
            gradeCell.textContent = "-";
            gradeCell.className = "result-grade";
        }
        return;
    }

    const exam = Math.max(0, Math.min(50, parseFloat(examInput?.value) || 0));
    const homework = Math.max(0, Math.min(5, parseFloat(hwInput?.value) || 0));
    const participation = Math.max(0, Math.min(5, parseFloat(partInput?.value) || 0));
    const behavior = Math.max(0, Math.min(10, parseFloat(behInput?.value) || 0));
    const practical = Math.max(0, Math.min(15, parseFloat(practInput?.value) || 0));
    const oral = Math.max(0, Math.min(15, parseFloat(oralInput?.value) || 0));

    const total = Math.round((exam + homework + participation + behavior + practical + oral) * 10) / 10;

    if (totalCell) totalCell.textContent = total;
    if (gradeCell) {
        const info = getGradeClass(total, 100);
        gradeCell.textContent = info.label;
        gradeCell.className = "result-grade " + info.class;
    }
}

function saveAllMonthlyEvals() {
    const classSelect = document.getElementById("classSelect");
    const subjectSelect = document.getElementById("subjectSelect");
    const monthSelect = document.getElementById("monthSelect");
    const classId = classSelect ? parseInt(classSelect.value) : null;
    const subjectId = subjectSelect ? parseInt(subjectSelect.value) : null;
    const monthId = monthSelect ? parseInt(monthSelect.value) : 9;
    const year = "2025-2026";

    if (!classId || !subjectId) {
        showToast("من فضلك اختاري الفصل والمادة أولاً", "warning");
        return;
    }

    let saved = 0;
    const rows = document.querySelectorAll("#monthlyEntryTable tr[data-student-id]");
    rows.forEach(row => {
        const studentId = parseInt(row.dataset.studentId);
        const examInput = row.querySelector('input[data-comp="exam"]');
        const hwInput = row.querySelector('input[data-comp="homework"]');
        const partInput = row.querySelector('input[data-comp="participation"]');
        const behInput = row.querySelector('input[data-comp="behavior"]');
        const practInput = row.querySelector('input[data-comp="practical"]');
        const oralInput = row.querySelector('input[data-comp="oral"]');

        const hasAny = (examInput?.value !== "" || hwInput?.value !== "" ||
            partInput?.value !== "" || behInput?.value !== "" ||
            practInput?.value !== "" || oralInput?.value !== "");

        if (hasAny) {
            const exam = Math.max(0, Math.min(50, parseFloat(examInput?.value) || 0));
            const homework = Math.max(0, Math.min(5, parseFloat(hwInput?.value) || 0));
            const participation = Math.max(0, Math.min(5, parseFloat(partInput?.value) || 0));
            const behavior = Math.max(0, Math.min(10, parseFloat(behInput?.value) || 0));
            const practical = Math.max(0, Math.min(15, parseFloat(practInput?.value) || 0));
            const oral = Math.max(0, Math.min(15, parseFloat(oralInput?.value) || 0));
            const total = Math.round((exam + homework + participation + behavior + practical + oral) * 10) / 10;

            addMonthlyEval({
                studentId: studentId,
                subjectId: subjectId,
                classId: classId,
                monthId: monthId,
                year: year,
                score: total,
                components: { exam, homework, participation, behavior, practical, oral }
            });
            saved++;
        }
    });

    showToast(`✅ تم حفظ ${saved} تقييم شهري بمجموع الـ 6 بنود بنجاح`, "success");
    mdb = initMonthlyEvalsDB();
    loadMonthlyView();
}

function loadMonthlyView() {
    const table = document.getElementById("monthlyViewTable");
    if (!table) return;
    table.innerHTML = "";

    const classSelect = document.getElementById("viewClassSelect");
    const classId = classSelect ? parseInt(classSelect.value) : null;
    const gradeId = parseInt(document.getElementById("viewGradeSelect")?.value || 0);
    const currentSubjects = getSubjects(gradeId);
    const monthSelect = document.getElementById("viewMonthSelect");
    const monthId = monthSelect ? parseInt(monthSelect.value) : 9;

    if (!classId) {
        table.innerHTML = `<tr><td colspan="${currentSubjects.length + 7}" style="text-align:center;padding:24px;color:#888;">اختر الصف والفصل أولاً لعرض التقييمات</td></tr>`;
        return;
    }

    const students = getStudentsByClass(classId);
    if (students.length === 0) {
        table.innerHTML = `<tr><td colspan="${currentSubjects.length + 7}" style="text-align:center;padding:24px;color:#888;">لا يوجد طلاب</td></tr>`;
        return;
    }

    const maxTotal = currentSubjects.reduce((s, subj) => s + subj.maxScore, 0);
    const studentMonthly = [];

    students.forEach(student => {
        const rowData = { ...student, scores: {}, total: 0, hasAny: false };
        currentSubjects.forEach(s => {
            const res = getMonthlyEvalsByStudent(student.id).filter(r =>
                r.subjectId === s.id && r.monthId === monthId
            );
            const score = res[res.length - 1]?.score;
            if (score !== undefined && score !== null && !isNaN(score)) {
                rowData.scores[s.id] = score;
                rowData.total += score;
                rowData.hasAny = true;
            } else {
                rowData.scores[s.id] = null;
            }
        });
        rowData.percentage = rowData.hasAny ? (rowData.total / maxTotal) * 100 : 0;
        const info = getGradeClass(rowData.total, maxTotal);
        rowData.gradeLabel = info.label;
        rowData.gradeClass = info.class;
        rowData.maxTotal = maxTotal;
        studentMonthly.push(rowData);
    });

    studentMonthly.sort((a, b) => b.total - a.total);
    studentMonthly.forEach((sr, idx) => sr.rank = idx + 1);

    let passCount = 0;
    studentMonthly.forEach(sr => {
        if (sr.hasAny) {
            const row = document.createElement("tr");
            const pct = sr.maxTotal > 0 ? (sr.total / sr.maxTotal) * 100 : 0;
            if (pct >= 50) passCount++;

            let cells = `
                <td><strong>${sr.rank}</strong></td>
                <td dir="ltr" style="font-family:monospace;font-size:13px;">${sr.nationalId}</td>
                <td>${sr.name}</td>
                <td>${sr.gender || '-'}</td>
            `;

            currentSubjects.forEach(s => {
                const v = sr.scores[s.id];
                const info = getGradeClass(v ?? 0, s.maxScore);
                cells += `<td class="result-grade ${v !== null ? info.class : ''}">${v !== null ? v : '-'}</td>`;
            });

            cells += `
                <td><strong>${sr.total}</strong> / ${sr.maxTotal}</td>
                <td><strong>${sr.percentage.toFixed(1)}%</strong></td>
                <td class="result-grade ${sr.gradeClass}"><strong>${sr.hasAny ? sr.gradeLabel : '-'}</strong></td>
            `;
            row.innerHTML = cells;
            table.appendChild(row);
        }
    });

    const totals = studentMonthly.filter(s => s.hasAny);
    const totalScores = totals.map(t => t.total);
    document.getElementById("sumMonthlyCount").textContent = totals.length;
    document.getElementById("sumMonthlyTotal").textContent = maxTotal;
    document.getElementById("sumMonthlyMax").textContent = totals.length ? Math.max(...totalScores).toFixed(1) : 0;
    document.getElementById("sumMonthlyMin").textContent = totals.length ? Math.min(...totalScores).toFixed(1) : 0;
    document.getElementById("sumMonthlyPass").textContent = totals.length ? ((passCount / totals.length) * 100).toFixed(1) + "%" : "0%";
}

function switchMonthlyTab(tab) {
    document.getElementById("enterSection").classList.toggle("hidden", tab !== "enter");
    document.getElementById("viewSection").classList.toggle("hidden", tab !== "view");
    document.getElementById("tabEnter").classList.toggle("active", tab === "enter");
    document.getElementById("tabView").classList.toggle("active", tab === "view");
    if (tab === "view") { rebuildMonthlyViewHeaders(); loadMonthlyView(); }
}

function printMonthlyEntry() {
    printSection("monthlyEntrySection", "إدخال التقييمات الشهرية");
}

function printMonthlyView() {
    printSection("monthlyViewContainer", "كشوف التقييمات الشهرية");
}

function exportMonthlyEntry() {
    const classSelect = document.getElementById("classSelect");
    const subjectSelect = document.getElementById("subjectSelect");
    const monthSelect = document.getElementById("monthSelect");
    const classId = classSelect ? parseInt(classSelect.value) : null;
    const subjectId = subjectSelect ? parseInt(subjectSelect.value) : null;
    const gradeId = parseInt(document.getElementById("gradeSelect")?.value || 0);
    const monthId = monthSelect ? parseInt(monthSelect.value) : 9;

    if (!classId || !subjectId) {
        showToast("من فضلك اختاري الفصل والمادة أولاً", "warning");
        return;
    }

    const currentSubjects = getSubjects(gradeId);
    const subject = currentSubjects.find(s => s.id === subjectId) || getAllSubjects().find(s => s.id === subjectId);
    const monthName = getMonthsList().find(m => m.id === monthId)?.name || "شهر";
    const students = getStudentsByClass(classId);
    const data = students.map((st, i) => {
        const res = mdb.evals.find(r =>
            r.studentId === st.id && r.subjectId === subjectId && r.monthId === monthId
        );
        return {
            "م": i + 1,
            "id": st.nationalId,
            "اسم الطالب": st.name,
            "الجنس": st.gender || "",
            [subject.name + ` (من ${subject.maxScore})`]: res?.score ?? "",
            "الشهر": monthName,
            "الفصل": getClassName(classId)
        };
    });
    exportToExcel(data, `تقييم_${subject.name}_${monthName}_${getClassName(classId)}`, subject.name);
}

function exportMonthlyView() {
    const classSelect = document.getElementById("viewClassSelect");
    const monthSelect = document.getElementById("viewMonthSelect");
    const classId = classSelect ? parseInt(classSelect.value) : null;
    const gradeId = parseInt(document.getElementById("viewGradeSelect")?.value || 0);
    const monthId = monthSelect ? parseInt(monthSelect.value) : 9;
    const monthName = getMonthsList().find(m => m.id === monthId)?.name || "شهر";

    if (!classId) {
        showToast("من فضلك اختاري الفصل أولاً", "warning");
        return;
    }

    const currentSubjects = getSubjects(gradeId);
    const students = getStudentsByClass(classId);
    const maxTotal = currentSubjects.reduce((s, subj) => s + subj.maxScore, 0);
    const data = [];

    students.forEach(st => {
        const row = {
            "id": st.nationalId,
            "اسم الطالب": st.name,
            "الجنس": st.gender || ""
        };
        let total = 0;
        currentSubjects.forEach(s => {
            const res = mdb.evals.find(r =>
                r.studentId === st.id && r.subjectId === s.id && r.monthId === monthId
            );
            row[s.name] = res?.score ?? "";
            if (res?.score !== undefined && !isNaN(res.score)) total += res.score;
        });
        row["المجموع"] = total;
        row["النسبة %"] = maxTotal > 0 ? ((total / maxTotal) * 100).toFixed(1) : "";
        data.push(row);
    });

    exportToExcel(data, `تقييمات_${monthName}_${getClassName(classId)}`, "التقييمات الشهرية");
}

function importMonthlyEvals(event) {
    const classSelect = document.getElementById("classSelect");
    const subjectSelect = document.getElementById("subjectSelect");
    const monthSelect = document.getElementById("monthSelect");
    const classId = classSelect ? parseInt(classSelect.value) : null;
    const subjectId = subjectSelect ? parseInt(subjectSelect.value) : null;
    const gradeId = parseInt(document.getElementById("gradeSelect")?.value || 0);
    const monthId = monthSelect ? parseInt(monthSelect.value) : 9;
    const year = "2025-2026";

    if (!classId || !subjectId) {
        showToast("من فضلك اختاري الفصل والمادة أولاً قبل الاستيراد", "warning");
        return;
    }

    importFromExcel(event.target, (rows) => {
        let imported = 0, failed = 0;
        const currentSubjects = getSubjects(gradeId);
        const subject = currentSubjects.find(s => s.id === subjectId) || getAllSubjects().find(s => s.id === subjectId);
        const scoreColumn = Object.keys(rows[0] || {}).find(k =>
            k.includes(subject.name) || k.includes("درجة") || k.includes("score") || k.includes("تقييم")
        ) || Object.keys(rows[0] || {})[3];
        const nidColumn = Object.keys(rows[0] || {}).find(k =>
            k.includes("قومي") || k.includes("national") || k.includes("id") || k.toLowerCase().includes("id")
        ) || Object.keys(rows[0] || {})[1];

        rows.forEach(row => {
            const nid = String(row[nidColumn] || "").trim();
            const rawScore = row[scoreColumn];
            if (!nid || rawScore === undefined || rawScore === null || rawScore === "" || isNaN(parseFloat(rawScore))) { failed++; return; }
            const score = parseFloat(rawScore);

            const student = findStudentByNationalId(nid);
            if (!student || student.classId !== classId) { failed++; return; }

            try {
                addMonthlyEval({
                    studentId: student.id,
                    subjectId: subjectId,
                    classId: classId,
                    monthId: monthId,
                    year: year,
                    score: score
                });
                imported++;
            } catch (e) {
                failed++;
            }
        });

        mdb = initMonthlyEvalsDB();
        loadMonthlyForEntry();
        showToast(`✅ تم استيراد ${imported} تقييم (فشل: ${failed})`, imported > 0 ? "success" : "warning");
    });
}

document.addEventListener("DOMContentLoaded", initMonthlyPage);
