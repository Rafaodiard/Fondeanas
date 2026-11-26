# Clips del héroe para caer, el paracaídas, aterrizar y deslizarse (animaciones_caida.glb).
# Requiere heroe_anim.py y heroe_clips.py ejecutados antes en el mismo espacio de nombres (Pose, reposo, grabar,
# columna, pierna, brazo, poner_mano, rot_agarre...). El esqueleto se puede traer del juego con heroe_importar.py.
#
# Clips (24 cuadros por segundo, como el resto):
#   CaidaPlaneo     caída libre estirado, brazos atrás en flecha: cae lento y avanza lejos
#   CaidaPicada     de cabeza, brazos pegados al cuerpo y piernas juntas: cae rápido y casi no avanza
#   Abrir           tira de la manija, el cuerpo pasa de horizontal a colgado y agarra los frenos (una vez)
#   Paracaidas      colgado del arnés con las manos en los frenos
#   ParacaidasIzq / ParacaidasDer   tira del freno de ese lado, el cuerpo se inclina y las piernas se van afuera
#   ParacaidasFreno los dos frenos abajo y las piernas adelante (frena y cae más despacio)
#   Aterrizaje      apoya los pies, amortigua con las rodillas y se para (una vez)
#   Deslizar        deslizándose por el piso: una pierna estirada adelante, la otra doblada abajo
# 'Caida' (boca abajo, arqueado) sigue en heroe_clips.py: el juego mezcla Planeo / Caida / Picada según cómo cae.
import bpy, math, os
from mathutils import Vector, Quaternion

TOGGLE_Z = 1.80        # altura de las manos en los frenos


def arnes():
    # dónde se cuelga el paracaídas (espacio del esqueleto): entre los hombros del clip Paracaidas, un poco más arriba
    # y atrás (sobre los hombros). En el juego: ARNES de rig.js = (x, z + 0.032, -y) de esto.
    p = pose_paracaidas(0)
    m = (p.head('UpperArm.L') + p.head('UpperArm.R')) / 2
    return Vector((0.0, m.y + 0.03, m.z + 0.06))


def mezcla(a, b, t):
    # pose intermedia: cada hueso gira de a hacia b (en su espacio local) y la cadera se mueve en línea recta
    p = reposo()
    t = clamp(t)
    for n in p.orden:
        qa, qb = a.base[n], b.base[n]
        if qa.dot(qb) < 0:
            qb = -qb
        p.base[n] = qa.slerp(qb, t)
    p.loc = a.loc.lerp(b.loc, t)
    for n in set(a.locs) | set(b.locs):
        p.locs[n] = a.locs.get(n, Vector()).lerp(b.locs.get(n, Vector()), t)
    return p.fk()


def piernas_caida(p, ankle, polo, pie, ph_amp=0.0, t=0.0, toe=10.0):
    # tobillos en coordenadas de reposo de la cadera (giran con ella)
    Dh = p.delta('Hips')
    Dh3 = Dh.to_3x3()
    w = 2 * math.pi
    for l in 'LR':
        s = S(l)
        ph = 0.0 if l == 'L' else 1.9
        A = Vector(ankle)
        A.x *= s
        A += V(0, 0.02, 0.02) * ph_amp * math.sin(w * t * 3 + ph)
        pol = Vector(polo)
        pol.x *= s
        pierna(p, l, Dh @ A, polo=Dh3 @ pol, pie=False)
        p.rot('Foot.' + l, Dh3 @ IZQ, pie + 5 * ph_amp * math.sin(w * t * 2 + ph))
        p.rot('Toe.' + l, Dh3 @ IZQ, toe)


def brazos_caida(p, o, polo, mano_rot=8.0, curl=6.0, amp=0.0, t=0.0, lados='LR'):
    # mano a 'o' del hombro, en coordenadas de reposo del pecho (gira con Spine2)
    D3 = p.delta('Spine2').to_3x3()
    w = 2 * math.pi
    for l in lados:
        s = S(l)
        ph = 0.0 if l == 'L' else 2.1
        q = Vector(o)
        q.x *= s
        q += V(s * 0.015, 0.0, 0.02) * amp * math.sin(w * t * 3 + ph)
        pol = Vector(polo)
        pol.x *= s
        brazo(p, l, desde_hombro(p, l, q), D3 @ pol)
        p.rot_local('Hand.' + l, (1, 0, 0), mano_rot)
        p.dedos(l, curl, 4, abre=6)


