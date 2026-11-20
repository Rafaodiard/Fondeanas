// Servidor del battle royale: sirve el cliente y maneja salas por código vía WebSocket.
// El cliente es autoritativo sobre su movimiento; el servidor decide vida, daño, tormenta y ganador.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const ISLAND_SIZE = 1200; // metros de lado (la isla es circular dentro de este cuadrado)
const BUS_DURATION = 22; // segundos que tarda el bus en cruzar
const BUS_HEIGHT = 260;
const MAX_PLAYERS = 16;
const TICK_MS = 100;

const WEAPONS = {
  rifle: { damage: 22, range: 300, cooldown: 0.16 },
  escopeta: { damage: 70, range: 35, cooldown: 0.9 },
};

// ---------- HTTP estático ----------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  '.json': 'application/json',
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
const rooms = new Map(); // código -> sala
let nextId = 1;

function makeCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 5 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  } while (rooms.has(code));
  return code;
}

const COLORS = ['#ff5a5f', '#3fa7ff', '#ffd23f', '#5ad65a', '#c77dff', '#ff9f1c', '#2ec4b6', '#f15bb5',
  '#9b5de5', '#00bbf9', '#fee440', '#00f5d4', '#e76f51', '#8ac926', '#ff006e', '#8338ec'];

function createRoom() {
  const code = makeCode();
  const room = {
    code,
    seed: Math.floor(Math.random() * 1e9),
    phase: 'lobby', // lobby | bus | playing | ended
    players: new Map(),
    hostId: null,
    bus: null,
    storm: null,
    phaseStart: 0,
    winner: null,
  };
  rooms.set(code, room);
  return room;
}

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}
function broadcast(room, msg, exceptId) {
  const data = JSON.stringify(msg);
  for (const p of room.players.values()) {
    if (p.id !== exceptId && p.ws.readyState === 1) p.ws.send(data);
  }
}

function publicPlayer(p) {
  return { id: p.id, name: p.name, color: p.color, hp: p.hp, alive: p.alive, kills: p.kills, state: p.state };
}

function roomInfo(room) {
  return {
    code: room.code,
    seed: room.seed,
    phase: room.phase,
    hostId: room.hostId,
    islandSize: ISLAND_SIZE,
    players: [...room.players.values()].map(publicPlayer),
    bus: room.bus,
    storm: room.storm,
    serverTime: Date.now(),
  };
}

