# Autos

Volver a [[Inicio]] · código: [[autos.js]] (física y medidas, compartido), [[manejar.js]] (cliente), [[server.js]] (asientos y daño) · modelo: [[Pipeline del auto]] · pedido: [[Autos funcionales]]

Autos manejables estacionados en las calles. Se suben hasta cuatro jugadores (conductor, acompañante y dos atrás).

## Dónde salen

- Los lugares salen de las entradas `['auto', { m: color }, x, z, rot]` de [[isla.js]] (pueblos y `SUELTOS`): 14 autos. [[world.js]] (`place`) ya no arma el auto de cajas de [[planos.js]] (se borró): guarda `{ x, y, z, yaw, color }` en `world.autoSpawns`.
- El servidor crea `room.autos` al empezar la partida (`nuevoAuto`) y los manda en el snapshot (`autos`).
- `tools/autos/pruebas.mjs` revisa que ninguno salga metido en algo (el de la Granja Los Álamos se movió el 2026-11-26 porque salía encima de un árbol).

## Manejar

- **Subir**: al lado del auto aparece *E Manejar* (o *Subir al auto* si ya hay conductor). Se sube al primer asiento libre (el del conductor primero).
- **Teclas** (contexto `vehiculo`, cambiables en la configuración, grupo *Vehículos*): W / ↑ acelera, S / ↓ frena y da marcha atrás, A D / ← → doblan, Espacio freno de mano (derrapa), Shift turbo, E bajarse, F cambiar de asiento, clic izquierdo o H bocina. Las de a pie no andan en el auto y al revés.
- **Física** (`fisicaAuto`, pasos de 1/90 s): arcade, velocidad máxima 27 m/s (97 km/h), turbo hasta 36 m/s durante 3 s (se recarga en 7 s), freno fuerte, el freno de mano suelta el agarre de atrás para derrapar, la dirección dobla menos cuanto más rápido. Cuatro ruedas tocan el piso: el auto sube y baja con el terreno, cabecea y se ladea; salta en los lomos y cae.
- **Choques**: cinco círculos a lo largo del auto contra todo lo sólido del mapa, las construcciones y los otros autos (`world.collide`). Se puede pararse arriba del auto. No entra al agua honda ni sale del mapa.
- **Golpes**: un choque fuerte (más de 12 m/s perdidos) abolla el auto; a 800 de vida explota, lastima a los de adentro y alrededor y queda quemado.
- **Atropellar**: a más de 7 m/s pisar a alguien le hace daño (10 a 80 según la velocidad) y lo empuja.
- Se le puede disparar y pegar con el pico (da metal). Las balas pasan por las ventanillas.
- **Bajarse**: al costado de la propia puerta (o del otro lado, o adelante/atrás si está tapado; si no, por el techo), con parte del envión. El auto sigue solo, sin motor, hasta frenar.

## En pantalla

- Cámara atrás del auto, más lejos y con más ángulo de visión cuanto más rápido; vuelve sola atrás del auto si no se toca el mouse.
- HUD del auto: velocímetro en km/h, vida del auto, turbo y las teclas; se ocultan el inventario y los materiales.
- El personaje va sentado (pose de [[rig.js]]), el conductor con las manos en el volante, que gira con la dirección. Ruedas que giran y doblan, luces de freno, llama en los escapes con turbo y un sacudón al chocar.
- Sonidos ([[audio.js]]): motor que sube de tono con la velocidad (también el del auto andando más cercano), derrape, bocina, choque, puerta y turbo.
- En el minimapa cada auto es un rectángulo de su color.

## Si no andan

- **Servidor sin reiniciar después de un `git pull`** (2026-11-26, lo que le pasó a Rafael): el navegador recibe los archivos nuevos (el servidor los lee del disco en cada pedido) pero el servidor sigue con la lógica vieja, que no conoce `subir`. Se ve *E Manejar* y no pasa nada. Desde entonces el servidor avisa (cartel rojo `#avisoServidor` en el juego y un aviso en la consola, ver [[server.js]]) y el cliente, si pide subir y no hay respuesta en 2,5 s, dice que reinicien el servidor.
- Si el servidor no deja subir, manda `autoNo` con el motivo (`lleno`, `lejos`, `roto`, `estado`) y el juego lo muestra.

## Red

El que maneja simula su auto y manda `auto` 15 veces por segundo; el servidor lo valida (sin teletransportes) y lo reparte; los demás lo ven interpolado. Ver [[Protocolo de red]].
