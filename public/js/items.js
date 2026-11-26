// Definiciones compartidas entre cliente y servidor (sin dependencias).

export const RARITIES = [
  { id: 0, name: 'Común', color: '#b8bcc4', dmg: 1.0, reload: 1.0 },
  { id: 1, name: 'Poco común', color: '#5ad65a', dmg: 1.05, reload: 0.95 },
  { id: 2, name: 'Rara', color: '#3fa7ff', dmg: 1.1, reload: 0.9 },
  { id: 3, name: 'Épica', color: '#b35cff', dmg: 1.16, reload: 0.85 },
  { id: 4, name: 'Legendaria', color: '#ffb02e', dmg: 1.22, reload: 0.8 },
];

export const AMMO = {
  ligera: { name: 'Balas ligeras', color: '#d9d9d9', pickup: 30, max: 999 },
  media: { name: 'Balas medianas', color: '#7fb3ff', pickup: 20, max: 999 },
  pesada: { name: 'Balas pesadas', color: '#ff8080', pickup: 6, max: 999 },
  cartuchos: { name: 'Cartuchos', color: '#ffc04d', pickup: 8, max: 999 },
  cohetes: { name: 'Cohetes', color: '#9cff6b', pickup: 3, max: 30 },
};

// rarities: rarezas en las que puede aparecer.
export const WEAPONS = {
  pistola: { name: 'Pistola', damage: 24, head: 1.6, cooldown: 0.17, mag: 16, reload: 1.3, ammo: 'ligera', range: 140, spread: 0.016, aimSpread: 0.006, pellets: 1, auto: false, struct: 24, rarities: [0, 1, 2, 3], size: 0.45 },
  subfusil: { name: 'Subfusil', damage: 17, head: 1.5, cooldown: 0.075, mag: 30, reload: 2.0, ammo: 'ligera', range: 90, spread: 0.032, aimSpread: 0.02, pellets: 1, auto: true, struct: 17, rarities: [0, 1, 2, 3, 4], size: 0.6 },
  rifle: { name: 'Rifle de asalto', damage: 30, head: 1.5, cooldown: 0.16, mag: 30, reload: 2.2, ammo: 'media', range: 300, spread: 0.014, aimSpread: 0.003, pellets: 1, auto: true, struct: 30, rarities: [0, 1, 2, 3, 4], size: 0.8 },
  escopeta: { name: 'Escopeta', damage: 11, head: 1.5, cooldown: 0.9, mag: 5, reload: 2.6, ammo: 'cartuchos', range: 35, spread: 0.07, aimSpread: 0.055, pellets: 9, auto: false, struct: 60, rarities: [0, 1, 2, 3, 4], size: 0.75 },
  francotirador: { name: 'Francotirador', damage: 105, head: 2.0, cooldown: 1.6, mag: 1, reload: 2.4, ammo: 'pesada', range: 700, spread: 0.06, aimSpread: 0.0, pellets: 1, auto: false, struct: 105, rarities: [2, 3, 4], size: 1.0, scope: true },
  lanzacohetes: { name: 'Lanzacohetes', damage: 95, head: 1, cooldown: 1.3, mag: 1, reload: 2.8, ammo: 'cohetes', range: 250, spread: 0.01, aimSpread: 0.004, pellets: 1, auto: false, struct: 400, rarities: [2, 3, 4], size: 1.1, rocket: true, splash: 5 },
};

export const CONSUMABLES = {
  venda: { name: 'Vendas', color: '#ff6b6b', time: 3.5, heal: 15, max: 75, stack: 15, pickup: 5 },
  botiquin: { name: 'Botiquín', color: '#ff3b3b', time: 8, heal: 100, max: 100, stack: 3, pickup: 1 },
  frasco: { name: 'Frasco azul', color: '#5bc0ff', time: 2, shield: 25, max: 50, stack: 6, pickup: 3 },
  bidon: { name: 'Bidón azul', color: '#2f7bff', time: 5, shield: 50, max: 100, stack: 3, pickup: 1 },
};

