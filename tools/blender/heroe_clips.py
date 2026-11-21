# Clips del héroe hechos por código: locomoción con pies plantados (IK), aire, pico, armas y baile.
# Requiere heroe_anim.py ejecutado antes en el mismo espacio de nombres (Pose, reposo, grabar, q_eje, ...).
# Espacio del personaje: X izquierda, -Y adelante, Z arriba. El piso está en z = SUELO (la suela en reposo);
# al exportar se sube el esqueleto para que quede en 0.
import bpy, math
from mathutils import Vector, Matrix, Quaternion

SUELO = -0.032
DIAG = {}
_B = {}


def lerp(a, b, t):
    return a + (b - a) * t


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ss(a, b, x):
    t = clamp((x - a) / (b - a))
    return t * t * (3 - 2 * t)


def V(x, y, z):
    return Vector((x, y, z))


def M3(axis, deg):
    return q_eje(axis, deg).to_matrix()


def INCL(d):
    # inclina hacia adelante (la parte de arriba va a -Y)
    return M3(IZQ, d)


def LADEO(d):
    # ladea la parte de arriba hacia la derecha del personaje (-X)
    return M3(ADELANTE, d)


def GIRO(d):
    # gira hacia la izquierda del personaje
    return M3(ARRIBA, d)


def S(l):
    return 1.0 if l == 'L' else -1.0


def base():
    if not _B:
        p = reposo()
        _B['A'] = {l: p.head('Foot.' + l).copy() for l in 'LR'}
        _B['hom'] = {l: p.head('UpperArm.' + l).copy() for l in 'LR'}
        _B['cad'] = {l: p.head('UpperLeg.' + l).copy() for l in 'LR'}
        _B['pierna'] = p.bones['UpperLeg.L'].length + p.bones['LowerLeg.L'].length
        _B['brazo'] = p.bones['UpperArm.L'].length + p.bones['LowerArm.L'].length
    return _B


# ---------------------------------------------------------------------------
class Curva:
    # Cúbica de Hermite por tiempo. Las tangentes son tipo Catmull-Rom pero limitadas (Fritsch-Carlson):
    # no se pasa de las claves ni rebota en los extremos. periodo: se repite; sin periodo se sostiene en los bordes.
    # m0/m1: tangentes forzadas en el primer y último punto (para empalmar con otro tramo).
    def __init__(self, claves, periodo=None, m0=None, m1=None):
        ks = sorted(claves, key=lambda c: c[0])
        self.esc = not hasattr(ks[0][1], '__len__')
        self.t = [float(c[0]) for c in ks]
        self.v = [[float(c[1])] if self.esc else [float(x) for x in c[1]] for c in ks]
        self.P, self.m0, self.m1 = periodo, m0, m1

    def _k(self, i):
        n = len(self.t)
        if self.P:
            q, r = divmod(i, n)
            return self.t[r] + q * self.P, self.v[r]
        i = max(0, min(n - 1, i))
        return self.t[i], self.v[i]

    def _tan(self, i):
        n = len(self.t)
        dim = len(self.v[0])
        if not self.P:
            if i <= 0:
                return list(self.m0) if self.m0 is not None else [0.0] * dim
            if i >= n - 1:
                return list(self.m1) if self.m1 is not None else [0.0] * dim
        ta, pa = self._k(i - 1)
        tb, pb = self._k(i)
        tc, pc = self._k(i + 1)
        out = []
        for a, b, c in zip(pa, pb, pc):
            d1 = (b - a) / (tb - ta)
            d2 = (c - b) / (tc - tb)
            if d1 * d2 <= 0:
                out.append(0.0)
                continue
            m = (c - a) / (tc - ta)
            lim = 3 * min(abs(d1), abs(d2))
            out.append(math.copysign(min(abs(m), lim), m))
        return out

    def __call__(self, t):
        n = len(self.t)
        if self.P:
            t = self.t[0] + (t - self.t[0]) % self.P
            i = n - 1
            for j in range(1, n):
                if self.t[j] > t:
                    i = j - 1
                    break
        else:
            if t <= self.t[0]:
                return self._sal(self.v[0])
            if t >= self.t[-1]:
                return self._sal(self.v[-1])
            i = 0
            while self.t[i + 1] <= t:
                i += 1
        t0, p0 = self._k(i)
        t1, p1 = self._k(i + 1)
        m0 = self._tan(i)
        m1 = self._tan(i + 1)
        h = t1 - t0
        s = (t - t0) / h
        h00 = 2 * s ** 3 - 3 * s ** 2 + 1
        h10 = s ** 3 - 2 * s ** 2 + s
        h01 = -2 * s ** 3 + 3 * s ** 2
        h11 = s ** 3 - s ** 2
        out = [h00 * a + h10 * h * ma + h01 * b + h11 * h * mb for a, b, ma, mb in zip(p0, p1, m0, m1)]
        return self._sal(out)

    def _sal(self, v):
        return v[0] if self.esc else list(v)


class Claves:
    # Varias curvas con nombre que comparten tiempos: Claves({0: dict(a=1, b=(0,0,0)), 10: dict(...)}, periodo)
    # Un parámetro que falta en una clave toma el valor de la clave anterior.
    def __init__(self, tabla, periodo=None):
        ts = sorted(tabla)
        nombres = []
        for t in ts:
            for k in tabla[t]:
                if k not in nombres:
                    nombres.append(k)
        self.c = {}
        for k in nombres:
            pts = []
            ult = None
            for t in ts:
                v = tabla[t].get(k, ult)
                if v is None:
                    continue
                ult = v
                pts.append((t, v))
            self.c[k] = Curva(pts, periodo)

    def __call__(self, t):
        return {k: c(t) for k, c in self.c.items()}


