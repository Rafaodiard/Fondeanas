// Personaje con esqueleto y animaciones hechas en Blender (personaje.glb).
// Tres capas: piernas (cadera, columna baja y piernas), torso (columna alta, brazo derecho y cabeza) y brazo izquierdo.
// La locomoción mezcla varios ciclos según la velocidad con la fase sincronizada; arriba se pone la pose del arma o el
// golpe. El brazo izquierdo va con el torso, salvo en las poses que dejan esa mano libre: ahí sigue a la locomoción.
// Después del mezclador se dobla la columna para apuntar adonde mira la cámara.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ASSETS, ANIMS } from './assets.js';

// [clip, velocidad del juego donde manda, velocidad natural del clip (m/s, sin patinar)]
const LOCO = [['Quieto', 0, 0], ['Caminar', 1.6, 0.907], ['Trote', 3.5, 2.479], ['Correr', 6, 4.038], ['Sprint', 9.5, 5.278]];
const PIERNAS = /^(Hips|Spine|UpperLeg[LR]|LowerLeg[LR]|Foot[LR]|Toe[LR])$/;
const BRAZO_L = /^(Shoulder|UpperArm|LowerArm|Hand|(Index|Middle|Ring|Pinky|Thumb)\d)L$/;
// poses del torso que llevan el objeto solo en la mano derecha: la izquierda se balancea con la carrera
const MANO_L_LIBRE = new Set(['SostenerPico', 'Objeto']);
const POSE_ARMA = { pico: 'SostenerPico', rifle: 'Rifle', subfusil: 'Rifle', escopeta: 'Rifle', francotirador: 'Rifle', pistola: 'Pistola', lanzacohetes: 'Lanzacohetes', item: 'Objeto' };
const APUNTA = { Rifle: 'RifleApunta', Pistola: 'PistolaApunta', Lanzacohetes: 'Lanzacohetes' };
// Acciones de arma (animaciones_armas.glb): pisan la pose del torso y mueven las piezas del arma con el mismo clip.
const RECARGA = { rifle: 'RecargaRifle', subfusil: 'RecargaSubfusil', pistola: 'RecargaPistola', escopeta: 'RecargaEscopeta', francotirador: 'RecargaFranco', lanzacohetes: 'RecargaCohete' };
const BOMBEO = { escopeta: ['BombeoEscopeta', 'BombeoEscopetaApunta'] };
const ACCIONES = new Set([...Object.values(RECARGA), ...Object.values(BOMBEO).flat()]);
const PIEZAS = ['cargador', 'cerrojo', 'bomba', 'corredera', 'cohete', 'cartucho', 'bala'];
const SALTO_APICE = 13 / 30;
// cuánto puede doblarse la columna para seguir la mira con un arma (rad, abajo / arriba): apuntando y a la cadera.
// Lo revisa tools/blender/brazos_choque.py (más allá los brazos se meten en el cuerpo o en las rodillas).
const CURVA_APUNTA = [-55 * Math.PI / 180, 65 * Math.PI / 180];
const CURVA_CADERA = [-15 * Math.PI / 180, 20 * Math.PI / 180];
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
    const capa = (t) => (PIERNAS.test(bone(t)) ? 'p' : BRAZO_L.test(bone(t)) ? 'b' : 't');
    const sub = (k) => new THREE.AnimationClip(c.name + '|' + k, c.duration, c.tracks.filter((t) => capa(t) === k));
    CLIPS[c.name] = { p: sub('p'), t: sub('t'), b: sub('b'), dur: c.duration };
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
  const B = { spine: bone('Spine'), spine1: bone('Spine1'), spine2: bone('Spine2'), neck: bone('Neck'), head: bone('Head'), arma: bone('ArmaR'),
    brazoL: bone('UpperArmL'), brazoR: bone('UpperArmR') };
  const mixer = new THREE.AnimationMixer(model);
  const acts = {};
  for (const [name, c] of Object.entries(clips)) {
    const p = mixer.clipAction(c.p), t = mixer.clipAction(c.t), b = mixer.clipAction(c.b);
    for (const a of [p, t, b]) { a.play(); a.timeScale = 0; a.setEffectiveWeight(0); }
    acts[name] = { p, t, b, dur: c.dur, wp: 0, wt: 0, wb: 0, clock: Math.random() * c.dur };
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
    phase: 0, swing: 0, golpeT: 99, recoil: 0, rx: 0, rv: 0, rs: 1, vy: 0,
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
  const acc = u.accion;
  if (acc) {
    acc.t += dt;
    if (acc.t >= acc.len || state !== 'ground' || dance) u.accion = null;
  }
  const accion = u.accion && A[u.accion.name] ? u.accion : null;
  if (golpe) over.Golpe = 1;
  else if (accion) over[accion.name] = 1;
  else if (state === 'ground' && !dance && u.heldKind && POSE_ARMA[u.heldKind]) {
    let n = POSE_ARMA[u.heldKind];
    if (aiming && APUNTA[n]) n = APUNTA[n];
    over[n] = n === 'SostenerPico' ? Math.max(0, 1 - speed / 2.5) * (air ? 0.4 : 1) : 1;
  }
  let O = 0, OL = 0;      // peso de la pose de arriba, y la parte que deja libre la mano izquierda
  for (const n in over) { O += over[n]; if (MANO_L_LIBRE.has(n)) OL += over[n]; }
  O = Math.min(1, O);
  OL = Math.min(O, OL);

  // ---- pesos con suavizado (lineal: las sumas se mantienen en 1)
  for (const n in A) {
    const a = A[n];
    const tp = base[n] || 0;
    const tt = (base[n] || 0) * (1 - O) + (over[n] || 0);
    const tb = (base[n] || 0) * (1 - O + OL) + (MANO_L_LIBRE.has(n) ? 0 : over[n] || 0);
    const k = n === 'Golpe' || (golpe && tt === 0) ? 22 : n === 'Salto' || base.Salto || ACCIONES.has(n) ? 14 : 10;
    a.wp = smooth(a.wp, tp, k, dt);
    a.wt = smooth(a.wt, tt, k, dt);
    a.wb = smooth(a.wb, tb, k, dt);
    if (a.wp < 1e-3 && tp === 0) a.wp = 0;
    if (a.wt < 1e-3 && tt === 0) a.wt = 0;
    if (a.wb < 1e-3 && tb === 0) a.wb = 0;
    // tiempo de cada clip
    let time;
    const loco = LOCO.find((l) => l[0] === n);
    if (loco && loco[2]) time = u.phase * a.dur;
    else if (n === 'Salto') {
      const vy = x.vy || 0;
      time = vy > 0 ? (1 - Math.min(1, vy / 8.5)) * SALTO_APICE : SALTO_APICE + Math.min(1, -vy / 12) * (a.dur - SALTO_APICE - 0.01);
    } else if (n === 'Golpe') time = Math.min(u.golpeT, a.dur - 0.001);
    else if (ACCIONES.has(n)) {
      // la acción avanza con su propio largo (el tiempo de recarga del arma); al terminar queda en el último cuadro
      if (accion && accion.name === n) a.clock = Math.min(accion.t / accion.len, 0.999) * a.dur;
      time = a.clock;
    } else {
      if (a.wp > 0 || a.wt > 0 || a.wb > 0) a.clock += dt;
      time = a.clock % a.dur;
    }
    a.p.time = time; a.t.time = time; a.b.time = time;
    a.p.setEffectiveWeight(a.wp);
    a.t.setEffectiveWeight(a.wt);
    a.b.setEffectiveWeight(a.wb);
  }
  u.mixer.update(0);

  // ---- piezas del arma: el mismo clip en el modelo del arma, en el mismo punto del tiempo
  const W = u.weapon;
  if (W) {
    const wa = accion && W.acts[accion.name];
    if (wa) {
      if (W.cur !== wa) { W.cur?.stop(); wa.reset().play(); wa.timeScale = 0; W.cur = wa; }
      wa.time = Math.min(accion.t / accion.len, 0.999) * wa.getClip().duration;
      W.mixer.update(0);
    } else if (W.cur) { W.cur.stop(); W.cur = null; }
    // corredera de la pistola: atrás y adelante en cada tiro
    if (W.kick > 0) {
      W.kick = Math.max(0, W.kick - dt * 11);
      const p = W.parts.corredera;
      if (p && !W.cur) {
        const k = W.kick;
        p.position.copy(W.rest.corredera);
        p.position.z += 0.034 * (k > 0.75 ? (1 - k) / 0.25 : k / 0.75);
      }
    }
  }

  // ---- extras: planeador, arma visible
  if (u.glider) u.glider.visible = state === 'glider';
  u.gun.visible = state === 'ground' && !dance;

  // ---- columna: mirar y apuntar
  if (state !== 'ground' || dance) return;
  char.updateMatrixWorld(true);
  _right.set(1, 0, 0).applyQuaternion(char.quaternion);
  const pitch = x.pitch || 0;
  const B = u.B;
  const armed = !!over.Rifle || !!over.RifleApunta || !!over.Pistola || !!over.PistolaApunta || !!over.Lanzacohetes ||
    (accion && accion.kind === 'fire');
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
    // la curva se reparte en toda la columna (si se doblara solo el pecho, los antebrazos se hundirían en la panza) y
    // tiene tope: más abajo las manos chocan con las rodillas al correr
    const [abajo, arriba] = aiming ? CURVA_APUNTA : CURVA_CADERA;
    const err = Math.max(abajo, Math.min(arriba, (want - Math.asin(Math.max(-1, Math.min(1, _v.y)))) * fuerza));
    rotWorld(B.spine, _right, err * 0.4);
    rotWorld(B.spine1, _right, err * 0.3);
    rotWorld(B.spine2, _right, err * 0.3);
  } else if (accion) {
    // recargando: el pecho se dobla poco y en toda la columna, como con el arma a la cadera (doblado como sin arma,
    // el antebrazo izquierdo se metía en los cargadores del chaleco); el resto lo hace la cabeza
    const c = Math.max(CURVA_CADERA[0], Math.min(CURVA_CADERA[1], pitch * 0.4));
    rotWorld(B.spine, _right, c * 0.4);
    rotWorld(B.spine1, _right, c * 0.3);
    rotWorld(B.spine2, _right, c * 0.3);
    rotWorld(B.neck, _right, pitch * 0.2);
    rotWorld(B.head, _right, pitch * 0.3);
  } else {
    // girar en +X (derecha) levanta la mirada
    rotWorld(B.spine1, _right, pitch * 0.18);
    rotWorld(B.spine2, _right, pitch * 0.22);
    // mirando abajo los brazos cuelgan en vez de seguir al pecho (si no, las manos se meten en el muslo y en los
    // bolsillos del chaleco); mirando arriba sí lo siguen
    const cuelga = -Math.min(0, pitch * 0.4);
    rotWorld(B.brazoL, _right, cuelga);
    rotWorld(B.brazoR, _right, cuelga);
    rotWorld(B.neck, _right, pitch * 0.2);
    rotWorld(B.head, _right, pitch * 0.3);
  }
  retroceso(u, B, dt, aiming);
}

