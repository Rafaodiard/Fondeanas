# Cabeza del héroe: pelo (undercut con jopo), bufanda y antiparras. Requiere sf_tools (SF) cargado.
import bpy, math
from mathutils import Vector

ss = SF.ss
HC = Vector((0, -0.055, 1.74))  # centro aproximado del cráneo


def _az(c):
    # Azimut alrededor del eje vertical de la cabeza: 0 = frente (-Y), 90 = costado, 180 = nuca.
    return math.degrees(math.atan2(abs(c.x), -(c.y - HC.y)))


def _tab(tab, a):
    for (a0, z0), (a1, z1) in zip(tab, tab[1:]):
        if a0 <= a <= a1:
            t = (a - a0) / (a1 - a0)
            t = t * t * (3 - 2 * t)
            return z0 + (z1 - z0) * t
    return tab[-1][1]


HAIRLINE = [(0, 1.797), (30, 1.79), (55, 1.778), (66, 1.735), (74, 1.712), (84, 1.712), (90, 1.775), (118, 1.778),
            (132, 1.695), (155, 1.665), (180, 1.655)]


def hairline(c):
    a = _az(c)
    z = _tab(HAIRLINE, a)
    if a < 50:
        z += 0.006 * abs(math.sin(c.x * 60)) * (1 - a / 50)
    return z


def _scalp(c, n):
    return c.z > 1.63 and (c.z > 1.75 or _az(c) > 60) and not (abs(c.x) > 0.09 and 1.69 < c.z < 1.772 and -0.075 < c.y < 0.0)


def pelo():
    corto = SF.material('M_PeloCorto', (0.028, 0.018, 0.012, 1), rough=0.9)
    largo = SF.material('Pelo', (0.055, 0.032, 0.018, 1), rough=0.55)
    pc = SF.garment2('PeloCorto', _scalp, lambda c: 0.0022, field=lambda c: hairline(c) - c.z, smooth=2, subdiv=1,
                     post_smooth=1, mat=corto, edge_smooth=4)
    SF.add_mods(pc, thick=0.0015, levels=1)

    def xw(c):
        return 0.066 + 0.014 * ss(-0.10, 0.04, c.y) + 0.0015 * math.sin(c.y * 95)

    def zt(c):
        return 1.786 - 0.012 * ss(-0.02, 0.06, c.y)

    f_top = SF.fmax(lambda c: abs(c.x) - xw(c), lambda c: hairline(c) - c.z, lambda c: zt(c) - c.z)

    def height(c):
        front = ss(0.04, -0.10, c.y)
        crown = max(0.0, 1 - (c.x / 0.078) ** 2)
        taper = ss(0.0, 0.035, c.z - hairline(c))
        return 0.0024 + taper * (0.008 + 0.022 * front * (0.4 + 0.6 * crown) + 0.008 * crown)

    def strands(c):
        fade = ss(0.0, 0.014, xw(c) - abs(c.x)) * ss(0.0, 0.02, c.z - hairline(c))
        ph = 0.012 * math.sin(c.y * 24) + 0.004 * math.sin(c.y * 61 + c.x * 30)
        g = math.cos(2 * math.pi * (c.x + ph) / 0.024)
        lump = 0.5 + 0.5 * math.sin(c.y * 40 + c.x * 90)
        return (0.0032 * g + 0.0015 * lump) * fade

    top = SF.garment2('PeloArriba', _scalp, height, field=f_top, smooth=2, subdiv=2, post_smooth=2, mat=largo,
                      edge_smooth=5, detail=strands)
    # grosor 0 en el borde de la frente (el pelo nace al ras) y pared completa en los costados del undercut
    from mathutils.kdtree import KDTree
    me = top.data
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(me)
    bpts = [v.co.copy() for v in bm.verts if v.is_boundary and _az(v.co) < 58]
    bm.free()
    kd = KDTree(len(bpts))
    for i, p in enumerate(bpts):
        kd.insert(p, i)
    kd.balance()
    vg = top.vertex_groups.new(name='Grosor')
    for v in me.vertices:
        d = kd.find(v.co)[2] if bpts else 1.0
        vg.add([v.index], ss(0.0, 0.018, d), 'REPLACE')
    SF.add_mods(top, thick=0.03, levels=2, offset=-1.0)
    sol = top.modifiers['Grosor']
    sol.vertex_group = 'Grosor'
    sol.thickness_vertex_group = 0.0
    return pc, top


