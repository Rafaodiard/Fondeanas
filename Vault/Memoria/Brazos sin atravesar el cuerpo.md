# Brazos sin atravesar el cuerpo

Volver a [[Índice de memoria]] · cómo se revisa en [[Pipeline del héroe]] · en el juego: [[rig.js]]

**2026-11-25 · Rafael**

Pidió arreglar las animaciones del personaje para que los brazos no atraviesen el cuerpo.

**2026-11-25 · Claude (al hacer ese pedido)**

- Cada cambio de animación del héroe (clips, recargas o cómo [[rig.js]] dobla la columna) se revisa con `brazos_choque.py`: con las mismas mezclas del juego, mirando derecho, abajo y arriba, y en todo el recorrido de la mira.
- Tolerancia: 1,5 cm (`LIMITE`). La axila apretada da 0,6-1 cm en cualquier pose y no se ve. Los dedos que tocan los bolsillos del chaleco al agarrar un cargador llegan a 1,2-1,5 cm.
- Sin arma y mirando abajo, los brazos cuelgan (no siguen al pecho). Con arma, la columna se dobla con tope en vez de seguir la mira sin límite.
