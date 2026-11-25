# Control de calidad sin render: cuánto se mete el arma en el cuerpo del héroe, cuadro por cuadro.
# - El torso se deforma por código (skinning lineal en numpy) a partir de la Pose de heroe_anim, con los vértices de la
#   malla pesados a cadera, columna, cuello y hombros (los de los brazos quedan afuera).
# - Se corta en rebanadas horizontales de 1 cm y se arma el casco convexo de cada rebanada; la profundidad de un vértice
#   del arma es cuánto queda adentro de ese casco (0 = afuera). El casco rellena el hueco del hombro, así que apoyar la
#   culata o el tubo en el hombro da 1-2 cm sin estar metido.
# - El arma va en el marco del hueso Arma.R de la pose. No cuentan las piezas que viajan solas (cargador, cartucho,
#   bala, cohete), que pasan cerca del cinturón a propósito.
# Requiere heroe_anim.py, heroe_clips.py y heroe_recargas.py ejecutados antes, el esqueleto 'Esqueleto' con su malla y
# cada arma en la escena como un objeto raíz con su nombre ('rifle', 'escopeta'...) y las mallas colgando de él.
# Uso: control_choque() imprime una línea por pose y por recarga y devuelve los cuadros con más de LIMITE.
import bpy
import numpy as np

LIMITE = 0.025          # m: más que esto se ve el arma atravesando el chaleco
SUELTAS = ('_cargador', '_cartucho', '_bala', '_cohete')
POSES = {'Rifle': ('rifle', 'subfusil', 'escopeta', 'francotirador'),
         'RifleApunta': ('rifle', 'subfusil', 'escopeta', 'francotirador'),
         'Pistola': ('pistola',), 'PistolaApunta': ('pistola',), 'Lanzacohetes': ('lanzacohetes',)}

_PREP = {}


def _prep():
    if _PREP:
        return _PREP
    arm = bpy.data.objects[ARM]
    huesos = [b.name for b in arm.data.bones]
    tronco = {n for n in huesos if any(k in n for k in ('Spine', 'Hips', 'Neck', 'Shoulder'))}
    brazos = {n for n in huesos if any(k in n for k in ('Arm', 'Hand'))}
    Ainv = arm.matrix_world.inverted()
    pts, pesos = [], []
    for o in bpy.data.objects:
        if o.type != 'MESH' or o.find_armature() != arm:
            continue
        gi = {g.index: g.name for g in o.vertex_groups}
        M = np.array(Ainv @ o.matrix_world)
        for v in o.data.vertices:
            wt = wb = 0.0
            ws = []
            for g in v.groups:
                n = gi.get(g.group, '')
                if n in tronco:
                    wt += g.weight
                elif n in brazos:
                    wb += g.weight
                if n in huesos and g.weight > 0:
                    ws.append((huesos.index(n), g.weight))
            if wt > 0.6 and wb < 0.25 and ws:
                pts.append(M[:3, :3] @ np.array(v.co) + M[:3, 3])
                ws = sorted(ws, key=lambda x: -x[1])[:4]
                tot = sum(w for _, w in ws)
                pesos.append([(i, w / tot) for i, w in ws])
    idx = np.zeros((len(pts), 4), int)
    w = np.zeros((len(pts), 4))
    for k, ws in enumerate(pesos):
        for j, (i, x) in enumerate(ws):
            idx[k, j], w[k, j] = i, x
    _PREP.update(V=np.array(pts), idx=idx, w=w, huesos=huesos,
                 rest_inv=np.array([np.array(arm.data.bones[n].matrix_local.inverted()) for n in huesos]))
    return _PREP


def puntos_arma(nombre, max_puntos=4000):
    # vértices del arma en su propio marco (origen en el puño, +Y cañón, +Z arriba)
    bpy.context.view_layer.update()
    raiz = bpy.data.objects[nombre]
    L = raiz.matrix_world.inverted()
    out = []

    def rec(o, suelta):
        suelta = suelta or o.name.endswith(SUELTAS)
        if o.type == 'MESH' and not suelta:
            M = np.array(L @ o.matrix_world)
            co = np.array([v.co for v in o.data.vertices])
            out.append(co @ M[:3, :3].T + M[:3, 3])
        for c in o.children:
            rec(c, suelta)
    rec(raiz, False)
    P = np.concatenate(out)
    return P[::max(1, len(P) // max_puntos)]


def torso(p):
    pr = _prep()
    Mp = np.array([np.array(p.M[n]) for n in pr['huesos']]) @ pr['rest_inv']
    out = np.zeros_like(pr['V'])
    for j in range(4):
        Mj = Mp[pr['idx'][:, j]]
        out += pr['w'][:, j:j + 1] * (np.einsum('nij,nj->ni', Mj[:, :3, :3], pr['V']) + Mj[:, :3, 3])
    return out


def casco(pts):
    # casco convexo 2D (cadena monótona), en sentido antihorario
    pts = sorted(set(map(tuple, np.round(pts, 4))))
    if len(pts) < 3:
        return None

    def cr(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for q in pts:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], q) <= 0:
            lo.pop()
        lo.append(q)
    for q in reversed(pts):
        while len(up) >= 2 and cr(up[-2], up[-1], q) <= 0:
            up.pop()
        up.append(q)
    return np.array(lo[:-1] + up[:-1])


def profundidad(p, pts_arma):
    # (cuánto se mete el arma en el torso en la pose p, punto del arma más metido en su marco)
    T = torso(p)
    M = np.array(p.M['Arma.R'])
    A = pts_arma @ M[:3, :3].T + M[:3, 3]
    peor, donde = 0.0, None
    zs = np.round(A[:, 2] / 0.01).astype(int)
    for z in np.unique(zs):
        sel = np.abs(T[:, 2] - z * 0.01) < 0.012
        if sel.sum() < 8:
            continue
        h = casco(T[sel, :2])
        if h is None:
            continue
        q = zs == z
        e = np.roll(h, -1, 0) - h
        nrm = np.stack([e[:, 1], -e[:, 0]], 1)
        nrm /= np.linalg.norm(nrm, axis=1)[:, None]
        d = -np.einsum('qkj,kj->qk', A[q, None, :2] - h[None], nrm).max(1)
        i = d.argmax()
        if d[i] > peor:
            peor, donde = float(d[i]), pts_arma[q][i]
    return peor, donde


def control_choque(recargas=None, poses=None):
    malos = []
    cache = {}

    def pts(a):
        if a not in cache:
            cache[a] = puntos_arma(a)
        return cache[a]
    for clip in (poses if poses is not None else POSES):
        for a in POSES[clip]:
            d, _ = profundidad(pose_arma(clip, 0), pts(a))
            print('%-22s %-14s %.3f m' % (clip, a, d))
            if d > LIMITE:
                malos.append((clip, a, 0, round(d, 3)))
    for n in (recargas if recargas is not None else list(RECARGAS)):
        C = RECARGAS[n]()
        prof = [profundidad(C.pose(f), pts(C.arma))[0] for f in range(C.T + 1)]
        m = max(prof)
        print('%-22s %-14s %.3f m (cuadro %d)' % (n, C.arma, m, prof.index(m)))
        malos += [(n, C.arma, f, round(d, 3)) for f, d in enumerate(prof) if d > LIMITE]
    for x in malos:
        print('   ', x)
    return malos
