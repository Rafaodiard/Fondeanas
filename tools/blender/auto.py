# Auto de Salto Final (diseño propio): hatchback compacto de tres puertas y cuatro asientos, con trompa corta,
# faros envolventes, techo negro, alerón chico sobre el portón y llantas de seis rayos. Lo maneja el jugador.
# Requiere armas_base.py y bus.py ejecutados antes (usa sus herramientas: torno, tubo, caja, prisma, malla, texto,
# cilindro_corte, barrido_plano, acabado y finalizar).
# Medidas en metros, con el piso en z = 0; el frente mira a +Y (en glTF queda -Z, como el juego) y la derecha es +X.
#
# Uso (Blender 5.x o bpy como módulo, SF_OUT = carpeta de trabajo):
#   exec(open('armas_base.py').read()); exec(open('bus.py').read()); exec(open('auto.py').read())
#   A = armar_auto(); exportar_auto(A, 'auto_crudo.glb'); fotos_auto(carpeta, ['tres4', 'atras', 'lado'])
#   gltf-transform meshopt auto_crudo.glb public/models/auto.glb      (comprime la malla; el juego la decodifica)
# Nodos del GLB: 'Auto' (raíz) > 'Carroceria' (todo lo fijo), 'Rueda_DI', 'Rueda_DD', 'Rueda_TI', 'Rueda_TD'
# (pivote en el centro de la rueda: giran sobre su X local y las de adelante doblan sobre su Y) y 'Volante'
# (pivote en el centro del volante; gira sobre su Z local, que apunta al conductor).
# Materiales que el juego toca: 'Pintura' (se tiñe con el color de cada auto), 'Vidrio' (transparente),
# 'Faro', 'LuzTrasera' (se prende al frenar) y 'Giro'.
import bpy, bmesh, math, os
from mathutils import Vector, Matrix

# ---------------------------------------------------------------------------
# Medidas generales (las mismas que usa public/js/autos.js para el choque y los asientos)
AY0, AY1 = -2.25, 2.25          # cola y trompa
AHW = 1.01                      # medio ancho de la carrocería
RE_D, RE_T = 0.34, 0.3          # radio del redondeo de la trompa y de la cola (vista de arriba y de costado)
RB, RS = 0.12, 0.1              # radios del borde de abajo y del hombro (línea de cintura)
RUEDA_R, RUEDA_A = 0.39, 0.27   # radio y ancho del neumático
EJE_D, EJE_T, TROCHA = 1.42, -1.36, 0.84
ARCO = 0.47                     # radio del pasaruedas

# líneas de diseño (y): parabrisas, puerta, ventanas, portón
PB0, PB1 = 1.18, 0.30           # base del parabrisas (sobre el capó) y su borde de arriba (techo)
PUERTA0, PUERTA1 = 0.90, -0.58  # bordes de la puerta (adelante y atrás)
VENT0 = 1.02                    # borde de adelante de la ventanilla
PILAR_B = (-0.50, -0.66)        # pilar B (negro)
VENT_T1 = -1.30                 # fin de la ventanilla trasera
PT0, PT1 = -1.30, -1.94         # luneta del portón (arriba y abajo)
JUNTA = 0.007                   # media separación de las juntas de la puerta

PALETA.update({
    'Pintura': dict(c=(0.62, 0.04, 0.03), m=0.0, r=0.28),
    'TechoNegro': dict(c=(0.012, 0.012, 0.014), m=0.0, r=0.3),
    'Plastico': dict(c=(0.018, 0.019, 0.021), m=0.0, r=0.62),
    'Junta': dict(c=(0.004, 0.004, 0.005), m=0.0, r=0.8),
    'Bajo': dict(c=(0.02, 0.021, 0.024), m=0.0, r=0.75),
    'Pasarueda': dict(c=(0.008, 0.008, 0.01), m=0.0, r=0.95),
    'Cromo': dict(c=(0.80, 0.81, 0.83), m=1.0, r=0.16),
    'Vidrio': dict(c=(0.02, 0.04, 0.055), m=0.0, r=0.05),
    'Goma': dict(c=(0.014, 0.014, 0.016), m=0.0, r=0.85),
    'Neumatico': dict(c=(0.022, 0.022, 0.024), m=0.0, r=0.92),
    'Llanta': dict(c=(0.62, 0.63, 0.65), m=0.9, r=0.28),
    'LlantaOscura': dict(c=(0.05, 0.052, 0.058), m=0.6, r=0.4),
    'Faro': dict(c=(1.0, 0.95, 0.82), m=0.0, r=0.08, e=3.0),
    'FaroFondo': dict(c=(0.55, 0.56, 0.58), m=1.0, r=0.12),
    'LuzTrasera': dict(c=(0.55, 0.0, 0.0), m=0.0, r=0.15, e=1.2),
    'Giro': dict(c=(1.0, 0.38, 0.01), m=0.0, r=0.2, e=1.6),
    'Rejilla': dict(c=(0.01, 0.01, 0.012), m=0.2, r=0.5),
    'Patente': dict(c=(0.86, 0.86, 0.84), m=0.0, r=0.4),
    'Tapizado': dict(c=(0.06, 0.055, 0.05), m=0.0, r=0.75),
    'Costura': dict(c=(0.5, 0.18, 0.03), m=0.0, r=0.6),
    'Tablero': dict(c=(0.03, 0.031, 0.034), m=0.0, r=0.55),
    'Piso': dict(c=(0.02, 0.02, 0.022), m=0.0, r=0.95),
    'Emblema': dict(c=(1.0, 0.55, 0.05), m=0.0, r=0.3, e=0.6),
})


