# world.js

Volver a [[Inicio]] · [[Arquitectura]] · diseño en [[Mapa de la isla]]

Archivo: `public/js/world.js`. Lo usan [[server.js]] (solo datos) y [[main.js]] / [[mapa.html]] (datos + escena).

## Qué hace

Arma la isla de Salto Final. El mapa es **fijo**: usa `MAP_SEED = 20261124` para el ruido y el reparto de árboles y rocas, así todas las partidas se juegan en la misma isla. El parámetro `seed` del constructor se guarda pero ya no cambia el mapa. Los datos del diseño (pueblos, rutas, río, teleférico, lugares sueltos) vienen de [[isla.js]]; las estructuras, de [[planos.js]].

## Clase `World(seed, size)` (`size` = 1200 m)

- **Terreno**: grilla de 300 × 300 celdas de 4 m (`res`, `cell`, `heights`). `rawHeight` (costa, montaña nevada al noroeste, cerro del observatorio, lomas de la cantera, médanos al este, ciénaga al suroeste, bahía del puerto), `desert`, `swamp`, `biome`.
- **`layout()`** (corre también en el servidor), en este orden:
  1. `stampTown`: meseta de cada pueblo (o el pozo escalonado de la cantera, el ruido de la ciénaga, el corte del puerto hacia el mar).
  2. `stampRoad`: calles y rutas (rutas con curva Catmull-Rom y perfil suavizado, con las puntas a la altura del lugar al que llegan; banquina plana de 2,2 m a cada lado). Guarda `ribbons` (con `def`, la definición de [[isla.js]]) y `roadDist`. Los remates `ini`/`fin: { r }` se aplanan con `stampPlaza` y quedan en `plazas`. `capasCalles()` da a cada cinta su altura de dibujo (`off`): la que desemboca en otra más ancha o igual va debajo, así la que sigue de largo se ve entera en el cruce.
  3. `stampRiver`: cauce del río y puentes donde lo cruza una ruta (`bridges`). Cada puente toma la altura de las dos orillas (`y` en el medio y `dy` de diferencia) y el tablero queda 10 cm sobre el terreno en las dos puntas.
  4. `place(name, opts, x, z, rot, extra, town)`: ubica cada estructura de [[planos.js]], **aplana exactamente su huella** (`flatten`, con vértices trabados) para que la puerta quede al ras del piso, y registra sólidos, loot, cofres, carteles y sus **piezas rompibles** con ids globales en `world.piezas` (ver [[Estructuras rompibles]]). Las estructuras de `NO_ROMPE` (postes, torres del teleférico, carteles, indicadores y malecón) quedan enteras fijas. Los sólidos de ventana llevan `vidrio`.
  Después de las estructuras, `suavizarCalles()` alisa el terreno debajo de las calles (sin tocar lo aplanado por estructuras ni el cauce del río) para que no queden escalones que asomen por arriba de las cintas en los cruces.
  5. `layoutPostes()`: postes de luz con cables cada ~38 m en las rutas asfaltadas e indicadores de caminos a la salida de los pueblos. `cable(A, B, {sagK, r, cabina})` tiende cables con comba (también los del teleférico, con cabinas).
  6. Teleférico (`TELEFERICO` de [[isla.js]]), árboles (`layoutTrees`), rocas (`layoutRocks`) y un poco de loot suelto en la naturaleza.
- **Consultas**: `terrainHeight`, `groundHeight(x, z, y)` (piso más alto bajo los pies: terreno, estructuras o construcciones), `ceilingHeight`, `slopeAt`, `insideHouse`, `inTown`, `nearSolid`.
- **Movimiento**: `moveBody(pos, vel, dt)` mueve al jugador en pasos de 25 cm como máximo, con techo, piso y paredes en cada paso, así no se atraviesan techos ni pisos aunque se caiga rápido. `collide` empuja la cápsula fuera de troncos, rocas, sólidos de [[colision.js]] y construcciones.
- **Escena** (solo cliente): `build(scene)` → `buildTerrain` (colores por bioma en `terrainColor`: la nieve tiene zonas azuladas y manchones de roca lejos de los pueblos; detalle de [[mallas.js]]), `buildWater` (mar con olas animadas, color según profundidad, espuma en la orilla, agua turbia en la ciénaga; río), `buildRoads` (arma la malla con `trisCalles()`, que no usa Three.js y la prueban las pruebas de caminos: cintas en celdas de 1,5 m a lo largo y 2 m a lo ancho para seguir el terreno, cortadas donde empieza un puente con `enPuente` y `tramoFueraDePuente`, más los discos de `discosCalles()`: plazoletas de remate, puntas y esquinas redondeadas), `buildStructures` (mallas por bloque de 160 m con [[mallas.js]] y una malla invisible con los sólidos para disparos y cámara, sin los sólidos `vidrio` ni los de piezas rotas, con el id de pieza de cada triángulo en `userData.triPz`), `buildTrees`, `buildPlants`, `buildRocks`, `buildChests`, `buildSigns` (carteles con texto dibujado en canvas, en las dos caras).
- **Cofres**: `buildChests` pone un cofre de `MODEL.cofre` ([[loot.js]]) en cada `chestSpots`, girado con `chestFacing(c)`: el frente (-Z del modelo) va hacia el lado con más lugar libre (rayo de [[colision.js]] a 0,4 m del piso); si el giro del plano ya deja 2 m libres adelante se respeta. Con el giro de los planos 82 de los 88 cofres quedaban con la cerradura contra la pared.
- **Estado de partida**: `openChest(idx, animar)` (con `animar` la tapa salta y el loot sale volando: lo hace `MODEL.abrirCofre`; sin animar, como en el snapshot al entrar, queda abierto de una), `destroyResource`, `shakeResource`, `moveChest(idx, y)` (baja un cofre cuando se rompe el piso donde estaba).
- **Piezas rompibles**: `romperPieza(id)` saca sus sólidos de [[colision.js]] y esconde sus triángulos (`lotePz`, `lotesChoque` con `ocultar` de [[mallas.js]]); `piezasSinApoyo(id)` devuelve las de la misma estructura que quedaron en el aire.
- **Construcciones de jugadores**: `structs` (Map), `addStruct`, `removeStruct`, `updateStructs`; malla con `makeStructMesh` (exportada). Ver [[Construcción]].
- `rayTerrain`, `minimapImage` (terreno, río, calles, plazoletas y techos).
- `distPoly(p, pts)` (exportada): distancia de un punto a una polilínea.
- `pois`: un punto por pueblo (nombre, centro, radio y desplazamiento opcional de la etiqueta del minimapa).

## Modelos

`MODEL = { clone, baked, cofre, abrirCofre }` lo completa el cliente con [[assets.js]] y [[loot.js]]. El mapa usa los GLB de árboles (`pino`, `arbol`) y rocas (`roca`); los cofres los arma `MODEL.cofre` ([[loot.js]], con `cofre.glb`); las casas y demás estructuras ya no salen de `casa.glb`, se modelan con [[planos.js]]. Ver [[Modelos GLB]].

## Usa

[[items.js]] (`GRID`, `MATERIALS`) · [[planos.js]] · [[isla.js]] · [[colision.js]] · [[mallas.js]]

Pruebas: [[Pruebas del mapa]].
