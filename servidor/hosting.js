// Lo que necesita el servidor para correr en un hosting en la nube (Render u otro), separado de server.js:
// - archivos estáticos con ETag (el navegador vuelve a pedir el archivo, pero si no cambió recibe un 304 vacío)
//   y comprimidos con gzip, para gastar poco ancho de banda (Render gratis da 5 GB por mes);
// - /salud para el health check del hosting;
// - latido de los WebSocket: un ping cada 25 s mantiene viva la conexión a través de proxies (como los de una
//   escuela) que cortan las conexiones calladas, y cierra las que ya no contestan.
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';

// Los .glb van comprimidos con meshopt, pero gzip igual les saca entre 15 % y 85 %.
const COMPRIMIBLE = new Set(['.html', '.js', '.css', '.json', '.glb', '.svg', '.txt']);
const cache = new Map(); // ruta → { mtime, size, data, etag, gz: Promise<Buffer> | null }

function leer(file, cb) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return cb(err || new Error('no es un archivo'));
    const c = cache.get(file);
    if (c && c.mtime === st.mtimeMs && c.size === st.size) return cb(null, c);
    fs.readFile(file, (err2, data) => {
      if (err2) return cb(err2);
      const etag = `"${crypto.createHash('sha1').update(data).digest('base64url').slice(0, 20)}"`;
      const e = { mtime: st.mtimeMs, size: st.size, data, etag, gz: null };
      cache.set(file, e);
      cb(null, e);
    });
  });
}

// gzip en segundo plano (no frena el bucle del juego) y una sola vez por versión del archivo
function comprimido(e) {
  if (!e.gz) {
    e.gz = new Promise((ok) => zlib.gzip(e.data, { level: 9 }, (err, buf) => ok(err ? null : buf)));
  }
  return e.gz;
}

const coincide = (h, etag) => !!h && h.split(',').some((t) => t.trim().replace(/^W\//, '') === etag);

// Sin caché fija (Cache-Control: no-cache): después de un git pull o un deploy el navegador trae lo nuevo,
// pero lo que no cambió no se vuelve a bajar gracias al ETag.
export function servirArchivo(req, res, file, tipo) {
  leer(file, (err, e) => {
    if (err) { res.writeHead(404); return res.end('No encontrado'); }
    const headers = { 'Content-Type': tipo, 'Cache-Control': 'no-cache', ETag: e.etag, Vary: 'Accept-Encoding' };
    if (coincide(req.headers['if-none-match'], e.etag)) { res.writeHead(304, headers); return res.end(); }
    const enviar = (body, gzip) => {
      if (gzip) headers['Content-Encoding'] = 'gzip';
      headers['Content-Length'] = body.length;
      res.writeHead(200, headers);
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    const quiereGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    if (!quiereGzip || !COMPRIMIBLE.has(path.extname(file)) || e.data.length < 1024) return enviar(e.data, false);
    comprimido(e).then((gz) => (gz && gz.length < e.data.length ? enviar(gz, true) : enviar(e.data, false)));
  });
}

// Health check: el hosting lo pide cada pocos segundos; contesta rápido y sin tocar las salas.
export function salud(res, datos) {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ ok: true, ...datos, uptime: Math.round(process.uptime()) }));
}

export function latido(wss, ms = 25000) {
  wss.on('connection', (ws) => {
    ws.vivo = true;
    ws.on('pong', () => { ws.vivo = true; });
  });
  const t = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.vivo) { ws.terminate(); continue; } // no contestó el ping anterior: se cerró sin avisar
      ws.vivo = false;
      ws.ping();
    }
  }, ms);
  t.unref();
  wss.on('close', () => clearInterval(t));
}

// Tope de bots por sala para servidores chicos (SF_BOTS_MAX): el mayor total de la lista que no lo pase.
// Sin la variable no hay tope. En Render gratis (0,1 CPU) 16 bots usan más CPU de la que hay.
export function topeBots(totales, valor) {
  const max = Number(valor);
  if (!valor || !Number.isFinite(max)) return null;
  return Math.max(0, ...totales.filter((n) => n <= max));
}
