// Mapa del juego: minimapa que sigue al jugador, mapa grande que se abre con una tecla, brújula y marcas.
//
// - El dibujo de la isla sale del mundo (world.js con los datos de isla.js/planos.js): colores del terreno con relieve,
//   agua según la profundidad, río, calles, plazas, casas y el teleférico. Se pinta una vez por partida.
// - Marcas: una por jugador. Se ponen con clic en el mapa grande o con la tecla de marcar mirando a un lugar del mundo
//   (mismo lugar otra vez = se saca). Se ven en el minimapa, en el mapa, en la brújula y en el mundo como un haz de luz
//   con la distancia. Si la opción "Compartir tus marcas" está activada, el servidor se las pasa a la sala.
// - Se usa desde main.js: crearMapa({...}) → preparar(world) al armar el mundo, reiniciar(marcas) al empezar la
//   partida, update(dt, t, tormenta) en cada cuadro y mensaje(m) para los 'marca' del servidor.
import * as THREE from 'three';
import { RIO, TELEFERICO } from './isla.js';
import { registrarAccion, registrarOpcion, opcion, alCambiar, teclaDe } from './controles.js';

registrarAccion('mapa', 'Abrir / cerrar el mapa', 'Otros', ['KeyM'], 'siempre');
registrarAccion('marcar', 'Marcar donde apuntás (con el mapa abierto: donde está el mouse)', 'Otros', ['Mouse1', 'KeyT'], 'siempre');
registrarOpcion({ id: 'compartirMarcas', nombre: 'Compartir tus marcas con la sala', ayuda: 'Los demás jugadores de la sala ven tu marca en el mapa y en el mundo', grupo: 'Juego', tipo: 'si-no', def: true });
registrarOpcion({ id: 'minimapaZoom', nombre: 'Zoom del minimapa', grupo: 'Juego', tipo: 'lista', valores: [['cerca', 'Cerca'], ['medio', 'Medio'], ['lejos', 'Lejos']], def: 'medio' });

/** Medio ancho (en metros) de lo que muestra el minimapa a pie, según la opción. */
export const RADIO_MINIMAPA = { cerca: 70, medio: 115, lejos: 180 };
const CELDA = 120; // la grilla del mapa: columnas A-J y filas 1-10 de 120 m
const ALTO_HAZ = 260;
const PIXELES_TERRENO = 1024, PIXELES_BASE = 2048;
// cosas del mapa que no se dibujan como edificios (son chicas o ya están en las calles)
const SIN_PLANTA = new Set(['farol', 'cerca', 'auto', 'caja3', 'barriles', 'fogon', 'campo', 'tractor', 'puesto', 'carpa', 'pasarela', 'muelle',
  'malecon', 'puente', 'montanaRusa', 'rueda', 'poste', 'cables', 'indicador', 'torreTeleferico', 'banco', 'tacho', 'hidrante', 'buzon', 'cartel',
  'cantero', 'seto', 'jardin', 'calesita', 'kiosco', 'andamio', 'contenedor', 'bote', 'arco', 'fuente', 'parada']);
const TECHOS = {
  casa: '#c0674a', edificio: '#8f97a5', local: '#cf9f66', galpon: '#9c917b', granero: '#a9493b', silo: '#cfcabd', faro: '#f1efe9',
  palafito: '#a27a50', cabana: '#8b5b3b', lodge: '#7b5337', capilla: '#e6dece', laboratorio: '#d0d7df', cupula: '#e9eef4', estacion: '#bba480',
  adobe: '#c99b6b', molino: '#b9876a', tanqueAgua: '#a7b0b8', torreVigia: '#8b6a4a', cobertizo: '#8f7d64', grua: '#e0b23a', tolva: '#9b7f64',
  antena: '#c8cdd2', ruinas: '#a59d8f',
};
const CALLES = { asfalto: ['#5c6068', '#3b3e44'], vereda: ['#ddd5c4', '#b9b09c'] };
const TIERRA = ['#bf9a63', '#94744a'];

