// (tacto 229 y 230, v0.272) El plan de la semana se ve hacer. Al poner una sesión en un día (desde «Sin día», desde su
// fila o cambiándola de día), su ficha vuela hasta ese día de la tira; con «Repartir por mí» o «Como siempre», una
// detrás de otra. Va aparte: se pide al tocar. Con «reducir movimiento», aparece en su día sin más.
import { vibrar } from '../hapticos.js';
import { sinMovimiento } from '../transiciones.js';

// La ficha de la sesión «id» (en la tira, ya en su día «dia»), desde donde estaba («desde»: su caja de antes)
export function volarAlDia(raiz, id, dia, desde) {
  if (!raiz || !desde || sinMovimiento()) return;
  const fin = Date.now() + 1500;
  // (el plan se vuelve a pedir al guardarlo: se espera a que la ficha esté en su día, como mucho segundo y medio)
  const mirar = () => {
    const el = raiz.isConnected ? raiz.querySelector(`[data-d="${dia}"] [data-ses="${id}"]`) : null;
    if (!el) { if (Date.now() < fin && raiz.isConnected) setTimeout(mirar, 50); return; }
    const a = el.getBoundingClientRect();
    const dx = desde.left + desde.width / 2 - (a.left + a.width / 2), dy = desde.top + desde.height / 2 - (a.top + a.height / 2);
    if (Math.hypot(dx, dy) < 6 || !el.animate) return;
    try {
      el.animate([
        { transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(1.3)` },
        { transform: 'translate(0, 0) scale(1.14)', offset: 0.78 },
        { transform: 'none' },
      ], { duration: 440, easing: 'cubic-bezier(.2, .8, .2, 1)' });
    } catch { return; }
    setTimeout(() => vibrar('toque'), 340);
  };
  mirar();
}
