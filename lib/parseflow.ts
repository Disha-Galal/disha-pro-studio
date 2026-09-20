/** ParseFlow pipeline: read files → clean up → merge → stats. Pure logic, no React. */
import { UserError } from './errors';
import { LIMITS, type ExportFormat } from './limits';
import { readDocument, releaseOcr, statistics, takeNotes, transform } from './processor';

/** Clean-up steps in execution order. Each `id` is a case handled by transform() in lib/text-tools.ts. */
export const CLEANUP_STEPS = [
  { id: 'presentation', label: 'Fix Arabic glyph forms from PDFs' },
  { id: 'arabic', label: 'Strip Arabic diacritics & tatweel' },
  { id: 'unify', label: 'Unify Arabic letter variants (أ إ آ → ا)' },
  { id: 'digits-en', label: 'Convert digits to 0-9' },
  { id: 'clean', label: 'Normalize spaces & line breaks' },
  { id: 'empty', label: 'Remove all blank lines' },
  { id: 'dedupe', label: 'Remove duplicate lines' },
] as const;

export const OUTPUT_FORMATS: { id: ExportFormat; label: string }[] = [
  { id: 'txt', label: 'TXT — plain text' },
  { id: 'docx', label: 'DOCX — Word document' },
  { id: 'csv', label: 'CSV — one row per line' },
  { id: 'json', label: 'JSON — text + statistics' },
  { id: 'md', label: 'MD — Markdown' },
  { id: 'html', label: 'HTML — web page' },
  { id: 'pdf', label: 'PDF — via print dialog' },
];

export const ENCODINGS = [
  { id: 'utf-8', label: 'UTF-8 (default)' },
  { id: 'windows-1256', label: 'Windows-1256 (legacy Arabic)' },
  { id: 'utf-16le', label: 'UTF-16 LE' },
  { id: 'iso-8859-6', label: 'ISO-8859-6' },
];

export type Settings = {
  format: ExportFormat;
  encoding: string;
  ocr: boolean;
  steps: string[];
  fileName: string;
};

export const DEFAULT_SETTINGS: Settings = { format: 'txt', encoding: 'utf-8', ocr: false, steps: ['clean'], fileName: '' };

export type ProcessResult = {
  text: string;
  fileCount: number;
  words: number;
  chars: number;
  lines: number;
  warnings: string[];
};

export type ProgressFn = (percent: number, message: string) => void;

const pause = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms)); // lets the browser paint progress

export async function processFiles(files: File[], settings: Settings, onProgress: ProgressFn): Promise<ProcessResult> {
  if (!files.length) throw new UserError('No files to process.');

  const texts: string[] = [];
  const warnings: string[] = [];
  const share = 95 / files.length; // each file owns an equal slice of the bar; the last 5% is finalizing
  let ocrPagesRemaining = settings.ocr ? LIMITS.ocrBatchPages : 0;
  takeNotes(); // discard notes left over from a previous run

  try {
    for (const [index, file] of files.entries()) {
      const start = index * share;
      onProgress(start, `Reading ${file.name} (${index + 1}/${files.length})…`);
      await pause();
      try {
        const { text: raw, ocrPagesUsed } = await readDocument(file, {
          encoding: settings.encoding,
          ocr: settings.ocr,
          ocrPagesRemaining: settings.ocr ? ocrPagesRemaining : undefined,
          update: (message) => onProgress(start + share * 0.4, message),
        });
        if (settings.ocr) ocrPagesRemaining = Math.max(0, ocrPagesRemaining - ocrPagesUsed);
        onProgress(start + share * 0.8, `Cleaning ${file.name}…`);
        await pause();
        const active = CLEANUP_STEPS.filter((step) => settings.steps.includes(step.id));
        texts.push(active.reduce((text, step) => transform(text, step.id), raw));
      } catch (error) {
        warnings.push(`${file.name}: ${error instanceof Error ? error.message : 'could not be processed.'}`);
      }
      onProgress(start + share, `Finished ${file.name}`);
    }
  } finally {
    try {
      await releaseOcr();
    } catch {
      /* the OCR engine is only loaded on demand; a failed shutdown is harmless */
    }
  }

  if (!texts.length) throw new UserError(warnings.join(' • ') || 'No text was found in the uploaded files.');

  onProgress(97, 'Preparing your file…');
  await pause();
  const text = texts.join('\n\n');
  if (text.length > LIMITS.chars) {
    throw new UserError('المحتوى المدموج أكبر من مليوني حرف. قلّل عدد الملفات أو خطوات الدمج.');
  }
  const { words, chars, lines } = statistics(text);
  onProgress(100, 'Done');
  return { text, fileCount: texts.length, words, chars, lines, warnings: [...warnings, ...takeNotes()] };
}
