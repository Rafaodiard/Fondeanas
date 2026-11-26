// Construcción de los jugadores: piezas, ediciones, choques, superficies y apoyo.
// Sin Three.js: lo usan el cliente (movimiento, vista previa, edición) y el servidor (validar, vida, derrumbes).
import { GRID, MATERIALS, DIRS, structKey } from './items.js';

export const TIPOS = ['pared', 'piso', 'rampa', 'techo'];
export const NOMBRES = { pared: 'Pared', piso: 'Piso', rampa: 'Rampa', techo: 'Techo' };
export const T3 = GRID / 3; // lado de una baldosa de edición de pared o rampa
export const ALTO_TECHO = 1.6; // altura de la punta del techo
export const ESPESOR = 0.24; // espesor de pared y piso
// Segundos que tarda en levantarse una pieza: arranca con HP_INICIAL de su vida y sube hasta el máximo.
export const OBRA = { madera: 2.5, piedra: 5, metal: 7.5 };
export const HP_INICIAL = 0.3;
export const ALCANCE_EDICION = 7.5; // metros desde el jugador al centro de la pieza
// Máscara con todas las baldosas marcadas, por tipo.
export const TODO = { pared: 511, piso: 15, rampa: 7, techo: 15 };

// Ediciones (s.e, un entero de bits):
// - pared: 3x3 baldosas, bit = fila*3 + columna (fila 0 abajo, columna 0 hacia +x o +z). Bit en 1 = baldosa sacada.
// - piso: 2x2 cuartos, bit = cz*2 + cx. Bit en 1 = cuarto sacado.
// - rampa: 3 carriles a lo ancho (hacia +x si sube por z, hacia +z si sube por x). Bit en 1 = carril sacado.
//   La dirección en la que sube (s.dir) también se cambia editando.
// - techo: 2x2 cuartos, bit en 1 = esa esquina levantada a la altura de la punta (los 4 = techo plano alto).
export function editValida(type, e) {
  if (!Number.isInteger(e) || e < 0 || e > TODO[type]) return false;
  return type === 'techo' || e !== TODO[type];
}

// Normaliza una pared igual que la clave: sólo bordes -Z (dir 0) y -X (dir 3).
export function normalizar(s) {
  if (s.type !== 'pared') return s;
  if (s.dir === 2) { s.j += 1; s.dir = 0; }
  if (s.dir === 1) { s.i += 1; s.dir = 3; }
  return s;
}

const bit = (e, k) => (e >> k) & 1;
export const sacada = (s, k) => bit(s.e || 0, k) === 1;

// Carril de una rampa en el que cae (x,z), 0..2.
function carril(s, x, z) {
  const x0 = s.i * GRID, z0 = s.j * GRID;
  const u = s.dir === 0 || s.dir === 2 ? (x - x0) / T3 : (z - z0) / T3;
  return Math.max(0, Math.min(2, Math.floor(u)));
}

// Subida de la rampa (0..GRID) en (x,z).
function subida(s, x, z) {
  const x0 = s.i * GRID, z0 = s.j * GRID;
  const t = s.dir === 0 ? z0 + GRID - z : s.dir === 2 ? z - z0 : s.dir === 1 ? x - x0 : x0 + GRID - x;
  return Math.max(0, Math.min(GRID, t));
}

// Alturas del techo: esquinas en orden de cuarto (cz*2+cx) y la punta.
export function alturasTecho(s) {
  const e = s.e || 0;
  return { esq: [0, 1, 2, 3].map((k) => (bit(e, k) ? ALTO_TECHO : 0)), punta: ALTO_TECHO };
}

// Altura del plano que pasa por tres puntos [x,y,z], en (x,z).
function plano(a, b, c, x, z) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  if (Math.abs(ny) < 1e-9) return Math.max(a[1], b[1], c[1]);
  return a[1] - (nx * (x - a[0]) + nz * (z - a[2])) / ny;
}

