/**
 * Automated Test Suite: Egyptian Primary Stage Academic & Grading Engine
 *
 * ACTUAL core/egyptian-grading.js API:
 *   - DEFAULT_PRIMARY_POLICY.categories (array of category objects with .id, .weightPct, .defaultMaxMarks)
 *     Categories: month1 (15), month2 (15), tasks (10), notebook (5), attendance (5), finalExam (50)
 *   - calculateSubjectResult(subjectMaxScore, rawComponents, customPolicy?)
 *     rawComponents is an object with keys matching category IDs: { month1, month2, tasks, notebook, attendance, finalExam }
 *     Returns: { mode, totalScore, maxScore, percentage, colorBand, passed, breakdown, explanation }
 *   - calculateTermSummary(subjectResults[]) → { totalScore, maxTotalScore, percentage, colorBand, passedAll, failingSubjects }
 *   - getColorBand(percentage) → { code, name, label, minPct, maxPct, ... }
 *   - COLOR_BANDS: { BLUE, GREEN, YELLOW, RED }
 */

const assert = require("assert");
const EgyptianGrading = require("../core/egyptian-grading.js");

function run() {
    console.log("\n--- [3] Egyptian Grading System Test Suite ---");
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

    test("DEFAULT_PRIMARY_POLICY has 6 categories totaling 100 weight points", () => {
        const policy = EgyptianGrading.DEFAULT_PRIMARY_POLICY;
        assert.ok(policy, "DEFAULT_PRIMARY_POLICY must exist");
        assert.ok(Array.isArray(policy.categories), "Policy must have categories array");
        assert.strictEqual(policy.categories.length, 6, "Must have exactly 6 assessment categories");

        const totalWeight = policy.categories.reduce((sum, cat) => sum + cat.weightPct, 0);
        assert.strictEqual(totalWeight, 100, `Category weights must sum to 100, got ${totalWeight}`);

        // Validate specific category weights per Ministerial decree (6 inputs auto-sum to 100)
        const findCat = (id) => policy.categories.find(c => c.id === id);
        assert.strictEqual(findCat("exam").weightPct, 50, "Exam must be 50 marks");
        assert.strictEqual(findCat("homework").weightPct, 5, "Homework must be 5 marks");
        assert.strictEqual(findCat("participation").weightPct, 5, "Participation must be 5 marks");
        assert.strictEqual(findCat("behavior").weightPct, 10, "Behavior must be 10 marks");
        assert.strictEqual(findCat("practical").weightPct, 15, "Practical must be 15 marks");
        assert.strictEqual(findCat("oral").weightPct, 15, "Oral must be 15 marks");
        assert.strictEqual(policy.passingThresholdPct, 50, "Passing threshold must be 50%");
    });

    test("Color band boundaries follow Ministry specifications strictly", () => {
        const { getColorBand, COLOR_BANDS } = EgyptianGrading;

        // Blue: 85% – 100%
        assert.strictEqual(getColorBand(100).code, COLOR_BANDS.BLUE.code);
        assert.strictEqual(getColorBand(92.5).code, COLOR_BANDS.BLUE.code);
        assert.strictEqual(getColorBand(85.0).code, COLOR_BANDS.BLUE.code);

        // Green: 65% – 84.9%
        assert.strictEqual(getColorBand(84.9).code, COLOR_BANDS.GREEN.code);
        assert.strictEqual(getColorBand(75.0).code, COLOR_BANDS.GREEN.code);
        assert.strictEqual(getColorBand(65.0).code, COLOR_BANDS.GREEN.code);

        // Yellow: 50% – 64.9%
        assert.strictEqual(getColorBand(64.9).code, COLOR_BANDS.YELLOW.code);
        assert.strictEqual(getColorBand(57.0).code, COLOR_BANDS.YELLOW.code);
        assert.strictEqual(getColorBand(50.0).code, COLOR_BANDS.YELLOW.code);

        // Red: 0% – 49.9%
        assert.strictEqual(getColorBand(49.9).code, COLOR_BANDS.RED.code);
        assert.strictEqual(getColorBand(30.0).code, COLOR_BANDS.RED.code);
        assert.strictEqual(getColorBand(0).code, COLOR_BANDS.RED.code);
    });

    test("calculateSubjectResult with 6 monthly categories evaluates high-performing student correctly", () => {
        // exam: 48/50, homework: 5/5, participation: 5/5, behavior: 10/10, practical: 14/15, oral: 14/15
        // Total = 96/100 → Blue, passed
        const components = {
            exam: 48,
            homework: 5,
            participation: 5,
            behavior: 10,
            practical: 14,
            oral: 14
        };
        const result = EgyptianGrading.calculateSubjectResult(100, components);
        assert.strictEqual(result.totalScore, 96,
            `Expected total 96, got ${result.totalScore}`);
        assert.strictEqual(result.maxScore, 100);
        assert.strictEqual(result.percentage, 96);
        assert.strictEqual(result.passed, true);
        assert.strictEqual(result.colorBand.code, EgyptianGrading.COLOR_BANDS.BLUE.code);
        assert.ok(Array.isArray(result.breakdown) && result.breakdown.length === 6,
            "Must include 6 breakdown entries");
    });

    test("calculateSubjectResult identifies failing student (<50%, Red band)", () => {
        // exam: 15/50, homework: 2/5, participation: 2/5, behavior: 4/10, practical: 5/15, oral: 5/15
        // Total = 33/100 → Red, failed
        const components = {
            exam: 15,
            homework: 2,
            participation: 2,
            behavior: 4,
            practical: 5,
            oral: 5
        };
        const result = EgyptianGrading.calculateSubjectResult(100, components);
        assert.strictEqual(result.totalScore, 33);
        assert.strictEqual(result.percentage, 33);
        assert.strictEqual(result.passed, false);
        assert.strictEqual(result.colorBand.code, EgyptianGrading.COLOR_BANDS.RED.code);
    });

    test("calculateSubjectResult handles direct score (legacy mode)", () => {
        // Direct number input → mode:direct
        const result = EgyptianGrading.calculateSubjectResult(100, 75);
        assert.strictEqual(result.mode, "direct");
        assert.strictEqual(result.totalScore, 75);
        assert.strictEqual(result.percentage, 75);
        assert.strictEqual(result.passed, true);
        assert.strictEqual(result.colorBand.code, EgyptianGrading.COLOR_BANDS.GREEN.code);
    });

    test("calculateSubjectResult boundary: exactly 50% is passing (Yellow)", () => {
        // 50/100 direct → should be exactly Yellow and passing
        const result = EgyptianGrading.calculateSubjectResult(100, 50);
        assert.strictEqual(result.totalScore, 50);
        assert.strictEqual(result.passed, true, "50% must be passing (threshold is 50%)");
        assert.strictEqual(result.colorBand.code, EgyptianGrading.COLOR_BANDS.YELLOW.code);
    });

    test("calculateSubjectResult boundary: 49% is failing (Red)", () => {
        const result = EgyptianGrading.calculateSubjectResult(100, 49);
        assert.strictEqual(result.passed, false, "49% must be failing");
        assert.strictEqual(result.colorBand.code, EgyptianGrading.COLOR_BANDS.RED.code);
    });

    test("calculateTermSummary aggregates multiple subjects, identifies failing subjects", () => {
        const subjects = [
            { subjectName: "اللغة العربية", totalScore: 88, maxScore: 100, passed: true },
            { subjectName: "الرياضيات", totalScore: 92, maxScore: 100, passed: true },
            { subjectName: "العلوم", totalScore: 45, maxScore: 100, passed: false },
            { subjectName: "اللغة الإنجليزية", totalScore: 75, maxScore: 100, passed: true }
        ];

        const summary = EgyptianGrading.calculateTermSummary(subjects);
        assert.strictEqual(summary.totalScore, 300, "Total must sum to 300");
        assert.strictEqual(summary.maxTotalScore, 400);
        assert.strictEqual(summary.percentage, 75);
        assert.strictEqual(summary.colorBand.code, EgyptianGrading.COLOR_BANDS.GREEN.code);
        assert.strictEqual(summary.passedAll, false, "passedAll must be false when one fails");
        assert.strictEqual(summary.failingSubjects.length, 1);
        assert.strictEqual(summary.failingSubjects[0], "العلوم");
    });

    test("calculateTermSummary handles empty subject list gracefully", () => {
        const summary = EgyptianGrading.calculateTermSummary([]);
        assert.strictEqual(summary.totalScore, 0);
        assert.strictEqual(summary.passedAll, false);
        assert.strictEqual(summary.colorBand.code, EgyptianGrading.COLOR_BANDS.RED.code);
    });

    return { suite: "Egyptian Grading System", passed, failed };
}

if (require.main === module) {
    const res = run();
    process.exit(res.failed > 0 ? 1 : 0);
}

module.exports = run;
