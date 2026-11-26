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
| `heroe_importar.py` | Trae el héroe desde `public/models/personaje.glb` (pasado antes por `gltf-transform copy` para sacarle meshopt) con los nombres `Esqueleto` y `HeroeJuego`, sin el `.blend` original. Rehacer `Caida` y `Salto` con `heroe_clips.py` da las mismas pistas que el GLB (diferencia máxima 0,6 mm). |
| `heroe_caida.py` | Clips `CaidaPlaneo`, `CaidaPicada`, `Abrir`, `Paracaidas`, `ParacaidasIzq`, `ParacaidasDer`, `ParacaidasFreno`, `Aterrizaje` y `Deslizar`; `mezcla(a, b, t)` (pose intermedia hueso por hueso), `arnes()` (de dónde cuelga el paracaídas) y `exportar_caida(ruta)` → `animaciones_caida.glb`. Requiere `heroe_anim.py` y `heroe_clips.py`. |
| `paracaidas.py` | Paracaídas: una función de geometría (`geometria(par)`) evaluada con distintos parámetros da la malla base y las formas `Plegado`, `FrenoL`, `FrenoR` con la misma topología. `hacer_paracaidas()`, `exportar_paracaidas(ruta)`. |
| `heroe_reemplazar_clips.mjs` | (Node) Cambia algunos clips de `personaje.glb` por los de otro GLB sin tocar la malla, la piel, las texturas ni el resto de los clips; engancha los canales por nombre de hueso e imprime cuánto cambió cada clip. Así se reexportaron solo `Trote`, `Correr` y `Sprint` (pasos en el archivo). Rehacer un clip sin cambios da menos de 1° de diferencia. |
| `brazos_choque.py` | Control de calidad sin render: cuánto se meten los brazos y las manos en el resto del cuerpo, cuadro por cuadro. Deforma la malla por código (skinning de 4 pesos como three.js); un vértice del brazo está adentro si los rayos en los 6 ejes chocan primero con la cara de atrás del cuerpo. Arma las mismas mezclas que [[rig.js]] (piernas de la locomoción, torso del arma, brazo izquierdo libre con pico u objeto) y dobla la columna en todo el recorrido de la mira, no solo en los topes. `control_brazos()` imprime una línea por clip y combinación (derecho, abajo y arriba) y devuelve las que pasan `LIMITE` (1,5 cm). La axila apretada da 0,6-1 cm siempre; no se ve. Requiere `heroe_clips.py` y `heroe_recargas.py`. |

Para el juego, los GLB nuevos se comprimen con `gltf-transform meshopt`.

Las recargas y el bombeo del héroe salen de [[Pipeline de armas]] (`heroe_recargas.py`).

Detalles de los clips que evitan que los brazos atraviesen el cuerpo (2026-11-25):
- Quieto y pico en la mano: los brazos sueltos (`brazos_sueltos`, tabla `SUELTOS`) cuelgan un poco adelante, así la mano derecha no entra en la funda del muslo.
- Trote, carrera y sprint: `arco` (3) hace que el puño cruce hacia el centro recién al final del vaivén, rodeando los cargadores del chaleco.
- Trote, carrera y sprint (2026-11-26): atrás la mano queda **al costado de la cadera**, no detrás de la cola. `brazo_atras` va más afuera (x 0,07 / 0,11 / 0,13; el centro del puño termina a 25-28 cm del centro del cuerpo, donde la cadera mide 20 cm de medio ancho) y `giro_antebrazo` (-45°) gira el antebrazo, y la mano la mitad, cuanto más atrás va el brazo: se ve el dorso del guante y el pulgar ya no apunta a la cola ni al cinturón. Adelante el puño cruza un poco menos (`brazo_adelante` x -0,04 / -0,05 / -0,06). Antes el puño quedaba a 8-10 cm del centro, por detrás de la cola, y con la cámara del juego (de atrás) parecía meterse en el cinturón aunque `brazos_choque.py` no lo midiera adentro.
- Pico: el agarre de reposo (`GOLPE` claves 0 y 15 y `pose_sostener_pico`) va más alto y adelante, y la mano izquierda más afuera.
