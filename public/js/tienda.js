// Reglas de la tienda de skins (compartidas: el servidor las aplica y el cliente las muestra). Sin dependencias del
// navegador ni de Node. Toda la plata es virtual: pavos del juego, sin compras reales.
//   - Tienda diaria rotativa estilo battle royale: 2 destacados + 6 diarios, cambia todos los días a las 00:00 (hora de
//     Buenos Aires). Cada cuenta tiene su propia rotación porque se puede volver a sortear (reroll) pagando pavos.
//   - Cajas estilo "cases": cada caja tiene su lista de skins y la probabilidad de cada rareza. Si sale una que ya
//     tenés, te devuelve pavos.
//   - Cara o cruz: apostás pavos, 50 % de duplicarlos.
//   - Contrato: entregás 5 skins de la misma rareza y recibís una de la rareza siguiente.
//   - Vender: devuelve una parte del precio.
import { SKINS, SKIN, PRECIOS, precio } from './skins.js';

export const PAVOS_INICIALES = 1000;
export const ZONA_HORARIA_MS = -3 * 3600 * 1000; // Buenos Aires (UTC-3, sin horario de verano)

export const TIENDA = { destacados: 2, diarios: 6, rerollBase: 100, rerollMax: 1600 };
export const VENTA = 0.4;          // vender devuelve el 40 % del precio
export const REPETIDA = 0.5;       // una skin repetida de una caja devuelve el 50 % de su precio
export const MONEDA = { min: 10, max: 2000 };
export const CONTRATO = { cantidad: 5 };
// Pavos por partida (los da el servidor al morir o al terminar la partida)
export const PREMIOS = { partida: 20, killPersona: 25, killBot: 10, victoria: 150, victoriaBots: 60, maxKills: 20 };

// Cajas: peso de cada rareza (Común … Legendaria) y qué skins entran.
export const CAJAS = [
  { id: 'recluta', nombre: 'Caja Recluta', precio: 300, pesos: [50, 30, 14, 5, 1], color: '#5ad65a',
    desc: 'De todo un poco. Ideal para arrancar.', filtro: (s) => true },
  { id: 'arsenal', nombre: 'Caja Arsenal', precio: 400, pesos: [30, 35, 22, 10, 3], color: '#3fa7ff',
    desc: 'Solo picos y envoltorios.', filtro: (s) => s.tipo === 'pico' || s.tipo === 'envoltorio' },
  { id: 'salvaje', nombre: 'Caja Salvaje', precio: 600, pesos: [0, 45, 33, 16, 6], color: '#b35cff',
    desc: 'Monstruos, animales y robots, con sus mochilas.', filtro: (s) => (s.tipo === 'personaje' && s.tag !== 'humano') || s.tipo === 'mochila' },
  { id: 'leyenda', nombre: 'Caja Leyenda', precio: 1200, pesos: [0, 0, 55, 33, 12], color: '#ffb02e',
    desc: 'Solo Raras, Épicas y Legendarias.', filtro: (s) => true },
];
export const CAJA = Object.fromEntries(CAJAS.map((c) => [c.id, c]));

// lo que puede salir en una caja (nunca las gratis)
export function poolCaja(caja) {
  return SKINS.filter((s) => !s.gratis && caja.filtro(s));
}
// probabilidad real de cada rareza (las rarezas sin skins en la caja no cuentan)
export function probabilidades(caja) {
  const pool = poolCaja(caja);
  const ws = caja.pesos.map((w, r) => (pool.some((s) => s.rareza === r) ? w : 0));
  const tot = ws.reduce((a, b) => a + b, 0);
  return ws.map((w) => w / tot);
}

export function elegirPeso(pesos, rand) {
  const tot = pesos.reduce((a, b) => a + b, 0);
  let x = rand() * tot;
  for (let i = 0; i < pesos.length; i++) { x -= pesos[i]; if (x < 0) return i; }
  return pesos.length - 1;
}

export function tirarCaja(caja, rand = Math.random) {
  const pool = poolCaja(caja);
  const r = elegirPeso(probabilidades(caja), rand);
  const deEsa = pool.filter((s) => s.rareza === r);
  return deEsa[Math.floor(rand() * deEsa.length)];
}

