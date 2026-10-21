# Idee e lavori futuri

Promemoria delle cose discusse ma **non ancora fatte**. Da leggere all'inizio di una nuova sessione di lavoro.

## Importare file di altri programmi

Il 20 ottobre 2026 abbiamo valutato l'importazione di altri formati. Il 21 ottobre sono stati fatti **STL e OBJ** (Progetto › Importa STL o OBJ, funzione «Importato»), **DXF negli schizzi** (Progetto › Importa DXF (schizzo), Schizzo › Inserisci DXF) e **STEP/IGES** (Progetto › Importa STEP o IGES). Valutazione:

| Formato | Fattibile? | Risultato | Note |
|---|---|---|---|
| STL, OBJ | Sì, facile | Solido a faccette da vedere, misurare, mettere in tavola, calcolarne volume e massa | **Fatto** il 21 ottobre 2026 |
| DXF | Sì, medio | Linee, archi e cerchi importati in uno schizzo, poi estrusione o rivoluzione | **Fatto** il 21 ottobre 2026 (polilinee con tratti curvi, blocchi, unità, assi tratto-punto → mezzerie; ellissi e spline come archi tangenti) |
| STEP (.stp, .step), IGES (.igs, .iges) | Sì, impegnativo | Solido con le facce vere, diviso in triangoli fitti (errore su volume e massa molto sotto l'1 %) | **Fatto** il 21 ottobre 2026 con occt-import-js (OpenCascade in WebAssembly, LGPL 2.1), compresso dentro `index.html`: la pagina passa da ~0,8 MB a ~5 MB |
| DWG | Difficile | — | Formato chiuso di AutoCAD; consigliare la conversione in DXF (AutoCAD, DraftSight o ODA File Converter gratuito) |
| SolidWorks (.sldprt, .sldasm, .slddrw), Inventor (.ipt, .iam, .idw, .ipn) | No | — | Formati proprietari senza specifiche pubbliche; consigliare di esportare in STEP (parti, assiemi) o DXF (tavole) dal programma d'origine |

Limite comune: i pezzi importati arrivano **senza la storia delle funzioni** (le quote originali non si modificano); si possono aggiungere funzioni nuove sopra. Gli schizzi DXF arrivano senza quote (blu): si possono quotare.

Miglioramenti del DXF **fatti** il 21 ottobre: ellissi e spline (biarchi, scostamento ≤ 1/10 000 della dimensione minore), scelta dei layer e anteprima nella finestra, bordo di un foro ellittico o a spline scelto con un clic e raccordato tutto insieme («spigolo curvo»). Resta, eventualmente: meno archi per curva (punto di giunzione dei biarchi scelto meglio); raccordo che si propaga agli spigoli tangenti (curve aperte, asole).

Miglioramenti di STEP/IGES **fatti** il 21 ottobre: scelta dei corpi di un assieme, colori delle facce, lettura in un Worker (pagina libera, si può annullare). Restano: spigolo visibile tra due facce vere complanari; colori anche nella messa in tavola; un «Importato» per ogni corpo (oggi i corpi scelti arrivano insieme).

## Cablaggio 3D da un disegno PDF (harness)

Idea del 20 ottobre 2026: trasformare il disegno di un cablaggio in un modello 3D. **In automatico non si può**: nel PDF le linee dei fasci non si distinguono da quote, squadratura, tabelle e simboli, e il disegno mostra il cablaggio steso sul banco di montaggio (formboard), non il percorso reale nella macchina.

Versione **semi-automatica** fattibile (il lettore DXF ora c'è: `Import.parseDXF`; per i PDF vettoriali servirebbe pdf.js, da incorporare come il lettore STEP):

1. Importare il PDF **vettoriale** (non scansionato) come schizzo 2D, per esempio con pdf.js.
2. L'utente clicca le linee che sono fasci e assegna a ciascuno il diametro (anche dalla tabella dei fili).
3. Il programma fa scorrere un cerchio lungo ogni fascio con l'**estrusione con percorso** già esistente, unendo le diramazioni.
4. Ai capi mette dei blocchetti al posto dei connettori.

Risultato: il cablaggio 3D steso in piano. Ellissi e spline del DXF sono pronte: è il prossimo lavoro grande, da confermare con l'utente.

## Disegno 2D libero (come in AutoCAD), da aggiungere a ciò che esiste

Deciso con l'utente il 21 ottobre 2026: **prossimo lavoro grande**, da fare in una chat nuova. Si **aggiunge** al programma: schizzo, funzioni 3D, messa in tavola, esercitazioni, importazioni e progetti già salvati restano come sono, e tutte le prove esistenti devono continuare a passare.

- **Stile**: base SolidWorks («tavola senza modello»: gli stessi strumenti dello schizzo, con relazioni e quote che comandano il disegno), più i comandi AutoCAD utili: **Offset, Copia, Sposta, Ruota** (e dove serve Taglia, Estendi).
- **Contenuto** (l'utente ha detto «sì a tutto»): linee, archi, cerchi, rettangoli; quote; testi; tratteggi; tipi di linea (continua, tratteggiata, mezzeria); cartiglio e fogli A4–A2; stampa e salvataggio in DXF (e SVG); **layer**; **blocchi**; **tolleranze**; **rugosità**.
- **Collegamento al 3D**: poter usare un disegno 2D come schizzo per fare un pezzo.
- Da chiarire all'inizio della chat nuova: dove sta il comando (scheda nuova o dentro «Messa in tavola»), come si salva insieme al progetto, ordine dei lavori (prima le basi, poi layer, blocchi, tolleranze e rugosità). Ogni comando nuovo nella Guida, ogni termine nel Glossario, prove con valori calcolati a mano.

## Altro ancora da fare

- La pagina pubblicata su claude.ai (artifact «Banco CAD») è aggiornata al 21 ottobre sera (tutto compreso); la versione di riferimento resta `index.html` in questo repository.
