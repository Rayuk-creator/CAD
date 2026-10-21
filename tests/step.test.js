// Prove del lettore STEP/IGES vero (OpenCascade incorporato in index.html), su file costruiti qui con misure note.
// Uso: node tests/step.test.js [index.html] [cartella dei moduli estratti]   (prima: node tests/extract.js index.html tests/core)
'use strict';
const fs = require('fs'), path = require('path');
const page = process.argv[2] || path.join(__dirname, '..', 'index.html');
const dir = path.resolve(process.argv[3] || path.join(__dirname, 'core'));
const Model = require(path.join(dir, 'model.js'));
const IM = Model.Import;
const { stepBox, stepCylinder, stepPlateHole, stepTwoBoxes } = require('./stepgen.js');
const { igesBox } = require('./igesgen.js');
const TOL = +(process.env.TOL || 0.01), PI = Math.PI;
const html = fs.readFileSync(page, 'utf8');
const js = (html.match(/<script id="occtJs" type="text\/plain">([\s\S]*?)<\/script>/) || [])[1];
const b64 = (html.match(/<script id="occtWasm" type="application\/octet-stream">([\s\S]*?)<\/script>/) || [])[1];
const enc = t => new TextEncoder().encode(t);

// importa come fa il programma: lettura, saldatura dei vertici, facce vere, funzione «Importato»
function importDoc(occt, text, fmt, extra = {}) {
  const r = IM.readCAD(occt, enc(text), fmt);
  const m = IM.weld(r.pos); m.f = new Uint32Array([...m.src].map(t => r.face[t]));
  const d = Model.newDoc();
  d.features.push({ id: 'F1', name: 'Importato1', type: 'import', fmt, file: 'prova.' + fmt, unit: 'mm', mesh: IM.pack(m), ...extra });
  const st = Model.regen(d);
  if (st.errors.size) throw new Error([...st.errors.values()].join('; '));
  return { st, mp: Model.massProperties(st, d), info: st.info.get('F1'), warn: st.warn.get('F1'), r };
}
const CASES = [
  // [nome, testo, formato, valori attesi, opzioni]
  ['STEP: blocco 80 × 50 × 10', stepBox(80, 50, 10), 'step', { V: 40000, A: 10600, C: [40, 25, 5], faces: 6, E: 12, parts: 1 }],
  ['STEP in metri: blocco 0,08 × 0,05 × 0,01 m = 80 × 50 × 10 mm', stepBox(0.08, 0.05, 0.01, { unit: 'm' }), 'step', { V: 40000, A: 10600, C: [40, 25, 5] }],
  ['STEP in centimetri: blocco 3 × 2 × 1 cm', stepBox(3, 2, 1, { unit: 'cm' }), 'step', { V: 6000, A: 2200, C: [15, 10, 5] }],
  ['STEP: cilindro R10 × 20 (superficie cilindrica vera)', stepCylinder(10, 20), 'step', { V: 2000 * PI, A: 400 * PI + 200 * PI, C: [0, 0, 10], faces: 3, parts: 1 }],
  ['STEP: piastra 60 × 40 × 10 con foro passante R8', stepPlateHole(60, 40, 10, 8), 'step', { V: 24000 - 640 * PI, A: 6800 - 128 * PI + 160 * PI, C: [30, 20, 5], faces: 7 }],
  ['STEP: due blocchi 10 mm separati (assieme)', stepTwoBoxes(10, 5), 'step', { V: 2000, A: 1200, C: [12.5, 5, 5], faces: 12, parts: 2, E: 24 }],
  ['STEP con Z verso l\'alto: cilindro R10 × 20 in piedi', stepCylinder(10, 20), 'step', { V: 2000 * PI, C: [0, 10, 0], bb: [[-10, 0, -10], [10, 20, 10]] }, { zUp: true }],
  ['IGES: blocco 30 × 20 × 10 (6 superfici piane tagliate)', igesBox(30, 20, 10), 'iges', { V: 6000, A: 2200, C: [15, 10, 5], faces: 6, E: 12, parts: 1 }],
];

