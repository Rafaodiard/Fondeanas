// Catálogo de skins (compartido entre cliente y servidor, sin dependencias).
// Cada skin es cosmética: todas usan el mismo esqueleto, el mismo tamaño y la misma hitbox (la del servidor), así
// ninguna da ventaja. Lo que cambia es el aspecto:
//   personaje  traje: colores por zona del héroe, patrones, efectos y accesorios modelados (cascos, cabezas, colas)
//   mochila    lo que va colgado en la espalda
//   pico       el pico (modelos nuevos de skins.glb o el de armas.glb con otro acabado)
//   planeador  la tela del paracaídas
//   envoltorio el acabado de las armas
// El aspecto ("look") lo interpreta public/js/aspecto.js:
//   zonas del héroe: chaleco, pantalon, camisa (y guantes/rodilleras), bufanda, cuero (botas, cinturones y pelo), piel
//   patron:  { tipo, a, b, c, esc, en: [zonas] }   tipos: camo, rayas, cuadros, manchas, escamas, vendas, circuito,
//            pelaje, lunares, degrade, llamas
//   brillo:  { tipo, color, fuerza, esc, en: [zonas] }   tipos: holo, lava, galaxia, neon, pulso
//   acabado: { tipo: 'oro' | 'cromo', en: [zonas] }   (metálico)
//   acc:     { idDelAccesorio: { A, B, C, D, Ojo, Luz, Metal, Vidrio } }   colores de cada material del modelo
//   'acc' en una lista "en" aplica el patrón/brillo/acabado también al material A de los accesorios.
// incluye: id de una mochila que viene con el traje (se agrega a la cuenta al conseguirlo).

import { RARITIES } from './items.js';

export const RAREZAS = RARITIES; // misma clasificación (y colores) que el loot: Común … Legendaria

export const TIPOS = {
  personaje: { nombre: 'Trajes', uno: 'Traje', icono: '🧍' },
  mochila: { nombre: 'Mochilas', uno: 'Mochila', icono: '🎒' },
  pico: { nombre: 'Picos', uno: 'Pico', icono: '⛏' },
  planeador: { nombre: 'Planeadores', uno: 'Planeador', icono: '🪂' },
  envoltorio: { nombre: 'Envoltorios', uno: 'Envoltorio', icono: '🎨' },
};
export const ORDEN_TIPOS = ['personaje', 'mochila', 'pico', 'planeador', 'envoltorio'];

// Precio en pavos por tipo y rareza (Común, Poco común, Rara, Épica, Legendaria).
export const PRECIOS = {
  personaje: [400, 700, 1000, 1500, 2200],
  mochila: [150, 300, 500, 750, 1100],
  pico: [200, 400, 600, 900, 1300],
  planeador: [200, 400, 600, 900, 1300],
  envoltorio: [100, 250, 400, 600, 900],
};

const TODO = ['chaleco', 'pantalon', 'camisa', 'bufanda', 'cuero', 'piel'];
const ROPA = ['chaleco', 'pantalon', 'camisa', 'bufanda'];

