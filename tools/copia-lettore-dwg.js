// Copia il lettore DWG (LibreDWG in WebAssembly) dal Convertitore DWG → DXF dentro il Banco CAD, così le due pagine usano
// esattamente lo stesso lettore. Il blocco si aggiorna nel Convertitore con convertitore-dwg/incorpora-libredwg.js,
// poi si ricopia qui. Uso: node tools/copia-lettore-dwg.js [convertitore.html] [index.html]
// Licenza del lettore: GNU GPL 3, compatibile con quella del Banco CAD (stessa licenza).
'use strict';
const fs = require('fs'), path = require('path');
const from = process.argv[2] || path.join(__dirname, '..', 'convertitore-dwg', 'index.html');
const to = process.argv[3] || path.join(__dirname, '..', 'index.html');
const START = '<!-- LETTORE DWG: inizio -->', END = '<!-- LETTORE DWG: fine -->';
const src = fs.readFileSync(from, 'utf8');
const a0 = src.indexOf(START), b0 = src.indexOf(END);
if (a0 < 0 || b0 < a0) throw new Error('Mancano i segni «LETTORE DWG: inizio/fine» in ' + from);
// nel Banco CAD i testi citati dal commento stanno nella cartella del convertitore
const block = src.slice(a0, b0 + END.length).replace('testo in COPYING, sorgenti e versione in LEGGIMI.md', 'testo in convertitore-dwg/COPYING, sorgenti e versione in convertitore-dwg/LEGGIMI.md');
let html = fs.readFileSync(to, 'utf8');
const a = html.indexOf(START), b = html.indexOf(END);
if (a >= 0 && b > a) html = html.slice(0, a) + block + html.slice(b + END.length);
else {
  const k = html.lastIndexOf('</body>');
  if (k < 0) throw new Error('Manca </body> in ' + to);
  html = html.slice(0, k) + block + '\n' + html.slice(k);
}
fs.writeFileSync(to, html);
console.log('Lettore DWG copiato: blocco di ' + block.length + ' caratteri; pagina ' + Buffer.byteLength(html) + ' byte');
