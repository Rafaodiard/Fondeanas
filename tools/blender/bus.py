# Bus volador de Salto Final (diseño propio): colectivo de línea retro de dos tonos con ala alta sobre el techo,
# dos motores con hélices de cuatro palas, cola en cruz con derivas en las puntas, portaequipajes y luces.
# Requiere armas_base.py ejecutado antes (usa sus herramientas: prisma, caja, torno, tubo, cortador, finalizar).
# Medidas en metros, con el piso en z = 0 mientras se modela; el frente mira a +Y (en glTF queda -Z, como el juego).
# Al exportar, todo baja BAJAR metros para que el centro del bus quede en el origen (el juego lo mueve por ahí).
#
# Uso (Blender 5.x o bpy como módulo, SF_OUT = carpeta de trabajo):
#   exec(open('armas_base.py').read()); exec(open('bus.py').read())
#   A = armar_bus(); exportar_bus(A, 'bus_crudo.glb'); fotos_bus(carpeta, ['tres4', 'atras'])
#   gltf-transform meshopt bus_crudo.glb public/models/bus.glb      (comprime la malla; el juego la decodifica)
# Nodos del GLB: 'Bus' (raíz) > 'Carroceria' (todo lo fijo) + 'Helice_D' y 'Helice_I' (giran sobre su Z local, que en
# el juego es el eje de vuelo). Materiales que el juego anima: 'Baliza' (destella) y 'Destello' (doble flash).
import bpy, bmesh, math, os
from mathutils import Vector, Matrix

# ---------------------------------------------------------------------------
# Medidas generales
W, L = 3.7, 12.0              # ancho y largo de la carrocería
X1, Y0, Y1 = W / 2, -L / 2, L / 2
Z0, Z1 = 0.72, 3.9            # piso y techo de la carrocería
RX, RYF, RYB, RZT, RZB = 0.5, 0.55, 0.4, 0.55, 0.16   # radios de las aristas (lado, frente, cola, techo, piso)
EJES = (3.6, -3.6)            # ejes de las ruedas (y)
RUEDA_R, RUEDA_Z = 0.6, 0.6
ARCO_R = 0.8                  # radio del pasaruedas
BAJAR = 2.3

# bandas de la pintura (z) y ventanas
FALDON, FRANJA0, FRANJA1 = 0.95, 1.75, 1.95
VENT_Z = (2.05, 3.2)
VENTANAS = [(-5.35 + k * 1.42, -5.35 + k * 1.42 + 1.22) for k in range(6)] + [(3.25, 4.3)]
CHOFER = (4.45, 5.35)
PUERTA = ((4.45, 4.9), (4.9, 5.35), 1.15)       # dos hojas y su borde de abajo
PARABRISAS = (2.0, 3.05, 0.05, 1.28)            # z0, z1, |x| de la columna central, |x| del borde
CARTEL = (3.12, 3.32, 1.0)
TRASERA = (2.3, 3.15, 1.05)
REJILLA = (1.05, 1.55, 0.85)

# ala y cola
ALA_Z = Z1 + 0.62
ALA_LE = 2.2                  # borde de ataque en el centro (y)
ALA_SPAN = 10.0
MOTOR_X = 4.6

PALETA.update({
    'Pintura': dict(c=(0.006, 0.23, 0.20), m=0.0, r=0.32),
    'Crema': dict(c=(0.86, 0.79, 0.61), m=0.0, r=0.38),
    'Timon': dict(c=(0.004, 0.14, 0.125), m=0.0, r=0.4),
    'Techo': dict(c=(0.80, 0.80, 0.78), m=0.0, r=0.45),
    'Franja': dict(c=(0.92, 0.42, 0.015), m=0.0, r=0.35),
    'Bajo': dict(c=(0.022, 0.025, 0.032), m=0.0, r=0.7),
    'Pasarueda': dict(c=(0.008, 0.008, 0.01), m=0.0, r=0.95),
    'Cromo': dict(c=(0.80, 0.81, 0.83), m=1.0, r=0.16),
    'Aluminio': dict(c=(0.55, 0.57, 0.60), m=0.85, r=0.35),
    'Vidrio': dict(c=(0.018, 0.035, 0.05), m=0.0, r=0.06),
    'Goma': dict(c=(0.014, 0.014, 0.016), m=0.0, r=0.85),
    'Neumatico': dict(c=(0.022, 0.022, 0.024), m=0.0, r=0.92),
    'Llanta': dict(c=(0.86, 0.84, 0.80), m=0.0, r=0.35),
    'Pala': dict(c=(0.025, 0.026, 0.03), m=0.3, r=0.45),
    'Faro': dict(c=(1.0, 0.92, 0.72), m=0.0, r=0.1, e=4.0),
    'LuzTrasera': dict(c=(0.6, 0.0, 0.0), m=0.0, r=0.2, e=1.6),
    'Giro': dict(c=(1.0, 0.38, 0.01), m=0.0, r=0.2, e=2.0),
    'NavRoja': dict(c=(1.0, 0.03, 0.02), m=0.0, r=0.2, e=5.0),
    'NavVerde': dict(c=(0.03, 1.0, 0.12), m=0.0, r=0.2, e=5.0),
    'Baliza': dict(c=(1.0, 0.05, 0.02), m=0.0, r=0.2, e=6.0),
    'Destello': dict(c=(1.0, 1.0, 1.0), m=0.0, r=0.2, e=6.0),
    'Letrero': dict(c=(1.0, 0.55, 0.05), m=0.0, r=0.3, e=3.0),
    'CartelFondo': dict(c=(0.01, 0.01, 0.012), m=0.0, r=0.4),
    'Cuero': dict(c=(0.16, 0.06, 0.022), m=0.0, r=0.55),
    'MaletaRoja': dict(c=(0.50, 0.04, 0.03), m=0.0, r=0.45),
    'MaletaAzul': dict(c=(0.03, 0.10, 0.36), m=0.0, r=0.45),
    'Lona': dict(c=(0.25, 0.22, 0.12), m=0.0, r=0.85),
    'Madera': dict(c=(0.30, 0.16, 0.07), m=0.0, r=0.7),
})