// ---------------------------------------------------------------------------------------------------------------
// TRAJES. tag: humano | monstruo | animal | robot (las cajas filtran por tag)
const TRAJES = [
  // ---- humanos ----
  { id: 'recluta', nombre: 'Recluta', rareza: 0, tag: 'humano', gratis: true, desc: 'El de siempre. El chaleco toma el color que te toca en la sala.', look: { chalecoJugador: true } },
  { id: 'explorador', nombre: 'Explorador de Médanos', rareza: 0, tag: 'humano', desc: 'Conoce cada duna de la isla.', look: {
    chaleco: '#c9a66b', pantalon: '#8a7a55', camisa: '#4a3f2e', bufanda: '#b5652b',
    acc: { gorra: { A: '#c9a66b', B: '#6b4f2a', C: '#3a2a18' } } } },
  { id: 'surfista', nombre: 'Surfista Turquesa', rareza: 0, tag: 'humano', desc: 'Llega a la isla en tabla, no en bus.', look: {
    chaleco: '#2ec4b6', pantalon: '#f4a261', camisa: '#fefae0', bufanda: '#ffd23f',
    patron: { tipo: 'rayas', a: '#2ec4b6', b: '#fefae0', esc: 9, en: ['chaleco'] },
    acc: { piluso: { A: '#fefae0', B: '#2ec4b6' }, lentes: { Vidrio: '#2a1a40', Metal: '#ffd23f' } } } },
  { id: 'lenador', nombre: 'Leñador del Norte', rareza: 1, tag: 'humano', desc: 'Corta un pino de tres golpes.', look: {
    pantalon: '#2f4b7c', camisa: '#3b3b3b', bufanda: '#c9a66b', cuero: '#6b3a1e',
    patron: { tipo: 'cuadros', a: '#b22222', b: '#1a1a1a', esc: 11, en: ['chaleco'] },
    acc: { gorro_lana: { A: '#2f6b3a', B: '#f1f1f1' }, barba: { A: '#7a3b12', Metal: '#c0c0c0' } } } },
  { id: 'punk', nombre: 'Punk Fucsia', rareza: 1, tag: 'humano', desc: 'Tres acordes y una cresta.', look: {
    chaleco: '#151515', pantalon: '#3a1f5c', camisa: '#ff2fa0', bufanda: '#151515', cuero: '#ff2fa0',
    patron: { tipo: 'lunares', a: '#151515', b: '#ff2fa0', esc: 14, en: ['chaleco'] },
    acc: { mohicano: { A: '#ff2fa0' }, lentes: { Vidrio: '#0b0b0b', Metal: '#dddddd' } } } },
  { id: 'bombero', nombre: 'Bombera de Altoplaza', rareza: 1, tag: 'humano', desc: 'Apaga incendios, prende partidas.', look: {
    pantalon: '#4f4a3a', camisa: '#2a2a2a', bufanda: '#c0392b',
    patron: { tipo: 'rayas', a: '#4f4a3a', b: '#e8f060', esc: 4, en: ['chaleco', 'pantalon'] },
    acc: { casco_bombero: { A: '#c0392b', Metal: '#d4af37', D: '#f5f5f5' } } } },
  { id: 'chef', nombre: 'Chef Caótico', rareza: 1, tag: 'humano', desc: 'Su especialidad: ensalada de plomo.', look: {
    chaleco: '#f5f5f0', camisa: '#f5f5f0', bufanda: '#d62828',
    patron: { tipo: 'cuadros', a: '#202020', b: '#eeeeee', esc: 16, en: ['pantalon'] },
    acc: { gorro_chef: { A: '#fafafa', B: '#fafafa' } } } },
  { id: 'vaquero', nombre: 'Vaquero del Médano', rareza: 2, tag: 'humano', desc: 'Más rápido que su sombra (y que la tormenta).', look: {
    chaleco: '#6b3f1d', pantalon: '#33507a', camisa: '#c9b38a', bufanda: '#a4161a', cuero: '#3d2412', metal: '#d4af37',
    acc: { sombrero_vaquero: { A: '#8b5a2b', B: '#2a1a0e' }, panuelo: { A: '#a4161a' } } } },
  { id: 'vikingo', nombre: 'Vikingo de Escarcha', rareza: 2, tag: 'humano', desc: 'Vino del Refugio Nevado con hambre.', look: {
    chaleco: '#5a5f6b', pantalon: '#4a3b2a', camisa: '#7a6a55', bufanda: '#7a2e1e', cuero: '#c75d1a',
    acc: { casco_vikingo: { Metal: '#9aa0a8', A: '#efe6d2', B: '#6b4a2a' }, barba: { A: '#c75d1a', Metal: '#9aa0a8' },
      hombreras_piel: { A: '#8b7355', B: '#4a3b2a' } } } },
  { id: 'buzo', nombre: 'Buzo Abisal', rareza: 2, tag: 'humano', incluye: 'tanque', desc: 'Encontró el loot del barco hundido.', look: {
    chaleco: '#2f3b44', pantalon: '#2f3b44', camisa: '#1e2a30', bufanda: '#e0a030', cuero: '#1e2a30',
    acc: { casco_buzo: { Metal: '#c8923a', B: '#8a6a2a', Vidrio: '#1a3040' } } } },
  { id: 'mago', nombre: 'Mago de Feria', rareza: 2, tag: 'humano', desc: 'Saca conejos, cohetes y escopetas de la galera.', look: {
    pantalon: '#1a1030', camisa: '#2a1a4a', bufanda: '#ffd23f',
    patron: { tipo: 'lunares', a: '#3a1f6b', b: '#ffd23f', esc: 11, en: ['chaleco'] },
    acc: { galera: { A: '#1a1a1a', B: '#6a2bd4', Ojo: '#ffffff', D: '#d62828' } } } },
  { id: 'astronauta', nombre: 'Astronauta Cometa', rareza: 3, tag: 'humano', incluye: 'jetpack', desc: 'Saltó del bus desde la órbita.', look: {
    chaleco: '#f2f2f2', pantalon: '#f2f2f2', camisa: '#d9d9d9', bufanda: '#ff7b00', cuero: '#bbbbbb', metal: '#cccccc',
    acc: { casco_espacial: { A: '#f2f2f2', B: '#ff7b00', Vidrio: '#c9a227', Metal: '#cccccc', Luz: '#7df9ff' } } } },
  { id: 'caballero', nombre: 'Caballero Óxido', rareza: 3, tag: 'humano', desc: 'Armadura vieja, golpe nuevo.', look: {
    chaleco: '#9aa0a8', pantalon: '#5a4632', camisa: '#3a3a3a', bufanda: '#8b1a1a',
    acabado: { tipo: 'cromo', en: ['chaleco'] },
    acc: { yelmo: { Metal: '#a8adb5', C: '#111111', B: '#c9a227', A: '#b22222' }, hombreras: { Metal: '#a8adb5', A: '#c9a227', B: '#c9a227' } } } },
  { id: 'ninja', nombre: 'Ninja Tormenta', rareza: 3, tag: 'humano', incluye: 'katana', desc: 'Se mueve con los relámpagos.', look: {
    chaleco: '#1b1f3a', pantalon: '#1b1f3a', camisa: '#11131f', bufanda: '#11131f', cuero: '#111111',
    brillo: { tipo: 'neon', color: '#4cc9f0', fuerza: 1.6, esc: 7, en: ['chaleco', 'pantalon'] },
    acc: { capucha: { A: '#1b1f3a', B: '#4cc9f0' }, mascara_ninja: { A: '#11131f', B: '#4cc9f0', Metal: '#cfd8e3' } } } },
  { id: 'rey', nombre: 'Rey del Salto', rareza: 4, tag: 'humano', incluye: 'capa_real', desc: 'Ganó tantas partidas que se coronó solo.', look: {
    chaleco: '#d4af37', pantalon: '#4a0d6b', camisa: '#f5f0e6', bufanda: '#b22222', metal: '#d4af37',
    acabado: { tipo: 'oro', en: ['chaleco'] },
    brillo: { tipo: 'pulso', color: '#ffcf4a', fuerza: 0.35, en: ['chaleco'] },
    acc: { corona: { Metal: '#d4af37', Luz: '#ff2244', D: '#3a7bd5', C: '#4a0d6b' } } } },
  { id: 'dj', nombre: 'DJ Holograma', rareza: 4, tag: 'humano', desc: 'La pista de baile es toda la isla.', look: {
    chaleco: '#e8e8f0', pantalon: '#d8d8e8', camisa: '#111111', bufanda: '#111111',
    brillo: { tipo: 'holo', fuerza: 1.2, esc: 2, en: ['chaleco', 'pantalon'] },
    acc: { auriculares: { A: '#eeeeee', C: '#222222', Luz: '#ff2fd0' }, lentes: { Vidrio: '#ff2fd0', Metal: '#eeeeee' } } } },

  // ---- monstruos ----
  { id: 'zombi', nombre: 'Zombi del Pantano', rareza: 1, tag: 'monstruo', desc: 'Cayó en Palafitos y nunca se fue.', look: {
    piel: '#7d9a6a', pantalon: '#3b4a5a', camisa: '#4a3a3a', bufanda: '#5a3a3a', cuero: '#2a3a20',
    patron: { tipo: 'manchas', a: '#5a5a3a', b: '#33331f', esc: 9, en: ['chaleco'] } } },
  { id: 'calabaza', nombre: 'Calabaza Errante', rareza: 2, tag: 'monstruo', desc: 'Le brillan los ojos cuando te ve.', look: {
    chaleco: '#2a1a3a', pantalon: '#1a1a1a', camisa: '#e8730c', bufanda: '#3a6b1f', piel: '#4a7a2a',
    acc: { cab_calabaza: { A: '#e8730c', B: '#3a6b1f', Luz: '#ffcc33' } } } },
  { id: 'momia', nombre: 'Momia de Médanos', rareza: 2, tag: 'monstruo', desc: 'Tres mil años esperando el bus.', look: {
    patron: { tipo: 'vendas', a: '#d8c9a3', b: '#a8956b', esc: 22, en: TODO },
    acc: { cab_momia: { A: '#d8c9a3', C: '#1a1208', Luz: '#7dff6a' } } } },
  { id: 'vampiro', nombre: 'Conde Medianoche', rareza: 2, tag: 'monstruo', incluye: 'capa_noche', desc: 'Solo juega partidas de noche.', look: {
    piel: '#d9d4e3', cuero: '#111111', chaleco: '#3a0a14', pantalon: '#111111', camisa: '#111111', bufanda: '#7a0a1a',
    acc: { cuello_vampiro: { A: '#111111', B: '#7a0a1a', D: '#b22222' } } } },
  { id: 'alien', nombre: 'Visitante Verde', rareza: 2, tag: 'monstruo', desc: 'Vino a estudiar a los humanos. Mal momento.', look: {
    piel: '#7ddc5a', chaleco: '#c0c6cc', pantalon: '#c0c6cc', camisa: '#3a3a4a', bufanda: '#7ddc5a',
    acabado: { tipo: 'cromo', en: ['chaleco', 'pantalon'] },
    acc: { cab_alien: { A: '#7ddc5a', Vidrio: '#050505', C: '#2a5a1a' } } } },
  { id: 'calavera', nombre: 'Calavera de Carnaval', rareza: 3, tag: 'monstruo', desc: 'La fiesta sigue después del final.', look: {
    piel: '#efe9dc', pantalon: '#1a1a1a', camisa: '#efe9dc', bufanda: '#ff7b00',
    patron: { tipo: 'lunares', a: '#1a1a1a', b: '#ff3fa4', esc: 10, en: ['chaleco'] },
    acc: { cab_calavera: { A: '#efe9dc', C: '#111111', Ojo: '#efe9dc', Luz: '#ff3fa4', D: '#ff7b00' },
      galera: { A: '#111111', B: '#ff3fa4', Ojo: '#ffffff', D: '#ffd23f' } } } },
  { id: 'lobo', nombre: 'Lobo de Luna Llena', rareza: 3, tag: 'monstruo', desc: 'Aúlla cuando cierra la tormenta.', look: {
    piel: '#6b5a4a', chaleco: '#3a4a5a', pantalon: '#4a4a5a', camisa: '#3a3a3a', bufanda: '#6b5a4a', cuero: '#3a2f26',
    patron: { tipo: 'pelaje', a: '#6b5a4a', b: '#3f342a', esc: 10, en: ['piel'] },
    acc: { cab_lobo: { A: '#6b5a4a', B: '#c9b8a0', C: '#111111', Ojo: '#ffcc33' }, cola_lobo: { A: '#6b5a4a' } } } },
  { id: 'yeti', nombre: 'Yeti Glaciar', rareza: 3, tag: 'monstruo', desc: 'El Refugio Nevado es su casa.', look: {
    piel: '#f2f6fa', chaleco: '#f2f6fa', pantalon: '#e1e8f0', camisa: '#7fa6c9', bufanda: '#9ad1ff', cuero: '#7fa6c9',
    patron: { tipo: 'pelaje', a: '#f2f6fa', b: '#c3d3e3', esc: 9, en: ['chaleco', 'pantalon', 'piel'] },
    acc: { cab_yeti: { A: '#f2f6fa', B: '#7fa6c9', C: '#1a2a3a', Ojo: '#ffffff', D: '#9ad1ff' }, hombreras_piel: { A: '#f2f6fa', B: '#7fa6c9' } } } },
  { id: 'demonio', nombre: 'Demonio de Lava', rareza: 4, tag: 'monstruo', incluye: 'alas_demonio', desc: 'Sale de la Cantera Roja cuando hace calor.', look: {
    piel: '#8a1a14', cuero: '#111111', chaleco: '#1a0a0a', pantalon: '#1a0a0a', camisa: '#2a0a0a', bufanda: '#1a0a0a',
    brillo: { tipo: 'lava', color: '#ff7a1a', fuerza: 2.2, esc: 7, en: ['piel', 'chaleco', 'pantalon', 'acc'] },
    acc: { cuernos_diablo: { A: '#1a1a1a' }, cola_diablo: { A: '#8a1a14' } } } },
  { id: 'espectro', nombre: 'Espectro Galáctico', rareza: 4, tag: 'monstruo', desc: 'Adentro tiene todo el universo.', look: {
    brillo: { tipo: 'galaxia', color: '#b28cff', fuerza: 1.5, esc: 3, en: TODO },
    acc: { halo: { Luz: '#c9a0ff' } } } },

  // ---- animales ----
  { id: 'gallo', nombre: 'Gallo Bravo', rareza: 0, tag: 'animal', desc: 'Kikirikí y a saltar.', look: {
    piel: '#ffb02e', chaleco: '#fafafa', pantalon: '#3a5a8a', camisa: '#fafafa', bufanda: '#d62828',
    acc: { cab_gallo: { A: '#fafafa', B: '#d62828', C: '#111111', D: '#ffb02e', Ojo: '#ffffff' } } } },
  { id: 'oso', nombre: 'Oso Mamerto', rareza: 1, tag: 'animal', desc: 'Abraza fuerte. Pega más fuerte.', look: {
    piel: '#7a4a2a', chaleco: '#3a5a8a', pantalon: '#3a5a8a', camisa: '#d62828', bufanda: '#ffd23f',
    patron: { tipo: 'pelaje', a: '#7a4a2a', b: '#5a361e', esc: 10, en: ['piel'] },
    acc: { cab_oso: { A: '#7a4a2a', B: '#c9a27a', C: '#111111', Ojo: '#ffffff' } } } },
  { id: 'gato', nombre: 'Gato Callejero', rareza: 1, tag: 'animal', desc: 'Siete vidas, una sola partida.', look: {
    piel: '#8a8a8a', chaleco: '#d62828', pantalon: '#2a2a2a', camisa: '#f2f2f2', bufanda: '#ffd23f',
    patron: { tipo: 'rayas', a: '#8a8a8a', b: '#4a4a4a', esc: 14, en: ['piel'] },
    acc: { cab_gato: { A: '#8a8a8a', B: '#f2c6c6', C: '#111111', Ojo: '#b6ff4a' }, cola_gato: { A: '#8a8a8a' } } } },
  { id: 'rana', nombre: 'Rana Charquito', rareza: 1, tag: 'animal', desc: 'Salta más alto que nadie (mentira, igual que todos).', look: {
    piel: '#4caf50', chaleco: '#ffd23f', pantalon: '#2e7d32', camisa: '#4caf50', bufanda: '#ffd23f',
    patron: { tipo: 'manchas', a: '#4caf50', b: '#2e7d32', esc: 12, en: ['piel'] },
    acc: { cab_rana: { A: '#4caf50', B: '#e7f5c9', C: '#111111', Ojo: '#ffffff', D: '#2e7d32' } } } },
  { id: 'zorro', nombre: 'Zorro Nocturno', rareza: 2, tag: 'animal', desc: 'Lootea los cofres antes que vos.', look: {
    piel: '#e8711c', chaleco: '#2f5a3a', pantalon: '#3a3a2a', camisa: '#fff6ea', bufanda: '#2f5a3a',
    acc: { cab_zorro: { A: '#e8711c', B: '#fff6ea', C: '#111111', Ojo: '#ffe08a' }, cola_zorro: { A: '#e8711c', B: '#fff6ea' } } } },
  { id: 'pinguino', nombre: 'Pingüino de Penacho', rareza: 2, tag: 'animal', desc: 'Elegante hasta en la tormenta.', look: {
    piel: '#1a1a1a', chaleco: '#fafafa', pantalon: '#1a1a1a', camisa: '#1a1a1a', bufanda: '#d62828', cuero: '#ffb02e',
    acc: { cab_pinguino: { A: '#1a1a1a', B: '#fafafa', C: '#111111', D: '#ffb02e', Ojo: '#ffffff' } } } },
  { id: 'tiburon', nombre: 'Tiburón de Bruma', rareza: 3, tag: 'animal', incluye: 'aleta', desc: 'Nada por el río hasta tu pueblo.', look: {
    piel: '#5d7d9a', pantalon: '#2a3f55', camisa: '#f2f2f2', bufanda: '#ff7b00',
    patron: { tipo: 'degrade', a: '#5d7d9a', b: '#eef2f5', esc: 1, en: ['chaleco'] },
    acc: { cab_tiburon: { A: '#5d7d9a', B: '#f2f2f2', C: '#2a0a0a', Ojo: '#ffffff' } } } },
  { id: 'dragon', nombre: 'Dragón Solar', rareza: 4, tag: 'animal', incluye: 'alas_dragon', desc: 'Escamas que guardan el calor del sol.', look: {
    piel: '#2e8b57', pantalon: '#3a2a1a', camisa: '#1d5c39', bufanda: '#f0d27a', cuero: '#3a2a1a',
    patron: { tipo: 'escamas', a: '#2e8b57', b: '#1d5c39', esc: 18, en: ['piel', 'chaleco', 'acc'] },
    brillo: { tipo: 'pulso', color: '#ffb02e', fuerza: 0.25, en: ['chaleco'] },
    acc: { cab_dragon: { A: '#2e8b57', B: '#f0d27a', C: '#111111', D: '#f0e6d2', Luz: '#ffb02e', Ojo: '#ffffff' },
      cola_dragon: { A: '#2e8b57', B: '#f0d27a' } } } },

  // ---- robots ----
  { id: 'robot', nombre: 'Robot Chatarra', rareza: 2, tag: 'robot', desc: 'Hecho con piezas de autos de la isla.', look: {
    piel: '#9aa0a8', pantalon: '#6a6a6a', camisa: '#3a3a3a', bufanda: '#7df9ff', cuero: '#3a3a3a',
    patron: { tipo: 'manchas', a: '#c9752a', b: '#7a3a12', esc: 8, en: ['chaleco'] },
    acabado: { tipo: 'cromo', en: ['piel'] },
    acc: { cab_robot: { A: '#c9752a', Metal: '#9aa0a8', Vidrio: '#102030', Luz: '#7df9ff', B: '#333333', C: '#111111', D: '#7a3a12' } } } },
  { id: 'tele', nombre: 'Tele Cabezona', rareza: 2, tag: 'robot', desc: 'Siempre está en el canal de las partidas.', look: {
    piel: '#555555', chaleco: '#7a4a2a', pantalon: '#3a3a3a', camisa: '#d9c7a3', bufanda: '#9effc9',
    patron: { tipo: 'rayas', a: '#7a4a2a', b: '#5a361e', esc: 18, en: ['chaleco'] },
    acc: { cab_tele: { A: '#d9c7a3', Metal: '#888888', Luz: '#9effc9', C: '#111111' } } } },
  { id: 'mecha', nombre: 'Mecha Carmesí', rareza: 3, tag: 'robot', incluye: 'alas_mecha', desc: 'Prototipo de combate con alas de acero.', look: {
    piel: '#cfd8e3', chaleco: '#e8eef5', pantalon: '#2a2f3a', camisa: '#2a2f3a', bufanda: '#ff3b3b', cuero: '#2a2f3a',
    acabado: { tipo: 'cromo', en: ['piel'] },
    brillo: { tipo: 'neon', color: '#ff3b3b', fuerza: 1.8, esc: 6, en: ['chaleco'] },
    acc: { cab_mecha: { A: '#e8eef5', B: '#ff3b3b', Metal: '#9aa0a8', Luz: '#ff3b3b', C: '#111111' }, hombreras: { Metal: '#cfd8e3', A: '#e8eef5', B: '#ff3b3b' } } } },
  { id: 'androide', nombre: 'Androide Áureo', rareza: 4, tag: 'robot', desc: 'De oro macizo y circuitos que laten.', look: {
    chaleco: '#d4af37', pantalon: '#d4af37', camisa: '#b8942a', bufanda: '#d4af37', cuero: '#b8942a', piel: '#d4af37',
    acabado: { tipo: 'oro', en: TODO },
    brillo: { tipo: 'neon', color: '#7df9ff', fuerza: 1.4, esc: 9, en: ['camisa', 'pantalon'] },
    acc: { cab_androide: { A: '#d4af37', Metal: '#d4af37', Luz: '#7df9ff', B: '#111111', C: '#111111' } } } },
];

