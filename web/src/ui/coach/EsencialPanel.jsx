// FBE Esencial, el piloto: en Atletas, debajo de la lista (como «Corredores»), quienes van por su cuenta de un vistazo
// (su semana, lo de esta semana, la última sesión y sus avisos), las cifras del listón para abrirlo a todos y las
// encuestas de las semanas 6 y 12 (una tarea de texto a cada uno, que Pelayo manda cuando quiere y cuyas respuestas lee
// aquí). Sale de los resúmenes que ya tiene la lista: no pide nada más a la base salvo las encuestas y, con la 097, el
// alta de cada uno (su invitación, su cuenta, sus avisos, su cuestionario, el visto bueno, su plan y su primera sesión).
import { useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja, useUnaVez, cuando, Segmentos } from '../comunes.jsx';
import { hoyISO, sumarDias } from '../../logica/fechas.js';
import { cifrasPiloto, filaPiloto, ENCUESTAS_ESENCIAL, TITULOS_ENCUESTA, LISTON_ESENCIAL, embudoAlta, sinActivarAlta } from '../../logica/esencial-piloto.js';
import { diasInvitacion } from '../../logica/esencial.js';
import { fechaLarga } from '../../logica/esencial-alta.js';
import { listosLunes } from '../../logica/esencial-espera.js';
import { Invitaciones } from './EsencialAltas.jsx';
import { perezoso } from '../perezoso.jsx';

// (v0.245, migración 100) las preguntas para el directo de quienes van por su cuenta
const PreguntasDirecto = perezoso(() => import('./EsencialPreguntas.jsx'), 'PreguntasDirecto', { mientras: null });
// (v0.246) a quién escribir (con el mensaje preparado) y lo que contestan a «¿Cómo vamos?»
const AQuienEscribir = perezoso(() => import('./EsencialPreguntas.jsx'), 'AQuienEscribir', { mientras: null });
const ComoVamosCoach = perezoso(() => import('./EsencialPreguntas.jsx'), 'ComoVamosCoach', { mientras: null });
const ResumenSemana = perezoso(() => import('./EsencialPreguntas.jsx'), 'ResumenSemana', { mientras: null });

const CIERRE = { pasar: 'pasó a la siguiente', auto: 'no eligió: se le pasó a la siguiente', repetir: 'repite la semana', pausa: 'semana en pausa' };
const RESULTADO = { valorar_antes_vigoroso: 'su cribado: valorar antes de lo vigoroso', valorar_antes: 'su cribado: valorar antes de empezar', parar_y_valorar: 'su cribado: parar y valorar' };

