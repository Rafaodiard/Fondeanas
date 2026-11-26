# Cofre y objetos del piso de Salto Final (diseños propios). Requiere armas_base.py y armas_horneado.py antes.
# Medidas en metros, arriba +Z, frente +Y (en glTF queda arriba +Y y frente -Z, como espera el juego).
#
# cofre(): cofre de tablas con herrajes dorados. La tapa es la pieza móvil 'tapa' con el pivote en la bisagra de
#   atrás; abre girando sobre X. Adentro tiene un fondo que brilla ('BrilloCofre', no se hornea).
# objetos(): todo lo que se agarra del piso salvo las armas, cada cosa como pieza propia con el pivote en su centro
#   (así el juego la pone flotando sobre el piso): vendas, botiquín, frasco y bidón de escudo, una caja por tipo de
#   munición, cohete y las tres pilas de materiales.
# Materiales que no se hornean: 'Tinte' (franja que el juego pinta con el color del objeto), 'Vidrio', 'Escudo'
# (líquido que brilla) y 'BrilloCofre'.
import bpy, bmesh, math, random
from mathutils import Vector, Matrix

PALETA.update({
    'MaderaCofre': dict(c=(0.150, 0.062, 0.022), m=0.0, r=0.62),
    'MaderaCofreClara': dict(c=(0.215, 0.098, 0.036), m=0.0, r=0.6),
    'MaderaCofreOsc': dict(c=(0.075, 0.032, 0.013), m=0.0, r=0.7),
    'OroCofre': dict(c=(0.98, 0.60, 0.16), m=1.0, r=0.24),
    'Hierro': dict(c=(0.045, 0.046, 0.050), m=0.85, r=0.42),
    'BrilloCofre': dict(c=(1.0, 0.70, 0.25), m=0.0, r=0.5, e=6.0),
    'Tinte': dict(c=(0.8, 0.8, 0.8), m=0.0, r=0.4, e=0.6),
    'Vidrio': dict(c=(0.70, 0.85, 0.95), m=0.0, r=0.05),
    'Escudo': dict(c=(0.10, 0.45, 1.0), m=0.0, r=0.15, e=2.2),
    'PlasticoBlanco': dict(c=(0.80, 0.80, 0.78), m=0.0, r=0.38),
    'Rojo': dict(c=(0.65, 0.025, 0.02), m=0.0, r=0.42),
    'Venda': dict(c=(0.56, 0.43, 0.29), m=0.0, r=0.92),
    'Corcho': dict(c=(0.36, 0.20, 0.10), m=0.0, r=0.85),
    'Pino': dict(c=(0.48, 0.27, 0.11), m=0.0, r=0.66),
    'PinoOsc': dict(c=(0.33, 0.17, 0.065), m=0.0, r=0.68),
    'Piedra': dict(c=(0.30, 0.30, 0.31), m=0.0, r=0.85),
    'PiedraClara': dict(c=(0.42, 0.41, 0.40), m=0.0, r=0.82),
    'Lingote': dict(c=(0.30, 0.34, 0.40), m=1.0, r=0.36),
    'Cuerda': dict(c=(0.42, 0.33, 0.18), m=0.0, r=0.95),
    'CajaVerde': dict(c=(0.075, 0.095, 0.045), m=0.0, r=0.55),
    'CajaGris': dict(c=(0.07, 0.075, 0.08), m=0.3, r=0.45),
    'CajaArena': dict(c=(0.28, 0.20, 0.10), m=0.0, r=0.6),
})
DESGASTE.update({
    'MaderaCofre': ((0.34, 0.18, 0.08), 0.55, 0.3), 'MaderaCofreClara': ((0.42, 0.24, 0.11), 0.5, 0.3),
    'MaderaCofreOsc': ((0.22, 0.11, 0.05), 0.5, 0.3), 'OroCofre': ((1.0, 0.86, 0.52), 0.55, 0.55),
    'Hierro': ((0.30, 0.30, 0.31), 0.75, 0.6), 'PlasticoBlanco': ((0.95, 0.95, 0.93), 0.3, 0.2),
    'Venda': ((0.75, 0.62, 0.45), 0.4, 0.1),
    'Rojo': ((0.85, 0.20, 0.15), 0.4, 0.3), 'Pino': ((0.72, 0.50, 0.28), 0.4, 0.3),
    'PinoOsc': ((0.55, 0.35, 0.18), 0.4, 0.3), 'Piedra': ((0.55, 0.54, 0.52), 0.6, 0.2),
    'PiedraClara': ((0.62, 0.61, 0.58), 0.5, 0.2), 'Lingote': ((0.80, 0.82, 0.85), 0.6, 0.5),
    'CajaVerde': ((0.30, 0.32, 0.20), 0.65, 0.4), 'CajaGris': ((0.36, 0.37, 0.38), 0.7, 0.5),
    'CajaArena': ((0.55, 0.45, 0.30), 0.6, 0.4), 'Corcho': ((0.5, 0.32, 0.18), 0.3, 0.1),
})
# tablas a lo largo de X: los anillos alrededor de X dejan la veta corriendo por la tabla
VETA.update({'MaderaCofre': ('X', 16.0), 'MaderaCofreClara': ('X', 16.0), 'MaderaCofreOsc': ('X', 18.0),
             'Pino': ('X', 22.0), 'PinoOsc': ('X', 22.0)})
NO_HORNEAR = ('Rareza', 'Lente', 'Tinte', 'Vidrio', 'Escudo', 'BrilloCofre')

