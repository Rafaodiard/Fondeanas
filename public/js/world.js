// Generación determinística de la isla a partir de la semilla de la sala.
// Todos los clientes de una sala generan exactamente el mismo mundo.
import * as THREE from 'three';
import { GRID, MATERIALS } from './items.js';
import { PLANOS, Plano, piezasDe, vecinasDe, sinApoyo } from './planos.js';
import { PUEBLOS, RUTAS, RIO, SUELTOS, TELEFERICO } from './isla.js';
import { Solidos } from './colision.js';
import { Lote, materialesMapa, terrainDetail } from './mallas.js';

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise(seed) {
  const rand = rng(seed);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = (h, x, y) => {
    const g = h & 7;
    const u = g < 4 ? x : y, v = g < 4 ? y : x;
    return ((g & 1) ? -u : u) + ((g & 2) ? -2 * v : 2 * v);
  };
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x, y) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const a = perm[X] + Y, b = perm[X + 1] + Y;
    const l1 = grad(perm[a], x, y) + u * (grad(perm[b], x - 1, y) - grad(perm[a], x, y));
    const l2 = grad(perm[a + 1], x, y - 1) + u * (grad(perm[b + 1], x - 1, y - 1) - grad(perm[a + 1], x, y - 1));
    return (l1 + v * (l2 - l1)) * 0.25;
  };
}

export const SEA_LEVEL = 0;

// Lo completa el cliente con los modelos de Blender (assets.js). El servidor no lo usa.
export const MODEL = { clone: null, baked: null, cofre: null, abrirCofre: null };

const MAP_SEED = 20261124; // el mapa es fijo: todos los partidos se juegan en la misma isla
const ROT_DIR = {
  '+x': ['+x', '-z', '-x', '+z'], '-x': ['-x', '+z', '+x', '-z'],
  '+z': ['+z', '+x', '-z', '-x'], '-z': ['-z', '-x', '+z', '+x'],
};
const SIN_APLANAR = new Set(['jardin', 'seto', 'cerca', 'farol', 'banco', 'tacho', 'hidrante', 'buzon', 'cantero', 'cartel', 'auto', 'campo']);
// Estructuras que no se rompen: de los postes y las torres cuelgan cables, los carteles tienen el texto aparte.
const NO_ROMPE = new Set(['poste', 'torreTeleferico', 'cartel', 'indicador', 'malecon']);
const CALLE_COLOR = { asfalto: '#4b4e54', vereda: '#cfc6b4', tierra: '#a8865a', arena: '#e2cb95', nieve: '#e9eff6' };

// (x,z) local -> mundo, con rotación de a cuartos de vuelta (igual que rotation.y de Three.js).
function rot2(x, z, r) {
  switch (r & 3) {
    case 1: return [z, -x];
    case 2: return [-x, -z];
    case 3: return [-z, x];
    default: return [x, z];
  }
}

export class World {
  constructor(seed, size) {
    this.seed = seed;
    this.size = size;
    this.noise = makeNoise(MAP_SEED);
    this.res = 300; // celdas por lado
    this.cell = size / this.res;
    this.sol = new Solidos();
    this.circles = []; // troncos y rocas {x,z,r,top,bottom}
    this.solidMeshes = []; // para raycasts de disparo
    this.camMeshes = []; // para que la cámara no atraviese paredes
    this.pois = [];
    this.structs = new Map(); // construcciones de los jugadores
    this.structMeshes = [];
    this.placed = []; // estructuras ubicadas {P, r, x, y, z, fp, piezas, ids}
    this.piezas = []; // piezas rompibles de las estructuras del mapa (mismo orden en el servidor y en el cliente)
    this.ribbons = []; // calles y rutas {pts, w, m, off, def}
    this.plazas = []; // remates redondos al final de una calle {x, z, r, m, h, rb}
    this.chestSpots = [];
    this.lootSpots = [];
    this.trees = [];
    this.rocks = [];
    this.bushes = [];
    this.cacti = [];
    this.signs = [];
    this.layout();
  }

  // ---------- Terreno base ----------
  rawHeight(x, z) {
    const n = this.noise;
    const half = this.size / 2;
    const r = Math.hypot(x, z);
    const ang = Math.atan2(z, x);
    const coastR = half * 0.84 + 70 * n(Math.cos(ang) * 1.2 + 3, Math.sin(ang) * 1.2 + 7) + 34 * n(Math.cos(ang) * 3 + 1, Math.sin(ang) * 3 + 5) + 10 * n(Math.cos(ang) * 9, Math.sin(ang) * 9)
      + 60 * bump(Math.cos(ang), Math.sin(ang), 0.72, -0.69, 0.35) - 40 * bump(Math.cos(ang), Math.sin(ang), -0.98, -0.2, 0.3);
    const land = 1 - smoothstep(coastR - 80, coastR + 6, r);
    let h = 9 + n(x / 260, z / 260) * 22 + n(x / 90 + 4, z / 90 + 1) * 6 + n(x / 28 + 9, z / 28 + 3) * 1.2;
    // Montaña nevada al noroeste y cerro del observatorio al norte.
    h += bump(x, z, -310, -320, 235) ** 1.4 * 118;
    h += bump(x, z, 140, -385, 150) ** 1.3 * 42;
    h += bump(x, z, -90, -200, 140) ** 1.2 * 14; // lomas de la cantera
    // Desierto al este: médanos suaves.
    const des = this.desert(x, z);
    if (des > 0) h = h * (1 - des * 0.6) + des * (5 + Math.abs(n(x / 40, z / 22)) * 9);
    // Ciénaga al suroeste: casi a nivel del mar.
    const sw = this.swamp(x, z);
    if (sw > 0) h = h * (1 - smoothstep(0, 0.5, sw)) + smoothstep(0, 0.5, sw) * (-0.5 + n(x / 22, z / 22) * 3.2 + n(x / 7, z / 7) * 0.8);
    h = h * land + -16 * (1 - land);
    // Bahía del puerto.
    const bay = 1 - smoothstep(0.75, 1.0, Math.hypot((x + 40) / 130, (z - 505) / 78));
    if (bay > 0) h = h * (1 - bay) + -8 * bay;
    return h;
  }

  // Peso del desierto (este) y de la ciénaga (suroeste), con bordes irregulares.
  desert(x, z) {
    const d = Math.hypot(x - 430, (z - 110) * 0.75) + this.noise(x / 70 + 20, z / 70) * 70;
    return 1 - smoothstep(150, 215, d);
  }

  swamp(x, z) {
    const d = Math.hypot(x + 345, z - 290) + this.noise(x / 50 + 40, z / 50 + 10) * 55;
    return 1 - smoothstep(70, 135, d);
  }

  biome(x, z, h) {
    const des = this.desert(x, z);
    const sw = this.swamp(x, z) * 1.1;
    const snow = smoothstep(36, 54, h + this.noise(x / 45, z / 45) * 12 + this.noise(x / 11 + 3, z / 11) * 4) * (1 - smoothstep(170, 250, Math.hypot(x + 300, z + 300) + this.noise(x / 40, z / 40) * 30));
    const quarry = bump(x, z, -95, -205, 48);
    return { des, sw, snow, quarry };
  }

