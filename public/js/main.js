import * as THREE from 'three';
import { World } from './world.js';
import { createCharacter, animateCharacter, createBus, createNameTag } from './models.js';

// ---------- Constantes de juego ----------
const WEAPONS = {
  rifle: { name: 'Rifle', mag: 30, reload: 1.8, cooldown: 0.16, range: 300, spread: 0.012, aimSpread: 0.003, pellets: 1 },
  escopeta: { name: 'Escopeta', mag: 5, reload: 2.4, cooldown: 0.9, range: 35, spread: 0.07, aimSpread: 0.05, pellets: 9 },
};
const GRAVITY = 25, WALK = 6, SPRINT = 9.5, AIM_WALK = 3.5, JUMP = 8.5, SWIM_Y = -1.3;
const FREEFALL_V = 42, FREEFALL_H = 20, GLIDER_V = 8, GLIDER_H = 17, AUTO_GLIDER = 70;

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const canvas = $('game');
const ui = {
  menu: $('menu'), lobby: $('lobby'), hud: $('hud'), name: $('name'), code: $('code'), menuError: $('menuError'),
  roomCode: $('roomCode'), playerList: $('playerList'), btnStart: $('btnStart'), waitHost: $('waitHost'),
  center: $('center-msg'), alive: $('alive'), kills: $('kills'), storm: $('stormInfo'), minimap: $('minimap'),
  killfeed: $('killfeed'), hpfill: $('hpfill'), hptext: $('hptext'), hit: $('hitmarker'), damage: $('damage'),
  chatlog: $('chatlog'), chatInput: $('chatInput'), click: $('clickToPlay'),
};
ui.name.value = localStorageGet('br-name') || '';

function localStorageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } }

// ---------- Three.js ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
const SKY = new THREE.Color('#8fd0f5');
scene.background = SKY;
scene.fog = new THREE.Fog(SKY, 250, 1100);
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 3000);
scene.add(new THREE.HemisphereLight('#dff3ff', '#5a7a3a', 1.1));
const sun = new THREE.DirectionalLight('#fff4e0', 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 600 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);
const SUN_DIR = new THREE.Vector3(0.5, 1, 0.3).normalize();

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// Tormenta: cilindro translúcido gigante.
const stormMat = new THREE.MeshBasicMaterial({ color: '#7b4dff', transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false, fog: false });
const stormMesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 2000, 96, 1, true), stormMat);
stormMesh.visible = false;
scene.add(stormMesh);

// ---------- Estado ----------
let ws = null, myId = null, room = null, world = null, serverOffset = 0;
const others = new Map(); // id -> { info, mesh, tag, target, rot, state, prev, speed }
const me = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: -0.2, state: 'lobby',
  hp: 100, kills: 0, onGround: false, weapon: 'rifle', aiming: false, gliderUsed: false,
  ammo: { rifle: 30, escopeta: 5 }, reloading: 0, lastShot: 0, mesh: null, spectate: null,
};
let bus = null;
const keys = {};
let mouseDown = false;
let locked = false;
const tracers = [];
let minimapBase = null;

const now = () => Date.now() + serverOffset;

// ---------- Red ----------
function connect(onOpen) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);
  ws.onopen = onOpen;
  ws.onmessage = (e) => handle(JSON.parse(e.data));
  ws.onclose = () => {
    if (myId) { showCenter('Se perdió la conexión con el servidor', 'Recargá la página para volver a entrar'); }
    else ui.menuError.textContent = 'No se pudo conectar con el servidor.';
  };
}
function sendMsg(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }

function enter(type) {
  const name = ui.name.value.trim() || 'Jugador';
  localStorageSet('br-name', name);
  const code = ui.code.value.trim().toUpperCase();
  if (type === 'join' && code.length < 4) { ui.menuError.textContent = 'Escribí el código de la sala.'; return; }
  ui.menuError.textContent = '';
  const go = () => sendMsg({ t: type, name, code });
  if (ws && ws.readyState === 1) go(); else connect(go);
}
$('btnCreate').onclick = () => enter('create');
$('btnJoin').onclick = () => enter('join');
ui.code.addEventListener('keydown', (e) => { if (e.key === 'Enter') enter('join'); });
ui.btnStart.onclick = () => sendMsg({ t: 'start' });
ui.roomCode.onclick = () => navigator.clipboard?.writeText(room.code).catch(() => {});
// Unirse directo con ?sala=CODIGO
const urlCode = new URLSearchParams(location.search).get('sala');
if (urlCode) ui.code.value = urlCode.toUpperCase();

