# Ripartenza – Banco CAD

File per riprendere il lavoro in una **nuova task**. Leggerlo per intero prima di cominciare, insieme a `IDEE.md`.

Ultimo aggiornamento: 21 ottobre 2026, sera (ellissi e spline nel DXF).

**Stato attuale:** ultima modifica del programma su `main` = commit `423c5bb` «Ellissi e spline nel DXF (archi tangenti) e correzioni dello schizzo». Tutte le prove superate: 109/109 di calcolo, 10/10 STEP/IGES, 41/41 dell'interfaccia, Autoverifica 109/109. Nessun lavoro lasciato a metà.

---

## 1. Messaggio da incollare nella nuova task

> Lavoriamo sul Banco CAD, repository **Rayuk-creator/CAD**. Collega il repository, leggi `RIPARTENZA.md` e `IDEE.md` e poi chiedimi cosa fare. Se non capisci qualcosa dimmelo subito.

---

## 2. Cos'è il progetto

**Banco CAD** è un modellatore 3D parametrico per la scuola (istituto tecnico, meccanica e meccatronica), **ispirato a SolidWorks** in tutto: nomi dei comandi, flusso schizzo → funzione, albero, PropertyManager, colori dello schizzo, messa in tavola ISO.

- È **un solo file**: `index.html` (≈ 5 MB), con HTML, CSS e JavaScript insieme, senza compilazione. Funziona offline con un doppio clic.
- L'**unica parte esterna** è il lettore STEP/IGES (occt-import-js 0.0.24 = OpenCascade in WebAssembly, licenza LGPL 2.1): il wasm (7,6 MB) è compresso con gzip e scritto in base64 in fondo alla pagina (≈ 4,1 MB), tra i commenti «LETTORE STEP/IGES: inizio/fine». Il resto del programma è ≈ 0,8 MB. Licenze in `licenze/`. Per aggiornarlo: `node tools/incorpora-occt.js <cartella dist>`. **Attenzione:** quella riga in fondo è lunghissima: non leggere né cercare in `index.html` senza limitare l'output.
- Interfaccia e testi **in italiano**.
- Il lavoro dell'utente si salva in `localStorage`; Progetto › Esporta / Importa per spostarlo.

### Funzioni presenti

