// Inserisce (o sostituisce) nel Convertitore DWG → DXF il lettore LibreDWG compilato in WebAssembly.
// Uso: node convertitore-dwg/incorpora-libredwg.js <cartella wasm di libredwg-web> [pagina.html]
// La cartella è bindings/javascript/wasm del repository https://github.com/mlightcad/libredwg-web
// (libredwg-web.js + libredwg-web.wasm). Il WebAssembly viene compresso con gzip e scritto in base64;
// il codice JavaScript è copiato così com'è. Licenza: GNU GPL 3 (vedi COPYING in questa cartella).
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const dir = process.argv[2], page = process.argv[3] || path.join(__dirname, 'index.html');
if (!dir) { console.error('Uso: node incorpora-libredwg.js <cartella wasm di libredwg-web> [pagina.html]'); process.exit(1); }
const js = fs.readFileSync(path.join(dir, 'libredwg-web.js'), 'utf8');
const wasm = fs.readFileSync(path.join(dir, 'libredwg-web.wasm'));
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
  '     wasm sha256 ' + sha(wasm) + ', js sha256 ' + sha(Buffer.from(js)) + ' -->\n' +
  '<script id="dwgJs" type="text/plain">' + js + '</script>\n' +
  '<script id="dwgWasm" type="application/octet-stream">' + b64 + '</script>\n' + END;
const a = html.indexOf(START), b = html.indexOf(END);
if (a >= 0 && b > a) html = html.slice(0, a) + block + html.slice(b + END.length);
else throw new Error('Mancano i segni «LETTORE DWG: inizio/fine» in ' + page);
fs.writeFileSync(page, html);
console.log('Lettore incorporato: wasm ' + wasm.length + ' byte (sha256 ' + sha(wasm).slice(0, 16) + '…), compresso ' + gz.length + ', base64 ' + b64.length + '; pagina ' + Buffer.byteLength(html) + ' byte');