def ss(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def pchip(knots):
    # interpolación monótona por tramos (sin rebotes) de [(y, valor)] ordenados por y
    xs = [k[0] for k in knots]
    ys = [k[1] for k in knots]
    n = len(xs)
    h = [xs[i + 1] - xs[i] for i in range(n - 1)]
    d = [(ys[i + 1] - ys[i]) / h[i] for i in range(n - 1)]
    m = [0.0] * n
    m[0], m[-1] = d[0], d[-1]
    for i in range(1, n - 1):
        if d[i - 1] * d[i] <= 0:
            m[i] = 0.0
        else:
            w1, w2 = 2 * h[i] + h[i - 1], h[i] + 2 * h[i - 1]
            m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])

    def f(y):
        if y <= xs[0]:
            return ys[0]
        if y >= xs[-1]:
            return ys[-1]
        i = max(k for k in range(n - 1) if xs[k] <= y)
        t = (y - xs[i]) / h[i]
        t2, t3 = t * t, t * t * t
        return ((2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] +
                (t3 - t2) * h[i] * m[i + 1])
    return f


# perfil de costado: techo, cintura y piso (antes del redondeo de las puntas)
TECHO = pchip([(AY0, 1.08), (-2.05, 1.16), (PT1, 1.26), (-1.62, 1.6), (PT0, 1.85), (-1.0, 1.9), (-0.4, 1.925),
               (0.0, 1.915), (PB1, 1.895), (0.62, 1.66), (0.95, 1.36), (PB0, 1.17), (1.6, 1.12), (2.0, 1.07),
               (AY1, 1.03)])
CINTURA = pchip([(AY0, 1.14), (-1.9, 1.16), (-1.0, 1.13), (0.0, 1.1), (1.0, 1.07), (AY1, 1.05)])
PISO = pchip([(AY0, 0.44), (-1.9, 0.36), (-1.4, 0.31), (1.5, 0.31), (2.0, 0.34), (AY1, 0.4)])
ANCHO = pchip([(AY0, 0.985), (-1.6, 1.01), (1.2, 1.01), (2.0, 0.985), (AY1, 0.97)])


def puntas(y):
    # cuánto se achica la sección en las puntas (redondeo de la trompa y de la cola)
    if y > AY1 - RE_D:
        t = min(1.0, (y - (AY1 - RE_D)) / RE_D)
        return RE_D * (1 - math.sqrt(max(0.0, 1 - t * t)))
    if y < AY0 + RE_T:
        t = min(1.0, ((AY0 + RE_T) - y) / RE_T)
        return RE_T * (1 - math.sqrt(max(0.0, 1 - t * t)))
    return 0.0


def seccion(y):
    s = puntas(y)
    hw = ANCHO(y) - s
    ztop = TECHO(y) - s * (0.55 if y > 0 else 0.7)
    zbot = PISO(y) + s * 0.45
    zbelt = min(CINTURA(y), TECHO(y) - 0.05) - s * (0.55 if y > 0 else 0.7)
    zbelt = max(zbelt, zbot + RB + RS + 0.05)
    ztop = max(ztop, zbelt + 0.04)
    gh = ztop - zbelt
    k = ss(0.06, 0.35, gh)
    wr = lerp(hw - RS - 0.05, hw * 0.79 - s * 0.2, k)
    rr = min(0.15, gh * 0.42, wr * 0.5)
    rb = min(RB, (zbelt - zbot) * 0.3)
    rs = min(RS, (zbelt - zbot) * 0.3)
    return dict(hw=hw, ztop=ztop, zbot=zbot, zbelt=zbelt, wr=wr, rr=rr, rb=rb, rs=rs, gh=gh)


# bandas de la sección (de abajo al centro del techo, lado derecho): s va de 0 (centro del piso) a 7 (centro del
# techo). Cada banda tiene sus cortes parejos; las zonas (vidrios, faros, juntas) suman los suyos.
BANDAS = [3, 3, 8, 3, 4, 3, 4]   # piso, borde de abajo, costado, hombro, invernadero, borde del techo, techo

# Zonas hundidas de la chapa, en coordenadas de la grilla (y, s): el interior se hunde 'prof' por la normal y el
# borde (de ancho dy en y y ds en s) es el marco, inclinado. Así no hace falta cortar la malla después.
#   nombre: (y0, y1, s0, s1, dy, ds, prof, material, marco)
ZONAS = {
    'ventana': (PILAR_B[0], VENT0, 4.0, 5.0, 0.03, 0.08, -0.028, 'Vidrio', 'Goma'),
    'ventanaT': (VENT_T1, PILAR_B[1], 4.0, 5.0, 0.03, 0.08, -0.028, 'Vidrio', 'Goma'),
    'parabrisas': (PB1, PB0, 6.0, 7.0, 0.035, 0.1, -0.03, 'Vidrio', 'Goma'),
    'luneta': (PT1, PT0, 6.0, 7.0, 0.03, 0.1, -0.03, 'Vidrio', 'Goma'),
    'faro': (1.96, 2.22, 2.42, 2.92, 0.022, 0.05, -0.035, 'FaroFondo', 'Cromo'),
    'giroD': (2.08, 2.2, 2.26, 2.38, 0.012, 0.03, -0.012, 'Giro', 'Plastico'),
    'trasera': (-2.19, -2.0, 2.42, 2.92, 0.02, 0.05, -0.02, 'LuzTrasera', 'Plastico'),
    'junta0': (PUERTA0 - JUNTA, PUERTA0 + JUNTA, 1.66, 4.0, JUNTA, 0.0, -0.012, None, 'Junta'),
    'junta1': (PUERTA1 - JUNTA, PUERTA1 + JUNTA, 1.66, 4.0, JUNTA, 0.0, -0.012, None, 'Junta'),
}


