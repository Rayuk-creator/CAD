// Generatore di piccoli file IGES per le prove: solidi a facce piane fatti di superfici tagliate
// (entità 144 su piani 108, contorni 102 di linee 110). Misure in millimetri.
'use strict';

function igesFaces(faces, name = 'prova') {
  const D = [], P = [];
  // ent: {type, form, params: [...]} → numero di riga D (dispari)
  const ents = [];
  const add = (type, params, form = 0, sub = 0) => { ents.push({ type, params, form, sub }); return 2 * ents.length - 1; };
  const num = x => { const s = String(+(+x).toFixed(9)); return /[.eE]/.test(s) ? s : s + '.'; };
  for (const pts of faces) {
    // normale (Newell) e piano
    const n = [0, 0, 0];
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); }
    const l = Math.hypot(...n); for (let k = 0; k < 3; k++) n[k] /= l;
    const d = n[0] * pts[0][0] + n[1] * pts[0][1] + n[2] * pts[0][2];
    const lines = pts.map((a, i) => { const b = pts[(i + 1) % pts.length]; return add(110, [...a, ...b], 0, 1); });
    const cc = add(102, [lines.length, ...lines], 0, 1);
    const pl = add(108, [n[0], n[1], n[2], d, 0, 0, 0, 0, 0], 0, 1);
    const cos = add(142, [1, pl, 0, cc, 2], 0, 1);
    add(144, [pl, 1, 0, cos]);
  }
  const pad = (s, w, left) => left ? String(s).padEnd(w) : String(s).padStart(w);
  let pline = 1;
  ents.forEach((e, k) => {
    const de = 2 * k + 1;
    // i parametri interi (puntatori, conteggi) restano interi
    const parts = [e.type, ...e.params.map(v => (e.type === 110 || e.type === 108) ? num(v) : String(v))].join(',') + ';';
    const chunks = []; let rest = parts; while (rest.length) { chunks.push(rest.slice(0, 64)); rest = rest.slice(64); }
    e.p = pline; e.np = chunks.length;
    for (const c of chunks) { P.push(pad(c, 64, true) + pad(de, 8) + 'P' + pad(pline, 7)); pline++; }
  });
  ents.forEach((e, k) => {
    const de = 2 * k + 1;
    const status = '000' + (e.sub ? '1' : '0') + '0000';
    D.push(pad(e.type, 8) + pad(e.p, 8) + pad(0, 8) + pad(0, 8) + pad(0, 8) + pad(0, 8) + pad(0, 8) + pad(0, 8) + pad(status, 8) + 'D' + pad(de, 7));
    D.push(pad(e.type, 8) + pad(0, 8) + pad(0, 8) + pad(e.np, 8) + pad(e.form, 8) + pad('', 8) + pad('', 8) + pad('', 8) + pad(0, 8) + 'D' + pad(de + 1, 7));
  });
  const S = [pad('Banco CAD prova IGES', 72, true) + 'S' + pad(1, 7)];
  const h = s => s.length + 'H' + s;
  const g = [',', ';', h(name), h(name + '.igs'), h('Banco CAD'), h('1'), 32, 38, 7, 308, 15, h(name), 1.0, 2, h('MM'), 1, 0.1, h('20261021.000000'), 1e-7, 1000.0, h(''), h(''), 11, 0, h('20261021.000000')]
    .map(v => typeof v === 'number' ? (Number.isInteger(v) && ![1.0, 1000.0].includes(v) ? String(v) : num(v)) : v);
  // 1H, e 1H; all'inizio (separatori)
  const gtxt = '1H,,1H;,' + g.slice(2).join(',') + ';';
  const G = []; let r = gtxt; while (r.length) { G.push(pad(r.slice(0, 72), 72, true) + 'G' + pad(G.length + 1, 7)); r = r.slice(72); }
  const T = 'S' + pad(S.length, 7) + 'G' + pad(G.length, 7) + 'D' + pad(D.length, 7) + 'P' + pad(P.length, 7) + pad('', 40) + 'T' + pad(1, 7);
  return [...S, ...G, ...D, ...P, T].join('\n') + '\n';
}

// parallelepipedo a × b × c con l'angolo nell'origine
function igesBox(a, b, c) {
  const p = (i, j, k) => [i * a, j * b, k * c];
  return igesFaces([
    [p(0, 0, 0), p(0, 1, 0), p(1, 1, 0), p(1, 0, 0)], [p(0, 0, 1), p(1, 0, 1), p(1, 1, 1), p(0, 1, 1)],
    [p(0, 0, 0), p(1, 0, 0), p(1, 0, 1), p(0, 0, 1)], [p(0, 1, 0), p(0, 1, 1), p(1, 1, 1), p(1, 1, 0)],
    [p(0, 0, 0), p(0, 0, 1), p(0, 1, 1), p(0, 1, 0)], [p(1, 0, 0), p(1, 1, 0), p(1, 1, 1), p(1, 0, 1)],
  ], 'blocco');
}

module.exports = { igesFaces, igesBox };
