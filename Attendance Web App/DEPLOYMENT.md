# دليل التشغيل والنشر — نظام إدارة مدرسة السادات الابتدائية
# Deployment & Operations Guide — Sadat Primary School Management System

> **مدرسة السادات الابتدائية بميت غمر — محافظة الدقهلية**
> Version 2.0 | Production Ready ✅

---

## ✅ حالة النظام الحالية / System Status

| المكوّن | الحالة |
|---|---|
| قاعدة البيانات — 710 طالب، 16 فصل، 6 صفوف | ✅ محقق ومحمي |
| نظام الباركود CODE128 | ✅ متوافق مع البطاقات المطبوعة |
| بوابة المدير (Admin Portal) | ✅ مكتملة |
| بوابة المعلم (Teacher Portal) | ✅ مكتملة |
| بوابة الطالب (Student Portal) | ✅ مكتملة |
| نظام التقييم المصري (القرار الوزاري) | ✅ 15+15+10+5+5+50 |
| شاشة الماسح الضوئي (Scanner Station) | ✅ Hardware + Camera |
| التقارير والإحصائيات (حاضر/متأخر/بعذر/غائب) | ✅ مكتملة |
| الاختبارات الآلية (46 اختبار) | ✅ 100% نجاح |

---

## 🔑 بيانات الدخول الافتراضية / Default Login Credentials

> [!CAUTION]
> **غيّر كلمات المرور الافتراضية فوراً بعد أول تسجيل دخول.**
> Change all default passwords immediately after first login.

| الحساب | اسم المستخدم | كلمة المرور الافتراضية | الدور |
|---|---|---|---|
| مدير النظام | `admin` | `123456` | Admin — صلاحيات كاملة |
| المعلم الأول | `teacher` | `123456` | Teacher — عربي ورياضيات |
| المعلمة الثانية | `teacher2` | `123456` | Teacher — إنجليزي وعلوم |
| الطالب (أي طالب) | الرقم القومي للطالب | الرقم القومي للطالب | Student — ملفه الشخصي فقط |

---

## 🌐 النشر على Vercel / Vercel Deployment

```bash
# 1. اذهب إلى vercel.com ووصّل GitHub repo
# 2. اختر Framework: Other (Static Site)
# 3. Root Directory: /  (الجذر مباشرةً)
# 4. لا يوجد build command
# 5. اضغط Deploy
```

