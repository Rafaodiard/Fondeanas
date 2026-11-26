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
- `swing` → [[Pico y recursos]] (con `pz` si el golpe fue a una pieza del mapa, ver [[Estructuras rompibles]])
- `build` (`type`: pared, piso, rampa o techo), `edit` (`key`, `e`, `dir`) → [[Construcción]]
- `useStart`, `useCancel`, `useEnd` → [[Curación y escudo]]
- Autos → [[Autos]]: `subir` (`a`: número de auto; sube al primer asiento libre), `bajar`, `asiento` (pasa al siguiente asiento libre), `auto` (`a` + estado de [[autos.js]] `estadoRed`: `p` posición, `q` giro/cabeceo/rolido, `v` velocidad, `g` dirección, `f` bits frena / turbo / en el piso; solo lo acepta del que controla ese auto y sin saltos más largos que lo que se puede recorrer a toda velocidad), `bocina`, `atropello` (`pid`: a quién pisó el conductor; el daño lo calcula el servidor con la velocidad que conoce, una vez cada 0,7 s por víctima), `choque` (`a`, `v`: golpe fuerte contra algo; daño `(v − 12) × 9`, una vez cada 0,4 s). `shoot` puede llevar hits `{ auto, n }` y `swing` puede llevar `auto`.

## Servidor → cliente

Los procesa `handle(m)` en [[main.js]]:

`error`, `welcome`, `room`, `matchStart`, `phase`, `forceJump`, `jumped`, `state`, `shot`, `swing`, `boom`, `hitConfirm`, `inv`, `itemsAdd`, `itemsDel`, `chestOpen`, `resHit`, `resGone`, `structAdd`, `structDel` (con `caidas`: las que se cayeron sin apoyo), `structHp`, `structEdit`, `pzRota`, `chestMove`, `death`, `matchEnd`, `left`, `chat`, y los de los autos (los procesa [[manejar.js]]): `auto` (estado de un auto, a todos menos al que lo simula), `autoSeats` (`a`, `seats`, `ctrl`: quién va en cada asiento y quién simula el auto), `autoHp`, `autoBoom` (explotó), `bocina`, y `empujon` (`v`: al que atropellaron, sale volando con esa velocidad).

- `inv` lleva vida, escudo, slots, munición y materiales del jugador (lo arma `invMsg` en el servidor).
- `matchStart` y `welcome` (si la partida ya empezó) llevan un snapshot de la partida (`matchSnapshot`), con las piezas del mapa ya rotas (`piezas`) y los cofres que bajaron (`cofresMovidos`), y los autos (`autos`: posición, vida, si está roto, asientos y color).
- `pzRota` (`ids`): piezas del mapa que se rompieron; la primera es la que recibió el golpe y las demás se cayeron por quedar sin apoyo. `chestMove` (`idx`, `y`): un cofre bajó porque se rompió el piso donde estaba.

- `room` lleva `bots` (`{ total, dif }`) y cada jugador de la lista puede traer `bot: true`. Los bots mandan su estado con el mismo `state` que los jugadores (lo arma el servidor, ver [[Bots]]).
- `matchEnd` puede traer `botsVivos`: la partida terminó porque no quedaba ninguna persona viva.
