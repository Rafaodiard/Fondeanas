// Autos en el cliente: mallas, manejo del auto propio, autos de los demás, subir y bajar, pose sentado, HUD y sonidos.
// La física y las medidas son las de autos.js (las mismas que usa el servidor). El que maneja un auto lo simula y
// manda su estado (15 por segundo); el servidor lo valida y lo reparte; los demás lo ven interpolado.
// main.js llama a update() en cada cuadro y le pasa los mensajes del servidor con mensaje().
import * as THREE from 'three';
import {
  AUTO, ASIENTOS, nuevoAuto, aplicarRed, estadoRed, fisicaAuto, avance, rapidez, derecha, lugarBajada, puntoMundo, pisaA,
  rayoAuto, aLocal, materialChoque,
} from './autos.js';
import { createAuto, animateCharacter } from './models.js';
import { activa, teclaDe } from './controles.js';
import { CADERA_SENTADO } from './rig.js';

const ENVIO = 1 / 15;          // estados por segundo del auto que se maneja
const LEJOS = 450;             // más lejos que esto el auto no se dibuja
const GIRO_VOLANTE = 2.1;      // vueltas del volante (rad) con la dirección a fondo
// Manos en el aro del volante (radio 0.19, en el plano XY del nodo): "diez y diez", un poco hacia el conductor.
const MANO_I = new THREE.Vector3(-0.172, 0.07, 0.035), MANO_D = new THREE.Vector3(0.172, 0.07, 0.035);
// Caños de escape (para la llama del turbo), en coordenadas del auto.
const NO_SUBE = { lleno: 'El auto está lleno', lejos: 'Acercate más al auto', roto: 'Ese auto está destruido', estado: 'Para subir tenés que estar parado en el piso' };
const ESCAPES = [[-0.55, 0.34, 2.26], [-0.42, 0.34, 2.26]];

