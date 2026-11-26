# construccion3d.js

Volver a [[Inicio]] · sistema: [[Construcción]]

Archivo: `public/js/construccion3d.js`. Mallas de las construcciones de los jugadores (solo cliente; las texturas se crean recién al dibujar la primera pieza, así el servidor puede importar [[world.js]] sin `document`).

- Texturas en canvas (`texMadera`, `texPiedra`, `texMetal`): tablas con veta, juntas y clavos; bloques de piedra con bisel y grietas; chapa acanalada con remaches y óxido. Una textura = una baldosa de `T3`; `uvMundo` pone las UV según la posición, así se alinean entre piezas.
- `makeStructMesh(s, ghost)`: grupo en la esquina de la celda con el panel (`userData.panel`) y el marco (`userData.marco`), cada uno una sola malla. El marco (`marcoGrilla`) rodea las baldosas que quedan, también alrededor de los huecos editados (marcos de puertas y ventanas), con tacos un poco más grandes en las esquinas para que no titilen. La rampa lleva tacos para pisar y barandas; el techo, limatesas y faldones cuando se levantan esquinas. [[world.js]] la reexporta.
- Vista previa: con `ghost` usa el holograma azul con aristas; `pintarFantasma(g, ok)` lo pone rojo si no se puede.
- `empezarObra` / `avanzarObra`: la pieza recién puesta se llena de abajo hacia arriba (pisos y techos de un costado al otro) con planos de recorte; arriba de la línea queda holograma. Necesita `renderer.localClippingEnabled` (lo prende [[main.js]]).
- Edición: `grillaEdicion(s)` (baldosas que siguen la superficie: pared vertical, piso, rampa inclinada, techo) y `pintarGrilla(grupo, marcas, hover, valida)`.

Usa [[construccion.js]] y [[items.js]].
