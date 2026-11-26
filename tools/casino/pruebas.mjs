// Pruebas de las reglas del casino (public/js/casino/): pagos, casos borde y retorno con un millón de jugadas.
// Uso: node tools/casino/pruebas.mjs  → tiene que terminar con "todo OK". RAPIDO=1 simula 10 veces menos.
import assert from 'node:assert/strict';
import * as R from '../../public/js/casino/ruleta.js';
import * as S from '../../public/js/casino/slots.js';
import * as BJ from '../../public/js/casino/blackjack.js';

const N = process.env.RAPIDO ? 100_000 : 1_000_000;
let fallas = 0;
function prueba(nombre, fn) {
  const t = Date.now();
  try { fn(); console.log('  ok ', nombre, `(${((Date.now() - t) / 1000).toFixed(1)} s)`); } catch (e) { fallas++; console.log('  MAL', nombre, '\n     ', e.message); }
}
// azar con semilla (mulberry32), para que las simulaciones sean repetibles
function semilla(s) {
  return (n) => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
  };
}
function estadoCon(cartas, apuesta = 100) {
  // zapato con esas cartas primero (P, D, P, D, y las que siguen) y muchas más atrás para que no se mezcle
  const z = [...cartas, ...Array.from({ length: 300 }, (_, i) => i % 52)];
  return BJ.repartir({ zapato: z, pos: 0, fase: 'terminada' }, apuesta, () => 0);
}
const C = (r, p = 0) => p * 13 + BJ.RANGOS.indexOf(r); // carta por rango ('A', '2'... 'K')

// ---------- Ruleta ----------
prueba('ruleta: 37 casilleros en la rueda, 18 rojos y 18 negros', () => {
  assert.equal(R.RUEDA.length, 37);
  assert.deepEqual([...R.RUEDA].sort((a, b) => a - b), Array.from({ length: 37 }, (_, i) => i));
  assert.equal(R.ROJOS.size, 18);
  // en la rueda europea los colores se alternan (salvo el 0)
  for (let i = 1; i < 36; i++) assert.notEqual(R.colorDe(R.RUEDA[i]), R.colorDe(R.RUEDA[i + 1]), `${R.RUEDA[i]} y ${R.RUEDA[i + 1]}`);
});
prueba('ruleta: cada tipo de apuesta devuelve exactamente 36/37', () => {
  const apuestas = [{ tipo: 'numero', n: 17 }, { tipo: 'numero', n: 0 }, { tipo: 'rojo' }, { tipo: 'negro' }, { tipo: 'par' }, { tipo: 'impar' },
    { tipo: 'bajo' }, { tipo: 'alto' }, ...[1, 2, 3].flatMap((n) => [{ tipo: 'docena', n }, { tipo: 'columna', n }])];
  for (const a of apuestas) {
    let r = 0;
    for (let n = 0; n <= 36; n++) r += R.liquidar([{ ...a, monto: 1 }], n).premio;
    assert.equal(r, 36, R.claveApuesta(a));
  }
});
prueba('ruleta: el 0 hace perder todas las apuestas externas', () => {
  const ext = ['rojo', 'negro', 'par', 'impar', 'bajo', 'alto'].map((tipo) => ({ tipo, monto: 10 }));
  assert.equal(R.liquidar(ext, 0).premio, 0);
  assert.equal(R.liquidar([{ tipo: 'docena', n: 1, monto: 10 }, { tipo: 'columna', n: 1, monto: 10 }], 0).premio, 0);
});
prueba('ruleta: validación de apuestas', () => {
  assert.ok(R.validarApuestas([]).error);
  assert.ok(R.validarApuestas([{ tipo: 'rojo', monto: 5 }]).error, 'menos del mínimo');
  assert.ok(R.validarApuestas([{ tipo: 'rojo', monto: 300 }, { tipo: 'negro', monto: 300 }]).error, 'más del máximo');
  assert.ok(R.validarApuestas([{ tipo: 'numero', n: 37, monto: 10 }]).error);
  assert.ok(R.validarApuestas([{ tipo: 'docena', n: 0, monto: 10 }]).error);
  assert.ok(R.validarApuestas([{ tipo: 'rojo', monto: 10.5 }]).error);
  assert.ok(R.validarApuestas([{ tipo: 'trampa', monto: 10 }]).error);
  assert.ok(R.validarApuestas([{ tipo: 'rojo', monto: -50 }, { tipo: 'negro', monto: 100 }]).error, 'monto negativo');
  const v = R.validarApuestas([{ tipo: 'rojo', monto: 5 }, { tipo: 'rojo', monto: 5 }, { tipo: 'numero', n: 3, monto: 1, extra: 'x' }]);
  assert.deepEqual(v, { apuestas: [{ tipo: 'rojo', monto: 10 }, { tipo: 'numero', n: 3, monto: 1 }], total: 11 });
});
prueba(`ruleta: retorno simulado con ${N.toLocaleString('es')} tiradas ≈ 97,3 %`, () => {
  const az = semilla(7);
  const ap = [{ tipo: 'numero', n: 7, monto: 10 }, { tipo: 'rojo', monto: 20 }, { tipo: 'docena', n: 2, monto: 20 }, { tipo: 'columna', n: 3, monto: 10 }];
  let puesto = 0, vuelto = 0;
  for (let i = 0; i < N; i++) { const r = R.tirar(ap, az); puesto += 60; vuelto += r.premio; }
  const rtp = vuelto / puesto;
  assert.ok(Math.abs(rtp - 36 / 37) < (process.env.RAPIDO ? 0.02 : 0.007), `retorno ${(rtp * 100).toFixed(2)} %`);
  console.log(`       retorno ${(rtp * 100).toFixed(2)} % (teórico ${(3600 / 37).toFixed(2)} %)`);
});

