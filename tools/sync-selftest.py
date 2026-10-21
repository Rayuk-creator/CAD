# Ricopia tests/kernel.test.js nel blocco «Autoverifica» di index.html (tra il commento e la riga «})(this);»).
import sys
p, t = 'index.html', 'tests/kernel.test.js'
s = open(p, encoding='utf-8').read().split('\n')
start = next(i for i, l in enumerate(s) if l.startswith('/* Autoverifica:'))
end = next(i for i in range(start, len(s)) if s[i].startswith('} else root.SelfTest = ')) + 1
assert s[end] == '})(this);', s[end]
new = open(t, encoding='utf-8').read().rstrip('\n').split('\n')
s[start + 1:end + 1] = new
open(p, 'w', encoding='utf-8').write('\n'.join(s))
print('Autoverifica aggiornata:', len(new), 'righe')
