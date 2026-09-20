import { statistics } from './text-tools';
import { save } from './download';
import { UserError } from './errors';
import { LIMITS, type ExportFormat } from './limits';

const escapeHtml = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const FORMATS: readonly ExportFormat[] = ['txt', 'md', 'html', 'json', 'csv', 'pdf', 'docx'];

export async function exportDocument(text: string, format: string, name: string): Promise<void> {
  if (!FORMATS.includes(format as ExportFormat)) throw new UserError('صيغة التصدير غير مدعومة.');
  name = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 100) || 'disha-document';

  const html =
    `<!doctype html><html lang="ar" dir="auto"><meta charset="utf-8"><title>${escapeHtml(name)}</title>` +
    `<style>body{font:16px/1.8 Arial;margin:32px}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}@page{margin:18mm}</style>` +
    `<body><pre dir="auto">${escapeHtml(text)}</pre></body></html>`;

  if (format === 'pdf') {
    const w = window.open('', '_blank');
    if (!w) throw new UserError('اسمح بفتح نافذة الطباعة في المتصفح.');
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
    return;
  }

  if (format === 'docx') {
    const { Document, Packer, Paragraph, TextRun } = await import('docx');
    const lines = text.split('\n');
    if (lines.length > LIMITS.exportParagraphs) {
      throw new UserError(
        `الملف كبير جدًا لتصدير DOCX (${lines.length.toLocaleString('en-US')} سطر). اختر TXT أو قلل المحتوى (الحد ${LIMITS.exportParagraphs.toLocaleString('en-US')} سطر).`,
      );
    }
    const doc = new Document({
      sections: [
        {
          children: lines.map(
            (t) =>
              new Paragraph({
                bidirectional: /[\u0600-\u06ff]/.test(t),
                children: [new TextRun({ text: t, rightToLeft: /[\u0600-\u06ff]/.test(t) })],
              }),
          ),
        },
      ],
    });
    save(await Packer.toBlob(doc), name + '.docx');
    return;
  }

  const output =
    format === 'html'
      ? html
      : format === 'json'
        ? JSON.stringify({ text, statistics: statistics(text) }, null, 2)
        : format === 'csv'
          ? 'line,text\r\n' +
            text
              .split('\n')
              .map((l, i) => `${i + 1},"${(/^[=+@-]/.test(l) ? "'" : '') + l.replace(/"/g, '""')}"`)
              .join('\r\n')
          : text;

  save(
    new Blob([format === 'txt' || format === 'csv' ? '\ufeff' : '', output], {
      type: format === 'html' ? 'text/html;charset=utf-8' : format === 'json' ? 'application/json' : 'text/plain;charset=utf-8',
    }),
    name + '.' + format,
  );
}
