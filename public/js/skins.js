// Catálogo de skins (compartido por el servidor y el cliente). Por ahora está VACÍO a propósito: la tienda y el
// casillero muestran los espacios vacíos con "Próximamente". Para agregar una skin, sumala a SKINS con este formato:
//
//   {
//     id: 'bombero',              // único, sin espacios (es lo que se guarda en la base)
//     nombre: 'Bombero',
//     rareza: 2,                   // índice de RARITIES (items.js): 0 común, 1 poco común, 2 rara, 3 épica, 4 legendaria
//     precio: 800,                 // en pavos
//     ropa: '#d62828',             // color de la ropa del personaje (tiñe el material Ropa del GLB)
//     tela: '#ffba08',             // color de la vela del paracaídas (opcional; si falta usa ropa)
//     piezas: [],                  // más adelante: piezas modeladas en Blender (casco, mochila...) por nombre de GLB
//   }
//
// El servidor (server/tienda.js) y el personaje (models.js: createCharacter) ya saben usar estos campos.

export const SKINS = [];

// Cuántos espacios muestra la tienda y el casillero aunque el catálogo esté vacío.
export const ESPACIOS_TIENDA = 8;
export const ESPACIOS_CASILLERO = 12;

export const skinDe = (id, catalogo = SKINS) => catalogo.find((s) => s.id === id) || null;
