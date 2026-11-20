// (v0.200, belleza) El aro de la semana alrededor de una foto: lo hecho de lo previsto, a tramos si son pocas sesiones
// (como los anillos de la semana) y en verde cuando está completa. Solo adorno (aria-hidden): lo que dice ya está en la
// pantalla (las sesiones de Hoy, las de la lista).
import { aroSemana } from '../logica/belleza.js';

const R = 18.5, C = 2 * Math.PI * R, HUECO = 2.2;

export function ConAro({ hechas, total, children }) {
  const aro = aroSemana(hechas, total);
  if (!aro) return children;
  const arcos = aro.tramos
    ? Array.from({ length: aro.tramos }, (_, i) => i).filter((i) => i < aro.hechas).map((i) => {
      const seg = C / aro.tramos;
      return { dash: `${Math.max(0.1, seg - HUECO)} ${C - seg + HUECO}`, off: -i * seg - HUECO / 2 };
    })
    : aro.parte > 0 ? [{ dash: `${C * aro.parte} ${C}`, off: 0 }] : [];
  const pistas = aro.tramos
    ? Array.from({ length: aro.tramos }, (_, i) => { const seg = C / aro.tramos; return { dash: `${Math.max(0.1, seg - HUECO)} ${C - seg + HUECO}`, off: -i * seg - HUECO / 2 }; })
    : [{ dash: null, off: 0 }];
  return (
    <span class={`con-aro${aro.completa ? ' completa' : ''}`} data-aro={`${aro.hechas}/${aro.total}`}>
      {children}
      <svg class="aro-semana" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
        {pistas.map((p, i) => <circle key={`p${i}`} class="aro-pista" cx="20" cy="20" r={R} stroke-dasharray={p.dash || undefined} stroke-dashoffset={p.off || undefined} />)}
        {arcos.map((a, i) => <circle key={`l${i}`} class="aro-lleno" cx="20" cy="20" r={R} stroke-dasharray={a.dash} stroke-dashoffset={a.off} />)}
      </svg>
    </span>
  );
}
