/** Pure text utilities (no DOM) so they can be unit-tested in Node. */

import { UserError } from './errors';

// Arabic marks: harakat, superscript alef, Quranic small marks (not the ayah-end signs), tatweel.
const MARKS_RE = /[\u064B-\u065F\u0670\u0640\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g;
const MARK_GAP = '[\\u064B-\\u065F\\u0670\\u0640]*';

export const stripMarks = (t: string) => t.replace(MARKS_RE, '');
/** Mild unification: أ إ آ ٱ → ا, ى → ي, Persian ک/ی → ك/ي. Spelling is otherwise kept. */
export const unifyLetters = (t: string) =>
  t.replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627').replace(/[\u0649\u06CC]/g, '\u064A').replace(/\u06A9/g, '\u0643');
/** Aggressive key used only for counting / matching, never written back to the text. */
export const searchKey = (t: string) => unifyLetters(stripMarks(t.toLowerCase())).replace(/\u0629/g, '\u0647');

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
export const toWesternDigits = (t: string) =>
  t.replace(/[٠-٩۰-۹]/g, (c) => String(AR_DIGITS.includes(c) ? AR_DIGITS.indexOf(c) : FA_DIGITS.indexOf(c)));
export const toArabicDigits = (t: string) => t.replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]);

/** PDFs with legacy fonts return Arabic Presentation Forms; NFKC maps them back to base letters. */
export const fixPresentationForms = (t: string) =>
  t.replace(/[\uFB50-\uFDFF\uFE70-\uFEFE]+/g, (m) => m.normalize('NFKC'));

const STOP = new Set(
  (
    'في من على إلى الى عن أن ان إن إذا اذا ما لا لم لن قد هذا هذه ذلك تلك هو هي هم هن كان كانت يكون التي الذي الذين ' +
    'مع أو او ثم كل بعد قبل حتى عند بين لكن كما هناك أي بها به له لها فيه فيها عليه عليها منه منها إلا الا ' +
    'the a an and or of to in on for is are was were be by with as at it this that from'
  )
    .split(' ')
    .map(searchKey),
);

export function statistics(t: string, skipStop = false) {
  const words = t.match(/[\p{L}\p{M}\p{N}_]+/gu) || [];
  const counts = new Map<string, { n: number; label: string }>();
  for (const w of words) {
    const k = searchKey(w);
    if (!k || (skipStop && (STOP.has(k) || k.length < 2))) continue;
    const e = counts.get(k);
    if (e) e.n++;
    else counts.set(k, { n: 1, label: stripMarks(w.toLowerCase()) });
  }
  const top = [...counts.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, 10)
    .map((e): [string, number] => [e.label, e.n]);
  return {
    words: words.length,
    chars: [...t].length,
    lines: t ? t.split('\n').length : 0,
    minutes: Math.round((words.length / 200) * 10) / 10,
    top,
  };
}

const lineKey = (l: string) => searchKey(l).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const uniq = (a: string[]) => [...new Set(a)];

function trimUrl(u: string): string {
  for (;;) {
    const c = u.slice(-1);
    if (/[.,;:!?\]}»،؛؟…]/.test(c)) u = u.slice(0, -1);
    else if (c === ')' && (u.match(/\(/g) || []).length < (u.match(/\)/g) || []).length) u = u.slice(0, -1);
    else return u;
  }
}

function bigrams(s: string) {
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    m.set(g, (m.get(g) || 0) + 1);
  }
  return m;
}
function dice(a: Map<string, number>, na: number, b: Map<string, number>, nb: number) {
  if (!na || !nb) return 0;
  let o = 0;
  for (const [g, n] of a) {
    const m = b.get(g);
    if (m) o += Math.min(n, m);
  }
  return (2 * o) / (na + nb);
}

/** Groups near-duplicate lines (ignores diacritics, case, punctuation). Returns a text report ('' if none). */
export function groupSimilar(t: string, threshold = 0.75, max = 3000): string {
  const items = t.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
  if (items.length > max) throw new UserError(`عدد السطور كبير للمقارنة (الحد ${max} سطر).`);
  const groups: { rep: Map<string, number>; n: number; lines: string[] }[] = [];
  for (const line of items) {
    const key = lineKey(line) || line;
    const g = bigrams(key);
    const n = Math.max(key.length - 1, 0);
    const hit = groups.find((x) => dice(x.rep, x.n, g, n) >= threshold);
    if (hit) hit.lines.push(line);
    else groups.push({ rep: g, n, lines: [line] });
  }
  return groups
    .filter((g) => g.lines.length > 1)
    .map((g, i) => `مجموعة ${i + 1} (${g.lines.length} سطور)\n` + g.lines.map((l) => '  ' + l).join('\n'))
    .join('\n\n');
}

