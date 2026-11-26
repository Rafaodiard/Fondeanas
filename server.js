// Servidor de Salto Final: sirve el cliente y maneja salas por código vía WebSocket.
// El cliente decide su movimiento; el servidor decide inventario, loot, daño, construcciones, tormenta y ganador.
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { WebSocketServer } from 'ws';
import { World } from './public/js/world.js';
import {
  WEAPONS, CONSUMABLES, AMMO, MATERIALS, BUILD_COST, MAX_MATS, PICKAXE, PUNTO_DEBIL, SLOTS, GRID, DIRS,
  randomWeapon, randomConsumable, randomAmmo, weaponDamage, weaponReload, structKey,
} from './public/js/items.js';
import { TIPOS, normalizar, motivoNoEncaja, sinApoyo, vidaDe, editValida, OBRA, ALCANCE_EDICION, cajaPieza, superficie, DEBAJO } from './public/js/construccion.js';
import { AUTO, nuevoAuto, aplicarRed, estadoRed, autoPublico, asientoLibre, rapidez, materialChoque, impacto, claveChoque } from './public/js/autos.js';
import { repartirLoot, acomodarLoot, LOOT_RADIO, LOOT_ALTO } from './public/js/lugarLoot.js';
import { totalValido, dificultadValida, cuantosBots } from './public/js/opcionesBots.js';
import { nuevoBot, nombresBots, prepararBots, actualizarBots, alRecibirDanio, alMatar } from './servidor/bots.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const ISLAND_SIZE = 1200;
const BUS_DURATION = 22;
const BUS_HEIGHT = 260;
const MAX_PLAYERS = 16; // personas (los bots completan aparte, hasta BOT_MAX_TOTAL entre todos)
const TICK_MS = 100;
const BOT_MS = 50;      // los bots se mueven a 20 Hz
// Sólo para mirar o probar a los bots: SF_BOTS_HASTA_EL_FINAL=1 npm start sigue la partida aunque ya no quede
// ninguna persona viva (si no, termina a los pocos segundos de morir la última).
const BOTS_HASTA_EL_FINAL = !!process.env.SF_BOTS_HASTA_EL_FINAL;
const PICKUP_RANGE = 3.2;
// Sólo para probar la construcción: SF_MATS=500 npm start arranca cada partida con 500 de cada material.
const MATS_INICIALES = Math.max(0, Math.min(MAX_MATS, Number(process.env.SF_MATS) || 0));

// ---------- HTTP estático ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.glb': 'model/gltf-binary', '.png': 'image/png', '.json': 'application/json',
};
// Versión del código: huella de los archivos del juego al arrancar. Si después cambian en el disco (un git pull con el
// servidor prendido), el servidor sigue corriendo lo viejo: lo avisa en la consola y en el juego, para reiniciarlo.
function huellaCodigo() {
  const h = crypto.createHash('sha1');
  const carpetas = [__dirname, path.join(__dirname, 'servidor'), path.join(__dirname, 'public/js')];
  for (const dir of carpetas) {
    let lista = [];
    try { lista = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort(); } catch { continue; }
    for (const f of lista) { h.update(f); h.update(fs.readFileSync(path.join(dir, f))); }
  }
  return h.digest('hex').slice(0, 12);
}
const VERSION = huellaCodigo();
let avisoViejo = false;
function codigoViejo() {
  const viejo = huellaCodigo() !== VERSION;
  if (viejo && !avisoViejo) { avisoViejo = true; console.warn('⚠ El código cambió desde que arrancó el servidor: cerralo (Ctrl+C) y volvé a correr npm start.'); }
  return viejo;
}
const ROOTS = {
  '/vendor/three/': path.join(__dirname, 'node_modules/three/'),
  '/': path.join(__dirname, 'public/'),
};
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  for (const [prefix, dir] of Object.entries(ROOTS)) {
    if (!url.startsWith(prefix)) continue;
    const file = path.normalize(path.join(dir, url.slice(prefix.length)));
    if (!file.startsWith(dir)) break;
    return fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('No encontrado'); }
      // sin caché: después de un git pull el navegador trae los archivos nuevos (no mezcla código viejo con nuevo)
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  }
  res.writeHead(404); res.end('No encontrado');
});

// ---------- Salas ----------
const rooms = new Map();
let nextId = 1;
const COLORS = ['#ff5a5f', '#3fa7ff', '#ffd23f', '#5ad65a', '#c77dff', '#ff9f1c', '#2ec4b6', '#f15bb5',
  '#9b5de5', '#00bbf9', '#fee440', '#00f5d4', '#e76f51', '#8ac926', '#ff006e', '#8338ec'];

function makeCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do code = Array.from({ length: 5 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  while (rooms.has(code));
  return code;
}

function createRoom() {
  const room = {
    code: makeCode(), seed: Math.floor(Math.random() * 1e9), phase: 'lobby', players: new Map(), hostId: null,
    bus: null, storm: null, winner: null, world: null, items: new Map(), chests: [], nextItem: 1,
    trees: [], rocks: [], autos: [],
    bots: { total: 0, dif: 'normal' }, // los bots completan la sala hasta `total` jugadores (0 = sin bots)
    partida: 0,
  };
  rooms.set(room.code, room);
  return room;
}

// los bots no tienen conexión (ws null): no se les manda nada
const send = (ws, msg) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); };
function broadcast(room, msg, exceptId) {
  const data = JSON.stringify(msg);
  for (const p of room.players.values()) if (p.id !== exceptId && p.ws && p.ws.readyState === 1) p.ws.send(data);
}
const publicPlayer = (p) => ({ id: p.id, name: p.name, color: p.color, alive: p.alive, kills: p.kills, state: p.state, ...(p.bot ? { bot: true } : {}) });
const personas = (room) => [...room.players.values()].filter((p) => !p.bot);

function roomInfo(room) {
  return {
    code: room.code, seed: room.seed, phase: room.phase, hostId: room.hostId, islandSize: ISLAND_SIZE, bots: room.bots,
    players: [...room.players.values()].map(publicPlayer), bus: room.bus, storm: room.storm, serverTime: Date.now(),
  };
}

// Estado completo del mapa para quien entra o empieza partida.
function matchSnapshot(room) {
  return {
    items: [...room.items.values()],
    chests: room.chests.map((c, i) => (c.open ? i : -1)).filter((i) => i >= 0),
    trees: room.trees.map((hp, i) => (hp <= 0 ? i : -1)).filter((i) => i >= 0),
    rocks: room.rocks.map((hp, i) => (hp <= 0 ? i : -1)).filter((i) => i >= 0),
    structs: [...room.world.structs.values()].map(structPublic),
    piezas: room.pzRotas, // piezas del mapa ya rotas (en orden)
    pzHp: room.pzHp.flatMap((hp, id) => { const pz = room.world.piezas[id]; return !pz.fija && !pz.rota && hp < pz.hp ? [[id, Math.ceil(hp)]] : []; }), // dañadas
    cofresMovidos: room.chests.flatMap((c, i) => (c.movido ? [[i, c.y]] : [])),
    autos: room.autos.map(autoPublico),
  };
}
// crece: segundos que le faltan para terminar de levantarse (obra: lo que tarda en total).
function structPublic(s) {
  const t = Date.now();
  return {
    key: s.key, type: s.type, i: s.i, j: s.j, y: s.y, dir: s.dir, mat: s.mat, e: s.e || 0, owner: s.owner,
    hp: Math.ceil(vidaDe(s, t)), max: MATERIALS[s.mat].hp, dano: Math.round(s.dano || 0), obra: OBRA[s.mat], crece: +Math.max(0, OBRA[s.mat] - (t - s.born) / 1000).toFixed(2),
  };
}

function invMsg(p) {
  return { t: 'inv', slots: p.slots, ammo: p.ammo, mats: p.mats, hp: Math.ceil(p.hp), shield: Math.ceil(p.shield) };
}

function spawnItem(room, item, x, y, z) {
  const it = { ...item, id: room.nextItem++, x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2) };
  room.items.set(it.id, it);
  return it;
}

