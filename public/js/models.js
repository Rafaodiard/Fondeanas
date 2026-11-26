// Personajes, bus, paracaídas, armas y objetos: usa los GLB hechos en Blender y, si alguno no cargó, modelos low-poly procedurales de respaldo.
import * as THREE from 'three';
import { cloneAsset } from './assets.js';
import { hasRig, createRigCharacter, animateRig, placeGlider, placeParachute, weaponRig, rigAction, rigStopAction, rigShot } from './rig.js';

export { rigAction as weaponAction, rigStopAction as stopWeaponAction, rigShot as weaponShot };

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, ...extra });

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// Personaje articulado: el grupo raíz está en los pies, mira hacia -Z.
export function createCharacter(color) {
  if (hasRig()) {
    const root = createRigCharacter(color);
    const para = cloneAsset('paracaidas', null, { Tela: color });
    if (para) placeParachute(root, para);
    else {
      const glider = createGlider(color);
      glider.visible = false;
      placeGlider(root, glider);
    }
    setHeld(root, 'pico');
    return root;
  }
  const glb = cloneAsset('personaje', null, { Ropa: color });
  if (glb) {
    const root = new THREE.Group();
    root.add(glb);
    const n = (k) => glb.getObjectByName(k);
    const glider = createGlider(color);
    glider.visible = false;
    glider.position.y = 2.3;
    root.add(glider);
    root.userData = { hips: n('Cadera'), armL: n('BrazoI'), armR: n('BrazoD'), legL: n('PiernaI'), legR: n('PiernaD'), headG: n('Cabeza'), gun: n('Mano'), glider, phase: 0, swing: 0, held: null };
    setHeld(root, 'pico');
    return root;
  }
  return createCharacterProcedural(color);
}

function createCharacterProcedural(color) {
  const root = new THREE.Group();
  const body = std(color), skin = std('#f1c29a'), dark = std('#2b2d42'), boots = std('#3a2a20');
  const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
  const torso = box(0.6, 0.7, 0.34, body, 0, 0.4, 0); hips.add(torso);
  const belt = box(0.62, 0.1, 0.36, dark, 0, 0.06, 0); hips.add(belt);
  const pack = box(0.42, 0.45, 0.2, std('#5c4b3a'), 0, 0.45, 0.26); hips.add(pack);
  const headG = new THREE.Group(); headG.position.y = 0.9; hips.add(headG);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 1), skin); head.position.y = 0.12; head.castShadow = true; headG.add(head);
  const hair = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 1, 0, Math.PI), std('#3b2416'));
  hair.scale.set(1.02, 0.6, 1.02); hair.position.set(0, 0.24, 0.03); headG.add(hair);
  for (const s of [-1, 1]) { const eye = box(0.05, 0.06, 0.02, dark, s * 0.09, 0.14, -0.23); headG.add(eye); }
  const limb = (w, h, mat) => { const g = new THREE.Group(); const m = box(w, h, w, mat, 0, -h / 2, 0); g.add(m); return g; };
  const armL = limb(0.17, 0.62, body); armL.position.set(-0.4, 0.68, 0); hips.add(armL);
  const armR = limb(0.17, 0.62, body); armR.position.set(0.4, 0.68, 0); hips.add(armR);
  for (const a of [armL, armR]) a.add(box(0.15, 0.14, 0.15, skin, 0, -0.66, 0));
  const legL = limb(0.22, 0.9, dark); legL.position.set(-0.16, 0, 0); hips.add(legL);
  const legR = limb(0.22, 0.9, dark); legR.position.set(0.16, 0, 0); hips.add(legR);
  for (const l of [legL, legR]) l.add(box(0.24, 0.14, 0.32, boots, 0, -0.9, -0.05));
  // Arma en la mano derecha.
  const gun = new THREE.Group();
  // El cañón apunta a lo largo del brazo (-Y local), así al levantar el brazo apunta al frente.
  gun.add(box(0.1, 0.8, 0.15, std('#2d3142'), 0, -0.25, 0));
  gun.add(box(0.08, 0.1, 0.22, std('#2d3142'), 0, 0.05, 0.14));
  gun.add(box(0.06, 0.3, 0.06, std('#ef8354'), 0, -0.2, -0.1));
  gun.position.set(0, -0.68, 0);
  armR.add(gun);
  // Planeador (aparece al abrirlo).
  const glider = createGlider(color);
  glider.visible = false;
  glider.position.y = 2.3;
  root.add(glider);
  root.userData = { hips, armL, armR, legL, legR, headG, gun, glider, phase: 0, swing: 0, held: null };
  setHeld(root, 'pico');
  return root;
}

