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
    # paneles moldeados (bajo relieve) a los dos lados del cajón inferior y estrías en el frente del brocal
    caja(A, 'inferior_panelD', (0.0205, 0.100, 0.018), (0.0022, 0.064, 0.032), 'Polimero', r=0.005, bisel=0.0008)
    caja(A, 'inferior_panelI', (-0.0205, 0.100, 0.018), (0.0022, 0.064, 0.032), 'Polimero', r=0.005, bisel=0.0008)
    estr = cortador(A, 'brocal_estrias', cajas=[((0, 0.1435, -0.004 - 0.0055 * i), (0.05, 0.004, 0.0024), 0.0, 'x')
                                               for i in range(6)])
    prisma(A, 'brocal_frente', [(0.139, 0.010), (0.1445, 0.010), (0.1445, -0.034), (0.139, -0.034)], -0.0175, 0.0175,
           'Polimero', n=0, bisel=0.0006, cortes=[estr])
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
    # asistente de cierre, tapa guardapolvo abierta y cortes de aligerado en el frente del cajón
    torno(A, 'asistente', [(0.020, 0.0), (0.020, 0.0085), (0.0285, 0.0085), (0.0300, 0.0070), (0.0300, 0.0)],
          'Grafito', eje='x', centro=(-0.030, 0.082), segs=18)
    torno(A, 'asistente_boton', [(0.029, 0.0), (0.029, 0.0055), (0.0318, 0.0050), (0.0318, 0.0)], 'AceroOscuro',
          eje='x', centro=(-0.030, 0.082), segs=14)
    prisma(A, 'tapa_polvo', [(0.0248, 0.0592), (0.0259, 0.0600), (0.0330, 0.0500), (0.0319, 0.0492)], 0.026, 0.085,
           'Grafito', eje='y', n=0, bisel=0.0004)
    for s2 in (1, -1):
        prisma(A, 'aligerado%d' % s2, [(0.150, 0.054, 0.003), (0.196, 0.054, 0.003), (0.196, 0.080, 0.003)],
               s2 * 0.0236, s2 * 0.0252, 'Pavonado', n=4, bisel=0.0004)
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
    prisma(A, 'mira', [(0.018, 0.118, 0.002), (0.080, 0.118, 0.002), (0.072, 0.163, 0.006), (0.030, 0.165, 0.006)],
           -0.0172, 0.0172, 'Polimero', bisel=0.0018, cortes=[ventana])
    for s2 in (1, -1):
        torno(A, 'mira_perilla%d' % s2, [(s2 * 0.0172, 0.0), (s2 * 0.0172, 0.0058), (s2 * 0.0215, 0.0058),
                                         (s2 * 0.0225, 0.0045), (s2 * 0.0225, 0.0)], 'Grafito', eje='x',
              centro=(0.036, 0.128), segs=14, bisel=0.0)
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


def gatillo_y_guarda(A, mat_guarda='Polimero', escala=1.0, y0=0.0):
    k = escala
    tubo(A, 'guardamonte', [(0, y0 + 0.061 * k, -0.010 * k), (0, y0 + 0.059 * k, -0.036 * k), (0, y0 + 0.044 * k, -0.047 * k),
                             (0, y0 + 0.012 * k, -0.047 * k), (0, y0 - 0.002 * k, -0.034 * k), (0, y0 - 0.004 * k, -0.010 * k)],
         0.0042 * k, mat_guarda, segs=10, paso=0.004, achatar=1.9)
    prisma(A, 'gatillo', [(y0 + 0.030 * k, -0.002 * k), (y0 + 0.037 * k, -0.002 * k), (y0 + 0.041 * k, -0.020 * k, 0.006),
                          (y0 + 0.036 * k, -0.034 * k, 0.003), (y0 + 0.031 * k, -0.032 * k), (y0 + 0.034 * k, -0.020 * k, 0.004)],
           -0.0034, 0.0034, 'Acero', n=4, bisel=0.0008)


def filetes(A, nombre, y, z, largo, x, alto=0.0034):
    for s in (1, -1):
        caja(A, '%s%d' % (nombre, s), (s * x, y, z), (0.003, largo, alto), 'Rareza', r=0.0015, eje='y', bisel=0.0)


