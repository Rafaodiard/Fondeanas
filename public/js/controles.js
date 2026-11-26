// Registro central de acciones (qué hace cada tecla) y de opciones del juego.
// Todo se guarda en localStorage y lo cambia el panel de configuración (configuracion.js).
//
// Para agregar un control nuevo desde otro módulo:
//   registrarAccion('editar', 'Editar construcción', 'Construcción', ['KeyF'], 'construccion');
//   ...y en el juego: if (accionesDe(code, contexto).includes('editar')) ...  o  activa('editar') para "mantener apretado".
// Contextos: 'todos' (a pie: vale en combate y en construcción), 'combate' (con arma/pico/objeto en la mano),
// 'construccion' (en modo construcción), 'vehiculo' (sentado en un auto) y 'siempre' (a pie y en el auto: el chat).
// Una tecla puede repetirse en 'combate' y 'construccion' (R recarga y en construcción gira); con 'todos' choca con las
// de a pie. Las de 'vehiculo' solo chocan entre ellas (W acelera en el auto y camina a pie) y con 'siempre'.
// Para agregar una opción nueva:
//   registrarOpcion({ id: 'x', nombre: '…', grupo: 'Juego', tipo: 'si-no', def: true });
//   ...y leerla con opcion('x'). Los cambios avisan con alCambiar(fn).
//
// Códigos: los de KeyboardEvent.code ('KeyW', 'Space', 'ShiftLeft'…), 'Mouse0'…'Mouse4' para los botones
// del mouse y 'RuedaArriba' / 'RuedaAbajo' para la rueda. Escape queda reservado para el menú.

import { BOT_TOTALES, BOT_DIFICULTADES } from './opcionesBots.js';

const CLAVE_CONTROLES = 'sf-controles';
const CLAVE_OPCIONES = 'sf-opciones';
export const RESERVADAS = ['Escape'];
export const GRUPOS = ['Movimiento', 'Combate', 'Inventario', 'Construcción', 'Vehículos', 'Otros'];

export const CONTEXTOS = ['todos', 'combate', 'construccion', 'vehiculo', 'siempre'];
const acciones = new Map(); // id -> { id, nombre, grupo, contexto, def: [a, b], teclas: [a, b] }
const opciones = new Map(); // id -> { ...definición, valor }
const oyentes = new Set();
const pulsadas = new Set();
let porCodigo = new Map(); // código -> [ids]
let guardadoControles = leer(CLAVE_CONTROLES);
let guardadoOpciones = leer(CLAVE_OPCIONES);

