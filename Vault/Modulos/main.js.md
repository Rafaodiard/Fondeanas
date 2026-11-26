# main.js

Volver a [[Inicio]] · [[Arquitectura]]

Archivo: `public/js/main.js`. Es el juego en el cliente; lo carga [[index.html]].

## Qué hace

- Escena Three.js: cielo, sol, nubes, renderer y cámara en tercera persona (`updateCamera`).
- Red: `connect`, `sendMsg`, `enter` (crear/unirse) y `handle(m)`, que procesa todos los mensajes del servidor. Ver [[Protocolo de red]].
- Interfaz: menú, sala de espera y HUD de [[index.html]] (`showLobby`, `updateSlots`, `updateHp`, `feed`, `addChat`, `drawMinimap` (con los nombres de los pueblos con borde oscuro), `updateHud`). El nombre se guarda en `localStorage` (`br-name`).
- Física propia del jugador (`updateMe`): gravedad, caminar/correr, salto, nado, caída libre y paracaídas (física en [[caida.js]] con `fisicaAire`), deslizarse (`intentarDeslizar`, `pendiente`, `fisicaDeslizar`); el movimiento lo resuelve `world.moveBody` de [[world.js]] en pasos chicos con piso, techo y paredes.
- Combate: `tryShoot` (raycasts contra jugadores, estructuras y terreno), `trySwing` (pico), `startReload`, retícula y mira (`updateCrosshair`), efectos (`addTracer`, `addRocket`, `explosionFx`, `sparks`, `addDmgNum`).
- Estructuras del mapa: `castRay` sabe qué pieza tocó por `userData.triPz` de la malla de choque (y devuelve la normal de la cara, `n`), el pico y los disparos le mandan el id al servidor (el pico con el punto `at` y la normal, para el punto débil), y `pzRota` la saca del mundo y tira escombros de su color (`escombros`). Ver [[Estructuras rompibles]].
- Daño visible y punto débil: los maneja [[golpes.js]] (`golpes`): `trySwing` llama `golpes.golpePico`, `tryShoot` muestra la barra de lo que le pegó, `pzHp`/`structHp`/`debil` le llegan, `golpes.update` corre en cada cuadro y `golpes.reiniciar` en cada partida. `addDmgNum` acepta una clase (`estr`, `crit`). Ver [[Daño visible y punto débil]].
- Construcción: la maneja [[construir.js]] (`cons`): `hacer` le pasa las acciones de construcción, `contexto()` sale de `cons.contexto()`, `cons.update` corre en cada cuadro, `cons.hud` dentro de `updateSlots`, `cons.autoMaterial` en cada `inv`, y `structAdd`/`structDel` (con `caidas`)/`structHp`/`structEdit` van a [[world.js]]. Prende `renderer.localClippingEnabled` para el relleno de las piezas que se levantan. Ya no hay ayuda de controles en pantalla. Ver [[Construcción]].
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

[[world.js]] · [[caida.js]] · [[assets.js]] · [[models.js]] · [[items.js]] · [[audio.js]] · [[rig.js]] (`setRigEnv`) · [[loot.js]] (`luzLoot`, `animarLoot`, `createChest`, `abrirCofre`) · [[controles.js]] · [[configuracion.js]] · [[construir.js]]

Al arrancar completa `MODEL.clone` y `MODEL.baked` de [[world.js]] con las funciones de [[assets.js]].

## Autos (2026-11-26)

Los autos van en [[manejar.js]] (`crearManejo`). [[main.js]] le pasa los mensajes `auto*`, `bocina` y lo llama en cada cuadro (`autos.update`); el estado `auto` del jugador (sentado) cuenta como en partida (`PLAYING`) y manda `state` igual que a pie. Lo que se agregó acá: contexto `vehiculo` en `contexto()`, `case` de `bajarAuto` / `cambiarAsiento` / `bocina` en `hacer()`, el auto en `findInteract` (*E Manejar* o *Subir al auto*), los autos en `castRay` (disparos y pico: hits `{ auto }`), `updateOthers` sienta a los demás con `autos.sentarOtro`, la cámara del auto en `updateCamera` (atrás, más lejos y con más ángulo de visión cuanto más rápido), el mensaje `empujon` (atropellado), la causa de muerte `auto`, los autos en el minimapa y el HUD del auto. Ver [[Autos]].

## Bots (2026-11-26)

- `enter(type, conBots)`: al crear una sala guarda en `alCrear` los bots de Configuración; al llegar `welcome` manda `bots` y, con *Jugar con bots* (`#btnBots`), también `start`.
- `cambiarBots` (los `<select>` de la sala `#botsTotal` y `#botsDif`): guarda las opciones con `fijarOpcion` y manda `bots`. `resumenMenuBots` escribe debajo del botón del menú el total y la dificultad.
- `showLobby`: lista solo a las personas, agrega "🤖 + N bots (dificultad)", muestra los selectores solo al anfitrión y el botón dice "Empezar con N bots".
- `onMatchEnd`: con `botsVivos` muestra "Quedaban N bots en pie".
- Los bots llegan en `room.players` (con `bot: true`) y se dibujan y animan como cualquier otro jugador (`others`). Ver [[Bots]].
