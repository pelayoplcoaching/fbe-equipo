import { useApp, useCarga, Icono, Hoja, Siluetas, Vacio, ErrorCaja, useAncho } from '../comunes.jsx';
import { NOMBRE_FOCO, num } from '../../logica/calculos.js';
import { rangoSemana } from '../../logica/fechas.js';

const ESTADO = { hecha: 'Hecha', pasada: 'Pasada', actual: 'Esta semana', siguiente: 'Publicada', por_publicar: 'Por publicar' };

// «Tu bloque» (v0.48): el bloque entero, semana a semana. De las que tu coach aún no ha publicado, solo que vienen.
export function HojaBloque({ alCerrar, abrirSesion, atletaId = null, titulo = 'Tu bloque' }) {
  const { api, atleta } = useApp();
  const id = atletaId || atleta.id;
  const d = useCarga(() => api.tuBloque(id), [id]);
  const v = d.datos;
  return (
    <Hoja titulo={v?.bloque ? `${titulo}: ${v.bloque.nombre}` : titulo} alCerrar={alCerrar} ancho={720} medio>
      <ErrorCaja error={d.error} reintentar={d.recargar} />
      {d.cargando && !v ? <Siluetas forma="filas" n={4} texto="Cargando tu bloque" /> : !v ? (
        <Vacio ilustracion="espera" titulo="Tu bloque aún no está publicado">Cuando tu coach publique tu primera semana, aquí verás el bloque entero.</Vacio>
      ) : (
        <div class="pila">
          <p class="peq secundario">
            Bloque {v.bloque.numero}{v.bloque.foco ? `, ${NOMBRE_FOCO[v.bloque.foco]?.toLowerCase() || ''}` : ''}: {v.semanas.length} {v.semanas.length === 1 ? 'semana' : 'semanas'}
            {v.total ? `, ${v.hechas} de ${v.total} sesiones hechas` : ''}{v.porPublicar ? `. ${v.porPublicar === 1 ? 'Una semana está' : `${v.porPublicar} semanas están`} por publicar: tu coach la${v.porPublicar === 1 ? '' : 's'} prepara con lo que vas haciendo.` : '.'}
          </p>
          <ol class="bloque-semanas">
            {v.semanas.map((w) => (
              <li key={w.numero} class={`bloque-semana ${w.estado}`}>
                <div class="separa">
                  <strong>Semana {w.numero}{w.fecha_inicio ? <span class="peq secundario">, {rangoSemana(w.fecha_inicio)}</span> : null}</strong>
                  <span class={`chip ${w.estado === 'hecha' ? 'ok' : w.estado === 'actual' ? 'morado' : ''}`}>{ESTADO[w.estado]}</span>
                </div>
                {w.publicada ? (
                  <>
                    {w.foco && <span class="mini terciario">{w.descarga ? 'Descarga: algo menos de carga para recuperar' : `Foco: ${NOMBRE_FOCO[w.foco]?.toLowerCase()}`}</span>}
                    <div class="bloque-sesiones">
                      {w.sesiones.map((s) => (
                        <button key={s.id} type="button" class={`bloque-sesion ${s.completada ? 'hecha' : ''}`} onClick={() => abrirSesion?.(s.id)} disabled={!abrirSesion}
                          aria-label={`${s.nombre}: ${s.completada ? 'hecha' : 'pendiente'}`}>
                          <span aria-hidden="true">{s.completada ? <Icono n="hecho" /> : <Icono n="hoy" />}</span>{s.nombre}
                        </button>
                      ))}
                      {!w.sesiones.length && <span class="mini terciario">Sin sesiones</span>}
                    </div>
                  </>
                ) : <span class="mini terciario">Tu coach aún no la ha publicado.</span>}
              </li>
            ))}
          </ol>
          {v.principales.length > 0 && (
            <section class="pila-s">
              <h3 class="sub-seccion">Tus ejercicios principales</h3>
              <p class="mini terciario">La carga más alta pautada y la que hiciste, semana a semana (solo los obligatorios).</p>
              {v.principales.map((e) => <GraficaCarga key={e.id} ejercicio={e} />)}
            </section>
          )}
        </div>
      )}
    </Hoja>
  );
}

// Lo pautado (discontinuo) y lo hecho (línea), semana a semana
function GraficaCarga({ ejercicio }) {
  const [W, ref] = useAncho();
  const pts = ejercicio.puntos;
  const H = 120, izq = 34, der = 12, arr = 12, abj = 20;
  const vals = pts.flatMap((p) => [p.pautado, p.hecho]).filter((x) => x != null);
  if (!vals.length) return null;
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 5) { lo -= 2.5; hi += 2.5; }
  const X = (i) => izq + (pts.length === 1 ? (W - izq - der) / 2 : (i * (W - izq - der)) / (pts.length - 1));
  const Y = (v) => arr + (1 - (v - lo) / (hi - lo)) * (H - arr - abj);
  const linea = (k) => {
    let d = '', abierta = false;
    pts.forEach((p, i) => { if (p[k] == null) { abierta = false; return; } d += `${abierta ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p[k]).toFixed(1)} `; abierta = true; });
    return d.trim();
  };
  const ult = [...pts].reverse().find((p) => p.hecho != null);
  const texto = pts.map((p) => `S${p.numero}: ${p.pautado != null ? `${num(p.pautado, 2)} kg pautados` : 'sin carga pautada'}${p.hecho != null ? `, ${num(p.hecho, 2)} kg hechos` : ''}`).join('; ');
  return (
    <div class="panel panel-pad pila-xs grafica-bloque">
      <div class="separa"><strong class="peq">{ejercicio.nombre}</strong>{ult && <span class="mini num secundario">S{ult.numero}: {num(ult.hecho, 2)} kg</span>}</div>
      <svg class="grafica" ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${ejercicio.nombre}. ${texto}`}>
        {[lo + (hi - lo) * 0.2, lo + (hi - lo) * 0.8].map((t) => (
          <g key={t}><line class="eje" x1={izq} x2={W - der} y1={Y(t)} y2={Y(t)} stroke-dasharray="2 4" /><text x={izq - 6} y={Y(t) + 4} text-anchor="end">{num(Math.round(t * 2) / 2, 1)}</text></g>
        ))}
        <path class="linea pautada" d={linea('pautado')} />
        <path class="linea" d={linea('hecho')} />
        {pts.map((p, i) => p.hecho != null && <circle key={i} class="punto" cx={X(i)} cy={Y(p.hecho)} r="3.2" />)}
        {pts.map((p, i) => <text key={`t${i}`} x={X(i)} y={H - 4} text-anchor="middle">S{p.numero}</text>)}
      </svg>
      <span class="mini terciario leyenda-bloque"><span class="leyenda-linea pautada" aria-hidden="true" />Pautado <span class="leyenda-linea" aria-hidden="true" />Hecho</span>
    </div>
  );
}
