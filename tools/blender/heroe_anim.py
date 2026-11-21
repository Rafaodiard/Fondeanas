# Animaciones del héroe hechas por código: poses en espacio del personaje (X izquierda, -Y adelante, Z arriba),
# IK analítica de dos huesos para piernas y brazos, y curvas guardadas como acciones (una por clip).
# Requiere el armature 'Esqueleto'.
import bpy, math
from mathutils import Vector, Matrix, Quaternion

ARM = 'Esqueleto'
FPS = 30
ADELANTE = Vector((0, -1, 0))
ARRIBA = Vector((0, 0, 1))
IZQ = Vector((1, 0, 0))


def rad(d):
    return math.radians(d)


def q_eje(axis, ang_deg):
    return Quaternion(Vector(axis).normalized(), rad(ang_deg))


class Pose:
    # Estado FK: base (rotación local) por hueso y desplazamiento de la cadera; todo se recalcula en espacio armature.
    def __init__(self, arm):
        self.arm = arm
        self.bones = arm.data.bones
        self.orden = []
        def rec(b):
            self.orden.append(b.name)
            for c in b.children:
                rec(c)
        for b in self.bones:
            if b.parent is None:
                rec(b)
        self.base = {n: Quaternion() for n in self.orden}
        self.loc = Vector()          # traslación de la cadera (espacio del personaje)
        self.locs = {}               # traslación propia de otros huesos (p. ej. Arma.R cuando la mano suelta el arma)
        self.rest_rel = {}
        for n in self.orden:
            b = self.bones[n]
            self.rest_rel[n] = (b.parent.matrix_local.inverted() @ b.matrix_local) if b.parent else b.matrix_local.copy()
        self.M = {}
        self.fk()

    def fk(self):
        for n in self.orden:
            b = self.bones[n]
            basis = self.base[n].to_matrix().to_4x4()
            if n in self.locs:
                basis = Matrix.Translation(self.locs[n]) @ basis
            if b.parent is None:
                m = Matrix.Translation(self.loc) @ self.rest_rel[n] @ basis
            else:
                m = self.M[b.parent.name] @ self.rest_rel[n] @ basis
            self.M[n] = m
        return self

    def head(self, n):
        return self.M[n].to_translation()

    def tail(self, n):
        return self.M[n] @ Vector((0, self.bones[n].length, 0))

    def dir(self, n):
        return (self.M[n].to_3x3() @ Vector((0, 1, 0))).normalized()

    def _set_world_rot(self, n, R3):
        b = self.bones[n]
        if b.parent is None:
            P = self.rest_rel[n].to_3x3()
        else:
            P = (self.M[b.parent.name] @ self.rest_rel[n]).to_3x3()
        self.base[n] = (P.inverted() @ R3).to_quaternion().normalized()

    # --- operaciones de pose
    def rot(self, n, axis, ang_deg):
        # gira el hueso (y lo que cuelga de él) alrededor de un eje del personaje
        R = q_eje(axis, ang_deg).to_matrix()
        self._set_world_rot(n, R @ self.M[n].to_3x3())
        self.fk()
        return self

    def rot_local(self, n, axis, ang_deg):
        # gira alrededor de un eje propio del hueso (X: bisagra, Y: torsión a lo largo, Z)
        self.base[n] = self.base[n] @ q_eje(axis, ang_deg)
        self.fk()
        return self

    def aim(self, n, d, twist=0.0):
        d = Vector(d).normalized()
        cur = self.M[n].to_3x3()
        y = cur @ Vector((0, 1, 0))
        q = y.rotation_difference(d)
        R = q.to_matrix() @ cur
        if twist:
            R = q_eje(d, twist).to_matrix() @ R
        self._set_world_rot(n, R)
        self.fk()
        return self

    def mover_cadera(self, v):
        self.loc = Vector(v)
        self.fk()
        return self

    def frame(self, n, y_new, ref_rest, ref_new):
        # orienta el hueso para que su eje Y quede en y_new y el vector de referencia (en reposo) pase a ref_new
        b = self.bones[n]
        R0 = self.rest_world(n)
        y0 = (R0 @ Vector((0, 1, 0))).normalized()
        r0 = (ref_rest - y0 * ref_rest.dot(y0)).normalized()
        a0 = Matrix((y0, r0, y0.cross(r0).normalized())).transposed()
        yn = Vector(y_new).normalized()
        rn = (ref_new - yn * ref_new.dot(yn)).normalized()
        a1 = Matrix((yn, rn, yn.cross(rn).normalized())).transposed()
        R = a1 @ a0.inverted() @ R0
        self._set_world_rot(n, R)
        self.fk()

    def rest_world(self, n):
        return self.bones[n].matrix_local.to_3x3()

    def ik(self, a, b, objetivo, polo):
        # IK de dos huesos (a: muslo/brazo, b: pierna/antebrazo) hacia 'objetivo' con la rodilla/codo hacia 'polo'
        H = self.head(a)
        L1 = self.bones[a].length
        L2 = self.bones[b].length
        T = Vector(objetivo)
        D = T - H
        d = min(max(D.length, 1e-4), (L1 + L2) * 0.9995)
        Dn = D.normalized()
        pol = Vector(polo).normalized()
        n = Dn.cross(pol)
        if n.length < 1e-5:
            n = Dn.cross(Vector((1, 0, 0)))
        n.normalize()
        perp = n.cross(Dn).normalized()      # en el plano, hacia el polo
        ca = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)
        ang = math.acos(max(-1, min(1, ca)))
        thigh = (Dn * math.cos(ang) + perp * math.sin(ang)).normalized()
        K = H + thigh * L1
        shin = (H + Dn * d - K).normalized()
        # referencia de reposo: el plano de la extremidad en reposo con el mismo polo
        ra = self.rest_world(a) @ Vector((0, 1, 0))
        n0 = ra.cross(pol)
        if n0.length < 1e-5:
            n0 = ra.cross(Vector((1, 0, 0)))
        self.frame(a, thigh, n0.normalized(), n)
        self.frame(b, shin, n0.normalized(), n)
        return self

    def pie(self, lado, pitch=0.0, toe=0.0, yaw=0.0):
        # pie en el piso (pitch=0) con la punta levantada/bajada; toe dobla los dedos
        f = 'Foot.' + lado
        R0 = self.rest_world(f)
        y0 = (R0 @ Vector((0, 1, 0))).normalized()
        R = q_eje(IZQ, pitch).to_matrix() @ q_eje(ARRIBA, yaw).to_matrix() @ R0
        self._set_world_rot(f, R)
        self.fk()
        t = 'Toe.' + lado
        Rt = q_eje(IZQ, pitch + toe).to_matrix() @ q_eje(ARRIBA, yaw).to_matrix() @ self.rest_world(t)
        self._set_world_rot(t, Rt)
        self.fk()
        return self

    def dedos(self, lado, curl=0.0, pulgar=0.0, abre=0.0, indice=None, menique=None):
        # cierra los dedos (grados por falange, positivo hacia la palma) y el pulgar; abre los separa en abanico.
        # En este esqueleto la palma es el -Z local de la mano y de los dedos, así que cerrar es girar en -X.
        s = 1.0 if lado == 'R' else -1.0       # el lado del índice es -X en la derecha y +X en la izquierda
        abanico = {'Index': 1.0, 'Middle': 0.35, 'Ring': -0.35, 'Pinky': -1.0}
        for f in ('Index', 'Middle', 'Ring', 'Pinky'):
            c = curl
            if f == 'Index' and indice is not None:
                c = indice
            if f == 'Pinky' and menique is not None:
                c = menique
            for i in (1, 2, 3):
                n = '%s%d.%s' % (f, i, lado)
                if n not in self.base:
                    continue
                q = q_eje((1, 0, 0), -c * (0.8 if i == 1 else 1.0))
                if i == 1 and abre:
                    q = q_eje((0, 0, 1), s * abre * abanico[f]) @ q
                self.base[n] = q
        for i in (1, 2, 3):
            n = 'Thumb%d.%s' % (i, lado)
            if n in self.base:
                self.base[n] = q_eje((1, 0, 0), -pulgar * (0.5 if i == 1 else 1.0))
        self.fk()
        return self

    def orientar(self, n, delta):
        # orientación absoluta: la del reposo girada por 'delta' (matriz 3x3 en espacio del personaje)
        self._set_world_rot(n, delta @ self.rest_world(n))
        self.fk()
        return self

    def delta(self, n):
        # cuánto giró el hueso respecto de su reposo (matriz 4x4 que lleva puntos del reposo a la pose)
        return self.M[n] @ self.bones[n].matrix_local.inverted()


