// Construcción de los jugadores: piezas, ediciones, choques, superficies y apoyo.
// Sin Three.js: lo usan el cliente (movimiento, vista previa, edición) y el servidor (validar, vida, derrumbes).
import { GRID, MATERIALS } from './items.js';

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

// ¿Se puede poner la pieza nueva s? Tiene que tocar el piso, el mapa u otra construcción.
export function tieneApoyo(world, s) {
  if (apoyadaEnMapa(world, s)) return true;
  const porCelda = indexar(world.structs.values());
  s.caja = cajaPieza(s);
  return vecinas(porCelda, s).length > 0;
}

// Claves de las construcciones que quedaron sin apoyo (no llegan al piso ni al mapa por otras piezas).
export function sinApoyo(world) {
  const lista = [...world.structs.values()];
  const porCelda = indexar(lista);
  const ok = new Set(), cola = [];
  for (const s of lista) { s.caja = cajaPieza(s); if (apoyadaEnMapa(world, s)) { ok.add(s); cola.push(s); } }
  while (cola.length) {
    for (const v of vecinas(porCelda, cola.pop())) if (!ok.has(v)) { ok.add(v); cola.push(v); }
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
