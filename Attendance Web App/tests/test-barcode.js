/**
 * Automated Test Suite: Barcode System & Hardware Scanner Integration
 * Tests CODE128 format validation, 9-digit student code support,
 * hardware keystroke buffer debouncing, and scanner event triggering.
 */

const assert = require("assert");
const BarcodeSystem = require("../core/barcode.js");

function run() {
    console.log("\n--- [5] Barcode System & Hardware Scanner Test Suite ---");
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

    test("isValidBarcode accepts Egyptian 9-digit student national ID codes", () => {
        assert.strictEqual(BarcodeSystem.isValidBarcode("100000001"), true);
        assert.strictEqual(BarcodeSystem.isValidBarcode("298010112"), true);
        assert.strictEqual(BarcodeSystem.isValidBarcode("305121401"), true);
    });

    test("isValidBarcode accepts standard 14-digit national IDs and alphanumeric card tags", () => {
        assert.strictEqual(BarcodeSystem.isValidBarcode("31405011200123"), true);
        assert.strictEqual(BarcodeSystem.isValidBarcode("STU2026001"), true);
    });

    test("isValidBarcode rejects empty, null, undefined, or excessively short inputs", () => {
        assert.strictEqual(BarcodeSystem.isValidBarcode(""), false);
        assert.strictEqual(BarcodeSystem.isValidBarcode(null), false);
        assert.strictEqual(BarcodeSystem.isValidBarcode(undefined), false);
        assert.strictEqual(BarcodeSystem.isValidBarcode("12"), false);
        assert.strictEqual(BarcodeSystem.isValidBarcode("   "), false);
    });

    test("HardwareScannerListener collects high-speed scanner keystrokes and fires onScan", () => {
        let scannedResult = null;
        let scannedMethod = null;

        const listener = new BarcodeSystem.HardwareScannerListener((code, method) => {
            scannedResult = code;
            scannedMethod = method;
        }, { maxCharIntervalMs: 50, minBarcodeLength: 4 });

        // Simulate rapid hardware scanner input: "298010112" followed by Enter
        const codeToScan = "298010112";
        for (const char of codeToScan) {
            listener._handleKeyDown({
                key: char,
                target: { tagName: "BODY" }
            });
        }

        // Send Enter
        let defaultPrevented = false;
        listener._handleKeyDown({
            key: "Enter",
            target: { tagName: "BODY" },
            preventDefault: () => { defaultPrevented = true; },
            stopPropagation: () => {}
        });

        assert.strictEqual(scannedResult, "298010112", "Scanned code must match exactly");
        assert.strictEqual(scannedMethod, "hardware", "Method must be identified as hardware");
        assert.strictEqual(defaultPrevented, true, "Enter must be captured and prevented");
        assert.strictEqual(listener.buffer, "", "Buffer must be flushed after scan");
    });

    test("HardwareScannerListener flushes buffer if keystrokes are too slow (human typing)", () => {
        let fired = false;
        const listener = new BarcodeSystem.HardwareScannerListener(() => {
            fired = true;
        }, { maxCharIntervalMs: 20, minBarcodeLength: 4 });

        // First character typed
        listener._handleKeyDown({ key: "1", target: { tagName: "BODY" } });
        assert.strictEqual(listener.buffer, "1");

        // Simulate 500ms passing before second keystroke
        listener.lastCharTime = Date.now() - 500;

        // Second keystroke arrives after long pause
        listener._handleKeyDown({ key: "2", target: { tagName: "BODY" } });
        // Buffer should have flushed "1" and now only contain "2"
        assert.strictEqual(listener.buffer, "2", "Buffer must flush when char interval is exceeded");

        // Press Enter; buffer length is 1 < minBarcodeLength(4), should not fire
        listener._handleKeyDown({
            key: "Enter",
            target: { tagName: "BODY" },
            preventDefault: () => {},
            stopPropagation: () => {}
        });

        assert.strictEqual(fired, false, "Slow typing must not trigger barcode scanner");
    });

    test("HardwareScannerListener ignores short buffer on accidental Enter", () => {
        let fired = false;
        const listener = new BarcodeSystem.HardwareScannerListener(() => {
            fired = true;
        }, { minBarcodeLength: 6 });

        listener._handleKeyDown({ key: "1", target: { tagName: "BODY" } });
        listener._handleKeyDown({ key: "2", target: { tagName: "BODY" } });
        listener._handleKeyDown({
            key: "Enter",
            target: { tagName: "BODY" },
            preventDefault: () => {},
            stopPropagation: () => {}
        });

        assert.strictEqual(fired, false, "Buffer of 2 chars should not fire when min is 6");
        assert.strictEqual(listener.buffer, "");
    });

    return { suite: "Barcode & Hardware Scanner", passed, failed };
}

if (require.main === module) {
    const res = run();
    process.exit(res.failed > 0 ? 1 : 0);
}

module.exports = run;
