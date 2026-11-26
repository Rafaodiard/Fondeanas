// Autos (compartido, sin Three.js): medidas, asientos, física de manejo y choques.
// Lo usan el cliente (manejar.js: el que maneja simula su auto y lo manda al servidor) y el servidor (dónde está cada
// auto, quién va sentado, daño). Las medidas son las del modelo de Blender (tools/blender/auto.py).
// Coordenadas del auto: x a la derecha, y arriba, z hacia atrás (el frente mira a -Z, como el personaje).

export const AUTO = {
  LARGO: 4.5, ANCHO: 2.02, ALTO: 1.93, CAPO: 1.12,
  EJE_D: 1.42, EJE_T: 1.36, TROCHA: 0.84, R_RUEDA: 0.39,
  VIDA: 800,
  // velocidades (m/s) y aceleraciones (m/s²)
  MAX: 27, TURBO_MAX: 36, REVERSA: 9, ACEL: 9.5, ACEL_TURBO: 15, ACEL_REV: 7, FRENO: 24, ROCE: 2.6, MANO: 10,
  GIRO_MAX: 0.62, AGARRE: 9, AGARRE_MANO: 1.7,
  TURBO_DURA: 3, TURBO_CARGA: 7,          // segundos de turbo con el tanque lleno y para llenarlo de nuevo
  // círculos de choque a lo largo del auto (z local) y su radio
  CIRCULOS: [-1.32, -0.66, 0, 0.66, 1.32], RADIO: 0.95,
  AGUA: -0.9,                              // no entra donde el piso está más hondo que esto (agua profunda)
  ALCANCE: 4.2,                            // distancia para subirse (al centro del auto, sin contar el alto)
  ATROPELLO: 7,                            // velocidad desde la que pisar a alguien hace daño
};
export const DISTANCIA_EJES = AUTO.EJE_D + AUTO.EJE_T;

// Embestidas: el auto rompe o no lo que choca según la velocidad con la que le pega (la parte de la velocidad que va
// contra la cosa, no la total: rozar una pared de costado no la rompe). Tabla por material, para tunear:
//   desde  m/s contra la cosa desde los que el golpe la daña (más despacio el auto solo rebota, como antes)
//   porMs  daño a la cosa por cada m/s por encima de `desde`; si llega a su vida, la rompe y el auto sigue de largo
//   frena  m/s que pierde el auto por cada 100 de vida que rompe al atravesar algo
//   dano   daño al auto por cada 100 de vida que rompe
// Con vida llena: madera (150) se rompe desde 12,5 m/s (45 km/h), piedra (300) desde 24,7 m/s (89 km/h, casi a fondo),
// metal (450) solo con turbo (34,5 m/s); un árbol común (150) desde 15,4 m/s; las rocas frenan siempre al auto
// (la más chica, 222, recién se rompe con turbo a fondo). Lo que ya está dañado se rompe más fácil.
// Lo fijo del mapa (postes, torres del teleférico, carteles...) y lo que no es una pieza frena siempre.
export const EMBESTIDA = {
  madera: { desde: 5, porMs: 20, frena: 3.2, dano: 8 },
  piedra: { desde: 8, porMs: 18, frena: 3.6, dano: 12 },
  metal: { desde: 12, porMs: 20, frena: 4, dano: 16 },
  arbol: { desde: 6, porMs: 16, frena: 3, dano: 8 },   // el daño se divide por el grosor del árbol (escala s)
  roca: { desde: 10, porMs: 9, frena: 5, dano: 14 },
  SALE_MIN: 0.25,   // al atravesar algo el auto conserva al menos esta parte de la velocidad contra la cosa
  ESPERA: 0.35,     // segundos antes de volver a dañar lo mismo (si se queda empujándolo no lo daña en cada paso)
  ATRAVIESA: 0.8,   // segundos que el auto sigue de largo por algo que rompió mientras llega la confirmación del servidor
};
const G = 25; // la misma gravedad que el jugador (main.js)

