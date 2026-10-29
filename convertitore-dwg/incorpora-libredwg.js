// Inserisce (o sostituisce) nel Convertitore DWG → DXF il lettore LibreDWG compilato in WebAssembly.
// Uso: node convertitore-dwg/incorpora-libredwg.js <cartella wasm di libredwg-web> [pagina.html]
// La cartella è bindings/javascript/wasm del repository https://github.com/mlightcad/libredwg-web
// (libredwg-web.js + libredwg-web.wasm). Il WebAssembly viene compresso con gzip e scritto in base64;
// il codice JavaScript è copiato così com'è. Licenza: GNU GPL 3 (vedi COPYING in questa cartella).
// Unica modifica al WebAssembly: la memoria iniziale (scritta nella sezione «memory» del modulo) scende da quella della
// compilazione (1 GB in libredwg-web 0.8.2) a MEM_START; la memoria cresce da sola quando un disegno ne chiede di più
// (il modulo è compilato con la crescita della memoria: emscripten_resize_heap). Lo script controlla che la memoria
// iniziale nuova contenga i dati fissi del programma e lo stack, altrimenti si ferma.
// Opzione --memoria-mb N: memoria iniziale in MB (16 se non si dice; 0 = lasciarla com'è).
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const args = process.argv.slice(2);
const mi = args.indexOf('--memoria-mb'); const MEM_MB = mi >= 0 ? +args.splice(mi, 2)[1] : 16;
const dir = args[0], page = args[1] || path.join(__dirname, 'index.html');
if (!dir) { console.error('Uso: node incorpora-libredwg.js <cartella wasm di libredwg-web> [pagina.html]'); process.exit(1); }
const js = fs.readFileSync(path.join(dir, 'libredwg-web.js'), 'utf8');
const wasm0 = fs.readFileSync(path.join(dir, 'libredwg-web.wasm'));

