# ParseFlow (Disha Pro Studio)

معالجة مستندات داخل المتصفح: PDF · DOCX · TXT → نص منظّم. لا رفع إلى خادم — كل شيء في تبويب المتصفح.

**المستودع الخاص:** https://github.com/Disha-Galal/disha-pro-studio

## المتطلبات

| الأداة | الإصدار |
|--------|---------|
| Node.js | **22.13 أو أحدث** |
| pnpm | **11.25.0** |

## التشغيل المحلي (Next.js تصدير ثابت)

```bash
git clone https://github.com/Disha-Galal/disha-pro-studio.git
cd disha-pro-studio
corepack enable && corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
pnpm run dev          # http://localhost:3000
```

بناء الإنتاج (مجلد `out/`):

```bash
pnpm run build
pnpm start            # يخدم ./out
```

فحوصات:

```bash
pnpm exec tsc --noEmit
pnpm run lint
pnpm run build
```

## ChatGPT Sites

هذا المشروع يُبنى كتصدير Next ثابت (`output: 'export'`). تحديث موقع ChatGPT Sites ما زال يحتاج نشرًا منفصلًا عبر **@Sites** — دفع GitHub وحده لا يحدّث رابط Sites.

هوية المشروع في `.openai/hosting.json` محفوظة.

## Termux + Ubuntu (proot)

```bash
# داخل Ubuntu على Termux
apt update && apt install -y curl ca-certificates git build-essential
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
corepack enable && corepack prepare pnpm@11.25.0 --activate
git clone https://github.com/Disha-Galal/disha-pro-studio.git
cd disha-pro-studio
pnpm install --frozen-lockfile
pnpm run dev
```

افتح عنوان `localhost` من متصفح الهاتف. OCR وملفات PDF الكبيرة تستهلك ذاكرة كبيرة على الجوال — يُفضّل سطح المكتب للدفعات الكبيرة.

## الحدود (حماية من التعليق/الانهيار)

- أقصى **20 MB** لكل ملف، **10** ملفات لكل تشغيل، **2 مليون** حرف بعد الدمج.
- استخراج نص PDF: **200** صفحة/ملف.
- OCR: **20** صفحة/ملف و**40** صفحة/دفعة؛ حد بكسلات اللوحة؛ إيقاف عامل OCR بعد كل تشغيل.
- تصدير DOCX محدود بـ **50 ألف** فقرة (استخدم TXT للنصوص الضخمة).

## النشر

مجلد `out/` الثابت يعمل على Vercel وNetlify وCloudflare Pages وGitHub Pages. راجع `DEPLOY_AR.md`. سير عمل Pages يستخدم **pnpm**.
