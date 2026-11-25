# planos.js

Volver a [[Inicio]] · lo usa [[world.js]] · diseño en [[Mapa de la isla]]

Archivo: `public/js/planos.js`. Planos de todas las estructuras del mapa. **Una sola lista de piezas da la geometría y las colisiones**, así lo que se ve y lo que se choca coinciden.

## `class Plano`

- Guarda `parts` (lo que se dibuja), `solids` (cajas y rampas), `cyls` (cilindros sólidos), `loot`, `chests`, `lights` y `signs` (carteles).
- Piezas: `box`, `cbox`, `ramp` (sólido inclinado: `up` dice hacia dónde sube), `slope` (placa inclinada solo visual), `cyl`, `tube`, `sphere`, `tri`.
- Armado: `wall` (pared con puertas, ventanas y huecos, marcos y hoja de puerta abierta hacia adentro), `slab` (losa con huecos), `stairs` (rampa invisible + escalones + zanca, baranda opcional), `gable` (techo a dos aguas con cielorraso y rampas caminables), `flatRoof` (terraza con parapeto; `abierto` deja huecos en el parapeto para llegar con una escalera), `rail`, `footing`, `bounds`.
- `STOREY = 4` (alto de un piso), `T = 0.3` (espesor de pared).
- `PALETA`: material → `[color, tipo, patrón]`. Tipos: `s` mate, `m` metal, `v` vidrio, `e` emisivo. Patrones (los dibuja el shader de [[mallas.js]]): ladrillo, tablas, tejas, chapa, hormigón, piedra, baldosas, piso de madera, troncos, revoque, adobe, heno.
- `merge(dst, src, dx, dz, dy)`: suma un plano dentro de otro (con sus carteles).

## Estructuras (`PLANOS`)

Casas (1 o 2 pisos, con escalera, porche y balcón opcional), edificio de ciudad (varios pisos, escalera en U y terraza), local, galpón con entrepiso, cobertizo, granero con altillo, silo, molino, tanque de agua, faro con escalera interior hasta el balcón, muelle, bote, grúa con torre de escaleras y cabina, contenedor, palafito, pasarela, casa de adobe con terraza, puesto, carpa, torre de vigía, capilla en ruinas, estación de servicio, parada, puente, fogón, auto, tractor, cerca, farol, fuente, calesita, rueda de la fortuna, kiosco, laboratorio, cúpula del observatorio (con ranura y telescopio), antena, cabaña, lodge, torre de teleférico, tolva, andamio, malecón, cajas, barriles, campo sembrado, arco, montaña rusa, ruinas, banco, tacho, hidrante, cartel, seto, cantero, buzón, jardín, poste de luz e indicador de caminos.

Muebles internos: `mesa`, `silla`, `cama`, `sillon`, `estante`, `heladera`, `mesada`, `caja`, `barril`.

## Reglas que cumplen todos los planos

Las revisa [[Pruebas del mapa]]: todo el loot y los cofres se alcanzan caminando, las escaleras se suben de punta a punta y hay 1,8 m libres para pararse en cada piso.
