// Mallas de las construcciones de los jugadores (sólo cliente): piezas con textura por material y marco,
// vista previa (holograma), grilla de edición y la animación de la pieza que se va levantando.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GRID, MATERIALS } from './items.js';
import { T3, ALTO_TECHO, ESPESOR, sacada, triangulosTecho, BALDOSAS, superficie } from './construccion.js';

const G = GRID;
const VIGA = 0.16; // ancho del marco

// ---------- Texturas (una baldosa de T3 metros, se repiten sin cortes) ----------
function azar(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function lienzo(dibujar, seed) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const ctx = cv.getContext('2d');
  dibujar(ctx, azar(seed));
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
const hsl = (h, s, l) => `hsl(${h},${s}%,${l}%)`;

function texMadera(ctx, r) {
  // 4 tablas horizontales con veta, juntas desfasadas y clavos
  for (let p = 0; p < 4; p++) {
    const y = p * 64, l = 44 + r() * 9, h = 27 + r() * 6;
    ctx.fillStyle = hsl(h, 52, l); ctx.fillRect(0, y, 256, 64);
    for (let k = 0; k < 18; k++) { // veta: ondas con período que divide 256 (sin corte al repetir)
      const yy = y + 4 + r() * 56, amp = 1 + r() * 2.5, fase = r() * 6.28, f = (1 + Math.floor(r() * 3)) * Math.PI * 2 / 256;
      ctx.strokeStyle = `rgba(70,35,10,${0.08 + r() * 0.16})`; ctx.lineWidth = 0.8 + r() * 1.4;
      ctx.beginPath();
      for (let x = 0; x <= 256; x += 8) ctx.lineTo(x, yy + Math.sin(x * f + fase) * amp);
      ctx.stroke();
    }
    if (r() < 0.6) { // nudo
      const kx = 30 + r() * 196, ky = y + 18 + r() * 28;
      ctx.fillStyle = 'rgba(80,40,15,.45)'; ctx.beginPath(); ctx.ellipse(kx, ky, 6 + r() * 4, 3 + r() * 2, 0, 0, 7); ctx.fill();
    }
    const junta = (p % 2 ? 64 : 192) + Math.floor(r() * 24 - 12);
    ctx.fillStyle = 'rgba(50,25,8,.75)'; ctx.fillRect(junta, y, 3, 64);
    ctx.fillStyle = 'rgba(255,230,190,.18)'; ctx.fillRect(0, y + 2, 256, 2); // canto con luz
    ctx.fillStyle = 'rgba(40,18,5,.85)'; ctx.fillRect(0, y + 61, 256, 3); // separación entre tablas
    ctx.fillStyle = '#3b2a1e';
    for (const nx of [junta - 9, junta + 12]) for (const ny of [y + 16, y + 46]) { ctx.beginPath(); ctx.arc(nx, ny, 2.4, 0, 7); ctx.fill(); }
  }
}
function texPiedra(ctx, r) {
  // bloques de piedra con junta, desfasados por hilada, con bisel
  ctx.fillStyle = '#8d8a85'; ctx.fillRect(0, 0, 256, 256);
  for (let f = 0; f < 4; f++) {
    const y = f * 64, off = f % 2 ? 64 : 0;
    for (let c = -1; c < 3; c++) {
      const x = c * 128 + off;
      const l = 52 + r() * 14, h = 30 + r() * 20;
      ctx.fillStyle = hsl(h, 6 + r() * 6, l);
      for (const dx of [0, 256, -256]) ctx.fillRect(x + dx + 4, y + 4, 120, 56);
      for (let k = 0; k < 120; k++) { // grano
        const px = x + 4 + r() * 120, py = y + 4 + r() * 56;
        ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.09)';
        for (const dx of [0, 256, -256]) ctx.fillRect(px + dx, py, 2 + r() * 3, 2 + r() * 3);
      }
      for (const dx of [0, 256, -256]) {
        ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(x + dx + 4, y + 4, 120, 3); ctx.fillRect(x + dx + 4, y + 4, 3, 56);
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + dx + 4, y + 57, 120, 3); ctx.fillRect(x + dx + 121, y + 4, 3, 56);
      }
      if (r() < 0.35) { // grieta
        ctx.strokeStyle = 'rgba(40,40,40,.4)'; ctx.lineWidth = 1.2; ctx.beginPath();
        let px = x + 20 + r() * 80, py = y + 8;
        ctx.moveTo(px, py);
        while (py < y + 56) { px += r() * 10 - 5; py += 4 + r() * 6; ctx.lineTo(px, py); }
        ctx.stroke();
      }
    }
  }
}
function texMetal(ctx, r) {
  // chapa acanalada vertical con remaches arriba y abajo
  for (let c = 0; c < 8; c++) {
    const x = c * 32;
    const g = ctx.createLinearGradient(x, 0, x + 32, 0);
    g.addColorStop(0, '#5f6f7e'); g.addColorStop(0.35, '#b9c6d2'); g.addColorStop(0.55, '#8597a8'); g.addColorStop(1, '#55636f');
    ctx.fillStyle = g; ctx.fillRect(x, 0, 32, 256);
  }
  for (let k = 0; k < 60; k++) { // rayones
    ctx.strokeStyle = `rgba(255,255,255,${0.05 + r() * 0.1})`; ctx.lineWidth = 0.7;
    const x = r() * 256, y = r() * 256, a = r() * 0.6 - 0.3, len = 6 + r() * 20;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(30,40,50,.55)'; ctx.fillRect(0, 0, 256, 6); ctx.fillRect(0, 250, 256, 6);
  for (let c = 0; c < 8; c++) for (const y of [16, 240]) {
    const x = c * 32 + 16;
    ctx.fillStyle = '#3c4650'; ctx.beginPath(); ctx.arc(x + 1, y + 1, 4.2, 0, 7); ctx.fill();
    ctx.fillStyle = '#c8d3dd'; ctx.beginPath(); ctx.arc(x, y, 3.4, 0, 7); ctx.fill();
  }
  for (let k = 0; k < 6; k++) { // óxido suave
    const x = r() * 256, y = r() * 256, rad = 8 + r() * 20;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(140,80,40,.16)'); g.addColorStop(1, 'rgba(140,80,40,0)');
    ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}

const MATS = {};
function materiales(m) {
  if (MATS[m]) return MATS[m];
  const dibujo = { madera: texMadera, piedra: texPiedra, metal: texMetal }[m];
  const tex = lienzo(dibujo, { madera: 11, piedra: 23, metal: 37 }[m]);
  const met = m === 'metal';
  const panel = new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: met ? 1.2 : 2, roughness: met ? 0.5 : 0.88, metalness: met ? 0.2 : 0 });
  const marco = new THREE.MeshStandardMaterial({
    map: tex, color: { madera: '#8a6446', piedra: '#8e8e94', metal: '#6c7884' }[m],
    roughness: met ? 0.45 : 0.85, metalness: met ? 0.3 : 0,
  });
  MATS[m] = { panel, marco };
  return MATS[m];
}
const HOLO = new THREE.MeshBasicMaterial({ color: '#59b8ff', transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
const HOLO_LINEA = new THREE.LineBasicMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.85 });