const suave = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const aSRGB = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** "D7": columna (A-J, de oeste a este) y fila (1-10, de norte a sur) de la grilla del mapa. */
export function celdaDe(x, z, size) {
  const n = Math.round(size / CELDA), half = size / 2;
  const i = Math.max(0, Math.min(n - 1, Math.floor((x + half) / CELDA))), j = Math.max(0, Math.min(n - 1, Math.floor((z + half) / CELDA)));
  return String.fromCharCode(65 + i) + (j + 1);
}
/** Rumbo de (dx, dz) en radianes, en sentido horario desde el norte (el norte es -z, arriba en el mapa). */
export const rumbo = (dx, dz) => Math.atan2(dx, -dz);
export function textoDistancia(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(m)} m`;
}

// ---------- Dibujo de la isla ----------
// Color del terreno por celda: el mismo de la malla 3D (si ya está armada) o calculado.
function coloresTerreno(world) {
  const res = world.res, n = res * res, rgb = new Float32Array(n * 3);
  const col = world.terrainMesh?.geometry?.attributes?.color;
  if (col && col.count >= n * 6) {
    const a = col.array;
    for (let k = 0; k < n; k++) for (let c = 0; c < 3; c++) rgb[k * 3 + c] = aSRGB((a[k * 18 + c] + a[k * 18 + 9 + c]) / 2);
  } else {
    const half = world.size / 2, c = new THREE.Color();
    for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
      const x = -half + (i + 0.5) * world.cell, z = -half + (j + 0.5) * world.cell;
      world.terrainColor(x, z, world.terrainHeight(x, z), world.slopeAt(x, z), c);
      const k = j * res + i;
      rgb[k * 3] = aSRGB(c.r); rgb[k * 3 + 1] = aSRGB(c.g); rgb[k * 3 + 2] = aSRGB(c.b);
    }
  }
  return rgb;
}

/** Terreno del mapa (sin calles ni casas): colores de la isla con sombreado de relieve y el agua según la profundidad. */
export function pintarTerreno(world, px = PIXELES_TERRENO) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = px;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(px, px), d = img.data;
  const size = world.size, half = size / 2, paso = size / px, res = world.res, cell = world.cell;
  const rgb = coloresTerreno(world);
  const M = px + 2, H = new Float32Array(M * M);
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) H[j * M + i] = world.terrainHeight(-half + (i - 0.5) * paso, -half + (j - 0.5) * paso);
  // luz de relieve desde el noroeste
  const lx = -0.5, ly = 0.72, lz = -0.48, ll = Math.hypot(lx, ly, lz);
  const LX = lx / ll, LY = ly / ll, LZ = lz / ll, EXAG = 1.8;
  const hondo = [29, 95, 163], playo = [86, 196, 222], turbio = [77, 104, 62];
  for (let j = 0; j < px; j++) for (let i = 0; i < px; i++) {
    const o = (j * px + i) * 4, h = H[(j + 1) * M + i + 1];
    const x = -half + (i + 0.5) * paso, z = -half + (j + 0.5) * paso;
    let r, g, b;
    if (h < 0) {
      const t = suave(0, 12, -h);
      r = playo[0] + (hondo[0] - playo[0]) * t; g = playo[1] + (hondo[1] - playo[1]) * t; b = playo[2] + (hondo[2] - playo[2]) * t;
      const sw = world.swamp ? Math.min(1, world.swamp(x, z) * 1.3) * 0.7 : 0;
      if (sw > 0) { r += (turbio[0] - r) * sw; g += (turbio[1] - g) * sw; b += (turbio[2] - b) * sw; }
      const espuma = (1 - suave(0, 0.45, -h)) * 0.45 * (1 - sw);
      r += (255 - r) * espuma; g += (255 - g) * espuma; b += (255 - b) * espuma;
    } else {
      // color bilineal entre los centros de las celdas de la malla
      const gx = Math.max(0, Math.min(res - 1.001, (x + half) / cell - 0.5)), gz = Math.max(0, Math.min(res - 1.001, (z + half) / cell - 0.5));
      const i0 = Math.floor(gx), j0 = Math.floor(gz), fx = gx - i0, fz = gz - j0;
      const k00 = (j0 * res + i0) * 3, k10 = k00 + 3, k01 = k00 + res * 3, k11 = k01 + 3;
      const mez = (c) => (rgb[k00 + c] * (1 - fx) + rgb[k10 + c] * fx) * (1 - fz) + (rgb[k01 + c] * (1 - fx) + rgb[k11 + c] * fx) * fz;
      const dx = (H[(j + 1) * M + i + 2] - H[(j + 1) * M + i]) / (2 * paso) * EXAG;
      const dz = (H[(j + 2) * M + i + 1] - H[j * M + i + 1]) / (2 * paso) * EXAG;
      const nl = Math.hypot(dx, 1, dz);
      const s = (-dx * LX + LY - dz * LZ) / nl;
      const f = Math.max(0.5, Math.min(1.32, 1 + (s - LY) * 1.55)) * (1 + Math.min(0.06, h / 1200));
      // un poco menos saturado y más oscuro que el color crudo: se parece más a como se ve la isla con la luz del juego
      r = mez(0); g = mez(1); b = mez(2);
      const lum = r * 0.3 + g * 0.59 + b * 0.11;
      r = (r + (lum - r) * 0.22) * 232 * f; g = (g + (lum - g) * 0.22) * 232 * f; b = (b + (lum - b) * 0.22) * 232 * f;
    }
    d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

/** Río, calles, plazas, casas y teleférico. ctx ya trasladado: el punto (x, z) del mundo va a (x * k, z * k).
 *  vista: { x0, z0, x1, z1 } en metros para no dibujar lo que queda afuera. */
export function pintarVectores(ctx, world, k, vista = null) {
  const fuera = (x0, z0, x1, z1) => vista && (x1 < vista.x0 || x0 > vista.x1 || z1 < vista.z0 || z0 > vista.z1);
  const linea = (pts) => { ctx.beginPath(); pts.forEach(([x, z], n) => (n ? ctx.lineTo(x * k, z * k) : ctx.moveTo(x * k, z * k))); };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // río: borde más oscuro y agua
  if (world.river?.path?.length) {
    linea(world.river.path);
    ctx.strokeStyle = '#2f7fb0'; ctx.lineWidth = Math.max(2, RIO.w * k + 2); ctx.stroke();
    ctx.strokeStyle = '#4eb7e4'; ctx.lineWidth = Math.max(1.2, RIO.w * k); ctx.stroke();
  }
  // calles: primero las veredas (van debajo), después tierra y asfalto, cada una con su borde
  const orden = [...world.ribbons].sort((a, b) => (a.under ? 0 : 1) - (b.under ? 0 : 1));
  for (const pasada of [0, 1]) for (const rb of orden) {
    const [relleno, borde] = CALLES[rb.m] || TIERRA;
    linea(rb.pts);
    const w = Math.max(rb.m === 'asfalto' ? 1.4 : 1, rb.w * k);
    if (pasada === 0) { ctx.strokeStyle = borde; ctx.lineWidth = w + Math.max(1, k * 0.8); }
    else { ctx.strokeStyle = relleno; ctx.lineWidth = w; }
    ctx.stroke();
  }
  // línea del medio de las rutas, solo con zoom
  if (k > 2.6) {
    ctx.setLineDash([2 * k, 2.6 * k]); ctx.strokeStyle = 'rgba(255,236,170,.75)'; ctx.lineWidth = Math.max(1, 0.25 * k);
    for (const rb of world.ribbons) if (rb.m === 'asfalto' && rb.w >= 6) { linea(rb.pts); ctx.stroke(); }
    ctx.setLineDash([]);
  }
  for (const pq of world.plazas) {
    const [relleno, borde] = CALLES[pq.m] || TIERRA;
    ctx.beginPath(); ctx.arc(pq.x * k, pq.z * k, Math.max(1.5, pq.r * k), 0, Math.PI * 2);
    ctx.fillStyle = relleno; ctx.fill(); ctx.strokeStyle = borde; ctx.lineWidth = Math.max(0.8, k * 0.5); ctx.stroke();
  }
  // casas y edificios: sombra corrida al sudeste, techo con el color del tipo y borde
  const sombra = Math.max(0.8, Math.min(4, k * 0.9));
  for (const p of world.placed) {
    if (SIN_PLANTA.has(p.name) || !p.fp) continue;
    const f = p.fp;
    if (fuera(f.x0, f.z0, f.x1, f.z1)) continue;
    const x = f.x0 * k, z = f.z0 * k, w = Math.max(1.5, (f.x1 - f.x0) * k), h = Math.max(1.5, (f.z1 - f.z0) * k);
    ctx.fillStyle = 'rgba(20,14,10,.32)'; ctx.fillRect(x + sombra, z + sombra, w, h);
    ctx.fillStyle = TECHOS[p.name] || '#9a7c66'; ctx.fillRect(x, z, w, h);
    if (w > 4 && h > 4) {
      ctx.strokeStyle = 'rgba(0,0,0,.38)'; ctx.lineWidth = Math.max(0.6, k * 0.25); ctx.strokeRect(x, z, w, h);
      ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(x, z, w, Math.max(1, h * 0.18));
    }
  }
  // teleférico: cable con las torres
  if (TELEFERICO?.length > 1) {
    linea(TELEFERICO);
    ctx.strokeStyle = 'rgba(30,30,36,.85)'; ctx.lineWidth = Math.max(1, k * 0.5); ctx.setLineDash([3 * Math.max(1, k), 2 * Math.max(1, k)]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#2a2a30';
    for (const [x, z] of TELEFERICO) { ctx.beginPath(); ctx.arc(x * k, z * k, Math.max(1.5, k * 1.4), 0, Math.PI * 2); ctx.fill(); }
  }
}

// ---------- Íconos ----------
function pin(ctx, x, y, s, color, borde = '#fff') {
  // gota con la punta abajo en (x, y)
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-s * 0.15, -s * 0.5, -s * 0.62, -s * 0.72, -s * 0.62, -s * 1.12);
  ctx.arc(0, -s * 1.12, s * 0.62, Math.PI, 0);
  ctx.bezierCurveTo(s * 0.62, -s * 0.72, s * 0.15, -s * 0.5, 0, 0);
  ctx.closePath();
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = s * 0.35; ctx.shadowOffsetY = s * 0.08;
  ctx.fillStyle = color; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = Math.max(1, s * 0.14); ctx.strokeStyle = borde; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -s * 1.12, s * 0.24, 0, Math.PI * 2); ctx.fillStyle = borde; ctx.fill();
  ctx.restore();
}
function flecha(ctx, x, y, s, giro, color) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(giro);
  ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.72, s * 0.72); ctx.lineTo(0, s * 0.3); ctx.lineTo(-s * 0.72, s * 0.72); ctx.closePath();
  ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = s * 0.4;
  ctx.fillStyle = color; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = Math.max(1, s * 0.16); ctx.strokeStyle = '#111'; ctx.stroke();
  ctx.restore();
}
function iconoBus(ctx, x, y, s, giro) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(giro);
  ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#2b2100'; ctx.lineWidth = Math.max(1, s * 0.14);
  ctx.beginPath(); ctx.roundRect(-s * 0.42, -s, s * 0.84, s * 2, s * 0.3); ctx.fill(); ctx.stroke();
  ctx.fillRect(-s * 1.15, -s * 0.2, s * 2.3, s * 0.42); ctx.strokeRect(-s * 1.15, -s * 0.2, s * 2.3, s * 0.42);
  ctx.fillStyle = '#2b2100'; ctx.beginPath(); ctx.moveTo(0, -s * 0.85); ctx.lineTo(s * 0.25, -s * 0.45); ctx.lineTo(-s * 0.25, -s * 0.45); ctx.fill();
  ctx.restore();
}
// borde de la tormenta: todo lo de afuera del círculo, teñido de violeta
function tormenta(ctx, s, k, conOjo) {
  if (!s) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(-1e5, -1e5, 2e5, 2e5);
  ctx.arc(s.x * k, s.z * k, Math.max(0.5, s.r * k), 0, Math.PI * 2, true);
  ctx.fillStyle = 'rgba(132,64,255,.30)'; ctx.fill('evenodd');
  ctx.beginPath(); ctx.arc(s.x * k, s.z * k, Math.max(0.5, s.r * k), 0, Math.PI * 2);
  ctx.strokeStyle = '#b48cff'; ctx.lineWidth = conOjo ? 3 : 2; ctx.stroke();
  if (s.next && (s.next.r !== s.r || s.next.x !== s.x || s.next.z !== s.z)) {
    ctx.beginPath(); ctx.arc(s.next.x * k, s.next.z * k, Math.max(0.5, s.next.r * k), 0, Math.PI * 2);
    ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = conOjo ? 2.5 : 1.6; ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
}

// ---------- Haz de luz de una marca en el mundo ----------
const HAZ_GEO = new THREE.CylinderGeometry(0.55, 0.55, ALTO_HAZ, 18, 1, true).translate(0, ALTO_HAZ / 2, 0);
const ARO_GEO = new THREE.RingGeometry(1.05, 1.5, 48).rotateX(-Math.PI / 2);
function materialHaz(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uFade: { value: 1 }, uT: { value: 0 } },
    vertexShader: `varying float vY; varying float vRim;
      void main() {
        vY = position.y / ${ALTO_HAZ.toFixed(1)};
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vRim = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uColor; uniform float uFade, uT; varying float vY; varying float vRim;
      void main() {
        float a = pow(1.0 - vY, 1.6) * pow(vRim, 1.4) * uFade;
        a *= 0.75 + 0.25 * sin(vY * 60.0 - uT * 3.0);
        gl_FragColor = vec4(mix(uColor, vec3(1.0), pow(vRim, 6.0) * 0.6), a * 0.9);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}
function materialAro(color) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
}

