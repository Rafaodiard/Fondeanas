# visor.html

Volver a [[Inicio]]

Archivo: `public/visor.html`. Visor del personaje para revisar sus estados y animaciones fuera de la partida (se abre en `/visor.html` con el servidor levantado).

- Usa `OrbitControls` para girar la cámara, y [[rig.js]], [[assets.js]], [[models.js]] e [[items.js]] igual que el juego.
- Estados: en el piso, saltando, caída libre, paracaídas (se abre desde la caída, así se ve el tirón), aterrizar, deslizarse y baile.
- Estado editable `S` (estado, velocidad, qué tiene en la mano, si apunta, pitch, `caida` de planeo a picada, `giro` y `freno` del paracaídas...).
- Botones para golpear, recargar y disparar.
- Expone `window.VISOR` (`S`, el personaje, `THREE`, escena, cámara, renderer, controles, `golpe`, `recargar`, `disparar`) para manejarlo desde scripts (por ejemplo Playwright).
