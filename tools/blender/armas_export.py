# Exporta las armas y sus animaciones para el juego.
# - armas.glb: las siete armas horneadas (colecciones exp_<arma>), con las piezas móviles como nodos propios, los
#   vacíos de referencia (<arma>_boca, _mira, _apoyo) y una animación por acción (recarga, bombeo) que mueve las
#   piezas. Cada pista NLA lleva el nombre del clip: el exportador junta en una animación las pistas de igual nombre.
# - animaciones_armas.glb: solo el esqueleto del héroe con los clips nuevos (recargas, bombeo); el juego los suma
#   a los de personaje.glb (las pistas se enganchan por nombre de hueso).
# Requiere heroe_anim.py, heroe_clips.py y heroe_recargas.py, el esqueleto 'Esqueleto' en la escena y las colecciones
# exp_ de las armas (armas_base.py + armas_modelos.py + armas_horneado.py).
import bpy, os

ARMAS_EXPORT = ('rifle', 'escopeta', 'francotirador', 'pistola', 'subfusil', 'lanzacohetes', 'pico')


def _seleccion(objs, activo=None):
    for o in bpy.data.objects:
        try:
            o.select_set(False)
        except RuntimeError:
            pass
    for o in objs:
        o.hide_set(False)
        o.hide_render = False
        o.select_set(True)
    bpy.context.view_layer.objects.active = activo or (objs[0] if objs else None)


def _ver_colecciones(nombres):
    sc = bpy.context.scene
    for n in nombres:
        c = bpy.data.collections[n]
        c.hide_render = False
        c.hide_viewport = False
        if c.name not in sc.collection.children:
            sc.collection.children.link(c)


def exportar_clips(ruta, nombres):
    # el esqueleto solo, con las acciones pedidas (las demás se borran de este archivo de trabajo)
    arm = bpy.data.objects[ARM]
    bpy.context.scene.render.fps = FPS_CLIP
    for a in list(bpy.data.actions):
        if a.name not in nombres and a.id_root in ('OBJECT', None) and any(
                'pose.bones' in fc.data_path for fc in _fcurves(a)):
            bpy.data.actions.remove(a)
    for a in bpy.data.actions:
        a.use_fake_user = a.name in nombres
    arm.animation_data_create()
    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)
    bpy.context.view_layer.update()
    _seleccion([arm], arm)
    bpy.ops.export_scene.gltf(
        filepath=ruta, export_format='GLB', use_selection=True, use_active_scene=True, export_yup=True,
        export_apply=False, export_skins=True, export_def_bones=False, export_leaf_bone=False,
        export_rest_position_armature=True, export_animations=True, export_animation_mode='ACTIONS',
        export_force_sampling=True, export_optimize_animation_size=True, export_anim_single_armature=True,
        export_reset_pose_bones=True, export_anim_slide_to_zero=True, export_bake_animation=False,
        export_frame_step=1, export_materials='NONE', export_extras=False)
    return os.path.getsize(ruta)


def pistas_piezas(C, piezas):
    # acciones de las piezas (todos los cuadros, lineales) puestas en una pista NLA con el nombre del clip
    acts = animar_piezas(C, piezas)
    for act in acts:
        ob = next(o for o in bpy.data.objects if o.animation_data and o.animation_data.action == act)
        ad = ob.animation_data
        ad.action = None
        for t in list(ad.nla_tracks):
            if t.name == C.nombre:
                ad.nla_tracks.remove(t)
        tr = ad.nla_tracks.new()
        tr.name = C.nombre
        tr.strips.new(C.nombre, 0, act)
        # sin acción activa: la pose de reposo es la del modelo
    return acts


OCULTAS = ('cartucho', 'bala')      # piezas que solo se ven durante la recarga


def reposo_piezas(pivotes):
    # transformación de reposo de cada pieza (la que queda en el nodo): en su pivote, sin giro; las sueltas ocultas
    for ob_name, piv in pivotes.items():
        ob = bpy.data.objects[ob_name]
        ob.rotation_mode = 'QUATERNION'
        ob.location = piv
        ob.rotation_quaternion = (1, 0, 0, 0)
        s = 0.0 if ob_name.split('_', 1)[1] in OCULTAS else 1.0
        ob.scale = (s, s, s)
        if ob.animation_data:
            ob.animation_data.action = None
            for t in ob.animation_data.nla_tracks:
                t.mute = True


def exportar_armas(ruta, pivotes, calidad=86):
    _ver_colecciones(['exp_' + a for a in ARMAS_EXPORT])
    objs = [o for a in ARMAS_EXPORT for o in bpy.data.collections['exp_' + a].objects]
    for o in objs:
        if o.parent and o.parent.type == 'ARMATURE':
            o.parent = None
    reposo_piezas(pivotes)
    bpy.context.scene.render.fps = FPS_CLIP
    bpy.context.scene.frame_set(0)
    _seleccion(objs)
    bpy.ops.export_scene.gltf(
        filepath=ruta, export_format='GLB', use_selection=True, use_active_scene=True, export_yup=True,
        export_apply=False, export_image_format='WEBP', export_image_quality=calidad, export_unused_images=False,
        export_tangents=False, export_extras=False, export_animations=True, export_animation_mode='NLA_TRACKS',
        export_force_sampling=True, export_optimize_animation_size=True, export_anim_slide_to_zero=False,
        export_bake_animation=False, export_frame_step=1, export_meshopt_compression_enable=True)
    return os.path.getsize(ruta)
