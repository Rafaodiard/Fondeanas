// Pruebas del menú con cuentas (public/js/menu.js) en un navegador de verdad.
// Uso: node tools/menu/pruebas.mjs  → tiene que terminar con "todo OK".
//   CAPTURAS=carpeta  además guarda una captura de cada pestaña.
// Levanta server.js en otro puerto con una carpeta de datos temporal y una cuenta admin, crea una cuenta desde la
// pantalla, compra en la tienda, equipa, abre una caja, apuesta, usa el panel admin y entra a una partida con bots
// para ver que el personaje sale con las skins de la cuenta.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 3000 + Math.floor(Math.random() * 900) + 50;
const CAPTURAS = process.env.CAPTURAS ? path.resolve(process.env.CAPTURAS) : null;
const DATOS = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-menu-'));
let fallas = 0;
const ok = (c, m) => { if (c) console.log('  ok ', m); else { fallas++; console.log('  MAL', m); } };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn(process.execPath, ['server.js'], {
  cwd: RAIZ, stdio: 'ignore',
  env: { ...process.env, PORT: String(PORT), SF_DATOS: DATOS, SF_ADMIN_USUARIO: 'Admin', SF_ADMIN_CLAVE: 'clave-admin-123', SF_LIMITE_LOGIN: '1000' },
});
let cerrado = false;
const cerrar = () => { if (cerrado) return; cerrado = true; server.kill(); };
process.on('exit', cerrar);
await espera(900);

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const foto = async (page, nombre) => {
  if (!CAPTURAS) return;
  fs.mkdirSync(CAPTURAS, { recursive: true });
  await page.screenshot({ path: path.join(CAPTURAS, `menu-${nombre}.png`), timeout: 120000 });
};
const pavos = (page) => page.evaluate(() => window.__menu.sesion.cuenta?.pavos);
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: CAPTURAS ? 2 : 1 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text().slice(0, 300)); });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__menu && window.__game && !document.getElementById('btnCreate').disabled);

  // 1) sin sesión aparece crear cuenta
  ok(await page.isVisible('#login'), 'sin sesión se ofrece crear cuenta');
  await page.fill('#lgUsuario', 'Pepita');
  await page.fill('#lgClave', 'secreta1');
  await page.click('#lgOk');
  await page.waitForFunction(() => window.__menu.sesion.cuenta);
  ok(await pavos(page) === 1000, 'la cuenta nueva arranca con 1000 pavos');
  ok(await page.inputValue('#name') === 'Pepita', 'el nombre del menú es el de la cuenta');
  await espera(1500);
  await foto(page, 'jugar');

  // 2) tienda
  await page.click('[data-p="tienda"]');
  const nTienda = await page.locator('#p-tienda .tarjeta').count();
  ok(nTienda === 8, `la tienda muestra 8 skins (${nTienda})`);
  await page.waitForFunction(() => document.querySelectorAll('#p-tienda .tarjeta img.lista').length >= 8, null, { timeout: 240000 });
  ok(true, 'las fotos de las tarjetas se sacan');
  const barata = await page.evaluate(async () => {
    const { SKIN, precio } = await import('/js/skins.js');
    const c = window.__menu.sesion.cuenta;
    return [...c.tienda.diarios, ...c.tienda.destacados].filter((id) => precio(SKIN[id]) <= c.pavos).sort((a, b) => precio(SKIN[a]) - precio(SKIN[b]))[0];
  });
  ok(!!barata, `hay una skin que alcanza (${barata})`);
  await page.click(`#p-tienda .tarjeta[data-id="${barata}"]`);
  await espera(400);
  await foto(page, 'tienda');
  await page.click('#detalle [data-acc="comprar"]');
  await page.waitForFunction((id) => window.__menu.sesion.cuenta.skins.includes(id), barata);
  ok(await pavos(page) < 1000, `compró ${barata} y bajaron los pavos (${await pavos(page)})`);
  // reroll
  const antesReroll = await page.evaluate(() => JSON.stringify(window.__menu.sesion.cuenta.tienda.diarios));
  await page.click('#btnReroll');
  await page.waitForFunction((a) => JSON.stringify(window.__menu.sesion.cuenta.tienda.diarios) !== a, antesReroll);
  ok(true, 'el reroll cambia la tienda');

  // 3) casillero: equipar lo comprado
  const tipo = await page.evaluate(async (id) => (await import('/js/skins.js')).SKIN[id].tipo, barata);
  await page.click('[data-p="casillero"]');
  await page.click(`.subpest [data-t="${tipo}"]`);
  await page.click(`#p-casillero .tarjeta[data-id="${barata}"]`);
  await page.click('#detalle [data-acc="equipar"]');
  await page.waitForFunction(([t, id]) => window.__menu.sesion.cuenta.equipo[t] === id, [tipo, barata]);
  ok(true, `equipó ${barata} como ${tipo}`);
  await espera(800);
  await foto(page, 'casillero');

  // 4) caja
  await page.evaluate(() => window.__menu.api('cuenta'));
  await page.click('[data-p="cajas"]');
  await foto(page, 'cajas');
  const p0 = await pavos(page);
  await page.click('#p-cajas .caja:first-child [data-abrir]');
  await page.waitForSelector('#cinta .c-item');
  await espera(2500);
  await foto(page, 'ruleta');
  // con un navegador lento la ruleta puede haber terminado sola mientras se sacaba la captura
  if ((await page.textContent('#rlSaltar')) === 'Saltar') await page.click('#rlSaltar');
  await page.waitForSelector('#rlPremio.ver');
  const premio = await page.textContent('#rlPremio b');
  ok(!!premio, `la caja dio: ${premio}`);
  await foto(page, 'premio');
  await page.click('#rlSaltar');
  ok(await pavos(page) !== p0, 'la caja cobró');

  // 5) cara o cruz
  await page.click('[data-p="apuestas"]');
  await page.fill('#apMonto', '10');
  const p1 = await pavos(page);
  await page.click('[data-lado="cara"]');
  await page.waitForFunction(() => /Salió/.test(document.getElementById('apRes')?.textContent || ''));
  const p2 = await pavos(page);
  ok(Math.abs(p2 - p1) === 10, `cara o cruz mueve 10 pavos (${p1} → ${p2})`);
  await foto(page, 'apuestas');
  ok(!(await page.isVisible('[data-p="admin"]')), 'una cuenta común no ve Admin');

  // 6) admin desde otra ventana
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: CAPTURAS ? 2 : 1 });
  const adm = await ctx2.newPage();
  adm.setDefaultTimeout(120000);
  await adm.goto(`http://localhost:${PORT}/`);
  await adm.waitForFunction(() => window.__menu && !document.getElementById('btnCreate').disabled);
  await adm.click('#lgCambiar');
  await adm.fill('#lgUsuario', 'Admin');
  await adm.fill('#lgClave', 'clave-admin-123');
  await adm.click('#lgOk');
  await adm.waitForFunction(() => window.__menu.sesion.cuenta?.admin);
  await adm.click('[data-p="admin"]');
  await adm.fill('#admBuscar', 'pep');
  await adm.waitForSelector('[data-u="Pepita"]');
  await adm.click('[data-u="Pepita"]');
  await adm.waitForSelector('#admDarPavos');
  await adm.fill('#admPavos', '500');
  const p3 = await pavos(page);
  await adm.click('#admDarPavos');
  await adm.waitForFunction(() => /Listo/.test(document.getElementById('admMsg')?.textContent || ''));
  await foto(adm, 'admin');
  const p4 = await page.evaluate(async () => (await window.__menu.api('cuenta')).cuenta.pavos);
  ok(p4 === p3 + 500, `el admin le dio 500 pavos (${p3} → ${p4})`);
  await ctx2.close();

  // 7) a jugar con bots: el personaje sale con las skins de la cuenta
  await page.click('[data-p="jugar"]');
  const equipo = await page.evaluate(() => window.__menu.sesion.cuenta.equipo);
  await page.click('#btnBots');
  await page.waitForFunction(() => window.__game.room?.phase && window.__game.room.phase !== 'lobby' && window.__game.me.mesh, null, { timeout: 120000 });
  const sk = await page.evaluate(() => window.__game.me.mesh.userData.sk);
  ok(JSON.stringify(sk) === JSON.stringify(equipo), `en la partida el personaje tiene las skins puestas (${JSON.stringify(sk)})`);
  const botsConSkins = await page.evaluate(() => [...window.__game.others.values()].filter((o) => o.mesh.userData.sk?.personaje && o.mesh.userData.sk.personaje !== 'recluta').length);
  ok(botsConSkins > 0, `los bots salen con skins (${botsConSkins})`);
  ok(errores.length === 0, `sin errores en la página${errores.length ? ': ' + [...new Set(errores)].slice(0, 4).join(' | ') : ''}`);
} finally {
  await browser.close();
  cerrar();
  await espera(300);
  fs.rmSync(DATOS, { recursive: true, force: true });
}
console.log(fallas ? `${fallas} pruebas fallaron` : 'todo OK');
process.exit(fallas ? 1 : 0);
