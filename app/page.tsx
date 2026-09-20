'use client';

import { useRef, useState } from 'react';
import { Download, FileText, LockKeyhole, ShieldCheck, Undo2, X, Zap } from 'lucide-react';
import { AdvancedSettings } from '@/components/parseflow/advanced-settings';
import { Dropzone } from '@/components/parseflow/dropzone';
import { DEFAULT_SETTINGS, processFiles, type ProcessResult, type Settings } from '@/lib/parseflow';
import { exportDocument } from '@/lib/processor';
import { MAX_FILES } from '@/lib/validate';

type Phase = 'idle' | 'processing' | 'done';

const fileKey = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;
const formatSize = (bytes: number) => (bytes < 1_048_576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1_048_576).toFixed(1)} MB`);

const BADGES = [
  { icon: ShieldCheck, label: 'Enterprise-Grade Security' },
  { icon: LockKeyhole, label: 'Files Never Leave Your Browser' },
  { icon: Zap, label: 'PDF · DOCX · TXT' },
];

export default function Home() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [files, setFiles] = useState<File[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [progress, setProgress] = useState({ percent: 0, message: '' });
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const startingRef = useRef(false);

  function addFiles(incoming: File[]) {
    const known = new Set(files.map(fileKey));
    const merged = [...files, ...incoming.filter((f) => !known.has(fileKey(f)))];
    setFiles(merged.slice(0, MAX_FILES));
    if (merged.length > MAX_FILES) setErrors((old) => [...old, `Only ${MAX_FILES} files can be processed at a time.`]);
  }

  async function start() {
    if (startingRef.current || !files.length) return;
    startingRef.current = true;
    setErrors([]);
    setProgress({ percent: 0, message: 'Starting…' });
    setPhase('processing');
    try {
      setResult(await processFiles(files, settings, (percent, message) => setProgress({ percent, message })));
      setPhase('done');
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Processing failed. Please try again.']);
      setPhase('idle');
    } finally {
      startingRef.current = false;
    }
  }

  async function download() {
    if (!result) return;
    const baseName = files[0]?.name.replace(/\.[^.]+$/, '') ?? 'parseflow';
    try {
      await exportDocument(result.text, settings.format, settings.fileName.trim() || `${baseName}-processed`);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Download failed.']);
    }
  }

  function reset() {
    setFiles([]);
    setResult(null);
    setErrors([]);
    setPhase('idle');
  }

  const busy = phase === 'processing';

  return (
    <div className="flex min-h-screen flex-col bg-linear-to-b from-navy-950 via-navy-900 to-navy-800 font-sans" dir="ltr">
      <header className="mx-auto flex w-full max-w-5xl items-center gap-3 px-5 py-6">
        <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
          <rect width="40" height="40" rx="10" fill="#0f2a5a" stroke="#c5cdd9" strokeWidth="1.5" />
          <path d="M9 14h14M9 20h22M9 26h14" stroke="#e4e9f0" strokeWidth="3" strokeLinecap="round" />
          <circle cx="30" cy="14" r="3" fill="#9aa5b5" />
        </svg>
        <div className="leading-tight">
          <p className="text-xl font-extrabold tracking-wide text-white">ParseFlow</p>
          <p className="text-xs text-steel-300">by Disha Pro Studio</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-16">
        <section className="py-10 text-center sm:py-14">
          <h1 className="text-4xl font-black uppercase leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            Process thousands of rows <span className="metallic-text">in seconds</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-steel-300">
            Upload your documents, clean and structure the text, and download a processed file — all in one flow.
          </p>
        </section>

        {phase !== 'done' && (
          <section aria-label="Upload" className="rounded-3xl border border-steel-300 bg-white p-5 shadow-2xl shadow-black/40 sm:p-8">
            <Dropzone disabled={busy} onAccepted={addFiles} onRejected={(reasons) => setErrors(reasons)} />

            {files.length > 0 && (
              <ul className="mt-5 divide-y divide-steel-200 rounded-xl border border-steel-200">
                {files.map((file) => (
                  <li key={fileKey(file)} className="flex items-center gap-3 px-4 py-3">
                    <FileText size={20} className="shrink-0 text-navy-700" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-navy-900" dir="auto">{file.name}</span>
                    <span className="text-sm text-steel-500">{formatSize(file.size)}</span>
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`Remove ${file.name}`}
                      onClick={() => setFiles(files.filter((f) => f !== file))}
                      className="rounded p-1 text-steel-500 hover:text-navy-900 focus-visible:outline-2 focus-visible:outline-navy-600 disabled:opacity-40"
                    >
                      <X size={18} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <ul className="mt-6 flex flex-wrap justify-center gap-3">
              {BADGES.map(({ icon: Icon, label }) => (
                <li key={label} className="metallic-bg flex items-center gap-2 rounded-full border border-steel-400 px-4 py-2 text-sm font-semibold text-navy-900 shadow-sm">
                  <Icon size={16} aria-hidden />
                  {label}
                </li>
              ))}
            </ul>

            <div className="mt-6 border-t border-steel-200 pt-5">
              <AdvancedSettings settings={settings} onChange={setSettings} disabled={busy} />
            </div>

            {errors.length > 0 && (
              <div role="alert" className="mt-5 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
                {errors.map((message) => (
                  <p key={message} dir="auto">{message}</p>
                ))}
              </div>
            )}

            {busy ? (
              <div className="mt-6" role="status" aria-live="polite">
                <div className="mb-2 flex justify-between text-sm font-semibold text-navy-900">
                  <span dir="auto">{progress.message}</span>
                  <span>{Math.round(progress.percent)}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-steel-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.percent)}>
                  <div className="h-full rounded-full bg-linear-to-r from-navy-800 to-navy-500 transition-all duration-500" style={{ width: `${progress.percent}%` }} />
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={!files.length}
                onClick={start}
                className="mt-6 w-full rounded-xl bg-navy-800 px-6 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 disabled:cursor-not-allowed disabled:bg-steel-300 disabled:text-steel-500 disabled:shadow-none"
              >
                {files.length ? `Process ${files.length} ${files.length === 1 ? 'file' : 'files'}` : 'Add a file to begin'}
              </button>
            )}
          </section>
        )}

        {phase === 'done' && result && (
          <section aria-label="Results" className="rounded-3xl border border-steel-300 bg-white p-5 shadow-2xl shadow-black/40 sm:p-8">
            <h2 className="text-2xl font-extrabold text-navy-900">Your file is ready</h2>
            <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[['Files', result.fileCount], ['Words', result.words], ['Characters', result.chars], ['Lines', result.lines]].map(([label, value]) => (
                <div key={label} className="metallic-bg flex flex-col-reverse rounded-xl border border-steel-300 p-4 text-center">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-steel-600">{label}</dt>
                  <dd className="text-2xl font-black text-navy-900">{Number(value).toLocaleString('en-US')}</dd>
                </div>
              ))}
            </dl>

            <pre dir="auto" className="mt-5 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-steel-200 bg-steel-100 p-4 text-sm text-navy-900">
              {result.text.slice(0, 1500)}{result.text.length > 1500 ? '\n…' : ''}
            </pre>

            {[...result.warnings, ...errors].length > 0 && (
              <div role="status" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                {[...result.warnings, ...errors].map((message) => (
                  <p key={message} dir="auto">{message}</p>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={download}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl bg-navy-800 px-6 py-5 text-xl font-extrabold text-white shadow-lg transition hover:bg-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600"
            >
              <Download size={24} aria-hidden />
              Download Processed File
            </button>
            {settings.format === 'pdf' && <p className="mt-2 text-center text-sm text-steel-600">Choose “Save as PDF” in the print dialog that opens.</p>}
            <button type="button" onClick={reset} className="mx-auto mt-4 flex items-center gap-2 font-semibold text-navy-700 hover:text-navy-500 focus-visible:outline-2 focus-visible:outline-navy-600">
              <Undo2 size={16} aria-hidden /> Process another file
            </button>
          </section>
        )}
      </main>

      <footer className="metallic-bg border-t border-steel-400 py-5 text-center text-sm text-navy-900">
        Powered by <strong className="font-extrabold">Disha Pro Studio</strong>
      </footer>
    </div>
  );
}
