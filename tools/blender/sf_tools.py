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
