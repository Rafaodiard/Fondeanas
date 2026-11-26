# Caída, paracaídas y deslizarse

Volver a [[Índice de memoria]] · resultado en [[Bus, caída y paracaídas]], [[Deslizarse]] y [[caida.js]]

**2026-11-25 · Rafael**

Pidió (entre varias tareas en paralelo): "hacé animaciones para cuando caés, y que tengas más libertad en la caída libre (sin el paracaídas todavía), que te puedas mover más y llegar más lejos cayendo más lento o caer más rápido pero sin poder moverte tanto. También modelá el paracaídas y que te puedas mover un poco más cuando ya lo abriste y que lo puedas volver a cerrar, pero con una altura límite: una vez que la pasás se abre solo y no lo podés volver a cerrar." Y "que te puedas deslizar".

**2026-11-25 · Claude (al hacer ese pedido)**

- El planeador se reemplazó por un paracaídas de verdad (vela de cajones), modelado con `tools/blender/paracaidas.py`. `planeador.glb` se borró.
- Altura límite: 80 m sobre el piso (o el agua). Arriba se abre y se cierra con la tecla de saltar; abajo se abre solo y queda bloqueado.
- Deslizarse: Ctrl izquierdo de fábrica (como en el género), cambiable en la configuración. Como Ctrl+W cierra la pestaña, en partida el navegador pide confirmación antes de salir.
- Las animaciones nuevas salen de `heroe_caida.py`, sobre el esqueleto importado del GLB del juego (`heroe_importar.py`).

**2026-11-25 18:25 (hora de Buenos Aires) · Rafael**

"Mergeamos sin el grafo y después lo generamos en mi pc cuando todo haya terminado." Ver [[Graphify de la PC de Rafael]].
