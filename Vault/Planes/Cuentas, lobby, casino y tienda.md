# Cuentas, lobby, casino y tienda (plan)

Volver a [[Inicio]] · Pedido: [[Cuentas, casino y tienda]]

Estado: **plan, sin implementar** (2026-11-26).

## Qué cambia para el jugador

1. Al abrir el juego aparece **Iniciar sesión / Crear cuenta** (usuario + contraseña).
2. Después entra al **lobby**: su personaje en 3D girando sobre una plataforma con la skin puesta, el saldo de **pavos** arriba y botones **Jugar**, **Casino**, **Tienda** y **Casillero**, más ⚙ Configuración.
3. **Jugar** lleva a lo que hoy es el menú: crear sala o unirse con código. La sala de espera de hoy sigue igual. El nombre en la partida es el de la cuenta.
4. Cada cuenta nueva arranca con **1000 pavos** (una sola vez, al registrarse).
5. **Casino**: ruleta, blackjack y tragamonedas, apostando pavos.
6. **Tienda**: comprar skins con pavos. **Casillero**: elegir cuál usar. Los demás la ven en la partida.

## Arquitectura

Mantiene la regla de [[Arquitectura]]: el cliente solo muestra; **el servidor decide saldo, apuestas, resultados y compras**. Ningún resultado del casino se calcula en el navegador.

### Persistencia

- Base de datos **SQLite** con `node:sqlite` (viene con Node 22, no agrega dependencias nativas). Archivo `datos/salto.db` (en `.gitignore`), ruta configurable con `SF_DB`.
- Tablas:
  - `usuarios(id, usuario UNIQUE, hash, sal, pavos, skin_puesta, creado)`
  - `sesiones(token, usuario_id, vence)`
  - `skins_compradas(usuario_id, skin_id, fecha)`
  - `movimientos(id, usuario_id, delta, saldo, motivo, detalle, fecha)`: registro de cada apuesta, premio y compra, para auditar y para las pruebas.
- Cada cambio de saldo va en una transacción con `UPDATE ... SET pavos = pavos - ? WHERE id = ? AND pavos >= ?`, así nunca queda negativo ni se gasta dos veces con dos pestañas.
- Ojo con el hosting: Render, Railway, etc. necesitan un disco persistente montado, si no se borran las cuentas en cada deploy. Va al README.

### Cuentas y sesión

- Contraseña con `crypto.scrypt` y sal aleatoria (sin dependencias). Usuario de 3 a 16 caracteres `[A-Za-z0-9_]`, contraseña de al menos 8.
- Sesión: token aleatorio de 32 bytes en una cookie `sf_sesion` (`HttpOnly`, `SameSite=Lax`, `Secure` si va por HTTPS), con vencimiento de 30 días.
- El WebSocket lee la cookie en el `upgrade` y asocia la conexión a la cuenta. Se revisa el `Origin`.
- Límite de intentos de login por IP y por usuario (por ejemplo, 10 por minuto).
- Endpoints HTTP JSON: `POST /api/registro`, `POST /api/login`, `POST /api/salir`, `GET /api/yo` (usuario, pavos, skin puesta, skins compradas).

### Casino (servidor)

Azar con `crypto.randomInt` en el servidor. Apuesta mínima 10 y máxima 500 pavos (constantes en un solo lugar). Endpoints `POST /api/casino/<juego>/...`; cada respuesta trae el resultado y el saldo nuevo, y el cliente solo anima.

- **Ruleta europea** (un solo 0). Apuestas: número (paga 35 a 1), rojo/negro, par/impar, 1–18/19–36 (1 a 1), docenas y columnas (2 a 1). Se pueden poner varias fichas en una tirada.
- **Blackjack**: un mazo de 6 barajas que se mezcla cuando queda un cuarto. Pedir, plantarse, doblar y dividir. El crupier se planta en 17. Blackjack natural paga 3 a 2. La mano en curso vive en el servidor, ligada a la cuenta. Si se corta la conexión, la mano se retoma o se cierra plantándose.
- **Tragamonedas**: 3 rodillos con símbolos propios del juego (paracaídas, cofre, pico, bus, cohete, etc.). La tabla de pagos se calcula para que devuelva cerca del 95 %.
- Reglas de cada juego en módulos sin dependencias (`server/casino/ruleta.js`, `blackjack.js`, `slots.js`), para poder probarlos solos.

### Tienda y skins

