# Construcción

Volver a [[Inicio]]

- Piezas: `pared`, `piso`, `rampa`, en una grilla de `GRID = 4` m ([[items.js]]). Materiales madera, piedra y metal con 150, 300 y 450 de vida. Cada pieza cuesta `BUILD_COST = 10` del material.
- Clave única: `structKey` normaliza las paredes para que la del borde +Z de una celda sea la misma que la del borde -Z de la siguiente.
- Cliente ([[main.js]]): `setBuild`, `buildTarget` y `updateBuild` muestran el fantasma de la pieza; teclas de fábrica Z/X/C, Q para el modo construcción y V para cambiar material; se pueden cambiar en [[Configuración y controles]] (acciones `construirPared`, `construirPiso`, `construirRampa`, `modoConstruccion`, `cambiarMaterial` de [[controles.js]]).
- Servidor ([[server.js]], `case 'build'`): valida tipo, material, materiales suficientes y distancia (hasta 3 celdas en horizontal y 2,5 en altura), guarda la pieza en `world.structs` y manda `structAdd`.
- Daño: disparos, pico y explosiones (`damageStruct`) → `structHp` o `structDel`.
- Mallas: `makeStructMesh` en [[world.js]].
