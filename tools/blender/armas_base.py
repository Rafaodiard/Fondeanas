# Herramientas de modelado hard-surface para las armas de Salto Final (Blender 5.x, por script).
# Convención de cada arma (la misma que el hueso Arma.R del héroe): origen en el centro del puño derecho,
# cañón hacia +Y, arriba +Z y derecha +X. Al exportar a glTF queda cañón -Z, arriba +Y.
# Cada pieza se arma con perfiles extruidos, tornos y barridos; los cortes son booleanos y el acabado es
# bisel por ángulo + normales ponderadas, que da los cantos brillantes del estilo "juguete premium".
import bpy, bmesh, math, base64, os
from mathutils import Vector, Matrix

OUT = r'C:\Users\rafae\SaltoFinal_modelos'
ESCENA = 'Armas'


def V(*a):
    return Vector(a)


# ---------------------------------------------------------------------------
# Escena y colecciones
def escena():
    sc = bpy.data.scenes.get(ESCENA)
    if not sc:
        sc = bpy.data.scenes.new(ESCENA)
    win = bpy.context.window or bpy.context.window_manager.windows[0]
    if win.scene != sc:
        win.scene = sc
    return sc


def coleccion(nombre, padre=None, ocultar=False):
    sc = escena()
    c = bpy.data.collections.get(nombre)
    if not c:
        c = bpy.data.collections.new(nombre)
        (padre or sc.collection).children.link(c)
    c.hide_render = ocultar
    c.hide_viewport = False
    return c


def vaciar(col):
    for ob in list(col.objects):
        me = ob.data if ob.type == 'MESH' else None
        bpy.data.objects.remove(ob, do_unlink=True)
        if me and me.users == 0:
            bpy.data.meshes.remove(me)


class Arma:
    # contexto de una arma en construcción: colección de piezas fuente y de cortes
    def __init__(self, nombre):
        self.nombre = nombre
        self.col = coleccion('src_' + nombre)
        self.cortes = coleccion('cut_' + nombre, ocultar=True)
        vaciar(self.col)
        vaciar(self.cortes)
        self.piezas = []          # (objeto, grupo) grupo = 'cuerpo' o el nombre de la parte móvil
        self.puntos = {}          # vacíos de referencia: boca, mira, apoyo...

    def add(self, ob, grupo='cuerpo'):
        self.piezas.append((ob, grupo))
        return ob

    def punto(self, nombre, pos):
        self.puntos[nombre] = Vector(pos)


# ---------------------------------------------------------------------------
# Materiales PBR (colores lineales). 'Rareza' se tiñe en el juego con el color de la rareza.
PALETA = {
    'Pavonado': dict(c=(0.030, 0.032, 0.036), m=0.92, r=0.34),
    'Acero': dict(c=(0.42, 0.43, 0.44), m=1.0, r=0.26),
    'AceroOscuro': dict(c=(0.10, 0.105, 0.11), m=1.0, r=0.32),
    'Polimero': dict(c=(0.022, 0.023, 0.026), m=0.0, r=0.52),
    'Grafito': dict(c=(0.060, 0.064, 0.070), m=0.35, r=0.45),
    'Oliva': dict(c=(0.105, 0.115, 0.060), m=0.0, r=0.58),
    'Arena': dict(c=(0.30, 0.22, 0.12), m=0.0, r=0.6),
    'Madera': dict(c=(0.20, 0.075, 0.028), m=0.0, r=0.42),
    'MaderaClara': dict(c=(0.34, 0.15, 0.055), m=0.0, r=0.45),
    'Goma': dict(c=(0.016, 0.016, 0.017), m=0.0, r=0.88),
    'Laton': dict(c=(0.80, 0.55, 0.22), m=1.0, r=0.28),
    'Cartucho': dict(c=(0.55, 0.035, 0.025), m=0.0, r=0.4),
    'Cinta': dict(c=(0.045, 0.040, 0.036), m=0.0, r=0.95),
    'Cobre': dict(c=(0.75, 0.32, 0.18), m=1.0, r=0.3),
    'Lente': dict(c=(0.010, 0.025, 0.045), m=0.0, r=0.04),
    'Rareza': dict(c=(0.20, 0.55, 1.0), m=0.0, r=0.35, e=1.6),
    'Ojiva': dict(c=(0.11, 0.13, 0.075), m=0.15, r=0.5),
    'Pintura': dict(c=(0.55, 0.05, 0.03), m=0.0, r=0.45),
}


