# Arquitectura

Volver a [[Inicio]].

## Reparto de autoridad

Según el comentario de cabecera de [[server.js]]: **el cliente decide su movimiento; el servidor decide inventario, loot, daño, construcciones, tormenta y ganador.**

- El cliente ([[main.js]]) simula su propio personaje (física, colisiones con [[world.js]]) y manda su posición con el mensaje `state`.
- El cliente calcula los impactos de sus disparos (raycasts) y los manda en `shoot` como lista de `hits`; el servidor revisa cargador, cooldown y rango antes de aplicar el daño.
- Los autos siguen la misma idea: el que maneja simula su auto con [[autos.js]] y manda su estado; el servidor decide quién va en cada asiento, quién simula cada auto (`ctrl`: el conductor, o el último que lo manejó mientras frena solo), el daño, los atropellos y las explosiones. Ver [[Autos]].
- El daño por caída también lo calcula el cliente y lo manda con `fall` (el servidor lo limita a 100).
- El servidor maneja inventario, munición, cofres, recursos, estructuras, tormenta y muertes, y avisa a todos.
- Ver [[Protocolo de red]] para la lista de mensajes.
- **Cuentas, pavos, casino y tienda** (`server/`): el servidor decide todo (saldo, apuestas, resultados, premios y compras) y lo guarda en SQLite ([[db.js]]). El cliente habla con [[api.js]] por HTTP (`/api/*`) y el WebSocket solo lee la sesión al conectarse. Ver [[Cuentas y pavos]], [[Casino]] y [[Tienda y skins]].

## Mismo mundo en todos lados

El servidor crea `new World(seed, ISLAND_SIZE)` y cada cliente `new World(room.seed, room.islandSize)` con los datos que le manda el servidor ([[world.js]]). La isla es fija (sale de [[isla.js]] y de una semilla propia del mapa, `MAP_SEED`), así que todos obtienen exactamente la misma isla y no hace falta mandar el mapa; la `seed` de la sala ya no cambia el mapa. El servidor usa el `World` sin escena (solo datos: lugares de loot, cofres, árboles, rocas); el cliente además llama a `build(scene)`.

## Código compartido

[[items.js]] y [[autos.js]] no tienen dependencias y los importan tanto [[server.js]] como el cliente ([[main.js]], [[manejar.js]], [[world.js]]) (y `world.js` usa `GRID` y `MATERIALS`). El servidor sirve `public/` como raíz web y `node_modules/three/` en `/vendor/three/`; [[index.html]] tiene un import map que apunta `three` y `three/addons/` ahí.

## Cadena de modelos en el cliente

```
public/models/*.glb ──► assets.js (loadAssets, cloneAsset, bakedParts)
                          │
                          ├─► models.js ──► rig.js (personaje con esqueleto)
                          ├─► loot.js (objetos del piso y cofres, con efectos)
                          └─► world.js vía MODEL.clone / MODEL.baked (árboles, rocas) y MODEL.cofre / MODEL.abrirCofre (loot.js)
```

`main.js` (y [[mapa.html]]) completa `MODEL.clone = cloneAsset; MODEL.baked = bakedParts; MODEL.cofre = createChest; MODEL.abrirCofre = abrirCofre;` para que `world.js` pueda usar los GLB sin importar `assets.js` (así el servidor puede importar `world.js` sin Three cargando modelos). Si un GLB no carga, se usan los modelos procedurales de [[models.js]].

## Dependencias entre módulos (imports)

- [[server.js]] → [[world.js]], [[items.js]], [[autos.js]], [[db.js]], [[cuentas.js]], [[casino.js]], [[tienda.js]], [[premios.js]], [[api.js]], `ws`
- [[main.js]] → además [[cuenta.js]], [[lobby.js]], [[casino.js]], [[tienda.js]], [[anuncios.js]]
- [[main.js]] → [[world.js]], [[assets.js]], [[models.js]], [[items.js]], [[audio.js]], [[rig.js]], [[caida.js]], [[manejar.js]]
- [[manejar.js]] → [[autos.js]], [[models.js]], [[controles.js]], [[rig.js]]
- [[caida.js]] → `three` (solo vectores; no toca la escena)
- [[models.js]] → [[assets.js]], [[rig.js]]
- [[rig.js]] → [[assets.js]]
- [[world.js]] → [[items.js]], [[planos.js]], [[isla.js]], [[colision.js]], [[mallas.js]], [[autos.js]]
- [[mapa.html]] → [[world.js]], [[assets.js]], [[models.js]] (los autos estacionados)
- [[visor.html]] → [[rig.js]], [[assets.js]], [[models.js]], [[items.js]]

Ver también [[Grafo del código]].
