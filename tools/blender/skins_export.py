# Arma y exporta los accesorios de las skins. Uso (desde tools/blender, con bpy de pip o Blender en modo fondo):
#   python3 skins_export.py            → skins_raw.glb sin comprimir
#   npx gltf-transform meshopt skins_raw.glb ../../public/models/skins.glb
import os
import sys
import bpy

AQUI = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
exec(open(os.path.join(AQUI, 'skins_base.py')).read())
exec(open(os.path.join(AQUI, 'skins.py')).read())
nombres = armar_todo()
salida = sys.argv[1] if len(sys.argv) > 1 else os.path.join(AQUI, 'skins_raw.glb')
print('objetos:', len(nombres))
print(exportar_skins(salida))
