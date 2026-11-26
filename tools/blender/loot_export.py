# Exporta el cofre y los objetos del piso (requiere loot_modelos.py con cofre() / objetos() ya hechos y horneados).
# - cofre.glb: raíz 'cofre' con 'cofre_cuerpo' y 'cofre_tapa' (pivote en la bisagra; abre girando sobre X).
#   Cada nodo es un vacío en el pivote con la malla como hija ('<nombre>_malla').
# - objetos.glb: raíz 'objetos' con un nodo 'objetos_<nombre>' por objeto, con el pivote en su centro.
# bpy como módulo no trae meshopt: después se comprime con gltf-transform (ver Vault/Herramientas/Pipeline del loot).
import bpy, os


def _pivotes_vacios(col):
    # cada pieza queda como un vacío con su nombre (en el pivote) y la malla como hija sin transformación: al
    # cuantizar, gltf-transform mete escala y corrimiento en el nodo de la malla, y así no toca el pivote.
    for ob in [o for o in col.objects if o.type == 'MESH' and o.parent and o.parent.type == 'EMPTY']:
        nombre = ob.name
        e = bpy.data.objects.new(nombre + '_tmp', None)
        e.empty_display_size = 0.03
        col.objects.link(e)
        e.parent = ob.parent
        e.matrix_local = ob.matrix_local.copy()
        ob.name = nombre + '_malla'
        e.name = nombre
        ob.parent = e
        ob.matrix_local.identity()


def exportar_loot(nombre, ruta, calidad=86):
    col = bpy.data.collections['exp_' + nombre]
    _pivotes_vacios(col)
    col.hide_render = False
    col.hide_viewport = False
    for o in bpy.data.objects:
        try:
            o.select_set(False)
        except RuntimeError:
            pass
    objs = list(col.objects)
    for o in objs:
        o.hide_set(False)
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(
        filepath=ruta, export_format='GLB', use_selection=True, use_active_scene=True, export_yup=True,
        export_apply=False, export_image_format='WEBP', export_image_quality=calidad, export_unused_images=False,
        export_tangents=False, export_extras=False, export_animations=False)
    return os.path.getsize(ruta)
