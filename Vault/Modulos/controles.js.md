# controles.js

Volver a [[Inicio]] · ver [[Configuración y controles]]

Archivo: `public/js/controles.js`. Registro central de **acciones** (qué hace cada tecla) y de **opciones** del juego. No depende de nada; lo usan [[main.js]] y [[configuracion.js]]. Lo prueba `tools/controles/pruebas.mjs`.

## Acciones

- `registrarAccion(id, nombre, grupo, [principal, secundaria], contexto)`. Grupos: Movimiento, Combate, Inventario, Construcción, Otros. Contextos: `todos`, `combate`, `construccion`.
- Códigos: los de `KeyboardEvent.code`, `Mouse0`…`Mouse4` y `RuedaArriba` / `RuedaAbajo`. `Escape` está reservada (abre la configuración).
- `accionesDe(code, contexto)`: qué acciones dispara un código en el contexto actual. `activa(id)`: si alguna de sus teclas está apretada (`presionar` / `soltar` / `soltarTodo` llevan la cuenta).
- `asignar(id, lugar, code)`: pone la tecla y se la saca a las acciones que **chocan** (`chocan(a, b)`: mismo contexto o alguna en `todos`). Devuelve los nombres de las que perdieron la tecla.
- `teclaDe(id)` y `nombreTecla(code)`: nombres para mostrar ("Espacio", "Clic der.", "Rueda ↓"). `cargarDistribucion()` usa `navigator.keyboard.getLayoutMap()` (Chrome/Edge) para nombrar las teclas como están impresas en el teclado del jugador.
- Lo que cambia el jugador se guarda en `localStorage` (`sf-controles`, solo las acciones cambiadas). Una acción registrada tarde toma lo guardado; si no tiene nada guardado y su tecla de fábrica la eligió el jugador para otra acción, queda vacía.

Acciones de fábrica: `adelante`, `atras`, `izquierda`, `derecha`, `correr`, `saltar` (también abre y cierra el paracaídas), `deslizar` (Ctrl izquierdo, ver [[Deslizarse]]), `bailar`, `disparar`, `apuntar` (combate), `recargar` (combate), `interactuar`, `pico`, `ranura1`…`ranura5`, `ranuraSiguiente`, `ranuraAnterior`, `tirar`, `modoConstruccion`, `construirPared`, `construirPiso`, `construirRampa`, `cambiarMaterial` (construcción), `chat`.

## Opciones

- `registrarOpcion({ id, nombre, grupo, tipo, def, … })`. Tipos: `rango` (`min`, `max`, `paso`, `fmt`), `si-no`, `lista` (`valores: [[valor, nombre]]`). Grupos = pestañas: Juego, Video, Sonido.
- `opcion(id)`, `fijarOpcion(id, v)` (ignora valores inválidos), `restablecerOpciones()`. Se guardan en `sf-opciones`.
- `alCambiar(fn)`: avisa `('controles' | 'opcion', id)` en cada cambio.

Opciones de fábrica: `sens`, `sensApunta`, `sensMira`, `invertirY`, `apuntarAlternar`, `correrSiempre`, `numerosDanio`, `calidad`, `resolucion`, `fov`, `colorMira`, `fps`, `volumen`.