def bufanda():
    tela = SF.material('M_Bufanda', (0.05, 0.14, 0.11, 1), rough=0.95)
    N, R = 64, 22
    secs = []
    for j in range(R + 1):
        t = j / R
        pts = []
        for k in range(N):
            th = 2 * math.pi * k / N  # 0 = frente (-Y)
            fr = max(0.0, math.cos(th)) ** 1.5
            z_bot = 1.498 - 0.03 * fr
            z_top = 1.636 - 0.055 * fr
            z = z_bot + (z_top - z_bot) * t
            r = 0.112 - 0.024 * t
            r += 0.009 * math.sin(math.pi * t * 2.0) ** 2          # vueltas de la bufanda
            r += 0.0045 * math.sin(7 * th + 5 * t) + 0.0028 * math.sin(13 * th - 3 * t + 1.3)  # pliegues
            r += 0.006 * fr * (1 - t)                                # cae un poco adelante
            ry = r * (0.96 + 0.06 * fr)
            pts.append(Vector((math.sin(th) * r, -0.014 - math.cos(th) * ry, z)))
        secs.append(pts)
    ob = SF.loft_mesh('Bufanda', secs, closed_ends=False)
    SF._with_mat(ob, tela)
    SF.add_mods(ob, thick=0.012, levels=2, offset=1.0)
    # cola anudada que cae por adelante, del lado derecho
    objs = [o for o in (bpy.data.objects.get('Camiseta'), bpy.data.objects.get('Chaleco'), ob) if o]
    bvh = SF.surface_bvh(objs)
    path = [Vector((-0.035, -0.125, 1.535)), Vector((-0.05, -0.15, 1.47)), Vector((-0.058, -0.175, 1.41)),
            Vector((-0.062, -0.19, 1.36))]
    path = [bvh.ray_cast(p + Vector((0, -0.2, 0.02)), Vector((0, 1, -0.1)).normalized(), 0.4)[0] or p for p in path]
    path = [p + Vector((0, -0.006, 0)) for p in path]
    cola = SF.strap('BufandaCola', None, path, width=0.062, thick=0.014, mat=tela, bvh=bvh, gap=0.004, exp=2.4, sec=16,
                    step=0.008)
    # vuelta superior cruzada en diagonal (se ve que la tela está enrollada)
    secs = []
    M = 72
    for i in range(M):
        th = 2 * math.pi * i / M
        fr = max(0.0, math.cos(th)) ** 1.5
        zc = 1.566 + 0.022 * math.sin(th + 0.9) - 0.03 * fr
        r = 0.106 + 0.004 * math.sin(5 * th) + 0.006 * fr
        C = Vector((math.sin(th) * r, -0.014 - math.cos(th) * r * (0.96 + 0.06 * fr), zc))
        radial = Vector((math.sin(th), -math.cos(th), 0))
        tang = Vector((math.cos(th), math.sin(th), 0))
        up = radial.cross(tang).normalized()
        if up.z < 0:
            up = -up
        h = 0.03 + 0.008 * math.sin(3 * th + 1)
        secs.append(SF.superellipse(C + radial * 0.006, 0.011, h, 2.2, radial, up, N=14))
    vuelta = SF.loft_ring('BufandaVuelta', secs)
    SF._with_mat(vuelta, tela)
    d = vuelta.modifiers.new('Sub', 'SUBSURF')
    d.levels = 2
    nudo = SF.patch('BufandaNudo', None, Vector((-0.032, -0.2, 1.528)), Vector((0.25, 0.15, 1)), (0.05, 0.036), thick=0.018,
                    puff=0.8, exp=2.6, mat=tela, bvh=SF.surface_bvh([ob, vuelta]), seam=0.0, gap=0.0,
                    shape=lambda x, y: (x * (1 + 0.25 * y / 0.018), y))
    for o in (cola,):
        d = o.modifiers.new('Sub', 'SUBSURF')
        d.levels = 1
    return ob