export const MATERIALS = {
  madera: { name: 'Madera', color: '#c58b4c', hp: 150 },
  piedra: { name: 'Piedra', color: '#a9a9a9', hp: 300 },
  metal: { name: 'Metal', color: '#8fa3b8', hp: 450 },
};
export const MAT_ORDER = ['madera', 'piedra', 'metal'];
export const BUILD_COST = 10;
export const MAX_MATS = 999;
export const GRID = 4;
// gain: material que da cada golpe según lo que se pica (árboles, rocas y piezas del mapa por su material; x2 al romper)
export const PICKAXE = { damage: 20, struct: 50, cooldown: 0.5, range: 3.2, gain: { tree: ['madera', 8], rock: ['piedra', 8], house: ['metal', 6], madera: ['madera', 6], piedra: ['piedra', 6], metal: ['metal', 5] } };
// Punto débil del pico (golpe crítico): aparece en lo que picás, cerca del golpe. Pegarle ahí hace mult veces el daño
// y lo mueve a otro lado. radio: tolerancia del servidor (m); visual: radio del círculo; dura: segundos sin pegarle
// hasta que se borra; dist: a cuántos metros del golpe aparece el siguiente.
export const PUNTO_DEBIL = { mult: 2, radio: 0.55, visual: 0.3, dura: 6, dist: [0.55, 1.15] };
export const SLOTS = 5; // sin contar el pico

// Peso de cada rareza al tirar loot (piso / cofre).
const FLOOR_WEIGHTS = [45, 30, 16, 7, 2];
const CHEST_WEIGHTS = [10, 30, 34, 19, 7];

export function rollRarity(weights, allowed, rand = Math.random) {
  const ws = allowed.map((r) => weights[r]);
  let x = rand() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < allowed.length; i++) { x -= ws[i]; if (x <= 0) return allowed[i]; }
  return allowed[allowed.length - 1];
}

export function randomWeapon(chest, rand = Math.random) {
  const keys = Object.keys(WEAPONS);
  const w = keys[Math.floor(rand() * keys.length)];
  const rarity = rollRarity(chest ? CHEST_WEIGHTS : FLOOR_WEIGHTS, WEAPONS[w].rarities, rand);
  return { kind: 'weapon', w, rarity, mag: WEAPONS[w].mag };
}

export function randomConsumable(rand = Math.random) {
  const r = rand();
  const c = r < 0.35 ? 'venda' : r < 0.6 ? 'frasco' : r < 0.82 ? 'bidon' : 'botiquin';
  return { kind: 'consumable', c, count: CONSUMABLES[c].pickup };
}

export function randomAmmo(rand = Math.random, type) {
  const keys = Object.keys(AMMO);
  const a = type || keys[Math.floor(rand() * keys.length)];
  return { kind: 'ammo', a, count: AMMO[a].pickup };
}

export function itemLabel(it) {
  if (!it) return '';
  if (it.kind === 'weapon') return `${WEAPONS[it.w].name} ${RARITIES[it.rarity].name.toLowerCase()}`;
  if (it.kind === 'consumable') return `${CONSUMABLES[it.c].name} ×${it.count}`;
  if (it.kind === 'ammo') return `${AMMO[it.a].name} ×${it.count}`;
  if (it.kind === 'mat') return `${MATERIALS[it.m].name} ×${it.count}`;
  return '?';
}

export function itemColor(it) {
  if (it.kind === 'weapon') return RARITIES[it.rarity].color;
  if (it.kind === 'consumable') return CONSUMABLES[it.c].color;
  if (it.kind === 'ammo') return AMMO[it.a].color;
  if (it.kind === 'mat') return MATERIALS[it.m].color;
  return '#fff';
}

export function weaponDamage(it) {
  return WEAPONS[it.w].damage * RARITIES[it.rarity].dmg;
}
export function weaponReload(it) {
  return WEAPONS[it.w].reload * RARITIES[it.rarity].reload;
}

// --- Geometría de construcciones (compartida para colisiones) ---
// type: 'pared' | 'piso' | 'rampa'. i,j = celda; y = nivel base; dir 0..3 (0=-Z,1=+X,2=+Z,3=-X)
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export function structKey(s) {
  if (s.type === 'pared') {
    // Normalizar: la pared en el borde +Z de (i,j) es la misma que la del borde -Z de (i,j+1).
    let { i, j, dir } = s;
    if (dir === 2) { j += 1; dir = 0; }
    if (dir === 1) { i += 1; dir = 3; }
    return `pared:${i}:${j}:${s.y}:${dir}`;
  }
  return `${s.type}:${s.i}:${s.j}:${s.y}`;
}