/**
 * opts: { scene, camera, me, hud, minimapa (canvas), getWorld, getRoom, getBus, getMyId, others, autos, sendMsg, sfx, now, rayo(origen, dir, alcance) → distancia, alAbrir, alCerrar }
 */
export function crearMapa(opts) {
  const { scene, camera, me, hud, minimapa, getWorld, getRoom, getBus, getMyId, others, autos, sendMsg, sfx } = opts;
  let world = null, terreno = null, base = null;
  const marcas = new Map(); // id del jugador -> { x, y, z, color, nombre, haz, aro, et }
  let abierto = false, tormentaActual = null, radioMini = null;
  const dpr = () => Math.min(2, window.devicePixelRatio || 1);

  // ---------- DOM ----------
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
  const capaEt = el('div'); capaEt.id = 'marcasMundo';
  const brujula = el('canvas'); brujula.id = 'brujula';
  const raiz = el('div', 'hidden'); raiz.id = 'mapaGrande';
  raiz.setAttribute('role', 'dialog'); raiz.setAttribute('aria-label', 'Mapa de la isla');
  raiz.innerHTML = `
    <div class="mg-marco">
      <canvas class="mg-lienzo" aria-label="Mapa"></canvas>
      <div class="mg-zoom"><button type="button" data-z="1" title="Acercar">+</button><button type="button" data-z="-1" title="Alejar">−</button><button type="button" data-c title="Centrar en vos">◎</button></div>
      <div class="mg-cursor"></div>
    </div>
    <aside class="mg-lado">
      <header><h2>Mapa</h2><button type="button" class="mg-x" title="Cerrar" aria-label="Cerrar">✕</button></header>
      <p class="mg-donde"></p>
      <p class="mg-tormenta"></p>
      <h3>Marcas</h3>
      <ul class="mg-marcas"></ul>
      <button type="button" class="mg-quitar">Sacar mi marca</button>
      <div class="mg-ayuda"></div>
    </aside>`;
  hud.append(capaEt, brujula, raiz);
  const lienzo = raiz.querySelector('.mg-lienzo'), cursorEt = raiz.querySelector('.mg-cursor');
  const donde = raiz.querySelector('.mg-donde'), infoTormenta = raiz.querySelector('.mg-tormenta'), lista = raiz.querySelector('.mg-marcas');
  const ayuda = raiz.querySelector('.mg-ayuda'), btnQuitar = raiz.querySelector('.mg-quitar');
  raiz.querySelector('.mg-x').addEventListener('click', () => cerrar());
  btnQuitar.addEventListener('click', () => ponerMarca(null));
  raiz.querySelectorAll('.mg-zoom button').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.c !== undefined) { const p = posicionMia(); if (p) { vista.cx = p.x; vista.cz = p.z; } }
    else zoomEn(Number(b.dataset.z) > 0 ? 1.6 : 1 / 1.6);
    limitarVista(); sucio = true;
  }));
  function textoAyuda() {
    const t = (id) => `<kbd>${teclaDe(id)}</kbd>`;
    ayuda.innerHTML = `<p><kbd>Clic</kbd> poner o mover tu marca · <kbd>Clic der.</kbd> sacarla</p>
      <p><kbd>Rueda</kbd> zoom · <kbd>Arrastrar</kbd> mover el mapa</p>
      <p>${t('marcar')} sin el mapa: marcar donde apuntás · ${t('mapa')} cerrar</p>
      <p class="mg-compartir">${opcion('compartirMarcas') ? 'Tu marca la ve toda la sala.' : 'Tu marca la ves solo vos.'} Se cambia en Configuración.</p>`;
  }
  textoAyuda();
  alCambiar((tipo, id) => {
    if (tipo === 'controles' || !id || id === 'compartirMarcas') textoAyuda();
    if (tipo === 'opcion' && id === 'compartirMarcas') {
      // al dejar de compartir se saca la marca de los demás; al volver a compartir se manda la que haya
      const m = marcas.get(getMyId());
      sendMsg({ t: 'marca', p: opcion('compartirMarcas') && m ? [m.x, m.y, m.z] : null });
    }
  });

  // ---------- Preparar la isla ----------
  function preparar(w) {
    world = w;
    terreno = pintarTerreno(w, PIXELES_TERRENO);
    base = document.createElement('canvas');
    base.width = base.height = PIXELES_BASE;
    const ctx = base.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(terreno, 0, 0, PIXELES_BASE, PIXELES_BASE);
    const k = PIXELES_BASE / w.size;
    ctx.save(); ctx.translate(PIXELES_BASE / 2, PIXELES_BASE / 2);
    pintarVectores(ctx, w, k);
    ctx.restore();
    vista.cx = 0; vista.cz = 0; vista.zoom = 1;
    sucio = true;
  }
  // Pedazo de la isla (base) dibujado con el mundo en (x, z) → (x * k + ox, z * k + oy). Afuera de la isla es mar.
  function dibujarBase(ctx, img, k, ox, oy, W, H) {
    const half = world.size / 2, s = img.width / world.size;
    // rectángulo visible en metros, recortado a la isla
    const x0 = Math.max(-half, -ox / k), x1 = Math.min(half, (W - ox) / k);
    const z0 = Math.max(-half, -oy / k), z1 = Math.min(half, (H - oy) / k);
    if (x1 <= x0 || z1 <= z0) return;
    ctx.drawImage(img, (x0 + half) * s, (z0 + half) * s, (x1 - x0) * s, (z1 - z0) * s, ox + x0 * k, oy + z0 * k, (x1 - x0) * k, (z1 - z0) * k);
  }
  function mar(ctx, W, H) {
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, '#1f63a6'); g.addColorStop(1, '#153f75');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // ---------- Posiciones ----------
  function posicionMia() {
    if (me.state === 'bus') return getBus()?.position || null;
    if (['falling', 'glider', 'ground', 'auto'].includes(me.state)) return me.pos;
    const o = me.spectate && others.get(me.spectate);
    return o?.mesh.visible ? o.mesh.position : null;
  }
  function giroMio() {
    if (['falling', 'glider', 'ground', 'auto', 'bus'].includes(me.state)) return -me.yaw;
    const o = me.spectate && others.get(me.spectate);
    return o ? -o.mesh.rotation.y : 0;
  }
  const vivo = () => ['bus', 'falling', 'glider', 'ground', 'auto'].includes(me.state);
  const alturaEn = (x, z) => Math.max(0, world.terrainHeight(x, z));

  // ---------- Marcas ----------
  function crearMarca(id, p, color, nombre) {
    quitarMarca(id, false);
    const haz = new THREE.Mesh(HAZ_GEO, materialHaz(color));
    const aro = new THREE.Mesh(ARO_GEO, materialAro(color));
    haz.frustumCulled = false; haz.renderOrder = 5; aro.renderOrder = 5;
    haz.position.set(p[0], p[1], p[2]); aro.position.set(p[0], p[1] + 0.08, p[2]);
    haz.userData.keep = true; aro.userData.keep = true;
    scene.add(haz, aro);
    const et = el('div', 'marca-et' + (id === getMyId() ? ' mia' : ''));
    et.style.setProperty('--c', color);
    et.innerHTML = `<div class="mc"><i></i><span class="n"></span><b></b></div>`;
    et.querySelector('.n').textContent = id === getMyId() ? '' : nombre;
    capaEt.append(et);
    marcas.set(id, { x: p[0], y: p[1], z: p[2], color, nombre, haz, aro, et, t0: performance.now() });
  }
  function quitarMarca(id, sonido = true) {
    const m = marcas.get(id);
    if (!m) return;
    scene.remove(m.haz, m.aro);
    m.haz.material.dispose(); m.aro.material.dispose();
    m.et.remove();
    marcas.delete(id);
    if (sonido && id === getMyId()) sfx.quitarMarca?.();
  }
  /** Pone (p = [x, y, z]) o saca (p = null) la marca propia y se la avisa a la sala si se comparte. */
  function ponerMarca(p) {
    const id = getMyId();
    if (p) {
      crearMarca(id, p, me.color || '#ffd23f', me.name || 'Vos');
      sfx.marca?.();
    } else if (marcas.has(id)) quitarMarca(id);
    else return;
    if (opcion('compartirMarcas')) sendMsg({ t: 'marca', p: p ? p.map((v) => Math.round(v * 10) / 10) : null });
    sucio = true;
  }
  /** Marca en (x, z) (y opcional): si ya había una marca propia cerca, se saca. tol = cuánto es "cerca" en metros. */
  function marcarEn(x, z, y = null, tol = 5) {
    if (!world || !vivo()) return false;
    const half = world.size / 2;
    if (Math.abs(x) > half || Math.abs(z) > half) return false;
    const mia = marcas.get(getMyId());
    if (mia && Math.hypot(mia.x - x, mia.z - z) < tol) { ponerMarca(null); return true; }
    ponerMarca([x, y ?? alturaEn(x, z), z]);
    return true;
  }
  // Tecla de marcar: con el mapa abierto, donde está el mouse; si no, donde apunta la cámara (lo primero que toca el rayo).
  const _o = new THREE.Vector3(), _d = new THREE.Vector3();
  function marcar() {
    if (!world || !vivo()) return false;
    if (abierto) return raton.dentro ? marcarEn(raton.x, raton.z, null, (14 * dpr()) / vista.k) : false;
    camera.getWorldPosition(_o); camera.getWorldDirection(_d);
    const alcance = 1500;
    let dist = opts.rayo ? opts.rayo(_o, _d, alcance) : Infinity;
    const dt = world.rayTerrain(_o, _d, Math.min(dist, alcance));
    if (dt < dist) dist = dt;
    if (!(dist < alcance)) {
      // mirando al cielo o al mar abierto: si se mira hacia abajo, al agua (y = 0)
      if (_d.y < -0.02) dist = -_o.y / _d.y; else return false;
    }
    const x = _o.x + _d.x * dist, y = Math.max(0, _o.y + _d.y * dist), z = _o.z + _d.z * dist;
    return marcarEn(x, z, y, Math.max(4, Math.hypot(x - _o.x, z - _o.z) * 0.04));
  }
  function mensaje(m) {
    if (m.t !== 'marca' || m.id === getMyId()) return;
    if (!m.p) { quitarMarca(m.id); sucio = true; return; }
    const info = getRoom()?.players.find((q) => q.id === m.id);
    crearMarca(m.id, m.p, info?.color || '#ffffff', info?.name || 'Jugador');
    sucio = true;
  }
  /** Partida nueva: se borran las marcas y se ponen las que mande el servidor ([[id, [x, y, z]], ...]). */
  function reiniciar(lista = []) {
    for (const id of [...marcas.keys()]) quitarMarca(id, false);
    for (const [id, p] of lista || []) mensaje({ t: 'marca', id, p });
    radioMini = null;
    vista.zoom = 1; vista.cx = 0; vista.cz = 0;
    sucio = true;
  }

  // ---------- Minimapa ----------
  function radioMinimapa() {
    const pie = RADIO_MINIMAPA[opcion('minimapaZoom')] || RADIO_MINIMAPA.medio;
    if (me.state === 'bus') return 380;
    if (me.state === 'falling' || me.state === 'glider') return 230;
    if (me.state === 'auto') return pie * 1.45;
    return pie;
  }
  function dibujarMinimapa(t, dt) {
    const css = minimapa.clientWidth || 180, W = Math.round(css * dpr());
    if (minimapa.width !== W) { minimapa.width = W; minimapa.height = W; }
    const ctx = minimapa.getContext('2d');
    const p = posicionMia() || { x: 0, z: 0 };
    const objetivo = posicionMia() ? radioMinimapa() : world.size / 2;
    radioMini = radioMini === null ? objetivo : radioMini + (objetivo - radioMini) * Math.min(1, dt * 3);
    const R = radioMini, k = W / (2 * R);
    const ox = W / 2 - p.x * k, oy = W / 2 - p.z * k;
    mar(ctx, W, W);
    ctx.imageSmoothingQuality = 'high';
    dibujarBase(ctx, base, k, ox, oy, W, W);
    ctx.save();
    ctx.translate(ox, oy);
    capasDinamicas(ctx, k, t, false);
    // nombres de los pueblos que entran
    ctx.font = `800 ${Math.round(9.5 * dpr())}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = 3 * dpr(); ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.fillStyle = '#fff';
    for (const q of world.pois) {
      const x = (q.x + (q.lx || 0)) * k, y = (q.z + (q.lz || 0)) * k;
      // solo los nombres que entran enteros
      const mw = ctx.measureText(q.name.toUpperCase()).width / 2 + 2;
      if (x + ox < mw || x + ox > W - mw || y + oy < 8 * dpr() || y + oy > W - 8 * dpr()) continue;
      ctx.strokeText(q.name.toUpperCase(), x, y); ctx.fillText(q.name.toUpperCase(), x, y);
    }
    ctx.restore();
    // marcas: si quedan afuera, contra el borde
    const m0 = 9 * dpr();
    for (const m of marcas.values()) {
      let x = ox + m.x * k, y = oy + m.z * k;
      const dx = x - W / 2, dy = y - W / 2, lim = W / 2 - m0;
      const f = Math.max(Math.abs(dx), Math.abs(dy)) > lim ? lim / Math.max(Math.abs(dx), Math.abs(dy)) : 1;
      x = W / 2 + dx * f; y = W / 2 + dy * f;
      pin(ctx, x, y + (f < 1 ? 7 * dpr() : 0), (f < 1 ? 7 : 9) * dpr(), m.color);
    }
    const yo = posicionMia();
    if (me.state === 'bus') iconoBus(ctx, W / 2, W / 2, 7 * dpr(), giroBus());
    else if (yo) flecha(ctx, W / 2, W / 2, 7.5 * dpr(), giroMio(), me.state === 'dead' || me.state === 'ended' ? '#9fe8ff' : '#ffd23f');
    // norte
    ctx.font = `900 ${Math.round(10 * dpr())}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.lineWidth = 3 * dpr(); ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.fillStyle = '#ffd23f';
    ctx.strokeText('N', W / 2, 3 * dpr()); ctx.fillText('N', W / 2, 3 * dpr());
  }
  function giroBus() {
    const b = getRoom()?.bus;
    return b ? rumbo(b.to[0] - b.from[0], b.to[2] - b.from[2]) : 0;
  }
  // Lo que se mueve (en coordenadas ya trasladadas: el punto (x, z) va a (x * k, z * k)): tormenta, recorrido del
  // bus, autos y la línea hasta la zona segura.
  function capasDinamicas(ctx, k, t, grande) {
    const s = tormentaActual;
    tormenta(ctx, s, k, grande);
    const room = getRoom(), b = room?.bus, bus = getBus();
    if (b && (me.state === 'bus' || t < b.start + b.duration)) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,210,63,.95)'; ctx.lineWidth = (grande ? 3 : 2) * dpr(); ctx.setLineDash([8 * dpr(), 6 * dpr()]);
      ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 3;
      ctx.beginPath(); ctx.moveTo(b.from[0] * k, b.from[2] * k); ctx.lineTo(b.to[0] * k, b.to[2] * k); ctx.stroke();
      ctx.restore();
      if (bus?.visible && me.state !== 'bus') iconoBus(ctx, bus.position.x * k, bus.position.z * k, (grande ? 8 : 6) * dpr(), giroBus());
    }
    autos?.minimapa?.(ctx, (v) => v * k, k);
    // afuera de la próxima zona: línea punteada hasta el borde más cercano (como guía para llegar)
    const yo = posicionMia();
    if (s?.next && yo && me.state !== 'bus') {
      const n = s.next, d = Math.hypot(yo.x - n.x, yo.z - n.z);
      if (d > n.r && n.r > 0) {
        const bx = n.x + ((yo.x - n.x) / d) * n.r, bz = n.z + ((yo.z - n.z) / d) * n.r;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.6 * dpr(); ctx.setLineDash([2 * dpr(), 4 * dpr()]);
        ctx.beginPath(); ctx.moveTo(yo.x * k, yo.z * k); ctx.lineTo(bx * k, bz * k); ctx.stroke();
        ctx.restore();
      }
    }
  }

  // ---------- Mapa grande ----------
  const vista = { cx: 0, cz: 0, zoom: 1, k: 1, ox: 0, oy: 0, W: 0 };
  const raton = { dentro: false, x: 0, z: 0, px: 0, py: 0, arrastre: null };
  let estatico = null, sucio = true, tLado = 0;
  const ZOOM_MAX = 7;
  function medir() {
    const css = lienzo.clientWidth || 600, W = Math.round(css * dpr());
    if (lienzo.width !== W) { lienzo.width = W; lienzo.height = W; sucio = true; }
    vista.W = W;
    vista.k = (W / (world.size * 1.04)) * vista.zoom;
    vista.ox = W / 2 - vista.cx * vista.k; vista.oy = W / 2 - vista.cz * vista.k;
  }
  function limitarVista() {
    vista.zoom = Math.max(1, Math.min(ZOOM_MAX, vista.zoom));
    const lim = Math.max(0, world.size / 2 - world.size / 2 / vista.zoom) + 20;
    vista.cx = Math.max(-lim, Math.min(lim, vista.cx)); vista.cz = Math.max(-lim, Math.min(lim, vista.cz));
    if (vista.zoom === 1) { vista.cx = 0; vista.cz = 0; }
  }
  function zoomEn(f, px = null, py = null) {
    medir();
    const W = vista.W;
    const ax = px ?? W / 2, ay = py ?? W / 2;
    const wx = (ax - vista.ox) / vista.k, wz = (ay - vista.oy) / vista.k;
    vista.zoom = Math.max(1, Math.min(ZOOM_MAX, vista.zoom * f));
    const k = (W / (world.size * 1.04)) * vista.zoom;
    // el punto bajo el mouse queda en el mismo lugar
    vista.cx = wx - (ax - W / 2) / k; vista.cz = wz - (ay - W / 2) / k;
    limitarVista();
    sucio = true;
  }
  function pintarEstatico() {
    medir();
    const { W, k, ox, oy } = vista;
    if (!estatico) estatico = document.createElement('canvas');
    if (estatico.width !== W) { estatico.width = W; estatico.height = W; }
    const ctx = estatico.getContext('2d');
    mar(ctx, W, W);
    ctx.imageSmoothingQuality = 'high';
    // con poco zoom alcanza la imagen ya horneada; con más, terreno y calles a la resolución de la pantalla
    const pxm = PIXELES_BASE / world.size;
    if (k <= pxm * 1.15) dibujarBase(ctx, base, k, ox, oy, W, W);
    else {
      dibujarBase(ctx, terreno, k, ox, oy, W, W);
      ctx.save(); ctx.translate(ox, oy);
      pintarVectores(ctx, world, k, { x0: -ox / k, z0: -oy / k, x1: (W - ox) / k, z1: (W - oy) / k });
      ctx.restore();
    }
    // grilla A-J / 1-10
    const half = world.size / 2, n = Math.round(world.size / CELDA);
    ctx.save(); ctx.translate(ox, oy);
    ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const v = (-half + i * CELDA) * k;
      ctx.moveTo(v, -half * k); ctx.lineTo(v, half * k); ctx.moveTo(-half * k, v); ctx.lineTo(half * k, v);
    }
    ctx.stroke();
    // nombres de los pueblos
    const fs = Math.round((12 + 3 * Math.log2(vista.zoom)) * dpr());
    ctx.font = `900 ${fs}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = fs * 0.32; ctx.strokeStyle = 'rgba(10,14,30,.75)'; ctx.fillStyle = '#fff';
    for (const q of world.pois) {
      const x = (q.x + (q.lx || 0)) * k, y = (q.z + (q.lz || 0)) * k;
      ctx.strokeText(q.name.toUpperCase(), x, y); ctx.fillText(q.name.toUpperCase(), x, y);
    }
    ctx.restore();
    // letras y números de la grilla contra los bordes
    ctx.font = `800 ${Math.round(11 * dpr())}px system-ui, sans-serif`; ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 3 * dpr();
    for (let i = 0; i < n; i++) {
      const c = ox + (-half + (i + 0.5) * CELDA) * k, f = oy + (-half + (i + 0.5) * CELDA) * k;
      const L = String.fromCharCode(65 + i), N = String(i + 1);
      if (c > 0 && c < W) { ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.strokeText(L, c, 5 * dpr()); ctx.fillText(L, c, 5 * dpr()); }
      if (f > 0 && f < W) { ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.strokeText(N, 6 * dpr(), f); ctx.fillText(N, 6 * dpr(), f); }
    }
    sucio = false;
  }
  function dibujarGrande(t) {
    medir();
    if (sucio || !estatico) pintarEstatico();
    const { k, ox, oy } = vista;
    const ctx = lienzo.getContext('2d');
    ctx.drawImage(estatico, 0, 0);
    ctx.save(); ctx.translate(ox, oy);
    capasDinamicas(ctx, k, t, true);
    ctx.restore();
    for (const [id, m] of marcas) {
      const x = ox + m.x * k, y = oy + m.z * k;
      if (id === getMyId()) {
        const f = ((performance.now() - m.t0) / 1400) % 1;
        ctx.beginPath(); ctx.arc(x, y, (6 + f * 18) * dpr(), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${(1 - f) * 0.8})`; ctx.lineWidth = 2 * dpr(); ctx.stroke();
      }
      pin(ctx, x, y, 13 * dpr(), m.color);
    }
    const yo = posicionMia();
    if (me.state === 'bus' && yo) iconoBus(ctx, ox + yo.x * k, oy + yo.z * k, 9 * dpr(), giroBus());
    else if (yo) flecha(ctx, ox + yo.x * k, oy + yo.z * k, 10 * dpr(), giroMio(), me.state === 'dead' || me.state === 'ended' ? '#9fe8ff' : '#ffd23f');
    // mira del mouse
    if (raton.dentro && !raton.arrastre?.movio) {
      const x = raton.px, y = raton.py, r = 7 * dpr();
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.5 * dpr();
      ctx.beginPath(); ctx.moveTo(x - r * 2, y); ctx.lineTo(x - r * 0.6, y); ctx.moveTo(x + r * 0.6, y); ctx.lineTo(x + r * 2, y);
      ctx.moveTo(x, y - r * 2); ctx.lineTo(x, y - r * 0.6); ctx.moveTo(x, y + r * 0.6); ctx.lineTo(x, y + r * 2); ctx.stroke();
    }
    if (t - tLado > 200) { tLado = t; actualizarLado(); }
  }
  function lugarDe(x, z) {
    const q = world.pois.find((p) => Math.hypot(p.x - x, p.z - z) < p.r + 15);
    return `${celdaDe(x, z, world.size)}${q ? ' · ' + q.name : ''}`;
  }
  function actualizarLado() {
    const yo = posicionMia();
    donde.textContent = yo ? `Estás en ${lugarDe(yo.x, yo.z)}` : 'Mirando la isla';
    infoTormenta.textContent = opts.textoTormenta?.() || '';
    const filas = [...marcas.entries()].map(([id, m]) => {
      const d = yo ? textoDistancia(Math.hypot(m.x - yo.x, m.z - yo.z)) : '';
      const quien = id === getMyId() ? 'Tu marca' : m.nombre;
      return `<li style="--c:${m.color}"><i></i><span>${escapar(quien)}</span><small>${lugarDe(m.x, m.z)}</small><b>${d}</b></li>`;
    });
    lista.innerHTML = filas.length ? filas.join('') : '<li class="vacia">Todavía no hay marcas. Hacé clic en el mapa para poner la tuya.</li>';
    btnQuitar.disabled = !marcas.has(getMyId());
    if (raton.dentro) {
      const d = yo ? ` · a ${textoDistancia(Math.hypot(raton.x - yo.x, raton.z - yo.z))}` : '';
      cursorEt.textContent = lugarDe(raton.x, raton.z) + d;
      cursorEt.style.left = `${raton.px / dpr()}px`; cursorEt.style.top = `${raton.py / dpr()}px`;
      cursorEt.classList.remove('hidden');
    } else cursorEt.classList.add('hidden');
  }
  function escapar(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function leerRaton(e) {
    const r = lienzo.getBoundingClientRect();
    raton.px = (e.clientX - r.left) * dpr(); raton.py = (e.clientY - r.top) * dpr();
    raton.x = (raton.px - vista.ox) / vista.k; raton.z = (raton.py - vista.oy) / vista.k;
    raton.dentro = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  }
  lienzo.addEventListener('mousedown', (e) => {
    e.preventDefault();
    leerRaton(e);
    if (e.button === 0) raton.arrastre = { x: e.clientX, y: e.clientY, cx: vista.cx, cz: vista.cz, movio: false };
    else if (e.button === 2) ponerMarca(null);
  });
  window.addEventListener('mousemove', (e) => {
    if (!abierto) return;
    leerRaton(e);
    const a = raton.arrastre;
    if (a) {
      const dx = e.clientX - a.x, dy = e.clientY - a.y;
      if (!a.movio && Math.hypot(dx, dy) > 5) a.movio = true;
      if (a.movio) {
        vista.cx = a.cx - (dx * dpr()) / vista.k; vista.cz = a.cz - (dy * dpr()) / vista.k;
        limitarVista(); sucio = true;
      }
    }
  });
  window.addEventListener('mouseup', (e) => {
    const a = raton.arrastre;
    raton.arrastre = null;
    if (!abierto || !a || e.button !== 0) return;
    leerRaton(e);
    if (!a.movio && raton.dentro) marcarEn(raton.x, raton.z, null, 14 * dpr() / vista.k);
  });
  lienzo.addEventListener('mouseleave', () => { raton.dentro = false; });
  lienzo.addEventListener('wheel', (e) => {
    e.preventDefault();
    leerRaton(e);
    zoomEn(e.deltaY < 0 ? 1.25 : 1 / 1.25, raton.px, raton.py);
  }, { passive: false });
  lienzo.addEventListener('dblclick', (e) => { leerRaton(e); zoomEn(2, raton.px, raton.py); });

  function abrir() {
    if (abierto || !world || hud.classList.contains('hidden')) return;
    abierto = true;
    // se abre centrado en el jugador con un poco de zoom (en el bus, la isla entera para elegir dónde caer)
    const yo = posicionMia();
    vista.zoom = me.state === 'bus' || !yo ? 1 : 1.8;
    vista.cx = yo?.x || 0; vista.cz = yo?.z || 0;
    limitarVista();
    raiz.classList.remove('hidden');
    minimapa.classList.add('hidden');
    sucio = true; tLado = 0;
    opts.alAbrir?.();
    sfx.click?.();
  }
  function cerrar() {
    if (!abierto) return;
    abierto = false;
    raton.arrastre = null; raton.dentro = false;
    raiz.classList.add('hidden');
    minimapa.classList.remove('hidden');
    opts.alCerrar?.();
  }

  // ---------- Brújula ----------
  const PUNTOS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  function dibujarBrujula() {
    const cssW = brujula.clientWidth || 420, cssH = brujula.clientHeight || 42;
    const W = Math.round(cssW * dpr()), H = Math.round(cssH * dpr());
    if (brujula.width !== W || brujula.height !== H) { brujula.width = W; brujula.height = H; }
    const ctx = brujula.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const yo = posicionMia();
    if (!yo || abierto) { brujula.classList.add('apagada'); return; }
    brujula.classList.remove('apagada');
    const cara = giroMio(), campo = Math.PI * 0.62; // grados visibles de lado a lado
    const aX = (ang) => { let d = ang - cara; d = Math.atan2(Math.sin(d), Math.cos(d)); return Math.abs(d) > campo / 2 ? null : W / 2 + (d / campo) * W; };
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.15, 'rgba(0,0,0,.42)'); g.addColorStop(0.85, 'rgba(0,0,0,.42)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.56);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let gr = 0; gr < 360; gr += 5) {
      const x = aX((gr * Math.PI) / 180);
      if (x === null) continue;
      const alfa = 1 - Math.abs(x - W / 2) / (W / 2);
      if (gr % 45 === 0) {
        ctx.font = `900 ${Math.round(13 * dpr())}px system-ui, sans-serif`;
        ctx.fillStyle = gr === 0 ? `rgba(255,210,63,${alfa})` : `rgba(255,255,255,${alfa})`;
        ctx.fillText(PUNTOS[gr / 45], x, H * 0.28);
      } else if (gr % 15 === 0) {
        ctx.font = `700 ${Math.round(9 * dpr())}px system-ui, sans-serif`;
        ctx.fillStyle = `rgba(255,255,255,${alfa * 0.75})`;
        ctx.fillText(String(gr), x, H * 0.28);
      } else {
        ctx.fillStyle = `rgba(255,255,255,${alfa * 0.5})`;
        ctx.fillRect(x - 0.5 * dpr(), H * 0.22, 1 * dpr(), H * 0.12);
      }
    }
    // marcas en la brújula, con la distancia abajo
    for (const m of marcas.values()) {
      const x = aX(rumbo(m.x - yo.x, m.z - yo.z));
      if (x === null) continue;
      pin(ctx, x, H * 0.62, 6.5 * dpr(), m.color);
      ctx.font = `800 ${Math.round(9.5 * dpr())}px system-ui, sans-serif`; ctx.fillStyle = '#fff';
      ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3 * dpr(); ctx.lineJoin = 'round';
      const d = textoDistancia(Math.hypot(m.x - yo.x, m.z - yo.z));
      ctx.strokeText(d, x, H * 0.84); ctx.fillText(d, x, H * 0.84);
    }
    // zona segura si se está afuera
    const n = tormentaActual?.next;
    if (n && Math.hypot(yo.x - n.x, yo.z - n.z) > n.r) {
      const x = aX(rumbo(n.x - yo.x, n.z - yo.z));
      if (x !== null) {
        ctx.beginPath(); ctx.arc(x, H * 0.62 - 4 * dpr(), 4.5 * dpr(), 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = '#8a4dff'; ctx.lineWidth = 2 * dpr(); ctx.stroke();
      }
    }
    // hacia dónde se mira
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.moveTo(W / 2 - 5 * dpr(), H * 0.5); ctx.lineTo(W / 2 + 5 * dpr(), H * 0.5); ctx.lineTo(W / 2, H * 0.5 - 6 * dpr()); ctx.fill();
  }

  // ---------- Haces y etiquetas en el mundo ----------
  const _p = new THREE.Vector3();
  function actualizarMundo() {
    const w = window.innerWidth, h = window.innerHeight;
    const yo = posicionMia();
    const cam = camera.position, t = performance.now() / 1000;
    for (const [id, m] of marcas) {
      const dCam = Math.hypot(m.x - cam.x, m.z - cam.z);
      const fade = suave(3, 22, dCam);
      m.haz.material.uniforms.uFade.value = fade * (id === getMyId() ? 1 : 0.85);
      m.haz.material.uniforms.uT.value = t;
      const ancho = Math.max(1, dCam / 70);
      m.haz.scale.set(ancho, 1, ancho);
      const pulso = ((performance.now() - m.t0) / 1300) % 1;
      m.aro.scale.setScalar(1 + pulso * 1.6);
      m.aro.material.opacity = (1 - pulso) * 0.85 * fade;
      // etiqueta: sobre la marca, o contra el borde de la pantalla si queda afuera o atrás
      _p.set(m.x, m.y + 2.2, m.z).project(camera);
      const atras = _p.z > 1;
      let x = _p.x, y = _p.y;
      if (atras) { x = -x; y = -y; }
      const mg = 0.92, fuera = atras || Math.abs(x) > mg || Math.abs(y) > mg;
      if (fuera) { const f = mg / Math.max(Math.abs(x), Math.abs(y), 1e-3); x *= f; y *= f; if (atras && Math.abs(y) < 0.5) y = -0.5; }
      m.et.style.transform = `translate(${((x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-y * 0.5 + 0.5) * h).toFixed(1)}px)`;
      m.et.classList.toggle('borde', fuera);
      const d = yo ? Math.hypot(m.x - yo.x, m.z - yo.z) : dCam;
      m.et.querySelector('b').textContent = textoDistancia(d);
      m.et.classList.toggle('cerca', d < 8);
    }
  }

  // ---------- Cada cuadro ----------
  function update(dt, t, s) {
    if (!world || !base) return;
    tormentaActual = s;
    if (abierto) dibujarGrande(t);
    else dibujarMinimapa(t, dt);
    dibujarBrujula();
    actualizarMundo();
  }

  return {
    preparar, reiniciar, update, abrir, cerrar, marcar, marcarEn, ponerMarca, mensaje,
    alternar() { if (abierto) cerrar(); else abrir(); },
    quitar(id) { quitarMarca(id, false); sucio = true; },
    get abierto() { return abierto; },
    get marcas() { return marcas; },
    get vista() { return vista; },
    get base() { return base; },
    get terreno() { return terreno; },
    /** Para pruebas: punto del mundo → píxel del mapa grande (en píxeles de CSS, relativos al lienzo). */
    aPantalla(x, z) { medir(); return { x: (vista.ox + x * vista.k) / dpr(), y: (vista.oy + z * vista.k) / dpr() }; },
  };
}
