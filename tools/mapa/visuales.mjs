// Pruebas visuales del mapa (las llama pruebas.mjs): lo que se ve tiene que coincidir con lo que choca.
// - caras al revés (se verían transparentes desde afuera)
// - piezas visibles en el lugar por donde camina el jugador (se ven pero se atraviesan)
// - pisos falsos (el piso que se ve está más arriba que el que pisa el jugador: se hunden los pies)
// - caras encimadas en el mismo plano con distinto color (titilan), dentro de una estructura, entre estructuras,
//   contra el terreno y contra las calles
// - piezas rompibles que arrancan sin apoyo y decoración suelta en el aire
// - derrumbes: lo que queda colgando cuando se rompe lo que lo sostiene se cae, y lo demás no
import * as THREE from 'three';
import { Lote } from '../../public/js/mallas.js';
import { Solidos } from '../../public/js/colision.js';
import { World } from '../../public/js/world.js';
import { PLANOS, PALETA, cajasParte, piezasDe, vecinasDe, sinApoyo } from '../../public/js/planos.js';

const casos = () => {
  const c = Object.keys(PLANOS).map((n) => [n, {}]);
  c.push(['casa', { pisos: 2 }], ['casa', { pisos: 2, porche: true, var: 1 }], ['edificio', { pisos: 4 }], ['adobe', { pisos: 2 }], ['jardin', { px: -1.8 }]);
  return c;
};
const etiqueta = (name, opts) => name + (opts.pisos ? ` ${opts.pisos}p` : '') + (opts.porche ? ' porche' : '');
const desc = (q) => `${q.t} ${q.m} ${JSON.stringify(q.a || [q.x, q.y, q.z].map((v) => +v.toFixed(2)))}`;
const aspecto = (m) => { const p = PALETA[m] || []; return `${p[0]}|${p[1]}|${p[2] || 0}`; };
const opaco = (m) => (PALETA[m]?.[1] || 's') !== 'v';

export function pruebasVisuales({ alcances, world, fail }) {
  carasAlReves(fail);
  intrusiones(alcances, fail);
  titilan(fail);
  titilanMundo(world, fail);
  piezas(world, fail);
  derrumbes(fail);
}

// ---------- 7) Caras al revés ----------
function carasAlReves(fail) {
  const L = new Lote(), I = new THREE.Matrix4();
  let tot = 0, mal = 0;
  const porTipo = {};
  for (const [name, opts] of casos()) {
    const P = PLANOS[name](opts);
    for (const q of P.parts) {
      for (const k of ['s', 'm', 'v', 'e']) L.b[k] = { p: [], n: [], c: [], ao: [], pat: [], tp: [] };
      L.part(q, I, 0);
      const pts = [], nrm = [];
      for (const k of ['s', 'm', 'v', 'e']) { pts.push(...L.b[k].p); nrm.push(...L.b[k].n); }
      const nv = pts.length / 3;
      if (!nv) continue;
      let cx = 0, cy = 0, cz = 0;
      for (let i = 0; i < nv; i++) { cx += pts[i * 3]; cy += pts[i * 3 + 1]; cz += pts[i * 3 + 2]; }
      cx /= nv; cy /= nv; cz /= nv;
      let malas = 0;
      for (let t = 0; t < nv / 3; t++) {
        const i = t * 9;
        const mx = (pts[i] + pts[i + 3] + pts[i + 6]) / 3, my = (pts[i + 1] + pts[i + 4] + pts[i + 7]) / 3, mz = (pts[i + 2] + pts[i + 5] + pts[i + 8]) / 3;
        const nx = nrm[i], ny = nrm[i + 1], nz = nrm[i + 2];
        let ok = true;
        if (q.t === 'arc') {
          const rho = Math.hypot(mx - q.x, mz - q.z), rx = (mx - q.x) / rho, rz = (mz - q.z) / rho, d = nx * rx + nz * rz;
          if (ny > 0.5) ok = my > q.y + q.h / 2; else if (ny < -0.5) ok = my < q.y + q.h / 2;
          else if (Math.abs(d) > 0.5) ok = (d > 0) === (rho > (q.r0 + q.r1) / 2);
        } else if (q.t === 'sph' && q.grosor > 0) {
          const vx = mx - q.x, vy = (my - q.y) / q.sy, vz = mz - q.z, dist = Math.hypot(vx, vy, vz);
          if (q.half && Math.abs(my - q.y) < 1e-3 && Math.abs(ny) > 0.9) ok = ny < 0;
          else ok = (nx * vx + ny * vy + nz * vz > 0) === (dist > q.r - q.grosor / 2);
        } else ok = (mx - cx) * nx + (my - cy) * ny + (mz - cz) * nz > -1e-4;
        if (!ok) malas++;
      }
      tot++;
      if (malas) { mal++; porTipo[q.t] = (porTipo[q.t] || 0) + 1; if (mal <= 10) fail(`${etiqueta(name, opts)}: caras al revés en ${desc(q)} (${malas} triángulos)`); }
    }
  }
  console.log(`caras revisadas en ${tot} partes; con caras al revés: ${mal}`, mal ? JSON.stringify(porTipo) : '');
}