// Los 4 triángulos del techo (en coordenadas del mundo): [esquinaA, esquinaB, punta].
export function triangulosTecho(s) {
  const x0 = s.i * GRID, z0 = s.j * GRID, G = GRID;
  const { esq, punta } = alturasTecho(s);
  const P = (k) => [x0 + (k & 1) * G, s.y + esq[k], z0 + (k >> 1) * G];
  const C = [x0 + G / 2, s.y + punta, z0 + G / 2];
  // lados: -z (0,1), +x (1,3), +z (3,2), -x (2,0)
  return [[P(0), P(1), C], [P(1), P(3), C], [P(3), P(2), C], [P(2), P(0), C]];
}

// Altura de la cara pisable de la pieza en (x,z), o null si (x,z) no está sobre ella (o cae en una parte sacada).
export function superficie(s, x, z) {
  if (s.type === 'pared') return null;
  const x0 = s.i * GRID, z0 = s.j * GRID, G = GRID;
  if (x < x0 || x > x0 + G || z < z0 || z > z0 + G) return null;
  if (s.type === 'piso') {
    const k = (z - z0 < G / 2 ? 0 : 2) + (x - x0 < G / 2 ? 0 : 1);
    return sacada(s, k) ? null : s.y;
  }
  if (s.type === 'rampa') return sacada(s, carril(s, x, z)) ? null : s.y + subida(s, x, z);
  // techo: el triángulo del lado más cercano
  const dx = x - (x0 + G / 2), dz = z - (z0 + G / 2);
  const tri = triangulosTecho(s)[Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : dz > 0 ? 2 : 0];
  return plano(tri[0], tri[1], tri[2], x, z);
}

// Espesor de la pieza por debajo de su cara pisable (para chocar la cabeza desde abajo).
export const DEBAJO = { piso: ESPESOR, rampa: 0.3, techo: 0.2 };

// Cajas que frenan al jugador de costado: tramos de pared que quedan después de editar
// (columnas con los mismos huecos se juntan en una sola caja) y los bordes altos del techo.
export function cajasPieza(s) {
  const out = [];
  const x0 = s.i * GRID, z0 = s.j * GRID, t = ESPESOR / 2 + 0.03;
  if (s.type === 'pared') {
    const tramos = [0, 1, 2].map((c) => {
      const r = [];
      for (let f = 0; f < 3;) {
        if (sacada(s, f * 3 + c)) { f++; continue; }
        let f1 = f;
        while (f1 < 3 && !sacada(s, f1 * 3 + c)) f1++;
        r.push([f, f1]); f = f1;
      }
      return r;
    });
    for (let c = 0; c < 3;) {
      let c1 = c + 1;
      while (c1 < 3 && JSON.stringify(tramos[c1]) === JSON.stringify(tramos[c])) c1++;
      for (const [f0, f1] of tramos[c]) {
        const a0 = c * T3, a1 = c1 * T3, y0 = s.y + f0 * T3, y1 = s.y + f1 * T3;
        out.push(s.dir === 0
          ? { minX: x0 + a0, maxX: x0 + a1, minZ: z0 - t, maxZ: z0 + t, minY: y0, maxY: y1 }
          : { minX: x0 - t, maxX: x0 + t, minZ: z0 + a0, maxZ: z0 + a1, minY: y0, maxY: y1 });
      }
      c = c1;
    }
  } else if (s.type === 'techo') {
    // un borde con las dos esquinas levantadas es una pared baja
    const { esq } = alturasTecho(s);
    const G = GRID, h = ALTO_TECHO;
    const lados = [[0, 1, { minX: x0, maxX: x0 + G, minZ: z0 - 0.05, maxZ: z0 + 0.15 }], [1, 3, { minX: x0 + G - 0.15, maxX: x0 + G + 0.05, minZ: z0, maxZ: z0 + G }],
      [2, 3, { minX: x0, maxX: x0 + G, minZ: z0 + G - 0.15, maxZ: z0 + G + 0.05 }], [0, 2, { minX: x0 - 0.05, maxX: x0 + 0.15, minZ: z0, maxZ: z0 + G }]];
    for (const [a, b, box] of lados) if (esq[a] > 0 && esq[b] > 0) out.push({ ...box, minY: s.y, maxY: s.y + h - 0.35 });
  }
  return out;
}

