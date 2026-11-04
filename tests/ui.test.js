// Test dell'interfaccia del Banco CAD in Chromium (Playwright): si usa la pagina come un utente.
// Uso: node ui.test.js <pagina.html>
const { chromium } = require('playwright');
const path = require('path');
const page_ = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const TOL = +(process.env.TOL || 0.01);
// pezzi già pronti per le prove di vista e tavola (piastra forata, squadretta a L)
const PEZZI_JS = 'window.PEZZI = ' + require('fs').readFileSync(path.join(__dirname, 'pezzi-prova.json'), 'utf8') + ';';
const results = [];
// immagini di controllo (in caso di errore) in tests/output
const OUT = path.join(__dirname, 'output'); require('fs').mkdirSync(OUT, { recursive: true });
let PAGE = null, shot = 0;
const rec = (name, ok, msg = '') => { if (!ok && PAGE) PAGE.screenshot({ path: path.join(OUT, 'fail-' + (++shot) + '.png') }).catch(() => {}); results.push({ name, ok, msg }); console.log((ok ? 'OK  ' : 'NO  ') + name + (msg ? '\n      ' + msg : '')); };
const rel = (g, e) => Math.abs(g - e) / Math.max(Math.abs(e), 1e-9);
// controllo indipendente dei PDF con pdfplumber (Python): null se non c'è
const pdfCheck = file => { try { return JSON.parse(require('child_process').execFileSync('python3', [path.join(__dirname, 'pdfcheck.py'), file], { encoding: 'utf8', maxBuffer: 256e6, stdio: ['ignore', 'pipe', 'ignore'] })); } catch (e) { return null; } };

