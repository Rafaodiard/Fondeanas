# lugarLoot.js

Volver a [[Inicio]] · [[Arquitectura]] · sistema: [[Loot y rarezas]] · pruebas: [[Pruebas del loot]]

Archivo: `public/js/lugarLoot.js` (2026-11-26). Dónde cae el loot sin atravesar paredes. Lo usan [[server.js]] (decide dónde queda cada objeto), [[loot.js]] (el salto desde el cofre) y las pruebas. Usa [[colision.js]] (`Solidos`, `STEP`), [[construccion.js]] (`superficie`, `DEBAJO`) y el `World` de [[world.js]] (`terrainHeight`, `sol`, `circles`, `structs`, `collide`).

## Medidas

- `LOOT_RADIO = 0.4`: medio ancho del objeto (un arma girando mide casi un metro).
- `LOOT_ALTO = 0.95`: hasta dónde llega el objeto sobre su piso.
- `PASO = 0.1`: largo de cada paso del recorrido. `R_MIN = 1`, `R_MAX = 1.8`: a qué distancia sale cada objeto (como antes).

## Funciones exportadas

- `pisoLoot(world, x, z, f, zona?)`: piso donde se apoya un objeto que viene a la altura `f`: terreno, mapa (lo que se sube como un escalón, `STEP`) y pisos, rampas y techos construidos. Los autos no cuentan (se mueven).
- `techoLoot(world, x, z, f)`: techo más bajo sobre un objeto apoyado en `f` (mapa y construcciones).
- `zonaLoot(world, x, z, radio)`: árboles, rocas y construcciones cercanas, para no recorrer toda la isla en cada paso.
- `trayectoLoot(world, x, y, z, ang, dist, rad?, zona?)`: camina al objeto desde el punto de salida en pasos de 10 cm y lo frena antes de lo que choque a su altura (entre `STEP` y `LOOT_ALTO` sobre su piso): paredes y vidrios del mapa, muebles altos, paredes y bordes de techo construidos, el lado de abajo de una rampa o un piso, árboles y rocas. Un objeto que arranca pegado a algo (cofre contra la pared) puede alejarse. Si pasa por un borde cae al piso de abajo; en el agua va flotando. Devuelve `{ x, y, z, d }`.
- `repartirLoot(world, n, x, y, z, rnd?)`: lugares para `n` objetos alrededor del punto: mide 16 direcciones, a cada objeto le da la libre más parecida a la que le tocaba (o la que más deja avanzar si están todas tapadas), y lo acomoda.
- `acomodarLoot(world, it, rad?, desde?)`: deja un objeto en un lugar válido: arriba de un piso o rampa construidos que lo atraviesan, afuera de una pared (para su lado, con `collide` de [[world.js]]) y apoyado en el piso (cae si se rompió lo de abajo; en el agua flota cerca de la superficie).
