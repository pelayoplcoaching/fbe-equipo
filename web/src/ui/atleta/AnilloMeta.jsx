import { Icono } from '../comunes.jsx';

// (apuntes, tanda C) El anillo del objetivo del día: se va cerrando con cada apunte
export function AnilloMeta({ n = 0, meta = 3, hecho = false, pequeno = false }) {
  const f = Math.min(1, n / Math.max(1, meta)), r = 15, c = 2 * Math.PI * r;
  return (
    <span class={`anillo-meta${hecho ? ' hecho' : ''}${pequeno ? ' pequeno' : ''}`} role="img" aria-label={hecho ? `Objetivo de hoy cumplido (${n} de ${meta})` : `Hoy, ${n} de ${meta} apuntes`}>
      <svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r={r} class="fondo" /><circle cx="18" cy="18" r={r} class="lleno" style={{ strokeDasharray: `${c * f} ${c}` }} /></svg>
      <b class="num" aria-hidden="true">{hecho ? <Icono n="hecho" /> : `${Math.min(n, meta)}/${meta}`}</b>
    </span>
  );
}

