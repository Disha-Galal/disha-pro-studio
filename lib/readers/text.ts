import { UserError } from '../errors';
import { htmlToText } from '../markup';
import { TEXT_EXTENSIONS } from '../limits';

/** Decodes a plain-text (or HTML) file with the chosen encoding; rejects unsupported or binary content. */
export function readPlainText(data: ArrayBuffer, extension: string, encoding: string): string {
  if (!TEXT_EXTENSIONS.includes(extension)) {
    throw new UserError('صيغة غير مدعومة. جرّب TXT أو PDF أو DOCX.');
  }

  let text: string;
  try {
    text = new TextDecoder(encoding, { fatal: true }).decode(data);
  } catch {
    throw new UserError('الترميز غير مناسب. اختر ترميزًا آخر وأعد فتح الملف.');
  }
  if (text.includes('\0')) throw new UserError('يبدو أن الملف ثنائي وليس نصيًا.');

  return extension === 'html' || extension === 'htm' ? htmlToText(text) : text;
}
