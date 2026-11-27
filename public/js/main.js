import * as THREE from 'three';
import { World, makeStructMesh, MODEL } from './world.js';
import { loadAssets, cloneAsset, bakedParts } from './assets.js';
import { createChest, abrirCofre, animarLoot, luzLoot } from './loot.js';
import { createCharacter, animateCharacter, createBus, createNameTag, createItemMesh, setHeld, weaponAction, stopWeaponAction, weaponShot, vestirPersonaje } from './models.js';
import { avanzarAspecto } from './aspecto.js';
import { iniciarMenu, sesion, ponerCuenta, avisoPavos, abrirSobreSala, colorDelJugador } from './menu.js';
import {
  WEAPONS, CONSUMABLES, AMMO, MATERIALS, MAT_ORDER, RARITIES, BUILD_COST, PICKAXE, SLOTS, GRID, DIRS,
  itemLabel, itemColor, weaponReload, structKey,
} from './items.js';
import { sfx, setVolumen } from './audio.js';
import { setRigEnv } from './rig.js';
import { prepararIconos, iconoDe, iconoPico } from './iconos.js';
import {
  estadoCaida, fisicaAire, abrirParacaidas, puedeCerrar, cerrarParacaidas, PARACAIDAS, DESLIZ,
  puedeDeslizar, empezarDeslizar, terminarDeslizar, fisicaDeslizar, paramsRed, leerParams,
} from './caida.js';
import { accionesDe, activa, presionar, soltar, soltarTodo, teclaDe, listaAcciones, opcion, fijarOpcion, alCambiar, cargarDistribucion } from './controles.js';
import { BOT_TOTALES, BOT_DIFICULTADES, BOT_TOTAL_DEF, cuantosBots } from './opcionesBots.js';
import { abrirConfig, cerrarConfig, abierto as configAbierta } from './configuracion.js';
import { crearConstruccion } from './construir.js';
import { crearManejo } from './manejar.js';
import { crearGolpes, objetivoDe, aMensaje } from './golpes.js';

const GRAVITY = 25, WALK = 6, SPRINT = 9.5, AIM_WALK = 3.5, JUMP = 8.5, SWIM_Y = -1.3;
const PICKUP_RANGE = 3;

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const canvas = $('game');
const ui = {
  menu: $('menu'), lobby: $('lobby'), hud: $('hud'), name: $('name'), code: $('code'), menuError: $('menuError'),
  roomCode: $('roomCode'), playerList: $('playerList'), btnStart: $('btnStart'), waitHost: $('waitHost'),
  center: $('center-msg'), alive: $('alive'), kills: $('kills'), storm: $('stormInfo'), minimap: $('minimap'),
  killfeed: $('killfeed'), hpfill: $('hpfill'), hptext: $('hptext'), shieldfill: $('shieldfill'), shieldtext: $('shieldtext'),
  hit: $('hitmarker'), damage: $('damage'), chatlog: $('chatlog'), chatInput: $('chatInput'), click: $('clickToPlay'),
  slots: $('slots'), itemMano: $('itemMano'), prompt: $('prompt'), usebar: $('usebar'), usefill: $('usefill'), usetext: $('usetext'),
  pickupFeed: $('pickupFeed'), buildbar: $('buildbar'), buildhint: $('buildhint'), structhp: $('structhp'), scope: $('scope'), dmgnums: $('dmgnums'), crosshair: $('crosshair'),
  autohud: $('autohud'), autovel: $('autovel'), autovida: $('autovida'), autoturbo: $('autoturbo'), autohint: $('autohint'),
  btnBots: $('btnBots'), botsResumenMenu: $('botsResumenMenu'), botsElegir: $('botsElegir'), botsTotal: $('botsTotal'), botsDif: $('botsDif'), botsResumen: $('botsResumen'),
};
ui.name.value = storageGet('br-name') || '';
// Modelos de Blender: se cargan antes de habilitar el menú.
const btns = [$('btnCreate'), $('btnJoin'), $('btnBots')];
btns.forEach((b) => { b.disabled = true; });
ui.menuError.textContent = 'Cargando modelos…';
await loadAssets((k) => { ui.menuError.textContent = `Cargando modelos… ${Math.round(k * 100)}%`; });
MODEL.clone = cloneAsset; MODEL.baked = bakedParts; MODEL.cofre = createChest; MODEL.abrirCofre = abrirCofre;
btns.forEach((b) => { b.disabled = false; });
ui.menuError.textContent = '';
await iniciarMenu(); // cuentas, tienda y vitrina (menu.js)
$('btnSkinsSala').onclick = abrirSobreSala;
function storageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function storageSet(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } }

// ---------- Three.js ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
setRigEnv(renderer);
luzLoot(renderer);
prepararIconos(renderer); // fotos de las armas y objetos para la barra de items (iconos.js)
renderer.localClippingEnabled = true; // las construcciones se llenan de abajo hacia arriba mientras se levantan

const scene = new THREE.Scene();
const SKY = new THREE.Color('#7cc8ff');
scene.background = SKY;
scene.fog = new THREE.Fog(SKY, 280, 1200);
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 3000);
scene.add(new THREE.HemisphereLight('#e6f6ff', '#4f8a3a', 1.25));
const sun = new THREE.DirectionalLight('#fff1d6', 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 600 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);
const SUN_DIR = new THREE.Vector3(0.5, 1, 0.3).normalize();
addClouds();

// Calidad gráfica (opciones del panel de configuración): resolución y sombras.
const CALIDAD = { baja: { pr: 1, sombra: 0 }, media: { pr: 1.25, sombra: 1024 }, alta: { pr: 2, sombra: 2048 } };
function aplicarVideo() {
  const q = CALIDAD[opcion('calidad')] || CALIDAD.alta;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.pr) * opcion('resolucion'));
  const sombras = q.sombra > 0;
  if (sombras && sun.shadow.mapSize.x !== q.sombra) {
    sun.shadow.mapSize.set(q.sombra, q.sombra);
    sun.shadow.map?.dispose(); sun.shadow.map = null;
  }
  if (renderer.shadowMap.enabled !== sombras) {
    renderer.shadowMap.enabled = sombras;
    sun.castShadow = sombras;
    scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
  }
  resize();
}
function aplicarOpciones() {
  aplicarVideo();
  setVolumen(opcion('volumen'));
  document.documentElement.style.setProperty('--mira', opcion('colorMira'));
  $('fps').classList.toggle('hidden', !opcion('fps'));
}

function addClouds() {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1, emissive: '#c9e6ff', emissiveIntensity: 0.25 });
  const n = 260;
  const clouds = new THREE.InstancedMesh(geo, mat, n);
  const m = new THREE.Matrix4();
  let k = 0;
  for (let c = 0; c < 40; c++) {
    const cx = (Math.random() - 0.5) * 1800, cz = (Math.random() - 0.5) * 1800, cy = 300 + Math.random() * 70;
    for (let p = 0; p < 6 && k < n; p++, k++) {
      const s = 10 + Math.random() * 14;
      m.compose(new THREE.Vector3(cx + (Math.random() - 0.5) * 50, cy + Math.random() * 8, cz + (Math.random() - 0.5) * 25),
        new THREE.Quaternion(), new THREE.Vector3(s * 1.6, s * 0.8, s));
      clouds.setMatrixAt(k, m);
    }
  }
  clouds.count = k;
  clouds.userData.keep = true;
  scene.add(clouds);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
aplicarOpciones();
alCambiar((tipo) => {
  if (tipo === 'opcion') aplicarOpciones();
  else updateSlots();
});
cargarDistribucion();

const stormMat = new THREE.MeshBasicMaterial({ color: '#8a4dff', transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false, fog: false });
const stormMesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 2000, 96, 1, true), stormMat);
stormMesh.visible = false;
scene.add(stormMesh);

// ---------- Estado ----------
let ws = null, myId = null, room = null, world = null, serverOffset = 0;
const others = new Map();
const items = new Map(); // id -> { it, mesh }
const me = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: -0.2, state: 'lobby',
  hp: 100, shield: 0, kills: 0, onGround: false, aiming: false,
  slots: Array(SLOTS).fill(null), ammo: {}, mats: { madera: 0, piedra: 0, metal: 0 },
  sel: -1, // -1 = pico, 0..4 = slots
  reloading: 0, reloadSlot: -1, lastShot: 0, lastSwing: 0, use: null,
  build: null, mat: 'madera', mesh: null, spectate: null, minVy: 0,
  ...estadoCaida(), // caída libre, paracaídas y deslizarse (caida.js)
};
let bus = null;
let mouseDown = false, mouseClicked = false, locked = false, rmbDown = false;
const tracers = [];
const effects = [];
const dmgNums = [];
let minimapBase = null;
let interact = null;
// Construcción (construir.js): modo construcción, vista previa, edición y su HUD.
const cons = crearConstruccion({ scene, camera, me, getWorld: () => world, getMyId: () => myId, sendMsg, ui, sfx, feed });
// Daño visible (grietas y barra de vida) y punto débil del pico (golpes.js).
const golpes = crearGolpes({ scene, camera, me, getWorld: () => world, ui, sfx, cons, rayo: (o, d, r, n) => castRay(o, d, r, n), mirar: mirarPico, addDmgNum, sparks });
// Autos (manejar.js): manejo, autos de los demás, subir y bajar, pose sentado y su HUD.
const autos = crearManejo({
  scene, camera, me, getWorld: () => world, getMyId: () => myId, sendMsg, ui, sfx, others,
  explosion: (p) => explosionFx(p.clone(), '#ff8a2a', 1.3),
  feed: (texto, color) => feed(texto, color),
  alSubir: () => {
    // al subir se corta lo que se estaba haciendo a pie
    cons.cancelar();
    if (me.use) cancelUse();
    if (me.reloadSlot >= 0) { me.reloading = 0; me.reloadSlot = -1; stopWeaponAction(me.mesh); }
    if (me.desliz) terminarDeslizar(me);
    me.dance = false; mouseDown = false; rmbDown = false; me.aiming = false;
    ui.prompt.classList.add('hidden');
    updateSlots();
  },
  alBajar: () => updateSlots(),
});
me.cancelUse = () => { if (me.use) cancelUse(); };
me.onBuildChange = () => { if (me.build && opcion('apuntarAlternar')) rmbDown = false; updateSlots(); };

