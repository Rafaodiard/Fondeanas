// Diseño de la isla de Salto Final: pueblos, rutas, río y lugares chicos entre pueblos.
// Es un mapa fijo (como en los battle royale), así todos aprenden sus lugares.
// Coordenadas del mundo: X hacia el este, Z hacia el sur (en el minimapa el norte queda arriba).
// rot: 0 = el frente mira al sur (+Z), 1 = al este (+X), 2 = al norte (-Z), 3 = al oeste (-X).

// Cada ítem de un pueblo: [plano, opciones, x local, z local, rot, extra]
// extra: { pad: false } no aplana el terreno; { y } fija la altura de la base; { dy } la sube.

export const PUEBLOS = [
  {
    id: 'altoplaza', name: 'Altoplaza', x: 0, z: 20, r: 78, h: 12, tema: 'ciudad',
    calles: [
      { p: [[-80, 0], [80, 0]], w: 9, m: 'asfalto' },
      { p: [[0, -80], [0, 80]], w: 9, m: 'asfalto' },
      { p: [[-13, 0], [13, 0]], w: 26, m: 'vereda' },
    ],
    items: [
      ['cartel', { text: 'Altoplaza' }, -74, 9, 3], ['cartel', { text: 'Altoplaza' }, 9, 74, 0], ['cartel', { text: 'Altoplaza' }, 74, -9, 1], ['cartel', { text: 'Altoplaza' }, -9, -74, 2],
      ['banco', {}, -9, -8, 0], ['banco', {}, 9, -8, 0], ['banco', {}, -9, 8, 2], ['banco', {}, 9, 8, 2],
      ['cantero', { w: 4 }, -5, -10.5, 0], ['cantero', { w: 4 }, 5, -10.5, 0], ['cantero', { w: 4 }, -5, 10.5, 0], ['cantero', { w: 4 }, 5, 10.5, 0],
      ['tacho', {}, -13, 6, 0], ['tacho', { m: 'azul' }, 13, -6, 0], ['tacho', {}, -40, -6.5, 0], ['tacho', {}, 40, 6.5, 0], ['tacho', { m: 'azul' }, 6.5, -40, 0],
      ['hidrante', {}, -27, 6.3, 0], ['hidrante', {}, 27, -6.3, 0], ['hidrante', {}, -6.3, 50, 0],
      ['arbol', { s: 0.75 }, -28, -8.6, 0], ['arbol', { s: 0.75 }, 28, -8.6, 0], ['arbol', { s: 0.75 }, -28, 8.6, 0], ['arbol', { s: 0.75 }, 28, 8.6, 0],
      ['arbol', { s: 0.75 }, -8.6, -48, 0], ['arbol', { s: 0.75 }, 8.6, 48, 0], ['arbol', { s: 0.8 }, -62, -8.6, 0], ['arbol', { s: 0.8 }, 62, 8.6, 0],
      ['fuente', {}, 0, 0, 0],
      ['edificio', { pisos: 3, pared: 'ladrillo', toldo: 'lona_roja', letrero: 'amarillo' }, -20, -17, 0],
      ['edificio', { pisos: 4, pared: 'crema', toldo: 'lona_azul', letrero: 'rojo', w: 12 }, -36, -17, 0],
      ['local', { pared: 'celeste', toldo: 'lona_amarilla', letrero: 'azul', cofre: true }, -54, -15, 0],
      ['edificio', { pisos: 2, pared: 'salmon', toldo: 'lona_verde', letrero: 'blanco_puro' }, -17, -38, 1],
      ['edificio', { pisos: 4, pared: 'amarillo', toldo: 'lona_verde', letrero: 'azul', marco: 'blanco_puro' }, 20, -17, 0],
      ['edificio', { pisos: 2, pared: 'verdeagua', toldo: 'lona_roja', letrero: 'naranja' }, 36, -17, 0],
      ['local', { pared: 'rosa', toldo: 'lona_azul', letrero: 'blanco_puro' }, 54, -15, 0],
      ['edificio', { pisos: 3, pared: 'ladrillo2', toldo: null, letrero: null, vidriera: false }, 17, -38, 3],
      ['edificio', { pisos: 3, pared: 'lila', toldo: 'lona_amarilla', letrero: 'rojo' }, -20, 17, 2],
      ['edificio', { pisos: 2, pared: 'durazno', toldo: 'lona_roja', letrero: 'verde' }, -36, 17, 2],
      ['local', { pared: 'blanco', toldo: 'lona_roja', letrero: 'amarillo', cofre: true }, -54, 15, 2],
      ['edificio', { pisos: 4, pared: 'hormigon', toldo: null, letrero: null, vidriera: false, marco: 'metal_osc' }, -17, 38, 1],
      ['edificio', { pisos: 2, pared: 'celeste', toldo: 'lona_blanca', letrero: 'rojo' }, 20, 17, 2],
      ['edificio', { pisos: 3, pared: 'ladrillo', toldo: 'lona_verde', letrero: 'amarillo' }, 36, 17, 2],
      ['local', { pared: 'menta', toldo: 'lona_roja', letrero: 'azul' }, 54, 15, 2],
      ['edificio', { pisos: 3, pared: 'crema', toldo: 'lona_azul', letrero: 'rojo' }, 17, 38, 3],
      ['local', { pared: 'amarillo', toldo: 'lona_verde', letrero: 'rojo' }, -15, -57, 1],
      ['local', { pared: 'blanco', toldo: 'lona_azul', letrero: 'verde', cofre: true }, 15, -57, 3],
      ['casa', { pisos: 2, pared: 'rosa', techo: 'techo_gris' }, -16, 58, 1],
      ['local', { pared: 'salmon', toldo: 'lona_amarilla', letrero: 'blanco_puro' }, 15, 57, 3],
      ['parada', {}, 7.5, -28, 3], ['parada', { m: 'rojo' }, -7.5, 28, 1],
      ['farol', {}, -12, -6, 0], ['farol', {}, 12, -6, 0], ['farol', {}, -12, 6, 2], ['farol', {}, 12, 6, 2],
      ['farol', {}, -45, -6, 0], ['farol', {}, 45, 6, 2], ['farol', {}, -6, 45, 1], ['farol', {}, 6, -45, 3],
      ['auto', { m: 'rojo' }, -30, 2.4, 1], ['auto', { m: 'azul' }, 42, -2.4, 3], ['auto', { m: 'amarillo' }, 2.4, 48, 0], ['auto', { m: 'blanco_puro' }, -2.4, -62, 2],
    ],
  },
  {
    id: 'villa', name: 'Villa Cardo', x: -365, z: -20, r: 72, h: 10, tema: 'barrio',
    calles: [
      { p: [[-66, 0], [74, 0]], w: 7, m: 'asfalto', ini: { r: 7.5 } }, // al oeste termina en una rotonda (calle sin salida)
      { p: [[-26, -62], [-26, 62]], w: 6, m: 'asfalto' },
      { p: [[26, -62], [26, 62]], w: 6, m: 'asfalto' },
      { p: [[-26, -62], [26, -62]], w: 6, m: 'asfalto' }, // las dos calles cruzadas se cierran en un rectángulo
      { p: [[-26, 62], [26, 62]], w: 6, m: 'asfalto' },
    ],
    items: [
      ['cartel', { text: 'Villa Cardo' }, 70, 7, 1], ['cartel', { text: 'Villa Cardo' }, 23, 72, 0],
      ['arbol', {}, -30, -28, 0], ['arbol', {}, 30, 28, 0], ['arbol', { s: 1.1 }, -62, 30, 0], ['arbol', {}, 62, -30, 0], ['pino', {}, 0, 30, 0], ['arbol', { s: 0.9 }, -50, -28, 0], ['arbol', { s: 0.9 }, 50, 28, 0],
      ['hidrante', {}, -20, 4.5, 0], ['hidrante', {}, 20, -4.5, 0], ['tacho', {}, -36, 4.5, 0], ['tacho', { m: 'azul' }, 36, -4.5, 0],
      ['banco', {}, -55, 55, 1],
      ['casa', { pisos: 2, w: 10, d: 8, pared: 'celeste', techo: 'techo_azul', porche: true , jardin: 2.4 }, -50, -13, 0],
      ['casa', { pisos: 1, pared: 'amarillo', techo: 'techo_rojo', var: 1 , jardin: 2.4 }, -10, -13, 0],
      ['casa', { pisos: 2, pared: 'blanco', techo: 'techo_verde' , jardin: 2.4 }, 10, -13, 0],
      ['casa', { pisos: 1, w: 10, pared: 'salmon', techo: 'techo_gris', porche: true , jardin: 2.4 }, 50, -13, 0],
      ['casa', { pisos: 1, pared: 'rosa', techo: 'techo_marron' , jardin: 2.4 }, -50, 13, 2],
      ['casa', { pisos: 2, pared: 'menta', techo: 'techo_rojo', var: 1 , jardin: 2.4 }, -10, 13, 2],
      ['casa', { pisos: 1, pared: 'lila', techo: 'techo_azul', porche: true , jardin: 2.4 }, 10, 13, 2],
      ['casa', { pisos: 2, w: 10, pared: 'durazno', techo: 'techo_terracota' , jardin: 2.4 }, 50, 13, 2],
      ['casa', { pisos: 1, pared: 'verdeagua', techo: 'techo_gris' }, -39, -40, 1],
      ['casa', { pisos: 2, pared: 'crema', techo: 'techo_rojo' }, -39, 40, 1],
      ['casa', { pisos: 1, pared: 'celeste', techo: 'techo_negro', var: 1 }, -13, 40, 3],
      ['cobertizo', { pared: 'blanco', techo: 'techo_gris' }, -13, -40, 3],
      ['casa', { pisos: 2, pared: 'amarillo', techo: 'techo_azul' }, 39, -40, 3],
      ['casa', { pisos: 1, pared: 'blanco', techo: 'techo_verde', var: 1 }, 39, 40, 3],
      ['casa', { pisos: 1, pared: 'rosa', techo: 'techo_rojo' }, 13, -40, 1],
      ['cobertizo', { pared: 'madera2', techo: 'chapa', cofre: true }, 13, 40, 1],
      ['cobertizo', { pared: 'blanco', techo: 'chapa_roja', abierto: true }, -64, -14, 0],
      ['cobertizo', { pared: 'celeste', techo: 'chapa', abierto: true }, 64, 14, 2],
      ['local', { pared: 'blanco', toldo: 'lona_roja', letrero: 'verde', cofre: true }, 0, -45, 0],
      ['cerca', { L: 10 }, -45, -4.5, 0], ['cerca', { L: 10 }, 5, -4.5, 0], ['cerca', { L: 8 }, -53, 4.5, 0], ['cerca', { L: 10 }, 45, 4.5, 0],
      ['farol', {}, -30, -4, 0], ['farol', {}, 30, 4, 2], ['farol', {}, -22, 30, 1], ['farol', {}, 22, -30, 3],
      ['auto', { m: 'verde' }, -50, -4.2, 1], ['auto', { m: 'azul' }, 28.5, 30, 0], ['auto', { m: 'blanco_puro' }, 10, 4.2, 3],
      ['fogon', {}, -55, 45, 0],
    ],
  },
  {
    id: 'puerto', name: 'Puerto Bruma', x: -40, z: 410, r: 78, h: 2.6, tema: 'puerto', corte: 20,
    calles: [
      { p: [[0, -80], [0, 4]], w: 8, m: 'asfalto' },
      { p: [[-75, 4], [75, 4]], w: 8, m: 'asfalto' },
      { p: [[-75, 4], [-75, -26], [75, -26], [75, 4]], w: 6, m: 'asfalto' }, // la calle de atrás vuelve a la costanera por los dos lados
    ],
    items: [
      ['cartel', { text: 'Puerto Bruma', fondo: 'azul' }, 7, -72, 2], ['cartel', { text: 'Puerto Bruma', fondo: 'azul' }, 82, -8, 1],
      ['banco', {}, -10, 10, 2], ['banco', {}, 55, 10, 2], ['tacho', { m: 'azul' }, -26, 9.5, 0], ['hidrante', {}, 10, -2.5, 0],
      ['arbol', { s: 0.8 }, -66, -44, 0], ['arbol', { s: 0.8 }, 66, -44, 0], ['pino', {}, 10, -50, 0],
      ['malecon', { L: 130 }, -10, 18, 0],
      ['galpon', { w: 18, d: 12, pared: 'chapa_azul' }, -42, -9.5, 0],
      ['galpon', { w: 16, d: 12, pared: 'chapa_roja', techo: 'chapa' }, -16, -9.5, 0],
      ['galpon', { w: 18, d: 12, pared: 'chapa_verde', cofre: true }, 20, -9.5, 0],
      ['contenedor', { m: 'chapa_roja' }, 44, -12, 0], ['contenedor', { m: 'chapa_azul', abierto: false }, 44, -9, 0],
      ['contenedor', { m: 'chapa_verde', abierto: false }, 44, -12, 0, { dy: 2.7 }], ['contenedor', { m: 'naranja' }, 53, -10, 1],
      ['contenedor', { m: 'chapa_azul' }, 60, -12, 0], ['contenedor', { m: 'chapa_roja', abierto: false }, 60, -12, 0, { dy: 2.7 }],
      ['grua', {}, 0, 11, 0],
      ['muelle', { L: 30, y: 2.65, bote: false }, -58, 22, 0, { pad: false, y: 0 }],
      ['muelle', { L: 24, y: 2.65, bote: true }, -28, 22, 0, { pad: false, y: 0 }],
      ['muelle', { L: 30, y: 2.65, bote: true }, 28, 22, 0, { pad: false, y: 0 }],
      ['faro', { cofre: true }, 66, 15.5, 0],
      ['puesto', { lona: 'lona_azul' }, -60, 11, 0], ['puesto', { lona: 'lona_blanca' }, -50, 11, 0], ['puesto', { lona: 'lona_roja' }, -40, 11, 0],
      ['casa', { pisos: 1, pared: 'celeste', techo: 'techo_azul' }, -55, -40, 0],
      ['casa', { pisos: 1, pared: 'blanco', techo: 'techo_rojo', var: 1 }, -35, -40, 0],
      ['casa', { pisos: 2, pared: 'amarillo', techo: 'techo_azul' }, 30, -40, 0],
      ['local', { pared: 'blanco', toldo: 'lona_azul', letrero: 'azul', cofre: true }, 50, -40, 0],
      ['casa', { pisos: 2, pared: 'verdeagua', techo: 'techo_gris' }, -16, -42, 1],
      ['caja3', {}, 8, 16, 0], ['caja3', {}, -8, -1, 0], ['barriles', {}, 36, 13, 0],
      ['farol', {}, -20, 10, 0], ['farol', {}, 15, 10, 0], ['farol', {}, 45, 10, 0],
      ['bote', { m: 'blanco', m2: 'rojo' }, -78, 38, 0, { pad: false, y: -0.1 }],
      ['bote', { m: 'amarillo', m2: 'azul' }, 50, 45, 1, { pad: false, y: -0.1 }],
    ],
  },
  {
    id: 'granja', name: 'Granja Los Álamos', x: 295, z: -165, r: 78, h: 15, tema: 'granja',
    calles: [
      { p: [[-78, 6], [78, 6]], w: 5, m: 'tierra' },
      { p: [[-6, 6], [-6, -9.6]], w: 5, m: 'tierra', fin: 'puerta' }, // hasta la puerta del granero
    ],
    items: [
      ['cartel', { text: 'Granja Los Álamos', w: 6 }, -72, 12, 3],
      ['alamo', { s: 1.1 }, -64, -40, 0], ['alamo', { s: 1.1 }, -56, -40, 0], ['alamo', { s: 1.1 }, -48, -40, 0], ['alamo', { s: 1.1 }, -40, -40, 0], ['alamo', { s: 1.1 }, -32, -40, 0],
      ['alamo', { s: 1.1 }, 40, -52, 0], ['alamo', { s: 1.1 }, 48, -52, 0], ['alamo', { s: 1.1 }, 56, -52, 0], ['alamo', { s: 1.1 }, 64, -52, 0],
      ['arbol', { s: 1.2 }, -40, 4, 0], ['banco', {}, -30, -5, 0],
      ['granero', { cofre: true }, -2, -18, 0],
      ['silo', {}, 17, -24, 0], ['silo', { techo: 'chapa' }, 25, -14, 0],
      ['casa', { pisos: 2, pared: 'blanco', techo: 'techo_verde', porche: true }, -32, -16, 0],
      ['molino', {}, -48, 30, 0],
      ['cobertizo', { pared: 'ladrillo', techo: 'chapa', abierto: true, cofre: true }, 24, 20, 2],
      ['tractor', {}, 10, 16, 1],
      ['tanqueAgua', { tanque: 'blanco' }, -18, 24, 0],
      ['campo', { w: 34, d: 22, m: 'heno' }, 38, 46, 0],
      ['campo', { w: 30, d: 20, m: 'hoja' }, -5, 48, 0],
      ['campo', { w: 22, d: 30, m: 'hoja' }, 55, -30, 1],
      ['cerca', { L: 36, m: 'madera2' }, 20, 34, 0], ['cerca', { L: 36, m: 'madera2' }, 20, 58, 0],
      ['cerca', { L: 30, m: 'madera2' }, -20, 37, 0],
      ['barriles', {}, -12, -10, 0], ['caja3', {}, 12, -6, 0],
      ['auto', { m: 'celeste' }, -40, 2, 0],
    ],
  },
  {
    id: 'medanos', name: 'Médanos', x: 375, z: 130, r: 72, h: 7, tema: 'desierto',
    calles: [
      { p: [[-74, 0], [58, 0]], w: 6, m: 'tierra', fin: { r: 7 } }, // al este termina en un playón
      { p: [[0, -60], [0, 70]], w: 5, m: 'tierra' },
      { p: [[-10, 0], [10, 0]], w: 22, m: 'arena' },
    ],
    items: [
      ['cartel', { text: 'Médanos', fondo: 'naranja' }, -72, 7, 3], ['cartel', { text: 'Médanos', fondo: 'naranja' }, 7, 66, 0],
      ['banco', {}, 0, -12, 0], ['banco', {}, 0, 13, 2], ['barriles', {}, 30, -6, 0],
      ['puesto', { lona: 'lona_roja' }, -6, -5, 0], ['puesto', { lona: 'lona_amarilla' }, 6, -5, 0],
      ['puesto', { lona: 'lona_azul' }, -6, 6, 2], ['puesto', { lona: 'lona_verde' }, 6, 6, 2],
      ['adobe', { pisos: 2, pared: 'adobe' }, -24, -9.5, 0],
      ['adobe', { pisos: 1, pared: 'adobe3', toldo: 'lona_roja' }, 24, 9.5, 2],
      ['adobe', { pisos: 1, pared: 'adobe2' }, -12, -24, 0],
      ['adobe', { pisos: 2, pared: 'adobe', toldo: 'lona_azul' }, 13, -24, 0],
      ['adobe', { pisos: 1, pared: 'adobe3' }, -12, 25, 2],
      ['adobe', { pisos: 2, pared: 'adobe2', toldo: 'lona_verde' }, 13, 25, 2],
      ['adobe', { pisos: 1, pared: 'adobe' }, -42, 20, 1],
      ['adobe', { pisos: 2, pared: 'adobe3' }, 42, -22, 3],
      ['adobe', { pisos: 1, pared: 'adobe2', toldo: 'lona_roja' }, 42, 24, 3],
      ['adobe', { pisos: 1, pared: 'adobe' }, -42, -22, 1],
      ['local', { pared: 'adobe3', toldo: 'lona_roja', letrero: 'naranja', techo: 'adobe2', cofre: true }, -9.5, -45, 1],
      ['tanqueAgua', { tanque: 'oxido' }, 30, 48, 0],
      ['barriles', {}, -20, 12, 0], ['caja3', {}, 20, -12, 0],
      ['auto', { m: 'oxido' }, -55, 3, 1],
    ],
  },
  {
    id: 'parque', name: 'Parque Remolino', x: 175, z: 330, r: 78, h: 9, tema: 'parque',
    calles: [
      { p: [[0, -80], [0, 70]], w: 7, m: 'vereda' },
      { p: [[-58, 8], [70, 8]], w: 6, m: 'vereda', ini: { r: 6 } }, // al oeste termina en una plazoleta con banco
    ],
    items: [
      ['cartel', { text: 'Parque Remolino', fondo: 'rojo' }, -9, -72, 2],
      ['banco', {}, -10, 2, 0], ['banco', {}, 10, 2, 0], ['banco', {}, -10, 14, 2], ['banco', {}, 10, 14, 2],
      ['tacho', { m: 'rojo' }, 5, 3, 0], ['tacho', { m: 'rojo' }, -5, 13, 0],
      ['cantero', { w: 5 }, -14, -40, 1], ['cantero', { w: 5 }, 14, -40, 1],
      ['arbol', {}, -60, 40, 0], ['arbol', {}, 60, 40, 0], ['arbol', { s: 1.1 }, -60, -10, 0], ['pino', {}, 62, -20, 0], ['arbol', {}, -20, 60, 0], ['arbol', {}, 25, 62, 0],
      ['arco', {}, 0, -62, 0],
      ['rueda', {}, 30, -16, 0],
      ['calesita', { cofre: true }, -30, -14, 0],
      ['kiosco', { m: 'rosa', lona: 'lona_roja' }, -14, 26, 2],
      ['kiosco', { m: 'celeste', lona: 'lona_azul' }, 14, 26, 2],
      ['kiosco', { m: 'amarillo', lona: 'lona_verde' }, 44, 22, 3],
      ['kiosco', { m: 'menta', lona: 'lona_amarilla' }, -44, 22, 1],
      ['montanaRusa', {}, 0, 48, 0],
      ['local', { pared: 'lila', toldo: 'lona_roja', letrero: 'neon_rosa', cofre: true }, -50, -40, 0],
      ['local', { pared: 'amarillo', toldo: 'lona_azul', letrero: 'rojo' }, 52, -42, 0],
      ['farol', {}, -5, -30, 1], ['farol', {}, 5, -10, 3], ['farol', {}, -5, 15, 1], ['farol', {}, 25, 12, 2], ['farol', {}, -25, 12, 2],
      ['caja3', {}, 60, 0, 0],
      ['banco', {}, -58, 16, 2],
    ],
  },
  {
    id: 'cienaga', name: 'Palafitos', x: -335, z: 285, r: 72, h: -0.25, tema: 'cienaga', ruido: 1.1,
    calles: [],
    items: [
      ['cartel', { text: 'Palafitos', fondo: 'madera' }, 6, -62, 2],
      ['palafito', { w: 9, d: 7, techo: 'techo_verde', cofre: true }, 0, -4, 0, { pad: false }],
      ['palafito', { pared: 'madera', techo: 'techo_marron' }, -24, -12, 1, { pad: false }],
      ['palafito', { pared: 'madera2', techo: 'techo_verde' }, 24, -14, 3, { pad: false }],
      ['palafito', { pared: 'madera', techo: 'techo_rojo' }, -12, 26, 2, { pad: false }],
      ['palafito', { pared: 'madera2', techo: 'techo_marron', cofre: false }, 20, 24, 2, { pad: false }],
      ['palafito', { pared: 'madera_osc', techo: 'techo_verde' }, -40, 24, 1, { pad: false }],
      ['pasarela', { L: 16, y: 0.9 }, 0, 6, 0, { pad: false }],
      ['pasarela', { L: 14, y: 0.9 }, -8, -12, 3, { pad: false }],
      ['pasarela', { L: 14, y: 0.9 }, 8, -12, 1, { pad: false }],
      ['pasarela', { L: 18, y: 0.9 }, -30, 10, 1, { pad: false }],
      ['torreVigia', { h: 9 }, 0, -40, 0],
      ['bote', { m: 'madera2', m2: 'verde' }, 34, 40, 1, { pad: false, y: -0.4 }],
      ['bote', { m: 'madera', m2: 'rojo' }, -45, -30, 0, { pad: false, y: -0.4 }],
      ['fogon', {}, 40, -40, 0],
    ],
  },
  {
    id: 'cantera', name: 'Cantera Roja', x: -95, z: -205, etiqueta: [15, 55], r: 80, h: 27, tema: 'cantera', pozo: { r: 38, prof: 14 },
    calles: [
      { p: [[0, -52], [-12, -32], [-16, -14], [-2, -2]], w: 6, m: 'tierra', fin: { r: 5 }, suave: true }, // rampa al fondo del pozo: termina en el playón de carga
      { p: [[-77.5, 50], [56, 50]], w: 5, m: 'tierra', fin: { r: 8 } }, // del camino de Villa Cardo a un playón de maniobras
    ],
    items: [
      ['cartel', { text: 'Cantera Roja', fondo: 'rojo' }, 7, 72, 0], ['cartel', { text: 'Cantera Roja', fondo: 'rojo' }, 7, -76, 2],
      ['tolva', {}, 10, 0, 1],
      ['andamio', { h: 8 }, -4, 20, 0],
      ['contenedor', { m: 'amarillo_seg' }, -10, 6, 1], ['contenedor', { m: 'chapa_roja', abierto: false }, 18, 18, 0],
      ['caja3', {}, 4, -10, 0], ['barriles', {}, -2, 10, 0],
      ['galpon', { w: 16, d: 11, pared: 'chapa_roja', techo: 'oxido', cofre: true }, -50, -40, 1],
      ['local', { pared: 'blanco', toldo: null, letrero: 'amarillo_seg', techo: 'hormigon2' }, -59, 27, 1],
      ['cobertizo', { pared: 'oxido', techo: 'chapa' }, 46, -40, 3],
      ['cobertizo', { pared: 'chapa', techo: 'chapa_roja', cofre: true }, 54, 22, 3],
      ['contenedor', { m: 'chapa_azul' }, 30, 58, 0], ['contenedor', { m: 'naranja' }, -30, 60, 0],
      ['tractor', {}, 40, 0, 0],
    ],
  },
  {
    id: 'refugio', name: 'Refugio Nevado', x: -238, z: -212, etiqueta: [-15, -58], r: 56, h: 'auto', hOff: 1, borde: 70, tema: 'nieve',
    calles: [{ p: [[58, 10], [0, 12], [-56, 12]], w: 5, m: 'nieve', fin: { r: 7 } }],
    items: [
      ['cartel', { text: 'Refugio Nevado', fondo: 'azul' }, 54, 17, 1], ['pino', { s: 1.2 }, -10, 35, 0], ['pino', {}, 15, 38, 0], ['pino', { s: 1.3 }, -40, 30, 0], ['pino', {}, 42, 32, 0], ['banco', {}, 5, 30, 0],
      ['lodge', { cofre: true }, 0, -10, 0],
      ['cabana', { techo: 'techo_marron' }, -27, 20, 1],
      ['cabana', { techo: 'techo_rojo', cofre: false }, 28, 22, 3],
      ['cabana', { techo: 'techo_verde' }, -26, -32, 0],
      ['cabana', { techo: 'techo_negro', cofre: false }, 26, -30, 0],
      ['cobertizo', { pared: 'tronco', techo: 'techo_marron', cofre: true }, -45, -5, 1],
      ['fogon', {}, 0, 26, 0],
    ],
  },
  {
    id: 'observatorio', name: 'Observatorio Cumbre', x: 150, z: -385, r: 62, h: 52, tema: 'ciencia',
    calles: [
      { p: [[62, 30], [0, 22], [-52, 29]], w: 5, m: 'asfalto', fin: { r: 7 } }, // al oeste, estacionamiento
      { p: [[0, 22], [0, 2]], w: 5, m: 'asfalto', fin: 'puerta' }, // hasta la puerta de la cúpula
    ],
    items: [
      ['cartel', { text: 'Observatorio Cumbre', fondo: 'azul', w: 6 }, 56, 36, 1], ['banco', {}, 0, 34, 2],
      ['cupula', { cofre: true }, 0, -8, 0],
      ['laboratorio', { cofre: true }, -30, 8, 1],
      ['laboratorio', { w: 12, d: 9, cofre: false }, 30, 8, 3],
      ['antena', { h: 30 }, 32, -30, 0],
      ['tanqueAgua', { tanque: 'blanco' }, -30, -30, 0],
      ['cobertizo', { pared: 'blanco', techo: 'chapa' }, -12, 40, 2],
      ['auto', { m: 'blanco_puro' }, 14, 26, 1],
    ],
  },
];

