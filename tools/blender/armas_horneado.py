# Horneado de texturas de cada arma (requiere armas_base.py y que el arma esté finalizada en exp_<nombre>).
# 1) UV automáticas de todas las piezas en un solo atlas.
# 2) En Cycles, por cada material: color base con oclusión, bordes gastados (más claros) y una variación leve,
#    y un mapa ORM (R oclusión, G rugosidad, B metal) con la rugosidad variando y los bordes pulidos.
# 3) Cada arma queda con un material 'Arma_<nombre>' + 'Rareza' (se tiñe en el juego) + 'Lente'.

NO_HORNEAR = ('Rareza', 'Lente')
# color al que va el borde gastado y cuánto se gasta
DESGASTE = {
    'Pavonado': ((0.30, 0.31, 0.32), 0.85, 0.75), 'AceroOscuro': ((0.36, 0.37, 0.38), 0.8, 0.7),
    'Acero': ((0.75, 0.76, 0.77), 0.6, 0.5), 'Grafito': ((0.22, 0.23, 0.24), 0.75, 0.6),
    'Polimero': ((0.10, 0.105, 0.11), 0.55, 0.3), 'Oliva': ((0.26, 0.27, 0.16), 0.55, 0.3),
    'Arena': ((0.52, 0.42, 0.27), 0.5, 0.3), 'Madera': ((0.42, 0.20, 0.08), 0.5, 0.3),
    'MaderaClara': ((0.55, 0.30, 0.13), 0.45, 0.3), 'Goma': ((0.06, 0.06, 0.06), 0.4, 0.2),
    'Laton': ((0.95, 0.80, 0.45), 0.5, 0.5), 'Cartucho': ((0.75, 0.15, 0.10), 0.4, 0.3),
    'Cinta': ((0.12, 0.11, 0.10), 0.5, 0.2), 'Cobre': ((0.95, 0.60, 0.40), 0.5, 0.5),
    'Ojiva': ((0.30, 0.32, 0.22), 0.6, 0.4), 'Pintura': ((0.85, 0.20, 0.12), 0.55, 0.4),
}


def _sk(node, nombre, tipo='RGBA', salida=False):
    # zócalo por nombre y tipo (el nodo Mix tiene varios 'A', 'B' y 'Result' de distinto tipo)
    lista = node.outputs if salida else node.inputs
    return next(s for s in lista if s.name == nombre and s.type == tipo)


def _objs_exp(nombre):
    col = bpy.data.collections['exp_' + nombre]
    return [o for o in col.objects if o.type == 'MESH']


def _seleccionar(obs):
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in obs:
        o.hide_set(False)
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]


def uv_atlas(nombre, margen=0.0035):
    obs = _objs_exp(nombre)
    _seleccionar(obs)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(50), island_margin=margen, area_weight=0.0,
                             correct_aspect=True, scale_to_bounds=False)
    try:
        bpy.ops.uv.pack_islands(udim_source='CLOSEST_UDIM', rotate=True, margin=margen)
    except TypeError:
        bpy.ops.uv.pack_islands(rotate=True, margin=margen)
    bpy.ops.object.mode_set(mode='OBJECT')


def _imagen(nombre, res, datos):
    img = bpy.data.images.get(nombre)
    if img and (img.size[0] != res):
        bpy.data.images.remove(img)
        img = None
    if not img:
        img = bpy.data.images.new(nombre, res, res, alpha=False)
    img.colorspace_settings.name = 'Non-Color' if datos else 'sRGB'
    return img


