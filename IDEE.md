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

## Cablaggio 3D da un disegno PDF (harness)

Idea del 20 ottobre 2026: trasformare il disegno di un cablaggio in un modello 3D. **In automatico non si può**: nel PDF le linee dei fasci non si distinguono da quote, squadratura, tabelle e simboli, e il disegno mostra il cablaggio steso sul banco di montaggio (formboard), non il percorso reale nella macchina.

Versione **semi-automatica** fattibile (va insieme all'importazione DXF):

1. Importare il PDF **vettoriale** (non scansionato) come schizzo 2D, per esempio con pdf.js.
2. L'utente clicca le linee che sono fasci e assegna a ciascuno il diametro (anche dalla tabella dei fili).
3. Il programma fa scorrere un cerchio lungo ogni fascio con l'**estrusione con percorso** già esistente, unendo le diramazioni.
4. Ai capi mette dei blocchetti al posto dei connettori.

Risultato: il cablaggio 3D steso in piano. Da affrontare dopo l'importazione DXF negli schizzi.

## Altro ancora da fare

- La pagina pubblicata su claude.ai (artifact «Banco CAD») è ferma alla versione del 13 ottobre; la versione aggiornata è `index.html` in questo repository.
