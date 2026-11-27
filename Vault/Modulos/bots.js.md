# bots.js

Volver a [[Inicio]] · [[Bots]] · [[Arquitectura]]

Archivo: `servidor/bots.js`. Solo lo usa [[server.js]] (no lo sirve el servidor web).

## Qué exporta

- `DIFICULTAD`: los números de cada dificultad (vista, reacción, puntería, cabeza, giro, cada cuánto piensa, pausa entre tiros, cuánto construye, si rompe construcciones, saltos, esquive, ráfaga, cuándo se cura, cuánto persigue).
- `nuevoBot(dif)`, `nombresBots(n, usados)`: datos del jugador bot y sus nombres.
- `prepararBots(room)`: al empezar la partida crea `room.nav` ([[navegacion.js]]) y le da a cada bot su cerebro (`p.bot`): destino de caída, cuándo salta, física, meta, ruta, enemigo, etc.
- `actualizarBots(room, ctx)`: un paso de 50 ms para todos los bots de la sala. `ctx` trae `now`, `dt`, `handleGame`, `broadcast`, `stormAt` y `busPos` de [[server.js]].
- `alRecibirDanio(room, p, atacante, now)` y `alMatar(room, p, now)`: avisos que manda `damagePlayer` / `killPlayer`.

## Partes

- `actualizar` → `aire` (caída y paracaídas) o `piso`.
- `piso`: percibir (cada 250 ms), pensar (cada `piensa` s), pelear o seguir la meta, y la física del jugador (`world.moveBody`, misma gravedad, velocidades y salto que [[main.js]]).
- `percibir` y `vista`: quién está a la vista (rayo contra terreno, `sol` sin vidrios, árboles y construcciones).
- `pensar`: tormenta (`zonaSegura`), curarse, loot (`mejorLoot`), madera (`arbolCerca`) o ir a otro cofre (`pasear`).
- `seguirMeta`, `irA`, `seguirRuta` (sigue la ruta como "zanahoria" medio metro adelante, sin cortar camino en escaleras), `vigilarAtasco`, `adentro` (bajo techo o arriba de algo: primero busca salir).
- `combate`, `elegirArma`, `disparar`, `dispararA` (a una construcción), `cubrirse`, `recargar`, `curarse`.
- `avisarEstado`: el mensaje `state` para los clientes.
- `SF_BOTS_DEBUG=1`: muestra cada 10 s qué hace cada bot.
- `SF_NAV_MS` (6 si no está): milisegundos por cuadro que `actualizarBots` le da a `room.nav.trabajar` para armar grillas de [[navegacion.js]]. En Render gratis vale 2 ([[render.yaml]], [[Jugar online]]).

## Usa

[[items.js]], [[construccion.js]] (`cajaPieza`), [[caida.js]] (`CAIDA`, `PARACAIDAS`), [[opcionesBots.js]], [[navegacion.js]].
