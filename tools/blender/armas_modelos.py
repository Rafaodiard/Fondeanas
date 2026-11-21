# Modelos de las armas de Salto Final (diseños propios). Requiere armas_base.py ejecutado antes.
# Medidas en metros. Origen = centro del puño derecho; cañón +Y, arriba +Z, derecha +X.
# Las alturas comunes encajan con las poses del héroe: ánima a ~0.068 sobre el puño, guardamanos con la base
# a ~0.03 y la mano izquierda a 0.26 adelante; la culata termina a no más de 0.235 detrás del puño.

ANIMA = 0.068


def empunadura(A, nombre, mat='Oliva', panel='Goma', ancho=0.0155, escala=1.0, y0=0.0, z0=0.0):
    # empuñadura de pistola con apoyo de dedos, lomo abultado y cola de castor; paneles de goma con estrías
    s = escala

    def P(pts):
        return [(y0 + p[0] * s, z0 + p[1] * s, *(p[2:3] if len(p) > 2 else ())) for p in pts]

    prisma(A, nombre, P([(0.016, 0.010), (0.012, -0.012, 0.006), (0.0118, -0.034, 0.012), (0.004, -0.050, 0.008),
                         (0.006, -0.068, 0.012), (-0.006, -0.088, 0.008), (-0.011, -0.104, 0.006),
                         (-0.064, -0.109, 0.010), (-0.061, -0.088, 0.02), (-0.043, -0.030, 0.035),
                         (-0.037, -0.006, 0.006), (-0.054, 0.008, 0.006), (-0.042, 0.012)]),
           -ancho, ancho, mat, bisel=0.0025, segs=3)
    zona = P([(0.004, -0.016, 0.006), (0.003, -0.046, 0.01), (-0.006, -0.082, 0.008), (-0.050, -0.090, 0.008),
              (-0.044, -0.040, 0.02), (-0.034, -0.016, 0.006)])
    estrias = cortador(A, nombre + '_estrias',
                       cajas=[((0, y0 + (-0.020 - 0.005 * i) * s, z0 + (-0.020 - 0.0085 * i) * s), (0.06, 0.07 * s,
                                                                                                   0.0028 * s), 0.0,
                               'x') for i in range(8)])
    for lado in (1, -1):
        a0, a1 = (ancho - 0.0008, ancho + 0.0016) if lado > 0 else (-ancho - 0.0016, -ancho + 0.0008)
        prisma(A, nombre + ('_panelD' if lado > 0 else '_panelI'), zona, a0, a1, panel, bisel=0.0006,
               cortes=[estrias])


