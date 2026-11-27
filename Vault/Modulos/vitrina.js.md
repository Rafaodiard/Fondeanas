# vitrina.js

Volver a [[Inicio]] · sistema: [[Cuentas, tienda y skins (sistema)]]

Archivo: `public/js/vitrina.js` (2026-11-26). El personaje del menú parado en una plataforma, con las skins puestas, y las fotos de las tarjetas.

- Usa su propio canvas (`#vitrina`) y renderer, así no toca la escena del juego. Solo dibuja mientras el menú está a la vista.
- `mostrar(sk, color)`: lo que tenés equipado. `probar(id)`: te pone esa skin para verla (la mochila de espaldas, el planeador abierto, el pico y el envoltorio de cerca). `soltar()`: vuelve a lo equipado. Se gira arrastrando.
- `foto(id)` → promesa con la URL de una foto de 256 px: traje de cuerpo entero, mochila, pico y rifle con el envoltorio solos, planeador abierto. Se sacan de a una por cuadro, a una textura aparte con el mismo tono que la pantalla (como [[iconos.js]]), y quedan guardadas.
