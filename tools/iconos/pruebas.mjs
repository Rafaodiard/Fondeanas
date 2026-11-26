// Pruebas de las fotos de la barra de items (public/js/iconos.js) en un navegador de verdad.
// Uso: node tools/iconos/pruebas.mjs  → tiene que terminar con "todo OK".
//   CAPTURAS=carpeta  además guarda la hoja con todos los íconos y una captura de la barra en partida.
// Necesita Playwright (en la nube viene instalado; en la PC: npm i -g playwright && npx playwright install chromium).
// Levanta server.js en otro puerto, abre el juego, revisa que cada arma (en cada rareza), el pico y cada objeto de
// curación tengan su foto, que la foto no esté vacía ni cortada contra el borde, y que la barra de items las muestre.
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

const server = spawn(process.execPath, ['server.js'], { cwd: RAIZ, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
process.on('exit', () => server.kill());
await espera(800);

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: CAPTURAS ? 2 : 1 });
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__game && !document.getElementById('btnCreate').disabled, null, { timeout: 120000 });
  ok(errores.length === 0, `el juego carga sin errores${errores.length ? ': ' + errores.join(' | ') : ''}`);

  // 1) cada foto: existe, tiene algo dibujado, no toca el borde y el arma ocupa el ancho
  const fotos = await page.evaluate(async () => {
    const { iconoDe, iconoPico, ICONO } = await import('/js/iconos.js');
    const { WEAPONS, CONSUMABLES } = await import('/js/items.js');
    const lista = [{ nombre: 'pico', url: iconoPico(), arma: true }];
    for (const w of Object.keys(WEAPONS)) for (const r of WEAPONS[w].rarities) lista.push({ nombre: `${w} r${r}`, url: iconoDe({ kind: 'weapon', w, rarity: r }), arma: true });
    for (const c of Object.keys(CONSUMABLES)) lista.push({ nombre: c, url: iconoDe({ kind: 'consumable', c }) });
    const cv = document.createElement('canvas');
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    for (const f of lista) {
      if (!f.url) continue;
      const img = new Image();
      img.src = f.url;
      await img.decode();
      cv.width = img.width; cv.height = img.height;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
      let lleno = 0, borde = 0, x0 = cv.width, x1 = 0, y0 = cv.height, y1 = 0, r = 0, g = 0, b = 0;
      for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
        const i = (y * cv.width + x) * 4, a = d[i + 3];
        if (a < 40) continue;
        lleno++; r += d[i]; g += d[i + 1]; b += d[i + 2];
        if (x === 0 || y === 0 || x === cv.width - 1 || y === cv.height - 1) borde++;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      Object.assign(f, { ancho: img.width, alto: img.height, lleno: lleno / (cv.width * cv.height), borde, anchoUsado: (x1 - x0 + 1) / cv.width, altoUsado: (y1 - y0 + 1) / cv.height, brillo: lleno ? (r + g + b) / (3 * lleno) : 0 });
    }
    return { lista, ICONO };
  });
  for (const f of fotos.lista) {
    if (!f.url) { ok(false, `${f.nombre}: tiene foto`); continue; }
    const usa = Math.max(f.anchoUsado, f.altoUsado);
    ok(f.ancho === fotos.ICONO.ancho && f.alto === fotos.ICONO.alto && f.lleno > 0.04 && f.borde === 0 && usa > 0.75 && f.brillo > 35,
      `${f.nombre}: foto ${f.ancho}×${f.alto}, ${(f.lleno * 100).toFixed(0)}% dibujado, ocupa ${(usa * 100).toFixed(0)}%, brillo ${f.brillo.toFixed(0)}, ${f.borde} px en el borde`);
  }
  // las rarezas de un arma son fotos distintas (la franja de color cambia)
  const rifles = new Set(fotos.lista.filter((f) => f.nombre.startsWith('rifle ')).map((f) => f.brillo.toFixed(2)));
  ok(rifles.size > 1, 'el rifle cambia de color según la rareza');

  if (CAPTURAS) {
    fs.mkdirSync(CAPTURAS, { recursive: true });
    // hoja con todas las fotos sobre el fondo de cada rareza
    const hoja = await browser.newPage({ viewport: { width: 1180, height: 760 }, deviceScaleFactor: 2 });
    const blobs = await page.evaluate(async (l) => Promise.all(l.map(async (f) => {
      const b = await (await fetch(f.url)).blob();
      return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
    })), fotos.lista);
    const celdas = fotos.lista.map((f, i) => `<figure><img src="${blobs[i]}"><figcaption>${f.nombre}</figcaption></figure>`).join('');
    await hoja.setContent(`<style>body{margin:0;padding:16px;background:#1b2233;font:12px system-ui;color:#ddd;display:flex;flex-wrap:wrap;gap:10px}
      figure{margin:0;background:linear-gradient(#3a4560,#262e42);border-radius:8px;padding:4px}img{width:216px;height:144px;display:block}figcaption{text-align:center}</style>${celdas}`);
    await hoja.screenshot({ path: path.join(CAPTURAS, 'iconos-hoja.png'), fullPage: true });
  }

  // 2) en partida: la barra muestra una foto por cosa que tenés
  await page.click('#btnBots');
  await page.waitForFunction(() => window.__game.room && !document.getElementById('hud')?.classList.contains('hidden'), null, { timeout: 60000 }).catch(() => {});
  await espera(1500);
  const barra = await page.evaluate(async () => {
    const g = window.__game;
    const poner = () => {
      g.me.slots = [
        { kind: 'weapon', w: 'rifle', rarity: 4, mag: 30 },
        { kind: 'weapon', w: 'escopeta', rarity: 2, mag: 5 },
        { kind: 'weapon', w: 'francotirador', rarity: 3, mag: 1 },
        { kind: 'consumable', c: 'frasco', count: 3 },
        { kind: 'consumable', c: 'botiquin', count: 1 },
      ];
      g.me.ammo = { media: 120, cartuchos: 20, pesada: 8 };
      g.me.sel = 0;
      g.updateSlots();
    };
    poner();
    window.__ponerSlots = poner;
    await new Promise((r) => setTimeout(r, 300));
    const imgs = [...document.querySelectorAll('#slots .slot img.ic')];
    await Promise.all(imgs.map((i) => i.decode().catch(() => {})));
    return { mano: document.getElementById('itemMano').innerText.replace(/\s+/g, ' ').trim(), nombresOcultos: [...document.querySelectorAll('#slots .slot.foto .n')].every((n) => getComputedStyle(n).display === 'none'), slots: document.querySelectorAll('#slots .slot').length, fotos: imgs.length, cargadas: imgs.filter((i) => i.complete && i.naturalWidth > 0).length, tamano: imgs[1] ? [imgs[1].clientWidth, imgs[1].clientHeight] : null };
  });
  ok(barra.slots === 6 && barra.fotos === 6 && barra.cargadas === 6, `la barra tiene ${barra.fotos} fotos cargadas de ${barra.slots} lugares (pico + 5)`);
  ok(/rifle de asalto legendaria/i.test(barra.mano), `al costado de la barra dice lo que tenés en la mano: "${barra.mano}"`);
  ok(barra.nombresOcultos, 'los lugares con foto no tapan la foto con el nombre');
  ok(barra.tamano && barra.tamano[0] >= 60 && barra.tamano[1] >= 35, `cada foto se ve a ${barra.tamano?.join('×')} px`);
  if (CAPTURAS) {
    await page.evaluate(() => window.__ponerSlots());
    const caja = await page.locator('#inventario').boundingBox();
    await page.screenshot({ path: path.join(CAPTURAS, 'iconos-barra.png'), clip: { x: caja.x - 30, y: caja.y - 30, width: caja.width + 60, height: caja.height + 50 } });
    await page.screenshot({ path: path.join(CAPTURAS, 'iconos-partida.png') });
  }
  ok(errores.length === 0, `sin errores en la partida${errores.length ? ': ' + errores.join(' | ') : ''}`);
} finally {
  await browser.close();
  server.kill();
}
console.log(fallas ? `\n${fallas} pruebas fallaron` : '\ntodo OK');
process.exit(fallas ? 1 : 0);
