// Tragamonedas: tres rodillos que giran y paran uno por uno en lo que decidió el servidor.
import { TIRA, SIMBOLOS, ORDEN, PAGA_DOS_COFRES, PAGA_UN_COFRE, retornoTeorico } from '../casino/slots.js';
import { ICONOS } from './iconos.js';
import { selectorFichas } from './fichas.js';

const COPIAS = 6; // la tira se repite para que el giro sea largo sin "saltos"

export function crearSlots(raiz, ctx) {
  const celda = (s) => `<div class="celda" data-s="${s}">${ICONOS[s]}</div>`;
  raiz.innerHTML = `
    <div class="slots">
      <div class="maquina">
        <div class="marquesina"><span>SALTO</span> <b>DE LA FORTUNA</b></div>
        <div class="luces">${'<i></i>'.repeat(18)}</div>
        <div class="ventana">
          ${[0, 1, 2].map(() => `<div class="rodillo"><div class="tira">${Array.from({ length: COPIAS }, () => TIRA.map(celda).join('')).join('')}</div></div>`).join('')}
          <div class="linea"></div>
        </div>
        <div class="pantallita" aria-live="polite"><span class="msg">Elegí tu apuesta y tirá de la palanca</span></div>
        <div class="controles">
          <div class="apuesta"><span class="lbl">Apuesta</span><div class="fichas"></div></div>
          <button type="button" class="girar primary">Girar</button>
        </div>
      </div>
      <aside class="pagos">
        <h3>Premios</h3>
        <ul>
          ${ORDEN.map((k) => `<li><span class="tres">${ICONOS[k]}${ICONOS[k]}${ICONOS[k]}</span><b>×${SIMBOLOS[k].paga3}</b></li>`).join('')}
          <li><span class="tres">${ICONOS.cofre}${ICONOS.cofre}<i>?</i></span><b>×${PAGA_DOS_COFRES}</b></li>
          <li><span class="tres">${ICONOS.cofre}<i>?</i><i>?</i></span><b>×${PAGA_UN_COFRE}</b></li>
        </ul>
        <p class="nota">Los cofres pagan en cualquier rodillo. Devuelve el ${(retornoTeorico() * 100).toFixed(1).replace('.', ',')} % de lo apostado.</p>
      </aside>
    </div>`;
  const $ = (s) => raiz.querySelector(s);
  const tiras = [...raiz.querySelectorAll('.tira')], rodillos = [...raiz.querySelectorAll('.rodillo')];
  const msg = $('.msg'), btn = $('.girar'), maquina = $('.maquina');
  const fichas = selectorFichas($('.fichas'), [10, 25, 50, 100, 250, 500], 25, null, ctx.sfx);
  let ocupado = false;
  // posición de cada rodillo (índice de la tira en el centro, dentro de la primera copia)
  const pos = [3, 9, 15];

  const alto = () => tiras[0].querySelector('.celda').getBoundingClientRect().height || 90;
  function ubicar(i, indice, animar, dur = 0) {
    const h = alto();
    // la ventana muestra tres celdas: la del índice va en el medio
    const y = -(indice - 1) * h;
    tiras[i].style.transition = animar ? `transform ${dur}s cubic-bezier(.12,.62,.18,1.02)` : 'none';
    tiras[i].style.transform = `translateY(${y}px)`;
  }
  function reubicar() { pos.forEach((p, i) => ubicar(i, p + TIRA.length, false)); }

  async function girar() {
    if (ocupado) return;
    const monto = fichas.valor;
    if (ctx.saldo < monto) { ctx.aviso('No te alcanzan los pavos para esa apuesta.'); return; }
    ocupado = true; btn.disabled = true;
    maquina.classList.remove('gano', 'gano-grande');
    raiz.querySelectorAll('.celda.brilla').forEach((c) => c.classList.remove('brilla'));
    msg.textContent = 'Girando…';
    ctx.sfx.girarRodillos();
    reubicar();
    let r;
    try { r = await ctx.api('/api/casino/slots', { monto }); }
    catch (e) { ctx.aviso(e.message); msg.textContent = 'Elegí tu apuesta y tirá de la palanca'; ocupado = false; btn.disabled = false; return; }
    const durs = [1.5, 2.05, 2.6];
    await new Promise((ok) => {
      tiras.forEach((t, i) => {
        void t.offsetHeight;
        // varias vueltas enteras y frena en la parada que mandó el servidor
        const destino = r.paradas[i] + TIRA.length * (COPIAS - 2);
        ubicar(i, destino, true, durs[i]);
        setTimeout(() => { ctx.sfx.rodillo(); rodillos[i].classList.add('frena'); setTimeout(() => rodillos[i].classList.remove('frena'), 180); if (i === 2) ok(); }, durs[i] * 1000 - 60);
      });
    });
    // vuelve a la primera copia de la tira (se ve igual) para que el próximo giro tenga lugar
    r.paradas.forEach((p, i) => { pos[i] = p; });
    reubicar();
    if (r.premio > 0) {
      const grande = r.mult >= 20;
      maquina.classList.add(grande ? 'gano-grande' : 'gano');
      // brillan los símbolos que pagaron
      const tres = r.rodillos[0] === r.rodillos[1] && r.rodillos[1] === r.rodillos[2];
      tiras.forEach((t, i) => {
        if (tres || r.rodillos[i] === 'cofre') t.querySelectorAll('.celda')[r.paradas[i] + TIRA.length].classList.add('brilla');
      });
      msg.innerHTML = r.mult === 1 ? `Te devuelve ${ctx.MONEDA}<b>${ctx.fmt(r.premio)}</b>` : `¡Ganaste ${ctx.MONEDA}<b>${ctx.fmt(r.premio)}</b>! <small>×${r.mult}</small>`;
      if (r.mult === 1) ctx.sfx.ficha(); else { ctx.sfx.ganar(grande); ctx.sfx.monedas(); }
    } else { msg.textContent = 'Nada esta vez. ¡Otra!'; }
    ocupado = false; btn.disabled = false;
  }
  btn.addEventListener('click', girar);
  raiz.addEventListener('keydown', (e) => { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); girar(); } });
  window.addEventListener('resize', () => { if (!ocupado) reubicar(); });

  return {
    raiz, get ocupado() { return ocupado; },
    mostrar() { requestAnimationFrame(reubicar); btn.focus({ preventScroll: true }); },
  };
}
