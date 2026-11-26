// Construcción en el cliente: modo construcción, vista previa, colocar piezas, edición y su parte del HUD.
// main.js le pasa las acciones (ya resueltas por controles.js) y la llama en cada cuadro.
import * as THREE from 'three';
import { MATERIALS, MAT_ORDER, BUILD_COST } from './items.js';
import {
  TIPOS, NOMBRES, objetivoPieza, motivoNoEncaja, MOTIVOS, superficie, rayoEdicion, marcasIniciales, resultadoEdicion, ALCANCE_EDICION, cajaPieza,
} from './construccion.js';
import { makeStructMesh, pintarFantasma, grillaEdicion, pintarGrilla, liberarGrilla, liberar } from './construccion3d.js';
import { registrarAccion, registrarOpcion, opcion, teclaDe } from './controles.js';

// Controles propios de la construcción (los demás ya están en controles.js). cambiarMaterial va antes que el techo para que V no quede en las dos.
registrarAccion('cambiarMaterial', 'Cambiar material', 'Construcción', ['Mouse2'], 'construccion');
registrarAccion('construirTecho', 'Construir techo', 'Construcción', ['KeyV'], 'todos');
registrarAccion('editar', 'Editar construcción', 'Construcción', ['KeyF'], 'todos');
registrarAccion('girar', 'Girar pieza', 'Construcción', ['KeyR'], 'construccion');
// Opciones de construcción que hacen todo más rápido (como en el género).
registrarOpcion({ id: 'editarAlSoltar', nombre: 'Confirmar la edición al soltar la tecla', ayuda: 'Mantené apretada la tecla de editar, marcá las partes y soltala para confirmar. Un toque corto sigue dejando la edición abierta', grupo: 'Juego', tipo: 'si-no', def: true });
registrarOpcion({ id: 'reiniciarPieza', nombre: 'Volver a la pared al entrar a construir', ayuda: 'Si está apagado, entrar a construir elige la última pieza que usaste', grupo: 'Juego', tipo: 'si-no', def: false });
registrarOpcion({ id: 'construirSeguido', nombre: 'Construir seguido manteniendo el clic', grupo: 'Juego', tipo: 'si-no', def: true });

const ACCION_PIEZA = { pared: 'construirPared', piso: 'construirPiso', rampa: 'construirRampa', techo: 'construirTecho' };
const PIEZA_ACCION = Object.fromEntries(Object.entries(ACCION_PIEZA).map(([k, v]) => [v, k]));

// Íconos de la barra de construcción
const ICONOS = {
  pared: '<svg viewBox="0 0 40 40"><rect x="7" y="6" width="26" height="28" rx="2"/><path d="M7 15.3h26M7 24.6h26M16 6v9.3M24 15.3v9.3M16 24.6V34"/></svg>',
  piso: '<svg viewBox="0 0 40 40"><path d="M4 26 15 15h21L25 26Z"/><path d="M4 26v3h21l11-11v-3M25 26v3M9.5 20.5h21M20 15l-5.5 11"/></svg>',
  rampa: '<svg viewBox="0 0 40 40"><path d="M5 33h30V9Z"/><path d="M11 28.5h6v-4.5M17 24h6v-4.5M23 19.5h6V15"/></svg>',
  techo: '<svg viewBox="0 0 40 40"><path d="M3 29 20 9l17 20Z"/><path d="M20 9 14 29M20 9l12 20M3 29h34"/></svg>',
};

