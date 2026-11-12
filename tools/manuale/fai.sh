#!/bin/bash
# Rifà il manuale. Uso, dalla cartella del repository: bash tools/manuale/fai.sh <cartella di lavoro> [it|en]
# Senza lingua: italiano (docs/Manuale-Banco-CAD.pdf); con en: inglese, schermate in inglese (docs/Manual-Banco-CAD.pdf).
# Usare una cartella di lavoro diversa per ogni lingua.
# Con CHROMIUM_PATH se serve. Passi: testi da index.html, schermate (esercizio eseguito con il mouse), impaginazione in due giri
# (il secondo scrive i numeri di pagina nell'indice), segnalibri, controllo.
set -e
export MANUALE_LINGUA=${2:-it}
case "$MANUALE_LINGUA" in it) OUT=Manuale-Banco-CAD.pdf;; en) OUT=Manual-Banco-CAD.pdf;; *) echo "lingua sconosciuta: $MANUALE_LINGUA"; exit 1;; esac
D=$(cd "$(dirname "$0")" && pwd); W=$(mkdir -p "$1" && cd "$1" && pwd); mkdir -p "$W/img"; rm -f "$W/pages.json"
node "$D/dump.js" "$W/data.json"
node "$D/esercizio.js" "$W/img" | grep -v '^shot'
node "$D/schermate.js" "$W/img" | grep -v '^shot' || true
python3 -c "
from PIL import Image
im=Image.open('$W/img/es-8-finito.png');w,h=im.size;im.crop((int(w*.24),int(h*.27),int(w*.98),int(h*.93))).save('$W/img/es-8-crop.png')"
python3 "$D/build.py" "$W"; node "$D/render.js" "$W"; python3 "$D/pages.py" "$W"
python3 "$D/build.py" "$W"; node "$D/render.js" "$W"; python3 "$D/pages.py" "$W"
python3 "$D/finish.py" "$W"; python3 "$D/check.py" "$W"
cp "$W/$OUT" "$D/../../docs/$OUT"
