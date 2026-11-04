# Licenze dei componenti esterni

Il Banco CAD ha licenza **GNU GPL 3** (Copyright © 2026 Rayuk-creator, testo in `../LICENSE`). Le parti di altri autori sono queste.

## Lettore STEP/IGES

Dentro `index.html`, in fondo alla pagina (tra i commenti «LETTORE STEP/IGES: inizio» e «fine»), ci sono:

- **occt-import-js** versione 0.0.24 di Viktor Kovacs, <https://github.com/kovacsv/occt-import-js>
  (file `occt-import-js.js` e `occt-import-js.wasm`, il secondo compresso con gzip e scritto in base64);
- che contiene **Open CASCADE Technology (OCCT)** versione 7.6.1, <https://dev.opencascade.org>, compilato in WebAssembly.

Entrambi sono distribuiti con licenza **GNU LGPL versione 2.1**; OCCT aggiunge l'eccezione di Open CASCADE. I testi completi sono in questa cartella:

- `occt-import-js-LGPL-2.1.txt`
- `opencascade-LGPL-2.1-eccezione.txt`

La libreria è inserita **senza modifiche** (impronte SHA-256 dei file originali:
`occt-import-js.js` 8b090be386bc8ffba32222aa19f38742ae8ed35707819beb7f8ab4938a28c97a,
`occt-import-js.wasm` 33391fc9d94ea5c869a6718488bf0a9a464222bac9bdc764dfe1690cef281952).
Chiunque può sostituirla con un'altra versione, anche ricompilata da sé, con:

```
node tools/incorpora-occt.js <cartella dist di occt-import-js>
```

**Codice sorgente di questa versione**, in copia su GitHub accanto al Banco CAD (fork dei progetti d'origine):

- occt-import-js 0.0.24: <https://github.com/Rayuk-creator/occt-import-js/tree/41e470890ae0f9dc69ac50ffd5fc73e03576f4eb>. Il progetto non ha un'etichetta «0.0.24»: è l'ultimo commit di `main`, «Update version» (`41e4708`); i due file di `dist` sono identici byte per byte a quelli dentro `index.html`.
- OCCT 7.6.1 (etichetta `V7_6_1`): <https://github.com/Rayuk-creator/OCCT/tree/d2abb6d844231cb8f29be6894440874a4700e4a5>. È il commit a cui occt-import-js rimanda nella cartella `occt` (sottomodulo). Il rimando punta ancora al server di Open CASCADE (`git.dev.opencascade.org`), quindi la copia di OCCT va presa da questo indirizzo: una copia di occt-import-js da sola non contiene OCCT.

Per ricompilare: scegliere in `occt-import-js` quel commit, mettere OCCT `V7_6_1` nella cartella `occt`, poi seguire gli script in `tools/` di quel progetto. Non abbiamo provato a ricompilarlo: il lettore dentro la pagina è quello pubblicato da Viktor Kovacs.

## Lettore DWG

Dentro `index.html`, in fondo alla pagina (tra i commenti «LETTORE DWG: inizio» e «fine»), c'è **LibreDWG** del progetto GNU, <https://www.gnu.org/software/libredwg/>, compilato in WebAssembly da **libredwg-web** 0.8.2, <https://github.com/mlightcad/libredwg-web>; copia dei sorgenti al commit esatto: <https://github.com/Rayuk-creator/libredwg-web/tree/45a2a217f4916daddd7bd598c900d6c698d141b6>. Licenza **GNU GPL 3**, la stessa del Banco CAD (testo in `../convertitore-dwg/COPYING`).

È identico a quello del Convertitore DWG → DXF. Versione, impronte SHA-256, sorgenti e l'unica modifica (memoria iniziale 16 MB invece di 1 GB) sono in `../convertitore-dwg/LEGGIMI.md`. Per aggiornarlo: `node convertitore-dwg/incorpora-libredwg.js <cartella wasm>`, poi `node tools/copia-lettore-dwg.js`.

## csg.js

Il modulo `CSG` di `index.html` è riscritto seguendo l'algoritmo di **csg.js** di Evan Wallace, <https://github.com/evanw/csg.js>. Licenza MIT: `csg.js-MIT.txt`.

## Metriche di Helvetica

Le tabelle `HELV` e `HELVB`, usate per scrivere i PDF, contengono le larghezze dei file AFM di Adobe. Avviso e licenza: `adobe-core14-afm.txt`.

## Caratteri IBM Plex

IBM Plex Sans (400, 500, 600), Sans Condensed (500, 600) e Mono (400, 500), parti Latin1 e Pi in WOFF2, sono dentro le due pagine in base64, tra i commenti «CARATTERI», **senza modifiche** (dal repository <https://github.com/IBM/plex>, commit `71f5589`). Licenza SIL OFL 1.1: `ibm-plex-OFL-1.1.txt`. Per aggiornarli: `node tools/incorpora-caratteri.js <cartella packages di IBM/plex>`.
