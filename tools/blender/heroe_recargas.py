# Recargas y acciones de las armas hechas por código. El torso del héroe y las piezas móviles del arma salen del
# mismo cálculo cuadro a cuadro: la mano lleva al cargador (o a la bomba, al cerrojo, al cohete) y no se separan.
# Requiere heroe_anim.py y heroe_clips.py en el mismo espacio de nombres (Pose, reposo, grabar, ARMAS, ...).
#
# - El arma va exacta con el hueso Arma.R (giro y traslación propios respecto de la mano derecha): la mano derecha
#   puede soltar la empuñadura (cerrojo del francotirador) y el arma queda donde tiene que estar.
# - Las piezas se describen en el espacio del arma (origen en el puño, +Y cañón, +Z arriba), igual que los
#   modelos de armas_modelos.py: su transformación por cuadro es la animación de ese nodo en armas.glb.
# - Los clips son de la capa del torso: en el juego las piernas siguen con la locomoción.
import bpy, math
from mathutils import Vector, Matrix, Quaternion, Euler

FPS_CLIP = 24          # el resto de los clips del héroe se exportan a 24 cuadros por segundo
GRAV = Vector((0, 0, -9.8))


def marco(G, d, u):
    # matriz del arma en el espacio del personaje: columnas derecha, cañón y arriba; origen en el puño
    d = Vector(d).normalized()
    u = Vector(u)
    u = (u - d * u.dot(d)).normalized()
    r = d.cross(u)
    M = Matrix((r, d, u)).transposed().to_4x4()
    M.translation = Vector(G)
    return M


def ROT(x, y, z):
    return Euler((math.radians(x), math.radians(y), math.radians(z))).to_matrix()


def TR(P, R=None):
    M = (R if R is not None else Matrix.Identity(3)).to_4x4()
    M.translation = Vector(P)
    return M


def girar(u, d, grados):
    # gira 'u' alrededor de 'd' (para inclinar el arma de costado)
    return Quaternion(Vector(d).normalized(), math.radians(grados)) @ Vector(u)


class Agarre:
    # dónde va una mano respecto de un marco (el arma o una pieza): punto, orientación y qué punto de la mano va ahí
    def __init__(self, P, R, off=None):
        self.P = Vector(P)
        self.R = R
        self.off = Vector(off if off is not None else OFF_PUNO)

    def en(self, M):
        return M @ self.P, M.to_3x3() @ self.R, self.off


def mezclar(lista):
    # lista de (peso, (P, R, off)): mezcla incremental (posiciones lineales, giros esféricos)
    P = Q = off = None
    tot = 0.0
    for w, (Pi, Ri, oi) in lista:
        if w <= 1e-5:
            continue
        qi = Ri.to_quaternion()
        if P is None:
            P, Q, off, tot = Vector(Pi), qi, Vector(oi), w
            continue
        tot += w
        t = w / tot
        if Q.dot(qi) < 0:
            qi.negate()
        P = P.lerp(Pi, t)
        Q = Q.slerp(qi, t)
        off = off.lerp(oi, t)
    return P, Q.to_matrix(), off


def fijar_arma(p, Mg):
    # el hueso Arma.R toma la transformación justa para que el arma quede en Mg aunque la mano no esté en el mango
    n = 'Arma.R'
    X = (p.M['Hand.R'] @ p.rest_rel[n]).inverted() @ Mg
    p.locs[n] = X.to_translation()
    p.base[n] = X.to_quaternion().normalized()
    p.fk()


# Agarres en el espacio del arma (los mismos de arma_en_manos)
def AG_EMPUNADURA():
    return Agarre((0, 0, 0), rot_agarre('R', V(0, 1, 0), V(0, 0, 1)), OFF_PUNO)


def AG_GUARDAMANOS(y=None):
    return Agarre((0, APOYO if y is None else y, 0.035), rot_mano(V(0.8, 0.55, 0), V(0, 0, -1)), OFF_PALMA)


def AG_PISTOLA_L():
    return Agarre((-0.045, 0.005, -0.02), rot_mano(V(0, 0.5, -0.85), V(-1, 0, 0)), OFF_PALMA)


def AG_VERTICAL_L():
    return Agarre((0, APOYO, 0), rot_agarre('L', V(0, 1, 0), V(0, 0, 1)), OFF_PUNO)


def AG_LIBRE(P, y, z, palma=True):
    # mano izquierda suelta: punto y orientación (nudillos 'y', dorso 'z') en el espacio del arma
    return Agarre(P, rot_mano(Vector(y), Vector(z)), OFF_PALMA if palma else OFF_PUNO)


# ---------------------------------------------------------------------------
class Pieza:
    # movimiento de una pieza del arma: claves (posición absoluta del origen en el espacio del arma, giro en grados
    # respecto del reposo, escala) y tramos de caída libre (se suelta con la velocidad que traía y cae con gravedad)
    def __init__(self, pivote, claves, caidas=(), giro_caida=(0, 0, 0)):
        self.pivote = Vector(pivote)
        tabla = {}
        for f, d in claves.items():
            e = dict(d)
            if 'pos' in e:
                e['pos'] = tuple(e['pos'])
            if 'dp' in e:
                e['pos'] = tuple(self.pivote + Vector(e.pop('dp')))
            tabla[f] = e
        # valores por defecto en la primera clave
        f0 = min(tabla)
        tabla[f0].setdefault('pos', tuple(self.pivote))
        tabla[f0].setdefault('rot', (0.0, 0.0, 0.0))
        tabla[f0].setdefault('s', 1.0)
        self.k = Claves(tabla)
        self.caidas = list(caidas)        # (cuadro en que se suelta, cuadro en que desaparece)
        self.giro_caida = Vector(giro_caida)

    def clave(self, f):
        k = self.k(f)
        return TR(k['pos'], ROT(*k['rot'])), max(0.0, min(1.0, k['s']))


class ClavesPorCanal:
    # Como Claves, pero cada parámetro se interpola solo entre las claves que lo nombran: una clave de otro parámetro
    # en el medio no lo congela (con Claves, la mano suelta quedaba quieta hasta la clave siguiente y saltaba en un
    # cuadro). Antes de su primera clave y después de la última, el valor se sostiene.
    def __init__(self, tabla):
        canales = {}
        for t in sorted(tabla):
            for kk, v in tabla[t].items():
                canales.setdefault(kk, []).append((t, v))
        self.c = {kk: Curva(pts) for kk, pts in canales.items()}

    def __call__(self, t):
        return {kk: c(t) for kk, c in self.c.items()}


