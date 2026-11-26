// Anuncios con premio (+500 pavos): ESPACIO LISTO, TODAVÍA SIN ACTIVAR.
// El botón del lobby existe y muestra "Próximamente" mientras disponible() sea false.
// Para activarlo (ver también server/premios.js):
//  1. Cargar el SDK del proveedor elegido (AdSense H5 Games Ads, CrazyGames, Poki...) en index.html.
//  2. Hacer que disponible() devuelva true cuando el SDK cargó y hay un anuncio para mostrar.
//  3. Implementar mostrarAnuncioConPremio(): pedir el token a POST /api/anuncio/empezar, mostrar el anuncio
//     y, si se vio entero, mandar POST /api/anuncio/terminar {token}. El servidor paga y devuelve el saldo nuevo.

export const PAVOS_POR_ANUNCIO = 500;

export function disponible() {
  return false;
}

/** @returns {Promise<'completo'|'cancelado'|'sin-anuncio'>} */
export async function mostrarAnuncioConPremio() {
  return 'sin-anuncio';
}
