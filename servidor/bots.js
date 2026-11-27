// Bots de Salto Final: jugadores que maneja el servidor. Para el resto del juego son un jugador más (están en
// room.players, tienen vida, escudo, inventario y kills, la tormenta los lastima y al morir tiran todo), pero no
// tienen conexión: en vez de mandar mensajes, server.js les pasa sus acciones a handleGame igual que si las hubiera
// mandado un cliente (saltar, agarrar, abrir cofres, disparar, picar, construir, curarse, recargar). Así el servidor
// valida lo mismo para todos.
//
// Cada bot: elige dónde caer y salta del bus cuando le queda cerca, planea y abre el paracaídas, lootea (armas,
// munición, curas y cofres) caminando por rutas de navegacion.js, junta madera, ve a los enemigos (con vista que
// las paredes cortan), dispara con la puntería de su dificultad, se cubre construyendo, se cura y escapa de la
// tormenta. Se mueve con la misma física que el jugador (world.moveBody) y avisa su estado a los clientes con el
// mismo mensaje 'state' que mandan ellos.
import { WEAPONS, CONSUMABLES, AMMO, RARITIES, GRID, PICKAXE, BUILD_COST, weaponReload } from '../public/js/items.js';
import { cajaPieza } from '../public/js/construccion.js';
import { CAIDA, PARACAIDAS } from '../public/js/caida.js';
import { BOT_DIFICULTADES } from '../public/js/opcionesBots.js';
import { Navegacion } from './navegacion.js';

// Física del jugador (los mismos números que main.js).
const GRAVEDAD = 25, CAMINAR = 6, CORRER = 9.5, APUNTANDO = 3.5, NADANDO = 4, SALTO = 8.5, AGUA = -1.3;
const RADIO = 0.42;
// ms por cuadro (20 por segundo) para armar grillas de navegación. En un hosting chico (Render gratis, 0,1 CPU)
// conviene SF_NAV_MS=2: los bots tardan un poco más en encontrar caminos pero no frenan la partida.
const NAV_MS = Math.max(0.5, Number(process.env.SF_NAV_MS) || 6);
const RANGO_AGARRAR = 2.6;  // el servidor acepta hasta 4.2 (PICKUP_RANGE + 1)
const VISTA_ALTURA = 1.6;   // ojos
const PECHO = 1.15;

// Qué cambia con la dificultad.
export const DIFICULTAD = {
  facil: {
    vista: 45, reaccion: [0.9, 1.4], punteria: 0.2, cabeza: 0.04, giro: 3.2, piensa: 0.45, pausaDisparo: 0.7,
    construye: 0.12, esperaConstruir: 7, rompe: false, salta: 0.05, esquiva: 0.35, rafaga: [2, 4], cura: 55, persigue: 0,
  },
  normal: {
    vista: 70, reaccion: [0.5, 0.8], punteria: 0.36, cabeza: 0.1, giro: 6, piensa: 0.3, pausaDisparo: 0.3,
    construye: 0.45, esperaConstruir: 3.5, rompe: true, salta: 0.2, esquiva: 0.7, rafaga: [3, 7], cura: 70, persigue: 5,
  },
  dificil: {
    vista: 100, reaccion: [0.22, 0.4], punteria: 0.52, cabeza: 0.2, giro: 10, piensa: 0.18, pausaDisparo: 0.08,
    construye: 0.85, esperaConstruir: 1.8, rompe: true, salta: 0.4, esquiva: 1, rafaga: [5, 10], cura: 80, persigue: 9,
  },
};

// Cómo se usa cada arma: distancia que busca, hasta dónde pega bien y prioridad según la distancia.
const ARMAS = {
  pistola: { quiere: 14, efectiva: 60, apunta: true },
  subfusil: { quiere: 10, efectiva: 40, apunta: false },
  rifle: { quiere: 24, efectiva: 110, apunta: true },
  escopeta: { quiere: 4, efectiva: 20, apunta: false },
  francotirador: { quiere: 70, efectiva: 450, apunta: true },
  lanzacohetes: { quiere: 28, efectiva: 120, apunta: true },
};
function puntajeArma(w, d) {
  switch (w) {
    case 'escopeta': return d < 9 ? 10 : d < 18 ? 6 : 0.5;
    case 'subfusil': return d < 18 ? 8 : d < 40 ? 6 : 2;
    case 'rifle': return d < 12 ? 6 : d < 90 ? 8.5 : 5;
    case 'pistola': return d < 35 ? 5 : 2.5;
    case 'francotirador': return d > 45 ? 9.5 : d > 22 ? 5 : 0.8;
    case 'lanzacohetes': return d > 12 && d < 90 ? 7 : 0;
    default: return 0;
  }
}

const NOMBRES = ['Tero', 'Carpincho', 'Hornero', 'Yaguareté', 'Ñandú', 'Puma', 'Zorro', 'Vizcacha', 'Cóndor', 'Mulita',
  'Quirquincho', 'Coatí', 'Guanaco', 'Lechuza', 'Benteveo', 'Chajá', 'Surubí', 'Dorado', 'Tatú', 'Aguará', 'Pecarí',
  'Tapir', 'Halcón', 'Calandria', 'Zorzal', 'Carancho', 'Biguá', 'Martineta'];

const azar = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const suave = (cur, obj, k, dt) => cur + (obj - cur) * Math.min(1, dt * k);
const angulo = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const yawHacia = (dx, dz) => Math.atan2(-dx, -dz); // el personaje mira a -Z con yaw 0 (igual que main.js)
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const P = (arr) => ({ x: arr[0], y: arr[1], z: arr[2] });

// ---------- Crear los bots de una partida ----------
export function nombresBots(n, usados) {
  const libres = NOMBRES.filter((x) => !usados.has('Bot ' + x)).sort(() => Math.random() - 0.5);
  return Array.from({ length: n }, (_, k) => 'Bot ' + (libres[k] || `${NOMBRES[k % NOMBRES.length]} ${k + 1}`));
}

// Datos de jugador de un bot (server.js lo completa con id, color y lo que pone resetPlayer).
export function nuevoBot(dif) {
  return { ws: null, bot: { dif: BOT_DIFICULTADES[dif] ? dif : 'normal' } };
}

