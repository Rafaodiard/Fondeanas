# cuentas.js

Volver a [[Inicio]] · [[Cuentas y pavos]]

Archivo: `server/cuentas.js`. `crearCuentas(base)` → `registrar`, `entrar`, `deToken`, `salir`, `limpiarVencidas`. Más: `leerCookies`, `cookieSesion`, `ipDe` (con `SF_CONFIAR_PROXY=1` lee `X-Forwarded-For`), `esSeguro`, `origenValido` (el `Origin` tiene que ser el mismo sitio; lo usan la API y el WebSocket). Constantes en `LIMITES`.
