// Pruebas de la grilla de encastre contra el servidor de verdad (por WebSocket, sin navegador):
// el servidor tiene que rechazar piezas mal puestas aunque un cliente tramposo las mande igual.
// Uso: node tools/construccion/red.mjs  → tiene que terminar con "todo OK".
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import WebSocket from 'ws';
import { World } from '../../public/js/world.js';
import { GRID } from '../../public/js/items.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 3000 + Math.floor(Math.random() * 900) + 50;
let fallas = 0;
const ok = (c, m) => { if (c) console.log('  ok ', m); else { fallas++; console.log('  MAL', m); } };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn(process.execPath, ['server.js'], { cwd: RAIZ, env: { ...process.env, PORT: String(PORT), SF_MATS: '500' }, stdio: 'ignore' });
process.on('exit', () => server.kill());

function cliente() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${PORT}`);
    const c = { ws, msgs: [] };
    c.send = (m) => ws.send(JSON.stringify(m));
    c.proximo = async (f, ms = 3000) => {
      for (let t = 0; t < ms; t += 20) { const i = c.msgs.findIndex(f); if (i >= 0) return c.msgs.splice(i, 1)[0]; await espera(20); }
      return null;
    };
    ws.on('message', (raw) => c.msgs.push(JSON.parse(raw)));
    ws.on('open', () => resolve(c));
    ws.on('error', reject);
  });
}

// Lugar plano y libre del mapa (el mismo criterio que tools/construccion/pruebas.mjs)
function lugarPlano(world) {
  for (let x = -400; x < 400; x += 8) for (let z = -400; z < 400; z += 8) {
    const i = Math.floor(x / GRID), j = Math.floor(z / GRID);
    const hs = [];
    for (let a = -1; a <= 3; a++) for (let b = -1; b <= 3; b++) hs.push(world.terrainHeight((i + a) * GRID, (j + b) * GRID));
    if (Math.min(...hs) < 2 || Math.max(...hs) - Math.min(...hs) > 0.6) continue;
    let libre = true;
    world.sol.near((i + 1) * GRID, (j + 1) * GRID, GRID * 4, () => { libre = false; });
    if (libre) return { i, j, y: Math.ceil(Math.max(...hs) * 2) / 2 - 0.5 };
  }
  return null;
}

try {
  await espera(600);
  let a;
  for (let k = 0; k < 20 && !a; k++) { try { a = await cliente(); } catch { await espera(300); } }
  a.send({ t: 'create', name: 'Constructor' });
  await a.proximo((m) => m.t === 'welcome');
  a.send({ t: 'start' });
  const inicio = await a.proximo((m) => m.t === 'matchStart', 8000);
  const world = new World(inicio.room.seed, inicio.room.islandSize);
  const L = lugarPlano(world);
  ok(!!L, 'hay un lugar plano para construir');
  await a.proximo((m) => m.t === 'phase' && m.phase === 'playing', 20000);
  a.send({ t: 'jump' });
  await espera(100);
  const px = L.i * GRID + GRID / 2, pz = L.j * GRID + GRID / 2;
  a.send({ t: 'state', p: [px, world.groundHeight(px, pz), pz], r: 0, s: 'ground' });
  await espera(100);

  // manda una pieza y espera si el servidor la agrega
  const poner = async (type, i, j, y, dir = 0) => {
    a.msgs.length = 0;
    a.send({ t: 'build', type, i: L.i + i, j: L.j + j, y, dir, mat: 'madera' });
    return !!(await a.proximo((m) => m.t === 'structAdd', 500));
  };
  const y0 = L.y;
  ok(await poner('pared', 0, 0, y0), 'pared en el piso: la acepta');
  ok(!(await poner('piso', 0, 0, y0 + 2)), 'piso en el medio de la pared: lo rechaza');
  ok(!(await poner('piso', 0, -1, y0 + 1.5)), 'piso corrido de la grilla del otro lado: lo rechaza');
  ok(!(await poner('piso', 3, 3, y0 + GRID)), 'piso flotando: lo rechaza');
  ok(await poner('piso', 0, 0, y0 + GRID), 'piso en el borde de arriba de la pared: lo acepta');
  ok(await poner('rampa', 0, -1, y0, 0), 'rampa que sale de la base de la pared: la acepta');
  ok(!(await poner('techo', 0, -1, y0)), 'techo en la misma celda que la rampa: lo rechaza');
  ok(await poner('piso', 0, -2, y0 + GRID), 'piso en el borde alto de la rampa: lo acepta');
  ok(await poner('techo', 0, 0, y0 + GRID), 'techo arriba del piso: lo acepta');
  ok(!(await poner('pared', 1, 0, y0 + GRID)), 'pared en el aire tocando solo una punta: la rechaza');
} catch (e) {
  fallas++;
  console.log('  MAL', e.message);
}
server.kill();
console.log(fallas ? `${fallas} pruebas fallaron` : 'todo OK');
process.exit(fallas ? 1 : 0);
