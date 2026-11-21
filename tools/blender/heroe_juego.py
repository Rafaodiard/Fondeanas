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