class Recarga:
    # base: pose del juego de la que sale y a la que vuelve (ARMAS); arma: modelo de armas.glb
    def __init__(self, nombre, arma, base, T, claves, piezas, mano_L, mano_R=None):
        self.nombre, self.arma, self.base, self.T = nombre, arma, base, T
        G, d, u, tipo, pR, pL, cab, col, hR = ARMAS[base]
        defecto = dict(G=tuple(G), d=tuple(d), u=tuple(u), giro=col[0], incl=col[1], ladeo=0.0, cab=tuple(cab),
                       hR=hR, hLa=0.0, hLd=7.0 if tipo in ('largo', 'vertical') else 0.0, poloR=tuple(pR),
                       poloL=tuple(pL), dR=(68.0, 28.0, 30.0), dL=(42.0, 18.0, 4.0), cad=(0.0, 0.0, 0.0))
        tabla = {}
        for f, e in claves.items():
            tabla[f] = {kk: (tuple(v) if isinstance(v, (Vector, list)) else v) for kk, v in e.items()}
        f0 = min(tabla)
        for kk, v in defecto.items():
            tabla[f0].setdefault(kk, v)
        self.k = ClavesPorCanal(tabla)
        self.piezas = piezas            # nombre -> Pieza
        self.mano_L = mano_L            # f, k, Mg, piezas -> [(peso, (P, R, off))] en espacio del personaje
        self.mano_R = mano_R
        self.tipo = tipo
        self._cache = {}

    def gun(self, f):
        k = self.k(f)
        return marco(k['G'], k['d'], k['u'])

    def pieza(self, n, f):
        # (matriz en el espacio del arma, escala) de la pieza n en el cuadro f
        key = (n, f)
        if key in self._cache:
            return self._cache[key]
        pz = self.piezas[n]
        res = None
        for fr, fz in pz.caidas:
            if fr <= f <= fz:
                # caída libre desde fr con la velocidad del último cuadro; en fz ya no se ve
                W0 = self.gun(fr) @ self.pieza_clave(n, fr)
                W1 = self.gun(fr - 1) @ self.pieza_clave(n, fr - 1)
                v = (W0.translation - W1.translation) * FPS_CLIP
                t = (f - fr) / FPS_CLIP
                pos = W0.translation + v * t + GRAV * (0.5 * t * t)
                R = W0.to_3x3() @ ROT(*(pz.giro_caida * t))
                res = (self.gun(f).inverted() @ TR(pos, R), 0.0 if f == fz else 1.0)
                break
        if res is None:
            res = pz.clave(f)
        self._cache[key] = res
        return res

    def pieza_clave(self, n, f):
        return self.piezas[n].clave(f)[0]

    def pose(self, f):
        k = self.k(f)
        p = reposo()
        p.mover_cadera(V(-0.012, 0.0, -0.03) + Vector(k['cad']))
        p.orientar('Hips', GIRO(-2) @ LADEO(-1.2))
        columna(p, k['giro'], k['incl'], k['ladeo'], 0.0, tuple(k['cab']), reparto=(0.0, 0.45, 0.55))
        if k['hR']:
            hombro(p, 'R', k['hR'], 2.0)
        if k['hLa'] or k['hLd']:
            hombro(p, 'L', k['hLa'], k['hLd'])
        piernas_quietas(p, abre=0.02, adelante_L=-0.06, adelante_R=0.05)
        Mg = marco(k['G'], k['d'], k['u'])
        # mano derecha: en la empuñadura salvo que el clip diga otra cosa
        objR = self.mano_R(self, f, k, Mg) if self.mano_R else [(1.0, AG_EMPUNADURA().en(Mg))]
        P, R, off = mezclar(objR)
        poner_mano(p, 'R', P, R, Vector(k['poloR']), off=off)
        c, pu, ix = k['dR']
        p.dedos('R', c, pu, indice=ix)
        objL = self.mano_L(self, f, k, Mg)
        P, R, off = mezclar(objL)
        poner_mano(p, 'L', P, R, Vector(k['poloL']), off=off)
        c, pu, ab = k['dL']
        p.dedos('L', c, pu, abre=ab)
        fijar_arma(p, Mg)
        return p

    def toma(self, n, f, ag):
        # la mano agarrando la pieza n (agarre definido respecto de la pieza)
        L, s = self.pieza(n, f)
        return ag.en(self.gun(f) @ L)


def pesos(k, fuentes):
    # fuentes: {clave de peso: objetivo}; devuelve [(peso, objetivo)]
    return [(max(0.0, k.get(w, 0.0)), o) for w, o in fuentes.items()]


# ---------------------------------------------------------------------------
# Puntos útiles del cuerpo (espacio del personaje, de reposo)
CARTUCHERA_L = V(0.145, -0.145, 1.00)    # portacargadores en el cinturón, adelante a la izquierda
PECHO_L = V(0.10, -0.17, 1.30)           # bolsillo del chaleco
ESPALDA_L = V(0.13, 0.17, 1.62)          # por encima del hombro izquierdo (cohetes a la espalda)


def vuelta(base, **extra):
    # clave de regreso a la pose del juego (ARMAS[base]): arma, giro e inclinación del torso, cabeza y polos
    G, d, u, tipo, pR, pL, cab, col, hR = ARMAS[base]
    k = dict(G=G, d=d, u=u, giro=col[0], incl=col[1], cab=cab, hR=hR, poloR=pR, poloL=pL)
    k.update(extra)
    return k


def a_arma(G, d, u, P):
    # punto del personaje al espacio de un arma puesta en (G, d, u)
    return marco(G, d, u).inverted() @ Vector(P)


def rot_arma(G, d, u, R):
    # orientación del personaje al espacio del arma, como ángulos (x, y, z) en grados
    e = (marco(G, d, u).to_3x3().inverted() @ R).to_euler()
    return tuple(math.degrees(a) for a in e)


# ---------------------------------------------------------------------------
def escalar(tabla, k):
    # pasa las claves de un clip diseñado en otra duración (cuadros redondeados, sin repetir)
    out = {}
    for f, v in sorted(tabla.items()):
        g = int(round(f * k))
        while g in out:
            g += 1
        out[g] = v
    return out


