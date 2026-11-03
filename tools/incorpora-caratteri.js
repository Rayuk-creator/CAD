// Mette i caratteri IBM Plex (licenza OFL 1.1) dentro le due pagine, così il browser non chiede nulla a Google.
// Uso: node tools/incorpora-caratteri.js <cartella packages del repository IBM/plex>
// Prende i file di fonts/split/woff2: Latin1 e Pi di ogni peso usato. Riscrive il blocco tra i commenti «CARATTERI».
'use strict';
const fs = require('fs'), path = require('path');
const base = process.argv[2];
if (!base) { console.error('Manca la cartella packages di IBM/plex'); process.exit(1); }
const FACES = [
  ['IBM Plex Mono', 'plex-mono', 'IBMPlexMono', [[400, 'Regular'], [500, 'Medium']]],
  ['IBM Plex Sans Condensed', 'plex-sans-condensed', 'IBMPlexSansCondensed', [[500, 'Medium'], [600, 'SemiBold']]],
  ['IBM Plex Sans', 'plex-sans', 'IBMPlexSans', [[400, 'Regular'], [500, 'Medium'], [600, 'SemiBold']]],
];
const rules = [];
for (const [family, pack, stem, weights] of FACES) for (const [w, name] of weights) {
  const dir = path.join(base, pack, 'fonts', 'split', 'woff2');
  const css = fs.readFileSync(path.join(dir, `${stem}-${name}.css`), 'utf8');
  for (const part of ['Latin1', 'Pi']) {
    const m = css.match(new RegExp(`${stem}-${name}-${part}\\.woff2[\\s\\S]*?unicode-range:\\s*([^;}]+)`));
    if (!m) throw new Error('unicode-range non trovato: ' + name + ' ' + part);
    const data = fs.readFileSync(path.join(dir, `${stem}-${name}-${part}.woff2`)).toString('base64');
    rules.push(`@font-face{font-family:"${family}";font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${data}) format("woff2");unicode-range:${m[1].trim()}}`);
  }
}
const block = `<!-- CARATTERI: inizio (IBM Plex, licenza OFL 1.1; righe lunghe: tools/incorpora-caratteri.js) -->\n<style>\n${rules.join('\n')}\n</style>\n<!-- CARATTERI: fine -->`;
const LINKS = /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\n<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\n<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^\n]*>/;
const OLD = /<!-- CARATTERI: inizio[\s\S]*?<!-- CARATTERI: fine -->/;
for (const f of ['index.html', path.join('convertitore-dwg', 'index.html')]) {
  const p = path.join(__dirname, '..', f); const s = fs.readFileSync(p, 'utf8');
  const head = s.slice(0, 400000);
  if (!LINKS.test(head) && !OLD.test(head)) throw new Error('Punto di inserimento non trovato in ' + f);
  fs.writeFileSync(p, (OLD.test(head) ? head.replace(OLD, () => block) : head.replace(LINKS, () => block)) + s.slice(400000));
  console.log(f, (fs.statSync(p).size / 1048576).toFixed(2), 'MB');
}
