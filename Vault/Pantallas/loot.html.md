# loot.html

Volver a [[Inicio]]

Archivo: `public/loot.html`. Vitrina del loot (se abre en `/loot.html` con el servidor levantado): tres cofres, las seis armas en las cinco rarezas y todos los objetos del piso, con los mismos efectos de la partida ([[loot.js]]).

- Botones "Abrir cofres" y "Cofres nuevos". Arrastrar gira y la rueda acerca (`OrbitControls`).
- Expone `window.LOOT` para capturas con scripts: `view(...)`, `abrir()`, `ponerCofres()`, `soltar(i)` (abre el cofre `i` y suelta loot alrededor, que sale volando del cofre), `animar()` (corre `animarLoot` una vez, para probar sin esperar cuadros), `items`, `cofres`.