// Planeador de respaldo (si paracaidas.glb no cargó o el personaje no tiene esqueleto).
export function createGlider(color) {
  const g = new THREE.Group();
  const canopyMat = std(color, { side: THREE.DoubleSide });
  const shape = new THREE.Shape();
  shape.moveTo(-2.2, 0); shape.quadraticCurveTo(0, -1.6, 2.2, 0); shape.lineTo(0, 1.2); shape.lineTo(-2.2, 0);
  const wing = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false }), canopyMat);
  wing.rotation.x = -Math.PI / 2;
  wing.castShadow = true;
  g.add(wing);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.1, 1.9), std('#ffffff'));
  stripe.position.set(0, 0.05, -0.2);
  g.add(stripe);
  const lineMat = new THREE.LineBasicMaterial({ color: '#333' });
  for (const x of [-1.8, 1.8]) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0, 0), new THREE.Vector3(0, -1.0, 0)]);
    g.add(new THREE.Line(geo, lineMat));
  }
  return g;
}

// Animación procedural según estado y velocidad.
export function animateCharacter(char, state, speed, dt, aiming, extra) {
  const u = char.userData;
  if (u.rig) return animateRig(char, state, speed, dt, aiming, extra);
  u.phase += dt * (2 + speed * 1.6);
  const swing = Math.min(1, speed / 6) * 0.8;
  u.glider.visible = state === 'glider';
  if (state === 'ground') {
    const s = Math.sin(u.phase) * swing;
    u.legL.rotation.x = s; u.legR.rotation.x = -s;
    u.armL.rotation.x = -s * 0.7;
    u.armR.rotation.x = aiming ? 1.5 : 0.5 + s * 0.2;
    if (u.swing > 0) { u.swing = Math.max(0, u.swing - dt * 3); u.armR.rotation.x = 2.6 - Math.sin((1 - u.swing) * Math.PI) * 2.4; }
    u.armL.rotation.z = 0; u.armR.rotation.z = 0;
    u.hips.rotation.x = 0;
    u.hips.position.y = 0.95 + Math.abs(Math.cos(u.phase)) * 0.06 * swing;
  } else if (state === 'falling') {
    u.hips.rotation.x = -1.2;
    u.hips.position.y = 1.0;
    const f = Math.sin(u.phase * 3) * 0.1;
    u.armL.rotation.set(0, 0, -2.2 - f); u.armR.rotation.set(0, 0, 2.2 + f);
    u.legL.rotation.set(0.3 + f, 0, 0.3); u.legR.rotation.set(0.3 - f, 0, -0.3);
  } else if (state === 'glider') {
    u.hips.rotation.x = -0.15;
    u.hips.position.y = 0.95;
    u.armL.rotation.set(0, 0, -2.8); u.armR.rotation.set(0, 0, 2.8);
    u.legL.rotation.set(0.2, 0, 0); u.legR.rotation.set(-0.1, 0, 0);
  }
}

// Cielo de mentira (cubo de degradés) para que el cromo, los vidrios y la pintura del bus tengan qué reflejar.
let busEnv = null;
function cieloBus() {
  if (busEnv) return busEnv;
  const cara = (arriba, abajo, horizonte = null) => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const ctx = cv.getContext('2d');
    const gr = ctx.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, arriba);
    if (horizonte) gr.addColorStop(0.5, horizonte);
    gr.addColorStop(1, abajo);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 64, 64);
    return cv;
  };
  const lado = cara('#7fb6ea', '#3f7a3a', '#eaf4ff');
  busEnv = new THREE.CubeTexture([lado, lado, cara('#6aa6e4', '#6aa6e4'), cara('#3a6a34', '#3a6a34'), lado, lado]);
  busEnv.colorSpace = THREE.SRGBColorSpace;
  busEnv.needsUpdate = true;
  return busEnv;
}

