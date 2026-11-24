// Pruebas automáticas del mapa: colisiones, techos, pisos, escaleras y puertas.
// Uso: node tools/mapa/pruebas.mjs
import { World } from '../../public/js/world.js';
import { Solidos } from '../../public/js/colision.js';
import { PLANOS } from '../../public/js/planos.js';

const G = 25, H = 1.8, R = 0.45;
let fails = 0;
const fail = (m) => { fails++; if (fails < 40) console.log('FALLA:', m); };

// Simulación mínima del jugador (igual que main.js): gravedad, pasos, piso.
function sim(world, p, vel, steps, input = () => null, dt = 1 / 60) {
  let onGround = false;
  for (let k = 0; k < steps; k++) {
    const want = input(k, p, onGround);
    if (want) {
      vel.x += (want.x - vel.x) * Math.min(1, dt * 12); vel.z += (want.z - vel.z) * Math.min(1, dt * 12);
      if (want.jump && onGround) vel.y = 8.5;
    }
    vel.y -= G * dt;
    world.moveBody(p, vel, dt);
    const g = world.groundHeight(p.x, p.z, p.y);
    if (p.y <= g) { p.y = g; if (vel.y < 0) vel.y = 0; onGround = true; }
    else if (p.y - g < 0.3 && vel.y <= 0) { p.y = g; vel.y = 0; onGround = true; }
    else onGround = false;
  }
  return onGround;
}

// ¿La cápsula se mete dentro de algún sólido? (penetración > tolerancia)
function penetra(world, p, tol = 0.12) {
  let bad = null;
  world.sol.near(p.x, p.z, R, (s) => {
    if (bad) return;
    if (p.y + H <= s.y0 + tol || p.y >= Solidos.top(s, p.x, p.z) - tol) {
      if (s.cyl || !(p.x > s.x0 && p.x < s.x1 && p.z > s.z0 && p.z < s.z1)) return;
    }
    if (s.cyl) {
      const d = Math.hypot(p.x - s.x, p.z - s.z);
      if (d < s.r + R - tol && p.y < s.y1 - 0.6 && p.y + H > s.y0 + tol) bad = s;
      return;
    }
    const cx = Math.max(s.x0, Math.min(p.x, s.x1)), cz = Math.max(s.z0, Math.min(p.z, s.z1));
    const d = Math.hypot(p.x - cx, p.z - cz);
    const top = Solidos.topAt(s, cx, cz);
    if (d < R - tol && p.y < top - 0.6 && p.y + H > s.y0 + tol) bad = s;
  });
  return bad;
}

const world = new World(1, 1200);
console.log(`estructuras ${world.placed.length}, sólidos ${world.sol.list.length}, loot ${world.lootSpots.length}, cofres ${world.chestSpots.length}`);

// 1) Caída desde el cielo sobre cada estructura (varios puntos): tiene que quedar parado arriba, nunca adentro de un techo.
let drops = 0;
for (const pl of world.placed) {
  const f = pl.fp;
  for (let k = 0; k < 9; k++) {
    const x = f.x0 + (f.x1 - f.x0) * (0.1 + 0.8 * ((k % 3) / 2)), z = f.z0 + (f.z1 - f.z0) * (0.1 + 0.8 * (Math.floor(k / 3) / 2));
    const p = { x, y: pl.y + 120, z }, v = { x: 0, y: -55, z: 0 };
    sim(world, p, v, 400);
    drops++;
    const s = penetra(world, p);
    if (s) fail(`${pl.name} (${pl.x.toFixed(0)},${pl.z.toFixed(0)}): cae dentro de un sólido en (${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)})`);
    if (p.y < world.terrainHeight(p.x, p.z) - 0.05) fail(`${pl.name}: quedó bajo el terreno`);
  }
}
console.log('caídas', drops);