const now = () => Date.now() + serverOffset;

// ---------- Red ----------
function connect(onOpen) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);
  ws.onopen = onOpen;
  ws.onmessage = (e) => handle(JSON.parse(e.data));
  ws.onclose = () => {
    if (myId) showCenter('Se perdió la conexión con el servidor', 'Recargá la página para volver a entrar');
    else ui.menuError.textContent = 'No se pudo conectar con el servidor.';
  };
}
function sendMsg(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }

// conBots: "Jugar con bots" crea la sala con bots y la empieza enseguida.
let alCrear = null;
function enter(type, conBots = false) {
  sfx.unlock();
  const name = ui.name.value.trim() || 'Jugador';
  storageSet('br-name', name);
  const code = ui.code.value.trim().toUpperCase();
  if (type === 'join' && code.length < 4) { ui.menuError.textContent = 'Escribí el código de la sala.'; return; }
  ui.menuError.textContent = '';
  // la sala nueva arranca con los bots de Configuración (o con los de "Jugar con bots")
  alCrear = type === 'create' ? { total: conBots ? opcion('botsTotal') || BOT_TOTAL_DEF : opcion('botsTotal'), dif: opcion('botsDificultad'), empezar: conBots } : null;
  const go = () => sendMsg({ t: type, name, code, token: sesion.token || undefined });
  if (ws && ws.readyState === 1) go(); else connect(go);
}
$('btnCreate').onclick = () => enter('create');
$('btnJoin').onclick = () => enter('join');
ui.btnBots.onclick = () => enter('create', true);