def escopeta():
    A = Arma('escopeta')
    z = ANIMA
    # cajón de acero con ventana de expulsión (derecha), boca de carga (abajo) y canal de mira arriba
    cut = cortador(A, 'cajon', cajas=[((0.021, 0.088, 0.066), (0.012, 0.068, 0.026), 0.004, 'x'),
                                      ((0, 0.104, 0.004), (0.026, 0.080, 0.02), 0.006, 'z'),
                                      ((0, 0.060, 0.099), (0.006, 0.20, 0.006), 0.0025, 'z')])
    prisma(A, 'cajon', [(-0.052, 0.022), (-0.052, 0.074, 0.02), (-0.020, 0.100, 0.014), (0.150, 0.100, 0.012),
                        (0.172, 0.088, 0.006), (0.172, 0.010, 0.004), (0.060, 0.006), (0.0, 0.006), (-0.030, 0.012, 0.01)],
           -0.0215, 0.0215, 'Pavonado', bisel=0.0025, cortes=[cut])
    caja(A, 'cajon_lomo', (0, 0.060, 0.1015), (0.016, 0.19, 0.004), 'AceroOscuro', r=0.0, eje='y', bisel=0.0008)
    caja(A, 'cajon_panel', (0.0205, 0.020, 0.052), (0.0022, 0.050, 0.050), 'Pavonado', r=0.006, bisel=0.0008)
    for y, zz in ((-0.034, 0.030), (0.150, 0.024), (0.020, 0.018)):
        tornillo(A, 'pasadorD%d' % int(y * 1000), (0.0205, y, zz), 'x', 0.0034, 0.0012)
        tornillo(A, 'pasadorI%d' % int(y * 1000), (-0.0205, y, zz), 'x', 0.0034, 0.0012, signo=-1)
    caja(A, 'seguro', (0, -0.040, 0.100), (0.010, 0.016, 0.006), 'Acero', r=0.0025)
    gatillo_y_guarda(A, 'Pavonado')
    empunadura(A, 'empunadura', 'Madera', panel='Goma')
    # cañón con choque, tubo almacén con tapa y abrazadera, guardamanos térmico perforado y punto de mira
    torno(A, 'canon', [(0.165, 0.0), (0.165, 0.0175), (0.185, 0.0175), (0.188, 0.0160), (0.690, 0.0160),
                       (0.693, 0.0182), (0.715, 0.0182), (0.715, 0.0122), (0.700, 0.0122), (0.700, 0.0)], 'Pavonado',
          centro=(0, z), segs=28)
    torno(A, 'almacen', [(0.165, 0.0), (0.165, 0.0140), (0.620, 0.0140), (0.620, 0.0)], 'Pavonado', centro=(0, 0.028),
          segs=24)
    torno(A, 'almacen_tapa', [(0.618, 0.0), (0.618, 0.0155), (0.636, 0.0155), (0.643, 0.0122), (0.643, 0.0)],
          'AceroOscuro', centro=(0, 0.028), segs=24)
    caja(A, 'abrazadera', (0, 0.600, 0.048), (0.030, 0.018, 0.060), 'Pavonado', r=0.008, eje='y')
    tornillo(A, 'abrazadera_t', (0.015, 0.600, 0.048), 'x', 0.0038, 0.0012)
    escudo = cortador(A, 'escudo',
                      cajas=[((0, 0.400 + 0.050 * i, z + 0.022), (0.009, 0.030, 0.014), 0.0045, 'z') for i in range(6)],
                      cilindros=[((0, 0.425 + 0.050 * i, z + 0.008), 0.0052, 0.07, 'x') for i in range(5)])
    prisma(A, 'escudo', arco(0, z, 0.0195, 0.0222, -30, 210, 20), 0.375, 0.680, 'Pavonado', eje='y', n=0,
           bisel=0.0008, cortes=[escudo])
    for y in (0.380, 0.672):
        prisma(A, 'escudo_aro%d' % int(y * 1000), arco(0, z, 0.0175, 0.0232, -32, 212, 20), y - 0.005, y + 0.005,
               'AceroOscuro', eje='y', n=0, bisel=0.0006)
    torno(A, 'punto', [(0.703, 0.0), (0.703, 0.0026), (0.707, 0.0034), (0.711, 0.0026), (0.711, 0.0)], 'Laton',
          centro=(0, z + 0.0196), segs=10, bisel=0.0)
    # bomba de madera con estrías, tapas de acero, filete de rareza y barras de acción (todo se mueve junto)
    sec_b = [(-0.024, 0.002, 0.012), (0.024, 0.002, 0.012), (0.0305, 0.030, 0.014), (0.0245, 0.058, 0.009),
             (-0.0245, 0.058, 0.009), (-0.0305, 0.030, 0.014)]
    estr = cortador(A, 'bomba', cajas=espejo_x([((0.0315, 0.224 + 0.0165 * i, 0.030), (0.008, 0.0062, 0.032), 0.0025,
                                                 'x') for i in range(8)]))
    prisma(A, 'bomba', sec_b, 0.200, 0.370, 'Madera', eje='y', bisel=0.003, segs=3, cortes=[estr], grupo='bomba')
    for y0, y1, nm in ((0.193, 0.201, 'bomba_tapaT'), (0.369, 0.377, 'bomba_tapaD')):
        prisma(A, nm, [(x * 0.94, 0.030 + (zz - 0.030) * 0.94, r) for x, zz, r in sec_b], y0, y1, 'Pavonado', eje='y',
               bisel=0.0012, grupo='bomba')
    prisma(A, 'bomba_filete', [(x * 1.012, 0.030 + (zz - 0.030) * 1.012, r) for x, zz, r in sec_b], 0.354, 0.360,
           'Rareza', eje='y', bisel=0.0, grupo='bomba')
    for sx in (1, -1):
        caja(A, 'barra%d' % sx, (sx * 0.0155, 0.182, 0.033), (0.004, 0.044, 0.006), 'Pavonado', r=0.002,
             grupo='bomba')
    caja(A, 'cierre', (0.0170, 0.088, 0.066), (0.008, 0.064, 0.022), 'Acero', r=0.003, grupo='bomba')
    # portacartuchos al costado izquierdo con cuatro cartuchos
    caja(A, 'porta', (-0.0238, 0.073, 0.047), (0.0065, 0.096, 0.050), 'Polimero', r=0.005)
    for i, y in enumerate((0.040, 0.062, 0.084, 0.106)):
        torno(A, 'cart%d' % i, [(0.030, 0.0), (0.030, 0.0088), (0.074, 0.0088), (0.076, 0.0074), (0.076, 0.0)],
              'Cartucho', eje='z', centro=(-0.0305, y), segs=14, bisel=0.0)
        torno(A, 'base%d' % i, [(0.018, 0.0), (0.018, 0.0094), (0.031, 0.0094), (0.031, 0.0)], 'Laton', eje='z',
              centro=(-0.0305, y), segs=14, bisel=0.0)
    # culata de madera con cantonera y filete de rareza
    prisma(A, 'culata', [(-0.048, 0.094, 0.006), (-0.110, 0.084, 0.05), (-0.215, 0.092, 0.012), (-0.215, -0.058, 0.012),
                         (-0.190, -0.063, 0.01), (-0.120, -0.008, 0.06), (-0.062, 0.014, 0.012), (-0.048, 0.026)],
           -0.0205, 0.0205, 'Madera', bisel=0.003, segs=3)
    prisma(A, 'cantonera', [(-0.2145, 0.095, 0.003), (-0.233, 0.093, 0.006), (-0.233, -0.060, 0.006),
                            (-0.2145, -0.064, 0.003)], -0.0215, 0.0215, 'Goma', bisel=0.0015)
    for sx in (1, -1):
        prisma(A, 'culata_filete%d' % sx, [(-0.120, 0.071), (-0.200, 0.078), (-0.200, 0.0825), (-0.120, 0.0755)],
               sx * 0.0200, sx * 0.0214, 'Rareza', n=0, bisel=0.0)
    tornillo(A, 'anclaje', (0.0, -0.165, -0.0445), 'z', 0.0045, 0.0015, signo=-1)
    A.punto('boca', (0, 0.715, z))
    A.punto('apoyo', (0, 0.28, 0.002))
    return A, finalizar(A, {'bomba': (0, 0.28, 0.030)})


