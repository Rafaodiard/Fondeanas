# Exporta el héroe para el juego: malla con piel, esqueleto (con el hueso Arma.R), todas las acciones y
# texturas WebP. Requiere heroe_anim.py y heroe_clips.py ejecutados antes (para rehacer los clips).
import bpy, os, base64

ALTO = 0.032          # el esqueleto sube esto al exportar para que la suela quede en y = 0
ACCIONES = None       # None = todas las de MARCHAS y CLIPS


def _solo(objs, activo):
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.hide_set(False)
        o.select_set(True)
    bpy.context.view_layer.objects.active = activo


def exportar(ruta, calidad=82, rehacer=True):
    arm = bpy.data.objects['Esqueleto']
    m = bpy.data.objects['HeroeJuego']
    if rehacer:
        todos()
    pr = bpy.data.objects.get('_ProxyArma')
    if pr:
        bpy.data.objects.remove(pr, do_unlink=True)
    nombres = set(ACCIONES or (list(MARCHAS) + list(CLIPS)))
    # las acciones viejas o de prueba no viajan
    for a in bpy.data.actions:
        a.use_fake_user = a.name in nombres
    arm.animation_data_create()
    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)
    arm.data.pose_position = 'POSE'
    loc0 = arm.location.copy()
    arm.location.z = loc0.z + ALTO
    bpy.context.view_layer.update()
    _solo([arm, m], arm)
    try:
        bpy.ops.export_scene.gltf(
            filepath=ruta, export_format='GLB', use_selection=True,
            export_image_format='WEBP', export_image_quality=calidad, export_unused_images=False,
            export_tangents=False, export_extras=False, export_yup=True, export_apply=False,
            export_skins=True, export_def_bones=False, export_leaf_bone=False, export_rest_position_armature=True,
            export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True,
            export_optimize_animation_size=True, export_anim_single_armature=True, export_reset_pose_bones=True,
            export_anim_slide_to_zero=True, export_bake_animation=False, export_frame_step=1)
    finally:
        arm.location = loc0
        bpy.context.view_layer.update()
    return os.path.getsize(ruta)


def trozo(ruta, i, tam=1500000):
    # pedazo i (en base64) del archivo, para pasarlo fuera de Blender
    with open(ruta, 'rb') as f:
        f.seek(i * tam)
        b = f.read(tam)
    return {'i': i, 'n': (os.path.getsize(ruta) + tam - 1) // tam, 'b64': base64.b64encode(b).decode()}
