# Paracaídas del héroe (public/models/paracaidas.glb): vela de cajones (ram-air) con perfil de ala, celdas infladas
# entre costillas, bocas de entrada de aire, estabilizadores en las puntas, líneas, slider, bandas y extractor.
# Todo sale de una sola función de geometría evaluada con distintos parámetros, así las formas (shape keys, morph
# targets en el juego) tienen la misma topología:
#   Plegado  la vela cerrada y chica, cerca del cuerpo, con el slider arriba (al abrir pasa de 1 a 0)
#   FrenoL / FrenoR  el borde de fuga de ese lado bajado (lo que hace tirar del freno)
# Además deja vacíos para las cuerdas de los frenos, que el juego dibuja hasta las manos:
#   Freno_L / Freno_R (con el freno suelto) y Freno_L_Tirado / Freno_R_Tirado (con el freno a fondo).
# Ejes de Blender: X izquierda del personaje, -Y adelante, Z arriba. El origen es el punto entre los hombros, donde
# terminan las bandas (el juego lo pone en ARNES de public/js/rig.js).
#   exec(open('paracaidas.py').read()); hacer_paracaidas(); exportar_paracaidas('public/models/paracaidas.glb')
import bpy, bmesh, math, os, random
from mathutils import Vector

ENVERGADURA = 5.4
CUERDA = 2.0
ALTO = 4.5            # altura del centro de la vela sobre los hombros
RADIO_ARCO = 5.2      # curva de la vela a lo ancho (las puntas bajan)
CELDAS = 9
SUB = 4               # muestras por celda a lo ancho
N_PERFIL = 18         # muestras del perfil por cara
ESPESOR = 0.17
FILAS = (0.06, 0.30, 0.55, 0.80)         # donde se atan las líneas (fracción de la cuerda)
BANDA_ALTO = 0.55
BANDA_X = 0.19
SLIDER_Z = (0.95, 2.6)                   # abierto / plegado
CLARAS = (1, 4, 7)                       # celdas blancas

COLORES = {
    'Tela': ((0.85, 0.25, 0.12, 1), 0.62),        # se tiñe con el color del jugador
    'TelaClara': ((0.93, 0.91, 0.86, 1), 0.66),
    'Interior': ((0.10, 0.09, 0.09, 1), 0.9),
    'Cuerda': ((0.16, 0.16, 0.17, 1), 0.7),
    'Cinta': ((0.05, 0.05, 0.06, 1), 0.8),
}


