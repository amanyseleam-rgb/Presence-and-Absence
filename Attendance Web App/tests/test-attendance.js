/**
 * Automated Test Suite: Attendance & Absence Management Engine
 * Tests barcode scanning workflow, duplicate scan rejection, wrong-class validation,
 * session lock protection, manual corrections, and statistics aggregation.
 */

const assert = require("assert");
const AttendanceEngine = require("../core/attendance.js");

function run() {
    console.log("\n--- [4] Attendance & Scanner Engine Test Suite ---");
    let passed = 0;
    let failed = 0;

    function test(name, fn) {
        try {
            fn();
            console.log(`  ✓ ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ✗ ${name}`);
            console.error(`    ${err.message}`);
            failed++;
        }
    }

    const mockStudent = {
        id: 10,
        nationalId: "123456789",
        name: "محمد أحمد علي",
        classId: 1
    };

    test("Rejects unknown student barcode with NOT_FOUND error", () => {
        const result = AttendanceEngine.processBarcodeScan({
            student: null,
            targetClassId: 1
        });
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.code, "NOT_FOUND");
        assert.strictEqual(result.tone, "error");
    });

    test("Rejects barcode scan when attendance session is locked/finalized", () => {
        const result = AttendanceEngine.processBarcodeScan({
            student: mockStudent,
            targetClassId: 1,
            isFinalized: true
        });
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.code, "SESSION_LOCKED");
        assert.strictEqual(result.tone, "error");
    });

    test("Detects student belonging to a different class with WRONG_CLASS warning", () => {
        const result = AttendanceEngine.processBarcodeScan({
            student: mockStudent, // classId is 1
            targetClassId: 2,     // scanning for class 2
            existingRecords: []
        });
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.code, "WRONG_CLASS");
        assert.strictEqual(result.tone, "warning");
        assert.strictEqual(result.actualClassId, 1);
    });

    test("Registers valid scan successfully with PRESENT status and operator audit", () => {
        const result = AttendanceEngine.processBarcodeScan({
            student: mockStudent,
            targetClassId: 1,
            existingRecords: [],
            operator: { username: "scanner_operator_1" },
            scanMethod: "hardware"
        });
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.code, "SUCCESS");
        assert.strictEqual(result.tone, "success");
        assert.ok(result.record, "Must generate attendance record");
        assert.strictEqual(result.record.status, AttendanceEngine.STATUS.PRESENT);
        assert.strictEqual(result.record.nationalId, mockStudent.nationalId);
        assert.strictEqual(result.record.recordedBy, "scanner_operator_1");
        assert.strictEqual(result.record.method, "hardware");
        assert.ok(Array.isArray(result.record.history), "Must include history trail");
    });

    test("Prevents duplicate scan in the same session with DUPLICATE_SCAN warning", () => {
        const existingRecords = [
            {
                studentId: mockStudent.id,
                nationalId: mockStudent.nationalId,
                status: AttendanceEngine.STATUS.PRESENT,
                timestamp: new Date().toISOString()
            }
        ];

        const result = AttendanceEngine.processBarcodeScan({
            student: mockStudent,
            targetClassId: 1,
            existingRecords: existingRecords
        });
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.code, "DUPLICATE_SCAN");
        assert.strictEqual(result.tone, "warning");
    });

    test("Supports marking LATE (متأخر) scan", () => {
        const result = AttendanceEngine.processBarcodeScan({
            student: mockStudent,
            targetClassId: 1,
            existingRecords: [],
            markStatus: AttendanceEngine.STATUS.LATE
        });
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.record.status, AttendanceEngine.STATUS.LATE);
    });

    test("applyManualCorrection updates status with auditable reason and history", () => {
        const initialRecord = {
            studentId: 10,
            nationalId: "123456789",
            status: AttendanceEngine.STATUS.ABSENT,
            history: [{ from: "لم يتم التسجيل", to: "غائب", timestamp: new Date().toISOString() }]
        };

        const updated = AttendanceEngine.applyManualCorrection(
            initialRecord,
            AttendanceEngine.STATUS.EXCUSED,
            { username: "admin_user" },
            "تقديم تقرير طبي معتمد"
        );

        assert.strictEqual(updated.status, AttendanceEngine.STATUS.EXCUSED);
        assert.strictEqual(updated.modifiedBy, "admin_user");
        assert.strictEqual(updated.correctionReason, "تقديم تقرير طبي معتمد");
        assert.strictEqual(updated.history.length, 2);
        assert.strictEqual(updated.history[1].from, AttendanceEngine.STATUS.ABSENT);
        assert.strictEqual(updated.history[1].to, AttendanceEngine.STATUS.EXCUSED);
    });

    test("calculateSessionStats accurately tallies statuses and computes attendance rate", () => {
        const mockClassStudents = [
            { id: 1, nationalId: "001" },
            { id: 2, nationalId: "002" },
            { id: 3, nationalId: "003" },
            { id: 4, nationalId: "004" },
            { id: 5, nationalId: "005" }
        ];

        const mockRecords = [
            { nationalId: "001", status: AttendanceEngine.STATUS.PRESENT },
            { nationalId: "002", status: AttendanceEngine.STATUS.PRESENT },
            { nationalId: "003", status: AttendanceEngine.STATUS.LATE },
            { nationalId: "004", status: AttendanceEngine.STATUS.ABSENT },
            { nationalId: "005", status: AttendanceEngine.STATUS.EXCUSED }
        ];

        const stats = AttendanceEngine.calculateSessionStats(mockClassStudents, mockRecords);
        assert.strictEqual(stats.total, 5);
        assert.strictEqual(stats.present, 2);
        assert.strictEqual(stats.late, 1);
        assert.strictEqual(stats.absent, 1);
        assert.strictEqual(stats.excused, 1);
        assert.strictEqual(stats.pending, 0);
        // (2 present + 1 late) / 5 = 60%
        assert.strictEqual(stats.attendanceRate, 60);
    });

    return { suite: "Attendance & Scanner Engine", passed, failed };
}

if (require.main === module) {
    const res = run();
    process.exit(res.failed > 0 ? 1 : 0);
}

module.exports = run;