export function crearConstruccion({ scene, camera, me, getWorld, getMyId, sendMsg, ui, sfx, feed }) {
  let ultima = 'pared'; // pieza que vuelve a elegir Q
  let giro = 0; // vueltas extra de la rampa (R)
  let fantasma = null, fantasmaKey = '', objetivoActual = null, ultimaColocada = '', tColocada = 0, motivo = null, clicSuelto = true;
  let edit = null; // { s, grilla, marcas, camino, pinta, hover, valida }
  const _o = new THREE.Vector3(), _d = new THREE.Vector3();

  const puede = () => me.state === 'ground';

  function contexto() { return me.build || edit ? 'construccion' : 'combate'; }

  // ---------- Modo construcción ----------
  function entrar(tipo) {
    if (!puede() && !me.build) return;
    if (edit) confirmarEdicion();
    me.build = tipo; ultima = tipo;
    if (me.use) me.cancelUse?.();
    autoMaterial(false);
    limpiarFantasma();
    sfx.click();
    me.onBuildChange?.();
  }
  function salir() {
    if (edit) confirmarEdicion();
    if (!me.build) return;
    me.build = null;
    limpiarFantasma();
    me.onBuildChange?.();
  }
  function cambiarMaterial() {
    const i = MAT_ORDER.indexOf(me.mat);
    // el siguiente que alcance para una pieza; si ninguno alcanza, el siguiente nomás
    for (let k = 1; k <= 3; k++) {
      const m = MAT_ORDER[(i + k) % 3];
      if ((me.mats[m] || 0) >= BUILD_COST || k === 3) { me.mat = MAT_ORDER[(i + (((me.mats[m] || 0) >= BUILD_COST) ? k : 1)) % 3]; break; }
    }
    fantasmaKey = '';
    sfx.click();
    me.onBuildChange?.();
  }
  // Si el material elegido no alcanza para una pieza, pasa solo al siguiente que alcance.
  function autoMaterial(avisar = true) {
    if ((me.mats[me.mat] || 0) >= BUILD_COST) return;
    const i = MAT_ORDER.indexOf(me.mat);
    for (let k = 1; k < 3; k++) {
      const m = MAT_ORDER[(i + k) % 3];
      if ((me.mats[m] || 0) >= BUILD_COST) {
        me.mat = m; fantasmaKey = '';
        if (avisar && me.build) feed(`Sin ${MATERIALS[MAT_ORDER[i]].name.toLowerCase()}: ahora con ${MATERIALS[m].name.toLowerCase()}`, MATERIALS[m].color);
        return;
      }
    }
  }

  // Acciones (ids de controles.js). Devuelve true si la usó.
  function accion(id) {
    if (PIEZA_ACCION[id]) { entrar(PIEZA_ACCION[id]); return true; }
    switch (id) {
      case 'modoConstruccion': if (edit && !me.build) { confirmarEdicion(); return true; } if (me.build) salir(); else entrar(opcion('reiniciarPieza') ? 'pared' : ultima); return true;
      case 'cambiarMaterial': if (edit) { restablecerEdicion(); return true; } if (me.build) { cambiarMaterial(); return true; } return false;
      case 'girar': if (me.build && !edit) { giro = (giro + 1) % 4; fantasmaKey = ''; return true; } return false;
      case 'editar': if (edit) confirmarEdicion(); else empezarEdicion(); return true;
    }
    return false;
  }

  // ---------- A dónde va la pieza ----------
  // La grilla de encastre y las reglas (qué pieza va en qué borde) están en construccion.js, las mismas que valida el servidor.
  const objetivo = (world, tipo) => objetivoPieza(world, me, tipo, giro);

  function limpiarFantasma() { if (fantasma) { scene.remove(fantasma); liberar(fantasma); fantasma = null; fantasmaKey = ''; } objetivoActual = null; }

  function actualizarFantasma(world, mouseDown) {
    if (!me.build || !puede()) { limpiarFantasma(); ponerMotivo(null); return; }
    const t = objetivo(world, me.build);
    const k = `${t.key}:${t.dir}:${t.mat}`;
    if (k !== fantasmaKey) {
      limpiarFantasma();
      fantasma = makeStructMesh(t, true);
      scene.add(fantasma);
      fantasmaKey = k;
    }
    objetivoActual = t;
    // verde = encaja en la grilla (en el borde de otra pieza o en el piso) y alcanza el material; rojo = no
    const libre = !world.structs.has(t.key);
    const alcanza = (me.mats[me.mat] || 0) >= BUILD_COST;
    const por = motivoNoEncaja(world, t);
    const ok = alcanza && !por;
    pintarFantasma(fantasma, ok);
    fantasma.visible = libre;
    ponerMotivo(libre && por && por !== 'ocupado' ? por : null);
    // mantener apretado construye seguido (cada pieza una vez); con "construir seguido" apagado, un clic = una pieza
    const ahora = performance.now();
    if (!mouseDown) clicSuelto = true;
    const seguido = opcion('construirSeguido') !== false;
    if (mouseDown && ok && (seguido || clicSuelto) && ahora - tColocada > 90 && (t.key !== ultimaColocada || ahora - tColocada > 400)) {
      tColocada = ahora; ultimaColocada = t.key; clicSuelto = false;
      sendMsg({ t: 'build', type: t.type, i: t.i, j: t.j, y: t.y, dir: t.dir, mat: t.mat });
    }
  }
  // Cartel corto en la ayuda de construcción cuando la pieza no encaja (por qué está roja).
  function ponerMotivo(m) {
    if (m === motivo) return;
    motivo = m;
    hud();
  }

  // ---------- Edición ----------
  function rayoCamara() {
    camera.getWorldPosition(_o);
    camera.getWorldDirection(_d);
    return { o: _o, d: _d };
  }
  function empezarEdicion() {
    const world = getWorld();
    if (!world || !puede()) return;
    const { o, d } = rayoCamara();
    const alcance = o.distanceTo(me.pos) + ALCANCE_EDICION;
    const tope = Math.min(alcance, world.rayTerrain(o, d, alcance));
    let mejor = null;
    const yo = getMyId();
    for (const s of world.structs.values()) {
      if (s.owner !== yo) continue;
      const b = cajaPieza(s);
      const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, cz = (b.z0 + b.z1) / 2;
      if (Math.hypot(cx - me.pos.x, cy - me.pos.y - 1, cz - me.pos.z) > ALCANCE_EDICION) continue;
      const h = rayoEdicion(s, o, d);
      if (h && h.dist < tope && (!mejor || h.dist < mejor.dist)) mejor = { ...h, s };
    }
    if (!mejor) return;
    const s = mejor.s;
    const grilla = grillaEdicion(s);
    scene.add(grilla);
    if (s.mesh) s.mesh.visible = false;
    edit = { s, grilla, marcas: marcasIniciales(s), camino: [], pinta: null, hover: -1, valida: true, desde: performance.now() };
    limpiarFantasma();
    sfx.click();
    me.onBuildChange?.();
  }
  function terminarEdicion() {
    if (!edit) return;
    scene.remove(edit.grilla);
    liberarGrilla(edit.grilla);
    const s = getWorld()?.structs.get(edit.s.key);
    if (s?.mesh) s.mesh.visible = true;
    edit = null;
    me.onBuildChange?.();
  }
  function aplicarEdicion(e, dir) {
    const s = edit.s;
    if (e !== (s.e || 0) || dir !== s.dir) {
      sendMsg({ t: 'edit', key: s.key, e, dir });
      getWorld().editStruct(s.key, e, dir); // se ve al instante; el servidor confirma con structEdit
      sfx.build();
    }
  }
  function confirmarEdicion() {
    if (!edit) return;
    const r = resultadoEdicion(edit.s, edit.marcas, edit.camino);
    if (r) aplicarEdicion(r.e, r.dir);
    terminarEdicion();
  }
  // Soltar la tecla de editar (opción "Confirmar la edición al soltar"): si se la mantuvo apretada o ya se marcó algo, confirma.
  function soltarEditar() {
    if (!edit || !opcion('editarAlSoltar')) return;
    const toque = performance.now() - edit.desde < 250 && edit.marcas === marcasIniciales(edit.s);
    if (!toque) confirmarEdicion();
  }
  function restablecerEdicion() {
    if (!edit) return;
    aplicarEdicion(0, edit.s.dir);
    terminarEdicion();
  }
  function actualizarEdicion(world, mouseDown) {
    const s = world.structs.get(edit.s.key);
    if (!s || s !== edit.s || !puede()) { terminarEdicion(); return; }
    const b = cajaPieza(s);
    if (Math.hypot((b.x0 + b.x1) / 2 - me.pos.x, (b.z0 + b.z1) / 2 - me.pos.z) > ALCANCE_EDICION + 2) { terminarEdicion(); return; }
    const { o, d } = rayoCamara();
    const h = rayoEdicion(s, o, d);
    edit.hover = h && h.dist < o.distanceTo(me.pos) + ALCANCE_EDICION + 2 ? h.k : -1;
    const rampa = s.type === 'rampa';
    if (mouseDown && edit.hover >= 0) {
      const k = edit.hover, marcada = (edit.marcas >> k) & 1;
      if (edit.pinta === null) {
        if (rampa) { edit.marcas = 0; edit.camino = []; edit.pinta = 1; } else edit.pinta = marcada ? 0 : 1;
      }
      if (edit.pinta && !((edit.marcas >> k) & 1)) { edit.marcas |= 1 << k; edit.camino.push(k); }
      else if (!edit.pinta) edit.marcas &= ~(1 << k);
    } else if (!mouseDown) edit.pinta = null;
    edit.valida = !!resultadoEdicion(s, edit.marcas, edit.camino) || (rampa && !edit.marcas);
    pintarGrilla(edit.grilla, edit.marcas, edit.hover, edit.valida);
  }

  // La vida de la pieza que se mira o se golpea la muestra golpes.js (#structhp).

  // ---------- Por cuadro ----------
  function update(dt, mouseDown) {
    const world = getWorld();
    if (!world) return;
    if (edit) actualizarEdicion(world, mouseDown);
    else actualizarFantasma(world, mouseDown);
  }

  // ---------- HUD: barra de piezas arriba del inventario y ayuda solo de construcción ----------
  function hud() {
    if (!ui.buildbar) return;
    const piezas = TIPOS.map((t) => `<div class="pieza ${me.build === t && !edit ? 'active' : ''}" data-t="${t}">${ICONOS[t]}<span class="k">${teclaDe(ACCION_PIEZA[t]) || ''}</span><span class="n">${NOMBRES[t]}</span></div>`).join('');
    const mat = `<div class="pmat" style="--c:${MATERIALS[me.mat].color}"><i></i><b>${me.mats[me.mat] || 0}</b><span>${MATERIALS[me.mat].name}</span></div>`;
    ui.buildbar.innerHTML = piezas + mat;
    ui.buildbar.classList.toggle('on', !!(me.build || edit));
    ui.slots.classList.toggle('dim', !!(me.build || edit));
    let ayuda = '';
    const k = (id) => `<b>${teclaDe(id) || '—'}</b>`;
    if (edit) {
      const que = { pared: 'Marcá las partes a sacar', piso: 'Marcá las partes a sacar', rampa: 'Arrastrá hacia donde sube', techo: 'Marcá las esquinas a levantar' }[edit.s.type];
      ayuda = `<span>${que}</span><span>${k('editar')} Confirmar</span><span>${k('cambiarMaterial')} Restablecer</span>`;
    } else if (me.build) {
      ayuda = (motivo ? `<span class="no">${MOTIVOS[motivo]}</span>` : '') + `<span>${k('editar')} Editar</span>${me.build === 'rampa' ? `<span>${k('girar')} Girar</span>` : ''}<span>${k('cambiarMaterial')} Material</span><span>${k('modoConstruccion')} Salir</span>`;
    }
    ui.buildhint.innerHTML = ayuda;
    ui.buildhint.classList.toggle('hidden', !ayuda);
  }

  // Del servidor
  function alAgregar(s) {
    s.recibido = performance.now();
    s.creceHasta = s.recibido + (s.crece || 0) * 1000;
    // como en el género: una rampa o un piso que aparece donde estoy parado me sube arriba (no quedo adentro)
    if (me.state !== 'ground' || s.type === 'pared') return;
    const top = superficie(s, me.pos.x, me.pos.z);
    if (top !== null && top > me.pos.y && top < me.pos.y + 2.2) { me.pos.y = top; if (me.vel.y < 0) me.vel.y = 0; }
  }
  function alCambiarVida(s, hp) { s.hp = hp; s.recibido = performance.now(); }

  function cancelar() { terminarEdicion(); if (me.build) { me.build = null; limpiarFantasma(); } }

  return {
    accion, update, hud, contexto, cancelar, salir, autoMaterial, alAgregar, alCambiarVida,
    get editando() { return !!edit; },
    get objetivo() { return objetivoActual; },
    confirmarEdicion, soltarEditar,
  };
}
