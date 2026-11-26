// Pruebas de la construcción (public/js/construccion.js y la parte de world.js que la usa), en Node y sin navegador.
// Uso: node tools/construccion/pruebas.mjs  → tiene que terminar con "todo OK".
import assert from 'node:assert/strict';
import { World } from '../../public/js/world.js';
import { GRID, structKey } from '../../public/js/items.js';
import {
  superficie, cajasPieza, editValida, resultadoEdicion, rayoEdicion, tieneApoyo, sinApoyo, normalizar, vidaDe, HP_INICIAL, OBRA, T3, ALTO_TECHO,
} from '../../public/js/construccion.js';

let fallas = 0;
function prueba(nombre, fn) {
  try { fn(); console.log('  ok ', nombre); } catch (e) { fallas++; console.log('  MAL', nombre, '\n     ', e.message); }
}

const world = new World(1, 1200);
// un lugar plano en campo abierto, lejos de las estructuras del mapa
let base = null;
for (let x = -400; x < 400 && !base; x += 8) for (let z = -400; z < 400 && !base; z += 8) {
  const i = Math.floor(x / GRID), j = Math.floor(z / GRID);
  const hs = [];
  for (let a = -1; a <= 3; a++) for (let b = -1; b <= 3; b++) hs.push(world.terrainHeight((i + a) * GRID, (j + b) * GRID));
  if (Math.min(...hs) < 2 || Math.max(...hs) - Math.min(...hs) > 0.6) continue;
  let libre = true;
  world.sol.near((i + 1) * GRID, (j + 1) * GRID, GRID * 4, () => { libre = false; });
  if (libre) base = { i, j, y: Math.ceil(Math.max(...hs) * 2) / 2 - 0.5 };
}
assert.ok(base, 'no se encontró un lugar plano y libre');
const pieza = (type, di, dj, ny, dir = 0, e = 0) => {
  const s = normalizar({ type, i: base.i + di, j: base.j + dj, y: base.y + ny * GRID, dir, mat: 'madera', e });
  s.key = structKey(s);
  return s;
};
const poner = (s) => { world.addStruct(s); return s; };
const limpiar = () => { for (const k of [...world.structs.keys()]) world.removeStruct(k); };
const x0 = () => base.i * GRID, z0 = () => base.j * GRID;

prueba('ediciones válidas: no se puede sacar todo (salvo el techo, que es levantar esquinas)', () => {
  assert.ok(editValida('pared', 0) && editValida('pared', 0b000_011_011) && !editValida('pared', 511));
  assert.ok(editValida('piso', 7) && !editValida('piso', 15));
  assert.ok(editValida('rampa', 5) && !editValida('rampa', 7));
  assert.ok(editValida('techo', 15) && !editValida('techo', 16) && !editValida('pared', -1) && !editValida('pared', 1.5));
});

prueba('pared con puerta: se pasa por el hueco y choca en el resto', () => {
  // puerta = columna del medio, filas 0 y 1
  const s = pieza('pared', 0, 0, 0, 0, (1 << 1) | (1 << 4));
  const cajas = cajasPieza(s);
  const bloquea = (x, y) => cajas.some((b) => x > b.minX && x < b.maxX && y >= b.minY && y < b.maxY);
  assert.ok(!bloquea(x0() + GRID / 2, base.y + 0.5), 'la puerta está abierta abajo');
  assert.ok(!bloquea(x0() + GRID / 2, base.y + 2.4), 'la puerta llega a 2,67 m');
  assert.ok(bloquea(x0() + GRID / 2, base.y + 3), 'arriba de la puerta hay pared');
  assert.ok(bloquea(x0() + 0.5, base.y + 1) && bloquea(x0() + GRID - 0.5, base.y + 1), 'los costados siguen');
  assert.ok(cajas.length <= 3, `se juntan las columnas iguales (${cajas.length} cajas)`);
  assert.equal(cajasPieza(pieza('pared', 0, 0, 0)).length, 1, 'pared entera = 1 caja');
});

