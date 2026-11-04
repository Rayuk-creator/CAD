// Prove del lettore STEP/IGES vero (OpenCascade incorporato in index.html), su file costruiti qui con misure note.
// Uso: node tests/step.test.js [index.html] [cartella dei moduli estratti]   (prima: node tests/extract.js index.html tests/core)
'use strict';
const fs = require('fs'), path = require('path');
const page = process.argv[2] || path.join(__dirname, '..', 'index.html');
const dir = path.resolve(process.argv[3] || path.join(__dirname, 'core'));
const Model = require(path.join(dir, 'model.js'));
const IM = Model.Import;
const Sketch = require(path.join(dir, 'sketch.js')), Geom = require(path.join(dir, 'geom.js')), Export = require(path.join(dir, 'export.js'));
const { stepBox, stepCylinder, stepCone, stepSphere, stepDome, stepPlateHole, stepTwoBoxes, stepTwoBoxesColored } = require('./stepgen.js');
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
  // corpi e colori: due blocchi 10 mm (il primo blu con la faccia di sotto rossa, il secondo senza colore)
  const more = [
    ['STEP con colori: elenco dei corpi (facce, volume, colore) e colori delle facce', () => {
      const r = IM.readCAD(occt, enc(stepTwoBoxesColored(10, 5)), 'step');
      const b = r.bodies, f0 = [...new Set([...r.face].filter((x, t) => r.body[t] === 0))], f1 = [...new Set([...r.face].filter((x, t) => r.body[t] === 1))];
      const red = f0.filter(f => r.fcol[f] === 'ff0000').length, blue = f0.filter(f => r.fcol[f] === '0000ff').length, none = f1.filter(f => !r.fcol[f]).length;
      return [[b.length, 2], [b[0].faces, 6], [b[1].faces, 6], [b[0].color, '0000ff'], [b[1].color, null], [Math.round(b[0].volume), 1000], [Math.round(b[1].volume), 1000], [red, 1], [blue, 5], [none, 6]];
    }],
    ['STEP: solo il secondo corpo dell\'assieme (cubo 10 in x 15…25)', () => {
      const r = IM.pickBodies(IM.readCAD(occt, enc(stepTwoBoxesColored(10, 5)), 'step'), [1]);
      const m = IM.weld(r.pos); m.f = new Uint32Array([...m.src].map(t => r.face[t]));
      const d = Model.newDoc(); d.features.push({ id: 'F1', name: 'Importato1', type: 'import', fmt: 'step', file: 'c.step', unit: 'mm', mesh: IM.pack(m) });
      const st = Model.regen(d), mp = Model.massProperties(st, d);
      return [[r.bodies.length, 1], [r.faces, 6], [st.info.get('F1').parts, 1], [+mp.volume.toFixed(6), 1000], [+mp.centroid[0].toFixed(6), 20], [+mp.bbox.mn[0].toFixed(6), 15]];
    }],
    ['STEP con colori nel pezzo: faccia di sotto rossa, le altre blu; senza «Colori del file» nessun colore', () => {
      const r = IM.readCAD(occt, enc(stepTwoBoxesColored(10, 5)), 'step');
      const m = IM.weld(r.pos); m.f = new Uint32Array([...m.src].map(t => r.face[t]));
      const fcol = Array.from({ length: r.faces }, (x, i) => r.fcol[i] || 0);
      const count = colors => { const d = Model.newDoc(); d.features.push({ id: 'F1', name: 'Importato1', type: 'import', fmt: 'step', file: 'c.step', unit: 'mm', mesh: IM.pack(m), fcol, colors });
        const st = Model.regen(d), c = { r: 0, b: 0, n: 0 };
        for (const p of st.body) { const tg = st.tags.get(p.t), k = !tg.rgb ? 'n' : tg.rgb[0] === 1 && tg.rgb[2] === 0 ? 'r' : tg.rgb[2] === 1 && tg.rgb[0] === 0 ? 'b' : '?'; c[k] = (c[k] || 0) + 1; }
        // facce del primo cubo: z = 0 → rossa; il secondo cubo (x ≥ 15) senza colore
        const bottom = st.body.filter(p => p.v.every(v => Math.abs(v[2]) < 1e-9 && v[0] < 12)), second = st.body.filter(p => p.v.every(v => v[0] > 14));
        return { c, bottomRed: bottom.every(p => { const t = st.tags.get(p.t); return t.rgb && t.rgb[0] === 1 && t.rgb[2] === 0; }) && bottom.length > 0, secondNone: second.every(p => !st.tags.get(p.t).rgb) && second.length > 0 };
      };
      const on = count(true), off = count(false);
      return [[on.bottomRed, true], [on.secondNone, true], [on.c.b > 0, true], [on.c['?'] || 0, 0], [off.c.r + off.c.b, 0]];
    }],
    ['IGES: le 6 superfici del blocco (una per «mesh») sono un corpo solo', () => {
      const r = IM.readCAD(occt, enc(igesBox(30, 20, 10)), 'iges');
      return [[r.meshes > 1, true], [r.bodies.length, 1], [r.bodies[0].faces, 6], [Math.round(r.bodies[0].volume), 6000], [Math.max(...r.body), 0]];
    }],
  ];
  for (const [name, fn] of more) {
    n++;
    let ok = true, msg = '';
    try { const pairs = fn(); const bad = pairs.map(([g, e], i) => g === e ? '' : `valore ${i}: ${JSON.stringify(g)} invece di ${JSON.stringify(e)}`).filter(Boolean); if (bad.length) { ok = false; msg = bad.join('; '); } }
    catch (e) { ok = false; msg = 'ERRORE ' + e.message; }
    if (!ok) fail++;
    console.log((ok ? 'OK  ' : 'NO  ') + name + (msg ? '\n      ' + msg : ''));
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

  // esportazione STEP del Banco CAD riletta con OpenCascade (come farebbero SolidWorks, FreeCAD…), nei due modi:
  // - a facce piane (senza i tag): stesse facce, stessi solidi, volume e area dei triangoli riletti uguali a quelli del corpo
  //   a faccette del Banco CAD (entro 10⁻⁷);
  // - con le superfici vere (come fa il programma): stesse facce e solidi; riletto con triangoli fini (0,02 rad) il volume è
  //   quello esatto entro 2·10⁻⁴, e per i pezzi con superfici curve almeno 5 volte più vicino di quello a facce piane
  const SB = () => { const s2 = Sketch.newSketch(); const pt = (x, y, ex = {}) => { const id = 'p' + (s2.next++); s2.ents.push({ id, t: 'pt', x, y, ...ex }); return id; };
    const api = { s: s2, pt, line(a, b, ex = {}) { const id = 'l' + (s2.next++); s2.ents.push({ id, t: 'ln', a, b, ...ex }); return id; },
      rect(x0, y0, x1, y1) { const ids = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => pt(x, y)); for (let i = 0; i < 4; i++) api.line(ids[i], ids[(i + 1) % 4]); },
      circle(x, y, r) { const c = pt(x, y); s2.ents.push({ id: 'c' + (s2.next++), t: 'ci', c, r }); },
      arc(c, a, b) { s2.ents.push({ id: 'a' + (s2.next++), t: 'ar', c, a, b }); },
      center(x0, y0, x1, y1) { return api.line(pt(x0, y0), pt(x1, y1), { cons: true, center: true }); } };
    return api; };
  const feat = (d, f) => { f.id = f.id || Model.uid(d, 'F'); f.name = f.name || Model.defaultName(d, f.type); d.features.push(f); return f.id; };
  const skf = (d, plane, b) => feat(d, { type: 'sketch', plane: { kind: 'std', id: plane }, sk: b.s });
  const D0 = n => { const d = Model.newDoc(); d.name = n; return d; };
  const facet = body => { let V = 0, A = 0; for (const p of body) for (let i = 1; i < p.v.length - 1; i++) { const a = p.v[0], b = p.v[i], c = p.v[i + 1];
    const cr = [b[1] * c[2] - b[2] * c[1], b[2] * c[0] - b[0] * c[2], b[0] * c[1] - b[1] * c[0]]; V += (a[0] * cr[0] + a[1] * cr[1] + a[2] * cr[2]) / 6;
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; A += Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]) / 2; } return { V, A }; };
  // più corpi: due blocchi che si toccano con una faccia e non sono uniti → due solidi, riletti con il volume giusto
  {
    n++; let ok = true; const m3 = [];
    try {
      const d = D0('corpi'); const b1 = SB(); b1.rect(0, 0, 10, 10); feat(d, { type: 'extrude', sketch: skf(d, 'top', b1), end: 'blind', depth: 10 });
      const b2 = SB(); b2.circle(15, 5, 5); feat(d, { type: 'extrude', sketch: skf(d, 'top', b2), end: 'blind', depth: 10, merge: false });
      const st = Model.regen(d), ex = Export.toSTEP(st.body, Geom.topology(st.body, st.tags), { name: d.name, tags: st.tags, bodies: Model.stepBodies(st), color: [0.66, 0.7, 0.74] });
      const r = IM.readCAD(occt, new TextEncoder().encode(ex.text), 'step');
      const V = r.bodies.reduce((a, b) => a + b.volume, 0), Ve = 1000 + PI * 25 * 10;
      if (r.bodies.length !== 2 || ex.stats.solids !== 2 || ex.stats.badEdges + ex.stats.openLoops) { ok = false; m3.push(`${r.bodies.length} corpi riletti, ${ex.stats.solids} solidi, ${ex.stats.badEdges + ex.stats.openLoops} spigoli aperti`); }
      if (Math.abs(V - Ve) / Ve > 2e-3) { ok = false; m3.push(`volume ${V.toFixed(3)} invece di ${Ve.toFixed(3)}`); }
      m3.unshift(`${r.bodies.length} corpi, volume ${V.toFixed(3)} (atteso ${Ve.toFixed(3)})`);
    } catch (e) { ok = false; m3.push('ERRORE ' + e.message); }
    if (!ok) fail++;
    console.log((ok ? 'OK  ' : 'NO  ') + 'STEP di due corpi che si toccano, riletto con OpenCascade\n      ' + m3.join('\n      '));
  }
  const exportCases = [
    ['blocco 80 × 50 × 10', () => { const d = D0('blocco'); const b = SB(); b.rect(0, 0, 80, 50); feat(d, { type: 'extrude', sketch: skf(d, 'top', b), end: 'blind', depth: 10 }); return d; }, 40000],
    ['piastra 100 × 60 × 8 con 4 fori R5', () => { const d = D0('piastra'); const b = SB(); b.rect(0, 0, 100, 60); for (const [x, y] of [[20, 15], [80, 15], [20, 45], [80, 45]]) b.circle(x, y, 5); feat(d, { type: 'extrude', sketch: skf(d, 'top', b), end: 'blind', depth: 8 }); return d; }, 48000 - 4 * 25 * PI * 8],
    ['blocco 60 × 40 × 10 con un dado 20 × 20 × 15 sopra', () => { const d = D0('gradino'); const b = SB(); b.rect(0, 0, 60, 40); feat(d, { type: 'extrude', sketch: skf(d, 'top', b), end: 'blind', depth: 10 });
      const b2 = SB(); b2.rect(10, 10, 30, 30); feat(d, { type: 'extrude', sketch: skf(d, 'top', b2), end: 'blind', depth: 25 }); return d; }, 24000 + 6000],
    ['tubo di rivoluzione R 20/12, alto 30 (superfici curve divise in facce)', () => { const d = D0('tubo'); const b = SB(); b.center(0, -100, 0, 100); b.rect(12, 0, 20, 30);
      feat(d, { type: 'revolve', sketch: skf(d, 'front', b), angle: 360 }); return d; }, PI * (400 - 144) * 30],
    // cilindro R10 alto 30, foro R4 di traverso: volume del foro = ∫∫ 2√(R² − x²) sul cerchio r = 4 (integrale numerico fine)
    ['cilindro R10 forato di traverso da R4 (bordi B-spline)', () => { const d = D0('perno'); const b = SB(); b.circle(0, 0, 10); feat(d, { type: 'extrude', sketch: skf(d, 'top', b), end: 'blind', depth: 30 });
      const h = SB(); h.circle(0, 15, 4); feat(d, { type: 'cut', sketch: skf(d, 'front', h), end: 'mid', depth: 40 }); return d; },
      PI * 100 * 30 - (() => { let s = 0; const N = 2000, r = 4, R = 10; for (let i = 0; i < N; i++) { const x = -r + (i + 0.5) * 2 * r / N; s += 2 * Math.sqrt(R * R - x * x) * 2 * Math.sqrt(r * r - x * x) * 2 * r / N; } return s; })()],
    // due cilindri diversi che si incrociano con un'estremità: R6 alto 30 sopra un cilindro R10 lungo 40, assi che si incontrano; il
    // tratto R6 sporge di 30 dall'asse: V = π100·40 + π36·30 − (metà foro R6 in R10) − … (volume del pezzo di R6 dentro R10, numerico)
    ['cilindro R10 con braccio R6 ad angolo retto (bordo B-spline aperto o chiuso)', () => { const d = D0('t'); const b = SB(); b.circle(0, 0, 10); feat(d, { type: 'extrude', sketch: skf(d, 'top', b), end: 'mid', depth: 40 });
      const h = SB(); h.circle(0, 0, 6); feat(d, { type: 'extrude', sketch: skf(d, 'front', h), end: 'blind', depth: 30 }); return d; },
      PI * 100 * 40 + PI * 36 * 30 - (() => { let s = 0; const N = 2000, r = 6, R = 10; for (let i = 0; i < N; i++) { const x = -r + (i + 0.5) * 2 * r / N; s += Math.sqrt(R * R - x * x) * 2 * Math.sqrt(r * r - x * x) * 2 * r / N; } return s; })()],
    // foro R4 con il centro a 2 mm dalla base: esce dalla base, quindi i bordi tra i due cilindri sono aperti e finiscono su un piano.
    // Volume tolto = ∫∫ 2√(R² − x²) sulla parte del cerchio r = 4 con y > 0 (integrale numerico fine)
    ['cilindro R10 con foro R4 che esce dalla base (B-spline aperte, vertici su tre superfici)', () => { const d = D0('p3'); const b = SB(); b.circle(0, 0, 10); feat(d, { type: 'extrude', sketch: skf(d, 'top', b), end: 'blind', depth: 30 });
      const h = SB(); h.circle(0, 2, 4); feat(d, { type: 'cut', sketch: skf(d, 'front', h), end: 'mid', depth: 40 }); return d; },
      PI * 100 * 30 - (() => { let s = 0; const N = 1500, r = 4, R = 10; for (let i = 0; i < N; i++) { const x = -r + (i + 0.5) * 2 * r / N, c = Math.sqrt(r * r - x * x), y1 = 2 + c, y0 = Math.max(0, 2 - c); s += 2 * Math.sqrt(R * R - x * x) * (y1 - y0) * 2 * r / N; } return s; })()],
    ['due blocchi 10 × 10 × 10 staccati (due solidi)', () => { const d = D0('due'); const b = SB(); b.rect(0, 0, 10, 10); b.rect(20, 0, 30, 10); feat(d, { type: 'extrude', sketch: skf(d, 'top', b), end: 'blind', depth: 10 }); return d; }, 2000],
    ['sfera R10 (rivoluzione di un mezzo cerchio)', () => { const d = D0('sfera'); const b = SB(); b.center(0, -100, 0, 100); const c = b.pt(0, 0), a = b.pt(0, -10), e = b.pt(0, 10); b.arc(c, a, e); b.line(e, a);
      feat(d, { type: 'revolve', sketch: skf(d, 'front', b), angle: 360 }); return d; }, 4000 * PI / 3],
    ['cono R10 alto 20 (rivoluzione di un triangolo)', () => { const d = D0('cono'); const b = SB(); b.center(0, -100, 0, 100); const o = b.pt(0, 0), r = b.pt(10, 0), t = b.pt(0, 20); b.line(o, r); b.line(r, t); b.line(t, o);
      feat(d, { type: 'revolve', sketch: skf(d, 'front', b), angle: 360 }); return d; }, PI * 100 * 20 / 3],
  ];
  const fineVolume = text => { const res = occt.ReadStepFile(enc(text), { linearUnit: 'millimeter', linearDeflectionType: 'bounding_box_ratio', linearDeflection: 0.0001, angularDeflection: 0.02 });
    let V = 0, nf = 0; for (const m of res.meshes) { const p = m.attributes.position.array, ix = m.index.array; nf += (m.brep_faces || []).length;
      for (let k = 0; k < ix.length; k += 3) { const a = ix[k] * 3, b = ix[k + 1] * 3, c = ix[k + 2] * 3; V += (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) + p[a + 1] * (p[b + 2] * p[c] - p[b] * p[c + 2]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6; } }
    return { ok: res.success, V, nf, n: res.meshes.length }; };
  for (const [name, build, Vexact] of exportCases) {
    n++;
    let ok = true; const msg = [];
    try {
      const d = build(), st = Model.regen(d);
      if (st.errors.size || !st.body.length) throw new Error('pezzo non costruito: ' + [...st.errors.values()].join('; '));
      const ex = Export.toSTEP(st.body, Geom.topology(st.body, st.tags), { name: d.name, color: [0.66, 0.7, 0.74] });
      const f0 = facet(st.body);
      const r = IM.readCAD(occt, enc(ex.text), 'step');
      const m = IM.weld(r.pos); m.f = new Uint32Array([...m.src].map(t => r.face[t]));
      const d2 = Model.newDoc(); d2.features.push({ id: 'F1', name: 'Importato1', type: 'import', fmt: 'step', file: 'x.step', unit: 'mm', mesh: IM.pack(m) });
      const st2 = Model.regen(d2), mp2 = Model.massProperties(st2, d2), info = st2.info.get('F1');
      const eq = (lab, g, e) => { if (g !== e) { ok = false; msg.push(`${lab}: ${g} invece di ${e}`); } };
      eq('Facce rilette', r.faces, ex.stats.faces); eq('Solidi riletti', r.bodies.length, ex.stats.solids); eq('Spigoli aperti nel file', ex.stats.badEdges + ex.stats.openLoops, 0);
      eq('Corpo chiuso dopo la rilettura', !!(st2.warn.get('F1')), false);
      const rv = Math.abs(mp2.volume - f0.V) / f0.V, ra = Math.abs(mp2.area - f0.A) / f0.A, re = Math.abs(mp2.volume - Vexact) / Vexact;
      if (rv > 1e-7) { ok = false; msg.push(`volume riletto ${mp2.volume} invece di ${f0.V}`); }
      if (ra > 1e-7) { ok = false; msg.push(`area riletta ${mp2.area} invece di ${f0.A}`); }
      if (re > TOL) { ok = false; msg.push(`volume ${mp2.volume.toFixed(3)} lontano dal valore esatto ${Vexact.toFixed(3)}`); }
      msg.unshift(`${ex.stats.faces} facce, ${ex.stats.edges} spigoli, ${ex.stats.solids} solid${ex.stats.solids === 1 ? 'o' : 'i'}; volume riletto ${mp2.volume.toFixed(4)} (corpo a faccette ${f0.V.toFixed(4)}, scarto ${(rv * 100).toExponential(1)} %; dal valore esatto ${(re * 100).toFixed(3)} %); area scarto ${(ra * 100).toExponential(1)} %`);
    } catch (e) { ok = false; msg.push('ERRORE ' + e.message); }
    if (!ok) fail++;
    console.log((ok ? 'OK  ' : 'NO  ') + 'Esporta STEP a facce piane e rileggi con OpenCascade: ' + name + '\n      ' + msg.join('\n      '));
    // con le superfici vere
    n++; ok = true; const m2 = [];
    try {
      const d = build(), st = Model.regen(d);
      const topo = Geom.topology(st.body, st.tags);
      const ex = Export.toSTEP(st.body, topo, { name: d.name, color: [0.66, 0.7, 0.74], tags: st.tags });
      const fa = Export.toSTEP(st.body, topo, { name: d.name });
      const r = fineVolume(ex.text), rf = fineVolume(fa.text);
      const eq = (lab, g, e) => { if (g !== e) { ok = false; m2.push(`${lab}: ${g} invece di ${e}`); } };
      eq('Lettura', r.ok, true); eq('Facce rilette', r.nf, ex.stats.faces); eq('Solidi riletti', r.n, ex.stats.solids); eq('Spigoli aperti nel file', ex.stats.badEdges + ex.stats.openLoops, 0);
      const e = Math.abs(r.V - Vexact) / Vexact, ef = Math.abs(rf.V - Vexact) / Vexact, curved = ex.stats.exact > 0;
      if (e > 2e-4) { ok = false; m2.push(`volume riletto ${r.V.toFixed(4)} lontano dal valore esatto ${Vexact.toFixed(4)}`); }
      if (curved && !(e * 5 < ef)) { ok = false; m2.push('il volume non è più vicino di quello a facce piane'); }
      m2.unshift(`${ex.stats.faces} facce (${Object.entries(ex.stats.surfaces).map(([k, v]) => v + ' ' + ({ plane: 'piane', cyl: 'cilindriche', cone: 'coniche', sph: 'sferiche', tor: 'toroidali' }[k] || k)).join(', ')}), ${ex.stats.edges} spigoli; volume riletto ${r.V.toFixed(4)}, esatto ${Vexact.toFixed(4)}: scarto ${(e * 100).toFixed(5)} % (a facce piane ${(ef * 100).toFixed(4)} %)`);
    } catch (e) { ok = false; m2.push('ERRORE ' + e.message); }
    if (!ok) fail++;
    console.log((ok ? 'OK  ' : 'NO  ') + 'Esporta STEP con le superfici vere e rileggi con OpenCascade: ' + name + '\n      ' + m2.join('\n      '));
  }
  // assiemi con pezzi importati: i cilindri di uno STEP sono solo triangoli, l'asse si ricava; un assieme si esporta con un solido per componente
  {
    const Assembly = require(path.join(dir, 'assembly.js'));
    const eqn = (m, lab, g, e, tol = 1e-6) => { if (!(Math.abs(g - e) <= tol)) m.push(`${lab}: ${g} invece di ${e}`); };
    const entOf = st => { const names = new Set(), out = []; for (const p of st.body) { const tg = st.tags.get(p.t); if (names.has(tg.bf)) continue; names.add(tg.bf); out.push(tg.name); } return out; };
    const asmDoc = (text) => { const d = importDoc(occt, text, 'step'); const doc = Model.newDoc(); doc.features.push({ id: 'F1', name: 'Importato1', type: 'import', fmt: 'step', file: 'x.step', unit: 'mm', mesh: (() => { const r = IM.readCAD(occt, enc(text), 'step'); const m = IM.weld(r.pos); m.f = new Uint32Array([...m.src].map(t => r.face[t])); return IM.pack(m); })() }); return { d, doc }; };
    n++;
    {
      const m = [];
      try {
        const info = Assembly.partInfo(asmDoc(stepCylinder(15, 40)).doc);
        const es = entOf(info.st).map(name => Assembly.entityOf({ inst: 'I', k: 'face', name }, info));
        const ax = es.filter(e => e.t === 'axis'), pl = es.filter(e => e.t === 'plane');
        eqn(m, 'facce', es.length, 3); eqn(m, 'cilindri', ax.length, 1); eqn(m, 'piani', pl.length, 2);
        eqn(m, 'raggio', ax[0].R, 15); eqn(m, 'asse |z|', Math.abs(ax[0].d[2]), 1, 1e-9); eqn(m, 'asse x', ax[0].o[0], 0); eqn(m, 'asse y', ax[0].o[1], 0);
        const st = info.st, g0 = [...Model.edgeGroups(st, st.topo).values()][0];
        const ed = Assembly.entityOf({ inst: 'I', k: 'edge', a: st.tags.get(g0.t1).name, b: st.tags.get(g0.t2).name, p: st.topo.verts[g0.segs[0].a] }, info);
        eqn(m, 'bordo tondo', ed.circle ? 1 : 0, 1); eqn(m, 'raggio del bordo', ed.R, 15); eqn(m, 'centro del bordo x', ed.o[0], 0); eqn(m, 'centro del bordo y', ed.o[1], 0);
      } catch (e) { m.push('ERRORE ' + e.message); }
      if (m.length) fail++;
      console.log((m.length ? 'NO  ' : 'OK  ') + 'Assieme: faccia cilindrica e bordo di uno STEP: asse e raggio 15 ricavati dai triangoli\n      ' + (m.join('; ') || 'scarti sotto 10⁻⁶ mm'));
    }
    n++;
    {
      const m = [];
      try {
        const docs = { a: asmDoc(stepPlateHole(60, 40, 10, 15)).doc, b: asmDoc(stepCylinder(15, 40)).doc };
        const infos = new Map(Object.entries(docs).map(([k, d]) => [k, Assembly.partInfo(d)]));
        const asm = Assembly.newAssembly(), A = Assembly.addInst(asm, 'a'), B = Assembly.addInst(asm, 'b', { pose: { p: [200, 100, 50], q: [1, 0, 0, 0] } });
        const face = (k, pred) => { const st = infos.get(k).st; for (const name of entOf(st)) { const e = Assembly.entityOf({ inst: 'I', k: 'face', name }, infos.get(k)); if (pred(e)) return { k: 'face', name }; } throw new Error('faccia non trovata'); };
        asm.mates.push({ id: 'M1', type: 'concentric', a: { inst: A.id, ...face('a', e => e.t === 'axis') }, b: { inst: B.id, ...face('b', e => e.t === 'axis') }, s: 1, side: 1, value: 0 });
        asm.mates.push({ id: 'M2', type: 'coincident', a: { inst: A.id, ...face('a', e => e.t === 'plane' && e.n[2] > 0.9) }, b: { inst: B.id, ...face('b', e => e.t === 'plane' && e.n[2] < -0.9) }, s: -1, side: 1, value: 0 });
        const r = Assembly.solve(asm, infos);
        eqn(m, 'tutto giusto', r.ok ? 1 : 0, 1); eqn(m, 'gradi di libertà', r.dof.total, 1);
        // centro del foro in (30, 20); la base del cilindro sulla faccia superiore z = 10
        eqn(m, 'x', B.pose.p[0], 30); eqn(m, 'y', B.pose.p[1], 20); eqn(m, 'z', B.pose.p[2], 10);
        // assieme esportato e riletto: due solidi, volumi sommati, ingombro delle posizioni nuove
        const s = Assembly.scene(asm, infos);
        const ex = Export.toSTEP(s.body, Geom.topology(s.body, s.tags), { name: 'assieme', color: [0.66, 0.7, 0.74], tags: s.tags, bodies: Model.stepBodies(s) });
        const rr = IM.readCAD(occt, enc(ex.text), 'step');
        const w = IM.weld(rr.pos); w.f = new Uint32Array([...w.src].map(t => rr.face[t]));
        const d2 = Model.newDoc(); d2.features.push({ id: 'F1', name: 'Importato1', type: 'import', fmt: 'step', file: 'x.step', unit: 'mm', mesh: IM.pack(w) });
        const st2 = Model.regen(d2), mp = Model.massProperties(st2, d2);
        const Vexp = 60 * 40 * 10 - Math.PI * 225 * 10 + Math.PI * 225 * 40;
        eqn(m, 'solidi nel file', ex.stats.solids, 2); eqn(m, 'solidi riletti', rr.bodies.length, 2); eqn(m, 'spigoli aperti', ex.stats.badEdges + ex.stats.openLoops, 0);
        if (Math.abs(mp.volume - Vexp) / Vexp > 2e-4) m.push(`volume riletto ${mp.volume} invece di ${Vexp}`);
        eqn(m, 'altezza dell\'ingombro', mp.bbox.mx[2], 50, 1e-4);
      } catch (e) { m.push('ERRORE ' + e.message); }
      if (m.length) fail++;
      console.log((m.length ? 'NO  ' : 'OK  ') + 'Assieme: perno e piastra da STEP accoppiati (centro 30, 20, base a z = 10), poi esportati e riletti con OpenCascade: 2 solidi\n      ' + (m.join('; ') || 'posizioni e volume giusti'));
    }
    // coni e sfere: tronco r 5 → 15 alto 20 = semiangolo con tangente 10/20, apice 10 mm sotto la base piccola
    const U3 = 1 / Math.sqrt(3), AX = [U3, U3, U3], XP = [1 / Math.sqrt(2), -1 / Math.sqrt(2), 0], O3 = [3, -7, 11];
    const ents = doc => { const info = Assembly.partInfo(doc); return { info, es: entOf(info.st).map(name => ({ name, E: Assembly.entityOf({ inst: 'I', k: 'face', name }, info) })) }; };
    const vec = (m, lab, g, e, tol = 1e-5) => [0, 1, 2].forEach(k => eqn(m, lab + ' ' + 'xyz'[k], g[k], e[k], tol));
    const test = (title, fn) => { n++; const m = []; let note = ''; try { note = fn(m) || ''; } catch (e) { m.push('ERRORE ' + e.message); } if (m.length) fail++; console.log((m.length ? 'NO  ' : 'OK  ') + title + '\n      ' + (m.join('; ') || note || 'scarti sotto la tolleranza')); };
    test('Assieme: cono di uno STEP, asse Z: faccia conica (non cilindro, non sfera), asse, tangente 0,5 e apice calcolati a mano; le due basi restano piane', m => {
      const { es } = ents(asmDoc(stepCone(5, 15, 20)).doc);
      const c = es.filter(e => e.E.cone), pl = es.filter(e => e.E.t === 'plane');
      eqn(m, 'facce', es.length, 3); eqn(m, 'coni', c.length, 1); eqn(m, 'piani', pl.length, 2);
      const E = c[0].E; eqn(m, 'tipo asse', E.t === 'axis' && E.round ? 1 : 0, 1); eqn(m, 'non è un cerchio', E.circle ? 1 : 0, 0);
      eqn(m, 'tangente', E.tan, 0.5, 1e-6); vec(m, 'apice', E.apex, [0, 0, -10]); vec(m, 'asse', E.d, [0, 0, 1], 1e-6); eqn(m, 'asse x', E.o[0], 0); eqn(m, 'asse y', E.o[1], 0);
    });
    test('Assieme: cono di uno STEP di traverso (asse (1,1,1), base in (3,-7,11)): asse e apice giusti, e le due basi di traverso sono facce piane, non cilindri enormi', m => {
      const { es } = ents(asmDoc(stepCone(5, 15, 20, { o: O3, z: AX, x: XP })).doc);
      const c = es.filter(e => e.E.cone), pl = es.filter(e => e.E.t === 'plane');
      eqn(m, 'coni', c.length, 1); eqn(m, 'piani', pl.length, 2);
      const E = c[0].E, dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      vec(m, 'asse', E.d, AX, 1e-6); eqn(m, 'tangente', E.tan, 0.5, 1e-6); vec(m, 'apice', E.apex, O3.map((v, k) => v - 10 * AX[k]));
      const up = pl.find(e => dot3(e.E.n, AX) > 0), dn = pl.find(e => dot3(e.E.n, AX) < 0);
      vec(m, 'normale in alto', up.E.n, AX, 1e-6); vec(m, 'normale in basso', dn.E.n, AX.map(v => -v), 1e-6);
      eqn(m, 'piano in alto: distanza da O', dot3(AX, up.E.c.map((v, k) => v - O3[k])), 20); eqn(m, 'piano in basso: distanza da O', dot3(AX, dn.E.c.map((v, k) => v - O3[k])), 0);
    });
    test('Assieme: cono con poco sformo (0,5°, alto 5, R 10): è un cono con la tangente giusta, non un cilindro', m => {
      const t = Math.tan(0.5 * PI / 180), { es } = ents(asmDoc(stepCone(10, 10 + 5 * t, 5)).doc), c = es.filter(e => e.E.t === 'axis');
      eqn(m, 'elementi con asse', c.length, 1); eqn(m, 'è un cono', c[0].E.cone ? 1 : 0, 1); eqn(m, 'tangente', c[0].E.tan, t, 1e-6); vec(m, 'asse', c[0].E.d, [0, 0, 1], 1e-6);
    });
    test('Assieme: cono piccolo e cono grande lontani dall\'origine: la precisione non dipende dalle misure', m => {
      const P = [100, 200, -50];
      const s = ents(asmDoc(stepCone(1, 1 + 2 * Math.tan(PI / 6), 2, { o: P, z: AX, x: XP })).doc).es.find(e => e.E.cone).E;
      const b = ents(asmDoc(stepCone(500, 900, 300, { o: P, z: AX, x: XP })).doc).es.find(e => e.E.cone).E;
      eqn(m, 'tangente del piccolo', s.tan, Math.tan(PI / 6), 1e-6); vec(m, 'apice del piccolo', s.apex, P.map((v, k) => v - Math.sqrt(3) * AX[k]));
      eqn(m, 'tangente del grande', b.tan, 4 / 3, 1e-6); vec(m, 'apice del grande', b.apex, P.map((v, k) => v - 375 * AX[k]), 1e-4);
    });
    test('Assieme: sfera di uno STEP: due metà, tutte e due sfera con centro (1, 2, 3) e R 10; niente assi', m => {
      const { es } = ents(asmDoc(stepSphere(10, { c: [1, 2, 3] })).doc);
      eqn(m, 'facce', es.length, 2);
      for (const e of es) { eqn(m, 'sfera', e.E.sphere ? 1 : 0, 1); vec(m, 'centro', e.E.p, [1, 2, 3]); eqn(m, 'raggio', e.E.R, 10, 1e-5); }
    });
    test('Assieme: semisfera di traverso: cupola = sfera, base = piano di normale -(1,1,1), tutti e due nel posto giusto', m => {
      const C = [1, 2, 3], { es } = ents(asmDoc(stepDome(10, { c: C, z: AX, x: XP })).doc);
      const sp = es.find(e => e.E.sphere), pl = es.find(e => e.E.t === 'plane');
      eqn(m, 'una sfera', sp ? 1 : 0, 1); eqn(m, 'un piano', pl ? 1 : 0, 1);
      vec(m, 'centro', sp.E.p, C); eqn(m, 'raggio', sp.E.R, 10, 1e-5); vec(m, 'normale', pl.E.n, AX.map(v => -v), 1e-6); eqn(m, 'piano per il centro', pl.E.n[0] * (pl.E.c[0] - 1) + pl.E.n[1] * (pl.E.c[1] - 2) + pl.E.n[2] * (pl.E.c[2] - 3), 0);
    });
    // pezzi fatti nel programma, esportati con le superfici vere e riletti
    const reread = d => { const st = Model.regen(d); if (st.errors.size || !st.body.length) throw new Error('pezzo non costruito'); const ex = Export.toSTEP(st.body, Geom.topology(st.body, st.tags), { name: 'p', color: [0.66, 0.7, 0.74], tags: st.tags }); return asmDoc(ex.text).doc; };
    const revTri = angle => { const d = D0('cono'); const b = SB(); b.center(0, -100, 0, 100); const o = b.pt(0, 0), r = b.pt(10, 0), t = b.pt(0, 20); b.line(o, r); b.line(r, t); b.line(t, o); feat(d, { type: 'revolve', sketch: skf(d, 'front', b), angle }); return d; };
    const revArc = angle => { const d = D0('sfera'); const b = SB(); b.center(0, -100, 0, 100); const c = b.pt(0, 0), a = b.pt(0, -10), e = b.pt(0, 10); b.arc(c, a, e); b.line(e, a); feat(d, { type: 'revolve', sketch: skf(d, 'front', b), angle }); return d; };
    test('Assieme: cono con la punta riletto (R 10, alto 20): apice (0, 20, 0), tangente 0,5', m => {
      const E = ents(reread(revTri(360))).es.find(e => e.E.cone).E; eqn(m, 'tangente', E.tan, 0.5, 1e-6); vec(m, 'apice', E.apex, [0, 20, 0]); vec(m, 'asse', E.d, [0, -1, 0], 1e-6);
    });
    test('Assieme: un quarto di cono riletto (solo 90° di superficie): stesso asse, stesso apice; un quarto di sfera: stesso centro', m => {
      const c = ents(reread(revTri(90))).es.filter(e => e.E.cone); eqn(m, 'coni', c.length, 1);
      if (c[0]) { eqn(m, 'tangente', c[0].E.tan, 0.5, 1e-5); vec(m, 'apice', c[0].E.apex, [0, 20, 0], 1e-4); }
      const s = ents(reread(revArc(90))).es.filter(e => e.E.sphere); eqn(m, 'sfere', s.length, 1);
      if (s[0]) { vec(m, 'centro', s[0].E.p, [0, 0, 0]); eqn(m, 'raggio', s[0].E.R, 10, 1e-5); }
    });
    test('Assieme: un toro riletto non è né cilindro, né cono, né sfera: messaggio chiaro', m => {
      const d = D0('toro'); const b = SB(); b.center(0, -100, 0, 100); b.circle(20, 0, 5); feat(d, { type: 'revolve', sketch: skf(d, 'front', b), angle: 360 });
      const { es } = ents(reread(d));
      eqn(m, 'facce rifiutate', es.filter(e => e.E.err).length, es.length); if (!es.length) m.push('nessuna faccia');
      if (!es.every(e => /non è un cilindro, un cono o una sfera/.test(e.E.err || ''))) m.push('messaggio sbagliato');
    });
    test('Assieme: cono nel foro: cono di traverso nel foro della piastra (concentrico) con la base piccola sulla faccia in alto: punto (3,-7,11) del cono in (30, 20, 10)', m => {
      const docs = { a: asmDoc(stepPlateHole(60, 40, 10, 15)).doc, b: asmDoc(stepCone(5, 15, 20, { o: O3, z: AX, x: XP })).doc };
      const infos = new Map(Object.entries(docs).map(([k, d]) => [k, Assembly.partInfo(d)]));
      const asm = Assembly.newAssembly(), A = Assembly.addInst(asm, 'a'), B = Assembly.addInst(asm, 'b', { pose: { p: [200, 100, 50], q: [1, 0, 0, 0] } });
      const face = (k, pred) => { const st = infos.get(k).st; for (const name of entOf(st)) { const e = Assembly.entityOf({ inst: 'I', k: 'face', name }, infos.get(k)); if (pred(e)) return { k: 'face', name }; } throw new Error('faccia non trovata'); };
      asm.mates.push({ id: 'M1', type: 'concentric', a: { inst: A.id, ...face('a', e => e.t === 'axis') }, b: { inst: B.id, ...face('b', e => e.cone) }, s: 1, side: 1, value: 0 });
      asm.mates.push({ id: 'M2', type: 'coincident', a: { inst: A.id, ...face('a', e => e.t === 'plane' && e.n[2] > 0.9) }, b: { inst: B.id, ...face('b', e => e.t === 'plane' && e.n[0] + e.n[1] + e.n[2] < 0) }, s: -1, side: 1, value: 0 });
      const r = Assembly.solve(asm, infos);
      eqn(m, 'tutto giusto', r.ok ? 1 : 0, 1); eqn(m, 'gradi di libertà', r.dof.total, 1);
      vec(m, 'centro della base', Assembly.toWorld(B.pose, O3), [30, 20, 10]);
      vec(m, 'asse del cono nel mondo', Assembly.dirWorld(B.pose, AX), [0, 0, 1], 1e-5);
    });
    test('Assieme: sfera con sfera (centri uguali, 3 gradi di libertà) e centro della sfera sull\'asse del cilindro (4 gradi di libertà), con facce di STEP', m => {
      const docs = { a: asmDoc(stepSphere(10, { c: [1, 2, 3] })).doc, b: asmDoc(stepSphere(7, { c: [-4, 5, 6] })).doc, c: asmDoc(stepCylinder(15, 40)).doc };
      const infos = new Map(Object.entries(docs).map(([k, d]) => [k, Assembly.partInfo(d)]));
      const asm = Assembly.newAssembly(), A = Assembly.addInst(asm, 'a'), B = Assembly.addInst(asm, 'b', { pose: { p: [200, 100, 50], q: [1, 0, 0, 0] } });
      const name = k => entOf(infos.get(k).st)[0];
      asm.mates.push({ id: 'M1', type: 'concentric', a: { inst: A.id, k: 'face', name: name('a') }, b: { inst: B.id, k: 'face', name: name('b') }, s: 1, side: 1, value: 0 });
      const r = Assembly.solve(asm, infos);
      eqn(m, 'tutto giusto', r.ok ? 1 : 0, 1); eqn(m, 'gradi di libertà', r.dof.total, 3); vec(m, 'centro di B', Assembly.toWorld(B.pose, [-4, 5, 6]), [1, 2, 3]);
      const as2 = Assembly.newAssembly(), C = Assembly.addInst(as2, 'c'), S = Assembly.addInst(as2, 'a', { pose: { p: [200, 100, 50], q: [1, 0, 0, 0] } });
      const axisF = entOf(infos.get('c').st).find(n => Assembly.entityOf({ inst: 'I', k: 'face', name: n }, infos.get('c')).t === 'axis');
      as2.mates.push({ id: 'M1', type: 'concentric', a: { inst: C.id, k: 'face', name: axisF }, b: { inst: S.id, k: 'face', name: name('a') }, s: 1, side: 1, value: 0 });
      const r2 = Assembly.solve(as2, infos), W = Assembly.toWorld(S.pose, [1, 2, 3]);
      eqn(m, 'tutto giusto 2', r2.ok ? 1 : 0, 1); eqn(m, 'gradi di libertà 2', r2.dof.total, 4); eqn(m, 'x', W[0], 0); eqn(m, 'y', W[1], 0);
    });
    test('Assieme: vertice di uno STEP: resta legato alla posizione (il corpo importato non cambia), niente facce salvate; se il corpo cambia, «!»', m => {
      const docs = { a: asmDoc(stepBox(80, 50, 10)).doc, b: asmDoc(stepBox(10, 10, 10)).doc };
      const infos = new Map(Object.entries(docs).map(([k, d]) => [k, Assembly.partInfo(d)]));
      const asm = Assembly.newAssembly(), A = Assembly.addInst(asm, 'a'), B = Assembly.addInst(asm, 'b', { pose: { p: [200, 100, 50], q: [1, 0, 0, 0] } });
      asm.mates.push({ id: 'M1', type: 'coincident', a: { inst: A.id, k: 'vertex', p: [80, 50, 10] }, b: { inst: B.id, k: 'vertex', p: [0, 0, 0] }, s: 1, side: 1, value: 0 });
      const r = Assembly.solve(asm, infos);
      eqn(m, 'tutto giusto', r.ok ? 1 : 0, 1); vec(m, 'origine di B', B.pose.p, [80, 50, 10]); eqn(m, 'facce salvate', asm.mates[0].a.faces ? 1 : 0, 0);
      const infos2 = new Map(infos); infos2.set('a', Assembly.partInfo(asmDoc(stepBox(90, 50, 10)).doc));
      const r2 = Assembly.solve(asm, infos2);
      eqn(m, 'segnato', r2.status.get('M1').ok ? 1 : 0, 0); if (!/vertice scelto non esiste più/.test(r2.status.get('M1').err || '')) m.push('messaggio sbagliato');
    });
  }
  console.log(`\n${n - fail}/${n} superati (tolleranza ${(TOL * 100).toFixed(1)}%)`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
