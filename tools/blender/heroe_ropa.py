# Ropa del héroe de Salto Final, generada sobre la malla base 'Cuerpo' de heroe.blend.
# Requiere sf_tools.py cargado (builtins.SF). Cada función rehace su prenda desde cero.
import bpy, math
from mathutils import Vector

ss = SF.ss


def chaleco():
    def mask(c, n):
        if c.z < 0.97 or c.z > 1.66 or abs(c.x) > 0.30:
            return False
        t, perp = SF.arm_t(c)
        return not (t > 0.10 and perp < 0.10)

    def off(c):
        return 0.022 + 0.006 * ss(1.15, 1.35, c.z)

    def f_arm(c):
        xa = 0.168 + 0.095 * ss(1.47, 1.25, c.z) - 0.012 * ss(0.0, -0.08, c.y) * ss(1.45, 1.30, c.z)
        return abs(c.x) - xa

    f = SF.fmax(
        lambda c: (1.03 + 0.012 * ss(-0.02, 0.04, c.y)) - c.z,                    # ruedo
        f_arm,                                                                  # sisas
        lambda c: min(0.48 * (c.z - 1.335) - abs(c.x), -c.y - 0.01),            # escote en V
        lambda c: min(c.z - (1.548 + 5.0 * c.x * c.x), c.y),                    # escote trasero
        lambda c: min(0.09 - math.hypot(c.x, (c.y - 0.01) * 1.1), c.z - 1.47),  # cuello
        lambda c: c.z - 1.61)
    ob = SF.garment2('Chaleco', mask, off, field=f, smooth=6, subdiv=1,
                     mat=SF.material('M_Chaleco', (0.30, 0.055, 0.045, 1), rough=0.8), edge_smooth=5)
    SF.add_mods(ob, thick=0.014, levels=2)
    cuero = SF.material('M_RibeteChaleco', (0.16, 0.07, 0.05, 1), rough=0.55)
    SF.trims(ob, 'RibeteChaleco', 0.0085, mat=cuero, thick=0.014)
    return ob


def remera():
    def mask(c, n):
        if c.z < 0.93 or c.z > 1.68 or abs(c.x) > 0.30:
            return False
        t, perp = SF.arm_t(c)
        return not (abs(c.x) > 0.21 and not (t < 0.6 and perp < 0.11))

    def off(c):
        t, perp = SF.arm_t(c)
        return 0.006 + 0.006 * ss(0.15, 0.40, t) * (perp < 0.11)

    def f_sleeve(c):
        t, perp = SF.arm_t(c)
        return min(t - 0.43, 0.09 - perp)

    f = SF.fmax(f_sleeve, lambda c: c.z - (1.555 + 0.25 * c.y), lambda c: 0.955 - c.z)
    mat = SF.material('M_Camiseta', (0.06, 0.065, 0.07, 1), rough=0.9)
    ob = SF.garment2('Camiseta', mask, off, field=f, smooth=5, subdiv=1, mat=mat, edge_smooth=5)
    SF.add_mods(ob, thick=0.005, levels=2)
    SF.trims(ob, 'RibeteCamiseta', 0.0055, mat=mat, thick=0.005, select=lambda c, lp: c.z > 1.1)
    return ob


def _thumb(c):
    sx = 1 if c.x > 0 else -1
    T1 = Vector((sx * 0.415, -0.095, 0.935))
    T3 = Vector((sx * 0.41, -0.207, 0.882))
    d = (T3 - T1).normalized()
    t = (c - T1).dot(d)
    return t, (c - (T1 + d * t)).length


def guantes():
    mat = SF.material('Guante', (0.03, 0.035, 0.04, 1), rough=0.45)
    out = []
    for side, sx in (('I', 1), ('D', -1)):
        def mask(c, n, sx=sx):
            return c.x * sx > 0.33 and SF.hand_proj(c) > -0.075

        def f_th(c):
            t, p = _thumb(c)
            return min(t - 0.08, 0.024 - p)

        f = SF.fmax(lambda c: -0.055 - SF.hand_proj(c), lambda c: SF.hand_proj(c) - 0.148, f_th)
        g = SF.garment2('Guante' + side, mask, lambda c: 0.0035, field=f, smooth=1, smooth_fac=0.3, subdiv=1,
                        post_smooth=1, mat=mat, edge_smooth=4)
        SF.add_mods(g, thick=0.003, levels=1)
        out.append(g)
    return out


