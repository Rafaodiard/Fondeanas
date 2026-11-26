// Pruebas de las embestidas: los autos rompen o no lo que chocan según la velocidad (autos.js: EMBESTIDA, impacto,
// fisicaAuto con emb). Sin servidor: la tabla y la física compartida (la misma que corre el que maneja).
// Uso: node tools/autos/embestidas.mjs  → tiene que terminar con "todo OK".
import { World } from '../../public/js/world.js';
import { AUTO, EMBESTIDA, nuevoAuto, fisicaAuto, impacto, materialChoque, rapidez, aMundo } from '../../public/js/autos.js';
import { MATERIALS } from '../../public/js/items.js';

let fallas = 0;
const ok = (c, m) => { if (c) console.log('  ok ', m); else { fallas++; console.log('  MAL', m); } };
const DT = 1 / 60;
const QUIETO = { acel: false, freno: false, izq: false, der: false, mano: false, turbo: false };
const kmh = (v) => `${(v * 3.6).toFixed(0)} km/h`;

// ---------- 1. La tabla: a qué velocidad se rompe cada cosa (con la vida llena) ----------
console.log('1. tabla de materiales');
const rompeDesde = (mat, hp, esc = 1) => { for (let v = 0; v <= 60; v += 0.05) if (impacto(mat, hp, v, esc).rompe) return v; return Infinity; };
const vMad = rompeDesde('madera', MATERIALS.madera.hp), vPie = rompeDesde('piedra', MATERIALS.piedra.hp), vMet = rompeDesde('metal', MATERIALS.metal.hp);
const vArb = rompeDesde('arbol', 150), vArbGordo = rompeDesde('arbol', 150, 1.5), vRoca = rompeDesde('roca', 150 + 0.6 * 120);
console.log(`     madera ${kmh(vMad)} · piedra ${kmh(vPie)} · metal ${kmh(vMet)} · árbol ${kmh(vArb)} (grueso ${kmh(vArbGordo)}) · roca chica ${kmh(vRoca)}`);
ok(impacto('madera', 150, 4).dano === 0 && impacto('piedra', 300, 7).dano === 0 && impacto('metal', 450, 11).dano === 0, 'a poca velocidad el auto no daña nada (solo rebota)');
ok(vMad > 8 && vMad < 16, `la madera se rompe a velocidad media (${kmh(vMad)})`);
ok(vPie > 20 && vPie <= AUTO.MAX, `la piedra se rompe recién casi a fondo (${kmh(vPie)}, máxima ${kmh(AUTO.MAX)})`);
ok(vMet > AUTO.MAX && vMet <= AUTO.TURBO_MAX, `el metal se rompe solo con turbo (${kmh(vMet)}, turbo ${kmh(AUTO.TURBO_MAX)})`);
ok(vArb < vArbGordo && vArb > 10 && vArb < AUTO.MAX, `los árboles gruesos aguantan más (${kmh(vArb)} contra ${kmh(vArbGordo)})`);
ok(vRoca > AUTO.MAX, `las rocas frenan al auto aunque vaya a fondo sin turbo (la más chica se rompe a ${kmh(vRoca)})`);
ok(rompeDesde('piedra', 100) < vPie, 'lo que ya está dañado se rompe más despacio');
{
  const a = impacto('madera', 150, 27), b = impacto('piedra', 300, 27), c = impacto('madera', 45, 27);
  ok(a.rompe && a.sale < 27 && a.sale > 15, `atravesar una pared de madera a ${kmh(27)} frena el auto a ${kmh(a.sale)}`);
  ok(b.rompe && b.sale < a.sale, `atravesar piedra frena más (${kmh(b.sale)}) que madera (${kmh(a.sale)})`);
  ok(c.rompe && c.sale > a.sale, `una valla de madera (45) casi no frena (${kmh(c.sale)})`);
  ok(b.danoAuto > a.danoAuto && a.danoAuto > 0, `el auto se daña según lo que rompe (madera ${a.danoAuto.toFixed(0)}, piedra ${b.danoAuto.toFixed(0)})`);
}
ok(Object.keys(MATERIALS).every((m) => EMBESTIDA[m]), 'hay fila en la tabla para todos los materiales de construcción');

