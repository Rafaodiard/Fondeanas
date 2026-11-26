// Dónde cae el loot sin atravesar paredes (lo usan el servidor, el cliente y las pruebas).
// El servidor decide dónde queda cada objeto que sale de un cofre, que suelta un jugador o que deja alguien al morir:
// lo "camina" desde el punto de salida hacia afuera en pasos chicos y lo frena antes de cualquier pared del mapa,
// vidrio, mueble alto, construcción de un jugador, árbol o roca. Si sale por un borde (balcón, escalera) cae al piso
// de abajo, nunca a través de una losa. El cliente usa pisoLoot/techoLoot para que el salto desde el cofre no corte
// pisos ni techos por el camino.
import { Solidos, STEP } from './colision.js';
import { superficie, DEBAJO } from './construccion.js';
import { SEA_LEVEL } from './world.js';
import { GRID } from './items.js';

export const LOOT_RADIO = 0.4;  // medio ancho del objeto (un arma girando mide casi un metro)
export const LOOT_ALTO = 0.95;  // hasta dónde llega el objeto sobre su piso (centro a 0,5 + vaivén + medio modelo)
export const PASO = 0.1;        // largo de cada paso del recorrido
export const R_MIN = 1, R_MAX = 1.8; // distancia a la que sale cada objeto (como antes)
const DIRECCIONES = 16;

// Piso donde se apoya un objeto que viene a la altura f: terreno, mapa (lo que se sube como un escalón)
// y construcciones (pisos, rampas y techos). Los autos no: se mueven.
// (zona: lo que hay cerca, de zonaLoot; sin zona se mira todo el mundo)
export function pisoLoot(world, x, z, f, zona = null) {
  let h = world.terrainHeight(x, z);
  const s = world.sol.ground(x, z, f);
  if (s > h) h = s;
  for (const st of zona ? zona.structs : world.structs.values()) {
    if (st.type === 'pared') continue;
    const top = superficie(st, x, z);
    if (top !== null && top <= f + STEP && top > h) h = top;
  }
  return h;
}

// Techo más bajo arriba de un objeto apoyado en f (mapa y construcciones), o Infinity.
export function techoLoot(world, x, z, f) {
  let c = world.sol.ceiling(x, z, f);
  for (const st of world.structs.values()) {
    if (st.type === 'pared') continue;
    const top = superficie(st, x, z);
    if (top === null) continue;
    const abajo = top - DEBAJO[st.type];
    if (abajo >= f + STEP && abajo < c) c = abajo;
  }
  return c;
}

// Árboles, rocas y construcciones a menos de radio metros de (x,z): para no recorrer toda la isla en cada paso.
export function zonaLoot(world, x, z, radio) {
  const lejos = (x0, z0, x1, z1) => x < x0 - radio || x > x1 + radio || z < z0 - radio || z > z1 + radio;
  return {
    circles: world.circles.filter((c) => !lejos(c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r)),
    structs: [...world.structs.values()].filter((st) => {
      // cada pieza ocupa una celda de la grilla desde (i, j) (las paredes sobresalen medio espesor)
      const x0 = st.i * GRID, z0 = st.j * GRID;
      return !lejos(x0 - 0.5, z0 - 0.5, x0 + GRID + 0.5, z0 + GRID + 0.5);
    }),
  };
}

// Distancia horizontal de (x,z) a lo que ocupa un objeto apoyado en f (Infinity si no le toca la altura).
// Lo que se sube como un escalón no cuenta: es piso.
function distancias(world, zona, x, z, f, rad, fn) {
  const alto = f + LOOT_ALTO, bajo = f + STEP;
  world.sol.near(x, z, rad + 0.1, (s) => {
    if (s.dead || s.y0 >= alto) return;
    if (s.cyl) {
      if (s.y1 <= bajo) return;
      fn(Math.hypot(x - s.x, z - s.z) - s.r, s);
      return;
    }
    const cx = Math.max(s.x0, Math.min(x, s.x1)), cz = Math.max(s.z0, Math.min(z, s.z1));
    if (Solidos.topAt(s, cx, cz) <= bajo) return;
    fn(Math.hypot(x - cx, z - cz), s);
  });
  for (const c of zona.circles) {
    if (c.top <= bajo || c.bottom >= alto) continue;
    const dx = x - c.x, dz = z - c.z;
    if (Math.abs(dx) > 6 || Math.abs(dz) > 6) continue;
    fn(Math.hypot(dx, dz) - c.r, c);
  }
  for (const st of zona.structs) {
    if (st.boxes) for (const b of st.boxes) {
      if (b.minY >= alto || b.maxY <= bajo) continue;
      const cx = Math.max(b.minX, Math.min(x, b.maxX)), cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      fn(Math.hypot(x - cx, z - cz), b);
    }
    if (st.type === 'pared') continue;
    // piso, rampa o techo que pasa por la altura del objeto (por ejemplo, por abajo de una rampa)
    const top = superficie(st, x, z);
    if (top !== null && top > bajo && top - DEBAJO[st.type] < alto) fn(0, st);
  }
}

