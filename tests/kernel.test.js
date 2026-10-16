// Test del nucleo geometrico del Banco CAD: ogni caso ha valori di riferimento calcolati a mano.
// Node: node kernel.test.js [cartella dei moduli]   (tolleranza relativa TOL, default 1%)
// Browser: SelfTest.run() restituisce le righe dei risultati.
(function (root) {
const isNode = typeof module !== 'undefined' && typeof window === 'undefined';
const path = isNode ? require('path') : null;
const dir = isNode ? path.resolve(process.argv[2] || path.join(__dirname, 'core')) : null;
const Model = isNode ? require(path.join(dir, 'model.js')) : root.Model;
const Sketch = isNode ? require(path.join(dir, 'sketch.js')) : root.Sketch;
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

// materiale
T('Massa acciaio S235 (blocco 80×50×10)', () => { const d = box(); d.material = 's235'; return d; }, { V: 40000, M: 40000 * 7.85 / 1000 });

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
      if (c.exp.A !== undefined) errs.A = chk('Area', mp.area, c.exp.A);
      if (c.exp.M !== undefined) errs.M = chk('Massa', mp.mass, c.exp.M);
      if (c.exp.C) errs.C = Math.max(...c.exp.C.map((e, i) => chk('Baricentro ' + 'xyz'[i], mp.centroid[i], e, size)));
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