# ---------------------------------------------------------------------------
# Pies y piernas
def contacto(l, cual):
    s = S(l)
    if cual == 'talon':
        return V(s * 0.19, 0.135, SUELO)
    return V(s * 0.22, -0.08, -0.026)


def tobillo_plano(l, Ap, pitch, yaw):
    # Ap: dónde queda el tobillo con el pie plano en el piso. Con pitch<0 el pie gira sobre el talón, con pitch>0
    # sobre la bola del pie; el punto de apoyo no se mueve (sin patinar).
    A0 = base()['A'][l]
    c = contacto(l, 'talon' if pitch < 0 else 'bola')
    Rz = GIRO(yaw)
    R = INCL(pitch) @ Rz
    piv = Vector(Ap) + Rz @ (c - A0)
    return piv - R @ (c - A0)


def pierna(p, l, A, pitch=0.0, toe=0.0, yaw=0.0, polo=None, pie=True):
    s = S(l)
    if polo is None:
        polo = V(s * 0.15, -1.0, 0.0)
    H = p.head('UpperLeg.' + l)
    DIAG['pierna'] = max(DIAG.get('pierna', 0.0), (Vector(A) - H).length / base()['pierna'])
    p.ik('UpperLeg.' + l, 'LowerLeg.' + l, Vector(A), polo)
    if pie:
        p.pie(l, pitch, toe, yaw)


def brazo(p, l, W, polo):
    H = p.head('UpperArm.' + l)
    DIAG['brazo'] = max(DIAG.get('brazo', 0.0), (Vector(W) - H).length / base()['brazo'])
    p.ik('UpperArm.' + l, 'LowerArm.' + l, Vector(W), polo)


def mano(p, l, R, reparto=0.5):
    # pone la mano con orientación absoluta R y pasa parte de la torsión al antebrazo (sin muñeca "retorcida")
    n = 'Hand.' + l
    p._set_world_rot(n, R)
    p.fk()
    q = p.base[n]
    ang = math.degrees(2 * math.atan2(q.y, q.w))
    ang = (ang + 180) % 360 - 180
    if reparto and abs(ang) > 0.01:
        p.rot_local('LowerArm.' + l, (0, 1, 0), ang * reparto)
        p._set_world_rot(n, R)
        p.fk()


OFF_PUNO = Vector((0, 0.085, -0.035))     # centro del puño cerrado (por donde pasa un mango), en ejes de la mano
OFF_PALMA = Vector((0, 0.075, -0.03))     # centro de la palma abierta


def rot_agarre(l, d, u):
    # mano cerrada sobre un mango: los nudillos siguen 'd' y el lado del índice mira a 'u'
    d = Vector(d).normalized()
    u = Vector(u)
    u = (u - d * u.dot(d)).normalized()
    x = -u if l == 'R' else u
    return Matrix((x, d, x.cross(d))).transposed()


def rot_mano(y, z):
    # mano con los nudillos hacia 'y' y el dorso hacia 'z'
    y = Vector(y).normalized()
    z = Vector(z)
    z = (z - y * z.dot(y)).normalized()
    return Matrix((y.cross(z), y, z)).transposed()


def poner_mano(p, l, P, R, polo, off=OFF_PUNO, reparto=0.5):
    # la mano con orientación R y el punto 'off' de la mano en P
    W = Vector(P) - R @ off
    brazo(p, l, W, polo)
    mano(p, l, R, reparto)


def desde_hombro(p, l, o):
    # punto a 'o' (coordenadas de reposo) del hombro, girando con el pecho
    return p.head('UpperArm.' + l) + p.delta('Spine2').to_3x3() @ Vector(o)


def en_torso(p, P):
    # punto dado en coordenadas de reposo que se mueve con el pecho (Spine2)
    return p.delta('Spine2') @ Vector(P)


def dir_torso(p, d):
    return p.delta('Spine2').to_3x3() @ Vector(d)


def hombro(p, l, arriba=0.0, adelante=0.0):
    # sube (grados) y adelanta la clavícula
    s = S(l)
    if arriba:
        p.rot('Shoulder.' + l, ADELANTE, s * arriba)
    if adelante:
        p.rot('Shoulder.' + l, ARRIBA, -s * adelante)


def columna(p, giro=0.0, incl=0.0, ladeo=0.0, cuello=0.0, cabeza=(0.0, 0.0, 0.0), reparto=(0.25, 0.35, 0.4)):
    # orienta Spine, Spine1 y Spine2 (absolutos) repartiendo giro/inclinación/ladeo; cabeza = (incl, giro, ladeo)
    acc = 0.0
    for n, f in zip(('Spine', 'Spine1', 'Spine2'), reparto):
        acc += f
        p.orientar(n, GIRO(giro * acc) @ LADEO(ladeo * acc) @ INCL(incl * acc))
    ci, cg, cl = cabeza
    p.orientar('Neck', GIRO(lerp(giro, cg, 0.5)) @ LADEO(lerp(ladeo, cl, 0.5)) @ INCL(lerp(incl, ci, 0.5) + cuello))
    p.orientar('Head', GIRO(cg) @ LADEO(cl) @ INCL(ci))


