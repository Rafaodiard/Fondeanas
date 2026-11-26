# navegacion.js

Volver a [[Inicio]] · [[Bots]] · [[bots.js]]

Archivo: `servidor/navegacion.js`. La usan los bots para caminar por el mapa: entrar a las casas por la puerta, subir escaleras, bajar de techos y torres, rodear edificios.

## Grillas

`Navegacion.grilla(cx, cz, medio)` arma una grilla cuadrada (40 m de lado para lo que buscan, 36 m alrededor del bot para rodear o salir) con celdas de 25 cm (`NAV.D`). En cada celda guarda los lugares donde cabe parado un jugador de radio 0,42 m y 1,8 m de alto: el terreno, cada piso, escalón o techo de [[colision.js]] (`world.sol`) que no tenga otro piso a un escalón arriba ni algo encima más bajo que la cabeza, sin chocar paredes ni troncos. En el agua honda el lugar queda en la superficie (se nada).

Dos lugares vecinos (también en diagonal, sin cortar esquinas) se unen si se pasa subiendo a lo sumo un escalón (`STEP`), subiendo saltando hasta 1,25 m (`NAV.SALTO`) o bajando hasta 7 m (`NAV.BAJADA`; desde 8 m recién hay daño por caída), siempre que no haya nada en el medio (por ejemplo el techo entre una terraza y el piso de abajo). Cuestan más el agua, los saltos, las bajadas y pisar al lado de un borde (`NAV.BORDE`): así las rutas van por el medio de las escaleras y pasarelas.

Armar una grilla lleva decenas de milisegundos, así que se arma de a poco (`trabajar(ms)`, 6 ms por paso de los bots); mientras tanto `grilla()` devuelve null y el bot camina derecho. Se guardan las últimas 48 y se tiran las que toca una pieza del mapa que se rompe (`invalidar`, lo llama `damagePieza` en [[server.js]]). `grillaYa` la arma en el momento (para las pruebas).

## Rutas

- `ruta(g, desde, meta)`: A* hasta el lugar más cerca de la meta que se alcance; `llega` dice si quedó a menos de 1,2 m.
- `salida(g, desde, meta)`: para ir lejos desde adentro de una casa o un techo: hasta un lugar al aire libre a nivel del terreno, el que deje más cerca de la meta.
- Las rutas salen simplificadas (sin los puntos de los tramos rectos).

## Pruebas

`node tools/bots/pruebas.mjs` (ver [[Bots]]). El loot de los botes que flotan lejos del muelle en Puerto Bruma no se alcanza ni nadando (la cubierta queda 2,1 m arriba del agua): la prueba lo tolera.