function handle(m) {
  switch (m.t) {
    case 'error': ui.menuError.textContent = m.message; break;
    case 'welcome':
      myId = m.id;
      setRoom(m.room);
      ensureWorld();
      if (room.phase === 'lobby') showLobby();
      else { setupMatch(); me.state = 'dead'; me.hp = 0; startSpectating(); showCenter('Partida en curso', 'Vas a poder jugar en la próxima'); }
      break;
    case 'room':
      setRoom(m.room);
      if (room.phase === 'lobby') showLobby();
      break;
    case 'matchStart':
      setRoom(m.room);
      ensureWorld();
      setupMatch();
      break;
    case 'phase': room.phase = m.phase; break;
    case 'forceJump': if (m.id === myId && me.state === 'bus') jumpFromBus(); else markJumped(m.id); break;
    case 'jumped': markJumped(m.id); break;
    case 'state': {
      const o = others.get(m.id);
      if (!o) break;
      o.target.fromArray(m.p);
      o.rotTarget = m.r; o.state = m.s; o.aiming = m.a; o.weapon = m.w;
      if (!o.seen) { o.mesh.position.copy(o.target); o.seen = true; }
      break;
    }
    case 'shot': addTracer(new THREE.Vector3().fromArray(m.from), new THREE.Vector3().fromArray(m.to), m.w); break;
    case 'hitConfirm':
      ui.hit.classList.toggle('head', m.head);
      ui.hit.classList.add('show');
      setTimeout(() => ui.hit.classList.remove('show'), 90);
      break;
    case 'hp':
      if (m.hp < me.hp) { ui.damage.classList.add('show'); setTimeout(() => ui.damage.classList.remove('show'), 120); }
      me.hp = m.hp; updateHp();
      break;
    case 'death': onDeath(m); break;
    case 'matchEnd': onMatchEnd(m); break;
    case 'left': removeOther(m.id); break;
    case 'chat': addChat(`<b>${escapeHtml(m.name)}:</b> ${escapeHtml(m.text)}`); break;
  }
}

function setRoom(r) {
  room = r;
  serverOffset = r.serverTime - Date.now();
  // Sincronizar jugadores remotos.
  const ids = new Set(r.players.map((p) => p.id));
  for (const id of [...others.keys()]) if (!ids.has(id)) removeOther(id);
  for (const p of r.players) {
    if (p.id === myId) { me.kills = p.kills; me.color = p.color; me.name = p.name; continue; }
    let o = others.get(p.id);
    if (!o) {
      const mesh = createCharacter(p.color);
      const tag = createNameTag(p.name, p.color);
      mesh.add(tag);
      mesh.visible = false;
      scene.add(mesh);
      o = { mesh, tag, target: new THREE.Vector3(), rotTarget: 0, state: p.state, prev: new THREE.Vector3(), speed: 0, seen: false };
      others.set(p.id, o);
    }
    o.info = p;
    o.state = p.state;
  }
}
function removeOther(id) {
  const o = others.get(id);
  if (!o) return;
  scene.remove(o.mesh);
  others.delete(id);
}
function markJumped(id) {
  const o = others.get(id);
  if (!o || !bus) return;
  o.state = 'falling';
  o.target.copy(bus.position).y -= 3;
  o.mesh.position.copy(o.target);
  o.seen = true;
}

function ensureWorld() {
  if (world && world.seed === room.seed) return;
  if (world) { // Mundo de otra sala: reiniciar escena (no debería pasar, pero por las dudas)
    location.reload();
    return;
  }
  world = new World(room.seed, room.islandSize);
  world.build(scene);
  minimapBase = world.minimapImage(200);
  if (!me.mesh) {
    me.mesh = createCharacter('#ffffff');
    me.mesh.visible = false;
    scene.add(me.mesh);
  }
  if (!bus) { bus = createBus(); bus.visible = false; scene.add(bus); }
}

