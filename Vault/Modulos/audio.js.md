# audio.js

Volver a [[Inicio]]

Archivo: `public/js/audio.js`. Efectos de sonido sintetizados con WebAudio, sin archivos de audio.

- `ac()` crea el `AudioContext` la primera vez.
- `noiseBuffer`, `burst` (ruido filtrado) y `tone` (tono con barrido) son los bloques base.
- `SHOTS`: sonido por arma. `sfx`: objeto exportado con los efectos que usa [[main.js]].