# ---------------------------------------------------------------------------
class Marcha:
    # Ciclo de pasos. Fase 0 = el pie izquierdo toca el piso; el derecho va medio ciclo atrasado.
    # El pie apoyado queda fijo en el mundo mientras el cuerpo avanza a la velocidad v del clip (sin patinar):
    # rueda del talón a la planta y despega sobre la bola. El vuelo es una curva por claves que empalma con
    # la velocidad del apoyo en los dos extremos.
    def __init__(self, nombre, **k):
        self.nombre = nombre
        self.ancho = 0.12
        self.giro_pie = -8.0
        self.p_land, self.p_mid, self.p_off = -6.0, 0.0, 50.0
        self.roll = (0.2, 0.45)
        self.cadera = [(0.0, -0.05)]
        self.cadera_y = 0.0
        self.balanceo = 0.015
        self.giro_cadera = 8.0
        self.ladeo_cadera = 4.0
        self.incl_cadera = 4.0
        self.incl = 8.0
        self.giro_hombros = 10.0
        self.retraso = 0.03
        self.cabeza = 0.0
        self.brazo_adelante = (-0.09, -0.24, -0.25)
        self.brazo_atras = (0.0, 0.2, -0.40)
        self.brazo_polo = (0.35, 0.9, -0.3)
        self.puno = (55.0, 35.0)
        self.muneca = -10.0
        self.hombros = 0.0
        self.vuelo = []
        self.__dict__.update(k)
        self.ts = self.duty * self.T / FPS
        self.v = (self.y_off - self.y_land) / self.ts
        self.zc = Curva(self.cadera, periodo=0.5)
        self._sw = {}

    def apoyo(self, l, u):
        A0 = base()['A'][l]
        Ap = V(S(l) * self.ancho, A0.y + lerp(self.y_land, self.y_off, u), A0.z)
        a, b = self.roll
        if u < a:
            pitch = lerp(self.p_land, self.p_mid, ss(0, a, u))
        elif u < b:
            pitch = self.p_mid
        else:
            pitch = lerp(self.p_mid, self.p_off, ((u - b) / (1 - b)) ** 1.5)
        A = tobillo_plano(l, Ap, pitch, S(l) * self.giro_pie)
        toe = -max(0.0, pitch) * 0.95
        return [A.x, A.y, A.z, pitch, toe]

    def curva_vuelo(self, l):
        if l not in self._sw:
            e0 = self.apoyo(l, 1.0)
            e1 = self.apoyo(l, 0.0)
            h = 1e-3
            k = (1 - self.duty) / self.duty
            d0 = [(a - b) / h * k for a, b in zip(e0, self.apoyo(l, 1 - h))]
            d1 = [(b - a) / h * k for a, b in zip(e1, self.apoyo(l, h))]
            A0 = base()['A'][l]
            ks = [(0.0, e0)]
            for (u, dx, dy, z, pitch, toe) in self.vuelo:
                ks.append((u, [S(l) * (self.ancho + dx), A0.y + dy, z, pitch, toe]))
            ks.append((1.0, e1))
            self._sw[l] = Curva(ks, m0=d0, m1=d1)
        return self._sw[l]

    def pie(self, l, fase):
        f = fase % 1.0
        if f < self.duty:
            e = self.apoyo(l, f / self.duty)
        else:
            e = self.curva_vuelo(l)((f - self.duty) / (1 - self.duty))
        return V(e[0], e[1], e[2]), e[3], e[4]

    def pose(self, fase, brazos=True):
        w = 2 * math.pi
        p = reposo()
        dz = self.zc(fase)
        sway = self.balanceo * math.cos(w * (fase - self.duty * 0.5))
        p.mover_cadera(V(sway, self.cadera_y, dz))
        yaw = -self.giro_cadera * math.cos(w * (fase - self.retraso))
        roll = self.ladeo_cadera * math.cos(w * (fase - self.duty * 0.5))
        p.orientar('Hips', GIRO(yaw) @ LADEO(roll) @ INCL(self.incl_cadera))
        ys = self.giro_hombros * math.cos(w * (fase - self.retraso))
        bob = math.cos(2 * w * (fase - self.duty * 0.5))
        p.orientar('Spine', GIRO(yaw * 0.45) @ LADEO(roll * 0.4) @ INCL(lerp(self.incl_cadera, self.incl, 0.4)))
        p.orientar('Spine1', GIRO(ys * 0.45) @ LADEO(-roll * 0.1) @ INCL(self.incl * 0.9 + bob * 0.8))
        p.orientar('Spine2', GIRO(ys) @ LADEO(-roll * 0.3) @ INCL(self.incl + bob * 1.2))
        p.orientar('Neck', GIRO(ys * 0.4) @ INCL(lerp(self.incl, self.cabeza, 0.6)))
        p.orientar('Head', GIRO(ys * 0.12) @ INCL(self.cabeza - bob * 1.0))
        for l, off in (('L', 0.0), ('R', 0.5)):
            A, pitch, toe = self.pie(l, fase - off)
            pierna(p, l, A, pitch, toe, S(l) * self.giro_pie)
        if brazos:
            self.brazos(p, fase)
        return p

    def brazos(self, p, fase):
        w = 2 * math.pi
        D = p.delta('Spine2')
        D3 = D.to_3x3()
        c = math.cos(w * (fase - self.retraso - 0.02))
        for l in 'LR':
            s = -c if l == 'L' else c            # 1 = brazo adelante
            t = (s + 1) / 2
            o = Vector(self.brazo_atras).lerp(Vector(self.brazo_adelante), t)
            o.x *= S(l)
            if self.hombros:
                hombro(p, l, 0.0, self.hombros * s)
            W = desde_hombro(p, l, o)
            pol = D3 @ V(S(l) * self.brazo_polo[0], self.brazo_polo[1], self.brazo_polo[2])
            brazo(p, l, W, pol)
            p.rot_local('Hand.' + l, (1, 0, 0), self.muneca)
            p.dedos(l, self.puno[0], self.puno[1])


