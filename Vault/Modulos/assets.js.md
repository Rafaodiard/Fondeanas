# assets.js

Volver a [[Inicio]] · [[Arquitectura]]

Archivo: `public/js/assets.js`. Carga los modelos de [[Modelos GLB]].

- `loadAssets(onProgress)`: carga con `GLTFLoader` (+ `MeshoptDecoder`) los archivos `personaje`, `animaciones_armas`, `bus`, `planeador`, `cofre`, `armas`, `objetos`, `pino`, `arbol`, `roca` (`casa.glb` ya no se carga: las casas del mapa salen de [[planos.js]]). Si uno falla, avisa en consola y el juego usa el modelo procedural de [[models.js]]. Los clips de `animaciones_armas.glb` (recargas, bombeo) se suman a los de `personaje.glb`.
- `ASSETS` y `ANIMS`: escenas y animaciones cargadas, por nombre.
- `cloneAsset(name, child, tints)`: copia profunda; los materiales cuyo nombre está en `tints` se clonan y se tiñen (`Rareza` y `Tinte` además brillan un poco).
- `bakedParts(name)`: geometrías con la transformación aplicada, para `InstancedMesh` (árboles y rocas en [[world.js]]).

Lo usan [[main.js]], [[models.js]], [[rig.js]] y [[visor.html]].
