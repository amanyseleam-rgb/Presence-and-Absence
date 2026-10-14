/**
 * Core Attendance & Absence Management Engine
 * Handles attendance sessions, multi-status tracking (Present, Absent, Late, Excused),
 * duplicate prevention, wrong-class validation, and session finalization with audit logs.
 * Compatible with Browser and Node.js
 */

(function (global) {
    "use strict";

    const STATUS = {
        PRESENT: "حاضر",
        ABSENT: "غائب",
        LATE: "متأخر",
        EXCUSED: "عذر مقبول",
        PENDING: "لم يتم التسجيل"
    };

    /**
     * Generate standard session ID key
     */
    function getSessionKey(date, classId, sessionType = "morning") {
        return `att_session_${date}_class_${classId}_${sessionType}`;
    }

    /**
     * Process a barcode scan for attendance
     * @param {Object} options
     *   - student: student record
     *   - targetClassId: currently selected class ID
     *   - sessionRecords: map or array of current session records
     *   - isFinalized: boolean flag if session is locked
     *   - operator: user performing the scan
     *   - scanMethod: 'hardware' | 'camera'
     *   - markStatus: default STATUS.PRESENT or STATUS.LATE
     */
    function processBarcodeScan(options) {
        const {
            student,
            targetClassId,
            existingRecords = [],
            isFinalized = false,
            operator = { username: "scanner", name: "ماسح الباركود" },
            scanMethod = "hardware",
            markStatus = STATUS.PRESENT
        } = options;

        if (!student) {
            return {
                success: false,
                code: "NOT_FOUND",
                message: "كود الباركود غير مسجل في قاعدة بيانات المدرسة",
                tone: "error"
            };
        }

        // Check if session is finalized and locked
        if (isFinalized) {
            return {
                success: false,
                code: "SESSION_LOCKED",
                message: "لا يمكن المسح: جلسة الحضور لهذا الفصل معتمدة ومقفلة رسمياً",
                tone: "error",
                student: student
            };
        }

        // Check if student belongs to the active class
        if (targetClassId && parseInt(student.classId) !== parseInt(targetClassId)) {
            return {
                success: false,
                code: "WRONG_CLASS",
                message: `تنبيه: الطالب ${student.name} مقيد في فصل آخر وليس في هذا الفصل`,
                tone: "warning",
                student: student,
                actualClassId: student.classId
            };
        }

        // Check if student was already registered in this session
        const existingRecord = existingRecords.find(r =>
            String(r.nationalId) === String(student.nationalId) ||
            parseInt(r.studentId) === parseInt(student.id)
        );

        if (existingRecord && existingRecord.status !== STATUS.PENDING) {
            return {
                success: false,
                code: "DUPLICATE_SCAN",
                message: `تكرار: تم تسجيل حضور الطالب ${student.name} مسبقاً (${existingRecord.status}) في ${new Date(existingRecord.timestamp).toLocaleTimeString('ar-EG')}`,
                tone: "warning",
                student: student,
                existingRecord: existingRecord
            };
        }

        // Valid new attendance record
        const now = new Date().toISOString();
        const record = {
            studentId: student.id,
            nationalId: student.nationalId,
            name: student.name,
            classId: student.classId,
            status: markStatus,
            timestamp: now,
            recordedBy: operator.username || "scanner",
            method: scanMethod,
            history: [
                {
                    from: existingRecord ? existingRecord.status : STATUS.PENDING,
                    to: markStatus,
                    timestamp: now,
                    by: operator.username || "scanner"
                }
            ]
        };

        return {
            success: true,
            code: "SUCCESS",
            message: `✅ تم تسجيل ${markStatus}: ${student.name}`,
            tone: "success",
            student: student,
            record: record
        };
    }

    /**
     * Apply manual correction to a student's attendance with required audit trail
     */
    function applyManualCorrection(existingRecord, newStatus, operator, reason) {
        if (!existingRecord) return null;
        const now = new Date().toISOString();
        const previousStatus = existingRecord.status;

        const updated = Object.assign({}, existingRecord, {
            status: newStatus,
            lastModified: now,
            modifiedBy: operator ? operator.username : "system",
            correctionReason: reason || "تعديل يدوي من المشرف",
            history: (existingRecord.history || []).concat([
                {
                    from: previousStatus,
                    to: newStatus,
                    timestamp: now,
                    by: operator ? operator.username : "system",
                    reason: reason || "تعديل يدوي"
                }
            ])
        });

        return updated;
    }

    /**
     * Compute session summary counts
     */
    function calculateSessionStats(students, records) {
        const total = students.length;
        let present = 0;
        let absent = 0;
        let late = 0;
        let excused = 0;

        const recordMap = {};
        (records || []).forEach(r => {
            recordMap[r.nationalId] = r;
            if (r.status === STATUS.PRESENT) present++;
            else if (r.status === STATUS.ABSENT) absent++;
            else if (r.status === STATUS.LATE) late++;
            else if (r.status === STATUS.EXCUSED) excused++;
        });

        const pending = Math.max(0, total - (present + absent + late + excused));
        const attendanceRate = total > 0 ? (((present + late) / total) * 100) : 0;

        return {
            total,
            present,
            absent,
            late,
            excused,
            pending,
            attendanceRate: Math.round(attendanceRate * 10) / 10
        };
    }

    const AttendanceEngine = {
        STATUS,
        getSessionKey,
        processBarcodeScan,
        applyManualCorrection,
        calculateSessionStats
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = AttendanceEngine;
    } else {
        global.AttendanceEngine = AttendanceEngine;
    }
})(typeof window !== "undefined" ? window : global);
