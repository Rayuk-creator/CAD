// Generatore di piccoli file STEP (AP214) per le prove: geometria semplice, valori calcolabili a mano.
// Ogni funzione restituisce il testo del file; le misure sono in millimetri salvo opts.unit.
'use strict';

function writer() {
  const L = [];
  const add = s => { L.push(s); return '#' + L.length; };
  const n = x => { const s = String(+x); return /[.eE]/.test(s) ? s : s + '.'; };
  const pt = (x, y, z) => add(`CARTESIAN_POINT('',(${n(x)},${n(y)},${n(z)}))`);
  const dir = (x, y, z) => add(`DIRECTION('',(${n(x)},${n(y)},${n(z)}))`);
  const ax = (o, z = [0, 0, 1], x = [1, 0, 0]) => add(`AXIS2_PLACEMENT_3D('',${pt(...o)},${dir(...z)},${dir(...x)})`);
  const vtx = p => add(`VERTEX_POINT('',${pt(...p)})`);
  const line = (a, b) => {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d);
    const p0 = pt(...a), vec = add(`VECTOR('',${dir(d[0] / l, d[1] / l, d[2] / l)},${n(l)})`);
    return add(`LINE('',${p0},${vec})`);
  };
  const circle = (o, r) => add(`CIRCLE('',${ax(o)},${n(r)})`);
  const cyl = (o, r) => add(`CYLINDRICAL_SURFACE('',${ax(o)},${n(r)})`);
  const edge = (v0, v1, c) => add(`EDGE_CURVE('',${v0},${v1},${c},.T.)`);
  const oe = (e, s) => add(`ORIENTED_EDGE('',*,*,${e},${s ? '.T.' : '.F.'})`);
  const loop = list => add(`EDGE_LOOP('',(${list.join(',')}))`);
  const face = (bounds, surf, same) => add(`ADVANCED_FACE('',(${bounds.join(',')}),${surf},${same ? '.T.' : '.F.'})`);
  const outer = lp => add(`FACE_OUTER_BOUND('',${lp},.T.)`);
  const inner = lp => add(`FACE_BOUND('',${lp},.T.)`);
  const plane = (o, z, x) => add(`PLANE('',${ax(o, z, x)})`);
  // file completo: un solido per ogni elenco di facce.
  // styles: colori [{solid: k} oppure {face: id}, rgb: [r, g, b] da 0 a 1] (STYLED_ITEM, come li scrivono SolidWorks e gli altri)
  const finish = (name, solids, unit = 'mm', styles = []) => {
    const U = { mm: 'SI_UNIT(.MILLI.,.METRE.)', m: 'SI_UNIT($,.METRE.)', cm: 'SI_UNIT(.CENTI.,.METRE.)' }[unit];
    const lu = add(`( LENGTH_UNIT() NAMED_UNIT(*) ${U} )`);
    const au = add('( NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.) )');
    const su = add('( NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT() )');
    const unc = add(`UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-07),${lu},'distance_accuracy_value','')`);
    const ctx = add(`( GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((${unc})) GLOBAL_UNIT_ASSIGNED_CONTEXT((${lu},${au},${su})) REPRESENTATION_CONTEXT('','') )`);
    const breps = solids.map((faces, k) => add(`MANIFOLD_SOLID_BREP('${name}${solids.length > 1 ? k + 1 : ''}',${add(`CLOSED_SHELL('',(${faces.join(',')}))`)})`));
    if (styles.length) {
      const items = styles.map(st => {
        const c = add(`COLOUR_RGB('',${st.rgb.map(n).join(',')})`);
        const fa = add(`FILL_AREA_STYLE('',(${add(`FILL_AREA_STYLE_COLOUR('',${c})`)}))`);
        const ss = add(`SURFACE_SIDE_STYLE('',(${add(`SURFACE_STYLE_FILL_AREA(${fa})`)}))`);
        const psa = add(`PRESENTATION_STYLE_ASSIGNMENT((${add(`SURFACE_STYLE_USAGE(.BOTH.,${ss})`)}))`);
        return add(`STYLED_ITEM('',(${psa}),${st.solid !== undefined ? breps[st.solid] : st.face})`);
      });
      add(`MECHANICAL_DESIGN_GEOMETRIC_PRESENTATION_REPRESENTATION('',(${items.join(',')}),${ctx})`);
    }
    const rep = add(`ADVANCED_BREP_SHAPE_REPRESENTATION('',(${breps.join(',')},${ax([0, 0, 0])}),${ctx})`);
    const ac = add("APPLICATION_CONTEXT('automotive design')");
    add(`APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,${ac})`);
    const pc = add(`PRODUCT_CONTEXT('',${ac},'mechanical')`);
    const pr = add(`PRODUCT('${name}','${name}','',(${pc}))`);
    const pf = add(`PRODUCT_DEFINITION_FORMATION('','',${pr})`);
    const pdc = add(`PRODUCT_DEFINITION_CONTEXT('part definition',${ac},'design')`);
    const pd = add(`PRODUCT_DEFINITION('design','',${pf},${pdc})`);
    const pds = add(`PRODUCT_DEFINITION_SHAPE('','',${pd})`);
    add(`SHAPE_DEFINITION_REPRESENTATION(${pds},${rep})`);
    return 'ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION((\'Banco CAD prova\'),\'2;1\');\nFILE_NAME(\'' + name + '.stp\',\'2026-10-21T00:00:00\',(\'\'),(\'\'),\'\',\'\',\'\');\nFILE_SCHEMA((\'AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }\'));\nENDSEC;\nDATA;\n' +
      L.map((s, i) => '#' + (i + 1) + '=' + s + ';').join('\n') + '\nENDSEC;\nEND-ISO-10303-21;\n';
  };
  return { add, n, circle, cyl, pt, dir, ax, vtx, line, edge, oe, loop, face, outer, inner, plane, finish };
}

