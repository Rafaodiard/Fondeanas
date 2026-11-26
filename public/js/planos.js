// Planos de las estructuras de la isla.
// Cada plano es una lista de piezas en coordenadas locales (frente hacia +Z, piso en y=0).
// De la misma lista salen la malla 3D (cliente) y los sólidos de colisión (cliente y servidor),
// así lo que se ve y lo que choca son exactamente lo mismo.
// No usa Three.js: lo importan también el servidor y las herramientas.

export const STOREY = 4; // altura de un piso (igual que la grilla de construcción)
const T = 0.3; // espesor de paredes y losas

// Paleta: [color, tipo, dibujo]. tipo: s = estándar, v = vidrio, e = emisivo, m = metálico.
// dibujo (lo pinta el shader): 1 ladrillo, 2 tablas, 3 tejas, 4 chapa acanalada, 5 hormigón, 6 piedra, 7 baldosas,
// 8 piso de madera, 9 troncos, 10 revoque, 11 adobe, 12 heno
export const PALETA = {
  blanco: ['#f1ece0', 's', 10], crema: ['#f2e2bf', 's', 10], arena: ['#e9cf9c', 's', 10], salmon: ['#efa27e', 's', 10],
  celeste: ['#a9d3e6', 's', 10], verdeagua: ['#a3d8c0', 's', 10], amarillo: ['#f4d466', 's', 10], rosa: ['#f1b7c2', 's', 10],
  lila: ['#c4b6e6', 's', 10], menta: ['#c9e8b4', 's', 10], durazno: ['#f6c79b', 's', 10],
  ladrillo: ['#b65a3e', 's', 1], ladrillo2: ['#9e4b35', 's', 1], piedra: ['#9c968a', 's', 6], piedra2: ['#7f7a70', 's', 6],
  hormigon: ['#bdbab2', 's', 5], hormigon2: ['#8f8d87', 's', 5], adobe: ['#d9a66b', 's', 11], adobe2: ['#c98f5a', 's', 11], adobe3: ['#e6bd86', 's', 11],
  madera: ['#a8743f', 's', 2], madera2: ['#c28f55', 's', 2], madera_osc: ['#6e4a2a', 's', 2], tronco: ['#8a5a32', 's', 9],
  piso: ['#b58a5c', 's', 8], baldosa: ['#d9d3c5', 's', 7], baldosa2: ['#7d8a96', 's', 7], alfombra: ['#9a4a4a', 's'],
  techo_rojo: ['#c8503a', 's', 3], techo_azul: ['#3f6d9e', 's', 3], techo_verde: ['#4f8a5b', 's', 3], techo_gris: ['#5f6670', 's', 3],
  techo_marron: ['#7a4b33', 's', 3], techo_negro: ['#3a3d44', 's', 3], techo_terracota: ['#d9774a', 's', 3],
  chapa: ['#a3acb1', 'm', 4], chapa_roja: ['#b4483a', 'm', 4], chapa_azul: ['#4a76a8', 'm', 4], chapa_verde: ['#5f9a6a', 'm', 4],
  marco: ['#fbf7ef', 's'], marco_osc: ['#3b2f2a', 's'], vidrio: ['#5f9fc4', 'v'], metal: ['#8a9099', 'm'],
  metal_osc: ['#4a5058', 'm'], oxido: ['#a0583a', 'm', 4], negro: ['#2b2b2e', 's'], amarillo_seg: ['#f2c230', 's'],
  rojo: ['#d94a3a', 's'], azul: ['#3a78d9', 's'], verde: ['#4caf50', 's'], naranja: ['#f08a2c', 's'], blanco_puro: ['#ffffff', 's'],
  lona_roja: ['#e0554a', 's'], lona_azul: ['#4c8fd6', 's'], lona_amarilla: ['#f2c94c', 's'], lona_verde: ['#5bb36a', 's'], lona_blanca: ['#f4f1ea', 's'], lona_naranja: ['#f08a3c', 's'],
  luz: ['#fff2b0', 'e'], luz_roja: ['#ff6a5a', 'e'], luz_azul: ['#8fd3ff', 'e'], neon_rosa: ['#ff7ad1', 'e'],
  nieve: ['#f4f7fb', 's'], heno: ['#e3c25a', 's', 12], tierra: ['#8a6a45', 's'], pasto: ['#6cbf4b', 's'], hoja: ['#4f9e3a', 's'],
  agua: ['#3aa6d8', 'v'], goma: ['#232326', 's'], cuero: ['#7b4a2c', 's'], tela: ['#5a7fb0', 's'], tela2: ['#b0605a', 's'],
};

// ---------- Constructor de planos ----------
export class Plano {
  constructor() {
    this.parts = []; // piezas visuales
    this.solids = []; // {x0,y0,z0,x1,y1,z1, up?} (up = dirección hacia donde sube la rampa)
    this.cyls = []; // sólidos cilíndricos {x,z,r,y0,y1}
    this.loot = []; // {x,y,z}
    this.chests = []; // {x,y,z,rot}
    this.lights = []; // {x,y,z}
    // Grupos: cada grupo es una pieza que se rompe entera (una pared de ~4 m, una baldosa de losa, un mueble...).
    // Todo lo que se agrega lleva `g` (número de grupo). Los grupos en `fijos` no se rompen (cimientos, pisos al ras).
    this.ng = 0;
    this.fijos = new Set();
    this._g = 0; // grupo actual
    this._gd = 0; // profundidad: > 0 dentro de grupo(), las piezas comparten grupo
    this.tag = null; // marca opcional para las piezas que se agregan (esc = escalón, veg = planta)
    this.vanos = []; // vanos de puertas al nivel del piso (los zócalos no los tapan)
    this.techos = []; // aguas de los techos {x0,z0,x1,z1,ylo,yhi,up,g} (para apoyar nieve encima)
  }

  // Grupo para la próxima pieza: el actual si estamos dentro de grupo(), si no uno nuevo.
  gid() { return this._gd ? this._g : ++this.ng; }

  // Junta en una sola pieza rompible todo lo que agrega fn. fija: no se rompe.
  grupo(fn, { fija = false } = {}) {
    const top = this._gd === 0;
    if (top) this._g = ++this.ng;
    this._gd++;
    try { fn(); } finally { this._gd--; }
    if (top && fija) this.fijos.add(this._g);
    return this;
  }

  // Ejecuta fn con el grupo g (aunque estemos dentro de otro).
  conGrupo(g, fn) {
    const sg = this._g, sd = this._gd;
    this._g = g; this._gd = Math.max(1, sd + 1);
    try { fn(); } finally { this._g = sg; this._gd = sd; }
  }

  conTag(tag, fn) { const t = this.tag; this.tag = tag; try { fn(); } finally { this.tag = t; } return this; }

  pushPart(q) { q.g = q.g ?? this.gid(); if (this.tag) q.tag = this.tag; this.parts.push(q); return q.g; }

  // Sólido sin parte visual (caja o rampa) en el grupo actual.
  solid(s, g = this.gid()) { this.solids.push({ ...s, g }); return this; }
  solidCyl(c, g = this.gid()) { this.cyls.push({ ...c, g }); return this; }

  // Caja de esquinas (x0,y0,z0)-(x1,y1,z1). solid=false la deja sólo visual.
  box(x0, y0, z0, x1, y1, z1, m, solid = true) {
    if (x1 < x0) [x0, x1] = [x1, x0];
    if (z1 < z0) [z0, z1] = [z1, z0];
    if (y1 < y0) [y0, y1] = [y1, y0];
    if (x1 - x0 < 1e-3 || y1 - y0 < 1e-3 || z1 - z0 < 1e-3) return this;
    const g = this.gid();
    if (m) this.pushPart({ t: 'box', a: [x0, y0, z0, x1, y1, z1], m, g });
    if (solid) this.solids.push({ x0, y0, z0, x1, y1, z1, g });
    return this;
  }

  // Caja por centro de la base y tamaño.
  cbox(x, y, z, sx, sy, sz, m, solid = true) {
    return this.box(x - sx / 2, y, z - sz / 2, x + sx / 2, y + sy, z + sz / 2, m, solid);
  }

  // Rampa sólida: cuña que sube hacia `up` ('+x','-x','+z','-z'). y0 = base, y1 = arriba del lado alto.
  // lo = altura del lado bajo (por defecto y0).
  ramp(x0, y0, z0, x1, y1, z1, up, m, solid = true, lo = y0) {
    if (x1 < x0) [x0, x1] = [x1, x0];
    if (z1 < z0) [z0, z1] = [z1, z0];
    const g = this.gid();
    if (m) this.pushPart({ t: 'ramp', a: [x0, y0, z0, x1, y1, z1], up, lo, m, g });
    if (solid) this.solids.push({ x0, y0, z0, x1, y1, z1, up, lo, g });
    return this;
  }

  // Cilindro (o cono truncado). (x,z) centro, y0 base. solid agrega un cilindro de colisión.
  cyl(x, y0, z, r, h, m, { r2 = r, seg = 12, solid = false, open = false } = {}) {
    const g = this.pushPart({ t: 'cyl', x, y: y0, z, r, r2, h, seg, m, open });
    if (solid) this.cyls.push({ x, z, r: Math.max(r, r2), y0, y1: y0 + h, g });
    return this;
  }

  // Cilindro horizontal entre dos puntos (caños, ejes, troncos acostados). Sólo visual.
  tube(a, b, r, m, seg = 8) {
    this.pushPart({ t: 'tube', a, b, r, m, seg });
    return this;
  }

  // Esfera (o casquete si `half`). Sólo visual. grosor: también dibuja la cara de adentro (cúpulas que se ven desde abajo).
  sphere(x, y, z, r, m, { half = false, seg = 12, sy = 1, grosor = 0 } = {}) {
    this.pushPart({ t: 'sph', x, y, z, r, m, half, seg, sy, grosor });
    return this;
  }

  // Pared curva: sector de anillo de radio r0 (adentro) a r1 (afuera), de los ángulos a0 a a1 (x = cos, z = sin). Sólo visual.
  arc(x, y, z, r0, r1, h, a0, a1, m, seg = 8) {
    this.pushPart({ t: 'arc', x, y, z, r0, r1, h, a0, a1, m, seg });
    return this;
  }

  // Prisma triangular (frontón de techo) para cerrar triángulos. Sólo visual.
  // Base de x0..x1 (o z0..z1 según axis) a altura y0, cumbrera en el medio a y1, espesor en la otra dirección.
  tri(x0, y0, z0, x1, y1, z1, axis, m) {
    this.pushPart({ t: 'tri', a: [x0, y0, z0, x1, y1, z1], axis, m });
    return this;
  }

  // Losa delgada inclinada (agua del techo), visual. p0 borde bajo, p1 borde alto (centros), ancho a lo largo.
  slope(x0, z0, x1, z1, ylo, yhi, up, th, m) {
    this.pushPart({ t: 'slope', a: [x0, z0, x1, z1], ylo, yhi, up, th, m });
    return this;
  }

  addLoot(x, y, z) { this.loot.push({ x, y: y + 0.05, z }); return this; }
  addChest(x, y, z, rot = 0) { this.chests.push({ x, y: y + 0.05, z, rot }); return this; }
  addLight(x, y, z) { this.lights.push({ x, y, z }); return this; }

  // ---------- Ayudantes de arquitectura ----------

  // Pared recta de (x0,z0) a (x1,z1) (eje X o Z), con aberturas.
  // ops: [{c: centro a lo largo de la pared desde el inicio, w, y: base, h, kind: 'puerta'|'ventana'|'hueco'}]
  // ext: cuánto se alarga la pared más allá de cada punta (para cerrar las esquinas). [e0, e1] o un número.
  // La pared se corta en paneles de ~4 m: cada panel (con sus marcos y su puerta) se rompe por separado.
  wall(x0, z0, x1, z1, y0, h, m, ops = [], { t = T, frame = 'marco', glass = false, door = 'madera', ext = 0 } = {}) {
    const alongX = Math.abs(z1 - z0) < 1e-6;
    const L = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const sgn = alongX ? Math.sign(x1 - x0) || 1 : Math.sign(z1 - z0) || 1;
    const inn = alongX ? -Math.sign(z0) || 1 : -Math.sign(x0) || 1; // lado de adentro (hacia el centro del plano)
    const [e0, e1] = Array.isArray(ext) ? ext : [ext, ext];
    // caja a lo largo de la pared (u0..u1 desde el inicio) y a lo ancho (w0..w1 desde el eje de la pared)
    const caja = (u0, u1, ya, yb, w0, w1, mat, solid) => {
      const a = sgn * u0, b = sgn * u1;
      if (alongX) this.box(x0 + a, y0 + ya, z0 + w0, x0 + b, y0 + yb, z0 + w1, mat, solid);
      else this.box(x0 + w0, y0 + ya, z0 + a, x0 + w1, y0 + yb, z0 + b, mat, solid);
    };
    const nPan = Math.max(1, Math.round((L + e0 + e1) / 4));
    const top = this._gd === 0;
    let g0 = this._g;
    if (top) { g0 = this.ng + 1; this.ng += nPan; }
    const span = (L + e0 + e1) / nPan;
    const panel = (u) => (top ? g0 + Math.min(nPan - 1, Math.max(0, Math.floor((u + e0) / span))) : this._g);
    const cortes = top ? Array.from({ length: nPan - 1 }, (_, k) => -e0 + span * (k + 1)) : [];
    const seg = (a, b, ya, yb) => {
      if (b - a < 0.02 || yb - ya < 0.02) return;
      const pts = [a, ...cortes.filter((c) => c > a + 0.01 && c < b - 0.01), b];
      for (let k = 0; k < pts.length - 1; k++) this.conGrupo(panel((pts[k] + pts[k + 1]) / 2), () => caja(pts[k], pts[k + 1], ya, yb, -t / 2, t / 2, m, true));
    };
    const sorted = [...ops].sort((a, b) => a.c - b.c);
    let cur = -e0;
    for (const o of sorted) {
      const a = o.c - o.w / 2, b = o.c + o.w / 2;
      seg(cur, a, 0, h);
      seg(a, b, 0, o.y); // debajo (alféizar)
      seg(a, b, o.y + o.h, h); // encima (dintel)
      cur = b;
      if (o.y < 0.05 && o.kind !== 'ventana') {
        // vano de puerta: lo usan los zócalos para no taparlo
        const u0 = sgn * a, u1 = sgn * b;
        this.vanos.push(alongX
          ? { x0: x0 + Math.min(u0, u1), x1: x0 + Math.max(u0, u1), z0: z0 - t / 2, z1: z0 + t / 2, y0, y1: y0 + o.h }
          : { x0: x0 - t / 2, x1: x0 + t / 2, z0: z0 + Math.min(u0, u1), z1: z0 + Math.max(u0, u1), y0, y1: y0 + o.h });
      }
      this.conGrupo(panel(o.c), () => {
        if (frame && o.kind !== 'hueco') this.opening(caja, o, t, frame, glass && o.kind === 'ventana');
        if (o.kind === 'puerta' && o.w <= 1.9 && door) {
          // hoja de la puerta abierta hacia adentro, pegada al costado del vano (sólida: no se atraviesa)
          const L2 = o.w - 0.1;
          caja(a, a + 0.06, 0, o.h - 0.05, inn * (t / 2), inn * (t / 2 + L2), door, true);
        }
      });
    }
    seg(cur, L + e1, 0, h);
    return this;
  }

  // Marco de una abertura (visual). caja(u0, u1, ya, yb, w0, w1, mat, solid) dibuja a lo largo de la pared.
  // El marco entra 1 cm en el vano: así sus caras no quedan en el mismo plano que los cantos de la pared (titilarían).
  opening(caja, o, t, frame, glass) {
    const f = 0.12, d = t + 0.1, e = 0.01;
    const at = (u, y, w, hh, dd) => caja(u - w / 2, u + w / 2, y, y + hh, -dd / 2, dd / 2, frame, false);
    at(o.c - o.w / 2 - f / 2 + e, o.y, f, o.h + f, d);
    at(o.c + o.w / 2 + f / 2 - e, o.y, f, o.h + f, d);
    at(o.c, o.y + o.h - e, o.w + f * 2, f, d);
    if (o.kind === 'ventana') {
      at(o.c, o.y - 0.1 + e, o.w + f * 2 + 0.1, 0.1, d + 0.16); // alféizar
      at(o.c, o.y + o.h / 2 - 0.04, o.w, 0.07, 0.08); // travesaño
      at(o.c, o.y, 0.07, o.h, 0.08); // parteluz
      if (glass) caja(o.c - o.w / 2, o.c + o.w / 2, o.y, o.y + o.h, -0.02, 0.02, 'vidrio', false);
      // la ventana no se cruza (ni con vidrio ni sin él: el marco quedaría adentro del cuerpo), pero las balas y la
      // cámara pasan: sólido invisible marcado como vidrio
      const n0 = this.solids.length;
      caja(o.c - o.w / 2, o.c + o.w / 2, o.y, o.y + o.h, -0.03, 0.03, null, true);
      for (let k = n0; k < this.solids.length; k++) this.solids[k].vidrio = true;
    }
  }

  // Anillo (zócalo, cornisa) pegado por afuera de las paredes de un rectángulo de paredes centradas en x0,x1,z0,z1.
  // Deja libres los vanos de las puertas. Se corta en tramos de ~4 m (cada tramo se rompe con la pared que toca).
  anillo(x0, z0, x1, z1, y0, y1, m, { out = 0.06, fija = false } = {}) {
    const ox0 = x0 - T / 2, ox1 = x1 + T / 2, oz0 = z0 - T / 2, oz1 = z1 + T / 2;
    const lados = [
      [ox0 - out, oz0 - out, ox1 + out, oz0, 'x'], [ox0 - out, oz1, ox1 + out, oz1 + out, 'x'],
      [ox0 - out, oz0, ox0, oz1, 'z'], [ox1, oz0, ox1 + out, oz1, 'z'],
    ];
    for (const [a0, b0, a1, b1, eje] of lados) {
      // tramos libres a lo largo del lado, restando los vanos que lo cruzan a esta altura
      let segs = eje === 'x' ? [[a0, a1]] : [[b0, b1]];
      for (const v of this.vanos) {
        if (v.y1 <= y0 || v.y0 >= y1) continue;
        if (eje === 'x' ? v.z1 < b0 - 0.4 || v.z0 > b1 + 0.4 : v.x1 < a0 - 0.4 || v.x0 > a1 + 0.4) continue;
        const [va, vb] = eje === 'x' ? [v.x0 - 0.12, v.x1 + 0.12] : [v.z0 - 0.12, v.z1 + 0.12];
        segs = segs.flatMap(([s, e]) => (vb <= s || va >= e ? [[s, e]] : [[s, va], [vb, e]].filter(([u, w]) => w - u > 0.05)));
      }
      for (const [s, e] of segs) {
        const n = Math.max(1, Math.round((e - s) / 4));
        for (let k = 0; k < n; k++) {
          const u0 = s + ((e - s) * k) / n, u1 = s + ((e - s) * (k + 1)) / n;
          this.grupo(() => {
            if (eje === 'x') this.box(u0, y0, b0, u1, y1, b1, m, false);
            else this.box(a0, y0, u0, a1, y1, u1, m, false);
          }, { fija });
        }
      }
    }
    return this;
  }