  // ---------- Disposición del mapa (sin Three.js: la usa también el servidor) ----------
  layout() {
    const N = this.res + 1, half = this.size / 2;
    this.N = N;
    this.heights = new Float32Array(N * N);
    this.locked = new Uint8Array(N * N);
    this.roadDist = new Float32Array(N * N).fill(1e9);
    this.riverDist = new Float32Array(N * N).fill(1e9);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) this.heights[j * N + i] = this.rawHeight(-half + i * this.cell, -half + j * this.cell);
    // 1) pueblos: meseta plana (o pozo de la cantera)
    for (const t of PUEBLOS) this.stampTown(t);
    // 2) calles y rutas
    for (const t of PUEBLOS) for (const c of t.calles) {
      const pts = c.p.map(([x, z]) => [t.x + x, t.z + z]);
      const veredas = c.m === 'asfalto' && t.tema !== 'ciencia';
      if (veredas) this.ribbons.push({ pts: resample(pts, 3), w: c.w + 5, m: 'vereda', under: true });
      this.stampRoad(pts, c.w, c.m, !!c.suave, { ...c, pueblo: t.id, veredas });
    }
    for (const r of RUTAS) this.stampRoad(r.p, r.w, r.m, true, r);
    this.capasCalles();
    // 3) río (y puentes donde lo cruza una ruta)
    this.stampRiver();
    // 4) estructuras
    for (const t of PUEBLOS) {
      this.pois.push({ name: t.name, x: t.x, z: t.z, r: t.r, id: t.id, lx: t.etiqueta?.[0], lz: t.etiqueta?.[1] });
      for (const [name, opts, lx, lz, r, extra] of t.items) this.place(name, opts, t.x + lx, t.z + lz, r, extra || {}, t);
    }
    for (const [name, opts, x, z, r, extra] of SUELTOS) this.place(name, opts, x, z, r, extra || {}, null);
    this.suavizarCalles();
    // puentes: el tablero va de orilla a orilla siguiendo la ruta (inclinado), 10 cm arriba del terreno en las puntas
    for (const b of this.bridges) {
      const [ax, az] = b.rot === 1 ? [1, 0] : [0, 1];
      const e1 = this.terrainHeight(b.x + (ax * b.L) / 2, b.z + (az * b.L) / 2), e0 = this.terrainHeight(b.x - (ax * b.L) / 2, b.z - (az * b.L) / 2);
      b.y = (e0 + e1) / 2 + 0.1; b.dy = e1 - e0;
      this.place('puente', { L: b.L, w: b.w + 1, y: 0, dy: b.dy }, b.x, b.z, b.rot, { pad: false, y: b.y }, null);
    }
    this.layoutPostes();
    // Teleférico: torres con dos cables y cabinas colgando.
    const torres = TELEFERICO.map(([x, z]) => {
      this.place('torreTeleferico', {}, x, z, 0, { pad: false }, null);
      const t = this.placed[this.placed.length - 1];
      t.aisl = [[x - 3.6, t.y + 13.85, z], [x + 3.6, t.y + 13.85, z]];
      return t;
    });
    for (let i = 0; i < torres.length - 1; i++) this.cable(torres[i], torres[i + 1], { sagK: 0.008, r: 0.035, cabina: i % 2 ? 0.62 : 0.38 });
    // 5) vegetación y rocas
    const rand = rng(MAP_SEED ^ 0x9e3779b9);
    this.layoutTrees(rand);
    this.layoutRocks(rand);
    // Loot suelto en la naturaleza (poquito).
    for (let k = 0; k < 4000 && this.lootSpots.length < this.baseLoot + 40; k++) {
      const x = (rand() - 0.5) * this.size * 0.85, z = (rand() - 0.5) * this.size * 0.85;
      const h = this.terrainHeight(x, z);
      if (h < 2 || this.slopeAt(x, z) > 0.4 || this.nearSolid(x, z, 3) || this.inTown(x, z, 0)) continue;
      if (this.circles.some((c) => Math.abs(c.x - x) < c.r + 1 && Math.abs(c.z - z) < c.r + 1 && Math.hypot(c.x - x, c.z - z) < c.r + 0.8)) continue; // ni adentro de un árbol o una roca
      this.lootSpots.push({ x, y: h, z });
    }
  }

  gi(x) { return Math.round((x + this.size / 2) / this.cell); }

  // Recorre los vértices de la grilla en un rectángulo.
  eachVertex(x0, z0, x1, z1, fn) {
    const N = this.N, half = this.size / 2;
    const i0 = Math.max(0, Math.floor((x0 + half) / this.cell)), i1 = Math.min(N - 1, Math.ceil((x1 + half) / this.cell));
    const j0 = Math.max(0, Math.floor((z0 + half) / this.cell)), j1 = Math.min(N - 1, Math.ceil((z1 + half) / this.cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(j * N + i, -half + i * this.cell, -half + j * this.cell);
  }

  stampTown(t) {
    const R = t.r, F = t.borde || 50;
    if (t.h === 'auto') t.h0 = this.rawHeight(t.x, t.z) + (t.hOff || 0);
    this.eachVertex(t.x - R - F, t.z - R - F, t.x + R + F, t.z + R + F, (k, x, z) => {
      const lx = x - t.x, lz = z - t.z, d = Math.hypot(lx, lz);
      let w = 1 - smoothstep(R, R + F, d);
      if (t.corte !== undefined) w *= 1 - smoothstep(t.corte - 2, t.corte + 5, lz);
      if (w <= 0) return;
      let target = t.h === 'auto' ? t.h0 : t.h;
      if (t.ruido) target += (this.noise(x / 14, z / 14) * 2.6 + this.noise(x / 5, z / 5) * 0.5) * t.ruido + 0.2;
      if (t.pozo) {
        const q = 1 - smoothstep(t.pozo.r * 0.35, t.pozo.r, d);
        const steps = 3, s = q * steps, f = s - Math.floor(s);
        const terr = (Math.floor(s) + smoothstep(0.45, 1, f)) / steps;
        target -= t.pozo.prof * terr;
      }
      this.heights[k] = this.heights[k] * (1 - w) + target * w;
    });
  }

  // Suaviza y aplana el terreno a lo largo de una calle. smooth = ruta (perfil suavizado).
  // def.ini / def.fin = { r } termina la calle en una plazoleta redonda (rotonda, playón o atrio) en vez de cortarla.
  // Una calle de pueblo con suave: true se traza y se aplana como una ruta (la rampa de la cantera, que baja escalones).
  stampRoad(pts, w, m, smooth, def = {}) {
    const path = smooth ? catmull(pts, 3) : resample(pts, 3);
    const prof = path.map(([x, z]) => this.terrainHeight(x, z));
    if (smooth) {
      const raw = prof.slice();
      for (let pass = 0; pass < 3; pass++) {
        const cp = prof.slice();
        for (let i = 0; i < prof.length; i++) {
          let s = 0, c = 0;
          for (let k = -6; k <= 6; k++) { const v = cp[i + k]; if (v !== undefined) { s += v; c++; } }
          prof[i] = s / c;
        }
      }
      // las puntas quedan a la altura del lugar al que llegan (la calle del pueblo u otra ruta): sin escalón en el cruce
      const n = prof.length, K = Math.min(12, Math.floor(n / 2));
      const d0 = raw[0] - prof[0], d1 = raw[n - 1] - prof[n - 1];
      for (let i = 0; i < K; i++) { const f = smoothstep(0, 1, 1 - i / K); prof[i] += d0 * f; prof[n - 1 - i] += d1 * f; }
    }
    for (let i = 0; i < prof.length; i++) prof[i] = Math.max(prof[i], 0.9);
    const hw = w / 2 + 2.2, F = 9; // banquina plana: el pliegue del terreno queda afuera de la cinta
    const best = new Map();
    path.forEach(([px, pz], idx) => {
      this.eachVertex(px - hw - F, pz - hw - F, px + hw + F, pz + hw + F, (k, x, z) => {
        const d = Math.hypot(x - px, z - pz);
        if (d > hw + F) return;
        const b = best.get(k);
        if (!b || d < b.d) best.set(k, { d, h: prof[idx] });
      });
    });
    for (const [k, b] of best) {
      if (b.d < this.roadDist[k]) this.roadDist[k] = b.d - w / 2;
      if (this.locked[k]) continue;
      const t = 1 - smoothstep(hw, hw + F, b.d);
      this.heights[k] = this.heights[k] * (1 - t) + b.h * t;
    }
    const rb = { pts: path, w, m, def };
    this.ribbons.push(rb);
    for (const [cual, i] of [['ini', 0], ['fin', path.length - 1]]) {
      const r = def[cual]?.r;
      if (r) this.stampPlaza({ x: path[i][0], z: path[i][1], r, m: def[cual].m || m, h: prof[i], rb, vereda: def.veredas });
    }
  }

  // Alisa el terreno debajo de las calles: donde se juntan dos calles (o una calle y el aplanado de una estructura)
  // quedan escalones entre vértices de la grilla que asoman por arriba de la cinta. No toca lo aplanado por
  // estructuras ni el cauce del río.
  suavizarCalles(pasadas = 4) {
    const N = this.N, H = this.heights, rio = RIO.w / 2 + 9;
    const idx = [];
    for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
      const k = j * N + i;
      if (this.roadDist[k] < 1 && !this.locked[k] && this.riverDist[k] > rio) idx.push(k);
    }
    for (let p = 0; p < pasadas; p++) {
      const nv = idx.map((k) => (H[k] * 4 + H[k - 1] + H[k + 1] + H[k - N] + H[k + N] + (H[k - N - 1] + H[k - N + 1] + H[k + N - 1] + H[k + N + 1]) * 0.5) / 10);
      idx.forEach((k, n) => { H[k] = nv[n]; });
    }
  }

  // Plazoleta redonda al final de una calle: aplana el terreno y cuenta como calle (no crecen árboles ni van postes).
  stampPlaza(pq) {
    const hw = pq.r + 0.8, F = 6;
    this.eachVertex(pq.x - hw - F, pq.z - hw - F, pq.x + hw + F, pq.z + hw + F, (k, x, z) => {
      const d = Math.hypot(x - pq.x, z - pq.z);
      if (d > hw + F) return;
      this.roadDist[k] = Math.min(this.roadDist[k], d - pq.r);
      if (this.locked[k]) return;
      const t = 1 - smoothstep(hw, hw + F, d);
      this.heights[k] = this.heights[k] * (1 - t) + pq.h * t;
    });
    this.plazas.push(pq);
  }

  // Altura de dibujo de cada calle sobre el terreno. Una calle que desemboca en otra más ancha (o igual) va debajo,
  // así la que sigue de largo se ve entera en el cruce. Las plazas anchas (fuente, mercado) van arriba de las calles.
  capasCalles() {
    const rbs = this.ribbons.filter((r) => !r.under);
    const pares = [];
    for (const A of rbs) for (const p of [A.pts[0], A.pts[A.pts.length - 1]]) for (const B of rbs) {
      if (B === A || A.w > B.w) continue;
      const enB = distPoly(p, B.pts) < B.w / 2 - 0.3;
      const puntaB = Math.min(Math.hypot(p[0] - B.pts[0][0], p[1] - B.pts[0][1]), Math.hypot(p[0] - B.pts[B.pts.length - 1][0], p[1] - B.pts[B.pts.length - 1][1])) < B.w / 2 + 0.5;
      // en un cruce en T va debajo; si las dos siguen una en la otra, la más angosta va debajo
      if (enB && (!puntaB || A.w < B.w)) pares.push([A, B]);
    }
    for (const r of rbs) r.capa = 0;
    for (let it = 0; it < 8; it++) for (const [A, B] of pares) if (B.capa <= A.capa) B.capa = A.capa + 1;
    this.ribbons.forEach((rb, idx) => { rb.off = rb.under ? 0.045 : 0.07 + Math.min(rb.capa, 4) * 0.03 + (idx % 3) * 0.008; });
  }

  stampRiver() {
    const path = catmull(RIO.p, 3);
    const prof = path.map(([x, z]) => this.terrainHeight(x, z));
    for (let i = 1; i < prof.length; i++) prof[i] = Math.min(prof[i], prof[i - 1]);
    for (let pass = 0; pass < 2; pass++) for (let i = 1; i < prof.length - 1; i++) prof[i] = (prof[i - 1] + prof[i] + prof[i + 1]) / 3;
    this.river = { path, water: prof.map((h) => h - 0.55) };
    // Puentes: donde una ruta cruza el río.
    this.bridges = [];
    for (const rb of this.ribbons) {
      if (rb.m !== 'asfalto' && rb.m !== 'tierra') continue;
      for (let i = 0; i < rb.pts.length - 1; i += 1) {
        const [ax, az] = rb.pts[i];
        let hit = -1;
        for (let k = 0; k < path.length; k++) if (Math.hypot(path[k][0] - ax, path[k][1] - az) < 2.2) { hit = k; break; }
        if (hit < 0 || this.bridges.some((b) => Math.hypot(b.x - ax, b.z - az) < 30)) continue;
        const [bx, bz] = rb.pts[Math.min(rb.pts.length - 1, i + 2)], [cx, cz] = rb.pts[Math.max(0, i - 2)];
        const along = Math.abs(bx - cx) > Math.abs(bz - cz) ? 'x' : 'z';
        this.bridges.push({ x: ax, z: az, rot: along === 'x' ? 1 : 0, L: 28, w: rb.w, y: this.terrainHeight(ax, az) });
      }
    }
    const hw = RIO.w / 2, F = 8;
    const best = new Map();
    path.forEach(([px, pz], idx) => {
      this.eachVertex(px - hw - F, pz - hw - F, px + hw + F, pz + hw + F, (k, x, z) => {
        const d = Math.hypot(x - px, z - pz);
        const b = best.get(k);
        if (!b || d < b.d) best.set(k, { d, h: prof[idx] });
      });
    });
    for (const [k, b] of best) {
      this.riverDist[k] = Math.min(this.riverDist[k], b.d);
      const bed = b.h - 1.7;
      const t = 1 - smoothstep(hw * 0.5, hw + F, b.d);
      const target = bed * t + this.heights[k] * (1 - t);
      this.heights[k] = Math.min(this.heights[k], target);
    }
  }

  // Ubica una estructura: calcula su base, aplana el terreno debajo y registra sólidos y loot.
  place(name, opts, x, z, r, extra, town) {
    if (name === 'arbol' || name === 'pino' || name === 'alamo') {
      const h = this.terrainHeight(x, z), sc = opts.s || 1;
      const tree = { x, z, y: h, s: sc, r: (x * 7.1 + z * 3.3) % 6.28, pine: name === 'pino', sy: name === 'alamo' ? 1.9 : 1, sxz: name === 'alamo' ? 0.62 : 1, alive: true, town: true };
      tree.circle = { x, z, r: 0.45 * sc, bottom: h - 1, top: h + 7 * sc * tree.sy };
      this.circles.push(tree.circle);
      this.trees.push(tree);
      return;
    }
    const fn = PLANOS[name];
    if (!fn) return;
    if (opts.jardin) {
      const [jx, jz] = rot2(0, (opts.d || 8) / 2, r);
      // el caminito va frente a la puerta (en las casas con var impar la puerta está corrida)
      this.place('jardin', { w: (opts.w || 9) + 3, d: opts.jardin, px: name === 'casa' && opts.var % 2 ? -(opts.w || 9) * 0.2 : 0 }, x + jx, z + jz, r, {}, town);
    }
    const P = fn(opts);
    const b = P.bounds();
    const c = [rot2(b.x0, b.z0, r), rot2(b.x1, b.z1, r)];
    const fp = { x0: x + Math.min(c[0][0], c[1][0]), x1: x + Math.max(c[0][0], c[1][0]), z0: z + Math.min(c[0][1], c[1][1]), z1: z + Math.max(c[0][1], c[1][1]) };
    let base = extra.y;
    if (base === undefined) {
      if (town && extra.pad !== false) base = this.terrainHeight(x, z);
      else {
        const s = [[x, z], [fp.x0, fp.z0], [fp.x1, fp.z0], [fp.x0, fp.z1], [fp.x1, fp.z1]].map(([a, bb]) => this.terrainHeight(a, bb));
        base = extra.pad === false ? Math.min(...s) : s.reduce((a, bb) => a + bb, 0) / s.length;
      }
    }
    base += extra.dy || 0;
    if (extra.pad !== false && !extra.dy && !SIN_APLANAR.has(name)) this.flatten(fp, base, town ? 5 : 9);
    // piezas rompibles: ids globales (el servidor y el cliente arman el mismo mundo en el mismo orden)
    const pz = piezasDe(P), fijaTodo = NO_ROMPE.has(name), local = [], ids = new Map();
    for (const p of pz.lista) {
      const id = this.piezas.length, a = p.aabb;
      const q = [rot2(a[0], a[2], r), rot2(a[3], a[5], r)];
      this.piezas.push({
        id, placed: this.placed.length, i: local.length, fija: p.fija || fijaTodo, clase: p.clase, color: p.color,
        hp: Math.round(MATERIALS[p.clase].hp * p.factor), solids: [], rota: false,
        aabb: [x + Math.min(q[0][0], q[1][0]), base + a[1], z + Math.min(q[0][1], q[1][1]), x + Math.max(q[0][0], q[1][0]), base + a[4], z + Math.max(q[0][1], q[1][1])],
      });
      local.push(id);
    }
    for (const [g, i] of pz.deGrupo) ids.set(g, i >= 0 ? local[i] : -1);
    const dePieza = (so, g) => { const id = ids.get(g) ?? -1; if (id >= 0) { so.pz = id; this.piezas[id].solids.push(so); } };
    // sólidos en coordenadas del mundo
    for (const s of P.solids) {
      const q = [rot2(s.x0, s.z0, r), rot2(s.x1, s.z1, r)];
      const w = { x0: x + Math.min(q[0][0], q[1][0]), x1: x + Math.max(q[0][0], q[1][0]), z0: z + Math.min(q[0][1], q[1][1]), z1: z + Math.max(q[0][1], q[1][1]), y0: base + s.y0, y1: base + s.y1 };
      if (s.up) { w.up = ROT_DIR[s.up][r & 3]; w.lo = base + (s.lo ?? s.y0); }
      if (s.vidrio) w.vidrio = true; // ventanas: frenan al jugador, no a las balas ni a la cámara
      dePieza(this.sol.addBox(w, name), s.g);
    }
    for (const cy of P.cyls) {
      const [cx, cz] = rot2(cy.x, cy.z, r);
      dePieza(this.sol.addCyl(x + cx, z + cz, cy.r, base + cy.y0, base + cy.y1, name), cy.g);
    }
    for (const l of P.loot) { const [lx, lz] = rot2(l.x, l.z, r); this.lootSpots.push({ x: x + lx, y: base + l.y, z: z + lz }); }
    for (const g of P.signs || []) { const [lx, lz] = rot2(g.x, g.z, r); this.signs.push({ ...g, x: x + lx, y: base + g.y, z: z + lz, r }); }
    for (const ch of P.chests) { const [lx, lz] = rot2(ch.x, ch.z, r); this.chestSpots.push({ x: x + lx, y: base + ch.y, z: z + lz, rot: ((ch.rot + r) * Math.PI) / 2 }); }
    this.baseLoot = this.lootSpots.length;
    this.placed.push({ name, P, r, x, y: base, z, fp, town: town?.id, piezas: local, ids, lista: pz.lista });
  }

  // ---------- Piezas rompibles ----------
  // Rompe una pieza del mapa: deja de chocar y (en el cliente) desaparece de las mallas. Devuelve la pieza, o null.
  romperPieza(id) {
    const pz = this.piezas[id];
    if (!pz || pz.rota || pz.fija) return null;
    pz.rota = true;
    for (const s of pz.solids) this.sol.remove(s);
    if (this.lotePz) { this.lotePz.get(id)?.ocultar(id); for (const L of this.lotesChoque) L.ocultar(id); }
    return pz;
  }

  // Piezas de la misma estructura que quedan en el aire (sin llegar al piso por piezas sanas).
  piezasSinApoyo(id) {
    const pl = this.placed[this.piezas[id]?.placed];
    if (!pl?.lista) return [];
    if (!pl.vec) pl.vec = vecinasDe(pl.lista);
    const rotas = new Set();
    pl.piezas.forEach((gid, i) => { if (this.piezas[gid].rota) rotas.add(i); });
    return sinApoyo(pl.lista, pl.vec, rotas).map((i) => pl.piezas[i]).filter((gid) => !this.piezas[gid].fija);
  }

  // Postes de luz con cables a lo largo de las rutas asfaltadas, e indicadores a la salida de los pueblos.
  layoutPostes() {
    const libre = (x, z, minRoad) => {
      if (this.inTown(x, z, 4) || this.terrainHeight(x, z) < 0.8 || this.slopeAt(x, z) > 0.5) return false;
      if (this.gridVal(this.riverDist, x, z) < 10 || this.nearSolid(x, z, 1.6)) return false;
      if (this.bridges.some((b) => Math.hypot(b.x - x, b.z - z) < 22)) return false;
      for (const rb of this.ribbons) for (const [px, pz] of rb.pts) if (Math.hypot(px - x, pz - z) - rb.w / 2 < minRoad) return false;
      for (const pq of this.plazas) if (Math.hypot(pq.x - x, pq.z - z) - pq.r < minRoad) return false;
      return true;
    };
    const cerca = (x, z) => {
      let best = null, bd = Infinity;
      for (const t of PUEBLOS) { const d = Math.hypot(t.x - x, t.z - z) - t.r; if (d < bd) { bd = d; best = t; } }
      return bd < 45 ? best : null;
    };
    const flecha = (dx, dz) => (Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : dz > 0 ? 0 : 2);
    const indicadores = [];
    for (const ru of RUTAS) {
      const path = catmull(ru.p, 3);
      const tan = (i) => { const [ax, az] = path[Math.max(0, i - 2)], [bx, bz] = path[Math.min(path.length - 1, i + 2)]; const L = Math.hypot(bx - ax, bz - az) || 1; return [(bx - ax) / L, (bz - az) / L]; };
      // indicadores en los dos extremos, del lado izquierdo de la ruta
      const ini = cerca(...path[0]), fin = cerca(...path[path.length - 1]);
      for (const [from, to, dirSign, order] of [[ini, fin, 1, path.map((_, i) => i)], [fin, ini, -1, path.map((_, i) => path.length - 1 - i)]]) {
        if (!from || !to || from === to) continue;
        for (const i of order) {
          const [px, pz] = path[i];
          if (this.inTown(px, pz, 8)) continue;
          const [tx, tz] = tan(i), sx = tx * dirSign, sz = tz * dirSign;
          const x = px + sz * (ru.w / 2 + 2.2), z = pz - sx * (ru.w / 2 + 2.2);
          if (indicadores.some((q) => Math.hypot(q[0] - x, q[1] - z) < 30) || !libre(x, z, 1.2)) break;
          indicadores.push([x, z]);
          this.place('indicador', { textos: [[to.name, flecha(sx, sz)], [from.name, flecha(-sx, -sz)]] }, x, z, 0, { pad: false }, null);
          break;
        }
      }
      if (ru.m !== 'asfalto') continue;
      // postes cada ~38 m del lado derecho, con cables entre vecinos
      let prev = null, acc = 0;
      for (let i = 1; i < path.length; i++) {
        acc += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
        if (acc < 38) continue;
        acc = 0;
        const [tx, tz] = tan(i), off = ru.w / 2 + 2.6;
        const x = path[i][0] - tz * off, z = path[i][1] + tx * off;
        if (!libre(x, z, 1.8)) { prev = null; continue; }
        const r = Math.abs(tx) > Math.abs(tz) ? 1 : 0;
        this.place('poste', {}, x, z, r, { pad: false }, null);
        const cur = this.placed[this.placed.length - 1];
        cur.aisl = [-0.9, 0, 0.9].map((lx) => { const [ax, az] = rot2(lx, 0, r); return [x + ax, cur.y + 7.62, z + az]; });
        if (prev && Math.hypot(prev.x - x, prev.z - z) < 60) this.cable(prev, cur);
        prev = cur;
      }
    }
  }

  // Cables con comba entre los puntos de amarre de dos postes (o torres). cabina: dónde cuelga una cabina (0..1).
  cable(A, B, { sagK = 0.018, r = 0.022, cabina = null } = {}) {
    const ux = B.x - A.x, uz = B.z - A.z, L = Math.hypot(ux, uz);
    const nx = -uz / L, nz = ux / L;
    const ord = (arr) => arr.slice().sort((p, q) => (p[0] * nx + p[2] * nz) - (q[0] * nx + q[2] * nz));
    const a = ord(A.aisl), b = ord(B.aisl);
    const P = new Plano();
    const sag = sagK * L, n = Math.max(10, Math.ceil(L / 4));
    const at = (w, t) => [a[w][0] + (b[w][0] - a[w][0]) * t - A.x, a[w][1] + (b[w][1] - a[w][1]) * t - 4 * sag * t * (1 - t) - A.y, a[w][2] + (b[w][2] - a[w][2]) * t - A.z];
    for (let w = 0; w < a.length; w++) {
      let last = null;
      for (let k = 0; k <= n; k++) {
        const p = at(w, k / n);
        if (last) P.tube(last, p, r, 'negro', 4);
        last = p;
      }
    }
    if (cabina !== null) {
      const [cx, cy, cz] = at(0, cabina);
      P.tube([cx, cy, cz], [cx, cy - 2.2, cz], 0.06, 'metal_osc', 5);
      P.cbox(cx, cy - 2.4, cz, 0.9, 0.2, 0.9, 'metal_osc', false);
      P.cbox(cx, cy - 4.5, cz, 2.0, 2.1, 1.8, 'rojo', false);
      P.cbox(cx, cy - 3.6, cz, 2.06, 0.8, 1.86, 'vidrio', false);
      P.cbox(cx, cy - 2.4 - 0.05, cz, 2.1, 0.12, 1.9, 'blanco', false);
    }
    this.placed.push({ name: 'cables', P, r: 0, x: A.x, y: A.y, z: A.z, fp: { x0: Math.min(A.x, B.x), x1: Math.max(A.x, B.x), z0: Math.min(A.z, B.z), z1: Math.max(A.z, B.z) } });
  }

  // Aplana exactamente la huella (así la puerta queda al ras del piso) y suaviza alrededor.
  flatten(fp, base, F) {
    const m = this.cell * 1.01;
    this.eachVertex(fp.x0 - m - F, fp.z0 - m - F, fp.x1 + m + F, fp.z1 + m + F, (k, x, z) => {
      const dx = Math.max(fp.x0 - m - x, 0, x - fp.x1 - m), dz = Math.max(fp.z0 - m - z, 0, z - fp.z1 - m);
      const d = Math.hypot(dx, dz);
      if (d <= 0) { this.heights[k] = base; this.locked[k] = 1; return; }
      if (this.locked[k]) return;
      const t = 1 - smoothstep(0, F, d);
      this.heights[k] = this.heights[k] * (1 - t) + base * t;
    });
  }

  inTown(x, z, pad = 0) { return this.pois.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + pad); }
  nearSolid(x, z, rad) { let hit = false; this.sol.near(x, z, rad, (s) => { if (!hit && x > s.x0 - rad && x < s.x1 + rad && z > s.z0 - rad && z < s.z1 + rad) hit = true; }); return hit; }
  gridVal(arr, x, z) {
    const i = Math.min(this.N - 1, Math.max(0, this.gi(x))), j = Math.min(this.N - 1, Math.max(0, this.gi(z)));
    return arr[j * this.N + i];
  }

  layoutTrees(rand) {
    const half = this.size / 2;
    for (let k = 0; k < 30000 && this.trees.length < 1300; k++) {
      const x = (rand() - 0.5) * this.size, z = (rand() - 0.5) * this.size;
      const s = 0.8 + rand() * 0.7, r = rand() * Math.PI * 2, kind = rand();
      if (Math.hypot(x, z) > half) continue;
      const h = this.terrainHeight(x, z);
      if (h < 2.5 || h > 92 || this.slopeAt(x, z) > 0.55) continue;
      if (this.gridVal(this.roadDist, x, z) < 4 || this.gridVal(this.riverDist, x, z) < 7) continue;
      if (this.inTown(x, z, -6) || this.nearSolid(x, z, 4)) continue;
      const bio = this.biome(x, z, h);
      if (bio.des > 0.5) {
        if (this.cacti.length < 140 && kind < 0.5) this.cacti.push({ x, z, y: h, s: 0.8 + rand() * 0.6, r });
        continue;
      }
      if (bio.quarry > 0.2) continue;
      const forest = this.noise(x / 110 + 50, z / 110 + 50);
      if (forest < -0.05 && kind > 0.1) { if (this.bushes.length < 900 && kind < 0.5) this.bushes.push({ x, z, y: h, s: 0.6 + rand() * 0.8, r }); continue; }
      const tree = { x, z, y: h, s, r, pine: bio.snow > 0.2 || h > 38 || (kind < 0.35 && bio.sw < 0.2), alive: true };
      tree.circle = { x, z, r: 0.45 * s, bottom: h - 1, top: h + 7 * s };
      this.circles.push(tree.circle);
      this.trees.push(tree);
    }
    // arbustos en los bordes de los pueblos
    for (let k = 0; k < 6000 && this.bushes.length < 1300; k++) {
      const x = (rand() - 0.5) * this.size, z = (rand() - 0.5) * this.size;
      const h = this.terrainHeight(x, z);
      if (h < 2 || this.slopeAt(x, z) > 0.5 || this.gridVal(this.roadDist, x, z) < 2 || this.nearSolid(x, z, 1.5)) continue;
      const bio = this.biome(x, z, h);
      if (bio.des > 0.5 || bio.snow > 0.5 || bio.quarry > 0.3) continue;
      this.bushes.push({ x, z, y: h, s: 0.5 + rand() * 0.7, r: rand() * 6 });
    }
    for (const c of this.cacti) { c.circle = { x: c.x, z: c.z, r: 0.35 * c.s, bottom: c.y - 1, top: c.y + 3.2 * c.s }; this.circles.push(c.circle); }
  }

  layoutRocks(rand) {
    for (let k = 0; k < 6000 && this.rocks.length < 320; k++) {
      const x = (rand() - 0.5) * this.size, z = (rand() - 0.5) * this.size;
      const s = 0.6 + rand() * 2.2, r = rand() * 6;
      const h = this.terrainHeight(x, z);
      if (h < 1 || this.gridVal(this.roadDist, x, z) < 3 || this.gridVal(this.riverDist, x, z) < 5) continue;
      if (this.inTown(x, z, -10) || this.nearSolid(x, z, s + 2)) continue;
      const bio = this.biome(x, z, h);
      if (rand() > 0.35 + bio.snow * 0.4 + bio.quarry * 0.6) continue;
      const rock = { x, z, y: h, s, r, alive: true };
      rock.circle = { x, z, r: s * 1.1, bottom: h - s, top: h + s * 0.75 };
      this.circles.push(rock.circle);
      this.rocks.push(rock);
    }
  }

  // Altura interpolada igual que los triángulos de la malla.
  terrainHeight(x, z) {
    const half = this.size / 2;
    const N = this.res + 1;
    const fx = (x + half) / this.cell, fz = (z + half) / this.cell;
    const i = Math.max(0, Math.min(this.res - 1, Math.floor(fx)));
    const j = Math.max(0, Math.min(this.res - 1, Math.floor(fz)));
    const u = Math.min(1, Math.max(0, fx - i)), v = Math.min(1, Math.max(0, fz - j));
    const h00 = this.heights[j * N + i], h10 = this.heights[j * N + i + 1];
    const h01 = this.heights[(j + 1) * N + i], h11 = this.heights[(j + 1) * N + i + 1];
    if (u + v <= 1) return h00 + (h10 - h00) * u + (h01 - h00) * v;
    return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
  }

  // Piso más alto debajo de (x,z) que se puede pisar desde la altura y (terreno, edificios o construcciones).
  groundHeight(x, z, y = Infinity) {
    let h = this.terrainHeight(x, z);
    const s = this.sol.ground(x, z, y);
    if (s > h) h = s;
    for (const st of this.structs.values()) {
      if (st.type === 'pared') continue;
      const x0 = st.i * GRID, z0 = st.j * GRID;
      if (x < x0 || x > x0 + GRID || z < z0 || z > z0 + GRID) continue;
      let top = st.y;
      if (st.type === 'rampa') {
        const t = st.dir === 0 ? z0 + GRID - z : st.dir === 2 ? z - z0 : st.dir === 1 ? x - x0 : x0 + GRID - x;
        top = st.y + t;
      }
      if (y >= top - 1.2 && top > h) h = top;
    }
    return h;
  }

  ceilingHeight(x, z, feet) { return this.sol.ceiling(x, z, feet); }

  // Mueve un cuerpo (pies en pos) en pasos chicos: nunca atraviesa pisos, techos ni paredes aunque vaya rápido.
  moveBody(pos, vel, dt, radius = 0.45, height = 1.8) {
    const n = Math.min(40, Math.max(1, Math.ceil((Math.hypot(vel.x, vel.y, vel.z) * dt) / 0.25)));
    const h = dt / n;
    for (let k = 0; k < n; k++) {
      const prevY = pos.y;
      pos.x += vel.x * h; pos.y += vel.y * h; pos.z += vel.z * h;
      if (vel.y > 0) {
        const c = this.sol.ceiling(pos.x, pos.z, prevY);
        if (pos.y + height > c) { pos.y = Math.max(prevY, c - height); vel.y = 0; }
      }
      const g = this.groundHeight(pos.x, pos.z, Math.max(prevY, pos.y));
      if (pos.y < g) pos.y = g;
      this.collide(pos, radius, height);
    }
  }

  slopeAt(x, z) {
    const s = 4;
    const dx = this.terrainHeight(x + s, z) - this.terrainHeight(x - s, z);
    const dz = this.terrainHeight(x, z + s) - this.terrainHeight(x, z - s);
    return Math.hypot(dx, dz) / (2 * s);
  }

  insideHouse(x, z, pad = 3) { return this.nearSolid(x, z, pad); }

  // ---------- Mallas (sólo cliente) ----------
  build(scene) {
    this.scene = scene;
    this.buildTerrain(scene);
    this.buildWater(scene);
    this.buildRoads(scene);
    this.buildStructures(scene);
    this.buildTrees(scene);
    this.buildPlants(scene);
    this.buildRocks(scene);
    this.buildChests(scene);
    this.buildSigns(scene);
  }

  terrainColor(x, z, y, slope, c) {
    const n = this.noise(x / 9, z / 9) * 0.5 + 0.5;
    const bio = this.biome(x, z, y);
    const road = this.gridVal(this.roadDist, x, z), river = this.gridVal(this.riverDist, x, z);
    if (y < -1.2 && bio.sw < 0.3) c.copy(COL.seabed);
    else if (y < 2.2 && bio.sw < 0.3) c.copy(COL.sand);
    else {
      c.copy(COL.grass).lerp(COL.grass2, n);
      if (bio.sw > 0) c.lerp(COL.mud, smoothstep(0.2, 0.6, bio.sw) * (0.5 + n * 0.5));
      if (bio.des > 0) c.lerp(COL.desert, smoothstep(0.2, 0.7, bio.des)).lerp(COL.desert2, bio.des * n * 0.5);
      if (y > 24) c.lerp(COL.alpine, smoothstep(24, 60, y) * 0.45 * (1 - bio.snow));
      if (slope > 0.42) c.lerp(bio.quarry > 0.2 ? COL.redrock : COL.rock, smoothstep(0.42, 0.62, slope));
      if (bio.quarry > 0) c.lerp(n > 0.5 ? COL.redrock : COL.redrock2, smoothstep(0, 0.5, bio.quarry));
      if (bio.snow > 0) {
        // nieve con matices: zonas azuladas (viento y sombra) y, lejos de las casas, algunas rocas que asoman
        const v = this.noise(x / 26 - 9, z / 26 + 2), r = this.noise(x / 22 + 7, z / 22 - 4);
        const lejos = smoothstep(0, 25, Math.min(...this.pois.map((t) => Math.hypot(t.x - x, t.z - z) - t.r)));
        c.lerp(COL.snow, bio.snow * (0.8 + 0.2 * smoothstep(0.3, 0.7, n + bio.snow - 0.5)));
        c.lerp(COL.snowsh, bio.snow * smoothstep(-0.08, 0.12, v) * 0.8);
        c.lerp(n > 0.5 ? COL.rock : COL.rock2, bio.snow * Math.max(smoothstep(0.7, 1.1, slope), smoothstep(0.17, 0.23, r) * 0.85 * lejos));
      }
      if (road < 2.5) c.lerp(COL.dirt, (1 - smoothstep(0, 2.5, road)) * 0.3);
      if (river < 7) c.lerp(COL.mud, (1 - smoothstep(3, 7, river)) * 0.8);
    }
    c.offsetHSL(0, 0, (n - 0.5) * 0.04);
    return c;
  }

  buildTerrain(scene) {
    const N = this.res + 1;
    const half = this.size / 2;
    const positions = [];
    const colors = [];
    const c = new THREE.Color();
    const v = (i, j) => [-half + i * this.cell, this.heights[j * N + i], -half + j * this.cell];
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nrm = new THREE.Vector3();
    for (let j = 0; j < this.res; j++) {
      for (let i = 0; i < this.res; i++) {
        const a = v(i, j), b = v(i + 1, j), d = v(i, j + 1), e = v(i + 1, j + 1);
        for (const tri of [[a, d, b], [d, e, b]]) {
          const y = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
          e1.set(tri[1][0] - tri[0][0], tri[1][1] - tri[0][1], tri[1][2] - tri[0][2]);
          e2.set(tri[2][0] - tri[0][0], tri[2][1] - tri[0][1], tri[2][2] - tri[0][2]);
          nrm.crossVectors(e1, e2).normalize();
          const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cz = (tri[0][2] + tri[1][2] + tri[2][2]) / 3;
          this.terrainColor(cx, cz, y, 1 - Math.abs(nrm.y), c);
          for (const p of tri) { positions.push(...p); colors.push(c.r, c.g, c.b); }
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, terrainDetail(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 })));
    mesh.receiveShadow = true;
    scene.add(mesh);
    this.terrainMesh = mesh;
  }

  buildWater(scene) {
    const geo = new THREE.PlaneGeometry(this.size * 6, this.size * 6, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: '#2a9fd6', transparent: true, opacity: 0.82, roughness: 0.14, metalness: 0.05 });
    // Profundidad (R) y ciénaga (G) por vértice de la grilla: color según profundidad y espuma en la orilla.
    const N = this.N, data = new Uint8Array(N * N * 4), half = this.size / 2;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i, d = Math.min(20, Math.max(-4, -this.heights[k]));
      data[k * 4] = Math.round(((d + 4) / 24) * 255);
      data[k * 4 + 1] = Math.round(Math.min(1, this.swamp(-half + i * this.cell, -half + j * this.cell) * 1.3) * 255);
      data[k * 4 + 3] = 255;
    }
    const htex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
    htex.magFilter = THREE.LinearFilter; htex.minFilter = THREE.LinearFilter; htex.needsUpdate = true;
    const time = { value: 0 };
    aguaShader(mat, { time, htex, half, cell: this.cell, N, mar: true });
    this.water = new THREE.Mesh(geo, mat);
    this.water.position.y = SEA_LEVEL;
    this.water.onBeforeRender = () => { time.value = performance.now() / 1000; };
    scene.add(this.water);
    // río: cinta de agua siguiendo el cauce
    const { path, water } = this.river;
    const pos = [];
    for (let i = 0; i < path.length - 1; i++) {
      const [ax, az] = path[i], [bx, bz] = path[i + 1];
      const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L, w = RIO.w * 0.62;
      const ya = Math.max(water[i], 0.05), yb = Math.max(water[i + 1], 0.05);
      const p0 = [ax + nx * w, ya, az + nz * w], p1 = [ax - nx * w, ya, az - nz * w], p2 = [bx - nx * w, yb, bz - nz * w], p3 = [bx + nx * w, yb, bz + nz * w];
      pos.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    rg.computeVertexNormals();
    const rmat = new THREE.MeshStandardMaterial({ color: '#45b6e3', transparent: true, opacity: 0.8, roughness: 0.12, side: THREE.DoubleSide });
    aguaShader(rmat, { time, mar: false });
    const rm = new THREE.Mesh(rg, rmat);
    scene.add(rm);
  }

  // ¿El punto está sobre el tablero de un puente? (ahí no se dibuja la calle: el tablero la reemplaza)
  enPuente(x, z, margen = 0) {
    for (const b of this.bridges || []) {
      const [ax, az] = b.rot === 1 ? [1, 0] : [0, 1], dx = x - b.x, dz = z - b.z;
      if (Math.abs(dx * ax + dz * az) < b.L / 2 + margen && Math.abs(-dx * az + dz * ax) < (b.w + 1) / 2 + 0.5 + margen) return true;
    }
    return false;
  }

  // Tramo [t0, t1] del segmento i..i+1 de la cinta que queda fuera de los puentes (o null si está todo sobre uno).
  tramoFueraDePuente(pts, i) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const ia = this.enPuente(ax, az), ib = this.enPuente(bx, bz);
    if (!ia && !ib) return [0, 1];
    if (ia && ib) return null;
    let lo = 0, hi = 1; // bisección hasta el borde del puente
    for (let k = 0; k < 20; k++) { const m = (lo + hi) / 2; if (this.enPuente(ax + (bx - ax) * m, az + (bz - az) * m) === ia) lo = m; else hi = m; }
    return ia ? [hi, 1] : [0, lo];
  }

  // Discos que redondean las calles: plazoletas de remate, puntas y esquinas (tapan los huecos en forma de cuña
  // que dejan dos cintas que se juntan en ángulo). Cada disco va un poco más abajo que su calle.
  discosCalles() {
    if (this._discos) return this._discos;
    const out = [], rbs = this.ribbons;
    const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    for (const pq of this.plazas) {
      if (pq.vereda) out.push({ x: pq.x, z: pq.z, r: pq.r + 2.5, off: 0.042, m: 'vereda' });
      out.push({ x: pq.x, z: pq.z, r: pq.r, off: pq.rb.off - 0.004, m: pq.m });
    }
    rbs.forEach((rb, idx) => {
      const pts = rb.pts, n = pts.length;
      for (const i of [0, n - 1]) {
        const p = pts[i];
        if (this.enPuente(p[0], p[1], 0.5) || this.plazas.some((pq) => pq.rb === rb && d2([pq.x, pq.z], p) < 0.5)) continue;
        if (rb.under) {
          // la vereda se redondea sólo donde dobla o se cruza con otra vereda (no a la salida del pueblo)
          if (!rbs.some((o) => o !== rb && o.under && distPoly(p, o.pts) < o.w / 2)) continue;
          out.push({ x: p[0], z: p[1], r: rb.w / 2, off: 0.042, m: rb.m });
          continue;
        }
        // una plaza ancha que termina sobre una calle más angosta no se redondea (se saldría de la plaza)
        if (rbs.some((o) => o !== rb && !o.under && o.w < rb.w && distPoly(p, o.pts) < o.w / 2)) continue;
        // dos calles que siguen una en la otra: la tapa la pone sólo la de más arriba
        const otra = rbs.some((o, j) => o !== rb && !o.under && (o.off > rb.off || (o.off === rb.off && j < idx)) && Math.min(d2(o.pts[0], p), d2(o.pts[o.pts.length - 1], p)) < Math.min(o.w, rb.w) / 2);
        if (!otra) out.push({ x: p[0], z: p[1], r: rb.w / 2, off: rb.off - 0.004, m: rb.m });
      }
      // esquinas: donde la cinta dobla más de 20° el ancho se angosta; un disco lo completa
      for (let i = 1; i < n - 1; i++) {
        const [ax, az] = pts[i - 1], [bx, bz] = pts[i], [cx, cz] = pts[i + 1];
        const u = Math.atan2(bz - az, bx - ax), v = Math.atan2(cz - bz, cx - bx);
        let da = Math.abs(v - u); if (da > Math.PI) da = 2 * Math.PI - da;
        if (da > 0.35 && !this.enPuente(bx, bz, 0.5)) out.push({ x: bx, z: bz, r: rb.w / 2, off: rb.under ? 0.042 : rb.off - 0.006, m: rb.m });
      }
    });
    return (this._discos = out);
  }

  // Triángulos de las calles (sin Three.js, para poder probarlos): pos = [x,y,z,...] y mat = material de cada triángulo.
  trisCalles() {
    if (this._tris) return this._tris;
    const pos = [], mat = [];
    const tri = (m, ...ps) => { for (const p of ps) pos.push(...p); mat.push(m); };
    this.ribbons.forEach((rb) => {
      const off = rb.off;
      const pts = rb.pts;
      // dirección de la cinta en el punto i (promedio de los dos tramos)
      const dir = (i) => {
        const [ax, az] = pts[Math.max(0, i - 1)], [bx, bz] = pts[Math.min(pts.length - 1, i + 1)];
        const L = Math.hypot(bx - ax, bz - az) || 1;
        return [(bx - ax) / L, (bz - az) / L];
      };
      // borde de la cinta a la altura t del tramo i..i+1, corrido s a un costado
      const edge = (i, s, t = 0) => {
        const [ax, az] = pts[i], [bx, bz] = pts[Math.min(pts.length - 1, i + 1)];
        const da = dir(i), db = dir(Math.min(pts.length - 1, i + 1));
        let dx = da[0] + (db[0] - da[0]) * t, dz = da[1] + (db[1] - da[1]) * t;
        const L = Math.hypot(dx, dz) || 1;
        dx /= L; dz /= L;
        const x = ax + (bx - ax) * t - dz * s, z = az + (bz - az) * t + dx * s;
        return [x, this.terrainHeight(x, z) + off, z];
      };
      for (let i = 0; i < pts.length - 1; i++) {
        const w = rb.w / 2;
        const tr = this.tramoFueraDePuente(pts, i);
        if (!tr) continue;
        const [t0, t1] = tr;
        const ea = (s) => edge(i, s, t0), eb = (s) => edge(i, s, t1);
        // en celdas de 1,5 m a lo largo y 2 m a lo ancho como mucho: la cinta sigue el terreno (la grilla es de 4 m)
        // y no asoma el pasto por el medio
        const segL = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) * (t1 - t0);
        const steps = Math.max(1, Math.ceil(segL / 1.5)), lanes = Math.max(1, Math.ceil(rb.w / 2));
        for (let st = 0; st < steps; st++) {
          const ta = t0 + ((t1 - t0) * st) / steps, tb = t0 + ((t1 - t0) * (st + 1)) / steps;
          for (let l = 0; l < lanes; l++) {
            const s0 = w - (2 * w * l) / lanes, s1 = w - (2 * w * (l + 1)) / lanes;
            const a = edge(i, s0, ta), b = edge(i, s1, ta), d = edge(i, s1, tb), e = edge(i, s0, tb);
            tri(rb.m, a, b, d); tri(rb.m, a, d, e);
          }
        }
        // la línea del medio no se pinta en los primeros y últimos metros (en los cruces se juntarían varias)
        if (rb.m === 'asfalto' && rb.w >= 6 && i % 3 === 0 && i >= 4 && i < pts.length - 5) {
          const a2 = ea(0.12), b2 = ea(-0.12), d2 = eb(-0.12), e2 = eb(0.12);
          for (const p of [a2, b2, d2, e2]) p[1] += 0.01;
          tri('linea', a2, b2, d2); tri('linea', a2, d2, e2);
        }
      }
    });
    // discos (en anillos, para que sigan el terreno)
    for (const q of this.discosCalles()) {
      const seg = Math.max(14, Math.min(48, Math.ceil((q.r * Math.PI * 2) / 1.5))), rings = Math.max(1, Math.ceil(q.r / 1.5));
      const at = (k, j) => {
        if (k === 0) return [q.x, this.terrainHeight(q.x, q.z) + q.off, q.z];
        const a = (j / seg) * Math.PI * 2, rr = (q.r * k) / rings, x = q.x + Math.cos(a) * rr, z = q.z + Math.sin(a) * rr;
        return [x, this.terrainHeight(x, z) + q.off, z];
      };
      for (let k = 0; k < rings; k++) for (let j = 0; j < seg; j++) {
        const p0 = at(k, j), p1 = at(k, j + 1), p2 = at(k + 1, j + 1), p3 = at(k + 1, j);
        if (k === 0) tri(q.m, p0, p2, p3);
        else { tri(q.m, p0, p1, p2); tri(q.m, p0, p2, p3); }
      }
    }
    return (this._tris = { pos, mat });
  }

  buildRoads(scene) {
    const { pos, mat } = this.trisCalles();
    const col = [], cache = {};
    const c = new THREE.Color();
    for (const m of mat) {
      if (!cache[m]) { c.set(m === 'linea' ? '#f2efe6' : CALLE_COLOR[m] || '#888'); cache[m] = [c.r, c.g, c.b]; }
      for (let k = 0; k < 3; k++) col.push(...cache[m]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, terrainDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide })));
    m.receiveShadow = true;
    scene.add(m);
  }

  buildStructures(scene) {
    const mats = materialesMapa();
    const CH = 160;
    const chunks = new Map();
    const lote = (x, z) => {
      const k = `${Math.floor(x / CH)},${Math.floor(z / CH)}`;
      if (!chunks.has(k)) chunks.set(k, new Lote());
      return chunks.get(k);
    };
    const M = new THREE.Matrix4(), R = new THREE.Matrix4();
    const rand = rng(MAP_SEED + 7);
    this.lotePz = new Map(); // pieza -> lote donde están sus triángulos
    for (const p of this.placed) {
      M.makeTranslation(p.x, p.y, p.z).multiply(R.makeRotationY((p.r * Math.PI) / 2));
      const L = lote(p.x, p.z);
      let piezaDe = null;
      if (p.ids) {
        piezaDe = new Map();
        for (const [g, id] of p.ids) if (id >= 0 && !this.piezas[id].fija) piezaDe.set(g, id);
        for (const id of p.piezas) this.lotePz.set(id, L);
      }
      L.plano(p.P, M, { jitter: (rand() - 0.5) * 0.04, piezaDe });
    }
    for (const L of chunks.values()) for (const m of L.meshes(mats)) scene.add(m);
    // Malla invisible con los sólidos exactos: la usan los disparos y la cámara (cada triángulo sabe de qué pieza es).
    const hidden = new THREE.MeshBasicMaterial({ visible: false });
    const cols = new Map();
    const I = new THREE.Matrix4();
    for (const s of this.sol.list) {
      if (s.dead || s.vidrio) continue;
      const k = `${Math.floor(((s.x0 + s.x1) / 2) / CH)},${Math.floor(((s.z0 + s.z1) / 2) / CH)}`;
      if (!cols.has(k)) cols.set(k, new Lote({ porTri: true }));
      const L = cols.get(k);
      L.marca = s.pz ?? -1;
      if (s.cyl) L.part({ t: 'cyl', x: s.x, y: s.y0, z: s.z, r: s.r, r2: s.r, h: s.y1 - s.y0, seg: 10, m: 'hormigon' }, I, 0);
      else if (s.up) L.part({ t: 'ramp', a: [s.x0, s.y0, s.z0, s.x1, s.y1, s.z1], up: s.up, lo: s.lo, m: 'hormigon' }, I, 0);
      else L.part({ t: 'box', a: [s.x0, s.y0, s.z0, s.x1, s.y1, s.z1], m: 'hormigon' }, I, 0);
    }
    this.lotesChoque = [...cols.values()];
    for (const L of this.lotesChoque) for (const m of L.meshes({ s: hidden, m: hidden, v: hidden, e: hidden })) {
      m.castShadow = false; m.receiveShadow = false;
      scene.add(m);
      this.solidMeshes.push(m);
      this.camMeshes.push(m);
    }
  }

  // Carteles (nombres de pueblos e indicadores de caminos): texto dibujado en un canvas, en las dos caras.
  buildSigns(scene) {
    if (typeof document === 'undefined') return;
    const tex = (g, flip) => {
      const cv = document.createElement('canvas');
      cv.width = 512; cv.height = Math.max(64, Math.round((512 * g.h) / g.w));
      const ctx = cv.getContext('2d');
      ctx.fillStyle = g.color; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.strokeStyle = g.ink; ctx.globalAlpha = 0.85; ctx.lineWidth = Math.max(4, cv.height * 0.05);
      ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, cv.width - ctx.lineWidth * 2, cv.height - ctx.lineWidth * 2);
      ctx.globalAlpha = 1; ctx.fillStyle = g.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let text = g.text;
      if (g.dir) text = flip ? `◀  ${text}` : `${text}  ▶`;
      let fs = Math.round(cv.height * 0.55);
      ctx.font = `bold ${fs}px system-ui, sans-serif`;
      while (ctx.measureText(text).width > cv.width - 50 && fs > 14) { fs -= 2; ctx.font = `bold ${fs}px system-ui, sans-serif`; }
      ctx.fillText(text, cv.width / 2, cv.height / 2 + fs * 0.06);
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      return t;
    };
    for (const g of this.signs) {
      const ang = ((g.r + (g.face || 0)) * Math.PI) / 2;
      const nx = Math.sin(ang), nz = Math.cos(ang); // normal de la cara del frente
      // ¿la flecha del frente apunta a la derecha? (derecha de quien mira el frente = (cos, -sin))
      let right = true;
      if (g.dir) { const [wx, wz] = rot2(g.dir[0], g.dir[1], g.r); right = wx * Math.cos(ang) - wz * Math.sin(ang) > 0; }
      for (const side of [1, -1]) {
        const flip = g.dir ? (side === 1 ? !right : right) : false;
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(g.w, g.h), new THREE.MeshStandardMaterial({ map: tex(g, flip), roughness: 0.8 }));
        mesh.position.set(g.x + nx * (g.d + 0.01) * side, g.y - g.h / 2, g.z + nz * (g.d + 0.01) * side);
        mesh.rotation.y = ang + (side === 1 ? 0 : Math.PI);
        scene.add(mesh);
      }
    }
  }

  buildTrees(scene) {
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 3, 6);
    trunkGeo.translate(0, 1.5, 0);
    const pineGeo = mergeCones([[2.6, 3.4, 3.2], [2.0, 3.0, 5.0], [1.3, 2.6, 6.6]]);
    const roundGeo = new THREE.IcosahedronGeometry(2.4, 0);
    roundGeo.translate(0, 4.6, 0);
    let trunkMat = new THREE.MeshStandardMaterial({ color: '#7a5233', flatShading: true });
    let pineMat = new THREE.MeshStandardMaterial({ color: '#2f7a3b', flatShading: true });
    let roundMat = new THREE.MeshStandardMaterial({ color: '#59a83c', flatShading: true });
    let trunkGeoG = trunkGeo, pineGeoG = pineGeo, roundGeoG = roundGeo;
    const pino = MODEL.baked?.('pino'), arbol = MODEL.baked?.('arbol');
    if (pino && arbol) {
      const by = (parts, n) => parts.find((p) => p.name === n);
      ({ geometry: pineGeoG, material: pineMat } = by(pino, 'HojasPino'));
      ({ geometry: roundGeoG, material: roundMat } = by(arbol, 'HojasArbol'));
      ({ geometry: trunkGeoG, material: trunkMat } = by(arbol, 'TroncoArbol'));
    }
    const list = this.trees;
    this.trunks = new THREE.InstancedMesh(trunkGeoG, trunkMat, list.length);
    this.pines = new THREE.InstancedMesh(pineGeoG, pineMat, list.filter((t) => t.pine).length);
    this.rounds = new THREE.InstancedMesh(roundGeoG, roundMat, list.filter((t) => !t.pine).length);
    this.pineToTree = []; this.roundToTree = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), eu = new THREE.Euler();
    const tint = new THREE.Color();
    list.forEach((t, i) => {
      q.setFromEuler(eu.set(0, t.r, 0));
      sc.set(t.s * (t.sxz || 1), t.s * (t.sy || 1), t.s * (t.sxz || 1));
      p.set(t.x, t.y - 0.2, t.z);
      m.compose(p, q, sc);
      t.matrix = m.clone();
      this.trunks.setMatrixAt(i, m);
      const bio = this.biome(t.x, t.z, t.y);
      tint.setRGB(1, 1, 1).lerp(new THREE.Color(bio.snow > 0.3 ? '#dfe9ee' : bio.sw > 0.3 ? '#a8b070' : '#ffffff'), Math.max(bio.snow, bio.sw) * 0.8);
      tint.offsetHSL((this.noise(t.x / 60, t.z / 60)) * 0.03, 0, (this.noise(t.z / 25, t.x / 25)) * 0.08);
      if (t.pine) { t.fol = [this.pines, this.pineToTree.length]; this.pines.setMatrixAt(this.pineToTree.length, m); this.pines.setColorAt(this.pineToTree.length, tint); this.pineToTree.push(i); }
      else { t.fol = [this.rounds, this.roundToTree.length]; this.rounds.setMatrixAt(this.roundToTree.length, m); this.rounds.setColorAt(this.roundToTree.length, tint); this.roundToTree.push(i); }
    });
    this.trunks.userData.harvest = { kind: 'tree', map: null };
    this.pines.userData.harvest = { kind: 'tree', map: this.pineToTree };
    this.rounds.userData.harvest = { kind: 'tree', map: this.roundToTree };
    for (const im of [this.trunks, this.pines, this.rounds]) { im.castShadow = true; im.receiveShadow = true; scene.add(im); this.solidMeshes.push(im); }
  }

  // Arbustos (decorativos) y cactus del desierto.
  buildPlants(scene) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const bushGeo = new THREE.IcosahedronGeometry(1, 0);
    bushGeo.scale(1.2, 0.8, 1.2); bushGeo.translate(0, 0.45, 0);
    const bush = new THREE.InstancedMesh(bushGeo, new THREE.MeshStandardMaterial({ color: '#5aa33c', flatShading: true, roughness: 0.9 }), this.bushes.length);
    const tint = new THREE.Color();
    this.bushes.forEach((b, i) => {
      m.compose(p.set(b.x, b.y - 0.15, b.z), q.setFromEuler(e.set(0, b.r, 0)), s.set(b.s, b.s, b.s));
      bush.setMatrixAt(i, m);
      const bio = this.biome(b.x, b.z, b.y);
      tint.set(bio.sw > 0.3 ? '#9aa860' : '#ffffff').offsetHSL(this.noise(b.x / 40, b.z / 40) * 0.04, 0, this.noise(b.z / 15, b.x / 15) * 0.1);
      bush.setColorAt(i, tint);
    });
    bush.receiveShadow = true; bush.castShadow = true;
    scene.add(bush);
    // cactus: tronco + dos brazos
    const L = new Lote();
    const I = new THREE.Matrix4();
    const parts = [
      { t: 'cyl', x: 0, y: 0, z: 0, r: 0.38, r2: 0.32, h: 3.0, seg: 8, m: 'hoja' },
      { t: 'sph', x: 0, y: 3.0, z: 0, r: 0.32, m: 'hoja', half: true, seg: 8, sy: 1 },
      { t: 'tube', a: [0, 1.3, 0], b: [0.9, 1.3, 0], r: 0.22, m: 'hoja', seg: 6 },
      { t: 'cyl', x: 0.9, y: 1.1, z: 0, r: 0.22, r2: 0.2, h: 1.1, seg: 6, m: 'hoja' },
      { t: 'tube', a: [0, 1.9, 0], b: [-0.75, 1.9, 0], r: 0.2, m: 'hoja', seg: 6 },
      { t: 'cyl', x: -0.75, y: 1.7, z: 0, r: 0.2, r2: 0.18, h: 0.9, seg: 6, m: 'hoja' },
    ];
    for (const c of this.cacti) {
      I.compose(p.set(c.x, c.y - 0.1, c.z), q.setFromEuler(e.set(0, c.r, 0)), s.set(c.s, c.s, c.s));
      for (const part of parts) L.part(part, I, 0);
    }
    for (const mesh of L.meshes(materialesMapa())) { scene.add(mesh); this.solidMeshes.push(mesh); }
  }

  buildRocks(scene) {
    let geo = new THREE.DodecahedronGeometry(1, 0);
    geo.scale(1.3, 0.8, 1);
    let mat = new THREE.MeshStandardMaterial({ color: '#9a958a', flatShading: true });
    const roca = MODEL.baked?.('roca');
    if (roca) ({ geometry: geo, material: mat } = roca[0]);
    this.rockMesh = new THREE.InstancedMesh(geo, mat, this.rocks.length);
    const m = new THREE.Matrix4();
    const tint = new THREE.Color();
    this.rocks.forEach((r, i) => {
      m.compose(new THREE.Vector3(r.x, r.y, r.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r.r, r.r * 2, 0)), new THREE.Vector3(r.s, r.s, r.s));
      r.matrix = m.clone();
      this.rockMesh.setMatrixAt(i, m);
      const bio = this.biome(r.x, r.z, r.y);
      tint.set('#ffffff').lerp(new THREE.Color('#d98a6a'), bio.quarry * 0.8).lerp(new THREE.Color('#e8d2a8'), bio.des * 0.6);
      this.rockMesh.setColorAt(i, tint);
    });
    this.rockMesh.userData.harvest = { kind: 'rock', map: null };
    this.rockMesh.castShadow = true; this.rockMesh.receiveShadow = true;
    scene.add(this.rockMesh);
    this.solidMeshes.push(this.rockMesh);
  }

  // Los cofres los arma loot.js (MODEL.cofre, lo inyectan main.js y mapa.html): modelo, aura y animación.
  buildChests(scene) {
    this.chestMeshes = this.chestSpots.map((c, idx) => {
      const g = MODEL.cofre ? MODEL.cofre() : new THREE.Group();
      g.position.set(c.x, c.y, c.z);
      g.rotation.y = this.chestFacing(c);
      g.userData.idx = idx;
      g.userData.open = false;
      scene.add(g);
      return g;
    });
  }

  // Hacia dónde mira el cofre: el frente (-Z del modelo) hacia el lado con más lugar libre, así no queda con la
  // cerradura contra la pared. Si el giro del plano ya deja 2 m libres adelante, se respeta.
  chestFacing(c) {
    const libre = (rot) => {
      const d = { x: -Math.sin(rot), y: 0, z: -Math.cos(rot) };
      return Math.min(4, this.sol.ray({ x: c.x + d.x * 0.45, y: c.y + 0.4, z: c.z + d.z * 0.45 }, d, 4));
    };
    if (libre(c.rot) >= 2) return c.rot;
    let mejor = c.rot, max = -1;
    for (let k = 0; k < 4; k++) {
      const rot = c.rot + (k * Math.PI) / 2;
      const l = libre(rot);
      if (l > max + 0.05) { max = l; mejor = rot; }
    }
    return mejor;
  }

  // Baja un cofre (se rompió el piso donde estaba).
  moveChest(idx, y) {
    const c = this.chestSpots[idx];
    if (!c) return;
    c.y = y;
    const m = this.chestMeshes?.[idx];
    if (m) m.position.y = y;
  }

  // animar: alguien lo acaba de abrir (la tapa salta y sale el loot); si no, queda abierto de una (snapshot).
  openChest(idx, animar = false) {
    const c = this.chestMeshes?.[idx];
    if (!c || c.userData.open) return;
    c.userData.open = true;
    MODEL.abrirCofre?.(c, animar);
  }

  destroyResource(kind, idx) {
    const list = kind === 'tree' ? this.trees : this.rocks;
    const r = list[idx];
    if (!r || !r.alive) return;
    r.alive = false;
    r.circle.top = -1e9; // ya no choca
    if (!this.scene) return;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    if (kind === 'tree') {
      this.trunks.setMatrixAt(idx, zero); this.trunks.instanceMatrix.needsUpdate = true;
      const [mesh, k] = r.fol; mesh.setMatrixAt(k, zero); mesh.instanceMatrix.needsUpdate = true;
      this.trunks.computeBoundingSphere(); mesh.computeBoundingSphere();
    } else {
      this.rockMesh.setMatrixAt(idx, zero); this.rockMesh.instanceMatrix.needsUpdate = true;
    }
  }

  // Sacudón visual al pegarle con el pico.
  shakeResource(kind, idx) {
    const r = (kind === 'tree' ? this.trees : this.rocks)[idx];
    if (!r || !r.alive || !this.scene) return;
    const meshes = kind === 'tree' ? [[this.trunks, idx], r.fol] : [[this.rockMesh, idx]];
    const m = r.matrix.clone().multiply(new THREE.Matrix4().makeScale(0.93, 0.93, 0.93));
    for (const [mesh, k] of meshes) { mesh.setMatrixAt(k, m); mesh.instanceMatrix.needsUpdate = true; }
    setTimeout(() => {
      if (!r.alive) return;
      for (const [mesh, k] of meshes) { mesh.setMatrixAt(k, r.matrix); mesh.instanceMatrix.needsUpdate = true; }
    }, 90);
  }

  // ---------- Construcciones ----------
  addStruct(s) {
    if (this.structs.has(s.key)) return;
    const x0 = s.i * GRID, z0 = s.j * GRID;
    if (s.type === 'pared') {
      const t = 0.15;
      s.box = s.dir === 0
        ? { minX: x0, maxX: x0 + GRID, minZ: z0 - t, maxZ: z0 + t, minY: s.y, maxY: s.y + GRID }
        : { minX: x0 - t, maxX: x0 + t, minZ: z0, maxZ: z0 + GRID, minY: s.y, maxY: s.y + GRID };
    }
    this.structs.set(s.key, s);
    if (this.scene) {
      s.mesh = makeStructMesh(s);
      s.mesh.userData.structKey = s.key;
      this.scene.add(s.mesh);
      this.structMeshes.push(s.mesh);
      s.mesh.scale.setScalar(0.01);
      s.born = performance.now();
    }
  }

  removeStruct(key) {
    const s = this.structs.get(key);
    if (!s) return;
    this.structs.delete(key);
    if (s.mesh) {
      this.scene.remove(s.mesh);
      this.structMeshes.splice(this.structMeshes.indexOf(s.mesh), 1);
    }
  }

  updateStructs() {
    const t = performance.now();
    for (const s of this.structs.values()) {
      if (!s.mesh || s.grown) continue;
      const k = Math.min(1, (t - s.born) / 180);
      s.mesh.scale.setScalar(0.01 + 0.99 * k);
      if (k >= 1) s.grown = true;
    }
  }
  // Mueve una cápsula (pos = pies) resolviendo choques con paredes, árboles, rocas y construcciones.
  collide(pos, radius = 0.45, height = 1.8) {
    for (const c of this.circles) {
      if (pos.y > c.top || pos.y + height < c.bottom) continue;
      const dx = pos.x - c.x, dz = pos.z - c.z;
      if (Math.abs(dx) > 6 || Math.abs(dz) > 6) continue;
      const d = Math.hypot(dx, dz), min = c.r + radius;
      if (d < min && d > 1e-4) { pos.x = c.x + (dx / d) * min; pos.z = c.z + (dz / d) * min; }
    }
    this.sol.push(pos, radius, height);
    for (const s of this.structs.values()) if (s.box) pushOut(pos, s.box, radius, height);
  }

  // Distancia hasta donde un rayo choca con el terreno (marcha simple), o Infinity.
  rayTerrain(origin, dir, maxDist) {
    let prev = 0;
    for (let t = 0.5; t <= maxDist; t += 1) {
      const x = origin.x + dir.x * t, y = origin.y + dir.y * t, z = origin.z + dir.z * t;
      if (y < this.terrainHeight(x, z)) {
        let lo = prev, hi = t;
        for (let k = 0; k < 6; k++) {
          const mid = (lo + hi) / 2;
          const mx = origin.x + dir.x * mid, my = origin.y + dir.y * mid, mz = origin.z + dir.z * mid;
          if (my < this.terrainHeight(mx, mz)) hi = mid; else lo = mid;
        }
        return hi;
      }
      prev = t;
    }
    return Infinity;
  }

  // Mapa para el minimapa: terreno con biomas, río, calles y techos.
  minimapImage(px = 200) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = px;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(px, px);
    const half = this.size / 2;
    const c = new THREE.Color();
    for (let j = 0; j < px; j++) for (let i = 0; i < px; i++) {
      const x = -half + ((i + 0.5) / px) * this.size, z = -half + ((j + 0.5) / px) * this.size;
      const h = this.terrainHeight(x, z);
      if (h < 0) c.set(h < -4 ? '#2a86c4' : '#3aa6d8');
      else { this.terrainColor(x, z, h, this.slopeAt(x, z) * 0.7, c); c.offsetHSL(0, -0.05, -Math.min(0.1, h / 900)); }
      c.convertLinearToSRGB();
      const o = (j * px + i) * 4;
      img.data[o] = c.r * 255; img.data[o + 1] = c.g * 255; img.data[o + 2] = c.b * 255; img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const toM = (v) => ((v + half) / this.size) * px;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#3fb0e0'; ctx.lineWidth = Math.max(1.5, (RIO.w / this.size) * px * 1.4);
    ctx.beginPath(); this.river.path.forEach(([x, z], k) => (k ? ctx.lineTo(toM(x), toM(z)) : ctx.moveTo(toM(x), toM(z)))); ctx.stroke();
    for (const rb of this.ribbons) {
      ctx.strokeStyle = rb.m === 'asfalto' ? '#5a5d63' : rb.m === 'vereda' ? '#d9d2c2' : '#b0905f';
      ctx.lineWidth = Math.max(1, (rb.w / this.size) * px * 1.6);
      ctx.beginPath(); rb.pts.forEach(([x, z], k) => (k ? ctx.lineTo(toM(x), toM(z)) : ctx.moveTo(toM(x), toM(z)))); ctx.stroke();
    }
    for (const pq of this.plazas) {
      ctx.fillStyle = pq.m === 'asfalto' ? '#5a5d63' : pq.m === 'vereda' ? '#d9d2c2' : '#b0905f';
      ctx.beginPath(); ctx.arc(toM(pq.x), toM(pq.z), Math.max(1, (pq.r / this.size) * px * 1.3), 0, Math.PI * 2); ctx.fill();
    }
    for (const p of this.placed) {
      if (['farol', 'cerca', 'auto', 'caja3', 'barriles', 'fogon', 'campo', 'tractor', 'puesto', 'carpa', 'pasarela', 'muelle', 'malecon', 'puente', 'montanaRusa', 'rueda', 'poste', 'cables', 'indicador', 'torreTeleferico', 'banco', 'tacho', 'hidrante', 'buzon', 'cartel', 'cantero', 'seto', 'jardin'].includes(p.name)) continue;
      const f = p.fp;
      ctx.fillStyle = 'rgba(70,45,35,.85)';
      ctx.fillRect(toM(f.x0), toM(f.z0), Math.max(1.5, toM(f.x1) - toM(f.x0)), Math.max(1.5, toM(f.z1) - toM(f.z0)));
    }
    return cv;
  }
}