def _s_lista():
    s = set()
    for b, n in enumerate(BANDAS):
        for k in range(n + 1):
            s.add(round(b + k / n, 5))
    for y0, y1, s0, s1, dy, ds, *_ in ZONAS.values():
        for v in (s0, s0 + ds, s1 - (ds if s1 < 7.0 else 0.0), s1):
            s.add(round(min(7.0, v), 5))
    for v in (1.66, 2.25):
        s.add(v)
    return sorted(s)


S_LISTA = _s_lista()


def punto_seccion(y, s, lado=1):
    # punto de la carrocería en (y, s), sin hundir
    q = seccion(y)
    hw, zb, zt, zc, wr, rr, rb, rs = q['hw'], q['zbot'], q['ztop'], q['zbelt'], q['wr'], q['rr'], q['rb'], q['rs']
    b = min(6, int(s))
    f = s - b
    if b == 0:
        x, z = f * (hw - rb), zb
    elif b == 1:
        a = math.radians(-90 + 90 * f)
        x, z = hw - rb + rb * math.cos(a), zb + rb + rb * math.sin(a)
    elif b == 2:
        z = lerp(zb + rb, zc - rs, f)
        x = hw + 0.022 * math.sin(math.pi * f) - 0.018 * (1 - f) ** 3
    elif b == 3:
        a = math.radians(90 * f)
        x, z = hw - rs + rs * math.cos(a), zc - rs + rs * math.sin(a)
    elif b == 4:
        x0, z0, x1, z1 = hw - rs, zc, wr, zt - rr
        x = lerp(x0, x1, f) + 0.025 * math.sin(math.pi * f) * ss(0.1, 0.3, q['gh'])
        z = lerp(z0, z1, f)
    elif b == 5:
        a = math.radians(90 * f)
        x, z = wr - rr + rr * math.cos(a), zt - rr + rr * math.sin(a)
    else:
        x = (wr - rr) * (1 - f)
        z = zt + 0.028 * (1 - (x / max(wr - rr, 1e-6)) ** 2) * ss(0.1, 0.4, q['gh'])
    return Vector((lado * x, y, z))


def normal_seccion(y, s, lado=1):
    dy, ds = 0.01, 0.02
    t1 = punto_seccion(y + dy, s, lado) - punto_seccion(y - dy, s, lado)
    t2 = punto_seccion(y, min(7.0, s + ds), lado) - punto_seccion(y, max(0.0, s - ds), lado)
    n = t1.cross(t2)
    if lado < 0:
        n = -n
    if s >= 6.99:
        n = Vector((0, -t1.z, t1.y)) if t1.length > 1e-9 else Vector((0, 0, 1))
        if n.z < 0:
            n = -n
    if n.length < 1e-9:
        return Vector((lado, 0, 0))
    return n.normalized()


def zona_de(y, s, interior):
    # zona que contiene (y, s): en su interior (interior=True) o en su marco
    for nombre, (y0, y1, s0, s1, dy, ds, *_r) in ZONAS.items():
        e = 1e-5
        ds1 = 0.0 if s1 >= 7.0 else ds
        if interior:
            if y0 + dy - e <= y <= y1 - dy + e and s0 + ds - e <= s <= s1 - ds1 + e:
                return nombre
        elif y0 - e <= y <= y1 + e and s0 - e <= s <= s1 + e:
            return nombre
    return None


def punto_chapa(y, s, lado=1):
    # punto final de la chapa: hundido si cae dentro de una zona
    p = punto_seccion(y, s, lado)
    z = zona_de(y, s, True)
    if z:
        p = p + normal_seccion(y, s, lado) * ZONAS[z][6]
    return p


def estaciones():
    # cortes a lo largo del auto: parejos cada ~6 cm, más las líneas de las zonas, más arcos en las puntas
    ys = set()
    n = int((AY1 - RE_D - (AY0 + RE_T)) / 0.06)
    for k in range(n + 1):
        ys.add(round(lerp(AY0 + RE_T, AY1 - RE_D, k / n), 5))
    for k in range(1, 10):
        ys.add(round(AY1 - RE_D + RE_D * math.sin(math.radians(90 * k / 9)), 5))
        ys.add(round(AY0 + RE_T - RE_T * math.sin(math.radians(90 * k / 9)), 5))
    ys.update([AY0, AY1, 1.88, -1.86, 2.0, -2.0])
    for y0, y1, s0, s1, dy, ds, *_ in ZONAS.values():
        for v in (y0, y0 + dy, y1 - dy, y1):
            ys.add(round(v, 5))
    ys = sorted(ys)
    # sin cortes casi pegados (menos de 4 mm) salvo los de las zonas
    return ys