def francotirador():
    A = Arma('francotirador')
    z = ANIMA
    corte = cortador(A, 'cajon', cajas=[((0.018, 0.032, z + 0.004), (0.014, 0.075, 0.020), 0.004, 'x')])
    torno(A, 'cajon', [(-0.062, 0.0), (-0.062, 0.0175), (-0.056, 0.0195), (0.170, 0.0195), (0.176, 0.0172),
                       (0.176, 0.0)], 'Pavonado', centro=(0, z), segs=28, cortes=[corte])
    riel(A, 'riel', -0.052, 0.172, z + 0.0170, mat='Pavonado')
    # chasis (polímero) con brocal, cargador de caja, empuñadura y guardamanos arena
    prisma(A, 'chasis', [(-0.060, 0.052), (0.180, 0.052), (0.180, 0.016, 0.004), (0.125, 0.010), (0.122, -0.026, 0.003),
                         (0.040, -0.026, 0.003), (0.037, 0.002), (0.0, 0.004), (-0.035, 0.010, 0.01),
                         (-0.060, 0.022, 0.01)], -0.0215, 0.0215, 'Polimero', bisel=0.0022)
    for y, zz in ((-0.040, 0.034), (0.150, 0.034)):
        tornillo(A, 'pasD%d' % int(y * 1000), (0.0215, y, zz), 'x', 0.0036, 0.0012)
        tornillo(A, 'pasI%d' % int(y * 1000), (-0.0215, y, zz), 'x', 0.0036, 0.0012, signo=-1)
    gatillo_y_guarda(A, 'Polimero')
    empunadura(A, 'empunadura', 'Arena')
    prisma(A, 'cargador', [(0.046, 0.012), (0.116, 0.012), (0.116, -0.062, 0.003), (0.046, -0.062, 0.003)],
           -0.0172, 0.0172, 'Polimero', bisel=0.0015, grupo='cargador')
    prisma(A, 'cargador_base', [(0.043, -0.058), (0.119, -0.058), (0.119, -0.069, 0.003), (0.043, -0.069, 0.003)],
           -0.0192, 0.0192, 'Grafito', bisel=0.0015, grupo='cargador')
    ven = []
    for i in range(4):
        ven += espejo_x([((0.025, 0.215 + 0.062 * i, 0.054), (0.012, 0.040, 0.012), 0.006, 'x')])
    sec = [(-0.020, 0.028, 0.006), (0.020, 0.028, 0.006), (0.025, 0.045, 0.004), (0.025, 0.082, 0.006),
           (-0.025, 0.082, 0.006), (-0.025, 0.045, 0.004)]
    prisma(A, 'guardamanos', sec, 0.176, 0.470, 'Arena', eje='y', bisel=0.0025, cortes=[cortador(A, 'gm', cajas=ven)])
    prisma(A, 'guardamanos_tapa', [(x * 0.93, 0.055 + (zz - 0.055) * 0.93, r) for x, zz, r in sec], 0.466, 0.478,
           'Polimero', eje='y', bisel=0.0015)
    filetes(A, 'filete', 0.322, 0.0745, 0.272, 0.0242)
    # bípode plegado debajo del guardamanos
    caja(A, 'bipode', (0, 0.455, 0.021), (0.032, 0.022, 0.016), 'Grafito', r=0.004)
    for sx in (1, -1):
        tubo(A, 'pata%d' % sx, [(sx * 0.010, 0.446, 0.017), (sx * 0.010, 0.252, 0.019)], 0.0045, 'Grafito', segs=10)
        torno(A, 'pie%d' % sx, [(0.236, 0.0), (0.236, 0.0062), (0.256, 0.0062), (0.256, 0.0)], 'Goma',
              centro=(sx * 0.010, 0.019), segs=12, bisel=0.0)
    # cañón estriado largo y freno de boca
    estrias = cortador(A, 'canon', cajas=[((sx * 0.0152, 0.70, z), (0.0045, 0.40, 0.005), 0.002, 'y') for sx in (1, -1)] +
                       [((0, 0.70, z + sz * 0.0152), (0.005, 0.40, 0.0045), 0.002, 'y') for sz in (1, -1)])
    torno(A, 'canon', [(0.170, 0.0), (0.170, 0.0185), (0.200, 0.0185), (0.205, 0.0168), (1.010, 0.0145),
                       (1.010, 0.0)], 'Pavonado', centro=(0, z), segs=28, cortes=[estrias])
    freno = cortador(A, 'freno', cajas=[((0, 1.030 + 0.021 * i, z), (0.07, 0.011, 0.011), 0.0045, 'x') for i in range(3)])
    torno(A, 'freno', [(1.006, 0.0), (1.006, 0.0195), (1.016, 0.0230), (1.094, 0.0230), (1.102, 0.0195),
                       (1.102, 0.0085), (1.084, 0.0085), (1.084, 0.0)], 'AceroOscuro', centro=(0, z), segs=28,
          cortes=[freno])
    # culata esqueleto con apoyo de mejilla y cantonera
    hueco = cortador(A, 'culata', cajas=[((0, -0.152, 0.012), (0.06, 0.068, 0.040), 0.016, 'x')])
    prisma(A, 'culata', [(-0.058, 0.060), (-0.075, 0.088, 0.01), (-0.224, 0.090, 0.01), (-0.224, -0.066, 0.01),
                         (-0.200, -0.070, 0.01), (-0.120, -0.040, 0.03), (-0.070, -0.010, 0.02), (-0.058, 0.010)],
           -0.0205, 0.0205, 'Arena', bisel=0.0025, segs=3, cortes=[hueco])
    prisma(A, 'mejilla', [(-0.092, 0.088), (-0.192, 0.090), (-0.192, 0.111, 0.008), (-0.102, 0.109, 0.012)],
           -0.0175, 0.0175, 'Polimero', bisel=0.0018)
    prisma(A, 'cantonera', [(-0.2235, 0.092, 0.003), (-0.236, 0.090, 0.006), (-0.236, -0.068, 0.006),
                            (-0.2235, -0.072, 0.003)], -0.022, 0.022, 'Goma', bisel=0.0015)
    # mira telescópica con torretas, anillos, lentes y anillo de rareza
    M = 0.150
    torno(A, 'mira_tubo', [(-0.050, 0.0), (-0.050, 0.0195), (0.215, 0.0195), (0.215, 0.0)], 'Polimero',
          centro=(0, M), segs=28, bisel=0.0)
    torno(A, 'mira_objetivo', [(0.210, 0.0), (0.210, 0.0200), (0.255, 0.0335), (0.318, 0.0345), (0.326, 0.0325),
                               (0.326, 0.0290), (0.318, 0.0290), (0.318, 0.0)], 'Polimero', centro=(0, M), segs=32)
    torno(A, 'mira_lente', [(0.3182, 0.0), (0.3182, 0.0290), (0.3188, 0.0290), (0.3188, 0.0)], 'Lente', centro=(0, M),
          segs=32, bisel=0.0)
    torno(A, 'mira_ocular', [(-0.128, 0.0), (-0.128, 0.0232), (-0.120, 0.0252), (-0.078, 0.0252), (-0.056, 0.0200),
                             (-0.048, 0.0200), (-0.048, 0.0)], 'Polimero', centro=(0, M), segs=28)
    torno(A, 'mira_lente2', [(-0.1288, 0.0), (-0.1288, 0.0195), (-0.1282, 0.0195), (-0.1282, 0.0)], 'Lente',
          centro=(0, M), segs=28, bisel=0.0)
    torno(A, 'mira_aro', [(0.186, 0.0), (0.186, 0.0202), (0.195, 0.0202), (0.195, 0.0)], 'Rareza', centro=(0, M),
          segs=28, bisel=0.0)
    caja(A, 'mira_torreta_base', (0, 0.082, M), (0.042, 0.042, 0.042), 'Polimero', r=0.014)
    torno(A, 'mira_torreta', [(M + 0.020, 0.0), (M + 0.020, 0.0135), (M + 0.040, 0.0135), (M + 0.044, 0.0112),
                              (M + 0.044, 0.0)], 'Grafito', eje='z', centro=(0, 0.082), segs=22)
    torno(A, 'mira_deriva', [(0.020, 0.0), (0.020, 0.0125), (0.038, 0.0125), (0.042, 0.0102), (0.042, 0.0)],
          'Grafito', eje='x', centro=(0.082, M), segs=22)
    for y in (0.000, 0.140):
        torno(A, 'anillo%d' % int(y * 1000), [(y - 0.009, 0.0), (y - 0.009, 0.0225), (y + 0.009, 0.0225),
                                              (y + 0.009, 0.0)], 'Pavonado', centro=(0, M), segs=28)
        caja(A, 'anillo_pie%d' % int(y * 1000), (0, y, 0.112), (0.024, 0.018, 0.040), 'Pavonado', r=0.003, eje='y')
    # cerrojo: cola, manija y bola
    torno(A, 'cerrojo', [(-0.090, 0.0), (-0.090, 0.0120), (-0.082, 0.0148), (-0.060, 0.0148), (-0.060, 0.0)], 'Acero',
          centro=(0, z), segs=24, grupo='cerrojo')
    tubo(A, 'manija', [(0.010, -0.044, z + 0.004), (0.030, -0.047, z - 0.004), (0.044, -0.050, z - 0.020)], 0.0042,
         'Acero', segs=10, paso=0.004, grupo='cerrojo')
    torno(A, 'bola', [(-0.0098, 0.0), (-0.0088, 0.0050), (-0.0050, 0.0088), (0.0, 0.0098), (0.0050, 0.0088),
                      (0.0088, 0.0050), (0.0098, 0.0)], 'Polimero', eje='x', centro=(-0.052, z - 0.027), segs=16,
          bisel=0.0, grupo='cerrojo')
    A.piezas[-1][0].location.x = 0.050
    A.punto('boca', (0, 1.102, z))
    A.punto('mira', (0, -0.128, M))
    A.punto('apoyo', (0, 0.26, 0.028))
    return A, finalizar(A, {'cerrojo': (0, -0.070, z), 'cargador': (0, 0.081, -0.02)})