// vida(o): vida que se conoce de una cosa del mapa ({ pz } | { key } | { res, idx }), para predecir si el auto la rompe.
export function crearManejo({ scene, camera, me, getWorld, getMyId, sendMsg, ui, sfx, others, explosion, alSubir, alBajar, feed = () => {}, vida = null }) {
  let pedido = null; // { i, t }: pidió subir y espera la respuesta del servidor
  let autos = [];               // { a, mesh, giroRueda, obj, tObj, llamas }
  let tEnvio = 0, enviado = new Map(), tBocina = 0, tAtropello = new Map(), tChoque = 0, turbaba = false;
  let tMouse = 0;               // último movimiento del mouse (la cámara vuelve sola atrás del auto si no se toca)
  const _p = new THREE.Vector3(), _q = new THREE.Vector3();
  const manosMundo = [new THREE.Vector3(), new THREE.Vector3()];

  // ---------- Partida ----------
  function iniciar(lista) {
    for (const e of autos) scene.remove(e.mesh);
    const world = getWorld();
    const base = lista?.length ? lista : world.autoSpawns.map((sp) => ({ p: [sp.x, sp.y, sp.z], q: [sp.yaw, 0, 0], color: sp.color }));
    autos = base.map((d, i) => {
      const a = nuevoAuto(i, { x: d.p[0], y: d.p[1], z: d.p[2], yaw: d.q[0], color: d.color });
      aplicarRed(a, d);
      if (d.hp !== undefined) a.hp = d.hp;
      a.rota = !!d.rota;
      if (Array.isArray(d.seats)) a.seats = d.seats.slice(0, 4);
      const mesh = createAuto(d.color || '#c8261d');
      mesh.rotation.order = 'YXZ';
      scene.add(mesh);
      if (a.rota) mesh.userData.quemar();
      const e = { a, mesh, giroRueda: 0, obj: null, tObj: 0, llamas: null };
      colocarMalla(e, 0);
      return e;
    });
    world.dinamicos = autos.map((e) => e.a);
    enviado = new Map(); tAtropello = new Map();
    me.auto = null;
  }

  // ---------- Mensajes del servidor ----------
  function mensaje(m) {
    const e = autos[m.a];
    switch (m.t) {
      case 'auto':
        if (!e || e.a.ctrl === getMyId()) return true;
        e.obj = { ...m }; e.tObj = performance.now();
        return true;
      case 'autoSeats': {
        if (!e) return true;
        const antes = e.a.seats.indexOf(getMyId());
        e.a.seats = m.seats.slice(0, 4);
        const era = e.a.ctrl;
        e.a.ctrl = m.ctrl;
        // el que toma el control arranca desde lo que se ve (sin saltos)
        if (m.ctrl === getMyId() && era !== getMyId()) e.obj = null;
        const ahora = e.a.seats.indexOf(getMyId());
        if (ahora >= 0 && antes < 0) subi(e, ahora);
        else if (ahora >= 0 && me.auto) { if (me.auto.k !== ahora) sfx.puerta(); me.auto.k = ahora; }
        else if (antes >= 0 && me.auto?.i === e.a.id) baje(e, antes);
        return true;
      }
      case 'autoHp':
        if (e) { e.a.hp = m.hp; e.mesh.userData.golpe = 1; }
        return true;
      case 'autoBoom':
        if (!e) return true;
        e.a.hp = 0; e.a.rota = true;
        e.a.vx *= 0.2; e.a.vz *= 0.2;
        e.mesh.userData.quemar();
        explosion(_p.set(e.a.x, e.a.y + 0.9, e.a.z));
        return true;
      case 'autoNo':
        // el servidor no dejó subir: se dice por qué
        pedido = null;
        feed(NO_SUBE[m.por] || 'No se pudo subir al auto', '#ff6b6b');
        return true;
      case 'bocina':
        if (e) sfx.bocina(Math.hypot(e.a.x - me.pos.x, e.a.z - me.pos.z));
        return true;
    }
    return false;
  }

  function subi(e, k) {
    pedido = null;
    me.auto = { i: e.a.id, k };
    me.state = 'auto';
    me.vel.set(0, 0, 0);
    me.pitch = -0.22;
    sfx.puerta();
    alSubir?.();
  }
  function baje(e, k) {
    me.auto = null;
    if (me.state !== 'auto') return;
    const world = getWorld();
    const p = lugarBajada(world, e.a, k);
    me.pos.set(p.x, p.y, p.z);
    // se baja con parte del envión del auto
    me.vel.set(e.a.vx * 0.5, 0, e.a.vz * 0.5);
    me.state = 'ground'; me.onGround = true; me.minVy = 0;
    me.mesh.rotation.set(0, me.yaw, 0);
    sfx.puerta();
    alBajar?.();
  }

  // ---------- Acciones (contexto 'vehiculo') ----------
  function accion(a) {
    if (me.state !== 'auto' || !me.auto) return;
    if (a === 'bajarAuto') sendMsg({ t: 'bajar' });
    else if (a === 'cambiarAsiento') sendMsg({ t: 'asiento' });
    else if (a === 'bocina') {
      const t = performance.now();
      if (t - tBocina < 450) return;
      tBocina = t;
      sendMsg({ t: 'bocina' });
      sfx.bocina(0);
    }
  }
  /** Auto al alcance para subirse (el más cercano con lugar), para el cartel de interactuar. */
  function cercano() {
    if (me.state !== 'ground') return null;
    let mejor = null, md = AUTO.ALCANCE;
    for (const e of autos) {
      const a = e.a;
      if (a.rota || !a.seats.includes(null) || Math.abs(a.y - me.pos.y) > 2.5) continue;
      // distancia al costado de la carrocería, no al centro: se sube por cualquier puerta
      const [lx, lz] = aLocal(a, me.pos.x, me.pos.z);
      const dx = Math.max(0, Math.abs(lx) - AUTO.ANCHO / 2), dz = Math.max(0, Math.abs(lz) - AUTO.LARGO / 2);
      const d = Math.hypot(dx, dz) + 1.2;
      if (d < md && Math.hypot(a.x - me.pos.x, a.z - me.pos.z) <= AUTO.ALCANCE) { md = d; mejor = e; }
    }
    return mejor && { d: md, i: mejor.a.id, maneja: mejor.a.seats[0] === null };
  }
  function subir(i) {
    if (pedido && performance.now() - pedido.t < 1500) return;
    pedido = { i, t: performance.now() };
    sendMsg({ t: 'subir', a: i });
  }

  // ---------- Cada cuadro ----------
  function update(dt) {
    const world = getWorld(), myId = getMyId();
    const mio = me.auto ? autos[me.auto.i] : null;
    // sin respuesta del servidor (por ejemplo, un servidor viejo que no conoce los autos): se avisa en vez de no hacer nada
    if (pedido && performance.now() - pedido.t > 2500) {
      pedido = null;
      feed('El servidor no respondió: si actualizaste el juego, reiniciá el servidor (Ctrl+C y npm start)', '#ff6b6b');
    }
    const manejo = mio && me.auto.k === 0 && mio.a.ctrl === myId && me.state === 'auto';
    for (const e of autos) {
      const a = e.a;
      if (a.ctrl === myId) simularPropio(world, e, manejo && e === mio, dt);
      else seguirRed(e, dt);
      colocarMalla(e, dt);
    }
    tEnvio -= dt;
    if (tEnvio <= 0) {
      tEnvio = ENVIO;
      for (const e of autos) {
        if (e.a.ctrl !== myId) continue;
        const quieto = rapidez(e.a) < 0.05 && Math.abs(e.a.vy) < 0.05 && e.a.suelo;
        // un auto quieto se repite cada 1,5 s nomás (por si el servidor rechazó el último por llegar todo junto)
        const t = performance.now();
        if (quieto && t - (enviado.get(e.a.id) || 0) < 1500) continue;
        enviado.set(e.a.id, quieto ? t : 0);
        sendMsg({ t: 'auto', a: e.a.id, ...estadoRed(e.a) });
      }
    }
    if (mio && me.state === 'auto') sentarme(mio, dt, manejo);
    sonidos(mio, manejo);
  }

  // El auto que simula este jugador: con las teclas si lo maneja, o solo (sin motor) hasta que se frena.
  function simularPropio(world, e, conTeclas, dt) {
    const a = e.a;
    const ent = conTeclas
      ? { acel: activa('acelerar'), freno: activa('frenar'), izq: activa('doblarIzq'), der: activa('doblarDer'), mano: activa('frenoMano'), turbo: activa('turbo') }
      : { acel: false, freno: false, izq: false, der: false, mano: !a.seats.some((s) => s !== null), turbo: false };
    if (!conTeclas && rapidez(a) < 0.05 && a.suelo && Math.abs(a.vy) < 0.05) { a.frena = false; return; }
    const golpe = fisicaAuto(world, a, ent, dt, emb);
    embestidas(world, e);
    if (golpe > 3) {
      const d = Math.hypot(a.x - me.pos.x, a.z - me.pos.z);
      sfx.choque(golpe, d);
      e.mesh.userData.golpe = Math.min(1, golpe / 12);
      const t = performance.now();
      if (golpe >= 12 && t - tChoque > 400) { tChoque = t; sendMsg({ t: 'choque', a: a.id, v: +golpe.toFixed(1) }); }
    }
    // atropellos: el que maneja avisa a quién pisó (el servidor calcula el daño con la velocidad que conoce)
    if (conTeclas && rapidez(a) >= AUTO.ATROPELLO) {
      const t = performance.now();
      for (const [id, o] of others) {
        if (!o.mesh.visible || o.state !== 'ground' || asientoDe(id)) continue;
        if (!pisaA(a, o.mesh.position)) continue;
        if (t - (tAtropello.get(id) || 0) < 700) continue;
        tAtropello.set(id, t);
        sendMsg({ t: 'atropello', pid: id });
      }
    }
  }

  // Lo que el auto chocó fuerte (rompió o dañó): se le avisa al servidor, que decide con la vida de verdad y le avisa
  // a todos (pzHp/pzRota, structHp/structDel, resHit/resGone). Acá solo el golpe: sonido y sacudón.
  const emb = { vida: (o) => vidaDe(o) };
  function vidaDe(o) {
    if (vida) { const v = vida(o.pz !== undefined ? { tipo: 'pz', id: o.pz } : o.key ? { tipo: 'key', id: o.key } : { tipo: o.res, id: o.idx }); return v ? v.hp : null; }
    const w = getWorld(), p = o.pz !== undefined && w.piezas[o.pz];
    return p ? (p.vida ?? p.hp) : materialChoque(w, o) ? 150 : null;
  }
  function embestidas(world, e) {
    const a = e.a;
    if (!a.embestidas?.length) return;
    const d = Math.hypot(a.x - me.pos.x, a.z - me.pos.z);
    for (const g of a.embestidas.splice(0)) {
      sendMsg({ t: 'embestida', a: a.id, o: g.o, v: g.v });
      sfx.choque(g.rompe ? Math.min(14, 4 + g.v * 0.3) : g.v * 0.6, d);
      e.mesh.userData.golpe = Math.max(e.mesh.userData.golpe || 0, Math.min(1, g.v / (g.rompe ? 30 : 16)));
    }
  }

  // Auto de otro: va hacia el último estado recibido, adelantado con su velocidad (a lo sumo 0.3 s).
  function seguirRed(e, dt) {
    const a = e.a, o = e.obj;
    if (!o) return;
    const adel = Math.min(0.3, (performance.now() - e.tObj) / 1000);
    const k = 1 - Math.exp(-dt * 12);
    const lejos = Math.hypot(o.p[0] - a.x, o.p[2] - a.z) > 12;
    const tx = o.p[0] + o.v[0] * adel, ty = o.p[1] + o.v[1] * adel * 0.5, tz = o.p[2] + o.v[2] * adel;
    if (lejos) { a.x = tx; a.y = ty; a.z = tz; } else { a.x += (tx - a.x) * k; a.y += (ty - a.y) * k; a.z += (tz - a.z) * k; }
    const ang = (de, a2) => Math.atan2(Math.sin(a2 - de), Math.cos(a2 - de));
    a.yaw += ang(a.yaw, o.q[0]) * (lejos ? 1 : k);
    a.pitch += (o.q[1] - a.pitch) * k;
    a.roll += (o.q[2] - a.roll) * k;
    [a.vx, a.vy, a.vz] = o.v;
    a.giro += ((o.g || 0) - a.giro) * k;
    const f = o.f | 0;
    a.frena = !!(f & 1); a.turbando = !!(f & 2); a.suelo = !!(f & 4);
  }

  // Malla: posición, ruedas que giran y doblan, volante, luces de freno, llama del turbo y el sacudón de un golpe.
  function colocarMalla(e, dt) {
    const a = e.a, m = e.mesh, u = m.userData;
    const dCam = Math.hypot(a.x - camera.position.x, a.z - camera.position.z);
    m.visible = dCam < LEJOS;
    if (!m.visible) return;
    m.position.set(a.x, a.y, a.z);
    let sacude = 0;
    if (u.golpe > 0) { u.golpe = Math.max(0, u.golpe - dt * 4); sacude = Math.sin(u.golpe * 30) * u.golpe * 0.025; }
    m.rotation.set(a.pitch + sacude, a.yaw, a.roll + sacude * 0.6);
    if (dCam > 120 && dt) return; // de lejos no hace falta animar las ruedas
    e.giroRueda -= (avance(a) / AUTO.R_RUEDA) * dt;
    const dir = -a.giro * AUTO.GIRO_MAX * 0.85;
    for (const n in u.ruedas) {
      const r = u.ruedas[n];
      r.rotation.x = e.giroRueda;
      if (n === 'Rueda_DI' || n === 'Rueda_DD') r.rotation.y = dir;
    }
    if (u.volante) u.volante.rotation.z = -a.giro * GIRO_VOLANTE;
    if (u.frenos) u.frenos.emissiveIntensity = (u.frenoBase || 0.4) * (a.frena && !a.rota ? 4 : 1);
    if (a.turbando && !a.rota) {
      if (!e.llamas) e.llamas = llamas(m);
      e.llamas.visible = true;
      e.llamas.scale.setScalar(0.8 + Math.random() * 0.5);
    } else if (e.llamas) e.llamas.visible = false;
  }

  // Llama azul y naranja en los dos escapes mientras se usa el turbo.
  let llamaGeo = null, llamaMats = null;
  function llamas(mesh) {
    llamaGeo ||= new THREE.ConeGeometry(0.045, 0.42, 8, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.21);
    llamaMats ||= [new THREE.MeshBasicMaterial({ color: '#7fd3ff', transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }),
      new THREE.MeshBasicMaterial({ color: '#ff9a3c', transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })];
    const g = new THREE.Group();
    for (const [x, y, z] of ESCAPES) {
      const c = new THREE.Mesh(llamaGeo, llamaMats[0]); c.position.set(x, y, z);
      const c2 = new THREE.Mesh(llamaGeo, llamaMats[1]); c2.position.set(x, y, z); c2.scale.set(1.6, 1.6, 1.5);
      g.add(c, c2);
    }
    mesh.add(g);
    return g;
  }

  // ---------- Gente sentada ----------
  /** ¿En qué auto y asiento va el jugador id? */
  function asientoDe(id) {
    for (const e of autos) { const k = e.a.seats.indexOf(id); if (k >= 0) return { e, k }; }
    return null;
  }
  // Apoya al personaje en el asiento k del auto (con el auto inclinado) y lo anima sentado.
  function sentar(mesh, e, k, dt) {
    const a = e.a, s = ASIENTOS[k];
    const [x, y, z] = puntoMundo(a, s.x, s.y + 0.1 - CADERA_SENTADO, s.z + 0.04);
    mesh.position.set(x, y, z);
    mesh.rotation.set(a.pitch, a.yaw, a.roll, 'YXZ');
    let manos = null;
    const vol = e.mesh.userData.volante;
    if (k === 0 && vol) {
      e.mesh.updateMatrixWorld(true);
      manos = [vol.localToWorld(manosMundo[0].copy(MANO_I)), vol.localToWorld(manosMundo[1].copy(MANO_D))];
    }
    animateCharacter(mesh, 'auto', 0, dt, false, { asiento: k, giro: a.giro, manos });
  }
  function sentarme(e, dt, manejo) {
    const s = ASIENTOS[me.auto.k];
    const [x, y, z] = puntoMundo(e.a, s.x, s.y, s.z);
    me.pos.set(x, y, z);
    me.vel.set(e.a.vx, e.a.vy, e.a.vz);
    me.onGround = true;
    me.mesh.visible = true;
    sentar(me.mesh, e, me.auto.k, dt);
    // la cámara vuelve sola atrás del auto cuando se maneja sin tocar el mouse
    if (manejo && performance.now() - tMouse > 1200 && avance(e.a) > 4) {
      const d = Math.atan2(Math.sin(e.a.yaw - me.yaw), Math.cos(e.a.yaw - me.yaw));
      me.yaw += d * Math.min(1, dt * 1.6);
      me.pitch += (-0.2 - me.pitch) * Math.min(1, dt * 1.2);
    }
  }
  /** Para updateOthers: si el jugador id va en un auto, lo sienta y devuelve true. */
  function sentarOtro(id, mesh, dt) {
    const s = asientoDe(id);
    if (!s) return false;
    mesh.visible = s.e.mesh.visible;
    if (mesh.visible) sentar(mesh, s.e, s.k, dt);
    return true;
  }

  // ---------- Sonidos ----------
  function sonidos(mio, manejo) {
    let motor = 0, rpm = 0, derrape = 0;
    if (mio && me.state === 'auto' && !mio.a.rota) {
      const a = mio.a, v = Math.abs(avance(a));
      motor = 1;
      rpm = Math.min(1, v / AUTO.MAX * 0.8 + (a.acelera ? 0.18 : 0) + (a.turbando ? 0.15 : 0));
      const [rx, rz] = derecha(a);
      const lat = Math.abs(a.vx * rx + a.vz * rz);
      derrape = a.suelo ? Math.max(0, Math.min(1, (lat - 2.5) / 7)) : 0;
      if (manejo && a.turbando && !turbaba) sfx.turbo();
      turbaba = !!a.turbando;
    } else {
      // el motor del auto andando más cercano
      let md = 50;
      for (const e of autos) {
        const a = e.a;
        if (a.rota || !a.seats.some((s) => s !== null)) continue;
        const d = Math.hypot(a.x - me.pos.x, a.z - me.pos.z);
        if (d < md) { md = d; motor = (1 - d / 50) * 0.7; rpm = Math.min(1, rapidez(a) / AUTO.MAX * 0.8 + (a.acelera ? 0.15 : 0)); }
      }
      turbaba = false;
    }
    sfx.motor(motor, rpm);
    sfx.derrape(derrape);
  }

  // ---------- HUD ----------
  function hud() {
    const mio = me.auto && me.state === 'auto' ? autos[me.auto.i] : null;
    ui.autohud.classList.toggle('hidden', !mio);
    ui.hud.classList.toggle('en-auto', !!mio); // sin inventario ni materiales: en el auto no se usan
    if (!mio) return;
    const a = mio.a;
    ui.autovel.textContent = Math.round(Math.abs(avance(a)) * 3.6);
    ui.autovida.style.width = `${Math.max(0, a.hp / AUTO.VIDA) * 100}%`;
    ui.autovida.parentNode.classList.toggle('baja', a.hp < AUTO.VIDA * 0.3);
    ui.autoturbo.style.width = `${a.turbo * 100}%`;
    ui.autohud.classList.toggle('pasajero', me.auto.k !== 0);
    const k = (id) => `<b>${teclaDe(id) || '—'}</b>`;
    const ayuda = me.auto.k === 0
      ? `<span>${k('turbo')} Turbo</span><span>${k('frenoMano')} Freno de mano</span><span>${k('bocina')} Bocina</span><span>${k('cambiarAsiento')} Asiento</span><span>${k('bajarAuto')} Bajarse</span>`
      : `<span>${k('cambiarAsiento')} Cambiar de asiento</span><span>${k('bajarAuto')} Bajarse</span>`;
    if (ui.autohint.dataset.v !== ayuda) { ui.autohint.innerHTML = ayuda; ui.autohint.dataset.v = ayuda; }
  }

  // ---------- Disparos, pico y minimapa ----------
  /** Primer auto que corta el rayo antes de max (sin contar el propio): { dist, auto } o null. */
  function rayo(o, d, near, max) {
    let mejor = null;
    for (const e of autos) {
      if (me.auto && e.a.id === me.auto.i) continue;
      if (Math.hypot(e.a.x - o.x, e.a.z - o.z) > max + 4) continue;
      const t = rayoAuto(e.a, o, d, max);
      if (t > near && t < (mejor ? mejor.dist : max)) mejor = { dist: t, auto: e.a.id };
    }
    return mejor;
  }
  function minimapa(ctx, toM, escala) {
    for (const e of autos) {
      const a = e.a;
      ctx.save();
      ctx.translate(toM(a.x), toM(a.z));
      ctx.rotate(-a.yaw);
      ctx.fillStyle = a.rota ? '#333' : a.color;
      ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 1;
      const w = Math.max(2.2, AUTO.ANCHO * escala), l = Math.max(3.6, AUTO.LARGO * escala);
      ctx.fillRect(-w / 2, -l / 2, w, l); ctx.strokeRect(-w / 2, -l / 2, w, l);
      ctx.restore();
    }
  }

  return {
    iniciar, mensaje, update, accion, cercano, subir, hud, rayo, minimapa, asientoDe, sentarOtro,
    movioMouse() { tMouse = performance.now(); },
    get autos() { return autos; },
    /** El auto en el que va este jugador (o null). */
    get mio() { return me.auto ? autos[me.auto.i] : null; },
  };
}
