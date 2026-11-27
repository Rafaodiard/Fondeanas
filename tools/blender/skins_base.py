# Base para modelar por script los accesorios de las skins (public/models/skins.glb).
# Todo se arma con bmesh en el espacio del héroe (el mismo de public/models/personaje.glb): Z arriba, el héroe mira a
# -Y y su izquierda es +X. Los accesorios se exportan sin transformación (vértices en ese espacio) y el juego los cuelga
# de un hueso con la inversa de la pose de reposo de ese hueso (public/js/aspecto.js).
# Los picos van en el espacio del pico de armas.glb: el puño en el origen, el mango hacia +Z y la punta hacia +Y.
#   exec(open('skins_base.py').read()); exec(open('skins.py').read())
import bpy, bmesh, math, os, random
from mathutils import Vector, Matrix, Euler

# Materiales: el juego los tiñe por nombre con los colores de cada skin (A principal, B secundario, C detalle oscuro, D otro detalle,
# Ojo blanco de los ojos, Luz emisivo, Metal metálico, Vidrio visor). Acá quedan con un color de muestra.
PALETA = {
    'A': dict(c=(0.55, 0.12, 0.06), m=0.0, r=0.6),
    'B': dict(c=(0.80, 0.78, 0.72), m=0.0, r=0.6),
    'C': dict(c=(0.02, 0.02, 0.025), m=0.0, r=0.5),
    'D': dict(c=(0.85, 0.55, 0.08), m=0.0, r=0.5),
    'Ojo': dict(c=(0.85, 0.85, 0.82), m=0.0, r=0.25),
    'Luz': dict(c=(0.3, 0.9, 1.0), m=0.0, r=0.4, e=3.0),
    'Metal': dict(c=(0.62, 0.62, 0.64), m=1.0, r=0.3),
    'Vidrio': dict(c=(0.03, 0.05, 0.08), m=0.2, r=0.06),
}


def material(nombre):
    m = bpy.data.materials.get(nombre) or bpy.data.materials.new(nombre)
    p = PALETA[nombre]
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    col = (*p['c'], 1.0)
    bsdf.inputs['Base Color'].default_value = col
    bsdf.inputs['Metallic'].default_value = p['m']
    bsdf.inputs['Roughness'].default_value = p['r']
    if p.get('e'):
        bsdf.inputs['Emission Color'].default_value = col
        bsdf.inputs['Emission Strength'].default_value = p['e']
    m.diffuse_color = col
    return m


def R(*g):
    return Euler([math.radians(a) for a in g], 'XYZ')


def M(loc=(0, 0, 0), rot=(0, 0, 0), esc=1.0):
    if not hasattr(esc, '__len__'):
        esc = (esc, esc, esc)
    return Matrix.LocRotScale(Vector(loc), R(*rot), Vector(esc))


# ---------------------------------------------------------------------------
# Piezas: cada función devuelve un "trozo" = (bmesh, material, suavizado). Al final se juntan en un objeto.
class Pieza:
    def __init__(self, bm, mat, liso=True, sub=0):
        self.bm, self.mat, self.liso, self.sub = bm, mat, liso, sub

    def tr(self, m):
        bmesh.ops.transform(self.bm, matrix=m, verts=self.bm.verts)
        return self

    def mover(self, loc=(0, 0, 0), rot=(0, 0, 0), esc=1.0):
        return self.tr(M(loc, rot, esc))

    def deformar(self, f):
        # f(Vector) -> Vector
        for v in self.bm.verts:
            v.co = f(v.co.copy())
        return self

    def copia(self):
        return Pieza(self.bm.copy(), self.mat, self.liso, self.sub)

    def espejo_x(self):
        c = self.copia()
        c.tr(Matrix.Scale(-1, 4, (1, 0, 0)))
        bmesh.ops.reverse_faces(c.bm, faces=c.bm.faces)
        return c


def esfera(mat, loc=(0, 0, 0), r=1.0, rot=(0, 0, 0), seg=28, anillos=16, liso=True, sub=0):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=anillos, radius=1.0)
    return Pieza(bm, mat, liso, sub).mover(loc, rot, r)


def caja(mat, loc=(0, 0, 0), tam=(1, 1, 1), rot=(0, 0, 0), bisel=0.0, liso=False, sub=0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(tam), verts=bm.verts)
    if bisel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges) + list(bm.verts), offset=bisel, segments=3, affect='EDGES', profile=0.5)
        liso = True
    return Pieza(bm, mat, liso, sub).mover(loc, rot)