// 2) Paseos al azar con saltos dentro de cada pueblo: nunca atravesar paredes ni techos.
let rs = 12345; const rnd = () => ((rs = (rs * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
let walks = 0;
for (const t of world.pois) {
  for (let a = 0; a < 25; a++) {
    const x = t.x + (rnd() - 0.5) * t.r * 1.4, z = t.z + (rnd() - 0.5) * t.r * 1.4;
    const p = { x, y: world.groundHeight(x, z, 1e9) + 0.01, z }, v = { x: 0, y: 0, z: 0 };
    if (penetra(world, p)) continue;
    let dir = rnd() * 6.28;
    for (let k = 0; k < 900; k++) {
      if (k % 60 === 0) dir = rnd() * 6.28;
      sim(world, p, v, 1, () => ({ x: Math.cos(dir) * 9.5, z: Math.sin(dir) * 9.5, jump: rnd() < 0.05 }));
      const s = penetra(world, p);
      if (s) { fail(`${t.name}: atraviesa un sólido ${JSON.stringify({ x0: s.x0, x1: s.x1, y0: s.y0, y1: s.y1, z0: s.z0, z1: s.z1, up: s.up, kind: s.kind })} en ${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`); break; }
    }
    walks++;
  }
}
console.log('paseos', walks);

// 3) Puertas al ras: el piso de cada edificio con pisos tiene que coincidir con el terreno junto al frente.
for (const pl of world.placed) {
  if (!['casa', 'edificio', 'local', 'galpon', 'granero', 'cobertizo', 'adobe', 'cabana', 'lodge', 'laboratorio', 'capilla', 'estacion', 'faro'].includes(pl.name)) continue;
  const f = pl.fp;
  for (const [x, z] of [[f.x0 - 1.2, (f.z0 + f.z1) / 2], [f.x1 + 1.2, (f.z0 + f.z1) / 2], [(f.x0 + f.x1) / 2, f.z0 - 1.2], [(f.x0 + f.x1) / 2, f.z1 + 1.2]]) {
    const d = Math.abs(world.terrainHeight(x, z) - pl.y);
    if (d > 0.35) fail(`${pl.name} (${pl.x.toFixed(0)},${pl.z.toFixed(0)}): el terreno junto a la pared está ${d.toFixed(2)} m desnivelado`);
  }
}

// 4) Escaleras: en un edificio de 4 pisos y una casa de 2 se puede subir caminando hasta arriba.
function subir(name, opts, ruta) {
  const P = PLANOS[name](opts);
  const w = { sol: new Solidos(), structs: new Map(), circles: [], terrainHeight: () => 0 };
  w.groundHeight = (x, z, y) => Math.max(0, w.sol.ground(x, z, y));
  w.collide = (p) => w.sol.push(p, R, H);
  w.moveBody = World.prototype.moveBody.bind(w);
  for (const s of P.solids) w.sol.addBox(s);
  for (const c of P.cyls) w.sol.addCyl(c.x, c.z, c.r, c.y0, c.y1);
  const p = { ...ruta[0] }, v = { x: 0, y: 0, z: 0 };
  sim(w, p, v, 30);
  for (const goal of ruta.slice(1)) {
    sim(w, p, v, 240, () => { const dx = goal.x - p.x, dz = goal.z - p.z, d = Math.hypot(dx, dz) || 1; return d < 0.2 ? { x: 0, z: 0 } : { x: (dx / d) * 6, z: (dz / d) * 6 }; });
  }
  return p;
}
{
  // edificio 12x12: escalera en U en el fondo a la derecha. Tramo 1 sube hacia -z en x≈[4.35,5.75].
  const ruta = [{ x: 0, y: 0.06, z: 4 }];
  for (let piso = 0; piso < 4; piso++) {
    const y = piso * 4;
    ruta.push({ x: 5.0, y, z: 2.5 }, { x: 5.0, y, z: -5.2 }, { x: 3.6, y, z: -5.2 }, { x: 3.6, y, z: 2.6 }, { x: 2.0, y, z: 3.0 });
  }
  const p = subir('edificio', { pisos: 4 }, ruta);
  if (p.y < 16) fail(`edificio: no se llega a la terraza por la escalera (y=${p.y.toFixed(2)})`); else console.log('edificio: terraza alcanzada a', p.y.toFixed(2));
}
{
  const p = subir('casa', { pisos: 2 }, [{ x: 0, y: 0.06, z: 3.8 }, { x: 0, y: 0, z: 2.2 }, { x: 3.85, y: 0, z: 2.5 }, { x: 3.85, y: 0, z: -3.7 }, { x: 1.5, y: 0, z: -3.3 }]);
  if (p.y < 3.9) fail(`casa: no se llega al primer piso (y=${p.y.toFixed(2)})`); else console.log('casa: primer piso alcanzado a', p.y.toFixed(2));
}
console.log(fails ? `${fails} fallas` : 'todo OK');
process.exit(fails ? 1 : 0);