// Asientos: 0 = conductor (izquierda), 1 = acompañante, 2 y 3 = atrás. y = altura del almohadón.
export const ASIENTOS = [
  { x: -0.42, y: 0.63, z: 0.06 }, { x: 0.42, y: 0.63, z: 0.06 },
  { x: -0.42, y: 0.63, z: 0.98 }, { x: 0.42, y: 0.63, z: 0.98 },
];
// Centro del volante (local) y su inclinación (para las manos del conductor).
export const VOLANTE = { x: -0.42, y: 1.02, z: -0.52 };
// Ruedas: nombre del nodo del GLB y posición local del centro.
export const RUEDAS = [
  { n: 'Rueda_DI', x: -AUTO.TROCHA, z: -AUTO.EJE_D, d: true }, { n: 'Rueda_DD', x: AUTO.TROCHA, z: -AUTO.EJE_D, d: true },
  { n: 'Rueda_TI', x: -AUTO.TROCHA, z: AUTO.EJE_T, d: false }, { n: 'Rueda_TD', x: AUTO.TROCHA, z: AUTO.EJE_T, d: false },
];
// Colores de los autos del mapa (los mismos nombres que usaba el plano del auto en isla.js).
export const COLORES = {
  rojo: '#c8261d', azul: '#1f5fc4', amarillo: '#f2b705', blanco_puro: '#eef0f2', verde: '#2f9e44', celeste: '#4fb3e8',
  oxido: '#9a4a24', naranja: '#f2711c', negro: '#1d1f23',
};

/** Auto nuevo en un lugar de salida ({ x, y, z, yaw, color }). */
export function nuevoAuto(id, sp) {
  return {
    id, x: sp.x, y: sp.y, z: sp.z, yaw: sp.yaw, pitch: 0, roll: 0, vx: 0, vy: 0, vz: 0, w: 0, giro: 0,
    color: sp.color, hp: AUTO.VIDA, rota: false, seats: [null, null, null, null], ctrl: null, suelo: true, turbo: 1,
    frena: false, acelera: false,
  };
}

// ---------- Geometría ----------
/** Local (lx, lz) del auto -> mundo (x, z), solo con el giro. */
export function aMundo(a, lx, lz) {
  const s = Math.sin(a.yaw), c = Math.cos(a.yaw);
  return [a.x + lx * c + lz * s, a.z - lx * s + lz * c];
}
/** Mundo (x, z) -> local (lx, lz). */
export function aLocal(a, x, z) {
  const s = Math.sin(a.yaw), c = Math.cos(a.yaw), dx = x - a.x, dz = z - a.z;
  return [dx * c - dz * s, dx * s + dz * c];
}
/** Punto local (con giro, cabeceo y rolido, orden YXZ como Three.js) -> mundo [x, y, z]. */
export function puntoMundo(a, lx, ly, lz) {
  // rolido (Z)
  const cr = Math.cos(a.roll), sr = Math.sin(a.roll);
  let x = lx * cr - ly * sr, y = lx * sr + ly * cr, z = lz;
  // cabeceo (X)
  const cp = Math.cos(a.pitch), sp = Math.sin(a.pitch);
  const y2 = y * cp - z * sp, z2 = y * sp + z * cp;
  y = y2; z = z2;
  // giro (Y)
  const cy = Math.cos(a.yaw), sy = Math.sin(a.yaw);
  return [a.x + x * cy + z * sy, a.y + y, a.z - x * sy + z * cy];
}
export const adelante = (a) => [-Math.sin(a.yaw), -Math.cos(a.yaw)];
export const derecha = (a) => [Math.cos(a.yaw), -Math.sin(a.yaw)];
export const rapidez = (a) => Math.hypot(a.vx, a.vz);
/** Velocidad hacia adelante (negativa en reversa). */
export function avance(a) { const [fx, fz] = adelante(a); return a.vx * fx + a.vz * fz; }

/** Asiento libre más conveniente (el conductor primero), o -1. */
export function asientoLibre(a, desde = -1) {
  for (let k = 1; k <= 4; k++) { const i = (desde + k + 4) % 4; if (a.seats[i] === null) return i; }
  return -1;
}

