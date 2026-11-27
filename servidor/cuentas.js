// Cuentas de Salto Final: registro, inicio de sesión, pavos (moneda virtual), skins, tienda, cajas, apuestas y admin.
// Todo lo decide el servidor: el cliente solo pide y muestra. Las cuentas se guardan en un archivo JSON (por defecto
// datos/cuentas.json, o la carpeta de SF_DATOS) que sobrevive a los reinicios, o en Postgres si hay DATABASE_URL
// (servidor/almacenPg.js, para hosting sin disco fijo). Las contraseñas se guardan con scrypt
// (sal al azar por cuenta), nunca en texto. Las sesiones son tokens al azar; en el archivo queda solo su hash.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { SKIN, SKINS, GRATIS, EQUIPO_INICIAL, OPCIONALES, equipoValido, precio } from '../public/js/skins.js';
import {
  PAVOS_INICIALES, TIENDA, CAJA, MONEDA, diaDe, proximoCambio, costoReroll, rotacion, hash, tirarCaja, cintaCaja,
  contratoValido, tirarContrato, precioVenta, reintegroRepetida, premioPartida,
} from '../public/js/tienda.js';

const SCRYPT = { N: 16384, r: 8, p: 1, len: 64 };
const SESION_DIAS = 30;
const MAX_PAVOS = 10_000_000;
const HISTORIAL = 40;
export const USUARIO_RE = /^[A-Za-z0-9_]{3,16}$/;
export const CLAVE_MIN = 6;

