# Control de calidad sin render: cuánto se meten los brazos (y las manos) en el resto del cuerpo, cuadro por cuadro.
# - La malla del héroe se deforma por código (skinning lineal en numpy, 4 pesos por vértice como en three.js) a partir
#   de la Pose de heroe_anim.
# - Brazo: vértices pesados casi todo (>= 90 %) a UpperArm, LowerArm, Hand y dedos de un lado. Cuerpo: las caras
#   cuyos vértices no tienen peso de ningún brazo (tronco, cabeza, piernas; la zona del hombro que mezcla queda afuera).
# - Un vértice del brazo está adentro si, tirando rayos en las 6 direcciones de los ejes, al menos 5 chocan primero
#   con la cara de atrás de una superficie del cuerpo; la profundidad es su distancia a la superficie más cercana.
# - En el juego las piernas (Hips, Spine y piernas) salen de la locomoción y el torso de la pose del arma (rig.js), y
#   después se dobla la columna para apuntar arriba o abajo: combinar() arma esa misma mezcla.
# Requiere heroe_anim.py y heroe_clips.py ejecutados antes (heroe_recargas.py para revisar las recargas) y el
# esqueleto 'Esqueleto' con su malla.
# - La columna se revisa doblada en todo el recorrido, no solo en los topes: a mitad de camino la mano puede pasar por
#   un bolsillo que en el tope ya dejó atrás.
# Uso: control_brazos() imprime una línea por clip y por combinación (derecho, mirando abajo y mirando arriba) y
# devuelve los casos con más de LIMITE.
import math
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

LIMITE = 0.015          # m: más que esto se ve el brazo atravesando la ropa
LADOS = 'LR'
PIERNAS_RIG = ('Hips', 'Spine', 'UpperLeg.L', 'UpperLeg.R', 'LowerLeg.L', 'LowerLeg.R', 'Foot.L', 'Foot.R',
               'Toe.L', 'Toe.R')      # capa de piernas de rig.js (el resto de los huesos es la capa del torso)
DEDOS = ('Index', 'Middle', 'Pinky', 'Ring', 'Thumb')
_EJES = [Vector(x) for x in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))]

_PREP_B = {}


def _de_brazo(n, l):
    return n in ('UpperArm.' + l, 'LowerArm.' + l, 'Hand.' + l) or (n.endswith('.' + l) and n.startswith(DEDOS))


def _prep_b():
    if _PREP_B:
        return _PREP_B
    arm = bpy.data.objects[ARM]
    huesos = [b.name for b in arm.data.bones]
    Ainv = arm.matrix_world.inverted()
    V_, idx_, w_, polys = [], [], [], []
    lado_, cuerpo_ = [], []
    base = 0
    for o in bpy.data.objects:
        if o.type != 'MESH' or o.find_armature() != arm:
            continue
        gi = {g.index: g.name for g in o.vertex_groups}
        M = np.array(Ainv @ o.matrix_world)
        co = np.array([v.co for v in o.data.vertices])
        V_.append(co @ M[:3, :3].T + M[:3, 3])
        for v in o.data.vertices:
            ws = sorted(((g.weight, gi.get(g.group, '')) for g in v.groups if g.weight > 0 and gi.get(g.group) in huesos),
                        reverse=True)[:4]
            tot = sum(w for w, _ in ws) or 1.0
            i4, w4 = [0] * 4, [0.0] * 4
            for j, (w, n) in enumerate(ws):
                i4[j], w4[j] = huesos.index(n), w / tot
            idx_.append(i4)
            w_.append(w4)
            pb = {l: sum(w for w, n in ws if _de_brazo(n, l)) / tot for l in LADOS}
            lado_.append('L' if pb['L'] >= 0.9 else 'R' if pb['R'] >= 0.9 else '')
            cuerpo_.append(pb['L'] + pb['R'] < 0.02)
        polys += [[i + base for i in p.vertices] for p in o.data.polygons]
        base += len(o.data.vertices)
    cuerpo_ = np.array(cuerpo_)
    lado_ = np.array(lado_)
    caras = [p for p in polys if all(cuerpo_[i] for i in p)]
    usados = sorted({i for p in caras for i in p})
    remap = {i: k for k, i in enumerate(usados)}
    idx_a, w_a = np.array(idx_), np.array(w_)
    _PREP_B.update(V=np.concatenate(V_), idx=idx_a, w=w_a, huesos=huesos,
                   dominante=[huesos[idx_a[i, w_a[i].argmax()]] for i in range(len(idx_a))],
                   rest_inv=np.array([np.array(arm.data.bones[n].matrix_local.inverted()) for n in huesos]),
                   brazo={l: np.nonzero(lado_ == l)[0] for l in LADOS},
                   usados=np.array(usados), caras=[[remap[i] for i in p] for p in caras])
    return _PREP_B


