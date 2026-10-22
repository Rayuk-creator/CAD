// Prove del Convertitore DWG → DXF (convertitore-dwg/index.html, con LibreDWG incorporato) e della lettura dei DXF
// che ne escono nel Banco CAD.
// Uso: node tests/dwg.test.js [convertitore-dwg/index.html] [cartella dei moduli estratti]
//      (prima: node tests/extract.js index.html tests/core)
// Per ogni DWG di prova: conversione senza errori gravi, DXF completo (EOF) della stessa versione del DWG, e lettura nel
// Banco CAD. Dove c'è un DXF di riferimento (dati di prova di LibreDWG, prove/riferimento) il disegno convertito deve
// coincidere con quello: stesse entità nel file (linee, archi, cerchi, polilinee, ellissi, spline, blocchi), stessa lunghezza
// totale e stesso ingombro come li legge il Banco CAD. Le spline: LibreDWG le scrive con i soli punti di passaggio, il
// riferimento con la curva NURBS calcolata da AutoCAD; il Banco CAD ricostruisce la curva dai punti, quindi si misura lo
// scostamento tra le due curve (e il numero di archi che ne ricava può essere diverso).
// Lo stesso disegno salvato come DWG 2000 e DWG 2013 deve dare lo stesso risultato. Tolleranza 1 % (TOL).
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..');
const page = process.argv[2] || path.join(ROOT, 'convertitore-dwg', 'index.html');
const dir = path.resolve(process.argv[3] || path.join(__dirname, 'core'));
const IM = require(path.join(dir, 'model.js')).Import;
const PROVE = path.join(path.dirname(page), 'prove');
const TOL = +(process.env.TOL || 0.01);

// misure del disegno come lo legge il Banco CAD (tutti i layer): numero di entità per tipo, lunghezza totale, ingombro
function measure(u8) {
  const r = IM.parseDXF(u8);
  const n = { line: 0, arc: 0, circle: 0 }, mn = [Infinity, Infinity], mx = [-Infinity, -Infinity];
  let L = 0;
  const grow = p => { mn[0] = Math.min(mn[0], p[0]); mn[1] = Math.min(mn[1], p[1]); mx[0] = Math.max(mx[0], p[0]); mx[1] = Math.max(mx[1], p[1]); };
  for (const g of r.geo) {
    n[g.t] = (n[g.t] || 0) + 1;
    if (g.t === 'line') { L += Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]); grow(g.a); grow(g.b); }
    else {
      let a0 = g.t === 'circle' ? 0 : g.a0, a1 = g.t === 'circle' ? 2 * Math.PI : g.a1;
      while (a1 <= a0) a1 += 2 * Math.PI;
      L += g.r * (a1 - a0);
      for (let k = 0; k <= 64; k++) { const a = a0 + (a1 - a0) * k / 64; grow([g.c[0] + g.r * Math.cos(a), g.c[1] + g.r * Math.sin(a)]); }
    }
  }
  return { n, L, w: mx[0] - mn[0], h: mx[1] - mn[1], unit: r.unit, total: r.geo.length };
}
// entità della sezione ENTITIES del DXF (come sono scritte nel file)
function rawEntities(u8) {
  const L = Buffer.from(u8).toString('latin1').split(/\r?\n/), n = {};
  let sec = null;
  for (let i = 0; i + 1 < L.length; i += 2) {
    const c = L[i].trim(), v = L[i + 1].trim();
    if (c === '0' && v === 'SECTION') { sec = (L[i + 3] || '').trim(); continue; }
    if (c === '0' && v === 'ENDSEC') { sec = null; continue; }
    if (sec === 'ENTITIES' && c === '0' && v !== 'VERTEX' && v !== 'SEQEND') n[v] = (n[v] || 0) + 1;
  }
  return n;
}
// le SPLINE del DXF, ognuna come piccolo DXF a sé
function splineFiles(u8) {
  const L = Buffer.from(u8).toString('latin1').split(/\r?\n/), out = [];
  let sec = null, cur = null;
  for (let i = 0; i + 1 < L.length; i += 2) {
    const c = L[i].trim(), v = L[i + 1].trim();
    if (c === '0' && v === 'SECTION') { sec = (L[i + 3] || '').trim(); continue; }
    if (sec !== 'ENTITIES') continue;
    if (c === '0') { if (cur) out.push(cur); cur = v === 'SPLINE' ? ['  0', 'SPLINE'] : null; } else if (cur) cur.push(L[i], L[i + 1]);
  }
  if (cur) out.push(cur);
  return out.map(e => new TextEncoder().encode(['  0', 'SECTION', '  2', 'ENTITIES', ...e, '  0', 'ENDSEC', '  0', 'EOF', ''].join('\n')));
}
// scostamento massimo della curva a dalla curva b (punti fitti sugli archi e le linee che ne ricava il Banco CAD)
function curveGap(a, b) {
  const pts = geo => { const P = []; for (const g of geo) { if (g.t === 'line') { for (let k = 0; k <= 100; k++) P.push([g.a[0] + (g.b[0] - g.a[0]) * k / 100, g.a[1] + (g.b[1] - g.a[1]) * k / 100]); } else { let a0 = g.a0, a1 = g.a1; while (a1 <= a0) a1 += 2 * Math.PI; for (let k = 0; k <= 100; k++) { const t = a0 + (a1 - a0) * k / 100; P.push([g.c[0] + g.r * Math.cos(t), g.c[1] + g.r * Math.sin(t)]); } } } return P; };
  const segd = (p, q, r) => { const dx = r[0] - q[0], dy = r[1] - q[1], L2 = dx * dx + dy * dy; let t = L2 ? ((p[0] - q[0]) * dx + (p[1] - q[1]) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - q[0] - dx * t, p[1] - q[1] - dy * t); };
  const A = pts(IM.parseDXF(a).geo), B = pts(IM.parseDXF(b).geo);
  let m = 0;
  for (const p of A) { let d = Infinity; for (let k = 0; k + 1 < B.length; k++) d = Math.min(d, segd(p, B[k], B[k + 1])); m = Math.max(m, d); }
  const xs = B.map(p => p[0]), ys = B.map(p => p[1]);
  return { gap: m, size: Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) };
}
const acadver = u8 => { const m = /\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*(\S+)/.exec(Buffer.from(u8.subarray(0, 4096)).toString('latin1')); return m ? m[1] : ''; };

