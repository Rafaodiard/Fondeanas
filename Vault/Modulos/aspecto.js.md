# aspecto.js

Volver a [[Inicio]] · sistema: [[Cuentas, tienda y skins (sistema)]] · arte: [[Pipeline de skins]]

Archivo: `public/js/aspecto.js` (2026-11-26). Hace que cada skin se vea en el juego, sobre el mismo personaje de [[rig.js]] (mismo esqueleto y tamaño).

## Shader de skins

`materialSkin(base, opciones)` clona el material y le inyecta código con `onBeforeCompile`:

- **Zonas del héroe**: el atlas del héroe no tiene una textura por prenda, así que se reconocen por el color (tono, saturación y brillo): pantalón oliva, camisa/guantes oscuros, bufanda verde agua, cuero y pelo marrón oscuro, piel clara. Cada zona se repinta conservando las sombras de la textura.
- **Patrones** en el espacio de la malla: camuflaje, rayas, cuadros, manchas, escamas, vendas, circuito, pelaje, lunares, degradé y llamas.
- **Efectos animados** (emisivos): holo, lava, galaxia, neón y pulso. El tiempo lo avanza `avanzarAspecto(dt)` desde [[main.js]].
- **Acabados metálicos**: oro y cromo.
- **Corte de cabeza**: con un traje de cabeza entera (`cab_*`) se descarta la cabeza del héroe; con sombrero o cabeza entera se descartan las antiparras.
- El GLB del héroe viene cuantizado (posiciones de -1 a 1, la escala quedó en las inversas de los huesos): `deqDe(material)` saca esa matriz del esqueleto en reposo y el shader la usa para tener la posición en metros (`vSfPos`).

## Funciones

- `vestir(personaje, sk, color)`: pone los materiales del traje (cacheados por traje), cuelga los accesorios del hueso que les toca (cabeza, columna, cadera o brazos, con la inversa de la pose de reposo), cuelga la mochila y pinta el paracaídas. La llama `createCharacter` de [[models.js]].
- `modeloPico(id)`, `envolver(arma, id)`, `modeloMochila(id)`: para la mano y para las fotos de [[vitrina.js]].
- `avanzarAspecto(dt)`, `TIEMPO`.

Se revisa con [[skins.html]] y `node tools/skins/pruebas.mjs`.