// ---------- 8) Partes visibles donde camina el jugador, y pisos falsos ----------
// El cuerpo es una caja de 0.6 x 1.58 m desde los tobillos (12 cm sobre el piso). Cuenta sólo lo que se mete
// más de 6 cm en el cuerpo y no está dentro de un sólido (lo que está dentro de un escalón pisable es la pierna
// subiendo el escalón, no un error).
function intrusiones(alcances, fail) {
  let total = 0, falsos = 0;
  for (const [name, opts, r] of alcances) {
    const { P, nodes, sol } = r;
    const celda = new Map(), C = 1;
    for (const n of nodes) { const k = Math.floor(n.x / C) * 8192 + Math.floor(n.z / C); let a = celda.get(k); if (!a) celda.set(k, (a = [])); a.push(n); }
    const cerca = (b, fn) => {
      for (let i = Math.floor((b[0] - 0.4) / C); i <= Math.floor((b[3] + 0.4) / C); i++) for (let j = Math.floor((b[2] - 0.4) / C); j <= Math.floor((b[5] + 0.4) / C); j++) for (const n of celda.get(i * 8192 + j) || []) fn(n);
    };
    const enSolido = (x, y, z) => {
      let s0 = false;
      sol.near(x, z, 0.1, (s) => {
        if (s0) return;
        if (s.cyl) { if (Math.hypot(x - s.x, z - s.z) <= s.r + 0.06 && y >= s.y0 - 0.06 && y <= s.y1 + 0.06) s0 = true; return; }
        if (x < s.x0 - 0.06 || x > s.x1 + 0.06 || z < s.z0 - 0.06 || z > s.z1 + 0.06 || y < s.y0 - 0.06) return;
        const top = Solidos.topAt(s, Math.min(s.x1, Math.max(s.x0, x)), Math.min(s.z1, Math.max(s.z0, z)));
        if (y <= top + 0.06) s0 = true;
      });
      return s0;
    };
    const lista = [], pisos = [];
    for (const q of P.parts) {
      if (q.tag === 'esc' || q.tag === 'veg') continue;
      const hits = new Set(), sube = new Set();
      for (const b of cajasParte(q)) {
        cerca(b, (n) => {
          // ¿se mete en el cuerpo? (cuerpo achicado 6 cm: lo que queda adentro es intrusión de verdad)
          if (!hits.has(n)) {
            const B = [n.x - 0.24, n.y + 0.18, n.z - 0.24, n.x + 0.24, n.y + 1.64, n.z + 0.24];
            const I = [Math.max(b[0], B[0]), Math.max(b[1], B[1]), Math.max(b[2], B[2]), Math.min(b[3], B[3]), Math.min(b[4], B[4]), Math.min(b[5], B[5])];
            if (I[3] > I[0] && I[4] > I[1] && I[5] > I[2]) {
              const K = 4;
              busca: for (let a = 0; a < K; a++) for (let c = 0; c < K; c++) for (let e = 0; e < K; e++) {
                const x = I[0] + ((I[3] - I[0]) * (a + 0.5)) / K, y = I[1] + ((I[4] - I[1]) * (c + 0.5)) / K, z = I[2] + ((I[5] - I[2]) * (e + 0.5)) / K;
                if (dentroParte(q, x, y, z) && !enSolido(x, y, z)) { hits.add(n); break busca; }
              }
            }
          }
          // ¿el piso que se ve (cara de arriba de una caja) queda más arriba que los pies?
          if (q.t === 'box' && q.m !== 'agua' && n.x > b[0] && n.x < b[3] && n.z > b[2] && n.z < b[5]) {
            const dy = b[4] - n.y;
            if (dy > 0.03 && dy <= 0.5 && b[1] < n.y + 0.02) sube.add(n);
          }
        });
      }
      if (hits.size >= 2) lista.push([q, hits.size]);
      if (sube.size >= 2) pisos.push([q, sube.size]);
    }
    for (const [q, c] of lista) { total++; fail(`${etiqueta(name, opts)}: se ve pero se atraviesa ${desc(q)} (${c} lugares)`); }
    for (const [q, c] of pisos) { falsos++; fail(`${etiqueta(name, opts)}: piso falso, los pies se hunden en ${desc(q)} (${c} lugares)`); }
  }
  console.log('partes visibles que se atraviesan:', total, '- pisos falsos:', falsos);
}