def antiparras():
    goma = SF.material('M_AntiparrasGoma', (0.05, 0.05, 0.055, 1), rough=0.6)
    lente = SF.material('M_Lente', (0.9, 0.42, 0.08, 1), rough=0.08, metal=0.2)
    aro = SF.material('M_AntiparrasAro', (0.35, 0.33, 0.30, 1), rough=0.3, metal=0.9)
    hair = [o for o in (bpy.data.objects.get('PeloArriba'), bpy.data.objects.get('PeloCorto'), bpy.data.objects['Cuerpo']) if o]
    bvh = SF.surface_bvh(hair)
    hc = Vector((0, -0.055, 1.765))
    F = Vector((0, -math.cos(math.radians(38)), math.sin(math.radians(38))))
    hit = bvh.ray_cast(hc + F * 0.4, -F, 0.4)
    P = hit[0]
    X = Vector((1, 0, 0))
    U = F.cross(X).normalized() * -1  # hacia la coronilla
    if U.z < 0:
        U = -U
    parts = []
    for i, sx in enumerate((1, -1)):
        c = P + X * (sx * 0.034) + F * 0.004
        hh = bvh.ray_cast(c + F * 0.2, -F, 0.3)
        base = (hh[0] if hh[0] else c) + F * 0.002
        secs = []
        for d, rx, ry in ((0.0, 0.027, 0.019), (0.006, 0.0305, 0.0225), (0.016, 0.0305, 0.0225), (0.019, 0.027, 0.019)):
            secs.append(SF.superellipse(base + F * d, rx, ry, 3.2, X, U, N=32))
        cup = SF.loft_mesh('AntiparraCopa%d' % i, secs, closed_ends=True)
        SF._with_mat(cup, goma)
        d_ = cup.modifiers.new('Sub', 'SUBSURF')
        d_.levels = 2
        lens_secs = []
        for d, s_ in ((0.0185, 1.0), (0.0205, 0.8), (0.0218, 0.5), (0.0223, 0.15)):
            lens_secs.append(SF.superellipse(base + F * d, 0.0245 * s_, 0.0168 * s_, 3.2, X, U, N=32))
        ln = SF.loft_mesh('AntiparraLente%d' % i, lens_secs, closed_ends=True)
        SF._with_mat(ln, lente)
        d_ = ln.modifiers.new('Sub', 'SUBSURF')
        d_.levels = 2
        rim = SF.tube('AntiparraAro%d' % i, SF.superellipse(base + F * 0.0185, 0.0262, 0.0182, 3.2, X, U, N=40), 0.0022,
                      mat=aro, smooth_iters=0)
        parts += [cup, ln, rim]
    SF.rbox('AntiparraPuente', P + F * 0.012, (X, U, F), (0.016, 0.01, 0.008), bevel=0.003, mat=goma)
    # correa elástica alrededor de la cabeza
    path = []
    for a in range(55, 306, 10):
        th = math.radians(a)
        d = Vector((math.sin(th), -math.cos(th), 0))
        z = 1.806 + 0.022 * max(0.0, math.cos(th))
        o = Vector((0, -0.055, z))
        hh = bvh.ray_cast(o + d * 0.25, -d, 0.25)
        path.append((hh[0] if hh[0] else o + d * 0.1) + d * 0.004)
    SF.strap('AntiparraCorrea', None, path, width=0.022, thick=0.004, mat=goma, bvh=bvh, gap=0.003, step=0.008)
    return parts