# ---------------------------------------------------------------------------
# Caída libre
def pose_caida_planeo(f, T=48):
    # en flecha: el cuerpo casi plano, piernas estiradas y brazos atrás. Mirada al horizonte.
    t = f / T
    w = 2 * math.pi
    a = math.sin(w * t * 2)
    b = math.sin(w * t * 3 + 1.3)
    c = math.sin(w * t + 0.4)
    p = reposo()
    p.orientar('Hips', GIRO(1.5 * c) @ LADEO(2.0 * c) @ INCL(84))
    p.orientar('Spine', GIRO(1.0 * c) @ INCL(80))
    p.orientar('Spine1', INCL(76 + 0.8 * a))
    p.orientar('Spine2', INCL(72 + 1.2 * a))
    p.orientar('Neck', INCL(52))
    p.orientar('Head', GIRO(2.5 * c) @ INCL(34 + 1.2 * b))
    for l in 'LR':
        hombro(p, l, -4, 6)
    piernas_caida(p, V(0.125, 0.09, 0.15), V(0.2, -1, 0.0), 58, ph_amp=0.6, t=t, toe=14)
    brazos_caida(p, V(0.20, 0.10, -0.43), V(0.4, 0.7, 0.3), mano_rot=-4, curl=4, amp=0.6, t=t)
    return p


def pose_caida_picada(f, T=24):
    # de cabeza hacia abajo y adelante, todo pegado al cuerpo; tiembla un poco por la velocidad
    t = f / T
    w = 2 * math.pi
    a = math.sin(w * t * 2)
    c = math.sin(w * t + 0.4)
    e = math.sin(w * t * 4 + 0.9)
    p = reposo()
    p.orientar('Hips', GIRO(1.2 * c) @ LADEO(0.8 * e) @ INCL(128))
    p.orientar('Spine', INCL(127))
    p.orientar('Spine1', INCL(125 + 0.5 * a))
    p.orientar('Spine2', INCL(123 + 0.8 * a))
    p.orientar('Neck', INCL(104))
    p.orientar('Head', GIRO(1.5 * c) @ INCL(92 + 0.8 * e))
    for l in 'LR':
        hombro(p, l, -6, -4)
    piernas_caida(p, V(0.085, 0.07, 0.12), V(0.15, -1, 0.0), 64, ph_amp=0.35, t=t * 2, toe=18)
    brazos_caida(p, V(0.085, 0.12, -0.47), V(0.25, 1.0, 0.1), mano_rot=-6, curl=4, amp=0.3, t=t * 2)
    return p


# ---------------------------------------------------------------------------
# Paracaídas
def manos_frenos(p, GL, GR, polo_y=0.25):
    # manos cerradas sobre las manijas de los frenos: nudillos adelante, pulgar arriba (la cuerda sale por arriba)
    for l, G in (('L', GL), ('R', GR)):
        s = S(l)
        alto = clamp((G.z - 1.2) / 0.6)
        R = rot_agarre(l, V(0, -1, 0.35 + 0.5 * alto), V(-s * 0.25, 0, -1))
        poner_mano(p, l, G, R, polo=V(s * 0.7, polo_y - 0.35, -1.0 + 0.3 * (1 - alto)), reparto=0.6)
        p.dedos(l, 78, 52)


def pose_paracaidas(f, T=72, freno=(0.0, 0.0), piernas_adelante=0.0, giro=0.0):
    # freno: cuánto baja cada mano (0 arriba, 1 a la cadera). giro: -1 izquierda, +1 derecha.
    t = f / T
    w = 2 * math.pi
    c = math.sin(w * t)
    d = math.sin(w * t * 2 + 0.6)
    fl, fr = freno
    fb = min(fl, fr)                      # frenar con las dos
    p = reposo()
    p.mover_cadera(V(0.005 * c - 0.03 * giro, 0.0, 0.0))
    p.orientar('Hips', GIRO(2 * c - 4 * giro) @ LADEO(1.5 * c + 7 * giro) @ INCL(-6 - 8 * fb + 1.0 * d))
    p.orientar('Spine', GIRO(c) @ LADEO(4 * giro) @ INCL(-3 - 4 * fb))
    p.orientar('Spine1', LADEO(2 * giro) @ INCL(0 + 2 * fb))
    p.orientar('Spine2', INCL(3 + 6 * fb - 0.5 * d))
    p.orientar('Neck', GIRO(-6 * giro) @ INCL(6))
    p.orientar('Head', GIRO(5 * c - 14 * giro) @ LADEO(-3 * giro) @ INCL(10 + 4 * fb))
    for l in 'LR':
        hombro(p, l, 16 * (1 - (fl if l == 'L' else fr)) + 4)
    # manos: arriba al lado de la cabeza; bajan hacia el pecho y la cadera al tirar del freno
    G = {}
    for l, k in (('L', fl), ('R', fr)):
        s = S(l)
        arriba = V(s * 0.25, -0.17, TOGGLE_Z + 0.01 * d)
        pecho = V(s * 0.27, -0.20, 1.24)
        cadera = V(s * 0.27, -0.12, 1.02)
        G[l] = arriba.lerp(pecho, ss(0, 0.6, k)).lerp(cadera, ss(0.6, 1.0, k)) if k < 1 else cadera
        if giro and ((giro > 0) == (l == 'L')):
            G[l] = G[l] + V(0, 0.02, 0.05 * abs(giro))      # la otra mano sube un poco
    manos_frenos(p, G['L'], G['R'])
    # piernas colgando del arnés, un poco sentado; péndulo suave y se abren hacia afuera de la curva
    for l in 'LR':
        s = S(l)
        ph = 0.0 if l == 'L' else 2.6
        sw = math.sin(w * t + ph)
        A = V(s * 0.14 - 0.10 * giro, -0.18 - 0.20 * piernas_adelante - 0.04 * sw, 0.18 + 0.12 * piernas_adelante + 0.012 * sw)
        pierna(p, l, A, polo=V(s * 0.25, -1, 0.15), pie=False)
        p.rot('Foot.' + l, IZQ, 28 + 4 * sw - 12 * piernas_adelante)
        p.rot('Toe.' + l, IZQ, 6)
    return p


