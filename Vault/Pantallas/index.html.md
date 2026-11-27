# index.html

Volver a [[Inicio]]

Archivo: `public/index.html` (+ `public/style.css`). Es la página del juego; carga [[main.js]] como módulo. Tiene un import map que apunta `three` y `three/addons/` a `/vendor/three/`, que sirve [[server.js]].

## Pantallas (bloques del HTML)

1. **Menú principal** (`#menu`, desde 2026-11-26 con pestañas, lo maneja [[menu.js]]): barra con pestañas (`#pestanas`: Jugar, Tienda, Casillero, Cajas, Apuestas y Admin), pavos (`#mPavos`) y usuario (`#btnCuenta`, abre `#cuentaMenu`); a la derecha la vitrina 3D (`#vitrina`, [[vitrina.js]]) y el detalle de la skin elegida (`#detalle`). La pestaña Jugar (`#p-jugar`) tiene lo de siempre: nombre (`#name`), botón *Crear sala* (`#btnCreate`), *🤖 Jugar con bots* (`#btnBots`, con el total y la dificultad en `#botsResumenMenu`), código (`#code`) y *Unirse* (`#btnJoin`), errores en `#menuError`, y *⚙ Configuración* (`#btnConfigMenu`).
2. **Entrar / crear cuenta** (`#login`), la ruleta de las cajas y el contrato (`#ruleta`) y el cartel de pavos ganados (`#avisoPavos`, también en la partida).
2. **Sala de espera** (`#lobby`): *🎒 Cambiar skins* (`#btnSkinsSala`) abre el menú arriba de la sala (`#menu.sobre-sala`, con *← Volver a la sala*); código de la sala (`#roomCode`, clic para copiar), lista de jugadores (`#playerList`), opciones de bots (`#botsSala`: `#botsTotal` y `#botsDif` solo para el anfitrión, resumen en `#botsResumen`; ver [[Bots]]), botón de arrancar (`#btnStart`, solo el anfitrión) o aviso de espera (`#waitHost`), y *⚙ Configuración* (`#btnConfigSala`). Ver [[Salas y partidas]].
3. **HUD** (`#hud`): mira telescópica (`#scope`), retícula (`#crosshair`), hitmarker, números de daño, barra superior (vivos, kills, info de la [[Tormenta]], contador de FPS `#fps`), minimapa, killfeed, aviso de interacción (`#prompt`), barra de uso de consumibles, materiales (`#mats`), barras de escudo y vida, inventario (`#inventario`: ayuda de construcción `#buildhint` solo construyendo o editando, barra de piezas `#buildbar` con la tecla de cada una y el material, y slots `#slots` con la foto de cada arma u objeto, sacada de su modelo 3D por [[iconos.js]]; a la izquierda de los slots, `#itemMano` con el nombre de lo que tenés en la mano y, si es un arma, la rareza en su color (se esconde construyendo y en pantallas de menos de 1000 px); la barra de piezas la arma [[construir.js]]), barra de vida de lo que se golpea o se mira (`#structhp`, la arma [[golpes.js]]), chat (`#chatlog`, `#chatInput`), viñeta de daño y *clic para jugar* (`#clickToPlay`, con el botón *⚙ Configuración* `#btnPausaConfig`).
4. **Configuración** (`#config`): no está en el HTML, la arma [[configuracion.js]] la primera vez que se abre. Ver [[Configuración y controles]].

La lógica de todas estas pantallas está en [[main.js]].

## HUD del auto (2026-11-26)

`#autohud` (abajo al centro): ayuda de teclas del auto (`#autohint`), velocímetro (`#autovel`, km/h) y barras de vida del auto (`#autovida`) y turbo (`#autoturbo`). Lo maneja [[manejar.js]]; mientras se va en un auto, `#hud.en-auto` esconde el inventario y los materiales.