function startMatch(room) {
  room.phase = 'bus';
  room.winner = null;
  const angle = Math.random() * Math.PI * 2;
  const r = ISLAND_SIZE * 0.6;
  // El bus cruza la isla pasando cerca del centro.
  const off = (Math.random() - 0.5) * ISLAND_SIZE * 0.3;
  const px = Math.cos(angle + Math.PI / 2) * off, pz = Math.sin(angle + Math.PI / 2) * off;
  room.bus = {
    from: [Math.cos(angle) * r + px, BUS_HEIGHT, Math.sin(angle) * r + pz],
    to: [-Math.cos(angle) * r + px, BUS_HEIGHT, -Math.sin(angle) * r + pz],
    start: Date.now() + 3000, // 3 s de cuenta regresiva
    duration: BUS_DURATION * 1000,
  };
  // Tormenta: un círculo que se va achicando en fases.
  const finalX = (Math.random() - 0.5) * ISLAND_SIZE * 0.4;
  const finalZ = (Math.random() - 0.5) * ISLAND_SIZE * 0.4;
  room.storm = {
    phases: [
      // [tiempo desde inicio del bus (s), radio, centro x, centro z, daño por segundo]
      { t: 0, r: ISLAND_SIZE * 0.75, x: 0, z: 0, dps: 1 },
      { t: 70, r: ISLAND_SIZE * 0.75, x: 0, z: 0, dps: 1 },
      { t: 110, r: 330, x: finalX * 0.5, z: finalZ * 0.5, dps: 2 },
      { t: 160, r: 330, x: finalX * 0.5, z: finalZ * 0.5, dps: 2 },
      { t: 200, r: 140, x: finalX * 0.8, z: finalZ * 0.8, dps: 5 },
      { t: 240, r: 140, x: finalX * 0.8, z: finalZ * 0.8, dps: 5 },
      { t: 270, r: 40, x: finalX, z: finalZ, dps: 8 },
      { t: 300, r: 40, x: finalX, z: finalZ, dps: 8 },
      { t: 330, r: 0, x: finalX, z: finalZ, dps: 15 },
    ],
    start: room.bus.start,
  };
  for (const p of room.players.values()) {
    p.hp = 100; p.alive = true; p.kills = 0; p.state = 'bus';
    p.pos = [...room.bus.from]; p.lastShot = 0;
  }
  broadcast(room, { t: 'matchStart', room: roomInfo(room) });
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

function killPlayer(room, victim, killer, cause) {
  if (!victim.alive) return;
  victim.alive = false;
  victim.hp = 0;
  victim.state = 'dead';
  if (killer && killer !== victim) killer.kills++;
  broadcast(room, {
    t: 'death', id: victim.id, by: killer ? killer.id : null, cause,
    players: [...room.players.values()].map(publicPlayer),
  });
  checkWinner(room);
}

function checkWinner(room) {
  if (room.phase !== 'playing' && room.phase !== 'bus') return;
  const alive = [...room.players.values()].filter((p) => p.alive);
  const total = room.players.size;
  // Con un solo jugador en la sala se puede jugar a explorar; termina sólo si muere.
  if ((total > 1 && alive.length <= 1) || alive.length === 0) {
    room.phase = 'ended';
    room.winner = alive[0] ? alive[0].id : null;
    broadcast(room, { t: 'matchEnd', winner: room.winner, players: [...room.players.values()].map(publicPlayer) });
    setTimeout(() => {
      if (!rooms.has(room.code)) return;
      room.phase = 'lobby';
      for (const p of room.players.values()) { p.state = 'lobby'; p.alive = true; p.hp = 100; }
      broadcast(room, { t: 'room', room: roomInfo(room) });
    }, 8000);
  }
}

function tick() {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.phase === 'bus' && now > room.bus.start) {
      room.phase = 'playing';
      broadcast(room, { t: 'phase', phase: 'playing' });
    }
    if (room.phase === 'playing') {
      // Expulsión automática del bus al final del recorrido.
      if (now > room.bus.start + room.bus.duration) {
        for (const p of room.players.values()) {
          if (p.state === 'bus') { p.state = 'falling'; broadcast(room, { t: 'forceJump', id: p.id }); }
        }
      }
      // Daño de tormenta.
      const s = stormAt(room.storm, now);
      for (const p of room.players.values()) {
        if (!p.alive || p.state === 'bus') continue;
        const dx = p.pos[0] - s.x, dz = p.pos[2] - s.z;
        if (dx * dx + dz * dz > s.r * s.r) {
          p.hp -= s.dps * (TICK_MS / 1000);
          if (p.hp <= 0) killPlayer(room, p, null, 'storm');
          else send(p.ws, { t: 'hp', hp: Math.ceil(p.hp) });
        }
      }
    }
  }
}
setInterval(tick, TICK_MS);

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
        if (!room) { room = null; return send(ws, { t: 'error', message: 'No existe una sala con ese código.' }); }
        if (room.players.size >= MAX_PLAYERS) { room = null; return send(ws, { t: 'error', message: 'La sala está llena.' }); }
      }
      const name = String(msg.name || 'Jugador').replace(/[<>]/g, '').slice(0, 16) || 'Jugador';
      player = {
        id: nextId++, ws, name,
        color: COLORS[room.players.size % COLORS.length],
        hp: 100, alive: room.phase === 'lobby', kills: 0,
        state: room.phase === 'lobby' ? 'lobby' : 'dead',
        pos: [0, 0, 0], rot: 0, lastShot: 0,
      };
      room.players.set(player.id, player);
      if (!room.hostId) room.hostId = player.id;
      send(ws, { t: 'welcome', id: player.id, room: roomInfo(room) });
      broadcast(room, { t: 'room', room: roomInfo(room) }, player.id);
      return;
    }
    if (!player || !room) return;

    switch (msg.t) {
      case 'start':
        if (player.id === room.hostId && room.phase === 'lobby') startMatch(room);
        break;
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
        player.rot = Number(msg.r) || 0;
        if (['falling', 'glider', 'ground'].includes(msg.s)) player.state = msg.s;
        broadcast(room, { t: 'state', id: player.id, p, r: player.rot, s: player.state, a: msg.a, w: msg.w }, player.id);
        break;
      }
      case 'shoot': {
        if (!player.alive || room.phase !== 'playing' || player.state !== 'ground') break;
        const w = WEAPONS[msg.w];
        if (!w) break;
        const now = Date.now() / 1000;
        if (now - player.lastShot < w.cooldown * 0.8) break; // anti-spam
        player.lastShot = now;
        broadcast(room, { t: 'shot', id: player.id, from: msg.from, to: msg.to, w: msg.w }, player.id);
        if (msg.hit) {
          const target = room.players.get(msg.hit);
          if (!target || !target.alive || target === player) break;
          const dx = target.pos[0] - player.pos[0], dy = target.pos[1] - player.pos[1], dz = target.pos[2] - player.pos[2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist > w.range + 5) break;
          let dmg = w.damage;
          if (msg.w === 'escopeta') {
            const frac = Math.min(1, Math.max(0, Number(msg.frac) || 0));
            dmg = 95 * frac * Math.max(0.3, 1 - dist / w.range);
          }
          if (msg.head) dmg *= 1.6;
          target.hp -= dmg;
          send(player.ws, { t: 'hitConfirm', id: target.id, dmg: Math.round(dmg), head: !!msg.head });
          if (target.hp <= 0) killPlayer(room, target, player, msg.w);
          else send(target.ws, { t: 'hp', hp: Math.ceil(target.hp), from: player.id });
        }
        break;
      }
      case 'chat': {
        const text = String(msg.text || '').slice(0, 120);
        if (text) broadcast(room, { t: 'chat', id: player.id, name: player.name, text });
        break;
      }
    }
  });

  ws.on('close', () => {
    if (!player || !room) return;
    room.players.delete(player.id);
    if (room.players.size === 0) { rooms.delete(room.code); return; }
    if (room.hostId === player.id) room.hostId = room.players.keys().next().value;
    broadcast(room, { t: 'left', id: player.id });
    broadcast(room, { t: 'room', room: roomInfo(room) });
    if (player.alive) checkWinner(room);
  });
});

server.listen(PORT, () => console.log(`Battle royale en http://localhost:${PORT}`));
