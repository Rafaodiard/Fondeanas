# index.html

Volver a [[Inicio]]

Archivo: `public/index.html` (+ `public/style.css`). Es la página del juego; carga [[main.js]] como módulo. Tiene un import map que apunta `three` y `three/addons/` a `/vendor/three/`, que sirve [[server.js]].

## Pantallas (bloques del HTML)

1. **Menú principal** (`#menu`): nombre (`#name`), botón *Crear sala* (`#btnCreate`), *🤖 Jugar con bots* (`#btnBots`, con el total y la dificultad en `#botsResumenMenu`), código (`#code`) y *Unirse* (`#btnJoin`), errores en `#menuError`, y *⚙ Configuración* (`#btnConfigMenu`).
2. **Sala de espera** (`#lobby`): código de la sala (`#roomCode`, clic para copiar), lista de jugadores (`#playerList`), opciones de bots (`#botsSala`: `#botsTotal` y `#botsDif` solo para el anfitrión, resumen en `#botsResumen`; ver [[Bots]]), botón de arrancar (`#btnStart`, solo el anfitrión) o aviso de espera (`#waitHost`), y *⚙ Configuración* (`#btnConfigSala`). Ver [[Salas y partidas]].
3. **HUD** (`#hud`): mira telescópica (`#scope`), retícula (`#crosshair`), hitmarker, números de daño, barra superior (vivos, kills, info de la [[Tormenta]], contador de FPS `#fps`), minimapa (`#minimap`), y los que agrega [[mapaHud.js]]: brújula (`#brujula`), etiquetas de las marcas en el mundo (`#marcasMundo`) y el mapa grande (`#mapaGrande`, estilos en `public/mapaHud.css`), killfeed, aviso de interacción (`#prompt`), barra de uso de consumibles, materiales (`#mats`), barras de escudo y vida, inventario (`#inventario`: ayuda de construcción `#buildhint` solo construyendo o editando, barra de piezas `#buildbar` con la tecla de cada una y el material, y slots `#slots` con la foto de cada arma u objeto, sacada de su modelo 3D por [[iconos.js]]; a la izquierda de los slots, `#itemMano` con el nombre de lo que tenés en la mano y, si es un arma, la rareza en su color (se esconde construyendo y en pantallas de menos de 1000 px); la barra de piezas la arma [[construir.js]]), barra de vida de lo que se golpea o se mira (`#structhp`, la arma [[golpes.js]]), chat (`#chatlog`, `#chatInput`), viñeta de daño y *clic para jugar* (`#clickToPlay`, con el botón *⚙ Configuración* `#btnPausaConfig`).
4. **Configuración** (`#config`): no está en el HTML, la arma [[configuracion.js]] la primera vez que se abre. Ver [[Configuración y controles]].

La lógica de todas estas pantallas está en [[main.js]].

## HUD del auto (2026-11-26)

`#autohud` (abajo al centro): ayuda de teclas del auto (`#autohint`), velocímetro (`#autovel`, km/h) y barras de vida del auto (`#autovida`) y turbo (`#autoturbo`). Lo maneja [[manejar.js]]; mientras se va en un auto, `#hud.en-auto` esconde el inventario y los materiales.
