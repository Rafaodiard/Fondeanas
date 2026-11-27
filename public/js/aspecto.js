// Aspecto de las skins en el juego: viste al héroe con su traje (colores por zona, patrones, efectos y accesorios),
// le cuelga la mochila, pinta el paracaídas y da el pico y el envoltorio de las armas. Todo es cosmético: el
// esqueleto, el tamaño y la hitbox son los mismos para todas las skins.
//
// Cómo se pinta: un solo shader (onBeforeCompile sobre los materiales estándar) que
//   - reconoce las zonas del atlas del héroe por color (verde oliva = pantalón, gris oscuro = remera, guantes y
//     rodilleras, verde azulado = bufanda, marrón oscuro = cuero y pelo, marrón claro = piel) y las recolorea
//     conservando el sombreado de la textura;
//   - dibuja patrones procedurales en el espacio del modelo (camuflaje, rayas, cuadros, escamas...);
//   - suma efectos emisivos animados (holograma, lava, galaxia, neón, pulso) y acabados metálicos (oro, cromo);
//   - esconde la cabeza original cuando el traje trae una cabeza entera, y las antiparras cuando trae sombrero.
// Los accesorios (public/models/skins.glb, tools/blender/skins.py) vienen en el espacio del héroe y se cuelgan de
// un hueso con la inversa de la pose de reposo de ese hueso, así siguen la animación.
//
//   vestir(personaje, equipo, color)   después de createCharacter (models.js lo llama solo)
//   modeloPico(id)                     el pico para la mano
//   envolver(obj, id)                  aplica un envoltorio a un arma
//   avanzarAspecto(dt)                 una vez por cuadro (anima los efectos)
import * as THREE from 'three';
import { ASSETS } from './assets.js';
import { SKIN, EQUIPO_INICIAL } from './skins.js';

export const TIEMPO = { value: 0 };
export function avanzarAspecto(dt) { TIEMPO.value = (TIEMPO.value + dt) % 3600; }

// Hueso del que cuelga cada accesorio (por prefijo del nombre del nodo en skins.glb)
function huesoDe(nombre) {
  if (nombre.endsWith('_L')) return 'UpperArmL';
  if (nombre.endsWith('_R')) return 'UpperArmR';
  if (nombre.startsWith('acc_cola_')) return 'Hips';
  if (nombre.startsWith('acc_mochila_') || nombre === 'acc_cuello_vampiro') return 'Spine2';
  return 'Head';
}
// sombreros que esconden las antiparras de la frente
const SOMBREROS = new Set(['gorra', 'piluso', 'gorro_lana', 'casco_bombero', 'sombrero_vaquero', 'casco_vikingo', 'gorro_chef', 'galera', 'corona', 'mohicano', 'capucha', 'cuello_vampiro']);
// alturas en el espacio de la malla del héroe (personaje.glb, Y arriba, el héroe mira a +Z)
const CORTE_CABEZA = 1.603;
const ZONAS = ['pantalon', 'camisa', 'bufanda', 'cuero', 'piel'];
const PATRONES = { camo: 1, rayas: 2, cuadros: 3, manchas: 4, escamas: 5, vendas: 6, circuito: 7, pelaje: 8, lunares: 9, degrade: 10, llamas: 11 };
const BRILLOS = { holo: 1, lava: 2, galaxia: 3, neon: 4, pulso: 5 };
const ACABADOS = { oro: { color: '#e8b84a', rug: 0.26 }, cromo: { color: '#dfe4ea', rug: 0.12 } };