  // Losa horizontal con huecos rectangulares [{x0,z0,x1,z1}].
  // Se corta en baldosas de ~4 m: cada una se rompe por separado (salvo dentro de un grupo()).
  slab(x0, z0, x1, z1, y, m, holes = [], th = T) {
    let rects = [[x0, z0, x1, z1]];
    for (const h of holes) {
      const next = [];
      for (const [a0, b0, a1, b1] of rects) {
        if (h.x1 <= a0 || h.x0 >= a1 || h.z1 <= b0 || h.z0 >= b1) { next.push([a0, b0, a1, b1]); continue; }
        if (h.z0 > b0) next.push([a0, b0, a1, h.z0]);
        if (h.z1 < b1) next.push([a0, h.z1, a1, b1]);
        const zb = Math.max(b0, h.z0), zt = Math.min(b1, h.z1);
        if (h.x0 > a0) next.push([a0, zb, h.x0, zt]);
        if (h.x1 < a1) next.push([h.x1, zb, a1, zt]);
      }
      rects = next;
    }
    if (this._gd) { for (const [a0, b0, a1, b1] of rects) this.box(a0, y - th, b0, a1, y, b1, m); return this; }
    const nx = Math.max(1, Math.round((x1 - x0) / 4)), nz = Math.max(1, Math.round((z1 - z0) / 4));
    const gx = Array.from({ length: nx + 1 }, (_, k) => x0 + ((x1 - x0) * k) / nx), gz = Array.from({ length: nz + 1 }, (_, k) => z0 + ((z1 - z0) * k) / nz);
    const grupos = new Map();
    for (const [a0, b0, a1, b1] of rects) {
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const c0 = Math.max(a0, gx[i]), c1 = Math.min(a1, gx[i + 1]), d0 = Math.max(b0, gz[j]), d1 = Math.min(b1, gz[j + 1]);
        if (c1 - c0 < 0.01 || d1 - d0 < 0.01) continue;
        const k = i * 1000 + j;
        if (!grupos.has(k)) grupos.set(k, ++this.ng);
        this.conGrupo(grupos.get(k), () => this.box(c0, y - th, d0, c1, y, d1, m));
      }
    }
    return this;
  }

  // Escalera: rampa sólida invisible + escalones visibles. Sube hacia `up` desde y0 hasta y1. Se rompe entera.
  // lados (con rail): para cada costado (el de x0/z0 y el de x1/z1): número = metros sin baranda arriba (por donde
  // se sale de costado; 0 = baranda entera), [abajo, arriba] = metros libres en cada punta (para entrar de costado),
  // 'pared' = pasamanos contra la pared (sin balaustres), null = nada.
  stairs(x0, z0, x1, z1, y0, y1, up, m, { rail = null, lados = [0, 0] } = {}) {
    if (x1 < x0) [x0, x1] = [x1, x0];
    if (z1 < z0) [z0, z1] = [z1, z0];
    return this.grupo(() => {
      this.ramp(x0, y0, z0, x1, y1, z1, up, null);
      const n = Math.max(2, Math.round((y1 - y0) / 0.25));
      const along = up[1] === 'x' ? x1 - x0 : z1 - z0;
      this.conTag('esc', () => {
        for (let k = 0; k < n; k++) {
          const a = (k / n) * along, b = ((k + 1) / n) * along;
          const top = y0 + ((k + 1) / n) * (y1 - y0);
          let bx0 = x0, bx1 = x1, bz0 = z0, bz1 = z1;
          if (up === '+x') { bx0 = x0 + a; bx1 = x0 + b; } else if (up === '-x') { bx1 = x1 - a; bx0 = x1 - b; } else if (up === '+z') { bz0 = z0 + a; bz1 = z0 + b; } else { bz1 = z1 - a; bz0 = z1 - b; }
          const bottom = Math.max(y0, top - 0.5);
          this.box(bx0, bottom, bz0, bx1, top, bz1, m, false);
        }
        // Zanca: losa inclinada debajo de los escalones.
        this.slope(x0, z0, x1, z1, y0 - 0.05, y1 - 0.3, up, 0.3, m);
      });
      if (rail) {
        // Baranda a los dos lados: pasamanos, balaustres y un panel sólido invisible debajo del pasamanos
        // (así no se atraviesa caminando por el borde de la escalera ni desde afuera).
        const hx = up[1] === 'x', R = 0.04;
        const lo = up[0] === '+' ? (hx ? x0 : z0) : (hx ? x1 : z1);
        const hi = up[0] === '+' ? (hx ? x1 : z1) : (hx ? x0 : z0);
        const L = Math.abs(hi - lo), nb = Math.max(2, Math.round(L / 0.9));
        for (const side of [0, 1]) {
          const modo = lados[side];
          if (modo === null) continue;
          const s0 = hx ? (side ? z1 - R : z0 + R) : (side ? x1 - R : x0 + R);
          const [abajo, arriba] = modo === 'pared' ? [0, 0] : Array.isArray(modo) ? modo : [0, modo];
          const fa = Math.min(0.8, abajo / L), fb = Math.max(fa + 0.2, 1 - arriba / L);
          const ua = lo + (hi - lo) * fa, ub = lo + (hi - lo) * fb, ya = y0 + (y1 - y0) * fa, yb2 = y0 + (y1 - y0) * fb;
          this.tube(hx ? [ua, ya + 1, s0] : [s0, ya + 1, ua], hx ? [ub, yb2 + 1, s0] : [s0, yb2 + 1, ub], R, rail, 6);
          if (modo === 'pared') continue; // contra la pared el cuerpo nunca llega al pasamanos
          const n2 = Math.max(2, Math.round(nb * (fb - fa))), Lf = L * (fb - fa);
          for (let k = 0; k <= n2; k++) {
            const t0 = fa + (k / n2) * (fb - fa), e = Math.min(n - 1, Math.max(0, Math.floor(t0 * n))), t = (e + 0.5) / n;
            const u = lo + (hi - lo) * t, ys = y0 + ((e + 1) / n) * (y1 - y0) - 0.02, yr = y0 + (y1 - y0) * t + 1;
            const px = hx ? u : s0, pz = hx ? s0 : u;
            this.box(px - 0.02, ys, pz - 0.02, px + 0.02, yr, pz + 0.02, rail, false);
          }
          // panel invisible: rampa de la altura del pasamanos (de ya a yb2) apoyada en el piso de abajo
          const [u0, u1] = [Math.min(ua, ub), Math.max(ua, ub)];
          if (hx) this.ramp(u0, y0, s0 - R, u1, yb2 + 1 + R, s0 + R, up, null, true, ya + 1 + R);
          else this.ramp(s0 - R, y0, u0, s0 + R, yb2 + 1 + R, u1, up, null, true, ya + 1 + R);
        }
      }
    });
  }

  // Techo a dos aguas sobre el rectángulo (x0,z0)-(x1,z1) con aleros. axis = 'x' si la cumbrera corre a lo largo de X.
  // Sólidos: losa de cielorraso + dos rampas, así se puede caminar arriba y no se atraviesa.
  // El cielorraso se rompe por baldosas; cada agua del techo se rompe entera.
  // inset: con paredes (wallM), el cielorraso va por adentro de ellas, así no comparte la cara de arriba con las paredes.
  gable(x0, z0, x1, z1, y, rise, m, { axis = 'x', over = 0.6, wallM = null, th = 0.25, ceil = 'piso', solidCeil = true, inset = wallM ? T / 2 : 0 } = {}) {
    if (solidCeil) this.slab(x0 + inset, z0 + inset, x1 - inset, z1 - inset, y + T, ceil);
    const agua = (a) => this.techos.push({ ...a, g: this._g });
    const lift = 0.22; // el techo visible queda apenas por encima de las paredes (no se asoman)
    const yb = y + T + lift;
    if (axis === 'x') {
      const zm = (z0 + z1) / 2, k = (rise - T) / ((z1 - z0) / 2);
      this.grupo(() => {
        this.ramp(x0, y + T, z0, x1, y + rise + lift, zm, '+z', null, true, yb);
        this.slope(x0 - over, z0 - over, x1 + over, zm, yb - over * k, y + rise + lift, '+z', th, m);
        agua({ x0: x0 - over, z0: z0 - over, x1: x1 + over, z1: zm, ylo: yb - over * k, yhi: y + rise + lift, up: '+z' });
        if (wallM) for (const x of [x0, x1]) this.tri(x - T / 2, y + T, z0, x + T / 2, y + rise + lift - th, z1, 'z', wallM);
        this.cbox((x0 + x1) / 2, y + rise + lift - 0.05, zm, x1 - x0 + over * 2 + 0.1, 0.22, 0.4, m, false); // cumbrera
      });
      this.grupo(() => {
        this.ramp(x0, y + T, zm, x1, y + rise + lift, z1, '-z', null, true, yb);
        this.slope(x0 - over, zm, x1 + over, z1 + over, yb - over * k, y + rise + lift, '-z', th, m);
        agua({ x0: x0 - over, z0: zm, x1: x1 + over, z1: z1 + over, ylo: yb - over * k, yhi: y + rise + lift, up: '-z' });
      });
    } else {
      const xm = (x0 + x1) / 2, k = (rise - T) / ((x1 - x0) / 2);
      this.grupo(() => {
        this.ramp(x0, y + T, z0, xm, y + rise + lift, z1, '+x', null, true, yb);
        this.slope(x0 - over, z0 - over, xm, z1 + over, yb - over * k, y + rise + lift, '+x', th, m);
        agua({ x0: x0 - over, z0: z0 - over, x1: xm, z1: z1 + over, ylo: yb - over * k, yhi: y + rise + lift, up: '+x' });
        if (wallM) for (const z of [z0, z1]) this.tri(x0, y + T, z - T / 2, x1, y + rise + lift - th, z + T / 2, 'x', wallM);
        this.cbox(xm, y + rise + lift - 0.05, (z0 + z1) / 2, 0.4, 0.22, z1 - z0 + over * 2 + 0.1, m, false);
      });
      this.grupo(() => {
        this.ramp(xm, y + T, z0, x1, y + rise + lift, z1, '-x', null, true, yb);
        this.slope(xm, z0 - over, x1 + over, z1 + over, yb - over * k, y + rise + lift, '-x', th, m);
        agua({ x0: xm, z0: z0 - over, x1: x1 + over, z1: z1 + over, ylo: yb - over * k, yhi: y + rise + lift, up: '-x' });
      });
    }
    return this;
  }

  // Nieve apoyada sobre las aguas de los techos: sigue la pendiente, apenas por encima, y se rompe con su agua.
  nieve(sobre = 0.1, grosor = 0.14) {
    for (const t of this.techos) this.conGrupo(t.g, () => this.slope(t.x0, t.z0, t.x1, t.z1, t.ylo + sobre, t.yhi + sobre, t.up, grosor, 'nieve'));
    return this;
  }

  // Techo plano con parapeto (caminable).
  // abierto: huecos en el parapeto [{ lado: 'x0'|'x1'|'z0'|'z1', a, b }] (a..b a lo largo del lado), para llegar con una escalera.
  // inset: la losa va por adentro de las paredes (centradas en x0..x1); el parapeto queda al ras de la cara de afuera.
  // Con inset negativo la losa tapa las paredes (que entonces tienen que terminar en y).
  flatRoof(x0, z0, x1, z1, y, m, { parapet = 0.9, pm = null, holes = [], trim = 'marco', abierto = [], inset = T / 2 } = {}) {
    this.slab(x0 + inset, z0 + inset, x1 - inset, z1 - inset, y + T, m, holes);
    if (parapet > 0) {
      const p = pm || m, ya = y + T, yb = y + T + parapet;
      const e = Math.max(0, inset);
      x0 -= e; z0 -= e; x1 += e; z1 += e;
      const tramo = (lado, a0, a1, mk) => {
        let segs = [[a0, a1]];
        for (const o of abierto) if (o.lado === lado) segs = segs.flatMap(([s, e]) => (o.b <= s || o.a >= e ? [[s, e]] : [[s, o.a], [o.b, e]].filter(([u, v]) => v - u > 0.01)));
        // cada tramo de parapeto (de ~4 m) se rompe por separado
        for (const [s, e] of segs) {
          const n = Math.max(1, Math.round((e - s) / 4));
          for (let k = 0; k < n; k++) this.grupo(() => mk(s + ((e - s) * k) / n, s + ((e - s) * (k + 1)) / n, k === 0, k === n - 1));
        }
      };
      // la moldura de arriba sobresale 8 cm en las puntas de cada lado (solo en las esquinas, para no superponerse)
      tramo('z0', x0, x1, (s, e, i, f) => { this.box(s, ya, z0, e, yb, z0 + 0.25, p); if (trim) this.box(s - (i ? 0.08 : 0), yb, z0 - 0.08, e + (f ? 0.08 : 0), yb + 0.12, z0 + 0.33, trim, false); });
      tramo('z1', x0, x1, (s, e, i, f) => { this.box(s, ya, z1 - 0.25, e, yb, z1, p); if (trim) this.box(s - (i ? 0.08 : 0), yb, z1 - 0.33, e + (f ? 0.08 : 0), yb + 0.12, z1 + 0.08, trim, false); });
      tramo('x0', z0 + 0.25, z1 - 0.25, (s, e, i, f) => { this.box(x0, ya, s, x0 + 0.25, yb, e, p); if (trim) this.box(x0 - 0.08, yb, s + (i ? 0.08 : 0), x0 + 0.33, yb + 0.12, e - (f ? 0.08 : 0), trim, false); });
      tramo('x1', z0 + 0.25, z1 - 0.25, (s, e, i, f) => { this.box(x1 - 0.25, ya, s, x1, yb, e, p); if (trim) this.box(x1 - 0.33, yb, s + (i ? 0.08 : 0), x1 + 0.08, yb + 0.12, e - (f ? 0.08 : 0), trim, false); });
    }
    return this;
  }

  // Baranda (visual + sólido bajo que no se puede pasar caminando pero sí saltando). Se rompe entera.
  rail(x0, z0, x1, z1, y, m = 'madera_osc', h = 1.0) {
    return this.grupo(() => {
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 1.2));
      for (let k = 0; k <= n; k++) {
        const x = x0 + (x1 - x0) * (k / n), z = z0 + (z1 - z0) * (k / n);
        this.cbox(x, y - 0.02, z, 0.09, h - 0.08, 0.09, m, false); // apenas hundido en el piso y más fino que 10 cm: no queda al ras de los bordes
      }
      const t = 0.08;
      this.box(Math.min(x0, x1) - t, y + h - 0.1, Math.min(z0, z1) - t, Math.max(x0, x1) + t, y + h, Math.max(z0, z1) + t, m, false);
      this.box(Math.min(x0, x1) - t / 2, y + h * 0.45, Math.min(z0, z1) - t / 2, Math.max(x0, x1) + t / 2, y + h * 0.45 + 0.07, Math.max(z0, z1) + t / 2, m, false);
      this.solid({ x0: Math.min(x0, x1) - 0.06, x1: Math.max(x0, x1) + 0.06, z0: Math.min(z0, z1) - 0.06, z1: Math.max(z0, z1) + 0.06, y0: y, y1: y + h });
    });
  }

  // Cimiento que baja hasta debajo del terreno para que nunca se vea el hueco. No se rompe.
  // Es un anillo alrededor de la losa del piso (así no comparte cara con ella) y un bloque macizo debajo.
  // macizo: sin losa encima, el bloque llega hasta arriba y hace de piso.
  footing(x0, z0, x1, z1, m = 'piedra2', depth = 2.5, top = 0.05, { macizo = false, borde = 0.2 } = {}) {
    return this.grupo(() => {
      // sólidos: sobresalen unos centímetros del terreno y se pisan (si no, los pies se hunden en el borde)
      if (macizo) { this.box(x0 - borde, -depth, z0 - borde, x1 + borde, top, z1 + borde, m); return; }
      this.box(x0 - borde, -depth, z0 - borde, x1 + borde, top, z0, m);
      this.box(x0 - borde, -depth, z1, x1 + borde, top, z1 + borde, m);
      this.box(x0 - borde, -depth, z0, x0, top, z1, m);
      this.box(x1, -depth, z0, x1 + borde, top, z1, m);
      this.box(x0, -depth, z0, x1, top - 0.45, z1, m, false);
    }, { fija: true });
  }

  // Huella (para aplanar el terreno debajo).
  bounds() {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const s of this.solids) { x0 = Math.min(x0, s.x0); z0 = Math.min(z0, s.z0); x1 = Math.max(x1, s.x1); z1 = Math.max(z1, s.z1); }
    for (const c of this.cyls) { x0 = Math.min(x0, c.x - c.r); z0 = Math.min(z0, c.z - c.r); x1 = Math.max(x1, c.x + c.r); z1 = Math.max(z1, c.z + c.r); }
    if (x0 === Infinity) return { x0: -1, z0: -1, x1: 1, z1: 1 };
    return { x0, z0, x1, z1 };
  }
}

// ---------- Muebles ----------
// Cada mueble es una pieza que se rompe entera.
function mesa(P, x, y, z, w = 1.6, d = 0.9, m = 'madera2') {
  P.grupo(() => {
    P.cbox(x, y + 0.72, z, w, 0.08, d, m, false);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.cbox(x + a * (w / 2 - 0.08), y, z + b * (d / 2 - 0.08), 0.08, 0.72, 0.08, 'madera_osc', false);
    P.solid({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y0: y, y1: y + 0.8 });
  });
}
function silla(P, x, y, z, m = 'madera') {
  P.grupo(() => {
    P.cbox(x, y + 0.45, z, 0.45, 0.06, 0.45, m, false);
    P.cbox(x, y + 0.51, z - 0.2, 0.45, 0.44, 0.06, m, false);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.cbox(x + a * 0.19, y, z + b * 0.19, 0.05, 0.45, 0.05, 'madera_osc', false);
    P.solid({ x0: x - 0.23, x1: x + 0.23, z0: z - 0.23, z1: z + 0.23, y0: y, y1: y + 0.95 });
  });
}
function cama(P, x, y, z, rotX = false, m = 'tela') {
  const [w, d] = rotX ? [2.0, 1.3] : [1.3, 2.0];
  P.grupo(() => {
    P.cbox(x, y, z, w, 0.3, d, 'madera_osc');
    P.cbox(x, y + 0.3, z, w - 0.1, 0.18, d - 0.1, m);
    P.cbox(x + (rotX ? -w / 2 + 0.35 : 0), y + 0.48, z + (rotX ? 0 : -d / 2 + 0.3), rotX ? 0.4 : w - 0.3, 0.12, rotX ? d - 0.3 : 0.4, 'blanco_puro');
  });
}
function sillon(P, x, y, z, alongX = true, m = 'tela2') {
  const [w, d] = alongX ? [2.0, 0.9] : [0.9, 2.0];
  P.grupo(() => {
    P.cbox(x, y, z, w, 0.45, d, m);
    if (alongX) P.cbox(x, y + 0.45, z - d / 2 + 0.15, w, 0.45, 0.3, m);
    else P.cbox(x - w / 2 + 0.15, y + 0.45, z, 0.3, 0.45, d, m);
  });
}
function estante(P, x, y, z, alongX = true, m = 'madera') {
  const [w, d] = alongX ? [1.8, 0.45] : [0.45, 1.8];
  P.grupo(() => {
    P.cbox(x, y, z, w, 2.0, d, m);
    for (const yy of [0.5, 1.0, 1.5]) P.cbox(x, y + yy, z, w + 0.04, 0.05, d + 0.04, 'madera_osc', false);
  });
}
function heladera(P, x, y, z) { P.grupo(() => { P.cbox(x, y, z, 0.8, 1.9, 0.7, 'blanco_puro'); P.cbox(x + 0.25, y + 1.0, z + 0.37, 0.05, 0.5, 0.05, 'metal', false); }); }
function mesada(P, x0, z0, x1, z1, y) { P.grupo(() => { P.box(x0, y, z0, x1, y + 0.9, z1, 'blanco'); P.box(x0 - 0.03, y + 0.9, z0 - 0.03, x1 + 0.03, y + 0.95, z1 + 0.03, 'piedra2'); }); }
export function caja(P, x, y, z, s = 1.1, m = 'madera2') {
  P.grupo(() => {
    P.cbox(x, y, z, s, s, s, m);
    P.cbox(x, y + 0.08, z, s + 0.04, 0.12, s + 0.04, 'madera_osc', false);
    P.cbox(x, y + s - 0.2, z, s + 0.04, 0.12, s + 0.04, 'madera_osc', false);
  });
}
export function barril(P, x, y, z, m = 'oxido') {
  P.grupo(() => {
    P.cyl(x, y, z, 0.42, 1.15, m, { solid: true, seg: 10 });
    P.cyl(x, y + 0.25, z, 0.44, 0.08, 'metal_osc', { seg: 10 });
    P.cyl(x, y + 0.85, z, 0.44, 0.08, 'metal_osc', { seg: 10 });
  });
}

// ---------- Estructuras ----------
// Todas reciben un objeto de opciones y devuelven un Plano. El frente (puerta principal) mira a +Z.

