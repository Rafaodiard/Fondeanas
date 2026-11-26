// Pruebas de "el loot no atraviesa paredes" (public/js/lugarLoot.js y lo que usa el servidor), en Node y sin navegador.
// Uso: node tools/loot/pruebas.mjs  → tiene que terminar con "todo OK".
// Revisa los 88 cofres del mapa y los lugares de loot (como si un jugador muriera o soltara algo ahí), ventanas,
// y construcciones de jugadores (cuarto cerrado, pared que se levanta encima de un objeto, piso que se rompe, rampa).
import assert from 'node:assert/strict';
import { World, rng } from '../../public/js/world.js';
import { Solidos } from '../../public/js/colision.js';
import { GRID, structKey } from '../../public/js/items.js';
import { normalizar, superficie } from '../../public/js/construccion.js';
import { repartirLoot, acomodarLoot, pisoLoot, techoLoot, LOOT_RADIO, LOOT_ALTO, R_MAX } from '../../public/js/lugarLoot.js';

let fallas = 0;
function prueba(nombre, fn) {
  try { fn(); console.log('  ok ', nombre); } catch (e) { fallas++; console.log('  MAL', nombre, '\n     ', e.message); }
}

// ¿El camino recto de o (pies en o.y) al objeto pasa por adentro de una pared? Revisión independiente del algoritmo:
// puntos cada 2 cm a la altura del objeto (0,6 / 0,75 / 0,9 m sobre el piso de salida) contra todo lo alto
// (más de 1,2 m por encima: paredes, vidrios, muebles altos, construcciones; no escalones ni mesas).
function atraviesa(world, o, it) {
  const d = Math.hypot(it.x - o.x, it.z - o.z);
  const alto = Math.max(o.y, it.y) + 1.2;
  for (let t = 0.02; t < d; t += 0.02) {
    const x = o.x + ((it.x - o.x) * t) / d, z = o.z + ((it.z - o.z) * t) / d;
    for (const h of [0.6, 0.75, 0.9]) {
      const y = o.y + h;
      let mal = null;
      world.sol.near(x, z, 0, (s) => {
        if (mal || s.dead || y <= s.y0 || y >= Solidos.top(s, x, z)) return;
        if (s.cyl ? Math.hypot(x - s.x, z - s.z) < s.r : x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1) if (Solidos.top(s, x, z) > alto) mal = s.kind;
      });
      for (const st of world.structs.values()) for (const b of st.boxes || []) {
        if (!mal && x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ && y > b.minY && y < b.maxY) mal = `construcción ${st.type}`;
      }
      if (mal) return `${mal} a ${t.toFixed(2)} m`;
    }
  }
  return null;
}

// El objeto quedó apoyado en un piso y sin meterse en nada (otro empujón no lo mueve).
function apoyado(world, it) {
  const q = { x: it.x, y: it.y, z: it.z };
  world.collide(q, LOOT_RADIO - 0.05, LOOT_ALTO);
  if (Math.hypot(q.x - it.x, q.z - it.z) > 0.03) return `metido en algo (empujón de ${Math.hypot(q.x - it.x, q.z - it.z).toFixed(2)} m)`;
  const g = pisoLoot(world, it.x, it.z, it.y + 0.05);
  if (it.y >= 0 && Math.abs(g - it.y) > 0.03) return `flotando o hundido (piso ${g.toFixed(2)}, objeto ${it.y.toFixed(2)})`;
  return null;
}

const world = new World(1, 1200);
const r = rng(7);

// Reparto viejo (antes de este cambio): a 1-1,8 m en cualquier dirección, sin mirar paredes.
function repartoViejo(n, x, y, z) {
  return Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2 + r();
    const d = 1 + r() * 0.8, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    return { x: px, y: Math.max(y, world.groundHeight(px, pz, y + 1)), z: pz };
  });
}

