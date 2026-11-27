// Pruebas de cuentas, tienda, cajas, apuestas, admin y pavos por partida.
// Uso: node tools/cuentas/pruebas.mjs
// 1) la lógica sola (servidor/cuentas.js y public/js/tienda.js) con una carpeta temporal y azar con semilla
// 2) el servidor de verdad (server.js en otro puerto, con SF_DATOS temporal y una cuenta admin por variables de entorno):
//    la API HTTP, los permisos, que las cuentas sobrevivan a un reinicio y que al jugar con sesión se vean las skins
// 3) solo si existe PRUEBA_DATABASE_URL (un Postgres de prueba, se usa la tabla sf_datos): guardar y leer en Postgres
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';
import { Cuentas, claveCorrecta } from '../../servidor/cuentas.js';
import { SKIN, SKINS, GRATIS, PRECIOS, precio, equipoValido, EQUIPO_INICIAL } from '../../public/js/skins.js';
import {
  CAJAS, CAJA, probabilidades, tirarCaja, poolCaja, rotacion, rng, costoReroll, diaDe, contratoValido, premioPartida, PAVOS_INICIALES,
} from '../../public/js/tienda.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let fallas = 0;
const ok = (c, m) => { console.log(c ? '  ok ' : 'FALLA', m); if (!c) fallas++; };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sf-cuentas-'));

// ---------------------------------------------------------------------------------------------------------------
console.log('Catálogo');
{
  const porTipo = (t) => SKINS.filter((s) => s.tipo === t);
  const trajes = porTipo('personaje');
  ok(trajes.length >= 30, `hay ${trajes.length} trajes (pedido: 30 a 40)`);
  ok(trajes.filter((s) => s.tag === 'humano').length >= 15 && trajes.filter((s) => s.tag !== 'humano').length >= 15, 'unos 15 humanos y el resto monstruos, animales y robots');
  ok(new Set(SKINS.map((s) => s.id)).size === SKINS.length, 'los ids no se repiten');
  ok(SKINS.every((s) => s.rareza >= 0 && s.rareza <= 4 && PRECIOS[s.tipo]), 'todas tienen rareza y tipo con precio');
  ok([0, 1, 2, 3, 4].every((r) => trajes.some((s) => s.rareza === r)), 'hay trajes de todas las rarezas');
  ok(SKINS.filter((s) => !s.gratis).every((s, _, l) => l.filter((o) => o.tipo === s.tipo && o.rareza > s.rareza).every((o) => precio(o) > precio(s))), 'una rareza más alta siempre cuesta más');
  ok(SKINS.filter((s) => s.incluye).every((s) => SKIN[s.incluye]?.tipo === 'mochila'), 'las mochilas que vienen con un traje existen');
  ok(JSON.stringify(equipoValido({ personaje: 'dragon', pico: 'xx', mochila: null }, () => false)) === JSON.stringify({ ...EQUIPO_INICIAL, mochila: null }), 'un equipo con skins que no tenés vuelve a lo inicial');
}

console.log('Cajas y probabilidades');
{
  for (const caja of CAJAS) {
    const p = probabilidades(caja);
    ok(Math.abs(p.reduce((a, b) => a + b, 0) - 1) < 1e-9 && poolCaja(caja).every((s) => !s.gratis), `${caja.nombre}: probabilidades suman 1 y no hay gratis`);
    const rand = rng(1234 + caja.precio);
    const n = 40000, cuenta = [0, 0, 0, 0, 0];
    for (let i = 0; i < n; i++) cuenta[tirarCaja(caja, rand).rareza]++;
    // tolerancia: 4 desvíos estándar
    const bien = p.every((pi, r) => Math.abs(cuenta[r] / n - pi) <= 4 * Math.sqrt(pi * (1 - pi) / n) + 1e-9);
    ok(bien, `${caja.nombre}: en ${n} tiradas cada rareza sale con su probabilidad (${cuenta.map((c) => (c / n * 100).toFixed(1)).join(' / ')} %)`);
    ok(cuenta.every((c, r) => p[r] > 0 || c === 0), `${caja.nombre}: nunca sale una rareza con probabilidad 0`);
  }
}

