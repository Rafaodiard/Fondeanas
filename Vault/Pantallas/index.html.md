# index.html

Volver a [[Inicio]]

Archivo: `public/index.html` (+ `public/style.css`). Es la página del juego; carga [[main.js]] como módulo. Tiene un import map que apunta `three` y `three/addons/` a `/vendor/three/`, que sirve [[server.js]].

## Pantallas (bloques del HTML)

1. **Menú principal** (`#menu`): nombre (`#name`), botón *Crear sala* (`#btnCreate`), código (`#code`) y *Unirse* (`#btnJoin`), errores en `#menuError`, y *⚙ Configuración* (`#btnConfigMenu`).
2. **Sala de espera** (`#lobby`): código de la sala (`#roomCode`, clic para copiar), lista de jugadores (`#playerList`), botón de arrancar (`#btnStart`, solo el anfitrión) o aviso de espera (`#waitHost`), y *⚙ Configuración* (`#btnConfigSala`). Ver [[Salas y partidas]].
3. **HUD** (`#hud`): mira telescópica (`#scope`), retícula (`#crosshair`), hitmarker, números de daño, barra superior (vivos, kills, info de la [[Tormenta]], contador de FPS `#fps`), minimapa, killfeed, aviso de interacción (`#prompt`), barra de uso de consumibles, materiales (`#mats`), barras de escudo y vida, inventario (`#inventario`: ayuda de construcción `#buildhint` solo construyendo o editando, barra de piezas `#buildbar` con la tecla de cada una y el material, y slots `#slots`; lo arma [[construir.js]]), vida de la construcción que se mira (`#structhp`), chat (`#chatlog`, `#chatInput`), viñeta de daño y *clic para jugar* (`#clickToPlay`, con el botón *⚙ Configuración* `#btnPausaConfig`).
4. **Configuración** (`#config`): no está en el HTML, la arma [[configuracion.js]] la primera vez que se abre. Ver [[Configuración y controles]].

La lógica de todas estas pantallas está en [[main.js]].
