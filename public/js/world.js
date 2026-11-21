// Generación determinística de la isla a partir de la semilla de la sala.
// Todos los clientes de una sala generan exactamente el mismo mundo.
import * as THREE from 'three';
import { GRID, MATERIALS } from './items.js';

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise(seed) {
  const rand = rng(seed);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = (h, x, y) => {
    const g = h & 7;
    const u = g < 4 ? x : y, v = g < 4 ? y : x;
    return ((g & 1) ? -u : u) + ((g & 2) ? -2 * v : 2 * v);
  };
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x, y) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const a = perm[X] + Y, b = perm[X + 1] + Y;
    const l1 = grad(perm[a], x, y) + u * (grad(perm[b], x - 1, y) - grad(perm[a], x, y));
    const l2 = grad(perm[a + 1], x, y - 1) + u * (grad(perm[b + 1], x - 1, y - 1) - grad(perm[a + 1], x, y - 1));
    return (l1 + v * (l2 - l1)) * 0.25;
  };
}

export const SEA_LEVEL = 0;

// Lo completa el cliente con los modelos de Blender (assets.js). El servidor no lo usa.
export const MODEL = { clone: null, baked: null };
const houseTints = [
  { Pared: '#f2e6cf', Techo: '#d0563f' },
  { Pared: '#cfe3f0', Techo: '#3d5a80' },
  { Pared: '#f4c7a1', Techo: '#6b4a36' },
];

export class World {
  constructor(seed, size) {
    this.seed = seed;
    this.size = size;
    this.noise = makeNoise(seed);
    this.res = 240; // celdas por lado
    this.cell = size / this.res;
    this.colliders = []; // cajas AABB {minX,maxX,minY,maxY,minZ,maxZ}
    this.circles = []; // troncos y rocas {x,z,r,top}
    this.floors = []; // pisos de casas {minX,maxX,minZ,maxZ,y}
    this.solidMeshes = []; // para raycasts de disparo
    this.pois = [];
    this.structs = new Map(); // construcciones de los jugadores
    this.structMeshes = [];
    this.camMeshes = []; // casas enteras, para que la cámara no las atraviese
    this.buildHeights();
    this.layout();
  }

  rawHeight(x, z) {
    const n = this.noise;
    const half = this.size / 2;
    const d = Math.sqrt(x * x + z * z) / (half * 0.92);
    // Borde irregular de la isla.
    const ang = Math.atan2(z, x);
    const coast = 1 + 0.12 * n(Math.cos(ang) * 2 + 10, Math.sin(ang) * 2 + 10) * 4;
    const mask = 1 - smoothstep(0.62 * coast, 1.0 * coast, d);
    let h = 0;
    h += n(x / 380, z / 380) * 40;
    h += n(x / 140 + 7, z / 140 + 3) * 14;
    h += n(x / 45 + 2, z / 45 + 9) * 3;
    // Una montaña principal.
    const mx = Math.sin(this.seed) * half * 0.35, mz = Math.cos(this.seed) * half * 0.35;
    const md = Math.hypot(x - mx, z - mz);
    h += Math.max(0, 1 - md / 180) ** 2 * 85;
    h = 8 + h * 0.9;
    // Mesetas suaves para que haya lugar donde construir pueblos.
    h = h * mask + (-18) * (1 - mask);
    return h;
  }