// parallelepipedo da (x0,y0,z0) a (x0+a, y0+b, z0+c): 6 facce piane
function boxFaces(W, a, b, c, o = [0, 0, 0], hole) {
  const P = (i, j, k) => [o[0] + i * a, o[1] + j * b, o[2] + k * c];
  const V = {}; for (const i of [0, 1]) for (const j of [0, 1]) for (const k of [0, 1]) V[i + '' + j + k] = W.vtx(P(i, j, k));
  const E = {};
  const e = (p, q) => { const key = p < q ? p + q : q + p; if (!E[key]) E[key] = { id: W.edge(V[p < q ? p : q], V[p < q ? q : p], W.line(P(...(p < q ? p : q).split('').map(Number)), P(...(p < q ? q : p).split('').map(Number)))), from: p < q ? p : q }; return W.oe(E[key].id, E[key].from === p); };
  // ogni faccia: vertici in senso antiorario visti da fuori, normale esterna
  const F = [
    [['000', '010', '110', '100'], [0, 0, -1]], [['001', '101', '111', '011'], [0, 0, 1]],
    [['000', '100', '101', '001'], [0, -1, 0]], [['010', '011', '111', '110'], [0, 1, 0]],
    [['000', '001', '011', '010'], [-1, 0, 0]], [['100', '110', '111', '101'], [1, 0, 0]],
  ];
  const faces = [];
  for (const [vs, nn] of F) {
    const lp = W.loop(vs.map((v, i) => e(v, vs[(i + 1) % 4])));
    const bounds = [W.outer(lp)];
    const x = Math.abs(nn[2]) ? [1, 0, 0] : [0, 0, 1];
    if (hole && Math.abs(nn[2])) bounds.push(W.inner(nn[2] < 0 ? hole.botLoop : hole.topLoop));
    faces.push(W.face(bounds, W.plane(P(...vs[0].split('').map(Number)), nn, x), true));
  }
  return faces;
}
// foro cilindrico passante lungo Z, centro (cx, cy), raggio r, da z0 a z1 (superficie con normale verso l'asse)
function holeLoops(W, cx, cy, r, z0, z1) {
  const c0 = W.circle([cx, cy, z0], r), c1 = W.circle([cx, cy, z1], r);
  const v0 = W.vtx([cx + r, cy, z0]), v1 = W.vtx([cx + r, cy, z1]);
  const e0 = W.edge(v0, v0, c0), e1 = W.edge(v1, v1, c1), seam = W.edge(v0, v1, W.line([cx + r, cy, z0], [cx + r, cy, z1]));
  // dalla parte del materiale il cerchio in basso gira in senso orario visto dal basso…
  const botLoop = W.loop([W.oe(e0, true)]), topLoop = W.loop([W.oe(e1, false)]);
  const sideLoop = W.loop([W.oe(e0, false), W.oe(seam, true), W.oe(e1, true), W.oe(seam, false)]);
  const surf = W.cyl([cx, cy, z0], r);
  return { botLoop, topLoop, side: W.face([W.inner(sideLoop)], surf, false) };
}