def ss(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * (3 - 2 * t)


def arco_cortes(b, R, n=4):
    # cortes dentro de la franja de una arista redondeada: ángulos parejos del arco (la mitad que le toca a esta cara)
    return [b + R * math.tan(math.radians(45.0 * k / n)) for k in range(1, n)]


# ---------------------------------------------------------------------------
# Carrocería: caja reticulada con cortes en cada borde de ventana y de franja, redondeada y deformada después
def redondeo(p):
    x, y, z = p
    c = Vector((max(-X1 + RX, min(X1 - RX, x)), max(Y0 + RYB, min(Y1 - RYF, y)), max(Z0 + RZB, min(Z1 - RZT, z))))
    d = Vector((x, y, z)) - c
    R = Vector((RX, RYF if y > 0 else RYB, RZT if z > 2 else RZB))
    n = Vector((d.x / R.x, d.y / R.y, d.z / R.z))
    if n.length < 1e-9:
        return Vector((x, y, z))
    n.normalize()
    return c + Vector((R.x * n.x, R.y * n.y, R.z * n.z))


def deformar(p):
    x, y, z = p
    # costados que se cierran un poco hacia el techo
    x *= 1 - 0.045 * ss(FRANJA1, Z1, z)
    # parabrisas inclinado hacia atrás y cola apenas inclinada hacia adelante
    y -= 0.34 * ss(FRANJA1, Z1, z) * ss(4.2, Y1, y)
    y += 0.12 * ss(2.0, Z1, z) * ss(-4.5, Y0, y)
    # techo abombado
    z += 0.1 * ss(3.3, Z1, z) * max(0.0, 1 - (x / X1) ** 2)
    return Vector((x, y, z))


def superficie(p):
    return deformar(redondeo(p))


def zona_y_material(c, eje, signo):
    x, y, z = c
    if eje == 2 and signo < 0:
        return None, 'Bajo'
    if eje == 0:
        lado = 'D' if signo > 0 else 'I'
        if VENT_Z[0] < z < VENT_Z[1]:
            for k, (a, b) in enumerate(VENTANAS):
                if a < y < b:
                    return 'v%s%d' % (lado, k), 'Vidrio'
            if lado == 'I' and CHOFER[0] < y < CHOFER[1]:
                return 'chofer', 'Vidrio'
        if lado == 'D' and PUERTA[2] < z < VENT_Z[1]:
            for k, (a, b) in enumerate(PUERTA[:2]):
                if a < y < b:
                    return 'puerta%d' % k, 'Vidrio'
    if eje == 1 and signo > 0:
        z0, z1, xc, xb = PARABRISAS
        if z0 < z < z1 and xc < abs(x) < xb:
            return 'parabrisas' + ('D' if x > 0 else 'I'), 'Vidrio'
        if CARTEL[0] < z < CARTEL[1] and abs(x) < CARTEL[2]:
            return 'cartel', 'CartelFondo'
    if eje == 1 and signo < 0:
        if TRASERA[0] < z < TRASERA[1] and abs(x) < TRASERA[2]:
            return 'trasera', 'Vidrio'
        if REJILLA[0] < z < REJILLA[1] and abs(x) < REJILLA[2]:
            return 'rejilla', 'Bajo'
    if eje == 2:
        return None, 'Techo'
    if z < FALDON:
        return None, 'Bajo'
    if z < FRANJA0:
        return None, 'Pintura'
    if z < FRANJA1:
        return None, 'Franja'
    return None, 'Crema'


# borde de cada zona: (grosor del marco, profundidad, material del marco)
INSETS = {'puerta0': (0.05, -0.05, 'Cromo'), 'puerta1': (0.05, -0.05, 'Cromo'),
          'cartel': (0.035, -0.035, 'Goma'), 'rejilla': (0.05, -0.09, 'Cromo')}


def carroceria(A):
    xin = [X1 - RX, 1.28, 1.15, 1.05, 1.0, 0.85, 0.65, 0.4, 0.05]
    xs = sorted({round(s * v, 5) for v in xin + arco_cortes(X1 - RX, RX) + [X1] for s in (1, -1)})
    ys = sorted({round(v, 5) for v in
                 [Y0, Y0 + RYB, -5.35, -4.8, -4.15, -3.0, -2.0, -1.0, 0.0, 1.0, 2.0, 3.0, 3.25, 4.3, 4.45, 4.9,
                  5.35, Y1 - RYF, Y1] + [a for w in VENTANAS for a in w] +
                 [Y1 - RYF + d for d in arco_cortes(0, RYF)] + [Y0 + RYB - d for d in arco_cortes(0, RYB)]})
    zs = sorted({round(v, 5) for v in
                 [Z0, Z0 + RZB, FALDON, 1.05, PUERTA[2], 1.35, REJILLA[1], FRANJA0, FRANJA1, PARABRISAS[0], VENT_Z[0],
                  TRASERA[0], 2.7, PARABRISAS[1], CARTEL[0], TRASERA[1], VENT_Z[1], CARTEL[1], Z1 - RZT, Z1] +
                 [Z1 - RZT + d for d in arco_cortes(0, RZT)] + [Z0 + RZB - d for d in arco_cortes(0, RZB, 2)]})
    bm = bmesh.new()
    vd = {}

    def v(p):
        k = tuple(round(a, 5) for a in p)
        if k not in vd:
            vd[k] = bm.verts.new(k)
        return vd[k]

    def grilla(f, us, ws):
        for i in range(len(us) - 1):
            for j in range(len(ws) - 1):
                bm.faces.new([v(f(us[i], ws[j])), v(f(us[i + 1], ws[j])), v(f(us[i + 1], ws[j + 1])),
                              v(f(us[i], ws[j + 1]))])

    grilla(lambda a, b: (X1, a, b), ys, zs)
    grilla(lambda a, b: (-X1, a, b), ys, zs)
    grilla(lambda a, b: (a, Y1, b), xs, zs)
    grilla(lambda a, b: (a, Y0, b), xs, zs)
    grilla(lambda a, b: (a, b, Z1), xs, ys)
    grilla(lambda a, b: (a, b, Z0), xs, ys)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mats = []
    zonas = {}
    for f in bm.faces:
        n = f.normal
        eje = max(range(3), key=lambda i: abs(n[i]))
        z, m = zona_y_material(f.calc_center_median(), eje, 1 if n[eje] > 0 else -1)
        if m not in mats:
            mats.append(m)
        f.material_index = mats.index(m)
        if z:
            zonas.setdefault(z, []).append(f)
    for vv in bm.verts:
        vv.co = superficie(vv.co)
    bm.normal_update()
    for z, faces in zonas.items():
        grosor, prof, mat = INSETS.get(z, (0.045, -0.055, 'Goma'))
        res = bmesh.ops.inset_region(bm, faces=faces, thickness=grosor, depth=prof, use_even_offset=True)
        if mat not in mats:
            mats.append(mat)
        for f in res['faces']:
            f.material_index = mats.index(mat)
    me = bpy.data.meshes.new('carroceria')
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    for m in mats:
        me.materials.append(material(m))
    ob = bpy.data.objects.new('carroceria', me)
    A.col.objects.link(ob)
    # pasaruedas: cilindros que entran 0,65 m desde cada costado
    cut = cilindro_corte(A, 'pasaruedas', [(Vector((s * (X1 + 0.05 - 0.41), ey, RUEDA_Z)), ARCO_R, 0.92)
                                           for ey in EJES for s in (1, -1)])
    cut.data.materials.append(material('Pasarueda'))
    acabado(ob, bisel=0.012, segs=2, angulo=35, cortes=[cut])
    ob.modifiers['Corte'].material_mode = 'TRANSFER'
    A.add(ob)
    return ob


# ---------------------------------------------------------------------------
# Herramientas propias del bus
def malla(A, nombre, bm, mat, bisel=0.0, angulo=35, grupo='cuerpo', liso=True, mats=None):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(nombre)
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set('use_smooth', [liso] * len(me.polygons))
    for m in (mats or [mat]):
        me.materials.append(material(m))
    old = bpy.data.objects.get(nombre)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    ob = bpy.data.objects.new(nombre, me)
    A.col.objects.link(ob)
    acabado(ob, bisel, 2, angulo)
    A.add(ob, grupo)
    return ob


def loft(bm, anillos, tapas=True, punta_ini=None, punta_fin=None, mat_de=None):
    # une anillos de igual cantidad de puntos; punta_*: punto que cierra el extremo en abanico
    vs = [[bm.verts.new(p) for p in a] for a in anillos]
    n = len(anillos[0])
    caras = []
    for i, (a, b) in enumerate(zip(vs, vs[1:])):
        for k in range(n):
            f = bm.faces.new((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]))
            if mat_de:
                f.material_index = mat_de(i, k)
            caras.append(f)
    for anillo, punta in ((vs[0], punta_ini), (vs[-1], punta_fin)):
        if punta is not None:
            c = bm.verts.new(punta)
            for k in range(n):
                f = bm.faces.new((anillo[k], anillo[(k + 1) % n], c))
                if mat_de:
                    f.material_index = mat_de(-1 if anillo is vs[0] else len(vs) - 1, k)
        elif tapas:
            f = bm.faces.new(anillo)
            if mat_de:
                f.material_index = mat_de(-1 if anillo is vs[0] else len(vs) - 1, 0)
    return vs


