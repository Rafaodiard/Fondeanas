// Pruebas de lo que necesita el servidor para correr en un hosting (Render gratis): PORT, /salud, ETag + 304,
// gzip, que no se salga de public/, tope de bots (SF_BOTS_MAX), latido de los WebSocket y render.yaml.
// Uso: node tools/hosting/pruebas.mjs
import { spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import zlib from 'zlib';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import { latido, topeBots } from '../../servidor/hosting.js';
import { BOT_TOTALES } from '../../public/js/opcionesBots.js';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
let fallas = 0;
const ok = (c, m) => { console.log(c ? '  ok ' : 'FALLA', m); if (!c) fallas++; };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 3900 + Math.floor(Math.random() * 90);

function pedir(ruta, headers = {}, method = 'GET') {
  return new Promise((ok2, mal) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: ruta, headers, method }, (res) => {
      const partes = [];
      res.on('data', (d) => partes.push(d));
      res.on('end', () => ok2({ status: res.statusCode, headers: res.headers, body: Buffer.concat(partes) }));
    });
    req.on('error', mal);
    req.end();
  });
}

// 1) tope de bots
ok(topeBots(BOT_TOTALES, undefined) === null && topeBots(BOT_TOTALES, '') === null, 'sin SF_BOTS_MAX no hay tope');
ok(topeBots(BOT_TOTALES, '4') === 4 && topeBots(BOT_TOTALES, '10') === 8 && topeBots(BOT_TOTALES, '0') === 0, 'el tope baja al total de la lista más cercano');

// 2) render.yaml
{
  const y = fs.readFileSync(path.join(raiz, 'render.yaml'), 'utf8');
  ok(/plan:\s*free/.test(y) && /runtime:\s*node/.test(y) && /type:\s*web/.test(y), 'render.yaml: servicio web de Node en el plan gratis');
  ok(/healthCheckPath:\s*\/salud/.test(y) && /startCommand:\s*npm start/.test(y) && /buildCommand:\s*npm ci/.test(y), 'render.yaml: build, start y health check');
  ok(/key:\s*SF_BOTS_MAX/.test(y) && /key:\s*SF_NAV_MS/.test(y), 'render.yaml: tope de bots y tiempo de navegación para 0,1 CPU');
}

