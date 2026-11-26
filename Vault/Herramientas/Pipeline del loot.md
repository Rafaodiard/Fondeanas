# Pipeline del loot

Volver a [[Inicio]] · resultado: `cofre.glb` y `objetos.glb` ([[Modelos GLB]]) · en el juego: [[loot.js]]

Scripts de Blender en `tools/blender/`. Diseños propios. Usan las herramientas de [[Pipeline de armas]] (`armas_base.py` para modelar, `armas_horneado.py` para hornear), así que se ejecutan después de esos dos en el mismo espacio de nombres.

| Script | Qué hace |
|---|---|
| `loot_modelos.py` | Suma a la paleta los materiales del loot (maderas del cofre, dorado, hierro, plástico, venda, pino, piedra, lingote, cajas de munición...) con su desgaste y veta. `cofre()`: cajón de tablas horizontales, zócalo y patas, esquineros, flejes y bordes dorados con remaches, cerradura con bocallave, manijas de hierro, bisagras y una tapa curva de cinco tablas con marcos, flejes, labios y aldaba (pieza móvil `tapa`, pivote en la bisagra). `objetos()`: cada objeto en su lugar sobre X para hornearlos juntos, como pieza propia con el pivote en su centro. Ajusta la oclusión y el bisel del horneado a la escala (el de las armas está calibrado para centímetros). |
| `loot_export.py` | `exportar_loot(nombre, ruta)`: deja cada pieza como un vacío con su nombre en el pivote y la malla como hija (`<nombre>_malla`) y exporta el GLB con texturas WebP. |

Materiales que no se hornean: `Tinte` (lo pinta el juego), `Vidrio`, `Escudo` (líquido que brilla) y `BrilloCofre`.

## Cómo se rehace

1. Con bpy (Blender 5.2 como módulo, ver [[Blender en la nube]]): ejecutar `armas_base.py`, `armas_horneado.py`, `loot_modelos.py` y `loot_export.py`.
2. `cofre()` + `hornear('cofre', res=1024)` y `objetos()` + `hornear('objetos', res=2048)`, con `_HORNEO_ESCALA` en `ao=0.07, bev=0.004` para el cofre y `ao=0.025, bev=0.002` para los objetos.
3. `exportar_loot('cofre', ...)` y `exportar_loot('objetos', ...)`; después comprimir con `npx @gltf-transform/cli meshopt` (bpy no trae meshopt).

Por qué el vacío en el pivote: al comprimir, gltf-transform cuantiza las posiciones y mete escala y corrimiento en el nodo de la malla. Si la malla fuera el nodo del pivote, la tapa del cofre dejaría de girar sobre la bisagra y los objetos no quedarían centrados.

Resultado (2026-11-26): cofre 23 mil triángulos, 466 KB; los doce objetos 1,2 MB (casi todo textura).