prueba('piso con un cuarto sacado deja caer por el hueco', () => {
  const s = pieza('piso', 0, 0, 1, 0, 1 << 3); // saca el cuarto +x +z
  assert.equal(superficie(s, x0() + 1, z0() + 1), s.y);
  assert.equal(superficie(s, x0() + 3, z0() + 3), null);
  assert.equal(superficie(s, x0() + 5, z0() + 1), null, 'fuera de la celda');
});

prueba('rampa: sube hacia su dirección y los carriles sacados no se pisan', () => {
  const s = pieza('rampa', 0, 0, 0, 0); // sube hacia -Z
  assert.ok(Math.abs(superficie(s, x0() + 2, z0() + GRID - 0.01) - s.y) < 0.02);
  assert.ok(Math.abs(superficie(s, x0() + 2, z0() + 0.01) - (s.y + GRID)) < 0.02);
  const angosta = pieza('rampa', 0, 0, 0, 1, 0b110); // sube hacia +X, queda solo el carril 0 (z bajo)
  assert.ok(superficie(angosta, x0() + 2, z0() + 0.5) !== null);
  assert.equal(superficie(angosta, x0() + 2, z0() + 3.5), null);
});

prueba('techo: punta arriba, esquinas abajo; con las 4 esquinas levantadas es plano', () => {
  const s = pieza('techo', 0, 0, 0);
  assert.ok(Math.abs(superficie(s, x0() + 2, z0() + 2) - (s.y + ALTO_TECHO)) < 1e-6);
  assert.ok(superficie(s, x0() + 0.01, z0() + 0.01) - s.y < 0.02);
  const plano = pieza('techo', 0, 0, 0, 0, 15);
  for (const [x, z] of [[0.3, 0.3], [3.7, 0.5], [2, 3.9], [1, 2]]) assert.ok(Math.abs(superficie(plano, x0() + x, z0() + z) - (s.y + ALTO_TECHO)) < 1e-6);
  assert.equal(cajasPieza(plano).length, 4, 'techo plano: los 4 bordes frenan de costado');
});

prueba('resultado de editar la rampa: la dirección sale del arrastre y el ancho de lo marcado', () => {
  const s = pieza('rampa', 0, 0, 0, 0);
  // fila de abajo (z alto) hacia arriba (z bajo) por la columna 0 → sube hacia -Z, solo carril 0
  assert.deepEqual(resultadoEdicion(s, (1 << 6) | (1 << 3) | 1, [6, 3, 0]), { e: 0b110, dir: 0 });
  // las 9 de izquierda a derecha → sube hacia +X, ancho completo
  assert.deepEqual(resultadoEdicion(s, 511, [0, 3, 6, 1, 4, 7, 2, 5, 8]), { e: 0, dir: 1 });
  // sin marcas no cambia
  assert.deepEqual(resultadoEdicion({ ...s, e: 2 }, 0, []), { e: 2, dir: 0 });
  assert.equal(resultadoEdicion(pieza('pared', 0, 0, 0), 511, []), null, 'pared sin nada: no vale');
});

prueba('rayo de edición: da la baldosa que se mira', () => {
  const s = pieza('pared', 0, 0, 0, 0);
  const o = { x: x0() + T3 * 2.5, y: base.y + T3 * 0.5, z: z0() + 5 };
  const h = rayoEdicion(s, o, { x: 0, y: 0, z: -1 });
  assert.equal(h.k, 2); assert.ok(Math.abs(h.dist - 5) < 1e-6);
  const r = pieza('rampa', 0, 0, 0, 0);
  const hr = rayoEdicion(r, { x: x0() + 0.5, y: base.y + 10, z: z0() + 3.5 }, { x: 0, y: -1, z: 0 });
  assert.equal(hr.k, 2 * 3 + 0);
  assert.ok(Math.abs(base.y + 10 - hr.dist - superficie(r, x0() + 0.5, z0() + 3.5)) < 1e-6, 'pega en la superficie inclinada');
});

prueba('apoyo: en el piso sí, en el aire no, pegado a otra pieza sí', () => {
  limpiar();
  assert.ok(tieneApoyo(world, pieza('pared', 0, 0, 0)), 'pared en el piso');
  assert.ok(!tieneApoyo(world, pieza('piso', 0, 0, 2)), 'piso flotando');
  poner(pieza('pared', 0, 0, 0)); poner(pieza('pared', 0, 0, 1));
  assert.ok(tieneApoyo(world, pieza('piso', 0, 0, 2)), 'piso arriba de dos paredes');
  assert.ok(tieneApoyo(world, pieza('rampa', 0, -1, 1)), 'rampa que toca la pared');
});

