# Esqueleto y pesos del héroe para el juego.
# Requiere sf_tools.py (builtins.SF) y 'HeroeJuego' (heroe_juego.unir) + 'Esqueleto' en la escena.
import bpy, bmesh, math
from mathutils import Vector, Matrix, Quaternion, Euler

ARM = 'Esqueleto'
MALLA = 'HeroeJuego'


def _sel(objs, active):
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.hide_set(False)
        o.select_set(True)
    bpy.context.view_layer.objects.active = active


def cuerpo_pesos():
    # cuerpo completo (sin máscara) con pesos automáticos por calor: fuente para transferir a toda la ropa
    old = bpy.data.objects.get('_CuerpoPesos')
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    cu = bpy.data.objects['Cuerpo']
    c = cu.copy()
    c.data = cu.data.copy()
    c.name = '_CuerpoPesos'
    bpy.data.collections['HeroeFinal'].objects.link(c)
    for m in list(c.modifiers):
        if m.type == 'MASK':
            c.modifiers.remove(m)
        elif m.type == 'MULTIRES':
            m.levels = 1
    _sel([c], c)
    for m in list(c.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    for g in list(c.vertex_groups):
        c.vertex_groups.remove(g)
    arm = bpy.data.objects[ARM]
    _sel([c, arm], arm)
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    faltan = [b.name for b in arm.data.bones if b.use_deform and b.name not in c.vertex_groups]
    usados = set()
    for v in c.data.vertices:
        for e in v.groups:
            if e.weight > 0.01:
                usados.add(e.group)
    vacios = [g.name for g in c.vertex_groups if g.index not in usados]
    return {'grupos': len(c.vertex_groups), 'faltan': faltan, 'vacios': vacios}


def transferir():
    m = bpy.data.objects[MALLA]
    src = bpy.data.objects['_CuerpoPesos']
    arm = bpy.data.objects[ARM]
    for g in list(m.vertex_groups):
        m.vertex_groups.remove(g)
    for g in src.vertex_groups:
        m.vertex_groups.new(name=g.name)
    for mod in list(m.modifiers):
        m.modifiers.remove(mod)
    dt = m.modifiers.new('Pesos', 'DATA_TRANSFER')
    dt.object = src
    dt.use_vert_data = True
    dt.data_types_verts = {'VGROUP_WEIGHTS'}
    dt.vert_mapping = 'POLYINTERP_NEAREST'
    dt.layers_vgroup_select_src = 'ALL'
    dt.layers_vgroup_select_dst = 'NAME'
    _sel([m], m)
    bpy.ops.object.modifier_apply(modifier=dt.name)
    # rígidos: la cabeza manda en pelo, antiparras y ojos (si no el pelo "se estira" con el cuello)
    head = m.vertex_groups.get('Head')
    bm_rigid_head(m, head)
    reglas(m)
    _sel([m], m)
    bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
    bpy.ops.object.vertex_group_smooth(group_select_mode='ALL', factor=0.5, repeat=2)
    bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    m.parent = arm
    m.matrix_parent_inverse = arm.matrix_world.inverted()
    am = m.modifiers.new('Esqueleto', 'ARMATURE')
    am.object = arm
    sin = sum(1 for v in m.data.vertices if not v.groups)
    return {'sin_peso': sin, 'grupos': len(m.vertex_groups)}


def bm_rigid_head(m, head):
    # vértices por encima de la línea del cuello y fuera de la bufanda: 100% cabeza
    if head is None:
        return
    mw = m.matrix_world
    ids = []
    for v in m.data.vertices:
        p = mw @ v.co
        if p.z > 1.70 or (p.z > 1.665 and p.y > -0.02):
            ids.append(v.index)
    for g in m.vertex_groups:
        if g != head:
            g.remove(ids)
    head.add(ids, 1.0, 'REPLACE')


def pose_prueba(pose):
    arm = bpy.data.objects[ARM]
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)
    for name, rot in pose.items():
        arm.pose.bones[name].rotation_euler = rot
    bpy.context.view_layer.update()


# Piezas que no deben seguir a brazos o piernas (si no el chaleco "se levanta" con el brazo o la cadera)
TORSO = ('Chaleco', 'RibeteChaleco', 'Arnes0', 'Arnes1', 'HebillaArnes0', 'HebillaArnes1', 'ArgollaArnes', 'Cargador0',
         'CargadorTapa0', 'Cargador1', 'CargadorTapa1', 'BolsaRadio', 'Antena', 'Bufanda', 'BufandaVuelta',
         'BufandaNudo', 'BufandaCola')
CADERA = ('Chaleco', 'RibeteChaleco', 'Cinturon', 'Hebilla', 'Presillas', 'Cargador0', 'CargadorTapa0', 'Cargador1',
          'CargadorTapa1', 'Arnes0', 'Arnes1')
RIGIDO = {'FundaCuerpo': 'UpperLeg.R', 'FundaEmpunadura': 'UpperLeg.R', 'FundaPlaca': 'UpperLeg.R',
          'BolsilloCargoI': 'UpperLeg.L', 'TapaCargoI': 'UpperLeg.L'}
BRAZO = ('Shoulder', 'UpperArm', 'LowerArm', 'Hand', 'Thumb', 'Index', 'Middle', 'Ring', 'Pinky')
PIERNA = ('UpperLeg', 'LowerLeg', 'Foot', 'Toe')


def reglas(m):
    piezas = list(m.get('piezas', []))
    if not piezas or 'pieza' not in m.data.attributes:
        return {}
    pz = [0] * len(m.data.vertices)
    m.data.attributes['pieza'].data.foreach_get('value', pz)
    gname = {g.index: g.name for g in m.vertex_groups}
    VG = m.vertex_groups
    cambios = 0
    for v in m.data.vertices:
        nombre = piezas[pz[v.index]]
        quitar = []
        if nombre in TORSO:
            quitar += [e.group for e in v.groups if gname[e.group].startswith(BRAZO[1:])]
        if nombre in CADERA:
            quitar += [e.group for e in v.groups if gname[e.group].startswith(PIERNA)]
        if nombre in RIGIDO:
            for e in list(v.groups):
                VG[e.group].remove([v.index])
            VG[RIGIDO[nombre]].add([v.index], 1.0, 'REPLACE')
            cambios += 1
            continue
        if not quitar:
            continue
        resto = sum(e.weight for e in v.groups if e.group not in quitar)
        for gi in set(quitar):
            VG[gi].remove([v.index])
        if resto < 1e-3:
            VG['Spine2' if nombre in TORSO and nombre not in CADERA else 'Hips'].add([v.index], 1.0, 'REPLACE')
        cambios += 1
    return {'cambios': cambios}
