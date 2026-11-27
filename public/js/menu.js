// Menú principal con cuentas: entrar / crear cuenta / invitado, pavos, tienda diaria con reroll, casillero (equipar y
// vender), cajas con ruleta, apuestas (cara o cruz y contrato) y el panel de la cuenta admin.
// Todo lo que cambia pavos o skins lo decide el servidor (servidor/api.js + servidor/cuentas.js): acá solo se muestra.
//   iniciarMenu()            arma todo (después de loadAssets)
//   sesion.token / .cuenta   para mandar el token al entrar a una sala
//   ponerCuenta(c)           cuando el servidor avisa por WebSocket que cambió la cuenta
//   avisoPavos(m)            cartel "+N pavos" al terminar la partida
//   abrirSobreSala()         abre el casillero arriba de la sala de espera
import { SKINS, SKIN, RAREZAS, TIPOS, ORDEN_TIPOS, OPCIONALES, EQUIPO_INICIAL, precio, vendible } from './skins.js';
import { CAJAS, CAJA, probabilidades, poolCaja, MONEDA, CONTRATO, precioVenta } from './tienda.js';
import { crearVitrina } from './vitrina.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n || 0).toLocaleString('es-AR');
function guardado(k, v) {
  try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* sin almacenamiento */ }
  return null;
}

let token = guardado('sf-token') || '';
let cuenta = null;
let vitrina = null;
let pestana = 'jugar';
let seleccion = null;      // id de la skin elegida (se prueba en la vitrina)
let tipoCasillero = 'personaje';
let elegidasContrato = [];
let adminSel = null;
let colorJugador = '#ff5a5f';
export const sesion = { get token() { return token; }, get cuenta() { return cuenta; } };
const oyentes = [];
export function alCambiarCuenta(fn) { oyentes.push(fn); }

