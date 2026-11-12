// Mette in index.html il modulo della lingua (i18n.js) con il dizionario inglese (en.json)
// e il Glossario in inglese (glossario-en.json).
// Uso: node tools/traduzione/incorpora.js [index.html]
// Il modulo sta tra i commenti «LINGUA: inizio/fine», subito dopo il primo <script>;
// il Glossario tra «GLOSSARIO EN: inizio/fine», dentro il modulo Glossary.
'use strict';
const fs = require('fs'), path = require('path');
const dir = __dirname, file = process.argv[2] || path.join(dir, '../../index.html');
function block() {
  const dict = JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf8'));
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
module.exports = { block, glossary, GA, GB };
if (require.main === module) {
  let html = fs.readFileSync(file, 'utf8');
  const s = html.indexOf('/* LINGUA: inizio */'), e = html.indexOf('/* LINGUA: fine */');
  const b = block();
  if (s >= 0) html = html.slice(0, s) + b + html.slice(e + '/* LINGUA: fine */\n'.length);
  else { const k = html.indexOf('<script>\n') + '<script>\n'.length; html = html.slice(0, k) + b + html.slice(k); }
  const ga = html.indexOf(GA), gb = html.indexOf(GB);
  if (ga < 0 || gb < 0) throw new Error('segni del Glossario inglese non trovati in ' + file);
  html = html.slice(0, ga + GA.length) + glossary() + html.slice(gb);
  fs.writeFileSync(file, html);
  console.log('glossario inglese inserito:', Object.keys(JSON.parse(fs.readFileSync(path.join(dir, 'glossario-en.json'), 'utf8')).voci).length, 'voci');
  console.log('lingua inserita:', Object.keys(JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf8'))).length, 'frasi');
}
