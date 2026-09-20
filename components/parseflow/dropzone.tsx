'use client';

import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { Upload } from 'lucide-react';
import { ACCEPT_ATTRIBUTE, validateFile } from '@/lib/validate';

type Props = {
  disabled: boolean;
  onAccepted: (files: File[]) => void;
  onRejected: (reasons: string[]) => void;
};

/** Drag-and-drop box. Every file is validated (type, size, signature) before it reaches the page. */
export function Dropzone({ disabled, onAccepted, onRejected }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  async function handle(list: FileList | null) {
    if (!list || disabled) return;
    const accepted: File[] = [];
    const rejected: string[] = [];
    try {
      for (const file of Array.from(list)) {
        try {
          const verdict = await validateFile(file);
          if (verdict.ok) accepted.push(file);
          else rejected.push(verdict.reason);
        } catch {
          rejected.push(`“${file.name}” could not be read.`);
        }
      }
    } catch {
      rejected.push('Could not read the selected files.');
    }
    onRejected(rejected);
    if (accepted.length) onAccepted(accepted);
    if (inputRef.current) inputRef.current.value = ''; // allow picking the same file again
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void handle(event.dataTransfer.files);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      inputRef.current?.click();
    }
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label="Upload files. Drag and drop, or press Enter to browse."
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={onKeyDown}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={[
        'flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition sm:py-16',
        'outline-offset-4 focus-visible:outline-2 focus-visible:outline-navy-600',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        dragging ? 'border-navy-700 bg-steel-200' : 'border-steel-400 bg-steel-100 hover:border-navy-700 hover:bg-steel-200',
      ].join(' ')}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => void handle(event.target.files)}
      />
      <span className="mb-5 flex size-16 items-center justify-center rounded-full bg-navy-800 text-white shadow-lg shadow-navy-900/30">
        <Upload size={28} aria-hidden />
      </span>
      <p className="text-xl font-bold text-navy-900 sm:text-2xl">Drag &amp; drop your files here</p>
      <p className="mt-2 text-steel-600">
        or <span className="font-semibold text-navy-700 underline underline-offset-4">click to browse</span>
      </p>
      <p className="mt-5 text-sm font-medium tracking-wide text-steel-500">
        PDF · DOCX · TXT &nbsp;|&nbsp; up to 20 MB per file &nbsp;|&nbsp; up to 10 files
      </p>
    </div>
  );
}