# El horneado de las armas está calibrado para piezas de centímetros; el cofre mide un metro: oclusión y bisel
# del horneado más grandes.
_HORNEO_ESCALA = {'ao': 0.03, 'bev': 0.0025}
_mat_horneo_armas = _mat_horneo


def _mat_horneo(m, img, paso):
    h = _mat_horneo_armas(m, img, paso)
    for n in h.node_tree.nodes:
        if n.type == 'AMBIENT_OCCLUSION':
            n.inputs['Distance'].default_value = _HORNEO_ESCALA['ao']
        elif n.type == 'BEVEL':
            n.inputs['Radius'].default_value = _HORNEO_ESCALA['bev']
    return h


# ---------------------------------------------------------------------------
# Piezas propias
def _malla(A, nombre, bm, mat, grupo, bisel, angulo=32, segs=2):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = _obj(nombre, bm, mat, A.col)
    acabado(ob, bisel, segs, angulo)
    A.add(ob, grupo)
    return ob


def arco_x(A, nombre, aE, bE, aI, bI, t0, t1, x0, x1, zc, mat, n=12, bisel=0.003, grupo='cuerpo', yc=0.0):
    # sector de anillo elíptico en el plano (y, z), extruido de x0 a x1: tablas y flejes curvos de la tapa.
    # aE/bE semiejes de afuera, aI/bI de adentro; t de 0 (frente, +Y) a pi (atrás).
    bm = bmesh.new()
    ts = [t0 + (t1 - t0) * k / n for k in range(n + 1)]

    def anillo(x, a, b):
        return [bm.verts.new((x, yc + a * math.cos(t), zc + b * math.sin(t))) for t in ts]
    E0, I0, E1, I1 = anillo(x0, aE, bE), anillo(x0, aI, bI), anillo(x1, aE, bE), anillo(x1, aI, bI)
    for k in range(n):
        bm.faces.new((E0[k], E0[k + 1], E1[k + 1], E1[k]))
        bm.faces.new((I0[k + 1], I0[k], I1[k], I1[k + 1]))
        bm.faces.new((E0[k + 1], E0[k], I0[k], I0[k + 1]))
        bm.faces.new((E1[k], E1[k + 1], I1[k + 1], I1[k]))
    bm.faces.new((E0[0], E1[0], I1[0], I0[0]))
    bm.faces.new((E0[-1], I0[-1], I1[-1], E1[-1]))
    return _malla(A, nombre, bm, mat, grupo, bisel)


def media_elipse_x(A, nombre, a, b, x0, x1, zc, mat, n=16, bisel=0.004, grupo='cuerpo'):
    # tapa lateral: media elipse llena en (y, z) extruida en X, hecha con quads (un abanico desde el centro de abajo)
    bm = bmesh.new()
    ts = [math.pi * k / n for k in range(n + 1)]
    lados = []
    for x in (x0, x1):
        c = bm.verts.new((x, 0, zc))
        borde = [bm.verts.new((x, a * math.cos(t), zc + b * math.sin(t))) for t in ts]
        lados.append((c, borde))
    (c0, B0), (c1, B1) = lados
    for k in range(n):
        bm.faces.new((c0, B0[k + 1], B0[k]))
        bm.faces.new((c1, B1[k], B1[k + 1]))
        bm.faces.new((B0[k], B0[k + 1], B1[k + 1], B1[k]))
    bm.faces.new((c0, B0[0], B1[0], c1))
    bm.faces.new((c0, c1, B1[-1], B0[-1]))
    return _malla(A, nombre, bm, mat, grupo, bisel)


def remache(A, nombre, c, normal, r=0.011, alto=0.5, mat='OroCofre', grupo='cuerpo'):
    # cabeza de remache: media esfera achatada apoyada en la superficie (normal hacia afuera)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=r)
    for v in bm.verts:
        if v.co.z < 0:
            v.co.z = 0.0
        v.co.z *= alto
    q = Vector((0, 0, 1)).rotation_difference(Vector(normal).normalized())
    bmesh.ops.transform(bm, matrix=Matrix.Translation(c) @ q.to_matrix().to_4x4(), verts=bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    return _malla(A, nombre, bm, mat, grupo, 0.0)


def bloque(A, nombre, c, t, mat, jitter=0.0, semilla=0, bisel=0.012, grupo='cuerpo', subdiv=3):
    # bloque de piedra: caja subdividida con los vértices movidos al azar (canto irregular) y bisel ancho
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=subdiv, use_grid_fill=True)
    rnd = random.Random(semilla)
    for v in bm.verts:
        p = v.co
        p.x, p.y, p.z = p.x * t[0], p.y * t[1], p.z * t[2]
        p += Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))) * jitter
        p += Vector(c)
    return _malla(A, nombre, bm, mat, grupo, bisel, angulo=25)