def material(nombre):
    m = bpy.data.materials.get(nombre)
    p = PALETA[nombre]
    if not m:
        m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if not bsdf:
        nt.nodes.clear()
        bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
        out = nt.nodes.new('ShaderNodeOutputMaterial')
        nt.links.new(bsdf.outputs[0], out.inputs[0])
    col = (*p['c'], 1.0)
    bsdf.inputs['Base Color'].default_value = col
    bsdf.inputs['Metallic'].default_value = p['m']
    bsdf.inputs['Roughness'].default_value = p['r']
    if p.get('e'):
        bsdf.inputs['Emission Color'].default_value = col
        bsdf.inputs['Emission Strength'].default_value = p['e']
    else:
        bsdf.inputs['Emission Strength'].default_value = 0.0
    m.diffuse_color = col
    m.metallic = p['m']
    m.roughness = p['r']
    return m


# ---------------------------------------------------------------------------
# Geometría 2D
def redondear(pts, n=5):
    # pts: [(a, b) o (a, b, radio)] polígono cerrado; cada esquina con radio > 0 se vuelve un arco
    P = [Vector((p[0], p[1])) for p in pts]
    R = [p[2] if len(p) > 2 else 0.0 for p in pts]
    N = len(P)
    out = []
    for i in range(N):
        p, a, b, r = P[i], P[i - 1], P[(i + 1) % N], R[i]
        if r <= 0:
            out.append(p)
            continue
        u = (a - p).normalized()
        v = (b - p).normalized()
        ang = math.acos(max(-1.0, min(1.0, u.dot(v))))
        if ang < 1e-3 or ang > math.pi - 1e-3:
            out.append(p)
            continue
        t = min(r / math.tan(ang / 2), (a - p).length * 0.49, (b - p).length * 0.49)
        rr = t * math.tan(ang / 2)
        p1, p2 = p + u * t, p + v * t
        c = p + (u + v).normalized() * (rr / math.sin(ang / 2))
        a1 = math.atan2(p1.y - c.y, p1.x - c.x)
        a2 = math.atan2(p2.y - c.y, p2.x - c.x)
        d = (a2 - a1 + math.pi) % (2 * math.pi) - math.pi
        for k in range(n + 1):
            t2 = a1 + d * k / n
            out.append(Vector((c.x + rr * math.cos(t2), c.y + rr * math.sin(t2))))
    # sin puntos repetidos
    res = []
    for q in out:
        if not res or (q - res[-1]).length > 1e-6:
            res.append(q)
    if len(res) > 2 and (res[0] - res[-1]).length < 1e-6:
        res.pop()
    return res


def _a3(eje, a, b, h):
    # punto 3D desde coordenadas del plano (a, b) y altura h sobre el eje de extrusión
    if eje == 'x':
        return (h, a, b)
    if eje == 'y':
        return (a, h, b)
    return (a, b, h)


# ---------------------------------------------------------------------------
# Objetos
def _obj(nombre, bm, mat, col):
    me = bpy.data.meshes.new(nombre)
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    old = bpy.data.objects.get(nombre)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    ob = bpy.data.objects.new(nombre, me)
    col.objects.link(ob)
    if mat:
        me.materials.append(material(mat))
    return ob


