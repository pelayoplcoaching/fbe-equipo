// (v0.203) Piezas de Progreso de la tanda de belleza de progreso y seguimiento: tu cuerpo en cifras (la silueta con cada
// medida en su sitio), la minilínea de un trofeo o de la cifra de tu objetivo, la tira de aros del bloque y la meta de
// un objetivo dentro de su gráfica. La ficha del coach usa la misma vista.
import { num } from '../../logica/calculos.js';
import { fmtCorta, hoyISO, sumarDias } from '../../logica/fechas.js';
import { cambiosMedidas, alturasEtiquetas } from '../../logica/progreso-visual.js';
import { Icono } from '../comunes.jsx';

export { metaFuerza, metaPeso, ritmoFrenteMeta } from '../../logica/progreso-visual.js';

// ---------------------------------------------------------------- la minilínea (decorativa)
export function MiniLinea({ valores = [], ancho = 96, alto = 28, clase = '' }) {
  const vs = (valores || []).filter(Number.isFinite);
  if (vs.length < 2) return null;
  const lo = Math.min(...vs), hi = Math.max(...vs), r = hi - lo || 1;
  const pts = vs.map((v, i) => [3 + (i * (ancho - 6)) / (vs.length - 1), 4 + (1 - (v - lo) / r) * (alto - 8)]);
  const [ux, uy] = pts[pts.length - 1];
  return (
    <svg class={`mini-linea ${clase}`} viewBox={`0 0 ${ancho} ${alto}`} width={ancho} height={alto} aria-hidden="true" focusable="false">
      <polyline points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} />
      <circle cx={ux} cy={uy} r="2.8" />
    </svg>
  );
}