CAMINAR = dict(T=32, duty=0.62, y_land=-0.27, y_off=0.33, ancho=0.13, giro_pie=-4.0,
               p_land=-16.0, p_mid=0.0, p_off=32.0, roll=(0.18, 0.55),
               cadera=[(0.04, -0.035), (0.29, -0.008)],
               balanceo=0.022, giro_cadera=6.0, ladeo_cadera=3.0, incl_cadera=2.0, incl=3.0, giro_hombros=7.0,
               cabeza=1.0, vuelo=[(0.3, 0.0, 0.20, 0.17, 28.0, 0.0), (0.58, -0.01, -0.03, 0.17, 2.0, 0.0),
                                  (0.86, 0.0, -0.27, 0.135, -14.0, 0.0)],
               brazo_adelante=(-0.03, -0.13, -0.51), brazo_atras=(0.03, 0.13, -0.51), brazo_polo=(0.3, 0.9, -0.1),
               puno=(22.0, 14.0), muneca=-6.0)

TROTE = dict(T=22, duty=0.33, y_land=-0.30, y_off=0.30, ancho=0.115, giro_pie=-7.0,
             p_land=-9.0, p_mid=0.0, p_off=44.0, roll=(0.2, 0.45),
             cadera=[(0.0, -0.045), (0.16, -0.07), (0.33, -0.04), (0.42, -0.025)],
             balanceo=0.014, giro_cadera=7.0, ladeo_cadera=3.5, incl_cadera=4.0, incl=7.0, giro_hombros=9.0,
             cabeza=1.0, vuelo=[(0.25, 0.0, 0.30, 0.31, 60.0, -5.0), (0.52, -0.005, 0.0, 0.36, 26.0, 0.0),
                                (0.8, 0.0, -0.31, 0.22, -6.0, 0.0)],
             brazo_adelante=(-0.08, -0.19, -0.27), brazo_atras=(0.0, 0.15, -0.40), puno=(50.0, 30.0))

CORRER = dict(T=20, duty=0.26, y_land=-0.38, y_off=0.34, ancho=0.11, giro_pie=-8.0,
              p_land=-5.0, p_mid=0.0, p_off=50.0, roll=(0.18, 0.42),
              cadera=[(0.0, -0.06), (0.12, -0.09), (0.26, -0.055), (0.39, -0.025)],
              balanceo=0.012, giro_cadera=9.0, ladeo_cadera=4.0, incl_cadera=6.0, incl=10.0, giro_hombros=12.0,
              cabeza=2.0, vuelo=[(0.22, 0.0, 0.40, 0.42, 72.0, -5.0), (0.5, -0.005, 0.02, 0.50, 34.0, 0.0),
                                 (0.79, 0.0, -0.41, 0.29, -2.0, 0.0)],
              brazo_adelante=(-0.09, -0.25, -0.24), brazo_atras=(0.01, 0.21, -0.40), puno=(55.0, 35.0),
              hombros=3.0)

SPRINT = dict(T=18, duty=0.24, y_land=-0.40, y_off=0.40, ancho=0.10, giro_pie=-9.0,
              p_land=8.0, p_mid=4.0, p_off=55.0, roll=(0.15, 0.36),
              cadera=[(0.0, -0.07), (0.11, -0.10), (0.24, -0.06), (0.38, -0.028)],
              balanceo=0.01, giro_cadera=10.0, ladeo_cadera=4.0, incl_cadera=10.0, incl=16.0, giro_hombros=14.0,
              cabeza=4.0, vuelo=[(0.22, 0.0, 0.42, 0.55, 78.0, -5.0), (0.5, -0.005, -0.03, 0.58, 38.0, 0.0),
                                 (0.8, 0.0, -0.45, 0.31, 4.0, 0.0)],
              brazo_adelante=(-0.08, -0.31, -0.17), brazo_atras=(0.02, 0.27, -0.36), puno=(45.0, 30.0),
              muneca=-4.0, hombros=5.0)

MARCHAS = {'Caminar': CAMINAR, 'Trote': TROTE, 'Correr': CORRER, 'Sprint': SPRINT}


# ---------------------------------------------------------------------------
# Quieto y apoyos fijos
def piernas_quietas(p, dx=0.0, abre=0.0, adelante_L=-0.035, adelante_R=0.025):
    for l in 'LR':
        s = S(l)
        A0 = base()['A'][l]
        dy = adelante_L if l == 'L' else adelante_R
        Ap = V(s * (0.165 + abre), A0.y + dy, A0.z)
        A = tobillo_plano(l, Ap, 0.0, 0.0)
        pierna(p, l, A, 0.0, 0.0, 0.0, polo=V(s * 0.3, -1, 0))


def brazos_sueltos(p, br=0.0, lados='LR'):
    D = p.delta('Spine2')
    for l in lados:
        s = S(l)
        o = V(s * 0.085, -0.04 - 0.004 * br, -0.528 + 0.004 * br)
        brazo(p, l, desde_hombro(p, l, o), D.to_3x3() @ V(s * 0.45, 0.85, 0.0))
        p.rot_local('Hand.' + l, (1, 0, 0), -8)
        p.dedos(l, 20 + 4 * br, 12, abre=3)


def pose_quieto(f, T=90, brazos=True):
    t = f / T
    w = 2 * math.pi
    br = math.sin(w * t)                 # respiración
    sw = math.sin(w * t + 0.7)           # vaivén del peso
    mira = math.sin(w * t + 2.2)
    p = reposo()
    p.mover_cadera(V(-0.014 + 0.006 * sw, 0.0, -0.02 + 0.003 * br))
    p.orientar('Hips', GIRO(-3 + 0.8 * sw) @ LADEO(-1.8 - 0.6 * sw))
    p.orientar('Spine', GIRO(-1.5) @ LADEO(-0.4 - 0.2 * sw) @ INCL(1.0 - 0.3 * br))
    p.orientar('Spine1', GIRO(0.5) @ LADEO(0.4 + 0.2 * sw) @ INCL(0.6 - 0.8 * br))
    p.orientar('Spine2', GIRO(1.5 + 0.4 * sw) @ LADEO(1.0 + 0.3 * sw) @ INCL(-0.4 - 1.3 * br))
    p.orientar('Neck', GIRO(1.0 + 1.5 * mira) @ INCL(1.5 + 0.6 * br))
    p.orientar('Head', GIRO(1.0 + 3.0 * mira) @ LADEO(-1.0) @ INCL(2.5 + 0.8 * br))
    for l in 'LR':
        hombro(p, l, 0.8 * br)
    piernas_quietas(p)
    if brazos:
        brazos_sueltos(p, br)
    return p