الإعداد موجود في [`vercel.json`](vercel.json):
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/$1" }]
}
```

---

## 📱 هيكل الصفحات / Page Structure

```
index.html           — الصفحة الرئيسية (3 بوابات)
login.html           — تسجيل الدخول (student/teacher/admin)
admin-dashboard.html — لوحة تحكم المدير
teacher-dashboard.html — لوحة تحكم المعلم
student-dashboard.html — ملف الطالب الشخصي
attendance.html      — تسجيل الحضور اليدوي
scanner.html         — محطة الماسح الضوئي (dedicated)
students.html        — إدارة الطلاب
reports.html         — تقارير الحضور
statistics.html      — إحصائيات بيانية
results.html         — نتائج الدرجات
monthly-evals.html   — التقييمات الشهرية
```

---

## 🔦 إعداد الماسح الضوئي / Barcode Scanner Setup

### ماسح USB/Bluetooth (keyboard-emulating)
1. وصّل الماسح بالحاسوب — يظهر كـ keyboard device
2. افتح صفحة `scanner.html`
3. حدد التاريخ، الفصل، والجلسة
4. **لا تحتاج نقر — الماسح يرسل Enter تلقائياً**
5. النظام يستقبل الكود ويسجل الحضور فوراً

> [!IMPORTANT]
> تأكد أن إعداد المتصفح لا يحجب focus على الصفحة.
> في Chrome: لا تحتاج أي إعداد إضافي.

### ماسح الكاميرا (Camera-based)
1. اضغط زر "📷 تشغيل الكاميرا" في صفحة الماسح
2. وافق على صلاحية الوصول للكاميرا
3. وجّه الكاميرا نحو الباركود

### تنسيق الباركود
- **Format: CODE128**
- **القيمة: الرقم القومي للطالب** (9 أرقام)
- متوافق 100% مع البطاقات المطبوعة سابقاً

---

## 📊 نظام التقييم المصري / Egyptian Grading System

```
التقييم الشهري الأول (شهر 1)    15 درجة
التقييم الشهري الثاني (شهر 2)   15 درجة
المهام الأدائية والأنشطة          10 درجات
كشكول الحصة والواجب               5 درجات
المواظبة والسلوك                   5 درجات
امتحان نهاية الفصل                50 درجة
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
المجموع الكلي                     100 درجة
```

### نظام الألوان
| اللون | النسبة | الدلالة |
|---|---|---|
| 🔵 الأزرق | 85% – 100% | فاق التوقعات |
| 🟢 الأخضر | 65% – 84.9% | امتلك المعارف |
| 🟡 الأصفر | 50% – 64.9% | بحاجة لبعض الدعم |
| 🔴 الأحمر | أقل من 50% | يحتاج دعماً كبيراً |

**الحد الأدنى للنجاح: 50%**

---

## 🗄️ إدارة البيانات / Data Management

### النسخ الاحتياطي (Backup)
1. افتح `admin-dashboard.html` واحتياطي بيانات كامل
2. اضغط **تصدير نسخة احتياطية JSON**
3. احفظ الملف في مكان آمن

### الاستعادة (Restore)
1. افتح `admin-dashboard.html`
2. اضغط **استيراد نسخة احتياطية**
3. اختر ملف JSON المحفوظ

> [!WARNING]
> البيانات محفوظة في `localStorage` — مرتبطة بالمتصفح والجهاز.
> الـ backup الدوري ضروري لضمان عدم فقدان البيانات.

---

## 🧪 تشغيل الاختبارات الآلية / Running Tests

```powershell
# في مجلد المشروع
& "C:\Program Files\Adobe\Adobe Creative Cloud Experience\libs\node.exe" tests/run-all.js
```

**النتيجة المتوقعة:**
```
TOTAL      46       0 100% OK ✓
🎉 ALL TESTS PASSED SUCCESSFULLY! SYSTEM IS PRODUCTION READY.
```

### ملفات الاختبارات
| الملف | ما يختبره |
|---|---|
| `tests/test-db-integrity.js` | سلامة 710 طالب، 16 فصل، 6 صفوف |
| `tests/test-security.js` | التشفير، الجلسات، RBAC، rate limiting |
| `tests/test-egyptian-grading.js` | درجات القرار الوزاري، نظام الألوان |
| `tests/test-attendance.js` | مسح الباركود، منع التكرار، القفل |
| `tests/test-barcode.js` | التحقق من الباركود، الماسح الضوئي |

---

## 🏗️ بنية الملفات الأساسية / Core Architecture

```
core/
  security.js      — SHA-256 salted hashing, RBAC, rate limiting, sessions
  attendance.js    — AttendanceEngine: scan, validate, correct, stats
  barcode.js       — BarcodeSystem: CODE128, HardwareScannerListener, audio
  egyptian-grading.js — EgyptianGrading: policy, color bands, calculateSubjectResult
  audit.js         — AuditLogger: event logging, queryLogs

database.js        — All student/class/grade data + auth + results + evals
utils.js           — Shared UI helpers (showToast, printSection, exportToExcel)
style.css          — Full RTL Arabic design system
```

---

## 🔒 ملاحظات الأمان / Security Notes

- كلمات المرور مشفرة بـ SHA-256 مع salt فريد لكل مستخدم
- محاولات الدخول مقيّدة: 5 محاولات فاشلة → قفل 10 دقائق
- RBAC: كل وظيفة تتحقق من الصلاحية قبل التنفيذ
- IDOR: الطالب لا يرى إلا ملفه الشخصي فقط
- الباركود: معرّف هوية فقط — لا يحتوي على token أو password
- جلسات المعلم تنتهي تلقائياً بعد 8 ساعات

---

## 📞 الدعم الفني / Technical Support

- **المدرسة:** مدرسة السادات الابتدائية بميت غمر — محافظة الدقهلية
- **الإصدار:** 2.0 — Production Ready
- **تاريخ التحديث:** أكتوبر 2026
- **المنصة:** Vercel (Static Hosting) | Browser localStorage

---

*تم بناء هذا النظام ليكون سريعاً وموثوقاً وقابلاً للعمل بدون إنترنت على أجهزة المدرسة.*
