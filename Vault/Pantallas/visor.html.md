# visor.html

Volver a [[Inicio]]

Archivo: `public/visor.html`. Visor del personaje para revisar sus estados y animaciones fuera de la partida (se abre en `/visor.html` con el servidor levantado).

- Usa `OrbitControls` para girar la cámara, y [[rig.js]], [[assets.js]], [[models.js]] e [[items.js]] igual que el juego.
- Estado editable `S` (estado, velocidad, qué tiene en la mano, si apunta, pitch...).
- Botones para golpear, recargar y disparar.
- Expone `window.VISOR` (`S`, el personaje, `THREE`, escena, cámara, renderer, controles, `golpe`, `recargar`, `disparar`) para manejarlo desde scripts (por ejemplo Playwright).
