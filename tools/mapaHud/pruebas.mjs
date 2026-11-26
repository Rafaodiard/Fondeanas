// Pruebas del mapa del juego (public/js/mapaHud.js): minimapa, mapa grande, brújula y marcas.
// Uso: node tools/mapaHud/pruebas.mjs  → tiene que terminar con "todo OK".
//   CAPTURAS=carpeta  además guarda capturas del mapa, del minimapa con la brújula y de una marca en el mundo.
// Necesita Playwright (en la nube viene instalado; en la PC: npm i -g playwright && npx playwright install chromium).
// 1) En Node: teclas sin choques, grilla, rumbo y distancias.
// 2) Servidor: las marcas pasan a la sala, se validan, se limitan y las recibe el que entra a mitad de partida.
// 3) Navegador: abrir y cerrar el mapa, poner, mover y sacar la marca con el mouse, zoom y arrastre, marcar mirando
//    al piso, haz y etiqueta en el mundo, minimapa y brújula.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 3000 + Math.floor(Math.random() * 900) + 50;
const CAPTURAS = process.env.CAPTURAS ? path.resolve(process.env.CAPTURAS) : null;
let fallas = 0;
const ok = (c, m) => { if (c) console.log('  ok ', m); else { fallas++; console.log('  MAL', m); } };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 1) Node ----------
console.log('Teclas y cuentas');
const datos = new Map();
globalThis.localStorage = { getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => datos.set(k, String(v)), removeItem: (k) => datos.delete(k) };
const C = await import(path.join(RAIZ, 'public/js/controles.js'));
const M = await import(path.join(RAIZ, 'public/js/mapaHud.js'));
await import(path.join(RAIZ, 'public/js/construir.js')).catch(() => {});
{
  const vistas = [];
  let choque = null;
  for (const a of C.listaAcciones()) for (const c of a.teclas) if (c) {
    for (const o of vistas) if (o.c === c && C.chocan(o.a, a)) choque = `${c} en "${o.a.nombre}" y "${a.nombre}"`;
    vistas.push({ a, c });
  }
  ok(!choque, `las teclas del mapa no chocan con ninguna otra${choque ? ': ' + choque : ''}`);
  ok(C.accion('mapa').teclas[0] === 'KeyM' && C.accion('marcar').teclas.includes('Mouse1'), 'el mapa se abre con M y se marca con el clic de la rueda (o T)');
  for (const ctx of ['combate', 'construccion', 'vehiculo']) ok(C.accionesDe('KeyM', ctx).includes('mapa'), `M abre el mapa también en ${ctx}`);
  ok(C.listaOpciones().some((o) => o.id === 'compartirMarcas') && C.opcion('compartirMarcas') === true, 'opción "Compartir tus marcas" (activada de fábrica)');
  ok(M.celdaDe(-600, -600, 1200) === 'A1' && M.celdaDe(599, 599, 1200) === 'J10' && M.celdaDe(0, 0, 1200) === 'F6', 'grilla A-J / 1-10');
  ok(Math.abs(M.rumbo(0, -1)) < 1e-9 && Math.abs(M.rumbo(1, 0) - Math.PI / 2) < 1e-9 && Math.abs(Math.abs(M.rumbo(0, 1)) - Math.PI) < 1e-9, 'rumbo: norte = -z, este = +x');
  ok(M.textoDistancia(87.4) === '87 m' && M.textoDistancia(1234) === '1,2 km', 'distancias en metros y km');
}

