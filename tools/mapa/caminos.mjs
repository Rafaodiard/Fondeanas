// Prueba de caminos: ninguna calle ni ruta se corta de golpe.
// Cada punta tiene que llegar a otra calle (sin hueco entre las dos) o terminar en un remate declarado en isla.js:
//   ini/fin: { r } = plazoleta redonda (rotonda, playón, atrio) · ini/fin: 'puerta' = llega hasta una estructura.
// Además: todas las calles forman una sola red, ninguna plazoleta pisa una estructura y el pasto no asoma por las calles.
import { PUEBLOS, RUTAS } from '../../public/js/isla.js';
import { distPoly } from '../../public/js/world.js';

// Lo que no cuenta como destino de un camino (ni se revisa contra las plazoletas).
const MENORES = new Set(['cables', 'poste', 'indicador', 'farol', 'banco', 'tacho', 'hidrante', 'buzon', 'cantero', 'cartel', 'jardin', 'seto', 'cerca', 'campo']);
const PUERTA = 3; // m entre la punta y la estructura
const ASOMA = 0.1; // m que el terreno puede pasar por arriba de una calle (menos no se ve)
const fmt = ([x, z]) => `(${x.toFixed(0)}, ${z.toFixed(0)})`;

function nombre(rb) {
  const d = rb.def || {};
  if (d.pueblo) return `calle de ${PUEBLOS.find((t) => t.id === d.pueblo).name} ${JSON.stringify(d.p[0])}→${JSON.stringify(d.p[d.p.length - 1])}`;
  const i = RUTAS.indexOf(d);
  return `ruta ${i} ${fmt(rb.pts[0])}→${fmt(rb.pts[rb.pts.length - 1])}`;
}

const distCaja = ([x, z], f) => Math.hypot(Math.max(f.x0 - x, 0, x - f.x1), Math.max(f.z0 - z, 0, z - f.z1));

function cruzan(a, b) {
  for (let i = 0; i < a.length - 1; i++) for (let j = 0; j < b.length - 1; j++) {
    const [p, q] = [a[i], a[i + 1]], [r, s] = [b[j], b[j + 1]];
    const o = (u, v, w) => Math.sign((v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0]));
    if (o(p, q, r) !== o(p, q, s) && o(r, s, p) !== o(r, s, q)) return true;
  }
  return false;
}