// Rutas entre pueblos (puntos del mundo). w = ancho, m = material.
// Cada punta de una ruta o de una calle tiene que llegar a otra calle o terminar en un remate (ini/fin):
// { r } = plazoleta redonda, 'puerta' = llega hasta la puerta de una estructura. Lo revisa tools/mapa/caminos.mjs.
export const RUTAS = [
  { p: [[-80, 20], [-130, 10], [-165, 0], [-210, 0], [-260, -14], [-292, -20]], w: 8, m: 'asfalto' },
  { p: [[0, 100], [-8, 180], [-25, 260], [-38, 330]], w: 8, m: 'asfalto' },
  { p: [[80, 20], [150, 50], [230, 100], [300, 130]], w: 8, m: 'asfalto' },
  { p: [[0, -60], [90, -100], [170, -140], [218, -159]], w: 8, m: 'asfalto' },
  { p: [[0, -60], [-40, -100], [-80, -120], [-95, -135], [-95, -155]], w: 7, m: 'asfalto' },
  { p: [[375, 200], [330, 260], [270, 300], [245, 338]], w: 7, m: 'asfalto' },
  { p: [[175, 400], [120, 430], [60, 420], [35, 414]], w: 7, m: 'asfalto' },
  { p: [[278, -159], [280, -200], [268, -250], [240, -305], [212, -355]], w: 5, m: 'tierra' }, // sale de la calle de la granja
  { p: [[-180, -202], [-160, -215], [-130, -238], [-108, -252], [-95, -257]], w: 5, m: 'tierra' }, // del Refugio a la rampa de la cantera
  { p: [[-350, 42], [-345, 140], [-338, 213]], w: 5, m: 'tierra', fin: { r: 6 } }, // termina a la orilla de la ciénaga
  { p: [[-115, 412], [-190, 380], [-262, 320]], w: 5, m: 'tierra', fin: { r: 6 } },
  { p: [[373, -159], [380, -110], [365, -40], [362, 10], [375, 70]], w: 6, m: 'asfalto' },
  { p: [[-375, -82], [-330, -140], [-260, -140], [-225, -140], [-175, -150], [-178, -185], [-180, -202]], w: 5, m: 'tierra' },
  { p: [[-142, 7], [-140, 40], [-146, 75], [-150, 110], [-142, 150], [-110, 190], [-60, 230], [-25, 260]], w: 4, m: 'tierra' }, // pasa por la capilla
  { p: [[90, 230], [130, 230], [175, 250]], w: 4, m: 'tierra', ini: { r: 6 } }, // empieza en el camping
];