  buildHeights() {
    const N = this.res + 1;
    this.heights = new Float32Array(N * N);
    const half = this.size / 2;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        this.heights[j * N + i] = this.rawHeight(-half + i * this.cell, -half + j * this.cell);
      }
    }
  }

  // Altura interpolada igual que los triángulos de la malla.
  terrainHeight(x, z) {
    const half = this.size / 2;
    const N = this.res + 1;
    const fx = (x + half) / this.cell, fz = (z + half) / this.cell;
    const i = Math.max(0, Math.min(this.res - 1, Math.floor(fx)));
    const j = Math.max(0, Math.min(this.res - 1, Math.floor(fz)));
    const u = Math.min(1, Math.max(0, fx - i)), v = Math.min(1, Math.max(0, fz - j));
    const h00 = this.heights[j * N + i], h10 = this.heights[j * N + i + 1];
    const h01 = this.heights[(j + 1) * N + i], h11 = this.heights[(j + 1) * N + i + 1];
    // Triangulación: (00,01,10) y (01,11,10)
    if (u + v <= 1) return h00 + (h10 - h00) * u + (h01 - h00) * v;
    return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
  }

  groundHeight(x, z, y = Infinity) {
    let h = this.terrainHeight(x, z);
    for (const f of this.floors) {
      if (x > f.minX && x < f.maxX && z > f.minZ && z < f.maxZ && y >= f.y - 2.5) h = Math.max(h, f.y);
    }
    for (const s of this.structs.values()) {
      if (s.type === 'pared') continue;
      const x0 = s.i * GRID, z0 = s.j * GRID;
      if (x < x0 || x > x0 + GRID || z < z0 || z > z0 + GRID) continue;
      let top = s.y;
      if (s.type === 'rampa') {
        const t = s.dir === 0 ? z0 + GRID - z : s.dir === 2 ? z - z0 : s.dir === 1 ? x - x0 : x0 + GRID - x;
        top = s.y + t;
      }
      if (y >= top - 1.2 && top > h) h = top;
    }
    return h;
  }

  // ---------- Disposición (sin Three.js: la usa también el servidor) ----------
  layout() {
    const rand = rng(this.seed ^ 0x9e3779b9);
    this.houses = [];
    this.trees = [];
    this.rocks = [];
    this.chestSpots = [];
    this.lootSpots = [];
    this.layoutTowns(rand);
    this.layoutTrees(rand);
    this.layoutRocks(rand);
    // Loot suelto por la isla, además del de las casas.
    for (let k = 0; k < 4000 && this.lootSpots.length < this.houses.length * 2 + 70; k++) {
      const x = (rand() - 0.5) * this.size, z = (rand() - 0.5) * this.size;
      const h = this.terrainHeight(x, z);
      if (h < 2 || this.slopeAt(x, z) > 0.4 || this.insideHouse(x, z, 2)) continue;
      this.lootSpots.push({ x, y: h, z });
    }
  }

  layoutTowns(rand) {
    const names = ['Puerto Bruma', 'Villa Cardo', 'Loma Ventosa', 'Barrio Faro', 'Los Pinares', 'Cantera Roja', 'Bahía Quieta'];
    const half = this.size / 2;
    let placed = 0, tries = 0;
    while (placed < names.length && tries < 400) {
      tries++;
      const x = (rand() - 0.5) * half * 1.3, z = (rand() - 0.5) * half * 1.3;
      const h = this.terrainHeight(x, z);
      if (h < 5 || h > 55 || this.slopeAt(x, z) > 0.25) continue;
      if (this.pois.some((p) => Math.hypot(p.x - x, p.z - z) < 170)) continue;
      this.pois.push({ name: names[placed], x, z });
      placed++;
      const houses = 4 + Math.floor(rand() * 5);
      for (let k = 0; k < houses; k++) {
        const hx = x + (rand() - 0.5) * 70, hz = z + (rand() - 0.5) * 70;
        const w = 8 + rand() * 5, d = 8 + rand() * 4, style = Math.floor(rand() * 3), chest = rand() < 0.6;
        if (this.slopeAt(hx, hz) > 0.35) continue;
        if (this.floors.some((f) => hx > f.minX - 6 && hx < f.maxX + 6 && hz > f.minZ - 6 && hz < f.maxZ + 6)) continue;
        this.layoutHouse(hx, hz, w, d, style, chest);
      }
    }
  }

  layoutHouse(cx, cz, w, d, style, chest) {
    const t = 0.4, H = 4;
    const hs = [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]].map(([dx, dz]) => this.terrainHeight(cx + dx, cz + dz));
    const base = Math.max(...hs) + 0.25;
    const minBase = Math.min(...hs) - 2;
    const wy = base + H / 2, door = 2.2, side = (w - door) / 2;
    const walls = [
      [cx, wy, cz - d / 2, w, H, t],
      [cx - w / 2, wy, cz, t, H, d],
      [cx + w / 2, wy, cz, t, H, d],
      [cx - w / 2 + side / 2, wy, cz + d / 2, side, H, t],
      [cx + w / 2 - side / 2, wy, cz + d / 2, side, H, t],
      [cx, base + H - 0.6, cz + d / 2, door, 1.2, t],
    ];
    for (const [x, y, z, sx, sy, sz] of walls) {
      this.colliders.push({ minX: x - sx / 2, maxX: x + sx / 2, minY: y - sy / 2, maxY: y + sy / 2, minZ: z - sz / 2, maxZ: z + sz / 2 });
    }
    this.colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minY: base + H, maxY: base + H + 0.5, minZ: cz - d / 2, maxZ: cz + d / 2 });
    this.floors.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, y: base });
    this.houses.push({ cx, cz, w, d, base, minBase, style, walls });
    this.lootSpots.push({ x: cx - w / 4, y: base, z: cz });
    if (chest) this.chestSpots.push({ x: cx + w / 2 - 1.2, y: base, z: cz - d / 2 + 1.2, rot: 0 });
    else this.lootSpots.push({ x: cx + w / 4, y: base, z: cz - d / 4 });
  }

  layoutTrees(rand) {
    const half = this.size / 2;
    for (let k = 0; k < 9000 && this.trees.length < 900; k++) {
      const x = (rand() - 0.5) * this.size, z = (rand() - 0.5) * this.size;
      const s = 0.8 + rand() * 0.7, r = rand() * Math.PI * 2, kind = rand();
      if (Math.hypot(x, z) > half) continue;
      const h = this.terrainHeight(x, z);
      if (h < 3.5 || h > 75 || this.slopeAt(x, z) > 0.5) continue;
      const forest = this.noise(x / 120 + 50, z / 120 + 50);
      if (forest < -0.02 && kind > 0.12) continue;
      if (this.insideHouse(x, z, 4)) continue;
      const tree = { x, z, y: h, s, r, pine: h > 35 || kind < 0.4, alive: true };
      tree.circle = { x, z, r: 0.45 * s, bottom: h - 1, top: h + 7 * s };
      this.circles.push(tree.circle);
      this.trees.push(tree);
    }
  }

  layoutRocks(rand) {
    for (let k = 0; k < 3000 && this.rocks.length < 260; k++) {
      const x = (rand() - 0.5) * this.size, z = (rand() - 0.5) * this.size;
      const s = 0.6 + rand() * 2.2, r = rand() * 6;
      const h = this.terrainHeight(x, z);
      if (h < 1 || this.insideHouse(x, z, 3)) continue;
      const rock = { x, z, y: h, s, r, alive: true };
      rock.circle = { x, z, r: s * 1.1, bottom: h - s, top: h + s * 0.75 };
      this.circles.push(rock.circle);
      this.rocks.push(rock);
    }
  }

  // ---------- Mallas (sólo cliente) ----------
  build(scene) {
    this.scene = scene;
    this.buildTerrain(scene);
    this.buildWater(scene);
    this.buildHouses(scene);
    this.buildTrees(scene);
    this.buildRocks(scene);
    this.buildChests(scene);
  }

  buildTerrain(scene) {
    const N = this.res + 1;
    const half = this.size / 2;
    const positions = [];
    const colors = [];
    const c = new THREE.Color();
    const sand = new THREE.Color('#e8d39a'), grass = new THREE.Color('#6cbf4b'), grass2 = new THREE.Color('#4f9e3a');
    const rock = new THREE.Color('#8a8576'), snow = new THREE.Color('#f4f7fb'), seabed = new THREE.Color('#c9b98a');
    const v = (i, j) => [-half + i * this.cell, this.heights[j * N + i], -half + j * this.cell];
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nrm = new THREE.Vector3();
    for (let j = 0; j < this.res; j++) {
      for (let i = 0; i < this.res; i++) {
        const a = v(i, j), b = v(i + 1, j), d = v(i, j + 1), e = v(i + 1, j + 1);
        for (const tri of [[a, d, b], [d, e, b]]) {
          const y = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
          e1.set(tri[1][0] - tri[0][0], tri[1][1] - tri[0][1], tri[1][2] - tri[0][2]);
          e2.set(tri[2][0] - tri[0][0], tri[2][1] - tri[0][1], tri[2][2] - tri[0][2]);
          nrm.crossVectors(e1, e2).normalize();
          const slope = 1 - Math.abs(nrm.y);
          const jitter = this.noise(tri[0][0] / 9, tri[0][2] / 9) * 0.5 + 0.5;
          if (y < -1) c.copy(seabed);
          else if (y < 2.5) c.copy(sand);
          else if (slope > 0.35 || y > 70) c.copy(rock).lerp(snow, y > 95 ? 1 : 0);
          else c.copy(grass).lerp(grass2, jitter);
          c.offsetHSL(0, 0, (jitter - 0.5) * 0.04);
          for (const p of tri) { positions.push(...p); colors.push(c.r, c.g, c.b); }
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
    mesh.receiveShadow = true;
    scene.add(mesh);
    this.terrainMesh = mesh;
  }

  buildWater(scene) {
    const geo = new THREE.PlaneGeometry(this.size * 6, this.size * 6, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: '#2a9fd6', transparent: true, opacity: 0.82, roughness: 0.2, metalness: 0.1 });
    this.water = new THREE.Mesh(geo, mat);
    this.water.position.y = SEA_LEVEL;
    scene.add(this.water);
  }

  slopeAt(x, z) {
    const s = 4;
    const dx = this.terrainHeight(x + s, z) - this.terrainHeight(x - s, z);
    const dz = this.terrainHeight(x, z + s) - this.terrainHeight(x, z - s);
    return Math.hypot(dx, dz) / (2 * s);
  }

  buildHouses(scene) {
    const wallMat = [new THREE.MeshStandardMaterial({ color: '#f2e6cf', roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: '#cfe3f0', roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: '#f4c7a1', roughness: 0.9 })];
    const roofMat = [new THREE.MeshStandardMaterial({ color: '#c0503c', flatShading: true }),
      new THREE.MeshStandardMaterial({ color: '#3d5a80', flatShading: true }),
      new THREE.MeshStandardMaterial({ color: '#5b4636', flatShading: true })];
    const floorMat = new THREE.MeshStandardMaterial({ color: '#9c7b55' });
    const glass = new THREE.MeshStandardMaterial({ color: '#9bd3ff', emissive: '#1d3d55', roughness: 0.1 });
    const hiddenMat = new THREE.MeshBasicMaterial({ visible: false });
    for (const h of this.houses) {
      const group = new THREE.Group();
      this.camMeshes.push(group);
      const { cx, cz, w, d, base, minBase } = h;
      const foundH = base - minBase;
      const found = new THREE.Mesh(new THREE.BoxGeometry(w, foundH - 0.3, d), floorMat);
      found.position.set(cx, minBase + foundH / 2 - 0.15, cz);
      found.receiveShadow = true;
      group.add(found);
      const glb = MODEL.clone?.('casa', null, houseTints[h.style]);
      if (glb) {
        glb.position.set(cx, base - 0.02, cz);
        glb.scale.set(w / 10, 1, d / 10);
        group.add(glb);
      }
      for (const [x, y, z, sx, sy, sz] of h.walls) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), glb ? hiddenMat : wallMat[h.style]);
        m.position.set(x, y, z);
        m.castShadow = true; m.receiveShadow = true;
        m.userData.harvest = { kind: 'house' };
        group.add(m);
        this.solidMeshes.push(m);
      }
      if (glb) { scene.add(group); continue; }
      const roofGeo = new THREE.CylinderGeometry(0.01, Math.max(w, d) * 0.75, 3, 4, 1);
      roofGeo.rotateY(Math.PI / 4);
      roofGeo.scale(w / Math.max(w, d), 1, d / Math.max(w, d));
      const roof = new THREE.Mesh(roofGeo, roofMat[h.style]);
      roof.position.set(cx, base + 5.5, cz);
      roof.castShadow = true;
      group.add(roof);
      for (const sx of [-1, 1]) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 1.6), glass);
        win.position.set(cx + sx * (w / 2 + 0.16), base + 2.3, cz);
        group.add(win);
      }
      scene.add(group);
    }
  }

  insideHouse(x, z, pad = 3) {
    return this.floors.some((f) => x > f.minX - pad && x < f.maxX + pad && z > f.minZ - pad && z < f.maxZ + pad);
  }

  buildTrees(scene) {
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 3, 6);
    trunkGeo.translate(0, 1.5, 0);
    const pineGeo = mergeCones([[2.6, 3.4, 3.2], [2.0, 3.0, 5.0], [1.3, 2.6, 6.6]]);
    const roundGeo = new THREE.IcosahedronGeometry(2.4, 0);
    roundGeo.translate(0, 4.6, 0);
    let trunkMat = new THREE.MeshStandardMaterial({ color: '#7a5233', flatShading: true });
    let pineMat = new THREE.MeshStandardMaterial({ color: '#2f7a3b', flatShading: true });
    let roundMat = new THREE.MeshStandardMaterial({ color: '#59a83c', flatShading: true });
    let trunkGeoG = trunkGeo, pineGeoG = pineGeo, roundGeoG = roundGeo;
    const pino = MODEL.baked?.('pino'), arbol = MODEL.baked?.('arbol');
    if (pino && arbol) {
      const by = (parts, n) => parts.find((p) => p.name === n);
      ({ geometry: pineGeoG, material: pineMat } = by(pino, 'HojasPino'));
      ({ geometry: roundGeoG, material: roundMat } = by(arbol, 'HojasArbol'));
      ({ geometry: trunkGeoG, material: trunkMat } = by(arbol, 'TroncoArbol'));
    }
    const list = this.trees;
    this.trunks = new THREE.InstancedMesh(trunkGeoG, trunkMat, list.length);
    this.pines = new THREE.InstancedMesh(pineGeoG, pineMat, list.filter((t) => t.pine).length);
    this.rounds = new THREE.InstancedMesh(roundGeoG, roundMat, list.filter((t) => !t.pine).length);
    this.pineToTree = []; this.roundToTree = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), eu = new THREE.Euler();
    list.forEach((t, i) => {
      q.setFromEuler(eu.set(0, t.r, 0));
      sc.set(t.s, t.s, t.s);
      p.set(t.x, t.y - 0.2, t.z);
      m.compose(p, q, sc);
      t.matrix = m.clone();
      this.trunks.setMatrixAt(i, m);
      if (t.pine) { t.fol = [this.pines, this.pineToTree.length]; this.pines.setMatrixAt(this.pineToTree.length, m); this.pineToTree.push(i); }
      else { t.fol = [this.rounds, this.roundToTree.length]; this.rounds.setMatrixAt(this.roundToTree.length, m); this.roundToTree.push(i); }
    });
    this.trunks.userData.harvest = { kind: 'tree', map: null };
    this.pines.userData.harvest = { kind: 'tree', map: this.pineToTree };
    this.rounds.userData.harvest = { kind: 'tree', map: this.roundToTree };
    for (const im of [this.trunks, this.pines, this.rounds]) { im.castShadow = true; im.receiveShadow = true; scene.add(im); this.solidMeshes.push(im); }
  }

  buildRocks(scene) {
    let geo = new THREE.DodecahedronGeometry(1, 0);
    geo.scale(1.3, 0.8, 1);
    let mat = new THREE.MeshStandardMaterial({ color: '#9a958a', flatShading: true });
    const roca = MODEL.baked?.('roca');
    if (roca) ({ geometry: geo, material: mat } = roca[0]);
    this.rockMesh = new THREE.InstancedMesh(geo, mat, this.rocks.length);
    const m = new THREE.Matrix4();
    this.rocks.forEach((r, i) => {
      m.compose(new THREE.Vector3(r.x, r.y, r.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r.r, r.r * 2, 0)), new THREE.Vector3(r.s, r.s, r.s));
      r.matrix = m.clone();
      this.rockMesh.setMatrixAt(i, m);
    });
    this.rockMesh.userData.harvest = { kind: 'rock', map: null };
    this.rockMesh.castShadow = true; this.rockMesh.receiveShadow = true;
    scene.add(this.rockMesh);
    this.solidMeshes.push(this.rockMesh);
  }

  buildChests(scene) {
    this.chestMeshes = this.chestSpots.map((c, idx) => {
      const g = new THREE.Group();
      const glbChest = MODEL.clone?.('cofre');
      if (glbChest) {
        g.add(glbChest);
        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
        glow.position.y = 0.5;
        g.add(glow);
        g.position.set(c.x, c.y, c.z);
        g.rotation.y = c.rot;
        g.userData = { lid: glbChest.getObjectByName('Tapa'), glow, idx, open: false };
        scene.add(g);
        return g;
      }
      const wood = new THREE.MeshStandardMaterial({ color: '#8a5a2b', flatShading: true });
      const trim = new THREE.MeshStandardMaterial({ color: '#ffcf4a', metalness: 0.6, roughness: 0.3, emissive: '#5a3c00' });
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.8), wood);
      body.position.y = 0.3;
      g.add(body);
      for (const x of [-0.5, 0.5]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.62, 0.82), trim); b.position.set(x, 0.3, 0); g.add(b); }
      const lidG = new THREE.Group();
      lidG.position.set(0, 0.6, 0.4);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 8, 1, false, 0, Math.PI), wood);
      lid.rotation.z = Math.PI / 2; lid.position.z = -0.4;
      lidG.add(lid);
      const lock = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 0.08), trim);
      lock.position.set(0, 0, 0.02);
      lidG.add(lock);
      g.add(lidG);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.position.y = 0.5;
      g.add(glow);
      g.position.set(c.x, c.y, c.z);
      g.rotation.y = c.rot;
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      g.userData = { lid: lidG, glow, idx, open: false };
      scene.add(g);
      return g;
    });
  }

  openChest(idx) {
    const c = this.chestMeshes?.[idx];
    if (!c || c.userData.open) return;
    c.userData.open = true;
    c.userData.lid.rotation.x = 1.9;
    c.remove(c.userData.glow);
  }

  destroyResource(kind, idx) {
    const list = kind === 'tree' ? this.trees : this.rocks;
    const r = list[idx];
    if (!r || !r.alive) return;
    r.alive = false;
    r.circle.top = -1e9; // ya no choca
    if (!this.scene) return;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    if (kind === 'tree') {
      this.trunks.setMatrixAt(idx, zero); this.trunks.instanceMatrix.needsUpdate = true;
      const [mesh, k] = r.fol; mesh.setMatrixAt(k, zero); mesh.instanceMatrix.needsUpdate = true;
      this.trunks.computeBoundingSphere(); mesh.computeBoundingSphere();
    } else {
      this.rockMesh.setMatrixAt(idx, zero); this.rockMesh.instanceMatrix.needsUpdate = true;
    }
  }

  // Sacudón visual al pegarle con el pico.
  shakeResource(kind, idx) {
    const r = (kind === 'tree' ? this.trees : this.rocks)[idx];
    if (!r || !r.alive || !this.scene) return;
    const meshes = kind === 'tree' ? [[this.trunks, idx], r.fol] : [[this.rockMesh, idx]];
    const m = r.matrix.clone().multiply(new THREE.Matrix4().makeScale(0.93, 0.93, 0.93));
    for (const [mesh, k] of meshes) { mesh.setMatrixAt(k, m); mesh.instanceMatrix.needsUpdate = true; }
    setTimeout(() => {
      if (!r.alive) return;
      for (const [mesh, k] of meshes) { mesh.setMatrixAt(k, r.matrix); mesh.instanceMatrix.needsUpdate = true; }
    }, 90);
  }

  // ---------- Construcciones ----------
  addStruct(s) {
    if (this.structs.has(s.key)) return;
    const x0 = s.i * GRID, z0 = s.j * GRID;
    if (s.type === 'pared') {
      const t = 0.15;
      s.box = s.dir === 0
        ? { minX: x0, maxX: x0 + GRID, minZ: z0 - t, maxZ: z0 + t, minY: s.y, maxY: s.y + GRID }
        : { minX: x0 - t, maxX: x0 + t, minZ: z0, maxZ: z0 + GRID, minY: s.y, maxY: s.y + GRID };
    }
    this.structs.set(s.key, s);
    if (this.scene) {
      s.mesh = makeStructMesh(s);
      s.mesh.userData.structKey = s.key;
      this.scene.add(s.mesh);
      this.structMeshes.push(s.mesh);
      s.mesh.scale.setScalar(0.01);
      s.born = performance.now();
    }
  }

  removeStruct(key) {
    const s = this.structs.get(key);
    if (!s) return;
    this.structs.delete(key);
    if (s.mesh) {
      this.scene.remove(s.mesh);
      this.structMeshes.splice(this.structMeshes.indexOf(s.mesh), 1);
    }
  }

  updateStructs() {
    const t = performance.now();
    for (const s of this.structs.values()) {
      if (!s.mesh || s.grown) continue;
      const k = Math.min(1, (t - s.born) / 180);
      s.mesh.scale.setScalar(0.01 + 0.99 * k);
      if (k >= 1) s.grown = true;
    }
  }

  // Mueve una cápsula (pos = pies) resolviendo choques con paredes, árboles y rocas.
  collide(pos, radius = 0.45, height = 1.8) {
    for (const c of this.circles) {
      if (pos.y > c.top || pos.y + height < c.bottom) continue;
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const d = Math.hypot(dx, dz), min = c.r + radius;
      if (d < min && d > 1e-4) { pos.x = c.x + (dx / d) * min; pos.z = c.z + (dz / d) * min; }
    }
    const boxes = this.colliders;
    for (let k = 0; k < boxes.length; k++) pushOut(pos, boxes[k], radius, height);
    for (const s of this.structs.values()) if (s.box) pushOut(pos, s.box, radius, height);
  }

  // Distancia hasta donde un rayo choca con el terreno (marcha simple), o Infinity.
  rayTerrain(origin, dir, maxDist) {
    let prev = 0;
    for (let t = 0.5; t <= maxDist; t += 1) {
      const x = origin.x + dir.x * t, y = origin.y + dir.y * t, z = origin.z + dir.z * t;
      if (y < this.terrainHeight(x, z)) {
        let lo = prev, hi = t;
        for (let k = 0; k < 6; k++) {
          const mid = (lo + hi) / 2;
          const mx = origin.x + dir.x * mid, my = origin.y + dir.y * mid, mz = origin.z + dir.z * mid;
          if (my < this.terrainHeight(mx, mz)) hi = mid; else lo = mid;
        }
        return hi;
      }
      prev = t;
    }
    return Infinity;
  }

  // Mapa de alturas pequeño para el minimapa.
  minimapImage(px = 200) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = px;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(px, px);
    const half = this.size / 2;
    for (let j = 0; j < px; j++) for (let i = 0; i < px; i++) {
      const x = -half + (i / px) * this.size, z = -half + (j / px) * this.size;
      const h = this.terrainHeight(x, z);
      let col;
      if (h < 0) col = [42, 140, 200];
      else if (h < 2.5) col = [232, 211, 154];
      else if (h > 70) col = [200, 200, 200];
      else { const k = Math.min(1, h / 70); col = [100 - k * 30, 180 - k * 50, 70 - k * 20]; }
      const o = (j * px + i) * 4;
      img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = '#5b4636';
    for (const f of this.floors) {
      ctx.fillRect(((f.minX + half) / this.size) * px, ((f.minZ + half) / this.size) * px, Math.max(2, ((f.maxX - f.minX) / this.size) * px), Math.max(2, ((f.maxZ - f.minZ) / this.size) * px));
    }
    return cv;
  }
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function mergeCones(defs) {
  const geos = defs.map(([r, h, y]) => {
    const g = new THREE.ConeGeometry(r, h, 7);
    g.translate(0, y, 0);
    return g.toNonIndexed();
  });
  const total = geos.reduce((s, g) => s + g.attributes.position.count, 0);
  const pos = new Float32Array(total * 3);
  let o = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o); o += g.attributes.position.array.length; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.computeVertexNormals();
  return out;
}