def perfil_ala(n=10, t=0.13, curva=0.02):
    # perfil aerodinámico (NACA de 4 cifras): lista cerrada de (u, v), u de 0 (ataque) a 1 (fuga)
    us = [0.5 * (1 - math.cos(math.pi * k / n)) for k in range(n + 1)]

    def yt(u):
        return 5 * t * (0.2969 * math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u ** 3 - 0.1036 * u ** 4)

    def yc(u):
        p = 0.4
        return curva / p ** 2 * (2 * p * u - u * u) if u < p else curva / (1 - p) ** 2 * (1 - 2 * p + 2 * p * u - u * u)

    # de la fuga por arriba hasta el ataque, y de vuelta por abajo
    arriba = [(u, yc(u) + yt(u)) for u in us]
    abajo = [(u, yc(u) - yt(u)) for u in us[1:-1]]
    return arriba[::-1] + abajo


def superficie_sustentadora(A, nombre, estaciones, eje_largo, mat_de, mats, t=0.13, curva=0.02, n=10, bisel=0.0):
    # estaciones: [(s, borde de ataque (pos 3D), cuerda, escala del espesor)] a lo largo de eje_largo
    # eje_largo 'x' (ala, estabilizador: cuerda hacia -Y, espesor en Z) o 'z' (deriva: cuerda hacia -Y, espesor en X)
    P = perfil_ala(n, t, curva)
    bm = bmesh.new()
    anillos = []
    for s, le, cuerda, esp in estaciones:
        le = Vector(le)
        if eje_largo == 'x':
            anillos.append([le + Vector((0, -u * cuerda, w * cuerda * esp)) for u, w in P])
        else:
            anillos.append([le + Vector((w * cuerda * esp, -u * cuerda, 0)) for u, w in P])
    U = [p[0] for p in P]
    N = len(estaciones)

    def md(i, k):
        # material de la cara entre las estaciones i e i+1, según su punto medio (así las dos alas quedan iguales)
        a, b = estaciones[max(0, min(i, N - 1))], estaciones[max(0, min(i + 1, N - 1))]
        return mat_de((0.5 * (a[0] + b[0]),), 0.5 * (U[k] + U[(k + 1) % len(U)]))
    loft(bm, anillos, mat_de=md)
    return malla(A, nombre, bm, None, bisel=bisel, mats=mats)


def anillo_rect(c, a, b, r, n=3, plano='xz'):
    pts = redondear([(-a, -b, r), (a, -b, r), (a, b, r), (-a, b, r)], n)
    out = []
    for p in pts:
        if plano == 'xz':
            out.append(Vector((c[0] + p.x, c[1], c[2] + p.y)))
        elif plano == 'yz':
            out.append(Vector((c[0], c[1] + p.x, c[2] + p.y)))
        else:
            out.append(Vector((c[0] + p.x, c[1] + p.y, c[2])))
    return out


def barrido_plano(A, nombre, camino, seccion, mat, cerrado=False, bisel=0.0, paso=None):
    # barrido horizontal: camino en (x, y, z); la sección (a, b) usa a = hacia afuera (normal del camino en el
    # plano XY, a la derecha del avance) y b = arriba (+Z)
    P = [Vector(p) for p in camino]
    if paso:
        P = suavizar(P, paso, cerrado)
    bm = bmesh.new()
    anillos = []
    N = len(P)
    for i, p in enumerate(P):
        if cerrado:
            t = P[(i + 1) % N] - P[i - 1]
        else:
            t = P[min(i + 1, N - 1)] - P[max(i - 1, 0)]
        t.z = 0
        t.normalize()
        out = Vector((t.y, -t.x, 0))
        anillos.append([p + out * a + Vector((0, 0, b)) for a, b in seccion])
    vs = [[bm.verts.new(q) for q in a] for a in anillos]
    n = len(seccion)
    pares = list(zip(vs, vs[1:])) + ([(vs[-1], vs[0])] if cerrado else [])
    for a, b in pares:
        for k in range(n):
            bm.faces.new((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]))
    if not cerrado:
        bm.faces.new(vs[0])
        bm.faces.new(vs[-1][::-1])
    return malla(A, nombre, bm, mat, bisel=bisel)


def suavizar(P, paso, cerrado=False):
    Q = []
    N = len(P)
    rango = range(N) if cerrado else range(N - 1)
    for i in rango:
        if cerrado:
            p0, p1, p2, p3 = P[i - 1], P[i], P[(i + 1) % N], P[(i + 2) % N]
        else:
            p0, p1, p2, p3 = P[max(i - 1, 0)], P[i], P[i + 1], P[min(i + 2, N - 1)]
        n = max(2, int((p2 - p1).length / paso))
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            Q.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                            (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    if not cerrado:
        Q.append(P[-1])
    return Q


def contorno(z, sobre=0.0, paso=0.1):
    # contorno de la carrocería a la altura z (antihorario visto de arriba), separado 'sobre' de la chapa
    base = redondear([(-X1, Y0, RYB), (X1, Y0, RYB), (X1, Y1, RYF), (-X1, Y1, RYF)], 10)
    P = []
    for i, a in enumerate(base):
        b = base[(i + 1) % len(base)]
        n = max(1, int((b - a).length / paso))
        for k in range(n):
            q = a + (b - a) * (k / n)
            P.append(superficie(Vector((q.x, q.y, z))))
    out = []
    for i, q in enumerate(P):
        t = P[(i + 1) % len(P)] - P[i - 1]
        t.z = 0
        t.normalize()
        out.append(q + Vector((t.y, -t.x, 0)) * sobre)
    return out


def tramos(P, quedar):
    # parte un contorno cerrado en tramos abiertos con los puntos donde quedar(p) es verdadero
    N = len(P)
    ok = [quedar(p) for p in P]
    if all(ok):
        return [P + [P[0]]]
    ini = next(i for i in range(N) if not ok[i])
    res, cur = [], []
    for k in range(1, N + 1):
        i = (ini + k) % N
        if ok[i]:
            cur.append(P[i])
        elif cur:
            res.append(cur)
            cur = []
    if cur:
        res.append(cur)
    return [r for r in res if len(r) > 1]


def techo_z(x, y):
    return superficie(Vector((x, y, Z1))).z


def texto(A, nombre, cadena, mat, tam, transf, grosor=0.02, offset=0.0, espaciado=1.0, resolucion=4):
    # texto en malla; transf(u, v, w) -> punto 3D (u = sentido de lectura, v = arriba, w = hacia afuera)
    d = bpy.utils.system_resource('DATAFILES')
    fuente = bpy.data.fonts.get('Inter Variable Regular') or bpy.data.fonts.load(os.path.join(d, 'fonts', 'Inter.woff2'))
    cu = bpy.data.curves.new('_t', 'FONT')
    cu.body = cadena
    cu.font = fuente
    cu.size = tam
    cu.extrude = grosor / 2
    cu.offset = offset
    cu.space_character = espaciado
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.resolution_u = resolucion
    tmp = bpy.data.objects.new('_t', cu)
    A.col.objects.link(tmp)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp)
    bm = bmesh.new()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    for vv in bm.verts:
        u, v, w = vv.co
        vv.co = transf(u, v, w + grosor / 2)
    return malla(A, nombre, bm, mat, liso=False)


def cilindro_corte(A, nombre, piezas, segs=56):
    # cortador de cilindros a lo largo de x: [(centro, radio, largo)]
    bm = bmesh.new()
    for c, r, largo in piezas:
        m = Matrix.Translation(c) @ Matrix.Rotation(math.pi / 2, 4, 'Y')
        bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r, depth=largo, matrix=m)
    me = bpy.data.meshes.new('x_' + nombre)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new('x_' + nombre, me)
    A.cortes.objects.link(ob)
    ob.display_type = 'WIRE'
    ob.hide_render = True
    return ob


