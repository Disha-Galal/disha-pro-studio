# الخروج من عباءة ChatGPT Sites — استضافة مستقلة ومجانية

هذا الملف يشرح كيف تنقل Disha Pro Studio من `amgroblica.chatgpt.site` إلى استضافة تملكها أنت بالكامل،
بدون أي اشتراك مدفوع وبنفس المستوى الاحترافي (HTTPS تلقائي، نطاق مخصص، نشر تلقائي من GitHub).

## لماذا هذا ممكن بسهولة

فحصت الكود ووجدت أن التطبيق:
- لا يحتوي أي API route ولا Server Action ولا اتصال بقاعدة بيانات (`d1` و`r2` غير مفعّلين أصلًا في `.openai/hosting.json`).
- كل صفحة مكتوبة `'use client'` — المعالجة كلها تتم داخل متصفح الزائر.
- كود التوثيق عبر ChatGPT (`app/chatgpt-auth.ts`) موجود لكنه **غير مستخدم فعليًا** في `app/page.tsx`.

هذا يعني أن الموقع "ثابت بالكامل من حيث الوظيفة" رغم أنه مبني بـ Next.js، فيمكن تصديره كملفات HTML/JS ثابتة
تعمل على أي استضافة ثابتة مجانية، دون حاجة لخادم Node أو Cloudflare Workers.

## التعديلات التي طبّقتها في هذه النسخة

1. `next.config.ts`: أضفت `output: "export"` لجعل `next build` ينتج مجلد `out/` ثابتًا بالكامل.
2. `package.json`: أوامر `dev` و`build` أصبحت أوامر Next.js القياسية (`next dev`, `next build`) بدل `run-framework.mjs`
   المرتبط بـ Sites. أوامر Sites القديمة محفوظة تحت `sites:dev` و`sites:build` إن احتجتها لاحقًا.
3. أضفت `vercel.json` و`netlify.toml` و`.github/workflows/deploy-pages.yml` — إعدادات جاهزة لثلاث استضافات مجانية.

## خطوات النشر (اختر واحدة)

### الخيار الأول — Vercel (الأسهل، أنصح به)
1. أنشئ حساب مجاني على vercel.com بحساب GitHub.
2. ارفع هذا المجلد إلى مستودع GitHub جديد (خاص أو عام).
3. من لوحة Vercel: Add New Project → اختر المستودع → اضغط Deploy. لا حاجة لأي إعداد يدوي، `vercel.json` يضبط كل شيء.
4. تحصل على رابط `xxx.vercel.app` فورًا، ويمكنك ربط نطاق مخصص مجانًا من نفس اللوحة.
5. كل `git push` بعدها ينشر نسخة جديدة تلقائيًا.

### الخيار الثاني — Cloudflare Pages (لو تريد تبقى على Cloudflare لكن بدون OpenAI Sites)
1. أنشئ حساب Cloudflare مجاني → Workers & Pages → Create → Pages → Connect to Git.
2. اختر المستودع، اضبط أمر البناء `pnpm run build` ومجلد الإخراج `out`.
3. Cloudflare يبني وينشر تلقائيًا مع كل push، ويعطيك رابط `xxx.pages.dev` + شهادة HTTPS مجانية.

### الخيار الثالث — GitHub Pages (مجاني بالكامل بدون أي طرف ثالث)
1. ادفع المشروع إلى مستودع GitHub، وفعّل Pages من Settings → Pages → Source: GitHub Actions.
2. ملف `.github/workflows/deploy-pages.yml` المرفق يبني وينشر تلقائيًا عند كل push على `main`.
3. الرابط يكون `username.github.io/repo-name`، ويمكن ربط نطاق مخصص مجانًا (ملف CNAME).

### الخيار الرابع — Netlify
1. أنشئ حساب مجاني، Add new site → Import from Git → اختر المستودع.
2. `netlify.toml` المرفق يضبط أمر البناء ومجلد الإخراج تلقائيًا.

## التحقق قبل النشر (نفّذها محليًا أو في GitHub Actions)

```bash
pnpm install --frozen-lockfile
pnpm run lint
pnpm run build   # ينتج مجلد out/ — افتح out/index.html للتأكد
```

## ملاحظات مهمة

- ميزة OCR وتحميل خطوط PDF.js تحتاج إنترنت عند أول استخدام بغض النظر عن الاستضافة — هذا سلوك التطبيق نفسه وليس قيدًا من الاستضافة.
- `wrangler` و`vinext` و`@cloudflare/vite-plugin` بقيت في `devDependencies` فقط لو رغبت بالرجوع لمسار Sites، ولا تُستخدم في مسار التصدير الثابت الجديد. يمكن حذفها لاحقًا لتخفيف حجم `node_modules`.
- بعد التأكد من نجاح الموقع على الاستضافة الجديدة، يمكنك إلغاء ربط الموقع القديم على Sites من إعدادات حسابك في ChatGPT.

> ملاحظة: ملف سير عمل GitHub Pages موجود كنموذج في `docs/github-workflow-deploy-pages.yml` — انسخه إلى `.github/workflows/` يدويًا إن رغبت بالنشر التلقائي (يتطلب صلاحية `workflow` على التوكن).