def bala(A, nombre, c, eje, r, largo, casquillo='Laton', punta='Cobre', grupo='cuerpo'):
    # cartucho de arma acostado: vaina de latón con cuello y ojiva redondeada (eje 'x' o 'y')
    h0 = c[{'x': 0, 'y': 1}[eje]] - largo / 2
    cen = (c[1], c[2]) if eje == 'x' else (c[0], c[2])
    L = largo
    vaina = [(h0, 0.0), (h0, r * 0.92), (h0 + 0.03 * L, r * 0.92), (h0 + 0.035 * L, r * 0.78), (h0 + 0.07 * L, r),
             (h0 + 0.56 * L, r), (h0 + 0.62 * L, r * 0.82), (h0 + 0.66 * L, r * 0.82), (h0 + 0.66 * L, 0.0)]
    torno(A, nombre + '_vaina', vaina, casquillo, eje=eje, centro=cen, segs=14, bisel=0.0, grupo=grupo)
    ojiva = [(h0 + 0.655 * L, 0.0), (h0 + 0.655 * L, r * 0.8), (h0 + 0.76 * L, r * 0.76), (h0 + 0.88 * L, r * 0.55),
             (h0 + 0.96 * L, r * 0.25), (h0 + L, 0.0)]
    torno(A, nombre + '_ojiva', ojiva, punta, eje=eje, centro=cen, segs=14, bisel=0.0, grupo=grupo)


def cartucho_escopeta(A, nombre, c, r=0.017, largo=0.075, grupo='cuerpo'):
    # cartucho de escopeta parado: base de latón y cuerpo de plástico rojo con la boca plegada
    x, y, z = c
    torno(A, nombre + '_base', [(z, 0.0), (z, r * 1.08), (z + 0.004, r * 1.08), (z + 0.006, r), (z + 0.018, r),
                                (z + 0.018, 0.0)], 'Laton', eje='z', centro=(x, y), segs=16, bisel=0.0, grupo=grupo)
    torno(A, nombre + '_tubo', [(z + 0.017, 0.0), (z + 0.017, r * 0.97), (z + largo - 0.006, r * 0.97),
                                (z + largo, r * 0.8), (z + largo, 0.0)], 'Cartucho', eje='z', centro=(x, y), segs=16,
          bisel=0.0, grupo=grupo)


# ---------------------------------------------------------------------------
# Cofre
CW, CD, CH = 1.04, 0.66, 0.50      # ancho (X), fondo (Y) y alto del cajón
TAPA_ALTO = 0.21
PARED = 0.045


