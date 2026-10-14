/**
 * Core Security, Authentication and Authorization Module
 * Compatible with Browser (Window) and Node.js (CommonJS)
 */

(function (global) {
    "use strict";

    // Roles
    const ROLES = {
        ADMIN: "admin",
        TEACHER: "teacher",
        STUDENT: "student",
        PARENT: "parent"
    };

    // Simple robust pure JS SHA-256 implementation ensuring deterministic hashing
    // across Browser, Node.js and non-HTTPS local file contexts.
    function sha256(ascii) {
        function rightRotate(value, amount) {
            return (value >>> amount) | (value << (32 - amount));
        }

        const mathPow = Math.pow;
        const maxWord = mathPow(2, 32);
        let result = '';

        const words = [];
        const asciiBitLength = ascii.length * 8;

        let hash = [];
        let k = [];
        let primeCounter = 0;

        const isComposite = {};
        for (let candidate = 2; primeCounter < 64; candidate++) {
            if (!isComposite[candidate]) {
                for (let i = candidate * 2; i < 313; i += candidate) {
                    isComposite[i] = true;
                }
                if (primeCounter < 8) {
                    hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
                }
                k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
                primeCounter++;
            }
        }

        ascii += '\x80';
        while ((ascii.length % 64) - 56) ascii += '\x00';

        for (let i = 0; i < ascii.length; i++) {
            const j = ascii.charCodeAt(i);
            if (j >> 8) return; // Only 8-bit supported
            words[i >> 2] |= j << ((3 - (i % 4)) * 8);
        }
        words[words.length] = (asciiBitLength / maxWord) | 0;
        words[words.length] = asciiBitLength | 0;

        for (let j = 0; j < words.length;) {
            const w = words.slice(j, j += 16);
            const oldHash = hash.slice(0);

            for (let i = 0; i < 64; i++) {
                const w15 = w[i - 15];
                const w2 = w[i - 2];

                const s0 = i < 16 ? w[i] : (
                    w[i] = (
                        (w[i - 16] +
                            (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                            w[i - 7] +
                            (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) | 0
                    )
                );

                const s1 = (rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22));
                const ch = (hash[0] & hash[1]) ^ ((~hash[0]) & hash[2]);
                const temp1 = (hash[7] + (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) +
                    ((hash[4] & hash[5]) ^ ((~hash[4]) & hash[6])) + k[i] + s0) | 0;
                const temp2 = (s1 + ch) | 0;

                hash = [(temp1 + temp2) | 0, hash[0], hash[1], hash[2], (hash[3] + temp1) | 0, hash[4], hash[5], hash[6]];
            }

            for (let i = 0; i < 8; i++) {
                hash[i] = (hash[i] + oldHash[i]) | 0;
            }
        }

        for (let i = 0; i < 8; i++) {
            for (let i2 = 3; i2 >= 0; i2--) {
                const b = (hash[i] >> (i2 * 8)) & 255;
                result += ((b < 16 ? '0' : '') + b.toString(16));
            }
        }
        return result;
    }

    /**
     * Generate secure salted hash for passwords
     */
    function hashPassword(password, salt) {
        if (!salt) {
            salt = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
        }
        const saltedInput = `egy_school_${salt}_${password}_salt_v1`;
        const hash = sha256(saltedInput);
        return {
            salt: salt,
            hash: hash
        };
    }

    /**
     * Verify a password against stored salt and hash
     */
    function verifyPassword(password, salt, storedHash) {
        if (!password || !salt || !storedHash) return false;
        const computed = hashPassword(password, salt);
        return computed.hash === storedHash;
    }

    // Rate Limiter to prevent brute force login
    const loginAttempts = {};

    function checkRateLimit(identifier) {
        const key = String(identifier).trim().toLowerCase();
        const record = loginAttempts[key];
        const now = Date.now();
        const LOCKOUT_MS = 10 * 60 * 1000; // 10 minutes
        const MAX_ATTEMPTS = 5;

        if (record) {
            if (record.lockedUntil && record.lockedUntil > now) {
                const remainingSec = Math.ceil((record.lockedUntil - now) / 1000);
                return {
                    allowed: false,
                    remainingSec: remainingSec,
                    message: `تم قفل الحساب مؤقتاً لكثرة المحاولات الخاطئة. يرجى المحاولة بعد ${remainingSec} ثانية.`
                };
            }
            // Reset if lockout expired
            if (record.lockedUntil && record.lockedUntil <= now) {
                delete loginAttempts[key];
            }
        }

        return { allowed: true };
    }

    function recordFailedLogin(identifier) {
        const key = String(identifier).trim().toLowerCase();
        const now = Date.now();
        const MAX_ATTEMPTS = 5;
        const LOCKOUT_MS = 10 * 60 * 1000;

        if (!loginAttempts[key]) {
            loginAttempts[key] = { count: 1, firstAttempt: now, lockedUntil: 0 };
        } else {
            loginAttempts[key].count++;
            if (loginAttempts[key].count >= MAX_ATTEMPTS) {
                loginAttempts[key].lockedUntil = now + LOCKOUT_MS;
            }
        }
    }

    function recordSuccessfulLogin(identifier) {
        const key = String(identifier).trim().toLowerCase();
        delete loginAttempts[key];
    }

    /**
     * Session Token generator & validator
     */
    function createSessionToken(user) {
        const now = Date.now();
        const payload = {
            userId: user.id,
            username: user.email || user.username || `user_${user.id}`,
            fullName: user.fullName || user.name || "",
            name: user.fullName || user.name || "",
            email: user.email || "",
            role: user.role,
            subject: user.subject || "",
            phone: user.phone || "",
            department: user.department || "",
            studentId: user.studentId || null,
            nationalId: user.nationalId || null,
            classId: user.classId || null,
            assignedClasses: user.assignedClasses || [],
            assignedSubjects: user.assignedSubjects || [],
            createdAt: now,
            expiresAt: now + (8 * 60 * 60 * 1000) // 8 hours
        };
        // Sign only ASCII-safe fields to avoid multi-byte char issues in sha256
        const safeId = user.id;
        const safeRole = user.role || "user";
        const sigInput = `token_secret_egy_uid:${safeId}_role:${safeRole}_exp:${payload.expiresAt}`;
        const signature = sha256(sigInput);
        return {
            ...payload,
            token: signature || sha256(`fallback_${user.id}_${payload.expiresAt}`)
        };
    }

    function isSessionValid(session) {
        if (!session || !session.expiresAt) return false;
        if (Date.now() > session.expiresAt) return false;
        return true;
    }

    /**
     * Server-side style Access Control Checks (RBAC & IDOR prevention)
     */
    function canAccessStudent(session, student) {
        if (!isSessionValid(session)) return false;
        if (session.role === ROLES.ADMIN) return true;
        if (session.role === ROLES.STUDENT) {
            // Student can ONLY access their own record
            return session.studentId === student.id || session.nationalId === student.nationalId;
        }
        if (session.role === ROLES.PARENT) {
            // Parent can access their linked child/children
            if (session.studentId === student.id || session.nationalId === student.nationalId) return true;
            if (Array.isArray(session.childrenIds) && session.childrenIds.includes(student.id)) return true;
            return false;
        }
        if (session.role === ROLES.TEACHER) {
            // Teacher can access student only if assigned to student's class, or if assigned to all
            if (!session.assignedClasses || session.assignedClasses.length === 0) return true;
            return session.assignedClasses.includes(student.classId);
        }
        return false;
    }

    function canManageClass(session, classId) {
        if (!isSessionValid(session)) return false;
        if (session.role === ROLES.ADMIN) return true;
        if (session.role === ROLES.TEACHER) {
            if (!session.assignedClasses || session.assignedClasses.length === 0) return true;
            return session.assignedClasses.includes(parseInt(classId));
        }
        return false;
    }

    function canGradeSubject(session, classId, subjectId) {
        if (!isSessionValid(session)) return false;
        if (session.role === ROLES.ADMIN) return true;
        if (session.role === ROLES.TEACHER) {
            const classAllowed = !session.assignedClasses || session.assignedClasses.length === 0 ||
                session.assignedClasses.includes(parseInt(classId));
            const subjectAllowed = !session.assignedSubjects || session.assignedSubjects.length === 0 ||
                session.assignedSubjects.includes(parseInt(subjectId));
            return classAllowed && subjectAllowed;
        }
        return false;
    }

    function canManageSystem(session) {
        if (!isSessionValid(session)) return false;
        return session.role === ROLES.ADMIN;
    }

    const Security = {
        ROLES,
        sha256,
        hashPassword,
        verifyPassword,
        checkRateLimit,
        recordFailedLogin,
        recordSuccessfulLogin,
        createSessionToken,
        isSessionValid,
        canAccessStudent,
        canManageClass,
        canGradeSubject,
        canManageSystem
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = Security;
    } else {
        global.Security = Security;
    }
})(typeof window !== "undefined" ? window : global);