// ------------------------------------------------------------------------------------------------------------------
// Shader
const GLSL_FRAG_DEF = /* glsl */`
varying vec3 vSfPos;
uniform float uSfT;
uniform vec4 uSfRec[5];
uniform int uSfFam;
uniform float uSfRef;
uniform float uSfCorte;
uniform float uSfGafas;
uniform int uSfPat; uniform vec3 uSfPA; uniform vec3 uSfPB; uniform vec3 uSfPC; uniform float uSfPE; uniform vec3 uSfPM1; uniform vec3 uSfPM2;
uniform int uSfBri; uniform vec3 uSfBC; uniform float uSfBF; uniform float uSfBE; uniform vec3 uSfBM1; uniform vec3 uSfBM2;
uniform vec3 uSfAC; uniform float uSfAR; uniform vec3 uSfAM1; uniform vec3 uSfAM2;
float sfH(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float sfN(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(sfH(i), sfH(i + vec3(1, 0, 0)), f.x), mix(sfH(i + vec3(0, 1, 0)), sfH(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(sfH(i + vec3(0, 0, 1)), sfH(i + vec3(1, 0, 1)), f.x), mix(sfH(i + vec3(0, 1, 1)), sfH(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float sfF(vec3 p) { float a = 0.0, w = 0.5; for (int i = 0; i < 4; i++) { a += w * sfN(p); p *= 2.03; w *= 0.5; } return a; }
vec3 sfArco(float h) { return clamp(abs(fract(h + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0); }
float sfBanda(float x, float a, float b, float s) { return smoothstep(a - s, a + s, x) * (1.0 - smoothstep(b - s, b + s, x)); }
vec2 sfCel(vec3 p) {
  vec3 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 o = vec3(sfH(i + g), sfH(i + g + 17.1), sfH(i + g + 31.7));
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return vec2(d1, d2);
}
float sfLum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 sfPatron(vec3 p, out float linea) {
  linea = 0.0;
  float e = uSfPE; vec3 q = p * e;
  if (uSfPat == 1) { float n = sfF(q * 0.5 + 3.1); return n < 0.46 ? uSfPA : (n < 0.58 ? uSfPB : uSfPC); }
  if (uSfPat == 2) { float f = fract(p.y * e); linea = 1.0 - smoothstep(0.0, 0.07, abs(f - 0.5)); return mix(uSfPA, uSfPB, step(0.5, f)); }
  if (uSfPat == 3) {
    vec2 g = fract(vec2(p.x + p.z * 0.6, p.y) * e);
    float a = step(0.5, g.x), b = step(0.5, g.y);
    vec3 c = mix(uSfPA, uSfPB, a * b + (a + b) * 0.25);
    float l = max(1.0 - smoothstep(0.0, 0.05, abs(g.x - 0.75)), 1.0 - smoothstep(0.0, 0.05, abs(g.y - 0.75)));
    linea = l; return mix(c, uSfPA * 1.35 + 0.05, l * 0.45);
  }
  if (uSfPat == 4) { vec2 c = sfCel(q * 0.6); float n = smoothstep(0.32, 0.42, c.x + sfN(q * 2.0) * 0.18); return mix(uSfPB, uSfPA, n); }
  if (uSfPat == 5) {
    vec2 c = sfCel(vec3(q.x, q.y * 1.4, q.z));
    float borde = smoothstep(0.0, 0.14, c.y - c.x);
    linea = 1.0 - borde;
    return mix(uSfPB, uSfPA, borde * (0.7 + 0.3 * (1.0 - c.x)));
  }
  if (uSfPat == 6) {
    float f = fract(p.y * e + sfN(q * 0.25) * 0.9 + p.x * 2.0 - p.z * 1.3);
    float l = smoothstep(0.0, 0.1, f) * (1.0 - smoothstep(0.86, 1.0, f));
    return mix(uSfPB, uSfPA, l * (0.82 + 0.18 * sfN(q * 3.0)));
  }
  if (uSfPat == 7) {
    vec2 g = abs(fract(vec2(p.x + p.z * 0.7, p.y) * e * 0.5) - 0.5);
    float l = 1.0 - smoothstep(0.02, 0.05, min(g.x, g.y));
    float nodo = 1.0 - smoothstep(0.06, 0.1, length(g - 0.5));
    linea = max(l, nodo); return mix(uSfPA, uSfPB, linea);
  }
  if (uSfPat == 8) { float n = sfF(vec3(p.x * e * 3.0, p.y * e * 0.55, p.z * e * 3.0)); return mix(uSfPA, uSfPB, smoothstep(0.47, 0.6, n)); }
  if (uSfPat == 9) {
    vec2 uv = vec2(p.x + p.z * 0.6, p.y) * e * 0.5;
    uv.x += step(0.5, fract(uv.y * 0.5)) * 0.5;
    float d = length(fract(uv) - 0.5); return mix(uSfPA, uSfPB, 1.0 - smoothstep(0.2, 0.24, d));
  }
  if (uSfPat == 10) return mix(uSfPB, uSfPA, smoothstep(0.95, 1.45, p.y));
  if (uSfPat == 11) {
    float n = sfF(vec3(p.x * e * 2.0, p.y * e * 1.4 - uSfT * 1.2, p.z * e * 2.0));
    float f = smoothstep(0.42, 0.62, n); linea = f; return mix(uSfPA, uSfPB, f);
  }
  return uSfPA;
}
vec3 sfBrillo(vec3 p, float linea, inout vec3 col) {
  float e = uSfBE;
  if (uSfBri == 1) {
    vec3 h = sfArco(fract(p.y * e * 0.5 + (p.x + p.z) * e * 0.3 + uSfT * 0.15));
    col = mix(col, h, 0.6); return h * uSfBF * 0.5;
  }
  if (uSfBri == 2) {
    float n = sfF(p * e * 0.6 + vec3(0.0, -uSfT * 0.2, 0.0));
    float g = 1.0 - smoothstep(0.0, 0.05, abs(n - 0.5));
    float puls = 0.7 + 0.3 * sin(uSfT * 2.0 + p.y * 4.0);
    col *= 0.45; return uSfBC * g * uSfBF * puls;
  }
  if (uSfBri == 3) {
    float n = sfF(p * e + vec3(uSfT * 0.03));
    vec3 neb = mix(vec3(0.03, 0.02, 0.09), uSfBC * 0.55, smoothstep(0.42, 0.78, n));
    vec3 celda = floor(p * e * 16.0);
    float s = step(0.975, sfH(celda));
    float tw = 0.5 + 0.5 * sin(uSfT * 3.0 + sfH(celda + 3.0) * 30.0);
    col = neb; return neb * 0.5 * uSfBF + vec3(s * tw * uSfBF * 1.6);
  }
  if (uSfBri == 4) {
    float l = linea;
    if (uSfPat != 7 && uSfPat != 2 && uSfPat != 5) { vec2 g = abs(fract(vec2(p.x + p.z * 0.7, p.y) * e * 0.5) - 0.5); l = 1.0 - smoothstep(0.012, 0.035, min(g.x, g.y)); }
    float puls = 0.7 + 0.3 * sin(uSfT * 3.0 + p.y * 6.0);
    col = mix(col, uSfBC, l * 0.8); return uSfBC * l * uSfBF * puls;
  }
  if (uSfBri == 5) return uSfBC * uSfBF * (0.5 + 0.5 * sin(uSfT * 2.5));
  return vec3(0.0);
}
`;