# ---------------------------------------------------------------------------
# Aire
SALTO = Claves({
    0: dict(cad=V(0, 0, 0.0), ic=8.0, inc=10.0, cab=2.0,
            pL=V(0.13, 0.25, 0.20), tL=48.0, pR=V(-0.12, -0.16, 0.44), tR=20.0,
            mL=V(0.06, -0.30, -0.10), mR=V(0.06, 0.12, -0.38)),
    7: dict(cad=V(0, 0, 0.02), ic=4.0, inc=6.0, cab=0.0,
            pL=V(0.13, 0.08, 0.36), tL=35.0, pR=V(-0.12, -0.14, 0.50), tR=22.0,
            mL=V(0.22, -0.18, 0.02), mR=V(0.20, -0.12, -0.02)),
    13: dict(cad=V(0, 0, 0.03), ic=2.0, inc=4.0, cab=0.0,
             pL=V(0.13, -0.02, 0.44), tL=28.0, pR=V(-0.12, -0.10, 0.50), tR=24.0,
             mL=V(0.32, -0.08, -0.06), mR=V(0.32, -0.06, -0.08)),
    19: dict(cad=V(0, 0, 0.01), ic=0.0, inc=2.0, cab=3.0,
             pL=V(0.13, -0.04, 0.24), tL=18.0, pR=V(-0.13, 0.04, 0.20), tR=22.0,
             mL=V(0.30, -0.10, -0.24), mR=V(0.30, -0.08, -0.26)),
    24: dict(cad=V(0, 0, 0.0), ic=2.0, inc=4.0, cab=4.0,
             pL=V(0.14, -0.06, 0.15), tL=10.0, pR=V(-0.14, 0.03, 0.13), tR=14.0,
             mL=V(0.27, -0.12, -0.33), mR=V(0.27, -0.10, -0.34)),
})


def pose_salto(f):
    k = SALTO(f)
    p = reposo()
    p.mover_cadera(Vector(k['cad']))
    p.orientar('Hips', INCL(k['ic']))
    columna(p, 0.0, k['inc'], 0.0, 0.0, (k['cab'], 0.0, 0.0))
    for l in 'LR':
        s = S(l)
        A = Vector(k['p' + l])
        pierna(p, l, A, k['t' + l], 0.0, 0.0, polo=V(s * 0.15, -1, 0.2))
    D = p.delta('Spine2')
    for l in 'LR':
        s = S(l)
        o = Vector(k['m' + l])
        o.x *= s
        brazo(p, l, desde_hombro(p, l, o), D.to_3x3() @ V(s * 0.6, 0.6, -0.4))
        p.rot_local('Hand.' + l, (1, 0, 0), -6)
        p.dedos(l, 12, 8, abre=8)
    return p


def pose_caida(f, T=48):
    # caída libre boca abajo, arqueado, brazos y piernas abiertos, con flameo de viento
    t = f / T
    w = 2 * math.pi
    a = math.sin(w * t * 2)
    b = math.sin(w * t * 3 + 1.3)
    c = math.sin(w * t + 0.4)
    p = reposo()
    p.mover_cadera(V(0, 0, 0.0))
    p.orientar('Hips', GIRO(2 * c) @ LADEO(2.5 * c) @ INCL(72))
    p.orientar('Spine', GIRO(1.5 * c) @ INCL(66))
    p.orientar('Spine1', GIRO(c) @ INCL(58 + 1.0 * a))
    p.orientar('Spine2', INCL(50 + 1.5 * a))
    p.orientar('Neck', INCL(44))
    p.orientar('Head', GIRO(3 * c) @ INCL(28 + 1.5 * b))
    Dh = p.delta('Hips')
    Dh3 = Dh.to_3x3()
    for l in 'LR':
        s = S(l)
        ph = 0.0 if l == 'L' else 1.7
        # pierna: en coordenadas de reposo de la cadera; rodillas dobladas, pies atrás y abiertos
        Ar = V(s * (0.26 + 0.015 * math.sin(w * t * 3 + ph)), 0.30 + 0.03 * math.sin(w * t * 2 + ph), 0.36)
        pierna(p, l, Dh @ Ar, polo=Dh3 @ V(s * 0.35, -1, 0.0), pie=False)
        p.rot('Foot.' + l, Dh3 @ IZQ, 48 + 6 * math.sin(w * t * 2 + ph))
        p.rot('Toe.' + l, Dh3 @ IZQ, 10)
    D = p.delta('Spine2')
    D3 = D.to_3x3()
    for l in 'LR':
        s = S(l)
        ph = 0.0 if l == 'L' else 2.1
        o = V(s * (0.34 + 0.02 * math.sin(w * t * 3 + ph)), -0.10, 0.10 + 0.025 * math.sin(w * t * 2 + ph))
        brazo(p, l, desde_hombro(p, l, o), D3 @ V(s * 0.8, 0.5, -0.6))
        p.rot_local('Hand.' + l, (1, 0, 0), 10)
        p.dedos(l, 8, 4, abre=10)
    return p


GLIDER_Z = 2.09       # altura (espacio del esqueleto) de la barra del planeador


