// Cuentas: registro e inicio de sesión con usuario y contraseña, sesiones en cookie y límite de intentos.
import crypto from 'crypto';
import { PAVOS_INICIALES } from './db.js';

export const SESION_DIAS = 30;
export const COOKIE = 'sf_sesion';
const USUARIO_RE = /^[A-Za-z0-9_]{3,16}$/;
const PASS_MIN = 8, PASS_MAX = 128;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
export const LIMITES = {
  loginPorMinuto: 10, // intentos de login por IP y por usuario, por minuto
  registrosPorDia: 5, // cuentas nuevas por IP, por día
};

export class ErrorCuenta extends Error { constructor(msg, codigo, estado = 400) { super(msg); this.codigo = codigo; this.estado = estado; } }

function hashear(pass, sal) {
  return new Promise((ok, mal) => crypto.scrypt(pass, sal, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }, (e, k) => (e ? mal(e) : ok(k.toString('hex')))));
}

// Ventanas deslizantes en memoria: clave -> tiempos de los intentos.
function limitador() {
  const m = new Map();
  return {
    cuenta(clave, ventanaMs) {
      const t = Date.now(), lista = (m.get(clave) || []).filter((x) => t - x < ventanaMs);
      m.set(clave, lista);
      return lista.length;
    },
    sumar(clave) { (m.get(clave) || m.set(clave, []).get(clave)).push(Date.now()); },
    limpiar() { m.clear(); },
  };
}

export function crearCuentas(base) {
  const { db } = base;
  const q = {
    porNombre: db.prepare('SELECT id, usuario, hash, sal FROM usuarios WHERE usuario = ?'),
    insertar: db.prepare('INSERT INTO usuarios (usuario, hash, sal, pavos, creado, ip_registro) VALUES (?, ?, ?, 0, ?, ?)'),
    nuevaSesion: db.prepare('INSERT INTO sesiones (token, usuario_id, vence) VALUES (?, ?, ?)'),
    sesion: db.prepare('SELECT usuario_id, vence FROM sesiones WHERE token = ?'),
    borrarSesion: db.prepare('DELETE FROM sesiones WHERE token = ?'),
    vencidas: db.prepare('DELETE FROM sesiones WHERE vence < ?'),
  };
  const intentos = limitador();

  function validar(usuario, pass) {
    if (typeof usuario !== 'string' || !USUARIO_RE.test(usuario)) throw new ErrorCuenta('El usuario tiene que tener de 3 a 16 letras, números o guiones bajos.', 'usuario_invalido');
    if (typeof pass !== 'string' || pass.length < PASS_MIN) throw new ErrorCuenta(`La contraseña tiene que tener al menos ${PASS_MIN} caracteres.`, 'pass_corta');
    if (pass.length > PASS_MAX) throw new ErrorCuenta('La contraseña es demasiado larga.', 'pass_larga');
  }

  function abrirSesion(usuarioId) {
    const token = crypto.randomBytes(32).toString('base64url');
    q.nuevaSesion.run(token, usuarioId, Date.now() + SESION_DIAS * 864e5);
    return token;
  }

  async function registrar(usuario, pass, ip = '') {
    validar(usuario, pass);
    if (intentos.cuenta(`reg:${ip}`, 864e5) >= LIMITES.registrosPorDia) throw new ErrorCuenta('Se crearon demasiadas cuentas desde esta conexión. Probá mañana.', 'limite', 429);
    if (q.porNombre.get(usuario)) throw new ErrorCuenta('Ese usuario ya existe.', 'usuario_tomado', 409);
    const sal = crypto.randomBytes(16).toString('hex');
    const hash = await hashear(pass, sal);
    const id = base.transaccion(() => {
      if (q.porNombre.get(usuario)) throw new ErrorCuenta('Ese usuario ya existe.', 'usuario_tomado', 409);
      const nuevo = Number(q.insertar.run(usuario, hash, sal, Date.now(), ip).lastInsertRowid);
      base.mover(nuevo, PAVOS_INICIALES, 'bienvenida');
      return nuevo;
    });
    intentos.sumar(`reg:${ip}`);
    return { token: abrirSesion(id), usuario: base.usuario(id) };
  }

  async function entrar(usuario, pass, ip = '') {
    const u = typeof usuario === 'string' ? usuario.toLowerCase() : '';
    if (intentos.cuenta(`ip:${ip}`, 6e4) >= LIMITES.loginPorMinuto || intentos.cuenta(`u:${u}`, 6e4) >= LIMITES.loginPorMinuto) {
      throw new ErrorCuenta('Demasiados intentos. Esperá un minuto.', 'limite', 429);
    }
    intentos.sumar(`ip:${ip}`); intentos.sumar(`u:${u}`);
    const fila = typeof usuario === 'string' && typeof pass === 'string' && pass.length <= PASS_MAX ? q.porNombre.get(usuario) : null;
    // aunque el usuario no exista se calcula un hash, para que no se note por el tiempo de respuesta
    const hash = await hashear(typeof pass === 'string' ? pass.slice(0, PASS_MAX) : '', fila ? fila.sal : 'x'.repeat(32));
    if (!fila || !crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(fila.hash, 'hex'))) {
      throw new ErrorCuenta('Usuario o contraseña incorrectos.', 'credenciales', 401);
    }
    return { token: abrirSesion(fila.id), usuario: base.usuario(fila.id) };
  }

  // Cuenta de un token de sesión (o null si no hay o venció).
  function deToken(token) {
    if (typeof token !== 'string' || !token) return null;
    const s = q.sesion.get(token);
    if (!s) return null;
    if (s.vence < Date.now()) { q.borrarSesion.run(token); return null; }
    return base.usuario(s.usuario_id);
  }

  function salir(token) { if (token) q.borrarSesion.run(token); }
  function limpiarVencidas() { q.vencidas.run(Date.now()); }

  return { registrar, entrar, deToken, salir, limpiarVencidas, intentos };
}

// ---------- Cookies ----------
export function leerCookies(header = '') {
  const out = {};
  for (const parte of String(header).split(';')) {
    const i = parte.indexOf('=');
    if (i < 0) continue;
    const k = parte.slice(0, i).trim();
    if (k) { try { out[k] = decodeURIComponent(parte.slice(i + 1).trim()); } catch { /* cookie rota */ } }
  }
  return out;
}

export function cookieSesion(token, seguro) {
  const base = `${COOKIE}=${token ? encodeURIComponent(token) : ''}; Path=/; HttpOnly; SameSite=Lax${seguro ? '; Secure' : ''}`;
  return token ? `${base}; Max-Age=${SESION_DIAS * 86400}` : `${base}; Max-Age=0`;
}

// IP del cliente. Detrás de un proxy (Render, Railway...) poné SF_CONFIAR_PROXY=1 para leer X-Forwarded-For.
export function ipDe(req) {
  if (process.env.SF_CONFIAR_PROXY) {
    const f = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (f) return f;
  }
  return (req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
}

export function esSeguro(req) {
  return !!req.socket?.encrypted || (!!process.env.SF_CONFIAR_PROXY && req.headers['x-forwarded-proto'] === 'https');
}

// El Origin (si viene) tiene que ser este mismo sitio.
export function origenValido(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch { return false; }
}