// Casa de uno o dos pisos con techo a dos aguas.
export function casa({ w = 9, d = 8, pisos = 1, pared = 'blanco', techo = 'techo_rojo', marco = 'marco', piso = 'piso', cofre = true, porche = false, chimenea = true, base = 'piedra2', rise = 2.6, var: v = 0, balcon = false } = {}) {
  const P = new Plano();
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
  P.footing(x0, z0, x1, z1, base);
  P.slab(x0, z0, x1, z1, 0.05, piso, [], 0.35);
  const H = STOREY;
  const win = (c, y = 1.0) => ({ c, w: 1.3, y, h: 1.4, kind: 'ventana' });
  const doorC = w * (v % 2 ? 0.3 : 0.5);
  // escalera interna (si hay 2 pisos) contra la pared de atrás
  const stW = 1.3, stL = 4.6;
  const stX1 = x1 - T / 2, stX0 = stX1 - stW, stZ0 = z0 + T / 2 + 0.05, stZ1 = stZ0 + stL;
  for (let p = 0; p < pisos; p++) {
    const y = p * H + 0.05;
    const top = p === 0;
    const front = top ? [{ c: doorC, w: 1.6, y: 0, h: 2.6, kind: 'puerta' }, win(doorC < w / 2 ? w * 0.75 : w * 0.2)] : balcon ? [win(w * 0.2), { c: w * 0.5, w: 1.5, y: 0, h: 2.5, kind: 'puerta' }, win(w * 0.8)] : [win(w * 0.3), win(w * 0.72)];
    if (top && doorC >= w / 2) front.push(win(w * 0.82));
    P.wall(x0, z1, x1, z1, y, H, pared, front, { frame: marco, glass: true, ext: T / 2 });
    P.wall(x0, z0, x1, z0, y, H, pared, top ? [{ c: w * 0.3, w: 1.4, y: 0, h: 2.5, kind: 'puerta' }, win(w * 0.75)] : [win(w * 0.5)], { frame: marco, glass: true, ext: T / 2 });
    P.wall(x0, z0 + T / 2, x0, z1 - T / 2, y, H, pared, [win(d * 0.5)], { frame: marco, glass: true });
    P.wall(x1, z0 + T / 2, x1, z1 - T / 2, y, H, pared, d > 7.5 ? [win(d * 0.72)] : [], { frame: marco, glass: true });
    // zócalo (solo abajo, por afuera, sin tapar las puertas), esquineros y moldura entre pisos
    if (top) P.anillo(x0, z0, x1, z1, y, y + 0.35, base, { fija: true });
    for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) P.cbox(cx, y + (top ? 0.35 : 0.05), cz, 0.42, H - (top ? 0.35 : 0.05) - 0.2, 0.42, marco, false);
    if (p > 0) P.anillo(x0, z0, x1, z1, y - 0.2, y + 0.05, marco, { out: 0.1 });
    if (p < pisos - 1) {
      P.slab(x0 + T / 2, z0 + T / 2, x1 - T / 2, z1 - T / 2, y + H, piso, [{ x0: stX0 - 0.05, z0: stZ0 - 0.05, x1: stX1 + 0.05, z1: stZ1 + 0.3 }]);
      P.stairs(stX0, stZ0, stX1, stZ1, y, y + H, '-z', 'madera', { rail: 'madera_osc', lados: [1.3, 'pared'] }); // arriba se sale hacia -x
      // baranda alrededor del hueco arriba
      P.rail(stX0 - 0.05, stZ1 + 0.3, stX0 - 0.05, stZ0 + 1.3, y + H, 'madera_osc');
    }
  }
  const top = pisos * H + 0.05 - T;
  P.gable(x0, z0, x1, z1, top, rise, techo, { axis: w >= d ? 'x' : 'z', wallM: pared });
  if (chimenea) {
    const cx = x0 + w * 0.25, cz = (z0 + z1) / 2 - d * 0.15;
    P.grupo(() => {
      P.cbox(cx, top + T, cz, 0.9, rise + 1.2 - T, 0.9, 'ladrillo');
      P.cbox(cx, top + rise + 1.2, cz, 1.05, 0.2, 1.05, 'piedra2');
    });
  }
  if (porche) {
    P.box(x0 + 0.5, -0.4, z1 + T / 2, x1 - 0.5, 0.25, z1 + 2.2, 'madera');
    P.grupo(() => {
      for (const x of [x0 + 0.7, x1 - 0.7]) P.cbox(x, 0.25, z1 + 2.0, 0.2, 2.6, 0.2, 'marco');
      P.slope(x0 + 0.3, z1 + T / 2, x1 - 0.3, z1 + 2.4, 2.85, 3.3, '-z', 0.15, techo);
    });
  }
  // muebles
  const fy = 0.05;
  P.box(x0 + 1.0, fy, z1 - 3.6, x0 + 3.4, fy + 0.02, z1 - 1.0, v % 2 ? 'alfombra' : 'tela', false);
  mesa(P, x0 + 2.2, fy, z1 - 2.4);
  silla(P, x0 + 1.6, fy, z1 - 1.6); silla(P, x0 + 2.8, fy, z1 - 1.6);
  sillon(P, x0 + w * 0.3 + 1.8, fy, z0 + 1.0, true); // al costado de la puerta de atrás, fuera del giro de la hoja
  if (pisos > 1) {
    cama(P, x0 + 1.2, H + fy, z1 - 1.6, false);
    estante(P, x0 + 0.5, H + fy, z0 + 1.6, false);
    P.addLoot(x0 + 2.6, H + fy, 0);
  } else {
    estante(P, x1 - 0.5, fy, z1 - 1.6, false);
  }
  P.addLoot(x0 + w * 0.6, fy, 0.3);
  if (cofre) P.addChest(x1 - 1.0, pisos > 1 ? H + fy : fy, pisos > 1 ? z1 - 1.0 : z0 + 1.0, pisos > 1 ? 2 : 0);
  P.addLight(0, 2.5, z1 + 0.5);
  return P;
}

// Galpón grande con entrepiso y portones (puerto, cantera, granja).
export function galpon({ w = 18, d = 12, h = 7, pared = 'chapa_azul', techo = 'chapa', piso = 'hormigon', cofre = true, carteles = 'amarillo_seg' } = {}) {
  const P = new Plano();
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
  P.footing(x0, z0, x1, z1, 'hormigon2');
  P.slab(x0, z0, x1, z1, 0.05, piso, [], 0.35);
  const y = 0.05;
  P.wall(x0, z1, x1, z1, y, h, pared, [{ c: w * 0.5, w: 5, y: 0, h: 4.4, kind: 'puerta' }, { c: w * 0.15, w: 1.4, y: 0, h: 2.6, kind: 'puerta' }], { frame: carteles, ext: T / 2 });
  P.wall(x0, z0, x1, z0, y, h, pared, [{ c: w * 0.5, w: 5, y: 0, h: 4.4, kind: 'puerta' }, { c: w * 0.2, w: 2.0, y: 4.6, h: 1.2, kind: 'ventana' }, { c: w * 0.8, w: 2.0, y: 4.6, h: 1.2, kind: 'ventana' }], { frame: carteles, ext: T / 2 });
  P.wall(x0, z0 + T / 2, x0, z1 - T / 2, y, h, pared, [{ c: d * 0.5, w: 2.4, y: 4.6, h: 1.2, kind: 'ventana' }], { frame: carteles });
  P.wall(x1, z0 + T / 2, x1, z1 - T / 2, y, h, pared, [{ c: d * 0.5, w: 1.4, y: 0, h: 2.6, kind: 'puerta' }], { frame: carteles });
  // columnas exteriores
  for (const x of [x0, x1]) for (const z of [z0, z1]) P.cbox(x, y, z, 0.5, h + 0.2, 0.5, 'metal_osc');
  // entrepiso a lo largo de la pared izquierda con escalera
  const mz0 = z0 + T / 2, mz1 = z1 - T / 2, mx0 = x0 + T / 2, mx1 = x0 + 4.2, my = y + 3.6;
  P.box(mx0, my - 0.25, mz0, mx1, my, mz1, 'metal_osc');
  for (const z of [mz0 + 1, mz1 - 1]) P.cbox(mx1 - 0.15, y, z, 0.25, my - 0.25 - y, 0.25, 'amarillo_seg');
  // escalera con descanso arriba (el descanso empalma con el entrepiso, lejos de la pared del fondo)
  const sl = mz0 + 1.7;
  P.rail(mx1, sl + 0.1, mx1, mz1, my, 'amarillo_seg');
  P.box(mx1 - 0.1, my - 0.25, mz0, mx1 + 1.45, my, sl, 'metal_osc');
  P.rail(mx1 + 1.45, mz0, mx1 + 1.45, sl, my, 'amarillo_seg');
  P.cbox(mx1 + 1.3, y, sl - 0.15, 0.2, my - 0.25 - y, 0.2, 'amarillo_seg');
  P.stairs(mx1 + 0.05, sl, mx1 + 1.45, sl + 3.8, y, my, '-z', 'metal', { rail: 'amarillo_seg' });
  // techo curvo aproximado: dos aguas bajas
  P.gable(x0, z0, x1, z1, y + h - T, 1.6, techo, { axis: 'x', over: 0.5, wallM: pared, solidCeil: true, ceil: 'metal_osc' });
  // estanterías y cajas
  for (let k = 0; k < 3; k++) estante(P, x1 - 1.0, y, z0 + 2 + k * 2.6, false, 'metal');
  caja(P, x0 + 7, y, z0 + 2, 1.2); caja(P, x0 + 7, y + 1.2, z0 + 2, 1.0, 'madera');
  caja(P, x0 + 7.4, y, z0 + 2.2, 1.2); barril(P, x1 - 3.5, y, z1 - 1.5); barril(P, x1 - 4.5, y, z1 - 1.2, 'azul');
  P.addLoot(0, y, 0); P.addLoot(x1 - 3, y, 0); P.addLoot(mx0 + 1.8, my, 0);
  if (cofre) P.addChest(mx0 + 1.0, my, mz1 - 1.5, 3);
  P.addLight(0, h - 0.5, z1 + 0.6);
  return P;
}

// Edificio de ciudad: varios pisos, local con toldo en planta baja, escalera hasta la terraza.
export function edificio({ w = 12, d = 12, pisos = 3, pared = 'ladrillo', marco = 'marco', toldo = 'lona_roja', piso = 'baldosa', cofre = true, letrero = 'amarillo', vidriera = true } = {}) {
  const P = new Plano();
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
  const H = STOREY;
  P.footing(x0, z0, x1, z1, 'hormigon2');
  P.slab(x0, z0, x1, z1, 0.05, piso, [], 0.35);
  // escalera en U contra la pared derecha-atrás: tramo que sube hacia -z, descanso y tramo que vuelve
  const sw = 1.4, sx1 = x1 - T / 2, sx0 = sx1 - sw * 2 - 0.1, sz0 = z0 + T / 2;
  const land = 1.4, run = 3.4;
  for (let p = 0; p < pisos; p++) {
    const y = p * H + 0.05;
    const ground = p === 0;
    const wins = (L, n, yy = 1.0) => Array.from({ length: n }, (_, k) => ({ c: (L / n) * (k + 0.5), w: 1.4, y: yy, h: 1.6, kind: 'ventana' }));
    let front;
    if (ground) front = vidriera ? [{ c: w * 0.5, w: 1.8, y: 0, h: 2.7, kind: 'puerta' }, { c: w * 0.2, w: 2.8, y: 0.6, h: 2.2, kind: 'ventana' }, { c: w * 0.8, w: 2.8, y: 0.6, h: 2.2, kind: 'ventana' }] : [{ c: w * 0.5, w: 1.8, y: 0, h: 2.7, kind: 'puerta' }];
    else front = wins(w, Math.max(2, Math.round(w / 3.5)));
    P.wall(x0, z1, x1, z1, y, H, pared, front, { frame: marco, glass: true, ext: T / 2 });
    P.wall(x0, z0, x1, z0, y, H, pared, ground ? [{ c: w * 0.3, w: 1.4, y: 0, h: 2.6, kind: 'puerta' }] : wins(w, 2), { frame: marco, glass: true, ext: T / 2 });
    P.wall(x0, z0 + T / 2, x0, z1 - T / 2, y, H, pared, wins(d, Math.max(1, Math.round(d / 5))), { frame: marco, glass: true });
    P.wall(x1, z0 + T / 2, x1, z1 - T / 2, y, H, pared, ground ? [] : [{ c: d * 0.75, w: 1.4, y: 1.0, h: 1.6, kind: 'ventana' }], { frame: marco, glass: true });
    P.anillo(x0, z0, x1, z1, y + H - 0.35, y + H - 0.05, marco, { out: 0.1 }); // moldura por afuera
    // escalera: tramo 1 (x de sx0+sw.. sx1) sube hacia -z hasta la mitad, descanso atrás, tramo 2 vuelve hacia +z
    const yl = y + H / 2;
    const tx0 = sx1 - sw, tz0 = sz0 + land, tz1 = tz0 + run;
    P.stairs(tx0, tz0, sx1, tz1, y, yl, '-z', 'baldosa2');
    P.box(sx0, yl - 0.3, sz0, sx1, yl, sz0 + land, 'hormigon'); // descanso
    P.stairs(sx0, tz0, sx0 + sw, tz1, yl, y + H, '+z', 'baldosa2');
    P.box(sx0 + sw, y, tz0, sx0 + sw + 0.1, yl + 1.0, tz1, 'hormigon'); // muro entre tramos
    const hole = { x0: sx0 - 0.05, z0: sz0, x1: sx1, z1: tz1 + 0.05 };
    const last = p === pisos - 1;
    if (!last) P.slab(x0 + T / 2, z0 + T / 2, x1 - T / 2, z1 - T / 2, y + H, piso, [hole]);
    // muebles por piso
    if (ground) {
      mesada(P, x0 + 0.5, z0 + 1.0, x0 + 4.5, z0 + 1.8, y);
      estante(P, x0 + 0.5, y, z1 - 3, false, 'madera');
      P.addLoot(0, y, 0);
    } else {
      mesa(P, x0 + 2.5, y, 0); silla(P, x0 + 2.0, y, 0.8); silla(P, x0 + 3.0, y, 0.8);
      if (p % 2) cama(P, x0 + 1.0, y, z0 + 1.6, false); else sillon(P, x0 + 2.4, y, z0 + 0.9, true);
      P.addLoot(x0 + w * 0.35, y, z1 - 2.5);
      if (cofre && p === pisos - 1) P.addChest(x0 + 1.0, y, z1 - 1.2, 1);
    }
  }
  const top = pisos * H + 0.05 - T;
  // terraza con salida de escalera (casilla)
  const cy = top + T;
  const cx0 = sx0 - 0.35, cx1 = x1, cz1 = sz0 + land + run + 0.2;
  // la casilla de la escalera tiene sus cuatro paredes (las del fondo y el costado siguen la fachada)
  P.flatRoof(x0, z0, x1, z1, top, 'hormigon2', { parapet: 1.0, pm: pared, holes: [{ x0: sx0 - 0.05, z0: sz0, x1: sx1, z1: sz0 + land + run + 0.05 }], abierto: [{ lado: 'z0', a: cx0 - T / 2, b: x1 + 1 }, { lado: 'x1', a: z0 - 1, b: cz1 + T / 2 }] });
  P.wall(cx0, z0 + T / 2, cx0, cz1 - T / 2, cy, 2.8, 'hormigon');
  P.wall(cx0, cz1, cx1, cz1, cy, 2.8, 'hormigon', [{ c: (cx1 - cx0) * 0.25, w: 1.4, y: 0, h: 2.4, kind: 'puerta' }], { ext: T / 2 });
  P.wall(cx0, z0, cx1, z0, cy, 2.8, pared, [], { ext: T / 2 });
  P.wall(cx1, z0 + T / 2, cx1, cz1 - T / 2, cy, 2.8, pared);
  P.box(cx0 - T / 2 - 0.2, cy + 2.8, z0 - T / 2 - 0.2, cx1 + T / 2 + 0.2, cy + 3.1, cz1 + T / 2 + 0.2, 'hormigon2');
  // tanque de agua y equipos en la terraza
  P.cyl(x0 + 2.2, cy, z0 + 2.2, 1.0, 1.8, 'blanco', { solid: true });
  P.cbox(x0 + 2.2, cy + 1.8, z0 + 2.2, 0.6, 0.2, 0.6, 'metal', false);
  P.cbox(x0 + 4.4, cy, z1 - 2, 1.6, 1.0, 1.2, 'metal');
  P.addLoot(x0 + 3.5, cy, 0);
  // toldo y cartel del local
  if (toldo) P.grupo(() => {
    P.slope(x0 + w * 0.08, z1, x1 - w * 0.08, z1 + 1.8, 3.0, 3.5, '-z', 0.08, toldo);
    for (let k = 0; k < 8; k++) P.cbox(x0 + w * 0.08 + ((k + 0.5) * (w * 0.84)) / 8, 2.75, z1 + 1.82, (w * 0.84) / 16, 0.28, 0.06, k % 2 ? toldo : 'lona_blanca', false);
  });
  if (letrero) P.cbox(0, 3.55, z1 + 0.2, w * 0.5, 0.6, 0.15, letrero, false);
  P.addLight(-w * 0.3, 3.2, z1 + 0.4);
  return P;
}

// Local chico de una planta con toldo (mercado, estación de servicio, almacén).
export function local({ w = 8, d = 7, pared = 'crema', toldo = 'lona_verde', techo = 'hormigon2', cofre = false, letrero = 'rojo' } = {}) {
  const P = new Plano();
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2, y = 0.05, H = 3.8;
  P.footing(x0, z0, x1, z1, 'hormigon2');
  P.slab(x0, z0, x1, z1, y, 'baldosa', [], 0.35);
  P.wall(x0, z1, x1, z1, y, H, pared, [{ c: w * 0.5, w: 1.8, y: 0, h: 2.6, kind: 'puerta' }, { c: w * 0.18, w: 2.0, y: 0.7, h: 1.9, kind: 'ventana' }, { c: w * 0.82, w: 2.0, y: 0.7, h: 1.9, kind: 'ventana' }], { glass: true, ext: T / 2 });
  P.wall(x0, z0, x1, z0, y, H, pared, [{ c: w * 0.75, w: 1.3, y: 0, h: 2.5, kind: 'puerta' }], { ext: T / 2 });
  P.wall(x0, z0 + T / 2, x0, z1 - T / 2, y, H, pared, [{ c: d * 0.5, w: 1.4, y: 1.0, h: 1.4, kind: 'ventana' }], { glass: true });
  P.wall(x1, z0 + T / 2, x1, z1 - T / 2, y, H, pared);
  P.anillo(x0, z0, x1, z1, y, y + 0.4, 'piedra2', { fija: true });
  P.flatRoof(x0, z0, x1, z1, y + H - T, techo, { parapet: 0.6, pm: pared });
  if (toldo) P.grupo(() => {
    P.slope(x0 + 0.3, z1, x1 - 0.3, z1 + 1.6, 2.7, 3.2, '-z', 0.08, toldo);
    for (let k = 0; k < 6; k++) P.cbox(x0 + 0.3 + ((k + 0.5) * (w - 0.6)) / 6, 2.45, z1 + 1.62, (w - 0.6) / 12, 0.28, 0.06, k % 2 ? toldo : 'lona_blanca', false);
  });
  if (letrero) P.cbox(0, y + H + 0.3, z1 - 0.1, w * 0.6, 0.8, 0.15, letrero, false);
  mesada(P, x0 + 1.0, z0 + 1.0, x1 - 2.4, z0 + 1.7, y);
  estante(P, x0 + 0.5, y, 0.5, false); estante(P, x1 - 0.5, y, 0.5, false);
  P.addLoot(0, y, 0.3);
  if (cofre) P.addChest(x1 - 1.0, y, z0 + 1.0, 0);
  P.addLight(0, 3.0, z1 + 0.5);
  return P;
}