def cofre():
    A = Arma('cofre')
    w2, d2 = CW / 2, CD / 2
    # zócalo de hierro y patas
    caja(A, 'zocalo', (0, 0, 0.032), (CW + 0.03, CD + 0.03, 0.064), 'Hierro', r=0.012, eje='z', bisel=0.004)
    for sx in (-1, 1):
        for sy in (-1, 1):
            caja(A, 'pata%d%d' % (sx, sy), (sx * (w2 - 0.02), sy * (d2 - 0.02), 0.012), (0.10, 0.10, 0.024),
                 'OroCofre', r=0.02, eje='z', bisel=0.003)
    # paredes de tablas horizontales (tres por cara, con la junta marcada y un poco de juego entre tablas)
    rnd = random.Random(7)
    z0, z1 = 0.064, CH - 0.03
    alto = (z1 - z0) / 3
    for i in range(3):
        zc = z0 + alto * (i + 0.5)
        mat = 'MaderaCofreClara' if i == 1 else 'MaderaCofre'
        for sy in (-1, 1):
            caja(A, 'tabla_y%d_%d' % (sy, i), (rnd.uniform(-0.003, 0.003), sy * (d2 - PARED / 2 + rnd.uniform(0, 0.003)), zc),
                 (CW - 0.06, PARED, alto - 0.007), mat, r=0.009, eje='x', bisel=0.004)
        for sx in (-1, 1):
            caja(A, 'tabla_x%d_%d' % (sx, i), (sx * (w2 - PARED / 2 + rnd.uniform(0, 0.003)), 0, zc),
                 (PARED, CD - 0.06, alto - 0.007), mat, r=0.009, eje='y', bisel=0.004)
    caja(A, 'fondo', (0, 0, z0 + 0.012), (CW - 0.04, CD - 0.04, 0.024), 'MaderaCofreOsc', r=0.0, eje='z', bisel=0.003)
    # el interior que brilla (una tapa de luz bajo el borde: se ve solo con el cofre abierto)
    caja(A, 'brillo', (0, 0, z0 + 0.06), (CW - 2 * PARED - 0.01, CD - 2 * PARED - 0.01, 0.01), 'BrilloCofre',
         eje='z', bisel=0.0)
    # esquineros dorados
    for sx in (-1, 1):
        for sy in (-1, 1):
            caja(A, 'esquinero%d%d' % (sx, sy), (sx * (w2 - 0.032), sy * (d2 - 0.032), (0.06 + CH) / 2),
                 (0.078, 0.078, CH - 0.05), 'OroCofre', r=0.014, eje='z', bisel=0.003)
            for k, zz in enumerate((0.14, 0.40)):
                remache(A, 'rem_e%d%d_%d_y' % (sx, sy, k), (sx * (w2 - 0.045), sy * (d2 + 0.007), zz), (0, sy, 0))
                remache(A, 'rem_e%d%d_%d_x' % (sx, sy, k), (sx * (w2 + 0.007), sy * (d2 - 0.045), zz), (sx, 0, 0))
    # flejes del frente y de atrás, con remaches
    for bx in (-0.30, 0.30):
        for sy in (-1, 1):
            caja(A, 'fleje%+.1f%d' % (bx, sy), (bx, sy * (d2 + 0.002), (0.06 + CH) / 2 - 0.012), (0.07, 0.014, CH - 0.07),
                 'OroCofre', r=0.004, eje='y', bisel=0.002)
            for k, zz in enumerate((0.12, 0.26, 0.40)):
                remache(A, 'rem_f%+.1f%d_%d' % (bx, sy, k), (bx, sy * (d2 + 0.009), zz), (0, sy, 0), r=0.0115)
    # borde dorado de arriba del cajón
    caja(A, 'borde_f', (0, d2 - 0.012, CH - 0.017), (CW + 0.004, 0.034, 0.034), 'OroCofre', r=0.008, eje='x', bisel=0.003)
    caja(A, 'borde_a', (0, -d2 + 0.012, CH - 0.017), (CW + 0.004, 0.034, 0.034), 'OroCofre', r=0.008, eje='x', bisel=0.003)
    caja(A, 'borde_d', (w2 - 0.012, 0, CH - 0.017), (0.034, CD - 0.02, 0.034), 'OroCofre', r=0.008, eje='y', bisel=0.003)
    caja(A, 'borde_i', (-w2 + 0.012, 0, CH - 0.017), (0.034, CD - 0.02, 0.034), 'OroCofre', r=0.008, eje='y', bisel=0.003)
    # cerradura: escudo dorado con bocallave (el hueco tiene fondo de hierro)
    yp = d2 + 0.004
    caja(A, 'bocallave_fondo', (0, yp + 0.002, 0.39), (0.05, 0.004, 0.08), 'Hierro', eje='y', bisel=0.0)
    # dos cortadores aparte: uno solo con la caja y el cilindro encimados se cruza consigo mismo y el booleano falla
    llave = [cortador(A, 'llave_c', cilindros=[((0, yp + 0.01, 0.398), 0.0145, 0.06, 'y')]),
             cortador(A, 'llave_r', cajas=[((0, yp + 0.01, 0.372), (0.013, 0.06, 0.036), 0.0, 'y')])]
    prisma(A, 'cerradura', [(-0.082, CH - 0.03, 0.012), (0.082, CH - 0.03, 0.012), (0.082, 0.35, 0.03),
                            (0.0, 0.285, 0.004), (-0.082, 0.35, 0.03)], yp, yp + 0.016, 'OroCofre', eje='y', n=4,
           bisel=0.003, cortes=llave)
    for sx in (-1, 1):
        remache(A, 'rem_cerr%d' % sx, (sx * 0.056, yp + 0.016, 0.44), (0, 1, 0), r=0.009)
    # manijas a los costados: chapa y argolla de hierro
    for sx in (-1, 1):
        xx = sx * (w2 + 0.004)
        caja(A, 'chapa_manija%d' % sx, (xx, 0, 0.36), (0.012, 0.19, 0.07), 'Hierro', r=0.012, eje='x', bisel=0.002)
        for sy in (-1, 1):
            remache(A, 'rem_m%d%d' % (sx, sy), (xx + sx * 0.006, sy * 0.075, 0.36), (sx, 0, 0), r=0.009, mat='Hierro')
        pts = [(xx + sx * 0.03, 0.065 * math.cos(a), 0.37 - 0.085 * math.sin(a))
               for a in [math.pi * k / 10 for k in range(11)]]
        tubo(A, 'argolla%d' % sx, pts, 0.011, 'Hierro', segs=10, paso=0.012)
        for sy in (-1, 1):
            torno(A, 'oreja%d%d' % (sx, sy), [(xx, 0.0), (xx, 0.016), (xx + sx * 0.034, 0.016), (xx + sx * 0.034, 0.0)]
                  if sx > 0 else [(xx + sx * 0.034, 0.0), (xx + sx * 0.034, 0.016), (xx, 0.016), (xx, 0.0)],
                  'Hierro', eje='x', centro=(sy * 0.065, 0.37), segs=10, bisel=0.0)
    # bisagras de atrás
    for bx in (-0.30, 0.30):
        torno(A, 'bisagra%+.1f' % bx, [(bx - 0.045, 0.0), (bx - 0.045, 0.017), (bx + 0.045, 0.017), (bx + 0.045, 0.0)],
              'Hierro', eje='x', centro=(-d2 - 0.012, CH), segs=12, bisel=0.0015)
        caja(A, 'bisagra_chapa%+.1f' % bx, (bx, -d2 - 0.003, CH - 0.045), (0.08, 0.008, 0.08), 'Hierro', r=0.004,
             eje='y', bisel=0.0015)

    # --- tapa (pieza móvil): cinco tablas curvas, tapas laterales, flejes y aldaba
    a, b = d2 + 0.006, TAPA_ALTO
    esp = 0.042
    x_in = w2 - 0.04
    n_t = 5
    for k in range(n_t):
        t0 = math.pi * k / n_t + 0.011
        t1 = math.pi * (k + 1) / n_t - 0.011
        mat = 'MaderaCofreClara' if k % 2 else 'MaderaCofre'
        e = rnd.uniform(-0.002, 0.002)
        arco_x(A, 'tapa_tabla%d' % k, a + e, b + e, a - esp, b - esp, t0, t1, -x_in, x_in, CH, mat, n=6, bisel=0.004,
               grupo='tapa')
    for sx in (-1, 1):
        x0, x1 = (x_in - 0.002, w2 - 0.004) if sx > 0 else (-w2 + 0.004, -x_in + 0.002)
        media_elipse_x(A, 'tapa_lado%d' % sx, a - 0.004, b - 0.004, x0, x1, CH, 'MaderaCofreOsc', grupo='tapa')
        # marco dorado del costado de la tapa
        xa, xb = (w2 - 0.03, w2 + 0.006) if sx > 0 else (-w2 - 0.006, -w2 + 0.03)
        arco_x(A, 'tapa_marco%d' % sx, a + 0.012, b + 0.012, a - 0.03, b - 0.03, 0.0, math.pi, xa, xb, CH, 'OroCofre',
               n=20, bisel=0.003, grupo='tapa')
    for bx in (-0.30, 0.30):
        arco_x(A, 'tapa_fleje%+.1f' % bx, a + 0.013, b + 0.013, a - 0.004, b - 0.004, 0.0, math.pi, bx - 0.035, bx + 0.035,
               CH, 'OroCofre', n=20, bisel=0.002, grupo='tapa')
        for k, t in enumerate((0.45, math.pi / 2, math.pi - 0.45)):
            nrm = Vector((0, math.cos(t) / a, math.sin(t) / b)).normalized()
            p = Vector((bx, (a + 0.013) * math.cos(t), CH + (b + 0.013) * math.sin(t)))
            remache(A, 'rem_t%+.1f_%d' % (bx, k), p, nrm, r=0.0115, grupo='tapa')
    # labios dorados de la tapa (adelante y atrás, apoyan sobre el borde del cajón)
    caja(A, 'tapa_labio_f', (0, a - 0.012, CH + 0.016), (2 * x_in, 0.03, 0.032), 'OroCofre', r=0.008, eje='x',
         bisel=0.003, grupo='tapa')
    caja(A, 'tapa_labio_a', (0, -a + 0.012, CH + 0.016), (2 * x_in, 0.03, 0.032), 'OroCofre', r=0.008, eje='x',
         bisel=0.003, grupo='tapa')
    # aldaba: baja de la tapa y tapa el borde del escudo
    prisma(A, 'aldaba', [(-0.034, CH + 0.06, 0.006), (0.034, CH + 0.06, 0.006), (0.034, CH - 0.035, 0.014),
                         (0.0, CH - 0.062, 0.004), (-0.034, CH - 0.035, 0.014)], a + 0.003, a + 0.019, 'OroCofre',
           eje='y', n=4, bisel=0.003, grupo='tapa')
    remache(A, 'rem_aldaba', (0, a + 0.019, CH + 0.03), (0, 1, 0), r=0.01, grupo='tapa')
    # adorno de arriba: rombo dorado en el centro de la tapa
    remache(A, 'tapa_rombo', (0, 0, CH + b + 0.012), (0, 0, 1), r=0.028, alto=0.35, grupo='tapa')
    info = finalizar(A, {'tapa': (0, -a, CH)})
    return A, info