// ---------------------------------------------------------------------------------------------------------------
// MOCHILAS (modelo = accesorio de skins.glb)
const MOCHILAS = [
  { id: 'tanque', nombre: 'Tanque de Aire', rareza: 1, modelo: 'mochila_tanque', colores: { A: '#d9a23a', B: '#555555', C: '#222222', Metal: '#c8c8c8' } },
  { id: 'osito', nombre: 'Osito Compañero', rareza: 1, modelo: 'mochila_osito', colores: { A: '#b07a4a', B: '#e8c9a0', C: '#111111', D: '#d62828' } },
  { id: 'guitarra', nombre: 'Guitarra Criolla', rareza: 1, modelo: 'mochila_guitarra', colores: { A: '#c98a3a', B: '#5a3a1a', C: '#1a1a1a', Metal: '#dddddd' } },
  { id: 'caparazon', nombre: 'Caparazón Antiguo', rareza: 2, modelo: 'mochila_caparazon', colores: { A: '#5a7a3a', B: '#3a4a22' } },
  { id: 'katana', nombre: 'Katana Relámpago', rareza: 2, modelo: 'mochila_katana', colores: { A: '#11131f', B: '#cfd8e3', C: '#4cc9f0', D: '#4cc9f0', Metal: '#c9a227' } },
  { id: 'aleta', nombre: 'Aleta Dorsal', rareza: 2, modelo: 'mochila_aleta', colores: { A: '#5d7d9a', B: '#2a3f55' } },
  { id: 'capa_noche', nombre: 'Capa de Medianoche', rareza: 2, modelo: 'mochila_capa', colores: { A: '#111111', B: '#7a0a1a', D: '#b22222' } },
  { id: 'jetpack', nombre: 'Mochila Cohete', rareza: 3, modelo: 'mochila_jetpack', colores: { A: '#f2f2f2', B: '#ff7b00', C: '#333333', Metal: '#aaaaaa', Luz: '#7df9ff' } },
  { id: 'alas_mecha', nombre: 'Alas de Acero', rareza: 3, modelo: 'mochila_alas_mecha', colores: { A: '#e8eef5', Metal: '#9aa0a8', Luz: '#ff3b3b' } },
  { id: 'capa_real', nombre: 'Capa Real', rareza: 3, modelo: 'mochila_capa', colores: { A: '#b22222', B: '#f5f0e6', D: '#d4af37' } },
  { id: 'alas_dragon', nombre: 'Alas de Dragón', rareza: 4, modelo: 'mochila_alas_dragon', colores: { A: '#1d5c39', B: '#f0d27a', D: '#f0e6d2' } },
  { id: 'alas_demonio', nombre: 'Alas Infernales', rareza: 4, modelo: 'mochila_alas_dragon', colores: { A: '#1a0a0a', B: '#5a0a0a', D: '#ff7a1a' },
    brillo: { tipo: 'lava', color: '#ff7a1a', fuerza: 2, esc: 7 } },
  { id: 'jetpack_oro', nombre: 'Cohete Dorado', rareza: 4, modelo: 'mochila_jetpack', colores: { A: '#d4af37', B: '#111111', C: '#111111', Metal: '#d4af37', Luz: '#ff4fd8' },
    acabado: { tipo: 'oro' } },
  { id: 'osito_galaxia', nombre: 'Osito Cósmico', rareza: 3, modelo: 'mochila_osito', colores: { A: '#3a2a6a', B: '#b28cff', C: '#ffffff', D: '#7df9ff' },
    brillo: { tipo: 'galaxia', color: '#b28cff', fuerza: 1.3, esc: 4 } },
];