// Garaje / cobertizo de una planta con portón.
export function cobertizo({ w = 6, d = 6, pared = 'madera2', techo = 'chapa', cofre = false, loot = true, abierto = false } = {}) {
  const P = new Plano();
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2, y = 0.05, H = 3.0;
  P.footing(x0, z0, x1, z1, 'piedra2', 1.5);
  P.slab(x0, z0, x1, z1, y, 'hormigon', [], 0.3);
  P.wall(x0, z1, x1, z1, y, H, pared, [{ c: w / 2, w: abierto ? w - 1.2 : 2.6, y: 0, h: 2.5, kind: 'puerta' }], { frame: 'madera_osc', ext: T / 2 });
  P.wall(x0, z0, x1, z0, y, H, pared, [{ c: w / 2, w: 1.2, y: 1.3, h: 0.9, kind: 'ventana' }], { frame: 'madera_osc', ext: T / 2 });
  P.wall(x0, z0 + T / 2, x0, z1 - T / 2, y, H, pared);
  P.wall(x1, z0 + T / 2, x1, z1 - T / 2, y, H, pared);
  P.gable(x0, z0, x1, z1, y + H - T, 1.3, techo, { axis: 'z', over: 0.4, wallM: pared });
  estante(P, x0 + 0.5, y, 0, false, 'madera');
  if (loot) P.addLoot(0.5, y, -0.5);
  if (cofre) P.addChest(x1 - 0.9, y, z0 + 0.9, 0);
  return P;
}

// Granero rojo con altillo de heno.
export function granero({ w = 14, d = 11, cofre = true } = {}) {
  const P = new Plano();
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2, y = 0.05, H = 5.2;
  P.footing(x0, z0, x1, z1, 'piedra2');
  P.slab(x0, z0, x1, z1, y, 'tierra', [], 0.35);
  const red = 'ladrillo', trim = 'blanco';
  P.wall(x0, z1, x1, z1, y, H, red, [{ c: w / 2, w: 4.2, y: 0, h: 4.2, kind: 'puerta' }, { c: w * 0.5, w: 1.8, y: 4.4, h: 0.6, kind: 'ventana' }], { frame: trim, ext: T / 2 });
  P.wall(x0, z0, x1, z0, y, H, red, [{ c: w / 2, w: 4.2, y: 0, h: 4.2, kind: 'puerta' }], { frame: trim, ext: T / 2 });
  P.wall(x0, z0 + T / 2, x0, z1 - T / 2, y, H, red, [{ c: d * 0.3, w: 1.2, y: 1.3, h: 1.2, kind: 'ventana' }, { c: d * 0.7, w: 1.2, y: 1.3, h: 1.2, kind: 'ventana' }], { frame: trim });
  P.wall(x1, z0 + T / 2, x1, z1 - T / 2, y, H, red, [{ c: d * 0.5, w: 1.4, y: 0, h: 2.5, kind: 'puerta' }], { frame: trim });
  // cruces blancas en los portones
  for (const zz of [z1 + 0.18, z0 - 0.18]) {
    P.cbox(0, y + 4.2, zz, 4.5, 0.2, 0.08, trim, false);
    P.cbox(-2.2, y, zz, 0.2, 4.3, 0.08, trim, false);
    P.cbox(2.2, y, zz, 0.2, 4.3, 0.08, trim, false);
  }
  // altillo (heno) en la mitad izquierda, con escalera
  // (altillo a 2.95 m: queda 1.95 m libre hasta el cielorraso, se camina parado)
  const ly = y + 2.95, lx1 = x0 + 5.5, st = z1 - 0.4 - 3.4;
  P.box(x0 + T / 2, ly - 0.25, z0 + T / 2, lx1, ly, z1 - T / 2, 'madera');
  for (const z of [z0 + 2, z1 - 2]) P.cbox(lx1 - 0.15, y, z, 0.25, ly - 0.25 - y, 0.25, 'madera_osc');
  // descanso arriba de la escalera, pegado al altillo
  P.box(lx1 - 0.1, ly - 0.25, st - 1.4, lx1 + 1.35, ly, st, 'madera');
  P.cbox(lx1 + 1.2, y, st - 1.25, 0.2, ly - 0.25 - y, 0.2, 'madera_osc');
  P.rail(lx1, z0 + 0.4, lx1, st - 1.5, ly, 'madera_osc');
  P.rail(lx1, st + 0.1, lx1, z1 - 0.4, ly, 'madera_osc');
  P.rail(lx1 + 1.35, st - 1.4, lx1 + 1.35, st, ly, 'madera_osc'); P.rail(lx1 + 0.1, st - 1.4, lx1 + 1.35, st - 1.4, ly, 'madera_osc');
  P.stairs(lx1 + 0.05, st, lx1 + 1.35, z1 - 0.4, y, ly, '-z', 'madera', { rail: 'madera_osc', lados: [0, [1.2, 0]] }); // abajo se entra de costado (desde +x)
  // pacas de heno
  for (const [x, z, yy] of [[x0 + 1.4, z0 + 1.3, ly], [x0 + 2.8, z0 + 1.3, ly], [x0 + 1.4, z0 + 1.3, ly + 0.9], [x1 - 1.6, z1 - 1.4, y], [x1 - 1.6, z1 - 2.7, y], [x1 - 3.0, z1 - 1.4, y]]) P.cbox(x, yy, z, 1.3, 0.9, 1.2, 'heno');
  // techo a la holandesa (dos quiebres)
  const ty = y + H - T;
  P.slab(x0 + T / 2, z0 + T / 2, x1 - T / 2, z1 - T / 2, ty + T, 'madera_osc');
  const zm = 0, q = d * 0.28;
  const roof = 'techo_gris';
  // cada mitad del techo (con sus dos quiebres) se rompe entera
  P.grupo(() => {
    P.ramp(x0, ty + T, z0, x1, ty + 2.4, z0 + q, '+z', null, true, ty + T);
    P.ramp(x0, ty + 2.4 - 0.01, z0 + q, x1, ty + 3.5, zm, '+z', null, true, ty + 2.4);
    P.box(x0, ty + T, z0 + q, x1, ty + 2.4, zm, null);
    P.slope(x0 - 0.4, z0 - 0.5, x1 + 0.4, z0 + q, ty + T - 0.3, ty + 2.4 + 0.2, '+z', 0.2, roof);
    P.slope(x0 - 0.4, z0 + q - 0.05, x1 + 0.4, zm, ty + 2.4 + 0.2, ty + 3.5 + 0.2, '+z', 0.2, roof);
    for (const x of [x0, x1]) {
      P.box(x - T / 2, ty + T, z0 - T / 2, x + T / 2, ty + 2.4, zm, red, false);
      P.tri(x - T / 2, ty + 2.4, z0 + q, x + T / 2, ty + 3.5, zm + (zm - z0 - q), 'z', red);
    }
  });
  P.grupo(() => {
    P.ramp(x0, ty + T, z1 - q, x1, ty + 2.4, z1, '-z', null, true, ty + T);
    P.ramp(x0, ty + 2.4 - 0.01, zm, x1, ty + 3.5, z1 - q, '-z', null, true, ty + 2.4);
    P.box(x0, ty + T, zm, x1, ty + 2.4, z1 - q, null);
    P.slope(x0 - 0.4, z1 - q, x1 + 0.4, z1 + 0.5, ty + T - 0.3, ty + 2.4 + 0.2, '-z', 0.2, roof);
    P.slope(x0 - 0.4, zm, x1 + 0.4, z1 - q + 0.05, ty + 2.4 + 0.2, ty + 3.5 + 0.2, '-z', 0.2, roof);
    for (const x of [x0, x1]) {
      P.box(x - T / 2, ty + T, zm, x + T / 2, ty + 2.4, z1 + T / 2, red, false);
      P.tri(x - T / 2, ty + 2.4, zm - (z1 - q - zm), x + T / 2, ty + 3.5, z1 - q, 'z', red);
    }
  });
  P.addLoot(0, y, 0); P.addLoot(x0 + 3.5, ly, 0);
  if (cofre) P.addChest(x0 + 1.2, ly, z1 - 1.0, 1);
  return P;
}

// Silo cilíndrico con escalera exterior hasta la tapa.
export function silo({ r = 3, h = 12, m = 'chapa', techo = 'chapa_roja' } = {}) {
  const P = new Plano();
  P.cyl(0, -1, 0, r + 0.3, 1.1, 'hormigon', { solid: true, seg: 16 });
  P.grupo(() => {
    P.cyl(0, 0.1, 0, r, h, m, { solid: true, seg: 16 });
    for (let k = 1; k < 5; k++) P.cyl(0, (h * k) / 5, 0, r + 0.06, 0.12, 'metal_osc', { seg: 16 });
  });
  P.grupo(() => {
    P.cyl(0, h + 0.1, 0, r + 0.2, 1.8, techo, { r2: 0.4, seg: 16 });
    P.solidCyl({ x: 0, z: 0, r: r * 0.8, y0: h + 0.1, y1: h + 0.9 });
  });
  // escalera de caracol simplificada: escalones salientes alrededor (rampas cortas)
  const steps = 12;
  for (let k = 0; k < steps; k++) {
    const y0 = 0.1 + (k / steps) * h, y1 = 0.1 + ((k + 1) / steps) * h;
    const side = k % 4;
    const o = r + 0.75;
    if (side === 0) P.stairs(-1.5, o - 0.7, 1.5, o + 0.7, y0, y1, '+x', 'metal_osc');
    if (side === 1) P.stairs(o - 0.7, -1.5, o + 0.7, 1.5, y0, y1, '-z', 'metal_osc');
    if (side === 2) P.stairs(-1.5, -o - 0.7, 1.5, -o + 0.7, y0, y1, '-x', 'metal_osc');
    if (side === 3) P.stairs(-o - 0.7, -1.5, -o + 0.7, 1.5, y0, y1, '+z', 'metal_osc');
  }
  return P;
}

// Molino de viento.
export function molino({ cofre = true } = {}) {
  const P = new Plano();
  P.footing(-2.6, -2.6, 2.6, 2.6, 'piedra2', 2.5, 0.05, { macizo: true });
  P.grupo(() => {
    P.cyl(0, 0, 0, 3.0, 9, 'blanco', { r2: 2.2, seg: 10, solid: true });
    P.cbox(0, 0, 2.96, 1.4, 2.4, 0.5, 'madera_osc');
  });
  P.grupo(() => molinoAspas(P));
  P.addLoot(2.2, 0.05, 3.6);
  if (cofre) P.addChest(-2.0, 0.05, 3.5, 0);
  return P;
}
function molinoAspas(P) {
  P.cyl(0, 9, 0, 2.5, 3.0, 'techo_rojo', { r2: 0.2, seg: 10 });
  P.solidCyl({ x: 0, z: 0, r: 2.0, y0: 9, y1: 9.8 });
  P.tube([0, 9.4, 1.8], [0, 9.4, 3.4], 0.25, 'madera_osc');
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4;
    const ex = Math.cos(a) * 7, ey = Math.sin(a) * 7;
    P.tube([0, 9.4, 3.3], [ex, 9.4 + ey, 3.3], 0.15, 'madera');
    const px = -Math.sin(a), py = Math.cos(a);
    for (let s = 2; s < 7; s += 1.2) {
      const cx = Math.cos(a) * s, cy = 9.4 + Math.sin(a) * s;
      P.tube([cx, cy, 3.35], [cx + px * 1.3, cy + py * 1.3, 3.35], 0.05, 'lona_blanca');
    }
  }
}

// Tanque de agua elevado con escalera.
export function tanqueAgua({ h = 9, m = 'chapa', tanque = 'celeste' } = {}) {
  const P = new Plano();
  for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
    P.cbox(x, -1, z, 0.35, h + 0.7, 0.35, 'metal_osc');
    P.cbox(x, -1, z, 0.7, 1.2, 0.7, 'hormigon');
  }
  for (const y of [h * 0.35, h * 0.7]) {
    P.tube([-2, y, -2], [2, y, -2], 0.06, 'metal_osc'); P.tube([-2, y, 2], [2, y, 2], 0.06, 'metal_osc');
    P.tube([-2, y, -2], [-2, y, 2], 0.06, 'metal_osc'); P.tube([2, y, -2], [2, y, 2], 0.06, 'metal_osc');
  }
  P.box(-3, h - 0.3, -3, 3, h, 3, 'madera_osc');
  P.rail(-3, -3, 3, -3, h, 'metal_osc'); P.rail(-3, 3, 3, 3, h, 'metal_osc'); P.rail(-3, -1.6, -3, 3, h, 'metal_osc'); P.rail(3, -3, 3, 3, h, 'metal_osc');
  P.grupo(() => {
    P.cyl(0, h, 0, 1.85, 3.8, tanque, { solid: true, seg: 14 });
    P.cyl(0, h + 3.8, 0, 1.95, 1.0, m, { r2: 0.3, seg: 14 });
    for (const y of [h + 0.9, h + 2.8]) P.cyl(0, y, 0, 1.91, 0.12, 'metal_osc', { seg: 14 });
  });
  // escalera por fuera: tramo 1 al sur (sube hacia -x), descanso, tramo 2 al oeste (sube hacia -z) y descanso de arriba
  P.stairs(-2.6, 4.6, 3.4, 5.8, 0.05, h / 2, '-x', 'metal', { rail: 'metal_osc' });
  P.box(-4.6, h / 2 - 0.25, 3.4, -2.6, h / 2, 5.8, 'metal');
  P.rail(-4.6, 5.8, -2.6, 5.8, h / 2, 'metal_osc'); P.rail(-4.6, 3.4, -4.6, 5.8, h / 2, 'metal_osc');
  P.stairs(-4.6, -1.6, -3.4, 3.4, h / 2, h, '-z', 'metal', { rail: 'metal_osc' });
  P.box(-4.6, h - 0.3, -3.0, -3.0, h, -1.6, 'madera_osc');
  P.rail(-4.6, -3.0, -4.6, -1.6, h, 'metal_osc'); P.rail(-4.6, -3.0, -3.0, -3.0, h, 'metal_osc');
  for (const [x, z, top] of [[-4.5, 3.5, h / 2 - 0.25], [-4.5, 5.7, h / 2 - 0.25], [-2.7, 5.7, h / 2 - 0.25], [-4.5, -2.9, h - 0.3], [-4.5, -1.7, h - 0.3], [-4.5, 1.0, h * 0.62]]) P.cbox(x, -0.6, z, 0.2, top + 0.6, 0.2, 'metal_osc');
  P.addLoot(2.0, h, -2.0);
  return P;
}

// Faro con escalera interior en zigzag y balcón.
export function faro({ cofre = true } = {}) {
  const P = new Plano();
  const s = 6, x0 = -s / 2, x1 = s / 2, z0 = -s / 2, z1 = s / 2, y = 0.05;
  const H = 4, n = 5;
  P.footing(x0 - 1, z0 - 1, x1 + 1, z1 + 1, 'piedra');
  P.box(x0 - 1, -0.5, z0 - 1, x1 + 1, y, z1 + 1, 'piedra');
  for (let p = 0; p < n; p++) {
    const yy = y + p * H;
    const m = p % 2 ? 'rojo' : 'blanco';
    const hp = p === n - 1 ? H - T : H; // el último piso termina debajo de la losa del balcón
    P.wall(x0, z1, x1, z1, yy, hp, m, p === 0 ? [{ c: s / 2, w: 1.4, y: 0, h: 2.5, kind: 'puerta' }] : [{ c: s / 2, w: 0.8, y: 1.4, h: 1.2, kind: 'ventana' }], { frame: 'marco', ext: T / 2 });
    P.wall(x0, z0, x1, z0, yy, hp, m, [{ c: s / 2, w: 0.8, y: 1.4, h: 1.2, kind: 'ventana' }], { ext: T / 2 });
    P.wall(x0, z0 + T / 2, x0, z1 - T / 2, yy, hp, m);
    P.wall(x1, z0 + T / 2, x1, z1 - T / 2, yy, hp, m);
    // tramo de escalera que sube un piso, alternando lado (este sube hacia el norte, oeste hacia el sur).
    // Los tramos van de -fz a +fz: quedan pasillos de 1.2 m al norte y al sur para pasar de un tramo al otro.
    const fz = 1.65, east = p % 2 === 0;
    const sx0 = east ? x1 - T / 2 - 1.3 : x0 + T / 2, sx1 = sx0 + 1.3;
    P.stairs(sx0, -fz, sx1, fz, yy, yy + H, east ? '-z' : '+z', 'piedra2');
    if (p < n - 1) {
      P.slab(x0 + T / 2, z0 + T / 2, x1 - T / 2, z1 - T / 2, yy + H, 'madera', [{ x0: sx0 - 0.02, z0: -fz, x1: sx1 + 0.02, z1: fz }]);
      // baranda del hueco, libre en el extremo por donde se sale del tramo
      const rx = east ? sx0 - 0.05 : sx1 + 0.05;
      if (east) P.rail(rx, -0.9, rx, fz, yy + H, 'metal_osc'); else P.rail(rx, -fz, rx, 0.9, yy + H, 'metal_osc');
    }
  }
  const top = y + n * H;
  // balcón (con hueco por donde llega la escalera)
  const lastX0 = (n - 1) % 2 ? x0 + T / 2 : x1 - T / 2 - 1.3;
  P.slab(x0 - 1.2, z0 - 1.2, x1 + 1.2, z1 + 1.2, top, 'metal_osc', [{ x0: lastX0 - 0.02, z0: -1.65, x1: lastX0 + 1.32, z1: 1.65 }]);
  P.rail(x0 - 1.2, z0 - 1.2, x1 + 1.2, z0 - 1.2, top, 'rojo'); P.rail(x0 - 1.2, z1 + 1.2, x1 + 1.2, z1 + 1.2, top, 'rojo');
  P.rail(x0 - 1.2, z0 - 1.2, x0 - 1.2, z1 + 1.2, top, 'rojo'); P.rail(x1 + 1.2, z0 - 1.2, x1 + 1.2, z1 + 1.2, top, 'rojo');
  // linterna (se rompe entera); los parantes quedan lejos de la salida de la escalera
  P.grupo(() => {
    for (const [x, z] of [[-1.25, -1.25], [1.25, -1.25], [-1.25, 1.25], [1.25, 1.25]]) P.cbox(x, top, z, 0.2, 2.4, 0.2, 'metal_osc');
    P.cyl(0, top, 0, 1.2, 1.0, 'metal_osc', { seg: 10, solid: true });
    P.cyl(0, top + 1.0, 0, 0.9, 1.3, 'luz', { seg: 10, solid: true });
    P.cyl(0, top + 2.6, 0, 2.3, 1.6, 'rojo', { r2: 0.2, seg: 8 });
    P.box(-2.0, top + 2.4, -2.0, 2.0, top + 2.65, 2.0, 'metal_osc');
  });
  P.addLight(0, top + 1.6, 0);
  P.addLoot(0, top, 2.2);
  if (cofre) P.addChest(x0 + 0.9, y + H, z1 - 0.9, 2);
  return P;
}

// Muelle de madera sobre pilotes. Se extiende hacia +Z desde el origen. `y` es la altura de la cubierta.
export function muelle({ w = 4, L = 30, y = 1.4, fondo = -6, bote = false } = {}) {
  const P = new Plano();
  // cubierta en tramos de ~3 m: cada tramo (tablas, travesaño, pilotes y su pedazo de baranda) se rompe por separado
  const n = Math.max(1, Math.round(L / 3)), r0 = L * 0.4;
  for (let k = 0; k < n; k++) {
    const za = (L * k) / n, zb = (L * (k + 1)) / n;
    P.grupo(() => {
      P.box(-w / 2, y - 0.3, za, w / 2, y, zb, 'madera');
      P.cbox(0, y - 0.05, za + 0.2, w + 0.04, 0.06, 0.12, 'madera_osc', false);
      for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) P.cyl(x, fondo, za + 0.2, 0.18, y - fondo - 0.25, 'madera_osc', { seg: 6, solid: true });
      if (zb > r0) P.rail(-w / 2 + 0.05, Math.max(za, r0), -w / 2 + 0.05, zb, y, 'madera_osc');
      if (k === n - 1) {
        for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) P.cyl(x, fondo, L - 0.25, 0.18, y - fondo - 0.25, 'madera_osc', { seg: 6, solid: true });
        for (const x of [-w / 2 + 0.25, w / 2 - 0.25]) P.cyl(x, y, L - 0.25, 0.18, 0.7, 'madera_osc', { seg: 6, solid: true });
      }
    });
  }
  caja(P, w / 2 - 0.8, y, L * 0.6, 1.0); barril(P, w / 2 - 0.7, y, L * 0.6 + 1.3, 'azul');
  P.addLoot(0, y, L - 2);
  if (bote) {
    const bx = w / 2 + 2.2, bz = L * 0.6;
    boteEn(P, bx, -0.2, bz);
  }
  return P;
}