console.log('Tienda diaria');
{
  const r1 = rotacion(77), r2 = rotacion(77), r3 = rotacion(78);
  ok(JSON.stringify(r1) === JSON.stringify(r2), 'la misma semilla da la misma tienda');
  ok(JSON.stringify(r1) !== JSON.stringify(r3), 'otra semilla da otra tienda');
  const todas = [...r1.destacados, ...r1.diarios];
  ok(r1.destacados.length === 2 && r1.diarios.length === 6 && new Set(todas).size === 8, '2 destacados + 6 diarios sin repetir');
  ok(r1.destacados.every((id) => SKIN[id].rareza >= 3) && SKIN[r1.destacados[0]].tipo === 'personaje', 'los destacados son Épicos o Legendarios y el primero es un traje');
  const tengo = new Set(todas);
  const r4 = rotacion(77, (id) => tengo.has(id));
  ok([...r4.destacados, ...r4.diarios].every((id) => !tengo.has(id)), 'no te ofrece lo que ya tenés');
  ok(costoReroll(0) === 100 && costoReroll(1) === 200 && costoReroll(3) === 800 && costoReroll(10) === 1600, 'el reroll cuesta 100, 200, 400… hasta 1600');
  ok(diaDe(Date.UTC(2026, 10, 27, 2, 59)) === diaDe(Date.UTC(2026, 10, 26, 3, 0)) && diaDe(Date.UTC(2026, 10, 27, 3, 0)) !== diaDe(Date.UTC(2026, 10, 27, 2, 59)), 'la tienda cambia a las 00:00 de Buenos Aires');
}