// ---------- Pantallas ----------
function showLobby() {
  ui.menu.classList.add('hidden');
  ui.hud.classList.add('hidden');
  ui.lobby.classList.remove('hidden');
  me.state = 'lobby';
  me.mesh && (me.mesh.visible = false);
  for (const o of others.values()) o.mesh.visible = false;
  bus && (bus.visible = false);
  stormMesh.visible = false;
  document.exitPointerLock?.();
  ui.roomCode.textContent = room.code;
  ui.playerList.innerHTML = room.players.map((p) =>
    `<li><span class="dot" style="background:${p.color}"></span>${escapeHtml(p.name)}${p.id === room.hostId ? ' 👑' : ''}${p.id === myId ? ' (vos)' : ''}</li>`).join('');
  const host = room.hostId === myId;
  ui.btnStart.classList.toggle('hidden', !host);
  ui.waitHost.classList.toggle('hidden', host);
  ui.btnStart.textContent = room.players.length > 1 ? 'Empezar partida' : 'Empezar (solo, para explorar)';
}

function setupMatch() {
  ui.lobby.classList.add('hidden');
  ui.menu.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  ui.killfeed.innerHTML = '';
  me.hp = 100; me.kills = 0; me.state = 'bus'; me.gliderUsed = false; me.spectate = null;
  me.ammo = { rifle: WEAPONS.rifle.mag, escopeta: WEAPONS.escopeta.mag }; me.reloading = 0;
  me.vel.set(0, 0, 0);
  me.yaw = Math.atan2(-(room.bus.to[0] - room.bus.from[0]), -(room.bus.to[2] - room.bus.from[2]));
  scene.remove(me.mesh);
  me.mesh = createCharacter(me.color || '#ffffff');
  me.mesh.visible = false;
  scene.add(me.mesh);
  for (const o of others.values()) { o.state = 'bus'; o.mesh.visible = false; o.seen = false; }
  bus.visible = true;
  stormMesh.visible = true;
  updateHp(); updateWeaponsUi();
  showCenter('');
  if (!locked) ui.click.classList.remove('hidden');
}

function showCenter(text, small = '') {
  ui.center.innerHTML = text ? `${text}${small ? `<small>${small}</small>` : ''}` : '';
}

function updateHp() {
  const hp = Math.max(0, me.hp);
  ui.hpfill.style.width = `${hp}%`;
  ui.hpfill.style.background = hp > 50 ? 'linear-gradient(#7cf27c,#34b234)' : hp > 25 ? 'linear-gradient(#ffe066,#f2b705)' : 'linear-gradient(#ff7b7b,#d62828)';
  ui.hptext.textContent = Math.ceil(hp);
}
function updateWeaponsUi() {
  document.querySelectorAll('.slot').forEach((el) => {
    const w = el.dataset.w;
    el.classList.toggle('active', w === me.weapon);
    el.querySelector('.ammo').textContent = me.reloading > 0 && w === me.weapon ? '…' : `${me.ammo[w]}/${WEAPONS[w].mag}`;
  });
}

function nameOf(id) {
  if (id === myId) return me.name || 'Vos';
  return others.get(id)?.info?.name || '???';
}

function onDeath(m) {
  for (const p of m.players) {
    if (p.id === myId) me.kills = p.kills;
    const o = others.get(p.id);
    if (o) o.info = p;
  }
  const cause = m.cause === 'storm' ? 'la tormenta' : null;
  const line = cause ? `${escapeHtml(nameOf(m.id))} fue eliminado por ${cause}` : `${escapeHtml(nameOf(m.by))} ➜ ${escapeHtml(nameOf(m.id))}`;
  const div = document.createElement('div');
  div.innerHTML = line;
  ui.killfeed.prepend(div);
  setTimeout(() => div.remove(), 7000);
  if (m.id === myId) {
    me.state = 'dead'; me.hp = 0; updateHp();
    me.mesh.visible = false;
    const alive = m.players.filter((p) => p.alive).length;
    showCenter('ELIMINADO', `${cause ? 'Te atrapó la tormenta' : `Te eliminó ${escapeHtml(nameOf(m.by))}`} · Puesto #${alive + 1} · Clic para ver a otro jugador`);
    startSpectating(m.by);
  } else {
    const o = others.get(m.id);
    if (o) { o.state = 'dead'; o.mesh.visible = false; }
    if (me.spectate === m.id) startSpectating(m.by);
  }
}

