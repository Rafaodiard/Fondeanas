# mapa.html

Volver a [[Inicio]]

Archivo: `public/mapa.html`. Visor del mapa para recorrer la isla sin jugar (se abre en `/mapa.html` con el servidor levantado).

- Usa `OrbitControls`: arrastrar gira, la rueda acerca, WASD mueve y Q/E bajan y suben. El selector "Ir a…" lleva a cada pueblo.
- Arma el mismo `World` que el juego ([[world.js]]) con los GLB de [[assets.js]] y los cofres de [[loot.js]] (con `luzLoot` para los reflejos del dorado).
- Expone `window.MAPA` (`world`, `camera`, `controls`, `scene`, `renderer`, `goTo(id)`, `view(...)`, `eye(x, z, rumbo, alto, inclinación)` para vistas a la altura de los ojos, `poi(id)`, `minimap()`) para sacar capturas con scripts (por ejemplo Playwright).

Muestra también los autos estacionados en sus lugares de salida (`createAuto` de [[models.js]]; en el juego se manejan, ver [[Autos]]).
