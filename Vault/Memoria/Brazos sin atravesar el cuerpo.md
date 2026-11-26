# Brazos sin atravesar el cuerpo

Volver a [[Índice de memoria]] · cómo se revisa en [[Pipeline del héroe]] · en el juego: [[rig.js]]

**2026-11-25 · Rafael**

Pidió arreglar las animaciones del personaje para que los brazos no atraviesen el cuerpo.

**2026-11-25 · Claude (al hacer ese pedido)**

- Cada cambio de animación del héroe (clips, recargas o cómo [[rig.js]] dobla la columna) se revisa con `brazos_choque.py`: con las mismas mezclas del juego, mirando derecho, abajo y arriba, y en todo el recorrido de la mira.
- Tolerancia: 1,5 cm (`LIMITE`). La axila apretada da 0,6-1 cm en cualquier pose y no se ve. Los dedos que tocan los bolsillos del chaleco al agarrar un cargador llegan a 1,2-1,5 cm.
- Sin arma y mirando abajo, los brazos cuelgan (no siguen al pecho). Con arma, la columna se dobla con tope en vez de seguir la mira sin límite.

**2026-11-26 · Rafael**

"Arreglá las animaciones de correr, que los brazos no atraviesen el cuerpo."

**2026-11-26 · Claude (al hacer ese pedido)**

- Lo que se veía: con la cámara del juego (de atrás) la mano que va hacia atrás en el trote, la carrera y el sprint cruzaba por detrás de la cola, casi en el centro, y el pulgar parecía meterse en el cinturón. `brazos_choque.py` daba menos de 1,5 cm porque la mano pasaba muy cerca pero por afuera. Además, con el pico en la mano y corriendo, el pico atravesaba la pierna y el torso.
- Arreglo: atrás la mano va al costado de la cadera, con el antebrazo girado (`giro_antebrazo`) para que se vea el dorso del guante ([[Pipeline del héroe]]); el pico se sostiene también al correr ([[rig.js]]).
- La animación de correr es la misma en cualquier dirección (el cuerpo mira adonde mira la cámara y las piernas corren hacia adelante), así que corriendo de costado, en diagonal o hacia atrás los brazos se mueven igual.
- Además de la medición, ahora se revisa con capturas desde atrás, como se ve en el juego.
