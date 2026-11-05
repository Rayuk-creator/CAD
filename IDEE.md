# Idee e lavori futuri

Promemoria delle cose discusse ma **non ancora fatte**. Da leggere all'inizio di una nuova sessione di lavoro.

## PRIMO LAVORO: traduzione in inglese (per la settimana del 9 novembre 2026)

Scelta dell'utente del 5 novembre: **è il primo lavoro della settimana prossima**. Tradurre tutto il programma in inglese, lasciando l'italiano come lingua normale e l'inglese da scegliere con un comando.

Testo misurato il 5 novembre in `index.html` (conteggio automatico, approssimato). Tempi stimati: in tutto 6-10 ore di lavoro, su 3-5 chat, a tappe:

1. **Interfaccia e scelta della lingua** (3-5 ore): circa 1.050 frasi, 8.700 parole, più le etichette di una parola sola (almeno 180). Attenzione a: messaggi composti a pezzi con numeri e plurali, numeri scritti in formato italiano (`toLocaleString('it-IT')`), nomi dei comandi da prendere dalla versione inglese di SolidWorks (da controllare su fonti esterne: l'utente non ha SolidWorks).
2. **Glossario** (1 ora): circa 8.100 parole.
3. **Guida** (1 ora): circa 7.000 parole.
4. **Manuale PDF in inglese**, con le schermate rifatte (1-2 ore): capitoli scritti a mano in `tools/manuale/build.py` (circa 3.000 parole, codice compreso), più Guida e Glossario già tradotti.
5. **Convertitore DWG e prove in inglese** (circa 1 ora; testo del Convertitore non ancora misurato): una prova che cerca le frasi rimaste in italiano nella versione inglese.

L'Autoverifica (5.400 parole) è proposta fuori dalla traduzione: i nomi delle prove possono restare in italiano. Il lavoro consuma molto del limite settimanale dell'utente: dopo ogni tappa il programma deve restare usabile.

## SECONDO LAVORO: rendere installabile il Banco CAD (dopo la traduzione)

Scelta dell'utente del 5 novembre: subito dopo la traduzione, così pulsante e avvisi nascono già in due lingue e le schermate del manuale si rifanno una volta sola. Installazione dal browser (PWA, come il pulsante «Installa» del gioco di Matematica), **non** un installatore classico per Windows (oltre 100 MB, firma a pagamento). Tempo stimato: 1-2 ore, prove comprese.

- **Solo dal sito GitHub Pages:** da disco e su claude.ai non si installa, e il programma funziona come oggi. Sul sito servono file in più (descrizione dell'app, icone, service worker); `index.html` deve restare completo e funzionante da solo.
- **Aggiornamenti:** il punto da curare di più. Serve un avviso «nuova versione disponibile», perché nessuno resti su una versione vecchia senza saperlo.
- **iPhone e iPad:** il pulsante non compare da solo: breve messaggio con Condividi › Aggiungi alla schermata Home.
- **Manuale PDF (scelta dell'utente del 5 novembre):** solo online, non salvato per l'uso offline. Basta la voce che rimanda al PDF sul sito (Progetto › Manuale d'uso (PDF), già presente).
- **Da provare:** che il lavoro salvato sul sito si ritrovi nella versione installata. Esporta resta il vero salvataggio.

## Google Play (rimandato il 5 novembre 2026)

Scelta dell'utente: non ora. Con l'installazione dal browser, chi ha Android può già installare il Banco CAD, e un CAD si usa soprattutto su PC. **Da riprendere solo quando insegnanti o studenti useranno il programma**: si avrebbero già i tester e si saprebbe se serve davvero su Android.

Motivi e controlli del 5 novembre (da ricontrollare prima di decidere, le regole cambiano):

- **12 tester iscritti di continuo per 14 giorni** con un account personale nuovo, poi domanda a Google, esame di solito entro 7 giorni (pagina ufficiale di Google Play Console).
- **Nome vero in pubblico:** un account personale mostrerebbe il nome completo del documento, con verifica tramite documento e selfie (solo una guida non ufficiale, appswap.pages.dev). Il Banco CAD è a nome Rayuk-creator: **controllare sulle pagine ufficiali prima di decidere**.
- **25 dollari una volta sola**, non rimborsabili (stessa guida non ufficiale).
- **Lavoro in più:** informativa sulla privacy, moduli sui dati e sull'età, grafica, chiave di firma da conservare (guida non ufficiale, spacenexus.us). L'aggiornamento periodico del pacchetto dell'app non è stato verificato.
- **Sito:** il file `.well-known/assetlinks.json` va nella radice del dominio, mentre il Banco CAD sta in `rayuk-creator.github.io/CAD`: quasi certamente serve un secondo repository per la radice del sito o un dominio proprio.

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

Chiesto dall'utente il 28 ottobre 2026. **La base è fatta il 4 novembre 2026** (scelte dell'utente: parti dentro il progetto; nel primo lavoro solo la base, con un assieme per progetto e senza sottoassiemi, poi aggiunti lo stesso giorno): vedi `RIPARTENZA.md`.

**Fatti il 4 novembre, pomeriggio (fino alle 16):** sottoassieme flessibile; Verifica interferenze dentro i sottoassiemi; Tangente, anche sulle superfici libere degli STEP; piani e origine nell'albero sopra la vista; numeri di posizione trascinabili; direzione dell'esplosione da una faccia; distinta base in CSV.

**Fatti il 4 novembre:** calcoli sull'assieme (massa, distinta base, interferenze); vista esplosa e tavola dell'assieme; più assiemi e sottoassiemi; tori degli STEP; piani e origine nella vista; accoppiamenti con i piani e l'origine delle parti; coni e sfere nelle facce curve degli STEP; vertici che si ritrovano quando cambia la parte.
- Se servirà: parti collegate a file separati (scartate per ora: funzionerebbero solo in Chrome ed Edge).

## Viti, bulloni e filettature

**Fatti il 4 novembre 2026** (vedi `RIPARTENZA.md`), compresi smussi, filetti nelle sezioni, Vite nel foro ed elica vera.

## Licenza e pubblicazione su AlternativeTo (controllo del 1° novembre 2026)

L'utente vuole inserire il Banco CAD su **AlternativeTo**. Controllo fatto su tutto il repository (non è un parere legale). **Licenza consigliata e accettata dall'utente: GNU GPL 3** (resta libero; stessa licenza del Convertitore; permetterebbe di rimettere il lettore DWG dentro il Banco CAD; la LGPL 2.1 di OpenCascade è compatibile). **Decisioni del 3 novembre:** copyright a nome **Rayuk-creator**; le 8 esercitazioni sono state **tolte**.

**Fatti il 3 novembre:** punti 1, 2, 3, 4, 6, 7 e 8; il 4 novembre il punto 5 (riga «scritto con l'aiuto di Claude» nei README; file `LICENSE`, avvisi di csg.js e Adobe, finestra «Informazioni e licenze», marchi, caratteri dentro le pagine, riga sulla privacy).

Cose ancora da fare:

5. **Sorgenti di occt-import-js «nello stesso posto»** (LGPL 2.1, punto 6d): **fatto** il 4 novembre con due fork (`Rayuk-creator/occt-import-js` e `Rayuk-creator/OCCT`, vedi `licenze/LEGGIMI.md`). Fatto il 4 novembre anche per libredwg-web 0.8.2 (`Rayuk-creator/libredwg-web`).
9. **Dopo:** scheda AlternativeTo (la fa l'utente con il suo account; io preparo i testi in inglese: nome, descrizione breve e lunga, piattaforma «Online», categorie, alternative: SolidWorks, FreeCAD, Onshape, Tinkercad, Fusion; schermate da `docs/img`). **Rischio:** AlternativeTo rifiuta spesso i programmi non in inglese; per questo l'utente ha deciso il 5 novembre di tradurre prima tutto il programma (vedi in cima a questo file).

## Tutela del nome e dell'autore (4 novembre 2026)

Il marchio ora costa troppo. **Fatti:** condizioni aggiuntive GPL 3 sezione 7 (`CONDIZIONI-AGGIUNTIVE.md`), impronta SHA-256 di una frase nota solo all'autore (`IMPRONTA.md`). **Restano all'utente, se vuole:** archiviare il repository su Software Heritage, mandarsi una PEC con il file e l'impronta, conservare le prove del collegamento con «Rayuk-creator» e dell'uso del nome. Il deposito del marchio resta possibile più avanti.

## Altro ancora da fare

- Sfondo del disegno: **fatti** il 3 novembre testi e quote, il 4 novembre tratteggi, tolleranze geometriche, MULTILEADER e tabelle (limite: le tabelle dei DWG dal 2010 in poi, che LibreDWG non scrive).
- Convertitore DWG → DXF: **fatti** il 29 ottobre memoria iniziale 16 MB (invece di 1 GB), anteprima del disegno, più file in un solo .zip.
- Le pagine pubblicate su claude.ai: «Banco CAD» (versione 24 del 5 novembre) e «Convertitore DWG → DXF» (3 novembre notte) sono condivise con chiunque abbia il link. Il Banco CAD su claude.ai è stato ripubblicato il 5 novembre con tutti i lavori fino a quel momento. La versione di riferimento resta `index.html` in questo repository.
