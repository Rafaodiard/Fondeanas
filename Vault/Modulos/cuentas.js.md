# cuentas.js

Volver a [[Inicio]] · sistema: [[Cuentas, tienda y skins (sistema)]]

Archivo: `servidor/cuentas.js` (2026-11-26, solo servidor). Clase `Cuentas`: registro, sesiones, pavos, skins, tienda, cajas, apuestas, premios por partida y admin.

- `new Cuentas({ carpeta })` guarda en `<carpeta>/cuentas.json` (escritura atómica: archivo temporal y renombrar). Un archivo roto se copia aparte y se arranca de cero. `new Cuentas({ almacen })` + `await cargar()` usa otro lugar ([[almacenPg.js]]).
- `guardar()` junta los cambios (150 ms, 400 ms con almacén); `guardarYa()` devuelve una promesa.
- `registrar`, `entrar` (si el usuario no existe igual calcula un hash, para no delatar usuarios), `deToken`, `salir`, `asegurarAdmin(usuario, clave)`.
- `publica(u)`: lo que ve el dueño (pavos, skins, equipo, tienda, estadísticas, historial).
- `comprar`, `reroll`, `equipar`, `vender`, `abrirCaja`, `moneda`, `contrato`, `premiar` (pavos de la partida).
- Admin: `listar(q)`, `ver`, `dar(admin, usuario, { pavos, skin })`, `quitar`, con registro.
- `hashClave` / `claveCorrecta`: scrypt con sal al azar.