def _mat_horneo(m, img, paso):
    # copia temporal del material que emite el canal pedido (paso 'color' u 'orm')
    nombre = '_H_%s_%s' % (m.name, paso)
    old = bpy.data.materials.get(nombre)
    if old:
        bpy.data.materials.remove(old)
    h = bpy.data.materials.new(nombre)
    h.use_nodes = True
    nt = h.node_tree
    nt.nodes.clear()
    N = nt.nodes.new
    L = nt.links.new
    p = PALETA.get(m.name, dict(c=(0.5, 0.5, 0.5), m=0.0, r=0.5))
    gasto, cuanto, pulido = DESGASTE.get(m.name, ((0.5, 0.5, 0.5), 0.0, 0.0))
    out = N('ShaderNodeOutputMaterial')
    emi = N('ShaderNodeEmission')
    L(emi.outputs[0], out.inputs['Surface'])
    tex = N('ShaderNodeTexImage')
    tex.image = img
    nt.nodes.active = tex
    # oclusión
    ao = N('ShaderNodeAmbientOcclusion')
    ao.samples = 24
    ao.inputs['Distance'].default_value = 0.03
    # borde: diferencia entre la normal biselada y la real (solo en lo convexo: donde la oclusión es alta)
    bev = N('ShaderNodeBevel')
    bev.samples = 8
    bev.inputs['Radius'].default_value = 0.0025
    geo = N('ShaderNodeNewGeometry')
    dot = N('ShaderNodeVectorMath')
    dot.operation = 'DOT_PRODUCT'
    L(bev.outputs[0], dot.inputs[0])
    L(geo.outputs['Normal'], dot.inputs[1])
    borde = N('ShaderNodeMapRange')
    borde.inputs['From Min'].default_value = 0.995
    borde.inputs['From Max'].default_value = 0.90
    L(dot.outputs['Value'], borde.inputs['Value'])
    convexo = N('ShaderNodeMapRange')
    convexo.inputs['From Min'].default_value = 0.75
    convexo.inputs['From Max'].default_value = 0.97
    L(ao.outputs['AO'], convexo.inputs['Value'])
    # ruido fino y manchas grandes (coordenadas de objeto, para que no dependa de las UV)
    coord = N('ShaderNodeTexCoord')
    fino = N('ShaderNodeTexNoise')
    fino.inputs['Scale'].default_value = 180.0
    fino.inputs['Detail'].default_value = 6.0
    L(coord.outputs['Object'], fino.inputs['Vector'])
    grande = N('ShaderNodeTexNoise')
    grande.inputs['Scale'].default_value = 14.0
    grande.inputs['Detail'].default_value = 3.0
    L(coord.outputs['Object'], grande.inputs['Vector'])
    # el ruido grande rompe el borde para que el desgaste no sea una línea pareja
    rotura = N('ShaderNodeMapRange')
    rotura.inputs['From Min'].default_value = 0.35
    rotura.inputs['From Max'].default_value = 0.6
    L(grande.outputs['Fac'], rotura.inputs['Value'])
    m1 = N('ShaderNodeMath')
    m1.operation = 'MULTIPLY'
    L(borde.outputs['Result'], m1.inputs[0])
    L(convexo.outputs['Result'], m1.inputs[1])
    gast = N('ShaderNodeMath')
    gast.operation = 'MULTIPLY'
    L(m1.outputs[0], gast.inputs[0])
    m2 = N('ShaderNodeMapRange')
    m2.inputs['To Min'].default_value = 0.55
    L(rotura.outputs['Result'], m2.inputs['Value'])
    L(m2.outputs['Result'], gast.inputs[1])
    if paso == 'color':
        mix = N('ShaderNodeMix')
        mix.data_type = 'RGBA'
        _sk(mix, 'A').default_value = (*p['c'], 1)
        _sk(mix, 'B').default_value = (*gasto, 1)
        fac = N('ShaderNodeMath')
        fac.operation = 'MULTIPLY'
        fac.inputs[1].default_value = cuanto
        L(gast.outputs[0], fac.inputs[0])
        L(fac.outputs[0], _sk(mix, 'Factor', 'VALUE'))
        # oclusión suave en el color (la fuerte va en el canal R del ORM)
        aoc = N('ShaderNodeMapRange')
        aoc.inputs['To Min'].default_value = 0.55
        L(ao.outputs['AO'], aoc.inputs['Value'])
        var = N('ShaderNodeMapRange')
        var.inputs['To Min'].default_value = 0.9
        var.inputs['To Max'].default_value = 1.08
        L(grande.outputs['Fac'], var.inputs['Value'])
        k = N('ShaderNodeMath')
        k.operation = 'MULTIPLY'
        L(aoc.outputs['Result'], k.inputs[0])
        L(var.outputs['Result'], k.inputs[1])
        mul = N('ShaderNodeMix')
        mul.data_type = 'RGBA'
        mul.blend_type = 'MULTIPLY'
        _sk(mul, 'Factor', 'VALUE').default_value = 1.0
        L(_sk(mix, 'Result', salida=True), _sk(mul, 'A'))
        L(k.outputs[0], _sk(mul, 'B'))
        L(_sk(mul, 'Result', salida=True), emi.inputs['Color'])
    else:
        # rugosidad: base + ruido fino - pulido en los bordes; metal: el de la paleta
        r0 = N('ShaderNodeMapRange')
        r0.inputs['To Min'].default_value = p['r'] - 0.07
        r0.inputs['To Max'].default_value = p['r'] + 0.07
        L(fino.outputs['Fac'], r0.inputs['Value'])
        pul = N('ShaderNodeMath')
        pul.operation = 'MULTIPLY'
        pul.inputs[1].default_value = pulido * 0.35
        L(gast.outputs[0], pul.inputs[0])
        rr = N('ShaderNodeMath')
        rr.operation = 'SUBTRACT'
        rr.use_clamp = True
        L(r0.outputs['Result'], rr.inputs[0])
        L(pul.outputs[0], rr.inputs[1])
        comb = N('ShaderNodeCombineColor')
        L(ao.outputs['AO'], comb.inputs[0])
        L(rr.outputs[0], comb.inputs[1])
        comb.inputs[2].default_value = p['m']
        L(comb.outputs[0], emi.inputs['Color'])
    return h