/** Altura del techo del auto en un punto local (para pararse arriba): capó/baúl bajos, cabina alta. */
function techoLocal(lz) {
  if (lz < -1.2) return AUTO.CAPO - 0.08 + Math.max(0, (lz + 2.25) / 1.05) * 0.1;   // capó
  if (lz < -0.35) return AUTO.CAPO + (AUTO.ALTO - AUTO.CAPO) * ((lz + 1.2) / 0.85);  // parabrisas
  if (lz < 1.25) return AUTO.ALTO;                                                    // techo
  if (lz < 1.95) return AUTO.ALTO - (AUTO.ALTO - 1.25) * ((lz - 1.25) / 0.7);          // luneta
  return 1.15;
}
const DENTRO = (lx, lz, m = 0) => Math.abs(lx) <= AUTO.ANCHO / 2 + m && Math.abs(lz) <= AUTO.LARGO / 2 + m;

/** Suelo que ofrece el auto en (x, z) para alguien con los pies en y (-Infinity si no está arriba). */
export function sueloAuto(a, x, z, y, paso = 0.55) {
  const [lx, lz] = aLocal(a, x, z);
  if (!DENTRO(lx, lz)) return -Infinity;
  const top = a.y + techoLocal(lz);
  return top <= y + paso ? top : -Infinity;
}
/** Empuja una cápsula (pies en pos) fuera de la caja del auto. */
export function empujarDeAuto(a, pos, radio, alto, paso = 0.55) {
  if (pos.y + alto <= a.y + 0.2) return false;
  let [lx, lz] = aLocal(a, pos.x, pos.z);
  if (!DENTRO(lx, lz, radio)) return false;
  if (pos.y >= a.y + techoLocal(Math.max(-2.25, Math.min(2.25, lz))) - paso) return false; // está arriba: es piso
  const hx = AUTO.ANCHO / 2, hz = AUTO.LARGO / 2;
  const cx = Math.max(-hx, Math.min(lx, hx)), cz = Math.max(-hz, Math.min(lz, hz));
  let dx = lx - cx, dz = lz - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= radio * radio) return false;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    lx = cx + (dx / d) * radio; lz = cz + (dz / d) * radio;
  } else {
    const ex = [-hx - radio - lx, hx + radio - lx], ez = [-hz - radio - lz, hz + radio - lz];
    const bx = Math.abs(ex[0]) < Math.abs(ex[1]) ? ex[0] : ex[1];
    const bz = Math.abs(ez[0]) < Math.abs(ez[1]) ? ez[0] : ez[1];
    if (Math.abs(bx) < Math.abs(bz)) lx += bx; else lz += bz;
  }
  const [x, z] = aMundo(a, lx, lz);
  pos.x = x; pos.z = z;
  return true;
}
/** Distancia de un rayo (origen o, dirección d normalizada) a la carrocería (caja del auto hasta la cintura más la
 *  cabina), o Infinity. Las ventanillas no frenan las balas: arriba de la cintura solo cuentan los pilares del techo. */
export function rayoAuto(a, o, d, max = Infinity) {
  // al marco local (solo giro: el cabeceo y el rolido son chicos)
  const s = Math.sin(a.yaw), c = Math.cos(a.yaw);
  const ox = o.x - a.x, oz = o.z - a.z;
  const lo = { x: ox * c - oz * s, y: o.y - a.y, z: ox * s + oz * c };
  const ld = { x: d.x * c - d.z * s, y: d.y, z: d.x * s + d.z * c };
  const hx = AUTO.ANCHO / 2, hz = AUTO.LARGO / 2;
  let t = cajaRayo(lo, ld, -hx, 0.28, -hz, hx, 1.1, hz);
  t = Math.min(t, cajaRayo(lo, ld, -hx * 0.82, AUTO.ALTO - 0.12, -0.4, hx * 0.82, AUTO.ALTO, 1.3)); // techo
  return t <= max ? t : Infinity;
}
function cajaRayo(o, d, x0, y0, z0, x1, y1, z1) {
  let tmin = 0, tmax = Infinity;
  for (const [oa, da, a0, a1] of [[o.x, d.x, x0, x1], [o.y, d.y, y0, y1], [o.z, d.z, z0, z1]]) {
    if (Math.abs(da) < 1e-9) { if (oa < a0 || oa > a1) return Infinity; continue; }
    let t0 = (a0 - oa) / da, t1 = (a1 - oa) / da;
    if (t0 > t1) [t0, t1] = [t1, t0];
    tmin = Math.max(tmin, t0); tmax = Math.min(tmax, t1);
    if (tmin > tmax) return Infinity;
  }
  return tmin;
}