# ---------------------------------------------------------------------------
# Piezas
def ruedas(A):
    for ey in EJES:
        for s in (1, -1):
            x = s * (X1 - 0.3)
            # neumático: torno cerrado (con el interior a la altura de la llanta) y hombros redondeados
            perfil = [(x - 0.21, 0.36)]
            for i in range(13):
                a = math.pi * i / 12
                perfil.append((x - 0.2 * math.cos(a), RUEDA_R - 0.1 * (1 - math.sin(a)) ** 1.6))
            perfil.append((x + 0.21, 0.36))
            torno(A, 'neum_%g_%d' % (ey, s), perfil, 'Neumatico', eje='x', centro=(ey, RUEDA_Z), segs=48, bisel=0.0,
                  cerrado=True)
            # tacos del dibujo
            bm = bmesh.new()
            for k in range(30):
                a = 2 * math.pi * k / 30
                for lado in (-1, 1):
                    c = Vector((x + lado * 0.095 + (0.03 if k % 2 else -0.03) * lado, ey + math.cos(a) * RUEDA_R,
                                RUEDA_Z + math.sin(a) * RUEDA_R))
                    m = Matrix.Translation(c) @ Matrix.Rotation(a, 4, 'X') @ Matrix.Diagonal((0.08, 0.04, 0.1, 1))
                    bmesh.ops.create_cube(bm, size=1.0, matrix=m)
            malla(A, 'taco_%g_%d' % (ey, s), bm, 'Neumatico', liso=False)
            # llanta pintada, taza cromada y tuercas (o = hacia afuera desde el flanco)
            xo = x + s * 0.2

            def P(lst):
                return [(xo + s * o, r) for o, r in lst]
            torno(A, 'llanta_%g_%d' % (ey, s), P([(-0.08, 0.0), (-0.08, 0.37), (0.005, 0.37), (0.018, 0.345),
                                                   (0.0, 0.31), (-0.01, 0.0)]), 'Llanta', eje='x',
                  centro=(ey, RUEDA_Z), segs=40, bisel=0.0)
            torno(A, 'taza_%g_%d' % (ey, s), P([(-0.01, 0.0), (-0.01, 0.235), (0.02, 0.232), (0.06, 0.18),
                                                 (0.083, 0.1), (0.09, 0.0)]), 'Cromo', eje='x', centro=(ey, RUEDA_Z),
                  segs=40, bisel=0.0)
            for k in range(8):
                a = 2 * math.pi * k / 8
                cy, cz = ey + math.cos(a) * 0.272, RUEDA_Z + math.sin(a) * 0.272
                torno(A, 'tuerca_%g_%d_%d' % (ey, s, k), P([(-0.01, 0.0), (-0.01, 0.022), (0.022, 0.022),
                                                             (0.03, 0.0)]), 'Aluminio', eje='x', centro=(cy, cz),
                      segs=6, bisel=0.0)
            # ribete del pasaruedas pegado a la chapa
            pts = []
            for i in range(29):
                a = math.radians(22 + 136 * i / 28)
                y, z = ey + math.cos(a) * (ARCO_R + 0.035), RUEDA_Z + math.sin(a) * (ARCO_R + 0.035)
                q = superficie(Vector((s * X1, y, z)))
                pts.append(q + Vector((s * 0.01, 0, 0)))
            tubo(A, 'ribete_%g_%d' % (ey, s), pts, 0.045, 'Bajo', segs=10)
        tubo(A, 'eje_%g' % ey, [(-X1 + 0.45, ey, RUEDA_Z), (X1 - 0.45, ey, RUEDA_Z)], 0.09, 'Bajo', segs=10)


def frente(A):
    yf = Y1
    # faros dobles con aro cromado
    for s in (1, -1):
        for k, (x, z, r) in enumerate(((s * 1.0, 1.3, 0.2), (s * 0.62, 1.3, 0.14))):
            torno(A, 'aroFaro_%d_%d' % (s, k), [(yf - 0.05, r + 0.05), (yf + 0.02, r + 0.05), (yf + 0.06, r + 0.03),
                                                (yf + 0.06, r), (yf + 0.02, r - 0.01)], 'Cromo', eje='y',
                  centro=(x, z), segs=32, bisel=0.0, tapas=False)
            torno(A, 'faro_%d_%d' % (s, k), [(yf + 0.02, r), (yf + 0.05, r * 0.85), (yf + 0.065, r * 0.5),
                                             (yf + 0.07, 0.0)], 'Faro', eje='y', centro=(x, z), segs=32, bisel=0.0,
                  tapas=False)
        caja(A, 'giroD_%d' % s, (s * 1.12, yf + 0.0, 1.62), (0.26, 0.08, 0.1), 'Giro', r=0.04, eje='y', bisel=0.006)
    # parrilla: marco cromado y listones
    caja(A, 'parrillaMarco', (0, yf + 0.0, 1.3), (0.78, 0.07, 0.5), 'Cromo', r=0.08, eje='y', bisel=0.008)
    caja(A, 'parrillaFondo', (0, yf + 0.03, 1.3), (0.68, 0.03, 0.4), 'Bajo', r=0.05, eje='y', bisel=0.0)
    for k in range(5):
        caja(A, 'liston_%d' % k, (0, yf + 0.055, 1.14 + k * 0.08), (0.66, 0.03, 0.035), 'Cromo', r=0.012, eje='y',
             bisel=0.0)
    # emblema con las iniciales
    torno(A, 'emblema', [(yf + 0.0, 0.0), (yf + 0.0, 0.12), (yf + 0.05, 0.12), (yf + 0.07, 0.1), (yf + 0.07, 0.0)],
          'Franja', eje='y', centro=(0, 1.62), segs=28, bisel=0.0)
    texto(A, 'emblemaSF', 'SF', 'Cromo', 0.13, lambda u, v, w: Vector((-u, yf + 0.065 + w, 1.62 + v)), grosor=0.012,
          offset=0.004)

    # paragolpes envolventes
    def paragolpes(nombre, quedar):
        sec = redondear([(-0.1, -0.12, 0.05), (0.08, -0.12, 0.05), (0.08, 0.12, 0.05), (-0.1, 0.12, 0.05)], 3)
        for k, t in enumerate(tramos(contorno(0.98, sobre=0.1), quedar)):
            barrido_plano(A, '%s_%d' % (nombre, k), t, [(p.x, p.y) for p in sec], 'Cromo')
    paragolpes('paragolpesD', lambda p: p.y > Y1 - 1.2)
    paragolpes('paragolpesT', lambda p: p.y < Y0 + 0.9)
    # cartel de destino iluminado
    zc = (CARTEL[0] + CARTEL[1]) / 2
    texto(A, 'letrero', 'SALTO FINAL', 'Letrero', 0.17,
          lambda u, v, w: Vector((-u, superficie(Vector((-u, Y1, zc + v))).y - 0.03 + w, zc + v)),
          grosor=0.02, offset=0.006, espaciado=1.1)
    # patentes sobre los paragolpes
    caja(A, 'patente', (0, yf + 0.19, 0.98), (0.62, 0.03, 0.2), 'Crema', r=0.03, eje='y', bisel=0.004)
    texto(A, 'patenteTxt', 'SF 007', 'Bajo', 0.12, lambda u, v, w: Vector((-u, yf + 0.205 + w, 0.98 + v)),
          grosor=0.008, resolucion=2)
    # limpiaparabrisas
    for s in (1, -1):
        a = superficie(Vector((s * 1.0, Y1, PARABRISAS[0] + 0.06)))
        b = superficie(Vector((s * 0.4, Y1, PARABRISAS[0] + 0.66)))
        tubo(A, 'limpia_%d' % s, [a + Vector((0, 0.02, 0.02)), b + Vector((0, 0.02, 0.02))], 0.014, 'Bajo', segs=6)
    # espejos de "orejas de conejo"
    for s in (1, -1):
        base = superficie(Vector((s * X1, Y1 - 0.3, 3.05)))
        p1 = base + Vector((s * 0.22, 0.25, 0.08))
        p2 = base + Vector((s * 0.34, 0.75, -0.35))
        p3 = base + Vector((s * 0.3, 0.95, -0.85))
        tubo(A, 'espejoBrazo_%d' % s, [base, p1, p2, p3], 0.026, 'Bajo', segs=8, paso=0.08)
        caja(A, 'espejo_%d' % s, tuple(p3 + Vector((0, 0.04, -0.16))), (0.2, 0.1, 0.38), 'Bajo', r=0.05, eje='y',
             bisel=0.01)
        caja(A, 'espejoVidrio_%d' % s, tuple(p3 + Vector((0, -0.015, -0.16))), (0.15, 0.02, 0.32), 'Cromo', r=0.04,
             eje='y', bisel=0.0)
    # luces de gálibo sobre el parabrisas
    for k in range(5):
        x = (k - 2) * 0.42
        p = superficie(Vector((x, Y1, 3.62)))
        n = (superficie(Vector((x, Y1, 3.66))) - superficie(Vector((x, Y1, 3.58)))).cross(Vector((1, 0, 0)))
        n = -n.normalized() if n.y < 0 else n.normalized()
        ob = torno(A, 'galibo_%d' % k, [(-0.01, 0.0), (-0.01, 0.06), (0.03, 0.05), (0.05, 0.0)], 'Giro', eje='y',
                   centro=(0, 0), segs=12, bisel=0.0)
        ob.matrix_world = Matrix.Translation(p) @ Vector((0, 1, 0)).rotation_difference(n).to_matrix().to_4x4()