// Tira para la animación de la ruleta de la caja: N skins de relleno (al azar con los mismos pesos) y el premio en la
// posición `pos`. El premio lo decide tirarCaja; esto es solo para mostrar.
export function cintaCaja(caja, premio, n = 40, pos = 33, rand = Math.random) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(i === pos ? premio.id : tirarCaja(caja, rand).id);
  return out;
}

// ---------- Tienda diaria ----------
export function diaDe(ms) {
  return Math.floor((ms + ZONA_HORARIA_MS) / 86400000);
}
export function proximoCambio(ms) {
  return (diaDe(ms) + 1) * 86400000 - ZONA_HORARIA_MS;
}
export function costoReroll(usados) {
  return Math.min(TIENDA.rerollMax, TIENDA.rerollBase * 2 ** usados);
}

// generador con semilla (mulberry32) para que la rotación sea la misma si se vuelve a calcular
export function rng(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const PESOS_TIENDA = [30, 30, 22, 12, 6];
// Rotación del día: destacados (Épica o Legendaria, trajes/mochilas/picos) y diarios (cualquier cosa). Evita lo que ya
// tenés mientras alcance, y no repite.
export function rotacion(semilla, tiene = () => false) {
  const rand = rng(semilla);
  const usadas = new Set();
  const sacar = (filtro, pesos) => {
    for (const permitirTuyas of [false, true]) {
      const cand = SKINS.filter((s) => !s.gratis && !usadas.has(s.id) && filtro(s) && (permitirTuyas || !tiene(s.id)));
      if (!cand.length) continue;
      const rarezas = [0, 1, 2, 3, 4].map((r) => (cand.some((s) => s.rareza === r) ? pesos[r] : 0));
      const r = elegirPeso(rarezas, rand);
      const deEsa = cand.filter((s) => s.rareza === r);
      const s = deEsa[Math.floor(rand() * deEsa.length)];
      usadas.add(s.id);
      return s.id;
    }
    return null;
  };
  const destacados = [];
  // el primer destacado siempre es un traje
  destacados.push(sacar((s) => s.tipo === 'personaje' && s.rareza >= 3, [0, 0, 0, 60, 40]));
  for (let i = 1; i < TIENDA.destacados; i++) destacados.push(sacar((s) => ['personaje', 'mochila', 'pico'].includes(s.tipo) && s.rareza >= 3, [0, 0, 0, 60, 40]));
  const diarios = [];
  // al menos dos trajes en los diarios
  for (let i = 0; i < TIENDA.diarios; i++) diarios.push(sacar(i < 2 ? (s) => s.tipo === 'personaje' && s.rareza <= 2 : () => true, PESOS_TIENDA));
  return { destacados: destacados.filter(Boolean), diarios: diarios.filter(Boolean) };
}

// Contrato: la rareza de las 5 entregadas tiene que ser la misma y no Legendaria
export function contratoValido(ids) {
  if (!Array.isArray(ids) || ids.length !== CONTRATO.cantidad || new Set(ids).size !== ids.length) return null;
  const ss = ids.map((id) => SKIN[id]);
  if (ss.some((s) => !s || s.gratis)) return null;
  const r = ss[0].rareza;
  if (r >= 4 || ss.some((s) => s.rareza !== r)) return null;
  return r;
}
export function tirarContrato(rareza, tiene, rand = Math.random) {
  const cand = SKINS.filter((s) => !s.gratis && s.rareza === rareza + 1);
  const nuevas = cand.filter((s) => !tiene(s.id));
  const lista = nuevas.length ? nuevas : cand;
  return lista[Math.floor(rand() * lista.length)];
}

export const precioVenta = (s) => Math.floor(precio(s) * VENTA);
export const reintegroRepetida = (s) => Math.floor(precio(s) * REPETIDA);

// Pavos que gana alguien en una partida
export function premioPartida({ killsPersonas = 0, killsBots = 0, gano = false, contraPersonas = false }) {
  const k = Math.min(PREMIOS.maxKills, killsPersonas + killsBots);
  const kp = Math.min(killsPersonas, k), kb = k - kp;
  const detalle = { partida: PREMIOS.partida, kills: kp * PREMIOS.killPersona + kb * PREMIOS.killBot, victoria: gano ? (contraPersonas ? PREMIOS.victoria : PREMIOS.victoriaBots) : 0 };
  return { total: detalle.partida + detalle.kills + detalle.victoria, detalle };
}

export { PRECIOS };
