# Bus, caída y planeador

Volver a [[Inicio]]

## Servidor ([[server.js]])

- `startMatch` elige un ángulo al azar y arma una recta que cruza la isla a altura `BUS_HEIGHT = 260`, desplazada un poco del centro. El bus arranca 3 s después y tarda `BUS_DURATION = 22` s.
- `jump` solo se acepta en fase `playing` y si el jugador sigue en el bus. Al terminar el recorrido, el tick obliga a saltar a los que quedan (`forceJump`).
- Estados del jugador: `bus` → `falling` → `glider` → `ground`.

## Cliente ([[main.js]])

- Caída libre (`FREEFALL_V = 42`, `FREEFALL_H = 20`) y planeador (`GLIDER_V = 8`, `GLIDER_H = 17`). Si el jugador está a menos de `AUTO_GLIDER = 70` del piso, el planeador se abre solo.
- El planeador es `planeador.glb` con la tela teñida del color del jugador ([[models.js]]); [[rig.js]] lo ubica en las manos (`placeGlider`).
- **Daño por caída**: si al tocar el piso la velocidad vertical mínima fue menor a -20, el cliente manda `fall` con `(-vy - 20) * 5` de daño (no aplica en el agua). El servidor lo limita a 100.
- El bus es `bus.glb` ([[Modelos GLB]]).