// ¿El punto está dentro del volumen dibujado de la parte?
function dentroParte(q, x, y, z) {
  switch (q.t) {
    case 'box': { const a = q.a; return x >= a[0] && x <= a[3] && y >= a[1] && y <= a[4] && z >= a[2] && z <= a[5]; }
    case 'ramp': {
      const a = q.a;
      if (x < a[0] || x > a[3] || z < a[2] || z > a[5] || y < a[1]) return false;
      return y <= Solidos.topAt({ x0: a[0], y0: a[1], z0: a[2], x1: a[3], y1: a[4], z1: a[5], up: q.up, lo: q.lo }, x, z);
    }
    case 'tri': {
      const a = q.a;
      if (x < a[0] || x > a[3] || y < a[1] || z < a[2] || z > a[5]) return false;
      const t = q.axis === 'z' ? (z - a[2]) / (a[5] - a[2]) : (x - a[0]) / (a[3] - a[0]);
      return y <= a[1] + (a[4] - a[1]) * (1 - Math.abs(2 * t - 1));
    }
    case 'slope': {
      const [x0, z0, x1, z1] = q.a;
      if (x < Math.min(x0, x1) || x > Math.max(x0, x1) || z < Math.min(z0, z1) || z > Math.max(z0, z1)) return false;
      let t;
      switch (q.up) {
        case '+x': t = (x - Math.min(x0, x1)) / Math.abs(x1 - x0); break;
        case '-x': t = (Math.max(x0, x1) - x) / Math.abs(x1 - x0); break;
        case '+z': t = (z - Math.min(z0, z1)) / Math.abs(z1 - z0); break;
        default: t = (Math.max(z0, z1) - z) / Math.abs(z1 - z0);
      }
      const yy = q.ylo + (q.yhi - q.ylo) * Math.min(1, Math.max(0, t));
      return y <= yy && y >= yy - q.th;
    }
    case 'cyl': {
      if (y < q.y || y > q.y + q.h) return false;
      const rr = q.r + (q.r2 - q.r) * ((y - q.y) / q.h), d = Math.hypot(x - q.x, z - q.z);
      return q.open ? Math.abs(d - rr) < 0.04 : d <= rr;
    }
    case 'tube': {
      const ab = [q.b[0] - q.a[0], q.b[1] - q.a[1], q.b[2] - q.a[2]], ap = [x - q.a[0], y - q.a[1], z - q.a[2]];
      const L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1, t = (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / L2;
      if (t < 0 || t > 1) return false; // cilindro de tapas planas
      return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t) <= q.r;
    }
    case 'sph': {
      if (q.half && y < q.y) return false;
      const d = Math.hypot(x - q.x, (y - q.y) / q.sy, z - q.z);
      return d <= q.r && (!(q.grosor > 0) || d >= q.r - q.grosor);
    }
    case 'arc': {
      if (y < q.y || y > q.y + q.h) return false;
      const d = Math.hypot(x - q.x, z - q.z);
      if (d < q.r0 || d > q.r1) return false;
      let ang = Math.atan2(z - q.z, x - q.x);
      while (ang < q.a0) ang += Math.PI * 2;
      while (ang > q.a0 + Math.PI * 2) ang -= Math.PI * 2;
      return ang <= q.a1;
    }
  }
  return false;
}