export function transform(t: string, id: string): string {
  const lines = t.replace(/\r\n?/g, '\n').split('\n');
  switch (id) {
    case 'clean': {
      // Trim and collapse spaces; keep paragraph breaks (at most one blank line in a row).
      const out: string[] = [];
      for (const l of lines) {
        const s = l.trim().replace(/[\t \u00A0]+/g, ' ');
        if (!s && (!out.length || !out[out.length - 1])) continue;
        out.push(s);
      }
      while (out.length && !out[out.length - 1]) out.pop();
      return out.join('\n');
    }
    case 'empty':
      return lines.filter((l) => l.trim()).join('\n');
    case 'dedupe':
    case 'dedupe-smart': {
      const seen = new Set<string>();
      return lines
        .filter((l) => {
          const raw = l.trim();
          if (!raw) return true; // never treat blank lines as duplicates
          const k = id === 'dedupe' ? raw : lineKey(l) || raw;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .join('\n');
    }
    case 'sort':
      return [...lines].sort((a, b) => a.localeCompare(b, 'ar', { sensitivity: 'base', numeric: true })).join('\n');
    case 'reverse':
      return [...lines].sort((a, b) => b.localeCompare(a, 'ar', { sensitivity: 'base', numeric: true })).join('\n');
    case 'arabic':
      return stripMarks(t);
    case 'unify':
      return unifyLetters(t);
    case 'presentation':
      return fixPresentationForms(t);
    case 'digits-en':
      return toWesternDigits(t);
    case 'digits-ar':
      return toArabicDigits(t);
    case 'upper':
      return t.toUpperCase();
    case 'lower':
      return t.toLowerCase();
    case 'links':
      return uniq((t.match(/https?:\/\/[^\s<>"']+/g) || []).map(trimUrl)).join('\n');
    case 'emails':
      return uniq(t.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []).join('\n');
    case 'phones':
      return uniq(
        (toWesternDigits(t).match(/\+?\d[\d ()-]{8,18}\d/g) || [])
          .map((m) => m.trim())
          .filter((m) => {
            const n = m.replace(/\D/g, '').length;
            return n >= 9 && n <= 15 && !/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(m);
          }),
      ).join('\n');
    case 'similar':
      return groupSimilar(t);
    default:
      return t;
  }
}

/* ---------- Search & replace ---------- */

export type FindOpts = { regex: boolean; caseSensitive: boolean; arabic: boolean };

const ALEF = '[اأإآٱ]';
const YAA = '[يى]';
const LETTER_CLASS: Record<string, string> = { ا: ALEF, أ: ALEF, إ: ALEF, آ: ALEF, ٱ: ALEF, ي: YAA, ى: YAA };
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function buildRegex(q: string, o: FindOpts): RegExp {
  if (!q) throw new UserError('اكتب نص البحث.');
  if (q.length > 300) throw new UserError('نص البحث طويل جدًا (الحد 300 حرف).');
  let src: string;
  if (o.regex) src = q;
  else if (o.arabic) src = Array.from(stripMarks(q)).map((c) => LETTER_CLASS[c] || esc(c)).join(MARK_GAP);
  else src = esc(q);
  if (!src) throw new UserError('اكتب نص البحث.');
  try {
    return new RegExp(src, 'gu' + (o.caseSensitive ? '' : 'i'));
  } catch {
    throw new UserError('نمط البحث غير صالح.');
  }
}

/** Number of matches, or -1 when the pattern is invalid. */
export function findCount(t: string, q: string, o: FindOpts): number {
  try {
    const re = buildRegex(q, o);
    let n = 0;
    const it = t.matchAll(re);
    while (!it.next().done) if (++n >= 1_000_000) break;
    return n;
  } catch {
    return -1;
  }
}

export function replaceInText(t: string, q: string, r: string, o: FindOpts) {
  const re = buildRegex(q, o);
  const count = findCount(t, q, o);
  if (count <= 0) return { text: t, count: 0 };
  return { text: o.regex ? t.replace(re, r) : t.replace(re, () => r), count };
}
