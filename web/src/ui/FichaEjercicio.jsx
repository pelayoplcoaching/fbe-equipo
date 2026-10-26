import { useState } from 'preact/hooks';
import { Pestanas, Siluetas, useApp, useCarga, Icono, Hoja, Segmentos, Grafica, Vacio } from './comunes.jsx';
import { textoSerie, num, NOMBRE_GRUPO } from '../logica/calculos.js';
import { serieSemanal, recortarRango, metricasDe, tablaRecords, RANGOS } from '../logica/ejercicio.js';
import { fmtCorta, hoyISO } from '../logica/fechas.js';

// Ficha de un ejercicio (como en Strong o Hevy): gráficas por semana con rango, récords de 1 a 12
// repeticiones (real frente a estimado), historial completo y la técnica si la hay.
export function FichaEjercicio({ atletaId, ejercicio, alCerrar, inicial = 'graficas' }) {
  const { api } = useApp();
  const h = useCarga(() => api.historialEjercicio(atletaId, ejercicio.id), [atletaId, ejercicio.id]);
  const d = h.datos;
  const tecnica = !!(ejercicio.instrucciones || ejercicio.errores || ejercicio.video_url);
  const [vista, setVista] = useState(inicial);
  const pestanas = [['graficas', 'Gráficas'], ['records', 'Récords'], ['historial', 'Historial'], ...(tecnica ? [['tecnica', 'Técnica']] : [])];
  const grupos = (ejercicio.grupos_musculares || []).map((g) => NOMBRE_GRUPO[g]).filter(Boolean).join(', ');
  return (
    <Hoja titulo={ejercicio.nombre} alCerrar={alCerrar} ancho={680}>
      {grupos && <p class="peq secundario" style="margin-top:-6px">{grupos}</p>}
      <Pestanas opciones={pestanas} valor={vista} alCambiar={setVista} etiqueta="Ficha del ejercicio" clase="pestanas-ficha" idBase="fej" />
      <div class="pestana-panel" role="tabpanel" id="fej-panel" aria-labelledby={`fej-${vista}`} key={vista}>
        {vista === 'tecnica' ? <Tecnica ejercicio={ejercicio} />
          : h.cargando && !d ? <Siluetas forma="grafica" texto="Cargando el ejercicio" />
            : !d?.sesiones.length ? <Vacio icono="historial" titulo="Aún no hay series de este ejercicio" />
              : vista === 'graficas' ? <Graficas d={d} nombre={ejercicio.nombre} />
                : vista === 'records' ? <Records d={d} />
                  : <Historial d={d} />}
      </div>
    </Hoja>
  );
}

function Graficas({ d, nombre }) {
  const metricas = metricasDe(d.series);
  const [metrica, setMetrica] = useState(metricas[0].id);
  const [rango, setRango] = useState('6m');
  const m = metricas.find((x) => x.id === metrica) || metricas[0];
  const todos = serieSemanal(d.series, m.id);
  const puntos = recortarRango(todos, rango, hoyISO());
  const primero = puntos[0], ultimo = puntos[puntos.length - 1];
  const cambio = puntos.length > 1 && m.id !== 'volumen' && primero.valor > 0 ? Math.round(((ultimo.valor - primero.valor) / primero.valor) * 1000) / 10 : null;
  return (
    <div class="pila">
      {d.mejor && m.id === 'e1rm' && (
        <div class="cifra">
          <span class="v num">{num(d.mejor.valor)}</span><span class="u">kg de 1RM estimado (tu mejor)</span>
          <span class="chip morado num">{num(d.mejor.serie.kg, 2)} × {d.mejor.serie.reps}{d.mejor.serie.rpe ? ` @${num(d.mejor.serie.rpe)}` : ''}, {fmtCorta(d.mejor.fecha)}</span>
        </div>
      )}
      {metricas.length > 1 && <Segmentos opciones={metricas.map((x) => [x.id, x.corto || x.nombre, x.nombre])} valor={m.id} etiqueta="Qué ver" alCambiar={(v) => v && setMetrica(v)} clase="seg-compacto" />}
      {puntos.length > 1
        ? <Grafica puntos={puntos.map((p) => ({ x: p.semana, y: p.valor }))} unidad={m.unidad} dec={m.dec} alto={170} etiqueta={`${m.nombre} por semana en ${nombre}`} />
        : <p class="peq secundario">{todos.length > 1 ? 'En este rango hay menos de dos semanas con datos: prueba uno más amplio.' : 'Con dos semanas de datos verás aquí la gráfica.'}</p>}
      <div class="separa" style="flex-wrap:wrap">
        <Segmentos opciones={RANGOS.map(([id, t]) => [id, t])} valor={rango} etiqueta="Rango" alCambiar={(v) => v && setRango(v)} clase="seg-compacto" />
        {cambio != null && <span class={`chip num ${cambio > 0 ? 'ok' : ''}`}>{cambio > 0 ? '+' : ''}{num(cambio, 1)} % en el rango</span>}
      </div>
      <p class="mini terciario">{m.id === 'e1rm' ? 'Mejor 1RM estimado de cada semana (Epley con las repeticiones en recámara).' : m.id === 'carga' ? 'La carga más alta de cada semana, a cualquier número de repeticiones.' : m.id === 'volumen' ? 'Kilos totales de cada semana: carga × repeticiones de todas las series.' : 'Las repeticiones de la mejor serie de cada semana.'}</p>
    </div>
  );
}

