# Configuración y controles

Volver a [[Inicio]]

- Todas las teclas salen del registro de [[controles.js]]; el panel es [[configuracion.js]]. Pedido de Rafael en [[Memoria/Panel de configuración|Panel de configuración]].
- Se abre con **⚙ Configuración** en el menú y en la sala de espera ([[index.html]]), y en la partida con Esc: con el mouse capturado, Esc lo suelta y aparece *Hacé clic para jugar* con el botón de configuración; otro Esc (o el botón) abre el panel. Al cerrarlo se vuelve a capturar el mouse.
- En [[main.js]] cada tecla, botón o rueda pasa por `pulsar(code)` → `accionesDe(code, contexto())` → `hacer(accion)`. El contexto es `construccion` en modo construcción y `combate` si no. Moverse, correr, disparar y apuntar se leen con `activa(id)`.
- Qué aplica cada opción en [[main.js]]: sensibilidad base `0.0022 × sens` (× `sensApunta` apuntando, × `sensMira` con mira), `invertirY`, `apuntarAlternar` (el clic de apuntar alterna; se suelta al cambiar de slot o construir), `correrSiempre` (la tecla de correr pasa a caminar), `numerosDanio`, `calidad` (`aplicarVideo`: baja = sin sombras y resolución 1×, media = sombras 1024 y hasta 1,25×, alta = sombras 2048 y hasta 2×), `resolucion` (multiplica la resolución), `fov` (apuntando `fov − 18`, en caída `fov + 10`, mira telescópica 18), `colorMira` (variable CSS `--mira` de la retícula), `fps` (`#fps` en la barra de arriba) y `volumen` (`setVolumen` de [[audio.js]]).
- Los carteles del HUD usan `teclaDe`: ayuda de abajo (`updateHelp`), números de los slots, barra de construcción, aviso de agarrar/abrir y los mensajes del bus y la caída.
- Para sumar un control nuevo (por ejemplo de [[Construcción]] o de [[Bus, caída y planeador]]): `registrarAccion` en [[controles.js]] y un `case` en `hacer()` de [[main.js]].
