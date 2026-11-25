# Armas y disparo

Volver a [[Inicio]] · datos en [[items.js]], lógica en [[main.js]] y [[server.js]]

## Armas (`WEAPONS`)

| Arma | Munición | Daño | Cargador | Notas |
|---|---|---|---|---|
| Pistola | ligera | 24 | 16 | semiautomática |
| Subfusil | ligera | 17 | 30 | automática |
| Rifle de asalto | media | 30 | 30 | automática |
| Escopeta | cartuchos | 11 × 9 perdigones | 5 | el daño baja con la distancia (mínimo 35 %) |
| Francotirador | pesada | 105 | 1 | mira telescópica |
| Lanzacohetes | cohetes | 95 | 1 | daño en área de radio 5 |

Cada arma tiene además multiplicador de cabeza, cooldown, alcance, dispersión (normal y apuntando) y daño a estructuras.

## Flujo de un disparo

1. El cliente (`tryShoot` en [[main.js]]) hace los raycasts y manda `shoot` con `from`, `to` y `hits`.
2. El servidor revisa que el jugador esté en el piso, que el arma tenga balas y el cooldown (con 25 % de tolerancia), descuenta una bala y reenvía `shot` a los demás.
3. Por cada impacto valida el rango y aplica daño a jugadores (`damagePlayer`, el escudo absorbe primero) o a estructuras (`damageStruct`). Al tirador le manda `hitConfirm`.
4. Cohete: el servidor espera el tiempo de viaje y llama a `explode` (el que dispara recibe la mitad del daño).

## Recarga

`reload` toma munición del tipo del arma; el cargador se llena al 95 % del tiempo de recarga (que depende de la rareza). Las animaciones de recarga y bombeo están en [[rig.js]] y [[Pipeline de armas]].

## Animación del arma en el personaje

- Posturas para sostener y apuntar: tabla `ARMAS` de `heroe_clips.py` ([[Pipeline del héroe]]). Las recargas arrancan y terminan en esa misma postura.
- Recargas y bombeo: `heroe_recargas.py` ([[Pipeline de armas]]), reproducidos por [[rig.js]].
- Retroceso: cada tiro (propio, o el `shot` de otro jugador) marca `recoil = 1` en [[main.js]] y `retroceso` en [[rig.js]] lo convierte en un impulso a un resorte amortiguado. Con la tabla `RETRO` cada arma inclina el pecho (`sube`), levanta el arma en la mano (`flip`), la corre hacia atrás (`atras`) y gira un poco el torso a un lado al azar (`giro`). Apuntando el retroceso es el 70 %.
- Control: `armas_choque.py` mide cuánto se mete el arma en el cuerpo en cada pose y cada cuadro de las recargas ([[Pipeline de armas]]).

## Apuntar

Clic derecho, solo con armas (`canAim`). Con el francotirador se ve la mira telescópica (`#scope` en [[index.html]]).
