# index.html

Volver a [[Inicio]]

Archivo: `public/index.html` (+ `public/style.css` y `public/lobby.css`). Es la página del juego; carga [[main.js]] como módulo. Tiene un import map que apunta `three` y `three/addons/` a `/vendor/three/`, que sirve [[server.js]].

## Pantallas (bloques del HTML)

0. **Cargando** (`#carga`): barra mientras se cargan los modelos.
0. **Cuenta** (`#cuenta`): Iniciar sesión / Crear cuenta y *Jugar sin cuenta*. La maneja [[cuenta.js]].
0. **Lobby 3D** (`#inicio`): saldo (`#iniSaldo`), usuario, *Cerrar sesión*, y los botones *Jugar*, *Casino*, *Tienda*, *Casillero*, *Ver anuncio* (deshabilitado), *Bailar* y *Configuración*. La escena la dibuja [[lobby.js]].
0. **Casino** (`#casino`) y **Tienda** (`#tienda`): paneles encima del lobby ([[casino.js]], [[tienda.js]]).
1. **Menú de salas** (`#menu`): *← Lobby*, nombre (`#name`, solo invitados), botón *Crear sala* (`#btnCreate`), código (`#code`) y *Unirse* (`#btnJoin`), errores en `#menuError`, y *⚙ Configuración* (`#btnConfigMenu`).
2. **Sala de espera** (`#lobby`): código de la sala (`#roomCode`, clic para copiar), lista de jugadores (`#playerList`), botón de arrancar (`#btnStart`, solo el anfitrión) o aviso de espera (`#waitHost`), *← Salir al lobby* (`#btnSalirSala`) y *⚙ Configuración* (`#btnConfigSala`). Ver [[Salas y partidas]].
3. **HUD** (`#hud`): mira telescópica (`#scope`), retícula (`#crosshair`), hitmarker, números de daño, barra superior (vivos, kills, info de la [[Tormenta]], contador de FPS `#fps`), minimapa, killfeed, aviso de interacción (`#prompt`), barra de uso de consumibles, materiales (`#mats`), barras de escudo y vida, inventario (`#inventario`: ayuda de construcción `#buildhint` solo construyendo o editando, barra de piezas `#buildbar` con la tecla de cada una y el material, y slots `#slots`; lo arma [[construir.js]]), vida de la construcción que se mira (`#structhp`), pavos (`#hudPavos`, y `#pavosToast` con el +100 al eliminar), chat (`#chatlog`, `#chatInput`), viñeta de daño y *clic para jugar* (`#clickToPlay`, con el botón *⚙ Configuración* `#btnPausaConfig`).
4. **Configuración** (`#config`): no está en el HTML, la arma [[configuracion.js]] la primera vez que se abre. Ver [[Configuración y controles]].

La lógica de todas estas pantallas está en [[main.js]].

## HUD del auto (2026-11-26)

`#autohud` (abajo al centro): ayuda de teclas del auto (`#autohint`), velocímetro (`#autovel`, km/h) y barras de vida del auto (`#autovida`) y turbo (`#autoturbo`). Lo maneja [[manejar.js]]; mientras se va en un auto, `#hud.en-auto` esconde el inventario y los materiales.
