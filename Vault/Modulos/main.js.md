# main.js

Volver a [[Inicio]] · [[Arquitectura]]

Archivo: `public/js/main.js`. Es el juego en el cliente; lo carga [[index.html]].

## Qué hace

- Escena Three.js: cielo, sol, nubes, renderer y cámara en tercera persona (`updateCamera`).
- Red: `connect`, `sendMsg`, `enter` (crear/unirse) y `handle(m)`, que procesa todos los mensajes del servidor. Ver [[Protocolo de red]].
- Interfaz: menú, sala de espera y HUD de [[index.html]] (`showLobby`, `updateSlots`, `updateHp`, `feed`, `addChat`, `drawMinimap` (con los nombres de los pueblos con borde oscuro), `updateHud`). El nombre se guarda en `localStorage` (`br-name`).
- Física propia del jugador (`updateMe`): gravedad, caminar/correr, salto, nado, caída libre y planeador; el movimiento lo resuelve `world.moveBody` de [[world.js]] en pasos chicos con piso, techo y paredes.
- Combate: `tryShoot` (raycasts contra jugadores, estructuras y terreno), `trySwing` (pico), `startReload`, retícula y mira (`updateCrosshair`), efectos (`addTracer`, `addRocket`, `explosionFx`, `sparks`, `addDmgNum`).
- Construcción: `setBuild`, `buildTarget`, `updateBuild` (fantasma de la pieza). Ver [[Construcción]].
- Otros jugadores (`updateOthers`), loot del piso (`updateItems`), bus (`updateBus`), tormenta (`updateStorm`), espectador (`startSpectating`).
- Bucle principal: `frame()`.

## Constantes de movimiento

`GRAVITY = 25`, `WALK = 6`, `SPRINT = 9.5`, `AIM_WALK = 3.5`, `JUMP = 8.5`, `SWIM_Y = -1.3`, `FREEFALL_V = 42`, `FREEFALL_H = 20`, `GLIDER_V = 8`, `GLIDER_H = 17`, `AUTO_GLIDER = 70`, `PICKUP_RANGE = 3`.

## Usa

[[world.js]] · [[assets.js]] · [[models.js]] · [[items.js]] · [[audio.js]] · [[rig.js]] (`setRigEnv`)

Al arrancar completa `MODEL.clone` y `MODEL.baked` de [[world.js]] con las funciones de [[assets.js]].
