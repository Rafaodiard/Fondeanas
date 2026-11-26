# Deslizarse

Volver a [[Inicio]] · física en [[caida.js]] · animación en [[rig.js]] · pedido en [[Caída, paracaídas y deslizarse]]

- Tecla de fábrica: **Ctrl izquierdo** (acción `deslizar` de [[controles.js]], se cambia en [[Configuración y controles]]).
- Solo corriendo (más de 6,5 m/s), en el piso y sin nadar. Al empezar sale con 1,3 veces la velocidad (mínimo 11 m/s).
- Se mantiene mientras la tecla siga apretada (como mínimo 0,35 s). En el plano frena con el roce y se levanta solo a los ~2 s (~16 m); en bajada acelera hasta 17 m/s y sigue; en subida frena antes. Mantener la tecla apretada mientras se corre también lo arranca.
- Dobla hacia donde se aprieta (hasta 1,5 rad/s). Saltar en medio conserva la velocidad. Si se queda en el aire más de 0,3 s, termina.
- El cuerpo mira hacia donde se desliza (salvo apuntando o tirando) y la cámara baja a 1,18 m. Suena un roce que sigue la velocidad.
- Animación: clip `Deslizar` (pierna izquierda estirada adelante, la derecha doblada abajo). Con un arma en la mano el torso sigue con la pose del arma.
- Como Ctrl+W cierra la pestaña del navegador, en partida `beforeunload` pide confirmación antes de salir ([[main.js]]).
