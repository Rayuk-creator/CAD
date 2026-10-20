# Idee e lavori futuri

Promemoria delle cose discusse ma **non ancora fatte**. Da leggere all'inizio di una nuova sessione di lavoro.

## Importare file di altri programmi

Oggi il Banco CAD apre solo i propri progetti (Progetto › Importa un progetto) e salva in STL, SVG e DXF. Il 20 ottobre 2026 abbiamo valutato l'importazione di altri formati e si è deciso di **rimandare**. Valutazione:

| Formato | Fattibile? | Risultato | Note |
|---|---|---|---|
| STL, OBJ | Sì, facile | Solido a faccette da vedere, misurare, mettere in tavola, calcolarne volume e massa | Da fare per primo |
| DXF | Sì, medio | Linee, archi e cerchi importati in uno schizzo, poi estrusione o rivoluzione | Il più utile a scuola; secondo da fare |
| STEP (.stp, .step), IGES (.igs, .iges) | Sì, impegnativo | Solido con le superfici vere | Serve un nucleo esterno (OpenCascade in WebAssembly): il file passa da ~0,5 MB a decine di MB |
| DWG | Difficile | — | Formato chiuso di AutoCAD; consigliare la conversione in DXF (AutoCAD, DraftSight o ODA File Converter gratuito) |
| SolidWorks (.sldprt, .sldasm, .slddrw), Inventor (.ipt, .iam, .idw, .ipn) | No | — | Formati proprietari senza specifiche pubbliche; consigliare di esportare in STEP (parti, assiemi) o DXF (tavole) dal programma d'origine |

Limite comune: i pezzi importati arrivano **senza la storia delle funzioni** (le quote originali non si modificano); si possono aggiungere funzioni nuove sopra.

## Altro ancora da fare

- La pagina pubblicata su claude.ai (artifact «Banco CAD») è ferma alla versione del 13 ottobre; la versione aggiornata è `index.html` in questo repository.
