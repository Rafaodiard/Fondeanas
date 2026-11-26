# main.js

Volver a [[Inicio]] · [[Arquitectura]]

Archivo: `public/js/main.js`. Es el juego en el cliente; lo carga [[index.html]].

## Qué hace

- Escena Three.js: cielo, sol, nubes, renderer y cámara en tercera persona (`updateCamera`).
- Red: `connect`, `sendMsg`, `enter` (crear/unirse) y `handle(m)`, que procesa todos los mensajes del servidor. Ver [[Protocolo de red]].
- Interfaz: menú, sala de espera y HUD de [[index.html]] (`showLobby`, `updateSlots`, `updateHp`, `feed`, `addChat`, `drawMinimap` (con los nombres de los pueblos con borde oscuro), `updateHud`). El nombre se guarda en `localStorage` (`br-name`).
- Física propia del jugador (`updateMe`): gravedad, caminar/correr, salto, nado, caída libre y paracaídas (física en [[caida.js]] con `fisicaAire`), deslizarse (`intentarDeslizar`, `pendiente`, `fisicaDeslizar`); el movimiento lo resuelve `world.moveBody` de [[world.js]] en pasos chicos con piso, techo y paredes.
- Combate: `tryShoot` (raycasts contra jugadores, estructuras y terreno), `trySwing` (pico), `startReload`, retícula y mira (`updateCrosshair`), efectos (`addTracer`, `addRocket`, `explosionFx`, `sparks`, `addDmgNum`).
- Estructuras del mapa: `castRay` sabe qué pieza tocó por `userData.triPz` de la malla de choque, el pico y los disparos le mandan el id al servidor, y `pzRota` la saca del mundo y tira escombros de su color (`escombros`). Ver [[Estructuras rompibles]].
- Construcción: `setBuild`, `buildTarget`, `updateBuild` (fantasma de la pieza). Ver [[Construcción]].
- Otros jugadores (`updateOthers`), loot del piso y cofres (`updateItems` llama a `animarLoot` de [[loot.js]]), bus (`updateBus`), tormenta (`updateStorm`), espectador (`startSpectating`).
- Entrada: todas las teclas pasan por [[controles.js]] (`pulsar` → `accionesDe` → `hacer`), y las opciones (sensibilidad, FOV, calidad, volumen, color de mira, FPS…) se aplican con `aplicarOpciones` / `aplicarVideo`. Esc abre [[configuracion.js]]. Ver [[Configuración y controles]].
- Bucle principal: `frame()` (también cuenta los FPS).

## Constantes de movimiento

`GRAVITY = 25`, `WALK = 6`, `SPRINT = 9.5`, `AIM_WALK = 3.5`, `JUMP = 8.5`, `SWIM_Y = -1.3`, `PICKUP_RANGE = 3`. Las de la caída, el paracaídas y el deslizamiento están en [[caida.js]].

## Caída, paracaídas y deslizarse

- `onSpace`: salta del bus, abre el paracaídas en la caída, lo cierra si `puedeCerrar` (arriba de 80 m y sin bloquear) o salta (y corta el deslizamiento conservando la velocidad).
- `alturaSuelo()`: altura sobre el terreno, un techo o el agua; manda la apertura automática y el cartel de altura.
- Cámara: en caída libre a 7,5 m; con el paracaídas a 9 m y más alta para que entre la vela; deslizándose baja a 1,18 m. El campo de visión se abre más en picada.
- Cartel del centro: altura y qué hace la tecla de saltar (abrir / cerrar el paracaídas).
- El mensaje `state` manda `r` con hacia dónde mira el cuerpo (al deslizarse, hacia donde va) y `x` con `paramsRed`. Los demás jugadores lo leen con `leerParams` y lo pasan a `animateCharacter`.
- En partida, `beforeunload` pide confirmación (Ctrl+W cierra la pestaña y Ctrl es la tecla de deslizarse).

Ver [[Bus, caída y paracaídas]] y [[Deslizarse]].

## Usa

[[world.js]] · [[caida.js]] · [[assets.js]] · [[models.js]] · [[items.js]] · [[audio.js]] · [[rig.js]] (`setRigEnv`) · [[loot.js]] (`luzLoot`, `animarLoot`, `createChest`, `abrirCofre`) · [[controles.js]] · [[configuracion.js]]

Al arrancar completa `MODEL.clone` y `MODEL.baked` de [[world.js]] con las funciones de [[assets.js]].
