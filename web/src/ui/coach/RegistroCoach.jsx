// (v0.205) Registro: lo que hizo frente a lo pautado, sesión a sesión (antes, en Ficha.jsx). Ahora, además: elegir bloque
// y semana, lo que hizo la vez anterior, su 1RM del día frente a esa vez y a su mejor marca, toneladas y series, lo
// saltado (las series que faltaron, como fichas vacías), las notas de cada serie, su vídeo de ese día, el descanso de
// verdad y la hora de la sesión, ajustar su próxima sesión e ir a su historial desde cada ejercicio, y «Bien hecho» y
// «Sin revisar». Las fichas de color y el aro de cada sesión son de la v0.204.
import { Fragment } from 'preact';
import { useEffect, useLayoutEffect, useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Siluetas, Vacio, Icono, Segmentos, Hoja, HojaExportar, copiar } from '../comunes.jsx';
import { MiniLinea } from '../atleta/ProgresoPiezas.jsx';
import { ChipLlegada } from './ChipLlegada.jsx';
import { Hilo } from '../Hilo.jsx';
import { DetalleArchivo } from '../Diario.jsx';
import { HistorialEjercicio } from '../Herramientas.jsx';
import { num, pauta, textoSerie, etiquetasSuperserie, eventosRecord, seriesACsv } from '../../logica/calculos.js';
import { esfuerzoSerie, tonoEsfuerzo } from '../../logica/progreso-visual-2.js';
import { vezAnterior, frenteAnterior, e1rmDelDia, toneladas, faltan, descansoFrente, mmss, horarioSesion, notasDeSeries,
  desvioEsfuerzo, tonoDesvio, textoDesvio, porEjercicios, resumenSemanaBloque, rendimientoDia, textoSesion, filasCsvBloque, emparejarSesiones } from '../../logica/registro-actividad.js';
import { cardioHechoValido, textoCardioHecho, NOMBRE_MODALIDAD, textoCardio } from '../../logica/cardio.js';
import { ordenReal } from '../../logica/orden-sesion.js';
import { fmtConDia, fmtCorta } from '../../logica/fechas.js';
import { pesoTxt, pesoNum, etiquetaPeso, difVista } from '../../logica/unidades.js';

const ACTIVOS = ['activo', 'ajustado'];
const conReps = (h) => Number(h.reps) > 0;

// foco: { bloqueId, sesionId } (desde Actividad: lleva justo a esa sesión); alUsarFoco: ya se ha usado
export function Registro({ atleta, alCambiar, foco = null, alUsarFoco = null }) {
  const { api } = useApp();
  const bloques = useCarga(() => api.bloquesDe(atleta.id), [atleta.id]);
  const lista = (bloques.datos || []).filter((b) => !b.es_plantilla);
  const [elegido, setElegido] = useState(foco?.bloqueId || null);
  useEffect(() => { if (foco?.bloqueId) setElegido(foco.bloqueId); }, [foco?.bloqueId, foco?.sesionId]);
  const bloque = lista.find((b) => b.id === elegido) || lista.find((b) => ACTIVOS.includes(b.estado)) || lista[0] || null;
  const datos = useCarga(async () => {
    if (!bloque) return null;
    const [completo, biblioteca] = await Promise.all([api.bloqueCompleto(bloque.id), api.biblioteca()]);
    return { completo, ejercicios: Object.fromEntries(biblioteca.map((e) => [e.id, e])) };
  }, [bloque?.id]);
  // Su historial (la vez anterior, su mejor marca y los récords) y su diario (los vídeos de cada sesión), una vez
  const comun = useCarga(async () => {
    const [historial, diario] = await Promise.all([api.historial(atleta.id).catch(() => []), api.diario(atleta.id).catch(() => [])]);
    return { historial, diario, records: new Set(eventosRecord(historial).eventos.map((e) => e.serie_id).filter(Boolean)) };
  }, [atleta.id]);
  if ((bloques.cargando && !bloques.datos) || (datos.cargando && !datos.datos)) return <Siluetas forma="tarjetas" n={3} />;
  if (!bloque || !datos.datos) return <div class="panel"><Vacio ilustracion="semana" icono="semana" titulo="Sin bloque">Cuando tenga un bloque, aquí verás lo que registra frente a lo pautado.</Vacio></div>;
  const { completo, ejercicios } = datos.datos;
  const sesiones = completo.semanas.slice().reverse().flatMap((w) => (completo.sesiones[w.id] || []).slice().reverse().map((s) => ({ ...s, semana: w })))
    .filter((s) => s.completada || (completo.pautas[s.id] || []).some((p) => completo.series[p.id]?.length));
  return (
    <div class="pila registro-coach">
      {lista.length > 1 && (
        <div class="campo registro-bloque">
          <label for="reg-bloque">Bloque</label>
          <select id="reg-bloque" class="selector" value={bloque.id} onChange={(e) => setElegido(e.currentTarget.value)}>
            {lista.map((b) => <option key={b.id} value={b.id}>Bloque {b.numero}: {b.nombre}{ACTIVOS.includes(b.estado) ? ' (activo)' : b.estado === 'finalizado' ? ' (terminado)' : ''}</option>)}
          </select>
        </div>
      )}
      {!sesiones.length ? <div class="panel"><Vacio ilustracion="semana" icono="semana" titulo="Todavía no ha registrado nada en este bloque" /></div>
        : <ListaRegistro key={bloque.id} atleta={atleta} sesiones={sesiones} completo={completo} ejercicios={ejercicios} comun={comun.datos} recargarDiario={() => comun.recargar(true)}
          foco={foco?.sesionId && sesiones.some((s) => s.id === foco.sesionId) ? foco.sesionId : null} alUsarFoco={alUsarFoco}
          recargar={() => { datos.recargar(true); alCambiar?.(); }} />}
    </div>
  );
}

