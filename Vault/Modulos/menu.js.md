# menu.js

Volver a [[Inicio]] · sistema: [[Cuentas, tienda y skins (sistema)]] · pantalla: [[index.html]]

Archivo: `public/js/menu.js` (2026-11-26). El menú principal con cuentas. Pide todo a la API ([[api.js]]) con el token en `Authorization: Bearer`, guardado en `localStorage` (`sf-token`).

- **Entrar / crear cuenta** (`#login`): aparece la primera vez; *Seguir como invitado* no vuelve a preguntar.
- Barra de arriba: pestañas, pavos (`#mPavos`, cuentan hacia arriba o abajo) y el usuario (`#btnCuenta`: estadísticas, movimientos y cerrar sesión).
- Pestañas: **Jugar** (el panel de siempre), **Tienda** (destacadas, del día, reloj hasta el cambio y reroll), **Casillero** (por tipo: equipar y vender), **Cajas** (probabilidades, *Ver qué trae* y la ruleta), **Apuestas** (cara o cruz y contrato) y **Admin** (solo la cuenta admin).
- A la derecha, la [[vitrina.js]] y el detalle de la skin elegida (`#detalle`) con *Comprar*, *Equipar* o *Vender* (vender pide tocar dos veces).
- Exporta `iniciarMenu()`, `sesion` (token y cuenta), `ponerCuenta(c)`, `avisoPavos(m)`, `abrirSobreSala()` (el casillero arriba de la sala de espera) y `colorDelJugador(c)`. Para pruebas: `window.__menu`.