# ---------------------------------------------------------------------------
def reposo():
    return Pose(bpy.data.objects[ARM])


def aplicar(p):
    # vuelca la pose al armature (sin keyframes), para mirar
    arm = p.arm
    for n in p.orden:
        pb = arm.pose.bones[n]
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = p.base[n]
        pb.location = (0, 0, 0)
    hb = arm.pose.bones[p.orden[0]]
    # la traslación de la raíz va en el espacio local del hueso
    hb.location = p.bones[p.orden[0]].matrix_local.to_3x3().inverted() @ p.loc
    bpy.context.view_layer.update()


def grabar(nombre, poses, loop=True, huesos=None):
    # poses: lista de (frame, Pose). Crea una acción nueva con curvas por hueso (cuaterniones continuos).
    arm = bpy.data.objects[ARM]
    act = bpy.data.actions.get(nombre)
    if act:
        bpy.data.actions.remove(act)
    act = bpy.data.actions.new(nombre)
    act.use_fake_user = True
    arm.animation_data_create()
    arm.animation_data.action = act
    prev = {}
    for fr, p in poses:
        for n in p.orden:
            if huesos and n not in huesos:
                continue
            pb = arm.pose.bones[n]
            pb.rotation_mode = 'QUATERNION'
            q = p.base[n].copy()
            if n in prev and prev[n].dot(q) < 0:
                q.negate()
            prev[n] = q
            pb.rotation_quaternion = q
            pb.keyframe_insert('rotation_quaternion', frame=fr, group=n)
            if n in p.locs:
                pb.location = p.locs[n]
                pb.keyframe_insert('location', frame=fr, group=n)
        root = p.orden[0]
        pb = arm.pose.bones[root]
        pb.location = p.bones[root].matrix_local.to_3x3().inverted() @ p.loc
        pb.keyframe_insert('location', frame=fr, group=root)
    for fc in _fcurves(act):
        for k in fc.keyframe_points:
            k.interpolation = 'BEZIER'
            k.handle_left_type = k.handle_right_type = 'AUTO_CLAMPED'
        if loop:
            m = fc.modifiers.new('CYCLES')
    act.frame_range = (poses[0][0], poses[-1][0])
    return act


def _fcurves(act):
    try:
        return list(act.fcurves)
    except AttributeError:
        out = []
        for layer in act.layers:
            for strip in layer.strips:
                for cb in strip.channelbags:
                    out.extend(cb.fcurves)
        return out
