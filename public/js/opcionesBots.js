// Opciones de los bots que comparten el cliente (sala, menú, Configuración) y el servidor (servidor/bots.js).
// Los bots completan la sala hasta un total de jugadores: si hay 3 personas y el total es 12, entran 9 bots.

export const BOT_TOTALES = [0, 4, 8, 12, 16, 20, 24]; // 0 = sin bots
export const BOT_TOTAL_DEF = 12;                       // lo que usa "Jugar con bots" si no se eligió otro
export const BOT_MAX_TOTAL = 24;
export const BOT_DIFICULTADES = { facil: 'Fácil', normal: 'Normal', dificil: 'Difícil' };

export const totalValido = (n) => BOT_TOTALES.includes(n);
export const dificultadValida = (d) => Object.hasOwn(BOT_DIFICULTADES, d);
// Cuántos bots entran con `humanos` personas en la sala.
export const cuantosBots = (total, humanos) => (total > 0 ? Math.max(0, Math.min(BOT_MAX_TOTAL, total) - humanos) : 0);