(async () => {
  // il lettore preso dalla pagina, come fa il browser: modulo JS + wasm compresso
  const html = fs.readFileSync(page, 'utf8');
  const js = (html.match(/<script id="dwgJs" type="text\/plain">([\s\S]*?)<\/script>/) || [])[1];
  const b64 = (html.match(/<script id="dwgWasm" type="application\/octet-stream">([\s\S]*?)<\/script>/) || [])[1];
  const rows = [];
  const rec = (name, ok, msg) => { rows.push(ok); console.log((ok ? 'OK  ' : 'NO  ') + name + (msg ? '\n      ' + msg : '')); };
  if (!js || !b64) { rec('Lettore DWG presente nella pagina', false, 'mancano dwgJs o dwgWasm'); process.exit(1); }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dwg-'));
  const modPath = path.join(tmp, 'libredwg-web.mjs');
  fs.writeFileSync(modPath, js);
  const createModule = (await import('file://' + modPath)).default;
  const wasmBinary = zlib.gunzipSync(Buffer.from(b64.trim(), 'base64'));
  const M = await createModule({ wasmBinary, locateFile: f => f, print: () => {}, printErr: () => {} });
  // la stessa funzione della pagina (copiata dalla pagina, così si prova quella)
  const src = (html.match(/function runConvert\(M, data\) \{[\s\S]*?\n  \}\n/) || [])[0];
  if (!src) { rec('Funzione di conversione trovata nella pagina', false); process.exit(1); }
  const runConvert = new Function('return ' + src)();

  const CASES = [
    // [file, versione del DXF attesa, riferimento, entità minime lette dal Banco CAD]
    ['entita-r11.dwg', 'AC1009', 'entita-r11.dxf'],
    ['v-r14.dwg', 'AC1014', null, { line: 16 }],
    ['esempio-2000.dwg', 'AC1015', 'esempio-2013.dxf'],
    ['linea-2004.dwg', 'AC1018', null, { line: 1 }],
    ['cerchio-2010.dwg', 'AC1024', null, { circle: 1 }],
    ['esempio-2013.dwg', 'AC1027', 'esempio-2013.dxf'],
    ['arco-2018.dwg', 'AC1032', null, { arc: 1 }],
  ];
  const got = {};
  for (const [file, ver, ref, min] of CASES) {
    const name = 'DWG → DXF: ' + file;
    try {
      const data = new Uint8Array(fs.readFileSync(path.join(PROVE, file)));
      const t0 = Date.now();
      const r = runConvert(M, data);
      const ms = Date.now() - t0;
      if (!r.dxf || r.err >= 128) { rec(name, false, 'conversione non riuscita, codice ' + r.err); continue; }
      const txt = Buffer.from(r.dxf).toString('latin1');
      const v = acadver(r.dxf), eof = /\n\s*0\s*\r?\nEOF\s*$/.test(txt);
      const m = measure(r.dxf);
      m.raw = rawEntities(r.dxf); m.dxf = r.dxf;
      got[file] = m;
      const msg = [`codice ${r.err}, DXF ${v}, ${r.dxf.length} byte, ${ms} ms; Banco CAD: ${m.n.line} linee, ${m.n.arc} archi, ${m.n.circle} cerchi, L ${m.L.toFixed(3)}, ingombro ${m.w.toFixed(3)} × ${m.h.toFixed(3)}`];
      let ok = v === ver && eof && m.total > 0;
      if (min) for (const [k, x] of Object.entries(min)) if ((m.n[k] || 0) !== x) { ok = false; msg.push(`${k}: ${m.n[k] || 0} invece di ${x}`); }
      if (ref) {
        const refData = new Uint8Array(fs.readFileSync(path.join(PROVE, 'riferimento', ref)));
        const e = measure(refData), eraw = rawEntities(refData);
        const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-9);
        const errs = { L: rel(m.L, e.L), w: rel(m.w, e.w), h: rel(m.h, e.h) };
        const KINDS = ['LINE', 'ARC', 'CIRCLE', 'LWPOLYLINE', 'POLYLINE', 'ELLIPSE', 'SPLINE', 'INSERT'];
        const diff = KINDS.filter(k => (m.raw[k] || 0) !== (eraw[k] || 0)).map(k => `${k} ${m.raw[k] || 0} invece di ${eraw[k] || 0}`);
        msg.push(`riferimento ${ref}: ${KINDS.filter(k => eraw[k]).map(k => k + ' ' + eraw[k]).join(', ')} (nel convertito ${diff.length ? diff.join(', ') : 'uguali'}); L ${e.L.toFixed(3)}, ingombro ${e.w.toFixed(3)} × ${e.h.toFixed(3)}; scarti L ${(100 * errs.L).toFixed(4)} %, ingombro ${(100 * errs.w).toFixed(4)} % × ${(100 * errs.h).toFixed(4)} %`);
        if (diff.length || Object.values(errs).some(x => x > TOL)) ok = false;
      }
      if (v !== ver) msg.push(`versione ${v} invece di ${ver}`);
      if (!eof) msg.push('il DXF non finisce con EOF');
      rec(name, ok, msg.join('\n      '));
    } catch (e) { rec(name, false, 'ERRORE ' + e.message); }
  }
  // lo stesso disegno in due versioni di DWG
  const a = got['esempio-2000.dwg'], b = got['esempio-2013.dwg'];
  rec('Lo stesso disegno da DWG 2000 e da DWG 2013 dà lo stesso DXF (entità, lunghezza, ingombro)',
    !!a && !!b && JSON.stringify(a.n) === JSON.stringify(b.n) && Math.abs(a.L - b.L) <= 1e-6 * b.L && Math.abs(a.w - b.w) <= 1e-6 * b.w && Math.abs(a.h - b.h) <= 1e-6 * b.h,
    a && b ? `2000: L ${a.L.toFixed(6)}; 2013: L ${b.L.toFixed(6)}` : '');
  // spline: la curva ricostruita dai punti di passaggio (convertito) contro la NURBS di AutoCAD (riferimento)
  try {
    const conv = splineFiles(got['esempio-2013.dwg'].dxf), ref = splineFiles(new Uint8Array(fs.readFileSync(path.join(PROVE, 'riferimento', 'esempio-2013.dxf'))));
    const gaps = conv.map((c, i) => curveGap(c, ref[i]));
    rec('Spline dell\'esempio 2013: curva dai punti di passaggio uguale a quella di AutoCAD entro l\'1 % della sua grandezza', conv.length === 2 && ref.length === 2 && gaps.every(g => g.gap <= TOL * g.size),
      gaps.map((g, i) => `spline ${i + 1}: scostamento massimo ${g.gap.toFixed(3)} mm su una curva di ${g.size.toFixed(1)} mm (${(100 * g.gap / g.size).toFixed(3)} %)`).join('; '));
  } catch (e) { rec('Spline dell\'esempio 2013: curva dai punti di passaggio uguale a quella di AutoCAD entro l\'1 % della sua grandezza', false, 'ERRORE ' + e.message); }
  // file sbagliati: niente blocchi, codice d'errore grave
  try {
    const r1 = runConvert(M, new TextEncoder().encode('questo non è un disegno'));
    const r2 = runConvert(M, new Uint8Array(fs.readFileSync(path.join(PROVE, 'esempio-2013.dwg'))).slice(0, 4000));
    const r3 = runConvert(M, new Uint8Array(fs.readFileSync(path.join(PROVE, 'v-r14.dwg'))));   // il lettore funziona ancora dopo gli errori
    rec('File non DWG e DWG troncato: errore grave, nessun DXF; poi il lettore funziona ancora', r1.err >= 128 && !r1.dxf && r2.err >= 128 && !r2.dxf && r3.err < 128 && !!r3.dxf,
      `testo: codice ${r1.err}; troncato: codice ${r2.err}; dopo: codice ${r3.err}, ${r3.dxf ? r3.dxf.length : 0} byte`);
  } catch (e) { rec('File non DWG e DWG troncato: errore grave, nessun DXF; poi il lettore funziona ancora', false, 'ERRORE ' + e.message); }
  // il Banco CAD apre il DXF anche dentro uno .zip (come lo salva la pagina pubblicata), compresso o no
  try {
    const dxf = new Uint8Array(fs.readFileSync(path.join(PROVE, 'riferimento', 'entita-r11.dxf')));
    const pjs = html.match(/function crc32\(u8\) \{.*\n  function zipOne\(name, u8\) \{[\s\S]*?\n  \}\n/)[0];
    const zipOne = new Function(pjs + '; return zipOne;')();
    const stored = new Uint8Array(await zipOne('disegno.dxf', dxf).arrayBuffer());
    // archivio compresso (metodo 8), scritto qui a mano con zlib
    const def = zlib.deflateRawSync(dxf), nm = Buffer.from('cartella/pezzo.dxf');
    const crc = zlib.crc32 ? zlib.crc32(dxf) : null;
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8); if (crc !== null) lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(def.length, 18); lh.writeUInt32LE(dxf.length, 22); lh.writeUInt16LE(nm.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10); if (crc !== null) ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(def.length, 20); ch.writeUInt32LE(dxf.length, 24); ch.writeUInt16LE(nm.length, 28);
    const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(46 + nm.length, 12); end.writeUInt32LE(30 + nm.length + def.length, 16);
    const deflated = new Uint8Array(Buffer.concat([lh, nm, def, ch, nm, end]));
    const u1 = await IM.unzipDxf(stored), u2 = await IM.unzipDxf(deflated);
    const same = x => x.length === dxf.length && x.every((v, i) => v === dxf[i]);
    let msgs = [];
    for (const bad of [new TextEncoder().encode('PK non zip'), new Uint8Array(await zipOne('disegno.dwg', dxf).arrayBuffer())]) { try { await IM.unzipDxf(bad); msgs.push('nessun errore'); } catch (e) { msgs.push(e.message); } }
    rec('Il Banco CAD apre il DXF dentro uno .zip (senza compressione e compresso)', u1.name === 'disegno.dxf' && same(u1.data) && u2.name === 'pezzo.dxf' && same(u2.data) && /danneggiato/.test(msgs[0]) && /c'è un DWG/.test(msgs[1]),
      `${u1.name} ${u1.data.length} byte, ${u2.name} ${u2.data.length} byte (originale ${dxf.length}); messaggi: «${msgs.join('» «')}»`);
  } catch (e) { rec('Il Banco CAD apre il DXF dentro uno .zip (senza compressione e compresso)', false, 'ERRORE ' + e.message); }
  fs.rmSync(tmp, { recursive: true, force: true });
  const fail = rows.filter(x => !x).length;
  console.log(`\n${rows.length - fail}/${rows.length} superati (tolleranza ${(TOL * 100).toFixed(1)}%)`);
  process.exit(fail ? 1 : 0);
})();
