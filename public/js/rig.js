// Personaje con esqueleto y animaciones hechas en Blender (personaje.glb).
// Dos capas: piernas (cadera, columna baja y piernas) y torso (columna alta, brazos y cabeza). La locomoción
// mezcla varios ciclos según la velocidad con la fase sincronizada; arriba se pone la pose del arma o el golpe.
// Después del mezclador se dobla la columna para apuntar adonde mira la cámara.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ASSETS, ANIMS } from './assets.js';

// [clip, velocidad del juego donde manda, velocidad natural del clip (m/s, sin patinar)]
const LOCO = [['Quieto', 0, 0], ['Caminar', 1.6, 0.907], ['Trote', 3.5, 2.479], ['Correr', 6, 4.038], ['Sprint', 9.5, 5.278]];
const PIERNAS = /^(Hips|Spine|UpperLeg[LR]|LowerLeg[LR]|Foot[LR]|Toe[LR])$/;
const POSE_ARMA = { pico: 'SostenerPico', rifle: 'Rifle', subfusil: 'Rifle', escopeta: 'Rifle', francotirador: 'Rifle', pistola: 'Pistola', lanzacohetes: 'Lanzacohetes', item: 'Objeto' };
const APUNTA = { Rifle: 'RifleApunta', Pistola: 'PistolaApunta', Lanzacohetes: 'Lanzacohetes' };
const SALTO_APICE = 13 / 30;
const ALTO_BARRA = 2.122; // altura de las manos en el planeador

let CLIPS = null;

function rigClips() {
  if (CLIPS) return CLIPS;
  const src = ANIMS.personaje;
  if (!ASSETS.personaje || !src?.length) return null;
  let skinned = false;
  ASSETS.personaje.traverse((o) => { if (o.isSkinnedMesh) skinned = true; });
  if (!skinned) return null;
  CLIPS = {};
  for (const c of src) {
    const bone = (t) => t.name.slice(0, t.name.lastIndexOf('.'));
    const p = new THREE.AnimationClip(c.name + '|p', c.duration, c.tracks.filter((t) => PIERNAS.test(bone(t))));
    const t = new THREE.AnimationClip(c.name + '|t', c.duration, c.tracks.filter((t) => !PIERNAS.test(bone(t))));
    CLIPS[c.name] = { p, t, dur: c.duration };
  }
  return CLIPS;
}

// Reflejos suaves de ambiente solo para el personaje y las armas (sin cambiar la luz del mapa): sin esto los
// materiales PBR horneados se ven apagados y la piel muy oscura.
export function setRigEnv(renderer, intensity = 0.55) {
  const tex = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  for (const name of ['personaje', 'armas']) {
    ASSETS[name]?.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m.isMeshStandardMaterial) continue;
        m.envMap = tex;
        m.envMapIntensity = intensity;
        m.needsUpdate = true;
      }
    });
  }
}

export function hasRig() {
  return !!rigClips();
}

export function createRigCharacter(color) {
  const clips = rigClips();
  const root = new THREE.Group();
  const model = SkeletonUtils.clone(ASSETS.personaje);
  model.rotation.y = Math.PI; // en Blender mira a -Y, que en glTF es +Z; el juego mira a -Z
  root.add(model);
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    // esfera generosa: las poses (caída libre, planeador) salen de la pose de reposo
    o.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.1, 0), 1.9);
    if (o.material.name === 'Ropa') { o.material = o.material.clone(); o.material.color.set(color); }
  });
  const bone = (n) => model.getObjectByName(n);
  const B = { spine1: bone('Spine1'), spine2: bone('Spine2'), neck: bone('Neck'), head: bone('Head'), arma: bone('ArmaR') };
  const mixer = new THREE.AnimationMixer(model);
  const acts = {};
  for (const [name, c] of Object.entries(clips)) {
    const p = mixer.clipAction(c.p), t = mixer.clipAction(c.t);
    for (const a of [p, t]) { a.play(); a.timeScale = 0; a.setEffectiveWeight(0); }
    acts[name] = { p, t, dur: c.dur, wp: 0, wt: 0, clock: Math.random() * c.dur };
  }
  // el arma cuelga de un grupo propio dentro del hueso: se cambia sin tocar el esqueleto
  // los huesos conservan los ejes de Blender: en Arma.R el cañón es +Y y arriba es +Z. Las armas vienen con el
  // cañón en -Z y arriba +Y, así que el grupo gira 90° en X.
  const gun = new THREE.Group();
  gun.rotation.x = Math.PI / 2;
  (B.arma || bone('HandR') || model).add(gun);
  const muzzle = new THREE.Object3D();
  gun.add(muzzle);
  root.userData = {
    rig: true, model, mixer, acts, B, gun, muzzle, glider: null, held: null, heldKind: null,
    phase: 0, swing: 0, golpeT: 99, recoil: 0, vy: 0,
  };
  return root;
}

