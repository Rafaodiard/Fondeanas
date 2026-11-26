# Cuentas, casino y tienda

Volver a [[Índice de memoria]]

**2026-11-26 · pedido**

"Quiero que se pueda iniciar sesión, que haya lobby y que cada usuario que inició sesión tenga 1000 pavos, que haya un casino donde se apuestan pavos en la ruleta o blackjack o slots y que haya tienda de skins. Dejalo listo para hacerlo pero todavía no lo hagas."

- Todavía **no se implementa**: el plan está en [[Cuentas, lobby, casino y tienda]].
- Los pavos son moneda del juego: no se compran con plata real ni se cambian por nada fuera del juego.

**2026-11-26 · decisiones**

"Se puede jugar sin cuenta, dan 100 fichas por kill y 500 por ver un anuncio, lobby 3d, casino mesas solo, skins todavía no armes (dejá los espacios vacíos), login solo usuario y contraseña."

- **Invitado:** se puede jugar sin cuenta, pero sin pavos (no entra al casino, la tienda ni los anuncios).
- **Pavos:** 100 por cada eliminación y 500 por ver un anuncio. Se interpretó "fichas" como pavos (una sola moneda).
- **Lobby:** en 3D con el personaje.
- **Casino:** cada uno juega solo contra la casa.
- **Skins:** no se arman todavía. La tienda y el casillero quedan con los espacios vacíos.
- **Login:** solo usuario y contraseña.
- Agregados del plan, no pedidos explícitamente (se mantienen): topes contra el farmeo de eliminaciones y de anuncios. Falta elegir el proveedor de anuncios.

**2026-11-26 · pedido**

"Lo de los anuncios no lo hagas, solo dejá el espacio listo para hacerlo. El resto hacelo."

- Se implementó todo menos los anuncios: cuentas, invitado, lobby 3D, pavos (1000 al registrarse, 100 por eliminación), casino (ruleta, blackjack y tragamonedas) y tienda/casillero con espacios vacíos.
- Anuncios: quedan el botón deshabilitado ("Próximamente"), la tabla `anuncios`, los valores en `server/premios.js` y la interfaz `public/js/anuncios.js`, con los pasos para activarlos. Falta elegir el proveedor.