def pose_paracaidas_izq(f, T=72):
    return pose_paracaidas(f, T, freno=(0.62, 0.0), giro=-1.0)


def pose_paracaidas_der(f, T=72):
    return pose_paracaidas(f, T, freno=(0.0, 0.62), giro=1.0)


def pose_paracaidas_freno(f, T=72):
    return pose_paracaidas(f, T, freno=(1.0, 1.0), piernas_adelante=1.0)


ABRIR_T = 18


def pose_abrir(f):
    # 0-5: la mano derecha va a la manija (cadera derecha, atrás); 5-8: tira y la saca hacia arriba;
    # 5-15: el tirón de apertura endereza el cuerpo y las piernas pasan de largo adelante; 15-18: se acomoda colgado.
    caida = pose_caida(0)
    R = 'R'
    if f <= 8:
        # sobre la caída: solo el brazo derecho
        D3 = caida.delta('Spine2').to_3x3()
        manija = V(-0.13, 0.10, -0.42)
        arriba = V(-0.34, 0.02, 0.14)
        o = manija * ss(0, 5, f) + V(-0.34, -0.10, 0.10) * (1 - ss(0, 5, f))
        if f > 5:
            o = manija.lerp(arriba, ss(5, 8, f))
        brazo(caida, R, desde_hombro(caida, R, o), D3 @ V(-0.6, 0.6, -0.4))
        caida.dedos(R, 60 if 3 < f < 7 else 10, 40)
    colgado = pose_paracaidas(0, piernas_adelante=0.9 * math.sin(math.pi * clamp((f - 9) / 9)))
    k = ss(5, 15, f)
    return mezcla(caida, colgado, k)


ATERRIZA_T = 16


def pose_aterrizaje(f):
    # los pies tocan con las rodillas un poco dobladas, la cadera baja hasta el cuadro 4 y vuelve; los brazos
    # bajan de los frenos hacia adelante y terminan sueltos. Al final queda igual que Quieto.
    bajar = ss(0, 4, f) * (1 - ss(4, 13, f))
    p = reposo()
    p.mover_cadera(V(0, 0.02 * bajar, -0.04 - 0.20 * bajar))
    p.orientar('Hips', INCL(6 + 16 * bajar))
    columna(p, 0.0, 4 + 10 * bajar, 0.0, 0.0, (-6 * bajar, 0.0, 0.0))
    piernas_quietas(p, abre=0.04 * bajar, adelante_L=-0.06, adelante_R=0.05)
    D3 = p.delta('Spine2').to_3x3()
    sube = 1 - ss(0, 6, f)
    for l in 'LR':
        s = S(l)
        afuera, adelante = SUELTOS[l]
        suelto = V(s * afuera, adelante, SUELTOS_ABAJO)
        equilibrio = V(s * 0.24, -0.30, -0.22)
        o = suelto.lerp(equilibrio, ss(0, 4, f) * (1 - ss(6, 14, f)))
        o = o.lerp(V(s * 0.10, -0.10, 0.34), sube)
        brazo(p, l, desde_hombro(p, l, o), D3 @ V(s * 0.6, 0.6, -0.4))
        p.dedos(l, 20 + 40 * sube, 12)
    fin = pose_quieto(0)
    return mezcla(p, fin, ss(10, 16, f))


