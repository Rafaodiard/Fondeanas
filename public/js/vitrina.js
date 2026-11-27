// Vitrina del menú: el personaje con las skins puestas, parado en una plataforma, y las fotos (miniaturas) de cada
// skin para las tarjetas de la tienda, el casillero y las cajas. Usa su propio canvas y renderer (#vitrina), así no
// toca la escena del juego, y solo dibuja mientras el menú está a la vista.
//   crearVitrina(canvas)        → { mostrar(sk, color), probar(id), soltar(), foto(id) → Promise<url>, activa(bool) }
import * as THREE from 'three';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { setRigEnv } from './rig.js';
import { createCharacter, animateCharacter, setHeld, createWeaponModel } from './models.js';
import { modeloPico, modeloMochila, envolver } from './aspecto.js'; // el tiempo de los efectos lo avanza main.js
import { cloneAsset } from './assets.js';
import { SKIN, EQUIPO_INICIAL, RAREZAS } from './skins.js';

const FOTO = { ancho: 256, alto: 256 };

export function crearVitrina(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  setRigEnv(renderer);

  // ---- escena de la vitrina ----
  const escena = new THREE.Scene();
  escena.add(new THREE.HemisphereLight('#e6f0ff', '#3a3550', 1.5));
  const sol = new THREE.DirectionalLight('#fff1d6', 2.6);
  sol.position.set(3, 7, 5);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -4, right: 4, top: 6, bottom: -2, near: 0.5, far: 20 });
  escena.add(sol);
  const contra = new THREE.DirectionalLight('#9ad1ff', 1.6);
  contra.position.set(-4, 4, -6);
  escena.add(contra);
  const plataforma = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.16, 48), new THREE.MeshStandardMaterial({ color: '#2b3566', roughness: 0.5, metalness: 0.3 }));
  plataforma.position.y = -0.09;
  plataforma.receiveShadow = true;
  escena.add(plataforma);
  const aro = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.02, 8, 64), new THREE.MeshBasicMaterial({ color: '#ffd23f' }));
  aro.rotation.x = Math.PI / 2;
  aro.position.y = 0.005;
  escena.add(aro);
  const camara = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
  const objetivo = new THREE.Vector3(0, 1.0, 0), posCam = new THREE.Vector3(0, 1.5, 6.8);
  const camObj = { obj: objetivo.clone(), pos: posCam.clone() };

  let pj = null, equipo = { ...EQUIPO_INICIAL }, colorPj = '#ff5a5f', probando = null, giro = 0, girando = false, activa = true;
  let suelto = null; // pico o arma sola (cuando se prueba un pico o un envoltorio se muestra en la mano igual)

  function armar() {
    if (pj) escena.remove(pj);
    const sk = { ...equipo };
    if (probando) sk[SKIN[probando].tipo] = probando;
    pj = createCharacter(colorPj, sk);
    pj.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const tipo = probando ? SKIN[probando].tipo : null;
    if (tipo === 'envoltorio') setHeld(pj, 'rifle', RAREZAS[SKIN[probando].rareza].color);
    pj.userData.estado = tipo === 'planeador' ? 'glider' : 'ground';
    if (tipo === 'planeador') pj.position.y = 0.4;
    escena.add(pj);
    // encuadre según lo que se mira
    if (tipo === 'planeador') { camObj.obj.set(0, 4.6, 0); camObj.pos.set(0, 3.4, 19); }
    else if (tipo === 'pico' || tipo === 'envoltorio') { camObj.obj.set(0.25, 1.15, 0); camObj.pos.set(0.6, 1.4, 4.2); }
    else { camObj.obj.set(0, 0.95, 0); camObj.pos.set(0, 1.5, 6.8); }
    // la mochila se ve de espaldas
    giro = tipo === 'mochila' ? Math.PI : 0;
  }

  function tamaño() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return false;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camara.aspect = w / h;
      camara.updateProjectionMatrix();
    }
    return true;
  }

  // arrastrar para girar
  let arrastre = null;
  canvas.addEventListener('pointerdown', (e) => { arrastre = { x: e.clientX, g: giro }; girando = true; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (arrastre) giro = arrastre.g + (e.clientX - arrastre.x) * 0.012; });
  const fin = () => { arrastre = null; setTimeout(() => { girando = false; }, 1500); };
  canvas.addEventListener('pointerup', fin);
  canvas.addEventListener('pointercancel', fin);

  const reloj = new THREE.Clock();
  function cuadro() {
    requestAnimationFrame(cuadro);
    const dt = Math.min(reloj.getDelta(), 0.05);
    if (!activa || !canvas.offsetParent || !tamaño()) return;
    if (pj) {
      if (!girando && !arrastre) giro += dt * 0.35;
      // personaje mira a -Z: rotación PI lo pone de frente a la cámara
      pj.rotation.y = Math.PI + giro;
      animateCharacter(pj, pj.userData.estado, 0, dt, false, {});
    }
    camara.position.lerp(camObj.pos, 1 - Math.exp(-dt * 6));
    objetivo.lerp(camObj.obj, 1 - Math.exp(-dt * 6));
    camara.lookAt(objetivo);
    renderer.render(escena, camara);
  }
  cuadro();

  // ---- fotos de las tarjetas ----
  const fotos = new Map();
  const cola = [];
  let estudio = null;
  function armarEstudio() {
    const e = new THREE.Scene();
    e.add(new THREE.HemisphereLight('#ffffff', '#5a6478', 1.8));
    const p = new THREE.DirectionalLight('#fff4e2', 3.0); p.position.set(-1.5, 2.5, 3); e.add(p);
    const c = new THREE.DirectionalLight('#cfe3ff', 2.2); c.position.set(1.5, 1.5, -3); e.add(c);
    const cam = new THREE.PerspectiveCamera(26, FOTO.ancho / FOTO.alto, 0.05, 100);
    const rt = new THREE.WebGLRenderTarget(FOTO.ancho, FOTO.alto, { type: THREE.HalfFloatType, samples: 4 });
    const salida = new THREE.WebGLRenderTarget(FOTO.ancho, FOTO.alto);
    const lienzo = document.createElement('canvas');
    lienzo.width = FOTO.ancho; lienzo.height = FOTO.alto;
    estudio = { escena: e, cam, rt, salida, pase: new OutputPass(), px: new Uint8Array(FOTO.ancho * FOTO.alto * 4), lienzo, ctx: lienzo.getContext('2d') };
  }

  // qué se fotografía de cada tipo y desde dónde
  function modeloFoto(s) {
    const sk = { ...EQUIPO_INICIAL };
    if (s.tipo === 'personaje') {
      sk.personaje = s.id;
      const c = createCharacter('#ff5a5f', sk);
      c.rotation.y = Math.PI - 0.35;
      animateCharacter(c, 'ground', 0, 0.016, false, {});
      return { obj: c, mira: new THREE.Vector3(0, 1.05, 0), dist: 5.2, alto: 0.25 };
    }
    if (s.tipo === 'planeador') {
      sk.planeador = s.id;
      const c = createCharacter('#ff5a5f', sk);
      c.rotation.y = Math.PI - 0.5;
      animateCharacter(c, 'glider', 0, 0.016, false, {});
      return { obj: c, mira: new THREE.Vector3(0, 4.9, 0), dist: 21, alto: -0.2 };
    }
    let obj = null;
    if (s.tipo === 'mochila') obj = modeloMochila(s.id);
    else if (s.tipo === 'pico') obj = modeloPico(s.id) || cloneAsset('armas', 'pico');
    else if (s.tipo === 'envoltorio') obj = envolver(createWeaponModel('rifle', RAREZAS[s.rareza].color, true), s.id);
    if (!obj) return null;
    const g = new THREE.Group();
    g.add(obj);
    if (s.tipo === 'mochila') g.rotation.y = Math.PI + 0.5;
    if (s.tipo === 'pico') g.rotation.set(0, -Math.PI / 2, -0.7);
    if (s.tipo === 'envoltorio') g.rotation.set(0.1, -Math.PI / 2 + 0.25, 0.12);
    g.updateMatrixWorld(true);
    const caja = new THREE.Box3().setFromObject(g);
    const centro = caja.getCenter(new THREE.Vector3()), tam = caja.getSize(new THREE.Vector3());
    return { obj: g, mira: centro, dist: Math.max(tam.x, tam.y, tam.z * 0.6) * 2.5 + 0.2, alto: 0.15 };
  }

  function sacarFoto(id) {
    const s = SKIN[id];
    if (!s) return '';
    if (!estudio) armarEstudio();
    const m = modeloFoto(s);
    if (!m) return '';
    const { escena: e, cam, rt, salida, pase, px, lienzo, ctx } = estudio;
    e.add(m.obj);
    cam.position.set(m.mira.x, m.mira.y + m.alto * m.dist * 0.3, m.mira.z + m.dist);
    cam.lookAt(m.mira);
    const sombras = renderer.shadowMap.enabled;
    renderer.shadowMap.enabled = false;
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(e, cam);
    pase.render(renderer, salida, rt);
    renderer.readRenderTargetPixels(salida, 0, 0, FOTO.ancho, FOTO.alto, px);
    renderer.setRenderTarget(null);
    renderer.shadowMap.enabled = sombras;
    e.remove(m.obj);
    // los píxeles vienen de abajo hacia arriba
    const img = ctx.createImageData(FOTO.ancho, FOTO.alto);
    const fila = FOTO.ancho * 4;
    for (let y = 0; y < FOTO.alto; y++) img.data.set(px.subarray((FOTO.alto - 1 - y) * fila, (FOTO.alto - y) * fila), y * fila);
    ctx.putImageData(img, 0, 0);
    return lienzo.toDataURL('image/png');
  }

  // de a una por cuadro, para no trabar el menú
  let procesando = false;
  function procesar() {
    if (procesando) return;
    procesando = true;
    const paso = () => {
      const t = cola.shift();
      if (!t) { procesando = false; return; }
      let url = '';
      try { url = sacarFoto(t.id); } catch (err) { console.warn('foto de skin', t.id, err); }
      fotos.set(t.id, url);
      for (const r of t.esperan) r(url);
      setTimeout(paso, 0);
    };
    setTimeout(paso, 0);
  }

  return {
    renderer,
    mostrar(sk, color) {
      equipo = { ...EQUIPO_INICIAL, ...(sk || {}) };
      if (color) colorPj = color;
      probando = null;
      armar();
    },
    probar(id) {
      if (!SKIN[id] || probando === id) return;
      probando = id;
      armar();
    },
    soltar() { if (probando) { probando = null; armar(); } },
    get probando() { return probando; },
    foto(id) {
      if (fotos.has(id)) return Promise.resolve(fotos.get(id));
      let t = cola.find((x) => x.id === id);
      if (!t) { t = { id, esperan: [] }; cola.push(t); }
      const p = new Promise((r) => t.esperan.push(r));
      procesar();
      return p;
    },
    activa(v) { activa = v; },
  };
}
