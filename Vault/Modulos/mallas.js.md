# mallas.js

Volver a [[Inicio]] · lo usa [[world.js]]

Archivo: `public/js/mallas.js`. Convierte los planos de [[planos.js]] en pocas mallas grandes y les da textura procedural.

- `class Lote`: junta piezas de muchos planos en buffers por tipo de material (`s`, `m`, `v`, `e`) con color por vértice, altura local (`aoY`) y patrón (`pat`). `plano(P, matriz, {jitter})` agrega un plano ubicado; `meshes(mats)` devuelve las mallas. [[world.js]] arma un lote por bloque de 160 m.
- Piezas rompibles: `plano(P, M, { piezaDe })` anota qué rango de vértices es de cada pieza (`marca`, `rangos`) y `ocultar(id)` aplasta esos triángulos en un punto cuando la pieza se rompe. Con `new Lote({ porTri: true })` (mallas de choque para disparos y cámara) guarda el id de pieza de cada triángulo en `userData.triPz`. Ver [[Estructuras rompibles]].
- `PATTERN_GLSL` + `patchMaterial`: en el shader dibuja ladrillos, tablas, tejas, chapa, hormigón, piedra, baldosas, piso de madera, troncos, revoque, adobe y heno según el patrón de cada pieza, y oscurece apenas el pie de las paredes (sombra de contacto).
- `materialesMapa()`: materiales mate, metal, vidrio y emisivo.
- `terrainDetail(mat)`: ruido de detalle en varias escalas para el terreno.
