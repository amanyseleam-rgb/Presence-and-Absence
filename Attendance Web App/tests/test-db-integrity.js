/**
 * Automated Test Suite: Database & Data Integrity
 * Verifies all 710 students, 16 classes, 6 grades are preserved intact.
 *
 * ACTUAL database.js API:
 *   - hashPassword(password, salt?) → { salt, hash }
 *   - verifyPassword(password, salt, storedHash) → boolean
 *   - createSessionToken(user) → { userId, username, role, ...payload, token }
 *   - isSessionValid(session) → true/false (session is the plain object, not string)
 *   - exportFullDatabaseJSON() → JSON string with keys: database, results, users, monthlyEvals
 *   - getSeedUsers().users[0].passwordHash is just the hex hash string (not $sha256$ format)
 */

const assert = require("assert");
const db = require("../database.js");

function run() {
    console.log("\n--- [1] Data Integrity & Database Test Suite ---");
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

    test("Database initialization loads correctly in Node.js environment", () => {
        const database = db.initDatabase();
        assert.ok(database, "Database must not be null or undefined");
        assert.ok(Array.isArray(database.students), "students must be an array");
        assert.ok(Array.isArray(database.classes), "classes must be an array");
        assert.ok(Array.isArray(database.grades), "grades must be an array");
    });

    test("Preserves exactly 710 students from seed database", () => {
        const database = db.getDatabase();
        assert.strictEqual(database.students.length, 710,
            `Expected exactly 710 students, got ${database.students.length}`);
    });

    test("Preserves exactly 16 classes and 6 grades", () => {
        const database = db.getDatabase();
        assert.strictEqual(database.classes.length, 16,
            `Expected exactly 16 classes, got ${database.classes.length}`);
        assert.strictEqual(database.grades.length, 6,
            `Expected exactly 6 grades, got ${database.grades.length}`);
    });

    test("All 710 students have mandatory fields (id, name, nationalId, classId)", () => {
        const database = db.getDatabase();
        database.students.forEach((s, idx) => {
            assert.ok(s.id, `Student at index ${idx} missing id`);
            assert.ok(s.name && s.name.trim().length > 0, `Student id ${s.id} missing name`);
            assert.ok(s.nationalId && String(s.nationalId).trim().length > 0,
                `Student id ${s.id} missing nationalId`);
            assert.ok(s.classId, `Student id ${s.id} missing classId`);
        });
    });

    test("All 710 student national IDs are unique (zero duplicates)", () => {
        const database = db.getDatabase();
        const seen = new Set();
        const duplicates = [];
        database.students.forEach(s => {
            const id = String(s.nationalId).trim();
            if (seen.has(id)) duplicates.push(id);
            seen.add(id);
        });
        assert.strictEqual(duplicates.length, 0,
            `Found duplicate national IDs: ${duplicates.slice(0, 5).join(", ")}`);
    });

    test("Every student's classId maps to a valid existing class", () => {
        const database = db.getDatabase();
        const validClassIds = new Set(database.classes.map(c => c.id));
        database.students.forEach(s => {
            assert.ok(validClassIds.has(s.classId),
                `Student id ${s.id} has invalid classId ${s.classId}`);
        });
    });

    test("getAllStudentsWithClassInfo() resolves className and gradeName for all 710 students", () => {
        const enriched = db.getAllStudentsWithClassInfo();
        assert.strictEqual(enriched.length, 710, "Enriched list must contain 710 students");
        enriched.forEach(s => {
            assert.ok(s.className, `Student ${s.name} missing className`);
            assert.ok(s.gradeName, `Student ${s.name} missing gradeName`);
        });
    });

    test("findStudentByNationalId() retrieves student correctly by ID", () => {
        const sample = db.getDatabase().students[0];
        const found = db.findStudentByNationalId(sample.nationalId);
        assert.ok(found, "Student must be found by national ID");
        assert.strictEqual(found.id, sample.id);
        assert.strictEqual(found.name, sample.name);
    });

    test("Users database initializes with at least admin and teacher accounts", () => {
        const usersDB = db.initUsersDB();
        assert.ok(Array.isArray(usersDB.users), "users must be an array");
        assert.ok(usersDB.users.length >= 2, "Must have at least default admin and teacher");
        const admin = usersDB.users.find(u => u.role === "admin" || u.email === "admin@school.com");
        assert.ok(admin, "Admin user must exist");
        assert.strictEqual(admin.role, "admin");
        assert.ok(admin.fullName, "Admin must have fullName");
        assert.ok(admin.email, "Admin must have email");
        assert.ok(admin.passwordHash, "Admin must have passwordHash (hex SHA-256 digest)");
        assert.ok(admin.salt, "Admin must have a salt value");
        // passwordHash is a 64-char hex SHA-256 string (not $sha256$ format)
        assert.strictEqual(admin.passwordHash.length, 64,
            `Admin passwordHash must be 64-char hex, got length ${admin.passwordHash.length}`);
    });

    test("Full database JSON backup export contains all required tables", () => {
        const json = db.exportFullDatabaseJSON();
        assert.ok(typeof json === "string", "Export must be JSON string");
        const parsed = JSON.parse(json);
        // Backup structure: { database, results, users, monthlyEvals, ... }
        assert.ok(parsed.database, "Backup must contain 'database' key");
        assert.strictEqual(parsed.database.students.length, 710,
            "Backup must preserve all 710 students");
        assert.strictEqual(parsed.database.classes.length, 16,
            "Backup must preserve all 16 classes");
        assert.strictEqual(parsed.database.grades.length, 6,
            "Backup must preserve all 6 grades");
        assert.ok(Array.isArray(parsed.users), "Backup must contain 'users' array");
    });

    return { suite: "Database & Data Integrity", passed, failed };
}

if (require.main === module) {
    const res = run();
    process.exit(res.failed > 0 ? 1 : 0);
}

module.exports = run;
