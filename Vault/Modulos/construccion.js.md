# construccion.js

Volver a [[Inicio]] · sistema: [[Construcción]]

Archivo: `public/js/construccion.js`. Reglas de la construcción **sin Three.js**, compartidas por el cliente ([[construir.js]], [[world.js]], [[construccion3d.js]]) y el servidor ([[server.js]]). Usa `GRID`, `MATERIALS`, `DIRS` y `structKey` de [[items.js]].

- Constantes: `TIPOS`, `NOMBRES`, `T3` (baldosa de 4/3 m), `ALTO_TECHO`, `ESPESOR`, `OBRA`, `HP_INICIAL`, `ALCANCE_EDICION`, `TODO` (todas las baldosas por tipo), `BALDOSAS`, `DEBAJO`.
- Ediciones: `editValida`, `sacada(s, k)`, `marcasIniciales`, `resultadoEdicion(s, marcas, camino)` (en la rampa, la dirección sale del primer y el último casillero marcados y el ancho de los carriles marcados).
- Geometría: `normalizar` (paredes), `superficie(s, x, z)` (altura pisable o `null`), `alturasTecho`, `triangulosTecho`, `cajasPieza` (lo que frena de costado), `cajaPieza` (la caja entera, para saber qué toca a qué).
- Grilla de encastre: `bordes(s)`, `enganchadas(a, b)`, `mismaGrilla(a, b)`, `ocupado(world, s)` (rampa y techo comparten lugar), `motivoNoEncaja(world, s)` / `encaja` con `MOTIVOS`, `nivelGrilla(world, i, j, y)`. Ver [[Construcción]].
- Vista previa: `direccionDe(yaw)`, `nivelDelJugador(world, pos, d)` y `objetivoPieza(world, yo, tipo, giro)` (los usa [[construir.js]]; los bots de [[bots.js]] usan `nivelGrilla`).
- Apoyo: `apoyadaEnMapa` (terreno o sólido sano de [[colision.js]]), `tieneApoyo` (mapa o un borde compartido), `sinApoyo` (recorre de borde en borde desde las piezas que tocan el piso y devuelve las claves de las que quedaron colgando).
- `vidaDe(s, t)`: vida que crece mientras se levanta, menos el daño.
- `rayoEdicion(s, origen, dir)`: qué baldosa de la grilla de edición mira un rayo (plano de la pared, del piso, la rampa inclinada o el techo).

Lo prueba [[Pruebas de construcción]].