// Reparte objetos alrededor de (x,y,z) (cofre, jugador que suelta algo o que murió) sin pasar paredes: ver lugarLoot.js.
function spawnAround(room, list, x, y, z) {
  const lugares = repartirLoot(room.world, list.length, x, y, z);
  const out = list.map((item, k) => spawnItem(room, item, lugares[k].x, lugares[k].y, lugares[k].z));
  if (out.length) broadcast(room, { t: 'itemsAdd', items: out });
  return out;
}

// Algo cambió en las cajas (se construyó, editó o rompió una pieza): el loot que quedó adentro sale para su lado
// y el que quedó en el aire cae. caja = { x0, y0, z0, x1, y1, z1 }.
function acomodarItems(room, cajas) {
  if (!cajas.length) return;
  const m = LOOT_RADIO + 0.3;
  const cerca = (it, a) => it.x > a.x0 - m && it.x < a.x1 + m && it.z > a.z0 - m && it.z < a.z1 + m && it.y > a.y0 - LOOT_ALTO - 0.3 && it.y < a.y1 + 1.5;
  const movidos = [];
  for (const it of room.items.values()) {
    if (!cajas.some((a) => cerca(it, a))) continue;
    const p = acomodarLoot(room.world, it);
    if (Math.hypot(p.x - it.x, p.y - it.y, p.z - it.z) < 0.02) continue;
    it.x = p.x; it.y = p.y; it.z = p.z;
    movidos.push(it);
  }
  if (movidos.length) { broadcast(room, { t: 'itemsDel', ids: movidos.map((it) => it.id) }); broadcast(room, { t: 'itemsAdd', items: movidos }); }
}
const cajaDeAabb = (a) => ({ x0: a[0], y0: a[1], z0: a[2], x1: a[3], y1: a[4], z1: a[5] });

function startMatch(room) {
  room.phase = 'bus';
  room.winner = null;
  room.world = new World(room.seed, ISLAND_SIZE);
  room.items = new Map();
  room.nextItem = 1;
  room.trees = room.world.trees.map(() => 150);
  room.rocks = room.world.rocks.map((r) => Math.round(150 + r.s * 120));
  room.chests = room.world.chestSpots.map((c) => ({ ...c, open: false }));
  // piezas rompibles del mapa (paredes, losas, techos, muebles...): vida por pieza y lista de rotas
  room.pzHp = room.world.piezas.map((pz) => (pz.fija ? 0 : pz.hp));
  room.pzRotas = [];
  // autos manejables, estacionados en las calles (autos.js); el que maneja cada uno lo simula y lo manda
  room.autos = room.world.autoSpawns.map((sp, i) => nuevoAuto(i, sp));
  // Loot del piso: arma con su munición, o consumible, o munición.
  for (const s of room.world.lootSpots) {
    const r = Math.random();
    if (r < 0.2) continue;
    if (r < 0.62) {
      const w = randomWeapon(false);
      spawnItem(room, w, s.x, s.y, s.z);
      spawnItem(room, randomAmmo(Math.random, WEAPONS[w.w].ammo), s.x + 0.8, s.y, s.z + 0.4);
    } else if (r < 0.85) spawnItem(room, randomConsumable(), s.x, s.y, s.z);
    else spawnItem(room, randomAmmo(), s.x, s.y, s.z);
  }
  const angle = Math.random() * Math.PI * 2;
  const r = ISLAND_SIZE * 0.6;
  const off = (Math.random() - 0.5) * ISLAND_SIZE * 0.3;
  const px = Math.cos(angle + Math.PI / 2) * off, pz = Math.sin(angle + Math.PI / 2) * off;
  room.bus = {
    from: [Math.cos(angle) * r + px, BUS_HEIGHT, Math.sin(angle) * r + pz],
    to: [-Math.cos(angle) * r + px, BUS_HEIGHT, -Math.sin(angle) * r + pz],
    start: Date.now() + 3000, duration: BUS_DURATION * 1000,
  };
  const fx = (Math.random() - 0.5) * ISLAND_SIZE * 0.4, fz = (Math.random() - 0.5) * ISLAND_SIZE * 0.4;
  room.storm = {
    phases: [
      { t: 0, r: ISLAND_SIZE * 0.75, x: 0, z: 0, dps: 1 },
      { t: 80, r: ISLAND_SIZE * 0.75, x: 0, z: 0, dps: 1 },
      { t: 130, r: 330, x: fx * 0.5, z: fz * 0.5, dps: 2 },
      { t: 190, r: 330, x: fx * 0.5, z: fz * 0.5, dps: 2 },
      { t: 230, r: 140, x: fx * 0.8, z: fz * 0.8, dps: 5 },
      { t: 275, r: 140, x: fx * 0.8, z: fz * 0.8, dps: 5 },
      { t: 305, r: 45, x: fx, z: fz, dps: 8 },
      { t: 340, r: 45, x: fx, z: fz, dps: 8 },
      { t: 370, r: 0, x: fx, z: fz, dps: 15 },
    ],
    start: room.bus.start,
  };
  room.partida++;
  agregarBots(room);
  for (const p of room.players.values()) resetPlayer(p, room);
  prepararBots(room);
  broadcast(room, { t: 'matchStart', room: roomInfo(room), snap: matchSnapshot(room) });
  for (const p of room.players.values()) send(p.ws, invMsg(p));
}

// Bots que completan la sala hasta el total elegido (entran al empezar la partida y se van al volver a la sala).
function agregarBots(room) {
  sacarBots(room);
  const n = cuantosBots(room.bots.total, room.players.size);
  if (!n) return;
  const usados = new Set([...room.players.values()].map((p) => p.color));
  const libres = [...COLORS.filter((c) => !usados.has(c)), ...COLORS];
  const nombres = nombresBots(n, new Set([...room.players.values()].map((p) => p.name)));
  for (let k = 0; k < n; k++) {
    const p = { ...nuevoBot(room.bots.dif), id: nextId++, name: nombres[k], color: libres[k % libres.length], kills: 0 };
    room.players.set(p.id, p);
  }
}
function sacarBots(room) {
  for (const [id, p] of room.players) if (p.bot) room.players.delete(id);
}

function resetPlayer(p, room) {
  p.hp = 100; p.shield = 0; p.alive = true; p.kills = 0; p.state = 'bus';
  p.pos = [...room.bus.from]; p.lastShot = 0; p.lastSwing = 0; p.debil = null; p.use = null; p.auto = null;
  p.slots = Array(SLOTS).fill(null);
  p.ammo = { ligera: 0, media: 0, pesada: 0, cartuchos: 0, cohetes: 0 };
  p.mats = { madera: MATS_INICIALES, piedra: MATS_INICIALES, metal: MATS_INICIALES };
}

function stormAt(storm, now) {
  const t = (now - storm.start) / 1000;
  const ph = storm.phases;
  if (t <= ph[0].t) return ph[0];
  for (let i = 0; i < ph.length - 1; i++) {
    const a = ph[i], b = ph[i + 1];
    if (t >= a.t && t <= b.t) {
      const k = (t - a.t) / (b.t - a.t || 1);
      return { r: a.r + (b.r - a.r) * k, x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, dps: b.dps };
    }
  }
  return ph[ph.length - 1];
}

// Aplica daño respetando el escudo. Devuelve true si murió.
function damagePlayer(room, target, dmg, attacker, cause) {
  if (!target.alive) return false;
  const toShield = Math.min(target.shield, dmg);
  target.shield -= toShield;
  target.hp -= dmg - toShield;
  if (target.hp <= 0) { killPlayer(room, target, attacker, cause); return true; }
  send(target.ws, { ...invMsg(target), from: attacker ? attacker.id : null });
  if (target.bot) alRecibirDanio(room, target, attacker, Date.now());
  return false;
}

function dist3(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }

