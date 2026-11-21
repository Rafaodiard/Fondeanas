# Control de calidad de las recargas (sin render): para cada clip de RECARGAS mide, cuadro por cuadro,
# - brazo en el torso: si el codo o el antebrazo se meten en el pecho (elipse en el marco de Spine2; < 1 = adentro),
# - alcance: el brazo más estirado (> 1 = la mano no llega y el brazo queda recto),
# - saltos: cuánto se mueve cada muñeca y el arma de un cuadro al siguiente (más de ~0,17 m a 24 cuadros/s se ve
#   como un salto).
# Requiere heroe_anim.py, heroe_clips.py y heroe_recargas.py ejecutados antes y el esqueleto 'Esqueleto' en la escena.
# Uso: control_recargas() imprime una línea por clip y devuelve la lista de problemas.

PECHO_X, PECHO_Z = 0.17, 0.13      # semiejes de la elipse del pecho (lateral, adelante/atrás)
SALTO_MAX = 0.17
ALCANCE_MAX = 1.0


def brazo_en_torso(p, lado):
    # el peor punto del brazo (sin el 30 % del hombro) dentro de la elipse del pecho
    Mi = p.M['Spine2'].inverted()
    a, b, c = p.head('UpperArm.' + lado), p.head('LowerArm.' + lado), p.head('Hand.' + lado)
    peor = 9.0
    for (u, v), t0 in (((a, b), 0.3), ((b, c), 0.0)):
        for i in range(11):
            q = Mi @ u.lerp(v, t0 + (1 - t0) * i / 10)
            if -0.30 < q.y < 0.30:
                peor = min(peor, (q.x / PECHO_X) ** 2 + (q.z / PECHO_Z) ** 2)
    return peor


def control_recargas(nombres=None):
    problemas = []
    for nombre in nombres or list(RECARGAS):
        C = RECARGAS[nombre]()
        prev = None
        peor = {'torso': 9.0, 'alcance': 0.0, 'salto': 0.0}
        for f in range(C.T + 1):
            DIAG.clear()
            p = C.pose(f)
            alc = DIAG.get('brazo', 0.0)
            tor = min(brazo_en_torso(p, 'L'), brazo_en_torso(p, 'R'))
            cur = {'L': p.head('Hand.L'), 'R': p.head('Hand.R'), 'arma': p.head('Arma.R')}
            if prev:
                for k in cur:
                    d = (cur[k] - prev[k]).length
                    peor['salto'] = max(peor['salto'], d)
                    if d > SALTO_MAX:
                        problemas.append((nombre, f, 'salto ' + k, round(d, 3)))
            prev = cur
            peor['torso'] = min(peor['torso'], tor)
            peor['alcance'] = max(peor['alcance'], alc)
            if tor < 1.0:
                problemas.append((nombre, f, 'brazo en el torso', round(tor, 2)))
            if alc > ALCANCE_MAX:
                problemas.append((nombre, f, 'brazo estirado', round(alc, 3)))
        print('%-22s torso %.2f  alcance %.3f  salto %.3f m' % (nombre, peor['torso'], peor['alcance'], peor['salto']))
    for pr in problemas:
        print('   ', pr)
    return problemas