function onMatchEnd(m) {
  for (const p of m.players) { const o = others.get(p.id); if (o) o.info = p; }
  if (m.winner === myId) showCenter('🏆 ¡ÚLTIMO EN PIE!', `Ganaste con ${me.kills} ${me.kills === 1 ? "eliminación" : "eliminaciones"} · Volviendo a la sala…`);
  else if (m.winner) showCenter(`Ganó ${escapeHtml(nameOf(m.winner))}`, 'Volviendo a la sala…');
  else showCenter('Fin de la partida', 'Volviendo a la sala…');
  if (me.state !== 'dead') me.state = 'ended';
}

function startSpectating(preferId) {
  const alive = [...others.entries()].filter(([, o]) => o.info?.alive && o.state !== 'dead').map(([id]) => id);
  if (!alive.length) { me.spectate = null; return; }
  if (preferId && alive.includes(preferId)) me.spectate = preferId;
  else {
    const i = alive.indexOf(me.spectate);
    me.spectate = alive[(i + 1) % alive.length];
  }
}

function addChat(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  ui.chatlog.append(d);
  while (ui.chatlog.children.length > 6) ui.chatlog.firstChild.remove();
  setTimeout(() => d.remove(), 15000);
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ---------- Entrada ----------
canvas.addEventListener('click', () => {
  if (me.state === 'dead') { startSpectating(); return; }
  if (!locked && ['bus', 'falling', 'glider', 'ground'].includes(me.state)) canvas.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  ui.click.classList.toggle('hidden', locked || !['bus', 'falling', 'glider', 'ground'].includes(me.state));
});
document.addEventListener('mousemove', (e) => {
  if (!locked) return;
  const sens = me.aiming ? 0.0012 : 0.0022;
  me.yaw -= e.movementX * sens;
  me.pitch = Math.max(-1.35, Math.min(1.2, me.pitch - e.movementY * sens));
});
document.addEventListener('mousedown', (e) => {
  if (!locked) return;
  if (e.button === 0) mouseDown = true;
  if (e.button === 2) me.aiming = true;
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouseDown = false;
  if (e.button === 2) me.aiming = false;
});
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('keydown', (e) => {
  if (document.activeElement === ui.chatInput) {
    if (e.key === 'Enter') {
      const text = ui.chatInput.value.trim();
      if (text) sendMsg({ t: 'chat', text });
      ui.chatInput.value = '';
      ui.chatInput.classList.add('hidden');
      ui.chatInput.blur();
      canvas.requestPointerLock();
    } else if (e.key === 'Escape') { ui.chatInput.classList.add('hidden'); ui.chatInput.blur(); }
    return;
  }
  if (document.activeElement?.tagName === 'INPUT') return;
  keys[e.code] = true;
  if (e.code === 'Enter' && !ui.hud.classList.contains('hidden')) {
    document.exitPointerLock?.();
    ui.chatInput.classList.remove('hidden');
    ui.chatInput.focus();
    e.preventDefault();
    return;
  }
  if (e.code === 'Space') { e.preventDefault(); onSpace(); }
  if (e.code === 'Digit1') switchWeapon('rifle');
  if (e.code === 'Digit2') switchWeapon('escopeta');
  if (e.code === 'KeyR') startReload();
});
document.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseDown = false; me.aiming = false; });

function onSpace() {
  if (me.state === 'bus' && room?.bus && now() > room.bus.start) jumpFromBus();
  else if (me.state === 'falling' && me.pos.y - world.groundHeight(me.pos.x, me.pos.z) > 12) openGlider();
  else if (me.state === 'ground' && me.onGround) { me.vel.y = JUMP; me.onGround = false; }
}
function jumpFromBus() {
  me.state = 'falling';
  me.pos.copy(bus.position).y -= 3;
  me.vel.set(0, -10, 0);
  me.mesh.visible = true;
  sendMsg({ t: 'jump' });
}
function openGlider() {
  if (me.gliderUsed) return;
  me.gliderUsed = true;
  me.state = 'glider';
}
function switchWeapon(w) {
  if (me.weapon === w) return;
  me.weapon = w; me.reloading = 0; updateWeaponsUi();
}
function startReload() {
  const w = WEAPONS[me.weapon];
  if (me.reloading > 0 || me.ammo[me.weapon] >= w.mag || me.state !== 'ground') return;
  me.reloading = w.reload;
  updateWeaponsUi();
}

// ---------- Disparo ----------
const raycaster = new THREE.Raycaster();
const _v = new THREE.Vector3(), _d = new THREE.Vector3();

function rayVsSphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t : Infinity;
}

// Devuelve { dist, playerId, head } del primer impacto a lo largo del rayo.
function castShot(origin, dir, range, near) {
  let best = { dist: range, playerId: null, head: false };
  raycaster.set(origin, dir);
  raycaster.near = near; raycaster.far = range;
  const hits = raycaster.intersectObjects(world.solidMeshes, false);
  if (hits.length) best.dist = hits[0].distance;
  const tt = world.rayTerrain(origin, dir, best.dist);
  if (tt < best.dist) best.dist = tt;
  for (const [id, o] of others) {
    if (!o.mesh.visible || o.state === 'dead' || o.state === 'bus') continue;
    const p = o.mesh.position;
    const th = rayVsSphere(origin, dir, _v.set(p.x, p.y + 1.95, p.z), 0.3);
    if (th > near && th < best.dist) best = { dist: th, playerId: id, head: true };
    for (const y of [0.35, 0.85, 1.4]) {
      const t = rayVsSphere(origin, dir, _v.set(p.x, p.y + y, p.z), 0.42);
      if (t > near && t < best.dist) best = { dist: t, playerId: id, head: false };
    }
  }
  return best;
}

function tryShoot() {
  const w = WEAPONS[me.weapon];
  const t = performance.now() / 1000;
  if (me.state !== 'ground' || me.reloading > 0 || t - me.lastShot < w.cooldown) return;
  if (me.ammo[me.weapon] <= 0) { startReload(); return; }
  me.lastShot = t;
  me.ammo[me.weapon]--;
  const muzzle = me.mesh.userData.gun.getWorldPosition(new THREE.Vector3());
  const camDir = camera.getWorldDirection(new THREE.Vector3());
  const near = camera.position.distanceTo(me.pos) + 0.5;
  const spread = me.aiming ? w.aimSpread : w.spread * (me.onGround ? 1 : 2);
  const hitsBy = new Map();
  let mainEnd = null, head = false;
  for (let i = 0; i < w.pellets; i++) {
    _d.copy(camDir);
    _d.x += (Math.random() - 0.5) * spread * 2; _d.y += (Math.random() - 0.5) * spread * 2; _d.z += (Math.random() - 0.5) * spread * 2;
    _d.normalize();
    const res = castShot(camera.position, _d, w.range, near);
    const end = camera.position.clone().addScaledVector(_d, res.dist);
    if (i === 0) mainEnd = end;
    if (res.playerId) { hitsBy.set(res.playerId, (hitsBy.get(res.playerId) || 0) + 1); head = head || res.head; }
    addTracer(muzzle, end, me.weapon);
  }
  let target = null, count = 0;
  for (const [id, c] of hitsBy) if (c > count) { target = id; count = c; }
  sendMsg({ t: 'shoot', w: me.weapon, from: muzzle.toArray(), to: mainEnd.toArray(), hit: target, head, frac: count / w.pellets });
  // Retroceso
  me.pitch = Math.min(1.2, me.pitch + (me.weapon === 'rifle' ? 0.008 : 0.04));
  updateWeaponsUi();
  if (me.ammo[me.weapon] === 0) startReload();
}

const tracerMat = { rifle: new THREE.LineBasicMaterial({ color: '#fff3a0', transparent: true }), escopeta: new THREE.LineBasicMaterial({ color: '#ffb347', transparent: true }) };
function addTracer(a, b, w) {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
  const line = new THREE.Line(geo, (tracerMat[w] || tracerMat.rifle).clone());
  scene.add(line);
  tracers.push({ line, life: 0.08 });
}

// ---------- Tormenta (misma fórmula que el servidor) ----------
function stormAt(t) {
  const storm = room.storm;
  const s = (t - storm.start) / 1000;
  const ph = storm.phases;
  if (s <= ph[0].t) return { ...ph[0], next: ph[1], wait: ph[1].t - s, moving: false };
  for (let i = 0; i < ph.length - 1; i++) {
    const a = ph[i], b = ph[i + 1];
    if (s >= a.t && s <= b.t) {
      const k = (s - a.t) / (b.t - a.t || 1);
      const moving = a.r !== b.r;
      let next = b;
      if (!moving && ph[i + 2]) next = ph[i + 2];
      return { r: a.r + (b.r - a.r) * k, x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, next, wait: b.t - s, moving };
    }
  }
  const last = ph[ph.length - 1];
  return { ...last, next: last, wait: 0, moving: false };
}

