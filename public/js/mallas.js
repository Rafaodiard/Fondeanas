// Convierte las piezas de un Plano en triángulos (posición, normal, color) agrupados por tipo de material.
// Todo se acumula en "lotes" que después se vuelven una sola malla por zona y material (pocas llamadas de dibujo).
import * as THREE from 'three';
import { PALETA, STOREY } from './planos.js';

const KINDS = ['s', 'm', 'v', 'e'];
const UP = new THREE.Vector3(0, 1, 0);
const _c = new THREE.Color();
const colorCache = {};
function colorOf(m) {
  if (!colorCache[m]) {
    const p = PALETA[m] || ['#ff00ff', 's'];
    colorCache[m] = { c: new THREE.Color(p[0]), k: p[1], pat: p[2] || 0 };
  }
  return colorCache[m];
}

export class Lote {
  constructor() { this.b = {}; for (const k of KINDS) this.b[k] = { p: [], n: [], c: [], ao: [], pat: [] }; this.curPat = 0; this.useAo = true; }

  // Agrega un triángulo en coordenadas locales, con la matriz del objeto.
  tri(buf, a, b, c, col, M, shade) {
    const v = [a, b, c].map((p) => new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(M));
    const n = new THREE.Vector3().subVectors(v[1], v[0]).cross(new THREE.Vector3().subVectors(v[2], v[0]));
    const len = n.length();
    if (len < 1e-9) return;
    n.divideScalar(len);
    // Sombra de contacto: en caras verticales se guarda la altura local (el shader oscurece cerca de cada piso).
    const vertical = shade && Math.abs(n.dot(UP)) < 0.5;
    for (let i = 0; i < 3; i++) {
      buf.p.push(v[i].x, v[i].y, v[i].z);
      buf.n.push(n.x, n.y, n.z);
      buf.c.push(col.r, col.g, col.b);
      buf.ao.push(vertical && this.useAo ? [a, b, c][i][1] : -1);
      buf.pat.push(this.curPat);
    }
  }

  quad(buf, a, b, c, d, col, M, shade) { this.tri(buf, a, b, c, col, M, shade); this.tri(buf, a, c, d, col, M, shade); }

  // Hexaedro a partir de 8 esquinas: abajo (0..3) y arriba (4..7), en orden antihorario visto de arriba.
  hexa(buf, P, col, M, shade) {
    const [a, b, c, d, e, f, g, h] = P;
    this.quad(buf, a, b, c, d, col, M, shade); // abajo (mirando hacia abajo)
    this.quad(buf, e, h, g, f, col, M, shade); // arriba
    this.quad(buf, a, e, f, b, col, M, shade);
    this.quad(buf, b, f, g, c, col, M, shade);
    this.quad(buf, c, g, h, d, col, M, shade);
    this.quad(buf, d, h, e, a, col, M, shade);
  }

  // Agrega todas las piezas de un plano con la matriz M. jitter: variación de color por objeto.
  plano(P, M, { jitter = 0 } = {}) {
    for (const part of P.parts) this.part(part, M, jitter);
  }