function pushOut(pos, b, radius, height) {
  if (pos.y + height <= b.minY || pos.y >= b.maxY) return;
  const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
  const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
  const dx = pos.x - cx, dz = pos.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= radius * radius) return;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    pos.x = cx + (dx / d) * radius; pos.z = cz + (dz / d) * radius;
  } else {
    const ex = [b.minX - radius - pos.x, b.maxX + radius - pos.x], ez = [b.minZ - radius - pos.z, b.maxZ + radius - pos.z];
    const bx = Math.abs(ex[0]) < Math.abs(ex[1]) ? ex[0] : ex[1];
    const bz = Math.abs(ez[0]) < Math.abs(ez[1]) ? ez[0] : ez[1];
    if (Math.abs(bx) < Math.abs(bz)) pos.x += bx; else pos.z += bz;
  }
}

const structMats = {};
function structMat(m, ghost) {
  const k = m + (ghost ? ':g' : '');
  if (!structMats[k]) {
    structMats[k] = ghost
      ? new THREE.MeshBasicMaterial({ color: '#59b8ff', transparent: true, opacity: 0.35, depthWrite: false })
      : new THREE.MeshStandardMaterial({ color: MATERIALS[m].color, flatShading: true, roughness: m === 'metal' ? 0.4 : 0.9, metalness: m === 'metal' ? 0.5 : 0 });
  }
  return structMats[k];
}

