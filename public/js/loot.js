// Loot en el juego: objetos del piso (objetos.glb y armas.glb), cofres (cofre.glb) y sus efectos.
// - Objetos del piso: flotan y giran despacio sobre un brillo del color del objeto; las armas suman un haz de luz
//   que crece con la rareza y chispas que suben (más chispas cuanto más rara).
// - Cofres: aura dorada que late y motas que suben mientras está cerrado; al abrirse la tapa salta con rebote,
//   sale una ráfaga de chispas, el fondo brilla y se apaga de a poco, y el loot sale volando del cofre.
// Todo se anima en animarLoot(), que main.js llama una vez por cuadro.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ASSETS, cloneAsset } from './assets.js';
import { createWeaponModel } from './models.js';
import { RARITIES } from './items.js';

const ALTURA = 0.5;          // altura del centro del objeto sobre el piso
const LEJOS_FX = 45;         // más lejos que esto no se animan chispas ni aura
const LEJOS_VER = 160;       // más lejos que esto el objeto no se dibuja
const TAPA_ABIERTA = 1.95;   // giro de la tapa abierta (radianes, sobre X)
const DORADO = new THREE.Color('#ffc552');

// ---------------------------------------------------------------------------
// Texturas compartidas (se hacen una vez, con canvas)
let _tex = null;
function texturas() {
  if (_tex) return _tex;
  const radial = document.createElement('canvas');
  radial.width = radial.height = 128;
  let c = radial.getContext('2d');
  let g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 128, 128);
  // haz: fuerte abajo y en el medio, se apaga hacia arriba y hacia los bordes
  const haz = document.createElement('canvas');
  haz.width = 64; haz.height = 256;
  c = haz.getContext('2d');
  const img = c.createImageData(64, 256);
  for (let y = 0; y < 256; y++) {
    const v = Math.pow(1 - y / 255, 1.6);
    for (let x = 0; x < 64; x++) {
      const u = Math.abs(x - 31.5) / 32;
      const h = Math.pow(Math.max(0, 1 - u * u), 2.2) * (0.35 + 0.65 * Math.exp(-u * u * 18));
      const a = Math.round(255 * v * h);
      const k = (y * 64 + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
      img.data[k + 3] = a;
    }
  }
  c.putImageData(img, 0, 0);
  // anillo del piso: borde marcado con un halo hacia adentro
  const anillo = document.createElement('canvas');
  anillo.width = anillo.height = 128;
  c = anillo.getContext('2d');
  g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.32)');
  g.addColorStop(0.62, 'rgba(255,255,255,0.12)');
  g.addColorStop(0.8, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.86, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 128, 128);
  const mk = (cv) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; };
  _tex = { radial: mk(radial), haz: mk(haz), anillo: mk(anillo) };
  return _tex;
}

// Reflejos de ambiente para el cofre y los objetos (como setRigEnv hace con el héroe y las armas): sin esto el
// dorado y el metal horneados se ven casi negros. Llamar una vez después de loadAssets, antes de clonar.
export function luzLoot(renderer, intensity = 0.7) {
  const tex = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  for (const name of ['cofre', 'objetos']) {
    ASSETS[name]?.traverse((o) => {
      if (!o.isMesh || !o.material.isMeshStandardMaterial) return;
      o.material.envMap = tex;
      o.material.envMapIntensity = intensity;
      o.material.needsUpdate = true;
    });
  }
}

const aditivo = (map, color, opacity = 1) => new THREE.MeshBasicMaterial({
  map, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: true,
});

