// Golpes a estructuras (sólo cliente): cuánto daño tiene cada pieza y el punto débil del pico.
// - Grietas: cada pieza dañada del mapa o construcción lleva encima una capa con grietas que se abren y se
//   oscurecen a medida que pierde vida (la ven todos: la vida llega del servidor con pzHp y structHp).
// - Barra de vida (#structhp, debajo de la mira): la de lo que golpeás (pico o tiros) y la de lo que mirás con el
//   pico o construyendo, con la parte recién perdida en blanco.
// - Punto débil: círculo celeste que aparece cerca del golpe de pico (lo elige el servidor). Pegarle ahí hace
//   el doble de daño (PUNTO_DEBIL de items.js), suena distinto, saca un número grande y se mueve a otro lado.
import * as THREE from 'three';
import { MATERIALS, PICKAXE, PUNTO_DEBIL } from './items.js';
import { HP_INICIAL } from './construccion.js';

// ---------- Shader de las grietas ----------
const GRIETA_VS = /* glsl */`
#include <clipping_planes_pars_vertex>
varying vec3 vW;
varying vec3 vN;
varying float vDist;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 mvPosition = viewMatrix * w;
  vDist = -mvPosition.z;
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`;
const GRIETA_FS = /* glsl */`
#include <clipping_planes_pars_fragment>
uniform float uDano;   // 0 sana .. 1 a punto de romperse
uniform float uFlash;  // destello del golpe (se apaga solo)
uniform float uSemilla;
varying vec3 vW;
varying vec3 vN;
varying float vDist;
vec2 h2(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
float h1(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
float ruido(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h1(i), h1(i + vec2(1, 0)), u.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), u.x), u.y);
}
// Voronoi: x = distancia al borde de celda más cercano, y = número al azar de ese borde (igual de los dos lados),
// así cada grieta se abre recién cuando el daño pasa su número y las grietas aparecen de a poco.
vec2 borde(vec2 p) {
  vec2 n = floor(p), f = fract(p), mg = vec2(0), mr = vec2(0);
  float md = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(i, j), r = g + h2(n + g) - f;
    float d = dot(r, r);
    if (d < md) { md = d; mr = r; mg = g; }
  }
  float bd = 8.0, bh = 0.0;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    vec2 g = mg + vec2(i, j), r = g + h2(n + g) - f;
    if (dot(mr - r, mr - r) > 1e-5) {
      float d = dot(0.5 * (mr + r), normalize(r - mr));
      if (d < bd) { bd = d; vec2 a = n + mg, b = n + g; bh = h1(a + b + 7.13 * abs(a - b)); }
    }
  }
  return vec2(bd, bh);
}
void main() {
  #include <clipping_planes_fragment>
  vec3 an = abs(vN);
  vec2 uv = (an.x > an.y && an.x > an.z ? vW.zy : an.y > an.z ? vW.xz : vW.xy) + uSemilla;
  // pocas curvas grandes y quiebres chicos: líneas casi rectas que se quiebran, como una grieta
  vec2 q = uv * 0.75 + (vec2(ruido(uv * 1.1 + 9.0), ruido(uv * 1.1 + 1.7)) - 0.5) * 0.22
                     + (vec2(ruido(uv * 7.0), ruido(uv * 7.0 + 3.7)) - 0.5) * 0.07;
  float d = uDano;
  vec2 b1 = borde(q), b2 = borde(q * 2.6 + 11.7);
  // cada grieta se afina hacia las puntas (unas partes casi no se ven)
  float afina1 = smoothstep(0.2, 0.75, ruido(q * 2.3 + 4.0)), afina2 = smoothstep(0.3, 0.8, ruido(q * 5.1 + 8.0));
  float w1 = (0.004 + 0.024 * d) * (0.15 + 0.85 * afina1);
  float w2 = (0.003 + 0.011 * d) * (0.1 + 0.9 * afina2);
  float f1 = fwidth(b1.x) + 1e-4, f2 = fwidth(b2.x) + 1e-4;
  float on1 = step(b1.y, d * 1.25 - 0.06), on2 = step(b2.y, d * 1.2 - 0.34);
  float g1 = on1 * (1.0 - smoothstep(w1, w1 + f1, b1.x));
  float g2 = on2 * (1.0 - smoothstep(w2, w2 + f2, b2.x)) * smoothstep(0.0, 0.25, d);
  // al lado de cada grieta, un canto partido más claro
  float c1 = on1 * (1.0 - smoothstep(w1 + f1, w1 + 2.0 * f1 + 0.012 + 0.02 * d, b1.x)) * (1.0 - g1) * afina1;
  float grieta = max(g1, g2 * 0.85);
  float sucio = d * d * 0.45 * (0.5 + 0.5 * ruido(uv * 1.6)) + d * 0.08;
  vec3 col = vec3(0.04, 0.035, 0.03);
  float a = max(grieta * (0.6 + 0.35 * d), sucio);
  col = mix(col, vec3(0.92, 0.9, 0.86), c1 * 0.5 * (1.0 - grieta));
  a = max(a, c1 * 0.22);
  // destello blanco del golpe
  col = mix(col, vec3(1.0), uFlash * (1.0 - grieta));
  a = a + uFlash * 0.28 * (1.0 - a);
  a *= 1.0 - smoothstep(60.0, 100.0, vDist);
  if (a < 0.004) discard;
  gl_FragColor = vec4(col, a);
}`;
function materialGrieta(side = THREE.FrontSide) {
  return new THREE.ShaderMaterial({
    uniforms: { uDano: { value: 0 }, uFlash: { value: 0 }, uSemilla: { value: Math.random() * 50 } },
    vertexShader: GRIETA_VS, fragmentShader: GRIETA_FS,
    transparent: true, depthWrite: false, side, clipping: true,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  });
}

