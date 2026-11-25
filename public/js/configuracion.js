// Panel de configuración: pestañas Juego, Video, Sonido y Controles. Lee y escribe todo en controles.js.
import {
  GRUPOS, RESERVADAS, listaAcciones, asignar, restablecerControles, nombreTecla,
  listaOpciones, opcion, fijarOpcion, restablecerOpciones, alCambiar,
} from './controles.js';

const PESTANAS = [['Juego', 'Juego'], ['Video', 'Video'], ['Sonido', 'Sonido'], ['Controles', 'Controles']];
let raiz = null, cuerpo = null, aviso = null, pestana = 'Juego', alCerrar = null;
let capturando = null; // { id, lugar, boton }

function el(tag, attrs = {}, ...hijos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
  }
  for (const h of hijos.flat()) if (h !== null && h !== undefined) e.append(h);
  return e;
}

function armar() {
  cuerpo = el('div', { class: 'cfg-cuerpo' });
  aviso = el('span', { class: 'cfg-aviso' });
  const tabs = el('nav', { class: 'cfg-tabs', role: 'tablist' },
    PESTANAS.map(([id, nombre]) => el('button', { type: 'button', role: 'tab', 'data-p': id, onclick: () => { pestana = id; dibujar(); } }, nombre)));
  raiz = el('div', { id: 'config', class: 'hidden', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Configuración' },
    el('div', { class: 'cfg-caja' },
      el('header', {}, el('h2', {}, 'Configuración'), el('button', { type: 'button', class: 'cfg-x', title: 'Cerrar (Esc)', 'aria-label': 'Cerrar', onclick: cerrarConfig }, '✕')),
      tabs, cuerpo,
      el('footer', {}, aviso,
        el('button', { type: 'button', class: 'cfg-sec', onclick: restablecerPestana }, 'Restablecer'),
        el('button', { type: 'button', class: 'primary', onclick: cerrarConfig }, 'Listo'))));
  // clic afuera de la caja cierra
  raiz.addEventListener('mousedown', (e) => { if (e.target === raiz && !capturando) cerrarConfig(); });
  document.body.append(raiz);
  alCambiar(() => { if (abierto() && !capturando) dibujar(); });
}

function restablecerPestana() {
  if (pestana === 'Controles') { restablecerControles(); mostrarAviso('Se volvieron a poner los controles de fábrica.'); return; }
  for (const o of listaOpciones()) if (o.grupo === pestana) fijarOpcion(o.id, o.def);
  mostrarAviso('Listo, volvió a como venía.');
}
let avisoT = 0;
function mostrarAviso(txt) {
  aviso.textContent = txt;
  clearTimeout(avisoT);
  avisoT = setTimeout(() => { aviso.textContent = ''; }, 4000);
}

function dibujar() {
  raiz.querySelectorAll('.cfg-tabs button').forEach((b) => {
    const on = b.dataset.p === pestana;
    b.classList.toggle('activa', on);
    b.setAttribute('aria-selected', on);
  });
  cuerpo.replaceChildren(...(pestana === 'Controles' ? filasControles() : filasOpciones(pestana)));
}

function filasOpciones(grupo) {
  return listaOpciones().filter((o) => o.grupo === grupo).map((o) => {
    let ctrl;
    if (o.tipo === 'rango') {
      const valor = el('output', {}, (o.fmt || String)(o.valor));
      const r = el('input', { type: 'range', min: o.min, max: o.max, step: o.paso, value: o.valor, 'aria-label': o.nombre });
      r.addEventListener('input', () => { valor.textContent = (o.fmt || String)(Number(r.value)); });
      r.addEventListener('change', () => fijarOpcion(o.id, Number(r.value)));
      ctrl = el('div', { class: 'cfg-rango' }, r, valor);
    } else if (o.tipo === 'si-no') {
      ctrl = el('button', { type: 'button', class: 'cfg-switch' + (o.valor ? ' on' : ''), role: 'switch', 'aria-checked': o.valor, 'aria-label': o.nombre,
        onclick: () => fijarOpcion(o.id, !opcion(o.id)) }, el('i'));
    } else {
      ctrl = el('div', { class: 'cfg-seg', role: 'radiogroup', 'aria-label': o.nombre },
        o.valores.map(([v, nombre]) => el('button', { type: 'button', role: 'radio', 'aria-checked': v === o.valor, class: v === o.valor ? 'on' : '',
          style: o.id === 'colorMira' ? `--muestra:${v}` : undefined, onclick: () => fijarOpcion(o.id, v) },
        o.id === 'colorMira' ? el('i', { class: 'cfg-color' }) : null, nombre)));
    }
    return el('div', { class: 'cfg-fila' }, el('div', { class: 'cfg-nombre' }, o.nombre, o.ayuda ? el('small', {}, o.ayuda) : null), ctrl);
  });
}

function filasControles() {
  const out = [el('p', { class: 'cfg-nota' }, 'Hacé clic en una tecla y apretá la nueva (sirven también los botones y la rueda del mouse). Esc cancela · Supr la deja vacía.')];
  out.push(el('div', { class: 'cfg-fila cfg-cab' }, el('div'), el('div', { class: 'cfg-teclas' }, el('span', {}, 'Principal'), el('span', {}, 'Secundaria'))));
  const acciones = listaAcciones();
  for (const g of GRUPOS) {
    const del = acciones.filter((a) => a.grupo === g);
    if (!del.length) continue;
    out.push(el('h3', {}, g));
    for (const a of del) {
      const botones = [0, 1].map((lugar) => {
        const b = el('button', { type: 'button', class: 'cfg-tecla' + (a.teclas[lugar] ? '' : ' vacia'), title: lugar ? 'Tecla secundaria' : 'Tecla principal',
          'aria-label': `${a.nombre}, ${lugar ? 'secundaria' : 'principal'}: ${nombreTecla(a.teclas[lugar])}` }, nombreTecla(a.teclas[lugar]));
        b.addEventListener('click', (e) => { e.stopPropagation(); empezarCaptura(a, lugar, b); });
        return b;
      });
      out.push(el('div', { class: 'cfg-fila' }, el('div', { class: 'cfg-nombre' }, a.nombre), el('div', { class: 'cfg-teclas' }, botones)));
    }
  }
  return out;
}

// ---------- Captura de una tecla nueva ----------
function empezarCaptura(a, lugar, boton) {
  terminarCaptura();
  capturando = { id: a.id, lugar, boton, nombre: a.nombre };
  boton.classList.add('esperando');
  boton.textContent = 'Apretá una tecla…';
  // se escucha en la próxima vuelta para que el clic que abrió la captura no cuente como tecla
  setTimeout(() => {
    if (!capturando) return;
    window.addEventListener('keydown', alTeclear, true);
    window.addEventListener('mousedown', alClic, true);
    window.addEventListener('wheel', alRueda, { capture: true, passive: false });
    window.addEventListener('contextmenu', sinMenu, true);
  }, 0);
}
function terminarCaptura() {
  window.removeEventListener('keydown', alTeclear, true);
  window.removeEventListener('mousedown', alClic, true);
  window.removeEventListener('wheel', alRueda, true);
  // el menú del clic derecho llega después del mousedown: se saca un poco más tarde
  setTimeout(() => window.removeEventListener('contextmenu', sinMenu, true), 300);
  capturando = null;
}
function sinMenu(e) { e.preventDefault(); }
function alTeclear(e) {
  e.preventDefault(); e.stopImmediatePropagation();
  if (e.repeat) return;
  if (e.code === 'Escape') { terminarCaptura(); dibujar(); return; }
  fijar(e.code === 'Delete' ? null : e.code);
}
function alClic(e) {
  e.preventDefault(); e.stopImmediatePropagation();
  fijar('Mouse' + e.button);
}
function alRueda(e) {
  e.preventDefault(); e.stopImmediatePropagation();
  if (e.deltaY) fijar(e.deltaY > 0 ? 'RuedaAbajo' : 'RuedaArriba');
}
function fijar(code) {
  const { id, lugar, nombre } = capturando;
  terminarCaptura();
  if (code && RESERVADAS.includes(code)) { dibujar(); return; }
  const quitadas = asignar(id, lugar, code);
  dibujar();
  if (quitadas.length) mostrarAviso(`${nombreTecla(code)} ahora es "${nombre}". Se la sacamos a: ${quitadas.join(', ')}.`);
}

// ---------- API ----------
export function abierto() { return !!raiz && !raiz.classList.contains('hidden'); }
/** Abre el panel. cuandoCierra() se llama al cerrarlo (con un gesto del usuario, así se puede volver a capturar el mouse). */
export function abrirConfig(cuandoCierra = null, enPestana = null) {
  if (!raiz) armar();
  alCerrar = cuandoCierra;
  if (enPestana) pestana = enPestana;
  raiz.classList.remove('hidden');
  dibujar();
  raiz.querySelector('.cfg-tabs button.activa')?.focus();
}
export function cerrarConfig() {
  if (!abierto()) return;
  terminarCaptura();
  raiz.classList.add('hidden');
  const f = alCerrar; alCerrar = null;
  f?.();
}
// Esc cierra el panel (cuando no se está eligiendo una tecla)
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && abierto() && !capturando) { e.preventDefault(); e.stopImmediatePropagation(); cerrarConfig(); }
}, true);
