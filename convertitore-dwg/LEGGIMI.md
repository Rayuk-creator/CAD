# Convertitore DWG → DXF

Pagina a parte del Banco CAD: trasforma i disegni di AutoCAD (`.dwg`) in file DXF, che il Banco CAD apre con **Progetto › Importa DXF (schizzo)**. La conversione avviene nel browser, senza internet: il file non viene mandato da nessuna parte.

## Licenza: GNU GPL 3 (solo questa cartella)

Il convertitore usa **LibreDWG**, che ha licenza GNU GPL 3. Per questo il convertitore è un **programma separato** dal Banco CAD, con la stessa licenza GPL 3 (testo completo in `COPYING`). Il Banco CAD (`../index.html`) non contiene LibreDWG e non lo carica: rimanda solo, con un collegamento, alla pagina del convertitore.

Tutto quello che c'è in questa cartella (`index.html`, `incorpora-libredwg.js`, i file di prova) è distribuito con licenza GPL 3.

## Il lettore incorporato

| Cosa | Versione e provenienza |
|---|---|
| LibreDWG | il lettore DWG del progetto GNU, <https://www.gnu.org/software/libredwg/> |
| libredwg-web | LibreDWG compilato in WebAssembly, <https://github.com/mlightcad/libredwg-web>, versione **0.8.2** (tag `v0.8.2`; il file `.wasm` è lo stesso della 0.8.1, compilato il 17 ottobre 2026) |
| `libredwg-web.wasm` | 10 810 696 byte, SHA-256 `afb887f6fe784b14bdafd1f335b201ddb50cb24e521a07d2f2581ee2bd87bd9c` |
| `libredwg-web.js` | SHA-256 `62deaef11c2d6cf8fd0a0ee83d29120ca40bdabc2cdd9baa1f7911410bf9d73f` |

I **sorgenti** completi del lettore (C di LibreDWG, collegamenti Embind e istruzioni per compilarlo con Emscripten) sono nel repository libredwg-web, al tag `v0.8.2`. Il lettore non è modificato.

Nella pagina il `.wasm` è compresso con gzip e scritto in base64 in fondo al file, tra i commenti `LETTORE DWG: inizio` e `LETTORE DWG: fine`. Per aggiornarlo o sostituirlo:

```
node convertitore-dwg/incorpora-libredwg.js <cartella bindings/javascript/wasm di libredwg-web>
```

Lo strumento controlla che il lettore sappia scrivere i DXF (`dwg_write_dxf`) e scrive nella pagina le impronte SHA-256.

## Come funziona

- Il lettore lavora in un **Worker** (la pagina resta libera, «Annulla» interrompe); se il browser non lo permette, lavora nella pagina.
- Il DWG viene scritto nel disco virtuale del lettore, LibreDWG lo legge e scrive il DXF (della stessa versione del DWG), la pagina lo rilegge.
- Sotto ogni disegno: versione del DWG e del DXF, unità, cosa il Banco CAD leggerà (linee, archi, cerchi, polilinee, ellissi, spline, blocchi) e cosa salterà (testi, quote, tratteggi…).
- **Salva DXF**: nella pagina pubblicata su claude.ai il file arriva dentro uno `.zip` (la piattaforma non fa scaricare i `.dxf` da soli); il Banco CAD apre anche lo `.zip`. Aperta da disco, la pagina scarica il `.dxf`.
- Il lettore chiede al browser circa 1 GB di memoria: su un telefono o un tablet vecchio può non bastare (la pagina lo dice).

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
