// Base de datos de cuentas, pavos, casino y tienda (SQLite que trae Node, sin dependencias nativas).
// Todo cambio de saldo pasa por mover(): una transacción que nunca deja el saldo negativo.
import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

export const PAVOS_INICIALES = 1000;

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario TEXT NOT NULL UNIQUE COLLATE NOCASE,
  hash TEXT NOT NULL,
  sal TEXT NOT NULL,
  pavos INTEGER NOT NULL DEFAULT 0 CHECK (pavos >= 0),
  skin_puesta TEXT,
  creado INTEGER NOT NULL,
  ip_registro TEXT
);
CREATE TABLE IF NOT EXISTS sesiones (
  token TEXT PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  vence INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sesiones_usuario ON sesiones(usuario_id);
CREATE TABLE IF NOT EXISTS skins_compradas (
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  skin_id TEXT NOT NULL,
  fecha INTEGER NOT NULL,
  PRIMARY KEY (usuario_id, skin_id)
);
CREATE TABLE IF NOT EXISTS movimientos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  saldo INTEGER NOT NULL,
  motivo TEXT NOT NULL,
  detalle TEXT,
  fecha INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS movimientos_usuario ON movimientos(usuario_id, motivo, fecha);
-- Espacio listo para los anuncios con premio (todavía no se usa: ver server/premios.js).
CREATE TABLE IF NOT EXISTS anuncios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  empezado INTEGER NOT NULL,
  terminado INTEGER
);
-- Mano de blackjack en curso de cada cuenta (sobrevive a recargar la página y a reiniciar el servidor).
CREATE TABLE IF NOT EXISTS blackjack (
  usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  estado TEXT NOT NULL
);
`;

export class SinSaldo extends Error { constructor() { super('No te alcanzan los pavos.'); this.codigo = 'sin_saldo'; } }

// ruta: archivo de la base o ':memory:' (pruebas).
export function abrirDB(ruta = process.env.SF_DB || 'datos/salto.db') {
  if (ruta !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(ruta)), { recursive: true });
  const db = new DatabaseSync(ruta);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
  db.exec(ESQUEMA);

  const q = {
    usuarioPorId: db.prepare('SELECT id, usuario, pavos, skin_puesta FROM usuarios WHERE id = ?'),
    restar: db.prepare('UPDATE usuarios SET pavos = pavos - ? WHERE id = ? AND pavos >= ?'),
    sumar: db.prepare('UPDATE usuarios SET pavos = pavos + ? WHERE id = ?'),
    saldo: db.prepare('SELECT pavos FROM usuarios WHERE id = ?'),
    mov: db.prepare('INSERT INTO movimientos (usuario_id, delta, saldo, motivo, detalle, fecha) VALUES (?, ?, ?, ?, ?, ?)'),
  };

  // Corre fn dentro de una transacción (anidable: si ya hay una abierta, usa un savepoint).
  let nivel = 0;
  function transaccion(fn) {
    const sp = `sp${nivel}`;
    db.exec(nivel === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${sp}`);
    nivel++;
    try {
      const r = fn();
      nivel--;
      db.exec(nivel === 0 ? 'COMMIT' : `RELEASE ${sp}`);
      return r;
    } catch (e) {
      nivel--;
      db.exec(nivel === 0 ? 'ROLLBACK' : `ROLLBACK TO ${sp}; RELEASE ${sp}`);
      throw e;
    }
  }

  // Cambia el saldo en delta pavos (negativo = gasto) y deja el movimiento. Tira SinSaldo si no alcanza.
  function mover(usuarioId, delta, motivo, detalle = null) {
    delta = Math.trunc(delta);
    return transaccion(() => {
      if (delta < 0) {
        const r = q.restar.run(-delta, usuarioId, -delta);
        if (r.changes === 0) throw new SinSaldo();
      } else if (delta > 0) q.sumar.run(delta, usuarioId);
      const saldo = q.saldo.get(usuarioId)?.pavos ?? 0;
      q.mov.run(usuarioId, delta, saldo, motivo, detalle == null ? null : JSON.stringify(detalle), Date.now());
      return saldo;
    });
  }

  const saldo = (usuarioId) => q.saldo.get(usuarioId)?.pavos ?? 0;
  const usuario = (usuarioId) => q.usuarioPorId.get(usuarioId) || null;

  return { db, transaccion, mover, saldo, usuario, cerrar: () => db.close() };
}