// ---------- Bucle principal ----------
const clock = new THREE.Clock();
let sendTimer = 0;

function updateBus(t) {
  if (!room?.bus || !bus) return;
  const b = room.bus;
  const k = (t - b.start) / b.duration;
  const from = new THREE.Vector3().fromArray(b.from), to = new THREE.Vector3().fromArray(b.to);
  bus.position.lerpVectors(from, to, Math.max(0, Math.min(1.4, k)));
  bus.position.y += Math.sin(t / 600) * 1.5;
  bus.lookAt(to.x, bus.position.y, to.z);
  bus.rotateY(Math.PI); // el modelo mira hacia -Z
  bus.rotation.z += Math.sin(t / 900) * 0.03;
  for (const p of bus.userData.props) p.rotation.z += 0.6;
  bus.visible = room.phase !== 'lobby' && k < 1.4;
}

function updateMe(dt) {
  const fwd = new THREE.Vector3(-Math.sin(me.yaw), 0, -Math.cos(me.yaw));
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const input = new THREE.Vector3();
  if (keys.KeyW) input.add(fwd);
  if (keys.KeyS) input.sub(fwd);
  if (keys.KeyD) input.add(right);
  if (keys.KeyA) input.sub(right);
  if (input.lengthSq() > 0) input.normalize();
  const ground = world.groundHeight(me.pos.x, me.pos.z, me.pos.y);

  if (me.state === 'falling') {
    // Mirar hacia abajo acelera la caída.
    const dive = Math.max(0, -me.pitch) * 0.6;
    me.vel.y += (-(FREEFALL_V * (1 + dive)) - me.vel.y) * Math.min(1, dt * 2);
    me.vel.x += (input.x * FREEFALL_H - me.vel.x) * Math.min(1, dt * 2);
    me.vel.z += (input.z * FREEFALL_H - me.vel.z) * Math.min(1, dt * 2);
    if (me.pos.y - ground < AUTO_GLIDER) openGlider();
    if (me.gliderUsed && me.state === 'falling') me.state = 'glider';
  } else if (me.state === 'glider') {
    me.vel.y += (-GLIDER_V - me.vel.y) * Math.min(1, dt * 3);
    const h = fwd.clone().multiplyScalar(6).addScaledVector(input, GLIDER_H - 6);
    me.vel.x += (h.x - me.vel.x) * Math.min(1, dt * 1.5);
    me.vel.z += (h.z - me.vel.z) * Math.min(1, dt * 1.5);
  } else if (me.state === 'ground') {
    const swimming = ground < SWIM_Y;
    const speed = swimming ? 4 : me.aiming ? AIM_WALK : keys.ShiftLeft && keys.KeyW ? SPRINT : WALK;
    const accel = me.onGround || swimming ? 12 : 3;
    me.vel.x += (input.x * speed - me.vel.x) * Math.min(1, dt * accel);
    me.vel.z += (input.z * speed - me.vel.z) * Math.min(1, dt * accel);
    me.vel.y -= GRAVITY * dt;
  }
  me.pos.addScaledVector(me.vel, dt);
  world.collide(me.pos);
  // Límite del mapa
  const lim = world.size * 0.75;
  me.pos.x = Math.max(-lim, Math.min(lim, me.pos.x));
  me.pos.z = Math.max(-lim, Math.min(lim, me.pos.z));

  const g2 = Math.max(world.groundHeight(me.pos.x, me.pos.z, me.pos.y), SWIM_Y);
  if (me.pos.y <= g2) {
    if (me.state === 'falling' || me.state === 'glider') { me.state = 'ground'; me.vel.y = 0; }
    me.pos.y = g2;
    if (me.vel.y < 0) me.vel.y = 0;
    me.onGround = true;
  } else if (me.state === 'ground' && me.pos.y - g2 < 0.3 && me.vel.y <= 0) {
    me.pos.y = g2; me.vel.y = 0; me.onGround = true; // pegarse al bajar pendientes
  } else me.onGround = false;

  // Armas
  if (me.reloading > 0) {
    me.reloading -= dt;
    if (me.reloading <= 0) { me.reloading = 0; me.ammo[me.weapon] = WEAPONS[me.weapon].mag; updateWeaponsUi(); }
  }
  if (mouseDown && me.state === 'ground') tryShoot();

  // Modelo
  me.mesh.visible = true;
  me.mesh.position.copy(me.pos);
  me.mesh.rotation.y = me.yaw;
  const hs = Math.hypot(me.vel.x, me.vel.z);
  animateCharacter(me.mesh, me.state, hs, dt, me.aiming || mouseDown);
  if (me.state === 'ground') me.mesh.userData.headG.rotation.x = me.pitch * 0.5;
}