function revisarSalidas(nombre, origenes, n, vueltas) {
  let total = 0, malos = 0, viejos = 0, pegados = 0;
  const ejemplos = [];
  for (const o of origenes) for (let v = 0; v < vueltas; v++) {
    const f0 = pisoLoot(world, o.x, o.z, o.y + 0.3);
    const or = { x: o.x, y: f0, z: o.z };
    for (const it of repartoViejo(n, o.x, o.y, o.z)) if (atraviesa(world, or, it)) viejos++;
    for (const it of repartirLoot(world, n, o.x, o.y, o.z, r)) {
      total++;
      const m = atraviesa(world, or, it) || apoyado(world, it);
      if (m) { malos++; if (ejemplos.length < 8) ejemplos.push(`(${o.x.toFixed(1)}, ${o.y.toFixed(1)}, ${o.z.toFixed(1)}) -> (${it.x}, ${it.y}, ${it.z}): ${m}`); }
      if (Math.hypot(it.x - o.x, it.z - o.z) < 0.3) pegados++;
    }
  }
  console.log(`     ${nombre}: ${total} objetos; con el reparto viejo ${viejos} pasaban una pared; ahora ${malos}; pegados al punto de salida ${pegados}`);
  assert.equal(malos, 0, ejemplos.join('\n      '));
  assert.ok(pegados <= total * 0.05, `demasiados objetos sin lugar (${pegados} de ${total})`);
  return viejos;
}

prueba('cofres del mapa: el loot nunca sale para el otro lado de una pared y queda apoyado', () => {
  const viejos = revisarSalidas('cofres', world.chestSpots, 5, 6);
  assert.ok(viejos > 0, 'la prueba no encontró ningún cofre contra una pared (no estaría probando nada)');
});

prueba('lugares de loot del mapa (como si un jugador muriera o soltara algo ahí): no pasa paredes', () => {
  const lugares = world.lootSpots.filter((_, k) => k % 3 === 0);
  revisarSalidas('lugares de loot', lugares, 8, 2);
});

prueba('ventanas: el loot que se suelta al lado de un vidrio no sale por la ventana', () => {
  const vidrios = world.sol.list.filter((s) => s.vidrio && !s.cyl);
  let probados = 0;
  for (const s of vidrios.filter((_, k) => k % 4 === 0)) {
    const finoX = s.x1 - s.x0 < s.z1 - s.z0;
    const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
    for (const lado of [-1, 1]) {
      const o = finoX ? { x: cx + lado * 0.7, z: cz } : { x: cx, z: cz + lado * 0.7 };
      o.y = world.groundHeight(o.x, o.z, s.y0);
      // hace falta un piso de verdad a la altura de la ventana y lugar para pararse
      if (s.y0 - o.y > 1.6 || s.y0 - o.y < 0.2 || world.sol.ceiling(o.x, o.z, o.y) - o.y < 1.8) continue;
      const q = { ...o }; world.collide(q, 0.45, 1.8);
      if (Math.hypot(q.x - o.x, q.z - o.z) > 0.05) continue;
      probados++;
      for (const it of repartirLoot(world, 8, o.x, o.y, o.z, r)) {
        const enVentana = finoX ? it.z > s.z0 - 0.3 && it.z < s.z1 + 0.3 : it.x > s.x0 - 0.3 && it.x < s.x1 + 0.3;
        const delOtroLado = finoX ? Math.sign(it.x - cx) !== lado : Math.sign(it.z - cz) !== lado;
        assert.ok(!(enVentana && delOtroLado), `salió por la ventana en (${cx.toFixed(1)}, ${s.y0.toFixed(1)}, ${cz.toFixed(1)})`);
        const m = atraviesa(world, o, it);
        assert.equal(m, null, `ventana en (${cx.toFixed(1)}, ${cz.toFixed(1)}): ${m}`);
      }
    }
  }
  console.log(`     ${probados} lados de ventana probados`);
  assert.ok(probados > 20, 'muy pocas ventanas para probar');
});

