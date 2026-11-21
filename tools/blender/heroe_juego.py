# Malla del juego del héroe: copias livianas de cada pieza, atlas UV común, horneado desde la alta y unión.
# Requiere sf_tools.py (builtins.SF) y la escena 'Heroe' con la colección 'HeroeCol'.
import bpy, bmesh, math, os
from mathutils import Vector

SRC = 'HeroeCol'
LOW = 'HeroeLow'
RES = 2048
OUT_DIR = os.path.join(os.path.dirname(bpy.data.filepath), 'hornear')

# triángulos objetivo de la malla base (antes del grosor); None = sin diezmar
OBJETIVO = {
    'Cuerpo': 7500, 'Chaleco': 1600, 'Camiseta': 1500, 'Pantalon': 1800, 'GuanteI': 700, 'GuanteD': 700,
    'PeloArriba': 2000, 'PeloCorto': 800, 'Bufanda': 900, 'BufandaVuelta': 800, 'BufandaNudo': 400, 'BufandaCola': 400,
    'BotaI': 1800, 'BotaD': 1800, 'SuelaI': 600, 'SuelaD': 600, 'RodilleraI': 500, 'RodilleraD': 500,
    'RodilleraCascoI': 400, 'RodilleraCascoD': 400, 'RibeteChaleco': 1400, 'RibeteCamiseta': 800, 'Cinturon': 800,
    'Presillas': 500, 'AntiparraCorrea': 600, 'AntiparraAro0': 300, 'AntiparraAro1': 300, 'OjoI': 400, 'OjoD': 400,
    'BolsilloCargoI': 450, 'TapaCargoI': 450, 'FundaPlaca': 450, 'Cargador0': 400, 'CargadorTapa0': 400,
    'Cargador1': 400, 'CargadorTapa1': 400, 'BolsaRadio': 450, 'Arnes0': 1300, 'Arnes1': 1300,
    'FundaCorrea0': 550, 'FundaCorrea1': 550, 'RodilleraCorreaI0': 350, 'RodilleraCorreaI1': 350,
    'RodilleraCorreaD0': 350, 'RodilleraCorreaD1': 350, 'HebillaArnes0': 300, 'HebillaArnes1': 300, 'Hebilla': 300,
}
METAL = ('HebillaArnes0', 'HebillaArnes1', 'Hebilla', 'ArgollaArnes', 'AntiparraAro0', 'AntiparraAro1')
ROPA = ('Chaleco',)
# escala relativa de textura (densidad) por pieza: la cara y los ojos se ven de cerca
DENSIDAD = {'OjoI': 1.6, 'OjoD': 1.6, 'PeloArriba': 1.2, 'AntiparraLente0': 1.3, 'AntiparraLente1': 1.3}
CABEZA_Z = 1.55   # islas del cuerpo por encima de esta altura van con más resolución
CABEZA_K = 1.9


def fuentes():
    col = bpy.data.collections[SRC]
    return [o for o in col.all_objects if o.type == 'MESH' and not o.hide_render and not o.name.startswith('_')]


def _tris(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)


