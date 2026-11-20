// Modelos low-poly procedurales (provisorios hasta reemplazarlos por GLB hechos en Blender).
import * as THREE from 'three';

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, ...extra });

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// Personaje articulado: el grupo raíz está en los pies, mira hacia -Z.
export function createCharacter(color) {
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
  root.userData = { hips, armL, armR, legL, legR, headG, gun, glider, phase: 0 };
  return root;
}

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
export function animateCharacter(char, state, speed, dt, aiming) {
  const u = char.userData;
  u.phase += dt * (2 + speed * 1.6);
  const swing = Math.min(1, speed / 6) * 0.8;
  u.glider.visible = state === 'glider';
  if (state === 'ground') {
    const s = Math.sin(u.phase) * swing;
    u.legL.rotation.x = s; u.legR.rotation.x = -s;
    u.armL.rotation.x = -s * 0.7;
    u.armR.rotation.x = aiming ? 1.5 : 0.5 + s * 0.2;
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

// Bus volador original: colectivo con alas, hélices y aleta de cola.
export function createBus() {
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
