// Pruebas de cuentas, saldo, casino con la base, pavos por eliminación y tienda (server/), con una base en memoria.
// También levanta el servidor de verdad en un puerto libre y prueba la API por HTTP y la sesión en el WebSocket.
// Uso: node --disable-warning=ExperimentalWarning tools/cuentas/pruebas.mjs  → tiene que terminar con "todo OK".
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { abrirDB, PAVOS_INICIALES, SinSaldo } from '../../server/db.js';
import { crearCuentas, leerCookies, cookieSesion } from '../../server/cuentas.js';
import { crearCasino } from '../../server/casino.js';
import { crearTienda } from '../../server/tienda.js';
import { crearPremios, PAVOS_POR_KILL, TOPE_KILLS_24H } from '../../server/premios.js';
import { SKINS } from '../../public/js/skins.js';

let fallas = 0;
async function prueba(nombre, fn) {
  try { await fn(); console.log('  ok ', nombre); } catch (e) { fallas++; console.log('  MAL', nombre, '\n     ', e.stack.split('\n').slice(0, 3).join('\n      ')); }
}
const rechaza = async (p, codigo) => { try { await p; } catch (e) { if (codigo) assert.equal(e.codigo, codigo, e.message); return e; } assert.fail(`tenía que fallar (${codigo})`); };

function nuevo() {
  const base = abrirDB(':memory:');
  return { base, cuentas: crearCuentas(base) };
}

await prueba('registro: 1000 pavos de bienvenida y queda el movimiento', async () => {
  const { base, cuentas } = nuevo();
  const r = await cuentas.registrar('Lucas_1', 'clave-segura', '1.1.1.1');
  assert.equal(r.usuario.pavos, PAVOS_INICIALES);
  assert.equal(r.usuario.usuario, 'Lucas_1');
  const m = base.db.prepare('SELECT delta, saldo, motivo FROM movimientos').all();
  assert.deepEqual(m.map((x) => ({ ...x })), [{ delta: 1000, saldo: 1000, motivo: 'bienvenida' }]);
});
await prueba('registro: usuario inválido, contraseña corta, usuario repetido (sin importar mayúsculas)', async () => {
  const { cuentas } = nuevo();
  await rechaza(cuentas.registrar('ab', '12345678'), 'usuario_invalido');
  await rechaza(cuentas.registrar('con espacio', '12345678'), 'usuario_invalido');
  await rechaza(cuentas.registrar('<script>', '12345678'), 'usuario_invalido');
  await rechaza(cuentas.registrar('pepe', '1234567'), 'pass_corta');
  await rechaza(cuentas.registrar('pepe', 123456789), 'pass_corta');
  await cuentas.registrar('Pepe', '12345678');
  await rechaza(cuentas.registrar('pepe', '12345678'), 'usuario_tomado');
});
await prueba('registro: tope de cuentas nuevas por conexión', async () => {
  const { cuentas } = nuevo();
  for (let i = 0; i < 5; i++) await cuentas.registrar(`u${i}xx`, '12345678', '9.9.9.9');
  await rechaza(cuentas.registrar('otra_mas', '12345678', '9.9.9.9'), 'limite');
  await cuentas.registrar('otra_mas', '12345678', '8.8.8.8');
});
await prueba('login: bien, contraseña mal, usuario que no existe, sesión y salir', async () => {
  const { cuentas } = nuevo();
  await cuentas.registrar('ana', 'contraseña-larga');
  const r = await cuentas.entrar('ANA', 'contraseña-larga');
  assert.equal(r.usuario.usuario, 'ana');
  assert.equal(cuentas.deToken(r.token).usuario, 'ana');
  await rechaza(cuentas.entrar('ana', 'otra-cosa-mal'), 'credenciales');
  await rechaza(cuentas.entrar('nadie', 'contraseña-larga'), 'credenciales');
  await rechaza(cuentas.entrar({ $ne: 1 }, 'x'), 'credenciales');
  assert.equal(cuentas.deToken('inventado'), null);
  assert.equal(cuentas.deToken(undefined), null);
  cuentas.salir(r.token);
  assert.equal(cuentas.deToken(r.token), null);
});
await prueba('login: después de 10 intentos por minuto se frena', async () => {
  const { cuentas } = nuevo();
  await cuentas.registrar('beto', '12345678');
  for (let i = 0; i < 10; i++) await rechaza(cuentas.entrar('beto', 'malmalmal', '2.2.2.2'), 'credenciales');
  await rechaza(cuentas.entrar('beto', '12345678', '3.3.3.3'), 'limite'); // por usuario, aunque cambie la IP
});
await prueba('sesión vencida no sirve', async () => {
  const { base, cuentas } = nuevo();
  const r = await cuentas.registrar('vieja', '12345678');
  base.db.prepare('UPDATE sesiones SET vence = 1').run();
  assert.equal(cuentas.deToken(r.token), null);
});
await prueba('la contraseña no se guarda en texto', async () => {
  const { base, cuentas } = nuevo();
  await cuentas.registrar('caro', 'mi-clave-123');
  const f = base.db.prepare('SELECT hash, sal FROM usuarios').get();
  assert.ok(!f.hash.includes('mi-clave') && f.hash.length === 128 && f.sal.length === 32);
});
await prueba('cookies: leer y armar', () => {
  assert.deepEqual(leerCookies('a=1; sf_sesion=abc%2Bd; x'), { a: '1', sf_sesion: 'abc+d' });
  assert.match(cookieSesion('t', true), /HttpOnly; SameSite=Lax; Secure; Max-Age=2592000/);
  assert.match(cookieSesion(null, false), /sf_sesion=; .*Max-Age=0/);
});

