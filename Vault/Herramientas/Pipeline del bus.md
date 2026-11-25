# Pipeline del bus

Volver a [[Inicio]] · resultado: `bus.glb` ([[Modelos GLB]]) · en el juego: [[models.js]], [[Bus, caída y planeador]] · pedido: [[Pedido del bus]]

Script de Blender `tools/blender/bus.py` (diseño propio). Usa las herramientas de `armas_base.py` ([[Pipeline de armas]]): `prisma`, `caja`, `torno`, `tubo`, `acabado` (bisel + normales ponderadas) y `finalizar`.

## Cómo se corre

En Blender 5.x (o `bpy` como módulo, ver [[Blender en la nube]]):

1. `exec` de `armas_base.py` y de `bus.py`.
2. `A = armar_bus()` arma todas las piezas.
3. `exportar_bus(A, 'bus_crudo.glb')` une todo en `Carroceria` + una malla por hélice, baja el bus `BAJAR` (2,3 m) para que el centro quede en el origen y exporta.
4. `gltf-transform meshopt bus_crudo.glb public/models/bus.glb` comprime la malla (el `bpy` de pip no trae meshopt).
5. `fotos_bus(carpeta, ['tres4', 'atras', 'lado', 'arriba', 'frente', 'rueda', 'techo'])` saca fotos de revisión en Cycles con cielo y sol.

## Cómo está hecho

- **Carrocería**: una caja reticulada con un corte en cada borde de ventana, puerta, franja y cartel. Cada cara recibe su material y su zona según dónde estaba en la caja; después la caja se redondea (aristas elípticas: lados, techo, frente y cola con radios distintos), se deforma (costados que se cierran hacia el techo, parabrisas inclinado, techo abombado) y cada zona se hunde con `inset_region` (ventanas con burlete, puerta con marco cromado, cartel, rejilla del motor). Los pasaruedas son un booleano con cilindros.
- **Pintura**: faldón gris oscuro, panel verde azulado con "SALTO FINAL" en letras crema, franja amarilla con filete cromado y la mitad de arriba crema con techo blanco.
- **Frente**: parabrisas partido con limpiaparabrisas, cartel de destino iluminado, faros dobles con aro cromado, parrilla, emblema "SF", luces de giro y de gálibo, paragolpes envolvente, patente y espejos de "orejas de conejo". **Cola**: luneta, luces traseras, rejilla del motor, escalera al techo, escape, paragolpes, patente y letras.
- **Techo**: pilón carenado del ala, baliza roja, escotilla y portaequipajes con valijas, cajón, bolso, lona atada y rueda de auxilio.
- **Ala alta** (perfil NACA, diedro, puntas redondeadas, alerones y flaps en otro tono, luces de navegación roja y verde) sobre el pilón y cuatro montantes; **dos góndolas** con aro cromado, franja y escapes; **hélices** de cuatro palas con torsión y puntas amarillas.
- **Cola en cruz**: deriva con timón y "SF", estabilizador y derivas en las puntas, luz blanca arriba.
- **Ruedas**: neumático con tacos, llanta pintada, taza cromada, tuercas y ribete en el pasaruedas.

## Para el juego

- Frente a +Y en Blender (−Z en glTF), como el resto de los modelos. Unos 72.000 triángulos (la mitad son la carrocería con sus biseles, los neumáticos y las letras), ~400 KB con meshopt. Las sombras del bus están apagadas: vuela muy por encima del área de sombras del sol.
- Las hélices se arman en el origen y quedan con el pivote en el buje, sin giro: su Z local en glTF es el eje de vuelo.
- Materiales con nombre propio (`Pintura`, `Crema`, `Franja`, `Cromo`, `Vidrio`, `Baliza`, `Destello`...). Ninguno se tiñe; `Baliza` y `Destello` los hace destellar [[models.js]].