// ---------- 9) Caras encimadas (titilan) ----------
// Caras de cajas: [eje, signo, plano, u0, u1, v0, v1, parte]
function carasDe(b, ref) {
  const out = [];
  for (let e = 0; e < 3; e++) {
    const [u, v] = [[1, 2], [0, 2], [0, 1]][e];
    out.push([e, -1, b[e], b[u], b[u + 3], b[v], b[v + 3], ref]);
    out.push([e, 1, b[e + 3], b[u], b[u + 3], b[v], b[v + 3], ref]);
  }
  return out;
}

// Busca pares de caras en el mismo plano, mirando al mismo lado, encimadas y de distinto aspecto, que se vean.
// cajas: [{ b, m, ref, grupo }] — grupo: no se comparan caras del mismo grupo (null = todas).
function encimadas(cajas, { mismoGrupo = true } = {}) {
  const buckets = new Map();
  const ocl = new Map(), C = 2;
  const celdas = (b, fn) => { for (let i = Math.floor(b[0] / C); i <= Math.floor(b[3] / C); i++) for (let j = Math.floor(b[2] / C); j <= Math.floor(b[5] / C); j++) fn(i * 100003 + j); };
  cajas.forEach((c, idx) => {
    if (opaco(c.m)) celdas(c.b, (k) => { let a = ocl.get(k); if (!a) ocl.set(k, (a = [])); a.push(idx); });
    for (const f of carasDe(c.b, idx)) {
      if (f[0] === 1 && f[1] < 0 && f[2] < (c.base || 0) + 0.3) continue; // caras de abajo al ras del piso: no se ven nunca
      const k = `${f[0]}|${f[1]}|${Math.round(f[2] / 0.004)}|${Math.floor(f[3] / 4)}|${Math.floor(f[5] / 4)}`;
      let a = buckets.get(k); if (!a) buckets.set(k, (a = [])); a.push(f);
    }
  });
  const tapado = (x, y, z, i, j) => {
    let t = false;
    celdas([x, 0, z, x, 0, z], (k) => { if (t) return; for (const o of ocl.get(k) || []) { if (o === i || o === j) continue; const b = cajas[o].b; if (x > b[0] + 1e-4 && x < b[3] - 1e-4 && y > b[1] + 1e-4 && y < b[4] - 1e-4 && z > b[2] + 1e-4 && z < b[5] - 1e-4) { t = true; return; } } });
    return t;
  };
  const vistos = new Set(), out = [];
  for (const [key, arr] of buckets) {
    // también las caras de los baldes vecinos (por el redondeo y por los cortes de 4 m)
    const [e, s, pl, bu, bv] = key.split('|').map(Number);
    const otras = [];
    for (const dp of [-1, 0, 1]) for (const du of [-1, 0, 1]) for (const dv of [-1, 0, 1]) otras.push(...(buckets.get(`${e}|${s}|${pl + dp}|${bu + du}|${bv + dv}`) || []));
    for (const f of arr) for (const g of otras) {
      if (f[7] >= g[7]) continue;
      const A = cajas[f[7]], B = cajas[g[7]];
      if (Math.abs(f[2] - g[2]) > 0.004) continue;
      if (!mismoGrupo && A.grupo !== null && A.grupo === B.grupo) continue;
      if (aspecto(A.m) === aspecto(B.m)) continue;
      const u0 = Math.max(f[3], g[3]), u1 = Math.min(f[4], g[4]), v0 = Math.max(f[5], g[5]), v1 = Math.min(f[6], g[6]);
      if (u1 - u0 < 0.02 || v1 - v0 < 0.02) continue;
      const id = `${f[7]}|${g[7]}|${e}|${s}`;
      if (vistos.has(id)) continue;
      vistos.add(id);
      // ¿se ve? muestras en la zona encimada, corridas 1 cm hacia afuera de la cara
      let visible = false;
      for (let a = 0; a < 4 && !visible; a++) for (let c = 0; c < 4 && !visible; c++) {
        const uu = u0 + ((u1 - u0) * (a + 0.5)) / 4, vv = v0 + ((v1 - v0) * (c + 0.5)) / 4, p = [0, 0, 0];
        const [iu, iv] = [[1, 2], [0, 2], [0, 1]][e];
        p[e] = f[2] + s * 0.01; p[iu] = uu; p[iv] = vv;
        if (!tapado(p[0], p[1], p[2], f[7], g[7])) visible = true;
      }
      if (visible) out.push([A, B, e, s, f[2], (u1 - u0) * (v1 - v0)]);
    }
  }
  return out;
}