// cubo / parallelepipedo a × b × c
function stepBox(a, b, c, opts = {}) {
  const W = writer();
  return W.finish(opts.name || 'blocco', [boxFaces(W, a, b, c, opts.at || [0, 0, 0])], opts.unit);
}
// cilindro di raggio r e altezza h, asse Z, base sul piano XY
function stepCylinder(r, h, opts = {}) {
  const W = writer();
  const c0 = W.circle([0, 0, 0], r), c1 = W.circle([0, 0, h], r);
  const v0 = W.vtx([r, 0, 0]), v1 = W.vtx([r, 0, h]);
  const e0 = W.edge(v0, v0, c0), e1 = W.edge(v1, v1, c1), seam = W.edge(v0, v1, W.line([r, 0, 0], [r, 0, h]));
  const bot = W.face([W.outer(W.loop([W.oe(e0, false)]))], W.plane([0, 0, 0], [0, 0, -1], [1, 0, 0]), true);
  const top = W.face([W.outer(W.loop([W.oe(e1, true)]))], W.plane([0, 0, h], [0, 0, 1], [1, 0, 0]), true);
  const side = W.face([W.outer(W.loop([W.oe(e0, true), W.oe(seam, true), W.oe(e1, false), W.oe(seam, false)]))], W.cyl([0, 0, 0], r), true);
  return W.finish(opts.name || 'cilindro', [[bot, top, side]], opts.unit);
}
// piastra a × b × c con un foro passante di raggio r al centro
function stepPlateHole(a, b, c, r, opts = {}) {
  const W = writer();
  const h = holeLoops(W, a / 2, b / 2, r, 0, c);
  return W.finish(opts.name || 'piastra', [boxFaces(W, a, b, c, [0, 0, 0], h).concat([h.side])], opts.unit);
}
// due blocchi separati nello stesso file (assieme semplice)
function stepTwoBoxes(a, gap, opts = {}) {
  const W = writer();
  return W.finish(opts.name || 'due', [boxFaces(W, a, a, a), boxFaces(W, a, a, a, [a + gap, 0, 0])], opts.unit);
}

// due blocchi a × a × a a distanza gap: il primo blu con la faccia di sotto (z = 0) rossa, il secondo senza colore
function stepTwoBoxesColored(a, gap, opts = {}) {
  const W = writer();
  const b1 = boxFaces(W, a, a, a), b2 = boxFaces(W, a, a, a, [a + gap, 0, 0]);
  return W.finish(opts.name || 'colori', [b1, b2], opts.unit, [{ solid: 0, rgb: [0, 0, 1] }, { face: b1[0], rgb: [1, 0, 0] }]);
}

module.exports = { stepBox, stepCylinder, stepPlateHole, stepTwoBoxes, stepTwoBoxesColored };