// ---------- Bots (opciones de la sala) ----------
ui.botsTotal.innerHTML = BOT_TOTALES.map((n) => `<option value="${n}">${n ? `${n} jugadores` : 'Sin bots'}</option>`).join('');
ui.botsDif.innerHTML = Object.entries(BOT_DIFICULTADES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
function cambiarBots() {
  const total = Number(ui.botsTotal.value), dif = ui.botsDif.value;
  // queda guardado para la próxima sala (es la misma opción de Configuración)
  fijarOpcion('botsTotal', total); fijarOpcion('botsDificultad', dif);
  sendMsg({ t: 'bots', total, dif });
}
ui.botsTotal.onchange = cambiarBots;
ui.botsDif.onchange = cambiarBots;
function resumenMenuBots() {
  const total = opcion('botsTotal') || BOT_TOTAL_DEF;
  ui.botsResumenMenu.textContent = `${total} jugadores · ${BOT_DIFICULTADES[opcion('botsDificultad')] || 'Normal'}`;
}
resumenMenuBots();
alCambiar((tipo, id) => { if (tipo === 'opcion' && (!id || id.startsWith('bots'))) resumenMenuBots(); });
ui.code.addEventListener('keydown', (e) => { if (e.key === 'Enter') enter('join'); });
ui.btnStart.onclick = () => sendMsg({ t: 'start' });
ui.roomCode.onclick = () => navigator.clipboard?.writeText(room.code).catch(() => {});
const urlCode = new URLSearchParams(location.search).get('sala');
if (urlCode) ui.code.value = urlCode.toUpperCase();

function handle(m) {
  if (m.t.startsWith('auto') || m.t === 'bocina') { if (world) autos.mensaje(m); return; }
  switch (m.t) {
    case 'error': ui.menuError.textContent = m.message; break;
    case 'cuenta': ponerCuenta(m.cuenta); break;
    case 'pavos': avisoPavos(m); break;
    case 'welcome':
      myId = m.id;
      if (m.cuenta) ponerCuenta(m.cuenta);
      // servidor viejo: no manda versión (antes de los autos) o el código cambió en el disco después de arrancarlo
      if (!m.version || m.viejo) {
        $('avisoServidor').textContent = 'El servidor está corriendo una versión vieja del juego: cerralo (Ctrl+C) y volvé a abrirlo con npm start. Mientras tanto los autos y lo nuevo no andan.';
        $('avisoServidor').classList.remove('hidden');
      }
      setRoom(m.room);
      if (alCrear) {
        // sala recién creada: los bots elegidos y, con "Jugar con bots", empezar ya (el servidor los procesa en orden)
        sendMsg({ t: 'bots', total: alCrear.total, dif: alCrear.dif });
        if (alCrear.empezar) sendMsg({ t: 'start' });
        alCrear = null;
      }
      ensureWorld();
      if (room.phase === 'lobby') showLobby();
      else {
        setupMatch(m.snap);
        me.state = 'dead'; me.hp = 0;
        startSpectating();
        showCenter('Partida en curso', 'Vas a poder jugar en la próxima');
      }
      break;
    case 'room':
      setRoom(m.room);
      if (room.phase === 'lobby') showLobby();
      break;
    case 'matchStart':
      setRoom(m.room);
      ensureWorld(true);
      setupMatch(m.snap);
      break;
    case 'phase': room.phase = m.phase; break;
    case 'forceJump': if (m.id === myId && me.state === 'bus') jumpFromBus(); else markJumped(m.id); break;
    case 'jumped': markJumped(m.id); break;
    case 'state': {
      const o = others.get(m.id);
      if (!o) break;
      o.target.fromArray(m.p);
      o.rotTarget = m.r; o.state = m.s; o.aiming = m.a; o.dance = !!m.b; o.x = leerParams(m.x);
      if (m.h) setHeld(o.mesh, m.h[0], m.h[1]);
      // recarga de los demás: empieza cuando aparece el tiempo restante y se corta si desaparece antes
      const rl = m.rl || 0;
      if (rl > 0 && !(o.rl > 0)) weaponAction(o.mesh, 'reload', rl);
      else if (!rl && o.rl > 0.35) stopWeaponAction(o.mesh);
      o.rl = rl;
      if (!o.seen) { o.mesh.position.copy(o.target); o.seen = true; }
      break;
    }
    case 'shot': {
      const so = others.get(m.id);
      if (so) { so.mesh.userData.recoil = 1; weaponShot(so.mesh, m.w, so.aiming); }
      const from = new THREE.Vector3().fromArray(m.from), to = new THREE.Vector3().fromArray(m.to);
      if (WEAPONS[m.w]?.rocket) addRocket(from, to); else addTracer(from, to, m.w);
      sfx.shot(m.w, from.distanceTo(me.pos));
      break;
    }
    case 'swing': { const o = others.get(m.id); if (o) o.mesh.userData.swing = 1; break; }
    case 'boom': explosionFx(new THREE.Vector3().fromArray(m.at)); break;
    case 'hitConfirm':
      ui.hit.classList.toggle('head', m.head);
      ui.hit.classList.add('show');
      setTimeout(() => ui.hit.classList.remove('show'), 90);
      if (m.shield) sfx.shieldHit(); else sfx.hit(m.head);
      addDmgNum(new THREE.Vector3(m.pos[0], m.pos[1] + 2.2, m.pos[2]), m.dmg, m.head ? '#ffd23f' : m.shield ? '#6ec6ff' : '#ffffff');
      break;
    case 'inv': onInventory(m); break;
    case 'itemsAdd': for (const it of m.items) addItem(it); break;
    case 'itemsDel': for (const id of m.ids) removeItem(id); break;
    case 'chestOpen': world.openChest(m.idx, true); if (world.chestSpots[m.idx] && me.pos.distanceTo(v3(world.chestSpots[m.idx])) < 15) sfx.chest(); break;
    case 'resHit': world.shakeResource(m.res, m.idx); break;
    case 'resGone': world.destroyResource(m.res, m.idx); golpes.alRomper({ tipo: m.res, id: m.idx }); break;
    case 'structAdd':
      world.addStruct(m.s);
      cons.alAgregar(m.s);
      if (m.s.dano) golpes.vidaStruct(world.structs.get(m.s.key), m.s.dano, false);
      if (me.pos.distanceTo(new THREE.Vector3(m.s.i * GRID, m.s.y, m.s.j * GRID)) < 40) sfx.build();
      break;
    case 'structDel': {
      // la pieza rota y las que se cayeron por quedar sin apoyo
      let cerca = false;
      for (const key of [m.key, ...(m.caidas || [])]) {
        const s = key && world.structs.get(key);
        if (!s) continue;
        const c = new THREE.Vector3(s.i * GRID + 2, s.y + 2, s.j * GRID + 2);
        explosionFx(c, MATERIALS[s.mat].color, 0.6);
        if (c.distanceTo(me.pos) < 60) cerca = true;
        golpes.alRomper({ tipo: 'key', id: key });
        world.removeStruct(key);
      }
      if (cerca) sfx.structBreak();
      break;
    }
    case 'structEdit': {
      const s = world.structs.get(m.key);
      if (s && (s.e !== m.e || s.dir !== m.dir)) world.editStruct(m.key, m.e, m.dir);
      break;
    }
    case 'pzRota': {
      // piezas del mapa rotas (la primera es la que se rompió; las otras se cayeron por quedar sin apoyo)
      let cerca = false;
      for (const id of m.ids) {
        const p = world.romperPieza(id);
        golpes.alRomper({ tipo: 'pz', id });
        if (!p) continue;
        escombros(p);
        const a = p.aabb;
        if (Math.hypot((a[0] + a[3]) / 2 - me.pos.x, (a[2] + a[5]) / 2 - me.pos.z) < 60) cerca = true;
      }
      if (cerca) sfx.structBreak();
      break;
    }
    case 'chestMove': world.moveChest(m.idx, m.y); break;
    case 'pzHp': for (let i = 0; i < m.ids.length; i++) golpes.vidaPieza(m.ids[i], m.hp[i]); break;
    case 'debil': golpes.alDebil(m); break;
    case 'structHp': {
      const s = world.structs.get(m.key);
      if (s) { cons.alCambiarVida(s, m.hp); golpes.vidaStruct(s, m.dano); }
      if (s?.mesh) { s.mesh.scale.setScalar(0.94); setTimeout(() => s.mesh && s.mesh.scale.setScalar(1), 70); }
      break;
    }
    case 'death': onDeath(m); break;
    case 'matchEnd': onMatchEnd(m); break;
    case 'left': removeOther(m.id); break;
    case 'empujon':
      // me atropellaron: salgo volando para el lado que empujó el auto
      if (me.state === 'ground' && Array.isArray(m.v)) {
        if (me.desliz) terminarDeslizar(me);
        me.vel.set(...m.v); me.onGround = false; me.minVy = 0;
      }
      break;
    case 'chat': addChat(`<b>${escapeHtml(m.name)}:</b> ${escapeHtml(m.text)}`); break;
  }
}
const v3 = (o) => new THREE.Vector3(o.x, o.y, o.z);

function onInventory(m) {
  const prevHp = me.hp + me.shield;
  if (m.hp + m.shield < prevHp - 0.5) {
    ui.damage.classList.add('show'); setTimeout(() => ui.damage.classList.remove('show'), 120);
    if (!m.storm) sfx.hurt();
  }
  if (m.hp > me.hp + 0.5) sfx.heal();
  if (m.shield > me.shield + 0.5) sfx.shield();
  me.hp = m.hp; me.shield = m.shield;
  // Conservar la munición local del arma que se está disparando para no "saltar" por la latencia.
  me.slots = m.slots; me.ammo = m.ammo; me.mats = m.mats;
  if (m.picked) { sfx.pickup(); feed(itemLabel(m.picked), itemColor(m.picked)); }
  if (m.gained) feed(`+${m.gained[1]} ${MATERIALS[m.gained[0]].name}`, MATERIALS[m.gained[0]].color);
  if (me.reloadSlot >= 0 && me.slots[me.reloadSlot]?.kind === 'weapon' && me.slots[me.reloadSlot].mag >= WEAPONS[me.slots[me.reloadSlot].w].mag) { me.reloading = 0; me.reloadSlot = -1; }
  cons.autoMaterial(); // si se terminó el material elegido, pasa solo al siguiente que alcance
  updateHp(); updateSlots();
}

function setRoom(r) {
  room = r;
  serverOffset = r.serverTime - Date.now();
  const ids = new Set(r.players.map((p) => p.id));
  for (const id of [...others.keys()]) if (!ids.has(id)) removeOther(id);
  for (const p of r.players) {
    if (p.id === myId) { me.kills = p.kills; me.color = p.color; me.name = p.name; me.sk = p.sk; colorDelJugador(p.color); continue; }
    let o = others.get(p.id);
    if (o && JSON.stringify(o.info?.sk) !== JSON.stringify(p.sk)) vestirPersonaje(o.mesh, p.sk, p.color); // cambió de skins en la sala
    if (!o) {
      const mesh = createCharacter(p.color, p.sk);
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

function ensureWorld(fresh = false) {
  if (world && world.seed === room.seed && !fresh) return;
  if (world) {
    // Partida nueva en la misma sala: rehacer el mundo para resetear árboles, cofres y construcciones.
    const keep = new Set([sun, sun.target, stormMesh, bus, me.mesh, ...[...others.values()].map((o) => o.mesh)]);
    for (const obj of [...scene.children]) if (!keep.has(obj) && !obj.isLight && !obj.userData.keep) scene.remove(obj);
    for (const it of items.values()) scene.remove(it.mesh);
    items.clear();
  }
  world = new World(room.seed, room.islandSize);
  world.build(scene);
  minimapBase = world.minimapImage(200);
  if (!bus) { bus = createBus(); bus.visible = false; scene.add(bus); }
}

function addItem(it) {
  if (items.has(it.id)) return;
  const mesh = createItemMesh(it, itemColor(it));
  mesh.position.set(it.x, it.y, it.z);
  mesh.userData.keep = false;
  scene.add(mesh);
  items.set(it.id, { it, mesh });
}
function removeItem(id) {
  const e = items.get(id);
  if (!e) return;
  scene.remove(e.mesh);
  items.delete(id);
}

// ---------- Pantallas ----------
function showLobby() {
  if (!ui.menu.classList.contains('sobre-sala')) ui.menu.classList.add('hidden'); // salvo si está cambiando de skins
  ui.hud.classList.add('hidden');
  ui.lobby.classList.remove('hidden');
  me.state = 'lobby';
  if (me.mesh) me.mesh.visible = false;
  for (const o of others.values()) o.mesh.visible = false;
  if (bus) bus.visible = false;
  stormMesh.visible = false;
  document.exitPointerLock?.();
  ui.roomCode.textContent = room.code;
  const personas = room.players.filter((p) => !p.bot);
  const bots = room.bots || { total: 0, dif: 'normal' };
  const nBots = cuantosBots(bots.total, personas.length);
  const dif = BOT_DIFICULTADES[bots.dif] || 'Normal';
  ui.playerList.innerHTML = personas.map((p) =>
    `<li><span class="dot" style="background:${p.color}"></span>${escapeHtml(p.name)}${p.id === room.hostId ? ' 👑' : ''}${p.id === myId ? ' (vos)' : ''}</li>`).join('') +
    (nBots ? `<li class="bot"><span class="dot" style="background:#5ad65a"></span>🤖 + ${nBots} ${nBots === 1 ? 'bot' : 'bots'} (${dif})</li>` : '');
  const host = room.hostId === myId;
  ui.btnStart.classList.toggle('hidden', !host);
  ui.waitHost.classList.toggle('hidden', host);
  ui.btnStart.textContent = nBots ? `Empezar con ${nBots} ${nBots === 1 ? 'bot' : 'bots'}` : personas.length > 1 ? 'Empezar partida' : 'Empezar (solo, para explorar)';
  // el anfitrión elige los bots; los demás ven lo que eligió
  ui.botsElegir.classList.toggle('hidden', !host);
  ui.botsTotal.value = String(bots.total);
  ui.botsDif.value = bots.dif;
  ui.botsResumen.textContent = !bots.total ? (host ? 'Sin bots: solo juegan las personas de la sala.' : 'Sin bots.')
    : `Los bots completan la sala hasta ${bots.total} jugadores (${dif}).${nBots ? '' : ' Ya están todos: no entra ninguno.'}`;
}

function setupMatch(snap) {
  ui.lobby.classList.add('hidden');
  ui.menu.classList.add('hidden');
  ui.menu.classList.remove('sobre-sala');
  ui.hud.classList.remove('hidden');
  ui.killfeed.innerHTML = '';
  cons.cancelar();
  golpes.reiniciar();
  Object.assign(me, {
    hp: 100, shield: 0, kills: 0, state: 'bus', spectate: null, sel: -1, build: null, ...estadoCaida(),
    reloading: 0, reloadSlot: -1, use: null, slots: Array(SLOTS).fill(null), mats: { madera: 0, piedra: 0, metal: 0 }, ammo: {},
  });
  me.vel.set(0, 0, 0);
  me.yaw = Math.atan2(-(room.bus.to[0] - room.bus.from[0]), -(room.bus.to[2] - room.bus.from[2]));
  if (me.mesh) scene.remove(me.mesh);
  me.mesh = createCharacter(me.color || '#ffffff', me.sk);
  me.mesh.visible = false;
  scene.add(me.mesh);
  for (const o of others.values()) { o.state = 'bus'; o.mesh.visible = false; o.seen = false; }
  if (snap) {
    for (const it of snap.items) addItem(it);
    for (const i of snap.chests) world.openChest(i);
    for (const i of snap.trees) world.destroyResource('tree', i);
    for (const i of snap.rocks) world.destroyResource('rock', i);
    for (const s of snap.structs) { world.addStruct(s); cons.alAgregar(s); if (s.dano) golpes.vidaStruct(world.structs.get(s.key), s.dano, false); }
    for (const id of snap.piezas || []) world.romperPieza(id);
    for (const [id, hp] of snap.pzHp || []) golpes.vidaPieza(id, hp, false);
    for (const [i, y] of snap.cofresMovidos || []) world.moveChest(i, y);
  }
  autos.iniciar(snap?.autos);
  bus.visible = true;
  stormMesh.visible = true;
  updateHp(); updateSlots();
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
  ui.shieldfill.style.width = `${Math.max(0, me.shield)}%`;
  ui.shieldtext.textContent = Math.ceil(me.shield);
}

function heldItem() { return me.sel >= 0 ? me.slots[me.sel] : null; }


function updateSlots() {
  const cells = [];
  const foto = (url) => (url ? `<img class="ic" src="${url}" alt="" draggable="false">` : '');
  // con foto, el nombre no entra en el lugar: queda de título y se muestra el de lo que tenés en la mano (itemMano)
  const conFoto = (url) => (url ? ' foto' : '');
  cells.push(`<div class="slot${conFoto(iconoPico())} ${me.sel === -1 && !me.build ? 'active' : ''}" title="Pico"><span class="k">${escapeHtml(teclaDe('pico'))}</span>${foto(iconoPico())}<span class="n">${iconoPico() ? '' : '⛏ '}Pico</span></div>`);
  for (let i = 0; i < SLOTS; i++) {
    const it = me.slots[i];
    let inner = '', clase = '', titulo = '';
    if (it) {
      clase = conFoto(iconoDe(it));
      titulo = ` title="${escapeHtml(itemLabel(it))}"`;
      const col = itemColor(it);
      if (it.kind === 'weapon') {
        const def = WEAPONS[it.w];
        const ammo = me.reloadSlot === i && me.reloading > 0 ? '…' : `${it.mag}/${me.ammo[def.ammo] || 0}`;
        inner = `<span class="rar" style="--c:${col}"></span>${foto(iconoDe(it))}<span class="a">${ammo}</span><span class="n">${def.name}</span>`;
      } else {
        inner = `<span class="rar" style="--c:${col}"></span>${foto(iconoDe(it))}<span class="a">×${it.count}</span><span class="n">${CONSUMABLES[it.c].name}</span>`;
      }
    }
    cells.push(`<div class="slot${clase} ${me.sel === i && !me.build ? 'active' : ''}"${titulo}><span class="k">${escapeHtml(teclaDe('ranura' + (i + 1)))}</span>${inner}</div>`);
  }
  ui.slots.innerHTML = cells.join('');
  // nombre de lo que tenés en la mano, al costado de la barra (con la rareza si es un arma)
  const mano = heldItem();
  ui.itemMano.classList.toggle('hidden', !!me.build);
  if (!mano) ui.itemMano.innerHTML = 'Pico';
  else if (mano.kind === 'weapon') ui.itemMano.innerHTML = `${escapeHtml(WEAPONS[mano.w].name)}<small style="--c:${RARITIES[mano.rarity].color}">${escapeHtml(RARITIES[mano.rarity].name)}</small>`;
  else ui.itemMano.innerHTML = escapeHtml(CONSUMABLES[mano.c].name);
  document.querySelectorAll('.mat').forEach((el) => {
    const m = el.dataset.m;
    el.querySelector('i').style.background = MATERIALS[m].color;
    el.querySelector('span').textContent = me.mats[m] || 0;
    el.classList.toggle('active', m === me.mat);
  });
  cons.hud(); // barra de piezas arriba del inventario y ayuda de construcción
  // Lo que tiene en la mano
  if (me.mesh) {
    const it = heldItem();
    if (me.build) setHeld(me.mesh, null);
    else if (!it) setHeld(me.mesh, 'pico');
    else if (it.kind === 'weapon') setHeld(me.mesh, it.w, RARITIES[it.rarity].color);
    else setHeld(me.mesh, 'item', CONSUMABLES[it.c].color);
  }
}

function feed(text, color) {
  const d = document.createElement('div');
  d.textContent = text;
  d.style.borderLeftColor = color;
  ui.pickupFeed.append(d);
  while (ui.pickupFeed.children.length > 5) ui.pickupFeed.firstChild.remove();
  setTimeout(() => d.remove(), 3000);
}

function nameOf(id) {
  if (id === myId) return me.name || 'Vos';
  return others.get(id)?.info?.name || '???';
}

const CAUSES = { storm: 'la tormenta', fall: 'una caída', pico: 'Pico', auto: 'un auto' };
function onDeath(m) {
  for (const p of m.players) {
    if (p.id === myId) me.kills = p.kills;
    const o = others.get(p.id);
    if (o) o.info = p;
  }
  const env = m.cause === 'storm' || m.cause === 'fall' || !m.by;
  const how = WEAPONS[m.cause]?.name || (m.cause === 'auto' ? 'Auto' : CAUSES[m.cause]) || '';
  const line = env ? `${escapeHtml(nameOf(m.id))} fue eliminado por ${CAUSES[m.cause] || 'el entorno'}` : `${escapeHtml(nameOf(m.by))} <small>[${how}]</small> ${escapeHtml(nameOf(m.id))}`;
  const div = document.createElement('div');
  div.innerHTML = line;
  ui.killfeed.prepend(div);
  setTimeout(() => div.remove(), 7000);
  if (m.by === myId && m.id !== myId) { sfx.elim(); showCenter(''); ui.center.innerHTML = `<small>Eliminaste a ${escapeHtml(nameOf(m.id))}</small>`; setTimeout(() => { if (ui.center.innerHTML.includes('Eliminaste')) showCenter(''); }, 2500); }
  if (m.id === myId) {
    me.state = 'dead'; me.hp = 0; me.shield = 0; updateHp();
    me.mesh.visible = false; cons.cancelar(); me.auto = null;
    const alive = m.players.filter((p) => p.alive).length;
    showCenter('ELIMINADO', `${env ? `Te eliminó ${CAUSES[m.cause] || 'el entorno'}` : `Te eliminó ${escapeHtml(nameOf(m.by))}`} · Puesto #${alive + 1} · Clic para ver a otro jugador`);
    startSpectating(m.by);
  } else {
    const o = others.get(m.id);
    if (o) { o.state = 'dead'; o.mesh.visible = false; }
    if (me.spectate === m.id) startSpectating(m.by);
  }
}

function onMatchEnd(m) {
  for (const p of m.players) { const o = others.get(p.id); if (o) o.info = p; }
  if (m.winner === myId) showCenter('🏆 ¡ÚLTIMO EN PIE!', `Ganaste con ${me.kills} ${me.kills === 1 ? 'eliminación' : 'eliminaciones'} · Volviendo a la sala…`);
  else if (m.winner) showCenter(`Ganó ${escapeHtml(nameOf(m.winner))}`, 'Volviendo a la sala…');
  else if (m.botsVivos) showCenter('Fin de la partida', `Quedaban ${m.botsVivos} ${m.botsVivos === 1 ? 'bot' : 'bots'} en pie · Volviendo a la sala…`);
  else showCenter('Fin de la partida', 'Volviendo a la sala…');
  if (me.state !== 'dead') me.state = 'ended';
}

function startSpectating(preferId) {
  const alive = [...others.entries()].filter(([, o]) => o.info?.alive && o.state !== 'dead').map(([id]) => id);
  if (!alive.length) { me.spectate = null; return; }
  if (preferId && alive.includes(preferId)) me.spectate = preferId;
  else me.spectate = alive[(alive.indexOf(me.spectate) + 1) % alive.length];
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
// Las teclas salen del registro de controles.js (el jugador las cambia en Configuración).
const PLAYING = ['bus', 'falling', 'glider', 'ground', 'auto'];
const contexto = () => (me.state === 'auto' ? 'vehiculo' : cons.contexto());
canvas.addEventListener('click', () => {
  sfx.unlock();
  if (configAbierta()) return;
  if (me.state === 'dead') { startSpectating(); return; }
  if (!locked && PLAYING.includes(me.state)) canvas.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (!locked) soltarEntradas();
  ui.click.classList.toggle('hidden', locked || !PLAYING.includes(me.state));
});
$('btnPausaConfig').addEventListener('click', (e) => { e.stopPropagation(); abrirConfigDesdeJuego(); });
$('btnConfigMenu').addEventListener('click', () => abrirConfig());
$('btnConfigSala').addEventListener('click', () => abrirConfig());
function abrirConfigDesdeJuego() {
  document.exitPointerLock?.();
  ui.click.classList.add('hidden');
  abrirConfig(() => {
    // al cerrar con un clic o una tecla se vuelve a capturar el mouse
    if (PLAYING.includes(me.state)) canvas.requestPointerLock()?.catch?.(() => {});
    ui.click.classList.toggle('hidden', locked || !PLAYING.includes(me.state));
  });
}
document.addEventListener('mousemove', (e) => {
  if (!locked) return;
  if (e.movementX || e.movementY) autos.movioMouse();
  const scoped = me.aiming && heldItem()?.kind === 'weapon' && WEAPONS[heldItem().w].scope;
  const sens = 0.0022 * opcion('sens') * (scoped ? opcion('sensMira') : me.aiming ? opcion('sensApunta') : 1);
  me.yaw -= e.movementX * sens;
  me.pitch = Math.max(-1.35, Math.min(1.2, me.pitch - e.movementY * sens * (opcion('invertirY') ? -1 : 1)));
});
document.addEventListener('mousedown', (e) => {
  if (!locked) return;
  pulsar('Mouse' + e.button, e);
});
document.addEventListener('mouseup', (e) => { liberar('Mouse' + e.button); });
document.addEventListener('wheel', (e) => {
  if (!locked || !e.deltaY) return;
  const code = e.deltaY > 0 ? 'RuedaAbajo' : 'RuedaArriba';
  pulsar(code, e);
  soltar(code);
}, { passive: true });
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('keydown', (e) => {
  if (configAbierta()) return;
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
  // Esc con el mouse suelto abre la configuración (con el mouse capturado, el navegador usa Esc para soltarlo)
  if (e.code === 'Escape') { if (!ui.hud.classList.contains('hidden') && !locked) abrirConfigDesdeJuego(); return; }
  if (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Tab') e.preventDefault();
  if (e.repeat) return;
  pulsar(e.code, e);
});
document.addEventListener('keyup', (e) => liberar(e.code));
// En partida, cerrar la pestaña sin querer (por ejemplo Ctrl+W mientras se desliza con Ctrl) pide confirmación.
window.addEventListener('beforeunload', (e) => { if (PLAYING.includes(me.state)) { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('blur', soltarEntradas);
function soltarEntradas() { soltarTodo(); mouseDown = false; if (!opcion('apuntarAlternar')) { rmbDown = false; me.aiming = false; } }

// Una tecla, botón o rueda: dispara las acciones que tenga asignadas en el contexto actual.
function pulsar(code, e) {
  presionar(code);
  for (const a of accionesDe(code, contexto())) hacer(a, e);
}
function liberar(code) {
  soltar(code);
  for (const a of accionesDe(code)) {
    if (a === 'disparar' && !activa('disparar')) mouseDown = false;
    if (a === 'apuntar' && !opcion('apuntarAlternar') && !activa('apuntar')) { rmbDown = false; me.aiming = false; }
  }
}
function hacer(a, e) {
  const ranura = /^ranura([1-5])$/.exec(a);
  if (ranura) { selectSlot(Number(ranura[1]) - 1); return; }
  switch (a) {
    case 'disparar': mouseDown = true; mouseClicked = true; break;
    case 'apuntar': rmbDown = opcion('apuntarAlternar') ? !rmbDown : true; me.aiming = rmbDown && canAim(); break;
    case 'saltar': onSpace(); break;
    case 'recargar': startReload(); break;
    case 'interactuar': doInteract(); break;
    case 'tirar': dropHeld(); break;
    case 'bailar': if (me.state === 'ground') me.dance = !me.dance; break;
    case 'deslizar': intentarDeslizar(); break;
    case 'pico': selectSlot(-1); break;
    case 'ranuraSiguiente': case 'ranuraAnterior':
      if (!me.build) selectSlot(((me.sel + 1 + (a === 'ranuraSiguiente' ? 1 : -1) + SLOTS + 1) % (SLOTS + 1)) - 1);
      break;
    case 'construirPared': case 'construirPiso': case 'construirRampa': case 'construirTecho':
    case 'modoConstruccion': case 'cambiarMaterial': case 'editar': case 'girar':
      cons.accion(a); break;
    case 'bajarAuto': case 'cambiarAsiento': case 'bocina':
      autos.accion(a); break;
    case 'chat':
      if (ui.hud.classList.contains('hidden')) break;
      document.exitPointerLock?.();
      ui.chatInput.classList.remove('hidden');
      ui.chatInput.focus();
      e?.preventDefault?.();
      break;
    default: break;
  }
}
// Solo se apunta con un arma en la mano (con el pico, objetos o construyendo, el clic derecho no hace zoom).
function canAim() {
  const it = heldItem();
  return me.state === 'ground' && !me.build && !cons.editando && it?.kind === 'weapon';
}

function selectSlot(i) {
  if (i === me.sel && !me.build && !cons.editando) return;
  me.sel = i;
  cons.salir(); // confirma la edición si había una y sale del modo construcción
  if (opcion('apuntarAlternar')) rmbDown = false;
  if (me.use) cancelUse();
  if (me.reloadSlot >= 0 && me.reloadSlot !== i) { me.reloading = 0; me.reloadSlot = -1; stopWeaponAction(me.mesh); }
  sfx.click();
  updateSlots();
  // Recarga automática al sacar un arma vacía.
  const it = heldItem();
  if (it?.kind === 'weapon' && it.mag === 0) startReload();
}
// Para pruebas: entrar a construir una pieza (o salir con null).
function setBuild(type) {
  if (!type) cons.salir();
  else cons.accion({ pared: 'construirPared', piso: 'construirPiso', rampa: 'construirRampa', techo: 'construirTecho' }[type]);
}

function onSpace() {
  const altura = alturaSuelo();
  if (me.state === 'bus' && room?.bus && now() > room.bus.start) jumpFromBus();
  else if (me.state === 'falling' && altura > PARACAIDAS.MIN) openGlider();
  else if (me.state === 'glider' && puedeCerrar(me, altura)) { cerrarParacaidas(me); sfx.paracaidasCierra(); }
  else if (me.state === 'ground' && me.onGround) {
    // saltar en medio de un deslizamiento conserva la velocidad
    if (me.desliz) terminarDeslizar(me);
    me.vel.y = JUMP; me.onGround = false;
  }
}
function jumpFromBus() {
  me.state = 'falling';
  me.pos.copy(bus.position).y -= 3;
  me.vel.set(0, -10, 0);
  me.mesh.visible = true;
  sendMsg({ t: 'jump' });
}
function openGlider() {
  abrirParacaidas(me);
  sfx.glider();
}
function startReload() {
  const it = heldItem();
  if (!it || it.kind !== 'weapon' || me.reloading > 0 || me.state !== 'ground') return;
  const def = WEAPONS[it.w];
  if (it.mag >= def.mag || !(me.ammo[def.ammo] > 0)) return;
  me.reloading = weaponReload(it);
  me.reloadSlot = me.sel;
  weaponAction(me.mesh, 'reload', me.reloading);
  sendMsg({ t: 'reload', slot: me.sel });
  sfx.reload();
  updateSlots();
}
function dropHeld() {
  if (me.sel < 0 || !heldItem() || me.state !== 'ground') return;
  sendMsg({ t: 'drop', slot: me.sel });
}

// ---------- Interacción (agarrar / abrir) ----------
function findInteract() {
  if (me.state !== 'ground') return null;
  let best = null, bd = PICKUP_RANGE;
  const camDir = camera.getWorldDirection(new THREE.Vector3());
  for (const [id, e] of items) {
    const d = Math.hypot(e.it.x - me.pos.x, e.it.z - me.pos.z);
    if (d > PICKUP_RANGE || Math.abs(e.it.y - me.pos.y) > 2.5) continue;
    // Preferir lo que se está mirando.
    const to = new THREE.Vector3(e.it.x - camera.position.x, e.it.y + 0.4 - camera.position.y, e.it.z - camera.position.z).normalize();
    const score = d - to.dot(camDir) * 1.5;
    if (score < bd) { bd = score; best = { kind: 'item', id, it: e.it }; }
  }
  world.chestSpots.forEach((c, idx) => {
    if (world.chestMeshes[idx].userData.open) return;
    const d = Math.hypot(c.x - me.pos.x, c.z - me.pos.z);
    if (d < PICKUP_RANGE && Math.abs(c.y - me.pos.y) < 2.5 && d - 1 < bd) { bd = d - 1; best = { kind: 'chest', idx }; }
  });
  // autos: lo que está al lado gana (un arma tirada al lado del auto se agarra primero)
  const auto = autos.cercano();
  if (auto && (!best || auto.d < bd)) best = { kind: 'auto', i: auto.i, maneja: auto.maneja };
  return best;
}
function doInteract() {
  if (!interact) return;
  if (interact.kind === 'item') sendMsg({ t: 'pickup', id: interact.id, slot: Math.max(0, me.sel) });
  else if (interact.kind === 'auto') autos.subir(interact.i);
  else sendMsg({ t: 'chest', idx: interact.idx });
}
function updatePrompt() {
  interact = findInteract();
  if (!interact) { ui.prompt.classList.add('hidden'); return; }
  ui.prompt.classList.remove('hidden');
  const tecla = escapeHtml(teclaDe('interactuar'));
  if (interact.kind === 'chest') ui.prompt.innerHTML = `<b>${tecla}</b> Abrir cofre`;
  else if (interact.kind === 'auto') ui.prompt.innerHTML = `<b>${tecla}</b> ${interact.maneja ? 'Manejar' : 'Subir al auto'}`;
  else {
    const it = interact.it;
    const full = it.kind === 'weapon' && me.slots.every(Boolean);
    ui.prompt.innerHTML = `<b>${tecla}</b> ${full ? 'Cambiar por' : 'Agarrar'} <span style="color:${itemColor(it)}">${escapeHtml(itemLabel(it))}</span>`;
  }
}

// ---------- Consumibles ----------
function startUse() {
  const it = heldItem();
  if (!it || it.kind !== 'consumable' || me.use) return;
  const def = CONSUMABLES[it.c];
  if (def.heal && me.hp >= def.max) { feed('Ya tenés la vida al máximo para esto', '#ff6b6b'); return; }
  if (def.shield && me.shield >= def.max) { feed('Ya tenés el escudo al máximo para esto', '#5bc0ff'); return; }
  me.use = { slot: me.sel, c: it.c, t: 0, total: def.time };
  sendMsg({ t: 'useStart', slot: me.sel });
}
function cancelUse() {
  me.use = null;
  sendMsg({ t: 'useCancel' });
  ui.usebar.classList.add('hidden');
}
function updateUse(dt) {
  if (!me.use) { ui.usebar.classList.add('hidden'); return; }
  me.use.t += dt;
  ui.usebar.classList.remove('hidden');
  ui.usefill.style.width = `${Math.min(100, (me.use.t / me.use.total) * 100)}%`;
  ui.usetext.textContent = `${CONSUMABLES[me.use.c].name} ${Math.max(0, me.use.total - me.use.t).toFixed(1)}s`;
  if (me.use.t >= me.use.total) { sendMsg({ t: 'useEnd' }); me.use = null; ui.usebar.classList.add('hidden'); }
}

// ---------- Disparo / pico ----------
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

function structOf(obj) {
  while (obj) { if (obj.userData?.structKey) return obj.userData.structKey; obj = obj.parent; }
  return null;
}

// Normal (en el mundo, mirando hacia el rayo) de la cara que tocó un raycast.
const _m4 = new THREE.Matrix4();
function normalDe(h, dir) {
  if (!h.face) return null;
  const n = h.face.normal.clone();
  if (h.object.isInstancedMesh && h.instanceId !== undefined) { h.object.getMatrixAt(h.instanceId, _m4); n.transformDirection(_m4); }
  n.transformDirection(h.object.matrixWorld);
  if (n.dot(dir) > 0) n.negate();
  return n;
}

// Primer impacto a lo largo del rayo: { dist, n (normal de la cara), pid, head, key, res, idx, pz, auto }
function castRay(origin, dir, range, near) {
  let best = { dist: range };
  raycaster.set(origin, dir);
  raycaster.near = near; raycaster.far = range;
  const hits = raycaster.intersectObjects([...world.solidMeshes, ...world.structMeshes], true);
  for (const h of hits) {
    const key = structOf(h.object);
    if (key) { best = { dist: h.distance, key, n: normalDe(h, dir) }; break; }
    // malla de choque del mapa: cada triángulo sabe de qué pieza es (las fijas no se rompen)
    const tp = h.object.userData.triPz;
    if (tp) {
      const pz = tp[h.faceIndex], p = pz >= 0 ? world.piezas[pz] : null;
      best = p && !p.fija && !p.rota ? { dist: h.distance, pz, n: normalDe(h, dir) } : { dist: h.distance };
      break;
    }
    const hv = h.object.userData.harvest;
    if (hv) {
      if (h.object.isInstancedMesh) {
        const idx = hv.map ? hv.map[h.instanceId] : h.instanceId;
        const list = hv.kind === 'tree' ? world.trees : world.rocks;
        if (!list[idx]?.alive) continue;
        best = { dist: h.distance, res: hv.kind, idx, n: normalDe(h, dir) };
      } else best = { dist: h.distance, res: hv.kind };
      break;
    }
    best = { dist: h.distance };
    break;
  }
  const tt = world.rayTerrain(origin, dir, best.dist);
  if (tt < best.dist) best = { dist: tt };
  const ra = autos.rayo(origin, dir, near, best.dist);
  if (ra) best = ra;
  for (const [id, o] of others) {
    if (!o.mesh.visible || o.state === 'dead' || o.state === 'bus') continue;
    const p = o.mesh.position;
    const th = rayVsSphere(origin, dir, _v.set(p.x, p.y + 1.95, p.z), 0.3);
    if (th > near && th < best.dist) best = { dist: th, pid: id, head: true };
    for (const y of [0.35, 0.85, 1.4]) {
      const t = rayVsSphere(origin, dir, _v.set(p.x, p.y + y, p.z), 0.42);
      if (t > near && t < best.dist) best = { dist: t, pid: id, head: false };
    }
  }
  return best;
}

function tryUseHeld() {
  if (me.state !== 'ground') return;
  if (me.build || cons.editando) return;
  const it = heldItem();
  if (!it) { if (mouseDown) trySwing(); return; }
  if (it.kind === 'consumable') { if (mouseClicked) startUse(); return; }
  const def = WEAPONS[it.w];
  if (def.auto ? !mouseDown : !mouseClicked) return;
  tryShoot(it, def);
}

// Profundidad de la cabeza del jugador vista desde la cámara: lo que está más cerca que eso queda detrás de él.
function headDepth(camDir) {
  return _v.set(me.pos.x, me.pos.y + 1.68, me.pos.z).sub(camera.position).dot(camDir);
}

function trySwing() {
  const t = performance.now() / 1000;
  if (t - me.lastSwing < PICKAXE.cooldown) return;
  me.lastSwing = t;
  me.mesh.userData.swing = 1;
  const camDir = camera.getWorldDirection(new THREE.Vector3());
  const near = headDepth(camDir);
  const res = castRay(camera.position, camDir, near + PICKAXE.range + 0.7, Math.max(0, near - 0.8));
  if (res.dist >= near + PICKAXE.range + 1) { sfx.whiff(); sendMsg({ t: 'swing' }); return; }
  const at = camera.position.clone().addScaledVector(camDir, res.dist);
  // estructuras, árboles y rocas: el golpe lleva el punto y la normal (para el punto débil) y se ve el daño al toque
  const obj = objetivoDe(res);
  if (obj) {
    const n = res.n || camDir.clone().negate();
    sendMsg({ t: 'swing', ...aMensaje(obj), at: at.toArray().map((v) => +v.toFixed(2)), n: n.toArray().map((v) => +v.toFixed(3)) });
    golpes.golpePico(obj, at, n);
    if (obj.tipo === 'pz') { const p = world.piezas[res.pz]; sfx.pickaxe(p.clase === 'madera' ? 'tree' : 'rock'); sparks(at, p.color || '#dddddd'); return; }
    if (obj.tipo === 'key') sfx.pickaxe('struct');
    else { sfx.pickaxe(res.res); world.shakeResource(res.res, res.idx); }
  } else if (res.pid) sendMsg({ t: 'swing', pid: res.pid });
  else if (res.auto !== undefined) { sendMsg({ t: 'swing', auto: res.auto }); sfx.pickaxe('rock'); }
  else if (res.res) { sendMsg({ t: 'swing', res: res.res, idx: res.idx }); sfx.pickaxe(res.res); }
  else { sfx.pickaxe('rock'); sendMsg({ t: 'swing' }); }
  sparks(at, res.res === 'tree' ? '#c58b4c' : '#dddddd');
}

// Lo que se mira con el pico o construyendo (para mostrar su vida).
function mirarPico() {
  const camDir = camera.getWorldDirection(new THREE.Vector3());
  const near = headDepth(camDir);
  return castRay(camera.position, camDir, near + 10, Math.max(0, near - 0.8));
}

function tryShoot(it, def) {
  const t = performance.now() / 1000;
  if (me.reloading > 0 || t - me.lastShot < def.cooldown) return;
  if (it.mag <= 0) { startReload(); return; }
  me.lastShot = t;
  it.mag--;
  const muzzle = (me.mesh.userData.muzzle || me.mesh.userData.gun).getWorldPosition(new THREE.Vector3());
  me.mesh.userData.recoil = 1;
  weaponShot(me.mesh, it.w, me.aiming);
  me.dance = false;
  crossKick = Math.min(30, crossKick + (def.pellets > 1 ? 16 : def.auto ? 4 : 7));
  const camDir = camera.getWorldDirection(new THREE.Vector3());
  const near = Math.max(0.1, headDepth(camDir) + 0.3);
  const moving = Math.hypot(me.vel.x, me.vel.z) > 1;
  const spread = (me.aiming ? def.aimSpread : def.spread) * (me.onGround ? 1 : 2) * (moving && !me.aiming ? 1.4 : 1);
  const tally = new Map();
  let mainEnd = null;
  for (let i = 0; i < def.pellets; i++) {
    _d.copy(camDir);
    _d.x += (Math.random() - 0.5) * spread * 2; _d.y += (Math.random() - 0.5) * spread * 2; _d.z += (Math.random() - 0.5) * spread * 2;
    _d.normalize();
    const res = castRay(camera.position, _d, def.range, near);
    const end = camera.position.clone().addScaledVector(_d, res.dist);
    if (i === 0) mainEnd = end;
    if (res.pid || res.key || res.pz !== undefined || res.auto !== undefined) {
      const k = res.pid ? `p${res.pid}` : res.key ? `s${res.key}` : res.auto !== undefined ? `a${res.auto}` : `z${res.pz}`;
      const e = tally.get(k) || { pid: res.pid, key: res.key, pz: res.pz, auto: res.auto, n: 0, head: false };
      e.n++; e.head = e.head || !!res.head;
      tally.set(k, e);
    }
    if (!def.rocket) { addTracer(muzzle, end, it.w); if (!res.pid) sparks(end, '#ffe9a8', 3); }
  }
  if (def.rocket) addRocket(muzzle, mainEnd);
  for (const e of tally.values()) { const o = objetivoDe(e); if (o) { golpes.mostrar(o); break; } }
  sendMsg({ t: 'shoot', slot: me.sel, from: muzzle.toArray(), to: mainEnd.toArray(), hits: [...tally.values()] });
  sfx.shot(it.w);
  me.pitch = Math.min(1.2, me.pitch + ({ rifle: 0.008, subfusil: 0.006, pistola: 0.012, escopeta: 0.04, francotirador: 0.06, lanzacohetes: 0.05 }[it.w] || 0.01));
  updateSlots();
  if (it.mag === 0) setTimeout(startReload, 150);
}

const tracerMats = {};
function addTracer(a, b, w) {
  const col = w === 'escopeta' ? '#ffb347' : w === 'francotirador' ? '#ffffff' : '#fff3a0';
  tracerMats[col] ||= new THREE.LineBasicMaterial({ color: col, transparent: true });
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), tracerMats[col].clone());
  scene.add(line);
  tracers.push({ line, life: 0.08 });
}

function addRocket(from, to) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.6, 8), new THREE.MeshStandardMaterial({ color: '#9cff6b', emissive: '#55aa22' }));
  m.position.copy(from);
  m.lookAt(to); m.rotateX(Math.PI / 2);
  scene.add(m);
  const dist = from.distanceTo(to);
  effects.push({ obj: m, life: dist / 60, total: dist / 60, from: from.clone(), to: to.clone(), rocket: true });
}

function explosionFx(at, color = '#ff9a3c', scale = 1) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
  m.position.copy(at);
  scene.add(m);
  effects.push({ obj: m, life: 0.45, total: 0.45, grow: 5 * scale });
  if (scale >= 1) sfx.boom(at.distanceTo(me.pos));
}

const sparkGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
// Escombros de una pieza del mapa que se rompe: pedazos de su color que saltan y caen.
const escombroGeo = new THREE.BoxGeometry(1, 1, 1), escombroMats = new Map();
function escombros(p) {
  const a = p.aabb, vol = (a[3] - a[0]) * (a[4] - a[1]) * (a[5] - a[2]);
  const n = Math.max(4, Math.min(18, Math.round(vol * 2)));
  if (!escombroMats.has(p.color)) escombroMats.set(p.color, new THREE.MeshLambertMaterial({ color: p.color || '#aaaaaa' }));
  const mat = escombroMats.get(p.color);
  for (let i = 0; i < n; i++) {
    const s = new THREE.Mesh(escombroGeo, mat);
    s.scale.set(0.15 + Math.random() * 0.35, 0.1 + Math.random() * 0.25, 0.15 + Math.random() * 0.35);
    s.position.set(a[0] + Math.random() * (a[3] - a[0]), a[1] + Math.random() * (a[4] - a[1]), a[2] + Math.random() * (a[5] - a[2]));
    s.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    scene.add(s);
    const life = 0.9 + Math.random() * 0.5;
    effects.push({ obj: s, life, total: life, vel: new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5) });
  }
}
function sparks(at, color, n = 6) {
  const mat = new THREE.MeshBasicMaterial({ color });
  for (let i = 0; i < n; i++) {
    const s = new THREE.Mesh(sparkGeo, mat);
    s.position.copy(at);
    scene.add(s);
    effects.push({ obj: s, life: 0.35, total: 0.35, vel: new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6) });
  }
}

function addDmgNum(pos, dmg, color, cls = '') {
  if (!opcion('numerosDanio')) return;
  const el = document.createElement('div');
  el.textContent = dmg;
  el.style.color = color;
  if (cls) el.className = cls;
  ui.dmgnums.append(el);
  dmgNums.push({ el, pos: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0, 0)), life: 0.9 });
}

