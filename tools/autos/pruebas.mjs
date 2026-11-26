// Pruebas automáticas de los autos: lugares de salida, manejo por las calles, choques, agua, bajarse y la red.
// Uso: node tools/autos/pruebas.mjs
import { World } from '../../public/js/world.js';
import {
  AUTO, nuevoAuto, fisicaAuto, rapidez, avance, aMundo, lugarBajada, asientoLibre, estadoRed, aplicarRed, sueloAuto, rayoAuto,
} from '../../public/js/autos.js';

let fails = 0;
const fail = (m) => { fails++; if (fails < 40) console.log('FALLA:', m); };
const ok = (c, m) => { if (!c) fail(m); };
const world = new World(1, 1200);
const QUIETO = { acel: false, freno: false, izq: false, der: false, mano: false, turbo: false };
const DT = 1 / 60;

// ¿Algún círculo del auto queda metido en algo sólido? (cuánto lo empuja collide)
function metido(a, tol = 0.12) {
  let peor = 0;
  for (const lz of AUTO.CIRCULOS) {
    const [x, z] = aMundo(a, 0, lz);
    const p = { x, y: a.y, z };
    world.collide(p, AUTO.RADIO, 1.5, a);
    peor = Math.max(peor, Math.hypot(p.x - x, p.z - z));
  }
  return peor > tol ? peor : 0;
}
const conAutos = (lista) => { world.dinamicos = lista; };

// ---------- 1. Lugares de salida ----------
ok(world.autoSpawns.length >= 10, `hay ${world.autoSpawns.length} autos en el mapa (se esperaban 10 o más)`);
world.autoSpawns.forEach((sp, i) => {
  const a = nuevoAuto(i, sp);
  conAutos([a]);
  const m = metido(a);
  ok(!m, `el auto ${i} (${sp.x.toFixed(0)}, ${sp.z.toFixed(0)}) sale metido ${m.toFixed(2)} m en algo`);
  ok(world.groundHeight(sp.x, sp.z, sp.y + 0.5, a) > AUTO.AGUA, `el auto ${i} sale en el agua`);
  // quieto, se queda donde está (no se hunde ni sale volando)
  for (let k = 0; k < 120; k++) fisicaAuto(world, a, QUIETO, DT);
  ok(Math.hypot(a.x - sp.x, a.z - sp.z) < 0.3 && Math.abs(a.y - sp.y) < 0.4, `el auto ${i} se mueve solo estacionado (${Math.hypot(a.x - sp.x, a.z - sp.z).toFixed(2)} m)`);
});

// ---------- 2. Manejar desde cada lugar: acelera, no atraviesa nada, no se sale del piso ----------
let maxVel = 0;
world.autoSpawns.forEach((sp, i) => {
  const a = nuevoAuto(i, sp);
  conAutos([a]);
  let peorMetido = 0, debajo = 0;
  for (let k = 0; k < 60 * 6; k++) {
    // acelera y dobla un poco a la mitad para recorrer la calle
    fisicaAuto(world, a, { ...QUIETO, acel: true, der: k > 180 && k < 230 }, DT);
    peorMetido = Math.max(peorMetido, metido(a, 0.25));
    const g = world.groundHeight(a.x, a.z, a.y + 0.6, a);
    if (a.suelo && a.y < g - 0.35) debajo++;
    maxVel = Math.max(maxVel, rapidez(a));
  }
  ok(!peorMetido, `manejando desde el auto ${i} se mete ${peorMetido.toFixed(2)} m en algo`);
  ok(debajo < 3, `manejando desde el auto ${i} queda debajo del piso ${debajo} cuadros`);
  ok(Number.isFinite(a.x + a.y + a.z + a.yaw), `el auto ${i} terminó con números inválidos`);
});
ok(maxVel > 20 && maxVel <= AUTO.MAX + 1, `velocidad máxima ${maxVel.toFixed(1)} m/s (se esperaba 20 a ${AUTO.MAX + 1})`);

// ---------- 3. Contra una pared: frena de golpe y no la atraviesa ----------
{
  // la pieza grande más cercana a un auto, y el auto apuntando a su centro
  const sp = world.autoSpawns[0];
  let mejor = null, md = Infinity;
  for (const p of world.piezas) {
    const b = p.aabb;
    if (!b || b[3] - b[0] < 4 || b[5] - b[2] < 4 || b[4] - b[1] < 2.5) continue;
    const cx = (b[0] + b[3]) / 2, cz = (b[2] + b[5]) / 2, d = Math.hypot(cx - sp.x, cz - sp.z);
    if (d < md && d > 12) { md = d; mejor = { cx, cz, b }; }
  }
  if (!mejor) fail('no se encontró una casa para chocar');
  else {
    const yaw = Math.atan2(-(mejor.cx - sp.x), -(mejor.cz - sp.z));
    const a = nuevoAuto(0, { ...sp, yaw });
    conAutos([a]);
    let golpe = 0;
    const dentro = () => a.x > mejor.b[0] + 0.3 && a.x < mejor.b[3] - 0.3 && a.z > mejor.b[2] + 0.3 && a.z < mejor.b[5] - 0.3;
    let entro = false;
    for (let k = 0; k < 60 * 8; k++) {
      golpe = Math.max(golpe, fisicaAuto(world, a, { ...QUIETO, acel: true, turbo: true }, DT));
      if (dentro() && a.y < mejor.b[4] - 0.5) entro = true;
    }
    ok(!entro, 'el auto atravesó la pared de una casa');
    ok(golpe > 3, `el choque contra la casa no se registró (golpe ${golpe.toFixed(1)})`);
  }
}

