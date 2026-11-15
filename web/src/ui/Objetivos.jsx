import { NOMBRE_ESTADO_OBJETIVO, num, signo } from '../logica/calculos.js';
import { textoMarca } from '../logica/objetivos.js';
import { tipoDeObjetivo, ritmoCarrera } from '../logica/objetivos-atleta.js';
import { fmtCorta, hoyISO, diasEntre } from '../logica/fechas.js';
import { pesoNum, pesoTxt, difVista, etiquetaPeso } from '../logica/unidades.js';

// Un objetivo en Progreso (atleta) o en la ficha (coach). Si está enlazado a un ejercicio, el progreso es automático.
export function TarjetaObjetivo({ o, esCoach = false }) {
  const a = o.auto;
  // (v0.173) los de peso corporal (su progreso sale de su tendencia) y los de carrera
  const w = !a ? o.autoPeso || null : null;
  const tipo = tipoDeObjetivo(o);
  const hoy = hoyISO();
  const quedan = o.fecha_limite ? diasEntre(hoy, o.fecha_limite) : null;
  const pct = a ? a.pct : w && o.estado !== 'completado' ? w.pct : o.progreso_pct;
  const conseguido = a?.conseguido || o.estado === 'completado';
  const plazo = o.fecha_limite ? `para el ${fmtCorta(o.fecha_limite)}${quedan >= 0 ? ` (quedan ${quedan} días)` : ''}` : '';
  return (
    <li class={`panel-pad pila-s objetivo ${a || w ? 'auto' : ''}`} data-tipo={tipo}>
      <div class="separa">
        <strong>{o.titulo}</strong>
        <span class={`chip ${conseguido ? 'ok' : o.estado === 'en_curso' ? 'morado' : ''}`}>
          {a?.conseguido ? `Conseguido el ${fmtCorta(a.conseguido.fecha)}` : NOMBRE_ESTADO_OBJETIVO[o.estado]}
        </span>
      </div>
      {o.descripcion && <p class="peq secundario">{o.descripcion}</p>}
      {o.propuesto_por_atleta && <span class="mini terciario">{esCoach ? 'Lo propuso el atleta.' : 'Lo propusiste tú.'}</span>}
      <div class={`progreso-barra ${conseguido ? 'hecho' : ''}`} role="img" aria-label={`Progreso: ${pct} %`}><span style={{ width: `${pct}%` }} /></div>
      {a ? (
        <div class="pila-xs">
          <span class="mini secundario num">
            {pct} %{a.actual != null && a.meta ? `: 1RM estimado de ${pesoTxt(a.actual, 1)} ${Number(o.reps_objetivo) > 1 ? `de los ${pesoNum(a.meta, 1)} que supone ${textoMarca(o.kg_objetivo, o.reps_objetivo)}` : `de ${pesoTxt(a.meta, 1)}`}`
              : a.sinRecientes ? `: sin series de ${o.ejercicio || 'este ejercicio'} en las últimas 6 semanas` : a.actual == null ? `: aún sin series de ${o.ejercicio || 'este ejercicio'}` : ''}
            {a.inicio != null && a.actual != null && a.meta ? ` (empezó en ${pesoNum(a.inicio, 1)})` : ''}
          </span>
          {a.conseguido && <span class="mini ok-t">{esCoach ? 'Lo hizo' : 'Lo hiciste'}: {pesoTxt(Number(a.conseguido.serie.kg), 2)} × {a.conseguido.serie.reps}{a.conseguido.serie.rpe ? ` @${num(Number(a.conseguido.serie.rpe))}` : ''}.</span>}
          {a.yaLoPermite && <span class="mini ok-t">{esCoach ? 'Su 1RM estimado ya lo permite: ponle el día para intentarlo.' : 'Tu 1RM estimado ya lo permite: tu coach te dirá el día para intentarlo.'}</span>}
          {a.prevision && (
            <span class={`mini ${a.prevision.aTiempo === false ? 'aviso-t' : 'terciario'}`}>
              A este ritmo ({signo(difVista(a.prevision.ritmo), 1)} {etiquetaPeso()} por semana), hacia el {fmtCorta(a.prevision.fecha)}{a.prevision.aTiempo === true ? ': a tiempo' : a.prevision.aTiempo === false ? ': más tarde de la fecha' : ''}.
            </span>
          )}
          {plazo && <span class="mini terciario">Objetivo {plazo}.</span>}
        </div>
      ) : w ? (
        <div class="pila-xs">
          <span class="mini secundario num">
            {pct} %{w.actual != null ? `: tendencia de ${num(w.actual)} kg, hacia ${num(w.meta)} kg` : w.sinPesos ? `: aún sin pesos (objetivo: ${num(w.meta)} kg)` : `: sin pesos en las últimas 2 semanas (objetivo: ${num(w.meta)} kg)`}
            {w.inicio != null && w.actual != null ? ` (empezó en ${num(w.inicio)})` : ''}
          </span>
          {w.llegado && <span class="mini ok-t">{esCoach ? 'Su tendencia ya está en el objetivo.' : 'Tu tendencia ya está en tu objetivo.'}</span>}
          {w.prevision && (
            <span class={`mini ${w.prevision.aTiempo === false ? 'aviso-t' : 'terciario'}`}>
              A este ritmo ({signo(w.prevision.ritmo, 2)} kg por semana), hacia el {fmtCorta(w.prevision.fecha)}{w.prevision.aTiempo === true ? ': a tiempo' : w.prevision.aTiempo === false ? ': más tarde de la fecha' : ''}.
            </span>
          )}
          {w.alejandose && <span class="mini terciario">{esCoach ? 'Ahora mismo su tendencia va en el otro sentido.' : 'Ahora mismo tu tendencia va en el otro sentido: háblalo con tu coach.'}</span>}
          {plazo && <span class="mini terciario">Objetivo {plazo}.</span>}
        </div>
      ) : (
        <span class="mini terciario">{pct} %{tipo === 'carrera' && o.distancia_km && o.tiempo_seg ? `: a ${ritmoCarrera(o.distancia_km, o.tiempo_seg)}` : ''}{plazo ? `, ${plazo}` : ''}</span>
      )}
    </li>
  );
}