await prueba('saldo: nunca queda negativo, ni con muchas apuestas seguidas', async () => {
  const { base, cuentas } = nuevo();
  const { usuario } = await cuentas.registrar('dani', '12345678');
  const casino = crearCasino(base, () => 1); // siempre sale el 1 (rojo): las apuestas al negro pierden
  let perdidas = 0;
  for (let i = 0; i < 30; i++) {
    try { casino.ruleta(usuario.id, [{ tipo: 'negro', monto: 100 }]); } catch (e) { assert.ok(e instanceof SinSaldo); perdidas++; }
  }
  assert.equal(base.saldo(usuario.id), 0);
  assert.equal(perdidas, 20);
  assert.throws(() => base.mover(usuario.id, -1, 'x'), SinSaldo);
  // el CHECK de la tabla también lo impide aunque alguien se saltee mover()
  assert.throws(() => base.db.prepare('UPDATE usuarios SET pavos = -5 WHERE id = ?').run(usuario.id));
});
await prueba('saldo: la suma de los movimientos da el saldo', async () => {
  const { base, cuentas } = nuevo();
  const { usuario } = await cuentas.registrar('eva', '12345678');
  const casino = crearCasino(base);
  for (let i = 0; i < 40; i++) {
    try { casino.slots(usuario.id, 20); casino.ruleta(usuario.id, [{ tipo: 'rojo', monto: 10 }, { tipo: 'numero', n: i % 37, monto: 5 }]); } catch { /* sin saldo */ }
  }
  const s = base.db.prepare('SELECT SUM(delta) AS s FROM movimientos WHERE usuario_id = ?').get(usuario.id).s;
  assert.equal(s, base.saldo(usuario.id));
});
await prueba('casino: montos inválidos no tocan el saldo', async () => {
  const { base, cuentas } = nuevo();
  const { usuario } = await cuentas.registrar('fede', '12345678');
  const c = crearCasino(base);
  for (const m of [0, 5, 501, -10, 10.5, '20', null]) assert.throws(() => c.slots(usuario.id, m), /apuesta/);
  assert.throws(() => c.ruleta(usuario.id, [{ tipo: 'rojo', monto: 9 }]));
  assert.throws(() => c.blackjackRepartir(usuario.id, 1000));
  assert.equal(base.saldo(usuario.id), 1000);
});
await prueba('blackjack con la base: la mano queda guardada, no se reparte otra encima y se paga al terminar', async () => {
  const { base, cuentas } = nuevo();
  const { usuario } = await cuentas.registrar('gabi', '12345678');
  const c = crearCasino(base);
  let r;
  // repartir hasta que salga una mano que siga en juego (sin blackjack de entrada)
  do { r = c.blackjackRepartir(usuario.id, 100); } while (r.mano.fase !== 'jugando');
  const antes = r.saldo;
  assert.throws(() => c.blackjackRepartir(usuario.id, 100), /Terminá la mano/);
  // otra "pestaña": la mano sigue ahí
  const c2 = crearCasino(base);
  assert.deepEqual(c2.blackjackEstado(usuario.id).mano.manos, r.mano.manos);
  r = c2.blackjackJugar(usuario.id, 'plantarse');
  assert.equal(r.mano.fase, 'terminada');
  assert.equal(r.saldo, antes + r.mano.premio);
  assert.throws(() => c.blackjackJugar(usuario.id, 'pedir'), /No hay una mano/);
});
await prueba('blackjack con la base: doblar sin saldo no deja la mano a medias', async () => {
  const { base, cuentas } = nuevo();
  const { usuario } = await cuentas.registrar('hugo', '12345678');
  const c = crearCasino(base);
  base.mover(usuario.id, -(1000 - 100), 'prueba');
  let r;
  for (;;) {
    r = c.blackjackRepartir(usuario.id, 100);
    if (r.mano.fase === 'jugando' && r.mano.acciones.includes('doblar') && r.saldo === 0) break;
    if (r.mano.fase === 'jugando') r = c.blackjackJugar(usuario.id, 'plantarse');
    if (r.saldo < 100) base.mover(usuario.id, 100 - r.saldo, 'prueba');
    else if (r.saldo > 100) base.mover(usuario.id, -(r.saldo - 100), 'prueba');
  }
  const mano = JSON.stringify(c.blackjackEstado(usuario.id).mano);
  assert.throws(() => c.blackjackJugar(usuario.id, 'doblar'), SinSaldo);
  assert.equal(JSON.stringify(c.blackjackEstado(usuario.id).mano), mano);
  assert.equal(c.blackjackJugar(usuario.id, 'plantarse').mano.fase, 'terminada');
});

