# Herramientas para modelar el personaje de Salto Final en Blender por script.
# Se carga con: exec(open(r"C:\Users\rafae\SaltoFinal_modelos\sf_tools.py").read())
import bpy, bmesh, builtins, math, base64, os
import numpy as np
from mathutils import Vector, Euler, Matrix

OUT = r"C:\Users\rafae\SaltoFinal_modelos"


def ss(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0), 1)
    return t * t * (3 - 2 * t)


def get_co(ob):
    n = len(ob.data.vertices)
    a = np.empty(n * 3, dtype=np.float64)
    ob.data.vertices.foreach_get('co', a)
    return a.reshape(n, 3)


def set_co(ob, co):
    ob.data.vertices.foreach_set('co', co.astype(np.float64).ravel())
    ob.data.update()


def falloff(co, c, r):
    r = np.array(r if hasattr(r, '__len__') else (r, r, r), dtype=float)
    d = np.linalg.norm((co - np.array(c)) / r, axis=1)
    t = np.clip(1 - d, 0, 1)
    return t * t * (3 - 2 * t)


def grab(ob, c, r, off):
    co = get_co(ob)
    w = falloff(co, c, r)
    co += w[:, None] * np.array(off)
    set_co(ob, co)


def coll():
    c = bpy.data.collections.get('HeroeCol')
    if not c:
        c = bpy.data.collections.new('HeroeCol')
        bpy.context.scene.collection.children.link(c)
    return c


def new_obj(name, me, col=None):
    old = bpy.data.objects.get(name)
    if old:
        bpy.data.objects.remove(old)
    ob = bpy.data.objects.new(name, me)
    (col or coll()).objects.link(ob)
    return ob


