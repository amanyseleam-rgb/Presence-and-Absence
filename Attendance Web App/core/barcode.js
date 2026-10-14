/**
 * Core Barcode Generation, Hardware Scanner Integration & Audio Feedback Engine
 * Standard Format: CODE128 (Compatible with printed cards and Egyptian 9-digit IDs)
 * Compatible with Browser and Node.js
 */

(function (global) {
    "use strict";

    // Audio Feedback using Web Audio API (Synthesized in-browser, works 100% offline)
    let audioCtx = null;

    function getAudioContext() {
        if (typeof window === "undefined") return null;
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                audioCtx = new AudioContext();
            }
        }
        if (audioCtx && audioCtx.state === "suspended") {
            audioCtx.resume();
        }
        return audioCtx;
    }

    function playTone(freq, type, durationMs, gainLevel) {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type || "sine";
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            gain.gain.setValueAtTime(gainLevel || 0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (durationMs / 1000));
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + (durationMs / 1000));
        } catch (e) {
            // Audio error gracefully ignored in silent environments
        }
    }

    function playSoundSuccess() {
        // High pleasant ascending double chime (523Hz C5 -> 659Hz E5)
        playTone(523.25, "sine", 120, 0.2);
        setTimeout(() => playTone(659.25, "sine", 200, 0.25), 90);
    }

    function playSoundWarning() {
        // Medium double beep (440Hz A4)
        playTone(440, "triangle", 150, 0.25);
        setTimeout(() => playTone(440, "triangle", 150, 0.25), 180);
    }

    function playSoundError() {
        // Low buzzer tone (220Hz A3)
        playTone(220, "sawtooth", 300, 0.3);
    }

    /**
     * Validate barcode value format
     * Egyptian student IDs in this school are 9-digit alphanumeric strings
     */
    function isValidBarcode(code) {
        if (!code) return false;
        const cleaned = String(code).trim();
        return /^[0-9A-Za-z]{4,20}$/.test(cleaned);
    }

    /**
     * Render Barcode on Canvas using JsBarcode (CODE128)
     */
    function renderBarcode(target, value, options) {
        if (typeof window === "undefined" || !window.JsBarcode) {
            return false;
        }
        try {
            const opts = Object.assign({
                format: "CODE128",
                lineColor: "#1e293b",
                width: 2,
                height: 80,
                displayValue: true,
                fontSize: 14,
                margin: 8,
                textMargin: 4
            }, options || {});

            let element = target;
            if (typeof target === "string") {
                element = document.getElementById(target);
            }
            if (!element) return false;

            window.JsBarcode(element, String(value).trim(), opts);
            return true;
        } catch (err) {
            console.error("Barcode rendering failed:", err);
            return false;
        }
    }

    /**
     * Hardware USB/Bluetooth Keyboard-Emulating Scanner Listener
     * Captures high-speed sequential keypresses from physical barcode guns
     */
    class HardwareScannerListener {
        constructor(onScanCallback, options) {
            this.onScan = onScanCallback;
            this.options = Object.assign({
                maxCharIntervalMs: 50,  // Scanners type very quickly (<50ms per key)
                minBarcodeLength: 4,
                targetInputId: null,
                ignoreIfInsideInput: false
            }, options);

            this.buffer = "";
            this.lastCharTime = 0;
            this._handleKeyDown = this._handleKeyDown.bind(this);
            this.active = false;
        }

        start() {
            if (typeof window === "undefined" || this.active) return;
            window.addEventListener("keydown", this._handleKeyDown, true);
            this.active = true;
        }

        stop() {
            if (typeof window === "undefined" || !this.active) return;
            window.removeEventListener("keydown", this._handleKeyDown, true);
            this.active = false;
        }

        _handleKeyDown(e) {
            const now = Date.now();
            const target = e.target;

            // If user is typing manually in a regular text/search input,
            // don't interfere unless it's the designated scanner input
            if (this.options.ignoreIfInsideInput &&
                (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
                if (!this.options.targetInputId || target.id !== this.options.targetInputId) {
                    return;
                }
            }

            // Scanner terminates with Enter key
            if (e.key === "Enter" || e.keyCode === 13) {
                if (this.buffer.length >= this.options.minBarcodeLength) {
                    const scannedCode = this.buffer.trim();
                    this.buffer = "";
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof this.onScan === "function") {
                        this.onScan(scannedCode, "hardware");
                    }
                    return;
                }
                this.buffer = "";
                return;
            }

            // Reject control keys
            if (e.key.length > 1) return;

            // Check timing between characters
            if (this.buffer.length > 0 && (now - this.lastCharTime > this.options.maxCharIntervalMs * 3)) {
                // Too slow, likely human typing, reset buffer
                this.buffer = "";
            }

            this.buffer += e.key;
            this.lastCharTime = now;
        }
    }

    /**
     * Print Student Badge Sheets (A4 grid of cards)
     */
    function printStudentBadges(students, schoolName) {
        if (typeof window === "undefined" || !students || students.length === 0) return;

        const printWin = window.open("", "_blank", "width=1000,height=800");
        let cardsHtml = "";

        students.forEach((s, idx) => {
            cardsHtml += `
                <div class="badge-card">
                    <div class="school-header">${schoolName || "مدرسة السادات الابتدائية بميت غمر"}</div>
                    <div class="student-name">${s.name}</div>
                    <div class="student-meta">
                        <span>الصف: ${s.gradeName || "-"}</span> | <span>فصل: ${s.className || "-"}</span>
                    </div>
                    <div class="nid-label">كود الطالب: ${s.nationalId}</div>
                    <svg id="badge_bc_${idx}" class="barcode-svg"></svg>
                </div>
            `;
        });

        printWin.document.write(`
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <title>كروت الطلاب الباركودية - ${schoolName || "المدرسة"}</title>
                <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
                    body { background: white; padding: 15mm 10mm; direction: rtl; }
                    .badges-grid {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 12mm 10mm;
                    }
                    .badge-card {
                        border: 2px dashed #94a3b8;
                        border-radius: 10px;
                        padding: 12px;
                        text-align: center;
                        background: #ffffff;
                        page-break-inside: avoid;
                        height: 60mm;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .school-header { font-size: 13px; font-weight: bold; color: #4338ca; border-bottom: 1px solid #e2e8f0; width: 100%; padding-bottom: 4px; }
                    .student-name { font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 4px; }
                    .student-meta { font-size: 12px; color: #475569; }
                    .nid-label { font-family: monospace; font-size: 13px; font-weight: 700; color: #2563eb; }
                    .barcode-svg { max-width: 90%; height: 50px; }
                    @media print {
                        @page { size: A4 portrait; margin: 10mm; }
                        body { padding: 0; }
                        .badge-card { border: 1.5px solid #64748b; }
                    }
                </style>
            </head>
            <body>
                <div class="badges-grid">${cardsHtml}</div>
                <script>
                    window.onload = function() {
                        const students = ${JSON.stringify(students)};
                        students.forEach((s, idx) => {
                            try {
                                JsBarcode("#badge_bc_" + idx, String(s.nationalId), {
                                    format: "CODE128",
                                    width: 1.8,
                                    height: 50,
                                    displayValue: false,
                                    margin: 2
                                });
                            } catch(e) {
                                console.error(e);
                            }
                        });
                        setTimeout(() => { window.print(); }, 800);
                    };
                <\/script>
            </body>
            </html>
        `);
        printWin.document.close();
    }

    const BarcodeSystem = {
        isValidBarcode,
        renderBarcode,
        HardwareScannerListener,
        playSoundSuccess,
        playSoundWarning,
        playSoundError,
        printStudentBadges
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = BarcodeSystem;
    } else {
        global.BarcodeSystem = BarcodeSystem;
    }
})(typeof window !== "undefined" ? window : global);