// ---------------------------------------------------------------- tu cuerpo en cifras
// Cada medida en su sitio de la figura (coordenadas de una figura de 100 × 200): a la izquierda pecho, cintura y muslo;
// a la derecha brazo, cadera y pantorrilla (así no se pisan las etiquetas). bx: dónde toca el cuerpo la línea guía.
const SITIOS = {
  pecho_cm: { lado: 'izq', y: 44, bx: 33 }, cintura_cm: { lado: 'izq', y: 90, bx: 38 }, muslo_cm: { lado: 'izq', y: 128, bx: 37 },
  brazo_cm: { lado: 'der', y: 60, bx: 76 }, cadera_cm: { lado: 'der', y: 106, bx: 62 }, pantorrilla_cm: { lado: 'der', y: 166, bx: 57 },
};
const FIGURA = [
  'M50 5a9.5 9.5 0 1 0 0.01 0z',
  'M45 24h10l1 7H44z',
  'M36 32h28q8 8 4 28-4 18-6 32 2 8 0 14H38q-2-6 0-14-2-14-6-32-4-20 4-28z',
  'M24 41q-6 4-6 12-1 18 0 42 2 4 5 0 1-18 4-30 2-12 9-20-6-6-12-4z',
  'M76 41q6 4 6 12 1 18 0 42-2 4-5 0-1-18-4-30-2-12-9-20 6-6 12-4z',
  'M38 106q-4 22-1 46 1 18 1 36h8q1-18 2-36 1-20 1-46z',
  'M62 106q4 22 1 46-1 18-1 36h-8q-1-18-2-36-1-20-1-46z',
];
export function CuerpoEnCifras({ medidas, claves, elegida, alElegir }) {
  const lista = cambiosMedidas(medidas, claves).filter((c) => SITIOS[c.k]);
  if (!lista.length) return null;
  const alturas = {};
  for (const lado of ['izq', 'der']) {
    const deLado = lista.filter((c) => SITIOS[c.k].lado === lado);
    alturasEtiquetas(deLado.map((c) => SITIOS[c.k].y)).forEach((y, i) => { alturas[deLado[i].k] = y; });
  }
  const etiqueta = (c) => {
    const dir = c.cambio > 0 ? 'sube' : c.cambio < 0 ? 'baja' : 'igual';
    return (
      <button key={c.k} type="button" class={`cc-etq ${dir} ${c.k === elegida ? 'elegida' : ''}`} style={{ '--y': alturas[c.k].toFixed(1) }} aria-pressed={c.k === elegida ? 'true' : 'false'}
        aria-label={`${c.t}: ${num(c.valor)} cm${c.cambio != null ? `, ${c.cambio === 0 ? 'igual' : `${num(Math.abs(c.cambio))} cm ${c.cambio > 0 ? 'más' : 'menos'}`} desde el ${fmtCorta(c.desde)}` : ''}`}
        onClick={() => alElegir(c.k)}>
        <span class="cc-nombre" aria-hidden="true">{c.t}</span>
        <span class="cc-l2" aria-hidden="true">
          <span class="cc-valor num">{num(c.valor)}<small> cm</small></span>
          {c.cambio != null && <span class="cc-cambio num">{c.cambio !== 0 && <Icono n={c.cambio > 0 ? 'arriba' : 'abajo'} />}{c.cambio > 0 ? '+' : c.cambio < 0 ? '−' : '±'}{num(Math.abs(c.cambio))}</span>}
        </span>
      </button>
    );
  };
  return (
    <div class="cuerpo-cifras" role="group" aria-label="Medida">
      <div class="cc-lado izq">{lista.filter((c) => SITIOS[c.k].lado === 'izq').map(etiqueta)}</div>
      <svg class="cc-figura" viewBox="0 0 100 200" aria-hidden="true" focusable="false">
        {FIGURA.map((d, i) => <path key={i} class="cc-cuerpo" d={d} />)}
        {lista.map((c) => {
          const s = SITIOS[c.k];
          // la guía va recta desde el cuerpo y, cerca del borde, se dobla hacia su etiqueta (que puede ir algo desplazada)
          const yl = alturas[c.k] * 2;
          const pts = s.lado === 'izq' ? `${s.bx},${s.y} 9,${s.y} 0,${yl}` : `${s.bx},${s.y} 91,${s.y} 100,${yl}`;
          return <polyline key={c.k} class={`cc-guia ${c.k === elegida ? 'elegida' : ''}`} points={pts} />;
        })}
        {lista.map((c) => { const s = SITIOS[c.k]; return <circle key={c.k} class={`cc-punto ${c.k === elegida ? 'elegida' : ''}`} cx={s.bx} cy={s.y} r="2.4" />; })}
      </svg>
      <div class="cc-lado der">{lista.filter((c) => SITIOS[c.k].lado === 'der').map(etiqueta)}</div>
    </div>
  );
}

// ---------------------------------------------------------------- el bloque, en aros
// filas: [{ n, hechas, total, fecha_inicio }] de las semanas del bloque; la de esta semana, resaltada
export function BloqueAros({ filas = [], hoy = hoyISO() }) {
  if (!filas.length) return null;
  const actual = (f) => f.fecha_inicio && f.fecha_inicio <= hoy && hoy <= sumarDias(f.fecha_inicio, 6);
  return (
    <ol class="bloque-aros" aria-label="Las semanas de este bloque">
      {filas.map((f) => {
        const p = f.total ? Math.min(1, f.hechas / f.total) : 0;
        const ahora = actual(f);
        return (
          <li key={f.n} class={ahora ? 'actual' : ''}>
            <span class="sr">Semana {f.n}: {f.hechas} de {f.total} sesiones{ahora ? ', esta semana' : ''}</span>
            <span class={`sello-semana ${p >= 1 ? 'completa' : ''}`} style={{ '--p': p.toFixed(3) }} aria-hidden="true">
              <span class="ss-n num">{f.hechas}<small>/{f.total}</small></span>
            </span>
            <span class="mini" aria-hidden="true">S{f.n}</span>
          </li>
        );
      })}
    </ol>
  );
}
