import { UserError } from '../errors';
import { LIMITS } from '../limits';
import { htmlToText, tagAttrs, xmlParagraphs } from '../markup';

export async function readDocx(data: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  return (await mammoth.extractRawText({ arrayBuffer: data })).value;
}

export async function readSpreadsheet(data: ArrayBuffer): Promise<string> {
  const XLSX = await import('xlsx');
  const book = XLSX.read(data, { type: 'array' });
  return book.SheetNames.map((name) => `${name}\n${XLSX.utils.sheet_to_csv(book.Sheets[name])}`).join('\n\n');
}

type ArchiveKind = 'pptx' | 'odt' | 'epub';

const ENTRY_FILTER: Record<ArchiveKind, RegExp> = {
  pptx: /^ppt\/slides\/slide\d+\.xml$/,
  odt: /^content\.xml$/,
  epub: /\.(xhtml|html|htm|opf)$/,
};

/** pptx (slide XML), odt (content.xml) and epub (zipped XHTML) are all zip archives of markup. */
export async function readArchive(data: ArrayBuffer, kind: ArchiveKind): Promise<string> {
  const { unzipSync, strFromU8 } = await import('fflate');
  let totalBytes = 0;
  const zip = unzipSync(new Uint8Array(data), {
    filter: (entry) => {
      totalBytes += entry.originalSize;
      if (totalBytes > LIMITS.archiveBytes) throw new UserError('المحتوى المضغوط أكبر من الحد المسموح.');
      return ENTRY_FILTER[kind].test(entry.name);
    },
  });

  let keys = Object.keys(zip).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (kind === 'epub') keys = epubReadingOrder(zip, keys, strFromU8);

  return keys
    .map((key) => (kind === 'epub' ? htmlToText(strFromU8(zip[key])) : xmlParagraphs(strFromU8(zip[key]))))
    .join('\n\n');
}

/** Puts EPUB chapters in the order given by the .opf spine; falls back to filename order. */
function epubReadingOrder(
  zip: Record<string, Uint8Array>,
  keys: string[],
  strFromU8: (bytes: Uint8Array) => string,
): string[] {
  const opfKey = keys.find((k) => k.endsWith('.opf'));
  if (!opfKey) return keys.filter(k => !k.endsWith('.opf'));

  const opf = strFromU8(zip[opfKey]);
  const base = opfKey.slice(0, opfKey.lastIndexOf('/') + 1);

  const hrefById = new Map<string, string>();
  for (const m of opf.matchAll(/<item\b[^>]*\/?>/gi)) {
    const attrs = tagAttrs(m[0]);
    if (attrs.id && attrs.href) hrefById.set(attrs.id, attrs.href);
  }

  const resolve = (href: string | undefined): string => {
    if (!href) return '';
    let path = base;
    try {
      path += decodeURIComponent(href.split(/[?#]/)[0]);
    } catch {
      path += href.split(/[?#]/)[0];
    }
    const parts: string[] = [];
    for (const segment of path.split('/')) {
      if (segment === '..') parts.pop();
      else if (segment && segment !== '.') parts.push(segment);
    }
    return parts.join('/');
  };

  const spine = [...opf.matchAll(/<itemref\b[^>]*\/?>/gi)]
    .map((m) => resolve(hrefById.get(tagAttrs(m[0]).idref ?? '')))
    .filter((path) => zip[path]);

  return (spine.length ? spine : keys).filter((k) => !k.endsWith('.opf'));
}
