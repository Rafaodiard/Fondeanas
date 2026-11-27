// API HTTP de cuentas y tienda (JSON). La usa el menú del juego (public/js/menu.js).
//   POST /api/registro {usuario, clave}        POST /api/entrar {usuario, clave}        POST /api/salir
//   GET  /api/cuenta                           POST /api/equipar {tipo, id}
//   POST /api/tienda/comprar {id}              POST /api/tienda/reroll                   POST /api/vender {id}
//   POST /api/cajas/abrir {caja}               POST /api/apuestas/moneda {monto, lado}   POST /api/apuestas/contrato {ids}
//   GET  /api/admin/usuarios?q=                GET  /api/admin/usuario?u=
//   POST /api/admin/dar {usuario, pavos?, skin?}   POST /api/admin/quitar {usuario, skin}
// La sesión va en el encabezado Authorization: Bearer <token>.
const LIMITE_CUERPO = 8 * 1024;

function responder(res, codigo, obj) {
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function leerCuerpo(req) {
  return new Promise((ok) => {
    let tam = 0, grande = false;
    const partes = [];
    req.on('data', (c) => {
      tam += c.length;
      if (tam > LIMITE_CUERPO) { grande = true; partes.length = 0; return; } // se descarta el resto sin guardarlo
      partes.push(c);
    });
    req.on('end', () => {
      if (grande) return ok(null);
      if (!partes.length) return ok({});
      try { const j = JSON.parse(Buffer.concat(partes).toString('utf8')); ok(j && typeof j === 'object' ? j : null); } catch { ok(null); }
    });
    req.on('error', () => ok(null));
  });
}

// límite de intentos por IP para entrar / registrarse (evita probar contraseñas a lo bruto)
function limitador(max, ventanaMs, ahora) {
  const mapa = new Map();
  return (clave) => {
    const t = ahora();
    const e = mapa.get(clave);
    if (!e || t - e.t0 > ventanaMs) { mapa.set(clave, { t0: t, n: 1 }); return true; }
    e.n++;
    if (mapa.size > 5000) for (const [k, v] of mapa) if (t - v.t0 > ventanaMs) mapa.delete(k);
    return e.n <= max;
  };
}

export function crearApi(cuentas, { alCambiarCuenta = () => {} } = {}) {
  const ahora = cuentas.ahora;
  const intentos = limitador(Number(process.env.SF_LIMITE_LOGIN) || 12, 60_000, ahora);
  const acciones = limitador(240, 60_000, ahora);

  const token = (req) => {
    const h = String(req.headers.authorization || '');
    return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  };

  return async function api(req, res, url) {
    const ruta = url.pathname;
    const ip = req.socket.remoteAddress || '?';
    if (req.method !== 'GET' && req.method !== 'POST') return responder(res, 405, { ok: false, error: 'Método no permitido.' });
    const cuerpo = req.method === 'POST' ? await leerCuerpo(req) : {};
    if (cuerpo === null) return responder(res, 400, { ok: false, error: 'Pedido inválido.' });
    const r = (resultado) => responder(res, resultado.ok ? 200 : resultado.codigo || 400, resultado);

    if (ruta === '/api/registro' || ruta === '/api/entrar') {
      if (req.method !== 'POST') return responder(res, 405, { ok: false, error: 'Usá POST.' });
      if (!intentos(ip)) return responder(res, 429, { ok: false, error: 'Demasiados intentos. Esperá un minuto.' });
      return r(ruta === '/api/registro' ? await cuentas.registrar(cuerpo.usuario, cuerpo.clave) : await cuentas.entrar(cuerpo.usuario, cuerpo.clave));
    }

    const tk = token(req);
    const u = cuentas.deToken(tk);
    if (!u) return responder(res, 401, { ok: false, error: 'Tenés que iniciar sesión.' });
    if (!acciones(u.usuario.toLowerCase())) return responder(res, 429, { ok: false, error: 'Demasiados pedidos seguidos.' });
    const post = req.method === 'POST';
    let out;
    switch (`${req.method} ${ruta}`) {
      case 'GET /api/cuenta': out = { ok: true, cuenta: cuentas.publica(u) }; break;
      case 'POST /api/salir': out = cuentas.salir(tk); break;
      case 'POST /api/equipar': out = cuentas.equipar(u, cuerpo.tipo, cuerpo.id); break;
      case 'POST /api/tienda/comprar': out = cuentas.comprar(u, cuerpo.id); break;
      case 'POST /api/tienda/reroll': out = cuentas.reroll(u); break;
      case 'POST /api/vender': out = cuentas.vender(u, cuerpo.id); break;
      case 'POST /api/cajas/abrir': out = cuentas.abrirCaja(u, cuerpo.caja); break;
      case 'POST /api/apuestas/moneda': out = cuentas.moneda(u, cuerpo.monto, cuerpo.lado); break;
      case 'POST /api/apuestas/contrato': out = cuentas.contrato(u, cuerpo.ids); break;
      case 'GET /api/admin/usuarios':
        out = u.admin ? { ok: true, usuarios: cuentas.listar(url.searchParams.get('q')) } : { ok: false, error: 'Solo la cuenta admin puede ver esto.', codigo: 403 };
        break;
      case 'GET /api/admin/usuario':
        out = u.admin ? cuentas.ver(url.searchParams.get('u')) : { ok: false, error: 'Solo la cuenta admin puede ver esto.', codigo: 403 };
        break;
      case 'POST /api/admin/dar': out = cuentas.dar(u, cuerpo.usuario, cuerpo); if (out.ok) alCambiarCuenta(cuerpo.usuario); break;
      case 'POST /api/admin/quitar': out = cuentas.quitar(u, cuerpo.usuario, cuerpo.skin); if (out.ok) alCambiarCuenta(cuerpo.usuario); break;
      default: return responder(res, 404, { ok: false, error: post ? 'No existe esa acción.' : 'No encontrado.' });
    }
    if (out.ok && ruta !== '/api/salir') alCambiarCuenta(u.usuario);
    return r(out);
  };
}
