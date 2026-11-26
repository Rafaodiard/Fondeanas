# manejar.js

Volver a [[Inicio]] · [[Arquitectura]] · sistema: [[Autos]]

Archivo: `public/js/manejar.js`. Los autos en el cliente. [[main.js]] lo crea con `crearManejo({ scene, camera, me, getWorld, getMyId, sendMsg, ui, sfx, others, explosion, alSubir, alBajar })` y le pasa los mensajes `auto*` y `bocina`.

## Qué hace

- `iniciar(lista)`: crea las mallas (`createAuto` de [[models.js]]) con el snapshot de la partida y pone los autos en `world.dinamicos` para que choquen y se pisen.
- `mensaje(m)`: `auto` (estado de un auto que maneja otro), `autoSeats` (quién va en cada asiento y quién lo simula; ahí se sube y se baja el jugador propio), `autoHp`, `autoBoom` (queda quemado) y `bocina`.
- `update(dt)`, cada cuadro: simula con [[autos.js]] los autos que controla este jugador (con las teclas si maneja; si no, sin motor hasta frenar), manda su estado 15 veces por segundo (uno quieto se manda una sola vez), avisa choques fuertes y atropellos, interpola los autos de los demás (adelantados con su velocidad, hasta 0,3 s), mueve las mallas (ruedas, dirección, volante, luces de freno, llama del turbo, sacudón) y sienta al jugador propio.
- `sentarOtro(id, mesh, dt)`: para `updateOthers` de [[main.js]]: si ese jugador va en un auto lo pone en su asiento.
- `cercano()` / `subir(i)`: el auto al alcance para el cartel de interactuar y el pedido de subir.
- `accion(a)`: `bajarAuto`, `cambiarAsiento`, `bocina`.
- `rayo(o, d, near, max)`: disparos y pico contra los autos (para `castRay`).
- `hud()`, `minimapa(ctx, toM, escala)`, sonidos del motor y del derrape.
- La cámara del auto está en `updateCamera` de [[main.js]]; `movioMouse()` avisa para que no vuelva sola atrás del auto mientras se mira.

## Detalles

- Sentado: el personaje va con la orientación del auto y la cadera sobre el almohadón (`CADERA_SENTADO` de [[rig.js]]). Las manos del conductor van a dos puntos del aro del volante, que gira `2,1 × giro`.
- Más lejos de 450 m el auto no se dibuja; más lejos de 120 m no se animan las ruedas.