const EJE = ['x', 'y', 'z'];
function titilan(fail) {
  let total = 0;
  for (const [name, opts] of casos()) {
    const P = PLANOS[name](opts);
    const cajas = P.parts.filter((q) => q.t === 'box').map((q) => ({ b: q.a, m: q.m, ref: q, grupo: null }));
    for (const [A, B, e, s, pl, area] of encimadas(cajas)) {
      total++;
      if (total <= 25 || process.env.TODAS) fail(`${etiqueta(name, opts)}: caras encimadas que titilan (${s > 0 ? '+' : '-'}${EJE[e]} en ${pl.toFixed(3)}, ${area.toFixed(2)} m²): ${desc(A.ref)} / ${desc(B.ref)}`);
    }
  }
  if (total > 25 && !process.env.TODAS) fail(`... y ${total - 25} caras encimadas más`);
  console.log('caras encimadas que titilan (dentro de cada estructura):', total);
}

// Rota una caja local a coordenadas del mundo (giros de 90°).
function cajaMundo(pl, b) {
  const rot = (x, z) => { switch (pl.r & 3) { case 1: return [z, -x]; case 2: return [-x, -z]; case 3: return [-z, x]; default: return [x, z]; } };
  const [ax, az] = rot(b[0], b[2]), [bx, bz] = rot(b[3], b[5]);
  return [pl.x + Math.min(ax, bx), pl.y + b[1], pl.z + Math.min(az, bz), pl.x + Math.max(ax, bx), pl.y + b[4], pl.z + Math.max(az, bz)];
}

