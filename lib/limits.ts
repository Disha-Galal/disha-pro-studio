export const LIMITS = {
  fileBytes: 20 * 1024 * 1024,
  archiveBytes: 60 * 1024 * 1024,
  chars: 2_000_000,
  pdfPages: 200,
  /** Max pages OCR'd in a single PDF. */
  ocrPages: 20,
  /** Max OCR pages across one Process run (all files combined). Prevents multi-file hangs. */
  ocrBatchPages: 40,
  /** Soft cap on DOCX paragraphs so export does not freeze the tab. */
  exportParagraphs: 50_000,
} as const;
export const IMAGE_EXTENSIONS: readonly string[] = ['png', 'jpg', 'jpeg', 'webp'];
export const TEXT_EXTENSIONS: readonly string[] = ['txt', 'md', 'csv', 'tsv', 'json', 'html', 'htm', 'xml', 'log', 'py', 'js', 'ts', 'css', 'php', 'yml', 'yaml', 'ini', 'cfg', 'conf', 'sql', 'sh', 'toml', 'srt', 'vtt', 'rst', 'tex'];
export type ExportFormat = 'txt' | 'md' | 'html' | 'json' | 'csv' | 'pdf' | 'docx';