def costados(A):
    puerta = lambda p: not (p.x > 0 and PUERTA[0][0] - 0.06 < p.y < PUERTA[1][1] + 0.06)
    arcos = lambda p: not (abs(p.x) > 1.0 and any(abs(p.y - e) < ARCO_R + 0.06 for e in EJES))
    # filete cromado bajo las ventanas (cortado en la puerta) y otro en el faldón (cortado en los pasaruedas)
    for k, t in enumerate(tramos(contorno(FRANJA1, sobre=0.0), puerta)):
        barrido_plano(A, 'filete_%d' % k, t, [(-0.01, -0.022), (0.018, -0.012), (0.018, 0.012), (-0.01, 0.022)], 'Cromo')
    zf = FALDON + 0.03
    for k, t in enumerate(tramos(contorno(zf, sobre=0.0), lambda p: arcos(p) and abs(p.y) < 5.9 and
                                 not (p.y > Y1 - 1.25 or p.y < Y0 + 0.95))):
        barrido_plano(A, 'filete2_%d' % k, t, [(-0.01, -0.016), (0.014, -0.01), (0.014, 0.01), (-0.01, 0.016)],
                      'Aluminio')
    # letras a los costados
    for s in (1, -1):
        texto(A, 'letras_%d' % s, 'SALTO FINAL', 'Crema', 0.46,
              lambda u, v, w, s=s: Vector((s * (X1 + w), s * u + 0.1, 1.33 + v)), grosor=0.025, offset=0.012,
              espaciado=1.08)
    # escalón de la puerta
    caja(A, 'escalon', (X1 - 0.05, (PUERTA[0][0] + PUERTA[1][1]) / 2, 0.66), (0.32, 0.95, 0.06), 'Aluminio', r=0.02,
         bisel=0.006)
    # rejillas del motor a los costados y tapa del tanque
    for s in (1, -1):
        for k in range(4):
            caja(A, 'rejillaLat_%d_%d' % (s, k), (s * (X1 + 0.005), -5.0, 1.12 + k * 0.1), (0.03, 0.7, 0.04), 'Bajo',
                 r=0.015, bisel=0.0)
    caja(A, 'tapaNafta', (-(X1 + 0.005), 2.0, 1.2), (0.03, 0.3, 0.3), 'Aluminio', r=0.08, bisel=0.006)


def cola(A):
    yt = Y0
    # luces traseras en columna con giro
    for s in (1, -1):
        caja(A, 'marcoTrasera_%d' % s, (s * 1.2, yt + 0.0, 1.47), (0.3, 0.06, 0.74), 'Cromo', r=0.07, eje='y',
             bisel=0.006)
        caja(A, 'luzTrasera_%d' % s, (s * 1.2, yt - 0.02, 1.4), (0.24, 0.07, 0.48), 'LuzTrasera', r=0.05, eje='y',
             bisel=0.008)
        caja(A, 'giroT_%d' % s, (s * 1.2, yt - 0.02, 1.73), (0.24, 0.07, 0.13), 'Giro', r=0.04, eje='y', bisel=0.006)
    # rejilla del motor: listones
    for k in range(5):
        caja(A, 'lamaMotor_%d' % k, (0, yt + 0.06, 1.12 + k * 0.1), (1.62, 0.05, 0.035), 'Aluminio', r=0.012,
             eje='y', bisel=0.0)
    # escalera al techo (a la derecha de la luneta)
    rieles = (1.1, 1.38)
    for x in rieles:
        q = lambda z: superficie(Vector((x, Y0, z)))
        pts = [q(1.9) + Vector((0, -0.14, 0)), q(3.4) + Vector((0, -0.14, 0)), q(3.75) + Vector((0, -0.12, 0.05)),
               Vector((x, Y0 + 0.25, techo_z(x, Y0 + 0.25) + 0.12)), Vector((x, Y0 + 0.6, techo_z(x, Y0 + 0.6) + 0.12))]
        tubo(A, 'escaleraRiel_%g' % x, pts, 0.03, 'Aluminio', segs=8, paso=0.08)
        for z in (2.0, 3.0):
            tubo(A, 'escaleraSoporte_%g_%g' % (x, z), [q(z) + Vector((0, -0.14, 0)), q(z) + Vector((0, 0.02, 0))],
                 0.02, 'Aluminio', segs=6)
    for k in range(6):
        z = 2.05 + k * 0.28
        a = superficie(Vector((rieles[0], Y0, z))) + Vector((0, -0.14, 0))
        tubo(A, 'escalon_%d' % k, [a, a + Vector((rieles[1] - rieles[0], 0, 0))], 0.022, 'Aluminio', segs=6)
    # caño de escape
    tubo(A, 'escape', [(-1.2, -4.6, 0.6), (-1.2, -5.7, 0.6), (-1.25, yt - 0.12, 0.62)], 0.07, 'Aluminio', segs=12,
         paso=0.2)
    torno(A, 'escapeBoca', [(yt - 0.2, 0.085), (yt - 0.1, 0.085), (yt - 0.1, 0.06), (yt - 0.2, 0.06)], 'Bajo',
          eje='y', centro=(-1.25, 0.62), segs=12, bisel=0.0, cerrado=True)
    # letras traseras y patente
    texto(A, 'letrasCola', 'SALTO FINAL', 'Pintura', 0.2,
          lambda u, v, w: Vector((u, superficie(Vector((u, Y0, 2.12 + v))).y - w, 2.12 + v)), grosor=0.015,
          offset=0.006, espaciado=1.1)
    caja(A, 'patenteT', (0, yt - 0.19, 0.98), (0.62, 0.03, 0.2), 'Crema', r=0.03, eje='y', bisel=0.004)
    texto(A, 'patenteTTxt', 'SF 007', 'Bajo', 0.12, lambda u, v, w: Vector((u, yt - 0.205 - w, 0.98 + v)),
          grosor=0.008, resolucion=2)