function titilanMundo(world, fail) {
  // entre estructuras vecinas
  const cajas = [];
  world.placed.forEach((pl, k) => { for (const q of pl.P.parts) if (q.t === 'box') cajas.push({ b: cajaMundo(pl, q.a), m: q.m, ref: q, grupo: k, pl, base: pl.y }); });
  let entre = 0;
  for (const [A, B, e, s, pl] of encimadas(cajas, { mismoGrupo: false })) {
    if (A.grupo === B.grupo) continue;
    entre++;
    if (entre <= 10) fail(`caras encimadas entre ${A.pl.name} y ${B.pl.name} (${s > 0 ? '+' : '-'}${EJE[e]} en ${pl.toFixed(2)}): ${desc(A.ref)} / ${desc(B.ref)}`);
  }
  // contra el terreno y contra las calles: caras de arriba casi a la misma altura (o la calle por encima del piso de adentro)
  const off = (rb, idx) => (rb.under ? 0.045 : 0.07 + (idx % 7) * 0.01);
  const calles = [];
  world.ribbons.forEach((rb, idx) => {
    for (let i = 0; i < rb.pts.length - 1; i++) {
      const [ax, az] = rb.pts[i], [bx, bz] = rb.pts[i + 1], L = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / L, nz = (bx - ax) / L;
      for (let t = 0; t < 1; t += 0.34) for (let w = -rb.w / 2 + 0.25; w <= rb.w / 2 - 0.25; w += 0.5) {
        const x = ax + (bx - ax) * t + nx * w, z = az + (bz - az) * t + nz * w;
        if (!world.enPuente(x, z)) calles.push([x, z, world.terrainHeight(x, z) + off(rb, idx), rb.m]); // sobre los puentes no se dibuja
      }
    }
  });
  const idx = new Map(), C = 4;
  for (const c of calles) { const k = Math.floor(c[0] / C) * 100003 + Math.floor(c[1] / C); let a = idx.get(k); if (!a) idx.set(k, (a = [])); a.push(c); }
  let terreno = 0, calle = 0;
  const vistosT = new Set(), vistosC = new Set();
  for (const c of cajas) {
    const b = c.b;
    if (b[4] - c.pl.y > 0.6) continue; // sólo caras bajas
    const deEscalera = c.ref.tag === 'esc'; // el pie de una escalera se mete en el terreno (en la ciénaga, desparejo)
    // terreno: muestreo de la cara de arriba
    let cerca = 0, n = 0;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const x = b[0] + ((b[3] - b[0]) * (i + 0.5)) / 3, z = b[2] + ((b[5] - b[2]) * (j + 0.5)) / 3;
      n++;
      if (Math.abs(b[4] - world.terrainHeight(x, z)) < 0.02) cerca++;
    }
    if (cerca >= 2 && !deEscalera && !vistosT.has(c.pl)) { vistosT.add(c.pl); terreno++; if (terreno <= 10) fail(`${c.pl.name} en (${c.pl.x.toFixed(0)}, ${c.pl.z.toFixed(0)}): cara de arriba al ras del terreno ${desc(c.ref)}`); }
    // calles
    for (let i = Math.floor(b[0] / C); i <= Math.floor(b[3] / C); i++) for (let j = Math.floor(b[2] / C); j <= Math.floor(b[5] / C); j++) {
      for (const [x, z, y, m] of idx.get(i * 100003 + j) || []) {
        if (x <= b[0] + 0.05 || x >= b[3] - 0.05 || z <= b[2] + 0.05 || z >= b[5] - 0.05) continue;
        // la calle se dibuja casi a la altura de la cara (titila) o por encima de un piso (se ve adentro)
        if (y > b[4] - 0.02 && y < b[4] + 0.3 && b[4] - b[1] > 0.05) {
          const key = `${c.pl.name}@${c.pl.x.toFixed(0)},${c.pl.z.toFixed(0)}`;
          if (vistosC.has(key)) continue;
          vistosC.add(key); calle++;
          if (calle <= 15) fail(`${c.pl.name} en (${c.pl.x.toFixed(0)}, ${c.pl.z.toFixed(0)}): la ${m} pasa a ${(y - b[4]).toFixed(3)} m de la cara de arriba de ${desc(c.ref)}`);
        }
      }
    }
  }
  console.log(`caras encimadas entre estructuras: ${entre}; al ras del terreno: ${terreno}; contra calles: ${calle}`);
}