def cilindro(mat, loc=(0, 0, 0), r1=1.0, r2=None, alto=1.0, rot=(0, 0, 0), seg=28, liso=True, tapas=True, esc=1.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=tapas, cap_tris=False, segments=seg, radius1=r1, radius2=r1 if r2 is None else r2, depth=alto)
    p = Pieza(bm, mat, liso)
    if hasattr(esc, '__len__') or esc != 1.0:
        p.tr(M(esc=esc))
    return p.mover(loc, rot)


def toro(mat, loc=(0, 0, 0), R_=1.0, r=0.1, rot=(0, 0, 0), seg=32, seg2=12, esc=1.0):
    bm = bmesh.new()
    filas = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        fila = []
        for j in range(seg2):
            b = 2 * math.pi * j / seg2
            rr = R_ + r * math.cos(b)
            fila.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), r * math.sin(b))))
        filas.append(fila)
    for i in range(seg):
        for j in range(seg2):
            a, b = filas[i], filas[(i + 1) % seg]
            bm.faces.new((a[j], b[j], b[(j + 1) % seg2], a[(j + 1) % seg2]))
    p = Pieza(bm, mat, True)
    if hasattr(esc, '__len__') or esc != 1.0:
        p.tr(M(esc=esc))
    return p.mover(loc, rot)


