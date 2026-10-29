# Convertitore DWG → DXF

Pagina a parte del Banco CAD: trasforma i disegni di AutoCAD (`.dwg`) in file DXF, che il Banco CAD apre con **Progetto › Importa DXF (schizzo)**. La conversione avviene nel browser, senza internet: il file non viene mandato da nessuna parte.

> [!IMPORTANT]
> **Come si usa il Convertitore DWG → DXF**
>
> **Il modo più semplice: apri [rayuk-creator.github.io/CAD/convertitore-dwg](https://rayuk-creator.github.io/CAD/convertitore-dwg/)** e il convertitore parte subito nel browser.
>
> **Per usarlo senza internet** scarica il file e aprilo dal tuo computer (qui su GitHub il file si conserva, ma non funziona):
>
> 1. Apri il file [`index.html`](index.html) di questa cartella.
> 2. GitHub scrive che il file è troppo grande da mostrare («Sorry about that, but we can't show files that are this big right now»): **è normale**, il file è a posto. Premi il pulsante **Download raw file**: è la **freccia verso il basso**, in alto a destra. **Non** premere «Raw» né «View raw»: mostrerebbero solo il testo del programma.
> 3. Il file scaricato si chiama `index.html`, **come il Banco CAD**: rinominalo, per esempio `convertitore-dwg.html`, così non li confondi.
> 4. Aprilo con un **doppio clic**: si apre in Chrome, Edge o Firefox. Non serve internet.
> 5. Premi **Scegli i file DWG** (oppure trascina i file `.dwg` nella pagina), guarda l'**anteprima**, poi premi **Salva DXF** accanto a ogni disegno, oppure **Salva tutti i DXF (.zip)** per averli in un solo file.
> 6. Nel Banco CAD: **Progetto › Importa DXF (schizzo)** e scegli il file `.dxf` appena salvato.
>
> Funziona anche su **tablet e telefoni**: il convertitore parte con 16 MB di memoria e ne prende di più solo per i disegni grandi.

## Licenza: GNU GPL 3 (solo questa cartella)

Il convertitore usa **LibreDWG**, che ha licenza GNU GPL 3. Per questo il convertitore è un **programma separato** dal Banco CAD, con la stessa licenza GPL 3 (testo completo in `COPYING`). Il Banco CAD (`../index.html`) non contiene LibreDWG e non lo carica: rimanda solo, con un collegamento, alla pagina del convertitore.

Tutto quello che c'è in questa cartella (`index.html`, `incorpora-libredwg.js`, i file di prova) è distribuito con licenza GPL 3.

## Il lettore incorporato

| Cosa | Versione e provenienza |
|---|---|
| LibreDWG | il lettore DWG del progetto GNU, <https://www.gnu.org/software/libredwg/> |
| libredwg-web | LibreDWG compilato in WebAssembly, <https://github.com/mlightcad/libredwg-web>, versione **0.8.2** (tag `v0.8.2`; il file `.wasm` è lo stesso della 0.8.1, compilato il 17 ottobre 2026) |
| `libredwg-web.wasm` (originale) | 10 810 696 byte, SHA-256 `afb887f6fe784b14bdafd1f335b201ddb50cb24e521a07d2f2581ee2bd87bd9c` |
| `.wasm` incorporato (memoria iniziale 16 MB) | 10 810 695 byte, SHA-256 `b86785b295581aa279c6c62de172c44da06568f8957e65959577e157f6b82cd4` |
| `libredwg-web.js` | SHA-256 `62deaef11c2d6cf8fd0a0ee83d29120ca40bdabc2cdd9baa1f7911410bf9d73f` |

I **sorgenti** completi del lettore (C di LibreDWG, collegamenti Embind e istruzioni per compilarlo con Emscripten) sono nel repository libredwg-web, al tag `v0.8.2`.

**Unica modifica** (dal 29 ottobre 2026): nel file `.wasm` la **memoria iniziale** scende da 1024 MB (16 384 pagine da 64 kB, come l'ha compilato libredwg-web) a **16 MB** (256 pagine). Il massimo resta 4 GB e la memoria cresce da sola quando serve: il modulo è compilato con la crescita della memoria. La modifica la fa `incorpora-libredwg.js` (funzione `lowerMemory`): cambia solo il numero delle pagine iniziali nella sezione «memory» del modulo, dopo aver controllato che 16 MB contengano i dati fissi del programma e lo stack (2,05 MB). Il codice JavaScript non è modificato. Verifica: i DXF dei sette DWG di prova sono identici, byte per byte, a quelli del lettore originale, anche con 300 MB di memoria già occupata (prova in `tests/dwg.test.js`). Per lasciare la memoria com'era: `--memoria-mb 0`.

Nella pagina il `.wasm` è compresso con gzip e scritto in base64 in fondo al file, tra i commenti `LETTORE DWG: inizio` e `LETTORE DWG: fine`. Per aggiornarlo o sostituirlo:

```
node convertitore-dwg/incorpora-libredwg.js <cartella bindings/javascript/wasm di libredwg-web>
```

Lo strumento controlla che il lettore sappia scrivere i DXF (`dwg_write_dxf`), abbassa la memoria iniziale (opzione `--memoria-mb N`, 16 se non si dice) e scrive nella pagina le impronte SHA-256 del `.wasm` originale e di quello incorporato.

## Come funziona

- Il lettore lavora in un **Worker** (la pagina resta libera, «Annulla» interrompe); se il browser non lo permette, lavora nella pagina.
- Il DWG viene scritto nel disco virtuale del lettore, LibreDWG lo legge e scrive il DXF (della stessa versione del DWG), la pagina lo rilegge.
- Sotto ogni disegno: versione del DWG e del DXF, unità, cosa il Banco CAD leggerà (linee, archi, cerchi, polilinee, ellissi, spline, blocchi) e cosa salterà (testi, quote, tratteggi…).
- **Anteprima** del disegno, con l'ingombro: mostra quello che il Banco CAD leggerà (senza i layer spenti o congelati, i fogli di layout, i blocchi con scala diversa in x e y, i testi e le quote); l'ingombro è uguale a quello del Banco CAD.
- **Salva tutti i DXF (.zip)** (compare con almeno due disegni pronti): tutti i DXF in `disegni-dxf.zip`; due disegni con lo stesso nome diventano «nome.dxf» e «nome (2).dxf». Il Banco CAD apre lo zip e fa scegliere il disegno («Disegno nello zip»).
- **Salva DXF**: nella pagina pubblicata su claude.ai il file arriva dentro uno `.zip` (la piattaforma non fa scaricare i `.dxf` da soli); il Banco CAD apre anche lo `.zip`. Aperta da disco, la pagina scarica il `.dxf`.
- Memoria: il lettore parte con 16 MB e ne chiede di più solo quando un disegno è grande (fino a 4 GB). La compilazione di libredwg-web la fissava a 1 GB fin dall'avvio; `incorpora-libredwg.js` abbassa quel numero nel file WebAssembly (vedi sotto). Se un disegno enorme non ci sta, la pagina lo dice.

## Limiti noti

LibreDWG è ancora in sviluppo: con disegni molto complessi (blocchi dinamici, tabelle, oggetti di applicazioni verticali) qualche oggetto può mancare o essere segnalato con un avviso. Linee, archi, cerchi, polilinee, ellissi, spline e blocchi, che sono quelli che servono al Banco CAD, si convertono bene. Guardare sempre l'anteprima nella finestra di importazione del Banco CAD.

## Prove

`prove/` contiene sette DWG di prova presi dai dati di prova di libredwg-web (GPL 3), uno per versione: R11, R14, 2000, 2004, 2010, 2013, 2018. La prova `tests/dwg.test.js` del repository li converte con il lettore incorporato nella pagina e li fa leggere al Banco CAD.

| File | Versione | SHA-256 |
|---|---|---|
| `entita-r11.dwg` (anche l'esempio della pagina) | R11/R12 | `f9b37257…b877d4` |
| `v-r14.dwg` | R14 | `e296ca50…d12d3` |
| `esempio-2000.dwg` | AutoCAD 2000 | `34574244…99be9` |
| `linea-2004.dwg` | AutoCAD 2004 | `60c86e1d…0c24` |
| `cerchio-2010.dwg` | AutoCAD 2010 | `c1f4ec9a…de47` |
| `esempio-2013.dwg` | AutoCAD 2013 | `ce80953e…c18f` |
| `arco-2018.dwg` | AutoCAD 2018 | `22f3275c…c2a1` |
