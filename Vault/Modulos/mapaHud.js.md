# mapaHud.js

Volver a [[Inicio]] · sistema: [[Mapa y marcas]]

Archivo: `public/js/mapaHud.js`. Minimapa, mapa grande, brújula y marcas del jugador. Lo crea [[main.js]] con `crearMapa({...})`; estilos en `public/mapaHud.css` (lo carga [[index.html]]).

## Dibujo de la isla

- `pintarTerreno(world, px)` (1024 px): colores de la malla del terreno de [[world.js]] (los mismos de la isla en 3D, un poco menos saturados), sombreado de relieve con luz del noroeste calculado de `terrainHeight`, y el agua según la profundidad (playa → mar hondo, ciénaga turbia con `world.swamp`, espuma en la orilla).
- `pintarVectores(ctx, world, k, vista)`: río (`RIO` de [[isla.js]]), calles y veredas (`world.ribbons`, con borde; la línea del medio de las rutas solo con zoom), plazas (`world.plazas`), casas y edificios (`world.placed` con `fp`; sombra al sudeste y techo con color por tipo en `TECHOS`; lo chico como faroles, bancos o carteles va en `SIN_PLANTA`) y el teleférico (`TELEFERICO`).
- `preparar(world)` (en `ensureWorld`): terreno + una base de 2048 px con todo horneado. Tarda unos 150 ms al armar el mundo.
- Con poco zoom se usa la base horneada; con más zoom el mapa grande dibuja terreno y calles a la resolución de la pantalla (`pintarEstatico`, solo cuando cambia la vista).

## Minimapa (`#minimap`)

- Sigue al jugador con el norte arriba. Cuánto muestra depende del estado (`radioMinimapa`): en el bus 380 m de cada lado, cayendo 230 m, a pie según la opción `minimapaZoom` (`RADIO_MINIMAPA`: cerca 70, medio 115, lejos 180) y en auto ×1,45. Cambia suave.
- Encima (`capasDinamicas`, compartido con el mapa grande): afuera de la [[Tormenta]] teñido de violeta, borde actual violeta y próxima zona punteada en blanco, recorrido del bus y el bus mientras vuela, autos (`autos.minimapa` de [[manejar.js]]), línea punteada hasta la próxima zona si estás afuera, nombres de los pueblos que entran enteros, marcas (si quedan afuera, contra el borde), flecha del jugador (o el bus) y la "N".
- Muerto: sigue al jugador que estás mirando; sin nadie, muestra la isla entera.

## Mapa grande (`#mapaGrande`)

- Tecla `mapa` (M, en cualquier contexto). Al abrir se suelta el mouse (`alAbrir`) y al cerrar se vuelve a capturar (`alCerrar`); Esc y el ✕ también lo cierran. Mientras está abierto se puede seguir caminando y saltar del bus.
- Se abre centrado en vos con zoom 1,8 (en el bus, la isla entera). Rueda: zoom sobre el mouse (hasta ×7), arrastrar: mover, doble clic: acercar, botones + − ◎ (centrar en vos).
- Clic: poner o mover tu marca; clic sobre tu marca o clic derecho: sacarla. La tecla `marcar` con el mapa abierto marca donde está el mouse.
- Grilla A–J (oeste → este) y 1–10 (norte → sur) de 120 m (`celdaDe`), nombres de los pueblos y cartel junto al mouse con la celda, el pueblo y la distancia.
- Panel: dónde estás, estado de la tormenta (el texto de `#stormInfo`), lista de marcas con el lugar y la distancia, botón *Sacar mi marca* y ayuda con las teclas de [[controles.js]].

## Marcas

- Una por jugador (`marcas`: id → `{ x, y, z, color, nombre, haz, aro, et }`), del color del jugador.
- `marcar()` (tecla `marcar`: clic de la rueda o T): sin el mapa, donde apunta la cámara (`castRay` de [[main.js]] + `world.rayTerrain`; mirando al mar, al agua). El mismo lugar otra vez la saca (tolerancia: 4 % de la distancia, mínimo 4 m).
- `ponerMarca(p)` manda `marca` si la opción `compartirMarcas` está activa (ver [[Protocolo de red]]); al desactivarla manda `null`. `mensaje(m)` pone o saca la de otro. `reiniciar(snap.marcas)` al empezar la partida, `quitar(id)` cuando alguien muere o se va.
- En el mundo: haz de luz de 260 m (`ShaderMaterial` aditivo que se desvanece arriba y cerca de la cámara, más ancho de lejos) y un aro en el piso que late. Etiqueta HTML (`#marcasMundo .marca-et`) con el nombre (las de otros) y la distancia; si queda afuera de la pantalla o atrás, va contra el borde.
- Brújula (`#brujula`, arriba al centro): rumbos cada 15° con N, NE, E, SE, S, SO, O y NO, las marcas con su distancia y la próxima zona segura si estás afuera. Se esconde con el mapa abierto y cuando no hay a quién seguir.
- Sonidos `sfx.marca()` y `sfx.quitarMarca()` de [[audio.js]].

## Pruebas

`node tools/mapaHud/pruebas.mjs` (Playwright; `CAPTURAS=carpeta` guarda capturas): teclas sin choques, grilla y rumbos; contra el servidor, que las marcas pasen a la sala, se validen, tengan límite y lleguen al que entra a mitad de partida; en el navegador, abrir y cerrar, poner, mover y sacar la marca con el mouse, zoom y arrastre, marcar mirando al piso, etiqueta, minimapa y brújula.
