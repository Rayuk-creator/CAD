# Licenze dei componenti esterni

Il Banco CAD è scritto da zero, senza dipendenze, con **una sola eccezione**: il lettore dei file **STEP e IGES**.

## Lettore STEP/IGES

Dentro `index.html`, in fondo alla pagina (tra i commenti «LETTORE STEP/IGES: inizio» e «fine»), ci sono:

- **occt-import-js** versione 0.0.24 di Viktor Kovacs, <https://github.com/kovacsv/occt-import-js>
  (file `occt-import-js.js` e `occt-import-js.wasm`, il secondo compresso con gzip e scritto in base64);
- che contiene **Open CASCADE Technology (OCCT)**, <https://dev.opencascade.org>, compilato in WebAssembly.

Entrambi sono distribuiti con licenza **GNU LGPL versione 2.1**; OCCT aggiunge l'eccezione di Open CASCADE. I testi completi sono in questa cartella:

- `occt-import-js-LGPL-2.1.txt`
- `opencascade-LGPL-2.1-eccezione.txt`

La libreria è inserita **senza modifiche** (impronte SHA-256 dei file originali:
`occt-import-js.js` 8b090be386bc8ffba32222aa19f38742ae8ed35707819beb7f8ab4938a28c97a,
`occt-import-js.wasm` 33391fc9d94ea5c869a6718488bf0a9a464222bac9bdc764dfe1690cef281952).
Il codice sorgente è disponibile ai due indirizzi sopra. Chiunque può sostituirla con un'altra versione, anche ricompilata da sé, con:

```
node tools/incorpora-occt.js <cartella dist di occt-import-js>
```