# ---------------------------------------------------------------------------
# Objetos del piso: cada uno en su lugar sobre X para hornearlos juntos sin que se tapen
LUGAR = {'venda': 0, 'botiquin': 1, 'frasco': 2, 'bidon': 3, 'municion_ligera': 4, 'municion_media': 5,
         'municion_pesada': 6, 'municion_cartuchos': 7, 'municion_cohetes': 8, 'material_madera': 9,
         'material_piedra': 10, 'material_metal': 11}


def venda(A, X):
    g = 'venda'
    for sy in (-1, 1):
        y = sy * 0.074
        rollo = [(X - 0.068, 0.0), (X - 0.068, 0.064), (X - 0.064, 0.071), (X + 0.064, 0.071), (X + 0.068, 0.064),
                 (X + 0.068, 0.0)]
        hueco = cortador(A, 'venda_hueco%d' % sy, cilindros=[((X, y, 0), 0.02, 0.2, 'x')])
        torno(A, 'venda_rollo%d' % sy, rollo, 'Venda', eje='x', centro=(y, 0.0), segs=28, bisel=0.003, cortes=[hueco],
              grupo=g)
        torno(A, 'venda_carton%d' % sy, [(X - 0.066, 0.0), (X - 0.066, 0.021), (X + 0.066, 0.021), (X + 0.066, 0.0)],
              'Corcho', eje='x', centro=(y, 0.0), segs=16, bisel=0.0, grupo=g)
        # vueltas de la venda: canaletas finas en el canto
        for k in range(3):
            xx = X - 0.04 + 0.04 * k
            torno(A, 'venda_vuelta%d%d' % (sy, k), [(xx - 0.003, 0.0), (xx - 0.003, 0.0722), (xx + 0.003, 0.0722),
                                                    (xx + 0.003, 0.0)], 'Venda', eje='x', centro=(y, 0.0), segs=28,
                  bisel=0.0, grupo=g)
    # faja roja que junta los dos rollos y un broche de metal
    pts = []
    for k in range(25):
        ang = 2 * math.pi * k / 24
        cy = 0.074 if math.cos(ang) >= 0 else -0.074
        pts.append((X, cy + 0.077 * math.cos(ang), 0.077 * math.sin(ang)))
    tubo(A, 'venda_faja', pts, 0.022, 'Rojo', segs=10, achatar=0.18, grupo=g)
    caja(A, 'venda_broche', (X, 0, 0.081), (0.05, 0.03, 0.008), 'Acero', r=0.004, eje='z', bisel=0.0015, grupo=g)
    # punta suelta de la venda
    prisma(A, 'venda_punta', [(0.074 + 0.03, -0.068), (0.074 + 0.07, -0.085, 0.01), (0.074 + 0.075, -0.095),
                              (0.074 + 0.03, -0.074)], X - 0.06, X + 0.06, 'Venda', eje='x', n=3, bisel=0.001,
           grupo=g)
    return 0.0