function Records({ d }) {
  const filas = tablaRecords(d.series, d.mejor?.valor || null);
  if (!filas.length) return <p class="peq secundario">Sin series con carga todavía.</p>;
  return (
    <div class="pila-s">
      <div class="tabla-env">
        <table class="tabla-simple tabla-records">
          <thead><tr><th>Reps</th><th>Tu mejor</th><th>Estimado</th></tr></thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.reps} class={f.real && f.estimado && f.real.kg >= f.estimado ? 'supera' : ''}>
                <th scope="row" class="num">{f.reps} RM</th>
                <td class="num">{f.real ? <><b>{num(f.real.kg, 2)} kg</b><span class="mini terciario"> {fmtCorta(f.real.fecha)}{f.real.rpe ? `, @${num(f.real.rpe)}` : ''}</span></> : <span class="terciario">—</span>}</td>
                <td class="num secundario">{f.estimado ? `${num(f.estimado, 1)} kg` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p class="mini terciario">«Tu mejor»: lo más pesado que has movido a exactamente esas repeticiones (con el RPE si lo apuntaste). «Estimado»: lo que saldría de tu mejor 1RM estimado yendo al fallo; en verde, donde ya lo igualas o superas.</p>
    </div>
  );
}

function Historial({ d }) {
  const [cuantas, setCuantas] = useState(15);
  return (
    <div class="pila-s">
      <ul class="lista historial">
        {d.sesiones.slice(0, cuantas).map((s) => (
          <li key={s.sesion_id || s.fecha} class="historial-fila">
            <span class="peq secundario">{fmtCorta(s.fecha)}</span>
            <span class="registro-serie">{s.series.map((x) => textoSerie(x)).join(', ')}</span>
            <span class="num peq">{s.record ? <span class="chip ok"><Icono n="trofeo" />{num(s.mejor)}</span> : s.mejor ? num(s.mejor) : '—'}</span>
          </li>
        ))}
      </ul>
      {d.sesiones.length > cuantas && <button class="btn btn-peq" style="justify-self:start" onClick={() => setCuantas(cuantas + 30)}>Ver más ({d.sesiones.length - cuantas})</button>}
      <p class="mini terciario">A la derecha, el 1RM estimado de la mejor serie de cada día; en verde, cuando fue récord.</p>
    </div>
  );
}

function Tecnica({ ejercicio: e }) {
  const parrafos = (t) => t.split(/\n{2,}/).map((p, i) => <p key={i} class="secundario" style="white-space:pre-line">{p}</p>);
  return (
    <div class="pila">
      {e.rango_reps && <p class="peq"><span class="terciario">Rango recomendado: </span>{e.rango_reps}</p>}
      {e.instrucciones && <section class="pila-s"><h3 class="peq">Claves</h3>{parrafos(e.instrucciones)}</section>}
      {e.errores && <section class="pila-s"><h3 class="peq">Errores comunes</h3>{parrafos(e.errores)}</section>}
      {e.video_url && <a class="btn" href={e.video_url} target="_blank" rel="noopener" style="justify-self:start"><Icono n="video" /> Ver el vídeo de técnica</a>}
    </div>
  );
}
