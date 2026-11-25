# Estructuras rompibles

Volver a [[Inicio]] · código en [[planos.js]], [[world.js]], [[mallas.js]], [[server.js]] y [[main.js]] · pruebas en [[Pruebas del mapa]]

Todas las estructuras del mapa se rompen con el pico, a tiros y con explosiones, pieza por pieza. Lo que queda colgando cuando se rompe lo que lo sostiene se cae. Pedido en [[Errores del mapa]].

## Piezas

- `piezasDe(P)` en [[planos.js]] arma las piezas de un plano a partir de sus grupos (`grupo()`, `conGrupo`): cada tramo de pared (~4 m, con su marco y su puerta), cada baldosa de losa (~4 m), cada agua del techo, cada escalera, cada mueble, cada tramo de muelle o de puente es una pieza. Las partes que se dibujan sin sólido van con el grupo sólido que tocan; los sólidos invisibles, con la parte visible que tocan.
- **Fijas** (no se rompen): las marcadas con `{ fija: true }` (cimientos, zócalos, malecón, torres del teleférico), las enterradas al ras del piso, las que no tienen nada visible y las estructuras de `NO_ROMPE` en [[world.js]] (postes de luz, torres del teleférico, carteles, indicadores y malecón).
- **Material** (`claseDe`): madera, piedra o metal según el material de la paleta. Vida = `MATERIALS[clase].hp` de [[items.js]] (150 / 300 / 450) × un factor por tamaño (`factor`, entre 0,3 y 1,5).
- **Apoyo**: una pieza se sostiene sola si es fija o si tiene un sólido que arranca en el piso (hasta 12 cm). `vecinasDe` arma quién toca a quién y `sinApoyo` busca, desde las piezas apoyadas, las que quedan en el aire.
- En [[world.js]], `place` les da ids globales (iguales en el servidor y en los clientes porque los dos arman el mismo mundo en el mismo orden): `world.piezas[id] = { fija, clase, color, hp, solids, rota, aabb }`. `romperPieza(id)` saca sus sólidos de [[colision.js]] (`remove`) y la esconde de las mallas; `piezasSinApoyo(id)` devuelve las de la misma estructura que quedaron en el aire.

## Daño

- **Pico** (`swing` con `pz`): 50 por golpe (`PICKAXE.struct`), y da material según la pieza: madera 6, piedra 6, metal 5 (`PICKAXE.gain` de [[items.js]]); el golpe que la rompe da el doble.
- **Disparos** (`shoot` con `hits: [{ pz, n }]`): daño de estructura del arma (`def.struct`) por la rareza y por la parte de los perdigones que pegaron.
- **Explosiones** (`explode`): cada pieza dentro del radio, una vez, con menos daño cuanto más lejos.
- El servidor valida la distancia a la caja de la pieza (`distPieza`) y lleva la vida en `room.pzHp`.

## Cuando se rompe

`damagePieza` en [[server.js]]: rompe la pieza y las que quedan sin apoyo, manda `pzRota` con todos los ids, baja el loot que estaba encima (`itemsDel` + `itemsAdd` con la altura nueva) y los cofres (`chestMove`). Las piezas rotas van en el snapshot de la partida (`piezas`, `cofresMovidos`) para el que entra tarde.

En el cliente ([[main.js]]): `castRay` sabe qué pieza tocó por la malla de choque (`userData.triPz`, un id por triángulo, de [[mallas.js]]); `pzRota` llama a `world.romperPieza`, tira escombros del color de la pieza (`escombros`) y suena `structBreak`.

## Ventanas

Todas las ventanas con marco tienen un sólido invisible marcado `vidrio`: frenan al jugador (así el cuerpo no atraviesa el marco ni el vidrio), pero no están en la malla de choque, así que las balas y la cámara pasan.
