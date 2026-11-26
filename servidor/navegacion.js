// Navegación de los bots: grillas de lugares donde se puede estar parado (en el terreno, en pisos, escaleras y
// techos del mapa) y rutas caminando sobre ellas. Solo la usa el servidor (bots.js).
//
// Una grilla cubre un cuadrado del mapa (por ejemplo 40 m alrededor de un cofre). Cada celda de 25 cm puede tener
// varios lugares (planta baja, primer piso, terraza). Dos lugares vecinos se unen si se pasa caminando: subiendo
// a lo sumo un escalón (colision.js STEP) o bajando hasta BAJADA. Las rutas salen de un Dijkstra desde el bot:
// la meta es el lugar alcanzable más cerca de lo que se busca (así también sirve para rodear una casa).
// Las grillas se guardan y se tiran cuando se rompe una pieza del mapa dentro de ellas.
import { Solidos, STEP } from '../public/js/colision.js';

export const NAV = {
  D: 0.25,        // lado de la celda (m)
  R: 0.42,        // radio del bot (el mismo que usa para moverse)
  H: 1.8,         // alto
  TOL: 0.04,      // un piso que llega a menos de esto de la celda cuenta (no se cae por rendijas)
  BORDE: 0.8,     // costo extra de pisar al lado de un borde que cae (las rutas van por el medio de escaleras y pasarelas)
  BAJADA: 7,      // lo más alto que se baja de un salto (hasta 8 m no hay daño por caída)
  AGUA: -1.3,     // debajo de esto se nada (los lugares en el agua honda quedan a esta altura y cuestan más)
  SALTO: 1.25,    // lo más alto que se sube saltando (el salto llega a 1,44 m)
  MAX_GRILLAS: 48,
};

const clave = (cx, cz, medio) => `${Math.round(cx / 4) * 4},${Math.round(cz / 4) * 4},${medio}`;
const VEC = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

export class Navegacion {
  constructor(world) {
    this.world = world;
    this.grillas = new Map(); // clave -> grilla (orden de uso: la última usada va al final)
    this.cola = [];           // grillas que se están armando { k, x0, z0, x1, z1, pasos }
    this.armadas = 0;         // cuántas grillas se armaron (para las pruebas)
  }

  // Una pieza del mapa se rompió: las grillas que la tocan ya no valen.
  invalidar(aabb) {
    for (const [k, g] of this.grillas) {
      if (aabb[0] <= g.x1 && aabb[3] >= g.x0 && aabb[2] <= g.z1 && aabb[5] >= g.z0) this.grillas.delete(k);
    }
    // las que se estaban armando arrancan de nuevo
    for (const c of this.cola) {
      if (aabb[0] <= c.x1 && aabb[3] >= c.x0 && aabb[2] <= c.z1 && aabb[5] >= c.z0) c.pasos = this.armar(c.x0, c.z0, c.x1, c.z1);
    }
  }

  // Grilla cuadrada de lado 2*medio centrada cerca de (cx, cz) (el centro se redondea a 4 m para reusarla).
  // Armarla lleva decenas de milisegundos, así que se arma de a poco con trabajar(): mientras tanto devuelve null.
  grilla(cx, cz, medio) {
    const k = clave(cx, cz, medio);
    const g = this.grillas.get(k);
    if (g) { this.grillas.delete(k); this.grillas.set(k, g); return g; }
    if (!this.cola.some((c) => c.k === k)) {
      const ax = Math.round(cx / 4) * 4, az = Math.round(cz / 4) * 4;
      this.cola.push({ k, x0: ax - medio, z0: az - medio, x1: ax + medio, z1: az + medio, pasos: this.armar(ax - medio, az - medio, ax + medio, az + medio) });
    }
    return null;
  }
  // La misma grilla, armada en el momento (para las pruebas).
  grillaYa(cx, cz, medio) {
    let g = this.grilla(cx, cz, medio);
    while (!g) { this.trabajar(1e9); g = this.grilla(cx, cz, medio); }
    return g;
  }
  // Avanza las grillas pendientes durante a lo sumo `ms` milisegundos.
  trabajar(ms) {
    const t0 = performance.now();
    while (this.cola.length && performance.now() - t0 < ms) {
      const c = this.cola[0];
      const r = c.pasos.next();
      if (!r.done) continue;
      this.cola.shift();
      this.grillas.set(c.k, r.value);
      this.armadas++;
      while (this.grillas.size > NAV.MAX_GRILLAS) this.grillas.delete(this.grillas.keys().next().value);
    }
  }
  pendiente(cx, cz, medio) { const k = clave(cx, cz, medio); return this.cola.some((c) => c.k === k); }

