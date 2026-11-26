// Pruebas de la caída libre, el paracaídas y el deslizamiento (public/js/caida.js), sin navegador:
//   node tools/caida/pruebas.mjs
// Simula al jugador con pasos de 1/60 s sobre un piso plano (o en bajada) y revisa las reglas que pidió Rafael.
import * as THREE from 'three';
import {
  CAIDA, PARACAIDAS, DESLIZ, estadoCaida, fisicaAire, abrirParacaidas, puedeCerrar, cerrarParacaidas,
  puedeDeslizar, empezarDeslizar, fisicaDeslizar, controlCaida, paramsRed, leerParams,
} from '../../public/js/caida.js';

let fallas = 0;
const ok = (cond, txt, extra = '') => { console.log(`${cond ? '  ok ' : 'FALLA'} ${txt}${extra ? ' · ' + extra : ''}`); if (!cond) fallas++; };
const DT = 1 / 60;
const fwd = new THREE.Vector3(0, 0, -1), right = new THREE.Vector3(1, 0, 0);

function jugador(alto = 257) {
  return { pos: new THREE.Vector3(0, alto, 0), vel: new THREE.Vector3(0, -10, 0), yaw: 0, pitch: -0.2, state: 'falling', onGround: false, ...estadoCaida() };
}
// cae hasta el piso (y = 0) con las teclas dadas; devuelve tiempo, distancia y lo que pasó
function caer(teclas, pitch, { cerrarA = null, alto = 257 } = {}) {
  const me = jugador(alto);
  me.pitch = pitch;
  let t = 0, abrioA = null, cerro = false;
  while (me.pos.y > 0 && t < 200) {
    const ent = { fwd, right, adelante: !!teclas.w, atras: !!teclas.s, izq: !!teclas.a, der: !!teclas.d };
    const antes = me.state;
    fisicaAire(me, ent, DT, me.pos.y);
    if (antes === 'falling' && me.state === 'glider' && abrioA === null) abrioA = me.pos.y;
    if (cerrarA !== null && !cerro && me.state === 'glider' && me.pos.y < cerrarA) { cerro = puedeCerrar(me, me.pos.y); if (cerro) cerrarParacaidas(me); }
    me.pos.addScaledVector(me.vel, DT);
    t += DT;
  }
  return { t, dist: Math.hypot(me.pos.x, me.pos.z), abrioA, cerro, me };
}

console.log('Caída libre');
ok(controlCaida(-0.2, true) === -1, 'adelante mirando al horizonte = planeo');
ok(controlCaida(-1.1, false) === 1, 'mirando abajo = picada');
ok(controlCaida(-0.2, false) === 0, 'sin tocar nada = caída normal');
// solo la caída libre: hasta la altura del paracaídas automático

const planeo = caer({ w: true }, -0.2), picada = caer({ w: true }, -1.2), normal = caer({}, -0.2);
ok(planeo.dist > picada.dist * 2.5, 'planeando se llega mucho más lejos que en picada', `${planeo.dist.toFixed(0)} m vs ${picada.dist.toFixed(0)} m`);
{
  // tiempo hasta el límite del paracaídas
  const hasta = (teclas, pitch) => { const me = jugador(); me.pitch = pitch; let t = 0; while (me.state === 'falling' && t < 60) { fisicaAire(me, { fwd, right, adelante: !!teclas.w }, DT, me.pos.y); me.pos.addScaledVector(me.vel, DT); t += DT; } return { t, x: Math.hypot(me.pos.x, me.pos.z) }; };
  const a = hasta({ w: true }, -0.2), b = hasta({ w: true }, -1.2), c = hasta({}, -0.2);
  ok(b.t < c.t && c.t < a.t, 'en picada se llega antes al piso, planeando después', `picada ${b.t.toFixed(1)} s · normal ${c.t.toFixed(1)} s · planeo ${a.t.toFixed(1)} s (caída libre desde 257 m)`);
  ok(a.x > 150, 'planeo: avanza más de 150 m en caída libre', `${a.x.toFixed(0)} m`);
  ok(b.x < 60, 'picada: casi no avanza', `${b.x.toFixed(0)} m`);
}
ok(normal.abrioA !== null && Math.abs(normal.abrioA - PARACAIDAS.LIMITE) < 2, `el paracaídas se abre solo a ${PARACAIDAS.LIMITE} m`, `se abrió a ${normal.abrioA?.toFixed(1)} m`);