/** Dónde se baja el que iba en el asiento k: al costado de su puerta, en un lugar libre (o arriba del auto). */
export function lugarBajada(world, a, k) {
  const lado = ASIENTOS[k].x < 0 ? -1 : 1;
  const prueba = [[lado * 1.75, ASIENTOS[k].z], [lado * 1.75, -0.6], [lado * 1.75, 1.4], [-lado * 1.75, ASIENTOS[k].z], [0, -3.2], [0, 3.2]];
  for (const [lx, lz] of prueba) {
    const [x, z] = aMundo(a, lx, lz);
    const g = world.groundHeight(x, z, a.y + 1.2, a);
    if (g < AUTO.AGUA - 0.3 || Math.abs(g - a.y) > 1.6) continue;
    const p = { x, y: g, z };
    const ox = p.x, oz = p.z;
    world.collide(p, 0.45, 1.8, a);
    if (Math.hypot(p.x - ox, p.z - oz) < 0.05) return { x: p.x, y: g, z: p.z };
  }
  return { x: a.x, y: a.y + AUTO.ALTO + 0.05, z: a.z }; // encerrado: sale por el techo
}

// ---------- Embestidas ----------
/** Qué material es lo que chocó el auto ({ pz } | { key } | { res, idx }), o null si no se rompe con el auto. */
export function materialChoque(world, o) {
  if (!o) return null;
  if (Number.isInteger(o.pz)) {
    const p = world.piezas[o.pz];
    return p && !p.fija && !p.rota && EMBESTIDA[p.clase] ? { mat: p.clase, esc: 1 } : null;
  }
  if (typeof o.key === 'string') {
    const s = world.structs.get(o.key);
    return s && EMBESTIDA[s.mat] ? { mat: s.mat, esc: 1 } : null;
  }
  if ((o.res === 'tree' || o.res === 'rock') && Number.isInteger(o.idx)) {
    const r = (o.res === 'tree' ? world.trees : world.rocks)[o.idx];
    if (!r || r.alive === false) return null;
    return o.res === 'tree' ? { mat: 'arbol', esc: Math.max(0.6, r.s || 1) } : { mat: 'roca', esc: 1 };
  }
  return null;
}
/** Clave de una cosa chocada (para no dañarla dos veces seguidas). */
export const claveChoque = (o) => (Number.isInteger(o.pz) ? `z${o.pz}` : o.key ? `s${o.key}` : `${o.res}${o.idx}`);

/** Golpe del auto contra algo de material mat con vida hp, a v m/s contra la cosa (esc: grosor, para árboles).
 *  Devuelve { dano (a la cosa), rompe, sale (m/s contra la cosa que le quedan al auto), danoAuto }. Lo usan el
 *  cliente (para seguir de largo sin esperar) y el servidor (que decide con la vida de verdad). */
export function impacto(mat, hp, v, esc = 1) {
  const t = EMBESTIDA[mat];
  const nada = { dano: 0, rompe: false, sale: v, danoAuto: 0 };
  if (!t || !(v > t.desde) || !(hp > 0)) return nada;
  const dano = ((v - t.desde) * t.porMs) / esc;
  if (dano < hp) return { ...nada, dano };
  const pesa = (hp * esc) / 100; // lo que costó romperla
  return { dano, rompe: true, sale: Math.max(v * EMBESTIDA.SALE_MIN, v - t.frena * pesa), danoAuto: t.dano * pesa };
}

