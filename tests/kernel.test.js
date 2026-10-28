// Test del nucleo geometrico del Banco CAD: ogni caso ha valori di riferimento calcolati a mano.
// Node: node kernel.test.js [cartella dei moduli]   (tolleranza relativa TOL, default 1%)
// Browser: SelfTest.run() restituisce le righe dei risultati.
(function (root) {
const isNode = typeof module !== 'undefined' && typeof window === 'undefined';
const path = isNode ? require('path') : null;
const dir = isNode ? path.resolve(process.argv[2] || path.join(__dirname, 'core')) : null;
const Model = isNode ? require(path.join(dir, 'model.js')) : root.Model;
const Sketch = isNode ? require(path.join(dir, 'sketch.js')) : root.Sketch;
const Geom = isNode ? require(path.join(dir, 'geom.js')) : root.Geom;
const Export = isNode ? require(path.join(dir, 'export.js')) : root.Export;
const TOL = isNode ? +(process.env.TOL || 0.01) : 0.01;
const PI = Math.PI;

/* ---------- costruttori (come nelle esercitazioni) ---------- */
function SB() {
  const s = Sketch.newSketch();
  const pt = (x, y, extra = {}) => { const id = 'p' + (s.next++); s.ents.push({ id, t: 'pt', x, y, ...extra }); return id; };
  const api = {
    s, pt,
    line(a, b, extra = {}) { const id = 'l' + (s.next++); s.ents.push({ id, t: 'ln', a, b, ...extra }); return id; },
    poly(points) { const ids = points.map(([x, y]) => pt(x, y)); for (let i = 0; i < ids.length; i++) api.line(ids[i], ids[(i + 1) % ids.length]); return ids; },
    rect(x0, y0, x1, y1) { return api.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]); },
    circle(cx, cy, r) { const c = pt(cx, cy); const id = 'c' + (s.next++); s.ents.push({ id, t: 'ci', c, r }); return id; },
    arc(c, a, b) { const id = 'a' + (s.next++); s.ents.push({ id, t: 'ar', c, a, b }); return id; },
    center(x0, y0, x1, y1) { return api.line(pt(x0, y0), pt(x1, y1), { cons: true, center: true }); },
  };
  return api;
}
function D0(name) { const d = Model.newDoc(); d.name = name; return d; }
function feat(doc, f) { f.id = f.id || Model.uid(doc, 'F'); f.name = f.name || Model.defaultName(doc, f.type); doc.features.push(f); return f.id; }
function sketch(doc, plane, b) { return feat(doc, { type: 'sketch', plane, sk: b.s }); }
const STD = id => ({ kind: 'std', id });
function face(doc, pred) {
  const st = Model.regen(doc);
  for (const id of new Set(st.body.map(p => p.t))) { const t = st.tags.get(id); if (t.kind === 'plane' && pred(t)) return { kind: 'face', name: t.name, n: t.n, w: t.w }; }
  throw new Error('faccia non trovata');
}
const nearW = (n, w) => t => Math.abs(t.n[0] - n[0]) < 1e-9 && Math.abs(t.n[1] - n[1]) < 1e-9 && Math.abs(t.n[2] - n[2]) < 1e-9 && Math.abs(t.w - w) < 1e-6;
function distPS(p, a, b) { const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2; let t = L2 ? ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / L2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - ab[0] * t, p[1] - a[1] - ab[1] * t, p[2] - a[2] - ab[2] * t); }
function edge(doc, p, kind) {
  const st = Model.regen(doc);
  let best = null, bd = Infinity;
  for (const g of Model.edgeGroups(st, st.topo).values()) {
    const geo = Model.edgeGeometry(g, st, st.topo); if (!geo) continue;
    if (kind && geo.kind !== kind) continue;
    for (const e of g.segs) { const d = distPS(p, st.topo.verts[e.a], st.topo.verts[e.b]); if (d < bd) { bd = d; best = { a: st.tags.get(g.t1).name, b: st.tags.get(g.t2).name, p }; } }
  }
  if (!best) throw new Error('spigolo non trovato');
  return best;
}
// blocco 80×50×10 sul piano superiore: x 0..80, z -50..0, y 0..10
function box(L = 80, W = 50, H = 10) {
  const doc = D0('blocco'); const b = SB(); b.rect(0, 0, L, W);
  const s = sketch(doc, STD('top'), b); feat(doc, { type: 'extrude', sketch: s, end: 'blind', depth: H }); return doc;
}

/* ---------- casi ---------- */
const CASES = [];
const T = (name, build, exp) => CASES.push({ name, build, exp });

T('Parallelepipedo 80×50×10 (piano superiore)', () => box(), { V: 40000, A: 10600, C: [40, 5, -25], bb: [[0, 0, -50], [80, 10, 0]] });
T('Estrusione piano medio 40×20, 30', () => {
  const d = D0('m'); const b = SB(); b.rect(-20, -10, 20, 10); const s = sketch(d, STD('front'), b);
  feat(d, { type: 'extrude', sketch: s, end: 'mid', depth: 30 }); return d;
}, { V: 24000, A: 2 * 800 + 2 * (40 + 20) * 30, C: [0, 0, 0], bb: [[-20, -10, -15], [20, 10, 15]] });
T('Estrusione in due direzioni 10 + 5', () => {
  const d = D0('m'); const b = SB(); b.rect(0, 0, 10, 10); const s = sketch(d, STD('front'), b);
  feat(d, { type: 'extrude', sketch: s, end: 'blind', depth: 10, dir2: true, depth2: 5 }); return d;
}, { V: 1500, A: 200 + 40 * 15, C: [5, 5, 2.5] });
T('Cilindro R10 × 30', () => {
  const d = D0('c'); const b = SB(); b.circle(0, 0, 10); const s = sketch(d, STD('front'), b);
  feat(d, { type: 'extrude', sketch: s, end: 'blind', depth: 30 }); return d;
}, { V: 3000 * PI, A: 800 * PI, C: [0, 0, 15] });
T('Asola (rettangolo 40 + due semicerchi R5) × 10', () => {
  const d = D0('a'); const b = SB();
  const p1 = b.pt(0, -5), p2 = b.pt(40, -5), p3 = b.pt(40, 5), p4 = b.pt(0, 5);
  const c1 = b.pt(40, 0), c2 = b.pt(0, 0.0000001);
  b.line(p1, p2); b.arc(c1, p2, p3); b.line(p3, p4); b.arc(c2, p4, p1);
  const s = sketch(d, STD('front'), b); feat(d, { type: 'extrude', sketch: s, end: 'blind', depth: 10 }); return d;
}, { V: (400 + 25 * PI) * 10, A: 2 * (400 + 25 * PI) + (80 + 10 * PI) * 10, C: [20, 0, 5] });
T('Piastra forata (esercitazione 1)', () => {
  const d = box(); const top = face(d, nearW([0, 1, 0], 10));
  const c = SB(); for (const [x, y] of [[10, 10], [70, 10], [70, 40], [10, 40]]) c.circle(x, y, 4); c.circle(40, 25, 10);
  const s = sketch(d, top, c); feat(d, { type: 'cut', sketch: s, end: 'through' }); return d;
}, { V: 40000 - 1640 * PI, A: 2 * (4000 - 164 * PI) + 2600 + 520 * PI, C: [40, 5, -25] });
T('Tasca cieca 20×20 prof. 4 nella faccia superiore', () => {
  const d = box(); const top = face(d, nearW([0, 1, 0], 10));
  const c = SB(); c.rect(30, 15, 50, 35); const s = sketch(d, top, c); feat(d, { type: 'cut', sketch: s, end: 'blind', depth: 4 }); return d;
}, { V: 40000 - 1600, A: 10600 + 4 * 20 * 4 });
T('Borchia cilindrica R10 h20 sulla faccia superiore', () => {
  const d = box(); const top = face(d, nearW([0, 1, 0], 10));
  const c = SB(); c.circle(40, 25, 10); const s = sketch(d, top, c); feat(d, { type: 'extrude', sketch: s, end: 'blind', depth: 20 }); return d;
}, { V: 40000 + 2000 * PI, A: 10600 + 400 * PI, bb: [[0, 0, -50], [80, 30, 0]] });
T('Piano di riferimento a 25 e schizzo sopra', () => {
  const d = D0('p'); const b = SB(); b.rect(0, 0, 10, 10); const s0 = sketch(d, STD('front'), b);
  feat(d, { type: 'extrude', sketch: s0, end: 'blind', depth: 5 });
  const pl = feat(d, { type: 'plane', base: STD('front'), offset: 25 });
  const c = SB(); c.rect(0, 0, 10, 10); const s1 = sketch(d, { kind: 'plane', id: pl }, c);
  feat(d, { type: 'extrude', sketch: s1, end: 'blind', depth: 5 }); return d;
}, { V: 1000, A: 2 * (200 + 200), bb: [[0, 0, 0], [10, 10, 30]] });

// rivoluzioni (piano frontale, asse = mezzeria verticale x=0 → asse Y)
const revDoc = (draw, extra = {}) => { const d = D0('r'); const b = SB(); b.center(0, -100, 0, 100); draw(b); const s = sketch(d, STD('front'), b); feat(d, { type: 'revolve', sketch: s, angle: 360, ...extra }); return d; };
T('Rivoluzione: tubo Ri10 Re20 h30', () => revDoc(b => b.rect(10, 0, 20, 30)), { V: 9000 * PI, A: 2400 * PI, C: [0, 15, 0] });
T('Rivoluzione 90°: quarto di tubo', () => revDoc(b => b.rect(10, 0, 20, 30), { angle: 90 }), { V: 2250 * PI, A: 600 * PI + 600 });
T('Rivoluzione: cono R10 h20', () => revDoc(b => b.poly([[0, 0], [10, 0], [0, 20]])), { V: 2000 * PI / 3, A: 100 * PI + 10 * PI * Math.sqrt(500), C: [0, 5, 0] });
T('Rivoluzione: sfera R10', () => revDoc(b => { const c = b.pt(0, 0), a = b.pt(0, -10), e = b.pt(0, 10); b.arc(c, a, e); b.line(e, a); }), { V: 4000 * PI / 3, A: 400 * PI, C: [0, 0, 0] });
T('Rivoluzione: toro R20 r5', () => revDoc(b => b.circle(20, 0, 5)), { V: 1000 * PI * PI, A: 400 * PI * PI, C: [0, 0, 0] });
T('Taglio rivoluzione: gola nel cilindro', () => {
  const d = D0('g'); const b = SB(); b.center(0, -100, 0, 100); b.rect(0, 0, 20, 40); const s = sketch(d, STD('front'), b);
  feat(d, { type: 'revolve', sketch: s, angle: 360 });
  const g = SB(); g.center(0, -100, 0, 100); g.rect(15, 15, 25, 25); const s2 = sketch(d, STD('front'), g);
  feat(d, { type: 'revcut', sketch: s2, angle: 360 }); return d;
}, { V: PI * 400 * 40 - PI * (400 - 225) * 10, A: 2 * 400 * PI + 2 * PI * 20 * 30 + 2 * PI * 15 * 10 + 2 * PI * (400 - 225), C: [0, 20, 0] });

// raccordi e smussi
const k = 1 - PI / 4;
T('Raccordo R5 su spigolo convesso (lungo 80)', () => {
  const d = box(); feat(d, { type: 'fillet', r: 5, edges: [edge(d, [40, 10, 0], 'line')] }); return d;
}, { V: 40000 - 25 * k * 80, A: 10600 - 2 * 5 * 80 + PI * 5 / 2 * 80 - 2 * 25 * k });
T('Smusso 3 su spigolo convesso (lungo 80)', () => {
  const d = box(); feat(d, { type: 'chamfer', d: 3, edges: [edge(d, [40, 10, 0], 'line')] }); return d;
}, { V: 40000 - 4.5 * 80, A: 10600 - 2 * 3 * 80 + 3 * Math.SQRT2 * 80 - 2 * 4.5 });
T('Smusso distanza-distanza 2×4', () => {
  const d = box(); feat(d, { type: 'chamfer', mode: 'dd', d: 2, d2: 4, edges: [edge(d, [40, 10, 0], 'line')] }); return d;
}, { V: 40000 - 4 * 80 });
T('Squadretta a L con raccordo concavo R6 (esercitazione 2)', () => {
  const d = D0('L'); const b = SB(); b.poly([[0, 0], [60, 0], [60, 8], [8, 8], [8, 40], [0, 40]]);
  const s = sketch(d, STD('front'), b); feat(d, { type: 'extrude', sketch: s, end: 'mid', depth: 30 });
  feat(d, { type: 'fillet', r: 6, edges: [edge(d, [8, 8, 0], 'line')] }); return d;
}, { V: (480 + 256 + 36 * k) * 30 });
T('Raccordo R3 sul bordo circolare di una borchia R10', () => {
  const d = D0('b'); const b = SB(); b.circle(0, 0, 10); const s = sketch(d, STD('front'), b);
  feat(d, { type: 'extrude', sketch: s, end: 'blind', depth: 20 });
  feat(d, { type: 'fillet', r: 3, edges: [edge(d, [10, 0, 20], 'circle')] }); return d;
}, (() => { const r = 3, R = 10, a = r * r * k, c = r * (10 - 3 * PI) / (3 * (4 - PI)); return { V: 2000 * PI - a * 2 * PI * (R - c) }; })());

// raccordi e smussi su più spigoli insieme (come SolidWorks: tutti calcolati sul pezzo di partenza)
// blocco 80×50×10: spigoli superiori lungo x (z = 0 e z = -50) e lungo z (x = 0 e x = 80), y = 10
const topEdges = d => [edge(d, [40, 10, 0], 'line'), edge(d, [80, 10, -25], 'line'), edge(d, [40, 10, -50], 'line'), edge(d, [0, 10, -25], 'line')];
const allEdges = d => topEdges(d).concat([edge(d, [40, 0, 0], 'line'), edge(d, [80, 0, -25], 'line'), edge(d, [40, 0, -50], 'line'), edge(d, [0, 0, -25], 'line'),
  edge(d, [0, 5, 0], 'line'), edge(d, [80, 5, 0], 'line'), edge(d, [80, 5, -50], 'line'), edge(d, [0, 5, -50], 'line')]);