def poner_pesos(claves, tabla, nombres):
    for f, w in tabla.items():
        claves.setdefault(f, {}).update({n: x for n, x in zip(nombres, w)})


def poner_sueltas(claves, tabla, lado='L'):
    for f, (P, y, z, dd) in tabla.items():
        claves.setdefault(f, {}).update({'P' + lado: P, 'y' + lado: y, 'z' + lado: z, 'd' + lado: dd})


# ---------------------------------------------------------------------------
# Rifle y subfusil: suelta el cargador (cae), saca otro del cinturón, lo calza con un golpe y tira de la manija.
# Diseñado en 53 cuadros (2,2 s); otras duraciones escalan las claves.
def recarga_cargador(nombre, arma, T, piv_carg, salida, ag_carg, piv_cerr, ag_man, tirar, previa, alto=1.25,
                     G1=None, d1=V(0.766, -0.643, 0.02), rol1=-30.0, giro1=-32.0, incl1=9.0,
                     G2=V(-0.16, -0.39, 1.22), d2=V(0.643, -0.766, 0.02), rol2=-12.0, giro2=-28.0, incl2=5.0):
    # G1/d1/rol1: el arma mientras se cambia el cargador (rol1 = giro sobre el cañón, para mostrar el pozo del
    # cargador a la mano izquierda); G2/d2/rol2: mientras se tira de la manija (lejos del pecho para que la mano
    # no se meta en el chaleco). giro/incl: torso en cada tramo.
    # El arma cruza el pecho con el cañón 50° a la izquierda y el puño a la derecha: así la culata queda afuera del
    # costado derecho (con el arma de frente, la culata se metía hasta 18 cm en el chaleco).
    # El arma va 3 cm más lejos del pecho que en la primera versión: así el antebrazo izquierdo no se apoya en los
    # cargadores del chaleco (lo mide brazos_choque.py).
    k = T / 53.0
    G0, d0, u0 = ARMAS['Rifle'][:3]
    G1 = V(-0.16, -0.31, alto) if G1 is None else Vector(G1)
    u1 = girar(V(0, 0, 1), d1, rol1)
    u2 = girar(V(0, 0, 1), d2, rol2)
    claves = {
        0: dict(),
        6: dict(G=G1, d=d1, u=u1, giro=giro1, incl=incl1, cab=(20.0, 10.0, 0.0), poloL=V(0.7, 0.2, -1.0)),
        10: dict(G=G1 + V(0, 0, -0.012)),
        13: dict(G=G1),
        29: dict(G=G1, d=d1, u=u1, giro=giro1, incl=incl1, cab=(20.0, 10.0, 0.0)),
        31: dict(G=G1 + V(0, 0, 0.018)),
        34: dict(G=G2, d=d2, u=u2, giro=giro2, incl=incl2, cab=(10.0, 2.0, 0.0), poloL=V(0.9, -0.2, -0.6)),
        40: dict(G=G2 + V(0.0, 0.012, 0.0)),
        43: dict(G=G2),
        48: vuelta('Rifle'),
        53: dict(),
    }
    # pesos de la mano izquierda: a = guardamanos, x = suelta (objetivo propio), c = cargador, m = manija
    poner_pesos(claves, {0: (1, 0, 0, 0), 3: (0.3, 0.7, 0, 0), 7: (0, 0, 1, 0), 11: (0, 0, 1, 0), 15: (0, 1, 0, 0),
                         18: (0, 1, 0, 0), 19: (0, 0, 1, 0), 30: (0, 0, 1, 0), 31: (0, 1, 0, 0), 36: (0, 1, 0, 0),
                         38: (0, 0, 0, 1), 41: (0, 0, 0, 1), 42: (0, 1, 0, 0), 45: (0, 1, 0, 0), 49: (1, 0, 0, 0)},
                ('wa', 'wx', 'wc', 'wm'))
    piv = Vector(piv_carg)
    pm = Vector(piv_cerr) + ag_man.P
    poner_sueltas(claves, {
        3: (piv + V(-0.07, 0.06, -0.10), V(0.6, 0.6, 0.3), V(-0.5, 0, -0.8), (30.0, 15.0, 6.0)),
        15: (a_arma(G1, d1, u1, CARTUCHERA_L + V(0, 0, 0.12)), V(0.2, 0.3, -1), V(-1, 0, 0), (20.0, 10.0, 10.0)),
        18: (a_arma(G1, d1, u1, CARTUCHERA_L + V(0, 0, 0.06)), V(0.2, 0.3, -1), V(-1, 0, 0), (55.0, 30.0, 4.0)),
        31: (piv + V(-0.01, 0.03, -0.16), V(0.5, 0.3, 0.8), V(-0.8, 0, 0.2), (15.0, 10.0, 4.0)),
        # rodea el cajón por la izquierda camino a la manija (en línea recta lo atravesaba)
        33: (Vector(previa[0]) * 0.5 + piv * 0.5 + V(-0.08, 0.0, -0.03), V(0.6, 0.1, 0.2), V(-0.7, -0.3, 0.3),
             (22.0, 12.0, 4.0)),
        36: (Vector(previa[0]), previa[1], previa[2], (30.0, 15.0, 4.0)),
        42: (pm + Vector(tirar) + V(-0.015, -0.01, 0.02), previa[1], previa[2], (10.0, 10.0, 8.0)),
        45: (V(-0.08, 0.14, 0.04), V(0.6, 0.6, 0.0), V(0, 0, -1), (25.0, 12.0, 4.0)),
    })
    for f, dd in ((7, (70.0, 40.0, 0.0)), (11, (70.0, 40.0, 0.0)), (19, (70.0, 40.0, 0.0)), (30, (70.0, 40.0, 0.0)),
                  (38, (75.0, 20.0, 0.0)), (41, (75.0, 20.0, 0.0)), (49, (42.0, 18.0, 4.0))):
        claves[f]['dL'] = dd
    bolsa = a_arma(G1, d1, u1, CARTUCHERA_L + V(0, 0, 0.12))
    gb = rot_arma(G1, d1, u1, marco(V(0, 0, 0), V(0.1, -1, 0), V(0, 0.15, 1)).to_3x3())
    cargador = Pieza(piv, escalar({
        0: dict(), 7: dict(),
        11: dict(dp=salida, rot=(8.0, 0.0, 0.0)),
        16: dict(s=0.0), 17: dict(pos=bolsa, rot=gb, s=0.0), 18: dict(pos=bolsa, rot=gb, s=0.0),
        19: dict(pos=bolsa + V(0, 0, 0.02), rot=gb, s=1.0),
        24: dict(pos=piv + V(-0.04, 0.03, -0.12), rot=(14.0, 0.0, -10.0)),
        27: dict(dp=Vector(salida) * 0.4, rot=(6.0, 0.0, 0.0)),
        30: dict(dp=(0, 0, 0), rot=(0.0, 0.0, 0.0)),
    }, k), caidas=[(int(round(11 * k)), int(round(16 * k)))], giro_caida=(-260, 40, 0))
    cerrojo = Pieza(piv_cerr, escalar({0: dict(), 38: dict(), 41: dict(dp=tirar), 42: dict(dp=(0, 0, 0))}, k))

    def mano_L(C, f, kk, Mg):
        return pesos(kk, {
            'wa': AG_GUARDAMANOS().en(Mg),
            'wx': AG_LIBRE(kk['PL'], kk['yL'], kk['zL']).en(Mg),
            'wc': C.toma('cargador', f, ag_carg),
            'wm': C.toma('cerrojo', f, ag_man),
        })

    return Recarga(nombre, arma, 'Rifle', T, escalar(claves, k), {'cargador': cargador, 'cerrojo': cerrojo}, mano_L)