def _material_final(nombre, color, orm):
    mn = 'Arma_' + nombre
    m = bpy.data.materials.get(mn) or bpy.data.materials.new(mn)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    N = nt.nodes.new
    L = nt.links.new
    out = N('ShaderNodeOutputMaterial')
    bsdf = N('ShaderNodeBsdfPrincipled')
    L(bsdf.outputs[0], out.inputs['Surface'])
    tc = N('ShaderNodeTexImage')
    tc.image = color
    L(tc.outputs['Color'], bsdf.inputs['Base Color'])
    to = N('ShaderNodeTexImage')
    to.image = orm
    sep = N('ShaderNodeSeparateColor')
    L(to.outputs['Color'], sep.inputs[0])
    L(sep.outputs[1], bsdf.inputs['Roughness'])
    L(sep.outputs[2], bsdf.inputs['Metallic'])
    # oclusión para el exportador glTF (grupo 'glTF Material Output' con la entrada 'Occlusion')
    g = bpy.data.node_groups.get('glTF Material Output')
    if not g:
        g = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
        g.interface.new_socket('Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
        g.interface.new_socket('Thickness', in_out='INPUT', socket_type='NodeSocketFloat')
    gn = N('ShaderNodeGroup')
    gn.node_tree = g
    L(sep.outputs[0], gn.inputs['Occlusion'])
    m.diffuse_color = (0.3, 0.3, 0.3, 1)
    return m


def _unificar(ob):
    # deja un solo hueco por material (si varios quedaron con el mismo, se juntan)
    me = ob.data
    nombres = []
    remap = []
    for m in me.materials:
        n = m.name if m else ''
        if n not in nombres:
            nombres.append(n)
        remap.append(nombres.index(n))
    idx = [0] * len(me.polygons)
    me.polygons.foreach_get('material_index', idx)
    idx = [remap[i] for i in idx]
    mats = [bpy.data.materials.get(n) for n in nombres]
    me.materials.clear()
    for m in mats:
        me.materials.append(m)
    me.polygons.foreach_set('material_index', idx)


def hornear(nombre, res=1024, muestras=16):
    sc = escena()
    obs = _objs_exp(nombre)
    uv_atlas(nombre)
    # solo esta arma visible para el render (las demás están en el mismo lugar)
    vis = {}
    for c in sc.collection.children:
        vis[c.name] = c.hide_render
        c.hide_render = c.name != 'exp_' + nombre
    color = _imagen('T_%s_color' % nombre, res, False)
    orm = _imagen('T_%s_orm' % nombre, res, True)
    originales = {o.name: [s.material for s in o.material_slots] for o in obs}
    motor = sc.render.engine
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = muestras
    try:
        sc.cycles.device = 'GPU'
    except Exception:
        pass
    sc.render.bake.margin = 6
    _seleccionar(obs)
    try:
        for paso, img in (('color', color), ('orm', orm)):
            for o in obs:
                for s, m in zip(o.material_slots, originales[o.name]):
                    s.material = _mat_horneo(m, img, paso)
            bpy.ops.object.bake(type='EMIT', margin=6, use_clear=True)
    finally:
        sc.render.engine = motor
        for c in sc.collection.children:
            if c.name in vis:
                c.hide_render = vis[c.name]
    fin = _material_final(nombre, color, orm)
    for o in obs:
        for s, m in zip(o.material_slots, originales[o.name]):
            s.material = m if m.name in NO_HORNEAR else fin
        _unificar(o)
    for m in list(bpy.data.materials):
        if m.name.startswith('_H_'):
            bpy.data.materials.remove(m)
    # se guardan dentro del .blend para no perderlas
    color.pack()
    orm.pack()
    return {'tex': [color.name, orm.name], 'objs': [o.name for o in obs]}