function boteEn(P, bx, by, bz, m = 'blanco', m2 = 'azul') {
  P.grupo(() => boteCasco(P, bx, by, bz, m, m2));
  P.addLoot(bx, by + 0.9, bz + 1.6);
}
function boteCasco(P, bx, by, bz, m, m2) {
  P.box(bx - 1.3, by - 0.6, bz - 4, bx + 1.3, by + 0.9, bz + 3, m);
  P.ramp(bx - 1.3, by - 0.6, bz + 3, bx + 1.3, by + 0.9, bz + 5, '-z', m);
  P.box(bx - 1.35, by + 0.2, bz - 4.05, bx + 1.35, by + 0.45, bz + 3.05, m2, false);
  P.box(bx - 1.0, by + 0.9, bz - 2.8, bx + 1.0, by + 2.6, bz + 0.2, 'blanco_puro');
  P.box(bx - 1.05, by + 1.6, bz - 2.85, bx + 1.05, by + 2.2, bz + 0.25, 'vidrio', false);
  P.box(bx - 1.2, by + 2.6, bz - 3.0, bx + 1.2, by + 2.8, bz + 0.4, m2);
}

// Bote suelto (para la ciénaga o la costa).
export function bote({ m = 'blanco', m2 = 'rojo' } = {}) { const P = new Plano(); boteEn(P, 0, 0, 0, m, m2); return P; }

// Grúa portuaria.
export function grua() {
  const P = new Plano();
  const legs = [[-4, -3], [4, -3], [-4, 3], [4, 3]];
  for (const [x, z] of legs) { P.cbox(x, -1, z, 0.8, 15, 0.8, 'amarillo_seg'); P.cbox(x, -1, z, 1.4, 1.2, 1.4, 'hormigon'); }
  for (const y of [5, 10]) { P.cbox(0, y, -3, 8.8, 0.6, 0.6, 'amarillo_seg', false); P.cbox(0, y, 3, 8.8, 0.6, 0.6, 'amarillo_seg', false); }
  P.box(-5, 14, -3.6, 5, 15.2, 3.6, 'amarillo_seg');
  // cabina del operador (hueca, con puerta hacia la escalera)
  const cy = 15.2;
  P.wall(-2.5, 2.5, 2.5, 2.5, cy, 2.8, 'blanco', [{ c: 2.5, w: 3.6, y: 1.0, h: 1.2, kind: 'ventana' }], { frame: 'metal_osc', glass: true, ext: T / 2 });
  P.wall(-2.5, -2.5, 2.5, -2.5, cy, 2.8, 'blanco', [{ c: 2.5, w: 3.6, y: 1.0, h: 1.2, kind: 'ventana' }], { frame: 'metal_osc', glass: true, ext: T / 2 });
  P.wall(-2.5, -2.35, -2.5, 2.35, cy, 2.8, 'blanco', [{ c: 2.35, w: 1.4, y: 0, h: 2.3, kind: 'puerta' }], { frame: 'metal_osc' });
  P.wall(2.5, -2.35, 2.5, 2.35, cy, 2.8, 'blanco', [{ c: 2.35, w: 3.0, y: 1.0, h: 1.2, kind: 'ventana' }], { frame: 'metal_osc', glass: true });
  P.box(-2.7, cy + 2.8, -2.7, 2.7, cy + 3.1, 2.7, 'amarillo_seg');
  P.cbox(1.2, cy, 1.2, 1.2, 0.9, 0.8, 'metal_osc'); P.cbox(1.2, cy + 0.9, 1.6, 0.9, 0.5, 0.1, 'negro', false);
  P.rail(-5, -1.8, -5, 3.6, cy, 'amarillo_seg'); P.rail(-5, 3.6, 5, 3.6, cy, 'amarillo_seg'); P.rail(5, -3.6, 5, 3.6, cy, 'amarillo_seg'); P.rail(-5, -3.6, 5, -3.6, cy, 'amarillo_seg');
  // pluma con su tensor, el cable y el gancho (se rompe entera)
  P.grupo(() => {
    P.box(-1, 15.2, 2.65, 1, 15.6, 26, 'amarillo_seg');
    P.tube([0, 18, 0], [0, 15.6, 26], 0.1, 'metal_osc');
    P.tube([0, 15.2, 22], [0, 7, 22], 0.04, 'metal_osc');
    P.cbox(0, 6.4, 22, 1.2, 0.6, 1.2, 'metal_osc', false);
  });
  // torre de escaleras afuera del pórtico: cuatro tramos en zigzag con descansos
  const ax0 = -7.6, am = -6.3, bx1 = -5.0, fz = 1.9, lz = 3.3, sub = cy / 4;
  for (let k = 0; k < 4; k++) {
    const a = k % 2 === 0, ya = k * sub, yb = (k + 1) * sub;
    P.stairs(a ? ax0 : am, -fz, a ? am : bx1, fz, ya + (k ? 0 : 0.05), yb, a ? '+z' : '-z', 'metal_osc', { rail: 'amarillo_seg' });
    const zl0 = a ? fz : -lz, zl1 = a ? lz : -fz;
    if (k < 3) {
      P.box(ax0, yb - 0.2, zl0, bx1, yb, zl1, 'metal');
      P.rail(ax0, a ? lz : -lz, bx1, a ? lz : -lz, yb, 'amarillo_seg'); P.rail(ax0, zl0, ax0, zl1, yb, 'amarillo_seg'); P.rail(bx1, zl0, bx1, zl1, yb, 'amarillo_seg');
    }
  }
  P.box(ax0, cy - 0.2, -lz, bx1, cy, -fz, 'metal');
  P.rail(ax0, -lz, bx1, -lz, cy, 'amarillo_seg'); P.rail(ax0, -lz, ax0, -fz, cy, 'amarillo_seg');
  for (const [x, z] of [[ax0 + 0.06, -lz + 0.06], [ax0 + 0.06, lz - 0.06], [bx1 - 0.06, -lz + 0.06], [bx1 - 0.06, lz - 0.06]]) P.cbox(x, -0.6, z, 0.16, cy + 0.4, 0.16, 'amarillo_seg');
  P.addLoot(0, cy, 0);
  return P;
}

// Contenedor de carga (abierto de un lado).
export function contenedor({ m = 'chapa_roja', abierto = true } = {}) {
  const P = new Plano();
  const L = 6, W = 2.5, H = 2.7;
  P.box(-L / 2, 0, -W / 2, L / 2, 0.15, W / 2, 'metal_osc');
  P.box(-L / 2, H - 0.15, -W / 2, L / 2, H, W / 2, m);
  P.box(-L / 2, 0.15, -W / 2, L / 2, H - 0.15, -W / 2 + 0.12, m);
  P.box(-L / 2, 0.15, W / 2 - 0.12, L / 2, H - 0.15, W / 2, m);
  P.box(-L / 2, 0.15, -W / 2 + 0.12, -L / 2 + 0.12, H - 0.15, W / 2 - 0.12, m);
  if (!abierto) P.box(L / 2 - 0.12, 0.15, -W / 2 + 0.12, L / 2, H - 0.15, W / 2 - 0.12, m);
  for (let x = -L / 2 + 0.4; x < L / 2; x += 0.5) for (const z of [-W / 2 - 0.03, W / 2 + 0.03]) P.cbox(x, 0.15, z, 0.12, H - 0.3, 0.06, m, false);
  if (abierto) P.addLoot(-0.5, 0.15, 0);
  return P;
}

// Choza sobre pilotes con muelle (ciénaga).
export function palafito({ w = 7, d = 6, alto = 2.4, pared = 'madera2', techo = 'techo_verde', cofre = true, escalera = '+z' } = {}) {
  const P = new Plano();
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2, y = alto;
  for (const x of [x0 + 0.3, 0, x1 - 0.3]) for (const z of [z0 + 0.3, z1 - 0.3, z1 + 2.0]) P.cyl(x, -2.5, z, 0.2, y + 2.4, 'tronco', { seg: 6, solid: true });
  P.box(x0 - 0.2, y - 0.3, z0 - 0.2, x1 + 0.2, y, z1 + 2.4, 'madera');
  P.wall(x0, z1, x1, z1, y, 3.2, pared, [{ c: w / 2, w: 1.5, y: 0, h: 2.4, kind: 'puerta' }, { c: w * 0.2, w: 1.1, y: 1.0, h: 1.0, kind: 'ventana' }], { frame: 'madera_osc', ext: T / 2 });
  P.wall(x0, z0, x1, z0, y, 3.2, pared, [{ c: w / 2, w: 1.1, y: 1.0, h: 1.0, kind: 'ventana' }], { frame: 'madera_osc', ext: T / 2 });
  P.wall(x0, z0 + T / 2, x0, z1 - T / 2, y, 3.2, pared, [{ c: d / 2, w: 1.1, y: 1.0, h: 1.0, kind: 'ventana' }], { frame: 'madera_osc' });
  P.wall(x1, z0 + T / 2, x1, z1 - T / 2, y, 3.2, pared);
  P.gable(x0, z0, x1, z1, y + 3.2 - T, 2.2, techo, { axis: 'x', over: 0.7, wallM: pared });
  P.rail(x0 - 0.2, z1 + 2.4, x0 + w * 0.3, z1 + 2.4, y, 'madera_osc');
  P.rail(x1 - w * 0.3 + 0.4, z1 + 2.4, x1 + 0.2, z1 + 2.4, y, 'madera_osc');
  // escalera hasta el agua
  if (escalera === '+z') P.stairs(-0.8, z1 + 2.4, 0.8, z1 + 2.4 + y * 1.2, -0.6, y, '-z', 'madera');
  cama(P, x0 + 1.0, y, z0 + 1.4, false, 'tela2');
  mesa(P, x1 - 1.6, y, 0, 1.2, 0.8);
  P.addLoot(0, y, 0);
  if (cofre) P.addChest(x1 - 0.9, y, z0 + 0.9, 0);
  return P;
}

// Pasarela de madera recta (une palafitos). Va de z=0 a z=L.
export function pasarela({ L = 12, w = 2, y = 0.8 } = {}) {
  const P = new Plano();
  const n = Math.max(1, Math.round(L / 4));
  for (let k = 0; k < n; k++) {
    const za = (L * k) / n, zb = (L * (k + 1)) / n;
    P.grupo(() => {
      P.box(-w / 2, y - 0.25, za, w / 2, y, zb, 'madera2');
      for (const z of [za + 0.6, (za + zb) / 2 + 0.6]) if (z < zb - 0.2) for (const x of [-w / 2 + 0.15, w / 2 - 0.15]) P.cyl(x, -2.5, z, 0.13, y + 2.3, 'tronco', { seg: 6, solid: true });
    });
  }
  return P;
}

// Casa de adobe con techo plano y escalera exterior a la terraza (pueblo del desierto).
export function adobe({ w = 8, d = 7, pisos = 1, pared = 'adobe', marco = 'madera_osc', cofre = true, toldo = 'lona_amarilla' } = {}) {
  const P = new Plano();
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2, H = 3.6;
  P.footing(x0, z0, x1, z1, 'adobe2');
  P.slab(x0, z0, x1, z1, 0.05, 'baldosa', [], 0.35);
  for (let p = 0; p < pisos; p++) {
    const y = 0.05 + p * H;
    const px0 = p ? x0 + 1.5 : x0;
    P.wall(px0, z1, x1, z1, y, H, pared, p === 0 ? [{ c: (x1 - px0) * 0.4, w: 1.5, y: 0, h: 2.5, kind: 'puerta' }, { c: (x1 - px0) * 0.8, w: 1.0, y: 1.2, h: 1.0, kind: 'ventana' }] : [{ c: (x1 - px0) * 0.5, w: 1.0, y: 1.2, h: 1.0, kind: 'ventana' }], { frame: marco, ext: T / 2 });
    P.wall(px0, z0, x1, z0, y, H, pared, [{ c: (x1 - px0) * 0.5, w: 1.0, y: 1.2, h: 1.0, kind: 'ventana' }], { frame: marco, ext: T / 2 });
    // el piso de arriba se entra desde la terraza (lado oeste)
    P.wall(px0, z0 + T / 2, px0, z1 - T / 2, y, H, pared, p ? [{ c: d * 0.6, w: 1.4, y: 0, h: 2.4, kind: 'puerta' }] : [{ c: d * 0.5, w: 1.0, y: 1.2, h: 1.0, kind: 'ventana' }], { frame: marco });
    P.wall(x1, z0 + T / 2, x1, z1 - T / 2, y, H, pared, p === 0 && pisos === 1 ? [{ c: d * 0.5, w: 1.0, y: 1.2, h: 1.0, kind: 'ventana' }] : [], { frame: marco });
    // la terraza deja libre el hueco de la escalera y, si hay otro piso, el lugar de sus paredes
    const abierto = p ? [] : [{ lado: 'x0', a: z0 - 1, b: z0 + 1.9 }];
    if (p < pisos - 1) abierto.push({ lado: 'z0', a: x0 + 1.5 - T / 2, b: x1 + 1 }, { lado: 'z1', a: x0 + 1.5 - T / 2, b: x1 + 1 }, { lado: 'x1', a: z0 - 1, b: z1 + 1 });
    P.flatRoof(px0, z0, x1, z1, y + H - T, pared, { parapet: 0.7, pm: pared, trim: null, abierto });
    // vigas salientes típicas
    for (let k = 0; k < Math.floor((x1 - px0) / 1.6); k++) P.cbox(px0 + 0.8 + k * 1.6, y + H - 0.6, z1 + 0.25, 0.2, 0.2, 0.7, 'madera_osc', false);
  }
  // escalera exterior por el costado izquierdo hasta la terraza del primer nivel
  const ty = 0.05 + H, ex = x0 - T / 2;
  P.stairs(ex - 1.35, z0 + 1.9, ex, z0 + 1.9 + ty * 1.1, 0.05, ty, '-z', pared);
  P.box(ex - 1.35, -0.5, z0 + 1.9, ex, 0.05, z0 + 1.9 + ty * 1.1, null);
  // descanso macizo de adobe arriba de la escalera, frente al hueco del parapeto (pegado por afuera de la pared)
  P.box(ex - 1.35, -0.5, z0 - T / 2, ex, ty, z0 + 1.9, pared);
  P.box(ex - 1.45, ty, z0 - T / 2, ex, ty + 0.5, z0 + 0.1, pared);
  if (toldo) P.grupo(() => {
    P.slope(x0 + w * 0.2, z1, x1 - 0.4, z1 + 1.8, 2.5, 2.9, '-z', 0.06, toldo);
    for (const x of [x0 + w * 0.2 + 0.1, x1 - 0.5]) P.cbox(x, 0.05, z1 + 1.7, 0.12, 2.5, 0.12, 'madera_osc');
  });
  // vasijas
  P.cyl(x1 - 0.6, 0.05, z1 + 0.6, 0.35, 0.8, 'adobe2', { r2: 0.2, seg: 8, solid: true });
  P.cyl(x1 - 1.3, 0.05, z1 + 0.5, 0.3, 0.6, 'techo_terracota', { r2: 0.18, seg: 8, solid: true });
  estante(P, x1 - 0.5, 0.05, 0, false, 'madera_osc');
  mesa(P, x0 + 2.2, 0.05, 0, 1.4, 0.9, 'madera');
  P.addLoot(x0 + w * 0.6, 0.05, z0 + 1.5);
  P.addLoot(0, ty, 0);
  if (cofre) P.addChest(x0 + 0.9, 0.05, z1 - 0.9, 1);
  return P;
}

// Puesto de mercado con lona.
export function puesto({ lona = 'lona_roja', m = 'madera' } = {}) {
  const P = new Plano();
  P.grupo(() => {
    P.box(-1.6, 0, -0.6, 1.6, 0.95, 0.6, m);
    P.box(-1.65, 0.95, -0.65, 1.65, 1.0, 0.65, 'madera_osc', false);
    for (const [x, z] of [[-1.5, -0.5], [1.5, -0.5], [-1.5, 1.4], [1.5, 1.4]]) P.cbox(x, 0, z, 0.1, 2.5, 0.1, 'madera_osc');
    P.slope(-1.8, -0.7, 1.8, 1.7, 2.4, 2.8, '-z', 0.06, lona);
    for (let k = 0; k < 4; k++) P.cbox(-1.35 + k * 0.9, 1.0, 0, 0.5, 0.3, 0.5, ['naranja', 'verde', 'rojo', 'amarillo'][k], false);
  });
  P.addLoot(0, 0.05, 1.3);
  return P;
}

// Carpa de camping.
export function carpa({ m = 'lona_naranja' } = {}) {
  const P = new Plano();
  const c = PALETA[m] ? m : 'lona_azul';
  P.grupo(() => {
    P.tri(-1.4, 0, -1.6, 1.4, 1.7, 1.6, 'x', c);
    P.solid({ x0: -1.4, x1: 1.4, z0: -1.6, z1: 1.6, y0: 0, y1: 1.2 });
  });
  P.addLoot(0, 0.05, 2.3);
  return P;
}

// Torre de vigía de madera con escalera.
export function torreVigia({ h = 8, cofre = true } = {}) {
  const P = new Plano();
  const s = 2.2;
  for (const [x, z] of [[-s, -s], [s, -s], [-s, s], [s, s]]) P.cbox(x, -1, z, 0.35, h + 1 + 2.6, 0.35, 'tronco');
  for (const y of [h * 0.3, h * 0.65]) {
    P.tube([-s, y, -s], [s, y + 1.4, -s], 0.08, 'tronco'); P.tube([-s, y, s], [s, y + 1.4, s], 0.08, 'tronco');
  }
  P.box(-s - 0.4, h - 0.3, -s - 0.4, s + 0.4, h, s + 0.4, 'madera');
  P.rail(-s - 0.4, -s - 0.4, s + 0.4, -s - 0.4, h, 'madera_osc'); P.rail(-s - 0.4, -s - 0.4, -s - 0.4, s + 0.4, h, 'madera_osc');
  P.rail(s + 0.4, -s - 0.4, s + 0.4, s + 0.4, h, 'madera_osc'); P.rail(-s - 0.4, s + 0.4, -0.2, s + 0.4, h, 'madera_osc');
  P.gable(-s - 0.4, -s - 0.4, s + 0.4, s + 0.4, h + 2.4, 1.2, 'techo_marron', { axis: 'x', over: 0.3, solidCeil: true, ceil: 'madera' });
  // escalera en dos tramos
  const zl = s + 0.4 + h * 0.6;
  P.stairs(0.0, s + 0.4, 1.3, zl, 0.05, h * 0.5, '+z', 'madera');
  P.box(0.0, h * 0.5 - 0.25, zl, 2.8, h * 0.5, zl + 1.4, 'madera');
  P.rail(0.0, zl + 1.4, 2.8, zl + 1.4, h * 0.5, 'madera_osc'); P.rail(2.8, zl, 2.8, zl + 1.4, h * 0.5, 'madera_osc');
  for (const [x, z] of [[0.12, zl + 1.28], [2.68, zl + 1.28], [2.68, zl + 0.12]]) P.cbox(x, -0.6, z, 0.24, h * 0.5 + 0.35, 0.24, 'tronco');
  // el segundo tramo sube desde el descanso hacia la torre (-z)
  P.stairs(1.5, s + 0.4, 2.8, zl, h * 0.5, h, '-z', 'madera');
  P.addLoot(0, h, 0);
  if (cofre) P.addChest(-s + 0.5, h, -s + 0.5, 0);
  return P;
}

