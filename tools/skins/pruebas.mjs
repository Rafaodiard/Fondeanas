// Pruebas de la vitrina de skins (public/skins.html) en un navegador de verdad.
// Uso: node tools/skins/pruebas.mjs  → tiene que terminar con "todo OK".
//   CAPTURAS=carpeta  además guarda una captura por tipo de skin.
// Revisa que la página cargue sin errores (shaders de aspecto.js), que cada skin arme su personaje y que
// los accesorios cuelguen del hueso correcto (ni lejos del cuerpo ni en el piso).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 3000 + Math.floor(Math.random() * 900) + 50;
const CAPTURAS = process.env.CAPTURAS ? path.resolve(process.env.CAPTURAS) : null;
let fallas = 0;
const ok = (c, m) => { if (c) console.log('  ok ', m); else { fallas++; console.log('  MAL', m); } };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn(process.execPath, ['server.js'], { cwd: RAIZ, env: { ...process.env, PORT: String(PORT), SF_DATOS: path.join(RAIZ, 'datos-prueba-skins') }, stdio: 'ignore' });
process.on('exit', () => { server.kill(); fs.rmSync(path.join(RAIZ, 'datos-prueba-skins'), { recursive: true, force: true }); });
await espera(800);

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || /THREE\.WebGL/.test(m.text())) errores.push(m.text().slice(0, 400)); });
  await page.goto(`http://localhost:${PORT}/skins.html?pausa`);
  await page.waitForFunction(() => window.SKINS && window.SKINS.ready, null, { timeout: 120000 });
  page.setDefaultTimeout(240000);
  for (const tipo of ['personaje', 'mochila', 'pico', 'planeador', 'envoltorio']) {
    const r = await page.evaluate(async (tipo) => {
      const THREE = await import('three');
      SKINS.mostrar(tipo);
      for (let i = 0; i < 4; i++) SKINS.animar(0.05);
      const malos = [];
      for (const c of SKINS.actuales) {
        c.updateMatrixWorld(true);
        const base = new THREE.Vector3().setFromMatrixPosition(c.matrixWorld);
        for (const a of c.userData.accs || []) {
          const b = new THREE.Box3().setFromObject(a);
          if (b.isEmpty()) { malos.push(`${c.userData.sk?.[tipo]}: ${a.name} vacío`); continue; }
          const ctr = b.getCenter(new THREE.Vector3()).sub(base);
          if (Math.hypot(ctr.x, ctr.z) > 1.2 || ctr.y < 0.3 || ctr.y > 3.2) malos.push(`${c.userData.sk?.[tipo]}: ${a.name} en ${ctr.toArray().map((v) => v.toFixed(2))}`);
        }
      }
      return { n: SKINS.actuales.length, malos, foto: SKINS.foto() };
    }, tipo);
    ok(r.n > 0 && r.malos.length === 0, `${tipo}: ${r.n} skins armadas${r.malos.length ? ' — ' + r.malos.slice(0, 6).join(' | ') : ''}`);
    if (CAPTURAS) { fs.mkdirSync(CAPTURAS, { recursive: true }); fs.writeFileSync(path.join(CAPTURAS, `skins-${tipo}.png`), Buffer.from(r.foto.split(',')[1], 'base64')); }
  }
  ok(errores.length === 0, `sin errores en la página${errores.length ? ': ' + [...new Set(errores)].slice(0, 4).join(' | ') : ''}`);
} finally {
  await browser.close();
}
console.log(fallas ? `${fallas} pruebas fallaron` : 'todo OK');
process.exit(fallas ? 1 : 0);