// ---------------------------------------------------------------------------------------------------------------
// PICOS. modelo: nodo de skins.glb (pico_*) o null = el pico de armas.glb
const PICOS = [
  { id: 'pico', nombre: 'Pico de Siempre', rareza: 0, gratis: true, modelo: null },
  { id: 'hueso', nombre: 'Hueso Garrote', rareza: 0, modelo: 'pico_hueso', colores: { A: '#efe9dc', B: '#efe9dc', C: '#5a3a1a', Metal: '#9aa0a8' } },
  { id: 'llave', nombre: 'Llave Inglesa XL', rareza: 1, modelo: 'pico_llave', colores: { A: '#d62828', Metal: '#b8bcc4' } },
  { id: 'martillo', nombre: 'Martillo de Obra', rareza: 1, modelo: 'pico_martillo', colores: { A: '#ffb02e', B: '#7a5233', C: '#222222', Metal: '#8a8f98' } },
  { id: 'chupetin', nombre: 'Chupetín Gigante', rareza: 2, modelo: 'pico_chupetin', colores: { A: '#ff4f9a', B: '#fff1f6', D: '#ff4f9a', Ojo: '#f5f5f5' } },
  { id: 'hacha', nombre: 'Hacha Doble', rareza: 2, modelo: 'pico_hacha', colores: { A: '#5a3a1a', B: '#7a5233', C: '#1a1a1a', Metal: '#c9ced6' } },
  { id: 'ancla', nombre: 'Ancla de Bruma', rareza: 2, modelo: 'pico_ancla', colores: { A: '#2a3f55', Metal: '#7a8590' } },
  { id: 'pico_neon', nombre: 'Pico Neón', rareza: 3, modelo: null, brillo: { tipo: 'neon', color: '#39ff88', fuerza: 2, esc: 30 } },
  { id: 'guadana', nombre: 'Guadaña Lunar', rareza: 3, modelo: 'pico_guadana', colores: { A: '#3a2a6a', B: '#1a1a1a', C: '#1a1a1a', Metal: '#d8e0f0', Luz: '#9ad1ff' } },
  { id: 'cristal', nombre: 'Rompecristales', rareza: 4, modelo: 'pico_cristal', colores: { A: '#2a2f3a', B: '#2a2f3a', C: '#111111', Metal: '#c9ced6', Luz: '#7df9ff' },
    brillo: { tipo: 'pulso', color: '#7df9ff', fuerza: 0.9 } },
  { id: 'pico_oro', nombre: 'Pico de Oro Macizo', rareza: 4, modelo: null, acabado: { tipo: 'oro' } },
];