def recarga_rifle(**kw):
    # manija de carga atrás, arriba del cajón (en T): se engancha con los dedos y se tira hacia atrás
    return recarga_cargador(
        'RecargaRifle', 'rifle', 53, (0, 0.101, 0.0), (0, 0.024, -0.115),
        Agarre(V(0, 0.030, -0.085), rot_agarre('L', V(1, 0.35, 0), V(0, -0.15, 1)), OFF_PUNO),
        (0, -0.064, 0.090), Agarre(V(-0.025, -0.009, 0.007), rot_mano(V(0.6, -0.3, -0.6), V(-0.3, -0.8, 0.4)), OFF_PUNO),
        (0, -0.055, 0), (V(-0.07, -0.02, 0.17), V(0.6, -0.2, -0.6), V(-0.3, -0.8, 0.4)), **kw)


def recarga_subfusil(**kw):
    # manija al costado izquierdo, adelante: la mano la pellizca desde afuera y la tira hacia atrás.
    # El subfusil queda 3 cm más cerca que el rifle: más adelante, el antebrazo izquierdo cruzaba los cargadores
    # del chaleco al meter el cargador nuevo (lo mide brazos_choque.py)
    kw.setdefault('G1', V(-0.16, -0.28, 1.25))
    return recarga_cargador(
        'RecargaSubfusil', 'subfusil', 48, (0, 0.097, -0.01), (0, 0.0, -0.115),
        Agarre(V(0, 0.0, -0.085), rot_agarre('L', V(1, 0.35, 0), V(0, 0, 1)), OFF_PUNO),
        (-0.031, 0.165, 0.080), Agarre(V(-0.018, 0.004, 0.0), rot_mano(V(0.15, 1, -0.35), V(-1, 0, 0.1)), OFF_PUNO),
        (0, -0.045, 0), (V(-0.10, 0.21, 0.10), V(0.15, 1, -0.35), V(-1, 0, 0.1)), **kw)


