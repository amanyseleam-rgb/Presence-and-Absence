/**
 * Egyptian School Academic & Grading System Rules Engine
 * Implements the official assessment framework for Egyptian Primary Education
 * (القرار الوزاري المنظم للتقييم والدراسة لصفوف المرحلة الابتدائية)
 * Compatible with Browser and Node.js
 */

(function (global) {
    "use strict";

    // Egyptian Color Bands (نظام الألوان المعتمد للمرحلة الابتدائية)
    const COLOR_BANDS = {
        BLUE: {
            code: "blue",
            name: "الأزرق",
            label: "فاق التوقعات (ممتاز)",
            minPct: 85,
            maxPct: 100,
            colorHex: "#2563eb",
            bgHex: "#eff6ff",
            description: "يوضح أن المتعلم قد فاق التوقعات في اكتساب المعارف والمهارات المطلوبة"
        },
        GREEN: {
            code: "green",
            name: "الأخضر",
            label: "امتلك المعارف والمهارات (جيد جداً)",
            minPct: 65,
            maxPct: 84.99,
            colorHex: "#16a34a",
            bgHex: "#f0fdf4",
            description: "يوضح أن المتعلم قد امتلك المعارف والمهارات المطلوبة"
        },
        YELLOW: {
            code: "yellow",
            name: "الأصفر",
            label: "بحاجة إلى بعض الدعم (مقبول)",
            minPct: 50,
            maxPct: 64.99,
            colorHex: "#ca8a04",
            bgHex: "#fefce8",
            description: "يوضح أن المتعلم بحاجة إلى بعض الدعم لاكتساب المعارف والمهارات"
        },
        RED: {
            code: "red",
            name: "الأحمر",
            label: "لم يجتز (يحتاج إلى دعم كبير)",
            minPct: 0,
            maxPct: 49.99,
            colorHex: "#dc2626",
            bgHex: "#fef2f2",
            description: "يوضح أن المتعلم لم يمتلك هذه المعارف والمهارات ويحتاج إلى دعم كبير"
        }
    };

    // 6 Egyptian monthly evaluation categories (Total = 100)
    const MONTHLY_CATEGORIES = [
        {
            id: "exam",
            name: "امتحان الشهر",
            shortName: "امتحان",
            weightPct: 50,
            defaultMaxMarks: 50,
            required: true
        },
        {
            id: "homework",
            name: "كشكول الواجب",
            shortName: "واجب",
            weightPct: 5,
            defaultMaxMarks: 5,
            required: true
        },
        {
            id: "participation",
            name: "المشاركة الصفية",
            shortName: "مشاركة",
            weightPct: 5,
            defaultMaxMarks: 5,
            required: true
        },
        {
            id: "behavior",
            name: "السلوك والمواظبة",
            shortName: "سلوك",
            weightPct: 10,
            defaultMaxMarks: 10,
            required: true
        },
        {
            id: "practical",
            name: "التقييم العملي والمهام",
            shortName: "عملي",
            weightPct: 15,
            defaultMaxMarks: 15,
            required: true
        },
        {
            id: "oral",
            name: "الشفوي والتفاعل",
            shortName: "شفوي",
            weightPct: 15,
            defaultMaxMarks: 15,
            required: true
        }
    ];

    // Default assessment categories for Primary Education (Total 100 marks)
    const DEFAULT_PRIMARY_POLICY = {
        stage: "primary",
        stageName: "المرحلة الابتدائية",
        passingThresholdPct: 50.0,
        roundingDecimals: 1,
        categories: MONTHLY_CATEGORIES
    };

    /**
     * Map percentage to Egyptian Color Band
     */
    function getColorBand(percentage) {
        const pct = Math.max(0, Math.min(100, parseFloat(percentage) || 0));
        if (pct >= COLOR_BANDS.BLUE.minPct) return COLOR_BANDS.BLUE;
        if (pct >= COLOR_BANDS.GREEN.minPct) return COLOR_BANDS.GREEN;
        if (pct >= COLOR_BANDS.YELLOW.minPct) return COLOR_BANDS.YELLOW;
        return COLOR_BANDS.RED;
    }

    /**
     * Calculate subject result with full traceability
     * Supports both detailed component breakdown and simple total input for backward compatibility
     */
    function calculateSubjectResult(subjectMaxScore, rawComponents, customPolicy) {
        const policy = customPolicy || DEFAULT_PRIMARY_POLICY;
        const maxScore = parseFloat(subjectMaxScore) || 100;
        const decimals = policy.roundingDecimals !== undefined ? policy.roundingDecimals : 1;
        const factor = Math.pow(10, decimals);

        // If raw components is just a single number (e.g. legacy total score)
        if (typeof rawComponents === "number" || typeof rawComponents === "string") {
            const raw = Math.max(0, Math.min(maxScore, parseFloat(rawComponents) || 0));
            const percentage = maxScore > 0 ? (raw / maxScore) * 100 : 0;
            const roundedPct = Math.round(percentage * factor) / factor;
            const colorBand = getColorBand(roundedPct);
            const passed = roundedPct >= policy.passingThresholdPct;

            return {
                mode: "direct",
                rawScore: raw,
                maxScore: maxScore,
                totalScore: Math.round(raw * factor) / factor,
                percentage: roundedPct,
                colorBand: colorBand,
                passed: passed,
                explanation: `درجة مباشرة: ${raw} من ${maxScore} (${roundedPct}%) - التقييم: ${colorBand.label}`,
                breakdown: []
            };
        }

        // Detailed assessment component calculation
        const components = rawComponents || {};
        let totalWeightedScore = 0;
        let totalMaxWeight = 0;
        const breakdown = [];

        policy.categories.forEach(cat => {
            const rawVal = components[cat.id];
            const maxVal = cat.defaultMaxMarks;
            let earned = 0;
            let hasScore = false;

            if (rawVal !== undefined && rawVal !== null && rawVal !== "") {
                earned = Math.max(0, Math.min(maxVal, parseFloat(rawVal) || 0));
                hasScore = true;
            }

            // Scale to category weight if subject max score is not 100
            const scaleRatio = maxScore / 100.0;
            const categoryWeight = cat.weightPct * scaleRatio;
            const weightedContribution = hasScore ? (earned / maxVal) * categoryWeight : 0;

            totalWeightedScore += weightedContribution;
            totalMaxWeight += categoryWeight;

            breakdown.push({
                categoryId: cat.id,
                categoryName: cat.name,
                shortName: cat.shortName,
                rawEarned: earned,
                maxRaw: maxVal,
                hasScore: hasScore,
                weightedContribution: Math.round(weightedContribution * factor) / factor,
                maxWeightedContribution: Math.round(categoryWeight * factor) / factor
            });
        });

        const roundedTotal = Math.round(totalWeightedScore * factor) / factor;
        const percentage = maxScore > 0 ? (roundedTotal / maxScore) * 100 : 0;
        const roundedPct = Math.round(percentage * factor) / factor;
        const colorBand = getColorBand(roundedPct);
        const passed = roundedPct >= policy.passingThresholdPct;

        return {
            mode: "detailed",
            totalScore: roundedTotal,
            maxScore: maxScore,
            percentage: roundedPct,
            colorBand: colorBand,
            passed: passed,
            breakdown: breakdown,
            explanation: `المجموع الكلي: ${roundedTotal} من ${maxScore} (${roundedPct}%) وفق القرار الوزاري للتقييم`
        };
    }

    /**
     * Calculate term overall total and average across enrolled subjects
     */
    function calculateTermSummary(subjectResults) {
        if (!subjectResults || subjectResults.length === 0) {
            return {
                totalScore: 0,
                maxTotalScore: 0,
                percentage: 0,
                colorBand: COLOR_BANDS.RED,
                passedAll: false,
                failingSubjects: []
            };
        }

        let totalScore = 0;
        let maxTotalScore = 0;
        let passedAll = true;
        const failingSubjects = [];

        subjectResults.forEach(sr => {
            totalScore += sr.totalScore || 0;
            maxTotalScore += sr.maxScore || 100;
            if (!sr.passed) {
                passedAll = false;
                failingSubjects.push(sr.subjectName || sr.subjectId);
            }
        });

        const percentage = maxTotalScore > 0 ? (totalScore / maxTotalScore) * 100 : 0;
        const roundedPct = Math.round(percentage * 10) / 10;
        const colorBand = getColorBand(roundedPct);

        return {
            totalScore: Math.round(totalScore * 10) / 10,
            maxTotalScore: maxTotalScore,
            percentage: roundedPct,
            colorBand: colorBand,
            passedAll: passedAll,
            failingSubjects: failingSubjects
        };
    }

    const EgyptianGrading = {
        COLOR_BANDS,
        DEFAULT_PRIMARY_POLICY,
        MONTHLY_CATEGORIES,
        getColorBand,
        calculateSubjectResult,
        calculateTermSummary
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = EgyptianGrading;
    } else {
        global.EgyptianGrading = EgyptianGrading;
    }
})(typeof window !== "undefined" ? window : global);
