// Test dell'interfaccia del Banco CAD in Chromium (Playwright): si usa la pagina come un utente.
// Uso: node ui.test.js <pagina.html>
const { chromium } = require('playwright');
const path = require('path');
const page_ = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const TOL = +(process.env.TOL || 0.01);
const results = [];
// immagini di controllo (in caso di errore) in tests/output
const OUT = path.join(__dirname, 'output'); require('fs').mkdirSync(OUT, { recursive: true });
let PAGE = null, shot = 0;
const rec = (name, ok, msg = '') => { if (!ok && PAGE) PAGE.screenshot({ path: path.join(OUT, 'fail-' + (++shot) + '.png') }).catch(() => {}); results.push({ name, ok, msg }); console.log((ok ? 'OK  ' : 'NO  ') + name + (msg ? '\n      ' + msg : '')); };
const rel = (g, e) => Math.abs(g - e) / Math.max(Math.abs(e), 1e-9);

(async () => {
  // CHROMIUM_PATH: percorso di un Chromium già installato (facoltativo); altrimenti quello di Playwright
  const launch = { args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] };
  if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(launch);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage(); PAGE = page;
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.text().startsWith('DIAG') || m.type() === 'warning' && !/GL Driver|WebGL|GroupMarker/.test(m.text())) console.log('   [pagina] ' + m.text().slice(0, 400)); if (m.type() === 'error' && !/ERR_TUNNEL|ERR_NAME|fonts\.g/.test(m.text() + JSON.stringify(m.location()))) errors.push('console: ' + m.text()); });
  await page.goto('file://' + page_);
  await page.waitForFunction(() => window.App && window.App.r, null, { timeout: 15000 });
  await page.waitForTimeout(800);
  // chiudi eventuali finestre di benvenuto
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });

  /* ---------- 1. avvio ---------- */
  rec('Avvio della pagina senza errori', !errors.length, errors.join(' | '));

  /* ---------- 2. esercitazioni: riferimento, tavola, verifica ---------- */
  const les = await page.evaluate(() => Lessons.list.map(l => {
    const out = { id: l.id, title: l.title };
    try {
      const r = Lessons.ref(l);
      out.errors = [...r.st.errors.values()]; out.warn = [...r.st.warn.values()];
      out.V = r.mp && r.mp.volume;
      const svg = Lessons.refDrawing(l); out.svgLen = svg ? svg.length : 0;
      // carica il riferimento come parte dell'utente e verifica
      App.change(() => { App.doc = JSON.parse(JSON.stringify(r.doc)); App.sel = []; });
      const ch = Lessons.verify(l); out.fail = ch.filter(c => !c.ok && !c.warn).map(c => c.text);
    } catch (e) { out.exc = e.message; }
    return out;
  }));
  for (const l of les) rec(`Esercitazione «${l.title}»: riferimento, tavola e verifica`, !l.exc && !l.errors.length && l.V > 0 && l.svgLen > 1000 && !l.fail.length,
    [l.exc, ...(l.errors || []), ...(l.warn || []).map(w => 'avviso: ' + w), ...(l.fail || [])].filter(Boolean).join(' | '));

  /* ---------- 3. flusso con il mouse ---------- */
  const helpers = async () => page.evaluate(() => {
    window.__scr = (u, v) => { const F = Sketcher.frame(); const p = App.r.project(Geom.to3(F, [u, v])); const c = document.querySelector('.view canvas').getBoundingClientRect(); return [c.left + p[0], c.top + p[1]]; };
  });
  const fresh = async () => { await page.evaluate(() => { if (App.mode === 'sketch') Sketcher.exit(false); App.setCmdTab('features'); App.change(() => { App.doc = Model.newDoc(); App.sel = []; }); }); await page.waitForTimeout(150); };
  const click = async (u, v, opts) => { const [x, y] = await page.evaluate(([u, v]) => __scr(u, v), [u, v]); await page.mouse.move(x, y); await page.waitForTimeout(30); await page.mouse.click(x, y, opts); await page.waitForTimeout(80); };
  const tool = async id => { if (await page.evaluate(id => App.mode === 'sketch' && Sketcher.session().tool === id, id)) return; await page.click(`#cmdBar [data-cmd="${id}"]`); await page.waitForTimeout(80); };
  const props = async () => { await page.waitForFunction(() => App.st && App.st.body.length && !document.querySelector('.pm-ok'), null, { timeout: 5000 }).catch(() => {}); return page.evaluate(() => { const m = Model.massProperties(App.st, App.doc); if (!m) console.log('DIAG ' + JSON.stringify({ feats: App.doc.features.map(f => f.type), mode: App.mode, undo: App.undoStack && App.undoStack.length, st: App.st && App.st.body.length, pm: !!App.pm, err: App.st ? [...App.st.errors.values()] : null, stack: new Error().stack.slice(0, 50) })); return m && { V: m.volume, A: m.area, bb: [m.bbox.mn, m.bbox.mx], err: [...App.st.errors.values()], feats: App.doc.features.map(f => f.type) }; }); };
  const startSketchOn = async planeName => {
    await page.evaluate(() => App.setCmdTab('sketch'));
    await page.locator('.tnode', { hasText: planeName }).first().click();
    await tool('sketch');
    await page.waitForFunction(() => App.mode === 'sketch');
    await page.waitForTimeout(1200); // animazione della vista normale allo schizzo
    await helpers();
  };
  // quota: clic sull'entità (punto medio), clic per posizionare, valore, Invio
  const dimLine = async (a, b, off, val) => {
    await tool('dim');
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    await click(m[0], m[1]);
    await click(m[0] + off[0], m[1] + off[1]);
    const inp = page.locator('.modify input');
    await inp.waitFor({ timeout: 2000 });
    await inp.fill(String(val)); await inp.press('Enter');
    await page.waitForTimeout(120);
  };

  // 3a. rettangolo dall'origine, quote 80 e 50, estrusione 10
  try {
    await fresh();
    await startSketchOn('Piano superiore');
    await tool('rect');
    await click(0, 0); await click(70, 40);
    const n = await page.evaluate(() => Sketcher.session().sk.ents.filter(e => e.t === 'ln').length);
    await dimLine([0, 0], [70, 0], [0, -12], 80);
    await dimLine([80, 0], [80, 40], [12, 0], 50);
    const st = await page.evaluate(() => Sketch.analyze(Sketcher.session().sk).status);
    await tool('exitSketch');
    await page.evaluate(() => App.setCmdTab('features'));
    await tool('extrude');
    const dep = page.locator('.pm-body .row', { hasText: 'Profondità' }).first().locator('input');
    await dep.fill('10'); await dep.press('Tab');
    if (process.env.DBG) console.log('prima di OK', await page.evaluate(() => JSON.stringify([App.doc.features.map(f => f.type), [...(App.pm && App.pm._preview ? App.pm._preview.errors.values() : [])]])));
    await page.click('.pm-ok');
    await page.waitForTimeout(300);
    if (process.env.DBG) console.log('dopo OK', await page.evaluate(() => JSON.stringify(App.doc.features.map(f => f.type))));
    const p = await props();
    const ok = n === 4 && st === 'full' && p && !p.err.length && rel(p.V, 40000) < TOL && rel(p.A, 10600) < TOL;
    rec('Mouse: rettangolo dall\'origine, quote 80 × 50, estrusione 10', ok, `linee ${n}, stato ${st}, V ${p && p.V.toFixed(1)}, A ${p && p.A.toFixed(1)} ${p ? p.err.join(';') : ''}` + (ok ? '' : ' | ' + await page.evaluate(() => JSON.stringify({ feats: App.doc.features.map(f => f.type), mode: App.mode, undo: App.undoStack && App.undoStack.length, st: App.st && App.st.body.length, pm: !!App.pm }))));
  } catch (e) { rec('Mouse: rettangolo dall\'origine, quote 80 × 50, estrusione 10', false, e.message.split('\n')[0]); }

  // 3b. estrusione premuta mentre lo schizzo è ancora aperto (correzione di ieri)
  try {
    await fresh();
    await startSketchOn('Piano frontale');
    await tool('circle'); await click(0, 0); await click(10, 0);
    await page.evaluate(() => App.setCmdTab('features'));
    await tool('extrude');
    const dep = page.locator('.pm-body .row', { hasText: 'Profondità' }).first().locator('input');
    await dep.fill('30'); await dep.press('Tab');
    await page.click('.pm-ok'); await page.waitForTimeout(300);
    const p = await props();
    const r = await page.evaluate(() => { const f = App.doc.features.find(f => f.type === 'sketch'); const c = f.sk.ents.find(e => e.t === 'ci'); return c.r; });
    const ok = p && !p.err.length && rel(p.V, Math.PI * r * r * 30) < TOL && (await page.evaluate(() => App.mode)) !== 'sketch';
    rec('Mouse: cerchio, poi Estrusione base dentro lo schizzo', ok, `V ${p && p.V.toFixed(1)} (r ${r.toFixed(3)}) modo ${await page.evaluate(() => App.mode)}`);
  } catch (e) { rec('Mouse: cerchio, poi Estrusione base dentro lo schizzo', false, e.message.split('\n')[0]); }

  // 3e. sformo dal pannello dell'estrusione
  try {
    await fresh();
    await startSketchOn('Piano frontale');
    await tool('circle'); await click(0, 0); await click(10, 0);
    await page.evaluate(() => App.setCmdTab('features'));
    await tool('extrude');
    const row = l => page.locator('.pm-body .row', { hasText: l }).first().locator('input');
    await row('Profondità').fill('10');
    await page.locator('.pm-body label.chk', { hasText: /^Sformo$/ }).locator('input').check();
    await row('Angolo di sformo').fill('5');
    await page.waitForTimeout(250);
    await page.click('.pm-ok'); const p = await props();
    const r2 = 10 - 10 * Math.tan(5 * Math.PI / 180), Ve = Math.PI * 10 / 3 * (100 + 10 * r2 + r2 * r2);
    rec('Interfaccia: estrusione con sformo 5°', p && rel(p.V, Ve) < TOL, `V ${p && p.V.toFixed(1)} atteso ${Ve.toFixed(1)}`);
  } catch (e) { rec('Interfaccia: estrusione con sformo 5°', false, e.message.split('\n')[0]); }

  // 3f. nervatura: linea disegnata con il mouse nella squadretta a L
  try {
    await fresh();
    await page.evaluate(() => { // squadretta a L (estrusione piano medio 30)
      const s = Sketch.newSketch(); const P = [[0, 0], [60, 0], [60, 8], [8, 8], [8, 40], [0, 40]];
      P.forEach((p, i) => s.ents.push({ id: 'p' + i, t: 'pt', x: p[0], y: p[1] })); P.forEach((p, i) => s.ents.push({ id: 'l' + i, t: 'ln', a: 'p' + i, b: 'p' + ((i + 1) % 6) })); s.next = 20;
      App.change(() => { App.doc.features.push({ id: 'F1', name: 'Schizzo1', type: 'sketch', plane: { kind: 'std', id: 'front' }, sk: s }, { id: 'F2', name: 'Estrusione1', type: 'extrude', sketch: 'F1', end: 'mid', depth: 30 }); App.doc.next = 3; });
      App.r.fit(true);
    });
    await page.waitForTimeout(600);
    const D = async t => { if (process.env.DBG) console.log('   ' + t, await page.evaluate(() => JSON.stringify({ f: App.doc.features.map(f => f.id + ':' + f.type), body: App.st && App.st.body.length, mode: App.mode, tool: App.mode === 'sketch' && Sketcher.session().tool, ents: App.mode === 'sketch' && Sketcher.session().sk.ents.filter(e => !e.ext).map(e => e.t).join(','), sel: App.sel.map(s => s.kind + ':' + s.id).join(','), pm: App.pm && App.pm.title }))); };
    await D('dopo iniezione');
    await startSketchOn('Piano frontale');
    await D('schizzo aperto');
    await tool('line'); await click(8, 30); await click(30, 8);
    await D('linea'); if (process.env.DBG) { await page.screenshot({ path: path.join(OUT, 'dbg-line.png') }); console.log('   punti schermo', JSON.stringify(await page.evaluate(() => [__scr(8, 30), __scr(30, 8), document.elementFromPoint(...__scr(8, 30)).className]))); }
    await page.keyboard.press('Escape'); await page.waitForTimeout(100);
    const pts = await page.evaluate(() => Sketcher.session().sk.ents.filter(e => e.t === 'pt' && !e.origin && !e.ext).map(e => [+e.x.toFixed(3), +e.y.toFixed(3)]));
    await D('dopo Esc');
    await page.evaluate(() => App.setCmdTab('features'));
    await tool('rib');
    await D('dopo Nervatura');
    const th = page.locator('.pm-body .row', { hasText: 'Spessore' }).first().locator('input');
    await th.fill('6'); await page.waitForTimeout(250);
    await page.click('.pm-ok'); const p = await props();
    // la linea può essere agganciata un po' diversamente: si calcola il triangolo dai punti reali
    const [a, b] = pts; const tri = (() => { // retta per a,b ∩ x=8 e y=8
      const k = (b[1] - a[1]) / (b[0] - a[0]); const yAt8 = a[1] + k * (8 - a[0]), xAt8 = a[0] + (8 - a[1]) / k; return (yAt8 - 8) * (xAt8 - 8) / 2; })();
    const Ve = (480 + 256) * 30 + tri * 6;
    rec('Interfaccia: nervatura disegnata con il mouse', p && !p.err.length && rel(p.V, Ve) < TOL, `punti ${JSON.stringify(pts)} V ${p && p.V.toFixed(1)} atteso ${Ve.toFixed(1)} ${p ? p.err.join(';') : ''}`);
  } catch (e) { rec('Interfaccia: nervatura disegnata con il mouse', false, e.message.split('\n')[0]); }

  // 3g. estrusione con percorso: profilo e percorso scelti in automatico dal pulsante
  try {
    await fresh();
    await page.evaluate(() => {
      const prof = Sketch.newSketch(); prof.ents.push({ id: 'c0', t: 'pt', x: 0, y: 0 }, { id: 'c1', t: 'ci', c: 'c0', r: 5 }); prof.next = 5;
      const path = Sketch.newSketch(); [[0, 0], [0, -50], [30, -50], [30, -80], [70, -80]].forEach((p, i) => path.ents.push({ id: 'q' + i, t: 'pt', x: p[0], y: p[1] }));
      path.ents.push({ id: 'm1', t: 'ln', a: 'q0', b: 'q1' }, { id: 'm2', t: 'ar', c: 'q2', a: 'q1', b: 'q3' }, { id: 'm3', t: 'ln', a: 'q3', b: 'q4' }); path.next = 20;
      App.change(() => { App.doc.features.push({ id: 'F1', name: 'Schizzo1', type: 'sketch', plane: { kind: 'std', id: 'front' }, sk: prof }, { id: 'F2', name: 'Schizzo2', type: 'sketch', plane: { kind: 'std', id: 'top' }, sk: path }); App.doc.next = 3; });
    });
    await page.evaluate(() => App.setCmdTab('features'));
    await tool('sweep'); await page.waitForTimeout(300);
    const pick = await page.evaluate(() => [document.querySelector('#pm_sketch').value, document.querySelector('#pm_path').value]);
    await page.click('.pm-ok'); const p = await props();
    const Ve = 25 * Math.PI * (90 + 15 * Math.PI);
    rec('Interfaccia: estrusione con percorso (tubo con curva)', p && rel(p.V, Ve) < TOL && pick[0] === 'F1' && pick[1] === 'F2', `profilo ${pick[0]} percorso ${pick[1]} V ${p && p.V.toFixed(1)} atteso ${Ve.toFixed(1)}`);
    // l'albero mostra i due schizzi sotto la funzione
    const tree = await page.evaluate(() => [...document.querySelectorAll('.tree .tnode')].map(n => n.textContent.trim()));
    rec('Albero: profilo e percorso sotto la funzione', tree.join('|').includes('Estrusione con percorso1|Schizzo1|Schizzo2'), tree.slice(-4).join(' | '));
  } catch (e) { rec('Interfaccia: estrusione con percorso (tubo con curva)', false, e.message.split('\n')[0]); }

  // 3i. importazione di un file STL dal menu Progetto (cubo di 2 cm scritto in centimetri), poi modifica dell'unità
  try {
    await fresh();
    const q = [[[0, 0, 0], [0, 0, 2], [0, 2, 2], [0, 2, 0]], [[2, 0, 0], [2, 2, 0], [2, 2, 2], [2, 0, 2]], [[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]],
      [[0, 2, 0], [0, 2, 2], [2, 2, 2], [2, 2, 0]], [[0, 0, 0], [0, 2, 0], [2, 2, 0], [2, 0, 0]], [[0, 0, 2], [2, 0, 2], [2, 2, 2], [0, 2, 2]]];
    const tris = q.flatMap(([a, b, c, d]) => [[a, b, c], [a, c, d]]);
    const buf = Buffer.alloc(84 + 50 * tris.length); buf.writeUInt32LE(tris.length, 80);
    tris.forEach((t, i) => t.forEach((p, k) => p.forEach((x, j) => buf.writeFloatLE(x, 84 + i * 50 + 12 + k * 12 + j * 4))));
    await page.click('#btnFile'); await page.click('#menuFile [data-act="importMesh"]');
    await page.setInputFiles('#meshFile', { name: 'cubo.stl', mimeType: 'model/stl', buffer: buf });
    await page.selectOption('#meshUnit', 'cm');
    await page.click('#modalActions .btn-primary');
    await page.waitForFunction(() => App.doc.features.some(f => f.type === 'import') && document.querySelector('#modal').hidden, null, { timeout: 10000 });
    const p1 = await props();
    const node = await page.locator('.tnode', { hasText: 'Importato1' }).count();
    // doppio clic sull'albero: pannello con le spiegazioni, unità in millimetri → cubo di 2 mm
    await page.locator('.tnode', { hasText: 'Importato1' }).dblclick(); await page.waitForTimeout(300);
    const gl = await page.evaluate(() => [...document.querySelectorAll('#pm .grp > h3')].map(h => h.textContent + (h.querySelector('.gl-i') ? '' : ' (senza ⓘ)')));
    await page.selectOption('#pm_unit', 'mm'); await page.waitForTimeout(300);
    await page.click('#pm .pm-ok'); await page.waitForTimeout(200);
    const p2 = await props();
    await page.click('#btnUndo'); await page.waitForTimeout(200);
    const p3 = await props();
    const ok = p1 && rel(p1.V, 8000) < TOL && rel(p1.A, 2400) < TOL && node === 1 && p2 && rel(p2.V, 8) < TOL && p3 && rel(p3.V, 8000) < TOL && gl.length === 2 && !gl.some(x => x.includes('senza'));
    rec('Interfaccia: importa STL dal menu (unità, modifica, annulla)', ok, `V ${p1 && p1.V.toFixed(1)} (8000), dopo «mm» ${p2 && p2.V.toFixed(3)} (8), annulla ${p3 && p3.V.toFixed(1)}; pannello: ${gl.join(', ')}`);
    // clic sulla faccia superiore del cubo importato: è una faccia piana, si può usare per lo schizzo
    await page.evaluate(() => { App.r.setView(GLView.Renderer.viewQ('iso')); App.r.fit(); App.redraw(); });
    await page.waitForTimeout(400);
    const [fx, fy] = await page.evaluate(() => { const p = App.r.project([10, 20, 10]); const c = document.querySelector('.view canvas').getBoundingClientRect(); return [c.left + p[0], c.top + p[1]]; });
    await page.mouse.click(fx, fy); await page.waitForTimeout(150);
    const fsel = await page.evaluate(() => { const s = App.sel[0]; return s ? { kind: s.kind, planar: s.planar, n: s.n, w: s.w } : null; });
    rec('Interfaccia: faccia piana del corpo importato selezionabile', !!fsel && fsel.kind === 'face' && fsel.planar && Math.abs(fsel.n[1] - 1) < 1e-9 && Math.abs(fsel.w - 20) < 1e-6, JSON.stringify(fsel));
    // messa in tavola del corpo importato
    // la tavola del cubo importato deve coincidere, linea per linea, con quella di un cubo uguale fatto con un'estrusione
    const dv = await page.evaluate(() => {
      const ds = { sheet: 'A4H', scale: 'auto', views: { front: true, top: true, left: true, iso: true }, hidden: true, offsets: {}, section: null, dims: [], axes: true, title: { school: '', title: 'cubo', author: '', date: '', number: '', classe: '', tol: 'ISO 2768-mK', notes: '' } };
      const lines = doc => { const st = Model.regen(doc); const d = new DOMParser().parseFromString(Drawing.render({ st, ds, doc }).svg, 'image/svg+xml'); const o = {};
        for (const g of d.querySelectorAll('g[data-view]')) o[g.dataset.view] = [...g.querySelectorAll('line')].map(l => ['x1', 'y1', 'x2', 'y2'].map(a => (+l.getAttribute(a)).toFixed(1)).join(' ') + (l.closest('g[stroke-dasharray]') ? ' n' : '')).sort();
        return o; };
      const nat = Model.newDoc(), sk = Sketch.newSketch();
      [[0, -20], [20, -20], [20, 0], [0, 0]].forEach((q, i) => sk.ents.push({ id: 'p' + i, t: 'pt', x: q[0], y: q[1] }));
      for (let i = 0; i < 4; i++) sk.ents.push({ id: 'l' + i, t: 'ln', a: 'p' + i, b: 'p' + ((i + 1) % 4) });
      sk.next = 10; nat.features.push({ id: 'F1', name: 'Schizzo1', type: 'sketch', plane: { kind: 'std', id: 'top' }, sk }, { id: 'F2', name: 'Estrusione1', type: 'extrude', sketch: 'F1', end: 'blind', depth: 20 }); nat.next = 3;
      const a = lines(App.doc), b = lines(nat);
      return { views: Object.keys(a).map(k => k + ' ' + a[k].length), same: JSON.stringify(a) === JSON.stringify(b) && Object.keys(a).length === 4 };
    });
    rec('Interfaccia: messa in tavola di un corpo importato', dv.same, 'uguale al cubo estruso: ' + (dv.same ? 'sì' : 'NO') + ' (' + dv.views.join(', ') + ' linee)');
    // file non ammesso: messaggio nella finestra, niente funzione nuova
    const nBefore = await page.evaluate(() => App.doc.features.length);
    await page.click('#btnFile'); await page.click('#menuFile [data-act="importMesh"]');
    await page.setInputFiles('#meshFile', { name: 'pezzo.sldprt', mimeType: 'application/octet-stream', buffer: Buffer.from('xx') });
    await page.click('#modalActions .btn-primary'); await page.waitForTimeout(300);
    const msg = await page.evaluate(() => { const e = document.querySelector('#meshErr'); return e && !e.hidden ? e.textContent : ''; });
    const nAfter = await page.evaluate(() => App.doc.features.length);
    await page.click('#modalActions .btn:not(.btn-primary)').catch(() => page.evaluate(() => { document.querySelector('#modal').hidden = true; }));
    rec('Interfaccia: file di formato non ammesso spiegato', /SolidWorks/.test(msg) && nAfter === nBefore, msg);
  } catch (e) { rec('Interfaccia: importa STL dal menu (unità, modifica, annulla)', false, e.message.split('\n')[0]); }

  // 3m. importazione DXF: dal menu Progetto in uno schizzo nuovo (centimetri, angolo sull'origine), poi estrusione;
  //     dalla scheda Schizzo dentro uno schizzo aperto; file DWG spiegato
  const dxfText = (ents, units) => ['0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', String(units), '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES', ...ents.flat().map(String), '0', 'ENDSEC', '0', 'EOF'].join('\r\n');
  try {
    await fresh();
    // piastra 10 × 6 cm con foro Ø2 cm, lontana dall'origine, più un testo e una quota da saltare
    const L = (a, b, c, d) => ['0', 'LINE', '8', '0', '10', a, '20', b, '11', c, '21', d];
    const file = dxfText([L(50, 20, 60, 20), L(60, 20, 60, 26), L(60, 26, 50, 26), L(50, 26, 50, 20), ['0', 'CIRCLE', '8', '0', '10', 53, '20', 23, '40', 1], ['0', 'TEXT', '8', '0', '10', 0, '20', 0, '1', 'PIASTRA'], ['0', 'DIMENSION', '8', '0']], 5);
    await page.click('#btnFile'); await page.click('#menuFile [data-act="importDxf"]');
    await page.setInputFiles('#dxfFile', { name: 'piastra.dxf', mimeType: 'application/dxf', buffer: Buffer.from(file) });
    await page.selectOption('#dxfPlane', 'top'); await page.selectOption('#dxfOrigin', 'corner');
    await page.click('#modalActions .btn-primary');
    await page.waitForFunction(() => App.mode === 'sketch' && document.querySelector('#modal').hidden, null, { timeout: 10000 });
    const info = await page.evaluate(() => { const s = Sketcher.session(); return { plane: s.f.plane.id, sel: s.sel.size, n: s.sk.ents.filter(e => e.t !== 'pt').length, toast: document.querySelector('#toast').textContent, status: Sketch.analyze(s.sk).status }; });
    await page.waitForTimeout(1200);
    await tool('exitSketch');
    await page.evaluate(() => App.setCmdTab('features'));
    await tool('extrude');
    const dep = page.locator('.pm-body .row', { hasText: 'Profondità' }).first().locator('input');
    await dep.fill('10'); await dep.press('Tab');
    await page.click('.pm-ok'); await page.waitForTimeout(300);
    const p = await props();
    const Ve = 10 * (6000 - Math.PI * 100);
    const ok = info.plane === 'top' && info.n === 5 && info.sel === 5 && /100 × 60 mm/.test(info.toast) && /centimetri/.test(info.toast) && /1 testo, 1 quota/.test(info.toast) && p && !p.err.length && rel(p.V, Ve) < TOL
      && Math.abs(p.bb[0][0]) < 1e-6 && Math.abs(p.bb[1][0] - 100) < 1e-6 && Math.abs(p.bb[0][2] + 60) < 1e-6;
    rec('Interfaccia: importa DXF dal menu (schizzo nuovo, cm, origine) ed estrusione', ok, `piano ${info.plane}, entità ${info.n}, selezionate ${info.sel}, V ${p && p.V.toFixed(1)} (${Ve.toFixed(1)}), ingombro ${p && JSON.stringify(p.bb)}; «${info.toast}»`);
    // dentro uno schizzo aperto, dal pulsante «Inserisci DXF»: asola da polilinea con tratti curvi
    await startSketchOn('Piano frontale');
    const slot = dxfText([['0', 'LWPOLYLINE', '8', '0', '90', 4, '70', 1, '10', 0, '20', 0, '42', 0, '10', 40, '20', 0, '42', 1, '10', 40, '20', 20, '42', 0, '10', 0, '20', 20, '42', 1]], 4);
    await tool('dxf');
    const noPlane = await page.evaluate(() => !document.querySelector('#dxfPlane'));
    await page.setInputFiles('#dxfFile', { name: 'asola.dxf', mimeType: 'application/dxf', buffer: Buffer.from(slot) });
    await page.click('#modalActions .btn-primary');
    await page.waitForFunction(() => document.querySelector('#modal').hidden, null, { timeout: 10000 });
    const s2 = await page.evaluate(() => { const s = Sketcher.session(); const pr = Sketch.profiles(s.sk); return { feats: App.doc.features.filter(f => f.type === 'sketch').length, ln: s.sk.ents.filter(e => e.t === 'ln').length, ar: s.sk.ents.filter(e => e.t === 'ar').length, regions: pr.regions.length, err: pr.errors.length }; });
    await page.keyboard.press('Control+z'); await page.waitForTimeout(150);
    const afterUndo = await page.evaluate(() => Sketcher.session().sk.ents.filter(e => e.t !== 'pt').length);
    await page.evaluate(() => Sketcher.exit(false));
    rec('Interfaccia: «Inserisci DXF» nello schizzo aperto (asola, annulla)', noPlane && s2.feats === 2 && s2.ln === 2 && s2.ar === 2 && s2.regions === 1 && !s2.err && afterUndo === 0, JSON.stringify({ noPlane, ...s2, afterUndo }));
    // file DWG: messaggio nella finestra, niente schizzo nuovo
    const nBefore = await page.evaluate(() => App.doc.features.length);
    await page.click('#btnFile'); await page.click('#menuFile [data-act="importDxf"]');
    await page.setInputFiles('#dxfFile', { name: 'pezzo.dwg', mimeType: 'application/octet-stream', buffer: Buffer.from('AC1032') });
    await page.click('#modalActions .btn-primary'); await page.waitForTimeout(300);
    const msg = await page.evaluate(() => { const e = document.querySelector('#dxfErr'); return e && !e.hidden ? e.textContent : ''; });
    const nAfter = await page.evaluate(() => App.doc.features.length);
    await page.click('#modalActions .btn:not(.btn-primary)').catch(() => page.evaluate(() => { document.querySelector('#modal').hidden = true; }));
    rec('Interfaccia: file DWG spiegato (va salvato come DXF)', /salvalo come DXF/.test(msg) && nAfter === nBefore && (await page.evaluate(() => App.mode)) === 'part', msg);
  } catch (e) { rec('Interfaccia: importa DXF dal menu (schizzo nuovo, cm, origine) ed estrusione', false, e.message.split('\n')[0]); }

  // 3m-bis. DXF con ellisse e spline: piastra 120 × 80 con un foro ellittico 40 × 60 e un foro a spline chiusa
  //         per 4 punti (area 61/20 · R², R 10), estrusa 10
  try {
    await fresh();
    const P = (pts) => ['0', 'LWPOLYLINE', '8', '0', '90', pts.length, '70', 1, ...pts.flatMap(p => ['10', p[0], '20', p[1]])];
    const E = ['0', 'ELLIPSE', '8', '0', '10', 0, '20', 0, '30', 0, '11', 0, '21', 30, '31', 0, '40', 2 / 3, '41', 0, '42', 2 * Math.PI];
    const S = ['0', 'SPLINE', '8', '0', '70', 9, '71', 3, '74', 4, ...[[50, 0], [40, 10], [30, 0], [40, -10]].flatMap(p => ['11', p[0], '21', p[1], '31', 0])];
    const file = dxfText([P([[-60, -40], [60, -40], [60, 40], [-60, 40]]), E, S], 4);
    await page.click('#btnFile'); await page.click('#menuFile [data-act="importDxf"]');
    const note = await page.evaluate(() => document.querySelector('#modal .note').textContent);
    await page.setInputFiles('#dxfFile', { name: 'piastra-ellisse.dxf', mimeType: 'application/dxf', buffer: Buffer.from(file) });
    await page.selectOption('#dxfPlane', 'front');
    await page.click('#modalActions .btn-primary');
    await page.waitForFunction(() => App.mode === 'sketch' && document.querySelector('#modal').hidden, null, { timeout: 10000 });
    const info = await page.evaluate(() => { const s = Sketcher.session(); const pr = Sketch.profiles(s.sk); return { ar: s.sk.ents.filter(e => e.t === 'ar').length, regions: pr.regions.length, err: pr.errors.length, toast: document.querySelector('#toast').textContent }; });
    await page.waitForTimeout(1200);
    await tool('exitSketch');
    await page.evaluate(() => App.setCmdTab('features'));
    await tool('extrude');
    const dep = page.locator('.pm-body .row', { hasText: 'Profondità' }).first().locator('input');
    await dep.fill('10'); await dep.press('Tab');
    await page.click('.pm-ok'); await page.waitForTimeout(300);
    const p = await props();
    const Ve = 10 * (9600 - Math.PI * 600 - 61 / 20 * 100);
    const ok = /Ellissi e spline/.test(note) && info.ar > 8 && info.regions === 1 && !info.err && /1 ellisse e 1 spline sono diventate \d+ archi/.test(info.toast) && /mm dalla curva vera/.test(info.toast)
      && p && !p.err.length && rel(p.V, Ve) < TOL;
    // ellisse 200 × 2: i centri degli archi (lontani metri) non si vedono e non allargano l'inquadratura
    await fresh();
    const thin = dxfText([['0', 'ELLIPSE', '8', '0', '10', 0, '20', 0, '30', 0, '11', 100, '21', 0, '31', 0, '40', 0.01, '41', 0, '42', 2 * Math.PI]], 4);
    await page.click('#btnFile'); await page.click('#menuFile [data-act="importDxf"]');
    await page.setInputFiles('#dxfFile', { name: 'ellisse-sottile.dxf', mimeType: 'application/dxf', buffer: Buffer.from(thin) });
    await page.selectOption('#dxfPlane', 'front');
    await page.click('#modalActions .btn-primary');
    await page.waitForFunction(() => App.mode === 'sketch' && document.querySelector('#modal').hidden, null, { timeout: 10000 });
    await page.waitForTimeout(1500);
    const view = await page.evaluate(() => new Promise(res => requestAnimationFrame(() => {
      const a = App.r.project([-100, 0, 0]), b = App.r.project([100, 0, 0]), w = document.querySelector('.view canvas').getBoundingClientRect().width;
      const s = Sketcher.session(), far = s.sk.ents.filter(e => e.hc && Math.hypot(e.x, e.y) > 1000).length;
      res({ frac: Math.abs(b[0] - a[0]) / w, far, hidden: s.sk.ents.filter(e => e.hc).length });
    })));
    await page.evaluate(() => Sketcher.exit(false));
    const ok2 = view.frac > 0.4 && view.far > 0 && view.hidden > 0;
    rec('Interfaccia: ellisse 200 × 2 inquadrata bene (centri lontani nascosti)', ok2, `larghezza dell'ellisse ${(100 * view.frac).toFixed(0)}% della vista; centri nascosti ${view.hidden}, di cui oltre 1 m ${view.far}`);
    rec('Interfaccia: DXF con ellisse e spline (archi tangenti) ed estrusione', ok, `archi ${info.ar}, regioni ${info.regions}, V ${p && p.V.toFixed(1)} (${Ve.toFixed(1)}, ${p && (100 * rel(p.V, Ve)).toFixed(3)}%); «${info.toast}»`);
  } catch (e) {
    const why = await page.evaluate(() => { const x = document.querySelector('#dxfErr'); return { mode: App.mode, modal: !document.querySelector('#modal').hidden, err: x && !x.hidden ? x.textContent : '' }; }).catch(() => ({}));
    rec('Interfaccia: DXF con ellisse e spline (archi tangenti) ed estrusione', false, e.message.split('\n')[0] + ' ' + JSON.stringify(why));
  }

  // 3n. importazione STEP e IGES (lettore OpenCascade dentro la pagina): piastra con foro dal menu, pannello, file sbagliati
  try {
    await fresh();
    const { stepPlateHole } = require('./stepgen.js'), { igesBox } = require('./igesgen.js');
    await page.click('#btnFile'); await page.click('#menuFile [data-act="importCad"]');
    await page.setInputFiles('#cadFile', { name: 'piastra.stp', mimeType: 'application/step', buffer: Buffer.from(stepPlateHole(60, 40, 10, 8)) });
    await page.click('#modalActions .btn-primary');
    await page.waitForFunction(() => App.doc.features.some(f => f.type === 'import') && document.querySelector('#modal').hidden, null, { timeout: 30000 });
    const toastT = await page.evaluate(() => document.querySelector('#toast').textContent);
    const p1 = await props();
    const Ve = 24000 - 640 * Math.PI, Ae = 6800 + 32 * Math.PI;
    // doppio clic: pannello con le facce del modello, senza scelta dell'unità; Z verso l'alto → piastra in piedi
    await page.locator('.tnode', { hasText: 'Importato1' }).dblclick(); await page.waitForTimeout(300);
    const pm = await page.evaluate(() => ({ unit: !!document.querySelector('#pm_unit'), text: document.querySelector('#pm').textContent, gl: [...document.querySelectorAll('#pm .grp > h3')].filter(h => !h.querySelector('.gl-i')).length }));
    await page.locator('#pm label.chk', { hasText: 'Asse Z' }).locator('input').check(); await page.waitForTimeout(300);
    await page.click('#pm .pm-ok'); await page.waitForTimeout(300);
    const p2 = await props();
    const ok = p1 && rel(p1.V, Ve) < TOL && rel(p1.A, Ae) < TOL && /7 facce/.test(toastT) && !pm.unit && /7 facce del modello/.test(pm.text) && !pm.gl
      && p2 && rel(p2.V, Ve) < TOL && Math.abs(p2.bb[1][1] - 10) < 1e-3 && Math.abs(p2.bb[0][2] + 40) < 1e-3;
    rec('Interfaccia: importa STEP dal menu (piastra con foro, pannello, Z verso l\'alto)', ok, `V ${p1 && p1.V.toFixed(1)} (${Ve.toFixed(1)}), A ${p1 && p1.A.toFixed(1)} (${Ae.toFixed(1)}), unità nel pannello: ${pm.unit ? 'sì' : 'no'}, dopo Z ingombro ${p2 && JSON.stringify(p2.bb)}; «${toastT}»`);
    // IGES scelto per sbaglio nella finestra «Importa STL o OBJ»: viene letto lo stesso
    await page.click('#btnFile'); await page.click('#menuFile [data-act="importMesh"]');
    await page.setInputFiles('#meshFile', { name: 'blocco.igs', mimeType: 'application/iges', buffer: Buffer.from(igesBox(30, 20, 10)) });
    await page.click('#modalActions .btn-primary');
    await page.waitForFunction(() => App.doc.features.filter(f => f.type === 'import').length === 2 && document.querySelector('#modal').hidden, null, { timeout: 30000 });
    const ig = await page.evaluate(() => { const f = App.doc.features.filter(f => f.type === 'import')[1]; const i = Model.importInfo(f); return { fmt: f.fmt, faces: i.brepFaces, V: i.volume }; });
    rec('Interfaccia: IGES letto anche dalla finestra STL/OBJ', ig.fmt === 'iges' && ig.faces === 6 && rel(ig.V, 6000) < TOL, JSON.stringify(ig));
    // file di SolidWorks e file danneggiato: messaggio nella finestra, niente funzione nuova
    const nBefore = await page.evaluate(() => App.doc.features.length);
    const tryBad = async (name, text) => {
      await page.click('#btnFile'); await page.click('#menuFile [data-act="importCad"]');
      await page.setInputFiles('#cadFile', { name, mimeType: 'application/octet-stream', buffer: Buffer.from(text) });
      await page.click('#modalActions .btn-primary');
      await page.waitForFunction(() => { const e = document.querySelector('#cadErr'); return e && !e.hidden && e.classList.contains('err'); }, null, { timeout: 30000 });
      const m = await page.evaluate(() => document.querySelector('#cadErr').textContent);
      await page.click('#modalActions .btn:not(.btn-primary)');
      return m;
    };
    const m1 = await tryBad('pezzo.sldprt', 'xx'), m2 = await tryBad('rotto.step', 'ISO-10303-21;\nHEADER;\nDATA;\n#1=PRODUCT(');
    const nAfter = await page.evaluate(() => App.doc.features.length);
    rec('Interfaccia: file SolidWorks e STEP danneggiato spiegati', /STEP AP214/.test(m1) && /non si riesce a leggere|non ci sono solidi/.test(m2) && nAfter === nBefore, m1 + ' | ' + m2);
  } catch (e) { rec('Interfaccia: importa STEP dal menu (piastra con foro, pannello, Z verso l\'alto)', false, e.message.split('\n')[0]); }

  // 4. glossario: ogni comando e ogni titolo dei pannelli ha la sua spiegazione
  try {
    await fresh();
    const miss = await page.evaluate(async () => {
      const out = new Set();
      const wait = ms => new Promise(r => setTimeout(r, ms));
      for (const tab of ['features', 'evaluate', 'sketch', 'drawing']) {
        App.setCmdTab(tab); await wait(150);
        document.querySelectorAll('#cmdBar .tool span').forEach(s => { if (!Glossary.find(s.textContent)) out.add('comando: ' + s.textContent); });
      }
      App.setCmdTab('features'); await wait(100);
      // pannelli delle funzioni (su un blocco con uno schizzo libero)
      const s = Sketch.newSketch(); s.ents.push({ id: 'a', t: 'pt', x: 0, y: 0 }, { id: 'b', t: 'pt', x: 20, y: 0 }, { id: 'c', t: 'pt', x: 20, y: 10 }, { id: 'd', t: 'pt', x: 0, y: 10 }, { id: 'l1', t: 'ln', a: 'a', b: 'b' }, { id: 'l2', t: 'ln', a: 'b', b: 'c' }, { id: 'l3', t: 'ln', a: 'c', b: 'd' }, { id: 'l4', t: 'ln', a: 'd', b: 'a' }, { id: 'm', t: 'ln', a: 'a', b: 'd', cons: true, center: true }); s.next = 10;
      App.change(() => { App.doc.features.push({ id: 'F1', name: 'Schizzo1', type: 'sketch', plane: { kind: 'std', id: 'front' }, sk: s }, { id: 'F2', name: 'Estrusione1', type: 'extrude', sketch: 'F1', end: 'blind', depth: 10 }); App.doc.next = 3; });
      for (const t of ['extrude', 'cut', 'revolve', 'revcut', 'sweep', 'rib', 'hole', 'fillet', 'chamfer', 'lpattern', 'cpattern', 'mirror', 'plane']) {
        try { App.select(null); Features.create(t); } catch (e) { out.add('errore ' + t + ': ' + e.message); }
        await wait(150);
        document.querySelectorAll('#pm .grp > h3').forEach(h => { if (!h.querySelector('.gl-i')) out.add('pannello ' + t + ': ' + h.textContent); });
        if (App.pm) App.closePM(false);
        if (App.mode === 'sketch') Sketcher.exit(false);
      }
      return [...out];
    });
    rec('Glossario: spiegazione per ogni comando e titolo di pannello', !miss.length, miss.join(' | '));
    const n = await page.evaluate(() => Glossary.entries.length);
    rec('Glossario: almeno 100 termini', n >= 100, n + ' termini');
  } catch (e) { rec('Glossario: spiegazione per ogni comando e titolo di pannello', false, e.message.split('\n')[0]); }

  // 5. guida «come si fa»: copre tutti i comandi, i pulsanti esistono, i termini sono nel glossario
  try {
    const res = await page.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const out = [];
      const T = Guide.topics;
      const text = T.map(t => (t.t + ' ' + t.steps.join(' ') + ' ' + (t.tips || []).join(' ')).toLowerCase()).join(' ');
      const cmdIds = new Set(T.filter(t => t.cmd).map(t => t.cmd.id));
      for (const tab of ['features', 'sketch', 'evaluate', 'drawing']) {
        App.setCmdTab(tab); await wait(120);
        document.querySelectorAll('#cmdBar .tool').forEach(b => { const lab = b.textContent.trim(); if (!cmdIds.has(b.dataset.cmd) && !text.includes(lab.toLowerCase())) out.push('comando senza guida: ' + lab); });
      }
      for (const t of T) {
        if (t.cmd) { App.setCmdTab(t.cmd.tab); await wait(80); if (!document.querySelector(`#cmdBar [data-cmd="${t.cmd.id}"]`)) out.push('«Mostrami dove» senza pulsante: ' + t.t); }
        const terms = (t.terms || []).concat([...(t.why + t.steps.join(' ') + (t.tips || []).join(' ')).matchAll(/\[\[([^\]|]+)/g)].map(m => m[1]));
        for (const x of terms) if (!Glossary.find(x)) out.push('termine non nel glossario: ' + x + ' (' + t.t + ')');
      }
      App.setCmdTab('features');
      Guide.open('fori'); await wait(100);
      const title = document.querySelector('.gd-title') && document.querySelector('.gd-title').textContent;
      document.querySelector('.gd-show').click(); await wait(200);
      const flash = !!document.querySelector('#cmdBar [data-cmd="hole"].gd-flash');
      document.querySelector('#right').hidden = true; App.rightPanel = null;
      return { out, n: T.length, title, flash };
    });
    rec('Guida: tutti i comandi spiegati, pulsanti e termini collegati', !res.out.length && res.n >= 35 && res.title === 'Creazione guidata fori' && res.flash, res.out.join(' | ') + ` (${res.n} argomenti, «Mostrami dove» ${res.flash ? 'ok' : 'NO'})`);
  } catch (e) { rec('Guida: tutti i comandi spiegati, pulsanti e termini collegati', false, e.message.split('\n')[0]); }

  // 3c. annulla / ripeti
  try {
    const before = await page.evaluate(() => App.doc.features.length);
    await page.evaluate(() => App.undo ? App.undo() : document.querySelector('[aria-label="Annulla"]').click());
    const mid = await page.evaluate(() => App.doc.features.length);
    await page.evaluate(() => App.redo ? App.redo() : document.querySelector('[aria-label="Ripeti"]').click());
    const after = await page.evaluate(() => App.doc.features.length);
    rec('Annulla e ripeti', mid < before && after === before, `${before} → ${mid} → ${after}`);
  } catch (e) { rec('Annulla e ripeti', false, e.message.split('\n')[0]); }

  // 3d. persistenza: ricarica la pagina e ritrova la parte
  try {
    const n0 = await page.evaluate(() => { App.save && App.save(); return App.doc.features.length; });
    const f0 = await page.evaluate(() => App.doc.features.map(f => f.id + ':' + f.type));
    await page.reload(); await page.waitForFunction(() => window.App && App.st, null, { timeout: 15000 }); await page.waitForTimeout(500);
    const n1 = await page.evaluate(() => App.doc.features.length);
    rec('Salvataggio automatico e ricarica', n0 === n1 && n1 > 0, `${n0} → ${n1}` + (n0 === n1 ? '' : ' ' + JSON.stringify([f0, await page.evaluate(() => App.doc.features.map(f => f.id + ':' + f.type))])));
  } catch (e) { rec('Salvataggio automatico e ricarica', false, e.message.split('\n')[0]); }

  // 3i. messa in tavola dei pezzi con le nuove funzioni
  try {
    const res = await page.evaluate(() => {
      const mk = feats => { const d = Model.newDoc(); d.features = feats; return d; };
      const sk = (plane, ents) => { const s = Sketch.newSketch(); s.ents.push(...ents); s.next = 99; return s; };
      const docs = {
        'tubo (sweep)': mk([
          { id: 'F1', name: 'S1', type: 'sketch', plane: { kind: 'std', id: 'front' }, sk: sk('front', [{ id: 'c0', t: 'pt', x: 0, y: 0 }, { id: 'c1', t: 'ci', c: 'c0', r: 5 }]) },
          { id: 'F2', name: 'S2', type: 'sketch', plane: { kind: 'std', id: 'top' }, sk: sk('top', [{ id: 'q0', t: 'pt', x: 0, y: 0 }, { id: 'q1', t: 'pt', x: 0, y: -50 }, { id: 'q2', t: 'pt', x: 30, y: -50 }, { id: 'q3', t: 'pt', x: 30, y: -80 }, { id: 'q4', t: 'pt', x: 70, y: -80 }, { id: 'm1', t: 'ln', a: 'q0', b: 'q1' }, { id: 'm2', t: 'ar', c: 'q2', a: 'q1', b: 'q3' }, { id: 'm3', t: 'ln', a: 'q3', b: 'q4' }]) },
          { id: 'F3', name: 'Sweep', type: 'sweep', sketch: 'F1', path: 'F2' }]),
        'squadretta con nervatura': mk([
          { id: 'F1', name: 'S1', type: 'sketch', plane: { kind: 'std', id: 'front' }, sk: sk('front', [[0, 0], [60, 0], [60, 8], [8, 8], [8, 40], [0, 40]].map((p, i) => ({ id: 'p' + i, t: 'pt', x: p[0], y: p[1] })).concat([0, 1, 2, 3, 4, 5].map(i => ({ id: 'l' + i, t: 'ln', a: 'p' + i, b: 'p' + ((i + 1) % 6) })))) },
          { id: 'F2', name: 'E', type: 'extrude', sketch: 'F1', end: 'mid', depth: 30 },
          { id: 'F3', name: 'S2', type: 'sketch', plane: { kind: 'std', id: 'front' }, sk: sk('front', [{ id: 'a', t: 'pt', x: 8, y: 30 }, { id: 'b', t: 'pt', x: 30, y: 8 }, { id: 'l', t: 'ln', a: 'a', b: 'b' }]) },
          { id: 'F4', name: 'Nervatura', type: 'rib', sketch: 'F3', thick: 6 }]),
        'tronco di cono (sformo)': mk([
          { id: 'F1', name: 'S1', type: 'sketch', plane: { kind: 'std', id: 'top' }, sk: sk('top', [{ id: 'c0', t: 'pt', x: 0, y: 0 }, { id: 'c1', t: 'ci', c: 'c0', r: 20 }]) },
          { id: 'F2', name: 'E', type: 'extrude', sketch: 'F1', end: 'blind', depth: 30, draftOn: true, draft: 8 }]),
      };
      const out = [];
      for (const [k, doc] of Object.entries(docs)) {
        try {
          const st = Model.regen(doc);
          const ds = { sheet: 'A4H', scale: 'auto', views: { front: true, top: true, left: true, iso: true }, hidden: true, offsets: {}, section: null, dims: [], axes: true, title: { school: '', title: k, author: '', date: '', number: '', classe: '', tol: 'ISO 2768-mK', notes: '' } };
          const first = Drawing.render({ st, ds, doc }); ds.dims = Drawing.smartDims(first.L, ds);
          const svg = Drawing.render({ st, ds, doc }).svg;
          out.push([k, st.errors.size ? [...st.errors.values()].join(';') : '', svg.length, (svg.match(/<path|<line|<polyline/g) || []).length]);
        } catch (e) { out.push([k, 'eccezione: ' + e.message, 0, 0]); }
      }
      return out;
    });
    for (const [k, err, len, n] of res) rec(`Messa in tavola: ${k}`, !err && len > 3000 && n > 20, `${err} svg ${len} car., ${n} elementi`);
  } catch (e) { rec('Messa in tavola delle nuove funzioni', false, e.message.split('\n')[0]); }

  // 3k. rotella: sposta a destra/sinistra; Ctrl + rotella ruota; Maiusc + rotella zoom
  try {
    await fresh();
    await page.evaluate(() => { App.setCmdTab('features'); App.r.setView(GLView.Renderer.viewQ('iso')); App.r.fit(false); });
    await page.waitForTimeout(300);
    const box = await page.locator('#view').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const cam = () => page.evaluate(() => { const c = App.r.cam, b = App.r.basis(); const s = App.r.pxSize(); return { t: c.target.slice(), q: c.q.slice(), s: c.scale, r: b.right, u: b.up, px: s }; });
    const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
    // la dimensione del pixel si legge dopo che la vista ha disegnato un fotogramma (prima può essere quella vecchia)
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const c0 = await cam();
    await page.mouse.wheel(0, 100); await page.waitForTimeout(150);
    const c1 = await cam();
    await page.keyboard.down('Control'); await page.mouse.wheel(0, 100); await page.keyboard.up('Control'); await page.waitForTimeout(150);
    const c2 = await cam();
    await page.keyboard.down('Shift'); await page.mouse.wheel(0, -100); await page.keyboard.up('Shift'); await page.waitForTimeout(150);
    const c3 = await cam();
    const dt = c1.t.map((v, i) => v - c0.t[i]); const hpx = (dt[0] * c0.r[0] + dt[1] * c0.r[1] + dt[2] * c0.r[2]) / c0.px, vpx = (dt[0] * c0.u[0] + dt[1] * c0.u[1] + dt[2] * c0.u[2]) / c0.px;
    c1.sx = -hpx; c1.sy = vpx; c0.sx = 0; c0.sy = 0; // spostamento del modello sullo schermo, in pixel
    // rotella di 100 × 0,6 = 60 px di spostamento
    const panOk = rel(Math.abs(hpx), 60) < TOL && Math.abs(vpx) < 1 && dist(c1.q, c0.q) < 1e-9 && c1.s === c0.s;
    const rotOk = dist(c2.q, c1.q) > 0.05 && c2.s === c1.s && dist(c2.t, c1.t) < 1e-9;
    const zoomOk = Math.abs(c3.s / c2.s - 1) > 0.05 && dist(c3.q, c2.q) < 1e-9;
    rec('Rotella: sposta di lato, Ctrl ruota, Maiusc zoom', panOk && rotOk && zoomOk,
      `spostamento orizzontale ${(c1.sx - c0.sx).toFixed(0)} px (verticale ${(c1.sy - c0.sy).toFixed(1)}), rotazione ${rotOk ? 'sì' : 'no'}, zoom ×${(c2.s / c3.s).toFixed(2)}`);
  } catch (e) { rec('Rotella: sposta di lato, Ctrl ruota, Maiusc zoom', false, e.message.split('\n')[0]); }
  // rotella usata mentre la vista sta ancora girando (animazione di un cambio di orientamento): lo spostamento non si perde
  try {
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const cam = () => page.evaluate(() => { const c = App.r.cam, b = App.r.basis(); return { t: c.target.slice(), q: c.q.slice(), r: b.right, px: App.r.pxSize() }; });
    const a = await cam();
    await page.evaluate(() => App.r.setView(GLView.Renderer.viewQ('front')));
    await page.mouse.wheel(0, 100); await page.waitForTimeout(700);
    const b = await cam();
    const front = await page.evaluate(() => GLView.Renderer.viewQ('front'));
    const dt = b.t.map((v, i) => v - a.t[i]); const hpx = (dt[0] * b.r[0] + dt[1] * b.r[1] + dt[2] * b.r[2]) / b.px;
    const qOk = Math.min(Math.hypot(...b.q.map((v, i) => v - front[i])), Math.hypot(...b.q.map((v, i) => v + front[i]))) < 1e-9;
    rec('Rotella durante un cambio di vista: lo spostamento resta', qOk && rel(Math.abs(hpx), 60) < TOL, `vista frontale ${qOk ? 'sì' : 'NO'}, spostamento ${hpx.toFixed(1)} px (60)`);
  } catch (e) { rec('Rotella durante un cambio di vista: lo spostamento resta', false, e.message.split('\n')[0]); }

  // 3l. tablet: due dita = zoom sempre; ruotare/spostare solo dopo aver toccato il pezzo
  try {
    const tctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: false });
    const tp = await tctx.newPage();
    tp.on('pageerror', e => errors.push('pageerror (tablet): ' + e.message));
    await tp.goto('file://' + page_);
    await tp.waitForFunction(() => window.App && App.r, null, { timeout: 15000 });
    await tp.evaluate(() => { const r = Lessons.ref(Lessons.list[0]); App.change(() => { App.doc = JSON.parse(JSON.stringify(r.doc)); }); App.setCmdTab('features'); App.r.setView(GLView.Renderer.viewQ('iso')); App.r.fit(false); });
    await tp.waitForTimeout(500);
    const cdp = await tctx.newCDPSession(tp);
    const touch = async (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], i) => ({ x, y, id: i })) });
    const drag1 = async (x0, y0, x1, y1) => { await touch('touchStart', [[x0, y0]]); for (let k = 1; k <= 8; k++) await touch('touchMove', [[x0 + (x1 - x0) * k / 8, y0 + (y1 - y0) * k / 8]]); await touch('touchEnd', []); await tp.waitForTimeout(120); };
    const tap = async (x, y) => { await touch('touchStart', [[x, y]]); await touch('touchEnd', []); await tp.waitForTimeout(250); };
    const two = async (a0, b0, a1, b1) => { await touch('touchStart', [a0, b0]); for (let k = 1; k <= 8; k++) await touch('touchMove', [[a0[0] + (a1[0] - a0[0]) * k / 8, a0[1] + (a1[1] - a0[1]) * k / 8], [b0[0] + (b1[0] - b0[0]) * k / 8, b0[1] + (b1[1] - b0[1]) * k / 8]]); await touch('touchEnd', []); await tp.waitForTimeout(120); };
    const cam = () => tp.evaluate(() => ({ t: App.r.cam.target.slice(), q: App.r.cam.q.slice(), s: App.r.cam.scale, grab: App.touchGrab }));
    const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
    const vb = await tp.locator('#view').boundingBox();
    const mid = await tp.evaluate(() => { const b = [22, 10, -25]; /* punto pieno sulla faccia superiore (non il foro centrale) */ const p = App.r.project(b); const c = document.querySelector('#view').getBoundingClientRect(); return [c.left + p[0], c.top + p[1]]; });
    const empty = [vb.x + 40, vb.y + vb.height - 60];
    const c0 = await cam();
    await drag1(empty[0], empty[1], empty[0] + 150, empty[1] - 40); const c1 = await cam();       // dito nel vuoto: niente
    await two([mid[0] - 60, mid[1]], [mid[0] + 60, mid[1]], [mid[0] - 120, mid[1]], [mid[0] + 120, mid[1]]); const c2 = await cam(); // allargo: zoom
    await two([mid[0] - 60, mid[1]], [mid[0] + 60, mid[1]], [mid[0] + 40, mid[1]], [mid[0] + 160, mid[1]]); const c3 = await cam(); // due dita senza pezzo: niente spostamento
    const midNow = await tp.evaluate(() => { const p = App.r.project([22, 10, -25]); const c = document.querySelector('#view').getBoundingClientRect(); return [c.left + p[0], c.top + p[1]]; });
    await tap(midNow[0], midNow[1]); const c4 = await cam();                                             // tocco il pezzo
    await drag1(midNow[0], midNow[1], midNow[0] + 120, midNow[1]); const c5 = await cam();                       // ora un dito ruota
    await two([mid[0] - 60, mid[1]], [mid[0] + 60, mid[1]], [mid[0] + 40, mid[1] + 30], [mid[0] + 160, mid[1] + 30]); const c6 = await cam(); // due dita spostano
    await tap(empty[0], empty[1]); const c7 = await cam();                                         // tocco il vuoto: lascio
    const ok = dist(c1.q, c0.q) < 1e-9 && dist(c1.t, c0.t) < 1e-9 && Math.abs(c2.s / c1.s - 1) > 0.2 && dist(c3.t, c2.t) < 1e-6
      && c4.grab && dist(c5.q, c4.q) > 0.05 && dist(c6.t, c5.t) > 1 && !c7.grab;
    rec('Tablet: zoom con due dita; ruota e sposta dopo aver toccato il pezzo', ok,
      `vuoto: rotazione ${dist(c1.q, c0.q) < 1e-9 ? 'no' : 'SÌ'}; zoom ×${(c1.s / c2.s).toFixed(2)}; spostamento senza pezzo ${dist(c3.t, c2.t).toFixed(3)}; preso ${c4.grab}; rotazione ${dist(c5.q, c4.q).toFixed(2)}; spostamento ${dist(c6.t, c5.t).toFixed(1)}; lasciato ${!c7.grab}`);
    await tp.screenshot({ path: path.join(OUT, 'tablet.png') });
    await tctx.close();
  } catch (e) { rec('Tablet: zoom con due dita; ruota e sposta dopo aver toccato il pezzo', false, e.message.split('\n')[0]); }

  // 3j. autoverifica nel programma (scheda Valuta)
  try {
    await page.evaluate(() => App.setCmdTab('evaluate'));
    await tool('selftest');
    await page.waitForSelector('.st-table', { timeout: 60000 });
    const head = await page.locator('#modalBody p b').first().textContent();
    const m = head.match(/(\d+) su (\d+)/);
    await page.screenshot({ path: path.join(OUT, 'selftest.png') });
    rec('Autoverifica dentro il programma', m && m[1] === m[2] && +m[2] >= 66, head);
    await page.click('#modalActions .btn-primary');
  } catch (e) { rec('Autoverifica dentro il programma', false, e.message.split('\n')[0]); }

  // 3h. ricarica immediata: l'ultima modifica resta, la funzione non confermata no
  try {
    const n0 = await page.evaluate(() => { App.change(() => { App.doc.name = 'Prova ricarica'; }); return App.doc.features.length; });
    await page.reload(); await page.waitForFunction(() => window.App && App.st, null, { timeout: 15000 }); await page.waitForTimeout(300);
    const name = await page.evaluate(() => App.doc.name);
    // pannello aperto su una funzione nuova, poi ricarica
    await page.evaluate(() => { App.setCmdTab('features'); App.select(null); Features.create('plane'); });
    await page.waitForTimeout(500); // più del ritardo del salvataggio
    const during = await page.evaluate(() => App.doc.features.length);
    await page.reload(); await page.waitForFunction(() => window.App && App.st, null, { timeout: 15000 }); await page.waitForTimeout(300);
    const after = await page.evaluate(() => App.doc.features.length);
    rec('Ricarica immediata: modifica salvata, niente funzioni fantasma', name === 'Prova ricarica' && during === n0 + 1 && after === n0, `nome «${name}», funzioni ${n0} → con pannello ${during} → dopo ricarica ${after}`);
  } catch (e) { rec('Ricarica immediata: modifica salvata, niente funzioni fantasma', false, e.message.split('\n')[0]); }

  rec('Nessun errore JavaScript durante i test', !errors.length, errors.slice(0, 5).join(' | '));
  await page.screenshot({ path: path.join(OUT, 'ui-last.png') });
  await browser.close();
  const f = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - f}/${results.length} superati`);
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
