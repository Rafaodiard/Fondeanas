# caida.js

Volver a [[Inicio]] · [[Arquitectura]] · sistemas: [[Bus, caída y paracaídas]] · [[Deslizarse]]

Archivo: `public/js/caida.js`. Física del jugador propio en la caída libre, con el paracaídas y al deslizarse, y los parámetros de animación que viajan por la red. Lo usa [[main.js]] desde `updateMe`; no toca la escena.

## Constantes

- `CAIDA`: `V` (caída: planeo 24, normal 40, picada 72 m/s), `H` (avance: 31, 20, 8 m/s), `LADO` (0,7), `RESP_V`, `RESP_H`, `CAMBIO`.
- `PARACAIDAS`: `LIMITE` (80 m), `MIN` (12 m), velocidades con y sin teclas (`V`, `V_ADELANTE`, `V_FRENO`, `H`, `H_ADELANTE`, `H_FRENO`, `H_LADO`).
- `DESLIZ`: `MIN_VEL` (6,5 m/s, hay que venir corriendo), `IMPULSO` / `MIN_IMPULSO`, `MAX` (17), `ROCE`, `PENDIENTE`, `FIN`, `MIN_T`, `GIRO`, `ALTO_CAMARA`.

## Funciones

- `estadoCaida()`: los campos que se suman a `me` (`caida`, `giro`, `freno`, `paraBloq`, `desliz`, `yawPrev`).
- `controlCaida(pitch, adelante)`: -1 planeo … 0 normal … +1 picada.
- `fisicaAire(me, ent, dt, altura)`: caída libre y paracaídas; abre solo debajo de `LIMITE` (devuelve `'abrir'`) y bloquea el cierre.
- `abrirParacaidas`, `puedeCerrar`, `cerrarParacaidas`.
- `puedeDeslizar`, `empezarDeslizar`, `fisicaDeslizar(me, dt, pendiente, dir, sigue)`, `terminarDeslizar`.
- `paramsRed(me)` / `leerParams(x)`: los cuatro enteros del campo `x` del mensaje `state` ([[Protocolo de red]]).

## Pruebas

`node tools/caida/pruebas.mjs` simula sin navegador: planeo vs. picada (tiempo y distancia), apertura automática a 80 m, que no se pueda cerrar después, velocidades del paracaídas, deslizarse en plano, bajada y subida, y los parámetros de red.