def pantalon():
    def mask(c, n):
        return 0.2 < c.z < 1.12 and abs(c.x) < 0.30

    f = SF.fmax(lambda c: 0.275 - c.z, lambda c: c.z - (1.065 - 0.01 * ss(0.02, -0.04, c.y)))
    ob = SF.garment2('Pantalon', mask, SF.pants_off, field=f, smooth=6, subdiv=1,
                     mat=SF.material('M_Pantalon', (0.20, 0.22, 0.12, 1), rough=0.9), edge_smooth=4)
    SF.add_mods(ob, thick=0.006, levels=2)
    return ob


def todo():
    chaleco()
    remera()
    guantes()
    pantalon()


def _leg_center(z, sx):
    H = Vector((sx * 0.098, 0.005, 0.935))
    K = Vector((sx * 0.145, -0.005, 0.52))
    A = Vector((sx * 0.183, 0.045, 0.10))
    if z > K.z:
        return K.lerp(H, (z - K.z) / (H.z - K.z))
    return K.lerp(A, (K.z - z) / (K.z - A.z))


def _ring_path(bvh, center, z, sx, a0=-50, a1=231, step=15, r_out=0.115, lift=0.003):
    # Puntos sobre la superficie alrededor de un eje vertical (piernas, cintura).
    path = []
    for a in range(a0, a1, step):
        ang = math.radians(a)
        d = Vector((math.cos(ang) * sx, math.sin(ang), 0))
        hit = bvh.ray_cast(center + d * r_out, -d, r_out)
        path.append((hit[0] if hit[0] else center + d * (r_out * 0.8)) + d * lift)
    return path


def bolsillos_cargo(lados=('I',)):
    pants = bpy.data.objects['Pantalon']
    bvh = SF.surface_bvh(pants)
    tela = bpy.data.materials['M_Pantalon']
    for side in ('I', 'D'):
        for n in ('BolsilloCargo', 'TapaCargo'):
            o = bpy.data.objects.get(n + side)
            if o:
                bpy.data.objects.remove(o)
    for side in lados:
        sx = 1 if side == 'I' else -1
        up = Vector((sx * -0.047, 0.01, 0.415)).normalized()
        c = Vector((sx * 0.32, -0.005, 0.70))
        pk = SF.patch('BolsilloCargo' + side, None, c, up, (0.125, 0.155), thick=0.02, puff=0.55, exp=5, mat=tela, bvh=bvh)
        bvh2 = SF.surface_bvh([pants, pk])
        loc = bvh.find_nearest(c)[0]
        SF.patch('TapaCargo' + side, None, loc + up * 0.058 + Vector((sx * 0.05, 0, 0)), up, (0.138, 0.058), thick=0.009,
                 puff=0.25, exp=6, mat=tela, bvh=bvh2, gap=0.001)


def rodilleras():
    pants = bpy.data.objects['Pantalon']
    bvh = SF.surface_bvh(pants)
    base_m = SF.material('M_RodilleraBase', (0.035, 0.037, 0.04, 1), rough=0.85)
    shell_m = SF.material('M_RodilleraCasco', (0.06, 0.065, 0.07, 1), rough=0.35)
    strap_m = SF.material('M_Correa', (0.03, 0.03, 0.03, 1), rough=0.7)
    for side, sx in (('I', 1), ('D', -1)):
        up = Vector((sx * -0.03, 0.02, 1)).normalized()
        c = Vector((sx * 0.15, -0.12, 0.53))
        b = SF.patch('Rodillera' + side, None, c, up, (0.105, 0.135), thick=0.014, puff=0.5, exp=3.2, mat=base_m, bvh=bvh,
                     shape=lambda x, y: (x * (1 - 0.18 * (y < 0) * abs(y) / 0.07), y))
        bvh2 = SF.surface_bvh([pants, b])
        SF.patch('RodilleraCasco' + side, None, c + Vector((0, 0, 0.005)), up, (0.085, 0.10), thick=0.012, puff=0.85,
                 exp=3.0, mat=shell_m, bvh=bvh2, gap=0.0, seam=0.0)
        for k, z in enumerate((0.605, 0.462)):
            path = _ring_path(bvh, _leg_center(z, sx), z, sx)
            SF.strap('RodilleraCorrea%s%d' % (side, k), None, path, width=0.024, thick=0.004, mat=strap_m, bvh=bvh,
                     gap=0.0015)