def pistola():
    A = Arma('pistola')
    zb = 0.052
    # armazón de polímero con riel bajo el cañón, guardamonte cuadrado y empuñadura
    ranu = cortador(A, 'armazon', cajas=[((0, 0.100 + 0.014 * i, 0.010), (0.03, 0.0055, 0.006), 0.0, 'x')
                                         for i in range(4)])
    prisma(A, 'armazon', [(-0.040, 0.035), (0.166, 0.035), (0.166, 0.010, 0.004), (0.070, 0.008), (0.064, 0.002),
                          (0.030, 0.002), (0.010, 0.006), (-0.022, 0.012, 0.008), (-0.040, 0.022, 0.006)],
           -0.0135, 0.0135, 'Polimero', bisel=0.0018, cortes=[ranu])
    tubo(A, 'guardamonte', [(0, 0.066, 0.006), (0, 0.066, -0.024), (0, 0.058, -0.033), (0, 0.016, -0.033),
                             (0, 0.002, -0.022), (0, 0.000, -0.002)], 0.0038, 'Polimero', segs=10, paso=0.004,
         achatar=1.8)
    prisma(A, 'gatillo', [(0.026, 0.004), (0.033, 0.004), (0.036, -0.012, 0.005), (0.032, -0.024, 0.003),
                          (0.027, -0.022), (0.029, -0.010, 0.004)], -0.003, 0.003, 'Acero', n=4, bisel=0.0007)
    empunadura(A, 'empunadura', 'Polimero', panel='Goma', ancho=0.0145, escala=0.88)
    prisma(A, 'martillo', [(-0.046, 0.050), (-0.040, 0.048), (-0.040, 0.066), (-0.050, 0.072, 0.003),
                           (-0.054, 0.068, 0.002)], -0.0045, 0.0045, 'Pavonado', n=4, bisel=0.0008)
    caja(A, 'retenD', (0.0140, 0.010, 0.026), (0.003, 0.016, 0.006), 'Pavonado', r=0.002)
    tornillo(A, 'pasD', (0.0135, 0.050, 0.020), 'x', 0.003, 0.001)
    tornillo(A, 'pasI', (-0.0135, 0.050, 0.020), 'x', 0.003, 0.001, signo=-1)
    # cañón (visible en la ventana y en la boca)
    caja(A, 'recamara', (0.002, 0.030, 0.062), (0.010, 0.040, 0.012), 'Acero', r=0.002)
    torno(A, 'boca', [(0.168, 0.0), (0.168, 0.0082), (0.179, 0.0082), (0.179, 0.0052), (0.172, 0.0052), (0.172, 0.0)],
          'Acero', centro=(0, zb), segs=20)
    # corredera con estrías, ventana de expulsión, miras y filete de rareza (pieza móvil)
    estrias = cortador(A, 'corredera',
                       cajas=espejo_x([((0.0140, -0.036 + 0.0062 * i, 0.054), (0.003, 0.0032, 0.028), 0.0, 'x')
                                       for i in range(6)]) +
                       espejo_x([((0.0140, 0.132 + 0.0062 * i, 0.056), (0.003, 0.0032, 0.024), 0.0, 'x')
                                 for i in range(4)]) +
                       [((0.004, 0.030, 0.074), (0.013, 0.042, 0.014), 0.002, 'z')])
    prisma(A, 'corredera', [(-0.044, 0.034), (0.172, 0.034), (0.176, 0.041, 0.002), (0.176, 0.064, 0.004),
                            (0.166, 0.074, 0.005), (-0.034, 0.074, 0.006), (-0.044, 0.064, 0.004)],
           -0.0130, 0.0130, 'Pavonado', bisel=0.0018, cortes=[estrias], grupo='corredera')
    caja(A, 'alza', (0, -0.030, 0.078), (0.022, 0.010, 0.009), 'Pavonado', r=0.002, grupo='corredera',
         cortes=[cortador(A, 'alza', cajas=[((0, -0.030, 0.082), (0.004, 0.02, 0.006), 0.0, 'z')])])
    caja(A, 'guion', (0, 0.160, 0.077), (0.005, 0.009, 0.007), 'Pavonado', r=0.0015, grupo='corredera')
    torno(A, 'guion_punto', [(0.1555, 0.0), (0.1555, 0.0016), (0.1560, 0.0016), (0.1560, 0.0)], 'Rareza',
          centro=(0, 0.0785), segs=10, bisel=0.0, grupo='corredera')
    filetes(A, 'filete', 0.070, 0.046, 0.100, 0.0131, alto=0.0026)
    for ob, g in A.piezas[-2:]:
        A.piezas[A.piezas.index((ob, g))] = (ob, 'corredera')
    # cargador: base visible abajo de la empuñadura y cuerpo escondido adentro (cae en la recarga)
    prisma(A, 'cargador', [(-0.014, -0.090), (-0.045, -0.093), (-0.029, 0.008), (-0.002, 0.008)], -0.0105, 0.0105,
           'AceroOscuro', n=0, bisel=0.0008, grupo='cargador')
    prisma(A, 'cargador_base', [(-0.008, -0.090), (-0.055, -0.094), (-0.057, -0.102, 0.003), (-0.006, -0.098, 0.003)],
           -0.0122, 0.0122, 'AceroOscuro', bisel=0.0012, grupo='cargador')
    A.punto('boca', (0, 0.179, zb))
    A.punto('mira', (0, -0.030, 0.080))
    return A, finalizar(A, {'corredera': (0, 0.060, 0.055), 'cargador': (0, -0.033, -0.05)})