function updateOthers(dt) {
  for (const o of others.values()) {
    const vis = o.seen && o.state !== 'bus' && o.state !== 'dead' && o.info?.alive !== false && room.phase !== 'lobby';
    o.mesh.visible = vis;
    if (!vis) continue;
    o.prev.copy(o.mesh.position);
    o.mesh.position.lerp(o.target, 1 - Math.exp(-dt * 12));
    let dr = o.rotTarget - o.mesh.rotation.y;
    dr = Math.atan2(Math.sin(dr), Math.cos(dr));
    o.mesh.rotation.y += dr * Math.min(1, dt * 12);
    const sp = Math.hypot(o.mesh.position.x - o.prev.x, o.mesh.position.z - o.prev.z) / Math.max(dt, 1e-3);
    o.speed += (sp - o.speed) * Math.min(1, dt * 8);
    animateCharacter(o.mesh, o.state, o.speed, dt, o.aiming);
  }
}

const camTarget = new THREE.Vector3();
function updateCamera(dt, t) {
  if (!world) return;
  if (me.state === 'lobby' || !room || room.phase === 'lobby') {
    const a = t / 20000;
    camera.position.set(Math.cos(a) * 520, 220, Math.sin(a) * 520);
    camera.lookAt(0, 20, 0);
    return;
  }
  let focus, dist, side = 0, up;
  if (me.state === 'bus') { focus = bus.position; dist = 28; up = 4; }
  else if (me.state === 'dead' || me.state === 'ended') {
    const o = me.spectate && others.get(me.spectate);
    if (o && o.mesh.visible) { focus = o.mesh.position.clone().add(new THREE.Vector3(0, 1.6, 0)); dist = 6; up = 0; }
    else { focus = me.pos.clone().add(new THREE.Vector3(0, 2, 0)); dist = 14; up = 2; }
  } else if (me.state === 'falling' || me.state === 'glider') {
    focus = me.pos.clone().add(new THREE.Vector3(0, 1.5, 0)); dist = 9; up = 0.5;
  } else {
    focus = me.pos.clone().add(new THREE.Vector3(0, 1.65, 0));
    dist = me.aiming ? 2.2 : 4.2; side = me.aiming ? 0.7 : 0.9; up = 0;
  }
  const dir = new THREE.Vector3(-Math.sin(me.yaw) * Math.cos(me.pitch), Math.sin(me.pitch), -Math.cos(me.yaw) * Math.cos(me.pitch));
  const right = new THREE.Vector3(Math.cos(me.yaw), 0, -Math.sin(me.yaw));
  camTarget.copy(focus).addScaledVector(dir, -dist).addScaledVector(right, side);
  camTarget.y += up;
  const minY = world.terrainHeight(camTarget.x, camTarget.z) + 0.4;
  if (camTarget.y < minY) camTarget.y = minY;
  camera.position.lerp(camTarget, me.state === 'ground' ? 1 - Math.exp(-dt * 25) : 1 - Math.exp(-dt * 8));
  camera.lookAt(camera.position.clone().add(dir).addScaledVector(right, 0).add(new THREE.Vector3(0, 0, 0)));
  const fovTarget = me.aiming && me.state === 'ground' ? 50 : me.state === 'falling' ? 80 : 70;
  camera.fov += (fovTarget - camera.fov) * Math.min(1, dt * 10);
  camera.updateProjectionMatrix();
}

function updateStorm(t) {
  if (!room?.storm || room.phase === 'lobby') { stormMesh.visible = false; return null; }
  const s = stormAt(t);
  stormMesh.visible = true;
  stormMesh.position.set(s.x, 400, s.z);
  stormMesh.scale.set(Math.max(s.r, 0.1), 1, Math.max(s.r, 0.1));
  stormMat.opacity = 0.22 + Math.sin(t / 400) * 0.04;
  const sec = Math.max(0, Math.ceil(s.wait));
  ui.storm.textContent = s.moving ? `🌀 La tormenta avanza · ${sec}s` : s.wait > 0 ? `🌀 Se cierra en ${sec}s` : '🌀 Tormenta final';
  return s;
}

