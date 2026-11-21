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
ROPA = ('Chaleco', 'RibeteChaleco')
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
        for m in list(tmp.modifiers):
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


def uvs(margen=0.006):
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
    _editar(objs)
    bpy.ops.uv.pack_islands(rotate=True, margin=margen, shape_method='CONCAVE')
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
        for o in sc.objects:
            if o.name in vis0:
                o.hide_render = vis0[o.name]
        for o in objs:
            for s, mt in zip(o.material_slots, mats0[o.name]):
                s.material = mt
    return rep
