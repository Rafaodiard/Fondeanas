# world.js

Volver a [[Inicio]] · [[Arquitectura]]

Archivo: `public/js/world.js`. Lo usan [[server.js]] (solo datos) y [[main.js]] (datos + escena).

## Qué hace

Genera la isla de forma determinística a partir de la semilla de la sala (`rng(seed)`, `makeNoise`): todos los clientes de una sala ven exactamente el mismo mundo.

## Clase `World(seed, size)`

- Terreno: `rawHeight`, `buildHeights`, `terrainHeight`, `groundHeight`, `slopeAt`; grilla de 240 celdas por lado (`res`). `SEA_LEVEL = 0`.
- Distribución: `layout`, `layoutTowns`, `layoutHouse`, `layoutTrees`, `layoutRocks`. Llena `lootSpots`, `chestSpots`, `houses`, `trees`, `rocks`.
- Escena (solo cliente): `build(scene)` → `buildTerrain`, `buildWater`, `buildHouses`, `buildTrees`, `buildRocks`, `buildChests`.
- Estado de partida: `openChest`, `destroyResource`, `shakeResource`.
- Construcciones de jugadores: `structs` (Map), `addStruct`, `removeStruct`, `updateStructs`; malla con `makeStructMesh` (exportada). Ver [[Construcción]].
- Física: `collide` (cajas AABB, círculos de troncos/rocas, pisos de casas), `rayTerrain`.
- `minimapImage`: imagen del minimapa.

## Modelos

`MODEL = { clone, baked }` lo completa el cliente con [[assets.js]]; el servidor no lo usa. Las casas usan `casa.glb` con tres combinaciones de tintes de pared y techo; árboles (`pino`, `arbol`), rocas (`roca`) y cofres (`cofre`) también salen de [[Modelos GLB]].

## Usa

[[items.js]] (`GRID`, `MATERIALS`)
