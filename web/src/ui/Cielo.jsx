// (v0.200, belleza) El cielo de la hora: una capa de luz detrás de la portada de Hoy y de la noche de la pantalla de entrar.
// Amanecer (un resplandor rosado que sube desde abajo), día (una luz fría desde arriba), atardecer (el sol naranja que
// se pone a la derecha) y noche (estrellas que titilan). Sigue al sol de Madrid de cada mes (logica/cielo.js) y se mira
// cada cinco minutos. Solo adorno: aria-hidden, sin toques; con «reducir movimiento», quieto.
import { useEffect, useState } from 'preact/hooks';
import { momentoDelDia, horaDecimal, ESTRELLAS_CIELO, MOMENTOS_CIELO } from '../logica/cielo.js';
import { hoyISO } from '../logica/fechas.js';

const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
// (las pruebas eligen el momento: en un navegador automático, si lo piden con «fbe-probar-cielo»)
function momentoAhora() {
  const prueba = typeof navigator !== 'undefined' && navigator.webdriver ? leer('fbe-probar-cielo') : null;
  if (MOMENTOS_CIELO.includes(prueba)) return prueba;
  return momentoDelDia(horaDecimal(), hoyISO()) || 'dia';
}

export function useMomento() {
  const [m, setM] = useState(momentoAhora);
  useEffect(() => {
    const mirar = () => setM(momentoAhora());
    const t = setInterval(mirar, 5 * 60 * 1000);
    const alVolver = () => { if (document.visibilityState === 'visible') mirar(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', alVolver); };
  }, []);
  return m;
}

export function CieloHora({ clase = '' }) {
  const m = useMomento();
  return (
    <span class={`cielo-hora cielo-${m}${clase ? ` ${clase}` : ''}`} data-momento={m} aria-hidden="true">
      {(m === 'amanecer' || m === 'atardecer') && <i class="cielo-sol" />}
      {m === 'dia' && <i class="cielo-luz" />}
      {m === 'noche' && ESTRELLAS_CIELO.map(([x, y, r, espera], i) => (
        <i key={i} class="cielo-estrella" style={{ left: `${x}%`, top: `${y}%`, '--tam': `${r * 2}px`, '--espera': `${espera}s` }} />
      ))}
    </span>
  );
}
