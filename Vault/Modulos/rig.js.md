# rig.js

Volver a [[Inicio]] · [[Arquitectura]]

Archivo: `public/js/rig.js`. Personaje con esqueleto y animaciones hechas en Blender (`personaje.glb`, ver [[Pipeline del héroe]]).

## Cómo anima

- Dos capas: **piernas** (cadera, columna baja y piernas; regex `PIERNAS`) y **torso** (columna alta, brazos y cabeza).
- Locomoción (`LOCO`): mezcla `Quieto`, `Caminar`, `Trote`, `Correr` y `Sprint` según la velocidad, con la fase sincronizada.
- Arriba se pone la pose del arma (`POSE_ARMA`: `SostenerPico`, `Rifle`, `Pistola`, `Lanzacohetes`, `Objeto`) o su versión al apuntar (`APUNTA`), o el golpe.
- Después del mezclador se dobla la columna para apuntar adonde mira la cámara.
- Recargas (`RECARGA`: `RecargaRifle`, `RecargaSubfusil`, `RecargaPistola`, `RecargaEscopeta`, `RecargaFranco`, `RecargaCohete`) y bombeo de la escopeta (`BombeoEscopeta`, `BombeoEscopetaApunta`). Los clips vienen de `animaciones_armas.glb` ([[Pipeline de armas]]).
- Piezas móviles del arma (`PIEZAS`): cargador, cerrojo, bomba, corredera, cohete, cartucho, bala.
- Retroceso (`retroceso`, al final de `animateRig`): cada tiro (`recoil = 1`, lo marca [[main.js]]) suma un impulso a un resorte amortiguado (`R_W`, `R_Z`, `R_IMP`), así sube rápido, vuelve con un rebote chico y con las automáticas se acumula. La tabla `RETRO` da por arma cuánto se inclina el pecho (`sube`), cuánto gira el arma sobre el puño (`flip`), cuánto retrocede en la mano (`atras`) y cuánto gira el torso de costado (`giro`). Apuntando se multiplica por 0,7. Ver [[Armas y disparo]].

## Funciones exportadas

`setRigEnv` (iluminación de entorno con `RoomEnvironment`), `hasRig`, `createRigCharacter`, `placeGlider`, `animateRig`, `weaponRig`, `rigAction`, `rigStopAction`, `rigShot`.

Usa [[assets.js]]. Lo usan [[models.js]], [[main.js]] y [[visor.html]].
