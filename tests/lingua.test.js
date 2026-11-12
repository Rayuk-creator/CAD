// Prove della lingua (senza browser): dizionario inglese ben fatto e uguale a quello dentro index.html,
// traduzione delle frasi con i pezzi variabili, numeri con il punto in inglese.
// Uso: node tests/lingua.test.js index.html
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const page = fs.readFileSync(process.argv[2] || path.join(__dirname, '..', 'index.html'), 'utf8');
const rows = [];
const rec = (name, ok, msg) => { rows.push(ok); console.log((ok ? 'OK  ' : 'NO  ') + name + (msg ? '\n      ' + msg : '')); };

// 1. il blocco in index.html è quello che scrive tools/traduzione/incorpora.js
const { block } = require('../tools/traduzione/incorpora.js');
const a = page.indexOf('/* LINGUA: inizio */'), b = page.indexOf('/* LINGUA: fine */');
rec('Il modulo della lingua in index.html è uguale a tools/traduzione (i18n.js + en.json)', a >= 0 && page.slice(a, b + '/* LINGUA: fine */\n'.length) === block());

// 2. ogni frase ha gli stessi pezzi variabili in italiano e in inglese, e niente valori vuoti
const dict = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools', 'traduzione', 'en.json'), 'utf8'));
const bad = Object.keys(dict).filter(k => !dict[k] || (k.match(/\{#?\}/g) || []).length !== (dict[k].match(/\{\d*\}/g) || []).length);
rec('Dizionario: stessi pezzi variabili {} in italiano e in inglese', !bad.length, bad.slice(0, 5).join(' | '));

// 3. il modulo in una pagina finta, in inglese
function load(lang) {
  const store = { 'banco-cad-lang': lang };
  const win = { location: { search: '', href: 'file:///x' }, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } } };
  vm.runInNewContext(page.slice(a, b), win);
  return win.I18N;
}
const en = load('en'), it = load('it');
const cases = [
  ['Annulla', 'Cancel'],
  ['Estrusione3', 'Boss-Extrude3'],
  ['Taglio-Estrusione12', 'Cut-Extrude12'],
  ['Modifica: Schizzo2', 'Edit: Sketch2'],
  ['Troppe rivoluzioni (120): il massimo è 100', 'Too many revolutions (120): the maximum is 100'],
  ['2 interferenze su 3 coppie.', '2 interferences in 3 pairs.'],
  ['Sotto definito (4 gradi di libertà)', 'Under Defined (4 degrees of freedom)'],
  ['  Pronto ', '  Ready '],
  ['Parte1-tavola.pdf', 'Part1-drawing.pdf'],
];
const wrong = cases.filter(([i, e]) => en.tr(i) !== e).map(([i, e]) => `${i} → ${en.tr(i)} (atteso ${e})`);
rec('Traduzione: frasi intere, nomi delle funzioni, pezzi variabili tradotti a loro volta', !wrong.length, wrong.join(' | '));
rec('Frase che manca: resta in italiano ed entra nell\'elenco delle mancanti', en.tr('Frase inventata per la prova') === 'Frase inventata per la prova' && en.missing.has('Frase inventata per la prova'));
rec('In italiano niente cambia (nessuna traduzione, virgola decimale)', it.tr('Annulla') === 'Annulla' && it.dc === ',' && it.dec('2.5') === '2,5' && !it.en);
rec('In inglese il separatore decimale è il punto', en.dc === '.' && en.dec('2.5') === '2.5' && en.loc === 'en-US');
rec('Testi di un SVG tradotti (tavola salvata), il resto non cambia',
  en.svg('<svg><text x="1">Scala</text><text>1:2</text><path d="M0 0"/></svg>') === '<svg><text x="1">Scale</text><text>1:2</text><path d="M0 0"/></svg>');

// 4. Glossario in inglese: blocco in index.html uguale a tools/traduzione/glossario-en.json, una voce inglese per ogni voce italiana
{
  const { glossary, GA, GB } = require('../tools/traduzione/incorpora.js');
  const ga = page.indexOf(GA), gb = page.indexOf(GB);
  rec('Glossario inglese in index.html uguale a tools/traduzione/glossario-en.json', ga >= 0 && gb > ga && page.slice(ga + GA.length, gb) === glossary());
  const gl = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools', 'traduzione', 'glossario-en.json'), 'utf8'));
  const lines = page.split('\n'), s = lines.findIndex(l => /^  const E = \[/.test(l)), e = lines.findIndex((l, i) => i > s && /^  \];/.test(l));
  const E = vm.runInNewContext('[' + lines.slice(s + 1, e).join('\n') + ']');
  const twice = new Set(E.map(x => x[1]).filter((t, i, a) => a.indexOf(t) !== i));
  const keys = E.map(x => twice.has(x[1]) ? x[0] + '/' + x[1] : x[1]);
  const bad = [];
  keys.forEach((k, i) => {
    const v = gl.voci[k];
    if (!v) { bad.push('manca: ' + k); return; }
    if (!v.t || !v.d || !Array.isArray(v.a)) bad.push('voce incompleta: ' + k);
    // la spiegazione inglese è una traduzione: niente parole italiane frequenti rimaste
    else if (/\b(della|degli|delle|nella|sono|anche|questo|quando|perché|oppure|viene)\b/i.test(v.d + ' ' + v.t)) bad.push('italiano rimasto: ' + k);
    if (!gl.categorie[E[i][0]]) bad.push('categoria senza traduzione: ' + E[i][0]);
  });
  for (const k in gl.voci) if (!keys.includes(k)) bad.push('voce inglese senza voce italiana: ' + k);
  rec(`Glossario inglese: tutte le ${E.length} voci (termine, altri nomi, spiegazione) e le categorie`, E.length > 200 && !bad.length, bad.slice(0, 8).join(' | '));
}

const fail = rows.filter(x => !x).length;
console.log(`\n${rows.length - fail}/${rows.length} superati`);
process.exit(fail ? 1 : 0);