- **Schizzo**: linea, rettangolo, rettangolo centrale, cerchio, archi (centro-estremi, 3 punti, tangente), poligono, asola, punto, linea di mezzeria, costruzione; raccordo/smusso di schizzo, taglia, specchia, converti entità; relazioni; quota intelligente; inserimento numerico; risolutore con stato blu / nero / rosso.
- **Funzioni**: estrusione e taglio (cieca, passante, piano medio, due direzioni, **sformo**), rivoluzione e taglio rivoluzione, **estrusione e taglio con percorso (sweep)**, **nervatura**, creazione guidata fori ISO (273, DIN 974-1, 15065, filettati, M3–M20), **raccordo e smusso simultanei** (angoli sferici dove si incontrano tre raccordi), serie lineare e circolare, specchio, piano di riferimento.
- **Valuta**: proprietà di massa esatte, 13 materiali, misura, vista in sezione, **Autoverifica** (le prove dei calcoli dentro il programma).
- **Messa in tavola**: metodo E (ISO 5456-2), linee nascoste, assi, sezioni, quote, cartiglio, A4–A2; stampa, SVG, DXF. Export STL dal menu Progetto.
- **Importazione STL e OBJ** (Progetto › Importa STL o OBJ): funzione «Importato» nell'albero, corpo a faccette; STL binario e ASCII, OBJ con facce a più lati; unità del file (mm, cm, m, pollici) e «Asse Z del file verso l'alto», modificabili con doppio clic; vertici saldati con tolleranza, facce girate corrette da sole, avviso se il corpo non è chiuso; facce piane riconosciute (schizzi e funzioni sopra); spigoli tra faccette sotto i 30° nascosti e ombreggiatura morbida; massimo 100 000 triangoli.
- **Importazione STEP e IGES** (Progetto › Importa STEP o IGES; un .step/.igs scelto nella finestra STL/OBJ viene letto lo stesso): stessa funzione «Importato»; superfici vere divise in triangoli fitti (angolo 0,1 rad ≈ 63 lati per cerchio, scostamento 0,0005 dell'ingombro; se si superano 100 000 triangoli si rilegge più grossolano, fino a 4 livelli, con avviso dal 3°); unità lette dal file e convertite in mm; ogni triangolo ricorda la **faccia vera** d'origine (`f` nel progetto salvato): lo spigolo si disegna solo tra facce diverse, la cucitura dei cilindri non si vede; assiemi = un solo «Importato» con più corpi; «Asse Z verso l'alto» modificabile; messaggi per .sldprt, .ipt, .sat, .x_t, STEP XML e file danneggiati. Il lettore si prepara alla prima importazione (≈ 0,5 s) e funziona offline.
- **Importazione DXF negli schizzi** (Progetto › Importa DXF (schizzo), oppure **Inserisci DXF** nella scheda Schizzo): fuori da uno schizzo ne crea uno nuovo sul piano scelto, dentro uno schizzo aggiunge a quello aperto; LINE, ARC, CIRCLE, LWPOLYLINE e POLYLINE (anche con tratti curvi, «bulge»), **ELLIPSE** (intera o arco, normale −Z) e **SPLINE** (NURBS di qualsiasi grado con nodi e pesi, oppure solo punti di passaggio con tangenti agli estremi o chiusa), blocchi (INSERT con spostamento, rotazione, scala uniforme, specchio, serie); unità da `$INSUNITS` o scelta a mano; posizione come nel file, angolo o centro sull'origine; estremi vicini uniti, entità doppie tolte; linee tratto-punto → linee di mezzeria, tratteggiate → costruzione; ellissi e spline diventano **biarchi** (coppie di archi tangenti) con scostamento ≤ 1/10 000 della dimensione minore della curva (asse minore dell'ellisse; per la spline il lato minore dell'ingombro, non meno di 1/10 della diagonale), il messaggio dice quanti archi e lo scostamento massimo in mm; i **centri** di questi archi sono nascosti (`hc` sul punto: non si disegnano, non si agganciano, non contano per l'inquadratura, selezione a finestra sull'arco); gli archi della stessa curva uniti in modo tangente hanno lo stesso gruppo `cg`, e tra le loro facce lo spigolo non si disegna (anche lungo un percorso a spline, `pcg`); testi, quote, tratteggi saltati e contati nel messaggio; DWG e DXF binario spiegati; massimo 3000 entità. Le entità arrivano selezionate e sotto definite (blu).
- **Esercitazioni**: 8 pezzi con tavola di consegna e verifica automatica.
- **Guida** «come si fa» (44 argomenti, pulsante in alto, «Mostrami dove») e **Glossario** (156 termini, ⓘ accanto ai titoli dei pannelli), collegati tra loro.

### Comandi della vista (decisi dall'utente)

- Mouse: **rotella = sposta a destra/sinistra**, **Ctrl + rotella = ruota**, **Maiusc + rotella = zoom**; trascinamento: sinistro ruota, destro (o Maiusc + sinistro) sposta; F = adatta; barra spaziatrice = orientamenti.
- Tablet: **due dita = zoom sempre**; per ruotare/spostare si **tocca prima il pezzo** («Pezzo preso», bordo blu), poi un dito ruota e due dita spostano; tocco nel vuoto o «Lascia» per rilasciare. Nello schizzo invariato.

---

## 3. Preferenze dell'utente (da rispettare)

- Scrivere **in italiano**, in modo semplice e chiaro.
- **«SE NON CAPISCI, O COMPRENDI, DIMMELO SUBITO CHE TROVO UNA SOLUZIONE»**: in caso di dubbio chiedere subito, prima di fare.
- Tutto deve essere **come in SolidWorks**.
- **Test affidabili** con **tolleranza dell'1 %** sui calcoli; dopo ogni modifica far girare tutte le prove.
- Ogni termine nuovo va spiegato nel **Glossario**, e ogni comando nuovo nella **Guida** (c'è un test che lo controlla).
- Le richieste lunghe consumano molto: l'utente ha un limite settimanale (si azzera il **martedì alle 17**). Per i controlli piccoli usare task nuove e corte.
- **Avvisare l'utente quando una chat di lavoro diventa troppo pesante**, così ne apre una nuova con il messaggio del punto 1.
- Quando l'utente spegne il PC, il lavoro deve andare avanti da solo: lo segue dall'app su smartphone o tablet (messaggi brevi, file mandati alla fine).
- Essere sempre **precisissimi** nei controlli e nelle misure: verificare che ogni prova nuova scopra davvero il difetto (farla girare anche sulla versione vecchia).
- I promemoria vanno in `IDEE.md` e in questo file (la memoria tra chat ora è attiva, ma questi file restano il riferimento).

---

## 4. Come si lavora sul codice

### Struttura del repository

```
index.html            il programma completo
README.md / .en.md    presentazione in italiano e in inglese (con immagini)
docs/img/             7 schermate del README
IDEE.md               lavori futuri e idee rimandate
RIPARTENZA.md         questo file
licenze/              licenze LGPL del lettore STEP/IGES e LEGGIMI.md (versione, impronte SHA-256)
tools/incorpora-occt.js  inserisce/aggiorna il lettore STEP/IGES in index.html
tests/extract.js      estrae i moduli di calcolo da index.html per Node
tests/kernel.test.js  93 casi geometrici + 16 di controllo = 109 prove (usate anche dall'Autoverifica)
tests/step.test.js    10 prove del lettore STEP/IGES vero (prende il lettore da index.html)
tests/stepgen.js      scrive file STEP di prova (blocco, cilindro, piastra con foro, due blocchi, unità mm/cm/m)
tests/igesgen.js      scrive file IGES di prova (blocco fatto di superfici piane tagliate)
tests/ui.test.js      41 prove dell'interfaccia in Chromium (Playwright)
package.json          npm test / test:kernel (comprende step.test.js) / test:ui
```

### Moduli dentro `index.html` (in ordine)

1. `CSG` – booleane con alberi BSP; ogni poligono ha un tag di superficie.
2. `Geom` – estrusione, `extrudeDraft` (sformo), rivoluzione, fori, topologia, proprietà di massa esatte.
3. `Sketch` – entità, relazioni, risolutore, `profiles` (contorni chiusi), `chains` (catene aperte per sweep e nervature). `analyze` (stato blu/nero/rosso) e `rankOf`: con meno vincoli che incognite scompongono la **trasposta** della matrice dei vincoli (stesso risultato, fino a 100 volte più veloce). `touchOnly`: due tratti tangenti con un estremo in comune non si «incrociano».
3b. `Import` – lettura STL/OBJ (`parseSTL`, `parseOBJ`), saldatura dei vertici (`weld`), forma compatta base64 salvata nel progetto (`pack`/`unpack`), `analyze` (orientamento, chiusura, facce piane); DXF: `parseDXF` (geometria in coordinate del disegno, unità, entità saltate, `approx` = conteggi e scostamento di ellissi e spline) e `dxfToSketch` (entità dello schizzo con punti uniti). Ellissi e spline: `curveToArcs` (biarchi ricorsivi, divisi a metà finché lo scostamento misurato nei due sensi supera la tolleranza `DXF_CURVE_TOL` = 10⁻⁴), `biarc`, `nurbsEval` (de Boor omogeneo), `fitSpline` (spline cubica per punti, parametro = corde; libera, con tangenti o chiusa). Interfaccia in `App.importDxfDialog`/`App.importDxfData` e `Sketcher.insertDXF`. STEP/IGES: `loadOCCT` (decomprime il wasm e avvia il lettore, una volta sola; in Node gli si passa `require`), `readCAD` (triangoli in mm + faccia vera di ogni triangolo, livelli di finezza `CAD_LEVELS`), `cadKind`; `weld` restituisce anche `src` (triangolo d'origine) e `pack`/`unpack`/`analyze` portano il vettore delle facce `f`. Interfaccia in `App.importCadDialog`/`App.importCadData` (asincrona) e `addImported` (comune a STL/OBJ e STEP/IGES).
4. `Model` – albero delle funzioni e `regen` (alla fine `smoothMeshEdges` e `smoothCurveEdges`: spigoli morbidi dei corpi importati e delle curve da DXF); `sweepTool`, `ribTool`, `filletCorners`, `edgeTool`, `importTool` (funzione `import`, con cache per file/unità/orientamento; spigoli morbidi in `smoothMeshEdges`); `sketchesOf(f)` (lo sweep usa due schizzi: `f.sketch` profilo, `f.path` percorso).
5. `GLView` – vista WebGL e camera (`rotate`, `pan`, `zoomAt`, `fit`).
6. `App` – stato, albero, selezione, comandi, `initView` (mouse, rotella, tablet), salvataggio.
7. `Sketcher` – editor di schizzo. 8. `Features` – PropertyManager delle funzioni. 9. `Drawing` – messa in tavola. 10. `Lessons` – esercitazioni.
11. Autoverifica (`SelfTest`, è una copia di `tests/kernel.test.js`). 12. `Glossary`. 13. `Guide`.

### Procedura per ogni modifica

1. Modificare `index.html`.
2. Se si cambia `tests/kernel.test.js`, **ricopiarlo** nel blocco «Autoverifica» di `index.html` (tra il commento `/* Autoverifica: …*/` e `root.SelfTest = …})(this);`).
3. Prove: `npm run test:kernel` (pochi secondi) e `npm run test:ui` (≈ 1–2 minuti). Nell'ambiente cloud Chromium è già installato: `CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run test:ui` (per Playwright: `ln -s /opt/node22/lib/node_modules node_modules`).
4. Per ogni funzione nuova: casi con **valori calcolati a mano** in `kernel.test.js`, voce nel Glossario, argomento nella Guida, prova con il mouse in `ui.test.js` se ha interfaccia.
5. Guardare il risultato con una schermata (Playwright) prima di consegnare.
6. Commit in italiano e push su `main`; mandare all'utente anche il file `index.html` aggiornato.

### Trappole note nei test dell'interfaccia

- Dopo ✓ aspettare la rigenerazione prima di leggere le proprietà (la funzione `props()` lo fa già).
- Dopo aver caricato un pezzo a mano chiamare `App.r.fit(...)`, altrimenti i clic finiscono fuori dal pezzo.
- Sul tablet toccare un punto **pieno** del pezzo (il centro della piastra forata è il foro!).
- Lo spostamento con la rotella si misura sulla camera, non sulle coordinate dello schermo; la dimensione del pixel (`pxSize`) va letta dopo un fotogramma (`requestAnimationFrame`), altrimenti può essere quella vecchia.
- Per i file da importare nei test: `page.setInputFiles('#meshFile', { name, mimeType, buffer })` (DXF: `#dxfFile`, STEP/IGES: `#cadFile`); nel codice c'è anche `App.importMeshData(nome, Uint8Array, { unit, zUp })`, `App.importDxfData(nome, Uint8Array, { unit, origin, plane })` e `await App.importCadData(nome, Uint8Array, { zUp })`.
- Le caselle dei pannelli non hanno un id: si prendono con `page.locator('#pm label.chk', { hasText: '…' }).locator('input')`.
- Una prova che conta qualcosa (spigoli, errori) può passare «a vuoto» se la funzione fallisce e non c'è il pezzo: controllare sempre `st.errors` e che `st.body` non sia vuoto (lo fa `sideEdges` in `kernel.test.js`).
- L'estrusione con percorso vuole il percorso **perpendicolare** al piano del profilo nel punto di partenza.
- Se l'interfaccia sembra bloccata dopo un'importazione, misurare i tempi: il calcolo più pesante è `Sketch.analyze` (stato dello schizzo).

---

## 5. Cronologia (14–21 ottobre 2026)

- Batteria di test sui calcoli e sull'interfaccia, tolleranza 1 %.
- Corretti: raccordo sul bordo circolare di un cilindro pieno; anteprima che restava attiva dopo ✓ (pezzo sbagliato); salvataggio perso alla chiusura e funzioni «fantasma» alla riapertura; zoom a due dita che spostava la vista; dita «rimaste agganciate» tra un gesto e l'altro.
- Aggiunti: estrusione/taglio con percorso, nervatura, sformo, glossario, Autoverifica, raccordi e smussi simultanei con angoli sferici, nuovi comandi rotella e tablet, Guida «come si fa».
- Creato il repository **Rayuk-creator/CAD** (pubblico) con README italiano e inglese e schermate.
- Valutata l'importazione di altri formati e l'idea del cablaggio 3D da PDF: **rimandate**, vedi `IDEE.md`.
- 21 ottobre: **importazione STL e OBJ** (funzione «Importato»), con 10 prove di calcolo e 5 dell'interfaccia; Guida e Glossario aggiornati. Corretto anche un difetto della vista: la rotella (o un trascinamento) usata durante l'animazione di un cambio di vista andava persa; ora l'animazione si chiude subito e il comando si applica (prova apposita).
- 21 ottobre (seconda parte): **importazione DXF negli schizzi** con 9 prove di calcolo, 1 di schizzo e 3 dell'interfaccia; Guida e Glossario aggiornati; pagina pubblicata su claude.ai aggiornata. Corretto un difetto grave della triangolazione: con **più fori** in una stessa faccia (per esempio 4 fori allineati a due a due) il ponte tra foro e contorno poteva tagliare un altro foro e il volume veniva sbagliato fino al 27 %; ora il ponte va al vertice visibile più vicino (funzione `bridge` in `Geom`), con 2 prove apposite.
- 21 ottobre (terza parte): **importazione STEP e IGES** con OpenCascade (occt-import-js) compresso dentro `index.html` (scelta dell'utente: tutto in un file, ≈ 5 MB); 5 prove di calcolo + 3 di controllo con un lettore simulato, 10 prove con il lettore vero su file STEP/IGES scritti dai generatori dei test, 3 prove dell'interfaccia; Guida (argomento «Importare un pezzo da un file STEP o IGES») e Glossario (STEP, IGES, Importa STEP o IGES, Facce del modello d'origine, OpenCascade) aggiornati. Corretta anche la chiusura doppia `</body></html>` in fondo alla pagina.
- 21 ottobre (quarta parte): **ellissi e spline nel DXF** diventano biarchi; 15 prove di calcolo nuove (volumi, aree e baricentri calcolati a mano: ellisse intera, ruotata, quarto, normale −Z, foro ellittico, 1:100, in un blocco; spline quadratica, cubica, cerchio NURBS razionale esatto, grado 1, per 2/3/4 punti di passaggio; tubo lungo una spline), 9 controlli dello schizzo, 2 prove dell'interfaccia; errore massimo 0,021 %. Dopo aver guardato le schermate: centri degli archi nascosti (un'ellisse 200 × 2 occupava lo 0,4 % della vista, ora il 74 %) e niente righe tra le facce della stessa curva (52 in un'ellisse estrusa, 2698 in un tubo lungo una spline). Corretti tre difetti dello schizzo trovati strada facendo: (1) con due entità incrociate il controllo andava in errore JavaScript invece di dare il messaggio «si intersecano»; (2) archi tangenti con raggi grandi, o sullo stesso cerchio, venivano presi per incroci (arrotondamenti); (3) lo stato dello schizzo con tante entità era lentissimo (9,5 s con 88 archi, ora 0,13 s; verificato uguale al vecchio su 1000 schizzi). Guida e Glossario (Ellisse, Spline, Biarco, Scostamento dalla curva) aggiornati.

## 6. Cose aperte

- Tutto quello che c'è in `IDEE.md`: ellissi e spline nel DXF **fatte** il 21 ottobre; prossimo passo previsto: il cablaggio 3D semi-automatico da PDF (che userà il lettore DXF), da confermare con l'utente.
- Un'ellisse diventa ≈ 50–60 archi (tolleranza 1/10 000): va bene fino a qualche decina di curve per disegno (massimo 3000 entità). Se servisse, si possono ridurre gli archi scegliendo meglio il punto di giunzione dei biarchi.
- Il bordo di un foro ellittico (o a spline) è fatto di tanti spigoli, uno per arco: per un raccordo o uno smusso su quel bordo vanno scelti tutti (in SolidWorks è uno spigolo solo). Si potrebbe far scegliere insieme gli spigoli dello stesso gruppo `cg`.
- Due facce vere adiacenti nello stesso piano (per esempio una faccia divisa con una «linea di divisione») si vedono unite, senza lo spigolo in mezzo: si potrebbe distinguere con la faccia d'origine in `surfKey`, ma toccherebbe anche i pezzi normali. Per ora lasciato così.
- La pagina pubblicata su claude.ai (artifact «Banco CAD») è ferma alla seconda parte del 21 ottobre (importazione DXF, **senza** STEP/IGES e **senza** ellissi e spline): ripubblicarla quando l'utente lo chiede (ora la pagina pesa ≈ 5 MB, sotto il limite di 16 MB). La versione giusta resta `index.html` del repository.