// ---------- API ----------
async function api(ruta, cuerpo, { diferir = false } = {}) {
  let j;
  try {
    const r = await fetch(`/api/${ruta}`, {
      method: cuerpo === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    try { j = await r.json(); } catch { j = { ok: false, error: r.status === 404 ? 'El servidor no tiene cuentas: reinicialo con npm start.' : 'El servidor no respondió bien.' }; }
    if (r.status === 401 && token && ruta !== 'entrar' && ruta !== 'registro') { salirLocal(); j.error = 'Se venció la sesión. Volvé a entrar.'; }
  } catch {
    j = { ok: false, error: 'No se pudo conectar con el servidor.' };
  }
  if (j.cuenta && !diferir) ponerCuenta(j.cuenta);
  return j;
}

// ---------- cuenta ----------
export function ponerCuenta(c) {
  const antes = cuenta;
  cuenta = c;
  const pav = $('mPavos');
  pav.classList.toggle('hidden', !c);
  $('btnCuenta').textContent = c ? c.usuario : 'Entrar';
  $('btnCuenta').classList.toggle('logueado', !!c);
  document.querySelector('[data-p="admin"]').classList.toggle('hidden', !c?.admin);
  const nombre = $('name');
  if (c) { nombre.value = c.usuario; nombre.readOnly = true; nombre.title = 'Jugás con el nombre de tu cuenta'; } else { nombre.readOnly = false; nombre.title = ''; }
  if (c) contarPavos(antes ? antes.pavos : c.pavos, c.pavos);
  if (!antes || !c || JSON.stringify(antes.equipo) !== JSON.stringify(c.equipo)) vitrina?.mostrar(c ? c.equipo : EQUIPO_INICIAL, colorJugador);
  if (!c && pestana === 'admin') abrir('jugar');
  dibujar();
  for (const f of oyentes) f(c);
}

let animPavos = 0;
function contarPavos(de, a) {
  const b = $('mPavos').querySelector('b');
  cancelAnimationFrame(animPavos);
  if (de === a) { b.textContent = fmt(a); return; }
  $('mPavos').classList.remove('sube', 'baja');
  void $('mPavos').offsetWidth;
  $('mPavos').classList.add(a > de ? 'sube' : 'baja');
  const t0 = performance.now(), dur = 700;
  const paso = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    b.textContent = fmt(Math.round(de + (a - de) * (1 - (1 - k) ** 3)));
    if (k < 1) animPavos = requestAnimationFrame(paso);
  };
  animPavos = requestAnimationFrame(paso);
}

function salirLocal() {
  token = '';
  guardado('sf-token', null);
  ponerCuenta(null);
}

// ---------- entrar / crear cuenta ----------
function mostrarLogin(modo = 'entrar') {
  $('login').classList.remove('hidden');
  $('lgError').textContent = '';
  $('login').dataset.modo = modo;
  $('lgTitulo').textContent = modo === 'crear' ? 'Crear cuenta' : 'Entrar';
  $('lgOk').textContent = modo === 'crear' ? 'Crear cuenta' : 'Entrar';
  $('lgCambiar').innerHTML = modo === 'crear' ? '¿Ya tenés cuenta? <b>Entrar</b>' : '¿No tenés cuenta? <b>Creá una</b> y arrancás con 1.000 pavos';
  setTimeout(() => $('lgUsuario').focus(), 30);
}
async function enviarLogin(e) {
  e?.preventDefault();
  const modo = $('login').dataset.modo;
  const usuario = $('lgUsuario').value.trim(), clave = $('lgClave').value;
  $('lgError').textContent = '';
  $('lgOk').disabled = true;
  const j = await api(modo === 'crear' ? 'registro' : 'entrar', { usuario, clave });
  $('lgOk').disabled = false;
  if (!j.ok) { $('lgError').textContent = j.error || 'No se pudo.'; return; }
  token = j.token;
  guardado('sf-token', token);
  $('lgClave').value = '';
  $('login').classList.add('hidden');
  if (modo === 'crear') avisar(`¡Bienvenido, ${j.cuenta.usuario}! Arrancás con ${fmt(j.cuenta.pavos)} pavos.`);
}

// ---------- popover de la cuenta ----------
function menuCuenta() {
  const m = $('cuentaMenu');
  if (!cuenta) { mostrarLogin('entrar'); return; }
  if (!m.classList.contains('hidden')) { m.classList.add('hidden'); return; }
  const st = cuenta.stats || {};
  m.innerHTML = `
    <div class="cm-cab"><b>${esc(cuenta.usuario)}</b>${cuenta.admin ? '<span class="chip admin">ADMIN</span>' : ''}</div>
    <div class="cm-stats"><span><b>${fmt(st.partidas)}</b>partidas</span><span><b>${fmt(st.victorias)}</b>victorias</span><span><b>${fmt(st.kills)}</b>eliminaciones</span><span><b>${fmt(st.ganados)}</b>pavos ganados</span></div>
    <div class="cm-hist">${(cuenta.historial || []).map((h) => `<div><span>${esc(h.texto)}</span>${h.pavos ? `<b class="${h.pavos > 0 ? 'mas' : 'menos'}">${h.pavos > 0 ? '+' : ''}${fmt(h.pavos)}</b>` : ''}</div>`).join('') || '<div>Sin movimientos todavía.</div>'}</div>
    <button id="cmSalir" class="chico">Cerrar sesión</button>`;
  m.classList.remove('hidden');
  $('cmSalir').onclick = async () => { await api('salir', {}); salirLocal(); m.classList.add('hidden'); };
}

// ---------- pestañas ----------
function abrir(p) {
  pestana = p;
  for (const b of document.querySelectorAll('#pestanas [data-p]')) b.classList.toggle('on', b.dataset.p === p);
  for (const s of document.querySelectorAll('#menu .pest')) s.classList.toggle('hidden', s.id !== `p-${p}`);
  elegir(null);
  dibujar();
}

function dibujar() {
  const f = { tienda: dibujarTienda, casillero: dibujarCasillero, cajas: dibujarCajas, apuestas: dibujarApuestas, admin: dibujarAdmin }[pestana];
  if (f) f($(`p-${pestana}`));
  dibujarDetalle();
}

function sinCuenta(el, que) {
  el.innerHTML = `<div class="m-vacio"><div class="m-vacio-ico">🔒</div><p>Para ${que} necesitás una cuenta.</p><p class="hint">Con cuenta arrancás con 1.000 pavos y ganás más jugando partidas.</p>
    <div class="row"><button class="primary" data-login="crear">Crear cuenta</button><button data-login="entrar">Entrar</button></div></div>`;
  for (const b of el.querySelectorAll('[data-login]')) b.onclick = () => mostrarLogin(b.dataset.login);
}

// ---------- tarjetas de skins ----------
function tarjeta(id, { pie = '', clase = '', marca = '' } = {}) {
  const s = SKIN[id];
  const r = RAREZAS[s.rareza];
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `tarjeta r${s.rareza} ${clase}`;
  el.style.setProperty('--r', r.color);
  el.dataset.id = id;
  el.innerHTML = `<div class="t-foto"><img alt=""></div>${marca ? `<span class="t-marca">${marca}</span>` : ''}
    <div class="t-info"><b>${esc(s.nombre)}</b><small>${TIPOS[s.tipo].uno} · ${r.name}</small>${pie}</div>`;
  const img = el.querySelector('img');
  vitrina?.foto(id).then((url) => { if (url) { img.src = url; img.classList.add('lista'); } });
  el.onclick = () => elegir(id);
  if (seleccion === id) el.classList.add('sel');
  return el;
}
const tiene = (id) => !!cuenta && cuenta.skins.includes(id);
const precioHtml = (n) => `<span class="precio"><i class="pavo"></i>${fmt(n)}</span>`;

function elegir(id) {
  seleccion = id;
  for (const t of document.querySelectorAll('#menu .tarjeta')) t.classList.toggle('sel', t.dataset.id === id);
  if (id) vitrina?.probar(id); else vitrina?.soltar();
  dibujarDetalle();
}

// panel debajo de la vitrina: qué es la skin elegida y qué se puede hacer con ella
function dibujarDetalle() {
  const d = $('detalle');
  const s = seleccion && SKIN[seleccion];
  if (!s) {
    d.innerHTML = cuenta ? `<p class="hint">Arrastrá para girar. Tocá una skin para probártela.</p>` : `<p class="hint">Jugás como invitado: con cuenta tenés pavos, tienda y skins.</p>`;
    return;
  }
  const r = RAREZAS[s.rareza];
  const mia = tiene(s.id), puesta = cuenta?.equipo?.[s.tipo] === s.id;
  const enTienda = cuenta && [...cuenta.tienda.destacados, ...cuenta.tienda.diarios].includes(s.id);
  let acciones = '';
  if (cuenta) {
    if (mia) {
      acciones += puesta ? '<span class="chip ok">Equipada</span>' : `<button class="primary chico" data-acc="equipar">Equipar</button>`;
      if (vendible(s) && !SKINS.some((t) => t.incluye === s.id && cuenta.skins.includes(t.id))) acciones += `<button class="chico peligro" data-acc="vender">Vender por ${fmt(precioVenta(s))}</button>`;
    } else if (enTienda) acciones += `<button class="primary chico" data-acc="comprar">Comprar · ${fmt(precio(s))} pavos</button>`;
    else acciones += `<span class="chip">No la tenés</span>`;
  }
  const incluye = s.incluye && SKIN[s.incluye] ? `<p class="d-incl">Trae la mochila <b>${esc(SKIN[s.incluye].nombre)}</b></p>` : '';
  d.innerHTML = `<div class="d-cab" style="--r:${r.color}"><b>${esc(s.nombre)}</b><span>${TIPOS[s.tipo].uno} ${r.name}</span></div>
    <p class="d-desc">${esc(s.desc || '')}</p>${incluye}<div class="d-acc">${acciones}</div><p id="dError" class="error"></p>`;
  for (const b of d.querySelectorAll('[data-acc]')) b.onclick = () => accion(b.dataset.acc, s, b);
}

async function accion(que, s, boton) {
  if (boton) boton.disabled = true;
  let j;
  if (que === 'equipar') j = await api('equipar', { tipo: s.tipo, id: s.id });
  if (que === 'comprar') { j = await api('tienda/comprar', { id: s.id }); if (j.ok) avisar(`¡${s.nombre} es tuya!`); }
  if (que === 'vender') {
    if (boton && !boton.dataset.seguro) { boton.dataset.seguro = 1; boton.disabled = false; boton.textContent = '¿Seguro? Tocá de nuevo'; return; }
    j = await api('vender', { id: s.id });
    if (j.ok) { avisar(`Vendiste ${s.nombre}: +${fmt(j.pavos)} pavos`); seleccion = null; vitrina?.soltar(); dibujar(); }
  }
  if (j && !j.ok && $('dError')) $('dError').textContent = j.error;
  if (boton) boton.disabled = false;
}

// ---------- tienda ----------
let relojTienda = 0;
function dibujarTienda(el) {
  clearInterval(relojTienda);
  if (!cuenta) return sinCuenta(el, 'comprar skins');
  const t = cuenta.tienda;
  el.innerHTML = `<div class="m-cab"><h2>Tienda del día</h2><span class="m-reloj">Cambia en <b id="tReloj"></b></span>
      <button id="btnReroll" class="chico">🎲 Reroll ${precioHtml(t.costoReroll)}</button></div>
    <p id="tError" class="error"></p>
    <h3>Destacadas</h3><div class="grilla grande" id="tDest"></div>
    <h3>Del día</h3><div class="grilla" id="tDia"></div>`;
  const pie = (id) => (tiene(id) ? '<span class="chip ok">Ya la tenés</span>' : precioHtml(precio(SKIN[id])));
  for (const id of t.destacados) $('tDest').append(tarjeta(id, { pie: pie(id), clase: tiene(id) ? 'mia' : '' }));
  for (const id of t.diarios) $('tDia').append(tarjeta(id, { pie: pie(id), clase: tiene(id) ? 'mia' : '' }));
  const reloj = () => {
    const ms = Math.max(0, t.cambia - Date.now());
    const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
    if ($('tReloj')) $('tReloj').textContent = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    if (ms <= 0) { clearInterval(relojTienda); api('cuenta'); }
  };
  reloj();
  relojTienda = setInterval(reloj, 1000);
  $('btnReroll').onclick = async () => {
    $('btnReroll').disabled = true;
    const j = await api('tienda/reroll', {});
    if (!j.ok) { $('tError').textContent = j.error; $('btnReroll').disabled = false; }
  };
}

// ---------- casillero ----------
function dibujarCasillero(el) {
  if (!cuenta) return sinCuenta(el, 'guardar y equipar skins');
  const total = (t) => SKINS.filter((s) => s.tipo === t).length;
  const mias = (t) => SKINS.filter((s) => s.tipo === t && tiene(s.id));
  el.innerHTML = `<div class="m-cab"><h2>Casillero</h2><span class="hint">${cuenta.skins.length} de ${SKINS.length} skins</span></div>
    <div class="subpest">${ORDEN_TIPOS.map((t) => `<button data-t="${t}" class="${t === tipoCasillero ? 'on' : ''}">${TIPOS[t].icono} ${TIPOS[t].nombre} <small>${mias(t).length}/${total(t)}</small></button>`).join('')}</div>
    <div class="grilla" id="cGrilla"></div>`;
  for (const b of el.querySelectorAll('.subpest [data-t]')) b.onclick = () => { tipoCasillero = b.dataset.t; elegir(null); dibujar(); };
  const g = $('cGrilla');
  if (OPCIONALES.has(tipoCasillero)) {
    const nada = document.createElement('button');
    nada.type = 'button';
    nada.className = `tarjeta nada ${cuenta.equipo[tipoCasillero] ? '' : 'puesta'}`;
    nada.innerHTML = `<div class="t-foto"><span>∅</span></div><div class="t-info"><b>Nada</b><small>Sin ${TIPOS[tipoCasillero].uno.toLowerCase()}</small></div>`;
    nada.onclick = async () => { elegir(null); await api('equipar', { tipo: tipoCasillero, id: null }); };
    g.append(nada);
  }
  const lista = mias(tipoCasillero).sort((a, b) => b.rareza - a.rareza || a.nombre.localeCompare(b.nombre));
  for (const s of lista) {
    const puesta = cuenta.equipo[s.tipo] === s.id;
    g.append(tarjeta(s.id, { clase: puesta ? 'puesta' : '', marca: puesta ? '✔ Puesta' : '' }));
  }
  if (!lista.length) g.insertAdjacentHTML('beforeend', `<p class="hint">Todavía no tenés ${TIPOS[tipoCasillero].nombre.toLowerCase()}. Conseguilas en la tienda o en las cajas.</p>`);
}

// ---------- cajas ----------
function dibujarCajas(el) {
  if (!cuenta) return sinCuenta(el, 'abrir cajas');
  el.innerHTML = `<div class="m-cab"><h2>Cajas</h2><span class="hint">Si sale una que ya tenés, te devolvemos la mitad de lo que vale.</span></div>
    <p id="cjError" class="error"></p><div class="cajas" id="cjLista"></div>`;
  for (const c of CAJAS) {
    const pr = probabilidades(c);
    const n = poolCaja(c).length;
    const el2 = document.createElement('div');
    el2.className = 'caja';
    el2.style.setProperty('--c', c.color);
    el2.innerHTML = `<div class="caja-ico"><div class="caja-tapa"></div><div class="caja-cuerpo">?</div></div>
      <b>${esc(c.nombre)}</b><p class="hint">${esc(c.desc)} (${n} skins)</p>
      <div class="caja-prob">${pr.map((p, r) => (p > 0 ? `<span style="--r:${RAREZAS[r].color}"><i></i>${RAREZAS[r].name} <b>${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%</b></span>` : '')).join('')}</div>
      <div class="caja-pie"><button class="chico" data-ver>Ver qué trae</button><button class="primary chico" data-abrir>Abrir ${precioHtml(c.precio)}</button></div>`;
    el2.querySelector('[data-abrir]').onclick = (e) => abrirCaja(c, e.currentTarget);
    el2.querySelector('[data-ver]').onclick = () => verCaja(c);
    $('cjLista').append(el2);
  }
}

function verCaja(c) {
  const capa = $('ruleta');
  capa.classList.remove('hidden');
  capa.innerHTML = `<div class="panel ancho"><div class="m-cab"><h2>${esc(c.nombre)}</h2><button class="chico" id="rlCerrar">Cerrar</button></div><div class="grilla chica" id="rlTodo"></div></div>`;
  for (const s of poolCaja(c).sort((a, b) => b.rareza - a.rareza)) $('rlTodo').append(tarjeta(s.id, { clase: tiene(s.id) ? 'mia' : '', marca: tiene(s.id) ? '✔' : '' }));
  for (const t of capa.querySelectorAll('.tarjeta')) t.onclick = null;
  $('rlCerrar').onclick = () => capa.classList.add('hidden');
}

async function abrirCaja(c, boton) {
  boton.disabled = true;
  const j = await api('cajas/abrir', { caja: c.id }, { diferir: true });
  boton.disabled = false;
  if (!j.ok) { $('cjError').textContent = j.error; return; }
  // los pavos bajan ahora (se pagó la caja); el premio se muestra cuando para la ruleta
  contarPavos(cuenta.pavos, cuenta.pavos - c.precio);
  const capa = $('ruleta');
  capa.classList.remove('hidden');
  capa.innerHTML = `<div class="ruleta-caja"><h2>${esc(c.nombre)}</h2><div class="cinta-marco"><div class="cinta" id="cinta"></div><div class="cinta-flecha"></div></div>
    <div id="rlPremio" class="rl-premio"></div><button id="rlSaltar" class="chico">Saltar</button></div>`;
  const cinta = $('cinta');
  for (const id of j.cinta) {
    const s = SKIN[id];
    const it = document.createElement('div');
    it.className = 'c-item';
    it.style.setProperty('--r', RAREZAS[s.rareza].color);
    it.innerHTML = `<img alt=""><span>${esc(s.nombre)}</span>`;
    vitrina.foto(id).then((u) => { if (u) it.querySelector('img').src = u; });
    cinta.append(it);
  }
  const ANCHO = 132; // ancho de cada casillero + separación (style.css .c-item)
  const marco = capa.querySelector('.cinta-marco');
  const centro = marco.clientWidth / 2;
  const final = j.pos * ANCHO + ANCHO / 2 - centro + (Math.random() - 0.5) * (ANCHO * 0.7);
  const dur = 5600, t0 = performance.now();
  let listo = false;
  const terminar = () => {
    if (listo) return;
    listo = true;
    cinta.style.transform = `translateX(${-final}px)`;
    cinta.children[j.pos].classList.add('gano');
    mostrarPremio(j, $('rlPremio'));
    $('rlSaltar').textContent = 'Seguir';
    $('rlSaltar').onclick = () => { capa.classList.add('hidden'); };
  };
  const paso = (t) => {
    if (listo) return;
    const k = Math.min(1, (t - t0) / dur);
    const e = 1 - (1 - k) ** 4;
    cinta.style.transform = `translateX(${-final * e}px)`;
    if (k < 1) requestAnimationFrame(paso); else terminar();
  };
  requestAnimationFrame(paso);
  $('rlSaltar').onclick = terminar;
}

function mostrarPremio(j, el) {
  const s = SKIN[j.premio];
  const r = RAREZAS[s.rareza];
  ponerCuenta(j.cuenta);
  el.style.setProperty('--r', r.color);
  el.innerHTML = `<small>${r.name}</small><b>${esc(s.nombre)}</b>${j.repetida ? `<span>Ya la tenías: te devolvemos ${fmt(j.reintegro)} pavos</span>` : `<span>¡Nueva! Ya está en tu casillero.</span>`}`;
  el.classList.add('ver');
  if (!j.repetida) { elegir(s.id); }
}

// ---------- apuestas ----------
function dibujarApuestas(el) {
  if (!cuenta) return sinCuenta(el, 'apostar');
  el.innerHTML = `<div class="m-cab"><h2>Apuestas</h2><span class="hint">Solo con pavos del juego. Nada de plata de verdad.</span></div>
    <div class="apuestas">
      <div class="apuesta">
        <h3>Cara o cruz</h3>
        <p class="hint">Duplicás lo que apostás o lo perdés. 50 y 50.</p>
        <div class="moneda" id="moneda"><div class="m-cara">☀</div><div class="m-cruz">✖</div></div>
        <label>Apuesta (${MONEDA.min} a ${fmt(MONEDA.max)})<input id="apMonto" type="number" min="${MONEDA.min}" max="${MONEDA.max}" step="10" value="${Math.min(100, Math.max(MONEDA.min, cuenta.pavos))}"></label>
        <div class="row"><button class="primary" data-lado="cara">☀ Cara</button><button class="primary" data-lado="cruz">✖ Cruz</button></div>
        <p id="apRes" class="ap-res"></p>
      </div>
      <div class="apuesta">
        <h3>Contrato</h3>
        <p class="hint">Entregá ${CONTRATO.cantidad} skins de la misma rareza y recibí una de la rareza siguiente.</p>
        <div class="grilla chica" id="ctGrilla"></div>
        <button class="primary" id="ctFirmar" disabled>Firmar contrato (0/${CONTRATO.cantidad})</button>
        <p id="ctRes" class="error"></p>
      </div>
    </div>`;
  for (const b of el.querySelectorAll('[data-lado]')) b.onclick = () => tirarMoneda(b.dataset.lado, el);
  elegidasContrato = elegidasContrato.filter((id) => cuenta.skins.includes(id));
  const lista = SKINS.filter((s) => !s.gratis && s.rareza < 4 && tiene(s.id) && !SKINS.some((t) => t.incluye === s.id && tiene(t.id)))
    .sort((a, b) => a.rareza - b.rareza || a.nombre.localeCompare(b.nombre));
  const g = $('ctGrilla');
  if (!lista.length) g.innerHTML = '<p class="hint">No tenés skins para entregar todavía.</p>';
  const rarezaSel = elegidasContrato.length ? SKIN[elegidasContrato[0]].rareza : null;
  for (const s of lista) {
    const t = tarjeta(s.id, { clase: elegidasContrato.includes(s.id) ? 'marcada' : (rarezaSel !== null && s.rareza !== rarezaSel ? 'apagada' : ''), marca: elegidasContrato.includes(s.id) ? '✔' : '' });
    t.onclick = () => {
      const i = elegidasContrato.indexOf(s.id);
      if (i >= 0) elegidasContrato.splice(i, 1);
      else {
        if (rarezaSel !== null && s.rareza !== rarezaSel) elegidasContrato = [];
        if (elegidasContrato.length < CONTRATO.cantidad) elegidasContrato.push(s.id);
      }
      elegir(s.id);
      dibujarApuestas(el);
    };
    g.append(t);
  }
  const n = elegidasContrato.length;
  $('ctFirmar').disabled = n !== CONTRATO.cantidad;
  $('ctFirmar').textContent = n === CONTRATO.cantidad ? `Firmar: 5 ${RAREZAS[rarezaSel].name} → 1 ${RAREZAS[rarezaSel + 1].name}` : `Firmar contrato (${n}/${CONTRATO.cantidad})`;
  $('ctFirmar').onclick = async () => {
    const btn = $('ctFirmar');
    if (!btn.dataset.seguro) { btn.dataset.seguro = 1; btn.textContent = 'Las 5 se van. ¿Seguro?'; return; }
    btn.disabled = true;
    const j = await api('apuestas/contrato', { ids: elegidasContrato }, { diferir: true });
    if (!j.ok) { $('ctRes').textContent = j.error; btn.disabled = false; return; }
    elegidasContrato = [];
    const capa = $('ruleta');
    capa.classList.remove('hidden');
    capa.innerHTML = `<div class="ruleta-caja"><h2>Contrato firmado</h2><div id="rlPremio" class="rl-premio"></div><button id="rlSaltar" class="chico">Seguir</button></div>`;
    $('rlSaltar').onclick = () => capa.classList.add('hidden');
    mostrarPremio(j, $('rlPremio'));
  };
}

async function tirarMoneda(lado, el) {
  const monto = Math.floor(Number($('apMonto').value));
  const botones = el.querySelectorAll('[data-lado]');
  botones.forEach((b) => { b.disabled = true; });
  $('apRes').textContent = '';
  $('apRes').className = 'ap-res';
  const j = await api('apuestas/moneda', { monto, lado }, { diferir: true });
  if (!j.ok) { $('apRes').textContent = j.error; $('apRes').classList.add('error'); botones.forEach((b) => { b.disabled = false; }); return; }
  const m = $('moneda');
  m.classList.remove('gira-cara', 'gira-cruz');
  void m.offsetWidth;
  m.classList.add(j.salio === 'cara' ? 'gira-cara' : 'gira-cruz');
  setTimeout(() => {
    ponerCuenta(j.cuenta);
    const res = $('apRes');
    if (!res) return;
    res.textContent = j.gano ? `Salió ${j.salio}: ¡ganaste ${fmt(j.monto)} pavos!` : `Salió ${j.salio}: perdiste ${fmt(j.monto)} pavos.`;
    res.classList.add(j.gano ? 'gano' : 'perdio');
    el.querySelectorAll('[data-lado]').forEach((b) => { b.disabled = false; });
  }, 1700);
}

// ---------- admin ----------
let buscarT = 0;
function dibujarAdmin(el) {
  if (!cuenta?.admin) { el.innerHTML = '<p class="hint">Solo la cuenta admin.</p>'; return; }
  if (el.dataset.listo) { cargarUsuarios(); return; }
  el.dataset.listo = 1;
  el.innerHTML = `<div class="m-cab"><h2>Admin</h2><span class="hint">Dar o sacar pavos y skins a cualquier cuenta.</span></div>
    <div class="admin"><div class="adm-lista"><input id="admBuscar" placeholder="Buscar usuario…" autocomplete="off"><div id="admUsuarios"></div></div>
    <div class="adm-ficha" id="admFicha"><p class="hint">Elegí un usuario.</p></div></div>`;
  $('admBuscar').oninput = () => { clearTimeout(buscarT); buscarT = setTimeout(cargarUsuarios, 250); };
  cargarUsuarios();
}
async function cargarUsuarios() {
  const j = await api(`admin/usuarios?q=${encodeURIComponent($('admBuscar')?.value || '')}`);
  const l = $('admUsuarios');
  if (!l) return;
  if (!j.ok) { l.innerHTML = `<p class="error">${esc(j.error)}</p>`; return; }
  l.innerHTML = j.usuarios.map((u) => `<button type="button" class="adm-u ${adminSel === u.usuario ? 'on' : ''}" data-u="${esc(u.usuario)}"><b>${esc(u.usuario)}</b>${u.admin ? '<span class="chip admin">ADMIN</span>' : ''}<span>${precioHtml(u.pavos)} · ${u.skins} skins · ${u.partidas} partidas</span></button>`).join('') || '<p class="hint">No hay usuarios.</p>';
  for (const b of l.querySelectorAll('[data-u]')) b.onclick = () => { adminSel = b.dataset.u; for (const x of l.querySelectorAll('.adm-u')) x.classList.toggle('on', x === b); verUsuario(); };
}
async function verUsuario(msg = '') {
  const f = $('admFicha');
  const j = await api(`admin/usuario?u=${encodeURIComponent(adminSel)}`);
  if (!j.ok) { f.innerHTML = `<p class="error">${esc(j.error)}</p>`; return; }
  const u = j.usuario;
  const opciones = ORDEN_TIPOS.map((t) => `<optgroup label="${TIPOS[t].nombre}">${SKINS.filter((s) => s.tipo === t && !s.gratis && !u.skins.includes(s.id)).map((s) => `<option value="${s.id}">${esc(s.nombre)} (${RAREZAS[s.rareza].name})</option>`).join('')}</optgroup>`).join('');
  f.innerHTML = `<div class="m-cab"><h3>${esc(u.usuario)}</h3>${precioHtml(u.pavos)}</div>
    <p class="hint">${u.stats.partidas} partidas · ${u.stats.victorias} victorias · ${u.stats.kills} eliminaciones</p>
    <div class="row"><input id="admPavos" type="number" placeholder="Pavos (ej: 500 o -200)"><button class="primary chico" id="admDarPavos">Dar pavos</button></div>
    <div class="row"><select id="admSkin">${opciones}</select><button class="primary chico" id="admDarSkin">Dar skin</button></div>
    <p id="admMsg" class="${msg.startsWith('!') ? 'error' : 'ok'}">${esc(msg.replace(/^!/, ''))}</p>
    <h3>Skins (${u.skins.length})</h3>
    <div class="adm-skins">${u.skins.map((id) => SKIN[id] ? `<span class="chip" style="--r:${RAREZAS[SKIN[id].rareza].color}">${esc(SKIN[id].nombre)}<button type="button" title="Sacar" data-q="${id}">✕</button></span>` : '').join('') || '<span class="hint">Ninguna</span>'}</div>`;
  const despues = async (r, ok) => {
    if (r.ok && adminSel.toLowerCase() === cuenta.usuario.toLowerCase()) await api('cuenta');
    await verUsuario(r.ok ? ok : `!${r.error}`);
    cargarUsuarios();
  };
  $('admDarPavos').onclick = async () => { const r = await api('admin/dar', { usuario: adminSel, pavos: $('admPavos').value }); despues(r, `Listo: ${r.cambios?.join(', ')}`); };
  $('admDarSkin').onclick = async () => { const r = await api('admin/dar', { usuario: adminSel, skin: $('admSkin').value }); despues(r, `Listo: le diste ${r.cambios?.join(', ')}`); };
  for (const b of f.querySelectorAll('[data-q]')) b.onclick = async () => {
    if (!b.dataset.seguro) { b.dataset.seguro = 1; b.textContent = '¿Sacar?'; return; }
    const r = await api('admin/quitar', { usuario: adminSel, skin: b.dataset.q });
    despues(r, `Le sacaste ${SKIN[b.dataset.q].nombre}`);
  };
}

// ---------- avisos ----------
let avisoT = 0;
function avisar(texto, extra = '') {
  const a = $('avisoPavos');
  a.innerHTML = `<b>${esc(texto)}</b>${extra ? `<small>${esc(extra)}</small>` : ''}`;
  a.classList.remove('hidden');
  a.classList.remove('ver');
  void a.offsetWidth;
  a.classList.add('ver');
  clearTimeout(avisoT);
  avisoT = setTimeout(() => a.classList.remove('ver'), 4500);
}
// mensaje del servidor { t: 'pavos', ganados, detalle, cuenta }
export function avisoPavos(m) {
  if (m.cuenta) ponerCuenta(m.cuenta);
  const d = m.detalle || {};
  const partes = [];
  if (d.partida) partes.push(`partida +${d.partida}`);
  if (d.kills) partes.push(`eliminaciones +${d.kills}`);
  if (d.victoria) partes.push(`victoria +${d.victoria}`);
  avisar(`+${fmt(m.ganados)} pavos`, partes.join(' · '));
}

// el color del jugador en la sala (para el chaleco del Recluta)
export function colorDelJugador(c) {
  if (!c || c === colorJugador) return;
  colorJugador = c;
  vitrina?.mostrar(cuenta ? cuenta.equipo : EQUIPO_INICIAL, colorJugador);
}

// ---------- casillero arriba de la sala de espera ----------
export function abrirSobreSala() {
  $('menu').classList.remove('hidden');
  $('menu').classList.add('sobre-sala');
  abrir(cuenta ? 'casillero' : 'jugar');
}
function cerrarSobreSala() {
  $('menu').classList.remove('sobre-sala');
  $('menu').classList.add('hidden');
}

// ---------- arranque ----------
export async function iniciarMenu() {
  vitrina = crearVitrina($('vitrina'));
  vitrina.mostrar(EQUIPO_INICIAL, colorJugador);
  for (const b of document.querySelectorAll('#pestanas [data-p]')) b.onclick = () => abrir(b.dataset.p);
  $('btnCuenta').onclick = (e) => { e.stopPropagation(); menuCuenta(); };
  document.addEventListener('click', (e) => { if (!$('cuentaMenu').contains(e.target)) $('cuentaMenu').classList.add('hidden'); });
  $('lgForm').onsubmit = enviarLogin;
  $('lgCambiar').onclick = () => mostrarLogin($('login').dataset.modo === 'crear' ? 'entrar' : 'crear');
  $('lgInvitado').onclick = () => { $('login').classList.add('hidden'); guardado('sf-invitado', '1'); };
  $('btnVolverSala').onclick = cerrarSobreSala;
  // sin vitrina cuando el menú no se ve (en la partida)
  new MutationObserver(() => vitrina.activa(!$('menu').classList.contains('hidden'))).observe($('menu'), { attributes: true, attributeFilter: ['class'] });
  ponerCuenta(null);
  abrir('jugar');
  if (token) {
    const j = await api('cuenta');
    if (!j.ok && !token) mostrarLogin('entrar');
  } else if (!guardado('sf-invitado')) mostrarLogin('crear');
}

window.__menu = { sesion, abrir, elegir, api, get vitrina() { return vitrina; }, ponerCuenta, avisoPavos };
