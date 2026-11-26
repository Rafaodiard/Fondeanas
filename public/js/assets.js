// Carga de los modelos GLB hechos en Blender (public/models). Si alguno falla, el juego usa los modelos procedurales.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export const ASSETS = {};
export const ANIMS = {};
const FILES = ['personaje', 'animaciones_armas', 'animaciones_caida', 'bus', 'paracaidas', 'cofre', 'armas', 'objetos', 'pino', 'arbol', 'roca'];

export async function loadAssets(onProgress) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  let done = 0;
  await Promise.all(FILES.map(async (name) => {
    try {
      const gltf = await loader.loadAsync(`models/${name}.glb`);
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      ASSETS[name] = gltf.scene;
      ANIMS[name] = gltf.animations || [];
    } catch (e) {
      console.warn(`No se pudo cargar ${name}.glb, uso el modelo procedural`, e);
    }
    onProgress?.(++done / FILES.length);
  }));
  // recargas y bombeo del héroe: se suman a sus clips (las pistas se enganchan por nombre de hueso)
  if (ANIMS.personaje && ANIMS.animaciones_armas?.length) ANIMS.personaje.push(...ANIMS.animaciones_armas);
  // caída libre, paracaídas, aterrizaje y deslizarse (tools/blender/heroe_caida.py): igual que las recargas
  if (ANIMS.personaje && ANIMS.animaciones_caida?.length) ANIMS.personaje.push(...ANIMS.animaciones_caida);
  return ASSETS;
}

// Copia profunda con materiales propios para los que se tiñen (por nombre de material).
export function cloneAsset(name, child, tints = {}) {
  let src = ASSETS[name];
  if (!src) return null;
  if (child) { src = src.getObjectByName(child); if (!src) return null; }
  const obj = src.clone(true);
  if (child) obj.position.set(0, 0, 0);
  const cache = {};
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const n = o.material.name;
    if (tints[n] !== undefined) {
      cache[n] ||= o.material.clone();
      cache[n].color.set(tints[n]);
      if (n === 'Rareza' || n === 'Tinte') { cache[n].emissive = new THREE.Color(tints[n]); cache[n].emissiveIntensity = 0.35; }
      o.material = cache[n];
    }
  });
  return obj;
}

// Geometrías "horneadas" (con la transformación del nodo aplicada) para InstancedMesh.
export function bakedParts(name) {
  const src = ASSETS[name];
  if (!src) return null;
  const parts = [];
  src.traverse((o) => {
    if (o.isMesh) parts.push({ name: o.name, geometry: o.geometry.clone().applyMatrix4(o.matrixWorld), material: o.material });
  });
  return parts;
}
