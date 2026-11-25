# rig.js

Volver a [[Inicio]] · [[Arquitectura]]

Archivo: `public/js/rig.js`. Personaje con esqueleto y animaciones hechas en Blender (`personaje.glb`, ver [[Pipeline del héroe]]).

## Cómo anima

- Tres capas: **piernas** (cadera, columna baja y piernas; regex `PIERNAS`), **torso** (columna alta, brazo derecho y cabeza) y **brazo izquierdo** (regex `BRAZO_L`, del hombro a los dedos). El brazo izquierdo va con el torso, salvo en las poses que llevan el objeto solo en la mano derecha (`MANO_L_LIBRE`: `SostenerPico` y `Objeto`): ahí sale de la locomoción y se balancea al correr.
- Locomoción (`LOCO`): mezcla `Quieto`, `Caminar`, `Trote`, `Correr` y `Sprint` según la velocidad, con la fase sincronizada.
- Arriba se pone la pose del arma (`POSE_ARMA`: `SostenerPico`, `Rifle`, `Pistola`, `Lanzacohetes`, `Objeto`) o su versión al apuntar (`APUNTA`), o el golpe.
- Después del mezclador se dobla la columna para apuntar adonde mira la cámara (`pitch`, de -1,35 a 1,2 rad):
  - **Con arma**: corrige el ángulo del cañón y lo reparte en `Spine`, `Spine1` y `Spine2` (40 / 30 / 30 %). Tiene tope: `CURVA_APUNTA` (-55° a +65°) apuntando y `CURVA_CADERA` (-15° a +20°) con el arma a la cadera. Más allá los antebrazos se hundían en la panza y las manos chocaban con las rodillas al correr.
  - **Recargando**: el 40 % del `pitch`, repartido en toda la columna como con arma (40 / 30 / 30 %) y con el tope de `CURVA_CADERA`. El resto lo hacen el cuello y la cabeza.
  - **Sin arma** (locomoción, pico, objeto, golpe): `Spine1` 18 %, `Spine2` 22 %, cuello 20 % y cabeza 30 % del `pitch`. Mirando abajo, los brazos giran para atrás lo mismo que se dobló el pecho, o sea que cuelgan; si no, las manos se metían en la funda del muslo y en los bolsillos del chaleco. Mirando arriba siguen al pecho.
  - Lo revisa `brazos_choque.py` ([[Pipeline del héroe]]).
- Recargas (`RECARGA`: `RecargaRifle`, `RecargaSubfusil`, `RecargaPistola`, `RecargaEscopeta`, `RecargaFranco`, `RecargaCohete`) y bombeo de la escopeta (`BombeoEscopeta`, `BombeoEscopetaApunta`). Los clips vienen de `animaciones_armas.glb` ([[Pipeline de armas]]).
- Piezas móviles del arma (`PIEZAS`): cargador, cerrojo, bomba, corredera, cohete, cartucho, bala.
- Retroceso (`retroceso`, al final de `animateRig`): cada tiro (`recoil = 1`, lo marca [[main.js]]) suma un impulso a un resorte amortiguado (`R_W`, `R_Z`, `R_IMP`), así sube rápido, vuelve con un rebote chico y con las automáticas se acumula. La tabla `RETRO` da por arma cuánto se inclina el pecho (`sube`), cuánto gira el arma sobre el puño (`flip`), cuánto retrocede en la mano (`atras`) y cuánto gira el torso de costado (`giro`). Apuntando se multiplica por 0,7. Ver [[Armas y disparo]].

## Funciones exportadas

`setRigEnv` (iluminación de entorno con `RoomEnvironment`), `hasRig`, `createRigCharacter`, `placeGlider`, `animateRig`, `weaponRig`, `rigAction`, `rigStopAction`, `rigShot`.

Usa [[assets.js]]. Lo usan [[models.js]], [[main.js]] y [[visor.html]].
