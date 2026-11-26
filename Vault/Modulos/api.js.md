# api.js

Volver a [[Inicio]] · [[Protocolo de red]]

Archivo: `server/api.js`. Rutas JSON en `/api/*` que atiende [[server.js]] antes de los archivos estáticos. Los POST piden `Content-Type: application/json`, mismo `Origin` y cuerpo de hasta 8 KB. Las que piden cuenta responden 401 `sin_sesion` sin cookie válida; sin saldo, 402 con el saldo actual.

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/yo` | cuenta (o `null`), límites del casino y pavos por eliminación |
| POST | `/api/registro`, `/api/login` | `{usuario, pass}` → pone la cookie |
| POST | `/api/salir` | borra la sesión |
| POST | `/api/casino/ruleta` | `{apuestas:[{tipo, n?, monto}]}` |
| POST | `/api/casino/slots` | `{monto}` |
| GET | `/api/casino/blackjack` | mano en curso |
| POST | `/api/casino/blackjack/repartir`, `/jugar` | `{monto}` / `{accion}` |
| GET | `/api/tienda` | catálogo, compradas, puesta, saldo |
| POST | `/api/tienda/comprar`, `/api/casillero/poner` | `{skin}` |
