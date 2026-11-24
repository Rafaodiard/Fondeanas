# models.js

Volver a [[Inicio]] · [[Arquitectura]]

Archivo: `public/js/models.js`. Arma los objetos 3D del juego. Si el GLB correspondiente cargó ([[assets.js]]), usa ese; si no, cae a primitivas low-poly hechas con código.

## Funciones exportadas

- `createCharacter(color)`: si hay esqueleto (`hasRig`) usa [[rig.js]] (`createRigCharacter`); si no, el personaje procedural. La ropa se tiñe con el color del jugador (material `Ropa`).
- `animateCharacter(...)`: delega en `animateRig` de [[rig.js]] cuando hay rig.
- `createGlider(color)` (material `Tela` teñido), `createBus()`, `createNameTag(name, color)`.
- `createWeaponModel(type, color)`: nodo `type` de `armas.glb`, con `Rareza` teñido; `createPickaxe()`: nodo `pico`.
- `setHeld(char, what, color)`: lo que tiene en la mano.
- `createItemMesh(item, color)`: objeto del piso (`objetos.glb`, materiales `Tinte`/`Mat`).
- Reexporta de [[rig.js]]: `weaponAction`, `stopWeaponAction`, `weaponShot`.

> El comentario de cabecera del archivo (y el README) todavía dicen que los modelos son "provisorios hasta reemplazarlos por GLB". Hoy el código ya usa los GLB primero y las primitivas son solo el respaldo.

Usa [[assets.js]] y [[rig.js]]. Lo usan [[main.js]] y [[visor.html]].