def material(name, color, rough=0.7, metal=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = color
    m.roughness = rough
    m.metallic = metal
    return m


def arm_t(c):
    sx = 1 if c.x > 0 else -1
    S = Vector((sx * 0.205, 0.025, 1.445))
    E = Vector((sx * 0.315, 0.0, 1.19))
    d = E - S
    t = (c - S).dot(d) / d.length_squared
    perp = (c - (S + d * t)).length
    return t, perp


def hand_proj(c):
    sx = 1 if c.x > 0 else -1
    W = Vector((sx * 0.412, -0.07, 0.955))
    M = Vector((sx * 0.471, -0.126, 0.87))
    d = M - W
    return (c - W).dot(d) / d.length


def pants_off(co):
    z = co.z
    o = 0.012 + 0.014 * (1 - ss(0.95, 1.04, z))
    o += 0.012 * (1 - ss(0.28, 0.40, z))
    o += 0.006 * math.exp(-((z - 0.55) / 0.05) ** 2)
    return o


def _lap(bm, iters, fac, wfn=None, taubin=False):
    for it in range(iters * (2 if taubin else 1)):
        f = fac if (not taubin or it % 2 == 0) else -fac * 1.04
        new = {}
        for v in bm.verts:
            nb = [e.other_vert(v).co for e in v.link_edges if (e.is_boundary or not v.is_boundary)]
            if not nb:
                continue
            w = f * (wfn(v.co) if wfn else 1)
            if w == 0:
                continue
            avg = sum(nb, Vector()) / len(nb)
            new[v] = v.co + (avg - v.co) * w
        for v, c in new.items():
            v.co = c


def garment(name, mask_fn, offset_fn, cuts=(), smooth=6, smooth_fac=0.5, color=(0.5, 0.5, 0.5, 1),
            extra_smooth=None, src='Cuerpo', post_smooth=2, taubin=False, mat=None):
    """Prenda a partir de la malla base del cuerpo: selecciona caras, suaviza, infla y recorta con planos."""
    body = bpy.data.objects[src]
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bm.normal_update()
    dele = [f for f in bm.faces if not mask_fn(f.calc_center_median(), f.normal)]
    bmesh.ops.delete(bm, geom=dele, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    _lap(bm, smooth, smooth_fac, taubin=taubin)
    if extra_smooth:
        _lap(bm, *extra_smooth, taubin=taubin)
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * offset_fn(v.co)
    _lap(bm, post_smooth, 0.3)
    for (pco, pno, region) in cuts:
        vs = [v for v in bm.verts if region(v.co)]
        vset = set(vs)
        es = [e for e in bm.edges if e.verts[0] in vset or e.verts[1] in vset]
        fs = [f for f in bm.faces if any(v in vset for v in f.verts)]
        bmesh.ops.bisect_plane(bm, geom=vs + es + fs, plane_co=Vector(pco), plane_no=Vector(pno).normalized(),
                               clear_outer=True, dist=1e-5)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=0.0025)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = new_obj(name, me)
    me.materials.append(mat or material('M_' + name, color))
    return ob


def loft_mesh(name, sections, closed_ends=True):
    N = len(sections[0])
    verts = [tuple(p) for s in sections for p in s]
    faces = []
    for i in range(len(sections) - 1):
        for k in range(N):
            a = i * N + k
            b = i * N + (k + 1) % N
            faces.append((a, b, b + N, a + N))
    if closed_ends:
        faces.append(tuple(range(N))[::-1])
        faces.append(tuple(range((len(sections) - 1) * N, len(sections) * N)))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate()
    return new_obj(name, me)


def superellipse(center, rx, ry, n, axis_u, axis_v, N=32):
    pts = []
    for k in range(N):
        a = 2 * math.pi * k / N
        c, s = math.cos(a), math.sin(a)
        u = math.copysign(abs(c) ** (2 / n), c) * rx
        v = math.copysign(abs(s) ** (2 / n), s) * ry
        pts.append(Vector(center) + Vector(axis_u) * u + Vector(axis_v) * v)
    return pts


def apply_mods(ob, keep=()):
    """Aplica los modificadores sin bpy.ops (más estable desde el servidor MCP)."""
    dg = bpy.context.evaluated_depsgraph_get()
    saved = [(m.name, m.show_viewport) for m in ob.modifiers]
    for m in ob.modifiers:
        if m.name in keep:
            m.show_viewport = False
    dg.update()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    for m in list(ob.modifiers):
        if m.name not in keep:
            ob.modifiers.remove(m)
        else:
            m.show_viewport = True
    old = ob.data
    ob.data = me
    me.name = ob.name
    if old.users == 0:
        bpy.data.meshes.remove(old)
    return ob


def join_meshes(name, objs):
    """Une varias mallas en una nueva (sin bpy.ops)."""
    bm = bmesh.new()
    mats = []
    for o in objs:
        me = o.data.copy()
        me.transform(o.matrix_world)
        offs = len(mats)
        for m in me.materials:
            mats.append(m)
        for p in me.polygons:
            p.material_index += offs
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    out = bpy.data.meshes.new(name)
    bm.to_mesh(out)
    bm.free()
    for m in mats:
        out.materials.append(m)
    for o in objs:
        bpy.data.objects.remove(o)
    return new_obj(name, out)


def voxel(ob, size=0.004, smooth_iter=6, dec=None):
    r = ob.modifiers.new('Remesh', 'REMESH')
    r.mode = 'VOXEL'
    r.voxel_size = size
    r.adaptivity = 0
    if smooth_iter:
        s = ob.modifiers.new('Suave', 'CORRECTIVE_SMOOTH')
        s.iterations = smooth_iter
        s.use_only_smooth = True
    if dec:
        d = ob.modifiers.new('Dec', 'DECIMATE')
        d.ratio = dec
    apply_mods(ob)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def render_view(center, ortho_scale, rot=(math.pi / 2, 0, 0), res=(1000, 1000), matcap=None,
                path=OUT + r"\_vista.jpg", engine='BLENDER_WORKBENCH', xray=False, lens=None, cam_dist=6.0):
    sc = bpy.context.scene
    cam = bpy.data.objects.get('_CamVista')
    if not cam:
        cd = bpy.data.cameras.new('_CamVista')
        cam = bpy.data.objects.new('_CamVista', cd)
        sc.collection.objects.link(cam)
    cam.data.clip_end = 100
    cam.data.clip_start = 0.01
    q = Euler(rot).to_quaternion()
    fwd = q @ Vector((0, 0, -1))
    cam.rotation_euler = Euler(rot)
    cam.location = Vector(center) - fwd * cam_dist
    if lens:
        cam.data.type = 'PERSP'
        cam.data.lens = lens
    else:
        cam.data.type = 'ORTHO'
        cam.data.ortho_scale = ortho_scale
    sc.camera = cam
    r = sc.render
    r.engine = engine
    r.resolution_x, r.resolution_y = res
    r.resolution_percentage = 100
    r.image_settings.file_format = 'JPEG'
    r.image_settings.quality = 88
    if engine == 'BLENDER_WORKBENCH':
        d = sc.display.shading
        if matcap:
            d.light = 'MATCAP'
            d.studio_light = matcap
            d.color_type = 'SINGLE'
        else:
            d.light = 'STUDIO'
            d.color_type = 'MATERIAL'
        d.show_xray = xray
        d.show_cavity = True
        d.cavity_type = 'WORLD'
        sc.display.render_aa = '8'
    r.filepath = path
    bpy.ops.render.render(write_still=True)
    with open(path, 'rb') as f:
        return base64.b64encode(f.read()).decode()


VIEWS = {'FRONT': (math.pi / 2, 0, 0), 'RIGHT': (math.pi / 2, 0, math.pi / 2), 'LEFT': (math.pi / 2, 0, -math.pi / 2),
         'BACK': (math.pi / 2, 0, math.pi), '34': (math.radians(80), 0, math.radians(30)),
         '34L': (math.radians(80), 0, math.radians(-35)), '34B': (math.radians(80), 0, math.radians(150))}


def shot(center, ortho_scale, view='FRONT', res=(800, 1000), **kw):
    rot = VIEWS.get(view, view)
    d = render_view(center, ortho_scale, rot=rot, res=res, **kw)
    return {'b64': d, 'pad': 'x' * 150000}


def save():
    bpy.ops.wm.save_mainfile()


builtins.SF = type('SF', (), {k: staticmethod(v) if callable(v) else v for k, v in dict(globals()).items()
                               if not k.startswith('__') and k not in ('bpy', 'bmesh', 'builtins', 'math', 'base64', 'os', 'np',
                                                                       'Vector', 'Euler', 'Matrix')})


# ---------------------------------------------------------------------------
# Cortes por campo escalar: bordes limpios de cualquier forma (escotes, sisas, puños).
def iso_cut(bm, f):
    # Corta la malla por la isolinea f(co)=0 y borra el lado f>0, interpolando de verdad sobre cada arista.
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    val = {}
    for v in bm.verts:
        x = f(v.co)
        val[v] = x if abs(x) > 1e-9 else -1e-9
    newv = set()
    for e in list(bm.edges):
        a, b = e.verts
        fa, fb = val[a], val[b]
        if (fa > 0) != (fb > 0):
            ne, nv = bmesh.utils.edge_split(e, a, fa / (fa - fb))
            val[nv] = 0.0
            newv.add(nv)
    for fc in list(bm.faces):
        vs = [v for v in fc.verts if v in newv]
        if len(vs) == 2 and not any(e.other_vert(vs[0]) is vs[1] for e in vs[0].link_edges):
            bmesh.utils.face_split(fc, vs[0], vs[1])
    bmesh.ops.delete(bm, geom=[fc for fc in bm.faces if max(val.get(v, 0) for v in fc.verts) > 0], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bmesh.ops.join_triangles(bm, faces=bm.faces[:], angle_face_threshold=math.radians(40),
                             angle_shape_threshold=math.radians(40))


def fmax(*fs):
    return lambda c: max(g(c) for g in fs)


def fmin(*fs):
    return lambda c: min(g(c) for g in fs)


def clean_border(bm, merge=0.0045, rings=2, iters=4):
    # Junta segmentos cortitos del borde y relaja una franja alrededor para que el canto quede parejo.
    bnd = [v for v in bm.verts if v.is_boundary]
    bmesh.ops.remove_doubles(bm, verts=bnd, dist=merge)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges[:], dist=merge * 0.35)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    for _ in range(3):  # orejas: caras colgando de un solo vértice en el borde
        ears = [v for v in bm.verts if v.is_boundary and len(v.link_faces) == 1]
        if not ears:
            break
        bmesh.ops.delete(bm, geom=ears, context='VERTS')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    band = set(v for v in bm.verts if v.is_boundary)
    ring = set(band)
    for _ in range(rings):
        ring = set(e.other_vert(v) for v in ring for e in v.link_edges) - band
        band |= ring
    for _ in range(iters):
        new = {}
        for v in band:
            if v.is_boundary:
                nb = [e.other_vert(v).co for e in v.link_edges if e.is_boundary]
                if len(nb) == 2:
                    new[v] = v.co * 0.5 + (nb[0] + nb[1]) * 0.25
            else:
                nb = [e.other_vert(v).co for e in v.link_edges]
                new[v] = v.co * 0.4 + sum(nb, Vector()) / len(nb) * 0.6
        for v, c in new.items():
            v.co = c


def garment2(name, mask_fn, offset_fn, field=None, smooth=6, smooth_fac=0.5, subdiv=1, src='Cuerpo',
             post_smooth=2, mat=None, color=(0.5, 0.5, 0.5, 1), edge_smooth=3):
    # Como garment() pero el borde lo define un campo escalar (field(co) > 0 se borra).
    body = bpy.data.objects[src]
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bm.normal_update()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not mask_fn(f.calc_center_median(), f.normal)], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    _lap(bm, smooth, smooth_fac)
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * offset_fn(v.co)
    _lap(bm, post_smooth, 0.3)
    for _ in range(subdiv):
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=True, smooth=1.0)
    if field:
        iso_cut(bm, field)
        clean_border(bm, iters=edge_smooth)
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=0.0008)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = new_obj(name, me)
    ob.data.materials.append(mat or material('M_' + name, color))
    return ob