// ---------------------------------------------------------------------------------------------------------------
// PLANEADORES (paracaídas): Tela = celdas de color, TelaClara = celdas claras
const PLANEADORES = [
  { id: 'clasico', nombre: 'Clásico', rareza: 0, gratis: true, desc: 'Del color que te toca en la sala.', tela: null },
  { id: 'atardecer', nombre: 'Atardecer', rareza: 0, tela: { Tela: '#ff7b00', TelaClara: '#ffd23f' } },
  { id: 'camuflado', nombre: 'Camuflado', rareza: 1, tela: { Tela: '#4b5a32', TelaClara: '#8a7a55' }, patron: { tipo: 'camo', a: '#4b5a32', b: '#2e3a22', c: '#8a7a55', esc: 1.2 } },
  { id: 'escoces', nombre: 'Escocés', rareza: 1, tela: { Tela: '#b22222', TelaClara: '#1a1a1a' }, patron: { tipo: 'cuadros', a: '#b22222', b: '#1a3a1a', esc: 1.6 } },
  { id: 'lunares', nombre: 'Lunares', rareza: 2, tela: { Tela: '#3a7bd5', TelaClara: '#ffffff' }, patron: { tipo: 'lunares', a: '#3a7bd5', b: '#ffffff', esc: 2.5 } },
  { id: 'tiburon_vela', nombre: 'Mandíbula', rareza: 2, tela: { Tela: '#5d7d9a', TelaClara: '#f2f2f2' }, patron: { tipo: 'rayas', a: '#5d7d9a', b: '#2a3f55', esc: 1.5 } },
  { id: 'llamarada', nombre: 'Llamarada', rareza: 3, tela: { Tela: '#1a0a0a', TelaClara: '#2a0a0a' }, patron: { tipo: 'llamas', a: '#1a0a0a', b: '#ff7a1a', esc: 1 },
    brillo: { tipo: 'lava', color: '#ff7a1a', fuerza: 1.2, esc: 1.2 } },
  { id: 'tormenta', nombre: 'Ojo de la Tormenta', rareza: 3, tela: { Tela: '#2a1a4a', TelaClara: '#4a2a8a' }, brillo: { tipo: 'neon', color: '#b28cff', fuerza: 1.8, esc: 1.2 } },
  { id: 'galaxia_vela', nombre: 'Vía Láctea', rareza: 4, tela: { Tela: '#0a0a1a', TelaClara: '#14143a' }, brillo: { tipo: 'galaxia', color: '#b28cff', fuerza: 1.6, esc: 0.5 } },
  { id: 'holo_vela', nombre: 'Prisma', rareza: 4, tela: { Tela: '#e8e8f0', TelaClara: '#ffffff' }, brillo: { tipo: 'holo', fuerza: 1.1, esc: 0.4 } },
];