// Malla de una pieza de construcción. El grupo se ubica en la esquina (i*GRID, y, j*GRID).
export function makeStructMesh(s, ghost = false) {
  const g = new THREE.Group();
  const mat = structMat(s.mat || 'madera', ghost);
  const frameMat = ghost ? mat : new THREE.MeshStandardMaterial({ color: new THREE.Color(MATERIALS[s.mat || 'madera'].color).multiplyScalar(0.6), flatShading: true });
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = !ghost; o.receiveShadow = !ghost; g.add(o); return o; };
  const G = GRID;
  if (s.type === 'pared') {
    const horiz = s.dir === 0;
    const geo = horiz ? new THREE.BoxGeometry(G, G, 0.25) : new THREE.BoxGeometry(0.25, G, G);
    const cx = horiz ? G / 2 : 0, cz = horiz ? 0 : G / 2;
    add(geo, mat, cx, G / 2, cz);
    if (!ghost) {
      // Marco para que se lea la pieza.
      const fb = horiz ? [G, 0.25, 0.3] : [0.3, 0.25, G];
      add(new THREE.BoxGeometry(...fb), frameMat, cx, 0.12, cz);
      add(new THREE.BoxGeometry(...fb), frameMat, cx, G - 0.12, cz);
      const fs = horiz ? [0.25, G, 0.3] : [0.3, G, 0.25];
      add(new THREE.BoxGeometry(...fs), frameMat, horiz ? 0.12 : 0, G / 2, horiz ? 0 : 0.12);
      add(new THREE.BoxGeometry(...fs), frameMat, horiz ? G - 0.12 : 0, G / 2, horiz ? 0 : G - 0.12);
    }
  } else if (s.type === 'piso') {
    add(new THREE.BoxGeometry(G, 0.25, G), mat, G / 2, -0.125, G / 2);
  } else if (s.type === 'rampa') {
    const len = Math.hypot(G, G);
    const ramp = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(G, 0.25, len), mat);
    slab.castShadow = !ghost; slab.receiveShadow = !ghost;
    slab.rotation.x = Math.PI / 4; // sube hacia -Z local
    ramp.add(slab);
    ramp.position.set(G / 2, G / 2 - 0.12, G / 2);
    ramp.rotation.y = [0, -Math.PI / 2, Math.PI, Math.PI / 2][s.dir];
    g.add(ramp);
    if (!ghost) for (const x of [-G / 2 + 0.15, G / 2 - 0.15]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, len), frameMat);
      rail.rotation.x = Math.PI / 4; rail.position.set(x, 0.1, 0); ramp.add(rail);
    }
  }
  g.position.set(s.i * G, s.y, s.j * G);
  return g;
}
