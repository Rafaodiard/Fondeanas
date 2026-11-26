// Pruebas del daño visible y del punto débil del pico, contra el servidor de verdad (por WebSocket, sin navegador).
// Uso: node tools/golpes/pruebas.mjs  → tiene que terminar con "todo OK".
// Levanta server.js en otro puerto, arma una partida, se para al lado de una pared del mapa y la pica.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import WebSocket from 'ws';
import { World } from '../../public/js/world.js';
import { PICKAXE, PUNTO_DEBIL } from '../../public/js/items.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 3000 + Math.floor(Math.random() * 900) + 50;
let fallas = 0;
const ok = (c, m) => { if (c) console.log('  ok ', m); else { fallas++; console.log('  MAL', m); } };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const server = spawn(process.execPath, ['server.js'], { cwd: RAIZ, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
process.on('exit', () => server.kill());

function cliente(nombre) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${PORT}`);
    const c = { ws, msgs: [], esperando: [] };
    c.send = (m) => ws.send(JSON.stringify(m));
    // espera el próximo mensaje que cumpla f (o falla a los ms)
    c.proximo = (f, ms = 3000) => new Promise((res, rej) => {
      const i = c.msgs.findIndex(f);
      if (i >= 0) return res(c.msgs.splice(i, 1)[0]);
      const w = { f, res };
      c.esperando.push(w);
      setTimeout(() => { const k = c.esperando.indexOf(w); if (k >= 0) { c.esperando.splice(k, 1); rej(new Error(`no llegó el mensaje esperado (${nombre})`)); } }, ms);
    });
    ws.on('message', (raw) => {
      const m = JSON.parse(raw);
      const w = c.esperando.find((x) => x.f(m));
      if (w) { c.esperando.splice(c.esperando.indexOf(w), 1); w.res(m); } else c.msgs.push(m);
    });
    ws.on('open', () => resolve(c));
    ws.on('error', reject);
  });
}

// Pared del mapa con una cara libre: { pz, at, n, pie } (pie = dónde pararse)
function buscarPared(world) {
  for (const pz of world.piezas) {
    if (pz.fija) continue;
    for (const s of pz.solids) {
      if (s.cyl || s.up || s.vidrio) continue;
      const dx = s.x1 - s.x0, dz = s.z1 - s.z0, alto = s.y1 - s.y0;
      if (alto < 2.4 || Math.min(dx, dz) > 0.4 || Math.max(dx, dz) < 3) continue;
      const enX = dx < dz; // la pared es delgada en x: la cara mira a ±x
      for (const lado of [-1, 1]) {
        const n = enX ? [lado, 0, 0] : [0, 0, lado];
        const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
        const at = [enX ? (lado > 0 ? s.x1 : s.x0) : cx, 0, enX ? cz : (lado > 0 ? s.z1 : s.z0)];
        const pie = [at[0] + n[0] * 1.4, 0, at[2] + n[2] * 1.4];
        const suelo = world.groundHeight(pie[0], pie[2], s.y0 + 1);
        if (Math.abs(suelo - s.y0) > 0.3) continue;
        // que del lado de afuera no haya nada pegado
        let libre = true;
        world.sol.near(pie[0], pie[2], 1.2, (o) => {
          if (o.dead || o === s || o.cyl || o.y1 <= suelo + 0.3 || o.y0 >= suelo + 2.2) return;
          const x0 = Math.min(pie[0], at[0]) - 0.45, x1 = Math.max(pie[0], at[0]) + 0.45, z0 = Math.min(pie[2], at[2]) - 0.45, z1 = Math.max(pie[2], at[2]) + 0.45;
          if (o.x1 > x0 + 0.05 && o.x0 < x1 - 0.05 && o.z1 > z0 + 0.05 && o.z0 < z1 - 0.05 && !(o.x0 >= s.x0 - 0.01 && o.x1 <= s.x1 + 0.01 && o.z0 >= s.z0 - 0.01 && o.z1 <= s.z1 + 0.01)) libre = false;
        });
        if (!libre) continue;
        at[1] = s.y0 + 1.3; pie[1] = suelo;
        return { pz: pz.id, at, n, pie, hp: pz.hp };
      }
    }
  }
  return null;
}

try {
  await espera(600);
  let a;
  for (let k = 0; k < 20 && !a; k++) { try { a = await cliente('A'); } catch { await espera(300); } }
  a.send({ t: 'create', name: 'Prueba' });
  const bienvenida = await a.proximo((m) => m.t === 'welcome');
  a.send({ t: 'start' });
  const inicio = await a.proximo((m) => m.t === 'matchStart', 8000);
  const world = new World(inicio.room.seed, inicio.room.islandSize);
  const pared = buscarPared(world);
  ok(!!pared, 'hay una pared del mapa con una cara libre para la prueba');
  await a.proximo((m) => m.t === 'phase' && m.phase === 'playing', 20000);
  a.send({ t: 'jump' });
  await espera(100);
  a.send({ t: 'state', p: pared.pie, r: 0, s: 'ground' });
  await espera(100);
  const cola = () => { a.msgs.length = 0; };
  const picar = async (at, n = pared.n) => {
    cola();
    a.send({ t: 'swing', pz: pared.pz, at, n });
    const d = await a.proximo((m) => m.t === 'debil');
    const v = await a.proximo((m) => (m.t === 'pzHp' && m.ids.includes(pared.pz)) || (m.t === 'pzRota' && m.ids.includes(pared.pz)));
    await espera(PICKAXE.cooldown * 800 + 30);
    return { d, hp: v.t === 'pzHp' ? v.hp[v.ids.indexOf(pared.pz)] : 0 };
  };

  // 1. primer golpe: daño normal y aparece el punto débil cerca, sobre la pared
  const g1 = await picar(pared.at);
  ok(!g1.d.crit && g1.hp === pared.hp - PICKAXE.struct, `primer golpe normal: ${pared.hp} → ${g1.hp}`);
  ok(Array.isArray(g1.d.p), 'el primer golpe hace aparecer el punto débil');
  const dd = dist(g1.d.p, pared.at);
  ok(dd >= 0.3 && dd <= PUNTO_DEBIL.dist[1] + 0.05, `el punto débil aparece cerca del golpe (${dd.toFixed(2)} m)`);
  const solidos = world.piezas[pared.pz].solids;
  const sobre = (p) => solidos.some((s) => Math.hypot(Math.max(s.x0 - p[0], 0, p[0] - s.x1), Math.max(s.y0 - p[1], 0, p[1] - s.y1), Math.max(s.z0 - p[2], 0, p[2] - s.z1)) < 0.08);
  ok(sobre(g1.d.p), 'el punto débil queda sobre la misma pared');
  ok(g1.d.n && Math.abs(g1.d.n[0] - pared.n[0]) < 1e-3 && Math.abs(g1.d.n[2] - pared.n[2]) < 1e-3, 'mira para el lado del golpe');

  // 2. golpe en otro lado: normal, el punto débil se queda
  const otro = [pared.at[0], pared.at[1], pared.at[2]];
  const g2 = await picar(otro);
  ok(!g2.d.crit && g2.hp === g1.hp - PICKAXE.struct, `golpe fuera del punto débil: daño normal (${g1.hp} → ${g2.hp})`);
  ok(g2.d.p && dist(g2.d.p, g1.d.p) < 1e-3, 'si no le pegás, el punto débil no se mueve');

  // 3. golpe en el punto débil: crítico, doble daño y se mueve
  const g3 = await picar(g1.d.p);
  ok(g3.d.crit, 'pegarle al punto débil es crítico');
  ok(g3.hp === g2.hp - PICKAXE.struct * PUNTO_DEBIL.mult, `el crítico hace ${PUNTO_DEBIL.mult}x (${g2.hp} → ${g3.hp})`);
  ok(g3.d.p && dist(g3.d.p, g1.d.p) > 0.2 && sobre(g3.d.p), 'después del crítico el punto débil se mueve a otro lugar de la pared');

  // 4. trampa: decir que le pegó al punto débil desde lejos no sirve
  const trampa = await picar([g3.d.p[0] + pared.n[0] * 3, g3.d.p[1], g3.d.p[2] + pared.n[2] * 3]);
  ok(!trampa.d.crit && trampa.hp === g3.hp - PICKAXE.struct, 'un punto de golpe que no está sobre la pared no da crítico');

  // 5. alguien que entra tarde ve la pared dañada
  const b = await cliente('B');
  b.send({ t: 'join', code: bienvenida.room.code, name: 'Tarde' });
  const wb = await b.proximo((m) => m.t === 'welcome');
  const fila = (wb.snap?.pzHp || []).find(([id]) => id === pared.pz);
  ok(fila && fila[1] === trampa.hp, `el que entra tarde recibe la vida de las piezas dañadas (${fila?.[1]})`);
  b.ws.close();

  // 6. a picar hasta romperla: el punto débil se va
  let hp = trampa.hp, ultimo = null, vueltas = 0;
  while (hp > 0 && vueltas++ < 30) { ultimo = await picar(ultimo?.d.p || pared.at); hp = ultimo.hp; }
  ok(hp <= 0 && ultimo && ultimo.d.p === null, `al romperse la pared el punto débil desaparece (${vueltas} golpes más)`);

  // 7. árboles: también tienen punto débil y avisan su vida
  const arbolIdx = world.trees.findIndex((t) => Math.abs(world.terrainHeight(t.x + 1.2, t.z) - t.y) < 0.4 && t.s > 0.8);
  const t = world.trees[arbolIdx];
  a.send({ t: 'state', p: [t.x + 1.2, world.terrainHeight(t.x + 1.2, t.z), t.z], r: 0, s: 'ground' });
  await espera(PICKAXE.cooldown * 800 + 50);
  cola();
  const atT = [t.x + 0.45 * t.s, t.y + 1.2, t.z];
  a.send({ t: 'swing', res: 'tree', idx: arbolIdx, at: atT, n: [1, 0, 0] });
  const dT = await a.proximo((m) => m.t === 'debil');
  ok(dT.hp === 150 - PICKAXE.struct && dT.max === 150 && Array.isArray(dT.p), `árbol: vida ${dT.hp}/${dT.max} y punto débil en el tronco`);
  await espera(PICKAXE.cooldown * 800 + 30);
  cola();
  a.send({ t: 'swing', res: 'tree', idx: arbolIdx, at: dT.p, n: dT.n });
  const dT2 = await a.proximo((m) => m.t === 'debil');
  ok(dT2.crit && dT2.hp === 150 - PICKAXE.struct * (1 + PUNTO_DEBIL.mult), `árbol: crítico en el punto débil (${dT2.hp})`);
  a.ws.close();
} catch (e) {
  fallas++;
  console.log('  MAL', e.message);
}
server.kill();
console.log(fallas ? `${fallas} fallas` : 'todo OK');
process.exit(fallas ? 1 : 0);
