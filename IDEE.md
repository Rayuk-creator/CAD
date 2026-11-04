# Idee e lavori futuri

Promemoria delle cose discusse ma **non ancora fatte**. Da leggere all'inizio di una nuova sessione di lavoro.

## Importare file di altri programmi

Il 20 ottobre 2026 abbiamo valutato l'importazione di altri formati. Il 21 ottobre sono stati fatti **STL e OBJ** (Progetto › Importa STL o OBJ, funzione «Importato»), **DXF negli schizzi** (Progetto › Importa DXF (schizzo), Schizzo › Inserisci DXF) e **STEP/IGES** (Progetto › Importa STEP o IGES). Valutazione:

| Formato | Fattibile? | Risultato | Note |
|---|---|---|---|
| STL, OBJ | Sì, facile | Solido a faccette da vedere, misurare, mettere in tavola, calcolarne volume e massa | **Fatto** il 21 ottobre 2026 |
| DXF | Sì, medio | Linee, archi e cerchi importati in uno schizzo, poi estrusione o rivoluzione | **Fatto** il 21 ottobre 2026 (polilinee con tratti curvi, blocchi, unità, assi tratto-punto → mezzerie; ellissi e spline come archi tangenti); dal 22 ottobre **senza limite di entità** (tavole intere, decine di migliaia di elementi) |
| STEP (.stp, .step), IGES (.igs, .iges) | Sì, impegnativo | Solido con le facce vere, diviso in triangoli fitti (errore su volume e massa molto sotto l'1 %) | **Fatto** il 21 ottobre 2026 con occt-import-js (OpenCascade in WebAssembly, LGPL 2.1), compresso dentro `index.html`: la pagina passa da ~0,8 MB a ~5 MB |
| DWG | Difficile | Disegno negli schizzi, come un DXF | **Fatto**: il 22 ottobre 2026 il Convertitore DWG → DXF (pagina separata, cartella `convertitore-dwg/`, LibreDWG), il 3 novembre il lettore **dentro il Banco CAD** (pagina ≈ 9 MB). Il Convertitore resta per salvare i DXF |
| Esportare STEP (per gli altri CAD) | Sì | Solido in mm con le superfici vere | **Fatto** il 28 ottobre 2026 (Progetto › Esporta STEP); dal 29 ottobre piani, cilindri, coni, sfere e tori sono superfici vere (bordi a cerchio o ellisse); dal 3 novembre i bordi più complicati sono B-spline |
| SolidWorks (.sldprt, .sldasm, .slddrw), Inventor (.ipt, .iam, .idw, .ipn) | No | — | Formati proprietari senza specifiche pubbliche; consigliare di esportare in STEP (parti, assiemi) o DXF (tavole) dal programma d'origine |

Limite comune: i pezzi importati arrivano **senza la storia delle funzioni** (le quote originali non si modificano); si possono aggiungere funzioni nuove sopra. Gli schizzi DXF arrivano senza quote (blu): si possono quotare.

Miglioramenti del DXF **fatti** il 21 ottobre: ellissi e spline (biarchi, scostamento ≤ 1/10 000 della dimensione minore), scelta dei layer e anteprima nella finestra, bordo di un foro ellittico o a spline scelto con un clic e raccordato tutto insieme («spigolo curvo»). Fatto anche il raccordo che si propaga agli spigoli tangenti (asole, curve aperte), il 21 ottobre notte. Fatto il 22 ottobre: tolto il limite di 3000 entità (schizzi grandi veloci). Fatto il 29 ottobre: circa il 40 % di archi in meno per curva, con la tolleranza misurata davvero.

Miglioramenti di STEP/IGES **fatti** il 21 ottobre: scelta dei corpi di un assieme, colori delle facce, lettura in un Worker (pagina libera, si può annullare). Fatti il 21 ottobre notte: colori nella messa in tavola (assonometria ombreggiata) e un «Importato» per ogni corpo..

## Cablaggio 3D da un disegno PDF (harness)

Idea del 20 ottobre 2026: trasformare il disegno di un cablaggio in un modello 3D. **In automatico non si può**: nel PDF le linee dei fasci non si distinguono da quote, squadratura, tabelle e simboli, e il disegno mostra il cablaggio steso sul banco di montaggio (formboard), non il percorso reale nella macchina.

Versione **semi-automatica** fattibile (il lettore DXF ora c'è: `Import.parseDXF`; per i PDF vettoriali servirebbe pdf.js, da incorporare come il lettore STEP):

1. Importare il PDF **vettoriale** (non scansionato) come schizzo 2D, per esempio con pdf.js.
2. L'utente clicca le linee che sono fasci e assegna a ciascuno il diametro (anche dalla tabella dei fili).
3. Il programma fa scorrere un cerchio lungo ogni fascio con l'**estrusione con percorso** già esistente, unendo le diramazioni.
4. Ai capi mette dei blocchetti al posto dei connettori.

Risultato: il cablaggio 3D steso in piano. Ellissi e spline del DXF sono pronte.

## Assiemi con gli accoppiamenti (come SolidWorks)

Chiesto dall'utente il 28 ottobre 2026. **La base è fatta il 4 novembre 2026** (scelte dell'utente: parti dentro il progetto, solo la base nel primo lavoro, un assieme per progetto, senza sottoassiemi): vedi `RIPARTENZA.md`.

**Ancora da fare, in una chat nuova:**

- **Presentazione** (dopo): vista esplosa e tavola dell'assieme.
- Più assiemi per progetto e sottoassiemi.
- Tori e superfici libere nelle facce curve degli STEP; scegliere piani e origine anche nella vista.

**Fatti il 4 novembre:** calcoli sull'assieme (massa, distinta base, interferenze); accoppiamenti con i piani e l'origine delle parti; coni e sfere nelle facce curve degli STEP; vertici che si ritrovano quando cambia la parte.
- Se servirà: parti collegate a file separati (scartate per ora: funzionerebbero solo in Chrome ed Edge).

## Viti, bulloni e filettature (lavoro successivo, chiesto il 4 novembre 2026)

Oggi ci sono solo i **fori** per le viti (Creazione guidata fori, M3–M20): il foro filettato è il foro di preparazione, senza filetto nel pezzo 3D, e non ci sono viti, bulloni, dadi e rondelle da inserire. **L'utente ha chiesto di segnarlo come lavoro successivo.** Da chiarire all'inizio:

- Quali pezzi: viti (ISO 4762 a testa cilindrica, ISO 10642 svasate, ISO 4017/4014 a testa esagonale), dadi (ISO 4032), rondelle (ISO 7089), e con quali misure di norma.
- La filettatura: filetto indicato (cosmetico), come di solito in SolidWorks, oppure elica vera nel 3D, molto più pesante da calcolare.
- Come si inseriscono nell'assieme: una raccolta di parti pronte, da mettere nel foro con gli accoppiamenti.

## Licenza e pubblicazione su AlternativeTo (controllo del 1° novembre 2026)

L'utente vuole inserire il Banco CAD su **AlternativeTo**. Controllo fatto su tutto il repository (non è un parere legale). **Licenza consigliata e accettata dall'utente: GNU GPL 3** (resta libero; stessa licenza del Convertitore; permetterebbe di rimettere il lettore DWG dentro il Banco CAD; la LGPL 2.1 di OpenCascade è compatibile). **Decisioni del 3 novembre:** copyright a nome **Rayuk-creator**; le 8 esercitazioni sono state **tolte**.

**Fatti il 3 novembre:** punti 1, 2, 3, 4, 6, 7 e 8; il 4 novembre il punto 5 (riga «scritto con l'aiuto di Claude» nei README; file `LICENSE`, avvisi di csg.js e Adobe, finestra «Informazioni e licenze», marchi, caratteri dentro le pagine, riga sulla privacy).

Cose ancora da fare:

5. **Sorgenti di occt-import-js «nello stesso posto»** (LGPL 2.1, punto 6d): **fatto** il 4 novembre con due fork (`Rayuk-creator/occt-import-js` e `Rayuk-creator/OCCT`, vedi `licenze/LEGGIMI.md`). Facoltativo lo stesso per libredwg-web 0.8.2 (la GPL 3 permette già i sorgenti su un altro server): chiesto il 4 novembre, il fork lo deve fare l'utente (vedi `RIPARTENZA.md`).
9. **Dopo:** scheda AlternativeTo (la fa l'utente con il suo account; io preparo i testi in inglese: nome, descrizione breve e lunga, piattaforma «Online», categorie, alternative: SolidWorks, FreeCAD, Onshape, Tinkercad, Fusion; schermate da `docs/img`). **Rischio:** AlternativeTo rifiuta spesso i programmi non in inglese; l'interfaccia in inglese sarebbe un lavoro grande (tutti i testi, Guida 54 argomenti, Glossario 199 termini), da decidere con l'utente.

## Tutela del nome e dell'autore (4 novembre 2026)

Il marchio ora costa troppo. **Fatti:** condizioni aggiuntive GPL 3 sezione 7 (`CONDIZIONI-AGGIUNTIVE.md`), impronta SHA-256 di una frase nota solo all'autore (`IMPRONTA.md`). **Restano all'utente, se vuole:** archiviare il repository su Software Heritage, mandarsi una PEC con il file e l'impronta, conservare le prove del collegamento con «Rayuk-creator» e dell'uso del nome. Il deposito del marchio resta possibile più avanti.

## Altro ancora da fare

- Sfondo del disegno: **fatti** il 3 novembre testi e quote, il 4 novembre tratteggi, tolleranze geometriche, MULTILEADER e tabelle (limite: le tabelle dei DWG dal 2010 in poi, che LibreDWG non scrive).
- Convertitore DWG → DXF: **fatti** il 29 ottobre memoria iniziale 16 MB (invece di 1 GB), anteprima del disegno, più file in un solo .zip.
- Le pagine pubblicate su claude.ai: «Banco CAD» (versione 21 del 4 novembre) e «Convertitore DWG → DXF» (3 novembre notte) sono condivise con chiunque abbia il link. **Il Banco CAD su claude.ai non è aggiornato**: mancano sfondo completo, Ambito funzione, condizioni aggiuntive e assiemi; si ripubblica se l'utente lo chiede. La versione di riferimento resta `index.html` in questo repository.
