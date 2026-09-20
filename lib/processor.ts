import { UserError } from './errors';
import { exportDocument as baseExportDocument } from './export';
import { IMAGE_EXTENSIONS, LIMITS, type ExportFormat } from './limits';
import { takeNotes } from './notes';
import { readArchive, readDocx, readSpreadsheet } from './readers/office';
import { type ProgressFn, recognizeText, releaseOcr } from './readers/ocr';
import { readPdf } from './readers/pdf';
import { readPlainText } from './readers/text';

export { cryptFile } from './crypto';
export { statistics, transform } from './text-tools';
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

export type ReadOptions = {
  encoding: string;
  ocr: boolean;
  update: ProgressFn;
  /** Remaining OCR page budget for this Process run; ignored when OCR is off. */
  ocrPagesRemaining?: number;
};

export type ReadResult = {
  text: string;
  /** Pages consumed from the OCR budget (0 when OCR was off or unused). */
  ocrPagesUsed: number;
};

/** Reads any supported file into plain text. Throws UserError with an Arabic message on failure. */
export async function readDocument(file: File, options: ReadOptions): Promise<ReadResult> {
  if (file.size > LIMITS.fileBytes) throw new UserError('حجم الملف يتجاوز 20 MB.');

  const data = await file.arrayBuffer();
  const extension = detectExtension(file, data);
  const { encoding, ocr, update, ocrPagesRemaining } = options;

  const { text, ocrPagesUsed } = await readByExtension(
    file,
    data,
    extension,
    encoding,
    ocr,
    update,
    ocrPagesRemaining,
  );

  if (text.length > LIMITS.chars) throw new UserError('المحتوى أكبر من مليوني حرف.');
  if (!text.trim()) throw new UserError('لم يتم العثور على نص.');
  return { text, ocrPagesUsed };
}

async function readByExtension(
  file: File,
  data: ArrayBuffer,
  extension: string,
  encoding: string,
  ocr: boolean,
  update: ProgressFn,
  ocrPagesRemaining: number | undefined,
): Promise<ReadResult> {
  if (IMAGE_EXTENSIONS.includes(extension)) {
    if (!ocr) throw new UserError('فعّل OCR لقراءة الصور.');
    if (ocrPagesRemaining !== undefined && ocrPagesRemaining < 1) {
      throw new UserError(`تم بلوغ حد OCR لهذه الدفعة (${LIMITS.ocrBatchPages} صفحة). عطّل OCR أو قلّل الملفات.`);
    }
    return { text: await recognizeText(file, update), ocrPagesUsed: 1 };
  }
  switch (extension) {
    case 'pdf': {
      const result = await readPdf(data, ocr, update, ocrPagesRemaining);
      return result;
    }
    case 'docx':
      return { text: await readDocx(data), ocrPagesUsed: 0 };
    case 'xlsx':
    case 'xls':
      return { text: await readSpreadsheet(data), ocrPagesUsed: 0 };
    case 'pptx':
    case 'odt':
    case 'epub':
      return { text: await readArchive(data, extension), ocrPagesUsed: 0 };
    default:
      return { text: readPlainText(data, extension, encoding), ocrPagesUsed: 0 };
  }
}
