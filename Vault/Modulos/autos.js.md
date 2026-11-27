# autos.js

Volver a [[Inicio]] · [[Arquitectura]] · sistema: [[Autos]]

Archivo: `public/js/autos.js`. Medidas, asientos, física de manejo, choques y estado de red de los autos. Sin Three.js: lo importan [[manejar.js]], [[world.js]] y [[server.js]].

Coordenadas del auto: x a la derecha, y arriba, z hacia atrás (el frente mira a −Z, como el personaje). Ángulos `yaw`, `pitch` (trompa arriba positivo) y `roll` (lado derecho arriba positivo), orden YXZ como Three.js.

## Constantes

- `AUTO`: medidas del modelo (`LARGO` 4,5, `ANCHO` 2,02, `ALTO` 1,93, ejes, trocha, radio de rueda), `VIDA` 800, velocidades y aceleraciones (`MAX` 27, `TURBO_MAX` 36, `REVERSA` 9, `ACEL`, `ACEL_TURBO`, `FRENO`, `ROCE`, `MANO`), dirección (`GIRO_MAX`, `AGARRE`, `AGARRE_MANO`), turbo (`TURBO_DURA` 3 s, `TURBO_CARGA` 7 s), choque (`CIRCULOS`, `RADIO`), `AGUA` (−0,9: no entra más hondo), `ALCANCE` (para subirse) y `ATROPELLO` (7 m/s).
- `EMBESTIDA`: tabla por material (`madera`, `piedra`, `metal`, `arbol`, `roca`) de las embestidas: `desde` (m/s contra la cosa desde los que la daña), `porMs` (daño por m/s de más), `frena` (m/s que pierde el auto por cada 100 de vida que rompe) y `dano` (daño al auto por cada 100 de vida que rompe), más `SALE_MIN`, `ESPERA` (0,35 s antes de volver a dañar lo mismo) y `ATRAVIESA` (0,8 s que sigue de largo esperando al servidor). Ver [[Autos]].
- `ASIENTOS` (4, altura del almohadón), `VOLANTE`, `RUEDAS` (nombre del nodo del GLB y posición), `COLORES` (los nombres de color de [[isla.js]]).

## Funciones

- `nuevoAuto(id, lugar)`: el estado (posición, ángulos, velocidades, `giro`, `hp`, `rota`, `seats`, `ctrl` = quién lo simula, `turbo`).
- Geometría: `aMundo`, `aLocal`, `puntoMundo` (con cabeceo y rolido), `adelante`, `derecha`, `rapidez`, `avance`.
- `asientoLibre(a, desde)`: el siguiente asiento libre (el conductor primero).
- `sueloAuto` / `empujarDeAuto`: el auto como piso (capó, techo y baúl) y como pared para los jugadores; [[world.js]] los llama desde `groundHeight` y `collide` por cada auto de `world.dinamicos`.
- `rayoAuto(a, origen, dir, max)`: dónde pega un disparo (caja hasta la cintura y el techo; las ventanillas no frenan).
- `lugarBajada(world, a, k)`: dónde se baja el del asiento `k`.
- `fisicaAuto(world, a, ent, dt, emb)`: un paso de manejo (`ent`: `acel`, `freno`, `izq`, `der`, `mano`, `turbo`); devuelve el golpe más fuerte (m/s perdidos). Con `emb` (`{ vida(o) }`, lo pasa [[manejar.js]]) el auto rompe o no lo que choca según la velocidad: le pasa a [[world.js]] `collide` un `choque` que decide con `impacto`; si rompe algo, el auto pierde velocidad y sigue de largo (`a.atraviesa`), y cada golpe queda en `a.embestidas`. Sin `emb` (las pruebas viejas) todo es irrompible como antes.
- Embestidas: `impacto(mat, hp, v, esc)` → `{ dano, rompe, sale, danoAuto }` (lo usan el cliente para predecir y [[server.js]] para decidir), `materialChoque(world, o)` (material de una pieza, construcción, árbol o roca; null si es fija o no se rompe) y `claveChoque(o)`.
- `pisaA(a, pos)`: si el auto está encima de alguien (atropellos).
- Red: `estadoRed` (`p`, `q`, `v`, `g`, `f`), `aplicarRed` (valida y aplica), `autoPublico` (para el snapshot).

## Pruebas

`node tools/autos/pruebas.mjs`: los 14 autos salen libres y quietos, se maneja desde cada uno sin meterse en nada ni hundirse, velocidad máxima, choque contra una casa, agua honda, dos autos que chocan, techo, rayos, bajarse y el estado de red. `node tools/autos/embestidas.mjs`: la tabla (a qué velocidad se rompe cada material) y la física de las embestidas con una pared, un árbol, una roca y una construcción puestos en un lugar abierto. `node tools/autos/servidor.mjs`: las embestidas contra el servidor de verdad (ver [[Autos]]).
