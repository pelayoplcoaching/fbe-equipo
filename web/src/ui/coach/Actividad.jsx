import { Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Siluetas, useApp, useCarga, useUnaVez, Icono, Vacio, Segmentos, copiar } from '../comunes.jsx';
import { HojaVoz } from './RevisarExtra.jsx';
import { MiniVideo } from './RegistroCoach.jsx';
import { MiniLinea } from '../atleta/ProgresoPiezas.jsx';
import { DetalleArchivo } from '../Diario.jsx';
import { hoyISO, sumarDias, desdeISO, lunesDe, fmtCorta, diasEntre } from '../../logica/fechas.js';
import { pauta, textoSerie, num } from '../../logica/calculos.js';
import { semanasActividad, textoSemanaActividad, agruparRecords, esfuerzoSerie } from '../../logica/progreso-visual-2.js';
import { FILTROS_ACTIVIDAD, filtrarActividad, cabeceraActividad, nuevosDesde, FRASES_KUDOS, textoKudosRecord, TEXTO_KUDOS_CHECKIN,
  paraMirar, colgarDeSesion, detalleSemana, textoResumenSemana, calendarioActividad, sumarVistos } from '../../logica/registro-actividad.js';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function dia(iso, hoy) {
  if (iso === hoy) return 'Hoy';
  if (iso === sumarDias(hoy, -1)) return 'Ayer';
  const d = desdeISO(iso);
  return `${DIAS[d.getDay()].charAt(0).toUpperCase()}${DIAS[d.getDay()].slice(1)}, ${d.getDate()} ${MES[d.getMonth()]}`;
}
const haceDias = (n) => (n === 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} días`);
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const mesMas = (mes, n) => { const [y, m] = mes.split('-').map(Number); const t = y * 12 + (m - 1) + n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; };
// (v0.206) lo que sale en cada día del calendario (en este orden) y cómo se dice
const TIPOS_CAL = [['sesion', 'entrenó'], ['record', 'récord'], ['checkin', 'check-in'], ['peso', 'se pesó'], ['mensaje', 'te escribió'], ['media', 'vídeo o foto'], ['nohecho', 'algo sin hacer']];
const tipoCal = (t) => (t === 'video' || t === 'foto' ? 'media' : t === 'saltada' || t === 'paron' ? 'nohecho' : t);

// Lo que ha hecho el atleta, día a día (como el feed de actividad de Trainerize o TrueCoach)
// (v0.205) con su cabecera de un vistazo, su día (hábitos, comidas, suplementos y Salud), lo que no hizo, la hora de cada
// cosa, lo nuevo desde tu última visita, más filtros y buscar por ejercicio; y desde cada cosa: ir justo a ella, ver la
// sesión ahí mismo, contestarle y felicitarle de varias formas. irA(pestaña, foco)
// (v0.206) «Para mirar» arriba, los récords y los comentarios colgando de su sesión, la banda de la semana que se despliega
// (con su resumen para copiar), el calendario del mes, las miniaturas de fotos y vídeos, cada pesada con su tendencia y su
// minilínea, «Lo mío también», marcar como visto y «Todo visto», y su ritmo de estas 4 semanas frente a las 4 anteriores
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
  const ritmo = useCarga(() => (api.ritmoEntreno ? api.ritmoEntreno(atleta.id).catch(() => null) : Promise.resolve(null)), [atleta.id]);
  const hoy = hoyISO();
  // (v0.206) lista o calendario del mes; lo tuyo también; lo que ya has visto (en este aparato); la foto o el vídeo abierto
  const [vista, setVista] = useState('lista');
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [diaSel, setDiaSel] = useState(null);
  const [mios, setMios] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const claveVistos = `fbe-actividad-vistos:${api.uid()}:${atleta.id}`;
  const [vistos, setVistos] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem(claveVistos) || '[]')); } catch { return new Set(); } });
  const guardarVistos = (arr) => { try { localStorage.setItem(claveVistos, JSON.stringify(arr)); } catch { /* sin almacenamiento, solo en esta visita */ } return new Set(arr); };
  const verVistos = (claves) => setVistos((v) => guardarVistos(sumarVistos([...v], claves)));
  const quitarVisto = (clave) => setVistos((v) => guardarVistos([...v].filter((k) => k !== clave)));
  // al ir a un mes anterior, se cargan los días que hagan falta
  useEffect(() => {
    if (vista !== 'calendario') return;
    const hace = diasEntre(`${mes}-01`, hoy) + 2;
    if (hace > dias) setDias(Math.min(400, hace));
  }, [vista, mes]);
  // (v0.205) lo nuevo desde tu última visita (en este aparato): se mira al llegar y se apunta la de ahora
  const claveVista = `fbe-actividad-vista:${api.uid()}:${atleta.id}`;
  const [nuevos, setNuevos] = useState(null);
  useEffect(() => {
    if (!res.datos || nuevos) return;
    let antes = null;
    try { antes = Number(localStorage.getItem(claveVista)) || null; } catch { antes = null; }
    setNuevos(nuevosDesde(res.datos.filter((e) => !e.mio), antes));
    try { localStorage.setItem(claveVista, String(Date.now())); } catch { /* */ }
  }, [res.datos]);
  const [abiertos, setAbiertos] = useState(() => new Set());
  const alternar = (k) => setAbiertos((a) => { const n = new Set(a); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const [responder, setResponder] = useState(null);
  const [voz, setVoz] = useState(null);
  const todos = res.datos || [];
  const lista = filtrarActividad(mios ? todos : todos.filter((e) => !e.mio), filtro, busca);
  const gruposTodos = [];
  for (const e of lista) { const g = gruposTodos[gruposTodos.length - 1]; if (g && g.fecha === e.fecha) g.items.push(e); else gruposTodos.push({ fecha: e.fecha, items: [e] }); }
  // en el calendario, solo el día que toques
  const grupos = vista === 'calendario' ? gruposTodos.filter((g) => g.fecha === diaSel) : gruposTodos;
  // (v0.204) las cifras de cada semana (de todo, con el filtro que sea), para su banda entre semana y semana
  const porSemana = semanasActividad(todos.filter((e) => !e.mio));
  const previstas = Object.fromEntries((constancia.datos?.semanas || []).filter((w) => w.fecha_inicio).map((w) => [lunesDe(w.fecha_inicio), w.total]));
  const cab = res.datos ? cabeceraActividad(res.datos, hoy) : null;
  const nuevosN = nuevos ? lista.filter((e) => nuevos.has(e.clave) && !vistos.has(e.clave)).length : 0;
  const mirar = res.datos ? paraMirar(todos, hoy).filter((e) => !vistos.has(e.clave)).slice(0, 6) : [];
  // «Todo visto»: lo que se ve ahora (con lo que cuelga de cada sesión)
  const clavesVisibles = grupos.flatMap((g) => g.items.filter((e) => !e.mio).map((e) => e.clave)).filter(Boolean);
  const porVer = clavesVisibles.filter((k) => !vistos.has(k)).length;
  const r = ritmo.datos;
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

  // (v0.206) marcar como visto (y quitarlo): lo visto se apaga
  const botonVisto = (e) => (e.mio || !e.clave ? null : vistos.has(e.clave)
    ? <button type="button" class="btn-icono plano act-visto-btn" aria-pressed="true" onClick={() => quitarVisto(e.clave)} aria-label={`Visto: ${e.titulo}. Tocar para volver a marcarlo`} title="Visto"><Icono n="hecho" /></button>
    : <button type="button" class="btn-icono plano act-visto-btn" aria-pressed="false" onClick={() => verVistos([e.clave, ...(e.hijos ? [...e.hijos.records, ...e.hijos.mensajes].map((x) => x.clave) : [])])} aria-label={`Marcar como visto: ${e.titulo}`} title="Marcar como visto"><Icono n="ojo-abierto" /></button>);
  // (v0.206) lo que cuelga de una sesión: sus récords (con «Felicitar») y lo que te escribió en ella (con «Responder»)
  const hijosDe = (e) => {
    const h = e.hijos;
    if (!h || (!h.records.length && !h.mensajes.length)) return null;
    return (
      <ul class="actividad-hijos" aria-label="De esta sesión">
        {h.records.map((x) => (
          <li key={x.clave} class={`act-hijo-record${nuevos?.has(x.clave) && !vistos.has(x.clave) ? ' nuevo' : ''}`}>
            <button type="button" class="actividad-hijo" onClick={() => irA(x.pestana, x.foco || null)}><Icono n="trofeo" /><span><b>{x.titulo}</b>{x.detalle ? `: ${x.detalle}` : ''}</span></button>
            {felicitarRecord(x)}
          </li>
        ))}
        {h.mensajes.map((x) => (
          <li key={x.clave} class={`act-hijo-mensaje${nuevos?.has(x.clave) && !vistos.has(x.clave) ? ' nuevo' : ''}`}>
            <button type="button" class="actividad-hijo" onClick={() => irA(x.pestana, x.foco || null)}><Icono n="mensaje" /><span><b>Te escribió{x.hora ? ` a las ${x.hora}` : ''}:</b> {x.detalle}</span></button>
            {felicitadas.has(x.clave)
              ? <span class="actividad-kudos hecho peq secundario"><Icono n="hecho" /> Contestado</span>
              : <button type="button" class="btn btn-peq" aria-expanded={responder === x.clave ? 'true' : 'false'} onClick={() => setResponder(responder === x.clave ? null : x.clave)}><Icono n="reenviar" /> Responder</button>}
            {responder === x.clave && <Respuesta atleta={atleta} e={x} alEnviado={() => { setResponder(null); marcar(x.clave, 'Contestado'); }} />}
          </li>
        ))}
      </ul>
    );
  };

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
          {/* (v0.206) su ritmo: estas 4 semanas frente a las 4 anteriores */}
          {r && (r.ahora.n > 0 || r.antes.n > 0) && (
            <p class="act-ritmo peq num">
              <span class="act-ritmo-etq">Su ritmo</span>
              <span>{r.ahora.n} {r.ahora.n === 1 ? 'entreno' : 'entrenos'} en 4 semanas <Flecha a={r.ahora.n} b={r.antes.n} /><span class="terciario"> (antes, {r.antes.n})</span></span>
              {r.ahora.minutos != null && <span>{r.ahora.minutos} min de media <Flecha a={r.ahora.minutos} b={r.antes.minutos} margen={3} />{r.antes.minutos != null && <span class="terciario"> (antes, {r.antes.minutos})</span>}</span>}
            </p>
          )}
        </section>
      )}
      {/* (v0.206) «Para mirar»: lo de estos 7 días que pide tu atención, con su motivo */}
      {vista === 'lista' && filtro === 'todo' && !busca && mirar.length > 0 && (
        <section class="panel actividad-mirar" aria-labelledby="act-mirar-t">
          <div class="actividad-mirar-cab"><h2 id="act-mirar-t" class="actividad-mirar-titulo"><Icono n="alerta" /> Para mirar</h2><span class="mini terciario">Estos 7 días</span></div>
          <ul class="lista">
            {mirar.map((e) => (
              <li key={e.clave}>
                <div class="actividad-fila">
                  <button type="button" class={`mirar-item act-${e.tipo}`} onClick={() => irA(e.pestana, e.foco || null)}>
                    <span class="pila-xs"><span class="actividad-titulo">{e.titulo}</span><span class="peq secundario">{dia(e.fecha, hoy)}{e.detalle ? `: ${e.detalle}` : ''}</span></span>
                    <span class="chip aviso">{e.motivo}</span>
                  </button>
                  {botonVisto(e)}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div class="actividad-controles">
        <Segmentos opciones={[['lista', 'Lista'], ['calendario', 'Calendario']]} valor={vista} alCambiar={(v) => v && setVista(v)} etiqueta="Cómo ver su actividad" clase="seg-compacto" />
        <button type="button" class="btn btn-peq" aria-pressed={mios ? 'true' : 'false'} onClick={() => setMios(!mios)}><Icono n="enviar" /> Lo mío también</button>
        {porVer > 0 && <button type="button" class="btn btn-peq" onClick={() => { verVistos(grupos.flatMap((g) => g.items.flatMap((e) => [e.clave, ...(e.tipo === 'records' ? e.records.map((x) => x.clave) : [])]))); aviso('Todo visto', 'ok'); }}><Icono n="hecho" /> Todo visto</button>}
      </div>
      <div class="selector-chips" role="group" aria-label="Qué ver">
        {FILTROS_ACTIVIDAD.map(([k, t]) => <button key={k} aria-pressed={filtro === k ? 'true' : 'false'} onClick={() => setFiltro(k)}>{t}</button>)}
      </div>
      <div class="actividad-busca">
        <Icono n="buscar" />
        <input type="search" class="entrada" placeholder="Buscar por ejercicio" aria-label="Buscar por ejercicio" value={busca} onInput={(e) => setBusca(e.currentTarget.value)} />
      </div>
      {vista === 'calendario' && res.datos && (
        <CalendarioActividad semanas={calendarioActividad(lista, mes, hoy)} mes={mes} hoy={hoy} diaSel={diaSel}
          alElegir={(f) => setDiaSel(diaSel === f ? null : f)} alMes={(n) => { setMes(mesMas(mes, n)); setDiaSel(null); }} />
      )}
      {nuevosN > 0 && vista === 'lista' && <p class="actividad-nuevos peq" role="status"><span class="chip morado">{nuevosN} {nuevosN === 1 ? 'cosa nueva' : 'cosas nuevas'}</span> desde tu última visita</p>}
      {res.cargando && !res.datos ? <Siluetas forma="lista" n={6} texto="Cargando su actividad" /> : vista === 'calendario' && !diaSel ? (
        <p class="peq secundario">Toca un día para ver lo que hizo.</p>
      ) : !grupos.length ? (
        <div class="panel"><Vacio ilustracion="actividad" icono="historial" titulo={vista === 'calendario' ? `Nada el ${fmtCorta(diaSel)}` : busca ? `Nada con «${busca}»` : `Nada en los últimos ${dias} días`}>{vista === 'calendario' ? 'Elige otro día del calendario.' : busca || filtro !== 'todo' ? 'Prueba con otro filtro o quita la búsqueda.' : 'Cuando entrene, se pese, envíe su check-in o te escriba, aparecerá aquí.'}</Vacio></div>
      ) : (
        <ol class="actividad">
          {grupos.map((g, k) => {
            const w = lunesDe(g.fecha);
            const nuevaSemana = vista === 'lista' && (k === 0 || lunesDe(grupos[k - 1].fecha) !== w);
            const abiertaW = abiertos.has(`w:${w}`);
            return (
            <li key={g.fecha} class="actividad-dia">
              {nuevaSemana && porSemana[w] && (
                <div class="actividad-semana-env">
                  <button type="button" class="actividad-semana peq" aria-expanded={abiertaW ? 'true' : 'false'} onClick={() => alternar(`w:${w}`)}>
                    <strong>{w === lunesDe(hoy) ? 'Esta semana' : `Semana del ${fmtCorta(w)}`}</strong>
                    <span class="secundario">{textoSemanaActividad(porSemana[w])}</span>
                    <Icono n="abajo" />
                  </button>
                  {abiertaW && <DetalleSemana d={detalleSemana(todos, w, previstas)} nombre={primer} />}
                </div>
              )}
              <h2 class="mini">{dia(g.fecha, hoy)}</h2>
              <ul class="panel lista">
                {agruparRecords(colgarDeSesion(g.items)).map((e, i) => {
                  const apagado = !!e.clave && vistos.has(e.clave);
                  const nuevo = !!nuevos && !apagado && (e.tipo === 'records' ? e.records.some((x) => nuevos.has(x.clave)) : nuevos.has(e.clave) || !!e.hijos && [...e.hijos.records, ...e.hijos.mensajes].some((x) => nuevos.has(x.clave) && !vistos.has(x.clave)));
                  // la raya «Hasta aquí lo viste», antes de la primera cosa ya vista tras alguna nueva
                  const raya = vista === 'lista' && nuevos && nuevosN > 0 && !nuevo && visto0 && !visto;
                  if (nuevo) visto0 = true;
                  if (raya) visto = true;
                  return (
                  <Fragment key={e.clave || i}>
                    {raya && <li class="actividad-visto" role="separator"><span>Hasta aquí lo viste</span></li>}
                    {e.tipo === 'records' ? (
                      <li class={`actividad-records${nuevo ? ' nuevo' : ''}`}>
                        <button class="actividad-item act-record" aria-expanded={abiertos.has(`r:${g.fecha}`) ? 'true' : 'false'} onClick={() => alternar(`r:${g.fecha}`)}>
                          <span class="actividad-ico" aria-hidden="true"><Icono n="trofeo" /></span>
                          <span class="pila-xs"><span class="actividad-titulo">{e.titulo}{nuevo && <span class="chip morado chip-nuevo">Nuevo</span>}</span>
                            <span class="trofeos-fila" aria-hidden="true">{e.records.slice(0, 8).map((x, j) => <Icono key={j} n="trofeo" />)}</span>
                            <span class="peq secundario">{e.records.map((x) => x.ejercicio || x.titulo).join(', ')}</span></span>
                          <Icono n="abajo" />
                        </button>
                        {abiertos.has(`r:${g.fecha}`) && (
                          <ul class="actividad-records-lista">
                            {e.records.map((x, j) => (
                              <li key={j}>
                                <button class="actividad-item act-record" onClick={() => irA(x.pestana, x.foco || null)}>
                                  <span class="actividad-ico" aria-hidden="true"><Icono n="trofeo" /></span>
                                  <span class="pila-xs"><span class="actividad-titulo">{x.titulo}</span>{x.detalle && <span class="peq secundario">{x.detalle}</span>}</span>
                                  <Icono n="derecha" />
                                </button>
                                {felicitarRecord(x)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ) : (
                      <li class={`${nuevo ? 'nuevo' : ''}${apagado ? ' apagado' : ''}${e.mio ? ' mio' : ''}`}>
                        <div class="actividad-fila">
                          <button class={`actividad-item act-${e.tipo}`} onClick={() => irA(e.pestana, e.foco || null)}>
                            <span class="actividad-ico" aria-hidden="true"><Icono n={e.icono} /></span>
                            <span class="pila-xs"><span class="actividad-titulo">{e.titulo}{e.hora && <span class="actividad-hora num">{e.hora}</span>}{nuevo && <span class="chip morado chip-nuevo">Nuevo</span>}{e.aviso && !apagado && <span class="chip aviso">{e.tipo === 'video' || e.tipo === 'foto' ? 'Por revisar' : 'Mírale'}</span>}{e.mio && <span class="chip morado chip-tu">Tú</span>}</span>
                              {e.detalle && <span class="peq secundario">{e.detalle}</span>}
                              {/* (v0.206) cada pesada, con las de su semana en una minilínea */}
                              {e.tipo === 'peso' && (e.semanaKg || []).length > 1 && <span class="act-peso-linea"><MiniLinea valores={e.semanaKg} ancho={72} alto={18} clase="registro-linea" /><span class="mini terciario">sus pesadas de esa semana</span></span>}</span>
                            <Icono n="derecha" />
                          </button>
                          {/* (v0.206) la foto o el vídeo, ahí mismo */}
                          {e.archivo && <MiniVideo a={e.archivo} alAbrir={() => setArchivo(e.archivo)} />}
                          {botonVisto(e)}
                        </div>
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
                        {e.tipo === 'sesion' && hijosDe(e)}
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
      {res.datos && vista === 'lista' && <button class="btn btn-peq" style="justify-self:start" onClick={() => setDias(dias + 30)}>Ver 30 días más</button>}
      {voz && <HojaVoz atleta={atleta} respondeA={voz.comentarioId} alCerrar={() => setVoz(null)} alEnviado={() => marcar(voz.clave, 'Contestado')} />}
      {archivo && <DetalleArchivo a={archivo} lista={[]} atletaId={atleta.id} nombreAtleta={atleta.nombre} esCoach nombre={archivo.tipo === 'foto_progreso' ? 'Foto de progreso' : 'Vídeo de técnica'}
        alCerrar={() => setArchivo(null)} alCambiar={() => res.recargar(true)}
        alBorrar={async () => { try { await api.borrarArchivo(archivo); aviso(archivo.tipo === 'foto_progreso' ? 'Foto borrada' : 'Vídeo borrado'); setArchivo(null); res.recargar(true); } catch (err) { aviso(err?.message || 'No se ha podido borrar', 'error'); } }} />}
    </div>
  );
}

// (v0.206) Una flecha si sube o baja (con su texto para el lector de pantalla)
function Flecha({ a, b, margen = 0 }) {
  if (a == null || b == null || Math.abs(a - b) <= margen) return null;
  return <span class={`act-flecha ${a > b ? 'sube' : 'baja'}`}><Icono n={a > b ? 'arriba' : 'abajo'} /><span class="sr">{a > b ? ', sube' : ', baja'}</span></span>;
}

// (v0.206) La semana entera, al desplegar su banda: sesiones de las previstas, récords, comidas, peso y su check-in; y su
// resumen, listo para pegar en la revisión o en un mensaje
function DetalleSemana({ d, nombre }) {
  const { aviso } = useApp();
  return (
    <div class="actividad-semana-detalle pila-s">
      <dl class="act-semana-cifras">
        <div><dt>Sesiones</dt><dd class="num">{d.sesiones}{d.previstas != null ? ` de ${d.previstas}` : ''}</dd></div>
        <div><dt>Récords</dt><dd class="num">{d.records}</dd></div>
        <div><dt>Comida apuntada</dt><dd class="num">{d.comidas} {d.comidas === 1 ? 'día' : 'días'}</dd></div>
        <div><dt>Peso</dt><dd class="num">{d.peso ? `${num(d.peso.kg)} kg` : '—'}{d.peso?.cambio != null ? <span class="mini terciario"> ({d.peso.cambio > 0 ? '+' : d.peso.cambio < 0 ? '−' : '±'}{num(Math.abs(d.peso.cambio))} de tendencia)</span> : null}</dd></div>
      </dl>
      <p class="peq"><b>Check-in:</b> {d.checkin || 'sin enviar'}</p>
      {d.noHizo.length > 0 && <p class="peq aviso-t">Sin hacer: {d.noHizo.join(', ')}</p>}
      <button type="button" class="btn btn-peq" onClick={async () => { const ok = await copiar(textoResumenSemana(d, nombre)); aviso(ok ? 'Resumen copiado: pégalo donde quieras' : 'No se ha podido copiar', ok ? 'ok' : 'error'); }}><Icono n="copiar" /> Copiar el resumen</button>
    </div>
  );
}

// (v0.206) El calendario del mes: cada día con sus marcas; tocar un día lo enseña debajo
function CalendarioActividad({ semanas, mes, hoy, diaSel, alElegir, alMes }) {
  const [y, m] = mes.split('-').map(Number);
  const nombreMes = `${MESES_LARGOS[m - 1]} de ${y}`;
  return (
    <section class="panel panel-pad actividad-cal pila-s" aria-label={`Su actividad en ${nombreMes}`}>
      <div class="separa">
        <button type="button" class="btn-icono plano" onClick={() => alMes(-1)} aria-label="Mes anterior"><Icono n="atras" /></button>
        <strong class="act-cal-mes">{nombreMes.charAt(0).toUpperCase()}{nombreMes.slice(1)}</strong>
        <button type="button" class="btn-icono plano" disabled={mes >= hoy.slice(0, 7)} onClick={() => alMes(1)} aria-label="Mes siguiente"><Icono n="derecha" /></button>
      </div>
      <div class="act-cal-rejilla" role="group" aria-label="Los días del mes">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <span key={d} class="act-cal-dsem" aria-hidden="true">{d}</span>)}
        {semanas.flat().map((d) => {
          if (d.fuera) return <span key={d.fecha} class="act-cal-fuera" aria-hidden="true" />;
          const tipos = [...new Set(d.tipos.map(tipoCal))];
          const marcas = TIPOS_CAL.filter(([k]) => tipos.includes(k));
          const n = Number(d.fecha.slice(8));
          return (
            <button type="button" key={d.fecha} class={`act-cal-dia${d.fecha === hoy ? ' hoy' : ''}${tipos.includes('sesion') ? ' con-sesion' : ''}`} disabled={d.futuro} aria-pressed={diaSel === d.fecha ? 'true' : 'false'} onClick={() => alElegir(d.fecha)}
              aria-label={`${dia(d.fecha, hoy)}${marcas.length ? `: ${marcas.map(([, t]) => t).join(', ')}` : ', nada'}`}>
              <span class="act-cal-n num" aria-hidden="true">{n}</span>
              <span class="act-cal-marcas" aria-hidden="true">{marcas.map(([k]) => <i key={k} class={`m-${k}`} />)}</span>
            </button>
          );
        })}
      </div>
      <p class="act-cal-leyenda mini secundario" aria-hidden="true">{TIPOS_CAL.map(([k, t]) => <span key={k}><i class={`m-${k}`} />{t}</span>)}</p>
    </section>
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
