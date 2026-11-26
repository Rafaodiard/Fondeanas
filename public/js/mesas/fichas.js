// Fichas del casino: colores por valor y el selector de fichas que usan las tres mesas.
export const FICHAS = [
  { v: 5, color: '#e63946' }, { v: 10, color: '#3fa7ff' }, { v: 25, color: '#2a9d4b' },
  { v: 50, color: '#ff9f1c' }, { v: 100, color: '#22223b' }, { v: 250, color: '#c77dff' }, { v: 500, color: '#ffd23f' },
];
export const colorFicha = (v) => [...FICHAS].reverse().find((f) => v >= f.v)?.color || FICHAS[0].color;
export const htmlFicha = (v, extra = '') => `<span class="ficha ${extra}" style="--fc:${colorFicha(v)}"><b>${v >= 1000 ? `${Math.floor(v / 1000)}k` : v}</b></span>`;

// Selector de fichas: botones con las fichas; elegida() devuelve el valor.
export function selectorFichas(cont, valores, inicial, alElegir, sfx) {
  let actual = inicial;
  cont.innerHTML = valores.map((v) => `<button type="button" class="ficha-btn" data-v="${v}" title="${v} pavos">${htmlFicha(v)}</button>`).join('');
  const marcar = () => cont.querySelectorAll('.ficha-btn').forEach((b) => b.classList.toggle('activa', +b.dataset.v === actual));
  cont.addEventListener('click', (e) => {
    const b = e.target.closest('.ficha-btn');
    if (!b) return;
    actual = +b.dataset.v; marcar(); sfx?.ficha(); alElegir?.(actual);
  });
  marcar();
  return { get valor() { return actual; } };
}