// ---------- 2. Física: el auto contra una pared, un árbol y una roca puestos en un lugar abierto ----------
console.log('2. física del auto');
const world = new World(1, 1200);
// lugar llano y libre de 50 m hacia +x
function lugarAbierto() {
  for (let x = -500; x < 450; x += 7) for (let z = -500; z < 500; z += 7) {
    const h = world.terrainHeight(x, z);
    if (h < 3 || h > 60) continue;
    let llano = true;
    for (let d = -5; d <= 50 && llano; d += 2.5) for (const dz of [-3, 0, 3]) if (Math.abs(world.terrainHeight(x + d, z + dz) - h) > 0.25) llano = false;
    if (!llano || [0, 10, 20, 30, 40].some((d) => world.nearSolid(x + d, z, 7))) continue;
    if (world.circles.some((c) => c.top > h && Math.abs(c.z - z) < c.r + 5 && c.x > x - 8 - c.r && c.x < x + 45 + c.r)) continue;
    if (world.autoSpawns.some((s) => Math.hypot(s.x - x, s.z - z) < 60)) continue;
    return { x, z, y: h };
  }
  return null;
}
const L = lugarAbierto();
ok(!!L, 'hay un lugar abierto para probar');
if (L) {
  const X = L.x + 15; // donde está lo que se choca
  const YAW = -Math.PI / 2; // el auto mira a +x
  // pieza de prueba (pared delgada en x) con su sólido
  function ponerPared(clase, hp) {
    const id = world.piezas.length;
    const aabb = [X - 0.15, L.y, L.z - 3, X + 0.15, L.y + 3, L.z + 3];
    const p = { id, placed: -1, i: 0, fija: false, clase, color: '#fff', hp, solids: [], rota: false, aabb };
    world.piezas.push(p);
    const s = world.sol.addBox({ x0: aabb[0], x1: aabb[3], y0: aabb[1], y1: aabb[4], z0: aabb[2], z1: aabb[5] }, 'prueba');
    s.pz = id; p.solids.push(s);
    return { o: { pz: id }, quitar: () => world.sol.remove(s) };
  }
  function ponerCirculo(res, s) {
    const list = res === 'tree' ? world.trees : world.rocks, idx = list.length;
    const r = res === 'tree' ? 0.45 * s : s * 1.1;
    const c = { x: X + r, z: L.z, r, bottom: L.y - 1, top: L.y + 7, res, idx };
    list.push({ x: c.x, z: c.z, y: L.y, s, alive: true, circle: c });
    world.circles.push(c);
    return { o: { res, idx }, quitar: () => { list[idx].alive = false; c.top = -1e9; } };
  }
  // corre el auto a v contra la cosa (vida hp) y cuenta qué pasó
  function embestir(cosa, v, hp, { conEmb = true, acel = true, turbo = false } = {}) {
    const a = nuevoAuto(0, { x: L.x, y: L.y, z: L.z, yaw: YAW, color: '#fff' });
    a.vx = v; a.vz = 0;
    world.dinamicos = [a];
    const emb = conEmb ? { vida: () => hp } : null;
    let golpes = [], antes = null, vMin = Infinity, pasado = false, vPaso = null;
    for (let k = 0; k < 60 * 2.5; k++) {
      const va = rapidez(a);
      fisicaAuto(world, a, { ...QUIETO, acel, turbo }, DT, emb);
      if (a.embestidas?.length) { if (!golpes.length) antes = va; golpes.push(...a.embestidas.splice(0)); }
      vMin = Math.min(vMin, rapidez(a));
      const [tx] = aMundo(a, 0, AUTO.LARGO / 2); // la cola
      if (tx > X + 0.5 && !pasado) { pasado = true; vPaso = rapidez(a); }
    }
    world.dinamicos = [];
    const r = { golpes, pasado, antes, vMin, vPaso, a, frente: aMundo(a, 0, -AUTO.LARGO / 2)[0] };
    return r;
  }
  const pasar = (n, v, cosa, hp, opts) => { const r = embestir(cosa, v, hp, opts); return r; };

  {
    const p = ponerPared('madera', 150);
    const lento = pasar('lento', 4, p, 150, { acel: false });
    ok(!lento.pasado && !lento.golpes.length && lento.frente < X, `madera a ${kmh(4)}: rebota, no la daña ni la atraviesa`);
    const medio = pasar('medio', 12, p, 150, { acel: false });
    const gm = medio.golpes[0];
    ok(!medio.pasado && medio.golpes.length === 1 && !gm.rompe && gm.o.pz === p.o.pz, `madera a ${kmh(gm?.v || 0)}: la daña una sola vez pero no la rompe (rebota)`);
    const rapido = pasar('rápido', 24, p, 150);
    rapido.golpes = rapido.golpes.filter((x) => x.o.pz === p.o.pz); // más allá puede haber algo del mapa
    const g = rapido.golpes[0];
    ok(rapido.pasado && g?.rompe && g.v > 20, `madera a ${kmh(24)}: la rompe y sigue de largo (golpe a ${kmh(g?.v || 0)})`);
    ok(rapido.vPaso < rapido.antes - 2 && rapido.vPaso > rapido.antes * 0.6, `al romperla el auto pierde algo de velocidad (${kmh(rapido.antes)} → ${kmh(rapido.vPaso)})`);
    ok(rapido.golpes.length === 1, `una sola embestida por pared aunque la toquen los cinco círculos del auto (${rapido.golpes.length})`);
    const sin = pasar('sin emb', 24, p, 150, { conEmb: false });
    ok(!sin.pasado && !sin.a.embestidas, 'sin emb (servidor, pruebas viejas) el auto choca como antes y no anota golpes');
    const dañada = pasar('dañada', 11, p, 30, { acel: false });
    ok(dañada.pasado && dañada.golpes[0]?.rompe, `madera casi rota (30 de vida) a ${kmh(11)}: se rompe`);
    p.quitar();
  }
  {
    const p = ponerPared('piedra', 300);
    const r = pasar('piedra', 20, p, 300);
    ok(!r.pasado && r.golpes.length >= 1 && !r.golpes[0].rompe, `piedra a ${kmh(20)}: la daña pero frena al auto`);
    const r2 = pasar('piedra fuerte', 34, p, 300, { turbo: true });
    ok(r2.pasado && r2.golpes[0]?.rompe, `piedra a ${kmh(34)} con turbo: la rompe`);
    p.quitar();
  }
  {
    const p = ponerPared('metal', 450);
    const r = pasar('metal', 27, p, 450);
    ok(!r.pasado, `metal a ${kmh(27)}: no la atraviesa`);
    p.quitar();
  }
  {
    // lo fijo (postes, torres) no se rompe nunca
    const p = ponerPared('madera', 150);
    world.piezas[p.o.pz].fija = true;
    const r = pasar('fija', 30, p, 150);
    ok(!r.pasado && !r.golpes.length, 'lo fijo del mapa frena al auto y no se daña');
    p.quitar();
  }
  {
    const t = ponerCirculo('tree', 1);
    const r = pasar('árbol', 24, t, 150);
    ok(r.pasado && r.golpes[0]?.rompe && r.golpes[0].o.res === 'tree', `árbol a ${kmh(24)}: lo voltea y sigue`);
    const r2 = pasar('árbol lento', 7, t, 150, { acel: false });
    ok(!r2.pasado, `árbol a ${kmh(7)}: frena`);
    t.quitar();
  }
  {
    const k = ponerCirculo('rock', 2);
    const r = pasar('roca', 27, k, 390);
    ok(!r.pasado && r.golpes.length && !r.golpes[0].rompe && r.vMin < 3, `roca grande a ${kmh(27)}: frena en seco (queda a ${kmh(r.vMin)}) y la daña un poco`);
    k.quitar();
  }
  {
    // construcción de un jugador (pared de madera recién hecha, vida llena)
    const i = Math.floor(X / 4), j = Math.floor(L.z / 4);
    const s = { key: 'prueba1', type: 'pared', i, j, y: L.y, dir: 1, mat: 'madera', e: 0 };
    world.addStruct(s);
    const box = world.structs.get('prueba1').boxes[0];
    ok(!!box && materialChoque(world, { key: 'prueba1' })?.mat === 'madera', 'las construcciones se reconocen por su material');
    const r = pasar('construcción', 24, { o: { key: 'prueba1' } }, 150);
    ok(r.golpes.some((g) => g.o.key === 'prueba1' && g.rompe), `pared de madera construida a ${kmh(24)}: la rompe`);
    world.removeStruct('prueba1');
  }
}

console.log(fallas ? `${fallas} fallas` : 'todo OK');
process.exit(fallas ? 1 : 0);
