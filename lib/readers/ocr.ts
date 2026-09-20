/** OCR (Tesseract, Arabic + English), with one worker reused across a batch of files/pages. */

export type ProgressFn = (message: string) => void;

type OcrWorker = import('tesseract.js').Worker;

let ocrWorker: OcrWorker | null = null;
let reportProgress: ProgressFn = () => {};

/** Frees the OCR engine; call once after a batch of files is done. */
export async function releaseOcr(): Promise<void> {
  const worker = ocrWorker;
  ocrWorker = null;
  reportProgress = () => {};
  if (worker) await worker.terminate();
}

/** Recognizes text in an image (a File, an ImageBitmap, or a canvas). */
export async function recognizeText(source: import('tesseract.js').ImageLike, update: ProgressFn): Promise<string> {
  reportProgress = update;
  if (!ocrWorker) {
    update('تحميل نموذج القراءة (أول مرة فقط)…');
    const { createWorker } = await import('tesseract.js');
    ocrWorker = await createWorker('ara+eng', 1, {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'recognizing text') reportProgress(`قراءة الصورة: ${Math.round(m.progress * 100)}٪`);
      },
    });
  }
  return (await ocrWorker.recognize(source)).data.text;
}