function updateEffects(dt) {
  for (let i = tracers.length - 1; i >= 0; i--) {
    const tr = tracers[i];
    tr.life -= dt;
    tr.line.material.opacity = Math.max(0, tr.life / 0.08);
    if (tr.life <= 0) { scene.remove(tr.line); tr.line.geometry.dispose(); tracers.splice(i, 1); }
  }
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.life -= dt;
    const k = 1 - e.life / e.total;
    if (e.rocket) e.obj.position.lerpVectors(e.from, e.to, Math.min(1, k));
    else if (e.grow) { e.obj.scale.setScalar(1 + k * e.grow); e.obj.material.opacity = 0.9 * (1 - k); }
    else if (e.vel) { e.vel.y -= 15 * dt; e.obj.position.addScaledVector(e.vel, dt); }
    if (e.life <= 0) { scene.remove(e.obj); effects.splice(i, 1); }
  }
  const w = window.innerWidth, h = window.innerHeight;
  for (let i = dmgNums.length - 1; i >= 0; i--) {
    const d = dmgNums[i];
    d.life -= dt;
    d.pos.y += dt * 1.2;
    const p = d.pos.clone().project(camera);
    d.el.style.left = `${(p.x * 0.5 + 0.5) * w}px`;
    d.el.style.top = `${(-p.y * 0.5 + 0.5) * h}px`;
    d.el.style.opacity = p.z < 1 ? Math.min(1, d.life * 2) : 0;
    if (d.life <= 0) { d.el.remove(); dmgNums.splice(i, 1); }
  }
}