await prueba('eliminaciones: pagan 100 a las cuentas y respetan las reglas contra el farmeo', async () => {
  const { base, cuentas } = nuevo();
  const pr = crearPremios(base);
  const a = (await cuentas.registrar('asesino', '12345678')).usuario;
  const b = (await cuentas.registrar('victima', '12345678')).usuario;
  const A = { cuenta: a, ip: '1.1.1.1' }, B = { cuenta: b, ip: '1.1.1.1' };
  const invitadoLejos = { cuenta: null, ip: '5.5.5.5' }, invitadoMismaIp = { cuenta: null, ip: '1.1.1.1' };
  assert.equal(pr.pagarKill(A, B, 2).delta, PAVOS_POR_KILL, 'otra cuenta en la misma red (amigos en casa) paga');
  assert.equal(pr.pagarKill(A, invitadoLejos, 2).delta, PAVOS_POR_KILL);
  assert.equal(pr.pagarKill(A, invitadoMismaIp, 2).motivo, 'misma_ip');
  assert.equal(pr.pagarKill(A, A, 2).motivo, 'uno_mismo');
  assert.equal(pr.pagarKill(A, { cuenta: a, ip: '7.7.7.7' }, 2).motivo, 'uno_mismo');
  assert.equal(pr.pagarKill(A, B, 1).motivo, 'solo');
  assert.equal(pr.pagarKill(invitadoLejos, B, 2).motivo, 'invitado');
  assert.equal(pr.pagarKill(null, B, 2).motivo, 'invitado');
  assert.equal(base.saldo(a.id), 1000 + 200);
});
await prueba(`eliminaciones: tope de ${TOPE_KILLS_24H} pavos en 24 horas`, async () => {
  const { base, cuentas } = nuevo();
  const pr = crearPremios(base);
  const a = (await cuentas.registrar('farmer', '12345678')).usuario;
  const A = { cuenta: a, ip: '1' };
  let total = 0;
  for (let i = 0; i < 30; i++) total += pr.pagarKill(A, { cuenta: null, ip: `2.${i}` }, 4).delta;
  assert.equal(total, TOPE_KILLS_24H);
  // pasadas las 24 horas vuelve a pagar
  base.db.prepare("UPDATE movimientos SET fecha = fecha - 86500000 WHERE motivo = 'kill'").run();
  assert.equal(pr.pagarKill(A, { cuenta: null, ip: '3' }, 4).delta, PAVOS_POR_KILL);
});

await prueba('tienda: el catálogo de verdad está vacío', () => { assert.deepEqual(SKINS, []); });
await prueba('tienda: comprar y ponerse una skin (con un catálogo de prueba)', async () => {
  const { base, cuentas } = nuevo();
  const cat = [{ id: 'prueba', nombre: 'Prueba', rareza: 2, precio: 800, ropa: '#ff0000' }, { id: 'cara', nombre: 'Cara', rareza: 4, precio: 2000, ropa: '#000' }];
  const t = crearTienda(base, cat);
  const u = (await cuentas.registrar('ines', '12345678')).usuario;
  assert.throws(() => t.poner(u.id, 'prueba'), /no compraste/);
  assert.throws(() => t.comprar(u.id, 'cara'), SinSaldo);
  assert.throws(() => t.comprar(u.id, 'no-existe'), /no existe/);
  let e = t.comprar(u.id, 'prueba');
  assert.equal(e.saldo, 200); assert.deepEqual(e.compradas, ['prueba']);
  assert.throws(() => t.comprar(u.id, 'prueba'), /Ya tenés/);
  e = t.poner(u.id, 'prueba'); assert.equal(e.puesta, 'prueba');
  e = t.poner(u.id, null); assert.equal(e.puesta, null);
  // con el catálogo vacío la skin guardada ya no vale
  t.poner(u.id, 'prueba');
  assert.equal(crearTienda(base, []).puesta(u.id), null);
});