// ---------------------------------------------------------------------------------------------------------------
// ENVOLTORIOS (todas las armas)
const ENVOLTORIOS = [
  { id: 'bosque', nombre: 'Camuflaje Bosque', rareza: 0, patron: { tipo: 'camo', a: '#4b5a32', b: '#2e3a22', c: '#8a7a55', esc: 14 } },
  { id: 'artico', nombre: 'Camuflaje Ártico', rareza: 1, patron: { tipo: 'camo', a: '#e8eef5', b: '#9aa8b8', c: '#5a6878', esc: 14 } },
  { id: 'carbono', nombre: 'Fibra de Carbono', rareza: 1, patron: { tipo: 'cuadros', a: '#1a1a1a', b: '#3a3a3a', esc: 90 } },
  { id: 'caramelo', nombre: 'Caramelo', rareza: 1, patron: { tipo: 'rayas', a: '#ff4f9a', b: '#fff1f6', esc: 30 } },
  { id: 'tigre', nombre: 'Tigre', rareza: 2, patron: { tipo: 'pelaje', a: '#e8711c', b: '#151515', esc: 22 } },
  { id: 'escamas', nombre: 'Escamas', rareza: 2, patron: { tipo: 'escamas', a: '#2e8b57', b: '#1d5c39', esc: 60 } },
  { id: 'cromo', nombre: 'Cromado', rareza: 3, acabado: { tipo: 'cromo' } },
  { id: 'circuito', nombre: 'Circuito', rareza: 3, patron: { tipo: 'circuito', a: '#111a14', b: '#39ff88', esc: 30 }, brillo: { tipo: 'neon', color: '#39ff88', fuerza: 1.8, esc: 30 } },
  { id: 'lava', nombre: 'Magma', rareza: 3, patron: { tipo: 'manchas', a: '#1a0a0a', b: '#2a0a0a', esc: 14 }, brillo: { tipo: 'lava', color: '#ff7a1a', fuerza: 2, esc: 16 } },
  { id: 'oro', nombre: 'Oro Puro', rareza: 4, acabado: { tipo: 'oro' } },
  { id: 'galaxia', nombre: 'Galaxia', rareza: 4, brillo: { tipo: 'galaxia', color: '#b28cff', fuerza: 1.5, esc: 10 } },
];

