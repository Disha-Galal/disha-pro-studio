'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { CLEANUP_STEPS, ENCODINGS, OUTPUT_FORMATS, type Settings } from '@/lib/parseflow';
import { LIMITS, type ExportFormat } from '@/lib/limits';

type Props = { settings: Settings; onChange: (settings: Settings) => void; disabled: boolean };

const fieldClass =
  'mt-1.5 w-full rounded-lg border border-steel-300 bg-white px-3 py-2 text-navy-900 focus-visible:outline-2 focus-visible:outline-navy-600';
const labelClass = 'block text-sm font-semibold text-navy-900';

/** Progressive disclosure: the panel stays hidden until the user opens it. */
export function AdvancedSettings({ settings, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const update = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  const toggleStep = (id: string, on: boolean) =>
    update({ steps: on ? [...settings.steps, id] : settings.steps.filter((step) => step !== id) });

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-lg px-1 py-1 font-semibold text-navy-800 hover:text-navy-600 focus-visible:outline-2 focus-visible:outline-navy-600 disabled:opacity-50"
      >
        Advanced Settings
        <ChevronDown size={18} aria-hidden className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div id={panelId} className="mt-4 grid gap-6 rounded-xl border border-steel-300 bg-steel-100 p-5 sm:grid-cols-2">
          <label className={labelClass}>
            Output format
            <select className={fieldClass} value={settings.format} onChange={(e) => update({ format: e.target.value as ExportFormat })}>
              {OUTPUT_FORMATS.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            Output file name
            <input className={fieldClass} dir="auto" value={settings.fileName} maxLength={100} placeholder="Defaults to the first file’s name" onChange={(e) => update({ fileName: e.target.value })} />
          </label>

          <label className={labelClass}>
            TXT encoding
            <select className={fieldClass} value={settings.encoding} onChange={(e) => update({ encoding: e.target.value })}>
              {ENCODINGS.map((enc) => (
                <option key={enc.id} value={enc.id}>{enc.label}</option>
              ))}
            </select>
          </label>

          <label className="flex items-start gap-3 text-sm text-steel-600">
            <input type="checkbox" className="mt-1 size-4 accent-navy-700" checked={settings.ocr} onChange={(e) => update({ ocr: e.target.checked })} />
            <span>
              <b className="text-navy-900">OCR for scanned PDFs</b>
              <br />
              Reads each page as an image (max {LIMITS.ocrBatchPages} pages per run, {LIMITS.ocrPages} per file).
              Memory-heavy — use on a few scanned PDFs only. Downloads the OCR model on first use.
            </span>
          </label>

          <fieldset className="sm:col-span-2">
            <legend className={labelClass}>Clean-up steps</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {CLEANUP_STEPS.map((step) => (
                <label key={step.id} className="flex items-center gap-3 text-sm text-navy-900">
                  <input type="checkbox" className="size-4 accent-navy-700" checked={settings.steps.includes(step.id)} onChange={(e) => toggleStep(step.id, e.target.checked)} />
                  {step.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
}