# ---------------------------------------------------------------------------
# Pistola (31 cuadros, 1,3 s): el cargador cae solo, la izquierda trae otro, lo calza, y monta la corredera.
def recarga_pistola(G1=V(-0.02, -0.29, 1.27), d1=V(0.22, -1, 0.30), rol1=-25.0, giro1=-6.0, incl1=11.0,
                    G2=V(-0.05, -0.31, 1.20), d2=V(0.12, -1, 0.15), rol2=18.0, giro2=-8.0, incl2=10.0):
    # la pistola 4 cm más adelante que antes y el torso inclinado: la cola de la corredera ya no toca el chaleco
    T = 31
    G0, d0, u0 = ARMAS['Pistola'][:3]
    G1, G2 = Vector(G1), Vector(G2)
    u1 = girar(V(0, 0.2, 1), d1, rol1)
    u2 = girar(V(0, 0.1, 1), d2, rol2)
    claves = {
        0: dict(),
        4: dict(G=G1, d=d1, u=u1, giro=giro1, incl=incl1, cab=(16.0, 6.0, 0.0), poloL=V(0.8, 0.3, -1.0)),
        19: dict(G=G1, d=d1, u=u1),
        21: dict(G=G1 + V(0, 0, 0.015)),
        24: dict(G=G2, d=d2, u=u2, giro=giro2, incl=incl2, cab=(10.0, 2.0, 0.0), poloL=V(0.9, 0.0, -0.8)),
        26: dict(G=G2 + V(0, 0.012, -0.004)),
        28: dict(G=G2),
        31: vuelta('Pistola'),
    }
    # pesos de la izquierda: p = envolviendo la mano derecha, x = suelta, c = cargador, s = corredera
    poner_pesos(claves, {0: (1, 0, 0, 0), 2: (0.4, 0.6, 0, 0), 8: (0, 1, 0, 0), 9: (0, 0, 1, 0), 18: (0, 0, 1, 0),
                         19.5: (0, 1, 0, 0), 23: (0, 1, 0, 0), 24: (0, 0, 0, 1), 26: (0, 0, 0, 1), 27: (0, 1, 0, 0),
                         28: (0, 1, 0, 0), 30: (1, 0, 0, 0)}, ('wa', 'wx', 'wc', 'wm'))
    poner_sueltas(claves, {
        2: (V(-0.06, 0.02, -0.08), V(0.4, 0.5, 0.6), V(-0.8, 0, -0.3), (30.0, 15.0, 6.0)),
        # pasa por delante y arriba de los cargadores del chaleco (en línea recta los dedos rozaban los del centro)
        5: (a_arma(G1, d1, u1, CARTUCHERA_L + V(-0.02, -0.12, 0.17)), V(0.2, 0.3, -1), V(-1, 0, 0), (30.0, 20.0, 4.0)),
        8: (a_arma(G1, d1, u1, CARTUCHERA_L + V(0.01, -0.01, 0.10)), V(0.2, 0.3, -1), V(-1, 0, 0), (50.0, 30.0, 4.0)),
        19.5: (V(-0.01, -0.02, -0.15), V(0.3, 0.4, 0.9), V(-0.6, 0, 0.3), (15.0, 10.0, 4.0)),
        # por el costado izquierdo de la pistola, de abajo del cargador a arriba de la corredera
        21.5: (V(-0.08, -0.02, -0.03), V(0.5, 0.2, 0.1), V(-0.6, -0.3, 0.4), (22.0, 12.0, 4.0)),
        23: (V(-0.04, 0.0, 0.11), V(0.7, -0.1, -0.7), V(-0.4, -0.6, 0.5), (30.0, 15.0, 4.0)),
        27: (V(-0.035, -0.06, 0.09), V(0.7, -0.1, -0.7), V(-0.4, -0.6, 0.5), (12.0, 10.0, 8.0)),
        28: (V(-0.06, -0.03, 0.06), V(0.6, 0.3, -0.5), V(-0.6, -0.4, 0.3), (25.0, 12.0, 4.0)),
    })
    for f, dd in ((9, (72.0, 40.0, 0.0)), (18, (72.0, 40.0, 0.0)), (24, (78.0, 50.0, 0.0)), (26, (78.0, 50.0, 0.0)),
                  (30, (58.0, 12.0, 0.0))):
        claves[f]['dL'] = dd
    piv = V(0, -0.033, -0.05)
    eje = V(0, -0.15, -0.99)
    bolsa = a_arma(G1, d1, u1, CARTUCHERA_L + V(0.01, -0.01, 0.10))
    gb = rot_arma(G1, d1, u1, marco(V(0, 0, 0), V(0.1, -1, 0), V(0, 0.15, 1)).to_3x3())
    cargador = Pieza(piv, {
        0: dict(), 2: dict(),
        3: dict(dp=eje * 0.025),
        7: dict(s=0.0), 8: dict(pos=bolsa, rot=gb, s=0.0),
        9: dict(pos=bolsa + V(0, 0, 0.02), rot=gb, s=1.0),
        14: dict(pos=piv + eje * 0.12 + V(-0.03, 0.02, 0.0), rot=(10.0, 0.0, -8.0)),
        17: dict(dp=eje * 0.04, rot=(3.0, 0.0, 0.0)),
        19: dict(dp=(0, 0, 0), rot=(0.0, 0.0, 0.0)),
    }, caidas=[(3, 7)], giro_caida=(200, 0, 60))
    corredera = Pieza(V(0, 0.060, 0.055), {0: dict(), 24: dict(), 26: dict(dp=(0, -0.038, 0)), 27: dict(dp=(0, 0, 0))})
    ag_carg = Agarre(V(0, 0.004, -0.062), rot_agarre('L', V(1, 0.35, 0), V(0, -0.15, 1)), OFF_PUNO)
    ag_corr = Agarre(V(-0.02, -0.090, 0.012), rot_mano(V(0.7, -0.1, -0.7), V(-0.4, -0.6, 0.5)), OFF_PUNO)

    def mano_L(C, f, kk, Mg):
        return pesos(kk, {
            'wa': AG_PISTOLA_L().en(Mg),
            'wx': AG_LIBRE(kk['PL'], kk['yL'], kk['zL']).en(Mg),
            'wc': C.toma('cargador', f, ag_carg),
            'wm': C.toma('corredera', f, ag_corr),
        })

    return Recarga('RecargaPistola', 'pistola', 'Pistola', T, claves, {'cargador': cargador, 'corredera': corredera},
                   mano_L)


# ---------------------------------------------------------------------------
# Escopeta (62 cuadros, 2,6 s): la gira de costado, mete cuatro cartuchos de a uno desde el portacartuchos y bombea.
def recarga_escopeta(G1=V(-0.13, -0.33, 1.20), d1=V(0.766, -0.643, 0.06), rol1=-55.0, giro1=-32.0, incl1=9.0):
    # como el rifle: cruzada al pecho con el cañón 50° a la izquierda para que la culata quede afuera del costado
    T = 66
    G0, d0, u0 = ARMAS['Rifle'][:3]
    G1 = Vector(G1)
    u1 = girar(V(0, 0, 1), d1, rol1)
    claves = {
        0: dict(),
        6: dict(G=G1, d=d1, u=u1, giro=giro1, incl=incl1, cab=(18.0, 8.0, 0.0), poloL=V(0.8, 0.2, -0.8)),
        54: dict(G=G1, d=d1, u=u1, giro=giro1, incl=incl1, cab=(18.0, 8.0, 0.0)),
        59: dict(G=G0 + V(0.0, -0.02, 0.03), d=d0, u=u0, giro=ARMAS['Rifle'][7][0], incl=4.0, cab=(6.0, 2.0, 0.0),
                 poloL=V(0.4, 0.0, -1.0)),
        61: dict(G=G0 + V(0.0, -0.01, 0.03)),
        63: dict(G=G0 + V(0.0, -0.02, 0.03)),
        66: vuelta('Rifle'),
    }
    pesos_t = {0: (1, 0, 0, 0), 4: (0.2, 0.8, 0, 0)}
    sueltas = {4: (V(-0.06, 0.10, 0.0), V(0.3, 0.6, -0.6), V(-1, 0, 0.2), (25.0, 12.0, 6.0))}
    cart = {0: dict(s=0.0)}
    sobre = V(-0.032, 0.073, 0.050)        # el portacartuchos (costado izquierdo)
    # cada cartucho, 12 cuadros: a+2 lo toma del portacartuchos, a+4 lo saca, a+6 en la ventana, a+8 adentro,
    # a+10 la mano suelta debajo del tubo y en a+12 ya está en el cartucho siguiente
    for i in range(4):
        a = 6 + 12 * i
        y = 0.106 - 0.022 * i
        pesos_t[a] = (0, 1, 0, 0)
        pesos_t[a + 2] = (0, 0, 1, 0)
        pesos_t[a + 8] = (0, 0, 1, 0)
        pesos_t[a + 10] = (0, 1, 0, 0)
        sueltas[a] = (V(-0.075, y, 0.075), V(0.2, 0.3, -1), V(-1, 0, 0.0), (20.0, 10.0, 8.0))
        sueltas[a + 10] = (V(-0.06, 0.14, -0.06), V(0.4, 0.6, 0.6), V(-0.8, 0, -0.4), (25.0, 12.0, 6.0))
        cart[a] = dict(pos=V(-0.033, y, 0.090), rot=(90.0, 0.0, 0.0), s=0.0)
        cart[a + 1] = dict(pos=V(-0.033, y, 0.090), rot=(90.0, 0.0, 0.0), s=1.0)
        cart[a + 2] = dict(pos=V(-0.033, y, 0.090), rot=(90.0, 0.0, 0.0))
        cart[a + 4] = dict(pos=V(-0.05, y + 0.02, 0.13), rot=(60.0, 0.0, 20.0))
        cart[a + 6] = dict(pos=V(0.0, 0.098, -0.028), rot=(0.0, 0.0, 0.0))
        cart[a + 8] = dict(pos=V(0.0, 0.140, 0.004), rot=(0.0, 0.0, 0.0), s=1.0)
        cart[a + 9] = dict(pos=V(0.0, 0.150, 0.010), s=0.0)
    pesos_t.update({54: (0, 1, 0, 0), 58: (0, 0, 0, 1), 64: (0, 0, 0, 1), 66: (1, 0, 0, 0)})
    sueltas[56] = (V(-0.06, 0.22, -0.02), V(0.8, 0.55, 0), V(0, 0, -1), (30.0, 12.0, 4.0))
    poner_pesos(claves, pesos_t, ('wa', 'wx', 'wc', 'wm'))
    poner_sueltas(claves, sueltas)
    for i in range(4):
        a = 6 + 12 * i
        claves[a + 2]['dL'] = (62.0, 50.0, 0.0)
        claves[a + 8]['dL'] = (62.0, 50.0, 0.0)
    claves[58]['dL'] = (45.0, 20.0, 4.0)
    cartucho = Pieza(V(0, 0.124, 0.010), cart)
    bomba = Pieza(V(0, 0.28, 0.030), {0: dict(), 59: dict(), 61: dict(dp=(0, -0.075, 0)), 63: dict(dp=(0, 0, 0))})
    # el cartucho se toma por el culote, con la palma hacia arriba y el pulgar empujando
    ag_cart = Agarre(V(0, -0.052, -0.012), rot_mano(V(0.2, 1, 0.1), V(0, 0, -1)), OFF_PALMA)
    ag_bomba = Agarre(V(0, APOYO - 0.28, 0.035 - 0.030), rot_mano(V(0.8, 0.55, 0), V(0, 0, -1)), OFF_PALMA)

    def mano_L(C, f, kk, Mg):
        return pesos(kk, {
            'wa': AG_GUARDAMANOS().en(Mg),
            'wx': AG_LIBRE(kk['PL'], kk['yL'], kk['zL']).en(Mg),
            'wc': C.toma('cartucho', f, ag_cart),
            'wm': C.toma('bomba', f, ag_bomba),
        })

    return Recarga('RecargaEscopeta', 'escopeta', 'Rifle', T, claves, {'cartucho': cartucho, 'bomba': bomba}, mano_L)


