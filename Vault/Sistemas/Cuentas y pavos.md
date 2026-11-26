# Cuentas y pavos

Volver a [[Inicio]] · pedido: [[Cuentas, casino y tienda]] · código: [[cuentas.js]] · [[db.js]] · [[premios.js]] · [[api.js]] · [[cuenta.js]]

## Cuentas

- Usuario (3 a 16 letras, números o `_`, único sin distinguir mayúsculas) y contraseña (8 a 128 caracteres). La contraseña se guarda con `crypto.scrypt` y sal aleatoria.
- Sesión: token aleatorio en la cookie `sf_sesion` (`HttpOnly`, `SameSite=Lax`, `Secure` con HTTPS), 30 días. El WebSocket lee la cookie al conectarse ([[server.js]]); sin cookie válida se juega como **invitado**.
- Límites: 10 intentos de login por minuto (por IP y por usuario) y 5 cuentas nuevas por IP por día.
- Una cuenta juega en una sola sala: si entra desde otra pestaña, la conexión vieja recibe un `error` y se cierra.
- Invitado: escribe su nombre y juega partidas; no tiene pavos (casino, tienda, casillero y anuncios con candado en el lobby).

## Pavos

- Moneda del juego, solo para cuentas. **No se compran con plata ni se cambian por nada.**
- Todo cambio de saldo pasa por `mover()` de [[db.js]]: una transacción que no deja el saldo negativo (además, la columna tiene `CHECK (pavos >= 0)`) y deja una fila en `movimientos` (motivos: `bienvenida`, `kill`, `ruleta`, `ruleta_premio`, `slots`, `slots_premio`, `blackjack`, `blackjack_premio`, `tienda`).
- **1000** al registrarse (`PAVOS_INICIALES`).
- **100 por eliminación** (`PAVOS_POR_KILL`), en `killPlayer` de [[server.js]] con `pagarKill` de [[premios.js]]. No pagan: invitado que elimina, uno mismo, partida que empezó con menos de 2 jugadores, víctima invitada de la misma IP que el que elimina; tope de 2000 pavos por eliminaciones en 24 horas (`TOPE_KILLS_24H`). Eliminar a otra **cuenta** de la misma IP sí paga (amigos en la misma red); se decidió así en vez de "otra IP" como decía el plan, porque el juego se juega mucho en la misma red.
- El servidor avisa con el mensaje `pavos` (`saldo`, `delta`, `motivo`); el HUD muestra "+100" y el saldo arriba (`#hudPavos`, `#pavosToast`).
- **500 por anuncio**: espacio listo, sin activar. Ver [[anuncios.js]] y [[premios.js]].