// Chispas: puntos que suben en espiral alrededor de un eje y vuelven a empezar abajo.
function chispas(n, color, radio, alto, tam) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const semilla = Array.from({ length: n }, () => [Math.random(), Math.random() * Math.PI * 2, 0.6 + Math.random() * 0.8, 0.55 + Math.random() * 0.45]);
  const mat = new THREE.PointsMaterial({ map: texturas().radial, color, size: tam, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const p = new THREE.Points(geo, mat);
  p.frustumCulled = false;
  p.userData = { semilla, radio, alto };
  return p;
}

function moverChispas(p, s) {
  const { semilla, radio, alto } = p.userData;
  const a = p.geometry.attributes.position.array;
  for (let i = 0; i < semilla.length; i++) {
    const [f, ang, vel, r] = semilla[i];
    const k = (f + s * 0.18 * vel) % 1;
    const giro = ang + s * 0.6 * vel;
    const rr = radio * r * (1 - k * 0.35);
    a[i * 3] = Math.cos(giro) * rr;
    a[i * 3 + 1] = k * alto;
    a[i * 3 + 2] = Math.sin(giro) * rr;
  }
  p.geometry.attributes.position.needsUpdate = true;
  // las que están arriba se apagan: el material entero late un poco para que no se vea fijo
  p.material.opacity = 0.75 + 0.25 * Math.sin(s * 3.1);
}

// ---------------------------------------------------------------------------
// Objetos del piso
const NOMBRE_OBJETO = (it) =>
  it.kind === 'ammo' ? `municion_${it.a}` : it.kind === 'mat' ? `material_${it.m}` : it.kind === 'consumable' ? it.c : null;

// Ajustes de los materiales que no se hornean: vidrio transparente, líquido de escudo que brilla.
function materialesObjeto(obj) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const n = o.material.name;
    if (n === 'Vidrio') {
      o.material = o.material.clone();
      Object.assign(o.material, { transparent: true, opacity: 0.32, depthWrite: false, roughness: 0.05, metalness: 0, transmission: 0 });
      o.renderOrder = 2;
      o.castShadow = false;
    } else if (n === 'Escudo') {
      o.material = o.material.clone();
      o.material.emissive = new THREE.Color('#2f8cff');
      o.material.emissiveIntensity = 1.6;
    }
  });
  return obj;
}

// Modelo de un objeto que no es arma (munición, material, curación o escudo): el de objetos.glb o, si no cargó, uno simple.
// También lo usa iconos.js para la foto de la barra de items.
export function modeloObjeto(item, color) {
  const nombre = NOMBRE_OBJETO(item);
  const glb = nombre && cloneAsset('objetos', `objetos_${nombre}`, { Tinte: color });
  return glb ? materialesObjeto(glb) : objetoProcedural(item, color);
}

function objetoProcedural(item, color) {
  // por si objetos.glb no cargó: formas simples
  const g = new THREE.Group();
  const std = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.7, ...extra });
  const box = (w, h, d, m, y = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.y = y; b.castShadow = true; g.add(b); };
  if (item.kind === 'ammo') { box(0.3, 0.18, 0.18, std('#4b5320')); box(0.31, 0.05, 0.19, std(color, { emissive: color, emissiveIntensity: 0.4 }), 0.03); }
  else if (item.kind === 'mat') { for (let k = 0; k < 3; k++) box(0.42, 0.08, 0.16, std(color), k * 0.09 - 0.09); }
  else if (item.c === 'frasco' || item.c === 'bidon') {
    const big = item.c === 'bidon';
    const b = new THREE.Mesh(new THREE.CylinderGeometry(big ? 0.12 : 0.09, big ? 0.14 : 0.1, big ? 0.36 : 0.22, 12), std(color, { emissive: color, emissiveIntensity: 0.6 }));
    b.castShadow = true; g.add(b);
  } else { box(0.36, 0.24, 0.12, std('#ffffff')); box(0.12, 0.04, 0.13, std('#d12b2b')); box(0.04, 0.12, 0.13, std('#d12b2b')); }
  return g;
}

export function createItemMesh(item, color) {
  const g = new THREE.Group();
  const spin = new THREE.Group();
  spin.position.y = ALTURA;
  g.add(spin);
  const T = texturas();
  const esArma = item.kind === 'weapon';
  const rareza = esArma ? item.rarity : 0;
  if (esArma) {
    const w = createWeaponModel(item.w, color, true);
    if (!w.userData.glb) w.rotation.z = Math.PI / 2;
    else {
      // centrado sobre el haz: el origen del modelo es el puño, no el medio del arma
      const b = new THREE.Box3().setFromObject(w);
      w.position.set(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -(b.min.z + b.max.z) / 2);
    }
    // un poco más grande que en la mano para leerse de lejos, y apenas inclinada
    const marco = new THREE.Group();
    marco.scale.setScalar(1.2);
    marco.rotation.z = 0.12;
    marco.add(w);
    spin.add(marco);
  } else {
    spin.add(modeloObjeto(item, color));
    spin.scale.setScalar(1.15);
  }
  // brillo en el piso: anillo + halo
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: T.anillo, color, transparent: true, opacity: esArma ? 0.9 : 0.7, depthWrite: false, fog: true }));
  piso.rotation.x = -Math.PI / 2;
  piso.position.y = 0.04;
  piso.scale.setScalar(esArma ? 1.25 + rareza * 0.12 : 0.95);
  piso.renderOrder = 1;
  g.add(piso);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.radial, color, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.y = ALTURA;
  halo.scale.setScalar(esArma ? 1.5 : 1.0);
  g.add(halo);
  let haz = null, motas = null;
  if (esArma) {
    // haz de luz que mira siempre a la cámara (gira sobre Y); más alto y más ancho cuanto más rara
    const alto = 2.6 + rareza * 1.1;
    haz = new THREE.Mesh(new THREE.PlaneGeometry(0.5 + rareza * 0.08, alto), aditivo(T.haz, color, 0.3 + rareza * 0.05));
    haz.geometry.translate(0, alto / 2, 0);
    haz.position.y = 0.05;
    haz.renderOrder = 1;
    g.add(haz);
    motas = chispas(4 + rareza * 4, color, 0.55, 1.8 + rareza * 0.4, 0.07 + rareza * 0.01);
    g.add(motas);
  }
  g.userData.spin = spin;
  g.userData.loot = { haz, motas, halo, piso, esArma, fase: Math.random() * Math.PI * 2 };
  return g;
}