// ---------- Construcciones de jugadores (en campo abierto) ----------
const campo = new World(1, 1200);
let base = null;
for (let x = -400; x < 400 && !base; x += 8) for (let z = -400; z < 400 && !base; z += 8) {
  const i = Math.floor(x / GRID), j = Math.floor(z / GRID);
  const hs = [];
  for (let a = -1; a <= 3; a++) for (let b = -1; b <= 3; b++) hs.push(campo.terrainHeight((i + a) * GRID, (j + b) * GRID));
  if (Math.min(...hs) < 2 || Math.max(...hs) - Math.min(...hs) > 0.6) continue;
  let libre = true;
  campo.sol.near((i + 1) * GRID, (j + 1) * GRID, GRID * 4, () => { libre = false; });
  for (const c of campo.circles) if (Math.hypot(c.x - (i + 1) * GRID, c.z - (j + 1) * GRID) < GRID * 4) libre = false;
  if (libre) base = { i, j, y: Math.ceil(Math.max(...hs) * 2) / 2 - 0.5 };
}
assert.ok(base, 'no se encontró un lugar plano y libre');
const pieza = (type, di, dj, ny, dir = 0, e = 0) => {
  const s = normalizar({ type, i: base.i + di, j: base.j + dj, y: base.y + ny * GRID, dir, mat: 'madera', e });
  s.key = structKey(s);
  campo.addStruct(s);
  return s;
};
const limpiar = () => { for (const k of [...campo.structs.keys()]) campo.removeStruct(k); };
const X0 = base.i * GRID, Z0 = base.j * GRID;

prueba('cuarto de 4 paredes: el loot de alguien que muere adentro queda adentro', () => {
  limpiar();
  for (let dir = 0; dir < 4; dir++) pieza('pared', 0, 0, 0, dir); // los 4 lados de la celda
  for (const [ox, oz] of [[2, 2], [0.6, 0.6], [3.4, 2], [2, 3.45]]) {
    const x = X0 + ox, z = Z0 + oz, y = campo.terrainHeight(x, z);
    for (let v = 0; v < 10; v++) for (const it of repartirLoot(campo, 12, x, y, z, r)) {
      assert.ok(it.x > X0 + 0.12 && it.x < X0 + GRID - 0.12 && it.z > Z0 + 0.12 && it.z < Z0 + GRID - 0.12, `salió del cuarto: (${it.x}, ${it.z}) desde (${ox}, ${oz})`);
      assert.equal(apoyado(campo, it), null);
    }
  }
});

prueba('pared con hueco de puerta: el loot puede salir por la puerta pero no por la pared', () => {
  limpiar();
  // puerta: se sacan las dos baldosas de abajo del medio (bits 1 y 4: fila 0 y 1, columna 1)
  const p = pieza('pared', 0, 0, 0, 0, (1 << 1) | (1 << 4));
  assert.equal(p.e, (1 << 1) | (1 << 4));
  let salieron = 0;
  for (let v = 0; v < 40; v++) {
    const x = X0 + 2, z = Z0 + 0.7, y = campo.terrainHeight(x, z);
    for (const it of repartirLoot(campo, 8, x, y, z, r)) {
      assert.equal(atraviesa(campo, { x, y, z }, it), null);
      if (it.z < Z0) salieron++; // salió por la puerta (atraviesa() ya revisó que no pasó por la pared)
    }
  }
  assert.ok(salieron > 0, 'ninguno salió por la puerta');
});

