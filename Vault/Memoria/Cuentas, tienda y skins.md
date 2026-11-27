# Cuentas, tienda y skins

Volver a [[Índice de memoria]] · resultado en [[Cuentas, tienda y skins (sistema)]], [[Pipeline de skins]], [[menu.js]], [[cuentas.js]] y [[skins.js]]

**2026-11-26 · Rafael**

- "Hace un sistema de cuentas, un menú, una tienda de skins con funcionalidades como reroll y cosas de apuestas estilo counter strike, mezcla eso con la clasificación de Fortnite. Hace que todos empiecen con 1000 pavos y hace una cuenta admin que le pueda dar cosas a otros usuarios."
- "Hace modelos de skins, quiero que sean creativos y muy distintas entre si. Que hayan distintas rarezas y obviamente tengan precios distintos. Que con las partidas se ganen pavos." y "Hace bastantes".
- "Hace muchas pero muchas skins, unas 30 o 40. Hacerlas bien creativas, ponele que haces unas 15 que sean humanos pero muy distintos entre si, después otras que sean monstruos, o animales, o robots o cosas así. Tené en cuenta que para que no haya skins mejores que otras todas deben tener el mismo tamaño y hitbox."

**2026-11-26 · coordinador del proyecto (al pasar el pedido)**

- Todo es moneda virtual (pavos), sin plata real. Contraseñas con scrypt o bcrypt. Persistencia que sobreviva reinicios. Toda la lógica de saldo, tiradas y admin en el servidor. La cuenta admin sale de variables de entorno, nunca de una contraseña fija en el repo. Las skins son solo cosméticas.

**2026-11-26 · Claude (al hacer el pedido)**

- "Clasificación de Fortnite" = las rarezas del juego (Común, Poco común, Rara, Épica, Legendaria, mismos colores que el loot). "Estilo Counter Strike" = cajas con ruleta horizontal, contrato (5 de una rareza → 1 de la siguiente) y cara o cruz. Ninguna apuesta usa plata real.
- 84 skins: 38 trajes (16 humanos, 10 monstruos, 8 animales, 4 robots), 14 mochilas, 11 picos, 10 planeadores y 11 envoltorios. Todas usan el mismo esqueleto y la misma hitbox del servidor: un traje cambia colores, patrones, efectos y suma accesorios modelados (cascos, cabezas enteras, colas), nunca el tamaño del cuerpo. Las cabezas enteras tapan la del héroe, que se esconde con un corte en el shader.
- Los accesorios se modelaron con Blender por script (`tools/blender/skins.py`) en vez de comprar o bajar modelos: mismo estilo que el resto y se pueden rehacer.
- Precios por tipo y rareza (traje 400 a 2200, el resto más barato). Vender devuelve el 40 %; una repetida de una caja, el 50 %. Reroll de la tienda: 100, 200, 400… hasta 1600 por día.
- Pavos por partida: 20 por jugar, 25 por eliminar a una persona, 10 por un bot (hasta 20 eliminaciones), 150 por ganar contra personas o 60 si eran solo bots. Se cobran al morir o al terminar, una vez por partida.
- Invitado: se puede jugar sin cuenta, con lo básico. Un invitado no puede usar el nombre de una cuenta (se le agrega `*`).
- Admin: `SF_ADMIN_USUARIO` y `SF_ADMIN_CLAVE`. Puede dar o sacar pavos (el saldo nunca baja de 0) y dar o sacar skins; queda registro de cada cosa que hace.

**2026-11-26 · thread de hosting (Render gratis)**

- En Render gratis el disco se borra en cada deploy o cuando se duerme: con `DATABASE_URL` las cuentas van a Postgres (Neon gratis), sin ella a `datos/cuentas.json`. Si `DATABASE_URL` está pero la base no responde, el servidor no arranca, para no perder cuentas nuevas en un archivo que después se borra.