# ---------------------------------------------------------------------------
# Deslizarse
CADERA_DESLIZ = -0.60     # cuánto baja la cadera


def pose_deslizar(f, T=24):
    t = f / T
    w = 2 * math.pi
    a = math.sin(w * t * 2)               # traqueteo contra el piso
    c = math.sin(w * t + 0.5)
    p = reposo()
    p.mover_cadera(V(0.0, 0.06, CADERA_DESLIZ + 0.006 * a))
    p.orientar('Hips', GIRO(-10) @ LADEO(-4) @ INCL(-34 + 1.0 * a))
    p.orientar('Spine', GIRO(-4) @ INCL(-14))
    p.orientar('Spine1', GIRO(3) @ INCL(2))
    p.orientar('Spine2', GIRO(6) @ INCL(12 + 0.6 * a))
    p.orientar('Neck', GIRO(4) @ INCL(14))
    p.orientar('Head', GIRO(5 + 1.5 * c) @ INCL(12))
    # pierna izquierda estirada adelante, el talón contra el piso; la derecha doblada abajo con la rodilla afuera
    pierna(p, 'L', V(0.13, -0.78, 0.08 + 0.004 * a), polo=V(0.1, -0.3, 1.0), pie=False)
    p.rot('Foot.L', IZQ, -18)
    p.rot('Toe.L', IZQ, -6)
    pierna(p, 'R', V(-0.06, -0.06, 0.07), polo=V(-1.0, -0.6, -0.1), pie=False)
    p.rot('Foot.R', IZQ, 62)
    p.rot('Toe.R', IZQ, 20)
    # brazos: el izquierdo adelante para equilibrar, el derecho atrás cerca del piso
    D3 = p.delta('Spine2').to_3x3()
    brazo(p, 'L', desde_hombro(p, 'L', V(0.20, -0.36, -0.20 + 0.01 * c)), D3 @ V(0.8, 0.4, -0.5))
    p.dedos('L', 22, 14, abre=6)
    brazo(p, 'R', desde_hombro(p, 'R', V(-0.24, 0.24, -0.40)), D3 @ V(-0.8, 0.2, -0.4))
    p.rot_local('Hand.R', (1, 0, 0), -30)
    p.dedos('R', 10, 8, abre=10)
    return p


# ---------------------------------------------------------------------------
CLIPS_CAIDA = {
    'CaidaPlaneo': (48, True, pose_caida_planeo),
    'CaidaPicada': (24, True, pose_caida_picada),
    'Abrir': (ABRIR_T, False, pose_abrir),
    'Paracaidas': (72, True, pose_paracaidas),
    'ParacaidasIzq': (72, True, pose_paracaidas_izq),
    'ParacaidasDer': (72, True, pose_paracaidas_der),
    'ParacaidasFreno': (72, True, pose_paracaidas_freno),
    'Aterrizaje': (ATERRIZA_T, False, pose_aterrizaje),
    'Deslizar': (24, True, pose_deslizar),
}


def hacer_caida(nombre):
    T, loop, fn = CLIPS_CAIDA[nombre]
    paso = 2 if T >= 48 else 1
    fr = list(range(0, T + 1, paso))
    if fr[-1] != T:
        fr.append(T)
    poses = [(f, fn(f)) for f in fr]
    grabar(nombre, poses, loop=loop)


def exportar_caida(ruta):
    # el esqueleto solo, con estos clips (el juego los suma a los de personaje.glb por nombre de hueso)
    arm = bpy.data.objects[ARM]
    for n in CLIPS_CAIDA:
        hacer_caida(n)
    nombres = set(CLIPS_CAIDA)
    for a in list(bpy.data.actions):
        if a.name not in nombres:
            bpy.data.actions.remove(a)
    for a in bpy.data.actions:
        a.use_fake_user = True
    arm.animation_data_create()
    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)
    loc0 = arm.location.copy()
    arm.location.z = loc0.z + 0.032          # igual que heroe_export.py: la suela en y = 0
    bpy.context.view_layer.update()
    for o in bpy.data.objects:
        o.select_set(False)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    try:
        bpy.ops.export_scene.gltf(
            filepath=ruta, export_format='GLB', use_selection=True, export_yup=True, export_apply=False,
            export_skins=True, export_def_bones=False, export_leaf_bone=False, export_rest_position_armature=True,
            export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True,
            export_optimize_animation_size=True, export_anim_single_armature=True, export_reset_pose_bones=True,
            export_anim_slide_to_zero=True, export_bake_animation=False, export_frame_step=1,
            export_materials='NONE', export_extras=False)
    finally:
        arm.location = loc0
        bpy.context.view_layer.update()
    return os.path.getsize(ruta)