def rifle():
    A = Arma('rifle')
    z = ANIMA
    # --- cajón inferior (polímero negro) con brocal del cargador ensanchado
    prisma(A, 'inferior', [(-0.056, 0.046), (0.150, 0.046), (0.150, 0.012, 0.004), (0.141, -0.002),
                           (0.141, -0.036, 0.003), (0.062, -0.036, 0.003), (0.058, -0.004, 0.005),
                           (0.000, -0.004), (-0.030, 0.000, 0.01), (-0.056, 0.014, 0.012)],
           -0.0205, 0.0205, 'Polimero', bisel=0.0022)
    prisma(A, 'brocal', [(0.059, -0.030), (0.143, -0.030), (0.145, -0.048, 0.003), (0.060, -0.048, 0.003)],
           -0.0232, 0.0232, 'Polimero', bisel=0.0018,
           cortes=[cortador(A, 'boca_brocal', cajas=[((0, 0.101, -0.045), (0.0255, 0.066, 0.03), 0.004, 'z')])])
    # guardamonte y cola
    tubo(A, 'guardamonte', [(0, 0.061, -0.012), (0, 0.059, -0.036), (0, 0.044, -0.047), (0, 0.012, -0.047),
                             (0, -0.002, -0.034), (0, -0.004, -0.010)], 0.0042, 'Polimero', segs=10, paso=0.004,
         achatar=1.9)
    prisma(A, 'gatillo', [(0.030, -0.002), (0.037, -0.002), (0.041, -0.020, 0.006), (0.036, -0.034, 0.003),
                          (0.031, -0.032), (0.034, -0.020, 0.004)], -0.0034, 0.0034, 'Acero', n=4, bisel=0.0008)
    empunadura(A, 'empunadura', 'Oliva')
    # selector, retén del cargador, retén del cerrojo y pasadores
    caja(A, 'selector', (-0.0222, 0.004, 0.030), (0.004, 0.020, 0.0065), 'Acero', r=0.0028)
    torno(A, 'selector_eje', [(-0.0215, 0.0), (-0.0215, 0.005), (-0.0245, 0.005), (-0.0245, 0.0)], 'AceroOscuro',
          eje='x', centro=(0.016, 0.030), segs=12)
    torno(A, 'reten', [(0.0195, 0.0), (0.0195, 0.0048), (0.0232, 0.0048), (0.0240, 0.0035), (0.0240, 0.0)],
          'Acero', eje='x', centro=(0.060, 0.022), segs=14)
    caja(A, 'retencerrojo', (-0.0225, 0.040, 0.020), (0.004, 0.024, 0.010), 'Polimero', r=0.003)
    for y, zz in ((-0.042, 0.030), (0.137, 0.032), (0.012, 0.036)):
        tornillo(A, 'pasadorD%d' % int(y * 1000), (0.0205, y, zz), 'x', 0.0034, 0.0012)
        tornillo(A, 'pasadorI%d' % int(y * 1000), (-0.0205, y, zz), 'x', 0.0034, 0.0012, signo=-1)

    # --- cajón superior (grafito) con ventana de expulsión y canal lateral
    corte_sup = cortador(A, 'superior', cajas=[((0.0245, 0.055, 0.072), (0.012, 0.064, 0.022), 0.004, 'x'),
                                                ((-0.0255, 0.070, 0.079), (0.008, 0.150, 0.0065), 0.003, 'x'),
                                                ((0.0255, 0.155, 0.079), (0.008, 0.070, 0.0065), 0.003, 'x')])
    prisma(A, 'superior', [(-0.0245, 0.046), (0.0245, 0.046), (0.0245, 0.087, 0.002), (0.0175, 0.1, 0.002),
                           (-0.0175, 0.1, 0.002), (-0.0245, 0.087, 0.002)], -0.058, 0.205, 'Grafito', eje='y',
           bisel=0.0022, cortes=[corte_sup])
    # cerrojo visto por la ventana y manija de carga (se mueven juntos al montar el arma)
    caja(A, 'cerrojo', (0.0170, 0.055, 0.072), (0.010, 0.060, 0.019), 'Acero', r=0.003, grupo='cerrojo')
    torno(A, 'cerrojo_perno', [(0.019, 0.0), (0.019, 0.0045), (0.0225, 0.0045), (0.0225, 0.0)], 'AceroOscuro',
          eje='x', centro=(0.066, 0.072), segs=12, grupo='cerrojo')
    prisma(A, 'manija', [(-0.024, -0.060), (0.024, -0.060), (0.027, -0.068, 0.004), (0.020, -0.075, 0.003),
                         (-0.020, -0.075, 0.003), (-0.027, -0.068, 0.004)], 0.086, 0.097, 'Polimero', eje='z',
           bisel=0.0012, grupo='cerrojo')
    caja(A, 'manija_vastago', (0, -0.040, 0.091), (0.010, 0.040, 0.008), 'Polimero', r=0.002, grupo='cerrojo')

    # --- riel superior corrido
    riel(A, 'riel', -0.052, 0.440, 0.100)
    # --- guardamanos (oliva) con ranuras redondeadas y filete de rareza
    ranuras = []
    for i in range(5):
        ranuras += espejo_x([((0.0275, 0.240 + 0.055 * i, 0.061), (0.012, 0.036, 0.0128), 0.0063, 'x')])
    ranuras += [((0, 0.262 + 0.062 * i, 0.031), (0.011, 0.038, 0.012), 0.0055, 'z') for i in range(4)]
    ranuras += espejo_x([((0.0278, 0.352, 0.0855), (0.006, 0.288, 0.0052), 0.0, 'x')])
    gm = cortador(A, 'guardamanos', cajas=ranuras)
    sec = [(-0.020, 0.030, 0.004), (0.020, 0.030, 0.004), (0.0275, 0.040, 0.004), (0.0275, 0.091, 0.004),
           (0.020, 0.100, 0.004), (-0.020, 0.100, 0.004), (-0.0275, 0.091, 0.004), (-0.0275, 0.040, 0.004)]
    prisma(A, 'guardamanos', sec, 0.200, 0.508, 'Oliva', eje='y', bisel=0.0022, cortes=[gm])
    prisma(A, 'guardamanos_tapa', [(x * 0.93, 0.065 + (zz - 0.065) * 0.93, r) for x, zz, r in sec], 0.504, 0.516,
           'Grafito', eje='y', bisel=0.0015)
    for s in (1, -1):
        caja(A, 'filete%d' % s, (s * 0.0262, 0.352, 0.0855), (0.003, 0.284, 0.0034), 'Rareza', r=0.0015, eje='y',
             bisel=0.0)
    # --- cañón, bloque de gases y freno de boca con lumbreras
    torno(A, 'canon', [(0.490, 0.0), (0.490, 0.0150), (0.524, 0.0150), (0.527, 0.0128), (0.672, 0.0125),
                       (0.672, 0.0)], 'Pavonado', centro=(0, z), segs=24)
    caja(A, 'bloque_gases', (0, 0.540, z + 0.007), (0.030, 0.024, 0.038), 'Pavonado', r=0.0045, eje='y')
    tornillo(A, 'bloque_tornillo', (0.015, 0.540, z + 0.012), 'x', 0.0032, 0.0012)
    freno = cortador(A, 'freno',
                     cajas=[((0, 0.694 + 0.0175 * i, z), (0.06, 0.009, 0.0088), 0.0038, 'x') for i in range(3)] +
                     [((0, 0.697 + 0.021 * i, z + 0.02), (0.0085, 0.0085, 0.02), 0.0038, 'z') for i in range(2)])
    torno(A, 'freno', [(0.666, 0.0), (0.666, 0.0165), (0.677, 0.0195), (0.745, 0.0195), (0.752, 0.0165),
                       (0.752, 0.0068), (0.736, 0.0068), (0.736, 0.0)], 'AceroOscuro', centro=(0, z), segs=24,
          cortes=[freno])
    # --- mira holográfica sobre el riel, con retícula de rareza
    caja(A, 'mira_base', (0, 0.043, 0.1135), (0.030, 0.082, 0.010), 'Polimero', r=0.002)
    ventana = cortador(A, 'mira', cajas=[((0, 0.047, 0.1415), (0.0265, 0.1, 0.030), 0.0045, 'y')])
    prisma(A, 'mira', [(-0.0172, 0.118, 0.003), (0.0172, 0.118, 0.003), (0.0172, 0.162, 0.006),
                       (-0.0172, 0.162, 0.006)], 0.022, 0.078, 'Polimero', eje='y', bisel=0.0018, cortes=[ventana])
    caja(A, 'mira_caja', (0, 0.012, 0.128), (0.031, 0.022, 0.022), 'Polimero', r=0.004)
    caja(A, 'mira_lente', (0, 0.071, 0.1415), (0.0272, 0.0016, 0.0305), 'Lente', r=0.004, eje='y', bisel=0.0)
    torno(A, 'mira_punto', [(0.0698, 0.0), (0.0698, 0.0019), (0.0702, 0.0019), (0.0702, 0.0)], 'Rareza',
          centro=(0, 0.1415), segs=12, bisel=0.0)
    for x in (-0.010, 0.0, 0.010):
        torno(A, 'mira_boton%d' % int(x * 1000), [(0.0, 0.0), (0.0, 0.0028), (0.0045, 0.0028), (0.0045, 0.0)],
              'Goma', eje='z', centro=(x, 0.010), segs=10)
        A.piezas[-1][0].location.z = 0.139
    # --- mira delantera plegable y alza trasera
    prisma(A, 'alza_del', [(0.404, 0.1085), (0.432, 0.1085), (0.430, 0.124, 0.003), (0.420, 0.138, 0.002),
                           (0.413, 0.138), (0.408, 0.118)], -0.0085, 0.0085, 'Polimero', bisel=0.0012)
    prisma(A, 'alza_tras', [(-0.046, 0.1085), (-0.020, 0.1085), (-0.022, 0.122, 0.003), (-0.032, 0.130, 0.002),
                            (-0.040, 0.130), (-0.046, 0.118)], -0.0095, 0.0095, 'Polimero', bisel=0.0012)
    # --- culata: tubo y cuerpo con hueco aligerado, cantonera de goma y filete de rareza
    torno(A, 'tubo_culata', [(-0.205, 0.0), (-0.205, 0.0158), (-0.058, 0.0158), (-0.058, 0.0)], 'Pavonado',
          centro=(0, 0.066), segs=20)
    hueco = cortador(A, 'culata', cajas=[((0, -0.168, 0.030), (0.06, 0.050, 0.030), 0.012, 'x')])
    prisma(A, 'culata', [(-0.096, 0.090, 0.006), (-0.222, 0.094, 0.008), (-0.222, -0.062, 0.008),
                         (-0.194, -0.066, 0.01), (-0.120, 0.022, 0.03), (-0.096, 0.040, 0.008)],
           -0.0205, 0.0205, 'Oliva', bisel=0.0025, segs=3, cortes=[hueco])
    prisma(A, 'cantonera', [(-0.2215, 0.091, 0.002), (-0.233, 0.089, 0.004), (-0.233, -0.058, 0.004),
                            (-0.2215, -0.061, 0.002)], -0.0215, 0.0215, 'Goma', bisel=0.0015)
    for s in (1, -1):
        prisma(A, 'culata_filete%d' % s, [(-0.104, 0.076), (-0.208, 0.081), (-0.208, 0.0855), (-0.104, 0.0805)],
               s * 0.0200, s * 0.0214, 'Rareza', n=0, bisel=0.0)
    tornillo(A, 'culata_qd', (0.0205, -0.120, 0.060), 'x', 0.0055, 0.0018, 'AceroOscuro')
    # --- cargador curvo (pieza móvil) con base
    prisma(A, 'cargador', [(0.071, 0.030), (0.131, 0.030), (0.134, -0.040, 0.05), (0.147, -0.100, 0.08),
                           (0.172, -0.160), (0.111, -0.174), (0.084, -0.100, 0.08), (0.072, -0.040, 0.05)],
           -0.0122, 0.0122, 'Polimero', n=6, bisel=0.0018, grupo='cargador')
    prisma(A, 'cargador_base', [(0.106, -0.170), (0.177, -0.155), (0.180, -0.165, 0.003), (0.109, -0.182, 0.003)],
           -0.0142, 0.0142, 'Grafito', bisel=0.0018, grupo='cargador')
    for s in (1, -1):
        prisma(A, 'cargador_nervio%d' % s, [(0.090, -0.020), (0.112, -0.020), (0.128, -0.120, 0.04),
                                            (0.150, -0.158), (0.132, -0.161), (0.108, -0.120, 0.04)],
               s * 0.0118, s * 0.0132, 'Polimero', n=6, bisel=0.0006, grupo='cargador')

    A.punto('boca', (0, 0.752, z))
    A.punto('mira', (0, 0.071, 0.1415))
    A.punto('apoyo', (0, 0.26, 0.030))
    return A, finalizar(A, {'cargador': (0, 0.101, 0.0), 'cerrojo': (0, -0.064, 0.090)})


MODELOS = {'rifle': rifle}


def hacer(nombre):
    A, info = MODELOS[nombre]()
    return info
