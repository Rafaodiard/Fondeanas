// Colisiones del mapa: cajas, rampas y cilindros en una grilla espacial.
// Lo usan el cliente (movimiento del jugador) y el servidor (dónde cae el loot).

export const STEP = 0.55; // escalón que se sube caminando

const CELL = 8;

export class Solidos {
  constructor() {
    this.list = []; // {x0,y0,z0,x1,y1,z1, up?, lo?, cyl?, r?, x?, z?, kind}
    this.grid = new Map();
    this.stamp = 0;
  }

  add(s) {
    s.id = this.list.length;
    s.mark = 0;
    this.list.push(s);
    const i0 = Math.floor(s.x0 / CELL), i1 = Math.floor(s.x1 / CELL);
    const j0 = Math.floor(s.z0 / CELL), j1 = Math.floor(s.z1 / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = i * 65536 + j;
      let arr = this.grid.get(k);
      if (!arr) this.grid.set(k, (arr = []));
      arr.push(s);
    }
    return s;
  }

  // Saca un sólido (pieza del mapa rota): deja de chocar; queda en `list` marcado como muerto.
  remove(s) {
    if (s.dead) return;
    s.dead = true;
    const i0 = Math.floor(s.x0 / CELL), i1 = Math.floor(s.x1 / CELL);
    const j0 = Math.floor(s.z0 / CELL), j1 = Math.floor(s.z1 / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const arr = this.grid.get(i * 65536 + j);
      const k = arr ? arr.indexOf(s) : -1;
      if (k >= 0) arr.splice(k, 1);
    }
  }

  addBox(b, kind = 'house') { return this.add({ ...b, kind }); }
  addCyl(x, z, r, y0, y1, kind = 'house') { return this.add({ cyl: true, x, z, r, y0, y1, x0: x - r, x1: x + r, z0: z - r, z1: z + r, kind }); }

  // Recorre los sólidos cerca de un punto (radio rad), sin repetir.
  near(x, z, rad, fn) {
    this.stamp++;
    const i0 = Math.floor((x - rad) / CELL), i1 = Math.floor((x + rad) / CELL);
    const j0 = Math.floor((z - rad) / CELL), j1 = Math.floor((z + rad) / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const arr = this.grid.get(i * 65536 + j);
      if (!arr) continue;
      for (const s of arr) { if (s.mark === this.stamp) continue; s.mark = this.stamp; fn(s); }
    }
  }

  // Altura de la cara de arriba del sólido en (x,z) (o -Infinity si el punto no está encima).
  static top(s, x, z) {
    if (s.cyl) {
      const dx = x - s.x, dz = z - s.z;
      return dx * dx + dz * dz <= s.r * s.r ? s.y1 : -Infinity;
    }
    if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) return -Infinity;
    return Solidos.topAt(s, x, z);
  }

  static topAt(s, x, z) {
    if (!s.up) return s.y1;
    let t;
    switch (s.up) {
      case '+x': t = (x - s.x0) / (s.x1 - s.x0); break;
      case '-x': t = (s.x1 - x) / (s.x1 - s.x0); break;
      case '+z': t = (z - s.z0) / (s.z1 - s.z0); break;
      default: t = (s.z1 - z) / (s.z1 - s.z0);
    }
    t = Math.min(1, Math.max(0, t));
    const lo = s.lo ?? s.y0;
    return lo + (s.y1 - lo) * t;
  }

  // Piso más alto debajo de los pies (ref = altura de referencia de los pies).
  ground(x, z, ref) {
    let h = -Infinity;
    this.near(x, z, 0, (s) => {
      const t = Solidos.top(s, x, z);
      if (t > h && t <= ref + STEP) h = t;
    });
    return h;
  }

  // Techo más bajo arriba de la cabeza: base del primer sólido que empieza por encima de los pies.
  ceiling(x, z, feet) {
    let c = Infinity;
    this.near(x, z, 0, (s) => {
      if (s.y0 < feet + STEP) return;
      if (s.cyl) { const dx = x - s.x, dz = z - s.z; if (dx * dx + dz * dz > s.r * s.r) return; } else if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) return;
      if (s.y0 < c) c = s.y0;
    });
    return c;
  }

  // Empuja una cápsula vertical (pos = pies) fuera de las paredes.
  push(pos, radius, height) {
    this.near(pos.x, pos.z, radius + 0.1, (s) => {
      if (pos.y + height <= s.y0) return;
      if (s.cyl) {
        if (pos.y >= s.y1 - STEP) return;
        const dx = pos.x - s.x, dz = pos.z - s.z, d = Math.hypot(dx, dz), min = s.r + radius;
        if (d >= min) return;
        if (d > 1e-4) { pos.x = s.x + (dx / d) * min; pos.z = s.z + (dz / d) * min; } else pos.x = s.x + min;
        return;
      }
      const cx = Math.max(s.x0, Math.min(pos.x, s.x1));
      const cz = Math.max(s.z0, Math.min(pos.z, s.z1));
      const dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) return;
      // Si la cara de arriba en ese borde está a la altura de un escalón, es piso: se sube, no frena.
      if (Solidos.topAt(s, cx, cz) <= pos.y + STEP) return;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius; pos.z = cz + (dz / d) * radius;
      } else {
        const ex0 = s.x0 - radius - pos.x, ex1 = s.x1 + radius - pos.x, ez0 = s.z0 - radius - pos.z, ez1 = s.z1 + radius - pos.z;
        const bx = Math.abs(ex0) < Math.abs(ex1) ? ex0 : ex1;
        const bz = Math.abs(ez0) < Math.abs(ez1) ? ez0 : ez1;
        if (Math.abs(bx) < Math.abs(bz)) pos.x += bx; else pos.z += bz;
      }
    });
  }

  // Rayo contra los sólidos (para el servidor o pruebas). Devuelve distancia o Infinity.
  ray(o, d, max) {
    let best = max;
    const steps = Math.ceil(max / CELL) + 1;
    const seen = new Set();
    for (let k = 0; k <= steps; k++) {
      const x = o.x + d.x * k * CELL, z = o.z + d.z * k * CELL;
      this.near(x, z, CELL, (s) => {
        if (seen.has(s.id)) return; seen.add(s.id);
        const t = rayBox(o, d, s);
        if (t < best) best = t;
      });
    }
    return best;
  }
}

function rayBox(o, d, s) {
  let tmin = 0, tmax = Infinity;
  for (const [oa, da, a0, a1] of [[o.x, d.x, s.x0, s.x1], [o.y, d.y, s.y0, s.y1], [o.z, d.z, s.z0, s.z1]]) {
    if (Math.abs(da) < 1e-9) { if (oa < a0 || oa > a1) return Infinity; continue; }
    let t0 = (a0 - oa) / da, t1 = (a1 - oa) / da;
    if (t0 > t1) [t0, t1] = [t1, t0];
    tmin = Math.max(tmin, t0); tmax = Math.min(tmax, t1);
    if (tmin > tmax) return Infinity;
  }
  return tmin;
}
