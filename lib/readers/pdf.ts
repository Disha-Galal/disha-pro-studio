import { UserError } from '../errors';
import { LIMITS } from '../limits';
import { fixPresentationForms } from '../text-tools';
import { itemsToBoxes, layoutPage } from '../pdf-layout';
import { pushNote } from '../notes';
import { recognizeText, type ProgressFn } from './ocr';

const PDF_WORKER_SRC = '/pdf.worker.min.mjs';
const MAX_OCR_PIXELS = 16_000_000;

type PdfPage = {
  getTextContent(): Promise<{ items: unknown[] }>;
  getViewport(params: { scale: number }): { transform: number[]; width: number; height: number };
  render(params: { canvas: HTMLCanvasElement; canvasContext: CanvasRenderingContext2D; viewport: unknown }): { promise: Promise<void> };
  cleanup(): void;
};

/**
 * Reads a PDF's text, reconstructing reading order from run positions (handles multi-column
 * and right-to-left/Arabic layouts — see lib/pdf-layout.ts). With `ocr` on, each page is
 * rendered to a canvas and OCR'd instead, which also handles scanned (image-only) PDFs.
 */
export async function readPdf(data: ArrayBuffer, ocr: boolean, update: ProgressFn): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
  const task = pdfjs.getDocument({
    data: new Uint8Array(data),
    cMapUrl: '/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/standard_fonts/',
  });

  try {
    const pdf = await task.promise;
    const pageLimit = ocr ? LIMITS.ocrPages : LIMITS.pdfPages;
    if (pdf.numPages > pageLimit) {
      throw new UserError(ocr ? `حد OCR هو ${LIMITS.ocrPages} صفحة.` : `الحد ${LIMITS.pdfPages} صفحة.`);
    }

    const pages: string[] = [];
    const emptyPages: number[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      update(`قراءة الصفحة ${i} من ${pdf.numPages}`);
      const page = (await pdf.getPage(i)) as PdfPage;
      try {
        const pageText = ocr ? await ocrPage(page, update) : await layoutPageText(page);
        if (pageText.trim()) pages.push(fixPresentationForms(pageText));
        else emptyPages.push(i);
      } finally { page.cleanup(); }
    }

    if (!pages.length) throw new UserError('لا يوجد نص قابل للاستخراج. فعّل OCR لقراءة الملف كصور.');
    if (emptyPages.length) {
      const shown = emptyPages.slice(0, 8).join('، ') + (emptyPages.length > 8 ? '…' : '');
      pushNote(`تم تخطي ${emptyPages.length} صفحة بلا نص (${shown}).`);
    }
    return pages.join('\n\n');
  } finally {
    await task.destroy();
  }
}

/** Text of one page in visual reading order (columns, then lines within each column). */
async function layoutPageText(page: PdfPage): Promise<string> {
  const content = await page.getTextContent();
  const { transform } = page.getViewport({ scale: 1 });
  return layoutPage(itemsToBoxes(content.items, transform));
}

async function ocrPage(page: PdfPage, update: ProgressFn): Promise<string> {
  const viewport = page.getViewport({ scale: 1.5 });
  if (viewport.width * viewport.height > MAX_OCR_PIXELS) {
    throw new UserError('أبعاد الصفحة كبيرة جدًا لقراءة الصور.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  try {
    const canvasContext = canvas.getContext('2d');
    if (!canvasContext) throw new UserError('تعذر تجهيز الصورة لقراءة النص.');
    await page.render({ canvas, canvasContext, viewport }).promise;
    return await recognizeText(canvas, update);
  } finally { canvas.width = canvas.height = 0; }
}
