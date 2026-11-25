# configuracion.js

Volver a [[Inicio]] · ver [[Configuración y controles]]

Archivo: `public/js/configuracion.js`. El panel de configuración: arma su propio HTML (`#config`) la primera vez que se abre y lee/escribe todo en [[controles.js]].

- Pestañas **Juego**, **Video**, **Sonido** (una fila por opción de ese grupo: deslizador, interruptor o botones) y **Controles** (las acciones por grupo, con botón de tecla principal y secundaria).
- Cambiar una tecla: clic en el botón y después cualquier tecla, botón del mouse o la rueda. Esc cancela y Supr la deja vacía. Si la tecla era de otra acción, se avisa abajo a cuál se le sacó.
- *Restablecer* vuelve a fábrica la pestaña abierta (en Controles, todas las teclas).
- `abrirConfig(cuandoCierra, pestaña)`, `cerrarConfig()`, `abierto()`. Se cierra con *Listo*, la ✕, Esc o clic afuera. [[main.js]] le pasa `cuandoCierra` para volver a capturar el mouse.