// ---------------------------------------------------------------------------
// Cofres
function cofreProcedural() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#8a5a2b', flatShading: true });
  const trim = new THREE.MeshStandardMaterial({ color: '#ffcf4a', metalness: 0.6, roughness: 0.3, emissive: '#5a3c00' });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.7), wood);
  body.position.y = 0.25;
  g.add(body);
  for (const x of [-0.45, 0.45]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.52, 0.72), trim); b.position.set(x, 0.25, 0); g.add(b); }
  const lidG = new THREE.Group();
  lidG.name = 'cofre_tapa';
  lidG.position.set(0, 0.5, 0.35);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.1, 10, 1, false, 0, Math.PI), wood);
  lid.rotation.z = Math.PI / 2; lid.position.z = -0.35;
  lidG.add(lid);
  g.add(lidG);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// Cofre listo para poner en la escena (el grupo raíz está en el piso, frente hacia -Z).
export function createChest() {
  const T = texturas();
  const g = new THREE.Group();
  const modelo = cloneAsset('cofre', null, { BrilloCofre: '#ffb347' }) || cofreProcedural();
  g.add(modelo);
  const lid = modelo.getObjectByName('cofre_tapa') || modelo.getObjectByName('Tapa');
  let brillo = null;
  modelo.traverse((o) => {
    if (o.isMesh && o.material.name === 'BrilloCofre') {
      brillo = o.material;
      brillo.emissive = new THREE.Color('#ffb347');
      brillo.emissiveIntensity = 2.5;
    }
  });
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.radial, color: DORADO, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
  aura.position.y = 0.55;
  aura.scale.setScalar(2.4);
  g.add(aura);
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), aditivo(T.radial, DORADO, 0.35));
  piso.rotation.x = -Math.PI / 2;
  piso.position.y = 0.03;
  g.add(piso);
  const motas = chispas(14, DORADO, 0.85, 1.7, 0.08);
  g.add(motas);
  g.userData = { lid, brillo, aura, piso, motas, open: false, abriendo: 0, fase: Math.random() * Math.PI * 2 };
  return g;
}

// Abre el cofre: con animación (alguien lo acaba de abrir) o de golpe (ya estaba abierto al entrar a la sala).
export function abrirCofre(g, animar) {
  const u = g.userData;
  u.open = true;
  u.aura.visible = u.motas.visible = u.piso.visible = false;
  if (!animar) {
    if (u.lid) u.lid.rotation.x = TAPA_ABIERTA;
    if (u.brillo) u.brillo.emissiveIntensity = 0.6;
    return;
  }
  u.abriendo = performance.now();
  // ráfaga de chispas que salen del cofre y caen
  const n = 36;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const vel = Array.from({ length: n }, () => {
    const a = Math.random() * Math.PI * 2, r = 0.6 + Math.random() * 1.6;
    return [Math.cos(a) * r, 3.2 + Math.random() * 3, Math.sin(a) * r * 0.7];
  });
  const rafaga = new THREE.Points(geo, new THREE.PointsMaterial({ map: texturas().radial, color: DORADO, size: 0.16, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  rafaga.frustumCulled = false;
  rafaga.position.y = 0.5;
  rafaga.userData.vel = vel;
  g.add(rafaga);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturas().radial, color: '#ffe2a0', transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }));
  flash.position.y = 0.7;
  g.add(flash);
  u.fx = { rafaga, flash };
}

const easeOutBack = (p) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };

function animarCofre(g, ahora, cam) {
  const u = g.userData;
  if (!u.motas) return;
  const d2 = g.position.distanceToSquared(cam);
  if (!u.open) {
    if (d2 > LEJOS_FX * LEJOS_FX) { u.motas.visible = false; return; }
    u.motas.visible = true;
    const s = ahora / 1000 + u.fase;
    const late = 0.5 + 0.5 * Math.sin(s * 2.4);
    u.aura.material.opacity = 0.28 + 0.2 * late;
    u.aura.scale.setScalar(2.2 + 0.25 * late);
    u.piso.material.opacity = 0.25 + 0.15 * late;
    moverChispas(u.motas, s);
    return;
  }
  if (!u.abriendo) return;
  const e = (ahora - u.abriendo) / 1000;
  if (u.lid) u.lid.rotation.x = TAPA_ABIERTA * easeOutBack(Math.min(1, e / 0.5));
  if (u.brillo) u.brillo.emissiveIntensity = 0.6 + 5 * Math.exp(-e * 1.2);
  const { rafaga, flash } = u.fx || {};
  if (rafaga) {
    const a = rafaga.geometry.attributes.position.array;
    rafaga.userData.vel.forEach(([vx, vy, vz], i) => {
      a[i * 3] = vx * e;
      a[i * 3 + 1] = Math.max(-0.45, vy * e - 4.9 * e * e);
      a[i * 3 + 2] = vz * e;
    });
    rafaga.geometry.attributes.position.needsUpdate = true;
    rafaga.material.opacity = Math.max(0, 1 - e / 1.4);
    flash.material.opacity = Math.max(0, 1 - e / 0.35);
    flash.scale.setScalar(1.2 + e * 7);
  }
  if (e > 1.5) {
    if (rafaga) { g.remove(rafaga, flash); rafaga.geometry.dispose(); u.fx = null; }
    if (e > 4) { u.abriendo = 0; if (u.lid) u.lid.rotation.x = TAPA_ABIERTA; if (u.brillo) u.brillo.emissiveIntensity = 0.6; }
  }
}

// ---------------------------------------------------------------------------
// Un cuadro: objetos del piso (flotan, giran, haz mirando a la cámara, chispas, salto desde el cofre) y cofres.
const _a = new THREE.Vector3();
export function animarLoot(items, cofres, t, camera) {
  const ahora = performance.now();
  const cam = camera.position;
  if (cofres) for (const c of cofres) animarCofre(c, ahora, cam);
  for (const { mesh } of items.values()) {
    const u = mesh.userData;
    const L = u.loot;
    if (L && u.nacio === undefined) {
      // recién llegado: si hay un cofre que se abrió hace un momento al lado, sale volando de ahí
      u.nacio = ahora;
      u.destino = mesh.position.clone();
      const c = cofres?.find((k) => k.userData.abriendo && ahora - k.userData.abriendo < 1500 && k.position.distanceToSquared(u.destino) < 3.5 * 3.5);
      if (c) u.arco = { desde: c.position.clone().add(_a.set(0, 0.35, 0)), t0: ahora };
    }
    const d2 = (u.destino || mesh.position).distanceToSquared(cam);
    if (d2 > LEJOS_VER * LEJOS_VER) { mesh.visible = false; continue; }
    mesh.visible = true;
    u.spin.rotation.y = t / 1300 + (L?.fase || 0);
    u.spin.position.y = ALTURA + Math.sin(t / 450 + (L?.fase || 0)) * 0.07;
    if (!L) continue;
    if (u.arco) {
      const p = Math.min(1, (ahora - u.arco.t0) / 600);
      mesh.position.lerpVectors(u.arco.desde, u.destino, p);
      mesh.position.y += Math.sin(Math.PI * p) * 1.4;
      const s = 0.35 + 0.65 * p;
      mesh.scale.setScalar(s);
      u.spin.rotation.y += (1 - p) * 8;
      if (p >= 1) { mesh.position.copy(u.destino); mesh.scale.setScalar(1); u.arco = null; }
    } else if (!mesh.position.equals(u.destino)) {
      // el server lo movió (se rompió el piso de abajo, etc.): el nuevo lugar manda
      u.destino.copy(mesh.position);
    }
    const cerca = d2 < LEJOS_FX * LEJOS_FX;
    if (L.haz) L.haz.rotation.y = Math.atan2(cam.x - mesh.position.x, cam.z - mesh.position.z);
    if (L.motas) { L.motas.visible = cerca; if (cerca) moverChispas(L.motas, t / 1000 + L.fase); }
    L.halo.material.opacity = (L.esArma ? 0.24 : 0.16) + Math.sin(t / 380 + L.fase) * 0.05;
  }
}

export { RARITIES };