def deformar(p):
    pr = _prep_b()
    Mp = np.array([np.array(p.M[n]) for n in pr['huesos']]) @ pr['rest_inv']
    out = np.zeros_like(pr['V'])
    for j in range(4):
        Mj = Mp[pr['idx'][:, j]]
        out += pr['w'][:, j:j + 1] * (np.einsum('nij,nj->ni', Mj[:, :3, :3], pr['V']) + Mj[:, :3, 3])
    return out


def choque_brazos(p):
    # {lado: (profundidad en m, punto del brazo más metido en espacio del personaje, hueso que lo mueve)}
    pr = _prep_b()
    X = deformar(p)
    t = BVHTree.FromPolygons([Vector(x) for x in X[pr['usados']]], pr['caras'], all_triangles=False)
    res = {}
    for l in LADOS:
        peor, donde, hueso = 0.0, None, ''
        for i in pr['brazo'][l]:
            q = Vector(X[i])
            loc, nor, _, dist = t.find_nearest(q, 0.25)
            # descarte rápido: del lado de afuera de la superficie más cercana
            if loc is None or dist <= peor or (q - loc).dot(nor) > 0:
                continue
            atras = 0
            for d in _EJES:
                h, n2, _, _ = t.ray_cast(q, d, 1.0)
                if h is not None and n2.dot(d) > 0:
                    atras += 1
            if atras >= 5:
                peor, donde, hueso = dist, q, pr['dominante'][i]
        res[l] = (peor, donde, hueso)
    return res


# Cómo dobla rig.js la columna para mirar arriba o abajo (grados totales, + arriba; la cámara va de -77° a +69°):
# - con arma: corrige el error del cañón repartido en Spine, Spine1 y Spine2, con tope (todo apuntando, el 55 % con el
#   arma a la cadera);
# - sin arma (locomoción, pico, objeto): el 40 % del ángulo de la cámara, solo en Spine1 y Spine2;
# - recargando: ese mismo 40 %, pero repartido en toda la columna y con el tope del arma a la cadera.
REPARTO = (0.4, 0.3, 0.3)
REPARTO_LIBRE = (0.0, 0.45, 0.55)
APUNTAR = {'Rifle': (-15, 20), 'RifleApunta': (-55, 65), 'Pistola': (-15, 20), 'PistolaApunta': (-55, 65),
           'Lanzacohetes': (-55, 65)}
MIRAR_LIBRE = (-31, 28)
MIRAR_RECARGA = APUNTAR['Rifle']
# el bombeo de la escopeta es un tiro para rig.js: dobla la columna como con el arma en la mano
APUNTAR_ACCION = {'BombeoEscopeta': APUNTAR['Rifle'], 'BombeoEscopetaApunta': APUNTAR['RifleApunta']}
# sin arma y mirando abajo los brazos no siguen al pecho: rig.js los gira para atrás lo mismo que se dobló la columna
# (cuelgan). Mirando arriba sí lo siguen: si no, al echarse atrás el pecho, la mano derecha cae en la funda del muslo.
CONTRA_ABAJO = 1.0
PASO_ANGULO = 8         # grados entre los ángulos que se revisan
# poses que dejan la mano izquierda libre: en rig.js ese brazo sigue a la locomoción (se balancea al correr)
BRAZO_LIBRE = ('Objeto', 'SostenerPico')


def _de_brazo_l(n):
    return n == 'Shoulder.L' or _de_brazo(n, 'L')


def combinar(piernas, torso, apunta=0.0, reparto=None, libre=False, contra=0.0):
    # la mezcla de rig.js: piernas y cadera de una pose, el resto de la otra (con 'libre', también el brazo izquierdo
    # sale de las piernas); 'apunta' (grados, + arriba) dobla la columna alrededor del eje izquierda-derecha del
    # personaje como la corrección de puntería
    p = Pose(bpy.data.objects[ARM])
    for n in p.orden:
        src = piernas if n in PIERNAS_RIG or (libre and _de_brazo_l(n)) else torso
        p.base[n] = src.base[n].copy()
        if n in src.locs:
            p.locs[n] = src.locs[n].copy()
    p.loc = piernas.loc.copy()
    p.fk()
    if apunta:
        for n, k in zip(('Spine', 'Spine1', 'Spine2'), reparto or REPARTO):
            if k:
                p.rot(n, (-1, 0, 0), apunta * k)
        if contra:
            for n in ('UpperArm.L', 'UpperArm.R'):
                p.rot(n, (-1, 0, 0), -apunta * sum(reparto or REPARTO) * contra)
    return p


