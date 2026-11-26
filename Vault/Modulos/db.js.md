# db.js

Volver a [[Inicio]] · [[Cuentas y pavos]]

Archivo: `server/db.js`. Abre la base SQLite (`node:sqlite`, viene con Node 22) en `SF_DB` o `datos/salto.db` (`:memory:` en las pruebas) y crea las tablas: `usuarios`, `sesiones`, `skins_compradas`, `movimientos`, `anuncios` (sin usar) y `blackjack`.

- `transaccion(fn)`: `BEGIN IMMEDIATE` / `COMMIT`, anidable con savepoints.
- `mover(uid, delta, motivo, detalle)`: cambia el saldo y deja el movimiento; tira `SinSaldo` si no alcanza.
- `saldo(uid)`, `usuario(uid)`.
