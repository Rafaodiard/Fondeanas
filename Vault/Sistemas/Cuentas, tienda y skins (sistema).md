# Cuentas, tienda y skins (sistema)

Volver a [[Inicio]] · pedido y decisiones en [[Cuentas, tienda y skins]] · código: [[cuentas.js]], [[api.js]], [[almacenPg.js]], [[skins.js]], [[tienda.js]], [[aspecto.js]], [[vitrina.js]], [[menu.js]]

Desde 2026-11-26. Cuentas con pavos (moneda virtual), skins cosméticas, tienda diaria, cajas, apuestas y una cuenta admin. Todo lo que cambia pavos o skins lo decide el servidor; el cliente pide por HTTP y muestra.

## Cuentas

- Usuario de 3 a 16 letras, números o `_` (sin distinguir mayúsculas). Contraseña de 6 o más, guardada con scrypt (N=16384, sal al azar por cuenta). Sesión: token al azar de 30 días; en lo guardado queda solo su hash sha256.
- Cada cuenta nueva arranca con **1000 pavos** y lo gratis (Recluta, el pico clásico y el planeador clásico).
- Dónde se guarda: `datos/cuentas.json` (o la carpeta `SF_DATOS`), escrito de forma atómica; con `DATABASE_URL`, una fila JSON en la tabla `sf_datos` de Postgres ([[almacenPg.js]]).
- Límite de intentos de entrar o registrarse por IP (`SF_LIMITE_LOGIN`, 12 por minuto) y de acciones por cuenta (240 por minuto).

## Skins

Cinco tipos ([[skins.js]]): **traje**, **mochila**, **pico**, **planeador** y **envoltorio** (acabado de las armas). Rarezas: las mismas cinco del loot ([[Loot y rarezas]]). Todas comparten esqueleto y hitbox: ninguna da ventaja. Cómo se ven: [[aspecto.js]] y [[Pipeline de skins]].

## Tienda diaria

Distinta para cada cuenta (semilla con el usuario y el día de Buenos Aires): 2 destacadas (Épicas o Legendarias, la primera siempre un traje) y 6 del día (al menos dos trajes). Cambia a la medianoche de Buenos Aires. **Reroll**: vuelve a sortear por 100, 200, 400, 800 y 1600 pavos (por día).

## Cajas (ruleta estilo CS)

| Caja | Precio | Qué trae | Común / Poco común / Rara / Épica / Legendaria |
|---|---|---|---|
| Recluta | 300 | de todo | 50 / 30 / 14 / 5 / 1 |
| Arsenal | 400 | picos y envoltorios | 30 / 35 / 22 / 10 / 3 |
| Salvaje | 600 | trajes no humanos y mochilas | 0 / 45 / 33 / 16 / 6 |
| Leyenda | 1200 | de todo | 0 / 0 / 55 / 33 / 12 |

Primero se sortea la rareza y después una skin de esa rareza. Si sale una que ya tenés, devuelve el 50 % de su precio. La ruleta del menú es solo para mostrar: el premio ya lo eligió el servidor (`cinta` y `pos`).

## Apuestas

- **Cara o cruz**: de 10 a 2000 pavos, 50 y 50, duplicás o perdés.
- **Contrato**: 5 skins distintas de la misma rareza (no Legendarias) → 1 de la rareza siguiente. El menú no ofrece las mochilas que vinieron con un traje que tenés.
- **Vender**: devuelve el 40 % del precio. Lo gratis no se vende.

## Pavos por partida

20 por jugar, 25 por eliminar a una persona, 10 por un bot (hasta 20 eliminaciones), 150 por ganar contra personas o 60 si eran solo bots. Se suman al morir o al terminar la partida, una sola vez; llega el mensaje `pavos` ([[Protocolo de red]]) y el menú muestra el cartel.

## En la partida

Al crear o unirse a una sala con sesión, el servidor usa el nombre de la cuenta y sus skins (`sk` en cada jugador de `roomInfo`). Los bots salen con skins al azar. Cambiar skins en la sala de espera (botón *🎒 Cambiar skins*) se ve enseguida en los demás.

## Admin

La cuenta de `SF_ADMIN_USUARIO` / `SF_ADMIN_CLAVE` se crea (o se le da admin y esa clave) al arrancar. En el menú tiene la pestaña *Admin*: buscar usuarios, dar o sacar pavos y dar o sacar skins. Cada acción queda en `registroAdmin`.

## Pruebas

- `node tools/cuentas/pruebas.mjs`: catálogo, probabilidades de las cajas (40.000 tiradas), tienda, toda la lógica de cuentas y el servidor de verdad (API, permisos, reinicio, salas con sesión, pavos al morir). Con `PRUEBA_DATABASE_URL` también prueba Postgres.
- `node tools/menu/pruebas.mjs`: el menú en Chromium (crear cuenta, tienda, reroll, equipar, caja, cara o cruz, admin y la partida con las skins). `CAPTURAS=carpeta` guarda capturas.
- `node tools/skins/pruebas.mjs`: la vitrina [[skins.html]] carga sin errores de shader y los accesorios cuelgan del hueso correcto.
