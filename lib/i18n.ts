/**
 * Bilingual (Arabic-first / English) dictionary for the ParseFlow interface.
 * Arabic is the primary target audience, English is offered as a first-class
 * secondary language. Add new UI strings here rather than hard-coding them
 * in components, so every label ships in both languages together.
 */

export type Lang = 'ar' | 'en';

export const LANG_STORAGE_KEY = 'parseflow.lang';

type Dict = Record<string, { ar: string; en: string }>;

export const STRINGS: Dict = {
  brandName: { ar: 'بارس فلو', en: 'ParseFlow' },
  brandTagline: { ar: 'استوديو النصوص والملفات', en: 'Document & Text Studio' },
  brandParent: { ar: 'منتج من ديشا برو ستوديو', en: 'A Disha Pro Studio product' },
  privacyBadge: { ar: 'ملفاتك تُعالج على جهازك فقط', en: 'Your files are processed on your device' },
  version: { ar: 'الإصدار 2.0', en: 'v2.0' },
  langSwitch: { ar: 'English', en: 'العربية' },

  eyebrow: { ar: 'مساحة عملك، بدون تعقيد', en: 'Your workspace, without the clutter' },
  heroTitle1: { ar: 'من أي مستند،', en: 'From any document,' },
  heroTitle2: { ar: 'إلى نص مفيد.', en: 'to useful text.' },
  heroSubtitle: {
    ar: 'اقرأ، نظّف، حرّر، ابحث وحوّل ملفاتك بأكثر من ٢٥ أداة احترافية — كل ذلك داخل متصفحك.',
    en: 'Read, clean, edit, search and convert your files with 25+ professional tools — entirely inside your browser.',
  },
  signatureBuiltBy: { ar: 'صُنع بواسطة', en: 'BUILT BY' },
  signatureName: { ar: 'ديشا جلال', en: 'DISHA GALAL' },

  step1: { ar: 'إضافة المحتوى', en: 'Add content' },
  dropTitle: { ar: 'ملفاتك تبدأ هنا', en: 'Your files start here' },
  dropSubtitle: { ar: 'اسحب ملفاتك أو اخترها من جهازك', en: 'Drag your files here, or browse your device' },
  chooseFiles: { ar: 'اختيار ملفات', en: 'Choose files' },
  dropHint: { ar: 'حتى 20 MB للملف · 10 ملفات في المرة', en: 'Up to 20 MB per file · 10 files at a time' },
  formatsList: {
    ar: 'TXT · PDF · DOCX · XLSX · PPTX · CSV · HTML · MD · ODT · EPUB · صور (OCR)\nوملفات الأكواد والإعدادات: PY · JS · TS · SH · YAML · JSON · CSS · SQL وغيرها',
    en: 'TXT · PDF · DOCX · XLSX · PPTX · CSV · HTML · MD · ODT · EPUB · Images (OCR)\nplus code & config files: PY · JS · TS · SH · YAML · JSON · CSS · SQL and more',
  },
  encodingLabel: { ar: 'ترميز الملفات النصية', en: 'Text file encoding' },
  encodingUtf8: { ar: 'UTF-8 (افتراضي)', en: 'UTF-8 (default)' },
  encodingWin1256: { ar: 'Windows-1256 — عربي قديم', en: 'Windows-1256 — legacy Arabic' },
  encodingUtf16: { ar: 'UTF-16 LE', en: 'UTF-16 LE' },
  encodingIso: { ar: 'ISO-8859-6', en: 'ISO-8859-6' },
  ocrLabel: { ar: 'تفعيل قراءة الصور وPDF الممسوح (OCR)', en: 'Enable OCR for images & scanned PDFs' },
  ocrHint: {
    ar: 'OCR يحمّل نموذج العربية والإنجليزية عند أول استخدام، وقد يستهلك بيانات ووقتًا. عند تفعيله يقرأ كل صفحات PDF كصور؛ يفيد عند ظهور العربية معكوسة. الحد 20 صفحة.',
    en: 'OCR downloads Arabic + English models on first use and can take time. When enabled it reads every PDF page as an image — useful if Arabic text renders reversed. Limit: 20 pages.',
  },

  queueTitle: { ar: 'الملفات المقروءة', en: 'Loaded files' },
  queueEmpty: { ar: 'ستظهر ملفاتك هنا. يمكن دمجها تلقائيًا أو فتح نص كل ملف.', en: 'Your files will appear here. They are merged automatically, or open any one on its own.' },
  queueHint: { ar: 'المحتوى مؤقت؛ إغلاق الصفحة يمسحه. نزّل ما تريد الاحتفاظ به.', en: 'Content is temporary — closing the tab clears it. Download anything you want to keep.' },

  step2: { ar: 'مساحة التحرير', en: 'Editing workspace' },
  undo: { ar: 'تراجع', en: 'Undo' },
  copy: { ar: 'نسخ', en: 'Copy' },
  copied: { ar: 'تم نسخ النص.', en: 'Text copied.' },
  copyFailed: { ar: 'تعذر النسخ. حدّد النص وانسخه يدويًا.', en: 'Copy failed — select the text and copy it manually.' },
  editorPlaceholder: {
    ar: 'اكتب أو الصق نصك هنا…\n\nأو أضف ملفًا وستجد محتواه جاهزًا للتحرير.',
    en: 'Type or paste your text here…\n\nor add a file and its content will be ready to edit.',
  },
  statWords: { ar: 'كلمة', en: 'words' },
  statChars: { ar: 'حرف', en: 'characters' },
  statLines: { ar: 'سطر', en: 'lines' },
  statReading: { ar: 'قراءة ≈', en: 'reading ≈' },
  statMinutes: { ar: 'دقيقة', en: 'min' },

  readyStatus: { ar: 'جاهز للعمل. المعاينة لا تحفظ ملفاتك؛ لا يتم تنزيل شيء تلقائيًا.', en: 'Ready to work. Nothing is saved or downloaded automatically.' },

  tabClean: { ar: 'تنظيف', en: 'Clean' },
  tabSearch: { ar: 'بحث واستخراج', en: 'Search & extract' },
  tabAnalysis: { ar: 'تحليل ومقارنة', en: 'Analyze & compare' },
  tabSecure: { ar: 'تشفير', en: 'Encrypt' },

  cleanTitle: { ar: 'نص مرتب، بخطوة واحدة', en: 'Tidy text, one click away' },
  toolClean: { ar: 'تنظيف المسافات', en: 'Trim whitespace' },
  toolEmpty: { ar: 'حذف السطور الفارغة', en: 'Remove blank lines' },
  toolDedupe: { ar: 'إزالة السطور المكررة', en: 'Remove duplicate lines' },
  toolDedupeSmart: { ar: 'إزالة التكرار الذكي', en: 'Smart de-duplicate' },
  toolSort: { ar: 'ترتيب أبجدي ↑', en: 'Sort A→Z' },
  toolReverse: { ar: 'ترتيب أبجدي ↓', en: 'Sort Z→A' },
  toolArabic: { ar: 'إزالة التشكيل والتطويل', en: 'Strip Arabic diacritics' },
  toolUnify: { ar: 'توحيد صيغ الحروف العربية', en: 'Unify Arabic letter forms' },
  toolPresentation: { ar: 'إصلاح حروف PDF العربية', en: 'Fix Arabic PDF glyphs' },
  toolDigitsEn: { ar: 'أرقام إنجليزية 0-9', en: 'Digits → 0-9' },
  toolDigitsAr: { ar: 'أرقام عربية ٠-٩', en: 'Digits → ٠-٩' },
  toolUpper: { ar: 'UPPERCASE', en: 'UPPERCASE' },
  toolLower: { ar: 'lowercase', en: 'lowercase' },
  modifiedMsg: { ar: 'تم التعديل. يمكنك التراجع قبل التنزيل.', en: 'Applied. You can undo before downloading.' },

  findLabel: { ar: 'ابحث عن', en: 'Find' },
  replaceLabel: { ar: 'استبدله بـ', en: 'Replace with' },
  replaceAll: { ar: 'استبدال الكل', en: 'Replace all' },
  matchesWord: { ar: 'تطابق', en: 'matches' },
  regexOption: { ar: 'تعبير نمطي (Regex)', en: 'Regex' },
  caseOption: { ar: 'حساس لحالة الأحرف', en: 'Case-sensitive' },
  arabicOption: { ar: 'بحث عربي ذكي (يتجاهل التشكيل والهمزات)', en: 'Arabic-aware (ignores diacritics/hamza forms)' },
  extractLinks: { ar: 'استخراج الروابط', en: 'Extract links' },
  extractEmails: { ar: 'استخراج الإيميلات', en: 'Extract emails' },
  extractPhones: { ar: 'أرقام هاتف محتملة', en: 'Possible phone numbers' },

  topWords: { ar: 'أكثر الكلمات تكرارًا', en: 'Most frequent words' },
  topWordsEmpty: { ar: 'أضف نصًا لعرض التحليل.', en: 'Add text to see analysis.' },
  compareLabel: { ar: 'نص ثانٍ للمقارنة', en: 'Second text to compare' },
  compareBtn: { ar: 'قارن السطور (حتى 100 ألف حرف)', en: 'Compare lines (up to 100k characters)' },
  similarBtn: { ar: 'تجميع السطور المتشابهة', en: 'Group similar lines' },

  secureTitle: { ar: 'تشفير ملف بكلمة سر', en: 'Encrypt a file with a password' },
  secureHint: {
    ar: 'صيغة الويب DPRO1 تستخدم AES-GCM. يمكن الآن فك ملفات TPPF1 بصيغة .enc من السكريبت القديم تلقائيًا. فقدان كلمة السر يعني فقدان إمكانية الاستعادة.',
    en: 'The web format DPRO1 uses AES-GCM encryption. Legacy TPPF1 .enc files from the old script are auto-detected and decrypted too. Losing the password means losing the file for good.',
  },
  passwordPlaceholder: { ar: 'كلمة سر من 10 أحرف على الأقل', en: 'Password — at least 10 characters' },
  encryptBtn: { ar: 'تشفير وتنزيل', en: 'Encrypt & download' },
  decryptBtn: { ar: 'فك التشفير وتنزيل', en: 'Decrypt & download' },

  sessionTitle: { ar: 'كمّل شغلك في أي وقت', en: 'Pick up where you left off' },
  sessionHint: {
    ar: 'احفظ النص الحالي وإعدادات التصدير في ملف على جهازك، ثم افتحه هنا لاحقًا. لا يشمل الملفات الأصلية أو كلمات السر. ملف الجلسة غير مشفر.',
    en: 'Save the current text and export settings to a file, then reopen it here later. Original files and passwords are not included. The session file is not encrypted.',
  },
  saveSession: { ar: 'حفظ الجلسة', en: 'Save session' },
  restoreSession: { ar: 'استرجاع جلسة', en: 'Restore session' },

  step3: { ar: 'ملفك، بصيغتك', en: 'Your file, your format' },
  exportHint: { ar: 'تصدير المحتوى النصي؛ لا يُحافظ على تصميم المستند الأصلي.', en: 'Exports the text content — original document styling is not preserved.' },
  fileNameLabel: { ar: 'اسم الملف الناتج', en: 'Output file name' },
  formatLabel: { ar: 'صيغة التنزيل', en: 'Download format' },
  downloadBtn: { ar: 'تنزيل الملف', en: 'Download file' },
  printPdfBtn: { ar: 'طباعة / PDF', en: 'Print / PDF' },
  pdfHint: { ar: 'اختر «حفظ بتنسيق PDF» من نافذة الطباعة.', en: 'Choose “Save as PDF” in the print dialog that opens.' },

  roadmapSummary: { ar: 'الصيغ المدعومة وخطة التطوير', en: 'Supported formats & roadmap' },
  roadmapP1: {
    ar: 'متاح: نصوص وأكواد، PDF نصي، Word DOCX، جداول XLS/XLSX، عروض PPTX، ODT وEPUB، وOCR لصور PNG/JPG/WebP وPDF. قراءة الجداول والعروض تحولها إلى محتوى نصي. الملفات المحمية بكلمة سر وDOC/PPT القديمة غير مدعومة. OCR قد يخطئ، خصوصًا مع الخط اليدوي والجداول.',
    en: 'Available: plain text & code, text-based PDF, Word DOCX, XLS/XLSX spreadsheets, PPTX slides, ODT & EPUB, and OCR for PNG/JPG/WebP images and scanned PDFs. Spreadsheets and slides are converted to text content. Password-protected files and legacy DOC/PPT are not supported. OCR can make mistakes, especially with handwriting and tables.',
  },
  roadmapP2: {
    ar: 'تم إنجاز: فتح تشفير السكريبت القديم، بحث عربي ذكي بالتعبيرات النمطية، وحفظ الجلسة اختياريًا. المرحلة التالية: تحسين ترتيب أعمدة PDF العربية، تحويل يحافظ على التنسيق عبر خدمة Python، وتفريغ الصوت والفيديو مع اختيار صريح للمزوّد.',
    en: 'Shipped: legacy script decryption, Arabic-aware regex search, and optional session saving. Coming next: better Arabic PDF column ordering, format-preserving conversion via a Python service, and audio/video transcription with an explicit provider choice.',
  },

  footerTagline: { ar: 'صُنع للنصوص العربية، ولشغلك اليومي.', en: 'Built for Arabic text, and your everyday work.' },
  footerRights: { ar: 'بارس فلو © 2026 · منتج من ديشا برو ستوديو', en: 'ParseFlow © 2026 · A Disha Pro Studio product' },

  errFileTooLarge: { ar: 'النص أكبر من الحد المسموح: مليونا حرف.', en: 'Text exceeds the allowed limit of two million characters.' },
  errMaxFiles: { ar: 'الحد الأقصى 10 ملفات في المرة.', en: 'Maximum 10 files at a time.' },
  loadingFiles: { ar: 'جارٍ قراءة الملفات…', en: 'Reading files…' },
  filesReadMsg: { ar: 'ملف', en: 'file(s)' },
  reviewMsg: { ar: 'راجع النص قبل تنزيله.', en: 'Review the text before downloading.' },
  ocrCloseFail: { ar: 'تعذر إغلاق محرك OCR؛ أعد تحميل الصفحة عند الحاجة.', en: 'Could not shut down the OCR engine; refresh the page if needed.' },
  exportReady: { ar: 'الملف جاهز للتنزيل.', en: 'Your file is ready to download.' },
  cryptoDone: { ar: 'تمت العملية. احتفظ بكلمة السر لاستعادة الملف.', en: 'Done. Keep the password safe to restore the file.' },
  cryptoFail: { ar: 'تعذرت العملية: راجع كلمة السر وصيغة الملف وحجمه (20 MB).', en: 'The operation failed — check the password, file format and size (20 MB).' },
  sessionSaved: { ar: 'تم تنزيل الجلسة كنص غير مشفر. احتفظ بها في مكان مناسب.', en: 'Session downloaded as unencrypted text. Store it somewhere safe.' },
  sessionRestored: { ar: 'تم استرجاع النص وإعدادات التصدير. يمكنك التراجع عن استبدال النص.', en: 'Text and export settings restored. You can undo the text replacement.' },
  sessionInvalid: { ar: 'ملف الجلسة غير صالح أو أكبر من الحد المسموح.', en: 'Session file is invalid or larger than allowed.' },
};

export function t(lang: Lang, key: keyof typeof STRINGS): string {
  return STRINGS[key]?.[lang] ?? String(key);
}