// sezioni del modulo WebAssembly e numeri LEB128
function readLeb(b, p) { let r = 0, s = 0, x; do { x = b[p++]; r += (x & 0x7f) * 2 ** s; s += 7; } while (x & 0x80); return [r, p]; }
function readSleb(b, p) { let r = 0, s = 0, x; do { x = b[p++]; r += (x & 0x7f) * 2 ** s; s += 7; } while (x & 0x80); if (x & 0x40) r -= 2 ** s; return [r, p]; }
function leb(n) { const o = []; do { let x = n % 128; n = Math.floor(n / 128); if (n) x |= 0x80; o.push(x); } while (n); return Buffer.from(o); }
function sections(b) {
  if (b.readUInt32LE(0) !== 0x6d736100) throw new Error('Il file .wasm non è un modulo WebAssembly');
  const out = []; let p = 8;
  while (p < b.length) { const id = b[p]; const [size, q] = readLeb(b, p + 1); out.push({ id, start: p, body: q, end: q + size }); p = q + size; }
  return out;
}
// memoria iniziale più piccola: { wasm, before, after, need } (in pagine da 64 kB)
function lowerMemory(b, mb) {
  const secs = sections(b), mem = secs.filter(s => s.id === 5);
  if (mem.length !== 1) throw new Error('Il modulo non ha una sezione «memory» sola: versione non prevista');
  let [count, p] = readLeb(b, mem[0].body);
  if (count !== 1) throw new Error('Il modulo ha ' + count + ' memorie: versione non prevista');
  const flags = b[p++]; let before, max = null;
  [before, p] = readLeb(b, p); if (flags & 1) [max, p] = readLeb(b, p);
  if (!(flags & 1) || !(max > before)) throw new Error('La memoria del modulo non può crescere: non si può ridurre quella iniziale');
  // quanto serve all'avvio: fine dei segmenti di dati e valori iniziali dei globali (puntatore dello stack, inizio dello heap)
  let need = 0;
  const constExpr = q => { const op = b[q]; let v = null; if (op === 0x41) [v, q] = readSleb(b, q + 1); else if (op === 0x42) [v, q] = readSleb(b, q + 1); else { while (b[q] !== 0x0b) q++; return [null, q + 1]; } if (b[q] !== 0x0b) throw new Error('espressione costante non prevista'); return [v, q + 1]; };
  for (const s of secs) {
    if (s.id === 6) { let [n, q] = readLeb(b, s.body); for (let i = 0; i < n; i++) { const t = b[q]; q += 2; let v; [v, q] = constExpr(q); if (t === 0x7f && v !== null && v > 0) need = Math.max(need, v >>> 0); } }
    if (s.id === 11) { let [n, q] = readLeb(b, s.body); for (let i = 0; i < n; i++) { let f, off = null, len; [f, q] = readLeb(b, q); if (f === 0) [off, q] = constExpr(q); else if (f === 2) { [, q] = readLeb(b, q); [off, q] = constExpr(q); } [len, q] = readLeb(b, q); q += len; if (off !== null) need = Math.max(need, off + len); } }
  }
  const needPages = Math.ceil(need / 65536);
  const after = mb ? Math.max(Math.ceil(mb * 16), needPages + 16) : before;
  if (after >= before) return { wasm: b, before, after: before, need, max };
  const memBody = Buffer.concat([leb(1), Buffer.from([flags]), leb(after), leb(max)]);
  const memSec = Buffer.concat([Buffer.from([5]), leb(memBody.length), memBody]);
  return { wasm: Buffer.concat([b.subarray(0, mem[0].start), memSec, b.subarray(mem[0].end)]), before, after, need, max };
}
const low = lowerMemory(wasm0, MEM_MB);
const wasm = low.wasm;
// controllo: il modulo nuovo è valido e la memoria iniziale è quella voluta
if (!WebAssembly.validate(wasm)) throw new Error('Il modulo con la memoria ridotta non è valido');
{ const m = new WebAssembly.Module(wasm); const im = WebAssembly.Module.exports(m).find(e => e.kind === 'memory'); if (!im) throw new Error('Il modulo non esporta la memoria'); }
if (/<\/script|<!--|<script/i.test(js)) throw new Error('Il codice del lettore contiene marcatori HTML: non si può incorporare così');
if (!/export default createModule;?\s*$/.test(js)) throw new Error('Il codice del lettore non finisce con «export default createModule»: versione non prevista');
if (!wasm.includes('dwg_write_dxf')) throw new Error('Questa versione del lettore non sa scrivere i DXF (manca dwg_write_dxf)');
const gz = zlib.gzipSync(wasm, { level: 9 });
const b64 = gz.toString('base64');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
let html = fs.readFileSync(page, 'utf8');
const START = '<!-- LETTORE DWG: inizio -->', END = '<!-- LETTORE DWG: fine -->';
const block = START + '\n' +
  '<!-- LibreDWG (https://www.gnu.org/software/libredwg/) compilato in WebAssembly da libredwg-web\n' +
  '     (https://github.com/mlightcad/libredwg-web), licenza GNU GPL 3: testo in COPYING, sorgenti e versione in LEGGIMI.md.\n' +
  '     wasm originale sha256 ' + sha(wasm0) + ', js sha256 ' + sha(Buffer.from(js)) + '\n' +
  '     memoria iniziale ridotta da ' + low.before * 64 / 1024 + ' MB a ' + low.after * 64 / 1024 + ' MB (cresce da sola fino a ' + low.max * 64 / 1024 + ' MB): wasm incorporato sha256 ' + sha(wasm) + ' -->\n' +
  '<script id="dwgJs" type="text/plain">' + js + '</script>\n' +
  '<script id="dwgWasm" type="application/octet-stream">' + b64 + '</script>\n' + END;
const a = html.indexOf(START), b = html.indexOf(END);
if (a >= 0 && b > a) html = html.slice(0, a) + block + html.slice(b + END.length);
else throw new Error('Mancano i segni «LETTORE DWG: inizio/fine» in ' + page);
fs.writeFileSync(page, html);
console.log('Lettore incorporato: wasm ' + wasm.length + ' byte (sha256 ' + sha(wasm).slice(0, 16) + '…), compresso ' + gz.length + ', base64 ' + b64.length + '; pagina ' + Buffer.byteLength(html) + ' byte');
console.log('Memoria iniziale: ' + low.before * 64 / 1024 + ' MB → ' + low.after * 64 / 1024 + ' MB (dati fissi e stack: ' + (low.need / 1048576).toFixed(2) + ' MB; massimo ' + low.max * 64 / 1024 + ' MB)');
