// Capturas de la grilla de encastre en el juego de verdad (Playwright + swiftshader): una construcción armada pieza
// por pieza, la vista previa azul donde encaja y la roja (con el motivo) donde no.
// Uso: CAPTURAS=carpeta node tools/construccion/capturas.mjs  → guarda encastre_*.png en la carpeta.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.resolve(process.env.CAPTURAS || 'capturas');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 3000 + Math.floor(Math.random() * 900) + 50;
const server = spawn(process.execPath, ['server.js'], { cwd: RAIZ, env: { ...process.env, PORT: String(PORT), SF_MATS: '500' }, stdio: 'ignore' });
process.on('exit', () => server.kill());
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
await espera(800);

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('error en la página:', e.message));
await page.goto(`http://localhost:${PORT}/`);
await page.fill('#name', 'Constructor');
await page.click('#btnCreate');
await page.waitForFunction(() => document.querySelector('#btnStart')?.getClientRects().length, null, { timeout: 180000, polling: 500 });
await page.evaluate(() => document.querySelector('#btnStart').click());
await page.waitForFunction(() => window.__game?.room?.phase === 'playing', null, { timeout: 60000, polling: 500 });

// pararse en un lugar plano y armar: dos paredes, un piso arriba, una rampa y un techo
const info = await page.evaluate(async () => {
  const g = window.__game, w = g.world, G = 4;
  let L = null;
  for (let x = -300; x < 300 && !L; x += 8) for (let z = -300; z < 300 && !L; z += 8) {
    const i = Math.floor(x / G), j = Math.floor(z / G), hs = [];
    for (let a = -2; a <= 3; a++) for (let b = -3; b <= 3; b++) hs.push(w.terrainHeight((i + a) * G, (j + b) * G));
    if (Math.min(...hs) < 2 || Math.max(...hs) - Math.min(...hs) > 0.5) continue;
    let libre = true;
    w.sol.near((i + 0.5) * G, (j + 0.5) * G, G * 5, () => { libre = false; });
    if (libre) L = { i, j };
  }
  g.sendMsg({ t: 'jump' });
  await new Promise((r) => setTimeout(r, 300));
  const me = g.me, cx = L.i * G + G / 2, cz = L.j * G + G / 2;
  me.state = 'ground'; me.pos.set(cx, w.groundHeight(cx, cz), cz); me.vel.set(0, 0, 0);
  g.sendMsg({ t: 'state', p: [me.pos.x, me.pos.y, me.pos.z], r: 0, s: 'ground' });
  await new Promise((r) => setTimeout(r, 300));
  const { objetivoPieza } = await import('/js/construccion.js');
  const poner = async (tipo, yaw, pitch, giro = 0) => {
    const t = objetivoPieza(w, { pos: me.pos, yaw, pitch, mat: me.mat }, tipo, giro);
    g.sendMsg({ t: 'build', type: t.type, i: t.i, j: t.j, y: t.y, dir: t.dir, mat: me.mat });
    for (let k = 0; k < 40 && !w.structs.has(t.key); k++) await new Promise((r) => setTimeout(r, 50));
    return w.structs.has(t.key);
  };
  const r = [];
  r.push(await poner('pared', 0, 0)); // adelante (-Z)
  r.push(await poner('pared', Math.PI / 2, 0)); // a la izquierda (-X)
  r.push(await poner('piso', 0, 0.7)); // arriba de la cabeza, sobre las paredes
  r.push(await poner('rampa', -Math.PI / 2, 0)); // a la derecha, subiendo hacia +X
  me.mat = 'piedra';
  r.push(await poner('techo', 0, 0.5)); // arriba del piso
  return { L, r, y: me.pos.y };
});
console.log('construcción armada:', info.r.every(Boolean) ? 'todas las piezas aceptadas' : info.r);

// el jugador se para en (x, z) sobre lo que haya debajo de la altura y; la cámara de tercera persona mira desde atrás
async function foto(nombre, { tipo, yaw, pitch, pos }) {
  await page.evaluate(({ tipo, yaw, pitch, pos }) => {
    const g = window.__game, me = g.me;
    document.getElementById('clickToPlay')?.classList.add('hidden');
    me.pos.set(pos[0], g.world.groundHeight(pos[0], pos[2], pos[1]), pos[2]); me.vel.set(0, 0, 0);
    me.yaw = yaw; me.pitch = pitch;
    g.cons.accion({ pared: 'construirPared', piso: 'construirPiso', rampa: 'construirRampa', techo: 'construirTecho' }[tipo]);
  }, { tipo, yaw, pitch, pos });
  await espera(7000); // swiftshader: unos cuadros para que se acomode la cámara y se levanten las piezas
  await page.evaluate(() => document.getElementById('clickToPlay')?.classList.add('hidden'));
  await page.screenshot({ path: path.join(OUT, `encastre_${nombre}.png`) });
  console.log('  ', nombre);
}
const G = 4, cx = info.L.i * G + G / 2, cz = info.L.j * G + G / 2, y0 = info.y + 0.5;
const solo = process.env.SOLO;
// 1) desde afuera: la rampa que sube hasta el borde del piso de arriba (azul, encaja)
if (!solo || solo === 'encaja') await foto('encaja', { tipo: 'rampa', yaw: 0, pitch: 0.2, pos: [cx, y0, cz + G * 2] });
// 2) un piso arriba de la cabeza sin nada que lo sostenga: rojo, con el motivo en la ayuda
if (!solo || solo === 'no_encaja') await foto('no_encaja', { tipo: 'piso', yaw: 0.35, pitch: 0.5, pos: [cx + G * 3, y0, cz + G * 2] });
// 3) parado en la rampa: el piso de adelante va en su borde alto
if (!solo || solo === 'piso_rampa') await foto('piso_rampa', { tipo: 'piso', yaw: -Math.PI / 2, pitch: -0.45, pos: [cx + G * 1.25, y0 + 3, cz] });
await browser.close();
server.kill();
