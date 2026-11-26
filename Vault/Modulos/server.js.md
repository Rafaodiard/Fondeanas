# server.js

Volver a [[Inicio]] · [[Arquitectura]] · [[Protocolo de red]]

Archivo: `server.js` (raíz del repo). Se arranca con `npm start` (`node server.js`).

## Qué hace

1. **HTTP estático**: sirve `public/` en `/` y `node_modules/three/` en `/vendor/three/` (lo usa el import map de [[index.html]]).
2. **WebSocket** (`ws`) sobre el mismo servidor: salas, partida y chat. Ver [[Protocolo de red]].
3. **Tick** cada 100 ms (`TICK_MS`): pasa de `bus` a `playing`, fuerza el salto cuando termina el recorrido del bus y aplica la [[Tormenta]].

## Constantes

| Constante | Valor |
|---|---|
| `PORT` | `process.env.PORT` o 3000 |
| `ISLAND_SIZE` | 1200 |
| `BUS_DURATION` | 22 s |
| `BUS_HEIGHT` | 260 |
| `MAX_PLAYERS` | 16 personas (los bots completan aparte, hasta 24 en total) |
| `BOT_MS` | 50 (los bots se mueven a 20 Hz) |
| `TICK_MS` | 100 |
| `PICKUP_RANGE` | 3.2 |

## Funciones principales

- `makeCode`, `createRoom`, `roomInfo`, `matchSnapshot` → [[Salas y partidas]]
- `startMatch`: crea el `World` ([[world.js]]), reparte loot del piso, arma el recorrido del bus y las fases de la tormenta, resetea jugadores y la vida de las piezas del mapa (`room.pzHp`, `room.pzRotas`).
- `stormAt` → [[Tormenta]]
- `damagePlayer` (el escudo absorbe primero), `killPlayer` (tira todo lo que tenía), `checkWinner`.
- `addToInventory`, `spawnItem`, `spawnAround` → [[Loot y rarezas]]
- `handleGame`: un `case` por mensaje de juego (salto, estado, loot, cofres, recarga, disparo, pico, construcción, consumibles, caída).
- `explode` (lanzacohetes, daño en área; el que dispara recibe la mitad; también daña las piezas del mapa dentro del radio) y `damageStruct` (suma daño y compara con `vidaDe`) → [[Armas y disparo]], [[Construcción]]
- `derrumbar` (saca las construcciones sin apoyo, también después de romperse una pieza del mapa), `structPublic` y los `case 'build'` / `case 'edit'` → [[Construcción]]. `SF_MATS` (variable de entorno) da materiales al empezar, para probar.
- Punto débil del pico: `puntoGolpe`, `esCritico`, `nuevoDebil`, `avisarDebil` (`player.debil`) → [[Daño visible y punto débil]]
- `distPieza` (distancia a la caja de una pieza) y `damagePieza` (si no se rompe avisa la vida con `pzHp`; si se rompe, rompe la pieza y las que quedan sin apoyo, avisa con `pzRota` y baja el loot y los cofres que estaban encima) → [[Estructuras rompibles]]

## Usa

- [[world.js]] (`World`)
- [[items.js]] (armas, consumibles, munición, materiales, `structKey`, etc.)
- [[construccion.js]] (reglas de la construcción)

## Autos (2026-11-26)

`room.autos` (de [[autos.js]] `nuevoAuto`, uno por `world.autoSpawns`) va en `matchSnapshot`. `player.auto = { a, k }` es el auto y el asiento; con eso el estado del jugador queda en `auto`. Mensajes `subir`, `bajar`, `asiento`, `auto`, `bocina`, `atropello` y `choque` ([[Protocolo de red]]). `avisarAsientos` manda `autoSeats`; `bajarDelAuto` libera el asiento (también al morir o desconectarse; si el que se desconecta simulaba un auto, el auto queda quieto). `danarAuto`: balas, pico (da metal), cohetes y choques; a 0 de vida explota (`autoBoom`): saca a los de adentro y lastima hasta 7 m (`70 × (1 − d/7) + 10`), con la causa `auto`. Ver [[Autos]].

## Bots (2026-11-26)

- `room.bots = { total, dif }` (lo cambia el anfitrión con el mensaje `bots`, va en `roomInfo`) y `room.partida` (cuenta las partidas para que los `setTimeout` viejos no toquen una nueva).
- `agregarBots` / `sacarBots`: entran al empezar la partida (antes de `resetPlayer`) y se van al volver a la sala. `prepararBots` y `actualizarBots` (un `setInterval` de `BOT_MS`) están en [[bots.js]]; `busPos` calcula dónde está el bus (igual que el cliente).
- `send` y `broadcast` saltean a los que no tienen conexión (los bots). `publicPlayer` agrega `bot: true`. `personas(room)`: solo las personas (para el límite de 16, cerrar la sala cuando se van todas y elegir anfitrión).
- `damagePlayer` avisa a los bots que los lastimaron (`alRecibirDanio`) y `killPlayer` al bot que eliminó a alguien (`alMatar`). En `state` se estima la velocidad de cada persona (`velEst`) para la puntería de los bots. `damagePieza` tira las grillas de navegación que tocaba la pieza rota.
- `checkWinner` / `endMatch`: si no queda ninguna persona viva, la partida termina a los 4,5 s con `botsVivos` (salvo con `SF_BOTS_HASTA_EL_FINAL=1`). Ver [[Bots]].
