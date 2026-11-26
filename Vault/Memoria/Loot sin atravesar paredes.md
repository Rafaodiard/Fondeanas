# Loot sin atravesar paredes

Volver a [[Índice de memoria]] · resultado en [[lugarLoot.js]], [[Loot y rarezas]] y [[Pruebas del loot]]

**2026-11-26 · Rafael**

"Hace que el loot no pueda atravesar las paredes".

**2026-11-26 · Claude (al hacer ese pedido)**

- Antes el servidor ponía cada objeto a 1-1,8 m en cualquier dirección sin mirar paredes: con los cofres del mapa, 1164 de 2640 objetos de la prueba salían del otro lado de una pared (al cuarto de al lado o afuera de la casa).
- Ahora vale para todo lo que reparte el servidor: cofres, lo que se tira y lo que deja alguien al morir. Frenan paredes y vidrios del mapa, muebles altos, construcciones de jugadores, árboles y rocas. Los autos no (se mueven).
- También se acomoda el loot que ya está en el piso cuando se construye o edita encima (sale para su lado o queda arriba) y cuando se rompe lo que tenía abajo (cae).
- En el agua el loot queda flotando cerca de la superficie, como antes quedaba a la altura de quien lo soltó. Lo que deja alguien que muere en el aire ahora cae al piso (antes quedaba flotando a su altura).