def botiquin(A, X):
    g = 'botiquin'
    caja(A, 'botiquin_caja', (X, 0, 0), (0.40, 0.13, 0.29), 'PlasticoBlanco', r=0.035, eje='y', bisel=0.005, grupo=g)
    caja(A, 'botiquin_junta', (X, 0, 0), (0.408, 0.022, 0.298), 'Rojo', r=0.039, eje='y', bisel=0.002, grupo=g)
    for sy in (-1, 1):
        y = sy * 0.066
        caja(A, 'botiquin_cruz_h%d' % sy, (X, y, -0.005), (0.15, 0.012, 0.048), 'Rojo', r=0.008, eje='y', bisel=0.002, grupo=g)
        caja(A, 'botiquin_cruz_v%d' % sy, (X, y * 1.01, -0.005), (0.048, 0.0135, 0.15), 'Rojo', r=0.008, eje='y', bisel=0.002, grupo=g)
        for sx in (-1, 1):
            caja(A, 'botiquin_traba%d%d' % (sx, sy), (X + sx * 0.12, y * 0.5 + sy * 0.003, 0.142), (0.04, 0.03, 0.02),
                 'Acero', r=0.005, eje='y', bisel=0.0015, grupo=g)
    # esquineros de goma
    for sx in (-1, 1):
        for sz in (-1, 1):
            caja(A, 'botiquin_goma%d%d' % (sx, sz), (X + sx * 0.186, 0, sz * 0.132), (0.042, 0.142, 0.042), 'Goma',
                 r=0.015, eje='y', bisel=0.003, grupo=g)
    # manija arriba
    pts = [(X + 0.075 * math.cos(a), 0, 0.15 + 0.05 * math.sin(a)) for a in [math.pi * k / 12 for k in range(13)]]
    tubo(A, 'botiquin_manija', pts, 0.013, 'Goma', segs=12, achatar=1.0, grupo=g)
    for sx in (-1, 1):
        caja(A, 'botiquin_soporte%d' % sx, (X + sx * 0.075, 0, 0.152), (0.035, 0.045, 0.02), 'Grafito', r=0.006, eje='y',
             bisel=0.0015, grupo=g)
    return 0.0


def frasco(A, X):
    g = 'frasco'
    perfil = [(-0.10, 0.0), (-0.098, 0.03), (-0.085, 0.065), (-0.055, 0.092), (-0.02, 0.102), (0.02, 0.1),
              (0.055, 0.086), (0.08, 0.06), (0.092, 0.04), (0.10, 0.034), (0.15, 0.033)]
    torno(A, 'frasco_vidrio', [(-0.10, 0.0)] + perfil[1:] + [(0.15, 0.0)], 'Vidrio', eje='z', centro=(X, 0), segs=32,
          bisel=0.0, grupo=g)
    liq = [(-0.092, 0.0), (-0.09, 0.028), (-0.078, 0.06), (-0.05, 0.085), (-0.02, 0.094), (0.02, 0.092),
           (0.05, 0.079), (0.062, 0.07), (0.062, 0.0)]
    torno(A, 'frasco_liquido', liq, 'Escudo', eje='z', centro=(X, 0), segs=28, bisel=0.0, grupo=g)
    # cuello con anillos de latón y tapón de corcho
    torno(A, 'frasco_collar', [(0.105, 0.0), (0.105, 0.04), (0.112, 0.043), (0.122, 0.043), (0.126, 0.039),
                               (0.132, 0.039), (0.135, 0.043), (0.145, 0.043), (0.15, 0.04), (0.15, 0.0)], 'Laton',
          eje='z', centro=(X, 0), segs=24, bisel=0.0, grupo=g)
    torno(A, 'frasco_tapon', [(0.148, 0.0), (0.148, 0.03), (0.19, 0.034), (0.196, 0.03), (0.2, 0.02), (0.2, 0.0)],
          'Corcho', eje='z', centro=(X, 0), segs=20, bisel=0.0, grupo=g)
    # aro de latón en la panza y base
    torno(A, 'frasco_aro', [(-0.022, 0.0), (-0.022, 0.104), (-0.016, 0.108), (0.016, 0.108), (0.022, 0.104),
                            (0.022, 0.0)], 'Laton', eje='z', centro=(X, 0), segs=32, bisel=0.0, grupo=g)
    torno(A, 'frasco_base', [(-0.108, 0.0), (-0.108, 0.06), (-0.1, 0.066), (-0.094, 0.066), (-0.094, 0.0)], 'Laton',
          eje='z', centro=(X, 0), segs=28, bisel=0.0, grupo=g)
    return 0.045