def bombeo_escopeta(apunta=False):
    # después de cada tiro: la bomba atrás y adelante (14 cuadros), con el arma que sube un poco
    T = 14
    base = 'RifleApunta' if apunta else 'Rifle'
    G0, d0, u0 = ARMAS[base][:3]
    dz = girar(Vector(d0), Vector(d0).cross(Vector(u0)), 5)
    atras = 0.008 if apunta else 0.02     # apuntando, la culata ya está contra el hombro: casi no puede ir atrás
    claves = {0: dict(wm=1.0), 2: dict(G=Vector(G0) + V(0, atras, 0.01), d=dz), 6: dict(G=Vector(G0) + V(0, atras * 0.75, 0.0)),
              10: dict(G=G0, d=d0), 14: dict()}
    bomba = Pieza(V(0, 0.28, 0.030), {0: dict(), 3: dict(), 6: dict(dp=(0, -0.075, 0)), 7: dict(dp=(0, -0.075, 0)),
                                       10: dict(dp=(0, 0, 0))})
    ag_bomba = Agarre(V(0, APOYO - 0.28, 0.035 - 0.030), rot_mano(V(0.8, 0.55, 0), V(0, 0, -1)), OFF_PALMA)

    def mano_L(C, f, kk, Mg):
        return [(1.0, C.toma('bomba', f, ag_bomba))]

    return Recarga('BombeoEscopetaApunta' if apunta else 'BombeoEscopeta', 'escopeta', base, T, claves,
                   {'bomba': bomba}, mano_L)


