# Autos funcionales

Volver a [[Índice de memoria]] · resultado en [[Autos]], [[autos.js]], [[manejar.js]] y [[Pipeline del auto]]

**2026-11-26 · Rafael**

Pidió: "Hace autos funcionales". El coordinador lo interpretó como: autos que se manejen en el mapa, con modelo 3D hecho en Blender al estilo del juego, subir y bajar con una tecla, acelerar, frenar y doblar, choques con casas y árboles, sincronizados en multijugador por el servidor, asientos de acompañante si es simple y que aparezcan en las calles. La tecla tenía que ir al panel de configuración y a la ayuda simple.

**2026-11-26 · Claude (al hacer ese pedido)**

- Los 14 autos que ya estaban en [[isla.js]] como decoración (cajas de [[planos.js]]) pasaron a ser autos de verdad, en los mismos lugares y colores. El de la Granja Los Álamos se corrió a la calle porque salía encima de un árbol.
- Teclas de fábrica: E subir y bajarse (la misma de agarrar), W A S D manejar, Espacio freno de mano, Shift turbo, F cambiar de asiento, clic izquierdo o H bocina. Son un contexto aparte (`vehiculo`), así que repiten las de a pie sin chocar.
- Cuatro asientos. El que maneja simula el auto (como el jugador simula su personaje); el servidor decide asientos, daño y explosiones.
- Se agregó turbo, atropellos, daño y explosión, y que se les pueda disparar y picar (dan metal), como en el género.
- Desde el auto todavía no se dispara (ni el conductor ni los acompañantes).

**2026-11-26 · Rafael**

"Pq no andan los autos ?"

**2026-11-26 · Claude (al revisarlo)**

- En una instalación limpia de `main` (con los bots y el daño nuevos) los autos andan: subir con E, manejar con WASD, doblar y bajarse, probado con teclas reales.
- Lo que hace exactamente ese síntoma (*E Manejar* aparece pero no pasa nada) es tener el servidor prendido desde antes del `git pull`: sirve los archivos nuevos pero corre la lógica vieja. Se reprodujo así.
- Arreglo: el servidor avisa cuando su código quedó viejo (cartel en el juego y consola), no deja cachear los archivos, explica por qué no se puede subir (`autoNo`) y el cliente avisa si no hay respuesta. El README dice que hay que reiniciar el servidor después de cada `git pull`.
