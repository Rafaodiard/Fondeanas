# Bus, caída y paracaídas

Volver a [[Inicio]] · física en [[caida.js]] · animación en [[rig.js]] · pedido en [[Caída, paracaídas y deslizarse]]

## Servidor ([[server.js]])

- `startMatch` elige un ángulo al azar y arma una recta que cruza la isla a altura `BUS_HEIGHT = 260`, desplazada un poco del centro. El bus arranca 3 s después y tarda `BUS_DURATION = 22` s.
- `jump` solo se acepta en fase `playing` y si el jugador sigue en el bus. Al terminar el recorrido, el tick obliga a saltar a los que quedan (`forceJump`).
- Estados del jugador: `bus` → `falling` (caída libre) ⇄ `glider` (paracaídas abierto) → `ground`. El estado se sigue llamando `glider` en la red aunque ahora sea un paracaídas.
- El mensaje `state` lleva además `x`: cuatro enteros de -100 a 100 (caída, giro, freno, deslizando) que el servidor limita y reenvía, para que los demás vean la misma pose. Ver [[Protocolo de red]].

## Caída libre ([[caida.js]], `CAIDA`)

- Se mezcla de forma continua entre **planeo** (cae a 24 m/s y avanza hasta 31 m/s) y **picada** (cae a 72 m/s y avanza hasta 8 m/s); en el medio, la caída normal (40 / 20). `controlCaida(pitch, adelante)`: mirando abajo es picada; yendo adelante con la mirada al horizonte es planeo.
- Desde el bus (257 m) hasta el paracaídas automático: picada 3,2 s y ~24 m de avance, planeo 7,5 s y ~200 m (`tools/caida/pruebas.mjs`).
- Los costados y atrás rinden el 70 % (`LADO`). El giro (teclado + lo que gira la cámara) va a la animación: el cuerpo se ladea hacia la curva.

## Paracaídas (`PARACAIDAS`)

- La tecla de saltar lo abre (si estás a más de `MIN = 12` m) y lo cierra.
- `LIMITE = 80` m sobre el piso: si se baja de ahí cayendo, se abre solo; y si estaba abierto y baja de ahí, queda bloqueado (`paraBloq`): ya no se puede cerrar, aunque el piso vuelva a quedar lejos (una barranca).
- Abierto: sin teclas avanza a 9 m/s y cae a 7,5; con adelante 21 m/s y cae a 10,5; con atrás frena (3 m/s, cae a 4,8); con los costados se mueve de lado a 10 m/s. Antes, el planeador iba a 17 m/s como máximo.
- El paracaídas es `paracaidas.glb` ([[Modelos GLB]], hecho con `tools/blender/paracaidas.py`): vela de cajones con la tela teñida del color del jugador. Se abre con la forma `Plegado` (sale arrugado y chico y se infla con un rebote) y los frenos bajan el borde de fuga de cada lado (`FrenoL`, `FrenoR`). Las cuerdas de los frenos se dibujan cada cuadro hasta las manos. [[rig.js]] lo cuelga de los hombros (`ARNES`).
- Al cerrarlo se achica en 0,3 s y el cuerpo vuelve a la caída libre.

## Daño por caída

Si al tocar el piso la velocidad vertical mínima fue menor a -20, el cliente manda `fall` con `(-vy - 20) * 5` de daño (no aplica en el agua). El servidor lo limita a 100. Con el paracaídas abierto no pasa (cae a 10,5 m/s como mucho).

## Bus

- El bus es `bus.glb` ([[Modelos GLB]], hecho con [[Pipeline del bus]]). `createBus()` de [[models.js]] guarda las hélices (`Helice_I`, `Helice_D`) en `userData.props` y `updateBus` las hace girar sobre su Z local; también le da a los materiales del bus un cielo de reflejo propio y hace destellar la baliza del techo y la luz blanca de la cola.
- El centro del modelo está a media altura de la carrocería; las ruedas llegan a 2,3 m por debajo, así que el salto (`bus.position.y - 3`) sale apenas debajo de las ruedas.