// Bus volador (bus.glb, tools/blender/bus.py): colectivo retro con ala alta, dos hélices, cola y portaequipajes.
// La baliza del techo destella y la luz blanca de la cola hace doble flash.
export function createBus() {
  const glb = cloneAsset('bus');
  if (glb) {
    const g = new THREE.Group();
    g.add(glb);
    g.userData.props = [glb.getObjectByName('Helice_I'), glb.getObjectByName('Helice_D')].filter(Boolean);
    const env = cieloBus();
    const propios = new Map();
    glb.traverse((o) => {
      if (!o.isMesh) return;
      const n = o.material.name;
      if (!propios.has(n)) {
        const m = o.material.clone();
        m.envMap = env;
        m.envMapIntensity = n === 'Vidrio' ? 1.4 : 0.8;
        propios.set(n, m);
      }
      o.material = propios.get(n);
      o.castShadow = false;
      if (n === 'Baliza' || n === 'Destello') {
        const m = o.material, base = m.emissiveIntensity;
        o.onBeforeRender = () => {
          const t = performance.now() / 1000;
          const on = n === 'Baliza' ? (t % 1) < 0.45 : (t % 1.4) < 0.07 || ((t % 1.4) > 0.18 && (t % 1.4) < 0.25);
          m.emissiveIntensity = on ? base : 0.05;
        };
      }
    });
    return g;
  }

  const g = new THREE.Group();
  const paint = std('#2a9d8f'), stripe = std('#f4d35e'), glass = std('#bde0fe', { roughness: 0.1, metalness: 0.2 }), dark = std('#22223b');
  g.add(box(4, 3.4, 12, paint, 0, 0, 0));
  g.add(box(4.05, 0.5, 12.05, stripe, 0, -0.6, 0));
  g.add(box(3.6, 0.6, 11, paint, 0, 2, 0));
  for (let i = -2; i <= 2; i++) for (const s of [-1, 1]) g.add(box(0.1, 1.1, 1.7, glass, s * 2.02, 0.6, i * 2.2));
  g.add(box(3.4, 1.4, 0.1, glass, 0, 0.6, -6.02));
  for (const z of [-4, 4]) for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.5, 10), dark);
    w.rotation.z = Math.PI / 2; w.position.set(s * 2, -1.8, z); g.add(w);
  }
  // Alas
  const wing = box(16, 0.3, 3, std('#e76f51'), 0, 0.2, -0.5);
  g.add(wing);
  const props = [];
  for (const s of [-1, 1]) {
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 2.2, 8), dark);
    motor.rotation.x = Math.PI / 2; motor.position.set(s * 5.5, 0.2, -2.3); g.add(motor);
    const prop = new THREE.Group();
    prop.add(box(0.3, 4, 0.1, std('#f1faee')));
    prop.add(box(4, 0.3, 0.1, std('#f1faee')));
    prop.position.set(s * 5.5, 0.2, -3.5);
    g.add(prop); props.push(prop);
  }
  // Cola
  g.add(box(0.3, 3, 2, std('#e76f51'), 0, 2.6, 5.5));
  g.add(box(6, 0.25, 1.6, std('#e76f51'), 0, 1.4, 5.8));
  g.userData.props = props;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// Cartel con el nombre del jugador.
export function createNameTag(name, color) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.roundRect(4, 8, 248, 48, 16); ctx.fill();
  ctx.fillStyle = color; ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(name, 128, 33);
  const tex = new THREE.CanvasTexture(cv);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  spr.scale.set(2.4, 0.6, 1);
  spr.position.y = 2.5;
  spr.renderOrder = 10;
  return spr;
}

// ---------- Armas y objetos ----------
const darkMetal = std('#2d3142', { metalness: 0.3 });
const WEAPON_SHAPES = {
  // [largo del cañón, grosor, culata, cargador, mira]
  pistola: [0.35, 0.09, 0, 0.18, false],
  subfusil: [0.55, 0.11, 0.15, 0.28, false],
  rifle: [0.8, 0.12, 0.25, 0.25, true],
  escopeta: [0.75, 0.14, 0.25, 0, false],
  francotirador: [1.1, 0.1, 0.3, 0.15, true],
  lanzacohetes: [1.0, 0.24, 0, 0, true],
};

