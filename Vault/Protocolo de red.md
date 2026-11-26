# Protocolo de red

Volver a [[Inicio]] · [[Arquitectura]]

WebSocket sobre el mismo servidor HTTP de [[server.js]]. Cada mensaje es un JSON con el tipo en el campo `t`.

## Cliente → servidor

Antes de estar en una sala:
- `create` (con `name`): crea una sala y entra como anfitrión.
- `join` (con `code`, `name`): entra a una sala existente. Errores: sala inexistente o llena (máximo 16).

En la sala:
- `start`: solo el anfitrión, en fase `lobby`. Ver [[Salas y partidas]].
- `bots` (`total`: 0, 4, 8, 12, 16, 20 o 24; `dif`: `facil`, `normal` o `dificil`): solo el anfitrión, en fase `lobby`. El servidor contesta a todos con `room`. Ver [[Bots]].
- `chat` (`text`, hasta 120 caracteres).

Durante la partida (los maneja `handleGame` en [[server.js]]):
- `jump`, `state`, `fall` → [[Bus, caída y paracaídas]]. `state` lleva `x`: cuatro enteros de -100 a 100 (caída, giro, freno, deslizando; [[caida.js]] `paramsRed`) que el servidor limita y reenvía en su `state`.
- `pickup`, `drop`, `chest` → [[Loot y rarezas]]
- `reload`, `shoot` → [[Armas y disparo]] (`hits` puede llevar `{ pz, n }`: pieza del mapa y cuántos perdigones le pegaron)
- `swing` → [[Pico y recursos]] (con `pz` si el golpe fue a una pieza del mapa, ver [[Estructuras rompibles]]; a estructuras, árboles y rocas lleva también `at` y `n`, el punto y la normal del golpe, para el punto débil de [[Daño visible y punto débil]])
- `build` (`type`: pared, piso, rampa o techo), `edit` (`key`, `e`, `dir`) → [[Construcción]]
- `useStart`, `useCancel`, `useEnd` → [[Curación y escudo]]
- `marca` (`p`: `[x, y, z]` o `null` para sacarla) → [[Mapa y marcas]]. Solo jugadores vivos; afuera de la isla o con números raros se ignora; hasta 8 seguidas y después una cada 125 ms. El servidor la guarda en `player.marca` (se borra al morir y al empezar otra partida) y la reenvía a los demás.
- Autos → [[Autos]]: `subir` (`a`: número de auto; sube al primer asiento libre), `bajar`, `asiento` (pasa al siguiente asiento libre), `auto` (`a` + estado de [[autos.js]] `estadoRed`: `p` posición, `q` giro/cabeceo/rolido, `v` velocidad, `g` dirección, `f` bits frena / turbo / en el piso; solo lo acepta del que controla ese auto y sin saltos más largos que lo que se puede recorrer a toda velocidad), `bocina`, `atropello` (`pid`: a quién pisó el conductor; el daño lo calcula el servidor con la velocidad que conoce, una vez cada 0,7 s por víctima), `choque` (`a`, `v`: golpe fuerte contra algo; daño `(v − 12) × 9`, una vez cada 0,4 s). `shoot` puede llevar hits `{ auto, n }` y `swing` puede llevar `auto`.

## Servidor → cliente

Los procesa `handle(m)` en [[main.js]]:

`error`, `welcome`, `room`, `matchStart`, `phase`, `forceJump`, `jumped`, `state`, `shot`, `swing`, `boom`, `hitConfirm`, `inv`, `itemsAdd`, `itemsDel`, `chestOpen`, `resHit`, `resGone`, `structAdd`, `structDel` (con `caidas`: las que se cayeron sin apoyo), `structHp` (con `dano`), `structEdit`, `pzRota`, `pzHp` (`ids`, `hp`: vida de piezas del mapa dañadas, a todos), `debil` (solo al que pica: `o`, `p`, `n`, `crit`, `hp`, `max`), `chestMove`, `death`, `matchEnd`, `left`, `chat`, `marca` (`id`, `p`: la marca de otro jugador o `null`; la procesa [[mapaHud.js]]), y los de los autos (los procesa [[manejar.js]]): `auto` (estado de un auto, a todos menos al que lo simula), `autoSeats` (`a`, `seats`, `ctrl`: quién va en cada asiento y quién simula el auto), `autoHp`, `autoBoom` (explotó), `autoNo` (`a`, `por`: lleno, lejos, roto o estado; no se pudo subir), `bocina`, y `empujon` (`v`: al que atropellaron, sale volando con esa velocidad).

- `welcome` lleva `version` (huella del código del servidor) y `viejo` (true si los archivos cambiaron en el disco después de arrancar el servidor). Sin `version` (servidor anterior al 2026-11-26) o con `viejo`, [[main.js]] muestra el cartel de reiniciar el servidor.
- `inv` lleva vida, escudo, slots, munición y materiales del jugador (lo arma `invMsg` en el servidor).
- `matchStart` y `welcome` (si la partida ya empezó) llevan un snapshot de la partida (`matchSnapshot`), con las piezas del mapa ya rotas (`piezas`), las dañadas con su vida (`pzHp`: `[[id, vida], ...]`) y los cofres que bajaron (`cofresMovidos`), los autos (`autos`: posición, vida, si está roto, asientos y color) y las marcas de los vivos (`marcas`: `[[id, [x, y, z]], ...]`).
- `pzRota` (`ids`): piezas del mapa que se rompieron; la primera es la que recibió el golpe y las demás se cayeron por quedar sin apoyo. `chestMove` (`idx`, `y`): un cofre bajó porque se rompió el piso donde estaba.

- `room` lleva `bots` (`{ total, dif }`) y cada jugador de la lista puede traer `bot: true`. Los bots mandan su estado con el mismo `state` que los jugadores (lo arma el servidor, ver [[Bots]]).
- `matchEnd` puede traer `botsVivos`: la partida terminó porque no quedaba ninguna persona viva.