def _onto(bvh, p, axis_z=(1.0, 1.45), lift=0.003, center_y=0.0):
    # Lleva un punto de control aproximado a la superficie exterior, tirando un rayo desde afuera hacia el eje del torso.
    p = Vector(p)
    a = Vector((0, center_y, min(max(p.z, axis_z[0]), axis_z[1])))
    d = (p - a).normalized()
    hit = bvh.ray_cast(a + d * 0.45, -d, 0.45)
    return (hit[0] + d * lift) if hit[0] else p


def _rrect(center, u, v, w, h, r, n=6):
    # Polilínea cerrada de un rectángulo redondeado en el plano (u, v).
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180),
                       (w / 2 - r, -h / 2 + r, 270)):
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n)
            pts.append(Vector(center) + u * (cx + r * math.cos(a)) + v * (cy + r * math.sin(a)))
    return pts


def hebilla(name, center, u, v, n, w=0.05, h=0.045, r=0.004, mat=None):
    # Hebilla metálica: marco de alambre redondo + pasador central.
    mat = mat or SF.material('M_Hebilla', (0.55, 0.5, 0.42, 1), rough=0.3, metal=1.0)
    fr = SF.tube(name + 'Marco', _rrect(center, u, v, w, h, min(w, h) * 0.22), r, mat=mat, smooth_iters=0)
    bar = SF.tube(name + 'Pasador', [Vector(center) - v * (h / 2 - r), Vector(center) + v * (h / 2 - r)], r * 0.85,
                  mat=mat, closed=False, smooth_iters=0)
    return SF.join_meshes(name, [fr, bar])


def cinturon():
    pants = bpy.data.objects['Pantalon']
    bvh = SF.surface_bvh(pants)
    cuero = SF.material('M_Cinturon', (0.10, 0.055, 0.03, 1), rough=0.5)
    for n in ('Cinturon', 'Hebilla', 'Presillas'):
        o = bpy.data.objects.get(n)
        if o:
            bpy.data.objects.remove(o)
    z = 1.006
    c = Vector((0, -0.01, z))
    path = _ring_path(bvh, c, z, 1, a0=-84, a1=266, step=8, r_out=0.3, lift=0.002)
    SF.strap('Cinturon', None, path, width=0.042, thick=0.007, mat=cuero, bvh=bvh, gap=0.001)
    hit = bvh.ray_cast(Vector((0, -0.3, z)), Vector((0, 1, 0)), 0.4)
    H, N = hit[0], hit[1].normalized()
    u = Vector((1, 0, 0))
    v = N.cross(u).normalized() * -1
    if v.z < 0:
        v = -v
    hebilla('Hebilla', H + N * 0.009, u, v, N, w=0.058, h=0.05, r=0.0045)
    loops = []
    for a in (-55, -20, 35, 90, 145, 200, 235):
        ang = math.radians(a)
        d = Vector((math.cos(ang), math.sin(ang), 0))
        pts = []
        for dz in (-0.026, 0.0, 0.024):
            hh = bvh.ray_cast(c + Vector((0, 0, dz)) + d * 0.3, -d, 0.3)
            if hh[0] is None:
                break
            pts.append(hh[0] + d * (0.011 if dz == 0 else 0.004))
        if len(pts) == 3:
            loops.append(SF.strap('Presilla%d' % a, None, pts, width=0.014, thick=0.003,
                                  mat=bpy.data.materials['M_Pantalon'], bvh=bvh, gap=0.0, project=False, smooth=0,
                                  step=0.006))
    SF.join_meshes('Presillas', loops)


