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
    // le funzioni della pagina: crc32, zipMany e zipOne (un file solo)
    const pjs = (html.match(/  function crc32\(u8\) \{.*\n/) || [])[0] + html.slice(html.indexOf('  function zipMany(files) {'), html.indexOf('  // salva lo .zip'));
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
  // memoria del lettore: nel modulo WebAssembly la memoria iniziale è 16 MB (libredwg-web la compila con 1 GB, che sui
  // tablet non c'è); la memoria cresce da sola: con 300 MB occupati la conversione dà lo stesso DXF, byte per byte
  try {
    const wasm = zlib.gunzipSync(Buffer.from(b64.trim(), 'base64'));
    let p = 8, mem = null; const leb = () => { let r = 0, sh = 0, x; do { x = wasm[p++]; r += (x & 0x7f) * 2 ** sh; sh += 7; } while (x & 0x80); return r; };
    while (p < wasm.length) { const id = wasm[p++], size = leb(), st = p; if (id === 5) { leb(); const fl = wasm[p++]; const ini = leb(); mem = { ini, max: fl & 1 ? leb() : null }; } p = st + size; }
    let ex = null;
    const M2 = await createModule({ wasmBinary: wasm, locateFile: f => f, print: () => {}, printErr: () => {},
      instantiateWasm: (imports, cb) => { WebAssembly.instantiate(wasm, imports).then(r => { ex = r.instance.exports; cb(r.instance, r.module); }); return {}; } });
    const MB = () => ex.memory.buffer.byteLength / 1048576;
    const m0 = MB();
    const big = new Uint8Array(fs.readFileSync(path.join(PROVE, 'esempio-2000.dwg')));
    const ref = runConvert(M, big);
    const ptrs = []; for (let i = 0; i < 6; i++) ptrs.push(ex.malloc(50 * 1048576));
    const m1 = MB(), r = runConvert(M2, big); ptrs.forEach(q => ex.free(q));
    const same = r.err === ref.err && Buffer.compare(Buffer.from(r.dxf), Buffer.from(ref.dxf)) === 0;
    rec('Lettore con la memoria iniziale di 16 MB (prima 1 GB) che cresce da sola: con 300 MB occupati lo stesso DXF, byte per byte',
      mem && mem.ini === 256 && mem.max === 65536 && m0 <= 20 && ptrs.every(q => q > 0) && m1 >= 300 && same,
      `memoria nel modulo: ${mem && mem.ini * 64 / 1024} MB iniziali, ${mem && mem.max * 64 / 1024} MB al massimo; all'avvio ${m0.toFixed(1)} MB, dopo 6 blocchi da 50 MB ${m1.toFixed(0)} MB; DXF ${same ? 'uguale' : 'DIVERSO'} (${r.dxf ? r.dxf.length : 0} byte)`);
  } catch (e) { rec('Lettore con la memoria iniziale di 16 MB (prima 1 GB) che cresce da sola: con 300 MB occupati lo stesso DXF, byte per byte', false, 'ERRORE ' + e.message); }

  // anteprima del convertitore (la funzione della pagina): stesso ingombro che misura il Banco CAD, per tutti i DWG di prova
  try {
    const src = html.slice(html.indexOf('  function preview(u8) {'), html.indexOf('  const SVGNS'));
    const preview = new Function(src + '; return preview;')();
    const msg = []; let ok = true;
    for (const f of fs.readdirSync(PROVE).filter(x => x.endsWith('.dwg')).sort()) {
      const r = runConvert(M, new Uint8Array(fs.readFileSync(path.join(PROVE, f))));
      // ingombro esatto di quello che legge il Banco CAD (archi: estremi e punti dei quadranti)
      const geo = IM.parseDXF(r.dxf).geo, mn = [Infinity, Infinity], mx = [-Infinity, -Infinity];
      const grow = q => { mn[0] = Math.min(mn[0], q[0]); mn[1] = Math.min(mn[1], q[1]); mx[0] = Math.max(mx[0], q[0]); mx[1] = Math.max(mx[1], q[1]); };
      for (const g of geo) { if (g.t === 'line') { grow(g.a); grow(g.b); continue; } const a0 = g.t === 'circle' ? 0 : g.a0; let a1 = g.t === 'circle' ? 2 * Math.PI : g.a1; while (a1 <= a0) a1 += 2 * Math.PI;
        for (const a of [a0, a1]) grow([g.c[0] + g.r * Math.cos(a), g.c[1] + g.r * Math.sin(a)]); for (let q = Math.ceil(a0 / (Math.PI / 2)); q * Math.PI / 2 <= a1; q++) grow([g.c[0] + g.r * Math.cos(q * Math.PI / 2), g.c[1] + g.r * Math.sin(q * Math.PI / 2)]); }
      const m = { w: mx[0] - mn[0], h: mx[1] - mn[1] };
      const pv = preview(r.dxf);
      const w = pv.ext[2] - pv.ext[0], h = pv.ext[3] - pv.ext[1], s = Math.max(m.w, m.h);
      const good = Math.abs(w - m.w) <= 1e-6 * s && Math.abs(h - m.h) <= 1e-6 * s && pv.count > 0;
      if (!good) ok = false;
      msg.push(`${f}: ${pv.count} elementi, ${w.toFixed(3)} × ${h.toFixed(3)} (Banco CAD ${m.w.toFixed(3)} × ${m.h.toFixed(3)})`);
    }
    rec('Anteprima del disegno nel convertitore: stesso ingombro del Banco CAD (blocchi con scala diversa in x e y saltati come nel Banco CAD)', ok, msg.join('; '));
  } catch (e) { rec('Anteprima del disegno nel convertitore: stesso ingombro del Banco CAD', false, 'ERRORE ' + e.message); }

  // «Salva tutti i DXF»: più disegni in un solo .zip (due con lo stesso nome); il Banco CAD elenca tutti i DXF e apre quello scelto
  try {
    const crcSrc = (html.match(/  function crc32\(u8\) \{.*\n/) || [])[0], zSrc = html.slice(html.indexOf('  function zipMany(files) {'), html.indexOf('  const zipOne ='));
    const zipMany = new Function(crcSrc + zSrc + '; return zipMany;')();
    const conv = f => runConvert(M, new Uint8Array(fs.readFileSync(path.join(PROVE, f)))).dxf;
    const a = conv('v-r14.dwg'), b = conv('arco-2018.dwg'), c = conv('cerchio-2010.dwg');
    const zip = new Uint8Array(await zipMany([{ name: 'porta.dxf', data: a }, { name: 'pezzo.dxf', data: b }, { name: 'pezzo.dxf', data: c }]).arrayBuffer());
    const z0 = await IM.unzipDxf(zip), z2 = await IM.unzipDxf(zip, 'pezzo (2).dxf'), z1 = await IM.unzipDxf(zip, 'pezzo.dxf');
    const same = (x, y) => x.length === y.length && Buffer.compare(Buffer.from(x), Buffer.from(y)) === 0;
    rec('«Salva tutti i DXF»: tre disegni in un solo .zip (nomi uguali resi diversi); il Banco CAD li elenca e apre quello scelto',
      z0.dxfs.join('|') === 'porta.dxf|pezzo.dxf|pezzo (2).dxf' && z0.name === 'porta.dxf' && same(z0.data, a) && z1.name === 'pezzo.dxf' && same(z1.data, b) && z2.name === 'pezzo (2).dxf' && same(z2.data, c),
      `nello zip: ${z0.dxfs.join(', ')} (${zip.length} byte); aperti: ${[z0, z1, z2].map(z => z.name + ' ' + z.data.length + ' byte').join(', ')}`);
  } catch (e) { rec('«Salva tutti i DXF»: tre disegni in un solo .zip; il Banco CAD li elenca e apre quello scelto', false, 'ERRORE ' + e.message); }

  // Codifica dei caratteri dichiarata nella pagina (entro i primi 1024 byte, dove il browser la cerca): senza, una pagina
  // servita da un sito che non la manda (o aperta da disco) può mostrare «Â·» al posto di «·». Su claude.ai la aggiunge la piattaforma.
  try {
    const head = f => fs.readFileSync(f).subarray(0, 1024).toString('latin1');
    const has = f => /<meta\s+charset\s*=\s*["']?utf-8["']?\s*\/?>/i.test(head(f));
    const conv = page, cad = path.join(ROOT, 'index.html');
    rec('Codifica UTF-8 dichiarata all\'inizio della pagina (Convertitore e Banco CAD), per GitHub Pages e per il file aperto da disco',
      has(conv) && has(cad), `convertitore: ${has(conv) ? 'sì' : 'NO'}, Banco CAD: ${has(cad) ? 'sì' : 'NO'}`);
  } catch (e) { rec('Codifica UTF-8 dichiarata all\'inizio della pagina', false, 'ERRORE ' + e.message); }

  // Sfondo di riferimento su un disegno vero: il numero scritto da AutoCAD in ogni quota deve essere la misura salvata nel file,
  // e il DWG convertito deve dare le stesse quote e gli stessi testi del DXF di riferimento
  try {
    const rif = new Uint8Array(fs.readFileSync(path.join(PROVE, 'riferimento', 'esempio-2013.dxf')));
    const a = IM.parseDXF(rif, { notes: true }), g0 = IM.parseDXF(rif);
    // misure (codice 42) e blocchi delle quote, letti dal file senza passare dal Banco CAD
    const L = Buffer.from(rif).toString('latin1').split(/\r?\n/), meas = [];
    let sec = '', ent = null;
    for (let i = 0; i + 1 < L.length; i += 2) {
      const c = L[i].trim(), v = L[i + 1].trim();
      if (c === '2' && L[i - 1] !== undefined && L[i - 1].trim() === 'SECTION') sec = v;
      if (c === '0') { ent = sec === 'ENTITIES' && v === 'DIMENSION' ? {} : null; if (ent) meas.push(ent); }
      else if (ent && c === '42') ent.m = parseFloat(v);
      else if (ent && c === '70') ent.fl = parseInt(v, 10) & 7;
    }
    const texts = a.notes.filter(n => n.s !== undefined), nums = texts.map(t => parseFloat(t.s.replace(',', '.')));
    // le quote lineari e di raggio/diametro (non gli angoli, salvati in radianti): il numero scritto, arrotondato come nel file, è la misura
    const linear = meas.filter(d => d.fl !== 2 && d.fl !== 5);
    const miss = linear.filter(d => !nums.some(x => Math.abs(x - d.m) <= 0.0051));
    const same = JSON.stringify(a.geo) === JSON.stringify(g0.geo);
    const conv = runConvert(M, new Uint8Array(fs.readFileSync(path.join(PROVE, 'esempio-2013.dwg'))));
    const b = IM.parseDXF(conv.dxf, { notes: true }), tb = b.notes.filter(n => n.s !== undefined);
    const inFile = t => tb.some(u => u.s === t.s && Math.abs(u.x - t.x) < 1e-3 && Math.abs(u.y - t.y) < 1e-3);
    // la tabella (x 3298,8..3870,3; y sotto 839,7) nel DWG 2013 non arriva: LibreDWG la scrive vuota, vedi la prova qui sotto
    const inTable = t => t.x > 3298 && t.x < 3871 && t.y > 650 && t.y < 840;
    const lost = texts.filter(t => !inFile(t) && !inTable(t));
    rec('Sfondo su un disegno vero (2013): i numeri delle quote sono le misure del file, geometria uguale, DWG convertito uguale al riferimento',
      a.noteCount.quote === meas.length + 1 && linear.length >= 5 && !miss.length && same && a.noteCount.testi === 5 && b.noteCount.quote === a.noteCount.quote && b.noteCount.testi === a.noteCount.testi && !lost.length,
      `quote ${a.noteCount.quote} (${meas.length} DIMENSION + 1 ARC_DIMENSION), misure non trovate ${miss.length}/${linear.length}, testi ${a.noteCount.testi}; DWG: quote ${b.noteCount.quote}, testi ${b.noteCount.testi}, testi diversi: ${lost.map(t => t.s).join(' | ') || 'nessuno'}`);
  } catch (e) { rec('Sfondo su un disegno vero (2013)', false, 'ERRORE ' + e.message); }

  // Tratteggio, tolleranza, tabella e richiamo multiplo del disegno vero. Numeri di controllo indipendenti (ezdxf 1.4.6, hatch_entity senza
  // jiggle_origin, virtual_entities): 1297 tratti lunghi 12691,41204; punta (-2577,704; 142,429); testo «xx» a y = 605,218 e 598,552.
  try {
    const rif = new Uint8Array(fs.readFileSync(path.join(PROVE, 'riferimento', 'esempio-2013.dxf')));
    const conv = runConvert(M, new Uint8Array(fs.readFileSync(path.join(PROVE, 'esempio-2013.dwg'))));
    const look = u => {
      const r = IM.parseDXF(u, { notes: true }), n = r.notes.find(x => x.hl), H = n ? IM.hatchLines(n) : [];
      let L = 0; for (let i = 0; i < H.length; i += 4) L += Math.hypot(H[i + 2] - H[i], H[i + 3] - H[i + 1]);
      const f = r.notes.find(x => x.f && Math.abs(x.f[0] + 2577.704) < 0.01), xx = r.notes.filter(x => x.s === 'xx' && x.x < 0).map(x => +x.y.toFixed(3)).join();
      return { c: r.noteCount, segs: H.length / 4, L, f: !!f, xx, tol: r.notes.filter(x => x.s === '1' || x.s === '2' || x.s === '10').length };
    };
    const a = look(rif), b = look(conv.dxf), o2000 = runConvert(M, new Uint8Array(fs.readFileSync(path.join(PROVE, 'esempio-2000.dwg')))), c = look(o2000.dxf);
    const good = (o, tb) => o.c.tratteggi === 1 && o.c.tolleranze === 1 && o.c.tabelle === tb && o.c.richiami === 1 && o.segs === 1297 && Math.abs(o.L - 12691.41204) < 1e-3 && o.f && o.xx === '605.218,598.552' && o.tol === 3;
    // nel DWG 2013 LibreDWG scrive «0 ACAD_TABLE» senza dati: la tabella si conta come saltata; nel DWG 2000 c'è tutta
    const sk13 = IM.parseDXF(conv.dxf, { notes: true }).skipped.tabelle;
    rec('Sfondo su un disegno vero: tratteggio, tolleranza, tabella e richiamo uguali ai numeri di un programma indipendente, nel DXF di riferimento e nei DWG 2000 e 2013 (tabella del 2013 saltata e contata)', good(a, 1) && good(c, 1) && good(b, 0) && sk13 === 1, `DXF: ${JSON.stringify(a)}; DWG 2000: ${JSON.stringify(c)}; DWG 2013: ${JSON.stringify(b)}, tabelle saltate ${sk13}`);
  } catch (e) { rec('Sfondo su un disegno vero (2013): tratteggio, tolleranza, tabella e richiamo', false, 'ERRORE ' + e.message); }

  // Il lettore dentro il Banco CAD: uguale a quello del Convertitore, stesso DXF byte per byte per tutti i disegni di prova
  try {
    const cad = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const jsC = (cad.match(/<script id="dwgJs" type="text\/plain">([\s\S]*?)<\/script>/) || [])[1], b64C = (cad.match(/<script id="dwgWasm" type="application\/octet-stream">([\s\S]*?)<\/script>/) || [])[1];
    rec('Banco CAD: stesso lettore del Convertitore (codice e WebAssembly identici)', !!jsC && jsC === js && !!b64C && b64C.trim() === b64.trim(), `codice ${jsC ? jsC.length : 0}, wasm base64 ${b64C ? b64C.length : 0} caratteri`);
    const diffs = [];
    for (const [file] of CASES) {
      const data = new Uint8Array(fs.readFileSync(path.join(PROVE, file)));
      const a = IM.runDwgConvert(M, data), b = runConvert(M, data);
      if (a.err !== b.err || !a.dxf || Buffer.compare(Buffer.from(a.dxf), Buffer.from(b.dxf))) diffs.push(file);
    }
    rec(`Banco CAD: i ${CASES.length} DWG di prova danno il DXF del Convertitore byte per byte`, !diffs.length, diffs.length ? 'diversi: ' + diffs.join(', ') : '');
    // il testo del Worker è un programma valido, senza l'export del modulo (non partirebbe come Worker classico)
    const src = IM.dwgWorkerSource(jsC);
    let synt = true; try { new Function(src); } catch (e) { synt = e.message; }
    rec('Banco CAD: il testo del Worker è valido e non contiene export né import.meta', synt === true && !/export\s+default\s+createModule/.test(src) && !/import\.meta/.test(src), String(synt));
    // tipo del file dai primi byte
    const enc = t => new TextEncoder().encode(t);
    const K = [['AC1032', 'AutoCAD 2018'], ['AC1027', 'AutoCAD 2013'], ['AC1024', 'AutoCAD 2010'], ['AC1021', 'AutoCAD 2007'], ['AC1018', 'AutoCAD 2004'], ['AC1015', 'AutoCAD 2000'], ['AC1014', 'R14'], ['AC1012', 'R13'], ['AC1009', 'R11/R12'], ['MC0.0', 'R1.0'], ['AC1.40', 'R1.40']];
    const kBad = K.filter(([c, n]) => { const r = IM.dwgKind(enc(c)); return !r.ok || r.name !== n; }).map(x => x[0]);
    const nuovo = IM.dwgKind(enc('AC1036')), no = [['', /Non è un file DWG/], ['ciao', /Non è un file DWG/], ['  0\nSECTION\n', /dentro è un DXF/], ['AutoCAD Binary DXF', /DXF binario/], ['ISO-10303-21;', /file STEP/]].filter(([t, re]) => { const r = IM.dwgKind(enc(t)); return r.ok || !re.test(r.msg); }).map(x => x[0]);
    rec('Banco CAD: tipo del file riconosciuto dai primi byte (versioni, più nuovo del 2018 si prova, altri formati spiegati)', !kBad.length && nuovo.ok && /più nuova del 2018/.test(nuovo.name) && !no.length, `versioni sbagliate: ${kBad.join(', ') || 'nessuna'}; altri formati sbagliati: ${no.join(', ') || 'nessuno'}`);
    // la strada completa come nella pagina: DWG → DXF → lettura; le misure coincidono con quelle del riferimento (cfr. sopra)
    const rd = f => IM.parseDXF(IM.runDwgConvert(M, new Uint8Array(fs.readFileSync(path.join(PROVE, f)))).dxf);
    const c = rd('cerchio-2010.dwg').geo[0], arc = rd('arco-2018.dwg').geo[0], R11 = rd('entita-r11.dwg').skipped;
    rec('Banco CAD: DWG letti con le misure del file (cerchio r 13,5304; testi e quote contati)', c.t === 'circle' && Math.abs(c.r - 13.5304138459097) < 1e-9 && arc.t === 'arc' && R11.testi === 1 && R11.quote === 1, `r ${c.r}; arco r ${arc.r}; saltati ${JSON.stringify(R11)}`);
  } catch (e) { rec('Banco CAD: lettore DWG dentro la pagina', false, 'ERRORE ' + e.message); }

  fs.rmSync(tmp, { recursive: true, force: true });
  const fail = rows.filter(x => !x).length;
  console.log(`\n${rows.length - fail}/${rows.length} superati (tolleranza ${(TOL * 100).toFixed(1)}%)`);
  process.exit(fail ? 1 : 0);
})();
