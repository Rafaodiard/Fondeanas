// Tienda de skins y casillero. El catálogo (skins.js) está vacío por ahora: se ven los espacios con "Próximamente".
// Comprar y ponerse una skin ya funciona contra el servidor; cuando haya skins en el catálogo aparecen solas.
import { api, estado, fmt, MONEDA, alCambiarCuenta } from './cuenta.js';
import { SKINS, ESPACIOS_TIENDA, ESPACIOS_CASILLERO } from './skins.js';
import { RARITIES } from './items.js';

const SILUETA = '<svg viewBox="0 0 64 64" class="silueta" aria-hidden="true"><circle cx="32" cy="15" r="9"/><path d="M17 58l3-24c1-6 5-9 12-9s11 3 12 9l3 24z"/></svg>';

export function montarTienda({ raiz, sfx, alCambiarSkin }) {
  const $ = (s) => raiz.querySelector(s);
  const grilla = $('#tiendaGrilla'), saldo = $('#tiendaSaldo'), titulo = $('#tiendaTitulo'), sub = $('#tiendaSub');
  let modo = 'tienda', datos = { catalogo: SKINS, compradas: [], puesta: null };
  const pintarSaldo = () => { saldo.innerHTML = `${MONEDA}<b>${fmt(estado.cuenta?.pavos ?? 0)}</b>`; };
  alCambiarCuenta(pintarSaldo);

  function tarjetaSkin(s) {
    const r = RARITIES[s.rareza] || RARITIES[0];
    const tiene = datos.compradas.includes(s.id), puesta = datos.puesta === s.id;
    const accion = modo === 'tienda'
      ? (tiene ? '<span class="estado">Ya la tenés</span>' : `<button type="button" class="comprar" data-id="${s.id}">${MONEDA}${fmt(s.precio)}</button>`)
      : (puesta ? '<span class="estado">Puesta</span>' : `<button type="button" class="poner" data-id="${s.id}">Ponérmela</button>`);
    return `<div class="espacio skin" style="--rar:${r.color}"><div class="vista" style="--ropa:${s.ropa}">${SILUETA}</div><b>${s.nombre}</b><small>${r.name}</small>${accion}</div>`;
  }
  const vacio = (txt = 'Próximamente') => `<div class="espacio vacio">${SILUETA}<span>${txt}</span></div>`;

  function pintar() {
    const lista = modo === 'tienda' ? datos.catalogo : datos.catalogo.filter((s) => datos.compradas.includes(s.id));
    const total = Math.max(modo === 'tienda' ? ESPACIOS_TIENDA : ESPACIOS_CASILLERO, lista.length + (modo === 'casillero' ? 1 : 0));
    const celdas = [];
    if (modo === 'casillero') {
      celdas.push(`<div class="espacio skin defecto${datos.puesta ? '' : ' elegida'}"><div class="vista" style="--ropa:#3fa7ff">${SILUETA}</div><b>De fábrica</b><small>Color de la sala</small>${datos.puesta ? '<button type="button" class="poner" data-id="">Ponérmela</button>' : '<span class="estado">Puesta</span>'}</div>`);
    }
    for (const s of lista) celdas.push(tarjetaSkin(s));
    while (celdas.length < total) celdas.push(vacio(modo === 'tienda' ? 'Próximamente' : 'Vacío'));
    grilla.innerHTML = celdas.join('');
    titulo.textContent = modo === 'tienda' ? 'Tienda' : 'Casillero';
    sub.textContent = modo === 'tienda'
      ? (datos.catalogo.length ? 'Comprá skins con tus pavos.' : 'Todavía no hay skins a la venta. ¡Muy pronto!')
      : 'Elegí con qué skin entrás a las partidas.';
    raiz.querySelectorAll('[data-modo-tienda]').forEach((b) => b.classList.toggle('activo', b.dataset.modoTienda === modo));
  }

  grilla.addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-id]');
    if (!b) return;
    b.disabled = true;
    try {
      if (b.classList.contains('comprar')) { datos = await api('/api/tienda/comprar', { skin: b.dataset.id }); sfx.monedas(); }
      else { datos = await api('/api/casillero/poner', { skin: b.dataset.id || null }); sfx.click(); if (estado.cuenta) estado.cuenta.skin = datos.puesta; alCambiarSkin?.(datos.puesta); }
    } catch (err) { $('#tiendaAviso').textContent = err.message; setTimeout(() => { $('#tiendaAviso').textContent = ''; }, 2600); }
    pintar();
  });
  raiz.querySelectorAll('[data-modo-tienda]').forEach((b) => b.addEventListener('click', () => { sfx.click(); modo = b.dataset.modoTienda; pintar(); }));
  let alCerrar = null;
  const cerrar = () => { raiz.classList.add('hidden'); alCerrar?.(); };
  $('#tiendaCerrar').addEventListener('click', cerrar);
  window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && !raiz.classList.contains('hidden')) cerrar(); });

  return {
    async abrir(enModo = 'tienda', cuandoCierra = null) {
      modo = enModo; alCerrar = cuandoCierra;
      pintarSaldo(); pintar();
      raiz.classList.remove('hidden');
      try { datos = await api('/api/tienda'); } catch { /* se queda con el catálogo local */ }
      pintar();
    },
  };
}
