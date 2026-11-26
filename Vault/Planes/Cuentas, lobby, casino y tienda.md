# Cuentas, lobby, casino y tienda (plan)

Volver a [[Inicio]] · Pedido y decisiones: [[Cuentas, casino y tienda]]

Estado: **plan, sin implementar**. Decisiones tomadas el 2026-11-26.

## Qué cambia para el jugador

1. Al abrir el juego aparecen **Iniciar sesión**, **Crear cuenta** (usuario + contraseña) y **Jugar sin cuenta**.
2. Después entra al **lobby 3D**: su personaje girando sobre una plataforma, con luces y fondo de la isla. Arriba se ve el saldo de **pavos**. Botones: **Jugar**, **Casino**, **Tienda**, **Casillero**, **Ver anuncio (+500)** y ⚙ Configuración.
3. **Jugar** lleva a lo que hoy es el menú: crear sala o unirse con código. La sala de espera sigue igual. Con cuenta, el nombre en la partida es el de la cuenta.
4. Cada cuenta nueva arranca con **1000 pavos** (una sola vez, al registrarse).
5. **Ganar pavos:** **100 por cada eliminación** en una partida y **500 por ver un anuncio** entero.
6. **Casino**: ruleta, blackjack y tragamonedas, cada uno **solo contra la casa** (sin mesas compartidas).
7. **Tienda** y **Casillero**: las pantallas existen, pero **sin skins todavía**. Se ven los espacios vacíos con "Próximamente".

### Jugar sin cuenta (invitado)

- Escribe un nombre como hoy y entra al lobby 3D.
- Puede jugar partidas normalmente, pero **no tiene pavos**: Casino, Tienda, Casillero y Ver anuncio aparecen con candado y "Creá una cuenta para usar esto".
- Sus eliminaciones no dan pavos. Las eliminaciones que una cuenta le hace a un invitado sí dan (salvo lo de abajo para evitar trampas).

## Arquitectura

Mantiene la regla de [[Arquitectura]]: el cliente solo muestra; **el servidor decide saldo, apuestas, resultados, premios y compras**. Ningún resultado del casino se calcula en el navegador.

### Persistencia

- Base de datos **SQLite** con `node:sqlite` (viene con Node 22, no agrega dependencias nativas). Archivo `datos/salto.db` (en `.gitignore`), ruta configurable con `SF_DB`.
- Tablas:
  - `usuarios(id, usuario UNIQUE, hash, sal, pavos, skin_puesta, creado)`
  - `sesiones(token, usuario_id, vence)`
  - `skins_compradas(usuario_id, skin_id, fecha)`: queda creada aunque todavía no haya skins.
  - `movimientos(id, usuario_id, delta, saldo, motivo, detalle, fecha)`: cada apuesta, premio, eliminación, anuncio y compra, para auditar y para las pruebas.
  - `anuncios(id, usuario_id, token, empezado, terminado)`: cada anuncio pedido y si se cobró.
- Cada cambio de saldo va en una transacción con `UPDATE ... SET pavos = pavos - ? WHERE id = ? AND pavos >= ?`, así nunca queda negativo ni se gasta dos veces con dos pestañas.
- Hosting: Render, Railway, etc. necesitan un disco persistente montado, si no se borran las cuentas en cada deploy. Va al README.

### Cuentas y sesión

- Solo usuario y contraseña. Contraseña con `crypto.scrypt` y sal aleatoria (sin dependencias). Usuario de 3 a 16 caracteres `[A-Za-z0-9_]`, único sin distinguir mayúsculas; contraseña de al menos 8.
- Sesión: token aleatorio de 32 bytes en una cookie `sf_sesion` (`HttpOnly`, `SameSite=Lax`, `Secure` si va por HTTPS), que vence a los 30 días.
- El WebSocket lee la cookie en el `upgrade` y asocia la conexión a la cuenta; sin cookie válida es invitado. Se revisa el `Origin`.
- Límite de intentos de login por IP y por usuario (por ejemplo, 10 por minuto).
- Endpoints HTTP JSON: `POST /api/registro`, `POST /api/login`, `POST /api/salir`, `GET /api/yo` (usuario, pavos, skin puesta, skins compradas; `null` si es invitado).
- Una cuenta no puede estar en dos salas a la vez (la segunda conexión reemplaza a la primera).