// ---------- Geometría ----------
// UV según la posición: cada cara toma los dos ejes de su plano dominante, así la textura queda alineada entre piezas.
function uvMundo(geo) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); } else if (ax >= az) { u = p.getZ(i); v = p.getY(i); } else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u / T3; uv[i * 2 + 1] = v / T3;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
function caja(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  g.translate(x, y, z);
  return uvMundo(g);
}
// Viga orientada de a hasta b.
function viga(a, b, w, h = w) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const g = new THREE.BoxGeometry(w, h, len).toNonIndexed();
  uvMundo(g);
  const m = new THREE.Matrix4().lookAt(vb, va, Math.abs(vb.y - va.y) > len * 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0));
  m.setPosition(va.clone().add(vb).multiplyScalar(0.5));
  g.applyMatrix4(m);
  return g;
}
function juntar(lista) {
  if (!lista.length) return null;
  const g = mergeGeometries(lista, false);
  lista.forEach((x) => x.dispose());
  g.computeBoundingSphere();
  return g;
}

// Marco de una grilla de celdas (n x m) en el plano a,b: vigas en los bordes de las celdas presentes que dan a un hueso o al borde,
// y tacos en las esquinas (un poco más grandes, para que no titilen las caras que se cruzan).
function marcoGrilla(n, m, lado, hay, vigaA, vigaB, taco) {
  const out = [], esquinas = new Set();
  for (let b = 0; b < m; b++) for (let a = 0; a < n; a++) {
    if (!hay(a, b)) continue;
    const libre = (aa, bb) => aa < 0 || bb < 0 || aa >= n || bb >= m || !hay(aa, bb);
    if (libre(a, b - 1)) { out.push(vigaA(a, b)); esquinas.add(`${a},${b}`).add(`${a + 1},${b}`); }
    if (libre(a, b + 1)) { out.push(vigaA(a, b + 1)); esquinas.add(`${a},${b + 1}`).add(`${a + 1},${b + 1}`); }
    if (libre(a - 1, b)) { out.push(vigaB(a, b)); esquinas.add(`${a},${b}`).add(`${a},${b + 1}`); }
    if (libre(a + 1, b)) { out.push(vigaB(a + 1, b)); esquinas.add(`${a + 1},${b}`).add(`${a + 1},${b + 1}`); }
  }
  for (const e of esquinas) { const [a, b] = e.split(',').map(Number); out.push(taco(a * lado, b * lado)); }
  return out;
}