def coleccion_low():
    col = bpy.data.collections.get(LOW)
    if col is None:
        col = bpy.data.collections.new(LOW)
        bpy.context.scene.collection.children.link(col)
    for o in list(col.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    return col


def hacer_low():
    col = coleccion_low()
    dg = bpy.context.evaluated_depsgraph_get()
    rep = {}
    for o in fuentes():
        tmp = o.copy()
        tmp.data = o.data.copy()
        tmp.name = '_tmp_' + o.name
        col.objects.link(tmp)
        solid = 0
        for m in list(tmp.modifiers):
            if m.type == 'SOLIDIFY':
                if 'SF_Nueva' not in tmp.vertex_groups:
                    tmp.vertex_groups.new(name='SF_Nueva')
                m.shell_vertex_group = 'SF_Nueva'   # para saber después qué cara es la de adentro
                solid = 1 if m.offset >= 0 else -1
            if m.type == 'SUBSURF':
                tmp.modifiers.remove(m)
            elif m.type == 'MULTIRES':
                m.levels = 0
        obj = OBJETIVO.get(o.name)
        base = _tris(tmp.data)
        if o.name == 'Cuerpo':
            d = tmp.modifiers.new('Dec', 'DECIMATE')   # después de la máscara
            d.ratio = 1.0
        elif obj and base > obj:
            d = tmp.modifiers.new('Dec', 'DECIMATE')
            d.ratio = obj / base
            _move_first(tmp, d)
        dg = bpy.context.evaluated_depsgraph_get()
        if o.name == 'Cuerpo':
            ev = tmp.evaluated_get(dg)
            n = _tris(ev.to_mesh())
            ev.to_mesh_clear()
            tmp.modifiers['Dec'].ratio = min(1.0, obj / max(n, 1))
            dg = bpy.context.evaluated_depsgraph_get()
        ev = tmp.evaluated_get(dg)
        me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
        lo = bpy.data.objects.new('L_' + o.name, me)
        lo.matrix_world = o.matrix_world.copy()
        col.objects.link(lo)
        lo['fuente'] = o.name
        lo['solid'] = solid
        bpy.data.objects.remove(tmp, do_unlink=True)
        for p in me.polygons:
            p.use_smooth = True
        rep[o.name] = _tris(me)
    return rep


def _move_first(ob, mod):
    idx = list(ob.modifiers).index(mod)
    if idx == 0:
        return
    try:
        ob.modifiers.move(idx, 0)
    except AttributeError:
        with bpy.context.temp_override(object=ob, active_object=ob):
            bpy.ops.object.modifier_move_to_index(modifier=mod.name, index=0)


def lows():
    return [o for o in bpy.data.collections[LOW].objects if o.type == 'MESH']


# ---------------------------------------------------------------------------
# UVs: proyección por pieza, densidad pareja, más resolución en la cara, y un solo atlas empaquetado.
def _editar(objs):
    bpy.ops.object.mode_set(mode='OBJECT') if bpy.context.object and bpy.context.object.mode != 'OBJECT' else None
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.context.scene.tool_settings.use_uv_select_sync = True
    bpy.ops.mesh.select_all(action='SELECT')


def _islas(bm, uv):
    # islas UV: caras unidas por aristas cuyas UV coinciden en los dos lados
    par = {f: f for f in bm.faces}

    def find(f):
        while par[f] is not f:
            par[f] = par[par[f]]
            f = par[f]
        return f
    for e in bm.edges:
        if len(e.link_faces) != 2:
            continue
        f1, f2 = e.link_faces
        ok = True
        for v in e.verts:
            a = [l[uv].uv for l in f1.loops if l.vert is v][0]
            b = [l[uv].uv for l in f2.loops if l.vert is v][0]
            if (a - b).length > 1e-5:
                ok = False
        if ok:
            par[find(f1)] = find(f2)
    out = {}
    for f in bm.faces:
        out.setdefault(find(f), []).append(f)
    return list(out.values())


def _escalar_uv(ob, k, filtro=None):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    uv = bm.loops.layers.uv.active
    for isla in _islas(bm, uv):
        if filtro and not filtro(ob, isla):
            continue
        ls = [l for f in isla for l in f.loops]
        c = sum((l[uv].uv for l in ls), Vector((0, 0))) / len(ls)
        for l in ls:
            l[uv].uv = c + (l[uv].uv - c) * k
    bm.to_mesh(ob.data)
    bm.free()


def _es_cabeza(ob, isla):
    mw = ob.matrix_world
    zs = [(mw @ v.co).z for f in isla for v in f.verts]
    return sum(zs) / len(zs) > CABEZA_Z


def _es_interior(ob, isla):
    # la cara de adentro de la tela (no se ve): con grosor hacia afuera es la original, si no la nueva
    g = ob.vertex_groups.get('SF_Nueva')
    if g is None:
        return False
    nueva = 0
    tot = 0
    for f in isla:
        for v in f.verts:
            tot += 1
            nueva += 1 if any(e.group == g.index for e in ob.data.vertices[v.index].groups) else 0
    frac = nueva / max(tot, 1)
    return frac < 0.05 if ob['solid'] > 0 else frac > 0.95


def uvs(margen=0.0015):
    objs = lows()
    cuerpo = [o for o in objs if o['fuente'] == 'Cuerpo']
    resto = [o for o in objs if o['fuente'] != 'Cuerpo']
    for o in objs:
        if not o.data.uv_layers:
            o.data.uv_layers.new(name='UVMap')
        o.data.uv_layers.active = o.data.uv_layers[0]
    _editar(resto)
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.002, area_weight=0.0, correct_aspect=True,
                             scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    _editar(objs)
    bpy.ops.uv.average_islands_scale()
    bpy.ops.object.mode_set(mode='OBJECT')
    for o in objs:
        k = DENSIDAD.get(o['fuente'])
        if k:
            _escalar_uv(o, k)
    for o in cuerpo:
        _escalar_uv(o, CABEZA_K, _es_cabeza)
    for o in objs:
        if o.get('solid'):
            _escalar_uv(o, 0.3, _es_interior)
    _editar(objs)
    bpy.ops.uv.pack_islands(rotate=True, margin_method='ADD', margin=margen, shape_method='CONCAVE')
    bpy.ops.object.mode_set(mode='OBJECT')
    return len(objs)


# ---------------------------------------------------------------------------
# Horneado (Cycles): color, normales y rugosidad desde la pieza de alta; oclusión sobre la malla liviana.
def _img(name, color=False):
    im = bpy.data.images.get(name)
    if im:
        bpy.data.images.remove(im)
    im = bpy.data.images.new(name, RES, RES, alpha=True, float_buffer=True)
    im.colorspace_settings.name = 'Linear Rec.709' if color else 'Non-Color'
    im.generated_color = (0, 0, 0, 0)
    return im


def _mat_bake():
    m = bpy.data.materials.get('_Hornear') or bpy.data.materials.new('_Hornear')
    m.use_nodes = True
    nt = m.node_tree
    nd = nt.nodes.get('Destino') or nt.nodes.new('ShaderNodeTexImage')
    nd.name = 'Destino'
    nt.nodes.active = nd
    return m, nd


def _solo_visibles(objs):
    for o in bpy.context.scene.objects:
        o.hide_render = o not in objs


def hornear(pases=('COLOR', 'NORMAL', 'ROUGH', 'AO'), solo=None):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.render.bake.use_selected_to_active = True
    imgs = {p: bpy.data.images.get('H_' + p) for p in pases}
    for p in pases:
        if imgs[p] is None or solo is None:
            imgs[p] = _img('H_' + p, color=(p == 'COLOR'))
    m, nodo = _mat_bake()
    objs = [o for o in lows() if solo is None or o['fuente'] in solo]
    vis0 = {o.name: o.hide_render for o in sc.objects}
    cols0 = {c: bpy.data.collections[c].hide_render for c in (SRC, LOW)}
    for c in cols0:
        bpy.data.collections[c].hide_render = False
    # sin metal ni subsuperficie al hornear el color (si no el color difuso sale negro o lavado)
    guard = []
    for mat in bpy.data.materials:
        if mat.use_nodes:
            for n in mat.node_tree.nodes:
                if n.type == 'BSDF_PRINCIPLED':
                    guard.append((n, n.inputs['Metallic'].default_value, n.inputs['Subsurface Weight'].default_value))
    mats0 = {o.name: [s.material for s in o.material_slots] for o in objs}
    rep = {}
    try:
        for o in objs:
            if not o.material_slots:
                o.data.materials.append(m)
            for s in o.material_slots:
                s.material = m
        for o in objs:
            src = bpy.data.objects[o['fuente']]
            for x in bpy.context.view_layer.objects:
                x.select_set(False)
            src.select_set(True)
            o.select_set(True)
            bpy.context.view_layer.objects.active = o
            _solo_visibles([o, src])
            for p in pases:
                if p == 'AO':
                    continue
                nodo.image = imgs[p]
                if p == 'COLOR':
                    for n, mt, sw in guard:
                        n.inputs['Metallic'].default_value = 0.0
                        n.inputs['Subsurface Weight'].default_value = 0.0
                    sc.cycles.samples = 4
                    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, use_selected_to_active=True,
                                        cage_extrusion=0.006, max_ray_distance=0.02, margin=4, use_clear=False)
                    for n, mt, sw in guard:
                        n.inputs['Metallic'].default_value = mt
                        n.inputs['Subsurface Weight'].default_value = sw
                elif p == 'NORMAL':
                    sc.cycles.samples = 4
                    bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT', use_selected_to_active=True,
                                        cage_extrusion=0.006, max_ray_distance=0.02, margin=4, use_clear=False)
                elif p == 'ROUGH':
                    sc.cycles.samples = 1
                    bpy.ops.object.bake(type='ROUGHNESS', use_selected_to_active=True,
                                        cage_extrusion=0.006, max_ray_distance=0.02, margin=4, use_clear=False)
            rep[o.name] = 'ok'
        if 'AO' in pases:
            _solo_visibles(lows())
            w = sc.world
            w.light_settings.distance = 0.25
            sc.cycles.samples = 48
            nodo.image = imgs['AO']
            for o in objs:
                for x in bpy.context.view_layer.objects:
                    x.select_set(False)
                o.select_set(True)
                bpy.context.view_layer.objects.active = o
                bpy.ops.object.bake(type='AO', use_selected_to_active=False, margin=4, use_clear=False)
    finally:
        for c, v in cols0.items():
            bpy.data.collections[c].hide_render = v
        for o in sc.objects:
            if o.name in vis0:
                o.hide_render = vis0[o.name]
        for o in objs:
            for s, mt in zip(o.material_slots, mats0[o.name]):
                s.material = mt
    return rep


