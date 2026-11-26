// Cambia algunos clips del personaje del juego sin tocar la malla, la piel ni el resto de las animaciones.
// Sirve para reexportar solo los clips que cambiaron (por ejemplo Trote, Correr y Sprint) desde Blender.
//
// Uso (desde la raíz del repo):
//   npm i --no-save @gltf-transform/core@4 @gltf-transform/extensions@4
//   gltf-transform copy public/models/personaje.glb /tmp/pj_raw.glb          (saca meshopt para poder leerlo)
//   node tools/blender/heroe_reemplazar_clips.mjs /tmp/pj_raw.glb /tmp/clips.glb /tmp/pj_nuevo.glb Trote Correr Sprint
//   gltf-transform meshopt /tmp/pj_nuevo.glb public/models/personaje.glb
// donde /tmp/clips.glb sale de heroe_export.py con ACCIONES = ['Trote', 'Correr', 'Sprint'], meshopt=False e
// imagenes='AUTO' sobre el héroe importado con heroe_importar.py. Los canales se enganchan por nombre de hueso.
// Imprime cuánto cambió cada clip (grados en rotaciones, cm en traslaciones): rehacer un clip sin cambios da < 1.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const [base, nuevo, salida, ...lista] = process.argv.slice(2);
if (!salida || !lista.length) {
  console.log('uso: node heroe_reemplazar_clips.mjs base.glb clips.glb salida.glb Clip1 [Clip2 ...]');
  process.exit(1);
}
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const A = await io.read(base), B = await io.read(nuevo);
const nombres = new Set(lista);
const rootA = A.getRoot();
const nodoA = new Map(rootA.listNodes().map((n) => [n.getName(), n]));
const buf = rootA.listBuffers()[0];
const valores = (acc) => { const r = []; for (let i = 0; i < acc.getCount(); i++) r.push(...acc.getElement(i, [])); return r; };
const cambio = {};
for (const anB of B.getRoot().listAnimations()) {
  if (!nombres.has(anB.getName())) continue;
  let anA = rootA.listAnimations().find((a) => a.getName() === anB.getName());
  if (!anA) anA = A.createAnimation(anB.getName());
  const viejo = new Map(anA.listChannels().map((c) => [c.getTargetNode().getName() + '/' + c.getTargetPath(), valores(c.getSampler().getOutput())]));
  for (const c of anA.listChannels()) { const s = c.getSampler(); c.dispose(); s.dispose(); }
  let maxd = 0;
  for (const c of anB.listChannels()) {
    const nodo = nodoA.get(c.getTargetNode().getName());
    if (!nodo) { console.log('falta el hueso', c.getTargetNode().getName()); continue; }
    const sB = c.getSampler();
    const acc = (x) => A.createAccessor().setType(x.getType()).setArray(x.getArray().slice()).setNormalized(x.getNormalized()).setBuffer(buf);
    const s = A.createAnimationSampler().setInput(acc(sB.getInput())).setOutput(acc(sB.getOutput())).setInterpolation(sB.getInterpolation());
    anA.addSampler(s).addChannel(A.createAnimationChannel().setTargetNode(nodo).setTargetPath(c.getTargetPath()).setSampler(s));
    const a = viejo.get(c.getTargetNode().getName() + '/' + c.getTargetPath()), b = valores(sB.getOutput());
    if (!a || a.length !== b.length) { maxd = Infinity; continue; }   // otra cantidad de claves: no se compara
    if (c.getTargetPath() === 'rotation') {
      for (let i = 0; i < a.length; i += 4) {
        const d = Math.abs(a[i] * b[i] + a[i + 1] * b[i + 1] + a[i + 2] * b[i + 2] + a[i + 3] * b[i + 3]);
        maxd = Math.max(maxd, 2 * Math.acos(Math.min(1, d)) * 180 / Math.PI);
      }
    } else for (let i = 0; i < a.length; i++) maxd = Math.max(maxd, Math.abs(a[i] - b[i]) * 100);
  }
  cambio[anB.getName()] = maxd === Infinity ? 'otras claves' : +maxd.toFixed(2);
}
for (const n of nombres) if (!(n in cambio)) console.log('no está en', nuevo + ':', n);
for (const acc of rootA.listAccessors()) if (!acc.listParents().some((p) => p !== rootA)) acc.dispose();
await io.write(salida, A);
console.log('cambio máximo por clip:', JSON.stringify(cambio));
