# Pipeline de skins

Volver a [[Inicio]] · [[Modelos GLB]] · sistema: [[Cuentas, tienda y skins (sistema)]]

Cómo se hacen las skins (2026-11-26). Una skin no es otro personaje: es el héroe de siempre ([[Pipeline del héroe]], mismo esqueleto y hitbox) con otros colores, patrones y efectos ([[aspecto.js]]) y accesorios modelados que se cuelgan de sus huesos.

## Accesorios: `public/models/skins.glb`

- Scripts: `tools/blender/skins_base.py` (ayudas de modelado con bmesh: esferas, cajas con bisel, tornos, tubos, placas, conos, cuernos, orejas; paleta de materiales `A`, `B`, `C`, `D`, `Ojo`, `Luz` emisivo, `Metal`, `Vidrio`; armado y export) y `tools/blender/skins.py` (cada accesorio con `@acc('id')` y cada pico con `@pico('id')`).
- Correr: `cd tools/blender && python3 skins_export.py` (con `bpy` de pip) y comprimir con `npx gltf-transform meshopt skins_raw.glb ../../public/models/skins.glb`.
- Nombres: `acc_<id>` (cabeza, espalda, cola) o `acc_<id>_L` / `acc_<id>_R` (hombreras), `acc_mochila_<modelo>` y `pico_<id>`. El hueso lo elige `huesoDe` de [[aspecto.js]] por el nombre: `_L`/`_R` → brazos, `acc_cola_` → cadera, `acc_mochila_` y `cuello_vampiro` → columna, el resto → cabeza.
- Se modelan en el espacio de la escena del héroe (Z arriba, el héroe mira a -Y): cabeza centrada en (0, -0.05, 1.77), espalda en y ≈ +0.16. En el juego se cuelgan del hueso con la inversa de su pose de reposo, así quedan donde se modelaron y siguen la animación.
- Los colores no van en el GLB: cada skin pinta los materiales por nombre (`acc: { cab_lobo: { A, B, C, Ojo } }` en [[skins.js]]).
- Cabezas enteras (`cab_*`): el juego esconde la cabeza del héroe por encima del mentón; los sombreros esconden las antiparras.

## Revisar

- [[skins.html]]: todas las skins como en el juego.
- `node tools/skins/pruebas.mjs` (con `CAPTURAS=carpeta` saca una captura por tipo).
- Para importar los GLB del juego en Blender hay que descomprimirlos antes (`gltf-transform copy`), porque vienen con meshopt.
