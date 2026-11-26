# planos.js

Volver a [[Inicio]] · lo usa [[world.js]] · diseño en [[Mapa de la isla]] · roturas en [[Estructuras rompibles]]

Archivo: `public/js/planos.js`. Planos de todas las estructuras del mapa. **Una sola lista de piezas da la geometría y las colisiones**, así lo que se ve y lo que se choca coinciden.

## `class Plano`

- Guarda `parts` (lo que se dibuja), `solids` (cajas y rampas), `cyls` (cilindros sólidos), `loot`, `chests`, `lights` y `signs` (carteles).
- Piezas: `box`, `cbox`, `ramp` (sólido inclinado: `up` dice hacia dónde sube), `slope` (placa inclinada solo visual), `cyl`, `tube`, `sphere` (con `grosor` para cáscaras huecas), `arc` (pared curva, sector de anillo), `tri`. `solid` y `solidCyl` agregan sólidos sin parte visible.
- Grupos: todo lo que se agrega lleva un grupo `g`; `grupo(fn, { fija })` junta en una sola pieza rompible lo que agrega `fn` y `conGrupo(g, fn)` suma cosas a un grupo ya hecho. `conTag('esc' | 'veg', fn)` marca escalones y plantas. `vanos` guarda las puertas al nivel del piso y `techos` las aguas de los techos (las usa `nieve()` para apoyar la nieve encima, en el mismo grupo que su agua).
- Armado: `wall` (pared con puertas, ventanas y huecos, marcos y hoja de puerta abierta hacia adentro; las ventanas con `glass` llevan vidrio y un sólido invisible marcado `vidrio` que frena al jugador pero no las balas), `slab` (losa con huecos), `stairs` (rampa invisible + escalones + zanca; con `rail` lleva baranda sólida con balaustres sobre cada escalón, y `lados` dice qué hace cada lado: libre al final, cortado entre dos puntos, o `'pared'` si va contra la pared), `gable` (techo a dos aguas con cielorraso y rampas caminables), `flatRoof` (terraza con parapeto; `abierto` deja huecos en el parapeto para llegar con una escalera), `rail`, `footing`, `bounds`.
- `STOREY = 4` (alto de un piso), `T = 0.3` (espesor de pared).
- `PALETA`: material → `[color, tipo, patrón]`. Tipos: `s` mate, `m` metal, `v` vidrio, `e` emisivo. Patrones (los dibuja el shader de [[mallas.js]]): ladrillo, tablas, tejas, chapa, hormigón, piedra, baldosas, piso de madera, troncos, revoque, adobe, heno.
- `merge(dst, src, dx, dz, dy)`: suma un plano dentro de otro (con sus carteles).

## Estructuras (`PLANOS`)

Casas (1 o 2 pisos, con escalera, porche y balcón opcional), edificio de ciudad (varios pisos, escalera en U y terraza), local, galpón con entrepiso, cobertizo, granero con altillo, silo, molino, tanque de agua, faro con escalera interior hasta el balcón, muelle, bote, grúa con torre de escaleras y cabina, contenedor, palafito, pasarela, casa de adobe con terraza, puesto, carpa, torre de vigía, capilla en ruinas, estación de servicio, parada, puente, fogón, tractor, cerca, farol, fuente, calesita, rueda de la fortuna, kiosco, laboratorio, cúpula del observatorio (con ranura y telescopio), antena, cabaña, lodge, torre de teleférico, tolva, andamio, malecón, cajas, barriles, campo sembrado, arco, montaña rusa, ruinas, banco, tacho, hidrante, cartel, seto, cantero, buzón, jardín, poste de luz e indicador de caminos.

Muebles internos: `mesa`, `silla`, `cama`, `sillon`, `estante`, `heladera`, `mesada`, `caja`, `barril`.

El `puente` acepta `dy`: la diferencia de altura entre las dos orillas, así el tablero, los cordones, las barandas y los pilares siguen la pendiente.

## Piezas rompibles

Ver [[Estructuras rompibles]].

- `piezasDe(P)`: junta los grupos del plano en piezas (sólidos + partes visibles) y calcula si es fija, si está apoyada en el piso, el material (`claseDe`), el color, la caja (`aabb`) y el factor de vida por tamaño. Lo guarda en `P._piezas`.
- `cajasParte(q)`: las cajas que ocupa una parte visible (los caños y las paredes curvas se cortan en pedazos). `solapa(a, b)` mide cuánto se tocan dos cajas e `IndiceCajas` las busca rápido en celdas de 2 m.
- `vecinasDe(lista)`: qué piezas se tocan. `sinApoyo(lista, vec, rotas)`: las que ya no llegan al piso pasando por piezas sanas.

## Reglas que cumplen todos los planos

Las revisa [[Pruebas del mapa]]: todo el loot y los cofres se alcanzan caminando, las escaleras se suben de punta a punta, hay 1,8 m libres para pararse en cada piso, no hay caras al revés ni caras encimadas que titilen, todo lo que se ve choca y ninguna pieza arranca sin apoyo.

El plano `auto` (un auto de cajas) se borró el 2026-11-26: las entradas `auto` de [[isla.js]] ahora son autos manejables ([[Autos]]).