def techo(A):
    # carenado del pilón del ala
    perfil = [(-1.15, Z1 - 0.1), (ALA_LE + 0.6, Z1 - 0.1, 0.0), (ALA_LE + 0.35, Z1 + 0.25, 0.3),
              (ALA_LE - 0.4, ALA_Z + 0.05, 0.25), (-0.9, ALA_Z + 0.05, 0.2), (-1.5, Z1 + 0.15, 0.25)]
    prisma(A, 'pilon', perfil, -0.5, 0.5, 'Crema', eje='x', n=6, bisel=0.04, segs=3, angulo=30)
    # baliza roja
    yb = 4.4
    zt = techo_z(0, yb)
    torno(A, 'balizaBase', [(zt - 0.05, 0.0), (zt - 0.05, 0.16), (zt + 0.06, 0.15), (zt + 0.06, 0.0)], 'Bajo',
          eje='z', centro=(0, yb), segs=20, bisel=0.0)
    torno(A, 'baliza', [(zt + 0.06, 0.0), (zt + 0.06, 0.12), (zt + 0.16, 0.12), (zt + 0.23, 0.08), (zt + 0.25, 0.0)],
          'Baliza', eje='z', centro=(0, yb), segs=20, bisel=0.0)
    # escotilla
    zt = techo_z(0, 3.35)
    caja(A, 'escotilla', (0, 3.35, zt + 0.02), (0.9, 0.9, 0.12), 'Techo', r=0.12, eje='z', bisel=0.02)
    caja(A, 'escotillaVidrio', (0, 3.35, zt + 0.08), (0.7, 0.7, 0.03), 'Vidrio', r=0.08, eje='z', bisel=0.0)
    # portaequipajes: barandas, travesaños y patas
    y0, y1, xr = -3.8, -1.75, 1.32
    zr = techo_z(0, -2.7) + 0.4
    zc = techo_z(0, -2.7) + 0.12
    rail = [Vector(p) for p in ((xr, y0, zr), (xr, y1, zr), (-xr, y1, zr), (-xr, y0, zr), (xr, y0, zr))]
    for k in range(4):
        tubo(A, 'baranda_%d' % k, [rail[k], rail[k + 1]], 0.035, 'Aluminio', segs=8)
    for k in range(6):
        y = y0 + (y1 - y0) * k / 5
        tubo(A, 'travesano_%d' % k, [(-xr, y, zc), (xr, y, zc)], 0.03, 'Aluminio', segs=8)
    for x in (-xr, xr):
        for y in (y0, (y0 + y1) / 2, y1):
            tubo(A, 'pata_%g_%g' % (x, y), [(x, y, techo_z(x, y) - 0.05), (x, y, zr)], 0.03, 'Aluminio', segs=8)
    # equipaje
    zb = zc + 0.03

    def colocar(ob, c, rz=0.0):
        ob.matrix_world = Matrix.Translation(c) @ Matrix.Rotation(rz, 4, 'Z') @ ob.matrix_world
        return ob

    valijas = [((-0.68, -3.35, 0.0), (1.0, 0.62, 0.42), 'MaletaRoja', 0.03),
               ((-0.66, -2.64, 0.0), (0.86, 0.54, 0.34), 'MaletaAzul', -0.05),
               ((0.6, -3.34, 0.0), (1.0, 0.64, 0.5), 'Cuero', 0.04),
               ((-0.62, -3.36, 0.42), (0.7, 0.48, 0.28), 'Cuero', 0.15)]
    for i, (c, t, m, rz) in enumerate(valijas):
        piezas = [caja(A, 'valija_%d' % i, (0, 0, t[2] / 2), t, m, r=0.08, eje='z', bisel=0.015)]
        for k in (-1, 1):
            piezas.append(caja(A, 'correa_%d_%d' % (i, k), (k * t[0] * 0.27, 0, t[2] / 2),
                               (0.07, t[1] + 0.02, t[2] + 0.02), 'Cuero' if m != 'Cuero' else 'Bajo', r=0.07, eje='x',
                               bisel=0.0))
        piezas.append(tubo(A, 'manija_%d' % i, [(-0.13, 0, t[2] - 0.01), (-0.11, 0, t[2] + 0.06),
                                                 (0.11, 0, t[2] + 0.06), (0.13, 0, t[2] - 0.01)], 0.018, 'Bajo',
                           segs=6, paso=0.03))
        for ob in piezas:
            colocar(ob, (c[0], c[1], zb + c[2]), rz)
    # cajón de madera con listones
    piezas = [caja(A, 'cajon', (0, 0, 0.28), (0.7, 0.6, 0.56), 'Madera', r=0.01, eje='z', bisel=0.01)]
    for k in (-1, 1):
        piezas.append(caja(A, 'cajonLx_%d' % k, (k * 0.36, 0, 0.28), (0.04, 0.64, 0.6), 'Madera', eje='x', bisel=0.008))
        piezas.append(caja(A, 'cajonLy_%d' % k, (0, k * 0.31, 0.28), (0.74, 0.04, 0.6), 'Madera', eje='y', bisel=0.008))
        piezas.append(caja(A, 'cajonLz_%d' % k, (0, k * 0.15, 0.58), (0.74, 0.1, 0.04), 'Madera', eje='z', bisel=0.006))
    for ob in piezas:
        colocar(ob, (-0.64, -2.06, zb), -0.06)
    # bolso tipo tubo arriba de la valija azul
    ob = torno(A, 'bolso', [(-0.42, 0.0), (-0.41, 0.13), (-0.33, 0.19), (0.33, 0.19), (0.41, 0.13), (0.42, 0.0)],
               'MaletaAzul', eje='x', centro=(0, 0.17), segs=16, bisel=0.0)
    colocar(ob, (-0.66, -2.64, zb + 0.34), 0.1)
    for k in (-0.2, 0.2):
        ob = torno(A, 'bolsoCinta_%g' % k, [(k - 0.025, 0.195), (k + 0.025, 0.195)], 'Bajo', eje='x', centro=(0, 0.17),
                   segs=16, bisel=0.0, tapas=False)
        colocar(ob, (-0.66, -2.64, zb + 0.34), 0.1)
    # lona atada
    lona = torno(A, 'lona', [(-0.6, 0.0), (-0.59, 0.2), (-0.5, 0.27), (0.5, 0.27), (0.59, 0.2), (0.6, 0.0)],
                 'Lona', eje='x', centro=(0.0, 0.0), segs=14, bisel=0.0)
    M = Matrix.Translation((0.6, -2.74, zb + 0.23)) @ Matrix.Diagonal((1, 1, 0.85, 1))
    lona.matrix_world = M
    for k in (-0.32, 0.32):
        cu = torno(A, 'lonaCuerda_%g' % k, [(k - 0.025, 0.285), (k + 0.025, 0.285)], 'Cuero', eje='x', centro=(0, 0),
                   segs=14, bisel=0.0, tapas=False)
        cu.matrix_world = M
    # rueda de auxilio acostada
    zt = zb
    torno(A, 'auxilio', [(zt, 0.19), (zt, 0.4), (zt + 0.04, 0.44), (zt + 0.18, 0.44), (zt + 0.22, 0.4),
                         (zt + 0.22, 0.19)], 'Neumatico', eje='z', centro=(0.62, -2.1), segs=32, bisel=0.0,
          cerrado=True)
    torno(A, 'auxilioLlanta', [(zt + 0.04, 0.0), (zt + 0.04, 0.2), (zt + 0.17, 0.2), (zt + 0.17, 0.0)], 'Llanta',
          eje='z', centro=(0.62, -2.1), segs=32, bisel=0.0)
    torno(A, 'auxilioTaza', [(zt + 0.17, 0.0), (zt + 0.17, 0.12), (zt + 0.2, 0.08), (zt + 0.21, 0.0)], 'Cromo',
          eje='z', centro=(0.62, -2.1), segs=24, bisel=0.0)