// ---------- 4. Agua profunda: no entra ----------
{
  // un punto de la costa: desde el centro hacia afuera hasta el primer lugar hondo
  let p = null;
  for (let ang = 0; ang < Math.PI * 2 && !p; ang += 0.3) {
    for (let r = 100; r < world.size * 0.7; r += 4) {
      const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
      if (world.terrainHeight(x, z) < AUTO.AGUA - 1) {
        const x0 = Math.cos(ang) * (r - 30), z0 = Math.sin(ang) * (r - 30);
        if (world.terrainHeight(x0, z0) > 0.5 && !world.nearSolid?.(x0, z0, 4)) p = { x: x0, z: z0, ang };
        break;
      }
    }
  }
  if (!p) console.log('aviso: no se encontró costa para la prueba del agua');
  else {
    const a = nuevoAuto(0, { x: p.x, z: p.z, y: world.terrainHeight(p.x, p.z), yaw: Math.atan2(-Math.cos(p.ang), -Math.sin(p.ang)), color: '#fff' });
    conAutos([a]);
    let hondo = 0;
    for (let k = 0; k < 60 * 10; k++) {
      fisicaAuto(world, a, { ...QUIETO, acel: true }, DT);
      if (world.terrainHeight(a.x, a.z) < AUTO.AGUA - 0.6) hondo++;
    }
    ok(hondo === 0, `el auto se metió en el agua profunda (${hondo} cuadros)`);
  }
}

// ---------- 5. Dos autos: el que viene choca con el estacionado y no lo atraviesa ----------
{
  const sp = world.autoSpawns[1];
  const b = nuevoAuto(1, sp);
  const [fx, fz] = [-Math.sin(sp.yaw), -Math.cos(sp.yaw)];
  const a = nuevoAuto(0, { ...sp, x: sp.x + fx * 14, z: sp.z + fz * 14, yaw: sp.yaw + Math.PI });
  a.y = world.groundHeight(a.x, a.z, sp.y + 1, a);
  conAutos([a, b]);
  if (metido(a)) console.log('aviso: no hay lugar delante del auto 1 para la prueba de dos autos');
  else {
    let minD = Infinity;
    for (let k = 0; k < 60 * 4; k++) { fisicaAuto(world, a, { ...QUIETO, acel: true }, DT); minD = Math.min(minD, Math.hypot(a.x - b.x, a.z - b.z)); }
    ok(minD > AUTO.LARGO * 0.8, `un auto atravesó a otro (distancia mínima ${minD.toFixed(2)} m)`);
  }
}

// ---------- 6. Pararse arriba, rayos y bajarse ----------
{
  const sp = world.autoSpawns[2];
  const a = nuevoAuto(2, sp);
  conAutos([a]);
  const techo = sueloAuto(a, a.x, a.z, a.y + 3);
  ok(Math.abs(techo - (a.y + AUTO.ALTO)) < 0.05, `el techo del auto está a ${(techo - a.y).toFixed(2)} m (se esperaba ${AUTO.ALTO})`);
  ok(world.groundHeight(a.x, a.z, a.y + 3) >= a.y + AUTO.ALTO - 0.05, 'groundHeight no ve el techo del auto');
  const [fx, fz] = [-Math.sin(a.yaw), -Math.cos(a.yaw)];
  const t = rayoAuto(a, { x: a.x + fx * 10, y: a.y + 0.7, z: a.z + fz * 10 }, { x: -fx, y: 0, z: -fz });
  ok(Math.abs(t - (10 - AUTO.LARGO / 2)) < 0.05, `el rayo a la trompa pega a ${t.toFixed(2)} m`);
  const tv = rayoAuto(a, { x: a.x + fx * 10, y: a.y + 1.45, z: a.z + fz * 10 }, { x: -fx, y: 0, z: -fz }, 30);
  ok(tv > 11, 'las balas no pasan por el parabrisas');
  for (let k = 0; k < 4; k++) {
    const p = lugarBajada(world, a, k);
    const q = { ...p };
    world.collide(q, 0.45, 1.8);
    ok(Math.hypot(q.x - p.x, q.z - p.z) < 0.1, `bajarse del asiento ${k} deja al jugador metido en algo`);
  }
  a.seats = ['a', null, 'b', null];
  ok(asientoLibre(a) === 1 && asientoLibre(a, 1) === 3 && asientoLibre(a, 3) === 1, 'asientoLibre elige mal');
}

// ---------- 7. Red: lo que se manda es lo que se aplica ----------
{
  const a = nuevoAuto(0, world.autoSpawns[0]);
  a.vx = 12.345; a.pitch = 0.1234; a.giro = -0.5; a.frena = true; a.turbando = true;
  const b = nuevoAuto(0, world.autoSpawns[3]);
  ok(aplicarRed(b, JSON.parse(JSON.stringify(estadoRed(a)))), 'aplicarRed rechazó un estado válido');
  ok(Math.abs(b.x - a.x) < 0.01 && Math.abs(b.vx - a.vx) < 0.01 && Math.abs(b.pitch - a.pitch) < 0.001 && b.frena && b.turbando && b.giro === -0.5, 'el estado de red no ida y vuelta');
  ok(!aplicarRed(b, { p: [1, 'x', 2], q: [0, 0, 0] }), 'aplicarRed aceptó basura');
  ok(Math.abs(avance(a)) > 0 || a.vx !== 0, 'avance');
}
conAutos([]);

console.log(fails ? `${fails} fallas` : 'todo OK');
process.exit(fails ? 1 : 0);