// 3) servidor real en un PORT elegido por variable de entorno
const srv = spawn(process.execPath, ['server.js'], { cwd: raiz, env: { ...process.env, PORT: String(PORT), SF_BOTS_MAX: '4' }, stdio: ['ignore', 'pipe', 'inherit'] });
let salida = '';
srv.stdout.on('data', (d) => { salida += d; });
for (let i = 0; i < 100 && !salida.includes(String(PORT)); i++) await esperar(100);
try {
  ok(salida.includes(`:${PORT}`), `escucha en el PORT de la variable de entorno (${PORT})`);

  const s = await pedir('/salud');
  const j = JSON.parse(s.body);
  ok(s.status === 200 && j.ok === true && typeof j.version === 'string' && j.salas === 0, '/salud contesta 200 con { ok, version, salas }');

  const original = fs.readFileSync(path.join(raiz, 'public/index.html'));
  const a = await pedir('/');
  ok(a.status === 200 && a.body.equals(original) && !a.headers['content-encoding'], 'sin Accept-Encoding manda el archivo tal cual');
  ok(!!a.headers.etag && a.headers['cache-control'] === 'no-cache', 'manda ETag y no-cache (después de un deploy se revisa si cambió)');
  const b = await pedir('/', { 'If-None-Match': a.headers.etag });
  ok(b.status === 304 && b.body.length === 0, 'con el mismo ETag contesta 304 vacío');
  const b2 = await pedir('/', { 'If-None-Match': `W/${a.headers.etag}, "otro"` });
  ok(b2.status === 304, 'acepta ETag débil y listas de ETags');
  const c = await pedir('/', { 'If-None-Match': '"viejo"' });
  ok(c.status === 200 && c.body.length === original.length, 'con otro ETag manda el archivo');

  const three = fs.readFileSync(path.join(raiz, 'node_modules/three/build/three.module.js'));
  const g = await pedir('/vendor/three/build/three.module.js', { 'Accept-Encoding': 'gzip, deflate, br' });
  ok(g.headers['content-encoding'] === 'gzip' && zlib.gunzipSync(g.body).equals(three), 'gzip: three.module.js llega comprimido y se descomprime igual');
  ok(g.body.length < three.length * 0.3, `gzip: three.module.js pesa ${(g.body.length / 1e6).toFixed(2)} MB en vez de ${(three.length / 1e6).toFixed(2)} MB`);
  const glb = fs.readFileSync(path.join(raiz, 'public/models/personaje.glb'));
  const gg = await pedir('/models/personaje.glb', { 'Accept-Encoding': 'gzip' });
  ok(zlib.gunzipSync(gg.body).equals(glb) && gg.headers['content-type'] === 'model/gltf-binary', 'gzip: los .glb también, con su tipo');
  const h = await pedir('/', {}, 'HEAD');
  ok(h.status === 200 && h.body.length === 0 && Number(h.headers['content-length']) === original.length, 'HEAD contesta sin cuerpo');

  ok((await pedir('/%2e%2e/server.js')).status === 404 && (await pedir('/vendor/three/../../../server.js')).status === 404, 'no deja leer archivos fuera de public/ y three');
  ok((await pedir('/no-existe.js')).status === 404, 'un archivo que no existe da 404');
  ok((await pedir('/%')).status === 400 && (await pedir('/salud')).status === 200, 'una dirección mal escrita (/%) da 400 y el servidor sigue andando');

  // tope de bots por sala
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
  const msgs = [];
  ws.on('message', (d) => msgs.push(JSON.parse(d)));
  await new Promise((r) => ws.on('open', r));
  ws.send(JSON.stringify({ t: 'create', name: 'prueba' }));
  await esperar(300);
  ws.send(JSON.stringify({ t: 'bots', total: 16, dif: 'normal' }));
  await esperar(300);
  const room = msgs.filter((m) => m.t === 'room').pop()?.room;
  ok(room && room.bots.total === 4 && room.botsMax === 4, 'con SF_BOTS_MAX=4 una sala que pide 16 queda en 4 (y avisa botsMax al cliente)');
  ok(JSON.parse((await pedir('/salud')).body).salas === 1, '/salud cuenta las salas abiertas');
  ws.close();
} finally {
  srv.kill();
}

// 4) latido: ping a los vivos, corta a los que no contestan
{
  const wss = new WebSocketServer({ port: 0 });
  latido(wss, 150);
  const port = wss.address().port;
  const vivo = new WebSocket(`ws://127.0.0.1:${port}`);
  const muerto = new WebSocket(`ws://127.0.0.1:${port}`);
  let pings = 0, muertoCerro = false, vivoCerro = false;
  vivo.on('ping', () => pings++);
  vivo.on('close', () => { vivoCerro = true; });
  muerto.on('close', () => { muertoCerro = true; });
  await Promise.all([vivo, muerto].map((w) => new Promise((r) => w.on('open', r))));
  muerto._socket.pause(); // deja de leer: no contesta los ping, como una conexión que se cortó sin avisar
  await esperar(700);
  ok(pings >= 2 && !vivoCerro, 'latido: la conexión que contesta recibe pings y sigue abierta');
  ok(wss.clients.size === 1, 'latido: la que no contesta se cierra en el servidor');
  muerto._socket.resume();
  await esperar(100);
  ok(muertoCerro, 'latido: y del otro lado se ve cerrada');
  vivo.close();
  wss.close();
}

console.log(fallas ? `\n${fallas} FALLAS` : '\ntodo OK');
process.exit(fallas ? 1 : 0);