// Agua con olitas (normales animadas) y, en el mar, color según profundidad y espuma en la orilla.
function aguaShader(mat, { time, htex, half = 0, cell = 1, N = 1, mar }) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    if (mar) { sh.uniforms.uHeight = { value: htex }; sh.uniforms.uHalf = { value: half }; sh.uniforms.uCell = { value: cell }; sh.uniforms.uN = { value: N }; }
    sh.vertexShader = 'varying vec3 vAgW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vAgW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    let head = 'varying vec3 vAgW;\nuniform float uTime;\n';
    if (mar) head += 'uniform sampler2D uHeight; uniform float uHalf, uCell, uN;\n';
    let col = '';
    if (mar) col = `
      vec2 wuv = ((vAgW.xz + uHalf) / uCell + 0.5) / uN;
      float inside = step(0.0, wuv.x) * step(wuv.x, 1.0) * step(0.0, wuv.y) * step(wuv.y, 1.0);
      vec4 hs = texture2D(uHeight, clamp(wuv, 0.0, 1.0));
      float depth = mix(20.0, hs.r * 24.0 - 4.0, inside);
      float swampW = hs.g * inside;
      vec3 deep = vec3(0.012, 0.16, 0.42), shallow = vec3(0.07, 0.55, 0.62), murky = vec3(0.12, 0.2, 0.07);
      vec3 wc = mix(shallow, deep, smoothstep(0.2, 10.0, depth));
      wc = mix(wc, murky, swampW * 0.7);
      float fN = sin(vAgW.x * 0.9 + uTime * 1.7) * sin(vAgW.z * 0.8 - uTime * 1.3) * 0.5 + 0.5;
      float edge = 1.0 - smoothstep(0.0, 0.3 + 0.18 * sin(uTime * 0.9 + vAgW.x * 0.07 + vAgW.z * 0.05), depth);
      float foam = clamp(edge * (0.6 + 0.4 * fN), 0.0, 1.0) * (1.0 - swampW);
      diffuseColor.rgb = mix(wc, vec3(0.92, 0.96, 1.0), foam * 0.85);
      diffuseColor.a = clamp(mix(0.6, 0.92, smoothstep(0.0, 6.0, depth)) + foam * 0.35, 0.0, 1.0);`;
    sh.fragmentShader = head + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>' + col)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {
        vec2 p = vAgW.xz; float t = uTime;
        float fade = 1.0 - smoothstep(50.0, 400.0, length(vViewPosition));
        vec2 g = vec2(0.0);
        g += vec2(0.31, 0.12) * cos(dot(p, vec2(0.31, 0.12)) + t * 1.5) * 0.32;
        g += vec2(-0.11, 0.38) * cos(dot(p, vec2(-0.11, 0.38)) + t * 1.8) * 0.26;
        g += (vec2(0.95, 0.62) * cos(dot(p, vec2(0.95, 0.62)) - t * 2.6) * 0.06 + vec2(-0.7, 1.15) * cos(dot(p, vec2(-0.7, 1.15)) + t * 3.0) * 0.05) * fade;
        vec3 nW = normalize(vec3(-g.x, 1.0, -g.y));
        normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
      }`);
  };
}

const COL = {
  sand: new THREE.Color('#e8d39a'), grass: new THREE.Color('#6cbf4b'), grass2: new THREE.Color('#58a83f'),
  rock: new THREE.Color('#8a8576'), rock2: new THREE.Color('#6f6c66'), snow: new THREE.Color('#f2f6fa'), snowsh: new THREE.Color('#cddbeb'), seabed: new THREE.Color('#c9b98a'),
  mud: new THREE.Color('#6f7a3e'), desert: new THREE.Color('#e3c78f'), desert2: new THREE.Color('#d6ae72'),
  redrock: new THREE.Color('#b8603f'), redrock2: new THREE.Color('#9c4e34'), alpine: new THREE.Color('#7f9f58'), dirt: new THREE.Color('#9c8458'),
};

function bump(x, z, cx, cz, r) {
  const d = Math.hypot(x - cx, z - cz) / r;
  return d >= 1 ? 0 : (1 - d * d) ** 2;
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Reparte puntos cada `step` metros a lo largo de una polilínea.
// Distancia de un punto [x, z] a una polilínea.
export function distPoly([x, z], pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

function resample(pts, step) {
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / step));
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  return out;
}

// Curva suave (Catmull-Rom) por los puntos de control, remuestreada cada `step` metros.
function catmull(pts, step) {
  const dense = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < 16; k++) {
      const t = k / 16, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dense.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  dense.push(pts[pts.length - 1]);
  return resample(dense, 0.5).filter((_, k, arr) => k % Math.round(step / 0.5) === 0 || k === arr.length - 1);
}

function mergeCones(defs) {
  const geos = defs.map(([r, h, y]) => {
    const g = new THREE.ConeGeometry(r, h, 7);
    g.translate(0, y, 0);
    return g.toNonIndexed();
  });
  const total = geos.reduce((s, g) => s + g.attributes.position.count, 0);
  const pos = new Float32Array(total * 3);
  let o = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o); o += g.attributes.position.array.length; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.computeVertexNormals();
  return out;
}

function pushOut(pos, b, radius, height) {
  if (pos.y + height <= b.minY || pos.y >= b.maxY) return;
  const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
  const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
  const dx = pos.x - cx, dz = pos.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= radius * radius) return;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    pos.x = cx + (dx / d) * radius; pos.z = cz + (dz / d) * radius;
  } else {
    const ex = [b.minX - radius - pos.x, b.maxX + radius - pos.x], ez = [b.minZ - radius - pos.z, b.maxZ + radius - pos.z];
    const bx = Math.abs(ex[0]) < Math.abs(ex[1]) ? ex[0] : ex[1];
    const bz = Math.abs(ez[0]) < Math.abs(ez[1]) ? ez[0] : ez[1];
    if (Math.abs(bx) < Math.abs(bz)) pos.x += bx; else pos.z += bz;
  }
}

const structMats = {};
function structMat(m, ghost) {
  const k = m + (ghost ? ':g' : '');
  if (!structMats[k]) {
    structMats[k] = ghost
      ? new THREE.MeshBasicMaterial({ color: '#59b8ff', transparent: true, opacity: 0.35, depthWrite: false })
      : new THREE.MeshStandardMaterial({ color: MATERIALS[m].color, flatShading: true, roughness: m === 'metal' ? 0.4 : 0.9, metalness: m === 'metal' ? 0.5 : 0 });
  }
  return structMats[k];
}

// Malla de una pieza de construcción. El grupo se ubica en la esquina (i*GRID, y, j*GRID).
export function makeStructMesh(s, ghost = false) {
  const g = new THREE.Group();
  const mat = structMat(s.mat || 'madera', ghost);
  const frameMat = ghost ? mat : new THREE.MeshStandardMaterial({ color: new THREE.Color(MATERIALS[s.mat || 'madera'].color).multiplyScalar(0.6), flatShading: true });
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = !ghost; o.receiveShadow = !ghost; g.add(o); return o; };
  const G = GRID;
  if (s.type === 'pared') {
    const horiz = s.dir === 0;
    const geo = horiz ? new THREE.BoxGeometry(G, G, 0.25) : new THREE.BoxGeometry(0.25, G, G);
    const cx = horiz ? G / 2 : 0, cz = horiz ? 0 : G / 2;
    add(geo, mat, cx, G / 2, cz);
    if (!ghost) {
      // Marco para que se lea la pieza.
      const fb = horiz ? [G, 0.25, 0.3] : [0.3, 0.25, G];
      add(new THREE.BoxGeometry(...fb), frameMat, cx, 0.12, cz);
      add(new THREE.BoxGeometry(...fb), frameMat, cx, G - 0.12, cz);
      const fs = horiz ? [0.25, G, 0.3] : [0.3, G, 0.25];
      add(new THREE.BoxGeometry(...fs), frameMat, horiz ? 0.12 : 0, G / 2, horiz ? 0 : 0.12);
      add(new THREE.BoxGeometry(...fs), frameMat, horiz ? G - 0.12 : 0, G / 2, horiz ? 0 : G - 0.12);
    }
  } else if (s.type === 'piso') {
    add(new THREE.BoxGeometry(G, 0.25, G), mat, G / 2, -0.125, G / 2);
  } else if (s.type === 'rampa') {
    const len = Math.hypot(G, G);
    const ramp = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(G, 0.25, len), mat);
    slab.castShadow = !ghost; slab.receiveShadow = !ghost;
    slab.rotation.x = Math.PI / 4; // sube hacia -Z local
    ramp.add(slab);
    ramp.position.set(G / 2, G / 2 - 0.12, G / 2);
    ramp.rotation.y = [0, -Math.PI / 2, Math.PI, Math.PI / 2][s.dir];
    g.add(ramp);
    if (!ghost) for (const x of [-G / 2 + 0.15, G / 2 - 0.15]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, len), frameMat);
      rail.rotation.x = Math.PI / 4; rail.position.set(x, 0.1, 0); ramp.add(rail);
    }
  }
  g.position.set(s.i * G, s.y, s.j * G);
  return g;
}
