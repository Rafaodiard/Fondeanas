# Daño visible y punto débil

Volver a [[Inicio]] · código en [[golpes.js]], [[server.js]], [[main.js]] e [[items.js]] · pedido en [[Daño visible y críticos]]

## Cuánto daño tiene

- Las piezas del mapa ([[Estructuras rompibles]]) y las construcciones ([[Construcción]]) muestran grietas que se abren y se oscurecen a medida que pierden vida. Las ven todos los jugadores: el servidor manda la vida nueva a toda la sala (`pzHp` con `ids` y `hp`; `structHp` con `hp` y `dano`). Las explosiones mandan un solo `pzHp` con todas las piezas que tocaron.
- El que entra tarde recibe en el snapshot `pzHp: [[id, vida], ...]` (piezas dañadas sin romper) y `dano` en cada construcción.
- Debajo de la mira aparece la barra de vida de lo que golpeaste (pico o tiros) o de lo que mirás con el pico o construyendo: piezas del mapa, construcciones, árboles y rocas.

## Punto débil (golpe crítico del pico)

- Datos en `PUNTO_DEBIL` de [[items.js]]: `mult` 2 (daño del crítico), `radio` 0,55 m (tolerancia del servidor), `visual` 0,3 m (radio del círculo), `dura` 6 s, `dist` 0,55 a 1,15 m (a qué distancia del golpe aparece el siguiente).
- Con el primer golpe de pico a una pieza del mapa, construcción, árbol o roca aparece un círculo celeste cerca del golpe, sobre la misma cosa. Solo lo ve el que pica.
- Pegarle ahí es **crítico**: doble daño (100 en vez de 50), número celeste grande, aro, chispas y sonido propio, y el punto se mueve a otro lugar. Pegarle a otro lado hace el daño normal y el punto se queda. Si dejás de pegarle 6 s o le pegás a otra cosa, se va.
- Los materiales que da cada golpe no cambian; el crítico la rompe más rápido (y el golpe que rompe da el doble, como siempre).

## Quién decide

- El cliente manda en `swing` el punto del golpe `at` y la normal de la cara `n` (`castRay` de [[main.js]] ahora devuelve `n`).
- El servidor (`puntoGolpe`, `esCritico`, `nuevoDebil`, `avisarDebil` en [[server.js]]): acepta `at` solo si está cerca del jugador y sobre la cosa (sólidos de la pieza, cajas o superficie de la construcción, tronco del árbol, roca). Es crítico si `at` está a `radio` del punto débil que eligió él (`player.debil`). El punto nuevo se busca moviéndose sobre el plano de la cara (piezas y construcciones: tiene que quedar sobre un sólido de la misma pieza y del lado de afuera), alrededor del tronco a la altura de la mano (árboles) o girando alrededor del centro (rocas). Le manda al que pica `debil` con `o`, `p`, `n`, `crit`, `hp` y `max` (`p: null` si no hay punto).
- El cliente no puede dar críticos diciendo un punto que no está sobre lo que pica.

## Pruebas

`node tools/golpes/pruebas.mjs` levanta el servidor en otro puerto, arma una partida por WebSocket, se para al lado de una pared del mapa y revisa: primer golpe normal y aparición del punto débil sobre la pared, que no se mueve si le pegás a otro lado, crítico con el doble de daño y punto nuevo, que un punto falso no da crítico, que el que entra tarde recibe la vida de las piezas dañadas, que se va al romperse, y el crítico en un árbol. Tiene que terminar con "todo OK".