  *armar(x0, z0, x1, z1) {
    const { D, R, H, TOL, AGUA } = NAV;
    const w = this.world, sol = w.sol;
    const nx = Math.ceil((x1 - x0) / D), nz = Math.ceil((z1 - z0) / D);
    // nodos en orden de celda (i mayor, j menor): los de la celda c van de inicio[c] a inicio[c + 1]
    const inicio = new Int32Array(nx * nz + 1);
    let X = [], Y = [], Z = [];
    let agua = [], afuera = [], techo = [];
    const tops = [], alturas = [];
    const q = { x: 0, y: 0, z: 0 };
    // troncos y rocas de la zona (son muchos en el mapa: se filtran una vez)
    const troncos = w.circles.filter((c) => c.x + c.r > x0 - 1 && c.x - c.r < x1 + 1 && c.z + c.r > z0 - 1 && c.z - c.r < z1 + 1);
    let x = 0, z = 0;
    const juntarTop = (s) => {
      if (s.cyl) { if (Math.hypot(x - s.x, z - s.z) <= s.r + TOL) tops.push(s.y1); return; }
      if (x < s.x0 - TOL || x > s.x1 + TOL || z < s.z0 - TOL || z > s.z1 + TOL) return;
      tops.push(Solidos.topAt(s, Math.min(s.x1, Math.max(s.x0, x)), Math.min(s.z1, Math.max(s.z0, z))));
    };
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      if (j === 0 && i % 6 === 5) yield;
      inicio[i * nz + j] = X.length;
      x = x0 + (i + 0.5) * D; z = z0 + (j + 0.5) * D;
      const terreno = w.terrainHeight(x, z);
      tops.length = 0;
      sol.near(x, z, TOL, juntarTop);
      alturas.length = 0;
      alturas.push(terreno);
      for (const t of tops) if (t > terreno + 0.01 && !alturas.some((a) => Math.abs(a - t) < 0.02)) alturas.push(t);
      for (let y of alturas) {
        // en el agua honda se nada en la superficie
        if (y < AGUA) { if (y !== terreno) continue; y = AGUA; }
        // arriba de esta altura hay otro piso a un escalón: se está parado en ese, no en este
        if (tops.some((t) => t > y + 0.01 && t <= y + STEP)) continue;
        const techoY = sol.ceiling(x, z, y);
        if (techoY - y < H) continue;
        q.x = x; q.y = y; q.z = z;
        sol.push(q, R, H);
        if (Math.abs(q.x - x) + Math.abs(q.z - z) > 0.05) continue;
        if (enTronco(troncos, x, y, z)) continue;
        X.push(x); Y.push(y); Z.push(z); techo.push(techoY); agua.push(y === AGUA && terreno < AGUA ? 1 : 0);
        // al aire libre: sobre el terreno (o nadando) y sin nada encima
        afuera.push(Math.abs(y - Math.max(terreno, AGUA)) < 0.35 && techoY === Infinity ? 1 : 0);
      }
    }
    inicio[nx * nz] = X.length;
    const N = X.length;
    X = Float32Array.from(X); Y = Float32Array.from(Y); Z = Float32Array.from(Z); agua = Uint8Array.from(agua); afuera = Uint8Array.from(afuera); techo = Float32Array.from(techo);
    // vecinos: subir a lo sumo un escalón, bajar hasta BAJADA; en diagonal sin cortar esquinas
    const buscar = (i, j, y, sube, baja) => {
      if (i < 0 || j < 0 || i >= nx || j >= nz) return -1;
      const c = i * nz + j;
      let mejor = -1, md = Infinity;
      for (let k = inicio[c], e = inicio[c + 1]; k < e; k++) {
        const dy = Y[k] - y;
        if (dy > sube || dy < -baja) continue;
        const ad = dy < 0 ? -dy : dy;
        if (ad < md) { md = ad; mejor = k; }
      }
      return mejor;
    };
    // bordes: lugares con un vecino que cae (escalón para abajo o vacío); y los que están a dos celdas de uno
    const borde = new Uint8Array(N);
    const cae = (i, j, y) => {
      if (i < 0 || j < 0 || i >= nx || j >= nz) return false;
      const c = i * nz + j;
      let igual = false, abajo = false;
      for (let k = inicio[c], e = inicio[c + 1]; k < e; k++) {
        const dy = Y[k] - y;
        if (dy >= -STEP && dy <= STEP) igual = true; else if (dy < -STEP) abajo = true;
      }
      return !igual && abajo;
    };
    for (let i = 0, k = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      for (const e = inicio[i * nz + j + 1]; k < e; k++) {
        const y = Y[k];
        if (cae(i + 1, j, y) || cae(i - 1, j, y) || cae(i, j + 1, y) || cae(i, j - 1, y)) borde[k] = 2;
        else if (cae(i + 2, j, y) || cae(i - 2, j, y) || cae(i, j + 2, y) || cae(i, j - 2, y)) borde[k] = 1;
      }
    }
    const vIni = new Int32Array(N + 1), vA = [], vC = [];
    for (let i = 0, k = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      if (j === 0 && i % 24 === 23) yield;
      for (const e = inicio[i * nz + j + 1]; k < e; k++) {
        vIni[k] = vA.length;
        const y = Y[k];
        for (const [di, dj, c] of VEC) {
          let b = buscar(i + di, j + dj, y, STEP, NAV.BAJADA), salto = false;
          // si no se llega caminando, saltando (hasta NAV.SALTO; en diagonal no)
          if (b < 0 && !(di && dj)) { b = buscar(i + di, j + dj, y, NAV.SALTO, 0); salto = b >= 0; }
          if (b < 0) continue;
          if (di && dj && (buscar(i + di, j, y, STEP, 0.6) < 0 || buscar(i, j + dj, y, STEP, 0.6) < 0)) continue;
          const dy = Y[b] - y;
          // para bajar o subir saltando no puede haber nada en el medio (un techo entre la terraza y el piso de abajo)
          if (dy < -STEP && techo[b] < y + H - 0.2) continue;
          if (salto && techo[k] < Y[b] + H) continue;
          let costo = c * D * (agua[b] ? 2.5 : 1) + (dy < -0.6 ? 1.5 - dy : 0) + (dy > 0 ? dy * 0.5 : 0) + (salto ? 2 : 0);
          costo += borde[b] === 2 ? NAV.BORDE : borde[b] ? NAV.BORDE * 0.35 : 0;
          vA.push(b); vC.push(costo);
        }
      }
    }
    vIni[N] = vA.length;
    return { x0, z0, x1, z1, nx, nz, N, X, Y, Z, afuera, inicio, vIni, vA: Int32Array.from(vA), vC: Float32Array.from(vC) };
  }

  // Nodo de la grilla más cerca de p (con la altura parecida). null si no hay ninguno cerca.
  nodoCerca(g, p, radio = 1.2, dyMax = 1.2) {
    const { D } = NAV;
    const ci = Math.floor((p.x - g.x0) / D), cj = Math.floor((p.z - g.z0) / D);
    const n = Math.ceil(radio / D);
    let mejor = -1, md = Infinity;
    for (let i = Math.max(0, ci - n); i <= Math.min(g.nx - 1, ci + n); i++) for (let j = Math.max(0, cj - n); j <= Math.min(g.nz - 1, cj + n); j++) {
      const c = i * g.nz + j;
      for (let k = g.inicio[c], e = g.inicio[c + 1]; k < e; k++) {
        const dy = Math.abs(g.Y[k] - p.y);
        if (dy > dyMax) continue;
        const d = Math.hypot(g.X[k] - p.x, g.Z[k] - p.z) + dy * 2;
        if (d < md && d < radio + dyMax * 2) { md = d; mejor = k; }
      }
    }
    return mejor;
  }

  dentro(g, p, margen = 0.5) {
    return p.x > g.x0 + margen && p.x < g.x1 - margen && p.z > g.z0 + margen && p.z < g.z1 - margen;
  }

  // Ruta caminando desde `desde` hasta `meta` dentro de la grilla g: lista de puntos { x, y, z } (sin el de partida)
  // que termina en el lugar alcanzable más cerca de la meta. `llega` dice si ese lugar está a menos de 1 m de la meta.
  ruta(g, desde, meta) {
    const a = this.nodoCerca(g, desde, 1.5, 1.4);
    if (a < 0) return null;
    const N = g.N;
    const dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
    const h = (k) => Math.hypot(g.X[k] - meta.x, g.Z[k] - meta.z) + Math.abs(g.Y[k] - meta.y) * 1.5;
    const heap = new Monticulo();
    dist[a] = 0; heap.push(a, h(a));
    let mejor = a, mh = h(a);
    let vistos = 0;
    while (heap.size) {
      const [k] = heap.pop();
      const hk = h(k);
      if (hk < mh) { mh = hk; mejor = k; }
      if (hk < 0.3) break;
      if (++vistos > 60000) break;
      for (let t = g.vIni[k], e = g.vIni[k + 1]; t < e; t++) {
        const b = g.vA[t], nd = dist[k] + g.vC[t];
        if (nd < dist[b]) { dist[b] = nd; prev[b] = k; heap.push(b, nd + h(b)); }
      }
    }
    return { pts: camino(g, prev, a, mejor), llega: mh < 1.2, falta: mh };
  }

  // Para ir lejos desde adentro de una casa o un techo: ruta hasta un lugar al aire libre a nivel del terreno,
  // el que deje más cerca de la meta (sin contar lo que se rodea). null si no hay salida en la grilla.
  salida(g, desde, meta) {
    const a = this.nodoCerca(g, desde, 1.5, 1.4);
    if (a < 0) return null;
    const N = g.N;
    const dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
    const heap = new Monticulo();
    dist[a] = 0; heap.push(a, 0);
    let mejor = -1, mp = Infinity, vistos = 0;
    while (heap.size) {
      const [k, dk] = heap.pop();
      if (dk > dist[k]) continue;
      if (g.afuera[k]) {
        const pk = Math.hypot(g.X[k] - meta.x, g.Z[k] - meta.z) + dk * 0.35;
        if (pk < mp) { mp = pk; mejor = k; }
      }
      if (++vistos > 60000) break;
      for (let t = g.vIni[k], e = g.vIni[k + 1]; t < e; t++) {
        const b = g.vA[t], nd = dk + g.vC[t];
        if (nd < dist[b]) { dist[b] = nd; prev[b] = k; heap.push(b, nd); }
      }
    }
    if (mejor < 0) return null;
    return { pts: camino(g, prev, a, mejor), llega: true, falta: 0 };
  }
}