function killPlayer(room, victim, killer, cause) {
  if (!victim.alive) return;
  if (victim.auto) bajarDelAuto(room, victim);
  victim.alive = false; victim.hp = 0; victim.shield = 0; victim.state = 'dead';
  if (killer && killer !== victim) { killer.kills++; if (killer.bot) alMatar(room, killer, Date.now()); }
  // Tira todo lo que tenía.
  const drops = victim.slots.filter(Boolean);
  for (const [a, n] of Object.entries(victim.ammo)) if (n > 0) drops.push({ kind: 'ammo', a, count: n });
  for (const [m, n] of Object.entries(victim.mats)) if (n > 0) drops.push({ kind: 'mat', m, count: n });
  victim.slots = Array(SLOTS).fill(null);
  if (room.world) spawnAround(room, drops, victim.pos[0], victim.pos[1], victim.pos[2]);
  broadcast(room, { t: 'death', id: victim.id, by: killer ? killer.id : null, cause, players: [...room.players.values()].map(publicPlayer) });
  checkWinner(room);
}

function checkWinner(room) {
  if (room.phase !== 'playing' && room.phase !== 'bus') return;
  const alive = [...room.players.values()].filter((p) => p.alive);
  if ((room.players.size > 1 && alive.length <= 1) || alive.length === 0) return endMatch(room, alive[0] ? alive[0].id : null);
  // ya no queda ninguna persona viva (solo bots): la partida termina al rato, para que se vea el cartel de eliminado
  if (!BOTS_HASTA_EL_FINAL && !alive.some((p) => !p.bot)) {
    const n = room.partida;
    setTimeout(() => {
      if (rooms.has(room.code) && room.partida === n && (room.phase === 'playing' || room.phase === 'bus')) {
        endMatch(room, null, [...room.players.values()].filter((p) => p.alive).length);
      }
    }, 4500);
  }
}
function endMatch(room, winner, botsVivos = 0) {
  room.phase = 'ended';
  room.winner = winner;
  broadcast(room, { t: 'matchEnd', winner, players: [...room.players.values()].map(publicPlayer), ...(botsVivos ? { botsVivos } : {}) });
  const n = room.partida;
  setTimeout(() => {
    if (!rooms.has(room.code) || room.partida !== n) return;
    room.phase = 'lobby';
    sacarBots(room);
    room.nav = null;
    for (const p of room.players.values()) { p.state = 'lobby'; p.alive = true; p.hp = 100; }
    broadcast(room, { t: 'room', room: roomInfo(room) });
  }, 9000);
}

function tick() {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.phase === 'bus' && now > room.bus.start) {
      room.phase = 'playing';
      broadcast(room, { t: 'phase', phase: 'playing' });
    }
    if (room.phase !== 'playing') continue;
    if (now > room.bus.start + room.bus.duration) {
      for (const p of room.players.values()) {
        if (p.state === 'bus') { p.state = 'falling'; broadcast(room, { t: 'forceJump', id: p.id }); }
      }
    }
    const s = stormAt(room.storm, now);
    for (const p of room.players.values()) {
      if (!p.alive || p.state === 'bus') continue;
      const dx = p.pos[0] - s.x, dz = p.pos[2] - s.z;
      if (dx * dx + dz * dz > s.r * s.r) {
        // La tormenta ignora el escudo.
        p.hp -= s.dps * (TICK_MS / 1000);
        if (p.hp <= 0) killPlayer(room, p, null, 'storm');
        else send(p.ws, { ...invMsg(p), storm: true });
      }
    }
  }
}
setInterval(tick, TICK_MS);

// ---------- Bots ----------
function busPos(room, now) {
  const b = room.bus, k = Math.max(0, Math.min(1.4, (now - b.start) / b.duration));
  return { x: b.from[0] + (b.to[0] - b.from[0]) * k, y: b.from[1] + (b.to[1] - b.from[1]) * k, z: b.from[2] + (b.to[2] - b.from[2]) * k };
}
let ultimoBots = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = Math.min(0.1, (now - ultimoBots) / 1000);
  ultimoBots = now;
  for (const room of rooms.values()) {
    if ((room.phase !== 'bus' && room.phase !== 'playing') || !room.nav) continue;
    actualizarBots(room, { now, dt, handleGame, broadcast, stormAt, busPos });
  }
}, BOT_MS);

// ---------- Acciones de juego ----------
function addToInventory(p, item) {
  // Devuelve el resto que no entró (o null si entró todo).
  if (item.kind === 'ammo') { p.ammo[item.a] = Math.min(AMMO[item.a].max, p.ammo[item.a] + item.count); return null; }
  if (item.kind === 'mat') {
    const room = MAX_MATS - p.mats[item.m];
    const take = Math.min(room, item.count);
    p.mats[item.m] += take;
    return item.count - take > 0 ? { ...item, count: item.count - take } : null;
  }
  if (item.kind === 'consumable') {
    const def = CONSUMABLES[item.c];
    let left = item.count;
    for (const s of p.slots) {
      if (s && s.kind === 'consumable' && s.c === item.c && s.count < def.stack) {
        const take = Math.min(def.stack - s.count, left);
        s.count += take; left -= take;
        if (!left) return null;
      }
    }
    const free = p.slots.indexOf(null);
    if (free >= 0) { p.slots[free] = { kind: 'consumable', c: item.c, count: Math.min(left, def.stack) }; left -= Math.min(left, def.stack); }
    return left > 0 ? { ...item, count: left } : null;
  }
  if (item.kind === 'weapon') {
    const free = p.slots.indexOf(null);
    if (free < 0) return item;
    p.slots[free] = { kind: 'weapon', w: item.w, rarity: item.rarity, mag: item.mag };
    return null;
  }
  return item;
}

function stripItem(it) {
  const { id, x, y, z, ...rest } = it; // eslint-disable-line no-unused-vars
  return rest;
}