const miter = r => (5 / 3 - PI / 2) * r ** 3; // volume in comune tra i due utensili di raccordo che si incontrano ad angolo retto
T('Raccordo R4 su due spigoli che si incontrano in un vertice', () => {
  const d = box(); feat(d, { type: 'fillet', r: 4, edges: [edge(d, [40, 10, 0], 'line'), edge(d, [80, 10, -25], 'line')] }); return d;
}, { R: 16 * k * (80 + 50) - miter(4) });
T('Raccordo R4 sui 4 spigoli superiori (angoli a 45°)', () => {
  const d = box(); feat(d, { type: 'fillet', r: 4, edges: topEdges(d) }); return d;
}, { R: 16 * k * 2 * (80 + 50) - 4 * miter(4) });
T('Raccordo R3 su tutti i 12 spigoli (angoli sferici)', () => {
  const d = box(); feat(d, { type: 'fillet', r: 3, edges: allEdges(d) }); return d;
}, (() => { const r = 3, a = 80 - 2 * r, b = 50 - 2 * r, c = 10 - 2 * r;
  return { R: 40000 - (a * b * c) - ( 2 * r * (a * b + b * c + a * c) + PI * r * r * (a + b + c) + 4 / 3 * PI * r ** 3), A: 2 * (a * b + b * c + a * c) + 2 * PI * r * (a + b + c) + 4 * PI * r * r, bb: [[0, 0, -50], [80, 10, 0]] }; })());
T('Smusso 2 su due spigoli che si incontrano in un vertice', () => {
  const d = box(); feat(d, { type: 'chamfer', d: 2, edges: [edge(d, [40, 10, 0], 'line'), edge(d, [80, 10, -25], 'line')] }); return d;
}, { R: 2 * (80 + 50) - 8 / 3 }); // in comune tra i due cunei: ∫(d − y)² dy = d³/3
T('Smusso 2 sui 4 spigoli superiori', () => {
  const d = box(); feat(d, { type: 'chamfer', d: 2, edges: topEdges(d) }); return d;
}, { R: 2 * 2 * (80 + 50) - 4 * 8 / 3 });
T('Smusso 1 su tutti i 12 spigoli', () => {
  const d = box(); feat(d, { type: 'chamfer', d: 1, edges: allEdges(d) }); return d;
}, (() => { // inclusione-esclusione: cunei 0,5·d²·L, meno 3 coppie per vertice (d³/3), più la parte comune ai tre cunei (d³/4)
  const L = 4 * (80 + 50 + 10); return { R: 0.5 * L - 8 * 3 / 3 + 8 / 4 }; })());
// tutti gli spigoli di un blocco 40×30×20 (piano superiore): x 0..40, z -30..0, y 0..20
const allEdgesOf = d => { const st = Model.regen(d); const out = [];
  for (const g of Model.edgeGroups(st, st.topo).values()) { const e = g.segs[0], a = st.topo.verts[e.a], b = st.topo.verts[e.b]; out.push({ a: st.tags.get(g.t1).name, b: st.tags.get(g.t2).name, p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2] }); }
  return out; };
const rbox = r => { const a = 40 - 2 * r, b = 30 - 2 * r, c = 20 - 2 * r; return { V: a * b * c + 2 * r * (a * b + b * c + a * c) + PI * r * r * (a + b + c) + 4 / 3 * PI * r ** 3, A: 2 * (a * b + b * c + a * c) + 2 * PI * r * (a + b + c) + 4 * PI * r * r }; };
T('Raccordo R6 su tutti gli spigoli di un blocco 40×30×20', () => { const d = box(40, 30, 20); feat(d, { type: 'fillet', r: 6, edges: allEdgesOf(d) }); return d; }, { ...rbox(6), bb: [[0, 0, -30], [40, 20, 0]] });
T('Raccordo R9,5 su tutti gli spigoli (facce quasi sparite)', () => { const d = box(40, 30, 20); feat(d, { type: 'fillet', r: 9.5, edges: allEdgesOf(d) }); return d; }, rbox(9.5));
T('Smusso 4 su tutti gli spigoli di un blocco 40×30×20', () => { const d = box(40, 30, 20); feat(d, { type: 'chamfer', d: 4, edges: allEdgesOf(d) }); return d; },
  { V: 24000 - (0.5 * 16 * 4 * (40 + 30 + 20) - 8 * 64 + 8 * 16) });
T('Raccordo dello stesso spigolo selezionato due volte', () => {
  const d = box(); const e = edge(d, [40, 10, 0], 'line'); feat(d, { type: 'fillet', r: 5, edges: [e, e] }); return d;
}, { R: 25 * k * 80 });

// fori
T('Foro passante M6 (Ø6,6) nel blocco', () => {
  const d = box(); const top = face(d, nearW([0, 1, 0], 10));
  const h = SB(); h.pt(40, 25, { hole: true }); const s = sketch(d, top, h);
  feat(d, { type: 'hole', sketch: s, kind: 'clear', size: 'M6', fit: 'medium', end: 'through' }); return d;
}, { V: 40000 - PI * 3.3 * 3.3 * 10, A: 10600 - 2 * PI * 3.3 * 3.3 + 2 * PI * 3.3 * 10 });
T('Foro cieco Ø8 prof. 6 con punta a 118°', () => {
  const d = box(); const top = face(d, nearW([0, 1, 0], 10));
  const h = SB(); h.pt(40, 25, { hole: true }); const s = sketch(d, top, h);
  feat(d, { type: 'hole', sketch: s, kind: 'simple', dia: 8, end: 'blind', depth: 6 }); return d;
}, (() => { const r = 4, tip = r / Math.tan(59 * PI / 180); return { V: 40000 - PI * 16 * 6 - PI * 16 * tip / 3 }; })());
T('Foro lamato M6 passante (Ø6,6, lamatura Ø11 × 6,4)', () => {
  const d = box(); const top = face(d, nearW([0, 1, 0], 10));
  const h = SB(); h.pt(40, 25, { hole: true }); const s = sketch(d, top, h);
  feat(d, { type: 'hole', sketch: s, kind: 'cbore', size: 'M6', fit: 'medium', end: 'through' }); return d;
}, { V: 40000 - PI * 5.5 * 5.5 * 6.4 - PI * 3.3 * 3.3 * 3.6 });
T('Foro svasato M6 90° passante (Ø6,6, svasatura Ø12,85)', () => {
  const d = box(); const top = face(d, nearW([0, 1, 0], 10));
  const h = SB(); h.pt(40, 25, { hole: true }); const s = sketch(d, top, h);
  feat(d, { type: 'hole', sketch: s, kind: 'csink', size: 'M6', fit: 'medium', end: 'through' }); return d;
}, (() => { const R = 12.85 / 2, r = 3.3, h = R - r; return { V: 40000 - PI * h * (R * R + R * r + r * r) / 3 - PI * r * r * (10 - h) }; })());

// serie e specchio
T('Serie lineare 4 fori Ø8 passo 15', () => {
  const d = box(); const top = face(d, nearW([0, 1, 0], 10));
  const c = SB(); c.circle(10, 25, 4); const s = sketch(d, top, c); const cut = feat(d, { type: 'cut', sketch: s, end: 'through' });
  feat(d, { type: 'lpattern', feats: [cut], dir: { kind: 'axis', id: 'x' }, n: 4, spacing: 15 }); return d;
}, { V: 40000 - 4 * 160 * PI, C: [(40000 * 40 - 640 * PI * 32.5) / (40000 - 640 * PI), 5, -25] });
T('Serie lineare 3×2 in due direzioni', () => {
  const d = box(); const top = face(d, nearW([0, 1, 0], 10));
  const c = SB(); c.circle(10, 10, 3); const s = sketch(d, top, c); const cut = feat(d, { type: 'cut', sketch: s, end: 'through' });
  feat(d, { type: 'lpattern', feats: [cut], dir: { kind: 'axis', id: 'x' }, n: 3, spacing: 20, dir2: { kind: 'axis', id: 'z' }, n2: 2, spacing2: -20 }); return d;
}, { V: 40000 - 6 * 90 * PI });
T('Serie circolare 6 fori Ø6 su flangia', () => {
  const d = D0('f'); const b = SB(); b.circle(0, 0, 40); const s = sketch(d, STD('top'), b);
  feat(d, { type: 'extrude', sketch: s, end: 'blind', depth: 10 });
  const top = face(d, nearW([0, 1, 0], 10)); const c = SB(); c.circle(30, 0, 3); const s2 = sketch(d, top, c);
  const cut = feat(d, { type: 'cut', sketch: s2, end: 'through' });
  feat(d, { type: 'cpattern', feats: [cut], axis: { kind: 'axis', id: 'y' }, n: 6, angle: 360 }); return d;
}, { V: 16000 * PI - 6 * 90 * PI, A: 2 * (1600 - 54) * PI + 800 * PI + 6 * 60 * PI, C: [0, 5, 0] });
T('Specchio di una borchia rispetto al piano destro', () => {
  const d = D0('s'); const b = SB(); b.rect(-40, -10, 40, 10); const s = sketch(d, STD('front'), b);
  feat(d, { type: 'extrude', sketch: s, end: 'blind', depth: 10 });
  const fr = face(d, nearW([0, 0, 1], 10)); const c = SB(); c.circle(25, 0, 5); const s2 = sketch(d, fr, c);
  const boss = feat(d, { type: 'extrude', sketch: s2, end: 'blind', depth: 10 });
  feat(d, { type: 'mirror', feats: [boss], plane: STD('right') }); return d;
}, { V: 16000 + 2 * 250 * PI, C: [0, 0, (16000 * 5 + 500 * PI * 15) / (16000 + 500 * PI)] });

// sformo nell'estrusione
const tn = a => Math.tan(a * PI / 180);
const draftDoc = (draw, depth, ang, extra = {}) => { const d = D0('d'); const b = SB(); draw(b); const s = sketch(d, STD('front'), b); feat(d, { type: 'extrude', sketch: s, end: 'blind', depth, draftOn: true, draft: ang, ...extra }); return d; };
T('Sformo 5°: tronco di piramide da 20×20, h10', () => draftDoc(b => b.rect(-10, -10, 10, 10), 10, 5), (() => {
  const a = 20 - 20 * tn(5), A1 = 400, A2 = a * a; return { V: 10 / 3 * (A1 + A2 + Math.sqrt(A1 * A2)), A: A1 + A2 + 4 * (20 + a) / 2 * Math.hypot(10, (20 - a) / 2), bb: [[-10, -10, 0], [10, 10, 10]] };
})());
T('Sformo 5°: tronco di cono R10, h10', () => draftDoc(b => b.circle(0, 0, 10), 10, 5), (() => {
  const r1 = 10, r2 = 10 - 10 * tn(5); return { V: PI * 10 / 3 * (r1 * r1 + r1 * r2 + r2 * r2), A: PI * (r1 * r1 + r2 * r2) + PI * (r1 + r2) * Math.hypot(10, r1 - r2), C: [0, 0, 10 / 4 * (r1 * r1 + 2 * r1 * r2 + 3 * r2 * r2) / (r1 * r1 + r1 * r2 + r2 * r2)] };
})());
T('Sformo 8° verso l\'esterno, verso invertito', () => draftDoc(b => b.circle(0, 0, 10), 10, 8, { draftOut: true, flip: true }), (() => {
  const r1 = 10, r2 = 10 + 10 * tn(8); return { V: PI * 10 / 3 * (r1 * r1 + r1 * r2 + r2 * r2), bb: [[-r2, -r2, -10], [r2, r2, 0]] };
})());
T('Sformo 3° su quadrato con foro (il foro si allarga)', () => draftDoc(b => { b.rect(-20, -20, 20, 20); b.circle(0, 0, 8); }, 15, 3), (() => {
  const h = 15, t = tn(3), a = 40 - 2 * h * t, r2 = 8 + h * t; return { V: h / 3 * (1600 + a * a + 40 * a) - PI * h / 3 * (64 + 8 * r2 + r2 * r2) };
})());
T('Sformo 4° su asola (archi tangenti alle linee)', () => draftDoc(b => {
  const p1 = b.pt(0, -6), p2 = b.pt(40, -6), p3 = b.pt(40, 6), p4 = b.pt(0, 6), c1 = b.pt(40, 0), c2 = b.pt(0, 0.0000001);
  b.line(p1, p2); b.arc(c1, p2, p3); b.line(p3, p4); b.arc(c2, p4, p1);
}, 12, 4), (() => { const h = 12, t = tn(4); // r(z) = 6 - z t ; A(z) = 40·2r + π r²
  const I1 = 6 * h - t * h * h / 2, I2 = 36 * h - 6 * t * h * h + t * t * h ** 3 / 3; return { V: 80 * I1 + PI * I2 };
})());
T('Taglio cieco con sformo 10°: tasca 20×20 prof. 5', () => {
  const d = box(); const top = face(d, nearW([0, 1, 0], 10));
  const c = SB(); c.rect(30, 15, 50, 35); const s = sketch(d, top, c); feat(d, { type: 'cut', sketch: s, end: 'blind', depth: 5, draftOn: true, draft: 10 }); return d;
}, (() => { const a = 20 - 10 * tn(10); return { V: 40000 - 5 / 3 * (400 + a * a + 20 * a) }; })());

