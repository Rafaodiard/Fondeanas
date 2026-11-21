# Materiales procedurales del héroe (para hornear a la textura del juego).
# Requiere sf_tools.py (builtins.SF) y las imágenes de tools/texturas en D\tex.
# Todo se evalúa en coordenadas de mundo o de objeto de las piezas de alta resolución,
# así el horneado "selected to active" toma el color de la pieza original.
import bpy, math, os
from mathutils import Vector

ss = SF.ss
TEX_DIR = os.path.join(os.path.dirname(bpy.data.filepath), 'tex')
YC, Z0, Z1 = -0.055, 1.50, 1.92   # proyección cilíndrica de la cara (igual que tools/texturas/cara.py)


class G:
    # Mini constructor de árboles de nodos.
    def __init__(s, mat):
        mat.use_nodes = True
        s.m = mat
        s.nt = mat.node_tree
        s.nt.nodes.clear()
        s.out = s.n('ShaderNodeOutputMaterial')
        s.bsdf = s.n('ShaderNodeBsdfPrincipled')
        s.l(s.bsdf.outputs[0], s.out.inputs[0])
        s._pos = None

    def n(s, t, **kw):
        nd = s.nt.nodes.new(t)
        for k, v in kw.items():
            setattr(nd, k, v)
        return nd

    def l(s, a, b):
        s.nt.links.new(a, b)

    def put(s, sock, v):
        if isinstance(v, bpy.types.NodeSocket):
            s.l(v, sock)
        else:
            sock.default_value = v

    def pos(s):
        if s._pos is None:
            s._pos = s.n('ShaderNodeNewGeometry').outputs['Position']
        return s._pos

    def obj(s):
        return s.n('ShaderNodeTexCoord').outputs['Object']

    def math(s, op, a, b=None, c=None, clamp=False):
        nd = s.n('ShaderNodeMath', operation=op, use_clamp=clamp)
        s.put(nd.inputs[0], a)
        if b is not None:
            s.put(nd.inputs[1], b)
        if c is not None:
            s.put(nd.inputs[2], c)
        return nd.outputs[0]

    def vm(s, op, a, b=None, scale=None):
        nd = s.n('ShaderNodeVectorMath', operation=op)
        s.put(nd.inputs[0], a)
        if b is not None:
            s.put(nd.inputs[1], b)
        if scale is not None:
            s.put(nd.inputs['Scale'], scale)
        return nd.outputs['Value'] if op in ('DOT_PRODUCT', 'LENGTH', 'DISTANCE') else nd.outputs['Vector']

    def sep(s, v):
        nd = s.n('ShaderNodeSeparateXYZ')
        s.put(nd.inputs[0], v)
        return nd.outputs

    def comb(s, x, y, z=0.0):
        nd = s.n('ShaderNodeCombineXYZ')
        for i, v in enumerate((x, y, z)):
            s.put(nd.inputs[i], v)
        return nd.outputs[0]

    def rng(s, v, a, b, c=0.0, d=1.0, interp='SMOOTHSTEP'):
        nd = s.n('ShaderNodeMapRange', interpolation_type=interp, clamp=True)
        s.put(nd.inputs[0], v)
        nd.inputs[1].default_value = a
        nd.inputs[2].default_value = b
        nd.inputs[3].default_value = c
        nd.inputs[4].default_value = d
        return nd.outputs[0]

    def mix(s, fac, a, b, blend='MIX'):
        nd = s.n('ShaderNodeMix', data_type='RGBA', blend_type=blend, clamp_factor=True)
        s.put(nd.inputs[0], fac)
        A = [i for i in nd.inputs if i.name == 'A' and i.type == 'RGBA'][0]
        B = [i for i in nd.inputs if i.name == 'B' and i.type == 'RGBA'][0]
        s.put(A, tuple(a) + (1.0,) if isinstance(a, (tuple, list)) and len(a) == 3 else a)
        s.put(B, tuple(b) + (1.0,) if isinstance(b, (tuple, list)) and len(b) == 3 else b)
        return [o for o in nd.outputs if o.name == 'Result' and o.type == 'RGBA'][0]

    def noise(s, vec, scale, detail=3.0, rough=0.5, dims='3D'):
        nd = s.n('ShaderNodeTexNoise', noise_dimensions=dims)
        if vec is not None:
            s.put(nd.inputs['Vector'], vec)
        nd.inputs['Scale'].default_value = scale
        nd.inputs['Detail'].default_value = detail
        nd.inputs['Roughness'].default_value = rough
        return nd.outputs['Fac']

    def wave(s, vec, period, axis='Z', distortion=0.0, profile='SIN'):
        nd = s.n('ShaderNodeTexWave', wave_type='BANDS', bands_direction=axis, wave_profile=profile)
        if vec is not None:
            s.put(nd.inputs['Vector'], vec)
        nd.inputs['Scale'].default_value = (2 * math.pi / 20) / period
        nd.inputs['Distortion'].default_value = distortion
        return nd.outputs['Fac']

    def img(s, name, vec, extension='CLIP'):
        im = bpy.data.images.get(name)
        if im is None:
            im = bpy.data.images.load(os.path.join(TEX_DIR, name))
            im.pack()
        im.colorspace_settings.name = 'Non-Color'
        nd = s.n('ShaderNodeTexImage', image=im, extension=extension, interpolation='Cubic')
        s.put(nd.inputs['Vector'], vec)
        sc = s.n('ShaderNodeSeparateColor')
        s.l(nd.outputs['Color'], sc.inputs[0])
        return sc.outputs

    def bump(s, height, strength, distance=0.002):
        nd = s.n('ShaderNodeBump')
        nd.inputs['Strength'].default_value = strength
        nd.inputs['Distance'].default_value = distance
        s.put(nd.inputs['Height'], height)
        s.l(nd.outputs['Normal'], s.bsdf.inputs['Normal'])

    def set(s, color, rough, metal=0.0):
        s.put(s.bsdf.inputs['Base Color'], color if isinstance(color, bpy.types.NodeSocket) else tuple(color) + (1.0,))
        s.put(s.bsdf.inputs['Roughness'], rough)
        s.bsdf.inputs['Metallic'].default_value = metal
        if not isinstance(color, bpy.types.NodeSocket):
            s.m.diffuse_color = tuple(color) + (1.0,)


