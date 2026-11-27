# Configuración y controles

Volver a [[Inicio]]

- Todas las teclas salen del registro de [[controles.js]]; el panel es [[configuracion.js]]. Pedido de Rafael en [[Memoria/Panel de configuración|Panel de configuración]].
- Se abre con **⚙ Configuración** en el menú y en la sala de espera ([[index.html]]), y en la partida con Esc: con el mouse capturado, Esc lo suelta y aparece *Hacé clic para jugar* con el botón de configuración; otro Esc (o el botón) abre el panel. Al cerrarlo se vuelve a capturar el mouse.
- En [[main.js]] cada tecla, botón o rueda pasa por `pulsar(code)` → `accionesDe(code, contexto())` → `hacer(accion)`. El contexto es `vehiculo` sentado en un auto, `construccion` en modo construcción y `combate` si no. Las acciones del auto (grupo *Vehículos*: acelerar, frenar, doblar, freno de mano, turbo, bajarse, cambiar de asiento, bocina; ver [[Autos]]) solo valen en `vehiculo` y repiten las teclas de a pie sin chocar; el chat es `siempre` (vale a pie y en el auto). Moverse, correr, disparar y apuntar se leen con `activa(id)`.
- Qué aplica cada opción en [[main.js]]: sensibilidad base `0.0022 × sens` (× `sensApunta` apuntando, × `sensMira` con mira), `invertirY`, `apuntarAlternar` (el clic de apuntar alterna; se suelta al cambiar de slot o construir), `correrSiempre` (la tecla de correr pasa a caminar), `numerosDanio`, `calidad` (`aplicarVideo`: baja = sin sombras y resolución 1×, media = sombras 1024 y hasta 1,25×, alta = sombras 2048 y hasta 2×), `resolucion` (multiplica la resolución), `fov` (apuntando `fov − 18`, en caída `fov + 10`, mira telescópica 18), `colorMira` (variable CSS `--mira` de la retícula), `fps` (`#fps` en la barra de arriba) y `volumen` (`setVolumen` de [[audio.js]]).
- Los carteles del HUD usan `teclaDe`: números de los slots, barra de piezas y ayuda de construcción ([[construir.js]]; ya no hay ayuda general de controles en pantalla), ayuda del auto arriba del velocímetro ([[manejar.js]]), *E Manejar* / *Subir al auto*, aviso de agarrar/abrir y los mensajes del bus y la caída.
- Para sumar un control nuevo (por ejemplo de [[Construcción]] o de [[Bus, caída y paracaídas]]): `registrarAccion` en [[controles.js]] y un `case` en `hacer()` de [[main.js]].

## Bots (2026-11-26)

En la pestaña Juego: *Bots: completar la sala hasta* (`botsTotal`: Sin bots, 4… 24 jugadores) y *Dificultad de los bots* (`botsDificultad`). Es lo que se pone al crear una sala y lo que usa *Jugar con bots* (si dice "Sin bots", usa 12). Cambiarlo en la sala también lo guarda acá. Ver [[Bots]].

## Mapa y marcas (2026-11-26)

[[mapaHud.js]] registra sus propios controles y opciones (como [[construir.js]]): *Abrir / cerrar el mapa* (`mapa`, M) y *Marcar donde apuntás* (`marcar`, clic de la rueda y T), los dos en el grupo *Otros* con contexto `siempre` (valen a pie, construyendo y en el auto). Opciones en la pestaña Juego: *Compartir tus marcas con la sala* (`compartirMarcas`, sí) y *Zoom del minimapa* (`minimapaZoom`: cerca, medio o lejos). Con el mapa abierto, Esc lo cierra en vez de abrir el panel. Ver [[Mapa y marcas]].