// estrusione con percorso
// profilo: cerchio R5 sul piano frontale; percorso sul piano superiore (2D (x, y) → 3D (x, 0, -y))
const sweepDoc = (drawPath, prof = b => b.circle(0, 0, 5), type = 'sweep', pre) => {
  const d = pre ? pre() : D0('sw');
  const b = SB(); prof(b); const sp = sketch(d, STD('front'), b);
  const p = SB(); drawPath(p); const sa = sketch(d, STD('top'), p);
  feat(d, { type, sketch: sp, path: sa }); return d;
};
T('Sweep: cerchio R5 lungo una retta di 50', () => sweepDoc(p => p.line(p.pt(0, 0), p.pt(0, -50))), { V: 25 * PI * 50, A: 10 * PI * 50 + 50 * PI, C: [0, 0, 25] });
T('Sweep: tubo con curva (50 + arco R30 a 90° + 40)', () => sweepDoc(p => {
  const a = p.pt(0, 0), b = p.pt(0, -50), c = p.pt(30, -50), e = p.pt(30, -80), g = p.pt(70, -80);
  p.line(a, b); p.arc(c, b, e); p.line(e, g);
}), { V: 25 * PI * (90 + 15 * PI), A: 10 * PI * (90 + 15 * PI) + 50 * PI, bb: [[-5, -5, 0], [70, 5, 85]] });
T('Sweep: anello (percorso circolare R20) = toro', () => sweepDoc(p => p.circle(0, 0, 20), b => b.circle(20, 0, 5)), { V: 1000 * PI * PI, A: 400 * PI * PI, C: [0, 0, 0] });
T('Sweep: profilo quadrato 6×6 lungo arco R25 di 180°', () => sweepDoc(p => { const a = p.pt(0, 0), c = p.pt(25, 0), e = p.pt(50, 0); p.arc(c, e, a); }, b => b.rect(-3, -3, 3, 3)), { V: 36 * PI * 25, A: 24 * PI * 25 + 72 });
T('Taglio con percorso: canale semicircolare R4 lungo 80', () => {
  const d = box();
  const b = SB(); b.circle(25, 10, 4); const sp = sketch(d, STD('right'), b);
  const p = SB(); p.line(p.pt(0, 25), p.pt(80, 25)); const sa = sketch(d, STD('top'), p);
  feat(d, { type: 'sweepcut', sketch: sp, path: sa }); return d;
}, { V: 40000 - 8 * PI * 80 });

// nervatura
const Lbracket = () => { const d = D0('L'); const b = SB(); b.poly([[0, 0], [60, 0], [60, 8], [8, 8], [8, 40], [0, 40]]); const s = sketch(d, STD('front'), b); feat(d, { type: 'extrude', sketch: s, end: 'mid', depth: 30 }); return d; };
T('Nervatura 6 mm nell\'angolo di una squadretta a L', () => {
  const d = Lbracket(); const r = SB(); r.line(r.pt(8, 30), r.pt(30, 8)); const s = sketch(d, STD('front'), r);
  feat(d, { type: 'rib', sketch: s, thick: 6 }); return d;
}, { V: (480 + 256) * 30 + 242 * 6, bb: [[0, 0, -15], [60, 40, 15]] });
T('Nervatura con linea corta (prolungata fino al pezzo)', () => {
  const d = Lbracket(); const r = SB(); r.line(r.pt(12, 18), r.pt(18, 12)); const s = sketch(d, STD('front'), r);
  feat(d, { type: 'rib', sketch: s, thick: 4 }); return d;
}, { V: (480 + 256) * 30 + 14 * 14 / 2 * 4 });
T('Nervatura spessore da un lato solo', () => {
  const d = Lbracket(); const r = SB(); r.line(r.pt(8, 30), r.pt(30, 8)); const s = sketch(d, STD('front'), r);
  feat(d, { type: 'rib', sketch: s, thick: 6, thickSide: '1' }); return d;
}, { V: (480 + 256) * 30 + 242 * 6, bb: [[0, 0, -15], [60, 40, 15]] });

/* ---------- corpi importati (STL, OBJ) ---------- */
const MI = Model.Import;
const enc = t => new TextEncoder().encode(t);
// file STL ASCII e binario costruiti qui, triangolo per triangolo
const stlA = tris => 'solid prova\n' + tris.map(t => ' facet normal 0 0 0\n  outer loop\n' + t.map(p => '   vertex ' + p.join(' ')).join('\n') + '\n  endloop\n endfacet').join('\n') + '\nendsolid prova\n';
function stlB(tris) {
  const buf = new ArrayBuffer(84 + 50 * tris.length), dv = new DataView(buf);
  dv.setUint32(80, tris.length, true);
  tris.forEach((t, i) => t.forEach((p, k) => p.forEach((x, j) => dv.setFloat32(84 + i * 50 + 12 + k * 12 + j * 4, x, true))));
  return new Uint8Array(buf);
}
function imp(doc, data, fmt = 'stl', extra = {}) {
  const r = fmt === 'obj' ? MI.parseOBJ(data) : MI.parseSTL(data);
  return feat(doc, { type: 'import', fmt, file: 'prova.' + fmt, unit: 'mm', mesh: MI.pack(MI.weld(r.pos)), ...extra });
}
// parallelepipedo: 6 facce divise in 12 triangoli con le normali verso l'esterno
function boxTris(x0, y0, z0, x1, y1, z1) {
  const q = [[[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]],
    [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]],
    [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]];
  return q.flatMap(([a, b, c, d]) => [[a, b, c], [a, c, d]]);
}
const rev = tris => tris.map(([a, b, c]) => [a, c, b]);
T('STL ASCII: cubo 20 mm', () => { const d = D0('i'); imp(d, enc(stlA(boxTris(0, 0, 0, 20, 20, 20)))); return d; },
  { V: 8000, A: 2400, C: [10, 10, 10], bb: [[0, 0, 0], [20, 20, 20]], E: 12 });
T('STL binario in centimetri: cubo 2 cm = 20 mm', () => { const d = D0('i'); imp(d, stlB(boxTris(0, 0, 0, 2, 2, 2)), 'stl', { unit: 'cm' }); return d; },
  { V: 8000, A: 2400, C: [10, 10, 10], bb: [[0, 0, 0], [20, 20, 20]] });
T('STL con le normali verso l\'interno (corretto da solo)', () => { const d = D0('i'); imp(d, enc(stlA(rev(boxTris(0, 0, 0, 20, 20, 20))))); return d; },
  { V: 8000, A: 2400, C: [10, 10, 10] });
T('STL con un triangolo girato al contrario (corretto da solo)', () => { const d = D0('i'); const t = boxTris(0, 0, 0, 20, 20, 20); t[5] = rev([t[5]])[0]; imp(d, stlB(t)); return d; },
  { V: 8000, A: 2400, C: [10, 10, 10], E: 12 });
T('OBJ con facce a 4 lati, Z verso l\'alto: 10 × 20 × 30', () => {
  const d = D0('i');
  const obj = 'o scatola\nv 0 0 0\nv 10 0 0\nv 10 20 0\nv 0 20 0\nv 0 0 30\nv 10 0 30\nv 10 20 30\nv 0 20 30\n' +
    'f 1 4 3 2\nf 5 6 7 8\nf 1 2 6 5\nf 3 4 8 7\nf -7 -6 -2 -3\nf 1/1 5/1 8/1 4/1\n';
  imp(d, obj, 'obj', { zUp: true }); return d;
}, { V: 6000, A: 2200, C: [5, 15, -10], bb: [[0, 0, -20], [10, 30, 0]], E: 12 });
T('Ottaedro (8 facce inclinate), vertici a 10 mm dal centro', () => {
  const d = D0('i'); const t = [];
  for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) { const a = [10 * sx, 0, 0], b = [0, 10 * sy, 0], c = [0, 0, 10 * sz]; t.push(sx * sy * sz > 0 ? [a, b, c] : [a, c, b]); }
  imp(d, stlB(t)); return d;
}, { V: 4000 / 3, A: 400 * Math.sqrt(3), C: [0, 0, 0], E: 12 });
const prism = n => { const t = [], r = 10, h = 10, P = i => { const a = 2 * PI * (i % n) / n; return [r * Math.cos(a), 0, r * Math.sin(a)]; }, U = p => [p[0], h, p[2]];
  for (let i = 0; i < n; i++) { const a = P(i), b = P(i + 1); t.push([[0, 0, 0], a, b], [[0, h, 0], U(b), U(a)], [b, a, U(a)], [b, U(a), U(b)]); } return t; };
T('Prisma a 32 lati (cilindro a faccette): spigoli morbidi nascosti', () => { const d = D0('i'); imp(d, stlB(prism(32))); return d; },
  { V: 16000 * Math.sin(PI / 16), A: 3200 * Math.sin(PI / 16) + 6400 * Math.sin(PI / 32), C: [0, 5, 0], E: 64 });
// cucitura: l'ultimo punto è calcolato con l'angolo 2π (sin 2π ≠ 0 nei numeri del computer) e spostato di 10⁻⁹ mm
const prismSeam = n => { const t = [], r = 10, h = 10, P = i => { const a = 2 * PI * i / n; return i === n ? [r * Math.cos(a) + 1e-9, 0, r * Math.sin(a) - 1e-9] : [r * Math.cos(a), 0, r * Math.sin(a)]; }, U = p => [p[0], h, p[2]];
  for (let i = 0; i < n; i++) { const a = P(i), b = P(i + 1); t.push([[0, 0, 0], a, b], [[0, h, 0], U(b), U(a)], [b, a, U(a)], [b, U(a), U(b)]); } return t; };
T('Cilindro a faccette con la cucitura «quasi» chiusa (vertici saldati)', () => { const d = D0('i'); imp(d, enc(stlA(prismSeam(32)))); return d; },
  { V: 16000 * Math.sin(PI / 16), C: [0, 5, 0], E: 64 });
T('Cubo importato + taglio R5 profondo 5 su una sua faccia', () => {
  const d = D0('i'); imp(d, enc(stlA(boxTris(0, 0, 0, 20, 20, 20))));
  const b = SB(); b.circle(10, -10, 5); const s = sketch(d, face(d, nearW([0, 1, 0], 20)), b);
  feat(d, { type: 'cut', sketch: s, end: 'blind', depth: 5 }); return d;
}, { V: 8000 - 125 * PI, C: [10, (8000 * 10 - 125 * PI * 17.5) / (8000 - 125 * PI), 10] });
T('Cubo importato + estrusione unita sopra (10 × 10 × 5)', () => {
  const d = D0('i'); imp(d, enc(stlA(boxTris(0, 0, 0, 20, 20, 20))));
  const b = SB(); b.rect(5, -15, 15, -5); const s = sketch(d, face(d, nearW([0, 1, 0], 20)), b);
  feat(d, { type: 'extrude', sketch: s, end: 'blind', depth: 5 }); return d;
}, { V: 8500, A: 2400 + 200, bb: [[0, 0, 0], [20, 25, 20]] });

/* ---------- corpi importati da STEP e IGES (risultato di OpenCascade simulato) ---------- */
// OpenCascade restituisce, per ogni solido, triangoli con i vertici ripetuti faccia per faccia e l'elenco delle facce vere
// (brep_faces: primo e ultimo triangolo di ogni faccia). Qui lo si costruisce a mano; il lettore vero è provato in step.test.js.
function occtMesh(faces, name = 'pezzo') {
  const pos = [], idx = [], bf = [];
  for (const tris of faces) {
    const first = idx.length / 3;
    for (const t of tris) for (const p of t) { idx.push(pos.length / 3); pos.push(...p); }
    bf.push({ first, last: idx.length / 3 - 1, color: null });
  }
  return { name, attributes: { position: { array: pos } }, index: { array: idx }, brep_faces: bf };
}
const fakeOCCT = meshesFor => { const r = p => ({ success: true, meshes: meshesFor(p) }); return { ReadStepFile: (d, p) => r(p), ReadIgesFile: (d, p) => r(p) }; };
const STEP_HEAD = enc('ISO-10303-21;\nHEADER;\nENDSEC;\n');
function cadImp(doc, meshes, extra = {}) {
  const r = MI.readCAD(fakeOCCT(() => meshes), STEP_HEAD, 'step');
  const m = MI.weld(r.pos); m.f = new Uint32Array([...m.src].map(t => r.face[t]));
  return feat(doc, { type: 'import', fmt: 'step', file: 'prova.step', unit: 'mm', mesh: MI.pack(m), ...extra });
}
// le 6 facce del parallelepipedo, ognuna come faccia vera fatta di 2 triangoli
const boxFaces = (x0, y0, z0, x1, y1, z1) => { const t = boxTris(x0, y0, z0, x1, y1, z1); return [0, 1, 2, 3, 4, 5].map(k => [t[2 * k], t[2 * k + 1]]); };
T('STEP: cubo 20 mm, 6 facce vere con i vertici ripetuti', () => { const d = D0('s'); cadImp(d, [occtMesh(boxFaces(0, 0, 0, 20, 20, 20))]); return d; },
  { V: 8000, A: 2400, C: [10, 10, 10], bb: [[0, 0, 0], [20, 20, 20]], E: 12 });
// prisma esagonale r 10, h 10: i 6 lati sono un'unica faccia vera (come un cilindro grossolano). Tra i lati ci sono 60°,
// ma lo spigolo non si disegna perché la faccia è la stessa: restano i due esagoni (12 spigoli)
const hexFaces = () => { const r = 10, h = 10, P = i => { const a = 2 * PI * (i % 6) / 6; return [r * Math.cos(a), 0, r * Math.sin(a)]; }, U = p => [p[0], h, p[2]];
  const bot = [], top = [], side = [];
  for (let i = 0; i < 6; i++) { const a = P(i), b = P(i + 1); bot.push([[0, 0, 0], a, b]); top.push([[0, h, 0], U(b), U(a)]); side.push([b, a, U(a)], [b, U(a), U(b)]); }
  return [bot, top, side]; };