function handleGame(room, player, msg) {
  const now = Date.now();
  switch (msg.t) {
    case 'jump':
      if (room.phase === 'playing' && player.state === 'bus') {
        player.state = 'falling';
        broadcast(room, { t: 'jumped', id: player.id });
      }
      break;
    case 'state': {
      if (!player.alive || player.state === 'bus') break;
      const p = msg.p;
      if (!Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite)) break;
      // velocidad aproximada (la usan los bots para saber si el blanco se mueve)
      if (player.tState) player.velEst = Math.min(30, Math.hypot(p[0] - player.pos[0], p[2] - player.pos[2]) / Math.max(0.03, (now - player.tState) / 1000));
      player.tState = now;
      player.pos = p;
      if (player.auto) player.state = 'auto';
      else if (['falling', 'glider', 'ground'].includes(msg.s)) player.state = msg.s;
      const rl = Math.min(5, Math.max(0, Number(msg.rl) || 0));
      // parámetros de animación de la caída, el paracaídas y el deslizamiento (caida.js): 4 enteros chicos
      const x = Array.isArray(msg.x) ? msg.x.slice(0, 4).map((v) => Math.max(-100, Math.min(100, Math.round(Number(v) || 0)))) : undefined;
      broadcast(room, { t: 'state', id: player.id, p, r: Number(msg.r) || 0, s: player.state, a: !!msg.a, h: msg.h, sw: !!msg.sw, b: !!msg.b, rl, x }, player.id);
      break;
    }
    case 'pickup': {
      if (!player.alive || player.state !== 'ground') break;
      const it = room.items.get(msg.id);
      if (!it || dist3(player.pos, [it.x, it.y, it.z]) > PICKUP_RANGE + 1) break;
      room.items.delete(it.id);
      let rest = addToInventory(player, stripItem(it));
      const removed = [it.id];
      const added = [];
      if (rest && rest.kind === 'weapon') {
        // Inventario lleno: cambia por lo que tenga en la mano (si no es el pico).
        const slot = Number.isInteger(msg.slot) && msg.slot >= 0 && msg.slot < SLOTS ? msg.slot : 0;
        const old = player.slots[slot];
        player.slots[slot] = rest;
        rest = old;
      }
      if (rest) added.push(spawnItem(room, rest, it.x, it.y, it.z));
      broadcast(room, { t: 'itemsDel', ids: removed });
      if (added.length) broadcast(room, { t: 'itemsAdd', items: added });
      send(player.ws, { ...invMsg(player), picked: stripItem(it) });
      break;
    }
    case 'drop': {
      if (!player.alive) break;
      const slot = msg.slot;
      const it = player.slots[slot];
      if (!it) break;
      player.slots[slot] = null;
      spawnAround(room, [it], player.pos[0], player.pos[1], player.pos[2]);
      send(player.ws, invMsg(player));
      break;
    }
    case 'chest': {
      const c = room.chests[msg.idx];
      if (!c || c.open || !player.alive || player.state !== 'ground' || dist3(player.pos, [c.x, c.y, c.z]) > PICKUP_RANGE + 1) break;
      c.open = true;
      broadcast(room, { t: 'chestOpen', idx: msg.idx });
      const w = randomWeapon(true);
      const loot = [w, randomAmmo(Math.random, WEAPONS[w.w].ammo), randomConsumable(), { kind: 'mat', m: 'madera', count: 30 }];
      if (Math.random() < 0.4) loot.push(randomAmmo());
      spawnAround(room, loot, c.x, c.y, c.z);
      break;
    }
    case 'reload': {
      const it = player.slots[msg.slot];
      if (!it || it.kind !== 'weapon') break;
      const def = WEAPONS[it.w];
      const need = def.mag - it.mag;
      const take = Math.min(need, player.ammo[def.ammo]);
      if (take <= 0) break;
      player.reloadDone = now + weaponReload(it) * 1000 * 0.85;
      player.reloadSlot = msg.slot;
      player.reloadTake = take;
      setTimeout(() => {
        if (!player.alive || player.reloadSlot !== msg.slot || player.slots[msg.slot] !== it) return;
        const t2 = Math.min(def.mag - it.mag, player.ammo[def.ammo]);
        it.mag += t2; player.ammo[def.ammo] -= t2;
        player.reloadSlot = null;
        send(player.ws, invMsg(player));
      }, weaponReload(it) * 1000 * 0.95);
      break;
    }
    case 'shoot': {
      if (!player.alive || room.phase !== 'playing' || player.state !== 'ground') break;
      const it = player.slots[msg.slot];
      if (!it || it.kind !== 'weapon' || it.mag <= 0) break;
      const def = WEAPONS[it.w];
      const t = now / 1000;
      if (t - player.lastShot < def.cooldown * 0.75) break;
      player.lastShot = t;
      player.reloadSlot = null;
      it.mag--;
      broadcast(room, { t: 'shot', id: player.id, from: msg.from, to: msg.to, w: it.w }, player.id);
      const base = weaponDamage(it);
      if (def.rocket) {
        const to = msg.to;
        if (!Array.isArray(to) || to.length !== 3 || !to.every(Number.isFinite) || dist3(to, player.pos) > def.range + 5) break;
        const travel = Math.min(2000, dist3(to, player.pos) / 60 * 1000);
        setTimeout(() => explode(room, player, to, def, base), travel);
        break;
      }
      // Impactos: lista de { pid | key, n (perdigones), head }
      const hits = Array.isArray(msg.hits) ? msg.hits.slice(0, def.pellets) : [];
      let pelletsUsed = 0;
      for (const h of hits) {
        const n = Math.max(1, Math.min(def.pellets - pelletsUsed, h.n | 0));
        pelletsUsed += n;
        if (Number.isInteger(h.auto)) {
          const a = room.autos[h.auto];
          if (a && dist3([a.x, a.y, a.z], player.pos) <= def.range + 8) danarAuto(room, a, def.struct * RARITIESmul(it) * (n / def.pellets), player);
        } else if (h.key) {
          const s = room.world.structs.get(h.key);
          if (s) damageStruct(room, s, def.struct * RARITIESmul(it) * (n / def.pellets) * (def.pellets > 1 ? 1 : 1));
        } else if (Number.isInteger(h.pz)) {
          if (distPieza(room, h.pz, player.pos) <= def.range + 5) damagePieza(room, h.pz, def.struct * RARITIESmul(it) * (n / def.pellets));
        } else if (h.pid) {
          const target = room.players.get(h.pid);
          if (!target || !target.alive || target === player) continue;
          const dist = dist3(target.pos, player.pos);
          if (dist > def.range + 5) continue;
          let dmg = base * n * (h.head ? def.head : 1);
          if (def.pellets > 1) dmg *= Math.max(0.35, 1 - dist / def.range);
          send(player.ws, { t: 'hitConfirm', id: target.id, dmg: Math.round(dmg), head: !!h.head, shield: target.shield > 0, pos: target.pos });
          damagePlayer(room, target, dmg, player, it.w);
        }
      }
      break;
    }
    case 'swing': {
      // Golpe de pico: a jugador, construcción o recurso.
      if (!player.alive || player.state !== 'ground' || now - player.lastSwing < PICKAXE.cooldown * 800) break;
      player.lastSwing = now;
      broadcast(room, { t: 'swing', id: player.id }, player.id);
      if (msg.pid) {
        const target = room.players.get(msg.pid);
        if (target && target.alive && target !== player && dist3(target.pos, player.pos) < PICKAXE.range + 2) {
          send(player.ws, { t: 'hitConfirm', id: target.id, dmg: PICKAXE.damage, head: false, shield: target.shield > 0, pos: target.pos });
          damagePlayer(room, target, PICKAXE.damage, player, 'pico');
        }
      } else if (msg.key) {
        const s = room.world.structs.get(msg.key);
        if (!s) break;
        const o = { key: s.key }, at = puntoGolpe(room, player, o, msg.at);
        const crit = esCritico(player, o, at, now);
        damageStruct(room, s, PICKAXE.struct * (crit ? PUNTO_DEBIL.mult : 1));
        avisarDebil(room, player, o, at, msg.n, crit, now);
      } else if (Number.isInteger(msg.auto)) {
        // los autos se pican como el metal
        const a = room.autos[msg.auto];
        if (!a || a.rota || dist3([a.x, a.y + 0.8, a.z], player.pos) > PICKAXE.range + 4) break;
        const rompio = danarAuto(room, a, PICKAXE.struct, player);
        const [gainMat, base] = PICKAXE.gain.metal;
        const amount = rompio ? base * 2 : base;
        player.mats[gainMat] = Math.min(MAX_MATS, player.mats[gainMat] + amount);
        send(player.ws, { ...invMsg(player), gained: [gainMat, amount] });
      } else if (Number.isInteger(msg.pz)) {
        const pz = room.world.piezas[msg.pz];
        if (!pz || pz.fija || pz.rota || distPieza(room, msg.pz, player.pos) > PICKAXE.range + 2) break;
        const o = { pz: msg.pz }, at = puntoGolpe(room, player, o, msg.at);
        const crit = esCritico(player, o, at, now);
        const rompio = damagePieza(room, msg.pz, PICKAXE.struct * (crit ? PUNTO_DEBIL.mult : 1));
        avisarDebil(room, player, o, at, msg.n, crit, now);
        const [gainMat, base] = PICKAXE.gain[pz.clase];
        const amount = rompio ? base * 2 : base;
        player.mats[gainMat] = Math.min(MAX_MATS, player.mats[gainMat] + amount);
        send(player.ws, { ...invMsg(player), gained: [gainMat, amount] });
      } else if (msg.res === 'tree' || msg.res === 'rock' || msg.res === 'house') {
        let gainMat, amount;
        if (msg.res === 'house') {
          [gainMat, amount] = PICKAXE.gain.house;
        } else {
          const list = msg.res === 'tree' ? room.trees : room.rocks;
          const info = (msg.res === 'tree' ? room.world.trees : room.world.rocks)[msg.idx];
          if (!info || list[msg.idx] <= 0) break;
          if (Math.hypot(info.x - player.pos[0], info.z - player.pos[2]) > PICKAXE.range + info.s * 2 + 2) break;
          const o = { res: msg.res, idx: msg.idx }, at = puntoGolpe(room, player, o, msg.at);
          const crit = esCritico(player, o, at, now);
          list[msg.idx] -= PICKAXE.struct * (crit ? PUNTO_DEBIL.mult : 1);
          [gainMat, amount] = PICKAXE.gain[msg.res];
          if (list[msg.idx] <= 0) {
            room.world.destroyResource(msg.res, msg.idx);
            broadcast(room, { t: 'resGone', res: msg.res, idx: msg.idx });
            amount *= 2;
          } else broadcast(room, { t: 'resHit', res: msg.res, idx: msg.idx }, player.id);
          avisarDebil(room, player, o, at, msg.n, crit, now);
        }
        player.mats[gainMat] = Math.min(MAX_MATS, player.mats[gainMat] + amount);
        send(player.ws, { ...invMsg(player), gained: [gainMat, amount] });
      }
      break;
    }
    case 'build': {
      if (!player.alive || ['bus', 'falling', 'glider', 'auto'].includes(player.state) || room.phase !== 'playing') break;
      const { type, i, j, y, dir, mat } = msg;
      if (!TIPOS.includes(type) || !MATERIALS[mat]) break;
      if (![i, j, y * 2, dir].every(Number.isInteger) || dir < 0 || dir > 3) break;
      if (player.mats[mat] < BUILD_COST) break;
      const cx = i * GRID + GRID / 2, cz = j * GRID + GRID / 2;
      if (Math.hypot(cx - player.pos[0], cz - player.pos[2]) > GRID * 3 || Math.abs(y - player.pos[1]) > GRID * 2.5) break;
      const s = normalizar({ type, i, j, y, dir, mat, e: 0 });
      s.key = structKey(s);
      // grilla de encastre (construccion.js): lugar libre, misma grilla que lo que toca y apoyada en el piso,
      // en el mapa o en el borde de otra construcción. Lo mismo que pinta de verde la vista previa.
      if (motivoNoEncaja(room.world, s)) break;
      s.born = Date.now(); s.dano = 0;
      s.owner = player.id;
      room.world.addStruct(s);
      player.mats[mat] -= BUILD_COST;
      broadcast(room, { t: 'structAdd', s: structPublic(s) });
      send(player.ws, invMsg(player));
      acomodarItems(room, [cajaPieza(s)]); // el loot que quedó adentro de la pieza nueva sale para su lado
      break;
    }
    case 'edit': {
      // Editar una construcción propia: pared 3x3, piso 2x2, rampa (dirección y carriles) y techo (esquinas).
      if (!player.alive || room.phase !== 'playing') break;
      const s = room.world.structs.get(msg.key);
      if (!s || s.owner !== player.id) break;
      const b = cajaPieza(s);
      if (dist3([(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2], [player.pos[0], player.pos[1] + 1, player.pos[2]]) > ALCANCE_EDICION + 2) break;
      if (!editValida(s.type, msg.e)) break;
      const dir = s.type === 'rampa' && Number.isInteger(msg.dir) && msg.dir >= 0 && msg.dir <= 3 ? msg.dir : s.dir;
      room.world.editStruct(s.key, msg.e, dir);
      broadcast(room, { t: 'structEdit', key: s.key, e: s.e, dir: s.dir });
      acomodarItems(room, [cajaPieza(s)]); // al cerrar un hueco el loot que estaba ahí sale para su lado
      break;
    }
    case 'useStart': {
      const it = player.slots[msg.slot];
      if (!player.alive || !it || it.kind !== 'consumable') break;
      player.use = { slot: msg.slot, c: it.c, start: now };
      break;
    }
    case 'useCancel': player.use = null; break;
    case 'useEnd': {
      const u = player.use;
      player.use = null;
      if (!u || !player.alive) break;
      const it = player.slots[u.slot];
      if (!it || it.kind !== 'consumable' || it.c !== u.c) break;
      const def = CONSUMABLES[it.c];
      if (now - u.start < def.time * 1000 * 0.85) break;
      if (def.heal) {
        if (player.hp >= def.max) break;
        player.hp = Math.min(def.max, player.hp + def.heal);
      } else {
        if (player.shield >= def.max) break;
        player.shield = Math.min(def.max, player.shield + def.shield);
      }
      it.count--;
      if (it.count <= 0) player.slots[u.slot] = null;
      send(player.ws, invMsg(player));
      break;
    }
    // ---------- Autos ----------
    case 'subir': {
      // si no se puede, se avisa por qué (el cliente lo muestra)
      const a = room.autos[msg.a];
      const no = (por) => send(player.ws, { t: 'autoNo', a: msg.a, por });
      if (!a || !player.alive || player.auto || room.phase !== 'playing') break;
      if (a.rota) { no('roto'); break; }
      if (player.state !== 'ground') { no('estado'); break; }
      if (Math.hypot(a.x - player.pos[0], a.z - player.pos[2]) > AUTO.ALCANCE + 1 || Math.abs(a.y - player.pos[1]) > 3) { no('lejos'); break; }
      const k = asientoLibre(a);
      if (k < 0) { no('lleno'); break; }
      if (player.use) player.use = null;
      a.seats[k] = player.id;
      player.auto = { a: a.id, k };
      player.state = 'auto';
      if (k === 0) a.ctrl = player.id;
      avisarAsientos(room, a);
      break;
    }
    case 'bajar':
      if (player.auto) bajarDelAuto(room, player);
      break;
    case 'asiento': {
      if (!player.auto || !player.alive) break;
      const a = room.autos[player.auto.a];
      const k = asientoLibre(a, player.auto.k);
      if (k < 0 || k === player.auto.k) break;
      a.seats[player.auto.k] = null;
      a.seats[k] = player.id;
      player.auto.k = k;
      if (k === 0) a.ctrl = player.id;
      avisarAsientos(room, a);
      break;
    }
    case 'auto': {
      // estado del auto que simula este jugador (el conductor, o el último que lo manejó mientras frena solo)
      const a = room.autos[msg.a];
      if (!a || a.ctrl !== player.id || !player.alive) break;
      const antes = [a.x, a.y, a.z], t = a.tRed || 0;
      const prueba = { ...a };
      if (!aplicarRed(prueba, msg)) break;
      // sin teletransportes: a lo sumo lo que se puede recorrer a toda velocidad desde el último estado
      const dtR = t ? Math.min(2, (now - t) / 1000) : 2;
      if (dist3(antes, [prueba.x, prueba.y, prueba.z]) > AUTO.TURBO_MAX * 1.6 * dtR + 4) break;
      a.vAntes = rapidez(a); // para validar las embestidas (la velocidad pudo bajar justo al chocar)
      aplicarRed(a, msg);
      a.tRed = now;
      for (const id of a.seats) {
        const q = id !== null && room.players.get(id);
        if (q) q.pos = [a.x, a.y + 0.6, a.z];
      }
      broadcast(room, { t: 'auto', a: a.id, ...estadoRed(a) }, player.id);
      break;
    }
    case 'bocina':
      if (player.auto) broadcast(room, { t: 'bocina', a: player.auto.a }, player.id);
      break;
    case 'atropello': {
      // el conductor pisó a alguien: el daño sale de la velocidad que conoce el servidor
      const a = player.auto && player.auto.k === 0 ? room.autos[player.auto.a] : null;
      const target = room.players.get(msg.pid);
      if (!a || !target || !target.alive || target === player || target.auto || target.state !== 'ground') break;
      if (Math.hypot(target.pos[0] - a.x, target.pos[2] - a.z) > 4.5) break;
      const v = Math.min(45, rapidez(a));
      if (v < AUTO.ATROPELLO || now - (target.atropellado || 0) < 700) break;
      target.atropellado = now;
      const dmg = Math.round(Math.min(80, 10 + (v - AUTO.ATROPELLO) * 3));
      const dx = target.pos[0] - a.x, dz = target.pos[2] - a.z, d = Math.hypot(dx, dz) || 1;
      send(target.ws, { t: 'empujon', v: [+(dx / d * v * 0.45 + a.vx * 0.35).toFixed(2), 7, +(dz / d * v * 0.45 + a.vz * 0.35).toFixed(2)] });
      send(player.ws, { t: 'hitConfirm', id: target.id, dmg, head: false, shield: target.shield > 0, pos: target.pos });
      damagePlayer(room, target, dmg, player, 'auto');
      break;
    }
    case 'choque': {
      // golpe fuerte contra algo: el auto se abolla (el que lo simula avisa, el servidor limita)
      const a = room.autos[msg.a];
      const v = Math.min(40, Number(msg.v) || 0);
      if (!a || a.ctrl !== player.id || a.rota || v < 12 || now - (a.tChoque || 0) < 400) break;
      a.tChoque = now;
      danarAuto(room, a, (v - 12) * 9, null);
      break;
    }
    case 'embestida': {
      // el auto le pegó a algo rompible (autos.js, embestir): el servidor decide con la vida de verdad y con la
      // velocidad que conoce si lo daña o lo rompe, y cuánto se daña el auto al atravesarlo
      const a = room.autos[msg.a];
      if (!a || a.ctrl !== player.id || a.rota || !player.alive || room.phase !== 'playing') break;
      const o = cosaEmbestida(msg.o);
      const m = o && materialChoque(room.world, o);
      if (!m) break;
      // a lo sumo un poco más que la velocidad de los últimos estados (llegan 15 por segundo)
      const v = Math.min(Number(msg.v) || 0, Math.max(rapidez(a), a.vAntes || 0) + 3, AUTO.TURBO_MAX + 3);
      if (!(v > 0) || distEmbestida(room, o, a) > AUTO.LARGO / 2 + AUTO.RADIO + 1.5 + v * 0.15) break;
      if (!a.embestidas) a.embestidas = new Map();
      const id = claveChoque(o);
      if (now - (a.embestidas.get(id) || 0) < 250) break;
      a.embestidas.set(id, now);
      if (a.embestidas.size > 40) for (const [k, t] of a.embestidas) if (now - t > 1000) a.embestidas.delete(k);
      const hp = vidaEmbestida(room, o, now);
      const r = impacto(m.mat, hp, v, m.esc);
      if (!(r.dano > 0)) break;
      if (o.pz !== undefined) damagePieza(room, o.pz, r.dano);
      else if (o.key) damageStruct(room, room.world.structs.get(o.key), r.dano);
      else danarRecurso(room, o.res, o.idx, r.dano);
      if (r.rompe) danarAuto(room, a, r.danoAuto, null);
      break;
    }
    case 'fall': {
      const dmg = Math.min(100, Math.max(0, Number(msg.dmg) || 0));
      if (player.alive && dmg > 0 && player.state === 'ground') {
        player.hp -= dmg;
        if (player.hp <= 0) killPlayer(room, player, null, 'fall');
        else send(player.ws, invMsg(player));
      }
      break;
    }
  }
}

