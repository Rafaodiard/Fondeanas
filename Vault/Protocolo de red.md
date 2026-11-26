# Protocolo de red

Volver a [[Inicio]] · [[Arquitectura]]

WebSocket sobre el mismo servidor HTTP de [[server.js]]. Cada mensaje es un JSON con el tipo en el campo `t`.

## Cliente → servidor

Antes de estar en una sala:
- `create` (con `name`): crea una sala y entra como anfitrión.
- `join` (con `code`, `name`): entra a una sala existente. Errores: sala inexistente o llena (máximo 16).

En la sala:
- `start`: solo el anfitrión, en fase `lobby`. Ver [[Salas y partidas]].
- `chat` (`text`, hasta 120 caracteres).

Durante la partida (los maneja `handleGame` en [[server.js]]):
- `jump`, `state`, `fall` → [[Bus, caída y paracaídas]]. `state` lleva `x`: cuatro enteros de -100 a 100 (caída, giro, freno, deslizando; [[caida.js]] `paramsRed`) que el servidor limita y reenvía en su `state`.
- `pickup`, `drop`, `chest` → [[Loot y rarezas]]
- `reload`, `shoot` → [[Armas y disparo]] (`hits` puede llevar `{ pz, n }`: pieza del mapa y cuántos perdigones le pegaron)
- `swing` → [[Pico y recursos]] (con `pz` si el golpe fue a una pieza del mapa, ver [[Estructuras rompibles]])
- `build` → [[Construcción]]
- `useStart`, `useCancel`, `useEnd` → [[Curación y escudo]]

## Servidor → cliente

Los procesa `handle(m)` en [[main.js]]:

`error`, `welcome`, `room`, `matchStart`, `phase`, `forceJump`, `jumped`, `state`, `shot`, `swing`, `boom`, `hitConfirm`, `inv`, `itemsAdd`, `itemsDel`, `chestOpen`, `resHit`, `resGone`, `structAdd`, `structDel`, `structHp`, `pzRota`, `chestMove`, `death`, `matchEnd`, `left`, `chat`.

- `inv` lleva vida, escudo, slots, munición y materiales del jugador (lo arma `invMsg` en el servidor).
- `matchStart` y `welcome` (si la partida ya empezó) llevan un snapshot de la partida (`matchSnapshot`), con las piezas del mapa ya rotas (`piezas`) y los cofres que bajaron (`cofresMovidos`).
- `pzRota` (`ids`): piezas del mapa que se rompieron; la primera es la que recibió el golpe y las demás se cayeron por quedar sin apoyo. `chestMove` (`idx`, `y`): un cofre bajó porque se rompió el piso donde estaba.