// Llamado por world.collide antes de que algo rompible empuje un círculo del auto. Decide si el golpe lo daña o lo
// rompe; si lo rompe, el auto pierde velocidad y sigue de largo (true = no empuja). Anota el golpe en a.embestidas
// (el cliente se lo manda al servidor).
function embestir(world, a, emb, o, nx, nz) {
  const id = claveChoque(o);
  const pasa = a.atraviesa.get(id);
  if (pasa !== undefined) { if (pasa > a.reloj) return true; a.atraviesa.delete(id); }
  const vn = -(a.vx * nx + a.vz * nz); // velocidad contra la cosa (nx, nz apunta de la cosa al auto)
  if (vn <= 0.5 || a.rota) return false;
  if ((a.golpeados.get(id) ?? -1) > a.reloj) return false;
  const m = materialChoque(world, o);
  const hp = m && emb.vida(o);
  if (!(hp > 0)) return false;
  const r = impacto(m.mat, hp, vn, m.esc);
  if (!(r.dano > 0)) return false;
  a.golpeados.set(id, a.reloj + EMBESTIDA.ESPERA);
  a.embestidas.push({ o, v: Math.round(vn * 100) / 100, rompe: r.rompe, mat: m.mat });
  if (!r.rompe) return false;
  a.atraviesa.set(id, a.reloj + EMBESTIDA.ATRAVIESA);
  const dv = vn - r.sale;
  a.vx += nx * dv; a.vz += nz * dv;
  return true;
}

// ---------- Física ----------
// ent: { acel, freno, izq, der, mano, turbo } (booleanos). Los demás autos chocan por world.dinamicos.
// emb: si viene ({ vida(o) → vida que se conoce de la cosa }), el auto rompe lo que choca según la velocidad
// (ver EMBESTIDA) y deja los golpes en a.embestidas. Sin emb choca contra todo como si fuera irrompible.
// Devuelve el golpe más fuerte contra algo (m/s de velocidad perdida) para el sonido y el daño.
export function fisicaAuto(world, a, ent, dt, emb = null) {
  let golpe = 0;
  const n = Math.max(1, Math.ceil(dt / (1 / 90)));
  const h = dt / n;
  let choque = null;
  if (emb) {
    if (!a.atraviesa) { a.atraviesa = new Map(); a.golpeados = new Map(); a.embestidas = []; a.reloj = 0; }
    choque = (o, nx, nz) => embestir(world, a, emb, o, nx, nz);
    if (a.golpeados.size > 40) for (const [k, t] of a.golpeados) if (t <= a.reloj) a.golpeados.delete(k);
  }
  for (let i = 0; i < n; i++) {
    if (emb) a.reloj += h;
    golpe = Math.max(golpe, paso(world, a, ent, h, choque));
  }
  return golpe;
}

