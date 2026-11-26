// Fotos de las armas y los objetos para la barra de items. Se sacan de los mismos modelos 3D que se ven en el juego
// (armas.glb y objetos.glb, con la franja del color de la rareza), así el ícono siempre coincide con lo que tenés en
// la mano. Cada foto se saca una sola vez con el renderer del juego (a una textura aparte, con fondo transparente),
// se pasa a PNG y queda guardada como URL de blob para usarla en un <img>.
//   prepararIconos(renderer)  una vez después de setRigEnv/luzLoot (saca todas las fotos de una)
//   iconoDe(item) / iconoPico()  URL del PNG (o '' si no hay foto)
import * as THREE from 'three';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createWeaponModel, createPickaxe } from './models.js';
import { modeloObjeto } from './loot.js';
import { cloneAsset } from './assets.js';
import { WEAPONS, CONSUMABLES, RARITIES } from './items.js';

// Tamaño de la foto en píxeles: el slot muestra el ícono a ~70×46 px, así que esto alcanza para pantallas con zoom 3x.
export const ICONO = { ancho: 216, alto: 144 };

// Pose de cada cosa frente a la cámara. Los modelos vienen con el cañón (o la punta del pico) hacia -Z y +Y arriba;
// la cámara mira desde +Z. giro = [x, y, z] en grados, orden ZXY: primero se gira sobre su eje vertical (y), después
// se inclina hacia la cámara (x, positivo = se ve más desde arriba) y al final se rota en la pantalla (z, positivo =
// antihorario). margen = aire alrededor, en proporción del tamaño.
const POSE = {
  arma: { giro: [6, -70, 7], margen: 0.06 },     // de costado (lado derecho), cañón a la derecha, apenas en 3/4 y hacia arriba
  pistola: { giro: [6, -66, 4], margen: 0.07 },
  pico: { giro: [0, -90, -40], margen: 0.07 },    // en diagonal: cabeza arriba a la derecha, mango hacia abajo a la izquierda
  objeto: { giro: [22, -32, 0], margen: 0.1 },    // en 3/4 y desde arriba, para que se lea la forma
};

const cache = new Map();
let foto = null; // { renderer, escena, camara, rt, salida, pase, px, lienzo, ctx }

const clave = (it) => (it.kind === 'weapon' ? `arma:${it.w}:${it.rarity}` : it.kind === 'consumable' ? `obj:${it.c}` : null);

export function iconoDe(it) {
  if (!it) return '';
  const k = clave(it);
  if (!k) return '';
  if (!cache.has(k) && foto) cache.set(k, sacar(k, it));
  return cache.get(k) || '';
}

export function iconoPico() {
  if (!cache.has('pico') && foto) cache.set('pico', sacar('pico', null));
  return cache.get('pico') || '';
}

// Saca todas las fotos de una vez (al cargar el juego), así no hay tirones en la partida al levantar algo nuevo.
export function prepararIconos(renderer) {
  armar(renderer);
  iconoPico();
  for (const w of Object.keys(WEAPONS)) for (const r of WEAPONS[w].rarities) iconoDe({ kind: 'weapon', w, rarity: r });
  for (const c of Object.keys(CONSUMABLES)) iconoDe({ kind: 'consumable', c });
}

function armar(renderer) {
  if (foto) return;
  const { ancho, alto } = ICONO;
  const escena = new THREE.Scene();
  // luz de estudio: cielo claro + suelo frío, una principal desde arriba a la izquierda y un contraluz que marca el borde
  escena.add(new THREE.HemisphereLight('#ffffff', '#5a6478', 1.9));
  const principal = new THREE.DirectionalLight('#fff4e2', 3.2);
  principal.position.set(-1.2, 2, 2.4);
  const relleno = new THREE.DirectionalLight('#dfe9ff', 1.2);
  relleno.position.set(2, 0.4, 1.5);
  const contra = new THREE.DirectionalLight('#ffffff', 2.4);
  contra.position.set(0.5, 1.5, -2.5);
  escena.add(principal, relleno, contra);
  const camara = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
  camara.position.set(0, 0, 10);
  camara.lookAt(0, 0, 0);
  // primero en flotante y con antialias (lineal), después el pase de salida aplica el mismo tono y color que la pantalla
  const rt = new THREE.WebGLRenderTarget(ancho, alto, { type: THREE.HalfFloatType, samples: 4 });
  const salida = new THREE.WebGLRenderTarget(ancho, alto);
  const pase = new OutputPass();
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho; lienzo.height = alto;
  foto = { renderer, escena, camara, rt, salida, pase, px: new Uint8Array(ancho * alto * 4), lienzo, ctx: lienzo.getContext('2d') };
}