const scrypt = (clave, sal) => new Promise((res, rej) => {
  crypto.scrypt(clave, sal, SCRYPT.len, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k)));
});
export async function hashClave(clave) {
  const sal = crypto.randomBytes(16);
  const k = await scrypt(clave, sal);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${sal.toString('base64')}$${k.toString('base64')}`;
}
export async function claveCorrecta(clave, guardada) {
  const [tipo, N, r, p, sal, h] = String(guardada).split('$');
  if (tipo !== 'scrypt') return false;
  const esperado = Buffer.from(h, 'base64');
  const k = await new Promise((res, rej) => crypto.scrypt(clave, Buffer.from(sal, 'base64'), esperado.length,
    { N: +N, r: +r, p: +p, maxmem: 64 * 1024 * 1024 }, (e, kk) => (e ? rej(e) : res(kk))));
  return k.length === esperado.length && crypto.timingSafeEqual(k, esperado);
}
const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const clave = (usuario) => String(usuario).toLowerCase();
const entero = (x) => (Number.isFinite(Number(x)) ? Math.trunc(Number(x)) : NaN);
const error = (mensaje, codigo = 400) => ({ ok: false, error: mensaje, codigo });

export class Cuentas {
  // carpeta: dónde guardar cuentas.json. almacen: en vez del archivo, otro lugar ({ cargar, guardar }, por ejemplo
  // Postgres con servidor/almacenPg.js; ahí hay que llamar a cargar() antes de usarla). ahora/rand: para las pruebas.
  constructor({ carpeta, almacen = null, ahora = () => Date.now(), rand = Math.random, log = console } = {}) {
    this.almacen = almacen;
    this.ahora = ahora;
    this.rand = rand;
    this.log = log;
    this.datos = { version: 1, usuarios: {}, sesiones: {}, registroAdmin: [] };
    this.timer = null;
    this.cola = Promise.resolve();
    if (almacen) return;
    this.archivo = path.join(carpeta, 'cuentas.json');
    fs.mkdirSync(carpeta, { recursive: true });
    if (fs.existsSync(this.archivo)) {
      try { this.datos = { ...this.datos, ...JSON.parse(fs.readFileSync(this.archivo, 'utf8')) }; } catch (e) {
        // archivo roto: se guarda una copia y se arranca de cero (nunca se pisa sin copia)
        const copia = `${this.archivo}.roto-${Date.now()}`;
        fs.copyFileSync(this.archivo, copia);
        this.log.warn(`⚠ cuentas.json no se pudo leer (${e.message}); copia en ${copia}`);
      }
    }
  }
  // con almacen: trae los datos guardados (si no hay nada, arranca vacío)
  async cargar() {
    if (!this.almacen) return;
    const d = await this.almacen.cargar();
    if (d) this.datos = { ...this.datos, ...d };
  }

  // ---------- guardado ----------
  guardar() {
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.guardarYa(); }, this.almacen ? 400 : 150);
  }
  // devuelve una promesa que termina cuando quedó guardado (con archivo ya está guardado al volver)
  guardarYa() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.almacen) {
      const json = JSON.stringify(this.datos);
      this.cola = this.cola.then(() => this.almacen.guardar(json)).catch((e) => this.log.warn(`⚠ no se pudieron guardar las cuentas: ${e.message}`));
      return this.cola;
    }
    const tmp = `${this.archivo}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.datos));
    fs.renameSync(tmp, this.archivo); // atómico: nunca queda un archivo a medio escribir
    return Promise.resolve();
  }

  usuario(nombre) { return this.datos.usuarios[clave(nombre)] || null; }

  // ---------- registro y sesiones ----------
  async registrar(usuario, pass, { admin = false } = {}) {
    usuario = String(usuario || '').trim();
    pass = String(pass || '');
    if (!USUARIO_RE.test(usuario)) return error('El usuario tiene que tener de 3 a 16 letras, números o _.');
    if (pass.length < CLAVE_MIN || pass.length > 200) return error(`La contraseña tiene que tener al menos ${CLAVE_MIN} caracteres.`);
    if (this.usuario(usuario)) return error('Ese usuario ya existe.', 409);
    const u = {
      usuario, clave: await hashClave(pass), creada: this.ahora(), pavos: PAVOS_INICIALES, skins: [], equipo: { ...EQUIPO_INICIAL },
      admin: !!admin, tienda: null, stats: { partidas: 0, victorias: 0, kills: 0, ganados: 0 }, historial: [],
    };
    if (this.usuario(usuario)) return error('Ese usuario ya existe.', 409); // por si se registró mientras se calculaba el hash
    this.datos.usuarios[clave(usuario)] = u;
    this.anotar(u, 'cuenta', 'Cuenta creada', PAVOS_INICIALES);
    this.guardar();
    return { ok: true, token: this.nuevaSesion(u), cuenta: this.publica(u) };
  }

  async entrar(usuario, pass) {
    const u = this.usuario(String(usuario || '').trim());
    // si no existe igual se calcula un hash, para no delatar qué usuarios existen por el tiempo de respuesta
    if (!u) { await hashClave(String(pass || 'x')); return error('Usuario o contraseña incorrectos.', 401); }
    if (!(await claveCorrecta(String(pass || ''), u.clave))) return error('Usuario o contraseña incorrectos.', 401);
    return { ok: true, token: this.nuevaSesion(u), cuenta: this.publica(u) };
  }

  nuevaSesion(u) {
    const token = crypto.randomBytes(32).toString('base64url');
    const t = this.ahora();
    for (const [h, s] of Object.entries(this.datos.sesiones)) if (s.exp < t) delete this.datos.sesiones[h];
    this.datos.sesiones[hashToken(token)] = { u: clave(u.usuario), exp: t + SESION_DIAS * 86400000 };
    this.guardar();
    return token;
  }
  deToken(token) {
    if (!token || typeof token !== 'string' || token.length > 200) return null;
    const s = this.datos.sesiones[hashToken(token)];
    if (!s || s.exp < this.ahora()) return null;
    return this.datos.usuarios[s.u] || null;
  }
  salir(token) {
    delete this.datos.sesiones[hashToken(token)];
    this.guardar();
    return { ok: true };
  }

  // La cuenta admin se crea (o se actualiza) con variables de entorno al arrancar, nunca con una clave en el repo.
  async asegurarAdmin(usuario, pass) {
    if (!usuario || !pass) return null;
    const u = this.usuario(usuario);
    if (!u) {
      const r = await this.registrar(usuario, pass, { admin: true });
      if (!r.ok) this.log.warn(`⚠ No se pudo crear la cuenta admin: ${r.error}`);
      return r.ok ? this.usuario(usuario) : null;
    }
    u.admin = true;
    if (!(await claveCorrecta(pass, u.clave))) u.clave = await hashClave(pass);
    this.guardar();
    return u;
  }

  // ---------- vista pública de la cuenta ----------
  tiene(u, id) { return GRATIS.includes(id) || u.skins.includes(id); }

  tiendaDe(u) {
    const dia = diaDe(this.ahora());
    if (!u.tienda || u.tienda.dia !== dia) {
      u.tienda = { dia, rerolls: 0, ...rotacion(hash(`${clave(u.usuario)}:${dia}:0`), (id) => this.tiene(u, id)) };
      this.guardar();
    }
    return u.tienda;
  }

  publica(u) {
    const t = this.tiendaDe(u);
    return {
      usuario: u.usuario, pavos: u.pavos, admin: !!u.admin, skins: [...GRATIS, ...u.skins], equipo: equipoValido(u.equipo, (id) => this.tiene(u, id)),
      tienda: { destacados: t.destacados, diarios: t.diarios, rerolls: t.rerolls, costoReroll: costoReroll(t.rerolls), cambia: proximoCambio(this.ahora()) },
      stats: u.stats, historial: u.historial.slice(-15).reverse(),
    };
  }

  anotar(u, tipo, texto, pavos = 0) {
    u.historial.push({ t: this.ahora(), tipo, texto, pavos });
    if (u.historial.length > HISTORIAL) u.historial.splice(0, u.historial.length - HISTORIAL);
  }
  darSkin(u, id) {
    // devuelve las skins nuevas (un traje puede traer su mochila)
    const nuevas = [];
    for (const s of [id, SKIN[id]?.incluye].filter(Boolean)) {
      if (!this.tiene(u, s)) { u.skins.push(s); nuevas.push(s); }
    }
    return nuevas;
  }
  sacarSkin(u, id) {
    const i = u.skins.indexOf(id);
    if (i < 0) return false;
    u.skins.splice(i, 1);
    const s = SKIN[id];
    if (s && u.equipo[s.tipo] === id) u.equipo[s.tipo] = EQUIPO_INICIAL[s.tipo];
    return true;
  }
  sumar(u, n) { u.pavos = Math.max(0, Math.min(MAX_PAVOS, u.pavos + n)); }

  // ---------- tienda ----------
  comprar(u, id) {
    const s = SKIN[id];
    if (!s || s.gratis) return error('Esa skin no se vende.');
    const t = this.tiendaDe(u);
    if (!t.destacados.includes(id) && !t.diarios.includes(id)) return error('Esa skin no está en tu tienda de hoy.');
    if (this.tiene(u, id)) return error('Ya la tenés.');
    const p = precio(s);
    if (u.pavos < p) return error('No te alcanzan los pavos.', 402);
    u.pavos -= p;
    const nuevas = this.darSkin(u, id);
    this.anotar(u, 'compra', `Compraste ${s.nombre}`, -p);
    this.guardar();
    return { ok: true, nuevas, cuenta: this.publica(u) };
  }

  reroll(u) {
    const t = this.tiendaDe(u);
    const c = costoReroll(t.rerolls);
    if (u.pavos < c) return error('No te alcanzan los pavos para volver a sortear.', 402);
    u.pavos -= c;
    t.rerolls++;
    Object.assign(t, rotacion(hash(`${clave(u.usuario)}:${t.dia}:${t.rerolls}`), (id) => this.tiene(u, id)));
    this.anotar(u, 'reroll', 'Volviste a sortear la tienda', -c);
    this.guardar();
    return { ok: true, cuenta: this.publica(u) };
  }

  equipar(u, tipo, id) {
    if (!EQUIPO_INICIAL.hasOwnProperty(tipo)) return error('Tipo de skin desconocido.');
    if (id === null || id === undefined || id === '') {
      if (!OPCIONALES.has(tipo)) return error('Ese lugar no puede quedar vacío.');
      u.equipo[tipo] = null;
    } else {
      const s = SKIN[id];
      if (!s || s.tipo !== tipo) return error('Esa skin no va ahí.');
      if (!this.tiene(u, id)) return error('Todavía no tenés esa skin.', 403);
      u.equipo[tipo] = id;
    }
    this.guardar();
    return { ok: true, cuenta: this.publica(u) };
  }

  vender(u, id) {
    const s = SKIN[id];
    if (!s || s.gratis || !u.skins.includes(id)) return error('No tenés esa skin para vender.');
    const p = precioVenta(s);
    this.sacarSkin(u, id);
    this.sumar(u, p);
    this.anotar(u, 'venta', `Vendiste ${s.nombre}`, p);
    this.guardar();
    return { ok: true, pavos: p, cuenta: this.publica(u) };
  }

  // ---------- cajas y apuestas ----------
  abrirCaja(u, cajaId) {
    const caja = CAJA[cajaId];
    if (!caja) return error('Esa caja no existe.');
    if (u.pavos < caja.precio) return error('No te alcanzan los pavos para esa caja.', 402);
    u.pavos -= caja.precio;
    const premio = tirarCaja(caja, this.rand);
    const repetida = this.tiene(u, premio.id);
    let reintegro = 0, nuevas = [];
    if (repetida) { reintegro = reintegroRepetida(premio); this.sumar(u, reintegro); } else nuevas = this.darSkin(u, premio.id);
    this.anotar(u, 'caja', `${caja.nombre}: ${premio.nombre}${repetida ? ' (repetida)' : ''}`, reintegro - caja.precio);
    this.guardar();
    const pos = 33;
    return { ok: true, premio: premio.id, repetida, reintegro, nuevas, cinta: cintaCaja(caja, premio, 40, pos, this.rand), pos, cuenta: this.publica(u) };
  }

  moneda(u, monto, lado) {
    monto = entero(monto);
    if (!Number.isInteger(monto) || monto < MONEDA.min || monto > MONEDA.max) return error(`La apuesta va de ${MONEDA.min} a ${MONEDA.max} pavos.`);
    if (lado !== 'cara' && lado !== 'cruz') return error('Elegí cara o cruz.');
    if (u.pavos < monto) return error('No te alcanzan los pavos para esa apuesta.', 402);
    const salio = this.rand() < 0.5 ? 'cara' : 'cruz';
    const gano = salio === lado;
    this.sumar(u, gano ? monto : -monto);
    this.anotar(u, 'moneda', `Cara o cruz: salió ${salio}`, gano ? monto : -monto);
    this.guardar();
    return { ok: true, salio, gano, monto, cuenta: this.publica(u) };
  }

  contrato(u, ids) {
    const r = contratoValido(ids);
    if (r === null) return error('El contrato necesita 5 skins distintas de la misma rareza (no Legendarias).');
    if (!ids.every((id) => u.skins.includes(id))) return error('No tenés todas esas skins.');
    for (const id of ids) this.sacarSkin(u, id);
    const premio = tirarContrato(r, (id) => this.tiene(u, id), this.rand);
    const repetida = this.tiene(u, premio.id);
    let reintegro = 0, nuevas = [];
    if (repetida) { reintegro = reintegroRepetida(premio); this.sumar(u, reintegro); } else nuevas = this.darSkin(u, premio.id);
    this.anotar(u, 'contrato', `Contrato: ${premio.nombre}${repetida ? ' (repetida)' : ''}`, reintegro);
    this.guardar();
    return { ok: true, premio: premio.id, repetida, reintegro, nuevas, cuenta: this.publica(u) };
  }

  // ---------- partidas ----------
  premiar(u, datos) {
    const p = premioPartida(datos);
    this.sumar(u, p.total);
    u.stats.partidas++;
    if (datos.gano) u.stats.victorias++;
    u.stats.kills += (datos.killsPersonas || 0) + (datos.killsBots || 0);
    u.stats.ganados += p.total;
    this.anotar(u, 'partida', datos.gano ? '¡Ganaste una partida!' : 'Partida jugada', p.total);
    this.guardar();
    return p;
  }

  // ---------- admin ----------
  listar(q = '') {
    q = String(q || '').toLowerCase();
    return Object.values(this.datos.usuarios)
      .filter((u) => !q || u.usuario.toLowerCase().includes(q))
      .sort((a, b) => a.usuario.localeCompare(b.usuario))
      .slice(0, 100)
      .map((u) => ({ usuario: u.usuario, pavos: u.pavos, admin: !!u.admin, skins: u.skins.length, partidas: u.stats.partidas, creada: u.creada }));
  }

  ver(nombre) {
    const u = this.usuario(nombre);
    return u ? { ok: true, usuario: { usuario: u.usuario, pavos: u.pavos, admin: !!u.admin, skins: [...u.skins], equipo: u.equipo, stats: u.stats } } : error('No existe ese usuario.', 404);
  }

  // dar pavos (positivo o negativo: el saldo nunca baja de 0) y/o una skin
  dar(admin, nombre, { pavos, skin } = {}) {
    if (!admin?.admin) return error('Solo la cuenta admin puede hacer eso.', 403);
    const u = this.usuario(nombre);
    if (!u) return error('No existe ese usuario.', 404);
    const cambios = [];
    if (pavos !== undefined && pavos !== null && pavos !== '') {
      const n = entero(pavos);
      if (!Number.isInteger(n) || Math.abs(n) > 1_000_000 || n === 0) return error('Los pavos tienen que ser un número entero distinto de 0 (hasta 1.000.000).');
      const antes = u.pavos;
      this.sumar(u, n);
      this.anotar(u, 'admin', n > 0 ? `${admin.usuario} te dio pavos` : `${admin.usuario} te sacó pavos`, u.pavos - antes);
      cambios.push(`${n > 0 ? '+' : ''}${u.pavos - antes} pavos`);
    }
    if (skin) {
      const s = SKIN[skin];
      if (!s) return error('Esa skin no existe.');
      if (s.gratis || this.tiene(u, skin)) return error(`${u.usuario} ya tiene ${s.nombre}.`, 409);
      this.darSkin(u, skin);
      this.anotar(u, 'admin', `${admin.usuario} te regaló ${s.nombre}`, 0);
      cambios.push(s.nombre);
    }
    if (!cambios.length) return error('No hay nada para dar.');
    this.registroAdmin(admin, 'dar', u.usuario, cambios.join(', '));
    this.guardar();
    return { ok: true, usuario: this.ver(u.usuario).usuario, cambios };
  }

  quitar(admin, nombre, skin) {
    if (!admin?.admin) return error('Solo la cuenta admin puede hacer eso.', 403);
    const u = this.usuario(nombre);
    if (!u) return error('No existe ese usuario.', 404);
    const s = SKIN[skin];
    if (!s || !this.sacarSkin(u, skin)) return error('Ese usuario no tiene esa skin.');
    this.anotar(u, 'admin', `${admin.usuario} te sacó ${s.nombre}`, 0);
    this.registroAdmin(admin, 'quitar', u.usuario, s.nombre);
    this.guardar();
    return { ok: true, usuario: this.ver(u.usuario).usuario };
  }

  registroAdmin(admin, accion, usuario, detalle) {
    const r = this.datos.registroAdmin;
    r.push({ t: this.ahora(), admin: admin.usuario, accion, usuario, detalle });
    if (r.length > 500) r.splice(0, r.length - 500);
  }
}

export { SKINS };