# ---------------------------------------------------------------------------
# Francotirador (58 cuadros, 2,4 s): la derecha abre el cerrojo, saca una bala del chaleco, la mete y cierra.
# La izquierda sostiene el arma por el guardamanos todo el tiempo.
def recarga_francotirador(G1=V(-0.10, -0.32, 1.22), d1=V(0.530, -0.848, 0.05), rol1=22.0, giro1=-28.0, incl1=7.0):
    # el arma adelante y con el cañón 32° a la izquierda: la culata pasa por afuera del costado derecho
    T = 58
    G0, d0, u0 = ARMAS['Rifle'][:3]
    G1 = Vector(G1)
    u1 = girar(V(0, 0, 1), d1, rol1)
    claves = {
        0: dict(),
        6: dict(G=G1, d=d1, u=u1, giro=giro1, incl=incl1, cab=(16.0, 4.0, 0.0), poloR=V(-1.0, 0.3, -0.5)),
        50: dict(G=G1, d=d1, u=u1, giro=giro1, incl=incl1, cab=(16.0, 4.0, 0.0)),
        56: vuelta('Rifle'),
        58: dict(),
    }
    # pesos de la derecha: e = empuñadura, x = suelta, c = cerrojo, b = bala
    pesos_t = {0: (1, 0, 0, 0), 3: (0.3, 0.7, 0, 0), 7: (0, 0, 1, 0), 15: (0, 0, 1, 0), 17: (0, 1, 0, 0),
               22: (0, 1, 0, 0), 23: (0, 0, 0, 1), 33: (0, 0, 0, 1), 35: (0, 1, 0, 0), 37: (0, 0, 1, 0),
               45: (0, 0, 1, 0), 47: (0, 1, 0, 0), 51: (1, 0, 0, 0)}
    poner_pesos(claves, pesos_t, ('we', 'wxr', 'wc', 'wb'))
    bolsillo = a_arma(G1, d1, u1, V(-0.10, -0.19, 1.30))
    poner_sueltas(claves, {
        3: (V(0.05, -0.02, 0.06), V(0.3, 1, 0), V(0.2, 0, 1), (40.0, 20.0, 10.0)),
        17: (V(0.07, -0.13, 0.05), V(-0.2, 0.3, -1), V(1, 0, 0), (25.0, 15.0, 15.0)),
        22: (bolsillo, V(-0.2, 0.3, -1), V(1, 0, 0), (55.0, 40.0, 20.0)),
        35: (V(0.07, -0.08, 0.07), V(0.3, 1, 0), V(0.2, 0, 1), (35.0, 20.0, 15.0)),
        47: (V(0.06, -0.10, 0.02), V(0.3, 1, -0.2), V(0.4, 0, 1), (40.0, 20.0, 15.0)),
    }, lado='R')
    for f, dd in ((7, (75.0, 45.0, 75.0)), (15, (75.0, 45.0, 75.0)), (23, (70.0, 55.0, 45.0)), (33, (70.0, 55.0, 45.0)),
                  (37, (75.0, 45.0, 75.0)), (45, (75.0, 45.0, 75.0)), (51, (68.0, 28.0, 30.0))):
        claves[f]['dR'] = dd
    rz = V(0, 0, 0)
    cerrojo = Pieza(V(0, -0.070, ANIMA_FRANCO), {
        0: dict(), 8: dict(), 11: dict(rot=(0.0, -62.0, 0.0)), 15: dict(dp=(0, -0.072, 0), rot=(0.0, -62.0, 0.0)),
        37: dict(dp=(0, -0.072, 0), rot=(0.0, -62.0, 0.0)), 41: dict(dp=(0, 0, 0), rot=(0.0, -62.0, 0.0)),
        44: dict(dp=(0, 0, 0), rot=(0.0, 0.0, 0.0)),
    })
    zb = ANIMA_FRANCO + 0.006
    bp = a_arma(G1, d1, u1, V(-0.10, -0.19, 1.33))
    bala = Pieza(V(0, 0.040, zb), {
        0: dict(s=0.0), 22: dict(pos=bp, rot=(-70.0, 0.0, 0.0), s=0.0), 23: dict(pos=bp, rot=(-70.0, 0.0, 0.0), s=1.0),
        28: dict(pos=V(0.04, 0.02, zb + 0.07), rot=(-20.0, 0.0, 10.0)),
        31: dict(pos=V(0.0, 0.035, zb + 0.03), rot=(0.0, 0.0, 0.0)),
        33: dict(pos=V(0.0, 0.040, zb), rot=(0.0, 0.0, 0.0), s=1.0),
        39: dict(pos=V(0.0, 0.040, zb), s=1.0), 40: dict(pos=V(0.0, 0.050, zb), s=0.0),
    })
    # la bola del cerrojo: puño cerrado arriba de ella
    ag_cerr = Agarre(V(0.050, 0.018, -0.020), rot_agarre('R', V(0.2, 1, 0.3), V(0.3, 0, 1)), OFF_PUNO)
    ag_bala = Agarre(V(0.0, -0.035, 0.022), rot_mano(V(0.1, 1, -0.4), V(0.1, 0.3, 1)), OFF_PALMA)

    def mano_R(C, f, kk, Mg):
        return pesos(kk, {
            'we': AG_EMPUNADURA().en(Mg),
            'wxr': AG_LIBRE(kk['PR'], kk['yR'], kk['zR'], palma=False).en(Mg),
            'wc': C.toma('cerrojo', f, ag_cerr),
            'wb': C.toma('bala', f, ag_bala),
        })

    def mano_L(C, f, kk, Mg):
        return [(1.0, AG_GUARDAMANOS().en(Mg))]

    return Recarga('RecargaFranco', 'francotirador', 'Rifle', T, claves, {'cerrojo': cerrojo, 'bala': bala}, mano_L,
                   mano_R)


ANIMA_FRANCO = 0.068


