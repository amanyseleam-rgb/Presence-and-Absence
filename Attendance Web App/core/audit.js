/**
 * Central System Audit Log Module
 * Records security, attendance, grade, and administrative events
 * Compatible with Browser and Node.js
 */

(function (global) {
    "use strict";

    const AUDIT_STORAGE_KEY = "system_audit_logs_v1";

    const ACTION_TYPES = {
        LOGIN: "تسجيل دخول",
        LOGOUT: "تسجيل خروج",
        STUDENT_ADD: "إضافة طالب",
        STUDENT_UPDATE: "تعديل طالب",
        STUDENT_DELETE: "حذف طالب",
        ATTENDANCE_SCAN: "مسح باركود حضور",
        ATTENDANCE_MANUAL: "تسجيل حضور يدوي",
        ATTENDANCE_CORRECTION: "تصحيح سجل حضور",
        ATTENDANCE_FINALIZE: "اعتماد وقفل جلسة حضور",
        GRADE_SAVE: "حفظ درجات مادة",
        GRADE_APPROVE: "اعتماد رسمي للدرجات",
        DATABASE_BACKUP: "تصدير نسخة احتياطية",
        DATABASE_RESTORE: "استيراد نسخة احتياطية",
        POLICY_CHANGE: "تعديل سياسة التقييم"
    };

    function getStorage() {
        if (typeof localStorage !== "undefined") {
            return localStorage;
        }
        return {
            _data: {},
            getItem: function (k) { return this._data[k] || null; },
            setItem: function (k, v) { this._data[k] = v; }
        };
    }

    function getAllLogs() {
        try {
            const raw = getStorage().getItem(AUDIT_STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function saveLogs(logs) {
        try {
            getStorage().setItem(AUDIT_STORAGE_KEY, JSON.stringify(logs.slice(-2000))); // Keep last 2000 entries
        } catch (e) {
            console.error("Failed to save audit log:", e);
        }
    }

    function recordEvent(actionType, details, session) {
        const logs = getAllLogs();
        const entry = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            timestamp: new Date().toISOString(),
            action: actionType,
            userId: session ? session.userId : "system",
            username: session ? session.username : "guest",
            role: session ? session.role : "none",
            details: details || {}
        };
        logs.unshift(entry);
        saveLogs(logs);
        return entry;
    }

    function queryLogs(filters = {}) {
        let logs = getAllLogs();
        if (filters.action) {
            logs = logs.filter(l => l.action === filters.action);
        }
        if (filters.username) {
            logs = logs.filter(l => l.username.toLowerCase().includes(filters.username.toLowerCase()));
        }
        if (filters.role) {
            logs = logs.filter(l => l.role === filters.role);
        }
        if (filters.limit) {
            logs = logs.slice(0, filters.limit);
        }
        return logs;
    }

    function clearOldLogs(daysToKeep = 90) {
        const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
        const logs = getAllLogs().filter(l => new Date(l.timestamp).getTime() > cutoff);
        saveLogs(logs);
    }

    const AuditLogger = {
        ACTION_TYPES,
        recordEvent,
        getAllLogs,
        queryLogs,
        clearOldLogs
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = AuditLogger;
    } else {
        global.AuditLogger = AuditLogger;
    }
})(typeof window !== "undefined" ? window : global);