// ---------- El servidor de verdad (HTTP + WebSocket) ----------
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-pruebas-'));
const puerto = 3900 + Math.floor(Math.random() * 90);
const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { cwd: raiz, env: { ...process.env, PORT: String(puerto), SF_DB: path.join(dir, 'p.db') }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok, mal) => { srv.stdout.on('data', (d) => { if (String(d).includes('Salto Final en')) ok(); }); srv.on('exit', () => mal(new Error('el servidor no arrancó'))); setTimeout(() => mal(new Error('el servidor tardó demasiado')), 15000); });
const URLB = `http://localhost:${puerto}`;
async function pedir(ruta, cuerpo, cookie, extra = {}) {
  const r = await fetch(URLB + ruta, { method: cuerpo ? 'POST' : 'GET', headers: { ...(cuerpo ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...extra }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  return { estado: r.status, datos: await r.json().catch(() => null), cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
}

let galleta = '';
await prueba('API: registro, /api/yo, casino y salir', async () => {
  let r = await pedir('/api/yo');
  assert.equal(r.datos.cuenta, null);
  r = await pedir('/api/registro', { usuario: 'http_user', pass: '12345678' });
  assert.equal(r.estado, 200); assert.equal(r.datos.cuenta.pavos, 1000);
  galleta = r.cookie; assert.match(galleta, /^sf_sesion=/);
  r = await pedir('/api/yo', null, galleta); assert.equal(r.datos.cuenta.usuario, 'http_user');
  r = await pedir('/api/casino/slots', { monto: 50 }, galleta); assert.equal(r.estado, 200); assert.equal(r.datos.saldo, 950 + r.datos.premio);
  r = await pedir('/api/casino/slots', { monto: 50 }); assert.equal(r.estado, 401);
  r = await pedir('/api/casino/slots', { monto: 5000 }, galleta); assert.equal(r.estado, 400);
  r = await pedir('/api/tienda', null, galleta); assert.deepEqual(r.datos.catalogo, []);
  r = await pedir('/api/tienda/comprar', { skin: 'x' }, galleta); assert.equal(r.estado, 404);
});
await prueba('API: protege contra pedidos de otros sitios y basura', async () => {
  let r = await pedir('/api/casino/slots', { monto: 50 }, galleta, { Origin: 'https://malo.example' }); assert.equal(r.estado, 403);
  const raw = await fetch(URLB + '/api/casino/slots', { method: 'POST', headers: { Cookie: galleta, 'Content-Type': 'text/plain' }, body: '{"monto":50}' });
  assert.equal(raw.status, 415);
  const roto = await fetch(URLB + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{no' });
  assert.equal(roto.status, 400);
  const grande = await fetch(URLB + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x: 'a'.repeat(20000) }) }).catch(() => ({ status: 413 }));
  assert.equal(grande.status, 413);
  r = await pedir('/api/nada'); assert.equal(r.estado, 404);
  assert.equal((await fetch(URLB + '/%E0%A4%A')).status, 400);
  assert.equal((await fetch(URLB + '/index.html')).status, 200);
});
await prueba('WebSocket: con sesión entra con el nombre de la cuenta; sin sesión, como invitado', async () => {
  const { WebSocket } = await import('ws');
  const entrar = (cookie, name) => new Promise((ok, mal) => {
    const ws = new WebSocket(`ws://localhost:${puerto}`, { headers: cookie ? { Cookie: cookie } : {} });
    ws.on('open', () => ws.send(JSON.stringify({ t: 'create', name })));
    ws.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'welcome') { ws.close(); ok(m.room.players.find((p) => p.id === m.id)); } });
    ws.on('error', mal);
  });
  const conCuenta = await entrar(galleta, 'Otro nombre');
  assert.equal(conCuenta.name, 'http_user'); assert.equal(conCuenta.cuenta, true);
  const invitado = await entrar(null, 'Invitado9');
  assert.equal(invitado.name, 'Invitado9'); assert.equal(invitado.cuenta, false);
  // otro sitio no puede abrir el WebSocket con la cookie del jugador
  await assert.rejects(new Promise((ok, mal) => { const ws = new WebSocket(`ws://localhost:${puerto}`, { headers: { Cookie: galleta, Origin: 'https://malo.example' } }); ws.on('open', ok); ws.on('error', mal); }));
});
await prueba('API: salir borra la sesión', async () => {
  const r = await pedir('/api/salir', {}, galleta);
  assert.match(r.cookie, /^sf_sesion=$/);
  assert.equal((await pedir('/api/yo', null, galleta)).datos.cuenta, null);
});
srv.kill();
fs.rmSync(dir, { recursive: true, force: true });

console.log(fallas ? `${fallas} prueba(s) fallaron` : 'todo OK');
process.exit(fallas ? 1 : 0);