// Retroceso por arma: cada tiro es un impulso a un resorte amortiguado (sube rápido y vuelve con un rebote chico,
// y con las automáticas se acumula mientras se dispara). Con eso se inclina el pecho (el cañón sube), el torso gira
// un poco a un lado al azar y el arma se levanta y se va atrás en la mano. Apuntando, el cuerpo lo absorbe más.
// sube: pecho (rad), flip: arma en la mano (rad), atras: arma hacia atrás (m), giro: torso de costado (rad)
const RETRO = {
  pistola: { sube: 0.035, flip: 0.14, atras: 0.012, giro: 0.012 },
  subfusil: { sube: 0.02, flip: 0.025, atras: 0.012, giro: 0.015 },
  rifle: { sube: 0.035, flip: 0.02, atras: 0.016, giro: 0.012 },
  escopeta: { sube: 0.09, flip: 0.04, atras: 0.03, giro: 0.02 },
  francotirador: { sube: 0.11, flip: 0.035, atras: 0.035, giro: 0.015 },
  lanzacohetes: { sube: 0.07, flip: 0, atras: 0.045, giro: 0.02 },
};
const R_W = 2 * Math.PI * 4.5, R_Z = 0.45, R_IMP = 46;   // frecuencia, amortiguación e impulso (pico ≈ 1)