def subfusil():
    A = Arma('subfusil')
    z = ANIMA
    corte = cortador(A, 'superior', cajas=[((0.0245, 0.060, 0.072), (0.012, 0.050, 0.020), 0.004, 'x'),
                                            ((-0.0255, 0.120, 0.080), (0.008, 0.100, 0.0065), 0.003, 'x')])
    prisma(A, 'superior', [(-0.024, 0.040), (0.024, 0.040), (0.024, 0.090, 0.003), (0.018, 0.100, 0.003),
                           (-0.018, 0.100, 0.003), (-0.024, 0.090, 0.003)], -0.062, 0.216, 'Grafito', eje='y',
           bisel=0.002, cortes=[corte])
    caja(A, 'cierre', (0.0170, 0.060, 0.072), (0.010, 0.046, 0.017), 'Acero', r=0.003)
    filetes(A, 'filete_sup', 0.075, 0.064, 0.200, 0.0242, alto=0.003)
    prisma(A, 'inferior', [(-0.062, 0.042), (0.140, 0.042), (0.140, 0.004, 0.004), (0.122, -0.004),
                           (0.122, -0.030, 0.003), (0.068, -0.030, 0.003), (0.068, -0.004), (0.0, -0.004),
                           (-0.030, 0.000, 0.01), (-0.062, 0.014, 0.012)], -0.020, 0.020, 'Polimero', bisel=0.002)
    caja(A, 'inferior_panelD', (0.0200, 0.096, 0.016), (0.0022, 0.040, 0.030), 'Polimero', r=0.005, bisel=0.0008)
    caja(A, 'inferior_panelI', (-0.0200, 0.096, 0.016), (0.0022, 0.040, 0.030), 'Polimero', r=0.005, bisel=0.0008)
    for y, zz in ((-0.040, 0.026), (0.128, 0.028)):
        tornillo(A, 'pasD%d' % int(y * 1000), (0.020, y, zz), 'x', 0.0032, 0.0011)
        tornillo(A, 'pasI%d' % int(y * 1000), (-0.020, y, zz), 'x', 0.0032, 0.0011, signo=-1)
    gatillo_y_guarda(A, 'Polimero')
    empunadura(A, 'empunadura', 'Polimero', panel='Goma')
    prisma(A, 'cargador', [(0.074, 0.030), (0.116, 0.030), (0.121, -0.168, 0.003), (0.079, -0.168, 0.003)],
           -0.0105, 0.0105, 'Polimero', bisel=0.0015, grupo='cargador')
    prisma(A, 'cargador_base', [(0.076, -0.164), (0.124, -0.164), (0.124, -0.176, 0.003), (0.077, -0.176, 0.003)],
           -0.0125, 0.0125, 'Grafito', bisel=0.0015, grupo='cargador')
    for sx in (1, -1):
        caja(A, 'cargador_ventana%d' % sx, (sx * 0.0105, 0.097, -0.080), (0.0012, 0.014, 0.110), 'Grafito', r=0.004,
             bisel=0.0, grupo='cargador')
    # guardamanos ventilado, cañón corto y compensador
    ven = []
    for i in range(3):
        ven += espejo_x([((0.025, 0.238 + 0.030 * i, 0.058), (0.012, 0.020, 0.012), 0.006, 'x')])
    ven += [((0, 0.238 + 0.030 * i, 0.086), (0.010, 0.020, 0.012), 0.005, 'z') for i in range(3)]
    sec = [(-0.020, 0.030, 0.006), (0.020, 0.030, 0.006), (0.025, 0.045, 0.004), (0.025, 0.086, 0.006),
           (-0.025, 0.086, 0.006), (-0.025, 0.045, 0.004)]
    prisma(A, 'guardamanos', sec, 0.216, 0.330, 'Polimero', eje='y', bisel=0.0022,
           cortes=[cortador(A, 'gm', cajas=ven)])
    torno(A, 'canon', [(0.320, 0.0), (0.320, 0.0110), (0.372, 0.0110), (0.372, 0.0)], 'Pavonado', centro=(0, z), segs=20)
    comp = cortador(A, 'comp', cajas=[((0, 0.382 + 0.014 * i, z + 0.02), (0.007, 0.007, 0.02), 0.003, 'z') for i in range(2)] +
                    [((0, 0.389, z), (0.05, 0.008, 0.007), 0.003, 'x')])
    torno(A, 'comp', [(0.366, 0.0), (0.366, 0.0145), (0.372, 0.0160), (0.415, 0.0160), (0.420, 0.0135), (0.420, 0.0060),
                      (0.408, 0.0060), (0.408, 0.0)], 'AceroOscuro', centro=(0, z), segs=24, cortes=[comp])
    riel(A, 'riel', -0.050, 0.322, 0.100)
    # mira réflex abierta
    caja(A, 'mira_base', (0, 0.040, 0.1135), (0.024, 0.044, 0.010), 'Polimero', r=0.002)
    prisma(A, 'mira', [(0.026, 0.118), (0.060, 0.118), (0.060, 0.150, 0.008), (0.054, 0.158, 0.006),
                       (0.030, 0.158, 0.006), (0.026, 0.150, 0.004)], -0.0145, 0.0145,
           'Polimero', bisel=0.0012, cortes=[cortador(A, 'mira', cajas=[((0, 0.045, 0.138), (0.022, 0.1, 0.024), 0.006, 'y')])])
    torno(A, 'mira_perilla', [(0.0145, 0.0), (0.0145, 0.005), (0.0185, 0.005), (0.0185, 0.0)], 'Grafito', eje='x',
          centro=(0.042, 0.124), segs=12, bisel=0.0)
    caja(A, 'mira_lente', (0, 0.051, 0.137), (0.023, 0.0015, 0.023), 'Lente', r=0.006, eje='y', bisel=0.0)
    torno(A, 'mira_punto', [(0.0498, 0.0), (0.0498, 0.0017), (0.0502, 0.0017), (0.0502, 0.0)], 'Rareza',
          centro=(0, 0.137), segs=10, bisel=0.0)
    # culata de alambre plegable (abierta) con cantonera
    caja(A, 'bisagra', (0, -0.068, 0.050), (0.042, 0.016, 0.070), 'Polimero', r=0.005)
    for sx in (1, -1):
        tubo(A, 'alambre%d' % sx, [(sx * 0.016, -0.070, 0.080), (sx * 0.016, -0.214, 0.082)], 0.0055, 'AceroOscuro',
             segs=10)
        tubo(A, 'alambreb%d' % sx, [(sx * 0.016, -0.070, 0.024), (sx * 0.016, -0.150, 0.030), (sx * 0.016, -0.214, 0.050)],
             0.0055, 'AceroOscuro', segs=10, paso=0.01)
    prisma(A, 'cantonera', [(-0.210, 0.096, 0.006), (-0.226, 0.096, 0.006), (-0.226, 0.000, 0.010),
                            (-0.210, 0.004, 0.006)], -0.024, 0.024, 'Polimero', bisel=0.0018)
    prisma(A, 'cantonera_goma', [(-0.2255, 0.094, 0.004), (-0.233, 0.093, 0.004), (-0.233, 0.003, 0.004),
                                 (-0.2255, 0.002, 0.004)], -0.0225, 0.0225, 'Goma', bisel=0.001)
    caja(A, 'manija', (-0.031, 0.165, 0.080), (0.016, 0.012, 0.008), 'Polimero', r=0.003, grupo='cerrojo')
    A.punto('boca', (0, 0.420, z))
    A.punto('mira', (0, 0.051, 0.137))
    A.punto('apoyo', (0, 0.26, 0.030))
    return A, finalizar(A, {'cargador': (0, 0.097, -0.01), 'cerrojo': (-0.031, 0.165, 0.080)})