// Arma orientada a lo largo de -Y (para la mano) o de -Z (para el piso), con franja del color de la rareza.
export function createWeaponModel(type, color, alongZ = false) {
  const glb = cloneAsset('armas', type, { Rareza: color });
  if (glb) {
    // En el GLB el cañón apunta a -Z; en la mano tiene que seguir el brazo (-Y).
    const w = new THREE.Group();
    if (!alongZ) glb.rotation.x = -Math.PI / 2;
    w.add(glb);
    w.userData.glb = true;
    return w;
  }

  const g = new THREE.Group();
  const [len, th, stock, mag, scope] = WEAPON_SHAPES[type] || WEAPON_SHAPES.rifle;
  const accent = std(color, { emissive: color, emissiveIntensity: 0.25 });
  if (type === 'lanzacohetes') {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(th / 2, th / 2, len, 10), std('#5b6b3a'));
    tube.position.y = -len * 0.35; g.add(tube);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(th / 2 + 0.02, th / 2 + 0.02, 0.12, 10), accent);
    ring.position.y = -len * 0.8; g.add(ring);
  } else {
    g.add(box(th, len, th * 1.3, darkMetal, 0, -len * 0.35, 0));
    g.add(box(th * 0.7, len * 0.5, th * 0.5, accent, 0, -len * 0.3, -th * 0.8));
    if (stock) g.add(box(th * 0.9, stock, th * 1.6, std('#6b4a2f'), 0, stock / 2 + len * 0.1, 0.03));
    if (mag) g.add(box(th * 0.8, 0.1, mag, darkMetal, 0, -len * 0.15, mag / 2 + th * 0.4));
    if (type === 'escopeta') g.add(box(th * 0.9, len * 0.35, th, std('#8b5a2b'), 0, -len * 0.45, th * 0.9));
  }
  if (scope) g.add(box(th * 0.7, 0.25, 0.1, std('#111'), 0, -len * 0.15, -th * 1.1));
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  if (alongZ) { const w = new THREE.Group(); g.rotation.x = Math.PI / 2; w.add(g); return w; }
  return g;
}

export function createPickaxe() {
  const glb = cloneAsset('armas', 'pico');
  if (glb) { const w = new THREE.Group(); glb.rotation.x = -Math.PI / 2; glb.position.y = 0.1; w.add(glb); return w; }

  const g = new THREE.Group();
  g.add(box(0.07, 1.0, 0.07, std('#7a5233'), 0, -0.3, 0));
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.9, 5), std('#c9d6e3', { metalness: 0.6, roughness: 0.3 }));
  head.rotation.x = Math.PI / 2; head.position.set(0, -0.78, 0);
  g.add(head);
  g.add(box(0.1, 0.12, 0.12, std('#ffcf4a'), 0, -0.78, 0));
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function setHeld(char, what, color = '#b8bcc4') {
  const u = char.userData;
  const key = `${what}:${color}`;
  if (u.held === key) return;
  u.held = key;
  if (u.rig) return setHeldRig(u, what, color);
  u.gun.clear();
  if (what === 'pico') u.gun.add(createPickaxe());
  else if (WEAPON_SHAPES[what]) u.gun.add(createWeaponModel(what, color));
  else if (what) {
    const it = box(0.25, 0.25, 0.25, std(color, { emissive: color, emissiveIntensity: 0.3 }), 0, -0.1, 0);
    u.gun.add(it);
  }
}

// Objeto tirado en el piso: modelo + haz de luz del color de la rareza.
// Los objetos del piso (y sus efectos) están en loot.js.
export { createItemMesh } from './loot.js';

// En el esqueleto el arma cuelga del hueso Arma.R: origen en el puño, cañón hacia -Z y arriba +Y
// (igual que los modelos de armas.glb). El pico usa la misma convención: mango hacia +Y y la punta hacia -Z.
// La boca del cañón sale del vacío <arma>_boca del modelo; esta tabla queda para los modelos procedurales.
const BOCA = { pistola: 0.32, subfusil: 0.52, rifle: 0.76, escopeta: 0.8, francotirador: 1.2, lanzacohetes: 0.86 };

function setHeldRig(u, what, color) {
  for (const c of [...u.gun.children]) if (c !== u.muzzle) u.gun.remove(c);
  u.heldKind = what || null;
  u.weapon = null;
  u.accion = null;
  u.muzzle.position.set(0, 0.09, -0.3);
  if (what === 'pico') {
    const glb = cloneAsset('armas', 'pico');
    const p = new THREE.Group();
    if (glb) p.add(glb); else { const q = createPickaxe(); q.rotation.x = Math.PI; p.add(q); }
    u.gun.add(p);
  } else if (WEAPON_SHAPES[what]) {
    const w = createWeaponModel(what, color, true);
    u.gun.add(w);
    const glb = w.userData.glb ? w.children[0] : null;
    const boca = glb?.getObjectByName(`${what}_boca`);
    if (boca) u.muzzle.position.copy(boca.position);
    else u.muzzle.position.set(0, what === 'lanzacohetes' ? 0.12 : 0.09, -(BOCA[what] || 0.6));
    if (glb) u.weapon = weaponRig(glb, what);
  } else if (what) {
    u.heldKind = 'item';
    const it = box(0.16, 0.16, 0.16, std(color, { emissive: color, emissiveIntensity: 0.3 }), 0, 0.02, -0.06);
    u.gun.add(it);
  }
  u.gun.traverse((o) => { if (o.isMesh) o.castShadow = true; });
}
