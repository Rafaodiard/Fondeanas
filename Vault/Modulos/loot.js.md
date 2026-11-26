# loot.js

Volver a [[Inicio]] · [[Arquitectura]] · sistema: [[Loot y rarezas]]

Archivo: `public/js/loot.js`. Todo lo que se ve del loot en el cliente: objetos del piso, cofres y sus efectos. Usa [[assets.js]] (`objetos.glb`, `cofre.glb`), [[models.js]] (`createWeaponModel` para las armas) y [[items.js]].

## Funciones exportadas

- `luzLoot(renderer)`: reflejos de ambiente (`RoomEnvironment`) para los materiales de `cofre` y `objetos`, como `setRigEnv` de [[rig.js]] con el héroe y las armas. Sin esto el dorado y el metal se ven casi negros. Se llama una vez después de `loadAssets`.
- `createItemMesh(item, color)`: objeto del piso. Las armas salen de `armas.glb` (1,2 veces más grandes que en la mano y apenas inclinadas); el resto del nodo `objetos_<nombre>` de `objetos.glb` (`municion_<tipo>`, `material_<material>` o el consumible), con `Tinte` del color del objeto, el vidrio transparente y el líquido de escudo que brilla. Si el GLB no cargó, formas simples. Suma anillo en el piso, halo y, en las armas, haz de luz y chispas según la rareza. [[models.js]] la reexporta.
- `modeloObjeto(item, color)` (2026-11-26): el modelo de un objeto que no es arma (nodo `objetos_<nombre>` de `objetos.glb` con sus materiales, o la forma simple si no cargó). Lo usan `createItemMesh` y [[iconos.js]] para la foto de la barra de items.
- `createChest()`: cofre con aura, brillo en el piso y motas doradas. La tapa es el nodo `cofre_tapa`; el fondo usa el material `BrilloCofre` clonado por cofre.
- `abrirCofre(g, animar)`: con `animar` arranca la animación (tapa con rebote, destello, ráfaga de chispas, brillo que se apaga); sin animar queda abierto de una.
- `animarLoot(items, cofres, t, camera)`: un cuadro. Objetos: flotan, giran, el haz mira a la cámara, chispas solo a menos de 45 m, nada a más de 160 m. Un objeto nuevo a menos de 3,5 m de un cofre abierto hace menos de 1,5 s sale volando del cofre en arco (0,6 s). Cofres: aura que late mientras están cerrados y la animación de apertura.

## Quién la usa

- [[main.js]]: `MODEL.cofre` / `MODEL.abrirCofre` para [[world.js]], `luzLoot` y `animarLoot` en `updateItems`. El mensaje `chestOpen` abre con animación; el snapshot al entrar, sin.
- [[iconos.js]]: `modeloObjeto` para las fotos de los consumibles.
- [[mapa.html]] y [[loot.html]].