def material_de(y, s):
    # material de una cara según su centro (y, s)
    z = zona_de(y, s, True)
    if z and ZONAS[z][7]:
        return ZONAS[z][7]
    z = zona_de(y, s, False)
    if z:
        return ZONAS[z][8]
    if s < 1.0:
        return 'Bajo'
    if y > 1.88 and s < 2.25:
        return 'Plastico'                     # paragolpes de adelante
    if y < -1.86 and s < 2.25:
        return 'Plastico'                     # paragolpes de atrás
    if 1.0 <= s < 1.66:
        return 'Plastico'                     # zócalo negro a lo largo del costado
    if 4.0 <= s < 5.0 and PILAR_B[0] >= y >= PILAR_B[1]:
        return 'TechoNegro'                   # pilar B
    if 5.0 <= s and PB0 > y > PT1:
        return 'TechoNegro'                   # techo y pilares A y C, negros
    return 'Pintura'


def carroceria_auto(A):
    ys = estaciones()
    bm = bmesh.new()
    anillos = []
    params = []
    for y in ys:
        der = [punto_chapa(y, s, 1) for s in S_LISTA]
        izq = [punto_chapa(y, s, -1) for s in S_LISTA]
        anillos.append([bm.verts.new(p) for p in der + izq[-2:0:-1]])
        params.append(S_LISTA + S_LISTA[-2:0:-1])
    n = len(anillos[0])
    mats = []

    def mat_idx(m):
        if m not in mats:
            mats.append(m)
        return mats.index(m)
    for i in range(len(anillos) - 1):
        a, b = anillos[i], anillos[i + 1]
        yc = (ys[i] + ys[i + 1]) / 2
        for k in range(n):
            k2 = (k + 1) % n
            f = bm.faces.new((a[k], b[k], b[k2], a[k2]))
            f.material_index = mat_idx(material_de(yc, (params[i][k] + params[i][k2]) / 2))
    # tapas de las puntas (trompa y cola), planas: las cubre la parrilla y la patente
    for anillo, m in ((anillos[0], 'Plastico'), (anillos[-1], 'Pintura')):
        f = bm.faces.new(anillo)
        f.material_index = mat_idx(m)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0004)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=0.0004)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('carroceria')
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    for m in mats:
        me.materials.append(material(m))
    ob = bpy.data.objects.new('carroceria', me)
    A.col.objects.link(ob)
    # pasaruedas: cilindros que entran desde cada costado
    cut = cilindro_corte(A, 'pasaruedas_auto', [(Vector((s * (AHW + 0.05 - 0.22), ey, RUEDA_R)), ARCO, 0.5)
                                                for ey in (EJE_D, EJE_T) for s in (1, -1)], segs=64)
    cut.data.materials.append(material('Pasarueda'))
    acabado(ob, bisel=0.0, segs=1, angulo=35, cortes=[cut])
    ob.modifiers['Corte'].material_mode = 'TRANSFER'
    ob.modifiers['Corte'].use_self = True
    # bordes marcados (marcos, juntas y tapas) para que el suavizado no los ablande
    A.add(ob)
    return ob


def sup(y, s, lado=1, sobre=0.0):
    # punto de la chapa y su normal hacia afuera (aprox.), separado 'sobre'
    p = punto_seccion(y, s, lado)
    nrm = normal_seccion(y, s, lado)
    return p + nrm * sobre, nrm


def orientar(ob, p, n, arriba=Vector((0, 0, 1))):
    # pone el objeto (modelado mirando a +Y) en p, con su +Y hacia la normal n
    y = n.normalized()
    x = arriba.cross(y)
    if x.length < 1e-6:
        x = Vector((1, 0, 0))
    x.normalize()
    z = y.cross(x)
    M = Matrix((x, y, z)).transposed().to_4x4()
    ob.matrix_world = Matrix.Translation(p) @ M


