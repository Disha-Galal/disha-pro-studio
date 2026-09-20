# Disha Pro Studio

نسخة ويب عربية لمعالجة النصوص والملفات (مستوحاة من سكريبت Disha Galal). المعالجة تتم داخل المتصفح؛ السكريبت الأصلي محفوظ دون تعديل في `reference/disha-pro.py`.

**المستودع:** https://github.com/Disha-Galal/disha-pro-studio (خاص)  
**الموقع المنشور (إن وُجد):** راجع `START_HERE_AR.md`

## المتاح

- نصوص UTF-8 / Windows-1256 / UTF-16 LE / ISO-8859-6، واستخراج HTML كنص دون تشغيله.
- PDF نصي (حتى 200 صفحة)، DOCX، XLS/XLSX، PPTX، ODT، EPUB.
- OCR محلي للعربية والإنجليزية لصور PNG/JPG/WebP وصفحات PDF (بتفعيل المستخدم، حتى 20 صفحة).
- تنظيف، حذف تكرار مع الاحتفاظ بترتيب أول ظهور، فرز، إزالة تشكيل، بحث واستبدال، استخراج روابط وإيميلات وأرقام هاتف.
- مقارنة سطور وإحصاءات، تراجع عن آخر 10 عمليات، دمج الملفات.
- تنزيل TXT/MD/HTML/JSON/CSV/DOCX؛ PDF عبر نافذة الطباعة.
- تشفير AES-256-GCM (صيغة DPRO1) مع PBKDF2؛ كلمة السر لا تغادر المتصفح.

## حدود واضحة

المعالجة محلية ولا يُرفع المستند إلى خادم التطبيق. OCR يحتاج تنزيل مكتبات ونماذج لغة عند أول استخدام. المحتوى غير محفوظ بعد إغلاق الصفحة ما لم تحفظ جلسة JSON بنفسك. الحد الأقصى للملف 20 MB، والنص مليونَا حرف. DOC/PPT القديمة والصوت/الفيديو والمستندات المحمية بكلمة سر غير مدعومة حاليًا.

## المتطلبات

| الأداة | الإصدار |
|--------|---------|
| Node.js | **22.13 أو أحدث** |
| pnpm | **11.25.0** (المسجّل في `package.json`) |
| bash | مطلوب لسكربتات التثبيت |
| إنترنت | لتثبيت الاعتماديات ونماذج OCR أول مرة |

لا تحتاج مفاتيح API لتشغيل التطبيق محليًا.

---

## التشغيل على Termux + Ubuntu (proot)

الهدف: تشغيل خادم التطوير داخل **Ubuntu على Termux** ثم فتح الواجهة من متصفح الهاتف.

> تنبيه: بيئة Android/proot قد تواجه مشاكل مع `workerd` أو مكتبات ثنائية. إن فشل `pnpm run dev` أو البناء، جرّب على كمبيوتر Linux/Ubuntu حقيقي أو استخدم الموقع المنشور.

### 1) تثبيت Termux و Ubuntu

من متجر F-Droid ثبّت **Termux** (يفضّل أحدث إصدار)، ثم داخل Termux:

```bash
pkg update -y && pkg upgrade -y
pkg install -y proot-distro git curl wget
proot-distro install ubuntu
proot-distro login ubuntu
```

كل الأوامر التالية داخل جلسة Ubuntu (`proot-distro login ubuntu`).

### 2) أدوات النظام داخل Ubuntu

```bash
apt update && apt upgrade -y
apt install -y curl ca-certificates git build-essential python3
```

### 3) تثبيت Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v   # يجب أن يظهر v22.x أو أحدث (ويفضّل >= 22.13)
```

إن كان الإصدار أقل من 22.13، حدّث Node أو ثبّت إصدارًا أحدث يدويًا (مثل fnm/nvm) قبل المتابعة.

### 4) تثبيت pnpm 11.25.0

```bash
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm -v   # 11.25.0
```

بديل بدون corepack:

```bash
npm install -g pnpm@11.25.0
```

### 5) استنساخ المشروع

لأن المستودع **خاص**، تحتاج مصادقة GitHub (Personal Access Token أو SSH).

**HTTPS + توكن:**

```bash
cd ~
git clone https://github.com/Disha-Galal/disha-pro-studio.git
cd disha-pro-studio
```

عند طلب كلمة المرور استخدم **Personal Access Token** بصلاحية `repo` وليس كلمة مرور الحساب.

**أو SSH** (بعد إضافة مفتاحك في GitHub):

```bash
git clone git@github.com:Disha-Galal/disha-pro-studio.git
cd disha-pro-studio
```

### 6) تثبيت الاعتماديات وتشغيل التطوير

```bash
pnpm run install:ci
# أو: pnpm install --frozen-lockfile

pnpm run dev
```

افتح في متصفح الهاتف العنوان الذي تظهره الطرفية (غالبًا شيء مثل `http://127.0.0.1:5173` أو منفذ مشابه).

إن احتجت الوصول من متصفح خارج proot، جرّب ربط المنفذ أو افتح من نفس الجهاز عبر `127.0.0.1`. تأكد أن الجدار الناري/Termux يسمح بالمنفذ.

### 7) أوامر مفيدة أخرى

```bash
# فحص الأنواع
pnpm exec tsc --noEmit

# لينتر
pnpm run lint

# بناء نسخة الإنتاج
pnpm run build
```

بعد البناء، التشغيل المحلي لناتج Cloudflare/Workers (إن نجح على بيئتك):

```bash
pnpm run start
```

### مشاكل شائعة على Termux/Ubuntu

| المشكلة | ماذا تجرب |
|---------|-----------|
| `node` أقل من 22.13 | أعد تثبيت Node 22 من NodeSource أو عبر nvm/fnm |
| فشل `pnpm install` | تأكد من الإنترنت، ومساحة التخزين، وأنك داخل مجلد المشروع |
| فشل workerd / wrangler / sharp | معروف على بعض أجهزة Android؛ استخدم PC أو الموقع المنشور للتطوير الثقيل |
| المستودع الخاص يرفض الاستنساخ | أنشئ PAT من GitHub → Settings → Developer settings → Personal access tokens |
| البطء أو نفاد الذاكرة | أغلق التطبيقات الأخرى؛ `pnpm run build` ثقيل على الهاتف |

---

## التشغيل على كمبيوتر Linux / Ubuntu (موصى به للتطوير)

```bash
git clone https://github.com/Disha-Galal/disha-pro-studio.git
cd disha-pro-studio
pnpm run install:ci
pnpm run dev
```

## هيكل سريع

- `app/` — صفحات الواجهة
- `lib/` — المعالجة، القرّاء، التصدير، التشفير
- `components/` — مكوّنات الواجهة
- `scripts/` — تثبيت وبناء واختبارات
- `reference/disha-pro.py` — السكريبت المرجعي (Python)
- `MANAGEMENT_AR.md` — إدارة ونشر واختبارات المتصفح
- `START_HERE_AR.md` — ملخص التسليم للمطوّر

## الإصدار 02 (ملاحظات المنتج)

- واجهة كحلية داكنة، مؤشرات تركيز أوضح، قائمة ملفات أوضح على الهاتف.
- حفظ جلسة اختياري في JSON محلي (غير مشفّر، بلا حفظ تلقائي).
- فك TPPF1 المتوافق مع Python Fernet؛ التشفير الجديد يبقى DPRO1.

لا تشمل هذه النسخة دفعًا أو اشتراكات أو ربط حسابات AI.