function camino(g, prev, a, fin) {
  const ks = [];
  for (let k = fin; k !== a && k >= 0; k = prev[k]) ks.push(k);
  ks.reverse();
  return simplificar(g, ks);
}

function enTronco(troncos, x, y, z) {
  for (const c of troncos) {
    if (Math.abs(x - c.x) > 3 || Math.abs(z - c.z) > 3) continue;
    if (y + NAV.H <= c.bottom || y >= c.top - STEP) continue;
    if (Math.hypot(x - c.x, z - c.z) < c.r + NAV.R) return true;
  }
  return false;
}

// Saca los puntos intermedios de los tramos rectos (misma dirección y misma altura); deja uno cada 3 m igual.
function simplificar(g, ks) {
  const P = (k) => ({ x: g.X[k], y: g.Y[k], z: g.Z[k] });
  if (ks.length < 3) return ks.map(P);
  const out = [];
  const D = NAV.D;
  for (let n = 0; n < ks.length; n++) {
    if (n > 0 && n < ks.length - 1 && n % 12) {
      const a = ks[n - 1], k = ks[n], b = ks[n + 1];
      const r1x = Math.round((g.X[k] - g.X[a]) / D), r1z = Math.round((g.Z[k] - g.Z[a]) / D);
      const r2x = Math.round((g.X[b] - g.X[k]) / D), r2z = Math.round((g.Z[b] - g.Z[k]) / D);
      if (r1x === r2x && r1z === r2z && Math.abs(g.Y[k] - g.Y[a]) < 0.05 && Math.abs(g.Y[b] - g.Y[k]) < 0.05) continue;
    }
    out.push(P(ks[n]));
  }
  return out;
}

// Montículo binario de mínimos: [valor, prioridad].
class Monticulo {
  constructor() { this.v = []; this.p = []; }
  get size() { return this.v.length; }
  push(v, p) {
    const V = this.v, P = this.p;
    let i = V.length;
    V.push(v); P.push(p);
    while (i > 0) {
      const u = (i - 1) >> 1;
      if (P[u] <= p) break;
      V[i] = V[u]; P[i] = P[u]; i = u;
    }
    V[i] = v; P[i] = p;
  }
  pop() {
    const V = this.v, P = this.p;
    const top = [V[0], P[0]];
    const v = V.pop(), p = P.pop();
    if (V.length) {
      let i = 0;
      const n = V.length;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && P[c + 1] < P[c]) c++;
        if (P[c] >= p) break;
        V[i] = V[c]; P[i] = P[c]; i = c;
      }
      V[i] = v; P[i] = p;
    }
    return top;
  }
}