def barrido(rango, paso=None):
    # {'abajo': [...], 'arriba': [...]}: de 0 (sin incluirlo) a cada tope, con saltos de PASO_ANGULO o menos
    paso = paso or PASO_ANGULO
    out = {}
    for nombre, tope in zip(('abajo', 'arriba'), rango):
        n = max(1, math.ceil(abs(tope) / paso))
        out[nombre] = [tope * k / n for k in range(1, n + 1)]
    return out


def _peor(poses):
    peor = (0.0, None, None, None, '')
    for etiqueta, p in poses:
        for l, (d, q, h) in choque_brazos(p).items():
            if d > peor[0]:
                peor = (d, etiqueta, l, q, h)
    return peor


def _marcha(nombre):
    g = Marcha(nombre, **MARCHAS[nombre])
    return g.T, (lambda f: g.pose(f / g.T))


def clip(nombre):
    # (cuadros, función cuadro -> Pose) de un clip del personaje o de una recarga
    if nombre in MARCHAS:
        return _marcha(nombre)
    if nombre in CLIPS:
        T, _, fn = CLIPS[nombre]
        return T, fn
    C = RECARGAS[nombre]()
    return C.T, C.pose


SOLOS = ('Quieto', 'Caminar', 'Trote', 'Correr', 'Sprint', 'Salto', 'Caida', 'Planear', 'Baile')
PIERNAS_JUEGO = ('Quieto', 'Caminar', 'Trote', 'Correr', 'Sprint', 'Salto')
TORSOS = ('Rifle', 'RifleApunta', 'Pistola', 'PistolaApunta', 'Lanzacohetes', 'SostenerPico', 'Objeto', 'Golpe')


def control_brazos(solos=SOLOS, piernas=PIERNAS_JUEGO, torsos=TORSOS, recargas=None, paso=2):
    malos = []

    def anotar(nombre, peor):
        d, et, l, q, h = peor
        print('%-40s %.3f m  %-10s %s %s' % (nombre, d, h or '-', et if et is not None else '',
                                            tuple(round(x, 2) for x in q) if q else ''), flush=True)
        if d > LIMITE:
            malos.append((nombre, et, h, round(d, 3)))

    def mezclas(nombre, fp, ft, cuadros, rango, reparto, libre=False, contra=0.0):
        # derecho y doblado en todo el recorrido; la etiqueta es (grados, cuadro de las piernas, cuadro del torso)
        anotar(nombre, _peor(((0, fa, fb), combinar(fp(fa), ft(fb), 0.0, reparto, libre)) for fa, fb in cuadros))
        for lado, angulos in barrido(rango).items():
            anotar('%s %s' % (nombre, lado), _peor(
                ((round(a), fa, fb), combinar(fp(fa), ft(fb), a, reparto, libre, contra if a < 0 else 0.0))
                for a in angulos for fa, fb in cuadros))
    for n in solos:
        T, fn = clip(n)
        cuadros = range(0, T + 1, 1 if T < 40 else paso)
        if n in piernas:                  # sin arma también mira arriba y abajo
            mezclas(n, fn, fn, [(f, f) for f in cuadros], MIRAR_LIBRE, REPARTO_LIBRE, contra=CONTRA_ABAJO)
        else:
            anotar(n, _peor((f, fn(f)) for f in cuadros))
    for t in torsos:
        Tt, ft = clip(t)
        cuadros_t = range(0, Tt + 1) if Tt < 40 else (0, Tt // 4, Tt // 2)
        armada = t in APUNTAR
        for pn in piernas:
            Tp, fp = clip(pn)
            cuadros = [(fa, fb) for fb in cuadros_t for fa in range(0, Tp + 1, max(paso, Tp // 12))]
            if armada:
                mezclas('%s + %s' % (pn, t), fp, ft, cuadros, APUNTAR[t], REPARTO)
            else:
                mezclas('%s + %s' % (pn, t), fp, ft, cuadros, MIRAR_LIBRE, REPARTO_LIBRE, t in BRAZO_LIBRE, CONTRA_ABAJO)
    # recargando, los brazos siguen al pecho (sostienen el arma)
    for r in (recargas if recargas is not None else list(globals().get('RECARGAS', {}))):
        Tr, fr = clip(r)
        for pn in ('Quieto', 'Correr'):
            Tp, fp = clip(pn)
            cuadros = [(fa, fb) for fb in range(0, Tr + 1, 3) for fa in range(0, Tp + 1, max(1, Tp // 4))]
            mezclas('%s + %s' % (pn, r), fp, fr, cuadros, APUNTAR_ACCION.get(r, MIRAR_RECARGA), REPARTO)
    for x in malos:
        print('   ', x)
    return malos