function modelo(k, it) {
  if (k === 'pico') {
    // como en la mano del esqueleto (models.js setHeldRig): el GLB tal cual, punta hacia -Z
    let obj = cloneAsset('armas', 'pico');
    if (!obj) { obj = new THREE.Group(); const q = createPickaxe(); q.rotation.x = Math.PI; obj.add(q); }
    return { obj, pose: POSE.pico };
  }
  if (it.kind === 'weapon') {
    // misma orientación que en la mano del esqueleto: cañón hacia -Z
    const obj = createWeaponModel(it.w, RARITIES[it.rarity].color, true);
    return { obj, pose: POSE[it.w] || POSE.arma };
  }
  return { obj: modeloObjeto(it, CONSUMABLES[it.c].color), pose: POSE.objeto };
}

const _v = new THREE.Vector3();

function sacar(k, it) {
  const { renderer, escena, camara, rt, salida, pase, px, lienzo, ctx } = foto;
  const { ancho, alto } = ICONO;
  const { obj, pose } = modelo(k, it);
  const marco = new THREE.Group();
  marco.rotation.set(...pose.giro.map(THREE.MathUtils.degToRad), 'ZXY');
  marco.add(obj);
  escena.add(marco);
  marco.updateMatrixWorld(true);
  // encuadre exacto: caja de los vértices visibles vista desde la cámara (que mira por -Z, sin girar)
  const min = new THREE.Vector3(Infinity, Infinity, Infinity), max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  marco.traverseVisible((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      min.min(_v); max.max(_v);
    }
  });
  if (!Number.isFinite(min.x)) { escena.remove(marco); return ''; }
  const cx = (min.x + max.x) / 2, cy = (min.y + max.y) / 2;
  const asp = ancho / alto;
  let w = (max.x - min.x) / 2, h = (max.y - min.y) / 2;
  if (w / h > asp) h = w / asp; else w = h * asp;
  const m = 1 + pose.margen * 2;
  Object.assign(camara, { left: cx - w * m, right: cx + w * m, top: cy + h * m, bottom: cy - h * m, near: 0.01, far: 20 });
  camara.position.set(0, 0, max.z + 5);
  camara.far = max.z - min.z + 10;
  camara.updateProjectionMatrix();

  // sacar la foto sin tocar lo que el juego tenía puesto en el renderer
  const antes = renderer.getRenderTarget();
  const color = renderer.getClearColor(new THREE.Color()), alfa = renderer.getClearAlpha();
  const sombras = renderer.shadowMap.enabled;
  renderer.shadowMap.enabled = false;
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(escena, camara);
  pase.render(renderer, salida, rt);
  renderer.readRenderTargetPixels(salida, 0, 0, ancho, alto, px);
  renderer.setRenderTarget(antes);
  renderer.setClearColor(color, alfa);
  renderer.shadowMap.enabled = sombras;
  escena.remove(marco);

  // a PNG: dar vuelta las filas (WebGL lee de abajo hacia arriba) y quitar el alfa premultiplicado del antialias
  const img = ctx.createImageData(ancho, alto);
  for (let y = 0; y < alto; y++) {
    const src = (alto - 1 - y) * ancho * 4, dst = y * ancho * 4;
    for (let x = 0; x < ancho * 4; x += 4) {
      const a = px[src + x + 3];
      const f = a > 0 ? 255 / a : 0;
      img.data[dst + x] = Math.min(255, px[src + x] * f);
      img.data[dst + x + 1] = Math.min(255, px[src + x + 1] * f);
      img.data[dst + x + 2] = Math.min(255, px[src + x + 2] * f);
      img.data[dst + x + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  const datos = atob(lienzo.toDataURL('image/png').split(',')[1]);
  const bytes = new Uint8Array(datos.length);
  for (let i = 0; i < datos.length; i++) bytes[i] = datos.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
}