(async () => {
  if (!js || !b64) { console.log('NO  il lettore STEP/IGES non è dentro ' + page); process.exit(1); }
  const t0 = Date.now();
  const occt = await IM.loadOCCT({ js, wasmGz: () => IM.b64dec(b64), require });
  console.log(`lettore pronto in ${Date.now() - t0} ms`);
  let fail = 0, n = 0;
  const rel = (g, e, s) => Math.abs(g - e) / Math.max(Math.abs(e), s || 1e-9);
  for (const [name, text, fmt, exp, extra] of CASES) {
    n++;
    const msg = [], errs = {};
    let ok = true;
    try {
      const { st, mp, info, warn } = importDoc(occt, text, fmt, extra);
      if (warn) { ok = false; msg.push('avviso: ' + warn); }
      const size = Math.max(...[0, 1, 2].map(i => mp.bbox.mx[i] - mp.bbox.mn[i]));
      const chk = (lab, g, e, s) => { const r = rel(g, e, s); if (r > TOL) { ok = false; msg.push(`${lab}: ${(+g).toFixed(3)} invece di ${(+e).toFixed(3)} (${(r * 100).toFixed(2)}%)`); } return r; };
      if (exp.V !== undefined) errs.V = chk('Volume', mp.volume, exp.V);
      if (exp.A !== undefined) errs.A = chk('Area', mp.area, exp.A);
      if (exp.C) errs.C = Math.max(...exp.C.map((e, i) => chk('Baricentro ' + 'xyz'[i], mp.centroid[i], e, size)));
      if (exp.bb) errs.bb = Math.max(...[0, 1, 2].map(i => Math.max(chk('Ingombro min ' + 'xyz'[i], mp.bbox.mn[i], exp.bb[0][i], size), chk('Ingombro max ' + 'xyz'[i], mp.bbox.mx[i], exp.bb[1][i], size))));
      // conteggi: devono essere esatti
      const eq = (lab, g, e) => { if (g !== e) { ok = false; msg.push(`${lab}: ${g} invece di ${e}`); } };
      if (exp.faces !== undefined) eq('Facce vere', info.brepFaces, exp.faces);
      if (exp.parts !== undefined) eq('Corpi', info.parts, exp.parts);
      if (exp.E !== undefined) eq('Spigoli vivi', st.topo.edges.filter(e => e.sharp).length, exp.E);
    } catch (e) { ok = false; msg.push('ERRORE ' + e.message); }
    if (!ok) fail++;
    const pct = x => (x * 100).toFixed(3) + '%';
    console.log((ok ? 'OK  ' : 'NO  ') + name + (Object.keys(errs).length ? '  [' + Object.entries(errs).map(([k, v]) => k + ' ' + pct(v)).join(', ') + ']' : '') + (msg.length ? '\n      ' + msg.join('\n      ') : ''));
  }
  // file sbagliati: messaggi chiari
  const bad = [
    ['Un testo qualsiasi con estensione .step → messaggio «non è uno STEP valido»', () => IM.readCAD(occt, enc('ciao'), 'step'), /non è uno STEP valido/],
    ['Uno STEP danneggiato (dati tagliati a metà) → messaggio d\'errore, nessun blocco', () => { const t = stepBox(10, 10, 10); return IM.readCAD(occt, enc(t.slice(0, t.length / 2)), 'step'); }, /non si riesce a leggere|non ci sono solidi/],
  ];
  for (const [name, fn, re] of bad) {
    n++;
    let ok = false, got = 'nessun errore';
    try { fn(); } catch (e) { got = e.message; ok = re.test(e.message); }
    if (!ok) fail++;
    console.log((ok ? 'OK  ' : 'NO  ') + name + (ok ? '' : '\n      messaggio: ' + got));
  }
  console.log(`\n${n - fail}/${n} superati (tolleranza ${(TOL * 100).toFixed(1)}%)`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