// RPE de la serie por encima del pautado (medio punto de margen)
const pasado = (p, h) => {
  if (h.rpe == null) return false;
  const objetivo = p.rpe_objetivo != null ? Number(p.rpe_objetivo) : p.rir_objetivo != null ? 10 - Number(p.rir_objetivo) : null;
  return objetivo != null && Number(h.rpe) > objetivo + 0.5;
};

// (v0.204) El medidor de una sesión: un aro con las series hechas de las pautadas, del color de su esfuerzo
const NOMBRE_TONO = { suave: 'suave', medio: 'medio', duro: 'duro', sin: 'sin apuntar' };
function MedidorSesion({ hechas, pautadas, rpe }) {
  if (!pautadas) return null;
  const p = Math.min(1, hechas / pautadas), R = 15, C = 2 * Math.PI * R;
  const tono = tonoEsfuerzo(rpe);
  return (
    <svg class={`medidor-sesion esf-${tono}`} viewBox="0 0 40 40" width="40" height="40" role="img" aria-label={`${hechas} de ${pautadas} series pautadas hechas; esfuerzo ${rpe ? `${num(rpe)} de 10 (${NOMBRE_TONO[tono]})` : 'sin apuntar'}`}>
      <circle class="medidor-fondo" cx="20" cy="20" r={R} />
      <circle class="medidor-lleno" cx="20" cy="20" r={R} stroke-dasharray={`${(C * p).toFixed(2)} ${C.toFixed(2)}`} transform="rotate(-90 20 20)" />
      <text x="20" y="23.5" text-anchor="middle">{hechas}</text>
    </svg>
  );
}
const NOMBRE_ESF = { suave: 'más suave de lo pautado', justo: 'al esfuerzo pautado', pasado: 'por encima del esfuerzo pautado', corto: 'por debajo de las repeticiones', sin: '' };
const toneladasTxt = (kg) => `${num(Math.round(kg / 100) / 10, 1)} t`;