// Pared en el marco de dir 0 (plano z=0, de x=0 a G); para dir 3 se gira.
function geoPared(s) {
  const pan = [], hay = (c, f) => !sacada(s, f * 3 + c);
  for (let f = 0; f < 3; f++) {
    for (let c = 0; c < 3;) {
      if (!hay(c, f)) { c++; continue; }
      let c1 = c; while (c1 < 3 && hay(c1, f)) c1++;
      pan.push(caja((c1 - c) * T3, T3, ESPESOR, (c + c1) / 2 * T3, f * T3 + T3 / 2, 0));
      c = c1;
    }
  }
  const mar = marcoGrilla(3, 3, T3, hay,
    (c, f) => caja(T3, VIGA, 0.33, c * T3 + T3 / 2, f * T3, 0),
    (c, f) => caja(VIGA, T3, 0.3, c * T3, f * T3 + T3 / 2, 0),
    (x, y) => caja(VIGA + 0.03, VIGA + 0.03, 0.36, x, y, 0));
  return { pan, mar, giro: s.dir === 3 ? -Math.PI / 2 : 0 };
}

function geoPiso(s) {
  const L = G / 2, pan = [], hay = (cx, cz) => !sacada(s, cz * 2 + cx);
  for (let cz = 0; cz < 2; cz++) {
    for (let cx = 0; cx < 2;) {
      if (!hay(cx, cz)) { cx++; continue; }
      let c1 = cx; while (c1 < 2 && hay(c1, cz)) c1++;
      pan.push(caja((c1 - cx) * L, ESPESOR, L, (cx + c1) / 2 * L, -ESPESOR / 2, cz * L + L / 2));
      cx = c1;
    }
  }
  const mar = marcoGrilla(2, 2, L, hay,
    (cx, cz) => caja(L, 0.3, VIGA, cx * L + L / 2, -ESPESOR / 2 + 0.03, cz * L),
    (cx, cz) => caja(VIGA, 0.28, L, cx * L, -ESPESOR / 2 + 0.03, cz * L + L / 2),
    (x, z) => caja(VIGA + 0.03, 0.34, VIGA + 0.03, x, -ESPESOR / 2 + 0.035, z));
  return { pan, mar, giro: 0 };
}