// Al empezar la partida (con el bus y el mundo ya armados): a dónde va a caer cada bot y cuándo salta.
export function prepararBots(room) {
  room.nav = new Navegacion(room.world);
  room.botTick = 0;
  const bots = [...room.players.values()].filter((p) => p.bot);
  const b = room.bus;
  const A = { x: b.from[0], z: b.from[2] }, B = { x: b.to[0], z: b.to[2] };
  const L = Math.hypot(B.x - A.x, B.z - A.z), ux = (B.x - A.x) / L, uz = (B.z - A.z) / L;
  const cofres = room.world.chestSpots.map((c, idx) => ({ ...c, idx }));
  const elegidos = [];
  for (const p of bots) {
    const D = DIFICULTAD[p.bot.dif];
    // lugares con cofre a los que se llega planeando desde el bus, sin amontonarse con los otros bots
    let mejor = null, mp = -Infinity;
    for (let k = 0; k < 40; k++) {
      const c = cofres[Math.floor(Math.random() * cofres.length)];
      const t = (c.x - A.x) * ux + (c.z - A.z) * uz;
      const lateral = Math.abs((c.x - A.x) * uz - (c.z - A.z) * ux);
      if (t < L * 0.08 || t > L * 0.92 || lateral > 300) continue;
      const cerca = elegidos.filter((e) => Math.hypot(e.x - c.x, e.z - c.z) < 45).length;
      const puntos = -cerca * 3 - lateral / 150 + Math.random() * 1.5;
      if (puntos > mp) { mp = puntos; mejor = { c, t }; }
    }
    if (!mejor) {
      const t = L * azar(0.2, 0.8);
      mejor = { c: { x: A.x + ux * t, z: A.z + uz * t, y: 0 }, t };
    }
    elegidos.push(mejor.c);
    // salta un poco antes de pasar por encima, para llegar planeando
    const lateral = Math.abs((mejor.c.x - A.x) * uz - (mejor.c.z - A.z) * ux);
    const adelanto = Math.max(0, lateral * 0.25 - 20) + azar(0, 30) * (p.bot.dif === 'facil' ? 2 : 1);
    const k = clamp((mejor.t - adelanto) / L, 0.03, 0.97);
    Object.assign(p.bot, {
      D, destino: { x: mejor.c.x, y: mejor.c.y, z: mejor.c.z }, saltoEn: b.start + k * b.duration + azar(0, 400),
      enBus: true, p: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, onGround: false,
      caida: 0, giro: 0, freno: 0, sel: -1, apunta: false, baile: 0,
      meta: null, ruta: null, piensaEn: 0, miraEn: 0, enemigo: null, amenaza: null, ignorar: new Map(),
      atasco: { t: 0, x: 0, z: 0, n: 0 }, recarga: 0, cambio: 0, disparoEn: 0, rafaga: 0, usando: null,
      construyeEn: 0, lado: Math.random() < 0.5 ? 1 : -1, ladoEn: 0, salta: false, pico: 0,
    });
  }
}

// SF_BOTS_DEBUG=1 npm start muestra en la consola qué está haciendo cada bot (cada 10 s).
const DEBUG = !!(globalThis.process?.env?.SF_BOTS_DEBUG);
function mostrar(room, now) {
  for (const p of room.players.values()) {
    if (!p.bot?.D || !p.alive) continue;
    const B = p.bot, m = B.meta;
    const armas = p.slots.filter((s) => s?.kind === 'weapon').map((s) => s.w).join('+') || '-';
    console.log(`[bot] ${p.name.padEnd(16)} ${p.state.padEnd(7)} (${B.p.x.toFixed(0)}, ${B.p.y.toFixed(1)}, ${B.p.z.toFixed(0)}) hp ${Math.ceil(p.hp)}/${Math.ceil(p.shield)} ` +
      `meta ${m ? `${m.clave} a ${dist2(B.p, m.punto).toFixed(0)} m` : '-'} ruta ${B.ruta?.pts ? `${B.ruta.i}/${B.ruta.pts.length}` : '-'} ` +
      `enemigo ${B.enemigo ? `${B.enemigo.id}${B.enemigo.libre ? ' a la vista' : ''}` : '-'} atasco ${B.atasco.n} armas ${armas} mats ${p.mats.madera + p.mats.piedra + p.mats.metal}${B.usando ? ' curándose' : ''}`);
  }
}

// ---------- Cada cuadro ----------
// ctx: { now, dt, handleGame(room, p, msg), broadcast(room, msg), stormAt(storm, now), busPos(room, now) }
export function actualizarBots(room, ctx) {
  if (!room.nav) return;
  room.nav.trabajar(NAV_MS); // grillas de navegación pendientes, de a poco
  room.rutasTick = 0;
  room.botTick = (room.botTick || 0) + 1;
  const avisar = room.botTick % 2 === 0; // estado a los clientes a 10 Hz
  if (DEBUG && ctx.now - (room.debugEn || 0) > 10000) { room.debugEn = ctx.now; mostrar(room, ctx.now); }
  for (const p of room.players.values()) {
    if (!p.bot || !p.bot.D || !p.alive) continue;
    try {
      actualizar(room, p, ctx);
    } catch (e) {
      console.error('bot', p.name, e);
    }
    if (avisar && p.alive && p.state !== 'bus') avisarEstado(room, p, ctx);
  }
}

function actualizar(room, p, ctx) {
  const B = p.bot, now = ctx.now, dt = ctx.dt;
  if (p.state === 'bus') {
    const bp = ctx.busPos(room, now);
    p.pos = [bp.x, bp.y, bp.z];
    if (room.phase === 'playing' && now >= B.saltoEn) ctx.handleGame(room, p, { t: 'jump' });
    if (p.state === 'bus') return;
  }
  if (B.enBus) {
    // recién salido del bus (por su cuenta o porque el bus terminó la ruta): arranca donde lo ven los clientes
    const bp = ctx.busPos(room, now);
    B.enBus = false;
    B.p = { x: bp.x, y: bp.y - 3, z: bp.z };
    B.vel = { x: 0, y: 0, z: 0 };
    B.yaw = yawHacia(B.destino.x - bp.x, B.destino.z - bp.z);
    p.state = 'falling';
  }
  if (p.state === 'falling' || p.state === 'glider') aire(room, p, dt);
  else if (p.state === 'ground') piso(room, p, ctx);
  p.pos = [B.p.x, B.p.y, B.p.z];
}