// ---------- Tormenta ----------
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
      const next = !moving && ph[i + 2] ? ph[i + 2] : b;
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
  bus.rotateY(Math.PI);
  bus.rotation.z += Math.sin(t / 900) * 0.03;
  for (const p of bus.userData.props) p.rotation.z += 0.6;
  bus.visible = room.phase !== 'lobby' && k < 1.4;
}

function updateMe(dt) {
  me.aiming = rmbDown && canAim();
  const fwd = new THREE.Vector3(-Math.sin(me.yaw), 0, -Math.cos(me.yaw));
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const input = new THREE.Vector3();
  if (activa('adelante')) input.add(fwd);
  if (activa('atras')) input.sub(fwd);
  if (activa('derecha')) input.add(right);
  if (activa('izquierda')) input.sub(right);
  if (input.lengthSq() > 0) input.normalize();
  const ground = world.groundHeight(me.pos.x, me.pos.z, me.pos.y);

  if (me.state === 'falling' || me.state === 'glider') {
    // caída libre (planeo / picada) y paracaídas: caida.js
    const ent = { fwd, right, adelante: activa('adelante'), atras: activa('atras'), izq: activa('izquierda'), der: activa('derecha') };
    if (fisicaAire(me, ent, dt, alturaSuelo()) === 'abrir') sfx.glider();
  } else if (me.state === 'ground' && me.desliz) {
    // deslizándose: el impulso se gasta con el roce y crece en bajada
    const swimming = ground < SWIM_Y;
    if (swimming || !fisicaDeslizar(me, dt, pendiente(me.pos.x, me.pos.z), input, activa('deslizar'))) terminarDeslizar(me);
    me.vel.y -= GRAVITY * dt;
    if (!me.onGround) me.minVy = Math.min(me.minVy, me.vel.y);
  } else if (me.state === 'ground') {
    const swimming = ground < SWIM_Y;
    // mantener apretado deslizarse mientras se arranca a correr también vale (una vez por apretada: al terminar un
    // deslizamiento con la tecla apretada no empieza otro hasta soltarla)
    if (!activa('deslizar')) me.deslizSuelta = true;
    else if (me.deslizSuelta && puedeDeslizar(me, swimming)) intentarDeslizar();
    const slow = me.use ? 0.5 : 1;
    // "Correr siempre": se corre sin apretar nada y la tecla de correr pasa a caminar
    const corre = activa('adelante') && (activa('correr') !== !!opcion('correrSiempre'));
    const speed = (swimming ? 4 : me.aiming ? AIM_WALK : corre ? SPRINT : WALK) * slow;
    const accel = me.onGround || swimming ? 12 : 3;
    me.vel.x += (input.x * speed - me.vel.x) * Math.min(1, dt * accel);
    me.vel.z += (input.z * speed - me.vel.z) * Math.min(1, dt * accel);
    me.vel.y -= GRAVITY * dt;
    if (!me.onGround) me.minVy = Math.min(me.minVy, me.vel.y);
  }
  // pasos chicos con piso, techo y paredes: no se atraviesan techos ni pisos aunque se caiga rápido
  world.moveBody(me.pos, me.vel, dt);
  const lim = world.size * 0.75;
  me.pos.x = Math.max(-lim, Math.min(lim, me.pos.x));
  me.pos.z = Math.max(-lim, Math.min(lim, me.pos.z));

  const g2 = Math.max(world.groundHeight(me.pos.x, me.pos.z, me.pos.y), SWIM_Y);
  if (me.pos.y <= g2) {
    if (me.state === 'falling' || me.state === 'glider') { me.state = 'ground'; me.vel.y = 0; me.minVy = 0; }
    // Daño por caída
    if (me.state === 'ground' && me.minVy < -20 && g2 > SWIM_Y) sendMsg({ t: 'fall', dmg: Math.round((-me.minVy - 20) * 5) });
    me.minVy = 0;
    me.pos.y = g2;
    if (me.vel.y < 0) me.vel.y = 0;
    me.onGround = true;
  } else if (me.state === 'ground' && me.pos.y - g2 < 0.3 && me.vel.y <= 0) {
    me.pos.y = g2; me.vel.y = 0; me.onGround = true; me.minVy = 0;
  } else me.onGround = false;

  if (me.reloading > 0) {
    me.reloading -= dt;
    if (me.reloading <= 0) { me.reloading = 0; updateSlots(); }
  }
  tryUseHeld();
  mouseClicked = false;

  me.mesh.visible = true;
  me.mesh.position.copy(me.pos);
  const hs = Math.hypot(me.vel.x, me.vel.z);
  const it = heldItem();
  const armado = (me.aiming || mouseDown) && it?.kind === 'weapon';
  // deslizándose el cuerpo mira hacia donde va, salvo que se esté apuntando o tirando
  me.mesh.rotation.y = me.desliz && !armado ? me.desliz.yaw : me.yaw;
  if (me.dance && (hs > 0.5 || me.state !== 'ground' || mouseDown)) me.dance = false;
  animateCharacter(me.mesh, me.state, hs, dt, armado,
    { air: !me.onGround, vy: me.vel.y, pitch: me.pitch, dance: me.dance, caida: me.caida, giro: me.giro, freno: me.freno, desliz: !!me.desliz });
  sfx.viento(me.state === 'falling' ? Math.min(1, -me.vel.y / 70) : me.state === 'glider' ? 0.25 : 0);
  if (me.desliz) sfx.deslizar(hs / DESLIZ.MAX); else sfx.deslizar(0);
  if (me.state === 'ground' && me.mesh.userData.headG) me.mesh.userData.headG.rotation.x = me.pitch * 0.5;
}