T('STEP: prisma esagonale con i lati in una sola faccia vera (spigoli tra i lati nascosti)', () => { const d = D0('s'); cadImp(d, [occtMesh(hexFaces())]); return d; },
  { V: 1.5 * Math.sqrt(3) * 1000, A: 600 + 3 * Math.sqrt(3) * 100, C: [0, 5, 0], E: 12 });
T('STEP: due solidi separati (assieme), cubo 10 e cubo 10 a 5 mm di distanza', () => { const d = D0('s'); cadImp(d, [occtMesh(boxFaces(0, 0, 0, 10, 10, 10), 'a'), occtMesh(boxFaces(15, 0, 0, 25, 10, 10), 'b')]); return d; },
  { V: 2000, A: 1200, C: [12.5, 5, 5], bb: [[0, 0, 0], [25, 10, 10]], E: 24 });
T('STEP con Z verso l\'alto: blocco 10 × 20 × 30 coricato', () => { const d = D0('s'); cadImp(d, [occtMesh(boxFaces(0, 0, 0, 10, 20, 30))], { zUp: true }); return d; },
  { V: 6000, A: 2200, C: [5, 15, -10], bb: [[0, 0, -20], [10, 30, 0]], E: 12 });
T('STEP: cubo importato + foro R4 passante con taglio dalla faccia superiore', () => {
  const d = D0('s'); cadImp(d, [occtMesh(boxFaces(0, 0, 0, 20, 20, 20))]);
  const b = SB(); b.circle(10, -10, 4); const s = sketch(d, face(d, nearW([0, 1, 0], 20)), b);
  feat(d, { type: 'cut', sketch: s, end: 'through' }); return d;
}, { V: 8000 - 320 * PI, C: [10, 10, 10] });

// materiale
T('Massa acciaio S235 (blocco 80×50×10)', () => { const d = box(); d.material = 's235'; return d; }, { V: 40000, M: 40000 * 7.85 / 1000 });

/* ---------- schizzi da file DXF (linee, archi, cerchi) ---------- */
// file DXF di testo costruiti qui: coppie «codice di gruppo / valore»
const dxfFile = (ents, opt = {}) => ['0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', String(opt.units === undefined ? 4 : opt.units), '0', 'ENDSEC',
  ...(opt.tables || []), ...(opt.blocks || []), '0', 'SECTION', '2', 'ENTITIES', ...ents.flat().map(String), '0', 'ENDSEC', '0', 'EOF'].join('\r\n');
const dLine = (x0, y0, x1, y1, ly = '0') => ['0', 'LINE', '8', ly, '10', x0, '20', y0, '30', 0, '11', x1, '21', y1, '31', 0];
const dCircle = (x, y, r) => ['0', 'CIRCLE', '8', '0', '10', x, '20', y, '40', r];
const dArc = (x, y, r, a0, a1) => ['0', 'ARC', '8', '0', '10', x, '20', y, '40', r, '50', a0, '51', a1];
const dPoly = (pts, closed) => ['0', 'LWPOLYLINE', '8', '0', '90', pts.length, '70', closed ? 1 : 0, ...pts.flatMap(p => ['10', p[0], '20', p[1], '42', p[2] || 0])];
// blocco «Q»: quadrato 10×10 con foro Ø4, punto base (5, 5)
const dBlockQ = ['0', 'SECTION', '2', 'BLOCKS', '0', 'BLOCK', '2', 'Q', '10', '5', '20', '5', ...[dPoly([[5, 5], [15, 5], [15, 15], [5, 15]], true), dCircle(10, 10, 2)].flat().map(String), '0', 'ENDBLK', '0', 'ENDSEC'];
// schizzo sul piano frontale importato dal DXF, poi estrusione cieca o rivoluzione di 360°
function dxfPart(text, fn = 'extrude', opts = {}) {
  const r = MI.parseDXF(text); const b = SB();
  MI.dxfToSketch(b.s, r.geo, { scale: MI.DXF_SCALE[r.unit || 'mm'], ...opts });
  const doc = D0('dxf'); const s = sketch(doc, STD('front'), b);
  if (fn === 'extrude') feat(doc, { type: 'extrude', sketch: s, end: 'blind', depth: 10 });
  else feat(doc, { type: 'revolve', sketch: s, angle: 360, axis: Sketch.profiles(b.s).axes[0].id });
  return doc;
}
T('DXF: piastra 100×60 (4 LINE) con foro Ø20 (CIRCLE), estrusa 10', () => dxfPart(dxfFile([dLine(0, 0, 100, 0), dLine(100, 0, 100, 60), dLine(100, 60, 0, 60), dLine(0, 60, 0, 0), dCircle(30, 30, 10)])),
  { V: 10 * (6000 - PI * 100), A: 2 * (6000 - PI * 100) + 10 * 320 + 10 * 20 * PI, C: [(6000 * 50 - 100 * PI * 30) / (6000 - 100 * PI), (6000 * 30 - 100 * PI * 30) / (6000 - 100 * PI), 5], bb: [[0, 0, 0], [100, 60, 10]] });
T('DXF: asola da LWPOLYLINE con bulge 1 (semicerchi R10, interasse 40)', () => dxfPart(dxfFile([dPoly([[0, 0], [40, 0, 1], [40, 20], [0, 20, 1]], true)])),
  { V: 10 * (800 + PI * 100), bb: [[-10, 0, 0], [50, 20, 10]], C: [20, 10, 5] });
T('DXF: forma a D (LINE + ARC da -90° a 90°)', () => dxfPart(dxfFile([dLine(0, 0, 0, 40), dArc(0, 20, 20, -90, 90)])),
  { V: 10 * PI * 400 / 2, bb: [[0, 0, 0], [20, 40, 10]], C: [4 * 20 / (3 * PI), 20, 5] });
T('DXF in centimetri ($INSUNITS 5): quadrato 5 cm = 50 mm', () => dxfPart(dxfFile([dPoly([[0, 0], [5, 0], [5, 5], [0, 5]], true)], { units: 5 })),
  { V: 25000, bb: [[0, 0, 0], [50, 50, 10]] });
T('DXF: blocco inserito in (100, 0), scala 2, ruotato 90°', () => dxfPart(dxfFile([['0', 'INSERT', '2', 'Q', '10', '100', '20', '0', '41', '2', '42', '2', '50', '90']], { blocks: dBlockQ })),
  { V: 10 * (400 - PI * 16), bb: [[80, 0, 0], [100, 20, 10]], C: [90, 10, 5] });
T('DXF: estremi staccati di 0,00002 mm e contorno doppio (uniti e tolti)', () => dxfPart(dxfFile([dLine(0, 0, 50, 0), dLine(50.00001, 0, 50, 30), dLine(50, 30, 0, 30.00002), dLine(0, 30, 0, 0), dLine(50, 0, 0, 0), dLine(0, 30, 50, 30)])),
  { V: 15000, bb: [[0, 0, 0], [50, 30, 10]] });