### Pavos por eliminación

- En `killPlayer` ([[server.js]]), si el que eliminó tiene cuenta: +100 pavos, movimiento `motivo='kill'`, y se le avisa por WebSocket (`{t:'pavos', saldo, delta:100, motivo:'kill'}`) para mostrar "+100 🪙" en el HUD.
- No cuentan: eliminarse a uno mismo, la tormenta, las caídas, ni las eliminaciones por explosión de un auto sin atacante.
- **Contra el farmeo** (armar una sala con una segunda cuenta para matarla): la eliminación paga solo si la víctima es una conexión distinta, de otra IP, y la partida empezó con al menos 2 jugadores. Además hay un tope por cuenta (por ejemplo, 2000 pavos por día en eliminaciones). Los valores van en constantes.

### Pavos por anuncio

- Botón **Ver anuncio (+500)** en el lobby. El servidor da un token de anuncio (`POST /api/anuncio/empezar`). El cliente muestra un anuncio con premio ("rewarded"). Cuando termina, manda `POST /api/anuncio/terminar {token}` y el servidor paga 500 si:
  - el token es de esa cuenta y no se usó,
  - pasaron al menos los segundos que dura el anuncio,
  - no pasó el tope diario (por ejemplo, 5 anuncios por día) y la espera entre anuncios (por ejemplo, 2 minutos).
- **Proveedor de anuncios: falta elegir** (ver decisiones abiertas). El código queda detrás de una interfaz `public/js/anuncios.js` con `mostrarAnuncioConPremio() → Promise<'completo'|'cancelado'|'sin-anuncio'>`.
  - Mientras no haya proveedor, en desarrollo (`SF_ANUNCIOS=prueba`) muestra un anuncio de prueba de 15 s con cuenta regresiva, para probar todo el circuito. En producción, sin proveedor, el botón no aparece.
- En la web los anuncios no confirman al servidor que se vieron enteros, así que los topes de arriba son la defensa principal.

### Casino (servidor, un jugador contra la casa)

Azar con `crypto.randomInt` en el servidor. Apuesta mínima 10 y máxima 500 pavos (constantes en un solo lugar). Endpoints `POST /api/casino/<juego>/...`; cada respuesta trae el resultado y el saldo nuevo, y el cliente solo anima. Solo cuentas, no invitados.

- **Ruleta europea** (un solo 0). Apuestas: número (paga 35 a 1), rojo/negro, par/impar, 1–18/19–36 (1 a 1), docenas y columnas (2 a 1). Se pueden poner varias fichas en una tirada.
- **Blackjack**: un mazo de 6 barajas por jugador, que se mezcla cuando queda un cuarto. Pedir, plantarse, doblar y dividir. El crupier se planta en 17. Blackjack natural paga 3 a 2. La mano en curso vive en el servidor, ligada a la cuenta. Si se corta, al volver se retoma.
- **Tragamonedas**: 3 rodillos con símbolos propios del juego (paracaídas, cofre, pico, bus, cohete, etc.). La tabla de pagos se calcula para devolver cerca del 95 %.
- Reglas de cada juego en módulos sin dependencias (`server/casino/ruleta.js`, `blackjack.js`, `slots.js`), para probarlos solos.
- La interfaz del casino se abre desde el lobby 3D como un panel encima (paño verde, fichas, rueda animada, cartas que se reparten, rodillos que giran), con sonidos sintetizados en [[audio.js]].

### Tienda y skins (espacios vacíos)

- Catálogo compartido `public/js/skins.js` (lo usan el servidor y el cliente), con el formato listo (`id`, nombre, rareza de [[Loot y rarezas]], precio, apariencia) pero **la lista vacía**.
- Tienda: grilla con los espacios de las ofertas vacíos y "Próximamente". Casillero: la skin por defecto puesta y los demás espacios vacíos.
- Endpoints `POST /api/tienda/comprar {skin}` y `POST /api/casillero/poner {skin}` armados y probados con una skin de prueba que solo existe en las pruebas. Con el catálogo vacío responden "esa skin no existe".
- `createCharacter` ([[models.js]]) y `publicPlayer` ([[server.js]]) quedan preparados para recibir `skin`. Sin skin usan el color de la sala como hoy.
- Cuando se quieran skins, se agregan al catálogo (y sus modelos en Blender) sin tocar el resto.