console.log('Paracaídas');
{
  const me = jugador(200);
  abrirParacaidas(me);
  ok(me.state === 'glider' && puedeCerrar(me, 200), 'abierto arriba del límite se puede cerrar');
  cerrarParacaidas(me);
  ok(me.state === 'falling', 'cerrado vuelve a la caída libre');
  abrirParacaidas(me);
  fisicaAire(me, { fwd, right }, DT, PARACAIDAS.LIMITE - 1);
  ok(!puedeCerrar(me, PARACAIDAS.LIMITE - 1), 'debajo del límite no se puede cerrar');
  ok(!puedeCerrar(me, PARACAIDAS.LIMITE + 30), 'y aunque vuelva a subir (sobre una barranca) queda abierto');
  const r = caer({}, -0.2, { cerrarA: 60 });
  ok(!r.cerro, 'una vez que se abrió solo, no se puede cerrar');
}
{
  // velocidad estable con el paracaídas
  const estable = (teclas) => { const me = jugador(300); abrirParacaidas(me); for (let i = 0; i < 600; i++) fisicaAire(me, { fwd, right, adelante: !!teclas.w, atras: !!teclas.s, izq: !!teclas.a, der: !!teclas.d }, DT, 300); return me; };
  const nada = estable({}), adel = estable({ w: true }), fre = estable({ s: true }), lado = estable({ d: true });
  ok(-adel.vel.z > -nada.vel.z + 8, 'con adelante avanza bastante más', `${(-adel.vel.z).toFixed(1)} vs ${(-nada.vel.z).toFixed(1)} m/s`);
  ok(-fre.vel.y < -nada.vel.y, 'frenando cae más despacio', `${(-fre.vel.y).toFixed(1)} vs ${(-nada.vel.y).toFixed(1)} m/s`);
  ok(lado.vel.x > 8 && lado.giro > 0.5 && fre.freno > 0.9, 'dobla con los costados y la animación recibe giro y freno');
  ok(-adel.vel.z > 17 + 3, 'se mueve más que el planeador de antes (17 m/s)');
}

console.log('Deslizarse');
function deslizar(pend, segundos = 5, sueltaA = 99) {
  const me = { pos: new THREE.Vector3(), vel: new THREE.Vector3(0, 0, -9.5), state: 'ground', onGround: true, use: null, ...estadoCaida() };
  if (!puedeDeslizar(me, false)) return null;
  empezarDeslizar(me);
  let t = 0, dist = 0, vmax = 0;
  while (me.desliz && t < segundos) {
    fisicaDeslizar(me, DT, new THREE.Vector2(pend.x, pend.y), new THREE.Vector3(), t < sueltaA);
    dist += Math.hypot(me.vel.x, me.vel.z) * DT;
    vmax = Math.max(vmax, Math.hypot(me.vel.x, me.vel.z));
    t += DT;
  }
  return { t, dist, vmax };
}
{
  const quieto = { pos: new THREE.Vector3(), vel: new THREE.Vector3(0, 0, -6), state: 'ground', onGround: true, use: null, ...estadoCaida() };
  ok(!puedeDeslizar(quieto, false), 'caminando no se desliza (hay que correr)');
  ok(!puedeDeslizar({ ...quieto, vel: new THREE.Vector3(0, 0, -9.5) }, true), 'nadando no se desliza');
  const plano = deslizar({ x: 0, y: 0 });
  ok(plano && plano.dist > 8 && plano.t < 3, 'en el plano se desliza un tramo y se levanta solo', `${plano?.dist.toFixed(1)} m en ${plano?.t.toFixed(2)} s`);
  const bajada = deslizar({ x: 0, y: 0.35 });   // dh/dz > 0 y va hacia -z: bajada
  ok(bajada && bajada.dist > plano.dist * 2 && bajada.vmax > 13, 'en bajada sigue y acelera', `${bajada?.dist.toFixed(1)} m · máx ${bajada?.vmax.toFixed(1)} m/s`);
  const subida = deslizar({ x: 0, y: -0.35 });
  ok(subida && subida.dist < plano.dist, 'en subida frena antes', `${subida?.dist.toFixed(1)} m`);
  const corto = deslizar({ x: 0, y: 0 }, 5, 0.1);
  ok(corto && corto.t >= DESLIZ.MIN_T - 1e-6 && corto.t < 0.5, 'soltar la tecla lo corta (después de un mínimo)', `${corto?.t.toFixed(2)} s`);
}

console.log('Red');
{
  const me = { ...estadoCaida(), caida: -0.5, giro: 0.25, freno: 1, desliz: { t: 0 } };
  const p = leerParams(paramsRed(me));
  ok(p.caida === -0.5 && p.giro === 0.25 && p.freno === 1 && p.desliz, 'los parámetros de animación van y vuelven por la red');
  ok(leerParams(['x', null]).caida === 0 && leerParams(undefined).desliz === false, 'datos rotos no rompen nada');
}
console.log(fallas ? `${fallas} pruebas fallaron` : 'todo OK');
process.exit(fallas ? 1 : 0);
