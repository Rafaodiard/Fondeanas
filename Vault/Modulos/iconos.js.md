# iconos.js

Volver a [[Inicio]] · [[Arquitectura]] · sistemas: [[Loot y rarezas]], [[Armas y disparo]]

Archivo: `public/js/iconos.js` (2026-11-26). Las fotos de las armas y los objetos que se ven en la barra de items. No son imágenes guardadas en el repo: se sacan al cargar el juego de los mismos modelos 3D que se ven en la partida (`armas.glb` y `objetos.glb`, ver [[Modelos GLB]]), así un cambio en un modelo cambia solo su ícono.

## Cómo saca cada foto

1. Arma el modelo igual que en el juego: armas con `createWeaponModel(w, colorDeRareza, true)` de [[models.js]] (la franja `Rareza` del color de la rareza), el pico con el nodo `pico` de `armas.glb` (o `createPickaxe` si no cargó) y los consumibles con `modeloObjeto` de [[loot.js]].
2. Lo gira según `POSE` (orden ZXY: giro sobre su eje, inclinación hacia la cámara y giro en la pantalla). Armas: de costado, cañón a la derecha, un poco en 3/4. Pico: en diagonal. Objetos: en 3/4 desde arriba.
3. Encuadre exacto con una cámara ortográfica: caja de los vértices visibles vista desde la cámara, más un margen.
4. Lo dibuja con el renderer del juego en una textura aparte (flotante, con antialias y fondo transparente), y el `OutputPass` de three le aplica el mismo tono (ACES) y espacio de color que la pantalla. Guarda y devuelve el estado del renderer (textura, color de fondo, sombras).
5. Lee los píxeles, da vuelta las filas, quita el alfa premultiplicado y lo pasa a PNG como URL de blob.

Tamaño: `ICONO` = 216 × 144 px (la barra lo muestra a ~64 × 50 px, alcanza para zoom 3x). Luz propia: cielo + suelo, principal arriba a la izquierda, relleno y contraluz.

## Funciones exportadas

- `prepararIconos(renderer)`: saca todas las fotos de una (pico, cada arma en cada rareza que puede salir y cada consumible: 35). [[main.js]] la llama al arrancar, después de `setRigEnv` y `luzLoot` (sin los reflejos los metales salen negros).
- `iconoDe(item)`: URL de la foto de un arma (`arma:<w>:<rareza>`) o consumible (`obj:<c>`); `''` para lo que no tiene.
- `iconoPico()`: URL de la foto del pico.
- `ICONO`: tamaño de las fotos.

## Quién la usa

- [[main.js]] `updateSlots`: cada lugar de la barra con foto lleva la clase `foto` (el nombre se esconde y queda de `title`) y un `<img class="ic">`. El nombre de lo que tenés en la mano va en `#itemMano` (ver [[index.html]]).

## Pruebas

`node tools/iconos/pruebas.mjs` (necesita Playwright): abre el juego en Chromium, revisa que las 35 fotos existan, tengan el tamaño justo, no estén vacías ni cortadas contra el borde y ocupen el ancho, que el rifle cambie según la rareza, que la barra muestre una foto por lugar y que `#itemMano` diga el arma y la rareza. Con `CAPTURAS=carpeta` guarda la hoja con todas las fotos y capturas de la barra en partida.
