// Caída libre, paracaídas y deslizarse: la física del jugador propio y los parámetros de animación que viajan por la
// red (para que los demás vean la misma pose). main.js llama a estas funciones desde updateMe.
//
// Caída libre: mirando abajo se cae en picada (rápido y casi sin avanzar); yendo adelante con la mirada al horizonte
// se planea (cae lento y llega lejos). En el medio se mezcla de a poco.
// Paracaídas: se abre y se cierra con la tecla de saltar mientras se esté arriba de LIMITE; si se baja de esa altura
// se abre solo y ya no se puede cerrar. Abierto avanza más rápido con adelante, frena con atrás y dobla con los costados.
// Deslizarse: corriendo, la tecla de deslizarse tira al jugador al piso con un impulso; en bajada acelera.
import * as THREE from 'three';

export const CAIDA = {
  V: [24, 40, 72],          // velocidad de caída (m/s): planeo, normal, picada
  H: [31, 20, 8],           // velocidad horizontal máxima: planeo, normal, picada
  LADO: 0.7,                // los costados y atrás rinden menos que ir adelante
  RESP_V: 1.6, RESP_H: 1.3, // qué tan rápido se acomoda la velocidad (1/s)
  CAMBIO: 2.4,              // qué tan rápido pasa de planeo a picada (1/s)
};

export const PARACAIDAS = {
  LIMITE: 80,               // altura (m sobre el piso) donde se abre solo y desde la que ya no se cierra
  MIN: 12,                  // más bajo que esto no se puede abrir a mano (igual se abre solo antes)
  V: 7.5, V_ADELANTE: 10.5, V_FRENO: 4.8,
  H: 9, H_ADELANTE: 21, H_FRENO: 3, H_LADO: 10,
  RESP_V: 3.0, RESP_H: 1.2,     // al abrirse frena la caída rápido (el tirón)
};

export const DESLIZ = {
  MIN_VEL: 6.5,             // hay que venir corriendo (la caminata es 6)
  IMPULSO: 1.3,             // multiplica la velocidad al empezar
  MIN_IMPULSO: 11,          // y como mínimo sale con esto
  MAX: 17,
  ROCE: 4.2,                // frena (m/s²) en el plano
  PENDIENTE: 15,            // acelera en bajada (m/s² por unidad de pendiente)
  FIN: 4.5,                 // por debajo de esto se levanta
  MIN_T: 0.35,              // dura al menos esto aunque se suelte la tecla
  GIRO: 1.5,                // rad/s que puede doblar
  ALTO_CAMARA: 1.18,        // la cámara baja mientras se desliza
};

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const suave = (cur, obj, k, dt) => cur + (obj - cur) * Math.min(1, dt * k);

// -1 = planeo, 0 = normal, +1 = picada
export function controlCaida(pitch, adelante) {
  const picada = clamp((-pitch - 0.35) / 0.7);
  const planeo = adelante ? clamp((pitch + 0.75) / 0.45) * (1 - picada) : 0;
  return picada - planeo;
}

// Estado extra del jugador para esto: lo agrega main.js al crear `me`.
export function estadoCaida() {
  return { caida: 0, giro: 0, freno: 0, paraBloq: false, desliz: null, deslizSuelta: true, yawPrev: null };
}

// ent: { fwd, right (vectores horizontales de la cámara), adelante, atras, izq, der (booleanos) }
// Devuelve 'abrir' si el paracaídas se abrió solo en este cuadro.
export function fisicaAire(me, ent, dt, altura) {
  const yawRate = me.yawPrev === null ? 0 : Math.atan2(Math.sin(me.yaw - me.yawPrev), Math.cos(me.yaw - me.yawPrev)) / Math.max(dt, 1e-3);
  me.yawPrev = me.yaw;
  const lat = (ent.der ? 1 : 0) - (ent.izq ? 1 : 0);
  const fw = (ent.adelante ? 1 : 0) - (ent.atras ? 1 : 0);
  // giro para la animación: lo que se dobla con el teclado más lo que gira la cámara
  me.giro = suave(me.giro, clamp(lat * 0.8 - yawRate * 0.35, -1, 1), 4, dt);
  let evento = null;
  if (me.state === 'falling') {
    me.caida = suave(me.caida, controlCaida(me.pitch, ent.adelante), CAIDA.CAMBIO, dt);
    const c = me.caida;
    const v = c < 0 ? lerp(CAIDA.V[1], CAIDA.V[0], -c) : lerp(CAIDA.V[1], CAIDA.V[2], c);
    const h = c < 0 ? lerp(CAIDA.H[1], CAIDA.H[0], -c) : lerp(CAIDA.H[1], CAIDA.H[2], c);
    const obj = new THREE.Vector3().addScaledVector(ent.fwd, fw > 0 ? fw : fw * CAIDA.LADO).addScaledVector(ent.right, lat * CAIDA.LADO);
    if (obj.lengthSq() > 1) obj.normalize();
    obj.multiplyScalar(h);
    me.vel.y = suave(me.vel.y, -v, CAIDA.RESP_V, dt);
    me.vel.x = suave(me.vel.x, obj.x, CAIDA.RESP_H, dt);
    me.vel.z = suave(me.vel.z, obj.z, CAIDA.RESP_H, dt);
    me.freno = suave(me.freno, 0, 4, dt);
    if (altura < PARACAIDAS.LIMITE) { abrirParacaidas(me); evento = 'abrir'; }
  } else if (me.state === 'glider') {
    if (altura < PARACAIDAS.LIMITE) me.paraBloq = true;
    const frena = ent.atras && !ent.adelante;
    me.freno = suave(me.freno, frena ? 1 : 0, 3, dt);
    me.caida = suave(me.caida, 0, 2, dt);
    const adelante = frena ? PARACAIDAS.H_FRENO : ent.adelante ? PARACAIDAS.H_ADELANTE : PARACAIDAS.H;
    const v = frena ? PARACAIDAS.V_FRENO : ent.adelante ? PARACAIDAS.V_ADELANTE : PARACAIDAS.V;
    const obj = new THREE.Vector3().addScaledVector(ent.fwd, adelante).addScaledVector(ent.right, lat * PARACAIDAS.H_LADO);
    me.vel.y = suave(me.vel.y, -v, PARACAIDAS.RESP_V, dt);
    me.vel.x = suave(me.vel.x, obj.x, PARACAIDAS.RESP_H, dt);
    me.vel.z = suave(me.vel.z, obj.z, PARACAIDAS.RESP_H, dt);
  }
  return evento;
}