def pose_planear(f, T=60):
    t = f / T
    w = 2 * math.pi
    c = math.sin(w * t)
    d = math.sin(w * t * 2 + 0.6)
    p = reposo()
    p.mover_cadera(V(0.006 * c, 0.0, 0.0))
    p.orientar('Hips', GIRO(2 * c) @ LADEO(1.5 * c) @ INCL(14 + 1.0 * d))
    p.orientar('Spine', GIRO(c) @ INCL(9))
    p.orientar('Spine1', INCL(4))
    p.orientar('Spine2', INCL(0 - 0.5 * d))
    p.orientar('Neck', INCL(4))
    p.orientar('Head', GIRO(4 * c) @ INCL(8))
    for l in 'LR':
        hombro(p, l, 14)
    # manos en la barra (horizontal, a lo ancho), agarre por arriba con las palmas adelante
    for l in 'LR':
        s = S(l)
        G = V(s * 0.21, 0.0, GLIDER_Z)
        R = rot_agarre(l, V(0, -0.15, 1), V(-s, 0, 0))
        poner_mano(p, l, G, R, polo=V(s * 1.0, 0.3, -0.2), reparto=0.6)
        p.dedos(l, 72, 45)
    # piernas colgando, juntas, un poco dobladas y con la punta del pie estirada; péndulo suave
    Dh = p.delta('Hips')
    for l in 'LR':
        s = S(l)
        ph = 0.0 if l == 'L' else 2.6
        sw = math.sin(w * t + ph)
        A = V(s * 0.12, 0.10 + 0.05 * sw, 0.16 + 0.015 * sw)
        pierna(p, l, A, polo=V(s * 0.2, -1, 0.0), pie=False)
        p.rot('Foot.' + l, IZQ, 34 + 4 * sw)
        p.rot('Toe.' + l, IZQ, 6)
    return p


# ---------------------------------------------------------------------------
# Pico. Convención del mango: pasa por el puño (lado del índice = hacia la cabeza del pico) y la punta del pico
# va hacia donde miran los nudillos. alfa es el ángulo del mango en el plano del golpe: 0 = arriba, 90 = adelante.
def mango(alfa, giro=0.0, ladeo=0.0):
    a = math.radians(alfa)
    h = V(0, -math.sin(a), math.cos(a))
    k = V(0, -math.cos(a), -math.sin(a))
    R = GIRO(giro) @ LADEO(ladeo)
    return R @ h, R @ k


def pico_en_mano(p, G, alfa, giro=0.0, ladeo=0.0, polo=V(-0.6, 0.5, -0.6), reparto=0.5):
    h, k = mango(alfa, giro, ladeo)
    D = p.delta('Spine2')
    D3 = D.to_3x3()
    R = rot_agarre('R', D3 @ k, D3 @ h)
    poner_mano(p, 'R', D @ Vector(G), R, D3 @ Vector(polo), reparto=reparto)
    p.dedos('R', 78, 50)


GOLPE = Claves({
    0: dict(G=V(-0.21, -0.20, 1.04), a=32.0, gi=0.0, la=0.0, tg=0.0, ti=2.0, ad=0.0,
            mL=V(0.085, -0.04, -0.528), cab=(2.0, 0.0, 0.0)),
    4: dict(G=V(-0.26, 0.06, 1.66), a=-38.0, gi=10.0, la=-12.0, tg=-22.0, ti=-5.0, ad=0.0,
            mL=V(-0.02, -0.38, -0.20), cab=(0.0, 12.0, 0.0)),
    7: dict(G=V(-0.13, -0.50, 1.22), a=112.0, gi=6.0, la=-6.0, tg=16.0, ti=12.0, ad=0.0,
            mL=V(0.10, 0.12, -0.40), cab=(8.0, 4.0, 0.0)),
    10: dict(G=V(-0.03, -0.42, 0.98), a=148.0, gi=14.0, la=0.0, tg=22.0, ti=16.0, ad=0.0,
             mL=V(0.12, 0.16, -0.42), cab=(8.0, 6.0, 0.0)),
    15: dict(G=V(-0.21, -0.20, 1.04), a=32.0, gi=0.0, la=0.0, tg=0.0, ti=2.0, ad=0.0,
             mL=V(0.085, -0.04, -0.528), cab=(2.0, 0.0, 0.0)),
})


def pose_golpe(f):
    k = GOLPE(f)
    p = reposo()
    p.mover_cadera(V(-0.01, 0.0, -0.03))
    p.orientar('Hips', GIRO(k['tg'] * 0.3))
    ci, cg, cl = k['cab']
    columna(p, k['tg'], k['ti'], 0.0, 0.0, (ci, cg, cl))
    piernas_quietas(p, abre=0.03, adelante_L=-0.08, adelante_R=0.06)
    pico_en_mano(p, k['G'], k['a'], k['gi'], k['la'])
    D = p.delta('Spine2')
    o = Vector(k['mL'])
    brazo(p, 'L', desde_hombro(p, 'L', o), D.to_3x3() @ V(0.5, 0.6, -0.4))
    p.dedos('L', 40, 25)
    return p


def pose_sostener_pico(f, T=90):
    t = f / T
    br = math.sin(2 * math.pi * t)
    p = pose_quieto(f, T, brazos=False)
    brazos_sueltos(p, br, 'L')
    pico_en_mano(p, V(-0.21, -0.20 - 0.004 * br, 1.04 + 0.004 * br), 32.0)
    return p


# ---------------------------------------------------------------------------
# Armas. Convención (igual que el hueso Arma.R): origen en el centro del puño derecho, 'd' es hacia donde apunta
# el cañón y 'u' hacia arriba del arma. El guardamanos (apoyo de la mano izquierda) está a APOYO adelante.
APOYO = 0.30


