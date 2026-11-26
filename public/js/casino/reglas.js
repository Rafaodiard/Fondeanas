// Reglas generales del casino (compartidas por el servidor y el cliente). Se juega solo con pavos del juego.
export const APUESTA_MIN = 10;
export const APUESTA_MAX = 500;

export function montoValido(m) {
  return Number.isInteger(m) && m >= APUESTA_MIN && m <= APUESTA_MAX;
}