def add_mods(ob, thick=0.012, levels=2, offset=1.0, rim=True, even=False):
    s = ob.modifiers.new('Grosor', 'SOLIDIFY')
    s.thickness = thick
    s.offset = offset
    s.use_rim = rim
    s.use_even_offset = even
    s.use_quality_normals = True
    if levels:
        d = ob.modifiers.new('Sub', 'SUBSURF')
        d.levels = levels
        d.render_levels = levels
    return ob


def border_loops(ob, min_len=6):
    # Lazos de borde (aristas abiertas) de una malla: lista de [(co, normal), ...] en coords de mundo.
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.transform(ob.matrix_world)
    bm.normal_update()
    edges = set(e for e in bm.edges if e.is_boundary)
    loops = []
    while edges:
        e0 = edges.pop()
        chain = [e0.verts[0], e0.verts[1]]
        while True:
            v = chain[-1]
            nxt = [e for e in v.link_edges if e in edges]
            if not nxt:
                break
            e = nxt[0]
            edges.discard(e)
            w = e.other_vert(v)
            if w is chain[0]:
                break
            chain.append(w)
        if len(chain) >= min_len:
            loops.append([(v.co.copy(), v.normal.copy()) for v in chain])
    bm.free()
    return loops


def tube(name, pts, radius, mat=None, closed=True, res=6, color=(0.2, 0.2, 0.2, 1), smooth_iters=2):
    # Tubo (vivo, ribete, correa redonda) a lo largo de una polilínea.
    pts = [Vector(p) for p in pts]
    for _ in range(smooth_iters):
        n = len(pts)
        pts = [(pts[(k - 1) % n] + pts[k] * 2 + pts[(k + 1) % n]) / 4 if (closed or 0 < k < n - 1) else pts[k]
               for k in range(n)]
    cu = bpy.data.curves.new(name + '_cu', 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = max(1, res // 2 - 1)
    cu.use_fill_caps = True
    sp = cu.splines.new('POLY')
    sp.points.add(len(pts) - 1)
    for k, p in enumerate(pts):
        sp.points[k].co = (p.x, p.y, p.z, 1)
    sp.use_cyclic_u = closed
    tmp = bpy.data.objects.new(name + '_tmp', cu)
    coll().objects.link(tmp)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp)
    bpy.data.curves.remove(cu)
    for p in me.polygons:
        p.use_smooth = True
    ob = new_obj(name, me)
    ob.data.materials.append(mat or material('M_' + name, color))
    return ob


def trims(ob, name, radius, mat=None, thick=0.0, select=None, out=0.0):
    # Ribetes en todos los bordes abiertos de una prenda (centrados en el espesor del solidify).
    objs = []
    for k, lp in enumerate(border_loops(ob)):
        c = sum((p for p, n in lp), Vector()) / len(lp)
        if select and not select(c, lp):
            continue
        pts = [p + n * (thick * 0.5 + out) for p, n in lp]
        objs.append(tube('%s_%d' % (name, k), pts, radius, mat=mat))
    if not objs:
        return None
    return join_meshes(name, objs) if len(objs) > 1 else objs[0]


def surface_bvh(objs):
    # BVH (en coords de mundo) de una o varias mallas evaluadas, para proyectar piezas sobre la ropa.
    from mathutils.bvhtree import BVHTree
    objs = objs if isinstance(objs, (list, tuple)) else [objs]
    dg = bpy.context.evaluated_depsgraph_get()
    bm = bmesh.new()
    for o in objs:
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        me.transform(o.matrix_world)
        bm.from_mesh(me)
        ev.to_mesh_clear()
    bvh = BVHTree.FromBMesh(bm)
    bm.free()
    return bvh


def _frame(bvh, center, up):
    loc, nrm, i, d = bvh.find_nearest(Vector(center))
    n0 = nrm.normalized()
    up = Vector(up)
    v = (up - n0 * up.dot(n0)).normalized()
    u = v.cross(n0)
    return loc, n0, u, v


def _cast(bvh, P0, n0, smooth_n=0.5):
    hit = bvh.ray_cast(P0, -n0, 0.4)
    if hit[0] is None:
        hit = bvh.find_nearest(P0)
    H, N = hit[0], hit[1].normalized()
    return H, (N * (1 - smooth_n) + n0 * smooth_n).normalized()


def patch(name, targets, center, up, size, thick=0.012, gap=0.002, exp=4.0, rings=7, N=40, puff=0.65,
          seam=0.0015, mat=None, color=(0.5, 0.5, 0.5, 1), levels=2, bvh=None, depth=0.10, shape=None):
    # Pieza acolchada (bolsillo, tapa, rodillera, parche) proyectada sobre la superficie de 'targets'.
    bvh = bvh or surface_bvh(targets)
    loc, n0, u, v = _frame(bvh, center, up)
    w, h = size
    ss_ = [k / rings for k in range(1, rings + 1)]
    if seam:
        ss_ = sorted(set(ss_ + [0.86, 0.9, 0.94]))
    def outline(k):
        a = 2 * math.pi * k / N
        c_, s_ = math.cos(a), math.sin(a)
        x = math.copysign(abs(c_) ** (2 / exp), c_) * w / 2
        y = math.copysign(abs(s_) ** (2 / exp), s_) * h / 2
        if shape:
            x, y = shape(x, y)
        return x, y
    ol = [outline(k) for k in range(N)]
    verts, top_idx, bot_idx = [], [], []
    def add(P):
        verts.append(P)
        return len(verts) - 1
    H, Nn = _cast(bvh, loc + n0 * depth, n0)
    tc = add(H + Nn * (gap + thick))
    bc = add(H + Nn * gap)
    for sv in ss_:
        prof = (1 - puff) + puff * max(0.0, 1 - sv ** 4) ** 0.5
        if seam and abs(sv - 0.9) < 1e-6:
            prof -= seam / thick
        tr, br = [], []
        for (x, y) in ol:
            P0 = loc + u * (x * sv) + v * (y * sv) + n0 * depth
            H, Nn = _cast(bvh, P0, n0)
            tr.append(add(H + Nn * (gap + thick * prof)))
            br.append(add(H + Nn * gap))
        top_idx.append(tr)
        bot_idx.append(br)
    faces = []
    for k in range(N):
        k2 = (k + 1) % N
        faces.append((tc, top_idx[0][k], top_idx[0][k2]))
        faces.append((bc, bot_idx[0][k2], bot_idx[0][k]))
        for r in range(len(ss_) - 1):
            faces.append((top_idx[r][k], top_idx[r + 1][k], top_idx[r + 1][k2], top_idx[r][k2]))
            faces.append((bot_idx[r][k2], bot_idx[r + 1][k2], bot_idx[r + 1][k], bot_idx[r][k]))
        faces.append((top_idx[-1][k], bot_idx[-1][k], bot_idx[-1][k2], top_idx[-1][k2]))
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(p) for p in verts], [], faces)
    me.validate()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = new_obj(name, me)
    ob.data.materials.append(mat or material('M_' + name, color))
    if levels:
        d = ob.modifiers.new('Sub', 'SUBSURF')
        d.levels = levels
        d.render_levels = levels
    return ob


