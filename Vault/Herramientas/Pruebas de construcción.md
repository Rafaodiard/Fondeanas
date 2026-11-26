# Pruebas de construcción

Volver a [[Inicio]] · prueba [[construccion.js]], [[construccion3d.js]] y la física de [[world.js]] · sistema: [[Construcción]]

Archivo: `tools/construccion/pruebas.mjs`. Se corre con `node tools/construccion/pruebas.mjs` (sin navegador) y termina con `todo OK`. Busca un lugar plano y libre de la isla y revisa:

- Ediciones válidas por tipo.
- Pared con puerta: se pasa por el hueco, choca arriba y a los costados, y las columnas iguales se juntan en una caja.
- Piso con un cuarto sacado, rampa (dirección y carriles), techo (punta, esquinas y techo plano).
- `resultadoEdicion` de la rampa y `rayoEdicion`.
- Apoyo (en el piso, en el aire, pegada a otra pieza) y derrumbe al romper la base.
- Caminando se suben dos rampas seguidas; la pared frena y con la puerta editada se pasa; un piso de construcción frena la cabeza al saltar.
- Vida que crece y daño.
- Lo que se ve coincide con lo que se pisa: rayos contra la malla de [[construccion3d.js]] y `superficie` en rampas, techos y pisos editados en las 4 direcciones.

Correrla después de tocar [[construccion.js]], [[construccion3d.js]] o la física de [[world.js]]. También conviene correr [[Pruebas del mapa]].
