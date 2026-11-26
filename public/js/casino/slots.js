// Tragamonedas de 3 rodillos con símbolos del juego. Compartido: el servidor gira, el cliente anima.
// La tabla está calculada para devolver el 95,4 % de lo apostado (tools/casino/pruebas.mjs lo revisa exacto y simulado).
import { montoValido } from './reglas.js';

// peso: cuántas veces aparece en cada rodillo (de 23). paga3: cuánto devuelve por pavo con tres iguales.
export const SIMBOLOS = {
  bus: { nombre: 'Bus volador', peso: 1, paga3: 500, color: '#ffd23f' },
  cohete: { nombre: 'Cohete', peso: 2, paga3: 100, color: '#ff5a5f' },
  cofre: { nombre: 'Cofre', peso: 2, paga3: 50, color: '#ff9f1c' },
  paracaidas: { nombre: 'Paracaídas', peso: 4, paga3: 20, color: '#c77dff' },
  pico: { nombre: 'Pico', peso: 6, paga3: 10, color: '#3fa7ff' },
  escudo: { nombre: 'Escudo', peso: 8, paga3: 5, color: '#5ad65a' },
};
export const ORDEN = Object.keys(SIMBOLOS);
// Sin tres iguales: dos cofres en cualquier lugar pagan 5 y uno solo devuelve la apuesta.
export const PAGA_DOS_COFRES = 5;
export const PAGA_UN_COFRE = 1;
const TOTAL = ORDEN.reduce((s, k) => s + SIMBOLOS[k].peso, 0);
// Tira de cada rodillo: cada símbolo repetido según su peso, mezclados (la misma para los tres, el cliente la dibuja).
export const TIRA = (() => {
  const t = [];
  const quedan = Object.fromEntries(ORDEN.map((k) => [k, SIMBOLOS[k].peso]));
  while (t.length < TOTAL) for (const k of ORDEN) if (quedan[k]-- > 0) t.push(k);
  return t;
})();

// Multiplicador de una combinación de tres símbolos.
export function multiplicador(r) {
  if (r[0] === r[1] && r[1] === r[2]) return SIMBOLOS[r[0]].paga3;
  const cofres = r.filter((s) => s === 'cofre').length;
  return cofres === 2 ? PAGA_DOS_COFRES : cofres === 1 ? PAGA_UN_COFRE : 0;
}

// azar(n) → entero en [0, n). Devuelve las posiciones de la tira donde para cada rodillo, los símbolos y el premio.
export function girar(monto, azar) {
  if (!montoValido(monto)) throw new Error('monto');
  const paradas = [azar(TOTAL), azar(TOTAL), azar(TOTAL)];
  const rodillos = paradas.map((p) => TIRA[p]);
  const mult = multiplicador(rodillos);
  return { paradas, rodillos, mult, premio: monto * mult };
}

// Retorno exacto de la tabla (para las pruebas y para mostrarlo en la máquina).
export function retornoTeorico() {
  let r = 0;
  for (const a of ORDEN) for (const b of ORDEN) for (const c of ORDEN) {
    r += (SIMBOLOS[a].peso * SIMBOLOS[b].peso * SIMBOLOS[c].peso) / TOTAL ** 3 * multiplicador([a, b, c]);
  }
  return r;
}