prueba('pared nueva encima de un objeto: el objeto sale para su lado', () => {
  limpiar();
  const y = campo.terrainHeight(X0 + 2, Z0);
  const adelante = { x: X0 + 2, y, z: Z0 + 0.08 }, atras = { x: X0 + 2.5, y, z: Z0 - 0.05 };
  pieza('pared', 0, 0, 0, 0);
  const a = acomodarLoot(campo, adelante), b = acomodarLoot(campo, atras);
  assert.ok(a.z >= Z0 + 0.15 + LOOT_RADIO - 0.01, `quedó adentro de la pared: z ${a.z}`);
  assert.ok(b.z <= Z0 - 0.15 - LOOT_RADIO + 0.01, `quedó adentro de la pared: z ${b.z}`);
  assert.equal(apoyado(campo, a), null); assert.equal(apoyado(campo, b), null);
});

prueba('piso nuevo a la altura de un objeto lo sube arriba; piso de arriba que se rompe lo deja caer', () => {
  limpiar();
  const x = X0 + 2, z = Z0 + 2, g = campo.terrainHeight(x, z);
  const s = pieza('piso', 0, 0, 0);
  const top = superficie(s, x, z);
  const it = acomodarLoot(campo, { x, y: g, z });
  if (top > g) assert.ok(Math.abs(it.y - top) < 0.02, `quedó adentro del piso: ${it.y} (piso ${top})`);
  limpiar();
  const alto = pieza('piso', 0, 0, 1);
  pieza('pared', 0, 0, 0, 0); // que tenga apoyo (no importa para la prueba)
  const arriba = { x, y: superficie(alto, x, z), z };
  assert.equal(apoyado(campo, arriba), null);
  campo.removeStruct(alto.key);
  const cae = acomodarLoot(campo, arriba);
  assert.ok(Math.abs(cae.y - g) < 0.05, `no cayó al suelo: ${cae.y} (suelo ${g})`);
});

prueba('rampa: el loot que sale por debajo no se mete en la rampa ni aparece arriba', () => {
  limpiar();
  for (let dir = 0; dir < 4; dir++) {
    limpiar();
    const s = pieza('rampa', 0, 0, 0, dir);
    // sale de abajo de la punta alta: hacia cualquier lado, también hacia donde la rampa baja
    const pts = [[0.5, 2], [3.5, 2], [2, 0.5], [2, 3.5]].map(([a, b]) => ({ x: X0 + a, z: Z0 + b, top: superficie(s, X0 + a, Z0 + b) }));
    const alto = pts.reduce((p, q) => (q.top > p.top ? q : p));
    const y = campo.terrainHeight(alto.x, alto.z);
    for (let v = 0; v < 10; v++) for (const it of repartirLoot(campo, 6, alto.x, y, alto.z, r)) {
      const sup = superficie(s, it.x, it.z);
      assert.ok(it.y < y + 0.6, `apareció arriba de la rampa (dir ${dir}): y ${it.y}`);
      if (sup !== null) assert.ok(sup - 0.3 >= it.y + LOOT_ALTO - 0.15, `metido en la rampa (dir ${dir}): objeto ${it.y}, rampa ${sup.toFixed(2)}`);
    }
  }
});

prueba('techo bajo: el salto del cofre no pasa el techo (techoLoot)', () => {
  limpiar();
  const x = X0 + 2, z = Z0 + 2, g = campo.terrainHeight(x, z);
  assert.equal(techoLoot(campo, x, z, g), Infinity);
  const s = pieza('piso', 0, 0, 1);
  assert.ok(Math.abs(techoLoot(campo, x, z, g) - (superficie(s, x, z) - 0.24)) < 0.01);
});

prueba('agua: lo que suelta alguien nadando queda cerca de la superficie, no en el fondo', () => {
  let hecho = false;
  for (let x = -560; x < 560 && !hecho; x += 13) {
    const z = 0, h = world.terrainHeight(x, z);
    if (h > -4) continue;
    for (const it of repartirLoot(world, 4, x, -1.3, z, r)) assert.ok(it.y >= -1.31 && it.y <= 0, `quedó en ${it.y} (fondo ${h.toFixed(1)})`);
    hecho = true;
  }
  assert.ok(hecho, 'no encontré agua profunda');
});