def ala(A):
    S = ALA_SPAN

    def le(x):
        a = abs(x)
        return Vector((x, ALA_LE - 0.1 * a, ALA_Z + 0.035 * a))

    def cuerda(x):
        return 2.8 - 1.0 * abs(x) / S

    xs = [0, 0.5, 1.2, 2.2, 3.2, 3.9, 4.6, 5.3, 6.2, 7.0, 7.9, 8.8, 9.3, 9.55]
    est = []
    for x in sorted({s * v for v in xs for s in (1, -1)}):
        est.append((x, le(x), cuerda(x), 1.0))
    # puntas redondeadas
    for s in (1, -1):
        for k, (dx, fe, fc) in enumerate(((0.3, 0.85, 0.96), (0.42, 0.55, 0.88), (0.47, 0.25, 0.78))):
            x = s * (9.55 + dx)
            p = le(s * 9.55) + Vector((s * dx, -cuerda(9.55) * (1 - fc) * 0.5, 0))
            est.append((x, p, cuerda(9.55) * fc, fe))
    est.sort(key=lambda e: e[0])
    mats = ['Pintura', 'Aluminio', 'Timon', 'Franja']

    def mat_de(e, u):
        x = abs(e[0])
        if x > 8.85:
            return 3
        if u < 0.1:
            return 1
        if u > 0.74 and 5.4 < x < 8.7:
            return 2
        if u > 0.78 and 1.3 < x < 3.8:
            return 2
        return 0
    superficie_sustentadora(A, 'ala', est, 'x', mat_de, mats, t=0.14, curva=0.025, n=12)
    # luces de navegación en las puntas
    for s, m in ((1, 'NavVerde'), (-1, 'NavRoja')):
        p = le(s * 9.95) + Vector((0, -0.35, 0.03))
        caja(A, 'nav_%d' % s, tuple(p), (0.12, 0.3, 0.1), m, r=0.04, eje='z', bisel=0.0)
        p2 = le(s * 9.8) + Vector((0, -cuerda(9.8) + 0.15, 0.02))
        caja(A, 'navCola_%d' % s, tuple(p2), (0.1, 0.12, 0.07), 'Destello', r=0.03, eje='z', bisel=0.0)
    # montantes desde el filete hasta el ala (perfil aplanado)
    for s in (1, -1):
        for y_b, y_a in ((1.6, 1.15), (0.1, 0.55)):
            b = superficie(Vector((s * X1, y_b, 1.86)))
            a = le(s * 3.5) + Vector((0, -(ALA_LE - 0.35 - y_a), -0.02))
            a.y = y_a
            tubo(A, 'montante_%d_%g' % (s, y_b), [b + Vector((s * 0.03, 0, 0)), a], 0.075, 'Aluminio', segs=10,
                 achatar=0.45)
            torno(A, 'herraje_%d_%g' % (s, y_b), [(b.x - s * 0.01, 0.0), (b.x - s * 0.01, 0.1), (b.x + s * 0.05, 0.085),
                                                  (b.x + s * 0.07, 0.0)], 'Aluminio', eje='x', centro=(b.y, b.z), segs=12,
                  bisel=0.0)
    # motores
    for s in (1, -1):
        x = s * MOTOR_X
        c = le(x)
        cz = c.z - 0.38
        yf = c.y + 1.15
        perfil = [(yf, 0.36), (yf - 0.05, 0.47), (yf - 0.3, 0.56), (yf - 1.2, 0.6), (c.y - cuerda(x) + 0.3, 0.5),
                  (c.y - cuerda(x) - 0.6, 0.3), (c.y - cuerda(x) - 0.85, 0.12)]
        torno(A, 'gondola_%d' % s, [(h, r) for h, r in reversed(perfil)], 'Crema', eje='y', centro=(x, cz), segs=32,
              bisel=0.0)
        torno(A, 'gondolaAro_%d' % s, [(yf - 0.02, 0.5), (yf + 0.05, 0.49), (yf + 0.07, 0.42), (yf + 0.02, 0.35),
                                       (yf - 0.06, 0.34)], 'Cromo', eje='y', centro=(x, cz), segs=32, bisel=0.0,
              cerrado=True)
        torno(A, 'gondolaBoca_%d' % s, [(yf - 0.08, 0.36), (yf - 0.05, 0.0)], 'Bajo', eje='y', centro=(x, cz),
              segs=32, bisel=0.0, tapas=False)
        # franja amarilla y caños de escape
        torno(A, 'gondolaFranja_%d' % s, [(yf - 0.62, 0.0), (yf - 0.62, 0.604), (yf - 0.82, 0.604), (yf - 0.82, 0.0)],
              'Franja', eje='y', centro=(x, cz), segs=32, bisel=0.0)
        for k in (-1, 1):
            p0 = Vector((x + k * 0.5, yf - 1.0, cz - 0.15))
            tubo(A, 'escapeMotor_%d_%d' % (s, k), [p0, p0 + Vector((k * 0.08, -0.6, -0.05))], 0.06, 'Aluminio',
                 segs=10)


def helice(A, grupo, x, y, z, sentido):
    # buje + cono y cuatro palas con torsión; el pivote queda en el centro (se arma en el origen)
    torno(A, grupo + '_cono', [(0.0, 0.38), (0.15, 0.37), (0.4, 0.3), (0.62, 0.17), (0.76, 0.0)], 'Franja', eje='y',
          centro=(0, 0), segs=28, bisel=0.0, grupo=grupo)
    torno(A, grupo + '_buje', [(-0.12, 0.33), (0.0, 0.39), (0.02, 0.0)], 'Cromo', eje='y', centro=(0, 0), segs=28,
          bisel=0.0, grupo=grupo)
    P = perfil_ala(6, 0.12, 0.04)
    mats = ['Pala', 'Franja', 'Cromo']
    for k in range(4):
        a = 2 * math.pi * k / 4 + math.pi / 4
        er = Vector((math.cos(a), 0, math.sin(a)))
        et = Vector((-math.sin(a), 0, math.cos(a))) * sentido
        ey = Vector((0, 1, 0))
        anillos = []
        info = []
        for r, cu, beta, esp in ((0.2, 0.2, 62, 1.6), (0.32, 0.3, 55, 1.2), (0.5, 0.36, 44, 1.0), (0.8, 0.34, 32, 0.9),
                                 (1.1, 0.3, 24, 0.85), (1.32, 0.26, 19, 0.8), (1.44, 0.2, 17, 0.7),
                                 (1.5, 0.12, 16, 0.5)):
            b = math.radians(beta)
            dc = et * math.cos(b) + ey * math.sin(b)
            dn = -et * math.sin(b) + ey * math.cos(b)
            anillos.append([er * r + dc * ((0.35 - u) * cu) + dn * (w * cu * esp) for u, w in P])
            info.append(r)
        bm = bmesh.new()
        loft(bm, anillos, mat_de=lambda i, kk: 1 if info[max(0, min(i, len(info) - 1))] >= 1.3 else
             (2 if info[max(0, min(i, len(info) - 1))] < 0.25 else 0))
        malla(A, grupo + '_pala%d' % k, bm, None, mats=mats, grupo=grupo)
    A.pivotes_helice[grupo] = (x, y, z)


