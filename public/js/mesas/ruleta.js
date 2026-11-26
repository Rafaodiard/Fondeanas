// Ruleta europea: paño para poner fichas y rueda dibujada en canvas. La bola cae donde dijo el servidor.
import { RUEDA, colorDe, TIPOS, MAX_FICHAS } from '../casino/ruleta.js';
import { selectorFichas, htmlFicha } from './fichas.js';

const N = RUEDA.length, PASO = (Math.PI * 2) / N;
const COLOR = { rojo: '#c8102e', negro: '#16161d', verde: '#0f8a3c' };

export function crearRuleta(raiz, ctx) {
  // ---- paño: 0, tres filas de 12 números, columnas, docenas y apuestas externas
  const celdas = [];
  celdas.push(`<button type="button" class="c cero verde" data-k="numero:0" style="grid-row:1/4;grid-column:1">0</button>`);
  for (let col = 0; col < 12; col++) for (let fila = 0; fila < 3; fila++) {
    const n = col * 3 + (3 - fila);
    celdas.push(`<button type="button" class="c ${colorDe(n)}" data-k="numero:${n}" style="grid-row:${fila + 1};grid-column:${col + 2}">${n}</button>`);
  }
  for (let fila = 0; fila < 3; fila++) celdas.push(`<button type="button" class="c ext" data-k="columna:${3 - fila}" style="grid-row:${fila + 1};grid-column:14" title="Columna: paga 2 a 1">2:1</button>`);
  ['1.ª 12', '2.ª 12', '3.ª 12'].forEach((t, i) => celdas.push(`<button type="button" class="c ext" data-k="docena:${i + 1}" style="grid-row:4;grid-column:${2 + i * 4}/span 4" title="Docena: paga 2 a 1">${t}</button>`));
  [['bajo', '1-18'], ['par', 'PAR'], ['rojo', '<i class="rombo rojo"></i>'], ['negro', '<i class="rombo negro"></i>'], ['impar', 'IMPAR'], ['alto', '19-36']]
    .forEach(([k, t], i) => celdas.push(`<button type="button" class="c ext" data-k="${k}" style="grid-row:5;grid-column:${2 + i * 2}/span 2" title="${TIPOS[k].nombre}: paga 1 a 1">${t}</button>`));

  raiz.innerHTML = `
    <div class="ruleta">
      <div class="rueda-lado">
        <canvas class="rueda" width="420" height="420" aria-label="Rueda de la ruleta"></canvas>
        <div class="resultado" aria-live="polite"></div>
        <div class="historial" title="Últimos números"></div>
      </div>
      <div class="pano-lado">
        <div class="pano-scroll"><div class="pano">${celdas.join('')}</div></div>
        <p class="ayuda">Clic para poner la ficha elegida · clic derecho saca las fichas de esa casilla · pleno paga 35 a 1</p>
        <div class="controles">
          <div class="apuesta"><span class="lbl">Ficha</span><div class="fichas"></div></div>
          <div class="total">Apuesta <b class="tot">0</b></div>
          <div class="botones">
            <button type="button" class="deshacer" title="Sacar la última ficha">Deshacer</button>
            <button type="button" class="borrar">Borrar</button>
            <button type="button" class="repetir" title="Volver a poner las fichas de la tirada anterior">Repetir</button>
            <button type="button" class="girar primary">Girar</button>
          </div>
        </div>
      </div>
    </div>`;
  const $ = (s) => raiz.querySelector(s);
  const canvas = $('.rueda'), g = canvas.getContext('2d');
  const pano = $('.pano'), tot = $('.tot'), res = $('.resultado'), hist = $('.historial');
  const btnGirar = $('.girar');
  const fichas = selectorFichas($('.fichas'), [5, 10, 25, 50, 100], 10, null, ctx.sfx);
  let apuestas = new Map(); // clave -> monto
  let pila = []; // claves en el orden en que se pusieron (para deshacer)
  let anterior = null;
  let ocupado = false;

  const total = () => [...apuestas.values()].reduce((a, b) => a + b, 0);
  function pintarFichas() {
    pano.querySelectorAll('.c').forEach((c) => {
      const m = apuestas.get(c.dataset.k);
      c.querySelector('.ficha')?.remove();
      if (m) c.insertAdjacentHTML('beforeend', htmlFicha(m, 'puesta'));
    });
    tot.innerHTML = `${ctx.MONEDA}${ctx.fmt(total())}`;
    btnGirar.disabled = ocupado || total() < ctx.min;
  }
  function poner(k, monto) {
    if (ocupado) return;
    if (!apuestas.has(k) && apuestas.size >= MAX_FICHAS) { ctx.aviso('Ya hay fichas en demasiadas casillas.'); return; }
    if (total() + monto > ctx.max) { ctx.aviso(`La apuesta máxima por tirada es ${ctx.max} pavos.`); return; }
    if (total() + monto > ctx.saldo) { ctx.aviso('No te alcanzan los pavos.'); return; }
    apuestas.set(k, (apuestas.get(k) || 0) + monto);
    pila.push([k, monto]);
    limpiarResultado();
    ctx.sfx.ficha();
    pintarFichas();
  }
  pano.addEventListener('click', (e) => { const c = e.target.closest('.c'); if (c) poner(c.dataset.k, fichas.valor); });
  pano.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const c = e.target.closest('.c');
    if (!c || ocupado || !apuestas.has(c.dataset.k)) return;
    apuestas.delete(c.dataset.k); pila = pila.filter(([k]) => k !== c.dataset.k);
    ctx.sfx.ficha(); pintarFichas();
  });
  $('.deshacer').addEventListener('click', () => {
    if (ocupado || !pila.length) return;
    const [k, m] = pila.pop();
    const q = apuestas.get(k) - m;
    if (q > 0) apuestas.set(k, q); else apuestas.delete(k);
    ctx.sfx.ficha(); pintarFichas();
  });
  $('.borrar').addEventListener('click', () => { if (ocupado) return; apuestas.clear(); pila = []; pintarFichas(); });
  $('.repetir').addEventListener('click', () => {
    if (ocupado || !anterior) return;
    apuestas.clear(); pila = [];
    for (const [k, m] of anterior) poner(k, m);
  });
  function limpiarResultado() {
    pano.querySelectorAll('.gana, .salio').forEach((c) => c.classList.remove('gana', 'salio'));
    res.classList.remove('visible', 'gano');
  }

  // ---- rueda
  let angRueda = 0, angBola = 0, radioBola = 1, bolaVisible = false, anim = null;
  function dibujar() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const lado = Math.round(canvas.clientWidth * dpr) || 420;
    if (canvas.width !== lado) { canvas.width = lado; canvas.height = lado; }
    const R = lado / 2;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, lado, lado);
    g.translate(R, R);
    // aro de madera
    let gr = g.createRadialGradient(0, 0, R * 0.7, 0, 0, R);
    gr.addColorStop(0, '#6b3a1a'); gr.addColorStop(0.6, '#8a4f24'); gr.addColorStop(0.9, '#4a240c'); gr.addColorStop(1, '#2a1406');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R * 0.99, 0, Math.PI * 2); g.fill();
    // pista de la bola
    gr = g.createRadialGradient(0, 0, R * 0.74, 0, 0, R * 0.88);
    gr.addColorStop(0, '#3b2414'); gr.addColorStop(1, '#5c3a20');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R * 0.88, 0, Math.PI * 2); g.fill();
    // casilleros
    g.save(); g.rotate(angRueda);
    const r1 = R * 0.74, r2 = R * 0.52, rn = R * 0.66;
    for (let i = 0; i < N; i++) {
      const a0 = i * PASO - PASO / 2 - Math.PI / 2, a1 = a0 + PASO;
      g.fillStyle = COLOR[colorDe(RUEDA[i])];
      g.beginPath(); g.arc(0, 0, r1, a0, a1); g.arc(0, 0, r2, a1, a0, true); g.closePath(); g.fill();
      g.strokeStyle = '#d9b25a'; g.lineWidth = Math.max(1, R * 0.006); g.stroke();
      g.save(); g.rotate(i * PASO); g.fillStyle = '#fff'; g.font = `700 ${Math.round(R * 0.075)}px system-ui, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(RUEDA[i]), 0, -rn); g.restore();
    }
    // cono del centro con rayos dorados
    gr = g.createRadialGradient(-R * 0.1, -R * 0.1, R * 0.05, 0, 0, r2);
    gr.addColorStop(0, '#c58a46'); gr.addColorStop(0.7, '#7a4520'); gr.addColorStop(1, '#4a240c');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#e8c56a'; g.lineWidth = R * 0.018; g.lineCap = 'round';
    for (let k = 0; k < 4; k++) { g.save(); g.rotate((k * Math.PI) / 2); g.beginPath(); g.moveTo(0, -R * 0.07); g.lineTo(0, -R * 0.3); g.stroke(); g.beginPath(); g.arc(0, -R * 0.33, R * 0.03, 0, Math.PI * 2); g.fillStyle = '#ffe08a'; g.fill(); g.restore(); }
    gr = g.createRadialGradient(-R * 0.02, -R * 0.03, 0, 0, 0, R * 0.09);
    gr.addColorStop(0, '#fff4c2'); gr.addColorStop(1, '#b8862e');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R * 0.085, 0, Math.PI * 2); g.fill();
    g.restore();
    // bola
    if (bolaVisible) {
      const rb = R * (0.6 + 0.22 * radioBola);
      const x = Math.sin(angBola) * rb, y = -Math.cos(angBola) * rb;
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(x + R * 0.008, y + R * 0.012, R * 0.032, 0, Math.PI * 2); g.fill();
      gr = g.createRadialGradient(x - R * 0.01, y - R * 0.012, R * 0.004, x, y, R * 0.032);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#b9bec9');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, R * 0.03, 0, Math.PI * 2); g.fill();
    }
  }

  // Gira la rueda y deja caer la bola en el número. Devuelve una promesa que termina cuando la bola para.
  function animar(numero) {
    return new Promise((ok) => {
      const idx = RUEDA.indexOf(numero);
      const T = 5200, t0 = performance.now();
      const w0 = angRueda, W = Math.PI * 2 * 1.6; // la rueda da 1,6 vueltas mientras frena
      const wFin = w0 + W;
      const b0 = Math.random() * Math.PI * 2;
      // la bola va al revés y termina en el casillero (mismo ángulo que el casillero en la rueda al final)
      const destino = wFin + idx * PASO;
      let B = b0 - destino; B = ((B % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); B += Math.PI * 2 * 4;
      bolaVisible = true;
      let ultimoCasillero = null;
      anim = (ahora) => {
        const k = Math.min(1, (ahora - t0) / T);
        const eR = 1 - (1 - k) ** 3, eB = 1 - (1 - k) ** 2.4;
        angRueda = w0 + W * eR;
        angBola = b0 - B * eB;
        // la bola baja de la pista a los casilleros en el último 35 %, con unos rebotes
        const caida = Math.max(0, (k - 0.62) / 0.38);
        radioBola = caida <= 0 ? 1 : Math.max(0, 1 - caida * 1.15) + Math.abs(Math.sin(caida * 9)) * 0.12 * (1 - caida);
        if (caida > 0) {
          const c = Math.floor((angBola - angRueda) / PASO);
          if (c !== ultimoCasillero) { ultimoCasillero = c; ctx.sfx.bola(1 - caida * 0.7); }
        }
        if (k >= 1) { anim = null; radioBola = 0; ok(); }
      };
    });
  }
  // la bola, una vez que cayó, gira con la rueda; la rueda sigue girando despacio siempre
  let ultimo = performance.now(), idxBola = null;
  function cuadro(ahora) {
    const dt = Math.min(0.05, (ahora - ultimo) / 1000); ultimo = ahora;
    if (!raiz.isConnected || raiz.closest('.hidden')) { requestAnimationFrame(cuadro); return; }
    if (anim) anim(ahora);
    else { angRueda += dt * 0.35; if (idxBola != null) angBola = angRueda + idxBola * PASO; }
    dibujar();
    requestAnimationFrame(cuadro);
  }
  requestAnimationFrame(cuadro);

  async function girar() {
    if (ocupado || total() < ctx.min) return;
    const lista = [...apuestas].map(([k, monto]) => {
      const [tipo, n] = k.split(':');
      return n === undefined ? { tipo, monto } : { tipo, n: +n, monto };
    });
    ocupado = true; pintarFichas(); limpiarResultado();
    idxBola = null;
    let r;
    try { r = await ctx.api('/api/casino/ruleta', { apuestas: lista }); }
    catch (e) { ctx.aviso(e.message); ocupado = false; pintarFichas(); return; }
    // el saldo ya bajó en el servidor: mostrar el descuento ahora y el premio al final
    await animar(r.numero);
    idxBola = RUEDA.indexOf(r.numero);
    ctx.sfx.bolaCae();
    const celda = pano.querySelector(`[data-k="numero:${r.numero}"]`);
    celda?.classList.add('salio');
    for (const k of r.ganadoras) pano.querySelector(`[data-k="${k}"]`)?.classList.add('gana');
    hist.insertAdjacentHTML('afterbegin', `<span class="${r.color}">${r.numero}</span>`);
    while (hist.children.length > 12) hist.lastElementChild.remove();
    const nombre = { rojo: 'Rojo', negro: 'Negro', verde: 'Verde' }[r.color];
    res.innerHTML = `<span class="num ${r.color}">${r.numero}</span><span class="txt">${nombre}${r.numero ? ` · ${r.numero % 2 ? 'Impar' : 'Par'}` : ''}</span>`
      + (r.premio ? `<span class="premio">+${ctx.MONEDA}${ctx.fmt(r.premio)}</span>` : '<span class="nada">Sin premio</span>');
    res.classList.add('visible'); res.classList.toggle('gano', r.premio > 0);
    if (r.premio) { ctx.sfx.ganar(r.premio >= r.apostado * 10); ctx.sfx.monedas(); } else ctx.sfx.perder();
    anterior = [...apuestas];
    // las fichas perdedoras se van; las ganadoras quedan marcadas hasta la próxima jugada
    setTimeout(() => { apuestas = new Map(); pila = []; ocupado = false; pintarFichas(); }, 1600);
  }
  btnGirar.addEventListener('click', girar);
  pintarFichas();

  return { raiz, get ocupado() { return ocupado; }, mostrar() { pintarFichas(); } };
}