// ---------- Círculo del punto débil ----------
const DEBIL_FS = /* glsl */`
uniform float uT;
uniform float uA;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float pulso = 0.5 + 0.5 * sin(uT * 9.0);
  float aro = smoothstep(0.60, 0.68, r) * (1.0 - smoothstep(0.82, 0.9, r));
  float borde = smoothstep(0.86, 0.9, r) * (1.0 - smoothstep(0.95, 1.0, r));
  float relleno = (1.0 - smoothstep(0.0, 0.66, r)) * (0.22 + 0.16 * pulso);
  float centro = 1.0 - smoothstep(0.13, 0.2, r);
  // cuatro marcas hacia adentro, como una mira
  float ang = atan(p.y, p.x);
  float marcas = step(0.92, abs(cos(ang * 2.0))) * smoothstep(0.34, 0.4, r) * (1.0 - smoothstep(0.52, 0.58, r));
  vec3 celeste = vec3(0.3, 0.85, 1.0);
  vec3 col = mix(celeste, vec3(1.0), clamp(centro + aro * 0.35 * pulso, 0.0, 1.0));
  col = mix(col, vec3(0.02, 0.12, 0.25), borde);
  float a = max(max(aro, centro), max(relleno, marcas * 0.9));
  a = max(a, borde * 0.55);
  a *= uA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
}`;
const DEBIL_VS = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const igual = (a, b) => !!a && !!b && a.tipo === b.tipo && a.id === b.id;
// Objeto golpeable a partir de un resultado de castRay: pieza del mapa, construcción, árbol o roca.
export function objetivoDe(res) {
  if (!res) return null;
  if (res.pz !== undefined) return { tipo: 'pz', id: res.pz };
  if (res.key) return { tipo: 'key', id: res.key };
  if ((res.res === 'tree' || res.res === 'rock') && res.idx !== undefined) return { tipo: res.res, id: res.idx };
  return null;
}
// Lo que se manda al servidor para nombrar el objeto.
export function aMensaje(o) {
  return o.tipo === 'pz' ? { pz: o.id } : o.tipo === 'key' ? { key: o.id } : { res: o.tipo, idx: o.id };
}
function deMensaje(m) {
  if (Number.isInteger(m.pz)) return { tipo: 'pz', id: m.pz };
  if (m.key) return { tipo: 'key', id: m.key };
  if (m.res === 'tree' || m.res === 'rock') return { tipo: m.res, id: m.idx };
  return null;
}

