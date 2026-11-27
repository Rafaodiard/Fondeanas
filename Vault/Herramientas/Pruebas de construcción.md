# Pruebas de construcción

Volver a [[Inicio]] · prueba [[construccion.js]], [[construccion3d.js]] y la física de [[world.js]] · sistema: [[Construcción]]

Archivo: `tools/construccion/pruebas.mjs`. Se corre con `node tools/construccion/pruebas.mjs` (sin navegador) y termina con `todo OK`. Busca un lugar plano y libre de la isla y revisa:

- Ediciones válidas por tipo.
- Pared con puerta: se pasa por el hueco, choca arriba y a los costados, y las columnas iguales se juntan en una caja.
- Piso con un cuarto sacado, rampa (dirección y carriles), techo (punta, esquinas y techo plano).
- `resultadoEdicion` de la rampa y `rayoEdicion`.
- Apoyo (en el piso, en el aire, pegada a otra pieza) y derrumbe al romper la base.
- Grilla de encastre: piso solo en el borde de arriba de una pared (nunca a 0,5–3,5 m de su base), piso y rampa siguiente en el borde alto de una rampa, techo arriba de un piso o de una pared y no en la celda de una rampa, paredes apiladas y de costado, tocar una punta no sostiene, derrumbe de borde en borde, `nivelGrilla` y que la vista previa (`objetivoPieza`), en las 4 direcciones y con cualquier inclinación de la mira, siempre cae en la misma grilla que lo construido.
- Caminando se suben dos rampas seguidas; la pared frena y con la puerta editada se pasa; un piso de construcción frena la cabeza al saltar.
- Vida que crece y daño.
- Lo que se ve coincide con lo que se pisa: rayos contra la malla de [[construccion3d.js]] y `superficie` en rampas, techos y pisos editados en las 4 direcciones.

`tools/construccion/red.mjs` levanta `server.js` en otro puerto (con `SF_MATS=500`), arma una partida y manda piezas por WebSocket: el servidor acepta las que encajan y rechaza el piso a media pared, el piso corrido, el flotante, el techo en la celda de una rampa y la pared colgada de una punta. Termina con `todo OK`.

`tools/construccion/capturas.mjs` (Playwright + swiftshader, `CAPTURAS=carpeta`, `SOLO=nombre` para una sola) arma una construcción en el juego de verdad y saca `encastre_encaja.png`, `encastre_no_encaja.png` y `encastre_piso_rampa.png` (están en `docs/`).

Correrlas después de tocar [[construccion.js]], [[construccion3d.js]] o la física de [[world.js]]. También conviene correr [[Pruebas del mapa]].