def _c(mat):
    return tuple(mat.diffuse_color[:3])


def _scale(c, k):
    return tuple(min(1.0, x * k) for x in c)


def variado(g, base, amp=0.12, scale=18.0, grain=0.0, grain_scale=400.0):
    # color base con manchas suaves (y grano fino opcional) para que no quede plástico
    n1 = g.noise(g.pos(), scale, 4.0, 0.55)
    col = g.mix(g.rng(n1, 0.3, 0.7), _scale(base, 1 - amp), _scale(base, 1 + amp))
    if grain:
        n2 = g.noise(g.pos(), grain_scale, 2.0, 0.5)
        col = g.mix(g.rng(n2, 0.35, 0.65, 0, grain), col, _scale(base, 0.75), 'MIX')
    return col


# ---------------------------------------------------------------------------
def piel():
    m = bpy.data.materials['M_Piel']
    g = G(m)
    base = (0.62, 0.29, 0.165)
    P = g.pos()
    x, y, z = g.sep(P)
    # proyección cilíndrica para las máscaras de la cara
    yy = g.math('MULTIPLY', g.math('SUBTRACT', y, YC), -1.0)
    u = g.math('ADD', g.math('DIVIDE', g.math('ARCTAN2', x, yy), 2 * math.pi), 0.5)
    v = g.math('DIVIDE', g.math('SUBTRACT', z, Z0), Z1 - Z0)
    uv = g.comb(u, v)
    A = g.img('cara_a.png', uv)
    B = g.img('cara_b.png', uv)
    col = variado(g, base, 0.06, 30.0)
    # rubor y ojeras
    col = g.mix(g.math('MULTIPLY', B['Red'], 0.55), col, (0.62, 0.17, 0.11))
    col = g.mix(g.math('MULTIPLY', B['Green'], 0.45), col, (0.36, 0.17, 0.13))
    # labios
    col = g.mix(g.math('MULTIPLY', A['Green'], 0.8), col, (0.42, 0.12, 0.09))
    # barba de dos días
    col = g.mix(g.math('MULTIPLY', A['Blue'], 0.8), col, (0.075, 0.055, 0.05))
    # cejas
    col = g.mix(g.math('MULTIPLY', A['Red'], 0.95), col, (0.028, 0.016, 0.01))
    # cicatriz
    col = g.mix(g.math('MULTIPLY', B['Blue'], 0.8), col, (0.78, 0.42, 0.33))
    # tatuaje en la cara externa del antebrazo izquierdo
    tat = _tatuaje_coords()
    if tat:
        P0, U, V, N, size = tat
        d = g.vm('SUBTRACT', P, P0)
        tu = g.math('ADD', g.math('DIVIDE', g.vm('DOT_PRODUCT', d, U), size), 0.5)
        tv = g.math('ADD', g.math('DIVIDE', g.vm('DOT_PRODUCT', d, V), size), 0.5)
        dn = g.vm('DOT_PRODUCT', d, N)
        lado = g.rng(dn, -0.035, -0.02)   # solo la cara de afuera del brazo
        T = g.img('tatuaje.png', g.comb(tu, tv))
        f = g.math('MULTIPLY', g.math('MULTIPLY', T['Red'], lado), 0.85)
        col = g.mix(f, col, (0.018, 0.035, 0.045))
    rough = g.math('ADD', 0.5, g.math('MULTIPLY', A['Green'], -0.12))
    g.set(col, rough)
    g.bsdf.inputs['Subsurface Weight'].default_value = 0.15
    g.bsdf.inputs['Subsurface Radius'].default_value = (0.012, 0.004, 0.002)
    m.diffuse_color = base + (1,)