// ---------- 10) Piezas rompibles ----------
function piezas(world, fail) {
  let sueltas = 0, decor = 0;
  for (const [name, opts] of casos()) {
    const P = PLANOS[name](opts);
    const { lista, deGrupo } = piezasDe(P);
    const sin = sinApoyo(lista, vecinasDe(lista), new Set());
    for (const i of sin) { sueltas++; fail(`${etiqueta(name, opts)}: pieza sin apoyo desde el principio (${lista[i].clase}, ${lista[i].parts.length} partes, ${P.parts[lista[i].parts[0]] ? desc(P.parts[lista[i].parts[0]]) : 'sin partes'})`); }
    for (const [g, i] of deGrupo) {
      if (i >= 0 || P.fijos.has(g)) continue;
      const qs = P.parts.filter((q) => q.g === g);
      if (!qs.length) continue;
      const y0 = Math.min(...qs.flatMap((q) => cajasParte(q).map((b) => b[1])));
      if (y0 > 0.3) { decor++; fail(`${etiqueta(name, opts)}: decoración suelta en el aire (no toca ninguna pieza): ${desc(qs[0])}`); }
    }
  }
  const rompibles = world.piezas.filter((p) => !p.fija).length;
  console.log(`piezas del mapa: ${world.piezas.length} (${rompibles} rompibles); sin apoyo: ${sueltas}; decoración suelta: ${decor}`);
}

// ---------- 11) Derrumbes ----------
// En un mundo aparte (romper piezas lo modifica).
function derrumbes(fail) {
  const w = new World(1, 1200);
  const vol = (a) => (a[3] - a[0]) * (a[4] - a[1]) * (a[5] - a[2]);
  let n = 0;
  // a) la vuelta al mundo: si se rompe la estructura (patas, eje y aro), se caen todas las cabinas
  const rueda = w.placed.find((p) => p.name === 'rueda');
  if (rueda) {
    const ids = rueda.piezas.filter((id) => !w.piezas[id].fija);
    const aro = ids.reduce((a, b) => (vol(w.piezas[b].aabb) > vol(w.piezas[a].aabb) ? b : a));
    w.romperPieza(aro);
    const caen = new Set(w.piezasSinApoyo(aro));
    const colgadas = ids.filter((id) => id !== aro && w.piezas[id].aabb[1] > rueda.y + 0.5);
    const quedan = colgadas.filter((id) => !caen.has(id));
    n++;
    if (!colgadas.length || quedan.length) fail(`derrumbe: al romper la vuelta al mundo quedan ${quedan.length} de ${colgadas.length} cabinas en el aire`);
    if (!w.piezas[aro].solids.every((s) => s.dead)) fail('derrumbe: la pieza rota sigue chocando');
  }
  // b) romper una pared de la planta baja de cada casa no tira el techo ni las otras paredes
  for (const pl of w.placed.filter((p) => p.name === 'casa').slice(0, 6)) {
    const ids = pl.piezas.filter((id) => !w.piezas[id].fija);
    const pared = ids.find((id) => { const a = w.piezas[id].aabb; return a[1] < pl.y + 0.2 && a[4] > pl.y + 3 && Math.min(a[3] - a[0], a[5] - a[2]) < 0.6 && w.piezas[id].clase !== 'metal'; });
    if (pared === undefined) continue;
    w.romperPieza(pared);
    const caen = w.piezasSinApoyo(pared);
    const grandes = caen.filter((id) => vol(w.piezas[id].aabb) > 1);
    n++;
    if (grandes.length) fail(`derrumbe: romper una pared de la casa en (${pl.x.toFixed(0)}, ${pl.z.toFixed(0)}) tira ${grandes.length} piezas grandes (${grandes.slice(0, 3).map((id) => w.piezas[id].clase).join(', ')})`);
  }
  console.log(`derrumbes revisados: ${n}`);
}
