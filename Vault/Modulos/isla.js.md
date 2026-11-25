# isla.js

Volver a [[Inicio]] · lo usa [[world.js]] · ver [[Mapa de la isla]]

Archivo: `public/js/isla.js`. Diseño a mano de la isla (solo datos, sin Three.js). Coordenadas del mundo: X al este, Z al sur. Rotaciones de a cuarto de vuelta: 0 = el frente mira al sur, 1 = al este, 2 = al norte, 3 = al oeste.

- `PUEBLOS`: los 10 pueblos. Cada uno tiene `id`, `name`, centro (`x`, `z`), radio `r`, altura de la meseta `h` (o `'auto'`), `tema`, `calles` (polilíneas con ancho y material: asfalto, vereda, tierra, arena, nieve) e `items` (`[plano, opciones, x local, z local, rot, extra]`). Opcionales: `borde`, `corte` (el puerto se corta hacia el mar), `ruido` (ciénaga), `pozo` (cantera), `etiqueta` (corre el nombre en el minimapa).
- `RUTAS`: 15 rutas entre pueblos (8 asfaltadas, el resto de tierra).
- `RIO`: cauce del río, de la montaña a la ciénaga.
- `TELEFERICO`: torres del teleférico, del Refugio Nevado a la cumbre.
- `SUELTOS`: 41 lugares chicos entre pueblos (estación de servicio, torres de vigía, capilla, camping, paradas, cobertizos, casas, contenedores, antena, molino, autos, tractor, cajas, barriles, fogones y ruinas), casi todos con un poco de loot.

`extra` de un ítem: `{ pad: false }` no aplana el terreno, `{ y }` fija la altura de la base, `{ dy }` la sube.
