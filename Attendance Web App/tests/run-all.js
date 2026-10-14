/**
 * Master Automated Test Runner for School Management System
 * Executes all component test suites and outputs a consolidated test report.
 */

const testDbIntegrity = require("./test-db-integrity.js");
const testSecurity = require("./test-security.js");
const testEgyptianGrading = require("./test-egyptian-grading.js");
const testAttendance = require("./test-attendance.js");
const testBarcode = require("./test-barcode.js");

function runAll() {
    console.log("===============================================================");
    console.log("   مدرسة السادات الابتدائية بميت غمر - محافظة الدقهلية");
    console.log("   AUTOMATED SYSTEM VERIFICATION & TEST SUITE RUNNER");
    console.log("===============================================================");

    const startTime = Date.now();
    const suites = [
        testDbIntegrity,
        testSecurity,
        testEgyptianGrading,
        testAttendance,
        testBarcode
    ];

    const results = [];
    let totalPassed = 0;
    let totalFailed = 0;

    suites.forEach(suiteFn => {
        try {
            const res = suiteFn();
            results.push(res);
            totalPassed += res.passed;
            totalFailed += res.failed;
        } catch (err) {
            console.error(`Suite execution crashed:`, err);
            results.push({ suite: "UNKNOWN", passed: 0, failed: 1 });
            totalFailed += 1;
        }
    });

    const elapsed = Date.now() - startTime;

    console.log("\n===============================================================");
    console.log("                      TEST RESULTS SUMMARY                     ");
    console.log("===============================================================");
    console.log(
        "SUITE NAME".padEnd(42) +
        "PASSED".padStart(8) +
        "FAILED".padStart(8) +
        "STATUS".padStart(10)
    );
    console.log("-".repeat(68));

    results.forEach(r => {
        const status = r.failed === 0 ? "PASSED ✓" : "FAILED ✗";
        console.log(
            r.suite.padEnd(42) +
            String(r.passed).padStart(8) +
            String(r.failed).padStart(8) +
            status.padStart(10)
        );
    });

    console.log("-".repeat(68));
    console.log(
        "TOTAL".padEnd(42) +
        String(totalPassed).padStart(8) +
        String(totalFailed).padStart(8) +
        (totalFailed === 0 ? "100% OK ✓" : "FAILED ✗").padStart(10)
    );
    console.log(`Execution completed in ${elapsed} ms`);
    console.log("===============================================================\n");

    if (totalFailed > 0) {
        console.error(`💥 TEST SUITE FAILED with ${totalFailed} errors.`);
        process.exit(1);
    } else {
        console.log("🎉 ALL TESTS PASSED SUCCESSFULLY! SYSTEM IS PRODUCTION READY.");
        process.exit(0);
    }
}

if (require.main === module) {
    runAll();
}

module.exports = runAll;