// Teleférico: del Refugio Nevado a la cumbre de la montaña (torres en orden, de abajo hacia arriba).
export const TELEFERICO = [[-232, -259], [-260, -288], [-290, -318]];

// Río: baja de la montaña y desemboca en la ciénaga.
export const RIO = { p: [[-196, -168], [-192, -140], [-180, -80], [-185, 0], [-205, 90], [-250, 170], [-300, 235]], w: 9 };

// Lugares chicos entre pueblos: [plano, opciones, x, z, rot, extra]
export const SUELTOS = [
  ['estacion', {}, 173, 85, 2],
  ['torreVigia', {}, -135, 140, 0], ['torreVigia', {}, 105, -235, 1], ['torreVigia', {}, -70, 300, 0], ['torreVigia', {}, 260, 30, 3],
  ['capilla', {}, -160, 75, 1],
  ['carpa', { m: 'lona_naranja' }, 70, 225, 0], ['carpa', { m: 'lona_verde' }, 78, 233, 1], ['carpa', { m: 'lona_azul' }, 64, 236, 3], ['fogon', {}, 70, 234, 0],
  ['parada', {}, -120, 18, 2], ['parada', { m: 'verde' }, 100, -88, 0], ['parada', { m: 'rojo' }, -18, 220, 1],
  ['cobertizo', { cofre: true }, 240, 60, 1], ['cobertizo', {}, -250, 60, 0], ['cobertizo', { pared: 'ladrillo', cofre: true }, 95, 165, 3],
  ['cobertizo', { pared: 'madera_osc' }, -130, 330, 0], ['cobertizo', { pared: 'chapa' }, 250, -70, 2], ['cobertizo', { cofre: true }, -300, 160, 1],
  ['casa', { pisos: 1, pared: 'blanco', techo: 'techo_rojo', porche: true }, -265, 115, 1], ['casa', { pisos: 2, pared: 'crema', techo: 'techo_verde' }, 225, 225, 3],
  ['casa', { pisos: 1, pared: 'celeste', techo: 'techo_gris' }, -120, -75, 0], ['casa', { pisos: 1, pared: 'durazno', techo: 'techo_marron' }, 120, -20, 2],
  ['contenedor', { m: 'chapa_verde' }, 130, 130, 1], ['contenedor', { m: 'chapa_roja' }, -60, -30, 0],
  ['antena', { h: 22 }, -300, -130, 0],
  ['molino', { cofre: false }, 225, -100, 0],
  ['auto', { m: 'rojo' }, -230, 4, 1], ['auto', { m: 'azul' }, 45, 140, 0], ['auto', { m: 'verde' }, 200, 82, 1], ['auto', { m: 'amarillo' }, 125, -125, 1],
  ['tractor', {}, 250, -200, 2],
  ['caja3', {}, 30, -160, 0], ['barriles', {}, -40, 160, 0], ['caja3', {}, 300, 40, 0], ['barriles', {}, -230, 200, 0],
  ['fogon', {}, -60, 120, 0], ['fogon', {}, 200, -260, 0],
  ['ruinas', {}, 60, 300, 0], ['ruinas', {}, -400, 120, 1], ['ruinas', {}, 330, -280, 0],
];
