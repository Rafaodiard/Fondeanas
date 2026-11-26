// Rutas /api/*: cuentas, casino y tienda. JSON de ida y vuelta; la sesión viaja en la cookie sf_sesion.
import { COOKIE, leerCookies, cookieSesion, ipDe, esSeguro, origenValido } from './cuentas.js';
import { SinSaldo } from './db.js';
import { APUESTA_MIN, APUESTA_MAX } from '../public/js/casino/reglas.js';
import { PAVOS_POR_KILL } from './premios.js';

const MAX_CUERPO = 8 * 1024;

function responder(res, estado, datos, cabeceras = {}) {
  res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cabeceras });
  res.end(JSON.stringify(datos));
}

function leerCuerpo(req) {
  return new Promise((ok, mal) => {
    let n = 0;
    const partes = [];
    req.on('data', (c) => {
      n += c.length;
      if (n > MAX_CUERPO) { mal(Object.assign(new Error('Pedido demasiado grande.'), { estado: 413 })); req.destroy(); return; }
      partes.push(c);
    });
    req.on('end', () => {
      if (!n) return ok({});
      try { ok(JSON.parse(Buffer.concat(partes).toString('utf8'))); } catch { mal(Object.assign(new Error('JSON inválido.'), { estado: 400 })); }
    });
    req.on('error', mal);
  });
}

// servicios: { cuentas, casino, tienda, alCambiarSaldo(uid, saldo) }
export function crearApi({ cuentas, casino, tienda, base }) {
  const token = (req) => leerCookies(req.headers.cookie)[COOKIE] || null;
  const perfil = (u) => (u ? { usuario: u.usuario, pavos: u.pavos, skin: tienda.puesta(u.id) } : null);

  // [método, ruta, necesita cuenta, manejador(ctx)]
  const rutas = [
    ['GET', '/api/yo', false, ({ cuenta }) => ({ cuenta: perfil(cuenta), casino: { min: APUESTA_MIN, max: APUESTA_MAX }, pavosPorKill: PAVOS_POR_KILL })],
    ['POST', '/api/registro', false, async ({ cuerpo, req, res }) => {
      const r = await cuentas.registrar(cuerpo.usuario, cuerpo.pass, ipDe(req));
      res.setHeader('Set-Cookie', cookieSesion(r.token, esSeguro(req)));
      return { cuenta: perfil(r.usuario) };
    }],
    ['POST', '/api/login', false, async ({ cuerpo, req, res }) => {
      const r = await cuentas.entrar(cuerpo.usuario, cuerpo.pass, ipDe(req));
      res.setHeader('Set-Cookie', cookieSesion(r.token, esSeguro(req)));
      return { cuenta: perfil(r.usuario) };
    }],
    ['POST', '/api/salir', false, ({ req, res }) => {
      cuentas.salir(token(req));
      res.setHeader('Set-Cookie', cookieSesion(null, esSeguro(req)));
      return { ok: true };
    }],
    ['POST', '/api/casino/ruleta', true, ({ cuenta, cuerpo }) => casino.ruleta(cuenta.id, cuerpo.apuestas)],
    ['POST', '/api/casino/slots', true, ({ cuenta, cuerpo }) => casino.slots(cuenta.id, cuerpo.monto)],
    ['GET', '/api/casino/blackjack', true, ({ cuenta }) => casino.blackjackEstado(cuenta.id)],
    ['POST', '/api/casino/blackjack/repartir', true, ({ cuenta, cuerpo }) => casino.blackjackRepartir(cuenta.id, cuerpo.monto)],
    ['POST', '/api/casino/blackjack/jugar', true, ({ cuenta, cuerpo }) => casino.blackjackJugar(cuenta.id, cuerpo.accion)],
    ['GET', '/api/tienda', true, ({ cuenta }) => tienda.estado(cuenta.id)],
    ['POST', '/api/tienda/comprar', true, ({ cuenta, cuerpo }) => tienda.comprar(cuenta.id, cuerpo.skin)],
    ['POST', '/api/casillero/poner', true, ({ cuenta, cuerpo }) => tienda.poner(cuenta.id, cuerpo.skin ?? null)],
    // Anuncios con premio: espacio reservado, sin activar (ver server/premios.js).
  ];

  // Devuelve true si atendió el pedido.
  return async function api(req, res, url) {
    if (!url.startsWith('/api/')) return false;
    const ruta = rutas.find(([m, p]) => p === url && m === req.method);
    if (!ruta) { responder(res, rutas.some(([, p]) => p === url) ? 405 : 404, { error: 'No encontrado.' }); return true; }
    const [metodo, , conCuenta, fn] = ruta;
    try {
      if (metodo === 'POST') {
        if (!origenValido(req)) return responder(res, 403, { error: 'Origen no permitido.' }), true;
        if (!String(req.headers['content-type'] || '').startsWith('application/json')) return responder(res, 415, { error: 'Mandá JSON.' }), true;
      }
      const cuerpo = metodo === 'POST' ? await leerCuerpo(req) : {};
      const cuenta = cuentas.deToken(token(req));
      if (conCuenta && !cuenta) return responder(res, 401, { error: 'Iniciá sesión para usar esto.', codigo: 'sin_sesion' }), true;
      const datos = await fn({ req, res, cuerpo: cuerpo && typeof cuerpo === 'object' ? cuerpo : {}, cuenta });
      responder(res, 200, datos);
    } catch (e) {
      if (e instanceof SinSaldo) responder(res, 402, { error: e.message, codigo: e.codigo, saldo: (() => { const c = cuentas.deToken(token(req)); return c ? base.saldo(c.id) : 0; })() });
      else if (e.codigo || e.estado) responder(res, e.estado || 400, { error: e.message, codigo: e.codigo });
      else { console.error('Error en', url, e); responder(res, 500, { error: 'Error del servidor.' }); }
    }
    return true;
  };
}
