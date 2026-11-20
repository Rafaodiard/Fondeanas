// Carga de los modelos GLB hechos en Blender (public/models). Si alguno falla, el juego usa los modelos procedurales.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const ASSETS = {};
const FILES = ['personaje', 'bus', 'planeador', 'cofre', 'armas', 'objetos', 'casa', 'pino', 'arbol', 'roca'];

export async function loadAssets(onProgress) {
  const loader = new GLTFLoader();
  let done = 0;
  await Promise.all(FILES.map(async (name) => {
    try {
      const gltf = await loader.loadAsync(`models/${name}.glb`);
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      ASSETS[name] = gltf.scene;
    } catch (e) {
      console.warn(`No se pudo cargar ${name}.glb, uso el modelo procedural`, e);
    }
    onProgress?.(++done / FILES.length);
  }));
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
