// Mette in index.html il modulo della lingua (i18n.js) con il dizionario inglese (en.json).
// Uso: node tools/traduzione/incorpora.js [index.html]
// Il blocco sta tra i commenti «LINGUA: inizio/fine», subito dopo il primo <script>.
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
module.exports = { block };
if (require.main === module) {
  let html = fs.readFileSync(file, 'utf8');
  const s = html.indexOf('/* LINGUA: inizio */'), e = html.indexOf('/* LINGUA: fine */');
  const b = block();
  if (s >= 0) html = html.slice(0, s) + b + html.slice(e + '/* LINGUA: fine */\n'.length);
  else { const k = html.indexOf('<script>\n') + '<script>\n'.length; html = html.slice(0, k) + b + html.slice(k); }
  fs.writeFileSync(file, html);
  console.log('lingua inserita:', Object.keys(JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf8'))).length, 'frasi');
}