export function placeGlider(root, glider) {
  // la barra del planeador (0, -1, 0.1 dentro del modelo, que está 0.6 arriba en su grupo) va a las manos
  glider.position.set(0, ALTO_BARRA + 1 - 0.6, -0.1);
  root.userData.glider = glider;
  root.add(glider);
}

const _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qa = new THREE.Quaternion();
const _v = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _right = new THREE.Vector3();

// gira un hueso alrededor de un eje del mundo (con lo que cuelga de él)
function rotWorld(bone, axis, ang) {
  if (!bone || !ang) return;
  bone.parent.getWorldQuaternion(_qp);
  _qa.setFromAxisAngle(axis, ang);
  _q.copy(_qp).invert().multiply(_qa).multiply(_qp);
  bone.quaternion.premultiply(_q);
  bone.updateMatrixWorld(true);
}

function smooth(cur, target, k, dt) {
  return cur + (target - cur) * Math.min(1, dt * k);
}

// state: ground/falling/glider; speed: velocidad horizontal; aiming: apuntando con un arma.
// x: { air, vy, pitch, dance }
export function animateRig(char, state, speed, dt, aiming, x = {}) {
  const u = char.userData;
  const A = u.acts;
  dt = Math.min(dt, 0.1);
  const air = state === 'ground' && !!x.air;
  const dance = state === 'ground' && !air && x.dance && speed < 0.5;

  // ---- pose base (las dos capas)
  const base = {};
  let rate = 0;
  if (state === 'falling') base.Caida = 1;
  else if (state === 'glider') base.Planear = 1;
  else if (dance) base.Baile = 1;
  else if (air) base.Salto = 1;
  else {
    const s = Math.max(0, speed);
    let i = 0;
    while (i < LOCO.length - 2 && s > LOCO[i + 1][1]) i++;
    const [a, pa] = LOCO[i], [b, pb] = LOCO[i + 1];
    const t = Math.min(1, (s - pa) / (pb - pa));
    base[a] = 1 - t;
    base[b] = (base[b] || 0) + t;
    let wsum = 0;
    for (const [n, p, v] of LOCO) {
      if (!v || !base[n]) continue;
      rate += base[n] * Math.pow(p / v, 0.6) / A[n].dur;
      wsum += base[n];
    }
    if (wsum > 0) rate /= wsum;
    if (s < LOCO[1][1]) rate *= Math.max(0.45, s / LOCO[1][1]);
    if (s > LOCO[4][1]) rate *= Math.pow(s / LOCO[4][1], 0.6);
  }
  u.phase = (u.phase + dt * rate) % 1;

  // ---- pose del arma / golpe (solo torso)
  const over = {};
  if (u.swing > 0) { u.swing = 0; u.golpeT = 0; }
  u.golpeT += dt;
  const golpe = A.Golpe && u.golpeT < A.Golpe.dur && state === 'ground' && u.heldKind === 'pico';
  if (golpe) over.Golpe = 1;
  else if (state === 'ground' && !dance && u.heldKind && POSE_ARMA[u.heldKind]) {
    let n = POSE_ARMA[u.heldKind];
    if (aiming && APUNTA[n]) n = APUNTA[n];
    over[n] = n === 'SostenerPico' ? Math.max(0, 1 - speed / 2.5) * (air ? 0.4 : 1) : 1;
  }
  let O = 0;
  for (const n in over) O += over[n];
  O = Math.min(1, O);

  // ---- pesos con suavizado (lineal: las sumas se mantienen en 1)
  for (const n in A) {
    const a = A[n];
    const tp = base[n] || 0;
    const tt = (base[n] || 0) * (1 - O) + (over[n] || 0);
    const k = n === 'Golpe' || (golpe && tt === 0) ? 22 : n === 'Salto' || base.Salto ? 14 : 10;
    a.wp = smooth(a.wp, tp, k, dt);
    a.wt = smooth(a.wt, tt, k, dt);
    if (a.wp < 1e-3 && tp === 0) a.wp = 0;
    if (a.wt < 1e-3 && tt === 0) a.wt = 0;
    // tiempo de cada clip
    let time;
    const loco = LOCO.find((l) => l[0] === n);
    if (loco && loco[2]) time = u.phase * a.dur;
    else if (n === 'Salto') {
      const vy = x.vy || 0;
      time = vy > 0 ? (1 - Math.min(1, vy / 8.5)) * SALTO_APICE : SALTO_APICE + Math.min(1, -vy / 12) * (a.dur - SALTO_APICE - 0.01);
    } else if (n === 'Golpe') time = Math.min(u.golpeT, a.dur - 0.001);
    else {
      if (a.wp > 0 || a.wt > 0) a.clock += dt;
      time = a.clock % a.dur;
    }
    a.p.time = time; a.t.time = time;
    a.p.setEffectiveWeight(a.wp);
    a.t.setEffectiveWeight(a.wt);
  }
  u.mixer.update(0);

  // ---- extras: planeador, arma visible
  if (u.glider) u.glider.visible = state === 'glider';
  u.gun.visible = state === 'ground' && !dance;

  // ---- columna: mirar y apuntar
  if (state !== 'ground' || dance) return;
  char.updateMatrixWorld(true);
  _right.set(1, 0, 0).applyQuaternion(char.quaternion);
  const pitch = x.pitch || 0;
  const B = u.B;
  const armed = !!over.Rifle || !!over.RifleApunta || !!over.Pistola || !!over.PistolaApunta || !!over.Lanzacohetes;
  if (armed) {
    // el cañón tiene que ir adonde mira la cámara: corrige el giro y la inclinación que trae la animación
    const fuerza = aiming ? 1 : 0.55;
    B.arma.getWorldQuaternion(_q);
    _v.set(0, 1, 0).applyQuaternion(_q).applyQuaternion(_qp.copy(char.quaternion).invert()); // cañón
    if (aiming) {
      const yawErr = Math.atan2(-_v.x, -_v.z);
      rotWorld(B.spine1, _up, -yawErr * 0.45);
      rotWorld(B.spine2, _up, -yawErr * 0.55);
      B.arma.getWorldQuaternion(_q);
      _v.set(0, 1, 0).applyQuaternion(_q).applyQuaternion(_qp.copy(char.quaternion).invert());
    }
    const want = aiming ? pitch : pitch * 0.8 - 0.12;
    const err = (want - Math.asin(Math.max(-1, Math.min(1, _v.y)))) * fuerza;
    rotWorld(B.spine1, _right, err * 0.45);
    rotWorld(B.spine2, _right, err * 0.55);
  } else {
    // girar en +X (derecha) levanta la mirada
    rotWorld(B.spine1, _right, pitch * 0.18);
    rotWorld(B.spine2, _right, pitch * 0.22);
    rotWorld(B.neck, _right, pitch * 0.2);
    rotWorld(B.head, _right, pitch * 0.3);
  }
  if (u.recoil > 0) {
    rotWorld(B.spine2, _right, u.recoil * 0.06);
    u.recoil = Math.max(0, u.recoil - dt * 9);
  }
}