# ---------------------------------------------------------------------------
# Ruedas: neumático con dibujo, llanta de seis rayos, taza con emblema y cubre pastillas
def rueda(A, nombre, s):
    g = nombre
    x = 0.0
    perfil = [(x - RUEDA_A / 2 - 0.005, 0.25)]
    for i in range(15):
        a = math.pi * i / 14
        perfil.append((x - RUEDA_A / 2 * math.cos(a), RUEDA_R - 0.07 * (1 - math.sin(a)) ** 1.6))
    perfil.append((x + RUEDA_A / 2 + 0.005, 0.25))
    torno(A, g + '_neum', perfil, 'Neumatico', eje='x', centro=(0, 0), segs=56, bisel=0.0, cerrado=True, grupo=g)
    # tacos del dibujo: dos filas en V
    bm = bmesh.new()
    for k in range(44):
        a = 2 * math.pi * k / 44
        for lado in (-1, 1):
            c = Vector((lado * 0.062, math.cos(a) * (RUEDA_R - 0.006), math.sin(a) * (RUEDA_R - 0.006)))
            m = (Matrix.Translation(c) @ Matrix.Rotation(a, 4, 'X') @ Matrix.Rotation(lado * 0.45, 4, 'Z') @
                 Matrix.Diagonal((0.08, 0.026, 0.016, 1)))
            bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    ob = malla(A, g + '_tacos', bm, 'Neumatico', liso=False, grupo=g)
    # letras en el flanco
    xo = s * (RUEDA_A / 2 + 0.003)
    texto(A, g + '_marca', 'SALTO FINAL   ·   SALTO FINAL   ·', 'Goma', 0.032,
          lambda u, v, w: _flanco(u, v, w, xo, s), grosor=0.004, resolucion=2)
    A.piezas[-1] = (A.piezas[-1][0], g)
    # llanta: aro, rayos y taza (hacia afuera = s)

    def P(lst):
        return [(s * (RUEDA_A / 2 + o), r) for o, r in lst]
    torno(A, g + '_aro', P([(-0.2, 0.262), (-0.02, 0.262), (0.004, 0.27), (0.012, 0.262), (0.004, 0.246),
                            (-0.03, 0.236), (-0.2, 0.236)]), 'Llanta', eje='x', centro=(0, 0), segs=56,
          bisel=0.0, cerrado=True, grupo=g)
    torno(A, g + '_fondo', P([(-0.16, 0.0), (-0.16, 0.24), (-0.12, 0.24), (-0.12, 0.0)]), 'LlantaOscura',
          eje='x', centro=(0, 0), segs=40, bisel=0.0, grupo=g)
    for k in range(6):
        a = 2 * math.pi * k / 6 + 0.25
        pts = [(-0.012, 0.07, 0.01), (0.012, 0.07, 0.01), (0.022, 0.245, 0.006), (-0.022, 0.245, 0.006)]
        a0, a1 = (-0.035, 0.0) if s > 0 else (0.0, 0.035)
        ob = prisma(A, g + '_rayo%d' % k, pts, a0, a1, 'Llanta', eje='x', n=3, bisel=0.003, grupo=g)
        ob.matrix_world = Matrix.Translation(Vector((s * (RUEDA_A / 2 - 0.012), 0, 0))) @ Matrix.Rotation(a, 4, 'X')
    torno(A, g + '_taza', P([(-0.06, 0.0), (-0.06, 0.085), (-0.02, 0.085), (0.0, 0.07), (0.008, 0.04),
                             (0.01, 0.0)]), 'Llanta', eje='x', centro=(0, 0), segs=36, bisel=0.0, grupo=g)
    torno(A, g + '_emblema', P([(0.006, 0.0), (0.006, 0.036), (0.013, 0.034), (0.014, 0.0)]), 'Emblema', eje='x',
          centro=(0, 0), segs=28, bisel=0.0, grupo=g)
    for k in range(5):
        a = 2 * math.pi * k / 5
        cy, cz = math.cos(a) * 0.055, math.sin(a) * 0.055
        torno(A, g + '_tuerca%d' % k, P([(-0.03, 0.0), (-0.03, 0.011), (0.003, 0.011), (0.006, 0.0)]),
              'Cromo', eje='x', centro=(cy, cz), segs=6, bisel=0.0, grupo=g)
    # disco y caliper (no giran con la rueda en la vida real, pero acá es todo una pieza)
    torno(A, g + '_disco', P([(-0.2, 0.06), (-0.2, 0.2), (-0.18, 0.2), (-0.18, 0.06)]), 'FaroFondo', eje='x',
          centro=(0, 0), segs=36, bisel=0.0, cerrado=True, grupo=g)


def _flanco(u, v, w, xo, s):
    # texto curvado sobre el flanco del neumático (u = arco, v = radial)
    r = 0.33 + v
    a = math.pi / 2 - u / 0.33 * s
    return Vector((xo + s * w, math.cos(a) * r, math.sin(a) * r))


# ---------------------------------------------------------------------------
# Trompa: parrilla, toma de aire, emblema, patente y antiniebla
def trompa(A):
    q = seccion(AY1)
    yf = AY1
    zc = (q['zbot'] + q['ztop']) / 2
    # parrilla: marco y panal sobre la tapa
    pts = [(-0.52, zc - 0.02, 0.05), (0.52, zc - 0.02, 0.05), (0.42, zc + 0.16, 0.06), (-0.42, zc + 0.16, 0.06)]
    prisma(A, 'parrillaMarco', [(p[0], p[1], p[2]) for p in pts], yf - 0.02, yf + 0.03, 'Plastico', eje='y', n=4,
           bisel=0.006)
    bm = bmesh.new()
    for i in range(9):
        for j in range(3):
            c = Vector((-0.4 + i * 0.1 + (0.05 if j % 2 else 0), yf + 0.032, zc + 0.02 + j * 0.05))
            if abs(c.x) > 0.44 - (c.z - zc) * 0.4:
                continue
            bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.028, radius2=0.028, depth=0.012,
                                  matrix=Matrix.Translation(c) @ Matrix.Rotation(math.pi / 2, 4, 'X'))
    malla(A, 'panal', bm, 'Rejilla', liso=False)
    # toma de aire de abajo, en el paragolpes
    caja(A, 'tomaAire', (0, yf - 0.02, q['zbot'] + 0.06), (0.9, 0.08, 0.1), 'Rejilla', r=0.04, eje='y', bisel=0.004)
    # emblema
    torno(A, 'emblemaFrente', [(yf + 0.02, 0.0), (yf + 0.02, 0.07), (yf + 0.045, 0.065), (yf + 0.05, 0.0)],
          'Emblema', eje='y', centro=(0, zc + 0.07), segs=28, bisel=0.0)
    texto(A, 'emblemaFrenteSF', 'SF', 'Cromo', 0.075, lambda u, v, w: Vector((-u, yf + 0.048 + w, zc + 0.07 + v)),
          grosor=0.008, offset=0.003)
    # patente
    pz = q['zbot'] + 0.2
    caja(A, 'patenteD', (0, yf + 0.06, pz), (0.5, 0.02, 0.13), 'Patente', r=0.02, eje='y', bisel=0.003)
    texto(A, 'patenteDTxt', 'SF 24', 'Junta', 0.085, lambda u, v, w: Vector((-u, yf + 0.07 + w, pz + v)),
          grosor=0.006, resolucion=2)
    # antiniebla redondos en los costados del paragolpes
    for s in (1, -1):
        p, n = sup(2.17, 2.12, s)
        ob = torno(A, 'antiniebla_%d' % s, [(-0.03, 0.0), (-0.03, 0.055), (0.0, 0.055), (0.012, 0.045), (0.016, 0.0)],
                   'Faro', eje='y', centro=(0, 0), segs=24, bisel=0.0)
        orientar(ob, p + n * 0.004, n)