def bidon(A, X):
    g = 'bidon'
    r = 0.105
    torno(A, 'bidon_vidrio', [(-0.13, 0.0), (-0.13, r), (0.13, r), (0.13, 0.0)], 'Vidrio', eje='z', centro=(X, 0),
          segs=32, bisel=0.0, grupo=g)
    torno(A, 'bidon_liquido', [(-0.128, 0.0), (-0.128, r - 0.01), (0.09, r - 0.01), (0.09, 0.0)], 'Escudo', eje='z',
          centro=(X, 0), segs=28, bisel=0.0, grupo=g)
    for z0, z1, s in ((-0.175, -0.12, -1), (0.12, 0.175, 1)):
        torno(A, 'bidon_tapa%d' % s, [(z0, 0.0), (z0, r + 0.006), (z0 + 0.006, r + 0.016), (z1 - 0.006, r + 0.016),
                                      (z1, r + 0.006), (z1, 0.0)], 'AceroOscuro', eje='z', centro=(X, 0), segs=32,
              bisel=0.0, grupo=g)
        torno(A, 'bidon_aro%d' % s, [(z0 + 0.018, 0.0), (z0 + 0.018, r + 0.02), (z1 - 0.018, r + 0.02),
                                     (z1 - 0.018, 0.0)], 'Laton', eje='z', centro=(X, 0), segs=32, bisel=0.0, grupo=g)
    # tres barras que unen las tapas
    for k in range(3):
        a = 2 * math.pi * k / 3 + math.pi / 6
        caja(A, 'bidon_barra%d' % k, (X + (r + 0.008) * math.cos(a), (r + 0.008) * math.sin(a), 0), (0.024, 0.024, 0.25),
             'AceroOscuro', r=0.008, eje='z', bisel=0.002, grupo=g)
    # pico y manija
    torno(A, 'bidon_pico', [(0.17, 0.0), (0.17, 0.045), (0.2, 0.045), (0.205, 0.04), (0.235, 0.04), (0.24, 0.034),
                            (0.24, 0.0)], 'Grafito', eje='z', centro=(X, 0), segs=24, bisel=0.0, grupo=g)
    pts = [(X + 0.085 * math.cos(a), 0, 0.172 + 0.07 * math.sin(a)) for a in [math.pi * k / 14 for k in range(15)]]
    tubo(A, 'bidon_manija', pts, 0.012, 'Goma', segs=12, grupo=g)
    return 0.03


def _caja_municion(A, g, X, t, mat, tinte=True):
    # caja con tapa y franja de color (Tinte) adelante y atrás; devuelve la altura de la tapa
    w, d, h = t
    caja(A, g + '_caja', (X, 0, -h / 2 + h * 0.36), (w, d, h * 0.72), mat, r=0.012, eje='y', bisel=0.003, grupo=g)
    caja(A, g + '_tapa', (X, 0, -h / 2 + h * 0.72 + h * 0.14), (w + 0.008, d + 0.008, h * 0.28), mat, r=0.012, eje='y',
         bisel=0.003, grupo=g)
    if tinte:
        for sy in (-1, 1):
            caja(A, g + '_franja%d' % sy, (X, sy * (d / 2 + 0.001), -h / 2 + h * 0.36), (w * 0.86, 0.004, h * 0.22),
                 'Tinte', r=0.003, eje='y', bisel=0.0, grupo=g)
    caja(A, g + '_traba', (X, d / 2 + 0.006, -h / 2 + h * 0.72), (0.03, 0.01, 0.04), 'Acero', r=0.004, eje='y',
         bisel=0.0015, grupo=g)
    # manijas a los costados
    for sx in (-1, 1):
        caja(A, g + '_manija%d' % sx, (X + sx * (w / 2 + 0.006), 0, -h / 2 + h * 0.6), (0.012, d * 0.45, 0.018),
             'Grafito', r=0.005, eje='x', bisel=0.0015, grupo=g)
    return h / 2


def municion_ligera(A, X):
    g = 'municion_ligera'
    top = _caja_municion(A, g, X, (0.24, 0.15, 0.13), 'CajaVerde')
    for k in range(4):
        bala(A, '%s_bala%d' % (g, k), (X - 0.045 + 0.03 * k, 0, top + 0.012), 'y', 0.0085, 0.06, grupo=g)
    return 0.0


def municion_media(A, X):
    g = 'municion_media'
    top = _caja_municion(A, g, X, (0.28, 0.16, 0.15), 'CajaGris')
    for k in range(3):
        bala(A, '%s_bala%d' % (g, k), (X, -0.045 + 0.045 * k, top + 0.016), 'x', 0.0115, 0.095, grupo=g)
    return 0.0


def municion_pesada(A, X):
    g = 'municion_pesada'
    top = _caja_municion(A, g, X, (0.34, 0.14, 0.13), 'CajaVerde')
    for k in range(2):
        bala(A, '%s_bala%d' % (g, k), (X, -0.028 + 0.056 * k, top + 0.019), 'x', 0.016, 0.15, grupo=g)
    # correa sobre las balas
    caja(A, g + '_correa', (X, 0, top + 0.02), (0.03, 0.13, 0.042), 'Cinta', r=0.006, eje='x', bisel=0.001, grupo=g)
    return 0.0


def municion_cartuchos(A, X):
    g = 'municion_cartuchos'
    top = _caja_municion(A, g, X, (0.26, 0.16, 0.11), 'CajaArena')
    for k in range(5):
        cartucho_escopeta(A, '%s_c%d' % (g, k), (X - 0.08 + 0.04 * k, 0.0 if k % 2 else 0.018, top - 0.004), grupo=g)
    return 0.0


