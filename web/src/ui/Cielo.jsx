// (v0.200, belleza) El cielo de la hora: una capa de luz detrás de la portada de Hoy, de la noche de la pantalla de entrar y
// del saludo del coach. Amanecer (un resplandor rosado que sube desde abajo), día (una luz fría desde arriba), atardecer
// (el sol naranja que se pone a la derecha) y noche (estrellas que titilan y la luna en su fase de verdad). Sigue al sol
// de Madrid de cada mes (logica/cielo.js) y se mira cada cinco minutos.
// (segunda tanda) Con «conTiempo» (la portada de Hoy), si llueve, nieva, hay niebla o tormenta donde está (con la
// previsión que ya guardó la sección del tiempo: no se pide nada), también ahí; y en Nochevieja y Año Nuevo, fuegos.
// Solo adorno: aria-hidden, sin toques; con «reducir movimiento», quieto.
import { useEffect, useState } from 'preact/hooks';
import { momentoDelDia, horaDecimal, ESTRELLAS_CIELO, MOMENTOS_CIELO, lunaParaPintar, climaDeCache, esFinDeAno } from '../logica/cielo.js';
import { hoyISO } from '../logica/fechas.js';

const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const automatico = () => typeof navigator !== 'undefined' && !!navigator.webdriver;
// (las pruebas eligen el momento, el tiempo, la luna y la fiesta: en un navegador automático, si lo piden)
const prueba = (k) => (automatico() ? leer(k) : null);
function momentoAhora() {
  const p = prueba('fbe-probar-cielo');
  if (MOMENTOS_CIELO.includes(p)) return p;
  return momentoDelDia(horaDecimal(), hoyISO()) || 'dia';
}

export function useMomento() {
  const [m, setM] = useState(momentoAhora);
  const [, setTic] = useState(0);
  useEffect(() => {
    const mirar = () => { setM(momentoAhora()); setTic((n) => n + 1); };
    const t = setInterval(mirar, 5 * 60 * 1000);
    const alVolver = () => { if (document.visibilityState === 'visible') mirar(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', alVolver); };
  }, []);
  return m;
}

function climaAhora() {
  const p = prueba('fbe-probar-clima');
  if (['lluvia', 'nieve', 'niebla', 'tormenta'].includes(p)) return p;
  try { return climaDeCache(JSON.parse(leer('fbe-tiempo-cache') || 'null')); } catch { return null; }
}
function lunaAhora() {
  const p = prueba('fbe-probar-luna');
  if (p) { const ilum = Number(p.replace(/[^\d.]/g, '')); return Number.isFinite(ilum) && ilum >= 0.04 ? { ilum, creciente: !/m/.test(p), llena: ilum > 0.96 } : null; }
  return lunaParaPintar(Date.now());
}
export const fiestaAhora = () => (prueba('fbe-probar-fiesta') === '1' || esFinDeAno(hoyISO(), new Date().getHours()));

// Las gotas, los copos y los fuegos: siempre en el mismo sitio (en %, su duración y su espera, en s)
const GOTAS = [[6, 0.9, 0], [14, 1.1, -0.4], [22, 0.8, -0.7], [31, 1, -0.2], [39, 0.95, -0.9], [47, 1.15, -0.5], [55, 0.85, -0.1], [63, 1.05, -0.8], [71, 0.9, -0.3], [79, 1.1, -0.6], [87, 0.8, -0.95], [94, 1, -0.15]];
const COPOS = [[5, 7, -1], [13, 9, -5], [21, 6.5, -3], [30, 8, -7], [38, 10, -2], [46, 7.5, -6], [55, 9, -4], [63, 6.8, -8], [72, 8.5, -1.5], [80, 7.2, -5.5], [88, 9.5, -3.5], [95, 8, -6.5]];
const FUEGOS = [[22, 30, 0, 'a'], [70, 22, -0.9, 'b'], [48, 46, -1.7, 'c'], [86, 52, -2.4, 'a']];

export function CieloHora({ clase = '', conTiempo = false }) {
  const m = useMomento();
  const luna = m === 'noche' ? lunaAhora() : null;
  const clima = conTiempo ? climaAhora() : null;
  const fiesta = conTiempo && fiestaAhora();
  return (
    <span class={`cielo-hora cielo-${m}${clima ? ` con-${clima}` : ''}${clase ? ` ${clase}` : ''}`} data-momento={m} data-clima={clima || undefined} aria-hidden="true">
      {(m === 'amanecer' || m === 'atardecer') && !clima && <i class="cielo-sol" />}
      {m === 'dia' && !clima && <i class="cielo-luz" />}
      {m === 'noche' && !clima && ESTRELLAS_CIELO.map(([x, y, r, espera], i) => (
        <i key={i} class="cielo-estrella" style={{ left: `${x}%`, top: `${y}%`, '--tam': `${r * 2}px`, '--espera': `${espera}s` }} />
      ))}
      {luna && !clima && <i class={`cielo-luna${luna.llena ? ' llena' : ''}`} style={{ '--ilum': luna.ilum, '--lado': luna.creciente ? -1 : 1 }} data-ilum={luna.ilum}><b /></i>}
      {(clima === 'lluvia' || clima === 'tormenta') && GOTAS.map(([x, d, e], i) => <i key={`g${i}`} class="cielo-gota" style={{ left: `${x}%`, '--dura': `${d}s`, '--espera': `${e}s` }} />)}
      {clima === 'tormenta' && <i class="cielo-relampago" />}
      {clima === 'nieve' && COPOS.map(([x, d, e], i) => <i key={`c${i}`} class="cielo-copo" style={{ left: `${x}%`, '--dura': `${d}s`, '--espera': `${e}s` }} />)}
      {clima === 'niebla' && <><i class="cielo-niebla" /><i class="cielo-niebla otra" /></>}
      {fiesta && FUEGOS.map(([x, y, e, c], i) => <i key={`f${i}`} class={`cielo-fuego fuego-${c}`} style={{ left: `${x}%`, top: `${y}%`, '--espera': `${e}s` }} />)}
    </span>
  );
}
