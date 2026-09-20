/**
 * File-type gate for ParseFlow.
 * Only formats the processing engine (lib/processor.ts) can read are accepted.
 * To support a new type: add it here AND make sure lib/processor.ts can read it.
 */
import { LIMITS } from './limits';

export const ACCEPTED_EXTENSIONS = ['pdf', 'docx', 'txt'] as const;
export type AcceptedExtension = (typeof ACCEPTED_EXTENSIONS)[number];

/** Value for <input accept="…"> — the browser file picker filters by this list. */
export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.map((ext) => `.${ext}`).join(',');
export const MAX_FILES = 10;

export type Verdict = { ok: true; extension: AcceptedExtension } | { ok: false; reason: string };

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]; // "PK\x03\x04" — DOCX is a ZIP container

const hasSignature = (bytes: Uint8Array, signature: number[]) =>
  signature.every((byte, i) => bytes[i] === byte);

/** Checks the extension, the size AND the real file signature, so a renamed file cannot slip through. */
export async function validateFile(file: File): Promise<Verdict> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const accepted = (ACCEPTED_EXTENSIONS as readonly string[]).includes(extension);
  if (!accepted) return { ok: false, reason: `“${file.name}” is not supported. Upload PDF, DOCX or TXT files only.` };
  if (file.size === 0) return { ok: false, reason: `“${file.name}” is empty.` };
  if (file.size > LIMITS.fileBytes) return { ok: false, reason: `“${file.name}” is larger than 20 MB.` };

  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const isPdf = hasSignature(head, PDF_SIGNATURE);
  const isZip = hasSignature(head, ZIP_SIGNATURE);
  const matches =
    extension === 'pdf' ? isPdf : extension === 'docx' ? isZip : !isPdf && !isZip; // TXT must not be a disguised PDF/ZIP
  if (!matches) return { ok: false, reason: `“${file.name}” does not match its file extension.` };

  return { ok: true, extension: extension as AcceptedExtension };
}
