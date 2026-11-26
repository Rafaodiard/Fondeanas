// Pavos que se ganan jugando: por eliminación (activo) y por ver un anuncio (espacio listo, sin activar).
export const PAVOS_POR_KILL = 100;
export const TOPE_KILLS_24H = 2000; // pavos por eliminaciones en las últimas 24 horas, por cuenta
export const MIN_JUGADORES = 2; // la partida tiene que haber empezado con al menos 2 jugadores

// ----- Anuncios con premio: TODAVÍA NO SE USA -----
// Queda armado el lugar (tabla `anuncios` en db.js, la interfaz public/js/anuncios.js y estos valores). Para activarlo:
//  1. Elegir el proveedor (AdSense H5 Games Ads, CrazyGames, Poki...) y revisar que acepte un juego con casino de moneda ficticia.
//  2. POST /api/anuncio/empezar → crea una fila en `anuncios` con un token aleatorio y la hora.
//  3. POST /api/anuncio/terminar {token} → paga PAVOS_POR_ANUNCIO con mover(uid, +500, 'anuncio') si el token es de esa
//     cuenta y no se usó, pasaron al menos ANUNCIO_MIN_SEG, no se pasó ANUNCIOS_POR_DIA y se respetó ANUNCIO_ESPERA_SEG.
//  4. Implementar mostrarAnuncioConPremio() en public/js/anuncios.js con el SDK del proveedor.
export const PAVOS_POR_ANUNCIO = 500;
export const ANUNCIOS_POR_DIA = 5;
export const ANUNCIO_ESPERA_SEG = 120;
export const ANUNCIO_MIN_SEG = 15;

export function crearPremios(base) {
  const q = {
    ganado: base.db.prepare("SELECT COALESCE(SUM(delta), 0) AS s FROM movimientos WHERE usuario_id = ? AND motivo = 'kill' AND fecha > ?"),
  };
  const ganadoKills = (uid) => q.ganado.get(uid, Date.now() - 864e5).s;

  // killer / victim: jugadores de la sala ({ cuenta: {id} | null, ip }). jugadoresAlEmpezar: cuántos había al arrancar.
  // Devuelve { delta, saldo } si se pagó algo, o { delta: 0, motivo } si no corresponde.
  function pagarKill(killer, victim, jugadoresAlEmpezar) {
    if (!killer?.cuenta) return { delta: 0, motivo: 'invitado' };
    if (!victim || victim === killer || victim.cuenta?.id === killer.cuenta.id) return { delta: 0, motivo: 'uno_mismo' };
    if ((jugadoresAlEmpezar || 0) < MIN_JUGADORES) return { delta: 0, motivo: 'solo' };
    // un invitado de la misma conexión se puede abrir sin límite en otra pestaña: no paga
    if (!victim.cuenta && victim.ip && victim.ip === killer.ip) return { delta: 0, motivo: 'misma_ip' };
    const delta = Math.min(PAVOS_POR_KILL, TOPE_KILLS_24H - ganadoKills(killer.cuenta.id));
    if (delta <= 0) return { delta: 0, motivo: 'tope' };
    const saldo = base.mover(killer.cuenta.id, delta, 'kill', { victima: victim.cuenta?.usuario || null });
    return { delta, saldo };
  }

  return { pagarKill, ganadoKills };
}
