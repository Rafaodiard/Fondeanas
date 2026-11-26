// Pruebas de los bots sin servidor: navegación y que un bot llegue caminando a los cofres.
// Uso: node tools/bots/pruebas.mjs        (MUCHOS=1 prueba todos los cofres en vez de uno de cada tres)
// Para una partida entera con el servidor y bots peleando: node tools/bots/partida.mjs
import { World } from '../../public/js/world.js';
import { Navegacion } from '../../servidor/navegacion.js';
import { nuevoBot, prepararBots, actualizarBots } from '../../servidor/bots.js';
import { cuantosBots, totalValido, dificultadValida } from '../../public/js/opcionesBots.js';

let fallas = 0;
const ok = (c, m) => { console.log(c ? '  ok ' : 'FALLA', m); if (!c) fallas++; };
const world = new World(1, 1200);

// 1) opciones compartidas
ok(cuantosBots(12, 3) === 9 && cuantosBots(0, 3) === 0 && cuantosBots(4, 6) === 0 && cuantosBots(99, 1) === 23, 'cuántos bots entran según las personas de la sala');
ok(totalValido(12) && !totalValido(13) && dificultadValida('dificil') && !dificultadValida('x'), 'se validan el total y la dificultad');

// 2) rutas: desde 15 m afuera se llega a los lugares de loot y a los cofres
{
  const nav = new Navegacion(world);
  const lugares = [...world.lootSpots.filter((_, i) => i % 5 === 0), ...world.chestSpots.filter((_, i) => i % 3 === 0)];
  let mal = 0, n = 0;
  for (const s of lugares) {
    const g = nav.grillaYa(s.x, s.z, 20);
    let desde = null;
    for (let a = 0; a < 16 && !desde; a++) {
      const x = s.x + Math.cos(a * 0.4) * 15, z = s.z + Math.sin(a * 0.4) * 15;
      const p = { x, y: world.terrainHeight(x, z), z };
      if (nav.nodoCerca(g, p, 1, 0.3) >= 0) desde = p;
    }
    if (!desde) continue;
    n++;
    const r = nav.ruta(g, desde, s);
    if (!r || !r.llega) { mal++; if (mal < 10) console.log('     sin ruta a', s.x.toFixed(1), s.y.toFixed(1), s.z.toFixed(1)); }
  }
  // (el loot de los botes que flotan lejos del muelle no se alcanza ni nadando: la cubierta queda 2,1 m arriba del agua)
  ok(mal <= Math.ceil(n * 0.02) && n > 50, `hay ruta caminando (o nadando) a ${n - mal} de ${n} lugares de loot y cofres`);
}

// 3) un bot de verdad (física del jugador + ruta) llega caminando hasta el cofre y lo abre
{
  const cofres = world.chestSpots.map((c, idx) => ({ ...c, idx })).filter((_, i) => process.env.MUCHOS || i % 3 === 0);
  let llegan = 0, total = 0;
  const lentos = [];
  for (const c of cofres) {
    let now = 1e6;
    const room = {
      world, players: new Map(), items: new Map(), chests: world.chestSpots.map((x) => ({ ...x, open: false })), trees: world.trees.map(() => 150),
      storm: { phases: [{ t: 0, r: 5000, x: 0, z: 0, dps: 1 }, { t: 9999, r: 5000, x: 0, z: 0, dps: 1 }], start: now },
      bus: { from: [0, 260, -700], to: [0, 260, 700], start: now, duration: 22000 }, phase: 'playing',
    };
    const p = { ...nuevoBot('normal'), id: 1, name: 'Bot', alive: true, hp: 100, shield: 0, state: 'ground', pos: [0, 0, 0], slots: Array(5).fill(null), ammo: {}, mats: { madera: 0, piedra: 0, metal: 0 } };
    room.players.set(1, p);
    prepararBots(room);
    // partida: un lugar sobre el terreno a 14 m del cofre
    let desde = null;
    for (let a = 0; a < 24 && !desde; a++) {
      const x = c.x + Math.cos(a * 0.27) * 14, z = c.z + Math.sin(a * 0.27) * 14;
      const y = world.groundHeight(x, z, world.terrainHeight(x, z) + 0.5);
      if (y > -1 && Math.abs(y - world.terrainHeight(x, z)) < 0.1 && !world.nearSolid(x, z, 1.5)) desde = { x, y, z };
    }
    if (!desde) continue;
    total++;
    Object.assign(p.bot, { enBus: false, p: { ...desde }, piensaEn: Infinity, meta: { tipo: 'cofre', clave: 'c' + c.idx, idx: c.idx, punto: { x: c.x, y: c.y, z: c.z } } });
    let abierto = false;
    const ctx = {
      dt: 0.05, handleGame: (r, q, m) => { if (m.t === 'chest' && m.idx === c.idx) { abierto = true; r.chests[m.idx].open = true; } },
      broadcast: () => {}, stormAt: (st) => st.phases[0], busPos: () => ({ x: 0, y: 260, z: 0 }),
    };
    let t = 0;
    for (; t < 60 && !abierto; t += 0.05) {
      now += 50; ctx.now = now;
      actualizarBots(room, ctx);
      room.nav.trabajar(1e9);
    }
    if (abierto) { llegan++; if (t > 20) lentos.push(`${t.toFixed(0)} s`); }
    else if (total - llegan < 12) console.log(`     no llegó al cofre ${c.idx} (${c.x.toFixed(1)}, ${c.y.toFixed(1)}, ${c.z.toFixed(1)}); quedó en (${p.bot.p.x.toFixed(1)}, ${p.bot.p.y.toFixed(1)}, ${p.bot.p.z.toFixed(1)})`);
  }
  ok(llegan >= total * 0.97, `un bot llega caminando y abre ${llegan} de ${total} cofres (desde 14 m)${lentos.length ? ` · lentos: ${lentos.join(', ')}` : ''}`);
}