def acabado(ob, bisel=0.002, segs=2, angulo=32, cortes=(), wn=True):
    for c in cortes:
        m = ob.modifiers.new('Corte', 'BOOLEAN')
        m.operation = 'DIFFERENCE'
        m.object = c
        m.solver = 'EXACT'
    if bisel > 0:
        b = ob.modifiers.new('Bisel', 'BEVEL')
        b.width = bisel
        b.segments = segs
        b.limit_method = 'ANGLE'
        b.angle_limit = math.radians(angulo)
        b.harden_normals = True
        b.use_clamp_overlap = True
        b.miter_outer = 'MITER_ARC'
    if wn:
        w = ob.modifiers.new('Normales', 'WEIGHTED_NORMAL')
        w.keep_sharp = True
        w.weight = 50
    return ob


def prisma(A, nombre, pts, a0, a1, mat, eje='x', n=5, bisel=0.002, segs=2, angulo=32, cortes=(), grupo='cuerpo',
           col=None, ahusar=None):
    # perfil 2D extruido de a0 a a1 sobre el eje. ahusar=(sa, sb): escala del perfil en a1 (para piezas que afinan)
    P = redondear(pts, n)
    bm = bmesh.new()
    lo = [bm.verts.new(_a3(eje, p.x, p.y, a0)) for p in P]
    if ahusar:
        cx = sum(p.x for p in P) / len(P)
        cy = sum(p.y for p in P) / len(P)
        hi = [bm.verts.new(_a3(eje, cx + (p.x - cx) * ahusar[0], cy + (p.y - cy) * ahusar[1], a1)) for p in P]
    else:
        hi = [bm.verts.new(_a3(eje, p.x, p.y, a1)) for p in P]
    bm.faces.new(lo[::-1])
    bm.faces.new(hi)
    N = len(P)
    for i in range(N):
        j = (i + 1) % N
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = _obj(nombre, bm, mat, col or A.col)
    acabado(ob, bisel, segs, angulo, cortes)
    if A and col is None:
        A.add(ob, grupo)
    return ob


def caja(A, nombre, c, t, mat, r=0.0, eje='x', **kw):
    # caja de centro c y tamaño t (x, y, z); r redondea las aristas paralelas al eje
    cx, cy, cz = c
    tx, ty, tz = t
    if eje == 'x':
        pts = [(cy - ty / 2, cz - tz / 2, r), (cy + ty / 2, cz - tz / 2, r), (cy + ty / 2, cz + tz / 2, r),
               (cy - ty / 2, cz + tz / 2, r)]
        return prisma(A, nombre, pts, cx - tx / 2, cx + tx / 2, mat, 'x', **kw)
    if eje == 'y':
        pts = [(cx - tx / 2, cz - tz / 2, r), (cx + tx / 2, cz - tz / 2, r), (cx + tx / 2, cz + tz / 2, r),
               (cx - tx / 2, cz + tz / 2, r)]
        return prisma(A, nombre, pts, cy - ty / 2, cy + ty / 2, mat, 'y', **kw)
    pts = [(cx - tx / 2, cy - ty / 2, r), (cx + tx / 2, cy - ty / 2, r), (cx + tx / 2, cy + ty / 2, r),
           (cx - tx / 2, cy + ty / 2, r)]
    return prisma(A, nombre, pts, cz - tz / 2, cz + tz / 2, mat, 'z', **kw)