def lanzacohetes():
    A = Arma('lanzacohetes')
    T = 0.120
    # tubo hueco (oliva) con tobera trasera de acero y aro delantero
    torno(A, 'tubo', [(-0.420, 0.0612), (0.598, 0.0612), (0.598, 0.0555), (-0.420, 0.0555)], 'Oliva',
          centro=(0, T), segs=40, cerrado=True, bisel=0.0015)
    torno(A, 'tobera', [(-0.496, 0.0745), (-0.470, 0.0690), (-0.418, 0.0645), (-0.418, 0.0575), (-0.470, 0.0625),
                        (-0.488, 0.0690)], 'Pavonado', centro=(0, T), segs=40, cerrado=True)
    torno(A, 'aro', [(0.578, 0.0605), (0.578, 0.0668), (0.616, 0.0668), (0.622, 0.0628), (0.622, 0.0560),
                     (0.578, 0.0560)], 'Polimero', centro=(0, T), segs=40, cerrado=True)
    for y in (-0.300, 0.300):
        torno(A, 'banda%d' % int(y * 1000), [(y - 0.016, 0.0606), (y - 0.016, 0.0650), (y + 0.016, 0.0650),
                                             (y + 0.016, 0.0606)], 'Polimero', centro=(0, T),
              segs=40, cerrado=True)
    torno(A, 'banda_rareza', [(0.448, 0.0606), (0.448, 0.0630), (0.460, 0.0630), (0.460, 0.0606)],
          'Rareza', centro=(0, T), segs=40, cerrado=True, bisel=0.0)
    prisma(A, 'hombrera', arco(0, T, 0.0608, 0.0700, 205, 335, 12), -0.230, -0.040, 'Goma', eje='y', n=0, bisel=0.002)
    # caja del disparador con empuñadura trasera y empuñadura delantera vertical
    prisma(A, 'caja', [(-0.055, 0.012, 0.006), (0.110, 0.012, 0.006), (0.110, 0.064), (-0.055, 0.064)], -0.018, 0.018,
           'Polimero', bisel=0.002)
    gatillo_y_guarda(A, 'Polimero')
    empunadura(A, 'empunadura', 'Polimero', panel='Goma')
    prisma(A, 'delantera', [(0.240, 0.064), (0.282, 0.064), (0.278, 0.030, 0.006), (0.283, 0.005, 0.008),
                            (0.276, -0.025, 0.008), (0.281, -0.055, 0.008), (0.274, -0.082, 0.008), (0.243, -0.085, 0.01),
                            (0.239, -0.040, 0.01), (0.242, 0.020, 0.006)], -0.0155, 0.0155, 'Polimero', bisel=0.0022)
    caja(A, 'abrazadera', (0, 0.261, 0.066), (0.036, 0.052, 0.012), 'Pavonado', r=0.004)
    # visor a la izquierda y asa de transporte
    caja(A, 'visor', (-0.074, 0.020, 0.142), (0.030, 0.110, 0.040), 'Polimero', r=0.007)
    caja(A, 'visor_lente', (-0.074, 0.0755, 0.142), (0.022, 0.002, 0.028), 'Lente', r=0.004, eje='y', bisel=0.0)
    caja(A, 'visor_ocular', (-0.074, -0.041, 0.142), (0.026, 0.014, 0.032), 'Goma', r=0.008, eje='y')
    caja(A, 'visor_brazo', (-0.055, 0.020, 0.142), (0.014, 0.044, 0.016), 'Pavonado', r=0.003)
    tubo(A, 'asa', [(0, -0.070, T + 0.058), (0, -0.060, T + 0.092), (0, 0.090, T + 0.092), (0, 0.100, T + 0.058)], 0.0075,
         'Polimero', segs=12, paso=0.01)
    # cohete (sale al disparar y vuelve en la recarga)
    torno(A, 'cohete', [(0.380, 0.0), (0.380, 0.050), (0.600, 0.050), (0.600, 0.0)], 'Ojiva', centro=(0, T), segs=32,
          bisel=0.0, grupo='cohete')
    torno(A, 'ojiva', [(0.598, 0.0), (0.598, 0.0520), (0.640, 0.0520), (0.643, 0.0500), (0.700, 0.0400),
                       (0.758, 0.0185), (0.782, 0.0070), (0.786, 0.0)], 'Ojiva', centro=(0, T), segs=32,
          grupo='cohete')
    torno(A, 'ojiva_banda', [(0.610, 0.0), (0.610, 0.0526), (0.624, 0.0526), (0.624, 0.0)], 'Pintura', centro=(0, T),
          segs=32, bisel=0.0, grupo='cohete')
    torno(A, 'ojiva_rareza', [(0.630, 0.0), (0.630, 0.0524), (0.635, 0.0524), (0.635, 0.0)], 'Rareza', centro=(0, T),
          segs=32, bisel=0.0, grupo='cohete')
    torno(A, 'espoleta', [(0.776, 0.0), (0.776, 0.0085), (0.792, 0.0062), (0.796, 0.0)], 'Laton', centro=(0, T), segs=16,
          bisel=0.0, grupo='cohete')
    A.punto('boca', (0, 0.620, T))
    A.punto('mira', (-0.074, -0.048, 0.142))
    A.punto('apoyo', (0, 0.26, 0.0))
    return A, finalizar(A, {'cohete': (0, 0.600, T)})


