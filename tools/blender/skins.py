# Accesorios de las skins y picos nuevos (public/models/skins.glb). Se carga después de skins_base.py:
#   exec(open('skins_base.py').read()); exec(open('skins.py').read()); armar_todo(); exportar_skins('public/models/skins.glb')
# Cada accesorio es un objeto 'acc_<id>' (o 'acc_<id>_L' / 'acc_<id>_R' si va en los brazos) y cada pico 'pico_<id>'.
# En qué hueso va cada accesorio lo decide huesoDe() en public/js/aspecto.js (por el nombre). Las cabezas enteras ('cab_*') reemplazan
# la cabeza del héroe: el juego esconde la cabeza original por encima de CORTE_CABEZA.
# Medidas del héroe (personaje.glb): cabeza centrada en (0, -0.05, 1.77), ±0.108 de ancho, de -0.19 (nariz) a +0.08
# (nuca), mentón a 1.62 y pelo hasta 1.936. Torso ±0.2 de ancho, espalda en y≈+0.16 entre z 1.1 y 1.5.

HC = Vector((0.0, -0.05, 1.77))     # centro de la cabeza
ACC = {}                             # id -> [piezas] (o {'L': [...], 'R': [...]})
PICOS = {}


def acc(nombre):
    def deco(fn):
        ACC[nombre] = fn
        return fn
    return deco


def pico(nombre):
    def deco(fn):
        PICOS[nombre] = fn
        return fn
    return deco


def h(x=0.0, y=0.0, z=0.0):
    # punto relativo al centro de la cabeza
    return (HC.x + x, HC.y + y, HC.z + z)


def cuello(mat='A', r=0.072, z0=1.555, z1=1.70):
    # tapa el corte del cuello de las cabezas enteras
    return cilindro(mat, (0, -0.035, (z0 + z1) / 2), r, r * 0.92, z1 - z0, seg=24)


def ojos(sep, loc_y, z, r, pupila=0.5, mirar=(0, -1, 0), mat_ojo='Ojo', mat_pup='C', esc=(1, 1, 1), x0=0.0):
    out = []
    for s in (-1, 1):
        c = Vector((x0 + s * sep, loc_y, z))
        out.append(esfera(mat_ojo, c, (r * esc[0], r * esc[1], r * esc[2]), seg=20, anillos=12))
        d = Vector(mirar).normalized()
        out.append(esfera(mat_pup, c + d * r * 0.78 * esc[1], (r * pupila, r * 0.3, r * pupila), seg=16, anillos=10))
    return out


# ===========================================================================================================
# SOMBREROS, CASCOS Y CARA (humanos: la cabeza del héroe queda)
@acc('gorra')
def _gorra():
    copa = torno('A', [(0.128, 0.0), (0.126, 0.03), (0.115, 0.065), (0.09, 0.095), (0.05, 0.115), (0.0, 0.12)], esc=(1, 1.16, 1))
    copa.mover(h(0, 0.004, 0.06), (-8, 0, 0))
    visera = placa('B', [(x, z) for x, z in [(-0.11, 0), (-0.1, 0.06), (-0.06, 0.105), (0, 0.12), (0.06, 0.105), (0.1, 0.06), (0.11, 0)]], 0.008, bisel=0.002)
    visera.mover(h(0, -0.135, 0.062), (-80, 0, 0))
    boton = esfera('C', h(0, 0.01, 0.18), 0.012)
    return [copa, visera, boton]


@acc('piluso')
def _piluso():
    p = torno('A', [(0.205, -0.045), (0.19, -0.03), (0.15, -0.008), (0.125, 0.0), (0.122, 0.06), (0.112, 0.1), (0.08, 0.118), (0.0, 0.122)], esc=(1, 1.12, 1))
    p.mover(h(0, -0.005, 0.05), (-8, 0, 0))
    cinta = torno('B', [(0.1265, 0.0), (0.126, 0.025)], esc=(1, 1.12, 1)).mover(h(0, -0.005, 0.052), (-8, 0, 0))
    return [p, cinta]


@acc('gorro_lana')
def _gorro_lana():
    p = torno('A', [(0.124, 0.0), (0.124, 0.035), (0.118, 0.075), (0.1, 0.11), (0.065, 0.135), (0.0, 0.145)], esc=(1, 1.15, 1))
    p.mover(h(0, 0.0, 0.035), (-12, 0, 0))
    vuelta = toro('A', h(0, 0.0, 0.04), 0.124, 0.02, (-12, 0, 0), esc=(1, 1.15, 1))
    pompon = esfera('B', h(0, 0.035, 0.195), 0.045, seg=20, anillos=12).deformar(
        lambda v: v + (v - Vector(h(0, 0.035, 0.195))).normalized() * 0.006 * math.sin(v.x * 300) * math.sin(v.z * 300))
    return [p, vuelta, pompon]


@acc('mohicano')
def _mohicano():
    out = []
    for i in range(7):
        t = i / 6
        a = math.radians(35 + 125 * t)            # de la frente a la nuca
        base = Vector(h(0, -math.cos(a) * 0.115 - 0.02, math.sin(a) * 0.14 + 0.03))
        d = (base - Vector(h(0, 0, -0.02))).normalized()
        largo = 0.09 + 0.05 * math.sin(t * math.pi)
        out.append(cuerno('A', base - d * 0.02, d + Vector((0, 0.35, 0)), largo, 0.028, seg=10))
    out.append(caja('A', h(0, -0.01, 0.16), (0.03, 0.2, 0.04), (-12, 0, 0), bisel=0.012))
    return out


@acc('casco_bombero')
def _casco_bombero():
    copa = torno('A', [(0.135, 0.0), (0.13, 0.05), (0.11, 0.1), (0.07, 0.135), (0.0, 0.145)], esc=(1, 1.15, 1)).mover(h(0, 0.0, 0.05), (-6, 0, 0))
    # ala larga atrás y corta adelante
    ala = torno('A', [(0.13, 0.0), (0.19, -0.02), (0.2, -0.03)], seg=40).deformar(
        lambda v: Vector((v.x, v.y * (1.5 if v.y > 0 else 1.05), v.z - max(0, v.y) * 0.35)))
    ala.mover(h(0, 0.01, 0.05), (-6, 0, 0))
    cresta = placa('A', [(-0.0, 0.0), (0.0, 0.04), (0.0, 0.04)], 0.01)
    cresta = caja('A', h(0, 0.02, 0.19), (0.025, 0.22, 0.03), (-8, 0, 0), bisel=0.01)
    escudo = placa('Metal', [(-0.045, 0), (-0.05, 0.05), (-0.025, 0.08), (0, 0.09), (0.025, 0.08), (0.05, 0.05), (0.045, 0), (0, -0.025)], 0.01, bisel=0.003)
    escudo.mover(h(0, -0.155, 0.1), (-20, 0, 0))
    estrella = cilindro('D', h(0, -0.163, 0.125), 0.018, alto=0.01, rot=(70, 0, 0), seg=5)
    return [copa, ala, cresta, escudo, estrella]


@acc('sombrero_vaquero')
def _sombrero_vaquero():
    copa = torno('A', [(0.12, 0.0), (0.118, 0.06), (0.112, 0.1), (0.095, 0.115), (0.0, 0.1)], esc=(1, 1.25, 1),
                 f=lambda a, r, z: r * (1 - 0.18 * max(0, math.sin(a + math.pi / 2)) * (z / 0.115)))
    copa.mover(h(0, -0.005, 0.055), (-8, 0, 0))
    ala = torno('A', [(0.118, 0.0), (0.18, -0.002), (0.22, 0.008)], seg=48, esc=(1, 1.12, 1)).deformar(
        lambda v: Vector((v.x, v.y, v.z + (v.x ** 2) * 2.0)))
    ala.mover(h(0, -0.005, 0.055), (-8, 0, 0))
    # el ala con espesor
    ala2 = ala.copia().mover((0, 0, -0.008))
    banda = torno('B', [(0.1205, 0.0), (0.119, 0.022)], esc=(1, 1.25, 1)).mover(h(0, -0.005, 0.057), (-8, 0, 0))
    return [copa, ala, ala2, banda]


@acc('casco_vikingo')
def _casco_vikingo():
    copa = torno('Metal', [(0.13, 0.0), (0.128, 0.04), (0.112, 0.09), (0.075, 0.13), (0.0, 0.148)], esc=(1, 1.14, 1)).mover(h(0, 0.0, 0.04), (-6, 0, 0))
    aro = toro('B', h(0, 0.0, 0.045), 0.131, 0.014, (-6, 0, 0), esc=(1, 1.14, 1))
    cruz = caja('B', h(0, 0.0, 0.16), (0.022, 0.29, 0.03), (-8, 0, 0), bisel=0.008)
    nariz = caja('B', h(0, -0.16, 0.0), (0.022, 0.014, 0.085), (-8, 0, 0), bisel=0.005)
    out = [copa, aro, cruz, nariz]
    for s in (-1, 1):
        out.append(cuerno('A', h(s * 0.115, 0.0, 0.09), (s, 0.1, 0.45), 0.12, 0.026, curva_=(s * 0.0, -0.02, 0.07), seg=14))
        out.append(toro('B', h(s * 0.12, 0.0, 0.092), 0.03, 0.009, (0, 90 - s * 20, 0)))
    for k in range(10):
        a = 2 * math.pi * k / 10
        out.append(esfera('B', h(math.cos(a) * 0.135, math.sin(a) * 0.152, 0.045), 0.008, seg=10, anillos=6))
    return out


@acc('gorro_chef')
def _gorro_chef():
    banda = torno('B', [(0.122, 0.0), (0.124, 0.07)], esc=(1, 1.15, 1)).mover(h(0, -0.005, 0.045), (-8, 0, 0))
    out = [banda]
    copa = torno('A', [(0.12, 0.0), (0.135, 0.04), (0.16, 0.1), (0.165, 0.15), (0.15, 0.185), (0.1, 0.205), (0.0, 0.21)], esc=(1, 1.1, 1),
                 f=lambda a, r, z: r * (1 + 0.07 * math.cos(a * 7) * min(1, z / 0.08)))
    out.append(copa.mover(h(0, 0.005, 0.11), (-8, 0, 0)))
    return out