// Capilla en ruinas.
export function capilla({ cofre = true } = {}) {
  const P = new Plano();
  const w = 8, d = 13, x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2, y = 0.05;
  P.footing(x0, z0, x1, z1, 'piedra2');
  P.slab(x0, z0, x1, z1, y, 'piedra2', [], 0.35);
  P.wall(x0, z1, x1, z1, y, 6.5, 'piedra', [{ c: w / 2, w: 2.0, y: 0, h: 3.4, kind: 'puerta' }, { c: w / 2, w: 1.0, y: 4.4, h: 1.2, kind: 'hueco' }], { ext: T / 2 });
  P.wall(x0, z0, x1, z0, y, 6.0, 'piedra', [{ c: w / 2, w: 1.2, y: 2.4, h: 2.2, kind: 'hueco' }], { ext: T / 2 });
  P.wall(x0, z0 + T / 2, x0, z1 - T / 2, y, 4.2, 'piedra', [{ c: 3, w: 1.0, y: 1.6, h: 1.8, kind: 'hueco' }, { c: 7, w: 1.0, y: 1.6, h: 1.8, kind: 'hueco' }, { c: 10.6, w: 2.4, y: 0, h: 4.2, kind: 'hueco' }]);
  P.wall(x1, z0 + T / 2, x1, 2, y, 4.2, 'piedra', [{ c: 3, w: 1.0, y: 1.6, h: 1.8, kind: 'hueco' }]);
  P.box(x1 - T / 2, y, 2, x1 + T / 2, y + 1.6, z1 - T / 2, 'piedra'); // pared derrumbada
  for (const [x, z, s] of [[x1 + 1.0, 3.5, 0.8], [x1 + 1.6, 4.8, 0.6], [x1 + 0.6, 5.6, 0.7]]) P.cbox(x, 0, z, s, s * 0.7, s, 'piedra2');
  // campanario sobre el frente
  P.grupo(() => {
    P.box(-1.0, y + 6.5, z1 - 1.0, 1.0, y + 8.6, z1 + T / 2, 'piedra');
    P.cbox(0, y + 8.6, z1 - 0.43, 2.4, 0.3, 1.4, 'piedra2');
    P.tube([0, y + 8.9, z1 - 0.5], [0, y + 10.0, z1 - 0.5], 0.06, 'metal_osc');
    P.tube([-0.4, y + 9.7, z1 - 0.5], [0.4, y + 9.7, z1 - 0.5], 0.06, 'metal_osc');
  });
  // vigas del techo caído
  for (const z of [z0 + 2, z0 + 5, z0 + 8]) P.tube([x0, y + 4.2, z], [x1, y + 4.2, z + 0.4], 0.14, 'madera_osc');
  P.slope(x0 - 0.3, z0 - 0.3, 0, z0 + 6, y + 4.0, y + 6.0, '+x', 0.2, 'techo_marron');
  for (let k = 0; k < 4; k++) { P.cbox(-1.8, y, z0 + 3 + k * 2, 2.2, 0.5, 0.5, 'madera_osc'); P.cbox(1.8, y, z0 + 3 + k * 2, 2.2, 0.5, 0.5, 'madera_osc'); }
  P.cbox(0, y, z0 + 1.2, 2.4, 1.0, 1.0, 'piedra');
  P.addLoot(0, y, 0); P.addLoot(-2.2, y, z1 - 2);
  if (cofre) P.addChest(0, y, z0 + 2.4, 0);
  return P;
}

// Estación de servicio: surtidores con techo y un local.
export function estacion() {
  const P = new Plano();
  const L = local({ w: 9, d: 7, pared: 'blanco', toldo: null, letrero: 'rojo', cofre: true });
  merge(P, L, 0, -7);
  P.footing(-9, -2, 9, 8, 'hormigon2', 0.8, 0.06, { macizo: true, borde: 0 });
  for (const x of [-5, 5]) for (const z of [1, 6]) P.cbox(x, 0.05, z, 0.45, 5.2, 0.45, 'blanco');
  P.box(-7, 5.2, -1, 7, 6.0, 8, 'rojo');
  P.box(-7.05, 5.0, -1.05, 7.05, 5.25, 8.05, 'blanco_puro', false);
  for (const x of [-2.5, 2.5]) {
    P.cbox(x, 0.05, 3.5, 2.6, 0.25, 1.2, 'hormigon');
    for (const dx of [-0.7, 0.7]) { P.cbox(x + dx, 0.3, 3.5, 0.8, 1.6, 0.6, 'blanco_puro'); P.cbox(x + dx, 1.2, 3.82, 0.5, 0.35, 0.05, 'negro', false); P.cbox(x + dx, 1.76, 3.5, 0.82, 0.15, 0.62, 'rojo', false); }
  }
  P.addLoot(0, 0.06, 3.5);
  P.addLight(0, 5.0, 3.5);
  return P;
}

// Parada de colectivo.
export function parada({ m = 'azul' } = {}) {
  const P = new Plano();
  P.grupo(() => {
    P.box(-2, 0, -0.8, 2, 0.15, 0.8, 'hormigon');
    P.box(-1.94, 0.15, -0.8, 1.94, 2.5, -0.7, 'vidrio', true);
    for (const x of [-2, 2]) P.box(x - 0.06, 0.15, -0.8, x + 0.06, 2.5, 0.6, 'metal_osc');
    P.box(-2.2, 2.5, -1.0, 2.2, 2.7, 0.9, m);
    P.cbox(0, 0.15, -0.5, 3, 0.45, 0.4, 'madera');
    P.cbox(2.4, 0, 0.7, 0.1, 3, 0.1, 'metal_osc'); P.cbox(2.4, 2.6, 0.7, 0.7, 0.7, 0.06, m, false);
  });
  P.addLoot(0, 0.15, 0.3);
  return P;
}

// Puente de madera/hormigón a lo largo de Z, cubierta a altura y.
// dy: cuánto sube el tablero de punta a punta (de z = -L/2 a z = +L/2), para empalmar con la ruta en las dos orillas.
export function puente({ L = 20, w = 7, y = 1, dy = 0, m = 'hormigon', baranda = 'metal_osc' } = {}) {
  const P = new Plano();
  const alto = (z) => y + dy * (z / L); // altura del tablero en z (y en el centro)
  const up = dy >= 0 ? '+z' : '-z';
  // tramo inclinado de x0..x1 y za..zb: de la altura ha (en za) a hb (en zb), con base plana en `piso`
  const cuña = (x0, x1, za, zb, ha, hb, piso, mat) => {
    const [lo, hi] = dy >= 0 ? [ha, hb] : [hb, ha];
    if (Math.abs(hi - lo) < 1e-3) P.box(x0, piso, za, x1, hi, zb, mat);
    else P.ramp(x0, piso, za, x1, hi, zb, up, mat, true, lo);
  };
  // tablero en tramos de ~4 m (cada uno con su cordón y su baranda)
  const n = Math.max(1, Math.round(L / 4));
  for (let k = 0; k < n; k++) {
    const za = -L / 2 + (L * k) / n, zb = -L / 2 + (L * (k + 1)) / n, ya = alto(za), yb = alto(zb), base = Math.min(ya, yb);
    P.grupo(() => {
      cuña(-w / 2, w / 2, za, zb, ya, yb, base - 0.6, m);
      cuña(-w / 2 - 0.15, -w / 2 + 0.25, za, zb, ya + 0.35, yb + 0.35, base, m);
      cuña(w / 2 - 0.25, w / 2 + 0.15, za, zb, ya + 0.35, yb + 0.35, base, m);
      // baranda inclinada: postes, pasamanos y travesaño; choca con una cuña invisible
      for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) {
        for (const z of [za + 0.06, zb - 0.06]) P.cbox(x, alto(z) + 0.33, z, 0.09, 0.82, 0.09, baranda, false);
        P.tube([x, ya + 1.1, za], [x, yb + 1.1, zb], 0.05, baranda, 6);
        P.tube([x, ya + 0.75, za], [x, yb + 0.75, zb], 0.035, baranda, 5);
        const [lo, hi] = dy >= 0 ? [ya, yb] : [yb, ya];
        P.ramp(x - 0.06, base, za, x + 0.06, hi + 1.15, zb, up, null, true, lo + 1.15);
      }
    });
  }
  // pilas: sostienen el tablero (si se rompen los tramos que apoyan en ellas, se cae el resto)
  for (const z of [-L / 4, L / 4]) {
    const k = Math.min(n - 1, Math.floor(((z + L / 2) / L) * n)), base = Math.min(alto(-L / 2 + (L * k) / n), alto(-L / 2 + (L * (k + 1)) / n)) - 0.6;
    for (const x of [-w / 2 + 0.8, w / 2 - 0.8]) P.cbox(x, base - 5.35, z, 0.9, 5.4, 0.9, m); // entra 5 cm en el tablero
  }
  return P;
}

// Fogón con troncos y bancos.
export function fogon() {
  const P = new Plano();
  P.grupo(() => {
    P.cyl(0, 0, 0, 0.9, 0.3, 'piedra2', { seg: 10, solid: true });
    P.cyl(0, 0.05, 0, 0.6, 0.3, 'negro', { seg: 8 });
  });
  // troncos para sentarse: cada uno es una pieza, con cilindros de choque a lo largo
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2, A = [Math.cos(a) * 2.2, 0.27, Math.sin(a) * 2.2], B = [Math.cos(a + 0.9) * 2.2, 0.27, Math.sin(a + 0.9) * 2.2];
    P.grupo(() => {
      P.tube(A, B, 0.27, 'tronco');
      for (let j = 0; j < 6; j++) { const t = (j + 0.5) / 6; P.solidCyl({ x: A[0] + (B[0] - A[0]) * t, z: A[2] + (B[2] - A[2]) * t, r: 0.27, y0: 0, y1: 0.54 }); }
    });
  }
  P.addLoot(1.2, 0.05, 1.2);
  return P;
}

// Tractor.
export function tractor() {
  const P = new Plano();
  P.grupo(() => {
    P.box(-0.7, 0.8, -1.6, 0.7, 1.7, 1.2, 'verde');
    P.box(-0.75, 1.7, -1.6, 0.75, 3.0, -0.2, 'vidrio', false);
    P.box(-0.8, 3.0, -1.7, 0.8, 3.15, -0.1, 'verde');
    P.tube([-1.3, 0.85, -1.0], [1.3, 0.85, -1.0], 0.85, 'goma', 12);
    P.tube([-1.0, 0.5, 1.0], [1.0, 0.5, 1.0], 0.5, 'goma', 10);
    P.cyl(0.4, 1.7, 0.8, 0.08, 1.2, 'negro', { seg: 6 });
    P.solid({ x0: -1.3, x1: 1.3, z0: -1.9, z1: 1.6, y0: 0, y1: 1.7 });
  });
  return P;
}

// Cerca (a lo largo de X, de 0 a L).
export function cerca({ L = 10, m = 'blanco', h = 1.0 } = {}) {
  const P = new Plano();
  P.rail(0, 0, L, 0, 0, m, h);
  return P;
}

// Farol.
export function farol() {
  const P = new Plano();
  P.grupo(() => {
    P.cyl(0, 0, 0, 0.12, 4.2, 'metal_osc', { seg: 6, solid: true });
    P.tube([0, 4.1, 0], [0.9, 4.3, 0], 0.07, 'metal_osc');
    P.cbox(0.9, 3.9, 0, 0.45, 0.35, 0.45, 'luz', false);
  });
  P.addLight(0.9, 3.8, 0);
  return P;
}

// Fuente de plaza.
export function fuente() {
  const P = new Plano();
  P.grupo(() => {
    P.cyl(0, 0, 0, 4.2, 0.7, 'piedra', { seg: 16, solid: true });
    P.cyl(0, 0.3, 0, 3.8, 0.45, 'agua', { seg: 16 });
    P.cyl(0, 0.7, 0, 0.6, 1.6, 'piedra2', { seg: 10, solid: true });
    P.cyl(0, 2.3, 0, 1.6, 0.35, 'piedra', { seg: 12, r2: 1.2 });
    P.cyl(0, 2.65, 0, 0.3, 0.9, 'piedra2', { seg: 8 });
    P.sphere(0, 3.6, 0, 0.35, 'agua', { seg: 8 });
  });
  return P;
}

// Calesita (parque).
export function calesita({ cofre = true } = {}) {
  const P = new Plano();
  P.cyl(0, -0.5, 0, 7, 1.0, 'blanco', { seg: 20, solid: true });
  P.cyl(0, 0.33, 0, 7.02, 0.15, 'rosa', { seg: 20, open: true }); // franja del borde (abierta: no tapa el piso)
  P.cyl(0, 0.5, 0, 1.2, 5.5, 'amarillo', { seg: 12, solid: true });
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2, x = Math.cos(a) * 5, z = Math.sin(a) * 5;
    P.grupo(() => {
      P.cyl(x, 0.5, z, 0.08, 5, 'amarillo_seg', { seg: 6, solid: true });
      P.cbox(x, 1.6 + (k % 2) * 0.5, z, 0.5, 0.9, 1.4, ['blanco_puro', 'lila', 'celeste', 'rosa'][k % 4]);
    });
  }
  P.grupo(() => {
    P.cyl(0, 5.5, 0, 7.5, 2.4, 'lona_roja', { r2: 0.5, seg: 20 });
    for (let k = 0; k < 20; k++) { const a = (k / 20) * Math.PI * 2; P.cbox(Math.cos(a) * 7.3, 5.2, Math.sin(a) * 7.3, 0.6, 0.35, 0.6, k % 2 ? 'lona_amarilla' : 'lona_roja', false); }
    P.solidCyl({ x: 0, z: 0, r: 6.5, y0: 5.5, y1: 6.3 });
  });
  P.addLoot(3, 0.5, 0);
  if (cofre) P.addChest(-2, 0.5, 0, 0);
  return P;
}

// Vuelta al mundo (rueda gigante).
export function rueda() {
  const P = new Plano();
  const R = 13, cy = R + 3;
  for (const z of [-1.6, 1.6]) { P.cbox(-6, -1, z, 1.2, 1.1, 1.2, 'hormigon'); P.cbox(6, -1, z, 1.2, 1.1, 1.2, 'hormigon'); }
  // estructura (patas, eje, aro y rayos): una pieza; las patas chocan abajo, donde se puede caminar
  P.grupo(() => {
    for (const z of [-1.6, 1.6]) {
      for (const sx of [-6, 6]) {
        P.tube([sx, 0, z], [0, cy, z * 0.6], 0.35, 'blanco');
        for (let yy = 0; yy < 4; yy++) { const t = (yy + 0.5) / cy; P.solidCyl({ x: sx * (1 - t), z: z * (1 - 0.4 * t), r: 0.38, y0: yy, y1: yy + 1 }); }
      }
    }
    P.tube([0, cy, -1.4], [0, cy, 1.4], 0.5, 'metal_osc');
    const n = 24;
    for (const z of [-1.0, 1.0]) for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, b = ((k + 1) / n) * Math.PI * 2;
      P.tube([Math.cos(a) * R, cy + Math.sin(a) * R, z], [Math.cos(b) * R, cy + Math.sin(b) * R, z], 0.16, 'rosa', 6);
      if (k % 2 === 0) P.tube([0, cy, z], [Math.cos(a) * R, cy + Math.sin(a) * R, z], 0.07, 'blanco', 4);
    }
  });
  // cabinas colgadas del aro (cada una es una pieza)
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2, x = Math.cos(a) * R, y = cy + Math.sin(a) * R;
    P.grupo(() => {
      P.cbox(x, y - 2.2, 0, 1.6, 1.6, 1.6, ['celeste', 'amarillo', 'lila', 'menta'][k % 4]);
      P.cbox(x, y - 0.6, 0, 1.8, 0.2, 1.8, 'blanco');
      P.tube([x, y - 0.4, 0], [x, y, 0], 0.06, 'metal_osc', 4);
      P.tube([x, y, -1.0], [x, y, 1.0], 0.07, 'metal_osc', 4); // barra entre los dos aros, de donde cuelga
    });
  }
  // cabina de abajo para subirse (es sólo una plataforma)
  P.box(-3, 0, -3.5, 3, 0.45, -2.0, 'madera');
  P.cbox(0, 0, 3.2, 2.4, 2.6, 1.8, 'lila');
  P.addLoot(0, 0.45, -2.8);
  return P;
}

// Puesto de comida del parque.
export function kiosco({ m = 'rosa', lona = 'lona_roja' } = {}) {
  const P = new Plano();
  P.footing(-2.2, -1.8, 2.2, 1.8, 'hormigon2', 1, 0.05, { macizo: true, borde: 0.15 });
  // paredes hasta 2.55 y el techo encima, tapándolas (no comparten la cara de arriba)
  P.wall(-2.2, -1.8, 2.2, -1.8, 0.05, 2.5, m, [], { ext: T / 2 });
  P.wall(-2.2, -1.65, -2.2, 1.65, 0.05, 2.5, m);
  P.wall(2.2, -1.65, 2.2, 1.65, 0.05, 2.5, m, [{ c: 1.6, w: 1.2, y: 0, h: 2.2, kind: 'puerta' }]);
  P.wall(-2.2, 1.8, 2.2, 1.8, 0.05, 2.5, m, [{ c: 2.2, w: 3.0, y: 1.0, h: 1.3, kind: 'hueco' }], { ext: T / 2 });
  P.flatRoof(-2.2, -1.8, 2.2, 1.8, 2.55, 'blanco', { parapet: 0, inset: -T / 2 });
  P.slope(-2.3, 1.8, 2.3, 3.0, 2.3, 2.7, '-z', 0.06, lona);
  P.grupo(() => {
    P.cbox(0, 2.85, 0, 2.6, 1.2, 0.4, 'amarillo');
    P.sphere(0, 4.1, 0, 0.9, 'naranja', { seg: 10 });
  });
  P.addLoot(0, 0.05, 0);
  return P;
}

// Laboratorio moderno (observatorio).
export function laboratorio({ w = 14, d = 10, cofre = true } = {}) {
  const P = new Plano();
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2, y = 0.05, H = 4;
  P.footing(x0, z0, x1, z1, 'hormigon2');
  P.slab(x0, z0, x1, z1, y, 'baldosa', [], 0.35);
  P.wall(x0, z1, x1, z1, y, H, 'blanco_puro', [{ c: w * 0.3, w: 1.8, y: 0, h: 2.6, kind: 'puerta' }, { c: w * 0.7, w: 5, y: 0.8, h: 2.4, kind: 'ventana' }], { frame: 'metal_osc', glass: true, ext: T / 2 });
  P.wall(x0, z0, x1, z0, y, H, 'blanco_puro', [{ c: w * 0.5, w: 5, y: 0.8, h: 2.4, kind: 'ventana' }, { c: w * 0.85, w: 1.4, y: 0, h: 2.6, kind: 'puerta' }], { frame: 'metal_osc', glass: true, ext: T / 2 });
  P.wall(x0, z0 + T / 2, x0, z1 - T / 2, y, H, 'blanco_puro');
  P.wall(x1, z0 + T / 2, x1, z1 - T / 2, y, H, 'blanco_puro', [{ c: d * 0.5, w: 3, y: 0.8, h: 2.4, kind: 'ventana' }], { frame: 'metal_osc', glass: true });
  P.anillo(x0, z0, x1, z1, y + H - 0.6, y + H - 0.3, 'azul', { out: 0.1 }); // franja azul por afuera
  P.flatRoof(x0, z0, x1, z1, y + H - T, 'hormigon2', { parapet: 0.8, pm: 'blanco_puro', abierto: [{ lado: 'x1', a: z0 - 1, b: z0 + 2.2 }] });
  // escalera exterior al techo, con descanso arriba frente al hueco del parapeto (pegado por afuera de la pared)
  const ex = x1 + T / 2;
  P.stairs(ex, z0 + 2.2, x1 + 1.5, z0 + 2.2 + 4.2, y, y + H, '-z', 'metal_osc', { rail: 'metal_osc' });
  P.box(ex, y + H - 0.3, z0 - T / 2, x1 + 1.5, y + H, z0 + 2.2, 'metal');
  P.rail(x1 + 1.5, z0 - T / 2, x1 + 1.5, z0 + 2.2, y + H, 'metal_osc'); P.rail(ex, z0 - T / 2, x1 + 1.5, z0 - T / 2, y + H, 'metal_osc');
  P.cbox(x1 + 1.35, y, z0 + 0.0, 0.2, H - 0.3, 0.2, 'metal_osc');
  // paneles solares sobre patas (cada uno es una pieza; la cuña invisible hace que no se atraviesen)
  for (let k = 0; k < 3; k++) {
    const a = x0 + 1 + k * 3, b = x0 + 3.5 + k * 3, yr = y + H;
    P.grupo(() => {
      P.slope(a, z0 + 1.5, b, z0 + 4, yr + 0.4, yr + 1.3, '+z', 0.08, 'azul');
      P.ramp(a, yr + 0.3, z0 + 1.5, b, yr + 1.3, z0 + 4, '+z', null, true, yr + 0.4);
      for (const x of [a + 0.2, b - 0.2]) { P.cbox(x, yr, z0 + 1.7, 0.08, 0.38, 0.08, 'metal_osc'); P.cbox(x, yr, z0 + 3.8, 0.08, 1.15, 0.08, 'metal_osc'); }
    });
  }
  mesada(P, x0 + 0.6, z0 + 0.6, x0 + 5, z0 + 1.4, y);
  mesada(P, x1 - 4.5, z1 - 1.4, x1 - 0.6, z1 - 0.6, y);
  mesa(P, 0, y, 0, 2.4, 1.2, 'blanco');
  P.cbox(x0 + 1.2, y + 0.95, z0 + 1.0, 0.6, 0.45, 0.4, 'negro');
  P.addLoot(-2, y, 1.5); P.addLoot(2, y + H, 0);
  if (cofre) P.addChest(x0 + 1.0, y, z1 - 1.0, 1);
  return P;
}