def _tatuaje_coords():
    a = bpy.data.objects.get('Esqueleto')
    cu = bpy.data.objects['Cuerpo']
    if not a:
        return None
    b = a.data.bones['LowerArm.L']
    e, w = a.matrix_world @ b.head_local, a.matrix_world @ b.tail_local
    U = (w - e).normalized()
    C = e.lerp(w, 0.5)
    out = Vector((1, -0.25, 0))
    out = (out - U * out.dot(U)).normalized()
    best, bn = None, None
    mw = cu.matrix_world
    for v in cu.data.vertices:
        p = mw @ v.co
        d = p - C
        if abs(d.dot(U)) > 0.03:
            continue
        s_ = d.dot(out)
        if best is None or s_ > best[0]:
            best = (s_, p)
            bn = (mw.to_3x3() @ v.normal).normalized()
    P0 = best[1]
    N = (bn - U * bn.dot(U)).normalized()
    V = N.cross(U).normalized()
    return tuple(P0), tuple(U), tuple(V), tuple(N), 0.085


def ojos():
    m = bpy.data.materials['M_Ojo']
    g = G(m)
    o = g.obj()
    d = g.vm('NORMALIZE', o)
    x, y, z = g.sep(d)
    c = g.math('MULTIPLY', y, -1.0)        # 1 en el centro del ojo (mira a -Y)
    ang = g.math('ARCCOSINE', g.math('MINIMUM', c, 1.0))
    # iris con vetas radiales
    th = g.math('ARCTAN2', x, z)
    vet = g.noise(g.comb(g.math('MULTIPLY', th, 6.0), g.math('MULTIPLY', ang, 3.0)), 3.0, 4.0, 0.6, '2D')
    iris = g.mix(g.rng(ang, 0.12, 0.40), (0.10, 0.05, 0.016), (0.055, 0.04, 0.02))
    iris = g.mix(g.rng(vet, 0.35, 0.75, 0, 0.5), iris, (0.17, 0.09, 0.03))
    iris = g.mix(g.rng(ang, 0.36, 0.45), iris, (0.012, 0.01, 0.008))     # anillo límbico
    pup = g.mix(g.rng(ang, 0.15, 0.18), (0.004, 0.004, 0.004), iris)
    escl = g.mix(g.rng(ang, 0.9, 1.6), (0.80, 0.74, 0.70), (0.66, 0.44, 0.40))
    col = g.mix(g.rng(ang, 0.45, 0.49), pup, escl)
    g.set(col, 0.06)
    m.diffuse_color = (0.8, 0.75, 0.7, 1)


