# almacenPg.js

Volver a [[Inicio]] · sistema: [[Cuentas, tienda y skins (sistema)]]

Archivo: `servidor/almacenPg.js` (2026-11-26, solo servidor). `almacenPostgres(url)` devuelve `{ cargar, guardar, cerrar }` para que [[cuentas.js]] guarde en Postgres en vez de un archivo. Lo usa [[server.js]] cuando existe `DATABASE_URL` (hosting sin disco fijo, como Render gratis con Neon).

- Crea la tabla `sf_datos (clave, valor jsonb, actualizado)` si no existe y guarda todo el documento de cuentas en la fila `cuentas`. Las escrituras van de a una y en orden.
- SSL con certificado verificado salvo en `localhost` o si la URL trae `sslmode`.
- Dependencia: `pg`.
