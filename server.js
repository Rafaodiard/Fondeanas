// Servidor de Salto Final: sirve el cliente y maneja salas por código vía WebSocket.
// El cliente decide su movimiento; el servidor decide inventario, loot, daño, construcciones, tormenta y ganador.
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { World } from './public/js/world.js';
import {
  WEAPONS, CONSUMABLES, AMMO, MATERIALS, BUILD_COST, MAX_MATS, PICKAXE, SLOTS, GRID, DIRS,
  randomWeapon, randomConsumable, randomAmmo, weaponDamage, weaponReload, structKey,
} from './public/js/items.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const ISLAND_SIZE = 1200;
const BUS_DURATION = 22;
const BUS_HEIGHT = 260;
const MAX_PLAYERS = 16;
const TICK_MS = 100;
const PICKUP_RANGE = 3.2;

// ---------- HTTP estático ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.glb': 'model/gltf-binary', '.png': 'image/png', '.json': 'application/json',
};
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
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
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
    trees: [], rocks: [],
  };
  rooms.set(room.code, room);
  return room;
}

const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };
function broadcast(room, msg, exceptId) {
  const data = JSON.stringify(msg);
  for (const p of room.players.values()) if (p.id !== exceptId && p.ws.readyState === 1) p.ws.send(data);
}
const publicPlayer = (p) => ({ id: p.id, name: p.name, color: p.color, alive: p.alive, kills: p.kills, state: p.state });

function roomInfo(room) {
  return {
    code: room.code, seed: room.seed, phase: room.phase, hostId: room.hostId, islandSize: ISLAND_SIZE,
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
  };
}
const structPublic = (s) => ({ key: s.key, type: s.type, i: s.i, j: s.j, y: s.y, dir: s.dir, mat: s.mat, hp: s.hp });

function invMsg(p) {
  return { t: 'inv', slots: p.slots, ammo: p.ammo, mats: p.mats, hp: Math.ceil(p.hp), shield: Math.ceil(p.shield) };
}

function spawnItem(room, item, x, y, z) {
  const it = { ...item, id: room.nextItem++, x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2) };
  room.items.set(it.id, it);
  return it;
}

function spawnAround(room, list, x, y, z) {
  const out = list.map((item, k) => {
    const a = (k / list.length) * Math.PI * 2 + Math.random();
    const r = 1 + Math.random() * 0.8;
    const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    return spawnItem(room, item, px, Math.max(y, room.world.groundHeight(px, pz, y + 1)), pz);
  });
  if (out.length) broadcast(room, { t: 'itemsAdd', items: out });
  return out;
}

function startMatch(room) {
  room.phase = 'bus';
  room.winner = null;
  room.world = new World(room.seed, ISLAND_SIZE);
  room.items = new Map();
  room.nextItem = 1;
  room.trees = room.world.trees.map(() => 150);
  room.rocks = room.world.rocks.map((r) => Math.round(150 + r.s * 120));
  room.chests = room.world.chestSpots.map((c) => ({ ...c, open: false }));
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
  for (const p of room.players.values()) resetPlayer(p, room);
  broadcast(room, { t: 'matchStart', room: roomInfo(room), snap: matchSnapshot(room) });
  for (const p of room.players.values()) send(p.ws, invMsg(p));
}

function resetPlayer(p, room) {
  p.hp = 100; p.shield = 0; p.alive = true; p.kills = 0; p.state = 'bus';
  p.pos = [...room.bus.from]; p.lastShot = 0; p.lastSwing = 0; p.use = null;
  p.slots = Array(SLOTS).fill(null);
  p.ammo = { ligera: 0, media: 0, pesada: 0, cartuchos: 0, cohetes: 0 };
  p.mats = { madera: 0, piedra: 0, metal: 0 };
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
  return false;
}

function dist3(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }

function killPlayer(room, victim, killer, cause) {
  if (!victim.alive) return;
  victim.alive = false; victim.hp = 0; victim.shield = 0; victim.state = 'dead';
  if (killer && killer !== victim) killer.kills++;
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
  if ((room.players.size > 1 && alive.length <= 1) || alive.length === 0) {
    room.phase = 'ended';
    room.winner = alive[0] ? alive[0].id : null;
    broadcast(room, { t: 'matchEnd', winner: room.winner, players: [...room.players.values()].map(publicPlayer) });
    setTimeout(() => {
      if (!rooms.has(room.code)) return;
      room.phase = 'lobby';
      for (const p of room.players.values()) { p.state = 'lobby'; p.alive = true; p.hp = 100; }
      broadcast(room, { t: 'room', room: roomInfo(room) });
    }, 9000);
  }
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
      player.pos = p;
      if (['falling', 'glider', 'ground'].includes(msg.s)) player.state = msg.s;
      broadcast(room, { t: 'state', id: player.id, p, r: Number(msg.r) || 0, s: player.state, a: !!msg.a, h: msg.h, sw: !!msg.sw }, player.id);
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
      if (!c || c.open || !player.alive || dist3(player.pos, [c.x, c.y, c.z]) > PICKUP_RANGE + 1) break;
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
        if (h.key) {
          const s = room.world.structs.get(h.key);
          if (s) damageStruct(room, s, def.struct * RARITIESmul(it) * (n / def.pellets) * (def.pellets > 1 ? 1 : 1));
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
        if (s) damageStruct(room, s, PICKAXE.struct);
      } else if (msg.res === 'tree' || msg.res === 'rock' || msg.res === 'house') {
        let gainMat, amount;
        if (msg.res === 'house') {
          [gainMat, amount] = PICKAXE.gain.house;
        } else {
          const list = msg.res === 'tree' ? room.trees : room.rocks;
          const info = (msg.res === 'tree' ? room.world.trees : room.world.rocks)[msg.idx];
          if (!info || list[msg.idx] <= 0) break;
          if (Math.hypot(info.x - player.pos[0], info.z - player.pos[2]) > PICKAXE.range + info.s * 2 + 2) break;
          list[msg.idx] -= 50;
          [gainMat, amount] = PICKAXE.gain[msg.res];
          if (list[msg.idx] <= 0) {
            room.world.destroyResource(msg.res, msg.idx);
            broadcast(room, { t: 'resGone', res: msg.res, idx: msg.idx });
            amount *= 2;
          } else broadcast(room, { t: 'resHit', res: msg.res, idx: msg.idx }, player.id);
        }
        player.mats[gainMat] = Math.min(MAX_MATS, player.mats[gainMat] + amount);
        send(player.ws, { ...invMsg(player), gained: [gainMat, amount] });
      }
      break;
    }
    case 'build': {
      if (!player.alive || player.state === 'bus' || room.phase !== 'playing') break;
      const { type, i, j, y, dir, mat } = msg;
      if (!['pared', 'piso', 'rampa'].includes(type) || !MATERIALS[mat]) break;
      if (![i, j, y * 2, dir].every(Number.isInteger) || dir < 0 || dir > 3) break;
      if (player.mats[mat] < BUILD_COST) break;
      const cx = i * GRID + GRID / 2, cz = j * GRID + GRID / 2;
      if (Math.hypot(cx - player.pos[0], cz - player.pos[2]) > GRID * 3 || Math.abs(y - player.pos[1]) > GRID * 2.5) break;
      const s = { type, i, j, y, dir, mat };
      s.key = structKey(s);
      if (room.world.structs.has(s.key)) break;
      if (type === 'pared') { // normalizar como la clave
        if (dir === 2) { s.j += 1; s.dir = 0; }
        if (dir === 1) { s.i += 1; s.dir = 3; }
      }
      s.hp = MATERIALS[mat].hp;
      s.owner = player.id;
      room.world.addStruct(s);
      player.mats[mat] -= BUILD_COST;
      broadcast(room, { t: 'structAdd', s: structPublic(s) });
      send(player.ws, invMsg(player));
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
}

const RARITIESmul = (it) => 1 + it.rarity * 0.05;

function damageStruct(room, s, dmg) {
  s.hp -= dmg;
  if (s.hp <= 0) {
    room.world.removeStruct(s.key);
    broadcast(room, { t: 'structDel', key: s.key });
  } else broadcast(room, { t: 'structHp', key: s.key, hp: Math.ceil(s.hp) });
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
        if (room.players.size >= MAX_PLAYERS) { room = null; return send(ws, { t: 'error', message: 'La sala está llena.' }); }
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
      send(ws, { t: 'welcome', id: player.id, room: roomInfo(room), snap: room.world && room.phase !== 'lobby' ? matchSnapshot(room) : null });
      broadcast(room, { t: 'room', room: roomInfo(room) }, player.id);
      return;
    }
    if (!player || !room) return;
    if (msg.t === 'start') {
      if (player.id === room.hostId && room.phase === 'lobby') startMatch(room);
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
    room.players.delete(player.id);
    if (room.players.size === 0) { rooms.delete(room.code); return; }
    if (room.hostId === player.id) room.hostId = room.players.keys().next().value;
    broadcast(room, { t: 'left', id: player.id });
    broadcast(room, { t: 'room', room: roomInfo(room) });
    if (player.alive && room.phase !== 'lobby') checkWinner(room);
  });
});

server.listen(PORT, () => console.log(`Salto Final en http://localhost:${PORT}`));

export { DIRS };