// ---------- En el aire: caída libre y paracaídas (como caida.js) ----------
function aire(room, p, dt) {
  const B = p.bot, w = room.world;
  const suelo = Math.max(w.groundHeight(B.p.x, B.p.z, B.p.y), AGUA);
  const alt = B.p.y - suelo;
  const dx = B.destino.x - B.p.x, dz = B.destino.z - B.p.z, dh = Math.hypot(dx, dz) || 1;
  const yawObj = yawHacia(dx, dz);
  const dyaw = angulo(yawObj - B.yaw);
  B.yaw += clamp(dyaw, -2.5 * dt, 2.5 * dt);
  B.giro = suave(B.giro, clamp(dyaw * 1.5, -1, 1), 4, dt);
  const fx = -Math.sin(B.yaw), fz = -Math.cos(B.yaw);
  if (p.state === 'falling') {
    // planear mientras quede lejos, picada cuando ya está encima
    const tPlaneo = (alt - PARACAIDAS.LIMITE) / CAIDA.V[0], tLlegar = dh / CAIDA.H[0];
    const obj = dh < 35 ? 1 : tLlegar > tPlaneo * 0.85 ? -1 : 0;
    B.caida = suave(B.caida, obj, CAIDA.CAMBIO, dt);
    const c = B.caida;
    const v = c < 0 ? CAIDA.V[1] + (CAIDA.V[0] - CAIDA.V[1]) * -c : CAIDA.V[1] + (CAIDA.V[2] - CAIDA.V[1]) * c;
    const h = Math.min(dh / 1.5, c < 0 ? CAIDA.H[1] + (CAIDA.H[0] - CAIDA.H[1]) * -c : CAIDA.H[1] + (CAIDA.H[2] - CAIDA.H[1]) * c);
    B.vel.y = suave(B.vel.y, -v, CAIDA.RESP_V, dt);
    B.vel.x = suave(B.vel.x, fx * h, CAIDA.RESP_H, dt);
    B.vel.z = suave(B.vel.z, fz * h, CAIDA.RESP_H, dt);
    if (alt < PARACAIDAS.LIMITE) { p.state = 'glider'; B.caida = 0; }
  } else {
    const frena = dh < 6;
    B.freno = suave(B.freno, frena ? 1 : 0, 3, dt);
    B.caida = suave(B.caida, 0, 2, dt);
    const h = frena ? PARACAIDAS.H_FRENO : dh > 12 ? PARACAIDAS.H_ADELANTE : PARACAIDAS.H;
    const v = frena ? PARACAIDAS.V_FRENO : dh > 12 ? PARACAIDAS.V_ADELANTE : PARACAIDAS.V;
    const hh = Math.min(h, dh / 0.8);
    B.vel.y = suave(B.vel.y, -v, PARACAIDAS.RESP_V, dt);
    B.vel.x = suave(B.vel.x, fx * hh, PARACAIDAS.RESP_H * 2, dt);
    B.vel.z = suave(B.vel.z, fz * hh, PARACAIDAS.RESP_H * 2, dt);
  }
  w.moveBody(B.p, B.vel, dt, RADIO);
  const g = Math.max(w.groundHeight(B.p.x, B.p.z, B.p.y), AGUA);
  if (B.p.y <= g + 0.02) {
    B.p.y = g; B.vel.y = 0; B.onGround = true;
    p.state = 'ground';
    B.caida = 0; B.giro = 0; B.freno = 0;
    B.piensaEn = 0;
  }
}

// ---------- En el piso ----------
function piso(room, p, ctx) {
  const B = p.bot, D = B.D, now = ctx.now, dt = ctx.dt;
  B.giro = suave(B.giro, 0, 4, dt); B.freno = suave(B.freno, 0, 4, dt);
  if (now >= B.miraEn) { B.miraEn = now + 250; percibir(room, p, now); }
  if (now >= B.piensaEn) { B.piensaEn = now + D.piensa * 1000 * azar(0.8, 1.3); pensar(room, p, ctx); }

  // terminar lo que lleva tiempo
  if (B.usando && now >= B.usando.fin) { ctx.handleGame(room, p, { t: 'useEnd' }); B.usando = null; }
  if (B.recarga && now >= B.recarga) B.recarga = 0;

  let dir = null, rapido = true;
  B.apunta = false;
  B.salta = false;
  B.fino = false;
  const enemigo = B.enemigo && room.players.get(B.enemigo.id);
  if (enemigo && enemigo.alive && now - B.enemigo.visto < 3000) {
    dir = combate(room, p, enemigo, ctx);
    rapido = !B.apunta;
  } else {
    if (B.enemigo && (!enemigo || !enemigo.alive || now - B.enemigo.visto > 3000 + D.persigue * 1000)) B.enemigo = null;
    if (B.usando) dir = null;
    else if (B.meta) dir = seguirMeta(room, p, ctx);
    if (!B.usando && !B.meta && B.enemigo && D.persigue) {
      // se le perdió de vista: va a buscarlo donde lo vio por última vez
      dir = irA(room, p, B.enemigo.donde, ctx, 'busca');
    }
    const it = p.slots[B.sel];
    // a la espera: con el arma en la mano, recarga si le faltan balas
    if (!B.usando && it?.kind === 'weapon' && it.mag < WEAPONS[it.w].mag * 0.5) recargar(room, p, ctx);
  }

  // moverse (misma física que main.js)
  const w = room.world;
  const suelo = w.groundHeight(B.p.x, B.p.z, B.p.y);
  const nadando = suelo < AGUA;
  let vel = nadando ? NADANDO : B.apunta ? APUNTANDO : B.fino ? 4.5 : rapido ? CORRER : CAMINAR;
  if (B.usando) vel *= 0.5;
  if (B.baile > now) dir = null;
  const ix = dir ? dir.x : 0, iz = dir ? dir.z : 0;
  const acel = B.onGround || nadando ? (B.fino ? 22 : 12) : 3;
  B.vel.x += (ix * vel - B.vel.x) * Math.min(1, dt * acel);
  B.vel.z += (iz * vel - B.vel.z) * Math.min(1, dt * acel);
  if (B.salta && B.onGround && !nadando) { B.vel.y = SALTO; B.onGround = false; }
  B.vel.y -= GRAVEDAD * dt;
  w.moveBody(B.p, B.vel, dt, RADIO);
  const lim = w.size * 0.75;
  B.p.x = clamp(B.p.x, -lim, lim); B.p.z = clamp(B.p.z, -lim, lim);
  const g = Math.max(w.groundHeight(B.p.x, B.p.z, B.p.y), AGUA);
  if (B.p.y <= g) { B.p.y = g; if (B.vel.y < 0) B.vel.y = 0; B.onGround = true; }
  else if (B.p.y - g < 0.3 && B.vel.y <= 0) { B.p.y = g; B.vel.y = 0; B.onGround = true; }
  else B.onGround = false;
  // hacia dónde mira: al enemigo (lo maneja combate) o hacia donde camina
  if (!enemigo && dir && (dir.x || dir.z)) B.yaw += clamp(angulo(yawHacia(dir.x, dir.z) - B.yaw), -8 * dt, 8 * dt);
  vigilarAtasco(room, p, ctx, dir);
}

// ---------- Ver ----------
function percibir(room, p, now) {
  const B = p.bot, D = B.D;
  const ojo = { x: B.p.x, y: B.p.y + VISTA_ALTURA, z: B.p.z };
  const fx = -Math.sin(B.yaw), fz = -Math.cos(B.yaw);
  const cand = [];
  for (const q of room.players.values()) {
    if (q === p || !q.alive || !['ground', 'auto', 'glider'].includes(q.state)) continue;
    if (q.state === 'glider' && p.bot.dif !== 'dificil') continue;
    const Q = P(q.pos);
    const d = dist3(ojo, Q);
    const atacante = B.amenaza && B.amenaza.id === q.id && now - B.amenaza.t < 4000;
    if (d > D.vista * (atacante ? 1.5 : 1)) continue;
    // adelante (unos 220°) o muy cerca, o el que le está tirando
    const frente = ((Q.x - ojo.x) * fx + (Q.z - ojo.z) * fz) / (d || 1);
    if (frente < -0.35 && d > 12 && !atacante) continue;
    cand.push({ q, d: d - (atacante ? 30 : 0) - (B.enemigo?.id === q.id ? 15 : 0) });
  }
  cand.sort((a, b) => a.d - b.d);
  for (const { q } of cand.slice(0, 3)) {
    const Q = P(q.pos);
    const v = vista(room, p, ojo, { x: Q.x, y: Q.y + PECHO, z: Q.z });
    if (v.libre || (v.struct && B.enemigo?.id === q.id)) {
      if (!B.enemigo || B.enemigo.id !== q.id) B.enemigo = { id: q.id, desde: now, reaccion: azar(...D.reaccion) * 1000 };
      B.enemigo.visto = now;
      B.enemigo.donde = { ...Q };
      B.enemigo.libre = v.libre;
      B.enemigo.tapa = v.libre ? null : v.struct;
      if (B.usando) { B.usando = null; }
      return;
    }
  }
  if (B.enemigo) B.enemigo.libre = false;
}

