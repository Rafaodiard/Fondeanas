# casino.js

Volver a [[Inicio]] · [[Casino]]

- `server/casino.js`: `crearCasino(base, azar)` → `ruleta`, `slots`, `blackjackEstado`, `blackjackRepartir`, `blackjackJugar`. Cada jugada es una transacción: descuenta, resuelve con las reglas de `public/js/casino/` y paga.
- `public/js/casino.js`: el panel del casino (`montarCasino`): pestañas, saldo, avisos y las tres mesas de `public/js/mesas/` (`ruleta.js`, `blackjack.js`, `slots.js`, más `fichas.js` e `iconos.js`).
