// Casino: panel encima del lobby con tres juegos (cada uno contra la casa). El servidor tira la bola, reparte y
// gira; acá solo se anima. Las mesas están en public/js/mesas/.
import { api, estado, fmt, MONEDA, alCambiarCuenta } from './cuenta.js';
import { crearRuleta } from './mesas/ruleta.js';
import { crearBlackjack } from './mesas/blackjack.js';
import { crearSlots } from './mesas/slots.js';

export { FICHAS, htmlFicha, selectorFichas } from './mesas/fichas.js';

export function montarCasino({ raiz, sfx }) {
  const $ = (s) => raiz.querySelector(s);
  const saldo = $('#casinoSaldo'), aviso = $('#casinoAviso');
  let avisoT = 0;
  const ctx = {
    api, sfx, fmt, MONEDA,
    get saldo() { return estado.cuenta?.pavos ?? 0; },
    get min() { return estado.casino.min; }, get max() { return estado.casino.max; },
    aviso(msg, tipo = 'error') {
      aviso.textContent = msg; aviso.className = `casino-aviso ${tipo} visible`;
      clearTimeout(avisoT); avisoT = setTimeout(() => aviso.classList.remove('visible'), 2600);
    },
  };
  const mesas = {
    ruleta: crearRuleta($('#mesaRuleta'), ctx),
    blackjack: crearBlackjack($('#mesaBlackjack'), ctx),
    slots: crearSlots($('#mesaSlots'), ctx),
  };
  let actual = null;
  const pintarSaldo = () => { saldo.innerHTML = `${MONEDA}<b>${fmt(ctx.saldo)}</b>`; };
  alCambiarCuenta(pintarSaldo);

  function elegir(j) {
    if (actual === j) return;
    if (actual && mesas[actual].ocupado) { ctx.aviso('Esperá a que termine la jugada.'); return; }
    actual = j;
    raiz.querySelectorAll('[data-juego]').forEach((b) => b.classList.toggle('activo', b.dataset.juego === j));
    for (const [k, m] of Object.entries(mesas)) { m.raiz.classList.toggle('hidden', k !== j); if (k === j) m.mostrar(); }
  }
  raiz.querySelectorAll('[data-juego]').forEach((b) => b.addEventListener('click', () => { sfx.click(); elegir(b.dataset.juego); }));

  let alCerrar = null;
  function cerrar() {
    if (actual && mesas[actual].ocupado) { ctx.aviso('Esperá a que termine la jugada.'); return; }
    raiz.classList.add('hidden');
    alCerrar?.();
  }
  $('#casinoCerrar').addEventListener('click', cerrar);
  window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && !raiz.classList.contains('hidden')) cerrar(); });

  return {
    abrir(juego = 'ruleta', cuandoCierra = null) {
      alCerrar = cuandoCierra;
      pintarSaldo();
      raiz.classList.remove('hidden');
      actual = null;
      elegir(juego);
    },
    get abierto() { return !raiz.classList.contains('hidden'); },
    mesas,
  };
}
