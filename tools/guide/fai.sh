#!/bin/bash
# Rifà le due guide PDF (ingranaggio, elica). Uso: bash tools/guide/fai.sh
# Esegue i passaggi nel Banco CAD (circa 5 minuti), fa le schermate e scrive i PDF in tools/guide/out (fuori da git).
set -e
cd "$(dirname "$0")"; mkdir -p img out
export NODE_PATH=${NODE_PATH:-$(npm root -g)}
node gear.js 2 20 g > gear.log 2>&1 &
A=$!
node prop.js > prop.log 2>&1 &
B=$!
wait $A; wait $B
grep -E "STATO VANO|errori" gear.log; grep -A1 "^massa" gear.log | grep "V:"; grep -A1 "^massa" prop.log | grep "V:"
python3 gear_doc.py; python3 prop_doc.py; node render.js ingranaggio elica
python3 - <<'P' 2>/dev/null
from pypdf import PdfWriter
for n,out,t,s in (('ingranaggio','Come-creare-un-ingranaggio','Come creare un ingranaggio – Banco CAD','Guida passo per passo: ruota dentata a denti dritti, modulo 2, 20 denti'),('elica','Come-creare-un-elica',"Come creare un'elica – Banco CAD",'Guida passo per passo: elica a 3 pale, Ø200 mm')):
    w=PdfWriter(clone_from=f'out/{n}.pdf');w.add_metadata({'/Title':t,'/Author':'Rayuk-creator','/Subject':s});w.write(f'out/{out}.pdf')
P
ls -la out/Come-*.pdf
