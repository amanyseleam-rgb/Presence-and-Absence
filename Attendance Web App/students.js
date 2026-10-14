let db;
let currentStudents = [];

function init() {
    db = initDatabase();
    populateGrades();
    displayStudents();
}

function populateGrades() {
    const gradeSelect = document.getElementById("gradeSelect");
    if (!gradeSelect) return;

    gradeSelect.innerHTML = '<option value="">اختر الصف</option>';
    db.grades.forEach(grade => {
        const option = document.createElement("option");
        option.value = grade.id;
        option.textContent = grade.name;
        gradeSelect.appendChild(option);
    });
}

function populateClasses() {
    const gradeSelect = document.getElementById("gradeSelect");
    const classSelect = document.getElementById("classSelect");
    if (!classSelect) return;

    const gradeId = parseInt(gradeSelect.value);
    classSelect.innerHTML = '<option value="">اختر الفصل</option>';

    if (!gradeId) {
        displayStudents();
        return;
    }

    const classes = getClassesByGrade(gradeId);
    classes.forEach(cls => {
        const option = document.createElement("option");
        option.value = cls.id;
        option.textContent = `فصل ${cls.name}`;
        classSelect.appendChild(option);
    });

    displayStudents();
}

function getFilteredStudents() {
    const classSelect = document.getElementById("classSelect");
    const classId = classSelect ? parseInt(classSelect.value) : null;

    let students = getAllStudentsWithClassInfo();

    if (classId) {
        students = students.filter(s => s.classId === classId);
    } else {
        const gradeSelect = document.getElementById("gradeSelect");
        const gradeId = gradeSelect ? parseInt(gradeSelect.value) : null;
        if (gradeId) {
            students = students.filter(s => s.gradeId === gradeId);
        }
    }

    return students.sort((a, b) => {
        if (a.gradeLevel !== b.gradeLevel) return a.gradeLevel - b.gradeLevel;
        if (a.classId !== b.classId) return a.classId - b.classId;
        return a.name.localeCompare(b.name, 'ar');
    });
}

