// Ruleta europea (un solo 0). Compartida: el servidor tira la bola, el cliente dibuja el paño y la rueda.
import { APUESTA_MIN, APUESTA_MAX } from './reglas.js';

// Orden real de los números en la rueda, en sentido horario empezando por el 0.
export const RUEDA = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
export const ROJOS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const colorDe = (n) => (n === 0 ? 'verde' : ROJOS.has(n) ? 'rojo' : 'negro');
export const MAX_FICHAS = 40; // apuestas distintas por tirada

// Tipos de apuesta: cuánto devuelve en total por cada pavo apostado si gana (apuesta incluida).
export const TIPOS = {
  numero: { nombre: 'Pleno', paga: 36, gana: (a, n) => n === a.n },
  rojo: { nombre: 'Rojo', paga: 2, gana: (a, n) => ROJOS.has(n) },
  negro: { nombre: 'Negro', paga: 2, gana: (a, n) => n !== 0 && !ROJOS.has(n) },
  par: { nombre: 'Par', paga: 2, gana: (a, n) => n !== 0 && n % 2 === 0 },
  impar: { nombre: 'Impar', paga: 2, gana: (a, n) => n % 2 === 1 },
  bajo: { nombre: '1 a 18', paga: 2, gana: (a, n) => n >= 1 && n <= 18 },
  alto: { nombre: '19 a 36', paga: 2, gana: (a, n) => n >= 19 },
  docena: { nombre: 'Docena', paga: 3, gana: (a, n) => n !== 0 && Math.ceil(n / 12) === a.n },
  columna: { nombre: 'Columna', paga: 3, gana: (a, n) => n !== 0 && ((n - 1) % 3) + 1 === a.n },
};

// Clave única de una apuesta (para juntar fichas en la misma casilla).
const CON_NUMERO = new Set(['numero', 'docena', 'columna']);
export const claveApuesta = (a) => (CON_NUMERO.has(a.tipo) ? `${a.tipo}:${a.n}` : a.tipo);

// Revisa y normaliza la lista de apuestas. Devuelve { apuestas, total } o { error }.
export function validarApuestas(lista) {
  if (!Array.isArray(lista) || lista.length === 0) return { error: 'Poné al menos una ficha.' };
  if (lista.length > MAX_FICHAS) return { error: 'Demasiadas apuestas en una tirada.' };
  const junt = new Map();
  for (const a of lista) {
    if (!a || typeof a !== 'object' || !TIPOS[a.tipo]) return { error: 'Apuesta inválida.' };
    if (!Number.isInteger(a.monto) || a.monto < 1) return { error: 'Monto inválido.' };
    if (a.tipo === 'numero' && !(Number.isInteger(a.n) && a.n >= 0 && a.n <= 36)) return { error: 'Número inválido.' };
    if ((a.tipo === 'docena' || a.tipo === 'columna') && !(Number.isInteger(a.n) && a.n >= 1 && a.n <= 3)) return { error: 'Apuesta inválida.' };
    const limpia = { tipo: a.tipo, monto: a.monto };
    if (CON_NUMERO.has(a.tipo)) limpia.n = a.n;
    const k = claveApuesta(limpia);
    if (junt.has(k)) junt.get(k).monto += limpia.monto; else junt.set(k, limpia);
  }
  const apuestas = [...junt.values()];
  const total = apuestas.reduce((s, a) => s + a.monto, 0);
  if (total < APUESTA_MIN) return { error: `La apuesta mínima es ${APUESTA_MIN} pavos.` };
  if (total > APUESTA_MAX) return { error: `La apuesta máxima por tirada es ${APUESTA_MAX} pavos.` };
  return { apuestas, total };
}

// Resultado de una tirada ya validada. azar(n) devuelve un entero en [0, n).
export function tirar(apuestas, azar) {
  const numero = azar(37);
  return { numero, color: colorDe(numero), ...liquidar(apuestas, numero) };
}

export function liquidar(apuestas, numero) {
  let premio = 0;
  const ganadoras = [];
  for (const a of apuestas) {
    if (TIPOS[a.tipo].gana(a, numero)) { premio += a.monto * TIPOS[a.tipo].paga; ganadoras.push(claveApuesta(a)); }
  }
  return { premio, ganadoras };
}