export function crearGolpes({ scene, camera, me, getWorld, ui, sfx, cons, rayo, mirar, addDmgNum, sparks }) {
  // ---------- Grietas ----------
  const capas = new Map(); // 'pz12' / 'sKEY' -> { mats: [...], meshes: [...], dano, flash, base (malla de la construcción) }
  const clave = (o) => (o.tipo === 'pz' ? `pz${o.id}` : `s${o.id}`);

  function capaPieza(id) {
    const world = getWorld();
    const L = world?.lotePz?.get(id), rangos = L?.rangos.get(id);
    if (!rangos) return null;
    const pos = [], nor = [];
    for (const [k, v0, v1] of rangos) {
      if (k !== 's' && k !== 'm') continue; // ni vidrios ni luces
      const m = L.mallas[k];
      if (!m) continue;
      const P = m.geometry.attributes.position.array, N = m.geometry.attributes.normal.array;
      for (let i = v0 * 3; i < v1 * 3; i++) { pos.push(P[i]); nor.push(N[i]); }
    }
    if (!pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.computeBoundingSphere();
    const mat = materialGrieta();
    const mesh = new THREE.Mesh(g, mat);
    mesh.renderOrder = 2;
    scene.add(mesh);
    return { mats: [mat], meshes: [mesh], propia: true };
  }

  // Capa encima del panel y el marco de una construcción (comparte la geometría; se rehace si cambia la malla).
  function capaStruct(s) {
    const base = s.mesh;
    if (!base) return null;
    const mats = [], meshes = [];
    for (const parte of [base.userData.panel, base.userData.marco]) {
      if (!parte) continue;
      const mat = materialGrieta(parte.material.side);
      const plano = base.userData.obra?.plano;
      if (plano) mat.clippingPlanes = [plano];
      const o = new THREE.Mesh(parte.geometry, mat);
      o.renderOrder = 2;
      o.raycast = () => {}; // no tapa los rayos de la pieza de abajo
      parte.parent.add(o);
      mats.push(mat); meshes.push(o);
    }
    return { mats, meshes, base, propia: false };
  }

  function quitarCapa(k) {
    const c = capas.get(k);
    if (!c) return;
    for (const m of c.meshes) { m.parent?.remove(m); if (c.propia) m.geometry.dispose(); }
    for (const m of c.mats) m.dispose();
    capas.delete(k);
  }

  // Pone (o actualiza) la capa de grietas de un objeto. dano: 0..1. flash: destello del golpe.
  function grietas(o, dano, flash = 0) {
    if (o.tipo !== 'pz' && o.tipo !== 'key') return;
    const k = clave(o);
    let c = capas.get(k);
    if (!c) {
      if (dano <= 0.005 && !flash) return;
      if (o.tipo === 'pz') c = capaPieza(o.id);
      else { const s = getWorld()?.structs.get(o.id); c = s && capaStruct(s); }
      if (!c) return;
      c.o = o; c.flash = 0;
      capas.set(k, c);
    }
    c.dano = Math.max(0, Math.min(1, dano));
    c.flash = Math.max(c.flash, flash);
    for (const m of c.mats) m.uniforms.uDano.value = c.dano;
  }

  // ---------- Vida de cada cosa ----------
  const vidaRes = new Map(); // 'tree5' -> { hp, max } de árboles y rocas que ya golpeé
  function vidaStructActual(s) {
    if (!(s.max > 0)) return null;
    const t = performance.now();
    const crece = s.obra > 0 ? (s.max * (1 - HP_INICIAL) / s.obra) * Math.max(0, Math.min(t, s.creceHasta || 0) - (s.recibido || t)) / 1000 : 0;
    return Math.max(0, Math.min(s.max, s.hp + crece));
  }
  // { hp, max, color } o null si ya no está.
  function vida(o) {
    const world = getWorld();
    if (!world || !o) return null;
    if (o.tipo === 'pz') {
      const p = world.piezas[o.id];
      if (!p || p.rota || p.fija) return null;
      return { hp: p.vida ?? p.hp, max: p.hp, color: MATERIALS[p.clase].color };
    }
    if (o.tipo === 'key') {
      const s = world.structs.get(o.id);
      const hp = s && vidaStructActual(s);
      return hp === null || hp === undefined ? null : { hp, max: s.max, color: MATERIALS[s.mat].color };
    }
    const list = o.tipo === 'tree' ? world.trees : world.rocks, r = list[o.id];
    if (!r || !r.alive) return null;
    const max = o.tipo === 'tree' ? 150 : Math.round(150 + r.s * 120);
    const v = vidaRes.get(o.tipo + o.id);
    return { hp: v ? v.hp : max, max: v?.max || max, color: MATERIALS[o.tipo === 'tree' ? 'madera' : 'piedra'].color };
  }

  // Vida nueva de una pieza del mapa (del servidor o predicha al golpear).
  function vidaPieza(id, hp, destello = true) {
    const p = getWorld()?.piezas[id];
    if (!p || p.rota) return;
    const antes = p.vida ?? p.hp;
    p.vida = Math.max(0, hp);
    grietas({ tipo: 'pz', id }, 1 - p.vida / p.hp, destello && p.vida < antes - 0.5 ? 0.7 : 0);
  }
  // Construcción con vida nueva (structHp ya la guardó en s.hp; dano = daño acumulado).
  function vidaStruct(s, dano, destello = true) {
    if (!s) return;
    const antes = s.dano || 0;
    if (Number.isFinite(dano)) s.dano = dano;
    grietas({ tipo: 'key', id: s.key }, (s.dano || 0) / (s.max || 1), destello && (s.dano || 0) > antes + 0.5 ? 0.7 : 0);
  }

  // ---------- Barra de vida debajo de la mira ----------
  let mostrado = null, hastaMostrar = 0, mirado = null, proxMirar = 0, perdida = 1, perdidaEspera = 0, ultimo = null, critHasta = 0;
  let barra = null;
  function armarBarra() {
    if (!ui.structhp || barra) return;
    ui.structhp.innerHTML = '<i></i><div class="barra"><b class="perdida"></b><b class="vida"></b></div><span></span>';
    barra = { ico: ui.structhp.querySelector('i'), vida: ui.structhp.querySelector('.vida'), perdida: ui.structhp.querySelector('.perdida'), num: ui.structhp.querySelector('span') };
  }
  function mostrar(o, seg = 2.2) {
    if (!o) return;
    if (!igual(o, mostrado)) { const v = vida(o); perdida = v ? v.hp / v.max : 1; }
    mostrado = o; hastaMostrar = performance.now() + seg * 1000;
  }
  function actualizarBarra(t, puedeMirar, dt) {
    if (!ui.structhp) return;
    armarBarra();
    if (puedeMirar && t >= proxMirar) {
      proxMirar = t + 100; // 10 veces por segundo alcanza
      mirado = objetivoDe(mirar());
    } else if (!puedeMirar) mirado = null;
    const o = t < hastaMostrar && vida(mostrado) ? mostrado : mirado;
    const v = vida(o);
    if (!v) { ui.structhp.classList.add('hidden'); ultimo = null; return; }
    if (!igual(o, ultimo)) { perdida = v.hp / v.max; ultimo = o; }
    const k = Math.max(0, Math.min(1, v.hp / v.max));
    // la parte recién perdida queda blanca un momento y después baja
    if (k > perdida) perdida = k;
    else if (k < perdida - 1e-3) { if (!perdidaEspera) perdidaEspera = t + 280; if (t > perdidaEspera) perdida = Math.max(k, perdida - 0.9 * dt); }
    else perdidaEspera = 0;
    if (perdida - k < 1e-3) perdidaEspera = 0;
    barra.ico.style.background = v.color;
    barra.vida.style.width = `${(k * 100).toFixed(1)}%`;
    barra.vida.style.background = v.color;
    barra.perdida.style.width = `${(perdida * 100).toFixed(1)}%`;
    const txt = `${Math.ceil(v.hp)} / ${v.max}`;
    if (barra.num.textContent !== txt) barra.num.textContent = txt;
    ui.structhp.classList.remove('hidden');
    ui.structhp.classList.toggle('crit', t < critHasta);
  }

  // ---------- Punto débil ----------
  let debil = null; // { o, p (servidor), pos (en la superficie), n, hasta, aparece }
  const debilMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uA: { value: 0 } }, vertexShader: DEBIL_VS, fragmentShader: DEBIL_FS,
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8,
  });
  const debilMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), debilMat);
  debilMesh.renderOrder = 5;
  debilMesh.visible = false;
  debilMesh.raycast = () => {};
  const aroGeo = new THREE.RingGeometry(0.78, 1, 40);
  const aros = []; // aros que se agrandan al pegar un crítico

  const _v = new THREE.Vector3(), _d = new THREE.Vector3();
  // Lleva el punto que eligió el servidor a la superficie que se ve (raycast a lo largo de la normal).
  function ubicar(o, p, n) {
    const desde = _v.copy(p).addScaledVector(n, 1.2);
    let r = rayo(desde, _d.copy(n).negate(), 2.6, 0);
    if (igual(objetivoDe(r), o)) return { pos: desde.clone().addScaledVector(_d, r.dist), n: r.n ? r.n.clone() : n.clone() };
    const cam = camera.position, dist = cam.distanceTo(p);
    _d.subVectors(p, cam).normalize();
    r = rayo(cam, _d, dist + 1.5, Math.max(0, dist - 2.5));
    if (igual(objetivoDe(r), o)) return { pos: cam.clone().addScaledVector(_d, r.dist), n: r.n ? r.n.clone() : n.clone() };
    return { pos: p.clone(), n: n.clone() };
  }

  function quitarDebil() { debil = null; debilMesh.visible = false; }

  // Mensaje 'debil' del servidor: dónde quedó el punto débil (o null), si el golpe fue crítico y la vida.
  function alDebil(m) {
    const o = deMensaje(m.o || {});
    if (o && (o.tipo === 'tree' || o.tipo === 'rock') && m.max > 0) vidaRes.set(o.tipo + o.id, { hp: m.hp, max: m.max });
    if (!o || !Array.isArray(m.p)) { if (!o || igual(o, debil?.o)) quitarDebil(); return; }
    const p = new THREE.Vector3().fromArray(m.p), n = new THREE.Vector3().fromArray(m.n || [0, 1, 0]).normalize();
    if (debil && igual(o, debil.o) && debil.p.distanceTo(p) < 0.01) { debil.hasta = performance.now() + PUNTO_DEBIL.dura * 1000; return; }
    const u = ubicar(o, p, n);
    debil = { o, p, pos: u.pos, n: u.n, hasta: performance.now() + PUNTO_DEBIL.dura * 1000, aparece: performance.now() };
    if (!debilMesh.parent) scene.add(debilMesh);
    debilMesh.position.copy(u.pos).addScaledVector(u.n, 0.03);
    debilMesh.lookAt(_v.copy(debilMesh.position).add(u.n));
    debilMesh.visible = true;
  }

  // ¿Este golpe de pico (objeto o, punto at) da en el punto débil?
  function esCritico(o, at) {
    if (!debil || !igual(o, debil.o) || performance.now() > debil.hasta) return false;
    return at.distanceTo(debil.pos) <= PUNTO_DEBIL.visual + 0.08 && at.distanceTo(debil.p) <= PUNTO_DEBIL.radio;
  }

  function efectoCritico(at, n) {
    const mat = new THREE.MeshBasicMaterial({ color: '#7fe3ff', transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });
    const aro = new THREE.Mesh(aroGeo, mat);
    aro.position.copy(at).addScaledVector(n, 0.05);
    aro.lookAt(_v.copy(aro.position).add(n));
    aro.scale.setScalar(PUNTO_DEBIL.visual);
    aro.renderOrder = 6;
    scene.add(aro);
    aros.push({ aro, vida: 0.32 });
    sparks(at, '#7fe3ff', 12);
    sparks(at, '#ffffff', 5);
  }

  // ---------- Golpe de pico propio (predicción: el servidor confirma con pzHp/structHp/debil) ----------
  // Devuelve true si fue crítico.
  function golpePico(o, at, n) {
    const crit = esCritico(o, at);
    const dmg = PICKAXE.struct * (crit ? PUNTO_DEBIL.mult : 1);
    const v = vida(o);
    if (v) {
      const hp = Math.max(0, v.hp - dmg);
      if (o.tipo === 'pz') vidaPieza(o.id, hp, false);
      else if (o.tipo === 'key') { const s = getWorld().structs.get(o.id); cons.alCambiarVida(s, hp); vidaStruct(s, (s.dano || 0) + dmg, false); }
      else vidaRes.set(o.tipo + o.id, { hp, max: v.max });
      const c = capas.get(o.tipo === 'pz' ? `pz${o.id}` : `s${o.id}`);
      if (c) c.flash = crit ? 1 : 0.75;
    }
    mostrar(o);
    const pos = at.clone().addScaledVector(n, 0.25);
    if (crit) {
      critHasta = performance.now() + 220;
      efectoCritico(debil.pos, debil.n);
      debilMesh.visible = false; // se mueve: el servidor manda el nuevo
      sfx.critico();
      addDmgNum(pos, dmg, '#6fe0ff', 'crit');
    } else addDmgNum(pos, dmg, '#f1f1f1', 'estr');
    return crit;
  }

  // ---------- Por cuadro ----------
  function update(dt, puedeMirar) {
    const t = performance.now(), world = getWorld();
    for (const [k, c] of capas) {
      if (c.o.tipo === 'key') {
        const s = world?.structs.get(c.o.id);
        if (!s) { quitarCapa(k); continue; }
        if (s.mesh !== c.base) { quitarCapa(k); grietas(c.o, c.dano, c.flash); continue; } // se rehízo la malla (edición)
        const plano = s.mesh?.userData.obra?.plano || null;
        for (const m of c.mats) { const cp = plano ? [plano] : null; if ((m.clippingPlanes?.[0] || null) !== plano) m.clippingPlanes = cp; }
      } else if (world?.piezas[c.o.id]?.rota) { quitarCapa(k); continue; }
      if (c.flash > 0) c.flash = Math.max(0, c.flash - dt * 6);
      for (const m of c.mats) m.uniforms.uFlash.value = c.flash;
    }
    if (debil) {
      if (t > debil.hasta || !vida(debil.o)) quitarDebil();
      else {
        const ap = Math.min(1, (t - debil.aparece) / 140), fin = Math.min(1, (debil.hasta - t) / 500);
        debilMat.uniforms.uT.value = t / 1000;
        debilMat.uniforms.uA.value = ap * fin;
        debilMesh.scale.setScalar(PUNTO_DEBIL.visual * 2 * (0.4 + 0.6 * ap) * (1 + 0.05 * Math.sin(t / 1000 * 9)));
      }
    }
    for (let i = aros.length - 1; i >= 0; i--) {
      const a = aros[i];
      a.vida -= dt;
      const k = 1 - a.vida / 0.32;
      a.aro.scale.setScalar(PUNTO_DEBIL.visual * (1 + k * 1.8));
      a.aro.material.opacity = 0.95 * (1 - k);
      if (a.vida <= 0) { scene.remove(a.aro); a.aro.material.dispose(); aros.splice(i, 1); }
    }
    actualizarBarra(t, puedeMirar, dt);
  }

  // Partida nueva: el mundo se rehízo, así que se olvida todo.
  function reiniciar() {
    for (const k of [...capas.keys()]) quitarCapa(k);
    vidaRes.clear();
    quitarDebil();
    mostrado = mirado = ultimo = null;
  }

  // Se rompió algo: se va su punto débil (las capas se limpian solas en update).
  function alRomper(o) { if (igual(o, debil?.o)) quitarDebil(); if (o.tipo === 'pz' || o.tipo === 'key') quitarCapa(clave(o)); }

  return {
    update, reiniciar, alDebil, alRomper, golpePico, esCritico, mostrar, vidaPieza, vidaStruct, vida,
    get debil() { return debil; }, get capas() { return capas; },
  };
}