T('DXF: rivoluzione attorno all\'asse tratto-punto (layer con tipo di linea CENTER)', () => dxfPart(dxfFile([dLine(0, -5, 0, 45, 'ASSI'), dPoly([[20, 0], [30, 0], [30, 40], [20, 40]], true)],
  { tables: ['0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '0', 'LAYER', '2', 'ASSI', '70', '0', '6', 'CENTER', '0', 'ENDTAB', '0', 'ENDSEC'] }), 'revolve'),
  { V: PI * (900 - 400) * 40, bb: [[-30, 0, -30], [30, 40, 30]], C: [0, 20, 0] });
T('DXF: contorno spostato con l\'angolo in basso a sinistra sull\'origine', () => dxfPart(dxfFile([dPoly([[200, 100], [240, 100], [240, 130], [200, 130]], true)]), 'extrude', { origin: 'corner' }),
  { V: 12000, bb: [[0, 0, 0], [40, 30, 10]] });

T('Piastra 100×60×12 con 4 fori Ø8 allineati a due a due e foro centrale Ø28', () => {
  const doc = D0('piastra fori'); const b = SB(); b.rect(0, 0, 100, 60);
  for (const [x, y] of [[15, 15], [85, 15], [85, 45], [15, 45]]) b.circle(x, y, 4);
  b.circle(50, 30, 14);
  feat(doc, { type: 'extrude', sketch: sketch(doc, STD('top'), b), end: 'blind', depth: 12 }); return doc;
}, { V: 12 * (6000 - 4 * PI * 16 - PI * 196), C: [50, 6, -30], bb: [[0, 0, -60], [100, 12, 0]] });
T('DXF: flangia con angoli raggiati R10 (LWPOLYLINE), 4 fori Ø8 e foro Ø28', () => {
  const b = SB(), q = Math.SQRT2 - 1;
  const r = MI.parseDXF(dxfFile([dPoly([[10, 0], [90, 0, q], [100, 10], [100, 50, q], [90, 60], [10, 60, q], [0, 50], [0, 10, q]], true), dCircle(15, 15, 4), dCircle(85, 15, 4), dCircle(85, 45, 4), dCircle(15, 45, 4), dCircle(50, 30, 14)]));
  MI.dxfToSketch(b.s, r.geo, {});
  const doc = D0('flangia'); feat(doc, { type: 'extrude', sketch: sketch(doc, STD('top'), b), end: 'blind', depth: 12 }); return doc;
}, { V: 12 * (6000 - (4 - PI) * 100 - 4 * PI * 16 - PI * 196), C: [50, 6, -30], bb: [[0, 0, -60], [100, 12, 0]] });

/* ---------- DXF grandi (oltre il vecchio limite di 3000 entità) ---------- */
// piastra 600×600 con una griglia 20×20 di fori a passo 28: 360 ottagoni regolari (raggio 6, 8 LINE da una LWPOLYLINE)
// e 40 asole (interasse 10, raggio 4: 2 linee e 2 semicerchi). Entità: 4 + 360·8 + 40·4 = 3044
const BIG = (() => {
  const ents = [dPoly([[-300, -300], [300, -300], [300, 300], [-300, 300]], true)], oct = [], slots = [];
  for (let i = 0; i < 20; i++) for (let j = 0; j < 20; j++) {
    const x = -266 + 28 * i, y = -266 + 28 * j;
    if ((i * 20 + j) % 10 === 3) { ents.push(dPoly([[x - 5, y - 4], [x + 5, y - 4, 1], [x + 5, y + 4], [x - 5, y + 4, 1]], true)); slots.push([x, y]); }
    else { const R = 6, q = []; for (let k = 0; k < 8; k++) q.push([x + R * Math.cos(PI / 8 + k * PI / 4), y + R * Math.sin(PI / 8 + k * PI / 4)]); ents.push(dPoly(q, true)); oct.push([x, y]); }
  }
  const nO = oct.length, nS = slots.length;
  // area: piastra − ottagoni (2√2·R²) − asole (rettangolo 10×8 + cerchio R4)
  const area = 360000 - nO * 2 * Math.SQRT2 * 36 - nS * (80 + 16 * PI);
  return { text: dxfFile(ents), nO, nS, area, ents: 4 + 8 * nO + 4 * nS };
})();
T('DXF grande, 3044 entità (oltre il vecchio limite di 3000): piastra 600×600 con 360 fori ottagonali e 40 asole, estrusa 10', () => dxfPart(BIG.text),
  { V: 10 * BIG.area, bb: [[-300, -300, 0], [300, 300, 10]] });

/* ---------- DXF: ellissi e spline (diventano archi tangenti) ---------- */
// ELLIPSE: centro, estremo del semiasse maggiore (relativo al centro), rapporto minore/maggiore, parametri iniziale e finale (radianti)
const dEll = (cx, cy, mx, my, ratio, t0 = 0, t1 = 2 * PI, nz = 1) => ['0', 'ELLIPSE', '8', '0', '10', cx, '20', cy, '30', 0, '11', mx, '21', my, '31', 0, '210', 0, '220', 0, '230', nz, '40', ratio, '41', t0, '42', t1];
// SPLINE con punti di controllo (NURBS): grado, nodi, punti, pesi (facoltativi); 70: 1 chiusa, 4 razionale, 8 piana
const dSpl = (deg, knots, ctrl, w, flags = 8) => ['0', 'SPLINE', '8', '0', '210', 0, '220', 0, '230', 1, '70', flags, '71', deg, '72', knots.length, '73', ctrl.length, '74', 0,
  ...knots.flatMap(k => ['40', k]), ...(w ? w.flatMap(x => ['41', x]) : []), ...ctrl.flatMap(p => ['10', p[0], '20', p[1], '30', 0])];
// SPLINE con i soli punti di passaggio (ed eventualmente le tangenti agli estremi)
const dFit = (pts, flags = 8, t0, t1) => ['0', 'SPLINE', '8', '0', '70', flags, '71', 3, '72', 0, '73', 0, '74', pts.length,
  ...(t0 ? ['12', t0[0], '22', t0[1], '32', 0] : []), ...(t1 ? ['13', t1[0], '23', t1[1], '33', 0] : []), ...pts.flatMap(p => ['11', p[0], '21', p[1], '31', 0])];
// perimetro dell'ellisse (formula di Ramanujan, errore relativo < 10⁻¹⁰ per questi rapporti)
const ellP = (a, b) => { const h = ((a - b) / (a + b)) ** 2; return PI * (a + b) * (1 + 3 * h / (10 + Math.sqrt(4 - 3 * h))); };
T('DXF: ellisse intera 100×60 (ELLIPSE), estrusa 10', () => dxfPart(dxfFile([dEll(0, 0, 50, 0, 0.6)])),
  { V: 10 * PI * 50 * 30, A: 2 * PI * 50 * 30 + 10 * ellP(50, 30), C: [0, 0, 5], bb: [[-50, -30, 0], [50, 30, 10]] });
T('DXF: ellisse 100×60 ruotata di 30°, centro (100, 50)', () => dxfPart(dxfFile([dEll(100, 50, 50 * Math.cos(PI / 6), 50 * Math.sin(PI / 6), 0.6)])),
  (() => { const wx = Math.sqrt(2500 * 0.75 + 900 * 0.25), wy = Math.sqrt(2500 * 0.25 + 900 * 0.75); // semiampiezze dell'ingombro: √(a²cos²θ + b²sin²θ), √(a²sin²θ + b²cos²θ)
    return { V: 10 * PI * 1500, C: [100, 50, 5], bb: [[100 - wx, 50 - wy, 0], [100 + wx, 50 + wy, 10]] }; })());
T('DXF: quarto di ellisse (parametri 0…π/2) chiuso da due LINE', () => dxfPart(dxfFile([dEll(0, 0, 50, 0, 0.6, 0, PI / 2), dLine(0, 0, 50, 0), dLine(0, 0, 0, 30)])),
  { V: 10 * PI * 1500 / 4, C: [4 * 50 / (3 * PI), 4 * 30 / (3 * PI), 5], bb: [[0, 0, 0], [50, 30, 10]] });
T('DXF: mezza ellisse con normale (0,0,−1): parametri 0…π vanno sotto l\'asse', () => dxfPart(dxfFile([dEll(0, 0, 50, 0, 0.6, 0, PI, -1), dLine(-50, 0, 50, 0)])),
  { V: 10 * PI * 1500 / 2, C: [0, -4 * 30 / (3 * PI), 5], bb: [[-50, -30, 0], [50, 0, 10]] });
T('DXF: piastra 120×80 con foro ellittico 40×60 (asse maggiore verticale)', () => dxfPart(dxfFile([dPoly([[-60, -40], [60, -40], [60, 40], [-60, 40]], true), dEll(0, 0, 0, 30, 2 / 3)])),
  { V: 10 * (9600 - PI * 30 * 20), A: 2 * (9600 - 600 * PI) + 10 * 400 + 10 * ellP(30, 20), C: [0, 0, 5] });
T('DXF: ellisse molto schiacciata 200×2 (rapporto 1:100)', () => dxfPart(dxfFile([dEll(0, 0, 100, 0, 0.01)])),
  { V: 10 * PI * 100, A: 2 * PI * 100 + 10 * ellP(100, 1), bb: [[-100, -1, 0], [100, 1, 10]] });
// blocco «E»: mezza ellisse 50×30 sopra l'asse (a 25, b 15) chiusa dal diametro, punto base (0, 0)
const dBlockE = ['0', 'SECTION', '2', 'BLOCKS', '0', 'BLOCK', '2', 'E', '10', '0', '20', '0', ...[dEll(0, 0, 25, 0, 0.6, 0, PI), dLine(-25, 0, 25, 0)].flat().map(String), '0', 'ENDBLK', '0', 'ENDSEC'];
T('DXF: blocco con mezza ellisse, scala 2, ruotato 90° (va a sinistra)', () => dxfPart(dxfFile([['0', 'INSERT', '2', 'E', '10', '0', '20', '0', '41', '2', '42', '2', '50', '90']], { blocks: dBlockE })),
  { V: 10 * PI * 1500 / 2, C: [-4 * 30 / (3 * PI), 0, 5], bb: [[-30, -50, 0], [0, 50, 10]] });
// spline di Bézier quadratica (0,0) (50,100) (100,0): arco di parabola alto 50; area = 2/3 del triangolo dei punti di controllo, baricentro a 2/5 dell'altezza
T('DXF: SPLINE quadratica (arco di parabola) chiusa da una LINE', () => dxfPart(dxfFile([dSpl(2, [0, 0, 0, 1, 1, 1], [[0, 0], [50, 100], [100, 0]]), dLine(0, 0, 100, 0)])),
  { V: 10 * 2 / 3 * 5000, C: [50, 2 / 5 * 50, 5], bb: [[0, 0, 0], [100, 50, 10]] });
// Bézier cubica (0,0) (0,60) (100,60) (100,0): x = 100(3t² − 2t³), y = 180 t(1 − t); area = ∫y dx = 108 000 ∫t²(1−t)² dt = 3600,
// baricentro y = ∫y²/2 dx / A = 9 720 000 ∫t³(1−t)³ dt / 3600 = 135/7
T('DXF: SPLINE cubica (Bézier) chiusa da una LINE', () => dxfPart(dxfFile([dSpl(3, [0, 0, 0, 0, 1, 1, 1, 1], [[0, 0], [0, 60], [100, 60], [100, 0]]), dLine(0, 0, 100, 0)])),
  { V: 36000, C: [50, 135 / 7, 5], bb: [[0, 0, 0], [100, 45, 10]] });
// cerchio esatto come NURBS razionale di grado 2: 9 punti di controllo, pesi 1 e √2/2 alternati, nodi doppi ogni quarto
T('DXF: cerchio R25 come SPLINE razionale (pesi √2/2) = cerchio vero', () => {
  const R = 25, w = Math.SQRT1_2;
  return dxfPart(dxfFile([dSpl(2, [0, 0, 0, 0.25, 0.25, 0.5, 0.5, 0.75, 0.75, 1, 1, 1], [[R, 0], [R, R], [0, R], [-R, R], [-R, 0], [-R, -R], [0, -R], [R, -R], [R, 0]], [1, w, 1, w, 1, w, 1, w, 1], 8 + 4 + 1)]));
}, { V: 10 * PI * 625, A: 2 * PI * 625 + 10 * 2 * PI * 25, C: [0, 0, 5], bb: [[-25, -25, 0], [25, 25, 10]] });
T('DXF: quadrato 40 da una SPLINE di grado 1 (4 linee)', () => dxfPart(dxfFile([dSpl(1, [0, 0, 1, 2, 3, 4, 4], [[0, 0], [40, 0], [40, 40], [0, 40], [0, 0]], null, 8 + 1)])),
  { V: 16000, A: 3200 + 1600, C: [20, 20, 5], E: 12 });
// spline per 3 punti di passaggio (−a,0) (0,b) (a,0), estremi liberi: corde uguali h, M1 = −3b/h², x lineare;
// nel primo tratto y = b(3u − u³)/2, x = −a + a·u  →  area = 2·(5/8)ab = 5ab/4, baricentro y = (17ab²/35)/(5ab/4) = 68b/175
T('DXF: SPLINE per 3 punti di passaggio (estremi liberi) chiusa da una LINE', () => dxfPart(dxfFile([dFit([[-50, 0], [0, 40], [50, 0]]), dLine(-50, 0, 50, 0)])),
  { V: 10 * 5 / 4 * 50 * 40, C: [0, 68 * 40 / 175, 5], bb: [[-50, 0, 0], [50, 40, 10]] });
// spline chiusa per 4 punti (R,0) (0,R) (−R,0) (0,−R): ogni tratto P(u) = A(u)·Pi + B(u)·Pi+1 con B = (3u − u³)/2, A(u) = B(1−u);
// area = 4 · ½ R² ∫(A B′ − B A′) du = 2 R² · 61/40 = 61/20 R²
T('DXF: SPLINE chiusa per 4 punti di passaggio (R 20)', () => dxfPart(dxfFile([dFit([[20, 0], [0, 20], [-20, 0], [0, -20]], 8 + 1)])),
  { V: 10 * 61 / 20 * 400, C: [0, 0, 5] });
// spline per 2 punti (0,0) (100,0) con tangenti (1,1) e (1,−1): curva di Hermite, h = 100;
// y = h/√2 (u − u²), x = h[3u² − 2u³ + (u − 3u² + 2u³)/√2]  →  area = ∫y x′ du = h²(1/(5√2) − 1/60);
// con w = u − u² (e 1 − 6u + 6u² = 1 − 6w): momento ½∫y² x′ du = h³/4 (3/70 − 1/(105√2)); punto più alto a u = ½: y = h/(4√2)
T('DXF: SPLINE per 2 punti con le tangenti agli estremi, chiusa da una LINE', () => dxfPart(dxfFile([dFit([[0, 0], [100, 0]], 8, [1, 1], [1, -1]), dLine(0, 0, 100, 0)])),
  (() => { const h = 100, S2 = Math.SQRT2, A = h * h * (1 / (5 * S2) - 1 / 60), Mx = h ** 3 / 4 * (3 / 70 - 1 / (105 * S2));
    return { V: 10 * A, C: [50, Mx / A, 5], bb: [[0, 0, 0], [100, h / (4 * S2), 10]] }; })());
// estrusione con percorso lungo una spline importata: Bézier quadratica (0,0) (0,−100) (100,−100) sul piano superiore, che parte
// perpendicolare al piano frontale del profilo. B′(t) = 200 (t, −(1 − t)), |B′| = 200 √(2t² − 2t + 1); con s = t − ½:
// L = 200√2 ∫₋½^½ √(s² + ¼) ds = 100 + 50√2·arcsinh 1; tubo R2 → V = π·4·L (teorema di Pappo-Guldino; raggio di curvatura minimo 70,7)
const parabolaPath = p => MI.dxfToSketch(p.s, MI.parseDXF(dxfFile([dSpl(2, [0, 0, 0, 1, 1, 1], [[0, 0], [0, -100], [100, -100]])])).geo, {});
T('Sweep: cerchio R2 lungo una SPLINE importata da DXF (arco di parabola)', () => sweepDoc(parabolaPath, b => b.circle(0, 0, 2)),
  { V: 4 * PI * (100 + 50 * Math.SQRT2 * Math.asinh(1)) });

/* ---------- DXF: scelta dei layer ---------- */
// disegno con il pezzo (quadrato 40 sul layer PEZZO + blocco Q inserito sul layer PEZZO, con le sue entità sul layer 0),
// la squadratura (rettangolo 200 × 150 sul layer CARTIGLIO) e un layer QUOTE spento nella tabella dei layer (colore negativo)
const dLy = (ly, ...e) => e.map(x => { const y = x.slice(); y[3] = ly; return y; });
const layerFile = () => dxfFile([...dLy('PEZZO', dPoly([[100, 0], [140, 0], [140, 40], [100, 40]], true)), ['0', 'INSERT', '8', 'PEZZO', '2', 'Q', '10', '5', '20', '5'],
  ...dLy('CARTIGLIO', dPoly([[-20, -20], [180, -20], [180, 130], [-20, 130]], true)), ...dLy('QUOTE', dLine(0, 0, 50, 0), dLine(0, 0, 0, 30))], {
  blocks: dBlockQ, tables: ['0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '0', 'LAYER', '2', 'QUOTE', '70', '0', '62', '-7', '6', 'CONTINUOUS', '0', 'ENDTAB', '0', 'ENDSEC'] });
// solo il layer PEZZO: quadrato 40 × 40 (1600) più il blocco Q (quadrato 10 × 10 con foro Ø4, il punto base va in (5, 5): angolo in (5, 5))
T('DXF: solo il layer PEZZO (senza squadratura e quote), estruso 10', () => { const r = MI.parseDXF(layerFile(), { layers: ['PEZZO'] }); const b = SB(); MI.dxfToSketch(b.s, r.geo, {});
  const doc = D0('layer'); feat(doc, { type: 'extrude', sketch: sketch(doc, STD('front'), b), end: 'blind', depth: 10 }); return doc; },
  { V: 10 * (1600 + 100 - 4 * PI), bb: [[5, 0, 0], [140, 40, 10]] });

/* ---------- raccordi e smussi sul bordo di ellissi e spline (un solo spigolo) e su archi ---------- */
// Volume tolto (o aggiunto) = area della sezione × lunghezza della linea dei baricentri (Pappo-Guldino). Per una curva chiusa
// convessa la linea dei baricentri è la curva spostata di c: lunghezza L + 2πc (verso l'esterno) o L − 2πc (verso l'interno).
// Raccordo r: sezione r²(1 − π/4), baricentro a c = r(10 − 3π)/(3(4 − π)) dallo spigolo; smusso d: sezione d²/2, c = d/3.
const curveEdge = (doc, z) => { const st = Model.regen(doc);
  for (const g of Model.edgeGroups(st, st.topo).values()) { if (!g.curve) continue; const e = g.segs[0], a = st.topo.verts[e.a], b = st.topo.verts[e.b];
    if (Math.abs(a[2] - z) < 1e-6 && Math.abs(b[2] - z) < 1e-6) return { a: st.tags.get(g.t1).name, b: st.tags.get(g.t2).name, p: a }; }
  throw new Error('spigolo curvo non trovato'); };
const filA = r => r * r * k, filC = r => r * (10 - 3 * PI) / (3 * (4 - PI));
const ellHole = () => dxfPart(dxfFile([dPoly([[-60, -40], [60, -40], [60, 40], [-60, 40]], true), dEll(0, 0, 0, 30, 2 / 3)]));
T('Raccordo R3 sul bordo di un foro ellittico 40×60 (tutto il bordo con un clic)', () => { const d = ellHole(); feat(d, { type: 'fillet', r: 3, edges: [curveEdge(d, 10)] }); return d; },
  { D: -filA(3) * (ellP(30, 20) + 2 * PI * filC(3)) });
T('Smusso 2 sul bordo di un foro ellittico 40×60', () => { const d = ellHole(); feat(d, { type: 'chamfer', d: 2, edges: [curveEdge(d, 10)] }); return d; },
  { D: -2 * (ellP(30, 20) + 2 * PI * 2 / 3) });
T('Raccordo R4 sul bordo superiore di un\'ellisse 100×60 estrusa (convesso, verso l\'interno)', () => { const d = dxfPart(dxfFile([dEll(0, 0, 50, 0, 0.6)])); feat(d, { type: 'fillet', r: 4, edges: [curveEdge(d, 10)] }); return d; },
  { D: -filA(4) * (ellP(50, 30) - 2 * PI * filC(4)), bb: [[-50, -30, 0], [50, 30, 10]] });
T('Smusso 3 × 1,5 (due distanze) sul bordo di un\'ellisse 100×60 estrusa', () => { const d = dxfPart(dxfFile([dEll(0, 0, 50, 0, 0.6)])); feat(d, { type: 'chamfer', mode: 'dd', d: 3, d2: 1.5, edges: [curveEdge(d, 10)] }); return d; },
  // sezione triangolare 3 (nel piano) × 1,5 (lungo la parete): area 2,25, baricentro a 1 dalla parete
  { D: -2.25 * (ellP(50, 30) - 2 * PI * 1) });
T('Raccordo concavo R2 alla base di una borchia ellittica 50×30 (si aggiunge materiale)', () => {
  const d = dxfPart(dxfFile([dPoly([[-60, -40], [60, -40], [60, 40], [-60, 40]], true)]));
  const b = SB(); MI.dxfToSketch(b.s, MI.parseDXF(dxfFile([dEll(0, 0, 25, 0, 0.6)])).geo, {});
  feat(d, { type: 'extrude', sketch: sketch(d, face(d, nearW([0, 0, 1], 10)), b), end: 'blind', depth: 10 });
  feat(d, { type: 'fillet', r: 2, edges: [curveEdge(d, 10)] }); return d;
}, { D: filA(2) * (ellP(25, 15) + 2 * PI * filC(2)) });
// spline chiusa per (R,0) (0,R) (−R,0) (0,−R): ogni tratto P(u) = A(u)·Pi + B(u)·Pi+1, B = (3u − u³)/2, A(u) = B(1 − u);
// lunghezza = 4R ∫ √(A′² + B′²) du (Simpson, 2000 intervalli)
const splL = R => { const n = 2000, Bp = u => (3 - 3 * u * u) / 2, fn = u => Math.hypot(Bp(1 - u), Bp(u)); let S = fn(0) + fn(1);
  for (let i = 1; i < n; i++) S += (i % 2 ? 4 : 2) * fn(i / n); return 4 * R * S / (3 * n); };
T('Raccordo R2 sul bordo di una spline chiusa per 4 punti (R 20)', () => { const d = dxfPart(dxfFile([dFit([[20, 0], [0, 20], [-20, 0], [0, -20]], 8 + 1)])); feat(d, { type: 'fillet', r: 2, edges: [curveEdge(d, 10)] }); return d; },
  { D: -filA(2) * (splL(20) - 2 * PI * filC(2)) });
// asola con semicerchi R10 (bulge): raccordo e smusso su uno solo dei due archi (mezzo giro: π·(R − c))
const slotArc = d => edge(d, [50, 10, 10], 'circle');
T('Raccordo R3 su un arco (semicerchio R10 di un\'asola)', () => { const d = dxfPart(dxfFile([dPoly([[0, 0], [40, 0, 1], [40, 20], [0, 20, 1]], true)])); feat(d, { type: 'fillet', r: 3, edges: [slotArc(d)] }); return d; },
  { D: -filA(3) * PI * (10 - filC(3)) });
T('Smusso 3 su un arco (semicerchio R10 di un\'asola)', () => { const d = dxfPart(dxfFile([dPoly([[0, 0], [40, 0, 1], [40, 20], [0, 20, 1]], true)])); feat(d, { type: 'chamfer', d: 3, edges: [slotArc(d)] }); return d; },
  { D: -4.5 * PI * (10 - 1) });

/* ---------- propagazione tangente (un clic, tutta la catena di spigoli senza angolo) ---------- */
// Asola: linee lunghe 40 e semicerchi R10. La linea dei baricentri della sezione è il bordo spostato di c: le linee restano
// lunghe 40, i due semicerchi diventano un cerchio di raggio 10 − c (verso l'interno, asola in rilievo) o 10 + c (foro).
const slot = () => dxfPart(dxfFile([dPoly([[0, 0], [40, 0, 1], [40, 20], [0, 20, 1]], true)]));
const slotLine = d => edge(d, [20, 0, 10], 'line');
T('Propagazione tangente: raccordo R3 con un clic su una linea dell\'asola (4 spigoli)', () => { const d = slot(); feat(d, { type: 'fillet', r: 3, tangent: true, edges: [slotLine(d)] }); return d; },
  { D: -filA(3) * (80 + 2 * PI * (10 - filC(3))) });
T('Propagazione tangente: smusso 2 con un clic su un arco dell\'asola (4 spigoli)', () => { const d = slot(); feat(d, { type: 'chamfer', d: 2, tangent: true, edges: [slotArc(d)] }); return d; },
  { D: -2 * (80 + 2 * PI * (10 - 2 / 3)) });
T('Senza propagazione tangente: raccordo R3 solo sulla linea dell\'asola', () => { const d = slot(); feat(d, { type: 'fillet', r: 3, tangent: false, edges: [slotLine(d)] }); return d; },
  { D: -filA(3) * 40 });
// foro ad asola in una piastra: lo spigolo è convesso, la linea dei baricentri sta fuori dal foro (raggio 10 + c)
T('Propagazione tangente: raccordo R3 sul bordo di un foro ad asola', () => { const d = dxfPart(dxfFile([dPoly([[-30, -20], [70, -20], [70, 40], [-30, 40]], true), dPoly([[0, 0], [40, 0, 1], [40, 20], [0, 20, 1]], true)]));
  feat(d, { type: 'fillet', r: 3, tangent: true, edges: [slotLine(d)] }); return d; },
  { D: -filA(3) * (80 + 2 * PI * (10 + filC(3))) });
// rettangolo 60 × 20 chiuso in alto da mezza ellisse (semiassi 30 e 15) tangente ai lati verticali: un clic sull'ellisse
// propaga ai due lati (20 + 20) ma non alla base (angolo retto). Mezza ellisse spostata verso l'interno di c: P/2 − π·c.
const ellArch = () => dxfPart(dxfFile([dLine(0, 20, 0, 0), dLine(0, 0, 60, 0), dLine(60, 0, 60, 20), dEll(30, 20, 30, 0, 0.5, 0, PI)]));
T('Propagazione tangente: raccordo R2 dal bordo di una mezza ellisse ai due lati tangenti', () => { const d = ellArch(); feat(d, { type: 'fillet', r: 2, tangent: true, edges: [curveEdge(d, 10)] }); return d; },
  { D: -filA(2) * (40 + ellP(30, 15) / 2 - PI * filC(2)) });
// curva aperta da sola: l'utensile finisce piatto alle due estremità (prima i due tappi avevano lo stesso verso)
T('Raccordo R2 solo sul bordo di una mezza ellisse (curva aperta, senza propagazione)', () => { const d = ellArch(); feat(d, { type: 'fillet', r: 2, tangent: false, edges: [curveEdge(d, 10)] }); return d; },
  { D: -filA(2) * (ellP(30, 15) / 2 - PI * filC(2)) });
T('Smusso 2 solo sul bordo di una mezza ellisse (curva aperta, senza propagazione)', () => { const d = ellArch(); feat(d, { type: 'chamfer', d: 2, tangent: false, edges: [curveEdge(d, 10)] }); return d; },
  { D: -2 * (ellP(30, 15) / 2 - PI * 2 / 3) });
T('Propagazione tangente: si ferma agli angoli (spigolo del blocco 80 × 50 × 10)', () => { const d = box(); feat(d, { type: 'fillet', r: 5, tangent: true, edges: [edge(d, [40, 10, 0], 'line')] }); return d; },
  { D: -filA(5) * 80 });

/* ---------- schizzo: risolutore ---------- */
const SK = [];
SK.push(['Rettangolo quotato 80×50 (orizz./vert. + quote)', () => {
  const b = SB(); const [p1, p2, p3, p4] = b.rect(0, 0, 70, 45); const s = b.s;
  const L = s.ents.filter(e => e.t === 'ln');
  s.cons.push({ t: 'coincident', e: [p1, 'O'] }, { t: 'horizontal', e: [L[0].id] }, { t: 'vertical', e: [L[1].id] }, { t: 'horizontal', e: [L[2].id] }, { t: 'vertical', e: [L[3].id] },
    { t: 'len', e: [L[0].id], v: 80 }, { t: 'len', e: [L[1].id], v: 50 });
  const r = Sketch.solve(s); const E = Sketch.byId(s);
  return { ok: r.ok, got: [E.get(p3).x, E.get(p3).y], exp: [80, 50] };
}]);
SK.push(['Cerchio con diametro quotato 25', () => {
  const b = SB(); const c = b.circle(5, 5, 7); b.s.cons.push({ t: 'diameter', e: [c], v: 25 });
  const r = Sketch.solve(b.s); return { ok: r.ok, got: [Sketch.byId(b.s).get(c).r], exp: [12.5] };
}]);
SK.push(['Retta inclinata: lunghezza 30, angolo 30° dall\'orizzontale', () => {
  const b = SB(); const a = b.pt(0, 0), e = b.pt(20, 15); const l = b.line(a, e); const h = b.line(b.pt(0, -5), b.pt(10, -5));
  b.s.cons.push({ t: 'coincident', e: [a, 'O'] }, { t: 'horizontal', e: [h] }, { t: 'len', e: [l], v: 30 }, { t: 'angle', e: [h, l], v: 30 });
  const r = Sketch.solve(b.s); const E = Sketch.byId(b.s); return { ok: r.ok, got: [E.get(e).x, E.get(e).y], exp: [30 * Math.cos(PI / 6), 15] };
}]);

SK.push(['DXF: testi e quote ignorati, linee contate (3 LINE, 1 TEXT, 1 DIMENSION, 1 SPLINE vuota)', () => {
  const r = MI.parseDXF(dxfFile([dLine(0, 0, 10, 0), dLine(10, 0, 10, 10), dLine(10, 10, 0, 0), ['0', 'TEXT', '8', '0', '10', '0', '20', '0', '1', 'ciao'], ['0', 'DIMENSION', '8', '0'], ['0', 'SPLINE', '8', '0']]));
  const b = SB(); const info = MI.dxfToSketch(b.s, r.geo, {});
  return { ok: true, got: [info.count.line, r.skipped.testi, r.skipped.quote, r.skipped['curve spline'], info.points], exp: [3, 1, 1, 1, 3] };
}]);

// ellissi e spline: controlli indipendenti sugli archi ottenuti
const arcPt = (g, a) => [g.c[0] + g.r * Math.cos(a), g.c[1] + g.r * Math.sin(a)];
const endsOf = g => g.t === 'line' ? [g.a, g.b] : [arcPt(g, g.a0), arcPt(g, g.a1)];
// direzione della tangente di un tratto nel suo estremo q (a meno del verso)
const tanAt = (g, q) => g.t === 'line' ? [g.b[0] - g.a[0], g.b[1] - g.a[1]] : [-(q[1] - g.c[1]), q[0] - g.c[0]];
// massimo angolo (seno) tra le tangenti di due tratti che si toccano, e numero di giunzioni trovate
function joints(geo) {
  let worst = 0, n = 0;
  for (let i = 0; i < geo.length; i++) for (let j = i + 1; j < geo.length; j++) for (const p of endsOf(geo[i])) for (const q of endsOf(geo[j])) {
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-9) continue;
    const u = tanAt(geo[i], p), v = tanAt(geo[j], p);
    worst = Math.max(worst, Math.abs(u[0] * v[1] - u[1] * v[0]) / (Math.hypot(...u) * Math.hypot(...v))); n++;
  }
  return { worst, n };
}
SK.push(['DXF: ellisse 100×60 → archi tangenti tra loro, sulla curva entro 1/10 000 del diametro minore', () => {
  const r = MI.parseDXF(dxfFile([dEll(0, 0, 50, 0, 0.6)])), a = 50, b = 30, tol = MI.DXF_CURVE_TOL * 2 * b;
  // distanza dall'ellisse vera: |f| / |∇f| con f = x²/a² + y²/b² − 1 (esatta al primo ordine, qui le distanze sono di millesimi)
  let dmax = 0;
  for (const g of r.geo) for (let k = 0; k <= 8; k++) {
    const [x, y] = arcPt(g, g.a0 + (g.a1 - g.a0) * k / 8);
    dmax = Math.max(dmax, Math.abs(x * x / (a * a) + y * y / (b * b) - 1) / Math.hypot(2 * x / (a * a), 2 * y / (b * b)));
  }
  const j = joints(r.geo);
  return { ok: true, got: [r.geo.every(g => g.t === 'arc') ? 1 : 0, dmax <= tol ? 1 : 0, r.approx.err <= tol ? 1 : 0, j.worst < 1e-8 ? 1 : 0, j.n, r.approx.ellipses], exp: [1, 1, 1, 1, r.geo.length, 1] };
}]);
SK.push(['DXF: ELLIPSE con rapporto 1 = cerchio vero; arco di ELLIPSE con rapporto 1 = arco vero', () => {
  const r = MI.parseDXF(dxfFile([dEll(10, 20, 0, 15, 1), dEll(0, 0, 10, 0, 1, 0, PI / 2)]));
  const c = r.geo.find(g => g.t === 'circle'), a = r.geo.find(g => g.t === 'arc');
  return { ok: true, got: [r.geo.length, c.r, c.c[0], c.c[1], a.r, a.a0 + 1, a.a1], exp: [2, 15, 10, 20, 10, 1, PI / 2] };
}]);
SK.push(['DXF: centri degli archi di ellissi e spline nascosti, quelli degli ARC del file no', () => {
  const r = MI.parseDXF(dxfFile([dEll(0, 0, 50, 0, 0.6), dArc(200, 0, 10, 0, 90)])); const b = SB(); MI.dxfToSketch(b.s, r.geo, {});
  const E = Sketch.byId(b.s), arcs = b.s.ents.filter(e => e.t === 'ar');
  const hidden = arcs.filter(e => E.get(e.c).hc).length;
  return { ok: true, got: [hidden, arcs.length - hidden, b.s.ents.filter(e => e.hc).length], exp: [r.approx.arcs, 1, r.approx.arcs] };
}]);
// spigoli vivi tra due facce laterali di un'estrusione (spigoli «verticali»)
const sideEdges = doc => { const st = Model.regen(doc); if (st.errors.size || !st.body.length) throw new Error('pezzo non costruito: ' + [...st.errors.values()].join('; ')); return st.topo.edges.filter(e => e.sharp && e.polys.length === 2 && e.polys.every(p => st.tags.get(st.body[p].t).ent)).length; };
SK.push(['DXF: nessuno spigolo tra le facce di un\'ellisse estrusa; restano quelli veri di una spline con un angolo; nessun anello nel tubo lungo una spline', () => {
  // spline di grado 2 con nodo doppio: punta in (50, 60) (due archi di parabola che si incontrano ad angolo), chiusa da una LINE
  const kink = dSpl(2, [0, 0, 0, 1, 1, 2, 2, 2], [[0, 0], [10, 50], [50, 60], [90, 50], [100, 0]]);
  return { ok: true, got: [sideEdges(dxfPart(dxfFile([dEll(0, 0, 50, 0, 0.6)]))), sideEdges(dxfPart(dxfFile([kink, dLine(0, 0, 100, 0)]))), sideEdges(sweepDoc(parabolaPath, b => b.circle(0, 0, 2)))], exp: [0, 3, 0] };
}]);
SK.push(['DXF: SPLINE per 5 punti di passaggio irregolari: la curva passa per tutti i punti', () => {
  const P = [[0, 0], [13, 21], [37, 18], [52, -6], [80, 4]];
  const r = MI.parseDXF(dxfFile([dFit(P)]));
  const dist = (q, g) => { if (g.t === 'line') return Math.min(...[g.a, g.b].map(e => Math.hypot(e[0] - q[0], e[1] - q[1])));
    return Math.min(...endsOf(g).map(e => Math.hypot(e[0] - q[0], e[1] - q[1]))); };
  const worst = Math.max(...P.map(q => Math.min(...r.geo.map(g => dist(q, g)))));
  return { ok: true, got: [worst < 1e-9 ? 1 : 0, joints(r.geo).worst < 1e-8 ? 1 : 0, r.approx.splines], exp: [1, 1, 1] };
}]);
SK.push(['DXF: SPLINE con i nodi sbagliati saltata; SPLINE non piana appiattita e segnalata', () => {
  const bad = dSpl(2, [0, 0, 1, 1], [[0, 0], [5, 5], [10, 0]]);   // 4 nodi invece di 6
  const skew = ['0', 'SPLINE', '8', '0', '70', 0, '71', 1, '40', 0, '40', 0, '40', 1, '40', 1, '10', 0, '20', 0, '30', 0, '10', 10, '20', 0, '30', 5];
  const r = MI.parseDXF(dxfFile([bad, skew]));
  return { ok: true, got: [r.skipped['curve spline'], r.curves3d, r.geo.length, r.geo[0].b[0]], exp: [1, 1, 1, 10] };
}]);

SK.push(['DXF: elenco dei layer con il numero di entità e i layer spenti; filtro per layer (anche dentro i blocchi)', () => {
  const all = MI.parseDXF(layerFile()), info = Object.fromEntries(all.layerInfo.map(l => [l.name, l]));
  const only = ly => MI.parseDXF(layerFile(), { layers: ly }).geo.length;
  return { ok: true, got: [all.layerInfo.map(l => l.name).join() === 'CARTIGLIO,PEZZO,QUOTE' ? 1 : 0, info.PEZZO.count, info.CARTIGLIO.count, info.QUOTE.count, info.QUOTE.off ? 1 : 0, info.PEZZO.off ? 1 : 0,
    all.geo.length, only(['PEZZO']), only(['CARTIGLIO', 'QUOTE']), only([])], exp: [1, 3, 1, 2, 1, 0, 4 + 5 + 4 + 2, 9, 6, 0] };
}]);
SK.push(['Bordo di un foro ellittico: un solo spigolo (tutti gli archi); dopo il raccordo nessuna riga tra i tratti', () => {
  // 12 spigoli della piastra + bordo superiore e inferiore del foro; dopo il raccordo: + il bordo tra raccordo e parete
  const d = ellHole(), st0 = Model.regen(d), g0 = [...Model.edgeGroups(st0, st0.topo).values()];
  const curve = g0.find(g => g.curve && st0.topo.verts[g.segs[0].a][2] > 5), geo = Model.edgeGeometry(curve, st0, st0.topo);
  const segs = geo.parts.reduce((n, p) => n + p.group.segs.length, 0);
  feat(d, { type: 'fillet', r: 3, edges: [curveEdge(d, 10)] });
  const st = Model.regen(d);
  const seams = st.topo.edges.filter(e => e.sharp && e.polys.length === 2 && e.polys.every(p => st.tags.get(st.body[p].t).scg)).length;
  const smooth = st.topo.edges.filter(e => e.smooth && e.polys.every(p => st.tags.get(st.body[p].t).scg)).length;
  return { ok: !st.errors.size, got: [g0.length, geo.kind === 'curve' ? 1 : 0, geo.parts.every(p => p.kind === 'circle') ? 1 : 0, segs === curve.segs.length ? 1 : 0,
    Math.abs(geo.length / ellP(30, 20) - 1) < 1e-3 ? 1 : 0, Model.edgeGroups(st, st.topo).size, seams, smooth > 50 ? 1 : 0], exp: [14, 1, 1, 1, 1, 15, 0, 1] };
}]);
SK.push(['Propagazione tangente: quanti spigoli lavora la funzione (asola 4, mezza ellisse 3, blocco 1, senza propagazione 1)', () => {
  const n = (d, ref, tangent) => { const id = feat(d, { type: 'fillet', r: 2, tangent, edges: [ref(d)] }); const st = Model.regen(d); return st.errors.size ? -1 : st.edgeCount.get(id); };
  const a = slot(), e = ellArch(), b = box(), c = slot();
  return { ok: true, got: [n(a, slotLine, true), n(e, d => curveEdge(d, 10), true), n(b, d => edge(d, [40, 10, 0], 'line'), true), n(c, slotLine, false)], exp: [4, 3, 1, 1] };
}]);
// stato dello schizzo con meno vincoli che incognite (si scompone la trasposta della matrice dei vincoli)
SK.push(['Stato: rettangolo con un vertice nell\'origine e lati orizz./vert. → 2 gradi di libertà', () => {
  const b = SB(); const [p1, p2, p3, p4] = b.rect(0, 0, 70, 45); const L = b.s.ents.filter(e => e.t === 'ln');
  b.s.cons.push({ t: 'coincident', e: [p1, 'O'] }, { t: 'horizontal', e: [L[0].id] }, { t: 'vertical', e: [L[1].id] }, { t: 'horizontal', e: [L[2].id] }, { t: 'vertical', e: [L[3].id] });
  const a = Sketch.analyze(b.s);   // 8 incognite, 6 equazioni indipendenti
  return { ok: a.status === 'under', got: [a.dof, a.free.has(p1) ? 1 : 0, a.free.has(p3) ? 1 : 0, a.free.size], exp: [2, 0, 1, 7] };
}]);
SK.push(['Stato: ellisse importata (anello chiuso di archi) → 3 gradi di libertà per arco', () => {
  const r = MI.parseDXF(dxfFile([dEll(0, 0, 50, 0, 0.6)])); const b = SB(); MI.dxfToSketch(b.s, r.geo, {});
  const n = b.s.ents.filter(e => e.t === 'ar').length, a = Sketch.analyze(b.s);
  return { ok: a.status === 'under', got: [a.dof, a.m], exp: [3 * n, n] };
}]);
SK.push(['Schizzo con due linee incrociate (più un\'altra): messaggio «si intersecano», senza blocchi', () => {
  const b = SB(); b.line(b.pt(0, 0), b.pt(10, 10)); b.line(b.pt(0, 10), b.pt(10, 0)); b.line(b.pt(20, 0), b.pt(30, 0));
  const p = Sketch.profiles(b.s);
  return { ok: true, got: [p.errors.some(e => /si intersecano/.test(e)) ? 1 : 0], exp: [1] };
}]);

// schizzi grandi: niente limite, calcoli a blocchi. I conteggi (interi) devono essere esatti, non entro l'1 %
const sameInts = (got, exp) => got.every((g, i) => !Number.isInteger(exp[i]) || g === exp[i]);
SK.push(['DXF grande, 3044 entità: schizzo, stato (gradi di libertà e rango contati a mano) e contorni (area a mano)', () => {
  const r = MI.parseDXF(BIG.text); const b = SB(); const info = MI.dxfToSketch(b.s, r.geo, {});
  const t = Date.now(); const a = Sketch.analyze(b.s); const p = Sketch.profiles(b.s); const ms = Date.now() - t;
  // incognite: x e y dei punti (4 della piastra, 8 per ottagono, 4 + 2 centri per asola); vincoli: uno per arco (raggio costante)
  const P = 4 + 8 * BIG.nO + 6 * BIG.nS;
  const got = [r.geo.length, info.count.line, info.count.arc, a.n, a.rank, a.dof, a.free.size, p.regions.length, p.regions[0].holes.length, p.regions[0].area];
  const exp = [BIG.ents, 4 + 8 * BIG.nO + 2 * BIG.nS, 2 * BIG.nS, 2 * P, 2 * BIG.nS, 2 * P - 2 * BIG.nS, b.s.ents.length - 1, 1, BIG.nO + BIG.nS, BIG.area];
  return { ok: a.status === 'under' && !p.errors.length && ms < 30000 && sameInts(got, exp), got, exp };
}]);
SK.push(['Schizzo grande: un vertice trascinato va sotto il mouse e il resto non si muove; «Orizzontale» su un lato orizzontale sì, ripetuto no', () => {
  const r = MI.parseDXF(BIG.text); const b = SB(); MI.dxfToSketch(b.s, r.geo, {});
  const E = Sketch.byId(b.s);
  // vertice dell'ottagono nel primo foro (−266, −266): quello a 22,5°
  const vx = -266 + 6 * Math.cos(PI / 8), vy = -266 + 6 * Math.sin(PI / 8);
  const v = b.s.ents.find(e => e.t === 'pt' && Math.hypot(e.x - vx, e.y - vy) < 1e-9);
  const before = b.s.ents.filter(e => e.t === 'pt' && e !== v).map(e => [e.x, e.y]);
  const res = Sketch.solve(b.s, { drag: { id: v.id, x: vx + 3, y: vy - 2 } });
  const moved = b.s.ents.filter(e => e.t === 'pt' && e !== v).filter((e, k) => Math.abs(e.x - before[k][0]) > 1e-12 || Math.abs(e.y - before[k][1]) > 1e-12).length;
  // lato in basso dell'ottagono del secondo foro (vertici a 247,5° e 292,5°): è orizzontale
  const y0 = -238 + 6 * Math.sin(PI / 8 + 5 * PI / 4);
  const low = b.s.ents.find(e => e.t === 'ln' && Math.abs(E.get(e.a).y - y0) < 1e-9 && Math.abs(E.get(e.b).y - y0) < 1e-9 && Math.abs(E.get(e.a).x + 266) < 7);
  const c = { id: 'kh1', t: 'horizontal', e: [low.id] };
  const first = Sketch.wouldOverdefine(b.s, c); b.s.cons.push(c);
  const second = Sketch.wouldOverdefine(b.s, { id: 'kh2', t: 'horizontal', e: [low.id] });
  return { ok: res.ok && !first && second && moved === 0, got: [v.x, v.y, moved], exp: [vx + 3, vy - 2, 0] };
}]);
SK.push(['Contorno di 12 000 lati (LWPOLYLINE): una regione con l\'area del poligono (prima il giro si fermava a 10 000 lati)', () => {
  const N = 12000, R = 300, q = [];
  for (let k = 0; k < N; k++) q.push([R * Math.cos(2 * PI * k / N), R * Math.sin(2 * PI * k / N)]);
  const r = MI.parseDXF(dxfFile([dPoly(q, true)])); const b = SB(); MI.dxfToSketch(b.s, r.geo, {});
  const p = Sketch.profiles(b.s), c = Sketch.chains(b.s);
  const got = [p.regions.length, p.loops[0].length, p.regions[0].area, c.chains.length, c.chains[0].segs.length, c.chains[0].closed ? 1 : 0], exp = [1, N, N * R * R * Math.sin(2 * PI / N) / 2, 1, N, 1];
  return { ok: !p.errors.length && !c.errors.length && sameInts(got, exp), got, exp };
}]);
SK.push(['Faccia di 100 100 vertici divisa in triangoli: 100 098 triangoli con l\'area del poligono (prima si fermava a 100 000 passi)', () => {
  const N = 100100, R = 500, q = [];
  for (let k = 0; k < N; k++) q.push([R * Math.cos(2 * PI * k / N), R * Math.sin(2 * PI * k / N)]);
  const tr = Geom.triangulate(q, []);
  let A = 0; for (const [i, j, k] of tr) A += ((q[j][0] - q[i][0]) * (q[k][1] - q[i][1]) - (q[j][1] - q[i][1]) * (q[k][0] - q[i][0])) / 2;
  return { ok: tr.length === N - 2, got: [tr.length, A], exp: [N - 2, N * R * R * Math.sin(2 * PI / N) / 2] };
}]);

// STEP: se i triangoli sono troppi si rilegge il file con triangoli più grandi (livello successivo)
SK.push(['STEP: troppi triangoli → secondo livello di finezza (200 → 80, massimo 100)', () => {
  const tri = n => [occtMesh([Array.from({ length: n }, (_, k) => [[k, 0, 0], [k + 1, 0, 0], [k, 1, 0]])])];
  const occt = fakeOCCT(p => tri(p.angularDeflection === MI.CAD_LEVELS[0].angularDeflection ? 200 : 80));
  const r = MI.readCAD(occt, STEP_HEAD, 'step', { max: 100 });
  return { ok: true, got: [r.level, r.tris, r.faces], exp: [1, 80, 1] };
}]);
SK.push(['STEP: facce vere conservate nel salvataggio (pack/unpack)', () => {
  const r = MI.readCAD(fakeOCCT(() => [occtMesh(hexFaces())]), STEP_HEAD, 'step');
  const m = MI.weld(r.pos); m.f = new Uint32Array([...m.src].map(t => r.face[t]));
  const u = MI.unpack(JSON.parse(JSON.stringify(MI.pack(m))));
  const a = MI.analyze(u);
  return { ok: true, got: [u.f.length, u.f[0], u.f[u.f.length - 1], a.brepFaces, a.open], exp: [24, 0, 2, 3, 0] };
}]);
SK.push(['STEP e IGES: riconoscimento del tipo e messaggi per i file sbagliati', () => {
  const code = t => ({ step: 1, iges: 2, stepxml: 3 })[MI.cadKind(enc(t))] || 0;
  const igs = 'Banco CAD prova IGES'.padEnd(72) + 'S      1\n';
  let wrong = 0;
  try { MI.readCAD(fakeOCCT(() => []), enc(igs), 'step'); } catch (e) { if (/Sembra un IGES/.test(e.message)) wrong++; }
  try { MI.readCAD(fakeOCCT(() => []), STEP_HEAD, 'step'); } catch (e) { if (/non ci sono solidi/.test(e.message)) wrong++; }
  return { ok: true, got: [code('ISO-10303-21;\nHEADER;'), code(igs), code('<?xml version="1.0"?>'), code('solid prova'), wrong], exp: [1, 2, 3, 0, 2] };
}]);

/* ---------- esportazioni: STEP (solido a facce piane) e PDF ---------- */
// STEP del pezzo: conti di vertici V, spigoli E, facce F e anelli interni H fatti a mano. Per un solido chiuso vale la
// formula di Eulero–Poincaré V − E + F − H = 2·(solidi − fori passanti); ogni spigolo è percorso da due facce, nei due sensi.
const stepOf = doc => { const st = Model.regen(doc); if (st.errors.size || !st.body.length) throw new Error('pezzo non costruito'); return Export.toSTEP(st.body, Geom.topology(st.body, st.tags), { name: doc.name, date: new Date(2026, 9, 28) }); };
const stepCounts = r => { const s = r.stats; return [s.verts, s.edges, s.faces, s.holes, s.solids, s.verts - s.edges + s.faces - s.holes, s.badEdges + s.openLoops]; };
SK.push(['STEP: blocco 80×50×10 → 8 vertici, 12 spigoli, 6 facce, Eulero 2, ogni spigolo usato due volte nei due sensi', () => {
  const r = stepOf(box()); const g = stepCounts(r);
  return { ok: g.join() === [8, 12, 6, 0, 1, 2, 0].join() && /^ISO-10303-21;/.test(r.text) && /MANIFOLD_SOLID_BREP\('blocco'/.test(r.text) && /SI_UNIT\(\.MILLI\.,\.METRE\.\)/.test(r.text), got: g, exp: [8, 12, 6, 0, 1, 2, 0] };
}]);
SK.push(['STEP: piastra 100×60×8 con 4 fori R5 (cerchi di 48 lati) → Eulero 2 − 2·4 = −6; 8 anelli interni (i fori sulle due facce)', () => {
  const d = D0('piastra'); const b = SB(); b.rect(0, 0, 100, 60); for (const [x, y] of [[20, 15], [80, 15], [20, 45], [80, 45]]) b.circle(x, y, 5);
  feat(d, { type: 'extrude', sketch: sketch(d, STD('top'), b), end: 'blind', depth: 8 });
  const r = stepOf(d), s = r.stats, n = (s.faces - 6) / 4;   // facce di ogni foro
  // ogni foro: n facce laterali, 2n vertici, 3n spigoli; la piastra: 8 vertici, 12 spigoli, 6 facce
  const g = stepCounts(r);
  return { ok: g.join() === [8 + 8 * n, 12 + 12 * n, 6 + 4 * n, 8, 1, -6, 0].join(), got: [...g, n], exp: [8 + 8 * n, 12 + 12 * n, 6 + 4 * n, 8, 1, -6, 0, n] };
}]);
SK.push(['STEP: blocco 60×40×10 con un dado 20×20×15 sopra → 11 facce, la faccia di sopra del blocco ha un anello interno; i vertici a T sui lati dritti tolti', () => {
  const d = D0('gradino'); const b = SB(); b.rect(0, 0, 60, 40); feat(d, { type: 'extrude', sketch: sketch(d, STD('top'), b), end: 'blind', depth: 10 });
  const b2 = SB(); b2.rect(10, 10, 30, 30); feat(d, { type: 'extrude', sketch: sketch(d, STD('top'), b2), end: 'blind', depth: 25 });
  const g = stepCounts(stepOf(d));
  return { ok: g.join() === [16, 24, 11, 1, 1, 2, 0].join(), got: g, exp: [16, 24, 11, 1, 1, 2, 0] };
}]);
SK.push(['STEP: due blocchi 10×10×10 staccati → due solidi (Eulero 2 + 2 = 4)', () => {
  const d = D0('due'); const b = SB(); b.rect(0, 0, 10, 10); b.rect(20, 0, 30, 10); feat(d, { type: 'extrude', sketch: sketch(d, STD('top'), b), end: 'blind', depth: 10 });
  const r = stepOf(d), g = stepCounts(r);
  return { ok: g.join() === [16, 24, 12, 0, 2, 4, 0].join() && (r.text.match(/MANIFOLD_SOLID_BREP/g) || []).length === 2, got: g, exp: [16, 24, 12, 0, 2, 4, 0] };
}]);
SK.push(['STEP: nome con lettere accentate e apostrofo scritto come vuole la norma (\\X2\\…\\X0\\ e \'\')', () => {
  const d = box(); d.name = "Flangia d'uscita è"; const t = stepOf(d).text;
  const ok = t.includes("PRODUCT('Flangia d''uscita \\X2\\00E8\\X0\\'") && !/[^\x09\x0a\x0d\x20-\x7e]/.test(t);
  return { ok, got: [ok ? 1 : 0], exp: [1] };
}]);
// PDF: un quarto di cerchio con una curva di Bézier (punti di controllo a 4/3·tan(22,5°) = 0,55228 del raggio) si scosta
// dal cerchio al massimo di 2,7253·10⁻⁴ del raggio (valore noto)
SK.push(['PDF: cerchio R10 con 4 curve di Bézier → scostamento massimo 2,7253·10⁻⁴ R = 0,0027 mm', () => {
  const bz = Export.arcBeziers(0, 0, 10, 10, 0, 0, 2 * PI);
  let p0 = [10, 0], dmax = 0, dmin = 0;
  for (const b of bz) {
    for (let i = 0; i <= 200; i++) {
      const t = i / 200, u = 1 - t;
      const x = u * u * u * p0[0] + 3 * u * u * t * b[0] + 3 * u * t * t * b[2] + t * t * t * b[4], y = u * u * u * p0[1] + 3 * u * u * t * b[1] + 3 * u * t * t * b[3] + t * t * t * b[5];
      const dr = Math.hypot(x, y) - 10; dmax = Math.max(dmax, dr); dmin = Math.min(dmin, dr);
    }
    p0 = [b[4], b[5]];
  }
  return { ok: bz.length === 4 && Math.abs(p0[0] - 10) < 1e-12 && Math.abs(p0[1]) < 1e-12, got: [bz.length, dmax * 1e4 / 10, dmin], exp: [4, 2.7253, 0] };
}]);
SK.push(['PDF: arco della SVG «M0 0 A10 10 0 0 1 20 0» (y verso il basso) → mezzo cerchio di centro (10, 0) che passa per (10, −10)', () => {
  const ops = Export.pathOps('M0 0A10 10 0 0 1 20 0'), c = ops[1], e = ops[2];
  return { ok: ops.length === 3 && ops[0][0] === 'M' && c[0] === 'C' && e[0] === 'C', got: [c[5], c[6], e[5], e[6]], exp: [10, -10, 20, 0] };
}]);
SK.push(['PDF: foglio A3 = 1190,55 × 841,89 punti; «Ø20» centrato su x = 100 (Helvetica: 778 + 2·556 = 1890 millesimi → 9,45 mm a corpo 5); tabella dei riferimenti esatta', () => {
  const d = new Export.Doc({ title: 'prova', date: new Date(2026, 9, 28) }), pg = d.addPage(420, 297);
  const w = pg.text('Ø20', 100, 50, 5, { anchor: 'middle' });
  pg.moveTo(20, 10).lineTo(410, 10).paint(null, [0, 0, 0]);
  const u8 = d.buildSync(), t = new TextDecoder('latin1').decode(u8);
  const mb = (t.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/) || []).slice(1).map(Number);
  const tx = +(t.match(/5 0 0 -5 ([\d.]+) 50 Tm \(\\33020\) Tj/) || [])[1];
  // ogni oggetto «n 0 obj» deve stare esattamente al byte scritto nella tabella xref
  const xi = t.lastIndexOf('\nxref\n') + 1;
  const xref = t.slice(xi).split('\n').slice(3).filter(l => / n $/.test(l)).map(l => +l.slice(0, 10));
  const okRef = xref.length === 7 && xref.every((o, i) => t.startsWith((i + 1) + ' 0 obj', o)) && +t.match(/startxref\n(\d+)/)[1] === xi;
  return { ok: okRef, got: [mb[0], mb[1], w, tx], exp: [420 * 72 / 25.4, 297 * 72 / 25.4, 9.45, 95.275] };
}]);

/* ---------- esecuzione ---------- */
function run(tol = TOL) {
  const rel = (g, e, scale) => Math.abs(g - e) / Math.max(Math.abs(e), scale || 1e-9);
  const rows = [];
  for (const c of CASES) {
    const msg = [], errs = {}; let ok = true, mp;
    try {
      const doc = c.build(); const st = Model.regen(doc);
      if (st.errors.size) throw new Error([...st.errors.values()].join('; '));
      if (st.warn.size) msg.push('avviso: ' + [...st.warn.values()].join('; '));
      mp = Model.massProperties(st, doc);
      if (!mp) throw new Error('nessun solido');
      const size = Math.max(...[0, 1, 2].map(i => mp.bbox.mx[i] - mp.bbox.mn[i]));
      const chk = (lab, g, e, scale) => { const r = rel(g, e, scale); if (r > tol) { ok = false; msg.push(`${lab}: ${g.toFixed(3)} invece di ${e.toFixed(3)} (${(r * 100).toFixed(2)}%)`); } return r; };
      if (c.exp.V !== undefined) errs.V = chk('Volume', mp.volume, c.exp.V);
      if (c.exp.R !== undefined) errs.R = chk('Materiale tolto', 40000 - mp.volume, c.exp.R);
      // D: variazione di volume dell'ultima funzione, misurata sul pezzo costruito senza di lei (così l'approssimazione
      // del pezzo di partenza, per esempio gli archi di un'ellisse, non si somma all'errore della funzione)
      if (c.exp.D !== undefined) { const V0 = Model.massProperties(Model.regen({ ...doc, features: doc.features.slice(0, -1) }), doc).volume; errs.D = chk('Materiale tolto o aggiunto', mp.volume - V0, c.exp.D); }
      if (c.exp.A !== undefined) errs.A = chk('Area', mp.area, c.exp.A);
      if (c.exp.M !== undefined) errs.M = chk('Massa', mp.mass, c.exp.M);
      if (c.exp.C) errs.C = Math.max(...c.exp.C.map((e, i) => chk('Baricentro ' + 'xyz'[i], mp.centroid[i], e, size)));
      if (c.exp.E !== undefined) { const ne = st.topo.edges.filter(e => e.sharp).length; errs.E = chk('Spigoli vivi', ne, c.exp.E); }
      if (c.exp.bb) errs.bb = Math.max(...[0, 1, 2].map(i => Math.max(chk('Ingombro min ' + 'xyz'[i], mp.bbox.mn[i], c.exp.bb[0][i], size), chk('Ingombro max ' + 'xyz'[i], mp.bbox.mx[i], c.exp.bb[1][i], size))));
      rows.push({ name: c.name, ok, errs, msg, V: mp.volume, Vexp: c.exp.V });
    } catch (e) { ok = false; msg.push('ERRORE ' + e.message); rows.push({ name: c.name, ok, errs, msg }); }
  }
  for (const [name, fn] of SK) {
    let ok = true; const msg = [], errs = {};
    try { const r = fn(); if (!r.ok) { ok = false; msg.push('risolutore non converge'); } errs.S = 0; r.exp.forEach((e, i) => { const q = rel(r.got[i], e, 1); errs.S = Math.max(errs.S, q); if (q > tol) { ok = false; msg.push(`valore ${i}: ${r.got[i].toFixed(4)} invece di ${e}`); } }); }
    catch (e) { ok = false; msg.push('ERRORE ' + e.message); }
    rows.push({ name: 'Schizzo · ' + name, ok, errs, msg });
  }
  return rows;
}
if (isNode) {
  const rows = run();
  const pct = x => x === undefined ? '' : (x * 100).toFixed(3) + '%';
  for (const r of rows) console.log((r.ok ? 'OK  ' : 'NO  ') + r.name + (Object.keys(r.errs).length ? '  [' + Object.entries(r.errs).map(([k, v]) => k + ' ' + pct(v)).join(', ') + ']' : '') + (r.msg.length ? '\n      ' + r.msg.join('\n      ') : ''));
  const fail = rows.filter(r => !r.ok).length;
  console.log(`\n${rows.length - fail}/${rows.length} superati (tolleranza ${(TOL * 100).toFixed(1)}%)`);
  if (process.env.JSON) require('fs').writeFileSync(process.env.JSON, JSON.stringify(rows, null, 1));
  process.exit(fail ? 1 : 0);
} else root.SelfTest = { run, count: () => CASES.length + SK.length };
})(this);
