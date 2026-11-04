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
const Assembly = isNode ? require(path.join(dir, 'assembly.js')) : root.Assembly;
const TOL = isNode ? +(process.env.TOL || 0.01) : 0.01;
const PI = Math.PI;

/* ---------- costruttori ---------- */
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
T('Piastra forata', () => {
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
T('Squadretta a L con raccordo concavo R6', () => {
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

/* ---------- corpi solidi: Unisci risultato, Combina, Sposta/Copia, Elimina/Mantieni ---------- */
// blocco x0..x1, z −y1..−y0 (sketch sul piano superiore), alto h, y da 0 a h; merge false = corpo nuovo
const blk = (d, x0, y0, x1, y1, h, merge) => { const b = SB(); b.rect(x0, y0, x1, y1); const f = { type: 'extrude', sketch: sketch(d, STD('top'), b), end: 'blind', depth: h }; if (merge !== undefined) f.merge = merge; return feat(d, f); };
// A = 40 × 40 × 10; B = 20 × 20 × 30 con x 30..50, z −50..−30: hanno in comune un cubetto 10 × 10 × 10 (x 30..40, y 0..10, z −40..−30)
const twoB = () => { const d = D0('c'); const a = blk(d, 0, 0, 40, 40, 10), b = blk(d, 30, 30, 50, 50, 30, false); return { d, a, b }; };
T('Corpi: Unisci risultato spento: due corpi, il volume è la somma (la parte in comune conta due volte, come in SolidWorks)', () => twoB().d, { V: 16000 + 12000, A: 4800 + 3200 });
T('Combina › Aggiungi: 16000 + 12000 − 1000; area 4800 + 3200 − 600', () => { const { d, a, b } = twoB(); feat(d, { type: 'combine', op: 'add', main: a, tools: [b] }); return d; }, { V: 27000, A: 7400 });
T('Combina › Sottrai: A meno B = lastra con un angolo tolto', () => { const { d, a, b } = twoB(); feat(d, { type: 'combine', op: 'sub', main: a, tools: [b] }); return d; }, { V: 15000, A: 2 * 1500 + 160 * 10 });
T('Combina › Sottrai: B meno A', () => { const { d, a, b } = twoB(); feat(d, { type: 'combine', op: 'sub', main: b, tools: [a] }); return d; }, { V: 11000 });
T('Combina › Comune: il cubetto 10 × 10 × 10 in comune', () => { const { d, a, b } = twoB(); feat(d, { type: 'combine', op: 'common', main: a, tools: [b] }); return d; }, { V: 1000, A: 600, C: [35, 5, -35], bb: [[30, 0, -40], [40, 10, -30]] });
T('Corpi: un taglio passante lavora tutti i corpi', () => { const d = D0('c'); blk(d, 0, 0, 10, 10, 10); blk(d, 20, 0, 30, 10, 10, false); const b = SB(); b.rect(5, 0, 25, 10); feat(d, { type: 'cut', sketch: sketch(d, STD('top'), b), end: 'through', both: true }); return d; }, { V: 1000 });
T('Sposta corpo: cilindro R5 h20 spostato di (100, 0, 0): volume e area esatti', () => { const d = D0('c'); const b = SB(); b.circle(0, 0, 5); const a = feat(d, { type: 'extrude', sketch: sketch(d, STD('top'), b), end: 'blind', depth: 20 }); feat(d, { type: 'movebody', bodies: [a], dx: 100 }); return d; }, { V: 500 * PI, A: 200 * PI + 50 * PI, C: [100, 10, 0] });
T('Sposta corpo: blocco ruotato di +90° attorno a Y e poi spostato', () => { const d = D0('c'); const a = blk(d, 0, 0, 10, 10, 10); feat(d, { type: 'movebody', bodies: [a], axis: 'y', angle: 90, dy: 5 }); return d; }, { V: 1000, bb: [[-10, 5, -10], [0, 15, 0]] });
T('Copia corpo: 2 copie di un blocco a passo 20: tre corpi', () => { const d = D0('c'); const a = blk(d, 0, 0, 10, 10, 10); feat(d, { type: 'movebody', bodies: [a], copy: true, copies: 2, dx: 20 }); return d; }, { V: 3000, A: 1800, C: [25, 5, -5], bb: [[0, 0, -10], [50, 10, 0]] });
T('Elimina corpo', () => { const { d, b } = twoB(); feat(d, { type: 'delbody', bodies: [b] }); return d; }, { V: 16000, A: 4800 });
T('Mantieni corpo', () => { const { d, b } = twoB(); feat(d, { type: 'delbody', keep: true, bodies: [b] }); return d; }, { V: 12000, A: 3200 });

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
// percorso che si incrocia: 60 in giù, arco R20 di 270°, poi 40 a sinistra: i due tratti dritti si incrociano ad angolo retto.
// L = 60 + 30π + 40; R = 2: V = π R² L meno un solido di Steinmetz (16/3 R³), che i due tratti hanno in comune
T('Sweep: percorso che si incrocia: il volume in comune si conta una volta', () => sweepDoc(p => { const a = p.pt(0, 0), b = p.pt(0, -60), c = p.pt(20, -60), e = p.pt(20, -40), g = p.pt(-20, -40); p.line(a, b); p.arc(c, b, e); p.line(e, g); }, b => b.circle(0, 0, 2)),
  { V: 4 * PI * (100 + 30 * PI) - 16 / 3 * 8 });
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
/* ---------- Ambito funzione dei tagli (valori a mano) ---------- */
// due blocchi 10×10×10 staccati: A x 0..10, B x 20..30; il taglio x 5..25 passante toglie metà di ognuno
const scope2 = which => { const d = D0('c'); const a = blk(d, 0, 0, 10, 10, 10), c = blk(d, 20, 0, 30, 10, 10, false); const b = SB(); b.rect(5, 0, 25, 10); const f = { type: 'cut', sketch: sketch(d, STD('top'), b), end: 'through', both: true }; if (which) f.scope = which(a, c); feat(d, f); return d; };
T('Ambito funzione: taglio solo sul primo corpo: metà di A + B intero; area 400 + 600', () => scope2((a) => [a]), { V: 500 + 1000, A: 1000, bb: [[0, 0, -10], [30, 10, 0]] });
T('Ambito funzione: taglio solo sul secondo corpo: A intero + metà di B', () => scope2((a, c) => [c]), { V: 1000 + 500, A: 1000, bb: [[0, 0, -10], [30, 10, 0]] });
T('Ambito funzione: i due corpi scelti = tutti i corpi', () => scope2((a, c) => [a, c]), { V: 1000 });
// serie: A e B larghi 40; il taglio largo 5 è ripetuto 3 volte a passo 10 e resta su A: 4000 − 3·500, B intero
T('Ambito funzione: la serie di un taglio lavora sugli stessi corpi', () => { const d = D0('c'); const a = blk(d, 0, 0, 40, 10, 10); blk(d, 0, 20, 40, 30, 10, false); const b = SB(); b.rect(5, -1, 10, 35); const cut = feat(d, { type: 'cut', sketch: sketch(d, STD('top'), b), end: 'through', both: true, scope: [a] }); feat(d, { type: 'lpattern', feats: [cut], dir: { kind: 'axis', id: 'x' }, n: 3, spacing: 10 }); return d; }, { V: 2500 + 4000 });
// due blocchi sovrapposti: il foro passante lavora su uno solo, l'altro resta pieno
T('Ambito funzione: anche il foro lavora solo sul corpo scelto: Ø8 su 1000, area del cerchio × 10', () => { const d = D0('c'); const a = blk(d, 0, 0, 10, 10, 10); blk(d, 0, 0, 10, 10, 10, false); const b = SB(); b.pt(5, 5, { hole: true }); const s = sketch(d, face(d, nearW([0, 1, 0], 10)), b); feat(d, { type: 'hole', sketch: s, kind: 'simple', dia: 8, end: 'through', scope: [a] }); return d; }, { V: 2000 - Math.PI * 16 * 10 });

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
// meno archi: ogni biarco va il più lontano possibile lungo la curva; lo scostamento vero (misurato fitto nei due sensi)
// resta entro 1/10 000 del diametro minore. Con la divisione a metà di prima: 56 archi (100×60) e 152 (200×2).
const ellDense = (a, b, geo) => {
  const dEl = (x, y) => Math.abs(x * x / (a * a) + y * y / (b * b) - 1) / Math.hypot(2 * x / (a * a), 2 * y / (b * b));
  let e1 = 0; for (const g of geo) for (let k = 0; k <= 64; k++) { const [x, y] = arcPt(g, g.a0 + (g.a1 - g.a0) * k / 64); e1 = Math.max(e1, dEl(x, y)); }
  const dArc = (q, g) => { let f = Math.atan2(q[1] - g.c[1], q[0] - g.c[0]); while (f < g.a0) f += 2 * PI; while (f > g.a0 + 2 * PI) f -= 2 * PI;
    if (f <= g.a1) return Math.abs(Math.hypot(q[0] - g.c[0], q[1] - g.c[1]) - g.r); return Math.min(...endsOf(g).map(e => Math.hypot(q[0] - e[0], q[1] - e[1]))); };
  let e2 = 0; for (let k = 0; k < 4000; k++) { const t = 2 * PI * k / 4000, q = [a * Math.cos(t), b * Math.sin(t)]; e2 = Math.max(e2, Math.min(...geo.map(g => dArc(q, g)))); }
  return Math.max(e1, e2);
};
SK.push(['DXF: meno archi per curva: ellisse 100×60 in non più di 40 archi, 200×2 in non più di 100; scostamento vero ≤ 1/10 000 del diametro minore', () => {
  const r1 = MI.parseDXF(dxfFile([dEll(0, 0, 50, 0, 0.6)])), r2 = MI.parseDXF(dxfFile([dEll(0, 0, 100, 0, 0.01)]));
  const e1 = ellDense(50, 30, r1.geo), e2 = ellDense(100, 1, r2.geo), t1 = MI.DXF_CURVE_TOL * 60, t2 = MI.DXF_CURVE_TOL * 2;
  return { ok: true, got: [r1.geo.length <= 40 ? 1 : 0, r2.geo.length <= 100 ? 1 : 0, e1 <= t1 * (1 + 1e-9) ? 1 : 0, e2 <= t2 * (1 + 1e-9) ? 1 : 0, joints(r1.geo).worst < 1e-8 ? 1 : 0, Math.abs(r1.approx.err - e1) <= 0.01 * t1 ? 1 : 0], exp: [1, 1, 1, 1, 1, 1],
    info: `${r1.geo.length} e ${r2.geo.length} archi; scostamento ${(e1 / t1).toFixed(4)} e ${(e2 / t2).toFixed(4)} della tolleranza` };
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
SK.push(['Corpi: quanti corpi dopo ogni operazione; Unisci risultato acceso si unisce solo ai corpi che tocca, anche con una faccia sola', () => {
  const n = d => Model.regen(d).bodies.length;
  const base = () => { const d = D0('c'); blk(d, 0, 0, 10, 10, 10); blk(d, 20, 0, 30, 10, 10, false); return d; };
  const legacy = D0('c'); blk(legacy, 0, 0, 10, 10, 10); blk(legacy, 50, 0, 60, 10, 10);                  // progetti vecchi: una parte, un corpo
  const hit1 = base(); blk(hit1, 8, 0, 12, 10, 10);                                                        // tocca il primo: 1000 + 200, 1000
  const hit2 = base(); blk(hit2, 10, 0, 20, 10, 10);                                                       // tocca i due con le facce: uno solo
  const none = base(); blk(none, 40, 0, 50, 10, 10);                                                       // non tocca nulla: corpo nuovo
  const v = d => Model.bodyProps(Model.regen(d), d).map(b => Math.round(b.volume)).join();
  const c = twoB(); feat(c.d, { type: 'combine', op: 'add', main: c.a, tools: [c.b] });
  const cp = D0('c'); const a0 = blk(cp, 0, 0, 10, 10, 10); feat(cp, { type: 'movebody', bodies: [a0], copy: true, copies: 2, dx: 20 });
  const k = twoB(); feat(k.d, { type: 'delbody', keep: true, bodies: [k.b] });
  const got = [n(legacy), n(hit1), n(hit2), n(none), n(c.d), n(cp), n(k.d), v(hit1) === '1200,1000' ? 1 : 0, v(hit2) === '3000' ? 1 : 0, v(none) === '1000,1000,1000' ? 1 : 0];
  return { ok: true, got, exp: [1, 2, 1, 3, 1, 3, 1, 1, 1, 1] };
}]);
SK.push(['Corpi: proprietà di massa per corpo (acciaio 7,85 g/cm³) e messaggi di errore di Combina', () => {
  const { d, a, b } = twoB(); d.material = (Model.MATERIALS.find(m => Math.abs(m.rho - 7850) < 1) || Model.MATERIALS.find(m => /C40/.test(m.name))).id;
  const rho = Model.MATERIALS.find(m => m.id === d.material).rho / 1000;
  const p = Model.bodyProps(Model.regen(d), d);
  const err = (o) => { const x = twoB(); feat(x.d, { type: 'combine', ...o(x) }); const st = Model.regen(x.d); return [...st.errors.values()][0] || ''; };
  const far = D0('c'); const f1 = blk(far, 0, 0, 10, 10, 10), f2 = blk(far, 50, 0, 60, 10, 10, false); feat(far, { type: 'combine', id: 'X', op: 'common', main: f1, tools: [f2] });
  const e3 = [...Model.regen(far).errors.values()][0] || '';
  return { ok: true, got: [p.length, p[0].volume, p[1].volume, p[0].mass, p[1].mass, p[0].area, p[1].centroid[1], /almeno due/.test(err(x => ({ op: 'add', main: x.a }))) ? 1 : 0, /non esiste/.test(err(x => ({ op: 'add', main: x.a, tools: ['nessuno'] }))) ? 1 : 0, /in comune/.test(e3) ? 1 : 0],
    exp: [2, 16000, 12000, 16000 * rho, 12000 * rho, 4800, 15, 1, 1, 1] };
}]);
SK.push(['Raccordo con due corpi: lavora solo il corpo dello spigolo, anche se l\'altro gli passa sopra', () => {
  // blocco 40×40×10 e, sopra lo spigolo x = 40, y = 10, un blocco che lo attraversa. Raccordo R2 sullo spigolo lungo z (convesso): togli (1 − π/4)·4 × lunghezza 40
  const d = D0('c'); blk(d, 0, 0, 40, 40, 10); const b = blk(d, 35, 10, 45, 30, 20, false);
  const r0 = Model.regen(d), v0 = Model.bodyProps(r0, d).map(x => x.volume);
  feat(d, { type: 'fillet', r: 2, edges: [edge(d, [40, 10, -5], 'line')] });
  const r1 = Model.regen(d), v1 = Model.bodyProps(r1, d).map(x => x.volume);
  return { ok: !r1.errors.size, got: [r1.bodies.length, v1[0], v1[1]], exp: [2, v0[0] - (1 - PI / 4) * 4 * 40, v0[1]] };
}]);
SK.push(['STEP di più corpi: due blocchi che si toccano con una faccia restano due solidi chiusi, 12 facce', () => {
  const d = D0('c'); blk(d, 0, 0, 10, 10, 10); blk(d, 10, 0, 20, 10, 10, false);
  const st = Model.regen(d);
  const r = Export.toSTEP(st.body, Geom.topology(st.body, st.tags), { name: 'c', tags: st.tags, bodies: Model.stepBodies(st), date: new Date(2026, 10, 3) });
  const c = (r.text.match(/MANIFOLD_SOLID_BREP/g) || []).length, rp = (r.text.match(/ADVANCED_BREP_SHAPE_REPRESENTATION/g) || []).length, nm = /MANIFOLD_SOLID_BREP\('Corpo2'/.test(r.text) ? 1 : 0;
  return { ok: true, got: [r.stats.solids, r.stats.faces, r.stats.badEdges + r.stats.openLoops, c, rp, nm], exp: [2, 12, 0, 2, 1, 1] };
}]);
SK.push(['STEP: due facce vere nello stesso piano restano due facce, con lo spigolo in mezzo', () => {
  // cubo 20: la faccia z = 20 è divisa in due rettangoli (x 0..8 e 8..20). Facce 6 + 1. Spigoli: i 2 lati y = 0 e y = 20 di quella
  // faccia diventano 2 ciascuno (toccano due facce), più quello in mezzo: 12 + 2 + 1 = 15
  const q = (a, b, c, e) => [[a, b, c], [a, e, c]];
  const f = boxFaces(0, 0, 0, 20, 20, 20).filter(tt => !tt.every(t => t.every(p => p[2] === 20)));
  const half = (x0, x1) => [[[x0, 0, 20], [x1, 0, 20], [x1, 20, 20]], [[x0, 0, 20], [x1, 20, 20], [x0, 20, 20]]];
  const d = D0('s'); cadImp(d, [occtMesh([...f, half(0, 8), half(8, 20)])]);
  const st = Model.regen(d), g = Model.edgeGroups(st, st.topo);
  const top = new Set(st.body.filter(p => p.p.n[2] > 0.5).map(p => st.topo.faceKeys[p.t]));
  const mp = Model.massProperties(st, d);
  const open = st.topo.edges.filter(e => e.polys.length !== 2).length;
  return { ok: !st.errors.size, got: [[...g.values()].length, top.size, new Set(st.topo.faceKeys.filter((k, i) => st.body.some(p => p.t === i))).size, mp.volume, open + 1], exp: [15, 2, 7, 8000, 1] };
}]);
SK.push(['Sweep lungo una spline: nessuna scheggia (area sotto 10⁻⁴ mm²), corpo chiuso', () => {
  const st = Model.regen(sweepDoc(parabolaPath, b => b.circle(0, 0, 2)));
  if (st.errors.size || !st.body.length) throw new Error('pezzo non costruito');
  let tiny = 0; const area = p => { let s = 0; for (let i = 1; i < p.v.length - 1; i++) { const u = p.v[i].map((x, k) => x - p.v[0][k]), w = p.v[i + 1].map((x, k) => x - p.v[0][k]); s += Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]) / 2; } return s; };
  for (const p of st.body) if (area(p) < 1e-4) tiny++;
  const open = st.topo.edges.filter(e => e.polys.length !== 2).length;
  const s = stepOf(sweepDoc(parabolaPath, b => b.circle(0, 0, 2))).stats;
  return { ok: true, got: [tiny + 1, open + 1, s.badEdges + 1, s.openLoops + 1], exp: [1, 1, 1, 1] };
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
// STEP con le superfici vere (come fa il programma: o.tags = st.tags). Conti fatti a mano: un cilindro intero è una
// faccia sola con due anelli (i due cerchi), senza cucitura; la sfera e il toro interi sono divisi in due metà.
const stepX = doc => { const st = Model.regen(doc); if (st.errors.size || !st.body.length) throw new Error('pezzo non costruito'); return Export.toSTEP(st.body, Geom.topology(st.body, st.tags), { name: doc.name, tags: st.tags, date: new Date(2026, 9, 29) }); };
const cntE = (t, re) => (t.match(re) || []).length;
SK.push(['STEP vero: piastra 100×60×8 con 4 fori R5 → 4 CYLINDRICAL_SURFACE R5 e 8 CIRCLE; 16 vertici, 20 spigoli, 10 facce, 12 anelli interni, Eulero −6', () => {
  const d = D0('piastra'); const b = SB(); b.rect(0, 0, 100, 60); for (const [x, y] of [[20, 15], [80, 15], [20, 45], [80, 45]]) b.circle(x, y, 5);
  feat(d, { type: 'extrude', sketch: sketch(d, STD('top'), b), end: 'blind', depth: 8 });
  const r = stepX(d), t = r.text, g = stepCounts(r);
  return { ok: true, got: [...g, cntE(t, /CYLINDRICAL_SURFACE\('',#\d+,5\.\)/g), cntE(t, /CIRCLE\('',#\d+,5\.\)/g), r.stats.fallback], exp: [16, 20, 10, 12, 1, -6, 0, 4, 8, 0] };
}]);
SK.push(['STEP vero: tubo di rivoluzione R 20/12 alto 30 → 2 cilindri e 2 corone piane, 4 cerchi; 4 vertici, 4 spigoli, 4 facce, Eulero 0', () => {
  const d = D0('tubo'); const b = SB(); b.center(0, -100, 0, 100); b.rect(12, 0, 20, 30); feat(d, { type: 'revolve', sketch: sketch(d, STD('front'), b), angle: 360 });
  const r = stepX(d), t = r.text;
  return { ok: true, got: [...stepCounts(r), cntE(t, /CYLINDRICAL_SURFACE\('',#\d+,20\.\)/g), cntE(t, /CYLINDRICAL_SURFACE\('',#\d+,12\.\)/g), cntE(t, /\bPLANE\(/g), r.stats.circles], exp: [4, 4, 4, 4, 1, 0, 0, 1, 1, 2, 4] };
}]);
SK.push(['STEP vero: sfera R10 intera → 2 SPHERICAL_SURFACE R10 divise dall\'equatore (1 vertice, 1 spigolo, 2 facce, Eulero 2)', () => {
  const d = D0('sfera'); const b = SB(); b.center(0, -100, 0, 100); const c = b.pt(0, 0), a = b.pt(0, -10), e = b.pt(0, 10); b.arc(c, a, e); b.line(e, a);
  feat(d, { type: 'revolve', sketch: sketch(d, STD('front'), b), angle: 360 });
  const r = stepX(d);
  return { ok: true, got: [...stepCounts(r), cntE(r.text, /SPHERICAL_SURFACE\('',#\d+,10\.\)/g), cntE(r.text, /CIRCLE\('',#\d+,10\.\)/g)], exp: [1, 1, 2, 0, 1, 2, 0, 2, 1] };
}]);
SK.push(['STEP vero: toro R20 r5 intero → 2 TOROIDAL_SURFACE (20, 5) divise dai cerchi R25 e R15 (2 vertici, 2 spigoli, 2 facce, Eulero 0)', () => {
  const d = D0('toro'); const b = SB(); b.center(0, -100, 0, 100); b.circle(20, 0, 5); feat(d, { type: 'revolve', sketch: sketch(d, STD('front'), b), angle: 360 });
  const r = stepX(d), t = r.text;
  return { ok: true, got: [...stepCounts(r), cntE(t, /TOROIDAL_SURFACE\('',#\d+,20\.,5\.\)/g), cntE(t, /CIRCLE\('',#\d+,25\.\)/g), cntE(t, /CIRCLE\('',#\d+,15\.\)/g)], exp: [2, 2, 2, 2, 1, 0, 0, 2, 1, 1] };
}]);
SK.push(['STEP vero: raccordo R3 su tutti i 12 spigoli → 12 cilindri R3, 8 sfere R3 agli angoli; 24 vertici, 48 spigoli (24 rette, 24 archi), 26 facce, Eulero 2', () => {
  const d = box(); feat(d, { type: 'fillet', r: 3, edges: allEdges(d) });
  const r = stepX(d), t = r.text;
  return { ok: true, got: [...stepCounts(r), cntE(t, /CYLINDRICAL_SURFACE\('',#\d+,3\.\)/g), cntE(t, /SPHERICAL_SURFACE\('',#\d+,3\.\)/g), r.stats.circles, cntE(t, /\bLINE\(/g)], exp: [24, 48, 26, 0, 1, 2, 0, 12, 8, 24, 24] };
}]);
SK.push(['STEP vero: foro cieco Ø8 con punta a 118° → CONICAL_SURFACE con semiangolo 59° esatto e cilindro R4; nessuna faccia a faccette', () => {
  const d = box(); const top = face(d, nearW([0, 1, 0], 10));
  const h = SB(); h.pt(40, 25, { hole: true }); feat(d, { type: 'hole', sketch: sketch(d, top, h), kind: 'simple', dia: 8, end: 'blind', depth: 6 });
  const r = stepX(d), m = r.text.match(/CONICAL_SURFACE\('',#\d+,([^,]+),([^)]+)\)/);
  return { ok: true, got: [m ? 1 : 0, m ? +m[2] : 0, cntE(r.text, /CYLINDRICAL_SURFACE\('',#\d+,4\.\)/g), r.stats.fallback, r.stats.badEdges + r.stats.openLoops], exp: [1, 59 * PI / 180, 1, 0, 0] };
}]);
SK.push(['STEP vero: due raccordi R4 che si incontrano ad angolo → il bordo tra i due cilindri è un\'ellisse (semiassi 4√2 e 4); nessuna faccia a faccette', () => {
  const d = box(); feat(d, { type: 'fillet', r: 4, edges: [edge(d, [40, 10, 0], 'line'), edge(d, [80, 10, -25], 'line')] });
  const r = stepX(d), m = r.text.match(/ELLIPSE\('',#\d+,([^,]+),([^)]+)\)/);
  return { ok: true, got: [r.stats.ellipses, m ? +m[1] : 0, m ? +m[2] : 0, cntE(r.text, /CYLINDRICAL_SURFACE/g), r.stats.fallback, r.stats.badEdges + r.stats.openLoops], exp: [1, 4 * Math.SQRT2, 4, 2, 0, 0] };
}]);
SK.push(['STEP vero: serie lineare di 4 fori (i tagli spezzano le faccette degli altri fori: vertici a T sulle corde) → 4 cilindri veri', () => {
  const c = CASES.find(x => /^Serie lineare 4 fori/.test(x.name)), r = stepX(c.build());
  return { ok: true, got: [cntE(r.text, /CYLINDRICAL_SURFACE\('',#\d+,4\.\)/g), r.stats.fallback, r.stats.badEdges + r.stats.openLoops, r.stats.faces], exp: [4, 0, 0, 10] };
}]);
SK.push(['STEP: cilindro R10 forato di traverso da un foro R4 (bordo tra i due cilindri = curva 3D) → B-spline: 2 cilindri veri, 2 bordi B-spline, nessuna faccia a faccette; solido chiuso', () => {
  const d = D0('perno'); const b = SB(); b.circle(0, 0, 10); feat(d, { type: 'extrude', sketch: sketch(d, STD('top'), b), end: 'blind', depth: 30 });
  const h = SB(); h.circle(0, 15, 4); feat(d, { type: 'cut', sketch: sketch(d, STD('front'), h), end: 'mid', depth: 40 });
  const r = stepX(d);
  return { ok: true, got: [r.stats.fallback, cntE(r.text, /CYLINDRICAL_SURFACE/g), r.stats.bsplines, cntE(r.text, /B_SPLINE_CURVE_WITH_KNOTS/g), r.stats.badEdges + r.stats.openLoops, r.stats.solids, r.stats.verts - r.stats.edges + r.stats.faces - r.stats.holes], exp: [0, 2, 2, 2, 0, 1, 0] };
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
// ---- Ambito funzione: errori e progetti vecchi ----
SK.push(['Ambito funzione: nessun corpo scelto, corpo sparito (errore chiaro), corpo in più (avviso); senza campo si taglia tutto come prima', () => {
  const errOf = d => { const st = Model.regen(d); return { e: [...st.errors.values()].join(), w: [...st.warn.values()].join(), V: Model.massProperties(st, d).volume, n: st.bodies.length }; };
  const none = errOf(scope2(() => [])), old = errOf(scope2(null));
  const d = D0('c'); const a = blk(d, 0, 0, 10, 10, 10), c = blk(d, 20, 0, 30, 10, 10, false); feat(d, { type: 'delbody', bodies: [a] }); const b = SB(); b.rect(5, 0, 25, 10); feat(d, { type: 'cut', sketch: sketch(d, STD('top'), b), end: 'through', both: true, scope: [a] });
  const gone = errOf(d);
  const d2 = D0('c'); const a2 = blk(d2, 0, 0, 10, 10, 10), c2 = blk(d2, 20, 0, 30, 10, 10, false); feat(d2, { type: 'delbody', bodies: [a2] }); const b2 = SB(); b2.rect(5, 0, 25, 10); feat(d2, { type: 'cut', sketch: sketch(d2, STD('top'), b2), end: 'through', both: true, scope: [a2, c2] });
  const part = errOf(d2);
  return { ok: true, exp: [1, 1, 1, 500, 1000, 2], got: [/almeno un corpo/.test(none.e) ? 1 : 0, /non esistono più/.test(gone.e) ? 1 : 0, /non esistono più/.test(part.w) ? 1 : 0, part.V, old.V, old.n] };
}]);

// ---- sfondo: tratteggi, tolleranze geometriche, richiami multipli, tabelle (valori a mano) ----
const dHatch = (loops, tail, extra = []) => ['0', 'HATCH', '8', '0', '10', 0, '20', 0, '30', 0, ...extra, '2', 'P', '70', tail.solid ? 1 : 0, '71', 0, '91', loops.length, ...loops.flat(), '75', tail.style || 0, '76', 1, ...(tail.solid ? [] : ['52', 0, '41', 1, '77', 0, '78', tail.pat.length, ...tail.pat.flatMap(p => ['53', p[0], '43', p[1], '44', p[2], '45', p[3], '46', p[4], '79', (p[5] || []).length, ...(p[5] || []).flatMap(x => ['49', x])])]), '98', 0];
const lPoly = (pts, fl = 1) => ['92', fl | 2, '72', pts.some(p => p[2]) ? 1 : 0, '73', 1, '93', pts.length, ...pts.flatMap(p => ['10', p[0], '20', p[1], ...(pts.some(q => q[2]) ? ['42', p[2] || 0] : [])]), '97', 0];
const sq = (a, b, fl) => lPoly([[a, a], [b, a], [b, b], [a, b]], fl);
const hLen = H => { let s = 0; for (let i = 0; i < H.length; i += 4) s += Math.hypot(H[i + 2] - H[i], H[i + 3] - H[i + 1]); return s; };
const loopArea = L => { let s = 0; for (let i = 0, n = L.length; i < n; i += 2) { const j = (i + 2) % n; s += L[i] * L[j + 1] - L[j] * L[i + 1]; } return Math.abs(s) / 2; };
const hatchOf = (ents, o) => { const r = MI.parseDXF(dxfFile(ents, o), { notes: true }); return { r, n: r.notes.find(x => x.hl) }; };
SK.push(['Sfondo, tratteggi: righe a passo 10 in un quadrato 100: 10 righe, 1000 mm; con un foro 20 × 20: 960; a tratti 6 + 4: 100 tratti, 600 mm; pieno senza righe', () => {
  const R = [[0, 0, 0, 0, 10]];
  const a = hatchOf([dHatch([sq(0, 100)], { pat: R })]), b = hatchOf([dHatch([sq(0, 100), sq(20, 40)], { pat: R })]), c = hatchOf([dHatch([sq(0, 100)], { pat: [[0, 0, 0, 0, 10, [6, -4]]] })]), d = hatchOf([dHatch([sq(0, 100)], { solid: true })]);
  const Ha = MI.hatchLines(a.n), Hb = MI.hatchLines(b.n), Hc = MI.hatchLines(c.n);
  return { ok: true, exp: [10, 1000, 960, 100, 600, 1, 0, 1, 1, 0], got: [Ha.length / 4, hLen(Ha), hLen(Hb), Hc.length / 4, hLen(Hc), a.r.noteCount.tratteggi, a.r.geo.length, d.n.hl.length, d.n.pat ? 0 : 1, MI.hatchLines(d.n).length] };
}]);
SK.push(['Sfondo, tratteggi: righe a 45° con passo 10 in un quadrato 100: lunghezza = area / passo (±1 %); il passo può spostare i tratti lungo la riga', () => {
  const s = Math.SQRT1_2 * 10, H = MI.hatchLines(hatchOf([dHatch([sq(0, 100)], { pat: [[45, 0, 0, -s, s]] })]).n);
  // seconda riga spostata di 3 lungo la direzione: a y = 10 i tratti 5 + 5 cominciano a x = 3
  const J = MI.hatchLines(hatchOf([dHatch([sq(0, 100)], { pat: [[0, 0, 0, 3, 10, [5, -5]]] })]).n);
  const row = []; for (let i = 0; i < J.length; i += 4) if (Math.abs(J[i + 1] - 10) < 1e-9) row.push(J[i], J[i + 2]);
  row.sort((a, b) => a - b);
  return { ok: true, exp: [10000 / 10, 1, 3, 8], got: [hLen(H), hLen(H) > 0 ? 1 : 0, row[row.length > 0 && row[0] === 0 ? 2 : 0], row[row.length > 0 && row[0] === 0 ? 3 : 1]] };
}]);
SK.push(['Sfondo, tratteggi: contorni con spigoli: polilinea curva (cerchio R10), arco antiorario, arco orario (angoli complementari), ellisse 20 × 10, spline (parabola)', () => {
  const area = lp => loopArea(hatchOf([dHatch([lp], { solid: true })]).n.hl[0]);
  const edges = (...e) => ['92', 1, '93', e.length, ...e.flat(), '97', 0];
  const L = (a, b, c, d) => ['72', 1, '10', a, '20', b, '11', c, '21', d];
  const A = (cx, cy, r, s, e, ccw) => ['72', 2, '10', cx, '20', cy, '40', r, '50', s, '51', e, '73', ccw];
  const circ = area(lPoly([[-10, 0, 1], [10, 0, 1]]));
  const up = area(edges(A(0, 0, 10, 0, 180, 1), L(-10, 0, 10, 0)));
  const cw = hatchOf([dHatch([edges(A(0, 0, 10, 180, 360, 0), L(10, 0, -10, 0))], { solid: true })]).n.hl[0];    // da 180° a 0° in senso orario: passa per (0, 10)
  const el = area(edges(['72', 3, '10', 0, '20', 0, '11', 20, '21', 0, '40', 0.5, '50', 0, '51', 360, '73', 1]));
  const sp = area(edges(['72', 4, '94', 2, '73', 0, '74', 0, '95', 6, '96', 3, '40', 0, '40', 0, '40', 0, '40', 1, '40', 1, '40', 1, '10', 0, '20', 0, '10', 10, '20', 20, '10', 20, '20', 0], L(20, 0, 0, 0)));
  const yMax = Math.max(...cw.filter((v, i) => i % 2));
  return { ok: true, exp: [Math.PI * 100, Math.PI * 50, Math.PI * 50, 10, Math.PI * 200, 2 / 3 * 20 * 10], got: [circ, up, loopArea(cw), yMax, el, sp] };
}]);
SK.push(['Sfondo, tratteggi: stili (normale, esterno, ignora) e dentro un blocco ruotato di 90° e scalato ×2; unità in cm; motivo troppo fitto', () => {
  const three = st => hatchOf([dHatch([sq(0, 100), sq(10, 90), sq(20, 80)], { solid: true, style: st })]).n.hl.length;
  const blocks = ['0', 'SECTION', '2', 'BLOCKS', '0', 'BLOCK', '2', 'H', '10', '0', '20', '0', ...dHatch([sq(0, 10)], { pat: [[0, 0, 0, 0, 2]] }).map(String), '0', 'ENDBLK', '0', 'ENDSEC'];
  const ins = hatchOf([['0', 'INSERT', '8', '0', '2', 'H', '10', 100, '20', 0, '41', 2, '42', 2, '50', 90]], { blocks });
  const H = MI.hatchLines(ins.n), xs = new Set(); for (let i = 0; i < H.length; i += 4) xs.add(Math.round(H[i] * 1e6) / 1e6);
  // quadrato 0..10 ruotato di 90° e raddoppiato sta in x 80..100, y 0..20; righe verticali a passo 4: 5 righe lunghe 20
  const box = [Math.min(...ins.n.hl[0].filter((v, i) => !(i % 2))), Math.max(...ins.n.hl[0].filter((v, i) => i % 2))];
  const cm = hatchOf([dHatch([sq(0, 10)], { pat: [[0, 0, 0, 0, 2, [1, -1]]] })], { units: 5 }), a = SB();
  MI.dxfToSketch(a.s, cm.r.geo.concat([{ t: 'line', a: [0, 0], b: [10, 0] }]), { scale: 10, notes: cm.r.notes, origin: 'file' });
  const n = a.s.bg.find(x => x.hl), c = MI.hatchLines(n), dense = MI.hatchLines(hatchOf([dHatch([sq(0, 100)], { pat: [[0, 0, 0, 0, 0.01]] })]).n, 1000);
  return { ok: true, exp: [3, 2, 1, 5, 100, 80, 20, 100, 20, 10, 1], got: [three(0), three(1), three(2), H.length / 4, hLen(H), box[0], box[1], Math.max(...n.hl[0]), n.pat[0].o[1], n.pat[0].d[0], dense === null ? 1 : 0, c.length ? 0 : 0].slice(0, 11) };
}]);
const dStyle = ['0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'DIMSTYLE', '0', 'DIMSTYLE', '2', 'ISO', '140', '2.5', '147', '0.625', '0', 'ENDTAB', '0', 'ENDSEC'];
SK.push(['Sfondo, tolleranza geometrica: cornice alta 2 volte il testo, a metà del lato sinistro; simbolo di posizione, valore, riferimento; ruotata di 90°', () => {
  const tol = dirn => ['0', 'TOLERANCE', '8', '0', '3', 'ISO', '10', 100, '20', 50, '30', 0, '1', '{\\Fgdt;j}%%v{\\Fgdt;n}0,1%%vA%%v%%v%%v', ...(dirn ? ['11', 0, '21', 1, '31', 0] : [])];
  const r = MI.parseDXF(dxfFile([tol()], { tables: dStyle }), { notes: true }), t = r.notes.filter(n => n.s !== undefined), b = r.notes.filter(n => n.p && n.p.length === 10), ci = r.notes.find(n => n.c);
  const r2 = MI.parseDXF(dxfFile([tol(true)], { tables: dStyle }), { notes: true }), b2 = r2.notes.find(n => n.p && n.p.length === 10);
  // ruotata di 90° attorno a (100, 50): (x, y) → (100 − y, 50 + x), quindi l'angolo (0, −2,5) va a (102,5; 50) e (5, 2,5) a (97,5; 55)
  const v = t.find(x => x.s === '0,1'), A = t.find(x => x.s === 'A');
  return { ok: true, exp: [1, 3, 100, 47.5, 105, 52.5, 102.5, 50, 0.9, 2.5, 48.75, 1, 0, 1, 102.5, 97.5, 55], got: [r.noteCount.tolleranze, b.length, b[0].p[0], b[0].p[1], b[0].p[4], b[0].p[5], ci.c[0], ci.c[1], ci.r, v.h, v.y, A ? 1 : 0, r.skipped.tolleranze || 0, r2.noteCount.tolleranze, b2.p[0], b2.p[4], b2.p[5]] };
}]);
const dMLeader = (extra, tail = []) => ['0', 'MULTILEADER', '8', '0', '270', 2, '300', 'CONTEXT_DATA{', '40', 1, '10', 0, '20', 0, '30', 0, '41', 4, '140', 3, '145', 2, ...extra, '302', 'LEADER{', '290', 1, '291', 1, '10', 30, '20', 40, '30', 0, '11', 1, '21', 0, '31', 0, '90', 0, '40', 5, '304', 'LEADER_LINE{', '10', 0, '20', 0, '30', 0, '91', 0, '305', '}', '271', 0, '303', '}', '272', 9, '273', 9, '301', '}', '340', '2AF', '170', 1, ...tail];
SK.push(['Sfondo, richiamo multiplo: linee (freccia, punto, tratto finale), freccia piena, testo su due righe; con un blocco al posto del testo; senza linee', () => {
  const txt = ['290', 1, '304', 'uno\\Pdue', '11', 0, '21', 0, '31', 1, '340', 11, '12', 37, '22', 42, '32', 0, '13', 1, '23', 0, '33', 0, '42', 0, '43', 50, '44', 0, '45', 1, '170', 1, '90', 0, '171', 1];
  const r = MI.parseDXF(dxfFile([dMLeader(txt)]), { notes: true }), p = r.notes.find(n => n.p), f = r.notes.find(n => n.f), T = r.notes.filter(n => n.s !== undefined);
  const blocks = ['0', 'SECTION', '2', 'BLOCKS', '0', 'BLOCK', '2', 'B', '330', '7F', '10', 1, '20', 1, ...dLine(1, 1, 3, 1).map(String), '0', 'ENDBLK', '0', 'ENDSEC'];
  const rb = MI.parseDXF(dxfFile([dMLeader(['290', 0, '341', '7F', '14', 0, '24', 0, '34', 1, '15', 50, '25', 60, '35', 0, '16', 2, '26', 2, '36', 1, '46', 0])], { blocks }), { notes: true });
  const pb = rb.notes.filter(n => n.p).find(n => n.p.length === 4);
  const r0 = MI.parseDXF(dxfFile([dMLeader(txt).map(String).join('\n').replace(/\n170\n1$/, '\n170\n0').split('\n')]), { notes: true });
  return { ok: true, exp: ['0,0,30,40,35,40', '0,0,1.4,2.7,2.6,1.8', 'uno', 38, 'due', 37, 4, 1, '50,60,54,60', 0],
    got: [p.p.join(), f.f.map(v => Math.round(v * 1e6) / 1e6).join(), T[0].s, T[0].y, T[1].s, T[0].x, T[0].h, r.noteCount.richiami, pb ? pb.p.join() : 'nessuno', r0.notes.filter(n => n.p).length] };
}]);
SK.push(['Sfondo, tabella: blocco anonimo spostato nel punto del file; senza blocco griglia e testi dalle misure; senza sfondo tabelle contate come saltate', () => {
  const blocks = ['0', 'SECTION', '2', 'BLOCKS', '0', 'BLOCK', '2', '*T1', '10', 0, '20', 0, ...dLine(0, 0, 20, 0).map(String), '0', 'MTEXT', '8', '0', '10', 5, '20', -5, '40', 3, '71', 1, '1', 'Pos', '0', 'ENDBLK', '0', 'ENDSEC'];
  const tb = (nm, x, y) => ['0', 'ACAD_TABLE', '8', '0', '2', nm, '10', x, '20', y, '30', 0, '11', 1, '21', 0, '31', 0, '91', 2, '92', 2, '141', 10, '141', 10, '142', 20, '142', 30, '171', 1, '1', 'A', '171', 1, '1', 'B', '171', 1, '171', 1, '1', 'D'];
  const r = MI.parseDXF(dxfFile([tb('*T1', 100, 200)], { blocks }), { notes: true }), l = r.notes.find(n => n.p), t = r.notes.find(n => n.s === 'Pos');
  const g = MI.parseDXF(dxfFile([tb('*NO', 5, 5)]), { notes: true }), T = g.notes.filter(n => n.s !== undefined), A = T.find(n => n.s === 'A'), D = T.find(n => n.s === 'D'), lin = g.notes.filter(n => n.p);
  const old = MI.parseDXF(dxfFile([tb('*T1', 100, 200)], { blocks }));
  return { ok: true, exp: ['100,200,120,200', 105, 195 - 3, 1, 3, 3 + 3, 15, 5 - 5 - 2, 40, 5 - 10 - 5 - 2, 1], got: [l.p.join(), t.x, t.y, r.noteCount.tabelle, T.length, lin.length, A.x, A.y, D.x, D.y, old.skipped.tabelle] };
}]);
// ---- sfondo di riferimento: testi e quote di DXF e DWG (valori calcolati a mano) ----
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e ? 1 : 0;
const noteOf = (ents, o = {}) => MI.parseDXF(dxfFile(ents, o), { notes: true });
const textsOf = r => r.notes.filter(n => n.s !== undefined);
SK.push(['Sfondo DXF: TEXT con codici, rotazione e allineamenti', () => {
  const t = (...kv) => ['0', 'TEXT', '8', '0', ...kv];
  const r = noteOf([
    t('10', 10, '20', 20, '40', 3.5, '50', 30, '1', '%%c20 %%p0,1 45%%d %%uX%%u 100%%%'),
    t('10', 0, '20', 0, '11', 50, '21', 40, '40', 2, '72', 1, '73', 3, '1', 'centro sopra'),   // base 2 più in basso del punto
    t('10', 0, '20', 0, '11', 50, '21', 40, '40', 4, '72', 2, '73', 1, '1', 'destra sotto'),   // base 0,25·4 = 1 più in alto
    t('10', 0, '20', 0, '11', 30, '21', 40, '40', 2, '72', 3, '1', 'allineato'),               // da (0,0) a (30,40): larghezza 50
    t('10', 0, '20', 0, '11', 50, '21', 40, '40', 6, '72', 4, '1', 'in mezzo'),                // base 3 più in basso
  ]), T = textsOf(r);
  return { ok: true, exp: [5, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    got: [r.noteCount.testi, T[0].s === 'Ø20 ±0,1 45° X 100%' ? 1 : 0, near(T[0].x, 10) * near(T[0].y, 20) * near(T[0].h, 3.5) * near(T[0].r, Math.PI / 6),
      near(T[1].x, 50) * near(T[1].y, 38) * (T[1].ha === 1 ? 1 : 0), near(T[2].x, 50) * near(T[2].y, 41) * (T[2].ha === 2 ? 1 : 0),
      near(T[3].fw, 50), near(T[3].r, Math.atan2(40, 30)), near(T[3].x, 0) * near(T[3].y, 0), near(T[4].y, 37) * (T[4].ha === 1 ? 1 : 0), r.geo.length === 0 ? 1 : 0] };
}]);
SK.push(['Sfondo DXF: testo dentro un blocco spostato, ruotato, scalato e specchiato', () => {
  const blocks = ['0', 'SECTION', '2', 'BLOCKS', '0', 'BLOCK', '2', 'B', '10', 5, '20', 5, '0', 'TEXT', '8', '0', '10', 15, '20', 5, '40', 2, '1', 'T', '0', 'ENDBLK', '0', 'ENDSEC'];
  const r = noteOf([['0', 'INSERT', '8', '0', '2', 'B', '10', 100, '20', 100, '41', 2, '42', 2, '50', 90], ['0', 'INSERT', '8', '0', '2', 'B', '10', 0, '20', 0, '41', -1, '42', 1]], { blocks }), T = textsOf(r);
  // (15,5) − base (5,5) = (10,0); ·2 = (20,0); ruotato di 90° = (0,20); + (100,100) = (100,120). Altezza 2·2 = 4.
  // Specchio: (−10,0), direzione (−1,0) = 180°, testo capovolto rispetto alla sua direzione.
  return { ok: true, exp: [2, 1, 1, 1, 1], got: [T.length, near(T[0].x, 100) * near(T[0].y, 120) * near(T[0].h, 4), near(T[0].r, Math.PI / 2) * (T[0].fy ? 0 : 1), near(T[1].x, -10) * near(T[1].y, 0) * near(T[1].h, 2), near(Math.abs(T[1].r), Math.PI) * (T[1].fy ? 1 : 0)] };
}]);
SK.push(['Sfondo DXF: MTEXT su più righe, punto di attacco, codici, pezzi, a capo', () => {
  const m = (...kv) => ['0', 'MTEXT', '8', '0', ...kv];
  const a = textsOf(noteOf([m('10', 100, '20', 200, '40', 10, '71', 5, '1', 'A\\PB\\PC')]));
  // righe distanti 10·5/3; altezza del blocco H = 10 + 2·10·5/3; prima base = centro + H/2 − 10
  const ls = 50 / 3, H = 10 + 2 * ls, y0 = 200 + H / 2 - 10;
  const b = textsOf(noteOf([m('10', 0, '20', 0, '40', 3, '71', 7, '44', 2, '1', 'A\\PB')]));   // sotto: ultima base sul punto; righe distanti 3·5/3·2 = 10
  const c = textsOf(noteOf([m('10', 0, '20', 0, '40', 3, '71', 1, '11', 0, '21', 2, '1', 'Q')]));   // attacco in alto a sinistra, testo verso +Y: base 3 più a destra
  const d = textsOf(noteOf([m('10', 0, '20', 0, '40', 3, '3', 'uno ', '1', 'due')]));
  const e = MI.mtextLines('{\\fArial|b1;Ø\\H0.7x;20}\\~mm \\S1^2;\\U+00B1\\\\ %%c', 0, 1)[0];
  const f = MI.mtextLines('uno due tre quattro', 40, 5);   // una lettera ≈ 0,7·5 = 3,5: 11 lettere per riga
  return { ok: true, exp: [3, 1, 1, 1, 1, 1, 1, 1, 1], got: [a.length, near(a[0].y, y0) * near(a[1].y, y0 - ls) * near(a[2].y, y0 - 2 * ls), a.every(t => t.ha === 1 && near(t.x, 100)) ? 1 : 0,
    near(b[0].y, 10) * near(b[1].y, 0), near(c[0].x, -(-3)) * near(c[0].y, 0) * near(c[0].r, Math.PI / 2), d[0].s === 'uno due' ? 1 : 0, e === 'Ø20 mm 1/2±\\ Ø' ? 1 : 0, f.join('|') === 'uno due tre|quattro' ? 1 : 0, MI.mtextLines('{\\C1;rosso}', 0, 1)[0] === 'rosso' ? 1 : 0] };
}]);
SK.push(['Sfondo DXF: la quota si disegna dal suo blocco, nel posto giusto', () => {
  const blocks = ['0', 'SECTION', '2', 'BLOCKS', '0', 'BLOCK', '2', '*D1', '10', 0, '20', 0,
    '0', 'LINE', '8', '0', '10', 0, '20', 0, '11', 10, '21', 0,
    '0', 'SOLID', '8', '0', '10', 0, '20', 0, '11', 2, '21', 1, '12', 2, '22', -1, '13', 2, '23', -1,
    '0', 'ARC', '8', '0', '10', 5, '20', 5, '40', 2, '50', 0, '51', 90,
    '0', 'POINT', '8', 'Defpoints', '10', 0, '20', 0,
    '0', 'MTEXT', '8', '0', '10', 5, '20', 1, '40', 2.5, '71', 8, '1', '\\A1;%%c10', '0', 'ENDBLK', '0', 'ENDSEC'];
  const r = noteOf([['0', 'DIMENSION', '8', '0', '2', '*D1', '12', 100, '22', 50, '42', 10]], { blocks });
  const ln = r.notes.find(n => n.p), fi = r.notes.find(n => n.f), ar = r.notes.find(n => n.c), T = textsOf(r);
  // senza blocco: il numero misurato (42) nel punto del testo; «<>» è il numero misurato
  const r2 = noteOf([['0', 'DIMENSION', '8', '0', '2', '*X', '11', 3, '21', 4, '42', 12.5, '53', 90, '1', 'L=<>']]), t2 = textsOf(r2)[0];
  const r3 = noteOf([['0', 'DIMENSION', '8', '0']]);
  return { ok: true, exp: [1, 1, 1, 1, 1, 1, 1, 1, 0, 1], got: [r.noteCount.quote, r.geo.length === 0 ? 1 : 0, ln.p.join() === '100,50,110,50' ? 1 : 0, fi.f.join() === '100,50,102,51,102,49,102,49' ? 1 : 0,
    near(ar.c[0], 105) * near(ar.c[1], 55) * near(ar.r, 2) * near(ar.a0, 0) * near(ar.a1, Math.PI / 2), T.length === 1 && T[0].s === 'Ø10' && near(T[0].x, 105) * near(T[0].y, 51) * near(T[0].h, 2.5) && T[0].ha === 1 ? 1 : 0, t2.s === 'L=12,5' && near(t2.x, 3) * near(t2.y, 4) * near(t2.r, Math.PI / 2) ? 1 : 0, r3.noteCount.quote, r3.notes.length, r2.noteCount.quote] };
}]);
SK.push(['Sfondo DXF: layer scelti, attributi nascosti, fogli di layout; senza richiesta restano saltati', () => {
  const ents = [['0', 'TEXT', '8', 'QUOTE', '10', 0, '20', 0, '40', 1, '1', 'a'], ['0', 'TEXT', '8', 'PEZZO', '10', 0, '20', 0, '40', 1, '1', 'b'], ['0', 'TEXT', '8', 'PEZZO', '67', 1, '10', 0, '20', 0, '40', 1, '1', 'foglio'],
    ['0', 'ATTRIB', '8', 'PEZZO', '70', 1, '10', 0, '20', 0, '40', 1, '1', 'nascosto'], ['0', 'ATTRIB', '8', 'PEZZO', '70', 0, '10', 0, '20', 0, '40', 1, '1', 'c'], ['0', 'TEXT', '8', 'PEZZO', '10', 0, '20', 0, '40', 1, '1', '  '],
    ['0', 'LEADER', '8', 'PEZZO', '10', 0, '20', 0, '10', 5, '20', 5, '10', 9, '20', 5]];
  const r = MI.parseDXF(dxfFile(ents), { notes: true, layers: ['PEZZO'] }), old = MI.parseDXF(dxfFile(ents));
  return { ok: true, exp: [1, 1, 3, 2, 1, 0, 1, 1], got: [textsOf(r).map(t => t.s).join() === 'b,c' ? 1 : 0, r.noteCount.richiami, old.skipped.testi - 1, r.noteCount.testi, r.notes.find(n => n.p).p.join() === '0,0,5,5,9,5' ? 1 : 0, old.notes.length, old.skipped.quote === undefined ? 1 : 0, old.skipped.richiami] };
}]);
SK.push(['Sfondo DXF: accenti nei file UTF-8 (dal 2007) e Windows-1252 (prima)', () => {
  const head = (ver, cp) => ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', ver, '9', '$DWGCODEPAGE', '3', cp, '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES', '0', 'TEXT', '8', '0', '10', 0, '20', 0, '40', 1, '1'].join('\r\n') + '\r\n';
  const tail = '\r\n0\r\nENDSEC\r\n0\r\nEOF';
  const utf = new TextEncoder().encode(head('AC1027', 'ANSI_1252') + 'Perché €' + tail);
  const win = Uint8Array.from(head('AC1018', 'ANSI_1252') + 'Perché \u0080' + tail, ch => ch.charCodeAt(0));
  const bad = Uint8Array.from(head('AC1027', 'ANSI_1252') + 'Perché' + tail, ch => ch.charCodeAt(0));   // dichiarato UTF-8 ma non lo è: non si perde il testo
  const s = u => textsOf(MI.parseDXF(u, { notes: true }))[0].s;
  return { ok: true, exp: [1, 1, 1], got: [s(utf) === 'Perché €' ? 1 : 0, s(win) === 'Perché €' ? 1 : 0, s(bad) === 'Perché' ? 1 : 0] };
}]);
SK.push(['Sfondo DXF: l\'inquadratura comprende le quote intorno al pezzo, non un testo lontanissimo', () => {
  const near1 = MI.notesBox([{ p: [0, -15, 100, -15] }, { s: 'AB', x: 110, y: 10, h: 2 }], [0, 0], [100, 60]);    // AB: lungo 2·0,7·2 = 2,8
  const far = MI.notesBox([{ s: 'A', x: 972635, y: -320368, h: 184349 }, { p: [0, -26, 100, -26] }], [0, 0], [100, 60]);   // oltre 25 dalla geometria: non contano
  return { ok: true, exp: [1, 1, 1], got: [near(near1.mn[1], -15) * near(near1.mn[0], 0), near(near1.mx[0], 112.8) * near(near1.mx[1], 60), near(far.mx[0], 100) * near(far.mn[1], 0) * near(far.mx[1], 60) * near(far.mn[0], 0)] };
}]);
SK.push(['Sfondo DXF nello schizzo: stessa origine e scala; geometria, stato e contorni identici a quelli senza sfondo', () => {
  const blocks = ['0', 'SECTION', '2', 'BLOCKS', '0', 'BLOCK', '2', '*D1', '10', 0, '20', 0, '0', 'LINE', '8', '0', '10', 50, '20', 18, '11', 60, '21', 18, '0', 'CIRCLE', '8', '0', '10', 52, '20', 23, '40', 1, '0', 'ENDBLK', '0', 'ENDSEC'];
  // piastra 10 × 6 cm con l'angolo in (50,20) cm
  const file = dxfFile([dLine(50, 20, 60, 20), dLine(60, 20, 60, 26), dLine(60, 26, 50, 26), dLine(50, 26, 50, 20), ['0', 'TEXT', '8', '0', '10', 52, '20', 23, '40', 0.5, '41', 0.8, '1', 'PIASTRA'], ['0', 'DIMENSION', '8', '0', '2', '*D1']], { units: 5, blocks });
  const r = MI.parseDXF(file, { notes: true }), r0 = MI.parseDXF(file), a = SB(), b = SB();
  const o = { scale: MI.DXF_SCALE.cm, origin: 'corner' };
  MI.dxfToSketch(a.s, r.geo, { ...o, notes: r.notes }); MI.dxfToSketch(b.s, r0.geo, o);
  const bg = a.s.bg, t = bg.find(n => n.s), l = bg.find(n => n.p), c = bg.find(n => n.c);
  const same = JSON.stringify(a.s.ents) === JSON.stringify(b.s.ents) && JSON.stringify(a.s.cons) === JSON.stringify(b.s.cons) && a.s.next === b.s.next;
  const an = Sketch.analyze(a.s), an0 = Sketch.analyze(b.s), pr = Sketch.profiles(a.s), pr0 = Sketch.profiles(b.s);
  // un secondo disegno nello stesso schizzo si aggiunge; il progetto salvato e riletto lo conserva
  const nBg = bg.length; MI.dxfToSketch(a.s, r.geo, { ...o, notes: r.notes });
  const back = JSON.parse(JSON.stringify(a.s));
  return { ok: true, exp: [1, 1, 1, 1, 1, 1, 1, 6000, 1, 1], got: [same ? 1 : 0, near(t.x, 20) * near(t.y, 30), near(t.h, 5) * near(t.w, 0.8), l.p.join() === '0,-20,100,-20' ? 1 : 0, c.c.join() === '20,30' && near(c.r, 10) ? 1 : 0,
    an.dof === an0.dof && an.status === an0.status ? 1 : 0, b.s.bg === undefined ? 1 : 0, pr.regions.reduce((s, x) => s + x.area, 0), pr.regions.length === pr0.regions.length ? 1 : 0, back.bg.length === 2 * nBg ? 1 : 0] };
}]);

/* ---------- assiemi: posizioni e gradi di libertà calcolati a mano ---------- */
const ASM = [];
const asmSet = docs => { const infos = new Map(); for (const k in docs) infos.set(k, Assembly.partInfo(docs[k])); return infos; };
const asmFace = (doc, n, w) => ({ k: 'face', name: face(doc, nearW(n, w)).name });
const asmRev = (doc, i = 0) => { const st = Model.regen(doc); const ids = [...new Set(st.body.map(p => p.t))].filter(t => st.tags.get(t).kind === 'rev'); return { k: 'face', name: st.tags.get(ids[i]).name }; };
const asmEdge = (doc, p, kind) => ({ k: 'edge', ...edge(doc, p, kind) });
const asmPose = (p, q) => ({ p, q: q || [1, 0, 0, 0] });
const rotY = a => Assembly.qexp([0, a, 0]), rotZ = a => Assembly.qexp([0, 0, a]);
// mate: elementi A (di ia) e B (di ib); verso e lato si danno a mano, altrimenti quelli più vicini alla posizione attuale
function asmMate(asm, infos, type, ia, ra, ib, rb, extra = {}) {
  const a = { inst: ia.id, ...ra }, b = { inst: ib.id, ...rb };
  const EA = Assembly.worldEnt(Assembly.entityOf(a, infos.get(ia.part)), ia.pose), EB = Assembly.worldEnt(Assembly.entityOf(b, infos.get(ib.part)), ib.pose);
  const m = { id: Assembly.uid(asm, 'M'), type, a, b, ...Assembly.mateDefaults(type, EA, EB), ...extra };
  asm.mates.push(m);
  return m;
}
// ingombro vero di un componente: dai vertici della scena, non dalle equazioni del risolutore
function asmBox(asm, infos, inst) {
  const s = Assembly.scene(asm, infos), b = s.bodies.find(x => x.id === inst.id);
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const p of b.polys) for (const v of p.v) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], v[k]); mx[k] = Math.max(mx[k], v[k]); }
  return [...mn, ...mx];
}
const asmNormal = (asm, infos, inst, ref) => { const s = Assembly.scene(asm, infos); return s.tags.byName.get(inst.id + '/' + ref.name).n; };
function plateHole(L, W, H, cx, cy, r) { const d = D0('piastra'); const b = SB(); b.rect(0, 0, L, W); b.circle(cx, cy, r); const s = sketch(d, STD('top'), b); feat(d, { type: 'extrude', sketch: s, end: 'blind', depth: H }); return d; }
function pin(r, h) { const d = D0('perno'); const b = SB(); b.circle(0, 0, r); const s = sketch(d, STD('top'), b); feat(d, { type: 'extrude', sketch: s, end: 'blind', depth: h }); return d; }
const eqs = (got, exp, tol = 1e-6) => ({ got, exp, tol });
// due blocchi 80×50×10: A fermo, B libero in (200, 50, 30): x 200..280, y 50..60, z -20..30
function twoBlocks(pose) {
  const docs = { a: box(), b: box() }, infos = asmSet(docs), asm = Assembly.newAssembly();
  const A = Assembly.addInst(asm, 'a'), B = Assembly.addInst(asm, 'b', { pose: pose || asmPose([200, 50, 30]) });
  return { docs, infos, asm, A, B };
}
const UP = [0, 1, 0], DN = [0, -1, 0], XM = [-1, 0, 0], ZP = [0, 0, 1];
ASM.push(['Coincidente faccia-faccia: B si appoggia su A e si muove solo in Y (y 10..20, x e z invariati); 3 gradi di libertà', () => {
  const t = twoBlocks(); asmMate(t.asm, t.infos, 'coincident', t.A, asmFace(t.docs.a, UP, 10), t.B, asmFace(t.docs.b, DN, 0));
  const r = Assembly.solve(t.asm, t.infos);
  return eqs([...asmBox(t.asm, t.infos, t.B), r.dof.total, r.dof.byInst.get(t.B.id), r.ok ? 1 : 0], [200, 10, -20, 280, 20, 30, 3, 3, 1]);
}]);
ASM.push(['Tre facce coincidenti in fila: 3 → 1 → 0 gradi di libertà (la seconda toglie uno spostamento e la rotazione); B esattamente sopra A (x 0..80, y 10..20, z -50..0)', () => {
  const t = twoBlocks(), out = [];
  asmMate(t.asm, t.infos, 'coincident', t.A, asmFace(t.docs.a, UP, 10), t.B, asmFace(t.docs.b, DN, 0)); out.push(Assembly.solve(t.asm, t.infos).dof.total);
  asmMate(t.asm, t.infos, 'coincident', t.A, asmFace(t.docs.a, XM, 0), t.B, asmFace(t.docs.b, XM, 0), { s: 1 }); out.push(Assembly.solve(t.asm, t.infos).dof.total);
  asmMate(t.asm, t.infos, 'coincident', t.A, asmFace(t.docs.a, ZP, 0), t.B, asmFace(t.docs.b, ZP, 0), { s: 1 }); out.push(Assembly.solve(t.asm, t.infos).dof.total);
  return eqs([...out, ...asmBox(t.asm, t.infos, t.B)], [3, 1, 0, 0, 10, -50, 80, 20, 0]);
}]);
ASM.push(['Coincidente con il verso invertito: partendo dal punto morto B si capovolge (normale +Y, y 0..10)', () => {
  const t = twoBlocks(); const fb = asmFace(t.docs.b, DN, 0);
  asmMate(t.asm, t.infos, 'coincident', t.A, asmFace(t.docs.a, UP, 10), t.B, fb, { s: 1 });
  const r = Assembly.solve(t.asm, t.infos), b = asmBox(t.asm, t.infos, t.B);
  return eqs([...asmNormal(t.asm, t.infos, t.B, fb), b[1], b[4], r.dof.total, r.ok ? 1 : 0], [0, 1, 0, 0, 10, 3, 1]);
}]);
ASM.push(['Concentrico: perno Ø20 nel foro Ø20 in (40, -25): 2 gradi di libertà; con la base su A 1 solo; y 10..40', () => {
  const docs = { a: plateHole(80, 50, 10, 40, 25, 10), b: pin(10, 30) }, infos = asmSet(docs), asm = Assembly.newAssembly();
  const A = Assembly.addInst(asm, 'a'), B = Assembly.addInst(asm, 'b', { pose: asmPose([150, 0, 60]) });
  asmMate(asm, infos, 'concentric', A, asmRev(docs.a), B, asmRev(docs.b));
  const d1 = Assembly.solve(asm, infos).dof.total, b1 = asmBox(asm, infos, B);
  asmMate(asm, infos, 'coincident', A, asmFace(docs.a, UP, 10), B, asmFace(docs.b, DN, 0));
  const d2 = Assembly.solve(asm, infos).dof.total, b2 = asmBox(asm, infos, B);
  return eqs([d1, (b1[0] + b1[3]) / 2, (b1[2] + b1[5]) / 2, b1[1], b1[4], d2, b2[1], b2[4], (b2[0] + b2[3]) / 2, (b2[2] + b2[5]) / 2], [2, 40, -25, 0, 30, 1, 10, 40, 40, -25]);
}]);
ASM.push(['Concentrico con il verso invertito: il perno si gira (normale della base +Y) e resta sull\'asse', () => {
  const docs = { a: plateHole(80, 50, 10, 40, 25, 10), b: pin(10, 30) }, infos = asmSet(docs), asm = Assembly.newAssembly();
  const A = Assembly.addInst(asm, 'a'), B = Assembly.addInst(asm, 'b', { pose: asmPose([40, 0, -25]) }); const fb = asmFace(docs.b, DN, 0);
  const m = asmMate(asm, infos, 'concentric', A, asmRev(docs.a), B, asmRev(docs.b));
  m.s = -m.s;
  const r = Assembly.solve(asm, infos), bx = asmBox(asm, infos, B);
  return eqs([...asmNormal(asm, infos, B, fb), (bx[0] + bx[3]) / 2, (bx[2] + bx[5]) / 2, r.dof.total], [0, 1, 0, 40, -25, 2]);
}]);
ASM.push(['Coincidente spigolo circolare-spigolo circolare: stesso centro e stesso piano (perno sul foro), 1 grado di libertà', () => {
  const docs = { a: plateHole(80, 50, 10, 40, 25, 10), b: pin(10, 30) }, infos = asmSet(docs), asm = Assembly.newAssembly();
  const A = Assembly.addInst(asm, 'a'), B = Assembly.addInst(asm, 'b', { pose: asmPose([150, 7, 60]) });
  asmMate(asm, infos, 'coincident', A, asmEdge(docs.a, [50, 10, -25], 'circle'), B, asmEdge(docs.b, [10, 0, 0], 'circle'));
  const r = Assembly.solve(asm, infos), b = asmBox(asm, infos, B);
  return eqs([(b[0] + b[3]) / 2, (b[2] + b[5]) / 2, b[1], b[4], r.dof.total], [40, -25, 10, 40, 1]);
}]);
ASM.push(['Spigolo tra un cono e un piano (smusso): il centro viene dai punti del bordo, sull\'asse del perno', () => {
  const dp = pin(10, 30); feat(dp, { type: 'chamfer', d: 2, edges: [edge(dp, [10, 30, 0], 'circle')] });
  const docs = { a: plateHole(80, 50, 10, 40, 25, 10), b: dp }, infos = asmSet(docs), asm = Assembly.newAssembly();
  const A = Assembly.addInst(asm, 'a'), B = Assembly.addInst(asm, 'b', { pose: asmPose([150, 0, 60]) });
  // lo spigolo tra il cono e la faccia in cima: edgeGeometry non lo conosce, quindi qui si cerca nei gruppi
  const st0 = Model.regen(dp), g0 = [...Model.edgeGroups(st0, st0.topo).values()].find(g => g.segs.every(e => Math.abs(st0.topo.verts[e.a][1] - 30) < 1e-9 && Math.abs(Math.hypot(st0.topo.verts[e.a][0], st0.topo.verts[e.a][2]) - 8) < 1e-9));
  const ed = { k: 'edge', a: st0.tags.get(g0.t1).name, b: st0.tags.get(g0.t2).name, p: [8, 30, 0] };
  const E = Assembly.entityOf({ inst: B.id, ...ed }, infos.get('b'));
  asmMate(asm, infos, 'coincident', A, asmEdge(docs.a, [50, 10, -25], 'circle'), B, ed);
  const r = Assembly.solve(asm, infos), b = asmBox(asm, infos, B);
  return eqs([E.R, E.o[0], E.o[1], E.o[2], (b[0] + b[3]) / 2, (b[2] + b[5]) / 2, b[1], r.ok ? 1 : 0], [8, 0, 30, 0, 40, -25, -20, 1]);
}]);
ASM.push(['Concentrico tra due sfere R10: centri uguali, 3 gradi di libertà', () => {
  const sph = () => revDoc(b => { const c = b.pt(0, 0), a = b.pt(0, -10), e = b.pt(0, 10); b.arc(c, a, e); b.line(e, a); });
  const docs = { a: sph(), b: sph() }, infos = asmSet(docs), asm = Assembly.newAssembly();
  const A = Assembly.addInst(asm, 'a'), B = Assembly.addInst(asm, 'b', { pose: asmPose([50, 20, -30]) });
  const m = asmMate(asm, infos, 'concentric', A, asmRev(docs.a), B, asmRev(docs.b));
  const E = Assembly.entityOf(m.a, infos.get('a')), r = Assembly.solve(asm, infos), b = asmBox(asm, infos, B), a = asmBox(asm, infos, A);
  return eqs([E.sphere ? 1 : 0, E.R, r.dof.total, (b[0] + b[3]) / 2 - (a[0] + a[3]) / 2, (b[1] + b[4]) / 2 - (a[1] + a[4]) / 2, (b[2] + b[5]) / 2 - (a[2] + a[5]) / 2], [1, 10, 3, 0, 0, 0], 1e-3);
}]);
ASM.push(['Parallelo: B ruotato di 30° attorno a Z torna con la faccia superiore +Y, senza spostare il centro; 4 gradi di libertà', () => {
  const t = twoBlocks(asmPose([200, 50, 30], rotZ(PI / 6))); const fb = asmFace(t.docs.b, UP, 10);
  const c0 = Assembly.toWorld(t.B.pose, t.infos.get('b').c);
  asmMate(t.asm, t.infos, 'parallel', t.A, asmFace(t.docs.a, UP, 10), t.B, fb);
  const r = Assembly.solve(t.asm, t.infos), c1 = Assembly.toWorld(t.B.pose, t.infos.get('b').c);
  return eqs([...asmNormal(t.asm, t.infos, t.B, fb), ...c1, r.dof.total], [0, 1, 0, ...c0, 4]);
}]);
ASM.push(['Perpendicolare: da 30° a 90° (rotazione minima attorno a Z, normale −X), centro fermo; 5 gradi di libertà', () => {
  const t = twoBlocks(asmPose([200, 50, 30], rotZ(PI / 6))); const fb = asmFace(t.docs.b, UP, 10);
  const c0 = Assembly.toWorld(t.B.pose, t.infos.get('b').c);
  asmMate(t.asm, t.infos, 'perpendicular', t.A, asmFace(t.docs.a, UP, 10), t.B, fb);
  const r = Assembly.solve(t.asm, t.infos), c1 = Assembly.toWorld(t.B.pose, t.infos.get('b').c);
  return eqs([...asmNormal(t.asm, t.infos, t.B, fb), ...c1, r.dof.total], [-1, 0, 0, ...c0, 5]);
}]);
ASM.push(['Distanza 25 tra due facce: y 35..45; con il lato invertito -15..-5; 3 gradi di libertà', () => {
  const t = twoBlocks(), m = asmMate(t.asm, t.infos, 'distance', t.A, asmFace(t.docs.a, UP, 10), t.B, asmFace(t.docs.b, DN, 0), { value: 25 });
  const r1 = Assembly.solve(t.asm, t.infos), b1 = asmBox(t.asm, t.infos, t.B);
  m.side = -m.side;
  Assembly.solve(t.asm, t.infos); const b2 = asmBox(t.asm, t.infos, t.B);
  return eqs([b1[1], b1[4], b2[1], b2[4], r1.dof.total], [35, 45, -15, -5, 3]);
}]);
ASM.push(['Distanza 25 tra due vertici e 60 tra due assi: misure rilette dalla scena', () => {
  const t = twoBlocks(asmPose([200, 50, 30]));
  const v0 = { k: 'vertex', p: [80, 10, 0] }, v1 = { k: 'vertex', p: [0, 0, 0] };
  asmMate(t.asm, t.infos, 'distance', t.A, v0, t.B, v1, { value: 25 });
  const r = Assembly.solve(t.asm, t.infos);
  const d = Math.hypot(...[0, 1, 2].map(k => Assembly.toWorld(t.B.pose, v1.p)[k] - v0.p[k]));
  const docs = { a: plateHole(80, 50, 10, 40, 25, 10), b: pin(10, 30) }, infos = asmSet(docs), asm = Assembly.newAssembly();
  const A = Assembly.addInst(asm, 'a'), B = Assembly.addInst(asm, 'b', { pose: asmPose([150, 0, 60]) });
  asmMate(asm, infos, 'distance', A, asmRev(docs.a), B, asmRev(docs.b), { value: 60 });
  const r2 = Assembly.solve(asm, infos), bb = asmBox(asm, infos, B);
  const da = Math.hypot((bb[0] + bb[3]) / 2 - 40, (bb[2] + bb[5]) / 2 + 25);
  return eqs([d, r.dof.total, da, r2.dof.total], [25, 5, 60, 3]);
}]);
ASM.push(['Cerniera: concentrico, facce a contatto e angolo 30°: estremo del braccio calcolato a mano; 0 gradi di libertà', () => {
  const docs = { a: plateHole(120, 20, 10, 10, 10, 5), b: plateHole(120, 20, 10, 10, 10, 5) }, infos = asmSet(docs), asm = Assembly.newAssembly();
  const A = Assembly.addInst(asm, 'a');
  // posizione di partenza: 10° attorno a Y, attorno al centro del foro
  const q = rotY(10 * PI / 180), h = [10, 0, -10], rh = Assembly.qrot(q, h);
  const B = Assembly.addInst(asm, 'b', { pose: asmPose([h[0] - rh[0], 40 - rh[1], h[2] - rh[2]], q) });
  asmMate(asm, infos, 'concentric', A, asmRev(docs.a), B, asmRev(docs.b), { s: 1 });
  asmMate(asm, infos, 'coincident', A, asmFace(docs.a, UP, 10), B, asmFace(docs.b, DN, 0), { s: -1 });
  const d1 = Assembly.solve(asm, infos).dof.total;
  asmMate(asm, infos, 'angle', A, asmFace(docs.a, ZP, 0), B, asmFace(docs.b, ZP, 0), { value: 30 });
  const r = Assembly.solve(asm, infos);
  // vertice (120, 10, 0): rispetto al foro (110, 10, 10); rotazione +30° attorno a Y: x' = x cos + z sin, z' = -x sin + z cos
  const c = Math.cos(PI / 6), s = Math.sin(PI / 6), tip = Assembly.toWorld(B.pose, [120, 10, 0]);
  return eqs([d1, r.dof.total, ...tip], [1, 0, 10 + 110 * c + 10 * s, 20, -10 - 110 * s + 10 * c]);
}]);
ASM.push(['Gradi di libertà di ogni coppia di elementi (tabella scritta a mano)', () => {
  const v0 = { k: 'vertex', p: [80, 10, 0] }, v1 = { k: 'vertex', p: [0, 0, 0] };
  const got = [], exp = [];
  const row = (type, ra, rb, n, extra) => { const t = twoBlocks(asmPose([200, 50, 30], Assembly.qnorm(Assembly.qmul(rotY(0.2), rotZ(0.3))))); const fa = typeof ra === 'function' ? ra(t.docs.a) : ra, fb = typeof rb === 'function' ? rb(t.docs.b) : rb; asmMate(t.asm, t.infos, type, t.A, fa, t.B, fb, extra); const r = Assembly.solve(t.asm, t.infos); got.push(r.dof.total, r.ok ? 1 : 0); exp.push(n, 1); };
  const fT = d => asmFace(d, UP, 10), fB = d => asmFace(d, DN, 0), eL = d => asmEdge(d, [40, 10, 0], 'line');
  row('coincident', v0, v1, 3); row('coincident', fT, v1, 5); row('coincident', eL, eL, 2); row('coincident', fT, eL, 4); row('coincident', eL, v1, 4);
  row('parallel', eL, eL, 4); row('perpendicular', eL, eL, 5); row('parallel', fT, eL, 5); row('perpendicular', fT, eL, 4);
  row('distance', v0, v1, 5, { value: 25 }); row('distance', fT, v1, 5, { value: 25 }); row('distance', fT, eL, 4, { value: 25 }); row('distance', eL, eL, 3, { value: 25 }); row('distance', eL, v1, 5, { value: 25 });
  row('angle', fT, fB, 5, { value: 40 }); row('angle', eL, eL, 5, { value: 40 }); row('angle', fT, eL, 5, { value: 40 });
  // 0° e 180° tolgono 2 gradi come il parallelo
  row('angle', fT, fB, 4, { value: 0 }); row('angle', fT, fB, 4, { value: 180 });
  return eqs(got, exp);
}]);
ASM.push(['Accoppiamenti che si contraddicono: il secondo è segnato, il primo resta (y 10..20); parti ferme tutte e due: segnato', () => {
  const t = twoBlocks();
  const m1 = asmMate(t.asm, t.infos, 'coincident', t.A, asmFace(t.docs.a, UP, 10), t.B, asmFace(t.docs.b, DN, 0));
  const m2 = asmMate(t.asm, t.infos, 'distance', t.A, asmFace(t.docs.a, UP, 10), t.B, asmFace(t.docs.b, DN, 0), { value: 5, side: 1 });
  const r = Assembly.solve(t.asm, t.infos), b = asmBox(t.asm, t.infos, t.B);
  const u = twoBlocks(); u.B.fixed = true;
  asmMate(u.asm, u.infos, 'coincident', u.A, asmFace(u.docs.a, UP, 10), u.B, asmFace(u.docs.b, DN, 0));
  const r2 = Assembly.solve(u.asm, u.infos);
  return eqs([r.ok ? 1 : 0, r.status.get(m1.id).ok ? 1 : 0, r.status.get(m2.id).ok ? 1 : 0, b[1], b[4], r2.ok ? 1 : 0, r2.dof.total], [0, 1, 0, 10, 20, 0, 0]);
}]);
ASM.push(['Catena: A fermo, B su A, C su B: 6 gradi in tutto, 3 per B e 3 per C; senza accoppiamenti 6 e parte fissa 0', () => {
  const docs = { a: box(), b: box(), c: box() }, infos = asmSet(docs), asm = Assembly.newAssembly();
  const A = Assembly.addInst(asm, 'a'), B = Assembly.addInst(asm, 'b', { pose: asmPose([200, 50, 30]) }), C = Assembly.addInst(asm, 'c', { pose: asmPose([-100, 90, 10]) });
  const r0 = Assembly.solve(asm, infos);
  asmMate(asm, infos, 'coincident', A, asmFace(docs.a, UP, 10), B, asmFace(docs.b, DN, 0));
  asmMate(asm, infos, 'coincident', B, asmFace(docs.b, UP, 10), C, asmFace(docs.c, DN, 0));
  const r = Assembly.solve(asm, infos), cb = asmBox(asm, infos, C);
  return eqs([r0.dof.byInst.get(A.id), r0.dof.byInst.get(B.id), r0.dof.total, r.dof.total, r.dof.byInst.get(A.id), r.dof.byInst.get(B.id), r.dof.byInst.get(C.id), cb[1], cb[4]], [0, 6, 12, 6, 0, 3, 3, 20, 30]);
}]);
ASM.push(['Copie: stessa parte due volte: volume 2·40000, spigoli doppi; una parte rimane ferma dove la si mette', () => {
  const docs = { a: box() }, infos = asmSet(docs), asm = Assembly.newAssembly();
  const A = Assembly.addInst(asm, 'a'), B = Assembly.addInst(asm, 'a', { pose: asmPose([100, 0, 0], rotZ(0.4)) });
  const s = Assembly.scene(asm, infos), st = infos.get('a').st;
  const p0 = JSON.stringify(B.pose); Assembly.solve(asm, infos);
  return eqs([Geom.massProps(s.body, s.tags).volume, s.body.length, s.topo.edges.filter(e => e.sharp).length, A.n, B.n, p0 === JSON.stringify(B.pose) ? 1 : 0], [80000, 2 * st.body.length, 2 * st.topo.edges.filter(e => e.sharp).length, 1, 2, 1]);
}]);
ASM.push(['Parte modificata: A da 10 a 25 mm di altezza, B si riporta sulla faccia nuova (y 25..35)', () => {
  const t = twoBlocks(); asmMate(t.asm, t.infos, 'coincident', t.A, asmFace(t.docs.a, UP, 10), t.B, asmFace(t.docs.b, DN, 0));
  Assembly.solve(t.asm, t.infos);
  t.docs.a.features.find(f => f.type === 'extrude').depth = 25;
  const infos = asmSet(t.docs); const r = Assembly.solve(t.asm, infos), b = asmBox(t.asm, infos, t.B);
  return eqs([b[1], b[4], r.ok ? 1 : 0], [25, 35, 1]);
}]);
ASM.push(['Elemento perso: se il foro sparisce dalla parte, l\'accoppiamento è segnato e il programma non si ferma', () => {
  const docs = { a: plateHole(80, 50, 10, 40, 25, 10), b: pin(10, 30) }, infos0 = asmSet(docs), asm = Assembly.newAssembly();
  const A = Assembly.addInst(asm, 'a'), B = Assembly.addInst(asm, 'b', { pose: asmPose([150, 0, 60]) });
  const m = asmMate(asm, infos0, 'concentric', A, asmRev(docs.a), B, asmRev(docs.b));
  Assembly.solve(asm, infos0);
  const sk = docs.a.features[0].sk; sk.ents = sk.ents.filter(e => e.t !== 'ci');
  const r = Assembly.solve(asm, asmSet(docs));
  return eqs([r.ok ? 1 : 0, r.status.get(m.id).ok ? 1 : 0, /non esiste più/.test(r.status.get(m.id).err) ? 1 : 0, r.dof.total], [0, 0, 1, 6]);
}]);
ASM.push(['Trascinamento: sul piano si sposta senza girare (+30, +10), y resta 10; il blocco libero si sposta e basta', () => {
  const t = twoBlocks(); asmMate(t.asm, t.infos, 'coincident', t.A, asmFace(t.docs.a, UP, 10), t.B, asmFace(t.docs.b, DN, 0));
  Assembly.solve(t.asm, t.infos);
  const P = [40, 5, -25], w = Assembly.toWorld(t.B.pose, P);
  const ok = Assembly.drag(t.asm, t.infos, { inst: t.B.id, local: P, target: [w[0] + 30, w[1] + 99, w[2] + 10], dirs: [[1, 0, 0], [0, 0, 1]] });
  const b = asmBox(t.asm, t.infos, t.B);
  const u = twoBlocks(); const P2 = [40, 5, -25], w2 = Assembly.toWorld(u.B.pose, P2);
  Assembly.drag(u.asm, u.infos, { inst: u.B.id, local: P2, target: [w2[0] + 7, w2[1] - 3, w2[2]], dirs: [[1, 0, 0], [0, 1, 0]] });
  return eqs([ok ? 1 : 0, b[0], b[1], b[2], b[3], b[4], b[5], ...t.B.pose.q, ...u.B.pose.p, ...u.B.pose.q], [1, 230, 10, -10, 310, 20, 40, 1, 0, 0, 0, 207, 47, 30, 1, 0, 0, 0]);
}]);
ASM.push(['Trascinamento di una cerniera: l\'estremo arriva a +20° lungo il cerchio, il foro resta fermo; un perno scorre lungo l\'asse', () => {
  const docs = { a: plateHole(120, 20, 10, 10, 10, 5), b: plateHole(120, 20, 10, 10, 10, 5), c: pin(5, 30) }, infos = asmSet(docs), asm = Assembly.newAssembly();
  const A = Assembly.addInst(asm, 'a'), B = Assembly.addInst(asm, 'b', { pose: asmPose([0, 10, 0]) });
  asmMate(asm, infos, 'concentric', A, asmRev(docs.a), B, asmRev(docs.b), { s: 1 });
  asmMate(asm, infos, 'coincident', A, asmFace(docs.a, UP, 10), B, asmFace(docs.b, DN, 0), { s: -1 });
  Assembly.solve(asm, infos);
  const P = [120, 10, 0], c = Math.cos(PI / 9), s = Math.sin(PI / 9), target = [10 + 110 * c + 10 * s, 20, -10 - 110 * s + 10 * c];
  for (let i = 0; i < 2; i++) Assembly.drag(asm, infos, { inst: B.id, local: P, target, dirs: [[1, 0, 0], [0, 0, 1]] });
  const tip = Assembly.toWorld(B.pose, P), hole = Assembly.toWorld(B.pose, [10, 0, -10]);
  const asm2 = Assembly.newAssembly(), A2 = Assembly.addInst(asm2, 'a'), C2 = Assembly.addInst(asm2, 'c', { pose: asmPose([10, 0, -10]) });
  asmMate(asm2, infos, 'concentric', A2, asmRev(docs.a), C2, asmRev(docs.c), { s: 1 });
  Assembly.solve(asm2, infos);
  const Q = [0, 15, 0], wq = Assembly.toWorld(C2.pose, Q);
  Assembly.drag(asm2, infos, { inst: C2.id, local: Q, target: [wq[0] + 3, wq[1] + 12, wq[2]], dirs: [[1, 0, 0], [0, 1, 0]] });
  const cb = asmBox(asm2, infos, C2);
  return eqs([...tip, ...hole, (cb[0] + cb[3]) / 2, cb[1], cb[4], (cb[2] + cb[5]) / 2], [...target, 10, 10, -10, 10, 12, 42, -10]);
}]);
ASM.push(['Ruota: il punto preso a 30 mm dal centro gira di 25° e il centro non si sposta; una parte fissa non si trascina', () => {
  const t = twoBlocks(), c0 = Assembly.toWorld(t.B.pose, t.infos.get('b').c), a = 25 * PI / 180;
  const P = [t.infos.get('b').c[0] + 30, t.infos.get('b').c[1], t.infos.get('b').c[2]];
  // rotazione attorno a Y: (30, 0, 0) → (30 cos, 0, -30 sin)
  const ok = Assembly.drag(t.asm, t.infos, { inst: t.B.id, local: P, rotate: true, target: [c0[0] + 30 * Math.cos(a), c0[1], c0[2] - 30 * Math.sin(a)], dirs: [[1, 0, 0], [0, 0, 1]] });
  const c1 = Assembly.toWorld(t.B.pose, t.infos.get('b').c), n = Assembly.dirWorld(t.B.pose, [1, 0, 0]);
  const res = Assembly.drag(t.asm, t.infos, { inst: t.A.id, local: [0, 0, 0], target: [5, 5, 5], dirs: [[1, 0, 0]] });
  return eqs([ok ? 1 : 0, ...c1, ...n, res ? 1 : 0], [1, ...c0, Math.cos(a), 0, -Math.sin(a), 0]);
}]);
ASM.push(['Ruota su una cerniera lontana dal centro: gira attorno al foro, non al centro del pezzo (estremo a +20° calcolato a mano)', () => {
  const docs = { a: plateHole(120, 20, 10, 10, 10, 5), b: plateHole(120, 20, 10, 10, 10, 5) }, infos = asmSet(docs), asm = Assembly.newAssembly();
  const A = Assembly.addInst(asm, 'a'), B = Assembly.addInst(asm, 'b', { pose: asmPose([0, 10, 0]) });
  asmMate(asm, infos, 'concentric', A, asmRev(docs.a), B, asmRev(docs.b), { s: 1 });
  asmMate(asm, infos, 'coincident', A, asmFace(docs.a, UP, 10), B, asmFace(docs.b, DN, 0), { s: -1 });
  Assembly.solve(asm, infos);
  const P = [120, 10, 0], c = Math.cos(PI / 9), s = Math.sin(PI / 9), target = [10 + 110 * c + 10 * s, 20, -10 - 110 * s + 10 * c];
  for (let i = 0; i < 4; i++) Assembly.drag(asm, infos, { inst: B.id, local: P, rotate: true, target, dirs: [[1, 0, 0], [0, 0, 1]] });
  return eqs([...Assembly.toWorld(B.pose, P), ...Assembly.toWorld(B.pose, [10, 0, -10])], [...target, 10, 10, -10]);
}]);
ASM.push(['Scena: facce, assi e vertici di un componente ruotato coincidono; salvando e rileggendo l\'assieme non si muove nulla', () => {
  const docs = { a: plateHole(80, 50, 10, 40, 25, 10) }, infos = asmSet(docs), asm = Assembly.newAssembly();
  Assembly.addInst(asm, 'a'); const B = Assembly.addInst(asm, 'a', { pose: asmPose([11, 22, 33], Assembly.qnorm([0.8, 0.2, -0.3, 0.5])) });
  const s = Assembly.scene(asm, infos);
  let plane = 0, rev = 0;
  for (const p of s.body) { const tg = s.tags.get(p.t); for (const v of p.v) { plane = Math.max(plane, Math.abs(p.p.n[0] * v[0] + p.p.n[1] * v[1] + p.p.n[2] * v[2] - p.p.w)); if (tg.kind === 'plane' && !tg.mesh) plane = Math.max(plane, Math.abs(tg.n[0] * v[0] + tg.n[1] * v[1] + tg.n[2] * v[2] - tg.w)); if (tg.kind === 'rev') { const r = [v[0] - tg.o[0], v[1] - tg.o[1], v[2] - tg.o[2]], t = r[0] * tg.d[0] + r[1] * tg.d[1] + r[2] * tg.d[2]; rev = Math.max(rev, Math.abs(Math.hypot(r[0] - t * tg.d[0], r[1] - t * tg.d[1], r[2] - t * tg.d[2]) - 10)); } } }
  const copy = JSON.parse(JSON.stringify(asm)), before = JSON.stringify(copy.insts); Assembly.solve(copy, infos);
  return eqs([plane, rev, before === JSON.stringify(copy.insts) ? 1 : 0, copy.insts[1].pose.p[0], B.pose.p[0]], [0, 0, 1, 11, 11], 1e-9);
}]);
ASM.push(['Valori di partenza: B sotto A: lato e distanza sono quelli attuali (lato -1, 40 mm) e B non si muove; angolo attuale 30°', () => {
  const t = twoBlocks(asmPose([200, -30, 30]));
  const m = asmMate(t.asm, t.infos, 'distance', t.A, asmFace(t.docs.a, UP, 10), t.B, asmFace(t.docs.b, DN, 0), { s: -1 });
  const p0 = t.B.pose.p.slice(); Assembly.solve(t.asm, t.infos);
  const u = twoBlocks(asmPose([200, 50, 30], rotZ(PI / 6)));
  const a = asmMate(u.asm, u.infos, 'angle', u.A, asmFace(u.docs.a, UP, 10), u.B, asmFace(u.docs.b, UP, 10));
  return eqs([m.side, m.value, ...t.B.pose.p, a.value], [-1, 40, ...p0, 30]);
}]);
ASM.push(['Faccia sparita: la cima del blocco è tolta tutta da un taglio: il nome c\'è ancora, ma l\'accoppiamento è segnato', () => {
  const docs = { a: box(), b: box() }, infos0 = asmSet(docs), asm = Assembly.newAssembly();
  const A = Assembly.addInst(asm, 'a'), B = Assembly.addInst(asm, 'b', { pose: asmPose([200, 50, 30]) });
  const top = asmFace(docs.a, UP, 10);
  const m = asmMate(asm, infos0, 'coincident', A, top, B, asmFace(docs.b, DN, 0));
  Assembly.solve(asm, infos0);
  // taglio di tutta la pianta, profondo 2 mm dall'alto: rimane y 0..8
  const b = SB(); b.rect(-5, -5, 85, 55);
  const sk = feat(docs.a, { type: 'sketch', plane: { kind: 'face', ...face(docs.a, nearW(UP, 10)) }, sk: b.s });
  feat(docs.a, { type: 'cut', sketch: sk, end: 'blind', depth: 2 });
  const infos = asmSet(docs), inf = infos.get('a');
  const r = Assembly.solve(asm, infos);
  return eqs([Geom.massProps(inf.st.body, inf.st.tags).volume, inf.st.tags.byName.has(top.name) ? 1 : 0, r.status.get(m.id).ok ? 1 : 0, /non esiste più/.test(r.status.get(m.id).err || '') ? 1 : 0], [32000, 1, 0, 1], 1e-3);
}]);
// piani e origine delle parti: blocco 80×50×10 (x 0..80, y 0..10, z -50..0), origine in un suo angolo
const asmPl = id => ({ k: 'plane', id }), asmOr = { k: 'origin' };
ASM.push(['Piano frontale su piano frontale: B resta parallelo a Z = 0 (z -50..0), x e y non cambiano; 3 gradi di libertà', () => {
  const t = twoBlocks(); asmMate(t.asm, t.infos, 'coincident', t.A, asmPl('front'), t.B, asmPl('front'));
  const r = Assembly.solve(t.asm, t.infos);
  return eqs([...asmBox(t.asm, t.infos, t.B), r.dof.total, r.ok ? 1 : 0], [200, 50, -50, 280, 60, 0, 3, 1]);
}]);
ASM.push(['I tre piani coincidenti: B esattamente sopra A con la posizione di A (fermo in 10, 20, 30 e girato di 30° attorno a Y): 0 gradi di libertà', () => {
  const docs = { a: box(), b: box() }, infos = asmSet(docs), asm = Assembly.newAssembly();
  const qa = rotY(Math.PI / 6);
  const A = Assembly.addInst(asm, 'a', { pose: asmPose([10, 20, 30], qa) }), B = Assembly.addInst(asm, 'b', { pose: asmPose([200, 50, 30]) });
  for (const id of ['front', 'top', 'right']) asmMate(asm, infos, 'coincident', A, asmPl(id), B, asmPl(id), { s: 1 });
  const r = Assembly.solve(asm, infos);
  // angolo x = 80 della parte: x' = 10 + 80·cos30, z' = 30 − 80·sin30 (rotazione attorno a Y)
  const P = Assembly.toWorld(B.pose, [80, 0, 0]), c = Math.cos(Math.PI / 6);
  return eqs([...P, r.dof.total, r.ok ? 1 : 0], [10 + 80 * c, 20, 30 - 40, 0, 1]);
}]);
ASM.push(['Origine su origine: origine di B nel punto (10, 20, 30) di A fermo, B può solo girare: 3 gradi di libertà', () => {
  const docs = { a: box(), b: box() }, infos = asmSet(docs), asm = Assembly.newAssembly();
  const A = Assembly.addInst(asm, 'a', { pose: asmPose([10, 20, 30]) }), B = Assembly.addInst(asm, 'b', { pose: asmPose([200, 50, 30]) });
  asmMate(asm, infos, 'coincident', A, asmOr, B, asmOr);
  const r = Assembly.solve(asm, infos), O = Assembly.toWorld(B.pose, [0, 0, 0]);
  return eqs([...O, r.dof.total, r.ok ? 1 : 0], [10, 20, 30, 3, 1]);
}]);
ASM.push(['Origine su una faccia e su un piano: faccia in alto di A (y = 10) e piano destro di A (x = 0): origine di B in x = 0, y = 10; 4 gradi di libertà', () => {
  const t = twoBlocks();
  asmMate(t.asm, t.infos, 'coincident', t.A, asmFace(t.docs.a, UP, 10), t.B, asmOr);
  asmMate(t.asm, t.infos, 'coincident', t.A, asmPl('right'), t.B, asmOr);
  const r = Assembly.solve(t.asm, t.infos), O = Assembly.toWorld(t.B.pose, [0, 0, 0]);
  return eqs([O[0], O[1], r.dof.total, r.ok ? 1 : 0], [0, 10, 4, 1]);
}]);
ASM.push(['Origine sull\'asse del foro: l\'origine del perno va sull\'asse (x 40, z -25); 4 gradi di libertà', () => {
  const docs = { a: plateHole(80, 50, 10, 40, 25, 10), b: pin(10, 30) }, infos = asmSet(docs), asm = Assembly.newAssembly();
  const A = Assembly.addInst(asm, 'a'), B = Assembly.addInst(asm, 'b', { pose: asmPose([150, 7, 60]) });
  asmMate(asm, infos, 'concentric', A, asmRev(docs.a), B, asmOr);
  const r = Assembly.solve(asm, infos), O = Assembly.toWorld(B.pose, [0, 0, 0]);
  return eqs([O[0], O[2], r.dof.total, r.ok ? 1 : 0], [40, -25, 4, 1]);
}]);
ASM.push(['Distanza 35 tra piano superiore di A e faccia di base di B: y di B 35..45; col lato invertito -35..-25', () => {
  const t = twoBlocks();
  const m = asmMate(t.asm, t.infos, 'distance', t.A, asmPl('top'), t.B, asmFace(t.docs.b, DN, 0), { value: 35, s: -1, side: 1 });
  Assembly.solve(t.asm, t.infos); const b1 = asmBox(t.asm, t.infos, t.B);
  m.side = -1; const r = Assembly.solve(t.asm, t.infos), b2 = asmBox(t.asm, t.infos, t.B);
  return eqs([b1[1], b1[4], b2[1], b2[4], r.ok ? 1 : 0, r.dof.total], [35, 45, -35, -25, 1, 3]);
}]);
ASM.push(['Angolo di 30° tra il piano destro di A e il piano destro di B, con il piano superiore coincidente: x di B = (cos30, 0, ±sin30)', () => {
  const t = twoBlocks();
  asmMate(t.asm, t.infos, 'coincident', t.A, asmPl('top'), t.B, asmPl('top'), { s: 1 });
  asmMate(t.asm, t.infos, 'angle', t.A, asmPl('right'), t.B, asmPl('right'), { value: 30, s: 1 });
  const r = Assembly.solve(t.asm, t.infos);
  const nx = Assembly.dirWorld(t.B.pose, [1, 0, 0]), ny = Assembly.dirWorld(t.B.pose, [0, 1, 0]);
  return eqs([nx[0], nx[1], Math.abs(nx[2]), ny[1], r.dof.total, r.ok ? 1 : 0], [Math.cos(Math.PI / 6), 0, 0.5, 1, 2, 1]);
}]);
ASM.push(['Perpendicolare e parallelo con i piani: piano frontale di B perpendicolare al piano superiore di A, parallelo al piano destro di A: la normale di B è ±X', () => {
  const t = twoBlocks();
  asmMate(t.asm, t.infos, 'parallel', t.A, asmPl('right'), t.B, asmPl('front'), { s: 1 });
  const r1 = Assembly.solve(t.asm, t.infos), n = Assembly.dirWorld(t.B.pose, [0, 0, 1]);
  const t2 = twoBlocks();
  asmMate(t2.asm, t2.infos, 'perpendicular', t2.A, asmPl('top'), t2.B, asmPl('top'));
  const r2 = Assembly.solve(t2.asm, t2.infos), n2 = Assembly.dirWorld(t2.B.pose, [0, 1, 0]);
  return eqs([n[0], n[1], n[2], r1.dof.total, n2[1], r2.dof.total], [1, 0, 0, 4, 0, 5]);
}]);
ASM.push(['Inverti allineamento tra due piani: piano frontale di B girato (normale -Z), sempre su z = 0', () => {
  const t = twoBlocks();
  asmMate(t.asm, t.infos, 'coincident', t.A, asmPl('front'), t.B, asmPl('front'), { s: -1 });
  const r = Assembly.solve(t.asm, t.infos), n = Assembly.dirWorld(t.B.pose, [0, 0, 1]), O = Assembly.toWorld(t.B.pose, [0, 0, 0]);
  return eqs([n[0], n[1], n[2], O[2], r.dof.total, r.ok ? 1 : 0], [0, 0, -1, 0, 3, 1]);
}]);
ASM.push(['Piano creato nella parte (25 mm sopra il piano superiore): faccia di base di B su quel piano (y 25..35); poi si cambia l\'offset a 40 (y 40..50)', () => {
  const docs = { a: box(), b: box() };
  const pid = feat(docs.a, { type: 'plane', base: STD('top'), offset: 25 });
  const infos = asmSet(docs), asm = Assembly.newAssembly();
  const A = Assembly.addInst(asm, 'a'), B = Assembly.addInst(asm, 'b', { pose: asmPose([200, 50, 30]) });
  const E = Assembly.entityOf({ k: 'plane', id: pid }, infos.get('a'));
  asmMate(asm, infos, 'coincident', A, asmPl(pid), B, asmFace(docs.b, DN, 0), { s: -1 });
  Assembly.solve(asm, infos); const b1 = asmBox(asm, infos, B);
  docs.a.features.find(f => f.id === pid).offset = 40;
  const r = Assembly.solve(asm, asmSet(docs)); const b2 = asmBox(asm, asmSet(docs), B);
  return eqs([E.datum ? 1 : 0, E.name === docs.a.features.find(f => f.id === pid).name ? 1 : 0, E.c[1], b1[1], b1[4], b2[1], b2[4], r.ok ? 1 : 0], [1, 1, 25, 25, 35, 40, 50, 1]);
}]);
ASM.push(['Piano perso: se il piano creato viene cancellato dalla parte l\'accoppiamento è segnato; piani standard e origine restano; l\'elenco di una parte ha i 3 piani, quello creato e l\'origine', () => {
  const docs = { a: box(), b: box() };
  const pid = feat(docs.a, { type: 'plane', base: STD('top'), offset: 25 });
  const infos = asmSet(docs), asm = Assembly.newAssembly();
  const A = Assembly.addInst(asm, 'a'), B = Assembly.addInst(asm, 'b', { pose: asmPose([200, 50, 30]) });
  const list = Assembly.datumsOf(infos.get('a')).map(d => d.id || d.k).join();
  const m1 = asmMate(asm, infos, 'coincident', A, asmPl(pid), B, asmPl('top'));
  const m2 = asmMate(asm, infos, 'coincident', A, asmOr, B, asmOr);
  docs.a.features = docs.a.features.filter(f => f.id !== pid);
  const r = Assembly.solve(asm, asmSet(docs));
  return eqs([list === 'front,top,right,' + pid + ',origin' ? 1 : 0, r.status.get(m1.id).ok ? 1 : 0, /piano scelto non esiste più/.test(r.status.get(m1.id).err) ? 1 : 0, r.status.get(m2.id).ok ? 1 : 0, ...Assembly.toWorld(B.pose, [0, 0, 0])], [1, 0, 1, 1, 0, 0, 0]);
}]);
ASM.push(['Accoppiamenti possibili con piani e origine: il piano va come una faccia, l\'origine come un vertice', () => {
  const docs = { a: box() }, infos = asmSet(docs), E = r => Assembly.entityOf(r, infos.get('a'));
  const T = (a, b) => Assembly.allowedTypes(a, b).join();
  const P = E(asmPl('front')), O = E(asmOr), F = E(asmFace(docs.a, UP, 10));
  return eqs([T(P, P) === T(F, F) ? 1 : 0, T(P, O), T(O, O), O.origin ? 1 : 0, P.n[2], P.c[0]].map(v => v === 'coincident,distance' ? 1 : v), [1, 1, 1, 1, 1, 0]);
}]);
// il vertice si ritrova quando cambia la parte. Blocco di twoBlocks: l'angolo (80, 10, 0) è dove si incontrano la faccia in cima, quella a destra e quella davanti
const moveX = (doc, x) => { for (const e of doc.features[0].sk.ents) if (e.t === 'pt' && e.x === 80) e.x = x; };
ASM.push(['Vertice che si sposta: A da 80 a 110 mm: il vertice si ritrova in (110, 10, 0) e B lo segue di +30; niente «!»', () => {
  const t = twoBlocks(asmPose([200, 50, 30]));
  const m = asmMate(t.asm, t.infos, 'coincident', t.A, { k: 'vertex', p: [80, 10, 0] }, t.B, { k: 'vertex', p: [0, 0, 0] });
  Assembly.solve(t.asm, t.infos);
  const O1 = Assembly.toWorld(t.B.pose, [0, 0, 0]);
  moveX(t.docs.a, 110);
  const infos = asmSet(t.docs), r = Assembly.solve(t.asm, infos), O2 = Assembly.toWorld(t.B.pose, [0, 0, 0]);
  return eqs([...O1, ...O2, r.ok ? 1 : 0, r.status.get(m.id).ok ? 1 : 0, ...m.a.p], [80, 10, 0, 110, 10, 0, 1, 1, 110, 10, 0]);
}]);
ASM.push(['Vertice che si sposta molto, a passi, e torna indietro: 80 → 200 → 300 → 80; sempre lo stesso angolo della parte', () => {
  const t = twoBlocks(asmPose([200, 50, 30]));
  const m = asmMate(t.asm, t.infos, 'coincident', t.A, { k: 'vertex', p: [80, 10, 0] }, t.B, { k: 'vertex', p: [0, 0, 0] });
  Assembly.solve(t.asm, t.infos);
  const out = [];
  let cur = 80;
  for (const x of [200, 300, 80]) { for (const e of t.docs.a.features[0].sk.ents) if (e.t === 'pt' && e.x === cur) e.x = x; cur = x; const r = Assembly.solve(t.asm, asmSet(t.docs)); out.push(Assembly.toWorld(t.B.pose, [0, 0, 0])[0], r.ok ? 1 : 0); }
  return eqs(out, [200, 1, 300, 1, 80, 1]);
}]);
ASM.push(['Vertice e altezza: A da 10 a 25 mm di altezza: l\'angolo in alto si ritrova in (80, 25, 0)', () => {
  const t = twoBlocks(asmPose([200, 50, 30]));
  const m = asmMate(t.asm, t.infos, 'coincident', t.A, { k: 'vertex', p: [80, 10, 0] }, t.B, { k: 'vertex', p: [0, 0, 0] });
  Assembly.solve(t.asm, t.infos);
  t.docs.a.features.find(f => f.type === 'extrude').depth = 25;
  const r = Assembly.solve(t.asm, asmSet(t.docs));
  return eqs([...Assembly.toWorld(t.B.pose, [0, 0, 0]), r.ok ? 1 : 0], [80, 25, 0, 1]);
}]);
ASM.push(['Vertice che sparisce davvero: uno smusso sullo spigolo che ci arriva lo toglie: «!» con il messaggio, gli altri accoppiamenti restano', () => {
  const t = twoBlocks(asmPose([200, 50, 30]));
  const m = asmMate(t.asm, t.infos, 'coincident', t.A, { k: 'vertex', p: [80, 10, 0] }, t.B, { k: 'vertex', p: [0, 0, 0] });
  const m2 = asmMate(t.asm, t.infos, 'coincident', t.A, { k: 'vertex', p: [0, 0, 0] }, t.B, { k: 'vertex', p: [0, 0, 0] }, { suppressed: true });
  Assembly.solve(t.asm, t.infos);
  feat(t.docs.a, { type: 'chamfer', d: 2, edges: [edge(t.docs.a, [80, 10, -25], 'line')] });
  const infos = asmSet(t.docs), r = Assembly.solve(t.asm, infos), s = r.status.get(m.id);
  const V = infos.get('a').st.topo.verts, gone = V.every(v => Math.hypot(v[0] - 80, v[1] - 10, v[2]) > 1e-3);
  return eqs([gone ? 1 : 0, s.ok ? 1 : 0, /vertice scelto non esiste più/.test(s.err) ? 1 : 0, r.status.get(m2.id).ok ? 1 : 0], [1, 0, 1, 1]);
}]);
ASM.push(['Vertice e funzione che non lo tocca: un foro in mezzo alla piastra aggiunge facce, il vertice resta quello', () => {
  const t = twoBlocks(asmPose([200, 50, 30]));
  const m = asmMate(t.asm, t.infos, 'coincident', t.A, { k: 'vertex', p: [80, 10, 0] }, t.B, { k: 'vertex', p: [0, 0, 0] });
  Assembly.solve(t.asm, t.infos);
  const f0 = m.a.faces.slice();
  const b = SB(); b.circle(40, 25, 5); const sk = feat(t.docs.a, { type: 'sketch', plane: { kind: 'face', ...face(t.docs.a, nearW(UP, 10)) }, sk: b.s });
  feat(t.docs.a, { type: 'cut', sketch: sk, end: 'through' });
  const r = Assembly.solve(t.asm, asmSet(t.docs));
  return eqs([...Assembly.toWorld(t.B.pose, [0, 0, 0]), r.ok ? 1 : 0, f0.length, m.a.faces.join() === f0.join() ? 1 : 0], [80, 10, 0, 1, 3, 1]);
}]);
ASM.push(['Vertice di un progetto vecchio (solo la posizione): al primo calcolo impara le facce, poi segue la parte come gli altri', () => {
  const t = twoBlocks(asmPose([200, 50, 30]));
  const m = asmMate(t.asm, t.infos, 'coincident', t.A, { k: 'vertex', p: [80, 10, 0] }, t.B, { k: 'vertex', p: [0, 0, 0] });
  const copy = JSON.parse(JSON.stringify(t.asm));
  const mm = copy.mates[0]; delete mm.a.faces; delete mm.b.faces; mm.a.p = [80, 10, 0];
  t.asm = copy;
  const A = copy.insts[0], B = copy.insts[1];
  Assembly.solve(copy, t.infos);
  const learned = (mm.a.faces || []).length;
  moveX(t.docs.a, 95);
  const r = Assembly.solve(copy, asmSet(t.docs));
  return eqs([learned, ...Assembly.toWorld(B.pose, [0, 0, 0]), r.ok ? 1 : 0], [3, 95, 10, 0, 1]);
}]);
ASM.push(['Vertice di un progetto vecchio già perso (posizione non più nella parte e nessuna faccia): resta «!»; un vertice nuovo non si inventa', () => {
  const t = twoBlocks(asmPose([200, 50, 30]));
  const m = asmMate(t.asm, t.infos, 'coincident', t.A, { k: 'vertex', p: [80, 10, 0] }, t.B, { k: 'vertex', p: [0, 0, 0] });
  moveX(t.docs.a, 95);
  delete m.a.faces; m.a.p = [80, 10, 0];
  const r = Assembly.solve(t.asm, asmSet(t.docs));
  return eqs([r.status.get(m.id).ok ? 1 : 0, /vertice scelto non esiste più/.test(r.status.get(m.id).err) ? 1 : 0], [0, 1]);
}]);
ASM.push(['Vertice su una tacca: spostando la tacca (x 60 → 70) il vertice la segue e non salta su quello simmetrico (x 40)', () => {
  const d = D0('tacca'); const b = SB(); b.poly([[0, 0], [100, 0], [100, 20], [60, 20], [60, 10], [40, 10], [40, 20], [0, 20]]);
  const s = sketch(d, STD('top'), b); feat(d, { type: 'extrude', sketch: s, end: 'blind', depth: 10 });
  const docs = { a: d, b: box() }, infos = asmSet(docs), asm = Assembly.newAssembly();
  const A = Assembly.addInst(asm, 'a'), B = Assembly.addInst(asm, 'b', { pose: asmPose([200, 50, 30]) });
  asmMate(asm, infos, 'coincident', A, { k: 'vertex', p: [60, 10, -20] }, B, { k: 'vertex', p: [0, 0, 0] });
  Assembly.solve(asm, infos);
  const O0 = Assembly.toWorld(B.pose, [0, 0, 0]);
  for (const e of d.features[0].sk.ents) if (e.t === 'pt' && e.x === 60) e.x = 70;
  const r = Assembly.solve(asm, asmSet(docs)), O = Assembly.toWorld(B.pose, [0, 0, 0]);
  return eqs([...O0, ...O, r.ok ? 1 : 0], [60, 10, -20, 70, 10, -20, 1]);
}]);
ASM.push(['Vertici con le stesse due facce (i punti di un cerchio): raggio da 10 a 15: resta sullo stesso angolo, il più vicino, (15, 30, 0); in un punto a 90° invece (0, 30, 15)', () => {
  const run = (p, r2) => {
    const docs = { a: pin(10, 30), b: box() }, infos = asmSet(docs), asm = Assembly.newAssembly();
    const A = Assembly.addInst(asm, 'a'), B = Assembly.addInst(asm, 'b', { pose: asmPose([200, 50, 30]) });
    const m = asmMate(asm, infos, 'coincident', A, { k: 'vertex', p }, B, { k: 'vertex', p: [0, 0, 0] });
    Assembly.solve(asm, infos);
    const nf = m.a.faces.length;
    docs.a.features[0].sk.ents.find(e => e.t === 'ci').r = r2;
    const r = Assembly.solve(asm, asmSet(docs));
    return [nf, ...Assembly.toWorld(B.pose, [0, 0, 0]), r.ok ? 1 : 0];
  };
  return eqs([...run([10, 30, 0], 15), ...run([0, 30, 10], 15)], [2, 15, 30, 0, 1, 2, 0, 30, 15, 1], 1e-6);
}]);
// riconoscimento delle superfici dai vertici: griglia di triangoli su una superficie data, con uno scarto messo apposta (dev)
const asmGrid = (fn, nu = 24, nv = 8) => {
  const P = []; for (let i = 0; i <= nu; i++) { P.push([]); for (let j = 0; j <= nv; j++) P[i].push(fn(i / nu, j / nv)); }
  const tri = (a, b, c) => { const u = [0, 1, 2].map(k => b[k] - a[k]), v = [0, 1, 2].map(k => c[k] - a[k]), n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...n); return l > 1e-12 ? { v: [a, b, c], p: { n: n.map(x => x / l) } } : null; };
  const out = []; for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { out.push(tri(P[i][j], P[i + 1][j], P[i + 1][j + 1]), tri(P[i][j], P[i + 1][j + 1], P[i][j + 1])); }
  return out.filter(Boolean);
};
const asmCal = (dev) => asmGrid((u, v) => { const a = 2 * Math.PI * u, b = 0.2 + 1.2 * v; return [10 * Math.cos(a) * Math.sin(b), 10 * Math.sin(a) * Math.sin(b), 10 * Math.cos(b) * (1 + dev)]; });
const asmCon = (dev) => asmGrid((u, v) => { const a = 2 * Math.PI * u, h = 20 * v, r = 5 + 0.5 * h + dev * h * h; return [r * Math.cos(a), r * Math.sin(a), h]; });
const asmFlat = (dev) => asmGrid((u, v) => { const x = 100 * u, y = 100 * v; return [x, y, dev * Math.sin(Math.PI * u) * 100]; });
ASM.push(['Superfici riconosciute con precisione: sfera, cono e piano esatti o quasi (scarto 10⁻⁶) sì; con uno scarto di 10⁻³ no: un\'altra superficie non si scambia per quella giusta', () => {
  const yes = f => (f ? 1 : 0);
  const S0 = Assembly.fitSphere(asmCal(0)), C0 = Assembly.fitCone(asmCon(0));
  return eqs([yes(S0), S0.R, ...S0.p, yes(C0), C0.tan, ...C0.apex, yes(Assembly.fitPlane(asmFlat(0))),
    yes(Assembly.fitSphere(asmCal(1e-6))), yes(Assembly.fitSphere(asmCal(1e-3))),
    yes(Assembly.fitCone(asmCon(1e-7))), yes(Assembly.fitCone(asmCon(1e-3))),
    yes(Assembly.fitPlane(asmFlat(1e-6))), yes(Assembly.fitPlane(asmFlat(1e-3)))],
    [1, 10, 0, 0, 0, 1, 0.5, 0, 0, -10, 1, 1, 0, 1, 0, 1, 0], 1e-9);
}]);
ASM.push(['Toro riconosciuto dai triangoli: intero, un pezzo e di traverso, R, r, centro e asse a mano; con uno scarto di 10⁻³ o su un paraboloide no', () => {
  const yes = f => (f ? 1 : 0), U = 1 / Math.sqrt(3), AX = [U, U, U], E1 = [1 / Math.sqrt(2), -1 / Math.sqrt(2), 0], E2 = [AX[1] * E1[2] - AX[2] * E1[1], AX[2] * E1[0] - AX[0] * E1[2], AX[0] * E1[1] - AX[1] * E1[0]], O = [3, -7, 11];
  const tor = (R, r, a0, a1, b0, b1, dev = 0, nu = 36, nv = 16) => asmGrid((u, v) => { const a = a0 + (a1 - a0) * u, b = b0 + (b1 - b0) * v, rho = R + r * Math.cos(b) * (1 + dev), h = r * Math.sin(b); return [0, 1, 2].map(k => O[k] + rho * Math.cos(a) * E1[k] + rho * Math.sin(a) * E2[k] + h * AX[k]); }, nu, nv);
  const A = Assembly.fitTorus(tor(20, 5, 0, 2 * PI, 0, 2 * PI)), B = Assembly.fitTorus(tor(30, 6, 0.3, 2.5, 0, PI / 2)), C = Assembly.fitTorus(tor(14, 6, 0, 2 * PI, 0, PI / 2));
  const dp = a => Math.abs(a.d[0] * AX[0] + a.d[1] * AX[1] + a.d[2] * AX[2]);
  const par = asmGrid((u, v) => { const a = 2 * PI * u, r = 2 + 10 * v; return [r * Math.cos(a), r * Math.sin(a), 0.05 * r * r]; }, 36, 16);
  return eqs([yes(A), A.R, A.r, dp(A), ...A.o, yes(A.round), yes(B), B.R, B.r, dp(B), ...B.o, yes(C), C.R, C.r, yes(Assembly.fitTorus(tor(20, 5, 0, 2 * PI, 0, 2 * PI, 1e-3))), yes(Assembly.fitTorus(par))],
    [1, 20, 5, 1, ...O, 1, 1, 30, 6, 1, ...O, 1, 14, 6, 0, 0], 1e-6);
}]);
ASM.push(['Vertice: tra i vertici con quelle facce vince chi ha proprio quelle: sul bordo di una D il punto dell\'arco, non l\'estremo più vicino dove arriva anche il lato dritto', () => {
  const d = D0('D'); const b = SB(); const c = b.pt(0, 0), a1 = b.pt(10, 0), a2 = b.pt(-10, 0); b.arc(c, a1, a2); b.line(a2, a1);
  const s = sketch(d, STD('top'), b); feat(d, { type: 'extrude', sketch: s, end: 'blind', depth: 5 });
  const info = Assembly.partInfo(d), st = info.st;
  const arcTag = [...new Set(st.body.map(p => p.t))].map(t => st.tags.get(t)).find(t => t.kind === 'rev');
  const capTag = [...new Set(st.body.map(p => p.t))].map(t => st.tags.get(t)).find(t => t.kind === 'plane' && Math.abs(t.n[1] - 1) < 1e-9);
  const E = Assembly.entityOf({ k: 'vertex', p: [10, 5, 0], faces: [arcTag.name, capTag.name] }, info);
  const onArc = Math.abs(Math.hypot(E.p[0], E.p[2]) - 10) < 1e-6, notEnd = Math.hypot(E.p[0] - 10, E.p[2]) > 1e-3;
  return eqs([E.err ? 1 : 0, onArc ? 1 : 0, notEnd ? 1 : 0, E.p[1], E.faces.length], [0, 1, 1, 5, 2]);
}]);
ASM.push(['Accoppiamenti possibili: Concentrico solo tra elementi tondi; Angolo e Parallelo non tra vertici', () => {
  const T = (a, b) => Assembly.allowedTypes(a, b);
  const P = { t: 'plane' }, R = { t: 'axis', round: true }, Lx = { t: 'axis', round: false }, V = { t: 'point' }, S = { t: 'point', sphere: true };
  const has = (l, t) => l.includes(t) ? 1 : 0;
  return eqs([has(T(P, P), 'concentric'), has(T(R, R), 'concentric'), has(T(R, Lx), 'concentric'), has(T(R, V), 'concentric'), has(T(S, S), 'concentric'), has(T(V, V), 'concentric'), has(T(V, V), 'angle'), has(T(V, V), 'parallel'), has(T(P, V), 'perpendicular'), has(T(P, P), 'distance'), has(T(V, R), 'distance'), Assembly.suggest(R, R) === 'concentric' ? 1 : 0, Assembly.suggest(P, P) === 'coincident' ? 1 : 0], [0, 1, 0, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1]);
}]);

/* ---------- calcoli sull'assieme: massa, distinta base, interferenze (valori a mano) ---------- */
const block = (L, W, H, mat) => { const d = D0('blocco'); const b = SB(); b.rect(0, 0, L, W); const s = sketch(d, STD('top'), b); feat(d, { type: 'extrude', sketch: s, end: 'blind', depth: H }); if (mat) d.material = mat; return d; };   // x 0..L, y 0..H, z -W..0
const ball = R => { const d = D0('sfera'); const b = SB(); const c = b.pt(0, 0), t = b.pt(0, R), n = b.pt(0, -R); b.arc(c, n, t); b.line(t, n); const s = sketch(d, STD('front'), b); feat(d, { type: 'revolve', sketch: s, axis: { kind: 'line', sk: s, ent: b.center(0, -R - 5, 0, R + 5) }, angle: 360 }); return d; };
function interOf(docs, poses) {
  const infos = asmSet(docs), asm = Assembly.newAssembly(), keys = Object.keys(docs);
  const insts = poses.map(([k, p, q]) => Assembly.addInst(asm, k, { pose: asmPose(p, q) }));
  return { r: Assembly.interferences(asm, infos), insts, keys };
}
const ROTX90 = Assembly.qexp([PI / 2, 0, 0]), TURN = Assembly.qexp([0, 0.0713, 0]);   // TURN: le faccette del perno non cadono su quelle del foro
ASM.push(['Massa dell\'assieme: due materiali; volume, area e massa sommati, baricentro pesato con la massa, non con il volume', () => {
  const docs = { a: plateHole(80, 50, 10, 40, 25, 10), b: pin(10, 30) }; docs.a.material = 's235'; docs.b.material = 'al6082';
  const infos = asmSet(docs), asm = Assembly.newAssembly();
  Assembly.addInst(asm, 'a'); Assembly.addInst(asm, 'b', { pose: asmPose([40, 0, -25]) });
  const m = Assembly.massOf(asm, infos);
  const Va = 80 * 50 * 10 - PI * 100 * 10, Vb = PI * 100 * 30;
  const Aa = 2 * (80 * 50 - PI * 100) + 2 * (80 + 50) * 10 + 2 * PI * 10 * 10, Ab = 2 * PI * 100 + 2 * PI * 10 * 30;
  const ma = Va * 7.85 / 1000, mb = Vb * 2.7 / 1000;
  // piastra: baricentro y 5; perno: y 15; x e z sull'asse del foro
  return eqs([m.volume, m.area, m.mass, m.centroid[0], m.centroid[1], m.centroid[2], m.comps.length, m.bbox.mn[1], m.bbox.mx[1], m.bbox.mn[0], m.bbox.mx[0]],
    [Va + Vb, Aa + Ab, ma + mb, 40, (ma * 5 + mb * 15) / (ma + mb), -25, 2, 0, 30, 0, 80], 1e-5);
}]);
ASM.push(['Massa dell\'assieme: il baricentro segue la posizione e la rotazione di ogni componente', () => {
  const docs = { a: block(40, 20, 10, 's235'), b: block(40, 20, 10, 's235') }, infos = asmSet(docs), asm = Assembly.newAssembly();
  Assembly.addInst(asm, 'a'); Assembly.addInst(asm, 'b', { pose: asmPose([100, 0, 0], Assembly.qexp([0, 0, PI / 2])) });
  // A: centro (20, 5, -10). B: (20, 5, -10) ruotato di 90° attorno a Z = (-5, 20, -10), più lo spostamento = (95, 20, -10)
  const m = Assembly.massOf(asm, infos);
  return eqs([m.comps[0].centroid[0], m.comps[1].centroid[0], m.comps[1].centroid[1], m.comps[1].centroid[2], m.centroid[0], m.centroid[1], m.centroid[2], m.mass, m.bbox.mn[0], m.bbox.mx[0], m.bbox.mn[1], m.bbox.mx[1]],
    [20, 95, 20, -10, 57.5, 12.5, -10, 2 * 8000 * 7.85 / 1000, 0, 100, 0, 40]);
}]);
ASM.push(['Massa dell\'assieme: componenti uguali contati tutti; parte senza solido e parte senza materiale segnalate; assieme vuoto a zero', () => {
  const docs = { a: block(10, 10, 10, 'c40'), b: block(10, 10, 10), e: D0('vuota') }, infos = asmSet(docs), asm = Assembly.newAssembly();
  const m0 = Assembly.massOf(asm, infos);
  Assembly.addInst(asm, 'a'); Assembly.addInst(asm, 'a', { pose: asmPose([50, 0, 0]) }); Assembly.addInst(asm, 'a', { pose: asmPose([100, 0, 0]) }); const e = Assembly.addInst(asm, 'e'); Assembly.addInst(asm, 'b', { pose: asmPose([200, 0, 0]) }); Assembly.addInst(asm, 'b', { pose: asmPose([300, 0, 0]) });
  const m = Assembly.massOf(asm, infos);
  return eqs([m0.mass, m0.volume, m0.bbox === null ? 1 : 0, m.volume, m.mass, m.comps.length, m.noSolid.length, m.noSolid[0] === e.id ? 1 : 0, m.noMaterial.length, m.noMaterial[0] === 'b' ? 1 : 0],
    [0, 0, 1, 5000, 3 * 1000 * 7.85 / 1000 + 2 * 1000 * 1 / 1000, 5, 1, 1, 1, 1]);
}]);
ASM.push(['Distinta base: una riga per parte nell\'ordine d\'ingresso, quantità, massa unitaria e totale; la somma è la massa dell\'assieme', () => {
  const docs = { a: block(10, 10, 10, 'c40'), b: pin(10, 30), e: D0('vuota') }; docs.b.material = 'al6082';
  const infos = asmSet(docs), asm = Assembly.newAssembly();
  Assembly.addInst(asm, 'b'); Assembly.addInst(asm, 'a', { pose: asmPose([50, 0, 0]) }); Assembly.addInst(asm, 'b', { pose: asmPose([100, 0, 0]) }); Assembly.addInst(asm, 'e'); Assembly.addInst(asm, 'b', { pose: asmPose([200, 0, 0]) });
  const r = Assembly.bom(asm, infos), m = Assembly.massOf(asm, infos), u = PI * 100 * 30 * 2.7 / 1000;
  return eqs([r.length, r[0].item, r[0].name === 'perno' ? 1 : 0, r[0].qty, r[0].unitMass, r[0].mass, r[0].material.id === 'al6082' ? 1 : 0, r[1].item, r[1].name === 'blocco' ? 1 : 0, r[1].qty, r[1].mass, r[2].qty, r[2].solid ? 1 : 0, r[2].mass, r.reduce((s, x) => s + x.mass, 0) - m.mass],
    [3, 1, 1, 3, u, 3 * u, 1, 2, 1, 1, 7.85, 1, 0, 0, 0], 1e-5);
}]);
ASM.push(['Interferenza: due blocchi: volume 20 × 5 × 20 e suo baricentro', () => {
  const { r, insts } = interOf({ a: block(40, 40, 10), b: block(40, 40, 10) }, [['a', [0, 0, 0]], ['b', [20, 5, -20]]]), x = r.list[0];
  // A: x 0..40, y 0..10, z -40..0; B: x 20..60, y 5..15, z -60..-20
  return eqs([r.list.length, r.pairs, x.volume, x.centroid[0], x.centroid[1], x.centroid[2], x.a === insts[0].id ? 1 : 0, x.b === insts[1].id ? 1 : 0, x.doubt ? 1 : 0], [1, 1, 2000, 30, 7.5, -30, 1, 1, 0]);
}]);
ASM.push(['Interferenza: blocchi che si toccano su una faccia, su uno spigolo e su un vertice, o staccati di 0,001 mm: nessuna', () => {
  const n = p => interOf({ a: block(40, 40, 10), b: block(40, 40, 10) }, [['a', [0, 0, 0]], ['b', p]]).r.list.length;
  return eqs([n([40, 0, 0]), n([0, 10, 0]), n([0, 0, -40]), n([40, 10, 0]), n([40, 10, -40]), n([40.001, 0, 0]), n([10, 10, -5])], [0, 0, 0, 0, 0, 0, 0]);
}]);
ASM.push(['Interferenza: compenetrazione di 0,001 mm tra due blocchi: si trova, con il volume giusto', () => {
  const { r } = interOf({ a: block(40, 40, 10), b: block(40, 40, 10) }, [['a', [0, 0, 0]], ['b', [39.999, 0, 0]]]);
  return eqs([r.list.length, r.list[0].volume], [1, 0.001 * 40 * 10], 1e-7);
}]);
ASM.push(['Interferenza: blocco ruotato di 90° attorno a X: conta anche la rotazione', () => {
  // la rotazione manda (x, y, z) in (x, -z, y): B va in x 0..40, y 0..40, z 0..10; spostato di (10, 5, -5): x 10..50, y 5..45, z -5..5; in comune con A: x 10..40, y 5..10, z -5..0
  const { r } = interOf({ a: block(40, 40, 10), b: block(40, 40, 10) }, [['a', [0, 0, 0]], ['b', [10, 5, -5], ROTX90]]), x = r.list[0];
  return eqs([r.list.length, x.volume, x.centroid[0], x.centroid[1], x.centroid[2]], [1, 30 * 5 * 5, 25, 7.5, -2.5]);
}]);
ASM.push(['Interferenza: perno uguale al foro (faccette girate), più piccolo o spostato di lato: le superfici vere si toccano soltanto o si staccano', () => {
  const n = (r, p, q) => interOf({ a: plateHole(80, 50, 10, 40, 25, 10), b: pin(r, 30) }, [['a', [0, 0, 0]], ['b', p, q]]).r.list.length;
  return eqs([n(10, [40, -10, -25]), n(10, [40, -10, -25], TURN), n(9.9, [40, -10, -25], TURN), n(5, [37, -10, -25], TURN)], [0, 0, 0, 0]);
}]);
ASM.push(['Interferenza: perno più grande del foro: la corona vera π(R² − r²)h, anche di 0,01 mm, non le faccette', () => {
  const v = R => interOf({ a: plateHole(80, 50, 10, 40, 25, 10), b: pin(R, 30) }, [['a', [0, 0, 0]], ['b', [40, -10, -25], TURN]]).r.list[0].volume;
  return eqs([v(10.5), v(10.01), v(11)], [PI * (10.5 * 10.5 - 100) * 10, PI * (10.01 * 10.01 - 100) * 10, PI * (121 - 100) * 10], 1e-3);
}]);
ASM.push(['Interferenza: perno che attraversa un blocco pieno: πr²h; due cilindri incrociati: la lente calcolata a mano', () => {
  const v1 = interOf({ a: block(80, 50, 10), b: pin(10, 30) }, [['a', [0, 0, 0]], ['b', [40, -10, -25]]]).r.list[0].volume;
  const v2 = interOf({ a: pin(10, 30), b: pin(10, 30) }, [['a', [0, 0, 0]], ['b', [5, 0, 0]]]).r.list[0].volume;
  return eqs([v1, v2], [PI * 100 * 10, (2 * 100 * Math.acos(0.25) - 2.5 * Math.sqrt(400 - 25)) * 30], 1e-3);
}]);
ASM.push(['Interferenza: sfera tagliata a metà dalla faccia di un blocco: la semisfera vera 2/3 π R³ e il suo baricentro 3/8 R', () => {
  const { r } = interOf({ a: block(80, 80, 40), b: ball(10) }, [['a', [0, 0, 0]], ['b', [40, 40, -40]]]), x = r.list[0];
  return eqs([r.list.length, x.volume, x.centroid[0], x.centroid[1], x.centroid[2]], [1, 2 / 3 * PI * 1000, 40, 40 - 3.75, -40], 1e-2);
}]);
ASM.push(['Interferenza: due copie nello stesso punto: il pezzo intero; tre componenti: 3 coppie, la più grande per prima', () => {
  const v0 = interOf({ a: pin(10, 30) }, [['a', [0, 0, 0]], ['a', [0, 0, 0]]]).r.list[0].volume;
  const { r, insts } = interOf({ a: block(40, 40, 10), b: block(40, 40, 10) }, [['a', [0, 0, 0]], ['b', [39, 0, 0]], ['b', [0, 0, -38]]]);
  // A-C: x 0..40, z -40..-38 = 40·2·10; A-B: x 39..40, z -40..0 = 1·40·10; B-C: x 39..40, z -40..-38 = 1·2·10
  return eqs([v0, r.pairs, r.list.length, r.list[0].volume, r.list[0].b === insts[2].id && r.list[0].a === insts[0].id ? 1 : 0, r.list[1].volume, r.list[1].b === insts[1].id ? 1 : 0, r.list[2].volume, r.list[2].a === insts[1].id ? 1 : 0], [PI * 100 * 30, 3, 3, 800, 1, 400, 1, 20, 1], 1e-3);
}]);
ASM.push(['Interferenza: perno e foro uguali con molti raggi e angoli (resti di calcolo, anche positivi); sfera nella sua cavità; sfera più grande: la calotta vera', () => {
  const out = [], exp = [];
  for (const R of [1.5, 6, 47.3, 200]) for (const a of [0.01, 0.0713, 0.5, 2.1]) {
    const { r } = interOf({ a: plateHole(R * 4, R * 4, R, R * 2, R * 2, R), b: pin(R, R * 3) }, [['a', [0, 0, 0]], ['b', [R * 2, -R, -R * 2], Assembly.qexp([0, a, 0])]]);
    out.push(r.list.length); exp.push(0);
  }
  // blocco x, z -40..40, y 0..40 con una cavità semisferica R 10 in basso, al centro
  const cavity = () => { const d = D0('cavita'); const b = SB(); b.rect(-40, -40, 40, 40); const s = sketch(d, STD('top'), b); feat(d, { type: 'extrude', sketch: s, end: 'blind', depth: 40 }); const c = SB(); c.center(0, -60, 0, 60); const o = c.pt(0, 0), t = c.pt(0, 10), n = c.pt(0, -10); c.arc(o, n, t); c.line(t, n); const q = sketch(d, STD('front'), c); feat(d, { type: 'revcut', sketch: q, angle: 360 }); return d; };
  const eq = R => interOf({ a: cavity(), b: ball(R) }, [['a', [0, 0, 0]], ['b', [0, 0, 0], Assembly.qexp([0.3, 0.2, 0.1])]]).r.list;
  out.push(eq(10).length, eq(9).length); exp.push(0, 0);
  const big = eq(10.5);
  out.push(big.length, big[0].volume); exp.push(1, 2 / 3 * PI * (10.5 ** 3 - 1000));
  return eqs(out, exp, 1e-2);
}]);
ASM.push(['Interferenza: pezzi con molti poligoni: la zona in comune tagliata prima dà lo stesso risultato del calcolo intero', () => {
  const many = () => { const d = D0('fori'); const b = SB(); b.rect(0, 0, 300, 300); for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) b.circle(25 + i * 50, 25 + j * 50, 4); const s = sketch(d, STD('top'), b); feat(d, { type: 'extrude', sketch: s, end: 'blind', depth: 10 }); return d; };
  const docs = { a: many() }, infos = asmSet(docs), asm = Assembly.newAssembly();
  Assembly.addInst(asm, 'a'); Assembly.addInst(asm, 'a', { pose: asmPose([275, 2, -290]) });
  const n = infos.get('a').st.body.length;
  const one = Assembly.interferences(asm, infos), all = Assembly.interferences(asm, infos, { clip: false });
  // zona in comune: x 275..300, z -300..-290, y 2..10 = 25·10·8 = 2000, meno il foro di A (25+250, 25+250 = fuori) e di B: fuori anch'essi
  const V = 25 * 10 * 8;
  return eqs([n > 2000 ? 1 : 0, one.list.length, all.list.length, one.list[0].volume, all.list[0].volume], [1, 1, 1, V, V], 1e-3);
}]);

/* ---------- vista esplosa ---------- */
ASM.push(['Vista esplosa: i passi si sommano; la scena esplosa si sposta, le posizioni vere, la massa e le interferenze no; compressa torna com\'era', () => {
  const docs = { a: block(40, 40, 10, 's235'), b: block(40, 40, 10, 's235') }, infos = asmSet(docs), asm = Assembly.newAssembly();
  const A = Assembly.addInst(asm, 'a'), B = Assembly.addInst(asm, 'b', { pose: asmPose([20, 5, -20]) });
  const m0 = Assembly.massOf(asm, infos).centroid[1];
  asm.explode = { on: true, steps: [{ id: 'X1', insts: [B.id], dir: [0, 1, 0], dist: 30 }, { id: 'X2', insts: [B.id], dir: [0, 0, -1], dist: 7 }, { id: 'X3', insts: [A.id], dir: [1, 0, 0], dist: 3 }] };
  const box = (sc, id) => { const b = sc.bodies.find(x => x.id === id), mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; for (const p of b.polys) for (const v of p.v) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], v[k]); mx[k] = Math.max(mx[k], v[k]); } return [...mn, ...mx]; };
  const e = box(Assembly.scene(asm, infos, { exploded: true }), B.id), ea = box(Assembly.scene(asm, infos, { exploded: true }), A.id), r = box(Assembly.scene(asm, infos), B.id);
  const off = Assembly.explodeOffset(asm, B.id), V = Assembly.interferences(asm, infos).list[0].volume, m1 = Assembly.massOf(asm, infos).centroid[1];
  const onFlag = Assembly.isExploded(asm); asm.explode.on = false; const offFlag = Assembly.isExploded(asm); asm.explode = { on: true, steps: [] }; const empty = Assembly.isExploded(asm);
  return eqs([...e, ea[0], ea[3], ...r, ...off, B.pose.p[1], V, m1 - m0, onFlag ? 1 : 0, offFlag ? 1 : 0, empty ? 1 : 0],
    [20, 35, -67, 60, 45, -27, 3, 43, 20, 5, -60, 60, 15, -20, 0, 30, -7, 5, 2000, 0, 1, 0, 0]);
}]);
ASM.push(['Vista esplosa: le linee vanno dal centro del componente, un tratto per passo, anche ruotato; chi non si muove non ha linee', () => {
  const docs = { a: block(40, 20, 10) }, infos = asmSet(docs), asm = Assembly.newAssembly();
  const A = Assembly.addInst(asm, 'a'), B = Assembly.addInst(asm, 'a', { pose: asmPose([100, 0, 0], Assembly.qexp([0, 0, PI / 2])) });
  asm.explode = { on: true, steps: [{ id: 'X1', insts: [B.id], dir: [0, 1, 0], dist: 10 }, { id: 'X2', insts: [B.id], dir: [1, 0, 0], dist: 5 }] };
  // centro (20, 5, -10), ruotato attorno a Z: (-5, 20, -10), spostato: (95, 20, -10)
  const L = Assembly.explodeLines(asm, infos);
  return eqs([L.length, L[0].inst === B.id ? 1 : 0, L[0].pts.length, ...L[0].pts[0], ...L[0].pts[1], ...L[0].pts[2], A.id === B.id ? 1 : 0], [1, 1, 3, 95, 20, -10, 95, 30, -10, 100, 30, -10, 0]);
}]);
ASM.push(['Esplosione automatica: in fila lungo la direzione, con lo spazio voluto; il primo resta fermo; chi è già lontano non si muove', () => {
  const docs = { a: block(40, 40, 10), p: pin(5, 30), e: D0('vuota') }, infos = asmSet(docs), asm = Assembly.newAssembly();
  // blocco y 0..10 (centro 5), perno y -10..20 (centro 5, viene dopo a pari merito), perno y 22..52 (centro 37)
  const A = Assembly.addInst(asm, 'a'), P = Assembly.addInst(asm, 'p', { pose: asmPose([20, -10, -20]) }), Q = Assembly.addInst(asm, 'p', { pose: asmPose([20, 22, -20]) }); Assembly.addInst(asm, 'e');
  const s = Assembly.autoExplode(asm, infos, [0, 1, 0], 15);
  // P: da -10 a 10 + 15 = 25: 35; poi la sua cima è a 55. Q: da 22 a 55 + 15 = 70: 48
  const near = Assembly.autoExplode(asm, infos, [0, 1, 0], 0);
  // gap 0: P: da -10 a 10: 20, cima 40; Q: da 22 a 40: 18
  asm.insts[2].pose = asmPose([20, 500, -20]);
  const far = Assembly.autoExplode(asm, infos, [0, 1, 0], 15);
  // Q è già oltre: non si muove
  const down = Assembly.autoExplode(asm, infos, [0, -1, 0], 5);
  // verso -Y: Q (-530..-500, centro -515) fermo; poi il blocco (-10..0) e P (-20..10) a pari merito: il blocco è già oltre Q e non si muove; P va da -20 a 0 + 5: 25
  return eqs([s.length, s[0].insts[0] === P.id ? 1 : 0, s[0].dist, s[1].insts[0] === Q.id ? 1 : 0, s[1].dist, s[0].dir[1], near[0].dist, near[1].dist, far.length, far[0].dist, down.length, down[0].insts[0] === P.id ? 1 : 0, down[0].dist, A.id === P.id ? 1 : 0],
    [2, 1, 35, 1, 48, 1, 20, 18, 1, 35, 1, 1, 25, 0]);
}]);

/* ---------- viti, dadi e rondelle: tabelle controllate e volumi calcolati a mano ---------- */
const fastVol = sp => { const d = Model.fastenerDoc(sp), st = Model.regen(d); if (st.errors.size) throw new Error([...st.errors.values()].join()); const m = Model.massProperties(st, d); return { d, st, m, topY: m.bbox.mx[1], lowY: m.bbox.mn[1] }; };
const HEX = s => Math.sqrt(3) / 2 * s * s, CIR = D => PI * D * D / 4;
ASM.push(['Viti: le tabelle dicono le misure di norma (qualche riga per ogni norma); ISO 10642: 2k = dk − d in tutte le misure, cono di 90°', () => {
  const F = Model.FAST, sz = Model.HOLE.SIZES;
  const cone = sz.every(z => Math.abs(F.iso10642[z].dk - parseFloat(z.slice(1)) - 2 * F.iso10642[z].k) < 1e-9) ? 1 : 0;
  const all = sz.every(z => F.iso4762[z] && F.iso10642[z] && F.hex[z] && F.iso4032[z] && F.iso7089[z]) ? 1 : 0;
  return eqs([sz.length, cone, all, F.iso4762.M6.dk, F.iso4762.M6.k, F.iso4762.M6.s, F.iso4762.M20.b, F.iso10642.M8.dk, F.iso10642.M16.s, F.hex.M10.s, F.hex.M10.k, F.hex.M12.b, F.iso4032.M6.m, F.iso4032.M5.m, F.iso4032.M16.m, F.iso7089.M6.d1, F.iso7089.M6.d2, F.iso7089.M12.h, Model.threadMinor(6, 1)],
    [9, 1, 1, 10, 6, 5, 52, 17.92, 10, 16, 6.4, 30, 5.2, 4.7, 14.8, 6.4, 12, 2.5, 6 - 1.22687], 1e-9);
}]);
ASM.push(['Viti: ISO 4762 M6×20 e M20×60: volume a mano (testa + gambo − esagono), lunghezza sotto la testa, lunghezza del filetto, nessun errore', () => {
  const a = fastVol({ type: 'iso4762', size: 'M6', length: 20 }), b = fastVol({ type: 'iso4762', size: 'M20', length: 60 });
  const Va = CIR(10) * 6 + CIR(6) * 20 - HEX(5) * 3, Vb = CIR(30) * 20 + CIR(20) * 60 - HEX(17) * 10;
  const Ta = Model.threadsOf(a.d, a.st)[0], Tb = Model.threadsOf(b.d, b.st)[0];
  return eqs([a.m.volume, b.m.volume, a.topY, a.lowY, b.lowY, Ta.z1 - Ta.z0, Ta.o[1], Ta.ext ? 1 : 0, Ta.rMajor, Ta.rMinor, Tb.z1 - Tb.z0, a.d.name === 'Vite TCEI ISO 4762 M6×20' ? 1 : 0, a.m.mass],
    [Va, Vb, 0, -26, -80, 20, -26, 1, 3, (6 - 1.22687) / 2, 52, 1, Va * 7.85 / 1000], 1e-3);
}]);
ASM.push(['Viti: ISO 10642 M8×30: la lunghezza comprende la testa; tronco di cono a mano; filetto min(b, l − k)', () => {
  const a = fastVol({ type: 'iso10642', size: 'M8', length: 30 }), k = 4.96, dk = 17.92;
  const V = PI * k / 3 * (dk * dk / 4 + dk / 2 * 4 + 16) + CIR(8) * (30 - k) - HEX(5) * 3;
  const T = Model.threadsOf(a.d, a.st)[0], l = fastVol({ type: 'iso10642', size: 'M8', length: 80 }), Tl = Model.threadsOf(l.d, l.st)[0];
  return eqs([a.m.volume, a.lowY, a.topY, T.z1 - T.z0, Tl.z1 - Tl.z0], [V, -30, 0, 30 - k, 28], 1e-3);
}]);
ASM.push(['Viti: ISO 4017 (tutto filettato) e ISO 4014 (b di norma): prisma esagonale + gambo; dado con il foro di preparazione; rondella', () => {
  const t = fastVol({ type: 'iso4017', size: 'M10', length: 40 }), p = fastVol({ type: 'iso4014', size: 'M10', length: 60 }), n = fastVol({ type: 'iso4032', size: 'M12' }), w = fastVol({ type: 'iso7089', size: 'M16' });
  const Tt = Model.threadsOf(t.d, t.st)[0], Tp = Model.threadsOf(p.d, p.st)[0], Tn = Model.threadsOf(n.d, n.st)[0];
  return eqs([t.m.volume, t.topY, t.lowY, Tt.z1 - Tt.z0, p.m.volume, Tp.z1 - Tp.z0, n.m.volume, n.topY, n.lowY, Tn.ext ? 1 : 0, Tn.rMajor, Tn.rMinor, Tn.z1 - Tn.z0, w.m.volume, w.topY, Model.threadsOf(w.d, w.st).length],
    [HEX(16) * 6.4 + CIR(10) * 40, 0, -46.4, 40, HEX(16) * 6.4 + CIR(10) * 60, 26, (HEX(18) - CIR(10.2)) * 10.8, 10.8, 0, 0, 6, 5.1, 10.8, (CIR(30) - CIR(17)) * 3, 3, 0], 1e-3);
}]);
ASM.push(['Viti: tutte le misure e i tipi si costruiscono senza errori, con il volume esatto per le TCEI; lunghezze: ISO 4014 sopra b, serie ISO 888', () => {
  let bad = 0, n = 0;
  for (const t of Model.FAST_TYPES) for (const z of Model.HOLE.SIZES) {
    const ls = t.screw ? Model.fastenerLengths(t.id, z) : [0];
    const sp = { type: t.id, size: z, length: ls[0] };
    const r = fastVol(sp); n++;
    if (!(r.m.volume > 0) || r.st.warn.size) bad++;
  }
  const l = Model.fastenerLengths('iso4014', 'M10'), l2 = Model.fastenerLengths('iso4762', 'M6');
  return eqs([n, bad, l[0], l2[0], l2[l2.length - 1]], [54, 0, 30, 6, 200]);
}]);
ASM.push(['Filetto di un foro della Creazione guidata: maggiore, minore e tratto veri, anche passante e con la serie', () => {
  const d = D0('f'); const b = SB(); b.rect(0, 0, 40, 40); const s = sketch(d, STD('top'), b); feat(d, { type: 'extrude', sketch: s, end: 'blind', depth: 20 });
  const top = face(d, nearW([0, 1, 0], 20));
  const h = SB(); const pp = h.pt(20, 20); h.s.ents.find(e => e.id === pp).hole = true; const q = feat(d, { type: 'sketch', plane: { kind: 'face', name: top.name, n: top.n, w: top.w }, sk: h.s, holeSketch: true });
  feat(d, { type: 'hole', kind: 'tap', size: 'M8', end: 'blind', depth: 15, threadDepth: 12, sketch: q });
  const T = Model.threadsOf(d, Model.regen(d))[0];
  // passante: tutto lo spessore
  d.features[d.features.length - 1].end = 'through';
  const P = Model.threadsOf(d, Model.regen(d))[0];
  // un rialzo accanto al foro, alto 30 sopra il pezzo: il filetto resta lungo quanto il foro
  const c = SB(); c.rect(0, 0, 10, 10); const r = sketch(d, STD('top'), c); feat(d, { type: 'extrude', sketch: r, end: 'blind', depth: 50 });
  const Q = Model.threadsOf(d, Model.regen(d))[0];
  return eqs([T.rMajor, T.rMinor, T.z1 - T.z0, T.ext ? 1 : 0, T.dir[1], T.hole ? 1 : 0, P.z1 - P.z0, P.rMinor, Q.z1 - Q.z0], [4, 3.4, 12, 0, -1, 1, 20, 3.4, 20], 1e-6);
}]);
ASM.push(['Interferenze con le viti: M6 nel foro filettato M6 = «filetto»; nel passante nessuna; foro semplice, foro M5 o perno liscio = vere; testa nella piastra = vera; bullone nel dado: sul filetto sì, sul gambo no', () => {
  const scr = Model.fastenerDoc({ type: 'iso4762', size: 'M6', length: 20 });
  // piastra 40×40×10, y 0..10, con un foro della Creazione guidata
  const holed = (kind, size, extra = {}) => { const d = block(40, 40, 10); const top = face(d, nearW([0, 1, 0], 10)); const h = SB(); const pp = h.pt(20, 20); h.s.ents.find(e => e.id === pp).hole = true; const q = feat(d, { type: 'sketch', plane: { kind: 'face', name: top.name, n: top.n, w: top.w }, sk: h.s, holeSketch: true }); feat(d, { type: 'hole', kind, size, end: 'through', sketch: q, ...extra }); return d; };
  const go = (a, s, y) => { const docs = { a, s }, infos = asmSet(docs), asm = Assembly.newAssembly(); Assembly.addInst(asm, 'a'); Assembly.addInst(asm, 's', { pose: asmPose([20, y, -20], TURN) }); return Assembly.interferences(asm, infos).list; };
  // sottotesta sulla faccia alta: testa y 10..16, l'origine della vite è a y = 16
  const tap = go(holed('tap', 'M6'), scr, 16), clear = go(holed('clear', 'M6', { fit: 'medium' }), scr, 16), plain = go(plateHole(40, 40, 10, 20, 20, 2.5), scr, 16), small = go(holed('tap', 'M5'), scr, 16), pinIn = go(holed('tap', 'M6'), pin(3, 30), -5), sunk = go(holed('tap', 'M6'), scr, 12);
  const big = go(holed('tap', 'M6'), Model.fastenerDoc({ type: 'iso4762', size: 'M8', length: 20 }), 18);   // M8 in un foro M6: va oltre il nominale del foro
  const docs = { n: Model.fastenerDoc({ type: 'iso4032', size: 'M10' }), b: Model.fastenerDoc({ type: 'iso4014', size: 'M10', length: 60 }) }, infos = asmSet(docs), asm = Assembly.newAssembly();
  Assembly.addInst(asm, 'n'); Assembly.addInst(asm, 'b', { pose: asmPose([0, 30, 0], TURN) });   // punta -36,4, filetto fino a -10,4: nel dado (y 0..8,4) c'è il gambo liscio
  const shank = Assembly.interferences(asm, infos).list;
  asm.insts[1].pose = asmPose([0, 60, 0], TURN);   // punta -6,4, filetto fino a 19,6: copre tutto il dado
  const ok = Assembly.interferences(asm, infos).list;
  asm.insts[1].pose = asmPose([0, 100, 0], TURN);  // punta 33,6: lontano
  const far = Assembly.interferences(asm, infos).list;
  return eqs([tap.length, tap[0].thread ? 1 : 0, tap[0].volume, clear.length, plain.length, plain[0].thread ? 1 : 0, small.length, small[0].thread ? 1 : 0, pinIn.length, pinIn[0].thread ? 1 : 0, sunk.length, sunk[0].thread ? 1 : 0, shank.length, shank[0].thread ? 1 : 0, ok.length, ok[0].thread ? 1 : 0, ok[0].volume, far.length, big.length, big[0].thread ? 1 : 0],
    [1, 1, PI * (9 - 6.25) * 10, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, PI * (25 - 4.25 * 4.25) * 8.4, 0, 1, 0], 1e-3);
}]);
ASM.push(['Filetti nell\'assieme: seguono posizione e rotazione del componente', () => {
  const docs = { s: Model.fastenerDoc({ type: 'iso4762', size: 'M6', length: 20 }) }, infos = asmSet(docs), asm = Assembly.newAssembly();
  Assembly.addInst(asm, 's', { pose: asmPose([1, 2, 3], Assembly.qexp([0, 0, PI / 2])) });
  // base del filetto in (0, -26, 0): ruotata di 90° attorno a Z va in (26, 0, 0), spostata (27, 2, 3); asse +Y → -X
  const t = Assembly.threadsWorld(asm, infos)[0];
  asm.explode = { on: true, steps: [{ id: 'X1', insts: [asm.insts[0].id], dir: [0, 0, 1], dist: 40 }] };
  const e = Assembly.threadsWorld(asm, infos, { exploded: true })[0], f = Assembly.threadsWorld(asm, infos)[0];
  return eqs([...t.o, ...t.dir, t.inst === asm.insts[0].id ? 1 : 0, e.o[2], f.o[2]], [27, 2, 3, -1, 0, 0, 1, 43, 3]);
}]);

/* ---------- sottoassiemi ---------- */
const subSet = () => {
  const docs = { a: plateHole(80, 50, 10, 40, 25, 10), b: pin(10, 30) }; docs.a.material = 's235'; docs.b.material = 'al6082';
  const infos = asmSet(docs);
  // gruppo: piastra + perno nel foro (y 0..30), asse in (40, y, -25)
  const G = Assembly.newAssembly('Gruppo'); G.id = 'A1';
  const P1 = Assembly.addInst(G, 'a'), P2 = Assembly.addInst(G, 'b', { pose: asmPose([150, 0, 60]) });
  asmMate(G, infos, 'concentric', P1, asmRev(docs.a), P2, asmRev(docs.b));
  asmMate(G, infos, 'coincident', P1, asmFace(docs.a, DN, 0), P2, asmFace(docs.b, DN, 0));
  infos.set('A1', Assembly.subInfo(G, infos));
  return { docs, infos, G, P1, P2 };
};
ASM.push(['Sottoassieme: posizioni interne dal suo risolutore; massa, baricentro pesato e distinta aperta nelle parti vere; quantità moltiplicate; numeri giusti con due copie ruotate', () => {
  const { docs, infos, G, P2 } = subSet();
  const top = Assembly.newAssembly('Macchina'); top.id = 'A2';
  Assembly.addInst(top, 'A1'); Assembly.addInst(top, 'A1', { pose: asmPose([200, 0, 0], Assembly.qexp([0, PI, 0])) }); Assembly.addInst(top, 'b', { pose: asmPose([0, 100, 0]) });
  const m = Assembly.massOf(top, infos), r = Assembly.bom(top, infos);
  const Va = 80 * 50 * 10 - PI * 1000, Vb = PI * 100 * 30, ma = Va * 7.85 / 1000, mb = Vb * 2.7 / 1000;
  // baricentro del gruppo: x 40, z -25, y pesato tra 5 e 15. Copia 2: girata di 180° attorno a Y: x → -40 + 200 = 160, z → 25.
  const yG = (ma * 5 + mb * 15) / (ma + mb), Mg = ma + mb, Mt = 2 * Mg + mb;
  const cx = (Mg * 40 + Mg * 160 + mb * 0) / Mt, cy = (2 * Mg * yG + mb * 115) / Mt, cz = (Mg * -25 + Mg * 25 + mb * 0) / Mt;
  return eqs([P2.pose.p[0], P2.pose.p[1], P2.pose.p[2], m.mass, m.volume, m.centroid[0], m.centroid[1], m.centroid[2], r.length, r[0].name === 'piastra' ? 1 : 0, r[0].qty, r[1].name === 'perno' ? 1 : 0, r[1].qty, r[1].mass, r.reduce((s, x) => s + x.mass, 0) - m.mass, r[1].prefix === top.insts[0].id + '/' + P2.id + '/' ? 1 : 0, G.id === 'A1' ? 1 : 0],
    [40, 0, -25, Mt, 2 * (Va + Vb) + Vb, cx, cy, cz, 2, 1, 2, 1, 3, 3 * mb, 0, 1, 1], 1e-5);
}]);
ASM.push(['Sottoassieme: si accoppia con le facce dei suoi pezzi (concentrico su un perno interno, coincidente); interferenze come un blocco; filetti interni portati fuori; non può contenere se stesso', () => {
  const { docs, infos, G, P1, P2 } = subSet();
  const H = plateHole(100, 100, 5, 50, 50, 10); const hi = Assembly.partInfo(H); infos.set('h', hi); docs.h = H;
  const top = Assembly.newAssembly('Macchina'); top.id = 'A2';
  const base = Assembly.addInst(top, 'h'), S = Assembly.addInst(top, 'A1', { pose: asmPose([300, 40, 100]) });
  // il cilindro del perno dentro il gruppo: nome nella scena del gruppo; la faccia bassa della piastra del gruppo
  const si = infos.get('A1'), cyl = [...new Set(si.st.body.map(p => p.t))].map(t => si.st.tags.get(t)).find(t => t.kind === 'rev' && t.inst === P2.id && t.R !== 0);
  const low = [...new Set(si.st.body.map(p => p.t))].map(t => si.st.tags.get(t)).find(t => t.kind === 'plane' && t.inst === P1.id && Math.abs(t.n[1] + 1) < 1e-9);
  asmMate(top, infos, 'concentric', base, asmRev(H), S, { k: 'face', name: cyl.name });
  asmMate(top, infos, 'coincident', base, asmFace(H, UP, 5), S, { k: 'face', name: low.name }, { s: -1 });
  const sol = Assembly.solve(top, infos);
  // asse del foro base in (50, y, -50), perno del gruppo in (40, y, -25): spostamento (10, ·, -25); y: la faccia bassa (0 nel gruppo) sulla faccia alta della base (5)
  const it = Assembly.interferences(top, infos);
  // gruppo abbassato di 5: la sua piastra entra per 5 nella base; il perno è nel foro della base. In comune (80×50 − π·10²)·5
  const py = S.pose.p[1]; S.pose.p[1] = 0; const it2 = Assembly.interferences(top, infos); S.pose.p[1] = py;
  const hasThread = Assembly.threadsWorld(top, infos).length;
  const A2 = Assembly.newAssembly('X'); A2.id = 'A3'; Assembly.addInst(A2, 'A1');
  const all = [G, top, A2];
  return eqs([sol.ok ? 1 : 0, S.pose.p[0], S.pose.p[1], S.pose.p[2], sol.dof.total, it.pairs, it.list.length, it2.list.length, it2.list[0].volume, hasThread, Assembly.containsAsm(A2, 'A1', all) ? 1 : 0, Assembly.containsAsm(G, 'A3', all) ? 1 : 0, Assembly.containsAsm(G, 'A1', all) ? 1 : 0],
    [1, 10, 5, -25, 1, 1, 0, 1, (4000 - PI * 100) * 5, 0, 1, 0, 1], 1e-6);
}]);
ASM.push(['Sottoassieme: filetti di una vite dentro seguono le due trasformazioni; componente senza solido non si conta', () => {
  const docs = { s: Model.fastenerDoc({ type: 'iso4762', size: 'M6', length: 20 }), e: D0('v'), n: block(5, 5, 5) }, infos = asmSet(docs);
  const G = Assembly.newAssembly('G'); G.id = 'A1'; Assembly.addInst(G, 's', { pose: asmPose([10, 0, 0]) }); Assembly.addInst(G, 'e'); Assembly.addInst(G, 'n', { pose: asmPose([100, 0, 0]) });
  infos.set('A1', Assembly.subInfo(G, infos));
  const top = Assembly.newAssembly('T'); top.id = 'A2'; Assembly.addInst(top, 'A1', { pose: asmPose([0, 0, 100], Assembly.qexp([0, 0, PI / 2])) });
  // base del filetto (0,-26,0) + (10,0,0) = (10,-26,0); ruotata attorno a Z: (26, 10, 0); poi (26, 10, 100)
  const t = Assembly.threadsWorld(top, infos)[0], m = Assembly.massOf(top, infos), b = Assembly.bom(top, infos);
  return eqs([...t.o, b.length, b[0].qty, b[1].solid ? 1 : 0, m.noSolid.length, m.comps.length, m.noMaterial.length, m.noMaterial[0] === 'n' ? 1 : 0], [26, 10, 100, 3, 1, 0, 0, 1, 1, 1]);
}]);

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
  // assiemi: numeri esatti (scarto assoluto, in mm), non la tolleranza dell'1 %
  for (const [name, fn] of ASM) {
    let ok = true; const msg = [], errs = {};
    try {
      const r = fn(); let worst = 0;
      r.exp.forEach((e, i) => { const q = Math.abs(r.got[i] - e); if (!(q <= r.tol)) { ok = false; msg.push('valore ' + i + ': ' + r.got[i] + ', atteso ' + e); } worst = Math.max(worst, q); });
      if (r.got.length !== r.exp.length) { ok = false; msg.push('numero di valori diverso'); }
      errs.S = worst;
    } catch (e) { ok = false; msg.push('ERRORE ' + e.message); }
    rows.push({ name: 'Assieme · ' + name, ok, errs, msg });
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
} else root.SelfTest = { run, count: () => CASES.length + SK.length + ASM.length };
})(this);