// Caja que ocupa la pieza entera (para saber qué toca a qué).
export function cajaPieza(s) {
  const x0 = s.i * GRID, z0 = s.j * GRID, G = GRID, t = ESPESOR / 2;
  if (s.type === 'pared') {
    return s.dir === 0
      ? { x0, x1: x0 + G, z0: z0 - t, z1: z0 + t, y0: s.y, y1: s.y + G }
      : { x0: x0 - t, x1: x0 + t, z0, z1: z0 + G, y0: s.y, y1: s.y + G };
  }
  if (s.type === 'piso') return { x0, x1: x0 + G, z0, z1: z0 + G, y0: s.y - ESPESOR, y1: s.y };
  return { x0, x1: x0 + G, z0, z1: z0 + G, y0: s.y, y1: s.y + (s.type === 'rampa' ? G : ALTO_TECHO) };
}

const EPS = 0.06;
const tocan = (a, b) => a.x0 <= b.x1 + EPS && a.x1 >= b.x0 - EPS && a.z0 <= b.z1 + EPS && a.z1 >= b.z0 - EPS && a.y0 <= b.y1 + EPS && a.y1 >= b.y0 - EPS;

// ¿La pieza se apoya en el terreno o en una estructura del mapa (sana)?
export function apoyadaEnMapa(world, s) {
  const b = cajaPieza(s);
  const pts = [[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1], [(b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2]];
  for (const [x, z] of pts) if (b.y0 <= world.terrainHeight(x, z) + 0.6) return true;
  if (!world.sol) return false;
  let ok = false;
  const e = 0.12;
  world.sol.near((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, GRID, (o) => {
    if (ok || o.dead) return;
    if (o.x0 <= b.x1 + e && o.x1 >= b.x0 - e && o.z0 <= b.z1 + e && o.z1 >= b.z0 - e && o.y0 <= b.y1 + e && o.y1 >= b.y0 - e) ok = true;
  });
  return ok;
}

// Piezas de jugadores que tocan a s (vecinas en la grilla).
function vecinas(porCelda, s) {
  const out = [], b = s.caja || (s.caja = cajaPieza(s));
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
    for (const o of porCelda.get(`${s.i + di},${s.j + dj}`) || []) {
      if (o === s) continue;
      if (tocan(b, o.caja || (o.caja = cajaPieza(o)))) out.push(o);
    }
  }
  return out;
}
function indexar(structs) {
  const m = new Map();
  for (const s of structs) {
    const k = `${s.i},${s.j}`;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(s);
  }
  return m;
}

// ---------- Grilla de encastre (como en el género) ----------
// Todas las piezas viven en una grilla de celdas de GRID × GRID × GRID: las paredes en los lados de una celda,
// los pisos en su cara de abajo, y la rampa o el techo (uno de los dos) adentro, apoyados en esa cara.
// Dos piezas están enganchadas cuando comparten un borde entero de la grilla: el borde de arriba de una pared
// con el de un piso, el borde alto de una rampa con el de un piso, dos paredes de costado, etc. Así no puede
// quedar un piso en el medio de una pared: cada pieza arranca donde termina otra.

// Esquinas [i, j] del lado d (0=-Z, 1=+X, 2=+Z, 3=-X) de la celda (i, j).
function lado(i, j, d) {
  return d === 0 ? [[i, j], [i + 1, j]] : d === 1 ? [[i + 1, j], [i + 1, j + 1]] : d === 2 ? [[i, j + 1], [i + 1, j + 1]] : [[i, j], [i, j + 1]];
}
const punto = (i, y, j) => `${i},${Math.round(y * 100) / 100},${j}`;
const segmento = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

// Bordes de la grilla que ocupa la pieza (claves de texto; dos piezas con una clave igual se enganchan).
// Las ediciones no cambian los bordes: una pared con puerta sigue sosteniendo lo que tiene arriba.
export function bordes(s) {
  const h = ([a, b], y) => segmento(punto(a[0], y, a[1]), punto(b[0], y, b[1]));
  const v = (p, y0, y1) => segmento(punto(p[0], y0, p[1]), punto(p[0], y1, p[1]));
  if (s.type === 'pared') {
    const n = s.dir === 2 || s.dir === 1 ? normalizar({ ...s }) : s;
    const pts = lado(n.i, n.j, n.dir === 0 ? 0 : 3);
    return [h(pts, n.y), h(pts, n.y + GRID), v(pts[0], n.y, n.y + GRID), v(pts[1], n.y, n.y + GRID)];
  }
  if (s.type === 'rampa') {
    const alto = lado(s.i, s.j, s.dir), bajo = lado(s.i, s.j, (s.dir + 2) % 4);
    const out = [h(alto, s.y + GRID), h(bajo, s.y)];
    // costados en diagonal: cada esquina de abajo con la de arriba del mismo costado
    for (const b of bajo) {
      const a = alto.find((p) => (s.dir % 2 === 0 ? p[0] === b[0] : p[1] === b[1]));
      out.push(segmento(punto(b[0], s.y, b[1]), punto(a[0], s.y + GRID, a[1])));
    }
    return out;
  }
  return [0, 1, 2, 3].map((d) => h(lado(s.i, s.j, d), s.y)); // piso y techo: los 4 bordes de la base
}

// ¿Comparten un borde de la grilla?
export function enganchadas(a, b) {
  const ba = new Set(bordes(a));
  return bordes(b).some((k) => ba.has(k));
}

// ¿Están en la misma grilla de altura? (la diferencia de nivel es un múltiplo exacto de GRID)
const modulo = (a, n) => ((a % n) + n) % n;
export function mismaGrilla(a, b) {
  const d = modulo(a.y - b.y, GRID);
  return d < 0.01 || d > GRID - 0.01;
}

// La rampa y el techo ocupan el mismo lugar adentro de la celda: no puede haber los dos.
export function ocupado(world, s) {
  if (world.structs.has(s.key || structKey(s))) return true;
  if (s.type !== 'rampa' && s.type !== 'techo') return false;
  return world.structs.has(structKey({ ...s, type: s.type === 'rampa' ? 'techo' : 'rampa' }));
}

// ¿La pieza nueva s se apoya en el piso o en el mapa, o comparte un borde con otra construcción?
export function tieneApoyo(world, s) {
  if (apoyadaEnMapa(world, s)) return true;
  s.caja = cajaPieza(s);
  return vecinas(indexar(world.structs.values()), s).some((o) => enganchadas(s, o));
}

// Por qué no se puede poner la pieza s, o null si encaja. Lo usan la vista previa (verde o roja) y el servidor.
export const MOTIVOS = {
  ocupado: 'Ya hay una pieza ahí',
  grilla: 'No encaja con la grilla de al lado',
  apoyo: 'Sin apoyo: tiene que salir del borde de otra pieza o del piso',
};
export function motivoNoEncaja(world, s) {
  if (ocupado(world, s)) return 'ocupado';
  s.caja = cajaPieza(s);
  const cerca = vecinas(indexar(world.structs.values()), s);
  // lo que toca tiene que estar en la misma grilla (si no, quedaría un piso a media pared)
  if (cerca.some((o) => !mismaGrilla(s, o))) return 'grilla';
  if (apoyadaEnMapa(world, s) || cerca.some((o) => enganchadas(s, o))) return null;
  return 'apoyo';
}
export const encaja = (world, s) => motivoNoEncaja(world, s) === null;

// Nivel de la grilla para una pieza nueva cerca de la celda (i, j) a la altura y (los pies).
// Si hay construcciones cerca, el de su grilla: la celda que contiene y (con `tol` de margen, para que parado
// sobre un piso cuente ese piso). Si no hay, y redondeado para abajo a medio metro (el piso del terreno).
export function nivelGrilla(world, i, j, y, tol = 0.6) {
  let ref = null, mejor = Infinity;
  for (const s of world.structs.values()) {
    if (Math.abs(s.i - i) > 2 || Math.abs(s.j - j) > 2) continue;
    const dy = Math.abs(s.y - y);
    if (dy > GRID * 2) continue;
    const d = Math.hypot(s.i - i, s.j - j) * GRID + dy;
    if (d < mejor) { mejor = d; ref = s; }
  }
  if (!ref) return Math.floor(y * 2) / 2;
  return ref.y + GRID * Math.floor((y - ref.y + tol) / GRID);
}

// ---------- A dónde va la pieza que se está por poner ----------
// yo = { pos: {x,y,z}, yaw, pitch }; tipo = pieza; giro = vueltas extra de la rampa (R).
// Como en el género: la pared va en el lado de la celda que se mira, el piso abajo de los pies, adelante o
// arriba de la cabeza según cuánto se mire para abajo o para arriba, y lo mismo la rampa y el techo.
export function direccionDe(yaw) {
  return Math.round(((-yaw / (Math.PI / 2)) % 4 + 4) % 4) % 4; // 0=-Z,1=+X,2=+Z,3=-X
}
export function nivelDelJugador(world, pos, d) {
  const ci = Math.floor(pos.x / GRID), cj = Math.floor(pos.z / GRID);
  // parado sobre una pieza: su nivel, para que todo encaje
  for (const s of world.structs.values()) {
    if (s.type === 'pared' || s.i !== ci || s.j !== cj) continue;
    if (pos.y < s.y - 0.3 || pos.y > s.y + (s.type === 'rampa' ? GRID : 1.7) + 0.6) continue;
    if (s.type === 'rampa') {
      if (s.dir === d) return { ci, cj, level: s.y, sube: true }; // la rampa sube hacia donde miro: lo de adelante va arriba
      return { ci, cj, level: pos.y > s.y + GRID * 0.5 ? s.y + GRID : s.y, sube: false };
    }
    return { ci, cj, level: s.y, sube: false };
  }
  return { ci, cj, level: nivelGrilla(world, ci, cj, pos.y), sube: false };
}
export function objetivoPieza(world, yo, tipo, giro = 0) {
  const d = direccionDe(yo.yaw);
  const { ci, cj, level, sube } = nivelDelJugador(world, yo.pos, d);
  const [dx, dz] = DIRS[d];
  const p = yo.pitch, arriba = sube ? GRID : 0;
  let t;
  if (tipo === 'pared') t = { i: ci, j: cj, y: level + (p > 0.8 ? GRID : sube && p > 0.1 ? GRID : 0), dir: d };
  else if (tipo === 'piso') {
    if (p > 0.45) t = { i: ci, j: cj, y: level + GRID, dir: d };
    else if (p < -0.6) t = { i: ci, j: cj, y: sube ? level + GRID : level, dir: d };
    else t = { i: ci + dx, j: cj + dz, y: level + arriba, dir: d };
  } else if (tipo === 'rampa') {
    const dir = (d + giro) % 4;
    if (p < -0.55 && !sube) t = { i: ci, j: cj, y: level, dir };
    else t = { i: ci + dx, j: cj + dz, y: level + arriba, dir };
  } else if (p > 0.3) t = { i: ci, j: cj, y: level + GRID, dir: d };
  else t = { i: ci + dx, j: cj + dz, y: level + arriba, dir: d };
  const s = normalizar({ type: tipo, ...t, mat: yo.mat, e: 0 });
  s.key = structKey(s);
  return s;
}

// Claves de las construcciones que quedaron sin apoyo: las que no llegan al piso ni al mapa
// pasando de borde en borde por otras piezas.
export function sinApoyo(world) {
  const lista = [...world.structs.values()];
  const porBorde = new Map();
  for (const s of lista) {
    s.bordes = bordes(s);
    for (const k of s.bordes) { if (!porBorde.has(k)) porBorde.set(k, []); porBorde.get(k).push(s); }
  }
  const ok = new Set(), cola = [];
  for (const s of lista) { s.caja = cajaPieza(s); if (apoyadaEnMapa(world, s)) { ok.add(s); cola.push(s); } }
  while (cola.length) {
    for (const k of cola.pop().bordes) for (const v of porBorde.get(k)) if (!ok.has(v)) { ok.add(v); cola.push(v); }
  }
  return lista.filter((s) => !ok.has(s)).map((s) => s.key);
}

// Vida de una pieza en el instante t (ms): crece mientras se levanta, menos el daño recibido.
export function vidaDe(s, t) {
  const max = MATERIALS[s.mat].hp;
  const k = Math.min(1, Math.max(0, (t - s.born) / (OBRA[s.mat] * 1000)));
  return max * (HP_INICIAL + (1 - HP_INICIAL) * k) - (s.dano || 0);
}

// ---------- Edición: dónde apunta el jugador ----------
// Cruza un rayo con la superficie de edición de la pieza. Devuelve { dist, k } (k = baldosa) o null.
export function rayoEdicion(s, o, d) {
  const x0 = s.i * GRID, z0 = s.j * GRID, G = GRID;
  const enPlano = (n, c) => { // plano n·p = c
    const den = n[0] * d.x + n[1] * d.y + n[2] * d.z;
    if (Math.abs(den) < 1e-6) return null;
    const t = (c - (n[0] * o.x + n[1] * o.y + n[2] * o.z)) / den;
    return t > 0 ? t : null;
  };
  let t, k;
  if (s.type === 'pared') {
    t = s.dir === 0 ? enPlano([0, 0, 1], z0) : enPlano([1, 0, 0], x0);
    if (t === null) return null;
    const px = o.x + d.x * t, py = o.y + d.y * t, pz = o.z + d.z * t;
    const a = (s.dir === 0 ? px - x0 : pz - z0) / T3, f = (py - s.y) / T3;
    if (a < 0 || a >= 3 || f < 0 || f >= 3) return null;
    k = Math.floor(f) * 3 + Math.floor(a);
  } else if (s.type === 'rampa') {
    // plano inclinado de la rampa: y - s.y = subida(x,z)
    const n = s.dir === 0 ? [0, 1, 1] : s.dir === 2 ? [0, 1, -1] : s.dir === 1 ? [-1, 1, 0] : [1, 1, 0];
    const c = s.dir === 0 ? s.y + z0 + G : s.dir === 2 ? s.y - z0 : s.dir === 1 ? s.y - x0 : s.y + x0 + G;
    t = enPlano(n, c);
    if (t === null) return null;
    const px = o.x + d.x * t, pz = o.z + d.z * t;
    const u = (px - x0) / T3, v = (pz - z0) / T3;
    if (u < 0 || u >= 3 || v < 0 || v >= 3) return null;
    k = Math.floor(v) * 3 + Math.floor(u);
  } else {
    t = enPlano([0, 1, 0], s.y + (s.type === 'techo' ? ALTO_TECHO / 2 : 0));
    if (t === null) return null;
    const px = o.x + d.x * t, pz = o.z + d.z * t;
    const u = (px - x0) / (G / 2), v = (pz - z0) / (G / 2);
    if (u < 0 || u >= 2 || v < 0 || v >= 2) return null;
    k = Math.floor(v) * 2 + Math.floor(u);
  }
  return { dist: t, k };
}

// Cantidad de baldosas de la grilla de edición.
export const BALDOSAS = { pared: 9, piso: 4, rampa: 9, techo: 4 };

// Marcas iniciales al entrar a editar (lo que ya estaba sacado o levantado).
export function marcasIniciales(s) {
  if (s.type === 'rampa') return 0;
  return s.e || 0;
}

// Resultado de confirmar la edición. marcas = bits de baldosas marcadas; camino = baldosas en el orden en que se marcaron.
// Devuelve { e, dir } o null si la edición no es válida.
export function resultadoEdicion(s, marcas, camino) {
  if (s.type !== 'rampa') return editValida(s.type, marcas) ? { e: marcas, dir: s.dir } : null;
  // rampa: grilla 3x3 vista desde arriba (k = fila z * 3 + columna x)
  if (!marcas) return { e: s.e || 0, dir: s.dir }; // sin marcas no cambia
  let dir = s.dir;
  if (camino.length >= 2) {
    const a = camino[0], b = camino[camino.length - 1];
    const dx = (b % 3) - (a % 3), dz = Math.floor(b / 3) - Math.floor(a / 3);
    if (dx || dz) dir = Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 1 : 3) : dz > 0 ? 2 : 0;
  }
  // carriles marcados, a lo ancho de la dirección nueva
  let carriles = 0;
  for (let k = 0; k < 9; k++) if (bit(marcas, k)) carriles |= 1 << (dir === 0 || dir === 2 ? k % 3 : Math.floor(k / 3));
  const e = TODO.rampa & ~carriles;
  return editValida('rampa', e) ? { e, dir } : null;
}
