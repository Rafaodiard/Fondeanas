# audio.js

Volver a [[Inicio]]

Archivo: `public/js/audio.js`. Efectos de sonido sintetizados con WebAudio, sin archivos de audio.

- `ac()` crea el `AudioContext` la primera vez.
- `noiseBuffer`, `burst` (ruido filtrado) y `tone` (tono con barrido) son los bloques base.
- `SHOTS`: sonido por arma. `sfx`: objeto exportado con los efectos que usa [[main.js]].
- `setVolumen(v)`: volumen general de 0 a 1 (ganancia maestra `0.35 × v`); lo llama [[main.js]] con la opción `volumen` de [[controles.js]].