console.log('Cuentas (lógica)');
{
  const carpeta = tmp();
  let t = Date.UTC(2026, 10, 26, 15);
  const c = new Cuentas({ carpeta, ahora: () => t, rand: rng(99), log: { warn() {} } });
  const r = await c.registrar('Rafa_1', 'secreto123');
  ok(r.ok && r.cuenta.pavos === PAVOS_INICIALES && r.cuenta.pavos === 1000, 'una cuenta nueva empieza con 1000 pavos');
  ok(GRATIS.every((id) => r.cuenta.skins.includes(id)) && r.cuenta.equipo.personaje === 'recluta', 'empieza con las skins gratis puestas');
  ok(!(await c.registrar('rafa_1', 'otraclave')).ok, 'no se puede repetir el usuario (sin importar mayúsculas)');
  ok(!(await c.registrar('a', 'secreto123')).ok && !(await c.registrar('nombre largo!', 'secreto123')).ok && !(await c.registrar('Pepe', '123')).ok, 'se validan usuario y contraseña');
  ok(!(await c.entrar('Rafa_1', 'mala')).ok && (await c.entrar('RAFA_1', 'secreto123')).ok, 'entrar pide la contraseña correcta');
  c.guardarYa();
  const archivo = fs.readFileSync(path.join(carpeta, 'cuentas.json'), 'utf8');
  ok(!archivo.includes('secreto123') && !archivo.includes(r.token) && archivo.includes('scrypt$'), 'en el archivo no está la contraseña ni el token (solo hashes)');
  ok(await claveCorrecta('secreto123', c.usuario('rafa_1').clave), 'el hash de scrypt verifica la contraseña');
  const u = c.deToken(r.token);
  ok(u && u.usuario === 'Rafa_1' && !c.deToken('cualquiera'), 'la sesión se reconoce por el token');

  // comprar
  const tienda = c.publica(u).tienda;
  const caras = [...tienda.destacados, ...tienda.diarios].sort((a, b) => precio(SKIN[b]) - precio(SKIN[a]));
  const cara = caras.find((id) => precio(SKIN[id]) > 1000);
  if (cara) ok(!c.comprar(u, cara).ok && u.pavos === 1000, `no se puede comprar algo más caro que tus pavos (${SKIN[cara].nombre}, ${precio(SKIN[cara])})`);
  const fueraDeTienda = SKINS.find((s) => !s.gratis && ![...tienda.destacados, ...tienda.diarios].includes(s.id));
  ok(!c.comprar(u, fueraDeTienda.id).ok, 'no se puede comprar algo que no está en tu tienda');
  const barata = caras[caras.length - 1];
  const antes = u.pavos;
  const cb = c.comprar(u, barata);
  ok(cb.ok && u.pavos === antes - precio(SKIN[barata]) && u.skins.includes(barata), `comprar descuenta el precio exacto (${SKIN[barata].nombre})`);
  ok(!c.comprar(u, barata).ok && u.pavos === antes - precio(SKIN[barata]), 'no se puede comprar dos veces lo mismo');
  ok(c.equipar(u, SKIN[barata].tipo, barata).ok && c.publica(u).equipo[SKIN[barata].tipo] === barata, 'se puede equipar lo comprado');
  ok(!c.equipar(u, 'personaje', 'dragon').ok, 'no se puede equipar lo que no tenés');
  ok(!c.equipar(u, 'personaje', null).ok && c.equipar(u, 'mochila', null).ok, 'el traje no puede quedar vacío; la mochila sí');

  // reroll
  u.pavos = 350;
  const t0 = JSON.stringify(c.publica(u).tienda.diarios);
  ok(c.reroll(u).ok && u.pavos === 250 && JSON.stringify(c.publica(u).tienda.diarios) !== t0, 'el reroll cobra 100 y cambia la tienda');
  ok(c.reroll(u).ok && u.pavos === 50 && c.publica(u).tienda.costoReroll === 400, 'el segundo cuesta 200 y el próximo 400');
  ok(!c.reroll(u).ok && u.pavos === 50, 'sin pavos no se puede volver a sortear');
  t += 86400000;
  ok(c.publica(u).tienda.costoReroll === 100 && c.publica(u).tienda.rerolls === 0, 'al otro día el reroll vuelve a 100');

  // cajas
  u.pavos = 299;
  ok(!c.abrirCaja(u, 'recluta').ok && u.pavos === 299, 'no se abre una caja sin pavos');
  ok(!c.abrirCaja(u, 'no-existe').ok, 'una caja que no existe da error');
  u.pavos = 300 * 30;
  let repetidas = 0, bien = true;
  for (let i = 0; i < 30; i++) {
    const p0 = u.pavos;
    const a = c.abrirCaja(u, 'recluta');
    if (!a.ok) { bien = false; break; }
    if (a.repetida) { repetidas++; bien &&= u.pavos === p0 - 300 + a.reintegro && a.reintegro > 0; } else bien &&= u.skins.includes(a.premio) && u.pavos === p0 - 300;
    bien &&= a.cinta[a.pos] === a.premio && a.cinta.length === 40;
  }
  ok(bien, `30 cajas: cobran 300, dan la skin (o pavos si estaba repetida: ${repetidas}) y la ruleta frena en el premio`);

  // cara o cruz
  u.pavos = 100;
  ok(!c.moneda(u, 101, 'cara').ok && !c.moneda(u, 5, 'cara').ok && !c.moneda(u, 50, 'canto').ok && !c.moneda(u, 'abc', 'cara').ok, 'no se puede apostar más de lo que tenés ni montos raros');
  let ganadas = 0;
  u.pavos = 1_000_000;
  for (let i = 0; i < 2000; i++) { const m = c.moneda(u, 10, i % 2 ? 'cara' : 'cruz'); if (m.gano) ganadas++; }
  ok(Math.abs(ganadas / 2000 - 0.5) < 0.05, `cara o cruz es 50/50 (${(ganadas / 20).toFixed(1)} % ganadas)`);
  ok(u.pavos === 1_000_000 + (ganadas - (2000 - ganadas)) * 10, 'las apuestas suman y restan exacto');

  // contrato
  const comunes = SKINS.filter((s) => !s.gratis && s.rareza === 0).slice(0, 5).map((s) => s.id);
  ok(contratoValido(comunes) === 0 && contratoValido(comunes.slice(0, 4)) === null, 'el contrato pide 5 de la misma rareza');
  for (const id of comunes) if (!u.skins.includes(id)) u.skins.push(id);
  const n0 = u.skins.length;
  const ct = c.contrato(u, comunes);
  ok(ct.ok && SKIN[ct.premio].rareza === 1 && comunes.every((id) => !u.skins.includes(id)), `el contrato se lleva las 5 Comunes y da una Poco común (${SKIN[ct.premio].nombre})`);
  ok(!c.contrato(u, comunes).ok && u.skins.length <= n0 - 4, 'no se puede repetir el contrato sin tener las skins');

  // vender
  const vend = u.skins.find((id) => SKIN[id].tipo !== 'mochila');
  const pv = u.pavos;
  ok(c.vender(u, vend).ok && !u.skins.includes(vend) && u.pavos === pv + Math.floor(precio(SKIN[vend]) * 0.4), 'vender devuelve el 40 %');
  ok(!c.vender(u, 'recluta').ok, 'las gratis no se venden');

  // premios
  const p1 = premioPartida({ killsPersonas: 2, killsBots: 3, gano: true, contraPersonas: true });
  ok(p1.total === 20 + 50 + 30 + 150, 'premio de partida: 20 + 25 por persona + 10 por bot + 150 por ganar');
  ok(premioPartida({ gano: true, contraPersonas: false }).total === 80, 'ganar solo contra bots da menos (60)');

  // admin
  await c.registrar('Otro', 'otraclave1');
  const otro = c.usuario('otro');
  ok(!c.dar(otro, 'Rafa_1', { pavos: 500 }).ok, 'una cuenta común no puede dar pavos');
  const adm = await c.asegurarAdmin('Jefa', 'claveadmin1');
  ok(adm.admin && (await c.entrar('Jefa', 'claveadmin1')).ok, 'la cuenta admin se crea con las variables de entorno');
  const po = otro.pavos;
  ok(c.dar(adm, 'otro', { pavos: 2500 }).ok && otro.pavos === po + 2500, 'el admin le da pavos a otro');
  ok(c.dar(adm, 'otro', { pavos: -999999 }).ok && otro.pavos === 0, 'el admin puede sacar pavos pero el saldo no baja de 0');
  ok(c.dar(adm, 'otro', { skin: 'dragon' }).ok && otro.skins.includes('dragon') && otro.skins.includes('alas_dragon'), 'el admin le regala un traje (con su mochila)');
  ok(!c.dar(adm, 'otro', { skin: 'dragon' }).ok && !c.dar(adm, 'nadie', { pavos: 5 }).ok && !c.dar(adm, 'otro', { skin: 'zzz' }).ok, 'no regala repetidas, a usuarios que no existen ni skins que no existen');
  ok(c.quitar(adm, 'otro', 'dragon').ok && !otro.skins.includes('dragon'), 'el admin puede sacar una skin');
  ok(c.datos.registroAdmin.length >= 3, 'lo que hace el admin queda registrado');

  // persistencia
  c.guardarYa();
  const c2 = new Cuentas({ carpeta, ahora: () => t, log: { warn() {} } });
  ok(c2.usuario('otro').pavos === otro.pavos && c2.deToken(r.token)?.usuario === 'Rafa_1' && c2.usuario('jefa').admin, 'todo sigue igual al volver a cargar el archivo');
  fs.rmSync(carpeta, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------------------------------------------
console.log('Servidor (API y salas)');
const PORT = 3900 + Math.floor(Math.random() * 90);
const datos = tmp();
const BASE = `http://127.0.0.1:${PORT}`;
function arrancar() {
  const srv = spawn(process.execPath, ['server.js'], {
    cwd: RAIZ, env: { ...process.env, PORT: String(PORT), SF_DATOS: datos, SF_ADMIN_USUARIO: 'Admin', SF_ADMIN_CLAVE: 'clave-admin-123', SF_LIMITE_LOGIN: '1000' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((res, rej) => {
    let out = '';
    srv.stdout.on('data', (d) => { out += d; if (out.includes('Salto Final en')) res(srv); });
    srv.stderr.on('data', (d) => { out += d; });
    srv.on('exit', () => rej(new Error(`el servidor se cerró:\n${out}`)));
  });
}
const pedir = async (metodo, ruta, cuerpo, token) => {
  const r = await fetch(BASE + ruta, { method: metodo, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  return { status: r.status, ...(await r.json()) };
};
let srv = await arrancar();
try {
  const reg = await pedir('POST', '/api/registro', { usuario: 'Jugadora', clave: 'mi-clave-1' });
  ok(reg.ok && reg.cuenta.pavos === 1000, 'POST /api/registro crea la cuenta con 1000 pavos');
  const tk = reg.token;
  ok((await pedir('GET', '/api/cuenta')).status === 401, 'sin sesión no se ve la cuenta');
  ok((await pedir('GET', '/api/cuenta', null, tk)).cuenta.usuario === 'Jugadora', 'con el token se ve la cuenta');
  ok((await pedir('POST', '/api/entrar', { usuario: 'Jugadora', clave: 'otra' })).status === 401, 'contraseña incorrecta: 401');
  ok((await pedir('GET', '/api/admin/usuarios', null, tk)).status === 403, 'una cuenta común no entra al panel admin');
  ok((await pedir('POST', '/api/admin/dar', { usuario: 'Jugadora', pavos: 5000 }, tk)).status === 403, 'una cuenta común no puede darse pavos');
  ok((await pedir('POST', '/api/cajas/abrir', { caja: 'leyenda' }, tk)).status === 402, 'abrir una caja de 1200 con 1000 pavos: no alcanza (402)');
  const adm = await pedir('POST', '/api/entrar', { usuario: 'admin', clave: 'clave-admin-123' });
  ok(adm.ok && adm.cuenta.admin, 'la cuenta admin de SF_ADMIN_USUARIO / SF_ADMIN_CLAVE entra y es admin');
  const lista = await pedir('GET', '/api/admin/usuarios?q=jug', null, adm.token);
  ok(lista.ok && lista.usuarios.length === 1 && !JSON.stringify(lista).includes('scrypt'), 'el admin ve la lista de usuarios (sin contraseñas)');
  ok((await pedir('POST', '/api/admin/dar', { usuario: 'jugadora', pavos: 5000, skin: 'astronauta' }, adm.token)).ok, 'el admin da 5000 pavos y un traje');
  const c1 = (await pedir('GET', '/api/cuenta', null, tk)).cuenta;
  ok(c1.pavos === 6000 && c1.skins.includes('astronauta') && c1.skins.includes('jetpack'), 'a la jugadora le llegó todo');
  ok((await pedir('POST', '/api/equipar', { tipo: 'personaje', id: 'astronauta' }, tk)).ok, 'se equipa el traje');
  const caja = await pedir('POST', '/api/cajas/abrir', { caja: 'leyenda' }, tk);
  ok(caja.ok && SKIN[caja.premio].rareza >= 2 && caja.cuenta.pavos === 6000 - 1200 + caja.reintegro, 'la Caja Leyenda cobra 1200 y da algo Raro o mejor');
  ok((await fetch(`${BASE}/api/registro`, { method: 'POST', body: 'x'.repeat(20000) })).status === 400, 'un cuerpo gigante se rechaza');
  ok((await fetch(`${BASE}/../datos/cuentas.json`)).status === 404 && (await fetch(`${BASE}/datos/cuentas.json`)).status === 404, 'el archivo de cuentas no se sirve por HTTP');

  // reinicio: las cuentas siguen
  srv.kill('SIGTERM');
  await new Promise((r) => srv.on('exit', r));
  srv = await arrancar();
  const c2 = (await pedir('GET', '/api/cuenta', null, tk)).cuenta;
  ok(c2 && c2.pavos === caja.cuenta.pavos && c2.equipo.personaje === 'astronauta', 'después de reiniciar el servidor la cuenta y la sesión siguen');

  // sala con sesión: nombre de la cuenta y skins visibles para los demás; invitado no puede usar el nombre
  const conectar = () => new Promise((res) => { const w = new WebSocket(`ws://127.0.0.1:${PORT}`); w.msgs = []; w.on('message', (d) => w.msgs.push(JSON.parse(d))); w.on('open', () => res(w)); });
  const esperar = async (w, f, ms = 3000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const m = w.msgs.find(f); if (m) return m; await new Promise((r) => setTimeout(r, 30)); } return null; };
  const a = await conectar();
  a.send(JSON.stringify({ t: 'create', name: 'otro nombre', token: tk }));
  const wa = await esperar(a, (m) => m.t === 'welcome');
  const yo = wa.room.players.find((p) => p.id === wa.id);
  ok(yo.name === 'Jugadora' && yo.sk.personaje === 'astronauta' && wa.cuenta?.pavos === c2.pavos, 'con sesión: entra con el nombre de la cuenta y su traje');
  const b = await conectar();
  b.send(JSON.stringify({ t: 'join', code: wa.room.code, name: 'Jugadora' }));
  const wb = await esperar(b, (m) => m.t === 'welcome');
  const inv = wb.room.players.find((p) => p.id === wb.id);
  ok(inv.name !== 'Jugadora' && inv.sk.personaje === 'recluta', 'un invitado no puede usar el nombre de una cuenta y va con lo básico');
  ok(wb.room.players.find((p) => p.id === wa.id).sk.personaje === 'astronauta', 'los demás ven el traje de la cuenta');
  // equipar desde el menú con la sala abierta: los demás ven el cambio
  b.msgs.length = 0;
  await pedir('POST', '/api/equipar', { tipo: 'personaje', id: 'recluta' }, tk);
  const rm = await esperar(b, (m) => m.t === 'room' && m.room.players.find((p) => p.id === wa.id)?.sk.personaje === 'recluta');
  ok(!!rm, 'si cambia el traje en la sala de espera, los demás lo ven');
  // pavos por partida: la jugadora empieza sola con bots, se tira a la tormenta... más rápido: se desconecta el invitado
  // y se fuerza el final muriendo por caída
  b.close();
  a.msgs.length = 0;
  a.send(JSON.stringify({ t: 'bots', total: 3, dif: 'facil' }));
  a.send(JSON.stringify({ t: 'start' }));
  const ms = await esperar(a, (m) => m.t === 'matchStart', 5000);
  ok(ms && ms.room.players.filter((p) => p.bot).every((p) => p.sk && SKIN[p.sk.personaje]), 'los bots salen con skins al azar');
  await esperar(a, (m) => m.t === 'phase' && m.phase === 'playing', 6000);
  a.send(JSON.stringify({ t: 'jump' }));
  await new Promise((r) => setTimeout(r, 200));
  a.send(JSON.stringify({ t: 'state', p: [0, 50, 0], s: 'ground' }));
  a.send(JSON.stringify({ t: 'fall', dmg: 100 }));
  const pv = await esperar(a, (m) => m.t === 'pavos', 6000);
  ok(pv && pv.ganados === 20 && pv.cuenta.pavos === c2.pavos + 20, `al morir gana los pavos de la partida (${pv ? pv.ganados : 'nada'})`);
  a.close();
} catch (e) {
  console.error(e);
  fallas++;
} finally {
  if (srv.exitCode === null) { srv.kill('SIGTERM'); await new Promise((r) => srv.on('exit', r)); }
  fs.rmSync(datos, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------------------------------------------
if (process.env.PRUEBA_DATABASE_URL) {
  console.log('Postgres (PRUEBA_DATABASE_URL)');
  const { almacenPostgres } = await import('../../servidor/almacenPg.js');
  try {
    const alm = await almacenPostgres(process.env.PRUEBA_DATABASE_URL);
    const c1 = new Cuentas({ almacen: alm });
    await c1.cargar();
    const nombre = `pg_${Date.now() % 1e8}`;
    const r = await c1.registrar(nombre, 'clave-pg-1');
    ok(r.ok, 'registra con Postgres');
    c1.abrirCaja(c1.usuario(nombre), 'recluta');
    await c1.guardarYa();
    const c2 = new Cuentas({ almacen: alm });
    await c2.cargar();
    const u = c2.usuario(nombre);
    ok(u && u.pavos === 700 && u.skins.length >= 1, 'al volver a cargar están los pavos y la skin');
    ok((await c2.entrar(nombre, 'clave-pg-1')).ok, 'entra con la contraseña guardada en Postgres');
    delete c2.datos.usuarios[nombre.toLowerCase()];
    await c2.guardarYa();
    await alm.cerrar();
  } catch (e) {
    console.error(e);
    fallas++;
  }
}

console.log(fallas ? `\n${fallas} FALLAS` : '\ntodo OK');
process.exit(fallas ? 1 : 0);