def empenaje(A):
    # deriva central con timón y franja, estabilizador en cruz y derivas en las puntas
    yb = -4.0
    est = []
    for z, dy, cu, fe in ((Z1 - 0.15, 0.0, 2.3, 1.0), (Z1 + 0.4, -0.22, 2.1, 1.0), (Z1 + 1.0, -0.48, 1.85, 1.0),
                          (Z1 + 1.6, -0.74, 1.6, 1.0), (Z1 + 2.05, -0.95, 1.4, 1.0), (Z1 + 2.2, -1.03, 1.34, 0.75),
                          (Z1 + 2.27, -1.07, 1.28, 0.4)):
        est.append((z, (0, yb + dy, z), cu, fe))
    mats = ['Crema', 'Timon', 'Franja']

    def mat_de(e, u):
        z = e[0]
        if z > Z1 + 1.55:
            return 2
        if u > 0.7:
            return 1
        return 0
    superficie_sustentadora(A, 'deriva', est, 'z', mat_de, mats, t=0.12, curva=0.0, n=10)
    for k in (1, -1):
        texto(A, 'derivaSF_%d' % k, 'SF', 'Pintura', 0.55,
              lambda u, v, w, k=k: Vector((k * (0.1 + w), k * u - 5.0, Z1 + 0.85 + v)), grosor=0.02, offset=0.02)
    caja(A, 'destelloCola', (0, yb - 1.07 - 0.8, Z1 + 2.33), (0.1, 0.25, 0.1), 'Destello', r=0.04, eje='y', bisel=0.0)
    # estabilizador
    ze = Z1 + 0.62
    est = []
    for x in (-3.0, -2.6, -2.0, -1.2, -0.4, 0.0, 0.4, 1.2, 2.0, 2.6, 3.0):
        a = abs(x)
        est.append((x, (x, yb - 0.75 - 0.12 * a, ze), 1.55 - 0.15 * a, 1.0))
    mats2 = ['Pintura', 'Timon', 'Aluminio']

    def mat2(e, u):
        if u < 0.08:
            return 2
        if u > 0.72 and abs(e[0]) > 0.5:
            return 1
        return 0
    superficie_sustentadora(A, 'estabilizador', est, 'x', mat2, mats2, t=0.11, curva=0.0, n=10)
    # derivas de punta
    for s in (1, -1):
        x = s * 3.02
        est = []
        for z, dy, cu, fe in ((ze - 0.36, 0.05, 0.85, 0.45), (ze - 0.3, 0.0, 1.05, 1.0), (ze, -0.05, 1.2, 1.0),
                              (ze + 0.5, -0.32, 0.95, 1.0), (ze + 0.6, -0.39, 0.82, 0.6)):
            est.append((z, (x, yb - 0.75 - 0.36 + dy - 0.02, z), cu, fe))
        superficie_sustentadora(A, 'derivaPunta_%d' % s, est, 'z', lambda e, u: 0 if e[0] < ze + 0.32 else 1,
                                ['Pintura', 'Franja'], t=0.1, curva=0.0, n=8)


# ---------------------------------------------------------------------------
def armar_bus():
    A = Arma('bus')
    A.pivotes_helice = {}
    carroceria(A)
    ruedas(A)
    frente(A)
    costados(A)
    cola(A)
    techo(A)
    ala(A)
    empenaje(A)
    for s, g in ((1, 'Helice_D'), (-1, 'Helice_I')):
        c = Vector((s * MOTOR_X, ALA_LE - 0.1 * MOTOR_X, ALA_Z + 0.035 * MOTOR_X))
        helice(A, g, s * MOTOR_X, c.y + 1.2, c.z - 0.38, s)
    return A


def exportar_bus(A, ruta):
    # une las piezas (cuerpo + una por hélice), baja todo BAJAR metros y exporta el GLB
    piv = {g: p for g, p in A.pivotes_helice.items()}
    # las hélices se modelaron en el origen: se trasladan a su lugar antes de unir
    for ob, g in A.piezas:
        if g in piv:
            ob.matrix_world = Matrix.Translation(piv[g]) @ ob.matrix_world
    info = finalizar(A, pivotes=piv)
    col = bpy.data.collections['exp_bus']
    raiz = bpy.data.objects['bus']
    for ob in col.objects:
        if ob.type == 'MESH':
            if ob.name == 'bus_cuerpo':
                ob.name = 'Carroceria'
            elif ob.name.startswith('bus_Helice'):
                ob.name = ob.name[4:]
    raiz.name = 'Bus'
    # el bus queda con el centro en el origen
    for ob in col.objects:
        if ob.parent is None:
            ob.location.z -= BAJAR
    col.hide_render = False
    if ruta:
        for o in bpy.data.objects:
            try:
                o.select_set(False)
            except RuntimeError:
                pass
        for o in col.objects:
            o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=ruta, export_format='GLB', use_selection=True, export_yup=True,
                                  export_apply=False, export_extras=False, export_animations=False,
                                  export_tangents=False, export_texcoords=False)
    return info


# ---------------------------------------------------------------------------
# Fotos de revisión: cielo con sol, Cycles (o EEVEE) y vistas fijas
VISTAS_BUS = {
    'tres4': ((14, 17, 4.5), (0, 0.5, 0.2), 40),         # tres cuartos de frente
    'atras': ((-9, -26, 9.5), (0, -1, 0.5), 40),          # como lo ve el jugador desde el bus
    'lado': ((24, 1, 1.0), (0, 0, 0.3), 45),
    'arriba': ((10, -16, 20), (0, 0, 0), 40),
    'frente': ((2.5, 18, 0.2), (0, 3, 0.0), 50),
    'rueda': ((6.5, 7.5, -1.2), (1.8, 3.6, -1.6), 35),
    'techo': ((5, -10, 7), (0, -2.8, 2.2), 40),
}


def fotos_bus(carpeta, vistas, res=(1280, 760)):
    sc = bpy.context.scene
    w = sc.world or bpy.data.worlds.new('Cielo')
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    sky = nt.nodes.new('ShaderNodeTexSky')
    try:
        sky.sky_type = 'MULTIPLE_SCATTERING'
    except TypeError:
        sky.sky_type = 'NISHITA'
    sky.sun_elevation = math.radians(38)
    sky.sun_rotation = math.radians(140)
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs[1].default_value = 0.35
    out = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(sky.outputs[0], bg.inputs[0])
    nt.links.new(bg.outputs[0], out.inputs[0])
    sol = bpy.data.objects.get('_Sol')
    if not sol:
        sol = bpy.data.objects.new('_Sol', bpy.data.lights.new('_Sol', 'SUN'))
        sc.collection.objects.link(sol)
    sol.data.energy = 3.2
    sol.data.angle = math.radians(2)
    sol.rotation_euler = (math.radians(52), 0, math.radians(140 - 90))
    for c in sc.collection.children:
        c.hide_render = c.name != 'exp_bus'
    cam = bpy.data.objects.get('_CamBus')
    if not cam:
        cam = bpy.data.objects.new('_CamBus', bpy.data.cameras.new('_CamBus'))
        sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = int(os.environ.get('SF_MUESTRAS', '24'))
    sc.cycles.use_denoising = True
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
    r = sc.render
    r.resolution_x, r.resolution_y = res
    r.resolution_percentage = 100
    r.image_settings.file_format = 'JPEG'
    r.image_settings.quality = 88
    for v in vistas:
        pos, mira, lente = VISTAS_BUS[v]
        cam.location = pos
        d = Vector(mira) - Vector(pos)
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        cam.data.lens = lente
        r.filepath = os.path.join(carpeta, 'bus_%s.jpg' % v)
        bpy.ops.render.render(write_still=True)