// Altura sobre lo que hay abajo (terreno, techo o el agua): manda la apertura del paracaídas.
function alturaSuelo() {
  return me.pos.y - Math.max(world.groundHeight(me.pos.x, me.pos.z, me.pos.y), SWIM_Y);
}
// Pendiente del piso (dh/dx, dh/dz) para deslizarse.
function pendiente(x, z) {
  const e = 0.6;
  const h = (a, b) => world.groundHeight(a, b, me.pos.y + 0.5);
  return new THREE.Vector2((h(x + e, z) - h(x - e, z)) / (2 * e), (h(x, z + e) - h(x, z - e)) / (2 * e));
}
function intentarDeslizar() {
  const ground = world?.groundHeight(me.pos.x, me.pos.z, me.pos.y) ?? 0;
  if (!puedeDeslizar(me, ground < SWIM_Y)) return;
  empezarDeslizar(me);
  me.deslizSuelta = false;
  if (me.use) cancelUse();
  sfx.deslizarInicio();
}

function updateOthers(dt) {
  for (const [id, o] of others) {
    const vis = o.seen && o.state !== 'bus' && o.state !== 'dead' && o.info?.alive !== false && room.phase !== 'lobby';
    o.mesh.visible = vis;
    if (!vis) continue;
    // sentado en un auto: va donde está el asiento (manejar.js)
    if (autos.sentarOtro(id, o.mesh, dt)) { o.speed = 0; o.vy = 0; continue; }
    if (o.mesh.rotation.x || o.mesh.rotation.z) o.mesh.rotation.set(0, o.mesh.rotation.y, 0);
    o.prev.copy(o.mesh.position);
    o.mesh.position.lerp(o.target, 1 - Math.exp(-dt * 12));
    let dr = o.rotTarget - o.mesh.rotation.y;
    dr = Math.atan2(Math.sin(dr), Math.cos(dr));
    o.mesh.rotation.y += dr * Math.min(1, dt * 12);
    const sp = Math.hypot(o.mesh.position.x - o.prev.x, o.mesh.position.z - o.prev.z) / Math.max(dt, 1e-3);
    o.speed += (sp - o.speed) * Math.min(1, dt * 8);
    const vy = (o.mesh.position.y - o.prev.y) / Math.max(dt, 1e-3);
    o.vy = (o.vy || 0) + (vy - (o.vy || 0)) * Math.min(1, dt * 10);
    const x = o.x || {};
    animateCharacter(o.mesh, o.state, o.speed, dt, o.aiming, { air: !x.desliz && Math.abs(o.vy) > 1.6, vy: o.vy, pitch: 0, dance: o.dance, ...x });
  }
}