def cola_auto(A):
    q = seccion(AY0)
    yt = AY0
    zc = (q['zbot'] + q['ztop']) / 2
    # portón: emblema, letras y patente
    caja(A, 'patenteT', (0, yt - 0.04, zc + 0.02), (0.5, 0.02, 0.13), 'Patente', r=0.02, eje='y', bisel=0.003)
    texto(A, 'patenteTTxt', 'SF 24', 'Junta', 0.085, lambda u, v, w: Vector((u, yt - 0.05 - w, zc + 0.02 + v)),
          grosor=0.006, resolucion=2)
    caja(A, 'marcoPatente', (0, yt - 0.03, zc + 0.02), (0.56, 0.02, 0.19), 'Plastico', r=0.03, eje='y', bisel=0.003)
    y_l = AY0 + 0.06
    p, n = sup(-2.12, 2.95, 1)
    texto(A, 'letrasCola', 'SALTO', 'Cromo', 0.07,
          lambda u, v, w: Vector((u + 0.5, yt - 0.005 - w, q['ztop'] - 0.03 + v)), grosor=0.006, offset=0.002,
          espaciado=1.15)
    # difusor y escape doble
    caja(A, 'difusor', (0, yt + 0.05, q['zbot'] - 0.02), (1.3, 0.16, 0.08), 'Plastico', r=0.03, eje='y', bisel=0.004)
    for x in (-0.55, -0.42):
        torno(A, 'escape_%g' % x, [(yt + 0.2, 0.038), (yt - 0.03, 0.038), (yt - 0.03, 0.03), (yt + 0.2, 0.03)],
              'Cromo', eje='y', centro=(x, q['zbot'] + 0.03), segs=16, bisel=0.0, cerrado=True)
    # alerón sobre el portón
    pt = punto_seccion(PT0 + 0.02, 7.0)
    w = seccion(PT0)['wr'] - 0.08
    perfil = [(PT0 + 0.12, pt.z - 0.02, 0.0), (PT0 - 0.24, pt.z - 0.03, 0.02), (PT0 - 0.3, pt.z + 0.035, 0.02),
              (PT0 + 0.08, pt.z + 0.03, 0.03)]
    prisma(A, 'aleron', perfil, -w, w, 'TechoNegro', eje='x', n=4, bisel=0.006)
    # luz de freno alta
    caja(A, 'freno3', (0, PT0 - 0.27, pt.z + 0.0), (0.42, 0.025, 0.025), 'LuzTrasera', r=0.01, eje='y', bisel=0.0)
    # limpia luneta
    a = punto_seccion(PT1 + 0.05, 7.0) + Vector((0, -0.01, 0.015))
    b = punto_seccion(-1.6, 6.4) + Vector((0, 0, 0.02))
    tubo(A, 'limpiaT', [a, b], 0.009, 'Plastico', segs=6)


def costados_auto(A):
    for s in (1, -1):
        # manija de la puerta
        p, n = sup(-0.32, 2.88, s, 0.0)
        ob = caja(A, 'manija_%d' % s, (0, 0, 0), (0.2, 0.03, 0.035), 'Plastico', r=0.012, eje='y', bisel=0.003)
        orientar(ob, p + n * 0.012, n)
        # espejo: base en la puerta, brazo y carcasa pintada con vidrio
        p, n = sup(0.98, 3.6, s, 0.0)
        tubo(A, 'espejoBrazo_%d' % s, [p, p + Vector((s * 0.1, -0.02, 0.05))], 0.022, 'Plastico', segs=8)
        c = p + Vector((s * 0.17, -0.05, 0.1))
        perfil = [(-0.075, -0.05, 0.035), (0.04, -0.055, 0.03), (0.075, 0.0, 0.04), (0.05, 0.06, 0.03),
                  (-0.07, 0.06, 0.04)]
        ob = prisma(A, 'espejo_%d' % s, perfil, -0.1, 0.1, 'Pintura', eje='x', n=5, bisel=0.008,
                    ahusar=(0.8, 0.85) if s > 0 else None)
        ob.matrix_world = Matrix.Translation(c) @ Matrix.Rotation(-0.12 * s, 4, 'Z')
        ob = caja(A, 'espejoVidrio_%d' % s, (0, 0, 0), (0.17, 0.012, 0.1), 'Cromo', r=0.03, eje='y', bisel=0.0)
        ob.matrix_world = Matrix.Translation(c + Vector((s * 0.005, -0.075, 0.003))) @ Matrix.Rotation(-0.12 * s, 4, 'Z')
        # repetidor de giro en el guardabarros
        p, n = sup(1.95 - 0.12, 2.75, s)
        ob = caja(A, 'repetidor_%d' % s, (0, 0, 0), (0.09, 0.02, 0.03), 'Giro', r=0.01, eje='y', bisel=0.0)
        orientar(ob, p + n * 0.006, n, arriba=Vector((0, 0, 1)))
        # ribetes negros en los pasaruedas
        for ey in (EJE_D, EJE_T):
            pts = []
            for i in range(31):
                a = math.radians(8 + 164 * i / 30)
                y, z = ey + math.cos(a) * (ARCO + 0.03), RUEDA_R + math.sin(a) * (ARCO + 0.03)
                q = seccion(y)
                x = q['hw'] + 0.022 * math.sin(math.pi * max(0, min(1, (z - q['zbot'] - q['rb']) / max(0.01, q['zbelt'] - q['rs'] - q['zbot'] - q['rb'])))) - 0.004
                pts.append(Vector((s * x, y, z)))
            tubo(A, 'ribete_%g_%d' % (ey, s), pts, 0.035, 'Plastico', segs=8, achatar=0.6)
    # tapa de nafta (lado derecho, atrás)
    p, n = sup(-1.62, 3.3, 1)
    ob = torno(A, 'tapaNafta', [(-0.01, 0.0), (-0.01, 0.08), (0.004, 0.078), (0.006, 0.0)], 'Pintura', eje='y',
               centro=(0, 0), segs=24, bisel=0.0)
    orientar(ob, p, n)
    # limpiaparabrisas
    for x in (-0.45, 0.2):
        a = punto_seccion(PB0 - 0.05, 6.0 + (0.7 - abs(x)) / 0.7 * 0.9, 1 if x > 0 else -1) + Vector((0, 0, 0.02))
        a.x = x
        b = a + Vector((0.52, -0.07, 0.06))
        tubo(A, 'limpia_%g' % x, [a, b], 0.009, 'Plastico', segs=6)
    # antena atrás en el techo
    p = punto_seccion(-1.15, 7.0)
    tubo(A, 'antena', [p + Vector((0, 0, 0.0)), p + Vector((0, -0.18, 0.08)), p + Vector((0, -0.25, 0.1))], 0.018,
         'TechoNegro', segs=8, paso=0.04)


