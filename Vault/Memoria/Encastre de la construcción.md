# Encastre de la construcción

Volver a [[Índice de memoria]] · resultado en [[Construcción]] y [[construccion.js]] · pedido anterior: [[Construcción estilo Fortnite]]

**2026-11-26 · Rafael**

- "Arregla la construcción, quiero que se parezca más a la de Fortnite (…) no puede haber un piso en el medio de una pared, todos los elementos tiene que estar donde termina el otro, un piso solo se puede poner en el borde de arriba de una pared o de una escalera, un cono se puede poner arriba de un piso, etc, busca como es en el juego original".
- Después agregó: "también intenta agregar las funciones que tiene Fortnite que hacen más fluida la construcción y que hacen que se pueda operar de esa forma tan clean".

**2026-11-26 · Claude (al hacer ese pedido)**

- Referencia del original (documentación pública de Epic para UEFN): las piezas encajan en una grilla del mundo; pared de 512 × 384 cm, piso de 512 × 512, escalera y techo de 512 × 512 × 384. Acá se dejó la grilla de 4 × 4 × 4 m que ya tenía el juego (cambiar la altura de las paredes tocaba mallas, ediciones, bots y mapa).
- Regla: dos piezas se sostienen solo si comparten un borde entero de la grilla. Además de lo que dijo Rafael, como en el original, un piso también puede salir del borde de otro piso, del borde de abajo de una pared o apoyarse en el suelo. Rampa y techo no pueden estar en la misma celda.
- La altura no es una grilla fija del mundo (la isla no está hecha a la medida): lo nuevo se alinea a la grilla de la construcción más cercana, y lo que la toca fuera de esa grilla se rechaza. Valida igual el cliente (vista previa roja con el motivo) y el servidor.
- Se mantuvo el holograma azul (como el original) en vez de verde; rojo cuando no encaja.
- Funciones para construir fluido: confirmar la edición al soltar F (de fábrica prendido; un toque corto deja la edición abierta), construir seguido manteniendo el clic (prendido, se puede apagar), volver a la pared al entrar a construir (apagado) y que una rampa o piso que aparece donde estás parado te suba arriba. Ya estaban: material automático, Q recuerda la última pieza, restablecer la edición con clic derecho, construir saltando.
- No se hizo (queda para otro pedido): pre-edición (editar la pieza antes de ponerla).