  part(q, M, jitter) {
    const { c: base, k, pat } = colorOf(q.m);
    this.curPat = pat;
    const col = _c.copy(base);
    if (jitter) col.offsetHSL(0, 0, jitter);
    const buf = this.b[k];
    // Sombreado de contacto: las caras verticales se oscurecen cerca del piso de cada nivel.
    const shade = k === 's' || k === 'm' ? aoShade : null;
    switch (q.t) {
      case 'box': {
        const [x0, y0, z0, x1, y1, z1] = q.a;
        // abajo: a(x0,z1) b(x1,z1) c(x1,z0) d(x0,z0) -> antihorario visto desde abajo para que la normal apunte -Y
        this.hexa(buf, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], col, M, shade);
        break;
      }
      case 'ramp': {
        const [x0, y0, z0, x1, y1, z1] = q.a;
        const lo = q.lo ?? y0;
        const top = (x, z) => {
          let t;
          if (q.up === '+x') t = x === x1 ? 1 : 0; else if (q.up === '-x') t = x === x0 ? 1 : 0;
          else if (q.up === '+z') t = z === z1 ? 1 : 0; else t = z === z0 ? 1 : 0;
          return lo + (y1 - lo) * t;
        };
        this.hexa(buf, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, top(x0, z0), z0], [x1, top(x1, z0), z0], [x1, top(x1, z1), z1], [x0, top(x0, z1), z1]], col, M, shade);
        break;
      }
      case 'tri': {
        const [x0, y0, z0, x1, y1, z1] = q.a;
        if (q.axis === 'z') {
          const zm = (z0 + z1) / 2;
          this.hexa(buf, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, zm], [x1, y1, zm], [x1, y1, zm], [x0, y1, zm]], col, M, shade);
        } else {
          const xm = (x0 + x1) / 2;
          this.hexa(buf, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [xm, y1, z0], [xm, y1, z0], [xm, y1, z1], [xm, y1, z1]], col, M, shade);
        }
        break;
      }
      case 'slope': {
        const [x0, z0, x1, z1] = q.a;
        const th = q.th;
        const yAt = (x, z) => {
          let t;
          if (q.up === '+x') t = (x - x0) / (x1 - x0); else if (q.up === '-x') t = (x1 - x) / (x1 - x0);
          else if (q.up === '+z') t = (z - z0) / (z1 - z0); else t = (z1 - z) / (z1 - z0);
          return q.ylo + (q.yhi - q.ylo) * t;
        };
        const C = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
        this.hexa(buf, [...C.map(([x, z]) => [x, yAt(x, z) - th, z]), ...C.map(([x, z]) => [x, yAt(x, z), z])], col, M, null);
        break;
      }
      case 'cyl': this.cyl(buf, q, col, M); break;
      case 'tube': this.tube(buf, q, col, M); break;
      case 'sph': this.sph(buf, q, col, M); break;
    }
  }

  cyl(buf, q, col, M) {
    const { x, y, z, r, r2, h, seg, open } = q;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const p = (a, rr, yy) => [x + Math.cos(a) * rr, yy, z + Math.sin(a) * rr];
      this.quad(buf, p(a0, r, y), p(a0, r2, y + h), p(a1, r2, y + h), p(a1, r, y), col, M, aoShade);
      if (!open) {
        if (r2 > 0.01) this.tri(buf, [x, y + h, z], p(a1, r2, y + h), p(a0, r2, y + h), col, M);
        this.tri(buf, [x, y, z], p(a0, r, y), p(a1, r, y), col, M);
      }
    }
  }

  tube(buf, q, col, M) {
    const a = new THREE.Vector3(...q.a), b = new THREE.Vector3(...q.b);
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 1e-4) return;
    dir.divideScalar(len);
    const up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(dir, up).normalize();
    const w = new THREE.Vector3().crossVectors(u, dir).normalize();
    const pt = (base, ang) => { const o = base.clone().addScaledVector(u, Math.cos(ang) * q.r).addScaledVector(w, Math.sin(ang) * q.r); return [o.x, o.y, o.z]; };
    for (let i = 0; i < q.seg; i++) {
      const a0 = (i / q.seg) * Math.PI * 2, a1 = ((i + 1) / q.seg) * Math.PI * 2;
      this.quad(buf, pt(a, a0), pt(a, a1), pt(b, a1), pt(b, a0), col, M);
      this.tri(buf, q.a, pt(a, a1), pt(a, a0), col, M);
      this.tri(buf, q.b, pt(b, a0), pt(b, a1), col, M);
    }
  }

  sph(buf, q, col, M) {
    const { x, y, z, r, seg, half, sy } = q;
    const rows = Math.max(3, Math.round(seg / 2));
    const p = (i, j) => {
      const th = (j / seg) * Math.PI * 2, ph = half ? (i / rows) * (Math.PI / 2) : (i / rows) * Math.PI - Math.PI / 2;
      return [x + Math.cos(ph) * Math.cos(th) * r, y + Math.sin(ph) * r * sy, z + Math.cos(ph) * Math.sin(th) * r];
    };
    for (let i = 0; i < rows; i++) for (let j = 0; j < seg; j++) {
      this.quad(buf, p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1), col, M);
    }
  }

  // Convierte el lote en mallas (una por tipo de material).
  meshes(mats) {
    const out = [];
    for (const k of KINDS) {
      const b = this.b[k];
      if (!b.p.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
      g.setAttribute('aoY', new THREE.Float32BufferAttribute(b.ao, 1));
      g.setAttribute('pat', new THREE.Float32BufferAttribute(b.pat, 1));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mats[k]);
      m.castShadow = k !== 'v' && k !== 'e';
      m.receiveShadow = true;
      out.push(m);
    }
    return out;
  }
}

function aoShade() { return 1; }