const GLSL_FRAG_MAIN = /* glsl */`
vec3 sfEmis = vec3(0.0); float sfMet = 0.0;
{
  if (vSfPos.y > uSfCorte) discard;
  if (uSfGafas > 0.5 && vSfPos.y > 1.823 && vSfPos.z > 0.145) discard;
#ifdef USE_MAP
  vec3 sfTex = pow(max(sampledDiffuseColor.rgb, vec3(0.0)), vec3(1.0 / 2.2));
#else
  vec3 sfTex = vec3(0.8);
#endif
  vec3 s = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(1.0 / 2.2));
  float lum = sfLum(sfTex);
  vec3 w1 = vec3(0.0); vec2 w2 = vec2(0.0);
  if (uSfFam == 1) {
    float mx = max(max(sfTex.r, sfTex.g), sfTex.b), mn = min(min(sfTex.r, sfTex.g), sfTex.b);
    float sat = (mx - mn) / max(mx, 1e-4);
    float d = max(mx - mn, 1e-4);
    float hue = mx == sfTex.r ? mod((sfTex.g - sfTex.b) / d, 6.0) : (mx == sfTex.g ? (sfTex.b - sfTex.r) / d + 2.0 : (sfTex.r - sfTex.g) / d + 4.0);
    hue /= 6.0;
    float calido = (sfBanda(hue, 0.0, 0.115, 0.02) + sfBanda(hue, 0.95, 1.05, 0.02)) * smoothstep(0.17, 0.27, sat);
    w1 = vec3(sfBanda(hue, 0.125, 0.25, 0.03) * smoothstep(0.1, 0.18, sat),
              (1.0 - smoothstep(0.1, 0.18, sat)) * (1.0 - smoothstep(0.36, 0.46, mx)),
              sfBanda(hue, 0.38, 0.58, 0.03) * smoothstep(0.14, 0.22, sat));
    w2 = vec2(calido * (1.0 - smoothstep(0.47, 0.55, mx)), calido * smoothstep(0.47, 0.55, mx));
  }
  float W[5]; W[0] = w1.x; W[1] = w1.y; W[2] = w1.z; W[3] = w2.x; W[4] = w2.y;
  float R[5]; R[0] = 0.30; R[1] = 0.23; R[2] = 0.27; R[3] = 0.27; R[4] = 0.52;
  for (int i = 0; i < 5; i++) {
    if (uSfRec[i].a > 0.5) s = mix(s, uSfRec[i].rgb * clamp(lum / R[i], 0.0, 2.2), W[i]);
  }
  // sombreado para lo que se pinta encima: el de la zona (o el de todo el material)
  float sombra = uSfFam == 1 ? 0.0 : clamp(lum / uSfRef, 0.35, 1.6);
  if (uSfFam == 1) { float ws = 0.0; for (int i = 0; i < 5; i++) { sombra += W[i] * clamp(lum / R[i], 0.35, 1.6); ws += W[i]; } sombra = ws > 0.01 ? sombra / ws : 1.0; }
  float linea = 0.0;
  if (uSfPat > 0) {
    float m = clamp(dot(uSfPM1, w1) + uSfPM2.x * w2.x + uSfPM2.y * w2.y + uSfPM2.z, 0.0, 1.0);
    if (m > 0.001) { vec3 pc = sfPatron(vSfPos, linea); s = mix(s, pc * sombra, m); }
  }
  float ma = clamp(dot(uSfAM1, w1) + uSfAM2.x * w2.x + uSfAM2.y * w2.y + uSfAM2.z, 0.0, 1.0);
  if (ma > 0.001) { s = mix(s, uSfAC * mix(1.0, sombra, 0.5), ma); sfMet = ma; }
  if (uSfBri > 0) {
    float mb = clamp(dot(uSfBM1, w1) + uSfBM2.x * w2.x + uSfBM2.y * w2.y + uSfBM2.z, 0.0, 1.0);
    if (mb > 0.001) { vec3 c2 = s; vec3 em = sfBrillo(vSfPos, linea, c2); s = mix(s, c2 * mix(1.0, sombra, 0.5), mb); sfEmis = pow(max(em, vec3(0.0)), vec3(2.2)) * mb; }
  }
  diffuseColor.rgb = pow(max(s, vec3(0.0)), vec3(2.2));
}
`;