@acc('casco_buzo')
def _casco_buzo():
    c = Vector(h(0, 0.01, -0.0))
    bola = torno('Metal', [(0.0, -0.21), (0.13, -0.19), (0.2, -0.11), (0.222, 0.0), (0.205, 0.11), (0.14, 0.19), (0.0, 0.225)]).mover(c)
    out = [bola]
    # tres ventanas: adelante y a los costados
    for ang, esc_ in ((0, 1.0), (90, 0.7), (-90, 0.7)):
        d = Vector((math.sin(math.radians(ang)), -math.cos(math.radians(ang)), 0))
        p = c + d * 0.214 + Vector((0, 0, 0.01))
        rot = (90, 0, ang)
        out.append(toro('B', p, 0.085 * esc_, 0.016, rot))
        out.append(cilindro('Vidrio', p - d * 0.004, 0.082 * esc_, alto=0.012, rot=rot, seg=28))
        if ang == 0:
            for k in range(2):
                out.append(caja('B', p + d * 0.012 + Vector((0, 0, -0.03 + 0.06 * k)), (0.17, 0.012, 0.012)))
            out.append(caja('B', p + d * 0.012, (0.012, 0.012, 0.17)))
    cuello_ = cilindro('B', h(0, 0.01, -0.23), 0.17, 0.2, 0.05, seg=36)
    out.append(cuello_)
    for k in range(12):
        a = 2 * math.pi * k / 12
        out.append(esfera('B', h(math.cos(a) * 0.19, 0.01 + math.sin(a) * 0.19, -0.205), 0.011, seg=8, anillos=6))
    out.append(cilindro('B', h(0, 0.2, 0.08), 0.03, alto=0.06, rot=(70, 0, 0)))
    return out


@acc('casco_espacial')
def _casco_espacial():
    c = Vector(h(0, 0.0, 0.01))
    casco = torno('A', [(0.0, -0.2), (0.14, -0.175), (0.2, -0.09), (0.215, 0.0), (0.2, 0.1), (0.13, 0.18), (0.0, 0.205)]).mover(c)
    # visor: un casquete más grande adelante (dorado)
    visor = torno('Vidrio', [(0.0, 0.226), (0.06, 0.218), (0.12, 0.193), (0.17, 0.15), (0.2, 0.09)], a0=0, seg=32).mover(c + Vector((0, -0.005, 0.02)), (90, 0, 0)).deformar(
        lambda v: Vector((v.x * 1.02, v.y, v.z)))
    aro = toro('B', c + Vector((0, -0.112, 0.02)), 0.19, 0.012, (90, 0, 0), esc=(1, 1, 1))
    cuello_ = cilindro('B', h(0, 0.0, -0.205), 0.165, 0.19, 0.05, seg=36)
    antena = tubo('Metal', [h(0.12, 0.07, 0.15), h(0.14, 0.09, 0.27)], 0.006)
    punta = esfera('Luz', h(0.14, 0.09, 0.275), 0.014)
    luz_l = cilindro('Luz', h(0.2, -0.05, 0.03), 0.02, alto=0.02, rot=(0, 90, 0))
    return [casco, visor, aro, cuello_, antena, punta, luz_l]