// ---------- Tragamonedas ----------
prueba('tragamonedas: la tira tiene cada símbolo según su peso', () => {
  for (const k of S.ORDEN) assert.equal(S.TIRA.filter((s) => s === k).length, S.SIMBOLOS[k].peso, k);
});
prueba('tragamonedas: pagos de cada combinación', () => {
  assert.equal(S.multiplicador(['bus', 'bus', 'bus']), 500);
  assert.equal(S.multiplicador(['cofre', 'cofre', 'cofre']), 50);
  assert.equal(S.multiplicador(['cofre', 'pico', 'cofre']), 5);
  assert.equal(S.multiplicador(['pico', 'escudo', 'cofre']), 1);
  assert.equal(S.multiplicador(['pico', 'pico', 'escudo']), 0);
  assert.throws(() => S.girar(5, () => 0));
  assert.throws(() => S.girar(501, () => 0));
});
prueba('tragamonedas: retorno exacto entre 94 % y 96 %', () => {
  const r = S.retornoTeorico();
  assert.ok(r > 0.94 && r < 0.96, `retorno ${(r * 100).toFixed(2)} %`);
  console.log(`       retorno exacto ${(r * 100).toFixed(2)} %`);
});
prueba(`tragamonedas: retorno simulado con ${N.toLocaleString('es')} tiradas coincide con el exacto`, () => {
  const az = semilla(11);
  let vuelto = 0, pagos = 0;
  for (let i = 0; i < N; i++) { const g = S.girar(10, az); vuelto += g.premio; if (g.premio) pagos++; }
  const rtp = vuelto / (N * 10);
  // el bus (×500) mete mucha varianza: margen más ancho que en la ruleta
  assert.ok(Math.abs(rtp - S.retornoTeorico()) < (process.env.RAPIDO ? 0.05 : 0.02), `retorno ${(rtp * 100).toFixed(2)} %`);
  console.log(`       retorno ${(rtp * 100).toFixed(2)} %, paga en el ${((pagos / N) * 100).toFixed(1)} % de las tiradas`);
});