## Archivos

Nuevos:

- `server/db.js`: abre la base, crea las tablas, funciones de saldo con transacción.
- `server/cuentas.js`: registro, login, sesiones, cookies, límite de intentos.
- `server/premios.js`: pavos por eliminación (con las reglas contra el farmeo) y por anuncio.
- `server/casino/*.js` y `server/tienda.js`: reglas y endpoints.
- `server/api.js`: rutea `/api/*` y lee el JSON del cuerpo, con un tamaño máximo.
- `public/js/skins.js`: catálogo compartido (vacío).
- `public/js/cuenta.js`: pantalla de login, registro e invitado, y cliente de la API.
- `public/js/lobby.js`: escena 3D del lobby y sus botones.
- `public/js/anuncios.js`: interfaz de anuncios con premio (prueba / proveedor).
- `public/js/casino.js` (+ `casino/ruleta.js`, `blackjack.js`, `slots.js`): interfaz y animaciones del casino.
- `public/js/tienda.js`: tienda y casillero con espacios vacíos.
- Pruebas `tools/cuentas/pruebas.mjs` y `tools/casino/pruebas.mjs`:
  - registro, login, contraseña mal e invitado;
  - el saldo nunca queda negativo, ni con dos apuestas a la vez;
  - retorno de cada juego con un millón de tiradas simuladas (ruleta ≈ 97,3 %, slots ≈ 95 %, blackjack con estrategia básica ≈ 99,5 %);
  - eliminaciones que pagan y que no (uno mismo, tormenta, invitado que elimina, misma IP, tope diario);
  - anuncios: token usado dos veces, anuncio terminado antes de tiempo, tope diario y espera;
  - tienda: no se compra sin saldo, ni dos veces, ni una skin que no existe.

Cambian:

- `server.js`: monta `api.js`, lee la sesión en el WebSocket, usa el nombre de la cuenta y paga las eliminaciones.
- `public/index.html` + `style.css`: pantallas nuevas (login, lobby, casino, tienda, casillero) y el "+100 🪙" del HUD.
- `public/js/main.js`: el flujo arranca en `cuenta.js` → `lobby.js` → menú de salas de siempre. Al terminar la partida vuelve a la sala de espera, y de ahí se puede salir al lobby.
- `public/js/models.js`: `createCharacter(color, skin)`.
- `README.md` y vault: notas nuevas en `Sistemas/` (Cuentas, Pavos, Casino, Tienda) y `Modulos/`, y los endpoints y el mensaje `pavos` en [[Protocolo de red]].

## Orden de trabajo (un PR por paso)

1. Base de datos + cuentas + login/registro/invitado + 1000 pavos al registrarse.
2. Lobby 3D con saldo y botones (Casino y Tienda todavía deshabilitados).
3. Pavos por eliminación (con la protección contra el farmeo) y "+100" en el HUD.
4. Casino: ruleta → tragamonedas → blackjack, cada uno con sus pruebas de retorno.
5. Anuncios con premio: circuito completo con el anuncio de prueba; el proveedor real cuando se elija.
6. Tienda y casillero con espacios vacíos, compra y equipar probados con la skin de prueba.

## Límites

- Los pavos **no se compran con plata real ni se cambian por nada**. Si algún día se quisiera vender pavos, el casino pasaría a ser juego con dinero real y habría que sacarlo o revisarlo legalmente.
- Mostrar en el casino que es solo con pavos del juego.
- Muchas redes de anuncios no permiten poner anuncios en juegos con casino, aunque sea con moneda ficticia. Revisarlo con el proveedor que se elija antes de integrarlo.

## Decisiones abiertas

- **Proveedor de anuncios**: AdSense para juegos HTML5 ("H5 Games Ads"), o el de un portal de juegos (CrazyGames, Poki) si se publica ahí. Los dos piden tener el juego publicado en un dominio, y cada uno tiene sus reglas sobre casinos.
- Valores de los topes: eliminaciones por día, anuncios por día, espera entre anuncios, apuesta mínima y máxima. El plan usa 2000 pavos por día, 5 anuncios, 2 minutos, 10 y 500 hasta que se diga otra cosa.