def _ss(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def perfil(xc):
    # NACA 4 (comba 3 %, en el 35 %), borde de fuga cerrado: (comba, medio espesor) en fracción de la cuerda
    m, p = 0.03, 0.35
    yt = 5 * ESPESOR * (0.2969 * math.sqrt(xc) - 0.1260 * xc - 0.3516 * xc ** 2 + 0.2843 * xc ** 3 - 0.1036 * xc ** 4)
    yc = m / p ** 2 * (2 * p * xc - xc ** 2) if xc < p else m / (1 - p) ** 2 * ((1 - 2 * p) + 2 * p * xc - xc ** 2)
    return yc, yt


class Geo:
    def __init__(self):
        self.v, self.f, self.m = [], [], []

    def pt(self, co):
        self.v.append(Vector(co))
        return len(self.v) - 1

    def cara(self, idx, mat):
        self.f.append(tuple(idx))
        self.m.append(mat)


def punto_vela(u, xc, lado, par):
    # u: -1..1 a lo ancho (+1 = izquierda); xc: 0 borde de ataque .. 1 borde de fuga; lado: +1 arriba, -1 abajo
    pleg = par.get('plegado', 0.0)
    fl, fr = par.get('frenoL', 0.0), par.get('frenoR', 0.0)
    # celda y posición dentro de la celda
    cu = (u + 1) / 2 * CELDAS
    dentro = cu - math.floor(cu) if cu < CELDAS else 1.0
    infla = math.sin(math.pi * dentro)
    # perfil
    xs = xc * (1 - 0.035 * infla * _ss(0.8, 1.0, xc))         # borde de fuga festoneado
    yc, yt = perfil(xs)
    yt *= 1 + 0.18 * infla if lado > 0 else 1 + 0.06 * infla   # arriba se infla más entre costillas
    if lado < 0 and xs < 0.07:
        yt *= 0.35                                              # boca de entrada de aire: el labio de abajo entra
    zloc = (yc + lado * yt) * CUERDA
    yloc = (xs - 0.38) * CUERDA                                 # el 38 % de la cuerda queda sobre el origen
    # frenos: el borde de fuga baja del lado que se tira
    w = fl * _ss(0.05, 0.75, u) + fr * _ss(0.05, 0.75, -u)
    if w:
        k = max(0.0, (xs - 0.5) / 0.5)
        zloc -= w * 0.62 * CUERDA * k ** 1.6
        yloc -= w * 0.10 * CUERDA * k ** 2
    # ángulo de ataque (nariz un poco abajo)
    a = math.radians(-5)
    y2 = yloc * math.cos(a) - zloc * math.sin(a)
    z2 = yloc * math.sin(a) + zloc * math.cos(a)
    # arco a lo ancho
    span = ENVERGADURA * (1 - 0.72 * pleg)
    alto = ALTO * (1 - 0.40 * pleg)
    phi = (u * span / 2) / RADIO_ARCO
    x = RADIO_ARCO * math.sin(phi)
    z = alto + RADIO_ARCO * (math.cos(phi) - 1)
    n = Vector((math.sin(phi), 0, math.cos(phi)))               # normal del arco (hacia afuera)
    P = Vector((x, 0, z)) + n * z2
    P.y = y2 * (1 - 0.45 * pleg)
    if pleg:
        # tela arrugada y caída hacia atrás mientras se abre
        rnd = random.Random(hash((round(u, 3), round(xc, 3), lado)) & 0xffff)
        P += Vector((rnd.uniform(-1, 1) * 0.10, rnd.uniform(-1, 1) * 0.12 + 0.35, rnd.uniform(-1, 1) * 0.12)) * pleg
        P.z -= 0.6 * pleg * abs(u) ** 1.5
    return P


def geometria(par):
    random.seed(7)
    g = Geo()
    us = [-1 + 2 * i / (CELDAS * SUB) for i in range(CELDAS * SUB + 1)]
    xcs = [0.5 - 0.5 * math.cos(math.pi * i / (N_PERFIL - 1)) for i in range(N_PERFIL)]   # más denso en los bordes
    # anillo del perfil: arriba de 0 a 1 y abajo de 1 a 0 (sin repetir los extremos)
    anillo = [(xc, 1) for xc in xcs] + [(xc, -1) for xc in reversed(xcs[1:-1])]
    R = len(anillo)
    idx = []
    for u in us:
        idx.append([g.pt(punto_vela(u, xc, l, par)) for xc, l in anillo])
    for i in range(len(us) - 1):
        celda = min(CELDAS - 1, i // SUB)
        mat = 'TelaClara' if celda in CLARAS else 'Tela'
        for j in range(R):
            j2 = (j + 1) % R
            xc, l = anillo[j]
            xc2, l2 = anillo[j2]
            boca = l < 0 and l2 < 0 and max(xc, xc2) < 0.075 or (j2 == 0 and xc < 0.075)
            # orden para que la normal mire afuera
            g.cara((idx[i][j], idx[i][j2], idx[i + 1][j2], idx[i + 1][j]), 'Interior' if boca else mat)
    # tapas de las puntas
    for i, signo in ((0, 1), (len(us) - 1, -1)):
        c = g.pt(sum((g.v[k] for k in idx[i]), Vector()) / R)
        for j in range(R):
            a, b = idx[i][j], idx[i][(j + 1) % R]
            g.cara((a, b, c) if signo < 0 else (b, a, c), 'Tela')
    # estabilizadores: un triángulo de tela que cuelga de cada punta (dos caras)
    puntas = {}
    for u, s in ((-1.0, -1), (1.0, 1)):
        a = punto_vela(u, 0.12, -1, par)
        b = punto_vela(u, 0.92, -1, par)
        c = punto_vela(u, 0.45, -1, par) + Vector((-s * 0.10, 0, -0.55)) * (1 - 0.6 * par.get('plegado', 0))
        ia, ib, ic = g.pt(a), g.pt(b), g.pt(c)
        g.cara((ia, ib, ic) if s > 0 else (ib, ia, ic), 'TelaClara')
        ja, jb, jc = g.pt(a + Vector((-s * 0.004, 0, 0))), g.pt(b + Vector((-s * 0.004, 0, 0))), g.pt(c + Vector((-s * 0.004, 0, 0)))
        g.cara((jb, ja, jc) if s > 0 else (ja, jb, jc), 'TelaClara')
        puntas[s] = c
    # líneas: de cada costilla y fila a la banda de su lado (adelante las filas A y B, atrás C y D)
    pleg = par.get('plegado', 0.0)
    slz = SLIDER_Z[0] + (SLIDER_Z[1] - SLIDER_Z[0]) * pleg
    for k in range(CELDAS + 1):
        u = -1 + 2 * k / CELDAS
        for fila, xc in enumerate(FILAS):
            s = 1 if u > 0 or (u == 0 and fila % 2) else -1
            top = punto_vela(u, xc, -1, par)
            bot = Vector((s * BANDA_X, -0.03 if fila < 2 else 0.03, BANDA_ALTO))
            _linea(g, top, bot, 0.011)
    for s, c in puntas.items():
        _linea(g, c, Vector((s * BANDA_X, 0.0, BANDA_ALTO)), 0.011)
    # bandas (cintas) del hombro hasta el conector de las líneas
    for s in (1, -1):
        _cinta(g, Vector((s * 0.165, 0.0, 0.02)), Vector((s * BANDA_X, 0.0, BANDA_ALTO)), 0.038, 0.006)
    # slider: un rectángulo de tela con las líneas pasando por sus esquinas
    sw, sd = 0.22 + 0.10 * (1 - pleg), 0.18
    sl = [g.pt((x, y, slz + 0.02 * abs(x))) for x, y in ((-sw, -sd), (sw, -sd), (sw, sd), (-sw, sd))]
    g.cara(sl, 'TelaClara')          # la tela es de dos caras (doubleSided en el GLB)
    # extractor (paracaídas chico) atado arriba al centro, flameando atrás
    top = punto_vela(0.0, 0.42, 1, par)
    pc = top + Vector((0, 1.5, 0.55))
    _linea(g, top, pc, 0.01)
    _domo(g, pc + Vector((0, 0.05, 0.02)), 0.36, Vector((0, 0.94, 0.34)).normalized())
    return g


def _base_ortonormal(d):
    a = Vector((1, 0, 0)) if abs(d.x) < 0.9 else Vector((0, 1, 0))
    e1 = d.cross(a).normalized()
    return e1, d.cross(e1).normalized()


def _linea(g, a, b, ancho, mat='Cuerda'):
    # prisma triangular finito
    d = (b - a).normalized()
    e1, e2 = _base_ortonormal(d)
    r = ancho / 2
    offs = [e1 * r, (-e1 * 0.5 + e2 * 0.866) * r, (-e1 * 0.5 - e2 * 0.866) * r]
    ia = [g.pt(a + o) for o in offs]
    ib = [g.pt(b + o) for o in offs]
    for j in range(3):
        j2 = (j + 1) % 3
        g.cara((ia[j], ia[j2], ib[j2], ib[j]), mat)


def _cinta(g, a, b, ancho, grueso):
    d = (b - a).normalized()
    e1 = Vector((1, 0, 0))
    e1 = (e1 - d * e1.dot(d)).normalized()
    e2 = d.cross(e1)
    offs = [e1 * ancho / 2 + e2 * grueso / 2, -e1 * ancho / 2 + e2 * grueso / 2, -e1 * ancho / 2 - e2 * grueso / 2, e1 * ancho / 2 - e2 * grueso / 2]
    ia = [g.pt(a + o) for o in offs]
    ib = [g.pt(b + o) for o in offs]
    for j in range(4):
        j2 = (j + 1) % 4
        g.cara((ia[j], ia[j2], ib[j2], ib[j]), 'Cinta')
    g.cara(list(reversed(ia)), 'Cinta')
    g.cara(ib, 'Cinta')


def _domo(g, c, r, eje):
    e1, e2 = _base_ortonormal(eje)
    N, M = 10, 4
    anillos = []
    for i in range(1, M + 1):
        th = (math.pi / 2) * i / M
        anillos.append([g.pt(c + eje * (r * 0.6 * math.cos(th)) + (e1 * math.cos(2 * math.pi * k / N) + e2 * math.sin(2 * math.pi * k / N)) * r * math.sin(th)) for k in range(N)])
    tope = g.pt(c + eje * r * 0.6)
    for k in range(N):
        g.cara((tope, anillos[0][(k + 1) % N], anillos[0][k]), 'Tela' if k % 2 else 'TelaClara')
    for i in range(M - 1):
        for k in range(N):
            k2 = (k + 1) % N
            g.cara((anillos[i][k], anillos[i][k2], anillos[i + 1][k2], anillos[i + 1][k]), 'Tela' if k % 2 else 'TelaClara')
    # por dentro (un poco más chico, para que no se pise con la tela de afuera)
    adentro = [[g.pt(c + (g.v[i] - c) * 0.96) for i in an] for an in anillos]
    for i in range(M - 1):
        for k in range(N):
            k2 = (k + 1) % N
            g.cara((adentro[i + 1][k], adentro[i + 1][k2], adentro[i][k2], adentro[i][k]), 'Interior')


def _material(nombre):
    m = bpy.data.materials.get(nombre) or bpy.data.materials.new(nombre)
    col, rough = COLORES[nombre]
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = col
    bsdf.inputs['Roughness'].default_value = rough
    if nombre in ('Tela', 'TelaClara', 'Interior'):
        m.use_backface_culling = False
    m.diffuse_color = col
    return m


PUNTO_FRENO = (0.62, 0.97)      # (u, xc) donde se ata la cuerda del freno en el borde de fuga


def hacer_paracaidas():
    for o in list(bpy.data.objects):
        if o.name.startswith(('Paracaidas', 'Freno_')):
            bpy.data.objects.remove(o, do_unlink=True)
    base = geometria({})
    me = bpy.data.meshes.new('Paracaidas')
    me.from_pydata([tuple(v) for v in base.v], [], base.f)
    mats = list(COLORES)
    for n in mats:
        me.materials.append(_material(n))
    for poly, mt in zip(me.polygons, base.m):
        poly.material_index = mats.index(mt)
        poly.use_smooth = mt in ('Tela', 'TelaClara', 'Interior')
    me.update()
    ob = bpy.data.objects.new('Paracaidas', me)
    bpy.context.scene.collection.objects.link(ob)
    ob.shape_key_add(name='Basis', from_mix=False)
    for nombre, par in (('Plegado', {'plegado': 1.0}), ('FrenoL', {'frenoL': 1.0}), ('FrenoR', {'frenoR': 1.0})):
        g = geometria(par)
        k = ob.shape_key_add(name=nombre, from_mix=False)
        for i, v in enumerate(g.v):
            k.data[i].co = v
        k.value = 0.0          # (en Blender 5 una forma nueva arranca en 1)
    # vacíos para las cuerdas de los frenos
    for s, l in ((1, 'L'), (-1, 'R')):
        for sufijo, par in (('', {}), ('_Tirado', {'freno' + l: 1.0})):
            e = bpy.data.objects.new('Freno_' + l + sufijo, None)
            e.location = punto_vela(s * PUNTO_FRENO[0], PUNTO_FRENO[1], -1, par)
            e.empty_display_size = 0.05
            e.parent = ob
            bpy.context.scene.collection.objects.link(e)
    return ob


def exportar_paracaidas(ruta):
    ob = bpy.data.objects['Paracaidas']
    for o in bpy.data.objects:
        o.select_set(False)
    ob.select_set(True)
    for c in ob.children:
        c.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.export_scene.gltf(
        filepath=ruta, export_format='GLB', use_selection=True, export_yup=True, export_apply=False,
        export_morph=True, export_morph_normal=True, export_tangents=False, export_extras=False,
        export_animations=False, export_materials='EXPORT')
    return os.path.getsize(ruta)