function ListaRegistro({ atleta, sesiones, completo, ejercicios, comun, recargarDiario, recargar, foco = null, alUsarFoco = null }) {
  const { api, aviso } = useApp();
  const [todas, setTodas] = useState(!!foco);
  const [hilo, setHilo] = useState(null);
  const [semana, setSemana] = useState('todas');
  const [sinRevisar, setSinRevisar] = useState(false);
  const [historial, setHistorial] = useState(null);
  const [video, setVideo] = useState(null);
  const [ajustes, setAjustes] = useState({});
  const [felicitadas, setFelicitadas] = useState(() => new Set());
  const [ocupado, una] = useUnaVez();
  // (v0.206) por sesiones o por ejercicios; comentar una serie; comparar dos sesiones; descargar el bloque
  const [vista, setVista] = useState('sesiones');
  const [comentando, setComentando] = useState(null);
  const [comparar, setComparar] = useState(null);
  const [exportar, setExportar] = useState(false);
  const [revisadas, setRevisadas] = useState(() => new Set());
  const records = comun?.records || new Set();
  const ejs = porEjercicios(completo, ejercicios);
  const lineaDe = Object.fromEntries(ejs.map((e) => [e.id, e.linea]));
  const conTuyo = useCarga(() => api.sesionesConTuyo(atleta.id, sesiones.filter((s) => s.completada).map((s) => s.id)).catch(() => new Set()), [atleta.id, sesiones.map((s) => s.id).join()]);
  // las semanas con algo registrado, para saltar a una
  const semanas = [...new Map(sesiones.map((s) => [s.semana.id, s.semana])).values()].sort((a, b) => a.numero - b.numero);
  const filtradas = sesiones.filter((s) => (semana === 'todas' || s.semana.id === semana) && (!sinRevisar || (s.completada && !s.revisada_en)));
  const visibles = todas || semana !== 'todas' || sinRevisar ? filtradas : filtradas.slice(0, 6);
  // desde Actividad: a esa sesión, resaltada un momento
  useLayoutEffect(() => {
    if (!foco) return;
    const el = document.getElementById(`reg-${foco}`);
    if (el) {
      el.scrollIntoView({ block: 'start', behavior: 'auto' });
      el.classList.add('enfocada');
      el.querySelector('.registro-titulo')?.focus({ preventScroll: true });
      setTimeout(() => el.classList.remove('enfocada'), 2400);
    }
    alUsarFoco?.();
  }, [foco]);
  const videosDe = {};
  for (const a of comun?.diario || []) if (a.tipo === 'video_tecnica' && a.sesion_ejercicio_id) (videosDe[a.sesion_ejercicio_id] ||= []).push(a);
  const ajustar = (s, p, nombre, delta) => una(async () => {
    try {
      const r = await api.ajustarProxima(atleta.id, p.ejercicio_id, delta);
      if (!r) { aviso(`No tiene ${nombre} en ninguna sesión por delante`); return; }
      setAjustes((x) => ({ ...x, [p.id]: r }));
      aviso(`${nombre}: ${pesoNum(r.antes, 2)} → ${pesoTxt(r.despues, 2)} en «${r.sesion}»${r.semana ? ` (semana ${r.semana})` : ''}`, 'ok');
    } catch (e) { aviso(e.message, 'error'); }
  });
  const felicitar = (s) => una(async () => {
    try { await api.felicitar(atleta.id, s.id, s.nombre); setFelicitadas((f) => new Set([...f, s.id])); aviso(`«Bien hecho» enviado a ${atleta.nombre?.split(' ')[0] || 'tu atleta'}`, 'ok'); }
    catch (e) { aviso(e?.message || 'No se ha podido enviar: vuelve a intentarlo', 'error'); }
  });
  return (
    <div class="pila">
      <div class="registro-filtros">
        <Segmentos opciones={[['sesiones', 'Por sesiones'], ['ejercicios', 'Por ejercicios']]} valor={vista} alCambiar={(v) => v && setVista(v)} etiqueta="Cómo ver el registro" clase="seg-compacto" />
        <button type="button" class="btn btn-peq" onClick={() => setExportar(true)}><Icono n="descargar" /> Descargar el bloque</button>
      </div>
      {vista === 'ejercicios' && <PorEjercicios ejs={ejs} semanas={completo.semanas} />}
      {vista === 'sesiones' && <ResumenSemana completo={completo} semana={semana !== 'todas' ? completo.semanas.find((w) => w.id === semana) : semanas[semanas.length - 1]} revisadas={revisadas}
        alRevisar={(ids) => una(async () => { try { for (const id of ids) await api.marcarRevisado('sesion', id); setRevisadas((r) => new Set([...r, ...ids])); aviso(ids.length === 1 ? 'Sesión revisada' : `${ids.length} sesiones revisadas`, 'ok'); recargar(); } catch (e) { aviso(e.message, 'error'); } })} />}
      {vista === 'sesiones' && <div class="registro-filtros">
        <div class="selector-chips" role="group" aria-label="Qué semana ver">
          <button type="button" aria-pressed={semana === 'todas' ? 'true' : 'false'} onClick={() => setSemana('todas')}>Todas</button>
          {semanas.map((w) => <button type="button" key={w.id} aria-pressed={semana === w.id ? 'true' : 'false'} onClick={() => setSemana(w.id)}>S{w.numero}</button>)}
        </div>
        <button type="button" class="btn btn-peq" aria-pressed={sinRevisar ? 'true' : 'false'} onClick={() => setSinRevisar(!sinRevisar)}><Icono n="hecho" /> Sin revisar ({sesiones.filter((s) => s.completada && !s.revisada_en).length})</button>
      </div>}
      {vista === 'sesiones' && !visibles.length && <p class="peq secundario">{sinRevisar ? 'Todo revisado en esta selección.' : 'Nada registrado en esta semana.'}</p>}
      {vista === 'sesiones' && visibles.map((s) => {
        const ps = completo.pautas[s.id] || [];
        const todasSeries = ps.flatMap((p) => completo.series[p.id] || []);
        const hechasS = todasSeries.filter(conReps);
        const pautadas = ps.reduce((t, p) => t + (Number(p.series) || 0), 0);
        const hechasN = ps.reduce((t, p) => t + Math.min((completo.series[p.id] || []).filter(conReps).length, Number(p.series) || 0), 0);
        const horario = horarioSesion(todasSeries);
        const ton = toneladas(hechasS);
        const fecha = s.fecha_realizada || hechasS[0]?.registrada_en?.slice(0, 10) || null;
        const ya = felicitadas.has(s.id) || conTuyo.datos?.has?.(s.id);
        // (v0.206) cómo rindió frente a la vez anterior (la media de lo que cambió su 1RM en lo que se puede comparar)
        const rend = comun ? rendimientoDia(ps.map((p) => {
          const hs = (completo.series[p.id] || []).filter(conReps);
          const id = hs.find((h) => h.sustituto_id)?.sustituto_id || p.ejercicio_id;
          const ant = vezAnterior(comun.historial, id, s.id, fecha);
          const rm = ant ? e1rmDelDia(hs, comun.historial, id, s.id, fecha, ant.series) : null;
          return rm && rm.cambio != null ? { hoy: rm.valor, antes: rm.valor - rm.cambio } : null;
        })) : null;
        const cardioP = s.cardio ? textoCardio(s.cardio) : '';
        return (
          <section id={`reg-${s.id}`} class={`panel panel-pad pila-s registro-sesion${s.completada && !s.revisada_en ? ' por-revisar' : ''}`} data-rpe={s.rpe_sesion ? Math.min(10, Math.max(5, Math.floor(s.rpe_sesion))) : undefined} key={s.id}>
            <div class="separa registro-cab" style="flex-wrap:wrap">
              <MedidorSesion hechas={hechasN} pautadas={pautadas} rpe={s.rpe_sesion} />
              <h2 class="registro-titulo" tabIndex={-1}>S{s.semana.numero}: {s.nombre}</h2>
              <span class="peq secundario">{s.fecha_realizada ? fmtConDia(s.fecha_realizada) : 'En curso'}{s.rpe_sesion ? `, esfuerzo ${s.rpe_sesion}/10` : ''}{cardioHechoValido(s.cardio_hecho) ? `, ${NOMBRE_MODALIDAD[s.cardio_hecho.modalidad].toLowerCase()}: ${textoCardioHecho(s.cardio_hecho)}` : s.duracion_min ? `, ${s.duracion_min} min` : ''}</span>
            </div>
            {/* (v0.205) su hora, cuánto duró y lo que movió */}
            {(horario || hechasS.length > 0) && (
              <p class="registro-cifras mini secundario num">
                {horario && <span><Icono n="reloj" />De {horario.inicio} a {horario.fin} ({horario.minutos} min)</span>}
                {hechasS.length > 0 && <span><Icono n="hoy" />{hechasS.length} {hechasS.length === 1 ? 'serie' : 'series'}{ton > 0 ? `, ${toneladasTxt(ton)}` : ''}</span>}
              </p>
            )}
            {(s.preparacion || rend) && (
              <div class="registro-dia">
                {s.preparacion && <ChipLlegada preparacion={s.preparacion} />}
                {rend && <span class={`chip num ${rend.pct >= 1 ? 'ok' : rend.pct <= -2 ? 'aviso' : ''}`} title="La media de lo que cambió su 1RM estimado frente a la vez anterior">Rindió {rend.pct > 0 ? '+' : rend.pct < 0 ? '−' : '±'}{num(Math.abs(rend.pct), 1)} % frente a la vez anterior</span>}
              </div>
            )}
            {(cardioP || cardioHechoValido(s.cardio_hecho)) && (
              <p class="registro-cardio mini secundario"><Icono n="pasos" />{cardioP && <span>Pautado: {cardioP}</span>}{cardioHechoValido(s.cardio_hecho) && <span>Hecho: {NOMBRE_MODALIDAD[s.cardio_hecho.modalidad]?.toLowerCase()}, {textoCardioHecho(s.cardio_hecho)}</span>}{cardioP && !cardioHechoValido(s.cardio_hecho) && s.completada && <span class="aviso-t">Sin apuntar</span>}</p>
            )}
            {s.nota_atleta && <div class="nota-coach"><Icono n="mensaje" /><div>{s.nota_atleta}</div></div>}
            <HechoEnOtroOrden pautas={ps} series={completo.series} ejercicios={ejercicios} />
            {ps.length > 0 && (
              <ul class="registro-ejs">
                {ps.map((p) => {
                  const pa = pauta(p);
                  const etq = etiquetasSuperserie(ps)[p.id];
                  const hechas = completo.series[p.id] || [];
                  const conR = hechas.filter(conReps);
                  const cambios = [...new Set(hechas.map((h) => h.sustituto_id).filter(Boolean))];
                  const efId = cambios[cambios.length - 1] || p.ejercicio_id;
                  const nombre = ejercicios[p.ejercicio_id]?.nombre || 'Ejercicio';
                  const f = faltan(p, hechas, s.completada);
                  const ant = comun ? vezAnterior(comun.historial, efId, s.id, fecha) : null;
                  const fr = ant ? frenteAnterior(conR, ant.series) : null;
                  const rm = comun ? e1rmDelDia(conR, comun.historial, efId, s.id, fecha, ant?.series) : null;
                  const desc = descansoFrente(p, conR);
                  const notas = notasDeSeries(hechas);
                  const vids = videosDe[p.id] || [];
                  const tonE = toneladas(conR);
                  const aj = ajustes[p.id];
                  const conKilos = conR.some((h) => Number(h.kg) > 0) || p.carga_sugerida_kg != null;
                  const desv = desvioEsfuerzo(p, conR);
                  const linea = lineaDe[efId] || [];
                  return (
                    <li key={p.id} class={`registro-ej${f.saltado ? ' saltado' : ''}`}>
                      <div class="registro-ej-cab">
                        <span class="registro-ej-nombre">{etq && <span class="ss-etq">{etq}</span>}{nombre}
                          {cambios.length > 0 && <span class="mini cambio">Hecho como {cambios.map((id) => ejercicios[id]?.nombre).filter(Boolean).join(', ')}</span>}</span>
                        {linea.length > 1 && <MiniLinea valores={linea} ancho={64} alto={22} clase="registro-linea" />}
                        {desv != null && <span class={`chip num registro-desvio ${tonoDesvio(desv)}`}>{textoDesvio(desv)}</span>}
                        {f.saltado && <span class="chip aviso registro-saltado">Saltado</span>}
                        {vids.length > 0 && <MiniVideo a={vids[0]} n={vids.length} nombre={nombre} alAbrir={() => setVideo({ a: vids[0], nombre })} />}
                      </div>
                      <div class="registro-serie" data-etq="Pautado"><span class="registro-etq">Pautado</span>{pa.series}{pa.esfuerzo ? `, ${pa.esfuerzo}` : ''}{pa.carga ? `, ${pa.carga}` : ''}</div>
                      <div class="registro-serie" data-etq="Hecho"><span class="registro-etq">Hecho</span>
                        {hechas.length || f.n ? (
                          <span class="fichas-serie">
                            {hechas.map((h, i) => {
                              // (v0.204) cada serie, una ficha del color de su esfuerzo frente a lo pautado; la de récord, en dorado
                              const esf = esfuerzoSerie(p, h);
                              const rec = records.has(h.id);
                              const nota = String(h.nota || '').trim();
                              return (
                                <Fragment key={i}>{i ? <span class="sr">, </span> : ''}<button type="button" class={`serie-ficha esf-${esf} ${(p.reps_min != null && h.reps < p.reps_min) || pasado(p, h) ? 'corto' : ''} ${rec ? 'record' : ''} ${nota ? 'con-nota' : ''}`}
                                  aria-pressed={comentando?.h === h.id ? 'true' : 'false'} title="Comentar esta serie" onClick={() => setComentando(comentando?.h === h.id ? null : { s: s.id, p: p.id, h: h.id, n: h.numero ?? i + 1, texto: textoSerie(h), nombre })}>
                                  {rec && <Icono n="trofeo" />}{textoSerie(h)}{nota && <Icono n="mensaje" />}{(NOMBRE_ESF[esf] || rec || nota) && <span class="sr"> ({[rec ? 'récord' : '', NOMBRE_ESF[esf], nota ? 'con nota' : ''].filter(Boolean).join(', ')})</span>}<span class="sr">. Comentar esta serie</span>
                                </button></Fragment>
                              );
                            })}
                            {/* (v0.205) las que faltaron de lo pautado, como fichas vacías */}
                            {Array.from({ length: f.n }, (_, i) => <span key={`h${i}`} class="serie-hueco" aria-hidden="true">—</span>)}
                            {f.n > 0 && <span class="sr">, {f.n === 1 ? 'falta una serie' : `faltan ${f.n} series`} de las pautadas</span>}
                          </span>
                        ) : <span class="terciario">—</span>}
                      </div>
                      {comentando?.p === p.id && <ComentarSerie atleta={atleta} c={comentando} alCerrar={() => setComentando(null)} />}
                      {notas.length > 0 && (
                        <ul class="registro-notas">
                          {notas.map((x) => <li key={x.numero}><Icono n="mensaje" /><span><b>Serie {x.numero}:</b> «{x.nota}»</span></li>)}
                        </ul>
                      )}
                      {(ant || rm || desc || tonE > 0) && (
                        <p class="registro-meta mini secundario num">
                          {ant && <span class={`registro-antes ${fr?.dir || ''}`}>La vez anterior ({fmtCorta(ant.fecha)}): {ant.series.map(textoSerie).join(', ')}
                            {fr && fr.dir !== 'igual' && <><Icono n={fr.dir === 'sube' ? 'arriba' : 'abajo'} /><span class="sr">{fr.dir === 'sube' ? ' (hoy, mejor)' : ' (hoy, por debajo)'}</span></>}</span>}
                          {rm && <span>1RM {pesoTxt(rm.valor, 1)}{rm.cambio != null && rm.cambio !== 0 ? ` (${rm.cambio > 0 ? '+' : '−'}${num(Math.abs(difVista(rm.cambio)), 1)} ${etiquetaPeso()} frente a la vez anterior)` : ''}{rm.record ? ', su mejor marca' : rm.pct ? `, ${rm.pct} % de su mejor` : ''}</span>}
                          {tonE > 0 && <span>{toneladasTxt(tonE)}</span>}
                          {desc && <span class={desc.dif != null && Math.abs(desc.dif) >= 30 ? 'desc-fuera' : ''}>Descanso {mmss(desc.real)}{desc.pautado ? ` (pautado ${mmss(desc.pautado)})` : ''}</span>}
                        </p>
                      )}
                      <div class="registro-ej-acciones">
                        <button type="button" class="btn-texto" onClick={() => setHistorial({ id: efId, nombre: ejercicios[efId]?.nombre || nombre })}><Icono n="historial" /> Su historial</button>
                        {conKilos && (
                          <span class="registro-proxima" role="group" aria-label={`Su próxima sesión de ${nombre}`}>
                            <span class="mini secundario">Su próxima:</span>
                            <button type="button" class="btn btn-peq" disabled={ocupado} onClick={() => ajustar(s, p, nombre, -2.5)} aria-label={`Bajar 2,5 kg ${nombre} en su próxima sesión`}>−2,5</button>
                            <button type="button" class="btn btn-peq" disabled={ocupado} onClick={() => ajustar(s, p, nombre, 2.5)} aria-label={`Subir 2,5 kg ${nombre} en su próxima sesión`}>+2,5</button>
                            {aj && <span class="mini ok-t num">{pesoNum(aj.antes, 2)} → {pesoTxt(aj.despues, 2)}</span>}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div class="fila-envolver">
              <button class="btn btn-peq" aria-expanded={hilo === s.id ? 'true' : 'false'} onClick={() => setHilo(hilo === s.id ? null : s.id)}><Icono n="mensaje" /> Comentarios</button>
              <button class="btn btn-peq" onClick={async () => { const ok = await copiar(textoSesion(s, ps, completo.series, ejercicios, fmtCorta)); aviso(ok ? 'Sesión copiada: pégala donde quieras' : 'No se ha podido copiar', ok ? 'ok' : 'error'); }}><Icono n="copiar" /> Copiar</button>
              {sesiones.length > 1 && <button class="btn btn-peq" onClick={() => setComparar(s)}><Icono n="intercambiar" /> Comparar</button>}
              {s.completada && (ya
                ? <span class="chip"><Icono n="hecho" />{felicitadas.has(s.id) ? '«Bien hecho» enviado' : 'Ya le has escrito'}</span>
                : <button class="btn btn-peq" disabled={ocupado} onClick={() => felicitar(s)} aria-label={`Decirle «Bien hecho» por ${s.nombre}`}>💪 Bien hecho</button>)}
              {s.completada && (s.revisada_en || revisadas.has(s.id)
                ? <span class="chip ok"><Icono n="hecho" />Revisada</span>
                : <button class="btn btn-peq" onClick={async () => { try { await api.marcarRevisado('sesion', s.id); aviso('Sesión revisada'); recargar(); } catch (e) { aviso(e.message, 'error'); } }}><Icono n="hecho" /> Marcar revisada</button>)}
            </div>
            {hilo === s.id && <Hilo atletaId={atleta.id} sesionId={s.id} nombreAtleta={atleta.nombre} alCambiar={recargar} vacio="Sin comentarios en esta sesión." />}
          </section>
        );
      })}
      {vista === 'sesiones' && !todas && semana === 'todas' && !sinRevisar && filtradas.length > 6 && <button class="btn" onClick={() => setTodas(true)}>Ver las {filtradas.length - 6} sesiones anteriores</button>}
      <p class="mini terciario">Cada serie es una ficha del color de su esfuerzo frente a lo pautado: en verde, en su sitio; en azul, más suave; en naranja, por encima del esfuerzo o por debajo del rango de repeticiones; en gris, sin RPE. Las de récord, en dorado; las que faltaron, vacías; las que llevan nota, con su bocadillo. Debajo de cada ejercicio, lo que hizo la vez anterior (con flecha si hoy mejoró o bajó), su 1RM estimado del día y el descanso que hizo de verdad (en ámbar si se aleja medio minuto o más del pautado). El aro de cada sesión, las series hechas de las pautadas, del color de su esfuerzo. Toca una serie para comentarla.</p>
      {historial && <HistorialEjercicio atletaId={atleta.id} ejercicio={historial} compartir={false} alCerrar={() => setHistorial(null)} />}
      {comparar && <CompararSesiones s={comparar} sesiones={sesiones} completo={completo} ejercicios={ejercicios} alCerrar={() => setComparar(null)} />}
      {exportar && <HojaExportar titulo="El registro del bloque" nombre={`registro-${(atleta.nombre || 'atleta').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-bloque.csv`} tipo="text/csv"
        contenido={seriesACsv(filasCsvBloque(completo, ejercicios))} alCerrar={() => setExportar(false)} />}
      {video && (
        <DetalleArchivo a={video.a} lista={comun?.diario || []} atletaId={atleta.id} nombreAtleta={atleta.nombre} esCoach nombre={video.nombre}
          alCerrar={() => setVideo(null)} alCambiar={recargarDiario}
          alBorrar={async () => { try { await api.borrarArchivo(video.a); aviso('Vídeo borrado'); setVideo(null); recargarDiario(); } catch (e) { aviso(e.message, 'error'); } }} />
      )}
    </div>
  );
}

// (v0.205) Su vídeo de ese ejercicio en esa sesión: la miniatura (o el primer fotograma), que abre el vídeo y su corrección.
// (v0.206) También en Actividad, y con las fotos de progreso
export function MiniVideo({ a, n = 1, nombre = '', alAbrir }) {
  const { api } = useApp();
  const [url, setUrl] = useState(null);
  const foto = a.tipo === 'foto_progreso';
  useEffect(() => {
    let vivo = true;
    api.urlArchivo(a.poster_ruta || a.ruta).then((u) => vivo && setUrl(u)).catch(() => {});
    return () => { vivo = false; };
  }, [a.id]);
  return (
    <button type="button" class="registro-video" onClick={alAbrir} aria-label={`${foto ? 'Ver su foto de progreso' : `Ver su vídeo${nombre ? ` de ${nombre}` : ''}`}${n > 1 ? ` (${n} vídeos)` : ''}${a.revisado_en ? '' : ', sin revisar'}`}>
      {url ? (a.poster_ruta || foto ? <img src={url} alt="" loading="lazy" /> : <video src={url} muted playsInline preload="metadata" />) : <span class="registro-video-hueco" />}
      {!foto && <span class="registro-video-play" aria-hidden="true"><Icono n="play" /></span>}
      {!a.revisado_en && <span class="registro-video-punto" aria-hidden="true" />}
    </button>
  );
}

// v0.64 (4): si el atleta hizo los ejercicios en otro orden que el pautado (p. ej. con la máquina ocupada), el orden de verdad:
// sale de la hora de cada serie (ya se guardaba), sin nada nuevo en la base. Con el nombre del ejercicio que hizo (si lo cambió)
function HechoEnOtroOrden({ pautas, series, ejercicios }) {
  const real = ordenReal(pautas, series);
  if (!real) return null;
  const porId = Object.fromEntries(pautas.map((p) => [p.id, p]));
  const etq = etiquetasSuperserie(pautas);
  const nombre = (id) => {
    const sust = (series[id] || []).map((h) => h.sustituto_id).filter(Boolean).at(-1);
    return ejercicios[sust || porId[id]?.ejercicio_id]?.nombre || 'Ejercicio';
  };
  const textoBloque = (b) => b.ids.map((id) => `${etq[id] ? `${etq[id]} ` : ''}${nombre(id)}`).join(' + ');
  return (
    <div class="orden-real">
      <span class="orden-real-cab"><Icono n="ordenar" /><strong>Hecho en otro orden</strong></span>
      <ol>{real.map((b) => <li key={b.clave}>{textoBloque(b)}</li>)}</ol>
    </div>
  );
}

// (v0.206) Por ejercicios: cada ejercicio con sus semanas en columnas (la mejor serie de cada una), su minilínea y su
// desvío de esfuerzo en todo el bloque
function PorEjercicios({ ejs, semanas }) {
  const ws = [...semanas].sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0));
  if (!ejs.length) return <p class="peq secundario">Todavía no hay series en este bloque.</p>;
  return (
    <div class="panel tabla-env registro-por-ejercicio" tabIndex={0} role="region" aria-label="El bloque por ejercicios">
      <table class="tabla-simple">
        <caption class="sr">Cada ejercicio con la mejor serie de cada semana del bloque</caption>
        <thead><tr><th scope="col">Ejercicio</th>{ws.map((w) => <th scope="col" key={w.id} class="num">S{w.numero}</th>)}<th scope="col">Esfuerzo</th></tr></thead>
        <tbody>
          {ejs.map((e) => (
            <tr key={e.id}>
              <th scope="row"><span class="pe-nombre">{e.nombre}</span>{e.linea.length > 1 && <MiniLinea valores={e.linea} ancho={56} alto={18} clase="registro-linea" />}</th>
              {e.cols.map((c, i) => {
                const prev = e.cols.slice(0, i).reverse().find((x) => x.e1rm != null);
                const dir = c.e1rm != null && prev ? (c.e1rm > prev.e1rm + 0.2 ? 'sube' : c.e1rm < prev.e1rm - 0.2 ? 'baja' : '') : '';
                return (
                  <td key={c.semanaId} class={`num pe-celda ${dir}`}>
                    {c.mejor ? <>{textoSerie(c.mejor)}{dir && <Icono n={dir === 'sube' ? 'arriba' : 'abajo'} />}<span class="mini terciario"> ({c.n})</span>{dir && <span class="sr">{dir === 'sube' ? ', sube' : ', baja'}</span>}</> : <span class="terciario">—</span>}
                  </td>
                );
              })}
              <td>{e.desvio != null ? <span class={`chip num registro-desvio ${tonoDesvio(e.desvio)}`}>{textoDesvio(e.desvio)}</span> : <span class="terciario">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// (v0.206) La semana arriba: sesiones, series hechas de las pautadas, toneladas y esfuerzo medio, frente a la anterior; y
// revisar de un toque las que faltan
function ResumenSemana({ completo, semana, revisadas, alRevisar }) {
  if (!semana) return null;
  const r = resumenSemanaBloque(completo, semana.id);
  const ant = completo.semanas.find((w) => w.numero === semana.numero - 1);
  const a = ant ? resumenSemanaBloque(completo, ant.id) : null;
  const pend = r.porRevisar.filter((id) => !revisadas.has(id));
  const dif = (v, b, dec = 0, u = '') => (b == null || v == null || v === b ? null : <span class={`frente-anterior ${v > b ? 'sube' : 'baja'}`}>{v > b ? '+' : '−'}{num(Math.abs(v - b), dec)}{u}<span class="sr"> frente a la semana anterior</span></span>);
  return (
    <section class="panel panel-pad registro-semana" aria-label={`Resumen de la semana ${semana.numero}`}>
      <div class="separa">
        <span class="registro-semana-tit"><strong>Semana {semana.numero}</strong>{a ? <span class="mini terciario">frente a la semana {ant.numero}</span> : null}</span>
        {pend.length > 0 && <button type="button" class="btn btn-peq" onClick={() => alRevisar(pend)}><Icono n="hecho" /> Revisar {pend.length === 1 ? 'la que falta' : `las ${pend.length} que faltan`}</button>}
      </div>
      <dl class="registro-semana-cifras">
        <div><dt>Sesiones</dt><dd class="num">{r.sesiones.hechas} de {r.sesiones.total} {dif(r.sesiones.hechas, a?.sesiones.hechas)}</dd></div>
        <div><dt>Series</dt><dd class="num">{r.series.hechas} de {r.series.pautadas} {dif(r.series.hechas, a?.series.hechas)}</dd></div>
        <div><dt>Toneladas</dt><dd class="num">{num(Math.round(r.toneladas / 100) / 10, 1)} t {dif(Math.round(r.toneladas / 100) / 10, a ? Math.round(a.toneladas / 100) / 10 : null, 1, ' t')}</dd></div>
        <div><dt>Esfuerzo</dt><dd>{r.desvio != null ? <span class={`chip num registro-desvio ${tonoDesvio(r.desvio)}`}>{textoDesvio(r.desvio)}</span> : <span class="terciario">sin RPE</span>}</dd></div>
      </dl>
    </section>
  );
}

// (v0.206) Comentar una serie: va al hilo de la sesión, con la serie citada
function ComentarSerie({ atleta, c, alCerrar }) {
  const { api, aviso } = useApp();
  const [texto, setTexto] = useState('');
  const [ocupado, una] = useUnaVez();
  const cita = `Sobre la serie ${c.n} de ${c.nombre} (${c.texto})`;
  return (
    <form class="registro-comentar pila-s" onSubmit={(e) => {
      e.preventDefault();
      const t = texto.trim();
      if (!t) return;
      una(async () => {
        try { await api.comentar({ atletaId: atleta.id, sesionId: c.s, autor: 'coach', texto: `${cita}: ${t}` }); aviso('Comentario enviado en el hilo de la sesión', 'ok'); alCerrar(); }
        catch (err) { aviso(err?.message || 'No se ha podido enviar', 'error'); }
      });
    }}>
      <label class="mini secundario" for={`com-${c.h}`}>{cita}</label>
      <textarea id={`com-${c.h}`} class="entrada" rows={2} maxLength={1500} value={texto} onInput={(e) => setTexto(e.currentTarget.value)} placeholder="Tu comentario" />
      <div class="fila-envolver">
        <button class="btn btn-primario btn-peq" disabled={ocupado || !texto.trim()}><Icono n="enviar" /> Enviar</button>
        <button type="button" class="btn btn-peq" onClick={alCerrar}>Cancelar</button>
      </div>
    </form>
  );
}

// (v0.206) Dos sesiones lado a lado: la elegida y otra del bloque (de entrada, la última con el mismo nombre)
function CompararSesiones({ s, sesiones, completo, ejercicios, alCerrar }) {
  const otras = sesiones.filter((x) => x.id !== s.id);
  const mismo = otras.filter((x) => x.nombre === s.nombre);
  const [otra, setOtra] = useState((mismo.find((x) => (x.fecha_realizada || '') < (s.fecha_realizada || '9')) || mismo[0] || otras[0])?.id || null);
  const b = otras.find((x) => x.id === otra);
  const filas = b ? emparejarSesiones({ pautas: completo.pautas[s.id] || [], series: completo.series }, { pautas: completo.pautas[b.id] || [], series: completo.series }) : [];
  const etq = (x) => `S${x.semana.numero}: ${x.nombre}${x.fecha_realizada ? ` (${fmtCorta(x.fecha_realizada)})` : ''}`;
  return (
    <Hoja titulo="Comparar sesiones" alCerrar={alCerrar} ancho={760}>
      <div class="pila">
        <div class="campo"><label for="cmp-otra">Con</label>
          <select id="cmp-otra" class="selector" value={otra || ''} onChange={(e) => setOtra(e.currentTarget.value)}>
            {otras.map((x) => <option key={x.id} value={x.id}>{etq(x)}</option>)}
          </select></div>
        {b && (
          <div class="tabla-env" tabIndex={0} role="region" aria-label="Las dos sesiones, ejercicio a ejercicio">
            <table class="tabla-simple registro-comparar">
              <thead><tr><th scope="col">Ejercicio</th><th scope="col">{etq(s)}</th><th scope="col">{etq(b)}</th></tr></thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id}>
                    <th scope="row">{ejercicios[f.id]?.nombre || 'Ejercicio'}{f.fr && f.fr.dir !== 'igual' && <span class={`registro-antes ${f.fr.dir}`}><Icono n={f.fr.dir === 'sube' ? 'arriba' : 'abajo'} /><span class="sr">{f.fr.dir === 'sube' ? ' (mejor en la primera)' : ' (mejor en la segunda)'}</span></span>}</th>
                    <td class="num">{f.a.length ? f.a.map(textoSerie).join(', ') : <span class="terciario">—</span>}</td>
                    <td class="num">{f.b.length ? f.b.map(textoSerie).join(', ') : <span class="terciario">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Hoja>
  );
}
