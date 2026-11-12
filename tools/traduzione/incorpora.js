// Mette in index.html il modulo della lingua (i18n.js) con il dizionario inglese (en.json)
// il Glossario in inglese (glossario-en.json) e la Guida in inglese (guida-en.json).
// Mette anche nel Convertitore DWG → DXF (convertitore-dwg/index.html) lo stesso modulo, con il suo dizionario
// (convertitore-en.json), tra gli stessi commenti «LINGUA: inizio/fine».
// Uso: node tools/traduzione/incorpora.js [index.html [convertitore-dwg/index.html]]
// Il modulo sta tra i commenti «LINGUA: inizio/fine», subito dopo il primo <script>;
// il Glossario tra «GLOSSARIO EN: inizio/fine», dentro il modulo Glossary;
// la Guida tra «GUIDA EN: inizio/fine», dentro il modulo Guide.
'use strict';
const fs = require('fs'), path = require('path');
const dir = __dirname, file = process.argv[2] || path.join(dir, '../../index.html');
const fileConv = process.argv[3] || path.join(dir, '../../convertitore-dwg/index.html');
// modulo della lingua con il dizionario dato (en.json per il Banco CAD, convertitore-en.json per il Convertitore)
function block(dictFile = 'en.json') {
  const dict = JSON.parse(fs.readFileSync(path.join(dir, dictFile), 'utf8'));
  const lines = Object.keys(dict).sort((a, b) => a.localeCompare(b, 'it')).map(k => '    ' + JSON.stringify(k) + ': ' + JSON.stringify(dict[k]) + ',');
  const src = fs.readFileSync(path.join(dir, 'i18n.js'), 'utf8');
  const a = '/* TRADUZIONE EN: inizio */', b = '/* TRADUZIONE EN: fine */';
  const i = src.indexOf(a), j = src.indexOf(b);
  return '/* LINGUA: inizio */\n' + src.slice(0, i + a.length) + '\n' + lines.join('\n') + '\n' + src.slice(j) + '/* LINGUA: fine */\n';
}
// testo del Glossario inglese: una riga per voce
function glossary() {
  const g = JSON.parse(fs.readFileSync(path.join(dir, 'glossario-en.json'), 'utf8'));
  const voci = Object.keys(g.voci).map(k => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(g.voci[k]));
  return '{"categorie": ' + JSON.stringify(g.categorie) + ', "voci": {\n' + voci.join(',\n') + '\n}}';
}
const GA = '/* GLOSSARIO EN: inizio */\n', GB = '\n/* GLOSSARIO EN: fine */';
// testo della Guida inglese: una riga per argomento
function guide() {
  const g = JSON.parse(fs.readFileSync(path.join(dir, 'guida-en.json'), 'utf8'));
  const arg = Object.keys(g.argomenti).map(k => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(g.argomenti[k]));
  return '{"capitoli": ' + JSON.stringify(g.capitoli) + ', "argomenti": {\n' + arg.join(',\n') + '\n}}';
}
const DA = '/* GUIDA EN: inizio */\n', DB = '\n/* GUIDA EN: fine */';
// modulo della lingua nella pagina: al posto di quello vecchio, oppure subito dopo il primo <script> senza attributi
function putBlock(html, b) {
  const s = html.indexOf('/* LINGUA: inizio */'), e = html.indexOf('/* LINGUA: fine */');
  if (s >= 0) return html.slice(0, s) + b + html.slice(e + '/* LINGUA: fine */\n'.length);
  const k = html.indexOf('<script>\n') + '<script>\n'.length;
  return html.slice(0, k) + b + html.slice(k);
}
module.exports = { block, glossary, GA, GB, guide, DA, DB };
if (require.main === module) {
  let html = putBlock(fs.readFileSync(file, 'utf8'), block());
  const ga = html.indexOf(GA), gb = html.indexOf(GB);
  if (ga < 0 || gb < 0) throw new Error('segni del Glossario inglese non trovati in ' + file);
  html = html.slice(0, ga + GA.length) + glossary() + html.slice(gb);
  const da = html.indexOf(DA), db = html.indexOf(DB);
  if (da < 0 || db < 0) throw new Error('segni della Guida inglese non trovati in ' + file);
  html = html.slice(0, da + DA.length) + guide() + html.slice(db);
  fs.writeFileSync(file, html);
  fs.writeFileSync(fileConv, putBlock(fs.readFileSync(fileConv, 'utf8'), block('convertitore-en.json')));
  console.log('convertitore:', Object.keys(JSON.parse(fs.readFileSync(path.join(dir, 'convertitore-en.json'), 'utf8'))).length, 'frasi');
  console.log('glossario inglese inserito:', Object.keys(JSON.parse(fs.readFileSync(path.join(dir, 'glossario-en.json'), 'utf8')).voci).length, 'voci');
  console.log('guida inglese inserita:', Object.keys(JSON.parse(fs.readFileSync(path.join(dir, 'guida-en.json'), 'utf8')).argomenti).length, 'argomenti');
  console.log('lingua inserita:', Object.keys(JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf8'))).length, 'frasi');
}