def torno(A, nombre, perfil, mat, eje='y', centro=(0.0, 0.0), segs=28, fase=0.0, bisel=0.0012, angulo=32, cortes=(),
          grupo='cuerpo', col=None, tapas=True):
    # perfil: [(h, r)] a lo largo del eje; r = 0 cierra en punta. centro: posición del eje en el plano normal.
    bm = bmesh.new()
    anillos = []
    for h, r in perfil:
        if r <= 1e-7:
            anillos.append([bm.verts.new(_a3(eje, centro[0], centro[1], h))])
        else:
            anillos.append([bm.verts.new(_a3(eje, centro[0] + r * math.cos(fase + 2 * math.pi * k / segs),
                                              centro[1] + r * math.sin(fase + 2 * math.pi * k / segs), h))
                            for k in range(segs)])
    for A1, B1 in zip(anillos, anillos[1:]):
        if len(A1) == 1 and len(B1) == 1:
            continue
        if len(A1) == 1:
            for k in range(segs):
                bm.faces.new((A1[0], B1[k], B1[(k + 1) % segs]))
        elif len(B1) == 1:
            for k in range(segs):
                bm.faces.new((A1[k], B1[0], A1[(k + 1) % segs]))
        else:
            for k in range(segs):
                bm.faces.new((A1[k], B1[k], B1[(k + 1) % segs], A1[(k + 1) % segs]))
    if tapas:
        for anillo in (anillos[0], anillos[-1]):
            if len(anillo) > 2:
                bm.faces.new(anillo)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = _obj(nombre, bm, mat, col or A.col)
    acabado(ob, bisel, 2, angulo, cortes)
    if A and col is None:
        A.add(ob, grupo)
    return ob