function paso(world, a, ent, dt, choque) {
  const [fx, fz] = adelante(a), [rx, rz] = derecha(a);
  let vF = a.vx * fx + a.vz * fz;
  let vL = a.vx * rx + a.vz * rz;
  const giroObj = (ent.der ? 1 : 0) - (ent.izq ? 1 : 0);
  a.giro += (giroObj - a.giro) * Math.min(1, dt * (giroObj ? 4.5 : 7));
  const turbo = !!ent.turbo && a.turbo > 0.02 && ent.acel && !a.rota;
  a.turbo = turbo ? Math.max(0, a.turbo - dt / AUTO.TURBO_DURA) : Math.min(1, a.turbo + dt / AUTO.TURBO_CARGA);
  a.frena = false; a.acelera = false; a.turbando = turbo;
  if (a.suelo) {
    const max = turbo ? AUTO.TURBO_MAX : AUTO.MAX;
    if (a.rota) { /* sin motor */ } else if (ent.acel && !ent.freno) {
      if (vF < -0.5) { vF = Math.min(0, vF + AUTO.FRENO * dt); a.frena = true; } else {
        // el motor empuja fuerte al arrancar y cada vez menos cerca de la máxima (v = max·tanh(a·t/max))
        const acel = (turbo ? AUTO.ACEL_TURBO : AUTO.ACEL) * Math.max(0, 1 - (vF / max) ** 2);
        vF = vF > max ? vF - AUTO.ROCE * 2 * dt : vF + acel * dt;
        a.acelera = true;
      }
    } else if (ent.freno && !ent.acel) {
      if (vF > 0.5) { vF = Math.max(0, vF - AUTO.FRENO * dt); a.frena = true; } else vF = Math.max(-AUTO.REVERSA, vF - AUTO.ACEL_REV * dt);
    }
    if ((!ent.acel && !ent.freno) || a.rota) {
      // sin acelerar: roce de las ruedas y del aire
      vF -= Math.sign(vF) * Math.min(Math.abs(vF), (AUTO.ROCE + 0.004 * vF * vF) * dt);
    }
    if (ent.mano) { vF -= Math.sign(vF) * Math.min(Math.abs(vF), AUTO.MANO * dt); a.frena = true; }
    // la pendiente empuja (en bajada acelera, en subida frena)
    vF -= G * 0.55 * Math.sin(a.pitch) * dt;
    // agarre lateral: el freno de mano deja que la cola se cruce (derrape)
    vL *= Math.exp(-(ent.mano ? AUTO.AGARRE_MANO : AUTO.AGARRE) * dt);
    // dirección: menos ángulo a mucha velocidad
    const ang = a.giro * AUTO.GIRO_MAX / (1 + Math.abs(vF) / 15);
    let w = (vF * Math.tan(ang)) / DISTANCIA_EJES;
    if (ent.mano) w *= 1.45;
    a.w = -w;
    a.yaw += a.w * dt;
  } else {
    a.w *= Math.exp(-dt * 2);
    a.yaw += a.w * dt;
  }
  const [fx2, fz2] = adelante(a), [rx2, rz2] = derecha(a);
  a.vx = fx2 * vF + rx2 * vL;
  a.vz = fz2 * vF + rz2 * vL;

  // ---- movimiento horizontal con choques
  const px = a.x, pz = a.z;
  a.x += a.vx * dt; a.z += a.vz * dt;
  let golpe = 0;
  for (let it = 0; it < 2; it++) {
    for (const lz of AUTO.CIRCULOS) {
      const [cx, cz] = aMundo(a, 0, lz);
      const p = { x: cx, y: a.y, z: cz };
      world.collide(p, AUTO.RADIO, 1.5, a, choque);
      const dx = p.x - cx, dz = p.z - cz;
      if (dx * dx + dz * dz < 1e-10) continue;
      a.x += dx; a.z += dz;
      const d = Math.hypot(dx, dz), nx = dx / d, nz = dz / d;
      const vn = a.vx * nx + a.vz * nz;
      if (vn < 0) {
        golpe = Math.max(golpe, -vn);
        a.vx -= 1.25 * vn * nx; a.vz -= 1.25 * vn * nz;
        // roce contra la pared y un poco de giro (la trompa se acomoda contra lo que choca)
        a.vx *= 0.94; a.vz *= 0.94;
        const [rx3, rz3] = derecha(a);
        a.w += -lz * (nx * rx3 + nz * rz3) * Math.min(6, -vn) * 0.12;
      }
    }
  }
  // agua profunda y borde del mapa: no se pasa
  const lim = world.size * 0.75;
  let fuera = Math.abs(a.x) > lim || Math.abs(a.z) > lim;
  if (!fuera) for (const lz of [AUTO.CIRCULOS[0], AUTO.CIRCULOS[AUTO.CIRCULOS.length - 1]]) {
    const [cx, cz] = aMundo(a, 0, lz * 1.2);
    if (world.groundHeight(cx, cz, a.y + 0.6, a) < AUTO.AGUA) { fuera = true; break; }
  }
  if (fuera) {
    golpe = Math.max(golpe, rapidez(a) * 0.5);
    a.x = px; a.z = pz; a.vx *= -0.15; a.vz *= -0.15;
  }

  // ---- ruedas contra el piso: altura, cabeceo y rolido
  const ref = a.y + 0.15;
  const hs = RUEDAS.map((r) => { const [x, z] = aMundo(a, r.x, r.z); return Math.max(world.groundHeight(x, z, ref, a), AUTO.AGUA - 0.5); });
  const hc = (hs[0] + hs[1] + hs[2] + hs[3]) / 4;
  const hF = (hs[0] + hs[1]) / 2, hT = (hs[2] + hs[3]) / 2, hI = (hs[0] + hs[2]) / 2, hD = (hs[1] + hs[3]) / 2;
  const prevY = a.y;
  if (a.suelo) {
    const baja = a.y - hc;
    if (baja <= 0.04 + Math.abs(vF) * dt * 0.4) {
      a.vy = Math.max(-15, Math.min(15, (hc - prevY) / dt * 0.6 + a.vy * 0.4));
      a.y = hc;
    } else a.suelo = false;
  }
  if (!a.suelo) {
    a.vy -= G * dt;
    a.y += a.vy * dt;
    if (a.y <= hc) {
      golpe = Math.max(golpe, Math.max(0, -a.vy - 10) * 0.6);
      a.y = hc; a.vy = 0; a.suelo = true;
    }
  }
  const k = Math.min(1, dt * (a.suelo ? 14 : 1.5));
  const pObj = a.suelo ? Math.atan2(hF - hT, DISTANCIA_EJES) : a.pitch * 0.98;
  const rObj = a.suelo ? Math.atan2(hD - hI, AUTO.TROCHA * 2) : a.roll * 0.98;
  a.pitch += (pObj - a.pitch) * k;
  a.roll += (rObj - a.roll) * k;
  return golpe;
}

