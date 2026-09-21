'use client';

import type { Change } from 'diff';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Braces,
  Check,
  Copy,
  Download,
  Files,
  FileText,
  LockKeyhole,
  Scissors,
  Search,
  ShieldCheck,
  Undo2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { LANG_STORAGE_KEY, type Lang, t } from '@/lib/i18n';
import {
  cryptFile,
  type FindOpts,
  findCount,
  readDocument,
  exportDocument,
  releaseOcr,
  replaceInText,
  statistics,
  takeNotes,
  transform,
} from '@/lib/processor';

type Item = { name: string; text: string };

const NUM_LOCALE: Record<Lang, string> = { ar: 'ar-EG', en: 'en-US' };

/** Simple globe glyph for the language switch — kept as inline SVG to avoid depending on a specific icon-set version. */
function LangIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3Z" />
    </svg>
  );
}

/** ParseFlow brand mark: hexagon shell + three-way flow arrow, echoing the Disha Pro Studio logo. */
function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="pf-hex-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#16324a" />
          <stop offset="1" stopColor="#06111f" />
        </linearGradient>
        <linearGradient id="pf-arrow-g" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2f6fe4" />
          <stop offset="0.55" stopColor="#8fd9ec" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <path d="M32 2 58 17v30L32 62 6 47V17Z" fill="url(#pf-hex-g)" stroke="#22d3ee" strokeWidth="1.6" />
      <g fill="none" stroke="url(#pf-arrow-g)" strokeWidth="3.4" strokeLinecap="round">
        <path d="M15 24c4 0 6 2 9 5s5 3 8 3" />
        <path d="M15 32h17" />
        <path d="M15 40c4 0 6-2 9-5s5-3 8-3" />
      </g>
      <path d="M31 24l9 8-9 8" fill="none" stroke="url(#pf-arrow-g)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="15" cy="24" r="2.6" fill="#2f6fe4" />
      <circle cx="15" cy="32" r="2.6" fill="#c9d6e4" />
      <circle cx="15" cy="40" r="2.6" fill="#2f6fe4" />
    </svg>
  );
}