def _catmull(path, step):
    P = [Vector(p) for p in path]
    P = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        n = max(2, int((p2 - p1).length / step))
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-2])
    return out


def strap(name, targets, path, width=0.035, thick=0.004, gap=0.003, mat=None, color=(0.1, 0.1, 0.1, 1),
          bvh=None, step=0.01, smooth=3, sec=10, exp=6.0, project=True):
    # Correa plana que sigue la superficie: 'path' son puntos de control aproximados.
    bvh = bvh or surface_bvh(targets)
    pts = _catmull(path, step)
    base, nors = [], []
    for p in pts:
        if project:
            loc, nrm, i, d = bvh.find_nearest(p)
            base.append(loc)
            nors.append(nrm.normalized())
        else:
            base.append(p)
            nors.append(None)
    for _ in range(smooth):
        base = [base[0]] + [(base[k - 1] + base[k] * 2 + base[k + 1]) / 4 for k in range(1, len(base) - 1)] + [base[-1]]
        nors = [nors[0]] + [((nors[k - 1] + nors[k] * 2 + nors[k + 1]) / 4).normalized() if nors[k] else None
                            for k in range(1, len(nors) - 1)] + [nors[-1]]
    sections = []
    for k, P in enumerate(base):
        t = (base[min(k + 1, len(base) - 1)] - base[max(k - 1, 0)]).normalized()
        n = nors[k] if nors[k] else Vector((0, 0, 1))
        sd = t.cross(n).normalized()
        n = sd.cross(t).normalized()
        C = P + n * (gap + thick / 2)
        sections.append(superellipse(C, width / 2, thick / 2, exp, sd, n, N=sec))
    ob = loft_mesh(name, sections, closed_ends=True)
    return _with_mat(ob, mat or material('M_' + name, color))