// 4) desde un piso alto (cofres arriba de casas, edificios y torres) sale y llega a un lugar a 70 m
{
  const altos = world.chestSpots.map((c, idx) => ({ ...c, idx })).filter((c) => c.y > world.terrainHeight(c.x, c.z) + 2.5);
  let llegan = 0, total = 0;
  for (const c of altos.filter((_, i) => process.env.MUCHOS || i % 2 === 0)) {
    // meta: un lugar al aire libre a 70 m, sobre tierra firme
    let meta = null;
    for (let a = 0; a < 16 && !meta; a++) {
      const x = c.x + Math.cos(a * 0.4) * 70, z = c.z + Math.sin(a * 0.4) * 70;
      const y = world.terrainHeight(x, z);
      if (y > 0.5 && !world.nearSolid(x, z, 4) && world.groundHeight(x, z, y + 0.5) - y < 0.1) meta = { x, y, z };
    }
    if (!meta) continue;
    total++;
    let now = 1e6;
    const room = {
      world, players: new Map(), items: new Map(), chests: world.chestSpots.map((x) => ({ ...x, open: true })), trees: world.trees.map(() => 0),
      storm: { phases: [{ t: 0, r: 5000, x: 0, z: 0, dps: 1 }, { t: 9999, r: 5000, x: 0, z: 0, dps: 1 }], start: now },
      bus: { from: [0, 260, -700], to: [0, 260, 700], start: now, duration: 22000 }, phase: 'playing',
    };
    const p = { ...nuevoBot('normal'), id: 1, name: 'Bot', alive: true, hp: 100, shield: 0, state: 'ground', pos: [0, 0, 0], slots: Array(5).fill(null), ammo: {}, mats: { madera: 0, piedra: 0, metal: 0 } };
    room.players.set(1, p);
    prepararBots(room);
    Object.assign(p.bot, { enBus: false, p: { x: c.x, y: c.y, z: c.z }, piensaEn: Infinity, meta: { tipo: 'zona', clave: 'zona', punto: meta } });
    const ctx = { dt: 0.05, handleGame: () => {}, broadcast: () => {}, stormAt: (st) => st.phases[0], busPos: () => ({ x: 0, y: 260, z: 0 }) };
    let t = 0;
    for (; t < 45 && p.bot.meta; t += 0.05) { now += 50; ctx.now = now; actualizarBots(room, ctx); room.nav.trabajar(1e9); p.bot.piensaEn = Infinity; }
    if (!p.bot.meta || dist(p.bot.p, meta) < 5) llegan++;
    else if (total - llegan < 8) console.log(`     desde el cofre ${c.idx} (${c.x.toFixed(1)}, ${c.y.toFixed(1)}, ${c.z.toFixed(1)}) no llegó; quedó en (${p.bot.p.x.toFixed(1)}, ${p.bot.p.y.toFixed(1)}, ${p.bot.p.z.toFixed(1)})`);
  }
  ok(llegan >= total * 0.9, `desde un piso alto sale y llega a 70 m: ${llegan} de ${total}`);
}
function dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

console.log(fallas ? `${fallas} FALLAS` : 'todo OK');
process.exit(fallas ? 1 : 0);