export default function Home() {
  const [lang, setLang] = useState<Lang>('ar');
  const L = (key: Parameters<typeof t>[1]) => t(lang, key);
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(LANG_STORAGE_KEY) : null;
    if (saved === 'ar' || saved === 'en') setLang(saved);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      /* private browsing / storage disabled — language just won't persist */
    }
  }, [lang, dir]);

  const [text, setText] = useState(''),
    [history, setHistory] = useState<string[]>([]),
    [files, setFiles] = useState<Item[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [encoding, setEncoding] = useState('utf-8'),
    [format, setFormat] = useState('txt'),
    [name, setName] = useState('parseflow-document'),
    [find, setFind] = useState(''),
    [replacement, setReplacement] = useState(''),
    [findOpts, setFindOpts] = useState<FindOpts>({ regex: false, caseSensitive: false, arabic: true }),
    [other, setOther] = useState(''),
    [ocr, setOcr] = useState(false),
    [password, setPassword] = useState(''),
    [cryptoFile, setCryptoFile] = useState<File | null>(null),
    [diff, setDiff] = useState<Change[]>([]),
    [similarReport, setSimilarReport] = useState('');
  const picker = useRef<HTMLInputElement>(null);
  const sessionPicker = useRef<HTMLInputElement>(null);
  const stats = useMemo(() => statistics(text), [text]);
  const matchCount = useMemo(() => (find ? findCount(text, find, findOpts) : 0), [text, find, findOpts]);

  function change(newText: string) {
    if (newText.length > 2_000_000) {
      setMessage(L('errFileTooLarge'));
      return;
    }
    setHistory((h) => [...h.slice(-9), text]);
    setText(newText);
  }

  async function load(list: FileList | null) {
    if (!list) return;
    setBusy(true);
    setMessage(L('loadingFiles'));
    const result: Item[] = [];
    const errors: string[] = [];
    takeNotes();
    try {
      for (const f of Array.from(list).slice(0, 10)) {
        try {
          const fileText = await readDocument(f, encoding, ocr, setMessage);
          result.push({ name: f.name, text: fileText });
        } catch (e) {
          errors.push(f.name + ': ' + (e as Error).message);
        }
      }
      setFiles((old) => [...old, ...result].slice(-20));
      if (result.length) {
        change([text, ...result.map((x) => x.text)].filter(Boolean).join('\n\n'));
        setName(result[0].name.replace(/\.[^.]+$/, ''));
      }
      setMessage(
        [
          result.length ? `${L('filesReadMsg')}: ${result.length} • ${L('reviewMsg')}` : '',
          ...errors,
          ...takeNotes(),
          list.length > 10 ? L('errMaxFiles') : '',
        ]
          .filter(Boolean)
          .join(' • '),
      );
    } finally {
      try {
        await releaseOcr();
      } catch {
        setMessage((m) => m + ' • ' + L('ocrCloseFail'));
      }
      setBusy(false);
      if (picker.current) picker.current.value = '';
    }
  }

  async function runExport() {
    setBusy(true);
    try {
      await exportDocument(text, format, name);
      setMessage(format === 'pdf' ? L('pdfHint') : L('exportReady'));
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function cryptoAction(mode: boolean) {
    if (!cryptoFile) return;
    setBusy(true);
    try {
      await cryptFile(cryptoFile, password, mode);
      setMessage(L('cryptoDone'));
      setPassword('');
    } catch {
      setMessage(L('cryptoFail'));
    } finally {
      setBusy(false);
    }
  }

  function saveSession() {
    const blob = new Blob(
      [JSON.stringify({ app: 'parseflow-session', version: 1, text, name, format, encoding }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'parseflow-session.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    setMessage(L('sessionSaved'));
  }

  async function restoreSession(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw Error();
      const d = JSON.parse(await file.text());
      if (
        (d.app !== 'parseflow-session' && d.app !== 'disha-pro-session') ||
        d.version !== 1 ||
        typeof d.text !== 'string' ||
        d.text.length > 2_000_000 ||
        typeof d.name !== 'string' ||
        d.name.length > 200 ||
        !['txt', 'pdf', 'docx', 'md', 'html', 'json', 'csv'].includes(d.format) ||
        !['utf-8', 'windows-1256', 'utf-16le', 'iso-8859-6'].includes(d.encoding)
      )
        throw Error();
      change(d.text);
      setName(d.name);
      setFormat(d.format);
      setEncoding(d.encoding);
      setMessage(L('sessionRestored'));
    } catch {
      setMessage(L('sessionInvalid'));
    } finally {
      if (sessionPicker.current) sessionPicker.current.value = '';
    }
  }

  function runReplaceAll() {
    const { text: next, count } = replaceInText(text, find, replacement, findOpts);
    if (count > 0) change(next);
    setMessage(`${count} ${L('matchesWord')}`);
  }

  function runSimilar() {
    setSimilarReport(transform(text, 'similar'));
  }

  const CLEAN_TOOLS: [string, string][] = [
    ['clean', L('toolClean')],
    ['empty', L('toolEmpty')],
    ['dedupe', L('toolDedupe')],
    ['dedupe-smart', L('toolDedupeSmart')],
    ['sort', L('toolSort')],
    ['reverse', L('toolReverse')],
    ['presentation', L('toolPresentation')],
    ['arabic', L('toolArabic')],
    ['unify', L('toolUnify')],
    ['digits-en', L('toolDigitsEn')],
    ['digits-ar', L('toolDigitsAr')],
    ['upper', L('toolUpper')],
    ['lower', L('toolLower')],
  ];
  const EXTRACT_TOOLS: [string, string][] = [
    ['links', L('extractLinks')],
    ['emails', L('extractEmails')],
    ['phones', L('extractPhones')],
  ];

  const busyDisabled = busy;

  return (
    <div dir={dir}>
      <header>
        <a className="brand" href="/">
          <span className="brand-icon">
            <BrandMark />
          </span>
          <span>
            <span className="brand-name">
              {lang === 'ar' ? 'بارس' : 'Parse'}
              <b>{lang === 'ar' ? 'فلو' : 'Flow'}</b>
            </span>
            <small>{L('brandTagline')} · {L('brandParent')}</small>
          </span>
        </a>
        <div className="private">
          <ShieldCheck size={17} /> {L('privacyBadge')}
        </div>
        <button type="button" className="lang-toggle" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>
          <LangIcon /> {L('langSwitch')}
        </button>
        <span className="version">{L('version')}</span>
      </header>

      <main>
        <div className="heading">
          <div>
            <div className="eyebrow">{L('eyebrow')}</div>
            <h1>
              {L('heroTitle1')} <span>{L('heroTitle2')}</span>
            </h1>
            <p>{L('heroSubtitle')}</p>
          </div>
          <div className="signature" dir="ltr">
            {L('signatureBuiltBy')}
            <br />
            <strong>{L('signatureName')}</strong>
          </div>
        </div>

        <div className="workspace">
          <aside>
            <section className="panel import-panel">
              <div className="section-label">
                <span>01</span> {L('step1')}
              </div>
              <div
                className="drop"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!busyDisabled) load(e.dataTransfer.files);
                }}
              >
                <span className="upload-icon">
                  <Upload size={28} />
                </span>
                <h2>{L('dropTitle')}</h2>
                <p>{L('dropSubtitle')}</p>
                <Button disabled={busyDisabled} onClick={() => picker.current?.click()}>
                  {L('chooseFiles')} <Upload size={16} />
                </Button>
                <input ref={picker} type="file" multiple hidden onChange={(e) => load(e.target.files)} />
                <small>{L('dropHint')}</small>
              </div>
              <div className="formats">{L('formatsList')}</div>
              <label className="field">
                {L('encodingLabel')}
                <select value={encoding} onChange={(e) => setEncoding(e.target.value)}>
                  <option value="utf-8">{L('encodingUtf8')}</option>
                  <option value="windows-1256">{L('encodingWin1256')}</option>
                  <option value="utf-16le">{L('encodingUtf16')}</option>
                  <option value="iso-8859-6">{L('encodingIso')}</option>
                </select>
              </label>
              <label className="check">
                <input type="checkbox" checked={ocr} onChange={(e) => setOcr(e.target.checked)} /> {L('ocrLabel')}
              </label>
              <p className="hint">{L('ocrHint')}</p>
            </section>

            <section className="panel queue">
              <h3>
                <Files size={17} /> {L('queueTitle')} <span>{files.length}</span>
              </h3>
              {files.length ? (
                files.map((f, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      change(f.text);
                      setName(f.name.replace(/\.[^.]+$/, ''));
                    }}
                    className="file-row"
                    disabled={busyDisabled}
                  >
                    <FileText size={18} />
                    <span dir="auto">{f.name}</span>
                    <Check size={14} />
                  </button>
                ))
              ) : (
                <p className="hint">{L('queueEmpty')}</p>
              )}
              <p className="hint">{L('queueHint')}</p>
            </section>
          </aside>

          <div className="work-main">
            <section className="panel editor-panel">
              <div className="editor-title">
                <div className="section-label">
                  <span>02</span> {L('step2')}
                </div>
                <div className="editor-actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!history.length || busyDisabled}
                    onClick={() => {
                      setText(history.at(-1)!);
                      setHistory((h) => h.slice(0, -1));
                    }}
                  >
                    <Undo2 size={16} /> {L('undo')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!text}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(text);
                        setMessage(L('copied'));
                      } catch {
                        setMessage(L('copyFailed'));
                      }
                    }}
                  >
                    <Copy size={16} /> {L('copy')}
                  </Button>
                </div>
              </div>
              <Textarea
                aria-label={L('step2')}
                dir="auto"
                value={text}
                disabled={busyDisabled}
                onChange={(e) => setText(e.target.value.slice(0, 2_000_000))}
                placeholder={L('editorPlaceholder')}
                className="editor"
              />
              <div className="stats">
                <span>
                  <b>{stats.words.toLocaleString(NUM_LOCALE[lang])}</b> {L('statWords')}
                </span>
                <span>
                  <b>{stats.chars.toLocaleString(NUM_LOCALE[lang])}</b> {L('statChars')}
                </span>
                <span>
                  <b>{stats.lines.toLocaleString(NUM_LOCALE[lang])}</b> {L('statLines')}
                </span>
                <span>
                  {L('statReading')} {stats.minutes} {L('statMinutes')}
                </span>
              </div>
            </section>

            <div role="status" aria-live="polite" className={'status ' + (busyDisabled ? 'working' : '')}>
              {busyDisabled ? <span className="spinner" /> : <ShieldCheck size={16} />} {message || L('readyStatus')}
            </div>

            <section className="panel toolbox">
              <Tabs defaultValue="clean" dir={dir}>
                <TabsList className="tool-tabs">
                  <TabsTrigger value="clean">
                    <Scissors size={16} /> {L('tabClean')}
                  </TabsTrigger>
                  <TabsTrigger value="search">
                    <Search size={16} /> {L('tabSearch')}
                  </TabsTrigger>
                  <TabsTrigger value="analysis">
                    <Braces size={16} /> {L('tabAnalysis')}
                  </TabsTrigger>
                  <TabsTrigger value="secure">
                    <LockKeyhole size={16} /> {L('tabSecure')}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="clean">
                  <h3>{L('cleanTitle')}</h3>
                  <div className="tools">
                    {CLEAN_TOOLS.map(([id, label]) => (
                      <Button
                        variant="outline"
                        key={id}
                        disabled={!text || busyDisabled}
                        onClick={() => {
                          change(transform(text, id));
                          setMessage(L('modifiedMsg'));
                        }}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="search">
                  <div className="search-grid">
                    <label>
                      {L('findLabel')}
                      <Input value={find} onChange={(e) => setFind(e.target.value)} dir="auto" />
                    </label>
                    <label>
                      {L('replaceLabel')}
                      <Input value={replacement} onChange={(e) => setReplacement(e.target.value)} dir="auto" />
                    </label>
                    <Button disabled={!find || busyDisabled} onClick={runReplaceAll}>
                      {L('replaceAll')}
                    </Button>
                  </div>
                  <div className="find-options">
                    <label>
                      <input
                        type="checkbox"
                        checked={findOpts.arabic}
                        onChange={(e) => setFindOpts((o) => ({ ...o, arabic: e.target.checked }))}
                      />
                      {L('arabicOption')}
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={findOpts.caseSensitive}
                        onChange={(e) => setFindOpts((o) => ({ ...o, caseSensitive: e.target.checked }))}
                      />
                      {L('caseOption')}
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={findOpts.regex}
                        onChange={(e) => setFindOpts((o) => ({ ...o, regex: e.target.checked }))}
                      />
                      {L('regexOption')}
                    </label>
                  </div>
                  <p className="hint">
                    {find ? Math.max(matchCount, 0) : 0} {L('matchesWord')}
                  </p>
                  <div className="tools">
                    {EXTRACT_TOOLS.map(([id, label]) => (
                      <Button variant="outline" key={id} disabled={!text || busyDisabled} onClick={() => change(transform(text, id))}>
                        {label}
                      </Button>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="analysis">
                  <h3>{L('topWords')}</h3>
                  <div className="word-list">
                    {stats.top.length ? (
                      stats.top.map(([w, n]) => (
                        <span key={w}>
                          {w} <b>{n}</b>
                        </span>
                      ))
                    ) : (
                      <p className="hint">{L('topWordsEmpty')}</p>
                    )}
                  </div>
                  <div className="tools">
                    <Button variant="outline" disabled={!text || busyDisabled} onClick={runSimilar}>
                      {L('similarBtn')}
                    </Button>
                  </div>
                  {similarReport && <pre className="similar-report" dir="auto">{similarReport}</pre>}
                  <label>
                    {L('compareLabel')}
                    <Textarea value={other} onChange={(e) => setOther(e.target.value.slice(0, 100_000))} dir="auto" />
                  </label>
                  <Button
                    variant="outline"
                    disabled={busyDisabled || text.length > 100_000}
                    onClick={async () => {
                      const { diffLines } = await import('diff');
                      setDiff(diffLines(text, other, { timeout: 1500 }) || []);
                    }}
                  >
                    {L('compareBtn')}
                  </Button>
                  <div className="diff" dir="auto">
                    {diff.map((d, i) => (
                      <pre key={i} className={d.added ? 'added' : d.removed ? 'removed' : ''}>
                        {d.added ? '+ ' : d.removed ? '\u2212 ' : ''}
                        {d.value}
                      </pre>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="secure">
                  <h3>{L('secureTitle')}</h3>
                  <p className="hint">{L('secureHint')}</p>
                  <Input aria-label={L('secureTitle')} type="file" onChange={(e) => setCryptoFile(e.target.files?.[0] || null)} />
                  <Input
                    aria-label={L('passwordPlaceholder')}
                    type="password"
                    placeholder={L('passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <div className="tools">
                    <Button disabled={busyDisabled || !cryptoFile || password.length < 10} onClick={() => cryptoAction(true)}>
                      {L('encryptBtn')}
                    </Button>
                    <Button variant="outline" disabled={busyDisabled || !cryptoFile || !password} onClick={() => cryptoAction(false)}>
                      {L('decryptBtn')}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </section>

            <section className="panel session-panel">
              <div>
                <h3>{L('sessionTitle')}</h3>
                <p className="hint">{L('sessionHint')}</p>
              </div>
              <div className="tools">
                <Button variant="outline" disabled={busyDisabled || !text} onClick={saveSession}>
                  {L('saveSession')}
                </Button>
                <Button variant="outline" disabled={busyDisabled} onClick={() => sessionPicker.current?.click()}>
                  {L('restoreSession')}
                </Button>
                <input type="file" accept=".json" ref={sessionPicker} hidden onChange={(e) => restoreSession(e.target.files?.[0])} />
              </div>
            </section>

            <section className="panel export">
              <div>
                <div className="section-label">
                  <span>03</span> {L('step3')}
                </div>
                <p className="hint">{L('exportHint')}</p>
              </div>
              <div className="export-controls">
                <Input aria-label={L('fileNameLabel')} value={name} onChange={(e) => setName(e.target.value)} dir="auto" />
                <select aria-label={L('formatLabel')} value={format} onChange={(e) => setFormat(e.target.value)}>
                  {['txt', 'pdf', 'docx', 'md', 'html', 'json', 'csv'].map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
                <Button disabled={!text || busyDisabled} onClick={runExport}>
                  <Download size={17} /> {format === 'pdf' ? L('printPdfBtn') : L('downloadBtn')}
                </Button>
              </div>
            </section>
          </div>
        </div>

        <details className="roadmap">
          <summary>{L('roadmapSummary')}</summary>
          <p>{L('roadmapP1')}</p>
          <p>{L('roadmapP2')}</p>
        </details>
      </main>

      <footer>
        <span dir="ltr">{L('footerRights')}</span>
        <span>{L('footerTagline')}</span>
      </footer>
    </div>
  );
}