prueba('derrumbe: al romper la base se cae lo que no llega al piso', () => {
  limpiar();
  const p0 = poner(pieza('pared', 0, 0, 0)), p1 = poner(pieza('pared', 0, 0, 1)), techo = poner(pieza('piso', 0, 0, 2));
  const lejos = poner(pieza('pared', 3, 3, 0));
  assert.deepEqual(sinApoyo(world), []);
  world.removeStruct(p0.key);
  assert.deepEqual(sinApoyo(world).sort(), [p1.key, techo.key].sort());
  assert.ok(world.structs.has(lejos.key));
});

prueba('subir por rampas seguidas: la de adelante empieza donde termina la anterior y caminando se sube', () => {
  limpiar();
  const r0 = poner(pieza('rampa', 0, 0, 0, 0)), r1 = poner(pieza('rampa', 0, -1, 1, 0));
  const pos = { x: x0() + 2, y: base.y, z: z0() + GRID - 0.3 };
  const vel = { x: 0, y: 0, z: -6 };
  let max = -Infinity;
  for (let k = 0; k < 80; k++) { vel.y -= 25 / 60; world.moveBody(pos, vel, 1 / 60); const g = world.groundHeight(pos.x, pos.z, pos.y); if (pos.y <= g) { pos.y = g; vel.y = 0; } max = Math.max(max, pos.y); }
  assert.ok(max > r1.y + GRID - 0.3, `subió por las dos rampas (llegó a ${(max - base.y).toFixed(2)} m de 8)`);
  assert.ok(r0 && r1);
});

prueba('pared: no se atraviesa caminando; con la puerta editada sí', () => {
  limpiar();
  const s = poner(pieza('pared', 0, 1, 0, 0)); // borde z = z0 + GRID
  const cruzar = () => {
    const pos = { x: x0() + 2, y: base.y, z: z0() + 2 }, vel = { x: 0, y: 0, z: 6 };
    for (let k = 0; k < 90; k++) { world.moveBody(pos, vel, 1 / 60); vel.z = 6; }
    return pos.z;
  };
  assert.ok(cruzar() < z0() + GRID, 'la pared frena');
  world.editStruct(s.key, (1 << 1) | (1 << 4));
  assert.ok(cruzar() > z0() + GRID + 1, 'por la puerta se pasa');
});

prueba('piso de construcción hace de techo: saltando abajo no se lo atraviesa', () => {
  limpiar();
  // un piso a 2,2 m del suelo (más bajo que lo que se salta)
  const suelo = world.terrainHeight(x0() + GRID + 2, z0() + 2);
  const bajo = poner({ ...pieza('piso', 1, 0, 0), y: suelo + 2.2, key: 'piso-bajo' });
  const pos = { x: x0() + GRID + 2, y: suelo, z: z0() + 2 }, vel = { x: 0, y: 9, z: 0 };
  let max = 0;
  for (let k = 0; k < 60; k++) { vel.y -= 25 / 60; world.moveBody(pos, vel, 1 / 60); const g = world.groundHeight(pos.x, pos.z, pos.y); if (pos.y <= g) { pos.y = g; vel.y = 0; } max = Math.max(max, pos.y); }
  assert.ok(max + 1.8 <= bajo.y - 0.2, `la cabeza llegó a ${(max + 1.8 - suelo).toFixed(2)} m y el piso está a 2,2 m`);
});

prueba('la vida crece mientras se levanta y el daño se descuenta', () => {
  const s = { mat: 'piedra', born: 0, dano: 0 };
  assert.equal(vidaDe(s, 0), 300 * HP_INICIAL);
  assert.equal(vidaDe(s, OBRA.piedra * 1000), 300);
  s.dano = 50;
  assert.equal(vidaDe(s, OBRA.piedra * 2000), 250);
});

limpiar();
console.log(fallas ? `${fallas} pruebas fallaron` : 'todo OK');
process.exit(fallas ? 1 : 0);