def tubo(A, nombre, puntos, radio, mat, segs=12, bisel=0.0, grupo='cuerpo', col=None, paso=None, achatar=1.0):
    # barrido de un círculo (o elipse con achatar) por una polilínea suavizada (Catmull-Rom)
    P = [Vector(p) for p in puntos]
    if paso:
        Q = []
        for i in range(len(P) - 1):
            p0, p1, p2, p3 = P[max(i - 1, 0)], P[i], P[i + 1], P[min(i + 2, len(P) - 1)]
            n = max(2, int((p2 - p1).length / paso))
            for k in range(n):
                t = k / n
                t2, t3 = t * t, t * t * t
                Q.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                                (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
        Q.append(P[-1])
        P = Q
    bm = bmesh.new()
    anillos = []
    up = Vector((1, 0, 0))
    for i, p in enumerate(P):
        t = (P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized()
        if abs(t.dot(up)) > 0.95:
            up = Vector((0, 0, 1))
        n1 = t.cross(up).normalized()
        n2 = t.cross(n1).normalized()
        anillos.append([bm.verts.new(p + radio * (math.cos(2 * math.pi * k / segs) * n1 +
                                                     achatar * math.sin(2 * math.pi * k / segs) * n2))
                        for k in range(segs)])
    for A1, B1 in zip(anillos, anillos[1:]):
        for k in range(segs):
            bm.faces.new((A1[k], B1[k], B1[(k + 1) % segs], A1[(k + 1) % segs]))
    bm.faces.new(anillos[0])
    bm.faces.new(anillos[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = _obj(nombre, bm, mat, col or A.col)
    acabado(ob, bisel, 2, 40)
    if A and col is None:
        A.add(ob, grupo)
    return ob


# Cortadores (no se exportan): cajas, cilindros y series repetidas, todos en un solo objeto
def cortador(A, nombre, cajas=(), cilindros=()):
    # cajas: [(centro, tamaño, radio, eje)], cilindros: [(centro, radio, largo, eje)]
    bm = bmesh.new()
    for c, t, r, eje in cajas:
        tmp = bmesh.new()
        cx, cy, cz = c
        tx, ty, tz = t
        if eje == 'x':
            pts = [(cy - ty / 2, cz - tz / 2, r), (cy + ty / 2, cz - tz / 2, r), (cy + ty / 2, cz + tz / 2, r),
                   (cy - ty / 2, cz + tz / 2, r)]
            a0, a1 = cx - tx / 2, cx + tx / 2
        elif eje == 'y':
            pts = [(cx - tx / 2, cz - tz / 2, r), (cx + tx / 2, cz - tz / 2, r), (cx + tx / 2, cz + tz / 2, r),
                   (cx - tx / 2, cz + tz / 2, r)]
            a0, a1 = cy - ty / 2, cy + ty / 2
        else:
            pts = [(cx - tx / 2, cy - ty / 2, r), (cx + tx / 2, cy - ty / 2, r), (cx + tx / 2, cy + ty / 2, r),
                   (cx - tx / 2, cy + ty / 2, r)]
            a0, a1 = cz - tz / 2, cz + tz / 2
        P = redondear(pts, 4)
        lo = [bm.verts.new(_a3(eje, p.x, p.y, a0)) for p in P]
        hi = [bm.verts.new(_a3(eje, p.x, p.y, a1)) for p in P]
        bm.faces.new(lo[::-1])
        bm.faces.new(hi)
        for i in range(len(P)):
            j = (i + 1) % len(P)
            bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
        tmp.free()
    for c, r, largo, eje in cilindros:
        segs = 16
        a = {'x': 0, 'y': 1, 'z': 2}[eje]
        lo, hi = [], []
        for k in range(segs):
            t = 2 * math.pi * k / segs
            u, v = r * math.cos(t), r * math.sin(t)
            for lista, s in ((lo, -0.5), (hi, 0.5)):
                p = list(c)
                otros = [i for i in range(3) if i != a]
                p[otros[0]] += u
                p[otros[1]] += v
                p[a] += s * largo
                lista.append(bm.verts.new(p))
        bm.faces.new(lo[::-1])
        bm.faces.new(hi)
        for k in range(segs):
            j = (k + 1) % segs
            bm.faces.new((lo[k], lo[j], hi[j], hi[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = _obj('x_' + A.nombre + '_' + nombre, bm, None, A.cortes)
    ob.display_type = 'WIRE'
    ob.hide_render = True
    return ob


def serie(base, n, paso):
    # repite (centro, ...) n veces sumando paso al centro
    c, *resto = base
    return [((c[0] + paso[0] * i, c[1] + paso[1] * i, c[2] + paso[2] * i), *resto) for i in range(n)]


def espejo_x(lista):
    out = []
    for c, *resto in lista:
        out.append((c, *resto))
        out.append(((-c[0], c[1], c[2]), *resto))
    return out


# ---------------------------------------------------------------------------
# Piezas comunes
def riel(A, nombre, y0, y1, z, mat='Polimero', ancho=0.021, alto=0.0085, paso=0.0105, grupo='cuerpo'):
    # riel tipo picatinny: perfil en cola de milano con ranuras transversales
    w, h = ancho / 2, alto
    pts = [(-w * 0.62, z), (w * 0.62, z), (w * 0.62, z + h * 0.25), (w, z + h * 0.55), (w * 0.8, z + h),
           (-w * 0.8, z + h), (-w, z + h * 0.55), (-w * 0.62, z + h * 0.25)]
    n = int((y1 - y0 - 0.008) / paso)
    ys = [y0 + 0.004 + paso * (i + 0.5) + ((y1 - y0 - 0.008) - n * paso) / 2 for i in range(n)]
    cut = cortador(A, nombre, cajas=[((0, y, z + h * 0.78), (ancho * 1.2, paso * 0.45, h * 0.5), 0.0, 'x')
                                     for y in ys])
    return prisma(A, nombre, pts, y0, y1, mat, eje='y', n=0, bisel=0.0007, cortes=[cut], grupo=grupo)


def tornillo(A, nombre, c, eje='x', r=0.0035, alto=0.0016, mat='AceroOscuro', grupo='cuerpo', signo=1):
    h0 = {'x': c[0], 'y': c[1], 'z': c[2]}[eje]
    cen = {'x': (c[1], c[2]), 'y': (c[0], c[2]), 'z': (c[0], c[1])}[eje]
    s = signo
    perfil = [(h0 - s * 0.002, 0.0), (h0 - s * 0.002, r), (h0 + s * alto * 0.6, r), (h0 + s * alto, r * 0.7),
              (h0 + s * alto, 0.0)]
    if s < 0:
        perfil = perfil[::-1]
    return torno(A, nombre, perfil, mat, eje=eje, centro=cen, segs=10, bisel=0.0, grupo=grupo)


# ---------------------------------------------------------------------------
# Final: aplica modificadores, une el cuerpo y deja las partes móviles con su pivote, todo bajo un vacío raíz
def _evaluada(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
    me.transform(ob.matrix_world)
    return me


def finalizar(A, pivotes=None):
    # pivotes: {grupo: (x, y, z)} origen de cada parte móvil (para animarla)
    pivotes = pivotes or {}
    sc = escena()
    col = coleccion('exp_' + A.nombre)
    vaciar(col)
    raiz = bpy.data.objects.new(A.nombre, None)
    raiz.empty_display_size = 0.05
    col.objects.link(raiz)
    grupos = {}
    for ob, g in A.piezas:
        grupos.setdefault(g, []).append(ob)
    salida = {}
    for g, obs in grupos.items():
        bm = bmesh.new()
        mats = []
        for ob in obs:
            me = _evaluada(ob)
            for m in me.materials:
                if m and m.name not in mats:
                    mats.append(m.name)
            # reindexar materiales del trozo a la lista común
            remap = [mats.index(m.name) if m else 0 for m in me.materials] or [0]
            tmp = bmesh.new()
            tmp.from_mesh(me)
            for f in tmp.faces:
                f.material_index = remap[min(f.material_index, len(remap) - 1)]
            me2 = bpy.data.meshes.new('_tmp')
            tmp.to_mesh(me2)
            tmp.free()
            bm.from_mesh(me2)
            bpy.data.meshes.remove(me2)
            bpy.data.meshes.remove(me)
        nombre = A.nombre + ('_cuerpo' if g == 'cuerpo' else '_' + g)
        me = bpy.data.meshes.new(nombre)
        bm.to_mesh(me)
        bm.free()
        for mn in mats:
            me.materials.append(bpy.data.materials[mn])
        piv = Vector(pivotes.get(g, (0, 0, 0)))
        me.transform(Matrix.Translation(-piv))
        ob = bpy.data.objects.new(nombre, me)
        ob.location = piv
        col.objects.link(ob)
        ob.parent = raiz
        salida[g] = dict(tris=sum(len(p.vertices) - 2 for p in me.polygons), mats=mats)
    for n, p in A.puntos.items():
        e = bpy.data.objects.new(A.nombre + '_' + n, None)
        e.empty_display_size = 0.02
        e.location = p
        col.objects.link(e)
        e.parent = raiz
    col.hide_render = True
    return salida


# ---------------------------------------------------------------------------
# Fotos de revisión: estudio con HDRI de Blender, EEVEE
def estudio():
    sc = escena()
    w = sc.world or bpy.data.worlds.new('MundoArmas')
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    if not nt.nodes.get('HDRI'):
        nt.nodes.clear()
        tex = nt.nodes.new('ShaderNodeTexEnvironment')
        tex.name = 'HDRI'
        ruta = os.path.join(bpy.utils.system_resource('DATAFILES', path='studiolights/world'), 'studio.exr')
        if not os.path.exists(ruta):
            d = bpy.utils.system_resource('DATAFILES', path='studiolights/world')
            ruta = os.path.join(d, sorted(os.listdir(d))[0])
        tex.image = bpy.data.images.load(ruta, check_existing=True)
        bg = nt.nodes.new('ShaderNodeBackground')
        bg.name = 'Fondo'
        out = nt.nodes.new('ShaderNodeOutputWorld')
        nt.links.new(tex.outputs[0], bg.inputs[0])
        # la cámara ve un gris liso, los reflejos usan el HDRI
        lp = nt.nodes.new('ShaderNodeLightPath')
        mix = nt.nodes.new('ShaderNodeMixShader')
        bg2 = nt.nodes.new('ShaderNodeBackground')
        bg2.inputs[0].default_value = (0.32, 0.34, 0.37, 1)
        nt.links.new(lp.outputs['Is Camera Ray'], mix.inputs[0])
        nt.links.new(bg.outputs[0], mix.inputs[1])
        nt.links.new(bg2.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs[0])
    nt.nodes['Fondo'].inputs[1].default_value = 0.8
    for n, e, loc, rot, size in (('_LuzClave', 70, (1.2, -0.6, 1.3), (0.75, 0.0, 2.05), 1.0),
                                 ('_LuzBorde', 60, (-1.0, 1.4, 0.9), (-1.0, 0.0, 3.6), 0.8),
                                 ('_LuzRelleno', 30, (-1.4, -0.4, 0.3), (1.35, 0.0, -1.85), 1.5)):
        ob = bpy.data.objects.get(n)
        if not ob:
            ld = bpy.data.lights.new(n, 'AREA')
            ob = bpy.data.objects.new(n, ld)
            sc.collection.objects.link(ob)
        ob.data.energy = e
        ob.data.size = size
        ob.location = loc
        ob.rotation_euler = rot
    sc.render.engine = 'BLENDER_EEVEE'
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
    try:
        sc.eevee.taa_render_samples = 32
        sc.eevee.use_shadows = True
    except AttributeError:
        pass
    return sc


VISTAS = {
    'lado': ((math.radians(90), 0, math.radians(90)), None),          # desde +X (derecha del arma)
    'izq': ((math.radians(90), 0, math.radians(-90)), None),
    'arriba': ((0, 0, 0), None),
    'frente': ((math.radians(90), 0, math.radians(180)), None),
    'tres4': ((math.radians(72), 0, math.radians(125)), 50),
    'tres4b': ((math.radians(70), 0, math.radians(35)), 50),
    'atras': ((math.radians(78), 0, math.radians(-25)), 50),
}


def foto(A_nombre, vistas=('lado', 'tres4'), centro=(0, 0.25, 0.0), escala=1.1, res=(900, 520), solo=True,
         dist=2.2, final=False):
    sc = estudio()
    # mostrar solo el arma pedida: sus piezas (src_) o el resultado horneado (exp_)
    pref = 'exp_' if final else 'src_'
    for c in sc.collection.children:
        if c.name.startswith('src_') or c.name.startswith('exp_'):
            c.hide_render = c.name != pref + A_nombre if solo else not c.name.startswith(pref)
    cam = bpy.data.objects.get('_CamArmas')
    if not cam:
        cd = bpy.data.cameras.new('_CamArmas')
        cam = bpy.data.objects.new('_CamArmas', cd)
        sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.clip_start = 0.01
    r = sc.render
    r.resolution_x, r.resolution_y = res
    r.resolution_percentage = 100
    r.image_settings.file_format = 'JPEG'
    r.image_settings.quality = 90
    out = {}
    for i, v in enumerate(vistas):
        rot, lens = VISTAS.get(v, v) if isinstance(v, str) else v
        q = Matrix.Identity(3)
        from mathutils import Euler
        e = Euler(rot)
        fwd = e.to_quaternion() @ Vector((0, 0, -1))
        cam.rotation_euler = e
        if lens:
            cam.data.type = 'PERSP'
            cam.data.lens = lens
            cam.location = Vector(centro) - fwd * dist
        else:
            cam.data.type = 'ORTHO'
            cam.data.ortho_scale = escala
            cam.location = Vector(centro) - fwd * 3.0
        path = os.path.join(OUT, '_arma%d.jpg' % i)
        r.filepath = path
        bpy.ops.render.render(write_still=True)
        with open(path, 'rb') as f:
            out['b64%02d' % i] = base64.b64encode(f.read()).decode()
    out['pad'] = 'x' * 150000
    return out
