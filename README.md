# Banco CAD

Modellatore 3D parametrico per la scuola, ispirato a SolidWorks, in **un'unica pagina HTML**: si apre con un doppio clic in Chrome, Edge o Firefox e funziona anche senza internet.

## Cosa fa

- **Schizzo parametrico**: linee, rettangoli, cerchi, archi, poligoni, asole, linee di mezzeria; relazioni (orizzontale, tangente, uguale…) e quote intelligenti; schizzo blu, nero o rosso secondo la definizione.
- **Funzioni**: estrusione e taglio (cieca, passante, piano medio, due direzioni, sformo), rivoluzione e taglio rivoluzione, estrusione e taglio con percorso (sweep), nervatura, creazione guidata fori ISO (passanti ISO 273, lamati DIN 974-1, svasati ISO 15065, filettati), raccordi e smussi simultanei, serie lineare e circolare, specchio, piani di riferimento.
- **Valuta**: proprietà di massa esatte (volume, area, massa, baricentro), materiali, misura, vista in sezione, autoverifica dei calcoli.
- **Messa in tavola**: proiezioni ortogonali con il metodo E (ISO 5456-2), linee nascoste, assi, sezioni tratteggiate, quote, cartiglio; stampa in scala, SVG e DXF.
- **Esercitazioni** guidate con tavola di consegna e verifica automatica del modello.
- **Guida** «come si fa» (41 argomenti) e **Glossario** (oltre 130 termini), collegati tra loro e alle ⓘ dei pannelli.
- Esportazione del progetto e **STL** per la stampa 3D. Il lavoro si salva da solo nel browser.

## Comandi della vista

| Azione | Mouse | Tablet |
|---|---|---|
| Spostare a destra / sinistra | rotella | tocca il pezzo, poi due dita |
| Ruotare | Ctrl + rotella, oppure trascina con il tasto sinistro | tocca il pezzo, poi un dito |
| Zoom | Maiusc + rotella | due dita (sempre) |
| Spostare in ogni direzione | trascina con il tasto destro | tocca il pezzo, poi due dita |

## Usarlo

Scarica `index.html` e aprilo nel browser. Non c'è niente da installare.

## Test

I test controllano i calcoli e l'interfaccia. La tolleranza ammessa è l'1 %.

```bash
npm install
npx playwright install chromium   # solo la prima volta
npm test
```

- `npm run test:kernel` – 56 pezzi di prova: volume, area, baricentro e ingombro confrontati con i valori calcolati a mano.
- `npm run test:ui` – 28 prove in Chromium: disegno con il mouse, quote, funzioni, glossario, guida, rotella, gesti su tablet, salvataggio, messa in tavola.

Le stesse prove dei calcoli si possono lanciare dentro il programma: **Valuta › Autoverifica**.

## Struttura

```
index.html            il programma completo (HTML, CSS e JavaScript in un file)
tests/extract.js      estrae dal file i moduli di calcolo per provarli in Node
tests/kernel.test.js  prove dei calcoli (usate anche dall'Autoverifica)
tests/ui.test.js      prove dell'interfaccia con Playwright
```