/** ¿El auto está arriba de alguien (pies en pos)? Para atropellos. */
export function pisaA(a, pos, margen = 0.35) {
  if (pos.y > a.y + 1.4 || pos.y + 1.8 < a.y) return false;
  const [lx, lz] = aLocal(a, pos.x, pos.z);
  return DENTRO(lx, lz, margen);
}

// ---------- Red ----------
/** Estado compacto para mandar por la red. */
export function estadoRed(a) {
  const r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => Math.round(v * 1000) / 1000;
  return { p: [r2(a.x), r2(a.y), r2(a.z)], q: [r3(a.yaw), r3(a.pitch), r3(a.roll)], v: [r2(a.vx), r2(a.vy), r2(a.vz)], g: r2(a.giro), f: (a.frena ? 1 : 0) | (a.turbando ? 2 : 0) | (a.suelo ? 4 : 0) };
}
/** Valida y aplica un estado de la red (devuelve false si no sirve). */
export function aplicarRed(a, m) {
  const ok = (v, n) => Array.isArray(v) && v.length === n && v.every(Number.isFinite);
  if (!ok(m.p, 3) || !ok(m.q, 3)) return false;
  [a.x, a.y, a.z] = m.p;
  a.yaw = m.q[0];
  a.pitch = Math.max(-1.2, Math.min(1.2, m.q[1]));
  a.roll = Math.max(-1.2, Math.min(1.2, m.q[2]));
  if (ok(m.v, 3)) [a.vx, a.vy, a.vz] = m.v.map((v) => Math.max(-60, Math.min(60, v)));
  a.giro = Math.max(-1, Math.min(1, Number(m.g) || 0));
  const f = m.f | 0;
  a.frena = !!(f & 1); a.turbando = !!(f & 2); a.suelo = !!(f & 4);
  return true;
}
/** Estado completo (para el que entra a una partida empezada). */
export function autoPublico(a) { return { ...estadoRed(a), hp: Math.ceil(a.hp), rota: a.rota, seats: a.seats, color: a.color }; }