(async () => {
  // CHROMIUM_PATH: percorso di un Chromium già installato (facoltativo); altrimenti quello di Playwright
  const launch = { args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] };
  if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(launch);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(PEZZI_JS);
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

  /* ---------- 2. esercitazioni tolte: nessuna traccia, e i progetti salvati con il campo «lesson» si aprono ---------- */
  try {
    const tracce = await page.evaluate(() => {
      const out = [];
      if (window.Lessons) out.push('modulo Lessons');
      if (document.querySelector('[data-ct="lessons"]')) out.push('scheda');
      const tabs = [...document.querySelectorAll('.cmd-tabs [data-ct]')].map(b => b.dataset.ct).join();
      if (tabs !== 'features,sketch,evaluate,drawing,assembly') out.push('schede: ' + tabs);
      if (/esercitazion/i.test(document.querySelector('#right').getAttribute('aria-label') + document.querySelector('#rightTitle').textContent)) out.push('pannello');
      for (const t of Guide.topics) if (/esercitazion|esercizi/i.test(JSON.stringify(t))) out.push('guida: ' + t.t);
      for (const e of Glossary.entries) if (/esercitazion/i.test(JSON.stringify(e))) out.push('glossario: ' + JSON.stringify(e).slice(0, 40));
      return out;
    });
    const octx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    await octx.addInitScript(PEZZI_JS);
    const op = await octx.newPage();
    const oerr = []; op.on('pageerror', e => oerr.push(e.message));
    await op.goto('file://' + page_);
    await op.waitForFunction(() => window.App && App.r, null, { timeout: 15000 });
    // salvataggio come lo scrivevano le versioni con le esercitazioni: c'è anche il campo «lesson»
    const k = 'banco-cad-v1';
    await op.evaluate(k => { localStorage.setItem(k, JSON.stringify({ doc: window.PEZZI.piastra, lesson: 'piastra', drawing: null })); localStorage.setItem('banco-cad-done', '["piastra"]'); }, k);
    await op.reload();
    await op.waitForFunction(() => window.App && App.r, null, { timeout: 15000 });
    await op.waitForTimeout(400);
    const o = await op.evaluate(async k => { const st = App.st; const mp = Geom.massProps(st.body, st.tags); App.save(); await new Promise(r => setTimeout(r, 1500)); return { n: App.doc.features.length, name: App.doc.name, V: mp && mp.volume, savedLesson: 'lesson' in JSON.parse(localStorage.getItem(k)) }; }, k);
    await octx.close();
    // 80 × 50 × 10 meno 4 fori Ø8 e un foro Ø20 = 40000 − π·10·(4·16 + 100) = 34847,79 mm³
    const Vm = 40000 - Math.PI * 10 * (4 * 16 + 100);
    const okV = o.V == null ? false : rel(o.V, Vm) < 1e-3;
    rec('Esercitazioni tolte: nessuna traccia; progetto salvato con la vecchia esercitazione si apre uguale', !tracce.length && !oerr.length && o.n === 4 && okV && !o.savedLesson, [...tracce, ...oerr, JSON.stringify(o)].join(' | '));
  } catch (e) { rec('Esercitazioni tolte: nessuna traccia; progetto salvato con la vecchia esercitazione si apre uguale', false, e.message.split('\n')[0]); }

  /* ---------- 3. flusso con il mouse ---------- */
  const helpers = async () => page.evaluate(() => {
    window.__scr = (u, v) => { const F = Sketcher.frame(); const p = App.r.project(Geom.to3(F, [u, v])); const c = document.querySelector('.view canvas').getBoundingClientRect(); return [c.left + p[0], c.top + p[1]]; };
  });
  const fresh = async () => { await page.evaluate(() => { if (App.mode === 'sketch') Sketcher.exit(false); App.setCmdTab('features'); App.change(() => { App.doc = Model.newDoc(); App.sel = []; }); }); await page.waitForTimeout(150); };
  const click = async (u, v, opts) => { const [x, y] = await page.evaluate(([u, v]) => __scr(u, v), [u, v]); await page.mouse.move(x, y); await page.waitForTimeout(30); await page.mouse.click(x, y, opts); await page.waitForTimeout(80); };
  const tool = async id => { if (await page.evaluate(id => App.mode === 'sketch' && Sketcher.session().tool === id, id)) return; await page.click(`#cmdBar [data-cmd="${id}"]`); await page.waitForTimeout(80); };
  const props = async () => { await page.waitForFunction(() => App.st && App.st.body.length && !App.pm, null, { timeout: 5000 }).catch(() => {}); return page.evaluate(() => { const m = Model.massProperties(App.st, App.doc); if (!m) console.log('DIAG ' + JSON.stringify({ feats: App.doc.features.map(f => f.type), mode: App.mode, undo: App.undoStack && App.undoStack.length, st: App.st && App.st.body.length, pm: !!App.pm, err: App.st ? [...App.st.errors.values()] : null, stack: new Error().stack.slice(0, 50) })); return m && { V: m.volume, A: m.area, bb: [m.bbox.mn, m.bbox.mx], err: [...App.st.errors.values()], feats: App.doc.features.map(f => f.type) }; }); };
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
  } catch (e) { rec('Interfaccia: importa DXF dal menu (schizzo nuovo, cm, origine) ed estrusione', false, e.message.split('\n')[0]); }
  // DWG scelto nelle altre finestre: rimanda a «Importa DXF o DWG»; la finestra giusta porta il collegamento al Convertitore
  try {
    await fresh();
    const msgIn = async (act, inp, errSel) => { await page.click('#btnFile'); await page.click(`#menuFile [data-act="${act}"]`);
      await page.setInputFiles(inp, { name: 'pezzo.dwg', mimeType: 'application/octet-stream', buffer: Buffer.from('AC1032') });
      await page.click('#modalActions .btn-primary'); await page.waitForTimeout(400);
      const m = await page.evaluate(sel => document.querySelector(sel).textContent, errSel);
      await page.click('#modalActions .btn:not(.btn-primary)').catch(() => {}); await page.waitForTimeout(100); return m; };
    const mCad = await msgIn('importCad', '#cadFile', '#cadErr'), mMesh = await msgIn('importMesh', '#meshFile', '#meshErr');
    await page.click('#btnFile');
    const label = await page.locator('#menuFile [data-act="importDxf"]').textContent();
    await page.click('#menuFile [data-act="importDxf"]');
    const link = await page.evaluate(() => { const a = document.querySelector('#modalBody a.dwg-link'); return a ? { href: a.href, target: a.target, url: App.DWG_CONVERTER_URL, acc: document.querySelector('#dxfFile').accept } : null; });
    await page.click('#modalActions .btn:not(.btn-primary)');
    const U = 'https://claude.ai/artifact/8PeF7HpK8VZ1RFpsfAJYkY', want = /usa «Importa DXF o DWG \(schizzo\)»/;
    rec('Interfaccia: un DWG scelto nelle finestre STEP e STL rimanda a «Importa DXF o DWG»; lì c\'è il collegamento al Convertitore', want.test(mCad) && want.test(mMesh) && label === 'Importa DXF o DWG (schizzo)' && !!link && link.href === U && link.url === U && link.target === '_blank' && /\.dwg/.test(link.acc),
      `STEP: «${mCad}»; STL: «${mMesh}»; menu «${label}»; ${JSON.stringify(link)}`);
  } catch (e) { rec('Interfaccia: un DWG scelto nelle finestre STEP e STL rimanda a «Importa DXF o DWG»', false, e.message.split('\n')[0]); await page.evaluate(() => App.closeModal()).catch(() => {}); }
  // DWG veri aperti direttamente nel Banco CAD (lettore dentro la pagina, in un Worker)
  const DWGP = n => path.join(__dirname, '..', 'convertitore-dwg', 'prove', n);
  const closeAll = () => page.evaluate(() => { App.dwgCancel(); App.closeModal(); if (App.mode === 'sketch') Sketcher.exit(false); }).catch(() => {});
  // cerchio-2010.dwg: un cerchio di raggio 13,5304138 pollici (dal DWG, l'unità è scritta nel file): dal menu fino all'estrusione
  try {
    await fresh();
    await page.click('#btnFile'); await page.click('#menuFile [data-act="importDxf"]');
    await page.setInputFiles('#dxfFile', DWGP('cerchio-2010.dwg'));
    await page.waitForFunction(() => /AutoCAD 2010/.test(document.querySelector('#dxfCap').textContent), null, { timeout: 30000 });
    const pv = await page.evaluate(() => ({ cap: document.querySelector('#dxfCap').textContent, svg: !!document.querySelector('#dxfPrev svg'), mode: App.dwgMode, app: App.mode, busy: App.dwgBusy() }));
    await page.click('#modalActions .btn-primary');
    await page.waitForFunction(() => App.mode === 'sketch' && document.querySelector('#modal').hidden, null, { timeout: 10000 });
    const info = await page.evaluate(() => { const s = Sketcher.session(); return { ci: s.sk.ents.filter(e => e.t === 'ci').length, n: s.sk.ents.filter(e => e.t !== 'pt').length, toast: document.querySelector('#toast').textContent }; });
    await page.waitForTimeout(1200);
    await tool('exitSketch');
    await page.evaluate(() => App.setCmdTab('features'));
    await tool('extrude');
    const dep = page.locator('.pm-body .row', { hasText: 'Profondità' }).first().locator('input');
    await dep.fill('10'); await dep.press('Tab');
    await page.click('.pm-ok'); await page.waitForTimeout(300);
    const p = await props();
    const R = 13.5304138459097 * 25.4, Ve = Math.PI * R * R * 10, w = p ? p.bb[1][0] - p.bb[0][0] : 0;
    const ok = pv.svg && pv.mode === 'worker' && pv.app === 'part' && !pv.busy && /ingombro/.test(pv.cap) && info.ci === 1 && info.n === 1 && /«cerchio-2010\.dwg»/.test(info.toast) && /pollici/.test(info.toast)
      && p && !p.err.length && rel(p.V, Ve) < TOL && rel(w, 2 * R) < TOL;
    rec('DWG dal menu: anteprima dal lettore nel Worker, cerchio in pollici, schizzo ed estrusione (V calcolato a mano)', ok, `«${pv.cap}» (${pv.mode}); V ${p && p.V.toFixed(1)} (${Ve.toFixed(1)}), larghezza ${w.toFixed(4)} (${(2 * R).toFixed(4)}); «${info.toast}»`);
  } catch (e) { rec('DWG dal menu: anteprima dal lettore nel Worker, cerchio in pollici, schizzo ed estrusione', false, e.message.split('\n')[0]); await closeAll(); }
  // entita-r11.dwg dentro uno schizzo aperto con «Inserisci DXF o DWG»: stesse entità del DXF di riferimento di LibreDWG, entità saltate dette, Annulla
  try {
    await fresh();
    await startSketchOn('Piano frontale');
    await tool('dxf');
    await page.setInputFiles('#dxfFile', DWGP('entita-r11.dwg'));
    await page.waitForFunction(() => /R11\/R12/.test(document.querySelector('#dxfCap').textContent), null, { timeout: 30000 });
    await page.click('#modalActions .btn-primary');
    await page.waitForFunction(() => document.querySelector('#modal').hidden, null, { timeout: 10000 });
    const count = () => page.evaluate(() => { const s = Sketcher.session(), c = {}; for (const e of s.sk.ents) if (e.t !== 'pt') c[e.t] = (c[e.t] || 0) + 1; return { c, toast: document.querySelector('#toast').textContent }; });
    const a = await count();
    const feats = await page.evaluate(() => App.doc.features.filter(f => f.type === 'sketch').length);
    await page.keyboard.press('Control+z'); await page.waitForTimeout(100);
    const undone = await page.evaluate(() => Sketcher.session().sk.ents.filter(e => e.t !== 'pt').length);
    await closeAll();
    await fresh();
    const ref = require('fs').readFileSync(path.join(__dirname, '..', 'convertitore-dwg', 'prove', 'riferimento', 'entita-r11.dxf'));
    const b0 = await page.evaluate(d => { const r = App.importDxfData('r.dxf', new Uint8Array(d), { origin: 'file', plane: 'front' }); return r.msg; }, [...ref]);
    const b = await count();
    await closeAll();
    const ok = JSON.stringify(a.c) === JSON.stringify(b.c) && a.c.ln === 4 && a.c.ar === 1 && a.c.ci === 1 && /Sullo sfondo: 2 testi, 1 quota/.test(a.toast) && /1 traccia/.test(a.toast) && /1 forma/.test(a.toast) && feats === 1 && undone === 0
      && a.toast.match(/Ingombro [^(]*/)[0] === b0.match(/Ingombro [^(]*/)[0];
    rec('DWG nello schizzo aperto: stesse entità e ingombro del DXF di riferimento, testi e quote contati nel messaggio, Annulla', ok, `DWG ${JSON.stringify(a.c)}, riferimento ${JSON.stringify(b.c)}; dopo Annulla ${undone}; «${a.toast}»`);
  } catch (e) { rec('DWG nello schizzo aperto: stesse entità e ingombro del DXF di riferimento', false, e.message.split('\n')[0]); await closeAll(); }
  // file sbagliati: messaggio chiaro, nessuna funzione aggiunta, e subito dopo un DWG buono si legge
  try {
    await fresh();
    const good = require('fs').readFileSync(DWGP('arco-2018.dwg'));
    const cases = [['finto.dwg', Buffer.from('AC1032'), /codice LibreDWG/], ['troncato.dwg', good.subarray(0, 3000), /codice LibreDWG/], ['testo.dwg', Buffer.from('ciao a tutti'), /Non è un file DWG/],
      ['dxf.dwg', Buffer.from('  0\nSECTION\n  2\nENTITIES\n  0\nENDSEC\n  0\nEOF\n'), /dentro è un DXF/], ['step.dwg', Buffer.from('ISO-10303-21;\nHEADER;'), /dentro è un file STEP/]];
    await page.click('#btnFile'); await page.click('#menuFile [data-act="importDxf"]');
    const got = [];
    for (const [name, buffer, re] of cases) {
      await page.setInputFiles('#dxfFile', { name, mimeType: 'application/octet-stream', buffer });
      await page.waitForFunction(() => { const e = document.querySelector('#dxfErr'); return e && !e.hidden; }, null, { timeout: 30000 });
      const before = await page.evaluate(() => document.querySelector('#dxfErr').textContent);
      await page.click('#modalActions .btn-primary'); await page.waitForTimeout(100);
      const m = await page.evaluate(() => ({ t: document.querySelector('#dxfErr').textContent, open: !document.querySelector('#modal').hidden, app: App.mode, n: App.doc.features.length }));
      got.push({ name, ok: re.test(before) && re.test(m.t) && m.open && m.app === 'part', t: m.t });
    }
    await page.setInputFiles('#dxfFile', DWGP('arco-2018.dwg'));
    await page.waitForFunction(() => /AutoCAD 2018/.test(document.querySelector('#dxfCap').textContent), null, { timeout: 30000 });
    const clean = await page.evaluate(() => document.querySelector('#dxfErr').hidden);
    await closeAll();
    const n = await page.evaluate(() => App.doc.features.length), n0 = await page.evaluate(() => Model.newDoc().features.length);
    rec('DWG sbagliati (finto, troncato, testo, DXF e STEP rinominati): messaggio chiaro e niente schizzo; dopo, un DWG buono si legge', got.every(x => x.ok) && clean && n === n0, got.map(x => `${x.name}: ${x.ok ? 'sì' : 'NO'} «${x.t}»`).join(' | '));
  } catch (e) { rec('DWG sbagliati: messaggio chiaro e niente schizzo', false, e.message.split('\n')[0]); await closeAll(); }
  // lettura in corso: la pagina resta libera, Annulla interrompe, un altro file prende il posto del primo, doppio clic su Importa = una sola importazione
  try {
    await fresh();
    const pick = async f => { await page.setInputFiles('#dxfFile', []); await page.setInputFiles('#dxfFile', f); };   // lo stesso file due volte non farebbe scattare «change»
    await page.click('#btnFile'); await page.click('#menuFile [data-act="importDxf"]');
    // fotogramma più lungo durante la lettura del disegno grande, misurato con requestAnimationFrame
    await page.evaluate(() => { window.__fr = { max: 0, last: performance.now(), on: true }; const tick = t => { const f = window.__fr; if (!f.on) return; f.max = Math.max(f.max, t - f.last); f.last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    const t0 = Date.now();
    await pick(DWGP('esempio-2000.dwg'));
    await page.waitForFunction(() => App.dwgBusy(), null, { timeout: 10000 });
    await page.waitForFunction(() => /AutoCAD 2000/.test(document.querySelector('#dxfCap').textContent), null, { timeout: 60000 });
    const ms = Date.now() - t0;
    const lavoro = await page.evaluate(() => { window.__fr.on = false; return window.__fr.max; });
    // (l'anteprima di 3891 entità si disegna nella pagina: il fotogramma più lungo la comprende. Si misura perciò anche il solo lettore.)
    await pick(DWGP('esempio-2000.dwg'));
    await page.waitForFunction(() => App.dwgBusy(), null, { timeout: 10000 });
    const free = await page.evaluate(() => new Promise(res => { let max = 0, last = performance.now(); const tick = t => { max = Math.max(max, t - last); last = t; if (App.dwgBusy()) requestAnimationFrame(tick); else res(max); }; requestAnimationFrame(tick); setTimeout(() => App.dwgCancel(), 150); }));
    await page.waitForTimeout(100);
    const after = await page.evaluate(() => ({ busy: App.dwgBusy(), open: !document.querySelector('#modal').hidden }));
    await pick(DWGP('esempio-2000.dwg'));
    await page.waitForFunction(() => App.dwgBusy(), null, { timeout: 10000 });
    await page.click('#modalActions .btn:not(.btn-primary)');
    await page.waitForTimeout(200);
    const can = await page.evaluate(() => ({ busy: App.dwgBusy(), hidden: document.querySelector('#modal').hidden, app: App.mode }));
    // un altro file mentre il primo si legge; doppio clic su Importa mentre si legge
    await page.click('#btnFile'); await page.click('#menuFile [data-act="importDxf"]');
    await pick(DWGP('esempio-2000.dwg'));
    await page.waitForFunction(() => App.dwgBusy(), null, { timeout: 10000 });
    await pick(DWGP('arco-2018.dwg'));
    await page.evaluate(() => { const b = document.querySelector('#modalActions .btn-primary'); b.click(); b.click(); });
    await page.waitForFunction(() => App.mode === 'sketch' && document.querySelector('#modal').hidden, null, { timeout: 30000 });
    await page.waitForTimeout(600);
    const two = await page.evaluate(() => { const s = Sketcher.session(); return { ar: s.sk.ents.filter(e => e.t === 'ar').length, n: s.sk.ents.filter(e => e.t !== 'pt').length, toast: document.querySelector('#toast').textContent, busy: App.dwgBusy() }; });
    await closeAll();
    const ok = free < 200 && !after.busy && after.open && !can.busy && can.hidden && can.app === 'part' && two.ar === 1 && two.n === 1 && /arco-2018/.test(two.toast) && !/Tolte/.test(two.toast) && !two.busy;
    rec('DWG in lettura: pagina libera, Annulla interrompe, un altro file prende il posto del primo, doppio clic importa una volta sola', ok,
      `disegno grande letto e mostrato in ${ms} ms (fotogramma più lungo ${lavoro.toFixed(0)} ms, anteprima compresa); durante la sola lettura ${free.toFixed(0)} ms; dopo Annulla ${JSON.stringify(can)}; ${JSON.stringify(two)}`);
  } catch (e) { rec('DWG in lettura: pagina libera, Annulla interrompe', false, e.message.split('\n')[0]); await closeAll(); }
  // senza Worker il lettore lavora nella pagina, e il DXF è identico byte per byte; stesso DXF del Convertitore (lo controlla dwg.test.js)
  try {
    await fresh();
    const bytes = [...require('fs').readFileSync(DWGP('v-r14.dwg'))];
    const res = await page.evaluate(async d => {
      const u8 = new Uint8Array(d), a = await App.dwgToDxf(u8), ma = App.dwgMode;
      const W = window.Worker; window.Worker = undefined;
      let b, mb, r;
      try { b = await App.dwgToDxf(u8); mb = App.dwgMode; r = await App.importDwgData('porta.dwg', u8, { origin: 'file', plane: 'front' }); } finally { window.Worker = W; }
      let same = a.dxf.length === b.dxf.length; for (let i = 0; same && i < a.dxf.length; i++) same = a.dxf[i] === b.dxf[i];
      const s = Sketcher.session();
      return { ma, mb, same, n: a.dxf.length, name: a.kind.name, ln: s.sk.ents.filter(e => e.t === 'ln').length, msg: r.msg };
    }, bytes);
    await closeAll();
    rec('DWG senza Worker: legge nella pagina, DXF identico byte per byte, porta R14 (16 linee di cui 8 doppie)', res.ma === 'worker' && res.mb === 'page' && res.same && res.name === 'R14' && res.ln === 8 && /Tolte 8 entità doppie/.test(res.msg) && /1 testo/.test(res.msg), JSON.stringify(res));
  } catch (e) { rec('DWG senza Worker: legge nella pagina, DXF identico byte per byte', false, e.message.split('\n')[0]); await page.evaluate(() => { if (!window.Worker) location.reload(); }).catch(() => {}); await closeAll(); }
  // DXF dentro uno .zip (come lo salva il Convertitore nella pagina pubblicata): piastra 10 × 6 cm con foro, in centimetri
  try {
    const L = (a, b, c, d) => ['0', 'LINE', '8', '0', '10', a, '20', b, '11', c, '21', d];
    const file = dxfText([L(50, 20, 60, 20), L(60, 20, 60, 26), L(60, 26, 50, 26), L(50, 26, 50, 20), ['0', 'CIRCLE', '8', '0', '10', 53, '20', 23, '40', 1], ['0', 'TEXT', '8', '0', '10', 0, '20', 0, '1', 'PIASTRA'], ['0', 'DIMENSION', '8', '0']], 5);
    await fresh();
    const zipStore = (name, buf) => { const nm = Buffer.from(name), crc = require('zlib').crc32(buf);
      const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(buf.length, 18); lh.writeUInt32LE(buf.length, 22); lh.writeUInt16LE(nm.length, 26);
      const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(buf.length, 20); ch.writeUInt32LE(buf.length, 24); ch.writeUInt16LE(nm.length, 28);
      const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(46 + nm.length, 12); end.writeUInt32LE(30 + nm.length + buf.length, 16);
      return Buffer.concat([lh, nm, buf, ch, nm, end]); };
    await page.click('#btnFile'); await page.click('#menuFile [data-act="importDxf"]');
    await page.setInputFiles('#dxfFile', { name: 'piastra.dxf.zip', mimeType: 'application/zip', buffer: zipStore('piastra.dxf', Buffer.from(file)) });
    await page.waitForFunction(() => /tra linee, archi e cerchi/.test(document.querySelector('#dxfCap').textContent), null, { timeout: 5000 });
    const cap = await page.evaluate(() => document.querySelector('#dxfCap').textContent);
    await page.click('#modalActions .btn-primary');
    await page.waitForFunction(() => App.mode === 'sketch' && document.querySelector('#modal').hidden, null, { timeout: 10000 });
    const z = await page.evaluate(() => { const s = Sketcher.session(); return { n: s.sk.ents.filter(e => e.t !== 'pt').length, toast: document.querySelector('#toast').textContent }; });
    await page.evaluate(() => Sketcher.exit(false));
    rec('Interfaccia: importa DXF da uno .zip (come lo salva il Convertitore DWG → DXF)', z.n === 5 && /100 × 60 mm/.test(z.toast) && /^5 tra linee, archi e cerchi/.test(cap), `entità ${z.n}; anteprima «${cap}»; «${z.toast}»`);
  } catch (e) { rec('Interfaccia: importa DXF da uno .zip (come lo salva il Convertitore DWG → DXF)', false, e.message.split('\n')[0]); await page.evaluate(() => { const m = document.querySelector('#modal'); if (m && !m.hidden) { const b = document.querySelector('#modalActions .btn:not(.btn-primary)'); if (b) b.click(); } if (App.mode === 'sketch') Sketcher.exit(false); }); }

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

  // 3m-quater. DXF con più layer: elenco con le caselle (il layer spento nel file parte senza spunta), anteprima che cambia
  //           con la scelta, «Nessuno» → messaggio, solo PEZZO → schizzo con il solo pezzo ed estrusione
  try {
    await fresh();
    const L = (ly, x0, y0, x1, y1) => ['0', 'LINE', '8', ly, '10', x0, '20', y0, '30', 0, '11', x1, '21', y1, '31', 0];
    const C = (ly, x, y, r) => ['0', 'CIRCLE', '8', ly, '10', x, '20', y, '40', r];
    const rect = (ly, x0, y0, x1, y1) => [L(ly, x0, y0, x1, y0), L(ly, x1, y0, x1, y1), L(ly, x1, y1, x0, y1), L(ly, x0, y1, x0, y0)];
    const tables = ['0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '0', 'LAYER', '2', 'QUOTE', '70', '0', '62', '-3', '6', 'CONTINUOUS', '0', 'ENDTAB', '0', 'ENDSEC'];
    const ents = [...rect('PEZZO', 0, 0, 80, 50), C('PEZZO', 40, 25, 10), ...rect('CARTIGLIO', -30, -30, 260, 180), L('QUOTE', 0, -10, 80, -10)];
    const file = ['0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC', ...tables, '0', 'SECTION', '2', 'ENTITIES', ...ents.flat().map(String), '0', 'ENDSEC', '0', 'EOF'].join('\r\n');
    await page.click('#btnFile'); await page.click('#menuFile [data-act="importDxf"]');
    await page.setInputFiles('#dxfFile', { name: 'tavola.dxf', mimeType: 'application/dxf', buffer: Buffer.from(file) });
    await page.waitForFunction(() => document.querySelector('#dxfPrev svg') && !document.querySelector('#dxfLayers').hidden, null, { timeout: 5000 });
    const look = () => page.evaluate(() => ({ boxes: [...document.querySelectorAll('#dxfLayers input[data-ly]')].map(x => x.dataset.ly + ':' + (x.checked ? 1 : 0)).join(' '),
      cap: document.querySelector('#dxfCap').textContent, svg: !!document.querySelector('#dxfPrev svg'), vb: (document.querySelector('#dxfPrev svg') || { getAttribute: () => '' }).getAttribute('viewBox'), ph: (document.querySelector('#dxfPrev .ph') || {}).textContent || '' }));
    const a = await look();
    await page.locator('#dxfLayers label.chk', { hasText: 'CARTIGLIO' }).locator('input').uncheck(); await page.waitForTimeout(100);
    const b = await look();
    await page.click('#dxfLayers button[data-all="0"]'); await page.waitForTimeout(100);
    const c = await look();
    await page.click('#modalActions .btn-primary'); await page.waitForTimeout(200);
    const errNone = await page.evaluate(() => document.querySelector('#dxfErr').hidden ? '' : document.querySelector('#dxfErr').textContent);
    await page.locator('#dxfLayers label.chk', { hasText: 'PEZZO' }).locator('input').check(); await page.waitForTimeout(100);
    await page.selectOption('#dxfOrigin', 'corner'); await page.waitForTimeout(100);
    const d = await look();
    await page.screenshot({ path: path.join(OUT, 'dxf-layer.png') });
    await page.selectOption('#dxfPlane', 'front');
    await page.click('#modalActions .btn-primary');
    await page.waitForFunction(() => App.mode === 'sketch' && document.querySelector('#modal').hidden, null, { timeout: 10000 });
    const sk = await page.evaluate(() => { const s = Sketcher.session(); return { ln: s.sk.ents.filter(e => e.t === 'ln').length, ci: s.sk.ents.filter(e => e.t === 'ci').length }; });
    await page.waitForTimeout(1200);
    await tool('exitSketch'); await page.evaluate(() => App.setCmdTab('features'));
    await tool('extrude');
    const dep = page.locator('.pm-body .row', { hasText: 'Profondità' }).first().locator('input');
    await dep.fill('10'); await dep.press('Tab');
    await page.click('.pm-ok'); await page.waitForTimeout(300);
    const p = await props();
    const Ve = 10 * (4000 - 100 * Math.PI);
    const ok = a.boxes === 'CARTIGLIO:1 PEZZO:1 QUOTE:0' && /^9 tra linee, archi e cerchi \(polilinee e blocchi divisi nei loro tratti\) · ingombro 290 × 210 mm/.test(a.cap) && a.svg && /^5 tra linee, archi e cerchi .* · ingombro 80 × 50 mm/.test(b.cap) && b.vb !== a.vb
      && !c.svg && /Nessun layer/.test(c.ph) && /almeno un layer/.test(errNone) && /^5 tra linee/.test(d.cap) && sk.ln === 4 && sk.ci === 1 && p && rel(p.V, Ve) < TOL && rel(p.bb[1][0], 80) < TOL && Math.abs(p.bb[0][0]) < 1e-6;
    rec('Interfaccia: DXF con più layer (caselle, anteprima, solo il pezzo)', ok,
      `layer «${a.boxes}»; «${a.cap}» → senza cartiglio «${b.cap}» → nessuno: «${c.ph}» / «${errNone}»; schizzo ${sk.ln} linee e ${sk.ci} cerchio; V ${p && p.V.toFixed(1)} (${Ve.toFixed(1)}), x ${p && p.bb[0][0].toFixed(3)}…${p && p.bb[1][0].toFixed(3)}`);
  } catch (e) { rec('Interfaccia: DXF con più layer (caselle, anteprima, solo il pezzo)', false, e.message.split('\n')[0]); }

  // 3m-bis2. DXF grande (oltre il vecchio limite di 3000 entità): piastra 600×600 con 360 fori ottagonali e 40 asole
  //          (3044 entità, come nella prova di calcolo) più un cartiglio su un altro layer. La finestra non dà avvisi,
  //          si importa, il mouse sullo schizzo resta veloce, si esce dallo schizzo e l'estrusione dà il volume calcolato a mano
  try {
    await fresh();
    const PL = (pts, ly = 'PEZZO') => ['0', 'LWPOLYLINE', '8', ly, '90', pts.length, '70', 1, ...pts.flatMap(p => ['10', p[0], '20', p[1], '42', p[2] || 0])];
    const ents = [PL([[-300, -300], [300, -300], [300, 300], [-300, 300]])];
    let nO = 0, nS = 0;
    for (let i = 0; i < 20; i++) for (let j = 0; j < 20; j++) {
      const x = -266 + 28 * i, y = -266 + 28 * j;
      if ((i * 20 + j) % 10 === 3) { ents.push(PL([[x - 5, y - 4], [x + 5, y - 4, 1], [x + 5, y + 4], [x - 5, y + 4, 1]])); nS++; }
      else { const q = []; for (let k = 0; k < 8; k++) q.push([x + 6 * Math.cos(Math.PI / 8 + k * Math.PI / 4), y + 6 * Math.sin(Math.PI / 8 + k * Math.PI / 4)]); ents.push(PL(q)); nO++; }
    }
    for (let k = 0; k < 40; k++) ents.push(['0', 'LINE', '8', 'CARTIGLIO', '10', 320 + k * 5, '20', -350, '30', 0, '11', 320 + k * 5, '21', -310, '31', 0]);
    const area = 360000 - nO * 2 * Math.SQRT2 * 36 - nS * (80 + 16 * Math.PI);
    await page.click('#btnFile'); await page.click('#menuFile [data-act="importDxf"]');
    await page.setInputFiles('#dxfFile', { name: 'piastra-grande.dxf', mimeType: 'application/dxf', buffer: Buffer.from(dxfText(ents, 4)) });
    await page.waitForFunction(() => /tra linee, archi e cerchi/.test(document.querySelector('#dxfCap').textContent) && !document.querySelector('#dxfLayers').hidden, null, { timeout: 30000 });
    const capAll = await page.evaluate(() => ({ t: document.querySelector('#dxfCap').textContent, warn: document.querySelector('#dxfCap').classList.contains('warn'), err: document.querySelector('#dxfErr').hidden ? '' : document.querySelector('#dxfErr').textContent }));
    await page.locator('#dxfLayers label.chk', { hasText: 'CARTIGLIO' }).locator('input').uncheck(); await page.waitForTimeout(150);
    const cap = await page.evaluate(() => document.querySelector('#dxfCap').textContent);
    const t0 = Date.now();
    await page.click('#modalActions .btn-primary');
    await page.waitForFunction(() => App.mode === 'sketch' && document.querySelector('#modal').hidden, null, { timeout: 60000 });
    const tImp = Date.now() - t0;
    const sk = await page.evaluate(() => { const s = Sketcher.session(); return { ln: s.sk.ents.filter(e => e.t === 'ln').length, ar: s.sk.ents.filter(e => e.t === 'ar').length, st: s.an && s.an.status }; });
    // 10 movimenti del mouse sopra il disegno (evidenziazione e agganci): prima ognuno bloccava la pagina per secondi
    const box = await page.locator('.view canvas').first().boundingBox();
    const t1 = Date.now();
    for (let i = 0; i < 10; i++) await page.mouse.move(box.x + box.width * (0.35 + 0.03 * i), box.y + box.height * (0.45 + 0.01 * i));
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
    const tMove = Date.now() - t1;
    await page.screenshot({ path: path.join(OUT, 'dxf-grande.png') });
    await page.keyboard.press('Escape');
    await tool('exitSketch'); await page.evaluate(() => App.setCmdTab('features'));
    await tool('extrude');
    const dep = page.locator('.pm-body .row', { hasText: 'Profondità' }).first().locator('input');
    await dep.fill('10'); await dep.press('Tab');
    await page.click('.pm-ok');
    await page.waitForFunction(() => App.st && App.st.body.length && !App.pm, null, { timeout: 120000 });
    const p = await props();
    const ok = !capAll.warn && !capAll.err && /^3\.?084 tra linee, archi e cerchi/.test(capAll.t) && /^3\.?044 tra linee, archi e cerchi/.test(cap)
      && sk.ln === 4 + 8 * nO + 2 * nS && sk.ar === 2 * nS && sk.st === 'under' && tMove < 5000 && p && rel(p.V, 10 * area) < TOL;
    rec('Interfaccia: DXF grande (3044 entità, oltre il vecchio limite di 3000): senza avvisi, schizzo, mouse veloce, estrusione', ok,
      `«${capAll.t}»${capAll.warn ? ' (avviso)' : ''}${capAll.err ? ' errore «' + capAll.err + '»' : ''} → senza cartiglio «${cap}»; importazione ${tImp} ms; schizzo ${sk.ln} linee, ${sk.ar} archi (${sk.st}); 10 movimenti del mouse ${tMove} ms; V ${p && p.V.toFixed(1)} (${(10 * area).toFixed(1)})`);
  } catch (e) {
    rec('Interfaccia: DXF grande (3044 entità, oltre il vecchio limite di 3000): senza avvisi, schizzo, mouse veloce, estrusione', false, e.message.split('\n')[0]);
    await page.evaluate(() => { if (!document.querySelector('#modal').hidden) document.querySelector('#modalActions .btn')?.click(); if (App.mode === 'sketch') Sketcher.exit(false); if (App.pm) App.closePM(false); }).catch(() => {});
  }

  // 3m-ter. raccordo sul bordo di un foro ellittico: un clic sceglie tutto il bordo (≈ 56 archi), un clic in un altro punto
  //         dello stesso bordo lo toglie; raccordo R3 confermato: materiale tolto = r²(1 − π/4)·(L + 2πc)
  try {
    await fresh();
    const P = (pts) => ['0', 'LWPOLYLINE', '8', '0', '90', pts.length, '70', 1, ...pts.flatMap(p => ['10', p[0], '20', p[1]])];
    const E = ['0', 'ELLIPSE', '8', '0', '10', 0, '20', 0, '30', 0, '11', 0, '21', 30, '31', 0, '40', 2 / 3, '41', 0, '42', 2 * Math.PI];
    const file = dxfText([P([[-60, -40], [60, -40], [60, 40], [-60, 40]]), E], 4);
    const V0 = await page.evaluate(text => {
      const s = Sketch.newSketch(); const r = Import.parseDXF(text); Import.dxfToSketch(s, r.geo, {});
      const d = Model.newDoc(); d.features.push({ id: 'S1', type: 'sketch', name: 'Schizzo1', plane: { kind: 'std', id: 'front' }, sk: s }, { id: 'E1', type: 'extrude', name: 'Estrusione1', sketch: 'S1', end: 'blind', depth: 10 });
      App.change(() => { App.doc = d; App.sel = []; }); App.r.setView(GLView.Renderer.viewQ('iso')); App.r.fit(false);
      return Model.massProperties(App.st, App.doc).volume;
    }, file);
    await page.waitForTimeout(600);
    await tool('fillet'); await page.waitForTimeout(300);
    const at = async q => { const [x, y] = await page.evaluate(q => { const p = App.r.project(q); const c = document.querySelector('.view canvas').getBoundingClientRect(); return [c.left + p[0], c.top + p[1]]; }, q); await page.mouse.move(x, y); await page.waitForTimeout(60); await page.mouse.click(x, y); await page.waitForTimeout(250); };
    const state = () => page.evaluate(() => { const h = App.pm && App.pm.highlight ? App.pm.highlight().filter(x => x.kind === 'edge') : [];
      const n = h.length;   // un riferimento per spigolo scelto
      return { n, hl: h.length, segs: h.length ? (App.edgeGroupKeys || []).filter(k => k === h[0].gkey).length : 0, label: (document.querySelector('#status') || {}).textContent || '' }; });
    await at([20, 0, 10]); const s1 = await state();
    await at([0, 30, 10]); const s2 = await state();   // stesso bordo, altro punto: lo toglie
    await at([0, -30, 10]); const s3 = await state();
    const rr = page.locator('.pm-body .row', { hasText: 'Raggio' }).first().locator('input');
    await rr.fill('3'); await rr.press('Tab'); await page.waitForTimeout(200);
    await page.click('.pm-ok'); await page.waitForTimeout(400);
    const p = await props();
    const warn = await page.evaluate(() => [...App.st.warn.values()]);
    const seams = await page.evaluate(() => App.st.topo.edges.filter(e => e.sharp && e.polys.length === 2 && e.polys.every(q => App.st.tags.get(App.st.body[q].t).scg)).length);
    const k = 1 - Math.PI / 4, r = 3, c = r * (10 - 3 * Math.PI) / (3 * (4 - Math.PI));
    const h = ((30 - 20) / 50) ** 2, L = Math.PI * 50 * (1 + 3 * h / (10 + Math.sqrt(4 - 3 * h)));
    const De = r * r * k * (L + 2 * Math.PI * c), D = p ? V0 - p.V : NaN;
    await page.screenshot({ path: path.join(OUT, 'raccordo-ellisse.png') });
    const ok = s1.n === 1 && s1.hl === 1 && s1.segs > 50 && s2.n === 0 && s3.n === 1 && p && !p.err.length && !warn.length && seams === 0 && rel(D, De) < TOL;
    rec('Interfaccia: raccordo sul bordo di un foro ellittico (un clic = tutto il bordo)', ok,
      `clic: ${s1.n} spigolo (${s1.segs} tratti evidenziati) → altro punto: ${s2.n} → ${s3.n}; tolti ${D.toFixed(2)} mm³ (${De.toFixed(2)}, ${(100 * rel(D, De)).toFixed(3)}%); righe tra i tratti ${seams}${warn.length ? '; avviso: ' + warn.join(' ') : ''}`);
  } catch (e) { rec('Interfaccia: raccordo sul bordo di un foro ellittico (un clic = tutto il bordo)', false, e.message.split('\n')[0]); }

  // 3m-quater. propagazione tangente: asola (linee 40, semicerchi R10) alta 10, un solo clic su una linea del bordo
  //            superiore; la casella è già spuntata; raccordo R3 su tutti e 4 gli spigoli: r²(1 − π/4)·(80 + 2π(10 − c))
  try {
    await fresh();
    const file = dxfText([['0', 'LWPOLYLINE', '8', '0', '90', 4, '70', 1, ...[[0, 0, 0], [40, 0, 1], [40, 20, 0], [0, 20, 1]].flatMap(p => ['10', p[0], '20', p[1], '42', p[2]])]], 4);
    const V0 = await page.evaluate(text => {
      const s = Sketch.newSketch(); const r = Import.parseDXF(text); Import.dxfToSketch(s, r.geo, {});
      const d = Model.newDoc(); d.features.push({ id: 'S1', type: 'sketch', name: 'Schizzo1', plane: { kind: 'std', id: 'front' }, sk: s }, { id: 'E1', type: 'extrude', name: 'Estrusione1', sketch: 'S1', end: 'blind', depth: 10 });
      App.change(() => { App.doc = d; App.sel = []; }); App.r.setView(GLView.Renderer.viewQ('iso')); App.r.fit(false);
      return Model.massProperties(App.st, App.doc).volume;
    }, file);
    await page.waitForTimeout(600);
    await tool('fillet'); await page.waitForTimeout(300);
    const box = page.locator('#pm label.chk', { hasText: 'Propagazione tangente' }).locator('input');
    const checked = await box.isChecked();
    const [x, y] = await page.evaluate(() => { const p = App.r.project([20, 0, 10]); const c = document.querySelector('.view canvas').getBoundingClientRect(); return [c.left + p[0], c.top + p[1]]; });
    await page.mouse.move(x, y); await page.waitForTimeout(60); await page.mouse.click(x, y); await page.waitForTimeout(250);
    const picked = await page.evaluate(() => App.pm.highlight().filter(h => h.kind === 'edge').length);
    const rr = page.locator('.pm-body .row', { hasText: 'Raggio' }).first().locator('input');
    await rr.fill('3'); await rr.press('Tab'); await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, 'propagazione-tangente.png') });
    await page.click('.pm-ok'); await page.waitForTimeout(400);
    const p = await props();
    const info = await page.evaluate(() => { const f = App.doc.features[App.doc.features.length - 1]; return { tangent: f.tangent, n: App.st.edgeCount && App.st.edgeCount.get(f.id), warn: [...App.st.warn.values()] }; });
    const r = 3, c = r * (10 - 3 * Math.PI) / (3 * (4 - Math.PI)), De = r * r * (1 - Math.PI / 4) * (80 + 2 * Math.PI * (10 - c)), D = p ? V0 - p.V : NaN;
    const ok = checked && picked === 1 && info.tangent === true && info.n === 4 && p && !p.err.length && !info.warn.length && rel(D, De) < TOL;
    rec('Interfaccia: propagazione tangente (un clic su una linea dell\'asola = 4 spigoli)', ok,
      `casella spuntata ${checked}; scelti ${picked}, lavorati ${info.n}; tolti ${D.toFixed(2)} mm³ (${De.toFixed(2)}, ${(100 * rel(D, De)).toFixed(3)}%)${info.warn.length ? '; avviso: ' + info.warn.join(' ') : ''}`);
  } catch (e) { rec('Interfaccia: propagazione tangente (un clic su una linea dell\'asola = 4 spigoli)', false, e.message.split('\n')[0]); await page.evaluate(() => { if (App.pm) App.closePM(false); }); }

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

  // 3n-bis. STEP: lettura in un Worker (la pagina non si blocca, si può annullare), scelta dei corpi, colori del file
  try {
    await fresh();
    const { stepTwoBoxesColored, stepPlateHole } = require('./stepgen.js');
    const file = Buffer.from(stepTwoBoxesColored(10, 5));
    // lettore da preparare di nuovo (il più lento): durante la lettura la pagina deve continuare a disegnare
    await page.evaluate(() => { App.cadCancel(); window.__gap = 0; window.__run = true; let last = performance.now(); const tick = t => { window.__gap = Math.max(window.__gap, t - last); last = t; if (window.__run) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    await page.click('#btnFile'); await page.click('#menuFile [data-act="importCad"]');
    await page.setInputFiles('#cadFile', { name: 'assieme.step', mimeType: 'application/step', buffer: file });
    await page.evaluate(() => { window.__gap = 0; });
    await page.click('#modalActions .btn-primary');
    await page.waitForFunction(() => document.querySelectorAll('#modalBody input[data-body]').length === 2, null, { timeout: 30000 });
    const gap = await page.evaluate(() => { window.__run = false; return { gap: window.__gap, mode: App.cadMode }; });
    const list = await page.evaluate(() => [...document.querySelectorAll('#modalBody label.cad-body')].map(l => l.textContent.replace(/\s+/g, ' ').trim()));
    await page.click('#modalBody button[data-all="0"]'); await page.click('#modalActions .btn-primary'); await page.waitForTimeout(150);
    const none = await page.evaluate(() => { const e = document.querySelector('#cadErr'); return e && !e.hidden ? e.textContent : ''; });
    await page.locator('#modalBody label.cad-body').nth(1).locator('input').check();
    await page.click('#modalActions .btn-primary');
    await page.waitForFunction(() => App.doc.features.some(f => f.type === 'import') && document.querySelector('#modal').hidden, null, { timeout: 30000 });
    const p1 = await props();
    const ok1 = gap.mode === 'worker' && gap.gap < 200 && list.length === 2 && list.every(t => /6 facce · 1 cm³$/.test(t)) && /almeno un corpo/.test(none)
      && p1 && rel(p1.V, 1000) < TOL && Math.abs(p1.bb[0][0] - 15) < 1e-3 && Math.abs(p1.bb[1][0] - 25) < 1e-3;
    rec('Interfaccia: STEP letto a parte (pagina libera) e scelta dei corpi di un assieme', ok1,
      `lettore: ${gap.mode}, fotogramma più lungo durante la lettura ${gap.gap.toFixed(0)} ms; corpi «${list.join(' | ')}»; nessuno scelto: «${none}»; solo il 2°: V ${p1 && p1.V.toFixed(1)}, x ${p1 && p1.bb[0][0].toFixed(2)}…${p1 && p1.bb[1][0].toFixed(2)}`);
    // tutti i corpi con i colori: faccia di sotto del primo cubo rossa, il resto del primo blu, il secondo grigio; senza colori: tutto grigio
    await fresh();
    const r2 = await page.evaluate(async bytes => { const r = await App.importCadData('assieme.step', new Uint8Array(bytes), {}); return { faces: r.info.brepFaces, parts: r.info.parts }; }, [...file]);
    await page.waitForTimeout(300);
    const colors = () => page.evaluate(() => { const c = App.r.colors, n = { red: 0, blue: 0, other: 0 };
      for (let i = 0; i < c.length; i += 9) { const k = c[i] === 1 && c[i + 1] === 0 && c[i + 2] === 0 ? 'red' : c[i] === 0 && c[i + 1] === 0 && c[i + 2] === 1 ? 'blue' : 'other'; n[k]++; } return n; });
    const c1 = await colors();
    await page.locator('.tnode', { hasText: 'Importato1' }).dblclick(); await page.waitForTimeout(300);
    await page.locator('#pm label.chk', { hasText: 'Colori del file' }).locator('input').uncheck(); await page.waitForTimeout(300);
    await page.click('#pm .pm-ok'); await page.waitForTimeout(300);
    const c2 = await colors();
    await page.evaluate(() => { App.r.setView(GLView.Renderer.viewQ('iso')); App.r.fit(false); });
    const ok2 = r2.faces === 12 && r2.parts === 2 && c1.red === 2 && c1.blue === 10 && c1.other === 12 && c2.red === 0 && c2.blue === 0;
    rec('Interfaccia: colori delle facce dal file STEP (e casella per toglierli)', ok2, `facce ${r2.faces}, corpi ${r2.parts}; triangoli rossi ${c1.red}, blu ${c1.blue}, altri ${c1.other}; senza colori: rossi ${c2.red}, blu ${c2.blue}`);
    // assonometria ombreggiata nella tavola, con i colori del file. In assonometria (direzione 1,1,1) di ogni cubo si vedono 3
    // facce (2 triangoli ciascuna): il primo cubo blu (la faccia rossa è quella di sotto, nascosta), il secondo grigio.
    // Senza la casella: nessuna faccia piena. Il DXF resta a linee.
    try {
      await fresh();
      await page.evaluate(async bytes => { await App.importCadData('assieme.step', new Uint8Array(bytes), {}); }, [...file]);
      await page.waitForTimeout(300);
      await page.evaluate(() => { App.drawingState = null; App.setCmdTab('drawing'); }); await page.waitForTimeout(500);
      const cls = () => page.evaluate(() => { const d = new DOMParser().parseFromString(document.querySelector('#sheetView svg').outerHTML, 'image/svg+xml');
        const n = { blue: 0, grey: 0, red: 0, other: 0 };
        for (const p of d.querySelectorAll('g[data-view="iso"] g[data-shade] polygon')) { const [r, g, b] = p.getAttribute('fill').match(/\d+/g).map(Number);
          n[r === 0 && g === 0 && b > 0 ? 'blue' : r > 0 && g === 0 && b === 0 ? 'red' : r > 0 && r < g && g < b ? 'grey' : 'other']++; }
        return n; });
      const before = await cls();
      const box = page.locator('#pm label.chk', { hasText: 'Assonometria ombreggiata' }).locator('input');
      await box.check(); await page.waitForTimeout(600);
      const after = await cls();
      await page.screenshot({ path: path.join(OUT, 'tavola-ombreggiata.png') });
      const dxf = await page.evaluate(() => { const t = Drawing.toDXF(); return { solid: /\nSOLID\n|\nHATCH\n|\n3DFACE\n/.test(t), shaded: !!Drawing.state().shaded }; });
      await page.evaluate(() => App.setCmdTab('features')); await page.waitForTimeout(300);
      const ok3 = before.blue + before.grey + before.red + before.other === 0 && after.blue === 6 && after.grey === 6 && after.red === 0 && after.other === 0 && !dxf.solid && dxf.shaded;
      rec('Interfaccia: assonometria ombreggiata nella tavola con i colori del file STEP', ok3,
        `senza casella: ${JSON.stringify(before)}; con la casella: blu ${after.blue}, grigie ${after.grey}, rosse ${after.red}, altre ${after.other}; DXF con facce piene: ${dxf.solid}`);
    } catch (e) { rec('Interfaccia: assonometria ombreggiata nella tavola con i colori del file STEP', false, e.message.split('\n')[0]); await page.evaluate(() => { const m = document.querySelector('#modal'); if (m && !m.hidden) { const b = document.querySelector('#modalActions .btn:not(.btn-primary)'); if (b) b.click(); } if (App.pm) App.closePM(false); if (App.mode === 'drawing') App.setCmdTab('features'); }); }
    // un «Importato» per ogni corpo: dalla finestra (casella già spuntata) due funzioni, ognuna con il suo cubo da 1000 mm³
    // (il primo con la faccia rossa e le altre blu, il secondo senza colori); un solo Annulla le toglie tutte e due.
    // Senza la casella: una funzione sola con i due corpi (2000 mm³). Anche importCadData con separate: true.
    try {
      await fresh();
      await page.click('#btnFile'); await page.click('#menuFile [data-act="importCad"]');
      await page.setInputFiles('#cadFile', { name: 'assieme.step', mimeType: 'application/step', buffer: file });
      await page.click('#modalActions .btn-primary');
      await page.waitForFunction(() => document.querySelectorAll('#modalBody input[data-body]').length === 2, null, { timeout: 30000 });
      const sepChecked = await page.locator('#cadSeparate').isChecked();
      await page.click('#modalActions .btn-primary');
      await page.waitForFunction(() => App.doc.features.filter(f => f.type === 'import').length === 2 && document.querySelector('#modal').hidden, null, { timeout: 30000 });
      await page.waitForTimeout(300);
      const two = await page.evaluate(() => {
        const imp = App.doc.features.filter(f => f.type === 'import');
        const vol = id => { const d = { ...App.doc, features: App.doc.features.filter(f => f.type !== 'import' || f.id === id) }; const st = Model.regen(d); return Model.massProperties(st, d).volume; };
        const red = id => { const st = Model.regen({ ...App.doc, features: App.doc.features.filter(f => f.id === id) }); let r = 0, b = 0; for (const p of st.body) { const c = st.tags.get(p.t).rgb; if (c && c[0] === 1 && !c[2]) r++; if (c && c[2] === 1 && !c[0]) b++; } return [r, b]; };
        return { n: imp.length, names: imp.map(f => f.name), V: imp.map(f => vol(f.id)), Vall: Model.massProperties(App.st, App.doc).volume, col: imp.map(f => red(f.id)), tree: imp.every(f => [...document.querySelectorAll('.tnode')].some(t => t.textContent.includes(f.name))) };
      });
      await page.evaluate(() => App.undo()); await page.waitForTimeout(300);
      const afterUndo = await page.evaluate(() => App.doc.features.filter(f => f.type === 'import').length);
      await fresh();
      await page.click('#btnFile'); await page.click('#menuFile [data-act="importCad"]');
      await page.setInputFiles('#cadFile', { name: 'assieme.step', mimeType: 'application/step', buffer: file });
      await page.click('#modalActions .btn-primary');
      await page.waitForFunction(() => document.querySelectorAll('#modalBody input[data-body]').length === 2, null, { timeout: 30000 });
      await page.locator('#cadSeparate').uncheck();
      await page.click('#modalActions .btn-primary');
      await page.waitForFunction(() => App.doc.features.some(f => f.type === 'import') && document.querySelector('#modal').hidden, null, { timeout: 30000 });
      await page.waitForTimeout(300);
      const one = await page.evaluate(() => ({ n: App.doc.features.filter(f => f.type === 'import').length, V: Model.massProperties(App.st, App.doc).volume }));
      await fresh();
      const api = await page.evaluate(async bytes => { const r = await App.importCadData('assieme.step', new Uint8Array(bytes), { separate: true }); return { n: App.doc.features.filter(f => f.type === 'import').length, fs: r.fs && r.fs.length, msg: r.msg }; }, [...file]);
      const ok4 = sepChecked && two.n === 2 && two.tree && two.V.every(v => rel(v, 1000) < TOL) && rel(two.Vall, 2000) < TOL && two.col[0][0] === 2 && two.col[0][1] === 10 && two.col[1][0] === 0 && two.col[1][1] === 0
        && afterUndo === 0 && one.n === 1 && rel(one.V, 2000) < TOL && api.n === 2 && api.fs === 2;
      rec('Interfaccia: un «Importato» per ogni corpo di un assieme STEP (e uno solo togliendo la casella)', ok4,
        `casella ${sepChecked}; funzioni ${two.n} (${two.names.join(', ')}), volumi ${two.V.map(v => v.toFixed(1)).join(' + ')} = ${two.Vall.toFixed(1)}; triangoli rossi/blu ${JSON.stringify(two.col)}; dopo un Annulla ${afterUndo}; senza casella ${one.n} funzione, V ${one.V.toFixed(1)}; da codice ${api.n} («${api.msg}»)`);
    } catch (e) { rec('Interfaccia: un «Importato» per ogni corpo di un assieme STEP (e uno solo togliendo la casella)', false, e.message.split('\n')[0]); await page.evaluate(() => { const m = document.querySelector('#modal'); if (m && !m.hidden) { const b = document.querySelector('#modalActions .btn:not(.btn-primary)'); if (b) b.click(); } if (App.pm) App.closePM(false); if (App.mode === 'drawing') App.setCmdTab('features'); }); }
    // Annulla durante la lettura: niente funzione nuova, niente errori; dopo si importa normalmente
    await fresh();
    await page.evaluate(() => App.cadCancel());
    await page.click('#btnFile'); await page.click('#menuFile [data-act="importCad"]');
    await page.setInputFiles('#cadFile', { name: 'piastra.stp', mimeType: 'application/step', buffer: Buffer.from(stepPlateHole(60, 40, 10, 8)) });
    await page.click('#modalActions .btn-primary'); await page.waitForTimeout(30);
    await page.click('#modalActions .btn:not(.btn-primary)'); await page.waitForTimeout(800);
    const afterCancel = await page.evaluate(() => ({ n: App.doc.features.filter(f => f.type === 'import').length, modal: !document.querySelector('#modal').hidden }));
    const r3 = await page.evaluate(async b => { const r = await App.importCadData('piastra.stp', new Uint8Array(b), {}); return r.info.brepFaces; }, [...Buffer.from(stepPlateHole(60, 40, 10, 8))]);
    rec('Interfaccia: lettura STEP annullata, poi una nuova importazione funziona', afterCancel.n === 0 && !afterCancel.modal && r3 === 7, `dopo Annulla: ${afterCancel.n} importati, finestra ${afterCancel.modal ? 'aperta' : 'chiusa'}; nuova importazione: ${r3} facce`);
  } catch (e) { rec('Interfaccia: STEP letto a parte (pagina libera) e scelta dei corpi di un assieme', false, e.message.split('\n')[0]); }

  // 4. glossario: ogni comando e ogni titolo dei pannelli ha la sua spiegazione
  try {
    await fresh();
    const miss = await page.evaluate(async () => {
      const out = new Set();
      const wait = ms => new Promise(r => setTimeout(r, ms));
      for (const tab of ['features', 'evaluate', 'sketch', 'drawing', 'assembly']) {
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
      for (const tab of ['features', 'sketch', 'evaluate', 'drawing', 'assembly']) {
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

  // 3k. rotella: zoom verso il puntatore (avanti ingrandisce, indietro riduce), niente spostamento di lato; Ctrl + rotella ruota;
  //     Maiusc + rotella fa lo zoom come la rotella da sola. Il punto sotto il puntatore resta fermo.
  try {
    await fresh();
    await page.evaluate(() => { App.setCmdTab('features'); App.r.setView(GLView.Renderer.viewQ('iso')); App.r.fit(false); });
    await page.waitForTimeout(300);
    const box = await page.locator('#view').boundingBox();
    const cv = await page.evaluate(() => { const b = document.querySelector('.view canvas').getBoundingClientRect(); return [b.left, b.top]; });
    // puntatore fuori centro: così si vede se il punto sotto il mouse scappa
    const mx = box.x + box.width * 0.7, my = box.y + box.height * 0.35, lx = mx - cv[0], ly = my - cv[1];
    await page.mouse.move(mx, my);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const cam = () => page.evaluate(([lx, ly]) => { const c = App.r.cam; App.r.mats = App.r.matrices(); const o = App.r.ray(lx, ly).o, b = App.r.basis();
      return { t: c.target.slice(), q: c.q.slice(), s: c.scale, px: App.r.pxSize(), h: o[0] * b.right[0] + o[1] * b.right[1] + o[2] * b.right[2], v: o[0] * b.up[0] + o[1] * b.up[1] + o[2] * b.up[2] }; }, [lx, ly]);
    const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
    const c0 = await cam();
    await page.mouse.wheel(0, -100); await page.waitForTimeout(150);      // avanti: ingrandisce
    const c1 = await cam();
    await page.mouse.wheel(0, 100); await page.waitForTimeout(150);       // indietro: riduce (si torna come prima)
    const c2 = await cam();
    await page.keyboard.down('Control'); await page.mouse.wheel(0, 100); await page.keyboard.up('Control'); await page.waitForTimeout(150);
    const c3 = await cam();
    await page.keyboard.down('Shift'); await page.mouse.wheel(0, -100); await page.keyboard.up('Shift'); await page.waitForTimeout(150);
    const c4 = await cam();
    // zoom = e^(±100·0,0015) = ×1,1618; il punto del modello sotto il puntatore resta lo stesso (scarto in pixel)
    const k = Math.exp(0.15);
    const fixed = (a, b) => Math.hypot(a.h - b.h, a.v - b.v) / a.px;
    const inOk = rel(c0.s / c1.s, k) < TOL && dist(c1.q, c0.q) < 1e-9 && fixed(c0, c1) < 0.5;
    const outOk = rel(c2.s, c0.s) < 1e-9 && dist(c2.q, c0.q) < 1e-9 && fixed(c1, c2) < 0.5 && dist(c2.t, c0.t) < 1e-6 * c0.s;
    const rotOk = dist(c3.q, c2.q) > 0.05 && c3.s === c2.s && dist(c3.t, c2.t) < 1e-9;
    const shOk = rel(c3.s / c4.s, k) < TOL && dist(c4.q, c3.q) < 1e-9;
    rec('Rotella: zoom verso il puntatore (avanti ingrandisce, indietro riduce), Ctrl ruota, Maiusc zoom', inOk && outOk && rotOk && shOk,
      `avanti ×${(c0.s / c1.s).toFixed(4)} (${k.toFixed(4)}), indietro ×${(c1.s / c2.s).toFixed(4)}; punto sotto il puntatore spostato di ${fixed(c0, c1).toFixed(2)} e ${fixed(c1, c2).toFixed(2)} px; ritorno alla vista di partenza ${outOk ? 'sì' : 'NO'}; Ctrl ruota ${rotOk ? 'sì' : 'NO'}; Maiusc ×${(c3.s / c4.s).toFixed(4)}`);
  } catch (e) { rec('Rotella: zoom verso il puntatore (avanti ingrandisce, indietro riduce), Ctrl ruota, Maiusc zoom', false, e.message.split('\n')[0]); }
  // rotella usata mentre la vista sta ancora girando (animazione di un cambio di orientamento): lo zoom non si perde
  try {
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const a = await page.evaluate(() => App.r.cam.scale);
    await page.evaluate(() => App.r.setView(GLView.Renderer.viewQ('front')));
    await page.mouse.wheel(0, -100); await page.waitForTimeout(700);
    const b = await page.evaluate(() => ({ s: App.r.cam.scale, q: App.r.cam.q.slice() }));
    const front = await page.evaluate(() => GLView.Renderer.viewQ('front'));
    const qOk = Math.min(Math.hypot(...b.q.map((v, i) => v - front[i])), Math.hypot(...b.q.map((v, i) => v + front[i]))) < 1e-9;
    rec('Rotella durante un cambio di vista: lo zoom resta', qOk && rel(a / b.s, Math.exp(0.15)) < TOL, `vista frontale ${qOk ? 'sì' : 'NO'}, zoom ×${(a / b.s).toFixed(4)} (${Math.exp(0.15).toFixed(4)})`);
  } catch (e) { rec('Rotella durante un cambio di vista: lo zoom resta', false, e.message.split('\n')[0]); }
  // rotella nella messa in tavola: zoom del foglio (prima serviva Ctrl), avanti ingrandisce e indietro riduce,
  // e il punto del foglio sotto il puntatore resta fermo (puntatore al centro in orizzontale, in alto in verticale)
  try {
    await fresh();
    await page.evaluate(() => { App.change(() => { App.doc = JSON.parse(JSON.stringify(window.PEZZI.piastra)); App.sel = []; }); App.drawingState = null; App.setCmdTab('drawing'); });
    await page.waitForTimeout(500);
    const sb = await page.locator('#sheetScroll').boundingBox();
    const mx = sb.x + sb.width / 2, my = sb.y + sb.height * 0.3;
    await page.mouse.move(mx, my);
    const sh = () => page.evaluate(([mx, my]) => { const b = document.querySelector('#sheetHolder svg').getBoundingClientRect(); return { w: b.width, fx: (mx - b.left) / b.width, fy: (my - b.top) / b.height }; }, [mx, my]);
    const s0 = await sh();
    await page.mouse.wheel(0, -100); await page.waitForTimeout(200);
    const s1 = await sh();
    await page.mouse.wheel(0, 100); await page.waitForTimeout(200);
    const s2 = await sh();
    await page.evaluate(() => App.setCmdTab('features')); await page.waitForTimeout(200);
    const k = Math.exp(0.15);
    const ok = rel(s1.w / s0.w, k) < TOL && rel(s2.w, s0.w) < 1e-6 && Math.abs(s1.fx - s0.fx) * s1.w < 1.5 && Math.abs(s1.fy - s0.fy) * s1.w < 1.5 && Math.abs(s2.fy - s0.fy) * s2.w < 1.5;
    rec('Messa in tavola: rotella = zoom del foglio verso il puntatore', ok,
      `larghezza del foglio ${s0.w.toFixed(0)} → ${s1.w.toFixed(0)} (×${(s1.w / s0.w).toFixed(4)}, atteso ${k.toFixed(4)}) → ${s2.w.toFixed(0)}; punto sotto il puntatore spostato di ${(Math.abs(s1.fx - s0.fx) * s1.w).toFixed(2)} / ${(Math.abs(s1.fy - s0.fy) * s1.w).toFixed(2)} px`);
  } catch (e) { rec('Messa in tavola: rotella = zoom del foglio verso il puntatore', false, e.message.split('\n')[0]); await page.evaluate(() => App.setCmdTab('features')).catch(() => {}); }

  // 3l. tablet: due dita = zoom sempre; ruotare/spostare solo dopo aver toccato il pezzo
  try {
    const tctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: false });
    await tctx.addInitScript(PEZZI_JS);
    const tp = await tctx.newPage();
    tp.on('pageerror', e => errors.push('pageerror (tablet): ' + e.message));
    await tp.goto('file://' + page_);
    await tp.waitForFunction(() => window.App && App.r, null, { timeout: 15000 });
    await tp.evaluate(() => { App.change(() => { App.doc = JSON.parse(JSON.stringify(window.PEZZI.piastra)); }); App.setCmdTab('features'); App.r.setView(GLView.Renderer.viewQ('iso')); App.r.fit(false); });
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

  // 6a. Salva PDF: tavola (vettoriale, foglio vero, 1:1), schizzo (vettoriale, scala normalizzata), vista 3D (immagine);
  //     Esporta STEP. Ogni PDF è riletto con pdfplumber (un lettore che non ha niente del programma) e misurato in mm.
  const lastPdf = async file => {
    await page.waitForFunction(() => App.lastPdf && !App.pdfBusy, null, { timeout: 60000 });
    const r = await page.evaluate(() => { const r = App.lastPdf; let s = ''; const u = r.bytes; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); return { ...r, bytes: undefined, b64: btoa(s) }; });
    const buf = Buffer.from(r.b64, 'base64'); require('fs').writeFileSync(path.join(OUT, file), buf);
    r.head = buf.slice(0, 8).toString('latin1'); r.tail = buf.slice(-6).toString('latin1'); r.len = buf.length;
    r.chk = pdfCheck(path.join(OUT, file));
    return r;
  };
  const camOf = () => page.evaluate(() => JSON.stringify([App.r.cam.q, App.r.cam.target, App.r.cam.scale, App.r.bg || null]));
  try {
    await fresh();
    await page.evaluate(() => { App.change(() => { App.doc = JSON.parse(JSON.stringify(window.PEZZI.squadretta)); App.sel = []; }); App.drawingState = null; App.setCmdTab('drawing'); });
    await page.waitForTimeout(600);
    await page.evaluate(() => Drawing.cmd('dAuto')); await page.waitForTimeout(300);
    // testi della tavola (dalla SVG): quelli orizzontali con il loro punto d'appoggio
    const sv = await page.evaluate(() => { const r = Drawing.render(); const d = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
      const tx = [...d.querySelectorAll('text')].map(t => { let a = t.getAttribute('text-anchor'); for (let p = t.parentElement; !a && p; p = p.parentElement) a = p.getAttribute && p.getAttribute('text-anchor');
        return { s: t.textContent.replace(/\s+/g, ' ').trim(), x: +t.getAttribute('x'), y: +t.getAttribute('y'), a: a || 'start', rot: !!t.getAttribute('transform') }; }).filter(t => t.s);
      return { W: r.L.W, H: r.L.H, tx, all: d.querySelectorAll('text').length }; });
    await page.evaluate(() => { App.lastPdf = null; });
    await page.click('#cmdBar [data-cmd="dPdf"]');
    const r = await lastPdf('tavola.pdf');
    let ind = 'controllo con pdfplumber saltato (manca python3 o pdfplumber)', okInd = true;
    if (r.chk) {
      const pg = r.chk[0], txt = pg.text.replace(/\s+/g, ' ');
      const frame = pg.rects.some(q => Math.abs(q[0] - 20) < 0.01 && Math.abs(q[1] - 10) < 0.01 && Math.abs(q[2] - (sv.W - 10)) < 0.01 && Math.abs(q[3] - (sv.H - 10)) < 0.01);
      const hor = sv.tx.filter(t => !t.rot);
      const found = hor.filter(t => txt.includes(t.s)).length;
      // quote orizzontali (testo centrato): il centro della parola nel PDF sul punto d'appoggio della SVG
      let dmax = 0, nq = 0;
      for (const t of hor.filter(t => t.a === 'middle' && /^[\dØR,.×\s]+$/.test(t.s))) {
        const w = pg.words.filter(w => w.t === t.s).sort((a, b) => Math.hypot((a.x0 + a.x1) / 2 - t.x, a.bottom - t.y) - Math.hypot((b.x0 + b.x1) / 2 - t.x, b.bottom - t.y))[0];
        if (w) { nq++; dmax = Math.max(dmax, Math.abs((w.x0 + w.x1) / 2 - t.x)); }
      }
      okInd = Math.abs(pg.w - sv.W) < 0.01 && Math.abs(pg.h - sv.H) < 0.01 && frame && found === hor.length && nq >= 3 && dmax < 0.05 && pg.lines.length > 100;
      ind = `pdfplumber: foglio ${pg.w.toFixed(3)} × ${pg.h.toFixed(3)} mm, squadratura ${frame ? 'al suo posto' : 'NON trovata'}, ${pg.lines.length} linee, testi trovati ${found}/${hor.length}, ${nq} quote centrate entro ${dmax.toFixed(3)} mm`;
    }
    const ok = r.head.startsWith('%PDF-1.4') && r.tail.includes('%%EOF') && r.what === 'tavola' && r.stats.texts === sv.all && !Object.keys(r.stats.skipped).length && okInd;
    rec('Salva PDF della tavola: foglio vero in scala 1:1, linee e testi al loro posto', ok, `${r.file}, ${r.len} byte, ${r.stats.lines} linee, ${r.stats.texts} testi (SVG ${sv.all}, di cui ${sv.all - sv.tx.length} vuoti); ${ind}`);
    await page.evaluate(() => App.setCmdTab('features')); await page.waitForTimeout(200);
  } catch (e) { rec('Salva PDF della tavola: foglio vero in scala 1:1, linee e testi al loro posto', false, e.message.split('\n')[0]); await page.evaluate(() => App.setCmdTab('features')).catch(() => {}); }
  try {
    await fresh();
    await startSketchOn('Piano superiore');
    await tool('rect'); await click(0, 0); await click(70, 40);
    await dimLine([0, 0], [70, 0], [0, -12], 80);
    await dimLine([80, 0], [80, 40], [12, 0], 50);
    await page.keyboard.press('Escape'); await page.waitForTimeout(100);
    const st = await page.evaluate(() => Sketch.analyze(Sketcher.session().sk).status);
    const c0 = await camOf(), sel0 = await page.evaluate(() => Sketcher.session().sel.size);
    await page.evaluate(() => { App.lastPdf = null; });
    await page.click('#btnFile');
    const label = await page.locator('#menuFile [data-act="pdf"]').textContent();
    await page.click('#menuFile [data-act="pdf"]');
    const r = await lastPdf('schizzo.pdf');
    const c1 = await camOf(), sel1 = await page.evaluate(() => Sketcher.session().sel.size);
    let ind = 'controllo con pdfplumber saltato (manca python3 o pdfplumber)', okInd = true;
    if (r.chk) {
      const pg = r.chk[0];
      // il rettangolo 80 × 50 a scala 2:1: lati di 160 e 100 mm sulla carta
      const H = pg.lines.filter(l => Math.abs(l[1] - l[3]) < 1e-6 && Math.abs(Math.abs(l[2] - l[0]) - 160) < 0.02);
      const V = pg.lines.filter(l => Math.abs(l[0] - l[2]) < 1e-6 && Math.abs(Math.abs(l[3] - l[1]) - 100) < 0.02);
      // la coppia di lati opposti (le altre linee lunghe uguali sono le linee di quota)
      const pairGap = (L, k, want) => { let best = null; for (const a of L) for (const b of L) { const g = Math.abs(a[k] - b[k]); if (g > 1 && (best === null || Math.abs(g - want) < Math.abs(best - want))) best = g; } return best || 0; };
      const gapH = pairGap(H, 1, 100), gapV = pairGap(V, 0, 160);
      const words = pg.words.map(w => w.t);
      okInd = H.length >= 2 && V.length >= 2 && Math.abs(gapH - 100) < 0.02 && Math.abs(gapV - 160) < 0.02 && words.includes('80') && words.includes('50') && /Scala 2:1/.test(pg.text) && Math.abs(pg.w - 297) < 0.01;
      ind = `pdfplumber: ${H.length} lati orizzontali da ${H[0] ? Math.abs(H[0][2] - H[0][0]).toFixed(3) : '?'} mm a ${gapH.toFixed(3)} mm di distanza, ${V.length} verticali da ${V[0] ? Math.abs(V[0][3] - V[0][1]).toFixed(3) : '?'} mm a ${gapV.toFixed(3)} mm; quote «80» ${words.includes('80') ? 'sì' : 'NO'} e «50» ${words.includes('50') ? 'sì' : 'NO'}`;
    }
    const ok = label === 'Salva PDF dello schizzo' && st === 'full' && r.what === 'schizzo' && r.scale === '2:1' && !r.missing.length && c0 === c1 && sel0 === sel1 && okInd;
    rec('Salva PDF dello schizzo: rettangolo 80 × 50 a scala 2:1 (160 × 100 mm sulla carta), vista e selezione intatte', ok,
      `voce «${label}», scala ${r.scale}, comandi mancanti: ${r.missing.join(', ') || 'nessuno'}, vista ${c0 === c1 ? 'uguale' : 'CAMBIATA'}; ${ind}`);
    // vista 3D del pezzo estruso
    await tool('exitSketch'); await page.evaluate(() => App.setCmdTab('features'));
    await tool('extrude');
    const dep = page.locator('.pm-body .row', { hasText: 'Profondità' }).first().locator('input');
    await dep.fill('10'); await dep.press('Tab'); await page.click('.pm-ok'); await page.waitForTimeout(300);
    await page.evaluate(() => { App.r.setView(GLView.Renderer.viewQ('iso')); App.r.fit(false); });
    await page.waitForTimeout(400);
    const v0 = await camOf();
    await page.evaluate(() => { App.lastPdf = null; });
    await page.click('#btnFile');
    const label2 = await page.locator('#menuFile [data-act="pdf"]').textContent();
    await page.click('#menuFile [data-act="pdf"]');
    const rv = await lastPdf('vista.pdf');
    const v1 = await camOf();
    const cvs = await page.evaluate(() => [App.r.canvas.width, App.r.canvas.height]);
    let ind2 = 'controllo con pdfplumber saltato (manca python3 o pdfplumber)', okInd2 = true;
    if (rv.chk) {
      const im = rv.chk[0].images[0] || {};
      okInd2 = rv.chk[0].images.length === 1 && im.src[0] === cvs[0] && im.src[1] === cvs[1] && Math.abs(im.w / im.h - cvs[0] / cvs[1]) < 1e-3 * cvs[0] / cvs[1]
        && im.x0 >= 10 - 1e-3 && im.top >= 10 - 1e-3 && im.x0 + im.w <= 287 + 1e-3 && im.top + im.h <= 188 + 1e-3 && Math.min(Math.abs(im.w - 277), Math.abs(im.h - 178)) < 1e-3
        && Math.abs((im.x0 + im.w / 2) - 148.5) < 1e-3 && Math.abs((im.top + im.h / 2) - 99) < 1e-3;
      ind2 = `pdfplumber: immagine ${im.src && im.src.join(' × ')} px in ${im.w && im.w.toFixed(2)} × ${im.h && im.h.toFixed(2)} mm da (${im.x0 && im.x0.toFixed(2)}, ${im.top && im.top.toFixed(2)})`;
    }
    const ok2 = label2 === 'Salva PDF della vista 3D' && rv.what === 'vista' && rv.px[0] === cvs[0] && rv.px[1] === cvs[1] && rv.ink > 0.02 && rv.ink < 0.9 && v0 === v1 && okInd2;
    rec('Salva PDF della vista 3D: immagine intera della vista, non deformata, nel riquadro A4; vista intatta', ok2,
      `voce «${label2}», ${rv.px.join(' × ')} px, disegnato il ${(rv.ink * 100).toFixed(1)} % dei pixel, vista ${v0 === v1 ? 'uguale' : 'CAMBIATA'}; ${ind2}`);
    // STEP dal menu, riletto nel Banco CAD con il lettore STEP vero
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), (async () => { await page.click('#btnFile'); await page.click('#menuFile [data-act="step"]'); })()]);
    const stepPath = path.join(OUT, 'pezzo.step'); await dl.saveAs(stepPath);
    const stepTxt = require('fs').readFileSync(stepPath, 'latin1');
    const stats = await page.evaluate(() => App.lastStep.stats);
    await fresh();
    await page.evaluate(async t => { await App.importCadData('pezzo.step', new TextEncoder().encode(t), {}); }, stepTxt);
    await page.waitForTimeout(300);
    const p = await props();
    const ok3 = /\.step$/.test(dl.suggestedFilename()) && /^ISO-10303-21;/.test(stepTxt) && /MANIFOLD_SOLID_BREP/.test(stepTxt) && stats.faces === 6 && stats.edges === 12 && stats.badEdges === 0 && stats.solids === 1
      && p && Math.abs(p.V - 40000) < 1e-6 && Math.abs(p.A - 10600) < 1e-6;
    rec('Esporta STEP (menu Progetto): blocco 80 × 50 × 10 con 6 facce e 12 spigoli, riletto nel Banco CAD con volume e area esatti', ok3,
      `${dl.suggestedFilename()}, ${stepTxt.length} byte, ${stats.faces} facce, ${stats.edges} spigoli, ${stats.solids} solido; riletto: V ${p && p.V.toFixed(6)}, A ${p && p.A.toFixed(6)}`);
  } catch (e) {
    rec('Salva PDF dello schizzo e della vista 3D, Esporta STEP', false, e.message.split('\n')[0]);
    await page.evaluate(() => { document.querySelector('#menuFile').hidden = true; if (App.mode === 'sketch') Sketcher.exit(false); if (App.pm) App.closePM(false); }).catch(() => {});
  }

  // 6. Convertitore DWG → DXF (pagina a parte): più file insieme, esempio, file sbagliato, salvataggio del DXF, e il DXF
  //    salvato importato nel Banco CAD (R14: 16 linee, di cui 8 doppie). Da disco il lettore deve lavorare in un Worker.
  try {
    const cpage = await ctx.newPage();
    const cerr = []; cpage.on('pageerror', e => cerr.push(e.message));
    await cpage.goto('file://' + path.join(path.dirname(page_), 'convertitore-dwg', 'index.html'));
    const P = n => path.join(path.dirname(page_), 'convertitore-dwg', 'prove', n);
    await cpage.setInputFiles('#dwgFile', [P('v-r14.dwg'), P('esempio-2013.dwg')]);
    await cpage.waitForFunction(() => document.querySelectorAll('.item').length === 2 && !document.querySelector('.chip.run'), null, { timeout: 60000 });
    await cpage.click('#btnSample');
    await cpage.setInputFiles('#dwgFile', { name: 'pezzo.step', mimeType: 'application/step', buffer: Buffer.from('ISO-10303-21;\nHEADER;') });
    await cpage.waitForFunction(() => document.querySelectorAll('.item').length === 4 && !document.querySelector('.chip.run'), null, { timeout: 60000 });
    const rows = await cpage.evaluate(() => [...document.querySelectorAll('.item')].map(it => ({ name: it.querySelector('.name').textContent, chip: it.querySelector('.chip').textContent, text: it.textContent.replace(/\s+/g, ' ') })));
    const mode = await cpage.evaluate(() => Convertitore.Engine.mode());
    const by = n => rows.find(r => r.name === n) || { text: '' };
    const [dl] = await Promise.all([cpage.waitForEvent('download', { timeout: 15000 }), cpage.locator('.item', { hasText: 'v-r14.dwg' }).locator('button[data-save]').click()]);
    const dxfPath = path.join(OUT, 'v-r14.dxf'); await dl.saveAs(dxfPath);
    const dxf = require('fs').readFileSync(dxfPath);
    const okDxf = dl.suggestedFilename() === 'v-r14.dxf' && /\$ACADVER\s*\r?\n\s*1\s*\r?\nAC1014/.test(dxf.toString('latin1')) && /\n\s*0\s*\r?\nEOF/.test(dxf.toString('latin1'));
    // disegno grande (5200 entità lette): il Banco CAD non ha più il limite di 3000, quindi niente avviso
    const big = await cpage.evaluate(() => {
      const it = document.createElement('li'); it.className = 'item';
      Convertitore.render(it, { name: 'tavola.dwg', kind: { name: 'AutoCAD 2018' }, code: 0, ms: 300, dxf: new Uint8Array(1000),
        s: { ver: 'AC1032', units: 4, ents: { LINE: 4000, ARC: 1200, TEXT: 30 }, total: 5230, blocks: 0, ok: true } });
      return { text: it.textContent.replace(/\s+/g, ' '), warn: it.querySelectorAll('.msg.warn').length, chip: it.querySelector('.chip').textContent };
    });
    const okBig = big.chip === 'Pronto' && /4\.?000 linee, 1\.?200 archi/.test(big.text) && /30 testi/.test(big.text) && !big.warn && !/3000|3\.000|al massimo/.test(big.text);
    await cpage.close();
    // il DXF salvato, importato nel Banco CAD
    await fresh();
    await page.click('#btnFile'); await page.click('#menuFile [data-act="importDxf"]');
    await page.setInputFiles('#dxfFile', dxfPath);
    await page.waitForFunction(() => /tra linee, archi e cerchi/.test(document.querySelector('#dxfCap').textContent), null, { timeout: 5000 });
    await page.click('#modalActions .btn-primary');
    await page.waitForFunction(() => App.mode === 'sketch' && document.querySelector('#modal').hidden, null, { timeout: 10000 });
    // il DWG R14 di prova ha la stessa porta disegnata due volte (16 LINE con handle diversi, 8 posizioni): il Banco CAD
    // toglie le linee doppie e ne restano 8
    const imp = await page.evaluate(() => { const s = Sketcher.session(); return { n: s.sk.ents.filter(e => e.t === 'ln').length, toast: document.querySelector('#toast').textContent }; });
    await page.evaluate(() => Sketcher.exit(false));
    const ok = mode === 'worker' && rows.length === 4 && by('v-r14.dwg').chip === 'Pronto' && /R14 → DXF AC1014/.test(by('v-r14.dwg').text) && /16 linee/.test(by('v-r14.dwg').text) && /1 testo/.test(by('v-r14.dwg').text)
      && by('esempio-2013.dwg').chip === 'Pronto' && /AutoCAD 2013 → DXF AC1027/.test(by('esempio-2013.dwg').text) && /8 linee/.test(by('esempio-2013.dwg').text) && /2 spline/.test(by('esempio-2013.dwg').text) && /1 ellisse/.test(by('esempio-2013.dwg').text)
      && by('esempio-libredwg-r11.dwg').chip === 'Pronto' && by('pezzo.step').chip === 'Errore' && /file STEP/.test(by('pezzo.step').text) && okDxf && okBig && imp.n === 8 && /Tolte 8 entità doppie/.test(imp.toast) && !cerr.length;
    rec('Convertitore DWG → DXF: più file, esempio, file sbagliato, disegno grande senza avviso, DXF salvato e importato nel Banco CAD', ok,
      `lettore: ${mode}; ${rows.map(r => r.name + ' ' + r.chip).join(', ')}; disegno grande: «${big.text.slice(0, 120)}…»${big.warn ? ' CON AVVISO' : ' senza avvisi'}; file salvato ${dl.suggestedFilename()} (${dxf.length} byte, ${okDxf ? 'DXF R14 completo' : 'NON valido'}); nel Banco CAD ${imp.n} linee («${imp.toast}»)${cerr.length ? '; errori: ' + cerr.join(' | ') : ''}`);
  } catch (e) { rec('Convertitore DWG → DXF: più file, esempio, file sbagliato, disegno grande senza avviso, DXF salvato e importato nel Banco CAD', false, e.message.split('\n')[0]); }

  // 6b. Convertitore: anteprima di ogni disegno (con l'ingombro) e «Salva tutti i DXF» in un solo .zip; nel Banco CAD lo zip
  //     con due disegni fa comparire «Disegno nello zip»: si sceglie il secondo (un arco solo) e si importa quello
  try {
    const cpage = await ctx.newPage();
    const cerr = []; cpage.on('pageerror', e => cerr.push(e.message));
    await cpage.goto('file://' + path.join(path.dirname(page_), 'convertitore-dwg', 'index.html'));
    const P = n => path.join(path.dirname(page_), 'convertitore-dwg', 'prove', n);
    const tools0 = await cpage.evaluate(() => document.querySelector('#tools').hidden);
    await cpage.setInputFiles('#dwgFile', [P('v-r14.dwg'), P('arco-2018.dwg')]);
    await cpage.waitForFunction(() => document.querySelectorAll('.item').length === 2 && !document.querySelector('.chip.run'), null, { timeout: 60000 });
    const pv = await cpage.evaluate(() => [...document.querySelectorAll('.item')].map(it => { const p = it.querySelector('.pv svg path'), c = it.querySelector('.pv figcaption');
      const b = p ? p.getBBox() : null; return { name: it.querySelector('.name').textContent, d: p ? p.getAttribute('d').length : 0, cap: c ? c.textContent : '', w: b && b.width, h: b && b.height }; }));
    const tools1 = await cpage.evaluate(() => document.querySelector('#tools').hidden);
    await cpage.screenshot({ path: path.join(OUT, 'convertitore-anteprima.png'), fullPage: true });
    const [dl] = await Promise.all([cpage.waitForEvent('download', { timeout: 15000 }), cpage.click('#btnAll')]);
    const zipPath = path.join(OUT, 'disegni-dxf.zip'); await dl.saveAs(zipPath);
    await cpage.close();
    const r14 = pv.find(x => x.name === 'v-r14.dwg') || {}, arc = pv.find(x => x.name === 'arco-2018.dwg') || {};
    // nel Banco CAD
    await fresh();
    await page.click('#btnFile'); await page.click('#menuFile [data-act="importDxf"]');
    await page.setInputFiles('#dxfFile', zipPath);
    await page.waitForFunction(() => /tra linee, archi e cerchi/.test(document.querySelector('#dxfCap').textContent), null, { timeout: 10000 });
    const z0 = await page.evaluate(() => ({ row: !document.querySelector('#dxfZipRow').hidden, opts: [...document.querySelectorAll('#dxfZip option')].map(o => o.textContent), cap: document.querySelector('#dxfCap').textContent }));
    await page.selectOption('#dxfZip', 'arco-2018.dxf');
    await page.waitForFunction(c => document.querySelector('#dxfCap').textContent && document.querySelector('#dxfCap').textContent !== c, z0.cap, { timeout: 10000 });
    const cap2 = await page.evaluate(() => document.querySelector('#dxfCap').textContent);
    await page.click('#modalActions .btn-primary');
    await page.waitForFunction(() => App.mode === 'sketch' && document.querySelector('#modal').hidden, null, { timeout: 10000 });
    const imp = await page.evaluate(() => { const s = Sketcher.session(); return { ln: s.sk.ents.filter(e => e.t === 'ln').length, ar: s.sk.ents.filter(e => e.t === 'ar').length }; });
    await page.evaluate(() => Sketcher.exit(false));
    const ok = tools0 && !tools1 && r14.d > 100 && arc.d > 100 && /ingombro 37,41 × 83,12/.test(r14.cap) && /16,59 × 16,57 pollici/.test(arc.cap) && r14.w > 0 && r14.h > 0 && Math.abs(r14.h / r14.w - 83.125 / 37.406) < 0.01
      && dl.suggestedFilename() === 'disegni-dxf.zip' && z0.row && z0.opts.join('|') === 'v-r14.dxf|arco-2018.dxf' && /^1 tra linee/.test(cap2) && imp.ar === 1 && imp.ln === 0 && !cerr.length;
    rec('Convertitore: anteprima con l\'ingombro, «Salva tutti i DXF» in uno .zip; nel Banco CAD «Disegno nello zip» e importazione del disegno scelto', ok,
      `anteprime: ${pv.map(x => x.name + ' «' + x.cap + '»').join('; ')}; pulsante ${tools0 ? 'nascosto' : 'VISIBILE'} → ${tools1 ? 'NASCOSTO' : 'visibile'}; ${dl.suggestedFilename()}; nel Banco CAD: ${z0.row ? 'scelta ' + z0.opts.join(', ') : 'NESSUNA SCELTA'}, poi «${cap2}» → ${imp.ar} arco, ${imp.ln} linee${cerr.length ? '; errori: ' + cerr.join(' | ') : ''}`);
  } catch (e) {
    rec('Convertitore: anteprima con l\'ingombro, «Salva tutti i DXF» in uno .zip; nel Banco CAD «Disegno nello zip» e importazione del disegno scelto', false, e.message.split('\n')[0]);
    await page.evaluate(() => { if (!document.querySelector('#modal').hidden) document.querySelector('#modalActions .btn')?.click(); if (App.mode === 'sketch') Sketcher.exit(false); }).catch(() => {});
  }

  rec('Nessun errore JavaScript durante i test', !errors.length, errors.slice(0, 5).join(' | '));
  await page.screenshot({ path: path.join(OUT, 'ui-last.png') });
  // 6d. Spigoli nascosti che «escono» davanti a una faccia: due blocchi (STL) con quello davanti staccato di 0,5 mm, vista
  //     isometrica ingrandita fino a 0,06 mm per pixel. Dentro la sagoma del blocco davanti, lontano più di 3 px dai suoi
  //     9 spigoli visibili, non ci deve essere nessun pixel di spigolo (prima: lo spostamento fisso di 1,2 mm verso
  //     l'osservatore faceva vedere per un tratto gli spigoli appena dietro). I 9 spigoli visibili restano interi.
  try {
    await fresh();
    const boxes = [[0, 0, 0, 120, 40, 40], [40, 0, 40.5, 80, 40, 80.5]], f = [];
    for (const [x0, y0, z0, x1, y1, z1] of boxes) { const P = (i, j, k) => [[x0, x1][i], [y0, y1][j], [z0, z1][k]]; const q = (a, b, c, d) => f.push([a, b, c], [a, c, d]);
      q(P(0,0,0), P(0,1,0), P(1,1,0), P(1,0,0)); q(P(0,0,1), P(1,0,1), P(1,1,1), P(0,1,1)); q(P(0,0,0), P(1,0,0), P(1,0,1), P(0,0,1));
      q(P(0,1,0), P(0,1,1), P(1,1,1), P(1,1,0)); q(P(0,0,0), P(0,0,1), P(0,1,1), P(0,1,0)); q(P(1,0,0), P(1,1,0), P(1,1,1), P(1,0,1)); }
    const stl = 'solid t\n' + f.map(t => 'facet normal 0 0 0\nouter loop\n' + t.map(v => 'vertex ' + v.join(' ')).join('\n') + '\nendloop\nendfacet').join('\n') + '\nendsolid t\n';
    const res = await page.evaluate(({ stl, B, zooms }) => {
      App.importMeshData('blocchi.stl', new TextEncoder().encode(stl), { unit: 'mm', zUp: false });
      App.r.setView(GLView.Renderer.viewQ('iso')); App.r.fit(false);
      const mode0 = App.r.mode, out = [];
      for (const z of zooms) {
        App.r.cam.scale = z; App.r.cam.target = [(B[0] + B[3]) / 2, (B[1] + B[4]) / 2, (B[2] + B[5]) / 2];
        const gl = App.r.gl, W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(W * H * 4), p0 = new Uint8Array(W * H * 4);
        App.r.mode = 'shaded'; App.r.draw(); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, p0);
        App.r.mode = 'shadedEdges'; App.r.draw(); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const k = W / App.r.cssW, C = []; for (const i of [0, 3]) for (const j of [1, 4]) for (const l of [2, 5]) C.push([B[i], B[j], B[l]]);
        const S = C.map(c => App.r.project(c).map((v, ii) => ii < 2 ? v * k : v));
        let ni = 0; S.forEach((s, i) => { if (s[2] > S[ni][2]) ni = i; });
        const segs = S.map((s, i) => i).filter(i => i !== ni && [0, 1, 2].filter(t => C[i][t] !== C[ni][t]).length === 1).map(i => [S[ni], S[i]]);
        const pts = S.map(s => [s[0], s[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
        const lo = [], hi = []; for (const q of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
        for (const q of pts.slice().reverse()) { while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
        const hull = lo.slice(0, -1).concat(hi.slice(0, -1)); for (let i = 0; i < hull.length; i++) segs.push([hull[i], hull[(i + 1) % hull.length]]);
        const dseg = (q, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / (dx * dx + dy * dy))); return Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy); };
        const inside = q => hull.every((h, i) => cr(h, hull[(i + 1) % hull.length], q) >= 0);
        const edgeAt = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return false; const o = ((H - 1 - y) * W + x) * 4; return (0.3 * p0[o] + 0.59 * p0[o + 1] + 0.11 * p0[o + 2]) - (0.3 * px[o] + 0.59 * px[o + 1] + 0.11 * px[o + 2]) > 25; };
        let bad = 0, far = 0; const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
        for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(H - 1, Math.ceil(Math.max(...ys))); y++)
          for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(W - 1, Math.ceil(Math.max(...xs))); x++) {
            const q = [x + 0.5, y + 0.5]; if (!inside(q)) continue; const d = Math.min(...segs.map(s => dseg(q, s[0], s[1]))); if (d <= 3 * k) continue;
            if (edgeAt(x, y)) { bad++; far = Math.max(far, d / k); } }
        let tot = 0, hit = 0;
        for (const [a, c] of segs) { const L = Math.hypot(c[0] - a[0], c[1] - a[1]); for (let t = 4 * k; t < L - 4 * k; t += 2 * k) { const x = a[0] + (c[0] - a[0]) * t / L, y = a[1] + (c[1] - a[1]) * t / L; if (x < 2 || y < 2 || x > W - 3 || y > H - 3) continue; tot++;
          let ok = false; for (let dx = -1; dx <= 1 && !ok; dx++) for (let dy = -1; dy <= 1 && !ok; dy++) ok = edgeAt(Math.floor(x) + dx, Math.floor(y) + dy); if (ok) hit++; } }
        out.push({ mmPx: +App.r.pxSize().toFixed(3), bad, far: +far.toFixed(1), cover: +(100 * hit / Math.max(1, tot)).toFixed(1) });
      }
      App.r.mode = mode0; return out;
    }, { stl, B: boxes[1], zooms: [300, 80, 40] });
    rec('Vista 3D: gli spigoli nascosti non escono davanti alle facce (blocco staccato di 0,5 mm, ingrandimenti fino a 0,06 mm/px), spigoli visibili interi',
      res.every(r => r.bad === 0 && r.cover === 100), res.map(r => `${r.mmPx} mm/px: ${r.bad} pixel di spigolo nascosto${r.bad ? ' (fino a ' + r.far + ' px dentro)' : ''}, spigoli visibili ${r.cover} %`).join('; '));
  } catch (e) { rec('Vista 3D: gli spigoli nascosti non escono davanti alle facce', false, e.message.split('\n')[0]); }

  // 6c. Sito GitHub Pages: le pagine servite da rayuk-creator.github.io (qui simulato con page.route dai file del repository)
  //     si collegano tra loro sullo stesso sito; da disco restano i collegamenti a claude.ai
  try {
    const fs = require('fs'), ROOTD = path.dirname(page_), SITE = 'https://rayuk-creator.github.io/CAD/';
    const gctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    await gctx.route('https://rayuk-creator.github.io/**', r => {
      const u = new URL(r.request().url()).pathname.replace(/^\/CAD\//, '');
      const f = u === '' || u === 'index.html' ? page_ : u === 'convertitore-dwg/' || u === 'convertitore-dwg/index.html' ? path.join(ROOTD, 'convertitore-dwg', 'index.html') : null;
      return f ? r.fulfill({ status: 200, contentType: 'text/html', body: fs.readFileSync(f) }) : r.fulfill({ status: 404, body: '' });
    });
    await gctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const gp = await gctx.newPage(); const gerr = []; gp.on('pageerror', e => gerr.push(e.message));
    await gp.goto(SITE); await gp.waitForFunction(() => window.App && App.DWG_CONVERTER_URL, null, { timeout: 30000 });
    await gp.click('#btnFile'); await gp.click('#menuFile [data-act="importDxf"]');
    const g1 = await gp.evaluate(() => ({ url: App.DWG_CONVERTER_URL, href: (document.querySelector('#modalBody a.dwg-link') || {}).href }));
    // sul sito (http, non da disco) il DWG si legge nel Worker
    await gp.setInputFiles('#dxfFile', path.join(ROOTD, 'convertitore-dwg', 'prove', 'arco-2018.dwg'));
    await gp.waitForFunction(() => /AutoCAD 2018/.test(document.querySelector('#dxfCap').textContent), null, { timeout: 30000 });
    const gm = await gp.evaluate(() => App.dwgMode);
    const cp = await gctx.newPage(); cp.on('pageerror', e => gerr.push(e.message));
    await cp.goto(SITE + 'convertitore-dwg/');
    const g2 = await cp.evaluate(() => document.querySelector('#cadLink').href);
    await cp.goto(SITE + 'convertitore-dwg/index.html');
    const g3 = await cp.evaluate(() => document.querySelector('#cadLink').href);
    await gctx.close();
    const lp = await ctx.newPage();
    await lp.goto('file://' + path.join(ROOTD, 'convertitore-dwg', 'index.html'));
    const g4 = await lp.evaluate(() => document.querySelector('#cadLink').href); await lp.close();
    const g5 = await page.evaluate(() => App.DWG_CONVERTER_URL);
    rec('Sito GitHub Pages: Banco CAD e Convertitore si collegano tra loro sullo stesso sito; da disco restano i collegamenti a claude.ai',
      gm === 'worker' && g1.url === SITE + 'convertitore-dwg/' && g1.href === SITE + 'convertitore-dwg/' && g2 === SITE && g3 === SITE &&
      g4 === 'https://claude.ai/artifact/MB1heHPSzDXuv6brJimWUP' && g5 === 'https://claude.ai/artifact/8PeF7HpK8VZ1RFpsfAJYkY' && !gerr.length,
      `sito: Banco CAD → ${g1.href}; Convertitore → ${g2} (e da index.html → ${g3}); da disco: ${g4} e ${g5}${gerr.length ? '; errori: ' + gerr.join(' | ') : ''}`);
  } catch (e) { rec('Sito GitHub Pages: Banco CAD e Convertitore si collegano tra loro sullo stesso sito', false, e.message.split('\n')[0]); }

  // corpi solidi: «Unisci risultato» con il mouse, cartella nell'albero, Combina, Sposta/Copia, Elimina/Mantieni, massa, tavola, STEP
  try {
    await fresh();
    // lo schizzo si fa nel codice; i comandi sono veri clic. A = 40×40×10 (x 0..40), B = 20×20×30 (x 30..50): in comune 10×10×10
    await page.evaluate(() => {
      const box = (x0, y0, x1, y1) => { const s = Sketch.newSketch(); const pt = (x, y) => { const id = 'p' + (s.next++); s.ents.push({ id, t: 'pt', x, y }); return id; }; const P = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => pt(x, y)); P.forEach((a, i) => s.ents.push({ id: 'l' + (s.next++), t: 'ln', a, b: P[(i + 1) % 4] })); return s; };
      App.change(() => { const d = App.doc; const add = f => { f.id = Model.uid(d, 'F'); f.name = Model.defaultName(d, f.type); d.features.push(f); return f.id; };
        add({ type: 'extrude', sketch: add({ type: 'sketch', plane: { kind: 'std', id: 'top' }, sk: box(0, 0, 40, 40) }), end: 'blind', depth: 10 });
        window.__s2 = add({ type: 'sketch', plane: { kind: 'std', id: 'top' }, sk: box(30, 30, 50, 50) }); App.sel = []; });
    });
    await page.waitForTimeout(200);
    const tool = async id => { await page.click(`#cmdBar [data-cmd="${id}"]`); await page.waitForTimeout(200); };
    const ok = async () => { await page.click('.pm-ok'); await page.waitForFunction(() => !App.pm); await page.waitForTimeout(150); };
    const bodies = () => page.evaluate(() => ({ n: App.st.bodies.length, V: Model.massProperties(App.st, App.doc) ? Model.massProperties(App.st, App.doc).volume : 0, tree: [...document.querySelectorAll('#tree .tnode .tl')].map(x => x.textContent).filter(x => /^Corp/.test(x)), err: [...App.st.errors.values()] }));
    await page.evaluate(() => App.select({ kind: 'feature', id: window.__s2, sketch: true, label: 'Schizzo' }));
    await tool('extrude');
    await page.locator('#pm_depth').fill('30'); await page.locator('#pm_depth').press('Tab');
    const hadBox = await page.locator('#pmMerge').count();
    await page.locator('#pmMerge').uncheck();
    await ok();
    const b1 = await bodies();
    await page.click('#btnFile'); await page.waitForTimeout(50); await page.keyboard.press('Escape'); await page.click('#view', { position: { x: 5, y: 5 } }).catch(() => {});
    await page.evaluate(() => App.cmd('mass')); await page.waitForTimeout(150);
    const massRows = await page.locator('#massBodies tbody tr').count(); await page.evaluate(() => App.closeModal());
    await page.evaluate(() => App.setCmdTab('drawing')); await page.waitForTimeout(300);
    const svgLines = await page.evaluate(() => document.querySelectorAll('#sheetHolder svg line, #sheetHolder svg path').length);
    await page.evaluate(() => App.setCmdTab('features')); await page.waitForTimeout(150);
    const st2 = await page.evaluate(() => { const r = App.stepText(); return { solids: r.stats.solids, bad: r.stats.badEdges + r.stats.openLoops, faces: r.stats.faces }; });
    // Combina › Sottrai con la tendina e le caselle; Annulla; Combina › Comune con i clic nell'albero
    await tool('combine');
    await page.selectOption('#pm_op', 'sub'); await page.waitForTimeout(150);
    const ids = await page.evaluate(() => App.st.bodies.map(b => b.id));
    await page.selectOption('#pm_main', ids[0]); await page.waitForTimeout(150);
    await page.locator(`#pm [data-body="${ids[1]}"]`).check();
    await ok();
    const b2 = await bodies();
    await page.evaluate(() => App.undo()); await page.waitForTimeout(250);
    // i corpi scelti nell'albero prima del comando (clic e Ctrl + clic) arrivano già spuntati
    await page.locator('#tree .tnode', { hasText: 'Corpo1' }).click(); await page.waitForTimeout(100);
    await page.locator('#tree .tnode', { hasText: 'Corpo2' }).click({ modifiers: ['Control'] }); await page.waitForTimeout(100);
    await tool('combine');
    await page.selectOption('#pm_op', 'common'); await page.waitForTimeout(150);
    const pre = await page.evaluate(() => [...document.querySelectorAll('#pm [data-body]')].filter(i => i.checked).length);
    await ok();
    const b3 = await bodies();
    await page.evaluate(() => App.undo()); await page.waitForTimeout(250);
    // Sposta/Copia: una copia del corpo 1 spostata di 100 in X
    await page.evaluate(() => { App.r.setView(GLView.Renderer.viewQ('iso')); App.r.fit(false); }); await page.waitForTimeout(200);
    await tool('movebody');
    // scelta con un clic sulla faccia superiore del corpo 1, nella vista
    const [cx, cy] = await page.evaluate(() => { const p = App.r.project([8, 10, -8]); const c = document.querySelector('.view canvas').getBoundingClientRect(); return [c.left + p[0], c.top + p[1]]; });
    await page.mouse.move(cx, cy); await page.waitForTimeout(80); await page.mouse.click(cx, cy); await page.waitForTimeout(200);
    const pick3d = await page.locator(`#pm [data-body="${ids[0]}"]`).isChecked();
    await page.locator('#pm label.chk', { hasText: 'Copia il corpo' }).locator('input').check(); await page.waitForTimeout(150);
    await page.locator('#pm_dx').fill('100'); await page.locator('#pm_dx').press('Tab');
    await ok();
    const b4 = await bodies();
    // ogni titolo e voce dei tre pannelli ha la sua spiegazione nel Glossario
    const glossMiss = [];
    for (const t of ['combine', 'movebody', 'delbody']) {
      await tool(t);
      if (t === 'combine') { await page.selectOption('#pm_op', 'sub'); await page.waitForTimeout(150); }
      if (t === 'movebody') { await page.locator('#pm label.chk', { hasText: 'Copia il corpo' }).locator('input').check(); await page.waitForTimeout(150); }
      glossMiss.push(...await page.evaluate(() => [...document.querySelectorAll('#pm .grp > h3, #pm .row > label')].map(x => x.childNodes[0].textContent.trim()).filter(x => x && x !== 'Nome' && !Glossary.find(x))));
      await page.evaluate(() => App.closePM(false)); await page.waitForTimeout(150);
    }
    await page.evaluate(() => App.undo()); await page.waitForTimeout(250);
    // Elimina il corpo 2
    await tool('delbody');
    await page.locator(`#pm [data-body="${ids[1]}"]`).check();
    await ok();
    const b5 = await bodies();
    const okAll = hadBox === 1 && pre === 2 && pick3d && !glossMiss.length && b1.n === 2 && rel(b1.V, 28000) < 1e-6 && b1.tree.join() === 'Corpi solidi (2),Corpo1,Corpo2' && massRows === 2 && svgLines > 20 && st2.solids === 2 && !st2.bad && st2.faces === 12
      && b2.n === 1 && rel(b2.V, 15000) < 1e-6 && b3.n === 1 && rel(b3.V, 1000) < 1e-6 && b4.n === 3 && rel(b4.V, 44000) < 1e-6 && b5.n === 1 && rel(b5.V, 16000) < 1e-6 && ![b1, b2, b3, b4, b5].some(b => b.err.length);
    rec('Corpi solidi con il mouse: Unisci risultato, albero, massa per corpo, tavola, STEP, Combina (Sottrai, Comune), Copia, Elimina', okAll,
      `casella ${hadBox}; già spuntati ${pre}; clic nella vista ${pick3d}; glossario senza: ${glossMiss.join(', ') || 'nessuno'}; corpi ${b1.n} (V ${b1.V.toFixed(1)}), albero ${b1.tree.join(' | ')}; righe massa ${massRows}; tavola ${svgLines} linee; STEP ${st2.solids} solidi, ${st2.faces} facce; Sottrai V ${b2.V.toFixed(1)}; Comune V ${b3.V.toFixed(1)}; Copia ${b4.n} corpi V ${b4.V.toFixed(1)}; Elimina V ${b5.V.toFixed(1)}; errori ${[b1, b2, b3, b4, b5].flatMap(b => b.err).join(', ') || 'nessuno'}`);
    await fresh();
  } catch (e) { rec('Corpi solidi con il mouse: Unisci risultato, albero, massa per corpo, tavola, STEP, Combina (Sottrai, Comune), Copia, Elimina', false, e.message.split('\n')[0]); await page.evaluate(() => { if (App.closeModal) App.closeModal(); if (App.pm) App.closePM(false); }).catch(() => {}); }
  // licenza: finestra «Informazioni e licenze» dal menu, ogni testo collegato esiste nel repository
  try {
    await fresh();
    await page.click('#btnFile'); await page.click('#menuFile [data-act="about"]');
    const ab = await page.evaluate(() => ({ title: document.querySelector('#modalTitle').textContent, text: document.querySelector('#modalBody').textContent, links: [...document.querySelectorAll('#modalBody a')].map(a => a.href) }));
    const need = ['Copyright © 2026 Rayuk-creator', 'GNU GPL versione 3', 'senza alcuna garanzia', 'non raccoglie dati', 'occt-import-js', 'LGPL 2.1', 'LibreDWG', 'libredwg-web', 'csg.js', 'Evan Wallace', 'Adobe', 'IBM Plex', 'SIL OFL 1.1', 'Dassault', 'Autodesk'].filter(t => !ab.text.toLowerCase().includes(t.toLowerCase()));
    // sorgenti del lettore STEP/IGES: le copie ai commit esatti (LGPL 2.1, 6d), uguali in finestra, commento della pagina e LEGGIMI
    const srcs = ['https://github.com/Rayuk-creator/occt-import-js/tree/41e470890ae0f9dc69ac50ffd5fc73e03576f4eb', 'https://github.com/Rayuk-creator/OCCT/tree/d2abb6d844231cb8f29be6894440874a4700e4a5'];
    const srcFs = require('fs'), srcHtml = srcFs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'), srcBlock = srcHtml.slice(srcHtml.lastIndexOf('<!-- LETTORE STEP/IGES: inizio -->'), srcHtml.indexOf('<script id="occtJs"')), srcRead = srcFs.readFileSync(path.join(__dirname, '..', 'licenze', 'LEGGIMI.md'), 'utf8'), srcTool = srcFs.readFileSync(path.join(__dirname, '..', 'tools', 'incorpora-occt.js'), 'utf8');
    const srcMiss = srcs.filter(u => !ab.links.includes(u) || !srcBlock.includes(u) || !srcRead.includes(u) || !srcTool.includes(u));
    // sorgenti del lettore DWG: la copia al commit del tag v0.8.2, nei quattro posti
    const dwgSrc = 'https://github.com/Rayuk-creator/libredwg-web/tree/45a2a217f4916daddd7bd598c900d6c698d141b6', dwgMiss = !ab.links.includes(dwgSrc) || !srcHtml.includes('copia dei sorgenti: ' + dwgSrc) || !srcRead.includes(dwgSrc) || !srcFs.readFileSync(path.join(__dirname, '..', 'convertitore-dwg', 'LEGGIMI.md'), 'utf8').includes(dwgSrc) || !srcFs.readFileSync(path.join(__dirname, '..', 'convertitore-dwg', 'index.html'), 'utf8').includes(dwgSrc);
    if (dwgMiss) srcMiss.push(dwgSrc);
    const base = 'https://github.com/Rayuk-creator/CAD/blob/main/';
    const local = ab.links.filter(l => l.startsWith(base)).map(l => l.slice(base.length));
    const noFile = local.filter(l => !require('fs').existsSync(path.join(__dirname, '..', l)));
    await page.evaluate(() => App.closeModal());
    const gpl3 = /GNU GENERAL PUBLIC LICENSE\s+Version 3, 29 June 2007/.test(require('fs').readFileSync(path.join(__dirname, '..', 'LICENSE'), 'utf8'));
    rec('Informazioni e licenze: autore, GPL 3, parti di altri autori, marchi e privacy; tutti i testi collegati esistono', ab.title === 'Informazioni e licenze' && !need.length && local.length === 10 && !noFile.length && gpl3 && !srcMiss.length, `sorgenti del lettore mancanti: ${srcMiss.join(', ') || 'nessuno'}; mancano: ${need.join(', ') || 'nulla'}; ${local.length} testi, senza file: ${noFile.join(', ') || 'nessuno'}; LICENSE GPL 3: ${gpl3}`);
  } catch (e) { rec('Informazioni e licenze: autore, GPL 3, parti di altri autori, marchi e privacy; tutti i testi collegati esistono', false, e.message.split('\n')[0]); await page.evaluate(() => App.closeModal && App.closeModal()).catch(() => {}); }
  // Ambito funzione con il mouse: due blocchi, il taglio solo sul primo; poi scelta con un clic nella vista; salvataggio
  try {
    await fresh();
    await page.evaluate(() => {
      const box = (x0, y0, x1, y1) => { const s = Sketch.newSketch(); const pt = (x, y) => { const id = 'p' + (s.next++); s.ents.push({ id, t: 'pt', x, y }); return id; }; const P = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => pt(x, y)); P.forEach((a, i) => s.ents.push({ id: 'l' + (s.next++), t: 'ln', a, b: P[(i + 1) % 4] })); return s; };
      App.change(() => { const d = App.doc; const add = f => { f.id = Model.uid(d, 'F'); f.name = Model.defaultName(d, f.type); d.features.push(f); return f.id; };
        add({ type: 'extrude', sketch: add({ type: 'sketch', plane: { kind: 'std', id: 'top' }, sk: box(0, 0, 40, 40) }), end: 'blind', depth: 10 });
        add({ type: 'extrude', merge: false, sketch: add({ type: 'sketch', plane: { kind: 'std', id: 'top' }, sk: box(60, 0, 100, 40) }), end: 'blind', depth: 10 });
        window.__s3 = add({ type: 'sketch', plane: { kind: 'std', id: 'top' }, sk: box(20, 10, 80, 30) }); App.sel = []; });
      App.r.fit(App.st.body);
    });
    await page.waitForTimeout(250);
    const ok = async () => { await page.click('.pm-ok'); await page.waitForFunction(() => !App.pm); await page.waitForTimeout(150); };
    const vol = () => page.evaluate(() => Model.massProperties(App.st, App.doc).volume);
    const openCut = async () => { await page.evaluate(() => App.select({ kind: 'feature', id: window.__s3, sketch: true, label: 'Schizzo' })); await page.click('#cmdBar [data-cmd="cut"]'); await page.waitForTimeout(250); await page.evaluate(() => { const f = App.doc.features[App.doc.features.length - 1]; f.end = 'through'; f.both = true; App.pm.update(); }); await page.waitForTimeout(150); };
    await openCut();
    const seen = await page.locator('#pmScopeAll').isChecked();
    await page.locator('#pmScopeSel').check(); await page.waitForTimeout(200);
    const ids = await page.evaluate(() => App.st.bodies.map(b => b.id));
    await page.locator(`#pm [data-scope="${ids[0]}"]`).check(); await page.waitForTimeout(200);
    await ok();
    const v1 = await vol(), saved = await page.evaluate(() => JSON.parse(JSON.stringify(App.doc.features[App.doc.features.length - 1].scope)));
    await page.evaluate(() => App.undo()); await page.waitForTimeout(250);
    const v0 = await vol();
    await openCut();
    await page.locator('#pmScopeSel').check(); await page.waitForTimeout(200);
    const dot = await page.evaluate(() => { const r = document.querySelector('.view canvas').getBoundingClientRect(), p = App.r.project([90, 10, -20]); return { x: p[0] + r.left, y: p[1] + r.top }; });
    await page.mouse.move(dot.x, dot.y); await page.waitForTimeout(100); await page.mouse.click(dot.x, dot.y); await page.waitForTimeout(250);
    const picked = await page.evaluate(() => { const f = App.doc.features[App.doc.features.length - 1]; return f.scope; });
    const box2 = picked.length === 1 && picked[0] === ids[1];
    await ok();
    const v2 = await vol();
    rec('Ambito funzione con il mouse: Tutti i corpi di partenza, casella nel pannello (taglio solo sul primo corpo), Annulla, clic nella vista, salvato nella funzione', seen && Math.abs(v1 - (32000 - 20 * 20 * 10)) < 1 && saved.length === 1 && saved[0] === ids[0] && Math.abs(v0 - 32000) < 1 && box2 && Math.abs(v2 - (32000 - 20 * 20 * 10)) < 1, `V ${v1} (attesi 28000), dopo Annulla ${v0}, clic: ${JSON.stringify(picked)} (atteso ${ids[1]}), V ${v2}`);
  } catch (e) { rec('Ambito funzione con il mouse', false, e.message.split('\n')[0]); await page.evaluate(() => { try { App.closeModal(); if (App.pm) App.cancelPM && App.cancelPM(); } catch (x) {} }); }

  // Limiti dei corpi solidi con il mouse: Ambito su un'estrusione, Selezione automatica, albero sopra la vista, serie e specchio di corpi
  try {
    await fresh();
    await page.evaluate(() => {
      const box = (x0, y0, x1, y1) => { const s = Sketch.newSketch(); const pt = (x, y) => { const id = 'p' + (s.next++); s.ents.push({ id, t: 'pt', x, y }); return id; }; const P = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => pt(x, y)); P.forEach((a, i) => s.ents.push({ id: 'l' + (s.next++), t: 'ln', a, b: P[(i + 1) % 4] })); return s; };
      App.change(() => { const d = App.doc; const add = f => { f.id = Model.uid(d, 'F'); f.name = Model.defaultName(d, f.type); d.features.push(f); return f.id; };
        add({ type: 'extrude', sketch: add({ type: 'sketch', plane: { kind: 'std', id: 'top' }, sk: box(0, 0, 40, 40) }), end: 'blind', depth: 10 });
        add({ type: 'extrude', merge: false, sketch: add({ type: 'sketch', plane: { kind: 'std', id: 'top' }, sk: box(60, 0, 100, 40) }), end: 'blind', depth: 10 });
        window.__s4 = add({ type: 'sketch', plane: { kind: 'std', id: 'top' }, sk: box(40, 10, 60, 30) }); App.sel = []; });
      App.r.fit(App.st.body);
    });
    await page.waitForTimeout(250);
    const ok = async () => { await page.click('.pm-ok'); await page.waitForFunction(() => !App.pm); await page.waitForTimeout(200); };
    const openExt = async () => { await page.evaluate(() => App.select({ kind: 'feature', id: window.__s4, sketch: true, label: 'Schizzo' })); await page.click('#cmdBar [data-cmd="extrude"]'); await page.waitForTimeout(300); };
    const bodies = () => page.evaluate(() => { const st = App.st; return st.bodies.map(b => { let s = 0; for (const p of b.polys) for (let i = 2; i < p.v.length; i++) { const [a, u, c] = [p.v[0], p.v[i - 1], p.v[i]]; s += a[0] * (u[1] * c[2] - u[2] * c[1]) - a[1] * (u[0] * c[2] - u[2] * c[0]) + a[2] * (u[0] * c[1] - u[1] * c[0]); } return Math.round(s / 6 * 1000) / 1000; }); });
    const last = () => page.evaluate(() => JSON.parse(JSON.stringify(App.doc.features[App.doc.features.length - 1])));
    const undo = async () => { await page.evaluate(() => App.undo()); await page.waitForTimeout(250); };
    const ids = await page.evaluate(() => App.st.bodies.map(b => b.id));
    // estrusione con Corpi selezionati: scelta dall'albero sopra la vista
    await openExt();
    const allFirst = await page.locator('#pmScopeAll').isChecked();
    await page.locator('#pmScopeSel').check(); await page.waitForTimeout(250);
    const nFly = await page.locator('#partFly [data-fly-body]').count();
    await page.click(`#partFly [data-fly-body="${ids[0]}"]`); await page.waitForTimeout(250);
    const flyOn = await page.locator(`#partFly [data-fly-body="${ids[0]}"].on`).count();
    await page.screenshot({ path: path.join(OUT, 'corpi-ambito.png') });
    await ok();
    const b1 = await bodies(), f1 = await last(), flyGone = await page.locator('#partFly').count();
    const r1 = allFirst && nFly === 2 && flyOn === 1 && f1.scope.length === 1 && f1.scope[0] === ids[0] && b1.length === 2 && b1[0] === 20000 && b1[1] === 16000 && flyGone === 0;
    rec('Ambito di un\'estrusione con il mouse: albero sopra la vista, un corpo scelto per nome (20000 + 16000), albero tolto alla fine', r1, JSON.stringify({ allFirst, nFly, flyOn, scope: f1.scope, b1, flyGone }));
    await undo();
    // Selezione automatica: il ponte tocca i due corpi
    await openExt();
    await page.locator('#pmScopeSel').check(); await page.waitForTimeout(200);
    await page.locator('#pmScopeAuto').check(); await page.waitForTimeout(600);
    const au = await page.evaluate(() => ({ n: App.doc.features[App.doc.features.length - 1].scope.length, dis: [...document.querySelectorAll('#pm [data-scope]')].every(i => i.disabled && i.checked), fly: document.querySelectorAll('#partFly [data-fly-body]').length }));
    await ok();
    const b2 = await bodies(), f2 = await last();
    rec('Selezione automatica con il mouse: spunta i due corpi, caselle bloccate, un corpo da 36000, salvata', au.n === 2 && au.dis && au.fly === 0 && b2.length === 1 && b2[0] === 36000 && f2.scopeAuto === true && f2.scope.length === 2, JSON.stringify({ au, b2 }));
    await undo();
    // Unisci risultato tolta: niente ambito
    await openExt();
    const had = await page.locator('#pmScopeAll').count();
    await page.locator('#pmMerge').uncheck(); await page.waitForTimeout(250);
    const hid = await page.locator('#pmScopeAll').count();
    await page.click('.pm-no'); await page.waitForFunction(() => !App.pm); await page.waitForTimeout(150);
    rec('Unisci risultato tolta: Ambito funzione nascosto', had === 1 && hid === 0, had + ' ' + hid);
    // serie di un corpo: casella del pannello e clic nella vista
    await page.evaluate(() => App.select(null));
    await page.click('#cmdBar [data-cmd="lpattern"]'); await page.waitForTimeout(300);
    await page.locator('#pm .selbox', { hasText: 'su un corpo nella vista' }).click(); await page.waitForTimeout(200);
    const dot = await page.evaluate(() => { const r = document.querySelector('.view canvas').getBoundingClientRect(), p = App.r.project([90, 10, -20]); return { x: p[0] + r.left, y: p[1] + r.top }; });
    await page.mouse.move(dot.x, dot.y); await page.waitForTimeout(100); await page.mouse.click(dot.x, dot.y); await page.waitForTimeout(300);
    const chip = await page.locator('#pm .grp', { hasText: 'Corpi da ripetere' }).locator('.chip').count();
    const nameFly = await page.locator('#partFly [data-fly-feat]').count();
    await page.fill('#pm_n', '2'); await page.fill('#pm_spacing', '120'); await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, 'corpi-serie.png') });
    await ok();
    const b3 = await bodies(), bb = await page.evaluate(() => Model.massProperties(App.st, App.doc).bbox.mx[0]), f3 = await last();
    rec('Serie di un corpo con il mouse: clic nella vista, copia a x 180..220, tre corpi', chip === 1 && nameFly === 2 && b3.length === 3 && b3.every(v => v === 16000) && bb === 220 && f3.bodies.length === 1 && f3.bodies[0] === ids[1], JSON.stringify({ chip, nameFly, b3, bb }));
    await undo();
    // funzione scelta per nome nell'albero sopra la vista: la serie del secondo blocco, stessa cosa con la funzione e Unisci risultato tolta
    await page.click('#cmdBar [data-cmd="lpattern"]'); await page.waitForTimeout(300);
    const featId = await page.evaluate(() => App.doc.features.filter(f => f.type === 'extrude')[1].id);
    await page.click(`#partFly [data-fly-feat="${featId}"]`); await page.waitForTimeout(250);
    const featChip = await page.locator('#pm .grp', { hasText: 'Funzioni da ripetere' }).locator('.chip').count();
    await page.click('.pm-no'); await page.waitForFunction(() => !App.pm); await page.waitForTimeout(150);
    // specchio: corpo scelto prima nell'albero, Unisci i solidi; il piano si sceglie per nome
    await page.evaluate(id => App.select({ kind: 'body', id, label: 'Corpo1' }), ids[0]); await page.waitForTimeout(100);
    await page.click('#cmdBar [data-cmd="mirror"]'); await page.waitForTimeout(300);
    const chipM = await page.locator('#pm .grp', { hasText: 'Corpi da specchiare' }).locator('.chip').count();
    const pick = await page.evaluate(() => App.pm.getPick());
    await page.locator('#pm label.chk', { hasText: 'Unisci i solidi' }).locator('input').check(); await page.waitForTimeout(300);
    await ok();
    const b4 = await bodies(), f4 = await last();
    rec('Specchio di un corpo con il mouse: scelto prima dell\'apertura, Unisci i solidi: 32000 + 16000; funzione scelta per nome nell\'albero', featChip === 1 && chipM === 1 && pick === 'mirrorPlane' && f4.mergeBodies === true && b4.length === 2 && b4[0] === 32000 && b4[1] === 16000, JSON.stringify({ featChip, chipM, pick, b4 }));
    await undo();
    // l'albero si chiude e i piani si scelgono per nome
    await page.evaluate(() => App.select(null));
    await page.click('#cmdBar [data-cmd="mirror"]'); await page.waitForTimeout(300);
    await page.evaluate(() => App.pm.setPick('mirrorPlane')); await page.waitForTimeout(200);
    await page.click('#partFly [data-fly-plane="front"]'); await page.waitForTimeout(200);
    const pl = await page.evaluate(() => App.doc.features[App.doc.features.length - 1].plane.id);
    await page.click('#partFlyToggle'); await page.waitForTimeout(150);
    const closed = await page.locator('#partFly [data-fly-feat]').count();
    await page.click('#partFlyToggle'); await page.waitForTimeout(150);
    const reopened = await page.locator('#partFly [data-fly-feat]').count();
    await page.click('.pm-no'); await page.waitForFunction(() => !App.pm); await page.waitForTimeout(150);
    rec('Albero sopra la vista: piano scelto per nome, si chiude e si riapre', pl === 'front' && closed === 0 && reopened > 0, JSON.stringify({ pl, closed, reopened }));
  } catch (e) { rec('Limiti dei corpi solidi con il mouse', false, e.message.split('\n')[0]); await page.evaluate(() => { try { App.closeModal(); if (App.pm) App.closePM(false); } catch (x) {} }); }
  // sfondo: tratteggio, tolleranza, richiamo e tabella dal disegno vero, finestra e schizzo
  try {
    await fresh();
    const rif = require('fs').readFileSync(path.join(__dirname, '..', 'convertitore-dwg', 'prove', 'riferimento', 'esempio-2013.dxf'));
    await page.click('#btnFile'); await page.click('#menuFile [data-act="importDxf"]');
    await page.setInputFiles('#dxfFile', { name: 'esempio-2013.dxf', mimeType: 'application/dxf', buffer: rif });
    await page.waitForSelector('#dxfPrev svg');
    const pv = await page.evaluate(() => ({ hatch: document.querySelectorAll('#dxfPrev .dxf-hatch').length, cap: document.querySelector('#dxfCap').textContent }));
    await page.click('#modalActions .btn-primary');
    await page.waitForFunction(() => App.mode === 'sketch' && document.querySelector('#modal').hidden, null, { timeout: 20000 });
    await page.waitForTimeout(400);
    const st = await page.evaluate(() => { const s = Sketcher.session(); return { hl: s.sk.bg.filter(n => n.hl).length, segs: s.bgHatch && s.bgHatch.segs, dense: s.bgHatch && s.bgHatch.dense, keep: s.sk.bg.find(n => n.hl).pat.length }; });
    rec('Sfondo: tratteggio, tolleranza, richiamo e tabella del disegno vero nella finestra e nello schizzo (righe calcolate una sola volta, nel progetto il motivo)', pv.hatch === 1 && /1 tratteggio/.test(pv.cap) && /1 tolleranza geometrica/.test(pv.cap) && /1 tabella/.test(pv.cap) && st.hl === 1 && st.segs > 1200 && st.dense === 0 && st.keep === 2, `anteprima ${pv.hatch}, «${pv.cap.slice(-90)}», schizzo ${JSON.stringify(st)}`);
    await page.keyboard.press('Escape');
  } catch (e) { rec('Sfondo: tratteggio, tolleranza, richiamo e tabella del disegno vero', false, e.message.split('\n')[0]); await page.evaluate(() => { try { App.closeModal(); } catch (x) {} }); }
  // sfondo del disegno: testi e quote di un DXF sotto lo schizzo, dalla finestra all'estrusione
  try {
    await fresh();
    const L = (a, b, c, d) => ['0', 'LINE', '8', 'PEZZO', '10', a, '20', b, '11', c, '21', d];
    const blocks = ['0', 'SECTION', '2', 'BLOCKS', '0', 'BLOCK', '2', '*D1', '10', 0, '20', 0, ...L(0, -12, 100, -12), '0', 'MTEXT', '8', '0', '10', 50, '20', -11, '40', 3.5, '71', 8, '1', '100', '0', 'ENDBLK', '0', 'ENDSEC'];
    const file = ['0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', 4, '0', 'ENDSEC', ...blocks, '0', 'SECTION', '2', 'ENTITIES', ...L(0, 0, 100, 0), ...L(100, 0, 100, 60), ...L(100, 60, 0, 60), ...L(0, 60, 0, 0),
      '0', 'TEXT', '8', 'QUOTE', '10', 40, '20', 20, '40', 20, '1', 'H', '0', 'DIMENSION', '8', 'QUOTE', '2', '*D1', '0', 'ENDSEC', '0', 'EOF'].map(String).join('\r\n');
    await page.click('#btnFile'); await page.click('#menuFile [data-act="importDxf"]');
    await page.setInputFiles('#dxfFile', { name: 'sfondo.dxf', mimeType: 'application/dxf', buffer: Buffer.from(file) });
    await page.waitForSelector('#dxfPrev svg');
    const prevOf = () => page.evaluate(() => ({ t: document.querySelectorAll('#dxfPrev .dxf-notes text').length, cap: document.querySelector('#dxfCap').textContent }));
    const pv1 = await prevOf();
    await page.uncheck('#dxfNotes'); await page.waitForTimeout(80);
    const pv0 = await prevOf();
    await page.check('#dxfNotes'); await page.waitForTimeout(80);
    await page.click('#modalActions .btn-primary');
    await page.waitForFunction(() => App.mode === 'sketch' && document.querySelector('#modal').hidden, null, { timeout: 10000 });
    await page.waitForTimeout(300);
    const st1 = await page.evaluate(() => { const s = Sketcher.session(); return { bg: s.sk.bg.length, ents: s.sk.ents.filter(e => e.t !== 'pt').length, ids: s.sk.ents.map(e => e.id).join(), dof: Sketch.analyze(s.sk).dof, toast: document.querySelector('#toast').textContent, sel: s.sel.size }; });
    // pixel dello sfondo: si leggono sul foglio trasparente sopra la vista, nella zona della H (da 15 mm a sinistra a 35 mm a destra di x = 40... dentro la piastra)
    const hBox = () => page.evaluate(() => {
      const s = Sketcher.session(), P = (u, v) => App.r.project(Geom.to3(s.F, [u, v])), cv = document.querySelector('#ov'), k = cv.width / cv.clientWidth;
      const a = P(30, 15), b = P(70, 45), x0 = Math.round(Math.min(a[0], b[0])), x1 = Math.round(Math.max(a[0], b[0])), y0 = Math.round(Math.min(a[1], b[1])), y1 = Math.round(Math.max(a[1], b[1]));
      const d = cv.getContext('2d').getImageData(x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k), W = d.width, H = d.height;
      let n = 0, mnx = 1e9, mxx = -1, mny = 1e9, mxy = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d.data[4 * (y * W + x) + 3] > 128) { n++; mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mny = Math.min(mny, y); mxy = Math.max(mxy, y); }
      return { n, h: (mxy - mny + 1) / k, left: mnx / k + x0, bottom: (mxy + 1) / k + y0, px: Math.hypot(P(1, 0)[0] - P(0, 0)[0], P(1, 0)[1] - P(0, 0)[1]), ax: P(40, 20)[0], ay: P(40, 20)[1], cx: P(47, 30)[0], cy: P(47, 30)[1] };
    });
    await page.evaluate(() => App.renderNow && App.renderNow()); await page.waitForTimeout(150);
    const on = await hBox();
    const expH = 20 * on.px;   // altezza delle maiuscole nel file: 20 mm
    // un clic sul testo non seleziona niente
    await page.mouse.click(on.cx, on.cy); await page.waitForTimeout(120);
    const hit = await page.evaluate(() => { const s = Sketcher.session(); return { sel: s.sel.size, hover: !!s.hover }; });
    // casella «Mostra lo sfondo»
    const show = page.locator('#skBg label.chk input');
    await show.uncheck(); await page.waitForTimeout(150);
    const off = await hBox();
    // nel PDF non c'è: lo stesso PDF con lo sfondo acceso e spento
    const pdfLen = async () => { await page.evaluate(() => { App.lastPdf = null; App.savePdf(); }); await page.waitForFunction(() => App.lastPdf && !App.pdfBusy, null, { timeout: 30000 }); return page.evaluate(() => App.lastPdf.bytes.length); };
    const pdfOff = await pdfLen();
    await page.locator('#skBg label.chk input').check(); await page.waitForTimeout(150);
    const pdfOn = await pdfLen();
    const on2 = await hBox();
    // Togli lo sfondo, Annulla, Ripeti
    await page.click('#skBg .btn'); await page.waitForTimeout(100);
    const gone = await page.evaluate(() => ({ bg: Sketcher.session().sk.bg, box: !!document.querySelector('#skBg') }));
    await page.evaluate(() => Sketcher.undo()); await page.waitForTimeout(100);
    const back = await page.evaluate(() => ({ bg: (Sketcher.session().sk.bg || []).length, box: !!document.querySelector('#skBg') }));
    // lo schizzo si chiude: nella vista del pezzo lo sfondo non c'è; l'estrusione è quella della sola piastra
    await tool('exitSketch'); await page.waitForTimeout(200);
    await page.evaluate(() => App.setCmdTab('features'));
    await tool('extrude');
    const dep = page.locator('.pm-body .row', { hasText: 'Profondità' }).first().locator('input');
    await dep.fill('10'); await dep.press('Tab');
    await page.click('.pm-ok'); await page.waitForTimeout(300);
    const pz = await props();
    // resta nel progetto salvato: si ricarica la pagina
    await page.waitForTimeout(700);
    await page.reload(); await page.waitForFunction(() => window.App && App.doc && App.st, null, { timeout: 20000 }); await page.waitForTimeout(500);
    const saved = await page.evaluate(() => { const f = App.doc.features.find(x => x.type === 'sketch'); return f && f.sk.bg ? f.sk.bg.length : -1; });
    const pv = pv1.t === 2 && /sullo sfondo: 1 testo, 1 quota/.test(pv1.cap) && pv0.t === 0 && !/sullo sfondo/.test(pv0.cap);
    const st = st1.ents === 4 && st1.bg === 3 && st1.sel === 4 && /Sullo sfondo: 1 testo, 1 quota/.test(st1.toast) && !/Non importati/.test(st1.toast);
    const px = on.n > 50 && Math.abs(on.h - expH) <= 0.03 * expH && Math.abs(on.left - on.ax) <= 0.15 * expH && Math.abs(on.bottom - on.ay) <= 0.03 * expH;
    const ok = pv && st && px && !hit.sel && !hit.hover && off.n === 0 && on2.n === on.n && pdfOn === pdfOff && pdfOn > 0 && gone.bg === undefined && !gone.box && back.bg === 3 && back.box && pz && !pz.err.length && Math.abs(pz.V - 60000) < 60 && saved === 3;
    rec('Sfondo del disegno: anteprima, messaggio, altezza e posizione del testo, nessun clic, casella, PDF, Togli/Annulla, estrusione, salvataggio', ok,
      `anteprima ${pv1.t}/${pv0.t}; entità ${st1.ents}, sfondo ${st1.bg}; H alta ${on.h.toFixed(1)} px (attesi ${expH.toFixed(1)}), sinistra ${(on.left - on.ax).toFixed(1)} e base ${(on.bottom - on.ay).toFixed(1)} px dal punto, ${on.n} pixel; clic: sel ${hit.sel}; spento ${off.n} pixel, riacceso ${on2.n}; PDF ${pdfOff}/${pdfOn} byte; tolto ${JSON.stringify(gone)}, annullato ${back.bg}; V ${pz && pz.V.toFixed(1)}; salvati ${saved}; «${st1.toast}»`);
  } catch (e) { rec('Sfondo del disegno: anteprima, messaggio, altezza e posizione del testo, nessun clic, casella, PDF, Togli/Annulla, estrusione, salvataggio', false, e.message.split('\n')[0]); await page.evaluate(() => { App.closeModal(); if (App.mode === 'sketch') Sketcher.exit(false); }).catch(() => {}); }
  // privacy: le due pagine non chiedono nulla ad altri siti e usano davvero IBM Plex da dentro la pagina
  try {
    const nctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    const reqs = []; nctx.on('request', r => { if (/^https?:/.test(r.url())) reqs.push(r.url()); });
    const res = [];
    for (const f of [page_, path.join(__dirname, '..', 'convertitore-dwg', 'index.html')]) {
      const np = await nctx.newPage(); await np.goto('file://' + f); await np.waitForTimeout(800);
      res.push(await np.evaluate(async () => { await document.fonts.ready; await Promise.all(['400 14px "IBM Plex Sans"', '600 14px "IBM Plex Sans"', '500 14px "IBM Plex Sans Condensed"', '400 14px "IBM Plex Mono"'].map(x => document.fonts.load(x, 'Aø'))); return { loaded: [...document.fonts].filter(x => x.status === 'loaded').map(x => x.family.replace(/"/g, '') + ' ' + x.weight).sort(), google: !!document.querySelector('link[href*="fonts.g"]') }; }));
      await np.close();
    }
    await nctx.close();
    const ok = res.every(r => !r.google && ['IBM Plex Sans 400', 'IBM Plex Sans 600', 'IBM Plex Sans Condensed 500', 'IBM Plex Mono 400'].every(n => r.loaded.includes(n)));
    rec('Privacy: nessuna richiesta ad altri siti; caratteri IBM Plex dentro le due pagine', !reqs.length && ok, `richieste: ${reqs.join(', ') || 'nessuna'}; caratteri caricati: ${res.map(r => r.loaded.length).join(' e ')}`);
  } catch (e) { rec('Privacy: nessuna richiesta ad altri siti; caratteri IBM Plex dentro le due pagine', false, e.message.split('\n')[0]); }

  /* ---------- assiemi: tutto con il mouse, valori calcolati a mano ---------- */
  const asmSetup = async (vp) => {
    const c = await browser.newContext({ viewport: vp || { width: 1300, height: 800 } });
    const p = await c.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + page_);
    await p.waitForFunction(() => window.App && App.r, null, { timeout: 15000 });
    await p.evaluate(() => {
      const mk = (name, fill, depth) => { const d = Model.newDoc(); d.name = name; const s = Sketch.newSketch(); const pt = (x, y) => { const id = 'p' + s.next++; s.ents.push({ id, t: 'pt', x, y }); return id; }; fill(s, pt); const sid = Model.uid(d, 'F'); d.features.push({ id: sid, type: 'sketch', name: 'Schizzo1', plane: { kind: 'std', id: 'top' }, sk: s }); d.features.push({ id: Model.uid(d, 'F'), name: 'Estrusione1', type: 'extrude', sketch: sid, end: 'blind', depth }); return d; };
      const circ = (s, pt, x, y, r) => { const c = pt(x, y); s.ents.push({ id: 'c' + s.next++, t: 'ci', c, r }); };
      const rect = (s, pt) => { const P = [[0, 0], [80, 0], [80, 50], [0, 50]].map(([x, y]) => pt(x, y)); for (let i = 0; i < 4; i++) s.ents.push({ id: 'l' + s.next++, t: 'ln', a: P[i], b: P[(i + 1) % 4] }); };
      const a = mk('Piastra', (s, pt) => { rect(s, pt); circ(s, pt, 40, 25, 10); }, 10);
      const b = mk('Perno', (s, pt) => circ(s, pt, 0, 0, 10), 30);
      App.setProject({ doc: a, drawing: null, project: { active: 'p1', next: 3, assembly: null, parts: [{ id: 'p1' }, { id: 'p2', doc: b, drawing: null }] } });
      App.regen(); App.asm.refreshPartSel(); App.r.setView(GLView.Renderer.viewQ('iso'));
      window.__asm = {
        state: () => { const a = App.project.assembly; return { insts: a.insts.map(i => ({ id: i.id, p: i.pose.p, q: i.pose.q, fixed: i.fixed })), mates: a.mates.map(m => ({ id: m.id, name: m.name, type: m.type, s: m.s, side: m.side, value: m.value, sup: !!m.suppressed })), dof: App.asm.last.dof.total, ok: App.asm.last.ok, tree: [...document.querySelectorAll('#tree .tnode .tl')].map(x => x.textContent) }; },
        box: id => { const b = App.st.bodies.find(x => x.id === id); const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (const p of b.polys) for (const v of p.v) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], v[k]); mx[k] = Math.max(mx[k], v[k]); } return [...mn, ...mx]; },
        px: p => { const q = App.r.project(p), b = document.querySelector('#view').getBoundingClientRect(); return [q[0] + b.left, q[1] + b.top]; },
      };
    });
    const clickW = async wp => { await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); const v = await p.evaluate(w => __asm.px(w), wp); await p.mouse.move(v[0], v[1]); await p.waitForTimeout(60); await p.mouse.click(v[0], v[1]); await p.waitForTimeout(120); };
    const insert = async id => { await p.click('[data-cmd="insertPart"]'); await p.click(`#asmParts [data-part="${id}"]`); await p.waitForTimeout(150); await p.evaluate(() => { App.r.setView(GLView.Renderer.viewQ('iso')); App.r.fit(false); }); await p.waitForTimeout(700); };
    const st = () => p.evaluate(() => __asm.state());
    return { c, p, errs, clickW, insert, st };
  };
  const near = (a, b, tol = 1e-6) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) <= tol);
  const fmtv = a => a.map(x => +x.toFixed(6)).join(', ');
  const ASMNAME = 'Assieme: inserisci, concentrico e distanza con il mouse; albero, gradi di libertà, Annulla e Ripeti';
  try {
    const { c, p, errs, clickW, insert, st } = await asmSetup();
    await p.click('[data-ct="assembly"]'); await p.waitForTimeout(200);
    const empty = await p.evaluate(() => ({ note: /vuoto/.test(document.querySelector('#tree').textContent), mode: App.mode, modal: !document.querySelector('#modal').hidden }));
    await insert('p1'); await insert('p2');
    const s0 = await st(), pin = s0.insts[1], x0 = pin.p[0];
    // prima parte fissa nell'origine; la seconda accanto all'ingombro: 80 + 0,25 × 20 + 10 (il suo minimo in x è -10)
    const place = s0.insts[0].fixed && !pin.fixed && near(s0.insts[0].p, [0, 0, 0]) && near(pin.p, [95, 0, 0]);
    const tree0 = s0.tree.join('|');
    await p.click('[data-cmd="mate"]'); await p.waitForTimeout(100);
    await clickW([x0 + 7.0711, 15, 7.0711]);       // faccia cilindrica del perno, lato verso la vista
    await clickW([40 - 7.0711, 5, -25 - 7.0711]);  // parete del foro, lato visibile dall'alto
    const panel = await p.evaluate(() => ({ text: document.querySelector('#pm').innerText, pressed: document.querySelector('[data-mate="concentric"]').getAttribute('aria-pressed'), dis: ['coincident', 'concentric', 'parallel', 'perpendicular', 'distance', 'angle'].map(t => document.querySelector(`[data-mate="${t}"]`).disabled) }));
    await p.click('.pm-ok'); await p.waitForTimeout(150);
    const s1 = await st(), b1 = await p.evaluate(id => __asm.box(id), pin.id);
    const cx = (b1[0] + b1[3]) / 2, cz = (b1[2] + b1[5]) / 2;
    const conc = near([cx, cz, b1[1], b1[4], s1.dof], [40, -25, 0, 30, 2]) && /Perno<1>/.test(s1.tree.join('|'));
    // distanza 30 tra la faccia superiore della piastra e la cima del perno: la base va a y = 10
    await p.click('[data-cmd="mate"]'); await p.waitForTimeout(100);
    await clickW([70, 10, -5]);
    await clickW([40, 30, -25]);
    await p.click('[data-mate="distance"]'); await p.waitForTimeout(100);
    await p.fill('#asmValue', '30'); await p.press('#asmValue', 'Tab'); await p.waitForTimeout(150);
    const msg = await p.evaluate(() => document.querySelector('#asmMsg').textContent);
    await p.click('.pm-ok'); await p.waitForTimeout(150);
    const s2 = await st(), b2 = await p.evaluate(id => __asm.box(id), pin.id);
    const dist = near([b2[1], b2[4], (b2[0] + b2[3]) / 2, (b2[2] + b2[5]) / 2, s2.dof], [10, 40, 40, -25, 1]) && s2.mates[1].type === 'distance' && s2.mates[1].value === 30;
    // Annulla: torna alla base a y = 0 e un accoppiamento solo; Ripeti lo rimette
    await p.click('#btnUndo'); await p.waitForTimeout(150);
    const su = await st(), bu = await p.evaluate(id => __asm.box(id), pin.id);
    await p.click('#btnRedo'); await p.waitForTimeout(150);
    const sr = await st(), br = await p.evaluate(id => __asm.box(id), pin.id);
    const undo = su.mates.length === 1 && near([bu[1], bu[4]], [0, 30]) && sr.mates.length === 2 && near([br[1], br[4]], [10, 40]);
    // misura nell'assieme: la distanza tra le due facce parallele è letta dalla vista
    await p.click('[data-cmd="measure"]'); await p.waitForTimeout(100);
    await clickW([70, 10, -5]); await clickW([40, 40, -25]);
    const meas = await p.evaluate(() => document.querySelector('#pm').innerText); await p.keyboard.press('Escape'); await p.waitForTimeout(80);
    await p.screenshot({ path: path.join(OUT, 'assieme-perno.png') });
    await c.close();
    const ok = !empty.modal && empty.note && empty.mode === 'assembly' && place && /\(f\) Piastra<1>/.test(tree0) && /\(-\) Perno<1>/.test(tree0) && panel.pressed === 'true' && near(panel.dis.map(Number), [0, 0, 0, 0, 0, 0]) && conc && /Gradi di libertà rimasti: 1/.test(msg) && dist && undo && /30,00/.test(meas) && !errs.length;
    rec(ASMNAME, ok, `posizione ${fmtv(pin.p)}; concentrico ${fmtv([cx, cz, b1[1], b1[4], s1.dof])}; distanza ${fmtv([b2[1], b2[4], s2.dof])}; annulla ${fmtv([bu[1], bu[4]])}; misura: ${meas.replace(/\s+/g, ' ').slice(0, 90)}; errori ${errs.join(' / ')}`);
  } catch (e) { rec(ASMNAME, false, e.message.split('\n')[0]); }

  const ASM2 = 'Assieme: trascinare con il mouse: il perno segue il puntatore lungo l\'asse; parte fissa ferma (gira la vista); Annulla; Ruota';
  try {
    const { c, p, errs, insert, st } = await asmSetup();
    await p.click('[data-ct="assembly"]'); await p.waitForTimeout(150);
    await insert('p1'); await insert('p2');
    // concentrico scritto direttamente: qui si prova il trascinamento
    await p.evaluate(() => { App.change(() => { const a = App.project.assembly; a.mates.push({ id: 'M90', name: 'Concentrico1', type: 'concentric', a: { inst: a.insts[0].id, k: 'face', name: App.asm.infos.get('p1').st.tags.list.find(t => t.kind === 'rev').name }, b: { inst: a.insts[1].id, k: 'face', name: App.asm.infos.get('p2').st.tags.list.find(t => t.kind === 'rev').name }, s: 1, side: 1, value: 0 }); }); App.r.setView(GLView.Renderer.viewQ('iso')); App.r.fit(false); });
    await p.waitForTimeout(700);
    const q = await p.evaluate(() => { const b = App.r.basis(); return { px: App.r.pxSize(), up: b.up, cam: App.r.cam.q.slice() }; });
    const s0 = await st(), pinId = s0.insts[1].id;
    const w = await p.evaluate(() => __asm.px([40 + 7.0711, 20, -25 + 7.0711]));
    await p.mouse.move(w[0], w[1]); await p.mouse.down(); await p.mouse.move(w[0], w[1] - 20, { steps: 4 }); await p.mouse.move(w[0], w[1] - 40, { steps: 4 }); await p.waitForTimeout(60); await p.mouse.up(); await p.waitForTimeout(120);
    const s1 = await st(), b1 = await p.evaluate(id => __asm.box(id), pinId);
    // 40 pixel in su: il punto preso sale di 40·px lungo la vista; sull'asse Y vale 40·px / up[1]
    const expY = 40 * q.px / q.up[1];
    const slide = near([b1[1], (b1[0] + b1[3]) / 2, (b1[2] + b1[5]) / 2], [expY, 40, -25], 1e-5) && near(s1.insts[0].p, [0, 0, 0]);
    await p.click('#btnUndo'); await p.waitForTimeout(120);
    const bu = await p.evaluate(id => __asm.box(id), pinId);
    // parte fissa: stesso gesto sulla piastra, gira la vista e la piastra non si muove
    const wf = await p.evaluate(() => __asm.px([75, 10, -5]));
    await p.mouse.move(wf[0], wf[1]); await p.mouse.down(); await p.mouse.move(wf[0] + 40, wf[1], { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(120);
    const af = await p.evaluate(() => ({ cam: App.r.cam.q.slice(), p: App.project.assembly.insts[0].p, pose: App.project.assembly.insts[0].pose.p }));
    const fixedOk = !near(af.cam, q.cam, 1e-3) && near(af.pose, [0, 0, 0]);
    // Sposta parte › Ruota: 50 pixel in orizzontale = 0,5 rad attorno all'asse, che è l'unica rotazione rimasta; asse fermo
    await p.evaluate(() => { App.r.setView(GLView.Renderer.viewQ('top')); App.r.fit(false); }); await p.waitForTimeout(700);
    await p.click('[data-cmd="movepart"]'); await p.waitForTimeout(80);
    await p.click('#asmMoveR'); await p.waitForTimeout(60);
    await p.waitForTimeout(100);
    const q0 = (await st()).insts[1].q;
    // cima del perno, 8 mm dall'asse verso +Z: il puntatore si sposta di traverso e il punto va il più vicino possibile sul cerchio
    const pv = await p.evaluate(() => ({ b: App.r.basis(), px: App.r.pxSize() }));
    const wr = await p.evaluate(() => __asm.px([40, 30, -25 + 8]));
    await p.mouse.move(wr[0], wr[1]); await p.mouse.down(); await p.mouse.move(wr[0] + 25, wr[1], { steps: 3 }); await p.mouse.move(wr[0] + 54, wr[1], { steps: 3 }); await p.waitForTimeout(60); await p.mouse.up(); await p.waitForTimeout(120);
    const q1 = (await st()).insts[1].q;
    await p.keyboard.press('Escape');
    const dq = Math.abs(q0[0] * q1[0] + q0[1] * q1[1] + q0[2] * q1[2] + q0[3] * q1[3]), ang = 2 * Math.acos(Math.min(1, dq));
    // il punto più vicino sul cerchio di raggio 8 è nella direzione del puntatore: angolo = atan(spostamento / 8)
    const expAng = Math.atan2(54 * pv.px, 8);
    const b3 = await p.evaluate(id => __asm.box(id), pinId);
    const rot = Math.abs(ang - expAng) < 1e-4 && near([(b3[0] + b3[3]) / 2, (b3[2] + b3[5]) / 2], [40, -25], 1e-3);
    await c.close();
    rec(ASM2, slide && near([bu[1]], [0]) && fixedOk && rot && !errs.length, `y ${b1[1].toFixed(6)} (attesi ${expY.toFixed(6)}); annulla ${bu[1]}; vista ${!near(af.cam, q.cam, 1e-3)}, piastra ${af.pose}; rotazione ${ang.toFixed(6)} rad (attesi ${expAng.toFixed(6)}); ${errs.join(' / ')}`);
  } catch (e) { rec(ASM2, false, e.message.split('\n')[0]); }

  const ASM3 = 'Assieme: Inverti allineamento e accoppiamento impossibile (✓ non conferma); modifica e soppressione dall\'albero; Copia, Fissa, Libera, Elimina';
  try {
    const { c, p, errs, clickW, insert, st } = await asmSetup();
    await p.click('[data-ct="assembly"]'); await p.waitForTimeout(150);
    await insert('p1'); await insert('p1');
    const s0 = await st(), B = s0.insts[1], x0 = B.p[0];
    // faccia superiore di A con faccia superiore di B: coincidono già, nello stesso verso; invertendo B si capovolge sopra A: y 10..20
    await p.click('[data-cmd="mate"]'); await p.waitForTimeout(100);
    await clickW([5, 10, -5]); await clickW([x0 + 5, 10, -5]);
    const b0 = await p.evaluate(id => __asm.box(id), B.id);
    await p.click('#asmFlip'); await p.waitForTimeout(150);
    await p.click('.pm-ok'); await p.waitForTimeout(150);
    const s1 = await st(), b1 = await p.evaluate(id => __asm.box(id), B.id);
    const flip = near([b0[1], b0[4]], [0, 10]) && near([b1[1], b1[4], s1.dof], [10, 20, 3]) && s1.mates[0].s === -1;
    // accoppiamento impossibile: Distanza 5 tra le due facce già a contatto
    await p.evaluate(() => { App.r.setView(GLView.Renderer.viewQ('iso')); App.r.fit(false); }); await p.waitForTimeout(700);
    await p.evaluate(() => { const a = App.project.assembly; const before = JSON.stringify(a); window.__mates = a.mates.length; App.asm.openMate(); });
    const name = await p.evaluate(() => { const a = App.project.assembly, m = a.mates[0]; return { ...m }; });
    const pickRef = await p.evaluate(m => { const pm = App.pm; const st = App.st; const it = r => { const tg = st.tags.byName.get(r.inst + '/' + r.name); return { kind: 'face', tag: tg, key: st.topo.faceKeys[tg.id], point: [0, 0, 0] }; }; pm.pick(it(m.a)); pm.pick(it(m.b)); document.querySelector('[data-mate="distance"]').click(); return true; }, name);
    await p.waitForTimeout(100);
    await p.fill('#asmValue', '5'); await p.press('#asmValue', 'Tab'); await p.waitForTimeout(250);
    const errMsg = await p.evaluate(() => { const e = document.querySelector('#asmMsg'); return e ? { t: e.textContent, red: e.classList.contains('asm-err') } : null; });
    await p.click('.pm-ok'); await p.waitForTimeout(100);
    const still = await p.evaluate(() => ({ open: !!App.pm, n: App.project.assembly.mates.length }));
    await p.click('.pm-no'); await p.waitForTimeout(150);
    const b2 = await p.evaluate(id => __asm.box(id), B.id);
    const conflict = errMsg && errMsg.red && /non si può soddisfare/.test(errMsg.t) && still.open && still.n === 1 && near([b2[1], b2[4]], [10, 20]);
    // modifica dall'albero: doppio clic, tipo Distanza 7: B va a y 17..27
    await p.dblclick('.tmate'); await p.waitForTimeout(150);
    await p.click('[data-mate="distance"]'); await p.waitForTimeout(100);
    await p.fill('#asmValue', '7'); await p.press('#asmValue', 'Tab'); await p.waitForTimeout(150);
    const sides = await p.evaluate(() => !!document.querySelector('#asmSide'));
    await p.click('.pm-ok'); await p.waitForTimeout(150);
    const s3 = await st(), b3 = await p.evaluate(id => __asm.box(id), B.id);
    const lo = Math.min(b3[1], b3[4]);
    const edit = s3.mates.length === 1 && s3.mates[0].type === 'distance' && near([lo, Math.max(b3[1], b3[4])], [17, 27]) && sides;
    // Sopprimi dal menu: 6 gradi di libertà e posizione ferma; Copia: 3 componenti; Fissa: 0 gradi per quel componente; Elimina con conferma
    await p.click('.tmate', { button: 'right' }); await p.waitForTimeout(60);
    await p.click('.ctx >> text=Sopprimi'); await p.waitForTimeout(150);
    const s4 = await st();
    await p.click('.tinst >> nth=1', { button: 'right' }); await p.waitForTimeout(60);
    await p.click('.ctx >> text=Copia il componente'); await p.waitForTimeout(150);
    const s5 = await st();
    const lbl = s5.tree.filter(t => /Piastra</.test(t)).join('|');
    await p.click('.tinst >> nth=1', { button: 'right' }); await p.waitForTimeout(60);
    await p.click('.ctx >> text=Fissa'); await p.waitForTimeout(150);
    const s6 = await st();
    await p.click('.tinst >> nth=1', { button: 'right' }); await p.waitForTimeout(60);
    await p.click('.ctx >> text=Elimina'); await p.waitForTimeout(100);
    await p.click('#modal .btn-primary, #modal button.primary').catch(() => {});
    await p.waitForTimeout(150);
    const s7 = await st();
    await c.close();
    const menu = s4.dof === 6 && s4.mates[0].sup && s5.insts.length === 3 && /Piastra<1>.*Piastra<2>.*Piastra<3>/.test(lbl) && s6.insts[1].fixed && s6.dof === 6 && s7.insts.length === 2 && s7.mates.length === 0;
    rec(ASM3, flip && conflict && edit && menu && !errs.length, `inverti ${fmtv([b1[1], b1[4], s1.dof])}; conflitto ${errMsg && errMsg.t}, aperto ${still.open}; modifica ${fmtv([b3[1], b3[4]])}; menu gradi ${s4.dof}/${s6.dof}, componenti ${s5.insts.length}→${s7.insts.length}, accoppiamenti ${s7.mates.length}; ${errs.join(' / ')}`);
  } catch (e) { rec(ASM3, false, e.message.split('\n')[0]); }

  const ASM4 = 'Assieme: più parti: salvataggio e riapertura, esporta e importa, parte modificata che sposta i componenti, elemento perso, Annulla separato, doppio clic';
  try {
    const { c, p, errs, insert, st } = await asmSetup();
    await p.click('[data-ct="assembly"]'); await p.waitForTimeout(150);
    await insert('p1'); await insert('p2');
    await p.evaluate(() => { const a = App.project.assembly, t = id => App.asm.infos.get(id).st; App.change(() => { a.mates.push({ id: 'M90', name: 'Concentrico1', type: 'concentric', a: { inst: a.insts[0].id, k: 'face', name: t('p1').tags.list.find(x => x.kind === 'rev').name }, b: { inst: a.insts[1].id, k: 'face', name: t('p2').tags.list.find(x => x.kind === 'rev').name }, s: 1, side: 1, value: 0 }); a.mates.push({ id: 'M91', name: 'Coincidente1', type: 'coincident', a: { inst: a.insts[0].id, k: 'face', name: t('p1').tags.list.find(x => x.kind === 'plane' && x.n[1] > 0.9).name }, b: { inst: a.insts[1].id, k: 'face', name: t('p2').tags.list.find(x => x.kind === 'plane' && x.n[1] < -0.9).name }, s: -1, side: 1, value: 0 }); }); });
    await p.waitForTimeout(700);
    const s0 = await st(), pin = s0.insts[1];
    const saved = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('banco-cad-v1')); return { has: !!d.project, parts: d.project && d.project.parts.length, active: d.project && d.project.parts.find(x => x.id === d.project.active).doc === undefined, open: d.project && d.project.open, nm: d.doc.name }; });
    await p.reload(); await p.waitForFunction(() => window.App && App.st, null, { timeout: 15000 }); await p.waitForTimeout(400);
    await p.evaluate(() => { window.__asm = { state: () => { const a = App.project.assembly; return { insts: a.insts.map(i => ({ id: i.id, p: i.pose.p })), mates: a.mates.length, dof: App.asm.last.dof.total, tree: [...document.querySelectorAll('#tree .tnode .tl')].map(x => x.textContent) }; }, box: id => { const b = App.st.bodies.find(x => x.id === id); const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (const p of b.polys) for (const v of p.v) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], v[k]); mx[k] = Math.max(mx[k], v[k]); } return [...mn, ...mx]; } }; });
    const rl = await p.evaluate(() => ({ mode: App.mode, s: __asm.state(), tab: document.querySelector('[data-ct="assembly"]').getAttribute('aria-selected'), sel: document.querySelector('#partSel').value, name: document.querySelector('#docName').value }));
    const reopen = rl.mode === 'assembly' && rl.tab === 'true' && rl.sel === 'asm' && rl.s.mates === 2 && rl.s.dof === 1 && near(rl.s.insts[1].p, pin.p, 1e-9) && rl.name === 'Assieme1';
    // doppio clic nell'albero: apre la parte; Annulla è suo; cambio l'altezza della piastra da 10 a 25: il perno si riporta a y = 25
    await p.dblclick('.tinst >> nth=0'); await p.waitForTimeout(250);
    const inPart = await p.evaluate(() => ({ mode: App.mode, name: App.doc.name, sel: document.querySelector('#partSel').value, undo: App.undoStack.length, tab: document.querySelector('[data-ct="features"]').getAttribute('aria-selected'), feats: App.doc.features.length }));
    await p.evaluate(() => App.change(() => { App.doc.features.find(f => f.type === 'extrude').depth = 25; }));
    await p.waitForTimeout(100);
    await p.click('[data-ct="assembly"]'); await p.waitForTimeout(250);
    const after = await p.evaluate(id => ({ b: __asm.box(id), s: __asm.state(), undo: App.undoStack.length }), pin.id);
    const edit = inPart.mode === 'part' && inPart.name === 'Piastra' && inPart.undo === 0 && inPart.sel === 'p1' && near([after.b[1], after.b[4]], [25, 55]);
    // togliendo il foro dalla parte: il concentrico ha il punto esclamativo, il resto continua
    await p.evaluate(() => { App.openPart('p1'); App.change(() => { const f = App.doc.features.find(x => x.type === 'sketch'); f.sk.ents = f.sk.ents.filter(e => e.t !== 'ci' && !(e.t === 'pt' && Math.abs(e.x - 40) < 1e-9 && Math.abs(e.y - 25) < 1e-9)); }); });
    await p.click('[data-ct="assembly"]'); await p.waitForTimeout(250);
    const lost = await p.evaluate(() => ({ badge: document.querySelectorAll('.tmate .badge.err').length, title: (document.querySelector('.tmate .badge.err') || {}).title, status: document.querySelector('#stMsg').textContent }));
    // Annulla nella parte rimette il foro; il messaggio sparisce
    await p.evaluate(() => { App.openPart('p1'); App.undo(); }); await p.click('[data-ct="assembly"]'); await p.waitForTimeout(250);
    const back = await p.evaluate(() => document.querySelectorAll('.tmate .badge.err').length);
    // Esporta e Importa: tutto il progetto in un file
    const file = await p.evaluate(() => { let out = null; const f = App.offerFile; App.offerFile = (n, t, d) => { out = { n, d }; }; document.querySelector('#menuFile [data-act="export"]').click(); App.offerFile = f; return out; });
    const j = JSON.parse(file.d);
    await p.evaluate(() => document.querySelector('#menuFile [data-act="new"]').click()); await p.waitForTimeout(80);
    await p.click('#modal >> text=Nuovo progetto >> nth=-1'); await p.waitForTimeout(200);
    const fresh2 = await p.evaluate(() => ({ mode: App.mode, parts: App.project.parts.length, asm: App.project.assembly, sel: document.querySelector('#partSel').hidden, feats: App.doc.features.length }));
    await p.evaluate(() => document.querySelector('#menuFile [data-act="import"]').click()); await p.waitForTimeout(80);
    await p.fill('#impText', file.d); await p.click('#modal >> text=Importa >> nth=-1'); await p.waitForTimeout(300);
    const imp = await p.evaluate(() => ({ mode: App.mode, parts: App.project.parts.map(x => x.doc.name), s: __asm.state() }));
    // Elimina questa parte: il perno e i suoi accoppiamenti spariscono
    await p.evaluate(() => { App.openPart('p2'); document.querySelector('#menuFile [data-act="delPart"]').click(); }); await p.waitForTimeout(80);
    await p.click('#modal >> text=Elimina la parte'); await p.waitForTimeout(250);
    const del = await p.evaluate(() => ({ parts: App.project.parts.length, active: App.doc.name, insts: App.project.assembly.insts.length, mates: App.project.assembly.mates.length, hidden: document.querySelector('#menuFile [data-act="delPart"]').hidden }));
    await c.close();
    const ok = saved.has && saved.parts === 2 && saved.active && saved.open === 'assembly' && saved.nm === 'Piastra' && reopen && edit && lost.badge === 1 && /non esiste più/.test(lost.title) && /errori/.test(lost.status) && back === 0 && j.app === 'banco-cad' && j.v === 2 && /Assieme1\.bcad\.json/.test(file.n) && fresh2.parts === 1 && !fresh2.asm && fresh2.mode === 'part' && fresh2.feats === 0 && imp.parts.join() === 'Piastra,Perno' && imp.s.mates === 2 && imp.mode === 'assembly' && del.parts === 1 && del.active === 'Piastra' && del.insts === 1 && del.mates === 0 && del.hidden && !errs.length;
    rec(ASM4, ok, `salvato ${JSON.stringify(saved)}; riaperto ${reopen}; parte ${JSON.stringify(inPart)}; y ${fmtv([after.b[1], after.b[4]])}; perso ${lost.badge} «${lost.title}»; dopo Annulla ${back}; file ${file.n} v${j.v}; nuovo ${JSON.stringify(fresh2)}; importato ${imp.parts} ${imp.s.mates}; eliminata ${JSON.stringify(del)}; ${errs.join(' / ')}`);
  } catch (e) { rec(ASM4, false, e.message.split('\n')[0]); }

  const ASM5 = 'Assieme: inserire da file: STEP con due corpi (due parti alle posizioni del file), STL in cm, progetto esportato; file sbagliato spiegato; esportazione STEP di due solidi';
  try {
    const { stepTwoBoxes } = require('./stepgen.js');
    const { c, p, errs, st } = await asmSetup();
    await p.click('[data-ct="assembly"]'); await p.waitForTimeout(150);
    const open = async () => { await p.click('[data-cmd="insertPart"]'); await p.waitForSelector('#asmFile'); };
    await open();
    await p.setInputFiles('#asmFile', { name: 'due.step', mimeType: 'application/step', buffer: Buffer.from(stepTwoBoxes(10, 5)) });
    await p.waitForFunction(() => App.project.assembly.insts.length === 2 && document.querySelector('#modal').hidden, null, { timeout: 30000 });
    await p.waitForTimeout(150);
    const s1 = await st(), bb = await p.evaluate(ids => ids.map(id => __asm.box(id)), s1.insts.map(i => i.id));
    const names = await p.evaluate(() => App.project.parts.map(x => x.doc.name));
    // cubo 10 e cubo 10 staccato di 5: x 0..10 e 15..25; la prima parte è fissa, l'altra è libera
    const step = names.length === 4 && near(bb[0].slice(0, 6), [0, 0, 0, 10, 10, 10]) && near(bb[1].slice(0, 6), [15, 0, 0, 25, 10, 10]) && s1.insts[0].fixed && !s1.insts[1].fixed;
    // STL: un triangolo non basta, serve un solido: tetraedro 1 cm di lato sugli assi → in mm x massimo 10, accanto all'ultimo
    const tris = [[[0, 0, 0], [0, 1, 0], [1, 0, 0]], [[0, 0, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 0], [0, 0, 1], [0, 1, 0]], [[1, 0, 0], [0, 1, 0], [0, 0, 1]]];
    const stl = 'solid t\n' + tris.map(t => ' facet normal 0 0 0\n  outer loop\n' + t.map(v => `   vertex ${v.join(' ')}\n`).join('') + '  endloop\n endfacet\n').join('') + 'endsolid t\n';
    await open();
    await p.selectOption('#asmUnit', 'cm');
    await p.setInputFiles('#asmFile', { name: 'tetra.stl', mimeType: 'model/stl', buffer: Buffer.from(stl) });
    await p.waitForFunction(() => App.project.assembly.insts.length === 3, null, { timeout: 10000 }); await p.waitForTimeout(150);
    const s2 = await st(), b2 = await p.evaluate(id => __asm.box(id), s2.insts[2].id);
    // accanto all'ingombro: 25 + 0,25 × 10 = 27,5; altezza e profondità in mm dal file in cm
    const stlOk = near(b2, [27.5, 0, 0, 37.5, 10, 10], 1e-5);
    // progetto esportato: una parte
    const onePart = JSON.stringify({ app: 'banco-cad', v: 1, doc: await p.evaluate(() => App.project.parts[1].doc), drawing: null });
    await open();
    await p.setInputFiles('#asmFile', { name: 'perno.bcad.json', mimeType: 'application/json', buffer: Buffer.from(onePart) });
    await p.waitForFunction(() => App.project.assembly.insts.length === 4, null, { timeout: 10000 }); await p.waitForTimeout(150);
    const nm = await p.evaluate(() => App.project.parts.map(x => x.doc.name));
    // file sbagliato: messaggio, niente cambia
    await open();
    await p.setInputFiles('#asmFile', { name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('ciao') });
    await p.waitForTimeout(250);
    const wrong = await p.evaluate(() => ({ toast: document.querySelector('#toast').textContent, n: App.project.assembly.insts.length, m: App.mode, d: App.doc.name }));
    // esportazione STEP dell'assieme dal programma: un solido per componente
    const ex = await p.evaluate(() => { const r = App.stepText(); return { solids: r.stats.solids, bad: r.stats.badEdges + r.stats.openLoops, name: /FILE_NAME\('([^']*)/.exec(r.text)[1] }; });
    await p.evaluate(() => { App.undo(); }); await p.waitForTimeout(150);
    const un = await st();
    await p.screenshot({ path: path.join(OUT, 'assieme-file.png') });
    await c.close();
    const ok = step && stlOk && nm[nm.length - 1] === 'Perno (2)' && /Formato non riconosciuto/.test(wrong.toast) && wrong.n === 4 && wrong.m === 'assembly' && wrong.d === 'Piastra' && ex.solids === 4 && ex.bad === 0 && /Assieme1/.test(ex.name) && un.insts.length === 3 && !errs.length;
    rec(ASM5, ok, `parti ${names}; corpi ${fmtv(bb[0])} / ${fmtv(bb[1])}; STL ${fmtv(b2)}; nomi ${nm}; sbagliato «${wrong.toast}»; STEP ${JSON.stringify(ex)}; dopo Annulla ${un.insts.length}; ${errs.join(' / ')}`);
  } catch (e) { rec(ASM5, false, e.message.split('\n')[0]); }

  const ASM6 = 'Assieme: progetto troppo grande per il salvataggio normale: va nell\'archivio del browser, si riapre, torna indietro quando c\'entra';
  try {
    const { c, p, errs, insert, st } = await asmSetup();
    await p.click('[data-ct="assembly"]'); await p.waitForTimeout(150);
    await insert('p1'); await insert('p2');
    await p.evaluate(() => { const o = Storage.prototype.setItem; window.__restore = () => { Storage.prototype.setItem = o; }; Storage.prototype.setItem = function (k, v) { if (v.length > 50) { const e = new Error('piena'); e.name = 'QuotaExceededError'; throw e; } return o.call(this, k, v); }; App.save(); });
    await p.waitForFunction(() => App.storeInDb, null, { timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(100);
    const db = await p.evaluate(async () => ({ ls: localStorage.getItem('banco-cad-v1'), inDb: !!App.storeInDb, big: ((await App.dbDo('readonly', os => os.get('banco-cad-v1'))) || '').length, toast: document.querySelector('#toast').hidden ? '' : document.querySelector('#toast').textContent, p: App.project.assembly.insts[1].pose.p }));
    await p.reload(); await p.waitForFunction(() => window.App && App.st && !App.storeLoading && App.mode === 'assembly', null, { timeout: 15000 }); await p.waitForTimeout(300);
    const rl = await p.evaluate(() => ({ n: App.project.assembly.insts.length, parts: App.project.parts.length, p: App.project.assembly.insts[1].pose.p, name: App.project.parts[1].doc.name, inDb: App.storeInDb }));
    await p.evaluate(() => App.save()); await p.waitForTimeout(600);
    const back = await p.evaluate(async () => { const raw = localStorage.getItem('banco-cad-v1'); return { full: raw.length > 50 && !!JSON.parse(raw).project, inDb: !!App.storeInDb, db: await App.dbDo('readonly', os => os.get('banco-cad-v1')) }; });
    // archivio impossibile da usare: il vecchio messaggio resta
    const fail = await p.evaluate(async () => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function () { const e = new Error('piena'); e.name = 'QuotaExceededError'; throw e; }; const od = indexedDB.open; IDBFactory.prototype.open = function () { throw new Error('no'); }; App.save(); await new Promise(r => setTimeout(r, 500)); const t = document.querySelector('#toast').textContent; Storage.prototype.setItem = o; IDBFactory.prototype.open = od; return t; });
    await c.close();
    const ok = db.ls === '{"inDb":1}' && db.inDb && db.big > 1000 && !/troppo grande/.test(db.toast) && rl.n === 2 && rl.parts === 2 && rl.name === 'Perno' && near(rl.p, db.p, 1e-9) && back.full && !back.inDb && back.db === undefined && /troppo grande/.test(fail) && !errs.length;
    rec(ASM6, ok, `segno ${db.ls}, archivio ${db.big} caratteri; riaperto ${rl.n} componenti; indietro ${back.full}/${back.inDb}/${back.db}; senza archivio «${fail.slice(0, 60)}»; ${errs.join(' / ')}`);
  } catch (e) { rec(ASM6, false, e.message.split('\n')[0]); }

  const ASM8 = 'Assieme: le altre schede e i comandi: tavola e ritorno, sezione, PDF, STL con tutti i triangoli, importazioni nella finestra giusta, Canc';
  try {
    const { c, p, errs, insert, st } = await asmSetup();
    await p.click('[data-ct="assembly"]'); await p.waitForTimeout(150);
    await insert('p1'); await insert('p2');
    await p.click('[data-ct="drawing"]'); await p.waitForTimeout(400);
    const dr = await p.evaluate(() => ({ mode: App.mode, sheet: !document.querySelector('#sheetView').hidden, doc: App.doc.name, tree: document.querySelector('#tree').textContent.includes('Componenti') }));
    await p.click('[data-ct="assembly"]'); await p.waitForTimeout(300);
    const back = await p.evaluate(() => ({ mode: App.mode, sheet: !document.querySelector('#sheetView').hidden, n: App.st.bodies.length }));
    await p.click('[data-cmd="section"]'); await p.waitForTimeout(150);
    const sec = await p.evaluate(() => App.sectionOn); await p.evaluate(() => { document.querySelector('#btnSection').click(); }); await p.waitForTimeout(80);
    const files = await p.evaluate(async () => {
      const out = {}; const f = App.offerFile;
      App.offerFile = (n, t, d) => { out[n] = d.size !== undefined ? d.size : d.length; };
      document.querySelector('#menuFile [data-act="stl"]').click();
      const tri = App.st.body.reduce((a, q) => a + q.v.length - 2, 0);
      App.offerFile = f;
      await App.savePdf(); const pdf = App.lastPdf;
      return { out, tri, pdf: pdf && (pdf.name || true) };
    });
    const dlg = await p.evaluate(() => { document.querySelector('#menuFile [data-act="importCad"]').click(); return !!document.querySelector('#asmFile'); });
    await p.evaluate(() => { document.querySelector('#modal').hidden = true; document.querySelector('#menuFile [data-act="importDxf"]').click(); });
    const dxf = await p.evaluate(() => ({ t: document.querySelector('#toast').textContent, modal: !document.querySelector('#modal').hidden }));
    await p.click('.tinst >> nth=1'); await p.waitForTimeout(80);
    const hl = await p.evaluate(() => ({ sel: App.sel[0] && App.sel[0].kind, cls: document.querySelector('.tinst.sel') && document.querySelector('.tinst.sel').textContent }));
    await p.keyboard.press('Delete'); await p.waitForTimeout(150);
    const s1 = await st();
    await c.close();
    const stl = Object.entries(files.out).find(([n]) => /Assieme1.*\.stl$/.test(n));
    const ok = dr.mode === 'drawing' && dr.sheet && dr.doc === 'Piastra' && back.mode === 'assembly' && !back.sheet && back.n === 2 && sec === true && stl && stl[1] === 84 + 50 * files.tri && files.pdf && dlg && /apri prima una parte/.test(dxf.t) && !dxf.modal && hl.sel === 'body' && /Perno/.test(hl.cls) && s1.insts.length === 1 && !errs.length;
    rec(ASM8, ok, `tavola ${JSON.stringify(dr)}; ritorno ${JSON.stringify(back)}; sezione ${sec}; file ${JSON.stringify(files)}; DXF «${dxf.t}»; selezione ${JSON.stringify(hl)}; dopo Canc ${s1.insts.length}; ${errs.join(' / ')}`);
  } catch (e) { rec(ASM8, false, e.message.split('\n')[0]); }

  const ASM9 = 'Assieme: piani, origine e vertici: piano creato e origine scelti nel pannello, vertice scelto col mouse che segue la parte, «!» se sparisce; cono e sfera di uno STEP scelti con il mouse';
  try {
    const { stepCone, stepSphere } = require('./stepgen.js');
    const { c, p, errs, clickW, insert, st } = await asmSetup();
    // piano creato nella Piastra: 25 mm sopra il piano superiore
    await p.evaluate(() => App.change(() => { const d = App.doc; d.features.push({ id: Model.uid(d, 'F'), type: 'plane', name: 'Piano25', base: { kind: 'std', id: 'top' }, offset: 25 }); }));
    await p.click('[data-ct="assembly"]'); await p.waitForTimeout(200);
    await insert('p1'); await insert('p2');
    const s0 = await st(), piastra = s0.insts[0], perno = s0.insts[1];
    await p.click('[data-cmd="mate"]'); await p.waitForTimeout(100);
    const opts0 = await p.evaluate(() => [...document.querySelectorAll('#asmDatumInst option')].map(o => o.textContent));
    const btn0 = await p.evaluate(() => [...document.querySelectorAll('#asmDatums [data-datum]')].map(b => b.textContent));
    await p.selectOption('#asmDatumInst', piastra.id); await p.waitForTimeout(50);
    const plId = await p.evaluate(() => App.project.parts[0].doc.features.find(f => f.type === 'plane').id);
    await p.click(`#asmDatums [data-datum="${plId}"]`); await p.waitForTimeout(100);
    const chips1 = await p.evaluate(() => document.querySelector('#pm .selbox').innerText);
    // il pannello non offre più i piani dello stesso componente
    const opts1 = await p.evaluate(() => [...document.querySelectorAll('#asmDatumInst option')].map(o => o.textContent));
    await p.hover('#asmDatums [data-datum="top"]'); await p.waitForTimeout(80);
    await p.screenshot({ path: path.join(OUT, 'assieme-piano.png') });
    await p.click('#asmDatums [data-datum="top"]'); await p.waitForTimeout(150);
    const pressed = await p.evaluate(() => document.querySelector('[data-mate="coincident"]').getAttribute('aria-pressed'));
    const msg1 = await p.evaluate(() => document.querySelector('#asmMsg').textContent);
    await p.click('.pm-ok'); await p.waitForTimeout(150);
    const b1 = await p.evaluate(id => __asm.box(id), perno.id), s1 = await st();
    // perno Ø20 alto 30: y 25..55 sul piano a 25 mm
    const plOk = near([b1[1], b1[4]], [25, 55]) && s1.dof === 3 && s1.ok;
    // origine del perno sul piano destro della piastra: x -10..10
    await p.click('[data-cmd="mate"]'); await p.waitForTimeout(100);
    await p.selectOption('#asmDatumInst', perno.id); await p.waitForTimeout(50);
    await p.click('#asmDatums [data-datum="origin"]'); await p.waitForTimeout(50);
    await p.click('#asmDatums [data-datum="right"]'); await p.waitForTimeout(150);
    const chips2 = await p.evaluate(() => document.querySelector('#pm .selbox').innerText);
    await p.click('.pm-ok'); await p.waitForTimeout(150);
    const b2 = await p.evaluate(id => __asm.box(id), perno.id), s2 = await st();
    const orOk = near([b2[0], b2[3], b2[1], b2[4]], [-10, 10, 25, 55]) && s2.dof === 2 && s2.ok && /Origine di Perno<1>/.test(chips2) && /Piano destro di Piastra<1>/.test(chips2);
    // origine su origine: contraddice il piano a 25 mm: ✓ non conferma
    await p.click('[data-cmd="mate"]'); await p.waitForTimeout(100);
    await p.selectOption('#asmDatumInst', perno.id); await p.waitForTimeout(50);
    await p.click('#asmDatums [data-datum="origin"]'); await p.waitForTimeout(50);
    await p.click('#asmDatums [data-datum="origin"]'); await p.waitForTimeout(200);
    const bad = await p.evaluate(() => ({ msg: document.querySelector('#asmMsg').textContent, cls: document.querySelector('#asmMsg').className }));
    await p.click('.pm-ok'); await p.waitForTimeout(100);
    const stillOpen = await p.evaluate(() => !!App.pm); await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    if (await p.evaluate(() => !!App.pm)) { await p.evaluate(() => App.closePM(false)); await p.waitForTimeout(100); }
    const s3 = await st(), b3 = await p.evaluate(id => __asm.box(id), perno.id);
    const refuse = /non si può soddisfare/.test(bad.msg) && /asm-err/.test(bad.cls) && stillOpen && s3.mates.length === 2 && near([b3[0], b3[3], b3[1], b3[4]], [-10, 10, 25, 55]);
    // il piano che sparisce: «!» con il messaggio
    await p.evaluate(() => { App.openPart('p1'); App.change(() => { App.doc.features = App.doc.features.filter(f => f.type !== 'plane'); }); });
    await p.click('[data-ct="assembly"]'); await p.waitForTimeout(250);
    const lost = await p.evaluate(() => ({ n: document.querySelectorAll('.tmate .badge.err').length, title: (document.querySelector('.tmate .badge.err') || {}).title }));
    await p.evaluate(() => { App.openPart('p1'); App.undo(); }); await p.click('[data-ct="assembly"]'); await p.waitForTimeout(250);
    const back = await p.evaluate(() => document.querySelectorAll('.tmate .badge.err').length);
    const lostOk = lost.n === 1 && /piano scelto non esiste più/.test(lost.title) && back === 0;
    await c.close();

    // vertici col mouse: angolo della piastra e punto del perno
    const V = await asmSetup();
    await V.p.click('[data-ct="assembly"]'); await V.p.waitForTimeout(200);
    await V.insert('p1'); await V.insert('p2');
    const v0 = await V.st(), pin = v0.insts[1];
    await V.p.click('[data-cmd="mate"]'); await V.p.waitForTimeout(100);
    await V.clickW([80, 10, 0]);
    await V.clickW([95 + 10, 30, 0]);
    const vchips = await V.p.evaluate(() => document.querySelector('#pm .selbox').innerText);
    await V.p.click('.pm-ok'); await V.p.waitForTimeout(150);
    const refs = await V.p.evaluate(() => { const m = App.project.assembly.mates[0]; return { a: m.a, b: m.b }; });
    const wp = await V.p.evaluate(() => { const a = App.project.assembly, i = a.insts[1], m = a.mates[0]; return Assembly.toWorld(i.pose, m.b.p); });
    const vOk0 = /Vertice di Piastra<1>/.test(vchips) && /Vertice di Perno<1>/.test(vchips) && near(refs.a.p, [80, 10, 0], 1e-6) && near(refs.b.p, [10, 30, 0], 1e-6) && refs.a.faces.length === 3 && refs.b.faces.length === 2 && near(wp, [80, 10, 0], 1e-6);
    // la piastra si allunga da 80 a 110 mm: il vertice si ritrova, il perno lo segue
    await V.p.evaluate(() => { App.openPart('p1'); App.change(() => { for (const e of App.doc.features[0].sk.ents) if (e.t === 'pt' && e.x === 80) e.x = 110; }); });
    await V.p.click('[data-ct="assembly"]'); await V.p.waitForTimeout(250);
    const v1 = await V.p.evaluate(() => { const a = App.project.assembly, i = a.insts[1], m = a.mates[0]; return { w: Assembly.toWorld(i.pose, m.b.p), p: m.a.p, badge: document.querySelectorAll('.tmate .badge.err').length, ok: App.asm.last.ok }; });
    const follow = near(v1.w, [110, 10, 0], 1e-6) && near(v1.p, [110, 10, 0], 1e-6) && v1.badge === 0 && v1.ok;
    // Annulla nella parte: torna a 80 e il perno torna con lui
    await V.p.evaluate(() => { App.openPart('p1'); App.undo(); }); await V.p.click('[data-ct="assembly"]'); await V.p.waitForTimeout(250);
    const v2 = await V.p.evaluate(() => { const a = App.project.assembly, i = a.insts[1], m = a.mates[0]; return { w: Assembly.toWorld(i.pose, m.b.p), badge: document.querySelectorAll('.tmate .badge.err').length }; });
    const undoV = near(v2.w, [80, 10, 0], 1e-6) && v2.badge === 0;
    // smusso sullo spigolo che arriva al vertice: sparisce davvero
    await V.p.evaluate(() => { App.openPart('p1'); App.change(() => { const d = App.doc, st = App.st, t = st.topo; let e = null; for (const g of Model.edgeGroups(st, t).values()) { const p = g.segs.flatMap(x => [t.verts[x.a], t.verts[x.b]]); if (p.every(v => Math.abs(v[0] - 80) < 1e-6 && Math.abs(v[1] - 10) < 1e-6)) e = g; } if (!e) throw new Error('spigolo non trovato'); d.features.push({ id: Model.uid(d, 'F'), name: 'Smusso1', type: 'chamfer', d: 2, edges: [{ a: st.tags.get(e.t1).name, b: st.tags.get(e.t2).name, p: [80, 10, -25] }] }); }); });
    await V.p.click('[data-ct="assembly"]'); await V.p.waitForTimeout(250);
    const v3 = await V.p.evaluate(() => ({ n: document.querySelectorAll('.tmate .badge.err').length, title: (document.querySelector('.tmate .badge.err') || {}).title, errs: App.project.parts[0].doc.features.length }));
    const goneV = v3.n === 1 && /vertice scelto non esiste più/.test(v3.title);
    await V.c.close();

    // cono e sfera di uno STEP, scelti con il mouse: il centro della sfera finisce sull'asse del cono
    const W = await asmSetup();
    await W.p.click('[data-ct="assembly"]'); await W.p.waitForTimeout(200);
    const openIns = async () => { await W.p.click('[data-cmd="insertPart"]'); await W.p.waitForSelector('#asmFile'); };
    await openIns();
    await W.p.setInputFiles('#asmFile', { name: 'cono.step', mimeType: 'application/step', buffer: Buffer.from(stepCone(5, 15, 20)) });
    await W.p.waitForFunction(() => App.project.assembly.insts.length === 1 && document.querySelector('#modal').hidden, null, { timeout: 30000 }); await W.p.waitForTimeout(150);
    await openIns();
    await W.p.setInputFiles('#asmFile', { name: 'sfera.step', mimeType: 'application/step', buffer: Buffer.from(stepSphere(10, { c: [0, 0, 0] })) });
    await W.p.waitForFunction(() => App.project.assembly.insts.length === 2 && document.querySelector('#modal').hidden, null, { timeout: 30000 }); await W.p.waitForTimeout(150);
    await W.p.evaluate(() => { App.r.setView(GLView.Renderer.viewQ('iso')); App.r.fit(false); }); await W.p.waitForTimeout(700);
    const w0 = await W.st(), sf = w0.insts[1];
    await W.p.click('[data-cmd="mate"]'); await W.p.waitForTimeout(100);
    // punto sulla faccia conica, verso la vista: raggio 10 a z = 10; il cono non è nascosto dalla sfera, che sta accanto
    const pkC = await W.p.evaluate(() => { const r = App.r, a = Math.PI / 4; for (const ang of [0, Math.PI / 2, Math.PI, -Math.PI / 2, a, -a]) { const w = [10 * Math.cos(ang), 10 * Math.sin(ang), 10], q = r.project(w), f = r.pickFace(q[0], q[1]); if (f) { const tg = App.st.tags.get(App.st.body[f.poly].t); if (tg.inst === App.project.assembly.insts[0].id && Math.abs(Math.hypot(f.point[0], f.point[1]) - (5 + f.point[2] / 2)) < 0.05 && f.point[2] > 2 && f.point[2] < 18) return w; } } return null; });
    await W.clickW(pkC);
    const chipC = await W.p.evaluate(() => document.querySelector('#pm .selbox').innerText);
    const cs = sf.p;
    await W.clickW(await W.p.evaluate(p0 => { const r = App.r, c = p0, b = r.basis(); return c.map((v, k) => v + 10 * b.back[k]); }, cs));
    const chipS = await W.p.evaluate(() => document.querySelector('#pm .selbox').innerText);
    const press = await W.p.evaluate(() => document.querySelector('[data-mate="concentric"]').getAttribute('aria-pressed'));
    await W.p.click('.pm-ok'); await W.p.waitForTimeout(200);
    const w1 = await W.st(), wc = await W.p.evaluate(() => { const a = App.project.assembly, i = a.insts[1]; return Assembly.toWorld(i.pose, [0, 0, 0]); });
    const stepOk = /Faccia conica di/.test(chipC) && /Sfera di/.test(chipS) && press === 'true' && near([wc[0], wc[1]], [0, 0], 1e-5) && w1.dof === 4 && w1.ok;
    await W.p.screenshot({ path: path.join(OUT, 'assieme-cono-sfera.png') });
    await W.c.close();

    const ok = opts0.length === 2 && btn0.join('|') === 'Piano frontale|Piano superiore|Piano destro|Piano25|Origine' && /Piano25 di Piastra<1>/.test(chips1) && opts1.join() === 'Perno<1>' && pressed === 'true' && /Gradi di libertà rimasti: 3/.test(msg1) && plOk && orOk && refuse && lostOk && vOk0 && follow && undoV && goneV && stepOk && !errs.length && !V.errs.length && !W.errs.length;
    rec(ASM9, ok, JSON.stringify({ opts0, btn0, chips1, opts1, pressed, msg1, b1: b1 && fmtv(b1), plOk, b2: fmtv(b2), chips2, orOk, bad: bad.msg, refuse, lost, back, vchips, refs, wp, vOk0, v1, follow, v2, undoV, v3, goneV, chipC, chipS, press, wc, dof: w1.dof, stepOk, errs: [...errs, ...V.errs, ...W.errs] }));
  } catch (e) { rec(ASM9, false, e.message.split('\n')[0]); }

  const ASM7 = 'Assieme su tablet e telefono: Sposta parte con il dito; il dito sul pezzo fuori dal comando non lo muove; niente scorrimento laterale a 390 px';
  try {
    const c = await browser.newContext({ viewport: { width: 1000, height: 700 }, hasTouch: true });
    const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + page_); await p.waitForFunction(() => window.App && App.r, null, { timeout: 15000 });
    await p.evaluate(() => { const d = Model.newDoc(); d.name = 'Blocco'; const s = Sketch.newSketch(); const P = [[0, 0], [80, 0], [80, 50], [0, 50]].map(([x, y]) => { const id = 'p' + s.next++; s.ents.push({ id, t: 'pt', x, y }); return id; }); for (let i = 0; i < 4; i++) s.ents.push({ id: 'l' + s.next++, t: 'ln', a: P[i], b: P[(i + 1) % 4] }); const sid = Model.uid(d, 'F'); d.features.push({ id: sid, type: 'sketch', name: 'Schizzo1', plane: { kind: 'std', id: 'top' }, sk: s }); d.features.push({ id: Model.uid(d, 'F'), name: 'Estrusione1', type: 'extrude', sketch: sid, end: 'blind', depth: 10 }); App.setProject({ doc: d, drawing: null }); App.regen(); });
    await p.tap('[data-ct="assembly"]'); await p.waitForTimeout(150);
    await p.tap('[data-cmd="insertPart"]'); await p.tap('#asmParts [data-part="p1"]'); await p.waitForTimeout(100);
    await p.tap('[data-cmd="insertPart"]'); await p.tap('#asmParts [data-part="p1"]'); await p.waitForTimeout(100);
    await p.evaluate(() => { App.r.setView(GLView.Renderer.viewQ('top')); App.r.fit(false); }); await p.waitForTimeout(700);
    const px = w => p.evaluate(w => { const q = App.r.project(w), b = document.querySelector('#view').getBoundingClientRect(); return [q[0] + b.left, q[1] + b.top]; }, w);
    const cdp = await c.newCDPSession(p);
    const swipe = async (a, dx) => { const pt = (x, y) => [{ x, y, id: 0 }]; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(a[0], a[1]) }); for (let i = 1; i <= 5; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(a[0] + dx * i / 5, a[1]) }); await p.waitForTimeout(30); } await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(100); };
    const pose = () => p.evaluate(() => App.project.assembly.insts[1].pose.p.slice());
    const p0 = await pose();
    const a = await px([p0[0] + 40, 10, -25]);
    await swipe(a, 60);
    const p1 = await pose();
    const pxs = await p.evaluate(() => App.r.pxSize());
    await p.tap('[data-cmd="movepart"]'); await p.waitForTimeout(300);
    await p.evaluate(() => App.r.fit(false)); await p.waitForTimeout(700);
    const a2 = await px([p0[0] + 40, 10, -25]), pxs2 = await p.evaluate(() => App.r.pxSize());
    await swipe(a2, 60);
    const p2 = await pose();
    await p.evaluate(() => App.closePM(false));
    await c.close();
    const c2 = await browser.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
    const m = await c2.newPage(); await m.goto('file://' + page_); await m.waitForFunction(() => window.App && App.r, null, { timeout: 15000 });
    await m.evaluate(() => { const d = App.doc; App.project.parts.push({ id: 'p2', doc: Model.newDoc(), drawing: null }); App.project.parts[1].doc.name = 'Una parte con un nome molto lungo per vedere'; App.asm.refreshPartSel(); });
    await m.waitForTimeout(100);
    const over = await m.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sel: !document.querySelector('#partSel').hidden, r: document.querySelector('#partSel').getBoundingClientRect().right }));
    await m.screenshot({ path: path.join(OUT, 'assieme-telefono.png') });
    await c2.close();
    const moved = 60 * pxs2; void pxs;
    const ok = near(p1, p0, 1e-9) && near(p2, [p0[0] + moved, p0[1], p0[2]], 1e-5) && over.sel && over.sw <= over.cw && over.r <= over.cw && !errs.length;
    rec(ASM7, ok, `senza comando ${fmtv(p1)}; con il comando ${fmtv(p2)} (atteso +${moved.toFixed(4)}); larghezza ${over.sw}/${over.cw}, elenco fino a ${over.r}; ${errs.join(' / ')}`);
  } catch (e) { rec(ASM7, false, e.message.split('\n')[0]); }

  const ASMC1 = 'Assieme: Proprietà di massa, Distinta base e Verifica interferenze con il mouse: valori a mano, volume in rosso nella vista';
  try {
    const { c, p, errs, insert } = await asmSetup();
    await p.click('[data-ct="assembly"]'); await p.waitForTimeout(150);
    await insert('p1'); await insert('p2');
    // materiali e perno nel foro, con le faccette girate rispetto a quelle del foro
    await p.evaluate(() => {
      App.project.parts[0].doc.material = 's235'; App.project.parts[1].doc.material = 'al6082';
      App.change(() => { const i = App.project.assembly.insts[1]; i.pose = { p: [40, 0, -25], q: Assembly.qexp([0, 0.0713, 0]) }; });
      window.__red = () => { const v = App.r.canvas; App.renderNow(); const t = document.createElement('canvas'); t.width = v.width; t.height = v.height; const x = t.getContext('2d'); x.drawImage(v, 0, 0); const d = x.getImageData(0, 0, t.width, t.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 110 && d[i + 1] < 50 && d[i + 2] < 50) n++; return n; };
    });
    await p.waitForTimeout(150);
    const num = s => parseFloat(s.replace(/\./g, '').replace(',', '.'));
    await p.click('[data-cmd="asmMass"]'); await p.waitForTimeout(150);
    const mass = await p.evaluate(() => ({ kv: [...document.querySelectorAll('#asmMassKv dd')].map(d => d.textContent), rows: [...document.querySelectorAll('#asmMassComps tbody tr')].map(r => [...r.cells].map(x => x.textContent)), t: document.querySelector('#modalTitle').textContent }));
    await p.screenshot({ path: path.join(OUT, 'assieme-massa.png') });
    await p.click('#modalActions .btn-primary');
    const Va = 80 * 50 * 10 - Math.PI * 100 * 10, Vb = Math.PI * 100 * 30, ma = Va * 7.85 / 1000, mb = Vb * 2.7 / 1000;
    const okMass = Math.abs(num(mass.kv[0]) - (ma + mb)) < 0.006 && Math.abs(num(mass.kv[1]) - (Va + Vb)) < 0.006 && Math.abs(num(mass.kv[4]) - (ma * 5 + mb * 15) / (ma + mb)) < 0.0006 && mass.rows.length === 2 && mass.rows[0][0] === 'Piastra<1>' && /S235/.test(mass.rows[0][1]) && /6082/.test(mass.rows[1][1]);
    // copia del perno lontano: la distinta base lo conta
    await p.evaluate(() => { App.change(() => { const a = App.project.assembly, i = Assembly.addInst(a, 'p2', { pose: { p: [300, 0, 0], q: [1, 0, 0, 0] } }); void i; }); });
    await p.click('[data-cmd="bom"]'); await p.waitForTimeout(150);
    const bom = await p.evaluate(() => [...document.querySelectorAll('#asmBom tbody tr, #asmBom tfoot tr')].map(r => [...r.cells].map(x => x.textContent)));
    await p.screenshot({ path: path.join(OUT, 'assieme-distinta.png') });
    await p.click('#modalActions .btn-primary');
    const okBom = bom.length === 3 && bom[0][1] === 'Piastra' && bom[0][3] === '1' && bom[1][1] === 'Perno' && bom[1][3] === '2' && Math.abs(num(bom[1][5]) - 2 * mb) < 0.006 && bom[2][3] === '3' && Math.abs(num(bom[2][5]) - (ma + 2 * mb)) < 0.006;
    // perno uguale al foro: nessuna interferenza
    const calc = async () => { await p.click('#asmIntRun'); await p.waitForFunction(() => document.querySelector('#asmIntSum'), null, { timeout: 30000 }); await p.waitForTimeout(100); return p.evaluate(() => ({ sum: document.querySelector('#asmIntSum').textContent, rows: [...document.querySelectorAll('#pm .asm-int')].map(b => b.textContent), pressed: [...document.querySelectorAll('#pm .asm-int')].map(b => b.getAttribute('aria-pressed')) })); };
    await p.click('[data-cmd="interf"]'); await p.waitForTimeout(150);
    const r0 = await calc(), red0 = await p.evaluate(() => __red());
    await p.evaluate(() => App.closePM(false));
    // perno R 10,5: la corona π(10,5² − 10²)·10 = 322,013 mm³
    await p.evaluate(() => { App.change(() => { const c = App.project.parts[1].doc.features[0].sk.ents.find(e => e.t === 'ci'); c.r = 10.5; }); });
    await p.waitForTimeout(150);
    await p.click('[data-cmd="interf"]'); await p.waitForTimeout(150);
    const r1 = await calc(), red1 = await p.evaluate(() => __red());
    await p.screenshot({ path: path.join(OUT, 'assieme-interferenza.png') });
    const clip = await p.evaluate(() => App.pm ? 1 : 0);
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    const after = await p.evaluate(() => ({ pm: !!App.pm, red: __red() }));
    // i comandi sull'assieme vuoto e con un componente solo non aprono niente di rotto
    await p.evaluate(() => { App.change(() => { const a = App.project.assembly; a.insts = a.insts.slice(0, 1); a.mates = []; }); });
    await p.click('[data-cmd="interf"]'); await p.waitForTimeout(100);
    const alone = await p.evaluate(() => !App.pm);
    const okInt = /Nessuna interferenza su 3 coppie/.test(r0.sum) && !r0.rows.length && red0 < 60 && /1 interferenza su 3 coppie/.test(r1.sum) && r1.rows.length === 1 && /Piastra<1> e Perno<1>: 322,013 mm³$/.test(r1.rows[0]) && r1.pressed[0] === 'true' && red1 > red0 + 2000 && clip === 1 && !after.pm && after.red < 60 && alone;
    await c.close();
    rec(ASMC1, okMass && okBom && okInt && !errs.length, `massa ${mass.kv.slice(0, 2).join(' / ')}, y ${mass.kv[4]} (attesi ${(ma + mb).toFixed(2)} g, ${(Va + Vb).toFixed(2)} mm³, ${((ma * 5 + mb * 15) / (ma + mb)).toFixed(3)}); distinta ${JSON.stringify(bom)}; prima «${r0.sum}» rossi ${red0}; poi «${r1.sum}» ${r1.rows.join()} rossi ${red1}; dopo Esc ${JSON.stringify(after)}; errori ${errs.join(' | ')}`);
  } catch (e) { rec(ASMC1, false, e.message.split('\n')[0]); }

  const ASMC2 = 'Assieme: Vista esplosa con il mouse (passo, trascinamento, automatica, Annulla, comprimi) e tavola con distinta, numeri di posizione e assonometria esplosa; PDF e DXF';
  try {
    const { c, p, errs, insert, clickW } = await asmSetup();
    await p.click('[data-ct="assembly"]'); await p.waitForTimeout(150);
    await insert('p1'); await insert('p2');
    await p.evaluate(() => { App.project.parts[0].doc.material = 's235'; App.project.parts[1].doc.material = 'al6082'; App.change(() => { App.project.assembly.insts[1].pose = { p: [40, 0, -25], q: [1, 0, 0, 0] }; }); App.r.fit(false); });
    await p.waitForTimeout(800);
    const scene = () => p.evaluate(() => { const b = App.st.bodies[1], mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (const q of b.polys) for (const v of q.v) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], v[k]); mx[k] = Math.max(mx[k], v[k]); } return { mn, mx, pose: App.project.assembly.insts[1].pose.p.slice(), pm: !!App.pm, steps: App.project.assembly.explode ? App.project.assembly.explode.steps.length : 0, ex: !!(App.project.assembly.explode && App.project.assembly.explode.on) }; });
    await p.click('[data-cmd="explode"]'); await p.waitForTimeout(200);
    await p.evaluate(() => App.r.fit(false)); await p.waitForTimeout(700);
    // clic sul perno (la cima, y 30), direzione Y, 40 mm: l'anteprima si muove, il passo si aggiunge, poi ✓
    await clickW([40, 30, -25]); await p.waitForTimeout(150);
    await p.click('[data-axis="Y"]');
    await p.fill('#expDist', '40'); await p.waitForTimeout(150);
    const prev = await scene();
    await p.click('#expAdd'); await p.waitForTimeout(150);
    const listed = await p.evaluate(() => document.querySelector('#expSteps').textContent);
    await p.click('.pm-ok'); await p.waitForFunction(() => !App.pm); await p.waitForTimeout(200);
    const s1 = await scene();
    await p.screenshot({ path: path.join(OUT, 'assieme-esplosa.png') });
    const tree = await p.evaluate(() => document.querySelector('.texplode').textContent);
    // Annulla toglie il passo; Ripeti lo rimette
    await p.evaluate(() => App.undo()); await p.waitForTimeout(150);
    const su = await scene();
    await p.evaluate(() => App.redo()); await p.waitForTimeout(150);
    const sr = await scene();
    // nell'albero comprime: si torna alla posizione vera, il passo resta; il trascinamento non sposta il pezzo con la vista esplosa
    await p.click('.texplode'); await p.waitForTimeout(150);
    const sc = await scene();
    await p.click('.texplode'); await p.waitForTimeout(150);
    // trascinare il componente nel pannello: la distanza segue il mouse lungo Y, nella misura vera
    await p.click('[data-cmd="explode"]'); await p.waitForTimeout(200);
    await clickW([40, 30 + 40, -25]); await p.waitForTimeout(100);
    await p.click('[data-axis="Y"]');
    await p.fill('#expDist', '10'); await p.waitForTimeout(150);
    const dragInfo = await p.evaluate(() => { const a = App.r.project([40, 80, -25]), b = App.r.project([40, 90, -25]), r = document.querySelector('#view').getBoundingClientRect(); return { x: a[0] + r.left, y: a[1] + r.top, px: Math.abs(b[1] - a[1]) / 10 }; });
    await p.mouse.move(dragInfo.x, dragInfo.y); await p.mouse.down(); await p.mouse.move(dragInfo.x, dragInfo.y - 30, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(150);
    const dist = await p.evaluate(() => parseFloat(document.querySelector('#expDist').value));
    // Esc annulla tutto il pannello
    await p.evaluate(() => App.closePM(false)); await p.waitForTimeout(150);
    const sa = await scene();
    // automatica
    await p.click('[data-cmd="explode"]'); await p.waitForTimeout(200);
    await p.click('[data-axis="Y"]');
    await p.fill('#expGap', '12');
    await p.click('#expAuto'); await p.waitForTimeout(150);
    await p.click('.pm-ok'); await p.waitForFunction(() => !App.pm); await p.waitForTimeout(150);
    const sAuto = await scene();
    // messa in tavola dell'assieme
    await p.click('[data-ct="drawing"]'); await p.waitForTimeout(500);
    const sheet = await p.evaluate(() => { const s = document.querySelector('#sheetHolder svg'), b = s.querySelector('[data-bom]'); return {
      mode: App.mode, isAsm: !!Drawing.assembly(), name: document.querySelector('#docName').value, off: document.querySelector('#docName').disabled, sel: document.querySelector('#partSel').value,
      bom: [...b.querySelectorAll('text')].map(t => t.textContent), balloons: [...s.querySelectorAll('[data-balloons] text')].map(t => t.textContent), lines: s.querySelectorAll('[data-explode] line').length,
      frame: [...s.querySelectorAll('text')].map(t => t.textContent).join('|'), box: [...s.querySelectorAll('[data-balloons] circle[r="4"]')].map(c => [+c.getAttribute('cx'), +c.getAttribute('cy')]), tip: [...s.querySelectorAll('[data-balloons] line')].map(l => [+l.getAttribute('x2'), +l.getAttribute('y2')]), W: +s.getAttribute('viewBox').split(' ')[2], H: +s.getAttribute('viewBox').split(' ')[3] }; });
    await p.screenshot({ path: path.join(OUT, 'assieme-tavola.png') });
    const pdf = await p.evaluate(async () => { await App.savePdf(); const b = App.lastPdf && (App.lastPdf.bytes || App.lastPdf); return { n: b ? b.length : 0, file: App.lastPdf && App.lastPdf.file }; });
    const dxf = await p.evaluate(() => Drawing.toDXF());
    // senza distinta e senza numeri: spariscono; dopo si torna all'assieme e alla parte: la parte ha la sua tavola
    const off = await p.evaluate(() => { const d = Drawing.state(); d.bom = false; d.balloons = false; d.exploded = false; Drawing.redraw(); const s = document.querySelector('#sheetHolder svg'); const r = { bom: !!s.querySelector('[data-bom]'), bal: !!s.querySelector('[data-balloons]'), expl: !!s.querySelector('[data-explode]') }; d.bom = true; d.balloons = true; d.exploded = true; return r; });
    // sezione dell'assieme montato, sul piano frontale a z = -25: i due pezzi tagliati insieme; con il tratteggio
    const sec = await p.evaluate(() => { const d = Drawing.state(); d.section = { view: 'front', plane: 'front', offset: -25, label: 'A' }; Drawing.redraw(); const s = document.querySelector('#sheetHolder svg'); const r = { txt: [...s.querySelectorAll('[data-view="front"] text')].map(t => t.textContent).join(), lines: s.querySelectorAll('[data-view="front"] line').length, shaded: 0 }; d.section = null; d.shaded = true; Drawing.redraw(); r.shaded = document.querySelectorAll('#sheetHolder [data-shade] polygon').length; d.shaded = false; Drawing.redraw(); return r; });
    await p.click('[data-ct="assembly"]'); await p.waitForTimeout(300);
    const back = await p.evaluate(() => ({ mode: App.mode, name: document.querySelector('#docName').value, off: document.querySelector('#docName').disabled, drawing: !!App.project.assembly.drawing }));
    await p.evaluate(() => App.openPart('p1')); await p.waitForTimeout(200);
    await p.click('[data-ct="drawing"]'); await p.waitForTimeout(400);
    const part = await p.evaluate(() => { const s = document.querySelector('#sheetHolder svg'); return { isAsm: !!Drawing.assembly(), bom: !!s.querySelector('[data-bom]'), bal: !!s.querySelector('[data-balloons]'), name: document.querySelector('#docName').value, off: document.querySelector('#docName').disabled }; });
    await p.click('[data-ct="features"]'); await p.waitForTimeout(100);
    await c.close();
    const document_ok = x => x.shaded > 10;
    const nearN = (a, b, t = 1e-6) => Math.abs(a - b) <= t;
    const okExp = nearN(prev.mn[1], 40) && nearN(prev.mx[1], 70) && prev.pose[1] === 0 && /Perno<1>: Y \+40,00 mm/.test(listed) && s1.steps === 1 && s1.ex && nearN(s1.mn[1], 40) && s1.pose[1] === 0 && /1 passo/.test(tree)
      && su.steps === 0 && nearN(su.mn[1], 0) && sr.steps === 1 && nearN(sr.mn[1], 40) && !sc.ex && nearN(sc.mn[1], 0) && sc.steps === 1 && nearN(dist, 10 + 30 / dragInfo.px, 0.02) && sa.steps === 1 && nearN(sa.mn[1], 40) && sa.ex;
    // automatica: piastra y 0..10, perno y 0..30: centri 5 e 15; perno da 0 a 10 + 12: 22
    const okAuto = sAuto.steps === 1 && nearN(sAuto.mn[1], 22) && sAuto.ex;
    const inside = sheet.box.every(q => q[0] > 20 + 4 && q[0] < sheet.W - 10 - 4 && q[1] > 10 + 4 && q[1] < sheet.H - 10 - 4);
    const okSheet = sheet.mode === 'drawing' && sheet.isAsm && sheet.name === 'Assieme1' && sheet.off && sheet.sel === 'asm' && sheet.bom.join('|') === 'Pos.|Denominazione|Materiale|Q.tà|Massa cad. (g)|1|Piastra|Acciaio S235JR|1|289,34|2|Perno|Alluminio EN AW-6082|1|25,45'
      && sheet.balloons.join() === '1,2' && sheet.lines === 1 && inside && /Vedi la distinta base/.test(sheet.frame) && /314,79 g/.test(sheet.frame) && /Assieme1/.test(sheet.frame) && /A–A/.test(sec.txt) && sec.lines > 10 && document_ok(sec) && pdf.n > 1000 && /Assieme1-tavola\.pdf/.test(pdf.file || '')
      && /\nDenominazione\r?\n/.test(dxf) && /\nPiastra\r?\n/.test(dxf) && /\nAcciaio S235JR\r?\n/.test(dxf) && !off.bom && !off.bal && !off.expl && back.mode === 'assembly' && !back.off && back.name === 'Assieme1' && back.drawing && !part.isAsm && !part.bom && !part.bal && part.name !== 'Assieme1' && !part.off;
    rec(ASMC2, okExp && okAuto && okSheet && !errs.length, `anteprima y ${prev.mn[1]}..${prev.mx[1]}, vero ${prev.pose[1]}; «${listed}»; dopo ✓ ${s1.mn[1]}; «${tree}»; annulla ${su.steps}/${su.mn[1]}; ripeti ${sr.steps}/${sr.mn[1]}; comprimi ${sc.ex}/${sc.mn[1]}; trascinato ${dist} (atteso ${(10 + 30 / dragInfo.px).toFixed(3)}); Esc ${sa.steps}/${sa.mn[1]}; automatica ${sAuto.steps}/${sAuto.mn[1]}; tavola ${JSON.stringify({ ...sheet, frame: undefined })}; pdf ${JSON.stringify(pdf)}; dxf ${dxf.length}; spenti ${JSON.stringify(off)}; sezione ${JSON.stringify(sec)}; ritorno ${JSON.stringify(back)}; parte ${JSON.stringify(part)}; errori ${errs.join(' | ')}`);
  } catch (e) { rec(ASMC2, false, e.message.split('\n')[0]); }

  const ASMC3 = 'Viti e bulloni con il mouse: finestra, due viti uguali = una parte e quantità 2, dado, misure; filetto indicato in tavola (ISO 6410) con le misure a mano; interferenza «filetto»';
  try {
    const { c, p, errs, insert } = await asmSetup();
    await p.click('[data-ct="assembly"]'); await p.waitForTimeout(150);
    await insert('p1');
    const pickFast = async (type, size, len) => { await p.click('[data-cmd="fastener"]'); await p.waitForTimeout(120); await p.selectOption('#fsType', type); await p.selectOption('#fsSize', size); if (len) await p.selectOption('#fsLen', String(len)); const info = await p.evaluate(() => ({ name: document.querySelector('#fsInfo').textContent, lenHidden: document.querySelector('#fsLenRow').hidden, n: document.querySelector('#fsLen').options.length })); await p.click('#modalActions .btn-primary'); await p.waitForTimeout(200); return info; };
    const i1 = await pickFast('iso4762', 'M6', 20);
    const i2 = await pickFast('iso4762', 'M6', 20);
    const i3 = await pickFast('iso4032', 'M10');
    const i4 = await pickFast('iso4014', 'M10', 60);
    const proj = await p.evaluate(() => ({ parts: App.project.parts.map(q => q.doc.name), insts: App.project.assembly.insts.length, sel: [...document.querySelectorAll('#partSel option')].map(o => o.textContent), lines: App.asm.threadsNow().length }));
    await p.click('[data-cmd="bom"]'); await p.waitForTimeout(120);
    const bom = await p.evaluate(() => [...document.querySelectorAll('#asmBom tbody tr')].map(r => [...r.cells].map(x => x.textContent)));
    await p.click('#modalActions .btn-primary');
    // bullone nel dado: filetto; Annulla toglie il componente
    await p.evaluate(() => { App.change(() => { const a = App.project.assembly, I = a.insts; I[0].pose = { p: [500, 0, 0], q: [1, 0, 0, 0] }; I[1].pose = { p: [700, 0, 0], q: [1, 0, 0, 0] }; I[2].pose = { p: [900, 0, 0], q: [1, 0, 0, 0] }; I[3].pose = { p: [0, 0, 0], q: [1, 0, 0, 0] }; I[4].pose = { p: [0, 60, 0], q: Assembly.qexp([0, 0.0713, 0]) }; }); });
    await p.waitForTimeout(150);
    await p.click('[data-cmd="interf"]'); await p.waitForTimeout(120);
    await p.click('#asmIntRun'); await p.waitForFunction(() => document.querySelector('#asmIntSum'), null, { timeout: 30000 }); await p.waitForTimeout(100);
    const inter = await p.evaluate(() => ({ rows: [...document.querySelectorAll('#pm .asm-int')].map(b => b.textContent), note: document.querySelector('#asmIntRes').textContent }));
    await p.screenshot({ path: path.join(OUT, 'assieme-viti.png') });
    await p.evaluate(() => App.closePM(false));
    // la vite da sola, nella sua tavola: righe sottili a ±d3/2, lunghe quanto il filetto; 3/4 di cerchio nella vista dal basso; fine filetto
    await p.evaluate(() => { const id = App.project.parts.find(q => q.doc.name === 'Vite TCEI ISO 4762 M6×20').id; App.openPart(id); }); await p.waitForTimeout(200);
    const docInfo = await p.evaluate(() => ({ features: App.doc.features.map(f => f.type), material: App.doc.material, err: App.st.errors.size, mass: Model.massProperties(App.st, App.doc).mass }));
    await p.click('[data-ct="drawing"]'); await p.waitForTimeout(300);
    const dr = await p.evaluate(() => { const d = Drawing.state(); d.views.bottom = true; d.scale = '2:1'; d.views.iso = false; Drawing.redraw(); const s = document.querySelector('#sheetHolder svg'); const q = id => s.querySelector(`[data-view="${id}"]`); const L = g => [...g.querySelectorAll('[data-thread] line')].map(l => [+l.getAttribute('x1'), +l.getAttribute('y1'), +l.getAttribute('x2'), +l.getAttribute('y2')]); const A = g => [...g.querySelectorAll('[data-thread] path, [data-thread] circle')].map(a => a.getAttribute('d') || a.getAttribute('r')); const out = { front: L(q('front')), arcsBottom: A(q('bottom')), arcsTop: q('top') ? A(q('top')) : [] }; out.dxf = Drawing.toDXF(); return out; });
    await p.screenshot({ path: path.join(OUT, 'vite-tavola.png') });
    await p.click('[data-ct="features"]'); await p.waitForTimeout(100);
    await c.close();
    const fl = dr.front;
    const xs = fl.map(l => l[0]).sort((a, b) => a - b), len = fl.length ? Math.abs(fl[0][3] - fl[0][1]) : 0;
    const okLines = fl.length === 2 && Math.abs(xs[1] - xs[0] - (6 - 1.22687) * 2) < 0.002 && Math.abs(len - 20 * 2) < 0.002 && fl[0][0] === fl[0][2];
    const arcR = dr.arcsBottom.length === 1 ? parseFloat(/^M[\d. \-]+A([\d.]+)/.exec(dr.arcsBottom[0])[1]) : 0;
    const okArc = Math.abs(arcR - (6 - 1.22687)) < 0.002 && /A[\d.]+ [\d.]+ 0 1 0/.test(dr.arcsBottom[0]) && dr.arcsTop.length === 0;
    const ok = i1.name === 'Vite TCEI ISO 4762 M6×20' && !i1.lenHidden && i3.name === 'Dado ISO 4032 M10' && i3.lenHidden && /ISO 4014 M10×60/.test(i4.name) && proj.parts.length === 5 && proj.insts === 5 && proj.sel.some(t => /Vite TCEI/.test(t)) && proj.lines === 4
      && bom.length === 4 && bom[1][1] === 'Vite TCEI ISO 4762 M6×20' && bom[1][3] === '2' && /S235/.test(bom[1][2]) && inter.rows.length === 1 && / \(filetto\)$/.test(inter.rows[0]) && /Dado ISO 4032 M10<1> e Vite TE ISO 4014 M10×60<1>/.test(inter.rows[0]) && /183,076 mm³/.test(inter.rows[0]) && /non è un errore/.test(inter.note)
      && docInfo.err === 0 && docInfo.features.includes('revolve') && docInfo.features.includes('cut') && okLines && okArc && /\nFILETTI\r?\n/.test(dr.dxf);
    rec(ASMC3, ok && !errs.length, `${JSON.stringify(i1)} ${JSON.stringify(i3)}; ${JSON.stringify(proj)}; distinta ${JSON.stringify(bom)}; ${inter.rows.join()}; ${JSON.stringify(docInfo)}; righe ${JSON.stringify(fl)} (distanza attesa ${((6 - 1.22687) * 2).toFixed(3)}, lunghezza 40); archi basso ${JSON.stringify(dr.arcsBottom)}, r ${arcR}; alto ${dr.arcsTop.length}; errori ${errs.join(' | ')}`);
  } catch (e) { rec(ASMC3, false, e.message.split('\n')[0]); }

  const ASMC5 = 'Assieme, lavori del 4 novembre pomeriggio: flessibile con il mouse, interferenze dentro, albero sopra la vista, CSV, direzione da una faccia, numeri trascinati, vite nel foro, filetti in sezione';
  try {
    const { c, p, errs, insert } = await asmSetup();
    const dls = [];
    await p.evaluate(() => {
      const mk = (name, L, W, H) => ({ id: 'q' + name, doc: (() => { const d = Model.newDoc(); d.name = name; const k = Sketch.newSketch(); const pt = (x, y) => { const id = 'p' + (k.next++); k.ents.push({ id, t: 'pt', x, y }); return id; }; const P = [pt(0, 0), pt(L, 0), pt(L, W), pt(0, W)]; P.forEach((id, i) => k.ents.push({ id: 'l' + (k.next++), t: 'ln', a: id, b: P[(i + 1) % 4] })); d.features.push({ id: 'F1', name: 'Schizzo1', type: 'sketch', plane: { kind: 'std', id: 'top' }, sk: k }); d.features.push({ id: 'F2', name: 'Estrusione1', type: 'extrude', sketch: 'F1', end: 'blind', depth: H }); d.material = 's235'; return d; })(), drawing: null });
      App.syncActive && App.syncActive();
      App.project.parts.push(mk('Base', 100, 40, 10), mk('Cursore', 20, 40, 10), mk('Muro', 10, 40, 50));
    });
    await p.click('[data-ct="assembly"]'); await p.waitForTimeout(150);
    // il gruppo: base fissa e cursore che scorre
    await p.click('[data-cmd="newAsm"]'); await p.waitForTimeout(200);
    await insert('qBase'); await insert('qCursore');
    const grp = await p.evaluate(() => {
      const a = App.project.assembly, inf = App.asm.infos, I = a.insts, F = (i, n, w) => inf.get(i.part).st.tags.list.find(t => t.kind === 'plane' && Math.abs(t.n[0] - n[0]) + Math.abs(t.n[1] - n[1]) + Math.abs(t.n[2] - n[2]) < 1e-9 && Math.abs(t.w - w) < 1e-9).name;
      App.change(() => {
        I[1].pose = { p: [10, 10, 0], q: [1, 0, 0, 0] };
        a.mates.push({ id: 'M90', name: 'Coincidente1', type: 'coincident', a: { inst: I[0].id, k: 'face', name: F(I[0], [0, 1, 0], 10) }, b: { inst: I[1].id, k: 'face', name: F(I[1], [0, -1, 0], 0) }, s: -1, side: 1, value: 0 });
        a.mates.push({ id: 'M91', name: 'Coincidente2', type: 'coincident', a: { inst: I[0].id, k: 'face', name: F(I[0], [0, 0, 1], 0) }, b: { inst: I[1].id, k: 'face', name: F(I[1], [0, 0, 1], 0) }, s: 1, side: 1, value: 0 });
      });
      return { id: a.id, cur: I[1].id, xp: F(I[1], [1, 0, 0], 20) };
    });
    await p.waitForTimeout(150);
    // nuovo assieme: il gruppo dentro, flessibile dal menu; il muro lo ferma
    await p.click('[data-cmd="newAsm"]'); await p.waitForTimeout(200);
    await p.click('[data-cmd="insertPart"]'); await p.waitForTimeout(100);
    await p.click(`#asmParts [data-part="${grp.id}"]`); await p.waitForTimeout(250);
    await insert('qMuro');
    await p.click('.tinst >> nth=0', { button: 'right' }); await p.waitForTimeout(100);
    const menu = await p.evaluate(() => [...document.querySelectorAll('.ctx button, .ctxmenu button, #ctx button')].map(b => b.textContent));
    await p.locator('button', { hasText: 'Rendi flessibile' }).click(); await p.waitForTimeout(250);
    const tree = await p.evaluate(() => document.querySelector('.tinst').textContent);
    await p.evaluate(({ grp }) => {
      const a = App.project.assembly, S = a.insts[0], W = a.insts[1], inf = App.asm.infos;
      const wf = inf.get(W.part).st.tags.list.find(t => t.kind === 'plane' && t.n[0] === -1).name;
      App.change(() => { W.fixed = true; W.pose = { p: [190, 0, 0], q: [1, 0, 0, 0] }; a.mates.push({ id: 'M92', name: 'Coincidente1', type: 'coincident', a: { inst: S.id, k: 'face', name: grp.cur + '/' + grp.xp }, b: { inst: W.id, k: 'face', name: wf }, s: -1, side: 1, value: 0 }); });
    }, { grp });
    await p.waitForTimeout(250);
    const flexPos = await p.evaluate(({ grp }) => { const st = App.st, mx = []; for (const q of st.body) if (st.tags.get(q.t).name.startsWith(st.bodies[0].id + '/' + grp.cur + '/')) for (const v of q.v) mx.push(v[0]); return { hi: Math.max(...mx), lo: Math.min(...mx), ok: App.asm.last.ok, orig: App.project.others.find(x => x.id === grp.id).insts[1].pose.p[0] }; }, { grp });
    // trascinato con il mouse dopo aver tolto il legame: si sposta il cursore
    await p.evaluate(() => { App.change(() => { const a = App.project.assembly; a.mates = []; a.insts[1].pose = { p: [400, 0, 0], q: [1, 0, 0, 0] }; }); App.r.fit(); }); await p.waitForTimeout(200);
    const dragPts = await p.evaluate(({ grp }) => { const st = App.st, r = document.querySelector('#view').getBoundingClientRect(); const S = App.project.assembly.insts[0]; const c = Assembly.toWorld(S.pose, [80, 20, -20]); const b = Assembly.toWorld(S.pose, [80, 20, -20]); let pts = []; for (const q of st.body) if (st.tags.get(q.t).name.startsWith(S.id + '/' + grp.cur + '/') && st.tags.get(q.t).n && st.tags.get(q.t).n[1] > 0.9) { pts = q.v; break; } const m = [0, 1, 2].map(k => pts.reduce((s, v) => s + v[k], 0) / pts.length), s = App.r.project(m); return { x: r.left + s[0], y: r.top + s[1], m }; }, { grp });
    await p.mouse.move(dragPts.x, dragPts.y); await p.mouse.down(); await p.mouse.move(dragPts.x + 40, dragPts.y, { steps: 5 }); await p.waitForTimeout(100); await p.mouse.up(); await p.waitForTimeout(200);
    const flexDrag = await p.evaluate(({ grp }) => { const st = App.st, S = App.project.assembly.insts[0], ys = [], xs = []; for (const q of st.body) { const n = st.tags.get(q.t).name; if (n.startsWith(S.id + '/' + grp.cur + '/')) for (const v of q.v) { ys.push(v[1]); xs.push(v[0]); } } return { lo: Math.min(...xs), yl: Math.min(...ys), yh: Math.max(...ys), base: st.body.filter(q => !st.tags.get(q.t).name.startsWith(S.id + '/' + grp.cur + '/') && st.tags.get(q.t).name.startsWith(S.id + '/')).flatMap(q => q.v.map(v => v[0])).reduce((a, b) => Math.min(a, b), Infinity) }; }, { grp });
    // interferenze dentro: cursore affondato nell'assieme gruppo; la casella lo tratta come un blocco
    await p.evaluate(({ grp }) => { const A = App.project.others.find(x => x.id === grp.id); App.change(() => { A.mates = []; A.insts[1].pose = { p: [10, 7, 0], q: [1, 0, 0, 0] }; const S = App.project.assembly.insts[0]; delete S.flexible; delete S.flex; const W = App.project.assembly.insts[1]; W.pose = { p: [400, 0, 0], q: [1, 0, 0, 0] }; }); }, { grp });
    await p.waitForTimeout(250);
    await p.click('[data-cmd="interf"]'); await p.waitForTimeout(120);
    await p.click('#asmIntRun'); await p.waitForFunction(() => document.querySelector('#asmIntSum'), null, { timeout: 30000 }); await p.waitForTimeout(100);
    const intDeep = await p.evaluate(() => [...document.querySelectorAll('#pm .asm-int')].map(b => b.textContent));
    await p.check('#asmIntWhole'); await p.click('#asmIntRun'); await p.waitForTimeout(300); await p.waitForFunction(() => document.querySelector('#asmIntSum'), null, { timeout: 30000 }); await p.waitForTimeout(100);
    const intWhole = await p.evaluate(() => [...document.querySelectorAll('#pm .asm-int')].map(b => b.textContent));
    await p.evaluate(() => App.closePM(false));
    // albero sopra la vista: piano frontale del primo componente, origine del secondo
    await p.click('[data-cmd="mate"]'); await p.waitForTimeout(200);
    const flyShown = await p.evaluate(() => !!document.querySelector('#asmFly') && !!document.querySelector('[data-fly-inst]'));
    await p.click('[data-fly-inst] >> nth=1'); await p.waitForTimeout(80);
    const flyRows = await p.evaluate(() => [...document.querySelectorAll('[data-fly-datum]')].map(b => b.textContent));
    await p.click('[data-fly-datum="origin"]'); await p.waitForTimeout(150);
    const flyPicked = await p.evaluate(() => [...document.querySelectorAll('#pm .selbox .chip')].map(x => x.textContent));
    await p.screenshot({ path: path.join(OUT, 'assieme-albero-comparsa.png') });
    await p.evaluate(() => App.closePM(false)); await p.waitForTimeout(80);
    const flyGone = await p.evaluate(() => !document.querySelector('#asmFly'));
    // distinta in CSV
    await p.exposeFunction('__csv', t => dls.push(t));
    await p.evaluate(() => { const o = App.offerFile; App.offerFile = (n, m, d) => { window.__csv(JSON.stringify([n, m, d])); }; App.__offer = o; });
    await p.click('[data-cmd="bom"]'); await p.waitForTimeout(100);
    await p.locator('#modalActions button', { hasText: 'Salva CSV' }).click(); await p.waitForTimeout(150);
    await p.evaluate(() => { App.offerFile = App.__offer; if (App.closeModal) App.closeModal(); const m = document.querySelector('#modalActions .btn-primary'); if (m && m.offsetParent) m.click(); });
    const csv = JSON.parse(dls[0] || '["","",""]');
    // esplosione lungo una faccia: la faccia alta del muro girato di 30°
    await p.evaluate(() => { App.change(() => { const W = App.project.assembly.insts[1]; W.pose = { p: [400, 0, 0], q: Assembly.qexp([0, 0, Math.PI / 6]) }; W.fixed = true; }); App.r.fit(); }); await p.waitForTimeout(200);
    await p.click('[data-cmd="explode"]'); await p.waitForTimeout(150);
    await p.click('#expFace'); await p.waitForTimeout(80);
    const topPt = await p.evaluate(() => { const st = App.st, W = App.project.assembly.insts[1], r = document.querySelector('#view').getBoundingClientRect(), n = Assembly.dirWorld(W.pose, [0, 1, 0]); const q = st.body.find(x => { const t = st.tags.get(x.t); return t.inst === W.id && t.n && Math.abs(t.n[0] - n[0]) + Math.abs(t.n[1] - n[1]) < 1e-9; }); const m = [0, 1, 2].map(k => q.v.reduce((s, v) => s + v[k], 0) / q.v.length), s = App.r.project(m); return { x: r.left + s[0], y: r.top + s[1], n }; });
    await p.mouse.click(topPt.x, topPt.y); await p.waitForTimeout(120);
    const expMsg = await p.evaluate(() => (document.querySelector('#expFaceMsg') || {}).textContent);
    await p.mouse.click(topPt.x, topPt.y); await p.waitForTimeout(120);
    await p.fill('#expDist', '30'); await p.waitForTimeout(80);
    await p.click('#expAdd'); await p.waitForTimeout(100);
    const expStep = await p.evaluate(() => ({ d: App.project.assembly.explode.steps[0].dir, t: document.querySelector('#expSteps').textContent }));
    await p.evaluate(() => App.closePM(true)); await p.waitForTimeout(150);
    // tavola: un numero trascinato con il mouse, salvato, rimesso a posto
    await p.click('[data-ct="drawing"]'); await p.waitForTimeout(350);
    const bl = await p.evaluate(() => { const c = document.querySelector('#sheetHolder svg circle[r="4"]'), r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, cx: +c.getAttribute('cx'), cy: +c.getAttribute('cy'), k: r.width / 8 }; });
    await p.mouse.move(bl.x, bl.y); await p.mouse.down(); await p.mouse.move(bl.x + 20 * bl.k, bl.y + 10 * bl.k, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(200);
    const bl2 = await p.evaluate(() => { const c = document.querySelector('#sheetHolder svg circle[r="4"]'); const all = [...document.querySelectorAll('#sheetHolder svg circle[r="4"]')].map(x => [+x.getAttribute('cx'), +x.getAttribute('cy')]); return { all, saved: Object.keys(Drawing.state().balloonPos || {}).length }; });
    const moved = bl2.all.some(q => Math.abs(q[0] - bl.cx - 20) < 0.5 && Math.abs(q[1] - bl.cy - 10) < 0.5);
    await p.click('#dBalloonReset'); await p.waitForTimeout(200);
    const bl3 = await p.evaluate(() => [...document.querySelectorAll('#sheetHolder svg circle[r="4"]')].map(x => [+x.getAttribute('cx'), +x.getAttribute('cy')]));
    await p.click('[data-ct="assembly"]'); await p.waitForTimeout(200);
    // vite nel foro con il mouse: piastra con foro, clic sulla parete; poi sezione nella tavola
    await p.evaluate(() => { const k = Sketch.newSketch(), d = Model.newDoc(); d.name = 'Piastra'; d.material = 's235'; const pt = (x, y) => { const id = 'p' + (k.next++); k.ents.push({ id, t: 'pt', x, y }); return id; }; const P = [pt(0, 0), pt(80, 0), pt(80, 50), pt(0, 50)]; P.forEach((id, i) => k.ents.push({ id: 'l' + (k.next++), t: 'ln', a: id, b: P[(i + 1) % 4] })); k.ents.push({ id: 'c' + (k.next++), t: 'ci', c: pt(40, 25), r: 3.3 }); d.features.push({ id: 'F1', name: 'Schizzo1', type: 'sketch', plane: { kind: 'std', id: 'top' }, sk: k }); d.features.push({ id: 'F2', name: 'Estrusione1', type: 'extrude', sketch: 'F1', end: 'blind', depth: 10 }); App.project.parts.push({ id: 'qPiastra', doc: d, drawing: null }); });
    await p.click('[data-cmd="newAsm"]'); await p.waitForTimeout(200);
    await insert('qPiastra');
    await p.evaluate(() => { const a = App.r; a.setView && a.setView(GLView.Renderer.normalQ ? a.cam.q : a.cam.q); App.r.fit(); }); await p.waitForTimeout(150);
    await p.click('[data-cmd="holeFast"]'); await p.waitForTimeout(150);
    const wallPt = await p.evaluate(() => {
      // un punto della parete del foro che si vede davvero: si prova attorno al foro finché la vista dà quella faccia
      const r = document.querySelector('#view').getBoundingClientRect(), st = App.st, I = App.project.assembly.insts[0];
      for (let y = 9.5; y > 0; y -= 0.5) for (let a = 0; a < 6.3; a += 0.2) { const w = Assembly.toWorld(I.pose, [40 + 3.3 * Math.cos(a), y, -25 + 3.3 * Math.sin(a)]), s = App.r.project(w), f = App.r.pickFace(s[0], s[1]); if (f && st.tags.get(st.body[f.poly].t).kind === 'rev') { const c = f.point; if (c[1] > 5) return { x: r.left + s[0], y: r.top + s[1] }; } }
      return null;
    });
    await p.mouse.click(wallPt.x, wallPt.y); await p.waitForTimeout(200);
    const dlg = await p.evaluate(() => ({ size: document.querySelector('#fsSize').value, info: document.querySelector('#fsHole').textContent, chamfer: document.querySelector('#fsChamfer').checked }));
    await p.selectOption('#fsLen', '30'); await p.locator('#modalActions button', { hasText: 'Inserisci' }).click(); await p.waitForTimeout(300);
    const hole = await p.evaluate(() => { const a = App.project.assembly, V = a.insts[1], r = App.asm.last; return { n: a.insts.length, mates: a.mates.map(m => m.type), ok: r.ok, y: V.pose.p[1], x: V.pose.p[0], z: V.pose.p[2], dof: r.dof.total, name: App.project.parts.find(q => q.id === V.part).doc.name, chamfer: App.project.parts.find(q => q.id === V.part).doc.fastener.chamfer }; });
    const undoN = await p.evaluate(() => { App.undo(); return App.project.assembly.insts.length + ':' + App.project.assembly.mates.length; }); await p.waitForTimeout(150);
    await p.evaluate(() => App.redo()); await p.waitForTimeout(200);
    await p.click('[data-ct="drawing"]'); await p.waitForTimeout(350);
    const sec = await p.evaluate(() => { const d = Drawing.state(); d.views.iso = false; d.scale = '1:1'; d.section = { view: 'front', plane: 'front', offset: -25, label: 'A' }; Drawing.invalidate && Drawing.invalidate(); Drawing.redraw(); const s = document.querySelector('#sheetHolder svg'); const L = [...s.querySelectorAll('[data-view="front"] [data-thread] line')].map(l => [+l.getAttribute('x1'), +l.getAttribute('y1'), +l.getAttribute('x2'), +l.getAttribute('y2')]); return { L, hatch: !!s.querySelector('[data-view="front"]') }; });
    await p.screenshot({ path: path.join(OUT, 'assieme-filetto-sezione.png') });
    await p.click('[data-ct="assembly"]'); await p.waitForTimeout(100);
    await c.close();
    const d3 = 6 - 1.22687, k = 6;
    const xs = sec.L.map(l => l[0]).sort((a, b) => a - b), span = xs.length ? xs[xs.length - 1] - xs[0] : 0;
    const secOk = sec.L.length === 2 && Math.abs(span - d3) < 0.01 && Math.abs(Math.abs(sec.L[0][3] - sec.L[0][1]) - 24) < 0.01;
    const ok = menu.join().length >= 0 && /flessibile/.test(tree) && Math.abs(flexPos.hi - 190) < 1e-6 && Math.abs(flexPos.lo - 170) < 1e-6 && flexPos.ok && Math.abs(flexPos.orig - 10) < 1e-9
      && flexDrag.lo > 170 + 1 && Math.abs(flexDrag.yl - 10) < 1e-6 && Math.abs(flexDrag.yh - 20) < 1e-6 && Math.abs(flexDrag.base) < 1e-6
      && intDeep.length === 1 && /Base<1>.*Cursore<1>.*2\.?400/.test(intDeep[0]) && intWhole.length === 0
      && flyShown && flyRows.length === 4 && flyPicked.length === 1 && /Origine di Muro/.test(flyPicked[0]) && flyGone
      && /distinta base\.csv$/.test(csv[0]) && csv[2].charCodeAt(0) === 0xFEFF && /N\.;Parte;Materiale/.test(csv[2]) && /Base;.*;1;.*,/.test(csv[2])
      && /\(/.test(expMsg || '') && Math.abs(expStep.d[0] + Math.sin(Math.PI / 6)) < 1e-9 && Math.abs(expStep.d[1] - Math.cos(Math.PI / 6)) < 1e-9
      && moved && bl2.saved === 1 && bl3.some(q => Math.abs(q[0] - bl.cx) < 1e-6 && Math.abs(q[1] - bl.cy) < 1e-6)
      && dlg.size === 'M6' && dlg.chamfer && /Ø6,6/.test(dlg.info) && hole.n === 2 && hole.mates.join() === 'concentric,coincident' && hole.ok && Math.abs(hole.y - 16) < 1e-6 && Math.abs(hole.x - 40) < 1e-6 && Math.abs(hole.z + 25) < 1e-6 && hole.chamfer === true && undoN === '1:0' && secOk;
    rec(ASMC5, ok && !errs.length, JSON.stringify({ menu, tree, flexPos, flexDrag, intDeep, intWhole, flyShown, flyRows, flyPicked, flyGone, csv: csv[0], csvT: csv[2].slice(0, 90), expMsg, expStep, moved, bl2, dlg, hole, undoN, sec: sec.L, errs }));
  } catch (e) { rec(ASMC5, false, e.message.split('\n')[0]); }

  const ASMC4 = 'Più assiemi e sottoassiemi con il mouse; piani e origine scelti nella vista; salvato e riletto; eliminazione';
  try {
    const { c, p, errs, insert } = await asmSetup();
    await p.click('[data-ct="assembly"]'); await p.waitForTimeout(150);
    await insert('p1'); await insert('p2');
    const first = await p.evaluate(() => App.project.assembly.name);
    // piani e origine nella vista: casella, clic sull'origine del secondo componente e su un bordo di piano del primo
    await p.click('[data-cmd="mate"]'); await p.waitForTimeout(200);
    await p.check('#asmDatumShow'); await p.waitForTimeout(100);
    const scr = await p.evaluate(() => { const a = App.project.assembly, r = document.querySelector('#view').getBoundingClientRect(), I = a.insts[1], q = App.r.project(Assembly.toWorld(I.pose, [0, 0, 0])); return [q[0] + r.left, q[1] + r.top]; });
    await p.mouse.move(scr[0], scr[1]); await p.waitForTimeout(80); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(150);
    const picked = await p.evaluate(() => [...document.querySelectorAll('#pm .selbox .chip')].map(x => x.textContent));
    await p.evaluate(() => App.closePM(false));
    // nuovo assieme, con un componente; ritorno; il primo lo usa come sottoassieme
    await p.click('[data-cmd="newAsm"]'); await p.waitForTimeout(200);
    const second = await p.evaluate(() => ({ name: App.project.assembly.name, n: App.project.assembly.insts.length, others: App.project.others.length, sel: document.querySelector('#partSel').value, list: [...document.querySelectorAll('#partSel option')].map(o => o.textContent) }));
    await insert('p2');
    const id2 = await p.evaluate(() => App.project.assembly.id);
    const id1 = await p.evaluate(() => App.project.others[0].id);
    await p.selectOption('#partSel', 'asm:' + id1); await p.waitForTimeout(200);
    const back1 = await p.evaluate(() => ({ name: App.project.assembly.name, n: App.project.assembly.insts.length, undo: App.undoStack.length }));
    await p.click('[data-cmd="insertPart"]'); await p.waitForTimeout(100);
    const listed = await p.evaluate(() => [...document.querySelectorAll('#asmParts [data-part]')].map(b => b.textContent));
    await p.click(`#asmParts [data-part="${id2}"]`); await p.waitForTimeout(250);
    const withSub = await p.evaluate(() => ({ tree: [...document.querySelectorAll('.tinst')].map(x => x.textContent), n: App.st.bodies.length }));
    await p.click('[data-cmd="bom"]'); await p.waitForTimeout(120);
    const bom = await p.evaluate(() => [...document.querySelectorAll('#asmBom tbody tr')].map(r => [...r.cells].map(x => x.textContent)));
    await p.click('#modalActions .btn-primary');
    // da dentro il secondo, il primo non si può inserire: lo conterrebbe
    await p.selectOption('#partSel', 'asm:' + id2); await p.waitForTimeout(200);
    await p.click('[data-cmd="insertPart"]'); await p.waitForTimeout(100);
    const noCycle = await p.evaluate(() => [...document.querySelectorAll('#asmParts [data-part]')].map(b => b.textContent));
    await p.click('#modalActions button'); await p.waitForTimeout(80);
    // tavola con il sottoassieme, salvataggio e rilettura
    await p.selectOption('#partSel', 'asm:' + id1); await p.waitForTimeout(200);
    await p.click('[data-ct="drawing"]'); await p.waitForTimeout(400);
    const sheet = await p.evaluate(() => { const s = document.querySelector('#sheetHolder svg'); return { balloons: [...s.querySelectorAll('[data-balloons] text')].map(t => t.textContent).sort(), bom: [...s.querySelector('[data-bom]').querySelectorAll('text')].map(t => t.textContent).join('|') }; });
    await p.click('[data-ct="assembly"]'); await p.waitForTimeout(200);
    await p.evaluate(() => { App.save(); App.saveNow && App.saveNow(); });
    await p.waitForTimeout(600);
    await p.reload(); await p.waitForFunction(() => window.App && App.r, null, { timeout: 15000 }); await p.waitForTimeout(500);
    const reread = await p.evaluate(() => ({ mode: App.mode, name: App.project.assembly && App.project.assembly.name, others: (App.project.others || []).map(a => a.name), insts: App.project.assembly ? App.project.assembly.insts.length : -1, sel: document.querySelector('#partSel').value, err: App.st ? App.st.errors.size : -1, n: App.st ? App.st.bodies.length : -1 }));
    // eliminare il sottoassieme lo toglie anche da lì
    await p.evaluate(() => App.asm.switchTo(App.project.others[0].id)); await p.waitForTimeout(200);
    await p.evaluate(() => App.asm.deleteAssembly()); await p.waitForTimeout(120);
    await p.click('#modalActions .btn-primary'); await p.waitForTimeout(300);
    const del = await p.evaluate(() => ({ name: App.project.assembly.name, others: App.project.others.length, insts: App.project.assembly.insts.length, opt: [...document.querySelectorAll('#partSel option')].map(o => o.textContent) }));
    await c.close();
    const ok = picked.length === 1 && /Origine di Perno<1>/.test(picked[0]) && second.name === 'Assieme2' && second.n === 0 && second.others === 1 && second.sel === 'asm' && second.list.filter(t => /\(assieme\)/.test(t)).length === 2
      && back1.name === first && back1.n === 2 && listed.some(t => /Assieme2 \(sottoassieme\)/.test(t)) && withSub.n === 3 && withSub.tree.some(t => /Assieme2<1>/.test(t))
      && bom.length === 2 && bom[1][1] === 'Perno' && bom[1][3] === '2' && !noCycle.some(t => /sottoassieme/.test(t)) && sheet.balloons.join() === '1,2' && /Perno/.test(sheet.bom)
      && reread.mode === 'assembly' && reread.name === first && reread.others.join() === 'Assieme2' && reread.insts === 3 && reread.n === 3 && reread.err === 0
      && del.name === first && del.others === 0 && del.insts === 2 && del.opt.filter(t => /\(assieme\)/.test(t)).length === 1;
    rec(ASMC4, ok && !errs.length, `scelto ${JSON.stringify(picked)}; secondo ${JSON.stringify(second)}; ritorno ${JSON.stringify(back1)}; elenco ${listed.join()}; con sotto ${JSON.stringify(withSub)}; distinta ${JSON.stringify(bom)}; niente ciclo ${noCycle.join()}; tavola ${JSON.stringify(sheet)}; riletto ${JSON.stringify(reread)}; dopo eliminazione ${JSON.stringify(del)}; errori ${errs.join(' | ')}`);
  } catch (e) { rec(ASMC4, false, e.message.split('\n')[0]); }

  await browser.close();
  const f = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - f}/${results.length} superati`);
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
