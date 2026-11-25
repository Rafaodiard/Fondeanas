# colision.js

Volver a [[Inicio]] · lo usa [[world.js]]

Archivo: `public/js/colision.js`. Colisiones del mapa: cajas, rampas y cilindros guardados en una grilla espacial de 8 m. Lo usan el cliente (movimiento del jugador) y el servidor (dónde cae el loot).

- `STEP = 0.55`: escalón que se sube caminando (más alto hay que saltar).
- `class Solidos`: `add`, `addBox(b, kind)`, `addCyl(x, z, r, y0, y1, kind)`, `near(x, z, rad, fn)` (recorre los sólidos cercanos sin repetir), `remove(s)` (saca un sólido de la grilla cuando se rompe su pieza y lo marca `dead`; ver [[Estructuras rompibles]]).
- `Solidos.top(s, x, z)` / `topAt`: altura de la cara de arriba (en rampas depende de `up` y `lo`).
- `ground(x, z, ref)`: piso más alto que no supera `ref + STEP`.
- `ceiling(x, z, feet)`: techo más bajo por encima de la cabeza.
- `push(pos, radius, height)`: empuja la cápsula del jugador fuera de las paredes; si el borde está a la altura de un escalón, lo deja subir.
- `ray(o, d, max)`: rayo contra los sólidos.

Las mallas invisibles con estos mismos sólidos (para disparos y cámara) las arma `buildStructures` en [[world.js]].