def faros_auto(A):
    # dentro del hueco del faro: reflector cromado y lente redonda (el vidrio es la cara 'Faro' de la carrocería)
    for s in (1, -1):
        for k, (y, sv) in enumerate(((2.2, 2.62), (2.12, 2.72))):
            p, n = sup(y, sv, s, -0.022)
            ob = torno(A, 'lente_%d_%d' % (s, k), [(-0.02, 0.0), (-0.02, 0.05), (0.0, 0.05), (0.01, 0.03),
                                                     (0.012, 0.0)], 'Faro', eje='y', centro=(0, 0), segs=20,
                       bisel=0.0)
            orientar(ob, p, n)


def interior(A):
    # piso, tablero, consola, asientos y volante (se ven por los vidrios)
    caja(A, 'piso', (0, -0.3, 0.42), (1.86, 3.3, 0.04), 'Piso', r=0.0, bisel=0.0)
    # tablero bajo el parabrisas
    perfil = [(0.62, 0.82, 0.04), (1.22, 0.9, 0.05), (1.22, 1.12, 0.04), (0.98, 1.16, 0.05), (0.72, 1.12, 0.06),
              (0.6, 0.98, 0.04)]
    prisma(A, 'tablero', perfil, -0.88, 0.88, 'Tablero', eje='x', n=4, bisel=0.01)
    caja(A, 'consola', (0, 0.35, 0.58), (0.26, 0.8, 0.3), 'Tablero', r=0.05, bisel=0.008)
    caja(A, 'palanca', (0, 0.25, 0.8), (0.05, 0.05, 0.18), 'Cromo', r=0.02, eje='z', bisel=0.0)
    # asientos: delanteros (dos butacas) y trasero (banco), con costura naranja
    for x, y, ancho in ((-0.42, -0.08, 0.52), (0.42, -0.08, 0.52), (-0.42, -1.0, 0.56), (0.42, -1.0, 0.56)):
        caja(A, 'almohadon_%g_%g' % (x, y), (x, y + 0.02, 0.56), (ancho, 0.52, 0.14), 'Tapizado', r=0.05, eje='x',
             bisel=0.01)
        perfil = [(y - 0.3, 0.6, 0.04), (y - 0.16, 0.6, 0.04), (y - 0.26, 1.28, 0.08), (y - 0.4, 1.28, 0.06)]
        prisma(A, 'respaldo_%g_%g' % (x, y), perfil, x - ancho / 2, x + ancho / 2, 'Tapizado', eje='x', n=4,
               bisel=0.01)
        caja(A, 'cabecera_%g_%g' % (x, y), (x, y - 0.34, 1.4), (0.26, 0.1, 0.17), 'Tapizado', r=0.04, eje='x',
             bisel=0.006)
        caja(A, 'costura_%g_%g' % (x, y), (x, y + 0.02, 0.632), (0.08, 0.5, 0.004), 'Costura', bisel=0.0)
    # volante: pieza aparte, pivote en el centro, eje hacia el conductor
    g = 'Volante'
    c = Vector(VOLANTE_C)
    tubo(A, 'volanteAro', [Vector((0.19 * math.cos(2 * math.pi * k / 32), 0, 0.19 * math.sin(2 * math.pi * k / 32)))
                          for k in range(33)], 0.022, 'Tablero', segs=10, grupo=g)
    torno(A, 'volanteCentro', [(-0.03, 0.0), (-0.03, 0.07), (0.01, 0.065), (0.025, 0.0)], 'Tablero', eje='y',
          centro=(0, 0), segs=20, bisel=0.0, grupo=g)
    torno(A, 'volanteEmblema', [(0.02, 0.0), (0.02, 0.03), (0.03, 0.0)], 'Emblema', eje='y', centro=(0, 0), segs=16,
          bisel=0.0, grupo=g)
    for a in (0, 180, 270):
        r = math.radians(a)
        tubo(A, 'volanteRayo%d' % a, [Vector((0.05 * math.cos(r), 0, 0.05 * math.sin(r))),
                                      Vector((0.18 * math.cos(r), 0, 0.18 * math.sin(r)))], 0.016, 'Tablero',
             segs=8, grupo=g)
    # columna de dirección (fija)
    d = Vector((0, 1, 0))
    d.rotate(Matrix.Rotation(VOLANTE_INCL, 3, 'X'))
    tubo(A, 'columna', [c + d * 0.03, c + d * 0.32], 0.035, 'Tablero', segs=10)