# ---------------------------------------------------------------------------
# Post-proceso de las texturas y malla final con 3 materiales (Heroe, Ropa teñible y Metal).
CHALECO_BASE = (0.20, 0.035, 0.03)   # color lineal del chaleco; en la textura queda gris y el tinte lo multiplica
GRIS_ROPA = 0.8


def _np(name):
    import numpy as np
    im = bpy.data.images[name]
    W, H = im.size
    a = np.empty(W * H * 4, np.float32)
    im.pixels.foreach_get(a)
    return a.reshape(H, W, 4)


def _dilatar(a, cov, iters=24):
    import numpy as np
    a = a.copy()
    cov = cov.copy()
    for _ in range(iters):
        acc = np.zeros_like(a)
        n = np.zeros(cov.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            c = np.roll(cov, (dy, dx), (0, 1))
            acc += np.roll(a, (dy, dx), (0, 1)) * c[..., None]
            n += c
        nuevo = (~cov) & (n > 0)
        a[nuevo] = acc[nuevo] / n[nuevo][:, None]
        cov = cov | nuevo
    return a


def _mascara_uv(obs, W):
    # rasteriza las islas UV de unas piezas (para saber qué píxeles son del chaleco)
    import numpy as np
    m = np.zeros((W, W), bool)
    for ob in obs:
        me = ob.data
        uvl = me.uv_layers.active.data
        me.calc_loop_triangles()
        for t in me.loop_triangles:
            p = np.array([uvl[i].uv[:] for i in t.loops]) * W
            x0, y0 = np.floor(p.min(0)).astype(int)
            x1, y1 = np.ceil(p.max(0)).astype(int)
            x0, y0 = max(x0, 0), max(y0, 0)
            x1, y1 = min(x1, W - 1), min(y1, W - 1)
            if x1 < x0 or y1 < y0:
                continue
            xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            (ax, ay), (bx, by), (cx, cy) = p
            d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(d) < 1e-12:
                continue
            l1 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / d
            l2 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / d
            l3 = 1 - l1 - l2
            e = -0.02
            ins = (l1 >= e) & (l2 >= e) & (l3 >= e)
            m[y0:y1 + 1, x0:x1 + 1] |= ins
    return m


def _guardar(arr, name, srgb):
    import numpy as np
    H, W = arr.shape[:2]
    rgb = np.clip(arr[..., :3], 0, 1)
    if srgb:
        rgb = np.where(rgb <= 0.0031308, rgb * 12.92, 1.055 * np.power(rgb, 1 / 2.4) - 0.055)
    out = np.concatenate([rgb, np.ones((H, W, 1), np.float32)], 2).astype(np.float32)
    im = bpy.data.images.get(name)
    if im:
        bpy.data.images.remove(im)
    im = bpy.data.images.new(name, W, H, alpha=False)
    im.colorspace_settings.name = 'sRGB' if srgb else 'Non-Color'
    im.pixels.foreach_set(out.ravel())
    os.makedirs(OUT_DIR, exist_ok=True)
    im.filepath_raw = os.path.join(OUT_DIR, name + '.png')
    im.file_format = 'PNG'
    im.save()
    im.pack()
    return im


def post():
    import numpy as np
    col = _np('H_COLOR')
    nor = _np('H_NORMAL')
    rou = _np('H_ROUGH')
    ao = _np('H_AO')
    cov = col[..., 3] > 0.5
    W = col.shape[0]
    chal = _mascara_uv([o for o in lows() if o['fuente'] in ROPA], W) & cov
    a = ao[..., 0:1]
    c = col[..., :3].copy()
    base = np.array(CHALECO_BASE, np.float32)
    c[chal] = np.clip(c[chal] / base * GRIS_ROPA, 0, 1)
    c = c * (0.55 + 0.45 * a)
    c = _dilatar(np.concatenate([c, col[..., 3:]], 2), cov)
    n = _dilatar(nor, nor[..., 3] > 0.5)
    orm = np.stack([ao[..., 0], rou[..., 0], np.zeros_like(ao[..., 0]), np.ones_like(ao[..., 0])], 2)
    orm = _dilatar(orm, cov)
    for im in ('H_COLOR', 'H_NORMAL', 'H_ROUGH', 'H_AO'):
        bpy.data.images[im].pack()
    _guardar(c, 'Heroe_color', True)
    _guardar(n, 'Heroe_normal', False)
    _guardar(orm, 'Heroe_orm', False)
    return {'cobertura': float(cov.mean()), 'chaleco_px': int(chal.sum())}


def _mat_final(name, metal=0.0, tinte=None):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(b.outputs[0], out.inputs[0])
    tc = nt.nodes.new('ShaderNodeTexImage')
    tc.image = bpy.data.images['Heroe_color']
    if tinte:
        mx = nt.nodes.new('ShaderNodeMix')
        mx.data_type = 'RGBA'
        mx.blend_type = 'MULTIPLY'
        mx.inputs[0].default_value = 1.0
        A = [i for i in mx.inputs if i.name == 'A' and i.type == 'RGBA'][0]
        B = [i for i in mx.inputs if i.name == 'B' and i.type == 'RGBA'][0]
        nt.links.new(tc.outputs['Color'], A)
        B.default_value = tuple(tinte) + (1,)
        nt.links.new([o for o in mx.outputs if o.type == 'RGBA'][0], b.inputs['Base Color'])
    else:
        nt.links.new(tc.outputs['Color'], b.inputs['Base Color'])
    tn = nt.nodes.new('ShaderNodeTexImage')
    tn.image = bpy.data.images['Heroe_normal']
    nm = nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    to = nt.nodes.new('ShaderNodeTexImage')
    to.image = bpy.data.images['Heroe_orm']
    sp = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(to.outputs['Color'], sp.inputs[0])
    nt.links.new(sp.outputs['Green'], b.inputs['Roughness'])
    if metal:
        b.inputs['Metallic'].default_value = metal
    else:
        nt.links.new(sp.outputs['Blue'], b.inputs['Metallic'])
    # oclusión para el exportador glTF
    g = bpy.data.node_groups.get('glTF Material Output')
    if g is None:
        g = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
        g.interface.new_socket('Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
    gn = nt.nodes.new('ShaderNodeGroup')
    gn.node_tree = g
    nt.links.new(sp.outputs['Red'], gn.inputs['Occlusion'])
    return m


def unir():
    old = bpy.data.objects.get('HeroeJuego')
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    heroe = _mat_final('Heroe')
    ropa = _mat_final('Ropa', tinte=tuple(x / GRIS_ROPA for x in CHALECO_BASE))
    metal = _mat_final('Metal', metal=1.0)
    col = bpy.data.collections.get('HeroeFinal')
    if col is None:
        col = bpy.data.collections.new('HeroeFinal')
        bpy.context.scene.collection.children.link(col)
    copias = []
    for o in lows():
        c = o.copy()
        c.data = o.data.copy()
        col.objects.link(c)
        c.data.materials.clear()
        f = o['fuente']
        c.data.materials.append(ropa if f in ROPA else metal if f in METAL else heroe)
        for p in c.data.polygons:
            p.material_index = 0
        for g in list(c.vertex_groups):
            c.vertex_groups.remove(g)
        copias.append(c)
    bpy.ops.object.mode_set(mode='OBJECT') if bpy.context.object and bpy.context.object.mode != 'OBJECT' else None
    for x in bpy.context.view_layer.objects:
        x.select_set(False)
    for c in copias:
        c.select_set(True)
    bpy.context.view_layer.objects.active = copias[0]
    bpy.ops.object.join()
    j = bpy.context.view_layer.objects.active
    j.name = 'HeroeJuego'
    j.data.name = 'HeroeJuego'
    for k in list(j.keys()):
        del j[k]
    return {'tris': sum(len(p.vertices) - 2 for p in j.data.polygons), 'mats': [m.name for m in j.data.materials]}


# ---------------------------------------------------------------------------
# Normales hacia afuera en las piezas de alta (los lofts y tubos salían invertidos: arruina AO y normal map).
def normales(aplicar=True):
    from mathutils.bvhtree import BVHTree
    cu = bpy.data.objects['Cuerpo']
    bvh = BVHTree.FromObject(cu, bpy.context.evaluated_depsgraph_get())
    rep = {}
    for o in fuentes():
        if o.name in ('Cuerpo', 'OjoI', 'OjoD') or any(m.type == 'SOLIDIFY' for m in o.modifiers):
            continue
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bm.faces.ensure_lookup_table()
        mw = o.matrix_world
        cerrado = all(e.is_manifold for e in bm.edges)
        if True:   # tubos abiertos en las puntas también se resuelven bien por volumen con signo
            vol = sum((mw @ f.calc_center_median()).dot((mw.to_3x3() @ f.normal)) * f.calc_area() for f in bm.faces)
            voltear = vol < 0
            score = vol
        else:
            score = 0.0
            for f in bm.faces:
                c = mw @ f.calc_center_median()
                hit = bvh.find_nearest(c)
                if hit[0] is None:
                    continue
                score += (mw.to_3x3() @ f.normal).normalized().dot(hit[1]) * f.calc_area()
            voltear = score < 0
        if voltear and aplicar:
            bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
            bm.to_mesh(o.data)
            o.data.update()
        bm.free()
        rep[o.name] = ('VOLTEADO ' if voltear else '') + ('cerrado' if cerrado else 'abierto') + ' %.4f' % score
    return rep