export function EsencialPanel({ lista = [], abrir, mandarCodigo }) {
  const { api } = useApp();
  const hoy = hoyISO();
  const suyos = lista.filter((r) => r.modalidad === 'por_su_cuenta' && r.estado !== 'invitado');
  const ids = suyos.map((r) => r.atleta_id);
  const todos = lista.filter((r) => r.modalidad === 'por_su_cuenta').map((r) => `${r.atleta_id}:${r.estado}`).join();
  const enc = useCarga(() => api.encuestaEsencial(ids, TITULOS_ENCUESTA).catch(() => []), [ids.join()], { recuerdo: `encuesta-esencial:${ids.join()}` });
  // (alta, 097) el alta de cada uno; sin la 097, null (se ve lo de antes)
  const alta = useCarga(() => (todos ? api.esencialAltaEstado().catch(() => null) : Promise.resolve(null)), [todos], { recuerdo: `alta-esencial:${todos}` });
  // (sin coach, 38; 098) cómo han cerrado la semana: quién repite, quién está en pausa y a quién se le pasó sola
  const cierres = useCarga(() => (todos && api.esencialCierres ? api.esencialCierres(sumarDias(hoyISO(), -13)).catch(() => []) : Promise.resolve([])), [todos], { recuerdo: `cierres-esencial:${todos}` });
  // (sin coach, 53 y 58; 099) la rutina de cada uno: cuál lleva, desde cuándo, si es de las recomendadas y sus cambios
  const rutinas = useCarga(() => (todos && api.esencialRutinas ? api.esencialRutinas().catch(() => []) : Promise.resolve([])), [todos], { recuerdo: `rutinas-esencial:${todos}` });
  const [verRutinas, setVerRutinas] = useState(false);
  const [hoja, setHoja] = useState(false);
  const [reenvio, setReenvio] = useState(false);
  const invitados = lista.filter((r) => r.modalidad === 'por_su_cuenta' && r.estado === 'invitado');
  if (!suyos.length && !invitados.length) return null;
  const altas = alta.datos || null;
  const altaDe = new Map((altas || []).map((a) => [a.atleta_id, a]));
  const c = cifrasPiloto(lista, hoy, enc.datos || [], altas);   // (con todos: cuenta también a quien aún no ha activado su cuenta)
  const e = altas ? embudoAlta(altas, lista) : null;
  const sin = sinActivarAlta(altas, lista, hoy);
  const filas = [...suyos].sort((a, b) => (a.estado === 'baja') - (b.estado === 'baja') || a.nombre.localeCompare(b.nombre, 'es'));
  const urgentes = sin.filter((s) => s.urgente).length;
  return (
    <details class="panel panel-pad corr-panel" open={c.conAvisos > 0 || urgentes > 0 || (e?.porConfirmar.length || 0) > 0}>
      <summary class="corr-cab"><Icono n="diana" /> <strong>FBE Esencial</strong> <span class="mini terciario num">{c.siguen}</span>
        {c.conAvisos > 0 && <span class="chip corr-chip">{c.conAvisos === 1 ? '1 con avisos' : `${c.conAvisos} con avisos`}</span>}
        {urgentes > 0 && <span class="chip corr-chip">{urgentes === 1 ? '1 sin activar' : `${urgentes} sin activar`}</span>}</summary>
      <p class="peq secundario">
        {c.conPlan ? `Esta semana han entrenado ${c.entrenaron} de ${c.conPlan}. ` : ''}
        {c.sesiones4.pct != null ? `Sesiones apuntadas en sus 4 últimas semanas: ${c.sesiones4.hechas} de ${c.sesiones4.total} (${c.sesiones4.pct} %; el listón, ${LISTON_ESENCIAL.sesiones} %). ` : ''}
        {c.series4.pct != null ? `Series pautadas hechas: ${c.series4.pct} %. ` : ''}
        {!altas && c.sinActivar.length ? `Sin activar su cuenta: ${c.sinActivar.length} (${c.sinActivar.slice(0, 6).join(', ')}${c.sinActivar.length > 6 ? ` y ${c.sinActivar.length - 6} más` : ''}). ` : ''}
        {c.bajas ? `De baja: ${c.bajas}. ` : ''}
        {c.encuestas.filter((x) => x.mandadas).map((x) => `Encuesta (${x.nombre.toLowerCase()}): ${x.contestadas} de ${x.mandadas} contestadas. `).join('')}
      </p>
      {/* (alta, 38) el embudo del alta y lo que tarda la mitad en hacer su primera sesión */}
      {e && e.pasos[0].n > 0 && (
        <section class="alta-embudo" aria-labelledby="alta-embudo-t">
          <h2 id="alta-embudo-t" class="etq">El alta</h2>
          <ol class="alta-pasos">
            {e.pasos.map((x) => <li key={x.id}><strong class="num">{x.n}</strong><span class="mini">{x.nombre}</span></li>)}
          </ol>
          {(e.mediana != null || e.sinAvisos.length > 0) && <p class="mini terciario">
            {e.mediana != null ? `De la invitación a la primera sesión, la mitad tarda ${e.mediana === 1 ? '1 día' : `${e.mediana} días`} o menos. ` : ''}
            {e.sinAvisos.length ? `Con la cuenta activa y sin ningún aviso (no les llegará ninguno): ${e.sinAvisos.join(', ')}.` : ''}
          </p>}
        </section>
      )}
      {/* (v0.248, 77) listos para el lunes: de los que empiezan el próximo lunes, qué le falta a cada uno */}
      {altas && <ListosLunes altas={altas} lista={lista} hoy={hoy} abrir={abrir} />}
      {/* (alta, 27) los vistos buenos por confirmar, con «Confirmar» aquí mismo */}
      {e && e.porConfirmar.length > 0 && <PorConfirmar filas={e.porConfirmar} alCambiar={() => alta.recargar(true)} />}
      {/* (alta, 16-18) quién no ha activado su cuenta: su lunes, su código y «Mandar otra vez» (uno o todos) */}
      {altas && sin.length > 0 && (
        <section class="pila-s alta-sin" aria-labelledby="alta-sin-t">
          <div class="separa">
            <h2 id="alta-sin-t" class="etq">Sin activar su cuenta ({sin.length})</h2>
            {sin.length > 1 && <button type="button" class="btn btn-peq" onClick={() => setReenvio(true)}><Icono n="enviar" /> Mandar otra vez a los {sin.length}</button>}
          </div>
          <ul class="corr-lista">
            {sin.map((s) => (
              <li key={s.atleta_id} class="alta-fila" data-nivel={s.urgente ? 'ambar' : 'ok'}>
                <span class="pila-xs">
                  <strong class="peq">{s.nombre}</strong>
                  <span class="mini terciario">{[s.inicio ? (s.faltan > 0 ? `Empieza en ${s.faltan === 1 ? '1 día' : `${s.faltan} días`}` : s.faltan === 0 ? 'Empieza hoy' : `Su lunes fue el ${fechaLarga(s.inicio)}`) : null,
                    s.invitado_en ? `invitación del ${fechaLarga(String(s.invitado_en).slice(0, 10)).replace(/^\S+ /, '')}` : null,
                    s.caduca_en ? (s.caducado ? 'su código ya no vale' : `vale hasta el ${fechaLarga(String(s.caduca_en).slice(0, 10)).replace(/^\S+ /, '')}`) : null].filter(Boolean).join(' · ')}</span>
                </span>
                {mandarCodigo && <button type="button" class="btn btn-peq" onClick={() => mandarCodigo({ atleta_id: s.atleta_id, nombre: s.nombre, modalidad: 'por_su_cuenta' })} aria-label={`Mandar otra vez la invitación a ${s.nombre}`}>Mandar otra vez</button>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {(cierres.datos || []).length > 0 && (
        <section class="pila-s alta-sin" aria-labelledby="cierre-panel-t">
          <h2 id="cierre-panel-t" class="etq">Su semana, sin acabar ({cierres.datos.length})</h2>
          <ul class="corr-lista">
            {cierres.datos.map((c) => (
              <li key={`${c.atleta_id}:${c.lunes}`} class="alta-fila" data-nivel={c.cierre === 'pasar' ? 'ok' : 'ambar'}>
                <button type="button" class="btn-texto peq" onClick={() => abrir(c.atleta_id)}>{c.nombre}</button>
                <span class="mini terciario">{CIERRE[c.cierre] || c.cierre}{c.repetida > 1 ? ` (${c.repetida} veces)` : ''} · semana {c.numero} · la del {fechaLarga(c.lunes).replace(/^\S+ /, '')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {(rutinas.datos || []).length > 0 && (() => {
        const fuera = rutinas.datos.filter((x) => x.recomendada === false);
        const ver = verRutinas ? rutinas.datos : fuera;
        return (
          <section class="pila-s alta-sin" aria-labelledby="rutinas-panel-t">
            <div class="separa">
              <h2 id="rutinas-panel-t" class="etq">Sus rutinas{fuera.length ? ` (${fuera.length} fuera de lo recomendado)` : ''}</h2>
              <button type="button" class="btn-texto peq" aria-expanded={verRutinas ? 'true' : 'false'} onClick={() => setVerRutinas(!verRutinas)}>{verRutinas ? 'Solo las de fuera' : `Ver todas (${rutinas.datos.length})`}</button>
            </div>
            {!ver.length && <p class="mini terciario">Todos llevan una rutina de las que la app les recomienda (o la de novato).</p>}
            {ver.length > 0 && (
              <ul class="corr-lista">
                {ver.map((x) => (
                  <li key={x.atleta_id} class="alta-fila" data-nivel={x.recomendada === false ? 'ambar' : 'ok'}>
                    <button type="button" class="btn-texto peq" onClick={() => abrir(x.atleta_id)}>{x.nombre}</button>
                    <span class="mini terciario">{x.titulo}{x.recomendada === false ? ' · no es de sus recomendadas' : ''} · {x.inicio && x.inicio > hoy ? `empieza el ${fechaLarga(x.inicio).replace(/^\S+ /, '')}` : x.semanas === 1 ? 'semana 1' : `semana ${x.semanas}`}
                      {x.cambios > 0 ? ` · ${x.cambios === 1 ? 'un cambio de rutina' : `${x.cambios} cambios de rutina`}` : ''}{x.despuesTitulo ? ` · después: ${x.despuesTitulo}` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })()}
      {filas.length > 0 && <ul class="corr-lista">
        {filas.map((r) => {
          const f = filaPiloto(r, hoy, altaDe.get(r.atleta_id));
          const a = altaDe.get(r.atleta_id);
          return (
            <li key={r.atleta_id}>
              <button type="button" class="corr-fila" data-nivel={f.nivel} onClick={() => abrir(r.atleta_id)}>
                <span class="corr-nombre peq">{r.nombre}</span>
                <span class="mini corr-km">{f.semana}{f.comida ? ' · con nutrición' : ''}</span>
                <span class="mini num">{f.sesiones.total ? `${f.sesiones.completadas} de ${f.sesiones.total}` : '—'}</span>
                <span class="mini terciario corr-prox">{f.ultima}</span>
                {(f.avisos.length > 0 || f.notificaciones) && <span class="mini corr-avisos">{[...f.avisos,
                  ...(a?.activado_en ? [`Cuenta activa desde el ${fechaLarga(String(a.activado_en).slice(0, 10)).replace(/^\S+ /, '')}`] : []),
                  ...(f.notificaciones ? [f.notificaciones] : [])].join(' · ')}</span>}
              </button>
            </li>
          );
        })}
      </ul>}
      {filas.length > 0 && <div class="fila-envolver" style="margin-top:var(--esp-10)">
        <button type="button" class="btn btn-peq" onClick={() => setHoja(true)}><Icono n="mensaje" /> {c.encuesta.mandadas ? 'Las encuestas y sus respuestas' : 'Mandar la encuesta'}</button>
      </div>}
      {suyos.length > 0 && <ResumenSemana />}
      {suyos.length > 0 && <AQuienEscribir lista={suyos} abrir={abrir} />}
      {suyos.length > 0 && <PreguntasDirecto />}
      {suyos.length > 0 && <ComoVamosCoach />}
      {hoja && <HojaEncuesta suyos={filas.filter((r) => r.estado !== 'baja')} tareas={enc.datos || []} alCerrar={() => setHoja(false)} alCambiar={() => enc.recargar(true)} />}
      {reenvio && <HojaReenvio sin={sin} alCerrar={() => { setReenvio(false); alta.recargar(true); }} />}
    </details>
  );
}

// (alta, 27) Los vistos buenos por confirmar: quién, desde cuándo, su cribado y «Confirmar» (le asigna su plan si ya tiene
// el cuestionario, como desde su ficha)
// (v0.248, 77) Listos para el lunes: los que empiezan el próximo lunes de FBE Esencial (en los próximos 28 días), cuántos lo
// tienen todo y, de los demás, qué les falta (la cuenta, el cuestionario, el visto bueno, el plan, los días, los avisos y,
// con la migración 102, el gimnasio)
function ListosLunes({ altas, lista, hoy, abrir }) {
  const vivos = new Map(lista.filter((r) => r.modalidad === 'por_su_cuenta' && r.estado !== 'baja').map((r) => [r.atleta_id, r.nombre]));
  const l = listosLunes(altas, vivos, hoy);
  if (!l) return null;
  const faltan = l.lista.filter((x) => x.falta.length);
  return (
    <section class="pila-s alta-sin" aria-labelledby="lun-coach-t">
      <h2 id="lun-coach-t" class="etq">{`Listos para el ${fechaLarga(l.proximo)}: ${l.listos} de ${l.total}`}</h2>
      <p class="mini terciario">{l.faltan === 1 ? 'Empiezan mañana.' : `Faltan ${l.faltan} días.`}{faltan.length ? ' A los demás les falta:' : ' Lo tienen todo.'}</p>
      {faltan.length > 0 && (
        <ul class="corr-lista">
          {faltan.map((x) => (
            <li key={x.atleta_id} class="alta-fila" data-nivel={x.falta.length > 2 || l.faltan <= 3 ? 'ambar' : 'ok'}>
              <span class="pila-xs">
                <strong class="peq">{x.nombre}</strong>
                <span class="mini terciario">{x.falta.join(' · ')}</span>
              </span>
              {abrir && <button type="button" class="btn btn-peq" onClick={() => abrir(x.atleta_id)} aria-label={`Abrir la ficha de ${x.nombre}`}>Ficha</button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PorConfirmar({ filas, alCambiar }) {
  const { api, aviso } = useApp();
  const [ocupado, una] = useUnaVez();
  const hoy = hoyISO();
  return (
    <section class="pila-s alta-sin" aria-labelledby="alta-vb-t">
      <h2 id="alta-vb-t" class="etq">Visto bueno por confirmar ({filas.length})</h2>
      <ul class="corr-lista">
        {filas.map((a) => {
          const d = Math.max(0, Math.round((Date.parse(`${hoy}T12:00:00Z`) - Date.parse(`${String(a.visto_bueno_pedido_en).slice(0, 10)}T12:00:00Z`)) / 864e5));
          return (
            <li key={a.atleta_id} class="alta-fila" data-nivel={d >= 3 ? 'ambar' : 'ok'}>
              <span class="pila-xs">
                <strong class="peq">{a.nombre}</strong>
                <span class="mini terciario">Dice que ya lo tiene {d === 0 ? 'desde hoy' : d === 1 ? 'desde ayer' : `desde hace ${d} días`}{RESULTADO[a.resultado] ? ` · ${RESULTADO[a.resultado]}` : ''}</span>
              </span>
              <button type="button" class="btn btn-primario btn-peq" disabled={ocupado} aria-label={`Confirmar el visto bueno de ${a.nombre}`}
                onClick={() => una(async () => {
                  try {
                    const r = await api.esencialConfirmarVistoBueno(a.atleta_id);
                    aviso(r?.bloque ? `Confirmado: ${a.nombre.split(' ')[0]} ya tiene su plan` : `Visto bueno de ${a.nombre.split(' ')[0]} confirmado`);
                    alCambiar?.();
                  } catch (err) { aviso(err.message, 'error'); }
                })}>Confirmar</button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// (alta, 18) «Mandar otra vez» a todos los que no han activado su cuenta: un código nuevo para cada uno (vale hasta una
// semana después de su lunes) y sus mensajes listos, como en «Varios de FBE Esencial»
function HojaReenvio({ sin, alCerrar }) {
  const { api } = useApp();
  const fichas = useCarga(() => api.atletas().catch(() => []), [], { tirar: false });
  const [hechos, setHechos] = useState(null);
  const [va, setVa] = useState(0);
  const [ocupado, una] = useUnaVez();
  const url = typeof location !== 'undefined' ? location.origin + location.pathname : '';
  const generar = () => una(async () => {
    const hoy = hoyISO();
    const email = new Map((fichas.datos || []).map((f) => [f.id, f.email]));
    const salen = [];
    for (const [i, s] of sin.entries()) {
      setVa(i + 1);
      const dias = diasInvitacion({ esencial: true, inicio: s.inicio, hoy });
      try { salen.push({ nombre: s.nombre, email: email.get(s.atleta_id) || '', atleta: { id: s.atleta_id }, inicio: s.inicio, codigo: await api.crearInvitacion(s.atleta_id, dias), caduca: sumarDias(hoy, dias) }); }
      catch (err) { salen.push({ nombre: s.nombre, fallo: err.message, atleta: { id: s.atleta_id } }); }
    }
    setVa(0);
    setHechos(salen);
  });
  if (hechos) return <Invitaciones hechos={hechos} url={url} otraVez alCerrar={alCerrar} />;
  return (
    <Hoja titulo="Mandar otra vez la invitación" alCerrar={alCerrar}>
      <div class="pila">
        <p class="peq secundario">A {sin.length === 1 ? 'quien no ha' : `los ${sin.length} que no han`} activado su cuenta: un código nuevo para cada uno (el de antes deja de valer), que vale hasta una semana después de su lunes, y su mensaje con el enlace que abre la app con el código puesto.</p>
        <ul class="lista">{sin.map((s) => <li key={s.atleta_id} class="peq">{s.nombre}{s.urgente ? ' · empieza pronto' : ''}</li>)}</ul>
        <button type="button" class="btn btn-primario btn-grande" disabled={ocupado || fichas.cargando} onClick={generar}>
          {ocupado ? `Generando ${va} de ${sin.length}…` : `Generar ${sin.length === 1 ? 'su código nuevo' : `sus ${sin.length} códigos nuevos`}`}</button>
      </div>
    </Hoja>
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
