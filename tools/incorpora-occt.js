// Inserisce (o sostituisce) in index.html il lettore STEP/IGES occt-import-js.
// Uso: node tools/incorpora-occt.js <cartella dist di occt-import-js> [index.html]
// La cartella «dist» si ottiene da https://github.com/kovacsv/occt-import-js (o dal pacchetto npm occt-import-js).
// Il modulo WebAssembly viene compresso con gzip e scritto in base64; il codice JavaScript è copiato così com'è.
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const dist = process.argv[2], page = process.argv[3] || path.join(__dirname, '..', 'index.html');
if (!dist) { console.error('Uso: node tools/incorpora-occt.js <cartella dist> [index.html]'); process.exit(1); }
const js = fs.readFileSync(path.join(dist, 'occt-import-js.js'), 'utf8');
const wasm = fs.readFileSync(path.join(dist, 'occt-import-js.wasm'));
if (/<\/script|<!--|<script/i.test(js)) throw new Error('Il codice del lettore contiene marcatori HTML: non si può incorporare così');
const gz = zlib.gzipSync(wasm, { level: 9 });
const b64 = gz.toString('base64');
let html = fs.readFileSync(page, 'utf8');
const START = '<!-- LETTORE STEP/IGES: inizio -->', END = '<!-- LETTORE STEP/IGES: fine -->';
const block = START + '\n' +
  '<!-- occt-import-js (https://github.com/kovacsv/occt-import-js) e Open CASCADE Technology (https://dev.opencascade.org),\n' +
  '     distribuiti con licenza GNU LGPL 2.1 (OCCT con l\'eccezione di Open CASCADE): i testi sono nella cartella «licenze» del repository\n' +
  '     https://github.com/Rayuk-creator/CAD. La libreria non è modificata; si può sostituire con un\'altra versione con tools/incorpora-occt.js.\n' +
  // Se si cambia versione, aggiornare anche questa riga, licenze/LEGGIMI.md e la finestra «Informazioni e licenze».
  '     Copia dei sorgenti di questa versione (0.0.24 con OCCT 7.6.1): https://github.com/Rayuk-creator/occt-import-js/tree/41e470890ae0f9dc69ac50ffd5fc73e03576f4eb e https://github.com/Rayuk-creator/OCCT/tree/d2abb6d844231cb8f29be6894440874a4700e4a5 -->\n' +
  '<script id="occtJs" type="text/plain">' + js + '</script>\n' +
  '<script id="occtWasm" type="application/octet-stream">' + b64 + '</script>\n' + END;
const a = html.indexOf(START), b = html.indexOf(END);
if (a >= 0 && b > a) html = html.slice(0, a) + block + html.slice(b + END.length);
else {
  const k = html.lastIndexOf('</body>');
  if (k < 0) throw new Error('Manca </body> in ' + page);
  html = html.slice(0, k) + block + '\n' + html.slice(k);
}
fs.writeFileSync(page, html);
console.log('Lettore incorporato: wasm ' + wasm.length + ' byte, compresso ' + gz.length + ', base64 ' + b64.length + '; pagina ' + Buffer.byteLength(html) + ' byte');