// ---------------------------------------------------------------------------------------------------------------
const conTipo = (lista, tipo) => lista.map((s) => ({ ...s, tipo }));
export const SKINS = [
  ...conTipo(TRAJES, 'personaje'), ...conTipo(MOCHILAS, 'mochila'), ...conTipo(PICOS, 'pico'),
  ...conTipo(PLANEADORES, 'planeador'), ...conTipo(ENVOLTORIOS, 'envoltorio'),
];
export const SKIN = Object.fromEntries(SKINS.map((s) => [s.id, s]));
export const GRATIS = SKINS.filter((s) => s.gratis).map((s) => s.id);
// lo que tiene puesto alguien que recién se crea la cuenta (o un invitado); mochila/envoltorio null = nada
export const EQUIPO_INICIAL = { personaje: 'recluta', mochila: null, pico: 'pico', planeador: 'clasico', envoltorio: null };
// estos tipos se pueden dejar vacíos
export const OPCIONALES = new Set(['mochila', 'envoltorio']);

export const precio = (s) => (s && !s.gratis ? PRECIOS[s.tipo][s.rareza] : 0);
export const vendible = (s) => !!s && !s.gratis;

// Equipo válido: cada tipo con una skin de ese tipo (o vacío si se puede). Lo que no se reconoce vuelve al inicial.
export function equipoValido(eq, tiene = () => true) {
  const out = { ...EQUIPO_INICIAL };
  for (const tipo of ORDEN_TIPOS) {
    const id = eq?.[tipo];
    if (id === null && OPCIONALES.has(tipo)) out[tipo] = null;
    else if (typeof id === 'string' && SKIN[id]?.tipo === tipo && (SKIN[id].gratis || tiene(id))) out[tipo] = id;
  }
  return out;
}