function explode(room, attacker, at, def, base) {
  if (room.phase !== 'playing') return;
  broadcast(room, { t: 'boom', at });
  for (const target of room.players.values()) {
    if (!target.alive || target.state === 'bus') continue;
    const d = dist3(target.pos, [at[0], at[1] - 0.9, at[2]]);
    if (d > def.splash) continue;
    const dmg = base * (1 - (d / def.splash) * 0.6);
    if (target !== attacker) send(attacker.ws, { t: 'hitConfirm', id: target.id, dmg: Math.round(dmg), head: false, shield: target.shield > 0, pos: target.pos });
    damagePlayer(room, target, target === attacker ? dmg * 0.5 : dmg, attacker, 'lanzacohetes');
  }
  for (const s of [...room.world.structs.values()]) {
    const c = [s.i * GRID + GRID / 2, s.y + GRID / 2, s.j * GRID + GRID / 2];
    if (dist3(c, at) < def.splash + GRID * 0.6) damageStruct(room, s, def.struct);
  }
  // piezas del mapa dentro del radio (cada una una sola vez, con menos daño cuanto más lejos)
  const golpes = new Map();
  room.world.sol.near(at[0], at[2], def.splash, (s) => {
    if (!(s.pz >= 0) || s.dead) return;
    const d = s.cyl
      ? Math.max(0, Math.hypot(at[0] - s.x, at[2] - s.z) - s.r, s.y0 - at[1], at[1] - s.y1)
      : Math.hypot(Math.max(s.x0 - at[0], 0, at[0] - s.x1), Math.max(s.y0 - at[1], 0, at[1] - s.y1), Math.max(s.z0 - at[2], 0, at[2] - s.z1));
    if (d < def.splash && d < (golpes.get(s.pz) ?? Infinity)) golpes.set(s.pz, d);
  });
  const sanas = [];
  for (const [id, d] of golpes) if (!damagePieza(room, id, def.struct * (1 - (d / def.splash) * 0.5), false)) sanas.push(id);
  const vivas = sanas.filter((id) => !room.world.piezas[id].rota && !room.world.piezas[id].fija);
  if (vivas.length) broadcast(room, { t: 'pzHp', ids: vivas, hp: vivas.map((id) => Math.ceil(room.pzHp[id])) });
  for (const a of room.autos) {
    const d = dist3([a.x, a.y + 0.8, a.z], at);
    if (d < def.splash + 2.3) danarAuto(room, a, def.struct * (1 - Math.max(0, d - 2.3) / def.splash * 0.5), attacker);
  }
}