- Catálogo compartido `public/js/skins.js` (lo usan el servidor y el cliente): `id`, nombre, rareza (las cinco de [[Loot y rarezas]]), precio y apariencia.
- **Primera tanda: skins de color y material.** El personaje ya se tiñe por el material `Ropa` ([[models.js]]). La skin define los colores de la ropa (y de la vela del paracaídas), sin tocar el GLB. Precios orientativos: común 200, poco común 400, rara 800, épica 1200, legendaria 2000.
- **Segunda tanda: skins con piezas nuevas** (casco, capucha, mochila, estampados), modeladas en Blender con el pipeline de [[Pipeline del héroe]] y revisadas con `brazos_choque.py` para que nada atraviese el cuerpo.
- La tienda muestra el catálogo con vista previa en 3D. Más adelante puede rotar ofertas por día.
- Compra: `POST /api/tienda/comprar {skin}` → descuenta y registra. Equipar: `POST /api/casillero/poner {skin}`.
- En la partida, `publicPlayer` manda `skin` además de `color`. El `color` único por sala se queda para el nombre, el minimapa y el killfeed. `createCharacter` recibe la skin en vez de solo el color.

## Archivos

Nuevos:

- `server/db.js`: abre la base, crea las tablas, funciones de saldo con transacción.
- `server/cuentas.js`: registro, login, sesiones, cookies, límite de intentos.
- `server/casino/*.js` y `server/tienda.js`: reglas y endpoints.
- `server/api.js`: rutea `/api/*` y lee el JSON del cuerpo, con un tamaño máximo.
- `public/js/skins.js`: catálogo compartido.
- `public/js/cuenta.js`: pantalla de login y registro, y cliente de la API.
- `public/js/lobby.js`: escena 3D del lobby y sus botones.
- `public/js/casino.js` (+ `casino/ruleta.js`, `blackjack.js`, `slots.js`): interfaz y animaciones del casino.
- `public/js/tienda.js`: tienda y casillero.
- Pruebas `tools/cuentas/pruebas.mjs` y `tools/casino/pruebas.mjs`. Revisan registro y login, contraseña mal, saldo nunca negativo, dos apuestas a la vez, y el retorno de cada juego con un millón de tiradas simuladas (ruleta ≈ 97,3 %, slots ≈ 95 %, blackjack con estrategia básica ≈ 99,5 %). También revisan que no se pueda comprar sin saldo ni dos veces la misma skin.

Cambian:

- `server.js`: monta `api.js`, lee la sesión en el WebSocket y usa el nombre y la skin de la cuenta.
- `public/index.html` + `style.css`: pantallas nuevas (login, lobby, casino, tienda).
- `public/js/main.js`: el flujo arranca en `cuenta.js` → `lobby.js` → menú de salas de siempre.
- `public/js/models.js`: `createCharacter(skin)`.
- `README.md` y vault: notas nuevas en `Sistemas/` (Cuentas, Casino, Tienda) y `Modulos/`, y la lista de endpoints en [[Protocolo de red]].

## Orden de trabajo (un PR por paso)

1. Base de datos + cuentas + login/registro + pantalla de login + 1000 pavos al registrarse.
2. Lobby 3D con saldo y botones (Casino y Tienda todavía deshabilitados).
3. Casino: ruleta → tragamonedas → blackjack, cada uno con sus pruebas de retorno.
4. Tienda + casillero + skins de color, y la skin visible en la partida.
5. Skins con piezas modeladas en Blender.

## Límites

- Los pavos **no se compran con plata real ni se cambian por nada**. Si algún día se quisiera vender pavos, el casino pasaría a ser juego con dinero real y habría que sacarlo o revisarlo legalmente.
- Mostrar en el casino que es solo con pavos del juego.

## Decisiones abiertas

- ¿Se puede seguir jugando **sin cuenta** (como invitado, sin pavos ni skins) o la cuenta es obligatoria?
- Si alguien se queda en 0 pavos, ¿hay una **recarga** (por ejemplo, 100 pavos por día) o se gana algo jugando partidas (por eliminación o por ganar)?
- **Lobby**: ¿escena 3D con el personaje (estilo battle royale) o una pantalla 2D más simple?
- **Casino**: ¿cada uno juega solo, o mesas compartidas (ruleta y blackjack con otros jugadores conectados)?
- **Skins**: ¿alcanza con la primera tanda de colores, o desde el arranque se quieren modelos nuevos en Blender?
- Login: ¿alcanza con usuario y contraseña, o se quiere también "entrar con Google"? (Eso necesita registrar la app en Google y tener un dominio).