function retroceso(u, B, dt, aiming) {
  if (u.recoil > 0) {                       // main.js marca el tiro con recoil = 1
    u.rv = (u.rv || 0) + R_IMP * u.recoil;
    u.rs = Math.random() < 0.5 ? -1 : 1;
    u.recoil = 0;
  }
  let x = u.rx || 0, v = u.rv || 0;
  if (x || v) {
    const n = Math.ceil(dt / 0.008), h = dt / n;
    for (let i = 0; i < n; i++) {
      v += (-R_W * R_W * x - 2 * R_Z * R_W * v) * h;
      x += v * h;
    }
    if (Math.abs(x) < 1e-4 && Math.abs(v) < 1e-3) x = v = 0;
    u.rx = x; u.rv = v;
  }
  const P = RETRO[u.heldKind];
  const k = P ? x * (aiming ? 0.7 : 1) : 0;
  if (k) {
    rotWorld(B.spine2, _right, k * P.sube);
    rotWorld(B.spine1, _up, k * P.giro * (u.rs || 1));
  }
  // el arma gira sobre el puño (el cañón sube) y retrocede en la mano
  u.gun.rotation.set(Math.PI / 2 + (P ? k * P.flip : 0), 0, 0);
  u.gun.position.set(0, 0, 0);
  if (P && k) u.gun.translateZ(k * P.atras);     // +Z del grupo = hacia atrás del cañón en el marco de Arma.R
}

