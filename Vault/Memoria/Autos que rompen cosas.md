# Autos que rompen cosas

Volver a [[Índice de memoria]] · resultado en [[Autos]] y [[autos.js]]

**2026-11-26 · Rafael**

Pidió: "Hace que los autos dependiendo la velocidad que vayan rompan o no las cosas que chocan". El coordinador lo interpretó como: daño por impacto según la velocidad al chocar; despacio el auto rebota sin romper, a velocidad media daña madera, vallas y árboles chicos, rápido atraviesa lo débil (con la vida y el daño visible de las paredes) y se daña y frena según lo que rompió; lo muy duro (rocas grandes, piedra o metal) puede frenarlo aunque vaya rápido. Umbrales por material en una tabla, decidido por el servidor y repartido a todos.

**2026-11-26 · Claude (al hacer ese pedido)**

- Cuenta la velocidad contra la cosa, no la total (rozar una pared de costado no la rompe).
- Tabla `EMBESTIDA` en [[autos.js]]. Con la vida llena: madera desde 45 km/h, árbol común desde 55 km/h (los gruesos aguantan más), piedra desde 89 km/h (casi a fondo, máximo 97), metal solo con turbo (124 km/h), rocas casi nunca (la más chica con turbo a fondo). Lo dañado se rompe más fácil (pico, balas o un choque anterior).
- Lo fijo del mapa (postes, torres del teleférico, carteles, indicadores, malecón) frena siempre, igual que con el pico.
- El auto que atraviesa algo pierde velocidad y vida según la vida que le sacó (una pared de madera sana a fondo: de 97 a unos 80 km/h y 12 de vida). Si no lo rompe, rebota y se abolla como antes.
- Romper con el auto no da materiales (los da el pico).
- Los números son para tunear: si Rafael quiere que algo se rompa más fácil o más difícil, se cambia esa fila.