function leer(k) {
  try { const v = JSON.parse(globalThis.localStorage?.getItem(k) || 'null'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}
function escribir(k, v) {
  try { globalThis.localStorage?.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento: vale solo esta sesión */ }
}
function avisar(tipo, id) { for (const f of oyentes) { try { f(tipo, id); } catch (e) { console.error(e); } } }

// ---------- Acciones ----------
export function registrarAccion(id, nombre, grupo, teclas = [], contexto = 'todos') {
  const def = [teclas[0] || null, teclas[1] || null];
  const g = guardadoControles[id];
  const a = { id, nombre, grupo: GRUPOS.includes(grupo) ? grupo : 'Otros', contexto: CONTEXTOS.includes(contexto) ? contexto : 'todos', def,
    teclas: Array.isArray(g) ? [g[0] || null, g[1] || null] : [...def] };
  acciones.set(id, a);
  // un control nuevo no le saca la tecla a uno que el jugador ya cambió: si choca, queda sin asignar hasta que lo elija
  if (!Array.isArray(g)) a.teclas = a.teclas.map((c) => (c && usadaPorOtra(c, id) ? null : c));
  reindexar();
  return a;
}
function usadaPorOtra(code, id) {
  const yo = acciones.get(id);
  for (const a of acciones.values()) if (a.id !== id && a.teclas.includes(code) && guardadoControles[a.id] && chocan(a, yo)) return true;
  return false;
}
/** Dos acciones no pueden compartir tecla si pueden estar activas a la vez. */
export function chocan(a, b) {
  if (a.contexto === 'siempre' || b.contexto === 'siempre' || a.contexto === b.contexto) return true;
  if (a.contexto === 'vehiculo' || b.contexto === 'vehiculo') return false;   // a pie y en el auto nunca a la vez
  return a.contexto === 'todos' || b.contexto === 'todos';
}
function reindexar() {
  porCodigo = new Map();
  for (const a of acciones.values()) for (const c of a.teclas) if (c) {
    if (!porCodigo.has(c)) porCodigo.set(c, []);
    porCodigo.get(c).push(a.id);
  }
}

export const listaAcciones = () => [...acciones.values()];
export const accion = (id) => acciones.get(id);
/** Acciones que dispara un código (tecla, botón del mouse o rueda) en el contexto dado ('combate', 'construccion' o
 *  'vehiculo'). Sin contexto: todas. */
export function accionesDe(code, contexto = null) {
  const ids = porCodigo.get(code) || [];
  if (!contexto) return ids;
  return ids.filter((id) => {
    const c = acciones.get(id).contexto;
    return c === contexto || c === 'siempre' || (c === 'todos' && contexto !== 'vehiculo');
  });
}
/** ¿Está apretada alguna de las teclas de la acción? (para las que se mantienen: caminar, correr…) */
export function activa(id) {
  const a = acciones.get(id);
  return !!a && (pulsadas.has(a.teclas[0]) || pulsadas.has(a.teclas[1]));
}
export function presionar(code) { pulsadas.add(code); }
export function soltar(code) { pulsadas.delete(code); }
export function soltarTodo() { pulsadas.clear(); }

/** Asigna un código a la acción (lugar 0 = principal, 1 = secundaria). Se lo saca a cualquier otra acción que lo tuviera
 *  y que choque con esta (mismo contexto, o alguna de las dos en 'todos').
 *  Devuelve los nombres de las acciones que se quedaron sin esa tecla. */
export function asignar(id, lugar, code) {
  const a = acciones.get(id);
  if (!a || RESERVADAS.includes(code)) return [];
  const quitadas = [];
  if (code) for (const o of acciones.values()) {
    if (o === a || !chocan(o, a)) continue;
    const i = o.teclas.indexOf(code);
    if (i >= 0) { o.teclas[i] = null; quitadas.push(o.nombre); guardadoControles[o.id] = o.teclas; }
  }
  if (code && a.teclas[1 - lugar] === code) a.teclas[1 - lugar] = null;
  a.teclas[lugar] = code || null;
  guardadoControles[id] = a.teclas;
  escribir(CLAVE_CONTROLES, guardadoControles);
  reindexar();
  avisar('controles', id);
  return quitadas;
}
export function restablecerControles() {
  guardadoControles = {};
  escribir(CLAVE_CONTROLES, guardadoControles);
  for (const a of acciones.values()) a.teclas = [...a.def];
  reindexar();
  avisar('controles', null);
}

const NOMBRES = {
  Space: 'Espacio', Enter: 'Enter', Tab: 'Tab', Backspace: 'Borrar', CapsLock: 'Bloq Mayús',
  ShiftLeft: 'Shift', ShiftRight: 'Shift der.', ControlLeft: 'Ctrl', ControlRight: 'Ctrl der.', AltLeft: 'Alt', AltRight: 'Alt der.',
  MetaLeft: 'Win', MetaRight: 'Win der.', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'",
  Comma: ',', Period: '.', Slash: '/', IntlBackslash: '<', Insert: 'Insert', Delete: 'Supr', Home: 'Inicio', End: 'Fin',
  PageUp: 'Re Pág', PageDown: 'Av Pág',
  Mouse0: 'Clic izq.', Mouse1: 'Clic rueda', Mouse2: 'Clic der.', Mouse3: 'Mouse 4', Mouse4: 'Mouse 5',
  RuedaArriba: 'Rueda ↑', RuedaAbajo: 'Rueda ↓',
};
// Con la distribución real del teclado (Chrome/Edge) las teclas se nombran como están impresas: Ñ, ´, +…
let distribucion = null;
export async function cargarDistribucion() {
  try {
    const m = await globalThis.navigator?.keyboard?.getLayoutMap?.();
    if (m) { distribucion = m; avisar('controles', null); }
  } catch { /* el navegador no lo deja: quedan los nombres en inglés */ }
}
export function nombreTecla(code) {
  if (!code) return '—';
  if (NOMBRES[code] && !/^(Backquote|Minus|Equal|Bracket|Backslash|Semicolon|Quote|Comma|Period|Slash|IntlBackslash)/.test(code)) return NOMBRES[code];
  const k = distribucion?.get(code);
  if (k && k.trim()) return k.length === 1 ? k.toUpperCase() : k;
  if (NOMBRES[code]) return NOMBRES[code];
  let m = /^Key([A-Z])$/.exec(code); if (m) return m[1];
  m = /^Digit(\d)$/.exec(code); if (m) return m[1];
  m = /^Numpad(.+)$/.exec(code); if (m) return 'Num ' + m[1];
  if (/^F\d+$/.test(code)) return code;
  return code;
}
/** Nombre de la tecla principal de la acción (o la secundaria si la principal está vacía), para carteles del HUD. */
export function teclaDe(id) {
  const a = acciones.get(id);
  return a ? nombreTecla(a.teclas[0] || a.teclas[1]) : '—';
}

// ---------- Opciones ----------
export function registrarOpcion(def) {
  const g = guardadoOpciones[def.id];
  const o = { grupo: 'Juego', ...def, valor: valido(def, g) ? g : def.def };
  opciones.set(def.id, o);
  return o;
}
function valido(def, v) {
  if (v === undefined || v === null) return false;
  if (def.tipo === 'rango') return typeof v === 'number' && v >= def.min && v <= def.max;
  if (def.tipo === 'si-no') return typeof v === 'boolean';
  if (def.tipo === 'lista') return def.valores.some(([k]) => k === v);
  return true;
}
export const listaOpciones = () => [...opciones.values()];
export const opcion = (id) => opciones.get(id)?.valor;
export function fijarOpcion(id, v) {
  const o = opciones.get(id);
  if (!o || !valido(o, v)) return;
  o.valor = v;
  guardadoOpciones[id] = v;
  escribir(CLAVE_OPCIONES, guardadoOpciones);
  avisar('opcion', id);
}
export function restablecerOpciones() {
  guardadoOpciones = {};
  escribir(CLAVE_OPCIONES, guardadoOpciones);
  for (const o of opciones.values()) o.valor = o.def;
  avisar('opcion', null);
}
/** fn(tipo, id): tipo 'controles' u 'opcion'; id null = se restableció todo. Devuelve una función para dejar de escuchar. */
export function alCambiar(fn) { oyentes.add(fn); return () => oyentes.delete(fn); }

// ---------- Controles del juego ----------
const A = registrarAccion;
A('adelante', 'Adelante', 'Movimiento', ['KeyW', 'ArrowUp']);
A('atras', 'Atrás', 'Movimiento', ['KeyS', 'ArrowDown']);
A('izquierda', 'Izquierda', 'Movimiento', ['KeyA', 'ArrowLeft']);
A('derecha', 'Derecha', 'Movimiento', ['KeyD', 'ArrowRight']);
A('correr', 'Correr', 'Movimiento', ['ShiftLeft']);
A('saltar', 'Saltar / saltar del bus / abrir y cerrar el paracaídas', 'Movimiento', ['Space']);
A('deslizar', 'Deslizarse (corriendo)', 'Movimiento', ['ControlLeft']);
A('bailar', 'Bailar', 'Movimiento', ['KeyB']);

A('disparar', 'Disparar / usar', 'Combate', ['Mouse0']);
A('apuntar', 'Apuntar', 'Combate', ['Mouse2'], 'combate');
A('recargar', 'Recargar', 'Combate', ['KeyR'], 'combate');
A('interactuar', 'Agarrar / abrir / subir al auto', 'Combate', ['KeyE']);

A('pico', 'Pico', 'Inventario', ['Digit1']);
for (let i = 1; i <= 5; i++) A('ranura' + i, `Ranura ${i}`, 'Inventario', ['Digit' + (i + 1)]);
A('ranuraSiguiente', 'Ranura siguiente', 'Inventario', ['RuedaAbajo']);
A('ranuraAnterior', 'Ranura anterior', 'Inventario', ['RuedaArriba']);
A('tirar', 'Tirar lo que tenés en la mano', 'Inventario', ['KeyG']);

A('modoConstruccion', 'Entrar / salir de construcción', 'Construcción', ['KeyQ']);
A('construirPared', 'Pared', 'Construcción', ['KeyZ']);
A('construirPiso', 'Piso', 'Construcción', ['KeyX']);
A('construirRampa', 'Rampa', 'Construcción', ['KeyC']);
A('cambiarMaterial', 'Cambiar material', 'Construcción', ['KeyV'], 'construccion');

// Vehículos (los usa manejar.js): solo valen sentado en un auto, así que repiten las teclas de a pie.
A('acelerar', 'Acelerar', 'Vehículos', ['KeyW', 'ArrowUp'], 'vehiculo');
A('frenar', 'Frenar / marcha atrás', 'Vehículos', ['KeyS', 'ArrowDown'], 'vehiculo');
A('doblarIzq', 'Doblar a la izquierda', 'Vehículos', ['KeyA', 'ArrowLeft'], 'vehiculo');
A('doblarDer', 'Doblar a la derecha', 'Vehículos', ['KeyD', 'ArrowRight'], 'vehiculo');
A('frenoMano', 'Freno de mano (derrapar)', 'Vehículos', ['Space'], 'vehiculo');
A('turbo', 'Turbo', 'Vehículos', ['ShiftLeft'], 'vehiculo');
A('bajarAuto', 'Bajarse del auto', 'Vehículos', ['KeyE'], 'vehiculo');
A('cambiarAsiento', 'Cambiar de asiento', 'Vehículos', ['KeyF'], 'vehiculo');
A('bocina', 'Bocina', 'Vehículos', ['Mouse0', 'KeyH'], 'vehiculo');

A('chat', 'Abrir el chat', 'Otros', ['Enter'], 'siempre');

// ---------- Opciones del juego ----------
const pct = (v) => `${Math.round(v * 100)}%`;
const O = registrarOpcion;
O({ id: 'sens', nombre: 'Sensibilidad del mouse', grupo: 'Juego', tipo: 'rango', min: 0.1, max: 3, paso: 0.01, def: 1, fmt: pct });
O({ id: 'sensApunta', nombre: 'Sensibilidad apuntando', ayuda: 'Respecto de la sensibilidad del mouse', grupo: 'Juego', tipo: 'rango', min: 0.1, max: 1.5, paso: 0.01, def: 0.55, fmt: pct });
O({ id: 'sensMira', nombre: 'Sensibilidad con mira telescópica', ayuda: 'Respecto de la sensibilidad del mouse', grupo: 'Juego', tipo: 'rango', min: 0.05, max: 1.5, paso: 0.01, def: 0.27, fmt: pct });
O({ id: 'invertirY', nombre: 'Invertir el eje vertical', grupo: 'Juego', tipo: 'si-no', def: false });
O({ id: 'apuntarAlternar', nombre: 'Apuntar', grupo: 'Juego', tipo: 'lista', valores: [[false, 'Mantener apretado'], [true, 'Alternar']], def: false });
O({ id: 'correrSiempre', nombre: 'Correr siempre', ayuda: 'Con esto activado, la tecla de correr hace caminar', grupo: 'Juego', tipo: 'si-no', def: false });
O({ id: 'numerosDanio', nombre: 'Números de daño', grupo: 'Juego', tipo: 'si-no', def: true });
// Bots: lo que se pone al crear una sala (el anfitrión lo puede cambiar en la sala) y lo que usa "Jugar con bots".
O({ id: 'botsTotal', nombre: 'Bots: completar la sala hasta', ayuda: 'Al crear una sala, los bots completan hasta este total de jugadores', grupo: 'Juego', tipo: 'lista', valores: BOT_TOTALES.map((n) => [n, n ? `${n} jugadores` : 'Sin bots']), def: 0 });
O({ id: 'botsDificultad', nombre: 'Dificultad de los bots', grupo: 'Juego', tipo: 'lista', valores: Object.entries(BOT_DIFICULTADES), def: 'normal' });

O({ id: 'calidad', nombre: 'Calidad gráfica', grupo: 'Video', tipo: 'lista', valores: [['baja', 'Baja'], ['media', 'Media'], ['alta', 'Alta']], def: 'alta' });
O({ id: 'resolucion', nombre: 'Resolución 3D', grupo: 'Video', tipo: 'rango', min: 0.5, max: 1, paso: 0.05, def: 1, fmt: pct });
O({ id: 'fov', nombre: 'Campo de visión', grupo: 'Video', tipo: 'rango', min: 60, max: 100, paso: 1, def: 70, fmt: (v) => `${v}°` });
O({ id: 'colorMira', nombre: 'Color de la mira', grupo: 'Video', tipo: 'lista', valores: [['#ffffff', 'Blanco'], ['#ffe14d', 'Amarillo'], ['#5dff6a', 'Verde'], ['#4de8ff', 'Celeste'], ['#ff5cf0', 'Rosa']], def: '#ffffff' });
O({ id: 'fps', nombre: 'Mostrar FPS', grupo: 'Video', tipo: 'si-no', def: false });

O({ id: 'volumen', nombre: 'Volumen general', grupo: 'Sonido', tipo: 'rango', min: 0, max: 1, paso: 0.05, def: 1, fmt: pct });
