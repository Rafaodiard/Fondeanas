// Blackjack: la mano vive en el servidor; acá se reparten las cartas con animación a medida que llegan.
import { rango, palo, valor } from '../casino/blackjack.js';
import { selectorFichas, htmlFicha } from './fichas.js';

const PAUSA = 380; // ms entre carta y carta
const ROJO = new Set(['♥', '♦']);
const TEXTO = { blackjack: '¡Blackjack!', gana: 'Ganaste', empate: 'Empate', pierde: 'Perdiste', pasado: 'Te pasaste' };

function cartaHTML(c) {
  if (c == null) return '';
  const r = rango(c), p = palo(c);
  const centro = ['J', 'Q', 'K'].includes(r) ? `<span class="fig">${r}</span>` : r === 'A' ? `<span class="as">${p}</span>` : `<span class="pal">${p}</span>`;
  return `<span class="esq">${r}<br>${p}</span>${centro}<span class="esq abajo">${r}<br>${p}</span>`;
}

export function crearBlackjack(raiz, ctx) {
  raiz.innerHTML = `
    <div class="bj">
      <div class="mesa-bj">
        <div class="zapato" aria-hidden="true"></div>
        <div class="zona crupier"><div class="etq">Crupier <span class="val"></span></div><div class="cartas"></div></div>
        <div class="leyenda"><b>BLACKJACK PAGA 3 A 2</b><span>El crupier se planta en 17 · se dobla y se divide</span></div>
        <div class="zona jugador"><div class="manos"></div></div>
        <div class="cartel" aria-live="polite"></div>
      </div>
      <div class="controles">
        <div class="apostar">
          <div class="apuesta"><span class="lbl">Fichas</span><div class="fichas"></div></div>
          <div class="total">Apuesta <b class="tot"></b> <button type="button" class="borrar chico">Borrar</button></div>
          <button type="button" class="repartir primary">Repartir</button>
        </div>
        <div class="jugar hidden">
          <button type="button" data-a="pedir">Pedir</button>
          <button type="button" data-a="plantarse">Plantarse</button>
          <button type="button" data-a="doblar">Doblar</button>
          <button type="button" data-a="dividir">Dividir</button>
        </div>
      </div>
    </div>`;
  const $ = (s) => raiz.querySelector(s);
  const zonaD = $('.crupier .cartas'), valD = $('.crupier .val'), manosEl = $('.manos'), cartel = $('.cartel');
  const apostar = $('.apostar'), jugarEl = $('.jugar'), tot = $('.tot'), btnRepartir = $('.repartir');
  const fichas = selectorFichas($('.fichas'), [10, 25, 50, 100, 250], 25, (v) => sumar(v), ctx.sfx);
  let apuesta = 0, ultima = 0, ocupado = false, actual = null;
  // lo que está dibujado: cartas del crupier (null = tapada) y de cada mano
  let vis = { crupier: [], manos: [] };

  function pintarApuesta() {
    tot.innerHTML = apuesta ? `${ctx.MONEDA}${ctx.fmt(apuesta)}` : '—';
    btnRepartir.disabled = ocupado || apuesta < ctx.min;
    btnRepartir.textContent = apuesta ? 'Repartir' : 'Poné fichas';
  }
  function sumar(v) {
    if (ocupado || actual?.fase === 'jugando') return;
    if (apuesta + v > ctx.max) { ctx.aviso(`La apuesta máxima es ${ctx.max} pavos.`); return; }
    if (apuesta + v > ctx.saldo) { ctx.aviso('No te alcanzan los pavos.'); return; }
    apuesta += v; pintarApuesta();
  }
  $('.borrar').addEventListener('click', () => { if (!ocupado) { apuesta = 0; pintarApuesta(); } });

  // ---- dibujo
  function nuevaCarta(c, animar = true) {
    const el = document.createElement('div');
    el.className = `carta${c == null ? ' tapada' : ''}${c != null && ROJO.has(palo(c)) ? ' roja' : ''}${animar ? ' entra' : ''}`;
    el.innerHTML = `<div class="int"><div class="cara">${cartaHTML(c)}</div><div class="dorso"></div></div>`;
    if (animar) ctx.sfx.carta();
    return el;
  }
  function destapar(el, c) {
    el.classList.toggle('roja', ROJO.has(palo(c)));
    el.querySelector('.cara').innerHTML = cartaHTML(c);
    el.classList.remove('tapada');
    ctx.sfx.carta();
  }
  function manoEl(i) {
    let m = manosEl.children[i];
    if (!m) {
      m = document.createElement('div');
      m.className = 'mano';
      m.innerHTML = '<div class="cartas"></div><div class="info"><span class="val"></span><span class="apu"></span></div><div class="res"></div>';
      manosEl.appendChild(m);
    }
    return m;
  }
  function textoValor(cartas) {
    const vs = cartas.filter((c) => c != null);
    if (!vs.length) return '';
    const v = valor(vs);
    return v.blanda && v.total < 21 ? `${v.total - 10}/${v.total}` : String(v.total);
  }
  function pintarValores(v) {
    valD.textContent = textoValor(vis.crupier);
    vis.manos.forEach((cs, i) => {
      const m = manoEl(i), info = v?.manos[i];
      m.querySelector('.val').textContent = textoValor(cs);
      m.querySelector('.val').classList.toggle('pasado', valor(cs).total > 21);
      if (info) m.querySelector('.apu').innerHTML = `${htmlFicha(info.apuesta)}${info.doblada ? '<small>×2</small>' : ''}`;
    });
  }
  function limpiarMesa() {
    zonaD.innerHTML = ''; manosEl.innerHTML = ''; cartel.className = 'cartel'; cartel.innerHTML = '';
    vis = { crupier: [], manos: [] };
    valD.textContent = '';
  }
  const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

  // Lleva la mesa dibujada al estado v (vista del servidor), carta por carta.
  // nueva: es una mano recién repartida (se limpia la mesa y se reparte desde cero).
  async function aplicar(v, animar = true, nueva = false) {
    const pasos = [];
    const empieza = nueva || !vis.manos.length;
    if (empieza) {
      limpiarMesa();
      // reparto inicial: jugador, crupier, jugador, crupier
      vis.manos = [[]];
      manoEl(0);
      const p = v.manos[0].cartas, d = v.crupier;
      pasos.push(() => { vis.manos[0].push(p[0]); manoEl(0).querySelector('.cartas').appendChild(nuevaCarta(p[0], animar)); });
      pasos.push(() => { vis.crupier.push(d[0]); zonaD.appendChild(nuevaCarta(d[0], animar)); });
      pasos.push(() => { vis.manos[0].push(p[1]); manoEl(0).querySelector('.cartas').appendChild(nuevaCarta(p[1], animar)); });
      pasos.push(() => { vis.crupier.push(null); zonaD.appendChild(nuevaCarta(null, animar)); });
    } else if (v.manos.length > vis.manos.length) {
      // dividió: la segunda carta pasa a una mano nueva
      const segunda = vis.manos[0].pop();
      manoEl(0).querySelector('.cartas').lastElementChild.remove();
      vis.manos.push([segunda]);
      manoEl(1).querySelector('.cartas').appendChild(nuevaCarta(segunda, false));
      ctx.sfx.ficha();
    }
    // cartas nuevas de cada mano (después del reparto inicial)
    v.manos.forEach((m, i) => {
      for (let k = empieza && i === 0 ? 2 : (vis.manos[i] || []).length; k < m.cartas.length; k++) {
        const c = m.cartas[k];
        pasos.push(() => { (vis.manos[i] ||= []).push(c); manoEl(i).querySelector('.cartas').appendChild(nuevaCarta(c, animar)); });
      }
    });
    // el crupier destapa y pide
    if (v.crupier[1] != null) {
      pasos.push(() => {
        if (vis.crupier[1] === null) { vis.crupier[1] = v.crupier[1]; destapar(zonaD.children[1], v.crupier[1]); }
      });
      for (let k = 2; k < v.crupier.length; k++) {
        const c = v.crupier[k];
        pasos.push(() => { if (vis.crupier.length <= k) { vis.crupier.push(c); zonaD.appendChild(nuevaCarta(c, animar)); } });
      }
    }
    for (const paso of pasos) {
      paso();
      pintarValores(v);
      if (animar) await espera(PAUSA);
    }
    pintarValores(v);
    [...manosEl.children].forEach((m, i) => m.classList.toggle('activa', v.fase === 'jugando' && v.manos.length > 1 && i === v.activa));
    if (v.fase === 'terminada') mostrarResultado(v, animar);
  }

  function mostrarResultado(v, animar) {
    v.manos.forEach((m, i) => {
      const r = manoEl(i).querySelector('.res');
      r.className = `res ${m.resultado}`;
      r.innerHTML = `${TEXTO[m.resultado]}${m.premio > m.apuesta ? ` <b>+${ctx.fmt(m.premio)}</b>` : ''}`;
    });
    const premio = v.premio || 0, puesto = v.manos.reduce((s, m) => s + m.apuesta, 0);
    const neto = premio - puesto;
    cartel.className = `cartel visible ${neto > 0 ? 'gano' : neto < 0 ? 'perdio' : 'empate'}`;
    cartel.innerHTML = neto > 0 ? `Ganaste ${ctx.MONEDA}<b>${ctx.fmt(premio)}</b>` : neto < 0 ? (premio ? `Recuperás ${ctx.MONEDA}<b>${ctx.fmt(premio)}</b>` : 'Gana la casa') : 'Empate: se devuelve la apuesta';
    if (animar) { if (neto > 0) { ctx.sfx.ganar(v.manos.some((m) => m.resultado === 'blackjack')); ctx.sfx.monedas(); } else if (neto < 0) ctx.sfx.perder(); }
  }

  function pintarControles() {
    const jugando = actual?.fase === 'jugando';
    apostar.classList.toggle('hidden', jugando);
    jugarEl.classList.toggle('hidden', !jugando);
    jugarEl.querySelectorAll('[data-a]').forEach((b) => {
      const a = b.dataset.a, ok = !ocupado && jugando && actual.acciones.includes(a);
      b.disabled = !ok;
      b.classList.toggle('hidden', (a === 'doblar' || a === 'dividir') && !actual?.acciones.includes(a));
      if (a === 'doblar' || a === 'dividir') b.innerHTML = `${a === 'doblar' ? 'Doblar' : 'Dividir'} <small>+${ctx.fmt(actual?.manos[actual.activa]?.apuesta || 0)}</small>`;
    });
    pintarApuesta();
  }

  async function con(promesa, nueva = false) {
    ocupado = true; pintarControles();
    try {
      const r = await promesa;
      actual = r.mano;
      if (actual) await aplicar(actual, true, nueva);
    } catch (e) { ctx.aviso(e.message); }
    ocupado = false;
    if (actual?.fase === 'terminada') {
      // la próxima apuesta arranca igual que la anterior (si alcanza)
      apuesta = ultima <= ctx.saldo ? ultima : 0;
    }
    pintarControles();
  }

  btnRepartir.addEventListener('click', () => {
    if (ocupado || apuesta < ctx.min) return;
    ultima = apuesta;
    ctx.sfx.ficha();
    con(ctx.api('/api/casino/blackjack/repartir', { monto: apuesta }), true);
  });
  jugarEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (!b || b.disabled || ocupado) return;
    if (b.dataset.a === 'doblar' || b.dataset.a === 'dividir') ctx.sfx.ficha();
    con(ctx.api('/api/casino/blackjack/jugar', { accion: b.dataset.a }));
  });
  raiz.addEventListener('keydown', (e) => {
    const k = { KeyH: 'pedir', KeyS: 'plantarse', KeyD: 'doblar', KeyP: 'dividir' }[e.code];
    if (k) jugarEl.querySelector(`[data-a="${k}"]`)?.click();
    else if (e.code === 'Enter' && !apostar.classList.contains('hidden')) btnRepartir.click();
  });

  let cargado = false;
  return {
    raiz, get ocupado() { return ocupado; },
    async mostrar() {
      pintarControles();
      if (cargado) return;
      cargado = true;
      // si quedó una mano a medias (recargó la página o se cortó), se retoma tal cual
      try {
        const r = await ctx.api('/api/casino/blackjack');
        if (r.mano?.fase === 'jugando') { actual = r.mano; await aplicar(actual, false, true); }
      } catch { /* mesa vacía */ }
      pintarControles();
    },
  };
}
