# construccion.js

Volver a [[Inicio]] · sistema: [[Construcción]]

Archivo: `public/js/construccion.js`. Reglas de la construcción **sin Three.js**, compartidas por el cliente ([[construir.js]], [[world.js]], [[construccion3d.js]]) y el servidor ([[server.js]]). Usa `GRID` y `MATERIALS` de [[items.js]].

- Constantes: `TIPOS`, `NOMBRES`, `T3` (baldosa de 4/3 m), `ALTO_TECHO`, `ESPESOR`, `OBRA`, `HP_INICIAL`, `ALCANCE_EDICION`, `TODO` (todas las baldosas por tipo), `BALDOSAS`, `DEBAJO`.
- Ediciones: `editValida`, `sacada(s, k)`, `marcasIniciales`, `resultadoEdicion(s, marcas, camino)` (en la rampa, la dirección sale del primer y el último casillero marcados y el ancho de los carriles marcados).
- Geometría: `normalizar` (paredes), `superficie(s, x, z)` (altura pisable o `null`), `alturasTecho`, `triangulosTecho`, `cajasPieza` (lo que frena de costado), `cajaPieza` (la caja entera, para saber qué toca a qué).
- Apoyo: `apoyadaEnMapa` (terreno o sólido sano de [[colision.js]]), `tieneApoyo`, `sinApoyo` (recorre las piezas que tocan el piso y devuelve las claves de las que quedaron colgando).
- `vidaDe(s, t)`: vida que crece mientras se levanta, menos el daño.
- `rayoEdicion(s, origen, dir)`: qué baldosa de la grilla de edición mira un rayo (plano de la pared, del piso, la rampa inclinada o el techo).

Lo prueba [[Pruebas de construcción]].
