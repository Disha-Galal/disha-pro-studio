/** Decode the original Python TPPF1 envelope and authenticate before decrypting. */
export async function decryptLegacy(raw:Uint8Array,password:string):Promise<ArrayBuffer>{
 if(raw.length<25||new TextDecoder().decode(raw.slice(0,5))!=='TPPF1')throw Error('صيغة ملف قديم غير صالحة.');
 const iterations=new DataView(raw.buffer,raw.byteOffset+5,4).getUint32(0);
 if(iterations<10000||iterations>2000000)throw Error('معامل اشتقاق المفتاح خارج الحدود المسموحة.');
 const encoded=new TextDecoder('ascii',{fatal:true}).decode(raw.slice(25));
 if(!/^[A-Za-z0-9_=-]+$/.test(encoded))throw Error('الملف المشفر تالف.');
 const token=Uint8Array.from(atob(encoded.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 if(token.length<73||token[0]!==128||(token.length-57)%16!==0)throw Error('رمز التشفير غير صالح.');
 const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const derived=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:raw.slice(9,25),iterations,hash:'SHA-256'},base,256));
 const signing=await crypto.subtle.importKey('raw',derived.slice(0,16),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 if(!await crypto.subtle.verify('HMAC',signing,token.slice(-32),token.slice(0,-32)))throw Error('كلمة السر غير صحيحة أو الملف تالف.');
 const aes=await crypto.subtle.importKey('raw',derived.slice(16),{name:'AES-CBC'},false,['decrypt']);
 return crypto.subtle.decrypt({name:'AES-CBC',iv:token.slice(9,25)},aes,token.slice(25,-32));
}