// ---------- Autos ----------
function avisarAsientos(room, a) {
  broadcast(room, { t: 'autoSeats', a: a.id, seats: a.seats, ctrl: a.ctrl });
}
function bajarDelAuto(room, p) {
  const a = room.autos[p.auto.a];
  if (a && a.seats[p.auto.k] === p.id) a.seats[p.auto.k] = null;
  p.auto = null;
  if (p.state === 'auto') p.state = 'ground';
  if (a) avisarAsientos(room, a);
}
// Daño a un auto. Al romperse explota: lastima a los de adentro y a los de al lado, y los saca. Devuelve true si se rompió.
function danarAuto(room, a, dmg, atacante) {
  if (a.rota || !(dmg > 0)) return false;
  a.hp -= dmg;
  if (a.hp > 0) { broadcast(room, { t: 'autoHp', a: a.id, hp: Math.ceil(a.hp) }); return false; }
  a.hp = 0; a.rota = true; a.vx = a.vy = a.vz = 0;
  broadcast(room, { t: 'autoBoom', a: a.id });
  for (const id of a.seats) {
    const q = id !== null && room.players.get(id);
    if (q && q.auto) bajarDelAuto(room, q);
  }
  for (const target of room.players.values()) {
    if (!target.alive || target.state === 'bus') continue;
    const d = dist3(target.pos, [a.x, a.y + 0.6, a.z]);
    if (d > 7) continue;
    const golpe = Math.round(70 * (1 - d / 7) + 10);
    if (atacante && target !== atacante) send(atacante.ws, { t: 'hitConfirm', id: target.id, dmg: golpe, head: false, shield: target.shield > 0, pos: target.pos });
    damagePlayer(room, target, golpe, atacante && atacante !== target ? atacante : null, 'auto');
  }
  return true;
}


// ---------- Embestidas (autos que rompen lo que chocan) ----------
// Cosa chocada que manda el cliente, validada: { pz } | { key } | { res, idx }, o null.
function cosaEmbestida(o) {
  if (!o || typeof o !== 'object') return null;
  if (Number.isInteger(o.pz) && o.pz >= 0) return { pz: o.pz };
  if (typeof o.key === 'string' && o.key.length < 40) return { key: o.key };
  if ((o.res === 'tree' || o.res === 'rock') && Number.isInteger(o.idx) && o.idx >= 0) return { res: o.res, idx: o.idx };
  return null;
}
// Distancia (horizontal) del centro del auto a la cosa.
function distEmbestida(room, o, a) {
  const W = room.world;
  const caja = (b) => Math.hypot(Math.max(b[0] - a.x, 0, a.x - b[3]), Math.max(b[2] - a.z, 0, a.z - b[5]));
  if (o.pz !== undefined) {
    const p = W.piezas[o.pz];
    return p && a.y + 1.6 > p.aabb[1] && a.y < p.aabb[4] ? caja(p.aabb) : Infinity;
  }
  if (o.key) {
    const s = W.structs.get(o.key);
    return s?.boxes?.length ? Math.min(...s.boxes.map((b) => caja([b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ]))) : Infinity;
  }
  const r = (o.res === 'tree' ? W.trees : W.rocks)[o.idx];
  return r ? Math.max(0, Math.hypot(r.x - a.x, r.z - a.z) - (r.circle?.r || 0)) : Infinity;
}
function vidaEmbestida(room, o, now) {
  if (o.pz !== undefined) return room.pzHp[o.pz];
  if (o.key) { const s = room.world.structs.get(o.key); return s ? vidaDe(s, now) : 0; }
  return (o.res === 'tree' ? room.trees : room.rocks)[o.idx] ?? 0;
}
// Daño a un árbol o una roca (sin dar materiales: los da el pico). Devuelve true si se rompió.
function danarRecurso(room, res, idx, dmg) {
  const list = res === 'tree' ? room.trees : room.rocks;
  if (!(list[idx] > 0)) return false;
  list[idx] -= dmg;
  if (list[idx] > 0) { broadcast(room, { t: 'resHit', res, idx }); return false; }
  room.world.destroyResource(res, idx);
  broadcast(room, { t: 'resGone', res, idx });
  return true;
}

