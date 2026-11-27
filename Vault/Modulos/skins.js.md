# skins.js

Volver a [[Inicio]] · sistema: [[Cuentas, tienda y skins (sistema)]]

Archivo: `public/js/skins.js` (2026-11-26). Catálogo de skins, compartido entre el cliente y el servidor (sin dependencias salvo [[items.js]] para las rarezas).

- `SKINS`: las 84 skins. Cada una: `id`, `nombre`, `tipo` (`personaje`, `mochila`, `pico`, `planeador`, `envoltorio`), `rareza` (0 a 4), `desc`, y según el tipo:
  - traje: `tag` (`humano`, `monstruo`, `animal`, `robot`), `look` (colores por zona del héroe: `chaleco`, `pantalon`, `camisa`, `bufanda`, `cuero`, `piel`, `metal`; `patron`, `brillo`, `acabado` con `en: [zonas | 'acc']`; `acc`: accesorios de `skins.glb` con el color de cada material) e `incluye` (mochila que viene con el traje).
  - mochila: `modelo` (nodo `acc_<modelo>` de `skins.glb`) y `colores`.
  - pico: `modelo` (nodo `pico_*`) o, sin modelo, el pico de `armas.glb` con otro acabado.
  - planeador: `tela` (`Tela`, `TelaClara`), `patron`, `brillo`.
  - envoltorio: `patron`, `brillo`, `acabado`.
- `SKIN` (por id), `RAREZAS` (= `RARITIES`), `TIPOS`, `ORDEN_TIPOS`, `PRECIOS` (por tipo y rareza), `precio(s)`, `vendible(s)`, `GRATIS`, `EQUIPO_INICIAL`, `OPCIONALES` (mochila y envoltorio pueden ir vacíos), `equipoValido(eq, tiene)`.

Lo interpreta [[aspecto.js]]; las reglas de la tienda están en [[tienda.js]].
