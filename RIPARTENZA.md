# Ripartenza – Banco CAD

File per riprendere il lavoro in una **nuova task**. Leggerlo per intero prima di cominciare, insieme a `IDEE.md`.

Ultimo aggiornamento: 21 ottobre 2026.

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
- **Esercitazioni**: 8 pezzi con tavola di consegna e verifica automatica.
- **Guida** «come si fa» (41 argomenti, pulsante in alto, «Mostrami dove») e **Glossario** (≈ 135 termini, ⓘ accanto ai titoli dei pannelli), collegati tra loro.

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
tests/kernel.test.js  53 casi geometrici + 3 di schizzo = 56 prove (usate anche dall'Autoverifica)
tests/ui.test.js      28 prove dell'interfaccia in Chromium (Playwright)
package.json          npm test / test:kernel / test:ui
```

### Moduli dentro `index.html` (in ordine)

1. `CSG` – booleane con alberi BSP; ogni poligono ha un tag di superficie.
2. `Geom` – estrusione, `extrudeDraft` (sformo), rivoluzione, fori, topologia, proprietà di massa esatte.
3. `Sketch` – entità, relazioni, risolutore, `profiles` (contorni chiusi), `chains` (catene aperte per sweep e nervature).
4. `Model` – albero delle funzioni e `regen`; `sweepTool`, `ribTool`, `filletCorners`, `edgeTool`; `sketchesOf(f)` (lo sweep usa due schizzi: `f.sketch` profilo, `f.path` percorso).
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
- Lo spostamento con la rotella si misura sulla camera, non sulle coordinate dello schermo.

---

## 5. Cronologia (14–21 ottobre 2026)

- Batteria di test sui calcoli e sull'interfaccia, tolleranza 1 %.
- Corretti: raccordo sul bordo circolare di un cilindro pieno; anteprima che restava attiva dopo ✓ (pezzo sbagliato); salvataggio perso alla chiusura e funzioni «fantasma» alla riapertura; zoom a due dita che spostava la vista; dita «rimaste agganciate» tra un gesto e l'altro.
- Aggiunti: estrusione/taglio con percorso, nervatura, sformo, glossario, Autoverifica, raccordi e smussi simultanei con angoli sferici, nuovi comandi rotella e tablet, Guida «come si fa».
- Creato il repository **Rayuk-creator/CAD** (pubblico) con README italiano e inglese e schermate.
- Valutata l'importazione di altri formati e l'idea del cablaggio 3D da PDF: **rimandate**, vedi `IDEE.md`.

---

## 6. Cose aperte

- Tutto quello che c'è in `IDEE.md` (importazione STL/OBJ → DXF → STEP/IGES; cablaggio 3D semi-automatico da PDF).
- La pagina pubblicata su claude.ai (artifact «Banco CAD») è ferma al **13 ottobre**: aggiornarla solo se l'utente lo chiede. La versione giusta è `index.html` del repository.
- L'utente doveva farmi «controllare una cosa» (rimandata al martedì per il limite di utilizzo): chiedergli se serve ancora.