VOLANTE_C = (-0.42, 0.52, 1.02)     # centro del volante (conductor a la izquierda)
VOLANTE_INCL = math.radians(-24)    # inclinación: arriba hacia el tablero


def armar_auto():
    A = Arma('auto')
    carroceria_auto(A)
    for nombre, ey, s in (('Rueda_DI', EJE_D, -1), ('Rueda_DD', EJE_D, 1), ('Rueda_TI', EJE_T, -1),
                          ('Rueda_TD', EJE_T, 1)):
        rueda(A, nombre, s)
    trompa(A)
    cola_auto(A)
    costados_auto(A)
    faros_auto(A)
    interior(A)
    return A


def exportar_auto(A, ruta):
    # las ruedas y el volante se modelaron en el origen: se llevan a su lugar antes de unir
    piv = {'Rueda_DI': (-TROCHA, EJE_D, RUEDA_R), 'Rueda_DD': (TROCHA, EJE_D, RUEDA_R),
           'Rueda_TI': (-TROCHA, EJE_T, RUEDA_R), 'Rueda_TD': (TROCHA, EJE_T, RUEDA_R), 'Volante': VOLANTE_C}
    giro_volante = Matrix.Rotation(VOLANTE_INCL, 4, 'X')
    for ob, g in A.piezas:
        if g in piv:
            pre = giro_volante if g == 'Volante' else Matrix.Identity(4)
            ob.matrix_world = Matrix.Translation(piv[g]) @ pre @ ob.matrix_world
    info = finalizar(A, pivotes=piv)
    col = bpy.data.collections['exp_auto']
    raiz = bpy.data.objects['auto']
    for ob in col.objects:
        if ob.type == 'MESH':
            if ob.name == 'auto_cuerpo':
                ob.name = 'Carroceria'
            elif ob.name.startswith('auto_'):
                ob.name = ob.name[5:]
    # el volante queda con su inclinación en el nodo (así gira sobre su eje propio)
    vol = bpy.data.objects.get('Volante')
    if vol:
        vol.data.transform(giro_volante.inverted())
        vol.matrix_world = Matrix.Translation(Vector(VOLANTE_C)) @ giro_volante
    raiz.name = 'Auto'
    col.hide_render = False
    if ruta:
        for o in bpy.data.objects:
            try:
                o.select_set(False)
            except RuntimeError:
                pass
        for o in col.objects:
            o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=ruta, export_format='GLB', use_selection=True, use_active_scene=True,
                                  export_yup=True, export_apply=False, export_extras=False, export_animations=False,
                                  export_tangents=False, export_texcoords=False)
    return info


# ---------------------------------------------------------------------------
# Fotos de revisión: cielo con sol, Cycles y vistas fijas
VISTAS_AUTO = {
    'tres4': ((5.2, 6.4, 2.2), (0, 0.2, 0.75), 45),
    'atras': ((-4.6, -6.6, 2.4), (0, -0.3, 0.8), 45),
    'lado': ((9.5, 0.2, 1.0), (0, 0, 0.85), 50),
    'arriba': ((3.0, -4.0, 7.5), (0, 0, 0.6), 40),
    'frente': ((0.6, 8.5, 1.0), (0, 0, 0.75), 55),
    'rueda': ((2.8, 3.4, 0.6), (0.85, 1.42, 0.4), 45),
    'cabina': ((-2.2, 1.6, 2.6), (-0.2, 0.0, 1.0), 35),
    'juego': ((0.0, -8.0, 3.3), (0, 0.5, 1.2), 50),       # como lo ve el jugador manejando
}


def fotos_auto(carpeta, vistas, res=(1280, 760)):
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
    # piso gris para que se vea la sombra
    piso = bpy.data.objects.get('_Piso')
    if not piso:
        me = bpy.data.meshes.new('_Piso')
        bm = bmesh.new()
        bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=30)
        bm.to_mesh(me)
        bm.free()
        piso = bpy.data.objects.new('_Piso', me)
        sc.collection.objects.link(piso)
        PALETA['_Asfalto'] = dict(c=(0.06, 0.062, 0.068), m=0.0, r=0.9)
        me.materials.append(material('_Asfalto'))
    for c in sc.collection.children:
        c.hide_render = c.name != 'exp_auto'
    cam = bpy.data.objects.get('_CamAuto')
    if not cam:
        cam = bpy.data.objects.new('_CamAuto', bpy.data.cameras.new('_CamAuto'))
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
        pos, mira, lente = VISTAS_AUTO[v]
        cam.location = pos
        d = Vector(mira) - Vector(pos)
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        cam.data.lens = lente
        r.filepath = os.path.join(carpeta, 'auto_%s.jpg' % v)
        bpy.ops.render.render(write_still=True)