function updateItems(t) {
  animarLoot(items, world.chestMeshes, t, camera);
}

const camTarget = new THREE.Vector3();
const camRay = new THREE.Raycaster();
const _cd = new THREE.Vector3();
let camArm = null; // largo actual del brazo de la cámara: entra de golpe si choca y sale suave al despejarse
let camD = null, camS = 0, camU = 0, camAlto = 1.68; // distancia, corrimiento al hombro y altura, suavizados
function updateCamera(dt, t) {
  if (!world) return;
  if (me.state === 'lobby' || !room || room.phase === 'lobby') {
    const a = t / 20000;
    camera.position.set(Math.cos(a) * 520, 220, Math.sin(a) * 520);
    camera.lookAt(0, 20, 0);
    camArm = null; camD = null;
    return;
  }
  let focus, dist, side = 0, up, collide = false;
  const it = heldItem();
  const scoped = me.aiming && me.state === 'ground' && it?.kind === 'weapon' && WEAPONS[it.w].scope && it.w === 'francotirador';
  if (me.state === 'bus') { focus = bus.position; dist = 28; up = 4; }
  else if (me.state === 'dead' || me.state === 'ended') {
    const o = me.spectate && others.get(me.spectate);
    if (o && o.mesh.visible) { focus = o.mesh.position.clone().add(new THREE.Vector3(0, 1.6, 0)); dist = 4.5; up = 0.3; side = 0.7; collide = true; }
    else { focus = me.pos.clone().add(new THREE.Vector3(0, 2, 0)); dist = 14; up = 2; }
  } else if (me.state === 'falling') {
    focus = me.pos.clone().add(new THREE.Vector3(0, 1.2, 0)); dist = 7.5; up = 0.6; collide = true;
  } else if (me.state === 'glider') {
    // más lejos y más alto: entra la vela del paracaídas en la pantalla
    focus = me.pos.clone().add(new THREE.Vector3(0, 2.0, 0)); dist = 9; up = 1.1; collide = true;
  } else if (me.state === 'auto' && autos.mio) {
    // en el auto: atrás y arriba, un poco más lejos cuanto más rápido va
    const a = autos.mio.a;
    focus = new THREE.Vector3(a.x, a.y + 1.75, a.z);
    dist = 6.6 + Math.min(2.2, Math.hypot(a.vx, a.vz) * 0.07); up = 0.75; collide = true;
  } else {
    // cámara al hombro, cerca del personaje (como en los battle royale en tercera persona); baja al deslizarse
    camAlto += ((me.desliz ? DESLIZ.ALTO_CAMARA : 1.68) - camAlto) * Math.min(1, dt * 8);
    focus = me.pos.clone().add(new THREE.Vector3(0, camAlto, 0));
    dist = scoped ? 0.2 : me.aiming ? 1.9 : me.build || cons.editando ? 4.6 : 3.6;
    side = scoped ? 0 : me.aiming ? 0.72 : me.build || cons.editando ? 0.9 : 0.8;
    up = scoped ? 0 : me.aiming ? 0.12 : 0.28;
    collide = !scoped;
  }
  const dir = new THREE.Vector3(-Math.sin(me.yaw) * Math.cos(me.pitch), Math.sin(me.pitch), -Math.cos(me.yaw) * Math.cos(me.pitch));
  const right = new THREE.Vector3(Math.cos(me.yaw), 0, -Math.sin(me.yaw));
  if (camD === null) { camD = dist; camS = side; camU = up; }
  const k = scoped ? 1 : 1 - Math.exp(-dt * 14);
  camD += (dist - camD) * k; camS += (side - camS) * k; camU += (up - camU) * k;
  camTarget.copy(focus).addScaledVector(dir, -camD).addScaledVector(right, camS);
  camTarget.y += camU;
  if (collide) {
    // brazo con colisión: si entre la cabeza y la cámara hay una casa o una construcción, la cámara se acerca
    _cd.subVectors(camTarget, focus);
    const want = _cd.length();
    _cd.divideScalar(want);
    camRay.set(focus, _cd);
    camRay.near = 0;
    camRay.far = want + 0.35;
    let len = want;
    const hits = camRay.intersectObjects(world.camMeshes.concat(world.structMeshes), true);
    if (hits.length) len = Math.min(len, Math.max(0.2, hits[0].distance - 0.35));
    const tt = world.rayTerrain(focus, _cd, want + 0.35);
    if (tt < Infinity) len = Math.min(len, Math.max(0.2, tt - 0.35));
    camArm = camArm === null || len < camArm ? len : camArm + (len - camArm) * (1 - Math.exp(-dt * 6));
    camTarget.copy(focus).addScaledVector(_cd, camArm);
  } else camArm = null;
  const minY = world.terrainHeight(camTarget.x, camTarget.z) + 0.4;
  if (camTarget.y < minY) camTarget.y = minY;
  camera.position.copy(camTarget);
  camera.lookAt(camera.position.clone().add(dir));
  const fovBase = opcion('fov');
  const enAuto = me.state === 'auto' && autos.mio;
  const fovTarget = scoped ? 18 : me.aiming ? fovBase - 18 : me.state === 'falling' ? fovBase + 8 + 8 * Math.max(0, me.caida) : me.desliz ? fovBase + 5
    : enAuto ? fovBase + Math.min(9, Math.hypot(enAuto.a.vx, enAuto.a.vz) * 0.22) + (enAuto.a.turbando ? 5 : 0) : fovBase;
  camera.fov += (fovTarget - camera.fov) * Math.min(1, dt * 12);
  camera.updateProjectionMatrix();
  ui.scope.classList.toggle('hidden', !scoped);
  updateCrosshair(dt, scoped);
  // con la cámara pegada a la cabeza (contra una pared) el personaje se oculta para no verlo por dentro
  if (me.mesh) me.mesh.visible = me.mesh.visible && !scoped && !(camArm !== null && camArm < 0.9 && me.state === 'ground');
}

