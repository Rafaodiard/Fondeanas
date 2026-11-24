# index.html

Volver a [[Inicio]]

Archivo: `public/index.html` (+ `public/style.css`). Es la página del juego; carga [[main.js]] como módulo. Tiene un import map que apunta `three` y `three/addons/` a `/vendor/three/`, que sirve [[server.js]].

## Pantallas (bloques del HTML)

1. **Menú principal** (`#menu`): nombre (`#name`), botón *Crear sala* (`#btnCreate`), código (`#code`) y *Unirse* (`#btnJoin`), errores en `#menuError`.
2. **Sala de espera** (`#lobby`): código de la sala (`#roomCode`, clic para copiar), lista de jugadores (`#playerList`), botón de arrancar (`#btnStart`, solo el anfitrión) o aviso de espera (`#waitHost`). Ver [[Salas y partidas]].
3. **HUD** (`#hud`): mira telescópica (`#scope`), retícula (`#crosshair`), hitmarker, números de daño, barra superior (vivos, kills, info de la [[Tormenta]]), minimapa, killfeed, aviso de interacción (`#prompt`), barra de uso de consumibles, materiales (`#mats`), barras de escudo y vida, barra de construcción, slots, ayuda, chat (`#chatlog`, `#chatInput`), viñeta de daño y *clic para jugar* (`#clickToPlay`).

La lógica de todas estas pantallas está en [[main.js]].