export function abrirParacaidas(me) {
  me.state = 'glider';
  me.yawPrev = null;
}

// Cerrarlo solo vale arriba del límite y si no se bloqueó antes.
export function puedeCerrar(me, altura) {
  return me.state === 'glider' && !me.paraBloq && altura >= PARACAIDAS.LIMITE;
}
export function cerrarParacaidas(me) {
  me.state = 'falling';
  me.caida = 0;
}

// ---------- Deslizarse ----------
export function puedeDeslizar(me, nadando) {
  return me.state === 'ground' && me.onGround && !nadando && !me.desliz && !me.use && Math.hypot(me.vel.x, me.vel.z) >= DESLIZ.MIN_VEL;
}

export function empezarDeslizar(me) {
  const hs = Math.hypot(me.vel.x, me.vel.z);
  const v = Math.min(DESLIZ.MAX, Math.max(DESLIZ.MIN_IMPULSO, hs * DESLIZ.IMPULSO));
  me.vel.x *= v / hs; me.vel.z *= v / hs;
  me.desliz = { t: 0, aire: 0, yaw: Math.atan2(-me.vel.x, -me.vel.z) };
  me.dance = false;
}

export function terminarDeslizar(me) { me.desliz = null; }

// pend: pendiente del piso (dh/dx, dh/dz); dir: hacia donde se quiere ir (vector horizontal, puede ser 0);
// sigue: la tecla de deslizarse sigue apretada. Devuelve false cuando termina.
export function fisicaDeslizar(me, dt, pend, dir, sigue) {
  const d = me.desliz;
  d.t += dt;
  d.aire = me.onGround ? 0 : d.aire + dt;
  let v = Math.hypot(me.vel.x, me.vel.z);
  if (v < 1e-3 || d.aire > 0.3 || (!sigue && d.t > DESLIZ.MIN_T)) { terminarDeslizar(me); return false; }
  let ang = Math.atan2(me.vel.z, me.vel.x);
  if (dir.lengthSq() > 0.01) {
    let da = Math.atan2(dir.z, dir.x) - ang;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    ang += clamp(da, -DESLIZ.GIRO * dt, DESLIZ.GIRO * dt);
  }
  const ux = Math.cos(ang), uz = Math.sin(ang);
  const subida = pend.x * ux + pend.y * uz;            // > 0 cuesta arriba
  v += (-subida * DESLIZ.PENDIENTE - DESLIZ.ROCE) * dt;
  v = Math.min(DESLIZ.MAX, v);
  if (v < DESLIZ.FIN && d.t > DESLIZ.MIN_T) { terminarDeslizar(me); return false; }
  v = Math.max(v, 0);
  me.vel.x = ux * v; me.vel.z = uz * v;
  // el cuerpo mira hacia donde se desliza (la cámara queda libre)
  const obj = Math.atan2(-ux, -uz);
  let dy = obj - d.yaw;
  d.yaw += Math.atan2(Math.sin(dy), Math.cos(dy)) * Math.min(1, dt * 10);
  return true;
}

// Parámetros de animación que viajan en el mensaje 'state' (enteros chicos): caída, giro, freno, deslizando.
export function paramsRed(me) {
  return [Math.round(me.caida * 100), Math.round(me.giro * 100), Math.round(me.freno * 100), me.desliz ? 1 : 0];
}
export function leerParams(x) {
  const n = (i) => (Array.isArray(x) && Number.isFinite(x[i]) ? x[i] : 0);
  return { caida: clamp(n(0) / 100, -1, 1), giro: clamp(n(1) / 100, -1, 1), freno: clamp(n(2) / 100), desliz: !!n(3) };
}