// Distancia de un punto a la caja de una pieza del mapa.
function distPieza(room, id, p) {
  const a = room.world.piezas[id]?.aabb;
  if (!a) return Infinity;
  return Math.hypot(Math.max(a[0] - p[0], 0, p[0] - a[3]), Math.max(a[1] - p[1], 0, p[1] - a[4]), Math.max(a[2] - p[2], 0, p[2] - a[5]));
}

// Daño a una pieza del mapa. Si se rompe, se caen también las piezas de su estructura que quedan sin apoyo,
// y lo que estaba arriba (loot, cofres) baja hasta el piso nuevo. Devuelve true si se rompió.
function damagePieza(room, id, dmg, avisar = true) {
  const pz = room.world.piezas[id];
  if (!pz || pz.fija || pz.rota || !(dmg > 0)) return false;
  room.pzHp[id] -= dmg;
  if (room.pzHp[id] > 0) {
    // la vida nueva a todos: con eso cada uno dibuja las grietas (y el que pega, la barra)
    if (avisar) broadcast(room, { t: 'pzHp', ids: [id], hp: [Math.ceil(room.pzHp[id])] });
    return false;
  }
  const rotas = [id];
  room.world.romperPieza(id);
  for (const c of room.world.piezasSinApoyo(id)) if (room.world.romperPieza(c)) rotas.push(c);
  room.pzRotas.push(...rotas);
  broadcast(room, { t: 'pzRota', ids: rotas });
  // las rutas de los bots que pasaban por ahí se vuelven a calcular
  if (room.nav) for (const r of rotas) room.nav.invalidar(room.world.piezas[r].aabb);
  // construcciones de jugadores que se apoyaban en lo que se rompió
  const cajasCaidas = [];
  const caidas = derrumbar(room, cajasCaidas);
  if (caidas.length) broadcast(room, { t: 'structDel', key: null, caidas });
  // lo que quedó en el aire cae (y lo que estaba sobre construcciones que se cayeron)
  const dentro = (p, a) => p[0] > a[0] - 0.3 && p[0] < a[3] + 0.3 && p[2] > a[2] - 0.3 && p[2] < a[5] + 0.3 && p[1] > a[1] - 0.3 && p[1] < a[4] + 1.5;
  const zonas = rotas.map((r) => room.world.piezas[r].aabb);
  acomodarItems(room, [...zonas.map(cajaDeAabb), ...cajasCaidas]);
  room.chests.forEach((c, idx) => {
    if (!zonas.some((a) => dentro([c.x, c.y, c.z], a))) return;
    const g = room.world.groundHeight(c.x, c.z, c.y + 0.3);
    if (g < c.y - 0.05) { c.y = +g.toFixed(2); c.movido = true; room.world.moveChest(idx, c.y); broadcast(room, { t: 'chestMove', idx, y: c.y }); }
  });
  return true;
}

const RARITIESmul = (it) => 1 + it.rarity * 0.05;

