# Controllo indipendente dei PDF salvati dal Banco CAD (usato da ui.test.js): legge il file con pdfplumber, un lettore
# PDF che non ha niente in comune con il programma, e scrive in JSON le misure in millimetri.
# Uso: python3 tests/pdfcheck.py file.pdf
import json, sys
import pdfplumber
K = 25.4 / 72
out = []
with pdfplumber.open(sys.argv[1]) as pdf:
    for pg in pdf.pages:
        H = pg.height
        out.append({
            'w': pg.width * K, 'h': pg.height * K,
            'lines': [[l['x0'] * K, l['top'] * K, l['x1'] * K, l['bottom'] * K, l.get('linewidth', 0) * K] for l in pg.lines],
            'rects': [[r['x0'] * K, r['top'] * K, r['x1'] * K, r['bottom'] * K] for r in pg.rects],
            'curves': len(pg.curves),
            'words': [{'t': w['text'], 'x0': w['x0'] * K, 'x1': w['x1'] * K, 'top': w['top'] * K, 'bottom': w['bottom'] * K} for w in pg.extract_words(keep_blank_chars=True, use_text_flow=True)],
            'text': pg.extract_text() or '',
            'chars': len(pg.chars),
            'images': [{'src': list(i['srcsize']), 'x0': i['x0'] * K, 'top': i['top'] * K, 'w': i['width'] * K, 'h': i['height'] * K} for i in pg.images],
        })
print(json.dumps(out))