// Cúpula del observatorio con telescopio y pasarela interior.
export function cupula({ cofre = true } = {}) {
  const P = new Plano();
  const R = 7, y = 0.05, H = 6, e = T / 2;
  P.cyl(0, -2, 0, R + 0.4, 1.75, 'hormigon2', { seg: 20 }); // base (termina debajo del piso)
  P.cyl(0, y - 0.3, 0, R, 0.3, 'baldosa', { seg: 20, solid: true }); // piso
  // choque de un tramo curvo: cajitas de ~0.6 m que siguen la curva
  const choque = (b0, b1, ya, yb) => {
    const k = Math.max(1, Math.ceil(((b1 - b0) * R) / 0.6));
    for (let i = 0; i < k; i++) {
      const c0 = b0 + ((b1 - b0) * i) / k, c1 = b0 + ((b1 - b0) * (i + 1)) / k;
      const xs = [], zs = [];
      for (const rr of [R - e, R + e]) for (const c of [c0, c1]) { xs.push(Math.cos(c) * rr); zs.push(Math.sin(c) * rr); }
      P.solid({ x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), y0: ya, y1: yb });
    }
  };
  // pared en 8 tramos (cada uno se rompe por separado) con la puerta hacia +z
  const pd = 1.0 / R, a0 = Math.PI / 2 + pd, a1 = Math.PI / 2 - pd + Math.PI * 2, nT = 8;
  for (let k = 0; k < nT; k++) {
    const b0 = a0 + ((a1 - a0) * k) / nT, b1 = a0 + ((a1 - a0) * (k + 1)) / nT;
    P.grupo(() => { P.arc(0, y, 0, R - e, R + e, H, b0, b1, 'blanco', 4); choque(b0, b1, y, y + H); });
  }
  P.grupo(() => {
    P.arc(0, y + 2.6, 0, R - e, R + e, H - 2.6, Math.PI / 2 - pd, Math.PI / 2 + pd, 'blanco', 2); // dintel
    choque(Math.PI / 2 - pd, Math.PI / 2 + pd, y + 2.6, y + H);
    for (const sx of [-1, 1]) P.cbox(sx * (R * Math.sin(pd) + 0.02), y, R * Math.cos(pd), 0.16, 2.72, 0.42, 'marco', false);
    P.cbox(0, y + 2.6, R, 2.2, 0.12, 0.42, 'marco', false);
  });
  // cúpula: se ve también desde adentro; choca con cilindros escalonados que siguen su forma
  P.grupo(() => {
    P.sphere(0, y + H, 0, R + 0.2, 'blanco_puro', { half: true, seg: 20, sy: 0.85, grosor: 0.25 });
    for (const [ya, yb, rr] of [[0, 1.5, 7.1], [1.5, 3, 6.6], [3, 4.5, 5.6], [4.5, 5.9, 3.6]]) P.solidCyl({ x: 0, z: 0, r: rr, y0: y + H + ya, y1: y + H + yb });
    // ranura de observación: placas siguiendo la curva, con rieles a los costados
    const Rd = R + 0.2 + 0.12, n = 9, am = (78 * Math.PI) / 180;
    for (let k = 0; k < n; k++) {
      const ta = (k / n) * am - 0.08, tb = ((k + 1) / n) * am;
      const za = -Rd * Math.sin(Math.max(0, ta)), ya = y + H + Rd * 0.85 * Math.cos(Math.max(0, ta));
      const zb = -Rd * Math.sin(tb), yb = y + H + Rd * 0.85 * Math.cos(tb);
      P.slope(-0.9, zb, 0.9, za, yb, ya, '+z', 0.08, 'negro');
      for (const x of [-1.05, 1.05]) P.tube([x, ya + 0.05, za], [x, yb + 0.05, zb], 0.09, 'metal', 5);
    }
  });
  // telescopio en el centro sobre pedestal
  P.grupo(() => {
    P.cyl(0, y, 0, 1.0, 2.0, 'metal_osc', { seg: 10, solid: true });
    P.tube([0, 1.9, 0.2], [0, 2.6, 0.2], 0.35, 'metal_osc', 8);
    // apunta hacia la ranura pero casi vertical: no se mete en la pasarela ni baja hasta las cabezas
    P.tube([0, 2.6, 0.6], [0, 5.3, -0.45], 0.55, 'blanco_puro', 12);
    P.tube([0, 5.3, -0.45], [0, 5.7, -0.6], 0.62, 'negro', 12);
  });
  // escalera hasta la pasarela interior
  P.stairs(-5.2, -1.0, -3.8, 3.4, y, y + 3.6, '-z', 'metal_osc', { rail: 'metal_osc' });
  P.box(-5.2, y + 3.35, -4.6, 4.6, y + 3.6, -1.0, 'metal');
  P.rail(-3.8, -1.0, 4.6, -1.0, y + 3.6, 'metal_osc'); P.rail(4.6, -4.4, 4.6, -1.0, y + 3.6, 'metal_osc');
  P.addLoot(2, y, 2); P.addLoot(2, y + 3.6, -3.5);
  if (cofre) P.addChest(4, y, 3, 2);
  return P;
}

// Antena de radio reticulada.
export function antena({ h = 30 } = {}) {
  const P = new Plano();
  const s = 1.6;
  for (const [x, z] of [[-s, -s], [s, -s], [-s, s], [s, s]]) P.cbox(x, -0.8, z, 0.8, 1.0, 0.8, 'hormigon');
  P.grupo(() => {
    for (const [x, z] of [[-s, -s], [s, -s], [-s, s], [s, s]]) P.tube([x, 0, z], [x * 0.25, h, z * 0.25], 0.12, 'rojo', 6);
    for (let y = 3; y < h; y += 3) { const k = 1 - (y / h) * 0.75; for (const [a, b] of [[[-s, -s], [s, -s]], [[s, -s], [s, s]], [[s, s], [-s, s]], [[-s, s], [-s, -s]]]) P.tube([a[0] * k, y, a[1] * k], [b[0] * k, y + 1.5, b[1] * k], 0.05, y % 6 ? 'blanco' : 'rojo', 4); }
    P.cbox(0, h, 0, 0.3, 4, 0.3, 'metal_osc', false);
    P.sphere(0, h + 4.2, 0, 0.35, 'luz_roja', { seg: 8 });
    P.solid({ x0: -s, x1: s, z0: -s, z1: s, y0: 0, y1: 3 });
  });
  return P;
}

// Cabaña de troncos (montaña).
export function cabana({ w = 8, d = 7, cofre = true, techo = 'techo_marron', nieve = true, porche = true } = {}) {
  const P = casa({ w, d, pisos: 1, pared: 'tronco', techo, marco: 'madera_osc', piso: 'madera', cofre, chimenea: true, porche, base: 'piedra', rise: 3.0 });
  // troncos horizontales salientes en las esquinas
  for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) for (let y = 0.4; y < 4; y += 0.45) P.tube([x - 0.3, y, z], [x + 0.3, y, z], 0.16, 'madera_osc', 6);
  if (nieve) P.nieve();
  return P;
}

// Refugio grande de montaña (dos pisos, balcón).
export function lodge({ cofre = true } = {}) {
  const P = casa({ w: 14, d: 10, pisos: 2, pared: 'madera2', techo: 'techo_negro', marco: 'madera_osc', piso: 'madera', cofre, chimenea: true, base: 'piedra', rise: 4.0, balcon: true });
  const y = STOREY + 0.05;
  P.box(-7, y - 0.3, 5 + T / 2, 7, y, 7.4, 'madera');
  P.rail(-7, 7.4, 7, 7.4, y, 'madera_osc'); P.rail(-7, 5.1, -7, 7.4, y, 'madera_osc'); P.rail(7, 5.1, 7, 7.4, y, 'madera_osc');
  for (const x of [-6.6, 0, 6.6]) P.cbox(x, -0.5, 7.0, 0.35, y + 0.2, 0.35, 'tronco');
  P.slope(-7.3, 5, 7.3, 7.8, y + 2.5, y + 3.2, '-z', 0.15, 'techo_negro');
  P.nieve();
  P.addLoot(0, y, 6.2);
  return P;
}

// Teleférico: torre con plataforma.
export function torreTeleferico() {
  const P = new Plano();
  P.grupo(() => {
    P.cbox(0, -3, 0, 2.4, 3.6, 2.4, 'hormigon');
    P.cbox(0, -1, 0, 1.2, 14, 1.2, 'metal_osc');
    P.box(-4, 13, -1, 4, 13.6, 1, 'metal_osc');
    for (const x of [-3.6, 3.6]) { P.cyl(x, 13.6, -0.6, 0.45, 0.25, 'amarillo_seg', { seg: 10 }); P.cyl(x, 13.6, 0.6, 0.45, 0.25, 'amarillo_seg', { seg: 10 }); }
    P.tube([-0.6, 9, 0], [-3.4, 13, 0], 0.12, 'metal_osc'); P.tube([0.6, 9, 0], [3.4, 13, 0], 0.12, 'metal_osc');
  }, { fija: true });
  return P;
}

// Cinta transportadora y tolva de la cantera.
export function tolva() {
  const P = new Plano();
  for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) P.cbox(x, -1, z, 0.5, 7, 0.5, 'oxido');
  P.box(-2.5, 6, -2.5, 2.5, 6.3, 2.5, 'metal_osc');
  P.cyl(0, 6.3, 0, 3.0, 3.5, 'amarillo_seg', { r2: 3.0, seg: 4, solid: true });
  P.cyl(0, 3.5, 0, 0.6, 2.5, 'metal_osc', { r2: 2.2, seg: 4 });
  P.ramp(-0.8, 0, 3, 0.8, 9, 18, '-z', 'metal_osc', true, 0);
  for (let z = 5; z < 18; z += 4) P.cbox(0, -1, z, 0.4, 9 * (18 - z) / 15 + 0.6, 0.4, 'oxido', false);
  P.stairs(2.6, -2.5, 3.9, 3.5, 0.05, 6.3, '-z', 'metal', { rail: 'amarillo_seg' });
  P.box(2.4, 6.0, -4.4, 3.9, 6.3, -2.5, 'metal');
  P.rail(3.9, -4.4, 3.9, -2.5, 6.3, 'amarillo_seg'); P.rail(2.4, -4.4, 3.9, -4.4, 6.3, 'amarillo_seg');
  P.addLoot(3.15, 6.3, -3.5);
  return P;
}

// Andamio de cantera con plataformas.
export function andamio({ h = 8 } = {}) {
  const P = new Plano();
  const w = 6, d = 3;
  for (const x of [-w / 2, 0, w / 2]) for (const z of [-d / 2, d / 2]) P.cbox(x, -0.5, z, 0.12, h + 1.55, 0.12, 'metal');
  const hueco = { x0: -w / 2 + 0.3, z0: 0.15, x1: w / 2 - 1.0, z1: d / 2 };
  for (let y = 4; y <= h; y += 4) {
    P.slab(-w / 2, -d / 2, w / 2, d / 2, y, 'madera', y + 4 <= h ? [] : [hueco], 0.15);
    P.rail(-w / 2, -d / 2, w / 2, -d / 2, y, 'amarillo_seg');
  }
  P.stairs(w / 2 + 0.05, -d / 2, w / 2 + 1.35, d / 2 + 2.0, 0.05, 4, '-z', 'madera');
  // tramo de arriba: va sobre la plataforma de 4 m, a lo largo de x, y llega a la de 8 m por el hueco
  P.stairs(hueco.x0, hueco.z0, hueco.x1, hueco.z1, 4, h, '+x', 'madera');
  P.rail(hueco.x0, hueco.z0 - 0.05, hueco.x1 - 1.2, hueco.z0 - 0.05, h, 'amarillo_seg');
  P.addLoot(0, h, 0);
  return P;
}


// Malecón de hormigón del puerto (borde del muelle). Se extiende a lo largo de X, el agua queda hacia +Z.
export function malecon({ L = 150, d = 6 } = {}) {
  const P = new Plano();
  P.grupo(() => {
    P.box(-L / 2, -7, -d / 2, L / 2, 0.05, d / 2, 'hormigon');
    P.box(-L / 2, 0.05, d / 2 - 0.4, L / 2, 0.25, d / 2, 'amarillo_seg');
    for (let x = -L / 2 + 4; x < L / 2; x += 8) { P.cyl(x, 0.05, d / 2 - 0.8, 0.25, 0.6, 'metal_osc', { seg: 8 }); P.cyl(x, 0.65, d / 2 - 0.8, 0.35, 0.12, 'metal_osc', { seg: 8 }); P.solidCyl({ x, z: d / 2 - 0.8, r: 0.35, y0: 0.05, y1: 0.77 }); }
    for (let x = -L / 2 + 10; x < L / 2; x += 20) P.cbox(x, -2.5, d / 2 + 0.25, 0.5, 2.0, 0.5, 'goma', false);
  }, { fija: true });
  return P;
}

// Pila de tres cajas.
export function caja3() {
  const P = new Plano();
  caja(P, 0, 0, 0, 1.1); caja(P, 1.2, 0, 0.1, 1.1, 'madera'); caja(P, 0.6, 1.1, 0.05, 1.0);
  P.addLoot(-1.0, 0.05, 1.0);
  return P;
}

// Grupo de barriles.
export function barriles() {
  const P = new Plano();
  barril(P, 0, 0, 0); barril(P, 0.9, 0, 0.3, 'azul'); barril(P, 0.3, 0, 0.95, 'rojo');
  return P;
}

// Campo sembrado: surcos (sólo visuales, se camina por encima).
export function campo({ w = 30, d = 20, m = 'hoja' } = {}) {
  const P = new Plano();
  for (let x = -w / 2; x <= w / 2; x += 1.6) {
    P.box(x - 0.45, -0.2, -d / 2, x + 0.45, 0.12, d / 2, 'tierra');
    P.conTag('veg', () => P.box(x - 0.3, 0.12, -d / 2 + 0.3, x + 0.3, m === 'heno' ? 1.0 : 0.62, d / 2 - 0.3, m, false));
  }
  return P;
}

// Arco de entrada del parque.
export function arco() {
  const P = new Plano();
  P.grupo(() => {
    for (const x of [-5.5, 5.5]) { P.cbox(x, 0, 0, 1.4, 7, 1.4, 'rosa'); P.sphere(x, 7.6, 0, 0.9, 'amarillo', { seg: 10 }); }
    P.box(-4.8, 5.6, -0.4, 4.8, 7.2, 0.4, 'lila');
    for (let k = 0; k < 9; k++) P.sphere(-4.8 + k * 1.2, 6.4, 0.45, 0.25, k % 2 ? 'luz' : 'luz_roja', { seg: 6 });
  });
  return P;
}

// Montaña rusa (pista sobre columnas).
export function montanaRusa() {
  const P = new Plano();
  const n = 48, pts = [];
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * Math.PI * 2;
    pts.push([Math.cos(a) * 30, 3 + 7 + Math.sin(a * 2) * 4 + Math.cos(a * 3) * 2.5, Math.sin(a) * 12]);
  }
  // cada tramo (tres segmentos de pista con su columna) se rompe por separado
  for (let j = 0; j * 3 < n; j++) {
    P.grupo(() => {
      for (let k = j * 3; k < Math.min(n, j * 3 + 3); k++) {
        const a = pts[k], b = pts[k + 1];
        for (const o of [-0.6, 0.6]) P.tube([a[0], a[1], a[2] + o], [b[0], b[1], b[2] + o], 0.12, 'rojo', 6);
        P.tube([a[0], a[1] - 0.1, a[2] - 0.7], [a[0], a[1] - 0.1, a[2] + 0.7], 0.08, 'metal_osc', 4);
        if (k % 3 === 0) { P.tube([a[0], -1, a[2]], [a[0], a[1] - 0.1, a[2]], 0.22, 'blanco', 6); P.solidCyl({ x: a[0], z: a[2], r: 0.3, y0: -1, y1: a[1] - 0.2 }); }
      }
      for (let c = 0; c < 3; c++) { const i = c * 4 + 2; if (Math.floor(i / 3) === j) { const a = pts[i]; P.cbox(a[0], a[1] + 0.2, a[2], 1.6, 0.9, 1.4, ['amarillo', 'celeste', 'rosa'][c], false); } }
    });
  }
  P.box(-4, 0, -16, 4, 0.45, -13, 'madera');
  P.addLoot(0, 0.45, -14.5);
  return P;
}

// Ruinas de piedra (paredes caídas).
export function ruinas() {
  const P = new Plano();
  P.box(-5.08, -0.5, -4.08, 5.08, 0.15, 4.08, 'piedra2');
  P.box(-5, 0, -4, 1, 3.2, -3.4, 'piedra');
  P.box(-5, 0, -3.4, -4.4, 2.2, 2, 'piedra');
  P.box(2, 0, -4, 5, 1.2, -3.4, 'piedra');
  P.box(4.4, 0, -3.4, 5, 2.6, 0.5, 'piedra');
  P.box(-3, 0, 3.4, 0, 1.0, 4, 'piedra');
  for (const [x, z, s] of [[2, 2, 0.8], [3, 3, 0.6], [-1, 1, 0.7], [1, -1.5, 0.5]]) P.cbox(x, 0, z, s, s * 0.6, s, 'piedra2');
  P.cyl(-2, 0, 1, 0.4, 3.0, 'piedra', { solid: true, seg: 8 });
  P.addLoot(0, 0.15, 0);
  P.addChest(-4.0, 0.15, -2.6, 0);
  return P;
}


// Banco de plaza.
export function banco({ m = 'madera2' } = {}) {
  const P = new Plano();
  P.grupo(() => {
    for (const x of [-0.75, 0.75]) { P.cbox(x, 0, 0, 0.08, 0.45, 0.5, 'metal_osc', false); P.cbox(x, 0.45, -0.22, 0.08, 0.5, 0.06, 'metal_osc', false); }
    for (let k = 0; k < 3; k++) P.cbox(0, 0.42, -0.15 + k * 0.15, 1.8, 0.05, 0.12, m, false);
    for (let k = 0; k < 2; k++) P.cbox(0, 0.62 + k * 0.17, -0.25, 1.8, 0.12, 0.05, m, false);
    P.solid({ x0: -0.9, x1: 0.9, z0: -0.3, z1: 0.3, y0: 0, y1: 0.5 });
    P.solid({ x0: -0.9, x1: 0.9, z0: -0.3, z1: -0.18, y0: 0.5, y1: 0.95 });
  });
  return P;
}

// Tacho de basura.
export function tacho({ m = 'verde' } = {}) {
  const P = new Plano();
  P.grupo(() => {
    P.cyl(0, 0, 0, 0.3, 0.9, m, { seg: 8, solid: true });
    P.cyl(0, 0.9, 0, 0.33, 0.08, 'metal_osc', { seg: 8 });
  });
  return P;
}

// Hidrante.
export function hidrante() {
  const P = new Plano();
  P.grupo(() => {
    P.cyl(0, 0, 0, 0.16, 0.7, 'rojo', { seg: 8, solid: true });
    P.sphere(0, 0.7, 0, 0.17, 'rojo', { half: true, seg: 8 });
    P.tube([-0.25, 0.45, 0], [0.25, 0.45, 0], 0.07, 'rojo', 6);
  });
  return P;
}

