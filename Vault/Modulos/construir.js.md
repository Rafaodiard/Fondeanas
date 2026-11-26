# construir.js

Volver a [[Inicio]] · sistema: [[Construcción]]

Archivo: `public/js/construir.js`. La construcción dentro del juego. [[main.js]] la crea con `crearConstruccion({ scene, camera, me, getWorld, getMyId, sendMsg, ui, sfx, feed })` y la usa como `cons`.

- Registra en [[controles.js]] (al importarse): `cambiarMaterial` (clic derecho, contexto construcción; antes que el techo para que V no quede en dos), `construirTecho` (V), `editar` (F), `girar` (R, construcción).
- `accion(id)`: recibe las acciones de construcción que [[main.js]] resuelve en `hacer`. `contexto()` es `construccion` en modo construcción o editando.
- Dónde va la pieza (`objetivo`, `nivelYApoyo`): según la dirección y la inclinación de la mira; parado en una pieza propia usa su nivel, y sobre una rampa que sube hacia donde se mira, lo de adelante va un nivel más arriba. Cerca de otras construcciones alinea la altura con ellas.
- `update(dt, mouseDown)`: vista previa (`makeStructMesh` en holograma, roja si ya hay una, no alcanza el material o no tiene apoyo) y colocación seguida con el clic apretado (cada 90 ms, la misma pieza una sola vez). Editando: baldosa apuntada, marcar arrastrando, validez.
- Edición: `empezarEdicion` (la construcción propia más cercana que cruza la mira, dentro de `ALCANCE_EDICION`), `confirmarEdicion` (manda `edit` y la aplica al instante), `restablecerEdicion` (clic derecho), `terminarEdicion`. Cambiar de slot o salir del modo construcción confirma.
- `autoMaterial()`: pasa al siguiente material que alcance para una pieza cuando se termina el elegido.
- `hud()`: barra `#buildbar` (cuatro piezas con ícono y tecla, y el material elegido), `#buildhint` (solo construyendo o editando) y oscurece los slots. La vida que crece mientras se levanta se lleva con `alAgregar` y `alCambiarVida`; la barra `#structhp` la dibuja [[golpes.js]].