// ---------- Blackjack ----------
prueba('blackjack: valor de las manos (ases blandos)', () => {
  assert.deepEqual(BJ.valor([C('A'), C('K')]), { total: 21, blanda: true });
  assert.deepEqual(BJ.valor([C('A'), C('A'), C('9')]), { total: 21, blanda: true });
  assert.deepEqual(BJ.valor([C('A'), C('6'), C('9')]), { total: 16, blanda: false });
  assert.deepEqual(BJ.valor([C('K'), C('Q'), C('2')]), { total: 22, blanda: false });
});
prueba('blackjack natural paga 3 a 2 sin que juegue nadie más', () => {
  const e = estadoCon([C('A'), C('9'), C('K'), C('7')]);
  assert.equal(e.fase, 'terminada');
  assert.equal(e.manos[0].resultado, 'blackjack');
  assert.equal(e.premio, 250);
});
prueba('blackjack contra blackjack es empate; el crupier con blackjack gana enseguida', () => {
  assert.equal(estadoCon([C('A'), C('A', 1), C('K'), C('Q')]).manos[0].resultado, 'empate');
  const e = estadoCon([C('9'), C('A'), C('9', 1), C('K')]);
  assert.equal(e.fase, 'terminada'); assert.equal(e.manos[0].resultado, 'pierde'); assert.equal(e.premio, 0);
});
prueba('blackjack: el crupier se planta en 17 blando', () => {
  const e = estadoCon([C('10'), C('A'), C('9'), C('6'), C('5')]);
  BJ.jugar(e, 'plantarse', () => 0);
  assert.equal(e.crupier.length, 2); // A+6 = 17 blando: no pide
  assert.equal(e.manos[0].resultado, 'gana'); assert.equal(e.premio, 200);
});
prueba('blackjack: pasarse pierde aunque el crupier también se pase', () => {
  const e = estadoCon([C('10'), C('6'), C('6'), C('10'), C('K'), C('9')]);
  BJ.jugar(e, 'pedir', () => 0);
  assert.equal(e.fase, 'terminada'); assert.equal(e.manos[0].resultado, 'pasado'); assert.equal(e.crupier.length, 2);
});
prueba('blackjack: doblar pone otra apuesta, da una sola carta y paga el doble', () => {
  const e = estadoCon([C('6'), C('10'), C('5'), C('7'), C('K')]);
  assert.equal(BJ.costo(e, 'doblar'), 100);
  BJ.jugar(e, 'doblar', () => 0);
  assert.equal(e.manos[0].cartas.length, 3); assert.equal(e.manos[0].apuesta, 200);
  assert.equal(e.manos[0].resultado, 'gana'); assert.equal(e.premio, 400);
});
prueba('blackjack: dividir ochos arma dos manos y 21 después de dividir no es blackjack', () => {
  const e = estadoCon([C('8'), C('10'), C('8', 1), C('7'), C('3'), C('K'), C('10', 2)]);
  assert.ok(BJ.acciones(e).includes('dividir'));
  BJ.jugar(e, 'dividir', () => 0);
  assert.equal(e.manos.length, 2);
  assert.ok(!BJ.acciones(e).includes('dividir'), 'se divide una sola vez');
  BJ.jugar(e, 'doblar', () => 0); // 8+3+10 = 21 doblada
  BJ.jugar(e, 'plantarse', () => 0); // 8+K = 18
  assert.equal(e.fase, 'terminada');
  assert.deepEqual(e.manos.map((m) => m.resultado), ['gana', 'gana']);
  assert.equal(e.premio, 400 + 200);
});
prueba('blackjack: ases divididos reciben una sola carta y A+K ahí vale 21 común', () => {
  // crupier 10+7 = 17; las manos quedan A+K = 21 (gana 1 a 1, no 3 a 2) y A+5 = 16 (pierde)
  const e = estadoCon([C('A'), C('10'), C('A', 1), C('7'), C('K'), C('5')]);
  BJ.jugar(e, 'dividir', () => 0);
  assert.equal(e.fase, 'terminada');
  assert.deepEqual(e.manos.map((m) => m.cartas.length), [2, 2]);
  assert.deepEqual(e.manos.map((m) => m.resultado), ['gana', 'pierde']);
  assert.equal(e.premio, 200);
});
prueba('blackjack: no se puede jugar fuera de turno ni hacer cosas inválidas', () => {
  const e = estadoCon([C('10'), C('6'), C('7'), C('10'), C('K')]);
  assert.throws(() => BJ.jugar(e, 'dividir', () => 0));
  assert.throws(() => BJ.jugar(e, 'trampa', () => 0));
  BJ.jugar(e, 'plantarse', () => 0);
  assert.throws(() => BJ.jugar(e, 'pedir', () => 0));
  assert.throws(() => BJ.repartir({ ...e, fase: 'jugando' }, 100, () => 0));
});
prueba('blackjack: la vista no muestra la carta tapada ni el zapato', () => {
  const e = estadoCon([C('10'), C('6'), C('7'), C('Q')]);
  const v = BJ.vista(e);
  assert.equal(v.crupier[1], null); assert.equal(v.valorCrupier.total, 6);
  assert.ok(!('zapato' in v)); assert.ok(!JSON.stringify(v).includes(String(e.zapato.slice(e.pos, e.pos + 30))));
});
prueba('blackjack: el zapato se mezcla cuando queda un cuarto', () => {
  let e = null;
  const az = semilla(3);
  let mezclas = 0;
  for (let i = 0; i < 400; i++) {
    e = BJ.repartir(e, 10, az);
    if (e.mezclado) mezclas++;
    while (e.fase === 'jugando') BJ.jugar(e, 'plantarse', az);
    assert.ok(e.pos <= e.zapato.length);
  }
  assert.ok(mezclas >= 5, `${mezclas} mezclas`);
});

