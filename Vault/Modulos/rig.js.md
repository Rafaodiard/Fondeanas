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

## Funciones exportadas

`setRigEnv` (iluminación de entorno con `RoomEnvironment`), `hasRig`, `createRigCharacter`, `placeGlider`, `animateRig`, `weaponRig`, `rigAction`, `rigStopAction`, `rigShot`.

Usa [[assets.js]]. Lo usan [[models.js]], [[main.js]] y [[visor.html]].