def cartuchera():
    # Funda de pistola en el muslo derecho (x negativo).
    pants = bpy.data.objects['Pantalon']
    bvh = SF.surface_bvh(pants)
    nylon = SF.material('M_Funda', (0.05, 0.05, 0.045, 1), rough=0.6)
    poly = SF.material('M_FundaCasco', (0.025, 0.025, 0.025, 1), rough=0.35)
    arma = SF.material('M_ArmaFunda', (0.04, 0.04, 0.045, 1), rough=0.4, metal=0.3)
    strap_m = SF.material('M_Correa', (0.03, 0.03, 0.03, 1), rough=0.7)
    sx = -1
    up = Vector((sx * -0.047, 0.01, 0.415)).normalized()
    c = Vector((sx * 0.32, 0.0, 0.76))
    plate = SF.patch('FundaPlaca', None, c, up, (0.088, 0.20), thick=0.007, puff=0.15, exp=6, mat=nylon, bvh=bvh)
    loc, n0, u, v = SF._frame(bvh, c, up)
    body_c = loc + n0 * 0.034 - v * 0.012
    SF.rbox('FundaCuerpo', body_c, (u, v, n0), (0.058, 0.155, 0.042), bevel=0.016, segs=4, mat=poly)
    g_axis = (v * 0.93 + u * -0.36 * sx).normalized()
    g_side = g_axis.cross(n0).normalized()
    SF.rbox('FundaEmpunadura', body_c + v * 0.095 + u * -0.006 * sx + n0 * 0.0, (g_side, g_axis, n0), (0.032, 0.075, 0.03),
            bevel=0.008, segs=3, mat=arma)
    bvh2 = SF.surface_bvh([pants, plate])
    for k, z in enumerate((0.70, 0.835)):
        lc = _leg_center(z, sx)
        path = _ring_path(bvh2, lc, z, sx, a0=-180, a1=181, step=12, r_out=0.13)
        SF.strap('FundaCorrea%d' % k, None, path, width=0.026, thick=0.004, mat=strap_m, bvh=bvh2, gap=0.0015)
    top = loc + v * 0.10
    p0 = bvh.ray_cast(Vector((sx * 0.4, 0.0, 1.0)), Vector((-sx, 0, 0)), 0.4)[0]
    path = [p0 + Vector((sx * 0.004, 0, 0)), p0.lerp(top, 0.5) + n0 * 0.006, top + n0 * 0.004]
    SF.strap('FundaCaida', None, path, width=0.03, thick=0.004, mat=strap_m, bvh=bvh2, gap=0.0015)


