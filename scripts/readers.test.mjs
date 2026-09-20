import assert from 'node:assert/strict';
import { readPlainText } from '../lib/readers/text.ts';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const enc = (s) => new TextEncoder().encode(s).buffer;

t('readPlainText: decodes utf-8, passes plain text through untouched', () => {
  assert.equal(readPlainText(enc('مرحبا\nسطر ثانٍ'), 'txt', 'utf-8'), 'مرحبا\nسطر ثانٍ');
});
t('readPlainText: runs html through htmlToText', () => {
  const html = '<h1>عنوان</h1><p>فقرة</p>';
  assert.equal(readPlainText(enc(html), 'html', 'utf-8'), 'عنوان\nفقرة');
});
t('readPlainText: rejects unsupported extensions', () => {
  assert.throws(() => readPlainText(enc('x'), 'exe', 'utf-8'), /صيغة غير مدعومة/);
});
t('readPlainText: rejects binary content (NUL byte)', () => {
  const bytes = new Uint8Array([104, 105, 0, 106]);
  assert.throws(() => readPlainText(bytes.buffer, 'txt', 'utf-8'), /ثنائي/);
});
console.log(`\n${n} tests passed`);