def arma_en_manos(p, G, d, u, tipo='largo', polo_R=V(-0.8, 0.4, -0.6), polo_L=V(0.3, 0.0, -1.0), gatillo=30.0):
    D = p.delta('Spine2')
    D3 = D.to_3x3()
    G = D @ Vector(G)
    d = (D3 @ Vector(d)).normalized()
    u = D3 @ Vector(u)
    u = (u - d * u.dot(d)).normalized()
    r = d.cross(u)                     # derecha del arma
    poner_mano(p, 'R', G, rot_agarre('R', d, u), D3 @ Vector(polo_R))
    p.dedos('R', 68, 28, indice=gatillo)
    if tipo == 'largo':
        # izquierda abajo del guardamanos: palma arriba, dedos que rodean hacia la derecha del arma
        P = G + d * APOYO + u * 0.035
        R = rot_mano(r * 0.8 + d * 0.55, -u)
        poner_mano(p, 'L', P, R, D3 @ Vector(polo_L), off=OFF_PALMA)
        p.dedos('L', 42, 18, abre=4)
    elif tipo == 'pistola':
        # izquierda envolviendo a la derecha
        P = G - r * 0.045 - u * 0.02 + d * 0.005
        R = rot_mano(d * 0.5 - u * 0.85, -r)
        poner_mano(p, 'L', P, R, D3 @ Vector(polo_L), off=OFF_PALMA)
        p.dedos('L', 58, 12)
    elif tipo == 'vertical':
        # izquierda en una empuñadura vertical delantera
        P = G + d * (APOYO + 0.02)
        poner_mano(p, 'L', P, rot_agarre('L', d, u), D3 @ Vector(polo_L))
        p.dedos('L', 70, 35)
    return G, d, u


ARMAS = {
    # nombre: (G, d, u, tipo, polo_R, polo_L, cabeza (incl, giro, ladeo), columna (giro, incl), hombro_R)
    'Rifle': (V(-0.14, -0.27, 1.17), V(0.05, -1, -0.17), V(0, 0, 1), 'largo', V(-0.8, 0.4, -0.6), V(0.3, 0.0, -1.0),
              (3.0, 0.0, 0.0), (-4.0, 3.0), 0.0),
    'RifleApunta': (V(-0.10, -0.34, 1.42), V(0.03, -1, 0.07), V(0, 0, 1), 'largo', V(-1.0, 0.2, -0.15), V(0.2, 0.1, -1.0),
                    (11.0, -3.0, 9.0), (-3.0, 4.0), 7.0),
    'Pistola': (V(-0.06, -0.30, 1.13), V(0.03, -1, -0.25), V(0, 0, 1), 'pistola', V(-0.6, 0.3, -1.0), V(0.6, 0.3, -1.0),
                (4.0, 0.0, 0.0), (0.0, 3.0), 0.0),
    'PistolaApunta': (V(-0.05, -0.47, 1.46), V(0.06, -1, 0.04), V(0, 0, 1), 'pistola', V(-0.6, 0.2, -1.0),
                      V(0.6, 0.2, -1.0), (5.0, 0.0, 2.0), (0.0, 4.0), 3.0),
    'Lanzacohetes': (V(-0.15, -0.20, 1.40), V(0.02, -1, 0.03), V(0, 0, 1), 'vertical', V(-0.9, 0.3, -0.5),
                     V(0.4, 0.1, -1.0), (7.0, -2.0, 6.0), (-3.0, 3.0), 5.0),
    'Objeto': (V(-0.12, -0.26, 1.13), V(0.15, -1, 0.2), V(0, 0.2, 1), 'ninguno', V(-0.6, 0.4, -1.0), V(0.4, 0.4, -1.0),
               (8.0, 0.0, 0.0), (0.0, 2.0), 0.0),
}


def pose_arma(nombre, f, T=90):
    G, d, u, tipo, pR, pL, cab, col, hR = ARMAS[nombre]
    t = f / T
    w = 2 * math.pi
    br = math.sin(w * t)
    sw = math.sin(w * t + 0.7)
    p = reposo()
    p.mover_cadera(V(-0.012 + 0.005 * sw, 0.0, -0.03 + 0.003 * br))
    p.orientar('Hips', GIRO(-2 + 0.6 * sw) @ LADEO(-1.2 - 0.4 * sw))
    giro, incl = col
    columna(p, giro, incl - 0.8 * br, 0.4 * sw, 0.0, (cab[0] + 0.5 * br, cab[1], cab[2]))
    if hR:
        hombro(p, 'R', hR, 2.0)
        hombro(p, 'L', 0.0, 3.0)
    piernas_quietas(p, abre=0.02, adelante_L=-0.06, adelante_R=0.05)
    Gb = Vector(G) + V(0.0, -0.003 * br, 0.004 * br)
    arma_en_manos(p, Gb, d, u, tipo, pR, pL)
    if tipo == 'ninguno':
        p.dedos('R', 50, 30)
        brazos_sueltos(p, br, 'L')
    return p


