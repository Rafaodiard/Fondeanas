# Construcción

Volver a [[Inicio]] · reglas en [[construccion.js]] · mallas en [[construccion3d.js]] · en el juego [[construir.js]] · pedido en [[Construcción estilo Fortnite]]

## Piezas

- Cuatro tipos (`TIPOS`): `pared`, `piso`, `rampa` y `techo` (pirámide de `ALTO_TECHO = 1,6` m), en la grilla de `GRID = 4` m de [[items.js]]. Cada pieza cuesta `BUILD_COST = 10` del material.
- Materiales madera, piedra y metal con 150, 300 y 450 de vida (`MATERIALS`). La pieza nace con el 30 % (`HP_INICIAL`) y llega al máximo en `OBRA` = 2,5 / 5 / 7,5 s. La vida en cada momento es `vidaDe(s, t)`; el daño se acumula en `s.dano`.
- Clave única: `structKey` de [[items.js]]. Las paredes se normalizan (`normalizar`) al borde -Z (dir 0) o -X (dir 3) de la celda.
- La rampa y el techo de una misma celda y nivel no pueden estar juntos (`ocupado`); piso y rampa, o piso y techo, sí.

## Grilla de encastre (como en el género)

Pedido en [[Encastre de la construcción]].

- Cada pieza ocupa bordes de una grilla de celdas `GRID` × `GRID` × `GRID` (`bordes(s)`): la pared, sus bordes de abajo, de arriba y los dos verticales; el piso y el techo, los 4 bordes de su base; la rampa, el borde bajo, el alto y los dos costados en diagonal. Las ediciones no cambian los bordes.
- Dos piezas están enganchadas si comparten un borde (`enganchadas`). Tocarse en una punta no alcanza.
- `motivoNoEncaja(world, s)` (lo usan la vista previa y el servidor): `ocupado`, `grilla` (toca una pieza cuyo nivel no difiere en un múltiplo exacto de `GRID`: así no queda un piso a media pared, `mismaGrilla`) o `apoyo` (no se apoya en el terreno ni en el mapa, `apoyadaEnMapa`, ni comparte un borde). `null` = encaja. Textos en `MOTIVOS`.
- La altura no es una grilla fija del mundo (la isla no está hecha a la medida de la grilla): `nivelGrilla(world, i, j, y)` usa la grilla de la construcción más cercana (2 celdas alrededor, hasta 2 niveles), o el suelo redondeado a medio metro si no hay ninguna.
- Dónde cae la vista previa: `objetivoPieza(world, yo, tipo, giro)` con `direccionDe(yaw)` y `nivelDelJugador` (parado sobre una pieza usa su nivel; sobre una rampa que sube hacia donde se mira, lo de adelante va un nivel arriba).
- Derrumbes: cuando se rompe una construcción o una pieza del mapa, `sinApoyo` recorre de borde en borde desde las piezas apoyadas en el piso o el mapa y el servidor saca las demás (`derrumbar`).

## Ediciones (`s.e`, un entero de bits)

- Pared 3×3 (bit = fila·3 + columna, fila 0 abajo): baldosa sacada. Choca con `cajasPieza` (columnas con los mismos huecos se juntan en una caja). Una puerta (columna del medio, dos filas) deja pasar hasta 2,67 m.
- Piso 2×2: cuarto sacado.
- Rampa: 3 carriles a lo ancho (carril sacado) y la dirección `dir` en la que sube. Al editar se arrastra en la dirección nueva; lo marcado define el ancho (`resultadoEdicion`).
- Techo 2×2: esquina levantada a la altura de la punta (las 4 = techo plano alto). Los bordes con las dos esquinas arriba frenan de costado.
- `editValida`: no se puede sacar todo (salvo en el techo). Solo se editan las piezas propias (`s.owner`).
- Lo que se pisa sale de `superficie(s, x, z)` y lo que frena la cabeza desde abajo de `DEBAJO` (pisos, rampas y techos hacen de techo). [[world.js]] los usa en `groundHeight`, `techoConstruido`, `moveBody` y `collide`.

## En el juego

- Modo construcción, vista previa (azul si encaja, roja si no, con el motivo en `#buildhint`) y colocación seguida: [[construir.js]]. No se construye cayendo ni planeando (saltando sí).
- Opciones para construir rápido (pestaña Juego): `editarAlSoltar` (de fábrica sí: soltar F confirma si se la mantuvo 250 ms o se marcó algo), `construirSeguido` (sí) y `reiniciarPieza` (no: Q vuelve a la pared en vez de la última pieza).
- Una rampa, piso o techo que aparece donde está parado el jugador lo sube arriba (`alAgregar`, hasta 2,2 m).
- Controles (de fábrica, todos remapeables en [[Configuración y controles]]): Q modo construcción, Z/X/C/V pared/piso/rampa/techo, F editar y confirmar, R girar la rampa (solo en construcción), clic derecho en construcción cambia el material y editando restablece la pieza, clic izquierdo coloca o marca baldosas.
- HUD ([[index.html]]): arriba del inventario, la barra `#buildbar` con las cuatro piezas, su tecla y el material elegido; `#buildhint` con la ayuda de construcción o de edición (solo en esos modos); `#structhp` con la vida de lo que se mira o se golpea (construcciones, piezas del mapa, árboles y rocas; lo maneja [[golpes.js]]).
- Material automático: si el elegido no alcanza para una pieza, pasa al siguiente que alcance (`autoMaterial`, en cada `inv`).

## Servidor ([[server.js]])

- `case 'build'`: tipo, material, materiales suficientes, distancia (3 celdas en horizontal y 2,5 en altura), estado (no en el bus, cayendo ni planeando) y `motivoNoEncaja` (libre, misma grilla y apoyo). Guarda `born`, `dano` y `owner` y manda `structAdd`.
- `case 'edit'`: dueño, distancia (`ALCANCE_EDICION` + 2) y edición válida; manda `structEdit` con `e` y `dir`.
- Daño: disparos, pico (con punto débil, ver [[Daño visible y punto débil]]) y explosiones (`damageStruct`) → `structHp` con la vida actual y el daño acumulado (`dano`, para las grietas), o `structDel` con la pieza y `caidas` (las que se cayeron). Cuando se rompe una pieza del mapa, también `structDel` con `key: null` y `caidas`.
- `structPublic` manda `e`, `owner`, `hp`, `max`, `dano`, `obra` y `crece` (segundos que le faltan para levantarse).
- `SF_MATS=500 npm start` arranca cada partida con 500 de cada material (para probar).

Pruebas: [[Pruebas de construcción]] (también `tools/construccion/red.mjs`, contra el servidor).
