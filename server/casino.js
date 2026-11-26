// Casino del lado del servidor: el azar sale de acá (crypto.randomInt) y cada apuesta y premio queda en la base.
// Las reglas de cada juego están en public/js/casino/ (sin dependencias, también las usa el cliente para dibujar).
import crypto from 'crypto';
import { validarApuestas, tirar } from '../public/js/casino/ruleta.js';
import { girar } from '../public/js/casino/slots.js';
import * as BJ from '../public/js/casino/blackjack.js';
import { montoValido, APUESTA_MIN, APUESTA_MAX } from '../public/js/casino/reglas.js';

export const azarSeguro = (n) => crypto.randomInt(n);

export class ErrorCasino extends Error { constructor(msg, codigo = 'invalido', estado = 400) { super(msg); this.codigo = codigo; this.estado = estado; } }
const errMonto = () => new ErrorCasino(`La apuesta tiene que ser de ${APUESTA_MIN} a ${APUESTA_MAX} pavos.`, 'monto');

export function crearCasino(base, azar = azarSeguro) {
  const { db, transaccion, mover, saldo } = base;
  const q = {
    leerBJ: db.prepare('SELECT estado FROM blackjack WHERE usuario_id = ?'),
    guardarBJ: db.prepare('INSERT INTO blackjack (usuario_id, estado) VALUES (?, ?) ON CONFLICT(usuario_id) DO UPDATE SET estado = excluded.estado'),
  };

  function ruleta(uid, lista) {
    const v = validarApuestas(lista);
    if (v.error) throw new ErrorCasino(v.error);
    return transaccion(() => {
      mover(uid, -v.total, 'ruleta', { apuestas: v.apuestas });
      const r = tirar(v.apuestas, azar);
      const s = r.premio ? mover(uid, r.premio, 'ruleta_premio', { numero: r.numero }) : saldo(uid);
      return { numero: r.numero, color: r.color, ganadoras: r.ganadoras, apostado: v.total, premio: r.premio, saldo: s };
    });
  }

  function slots(uid, monto) {
    if (!montoValido(monto)) throw errMonto();
    return transaccion(() => {
      mover(uid, -monto, 'slots');
      const r = girar(monto, azar);
      const s = r.premio ? mover(uid, r.premio, 'slots_premio', { rodillos: r.rodillos }) : saldo(uid);
      return { ...r, apostado: monto, saldo: s };
    });
  }

  const leer = (uid) => { const f = q.leerBJ.get(uid); return f ? JSON.parse(f.estado) : null; };
  const guardar = (uid, e) => q.guardarBJ.run(uid, JSON.stringify(e));
  const respuestaBJ = (uid, e) => ({ mano: e?.manos ? BJ.vista(e) : null, saldo: saldo(uid) });

  // Si la mano terminó, paga lo que corresponda.
  function liquidar(uid, e) {
    if (e.fase === 'terminada' && !e.pagada) {
      e.pagada = true;
      if (e.premio) mover(uid, e.premio, 'blackjack_premio', { manos: e.manos.map((m) => m.resultado) });
    }
  }

  function blackjackEstado(uid) { return respuestaBJ(uid, leer(uid)); }

  function blackjackRepartir(uid, monto) {
    if (!montoValido(monto)) throw errMonto();
    return transaccion(() => {
      const previo = leer(uid);
      if (previo?.fase === 'jugando') throw new ErrorCasino('Terminá la mano que tenés en la mesa.', 'mano_en_curso', 409);
      mover(uid, -monto, 'blackjack');
      const e = BJ.repartir(previo, monto, azar);
      liquidar(uid, e);
      guardar(uid, e);
      return respuestaBJ(uid, e);
    });
  }

  function blackjackJugar(uid, accion) {
    return transaccion(() => {
      const e = leer(uid);
      if (!e || e.fase !== 'jugando') throw new ErrorCasino('No hay una mano en juego.', 'sin_mano', 409);
      if (!BJ.acciones(e).includes(accion)) throw new ErrorCasino('No se puede hacer eso ahora.', 'accion');
      const extra = BJ.costo(e, accion);
      if (extra) mover(uid, -extra, 'blackjack', { accion });
      BJ.jugar(e, accion, azar);
      liquidar(uid, e);
      guardar(uid, e);
      return respuestaBJ(uid, e);
    });
  }

  return { ruleta, slots, blackjackEstado, blackjackRepartir, blackjackJugar };
}