def torno(mat, perfil, loc=(0, 0, 0), rot=(0, 0, 0), esc=1.0, seg=40, f=None, a0=0.0, a1=None, liso=True, sub=0):
    # perfil: [(radio, z)] de abajo hacia arriba; radio 0 = polo. f(angulo, radio, z) -> radio (para lóbulos, picos...)
    # a0..a1: arco parcial (en radianes); sin a1 da la vuelta entera.
    bm = bmesh.new()
    cerrado = a1 is None
    n = seg if cerrado else seg + 1
    a1 = a1 if a1 is not None else 2 * math.pi
    anillos = []
    for (r, z) in perfil:
        if r < 1e-6 and cerrado:
            anillos.append([bm.verts.new((0, 0, z))])
            continue
        anillo = []
        for i in range(n):
            a = a0 + (a1 - a0) * i / seg
            rr = f(a, r, z) if f else r
            anillo.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), z)))
        anillos.append(anillo)
    for k in range(len(anillos) - 1):
        A, B = anillos[k], anillos[k + 1]
        for i in range(seg):
            i2 = (i + 1) % n if cerrado else i + 1
            if len(A) == 1:
                bm.faces.new((A[0], B[i], B[i2]))
            elif len(B) == 1:
                bm.faces.new((A[i], A[i2], B[0]))
            else:
                bm.faces.new((A[i], A[i2], B[i2], B[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return Pieza(bm, mat, liso, sub).mover(loc, rot, esc)


def tubo(mat, pts, radio, seg=14, tapas=True, liso=True, achatar=1.0, sub=0):
    # barre un círculo por una polilínea (radio: número o lista por punto)
    pts = [Vector(p) for p in pts]
    rs = radio if hasattr(radio, '__len__') else [radio] * len(pts)
    bm = bmesh.new()
    anillos = []
    normal = None
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        if normal is None:
            ref = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
            normal = (ref - t * ref.dot(t)).normalized()
        else:
            normal = (normal - t * normal.dot(t)).normalized()
        bi = t.cross(normal)
        anillo = []
        for j in range(seg):
            a = 2 * math.pi * j / seg
            anillo.append(bm.verts.new(p + (normal * math.cos(a) * achatar + bi * math.sin(a)) * max(rs[i], 1e-4)))
        anillos.append(anillo)
    for k in range(len(anillos) - 1):
        A, B = anillos[k], anillos[k + 1]
        for j in range(seg):
            bm.faces.new((A[j], A[(j + 1) % seg], B[(j + 1) % seg], B[j]))
    if tapas:
        bm.faces.new(list(reversed(anillos[0])))
        bm.faces.new(anillos[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return Pieza(bm, mat, liso, sub)


def placa(mat, poli, grosor, loc=(0, 0, 0), rot=(0, 0, 0), bisel=0.0, liso=False, sub=0, esc=1.0):
    # polígono en el plano XZ (puntos (x, z)), extruido en Y con el grosor dado (centrado)
    bm = bmesh.new()
    vs = [bm.verts.new((x, -grosor / 2, z)) for (x, z) in poli]
    cara = bm.faces.new(vs)
    r = bmesh.ops.extrude_face_region(bm, geom=[cara])
    nuevos = [e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, grosor, 0), verts=nuevos)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if bisel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bisel, segments=2, affect='EDGES', profile=0.5, clamp_overlap=True)
    return Pieza(bm, mat, liso, sub).mover(loc, rot, esc)


def cono(mat, loc, r, alto, rot=(0, 0, 0), seg=16, liso=True):
    return cilindro(mat, loc, r, 0.0, alto, rot, seg, liso)


def arco(c, r, a0, a1, n, eje='xz'):
    # puntos de un arco (grados) en un plano
    out = []
    for i in range(n + 1):
        a = math.radians(a0 + (a1 - a0) * i / n)
        u, v = r * math.cos(a), r * math.sin(a)
        if eje == 'xz':
            out.append((c[0] + u, c[1], c[2] + v))
        elif eje == 'yz':
            out.append((c[0], c[1] + u, c[2] + v))
        else:
            out.append((c[0] + u, c[1] + v, c[2]))
    return out


def curva(pts, n=24):
    # Catmull-Rom por los puntos de control
    P = [Vector(p) for p in pts]
    out = []
    for i in range(len(P) - 1):
        p0, p1, p2, p3 = P[max(i - 1, 0)], P[i], P[i + 1], P[min(i + 2, len(P) - 1)]
        k = max(2, n // (len(P) - 1))
        for j in range(k):
            t = j / k
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-1])
    return out


def cuerno(mat, base, dir_, largo, r0, curva_=(0, 0, 0), n=14, seg=12):
    # cono curvado: va de base en la dirección dir_ y se dobla hacia curva_
    base, d, cv = Vector(base), Vector(dir_).normalized(), Vector(curva_)
    pts, rs = [], []
    for i in range(n + 1):
        t = i / n
        pts.append(base + d * largo * t + cv * (t * t))
        rs.append(r0 * (1 - t) ** 0.9 + 0.0008)
    return tubo(mat, pts, rs, seg=seg)


def oreja(mat, base, alto, ancho, grosor, rot, punta=1.0):
    # oreja triangular redondeada (gato, zorro, lobo): placa con la punta arriba
    poli = [(-ancho / 2, 0), (-ancho * 0.28, alto * 0.62), (-ancho * 0.08 * punta, alto * 0.97), (0, alto), (ancho * 0.08 * punta, alto * 0.97),
            (ancho * 0.28, alto * 0.62), (ancho / 2, 0)]
    return placa(mat, poli, grosor, bisel=grosor * 0.35).mover(base, rot)


# ---------------------------------------------------------------------------
# Juntar piezas en un objeto con sus materiales y exportar
COL = None


def coleccion():
    global COL
    COL = bpy.data.collections.get('Skins') or bpy.data.collections.new('Skins')
    if COL.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(COL)
    return COL


def objeto(nombre, piezas):
    old = bpy.data.objects.get(nombre)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    me = bpy.data.meshes.new(nombre)
    bm = bmesh.new()
    mats = []
    for p in piezas:
        if p.sub:
            bmesh.ops.subdivide_edges(p.bm, edges=p.bm.edges, cuts=1, use_grid_fill=True, smooth=1.0)
        if p.mat not in mats:
            mats.append(p.mat)
        mi = mats.index(p.mat)
        tmp = bpy.data.meshes.new('tmp')
        p.bm.to_mesh(tmp)
        for poly in tmp.polygons:
            poly.material_index = mi
            poly.use_smooth = p.liso
        bm.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(material(m))
    ob = bpy.data.objects.new(nombre, me)
    coleccion().objects.link(ob)
    return ob


def exportar(ruta, nombres):
    for o in bpy.data.objects:
        o.select_set(False)
    for n in nombres:
        bpy.data.objects[n].select_set(True)
    bpy.context.view_layer.objects.active = bpy.data.objects[nombres[0]]
    bpy.ops.export_scene.gltf(filepath=ruta, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                              export_animations=False, export_materials='EXPORT', export_extras=False)
    return os.path.getsize(ruta)
