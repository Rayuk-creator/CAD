// Estrae da index.html le frasi italiane del programma (stringhe e template del codice, testi dell'HTML).
// Uso: node tools/traduzione/estrai.js [index.html] > frasi.json
// I pezzi ${...} dei template diventano {} ; i template con HTML si dividono sui tag di blocco.
'use strict';
const fs = require('fs'), path = require('path');
const ts = require('/opt/node22/lib/node_modules/typescript');
const file = process.argv[2] || path.join(__dirname, '../../index.html');
let src = fs.readFileSync(file, 'utf8');
{ const a = src.indexOf('/* LINGUA: inizio */'), b = src.indexOf('/* LINGUA: fine */'); if (a >= 0) src = src.slice(0, a) + src.slice(b + 19); }
const lines = src.split('\n');
// zone escluse: Glossario, Autoverifica, Guida (tradotte a parte), dati in base64
const start = (re) => lines.findIndex(l => re.test(l));
const sOpen = start(/^<script>$/);
const sClose = lines.findIndex((l, i) => i > sOpen && l === '</script>');
const glos = start(/^  \/\/ \[categoria, termine, alias/) - 3;
const guideEnd = lines.findIndex((l, i) => i > glos && /window\.Guide = /.test(l)) + 2;
const js = lines.slice(sOpen + 1, glos).join('\n');
const html = lines.slice(0, sOpen).join('\n');
const INLINE = new Set(['b', 'i', 'em', 'strong', 'kbd', 'code', 'sub', 'sup', 'br', 'u', 'small']);
const out = new Map();
const add = (s, where) => {
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) return;
  if (!/[A-Za-zÀ-ÿ]{2}/.test(s.replace(/\{\}/g, ''))) return;
  if (!out.has(s)) out.set(s, where);
};
// divide un testo con HTML come lo divide la pagina tradotta (vedi i18n.js):
// i tag di blocco e i comandi (input, button, svg...) chiudono la frase; <b>, <i>... restano nella frase;
// gli altri elementi in linea (a, span...) diventano {} e il loro testo è una frase a sé
const CTRL = new Set(['input', 'button', 'select', 'option', 'textarea', 'img', 'svg', 'canvas', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'g', 'ellipse', 'text', 'tspan', 'defs', 'marker', 'use', 'title']);
const BLOCK = new Set(['div', 'p', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'header', 'footer', 'nav', 'aside', 'main', 'form', 'fieldset', 'legend', 'pre', 'blockquote', 'dl', 'dt', 'dd', 'details', 'summary', 'figure', 'figcaption', 'caption', 'colgroup', 'col', 'hr', 'style', 'script', 'html', 'head', 'body', 'meta', 'link', 'label']);
function splitHtml(s, where) {
  const parts = s.split(/(<\/?[a-zA-Z][^>]*>)/);
  const stack = []; let cur = '';
  for (const p of parts) {
    const m = /^<(\/?)([a-zA-Z0-9]+)/.exec(p);
    if (!m) { cur += p; continue; }
    for (const a of p.matchAll(/\b(title|aria-label|placeholder|alt)="([^"]*)"/g)) add(a[2], where);
    const tag = m[2].toLowerCase(), close = !!m[1];
    if (INLINE.has(tag) && !/\s[a-z-]+=/i.test(p)) { cur += p; continue; }
    if (BLOCK.has(tag) || CTRL.has(tag)) { add(cur, where); cur = ''; while (stack.length) { add(stack.pop(), where); } continue; }
    // elemento in linea con attributi o sconosciuto: {} nella frase, il suo testo a parte
    if (!close) { stack.push(cur); cur = ''; }
    else if (stack.length) { add(cur, where); cur = stack.pop() + '{}'; }
    else { add(cur, where); cur = '{}'; }
  }
  add(cur, where);
  while (stack.length) add(stack.pop(), where);
}
const sf = ts.createSourceFile('a.js', js, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const lineOf = pos => sOpen + 2 + js.slice(0, pos).split('\n').length - 1;
const isStr = n => n.kind === ts.SyntaxKind.StringLiteral || n.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral || n.kind === ts.SyntaxKind.TemplateExpression;
const strOf = n => {
  if (n.kind === ts.SyntaxKind.TemplateExpression) { let s = n.head.text; for (const sp of n.templateSpans) s += '{}' + sp.literal.text; return s; }
  return n.text;
};
// catena a + b + c: le parti non di testo diventano {}
function flat(n, acc) {
  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) { flat(n.left, acc); flat(n.right, acc); }
  else if (ts.isParenthesizedExpression(n) && ts.isBinaryExpression(n.expression) && n.expression.operatorToken.kind === ts.SyntaxKind.PlusToken) flat(n.expression, acc);
  else acc.push(n);
  return acc;
}
function emit(s, n) {
  const where = lineOf(n.getStart(sf));
  if (/[<>]/.test(s)) splitHtml(s, where); else add(s, where);
}
function visit(n) {
  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const parts = flat(n, []);
    if (parts.some(isStr)) {
      emit(parts.map(p => isStr(p) ? strOf(p) : '{}').join('').replace(/(\{\})+/g, '{}'), n);
      for (const p of parts) { if (p.kind === ts.SyntaxKind.TemplateExpression) p.templateSpans.forEach(sp => visit(sp.expression)); else if (!isStr(p)) visit(p); }
      return;
    }
  }
  if (isStr(n)) {
    emit(strOf(n), n);
    if (n.kind === ts.SyntaxKind.TemplateExpression) n.templateSpans.forEach(sp => visit(sp.expression));
    return;
  }
  ts.forEachChild(n, visit);
}
visit(sf);
// HTML statico
splitHtml(html.slice(html.indexOf('<body')), 'html');
// filtro: niente codice (selettori, identificatori, CSS, base64)
const ITA = /\b(il|lo|la|le|gli|un|una|di|da|del|della|dei|delle|che|non|per|con|su|nel|nella|è|sono|si|clic|scegli|questo|questa)\b|[àèéìòù]/i;
const res = [];
for (const [s, where] of out) {
  if (s.length > 400 && !/ /.test(s.slice(0, 50))) continue;
  if (/^[#.\[][\w-]/.test(s) && !/ [a-z]+ [a-z]+ /.test(s)) continue;                 // selettori
  if (/^[\w$.-]+$/.test(s) && !/^[A-ZÀ-Ú][a-zà-ù]+$/.test(s) && !/[àèéìòù]/.test(s)) continue; // identificatori
  if (/[{;]\s*[a-z-]+\s*:/.test(s) && !ITA.test(s)) continue;                          // CSS
  if (/^(M|m)[\d .,-]+[LlHhVvCcAaZz]/.test(s)) continue;                                // percorsi SVG
  res.push({ s, l: where, ita: ITA.test(s) || /^[A-ZÀ-Ú]/.test(s) });
}
process.stdout.write('[\n' + res.map(x => JSON.stringify(x)).join(',\n') + '\n]\n');
