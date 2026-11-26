# models.js

Volver a [[Inicio]] · [[Arquitectura]]

Archivo: `public/js/models.js`. Arma los objetos 3D del juego. Si el GLB correspondiente cargó ([[assets.js]]), usa ese; si no, cae a primitivas low-poly hechas con código.

## Funciones exportadas

- `createCharacter(color)`: si hay esqueleto (`hasRig`) usa [[rig.js]] (`createRigCharacter`); si no, el personaje procedural. La ropa se tiñe con el color del jugador (material `Ropa`).
- `animateCharacter(...)`: delega en `animateRig` de [[rig.js]] cuando hay rig.
- `createGlider(color)` (material `Tela` teñido), `createNameTag(name, color)`.
- `createBus()`: clona `bus.glb`, guarda las hélices en `userData.props`, le pone a cada material un cielo de reflejo (`cieloBus`, un cubo de degradés hecho con canvas) y hace destellar los materiales `Baliza` (1 vez por segundo) y `Destello` (doble flash) con `onBeforeRender`. Sin el GLB arma un bus de cajas. Ver [[Pipeline del bus]].
- `createWeaponModel(type, color)`: nodo `type` de `armas.glb`, con `Rareza` teñido; `createPickaxe()`: nodo `pico`.
- `setHeld(char, what, color)`: lo que tiene en la mano.
- `createItemMesh(item, color)`: lo reexporta desde [[loot.js]] (ahí están los objetos del piso y sus efectos).
- Reexporta de [[rig.js]]: `weaponAction`, `stopWeaponAction`, `weaponShot`.

Usa [[assets.js]] y [[rig.js]]. Lo usan [[main.js]] y [[visor.html]].

## Autos (2026-11-26)

`createAuto(color)`: clona `auto.glb` con `Pintura` teñida, un material propio por auto con el cielo de reflejo del bus (`cieloBus`), `Vidrio` transparente y la chapa de doble cara (se ve por dentro desde las ventanillas). Guarda en `userData` las ruedas (orden de giro `YXZ`: doblar y rodar), el volante, el material de las luces de freno (`frenos`, `frenoBase`) y `quemar()` (queda oscuro y sin vidrios al explotar). Sin el GLB arma un auto de cajas. Lo usan [[manejar.js]] y [[mapa.html]]. Ver [[Pipeline del auto]].
