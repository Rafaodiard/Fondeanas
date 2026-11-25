# world.js

Volver a [[Inicio]] · [[Arquitectura]] · diseño en [[Mapa de la isla]]

Archivo: `public/js/world.js`. Lo usan [[server.js]] (solo datos) y [[main.js]] / [[mapa.html]] (datos + escena).

## Qué hace

Arma la isla de Salto Final. El mapa es **fijo**: usa `MAP_SEED = 20261124` para el ruido y el reparto de árboles y rocas, así todas las partidas se juegan en la misma isla. El parámetro `seed` del constructor se guarda pero ya no cambia el mapa. Los datos del diseño (pueblos, rutas, río, teleférico, lugares sueltos) vienen de [[isla.js]]; las estructuras, de [[planos.js]].

## Clase `World(seed, size)` (`size` = 1200 m)

- **Terreno**: grilla de 300 × 300 celdas de 4 m (`res`, `cell`, `heights`). `rawHeight` (costa, montaña nevada al noroeste, cerro del observatorio, lomas de la cantera, médanos al este, ciénaga al suroeste, bahía del puerto), `desert`, `swamp`, `biome`.
- **`layout()`** (corre también en el servidor), en este orden:
  1. `stampTown`: meseta de cada pueblo (o el pozo escalonado de la cantera, el ruido de la ciénaga, el corte del puerto hacia el mar).
  2. `stampRoad`: calles y rutas (rutas con curva Catmull-Rom y perfil suavizado). Guarda `ribbons` y `roadDist`.
  3. `stampRiver`: cauce del río y puentes donde lo cruza una ruta (`bridges`).
  4. `place(name, opts, x, z, rot, extra, town)`: ubica cada estructura de [[planos.js]], **aplana exactamente su huella** (`flatten`, con vértices trabados) para que la puerta quede al ras del piso, y registra sólidos, loot, cofres y carteles.
  5. `layoutPostes()`: postes de luz con cables cada ~38 m en las rutas asfaltadas e indicadores de caminos a la salida de los pueblos. `cable(A, B, {sagK, r, cabina})` tiende cables con comba (también los del teleférico, con cabinas).
  6. Teleférico (`TELEFERICO` de [[isla.js]]), árboles (`layoutTrees`), rocas (`layoutRocks`) y un poco de loot suelto en la naturaleza.
- **Consultas**: `terrainHeight`, `groundHeight(x, z, y)` (piso más alto bajo los pies: terreno, estructuras o construcciones), `ceilingHeight`, `slopeAt`, `insideHouse`, `inTown`, `nearSolid`.
- **Movimiento**: `moveBody(pos, vel, dt)` mueve al jugador en pasos de 25 cm como máximo, con techo, piso y paredes en cada paso, así no se atraviesan techos ni pisos aunque se caiga rápido. `collide` empuja la cápsula fuera de troncos, rocas, sólidos de [[colision.js]] y construcciones.
- **Escena** (solo cliente): `build(scene)` → `buildTerrain` (colores por bioma en `terrainColor`: la nieve tiene zonas azuladas y manchones de roca lejos de los pueblos; detalle de [[mallas.js]]), `buildWater` (mar con olas animadas, color según profundidad, espuma en la orilla, agua turbia en la ciénaga; río), `buildRoads`, `buildStructures` (mallas por bloque de 160 m con [[mallas.js]] y una malla invisible con los sólidos para disparos y cámara), `buildTrees`, `buildPlants`, `buildRocks`, `buildChests`, `buildSigns` (carteles con texto dibujado en canvas, en las dos caras).
- **Estado de partida**: `openChest`, `destroyResource`, `shakeResource`.
- **Construcciones de jugadores**: `structs` (Map), `addStruct`, `removeStruct`, `updateStructs`; malla con `makeStructMesh` (exportada). Ver [[Construcción]].
- `rayTerrain`, `minimapImage` (terreno, río, calles y techos).
- `pois`: un punto por pueblo (nombre, centro, radio y desplazamiento opcional de la etiqueta del minimapa).

## Modelos

`MODEL = { clone, baked }` lo completa el cliente con [[assets.js]]. El mapa usa los GLB de árboles (`pino`, `arbol`), rocas (`roca`) y cofres (`cofre`); las casas y demás estructuras ya no salen de `casa.glb`, se modelan con [[planos.js]]. Ver [[Modelos GLB]].

## Usa

[[items.js]] (`GRID`, `MATERIALS`) · [[planos.js]] · [[isla.js]] · [[colision.js]] · [[mallas.js]]

Pruebas: [[Pruebas del mapa]].
