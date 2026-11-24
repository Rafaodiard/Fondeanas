# items.js

Volver a [[Inicio]] · [[Arquitectura]]

Archivo: `public/js/items.js`. Definiciones compartidas entre cliente y servidor, sin dependencias. Lo importan [[server.js]], [[main.js]], [[world.js]] y [[visor.html]].

## Contenido

- `RARITIES`: común, poco común, rara, épica, legendaria (multiplican daño y tiempo de recarga). Ver [[Loot y rarezas]].
- `AMMO`: ligera, media, pesada, cartuchos, cohetes.
- `WEAPONS`: pistola, subfusil, rifle, escopeta, francotirador (con mira), lanzacohetes (cohete con daño en área). Ver [[Armas y disparo]].
- `CONSUMABLES`: venda, botiquín, frasco azul, bidón azul. Ver [[Curación y escudo]].
- `MATERIALS`: madera (150 de vida), piedra (300), metal (450). `MAT_ORDER`, `BUILD_COST = 10`, `MAX_MATS = 999`, `GRID = 4`.
- `PICKAXE`: daño, daño a estructuras, cooldown, alcance y cuánto material da cada recurso. Ver [[Pico y recursos]].
- `SLOTS = 5` (sin contar el pico).
- Funciones: `rollRarity`, `randomWeapon` (pesos distintos para piso y cofre), `randomConsumable`, `randomAmmo`, `itemLabel`, `itemColor`, `weaponDamage`, `weaponReload`.
- Construcciones: `DIRS` y `structKey` (normaliza paredes compartidas entre dos celdas). Ver [[Construcción]].
