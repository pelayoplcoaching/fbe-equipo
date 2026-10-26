import { NOMBRE_ESTADO_OBJETIVO, num, signo } from '../logica/calculos.js';
import { textoMarca } from '../logica/objetivos.js';
import { fmtCorta, hoyISO, diasEntre } from '../logica/fechas.js';

// Un objetivo en Progreso (atleta) o en la ficha (coach). Si está enlazado a un ejercicio, el progreso es automático.
export function TarjetaObjetivo({ o, esCoach = false }) {
  const a = o.auto;
  const hoy = hoyISO();
  const quedan = o.fecha_limite ? diasEntre(hoy, o.fecha_limite) : null;
  const pct = a ? a.pct : o.progreso_pct;
  const conseguido = a?.conseguido || o.estado === 'completado';
  const plazo = o.fecha_limite ? `para el ${fmtCorta(o.fecha_limite)}${quedan >= 0 ? ` (quedan ${quedan} días)` : ''}` : '';
  return (
    <li class={`panel-pad pila-s objetivo ${a ? 'auto' : ''}`}>
      <div class="separa">
        <strong>{o.titulo}</strong>
        <span class={`chip ${conseguido ? 'ok' : o.estado === 'en_curso' ? 'morado' : ''}`}>
          {a?.conseguido ? `Conseguido el ${fmtCorta(a.conseguido.fecha)}` : NOMBRE_ESTADO_OBJETIVO[o.estado]}
        </span>
      </div>
      {o.descripcion && <p class="peq secundario">{o.descripcion}</p>}
      <div class={`progreso-barra ${conseguido ? 'hecho' : ''}`} role="img" aria-label={`Progreso: ${pct} %`}><span style={{ width: `${pct}%` }} /></div>
      {a ? (
        <div class="pila-xs">
          <span class="mini secundario num">
            {pct} %{a.actual != null && a.meta ? `: 1RM estimado de ${num(a.actual)} kg ${Number(o.reps_objetivo) > 1 ? `de los ${num(a.meta)} que supone ${textoMarca(o.kg_objetivo, o.reps_objetivo)}` : `de ${num(a.meta)} kg`}`
              : a.sinRecientes ? `: sin series de ${o.ejercicio || 'este ejercicio'} en las últimas 6 semanas` : a.actual == null ? `: aún sin series de ${o.ejercicio || 'este ejercicio'}` : ''}
            {a.inicio != null && a.actual != null && a.meta ? ` (empezó en ${num(a.inicio)})` : ''}
          </span>
          {a.conseguido && <span class="mini ok-t">{esCoach ? 'Lo hizo' : 'Lo hiciste'}: {num(Number(a.conseguido.serie.kg), 2)} kg × {a.conseguido.serie.reps}{a.conseguido.serie.rpe ? ` @${num(Number(a.conseguido.serie.rpe))}` : ''}.</span>}
          {a.yaLoPermite && <span class="mini ok-t">{esCoach ? 'Su 1RM estimado ya lo permite: ponle el día para intentarlo.' : 'Tu 1RM estimado ya lo permite: tu coach te dirá el día para intentarlo.'}</span>}
          {a.prevision && (
            <span class={`mini ${a.prevision.aTiempo === false ? 'aviso-t' : 'terciario'}`}>
              A este ritmo ({signo(a.prevision.ritmo, 1)} kg por semana), hacia el {fmtCorta(a.prevision.fecha)}{a.prevision.aTiempo === true ? ': a tiempo' : a.prevision.aTiempo === false ? ': más tarde de la fecha' : ''}.
            </span>
          )}
          {plazo && <span class="mini terciario">Objetivo {plazo}.</span>}
        </div>
      ) : (
        <span class="mini terciario">{pct} %{plazo ? `, ${plazo}` : ''}</span>
      )}
    </li>
  );
}