# ---------------------------------------------------------------------------
# Baile (original): paso al costado y cierre, rebote en cada tiempo, brazos que reman, empujan y suben.
# 120 bpm: un tiempo = 15 cuadros; el clip son 4 tiempos y vuelve al lugar.
BAILE = Claves({
    0: dict(cx=0.0, pL=V(0.10, 0, 0), pR=V(-0.10, 0, 0), gi=0.0,
            mL=V(-0.04, -0.22, -0.16), mR=V(-0.04, -0.22, -0.16), dL=(62, 40, 62), dR=(62, 40, 62)),
    7: dict(cx=-0.06, pR=V(-0.22, 0, 0.09), gi=-12.0,
            mR=V(0.40, -0.12, 0.24), mL=V(-0.07, -0.21, -0.13), dR=(62, 30, 0), dL=(62, 40, 62)),
    15: dict(cx=-0.10, pR=V(-0.32, 0, 0), gi=-4.0,
             mL=V(0.08, 0.06, -0.29), mR=V(0.08, 0.06, -0.29), dL=(68, 45, 68), dR=(68, 45, 68)),
    22: dict(cx=-0.16, pL=V(-0.02, 0, 0.08), gi=0.0,
             mL=V(-0.02, -0.43, -0.13), mR=V(-0.02, -0.43, -0.13), dL=(6, 6, 6), dR=(6, 6, 6)),
    30: dict(cx=-0.20, pL=V(-0.10, 0, 0), gi=0.0,
             mL=V(-0.04, -0.22, -0.16), mR=V(-0.04, -0.22, -0.16), dL=(62, 40, 62), dR=(62, 40, 62)),
    37: dict(cx=-0.14, pL=V(0.0, 0, 0.09), gi=12.0,
             mL=V(0.40, -0.12, 0.24), mR=V(-0.07, -0.21, -0.13), dL=(62, 30, 0), dR=(62, 40, 62)),
    45: dict(cx=-0.10, pL=V(0.10, 0, 0), gi=4.0,
             mL=V(0.08, 0.06, -0.29), mR=V(0.08, 0.06, -0.29), dL=(68, 45, 68), dR=(68, 45, 68)),
    52: dict(cx=-0.04, pR=V(-0.20, 0, 0.08), gi=0.0,
             mL=V(0.13, -0.06, 0.40), mR=V(0.13, -0.06, 0.40), dL=(4, 4, 4), dR=(4, 4, 4)),
}, periodo=60)


def pose_baile(f, T=60):
    k = BAILE(f)
    w = 2 * math.pi
    beat = f / 15.0
    rebote = 0.5 + 0.5 * math.cos(w * beat)          # 1 en cada tiempo
    p = reposo()
    p.mover_cadera(V(k['cx'], 0.0, -0.035 - 0.04 * rebote))
    gi = k['gi']
    p.orientar('Hips', GIRO(gi * 0.4) @ LADEO(-k['cx'] * 30) @ INCL(4 * rebote))
    columna(p, gi, 6 * rebote - 2, k['cx'] * 20, 0.0, (10 * rebote - 2, gi * 0.4, -k['cx'] * 15))
    for l in 'LR':
        hombro(p, l, 4 * (1 - rebote))
    for l in 'LR':
        s = S(l)
        A0 = base()['A'][l]
        q = Vector(k['p' + l])
        lift = max(0.0, q.z)
        Ap = V(q.x + s * 0.0, A0.y + q.y, A0.z + lift)
        pitch = 30 * clamp(lift / 0.06)
        A = Ap
        pierna(p, l, A, pitch, -pitch * 0.6, 0.0, polo=V(s * 0.4, -1, 0))
    D = p.delta('Spine2')
    D3 = D.to_3x3()
    for l in 'LR':
        s = S(l)
        o = Vector(k['m' + l])
        o.x *= s
        brazo(p, l, desde_hombro(p, l, o), D3 @ V(s * 1.0, 0.3, -0.6))
        c, pu, ix = k['d' + l]
        p.dedos(l, c, pu, indice=ix)
    return p


# ---------------------------------------------------------------------------
# Grabado
CLIPS = {
    'Quieto': (90, True, pose_quieto),
    'Salto': (24, False, pose_salto),
    'Caida': (48, True, pose_caida),
    'Planear': (60, True, pose_planear),
    'Golpe': (15, False, pose_golpe),
    'SostenerPico': (90, True, pose_sostener_pico),
    'Baile': (60, True, pose_baile),
}
for _n in ARMAS:
    CLIPS[_n] = (90, True, (lambda n: (lambda f: pose_arma(n, f)))(_n))


def hacer(nombre, paso=None):
    DIAG.clear()
    if nombre in MARCHAS:
        g = Marcha(nombre, **MARCHAS[nombre])
        poses = [(f, g.pose(f / g.T)) for f in range(g.T + 1)]
        act = grabar(nombre, poses, loop=True)
        act['velocidad'] = round(g.v, 3)
        return {'v': round(g.v, 3), 'diag': {k: round(v, 3) for k, v in DIAG.items()}}
    T, loop, fn = CLIPS[nombre]
    paso = paso or (3 if T >= 60 else 1)
    fr = list(range(0, T + 1, paso))
    if fr[-1] != T:
        fr.append(T)
    poses = [(f, fn(f)) for f in fr]
    grabar(nombre, poses, loop=loop)
    return {'diag': {k: round(v, 3) for k, v in DIAG.items()}}


def todos():
    out = {}
    for n in list(MARCHAS) + list(CLIPS):
        out[n] = hacer(n)
    return out


def ver(nombre, frames, vista=(math.radians(80), 0, math.radians(30)), centro=(0, 0, 0.95), escala=2.3,
        res=(300, 380), engine='BLENDER_EEVEE'):
    # deja la acción puesta y renderiza esos cuadros (b64 por cuadro)
    arm = bpy.data.objects[ARM]
    act = bpy.data.actions[nombre]
    arm.animation_data_create()
    arm.animation_data.action = act
    try:
        if act.slots and arm.animation_data.action_slot is None:
            arm.animation_data.action_slot = act.slots[0]
    except AttributeError:
        pass
    sc = bpy.context.scene
    out = {}
    for i, fr in enumerate(frames):
        sc.frame_set(fr)
        out['b64%02d' % i] = SF.render_view(centro, escala, rot=vista, res=res, engine=engine,
                                             path=SF.OUT + r'\_anim.jpg')
    out['pad'] = 'x' * 150000
    return out