def chaleco_detalles():
    ch = bpy.data.objects['Chaleco']
    rib = bpy.data.objects.get('RibeteChaleco')
    bvh = SF.surface_bvh([ch] + ([rib] if rib else []))
    tela = SF.material('M_Bolsas', (0.07, 0.065, 0.05, 1), rough=0.85)
    arnes = SF.material('M_Arnes', (0.09, 0.05, 0.03, 1), rough=0.5)
    metal = SF.material('M_Hebilla', (0.55, 0.5, 0.42, 1), rough=0.3, metal=1.0)
    up = Vector((0, 0, 1))
    for i, x in enumerate((-0.072, 0.072)):
        c = Vector((x, -0.2, 1.125))
        pk = SF.patch('Cargador%d' % i, None, c, up, (0.068, 0.11), thick=0.032, puff=0.35, exp=7, mat=tela, bvh=bvh)
        b2 = SF.surface_bvh([ch, pk])
        loc, n0, u, v = SF._frame(bvh, c, up)
        SF.patch('CargadorTapa%d' % i, None, loc + v * 0.04, up, (0.072, 0.045), thick=0.007, puff=0.2, exp=7, mat=tela,
                 bvh=b2, gap=0.001, depth=0.15)
    # bolsa de radio en el pecho izquierdo con antena
    c = Vector((0.125, -0.2, 1.37))
    rp = SF.patch('BolsaRadio', None, c, up, (0.05, 0.075), thick=0.03, puff=0.3, exp=7, mat=tela, bvh=bvh)
    loc, n0, u, v = SF._frame(bvh, c, up)
    SF.cyl('Antena', loc + n0 * 0.022 + v * 0.06 + u * 0.012, v, 0.0045, 0.06, segs=10, mat=metal if False else tela)
    # arnés: dos correas que pasan por los hombros y se cruzan en la espalda con una argolla
    for i, sx in enumerate((1, -1)):
        ctrl = [(sx * 0.095, -0.2, 1.055), (sx * 0.10, -0.2, 1.25), (sx * 0.112, -0.15, 1.45), (sx * 0.125, -0.03, 1.57),
                (sx * 0.12, 0.10, 1.50), (sx * 0.06, 0.16, 1.38), (0.0, 0.17, 1.30), (-sx * 0.07, 0.16, 1.18),
                (-sx * 0.11, 0.14, 1.06)]
        path = [_onto(bvh, p) for p in ctrl]
        SF.strap('Arnes%d' % i, None, path, width=0.034, thick=0.005, mat=arnes, bvh=bvh, gap=0.002, step=0.008)
        st = bpy.data.objects['Arnes%d' % i]
        front = [v.co for v in st.data.vertices if v.co.y < -0.05 and abs(v.co.z - 1.23) < 0.006]
        H = sum(front, Vector()) / len(front)
        N = bvh.find_nearest(H)[1].normalized()
        uu = Vector((1, 0, 0))
        vv = N.cross(uu).normalized()
        if vv.z < 0:
            vv = -vv
        hebilla('HebillaArnes%d' % i, H + N * 0.004, uu, vv, N, w=0.046, h=0.03, r=0.0035, mat=metal)
    hit = bvh.ray_cast(Vector((0, 0.6, 1.30)), Vector((0, -1, 0)), 0.7)
    H, N = hit[0], hit[1].normalized()
    ring = [H + N * 0.012 + Vector((math.cos(a), 0, math.sin(a))) * 0.02 for a in [2 * math.pi * k / 24 for k in range(24)]]
    SF.tube('ArgollaArnes', ring, 0.004, mat=metal, smooth_iters=0)