def _with_mat(ob, mat):
    ob.data.materials.clear()
    ob.data.materials.append(mat)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def rbox(name, center, axes, size, bevel=0.003, segs=3, mat=None, color=(0.5, 0.5, 0.5, 1)):
    # Caja redondeada orientada (hebillas, botones, cargadores).
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = new_obj(name, me)
    u, v, n = [Vector(a).normalized() for a in axes]
    ob.matrix_world = Matrix((u, v, n)).transposed().to_4x4()
    ob.matrix_world.translation = Vector(center)
    b = ob.modifiers.new('Bisel', 'BEVEL')
    b.width = bevel
    b.segments = segs
    b.limit_method = 'NONE'
    ob.data.materials.append(mat or material('M_' + name, color))
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def cyl(name, center, axis, r, depth, segs=20, mat=None, color=(0.5, 0.5, 0.5, 1), bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r, depth=depth)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = new_obj(name, me)
    z = Vector(axis).normalized()
    q = Vector((0, 0, 1)).rotation_difference(z)
    ob.matrix_world = q.to_matrix().to_4x4()
    ob.matrix_world.translation = Vector(center)
    if bevel:
        b = ob.modifiers.new('Bisel', 'BEVEL')
        b.width = bevel
        b.segments = 2
        b.limit_method = 'ANGLE'
    ob.data.materials.append(mat or material('M_' + name, color))
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


builtins.SF = type('SF', (), {k: staticmethod(v) if callable(v) else v for k, v in dict(globals()).items()
                               if not k.startswith('__') and k not in ('bpy', 'bmesh', 'builtins', 'math', 'base64', 'os', 'np',
                                                                       'Vector', 'Euler', 'Matrix')})
