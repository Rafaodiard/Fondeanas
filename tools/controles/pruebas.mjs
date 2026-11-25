// Pruebas del registro de controles y opciones (public/js/controles.js), en Node y sin navegador.
// Uso: node tools/controles/pruebas.mjs  → tiene que terminar con "todo OK".
import assert from 'node:assert/strict';

const datos = new Map();
globalThis.localStorage = { getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => datos.set(k, String(v)), removeItem: (k) => datos.delete(k) };
const url = new URL('../../public/js/controles.js', import.meta.url).href;
let n = 0;
const cargar = () => import(`${url}?v=${n++}`);
let fallas = 0;
function prueba(nombre, fn) {
  return Promise.resolve().then(fn).then(() => console.log('  ok ', nombre), (e) => { fallas++; console.log('  MAL', nombre, '\n     ', e.message); });
}

const C = await cargar();

await prueba('ninguna tecla de fábrica choca con otra', () => {
  const vistas = [];
  for (const a of C.listaAcciones()) for (const c of a.teclas) if (c) {
    for (const o of vistas) if (o.c === c) assert.ok(!C.chocan(o.a, a), `${c} está en "${o.a.nombre}" y en "${a.nombre}"`);
    vistas.push({ a, c });
  }
});
await prueba('teclas de fábrica = las de antes del panel', () => {
  const esperado = { adelante: 'KeyW', atras: 'KeyS', izquierda: 'KeyA', derecha: 'KeyD', correr: 'ShiftLeft', saltar: 'Space', disparar: 'Mouse0', apuntar: 'Mouse2',
    recargar: 'KeyR', interactuar: 'KeyE', tirar: 'KeyG', bailar: 'KeyB', pico: 'Digit1', ranura1: 'Digit2', ranura5: 'Digit6', construirPared: 'KeyZ',
    construirPiso: 'KeyX', construirRampa: 'KeyC', modoConstruccion: 'KeyQ', cambiarMaterial: 'KeyV', chat: 'Enter', ranuraSiguiente: 'RuedaAbajo' };
  for (const [id, c] of Object.entries(esperado)) assert.equal(C.accion(id).teclas[0], c, id);
});
await prueba('accionesDe filtra por contexto', () => {
  C.registrarAccion('girarPrueba', 'Girar (prueba)', 'Construcción', ['KeyR'], 'construccion');
  assert.deepEqual(C.accionesDe('KeyR', 'combate'), ['recargar']);
  assert.deepEqual(C.accionesDe('KeyR', 'construccion'), ['girarPrueba']);
  assert.deepEqual(C.accionesDe('KeyW', 'construccion'), ['adelante']);
});
await prueba('asignar saca la tecla a la acción que choca, no a la de otro contexto', () => {
  const quitadas = C.asignar('saltar', 0, 'KeyE');
  assert.deepEqual(quitadas, ['Agarrar / abrir']);
  assert.equal(C.accion('interactuar').teclas[0], null);
  assert.deepEqual(C.accionesDe('KeyE'), ['saltar']);
  assert.deepEqual(C.asignar('recargar', 1, 'KeyX').length, 1); // construirPiso está en 'todos'
  C.asignar('girarPrueba', 0, 'KeyR');
  assert.equal(C.accion('recargar').teclas[0], 'KeyR', 'recargar (combate) no pierde R por girar (construcción)');
});
await prueba('misma tecla en principal y secundaria no se duplica', () => {
  C.asignar('adelante', 1, 'KeyW');
  assert.deepEqual(C.accion('adelante').teclas, [null, 'KeyW']);
});
await prueba('Escape está reservada', () => {
  assert.deepEqual(C.asignar('chat', 0, 'Escape'), []);
  assert.equal(C.accion('chat').teclas[0], 'Enter');
});
await prueba('activa() con principal o secundaria', () => {
  C.presionar('ArrowDown'); assert.ok(C.activa('atras')); C.soltar('ArrowDown'); assert.ok(!C.activa('atras'));
  C.presionar('KeyW'); assert.ok(C.activa('adelante')); C.soltarTodo(); assert.ok(!C.activa('adelante'));
});
await prueba('lo cambiado se guarda y vuelve al recargar, aunque la acción se registre tarde', async () => {
  C.registrarAccion('tardia', 'Tardía', 'Otros', ['KeyK']);
  C.asignar('tardia', 0, 'KeyL');
  const D = await cargar();
  assert.equal(D.accion('saltar').teclas[0], 'KeyE');
  assert.equal(D.accion('interactuar').teclas[0], null);
  assert.equal(D.accion('tardia'), undefined);
  D.registrarAccion('tardia', 'Tardía', 'Otros', ['KeyK']);
  assert.equal(D.accion('tardia').teclas[0], 'KeyL');
});
await prueba('una acción nueva no le roba la tecla a una que el jugador eligió', async () => {
  const D = await cargar();
  D.registrarAccion('nueva', 'Nueva', 'Otros', ['KeyE']); // KeyE ahora es "saltar" (elegido por el jugador)
  assert.equal(D.accion('nueva').teclas[0], null);
  assert.equal(D.accion('saltar').teclas[0], 'KeyE');
});
await prueba('restablecer controles', async () => {
  const D = await cargar();
  D.restablecerControles();
  assert.equal(D.accion('saltar').teclas[0], 'Space');
  assert.equal(D.accion('interactuar').teclas[0], 'KeyE');
  const E = await cargar();
  assert.equal(E.accion('saltar').teclas[0], 'Space');
});
await prueba('opciones: valores de fábrica, inválidos ignorados, se guardan y avisan', async () => {
  const D = await cargar();
  assert.equal(D.opcion('sens'), 1); assert.equal(D.opcion('fov'), 70); assert.equal(D.opcion('calidad'), 'alta');
  let avisos = 0; D.alCambiar(() => avisos++);
  D.fijarOpcion('fov', 300); assert.equal(D.opcion('fov'), 70);
  D.fijarOpcion('calidad', 'ultra'); assert.equal(D.opcion('calidad'), 'alta');
  D.fijarOpcion('fov', 90); D.fijarOpcion('invertirY', true); D.fijarOpcion('calidad', 'baja');
  assert.equal(avisos, 3);
  const E = await cargar();
  assert.equal(E.opcion('fov'), 90); assert.equal(E.opcion('invertirY'), true); assert.equal(E.opcion('calidad'), 'baja');
  E.restablecerOpciones(); assert.equal(E.opcion('fov'), 70);
});
await prueba('localStorage roto no rompe nada', async () => {
  datos.set('sf-controles', '{no es json'); datos.set('sf-opciones', '"texto"');
  const D = await cargar();
  assert.equal(D.accion('saltar').teclas[0], 'Space'); assert.equal(D.opcion('sens'), 1);
});
await prueba('nombres de teclas', () => {
  const t = { KeyW: 'W', Digit3: '3', Space: 'Espacio', ShiftLeft: 'Shift', Mouse0: 'Clic izq.', Mouse2: 'Clic der.', RuedaAbajo: 'Rueda ↓', Numpad5: 'Num 5', F4: 'F4' };
  for (const [c, nombre] of Object.entries(t)) assert.equal(C.nombreTecla(c), nombre, c);
  assert.equal(C.nombreTecla(null), '—');
});

console.log(fallas ? `${fallas} prueba(s) fallaron` : 'todo OK');
process.exit(fallas ? 1 : 0);