// Modelo de arma colgado de la mano: piezas móviles, su posición de reposo y un mezclador para sus clips.
export function weaponRig(root, what) {
  const pre = what + '_';
  const parts = {}, rest = {};
  for (const n of PIEZAS) {
    const o = root.getObjectByName(pre + n);
    if (o) { parts[n] = o; rest[n] = o.position.clone(); }
  }
  const mixer = new THREE.AnimationMixer(root);
  const acts = {};
  for (const c of ANIMS.armas || []) {
    if (ACCIONES.has(c.name) && c.tracks.some((t) => t.name.startsWith(pre))) acts[c.name] = mixer.clipAction(c);
  }
  return { root, what, parts, rest, mixer, acts, cur: null, kick: 0 };
}

// Empieza una acción del arma en la mano: 'reload' (dura lo que tarda la recarga) o 'fire' (después de un tiro).
export function rigAction(char, kind, duration = 0, aiming = false) {
  const u = char.userData;
  if (!u.rig) return;
  const w = u.heldKind;
  const name = kind === 'reload' ? RECARGA[w] : BOMBEO[w]?.[aiming ? 1 : 0];
  if (!name || !u.acts[name]) { if (kind === 'reload') u.accion = null; return; }
  if (kind === 'fire' && u.accion?.kind === 'reload') return;
  u.accion = { name, kind, t: 0, len: duration > 0 ? duration : u.acts[name].dur };
  if (kind === 'reload' && u.weapon?.parts.cohete) u.weapon.parts.cohete.visible = true;
}

export function rigStopAction(char) {
  const u = char.userData;
  if (u.accion?.kind === 'reload') u.accion = null;
}

// Un tiro: la corredera de la pistola, el bombeo de la escopeta y el cohete que sale del tubo.
export function rigShot(char, what, aiming = false) {
  const u = char.userData;
  if (!u.rig || u.heldKind !== what) return;
  if (u.accion?.kind === 'reload') u.accion = null;    // tirar corta lo que quedaba de la recarga
  const W = u.weapon;
  if (W?.parts.corredera) W.kick = 1;
  if (W?.parts.cohete) W.parts.cohete.visible = false;
  if (BOMBEO[what]) rigAction(char, 'fire', 0, aiming);
}
