# Trae el héroe del juego a Blender desde public/models/personaje.glb, para hacer clips nuevos sin el .blend original.
# El GLB viene con meshopt y el bpy de pip no lo decodifica: antes hay que pasarlo por gltf-transform
#   gltf-transform copy public/models/personaje.glb /tmp/pj_raw.glb
# Deja en la escena el esqueleto 'Esqueleto' y la malla 'HeroeJuego' con los mismos nombres de hueso, ejes y reposo
# que el original (la prueba: rehacer 'Caida' con heroe_clips.py da las mismas pistas que el GLB).
import bpy


def importar_heroe(ruta):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=ruta, bone_heuristic='BLENDER')
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    arm.name = 'Esqueleto'
    malla = next(o for o in bpy.data.objects if o.type == 'MESH' and o.parent == arm)
    malla.name = 'HeroeJuego'
    # el importador deja una esfera de muestra para los huesos: no hace falta
    for o in list(bpy.data.objects):
        if o not in (arm, malla) and o.type == 'MESH' and o.parent is None:
            bpy.data.objects.remove(o, do_unlink=True)
    # al exportar se había subido el esqueleto 0,032 (ALTO de heroe_export.py): se deshace para que el piso quede en SUELO
    arm.location.z -= 0.032
    bpy.context.scene.render.fps = 24
    arm.animation_data_create()
    arm.animation_data.action = None
    bpy.context.view_layer.update()
    return arm, malla