// Rampa en el marco de dir 0 (sube hacia -Z); se gira según dir.
function geoRampa(s) {
  const L = Math.hypot(G, G), pan = [], mar = [];
  const local = (l) => (s.dir >= 2 ? 2 - l : l); // carril local -> carril del mundo
  const hay = (l) => !sacada(s, local(l));
  const inclinar = (g) => { g.rotateX(Math.PI / 4); g.translate(0, G / 2 - 0.12, G / 2); return g; };
  for (let l = 0; l < 3;) {
    if (!hay(l)) { l++; continue; }
    let l1 = l; while (l1 < 3 && hay(l1)) l1++;
    const w = (l1 - l) * T3, xm = (l + l1) / 2 * T3;
    pan.push(inclinar(caja(w, ESPESOR, L, xm, 0, 0)));
    for (let k = 0; k < 10; k++) mar.push(inclinar(caja(w - 0.04, 0.05, 0.09, xm, ESPESOR / 2 + 0.02, -L / 2 + 0.3 + k * (L - 0.6) / 9))); // tacos para pisar
    for (const [x, borde] of [[l * T3, l === 0 || !hay(l - 1)], [l1 * T3, l1 === 3 || !hay(l1)]]) {
      if (borde) mar.push(inclinar(caja(VIGA, 0.32, L, x, 0.03, 0)));
    }
    l = l1;
  }
  return { pan, mar, giro: [0, -Math.PI / 2, Math.PI, Math.PI / 2][s.dir] };
}