def pelo():
    m = bpy.data.materials['Pelo']
    g = G(m)
    P = g.pos()
    # mechones: bandas finas a lo largo de Y (el pelo va de adelante hacia atrás) con distorsión
    w1 = g.wave(P, 0.006, 'X', 3.0)
    w2 = g.noise(g.comb(g.math('MULTIPLY', g.sep(P)[0], 220.0), g.math('MULTIPLY', g.sep(P)[1], 18.0), g.math('MULTIPLY', g.sep(P)[2], 60.0)), 1.0, 3.0, 0.6)
    base = (0.040, 0.021, 0.011)
    col = g.mix(g.rng(w2, 0.3, 0.75), _scale(base, 0.7), (0.085, 0.048, 0.025))
    col = g.mix(g.rng(w1, 0.6, 1.0, 0, 0.25), col, (0.075, 0.042, 0.022))
    g.set(col, 0.6)
    g.bump(g.math('ADD', w1, g.math('MULTIPLY', w2, 0.5)), 0.35, 0.0015)
    m.diffuse_color = base + (1,)

    m = bpy.data.materials['M_PeloCorto']
    g = G(m)
    n = g.noise(g.pos(), 900.0, 2.0, 0.5)
    z = g.sep(g.pos())[2]
    col = g.mix(g.rng(n, 0.35, 0.65), (0.06, 0.04, 0.03), (0.022, 0.014, 0.01))
    # degradé (fade): abajo deja ver más piel
    col = g.mix(g.rng(z, 1.66, 1.775, 0.6, 0.0), col, (0.34, 0.17, 0.10))
    g.set(col, 0.75)
    g.bump(n, 0.25, 0.001)


def chaleco():
    # chaleco acolchado: costuras horizontales cada ~5,5 cm con relleno entre medio
    m = bpy.data.materials['M_Chaleco']
    g = G(m)
    base = _c(m)
    P = g.pos()
    w = g.wave(P, 0.055, 'Z', 0.0, 'SIN')
    acol = g.rng(w, 0.0, 0.35)            # 0 en la costura, 1 en el relleno
    col = variado(g, base, 0.1, 14.0, 0.25, 500.0)
    col = g.mix(acol, _scale(base, 0.62), col)
    g.set(col, 0.7)
    g.bump(g.math('POWER', acol, 0.6), 0.9, 0.004)
    m.diffuse_color = base + (1,)


def tela(name, amp=0.12, rough=0.85, grain=0.2, weave=0.0, sucio=0.0):
    m = bpy.data.materials[name]
    g = G(m)
    base = _c(m)
    col = variado(g, base, amp, 16.0, grain, 450.0)
    if sucio:   # polvo abajo (botamanga) y en rodillas
        z = g.sep(g.pos())[2]
        col = g.mix(g.rng(z, 0.25, 0.55, sucio, 0.0), col, (0.17, 0.13, 0.08))
    g.set(col, rough)
    n = g.noise(g.pos(), 350.0, 2.0, 0.5)
    h = n
    if weave:
        h = g.math('ADD', g.math('MULTIPLY', g.wave(g.pos(), 0.0025, 'X'), 0.5), n)
    g.bump(h, 0.12 + weave, 0.001)


def cuero(name, amp=0.15, rough=0.5, desgaste=0.25):
    m = bpy.data.materials[name]
    g = G(m)
    base = _c(m)
    col = variado(g, base, amp, 22.0)
    # gastado más claro en las zonas convexas (puntera, talón, cantos)
    geo = g.n('ShaderNodeNewGeometry')
    pt = g.rng(geo.outputs['Pointiness'], 0.52, 0.62, 0, desgaste)
    col = g.mix(pt, col, _scale(base, 1.7))
    g.set(col, rough)
    n = g.noise(g.pos(), 600.0, 3.0, 0.6)
    g.bump(n, 0.2, 0.0008)


