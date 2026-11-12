// Elenco delle frasi italiane rimaste senza traduzione, raccolte dalle prove dell'interfaccia (npm run test:lingua).
// Per ora si tolgono quelle di Autoverifica e Guida (la Guida è la tappa 3 della traduzione; l'Autoverifica resta in italiano).
// Il Glossario è tradotto (tappa 2) e non si toglie più.
// Uso: node tools/traduzione/mancanti.js tests/frasi-mancanti.json [index.html]
'use strict';
const fs = require('fs'), path = require('path');
const ts = require(require.resolve('typescript', { paths: [process.cwd(), '/opt/node22/lib/node_modules'] }));
const miss = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const src = fs.readFileSync(process.argv[3] || path.join(__dirname, '../../index.html'), 'utf8');
const lines = src.split('\n');
const from = lines.findIndex(l => /^\/\* Autoverifica: le stesse prove/.test(l));
const to = lines.findIndex((l, i) => i > from && /window\.Guide = /.test(l));
const sf = ts.createSourceFile('a.js', lines.slice(from, to).join('\n'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const later = new Set();
(function visit(n) {
  if (n.kind === ts.SyntaxKind.StringLiteral || n.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral) later.add(n.text.replace(/\[\[|\]\]|\*\*/g, '').replace(/\s+/g, ' ').trim());
  else if (n.kind === ts.SyntaxKind.TemplateExpression) { later.add(n.head.text.trim()); n.templateSpans.forEach(s => later.add(s.literal.text.trim())); }
  ts.forEachChild(n, visit);
})(sf);
const long = [...later].filter(s => s.length >= 15);
const isLater = m => later.has(m) || long.some(s => m.includes(s.slice(0, 40))) || [...later].some(s => s.length >= 4 && s.includes(m));
const rest = miss.filter(m => !isLater(m));
console.log(`Frasi senza traduzione: ${rest.length} (più ${miss.length - rest.length} di Autoverifica e Guida, da tradurre dopo)`);
for (const m of rest) console.log('  ' + m);
process.exit(rest.length ? 1 : 0);
