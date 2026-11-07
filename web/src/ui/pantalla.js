// (diseño, tanda 23) Lo que la pantalla necesita saber para moverse bonita, puesto en la raíz sin tocar las pantallas:
//   · data-franja: la franja del día (manana, dia, tarde, noche) para el resplandor de la tarjeta de Hoy (bloque 83).
//     Se mira al arrancar y cada cinco minutos.
//   · --hunde-y: dónde está el centro de lo que se ve cuando se abre una hoja (body[data-hojas]), para que la página
//     se encoja hacia ese punto y no hacia el centro de una página larga (bloque 80).
export const franjaDe = (h) => (h >= 6 && h < 12 ? 'manana' : h >= 12 && h < 17 ? 'dia' : h >= 17 && h < 21 ? 'tarde' : 'noche');

export function instalarPantalla(d = typeof document !== 'undefined' ? document : null) {
  if (!d || typeof window === 'undefined') return;
  const r = d.documentElement;
  const franja = () => { r.dataset.franja = franjaDe(new Date().getHours()); };
  franja();
  setInterval(franja, 5 * 60 * 1000);
  // el centro de lo que se ve, al abrirse una hoja
  const hojas = () => { if (d.body.hasAttribute('data-hojas')) r.style.setProperty('--hunde-y', `${Math.round(window.scrollY + window.innerHeight / 2)}px`); };
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(hojas).observe(d.body, { attributes: true, attributeFilter: ['data-hojas'] });
  }
}