def correa(name, rough=0.7):
    # cinta de nylon: trama fina a lo largo
    m = bpy.data.materials[name]
    g = G(m)
    base = _c(m)
    col = variado(g, base, 0.15, 30.0, 0.3, 700.0)
    g.set(col, rough)
    g.bump(g.noise(g.pos(), 700.0, 1.0, 0.5), 0.3, 0.0008)


def lisa(name, rough=None, metal=None, amp=0.06):
    m = bpy.data.materials[name]
    g = G(m)
    base = _c(m)
    g.set(variado(g, base, amp, 25.0), m.roughness if rough is None else rough, m.metallic if metal is None else metal)


def bufanda():
    m = bpy.data.materials['M_Bufanda']
    g = G(m)
    base = _c(m)
    P = g.pos()
    # tejido acanalado: bandas verticales finas + manchas suaves
    w = g.wave(P, 0.006, 'Z', 2.0)
    col = variado(g, base, 0.12, 12.0, 0.2, 400.0)
    col = g.mix(g.rng(w, 0.0, 1.0, 0, 0.3), col, _scale(base, 0.7))
    g.set(col, 0.95)
    g.bump(w, 0.35, 0.002)


def todo():
    bpy.data.materials['M_Chaleco'].diffuse_color = (0.20, 0.035, 0.03, 1)
    bpy.data.materials['M_Pantalon'].diffuse_color = (0.12, 0.13, 0.065, 1)
    piel()
    ojos()
    pelo()
    chaleco()
    tela('M_Camiseta', 0.1, 0.9, 0.2)
    tela('M_Pantalon', 0.12, 0.9, 0.25, 0.0, 0.5)
    tela('M_Bolsas', 0.12, 0.85, 0.25)
    tela('M_RodilleraBase', 0.1, 0.85, 0.2)
    bufanda()
    for n in ('M_Bota', 'M_Cinturon', 'M_Arnes', 'M_Funda'):
        cuero(n)
    cuero('M_RibeteChaleco', 0.12, 0.55, 0.15)
    for n in ('M_Correa', 'M_Cordon'):
        correa(n)
    tela('Guante', 0.1, 0.55, 0.15)
    lisa('M_Suela', 0.85, 0.0)
    lisa('M_RodilleraCasco', 0.35, 0.0)
    lisa('M_FundaCasco', 0.35, 0.0)
    lisa('M_ArmaFunda', 0.4, 0.3)
    lisa('M_AntiparrasGoma', 0.6, 0.0)
    lisa('M_AntiparrasAro', 0.3, 0.9)
    lisa('M_Hebilla', 0.3, 1.0)
    lisa('M_Lente', 0.08, 0.2, 0.02)


def luces():
    # set de luces para las vistas previas con Eevee (no se exporta)
    col = bpy.data.collections.get('_Luces')
    if col is None:
        col = bpy.data.collections.new('_Luces')
        bpy.context.scene.collection.children.link(col)
    for o in list(col.objects):
        bpy.data.objects.remove(o)
    for name, kind, en, rot, loc, size in (
            ('Clave', 'AREA', 260, (math.radians(55), 0, math.radians(-35)), (-2.2, -2.6, 3.0), 2.0),
            ('Relleno', 'AREA', 90, (math.radians(70), 0, math.radians(40)), (2.5, -2.2, 2.0), 3.0),
            ('Contra', 'AREA', 220, (math.radians(-60), 0, math.radians(10)), (0.6, 2.8, 2.8), 1.5)):
        ld = bpy.data.lights.new(name, kind)
        ld.energy = en
        ld.size = size
        o = bpy.data.objects.new(name, ld)
        o.rotation_euler = rot
        o.location = loc
        col.objects.link(o)
    w = bpy.context.scene.world or bpy.data.worlds.new('Mundo')
    bpy.context.scene.world = w
    w.use_nodes = True
    bg = [n for n in w.node_tree.nodes if n.type == 'BACKGROUND'][0]
    bg.inputs[0].default_value = (0.32, 0.34, 0.38, 1)
    bg.inputs[1].default_value = 0.6