// Shader de los edificios: pinta ladrillos, tablas, tejas, chapa, etc. según el dibujo de cada material,
// y oscurece la base de las paredes (sombra de contacto). Todo procedural: no hay texturas que cargar.
const PATTERN_GLSL = /* glsl */`
varying float vAoY;
varying float vPat;
varying vec3 vWPos;
varying vec3 vWNrm;
float sfHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sfNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(sfHash(i), sfHash(i + vec2(1.0, 0.0)), u.x), mix(sfHash(i + vec2(0.0, 1.0)), sfHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float sfLine(float t, float w) { float f = fract(t); return smoothstep(0.0, w, f) * smoothstep(1.0, 1.0 - w, f); }
float sfPattern(float pat, vec3 P, vec3 N) {
  vec3 n = normalize(N);
  bool flat_ = abs(n.y) > 0.75;
  float h = abs(n.z) > abs(n.x) ? P.x : P.z;
  float v = P.y;
  vec2 uv = flat_ ? P.xz : vec2(h, v);
  float f = 1.0;
  float grain = sfNoise(uv * 3.1) * 0.5 + sfNoise(uv * 11.0) * 0.5;
  if (pat < 0.5) return 0.97 + 0.03 * grain;
  if (pat < 1.5) { // ladrillo
    float row = floor(uv.y / 0.24);
    float u = uv.x / 0.5 + mod(row, 2.0) * 0.5;
    f = mix(0.72, 1.0, sfLine(u, 0.05) * sfLine(uv.y / 0.24, 0.1));
    f *= 0.9 + 0.12 * sfHash(vec2(floor(u), row)) + 0.04 * grain;
  } else if (pat < 2.5) { // tablas horizontales
    float row = floor(uv.y / 0.28);
    f = mix(0.68, 1.0, sfLine(uv.y / 0.28, 0.07));
    f *= 0.9 + 0.1 * sfHash(vec2(row, floor(uv.x / 2.3 + row * 0.37))) + 0.06 * (sfNoise(vec2(uv.x * 0.8, uv.y * 30.0)) - 0.5);
  } else if (pat < 3.5) { // tejas: filas por altura, juntas alternadas
    float row = floor(v / 0.32);
    float u = h / 0.42 + mod(row, 2.0) * 0.5;
    f = mix(0.66, 1.0, smoothstep(0.0, 0.35, fract(v / 0.32))) * mix(0.8, 1.0, sfLine(u, 0.06));
    f *= 0.9 + 0.12 * sfHash(vec2(floor(u), row));
  } else if (pat < 4.5) { // chapa acanalada
    float c = flat_ ? P.x : (abs(n.y) > 0.2 ? h : h);
    f = 0.86 + 0.14 * (0.5 + 0.5 * sin(c * 31.4)) + 0.05 * (grain - 0.5);
  } else if (pat < 5.5) { // hormigón con juntas de paneles
    f = mix(0.85, 1.0, sfLine(uv.x / 2.0, 0.012) * sfLine(uv.y / 1.0, 0.02)) * (0.92 + 0.1 * grain);
  } else if (pat < 6.5) { // piedra
    float row = floor(uv.y / 0.36);
    float u = uv.x / 0.62 + sfHash(vec2(row, 3.0));
    f = mix(0.62, 1.0, sfLine(u, 0.06) * sfLine(uv.y / 0.36, 0.1));
    f *= 0.82 + 0.22 * sfHash(vec2(floor(u), row)) + 0.06 * grain;
  } else if (pat < 7.5) { // baldosas
    f = mix(0.8, 1.0, sfLine(uv.x / 0.6, 0.04) * sfLine(uv.y / 0.6, 0.04)) * (0.94 + 0.08 * sfHash(floor(uv / 0.6)));
  } else if (pat < 8.5) { // piso de madera
    vec2 q = flat_ ? P.xz : uv;
    float row = floor(q.y / 0.2);
    f = mix(0.75, 1.0, sfLine(q.y / 0.2, 0.06)) * (0.88 + 0.14 * sfHash(vec2(row, floor(q.x / 1.8 + row * 0.5))));
  } else if (pat < 9.5) { // troncos
    float t = fract(uv.y / 0.45);
    f = 0.72 + 0.28 * sin(t * 3.14159) + 0.05 * (sfNoise(vec2(uv.x * 0.6, uv.y * 20.0)) - 0.5);
  } else if (pat < 10.5) { // revoque
    f = 0.94 + 0.08 * grain;
  } else if (pat < 11.5) { // adobe
    f = 0.88 + 0.14 * sfNoise(uv * 1.3) + 0.05 * grain;
  } else { // heno
    f = 0.85 + 0.2 * sfNoise(vec2(uv.x * 2.0, uv.y * 25.0));
  }
  return f;
}
`;

function patchMaterial(mat, { ao = true, pattern = true } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aoY;\nattribute float pat;\nvarying float vAoY;\nvarying float vPat;\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvAoY = aoY; vPat = pat;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNrm = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + PATTERN_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
      ${pattern ? 'diffuseColor.rgb *= sfPattern(vPat, vWPos, vWNrm);' : ''}
      ${ao ? 'if (vAoY > -0.5) { float ly = mod(vAoY - 0.05 + 40.0, 4.0); diffuseColor.rgb *= mix(0.7, 1.0, smoothstep(0.0, 1.0, ly)); }' : ''}`);
  };
  mat.customProgramCacheKey = () => `sf-pat-${ao}-${pattern}`;
  return mat;
}

export function materialesMapa() {
  return {
    s: patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, flatShading: true })),
    m: patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.12, flatShading: true })),
    v: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.6, depthWrite: false }),
    e: new THREE.MeshBasicMaterial({ vertexColors: true }),
  };
}

// Detalle del terreno: manchas de pasto y tierra en varias escalas para que no se vea liso.
export function terrainDetail(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nfloat tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\nfloat tNoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), u.x), mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), u.x), u.y); }')
      .replace('#include <color_fragment>', `#include <color_fragment>
      vec2 tp = vWPos.xz;
      float big = tNoise(tp * 0.035) * 0.6 + tNoise(tp * 0.11) * 0.4;
      float fine = tNoise(tp * 0.9) * 0.5 + tNoise(tp * 3.7) * 0.5;
      diffuseColor.rgb *= 0.86 + 0.16 * big + 0.08 * fine;`);
  };
  mat.customProgramCacheKey = () => 'sf-terrain';
  return mat;
}
