# Mapa de la isla

Volver a [[Inicio]] · datos en [[isla.js]] · estructuras en [[planos.js]] · código en [[world.js]] · pruebas en [[Pruebas del mapa]]

Isla fija de 1200 × 1200 m (la misma en todas las partidas), con diseño propio: nombres, lugares y estructuras originales. Se recorre sin jugar en [[mapa.html]].

## Pueblos (10, cada uno con identidad propia)

| Pueblo | Dónde | Identidad |
|---|---|---|
| Altoplaza | centro | Ciudad: edificios de 2 a 4 pisos con locales y toldos, plaza con fuente, veredas, faroles, paradas y autos |
| Villa Cardo | oeste | Barrio de casas con jardín, cercas y cobertizos |
| Puerto Bruma | sur, en la bahía | Malecón, galpones, contenedores, grúa con cabina, muelles, botes y faro |
| Granja Los Álamos | este-noreste | Granero con altillo, silos, molino, tanque de agua, campos sembrados y álamos |
| Médanos | este, en el desierto | Casas de adobe con terraza, mercado de puestos y cactus |
| Parque Remolino | sureste | Rueda de la fortuna, calesita, montaña rusa, kioscos y arco de entrada |
| Palafitos | suroeste, en la ciénaga | Casas sobre pilotes unidas por pasarelas, torre de vigía y agua turbia |
| Cantera Roja | noroeste del centro | Pozo escalonado de roca roja, tolva con cinta, andamio, contenedores y galpón |
| Refugio Nevado | en la montaña nevada | Lodge, cabañas con nieve en el techo y teleférico hasta la cumbre |
| Observatorio Cumbre | norte, sobre un cerro | Cúpula con telescopio, laboratorios y antena |

## Entre pueblos

- 15 rutas (8 asfaltadas con postes de luz y cables, el resto de tierra), puentes donde cruzan el río e indicadores de caminos a la salida de los pueblos.
- Todas las calles y rutas forman **una sola red** y ninguna se corta de golpe: cada punta llega a otra calle o termina en un remate. Remates actuales: rotonda al oeste de Villa Cardo, playón al este de Médanos, plazoleta con banco al oeste del Parque Remolino, playón de carga al fondo del pozo y playón de maniobras al este de la Cantera Roja, plazoleta al oeste del Refugio Nevado, estacionamiento del Observatorio Cumbre, plazoleta del camping, plazoletas a la orilla de la ciénaga (Palafitos) donde llegan los caminos de Villa Cardo y de Puerto Bruma, y los caminitos que llegan a la puerta del granero y de la cúpula.
- Cambios de trazado (2026-11-25): Villa Cardo cierra sus dos calles cruzadas en un rectángulo; la calle de atrás de Puerto Bruma vuelve a la costanera por los dos lados; las rutas de la Granja salen de su calle (al Observatorio por el patio y a Médanos por la punta este); la ruta del Refugio baja a la rampa de la Cantera; el camino de Villa Cardo a la montaña llega al cruce del Refugio y la calle sur de la Cantera sale de él; el camino de tierra del oeste ahora une la ruta Altoplaza-Villa Cardo con la ruta al puerto pasando por la puerta de la capilla.
- Un río que baja de la montaña y desemboca en la ciénaga.
- 41 lugares chicos con poco loot: estación de servicio, torres de vigía, capilla en ruinas, camping, paradas, cobertizos, casas sueltas, contenedores, antena, molino, autos, tractor, cajas, barriles, fogones y ruinas.

## Reglas de construcción del mapa

- Cada estructura aplana exactamente su huella: las puertas quedan al ras del piso de afuera.
- Lo que se ve y lo que choca sale de la misma lista de piezas ([[planos.js]]).
- El jugador se mueve en pasos chicos con techo, piso y paredes ([[world.js]] `moveBody`): no se atraviesan techos ni pisos.
- Todo el loot y los cofres se alcanzan caminando (lo verifica [[Pruebas del mapa]]).
- Las escaleras tienen baranda sólida, las ventanas tienen vidrio que frena al jugador y deja pasar las balas, y los puentes siguen la pendiente entre las dos orillas.
- No hay caras que titilen, estructuras metidas en otras ni en las calles: también lo revisa [[Pruebas del mapa]].
- En los cruces la calle que sigue de largo queda arriba; las puntas y las esquinas se redondean (sin huecos en forma de cuña) y el terreno debajo de las calles se alisa para que el pasto no asome ([[world.js]] `capasCalles`, `discosCalles`, `suavizarCalles`).
- **Todo se rompe** pieza por pieza (pico, tiros y explosiones), y lo que queda sin apoyo se cae. Ver [[Estructuras rompibles]].

## Pedido

Ver [[Pedido del mapa]], [[Errores del mapa]] y [[Caminos prolijos]] en la memoria.
