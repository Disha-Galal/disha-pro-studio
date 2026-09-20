import { UserError } from './errors';

/** Parse into an inert document; never insert uploaded markup into the live page. */
export function htmlToText(source: string): string {
  const doc = new DOMParser().parseFromString(source, 'text/html');
  doc.querySelectorAll('script,style,noscript,iframe,object,template').forEach(e => e.remove());
  doc.querySelectorAll('p,div,br,li,h1,h2,h3,h4,h5,h6,tr,section,article,blockquote,pre').forEach(e => e.append('\n'));
  doc.querySelectorAll('td,th').forEach(e => e.append('\t'));
  return (doc.body.textContent || '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function xmlParagraphs(source: string): string {
  const doc = new DOMParser().parseFromString(source, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new UserError('محتوى XML غير صالح.');
  const paragraphs = [...doc.getElementsByTagName('*')].filter(e => ['p', 'h'].includes(e.localName));
  return paragraphs.filter(e => ![...e.getElementsByTagName('*')].some(c => ['p','h'].includes(c.localName)))
    .map(e => e.textContent || '').join('\n') || doc.documentElement.textContent || '';
}

/** Attributes from a single XML opening tag (e.g. an EPUB manifest item). */
export function tagAttrs(tag: string): Record<string, string> {
  const attrs: Record<string, string> = Object.create(null);
  for (const match of tag.matchAll(/([\w:.-]+)\s*=\s*(["'])([\s\S]*?)\2/g)) {
    attrs[match[1]] = match[3].replace(/&(?:amp|quot|apos|lt|gt);/g, entity => ({'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'}[entity]!));
  }
  return attrs;
}