export function pruebaCaminos({ world, fail }) {
  const rbs = world.ribbons.filter((r) => !r.under);
  let puntas = 0, uniones = 0, remates = 0, cortadas = 0;
  // unión de redes (cada calle empieza sola)
  const padre = rbs.map((_, i) => i);
  const raiz = (i) => (padre[i] === i ? i : (padre[i] = raiz(padre[i])));
  const unir = (a, b) => { padre[raiz(a)] = raiz(b); };

  rbs.forEach((rb, ia) => {
    for (const [cual, p] of [['ini', rb.pts[0]], ['fin', rb.pts[rb.pts.length - 1]]]) {
      puntas++;
      const rem = rb.def?.[cual];
      // llega a otra calle: la punta queda adentro de la otra, con medio metro de margen (si no, se ve un hueco)
      const ib = rbs.findIndex((o) => o !== rb && distPoly(p, o.pts) <= o.w / 2 - 0.5);
      if (ib >= 0) {
        uniones++;
        unir(ia, ib);
        if (rem) fail(`caminos: ${nombre(rb)} tiene remate en ${cual} pero ya llega a ${nombre(rbs[ib])}`);
        continue;
      }
      if (rem?.r) {
        const pq = world.plazas.find((q) => q.rb === rb && Math.hypot(q.x - p[0], q.z - p[1]) < 0.01);
        if (pq && pq.r >= rb.w / 2 + 1.5) { remates++; continue; }
        cortadas++; fail(`caminos: ${nombre(rb)} declara una plazoleta en ${cual} que no se armó o es más angosta que la calle`);
        continue;
      }
      if (rem === 'puerta') {
        let best = Infinity, cual2 = null;
        for (const pl of world.placed) if (!MENORES.has(pl.name)) { const d = distCaja(p, pl.fp); if (d < best) { best = d; cual2 = pl.name; } }
        if (best <= PUERTA) { remates++; continue; }
        cortadas++; fail(`caminos: ${nombre(rb)} tendría que llegar a una puerta en ${fmt(p)} pero la estructura más cerca (${cual2}) está a ${best.toFixed(1)} m`);
        continue;
      }
      cortadas++;
      let gap = Infinity, quien = null;
      for (const o of rbs) if (o !== rb) { const d = distPoly(p, o.pts) - o.w / 2; if (d < gap) { gap = d; quien = o; } }
      fail(`caminos: ${nombre(rb)} se corta de golpe en ${fmt(p)}` + (gap < 25 ? ` (queda un hueco: ${nombre(quien)} está a ${Math.max(0, gap).toFixed(1)} m)` : ' (no llega a ninguna calle ni tiene remate)'));
    }
  });
  // calles que se cruzan por el medio también están unidas
  for (let i = 0; i < rbs.length; i++) for (let j = i + 1; j < rbs.length; j++) if (raiz(i) !== raiz(j) && cruzan(rbs[i].pts, rbs[j].pts)) unir(i, j);
  const redes = new Map();
  rbs.forEach((rb, i) => { const r = raiz(i); if (!redes.has(r)) redes.set(r, []); redes.get(r).push(rb); });
  if (redes.size > 1) {
    const grupos = [...redes.values()].sort((a, b) => b.length - a.length);
    for (const g of grupos.slice(1)) fail(`caminos: ${g.length} calle(s) sueltas, sin unión con el resto de la red: ${g.map(nombre).join('; ')}`);
  }
  // las plazoletas no pisan estructuras
  let pisan = 0;
  for (const pq of world.plazas) {
    const R = pq.r + (pq.vereda ? 2.5 : 0);
    for (const pl of world.placed) {
      if (MENORES.has(pl.name)) continue;
      const d = distCaja([pq.x, pq.z], pl.fp);
      if (d < R) { pisan++; fail(`caminos: la plazoleta de ${nombre(pq.rb)} en ${fmt([pq.x, pq.z])} pisa ${pl.name} (${(R - d).toFixed(1)} m adentro)`); }
    }
  }
  // el terreno no asoma por arriba de las cintas (cruces, banquinas, aplanados de estructuras)
  const { pos, mat } = world.trisCalles();
  let asoma = 0, peor = 0;
  for (let t = 0; t < mat.length; t++) {
    if (mat[t] === 'linea') continue;
    const o = t * 9, P = [0, 1, 2].map((k) => [pos[o + k * 3], pos[o + k * 3 + 1], pos[o + k * 3 + 2]]);
    for (const [u, v] of [[1 / 3, 1 / 3], [0.6, 0.2], [0.2, 0.6], [0.2, 0.2], [0.5, 0.5], [0.5, 0], [0, 0.5]]) {
      const x = P[0][0] + (P[1][0] - P[0][0]) * u + (P[2][0] - P[0][0]) * v, z = P[0][2] + (P[1][2] - P[0][2]) * u + (P[2][2] - P[0][2]) * v;
      const d = world.terrainHeight(x, z) - (P[0][1] + (P[1][1] - P[0][1]) * u + (P[2][1] - P[0][1]) * v);
      peor = Math.max(peor, d);
      if (d > ASOMA) { asoma++; if (asoma <= 10) fail(`caminos: el terreno asoma ${(d * 100).toFixed(0)} cm por arriba de la ${mat[t]} en ${fmt([x, z])}`); break; }
    }
  }
  console.log(`caminos: ${puntas} puntas, ${uniones} llegan a otra calle, ${remates} con remate; cortadas: ${cortadas}; redes: ${redes.size}; plazoletas que pisan estructuras: ${pisan}; terreno que asoma: ${asoma} (lo más alto ${(Math.max(0, peor) * 100).toFixed(1)} cm)`);
}