function drawMinimap(s, t) {
  if (!minimapBase) return;
  const ctx = ui.minimap.getContext('2d');
  const W = ui.minimap.width, size = world.size, half = size / 2;
  const toM = (x) => ((x + half) / size) * W;
  ctx.drawImage(minimapBase, 0, 0, W, W);
  ctx.font = 'bold 9px system-ui';
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.textAlign = 'center';
  for (const p of world.pois) ctx.fillText(p.name, toM(p.x), toM(p.z) - 6);
  if (s) {
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.arc(toM(s.next.x), toM(s.next.z), (s.next.r / size) * W, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#a17bff'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(toM(s.x), toM(s.z), Math.max(0.5, (s.r / size) * W), 0, Math.PI * 2); ctx.stroke();
  }
  if (me.state === 'bus' && room.bus) {
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(toM(room.bus.from[0]), toM(room.bus.from[2])); ctx.lineTo(toM(room.bus.to[0]), toM(room.bus.to[2])); ctx.stroke();
    ctx.setLineDash([]);
  }
  const p = me.state === 'bus' ? bus.position : me.pos;
  ctx.save();
  ctx.translate(toM(p.x), toM(p.z));
  ctx.rotate(-me.yaw);
  ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(0, 2); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function updateHud(t) {
  const alive = room.players.filter((p) => (p.id === myId ? me.state !== 'dead' && me.hp > 0 : others.get(p.id)?.info?.alive !== false && others.get(p.id)?.state !== 'dead')).length;
  ui.alive.textContent = `👤 ${alive} vivos`;
  ui.kills.textContent = `💀 ${me.kills}`;
  if (me.state === 'bus') {
    const left = (room.bus.start - t) / 1000;
    if (left > 0) showCenter(`Despegue en ${Math.ceil(left)}`, 'Elegí dónde caer mirando el mapa');
    else showCenter('', ''), ui.center.innerHTML = '<small>Apretá ESPACIO para saltar del bus</small>';
  } else if (me.state === 'falling') ui.center.innerHTML = `<small>Altura ${Math.round(me.pos.y - world.groundHeight(me.pos.x, me.pos.z))} m · ESPACIO abre el planeador</small>`;
  else if (me.state === 'glider' || me.state === 'ground') { if (ui.center.innerHTML.includes('planeador') || ui.center.innerHTML.includes('bus')) showCenter(''); }
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = now();
  if (world && room && room.phase !== 'lobby') {
    updateBus(t);
    if (['falling', 'glider', 'ground'].includes(me.state)) updateMe(dt);
    else if (me.state === 'bus') { me.pos.copy(bus.position); me.mesh.visible = false; }
    updateOthers(dt);
    const s = updateStorm(t);
    drawMinimap(s, t);
    updateHud(t);
    sendTimer -= dt;
    if (sendTimer <= 0 && ['falling', 'glider', 'ground'].includes(me.state)) {
      sendTimer = 1 / 15;
      sendMsg({ t: 'state', p: [+me.pos.x.toFixed(2), +me.pos.y.toFixed(2), +me.pos.z.toFixed(2)], r: +me.yaw.toFixed(3), s: me.state, a: me.aiming || mouseDown, w: me.weapon });
    }
  }
  for (let i = tracers.length - 1; i >= 0; i--) {
    const tr = tracers[i];
    tr.life -= dt;
    tr.line.material.opacity = Math.max(0, tr.life / 0.08);
    if (tr.life <= 0) { scene.remove(tr.line); tr.line.geometry.dispose(); tracers.splice(i, 1); }
  }
  updateCamera(dt, t);
  // La sombra sigue a la cámara.
  const focus = me.state === 'ground' || me.state === 'glider' || me.state === 'falling' ? me.pos : camera.position;
  sun.target.position.copy(focus);
  sun.position.copy(focus).addScaledVector(SUN_DIR, 300);
  renderer.render(scene, camera);
}
frame();

// Para pruebas automatizadas.
window.__game = { me, others, shoot: tryShoot, camera, get room() { return room; }, get world() { return world; } };