function nuevosUniforms() {
  return {
    uSfT: TIEMPO,
    uSfRec: { value: Array.from({ length: 5 }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uSfFam: { value: 0 }, uSfRef: { value: 0.6 }, uSfCorte: { value: 1e9 }, uSfDeq: { value: new THREE.Matrix4() }, uSfGafas: { value: 0 },
    uSfPat: { value: 0 }, uSfPA: { value: new THREE.Color() }, uSfPB: { value: new THREE.Color() }, uSfPC: { value: new THREE.Color() }, uSfPE: { value: 1 },
    uSfPM1: { value: new THREE.Vector3() }, uSfPM2: { value: new THREE.Vector3() },
    uSfBri: { value: 0 }, uSfBC: { value: new THREE.Color() }, uSfBF: { value: 1 }, uSfBE: { value: 1 },
    uSfBM1: { value: new THREE.Vector3() }, uSfBM2: { value: new THREE.Vector3() },
    uSfAC: { value: new THREE.Color() }, uSfAR: { value: 0.3 }, uSfAM1: { value: new THREE.Vector3() }, uSfAM2: { value: new THREE.Vector3() },
  };
}

// color en "sRGB" (como los escribimos en el catálogo) para el shader, que trabaja en sRGB aproximado
const srgb = (hex, out = new THREE.Color()) => { out.set(hex); out.convertLinearToSRGB(); return out; };

// máscara de zonas -> (pantalon, camisa, bufanda), (cuero, piel, todo)
function mascara(en, todoMaterial, m1, m2) {
  m1.set(0, 0, 0); m2.set(0, 0, 0);
  if (!en) return;
  if (todoMaterial) { m2.z = 1; return; }
  const v = ZONAS.map((z) => (en.includes(z) ? 1 : 0));
  m1.set(v[0], v[1], v[2]); m2.set(v[3], v[4], 0);
}

// Material con el shader de skins. o: { familias, recolor:{zona:color}, ref, corte, gafas, patron, brillo, acabado,
// todo: el patrón/brillo/acabado van en todo el material (si en lo permite) }
function materialSkin(base, o) {
  const m = base.clone();
  const u = nuevosUniforms();
  u.uSfFam.value = o.familias ? 1 : 0;
  u.uSfRef.value = o.ref ?? 0.6;
  u.uSfCorte.value = o.corte ?? 1e9;
  if (o.deq) u.uSfDeq.value.copy(o.deq);
  u.uSfGafas.value = o.gafas ? 1 : 0;
  if (o.recolor) ZONAS.forEach((z, i) => { if (o.recolor[z]) { const c = srgb(o.recolor[z]); u.uSfRec.value[i].set(c.r, c.g, c.b, 1); } });
  const p = o.patron;
  if (p && PATRONES[p.tipo] && o.aplica(p.en)) {
    u.uSfPat.value = PATRONES[p.tipo];
    srgb(p.a || '#888888', u.uSfPA.value); srgb(p.b || p.a || '#444444', u.uSfPB.value); srgb(p.c || p.b || '#222222', u.uSfPC.value);
    u.uSfPE.value = p.esc || 1;
    mascara(p.en || ['todo'], o.todo, u.uSfPM1.value, u.uSfPM2.value);
  }
  const b = o.brillo;
  if (b && BRILLOS[b.tipo] && o.aplica(b.en)) {
    u.uSfBri.value = BRILLOS[b.tipo];
    srgb(b.color || '#ffffff', u.uSfBC.value);
    u.uSfBF.value = b.fuerza ?? 1; u.uSfBE.value = b.esc || 1;
    mascara(b.en || ['todo'], o.todo, u.uSfBM1.value, u.uSfBM2.value);
  }
  const a = o.acabado;
  if (a && ACABADOS[a.tipo] && o.aplica(a.en)) {
    srgb(ACABADOS[a.tipo].color, u.uSfAC.value);
    u.uSfAR.value = ACABADOS[a.tipo].rug;
    mascara(a.en || ['todo'], o.todo, u.uSfAM1.value, u.uSfAM2.value);
  }
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSfPos;\nuniform mat4 uSfDeq;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSfPos = (uSfDeq * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_FRAG_DEF}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${GLSL_FRAG_MAIN}`)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 1.0, sfMet);\nroughnessFactor = mix(roughnessFactor, uSfAR, sfMet);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += sfEmis;');
  };
  m.customProgramCacheKey = () => 'sf-skin-1';
  m.userData.sf = u;
  return m;
}

// ------------------------------------------------------------------------------------------------------------------
// Cachés: un material por (skin, material base, color), compartido entre todos los que usan esa skin
const cacheMat = new Map();
function cache(clave, crear) {
  if (!cacheMat.has(clave)) cacheMat.set(clave, crear());
  return cacheMat.get(clave);
}

// en qué partes va algo: "en" de un patrón/brillo/acabado del traje
const aplicaEn = (zonasMaterial) => (en) => !en || en.some((z) => zonasMaterial.includes(z));

// El GLB del héroe viene cuantizado (posiciones de -1 a 1): la escala real quedó dentro de las inversas de los
// huesos. deq lleva esas posiciones a metros en el espacio de la malla, que es donde están el corte y los patrones.
const deqs = new Map();
function deqDe(nombreMaterial) {
  if (deqs.has(nombreMaterial)) return deqs.get(nombreMaterial);
  let d = null;
  ASSETS.personaje?.updateMatrixWorld(true);
  ASSETS.personaje?.traverse((o) => {
    if (d || !o.isSkinnedMesh || o.material?.name !== nombreMaterial) return;
    const sk = o.skeleton;
    // en reposo: inv(malla) · hueso · inversa(hueso) = la descuantización
    d = new THREE.Matrix4().copy(o.matrixWorld).invert().multiply(sk.bones[0].matrixWorld).multiply(sk.boneInverses[0]);
  });
  deqs.set(nombreMaterial, d);
  return d;
}

function materialesTraje(traje, base, color) {
  const look = traje.look || {};
  const cabeza = Object.keys(look.acc || {}).some((k) => k.startsWith('cab_'));
  // las antiparras (en Ropa y Metal) se esconden con sombrero o con una cabeza entera encima
  const gafas = cabeza || Object.keys(look.acc || {}).some((k) => SOMBREROS.has(k));
  const corte = cabeza ? CORTE_CABEZA : null;
  const nombre = base.name;
  return cache(`${traje.id}:${nombre}:${look.chalecoJugador ? color : ''}`, () => {
    if (nombre === 'Heroe') {
      const recolor = {};
      for (const z of ZONAS) if (look[z]) recolor[z] = look[z];
      return materialSkin(base, { deq: deqDe(nombre), familias: true, recolor, corte, gafas, patron: look.patron, brillo: look.brillo, acabado: look.acabado, aplica: aplicaEn(ZONAS) });
    }
    if (nombre === 'Ropa') {
      const m = materialSkin(base, { deq: deqDe(nombre), ref: 0.78, corte, gafas, patron: look.patron, brillo: look.brillo, acabado: look.acabado, todo: true, aplica: aplicaEn(['chaleco']) });
      m.color.set(look.chalecoJugador ? color : look.chaleco || base.color.getHex());
      return m;
    }
    if (nombre === 'Metal' && (look.metal || gafas)) {
      const m = gafas ? materialSkin(base, { deq: deqDe(nombre), corte, gafas, aplica: () => false }) : base.clone();
      if (look.metal) m.color.set(look.metal);
      return m;
    }
    return base;
  });
}

// material de un accesorio / mochila / pico de skins.glb: color por nombre de material + efectos en el material A
function materialAcc(base, clave, colores = {}, efectos = {}) {
  return cache(`acc:${clave}:${base.name}`, () => {
    const n = base.name;
    const color = colores[n];
    const enA = n === 'A' && (efectos.patron || efectos.brillo || efectos.acabado);
    const m = enA ? materialSkin(base, { ref: 0.8, todo: true, patron: efectos.patron, brillo: efectos.brillo, acabado: efectos.acabado, aplica: () => true }) : base.clone();
    if (color) m.color.set(color);
    if (n === 'Luz') { m.emissive = new THREE.Color(color || base.color); m.emissiveIntensity = 2.2; m.toneMapped = true; }
    if (n === 'Vidrio') { m.roughness = 0.08; m.metalness = 0.6; m.envMapIntensity = 1.2; }
    if (n === 'Metal') { m.metalness = 0.95; m.roughness = Math.min(m.roughness, 0.35); }
    if (n === 'Ojo' && !color) m.color.set('#f4f4f0');
    return m;
  });
}

let envSkins = null;
let inversas = null; // nombre de hueso -> inversa de su pose de reposo (en el espacio del glTF del héroe)
export function prepararSkins(renderer) {
  if (!envSkins && renderer) {
    // el mismo reflejo de estudio que usa el héroe (rig.js setRigEnv) para que el metal y los visores brillen
    ASSETS.personaje?.traverse((o) => { if (!envSkins && o.isMesh && o.material?.envMap) envSkins = o.material.envMap; });
  }
}
function inversaDe(hueso) {
  if (!inversas) {
    inversas = {};
    ASSETS.personaje?.updateMatrixWorld(true);
  }
  if (!inversas[hueso]) {
    const b = ASSETS.personaje?.getObjectByName(hueso);
    inversas[hueso] = b ? b.matrixWorld.clone().invert() : new THREE.Matrix4();
  }
  return inversas[hueso];
}

// copia un nodo de skins.glb con los materiales de la skin
function clonarNodo(nombre, clave, colores, efectos) {
  const src = ASSETS.skins?.getObjectByName(nombre);
  if (!src) return null;
  const obj = src.clone(true);
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map((mm) => materialAcc(mm, clave, colores, efectos)) : materialAcc(o.material, clave, colores, efectos);
    o.castShadow = true;
    o.receiveShadow = true;
  });
  return obj;
}

function colgar(u, nombreNodo, clave, colores, efectos) {
  const obj = clonarNodo(nombreNodo, clave, colores, efectos);
  if (!obj) return;
  const hueso = u.model.getObjectByName(huesoDe(nombreNodo));
  if (!hueso) return;
  obj.matrixAutoUpdate = false;
  obj.matrix.copy(inversaDe(huesoDe(nombreNodo))).multiply(obj.matrix.clone().compose(obj.position, obj.quaternion, obj.scale));
  hueso.add(obj);
  obj.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  u.accs.push(obj);
}

// ------------------------------------------------------------------------------------------------------------------
// Vestir un personaje del esqueleto (createRigCharacter). sk = { personaje, mochila, pico, planeador, envoltorio }
export function vestir(root, sk, color = '#ffffff') {
  const u = root.userData;
  if (!u?.rig) return;
  sk = { ...EQUIPO_INICIAL, ...(sk || {}) };
  const clave = JSON.stringify(sk) + color;
  if (u.vestido === clave) return;
  u.vestido = clave;
  u.sk = sk;
  u.colorJugador = color;
  for (const a of u.accs || []) a.parent?.remove(a);
  u.accs = [];

  const traje = SKIN[sk.personaje]?.tipo === 'personaje' ? SKIN[sk.personaje] : SKIN.recluta;
  u.model.traverse((o) => {
    if (!o.isMesh || o.userData.esAcc) return;
    const base = o.userData.sfBase || (o.userData.sfBase = ASSETS.personaje ? materialOriginal(o.material) : o.material);
    o.material = materialesTraje(traje, base, color);
  });
  const look = traje.look || {};
  const efectosAcc = {
    patron: look.patron?.en?.includes('acc') ? look.patron : null,
    brillo: look.brillo?.en?.includes('acc') ? look.brillo : null,
    acabado: look.acabado?.en?.includes('acc') ? look.acabado : null,
  };
  for (const [id, colores] of Object.entries(look.acc || {})) {
    const lados = ASSETS.skins?.getObjectByName(`acc_${id}_L`) ? [`acc_${id}_L`, `acc_${id}_R`] : [`acc_${id}`];
    for (const n of lados) colgar(u, n, `${traje.id}:${id}`, colores, efectosAcc);
  }
  // mochila
  const moch = sk.mochila && SKIN[sk.mochila]?.tipo === 'mochila' ? SKIN[sk.mochila] : null;
  if (moch) colgar(u, `acc_${moch.modelo}`, `moch:${moch.id}`, moch.colores, { patron: moch.patron, brillo: moch.brillo, acabado: moch.acabado });
  for (const a of u.accs) a.traverse((o) => { if (o.isMesh) o.userData.esAcc = true; });
  // paracaídas
  pintarParacaidas(u, sk.planeador, color);
  // el pico y el envoltorio se aplican al poner algo en la mano (models.js setHeld lee u.sk)
}

// el material original del héroe (antes de vestirlo) para poder cambiar de skin sin acumular cambios
const originales = new Map();
function materialOriginal(m) {
  let o = null;
  ASSETS.personaje.traverse((x) => { if (!o && x.isMesh && x.material.name === m.name) o = x.material; });
  if (o && !originales.has(m.name)) originales.set(m.name, o);
  return originales.get(m.name) || m;
}

function pintarParacaidas(u, id, color) {
  const para = u.para?.obj;
  if (!para) return;
  const pl = SKIN[id]?.tipo === 'planeador' ? SKIN[id] : SKIN.clasico;
  para.traverse((o) => {
    if (!o.isMesh) return;
    const base = o.userData.sfBase || (o.userData.sfBase = o.material);
    const n = base.name;
    if (n !== 'Tela' && n !== 'TelaClara') return;
    o.material = cache(`para:${pl.id}:${n}:${pl.tela ? '' : color}`, () => {
      const efectos = n === 'Tela' || pl.brillo?.tipo === 'galaxia' || pl.brillo?.tipo === 'holo';
      const m = efectos && (pl.patron || pl.brillo) ? materialSkin(base, { ref: 0.85, todo: true, patron: pl.patron, brillo: pl.brillo, aplica: () => true }) : base.clone();
      m.color.set(pl.tela ? pl.tela[n] : n === 'Tela' ? color : base.color.getHex());
      return m;
    });
  });
}

// Pico para la mano: modelo de skins.glb o el de armas.glb con su acabado. Devuelve un Object3D o null.
export function modeloPico(id) {
  const s = SKIN[id]?.tipo === 'pico' ? SKIN[id] : null;
  if (!s || s.id === 'pico') return null;
  if (s.modelo) return clonarNodo(s.modelo, `pico:${s.id}`, s.colores, { brillo: s.brillo, acabado: s.acabado, patron: s.patron });
  const src = ASSETS.armas?.getObjectByName('pico');
  if (!src) return null;
  const obj = src.clone(true);
  obj.position.set(0, 0, 0);
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.material = cache(`picoarma:${s.id}:${o.material.name}`, () => materialSkin(o.material, { ref: 0.45, todo: true, brillo: s.brillo, acabado: s.acabado, patron: s.patron, aplica: () => true }));
  });
  return obj;
}

// Envoltorio: cambia los materiales de la carrocería del arma (Arma_*) por la versión con el envoltorio
export function envolver(obj, id) {
  const s = SKIN[id]?.tipo === 'envoltorio' ? SKIN[id] : null;
  if (!s || !obj) return obj;
  obj.traverse((o) => {
    if (!o.isMesh || !o.material?.name?.startsWith('Arma_')) return;
    o.material = cache(`env:${s.id}:${o.material.name}`, () => materialSkin(o.material, { ref: 0.42, todo: true, patron: s.patron, brillo: s.brillo, acabado: s.acabado, aplica: () => true }));
  });
  return obj;
}

// Para las miniaturas y la vitrina: la mochila sola
export function modeloMochila(id) {
  const s = SKIN[id];
  return s ? clonarNodo(`acc_${s.modelo}`, `moch:${s.id}`, s.colores, { patron: s.patron, brillo: s.brillo, acabado: s.acabado }) : null;
}