// ---------- Punto débil del pico (golpe crítico) ----------
// El servidor elige dónde aparece (cerca del golpe, sobre la misma cosa) y decide si un golpe fue crítico:
// el punto del golpe que manda el cliente tiene que estar a PUNTO_DEBIL.radio del punto débil que eligió.
const idDe = (o) => (o.pz !== undefined ? `z${o.pz}` : o.key ? `s${o.key}` : `${o.res}${o.idx}`);
const finito = (a) => Array.isArray(a) && a.length === 3 && a.every(Number.isFinite);
function distSolido(s, p) {
  if (s.cyl) return Math.max(0, Math.hypot(p[0] - s.x, p[2] - s.z) - s.r, s.y0 - p[1], p[1] - s.y1);
  return Math.hypot(Math.max(s.x0 - p[0], 0, p[0] - s.x1), Math.max(s.y0 - p[1], 0, p[1] - s.y1), Math.max(s.z0 - p[2], 0, p[2] - s.z1));
}
// ¿El punto p está sobre la cosa o (con margen m)?
function sobre(room, o, p, m) {
  const W = room.world;
  if (o.pz !== undefined) return W.piezas[o.pz].solids.some((s) => !s.dead && distSolido(s, p) <= m);
  if (o.key) {
    const s = W.structs.get(o.key);
    if (!s) return false;
    if (s.type === 'pared') return (s.boxes || []).some((b) => distSolido({ x0: b.minX, x1: b.maxX, y0: b.minY, y1: b.maxY, z0: b.minZ, z1: b.maxZ }, p) <= m);
    const y = superficie(s, p[0], p[2]);
    return y !== null && p[1] >= y - DEBAJO[s.type] - m && p[1] <= y + m;
  }
  const info = (o.res === 'tree' ? W.trees : W.rocks)[o.idx];
  if (!info) return false;
  if (o.res === 'tree') return Math.hypot(p[0] - info.x, p[2] - info.z) <= 0.45 * info.s + 0.8 + m && p[1] > info.y - 0.5 && p[1] < info.y + 9 * info.s;
  return Math.hypot(p[0] - info.x, p[1] - info.y, p[2] - info.z) <= info.s * 1.7 + 0.6 + m;
}
// Punto del golpe que manda el cliente, si es creíble (cerca del jugador y sobre la cosa); si no, null.
function puntoGolpe(room, player, o, at) {
  if (!finito(at) || dist3(at, player.pos) > PICKAXE.range + 3.2) return null;
  return sobre(room, o, at, 0.5) ? at : null;
}
function esCritico(player, o, at, now) {
  const d = player.debil;
  if (!at || !d || d.id !== idDe(o) || now > d.hasta) return false;
  return dist3(at, d.p) <= PUNTO_DEBIL.radio;
}
// Elige un punto débil nuevo cerca de at (o null si no encuentra uno que quede sobre la cosa).
function nuevoDebil(room, o, at, nCliente) {
  const W = room.world, [d0, d1] = PUNTO_DEBIL.dist;
  if (o.res) {
    const info = (o.res === 'tree' ? W.trees : W.rocks)[o.idx];
    if (!info) return null;
    for (let k = 0; k < 12; k++) {
      const r = d0 + Math.random() * (d1 - d0), ang = Math.random() * Math.PI * 2;
      if (o.res === 'tree') {
        // alrededor del tronco, a la altura de la mano
        const R = Math.min(Math.max(0.2, Math.hypot(at[0] - info.x, at[2] - info.z)), 0.45 * info.s + 0.25);
        const a = Math.atan2(at[2] - info.z, at[0] - info.x) + Math.max(-0.9, Math.min(0.9, (Math.cos(ang) * r) / R));
        const y = Math.max(info.y + 0.5, Math.min(info.y + 2.4, at[1] + Math.sin(ang) * r));
        return { p: [info.x + Math.cos(a) * R, y, info.z + Math.sin(a) * R], n: [Math.cos(a), 0, Math.sin(a)] };
      }
      // roca: se gira el punto del golpe alrededor del centro
      const v = [at[0] - info.x, at[1] - info.y, at[2] - info.z], R = Math.hypot(...v) || 1;
      const n = v.map((c) => c / R), t1 = Math.abs(n[1]) > 0.9 ? [1, 0, 0] : norm([-n[2], 0, n[0]]), t2 = cruz(n, t1);
      const q = norm(n.map((c, i) => c * R + (t1[i] * Math.cos(ang) + t2[i] * Math.sin(ang)) * r));
      const p = [info.x + q[0] * R, info.y + q[1] * R, info.z + q[2] * R];
      if (p[1] > W.terrainHeight(p[0], p[2]) + 0.25) return { p, n: q };
    }
    return null;
  }
  // pieza del mapa o construcción: se mueve sobre el plano de la cara golpeada
  let n = finito(nCliente) ? norm(nCliente) : null;
  if (!n) return null;
  const t1 = Math.abs(n[1]) > 0.9 ? [1, 0, 0] : norm([-n[2], 0, n[0]]), t2 = cruz(n, t1);
  for (let k = 0; k < 16; k++) {
    const r = (k < 12 ? d0 + Math.random() * (d1 - d0) : 0.35 + Math.random() * 0.2), ang = Math.random() * Math.PI * 2;
    const p = at.map((c, i) => c + (t1[i] * Math.cos(ang) + t2[i] * Math.sin(ang)) * r);
    const fuera = p.map((c, i) => c + n[i] * 0.22);
    if (sobre(room, o, p, 0.06) && !sobre(room, o, fuera, 0) && p[1] > W.terrainHeight(p[0], p[2]) + 0.3) return { p, n };
  }
  return null;
}
function norm(v) { const l = Math.hypot(...v); return l > 1e-6 ? v.map((c) => c / l) : null; }
function cruz(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
const r3 = (v) => v.map((c) => +c.toFixed(3));

// Después de un golpe de pico: el punto débil aparece con el primer golpe, se queda mientras se le siga pegando
// a lo mismo y se mueve cuando se le pega (crítico). Al que pega le llega dónde quedó y la vida (árboles y rocas).
function avisarDebil(room, player, o, at, nCliente, crit, now) {
  const id = idDe(o);
  let vida = null, max = 0;
  if (o.pz !== undefined) vida = room.world.piezas[o.pz].rota ? 0 : room.pzHp[o.pz];
  else if (o.key) { const s = room.world.structs.get(o.key); vida = s ? vidaDe(s, now) : 0; }
  else {
    vida = Math.max(0, (o.res === 'tree' ? room.trees : room.rocks)[o.idx]);
    max = o.res === 'tree' ? 150 : Math.round(150 + room.world.rocks[o.idx].s * 120);
  }
  const msg = { t: 'debil', o, crit, hp: Math.ceil(vida), max };
  const d = player.debil;
  if (!(vida > 0) || !at) {
    if (!(vida > 0) && d?.id === id) player.debil = null;
    msg.p = !(vida > 0) || !d || d.id !== id ? null : d.p;
    if (msg.p) msg.n = d.n;
  } else if (crit || !d || d.id !== id || now > d.hasta) {
    const nuevo = nuevoDebil(room, o, at, nCliente);
    player.debil = nuevo ? { id, p: nuevo.p, n: nuevo.n, hasta: now + PUNTO_DEBIL.dura * 1000 } : null;
    msg.p = nuevo ? r3(nuevo.p) : null;
    if (nuevo) msg.n = r3(nuevo.n);
  } else {
    d.hasta = now + PUNTO_DEBIL.dura * 1000; // le siguió pegando a lo mismo: el punto se queda
    msg.p = r3(d.p); msg.n = r3(d.n);
  }
  send(player.ws, msg);
}

function damageStruct(room, s, dmg) {
  if (!room.world.structs.has(s.key) || !(dmg > 0)) return;
  s.dano = (s.dano || 0) + dmg;
  const hp = vidaDe(s, Date.now());
  if (hp <= 0) {
    room.world.removeStruct(s.key);
    const cajas = [cajaPieza(s)];
    broadcast(room, { t: 'structDel', key: s.key, caidas: derrumbar(room, cajas) });
    acomodarItems(room, cajas);
  } else broadcast(room, { t: 'structHp', key: s.key, hp: Math.ceil(hp), dano: Math.round(s.dano) });
}

// Saca las construcciones que quedaron sin apoyo (como en el género: lo que no llega al piso se cae). Devuelve sus claves.
// cajas: si viene, se le agregan las cajas de lo que se cayó (para acomodar el loot que tenía arriba).
function derrumbar(room, cajas = null) {
  if (!room.world.structs.size) return [];
  const caidas = sinApoyo(room.world);
  for (const k of caidas) {
    const s = room.world.structs.get(k);
    if (cajas && s) cajas.push(cajaPieza(s));
    room.world.removeStruct(k);
  }
  return caidas;
}

// ---------- WebSocket ----------
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let player = null;
  let room = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (typeof msg !== 'object' || !msg) return;

    if (msg.t === 'create' || msg.t === 'join') {
      if (room) return;
      if (msg.t === 'create') room = createRoom();
      else {
        room = rooms.get(String(msg.code || '').toUpperCase().trim());
        if (!room) return send(ws, { t: 'error', message: 'No existe una sala con ese código.' });
        if (personas(room).length >= MAX_PLAYERS) { room = null; return send(ws, { t: 'error', message: 'La sala está llena.' }); }
      }
      const name = String(msg.name || 'Jugador').replace(/[<>]/g, '').slice(0, 16) || 'Jugador';
      const used = new Set([...room.players.values()].map((p) => p.color));
      player = {
        id: nextId++, ws, name, color: COLORS.find((c) => !used.has(c)) || COLORS[0],
        hp: 100, shield: 0, alive: room.phase === 'lobby', kills: 0,
        state: room.phase === 'lobby' ? 'lobby' : 'dead', pos: [0, 0, 0],
        slots: Array(SLOTS).fill(null), ammo: { ligera: 0, media: 0, pesada: 0, cartuchos: 0, cohetes: 0 }, mats: { madera: 0, piedra: 0, metal: 0 },
      };
      room.players.set(player.id, player);
      if (!room.hostId) room.hostId = player.id;
      send(ws, { t: 'welcome', id: player.id, version: VERSION, viejo: codigoViejo(), room: roomInfo(room), snap: room.world && room.phase !== 'lobby' ? matchSnapshot(room) : null });
      broadcast(room, { t: 'room', room: roomInfo(room) }, player.id);
      return;
    }
    if (!player || !room) return;
    if (msg.t === 'start') {
      if (player.id === room.hostId && room.phase === 'lobby') startMatch(room);
      return;
    }
    if (msg.t === 'bots') {
      // el anfitrión elige hasta cuántos jugadores completan los bots y su dificultad
      if (player.id !== room.hostId || room.phase !== 'lobby') return;
      const total = Number(msg.total), dif = String(msg.dif || room.bots.dif);
      if (!totalValido(total) || !dificultadValida(dif)) return;
      room.bots = { total, dif };
      broadcast(room, { t: 'room', room: roomInfo(room) });
      return;
    }
    if (msg.t === 'chat') {
      const text = String(msg.text || '').slice(0, 120);
      if (text) broadcast(room, { t: 'chat', id: player.id, name: player.name, text });
      return;
    }
    if (room.world && room.phase !== 'lobby') handleGame(room, player, msg);
  });

  ws.on('close', () => {
    if (!player || !room) return;
    if (player.auto) bajarDelAuto(room, player);
    for (const a of room.autos) if (a.ctrl === player.id) { a.ctrl = null; a.vx = a.vy = a.vz = 0; broadcast(room, { t: 'auto', a: a.id, ...estadoRed(a) }); }
    room.players.delete(player.id);
    // sin personas la sala se cierra (aunque queden bots jugando)
    const quedan = personas(room);
    if (quedan.length === 0) { rooms.delete(room.code); return; }
    if (room.hostId === player.id) room.hostId = quedan[0].id;
    broadcast(room, { t: 'left', id: player.id });
    broadcast(room, { t: 'room', room: roomInfo(room) });
    if (player.alive && room.phase !== 'lobby') checkWinner(room);
  });
});

server.listen(PORT, () => console.log(`Salto Final en http://localhost:${PORT}`));

export { DIRS };