function displayStudents() {
    const table = document.getElementById("studentsList");
    if (!table) return;

    table.innerHTML = "";
    currentStudents = getFilteredStudents();

    const searchInput = document.getElementById("studentSearch");
    let list = currentStudents;

    if (searchInput && searchInput.value.trim()) {
        const searchText = searchInput.value.trim().toLowerCase();
        list = currentStudents.filter(s =>
            s.name.toLowerCase().includes(searchText) ||
            s.nationalId.includes(searchText)
        );
    }

    if (list.length === 0) {
        table.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#888;font-size:15px;">لا يوجد طلاب</td></tr>';
        return;
    }

    list.forEach(function(student, index) {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${index + 1}</td>
            <td dir="ltr" style="font-family:monospace;font-size:13px;">${student.nationalId}</td>
            <td><strong>${student.name}</strong></td>
            <td>${student.gender || '-'}</td>
            <td>${student.gradeName} - ${student.className}</td>
            <td>
                <button class="barcode-btn" onclick='showStudentBarcode(${JSON.stringify(student)})' title="عرض الباركود">
                    🏷️ باركود
                </button>
                <button class="edit-btn" onclick="openEditStudentModal(${student.id})" title="تعديل">
                    ✏️ تعديل
                </button>
                <button class="export-btn" style="background:#0284c7; padding:6px 10px;" onclick="viewStudentHistory(${student.id})" title="سجل الطالب">
                    📊 السجل
                </button>
                <button class="delete-btn" onclick="removeStudent(${student.id})" title="حذف">
                    🗑️ حذف
                </button>
            </td>
        `;

        table.appendChild(row);
    });
}

function showStudentBarcode(student) {
    openBarcodeModal({
        id: student.id,
        name: student.name,
        nationalId: student.nationalId
    });
}

function addNewStudent() {
    const nameInput = document.getElementById("studentName");
    const nationalIdInput = document.getElementById("studentNationalId");
    const classSelect = document.getElementById("classSelect");
    const genderSelect = document.getElementById("studentGender");

    const name = nameInput.value.trim();
    const nationalId = nationalIdInput.value.trim();
    const classId = parseInt(classSelect.value);
    const gender = genderSelect ? genderSelect.value : "ذكر";

    if (!name) {
        showToast("من فضلك اكتب اسم الطالب", "warning");
        return;
    }

    if (!nationalId) {
        showToast("من فضلك اكتب كود / ID الطالب", "warning");
        return;
    }

    if (nationalId.length !== 9) {
        showToast("كود الطالب يجب أن يكون 9 أرقام", "warning");
        return;
    }

    if (!classId) {
        showToast("من فضلك اختر الصف والفصل أولاً", "warning");
        return;
    }

    const existing = findStudentByNationalId(nationalId);
    if (existing) {
        showToast("كود الطالب مسجل بالفعل للطالب: " + existing.name, "error");
        return;
    }

    try {
        const studentData = {
            nationalId: nationalId,
            name: name,
            classId: classId,
            gender: gender
        };
        addStudent(studentData);
        nameInput.value = "";
        nationalIdInput.value = "";
        db = getDatabase();
        displayStudents();
        showToast("✅ تم إضافة الطالب بنجاح!", "success");
    } catch (e) {
        showToast("خطأ: " + e.message, "error");
    }
}

function openEditStudentModal(studentId) {
    const dbLocal = getDatabase();
    const student = dbLocal.students.find(s => s.id === studentId);
    if (!student) return;

    document.getElementById("editStudentId").value = student.id;
    document.getElementById("editStudentName").value = student.name;
    document.getElementById("editStudentNid").value = student.nationalId;
    document.getElementById("editStudentGender").value = student.gender || "ذكر";

    const classSel = document.getElementById("editStudentClass");
    classSel.innerHTML = "";
    dbLocal.classes.forEach(c => {
        const g = dbLocal.grades.find(gr => gr.id === c.gradeId);
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = `${g ? g.name + ' - ' : ''}فصل ${c.name}`;
        if (c.id === student.classId) opt.selected = true;
        classSel.appendChild(opt);
    });

    document.getElementById("editStudentModal").classList.remove("hidden");
}

function closeEditModal() {
    document.getElementById("editStudentModal").classList.add("hidden");
}

function saveStudentEdit() {
    const studentId = parseInt(document.getElementById("editStudentId").value);
    const newName = document.getElementById("editStudentName").value.trim();
    const newNid = document.getElementById("editStudentNid").value.trim();
    const newGender = document.getElementById("editStudentGender").value;
    const newClassId = parseInt(document.getElementById("editStudentClass").value);

    if (!newName) {
        showToast("اسم الطالب مطلوب", "warning");
        return;
    }
    if (!newNid) {
        showToast("كود الطالب مطلوب", "warning");
        return;
    }

    try {
        updateStudent(studentId, {
            name: newName,
            nationalId: newNid,
            gender: newGender,
            classId: newClassId
        });
        db = getDatabase();
        displayStudents();
        closeEditModal();
        showToast("✅ تم تحديث بيانات الطالب بنجاح!", "success");
    } catch (e) {
        showToast("خطأ في التعديل: " + e.message, "error");
    }
}

function viewStudentHistory(studentId) {
    const dbLocal = getDatabase();
    const student = dbLocal.students.find(s => s.id === studentId);
    if (!student) return;

    document.getElementById("historyStudentTitle").textContent = `📊 سجل الطالب: ${student.name}`;
    document.getElementById("historyStudentSub").textContent = `كود الطالب: ${student.nationalId} | ${getClassName(student.classId)}`;

    // Attendance summary
    let present = 0, absent = 0, late = 0, excused = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith("attendance_")) {
            try {
                const recs = JSON.parse(localStorage.getItem(k));
                const rec = recs.find(r => r.nationalId === student.nationalId);
                if (rec) {
                    if (rec.status === "حاضر") present++;
                    else if (rec.status === "غائب") absent++;
                    else if (rec.status === "متأخر") late++;
                    else if (rec.status === "عذر مقبول") excused++;
                }
            } catch (e) {}
        }
    }

    // Results summary
    const myResults = getResultsByStudent(student.id);
    const myEvals = getMonthlyEvalsByStudent(student.id);

    let html = `
        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; text-align:center; margin-bottom:15px;">
            <div style="background:#f0fdf4; padding:8px; border-radius:8px; border:1px solid #bbf7d0;">
                <strong style="color:#16a34a; font-size:18px;">${present}</strong>
                <div style="font-size:12px; color:#15803d;">حاضر</div>
            </div>
            <div style="background:#fef2f2; padding:8px; border-radius:8px; border:1px solid #fecaca;">
                <strong style="color:#dc2626; font-size:18px;">${absent}</strong>
                <div style="font-size:12px; color:#b91c1c;">غائب</div>
            </div>
            <div style="background:#fffbeb; padding:8px; border-radius:8px; border:1px solid #fde68a;">
                <strong style="color:#d97706; font-size:18px;">${late}</strong>
                <div style="font-size:12px; color:#92400e;">متأخر</div>
            </div>
            <div style="background:#eff6ff; padding:8px; border-radius:8px; border:1px solid #bfdbfe;">
                <strong style="color:#2563eb; font-size:18px;">${excused}</strong>
                <div style="font-size:12px; color:#1e40af;">عذر</div>
            </div>
        </div>

        <h4 style="margin:10px 0 6px; color:#1e293b;">🎓 نتائج المواد المقيدة:</h4>
    `;

    if (myResults.length === 0) {
        html += `<p style="color:#888; font-size:13px;">لا توجد نتائج مسجلة لهذا الطالب بعد.</p>`;
    } else {
        html += `<table style="width:100%; font-size:13px; margin-bottom:10px;">
            <thead><tr style="background:#f8fafc;"><th>المادة</th><th>الفصل</th><th>الدرجة</th><th>التقييم المصري</th></tr></thead>
            <tbody>`;
        myResults.forEach(r => {
            const subj = getAllSubjects().find(s => s.id === r.subjectId);
            const band = r.colorBand || { label: "-", colorHex: "#64748b" };
            html += `<tr>
                <td>${subj ? subj.name : r.subjectId}</td>
                <td>${r.term}</td>
                <td><strong>${r.score}</strong></td>
                <td><span style="color:${band.colorHex}; font-weight:bold;">${band.label}</span></td>
            </tr>`;
        });
        html += `</tbody></table>`;
    }

    document.getElementById("historyContent").innerHTML = html;
    document.getElementById("studentHistoryModal").classList.remove("hidden");
}

function closeHistoryModal() {
    document.getElementById("studentHistoryModal").classList.add("hidden");
}

function removeStudent(studentId) {
    if (!confirm("هل أنت متأكد من حذف الطالب؟")) return;
    if (deleteStudent(studentId)) {
        db = getDatabase();
        displayStudents();
        showToast("✅ تم حذف الطالب بنجاح!", "success");
    }
}
        displayStudents();
        showToast("✅ تم حذف الطالب بنجاح!", "success");
    }
}

function exportStudents() {
    const list = currentStudents.length > 0 ? currentStudents : getAllStudentsWithClassInfo();
    const exportData = list.map(s => ({
        "الرقم": s.id,
        "id": s.nationalId,
        "اسم الطالب": s.name,
        "الجنس": s.gender || "",
        "الصف": s.gradeName || "",
        "الفصل": s.className || "",
        "رقم الفصل": s.classId
    }));
    exportToExcel(exportData, "بيانات_الطلاب", "الطلاب");
}

function handleImport(event) {
    importFromExcel(event.target, (rows) => {
        let added = 0, errors = 0;
        rows.forEach(row => {
            const nationalId = String(row["id"] || row["الرقم القومي"] || row["nationalId"] || "").trim();
            const name = String(row["اسم الطالب"] || row["name"] || "").trim();
            const className = String(row["الفصل"] || row["className"] || "").trim();
            const gradeName = String(row["الصف"] || row["gradeName"] || "").trim();
            const gender = String(row["الجنس"] || row["gender"] || "ذكر").trim();

            if (!name || !nationalId) { errors++; return; }
            if (findStudentByNationalId(nationalId)) { errors++; return; }

            let classId = null;
            const allClasses = db.classes;
            if (className) {
                const cls = allClasses.find(c => c.name === className);
                if (cls) {
                    if (gradeName) {
                        const grade = db.grades.find(g => g.name === gradeName);
                        if (grade && cls.gradeId === grade.id) {
                            classId = cls.id;
                        }
                    } else {
                        classId = cls.id;
                    }
                }
            }

            if (!classId) {
                const gradeSelect = document.getElementById("gradeSelect");
                const classSelect = document.getElementById("classSelect");
                classId = classSelect?.value ? parseInt(classSelect.value) :
                          (gradeSelect?.value ? (getClassesByGrade(parseInt(gradeSelect.value))[0]?.id || null) : null);
            }

            if (!classId) { errors++; return; }

            try {
                addStudent({ nationalId, name, classId, gender });
                added++;
            } catch (e) {
                errors++;
            }
        });

        db = getDatabase();
        displayStudents();
        showToast(`✅ تم استيراد ${added} طالب (فشل: ${errors})`, added > 0 ? "success" : "warning");
    }, (err) => {
        showToast("خطأ في الاستيراد: " + err.message, "error");
    });
}

function printAllStudentBarcodes() {
    const list = currentStudents.length > 0 ? currentStudents : getAllStudentsWithClassInfo();
    if (list.length === 0) {
        showToast("لا توجد طلاب لطباعة باركوداتهم", "warning");
        return;
    }
    if (window.BarcodeSystem && BarcodeSystem.printStudentBadges) {
        BarcodeSystem.printStudentBadges(list, "مدرسة السادات الابتدائية بميت غمر");
    } else {
        const barcodeData = list.map(s => ({ name: s.name, nationalId: s.nationalId }));
        printAllBarcodes(barcodeData);
    }
}

document.addEventListener("DOMContentLoaded", function() {
    init();

    const searchInput = document.getElementById("studentSearch");
    if (searchInput) {
        searchInput.addEventListener("input", displayStudents);
    }

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeBarcodeModal();
    });
});