def pico():
    A = Arma('pico')
    H = 0.600
    # mango de madera con cinta en espiral, pomo de acero y virola
    torno(A, 'mango', [(-0.110, 0.0), (-0.110, 0.0185), (0.0, 0.0200), (0.30, 0.0195), (0.50, 0.0210), (H + 0.03, 0.0210),
                       (H + 0.03, 0.0)], 'MaderaClara', eje='z', segs=20, bisel=0.0)
    torno(A, 'pomo', [(-0.155, 0.0), (-0.155, 0.019), (-0.150, 0.027), (-0.130, 0.029), (-0.117, 0.023), (-0.108, 0.021),
                      (-0.108, 0.0)], 'Pavonado', eje='z', segs=24)
    vueltas, n = 14, 20
    cam = [(0.0212 * math.cos(2 * math.pi * k / n), 0.0212 * math.sin(2 * math.pi * k / n), -0.100 + 0.215 * k / (vueltas * n))
           for k in range(vueltas * n + 1)]
    barrido(A, 'cinta', cam, [rect(0.0068, 0.0012)] * len(cam), 'Cinta', bisel=0.0, arriba=(0, 0, 1))
    torno(A, 'virola', [(H - 0.100, 0.0), (H - 0.100, 0.0235), (H - 0.086, 0.0250), (H - 0.056, 0.0250), (H - 0.056, 0.0)],
          'Pavonado', eje='z', segs=24)
    # cabeza: bloque, púa curva hacia adelante (+Y) y azuela hacia atrás
    caja(A, 'cabeza', (0, 0, H), (0.058, 0.084, 0.118), 'Pavonado', r=0.014)
    caja(A, 'cabeza_banda', (0, 0, H - 0.044), (0.0595, 0.0855, 0.012), 'Pintura', r=0.014, bisel=0.0008)
    for sx in (1, -1):
        tornillo(A, 'remache%d' % sx, (sx * 0.029, 0.0, H + 0.020), 'x', 0.0070, 0.0022, signo=sx)
        tornillo(A, 'remacheb%d' % sx, (sx * 0.029, 0.0, H - 0.014), 'x', 0.0070, 0.0022, signo=sx)
    barrido(A, 'pua', [(0, 0.030, H + 0.014), (0, 0.120, H + 0.010), (0, 0.215, H - 0.008), (0, 0.300, H - 0.044),
                       (0, 0.365, H - 0.090)],
            [rombo(0.026, 0.038), rombo(0.022, 0.032), rombo(0.016, 0.023), rombo(0.009, 0.013), None], 'Acero',
            bisel=0.002)
    barrido(A, 'azuela', [(0, -0.030, H + 0.012), (0, -0.100, H + 0.008), (0, -0.165, H - 0.008), (0, -0.215, H - 0.034)],
            [rect(0.026, 0.035), rect(0.027, 0.028), rect(0.030, 0.017), rect(0.033, 0.005)], 'Acero', bisel=0.002)
    return A, finalizar(A, {})


MODELOS = {'rifle': rifle, 'escopeta': escopeta, 'francotirador': francotirador, 'pistola': pistola,
           'subfusil': subfusil, 'lanzacohetes': lanzacohetes, 'pico': pico}


def hacer(nombre):
    A, info = MODELOS[nombre]()
    return info