// Rayo de vista del ojo a un punto: lo cortan el terreno, las paredes del mapa (no los vidrios), los árboles y las
// construcciones. struct = clave de la construcción de otro jugador que tapa (para romperla).
function vista(room, p, a, b) {
  const w = room.world;
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz) || 1;
  const d = { x: dx / L, y: dy / L, z: dz / L };
  let corte = L - 0.3;
  if (w.rayTerrain(a, d, corte) < corte) return { libre: false };
  // sólidos del mapa
  let tapa = false;
  const pasos = Math.ceil(L / 4);
  w.sol.stamp++;
  const st = w.sol.stamp;
  for (let k = 0; k <= pasos && !tapa; k++) {
    const t = Math.min(L, k * 4);
    w.sol.near(a.x + d.x * t, a.z + d.z * t, 4, (s) => {
      if (tapa || s.vidrio || s.dead || s.mk2 === st) return;
      s.mk2 = st;
      const tt = rayoCaja(a, d, s.x0, s.y0, s.z0, s.x1, s.y1, s.z1);
      if (tt < corte) tapa = true;
    });
  }
  if (tapa) return { libre: false };
  // árboles y rocas
  for (const c of w.circles) {
    if (Math.abs(c.x - a.x) > L + 3 && Math.abs(c.x - b.x) > L + 3) continue;
    const ox = c.x - a.x, oz = c.z - a.z, h2 = d.x * d.x + d.z * d.z || 1e-9;
    const t = clamp((ox * d.x + oz * d.z) / h2, 0, corte);
    const px = a.x + d.x * t, pz = a.z + d.z * t, py = a.y + d.y * t;
    if (py < c.bottom || py > c.top) continue;
    if (Math.hypot(px - c.x, pz - c.z) < c.r * 0.9) return { libre: false };
  }
  // construcciones de los jugadores
  let struct = null, ts = corte;
  for (const s of w.structs.values()) {
    const cx = s.i * GRID + GRID / 2, cz = s.j * GRID + GRID / 2;
    if (Math.hypot(cx - (a.x + b.x) / 2, cz - (a.z + b.z) / 2) > L / 2 + GRID * 1.5) continue;
    let t = Infinity;
    if (s.type === 'pared') for (const bx of s.boxes || []) t = Math.min(t, rayoCaja(a, d, bx.minX, bx.minY, bx.minZ, bx.maxX, bx.maxY, bx.maxZ));
    else { const c = s.caja || (s.caja = cajaPieza(s)); t = rayoCaja(a, d, c.x0, c.y0, c.z0, c.x1, c.y1, c.z1); }
    if (t < ts) { ts = t; struct = s; }
  }
  if (struct) return { libre: false, struct: struct.owner !== p.id ? struct.key : null, propia: struct.owner === p.id };
  return { libre: true };
}