# ---------------------------------------------------------------------------
# Lanzacohetes (67 cuadros, 2,8 s): lo baja del hombro y lo para, saca un cohete de la espalda por encima del
# hombro izquierdo, lo mete por la boca hasta el fondo y lo vuelve a subir al hombro.
def recarga_lanzacohetes(G1=V(-0.21, -0.30, 1.16), d1=V(0.70, 0.05, 0.70), u1=V(0.1, -1, 0.0), giro=-22.0, incl1=-2.0,
                         poloR=V(-1.0, 0.4, -0.2), giro2=-12.0, agarra=57, arriba=V(0.28, -0.02, 1.75), f_arriba=11,
                         despega=V(0, 0, 0.03), f_despega=(3, 55)):
    # G1/d1/u1: el lanzacohetes parado durante la carga (empuñadura, dirección del tubo y "arriba" del arma, espacio
    # del personaje). La empuñadura queda a la derecha y adelante, con el tubo por delante de la mano (u1 hacia
    # adelante) y cruzado 45° hacia el hombro izquierdo: así el tubo no toca el pecho y la boca queda al alcance de
    # la mano izquierda. 'arriba': por dónde pasa la mano izquierda camino a la espalda; 'agarra': cuadro en que
    # vuelve a tomar la empuñadura delantera.
    T = 67
    G0, d0, u0 = ARMAS['Lanzacohetes'][:3]
    Tz = 0.120
    claves = {
        0: dict(),
        10: dict(G=G1, d=d1, u=u1, giro=giro, incl=incl1, cab=(-14.0, 8.0, 0.0), hR=0.0, poloL=V(0.6, 0.6, -0.6),
                 poloR=poloR),
        32: dict(G=G1 + V(0, 0, 0.01)),
        42: dict(G=G1 + V(0, 0, -0.02), d=d1, u=u1, giro=giro, incl=incl1 + 2.0, cab=(-10.0, 8.0, 0.0)),
        46: dict(G=G1),
        58: dict(G=G0, d=d0, u=u0, giro=giro2, incl=3.0, cab=(7.0, -3.0, 6.0), hR=5.0, poloL=V(0.4, 0.1, -1.0),
                 poloR=V(-0.9, 0.3, -0.5)),
        67: dict(),
    }
    if despega is not None:
        # al sacarlo del hombro y al volver a apoyarlo, el tubo sube un poco: si bajara derecho, la cola se hundiría en
        # el hombro en los cuadros de transición
        for f in f_despega:
            claves[f] = dict(G=G0 + despega)
    poner_pesos(claves, {0: (1, 0, 0), 4: (0.3, 0.7, 0), 15: (0, 1, 0), 17: (0, 0, 1), 42: (0, 0, 1), 44: (0, 1, 0),
                         52: (0, 1, 0), agarra: (1, 0, 0)}, ('wa', 'wx', 'wc'))
    espalda = a_arma(G1, d1, u1, ESPALDA_L)
    poner_sueltas(claves, {
        4: (V(-0.10, 0.20, 0.05), V(0.3, 0.6, 0.6), V(-1, 0, 0), (35.0, 15.0, 4.0)),
        15: (espalda, V(0, 0, 1), V(0, -1, 0), (55.0, 35.0, 4.0)),
        44: (V(-0.07, 0.80, Tz), V(0, 1, 0), V(-1, 0, 0), (20.0, 10.0, 6.0)),
        52: (V(-0.10, 0.45, 0.02), V(0.3, 0.6, 0.6), V(-1, 0, 0), (35.0, 15.0, 4.0)),
    })
    if arriba is not None:
        # la mano pasa por arriba y por afuera del hombro izquierdo (si fuera derecho a la espalda cruzaría el pecho)
        poner_sueltas(claves, {f_arriba: (a_arma(G1, d1, u1, arriba), V(0, 0.7, 0.7), V(-1, 0, 0), (45.0, 25.0, 4.0))})
    for f, dd in ((17, (78.0, 50.0, 0.0)), (42, (78.0, 50.0, 0.0)), (agarra, (70.0, 35.0, 0.0))):
        claves[f]['dL'] = dd
    piv = V(0, 0.600, Tz)
    # el cohete sale de la espalda apuntando arriba, pasa por encima del hombro y entra por la boca
    ce = a_arma(G1, d1, u1, ESPALDA_L + V(0.0, 0.0, 0.10))
    re = rot_arma(G1, d1, u1, marco(V(0, 0, 0), V(0, 0.3, 1), V(0, -1, 0.3)).to_3x3())
    cohete = Pieza(piv, {
        0: dict(s=0.0), 15: dict(pos=ce, rot=re, s=0.0), 16: dict(pos=ce, rot=re, s=1.0),
        24: dict(pos=a_arma(G1, d1, u1, V(0.26, -0.18, 1.86)), rot=(0.0, 0.0, 20.0)),
        30: dict(pos=piv + V(0, 0.22, 0), rot=(0.0, 0.0, 0.0)),
        40: dict(dp=(0, 0, 0)),
    })
    ag_coh = Agarre(V(-0.048, 0.030, 0.0), rot_agarre('L', V(1, 0, 0), V(0, 1, 0)), OFF_PUNO)

    def mano_L(C, f, kk, Mg):
        return pesos(kk, {
            'wa': AG_VERTICAL_L().en(Mg),
            'wx': AG_LIBRE(kk['PL'], kk['yL'], kk['zL']).en(Mg),
            'wc': C.toma('cohete', f, ag_coh),
        })

    return Recarga('RecargaCohete', 'lanzacohetes', 'Lanzacohetes', T, claves, {'cohete': cohete}, mano_L)


RECARGAS = {
    'RecargaRifle': recarga_rifle,
    'RecargaSubfusil': recarga_subfusil,
    'RecargaPistola': recarga_pistola,
    'RecargaEscopeta': recarga_escopeta,
    'BombeoEscopeta': lambda: bombeo_escopeta(False),
    'BombeoEscopetaApunta': lambda: bombeo_escopeta(True),
    'RecargaFranco': recarga_francotirador,
    'RecargaCohete': recarga_lanzacohetes,
}


def calcular(nombre):
    C = RECARGAS[nombre]()
    poses = [(f, C.pose(f)) for f in range(C.T + 1)]
    piezas = {n: [C.pieza(n, f) for f in range(C.T + 1)] for n in C.piezas}
    return C, poses, piezas


def grabar_recarga(nombre):
    DIAG.clear()
    C, poses, piezas = calcular(nombre)
    act = grabar(nombre, poses, loop=False)
    return C, piezas, {kk: round(v, 3) for kk, v in DIAG.items()}


# ---------------------------------------------------------------------------
# Vista previa: el arma horneada colgada del hueso Arma.R y las piezas animadas con el clip
def colgar_arma(arma):
    arm = bpy.data.objects[ARM]
    raiz = bpy.data.objects.get(arma)
    for c in bpy.data.collections:
        if c.name.startswith('exp_'):
            c.hide_render = c.name != 'exp_' + arma
            c.hide_viewport = c.hide_render
            if not c.hide_render and c.name not in bpy.context.scene.collection.children:
                bpy.context.scene.collection.children.link(c)
    raiz.parent = arm
    raiz.parent_type = 'BONE'
    raiz.parent_bone = 'Arma.R'
    raiz.matrix_parent_inverse = Matrix.Identity(4)
    raiz.location = (0, -arm.data.bones['Arma.R'].length, 0)
    raiz.rotation_euler = (0, 0, 0)
    return raiz


def animar_piezas(C, piezas, nombre_accion=None):
    # una acción por pieza con cuadros en todos los frames (lineal: ya viene muestreado)
    out = []
    for n, lista in piezas.items():
        ob = bpy.data.objects[C.arma + '_' + n]
        ob.rotation_mode = 'QUATERNION'
        an = '%s_%s' % (nombre_accion or C.nombre, n)
        old = bpy.data.actions.get(an)
        if old:
            bpy.data.actions.remove(old)
        ob.animation_data_create()
        ob.animation_data.action = None
        for f, (L, s) in enumerate(lista):
            ob.location = L.to_translation()
            ob.rotation_quaternion = L.to_quaternion()
            ob.scale = (s, s, s)
            for dp in ('location', 'rotation_quaternion', 'scale'):
                ob.keyframe_insert(dp, frame=f)
        act = ob.animation_data.action
        act.name = an
        for fc in _fcurves(act):
            for kp in fc.keyframe_points:
                kp.interpolation = 'LINEAR'
        out.append(act)
    return out


def poner_clip(nombre):
    arm = bpy.data.objects[ARM]
    act = bpy.data.actions[nombre]
    arm.animation_data_create()
    arm.animation_data.action = act
    try:
        if act.slots and arm.animation_data.action_slot is None:
            arm.animation_data.action_slot = act.slots[0]
    except AttributeError:
        pass
