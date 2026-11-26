// Blackjack contra la casa. Compartido: el servidor guarda la mano y decide, el cliente dibuja las cartas.
// Reglas: zapato de 6 barajas que se mezcla cuando queda un cuarto; el crupier se planta en 17 (también en 17 blando)
// y espía el blackjack con un As o una figura a la vista; blackjack paga 3 a 2; se dobla con las dos primeras cartas
// (también después de dividir); se divide una vez, pares del mismo valor; ases divididos reciben una sola carta.
import { montoValido } from './reglas.js';

export const BARAJAS = 6;
const CARTAS = BARAJAS * 52;
const MEZCLAR_CON = Math.floor(CARTAS / 4);

// Carta = entero 0..51: rango = c % 13 (0 = As, 1..8 = 2..9, 9 = 10, 10 = J, 11 = Q, 12 = K), palo = c / 13.
export const RANGOS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const PALOS = ['♠', '♥', '♦', '♣'];
export const rango = (c) => RANGOS[c % 13];
export const palo = (c) => PALOS[Math.floor(c / 13) % 4];
export const puntos = (c) => Math.min(10, (c % 13) + 1); // el As vale 1 acá; valor() lo sube a 11 si conviene

export function valor(cartas) {
  let total = 0, ases = 0;
  for (const c of cartas) { total += puntos(c); if (c % 13 === 0) ases++; }
  const blanda = ases > 0 && total + 10 <= 21;
  return { total: blanda ? total + 10 : total, blanda };
}
export const esBlackjack = (cartas) => cartas.length === 2 && valor(cartas).total === 21;

function nuevoZapato(azar) {
  const z = Array.from({ length: CARTAS }, (_, i) => i % 52);
  for (let i = z.length - 1; i > 0; i--) { const j = azar(i + 1); [z[i], z[j]] = [z[j], z[i]]; }
  return z;
}
function sacar(e, azar) {
  if (e.pos >= e.zapato.length) { e.zapato = nuevoZapato(azar); e.pos = 0; e.mezclado = true; }
  return e.zapato[e.pos++];
}

// Empieza una mano. previo: estado anterior (para seguir con el mismo zapato) o null.
export function repartir(previo, apuesta, azar) {
  if (!montoValido(apuesta)) throw new Error('monto');
  if (previo && previo.fase === 'jugando') throw new Error('mano_en_curso');
  const e = { zapato: previo?.zapato, pos: previo?.pos ?? 0, mezclado: false };
  if (!e.zapato || e.zapato.length - e.pos < MEZCLAR_CON) { e.zapato = nuevoZapato(azar); e.pos = 0; e.mezclado = true; }
  const p = [], d = [];
  p.push(sacar(e, azar)); d.push(sacar(e, azar)); p.push(sacar(e, azar)); d.push(sacar(e, azar));
  Object.assign(e, { fase: 'jugando', manos: [{ cartas: p, apuesta, doblada: false, terminada: false, deAses: false }], activa: 0, crupier: d, dividida: false });
  const espia = puntos(d[0]) === 10 || d[0] % 13 === 0;
  if (esBlackjack(p) || (espia && esBlackjack(d))) cerrar(e, azar, false);
  return e;
}

const manoActiva = (e) => (e.fase === 'jugando' ? e.manos[e.activa] : null);

// Qué puede hacer el jugador ahora.
export function acciones(e) {
  const m = manoActiva(e);
  if (!m) return [];
  const a = ['pedir', 'plantarse'];
  if (m.cartas.length === 2 && !m.deAses) a.push('doblar');
  if (!e.dividida && e.manos.length === 1 && m.cartas.length === 2 && puntos(m.cartas[0]) === puntos(m.cartas[1])) a.push('dividir');
  return a;
}

// Pavos extra que hay que poner para hacer esa acción (doblar y dividir ponen otra apuesta igual).
export function costo(e, accion) {
  const m = manoActiva(e);
  return m && (accion === 'doblar' || accion === 'dividir') ? m.apuesta : 0;
}

export function jugar(e, accion, azar) {
  if (!acciones(e).includes(accion)) throw new Error('accion_invalida');
  const m = manoActiva(e);
  if (accion === 'pedir') {
    m.cartas.push(sacar(e, azar));
    if (valor(m.cartas).total >= 21) m.terminada = true;
  } else if (accion === 'plantarse') m.terminada = true;
  else if (accion === 'doblar') {
    m.apuesta *= 2; m.doblada = true;
    m.cartas.push(sacar(e, azar));
    m.terminada = true;
  } else if (accion === 'dividir') {
    e.dividida = true;
    const ases = m.cartas[0] % 13 === 0;
    const otra = { cartas: [m.cartas.pop()], apuesta: m.apuesta, doblada: false, terminada: false, deAses: ases };
    m.deAses = ases;
    m.cartas.push(sacar(e, azar));
    otra.cartas.push(sacar(e, azar));
    e.manos.push(otra);
    if (ases) { m.terminada = true; otra.terminada = true; }
    else for (const h of e.manos) if (valor(h.cartas).total === 21) h.terminada = true;
  }
  avanzar(e, azar);
  return e;
}

function avanzar(e, azar) {
  while (e.activa < e.manos.length && e.manos[e.activa].terminada) e.activa++;
  if (e.activa >= e.manos.length) cerrar(e, azar, true);
}

// Juega el crupier (si hace falta) y liquida. premio = lo que se devuelve en total (apuestas incluidas).
function cerrar(e, azar, juegaCrupier) {
  const vivas = e.manos.some((m) => valor(m.cartas).total <= 21);
  if (juegaCrupier && vivas) while (valor(e.crupier).total < 17) e.crupier.push(sacar(e, azar));
  const vd = valor(e.crupier).total, bjD = esBlackjack(e.crupier);
  let premio = 0;
  for (const m of e.manos) {
    const vp = valor(m.cartas).total;
    const natural = !e.dividida && esBlackjack(m.cartas);
    let r;
    if (natural && bjD) r = 'empate';
    else if (natural) r = 'blackjack';
    else if (bjD) r = 'pierde';
    else if (vp > 21) r = 'pasado';
    else if (vd > 21 || vp > vd) r = 'gana';
    else if (vp === vd) r = 'empate';
    else r = 'pierde';
    m.resultado = r;
    m.premio = r === 'blackjack' ? m.apuesta + Math.floor(m.apuesta * 1.5) : r === 'gana' ? m.apuesta * 2 : r === 'empate' ? m.apuesta : 0;
    premio += m.premio;
  }
  e.fase = 'terminada';
  e.activa = -1;
  e.premio = premio;
}

export const apostado = (e) => e.manos.reduce((s, m) => s + m.apuesta, 0);

// Lo que ve el jugador: sin el zapato y, mientras juega, sin la carta tapada del crupier.
export function vista(e) {
  if (!e || !e.manos) return null;
  const tapada = e.fase === 'jugando';
  return {
    fase: e.fase, activa: e.activa, acciones: acciones(e), mezclado: !!e.mezclado,
    manos: e.manos.map((m) => ({ cartas: m.cartas, apuesta: m.apuesta, doblada: m.doblada, valor: valor(m.cartas), resultado: m.resultado, premio: m.premio })),
    crupier: tapada ? [e.crupier[0], null] : e.crupier,
    valorCrupier: tapada ? valor([e.crupier[0]]) : valor(e.crupier),
    premio: e.premio ?? null, quedan: e.zapato.length - e.pos,
  };
}
