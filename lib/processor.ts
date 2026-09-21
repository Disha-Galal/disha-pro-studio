import { UserError } from './errors';
import { exportDocument as baseExportDocument } from './export';
import { IMAGE_EXTENSIONS, LIMITS, type ExportFormat } from './limits';
import { takeNotes } from './notes';
import { readArchive, readDocx, readSpreadsheet } from './readers/office';
import { type ProgressFn, recognizeText, releaseOcr } from './readers/ocr';
import { readPdf } from './readers/pdf';
import { readPlainText } from './readers/text';

export { cryptFile } from './crypto';
export { statistics, transform, buildRegex, findCount, replaceInText, groupSimilar } from './text-tools';
export type { FindOpts } from './text-tools';
export { releaseOcr, takeNotes };

/** Loose string in, validated against ExportFormat internally — keeps callers from needing the union type. */
export function exportDocument(text: string, format: string, rawName: string): Promise<void> {
  return baseExportDocument(text, format as ExportFormat, rawName);
}

/** "%PDF-" magic bytes beat the file extension — a mislabeled .txt that's really a PDF still reads as one. */
function detectExtension(file: File, data: ArrayBuffer): string {
  const declared = file.name.split('.').pop()?.toLowerCase() ?? '';
  const looksLikePdf = new TextDecoder().decode(data.slice(0, 5)) === '%PDF-';
  return looksLikePdf ? 'pdf' : declared;
}

/** Reads any supported file into plain text. Throws UserError with an Arabic message on failure. */
export async function readDocument(file: File, encoding: string, ocr: boolean, update: ProgressFn): Promise<string> {
  if (file.size > LIMITS.fileBytes) throw new UserError('حجم الملف يتجاوز 20 MB.');

  const data = await file.arrayBuffer();
  const extension = detectExtension(file, data);

  const text = await readByExtension(file, data, extension, encoding, ocr, update);

  if (text.length > LIMITS.chars) throw new UserError('المحتوى أكبر من مليوني حرف.');
  if (!text.trim()) throw new UserError('لم يتم العثور على نص.');
  return text;
}

function readByExtension(
  file: File,
  data: ArrayBuffer,
  extension: string,
  encoding: string,
  ocr: boolean,
  update: ProgressFn,
): Promise<string> | string {
  if (IMAGE_EXTENSIONS.includes(extension)) {
    if (!ocr) throw new UserError('فعّل OCR لقراءة الصور.');
    return recognizeText(file, update);
  }
  switch (extension) {
    case 'pdf':
      return readPdf(data, ocr, update);
    case 'docx':
      return readDocx(data);
    case 'xlsx':
    case 'xls':
      return readSpreadsheet(data);
    case 'pptx':
    case 'odt':
    case 'epub':
      return readArchive(data, extension);
    default:
      return readPlainText(data, extension, encoding);
  }
}
