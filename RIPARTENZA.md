# Ripartenza – Banco CAD

File per riprendere il lavoro in una **nuova task**. Leggerlo per intero prima di cominciare, insieme a `IDEE.md`.

Ultimo aggiornamento: 21 ottobre 2026 (importazione STL/OBJ).

---

## 1. Messaggio da incollare nella nuova task

> Lavoriamo sul Banco CAD, repository **Rayuk-creator/CAD**. Collega il repository, leggi `RIPARTENZA.md` e `IDEE.md` e poi chiedimi cosa fare. Se non capisci qualcosa dimmelo subito.

---

## 2. Cos'è il progetto

**Banco CAD** è un modellatore 3D parametrico per la scuola (istituto tecnico, meccanica e meccatronica), **ispirato a SolidWorks** in tutto: nomi dei comandi, flusso schizzo → funzione, albero, PropertyManager, colori dello schizzo, messa in tavola ISO.

- È **un solo file**: `index.html` (≈ 640 kB), con HTML, CSS e JavaScript insieme, senza dipendenze né compilazione. Funziona offline con un doppio clic.
- Interfaccia e testi **in italiano**.
- Il lavoro dell'utente si salva in `localStorage`; Progetto › Esporta / Importa per spostarlo.

### Funzioni presenti

- **Schizzo**: linea, rettangolo, rettangolo centrale, cerchio, archi (centro-estremi, 3 punti, tangente), poligono, asola, punto, linea di mezzeria, costruzione; raccordo/smusso di schizzo, taglia, specchia, converti entità; relazioni; quota intelligente; inserimento numerico; risolutore con stato blu / nero / rosso.
- **Funzioni**: estrusione e taglio (cieca, passante, piano medio, due direzioni, **sformo**), rivoluzione e taglio rivoluzione, **estrusione e taglio con percorso (sweep)**, **nervatura**, creazione guidata fori ISO (273, DIN 974-1, 15065, filettati, M3–M20), **raccordo e smusso simultanei** (angoli sferici dove si incontrano tre raccordi), serie lineare e circolare, specchio, piano di riferimento.
- **Valuta**: proprietà di massa esatte, 13 materiali, misura, vista in sezione, **Autoverifica** (le prove dei calcoli dentro il programma).
- **Messa in tavola**: metodo E (ISO 5456-2), linee nascoste, assi, sezioni, quote, cartiglio, A4–A2; stampa, SVG, DXF. Export STL dal menu Progetto.
- **Importazione STL e OBJ** (Progetto › Importa STL o OBJ): funzione «Importato» nell'albero, corpo a faccette; STL binario e ASCII, OBJ con facce a più lati; unità del file (mm, cm, m, pollici) e «Asse Z del file verso l'alto», modificabili con doppio clic; vertici saldati con tolleranza, facce girate corrette da sole, avviso se il corpo non è chiuso; facce piane riconosciute (schizzi e funzioni sopra); spigoli tra faccette sotto i 30° nascosti e ombreggiatura morbida; massimo 100 000 triangoli.
- **Esercitazioni**: 8 pezzi con tavola di consegna e verifica automatica.
- **Guida** «come si fa» (42 argomenti, pulsante in alto, «Mostrami dove») e **Glossario** (≈ 145 termini, ⓘ accanto ai titoli dei pannelli), collegati tra loro.

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
- La memoria tra chat è disattivata: i promemoria vanno in `IDEE.md` e in questo file.

---

## 4. Come si lavora sul codice

### Struttura del repository

```
index.html            il programma completo
README.md / .en.md    presentazione in italiano e in inglese (con immagini)
docs/img/             7 schermate del README
IDEE.md               lavori futuri e idee rimandate
RIPARTENZA.md         questo file
tests/extract.js      estrae i moduli di calcolo da index.html per Node
tests/kernel.test.js  63 casi geometrici + 3 di schizzo = 66 prove (usate anche dall'Autoverifica)
tests/ui.test.js      33 prove dell'interfaccia in Chromium (Playwright)
package.json          npm test / test:kernel / test:ui
```

### Moduli dentro `index.html` (in ordine)

1. `CSG` – booleane con alberi BSP; ogni poligono ha un tag di superficie.
2. `Geom` – estrusione, `extrudeDraft` (sformo), rivoluzione, fori, topologia, proprietà di massa esatte.
3. `Sketch` – entità, relazioni, risolutore, `profiles` (contorni chiusi), `chains` (catene aperte per sweep e nervature).
3b. `Import` – lettura STL/OBJ (`parseSTL`, `parseOBJ`), saldatura dei vertici (`weld`), forma compatta base64 salvata nel progetto (`pack`/`unpack`), `analyze` (orientamento, chiusura, facce piane). Il prossimo lettore (DXF) va qui.
4. `Model` – albero delle funzioni e `regen`; `sweepTool`, `ribTool`, `filletCorners`, `edgeTool`, `importTool` (funzione `import`, con cache per file/unità/orientamento; spigoli morbidi in `smoothMeshEdges`); `sketchesOf(f)` (lo sweep usa due schizzi: `f.sketch` profilo, `f.path` percorso).
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
- Per i file da importare nei test: `page.setInputFiles('#meshFile', { name, mimeType, buffer })`; nel codice c'è anche `App.importMeshData(nome, Uint8Array, { unit, zUp })`.

---

## 5. Cronologia (14–21 ottobre 2026)

- Batteria di test sui calcoli e sull'interfaccia, tolleranza 1 %.
- Corretti: raccordo sul bordo circolare di un cilindro pieno; anteprima che restava attiva dopo ✓ (pezzo sbagliato); salvataggio perso alla chiusura e funzioni «fantasma» alla riapertura; zoom a due dita che spostava la vista; dita «rimaste agganciate» tra un gesto e l'altro.
- Aggiunti: estrusione/taglio con percorso, nervatura, sformo, glossario, Autoverifica, raccordi e smussi simultanei con angoli sferici, nuovi comandi rotella e tablet, Guida «come si fa».
- Creato il repository **Rayuk-creator/CAD** (pubblico) con README italiano e inglese e schermate.
- Valutata l'importazione di altri formati e l'idea del cablaggio 3D da PDF: **rimandate**, vedi `IDEE.md`.
- 21 ottobre: **importazione STL e OBJ** (funzione «Importato»), con 10 prove di calcolo e 5 dell'interfaccia; Guida e Glossario aggiornati. Corretto anche un difetto della vista: la rotella (o un trascinamento) usata durante l'animazione di un cambio di vista andava persa; ora l'animazione si chiude subito e il comando si applica (prova apposita).

---

## 6. Cose aperte

- Tutto quello che c'è in `IDEE.md`: **prossimo passo l'importazione DXF negli schizzi**, poi STEP/IGES; cablaggio 3D semi-automatico da PDF.
- La pagina pubblicata su claude.ai (artifact «Banco CAD») è ferma al **13 ottobre**: aggiornarla solo se l'utente lo chiede. La versione giusta è `index.html` del repository.
- L'utente doveva farmi «controllare una cosa» (rimandata al martedì per il limite di utilizzo): chiedergli se serve ancora.