def municion_cohetes(A, X):
    g = 'municion_cohetes'
    L = 0.46
    x0 = X - L / 2
    torno(A, g + '_cuerpo', [(x0, 0.0), (x0, 0.036), (x0 + 0.03, 0.05), (x0 + 0.3, 0.05), (x0 + 0.3, 0.0)], 'Ojiva',
          eje='x', centro=(0, 0), segs=24, bisel=0.0, grupo=g)
    torno(A, g + '_punta', [(x0 + 0.298, 0.0), (x0 + 0.298, 0.052), (x0 + 0.34, 0.05), (x0 + 0.40, 0.036),
                            (x0 + 0.44, 0.017), (x0 + L, 0.0)], 'Pintura', eje='x', centro=(0, 0), segs=24, bisel=0.0,
          grupo=g)
    torno(A, g + '_banda', [(x0 + 0.2, 0.0), (x0 + 0.2, 0.0515), (x0 + 0.24, 0.0515), (x0 + 0.24, 0.0)], 'Tinte',
          eje='x', centro=(0, 0), segs=24, bisel=0.0, grupo=g)
    torno(A, g + '_tobera', [(x0 - 0.035, 0.0), (x0 - 0.035, 0.03), (x0 - 0.03, 0.034), (x0 + 0.004, 0.03),
                             (x0 + 0.004, 0.0)], 'AceroOscuro', eje='x', centro=(0, 0), segs=20, bisel=0.0, grupo=g)
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        ca, sa = math.cos(a), math.sin(a)
        # aleta: perfil en (radio, x) puesto sobre el ángulo a
        bm = bmesh.new()
        perf = [(0.04, x0 + 0.01), (0.085, x0 - 0.01), (0.085, x0 + 0.05), (0.04, x0 + 0.12)]
        vs = []
        for s in (-0.004, 0.004):
            vs.append([bm.verts.new((xx, rr * ca - s * sa, rr * sa + s * ca)) for rr, xx in perf])
        bm.faces.new(vs[0][::-1])
        bm.faces.new(vs[1])
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((vs[0][i], vs[0][j], vs[1][j], vs[1][i]))
        _malla(A, g + '_aleta%d' % k, bm, 'Grafito', g, 0.0015)
    return 0.0


def _pila(A, g, X, piezas):
    for nombre, c, t, mat, kw in piezas:
        caja(A, '%s_%s' % (g, nombre), (X + c[0], c[1], c[2]), t, mat, grupo=g, **kw)


def material_madera(A, X):
    g = 'material_madera'
    T = (0.44, 0.10, 0.045)
    kw = dict(r=0.008, eje='x', bisel=0.004)
    _pila(A, g, X, [('t0', (0, -0.056, -0.046), T, 'Pino', kw), ('t1', (0.01, 0.056, -0.046), T, 'PinoOsc', kw),
                    ('t2', (-0.012, 0, 0.002), T, 'Pino', kw)])
    # dos ataduras de cuerda
    for sx in (-1, 1):
        caja(A, '%s_cuerda%d' % (g, sx), (X + sx * 0.14, 0, -0.022), (0.018, 0.225, 0.07), 'Cuerda', r=0.008, eje='x',
             bisel=0.002, grupo=g)
        caja(A, '%s_cuerda_arriba%d' % (g, sx), (X + sx * 0.14, 0, 0.026), (0.018, 0.105, 0.012), 'Cuerda', r=0.005,
             eje='x', bisel=0.001, grupo=g)
    return 0.0


def material_piedra(A, X):
    g = 'material_piedra'
    bloque(A, g + '_b0', (X - 0.065, -0.05, -0.045), (0.2, 0.15, 0.1), 'Piedra', jitter=0.007, semilla=1, grupo=g)
    bloque(A, g + '_b1', (X + 0.095, 0.0, -0.045), (0.14, 0.19, 0.1), 'PiedraClara', jitter=0.007, semilla=2, grupo=g)
    bloque(A, g + '_b2', (X - 0.05, 0.075, -0.05), (0.13, 0.1, 0.09), 'PiedraClara', jitter=0.006, semilla=4, grupo=g)
    bloque(A, g + '_b3', (X + 0.01, 0.0, 0.045), (0.2, 0.15, 0.09), 'Piedra', jitter=0.007, semilla=3, grupo=g)
    return 0.0


def material_metal(A, X):
    g = 'material_metal'

    def lingote(nombre, c):
        cx, cy, cz = c
        prisma(A, nombre, [(cy - 0.065, cz - 0.03, 0.006), (cy + 0.065, cz - 0.03, 0.006), (cy + 0.05, cz + 0.03, 0.004),
                           (cy - 0.05, cz + 0.03, 0.004)], cx - 0.15, cx + 0.15, 'Lingote', eje='x', n=3, bisel=0.003,
               grupo=g)
        caja(A, nombre + '_sello', (cx, cy, cz + 0.031), (0.07, 0.04, 0.004), 'AceroOscuro', r=0.008, eje='z',
             bisel=0.0, grupo=g)
    lingote(g + '_l0', (X, -0.072, -0.045))
    lingote(g + '_l1', (X, 0.072, -0.045))
    lingote(g + '_l2', (X, 0.0, 0.017))
    return 0.0


OBJETOS = {'venda': venda, 'botiquin': botiquin, 'frasco': frasco, 'bidon': bidon,
           'municion_ligera': municion_ligera, 'municion_media': municion_media, 'municion_pesada': municion_pesada,
           'municion_cartuchos': municion_cartuchos, 'municion_cohetes': municion_cohetes,
           'material_madera': material_madera, 'material_piedra': material_piedra, 'material_metal': material_metal}


def _vidrio():
    # el vidrio sale transparente en el GLB (el juego igual lo fuerza al clonarlo)
    m = bpy.data.materials.get('Vidrio')
    if not m:
        return
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Alpha'].default_value = 0.28
    bsdf.inputs['Transmission Weight'].default_value = 1.0
    try:
        m.surface_render_method = 'BLENDED'
    except AttributeError:
        m.blend_method = 'BLEND'


def objetos():
    A = Arma('objetos')
    piv = {}
    for nombre, fn in OBJETOS.items():
        X = LUGAR[nombre] * 0.8
        dz = fn(A, X)
        piv[nombre] = (X, 0, dz)
    _vidrio()
    info = finalizar(A, piv)
    return A, info