// ---------- 2) Servidor ----------
console.log('Servidor');
const server = spawn(process.execPath, ['server.js'], { cwd: RAIZ, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
process.on('exit', () => server.kill());
await espera(900);
const WebSocket = require(path.join(RAIZ, 'node_modules/ws'));
function cliente() {
  return new Promise((res) => {
    const ws = new WebSocket(`ws://localhost:${PORT}`);
    const c = { ws, msgs: [], manda: (m) => ws.send(JSON.stringify(m)) };
    ws.on('message', (d) => c.msgs.push(JSON.parse(d)));
    ws.on('open', () => res(c));
  });
}
const llega = async (c, f, ms = 3000) => { const t = Date.now(); while (Date.now() - t < ms) { const m = c.msgs.find(f); if (m) return m; await espera(20); } return null; };
{
  const a = await cliente(), b = await cliente();
  a.manda({ t: 'create', name: 'Ana' });
  const wa = await llega(a, (m) => m.t === 'welcome');
  b.manda({ t: 'join', name: 'Beto', code: wa.room.code });
  const wb = await llega(b, (m) => m.t === 'welcome');
  b.manda({ t: 'marca', p: [10, 2, 10] });
  await espera(200);
  ok(!a.msgs.some((m) => m.t === 'marca'), 'en la sala de espera no se marca');
  a.manda({ t: 'start' });
  await llega(b, (m) => m.t === 'matchStart');
  a.manda({ t: 'marca', p: [100, 3.456, -200] });
  const m1 = await llega(b, (m) => m.t === 'marca');
  ok(m1 && m1.id === wa.id && m1.p.join() === '100,3.5,-200', `la marca de Ana le llega a Beto (${JSON.stringify(m1)})`);
  ok(!a.msgs.some((m) => m.t === 'marca'), 'al que marca no le vuelve su propia marca');
  b.msgs.length = 0;
  for (const p of [[NaN, 0, 0], [5000, 0, 0], [0, 0], 'hola', [0, 900, 0]]) a.manda({ t: 'marca', p });
  await espera(300);
  ok(!b.msgs.some((m) => m.t === 'marca'), 'marcas inválidas o afuera de la isla no pasan');
  // el que entra en medio de la partida recibe las marcas que hay
  a.manda({ t: 'marca', p: [-50, 0, 60] });
  await llega(b, (m) => m.t === 'marca' && m.p?.[0] === -50);
  const c = await cliente();
  c.manda({ t: 'join', name: 'Caro', code: wa.room.code });
  const wc = await llega(c, (m) => m.t === 'welcome');
  ok(wc?.snap?.marcas?.some(([id, p]) => id === wa.id && p[0] === -50), 'el que entra a mitad de partida ve las marcas');
  a.manda({ t: 'marca', p: null });
  const m2 = await llega(b, (m) => m.t === 'marca' && m.p === null);
  ok(!!m2, 'sacar la marca le avisa a la sala');
  b.msgs.length = 0;
  await espera(1200); // se recargan las fichas
  for (let i = 0; i < 30; i++) a.manda({ t: 'marca', p: [i, 0, i] });
  await espera(400);
  const n = b.msgs.filter((m) => m.t === 'marca').length;
  ok(n >= 7 && n <= 10, `límite de marcas seguidas (${n} de 30 pasan)`);
  for (const x of [a, b, c]) x.ws.close();
  void wb;
}

// ---------- 3) Navegador ----------
console.log('Navegador');
const { chromium } = require('playwright');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: CAPTURAS ? 2 : 1 });
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__game && !document.getElementById('btnCreate').disabled, null, { timeout: 120000 });
  await page.fill('#name', 'Rafa');
  await page.evaluate(() => document.getElementById('btnCreate').click());
  await page.waitForFunction(() => !document.getElementById('lobby').classList.contains('hidden'), null, { timeout: 30000 });
  await page.evaluate(() => document.getElementById('btnStart').click());
  await page.waitForFunction(() => !document.getElementById('hud').classList.contains('hidden'), null, { timeout: 60000 });
  await espera(1500);
  if (CAPTURAS) {
    fs.mkdirSync(CAPTURAS, { recursive: true });
    await page.keyboard.press('KeyM');
    await page.waitForFunction(() => window.__game.mapa.abierto);
    await espera(2500);
    await page.screenshot({ path: path.join(CAPTURAS, 'mapa-bus.png'), timeout: 240000 });
    await page.keyboard.press('KeyM');
  }
  // saltar del bus y aparecer parado donde termina la tormenta (para no morir en ella mientras duran las pruebas)
  await page.waitForFunction(() => Date.now() + 0 > window.__game.room.bus.start + 500, null, { timeout: 20000 });
  await page.evaluate(() => {
    const g = window.__game, f = g.room.storm.phases.at(-1);
    let x = f.x, z = f.z;
    if (g.world.terrainHeight(x, z) < 0.5) {
      const p = g.world.pois.reduce((a, b) => (Math.hypot(b.x - f.x, b.z - f.z) < Math.hypot(a.x - f.x, a.z - f.z) ? b : a));
      x = p.x; z = p.z + 30;
    }
    g.sendMsg({ t: 'jump' });
    g.me.state = 'ground'; g.me.vel.set(0, 0, 0); g.me.minVy = 0; g.me.yaw = 0; g.me.pitch = -0.15;
    g.me.pos.set(x, g.world.groundHeight(x, z, 400), z);
  });
  await espera(2500);

  // minimapa y brújula
  const mini = await page.evaluate(() => {
    const cv = document.getElementById('minimap'), ctx = cv.getContext('2d');
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data, colores = new Set();
    for (let i = 0; i < d.length; i += 4 * 97) colores.add((d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4));
    const c = ctx.getImageData(cv.width / 2 - 2, cv.height / 2 - 2, 5, 5).data;
    let amarillo = 0; for (let i = 0; i < c.length; i += 4) if (c[i] > 200 && c[i + 1] > 170 && c[i + 2] < 120) amarillo++;
    return { colores: colores.size, amarillo, brujula: !document.getElementById('brujula').classList.contains('apagada') };
  });
  ok(mini.colores > 25, `el minimapa muestra la isla (${mini.colores} colores distintos)`);
  ok(mini.amarillo > 0, 'en el centro del minimapa está la flecha del jugador');
  ok(mini.brujula, 'la brújula se ve a pie');
  if (CAPTURAS) {
    await page.evaluate(() => window.__game.mapa.marcarEn(window.__game.me.pos.x + 60, window.__game.me.pos.z - 70));
    await espera(2500);
    await page.screenshot({ path: path.join(CAPTURAS, 'minimapa.png'), clip: { x: 880, y: 0, width: 400, height: 200 }, timeout: 240000 });
    await page.screenshot({ path: path.join(CAPTURAS, 'brujula.png'), clip: { x: 400, y: 0, width: 480, height: 60 }, timeout: 240000 });
    await page.screenshot({ path: path.join(CAPTURAS, 'marca-mundo.png'), timeout: 240000 });
    await page.evaluate(() => window.__game.mapa.ponerMarca(null));
  }

  // abrir el mapa con M
  await page.keyboard.press('KeyM');
  await page.waitForFunction(() => window.__game.mapa.abierto, null, { timeout: 5000 }).catch(() => {});
  await espera(1500);
  const abierto = await page.evaluate(() => ({
    abierto: window.__game.mapa.abierto, visible: !document.getElementById('mapaGrande').classList.contains('hidden'),
    mini: document.getElementById('minimap').classList.contains('hidden'),
  }));
  ok(abierto.abierto && abierto.visible && abierto.mini, 'M abre el mapa grande y esconde el minimapa');

  const punto = (nombre) => page.evaluate((n) => {
    const g = window.__game, p = g.world.pois.find((q) => q.name === n);
    const r = document.querySelector('.mg-lienzo').getBoundingClientRect(), s = g.mapa.aPantalla(p.x, p.z);
    return { x: r.left + s.x, y: r.top + s.y, wx: p.x, wz: p.z };
  }, nombre);
  const marcaMia = () => page.evaluate(() => { const g = window.__game, m = g.mapa.marcas.get(g.room.players.find((p) => p.name === 'Rafa').id); return m ? { x: m.x, z: m.z } : null; });
  const centro = await page.evaluate(() => { const r = document.querySelector('.mg-lienzo').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, wz: window.__game.me.pos.z }; });
  await page.mouse.click(centro.x + 40, centro.y - 30);
  await espera(600);
  let m = await marcaMia(), p;
  ok(m && m.z < centro.wz - 5, `clic en el mapa pone la marca (${m ? m.x.toFixed(0) + ', ' + m.z.toFixed(0) : 'no hay'})`);
  // mover la marca: clic en otro lugar (con la isla entera a la vista)
  for (let i = 0; i < 3; i++) await page.evaluate(() => document.querySelector('.mg-zoom [data-z="-1"]').click());
  await espera(800);
  p = await punto('Villa Cardo');
  await page.mouse.click(p.x, p.y);
  await espera(600);
  m = await marcaMia();
  ok(m && Math.hypot(m.x - p.wx, m.z - p.wz) < 6, `otro clic la mueve a Villa Cardo (a ${m ? Math.hypot(m.x - p.wx, m.z - p.wz).toFixed(1) : '?'} m del centro)`);
  const lado = await page.evaluate(() => ({ lista: document.querySelector('.mg-marcas').innerText, haz: window.__game.scene.children.filter((o) => o.material?.uniforms?.uFade).length }));
  ok(/Tu marca/.test(lado.lista) && /Villa Cardo/.test(lado.lista), `el panel lista la marca: "${lado.lista.replace(/\s+/g, ' ').trim()}"`);
  ok(lado.haz === 1, 'hay un haz de luz en el mundo');
  if (CAPTURAS) { await espera(1500); await page.screenshot({ path: path.join(CAPTURAS, 'mapa.png'), timeout: 240000 }); }
  // clic sobre la propia marca la saca
  await page.mouse.click(p.x + 2, p.y + 1);
  await espera(600);
  ok(!(await marcaMia()), 'clic sobre tu marca la saca');
  await page.mouse.click(p.x, p.y);
  await espera(400);
  await page.mouse.click(p.x + 100, p.y + 100, { button: 'right' });
  await espera(600);
  ok(!(await marcaMia()), 'clic derecho saca la marca');

  // zoom con la rueda y arrastrar
  const z0 = await page.evaluate(() => ({ ...window.__game.mapa.vista }));
  p = await punto('Altoplaza');
  await page.mouse.move(p.x, p.y);
  for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, -300); await espera(250); }
  const z1 = await page.evaluate(() => ({ ...window.__game.mapa.vista }));
  ok(z1.zoom > z0.zoom * 1.5, `la rueda acerca (zoom ${z0.zoom.toFixed(2)} → ${z1.zoom.toFixed(2)})`);
  const q = await punto('Altoplaza');
  ok(Math.hypot(q.x - p.x, q.y - p.y) < 6, 'el zoom se hace sobre el punto del mouse');
  await page.mouse.move(q.x, q.y); await page.mouse.down();
  await page.mouse.move(q.x + 80, q.y + 40, { steps: 6 }); await page.mouse.up();
  await espera(500);
  const z2 = await page.evaluate(() => ({ ...window.__game.mapa.vista, marca: window.__game.mapa.marcas.size }));
  ok(Math.hypot(z2.cx - z1.cx, z2.cz - z1.cz) > 5 && z2.marca === 0, 'arrastrar mueve el mapa sin poner una marca');
  if (CAPTURAS) {
    await page.mouse.click(q.x + 80 + 30, q.y + 40 - 20);
    await espera(2500);
    await page.screenshot({ path: path.join(CAPTURAS, 'mapa-zoom.png'), timeout: 240000 });
    await page.mouse.click(q.x + 80 + 30, q.y + 40 - 20);
  }
  await page.keyboard.press('Escape');
  await espera(500);
  ok(!(await page.evaluate(() => window.__game.mapa.abierto)), 'Esc cierra el mapa');
  await page.keyboard.press('KeyM'); await espera(300);
  await page.keyboard.press('KeyM'); await espera(300);
  ok(!(await page.evaluate(() => window.__game.mapa.abierto)), 'M lo abre y lo vuelve a cerrar');

  // marcar mirando al piso (tecla de marcar sin el mapa)
  ok((await page.evaluate(() => window.__game.me.state)) === 'ground', 'el jugador sigue vivo y parado');
  await page.evaluate(() => { const g = window.__game; g.me.pitch = -0.55; g.me.yaw = 0.3; });
  await espera(1800);
  const ping = await page.evaluate(() => {
    const g = window.__game, hizo = g.mapa.marcar();
    const m = [...g.mapa.marcas.values()][0];
    return { hizo, d: m ? Math.hypot(m.x - g.me.pos.x, m.z - g.me.pos.z) : -1, y: m?.y, suelo: m ? g.world.groundHeight(m.x, m.z, m.y + 1) : 0 };
  });
  ok(ping.hizo && ping.d > 1 && ping.d < 60 && Math.abs(ping.y - ping.suelo) < 1.5, `marcar mirando al piso pone la marca ahí (a ${ping.d.toFixed(1)} m, altura ${ping.y?.toFixed(1)} sobre suelo ${ping.suelo.toFixed(1)})`);
  await espera(1500);
  const et = await page.evaluate(() => { const e = document.querySelector('.marca-et'); return e ? { texto: e.innerText.replace(/\s+/g, ' ').trim(), r: e.querySelector('.mc').getBoundingClientRect().toJSON() } : null; });
  ok(et && /\d+ m/.test(et.texto) && et.r.top > 0 && et.r.bottom < 720, `etiqueta con la distancia en pantalla ("${et?.texto}")`);
  await page.evaluate(() => window.__game.mapa.marcar());
  await espera(300);
  ok((await page.evaluate(() => window.__game.mapa.marcas.size)) === 0, 'marcar otra vez el mismo lugar la saca');
  ok(errores.length === 0, `sin errores en la página${errores.length ? ': ' + errores.join(' | ') : ''}`);
} finally {
  await browser.close();
  server.kill();
}
console.log(fallas ? `\n${fallas} pruebas fallaron` : '\ntodo OK');
process.exit(fallas ? 1 : 0);
