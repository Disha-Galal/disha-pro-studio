import { readDocument, takeNotes } from '../lib/processor';
import { readPlainText } from '../lib/readers/text';
import { transform, statistics, replaceInText, findCount } from '../lib/text-tools';
import { layoutPage, itemsToBoxes } from '../lib/pdf-layout';
import { htmlToText, xmlParagraphs } from '../lib/markup';
import { readArchive, readDocx, readSpreadsheet } from '../lib/readers/office';
import { recognizeText, releaseOcr } from '../lib/readers/ocr';

/** Development-only runner; mount in a temporary route, never deploy that route. */
export async function runBrowserChecks() {
  const results: string[]=[];
  const eq=(actual:unknown,expected:unknown)=>{if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);};
  const ok=(condition:unknown)=>{if(!condition)throw Error('Assertion failed');};
  const rejects=async(fn:()=>unknown,pattern:RegExp)=>{try{await fn();}catch(e){ok(pattern.test(String(e)));return;}throw Error('Expected rejection');};
  const test=async(name:string,fn:()=>unknown)=>{try{await fn();results.push('PASS '+name);}catch(e){results.push('FAIL '+name+': '+String(e));}};
  const enc=(s:string)=>new TextEncoder().encode(s).buffer;
  await test('UTF-8 Arabic reader',()=>eq(readPlainText(enc('مرحبا\nسطر ثانٍ'),'txt','utf-8'),'مرحبا\nسطر ثانٍ'));
  await test('HTML paragraphs',()=>eq(readPlainText(enc('<h1>عنوان</h1><p>فقرة</p>'),'html','utf-8'),'عنوان\nفقرة'));
  await test('Unsupported extension',()=>rejects(()=>readPlainText(enc('x'),'exe','utf-8'),/صيغة غير مدعومة/));
  await test('Binary rejection',()=>rejects(()=>readPlainText(new Uint8Array([104,0,106]).buffer,'txt','utf-8'),/ثنائي/));
  await test('Invalid encoding',()=>rejects(()=>readPlainText(new Uint8Array([255]).buffer,'txt','utf-8'),/الترميز/));
  await test('HTML removes active content',()=>eq(htmlToText('<script>alert(1)</script><style>body{}</style><p>A &amp; B</p>'),'A & B'));
  await test('Office XML paragraphs',()=>eq(xmlParagraphs('<root xmlns:a="urn:test"><a:p><a:r><a:t>أهلا</a:t></a:r></a:p><a:p><a:r><a:t>ديشا</a:t></a:r></a:p></root>'),'أهلا\nديشا'));
  await test('Malformed XML',()=>rejects(()=>xmlParagraphs('<root>'),/XML/));
  await test('Clean retains paragraph breaks',()=>eq(transform('  أول   سطر \n\n\n ثاني  ','clean'),'أول سطر\n\nثاني'));
  await test('Arabic diacritics count as one word',()=>eq(statistics('مَرْحَبًا مرحبا').top,[['مرحبا',2]]));
  await test('Arabic and Persian digits',()=>eq(transform('٠١٢ ۳۴۵','digits-en'),'012 345'));
  await test('URL trailing punctuation',()=>eq(transform('https://example.com/test). https://example.com/test','links'),'https://example.com/test'));
  await test('Arabic smart duplicate removal',()=>eq(transform('أَهلا\nاهلا\nجديد','dedupe-smart'),'أَهلا\nجديد'));
  await test('Literal replace preserves dollar syntax',()=>eq(replaceInText('a a','a','$&',{regex:false,arabic:false,caseSensitive:true}).text,'$& $&'));
  await test('Invalid regex is reported',()=>eq(findCount('abc','[',{regex:true,arabic:false,caseSensitive:false}),-1));
  await test('PDF viewport coordinates',()=>eq(itemsToBoxes([{str:'A',transform:[1,0,0,1,10,50],width:20,height:10}], [1,0,0,-1,0,800])[0].y,750));
  await test('PDF two columns',()=>eq(layoutPage([{text:'L1',x:0,y:10,width:20,height:10,rtl:false},{text:'L2',x:0,y:25,width:20,height:10,rtl:false},{text:'R1',x:100,y:10,width:20,height:10,rtl:false},{text:'R2',x:100,y:25,width:20,height:10,rtl:false}]),'L1\nL2\n\nR1\nR2'));
  await test('PDF Arabic columns read right first',()=>eq(layoutPage([{text:'يمين',x:100,y:10,width:25,height:10,rtl:true},{text:'يسار',x:0,y:10,width:25,height:10,rtl:true}]),'يمين\n\nيسار'));
  const {zipSync,strToU8}=await import('fflate');
  const zip=(files:Record<string,string>)=>zipSync(Object.fromEntries(Object.entries(files).map(([k,v])=>[k,strToU8(v)]))).buffer as ArrayBuffer;
  await test('PPTX numeric slide order',async()=>eq(await readArchive(zip({'ppt/slides/slide10.xml':'<root><p>Ten</p></root>','ppt/slides/slide2.xml':'<root><p>Two</p></root>'}),'pptx'),'Two\n\nTen'));
  await test('ODT content',async()=>eq(await readArchive(zip({'content.xml':'<root><p>مرحبا</p></root>'}),'odt'),'مرحبا'));
  await test('EPUB spine order and relative paths',async()=>eq(await readArchive(zip({'OEBPS/book.opf':'<package><manifest><item id="b" href="./b.xhtml#chapter"/><item id="a" href="a.xhtml"/></manifest><spine><itemref idref="b"/><itemref idref="a"/></spine></package>','OEBPS/a.xhtml':'<p>First filename</p>','OEBPS/b.xhtml':'<p>First chapter</p>'}),'epub'),'First chapter\n\nFirst filename'));
  await test('DOCX round trip',async()=>{const {Document,Packer,Paragraph}=await import('docx');const blob=await Packer.toBlob(new Document({sections:[{children:[new Paragraph('مرحبا DOCX')]}]}));eq((await readDocx(await blob.arrayBuffer())).trim(),'مرحبا DOCX');});
  await test('XLSX round trip',async()=>{const x=await import('xlsx');const b=x.utils.book_new();x.utils.book_append_sheet(b,x.utils.aoa_to_sheet([['Name','Value'],['ديشا',42]]),'Sheet1');ok((await readSpreadsheet(x.write(b,{type:'array',bookType:'xlsx'}))).includes('ديشا,42'));});
  await test('PDF blank page warning and magic bytes',async()=>{takeNotes();const data=await (await fetch('/qa/sample.pdf')).arrayBuffer();const text=await readDocument(new File([data],'mislabeled.txt'),'utf-8',false,()=>{});ok(text.includes('Hello PDF')&&text.includes('Last page'));ok(takeNotes().some(n=>n.includes('1 صفحة')));eq(takeNotes(),[]);});
  await test('Oversized file rejected before parsing',()=>rejects(()=>readDocument(new File([new Uint8Array(20*1024*1024+1)],'large.txt'),'utf-8',false,()=>{}),/20 MB/));
  await test('Image requires explicit OCR',()=>rejects(()=>readDocument(new File(['x'],'photo.png'),'utf-8',false,()=>{}),/OCR/));
  await test('Empty text rejected',()=>rejects(()=>readDocument(new File(['  '],'empty.txt'),'utf-8',false,()=>{}),/لم يتم العثور/));
  await test('OCR English image and worker cleanup',async()=>{
    const canvas=document.createElement('canvas');canvas.width=650;canvas.height=120;
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='white';ctx.fillRect(0,0,650,120);ctx.fillStyle='black';ctx.font='48px Arial';ctx.fillText('DISHA 123',30,75);
    try{ok((await recognizeText(canvas,()=>{})).includes('DISHA'));}finally{await releaseOcr();canvas.width=canvas.height=0;}
  });
  return results.join('\n')+`\n${results.filter(r=>r.startsWith('PASS')).length}/${results.length} passed`;
}
