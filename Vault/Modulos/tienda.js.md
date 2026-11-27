# tienda.js

Volver a [[Inicio]] · sistema: [[Cuentas, tienda y skins (sistema)]]

Archivo: `public/js/tienda.js` (2026-11-26). Reglas de la economía, compartidas: el servidor ([[cuentas.js]]) las aplica y el menú ([[menu.js]]) las muestra.

- Constantes: `PAVOS_INICIALES` (1000), `TIENDA` (2 destacadas, 6 del día, reroll de 100 a 1600), `VENTA` (40 %), `REPETIDA` (50 %), `MONEDA` (10 a 2000), `CONTRATO` (5), `PREMIOS` (pavos por partida), `ZONA_HORARIA_MS` (Buenos Aires).
- Cajas: `CAJAS` / `CAJA` (`precio`, `pesos` por rareza, `filtro`), `poolCaja`, `probabilidades`, `tirarCaja(caja, rand)`, `cintaCaja` (la tira de la ruleta con el premio en `pos`).
- Tienda: `diaDe`, `proximoCambio`, `costoReroll`, `rotacion(semilla, tiene)` (mulberry32 con semilla `hash` FNV del usuario y el día).
- `contratoValido`, `tirarContrato`, `precioVenta`, `reintegroRepetida`, `premioPartida({ killsPersonas, killsBots, gano, contraPersonas })`.
