# rig.js

Volver a [[Inicio]] · [[Arquitectura]]

Archivo: `public/js/rig.js`. Personaje con esqueleto y animaciones hechas en Blender (`personaje.glb`, ver [[Pipeline del héroe]]).

## Cómo anima

- Tres capas: **piernas** (cadera, columna baja y piernas; regex `PIERNAS`), **torso** (columna alta, brazo derecho y cabeza) y **brazo izquierdo** (regex `BRAZO_L`, del hombro a los dedos). El brazo izquierdo va con el torso, salvo en las poses que llevan el objeto solo en la mano derecha (`MANO_L_LIBRE`: `SostenerPico` y `Objeto`): ahí sale de la locomoción y se balancea al correr.
- Locomoción (`LOCO`): mezcla `Quieto`, `Caminar`, `Trote`, `Correr` y `Sprint` según la velocidad, con la fase sincronizada.
- Arriba se pone la pose del arma (`POSE_ARMA`: `SostenerPico`, `Rifle`, `Pistola`, `Lanzacohetes`, `Objeto`) o su versión al apuntar (`APUNTA`), o el golpe.
  - El pico se sostiene igual a cualquier velocidad (`SostenerPico` pesa 1 en el piso y 0,4 en el aire): el brazo derecho lo lleva al costado y el izquierdo se balancea con la carrera. Antes la pose se apagaba con la velocidad (a 2,5 m/s ya no estaba) y el brazo derecho se balanceaba con el pico en la mano, que atravesaba la pierna y el torso (2026-11-26).
- Después del mezclador se dobla la columna para apuntar adonde mira la cámara (`pitch`, de -1,35 a 1,2 rad):
  - **Con arma**: corrige el ángulo del cañón y lo reparte en `Spine`, `Spine1` y `Spine2` (40 / 30 / 30 %). Tiene tope: `CURVA_APUNTA` (-55° a +65°) apuntando y `CURVA_CADERA` (-15° a +20°) con el arma a la cadera. Más allá los antebrazos se hundían en la panza y las manos chocaban con las rodillas al correr.
  - **Recargando**: el 40 % del `pitch`, repartido en toda la columna como con arma (40 / 30 / 30 %) y con el tope de `CURVA_CADERA`. El resto lo hacen el cuello y la cabeza.
  - **Sin arma** (locomoción, pico, objeto, golpe): `Spine1` 18 %, `Spine2` 22 %, cuello 20 % y cabeza 30 % del `pitch`. Mirando abajo, los brazos giran para atrás lo mismo que se dobló el pecho, o sea que cuelgan; si no, las manos se metían en la funda del muslo y en los bolsillos del chaleco. Mirando arriba siguen al pecho.
  - Lo revisa `brazos_choque.py` ([[Pipeline del héroe]]).
- Recargas (`RECARGA`: `RecargaRifle`, `RecargaSubfusil`, `RecargaPistola`, `RecargaEscopeta`, `RecargaFranco`, `RecargaCohete`) y bombeo de la escopeta (`BombeoEscopeta`, `BombeoEscopetaApunta`). Los clips vienen de `animaciones_armas.glb` ([[Pipeline de armas]]).
- Caída libre (`animaciones_caida.glb`): mezcla `CaidaPlaneo` / `Caida` / `CaidaPicada` según `x.caida` (-1 a 1).
- Paracaídas: `Abrir` una vez al pasar de `falling` a `glider` (`abrirT`), después `Paracaidas` mezclado con `ParacaidasIzq`, `ParacaidasDer` y `ParacaidasFreno` según `x.giro` y `x.freno`. Al tocar el piso desde el aire, `Aterrizaje` (`aterrizaT`) pisa la locomoción y se corta si sale corriendo. `Deslizar` reemplaza la locomoción con `x.desliz`.
- `placeParachute` cuelga `paracaidas.glb` de `ARNES` (entre los hombros del clip `Paracaidas`) y `animarParacaidas` maneja la apertura (`paraK`: sale arrugado con la forma `Plegado` y se infla con rebote entre 0,2 y 0,75 s), el cierre, los frenos (formas `FrenoL`/`FrenoR`) y las cuerdas de los frenos hasta las manos.
- `inclinar`: todo el cuerpo (grupo `pivote`, entre la raíz y el modelo) se ladea hacia la curva: en caída libre sobre la cadera y con el paracaídas sobre los hombros, así la vela se inclina con el cuerpo; al frenar se va un poco atrás.
- Piezas móviles del arma (`PIEZAS`): cargador, cerrojo, bomba, corredera, cohete, cartucho, bala.
- Retroceso (`retroceso`, al final de `animateRig`): cada tiro (`recoil = 1`, lo marca [[main.js]]) suma un impulso a un resorte amortiguado (`R_W`, `R_Z`, `R_IMP`), así sube rápido, vuelve con un rebote chico y con las automáticas se acumula. La tabla `RETRO` da por arma cuánto se inclina el pecho (`sube`), cuánto gira el arma sobre el puño (`flip`), cuánto retrocede en la mano (`atras`) y cuánto gira el torso de costado (`giro`). Apuntando se multiplica por 0,7. Ver [[Armas y disparo]].

## Funciones exportadas

`setRigEnv` (iluminación de entorno con `RoomEnvironment`), `hasRig`, `createRigCharacter`, `placeGlider`, `placeParachute`, `ARNES`, `animateRig`, `weaponRig`, `rigAction`, `rigStopAction`, `rigShot`.

Usa [[assets.js]]. Lo usan [[models.js]], [[main.js]] y [[visor.html]].

## Sentado en un auto (2026-11-26)

Con `state === 'auto'`, `animateRig` llama a `animarSentado`: pose `Quieto`, piernas dobladas por asiento (tabla `PIERNA`: el conductor con los pies en los pedales, atrás más encogidos), espalda contra el respaldo y brazos con IK de dos huesos (`ik`, `alinear`): el conductor lleva las manos a `x.manos` (dos puntos del aro del volante que le pasa [[manejar.js]]) y gira las muñecas con `x.giro`; los pasajeros apoyan las manos en los muslos. El arma no se ve. `CADERA_SENTADO` es la altura de la cadera sobre la suela en esa pose (para apoyar la cola en el almohadón). Ver [[Autos]].
