export const LIMITS = {
  fileBytes: 20 * 1024 * 1024,
  archiveBytes: 60 * 1024 * 1024,
  chars: 2_000_000,
  pdfPages: 200,
  ocrPages: 20,
} as const;
export const IMAGE_EXTENSIONS: readonly string[] = ['png', 'jpg', 'jpeg', 'webp'];
export const TEXT_EXTENSIONS: readonly string[] = ['txt', 'md', 'csv', 'tsv', 'json', 'html', 'htm', 'xml', 'log', 'py', 'js', 'ts', 'css', 'php', 'yml', 'yaml', 'ini', 'cfg', 'conf', 'sql', 'sh', 'toml', 'srt', 'vtt', 'rst', 'tex'];
export type ExportFormat = 'txt' | 'md' | 'html' | 'json' | 'csv' | 'pdf' | 'docx';
