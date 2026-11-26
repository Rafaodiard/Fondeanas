// Tienda de skins y casillero. El catálogo (public/js/skins.js) está vacío por ahora; las pruebas pasan uno propio.
import { SKINS, skinDe } from '../public/js/skins.js';

export class ErrorTienda extends Error { constructor(msg, codigo = 'invalido', estado = 400) { super(msg); this.codigo = codigo; this.estado = estado; } }

export function crearTienda(base, catalogo = SKINS) {
  const { db, transaccion, mover, saldo } = base;
  const q = {
    compradas: db.prepare('SELECT skin_id FROM skins_compradas WHERE usuario_id = ? ORDER BY fecha'),
    tiene: db.prepare('SELECT 1 FROM skins_compradas WHERE usuario_id = ? AND skin_id = ?'),
    comprar: db.prepare('INSERT INTO skins_compradas (usuario_id, skin_id, fecha) VALUES (?, ?, ?)'),
    poner: db.prepare('UPDATE usuarios SET skin_puesta = ? WHERE id = ?'),
    puesta: db.prepare('SELECT skin_puesta FROM usuarios WHERE id = ?'),
  };

  const compradas = (uid) => q.compradas.all(uid).map((f) => f.skin_id);
  // Skin puesta (si ya no existe en el catálogo, vuelve a la de fábrica).
  const puesta = (uid) => { const id = q.puesta.get(uid)?.skin_puesta; return id && skinDe(id, catalogo) ? id : null; };

  function estado(uid) {
    return { catalogo, compradas: compradas(uid), puesta: puesta(uid), saldo: saldo(uid) };
  }

  function comprar(uid, id) {
    const s = typeof id === 'string' ? skinDe(id, catalogo) : null;
    if (!s) throw new ErrorTienda('Esa skin no existe.', 'no_existe', 404);
    return transaccion(() => {
      if (q.tiene.get(uid, s.id)) throw new ErrorTienda('Ya tenés esa skin.', 'ya_la_tenes', 409);
      mover(uid, -s.precio, 'tienda', { skin: s.id });
      q.comprar.run(uid, s.id, Date.now());
      return estado(uid);
    });
  }

  // id null = la de fábrica.
  function poner(uid, id) {
    if (id != null) {
      if (typeof id !== 'string' || !skinDe(id, catalogo)) throw new ErrorTienda('Esa skin no existe.', 'no_existe', 404);
      if (!q.tiene.get(uid, id)) throw new ErrorTienda('Todavía no compraste esa skin.', 'no_la_tenes', 403);
    }
    q.poner.run(id ?? null, uid);
    return estado(uid);
  }

  return { estado, comprar, poner, puesta };
}
