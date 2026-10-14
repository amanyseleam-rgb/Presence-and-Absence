/**
 * Automated Test Suite: Security, Cryptography & Access Control (RBAC)
 *
 * ACTUAL core/security.js API:
 *   - sha256(ascii) → 64-char hex string
 *   - hashPassword(password, salt?) → { salt: string, hash: string }
 *   - verifyPassword(password, salt, storedHash) → boolean
 *   - checkRateLimit(identifier) → { allowed: bool, remainingSec?, waitMinutes? }
 *   - recordFailedLogin(identifier)
 *   - recordSuccessfulLogin(identifier)
 *   - createSessionToken(user) → { userId, username, role, expiresAt, token, ... }
 *   - isSessionValid(session) → true | false  (session = plain object, NOT a string)
 *   - canAccessStudent(session, student) → bool  (student is object with .id and .nationalId)
 *   - canManageClass(session, classId) → bool
 *   - canManageSystem(session) → bool
 */

const assert = require("assert");
const Security = require("../core/security.js");

function run() {
    console.log("\n--- [2] Security & Access Control Test Suite ---");
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

    test("SHA-256 produces deterministic 64-char hex digest", () => {
        const hash1 = Security.sha256("admin123");
        const hash2 = Security.sha256("admin123");
        assert.strictEqual(hash1, hash2, "Hashes must be deterministic");
        assert.strictEqual(hash1.length, 64, "SHA-256 hex digest must be 64 characters");
        assert.notStrictEqual(Security.sha256("admin123"), Security.sha256("admin124"),
            "Different inputs must produce different hashes");
    });

    test("hashPassword returns { salt, hash } object with correct field lengths", () => {
        const password = "mySecretPassword#2026";
        const result = Security.hashPassword(password);

        assert.ok(result && typeof result === "object",
            "hashPassword must return an object, not a string");
        assert.ok(typeof result.salt === "string", "Result must have .salt string");
        assert.ok(typeof result.hash === "string", "Result must have .hash string");
        assert.strictEqual(result.hash.length, 64, "Hash digest must be 64 hex characters");
        assert.ok(result.salt.length >= 8, "Salt must be at least 8 characters");
    });

    test("hashPassword with explicit salt produces deterministic result", () => {
        const pass = "testpass";
        const salt = "mysalt_123";
        const r1 = Security.hashPassword(pass, salt);
        const r2 = Security.hashPassword(pass, salt);
        assert.strictEqual(r1.hash, r2.hash, "Same salt must always produce same hash");
        assert.strictEqual(r1.salt, salt, "Returned salt must match provided salt");
    });

    test("hashPassword without explicit salt auto-generates unique salts", () => {
        const r1 = Security.hashPassword("same_password");
        const r2 = Security.hashPassword("same_password");
        // Different salts → different hashes (randomness)
        assert.notStrictEqual(r1.salt, r2.salt, "Auto-generated salts must differ");
        assert.notStrictEqual(r1.hash, r2.hash, "Different salts must yield different hashes");
    });

    test("verifyPassword(password, salt, hash) succeeds with correct credentials", () => {
        const password = "adminSafePassword!";
        const stored = Security.hashPassword(password);
        assert.strictEqual(Security.verifyPassword(password, stored.salt, stored.hash), true,
            "Correct password + salt must verify");
    });

    test("verifyPassword rejects wrong password and empty credentials", () => {
        const stored = Security.hashPassword("correctPass");
        assert.strictEqual(Security.verifyPassword("wrongPass", stored.salt, stored.hash), false,
            "Wrong password must fail");
        assert.strictEqual(Security.verifyPassword("", stored.salt, stored.hash), false,
            "Empty password must fail");
        assert.strictEqual(Security.verifyPassword("correctPass", "", stored.hash), false,
            "Empty salt must fail");
    });

    test("createSessionToken returns session object with correct fields", () => {
        const user = { id: 101, username: "teacher1", role: "teacher", name: "أستاذ أحمد" };
        const session = Security.createSessionToken(user);

        assert.ok(session && typeof session === "object",
            "createSessionToken must return an object");
        assert.strictEqual(session.userId, 101);
        assert.strictEqual(session.username, "teacher1");
        assert.strictEqual(session.role, "teacher");
        assert.ok(session.expiresAt > Date.now(), "Session must expire in the future");
        assert.ok(typeof session.token === "string" && session.token.length >= 60,
            `Session must contain a valid hex token signature (got length ${session.token ? session.token.length : 0})`);
    });

    test("isSessionValid approves fresh sessions and rejects expired ones", () => {
        const user = { id: 102, username: "validUser", role: "admin" };
        const session = Security.createSessionToken(user);
        assert.strictEqual(Security.isSessionValid(session), true,
            "Fresh session must be valid");

        // Simulate expired session
        const expired = Object.assign({}, session, { expiresAt: Date.now() - 1000 });
        assert.strictEqual(Security.isSessionValid(expired), false,
            "Expired session must be rejected");
    });

    test("isSessionValid rejects null, undefined, and sessions without expiresAt", () => {
        assert.strictEqual(Security.isSessionValid(null), false);
        assert.strictEqual(Security.isSessionValid(undefined), false);
        assert.strictEqual(Security.isSessionValid({}), false);
        assert.strictEqual(Security.isSessionValid({ role: "admin" }), false);
    });

    test("canManageSystem: admin allowed, teacher/student/unauthenticated denied", () => {
        const adminSess = { role: "admin", userId: 1, expiresAt: Date.now() + 1e9 };
        const teacherSess = { role: "teacher", userId: 2, expiresAt: Date.now() + 1e9 };
        const studentSess = { role: "student", userId: 3, expiresAt: Date.now() + 1e9 };

        assert.strictEqual(Security.canManageSystem(adminSess), true,
            "Admin must be allowed to manage system");
        assert.strictEqual(Security.canManageSystem(teacherSess), false,
            "Teacher must NOT manage system");
        assert.strictEqual(Security.canManageSystem(studentSess), false,
            "Student must NOT manage system");
        assert.strictEqual(Security.canManageSystem(null), false,
            "Unauthenticated must be denied");
    });

    test("canManageClass: admin can manage any class; teacher respects assignedClasses", () => {
        const adminSess = { role: "admin", userId: 1, expiresAt: Date.now() + 1e9 };
        const teacherSess = {
            role: "teacher", userId: 2, expiresAt: Date.now() + 1e9,
            assignedClasses: [1, 2, 3]
        };

        assert.strictEqual(Security.canManageClass(adminSess, 99), true,
            "Admin can manage any class");
        assert.strictEqual(Security.canManageClass(teacherSess, 2), true,
            "Teacher can manage assigned class");
        assert.strictEqual(Security.canManageClass(teacherSess, 99), false,
            "Teacher cannot manage unassigned class");
    });

    test("canAccessStudent: admin can access all; student IDOR protection active", () => {
        const adminSess = { role: "admin", userId: 1, expiresAt: Date.now() + 1e9 };
        const studentSess = {
            role: "student", userId: 55, expiresAt: Date.now() + 1e9,
            studentId: 55, nationalId: "123456789"
        };

        const ownStudent = { id: 55, nationalId: "123456789" };
        const otherStudent = { id: 56, nationalId: "987654321" };

        assert.strictEqual(Security.canAccessStudent(adminSess, ownStudent), true,
            "Admin can access any student");
        assert.strictEqual(Security.canAccessStudent(studentSess, ownStudent), true,
            "Student can access own record");
        assert.strictEqual(Security.canAccessStudent(studentSess, otherStudent), false,
            "Student must NOT access another student (IDOR protection)");
    });

    test("Rate limiter locks out after 5 consecutive failed attempts with waitMinutes info", () => {
        const testUser = "brute_force_target_" + Date.now();

        // 4 failed attempts – still allowed
        for (let i = 0; i < 4; i++) {
            Security.recordFailedLogin(testUser);
            const check = Security.checkRateLimit(testUser);
            assert.strictEqual(check.allowed, true,
                `Attempt ${i + 1} should still be allowed`);
        }

        // 5th attempt triggers lockout
        Security.recordFailedLogin(testUser);
        const lockedCheck = Security.checkRateLimit(testUser);
        assert.strictEqual(lockedCheck.allowed, false,
            "5th failed attempt must trigger lockout");
        assert.ok(lockedCheck.remainingSec > 0,
            "Lockout must include remaining seconds");

        // Successful login resets counter
        Security.recordSuccessfulLogin(testUser);
        const resetCheck = Security.checkRateLimit(testUser);
        assert.strictEqual(resetCheck.allowed, true,
            "Successful login must reset lockout");
    });

    return { suite: "Security & Access Control", passed, failed };
}

if (require.main === module) {
    const res = run();
    process.exit(res.failed > 0 ? 1 : 0);
}

module.exports = run;
