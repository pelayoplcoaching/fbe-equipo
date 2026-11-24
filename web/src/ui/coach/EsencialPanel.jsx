// FBE Esencial, el piloto: en Atletas, debajo de la lista (como «Corredores»), quienes van por su cuenta de un vistazo
// (su semana, lo de esta semana, la última sesión y sus avisos), las cifras del listón para abrirlo a todos y las
// encuestas de las semanas 6 y 12 (una tarea de texto a cada uno, que Pelayo manda cuando quiere y cuyas respuestas lee
// aquí). Sale de los resúmenes que ya tiene la lista: no pide nada más a la base salvo las encuestas.
import { useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja, useUnaVez, cuando, Segmentos } from '../comunes.jsx';
import { hoyISO } from '../../logica/fechas.js';
import { cifrasPiloto, filaPiloto, ENCUESTAS_ESENCIAL, TITULOS_ENCUESTA, LISTON_ESENCIAL } from '../../logica/esencial-piloto.js';

export function EsencialPanel({ lista = [], abrir }) {
  const { api } = useApp();
  const hoy = hoyISO();
  const suyos = lista.filter((r) => r.modalidad === 'por_su_cuenta' && r.estado !== 'invitado');
  const ids = suyos.map((r) => r.atleta_id);
  const enc = useCarga(() => api.encuestaEsencial(ids, TITULOS_ENCUESTA).catch(() => []), [ids.join()], { recuerdo: `encuesta-esencial:${ids.join()}` });
  const [hoja, setHoja] = useState(false);
  if (!suyos.length) return null;
  const c = cifrasPiloto(suyos, hoy, enc.datos || []);
  const filas = [...suyos].sort((a, b) => (a.estado === 'baja') - (b.estado === 'baja') || a.nombre.localeCompare(b.nombre, 'es'));
  return (
    <details class="panel panel-pad corr-panel" open={c.conAvisos > 0}>
      <summary class="corr-cab"><Icono n="diana" /> <strong>FBE Esencial</strong> <span class="mini terciario num">{c.siguen}</span>
        {c.conAvisos > 0 && <span class="chip corr-chip">{c.conAvisos === 1 ? '1 con avisos' : `${c.conAvisos} con avisos`}</span>}</summary>
      <p class="peq secundario">
        {c.conPlan ? `Esta semana han entrenado ${c.entrenaron} de ${c.conPlan}. ` : ''}
        {c.sesiones4.pct != null ? `Sesiones apuntadas en sus 4 últimas semanas: ${c.sesiones4.hechas} de ${c.sesiones4.total} (${c.sesiones4.pct} %; el listón, ${LISTON_ESENCIAL.sesiones} %). ` : ''}
        {c.bajas ? `De baja: ${c.bajas}. ` : ''}
        {c.encuestas.filter((e) => e.mandadas).map((e) => `Encuesta (${e.nombre.toLowerCase()}): ${e.contestadas} de ${e.mandadas} contestadas. `).join('')}
      </p>
      <ul class="corr-lista">
        {filas.map((r) => {
          const f = filaPiloto(r, hoy);
          return (
            <li key={r.atleta_id}>
              <button type="button" class="corr-fila" data-nivel={f.nivel} onClick={() => abrir(r.atleta_id)}>
                <span class="corr-nombre peq">{r.nombre}</span>
                <span class="mini corr-km">{f.semana}{f.comida ? ' · con nutrición' : ''}</span>
                <span class="mini num">{f.sesiones.total ? `${f.sesiones.completadas} de ${f.sesiones.total}` : '—'}</span>
                <span class="mini terciario corr-prox">{f.ultima}</span>
                {f.avisos.length > 0 && <span class="mini corr-avisos">{f.avisos.join(' · ')}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <div class="fila-envolver" style="margin-top:var(--esp-10)">
        <button type="button" class="btn btn-peq" onClick={() => setHoja(true)}><Icono n="mensaje" /> {c.encuesta.mandadas ? 'Las encuestas y sus respuestas' : 'Mandar la encuesta'}</button>
      </div>
      {hoja && <HojaEncuesta suyos={filas.filter((r) => r.estado !== 'baja')} tareas={enc.datos || []} alCerrar={() => setHoja(false)} alCambiar={() => enc.recargar(true)} />}
    </details>
  );
}

// Las encuestas: cuál (semana 6 o al acabar), las preguntas (se pueden retocar), «Mandarla a los N» y, debajo, quién
// no ha contestado y lo que ha contestado cada uno
function HojaEncuesta({ suyos, tareas, alCerrar, alCambiar }) {
  const { api, aviso } = useApp();
  const nombre = Object.fromEntries(suyos.map((r) => [r.atleta_id, r.nombre]));
  const de = (e) => tareas.filter((t) => t.titulo === e.titulo && nombre[t.atleta_id]);
  // (abre la primera que aún no tienen todos; si la tienen todos, la última)
  const [cual, setCual] = useState(() => (ENCUESTAS_ESENCIAL.find((e) => de(e).length < suyos.length) || ENCUESTAS_ESENCIAL[ENCUESTAS_ESENCIAL.length - 1]).id);
  const enc = ENCUESTAS_ESENCIAL.find((e) => e.id === cual) || ENCUESTAS_ESENCIAL[0];
  const [textos, setTextos] = useState({});
  const detalle = textos[enc.id] ?? enc.detalle;
  const [ocupado, una] = useUnaVez();
  const [error, setError] = useState(null);
  const suyas = de(enc);
  const ya = new Set(suyas.map((t) => t.atleta_id));
  const faltan = suyos.filter((r) => !ya.has(r.atleta_id));
  const contestadas = suyas.filter((t) => t.hecha_en);
  const sinContestar = suyas.filter((t) => !t.hecha_en).map((t) => nombre[t.atleta_id]);
  const mandar = () => una(async () => {
    setError(null);
    try {
      const n = await api.enviarEncuestaEsencial(faltan.map((r) => r.atleta_id), { titulo: enc.titulo, detalle });
      aviso(n === 1 ? 'Encuesta mandada a 1 atleta' : `Encuesta mandada a ${n} atletas`);
      alCambiar?.();
    } catch (e) { setError(e.message); }
  });
  return (
    <Hoja titulo="Las encuestas de FBE Esencial" alCerrar={alCerrar}>
      <div class="pila">
        <p class="peq secundario">Les sale como una tarea en «Tu día» y contestan en un recuadro. La de la semana 6, para su revisión (del 15 al 21 de febrero); la otra, al acabar el piloto.</p>
        <Segmentos etiqueta="Qué encuesta" opciones={ENCUESTAS_ESENCIAL.map((e) => [e.id, e.nombre])} valor={cual} alCambiar={(v) => { if (v) { setCual(v); setError(null); } }} />
        <p class="peq"><strong>{enc.titulo}</strong></p>
        <div class="campo"><label for="enc-detalle">Las preguntas</label>
          <textarea id="enc-detalle" class="entrada" rows={6} maxLength={600} value={detalle} disabled={!faltan.length}
            onInput={(e) => { const v = e.currentTarget.value; setTextos((t) => ({ ...t, [enc.id]: v })); }} /></div>
        {error && <div class="error" role="alert">{error}</div>}
        <button type="button" class="btn btn-primario" disabled={ocupado || !faltan.length || !detalle.trim()} onClick={mandar}>
          <Icono n="enviar" /> {faltan.length ? `Mandarla a ${faltan.length === 1 ? '1 atleta' : `${faltan.length} atletas`}` : 'Ya la tienen todos'}</button>
        {suyas.length > 0 && <p class="mini terciario">{sinContestar.length ? `Sin contestar: ${sinContestar.join(', ')}.` : 'Han contestado todos.'}</p>}
        {contestadas.length > 0 && (
          <section class="pila-s" aria-labelledby="enc-resp">
            <h3 id="enc-resp" class="etq">Lo que han contestado ({contestadas.length})</h3>
            {contestadas.map((t) => (
              <div key={t.id} class="pila-xs">
                <strong class="peq">{nombre[t.atleta_id]} <span class="mini terciario">{cuando(t.hecha_en)}</span></strong>
                {t.respuesta ? <p class="cita">«{t.respuesta}»</p> : <p class="mini terciario">La marcó hecha sin escribir nada.</p>}
              </div>
            ))}
          </section>
        )}
      </div>
    </Hoja>
  );
}
