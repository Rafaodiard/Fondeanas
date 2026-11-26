# Pipeline del auto

Volver a [[Inicio]] · resultado: `auto.glb` ([[Modelos GLB]]) · en el juego: [[models.js]] (`createAuto`), [[Autos]] · pedido: [[Autos funcionales]]

Script de Blender `tools/blender/auto.py` (diseño propio: hatchback de tres puertas, cuatro asientos). Usa `armas_base.py` ([[Pipeline de armas]]) y `bus.py` ([[Pipeline del bus]]).

## Cómo se corre

En Blender 5.x (o `bpy` como módulo, ver [[Blender en la nube]]):

1. `exec` de `armas_base.py`, `bus.py` y `auto.py`.
2. `A = armar_auto()` arma todas las piezas.
3. `exportar_auto(A, 'auto_crudo.glb')` lleva ruedas y volante a su lugar, une todo en `Carroceria` + `Rueda_DI`, `Rueda_DD`, `Rueda_TI`, `Rueda_TD` y `Volante` bajo `Auto`, y exporta solo la escena activa.
4. `gltf-transform meshopt auto_crudo.glb public/models/auto.glb` (unos 300 KB).
5. `fotos_auto(carpeta, ['tres4', 'atras', 'lado', 'arriba', 'frente', 'rueda', 'cabina', 'juego'])` saca fotos de revisión en Cycles.

## Cómo está hecho

- **Carrocería**: una superficie paramétrica (`punto_seccion(y, s, lado)`): para cada largo `y`, una sección que recorre piso, costado, hombro, ventanillas y techo con perfiles suaves (`pchip`) de techo, cintura, piso y ancho, y puntas redondeadas. Las zonas hundidas (ventanillas, parabrisas, luneta, faros, portón, juntas de las puertas) se hunden sobre la misma superficie, sin operaciones de malla que rompan la topología; el marco de cada zona lleva su material. Los pasaruedas son booleanos con cilindros.
- **Ruedas**: neumático con tacos y letras en el flanco, llanta de seis rayos, tazón, tuercas y disco de freno.
- **Frente y cola**: faros con lente y reflector, parrilla, emblema, patente "SF 24", paragolpes, luces traseras (`LuzTrasera`, se encienden al frenar), alerón, difusor y escape doble.
- **Costados**: manijas, espejos, repetidores de giro, molduras de los pasaruedas, tapa de nafta, limpiaparabrisas y antena.
- **Interior**: piso, tablero, consola, cuatro asientos tapizados con cabecera y volante.

## Para el juego

- Frente a +Y en Blender (−Z en glTF). Suela de las ruedas en y = 0.
- Ruedas con el pivote en el buje (giran sobre X; las de adelante doblan sobre Y). El volante tiene su inclinación en el nodo (rotación X de −24°): gira sobre su Z local.
- Material `Pintura` es el que se tiñe con el color de cada auto ([[assets.js]] `cloneAsset`). `Vidrio` se hace transparente en [[models.js]].
- Las medidas que usa la física están copiadas en `AUTO`, `ASIENTOS` y `RUEDAS` de [[autos.js]]: si cambia el modelo, actualizarlas.