def _suela(b, side, H, T, mat):
    # Suela de bota militar: contorno ceñido a la planta, taco con quiebre en el arco, puntera levantada,
    # canto casi recto con chaflán abajo y un reborde (vira) donde apoya el cuero.
    import bmesh
    for n in ('Suela' + side,):
        o = bpy.data.objects.get(n)
        if o:
            bpy.data.objects.remove(o)
    pts = [Vector((v.co.x, v.co.y)) for v in b.data.vertices if v.co.z < 0.02]
    C = sum(pts, Vector((0, 0))) / len(pts)
    M = 72
    rad = [0.0] * M
    for p in pts:
        d = p - C
        k = int(round(math.atan2(d.y, d.x) / (2 * math.pi) * M)) % M
        rad[k] = max(rad[k], d.length)
    for k in range(M):  # huecos de bins vacíos
        if rad[k] == 0:
            rad[k] = max(rad[k - 1], rad[(k + 1) % M])
    for _ in range(3):
        rad = [(rad[k - 1] + 2 * rad[k] + rad[(k + 1) % M]) / 4 for k in range(M)]
    dirs = [Vector((math.cos(2 * math.pi * k / M), math.sin(2 * math.pi * k / M))) for k in range(M)]
    ax = (T - H).to_2d()
    L = ax.length
    ax.normalize()

    def tpar(q):
        return max(0.0, min(1.0, (q - H.to_2d()).dot(ax) / L))

    def zb(q):  # altura de la cara de abajo
        t = tpar(q)
        z = -0.032
        z += 0.014 * ss(0.30, 0.335, t) * (1 - ss(0.46, 0.56, t))   # arco (entre taco y planta)
        z += 0.006 * ss(0.30, 0.335, t)                              # planta más fina que el taco
        z += 0.012 * ss(0.80, 1.0, t)                                # puntera levantada
        return z

    def ring(off, zf, scale=1.0):
        out = []
        for k in range(M):
            q = C + dirs[k] * (rad[k] * scale + off)
            out.append(Vector((q.x, q.y, zf(q) if callable(zf) else zf)))
        return out

    secs = [ring(0, zb, 0.06), ring(0, zb, 0.4), ring(0, zb, 0.72), ring(-0.002, zb, 0.93),
            ring(0.002, lambda q: zb(q)), ring(0.0045, lambda q: zb(q) + 0.002), ring(0.005, lambda q: zb(q) + 0.005),
            ring(0.005, -0.004), ring(0.0058, -0.002), ring(0.0058, 0.004), ring(0.004, 0.0065), ring(-0.004, 0.008),
            ring(-0.004, 0.012, 0.6)]
    so = SF.loft_mesh('Suela' + side, secs, closed_ends=True)
    bm = bmesh.new()
    bm.from_mesh(so.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(so.data)
    bm.free()
    SF._with_mat(so, mat)
    d = so.modifiers.new('Sub', 'SUBSURF')
    d.levels = 2
    return so


def pantalon_sobre_botas():
    # Botamanga "blusada": el pantalón se ciñe a la caña y la tela sobrante cae por encima con pliegues.
    import numpy as np
    pa = bpy.data.objects['Pantalon']
    me = pa.data
    if 'co_orig' not in me.attributes:
        at = me.attributes.new('co_orig', 'FLOAT_VECTOR', 'POINT')
        at.data.foreach_set('vector', SF.get_co(pa).ravel())
    co = np.empty(len(me.vertices) * 3)
    me.attributes['co_orig'].data.foreach_get('vector', co)
    co = co.reshape(-1, 3)
    for side, sx in (('I', 1), ('D', -1)):
        bo = bpy.data.objects['Bota' + side]
        bvh = SF.surface_bvh(bo)
        bc = SF.get_co(bo)
        for i, p in enumerate(co):
            z = p[2]
            if z > 0.43 or p[0] * sx <= 0:
                continue
            zc = min(max(z, 0.27), 0.33)
            sl = bc[np.abs(bc[:, 2] - zc) < 0.008]
            c = Vector((sl[:, 0].min() + sl[:, 0].max(), sl[:, 1].min() + sl[:, 1].max(), 0)) / 2
            d = Vector((p[0] - c.x, p[1] - c.y, 0))
            r = d.length
            d.normalize()
            o = Vector((c.x, c.y, zc)) + d * 0.25
            hit = bvh.ray_cast(o, -d, 0.3)
            rb = ((hit[0] - Vector((c.x, c.y, zc))).to_2d().length if hit[0] else r - 0.03)
            ang = math.atan2(d.y, d.x)
            pli = 0.0045 * math.sin(9 * ang + 40 * z) * math.exp(-((z - 0.30) / 0.03) ** 2)
            tgt = rb + 0.003 + 0.017 * ss(0.272, 0.30, z) + pli
            w = ss(0.31, 0.42, z)
            rn = tgt + (r - tgt) * w
            co[i][0] = c.x + d.x * rn
            co[i][1] = c.y + d.y * rn
    SF.set_co(pa, co)


def botas():
    # Bota procedural: caña (anillos ajustados a la pierna) + pie (secciones a lo largo del pie), unidos por vóxeles.
    import bmesh
    cuero = SF.material('M_Bota', (0.13, 0.075, 0.045, 1), rough=0.6)
    suela_m = SF.material('M_Suela', (0.035, 0.032, 0.03, 1), rough=0.8)
    cordon = SF.material('M_Cordon', (0.06, 0.045, 0.03, 1), rough=0.9)
    for n in ('BotaI', 'BotaD', 'SuelaI', 'SuelaD', 'PunteraI', 'PunteraD', 'BotaCuelloI', 'BotaCuelloD',
              'CordonesI', 'CordonesD'):
        o = bpy.data.objects.get(n)
        if o:
            bpy.data.objects.remove(o)
    body = SF.get_co(bpy.data.objects['Cuerpo'])
    out = []
    for side, sx in (('I', 1), ('D', -1)):
        # --- caña: elipses que envuelven la pierna con holgura; abajo baja hasta la suela y forma el talón
        rings = []
        zs = [0.006, 0.02, 0.04, 0.065, 0.09] + [0.11 + 0.23 * k / 10 for k in range(11)]
        for z in zs:
            ze = max(z, 0.11)
            sl = body[(abs(body[:, 2] - ze) < 0.016) & (body[:, 0] * sx > 0.06) & (body[:, 1] > -0.045)]
            cx = (sl[:, 0].min() + sl[:, 0].max()) / 2
            cy = (sl[:, 1].min() + sl[:, 1].max()) / 2
            rx = (sl[:, 0].max() - sl[:, 0].min()) / 2 + 0.014 + 0.004 * ss(0.25, 0.32, z)
            ry = (sl[:, 1].max() - sl[:, 1].min()) / 2 + 0.014 + 0.004 * ss(0.25, 0.32, z)
            u = ss(0.11, 0.03, z)  # contrafuerte: la espalda de la caña se abre hacia atrás hasta cubrir el talón
            back = (cy + ry) + (0.131 - (cy + ry)) * u
            front = cy - ry
            cy, ry = (back + front) / 2, (back - front) / 2
            rx = rx + (0.05 - rx) * u
            rings.append(SF.superellipse((cx, cy, z), rx, ry, 2.2 + 0.5 * u, (1, 0, 0), (0, 1, 0), N=40))
        cana = SF.loft_mesh('_Cana' + side, rings, closed_ends=True)
        # --- pie: secciones desde el centro del talón (queda adentro de la caña) a la punta; puntera ancha
        H = Vector((sx * 0.19, 0.075, 0))
        T = Vector((sx * 0.255, -0.178, 0))
        ax = (T - H).normalized()
        lat = Vector((-ax.y, ax.x, 0)) * (1 if sx > 0 else -1)
        prof = [(0.0, 0.080, 0.10), (0.12, 0.092, 0.112), (0.3, 0.100, 0.108), (0.5, 0.106, 0.09),
                (0.66, 0.114, 0.076), (0.8, 0.116, 0.066), (0.9, 0.110, 0.060), (0.96, 0.096, 0.055),
                (0.99, 0.07, 0.047), (1.0, 0.044, 0.038)]
        secs = []
        L = (T - H).length
        for t, w, h in prof:
            P = H + ax * (L * t)
            secs.append(SF.superellipse((P.x, P.y, 0.006 + h / 2), w / 2, h / 2, 2.8, lat, (0, 0, 1), N=40))
        pie = SF.loft_mesh('_Pie' + side, secs, closed_ends=True)
        b = SF.join_meshes('Bota' + side, [cana, pie])
        SF.voxel_close(b, r=0.028, size=0.0024, smooth_iter=10)
        b.data.materials.clear()
        b.data.materials.append(cuero)
        _suela(b, side, Vector((sx * 0.19, 0.131, 0)), T, suela_m)
        # --- cordones cruzados sobre el empeine
        bvh = SF.surface_bvh(b)
        front = Vector((0.26 * sx, -0.97, 0)).normalized()
        up = Vector((0, 0, 1))
        side_v = front.cross(up).normalized()
        bv = [v.co for v in b.data.vertices]
        eyes_l, eyes_r = [], []
        n_e = 7
        for i in range(n_e):
            t = i / (n_e - 1)
            z = 0.29 - 0.17 * t
            slab = [c for c in bv if abs(c.z - z) < 0.01 and c.y > -0.05]
            O = sum(slab, Vector()) / len(slab)
            phi = math.radians(6 + 50 * t ** 1.3)
            nd = (front * math.cos(phi) + up * math.sin(phi)).normalized()
            for lst, sgn in ((eyes_l, 1), (eyes_r, -1)):
                Q = O + side_v * (sgn * 0.016)
                hh = bvh.ray_cast(Q + nd * 0.3, -nd, 0.45)
                lst.append((hh[0] if hh[0] else Q + nd * 0.05) + nd * 0.0035)
        laces = []
        for i in range(n_e - 1):
            laces.append(SF.tube('Cordon%s%da' % (side, i), [eyes_l[i], eyes_r[i + 1]], 0.0028, mat=cordon, closed=False,
                                 smooth_iters=0))
            laces.append(SF.tube('Cordon%s%db' % (side, i), [eyes_r[i], eyes_l[i + 1]], 0.0028, mat=cordon, closed=False,
                                 smooth_iters=0))
        SF.join_meshes('Cordones' + side, laces)
        # (sin cuello: la boca de la caña queda tapada por el pantalón y el tubo asomaba por delante)
        out.append(b)
    return out
