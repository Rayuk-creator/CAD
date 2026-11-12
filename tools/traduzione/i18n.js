/* Lingua dell'interfaccia (italiano normale, inglese da scegliere).
   L'italiano resta nel codice; in inglese un osservatore della pagina traduce i testi che compaiono
   (testi, title, aria-label, placeholder) con il dizionario EN: chiave = frase italiana, valore = inglese.
   Nelle chiavi {} = pezzo variabile (numero, nome...), ripetuto nel valore nello stesso ordine; {1}, {2}... per cambiarlo.
   Il pezzo variabile si traduce a sua volta se è una frase del dizionario (per esempio il nome di una funzione).
   Le frasi che mancano finiscono in I18N.missing (le prove controllano che non ce ne siano). */
(function (root) {
  'use strict';
  const KEY = 'banco-cad-lang';
  let lang = 'it', check = false;
  try {
    const q = /[?&]lang=(it|en)\b/.exec(root.location ? root.location.search : '');
    if (q) { lang = q[1]; root.localStorage.setItem(KEY, lang); }
    else lang = root.localStorage.getItem(KEY) === 'en' ? 'en' : 'it';
    // «check» (solo per le prove): la pagina resta in italiano, ma ogni testo che compare si cerca nel dizionario
    check = root.localStorage.getItem(KEY) === 'check';
  } catch (e) { /* senza localStorage resta l'italiano */ }
  const EN = {
/* TRADUZIONE EN: inizio */
/* TRADUZIONE EN: fine */
  };
  const en = lang === 'en';
  const exact = new Map(), pats = [], made = new Set(), cache = new Map(), missing = new Set();
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const norm = s => s.replace(/\s+/g, ' ').trim();
  for (const k in EN) {
    const v = EN[k];
    made.add(norm(v.replace(/\{\d*\}/g, '')));
    if (!/\{#?\}/.test(k)) { exact.set(norm(k), v); continue; }
    const parts = norm(k).split(/(\{#?\})/);
    const re = parts.map((p, i) => i % 2 ? (p === '{#}' ? '(\\d[\\d.,]*)' : '(.*?)') : reEsc(p)).join('');
    if (!parts.some((p, i) => !(i % 2) && p)) continue; // chiave fatta solo di {}: non si usa
    pats.push({ re: new RegExp('^' + re + '$', 's'), v, lit: parts.filter((p, i) => !(i % 2)).join('').length });
  }
  pats.sort((a, b) => b.lit - a.lit); // prima le chiavi più lunghe (più precise)
  // i pezzi variabili si traducono a loro volta; se uno di più parole resta in italiano la chiave non vale (null)
  function fill(v, caps, depth) {
    const c = [];
    for (const x of caps) {
      if (/^[\uE000-\uE0FF]$/.test(x)) { c.push(x); continue; }
      const r = core(norm(x), depth + 1);
      if (r !== null) c.push(/^\s*/.exec(x)[0] + r + /\s*$/.exec(x)[0]);
      else if (/\s/.test(x.trim()) && looksItalian(norm(x))) return null;
      else c.push(x);
    }
    let i = 0;
    return v.replace(/\{(\d*)\}/g, (m, n) => (n ? c[+n - 1] : c[i++]) ?? '');
  }
  const SENT = /(?<=[.!?:;])\s+(?=[A-ZÀ-Ú«(\d])/;
  // traduzione di una frase già normalizzata; null se manca
  function core(k, depth) {
    if (!k) return k;
    let r = cache.get(k);
    if (r !== undefined) return r;
    r = exact.get(k);
    if (r === undefined) for (const p of pats) { const m = p.re.exec(k); if (m) { const f = fill(p.v, m.slice(1), depth); if (f !== null) { r = f; break; } } }
    // più frasi messe in fila («Fatto. Attenzione: …»): si prova a dividerle, prima le divisioni più lunghe
    if (r === undefined) {
      const ss = k.split(SENT);
      for (let i = ss.length - 1; i >= 1 && r === undefined; i--) {
        const h = core(ss.slice(0, i).join(' '), depth + 1), t = h === null ? null : core(ss.slice(i).join(' '), depth + 1);
        if (h !== null && t !== null) r = h + ' ' + t;
      }
    }
    // elenchi «1 linea, 2 archi» o «1 ellisse e 2 spline» dentro un pezzo variabile
    for (const [sep, out] of [[', ', ', '], [' e ', ' and ']]) {
      if (r !== undefined || depth === 0 || !k.includes(sep)) continue;
      const ps = k.split(sep).map(x => core(x, depth + 1) ?? (looksItalian(x) ? null : x));
      if (ps.every(x => x !== null)) r = ps.join(out);
    }
    if (r === undefined) r = null;
    if (cache.size > 20000) cache.clear();
    cache.set(k, r);
    return r;
  }
  // traduce una frase; se manca restituisce l'originale (e la segnala, se sembra italiana)
  function tr(s, depth = 0, quiet = false) {
    if (!(en || check) || !s) return s;
    const lead = /^\s*/.exec(s)[0], trail = /\s*$/.exec(s)[0], k = norm(s);
    if (!k) return s;
    const r = core(k, depth);
    if (r === null) { if (!quiet && looksItalian(k)) missing.add(k); return s; }
    made.add(norm(r));
    return lead + r + trail;
  }
  // testo da segnalare se manca: ha lettere, non è inglese già tradotto, non è solo unità o sigle
  function looksItalian(k) {
    if (made.has(k) || !/[a-zà-ù]{2}/i.test(k)) return false;
    if (/^[\d\s.,:;·×±°%()\-+/*=<>⌀Ø²³'"«»…–—]*([a-zµ]{1,3}[²³]?)?[\d\s.,:;·×±°%()\-+/*=<>⌀Ø²³'"«»…–—]*$/i.test(k)) return false;
    return true;
  }
  const t = s => tr(String(s));
  // traduce i testi <text> di un SVG scritto come stringa (tavola salvata in SVG o PDF)
  const svg = s => en ? String(s).replace(/(<text\b[^>]*>)([^<]*)(<\/text>)/g, (m, a, b, c) => a + escXml(t(unXml(b))) + c) : s;
  const unXml = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  const escXml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* --------------------------- traduzione della pagina --------------------------- */
  const ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];
  const INLINE = new Set(['B', 'I', 'EM', 'STRONG', 'KBD', 'CODE', 'SUB', 'SUP', 'BR', 'U', 'SMALL']);
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CANVAS']);
  const skip = el => !el || SKIP.has(el.nodeName) || !!(el.closest && el.closest('[translate="no"],[data-i18n="no"]'));
  let busy = false;
  function doAttrs(el) {
    for (const a of ATTRS) { const v = el.getAttribute(a); if (v) { const r = tr(v); if (r !== v && en) el.setAttribute(a, r); } }
  }
  // elemento con testo e tag in linea: si traduce la frase intera, se c'è nel dizionario.
  // <b>, <i>... senza attributi restano nella frase; gli altri elementi in linea (a, span...) diventano
  // segnaposti , ... (il {} delle chiavi) e tornano al loro posto, con il loro testo tradotto a parte.
  // Con tag di blocco o comandi (div, label, input, button...) niente frase intera: ogni testo per conto suo.
  const BLOCK = new Set(('DIV P UL OL LI TABLE TR TD TH THEAD TBODY TFOOT H1 H2 H3 H4 H5 H6 SECTION HEADER FOOTER NAV ASIDE MAIN FORM FIELDSET LEGEND PRE BLOCKQUOTE DL DT DD DETAILS SUMMARY FIGURE FIGCAPTION CAPTION HR LABEL ' +
    'INPUT BUTTON SELECT OPTION TEXTAREA IMG CANVAS SCRIPT STYLE').split(' '));
  function doMixed(el) {
    if (!el.firstChild || el.childNodes.length < 2 || el.namespaceURI !== 'http://www.w3.org/1999/xhtml') return false;
    let key = '', slots = [];
    for (const c of el.childNodes) {
      if (c.nodeType === 3) key += c.nodeValue.replace(/[<>&]/g, m => m === '<' ? '&lt;' : m === '>' ? '&gt;' : '&amp;');
      else if (c.nodeType === 1) {
        if (BLOCK.has(c.nodeName) || c.namespaceURI !== 'http://www.w3.org/1999/xhtml') return false;
        if (INLINE.has(c.nodeName) && !c.attributes.length) key += c.outerHTML;
        else { key += String.fromCharCode(0xE000 + slots.length); slots.push(c); }
      } else if (c.nodeType !== 8) return false;
    }
    const k = norm(key);
    if (!/[a-zà-ù]{2}/i.test(k.replace(/<[^>]*>/g, ''))) return false;
    const r = tr(k, 0, true);
    if (r === k) return false; // si prova testo per testo (lì si segnalano le frasi che mancano)
    if (!en) { slots.forEach(c => walk(c)); return true; }
    const lead = /^\s*/.exec(key)[0], trail = /\s*$/.exec(key)[0];
    const parts = (lead + r + trail).split(/([-])/);
    while (el.firstChild) el.removeChild(el.firstChild);
    const tpl = root.document.createElement('template');
    for (const p of parts) {
      if (!p) continue;
      const i = p.charCodeAt(0) - 0xE000;
      if (p.length === 1 && i >= 0 && i < slots.length) { el.appendChild(slots[i]); walk(slots[i]); }
      else { tpl.innerHTML = p; el.appendChild(tpl.content); }
    }
    return true;
  }
  function walk(node, fromParent) {
    if (node.nodeType === 3) {
      const p = node.parentNode;
      if (!p || skip(p)) return;
      if (!fromParent && p.nodeType === 1 && doMixed(p)) return;
      const v = node.nodeValue, r = tr(v);
      if (r !== v && en) node.nodeValue = r;
      return;
    }
    if (node.nodeType !== 1 || skip(node)) return;
    doAttrs(node);
    if (doMixed(node)) return;
    for (let c = node.firstChild; c; c = c.nextSibling) walk(c, true);
  }
  function run(recs) {
    if (busy) return;
    busy = true;
    try {
      for (const m of recs) {
        if (m.type === 'childList') m.addedNodes.forEach(walk);
        else if (m.type === 'characterData') walk(m.target);
        else if (m.type === 'attributes' && m.target.nodeType === 1 && !skip(m.target)) doAttrs(m.target);
      }
    } finally { obs.takeRecords(); busy = false; }
  }
  const obs = (en || check) && root.MutationObserver ? new root.MutationObserver(run) : null;
  function start() {
    if (!obs) return;
    const d = root.document;
    if (en) { d.documentElement.lang = 'en'; d.title = tr(d.title); }
    busy = true; try { walk(d.body); } finally { busy = false; }
    obs.observe(d.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  // cambia lingua: si salva la scelta e si ricarica la pagina (il lavoro è già salvato)
  function set(l) {
    try { root.localStorage.setItem(KEY, l === 'en' ? 'en' : 'it'); } catch (e) { /* niente */ }
    if (root.location) {
      const u = new URL(root.location.href); u.searchParams.delete('lang');
      root.location.replace(u.href);
    }
  }
  const api = {
    lang, en, check, t, tr, svg, set, start, missing, dict: EN,
    dc: en ? '.' : ',',                 // separatore decimale
    loc: en ? 'en-US' : 'it-IT',        // per toLocaleString
    // numero con il separatore decimale della lingua (la stringa arriva con il punto)
    dec: s => en ? String(s) : String(s).replace('.', ','),
  };
  root.I18N = api;
  if ((en || check) && root.document && root.document.body) start();
})(this);
