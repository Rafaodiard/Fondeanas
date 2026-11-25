# Pipeline del héroe

Volver a [[Inicio]] · resultado: `personaje.glb` ([[Modelos GLB]]) · en el juego: [[rig.js]]

Scripts de Blender en `tools/blender/`, que se ejecutan en Blender (5.x) en el mismo espacio de nombres. Casi todos requieren [[sf_tools.py]] cargado antes (`builtins.SF`).

| Script | Qué hace |
|---|---|
| `heroe_ropa.py` | Ropa generada sobre la malla base `Cuerpo` de `heroe.blend` (chaleco, etc.). Cada función rehace su prenda desde cero. |
| `heroe_cabeza.py` | Pelo (undercut con jopo), bufanda y antiparras. |
| `heroe_materiales.py` | Materiales procedurales para hornear a la textura del juego. Usa las imágenes de [[Texturas]]. |
| `heroe_juego.py` | Malla del juego: copias livianas de cada pieza, atlas UV común (2048), horneado desde la alta (color, normal, rugosidad, AO) y unión. |
| `heroe_rig.py` | Esqueleto `Esqueleto` y pesos de la malla `HeroeJuego`. |
| `heroe_anim.py` | Base de animación por código: poses en espacio del personaje, IK analítica de dos huesos, `Pose`, `grabar`. 30 fps. |
| `heroe_clips.py` | Clips: locomoción con pies plantados (`MARCHAS`: Caminar, Trote, Correr, Sprint), aire, pico, poses de armas (`ARMAS`: Rifle, RifleApunta, Pistola, PistolaApunta, Lanzacohetes...) y baile. Requiere `heroe_anim.py`. |
| `heroe_export.py` | Exporta malla con piel, esqueleto (con el hueso `Arma.R`), todas las acciones y texturas WebP (`imagenes='AUTO'` deja las texturas como están, para reexportar un personaje importado sin recomprimirlas). Sube el esqueleto 0,032 para que la suela quede en y = 0. Requiere `heroe_anim.py` y `heroe_clips.py`. |
| `brazos_choque.py` | Control de calidad sin render: cuánto se meten los brazos y las manos en el resto del cuerpo, cuadro por cuadro. Deforma la malla por código (skinning de 4 pesos como three.js); un vértice del brazo está adentro si los rayos en los 6 ejes chocan primero con la cara de atrás del cuerpo. Arma las mismas mezclas que [[rig.js]] (piernas de la locomoción, torso del arma, brazo izquierdo libre con pico u objeto) y dobla la columna en todo el recorrido de la mira, no solo en los topes. `control_brazos()` imprime una línea por clip y combinación (derecho, abajo y arriba) y devuelve las que pasan `LIMITE` (1,5 cm). La axila apretada da 0,6-1 cm siempre; no se ve. Requiere `heroe_clips.py` y `heroe_recargas.py`. |

Las recargas y el bombeo del héroe salen de [[Pipeline de armas]] (`heroe_recargas.py`).

Detalles de los clips que evitan que los brazos atraviesen el cuerpo (2026-11-25):
- Quieto y pico en la mano: los brazos sueltos (`brazos_sueltos`, tabla `SUELTOS`) cuelgan un poco adelante, así la mano derecha no entra en la funda del muslo.
- Trote, carrera y sprint: `arco` (3) hace que el puño cruce hacia el centro recién al final del vaivén, rodeando los cargadores del chaleco.
- Pico: el agarre de reposo (`GOLPE` claves 0 y 15 y `pose_sostener_pico`) va más alto y adelante, y la mano izquierda más afuera.