function rayoCaja(o, d, x0, y0, z0, x1, y1, z1) {
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

// ---------- Pensar: qué hacer cuando no está peleando ----------
function pensar(room, p, ctx) {
  const B = p.bot, D = B.D, now = ctx.now;
  for (const [k, t] of B.ignorar) if (now > t) B.ignorar.delete(k);
  elegirArma(p, B.enemigo ? dist2(B.p, B.enemigo.donde) : 30, now);
  if (B.enemigo && now - B.enemigo.visto < 3000) return; // peleando: lo maneja combate()

  // 1) la tormenta manda
  const zona = zonaSegura(room, ctx, now);
  const dz = Math.hypot(B.p.x - zona.x, B.p.z - zona.z);
  if (zona.urgente && dz > zona.r * 0.8) {
    if (B.meta?.tipo !== 'zona') B.meta = { tipo: 'zona', punto: puntoEnZona(B.p, zona) };
    return;
  }
  // 2) curarse si está tranquilo
  if (!B.usando && (!B.enemigo || now - B.enemigo.visto > 4000) && curarse(room, p, ctx)) return;
  if (B.usando) return;
  // 3) loot o un cofre que valga la pena (dentro de la zona); si ya tiene arma y le faltan materiales para
  // construir, antes junta madera (salvo que lo que haya cerca valga mucho)
  const lo = mejorLoot(room, p, zona);
  const mats = p.mats.madera + p.mats.piedra + p.mats.metal;
  const armado = p.slots.some((s) => s?.kind === 'weapon');
  if (D.construye > 0.2 && armado && (mats < 40 || (!lo && mats < 120)) && (!lo || lo.v < 0.2)) {
    const a = arbolCerca(room, p, 35);
    if (a) { if (B.meta?.clave !== a.clave && B.meta?.tipo !== 'arbol') B.meta = a; return; }
  }
  if (lo) { if (B.meta?.clave !== lo.clave) B.meta = lo; return; }
  // 5) seguir lo que estaba haciendo, o ir a otro lugar con cofres dentro de la zona
  if (B.meta && B.meta.tipo !== 'zona') return;
  if (B.meta?.tipo === 'zona' && dz > zona.r * 0.6) return;
  B.meta = pasear(room, p, zona);
}

// Círculo al que hay que llegar: el próximo de la tormenta. urgente: si hay que salir ya.
function zonaSegura(room, ctx, now) {
  const st = room.storm, t = (now - st.start) / 1000;
  const ahora = ctx.stormAt(st, now);
  const ph = st.phases;
  let prox = null;
  for (const f of ph) if (f.t > t && f.r < ahora.r - 0.5) { prox = f; break; }
  if (!prox) return { x: ahora.x, z: ahora.z, r: Math.max(5, ahora.r), urgente: true };
  // cuándo empieza a achicarse hacia ese círculo
  let empieza = prox.t;
  for (let i = ph.indexOf(prox); i > 0; i--) { if (ph[i - 1].r > prox.r + 0.5) { empieza = ph[i - 1].t; break; } }
  return { x: prox.x, z: prox.z, r: prox.r, urgente: empieza - t < 35, actual: ahora };
}
function puntoEnZona(p, z) {
  const a = Math.atan2(p.z - z.z, p.x - z.x) + azar(-0.6, 0.6);
  const r = z.r * azar(0.2, 0.55);
  return { x: z.x + Math.cos(a) * r, y: 0, z: z.z + Math.sin(a) * r };
}

// Lo más útil para agarrar cerca: { tipo: 'item' | 'cofre', clave, punto, id | idx }
function mejorLoot(room, p, zona) {
  const B = p.bot;
  const armas = p.slots.filter((s) => s?.kind === 'weapon');
  const libres = p.slots.filter((s) => !s).length;
  const peor = armas.length ? Math.min(...armas.map(valorArma)) : 0;
  const tiene = new Set(armas.map((s) => WEAPONS[s.w].ammo));
  let mejor = null, mv = 0;
  const considerar = (punto, valor, meta) => {
    const d = dist3(B.p, punto);
    if (d > (armas.length ? 50 : 90) || Math.abs(punto.y - B.p.y) > 14 || B.ignorar.has(meta.clave)) return;
    if (zona.urgente && Math.hypot(punto.x - zona.x, punto.z - zona.z) > zona.r) return;
    const v = valor / (d + 6);
    if (v > mv) { mv = v; mejor = { ...meta, punto, v }; }
  };
  for (const it of room.items.values()) {
    let v = 0;
    if (it.kind === 'weapon') {
      const va = valorArma(it);
      if (!armas.length) v = 12;
      else if (libres > 1 && !armas.some((s) => s.w === it.w)) v = 7;
      else if (libres > 0 && va > peor) v = 5;
      else if (va > peor + 1.5) v = 4;
      v += it.rarity * 0.4;
    } else if (it.kind === 'ammo') {
      if (tiene.has(it.a) && p.ammo[it.a] < AMMO[it.a].max * 0.6) v = p.ammo[it.a] < 20 ? 6 : 3;
    } else if (it.kind === 'consumable') {
      const def = CONSUMABLES[it.c];
      const lugar = libres > 0 || p.slots.some((s) => s?.kind === 'consumable' && s.c === it.c && s.count < def.stack);
      if (lugar) v = def.shield ? (p.shield < def.max ? 5 : 2) : p.hp < def.max ? 5 : 1.5;
    } else if (it.kind === 'mat') {
      if (p.mats[it.m] < 300) v = 2;
    }
    if (v > 0) considerar({ x: it.x, y: it.y, z: it.z }, v, { tipo: 'item', clave: 'i' + it.id, id: it.id });
  }
  room.chests.forEach((c, idx) => {
    if (!c.open) considerar({ x: c.x, y: c.y, z: c.z }, armas.length < 2 ? 11 : 6, { tipo: 'cofre', clave: 'c' + idx, idx });
  });
  return mejor;
}
const valorArma = (it) => it.rarity * 1.2 + ({ rifle: 3, escopeta: 3, subfusil: 2, francotirador: 2.2, pistola: 0.5, lanzacohetes: 1.5 }[it.w] || 0);

function arbolCerca(room, p, max) {
  const B = p.bot, w = room.world;
  let mejor = null, md = max;
  w.trees.forEach((t, idx) => {
    if (!t.alive || room.trees[idx] <= 0) return;
    const d = Math.hypot(t.x - B.p.x, t.z - B.p.z);
    if (d < md && !B.ignorar.has('a' + idx)) { md = d; mejor = { tipo: 'arbol', clave: 'a' + idx, idx, punto: { x: t.x, y: t.y, z: t.z }, r: t.circle.r } };
  });
  return mejor;
}

// Otro lugar para lootear: un cofre cerrado dentro de la zona, a una distancia razonable.
function pasear(room, p, zona) {
  const B = p.bot;
  let mejor = null, mp = -Infinity;
  for (let k = 0; k < 25; k++) {
    const idx = Math.floor(Math.random() * room.chests.length);
    const c = room.chests[idx];
    if (c.open) continue;
    if (Math.hypot(c.x - zona.x, c.z - zona.z) > zona.r * 0.85) continue;
    const d = dist2(B.p, c);
    const pts = -Math.abs(d - 120) / 60 + Math.random();
    if (pts > mp) { mp = pts; mejor = { tipo: 'cofre', clave: 'c' + idx, idx, punto: { x: c.x, y: c.y, z: c.z } }; }
  }
  return mejor || { tipo: 'zona', punto: puntoEnZona(B.p, zona) };
}

// ---------- Ir a la meta ----------
function seguirMeta(room, p, ctx) {
  const B = p.bot, m = B.meta, now = ctx.now;
  if (m.tipo === 'item') {
    const it = room.items.get(m.id);
    if (!it) { B.meta = null; return null; }
    if (dist2(B.p, it) < RANGO_AGARRAR && Math.abs(it.y - B.p.y) < 1.6) {
      const slot = peorSlot(p, it);
      ctx.handleGame(room, p, { t: 'pickup', id: it.id, slot });
      if (room.items.has(m.id) && room.items.get(m.id) === it) B.ignorar.set(m.clave, now + 30000);
      B.meta = null; B.piensaEn = 0;
      return null;
    }
    return irA(room, p, m.punto, ctx, m.clave);
  }
  if (m.tipo === 'cofre') {
    const c = room.chests[m.idx];
    if (!c || c.open) { B.meta = null; B.piensaEn = 0; return null; }
    if (dist2(B.p, c) < RANGO_AGARRAR - 0.3 && Math.abs(c.y - B.p.y) < 1.6) {
      ctx.handleGame(room, p, { t: 'chest', idx: m.idx });
      if (!c.open) B.ignorar.set(m.clave, now + 30000);
      B.meta = null; B.piensaEn = now + 400;
      return null;
    }
    return irA(room, p, m.punto, ctx, m.clave);
  }
  if (m.tipo === 'arbol') {
    const t = room.world.trees[m.idx];
    if (!t || !t.alive || room.trees[m.idx] <= 0) { B.meta = null; return null; }
    const d = Math.hypot(t.x - B.p.x, t.z - B.p.z);
    if (d < m.r + 1.6) {
      B.sel = -1;
      B.yaw += clamp(angulo(yawHacia(t.x - B.p.x, t.z - B.p.z) - B.yaw), -0.5, 0.5);
      if (now - (p.lastSwing || 0) > PICKAXE.cooldown * 1000 + 60) ctx.handleGame(room, p, { t: 'swing', res: 'tree', idx: m.idx });
      if (p.mats.madera + p.mats.piedra + p.mats.metal >= 150) { B.meta = null; B.piensaEn = 0; }
      return null;
    }
    return irA(room, p, m.punto, ctx, m.clave, m.r + 1);
  }
  if (m.tipo === 'zona') {
    if (dist2(B.p, m.punto) < 4) { B.meta = null; return null; }
    return irA(room, p, m.punto, ctx, 'zona');
  }
  return null;
}

function peorSlot(p, it) {
  if (it.kind !== 'weapon') return 0;
  let k = 0, v = Infinity;
  p.slots.forEach((s, i) => { const x = s?.kind === 'weapon' ? valorArma(s) : s ? 1 : -1; if (x < v) { v = x; k = i; } });
  return k;
}

// Dirección para ir hacia `meta`: con ruta por la grilla cuando está cerca (adentro de casas, escaleras, puertas),
// derecho cuando está lejos. Devuelve un vector horizontal unitario (o null si ya llegó).
function irA(room, p, meta, ctx, clave, cerca = 0.6) {
  const B = p.bot;
  const d = dist2(B.p, meta);
  if (d < cerca && Math.abs(meta.y - B.p.y) < 1.5) return null;
  if (!B.ruta || B.ruta.clave !== clave) B.ruta = { clave, pts: null, i: 0, pedida: 0, fin: null };
  const R = B.ruta;
  // lejos y adentro de algo (una casa, un techo, un piso alto): primero salir afuera por donde se pueda
  if (!R.pts && d >= 26 && ctx.now > R.pedida && adentro(room, B)) {
    R.pedida = ctx.now + 1200;
    const g = room.nav.grilla(B.p.x, B.p.z, 18);
    if (g && (room.rutasTick || 0) < 3) {
      room.rutasTick = (room.rutasTick || 0) + 1;
      const r = room.nav.salida(g, B.p, meta);
      if (r && r.pts.length) { R.pts = [{ x: B.p.x, y: B.p.y, z: B.p.z }, ...r.pts]; R.i = 1; R.pedida = ctx.now + 4000; }
    }
  }
  if (!R.pts && d < 26 && ctx.now > R.pedida) {
    const g = room.nav.grilla(meta.x, meta.z, 20);
    if (g && room.nav.dentro(g, B.p, 1) && (room.rutasTick || 0) < 3) {
      room.rutasTick = (room.rutasTick || 0) + 1;
      const r = room.nav.ruta(g, B.p, meta);
      if (r && r.pts.length) { R.pts = [{ x: B.p.x, y: B.p.y, z: B.p.z }, ...r.pts]; R.i = 1; R.llega = r.llega; }
      else R.pedida = ctx.now + 1500;
      if (r && !r.llega && B.meta && B.meta.clave === clave) B.ignorar.set(clave, ctx.now + 25000);
    }
  }
  let obj = meta;
  if (R.pts) {
    const r = seguirRuta(B, R.pts, R);
    if (!r) {
      // se salió de la ruta (se cayó, lo empujaron): la vuelve a calcular
      R.pts = null; R.pedida = 0;
    } else {
      obj = r.fin && dist2(B.p, meta) < 0.6 ? meta : r.punto;
      // terminó la ruta (de salida, de rodear, o una que no llegaba hasta la meta): de acá se va derecho
      if (r.fin && dist2(B.p, R.pts[R.pts.length - 1]) < 0.6) { R.pts = null; R.pedida = ctx.now + 1500; obj = meta; }
      // en escaleras y pasarelas camina (corriendo se pasa de largo)
      if (r.sube) B.fino = true;
      if (r.punto.y - B.p.y > 0.6 && B.onGround) B.salta = true;
    }
  }
  const dx = obj.x - B.p.x, dz = obj.z - B.p.z, L = Math.hypot(dx, dz);
  if (L < 0.05) return null;
  return { x: dx / L, z: dz / L };
}

// Sigue la ruta como "zanahoria": se proyecta sobre el tramo más cercano y apunta a un punto un poco más adelante
// sobre la línea, así no se corta camino en escaleras angostas. null si quedó lejos de la ruta.
function seguirRuta(B, pts, R) {
  let mejor = null;
  for (let k = Math.max(1, R.i - 1); k < Math.min(pts.length, R.i + 5); k++) {
    const a = pts[k - 1], b = pts[k];
    const ex = b.x - a.x, ez = b.z - a.z, L2 = ex * ex + ez * ez;
    const t = L2 > 1e-6 ? clamp(((B.p.x - a.x) * ex + (B.p.z - a.z) * ez) / L2, 0, 1) : 1;
    const q = { x: a.x + ex * t, y: a.y + (b.y - a.y) * t, z: a.z + ez * t };
    if (Math.abs(q.y - B.p.y) > 1.3 && !(b.y < a.y - 0.6 && B.p.y < a.y + 0.3 && B.p.y > b.y - 0.3)) continue;
    const d = Math.hypot(q.x - B.p.x, q.z - B.p.z);
    if (!mejor || d < mejor.d - 0.02 || (Math.abs(d - mejor.d) <= 0.02 && k > mejor.k)) mejor = { k, d, q };
  }
  if (!mejor || mejor.d > 2.5) return null;
  R.i = mejor.k;
  // la zanahoria: medio metro más adelante por la línea
  let resta = 0.5, k = mejor.k, cur = mejor.q, sube = false;
  while (k < pts.length) {
    const b = pts[k], seg = Math.hypot(b.x - cur.x, b.z - cur.z);
    if (Math.abs(b.y - cur.y) > 0.2) sube = true;
    if (seg >= resta) { const f = resta / seg; cur = { x: cur.x + (b.x - cur.x) * f, y: cur.y + (b.y - cur.y) * f, z: cur.z + (b.z - cur.z) * f }; break; }
    resta -= seg; cur = b; k++;
  }
  // mirar un poco más adelante para saber si viene una escalera
  for (let j = mejor.k; j < Math.min(pts.length, mejor.k + 4) && !sube; j++) if (Math.abs(pts[j].y - B.p.y) > 0.3 && dist2(pts[j], B.p) < 2.5) sube = true;
  return { punto: cur, fin: k >= pts.length, sube };
}

// ¿Está bajo techo o arriba de algo (no parado en el terreno al aire libre)?
function adentro(room, B) {
  const w = room.world;
  const t = Math.max(w.terrainHeight(B.p.x, B.p.z), AGUA);
  return B.p.y > t + 0.6 || w.sol.ceiling(B.p.x, B.p.z, B.p.y) < Infinity;
}

// Si no avanza: salta, después rodea con una ruta, rompe lo que tenga adelante y al final cambia de meta.
function vigilarAtasco(room, p, ctx, dir) {
  const B = p.bot, a = B.atasco, now = ctx.now;
  if (!dir || B.usando) { a.t = now; a.x = B.p.x; a.z = B.p.z; a.n = 0; return; }
  if (now - a.t < 1200) return;
  const movio = Math.hypot(B.p.x - a.x, B.p.z - a.z);
  a.t = now; a.x = B.p.x; a.z = B.p.z;
  if (movio > 1.2) { a.n = 0; return; }
  a.n++;
  if (a.n === 1) B.salta = true;
  if (a.n === 2 || a.n === 4) {
    // rodear: ruta en una grilla alrededor del bot hacia la meta
    const meta = B.meta?.punto || B.enemigo?.donde;
    if (meta) {
      const g = room.nav.grilla(B.p.x, B.p.z, 18);
      if (g) {
        const lejos = dist2(B.p, meta) > 20;
        const r = lejos ? room.nav.salida(g, B.p, meta) || room.nav.ruta(g, B.p, meta) : room.nav.ruta(g, B.p, meta);
        if (r && r.pts.length > 1) B.ruta = { clave: B.ruta?.clave, pts: [{ x: B.p.x, y: B.p.y, z: B.p.z }, ...r.pts], i: 1, pedida: 0 };
      }
    }
  }
  if (a.n === 3) {
    // una construcción adelante: picarla
    const s = construccionAdelante(room, B);
    if (s) { B.sel = -1; ctx.handleGame(room, p, { t: 'swing', key: s.key }); a.n = 2; }
    else B.salta = true;
  }
  if (a.n >= 6) {
    if (B.meta) B.ignorar.set(B.meta.clave, now + 40000);
    B.meta = null; B.ruta = null; a.n = 0; B.piensaEn = 0;
  }
}
function construccionAdelante(room, B) {
  const fx = -Math.sin(B.yaw), fz = -Math.cos(B.yaw);
  const q = { x: B.p.x + fx * 1.2, z: B.p.z + fz * 1.2 };
  for (const s of room.world.structs.values()) {
    const c = s.caja || (s.caja = cajaPieza(s));
    if (q.x > c.x0 - 0.5 && q.x < c.x1 + 0.5 && q.z > c.z0 - 0.5 && q.z < c.z1 + 0.5 && B.p.y + 1 > c.y0 && B.p.y < c.y1) return s;
  }
  return null;
}

// ---------- Armas ----------
function elegirArma(p, d, now) {
  const B = p.bot;
  let mejor = -1, mp = 0, actual = 0;
  p.slots.forEach((s, i) => {
    if (s?.kind !== 'weapon') return;
    const def = WEAPONS[s.w];
    if (s.mag <= 0 && p.ammo[def.ammo] <= 0) return;
    const v = puntajeArma(s.w, d) + s.rarity * 0.3 + (s.mag > 0 ? 0.5 : 0);
    if (i === B.sel) actual = v;
    if (v > mp) { mp = v; mejor = i; }
  });
  // no cambia por poco (cerca de los límites de distancia cambiaría todo el tiempo)
  if (mejor !== B.sel && !B.usando && (actual === 0 || mp > actual + 1)) {
    B.sel = mejor;
    B.cambio = now + 350; // sacar el arma lleva un momento
    B.recarga = 0;
  }
}

function recargar(room, p, ctx) {
  const B = p.bot, it = p.slots[B.sel];
  if (!it || it.kind !== 'weapon' || B.recarga || B.usando) return;
  const def = WEAPONS[it.w];
  if (it.mag >= def.mag || p.ammo[def.ammo] <= 0) return;
  ctx.handleGame(room, p, { t: 'reload', slot: B.sel });
  B.recarga = ctx.now + weaponReload(it) * 1000;
}

// ---------- Pelear ----------
function combate(room, p, e, ctx) {
  const B = p.bot, D = B.D, now = ctx.now, dt = ctx.dt;
  const E = P(e.pos);
  const dx = E.x - B.p.x, dz = E.z - B.p.z, d = Math.hypot(dx, dz) || 1;
  // girar hacia el enemigo
  const err = angulo(yawHacia(dx, dz) - B.yaw);
  B.yaw += clamp(err, -D.giro * dt, D.giro * dt);
  if (B.usando) { ctx.handleGame(room, p, { t: 'useCancel' }); B.usando = null; }
  const it = p.slots[B.sel];
  const def = it?.kind === 'weapon' ? WEAPONS[it.w] : null;
  const uso = def ? ARMAS[it.w] : null;
  const ux = dx / d, uz = dz / d;

  // sin arma: pico si está encima, si no escaparse
  if (!def) {
    if (d < 2.4 && now - (p.lastSwing || 0) > PICKAXE.cooldown * 1000 + 60 && Math.abs(err) < 0.6) ctx.handleGame(room, p, { t: 'swing', pid: e.id });
    if (p.slots.some((s) => s?.kind === 'weapon')) elegirArma(p, d, now);
    return d < 14 ? { x: ux, z: uz } : seguirMeta2(room, p, ctx, ux, uz);
  }
  B.apunta = uso.apunta && d > 10 && B.enemigo.libre;
  // moverse: acercarse o alejarse a su distancia y esquivar de costado
  if (now > B.ladoEn) { B.lado = Math.random() < 0.5 ? 1 : -1; B.ladoEn = now + azar(700, 1900); }
  let mx = 0, mz = 0;
  if (!B.enemigo.libre && d < 60) { const r = irA(room, p, E, ctx, 'pelea' + e.id, 3); if (r) { mx = r.x; mz = r.z; } }
  else if (d > uso.quiere + 6) { mx = ux; mz = uz; }
  else if (d < uso.quiere - 4) { mx = -ux * 0.8; mz = -uz * 0.8; }
  const esq = D.esquiva * (it.w === 'francotirador' ? 0.3 : 1);
  mx += -uz * B.lado * esq; mz += ux * B.lado * esq;
  const L = Math.hypot(mx, mz);
  if (Math.random() < D.salta * dt && B.onGround) B.salta = true;
  // se cubre si le pegan (lo marca alRecibirDanio)
  if (B.cubrirse) { cubrirse(room, p, E, ctx); B.cubrirse = false; }

  // tirar
  if (B.recarga || now < B.cambio) return L > 0.05 ? { x: mx / L, z: mz / L } : null;
  if (it.mag <= 0) { recargar(room, p, ctx); return L > 0.05 ? { x: mx / L, z: mz / L } : null; }
  const listo = now - B.enemigo.desde > B.enemigo.reaccion && Math.abs(err) < (d < 6 ? 0.5 : 0.18) && now >= B.disparoEn;
  if (listo && d < def.range) {
    if (B.enemigo.libre) disparar(room, p, e, E, d, it, def, ctx);
    else if (B.enemigo.tapa && D.rompe && d < 45) dispararA(room, p, B.enemigo.tapa, it, def, ctx);
  }
  return L > 0.05 ? { x: mx / L, z: mz / L } : null;
}
// sin arma y con un enemigo lejos: seguir buscando loot (alejándose)
function seguirMeta2(room, p, ctx, ux, uz) {
  const B = p.bot;
  if (!B.meta) { const lo = mejorLoot(room, p, { x: 0, z: 0, r: 1e9 }); if (lo) B.meta = lo; }
  if (B.meta) { const r = seguirMeta(room, p, ctx); if (r) return r; }
  return { x: -ux, z: -uz };
}

function disparar(room, p, e, E, d, it, def, ctx) {
  const B = p.bot, D = B.D, now = ctx.now;
  const uso = ARMAS[it.w];
  // puntería: dificultad, distancia, si alguno se mueve, si está en el aire
  const ve = e.bot?.vel ? Math.hypot(e.bot.vel.x, e.bot.vel.z) : e.velEst || 0;
  let pr = D.punteria * clamp(1.15 - d / uso.efectiva, 0.1, 1);
  if (ve > 4) pr *= 0.72;
  if (Math.hypot(B.vel.x, B.vel.z) > 4 && !B.apunta) pr *= 0.85;
  if (e.state === 'glider') pr *= 0.55;
  if (!B.onGround) pr *= 0.7;
  if (now - B.enemigo.desde < B.enemigo.reaccion + 400) pr *= 1.15; // primer tiro con calma
  const fx = -Math.sin(B.yaw), fz = -Math.cos(B.yaw);
  const from = [+(B.p.x + fx * 0.7).toFixed(2), +(B.p.y + 1.45).toFixed(2), +(B.p.z + fz * 0.7).toFixed(2)];
  let to, hits = [];
  if (def.rocket) {
    if (d < 9) return;
    const err = (1 - pr) * 4;
    to = [E.x + azar(-err, err), E.y + 0.3, E.z + azar(-err, err)];
  } else if (def.pellets > 1) {
    const pp = clamp(D.punteria * 1.7 * clamp(1.1 - d / uso.efectiva, 0, 1), 0, 0.95);
    let n = 0;
    for (let k = 0; k < def.pellets; k++) if (Math.random() < pp) n++;
    if (n) hits.push({ pid: e.id, n, head: Math.random() < D.cabeza * 0.6 });
    to = [E.x + (n ? 0 : azar(-1.5, 1.5)), E.y + 1.1, E.z + (n ? 0 : azar(-1.5, 1.5))];
  } else {
    const pega = Math.random() < pr;
    const head = pega && Math.random() < D.cabeza * (it.w === 'francotirador' ? 1.6 : 1);
    if (pega) hits.push({ pid: e.id, n: 1, head });
    const m = pega ? 0 : azar(0.7, 2.2) * (Math.random() < 0.5 ? -1 : 1);
    to = [E.x - fz * m, E.y + (head ? 1.95 : pega ? 1.1 : azar(0.3, 2.4)), E.z + fx * m];
  }
  ctx.handleGame(room, p, { t: 'shoot', slot: B.sel, from, to: to.map((v) => +v.toFixed(2)), hits });
  // cadencia: la del arma más una pausa según la dificultad; las automáticas tiran en ráfagas
  let espera = def.cooldown * 1000 * (1 + D.pausaDisparo);
  if (def.auto) {
    B.rafaga = (B.rafaga || 0) + 1;
    if (B.rafaga >= azar(...D.rafaga)) { B.rafaga = 0; espera += azar(250, 650) * (1 + D.pausaDisparo); }
  } else espera += azar(60, 260) * (1 + D.pausaDisparo);
  B.disparoEn = now + espera;
  if (it.mag <= 0) recargar(room, p, ctx);
}

// Tirarle a una construcción que tapa al enemigo.
function dispararA(room, p, key, it, def, ctx) {
  const B = p.bot, s = room.world.structs.get(key);
  if (!s) return;
  const c = s.caja || (s.caja = cajaPieza(s));
  const fx = -Math.sin(B.yaw), fz = -Math.cos(B.yaw);
  const from = [+(B.p.x + fx * 0.7).toFixed(2), +(B.p.y + 1.45).toFixed(2), +(B.p.z + fz * 0.7).toFixed(2)];
  const to = [(c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2, (c.z0 + c.z1) / 2].map((v) => +v.toFixed(2));
  ctx.handleGame(room, p, { t: 'shoot', slot: B.sel, from, to, hits: def.rocket ? [] : [{ key, n: def.pellets }] });
  B.disparoEn = ctx.now + def.cooldown * 1000 * (1.2 + B.D.pausaDisparo);
}

// Pared (y en difícil también una rampa) entre el bot y el que le tira.
function cubrirse(room, p, E, ctx) {
  const B = p.bot, now = ctx.now;
  if (!B.onGround || now < B.construyeEn) return;
  const mat = ['madera', 'piedra', 'metal'].find((m) => p.mats[m] >= BUILD_COST);
  if (!mat) return;
  B.construyeEn = now + B.D.esperaConstruir * 1000;
  const yaw = yawHacia(E.x - B.p.x, E.z - B.p.z);
  const d = Math.round(((-yaw / (Math.PI / 2)) % 4 + 4) % 4) % 4; // 0=-Z,1=+X,2=+Z,3=-X (como construir.js)
  const ci = Math.floor(B.p.x / GRID), cj = Math.floor(B.p.z / GRID);
  const y = Math.floor(B.p.y * 2) / 2;
  ctx.handleGame(room, p, { t: 'build', type: 'pared', i: ci, j: cj, y, dir: d, mat });
  if (B.dif === 'dificil' && Math.random() < 0.5) {
    const m2 = ['madera', 'piedra', 'metal'].find((m) => p.mats[m] >= BUILD_COST);
    const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    if (m2) setTimeout(() => {
      if (p.alive && room.phase === 'playing') ctx.handleGame(room, p, { t: 'build', type: 'rampa', i: ci + DIRS[d][0], j: cj + DIRS[d][1], y, dir: d, mat: m2 });
    }, 180);
  }
}

// ---------- Curarse ----------
function curarse(room, p, ctx) {
  const B = p.bot;
  let mejor = -1, mv = 0;
  p.slots.forEach((s, i) => {
    if (s?.kind !== 'consumable') return;
    const def = CONSUMABLES[s.c];
    let v = 0;
    if (def.shield && p.shield < def.max - 5) v = 3 + (def.max - p.shield) / 25;
    if (def.heal && p.hp < Math.min(def.max, B.D.cura + 25) && p.hp < def.max - 5) v = 4 + (100 - p.hp) / 20;
    if (v > mv) { mv = v; mejor = i; }
  });
  if (mejor < 0) return false;
  const def = CONSUMABLES[p.slots[mejor].c];
  B.sel = mejor;
  ctx.handleGame(room, p, { t: 'useStart', slot: mejor });
  B.usando = { slot: mejor, fin: ctx.now + def.time * 1000 + 80 };
  return true;
}

// ---------- Avisos que manda server.js ----------
export function alRecibirDanio(room, p, atacante, now) {
  const B = p.bot;
  if (!B?.D || !atacante || atacante === p) return;
  B.amenaza = { id: atacante.id, t: now };
  if (B.usando) { B.usando = null; p.use = null; }
  const A = P(atacante.pos);
  if (!B.enemigo || B.enemigo.id !== atacante.id) {
    // no lo estaba viendo: se da vuelta (con su tiempo de reacción) y queda alerta
    B.enemigo = { id: atacante.id, desde: now, reaccion: azar(...B.D.reaccion) * 1000, visto: now, donde: A, libre: false };
    B.miraEn = 0;
  } else { B.enemigo.visto = now; B.enemigo.donde = A; }
  if (p.state === 'ground' && Math.random() < B.D.construye && dist2(B.p, A) > 6) B.cubrirse = true;
}
export function alMatar(room, p, now) {
  const B = p.bot;
  if (!B?.D) return;
  B.enemigo = null;
  if (Math.random() < 0.35) B.baile = now + azar(1500, 3000);
}

// ---------- Estado para los clientes (el mismo mensaje 'state' que mandan ellos) ----------
function avisarEstado(room, p, ctx) {
  const B = p.bot, now = ctx.now;
  const it = B.usando ? p.slots[B.usando.slot] : p.slots[B.sel];
  const h = !it ? ['pico'] : it.kind === 'weapon' ? [it.w, RARITIES[it.rarity].color] : ['item', CONSUMABLES[it.c].color];
  const rl = B.recarga > now ? +((B.recarga - now) / 1000).toFixed(2) : 0;
  const peleando = B.enemigo && now - B.enemigo.visto < 1500 && it?.kind === 'weapon';
  ctx.broadcast(room, {
    t: 'state', id: p.id, p: p.pos.map((v) => +v.toFixed(2)), r: +B.yaw.toFixed(3), s: p.state, a: !!peleando,
    h, sw: false, b: B.baile > now, rl, x: [Math.round(B.caida * 100), Math.round(B.giro * 100), Math.round(B.freno * 100), 0],
  });
}