// Cartel con el nombre del pueblo (el texto lo dibuja el cliente).
export function cartel({ text = '', m = 'madera_osc', fondo = 'verde', w = 5 } = {}) {
  const P = new Plano();
  P.grupo(() => {
    for (const x of [-w / 2 + 0.3, w / 2 - 0.3]) P.cbox(x, -0.4, 0, 0.18, 3.6, 0.18, m);
    P.cbox(0, 1.8, 0, w, 1.3, 0.14, fondo);
    P.cbox(0, 1.72, 0, w + 0.14, 0.08, 0.2, m, false);
    P.cbox(0, 3.1, 0, w + 0.14, 0.08, 0.2, m, false);
  }, { fija: true });
  P.signs = [{ x: 0, y: 2.45, z: 0, w: w - 0.25, h: 1.15, text, face: 0, d: 0.08, color: PALETA[fondo] ? PALETA[fondo][0] : '#2f7d4a', ink: '#f4f1e6' }];
  return P;
}

// Seto (cerco vivo) a lo largo de X, de 0 a L.
export function seto({ L = 8, h = 1.1 } = {}) {
  const P = new Plano();
  P.grupo(() => {
    P.box(0, 0, -0.45, L, h, 0.45, 'hoja');
    P.box(0.1, h, -0.35, L - 0.1, h + 0.15, 0.35, 'hoja', false);
  });
  return P;
}

// Cantero con flores.
export function cantero({ w = 3, d = 1.2 } = {}) {
  const P = new Plano();
  P.grupo(() => {
    P.box(-w / 2, 0, -d / 2, w / 2, 0.4, d / 2, 'piedra');
    P.box(-w / 2 + 0.12, 0.4, -d / 2 + 0.12, w / 2 - 0.12, 0.45, d / 2 - 0.12, 'tierra');
    const cols = ['rojo', 'amarillo', 'rosa', 'lila', 'blanco_puro'];
    P.conTag('veg', () => { for (let k = 0; k < Math.floor(w / 0.35); k++) for (let j = 0; j < 2; j++) P.sphere(-w / 2 + 0.3 + k * 0.35, 0.58, -d / 4 + j * d / 2, 0.13, cols[(k + j * 2) % cols.length], { seg: 5 }); });
  });
  return P;
}

// Buzón.
export function buzon() {
  const P = new Plano();
  P.grupo(() => {
    P.cbox(0, 0, 0, 0.1, 1.0, 0.1, 'madera_osc');
    P.cbox(0, 1.0, 0, 0.3, 0.3, 0.5, 'azul');
  });
  return P;
}

// Jardín frente a una casa: seto con hueco para entrar, canteros y buzón. Frente hacia +Z, ancho w.
export function jardin({ w = 12, d = 5, px = 0 } = {}) {
  const P = new Plano();
  const g = 1.6;
  merge(P, seto({ L: px - g / 2 + w / 2 }), -w / 2, d);
  merge(P, seto({ L: w / 2 - px - g / 2 }), px + g / 2, d);
  merge(P, cantero({ w: 2.4 }), Math.abs(-w / 4 - px) < 2.2 ? w / 4 : -w / 4, d - 1.6);
  merge(P, buzon(), px + g / 2 + 0.6, d + 0.9);
  P.box(px - g / 2, -0.1, 0, px + g / 2, 0.08, d + 0.5, 'baldosa2');
  return P;
}


// Poste de luz de madera (los cables los tiende el mundo entre postes vecinos).
export function poste() {
  const P = new Plano();
  P.grupo(() => {
    P.cyl(0, -0.5, 0, 0.14, 8.5, 'tronco', { seg: 6, solid: true, r2: 0.11 });
    P.cbox(0, 7.4, 0, 2.2, 0.14, 0.14, 'madera_osc', false);
    for (const x of [-0.9, 0, 0.9]) P.cyl(x, 7.54, 0, 0.05, 0.16, 'blanco', { seg: 5 });
  }, { fija: true });
  return P;
}

// Indicador de caminos: poste con flechas a los pueblos. textos: [[texto, rot de la flecha 0..3], ...]
export function indicador({ textos = [] } = {}) {
  const P = new Plano();
  P.grupo(() => P.cbox(0, -0.4, 0, 0.16, 3.7, 0.16, 'madera_osc'), { fija: true });
  textos.forEach(([text, r], k) => {
    const y = 3.0 - k * 0.55;
    const [dx, dz] = [[0, 1], [1, 0], [0, -1], [-1, 0]][r & 3];
    const along = dx !== 0;
    const L = 2.2;
    const cx = dx * (L / 2 + 0.05), cz = dz * (L / 2 + 0.05);
    P.grupo(() => {
      if (along) P.box(cx - L / 2, y - 0.42, cz - 0.04, cx + L / 2, y, cz + 0.04, 'madera2', false);
      else P.box(cx - 0.04, y - 0.42, cz - L / 2, cx + 0.04, y, cz + L / 2, 'madera2', false);
    }, { fija: true });
    P.signs = P.signs || [];
    // cartel a los dos lados de la tabla
    P.signs.push({ x: cx, y: y - 0.02, z: cz, w: L - 0.1, h: 0.38, text, dir: [dx, dz], face: along ? 0 : 1, d: 0.05, color: '#f6ead0', ink: '#3b2a1a' });
  });
  return P;
}

// ---------- Piezas rompibles ----------
// Junta los grupos de un plano en piezas. Cada pieza tiene sólidos (chocan y reciben golpes) y partes visibles.
// - Un grupo sólo visual se pega a la pieza sólida que más toca; si está al ras del piso queda como decoración fija.
// - Un sólido invisible se pega a la pieza visible que más toca.
// - Son fijas (no se rompen) las marcadas con grupo({ fija }) y las enterradas al ras del piso (cimientos, pisos de planta baja).
// Devuelve { lista: [{ grupos, parts, solids, cyls, cajas, fija, apoyo, clase, factor, color, aabb }], deGrupo: Map(g -> índice | -1) }.

// Material de una pieza para la vida y para lo que da el pico: madera, piedra o metal.
export function claseDe(m) {
  const p = PALETA[m];
  if (!p) return 'madera';
  if (p[1] === 'm') return 'metal';
  if (p[1] === 'v') return 'piedra';
  const pat = p[2] || 0;
  if ([2, 8, 9, 12].includes(pat)) return 'madera';
  if ([1, 3, 5, 6, 7, 10, 11].includes(pat)) return 'piedra';
  if (pat === 4) return 'metal';
  if (/^(metal|negro|goma|amarillo_seg|luz)/.test(m)) return 'metal';
  if (/^(piedra|hormigon|ladrillo|baldosa|blanco_puro|nieve)/.test(m)) return 'piedra';
  return 'madera';
}

// Cajas que ocupa una parte visible (los caños y las paredes curvas se cortan en pedazos para que la caja ajuste).
export function cajasParte(q) {
  switch (q.t) {
    case 'box': case 'ramp': case 'tri': return [q.a.slice()];
    case 'slope': { const [x0, z0, x1, z1] = q.a; return [[Math.min(x0, x1), Math.min(q.ylo, q.yhi) - q.th, Math.min(z0, z1), Math.max(x0, x1), Math.max(q.ylo, q.yhi), Math.max(z0, z1)]]; }
    case 'cyl': { const r = Math.max(q.r, q.r2); return [[q.x - r, q.y, q.z - r, q.x + r, q.y + q.h, q.z + r]]; }
    case 'sph': return [[q.x - q.r, q.y - (q.half ? 0 : q.r * q.sy), q.z - q.r, q.x + q.r, q.y + q.r * q.sy, q.z + q.r]];
    case 'tube': {
      const L = Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1], q.b[2] - q.a[2]), n = Math.max(1, Math.ceil(L / 1.0)), out = [];
      for (let k = 0; k < n; k++) {
        const p = (t) => [0, 1, 2].map((i) => q.a[i] + (q.b[i] - q.a[i]) * t), A = p(k / n), B = p((k + 1) / n);
        out.push([Math.min(A[0], B[0]) - q.r, Math.min(A[1], B[1]) - q.r, Math.min(A[2], B[2]) - q.r, Math.max(A[0], B[0]) + q.r, Math.max(A[1], B[1]) + q.r, Math.max(A[2], B[2]) + q.r]);
      }
      return out;
    }
    case 'arc': {
      const n = Math.max(1, Math.ceil(((q.a1 - q.a0) * q.r1) / 1.0)), out = [];
      for (let k = 0; k < n; k++) {
        const c0 = q.a0 + ((q.a1 - q.a0) * k) / n, c1 = q.a0 + ((q.a1 - q.a0) * (k + 1)) / n, xs = [], zs = [];
        for (const rr of [q.r0, q.r1]) for (const c of [c0, c1]) { xs.push(q.x + Math.cos(c) * rr); zs.push(q.z + Math.sin(c) * rr); }
        out.push([Math.min(...xs), q.y, Math.min(...zs), Math.max(...xs), q.y + q.h, Math.max(...zs)]);
      }
      return out;
    }
  }
  return [];
}

const cajaSolido = (s) => [s.x0, s.y0, s.z0, s.x1, s.y1, s.z1];
const cajaCyl = (c) => [c.x - c.r, c.y0, c.z - c.r, c.x + c.r, c.y1, c.z + c.r];
const volumen = (b) => Math.max(0, b[3] - b[0]) * Math.max(0, b[4] - b[1]) * Math.max(0, b[5] - b[2]);
// Volumen de la intersección de dos cajas agrandadas en e (o -1 si no se tocan).
export function solapa(a, b, e = 0.03) {
  const dx = Math.min(a[3], b[3]) - Math.max(a[0], b[0]) + 2 * e; if (dx <= 0) return -1;
  const dy = Math.min(a[4], b[4]) - Math.max(a[1], b[1]) + 2 * e; if (dy <= 0) return -1;
  const dz = Math.min(a[5], b[5]) - Math.max(a[2], b[2]) + 2 * e; if (dz <= 0) return -1;
  return dx * dy * dz;
}

// Índice espacial de cajas en celdas de 2 m (x, z).
export class IndiceCajas {
  constructor(c = 2) { this.c = c; this.m = new Map(); }
  celdas(b, e, fn) {
    const c = this.c, i0 = Math.floor((b[0] - e) / c), i1 = Math.floor((b[3] + e) / c), j0 = Math.floor((b[2] - e) / c), j1 = Math.floor((b[5] + e) / c);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) fn(i * 100003 + j);
  }
  add(b, v) { this.celdas(b, 0, (k) => { let a = this.m.get(k); if (!a) this.m.set(k, (a = [])); a.push([b, v]); }); }
  query(b, e, fn) { const vistos = new Set(); this.celdas(b, e, (k) => { for (const it of this.m.get(k) || []) if (!vistos.has(it)) { vistos.add(it); fn(it[0], it[1]); } }); }
}

export function piezasDe(P) {
  if (P._piezas) return P._piezas;
  const G = new Map();
  const get = (g) => { let e = G.get(g); if (!e) G.set(g, (e = { g, parts: [], solids: [], cyls: [], vc: [], sc: [], vol: new Map(), dest: null })); return e; };
  P.parts.forEach((q, i) => {
    const e = get(q.g); e.parts.push(i);
    const cs = cajasParte(q);
    e.vc.push(...cs);
    const v = cs.reduce((a, b) => a + volumen(b), 0) * (q.t === 'box' ? 1 : 0.5);
    e.vol.set(q.m, (e.vol.get(q.m) || 0) + v);
  });
  P.solids.forEach((s, i) => { const e = get(s.g); e.solids.push(i); e.sc.push(cajaSolido(s)); });
  P.cyls.forEach((c, i) => { const e = get(c.g); e.cyls.push(i); e.sc.push(cajaCyl(c)); });
  const grupos = [...G.values()];
  const conSolidos = grupos.filter((e) => e.sc.length), conVista = grupos.filter((e) => e.vc.length);
  const mejor = (cajas, idx) => {
    let best = null, bv = -1;
    for (const b of cajas) idx.query(b, 0.03, (c, e) => { const v = solapa(b, c); if (v > bv) { bv = v; best = e; } });
    return best;
  };
  // 1) grupos sólo visuales: a la pieza sólida que más tocan (o decoración fija)
  const iSol = new IndiceCajas();
  for (const e of conSolidos) for (const b of e.sc) iSol.add(b, e);
  for (const e of grupos) {
    if (e.sc.length || !e.vc.length) continue;
    const y0 = Math.min(...e.vc.map((b) => b[1])), y1 = Math.max(...e.vc.map((b) => b[4]));
    if (P.fijos.has(e.g) || (y0 < 0.06 && y1 <= 0.65)) { e.dest = 'decor'; continue; }
    const d = mejor(e.vc, iSol);
    e.dest = d || 'decor';
  }
  // 2) sólidos invisibles: a la pieza visible que más tocan
  const iVis = new IndiceCajas();
  for (const e of conVista) if (e.sc.length) for (const b of e.vc) iVis.add(b, e);
  for (const e of conSolidos) {
    if (e.vc.length) continue;
    const d = mejor(e.sc, iVis);
    if (d) e.dest = d;
  }
  // 3) armar las piezas
  const lista = [], deGrupo = new Map();
  const raiz = (e) => { while (e.dest && e.dest !== 'decor') e = e.dest; return e; };
  for (const e of conSolidos) {
    if (e.dest) continue;
    const pz = { grupos: [e.g], parts: [...e.parts], solids: [...e.solids], cyls: [...e.cyls], sc: [...e.sc], cajas: [...e.sc, ...e.vc], vol: new Map(e.vol) };
    e.pieza = lista.length;
    lista.push(pz);
  }
  for (const e of grupos) {
    if (e.pieza !== undefined) { deGrupo.set(e.g, e.pieza); continue; }
    if (e.dest === 'decor' || !e.dest) { deGrupo.set(e.g, -1); continue; }
    const r = raiz(e);
    if (r.pieza === undefined) { deGrupo.set(e.g, -1); continue; }
    const pz = lista[r.pieza];
    deGrupo.set(e.g, r.pieza);
    pz.grupos.push(e.g); pz.parts.push(...e.parts); pz.solids.push(...e.solids); pz.cyls.push(...e.cyls);
    pz.sc.push(...e.sc); pz.cajas.push(...e.sc, ...e.vc);
    for (const [m, v] of e.vol) pz.vol.set(m, (pz.vol.get(m) || 0) + v);
  }
  for (const pz of lista) {
    const ys0 = Math.min(...pz.sc.map((b) => b[1])), ys1 = Math.max(...pz.sc.map((b) => b[4]));
    pz.fija = pz.grupos.some((g) => P.fijos.has(g)) || (ys0 < -0.01 && ys1 <= 0.6) || !pz.parts.length;
    pz.apoyo = pz.fija || ys0 <= 0.12; // apoyada en el piso
    let mm = null, mv = -1;
    for (const [m, v] of pz.vol) if (v > mv) { mv = v; mm = m; }
    pz.mat = mm;
    pz.clase = claseDe(mm);
    pz.color = PALETA[mm]?.[0] || '#999999';
    const a = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const b of pz.cajas) for (let i = 0; i < 3; i++) { a[i] = Math.min(a[i], b[i]); a[i + 3] = Math.max(a[i + 3], b[i + 3]); }
    pz.aabb = a;
    const s = [0, 1, 2].map((i) => Math.max(...pz.sc.map((b) => b[i + 3])) - Math.min(...pz.sc.map((b) => b[i]))).sort((p, q) => q - p);
    pz.factor = Math.min(1.5, Math.max(0.3, Math.sqrt(s[0] * s[1]) / 4));
    delete pz.vol;
  }
  P._piezas = { lista, deGrupo };
  return P._piezas;
}

// Vecinas de cada pieza (se tocan) para saber qué queda en el aire cuando se rompe algo.
export function vecinasDe(lista) {
  const idx = new IndiceCajas(), vec = lista.map(() => new Set());
  lista.forEach((pz, i) => { for (const b of pz.cajas) idx.add(b, i); });
  lista.forEach((pz, i) => { for (const b of pz.cajas) idx.query(b, 0.04, (c, j) => { if (j !== i && solapa(b, c, 0.04) > 0) { vec[i].add(j); vec[j].add(i); } }); });
  return vec;
}

// Piezas que quedan sin apoyo (no llegan al piso pasando por piezas sanas). rotas: Set de índices.
export function sinApoyo(lista, vec, rotas) {
  const ok = new Uint8Array(lista.length), cola = [];
  lista.forEach((pz, i) => { if (!rotas.has(i) && pz.apoyo) { ok[i] = 1; cola.push(i); } });
  while (cola.length) { const i = cola.pop(); for (const j of vec[i]) if (!ok[j] && !rotas.has(j)) { ok[j] = 1; cola.push(j); } }
  const out = [];
  lista.forEach((pz, i) => { if (!ok[i] && !rotas.has(i) && !pz.fija) out.push(i); });
  return out;
}

// ---------- utilidades ----------
export function merge(dst, src, dx = 0, dz = 0, dy = 0) {
  const t = (a) => [a[0] + dx, a[1] + dy, a[2] + dz, a[3] + dx, a[4] + dy, a[5] + dz];
  // los grupos del plano agregado siguen siendo piezas aparte (se renumeran después de los de dst)
  const off = dst.ng;
  dst.ng += src.ng;
  for (const g of src.fijos) dst.fijos.add(g + off);
  for (const p of src.parts) {
    const q = { ...p, g: p.g + off };
    if (p.a && (p.t === 'box' || p.t === 'ramp' || p.t === 'tri')) q.a = t(p.a);
    else if (p.t === 'slope') { q.a = [p.a[0] + dx, p.a[1] + dz, p.a[2] + dx, p.a[3] + dz]; q.ylo += dy; q.yhi += dy; }
    else if (p.t === 'tube') { q.a = [p.a[0] + dx, p.a[1] + dy, p.a[2] + dz]; q.b = [p.b[0] + dx, p.b[1] + dy, p.b[2] + dz]; }
    else { q.x = p.x + dx; q.y = p.y + dy; q.z = p.z + dz; }
    if (p.t === 'ramp') q.lo = p.lo + dy;
    dst.parts.push(q);
  }
  for (const s of src.solids) dst.solids.push({ ...s, g: s.g + off, x0: s.x0 + dx, x1: s.x1 + dx, z0: s.z0 + dz, z1: s.z1 + dz, y0: s.y0 + dy, y1: s.y1 + dy, lo: s.lo !== undefined ? s.lo + dy : undefined });
  for (const c of src.cyls) dst.cyls.push({ ...c, g: c.g + off, x: c.x + dx, z: c.z + dz, y0: c.y0 + dy, y1: c.y1 + dy });
  for (const t2 of src.techos) dst.techos.push({ ...t2, g: t2.g + off, x0: t2.x0 + dx, x1: t2.x1 + dx, z0: t2.z0 + dz, z1: t2.z1 + dz, ylo: t2.ylo + dy, yhi: t2.yhi + dy });
  for (const l of src.loot) dst.loot.push({ x: l.x + dx, y: l.y + dy, z: l.z + dz });
  for (const c of src.chests) dst.chests.push({ ...c, x: c.x + dx, y: c.y + dy, z: c.z + dz });
  for (const l of src.lights) dst.lights.push({ x: l.x + dx, y: l.y + dy, z: l.z + dz });
  if (src.signs) dst.signs = [...(dst.signs || []), ...src.signs.map((g) => ({ ...g, x: g.x + dx, y: g.y + dy, z: g.z + dz }))];
  return dst;
}

export const PLANOS = {
  casa, galpon, edificio, local, cobertizo, granero, silo, molino, tanqueAgua, faro, muelle, bote, grua, contenedor,
  palafito, pasarela, adobe, puesto, carpa, torreVigia, capilla, estacion, parada, puente, fogon, tractor, cerca,
  farol, fuente, calesita, rueda, kiosco, laboratorio, cupula, antena, cabana, lodge, torreTeleferico, tolva, andamio,
  malecon, caja3, barriles, campo, arco, montanaRusa, ruinas, banco, tacho, hidrante, cartel, seto, cantero, buzon, jardin, poste, indicador,
};
