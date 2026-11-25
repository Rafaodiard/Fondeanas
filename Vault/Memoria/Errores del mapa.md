# Errores del mapa

Volver a [[Índice de memoria]] · resultado en [[Estructuras rompibles]] y [[Pruebas del mapa]]

**2026-11-25 · Rafael**

Después de probar el mapa nuevo: "lo probé y está lleno de bugs, como que desde abajo se puede ver a través del piso en la escalera y desde arriba no, se bugean los pisos y titilan, hay estructuras que no se rompen, etc. Buscá errores y arreglalos."

Qué se decidió a partir de eso:

- Todas las estructuras del mapa se rompen (pico, tiros y explosiones), pieza por pieza, y lo que queda sin apoyo se cae. Quedan fijos solo los cimientos, el malecón, los postes de luz, los carteles, los indicadores y las torres del teleférico.
- Las pruebas del mapa ahora también revisan lo que se ve (caras al revés, partes que se atraviesan, pisos falsos, caras que titilan, estructuras metidas en otras o en las calles y derrumbes), para que estos errores no vuelvan.
