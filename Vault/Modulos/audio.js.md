# audio.js

Volver a [[Inicio]]

Archivo: `public/js/audio.js`. Efectos de sonido sintetizados con WebAudio, sin archivos de audio.

- `ac()` crea el `AudioContext` la primera vez.
- `noiseBuffer`, `burst` (ruido filtrado) y `tone` (tono con barrido) son los bloques base.
- `SHOTS`: sonido por arma. `sfx`: objeto exportado con los efectos que usa [[main.js]]. `sfx.critico()`: golpe de pico en el punto débil ([[golpes.js]]).
- `setVolumen(v)`: volumen general de 0 a 1 (ganancia maestra `0.35 × v`); lo llama [[main.js]] con la opción `volumen` de [[controles.js]].
- Sonidos en loop (`loop`, `nivelLoop`): ruido filtrado que se crea una vez y solo cambia el volumen. `sfx.viento(v)` (viento de la caída libre, más fuerte en picada) y `sfx.deslizar(v)` (roce al deslizarse). Además `sfx.deslizarInicio()` y `sfx.paracaidasCierra()`; abrir el paracaídas usa `sfx.glider()`.

## Autos (2026-11-26)

- `sfx.motor(v, rpm)`: dos osciladores (diente de sierra y cuadrada al doble) por un pasabajos; el tono y el filtro suben con `rpm`. Lo llama [[manejar.js]] cada cuadro: el auto propio a pleno, o el auto andando más cercano (hasta 50 m) más bajo.
- `sfx.derrape(v)` (loop), `sfx.bocina(dist)`, `sfx.choque(fuerza, dist)`, `sfx.puerta()`, `sfx.turbo()`.