prueba('reparto: llega hasta 1,8 m en campo abierto y los objetos no se apilan', () => {
  limpiar();
  const x = X0 + 2, z = Z0 + 2, y = campo.terrainHeight(x, z);
  const its = repartirLoot(campo, 6, x, y, z, r);
  for (const it of its) { const d = Math.hypot(it.x - x, it.z - z); assert.ok(d >= 0.99 && d <= R_MAX + 0.01, `distancia ${d}`); }
});

// ---------- Cliente: el salto desde el cofre (loot.js) ----------
const THREE = await import('three');
const { animarLoot } = await import('../../public/js/loot.js');
let reloj = 10000;
Object.defineProperty(performance, 'now', { value: () => reloj, configurable: true });
// Un objeto de mentira con lo que animarLoot toca, y un cofre que se acaba de abrir en c.
function saltar(c, destino) {
  const mesh = new THREE.Object3D();
  mesh.position.copy(destino);
  mesh.userData = { loot: { fase: 0, halo: { material: {} } }, spin: new THREE.Object3D() };
  const cofre = new THREE.Object3D();
  cofre.position.copy(c);
  cofre.userData = { abriendo: reloj };
  const camara = new THREE.Object3D();
  camara.position.copy(destino);
  const items = new Map([[1, { mesh }]]);
  const recorrido = [];
  for (let k = 0; k <= 40; k++) {
    animarLoot(items, [cofre], reloj, camara, campo);
    recorrido.push(mesh.position.clone());
    reloj += 16;
  }
  return recorrido;
}

prueba('salto del cofre: no corta el piso del balcón al caer al suelo ni pasa un techo bajo', () => {
  limpiar();
  // balcón: piso a unos 2 m; el cofre arriba cerca del borde y el destino abajo, en el suelo, afuera del piso
  const g = campo.terrainHeight(X0 + 2, Z0 + 2);
  const balcon = pieza('piso', 0, 0, (Math.floor((g + 2) * 2) / 2 - base.y) / GRID);
  const top = superficie(balcon, X0 + 2, Z0 + 2);
  const c = new THREE.Vector3(X0 + 3.2, top, Z0 + 2), d = new THREE.Vector3(X0 + 5, campo.terrainHeight(X0 + 5, Z0 + 2), Z0 + 2);
  const r1 = saltar(c, d);
  assert.ok(Math.max(...r1.map((p) => p.y)) > top + 0.3, 'no hizo el salto');
  for (const p of r1) {
    if (p.x < X0 + GRID - 0.05) assert.ok(p.y >= top - 0.01, `cortó el piso del balcón: y ${p.y.toFixed(2)} en x ${(p.x - X0).toFixed(2)} (piso ${top})`);
  }
  // techo bajo: cofre en el suelo con un piso construido justo encima (unos 2 m de lugar)
  limpiar();
  const bajo = pieza('piso', 0, 0, (Math.floor((g + 2.3) * 2) / 2 - base.y) / GRID);
  const techo = superficie(bajo, X0 + 2, Z0 + 2) - 0.24;
  assert.ok(techo - g < 2.2, `el techo de la prueba no es bajo (${(techo - g).toFixed(2)} m)`);
  const r2 = saltar(new THREE.Vector3(X0 + 2, g, Z0 + 2), new THREE.Vector3(X0 + 3.4, campo.terrainHeight(X0 + 3.4, Z0 + 2), Z0 + 2));
  const pico = Math.max(...r2.map((p) => p.y));
  assert.ok(pico + LOOT_ALTO <= techo + 0.01, `el salto pasa el techo: ${pico.toFixed(2)} + ${LOOT_ALTO} > ${techo.toFixed(2)}`);
  assert.ok(pico > g + 0.5, 'el salto ni se levanta');
});

console.log(fallas ? `${fallas} fallas` : 'todo OK');
process.exit(fallas ? 1 : 0);
