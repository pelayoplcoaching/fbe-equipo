import { Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Siluetas, useApp, useCarga, useUnaVez, Icono, Vacio } from '../comunes.jsx';
import { HojaVoz } from './RevisarExtra.jsx';
import { hoyISO, sumarDias, desdeISO, lunesDe, fmtCorta } from '../../logica/fechas.js';
import { pauta, textoSerie } from '../../logica/calculos.js';
import { semanasActividad, textoSemanaActividad, agruparRecords, esfuerzoSerie } from '../../logica/progreso-visual-2.js';
import { FILTROS_ACTIVIDAD, filtrarActividad, cabeceraActividad, nuevosDesde, FRASES_KUDOS, textoKudosRecord, TEXTO_KUDOS_CHECKIN } from '../../logica/registro-actividad.js';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function dia(iso, hoy) {
  if (iso === hoy) return 'Hoy';
  if (iso === sumarDias(hoy, -1)) return 'Ayer';
  const d = desdeISO(iso);
  return `${DIAS[d.getDay()].charAt(0).toUpperCase()}${DIAS[d.getDay()].slice(1)}, ${d.getDate()} ${MES[d.getMonth()]}`;
}
const haceDias = (n) => (n === 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} días`);

// Lo que ha hecho el atleta, día a día (como el feed de actividad de Trainerize o TrueCoach)
// (v0.205) con su cabecera de un vistazo, su día (hábitos, comidas, suplementos y Salud), lo que no hizo, la hora de cada
// cosa, lo nuevo desde tu última visita, más filtros y buscar por ejercicio; y desde cada cosa: ir justo a ella, ver la
// sesión ahí mismo, contestarle y felicitarle de varias formas. irA(pestaña, foco)
export function Actividad({ atleta, irA }) {
  const { api, aviso } = useApp();
  const [dias, setDias] = useState(30);
  // v0.66: «Bien hecho» con un toque (un mensaje en el hilo de esa sesión; le llega el aviso)
  // (v0.205) lo que ya le has enviado desde aquí: clave → lo que dice su botón después («Bien hecho» enviado, Felicitado…)
  const [felicitadas, setFelicitadas] = useState(() => new Map());
  const marcar = (clave, txt) => setFelicitadas((f) => new Map([...f, [clave, txt]]));
  const [ocupado, una] = useUnaVez();
  const enviarHilo = (clave, datos, texto, hecho, etiqueta = 'Felicitado') => una(async () => {
    try {
      await api.comentar({ atletaId: atleta.id, autor: 'coach', texto, ...datos });
      marcar(clave, etiqueta);
      aviso(hecho, 'ok');
    } catch (err) { aviso(err?.message || 'No se ha podido enviar: vuelve a intentarlo', 'error'); }
  });
  const primer = atleta.nombre?.split(' ')[0] || 'tu atleta';
  const [filtro, setFiltro] = useState('todo');
  const [busca, setBusca] = useState('');
  const res = useCarga(() => api.actividad(atleta.id, dias), [atleta.id, dias]);
  const constancia = useCarga(() => api.constancia(atleta.id).catch(() => null), [atleta.id]);
  const hoy = hoyISO();
  // (v0.205) lo nuevo desde tu última visita (en este aparato): se mira al llegar y se apunta la de ahora
  const claveVista = `fbe-actividad-vista:${api.uid()}:${atleta.id}`;
  const [nuevos, setNuevos] = useState(null);
  useEffect(() => {
    if (!res.datos || nuevos) return;
    let antes = null;
    try { antes = Number(localStorage.getItem(claveVista)) || null; } catch { antes = null; }
    setNuevos(nuevosDesde(res.datos, antes));
    try { localStorage.setItem(claveVista, String(Date.now())); } catch { /* */ }
  }, [res.datos]);
  const [abiertos, setAbiertos] = useState(() => new Set());
  const alternar = (k) => setAbiertos((a) => { const n = new Set(a); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const [responder, setResponder] = useState(null);
  const [voz, setVoz] = useState(null);
  const lista = filtrarActividad(res.datos || [], filtro, busca);
  const grupos = [];
  for (const e of lista) { const g = grupos[grupos.length - 1]; if (g && g.fecha === e.fecha) g.items.push(e); else grupos.push({ fecha: e.fecha, items: [e] }); }
  // (v0.204) las cifras de cada semana (de todo, con el filtro que sea), para su banda entre semana y semana
  const porSemana = semanasActividad(res.datos || []);
  const cab = res.datos ? cabeceraActividad(res.datos, hoy) : null;
  const nuevosN = nuevos ? lista.filter((e) => nuevos.has(e.clave)).length : 0;
  let visto = false, visto0 = false;

  const kudos = (e) => {
    if (!(e.tipo === 'sesion' && e.sesionId)) return null;
    if (e.comentada || felicitadas.has(e.clave)) return <span class="actividad-kudos hecho peq secundario"><Icono n="hecho" /> {felicitadas.get(e.clave) || 'Ya le has escrito'}</span>;
    return (
      <span class="actividad-kudos">
        <button class="btn btn-peq" disabled={ocupado} onClick={() => enviarHilo(e.clave, { sesionId: e.sesionId }, FRASES_KUDOS[0].replace('!', `${e.nombreSesion ? ` en ${e.nombreSesion}` : ''}!`), `«Bien hecho» enviado a ${primer}`, '«Bien hecho» enviado')} aria-label={`Decirle «Bien hecho» por ${e.nombreSesion || 'este entreno'}`}>💪 Bien hecho</button>
        <button class="btn btn-peq btn-icono plano" aria-expanded={abiertos.has(`k:${e.clave}`) ? 'true' : 'false'} onClick={() => alternar(`k:${e.clave}`)} aria-label="Otras frases para felicitarle"><Icono n="mas" /></button>
        {abiertos.has(`k:${e.clave}`) && (
          <span class="kudos-frases" role="group" aria-label="Otras frases">
            {FRASES_KUDOS.slice(1).map((t) => <button key={t} type="button" class="chip" disabled={ocupado} onClick={() => enviarHilo(e.clave, { sesionId: e.sesionId }, t, `Enviado a ${primer}`)}>{t}</button>)}
          </span>
        )}
      </span>
    );
  };
  const felicitarRecord = (r) => (felicitadas.has(r.clave)
    ? <span class="actividad-kudos hecho peq secundario"><Icono n="hecho" /> Felicitado</span>
    : <button class="btn btn-peq actividad-kudos" disabled={ocupado} onClick={() => enviarHilo(r.clave, { sesionId: r.sesionId }, textoKudosRecord(r.ejercicio), `Felicitado por su récord en ${r.ejercicio}`)} aria-label={`Felicitarle por su récord en ${r.ejercicio}`}>🏆 Felicitar</button>);

  return (
    <div class="pila">
      {/* (v0.205) de un vistazo: su último entreno, esta semana, su racha, su último check-in y sus 30 días */}
      {cab && (
        <section class="panel panel-pad actividad-cabecera" aria-label="Su actividad, de un vistazo">
          <dl class="act-cifras">
            <div><dt>Último entreno</dt><dd>{cab.ultimo ? <>{haceDias(cab.ultimo.dias)}<span class="mini terciario"> ({fmtCorta(cab.ultimo.fecha)})</span></> : 'Ninguno en 30 días'}</dd></div>
            <div><dt>Esta semana</dt><dd class="num">{cab.estaSemana}{constancia.datos?.actual?.objetivo || constancia.datos?.actual?.total ? ` de ${constancia.datos.actual.objetivo || constancia.datos.actual.total}` : ''} {(constancia.datos?.actual?.objetivo || constancia.datos?.actual?.total || cab.estaSemana) === 1 ? 'sesión' : 'sesiones'}</dd></div>
            {constancia.datos && <div><dt>Racha</dt><dd class="num">{constancia.datos.racha} {constancia.datos.racha === 1 ? 'semana' : 'semanas'}</dd></div>}
            <div><dt>Último check-in</dt><dd>{cab.checkin ? haceDias(cab.checkin.dias) : 'Ninguno en 30 días'}</dd></div>
          </dl>
          <div class="act-mapa" role="img" aria-label={`Sus últimos 30 días: ${cab.entrenos30} con entreno`}>
            {cab.mapa.map((d) => <i key={d.fecha} class={`${d.si ? 'am-si' : ''} ${d.record ? 'am-rec' : ''} ${d.hoy ? 'am-hoy' : ''}`} />)}
          </div>
        </section>
      )}
      <div class="selector-chips" role="group" aria-label="Qué ver">
        {FILTROS_ACTIVIDAD.map(([k, t]) => <button key={k} aria-pressed={filtro === k ? 'true' : 'false'} onClick={() => setFiltro(k)}>{t}</button>)}
      </div>
      <div class="actividad-busca">
        <Icono n="buscar" />
        <input type="search" class="entrada" placeholder="Buscar por ejercicio" aria-label="Buscar por ejercicio" value={busca} onInput={(e) => setBusca(e.currentTarget.value)} />
      </div>
      {nuevosN > 0 && <p class="actividad-nuevos peq" role="status"><span class="chip morado">{nuevosN} {nuevosN === 1 ? 'cosa nueva' : 'cosas nuevas'}</span> desde tu última visita</p>}
      {res.cargando && !res.datos ? <Siluetas forma="lista" n={6} texto="Cargando su actividad" /> : !lista.length ? (
        <div class="panel"><Vacio ilustracion="actividad" icono="historial" titulo={busca ? `Nada con «${busca}»` : `Nada en los últimos ${dias} días`}>{busca || filtro !== 'todo' ? 'Prueba con otro filtro o quita la búsqueda.' : 'Cuando entrene, se pese, envíe su check-in o te escriba, aparecerá aquí.'}</Vacio></div>
      ) : (
        <ol class="actividad">
          {grupos.map((g, k) => {
            const w = lunesDe(g.fecha);
            const nuevaSemana = k === 0 || lunesDe(grupos[k - 1].fecha) !== w;
            return (
            <li key={g.fecha} class="actividad-dia">
              {nuevaSemana && porSemana[w] && (
                <p class="actividad-semana peq">
                  <strong>{w === lunesDe(hoy) ? 'Esta semana' : `Semana del ${fmtCorta(w)}`}</strong>
                  <span class="secundario">{textoSemanaActividad(porSemana[w])}</span>
                </p>
              )}
              <h2 class="mini">{dia(g.fecha, hoy)}</h2>
              <ul class="panel lista">
                {agruparRecords(g.items).map((e, i) => {
                  const nuevo = !!nuevos && (e.tipo === 'records' ? e.records.some((r) => nuevos.has(r.clave)) : nuevos.has(e.clave));
                  // la raya «Hasta aquí lo viste», antes de la primera cosa ya vista tras alguna nueva
                  const raya = nuevos && nuevosN > 0 && !nuevo && visto0 && !visto;
                  if (nuevo) visto0 = true;
                  if (raya) visto = true;
                  return (
                  <Fragment key={i}>
                    {raya && <li class="actividad-visto" role="separator"><span>Hasta aquí lo viste</span></li>}
                    {e.tipo === 'records' ? (
                      <li class={`actividad-records${nuevo ? ' nuevo' : ''}`}>
                        <button class="actividad-item act-record" aria-expanded={abiertos.has(`r:${g.fecha}`) ? 'true' : 'false'} onClick={() => alternar(`r:${g.fecha}`)}>
                          <span class="actividad-ico" aria-hidden="true"><Icono n="trofeo" /></span>
                          <span class="pila-xs"><span class="actividad-titulo">{e.titulo}{nuevo && <span class="chip morado chip-nuevo">Nuevo</span>}</span>
                            <span class="trofeos-fila" aria-hidden="true">{e.records.slice(0, 8).map((r, j) => <Icono key={j} n="trofeo" />)}</span>
                            <span class="peq secundario">{e.records.map((r) => r.ejercicio || r.titulo).join(', ')}</span></span>
                          <Icono n="abajo" />
                        </button>
                        {abiertos.has(`r:${g.fecha}`) && (
                          <ul class="actividad-records-lista">
                            {e.records.map((r, j) => (
                              <li key={j}>
                                <button class="actividad-item act-record" onClick={() => irA(r.pestana, r.foco || null)}>
                                  <span class="actividad-ico" aria-hidden="true"><Icono n="trofeo" /></span>
                                  <span class="pila-xs"><span class="actividad-titulo">{r.titulo}</span>{r.detalle && <span class="peq secundario">{r.detalle}</span>}</span>
                                  <Icono n="derecha" />
                                </button>
                                {felicitarRecord(r)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ) : (
                      <li class={nuevo ? 'nuevo' : ''}>
                        <button class={`actividad-item act-${e.tipo}`} onClick={() => irA(e.pestana, e.foco || null)}>
                          <span class="actividad-ico" aria-hidden="true"><Icono n={e.icono} /></span>
                          <span class="pila-xs"><span class="actividad-titulo">{e.titulo}{e.hora && <span class="actividad-hora num">{e.hora}</span>}{nuevo && <span class="chip morado chip-nuevo">Nuevo</span>}{e.aviso && <span class="chip aviso">{e.tipo === 'video' || e.tipo === 'foto' ? 'Por revisar' : 'Mírale'}</span>}</span>
                            {e.detalle && <span class="peq secundario">{e.detalle}</span>}</span>
                          <Icono n="derecha" />
                        </button>
                        {/* (v0.205) debajo: ver la sesión ahí mismo, felicitar, contestarle */}
                        {(e.tipo === 'sesion' || e.tipo === 'record' || e.tipo === 'checkin' || e.tipo === 'mensaje') && (
                          <div class="actividad-acciones">
                            {e.tipo === 'sesion' && e.sesionId && <button type="button" class="btn btn-peq" aria-expanded={abiertos.has(`s:${e.clave}`) ? 'true' : 'false'} onClick={() => alternar(`s:${e.clave}`)}><Icono n={abiertos.has(`s:${e.clave}`) ? 'arriba' : 'abajo'} /> {abiertos.has(`s:${e.clave}`) ? 'Ocultar las series' : 'Ver las series'}</button>}
                            {kudos(e)}
                            {e.tipo === 'record' && e.sesionId && felicitarRecord(e)}
                            {e.tipo === 'checkin' && e.checkinId && (felicitadas.has(e.clave)
                              ? <span class="actividad-kudos hecho peq secundario"><Icono n="hecho" /> {felicitadas.get(e.clave)}</span>
                              : <button class="btn btn-peq actividad-kudos" disabled={ocupado} onClick={() => enviarHilo(e.clave, { checkinId: e.checkinId }, TEXTO_KUDOS_CHECKIN, `Enviado a ${primer}`, 'Agradecido')} aria-label="Darle las gracias por el check-in">🙌 Gracias</button>)}
                            {e.tipo === 'mensaje' && e.comentarioId && <button type="button" class="btn btn-peq" aria-expanded={responder === e.clave ? 'true' : 'false'} onClick={() => setResponder(responder === e.clave ? null : e.clave)}><Icono n="reenviar" /> Responder</button>}
                            {e.tipo === 'mensaje' && e.comentarioId && !e.hilo?.sesionId && !e.hilo?.checkinId && !e.hilo?.archivoId && <button type="button" class="btn btn-peq" onClick={() => setVoz(e)}><Icono n="micro" /> Nota de voz</button>}
                          </div>
                        )}
                        {e.tipo === 'sesion' && abiertos.has(`s:${e.clave}`) && <SeriesDeSesion atletaId={atleta.id} sesionId={e.sesionId} />}
                        {e.tipo === 'mensaje' && responder === e.clave && <Respuesta atleta={atleta} e={e} alEnviado={() => { setResponder(null); marcar(e.clave, 'Contestado'); }} />}
                        {e.tipo === 'mensaje' && felicitadas.has(e.clave) && responder !== e.clave && <span class="actividad-kudos hecho peq secundario"><Icono n="hecho" /> Contestado</span>}
                      </li>
                    )}
                  </Fragment>
                  );
                })}
              </ul>
            </li>
            );
          })}
        </ol>
      )}
      {res.datos && <button class="btn btn-peq" style="justify-self:start" onClick={() => setDias(dias + 30)}>Ver 30 días más</button>}
      {voz && <HojaVoz atleta={atleta} respondeA={voz.comentarioId} alCerrar={() => setVoz(null)} alEnviado={() => marcar(voz.clave, 'Contestado')} />}
    </div>
  );
}

// (v0.205) La sesión ahí mismo: sus ejercicios, lo pautado y cada serie en su ficha de color (como en Registro)
function SeriesDeSesion({ atletaId, sesionId }) {
  const { api } = useApp();
  const d = useCarga(() => api.sesion(sesionId, atletaId), [sesionId]);
  if (d.cargando && !d.datos) return <p class="peq secundario actividad-series" role="status">Cargando la sesión...</p>;
  if (d.error || !d.datos) return <p class="peq actividad-series">No se ha podido cargar la sesión.</p>;
  const ejs = (d.datos.ejercicios || []).filter((p) => (p.hechas || []).length || Number(p.series) > 0);
  return (
    <ul class="actividad-series">
      {ejs.map((p) => {
        const pa = pauta(p);
        const hechas = (p.hechas || []).filter((h) => Number(h.reps) > 0);
        return (
          <li key={p.id}>
            <span class="actividad-series-nombre">{p.ejercicio?.nombre || 'Ejercicio'} <span class="mini terciario">{pa.series}{pa.esfuerzo ? `, ${pa.esfuerzo}` : ''}</span></span>
            {hechas.length ? <span class="fichas-serie">{hechas.map((h, i) => <Fragment key={i}>{i ? <span class="sr">, </span> : ''}<span class={`serie-ficha esf-${esfuerzoSerie(p, h)}`}>{textoSerie(h)}</span></Fragment>)}</span>
              : <span class="chip aviso registro-saltado">Sin hacer</span>}
          </li>
        );
      })}
    </ul>
  );
}

// (v0.205) Contestarle ahí mismo: en el mismo hilo (la sesión, el check-in o el vídeo) o en su chat, citando lo que te dijo
function Respuesta({ atleta, e, alEnviado }) {
  const { api, aviso } = useApp();
  const [texto, setTexto] = useState('');
  const [ocupado, una] = useUnaVez();
  const enviar = (ev) => {
    ev.preventDefault();
    const t = texto.trim();
    if (!t) return;
    una(async () => {
      try {
        const h = e.hilo || {};
        if (h.sesionId || h.checkinId || h.archivoId) await api.comentar({ atletaId: atleta.id, autor: 'coach', texto: t, respondeA: e.comentarioId, ...h });
        else await api.enviarMensaje(atleta.id, { texto: t, autor: 'coach', respondeA: e.comentarioId });
        aviso(`Enviado a ${atleta.nombre?.split(' ')[0] || 'tu atleta'}`, 'ok');
        alEnviado();
      } catch (err) { aviso(err?.message || 'No se ha podido enviar: vuelve a intentarlo', 'error'); }
    });
  };
  const donde = e.hilo?.sesionId ? 'en el hilo de esa sesión' : e.hilo?.checkinId ? 'en el hilo de ese check-in' : e.hilo?.archivoId ? 'en el hilo de ese vídeo' : 'en su chat';
  return (
    <form class="actividad-respuesta pila-s" onSubmit={enviar}>
      <label class="mini secundario" for={`resp-${e.clave}`}>Tu respuesta ({donde})</label>
      <textarea id={`resp-${e.clave}`} class="entrada" rows={2} maxLength={2000} value={texto} onInput={(x) => setTexto(x.currentTarget.value)} placeholder="Escribe tu respuesta" />
      <button class="btn btn-primario btn-peq" disabled={ocupado || !texto.trim()}><Icono n="enviar" /> Enviar</button>
    </form>
  );
}
