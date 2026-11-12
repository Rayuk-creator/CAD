// Elenco delle frasi italiane rimaste senza traduzione, raccolte dalle prove dell'interfaccia (npm run test:lingua).
// Si tolgono solo quelle dell'Autoverifica, che resta in italiano. Glossario (tappa 2) e Guida (tappa 3) sono tradotti:
// i loro testi si scrivono già in inglese e le loro frasi fisse devono essere nel dizionario.
// Uso: node tools/traduzione/mancanti.js tests/frasi-mancanti.json [index.html]
'use strict';
const fs = require('fs'), path = require('path');
const ts = require(require.resolve('typescript', { paths: [process.cwd(), '/opt/node22/lib/node_modules'] }));
const miss = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const src = fs.readFileSync(process.argv[3] || path.join(__dirname, '../../index.html'), 'utf8');
const lines = src.split('\n');
const from = lines.findIndex(l => /^\/\* Autoverifica: le stesse prove/.test(l));
const to = lines.findIndex((l, i) => i > from && /root\.SelfTest = \{ run/.test(l)) + 1;
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
console.log(`Frasi senza traduzione: ${rest.length} (più ${miss.length - rest.length} dell'Autoverifica, che resta in italiano)`);
for (const m of rest) console.log('  ' + m);
process.exit(rest.length ? 1 : 0);
