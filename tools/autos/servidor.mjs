// Pruebas de las embestidas contra el servidor de verdad (por WebSocket, sin navegador): el servidor decide con la vida
// de verdad y con la velocidad que conoce del auto si lo que chocó se daña o se rompe, se lo avisa a todos y daña al auto.
// Uso: node tools/autos/servidor.mjs  → tiene que terminar con "todo OK".
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import WebSocket from 'ws';
import { World } from '../../public/js/world.js';
import { impacto } from '../../public/js/autos.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 3000 + Math.floor(Math.random() * 900) + 50;
let fallas = 0;
const ok = (c, m) => { if (c) console.log('  ok ', m); else { fallas++; console.log('  MAL', m); } };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn(process.execPath, ['server.js'], { cwd: RAIZ, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
process.on('exit', () => server.kill());

function cliente(nombre) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${PORT}`);
    const c = { ws, msgs: [], esperando: [] };
    c.send = (m) => ws.send(JSON.stringify(m));
    c.proximo = (f, ms = 3000) => new Promise((res, rej) => {
      const i = c.msgs.findIndex(f);
      if (i >= 0) return res(c.msgs.splice(i, 1)[0]);
      const w = { f, res };
      c.esperando.push(w);
      setTimeout(() => { const k = c.esperando.indexOf(w); if (k >= 0) { c.esperando.splice(k, 1); rej(new Error(`no llegó el mensaje esperado (${nombre})`)); } }, ms);
    });
    // ¿llega un mensaje así en ms? (para comprobar que algo NO pasa)
    c.llega = (f, ms = 450) => c.proximo(f, ms).then((m) => m, () => null);
    ws.on('message', (raw) => {
      const m = JSON.parse(raw);
      const w = c.esperando.find((x) => x.f(m));
      if (w) { c.esperando.splice(c.esperando.indexOf(w), 1); w.res(m); } else c.msgs.push(m);
    });
    ws.on('open', () => resolve(c));
    ws.on('error', reject);
  });
}

try {
  await espera(600);
  let A;
  for (let k = 0; k < 20 && !A; k++) { try { A = await cliente('A'); } catch { await espera(300); } }
  A.send({ t: 'create', name: 'Chofer' });
  const bienvenida = await A.proximo((m) => m.t === 'welcome');
  const yo = bienvenida.id;
  const B = await cliente('B');
  B.send({ t: 'join', code: bienvenida.room.code, name: 'Mira' });
  await B.proximo((m) => m.t === 'welcome');
  A.send({ t: 'start' });
  const inicio = await A.proximo((m) => m.t === 'matchStart', 8000);
  const world = new World(inicio.room.seed, inicio.room.islandSize);
  await A.proximo((m) => m.t === 'phase' && m.phase === 'playing', 20000);

  // subir al auto 0
  const sp = world.autoSpawns[0];
  A.send({ t: 'jump' }); B.send({ t: 'jump' });
  await espera(100);
  A.send({ t: 'state', p: [sp.x + 1.8, sp.y, sp.z], r: 0, s: 'ground' });
  B.send({ t: 'state', p: [sp.x + 300, world.terrainHeight(sp.x + 300, sp.z), sp.z], r: 0, s: 'ground' });
  await espera(100);
  A.send({ t: 'subir', a: 0 });
  const asientos = await A.proximo((m) => m.t === 'autoSeats' && m.a === 0);
  ok(asientos.ctrl === yo, 'el chofer se sube y maneja el auto 0');

  // auto en (x, y, z) yendo a v m/s hacia +x; viaja a saltos para que el servidor no lo tome por teletransporte
  const car = { x: sp.x, y: sp.y, z: sp.z };
  async function auto(x, y, z, v) {
    for (;;) {
      const d = Math.hypot(x - car.x, z - car.z), paso = Math.min(1, 50 / Math.max(d, 1e-6));
      if (d > 6) await espera(1000); // a toda velocidad se recorren ~60 m por segundo
      car.x += (x - car.x) * paso; car.y += (y - car.y) * paso; car.z += (z - car.z) * paso;
      A.send({ t: 'auto', a: 0, p: [car.x, car.y, car.z], q: [-Math.PI / 2, 0, 0], v: [paso < 1 ? 0 : v, 0, 0], g: 0, f: 4 });
      if (paso >= 1) { await espera(80); return; }
    }
  }
  // al lado de una pieza (a 3 m del borde +x de su caja), a v m/s
  const juntoA = (b, v) => auto(b[3] + 3, b[1], (b[2] + b[5]) / 2, v);
  const embestir = (o, v) => A.send({ t: 'embestida', a: 0, o, v });
  const hpDe = (m, id) => m.hp[m.ids.indexOf(id)];

  // piezas cerca del auto, a nivel del piso y con el lado +x libre para el auto
  const cerca = (b) => Math.hypot((b[0] + b[3]) / 2 - sp.x, (b[2] + b[5]) / 2 - sp.z);
  const aPiso = (p) => Math.abs(p.aabb[1] - world.terrainHeight(p.aabb[3] + 3, (p.aabb[2] + p.aabb[5]) / 2)) < 0.6;
  const buscar = (f) => world.piezas.filter((p) => !p.fija && aPiso(p) && f(p)).sort((a, b) => cerca(a.aabb) - cerca(b.aabb))[0];
  const madera = buscar((p) => p.clase === 'madera' && p.hp >= 150 && p.hp <= 230);
  const piedra = buscar((p) => p.clase === 'piedra' && p.hp >= 400);
  ok(madera && piedra, `hay una pieza de madera (${madera?.hp}) y una de piedra (${piedra?.hp}) para chocar`);

  // 1. despacio no le hace nada
  await juntoA(madera.aabb, 4);
  embestir({ pz: madera.id }, 4);
  ok(!(await A.llega((m) => m.t === 'pzHp' && m.ids.includes(madera.id))), `madera a 4 m/s: nada`);

  // 2. trampa: el auto va a 4 m/s pero dice que chocó a 30 → el servidor usa lo que conoce (4 + 3)
  await espera(300);
  embestir({ pz: madera.id }, 30);
  const t1 = await A.proximo((m) => m.t === 'pzHp' && m.ids.includes(madera.id));
  const d1 = impacto('madera', madera.hp, 7).dano;
  ok(Math.abs(hpDe(t1, madera.id) - Math.ceil(madera.hp - d1)) <= 1, `mentir la velocidad no sirve: ${madera.hp} → ${hpDe(t1, madera.id)} (como a 7 m/s)`);

  // 3. a velocidad media la daña sin romperla (y lo ve el otro jugador)
  await espera(300);
  await juntoA(madera.aabb, 10);
  embestir({ pz: madera.id }, 10);
  const t2 = await A.proximo((m) => m.t === 'pzHp' && m.ids.includes(madera.id));
  const vida2 = madera.hp - d1 - impacto('madera', 999, 10).dano;
  ok(Math.abs(hpDe(t2, madera.id) - Math.ceil(vida2)) <= 1, `madera a 10 m/s: la daña (${hpDe(t1, madera.id)} → ${hpDe(t2, madera.id)})`);
  ok(!!(await B.llega((m) => m.t === 'pzHp' && m.ids.includes(madera.id) && hpDe(m, madera.id) === hpDe(t2, madera.id), 1500)), 'el otro jugador recibe la vida nueva (grietas)');

  // 4. dos golpes seguidos a lo mismo (menos de 250 ms): cuenta uno
  embestir({ pz: madera.id }, 10);
  ok(!(await A.llega((m) => m.t === 'pzHp' && m.ids.includes(madera.id), 200)), 'el mismo golpe repetido enseguida no daña dos veces');

  // 5. rápido la rompe, lo ven todos, y el auto se daña
  await espera(300);
  await juntoA(madera.aabb, 25);
  A.msgs.length = 0;
  embestir({ pz: madera.id }, 25);
  const rota = await A.proximo((m) => m.t === 'pzRota' && m.ids.includes(madera.id));
  ok(!!rota, `madera a 25 m/s: se rompe (${rota.ids.length} pieza(s) con las que se cayeron)`);
  ok(!!(await B.llega((m) => m.t === 'pzRota' && m.ids.includes(madera.id), 1500)), 'el otro jugador ve que se rompió');
  const hpAuto = await A.proximo((m) => m.t === 'autoHp' && m.a === 0);
  const danoAuto = impacto('madera', vida2, 25).danoAuto;
  ok(Math.abs(hpAuto.hp - Math.ceil(800 - danoAuto)) <= 1, `el auto se daña según lo que le faltaba romper (800 → ${hpAuto.hp})`);
  // otra pieza de madera sana, de una: el auto se daña más
  const madera2 = buscar((p) => p.id !== madera.id && p.clase === 'madera' && p.hp >= 150 && !rota.ids.includes(p.id));
  await juntoA(madera2.aabb, 25);
  A.msgs.length = 0;
  embestir({ pz: madera2.id }, 25);
  ok(!!(await A.llega((m) => m.t === 'pzRota' && m.ids.includes(madera2.id), 1500)), `otra madera sana (${madera2.hp}) a 25 m/s: se rompe de una`);
  const hpAuto2 = await A.proximo((m) => m.t === 'autoHp' && m.a === 0);
  const d2 = impacto('madera', madera2.hp, 25).danoAuto;
  ok(Math.abs(hpAuto2.hp - Math.ceil(800 - danoAuto - d2)) <= 1 && d2 > 5, `el auto pierde ${d2.toFixed(0)} de vida (${hpAuto.hp} → ${hpAuto2.hp})`);
  // ya rota: otra embestida no hace nada
  await espera(300);
  embestir({ pz: madera.id }, 25);
  ok(!(await A.llega((m) => (m.t === 'pzHp' || m.t === 'pzRota') && m.ids.includes(madera.id))), 'lo que ya se rompió no se vuelve a romper');

  // 6. piedra: a fondo la daña pero no la rompe; el segundo golpe sí
  await juntoA(piedra.aabb, 27);
  embestir({ pz: piedra.id }, 27);
  const p1 = await A.proximo((m) => (m.t === 'pzHp' || m.t === 'pzRota') && m.ids.includes(piedra.id));
  ok(p1.t === 'pzHp', `piedra (${piedra.hp}) a 27 m/s: la daña sin romperla (queda ${p1.hp?.[0]})`);
  await espera(300);
  embestir({ pz: piedra.id }, 27);
  ok(!!(await A.llega((m) => m.t === 'pzRota' && m.ids.includes(piedra.id), 1500)), 'piedra dañada a 27 m/s: ahora se rompe');

  // 7. de lejos no vale
  const lejos = buscar((p) => p.clase === 'madera' && cerca(p.aabb) > 60);
  await espera(300);
  embestir({ pz: lejos.id }, 25);
  ok(!(await A.llega((m) => (m.t === 'pzHp' || m.t === 'pzRota') && m.ids.includes(lejos.id))), 'una embestida contra algo lejos del auto se ignora');

  // 8. el que no maneja no puede embestir con ese auto
  B.send({ t: 'embestida', a: 0, o: { pz: lejos.id }, v: 25 });
  ok(!(await A.llega((m) => (m.t === 'pzHp' || m.t === 'pzRota') && m.ids.includes(lejos.id))), 'el que no maneja el auto no puede embestir con él');

  // 9. árbol a 20 m/s: lo voltea; roca grande a fondo: la daña pero sigue
  const porDist = (list) => list.map((r, idx) => ({ r, idx })).sort((a, b) => Math.hypot(a.r.x - sp.x, a.r.z - sp.z) - Math.hypot(b.r.x - sp.x, b.r.z - sp.z));
  const arbol = porDist(world.trees).find(({ r }) => r.s <= 1.1);
  await auto(arbol.r.x + 3, arbol.r.y, arbol.r.z, 20);
  embestir({ res: 'tree', idx: arbol.idx }, 20);
  ok(!!(await A.llega((m) => m.t === 'resGone' && m.res === 'tree' && m.idx === arbol.idx, 1500)), `árbol (grosor ${arbol.r.s.toFixed(2)}) a 20 m/s: se cae`);
  const roca = porDist(world.rocks).find(({ r }) => r.s >= 1.5);
  await auto(roca.r.x + roca.r.s * 1.1 + 3, roca.r.y, roca.r.z, 27);
  embestir({ res: 'rock', idx: roca.idx }, 27);
  const gr = await A.llega((m) => (m.t === 'resGone' || m.t === 'resHit') && m.res === 'rock' && m.idx === roca.idx, 1500);
  ok(gr?.t === 'resHit', `roca grande (${roca.r.s.toFixed(1)}) a 27 m/s: se daña pero no se rompe`);

  A.ws.close(); B.ws.close();
} catch (e) {
  fallas++;
  console.log('  MAL', e.message);
}
server.kill();
console.log(fallas ? `${fallas} fallas` : 'todo OK');
process.exit(fallas ? 1 : 0);
