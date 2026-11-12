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

// 5. Guida in inglese: blocco in index.html uguale a tools/traduzione/guida-en.json; ogni argomento tradotto
//    con gli stessi passi, consigli e termini del Glossario; capitoli tradotti
{
  const { guide, DA, DB } = require('../tools/traduzione/incorpora.js');
  const da = page.indexOf(DA), db = page.indexOf(DB);
  rec('Guida inglese in index.html uguale a tools/traduzione/guida-en.json', da >= 0 && db > da && page.slice(da + DA.length, db) === guide());
  const gd = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools', 'traduzione', 'guida-en.json'), 'utf8'));
  const lines = page.split('\n'), s = lines.findIndex(l => /^  const add = \(cap, id, t, o\)/.test(l)), e = lines.findIndex((l, i) => i > s && /^  \/\* -+ lingua -+/.test(l));
  const T = []; vm.runInNewContext(lines.slice(s + 1, e).join('\n'), { add: (cap, id, t, o) => T.push({ cap, id, t, ...o }) });
  // chiavi dei termini del Glossario [[chiave|etichetta]], in ordine alfabetico
  const keys = l => [...[l.why, ...l.steps, ...(l.tips || [])].join(' ').matchAll(/\[\[([^\]|]+)/g)].map(m => m[1]).sort().join(', ');
  const ital = /\b(della|degli|delle|nella|sono|anche|questo|quando|perché|oppure|viene|il|la|lo|le|gli|che|di|un|una|su|con|del|dei|non|si|da|al|alla|nel|questa|clic|tasto|scegli|premi)\b|\be\b(?!\.)/i;  // «e» italiana, non «e.g.»
  // parole italiane ammesse: chiavi dei termini, nomi del menu italiano citati per tornare all'italiano, nomi d'esempio
  const strip = x => x.replace(/\[\[[^\]|]+\|?/g, '').replace(/Progetto › Language|Lingua: italiano|Estrusione1/g, '');
  const bad = [];
  for (const t of T) {
    const v = gd.argomenti[t.id];
    if (!v) { bad.push('manca: ' + t.id); continue; }
    if (!v.t || !v.why || !Array.isArray(v.steps)) { bad.push('incompleto: ' + t.id); continue; }
    if (v.steps.length !== t.steps.length || (v.tips || []).length !== (t.tips || []).length) bad.push('passi o consigli diversi: ' + t.id);
    if (keys(v) !== keys(t)) bad.push('termini diversi: ' + t.id + ' (' + keys(v) + ' ≠ ' + keys(t) + ')');
    if (ital.test(strip([v.t, v.why, ...v.steps, ...(v.tips || [])].join(' ')))) bad.push('italiano rimasto: ' + t.id);
    if (!gd.capitoli[t.cap]) bad.push('capitolo senza traduzione: ' + t.cap);
  }
  for (const k in gd.argomenti) if (!T.some(t => t.id === k)) bad.push('argomento inglese senza argomento italiano: ' + k);
  rec(`Guida inglese: tutti i ${T.length} argomenti (titolo, a cosa serve, passi, consigli, termini) e i capitoli`, T.length > 60 && !bad.length, bad.slice(0, 8).join(' | '));
  rec('Guida: frasi fisse del pannello e «Come si fa: …» del Glossario nel dizionario',
    ['← Tutti gli argomenti', 'Mostrami dove', 'Come si fa', 'Consigli', 'Termini', 'Cerca nella guida'].every(x => en.tr(x) !== x) && en.tr('Come si fa: {} →') === 'How to: {} →');
}

// Convertitore DWG → DXF: stesso modulo con il suo dizionario (convertitore-en.json)
{
  const conv = fs.readFileSync(path.join(__dirname, '..', 'convertitore-dwg', 'index.html'), 'utf8');
  const ca = conv.indexOf('/* LINGUA: inizio */'), cb = conv.indexOf('/* LINGUA: fine */');
  rec('Convertitore: il modulo della lingua è uguale a tools/traduzione (i18n.js + convertitore-en.json)',
    ca >= 0 && conv.slice(ca, cb + '/* LINGUA: fine */\n'.length) === block('convertitore-en.json'));
  const cd = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools', 'traduzione', 'convertitore-en.json'), 'utf8'));
  // chiavi dei testi scritti dal codice: T('…') e F('…'), anche nei due rami di un «? :»
  const code = conv.slice(conv.indexOf('/* LINGUA: fine */'), conv.indexOf('<!-- LETTORE DWG: inizio -->'));
  const used = new Set();
  for (const m of code.matchAll(/\b(?:T|F)\(([^;]*?)\)/g)) for (const q of m[1].matchAll(/(===\s*)?'((?:[^'\\]|\\.)*)'/g)) if (!q[1]) used.add(q[2].replace(/\\'/g, "'"));   // non i confronti (=== 'worker')
  // nomi delle entità delle tabelle READ e SKIP
  const tab = /const READ = \{[\s\S]*?const SKIP = \{[\s\S]*?\};/.exec(code)[0];
  for (const m of tab.matchAll(/\['([^']*)', '([^']*)'\]/g)) { used.add(m[1]); used.add(m[2]); }
  const missing = [...used].filter(k => !(k in cd)), badc = Object.keys(cd).filter(k => !cd[k] || (k.match(/\{\}/g) || []).length !== (cd[k].match(/\{\}/g) || []).length);
  rec(`Convertitore: tutte le ${used.size} frasi scritte dal codice (e i nomi delle entità) hanno la traduzione, con gli stessi {}`, used.size > 80 && !missing.length && !badc.length,
    missing.concat(badc).slice(0, 6).join(' | '));
}

const fail = rows.filter(x => !x).length;
console.log(`\n${rows.length - fail}/${rows.length} superati`);
process.exit(fail ? 1 : 0);
