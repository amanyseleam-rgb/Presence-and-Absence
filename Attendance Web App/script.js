/**
 * Attendance & Absence Management Script
 * Supporting Keyboard/USB Barcode Scanners, Camera Scanning, Multi-status (Present, Absent, Late, Excused),
 * Duplicate Prevention, Audio Feedback, and Session Finalization.
 */

let db;
let currentClassId = null;
let html5QrScanner = null;
let isCameraActive = false;
let hwScannerListener = null;

function openAttendance() {
    window.location.href = "attendance.html";
}

function initAttendance() {
    db = initDatabase();
    populateAttendanceGrades();

    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById("date");
    if (dateInput) dateInput.value = today;

    initHardwareScanner();
    checkSessionLockState();
}

function populateAttendanceGrades() {
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

function populateAttendanceClasses() {
    const gradeSelect = document.getElementById("gradeSelect");
    const classSelect = document.getElementById("classSelect");
    if (!classSelect) return;

    const gradeId = parseInt(gradeSelect.value);
    classSelect.innerHTML = '<option value="">اختر الفصل</option>';
    currentClassId = null;

    if (!gradeId) {
        displayAttendanceStudents();
        return;
    }

    const classes = getClassesByGrade(gradeId);
    classes.forEach(cls => {
        const option = document.createElement("option");
        option.value = cls.id;
        option.textContent = `فصل ${cls.name}`;
        classSelect.appendChild(option);
    });

    displayAttendanceStudents();
}

function getCurrentAttendanceStudents() {
    const classSelect = document.getElementById("classSelect");
    currentClassId = classSelect ? parseInt(classSelect.value) : null;

    if (currentClassId) {
        return getStudentsByClass(currentClassId);
    }

    const gradeSelect = document.getElementById("gradeSelect");
    const gradeId = gradeSelect ? parseInt(gradeSelect.value) : null;

    if (gradeId) {
        const allStudents = getAllStudentsWithClassInfo();
        return allStudents.filter(s => getGradeIdByClass(s.classId) === gradeId);
    }

    return [];
}

function getAttendanceKey(date, classId) {
    if (classId) {
        return "attendance_" + date + "_class_" + classId;
    }
    return "attendance_" + date;
}

function getSessionLockKey(date, classId) {
    return `attendance_session_locked_${date}_class_${classId}`;
}

function isCurrentSessionLocked() {
    const date = document.getElementById("date")?.value || "";
    if (!date || !currentClassId) return false;
    return localStorage.getItem(getSessionLockKey(date, currentClassId)) === "true";
}

function checkSessionLockState() {
    const isLocked = isCurrentSessionLocked();
    const badge = document.getElementById("sessionStatusBadge");
    const lockBtn = document.getElementById("btnLockSession");

    if (badge) {
        if (isLocked) {
            badge.textContent = "🔴 الجلسة معتمدة ومقفلة رسمياً";
            badge.style.background = "#fef2f2";
            badge.style.color = "#dc2626";
            if (lockBtn) lockBtn.textContent = "🔓 إلغاء قفل الجلسة";
        } else {
            badge.textContent = "🟢 الجلسة مفتوحة للرصد";
            badge.style.background = "#f0fdf4";
            badge.style.color = "#16a34a";
            if (lockBtn) lockBtn.textContent = "🔒 اعتماد وقفل الجلسة";
        }
    }
}

function toggleLockSession() {
    const date = document.getElementById("date")?.value || "";
    if (!currentClassId) {
        showToast("يرجى اختيار الفصل الدراسي أولاً", "warning");
        return;
    }

    const isLocked = isCurrentSessionLocked();
    if (!isLocked) {
        if (confirm("هل تريد اعتماد وقفل جلسة الحضور لهذا الفصل؟ لن يتمكن الماسح من تغيير السجلات دون فك القفل.")) {
            // Auto mark unscanned students as absent on finalization
            const rows = document.querySelectorAll("#studentsTable tr");
            let autoAbsents = 0;
            rows.forEach(r => {
                const statusCell = r.querySelector(".status");
                if (statusCell && statusCell.textContent.trim() === "لم يتم التسجيل") {
                    statusCell.textContent = "غائب";
                    statusCell.style.color = "#dc2626";
                    r.style.backgroundColor = "#fef2f2";
                    autoAbsents++;
                }
            });

            localStorage.setItem(getSessionLockKey(date, currentClassId), "true");
            saveAttendance(true);
            checkSessionLockState();
            updateStats();
            showToast(`✅ تم اعتماد وقفل الجلسة (تم تسجيل ${autoAbsents} غياب للطلاب غير المرصودين)`, "success");
        }
    } else {
        const session = getCurrentSession ? getCurrentSession() : null;
        if (session && session.role !== "admin") {
            showToast("فقط مدير النظام يمكنه إلغاء قفل جلسة معتمدة", "error");
            return;
        }
        localStorage.removeItem(getSessionLockKey(date, currentClassId));
        checkSessionLockState();
        showToast("تم فتح الجلسة للرصد من جديد", "info");
    }
}

function displayAttendanceStudents() {
    const table = document.getElementById("studentsTable");
    if (!table) return;

    table.innerHTML = "";
    const students = getCurrentAttendanceStudents();
    const date = document.getElementById("date")?.value || "";
    let savedData = null;

    if (date && currentClassId) {
        const saved = localStorage.getItem(getAttendanceKey(date, currentClassId));
        if (saved) {
            try { savedData = JSON.parse(saved); } catch(e) {}
        }
    }

    checkSessionLockState();

    const searchInput = document.getElementById("search");
    let filteredStudents = students;
    if (searchInput && searchInput.value.trim()) {
        const searchText = searchInput.value.trim().toLowerCase();
        filteredStudents = students.filter(s =>
            s.name.toLowerCase().includes(searchText) ||
            s.nationalId.includes(searchText)
        );
    }

    if (filteredStudents.length === 0) {
        table.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:#888;font-size:15px;">اختر الصف والفصل أولاً لعرض الطلاب</td></tr>';
        updateStats();
        return;
    }

    filteredStudents.forEach(function(student, index) {
        const row = document.createElement("tr");
        row.dataset.studentId = student.id;
        row.dataset.nationalId = student.nationalId;

        let status = "لم يتم التسجيل";
        let rowBg = "";
        let statusColor = "#64748b";

        if (savedData) {
            const record = savedData.find(r => r.nationalId === student.nationalId);
            if (record) {
                status = record.status;
                if (status === "حاضر") {
                    rowBg = "#f0fdf4";
                    statusColor = "#16a34a";
                } else if (status === "غائب") {
                    rowBg = "#fef2f2";
                    statusColor = "#dc2626";
                } else if (status === "متأخر") {
                    rowBg = "#fffbeb";
                    statusColor = "#d97706";
                } else if (status === "عذر مقبول") {
                    rowBg = "#eff6ff";
                    statusColor = "#2563eb";
                }
            }
        }

        row.style.backgroundColor = rowBg;

        const studentData = encodeURIComponent(JSON.stringify(student));

        row.innerHTML = `
            <td>${index + 1}</td>
            <td dir="ltr" style="font-family:monospace;font-size:13px;">${student.nationalId}</td>
            <td><strong>${student.name}</strong></td>
            <td class="status" style="color:${statusColor}; font-weight:bold;">${status}</td>
            <td>
                <button class="present-btn" style="padding:4px 8px; font-size:12px;" onclick="setStatus(this, 'حاضر')">حاضر</button>
                <button class="edit-btn" style="background:#f59e0b; padding:4px 8px; font-size:12px;" onclick="setStatus(this, 'متأخر')">متأخر</button>
                <button class="export-btn" style="background:#2563eb; padding:4px 8px; font-size:12px;" onclick="setStatus(this, 'عذر مقبول')">عذر</button>
                <button class="absent-btn" style="padding:4px 8px; font-size:12px;" onclick="setStatus(this, 'غائب')">غائب</button>
                <button class="barcode-btn" style="padding:4px 8px; font-size:12px;" onclick="showAttendanceBarcode('${studentData}')" title="عرض الباركود">🏷️</button>
            </td>
        `;

        table.appendChild(row);
    });

    updateStats();
}

function showAttendanceBarcode(studentDataStr) {
    try {
        const student = JSON.parse(decodeURIComponent(studentDataStr));
        openBarcodeModal(student);
    } catch (e) {
        console.error("Barcode modal error", e);
    }
}

function setStatus(button, newStatus) {
    if (isCurrentSessionLocked()) {
        showToast("الجلسة مقفلة ومعتمدة، لا يمكن التعديل المباشر", "warning");
        if (window.BarcodeSystem) BarcodeSystem.playSoundWarning();
        return;
    }

    const row = button.closest("tr");
    const statusCell = row.querySelector(".status");

    statusCell.textContent = newStatus;
    if (newStatus === "حاضر") {
        row.style.backgroundColor = "#f0fdf4";
        statusCell.style.color = "#16a34a";
    } else if (newStatus === "غائب") {
        row.style.backgroundColor = "#fef2f2";
        statusCell.style.color = "#dc2626";
    } else if (newStatus === "متأخر") {
        row.style.backgroundColor = "#fffbeb";
        statusCell.style.color = "#d97706";
    } else if (newStatus === "عذر مقبول") {
        row.style.backgroundColor = "#eff6ff";
        statusCell.style.color = "#2563eb";
    }

    updateStats();
    autoSaveCurrentClassAttendance();
}

function markPresent(button) { setStatus(button, "حاضر"); }
function markAbsent(button) { setStatus(button, "غائب"); }
function markLate(button) { setStatus(button, "متأخر"); }
function markExcused(button) { setStatus(button, "عذر مقبول"); }

function updateStats() {
    const rows = document.querySelectorAll("#studentsTable tr");

    let present = 0;
    let late = 0;
    let excused = 0;
    let absent = 0;
    let pending = 0;

    rows.forEach(function(row) {
        const status = row.querySelector(".status");
        if (!status) return;

        const val = status.textContent.trim();
        if (val === "حاضر") present++;
        else if (val === "متأخر") late++;
        else if (val === "عذر مقبول") excused++;
        else if (val === "غائب") absent++;
        else if (val === "لم يتم التسجيل") pending++;
    });

    const totalEl = document.getElementById("totalCount");
    const presentEl = document.getElementById("presentCount");
    const lateEl = document.getElementById("lateCount");
    const excusedEl = document.getElementById("excusedCount");
    const absentEl = document.getElementById("absentCount");
    const pendingEl = document.getElementById("pendingCount");

    if (totalEl) totalEl.textContent = present + late + excused + absent + pending;
    if (presentEl) presentEl.textContent = present;
    if (lateEl) lateEl.textContent = late;
    if (excusedEl) excusedEl.textContent = excused;
    if (absentEl) absentEl.textContent = absent;
    if (pendingEl) pendingEl.textContent = pending;
}

function autoSaveCurrentClassAttendance() {
    const date = document.getElementById("date")?.value;
    if (!date || !currentClassId) return;

    const rows = document.querySelectorAll("#studentsTable tr");
    const attendanceData = [];

    rows.forEach(function(row) {
        if (!row.dataset.nationalId) return;
        attendanceData.push({
            studentId: parseInt(row.dataset.studentId),
            nationalId: row.dataset.nationalId,
            name: row.cells[2].textContent.trim(),
            status: row.querySelector(".status").textContent.trim(),
            classId: currentClassId
        });
    });

    localStorage.setItem(getAttendanceKey(date, currentClassId), JSON.stringify(attendanceData));

    // Also sync to global date key attendance_YYYY-MM-DD for real-time portal lookup
    try {
        let globalData = [];
        const rawGlobal = localStorage.getItem("attendance_" + date);
        if (rawGlobal) {
            try { globalData = JSON.parse(rawGlobal) || []; } catch(e) {}
        }
        globalData = globalData.filter(r => r.classId !== currentClassId);
        globalData.push(...attendanceData);
        localStorage.setItem("attendance_" + date, JSON.stringify(globalData));
    } catch(e) {}
}

function saveAttendance(silent = false) {
    const date = document.getElementById("date").value;

    if (!date) {
        showToast("من فضلك اختر تاريخ الرصد أولاً", "warning");
        return;
    }

    if (!currentClassId) {
        showToast("من فضلك اختر الفصل أولاً", "warning");
        return;
    }

    autoSaveCurrentClassAttendance();

    if (!silent) {
        const clsName = getClassName(currentClassId);
        showToast("✅ تم حفظ رصد يوم " + date + " (" + clsName + ") بنجاح", "success");
    }
}

function loadAttendance() {
    displayAttendanceStudents();
}

function printAttendance() {
    const date = document.getElementById("date")?.value || new Date().toISOString().split('T')[0];
    const classId = currentClassId;
    if (!classId) {
        showToast("من فضلك اختر الفصل أولاً", "warning");
        return;
    }
    printSection("attendanceSection", `سجل الحضور - ${getClassName(classId)} - ${date}`);
}

function exportAttendanceExcel() {
    const date = document.getElementById("date")?.value || new Date().toISOString().split('T')[0];
    const rows = document.querySelectorAll("#studentsTable tr");
    const data = [];

    rows.forEach(function(row, idx) {
        if (!row.dataset.nationalId) return;
        data.push({
            "م": idx + 1,
            "كود الطالب": row.dataset.nationalId,
            "اسم الطالب": row.cells[2].textContent.trim(),
            "الحالة": row.querySelector(".status").textContent.trim(),
            "التاريخ": date,
            "الفصل": currentClassId ? getClassName(currentClassId) : ""
        });
    });

    if (data.length === 0) {
        showToast("لا توجد بيانات للتصدير", "warning");
        return;
    }

    exportToExcel(data, `سجل_الحضور_${date}`, "الحضور");
}

function printCurrentClassBarcodes() {
    const students = getCurrentAttendanceStudents();
    if (students.length === 0) {
        showToast("لا توجد طلاب في الفصل الحالي", "warning");
        return;
    }
    if (window.BarcodeSystem && BarcodeSystem.printStudentBadges) {
        BarcodeSystem.printStudentBadges(students, "مدرسة السادات الابتدائية بميت غمر");
    } else {
        const barcodeData = students.map(s => ({ name: s.name, nationalId: s.nationalId }));
        printAllBarcodes(barcodeData);
    }
}

// ============================================================================
// مسح الباركود السريع (Hardware USB/Bluetooth Scanner & Camera Integration)
// ============================================================================
function initHardwareScanner() {
    if (window.BarcodeSystem && BarcodeSystem.HardwareScannerListener) {
        hwScannerListener = new BarcodeSystem.HardwareScannerListener((scannedCode) => {
            processBarcodeScanInput(scannedCode, "hardware");
        }, { minBarcodeLength: 4 });
        hwScannerListener.start();
    }
}

function handleManualScannerKey(event) {
    if (event.key === "Enter" || event.keyCode === 13) {
        event.preventDefault();
        submitManualScan();
    }
}

function submitManualScan() {
    const input = document.getElementById("hwBarcodeInput");
    if (!input) return;
    const code = input.value.trim();
    if (!code) return;
    processBarcodeScanInput(code, "manual_input");
    input.value = "";
    input.focus();
}

function processBarcodeScanInput(studentCode, method = "hardware") {
    studentCode = String(studentCode).trim();
    const resultMsg = document.getElementById("scan-result");

    // Lookup student in database
    const student = findStudentByNationalId(studentCode) || findStudentByName(studentCode);

    if (!student) {
        if (window.BarcodeSystem) BarcodeSystem.playSoundError();
        if (resultMsg) {
            resultMsg.style.color = "#dc2626";
            resultMsg.style.background = "#fef2f2";
            resultMsg.textContent = `❌ كود غير مسجل: (${studentCode})`;
        }
        return;
    }

    // ── AUTO-CLASS DETECTION & SEAMLESS SWITCHING ────────────────────────────
    // If no class is pre-selected OR scanned student belongs to another class:
    // Automatically switch to the student's class and load their roster instantly.
    if (student.classId !== currentClassId) {
        if (currentClassId) {
            autoSaveCurrentClassAttendance();
        }
        currentClassId = student.classId;

        try {
            const db = initDatabase ? initDatabase() : null;
            if (db) {
                const cls = db.classes.find(c => c.id === student.classId);
                if (cls) {
                    const gradeSelect = document.getElementById("gradeSelect");
                    const classSelect = document.getElementById("classSelect");
                    if (gradeSelect) gradeSelect.value = cls.gradeId;
                    if (classSelect) {
                        const classes = getClassesByGrade(cls.gradeId);
                        classSelect.innerHTML = '<option value="">اختر الفصل</option>';
                        classes.forEach(c => {
                            const opt = document.createElement("option");
                            opt.value = c.id;
                            opt.textContent = `فصل ${c.name}`;
                            classSelect.appendChild(opt);
                        });
                        classSelect.value = student.classId;
                    }
                    displayAttendanceStudents();
                }
            }
        } catch(e) { /* silent fallback */ }
    }
    // ─────────────────────────────────────────────────────────────────────────

    if (isCurrentSessionLocked()) {
        if (window.BarcodeSystem) BarcodeSystem.playSoundError();
        if (resultMsg) {
            resultMsg.style.color = "#dc2626";
            resultMsg.style.background = "#fef2f2";
            resultMsg.textContent = `🔒 تنبيه: جلسة ${getClassName(student.classId)} معتمدة ومقفلة رسمياً، فك القفل أولاً`;
        }
        return;
    }

    // Locate student in table (retry after displayAttendanceStudents if table was empty)
    let rows = document.querySelectorAll("#studentsTable tr");
    let matchedRow = null;

    rows.forEach(r => {
        if (r.dataset.nationalId === student.nationalId) {
            matchedRow = r;
        }
    });

    // If still not found after auto-loading class, show helpful message
    if (!matchedRow) {
        if (window.BarcodeSystem) BarcodeSystem.playSoundWarning();
        if (resultMsg) {
            resultMsg.style.color = "#d97706";
            resultMsg.style.background = "#fffbeb";
            resultMsg.textContent = `⚠️ الطالب: ${student.name} غير موجود في القائمة المعروضة حالياً!`;
        }
        return;
    }

    const statusCell = matchedRow.querySelector(".status");
    const currentStatus = statusCell.textContent.trim();

    // Check for duplicate scan
    if (currentStatus === "حاضر") {
        if (window.BarcodeSystem) BarcodeSystem.playSoundWarning();
        if (resultMsg) {
            resultMsg.style.color = "#d97706";
            resultMsg.style.background = "#fffbeb";
            resultMsg.textContent = `⚠️ تكرار: الطالب ${student.name} مسجل حاضر بالفعل مسبقاً!`;
        }
        return;
    }

    // Mark Present
    matchedRow.style.backgroundColor = "#f0fdf4";
    statusCell.textContent = "حاضر";
    statusCell.style.color = "#16a34a";

    if (window.BarcodeSystem) BarcodeSystem.playSoundSuccess();

    if (resultMsg) {
        resultMsg.style.color = "#16a34a";
        resultMsg.style.background = "#f0fdf4";
        resultMsg.textContent = `✅ تم رصد الحضور: ${student.name} (${student.nationalId})`;
    }

    updateStats();
    autoSaveCurrentClassAttendance();

    // Keep input focused
    const input = document.getElementById("hwBarcodeInput");
    if (input) input.focus();
}

function toggleCameraScanner() {
    const readerDiv = document.getElementById("reader");
    const btn = document.getElementById("btnToggleCam");
    if (!readerDiv) return;

    if (!isCameraActive) {
        readerDiv.style.display = "block";
        btn.textContent = "⏹️ إيقاف الكاميرا";
        startCameraScanner();
        isCameraActive = true;
    } else {
        stopCameraScanner();
        readerDiv.style.display = "none";
        btn.textContent = "📷 تشغيل الكاميرا";
        isCameraActive = false;
    }
}

function startCameraScanner() {
    if (!window.Html5Qrcode) return;

    html5QrScanner = new Html5Qrcode("reader");
    html5QrScanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
            processBarcodeScanInput(decodedText.trim(), "camera");
        },
        (error) => {}
    ).catch(err => {
        showToast("تعذر الوصول للكاميرا: " + (err.message || err), "error");
        toggleCameraScanner();
    });
}

function stopCameraScanner() {
    if (html5QrScanner) {
        html5QrScanner.stop().then(() => {
            html5QrScanner.clear();
            html5QrScanner = null;
        }).catch(() => {});
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initAttendance();

    const searchInput = document.getElementById("search");
    if (searchInput) {
        searchInput.addEventListener("input", displayAttendanceStudents);
    }

    const dateInput = document.getElementById("date");
    if (dateInput) {
        dateInput.addEventListener("change", loadAttendance);
    }

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeBarcodeModal();
    });
});
