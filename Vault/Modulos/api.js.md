# api.js

Volver a [[Inicio]] · sistema: [[Cuentas, tienda y skins (sistema)]]

Archivo: `servidor/api.js` (2026-11-26, solo servidor). `crearApi(cuentas, { alCambiarCuenta })` devuelve el manejador de `/api/*` que usa [[server.js]]. JSON de hasta 8 KB; la sesión va en `Authorization: Bearer <token>`.

| Ruta | Qué hace |
|---|---|
| `POST /api/registro`, `/api/entrar` `{usuario, clave}` | crea o entra; devuelve `token` y `cuenta` |
| `POST /api/salir` | cierra la sesión |
| `GET /api/cuenta` | la cuenta |
| `POST /api/equipar` `{tipo, id}` | equipa (o `id: null` en mochila/envoltorio) |
| `POST /api/tienda/comprar` `{id}`, `/api/tienda/reroll` | tienda |
| `POST /api/vender` `{id}` | vende |
| `POST /api/cajas/abrir` `{caja}` | premio, `repetida`, `reintegro`, `cinta`, `pos` |
| `POST /api/apuestas/moneda` `{monto, lado}`, `/api/apuestas/contrato` `{ids}` | apuestas |
| `GET /api/admin/usuarios?q=`, `/api/admin/usuario?u=` | admin: buscar y ver |
| `POST /api/admin/dar` `{usuario, pavos?, skin?}`, `/api/admin/quitar` `{usuario, skin}` | admin: dar y sacar |

Códigos: 401 sin sesión, 402 sin pavos, 403 sin permiso, 404, 409 y 429 (demasiados intentos). Cuando algo cambia una cuenta, `alCambiarCuenta` le avisa por WebSocket a esa persona (`cuenta`) y, si está en una sala de espera, actualiza sus skins para todos.
