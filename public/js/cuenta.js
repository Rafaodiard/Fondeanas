// Cuenta del jugador en el cliente: pantalla de iniciar sesión / crear cuenta / jugar sin cuenta, el saldo de pavos
// y el cliente de la API (/api/*). El servidor decide todo; acá solo se muestra.

// ---------- API ----------
export class ErrorApi extends Error { constructor(msg, estado, datos = {}) { super(msg); this.estado = estado; this.codigo = datos.codigo; this.datos = datos; } }

export async function api(ruta, cuerpo) {
  let r;
  try {
    r = await fetch(ruta, {
      method: cuerpo === undefined ? 'GET' : 'POST', credentials: 'same-origin',
      headers: cuerpo === undefined ? {} : { 'Content-Type': 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch { throw new ErrorApi('No se pudo conectar con el servidor.', 0); }
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (typeof datos.saldo === 'number') ponerSaldo(datos.saldo);
    if (datos.codigo === 'sin_sesion') { estado.cuenta = null; avisar(); }
    throw new ErrorApi(datos.error || 'Algo salió mal.', r.status, datos);
  }
  if (typeof datos.saldo === 'number') ponerSaldo(datos.saldo);
  return datos;
}

// ---------- Estado ----------
// cuenta: { usuario, pavos, skin } o null; invitado: nombre si entró sin cuenta.
export const estado = { cuenta: null, invitado: null, pavosPorKill: 100, casino: { min: 10, max: 500 } };
const oyentes = new Set();
export function alCambiarCuenta(fn) { oyentes.add(fn); return () => oyentes.delete(fn); }
function avisar(extra) { for (const fn of oyentes) fn(estado, extra); }
export const conCuenta = () => !!estado.cuenta;
export const nombreJugador = () => estado.cuenta?.usuario || estado.invitado || 'Jugador';

export function ponerSaldo(n, delta = 0) {
  if (!estado.cuenta || typeof n !== 'number') return;
  const antes = estado.cuenta.pavos;
  estado.cuenta.pavos = n;
  if (antes !== n || delta) avisar({ saldo: n, antes, delta: delta || n - antes });
}

export async function cargarCuenta() {
  try {
    const d = await api('/api/yo');
    estado.cuenta = d.cuenta;
    if (d.casino) estado.casino = d.casino;
    if (d.pavosPorKill) estado.pavosPorKill = d.pavosPorKill;
  } catch { estado.cuenta = null; }
  avisar();
  return estado.cuenta;
}

export async function salir() {
  try { await api('/api/salir', {}); } catch { /* igual se sale */ }
  estado.cuenta = null; estado.invitado = null;
  avisar();
}

// Formato de pavos: 12.345
export const fmt = (n) => Math.round(n).toLocaleString('es-AR');
// Moneda de pavo (SVG en línea, se ve igual en todos lados).
// El degradado #pavoOro está definido una sola vez en index.html.
export const MONEDA = '<svg class="moneda" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="url(#pavoOro)" stroke="#a86400" stroke-width="1.2"/><circle cx="12" cy="12" r="7.6" fill="none" stroke="#b87300" stroke-width="1" opacity=".55"/><path d="M9.3 17V7h3.6a3 3 0 0 1 0 6H9.3" fill="none" stroke="#8a4f00" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// ---------- Pantalla de cuenta ----------
// alListo() se llama cuando quedó con cuenta o como invitado.
export function montarPantallaCuenta({ raiz, alListo, guardar, leer, sfx }) {
  const $ = (s) => raiz.querySelector(s);
  const tabs = raiz.querySelectorAll('[data-modo]');
  const form = $('#cuentaForm'), usuario = $('#cuentaUsuario'), pass = $('#cuentaPass'), pass2 = $('#cuentaPass2'), error = $('#cuentaError');
  const btn = $('#cuentaEnviar'), invitado = $('#invitadoNombre'), btnInv = $('#btnInvitado');
  let modo = 'login';
  invitado.value = leer('br-name') || '';
  usuario.value = leer('sf-usuario') || '';

  function ponerModo(m) {
    modo = m;
    tabs.forEach((t) => t.classList.toggle('activo', t.dataset.modo === m));
    raiz.classList.toggle('registro', m === 'registro');
    btn.textContent = m === 'login' ? 'Entrar' : 'Crear cuenta';
    pass.autocomplete = m === 'login' ? 'current-password' : 'new-password';
    pass2.required = m === 'registro';
    error.textContent = '';
  }
  tabs.forEach((t) => t.addEventListener('click', () => { sfx?.click(); ponerModo(t.dataset.modo); }));
  ponerModo('login');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    sfx?.unlock();
    error.textContent = '';
    if (modo === 'registro' && pass.value !== pass2.value) { error.textContent = 'Las contraseñas no coinciden.'; return; }
    btn.disabled = true;
    try {
      const d = await api(modo === 'login' ? '/api/login' : '/api/registro', { usuario: usuario.value.trim(), pass: pass.value });
      estado.cuenta = d.cuenta; estado.invitado = null;
      guardar('sf-usuario', d.cuenta.usuario);
      pass.value = ''; pass2.value = '';
      avisar({ nueva: modo === 'registro' });
      alListo();
    } catch (err) { error.textContent = err.message; }
    finally { btn.disabled = false; }
  });
  function entrarInvitado() {
    sfx?.unlock();
    const n = invitado.value.trim().replace(/[<>]/g, '').slice(0, 16) || 'Jugador';
    guardar('br-name', n);
    estado.cuenta = null; estado.invitado = n;
    avisar();
    alListo();
  }
  btnInv.addEventListener('click', entrarInvitado);
  invitado.addEventListener('keydown', (e) => { if (e.key === 'Enter') entrarInvitado(); });

  return {
    mostrar(enModo = 'login') { ponerModo(enModo); raiz.classList.remove('hidden'); setTimeout(() => (usuario.value ? pass : usuario).focus(), 30); },
    ocultar() { raiz.classList.add('hidden'); },
  };
}