// Mira según lo que hay en la mano; la apertura sigue a la dispersión real del disparo (en píxeles de pantalla)
const CROSS = { rifle: 'rifle', subfusil: 'smg', pistola: 'pistola', escopeta: 'escopeta', francotirador: 'franco', lanzacohetes: 'cohete' };
let crossType = '', crossGap = 8, crossKick = 0;
function updateCrosshair(dt, scoped) {
  const it = heldItem();
  let type = me.state !== 'ground' || scoped ? 'nada' : me.build || cons.editando ? 'construir' : !it ? 'pico' : it.kind === 'weapon' ? CROSS[it.w] || 'rifle' : 'objeto';
  if (type !== crossType) { ui.crosshair.className = 'ch-' + type; crossType = type; }
  let gap = 5;
  if (it?.kind === 'weapon' && !me.build) {
    const def = WEAPONS[it.w];
    const moving = Math.hypot(me.vel.x, me.vel.z) > 1;
    const spread = (me.aiming ? def.aimSpread : def.spread) * (me.onGround ? 1 : 2) * (moving && !me.aiming ? 1.4 : 1);
    gap = spread / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (innerHeight / 2);
    gap = Math.max(def.pellets > 1 ? 12 : def.rocket ? 13 : def.scope ? 10 : 3, gap);
  } else if (type === 'pico') gap = 6;
  crossKick *= Math.exp(-dt * 9);
  crossGap += (gap + crossKick - crossGap) * Math.min(1, dt * 18);
  ui.crosshair.style.setProperty('--gap', crossGap.toFixed(1) + 'px');
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

function drawMinimap(s) {
  if (!minimapBase) return;
  const ctx = ui.minimap.getContext('2d');
  const W = ui.minimap.width, size = world.size, half = size / 2;
  const toM = (x) => ((x + half) / size) * W;
  ctx.drawImage(minimapBase, 0, 0, W, W);
  ctx.font = 'bold 9px system-ui';
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.textAlign = 'center';
  ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  for (const p of world.pois) { const lx = toM(p.x + (p.lx || 0)), ly = toM(p.z + (p.lz || 0)) - 6; ctx.strokeText(p.name, lx, ly); ctx.fillText(p.name, lx, ly); }
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
  autos.minimapa(ctx, toM, W / size);
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
    else ui.center.innerHTML = `<small>Apretá ${escapeHtml(teclaDe('saltar').toUpperCase())} para saltar del bus</small>`;
  } else if (me.state === 'falling' || me.state === 'glider') {
    // altura y qué hace la tecla de saltar; debajo del límite el paracaídas ya no se cierra
    const alt = Math.round(alturaSuelo());
    const tecla = escapeHtml(teclaDe('saltar').toUpperCase());
    const que = me.state === 'falling' ? `${tecla} abre el paracaídas`
      : !me.paraBloq && alt >= PARACAIDAS.LIMITE ? `${tecla} lo cierra` : '';
    ui.center.innerHTML = `<small class="altura">${alt} m${que ? ' · ' + que : ''}</small>`;
  } else if ((me.state === 'ground' || me.state === 'auto') && (ui.center.innerHTML.includes('altura') || ui.center.innerHTML.includes('bus'))) showCenter('');
  if (me.state === 'ground') updatePrompt(); else ui.prompt.classList.add('hidden');
  autos.hud();
}

let fpsN = 0, fpsT = 0;
function frame() {
  requestAnimationFrame(frame);
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.05);
  avanzarAspecto(dt); // efectos animados de las skins
  fpsN++; fpsT += rawDt;
  if (fpsT >= 0.5) { if (opcion('fps')) $('fps').textContent = `${Math.round(fpsN / fpsT)} FPS`; fpsN = 0; fpsT = 0; }
  const t = now();
  if (world && room && room.phase !== 'lobby') {
    updateBus(t);
    if (['falling', 'glider', 'ground'].includes(me.state)) { updateMe(dt); cons.update(dt, mouseDown); updateUse(dt); }
    else if (me.state === 'bus') { me.pos.copy(bus.position); me.mesh.visible = false; }
    autos.update(dt); // autos (el propio se simula acá) y yo sentado si voy en uno
    updateOthers(dt);
    updateItems(t);
    world.updateStructs();
    golpes.update(dt, me.state === 'ground' && (!!me.build || cons.editando || me.sel === -1));
    const s = updateStorm(t);
    drawMinimap(s);
    updateHud(t);
    sendTimer -= dt;
    if (sendTimer <= 0 && ['falling', 'glider', 'ground', 'auto'].includes(me.state)) {
      sendTimer = 1 / 15;
      const it = heldItem();
      const h = me.build ? [null] : !it ? ['pico'] : it.kind === 'weapon' ? [it.w, RARITIES[it.rarity].color] : ['item', CONSUMABLES[it.c].color];
      sendMsg({ t: 'state', p: [+me.pos.x.toFixed(2), +me.pos.y.toFixed(2), +me.pos.z.toFixed(2)], r: +me.mesh.rotation.y.toFixed(3), s: me.state, x: paramsRed(me), a: (me.aiming || mouseDown) && it?.kind === 'weapon', h, b: !!me.dance, rl: me.reloading > 0 ? +me.reloading.toFixed(2) : 0 });
    }
  }
  updateEffects(dt);
  updateCamera(dt, t);
  const focus = ['ground', 'glider', 'falling', 'auto'].includes(me.state) ? me.pos : camera.position;
  sun.target.position.copy(focus);
  sun.position.copy(focus).addScaledVector(SUN_DIR, 300);
  renderer.render(scene, camera);
}
frame();

// Para pruebas automatizadas.
import * as ITEMS from "./items.js";
window.__WEAPONS = ITEMS.WEAPONS;
window.__game = {
  me, others, items, camera, sendMsg, selectSlot, setBuild, doInteract, findInteract, trySwing, tryShoot, updateSlots, renderer, scene, cons, pulsar, liberar, autos, golpes, castRay,
  get room() { return room; }, get world() { return world; },
};
