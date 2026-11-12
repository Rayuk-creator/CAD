# Calcolo indipendente del volume dell'elica svergolata della guida (fuori dal Banco CAD).
# Pala: loft per tre sezioni (piani a y = 0, 50, 105; angoli 45°, 29°, 15°), ognuna con dorso R60, ventre R90 e bordi da 1 mm.
# Tra le sezioni i punti corrispondenti seguono una curva di Hermite con tangenti di Catmull-Rom (agli estremi curva di secondo
# grado): è la definizione del loft. Il volume si integra per fette orizzontali, tagliate dal contorno visto di fronte.
import math, numpy as np

def sec_points(beta):
    t = math.radians(beta); u = np.array([math.cos(t), math.sin(t)]); n = np.array([-u[1], u[0]])
    P = lambda s, k: np.round(s * 25 * u + k * .5 * n, 2)
    return P(1, 1), P(1, -1), P(-1, 1), P(-1, -1), n          # AU, AL, BU, BL

def arc_pts(a, b, R, side, m):
    # arco da a a b di raggio R, piegato verso «side»: punti alla frazione i/m dell'angolo
    mid = (a + b) / 2; d = b - a; L = np.linalg.norm(d); t = d / L; N = np.array([-t[1], t[0]])
    if N.dot(side) < 0: N = -N
    c = mid - N * math.sqrt(R * R - L * L / 4)
    a0 = math.atan2(*(a - c)[::-1]); a1 = math.atan2(*(b - c)[::-1])
    da = (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
    return [c + R * np.array([math.cos(a0 + da * i / m), math.sin(a0 + da * i / m)]) for i in range(m)]

M = 400   # punti per arco (curva quasi esatta)
def loop(beta):
    AU, AL, BU, BL, n = sec_points(beta)
    # giro chiuso: dorso AU→BU, bordo BU→BL, ventre BL→AL, bordo AL→AU (stesso ordine per i tre profili)
    pts = arc_pts(AU, BU, 60, n, M) + [BU] + arc_pts(BL, AL, 90, n, M) + [AL]
    return np.array(pts)

Y = [0.0, 50.0, 105.0]; B = [45, 29, 15]
L3 = [loop(b) for b in B]
def area_c(P):
    x, s = P[:, 0], P[:, 1]; x2, s2 = np.roll(x, -1), np.roll(s, -1); w = x * s2 - x2 * s
    A = w.sum() / 2; return A, np.array([((x + x2) * w).sum(), ((s + s2) * w).sum()]) / (6 * A)
cents = [np.array([c[0], y, -c[1]]) for (A, c), y in zip(map(area_c, L3), Y)]
for b, P in zip(B, L3): print('area sezione', b, '°:', round(abs(area_c(P)[0]), 2), 'mm²')
tk = [0.0]
for k in (1, 2): tk.append(tk[-1] + np.linalg.norm(cents[k] - cents[k - 1]))
# punti 3D (x, y, z) dei profili: z = −s
P3 = [np.column_stack([P[:, 0], np.full(len(P), y), -P[:, 1]]) for P, y in zip(L3, Y)]
m1 = (P3[2] - P3[0]) / (tk[2] - tk[0])
m0 = 2 * (P3[1] - P3[0]) / (tk[1] - tk[0]) - m1
m2 = 2 * (P3[2] - P3[1]) / (tk[2] - tk[1]) - m1
Mt = [m0, m1, m2]
def herm(k, s):
    h = tk[k + 1] - tk[k]; s2, s3 = s * s, s ** 3
    return P3[k] * (2 * s3 - 3 * s2 + 1) + Mt[k] * ((s3 - 2 * s2 + s) * h) + P3[k + 1] * (-2 * s3 + 3 * s2) + Mt[k + 1] * ((s3 - s2) * h)
def dherm(k, s):
    h = tk[k + 1] - tk[k]; s2 = s * s
    return P3[k] * (6 * s2 - 6 * s) + Mt[k] * ((3 * s2 - 4 * s + 1) * h) + P3[k + 1] * (-6 * s2 + 6 * s) + Mt[k + 1] * ((3 * s2 - 2 * s) * h)

# contorno visto di fronte (piano frontale, x e y): base a y = 10 tra x = ±8, fianchi R82 tra (±8; 10) e (±8; 95,5), punta tangente
R = 82; cy = (10 + 95.5) / 2; cx = 8 - math.sqrt(R * R - (95.5 - cy) ** 2)
d = np.array([8 - cx, 95.5 - cy]) / R; tg = np.array([-d[1], d[0]]); nor = np.array([-tg[1], tg[0]])
kk = -8 / nor[0]; yc = 95.5 + kk * nor[1]; rt = abs(kk)
print('punta: centro y', round(yc, 4), 'raggio', round(rt, 4), 'cima', round(yc + rt, 4))
def halfw(y):
    if y < 10 or y > yc + rt: return 0.0
    if y <= 95.5: return cx + math.sqrt(max(R * R - (y - cy) ** 2, 0))
    return math.sqrt(max(rt * rt - (y - yc) ** 2, 0))
def clip(P, lo, hi):
    # taglia il poligono (x, z) tra x = lo e x = hi (Sutherland-Hodgman)
    for side, val in ((1, hi), (-1, lo)):
        out = []; n = len(P)
        for i in range(n):
            a, b = P[i], P[(i + 1) % n]; ia = side * (a[0] - val) <= 0; ib = side * (b[0] - val) <= 0
            if ia: out.append(a)
            if ia != ib: t = (val - a[0]) / (b[0] - a[0]); out.append(a + t * (b - a))
        P = out
        if not P: return P
    return P
def parea(P):
    if len(P) < 3: return 0.0
    P = np.array(P); x, z = P[:, 0], P[:, 1]; return abs((x * np.roll(z, -1) - np.roll(x, -1) * z).sum()) / 2
def zmax(P): return max(abs(p[1]) for p in P) if P else 0.0

Vb = Vin = 0.0; zin = 0.0; N = 1500
for k in (0, 1):
    for i in range(N):
        s = (i + .5) / N; Q = herm(k, s); y = Q[0, 1]; dy = dherm(k, s)[0, 1] / N
        assert np.ptp(Q[:, 1]) < 1e-9          # le fette sono orizzontali
        sec = [np.array([q[0], q[2]]) for q in Q]
        w = halfw(y)
        if w <= 0: continue
        cut = clip(sec, -w, w); Vb += parea(cut) * dy
        if y < 15:   # parte dentro il mozzo (cilindro R15 attorno all'asse z, profondo 30)
            r = math.sqrt(225 - y * y); c2 = clip(sec, -min(w, r), min(w, r)); Vin += parea(c2) * dy; zin = max(zin, zmax(c2))
print('pala ritagliata', round(Vb, 1), 'mm³; dentro il mozzo', round(Vin, 1), 'mm³ (|z| fino a', round(zin, 2), 'mm: dentro ±15)')
assert zin < 13.5      # la pala non arriva allo smusso del mozzo
Vm = math.pi * 225 * 30
V3 = Vm + 3 * (Vb - Vin); Vf = V3 - math.pi * 25 * 30
ch = .5 * 1.5 ** 2 * 2 * math.pi * (15 - .5)
print('tre pale', round(3 * Vb, 1), '| con il mozzo', round(V3, 1), '| con il foro', round(Vf, 1), '| smusso', round(ch, 1), '| finale', round(Vf - ch, 1), 'mm³, PLA', round((Vf - ch) / 1000 * 1.24, 1), 'g')