function geoTecho(s) {
  const x0 = s.i * G, z0 = s.j * G;
  const loc = (p) => [p[0] - x0, p[1] - s.y, p[2] - z0];
  const pos = [];
  const tri = (a, b, c) => pos.push(...a, ...b, ...c);
  const mar = [];
  for (const t of triangulosTecho(s)) {
    let [a, b, c] = t.map(loc);
    // que mire hacia arriba
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    if (ny < 0) [a, b] = [b, a];
    tri(a, b, c);
    tri([a[0], a[1] - 0.12, a[2]], [c[0], c[1] - 0.12, c[2]], [b[0], b[1] - 0.12, b[2]]); // cara de abajo
    // faldón vertical en el borde si alguna esquina está levantada
    if (a[1] > 0.01 || b[1] > 0.01) {
      const a0 = [a[0], 0, a[2]], b0 = [b[0], 0, b[2]];
      tri(a0, b0, b); tri(a0, b, a); tri(a0, b, b0); tri(a0, a, b);
    }
    mar.push(viga(a, b, VIGA, 0.2)); // borde
    mar.push(viga([a[0], a[1] + 0.02, a[2]], [c[0], c[1] + 0.02, c[2]], 0.13, 0.16)); // limatesa hasta la punta
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  uvMundo(g);
  for (const [cx, cz] of [[0, 0], [G, 0], [0, G], [G, G]]) {
    const h = superficie(s, x0 + Math.min(G - 1e-3, cx), z0 + Math.min(G - 1e-3, cz)) - s.y;
    mar.push(caja(VIGA + 0.06, 0.26, VIGA + 0.06, cx, h, cz));
  }
  return { pan: [g], mar, giro: 0 };
}

function geometrias(s) {
  return s.type === 'pared' ? geoPared(s) : s.type === 'piso' ? geoPiso(s) : s.type === 'rampa' ? geoRampa(s) : geoTecho(s);
}

// Malla de una pieza. El grupo se ubica en la esquina (i*GRID, y, j*GRID); dentro, panel y marco.
export function makeStructMesh(s, ghost = false) {
  const g = new THREE.Group();
  const { pan, mar, giro } = geometrias(s);
  const piv = new THREE.Group(); // gira alrededor del centro de la celda (o del borde para la pared)
  if (s.type === 'rampa') { piv.position.set(G / 2, 0, G / 2); piv.rotation.y = giro; } else piv.rotation.y = giro;
  const off = s.type === 'rampa' ? new THREE.Vector3(-G / 2, 0, -G / 2) : new THREE.Vector3();
  const gp = juntar(pan), gm = juntar(mar);
  for (const geo of [gp, gm]) if (geo) geo.translate(off.x, off.y, off.z);
  g.add(piv);
  if (ghost) {
    if (gp) { piv.add(new THREE.Mesh(gp, HOLO)); piv.add(new THREE.LineSegments(new THREE.EdgesGeometry(gp, 25), HOLO_LINEA)); }
    if (gm) piv.add(new THREE.Mesh(gm, HOLO));
  } else {
    const m = materiales(s.mat || 'madera');
    if (gp) { const o = new THREE.Mesh(gp, m.panel); o.castShadow = o.receiveShadow = true; piv.add(o); g.userData.panel = o; }
    if (gm) { const o = new THREE.Mesh(gm, m.marco); o.castShadow = o.receiveShadow = true; piv.add(o); g.userData.marco = o; }
  }
  g.position.set(s.i * G, s.y, s.j * G);
  return g;
}

// Pinta la vista previa: azul si se puede, rojo si no.
const HOLO_NO = HOLO.clone(); HOLO_NO.color.set('#ff5a5a');
const LINEA_NO = HOLO_LINEA.clone(); LINEA_NO.color.set('#ffb0b0');
export function pintarFantasma(g, ok) {
  g.traverse((o) => {
    if (o.isLineSegments) o.material = ok ? HOLO_LINEA : LINEA_NO;
    else if (o.isMesh) o.material = ok ? HOLO : HOLO_NO;
  });
}

export function liberar(g) {
  g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
}

// ---------- Pieza que se levanta: se llena de abajo hacia arriba (pisos y techos de un costado al otro) ----------
export function empezarObra(g, s, total, restante) {
  const panel = g.userData.panel;
  if (!panel || restante <= 0.05) return;
  const vertical = s.type === 'pared' || s.type === 'rampa';
  const plano = new THREE.Plane(vertical ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(-1, 0, 0), 0);
  const holoPlano = new THREE.Plane(plano.normal.clone().negate(), 0);
  const base = panel.material;
  const solido = base.clone(); solido.clippingPlanes = [plano];
  const holo = HOLO.clone(); holo.clippingPlanes = [holoPlano]; holo.opacity = 0.42;
  panel.material = solido;
  const fantasma = new THREE.Mesh(panel.geometry, holo);
  panel.parent.add(fantasma);
  const desde = vertical ? s.y : s.i * G, hasta = vertical ? s.y + (s.type === 'techo' ? ALTO_TECHO : G) : s.i * G + G;
  g.userData.obra = { plano, holoPlano, solido, holo, fantasma, desde, hasta, fin: performance.now() + restante * 1000, total, base };
  avanzarObra(g);
}
// Devuelve true cuando terminó.
export function avanzarObra(g) {
  const o = g.userData.obra;
  if (!o) return true;
  const k = Math.min(1, 1 - (o.fin - performance.now()) / (o.total * 1000));
  const c = o.desde + (o.hasta - o.desde) * (0.08 + 0.92 * Math.max(0, k));
  o.plano.constant = c; o.holoPlano.constant = -c;
  if (k < 1) return false;
  const panel = g.userData.panel;
  panel.material = o.base;
  o.fantasma.parent.remove(o.fantasma);
  o.solido.dispose(); o.holo.dispose();
  g.userData.obra = null;
  return true;
}

// ---------- Grilla de edición ----------
const COL_EDIT = {
  normal: ['#59b8ff', 0.42], marcada: ['#ffffff', 0.07], hover: ['#9fdcff', 0.7], hoverMarcada: ['#ffffff', 0.28],
  // en la rampa y el techo lo marcado es lo que se arma (camino o esquinas levantadas)
  marcadaPinta: ['#ffd23f', 0.6], hoverPinta: ['#ffe58a', 0.75],
};
// Baldosa como una grilla chica que sigue la superficie h(x,z) (local a la celda).
function baldosaPlana(x0, z0, x1, z1, h) {
  const n = 4, pos = [];
  const P = (a, b) => { const x = x0 + (x1 - x0) * a / n, z = z0 + (z1 - z0) * b / n; return [x, h(x, z), z]; };
  for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) {
    const p00 = P(a, b), p10 = P(a + 1, b), p01 = P(a, b + 1), p11 = P(a + 1, b + 1);
    pos.push(...p00, ...p01, ...p10, ...p10, ...p01, ...p11);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}
export function grillaEdicion(s) {
  const grupo = new THREE.Group(), tiles = [];
  const x0 = s.i * G, z0 = s.j * G, pad = 0.05;
  const lineas = [];
  const sumar = (geo) => {
    const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, depthTest: true });
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 5;
    grupo.add(m); tiles.push(m);
    const e = new THREE.EdgesGeometry(geo, 1);
    lineas.push(e);
  };
  if (s.type === 'pared') {
    for (let f = 0; f < 3; f++) for (let c = 0; c < 3; c++) {
      const geo = new THREE.PlaneGeometry(T3 - pad * 2, T3 - pad * 2);
      if (s.dir === 0) geo.translate(c * T3 + T3 / 2, f * T3 + T3 / 2, 0);
      else { geo.rotateY(-Math.PI / 2); geo.translate(0, f * T3 + T3 / 2, c * T3 + T3 / 2); }
      sumar(geo);
    }
  } else {
    const n = s.type === 'rampa' ? 3 : 2, L = G / n;
    const h = (x, z) => {
      if (s.type === 'piso') return 0.04;
      const plano = { ...s, e: s.type === 'rampa' ? 0 : s.e };
      return superficie(plano, x0 + Math.min(G - 1e-3, Math.max(1e-3, x)), z0 + Math.min(G - 1e-3, Math.max(1e-3, z))) - s.y + 0.05;
    };
    for (let v = 0; v < n; v++) for (let u = 0; u < n; u++) sumar(baldosaPlana(u * L + pad, v * L + pad, (u + 1) * L - pad, (v + 1) * L - pad, h));
  }
  const lin = new THREE.LineSegments(mergeGeometries(lineas, false), new THREE.LineBasicMaterial({ color: '#e8f6ff', transparent: true, opacity: 0.9, depthTest: true }));
  lin.renderOrder = 6;
  grupo.add(lin);
  grupo.position.set(x0, s.y, z0);
  grupo.userData.tiles = tiles;
  grupo.userData.tipo = s.type;
  return grupo;
}
// marcas: bits marcados; hover: baldosa apuntada (o -1); valida: si la edición se puede confirmar.
export function pintarGrilla(grupo, marcas, hover, valida = true) {
  const pinta = grupo.userData.tipo === 'rampa' || grupo.userData.tipo === 'techo';
  grupo.userData.tiles.forEach((m, k) => {
    const mk = (marcas >> k) & 1, hv = k === hover;
    const [col, op] = COL_EDIT[mk ? (hv ? (pinta ? 'hoverPinta' : 'hoverMarcada') : (pinta ? 'marcadaPinta' : 'marcada')) : hv ? 'hover' : 'normal'];
    m.material.color.set(valida || mk ? col : '#ff6b6b');
    m.material.opacity = op;
  });
}
export function liberarGrilla(grupo) {
  grupo.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
}
export { BALDOSAS };