// Estrategia básica para 6 barajas, crupier se planta en 17, doblar después de dividir.
function estrategia(e) {
  const m = e.manos[e.activa], acc = BJ.acciones(e);
  const up = BJ.puntos(e.crupier[0]) === 1 ? 11 : BJ.puntos(e.crupier[0]);
  const v = BJ.valor(m.cartas);
  const dob = (si) => (si && acc.includes('doblar') ? 'doblar' : null);
  if (acc.includes('dividir')) {
    const p = BJ.puntos(m.cartas[0]);
    const dividir = p === 1 || p === 8 || (p === 9 && up !== 7 && up < 10) || (p === 7 && up <= 7) || (p === 6 && up <= 6)
      || (p === 4 && (up === 5 || up === 6)) || ((p === 2 || p === 3) && up <= 7);
    if (dividir) return 'dividir';
  }
  if (v.blanda) {
    const t = v.total;
    if (t >= 19) return 'plantarse';
    if (t === 18) return dob(up >= 3 && up <= 6) || (up <= 8 ? 'plantarse' : 'pedir');
    if (t === 17) return dob(up >= 3 && up <= 6) || 'pedir';
    if (t >= 15) return dob(up >= 4 && up <= 6) || 'pedir';
    return dob(up === 5 || up === 6) || 'pedir';
  }
  const t = v.total;
  if (t >= 17) return 'plantarse';
  if (t >= 13) return up <= 6 ? 'plantarse' : 'pedir';
  if (t === 12) return up >= 4 && up <= 6 ? 'plantarse' : 'pedir';
  if (t === 11) return dob(up <= 10) || 'pedir';
  if (t === 10) return dob(up <= 9) || 'pedir';
  if (t === 9) return dob(up >= 3 && up <= 6) || 'pedir';
  return 'pedir';
}
prueba(`blackjack: retorno con estrategia básica en ${N.toLocaleString('es')} manos ≈ 99,5 %`, () => {
  const az = semilla(5);
  let e = null, puesto = 0, vuelto = 0;
  for (let i = 0; i < N; i++) {
    e = BJ.repartir(e, 10, az);
    while (e.fase === 'jugando') BJ.jugar(e, estrategia(e), az);
    puesto += BJ.apostado(e); vuelto += e.premio;
  }
  // se mide contra la apuesta inicial (como se calcula la ventaja de la casa)
  const rtp = 1 + (vuelto - puesto) / (N * 10);
  assert.ok(rtp > (process.env.RAPIDO ? 0.97 : 0.985) && rtp < 1.0, `retorno ${(rtp * 100).toFixed(2)} %`);
  console.log(`       retorno ${(rtp * 100).toFixed(2)} % de la apuesta inicial`);
});

console.log(fallas ? `${fallas} prueba(s) fallaron` : 'todo OK');
process.exit(fallas ? 1 : 0);
