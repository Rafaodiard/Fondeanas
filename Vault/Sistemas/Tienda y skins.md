# Tienda y skins

Volver a [[Inicio]] · pedido: [[Cuentas, casino y tienda]] · código: [[tienda.js]] · [[skins.js]]

- **Sin skins todavía** (decisión del 2026-11-26): `SKINS` está vacío y la tienda muestra 8 espacios "Próximamente"; el casillero muestra la skin de fábrica puesta y 11 espacios vacíos.
- Ya funciona del lado del servidor ([[tienda.js]] en `server/`): `comprar` (descuenta el precio con `mover`, no deja comprar dos veces ni sin saldo) y `poner` (solo skins compradas; `null` = la de fábrica). Lo prueba `tools/cuentas/pruebas.mjs` con un catálogo de prueba.
- La skin puesta viaja en `publicPlayer` (`skin`) y [[models.js]] `createCharacter(color, skin)` tiñe la ropa (`ropa`) y la vela (`tela`). El lobby 3D la muestra.
- Para agregar una skin: sumarla a `SKINS` en [[skins.js]] (formato en el comentario del archivo). Las piezas modeladas (`piezas`) quedan para más adelante.