// ¿Moverse de (x0,z0) a (x1,z1) mete al objeto en algo? Sólo frena si se acerca: un objeto que ya arranca
// pegado a una pared (cofre contra la pared) puede alejarse de ella.
function choca(world, zona, x0, z0, f0, x1, z1, f1, rad) {
  const antes = new Map();
  distancias(world, zona, x0, z0, f0, rad, (d, s) => antes.set(s, Math.min(d, antes.get(s) ?? Infinity)));
  let mal = false;
  distancias(world, zona, x1, z1, f1, rad, (d, s) => {
    if (mal || d >= rad) return;
    const a = antes.get(s);
    if (a === undefined || d < a - 1e-6) mal = true;
  });
  return mal;
}

// Recorre desde el punto de salida (pies en y) en la dirección ang hasta dist metros, frenando antes de lo que choque.
// Devuelve { x, y, z, d } con d = cuánto llegó a avanzar.
export function trayectoLoot(world, x, y, z, ang, dist, rad = LOOT_RADIO, zona = zonaLoot(world, x, z, dist + rad + 1)) {
  const dx = Math.cos(ang), dz = Math.sin(ang);
  // en el agua el objeto va flotando (no por el fondo): choca con muelles y cascos a la altura de la superficie
  let f = enAgua(pisoLoot(world, x, z, y + 0.3, zona), y);
  let px = x, pz = z, d = 0;
  const n = Math.ceil(dist / PASO);
  for (let k = 1; k <= n; k++) {
    const t = Math.min(dist, k * PASO);
    const nx = x + dx * t, nz = z + dz * t;
    const nf = enAgua(pisoLoot(world, nx, nz, f, zona), y);
    if (choca(world, zona, px, pz, f, nx, nz, nf, rad)) break;
    px = nx; pz = nz; f = nf; d = t;
  }
  return { x: px, y: f, z: pz, d };
}

// En el agua el objeto queda flotando cerca de la superficie (o a la altura de quien lo soltó nadando), no en el fondo.
function enAgua(f, y) { return f < SEA_LEVEL ? Math.max(f, Math.min(y, SEA_LEVEL)) : f; }

// Lugares para n objetos que salen de (x,y,z): alrededor, a 1-1,8 m, sin pasar paredes.
// Si una dirección está tapada se usa la libre más parecida; si están todas tapadas, la que más deja avanzar.
export function repartirLoot(world, n, x, y, z, rnd = Math.random, rad = LOOT_RADIO) {
  const giro = rnd() * Math.PI * 2;
  const zona = zonaLoot(world, x, z, R_MAX + rad + 1);
  const dirs = Array.from({ length: DIRECCIONES }, (_, k) => {
    const ang = giro + (k / DIRECCIONES) * Math.PI * 2;
    return { ang, libre: trayectoLoot(world, x, y, z, ang, R_MAX, rad, zona).d };
  });
  const out = [];
  for (let k = 0; k < n; k++) {
    const quiere = (k / n) * Math.PI * 2 + rnd();
    const r = R_MIN + rnd() * (R_MAX - R_MIN);
    const dif = (d) => Math.abs(Math.atan2(Math.sin(d.ang - quiere), Math.cos(d.ang - quiere)));
    const sirven = dirs.filter((d) => d.libre >= Math.min(r, R_MIN) - 1e-6);
    const dir = sirven.length ? sirven.reduce((a, b) => (dif(b) < dif(a) ? b : a)) : dirs.reduce((a, b) => (b.libre > a.libre ? b : a));
    const p = trayectoLoot(world, x, y, z, dir.ang, Math.min(r, dir.libre), rad, zona);
    out.push(acomodarLoot(world, { x: p.x, y: p.y, z: p.z }, rad, y));
  }
  return out;
}

// Deja un objeto que ya está en el piso en un lugar válido: si una construcción nueva lo tapa lo saca para su lado
// (o lo sube arriba de un piso o rampa que lo atraviesa), y si se rompió lo que tenía abajo cae.
// Devuelve la posición nueva { x, y, z } (no toca el objeto).
export function acomodarLoot(world, it, rad = LOOT_RADIO, desde = it.y) {
  const p = { x: it.x, y: it.y, z: it.z };
  for (const st of world.structs.values()) {
    if (st.type === 'pared') continue;
    const top = superficie(st, p.x, p.z);
    if (top !== null && top > p.y && top - DEBAJO[st.type] < p.y + LOOT_ALTO) p.y = top;
  }
  world.collide(p, rad, LOOT_ALTO);
  p.y = enAgua(pisoLoot(world, p.x, p.z, p.y + 0.05), desde);
  return { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) };
}
