# Salto Final

Battle royale 3D para navegador: una isla con 10 pueblos distintos, bus volador, caída libre con planeo y picada, paracaídas que se abre y se cierra, deslizarse, tormenta que se achica, salas privadas a las que se entra con un código y bots para jugar solo o completar la sala.

## Cómo jugar en tu compu

```bash
npm install
npm start
```

Abrí http://localhost:3000, poné tu nombre y tocá **Crear sala**. Tus amigos entran con el código de 5 letras (o con el link `http://TU-IP:3000/?sala=CODIGO` si están en tu misma red). Para jugar por internet hay que subir el servidor a un hosting con Node y WebSockets (Render, Railway, Fly.io, etc.).

**Después de cada `git pull`, cerrá el servidor (Ctrl+C) y volvé a correr `npm start`.** El servidor carga su código una sola vez al arrancar: si sigue prendido, el navegador recibe los archivos nuevos pero el servidor sigue con la lógica vieja, y lo nuevo no anda (por ejemplo, los autos muestran *E Manejar* pero no te dejan subir). Si pasa, el juego muestra un cartel rojo arriba que lo avisa y la consola del servidor también.

Para jugar solo contra bots, tocá **🤖 Jugar con bots**: crea una sala con bots y la empieza enseguida (ver [Bots](#bots)).

## Bots

Los bots completan la sala hasta un total de jugadores: si en la sala hay 3 personas y elegís 12, entran 9 bots. Se juega igual solo o con amigos.

- **Dónde se eligen.** En la sala, el anfitrión elige *Completar la sala hasta* (sin bots, 4, 8, 12, 16, 20 o 24 jugadores) y la *Dificultad* (Fácil, Normal o Difícil); los demás ven lo elegido y la lista muestra cuántos bots van a entrar. En **Configuración → Juego** quedan guardados para las salas que crees. El botón **🤖 Jugar con bots** del menú usa esa configuración (con "Sin bots", 12 jugadores) y arranca la partida directo.
- **Qué hacen.** Son jugadores que maneja el servidor, con la misma física, vida, escudo e inventario que vos, y se llaman "Bot" + un animal (Bot Carpincho, Bot Tero…). Eligen dónde caer y saltan del bus cuando les queda cerca, planean y abren el paracaídas, buscan armas, munición, curas y cofres caminando por las calles, entrando por las puertas y subiendo escaleras, pican árboles para tener madera, se curan cuando están tranquilos y escapan de la tormenta. Cuando ven a alguien (las paredes y las construcciones les tapan la vista; los vidrios no), reaccionan, eligen el arma según la distancia, se mueven de costado y saltan; si les tiran, a veces levantan una pared (y en difícil una rampa), y si una construcción tapa al enemigo le tiran a la construcción. Se pelean también entre ellos.
- **Dificultad.** Cambia cuánto ven (45, 70 o 100 m), cuánto tardan en reaccionar, la puntería y los tiros a la cabeza, cuánto construyen y si persiguen al que se les escapó.
- **Fin de la partida.** Si quedás último, ganás. Si ya no queda ninguna persona viva, la partida termina a los pocos segundos y vuelve a la sala ("Quedaban N bots en pie").

Para mirar una partida solo de bots: `SF_BOTS_HASTA_EL_FINAL=1 npm start` sigue la partida hasta el final aunque ya no quede nadie vivo (podés mirarla como espectador), y `SF_BOTS_DEBUG=1` muestra en la consola qué hace cada bot cada 10 segundos. Las pruebas:

```bash
node tools/bots/pruebas.mjs      # rutas, llegar caminando a los cofres, salir de pisos altos
node tools/bots/partida.mjs      # una partida entera solo con bots (12 jugadores, normal; acepta total, dificultad y segundos)
```

## El mapa

Una isla fija de 1200 × 1200 m, la misma en todas las partidas, con todas las estructuras y el terreno modelados en 3D:

| Pueblo | Cómo es |
|---|---|
| **Altoplaza** (centro) | Ciudad con edificios de varios pisos, locales con toldo, plaza con fuente y veredas |
| **Villa Cardo** (oeste) | Barrio de casas con jardín, cercas y cobertizos |
| **Puerto Bruma** (sur) | Malecón, galpones, contenedores, grúa, muelles, botes y faro |
| **Granja Los Álamos** (este) | Granero con altillo, silos, molino, tanque de agua y campos sembrados |
| **Médanos** (este, desierto) | Casas de adobe con terraza y mercado |
| **Parque Remolino** (sureste) | Rueda de la fortuna, calesita, montaña rusa y kioscos |
| **Palafitos** (suroeste) | Casas sobre pilotes en la ciénaga, unidas por pasarelas |
| **Cantera Roja** (noroeste) | Pozo escalonado de roca roja con tolva, andamio y contenedores |
| **Refugio Nevado** (montaña) | Lodge y cabañas en la nieve, con teleférico hasta la cumbre |
| **Observatorio Cumbre** (norte) | Cúpula con telescopio, laboratorios y antena sobre un cerro |

Entre los pueblos hay rutas con postes de luz, caminos de tierra, un río con puentes, indicadores de caminos y más de 40 lugares chicos con un poco de loot (estación de servicio, torres de vigía, capilla en ruinas, camping, cobertizos, ruinas...). El agua tiene olas, cambia de color con la profundidad y hace espuma en la orilla.

**Caminos prolijos.** Todas las calles y rutas forman una sola red: ninguna se corta de golpe. Cada punta llega a otra calle (en los cruces la que sigue de largo queda arriba, y las puntas y las esquinas se redondean, sin huecos en forma de cuña) o termina en un remate: una rotonda, un playón, un estacionamiento o la puerta de una estructura. El terreno debajo de las calles se alisa para que el pasto no asome en los cruces.

![Villa Cardo: rotonda al final de la calle, esquinas redondeadas y el camino de tierra que sale hacia la montaña](docs/mapa_caminos.jpg)

**Todo se rompe.** Cada estructura del mapa está armada en piezas (tramos de pared, baldosas de piso, aguas del techo, escaleras, muebles, tramos de muelle y de puente) que se rompen con el pico, a tiros y con explosiones. Cada pieza es de madera, piedra o metal y su vida depende del material y del tamaño. Cuando se rompe lo que sostiene algo, lo que queda en el aire se cae, y el loot y los cofres que estaban encima bajan al piso nuevo. Los cimientos, el malecón, los postes de luz, los carteles y las torres del teleférico no se rompen.

Sin errores de colisión: las puertas quedan al ras del piso, no se atraviesan techos ni pisos aunque se caiga rápido, todas las escaleras se suben (con baranda sólida), las ventanas tienen vidrio que frena al jugador pero deja pasar las balas, los puentes siguen la pendiente de las dos orillas y todo el loot se alcanza caminando. Lo revisan las pruebas automáticas:

```bash
node tools/mapa/pruebas.mjs
```

Además de las colisiones, las pruebas revisan lo que se ve: caras al revés, partes que se atraviesan sin chocar, pisos falsos, caras que titilan (dos superficies en el mismo plano), estructuras metidas en otras, en el terreno o en las calles, piezas sin apoyo y que los derrumbes tiren lo que tienen que tirar. También revisan los caminos (`tools/mapa/caminos.mjs`): que ninguna calle se corte de golpe ni quede con un hueco antes de otra, que toda la red esté unida, que las plazoletas no pisen estructuras y que el terreno no asome por arriba de las calles. Con `TODAS=1` lista todas las caras que titilan en vez de las primeras.

Para recorrer la isla sin jugar, con el servidor levantado abrí http://localhost:3000/mapa.html (arrastrá para girar, rueda para acercar, WASD para moverte).

## Mecánicas

- **Bus volador.** El bus es un colectivo de línea retro de dos tonos con ala alta sobre el techo, dos motores con hélices que giran, cola en cruz, portaequipajes con valijas, cartel de destino iluminado, baliza que destella y reflejos en el cromo y los vidrios.
- **Caída libre con control.** Yendo adelante con la mirada al horizonte se **planea**: cae lento (24 m/s) y llega lejos (unos 200 m desde el bus). Mirando abajo se va en **picada**: cae rápido (72 m/s) pero casi no avanza. En el medio se mezcla de a poco, y al doblar el cuerpo se ladea hacia la curva.
- **Paracaídas.** Se abre y se cierra con la tecla de saltar mientras estés a más de **80 m** del piso (o del agua). Si bajás de esa altura se abre solo y ya no se puede cerrar. Abierto avanza más rápido con adelante (21 m/s), frena con atrás (y cae más despacio) y se mueve de costado con A/D; tirar de un freno baja ese lado de la vela y el cuerpo se inclina. Sale arrugado y se infla al abrirse, y al tocar el piso el personaje amortigua con las rodillas.
- **Deslizarse.** Corriendo, **Ctrl** te tira al piso con un impulso: en el plano recorre unos 16 m, en bajada acelera y sigue, en subida frena. Se puede doblar un poco, saltar en medio sin perder velocidad y disparar mientras te deslizás.
- **Autos.** 14 autos estacionados en las calles de los pueblos y en las rutas (hatchback modelado en Blender, cada uno de su color). Se suben hasta cuatro: conductor, acompañante y dos atrás. Aceleran fuerte, frenan, doblan menos cuanto más rápido van, derrapan con el freno de mano y tienen **turbo** (3 s, se recarga solo). Suben y bajan con el terreno, saltan en los lomos, chocan contra casas, árboles, construcciones y otros autos, y no entran al agua honda. **Según la velocidad rompen o no lo que chocan**: despacio rebotan sin dañar nada; más rápido dañan lo que chocan (se ven las grietas) y, si el golpe alcanza, lo rompen y siguen de largo, más lentos y un poco dañados según lo que rompieron. Con vida llena: madera desde 45 km/h, árboles desde 55 km/h (los gruesos aguantan más), piedra casi a fondo (89 km/h), metal solo con turbo; las rocas, los postes y lo fijo del mapa los frenan siempre. Lo que ya está dañado se rompe más fácil. Lo decide el servidor y lo ven todos; los números están en la tabla `EMBESTIDA` de `public/js/autos.js`. Un choque fuerte los abolla; a las 800 de vida explotan. Atropellar a alguien rápido le hace daño y lo empuja. Se les puede disparar y pegar con el pico (dan metal), y uno se puede parar arriba. Al bajarse se sale por la propia puerta (o por donde haya lugar) con parte del envión, y el auto sigue solo hasta frenar. Adentro: cámara de persecución, velocímetro, vida del auto, turbo, sonido de motor, derrape y bocina, y el conductor con las manos en el volante, que gira con la dirección.
- **Loot** en el piso y en **cofres**, con cinco rarezas (común, poco común, rara, épica y legendaria) que suben el daño y bajan el tiempo de recarga.
  - Cofre modelado en Blender (tablas, herrajes dorados, cerradura, manijas, tapa con bisagra e interior que brilla). Cerrado tiene un aura dorada que late y motas que suben; al abrirlo la tapa salta con rebote, sale una ráfaga de chispas y el loot sale volando del cofre hasta el piso. Cada cofre mira hacia el lado con más lugar libre (no queda con la cerradura contra la pared).
  - Objetos del piso modelados uno por uno: vendas, botiquín, frasco y bidón de escudo (vidrio con líquido que brilla), una caja por tipo de munición (con la franja del color de la munición y balas arriba), cohete, y pilas de madera, piedra y metal. Flotan y giran despacio sobre un anillo del color del objeto; las armas suman un haz de luz más alto y chispas más numerosas cuanto más rara es el arma.
  - Para verlo todo junto: `/loot.html` (vitrina del loot).
  - **El loot no atraviesa paredes.** Lo que sale de un cofre, lo que soltás y lo que deja alguien al morir sale para los lados que estén libres y frena antes de las paredes, ventanas, muebles altos, construcciones, árboles y rocas: un cofre contra la pared nunca tira cosas al cuarto de al lado ni afuera de la casa. Si sale por el borde de un balcón o una escalera cae al piso de abajo, y en el agua queda flotando. Si alguien construye una pared encima de un objeto, el objeto sale para su lado; si un piso o una rampa lo atraviesa, queda arriba; si se rompe lo que tenía abajo, cae. El salto desde el cofre tampoco pasa techos bajos. Las pruebas: `node tools/loot/pruebas.mjs` (con el reparto de antes, 1164 de 2640 objetos de los cofres del mapa salían del otro lado de una pared; ahora ninguno).
- **Armas:** pistola, subfusil, rifle de asalto, escopeta, francotirador con mira y lanzacohetes con daño en área. Cada una usa su tipo de munición. Cada arma tiene su propio retroceso al disparar (sube, patea y se corre hacia atrás) y sus recargas animadas, revisadas para que el arma no atraviese el cuerpo.
- **Personaje animado** con esqueleto: camina, trota, corre y esprinta mezclando los ciclos según la velocidad, con los brazos al costado del cuerpo (sin meterse en la cadera, el cinturón ni el chaleco) y el pico sostenido al costado mientras corre.
- **Inventario** con 5 slots y el pico fijo. Cada lugar muestra la **foto del arma u objeto**, sacada al cargar el juego del mismo modelo 3D que se ve en la mano (con la franja del color de la rareza), sobre el fondo de su rareza, con la munición o la cantidad arriba. A la izquierda de la barra se lee el nombre de lo que tenés en la mano y, si es un arma, su rareza. Las pruebas (necesitan Playwright): `node tools/iconos/pruebas.mjs` (con `CAPTURAS=carpeta` guarda una hoja con todas las fotos).

  ![Barra de items con la foto de cada arma y objeto, y el nombre del arma en la mano](docs/barra_iconos.jpg)

- **Pico:** saca madera de los árboles y piedra de las rocas, y rompe cualquier estructura del mapa dando el material de la pieza (madera, piedra o metal, el doble en el golpe que la rompe). Los árboles, las rocas y las estructuras se rompen.
- **Daño visible y golpes críticos:** las paredes, pisos, techos y demás piezas del mapa, y las construcciones, se van agrietando y oscureciendo a medida que pierden vida (lo ven todos en la sala). Debajo de la mira aparece la barra de vida de lo que golpeás o mirás con el pico, con la parte recién perdida en blanco. Al picar una estructura, un árbol o una roca aparece un **punto débil** (círculo celeste) cerca del golpe: pegarle ahí es un crítico que hace el doble de daño (100 en vez de 50), con número celeste, destello y sonido propio, y el punto se mueve a otro lado. Si le pegás a otro lado el punto se queda; si dejás de picar 6 s, se va.
- **Construcción** (ver abajo): pared, piso, rampa y techo en una grilla de 4 m, en madera, piedra o metal, que se pueden editar.
- **Escudo y curación:** vendas, botiquín, frasco azul y bidón azul.
- Al morir, el jugador tira todo lo que tenía. También hay daño por caída, tormenta por fases, números de daño, minimapa, killfeed, chat, modo espectador y sonidos sintetizados.

## Construcción

Como en los battle royale del género:

- **Cuatro piezas:** pared, piso, rampa y techo (una pirámide baja). Cada una cuesta 10 del material. Arriba del inventario está la barra con las cuatro piezas y la tecla de cada una, y el material que estás usando con cuánto te queda.
- **Grilla de encastre:** todas las piezas van en una grilla de celdas de 4 × 4 × 4 m, y cada una tiene que arrancar donde termina otra, como en el juego original. Las paredes van en los lados de una celda, los pisos en su cara de abajo, y la rampa o el techo (uno de los dos) adentro. Un piso solo se puede poner en el suelo, en el borde de arriba (o de abajo) de una pared, en el borde alto o bajo de una rampa o pegado al borde de otro piso; nunca a media pared. El techo va arriba de un piso o de paredes; las paredes, una arriba de otra o de costado. Dos piezas se sostienen cuando comparten un borde entero de la grilla (tocarse en una punta no alcanza), y todo lo que se arma cerca de una construcción queda en su misma grilla de altura. El servidor revisa las mismas reglas, así que un cliente tramposo no puede meter piezas corridas.
- **Vista previa:** la pieza aparece como un holograma azul donde va a ir, y en rojo si no se puede, con el motivo en la ayuda de construcción (no encaja con la grilla de al lado, no tiene apoyo o no alcanza el material). Se ubica sola según hacia dónde mirás: la pared en el borde de tu celda, el piso adelante (mirando arriba, sobre tu cabeza; mirando abajo, bajo los pies), la rampa adelante subiendo hacia donde mirás (R la gira) y el techo adelante o sobre tu cabeza. Parado en una rampa, la pieza de adelante va un nivel más arriba, así se sube construyendo rampas seguidas. Manteniendo el clic se construye seguido.
- **Se levantan de a poco:** la pieza aparece en holograma y se va llenando de abajo hacia arriba; arranca con el 30 % de su vida y llega al máximo cuando termina (madera 150 en 2,5 s, piedra 300 en 5 s, metal 450 en 7,5 s). Apuntando a una construcción se ve su vida debajo de la mira, y las dañadas se ven agrietadas.
- **Apoyo y derrumbes:** una pieza nueva tiene que apoyarse en el suelo o en una estructura del mapa, o compartir un borde con otra construcción. Si se rompe lo que sostiene algo (una pieza tuya o una pieza del mapa), todo lo que deja de llegar al piso pasando de borde en borde se cae.
- **Para construir rápido** (opciones en la pestaña Juego de la configuración): *Confirmar la edición al soltar la tecla* (prendida de fábrica: mantenés F, marcás y al soltar se confirma; un toque corto deja la edición abierta como antes), *Construir seguido manteniendo el clic* (prendida) y *Volver a la pared al entrar a construir* (apagada: Q vuelve a la última pieza). Si una rampa o un piso aparece donde estás parado, te sube arriba en vez de dejarte adentro.
- **Edición** (F mirando una construcción tuya): aparece la grilla de la pieza y se marcan baldosas con clic (manteniendo apretado se marcan varias). F otra vez (o soltar F, si la mantuviste) confirma; clic derecho la deja como nueva. Una pieza editada sigue sosteniendo lo que tiene arriba.
  - Pared (3×3): lo marcado se saca. Así se hacen puertas, ventanas, arcos o media pared, y se puede pasar y disparar por el hueco.
  - Piso (2×2): lo marcado se saca y se cae por el hueco.
  - Rampa (3×3, vista desde arriba): se arrastra en la dirección en que tiene que subir, y si marcás solo una o dos columnas queda una rampa angosta.
  - Techo (2×2): las esquinas marcadas se levantan (una esquina, medio techo inclinado, o las cuatro para un techo plano alto).
- **Material automático:** si se te termina el material elegido, pasa solo al siguiente que alcance para una pieza. Con clic derecho en modo construcción se cambia a mano.
- Las piezas nuevas no se pueden poner cayendo ni planeando. Los pisos, rampas y techos de construcción hacen de techo: saltando abajo no se atraviesan.

Las pruebas de la construcción (choques con las piezas editadas, que lo que se ve coincida con lo que se pisa, la grilla de encastre, apoyo, derrumbes y vida) y las del servidor rechazando piezas mal puestas por red:

```bash
node tools/construccion/pruebas.mjs
node tools/construccion/red.mjs
CAPTURAS=capturas node tools/construccion/capturas.mjs   # fotos del encastre en el juego (Playwright)
```

Para probar a construir sin juntar materiales: `SF_MATS=500 npm start` arranca cada partida con 500 de cada material.

## Controles

Estas son las teclas de fábrica. **Todas se pueden cambiar** desde **⚙ Configuración** (botón en el menú, en la sala de espera, o Esc durante la partida): cada acción tiene una tecla principal y una secundaria, y sirven también los botones y la rueda del mouse.

| Tecla | Acción |
|---|---|
| WASD o flechas | Moverse |
| Shift | Correr |
| Espacio | Saltar del bus / abrir y cerrar el paracaídas / saltar |
| Ctrl | Deslizarse (corriendo) |
| Clic izquierdo | Disparar, usar el pico, usar un consumible o construir |
| Clic derecho | Apuntar (con el francotirador, mira telescópica). En modo construcción cambia el material y editando deja la pieza como nueva |
| E | Agarrar objeto / abrir cofre / subir al auto |
| R | Recargar (en modo construcción, girar la rampa) |
| 1 a 6 o rueda | Pico y slots |
| Z / X / C / V | Construir pared / piso / rampa / techo |
| Q | Entrar y salir del modo construcción |
| F | Editar la construcción que mirás / confirmar la edición |
| G | Tirar el objeto que tenés en la mano |
| B | Bailar |
| Enter | Chat |
| Esc | Soltar el mouse / abrir la configuración |

En el auto:

| Tecla | Acción |
|---|---|
| W / S (o ↑ / ↓) | Acelerar / frenar y marcha atrás |
| A / D (o ← / →) | Doblar |
| Espacio | Freno de mano (derrapar) |
| Shift | Turbo |
| F | Cambiar de asiento |
| Clic izquierdo o H | Bocina |
| E | Bajarse |

En pantalla no hay una lista de controles: en el auto aparece una ayuda corta con sus teclas arriba del velocímetro, y en modo construcción o editando aparece, arriba de la barra de piezas, una ayuda corta con las teclas de construcción. Los carteles del juego (esa ayuda, números de los slots, "Apretá … para saltar del bus", "E Abrir cofre", barra de construcción) muestran la tecla que tenga asignada cada jugador.

## Configuración

El panel tiene cuatro pestañas y todo se guarda en el navegador (`localStorage`), así que queda para la próxima vez:

- **Juego:** sensibilidad del mouse, sensibilidad apuntando y con mira telescópica, invertir el eje vertical, apuntar manteniendo o alternando, correr siempre, números de daño, las opciones de construcción (confirmar la edición al soltar, construir seguido, volver a la pared al entrar a construir), y los bots de las salas que crees (hasta cuántos jugadores completan y su dificultad).
- **Video:** calidad gráfica (baja sin sombras, media y alta), resolución 3D, campo de visión, color de la mira y contador de FPS.
- **Sonido:** volumen general.
- **Controles:** cambiar cualquier tecla. Si elegís una que ya usaba otra acción, se la saca a esa y te avisa. Una tecla puede repetirse entre combate y construcción (por ejemplo, R recarga y en modo construcción gira la rampa) porque no se usan a la vez. Lo mismo con los controles del auto (grupo *Vehículos*): solo valen sentado en un auto, así que repiten las de a pie.

Las pruebas del registro de controles y opciones:

```bash
node tools/controles/pruebas.mjs
```

## Estructura

- `server.js`: servidor HTTP + WebSocket. Maneja salas por código, el recorrido del bus, la tormenta, la vida, el daño, las piezas del mapa que se rompen, los bots y quién gana.
- `servidor/bots.js`: los bots (solo corren en el servidor): salto del bus, caída, loot, pelea, construcción, curación y tormenta. Sus acciones pasan por el mismo `handleGame` que las de los jugadores.
- `servidor/navegacion.js`: grillas de lugares donde se puede estar parado (terreno, pisos, escaleras, techos, agua) y rutas por ellas, para que los bots caminen por el mapa.
- `public/js/opcionesBots.js`: totales y dificultades de los bots, compartido por el servidor, la sala y Configuración.
- `tools/bots/`: pruebas de los bots (`pruebas.mjs`) y una partida entera solo con bots (`partida.mjs`).
- `public/js/world.js`: arma la isla (terreno, pueblos, rutas, río, árboles, rocas, cofres y agua) igual en el servidor y en todos los clientes, y mueve al jugador contra el mapa en pasos chicos (piso, techo y paredes).
- `public/js/isla.js`: diseño de la isla: pueblos con sus calles y estructuras, rutas (con el remate de cada punta que no llega a otra calle), río, teleférico y lugares chicos entre pueblos.
- `public/js/planos.js`: planos de todas las estructuras (casas, edificios, faro, grúa, granero, cúpula, etc.). De la misma lista de piezas salen lo que se ve, lo que choca y las piezas que se rompen.
- `public/js/colision.js`: sólidos del mapa (cajas, rampas y cilindros) en una grilla espacial.
- `public/js/mallas.js`: junta las estructuras en pocas mallas y les dibuja texturas procedurales (ladrillo, tablas, tejas, chapa, adobe...).
- `public/mapa.html`: visor del mapa (`/mapa.html`).
- `tools/mapa/pruebas.mjs`: pruebas automáticas del mapa (colisiones, loot alcanzable, las pruebas visuales de `tools/mapa/visuales.mjs` y la de caminos de `tools/mapa/caminos.mjs`).
- `public/js/autos.js`: los autos, compartido por el cliente y el servidor: medidas, asientos, física de manejo (motor, frenos, dirección, derrape, turbo, ruedas contra el piso), choques, qué rompen según la velocidad (tabla `EMBESTIDA` e `impacto`), dónde pega un disparo, dónde se baja cada uno y el estado que viaja por la red.
- `public/js/manejar.js`: los autos en el juego: mallas, manejar el propio, ver los de los demás, subir, bajar y cambiar de asiento, gente sentada, atropellos, HUD, minimapa y sonidos.
- `tools/autos/pruebas.mjs`: pruebas de los autos (lugares de salida libres, manejar desde cada uno sin meterse en nada, choque contra una casa, agua, dos autos, techo, balas, bajarse y red): `node tools/autos/pruebas.mjs`. `tools/autos/embestidas.mjs` (a qué velocidad se rompe cada material y la física de atravesar o rebotar) y `tools/autos/servidor.mjs` (las embestidas contra el servidor: velocidad que no se puede mentir, cosas lejos, el que no maneja, árboles y rocas): `node tools/autos/embestidas.mjs` y `node tools/autos/servidor.mjs`.
- `public/js/items.js`: armas, rarezas, munición, consumibles y materiales, y el punto débil del pico (`PUNTO_DEBIL`) (lo usan el cliente y el servidor).
- `public/js/golpes.js`: daño visible en el cliente: grietas encima de las piezas dañadas (shader procedural), barra de vida de lo que golpeás o mirás y el punto débil del pico (círculo, crítico, número, aro y sonido). El servidor elige el punto débil y decide si un golpe fue crítico.
- `tools/golpes/pruebas.mjs`: pruebas del punto débil y la vida de lo dañado contra el servidor de verdad (por WebSocket): `node tools/golpes/pruebas.mjs`.
- `public/js/audio.js`: efectos de sonido sintetizados.
- `public/models/*.glb`: modelos 3D hechos en Blender (personaje, bus volador, auto, paracaídas, armas y pico, pino, árbol, roca, cofre y objetos del piso). El color de la ropa y de las rarezas se tiñe en el juego.
- `public/js/loot.js`: objetos del piso y cofres en el juego, con sus efectos (anillo, haz y chispas por rareza, aura del cofre, apertura animada y loot que sale volando). `public/loot.html`: vitrina del loot (`/loot.html`).
- `public/js/lugarLoot.js`: dónde cae el loot sin atravesar paredes (compartido por el servidor, el cliente y las pruebas): reparte lo que sale de un cofre o de un jugador, acomoda lo que tapa una construcción nueva y deja caer lo que quedó en el aire. `tools/loot/pruebas.mjs`: sus pruebas (`node tools/loot/pruebas.mjs`).
- `public/js/assets.js`: carga los GLB. Si alguno no carga, el juego usa los modelos procedurales de `models.js`.
- `public/js/models.js`: arma los personajes, el bus, el paracaídas, las armas y los objetos del piso a partir de los GLB. Si un GLB no carga, usa modelos low-poly hechos con primitivas como respaldo.
- `public/js/rig.js`: anima el personaje con su esqueleto (capas de piernas, torso y brazo izquierdo, mezcla de locomoción, poses de armas, recargas, bombeo y retroceso por arma, caída libre, paracaídas, aterrizaje y deslizarse). Cuelga el paracaídas de los hombros, lo abre con la vela inflándose, baja los frenos y dibuja sus cuerdas hasta las manos. Después dobla la columna para mirar y apuntar adonde va la cámara, con topes para que los brazos no se metan en el cuerpo.
- `public/visor.html`: visor del personaje para revisar sus animaciones (`/visor.html`), con controles para la caída (planeo / picada), el paracaídas (giro y freno), aterrizar y deslizarse.
- `tools/blender/`: scripts de Blender que generan el personaje (`heroe_*.py`; `heroe_caida.py` hace los clips de caída, paracaídas, aterrizaje y deslizarse sobre el esqueleto que trae `heroe_importar.py` del GLB del juego), el paracaídas (`paracaidas.py`), las armas (`armas_*.py`), el bus volador (`bus.py`) y sus animaciones, el auto (`auto.py`), y el cofre y los objetos del piso (`loot_modelos.py`, `loot_export.py`). `heroe_reemplazar_clips.mjs` cambia solo algunos clips del personaje sin tocar el resto del GLB. `recargas_control.py`, `armas_choque.py` y `brazos_choque.py` revisan las animaciones sin renderizar (brazos, saltos entre cuadros, cuánto se mete el arma en el cuerpo y cuánto se meten los brazos y las manos en el cuerpo con las mismas mezclas del juego, mirando derecho, abajo y arriba). `tools/texturas/`: máscaras de la cara y el tatuaje.
- `Vault/`: vault de Obsidian que documenta el proyecto (empezar por `Vault/Inicio.md`) y grafo del código generado con graphify en `Vault/graphify-out`.
- `public/js/caida.js`: física de la caída libre (planeo / picada), el paracaídas (altura límite, frenos) y el deslizamiento, y los parámetros de animación que viajan por la red. Pruebas: `node tools/caida/pruebas.mjs`.
- `public/js/main.js`: el juego en sí (cámara en tercera persona, física, disparo, HUD, minimapa, red).
- `public/js/construccion.js`: reglas de la construcción, compartidas por el cliente y el servidor: grilla de encastre (bordes de cada pieza, qué va donde, dónde cae la vista previa), ediciones válidas, superficie que se pisa y cajas que chocan de cada pieza editada, apoyo, derrumbes, vida que crece y qué baldosa se mira al editar.
- `public/js/construccion3d.js`: mallas de las construcciones (texturas de tablas, bloques de piedra y chapa con remaches, marcos que rodean también los huecos editados), holograma de la vista previa, grilla de edición y el relleno de la pieza mientras se levanta.
- `public/js/construir.js`: la construcción en el juego: modo construcción, dónde va cada pieza, colocar seguido, edición, material automático y la barra de piezas del HUD (la vida de lo que se mira la muestra `golpes.js`). Registra sus controles en `controles.js`.
- `tools/construccion/pruebas.mjs`: pruebas de la construcción. `tools/construccion/red.mjs`: el servidor rechaza piezas que no encajan.
- `public/js/controles.js`: registro central de acciones y teclas (con contexto: siempre, combate, construcción o vehículo) y de las opciones del juego, guardados en `localStorage`. Cualquier control u opción nueva se agrega acá con `registrarAccion` / `registrarOpcion`.
- `public/js/configuracion.js`: el panel de configuración (pestañas Juego, Video, Sonido y Controles).
- `tools/controles/pruebas.mjs`: pruebas del registro de controles y opciones.

## Capturas

![Golpe crítico en el punto débil: 100 de daño, chispas celestes y la barra de vida de la pared](docs/golpes_critico.jpg)
![Paredes con distinto daño: las grietas se abren a medida que pierden vida](docs/golpes_grietas.jpg)
![Bus volador desde el juego](docs/bus.png)
![Bus volador renderizado en Blender](docs/bus_blender.jpg)
![Combate](docs/combate.png)
![Piezas de construcción en madera, piedra y metal, editadas](docs/construccion.png)
![Editando una pared: la grilla de 3×3](docs/construccion_edicion.png)
![La puerta hecha y la barra de piezas arriba del inventario](docs/construccion_puerta.png)
![Grilla de encastre: la rampa que sube hasta el borde del piso de arriba encaja (azul)](docs/encastre_encaja.png)
![Un piso sin nada que lo sostenga: rojo, con el motivo en la ayuda](docs/encastre_no_encaja.png)
![Parado en la rampa: el piso de adelante va en su borde alto](docs/encastre_piso_rampa.png)
![Personajes](docs/personajes.png)

### Bots

![La sala con bots: completar hasta N jugadores y dificultad](docs/bots_sala.jpg)
![Mirando a un bot (Bot Tero, con francotirador) después de morir](docs/bots_partida.jpg)

### Loot

![Cofres y loot del piso por rareza](docs/loot_vitrina.jpg)
![Cofre en una casa](docs/loot_cofre_casa.jpg)
![Cofre abierto con su loot](docs/loot_cofre_abierto.jpg)

### Autos

![Auto renderizado en Blender](docs/auto_blender.jpg)
![El conductor con las manos en el volante](docs/auto_conductor.jpg)
![Conductor y acompañante](docs/auto_acompanante.jpg)

### Caída, paracaídas y deslizarse

![Caída libre planeando](docs/caida_libre.jpg)
![Paracaídas abierto](docs/paracaidas.jpg)
![Deslizándose](docs/deslizarse.jpg)

### La isla

![Mapa de la isla con los 10 pueblos](docs/mapa_minimapa.png)
![Altoplaza desde el aire](docs/mapa_altoplaza.jpg)
![Calle de Altoplaza a la altura de un jugador](docs/mapa_calle.jpg)
![Puerto Bruma con el faro, la grúa y los muelles](docs/mapa_puerto.jpg)
![Refugio Nevado y el teleférico](docs/mapa_montana.jpg)
![Parque Remolino con la vuelta al mundo y la montaña rusa](docs/mapa_parque.jpg)