@acc('yelmo')
def _yelmo():
    c = Vector(h(0, 0.0, 0.0))
    cubo = torno('Metal', [(0.0, -0.17), (0.15, -0.17), (0.152, -0.05), (0.148, 0.08), (0.135, 0.14), (0.09, 0.19), (0.0, 0.205)], esc=(1, 1.1, 1)).mover(c)
    ranura = caja('C', h(0, -0.163, 0.035), (0.2, 0.02, 0.022))
    cruz = caja('B', h(0, -0.168, 0.0), (0.03, 0.015, 0.2), bisel=0.004)
    out = [cubo, ranura, cruz]
    for k in range(6):
        out.append(cilindro('C', h(0.05 + (k % 3) * 0.022, -0.162 + 0.0, -0.06 - (k // 3) * 0.025), 0.006, alto=0.01, rot=(90, 0, 0), seg=8))
    out.append(toro('B', h(0, 0.0, -0.16), 0.152, 0.012, esc=(1, 1.1, 1)))
    # penacho
    for k in range(9):
        t = k / 8
        base = Vector(h(0, -0.05 + 0.2 * t, 0.19 - 0.03 * t))
        out.append(cuerno('A', base, (0, 0.6 + t, 0.8 - 0.6 * t), 0.14 + 0.05 * math.sin(t * math.pi), 0.025, curva_=(0, 0.05, -0.08 * t), seg=10))
    return out


@acc('corona')
def _corona():
    n = 8

    def picos(a, r, z):
        return r
    aro = torno('Metal', [(0.128, 0.0), (0.13, 0.05)], esc=(1, 1.12, 1)).mover(h(0, 0.0, 0.11), (-6, 0, 0))
    out = [aro]
    for k in range(n):
        a = 2 * math.pi * k / n
        d = Vector((math.cos(a), math.sin(a) * 1.12, 0))
        base = Vector(h(0, 0, 0.16)) + d * 0.128
        out.append(cono('Metal', base + Vector((0, 0, 0.04)), 0.034, 0.08, rot=(0, 0, 0), seg=4).deformar(lambda v, b=base: Vector((v.x, v.y, v.z)) ))
        out.append(esfera('Metal', base + Vector((0, 0, 0.085)), 0.011, seg=12, anillos=8))
        out.append(esfera('D', base + d * 0.004 + Vector((0, 0, -0.02)), (0.016, 0.016, 0.016), seg=12, anillos=8))
    out.append(esfera('Luz', h(0, -0.15, 0.135), (0.022, 0.012, 0.026)))
    out.append(esfera('C', h(0, 0.0, 0.135), (0.12, 0.13, 0.03)))   # terciopelo de adentro
    return out


@acc('capucha')
def _capucha():
    # capucha de tela: casquete abierto adelante que baja hasta los hombros
    c = Vector(h(0, 0.02, 0.0))
    capa = torno('A', [(0.0, 0.2), (0.09, 0.185), (0.15, 0.13), (0.172, 0.04), (0.17, -0.06), (0.17, -0.14), (0.2, -0.2), (0.26, -0.24)],
                 a0=math.radians(-55), a1=math.radians(235), seg=36)
    capa.mover(c).deformar(lambda v: Vector((v.x, v.y + max(0, -(v.z - c.z) - 0.1) * 0.25, v.z)))
    borde = tubo('B', [Vector(p) for p in curva([h(-0.1, -0.135, -0.13), h(-0.12, -0.14, 0.03), h(-0.07, -0.14, 0.17), h(0, -0.13, 0.2),
                                                   h(0.07, -0.14, 0.17), h(0.12, -0.14, 0.03), h(0.1, -0.135, -0.13)], 30)], 0.014, tapas=True)
    return [capa, capa.copia().mover((0, 0.0, 0.0), esc=1.0).deformar(lambda v: c + (v - c) * 1.06), borde]


@acc('mascara_ninja')
def _mascara_ninja():
    tela = torno('A', [(0.07, -0.16), (0.09, -0.145), (0.105, -0.115), (0.114, -0.07), (0.116, -0.03), (0.114, -0.005)], esc=(1, 1.25, 1)).mover(h(0, -0.05, 0.0))
    nudo = esfera('A', h(0, 0.105, -0.05), (0.03, 0.025, 0.03))
    tiras = [tubo('A', [h(0, 0.11, -0.05), h(s * 0.03, 0.17, -0.11), h(s * 0.05, 0.2, -0.17)], 0.012, achatar=0.4) for s in (-1, 1)]
    banda = torno('B', [(0.118, 0.06), (0.119, 0.095)], esc=(1, 1.18, 1)).mover(h(0, -0.02, 0.0))
    placa_ = caja('Metal', h(0, -0.168, 0.078), (0.07, 0.01, 0.03), (-10, 0, 0), bisel=0.004)
    return [tela, nudo, *tiras, banda, placa_]


@acc('auriculares')
def _auriculares():
    arco_ = tubo('A', arco(h(0, -0.02, 0.0), 0.14, 0, 180, 24, 'xz'), 0.013, achatar=0.5)
    out = [arco_]
    for s in (-1, 1):
        out.append(cilindro('C', h(s * 0.128, -0.02, 0.0), 0.06, alto=0.045, rot=(0, 90, 0), seg=24))
        out.append(cilindro('Luz', h(s * 0.152, -0.02, 0.0), 0.04, alto=0.008, rot=(0, 90, 0), seg=24))
        out.append(toro('A', h(s * 0.14, -0.02, 0.0), 0.058, 0.01, (0, 90, 0)))
    out.append(tubo('C', [h(-0.14, -0.05, -0.04), h(-0.11, -0.13, -0.08), h(-0.06, -0.165, -0.08)], 0.005))
    out.append(esfera('C', h(-0.055, -0.167, -0.08), 0.012))
    return out


@acc('lentes')
def _lentes():
    out = []
    for s in (-1, 1):
        out.append(cilindro('Vidrio', h(s * 0.042, -0.178, 0.008), 0.026, alto=0.006, rot=(90, 0, 0), seg=24, esc=(1.3, 1, 1)))
        out.append(toro('Metal', h(s * 0.042, -0.178, 0.008), 0.027, 0.0035, (90, 0, 0), esc=(1.3, 1, 1)))
        out.append(tubo('Metal', [h(s * 0.094, -0.168, 0.02), h(s * 0.11, -0.12, 0.025), h(s * 0.112, 0.0, 0.02), h(s * 0.105, 0.03, -0.0)], 0.0035))
    out.append(tubo('Metal', arco(h(0, -0.175, 0.002), 0.016, 30, 150, 8, 'xz'), 0.0035))
    return out


@acc('panuelo')
def _panuelo():
    tela = torno('A', [(0.07, -0.165), (0.09, -0.15), (0.105, -0.12), (0.114, -0.075), (0.115, -0.03)], esc=(1, 1.25, 1)).mover(h(0, -0.05, 0.0))
    punta = placa('A', [(-0.07, 0.0), (0.0, -0.07), (0.07, 0.0)], 0.008, bisel=0.002).mover(h(0, -0.165, -0.13), (-18, 0, 0))
    nudo = esfera('A', h(0, 0.1, -0.08), (0.028, 0.022, 0.025))
    return [tela, punta, nudo]


@acc('barba')
def _barba():
    # barba tupida que nace en las patillas, cubre la mandíbula y cae en punta con dos trenzas
    mand = torno('A', [(0.1, -0.13), (0.108, -0.1), (0.112, -0.06), (0.11, -0.02), (0.1, 0.01)], a0=math.radians(195), a1=math.radians(345), seg=24,
                 esc=(1, 1.27, 1)).mover(h(0, -0.045, 0))
    cuerpo = esfera('A', h(0, -0.155, -0.15), (0.085, 0.05, 0.075)).deformar(
        lambda v: Vector((v.x * (1 - max(0, -(v.z - (HC.z - 0.15))) * 3.0), v.y, v.z - max(0, -(v.z - (HC.z - 0.15))) * 0.6)))
    out = [mand, cuerpo]
    bigote = tubo('A', curva([h(-0.06, -0.165, -0.05), h(-0.025, -0.188, -0.035), h(0, -0.19, -0.038), h(0.025, -0.188, -0.035), h(0.06, -0.165, -0.05)], 12),
                  [0.008, 0.012, 0.015, 0.016, 0.016, 0.016, 0.016, 0.016, 0.016, 0.015, 0.012, 0.008, 0.007], seg=10)
    out.append(bigote)
    for s_ in (-1, 1):
        out.append(tubo('A', curva([h(s_ * 0.035, -0.17, -0.19), h(s_ * 0.04, -0.17, -0.25), h(s_ * 0.035, -0.165, -0.31)], 10), 0.012, seg=10))
        out.append(cilindro('Metal', h(s_ * 0.035, -0.165, -0.315), 0.014, alto=0.022))
    return out


@acc('galera')
def _galera():
    copa = torno('A', [(0.1, 0.0), (0.098, 0.1), (0.104, 0.19), (0.104, 0.2), (0.0, 0.2)], esc=(1, 1.12, 1)).mover(h(0, -0.005, 0.075), (-8, 0, 0))
    ala = torno('A', [(0.09, 0.0), (0.16, 0.0), (0.172, 0.012), (0.17, 0.018), (0.09, 0.006)], esc=(1, 1.12, 1), seg=48).deformar(
        lambda v: Vector((v.x, v.y, v.z + (v.x ** 2) * 1.2)))
    ala.mover(h(0, -0.005, 0.075), (-8, 0, 0))
    banda = torno('B', [(0.1005, 0.0), (0.0995, 0.035)], esc=(1, 1.12, 1)).mover(h(0, -0.005, 0.087), (-8, 0, 0))
    carta = placa('Ojo', [(-0.02, -0.028), (0.02, -0.028), (0.02, 0.028), (-0.02, 0.028)], 0.002).mover(h(0.07, -0.08, 0.11), (-10, 0, 35))
    flor = esfera('D', h(-0.075, -0.08, 0.105), 0.02)
    return [copa, ala, banda, carta, flor]


@acc('halo')
def _halo():
    return [toro('Luz', h(0, 0.02, 0.24), 0.11, 0.012, (-12, 0, 0), seg=40)]


@acc('cuernos_diablo')
def _cuernos_diablo():
    out = []
    for s in (-1, 1):
        out.append(cuerno('A', h(s * 0.07, -0.08, 0.12), (s * 0.4, -0.2, 1), 0.11, 0.026, curva_=(s * 0.03, 0.04, 0.0), seg=12))
    return out


@acc('cuello_vampiro')
def _cuello_vampiro():
    # cuello alto de capa (va en el pecho)
    perfil = [(0.15, 0.0), (0.16, 0.06), (0.19, 0.14), (0.23, 0.22)]
    cuello_ = torno('A', perfil, a0=math.radians(-20), a1=math.radians(200), seg=28).mover((0, 0.03, 1.5))
    dentro = torno('B', [(r - 0.006, z) for r, z in perfil], a0=math.radians(-20), a1=math.radians(200), seg=28).mover((0, 0.03, 1.5))
    broche = esfera('D', (0, -0.19, 1.5), 0.025)
    return [cuello_, dentro, broche]


# ===========================================================================================================
# CABEZAS ENTERAS (reemplazan la del héroe)
def cabeza_animal(fur='A', claro='B', craneo=(0.12, 0.125, 0.12), cz=0.02, hocico=0.1, hocico_r=0.06, hocico_z=-0.03,
                  orejas='punta', oreja_alto=0.1, oreja_ancho=0.07, oreja_ang=18, ojo_r=0.022, ojo_sep=0.05, ojo_z=0.03, ojo_y=None,
                  nariz_r=0.022, mejillas=False, pelo_cuello=True):
    c = Vector(h(0, 0.0, cz))
    out = [esfera(fur, c, craneo, seg=32, anillos=20), cuello(fur)]
    # hocico
    if hocico > 0:
        base = c + Vector((0, -craneo[1] * 0.55, hocico_z))
        punta = c + Vector((0, -craneo[1] * 0.55 - hocico, hocico_z - 0.012))
        out.append(tubo(claro, curva([base, (base + punta) / 2, punta], 8), [hocico_r, hocico_r * 0.85, hocico_r * 0.7, hocico_r * 0.6, hocico_r * 0.5, hocico_r * 0.45, hocico_r * 0.4, hocico_r * 0.35, hocico_r * 0.3], seg=20, achatar=0.8))
        out.append(esfera(claro, punta, hocico_r * 0.42))
        out.append(esfera('C', punta + Vector((0, -hocico_r * 0.25, hocico_r * 0.25)), (nariz_r * 1.2, nariz_r * 0.9, nariz_r * 0.85)))
        # boca
        out.append(tubo('C', curva([punta + Vector((-hocico_r * 0.5, hocico_r * 0.1, -hocico_r * 0.4)), punta + Vector((0, -hocico_r * 0.1, -hocico_r * 0.45)),
                                    punta + Vector((hocico_r * 0.5, hocico_r * 0.1, -hocico_r * 0.4))], 8), 0.004, seg=6))
    else:
        out.append(esfera('C', c + Vector((0, -craneo[1] * 0.98, -0.02)), (nariz_r * 1.2, nariz_r * 0.7, nariz_r * 0.8)))
    oy = ojo_y if ojo_y is not None else -craneo[1] * 0.82
    out += ojos(ojo_sep, c.y + oy, c.z + ojo_z, ojo_r, pupila=0.55, mat_ojo='Ojo', mat_pup='C')
    for s in (-1, 1):
        if orejas == 'punta':
            base = c + Vector((s * craneo[0] * 0.6, 0.0, craneo[2] * 0.72))
            out.append(oreja(fur, base, oreja_alto, oreja_ancho, 0.022, (0, s * oreja_ang, 0)))
            out.append(oreja(claro, base + Vector((0, -0.012, 0.01)), oreja_alto * 0.7, oreja_ancho * 0.6, 0.01, (0, s * oreja_ang, 0)))
        elif orejas == 'redonda':
            base = c + Vector((s * craneo[0] * 0.72, 0.0, craneo[2] * 0.72))
            out.append(esfera(fur, base, (oreja_ancho * 0.55, 0.022, oreja_ancho * 0.5), rot=(0, s * 30, 0)))
            out.append(esfera(claro, base + Vector((0, -0.012, 0)), (oreja_ancho * 0.35, 0.012, oreja_ancho * 0.32), rot=(0, s * 30, 0)))
        if mejillas:
            for k in range(3):
                out.append(cuerno(fur, c + Vector((s * craneo[0] * 0.8, -0.02, -0.04 - k * 0.025)), (s, 0.3, -0.25 - k * 0.2), 0.06, 0.025, seg=8))
    if pelo_cuello:
        out.append(toro(fur, (0, -0.03, 1.6), 0.085, 0.03, (0, 0, 0)))
    return out


@acc('cab_lobo')
def _cab_lobo():
    out = cabeza_animal(craneo=(0.115, 0.125, 0.115), hocico=0.13, hocico_r=0.05, orejas='punta', oreja_alto=0.12, oreja_ancho=0.07,
                        ojo_r=0.02, ojo_sep=0.048, ojo_z=0.035, mejillas=True)
    # ceño
    out.append(caja('A', h(0, -0.1, 0.06), (0.11, 0.03, 0.02), (-20, 0, 0), bisel=0.008))
    return out


@acc('cab_zorro')
def _cab_zorro():
    out = cabeza_animal(craneo=(0.11, 0.12, 0.105), hocico=0.12, hocico_r=0.04, hocico_z=-0.035, orejas='punta', oreja_alto=0.13,
                        oreja_ancho=0.085, oreja_ang=22, ojo_r=0.019, ojo_sep=0.046, ojo_z=0.025, mejillas=True, nariz_r=0.016)
    out.append(esfera('B', h(0, -0.075, -0.035), (0.085, 0.06, 0.05)))
    return out


@acc('cab_oso')
def _cab_oso():
    out = cabeza_animal(craneo=(0.13, 0.125, 0.12), hocico=0.06, hocico_r=0.058, hocico_z=-0.035, orejas='redonda', oreja_ancho=0.08,
                        ojo_r=0.017, ojo_sep=0.05, ojo_z=0.03, nariz_r=0.022)
    out.append(esfera('A', h(0, -0.02, -0.065), (0.12, 0.1, 0.06)))
    return out


@acc('cab_gato')
def _cab_gato():
    out = cabeza_animal(craneo=(0.118, 0.115, 0.108), hocico=0.03, hocico_r=0.045, hocico_z=-0.04, orejas='punta', oreja_alto=0.095,
                        oreja_ancho=0.085, oreja_ang=14, ojo_r=0.026, ojo_sep=0.048, ojo_z=0.02, nariz_r=0.013)
    for s in (-1, 1):
        for k in range(3):
            out.append(tubo('Ojo', [h(s * 0.035, -0.15, -0.045 + k * 0.01), h(s * 0.13, -0.15 + 0.01, -0.035 + k * 0.022)], 0.0018, seg=5))
    # pupilas finitas de gato
    return out


@acc('cab_yeti')
def _cab_yeti():
    c = Vector(h(0, 0.01, 0.03))
    out = [esfera('A', c, (0.14, 0.135, 0.14)), cuello('A', r=0.085)]
    random.seed(7)
    for k in range(46):
        th = random.uniform(0, 2 * math.pi)
        ph = random.uniform(-0.2, 1.3)
        d = Vector((math.cos(th) * math.cos(ph), math.sin(th) * math.cos(ph) * 1.0 + 0.25, math.sin(ph))).normalized()
        if d.y < -0.6 and abs(d.z) < 0.5:
            continue
        out.append(cuerno('A', c + d * 0.12, d + Vector((0, 0.3, -0.6)), 0.07, 0.03, seg=7, n=6))
    cara = esfera('B', c + Vector((0, -0.09, -0.02)), (0.095, 0.06, 0.09))
    out.append(cara)
    out += ojos(0.042, c.y - 0.135, c.z + 0.015, 0.016, pupila=0.6)
    out.append(caja('A', c + Vector((0, -0.135, 0.045)), (0.13, 0.04, 0.03), (-15, 0, 0), bisel=0.012))
    out.append(esfera('C', c + Vector((0, -0.155, -0.02)), (0.022, 0.015, 0.016)))
    boca = tubo('C', curva([c + Vector((-0.04, -0.14, -0.065)), c + Vector((0, -0.152, -0.075)), c + Vector((0.04, -0.14, -0.065))], 8), 0.006)
    out.append(boca)
    for s in (-1, 1):
        out.append(cono('Ojo', c + Vector((s * 0.03, -0.148, -0.082)), 0.007, 0.02, rot=(180, 0, 0), seg=8))
        out.append(cuerno('D', c + Vector((s * 0.1, 0.0, 0.08)), (s, 0.1, 0.6), 0.1, 0.022, curva_=(0, -0.04, 0.05), seg=10))
    return out


@acc('cab_rana')
def _cab_rana():
    c = Vector(h(0, -0.01, -0.01))
    out = [esfera('A', c, (0.14, 0.13, 0.095)), cuello('A')]
    out.append(esfera('B', c + Vector((0, -0.03, -0.045)), (0.125, 0.11, 0.05)))
    for s in (-1, 1):
        base = c + Vector((s * 0.075, -0.05, 0.075))
        out.append(esfera('A', base, 0.048))
        out.append(esfera('Ojo', base + Vector((0, -0.012, 0.012)), 0.04))
        out.append(esfera('C', base + Vector((0, -0.04, 0.02)), (0.018, 0.008, 0.024)))
        out.append(esfera('C', c + Vector((s * 0.025, -0.125, 0.025)), 0.006))
    boca = tubo('C', curva([c + Vector((-0.12, -0.04, -0.012)), c + Vector((-0.06, -0.12, -0.02)), c + Vector((0, -0.132, -0.022)),
                            c + Vector((0.06, -0.12, -0.02)), c + Vector((0.12, -0.04, -0.012))], 20), 0.006)
    out.append(boca)
    for k in range(8):
        a = random.Random(k).uniform(0.3, 2.8)
        out.append(esfera('D', c + Vector((math.cos(a) * 0.1, 0.03 + math.sin(a) * 0.05, 0.07)), 0.014 + 0.006 * (k % 3), seg=12, anillos=8))
    return out


@acc('cab_gallo')
def _cab_gallo():
    c = Vector(h(0, -0.01, 0.02))
    out = [esfera('A', c, (0.11, 0.12, 0.125)), cuello('A', r=0.075)]
    pico_ = cono('D', c + Vector((0, -0.15, -0.01)), 0.035, 0.08, rot=(90, 0, 0), seg=16)
    pico_.deformar(lambda v: Vector((v.x, v.y, v.z - max(0, -(v.y - c.y) - 0.13) * 0.4)))
    out.append(pico_)
    out.append(caja('C', c + Vector((0, -0.13, -0.012)), (0.05, 0.03, 0.004)))
    for k in range(5):
        t = k / 4
        out.append(esfera('B', c + Vector((0, -0.07 + t * 0.12, 0.11 + 0.03 * math.sin(t * math.pi))), (0.012, 0.028, 0.04 + 0.012 * math.sin(t * math.pi)), seg=14, anillos=10))
    out.append(esfera('B', c + Vector((0, -0.13, -0.07)), (0.018, 0.02, 0.035)))
    out += ojos(0.075, c.y - 0.05, c.z + 0.03, 0.02, pupila=0.6, mirar=(1, -0.6, 0))
    out[-1].mover((0, 0, 0))
    # plumas del cuello
    for k in range(10):
        a = 2 * math.pi * k / 10
        d = Vector((math.cos(a), math.sin(a), 0))
        out.append(cuerno('A', Vector((0, -0.03, 1.62)) + d * 0.07, d + Vector((0, 0, -0.8)), 0.08, 0.025, seg=8, n=6))
    return out


@acc('cab_pinguino')
def _cab_pinguino():
    c = Vector(h(0, -0.01, 0.02))
    out = [esfera('A', c, (0.122, 0.122, 0.13)), cuello('A', r=0.08)]
    out.append(esfera('B', c + Vector((0, -0.06, -0.01)), (0.095, 0.075, 0.1)))
    pico_ = cono('D', c + Vector((0, -0.16, -0.015)), 0.028, 0.075, rot=(90, 0, 0), seg=12)
    out.append(pico_)
    out += ojos(0.042, c.y - 0.11, c.z + 0.035, 0.018, pupila=0.6)
    for s in (-1, 1):
        for k in range(3):
            out.append(cuerno('D', c + Vector((s * 0.06, -0.08 + k * 0.012, 0.075)), (s * (0.9 - k * 0.15), 0.5 + k * 0.2, 0.2 + k * 0.15), 0.07 - k * 0.01, 0.006, curva_=(0, 0.01, -0.02), seg=6))
    return out


@acc('cab_tiburon')
def _cab_tiburon():
    c = Vector(h(0, 0.0, 0.03))
    cuerpo = torno('A', [(0.0, -0.18), (0.09, -0.15), (0.13, -0.06), (0.135, 0.04), (0.11, 0.13), (0.06, 0.2), (0.0, 0.23)], seg=32)
    cuerpo.mover(c + Vector((0, 0.0, 0.0)), (-90, 0, 0)).deformar(lambda v: Vector((v.x, v.y, c.z + (v.z - c.z) * 0.9)))
    out = [cuerpo, cuello('A', r=0.08)]
    panza = esfera('B', c + Vector((0, -0.08, -0.07)), (0.105, 0.14, 0.06))
    out.append(panza)
    boca = esfera('C', c + Vector((0, -0.16, -0.05)), (0.075, 0.03, 0.04))
    out.append(boca)
    for k in range(9):
        a = math.radians(200 + k * 140 / 8)
        p = c + Vector((math.cos(a) * 0.07, -0.168, -0.05 + math.sin(a) * 0.0 + 0.03))
        out.append(cono('Ojo', p, 0.008, 0.02, rot=(180, 0, 0), seg=6))
        out.append(cono('Ojo', p + Vector((0, 0.004, -0.06)), 0.008, 0.02, rot=(0, 0, 0), seg=6))
    aleta = placa('A', [(0.0, 0.0), (-0.02, 0.06), (-0.03, 0.12), (0.03, 0.12), (0.07, 0.03), (0.08, 0.0)], 0.018, bisel=0.006)
    out.append(aleta.mover(c + Vector((0, 0.0, 0.11)), (0, 0, 90)))
    for s in (-1, 1):
        out.append(esfera('C', c + Vector((s * 0.105, -0.095, 0.02)), 0.017))
        for k in range(3):
            out.append(caja('C', c + Vector((s * 0.128, 0.03 + k * 0.025, -0.02)), (0.004, 0.006, 0.05), (0, 0, 0)))
    return out


@acc('cab_dragon')
def _cab_dragon():
    c = Vector(h(0, 0.0, 0.02))
    out = [esfera('A', c, (0.11, 0.12, 0.11)), cuello('A', r=0.078)]
    hoc = tubo('A', curva([c + Vector((0, -0.06, -0.01)), c + Vector((0, -0.14, -0.025)), c + Vector((0, -0.21, -0.03))], 10),
               [0.075, 0.07, 0.065, 0.06, 0.056, 0.052, 0.05, 0.048, 0.045, 0.044, 0.042], seg=20, achatar=0.7)
    out.append(hoc)
    out.append(esfera('A', c + Vector((0, -0.21, -0.03)), (0.044, 0.03, 0.03)))
    out.append(esfera('B', c + Vector((0, -0.13, -0.07)), (0.06, 0.09, 0.025)))
    for s in (-1, 1):
        out.append(esfera('C', c + Vector((s * 0.02, -0.235, -0.015)), 0.007))
        out.append(esfera('Luz', c + Vector((s * 0.055, -0.09, 0.04)), (0.017, 0.012, 0.013)))
        out.append(caja('A', c + Vector((s * 0.05, -0.085, 0.065)), (0.06, 0.05, 0.016), (-15, 0, s * 20), bisel=0.006))
        out.append(cuerno('D', c + Vector((s * 0.06, 0.02, 0.07)), (s * 0.3, 1, 0.45), 0.17, 0.024, curva_=(0, 0.02, 0.08), seg=12))
        out.append(cuerno('D', c + Vector((s * 0.09, 0.03, 0.0)), (s * 0.6, 1, 0.1), 0.09, 0.015, seg=8))
        for k in range(4):
            out.append(cono('Ojo', c + Vector((s * (0.03 - k * 0.0), -0.17 - k * 0.012, -0.065)), 0.006, 0.018, rot=(180, 0, 0), seg=6))
    for k in range(5):
        t = k / 4
        out.append(cono('B', c + Vector((0, -0.04 + t * 0.2, 0.11 - t * 0.09)), 0.022, 0.05, rot=(-30 - t * 40, 0, 0), seg=6))
    return out


@acc('cab_alien')
def _cab_alien():
    c = Vector(h(0, 0.0, 0.0))
    craneo = torno('A', [(0.0, -0.13), (0.05, -0.125), (0.08, -0.09), (0.11, -0.02), (0.15, 0.08), (0.155, 0.15), (0.12, 0.215), (0.0, 0.24)], seg=36).mover(c, esc=(1, 0.92, 1))
    out = [craneo, cuello('A', r=0.06)]
    for s in (-1, 1):
        ojo = esfera('Vidrio', c + Vector((s * 0.06, -0.1, 0.03)), (0.05, 0.022, 0.03), rot=(0, s * -28, s * 22))
        out.append(ojo)
    out.append(tubo('C', curva([c + Vector((-0.015, -0.112, -0.085)), c + Vector((0, -0.116, -0.088)), c + Vector((0.015, -0.112, -0.085))], 6), 0.003, seg=6))
    for s in (-1, 1):
        out.append(esfera('C', c + Vector((s * 0.008, -0.123, -0.035)), 0.003))
    return out


@acc('antenas')
def _antenas():
    out = []
    for s in (-1, 1):
        pts = curva([h(s * 0.04, -0.02, 0.2), h(s * 0.07, -0.03, 0.28), h(s * 0.1, -0.06, 0.32)], 10)
        out.append(tubo('A', pts, 0.006, seg=8))
        out.append(esfera('Luz', h(s * 0.1, -0.06, 0.325), 0.018))
    return out


@acc('cab_calabaza')
def _cab_calabaza():
    c = Vector(h(0, 0.0, 0.01))
    perfil = [(0.0, -0.1), (0.07, -0.098), (0.12, -0.07), (0.15, -0.01), (0.15, 0.05), (0.12, 0.1), (0.06, 0.125), (0.0, 0.11)]
    cuerpo = torno('A', perfil, seg=56, f=lambda a, r, z: r * (1 + 0.07 * (abs(math.cos(a * 4.5)) ** 0.6 - 0.6)))
    out = [cuerpo.mover(c), cuello('B', r=0.06)]
    out.append(tubo('B', curva([c + Vector((0, 0, 0.1)), c + Vector((0.01, 0.01, 0.16)), c + Vector((0.04, 0.03, 0.19))], 8), [0.02, 0.018, 0.016, 0.014, 0.013, 0.012, 0.011, 0.01, 0.01], seg=7))
    hoja = placa('B', [(0, 0), (0.03, 0.02), (0.05, 0.0), (0.03, -0.015)], 0.004).mover(c + Vector((-0.02, 0.0, 0.12)), (0, -20, 30))
    out.append(hoja)
    # cara tallada: triángulos que brillan
    for s in (-1, 1):
        out.append(placa('Luz', [(-0.028, 0.0), (0.028, 0.0), (s * 0.006, 0.04)], 0.012).mover(c + Vector((s * 0.055, -0.143, 0.01)), (0, 0, 0)).deformar(
            lambda v: Vector((v.x, v.y + (v.x ** 2) * 1.5, v.z))))
    out.append(placa('Luz', [(-0.013, 0.0), (0.013, 0.0), (0.0, 0.02)], 0.012).mover(c + Vector((0, -0.15, -0.02))))
    boca = [(-0.085, 0.0), (-0.06, -0.025), (-0.04, -0.012), (-0.02, -0.035), (0.0, -0.02), (0.02, -0.035), (0.04, -0.012), (0.06, -0.025), (0.085, 0.0),
            (0.04, -0.06), (0.0, -0.068), (-0.04, -0.06)]
    out.append(placa('Luz', boca, 0.012).mover(c + Vector((0, -0.135, -0.025))).deformar(lambda v: Vector((v.x, v.y + (v.x ** 2) * 2.2, v.z))))
    return out


@acc('cab_calavera')
def _cab_calavera():
    c = Vector(h(0, -0.005, 0.02))
    craneo = torno('A', [(0.0, -0.06), (0.08, -0.05), (0.115, 0.0), (0.12, 0.06), (0.1, 0.12), (0.055, 0.15), (0.0, 0.155)], seg=36).mover(c, esc=(1, 1.1, 1))
    out = [craneo, cuello('A', r=0.05)]
    mand = torno('A', [(0.0, -0.12), (0.06, -0.12), (0.08, -0.09), (0.085, -0.05)], seg=24).mover(c + Vector((0, -0.03, 0.0)), esc=(1, 1.05, 1))
    out.append(mand)
    for s in (-1, 1):
        out.append(esfera('C', c + Vector((s * 0.043, -0.112, 0.03)), (0.034, 0.016, 0.03), rot=(0, 0, s * 12)))
        out.append(esfera('Luz', c + Vector((s * 0.043, -0.121, 0.03)), 0.007))
    out.append(placa('C', [(-0.012, 0.0), (0.012, 0.0), (0.0, 0.025)], 0.01).mover(c + Vector((0, -0.128, -0.025))))
    for k in range(7):
        x = -0.045 + k * 0.015
        out.append(caja('Ojo', c + Vector((x, -0.115 + abs(x) * 0.5, -0.07)), (0.012, 0.01, 0.022), bisel=0.003))
    out.append(caja('C', c + Vector((0, -0.118, -0.07)), (0.1, 0.006, 0.004)))
    # adorno de carnaval: flores en la frente
    for k, x in enumerate((-0.05, 0.0, 0.05)):
        out.append(esfera('D', c + Vector((x, -0.105, 0.095 + (0.012 if k == 1 else 0))), (0.018, 0.012, 0.018)))
    return out


@acc('cab_momia')
def _cab_momia():
    c = Vector(h(0, -0.0, 0.01))
    out = [esfera('A', c, (0.112, 0.13, 0.15)), cuello('A', r=0.07)]
    random.seed(3)
    for k in range(11):
        z = -0.13 + k * 0.026
        r = math.sqrt(max(0.0, 1 - (z / 0.15) ** 2))
        if r < 0.2:
            continue
        out.append(toro('A', c + Vector((0, 0, z)), 0.112 * r + 0.004, 0.009, (random.uniform(-14, 14), random.uniform(-8, 8), 0), esc=(1, 1.16, 1), seg=36, seg2=6))
    out.append(esfera('C', c + Vector((-0.04, -0.12, 0.02)), (0.03, 0.02, 0.016)))
    out.append(esfera('Luz', c + Vector((-0.04, -0.13, 0.02)), 0.011))
    out.append(tubo('A', curva([c + Vector((0.08, -0.05, -0.08)), c + Vector((0.12, 0.0, -0.14)), c + Vector((0.13, 0.05, -0.22))], 8), 0.012, achatar=0.3))
    return out


@acc('cab_robot')
def _cab_robot():
    c = Vector(h(0, -0.01, 0.03))
    out = [caja('A', c, (0.22, 0.22, 0.2), bisel=0.02), cilindro('Metal', (0, -0.035, 1.6), 0.06, alto=0.1, seg=12)]
    out.append(caja('Vidrio', c + Vector((0, -0.112, 0.015)), (0.18, 0.01, 0.085), bisel=0.006))
    for s in (-1, 1):
        out.append(cilindro('Luz', c + Vector((s * 0.045, -0.12, 0.018)), 0.02, alto=0.008, rot=(90, 0, 0), seg=16))
        out.append(cilindro('Metal', c + Vector((s * 0.115, 0, 0.0)), 0.04, alto=0.03, rot=(0, 90, 0), seg=16))
        out.append(cilindro('B', c + Vector((s * 0.132, 0, 0.0)), 0.022, alto=0.012, rot=(0, 90, 0), seg=6))
    for k in range(5):
        out.append(caja('C', c + Vector((-0.04 + k * 0.02, -0.112, -0.06)), (0.01, 0.008, 0.03)))
    out.append(tubo('Metal', [c + Vector((0.05, 0, 0.1)), c + Vector((0.06, 0.0, 0.18))], 0.005))
    out.append(esfera('Luz', c + Vector((0.06, 0.0, 0.185)), 0.015))
    for (x, y) in ((-0.09, -0.11), (0.09, -0.11), (-0.09, 0.11), (0.09, 0.11)):
        out.append(cilindro('Metal', c + Vector((x, y, 0.08)), 0.008, alto=0.006, rot=(90, 0, 0), seg=8))
    out.append(caja('D', c + Vector((0.06, 0.07, 0.1)), (0.05, 0.05, 0.004)))   # parche oxidado
    return out


@acc('cab_mecha')
def _cab_mecha():
    c = Vector(h(0, -0.01, 0.03))
    huevo = torno('A', [(0.0, -0.13), (0.08, -0.12), (0.115, -0.07), (0.128, 0.0), (0.12, 0.07), (0.09, 0.125), (0.0, 0.15)], seg=36).mover(c, esc=(1, 1.15, 1))
    out = [huevo, cuello('Metal', r=0.065)]
    visor = torno('Luz', [(0.13, -0.012), (0.131, 0.0), (0.13, 0.014)], a0=math.radians(200), a1=math.radians(340), seg=24).mover(c + Vector((0, 0, 0.02)), esc=(1, 1.15, 1))
    out.append(visor)
    for s in (-1, 1):
        out.append(placa('B', [(0, 0), (0.0, 0.07), (0.1, 0.12), (0.12, 0.08)], 0.012, bisel=0.004).mover(c + Vector((s * 0.11, 0.02, 0.03)), (0, 0, -90 + s * 90)).deformar(
            lambda v, s=s: Vector((v.x, v.y, v.z))))
        out.append(cilindro('Metal', c + Vector((s * 0.125, 0.0, -0.03)), 0.035, alto=0.03, rot=(0, 90, 0), seg=20))
    out.append(caja('B', c + Vector((0, -0.04, 0.16)), (0.02, 0.18, 0.02), (-15, 0, 0), bisel=0.008))
    for k in range(3):
        out.append(caja('C', c + Vector((0, -0.145, -0.05 - k * 0.018)), (0.06 - k * 0.012, 0.01, 0.006)))
    return out


@acc('cab_tele')
def _cab_tele():
    c = Vector(h(0, 0.0, 0.03))
    out = [caja('A', c, (0.25, 0.2, 0.2), bisel=0.02), cilindro('Metal', (0, -0.03, 1.6), 0.055, alto=0.1)]
    out.append(caja('A', c + Vector((0, 0.11, -0.01)), (0.17, 0.08, 0.15), bisel=0.02))
    pantalla = esfera('Luz', c + Vector((-0.02, -0.095, 0.0)), (0.085, 0.012, 0.07))
    out.append(pantalla)
    out.append(caja('C', c + Vector((-0.02, -0.1, 0.0)), (0.19, 0.004, 0.16)))
    # cara en la pantalla
    for s in (-1, 1):
        out.append(caja('C', c + Vector((-0.02 + s * 0.035, -0.11, 0.02)), (0.018, 0.004, 0.03)))
    out.append(tubo('C', curva([c + Vector((-0.06, -0.11, -0.025)), c + Vector((-0.02, -0.112, -0.04)), c + Vector((0.02, -0.11, -0.025))], 8), 0.004, seg=6))
    for k in range(2):
        out.append(cilindro('Metal', c + Vector((0.1, -0.1, 0.04 - k * 0.05)), 0.012, alto=0.012, rot=(90, 0, 0), seg=12))
    for s in (-1, 1):
        out.append(tubo('Metal', [c + Vector((s * 0.02, 0.02, 0.1)), c + Vector((s * 0.09, 0.03, 0.22))], 0.004))
        out.append(esfera('Metal', c + Vector((s * 0.09, 0.03, 0.222)), 0.01))
    return out


@acc('cab_androide')
def _cab_androide():
    c = Vector(h(0, -0.005, 0.02))
    craneo = torno('A', [(0.0, -0.12), (0.06, -0.115), (0.1, -0.08), (0.115, -0.0), (0.112, 0.07), (0.085, 0.13), (0.0, 0.155)], seg=36).mover(c, esc=(1, 1.18, 1))
    out = [craneo, cuello('Metal', r=0.055)]
    for k in range(5):
        out.append(toro('Metal', (0, -0.035, 1.57 + k * 0.022), 0.058, 0.006, seg=24, seg2=6))
    for s in (-1, 1):
        out.append(placa('Luz', [(-0.03, 0.0), (0.03, 0.0), (0.025, 0.008), (-0.025, 0.006)], 0.01).mover(c + Vector((s * 0.042, -0.13, 0.025)), (0, s * -15, s * -8)))
        out.append(tubo('C', [c + Vector((s * 0.112, -0.06, 0.06)), c + Vector((s * 0.114, 0.0, 0.08)), c + Vector((s * 0.1, 0.1, 0.07))], 0.003, seg=5))
    out.append(caja('B', c + Vector((0, -0.12, -0.06)), (0.05, 0.012, 0.006)))
    out.append(toro('Luz', c + Vector((0, 0.0, 0.025)), 0.117, 0.004, esc=(1, 1.18, 1), seg=40, seg2=5))
    return out


# ===========================================================================================================
# CUERPO: hombreras (en los brazos) y colas (en la cadera)
def hombrera(lado, tipo):
    s = 1 if lado == 'L' else -1
    c = Vector((s * 0.225, 0.01, 1.47))
    out = []
    if tipo == 'metal':
        for k in range(3):
            capa = torno('Metal' if k else 'A', [(0.0, 0.06), (0.06, 0.05), (0.095, 0.02), (0.105, -0.01)], a0=0, seg=24).mover(
                c + Vector((s * 0.012 * k, 0, -0.025 * k)), (0, s * (35 + k * 8), 0), esc=(1, 1.15, 1))
            out.append(capa)
            out.append(capa.copia().deformar(lambda v, cc=c: cc + (v - cc) * 0.97))
        out.append(cono('B', c + Vector((s * 0.03, 0, 0.07)), 0.016, 0.05, rot=(0, s * 30, 0), seg=8))
    else:
        random.seed(11 if s > 0 else 12)
        out.append(esfera('A', c + Vector((s * 0.01, 0, 0.0)), (0.095, 0.105, 0.065), rot=(0, s * 30, 0)))
        for k in range(16):
            th = random.uniform(0, 2 * math.pi)
            d = Vector((math.cos(th), math.sin(th) * 1.1, random.uniform(0.0, 0.6))).normalized()
            out.append(cuerno('A', c + d * 0.07, d + Vector((0, 0, -0.5)), 0.05, 0.022, seg=7, n=5))
        out.append(tubo('B', [c + Vector((-s * 0.06, -0.09, 0.03)), c + Vector((-s * 0.2, -0.12, -0.06))], 0.01, achatar=0.4))
    return out


@acc('hombreras')
def _hombreras():
    return {'L': hombrera('L', 'metal'), 'R': hombrera('R', 'metal')}


@acc('hombreras_piel')
def _hombreras_piel():
    return {'L': hombrera('L', 'piel'), 'R': hombrera('R', 'piel')}


COLA0 = Vector((0.0, 0.15, 1.0))     # nacimiento de la cola, atrás de la cadera


def cola(pts, radios, mat='A', seg=14, achatar=1.0):
    return tubo(mat, curva([COLA0 + Vector(p) for p in pts], 22), radios, seg=seg, achatar=achatar)


def lista_radios(r0, r1, n=23, panza=0.0):
    return [r0 + (r1 - r0) * (i / (n - 1)) + panza * math.sin(math.pi * i / (n - 1)) for i in range(n)]


@acc('cola_lobo')
def _cola_lobo():
    return [cola([(0, -0.02, 0), (0, 0.12, -0.08), (0, 0.22, -0.25), (0.02, 0.27, -0.42)], lista_radios(0.03, 0.012, panza=0.05))]


@acc('cola_zorro')
def _cola_zorro():
    pts = [(0, -0.02, 0), (0, 0.14, -0.05), (0.05, 0.28, -0.18), (0.1, 0.36, -0.36)]
    full = curva([COLA0 + Vector(p) for p in pts], 22)
    rs = lista_radios(0.03, 0.01, panza=0.07)
    a = tubo('A', full[:17], rs[:17], seg=16)
    b = tubo('B', full[16:], rs[16:], seg=16)
    return [a, b]


@acc('cola_gato')
def _cola_gato():
    return [cola([(0, -0.02, 0), (0, 0.15, -0.12), (0, 0.3, -0.05), (0.02, 0.36, 0.15), (0.06, 0.3, 0.3)], lista_radios(0.022, 0.014), seg=10)]


@acc('cola_dragon')
def _cola_dragon():
    pts = [(0, -0.03, 0.02), (0, 0.16, -0.12), (0.05, 0.32, -0.38), (0.12, 0.4, -0.7), (0.15, 0.32, -0.92)]
    full = curva([COLA0 + Vector(p) for p in pts], 30)
    out = [tubo('A', full, lista_radios(0.06, 0.008, n=len(full)), seg=16)]
    for i in range(2, len(full) - 3, 3):
        d = (full[i + 1] - full[i - 1]).normalized()
        up = Vector((0, 1, 0)).cross(d).cross(d).normalized() * -1
        up = (full[i] - Vector((full[i].x, full[i].y - 0.2, full[i].z + 0.3))).normalized()
        out.append(cono('B', full[i] + Vector((0, 0.04 * (1 - i / len(full)), 0.02)), 0.018 * (1 - i / len(full)) + 0.006, 0.04 * (1 - i / len(full)) + 0.015,
                        rot=(-60, 0, 0), seg=6))
    return out


@acc('cola_diablo')
def _cola_diablo():
    pts = [(0, -0.02, 0), (0, 0.15, -0.15), (0.03, 0.28, -0.1), (0.08, 0.33, 0.05)]
    full = curva([COLA0 + Vector(p) for p in pts], 20)
    out = [tubo('A', full, 0.011, seg=10)]
    punta = placa('A', [(0, 0.06), (-0.04, 0.0), (-0.01, 0.01), (0, -0.02), (0.01, 0.01), (0.04, 0.0)], 0.012, bisel=0.003)
    out.append(punta.mover(full[-1], (0, 0, 0)))
    return out


# ===========================================================================================================
# MOCHILAS (en la espalda, hueso Spine2)
E = Vector((0.0, 0.17, 1.33))          # centro de la espalda


@acc('mochila_jetpack')
def _jetpack():
    out = [caja('Metal', E + Vector((0, 0.05, 0.02)), (0.16, 0.07, 0.24), bisel=0.02)]
    for s in (-1, 1):
        c = E + Vector((s * 0.095, 0.08, 0.0))
        out.append(torno('A', [(0.0, -0.17), (0.04, -0.165), (0.06, -0.13), (0.062, 0.12), (0.045, 0.16), (0.0, 0.175)]).mover(c))
        out.append(cilindro('C', c + Vector((0, 0, -0.2)), 0.035, 0.05, 0.06, seg=16))
        out.append(cono('Luz', c + Vector((0, 0, -0.27)), 0.04, 0.12, rot=(180, 0, 0), seg=16))
        out.append(toro('B', c + Vector((0, 0, 0.06)), 0.063, 0.008))
        out.append(toro('B', c + Vector((0, 0, -0.06)), 0.063, 0.008))
    out.append(caja('Luz', E + Vector((0, 0.087, 0.06)), (0.06, 0.004, 0.02)))
    return out


@acc('mochila_alas_mecha')
def _alas_mecha():
    out = [caja('Metal', E + Vector((0, 0.04, 0.06)), (0.14, 0.05, 0.16), bisel=0.015)]
    for s in (-1, 1):
        for k in range(5):
            ang = -10 + k * 14
            largo = 0.5 - k * 0.05
            pl = placa('A', [(0, -0.025), (largo, -0.015), (largo + 0.05, 0.0), (largo, 0.015), (0, 0.025)], 0.012, bisel=0.004)
            pl.mover(E + Vector((s * 0.05, 0.08 + k * 0.006, 0.08)), (0, -s * ang if s > 0 else 0, 0))
            pl.tr(Matrix.Translation(Vector((0, 0, 0))))
            # rotar en el plano de la espalda (XZ) alrededor del hombro
            base = E + Vector((s * 0.05, 0.08 + k * 0.006, 0.08))
            pl = placa('A', [(0, -0.025), (largo, -0.015), (largo + 0.05, 0.0), (largo, 0.015), (0, 0.025)], 0.012, bisel=0.004)
            pl.tr(M(rot=(0, -ang, 0)))
            if s < 0:
                pl = pl.espejo_x()
            pl.mover(base)
            out.append(pl)
            borde = caja('Luz', (0, 0, 0), (largo * 0.8, 0.014, 0.006))
            borde.tr(M((largo * 0.5, 0, -0.022), (0, 0, 0)))
            borde.tr(M(rot=(0, -ang, 0)))
            if s < 0:
                borde = borde.espejo_x()
            out.append(borde.mover(base))
    return out


@acc('mochila_capa')
def _capa():
    # capa de tela: de los hombros a las rodillas, abierta hacia atrás para no chocar las piernas
    bm = bmesh.new()
    filas, n, m = [], 18, 14
    for i in range(m + 1):
        t = i / m
        z = 1.5 - t * 0.78
        ancho = 0.19 + t * 0.2
        fila = []
        for j in range(n + 1):
            u = j / n * 2 - 1
            x = u * ancho
            y = 0.16 + 0.04 * (1 - u * u) + t * 0.2 + 0.03 * math.sin(u * 7 + t * 2) * t
            fila.append(bm.verts.new((x, y, z)))
        filas.append(fila)
    for i in range(m):
        for j in range(n):
            bm.faces.new((filas[i][j], filas[i][j + 1], filas[i + 1][j + 1], filas[i + 1][j]))
    r = bmesh.ops.solidify(bm, geom=bm.faces, thickness=0.012)
    afuera = Pieza(bm, 'A', True)
    cuello_ = toro('B', (0, 0.02, 1.52), 0.15, 0.022, esc=(1, 1.1, 1))
    broches = [esfera('D', (s * 0.15, -0.1, 1.5), 0.02) for s in (-1, 1)]
    return [afuera, cuello_, *broches]


@acc('mochila_tanque')
def _tanque():
    c = E + Vector((0, 0.1, 0.0))
    out = [torno('A', [(0.0, -0.2), (0.05, -0.195), (0.08, -0.16), (0.085, 0.15), (0.06, 0.2), (0.0, 0.215)]).mover(c)]
    out.append(cilindro('Metal', c + Vector((0, 0, 0.235)), 0.02, alto=0.05))
    out.append(cilindro('Metal', c + Vector((0, -0.0, 0.265)), 0.035, alto=0.015, rot=(0, 0, 0), seg=8))
    out.append(tubo('C', curva([c + Vector((0.02, 0, 0.25)), c + Vector((0.12, -0.05, 0.25)), c + Vector((0.16, -0.15, 0.2)), (0.13, -0.18, 1.58)], 14), 0.012, seg=8))
    for z in (-0.1, 0.1):
        out.append(toro('B', c + Vector((0, 0, z)), 0.087, 0.01))
    return out


@acc('mochila_katana')
def _katana():
    a, b = E + Vector((-0.17, 0.09, -0.22)), E + Vector((0.2, 0.09, 0.28))
    d = (b - a).normalized()
    out = [tubo('A', [a, a + d * 0.5], 0.022, seg=10, achatar=0.55)]
    out.append(tubo('Metal', [a + d * 0.5, a + d * 0.515], 0.035, seg=12, achatar=0.4))
    out.append(tubo('B', [a + d * 0.515, b], 0.016, seg=10))
    for k in range(6):
        p = a + d * (0.53 + k * 0.025)
        out.append(toro('C', p, 0.017, 0.004, (0, 0, 0)).tr(Matrix.Identity(4)))
    out.append(esfera('D', b, 0.02))
    out.append(caja('C', E + Vector((0, 0.06, 0.0)), (0.3, 0.012, 0.035), (0, -52, 0)))
    return out


@acc('mochila_osito')
def _osito():
    c = E + Vector((0, 0.12, -0.02))
    out = [esfera('A', c, (0.1, 0.07, 0.12))]
    cab = c + Vector((0, 0.0, 0.17))
    out.append(esfera('A', cab, (0.085, 0.07, 0.075)))
    out.append(esfera('B', cab + Vector((0, 0.06, -0.015)), (0.035, 0.025, 0.028)))
    out.append(esfera('C', cab + Vector((0, 0.085, -0.005)), 0.01))
    for s in (-1, 1):
        out.append(esfera('A', cab + Vector((s * 0.065, 0, 0.06)), (0.03, 0.018, 0.03)))
        out.append(esfera('B', cab + Vector((s * 0.065, 0.01, 0.06)), (0.018, 0.012, 0.018)))
        out.append(esfera('C', cab + Vector((s * 0.03, 0.06, 0.02)), 0.011))
        out.append(esfera('A', c + Vector((s * 0.1, 0.02, 0.04)), (0.03, 0.03, 0.06), rot=(0, s * 30, 0)))
        out.append(esfera('A', c + Vector((s * 0.06, 0.03, -0.12)), (0.035, 0.04, 0.03)))
    out.append(esfera('B', c + Vector((0, 0.06, -0.01)), (0.06, 0.02, 0.07)))
    out.append(placa('D', [(-0.03, 0.0), (0.0, -0.015), (0.03, 0.0), (0.0, 0.015)], 0.01).mover(cab + Vector((0, 0.02, -0.07))))
    return out


@acc('mochila_caparazon')
def _caparazon():
    c = E + Vector((0, 0.04, -0.03))
    dom = esfera('A', c, (0.2, 0.13, 0.25)).deformar(lambda v: Vector((v.x, max(v.y, c.y + 0.0), v.z)))
    out = [dom]
    centros = [(0, 0.12), (0, -0.02), (0, -0.16), (-0.1, 0.06), (0.1, 0.06), (-0.1, -0.1), (0.1, -0.1)]
    for (x, z) in centros:
        y = c.y + 0.13 * math.sqrt(max(0.0, 1 - (x / 0.2) ** 2 - (z / 0.25) ** 2))
        out.append(cilindro('B', (c.x + x, y, c.z + z), 0.05, 0.042, 0.02, rot=(90, 0, 0), seg=6))
    out.append(toro('B', c + Vector((0, 0.0, 0)), 1.0, 0.03, (90, 0, 0), esc=(0.2, 0.25, 1.0), seg2=8))
    return out


@acc('mochila_guitarra')
def _guitarra():
    out = []
    centro = E + Vector((0.02, 0.1, -0.08))
    cuerpo = placa('A', [(math.cos(a) * (0.12 if math.sin(a) < 0 else 0.095) + 0.0, math.sin(a) * 0.15 * (1 if math.sin(a) < 0 else 0.9) + (0.0 if math.sin(a) < 0 else 0.04))
                         for a in [2 * math.pi * k / 40 for k in range(40)]], 0.06, bisel=0.012)
    cuerpo.tr(M(rot=(90, 0, 0)))  # el plano XZ pasa a mirar hacia atrás
    cuerpo.tr(M(rot=(-90, 0, 0)))
    cuerpo.mover(centro, (0, 25, 0))
    out.append(cuerpo)
    out.append(cilindro('C', centro + Vector((0.0, 0.032, 0.02)), 0.035, alto=0.004, rot=(90, 0, 0)).mover((0, 0, 0)))
    d = Vector((math.sin(math.radians(25)), 0, math.cos(math.radians(25))))
    out.append(caja('B', centro + d * 0.3 + Vector((0, 0.02, 0)), (0.04, 0.025, 0.32), (0, 25, 0)))
    out.append(caja('C', centro + d * 0.5 + Vector((0, 0.02, 0)), (0.055, 0.03, 0.09), (0, 25, 0), bisel=0.008))
    for k in range(3):
        out.append(caja('Metal', centro + d * (0.15 - k * 0.0) + Vector((0, 0.035, -0.02 * k)), (0.06, 0.004, 0.003), (0, 25, 0)))
    out.append(tubo('C', [E + Vector((0.15, -0.0, 0.18)), E + Vector((0.2, -0.25, 0.1)), (0.15, -0.21, 1.1)], 0.012, achatar=0.3))
    return out


@acc('mochila_alas_dragon')
def _alas_dragon():
    out = []
    for s in (-1, 1):
        base = E + Vector((s * 0.06, 0.1, 0.1))
        codo = base + Vector((s * 0.2, 0.1, 0.18))
        dedos = [codo + Vector((s * (0.12 + 0.07 * k), 0.06, 0.12 - 0.17 * k)) for k in range(4)]
        out.append(tubo('A', [base, codo], [0.022, 0.016], seg=10))
        for k, d in enumerate(dedos):
            out.append(tubo('A', [codo, d], [0.012, 0.004], seg=8))
            out.append(cono('D', d, 0.006, 0.03, rot=(0, -s * 90 if k == 0 else 180, 0), seg=6))
        # membrana entre los dedos
        bm = bmesh.new()
        vc = bm.verts.new(codo)
        vb = bm.verts.new(base + Vector((s * 0.02, 0, -0.12)))
        vs = [bm.verts.new(d) for d in dedos]
        bm.faces.new((vb, vc, vs[-1]) if s > 0 else (vc, vb, vs[-1]))
        for k in range(3):
            v1, v2 = vs[k], vs[k + 1]
            mid = bm.verts.new((v1.co + v2.co) / 2 + (codo - (v1.co + v2.co) / 2) * 0.25)
            bm.faces.new((vc, v1, mid) if s > 0 else (v1, vc, mid))
            bm.faces.new((vc, mid, v2) if s > 0 else (mid, vc, v2))
        bmesh.ops.solidify(bm, geom=bm.faces, thickness=0.006)
        out.append(Pieza(bm, 'B', False))
    return out


@acc('mochila_aleta')
def _aleta():
    al = placa('A', [(0.0, 0.0), (-0.02, 0.1), (-0.07, 0.24), (0.04, 0.2), (0.12, 0.06), (0.14, 0.0)], 0.03, bisel=0.01)
    al.mover(E + Vector((0, 0.13, 0.02)), (0, 0, 90))
    return [al, caja('B', E + Vector((0, 0.12, 0.05)), (0.04, 0.05, 0.16), bisel=0.015)]


# ===========================================================================================================
# PICOS (espacio del pico de armas.glb: puño en el origen, mango +Z, punta +Y; mide de z -0.155 a 0.66)
def mango(mat='B', z0=-0.16, z1=0.62, r=0.017, puno='C'):
    out = [cilindro(mat, (0, 0, (z0 + z1) / 2), r, alto=z1 - z0, seg=14)]
    out.append(cilindro(puno, (0, 0, -0.02), r * 1.25, alto=0.2, seg=14))
    out.append(esfera('Metal', (0, 0, z0), r * 1.6, seg=12, anillos=8))
    return out


@pico('hacha')
def _p_hacha():
    out = mango('B', z1=0.7)
    filo = [(0.0, -0.06), (0.06, -0.075), (0.14, -0.12), (0.2, -0.13), (0.215, -0.02), (0.2, 0.09), (0.14, 0.09), (0.06, 0.05), (0.0, 0.04)]
    for s in (-1, 1):
        hoja = placa('Metal', [(s * x, z) for x, z in filo] if s > 0 else [(s * x, z) for x, z in reversed(filo)], 0.018, bisel=0.004)
        hoja.tr(M(rot=(0, 0, 90)))
        out.append(hoja.mover((0, 0, 0.58)))
    out.append(caja('A', (0, 0, 0.58), (0.04, 0.07, 0.12), bisel=0.008))
    return out


@pico('martillo')
def _p_martillo():
    out = mango('B', z1=0.6)
    out.append(caja('Metal', (0, 0.03, 0.6), (0.11, 0.32, 0.12), bisel=0.015))
    out.append(caja('A', (0, 0.03, 0.6), (0.115, 0.08, 0.125), bisel=0.01))
    for s in (-1, 1):
        out.append(cilindro('A', (0, 0.03 + s * 0.17, 0.6), 0.06, alto=0.03, rot=(90, 0, 0), seg=8))
    return out


@pico('llave')
def _p_llave():
    cuerpo = placa('Metal', [(-0.022, -0.17), (0.022, -0.17), (0.026, 0.45), (-0.026, 0.45)], 0.02, bisel=0.006)
    cuerpo.tr(M(rot=(0, 0, 90)))
    out = [cuerpo]
    boca = [(-0.06, 0.0), (0.06, 0.0), (0.08, 0.06), (0.06, 0.14), (0.028, 0.15), (0.028, 0.07), (-0.028, 0.07), (-0.028, 0.15), (-0.06, 0.14), (-0.08, 0.06)]
    b = placa('Metal', boca, 0.022, bisel=0.006)
    b.tr(M(rot=(0, 0, 90)))
    out.append(b.mover((0, 0.02, 0.44), (35, 0, 0)))
    out.append(cilindro('A', (0, 0, 0.02), 0.032, alto=0.24, seg=10, esc=(0.8, 1, 1)))
    out.append(cilindro('Metal', (0, 0, 0.36), 0.02, alto=0.06, rot=(0, 90, 0), seg=14))
    return out


@pico('ancla')
def _p_ancla():
    out = [cilindro('Metal', (0, 0, 0.31), 0.02, alto=0.94, seg=14)]
    out.append(toro('Metal', (0, 0, 0.81), 0.04, 0.012, (0, 90, 0)))
    out.append(caja('A', (0, 0, 0.0), (0.05, 0.05, 0.2), bisel=0.012))
    out.append(caja('Metal', (0, 0, 0.7), (0.025, 0.2, 0.025), bisel=0.008))
    for s_ in (-1, 1):
        out.append(esfera('Metal', (0, s_ * 0.1, 0.7), 0.02))
    c = Vector((0, 0, 0.6))
    out.append(tubo('Metal', arco(c, 0.15, 195, 345, 18, 'yz'), 0.019, seg=12))
    for s_ in (-1, 1):
        a = math.radians(195 if s_ < 0 else 345)
        tip = c + Vector((0, 0.15 * math.cos(a), 0.15 * math.sin(a)))
        al = placa('Metal', [(-0.035, -0.03), (0.0, 0.06), (0.035, -0.03), (0.0, -0.01)], 0.014, bisel=0.004)
        al.tr(M(rot=(0, 0, 90)))
        al.tr(M(rot=(-s_ * 35, 0, 0)))
        out.append(al.mover(tip + Vector((0, s_ * 0.012, 0.02))))
    out.append(esfera('Metal', (0, 0, 0.45), 0.03))
    return out


@pico('chupetin')
def _p_chupetin():
    out = [cilindro('Ojo', (0, 0, 0.25), 0.014, alto=0.8, seg=12)]
    c = Vector((0, 0.0, 0.73))
    pts, rs = [], []
    n = 140
    for i in range(n):
        t = i / (n - 1)
        a = t * 2 * math.pi * 3.2
        r = 0.012 + t * 0.12
        pts.append(c + Vector((0, math.cos(a) * r, math.sin(a) * r)))
        rs.append(0.016 + 0.004 * t)
    mitad = n // 2
    out.append(tubo('A', pts, rs, seg=10, achatar=1.4))
    out.append(cilindro('B', c, 0.14, alto=0.03, rot=(0, 90, 0), seg=40))
    out.append(toro('D', (0, 0, 0.6), 0.03, 0.01, (0, 0, 0)))
    return out


@pico('guadana')
def _p_guadana():
    out = mango('C', z1=0.78, r=0.018, puno='A')
    hoja = []
    n = 24
    for i in range(n + 1):
        t = i / n
        a = math.radians(95 - t * 120)
        r = 0.36
        hoja.append((r * math.cos(a) * 0.9 + 0.0, 0.72 + r * math.sin(a) * 0.55 - 0.18 - t * 0.0))
    borde_int = [(x * 0.82, z - 0.035 * math.sin(i / n * math.pi)) for i, (x, z) in enumerate(hoja)]
    poli = hoja + list(reversed(borde_int))
    b = placa('Metal', poli, 0.01, bisel=0.003)
    b.tr(M(rot=(0, 0, 90)))
    out.append(b.mover((0, -0.02, 0.06)))
    out.append(caja('A', (0, 0.0, 0.74), (0.04, 0.06, 0.07), bisel=0.01))
    out.append(esfera('Luz', (0, 0.02, 0.81), 0.025))
    return out


@pico('cristal')
def _p_cristal():
    out = mango('A', z1=0.5)
    random.seed(5)
    for k in range(7):
        d = Vector((random.uniform(-0.3, 0.3), 0.6 + random.uniform(-0.2, 0.5) * (1 if k % 2 else -1), 0.6 + random.uniform(0, 0.5))).normalized()
        largo = 0.16 + random.uniform(0, 0.14) + (0.12 if k == 0 else 0)
        if k == 0:
            d = Vector((0, 0.55, 0.85)).normalized()
        cr = cilindro('Luz', (0, 0, 0), 0.045, 0.0, largo, seg=6)
        cr.tr(M((0, 0, largo / 2)))
        rot = Vector((0, 0, 1)).rotation_difference(d).to_matrix().to_4x4()
        cr.tr(rot)
        cr.mover((0, 0.02, 0.5))
        out.append(cr)
    out.append(esfera('Metal', (0, 0.02, 0.5), 0.05, seg=8, anillos=6))
    return out


@pico('hueso')
def _p_hueso():
    out = [cilindro('A', (0, 0, 0.25), 0.03, 0.026, 0.72, seg=16)]
    for z in (-0.13, 0.63):
        for s in (-1, 1):
            out.append(esfera('A', (0, s * 0.035, z), 0.05, seg=16, anillos=10))
    out.append(toro('C', (0, 0, 0.0), 0.034, 0.01))
    for k in range(4):
        out.append(cono('B', (0, -0.05 + 0.0, 0.63 + 0.0 + k * 0.0), 0.0, 0.0, seg=4))
    for k, a in enumerate((20, 70, 120, 160)):
        out.append(cono('Metal', (0, 0.035 + 0.05 * math.cos(math.radians(a)), 0.63 + 0.05 * math.sin(math.radians(a))), 0.012, 0.05,
                        rot=(-(90 - a), 0, 0), seg=6))
    return out


# ===========================================================================================================
def armar_todo():
    coleccion()
    nombres = []
    for nombre, fn in ACC.items():
        r = fn()
        if isinstance(r, dict):
            for lado, piezas in r.items():
                objeto(f'acc_{nombre}_{lado}', piezas)
                nombres.append(f'acc_{nombre}_{lado}')
        else:
            objeto(f'acc_{nombre}', r)
            nombres.append(f'acc_{nombre}')
    for nombre, fn in PICOS.items():
        objeto(f'pico_{nombre}', fn())
        nombres.append(f'pico_{nombre}')
    return nombres


def exportar_skins(ruta):
    return exportar(ruta, [o.name for o in coleccion().objects])
