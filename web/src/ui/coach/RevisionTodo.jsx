import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja, useUnaVez } from '../comunes.jsx';
import { Chat } from '../Chat.jsx';
import { Hilo } from '../Hilo.jsx';
import { VerArchivo, CompararVideos } from '../Archivos.jsx';
import { PanelCorreccion } from '../tecnica/Correccion.jsx';
import { ReproductorVoz, useGrabadora, PanelGrabando, PanelRevisar, AyudaMicro, ActivarMicro } from '../chat/NotaVoz.jsx';
import { HojaNuevaTarea } from '../Tareas.jsx';
import { EditorBloque } from './Editor.jsx';
import { fmtConDia } from '../../logica/fechas.js';
import { resumenRevision } from '../../logica/revision.js';

// v0.193: pasar la revisión entera desde aquí. El chat de verdad, la corrección de los vídeos y el editor de su programa,
// dentro de la revisión semanal (son las mismas piezas de la ficha y de «Revisar», no copias).

// Lo que espera en «Revisar», pedido una vez y recordado un minuto (de ahí salen sus vídeos, ya con ejercicio y serie)
let bandejaRecordada = null;
export function pedirBandeja(api) {
  if (bandejaRecordada && Date.now() - bandejaRecordada.t < 60000) return bandejaRecordada.p;
  const p = api.bandeja();
  bandejaRecordada = { t: Date.now(), p };
  p.catch(() => { if (bandejaRecordada?.p === p) bandejaRecordada = null; });
  return p;
}
export const olvidarBandeja = () => { bandejaRecordada = null; };

// ---------------------------------------------------------------- el chat entero (a toda la pantalla de la revisión)
// Es el chat de la ficha tal cual: usa el desplazamiento de la página y su barra de abajo, así que va solo, no al lado de otra cosa
export function ChatRevision({ f, perfilId = null, insertar = null, alCambiar = null }) {
  return (
    <section class="seccion chat-en-ficha rev-chat" aria-label={`Chat con ${f.nombre}`}>
      <Chat key={f.atleta_id} atletaId={f.atleta_id} nombreAtleta={f.nombre} fotoOtro={f.foto} perfilOtro={perfilId} insertar={insertar} alCambiar={alCambiar} />
    </section>
  );
}

// El chat rápido, al lado de su semana: lo último que os habéis dicho (con sus notas de voz), y responder por escrito o de voz
export function ChatRapido({ f, insertar = null, n = 6, alChat = null, alEnviado = null }) {
  const { api, aviso } = useApp();
  const [version, setVersion] = useState(0);
  const d = useCarga(() => api.ultimosMensajes(f.atleta_id, n).catch(() => []), [f.atleta_id, version]);
  const ms = d.datos || [];
  const [texto, setTexto] = useState('');
  const [ocupado, una] = useUnaVez();
  const [hoja, setHoja] = useState(null);
  useEffect(() => { setTexto(''); }, [f.atleta_id]);
  useEffect(() => { if (insertar?.texto) setTexto((t) => (t ? `${t.trimEnd()} ${insertar.texto}` : insertar.texto)); }, [insertar?.n]);
  const primer = f.nombre.split(' ')[0];
  const leer = async () => { const ids = ms.filter((m) => m.sinLeer).map((m) => m.id); if (ids.length) await api.marcarLeidos(ids).catch(() => {}); };
  const hecho = async (que) => { await leer(); aviso(que, 'ok'); setVersion((v) => v + 1); alEnviado?.(); };
  const enviar = () => una(async () => {
    const t = texto.trim();
    if (!t) return;
    try { await api.enviarMensaje(f.atleta_id, { texto: t, autor: 'coach', clienteId: globalThis.crypto?.randomUUID?.() || `rev-chat-${Date.now()}` }); setTexto(''); await hecho(`Enviado a ${primer}`); }
    catch (e) { aviso(e?.message || 'No se ha podido enviar', 'error'); }
  });
  const [limite, setLimite] = useState(60);
  useEffect(() => { let vivo = true; api.vozLimite?.().then((x) => { if (vivo && x) setLimite(x); }).catch(() => {}); return () => { vivo = false; }; }, []);
  const [enviandoVoz, setEnviandoVoz] = useState(false);
  const vozRef = useRef(null);
  const g = useGrabadora({ alError: (m) => aviso(m, 'error'), alAviso: (m) => aviso(m), alAyuda: () => setHoja('micro'), alActivar: () => setHoja('activar'), alEnviar: (x) => vozRef.current?.(x), limite, clave: null });
  vozRef.current = async (x) => {
    if (enviandoVoz) return;
    setEnviandoVoz(true);
    try {
      await api.enviarMensaje(f.atleta_id, { archivo: new File([x.blob], `nota-de-voz.${x.ext}`, { type: x.tipo }), autor: 'coach', duracion_seg: x.seg, onda: x.onda, clienteId: globalThis.crypto?.randomUUID?.() || `rev-voz-${Date.now()}` });
      g.descartar();
      await hecho(`Nota de voz enviada a ${primer}`);
    } catch (e) { aviso(e?.message || 'No se ha podido enviar la nota de voz', 'error'); } finally { setEnviandoVoz(false); }
  };
  const grabando = g.estado === 'pidiendo' || g.estado === 'grabando' || g.estado === 'pausada';
  const sinLeer = ms.filter((m) => m.sinLeer).length;
  return (
    <section class="rev-bloque rev-chat-rapido" aria-label={`Chat con ${f.nombre}`}>
      <div class="fila-entre"><h2>Chat con {primer}</h2>{alChat && <button type="button" class="btn-texto mini" onClick={alChat}>Abrir el chat completo</button>}</div>
      {d.cargando && !d.datos ? <p class="peq secundario" role="status">Cargando...</p> : !ms.length ? <p class="peq secundario">Aún no os habéis escrito.</p> : (
        <ul class="rev-ultimos">{ms.map((m) => (
          <li key={m.id} class={`${m.autor === 'coach' ? 'mio' : 'suyo'} ${m.sinLeer ? 'nuevo' : ''}`}>
            <span class="peq secundario">{m.autor === 'coach' ? 'Tú' : primer} · {fmtConDia(String(m.creado_en).slice(0, 10))}{m.sinLeer ? ' · sin leer' : ''}</span>
            {m.audio ? <ReproductorVoz pedirUrl={() => api.urlArchivo(m.audio.ruta, { tipo: 'audio' })} duracion={m.audio.duracion_seg} onda={m.audio.onda} mime={m.audio.mime} clave={m.audio.id} propio={m.autor === 'coach'} titulo="Nota de voz"
              alReproducir={() => { if (m.autor !== 'coach') api.marcarEscuchado?.(m.id).catch(() => {}); }} /> : <span>{m.texto || 'Un archivo (ábrelo en el chat completo)'}{m.adjunto && m.texto ? ' (con archivo)' : ''}</span>}
          </li>
        ))}</ul>
      )}
      {g.estado === 'revisar' ? <div class="rev-voz"><PanelRevisar g={g} alEnviar={(x) => vozRef.current(x)} enviando={enviandoVoz} /></div>
        : grabando ? <div class="rev-voz"><PanelGrabando g={g} /></div> : (
          <div class="rev-responder">
            <textarea rows="2" maxLength={2000} value={texto} onInput={(e) => setTexto(e.currentTarget.value)} aria-label={`Escribir a ${f.nombre}`} placeholder={`Escribe a ${primer}...`}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); enviar(); } }} />
            <div class="fila-envolver">
              <button type="button" class="btn btn-peq btn-primario" disabled={ocupado || !texto.trim()} onClick={enviar}><Icono n="enviar" /> Enviar</button>
              <button type="button" class="btn btn-peq" onClick={() => g.empezar({ manos: true })}><Icono n="micro" /> Nota de voz</button>
              {sinLeer > 0 && <button type="button" class="btn btn-peq" onClick={() => hecho('Marcados como leídos')}><Icono n="hecho" /> Marcar leídos</button>}
            </div>
          </div>
        )}
      {hoja === 'micro' && <AyudaMicro alCerrar={() => setHoja(null)} />}
      {hoja === 'activar' && <ActivarMicro alCerrar={() => setHoja(null)} />}
    </section>
  );
}

// Sus notas de voz sin escuchar, con su reproductor
export function AudiosSinEscuchar({ audios }) {
  const { api } = useApp();
  if (!audios?.length) return null;
  return (
    <section class="rev-bloque" aria-label="Notas de voz sin escuchar">
      <h2>{audios.length === 1 ? '1 nota de voz sin escuchar' : `${audios.length} notas de voz sin escuchar`}</h2>
      <ul class="rev-audios">{audios.map((a) => (
        <li key={a.id}><ReproductorVoz pedirUrl={() => api.urlArchivo(a.ruta, { tipo: 'audio' })} duracion={a.duracion_seg} onda={a.onda} mime={a.mime} clave={a.id} titulo="Nota de voz"
          alReproducir={() => { if (a.comentario_id) api.marcarEscuchado?.(a.comentario_id).catch(() => {}); }} /></li>
      ))}</ul>
    </section>
  );
}

// ---------------------------------------------------------------- corregir sus vídeos ahí mismo
export function VideosRevision({ f, alCambiar = null }) {
  const { api, aviso } = useApp();
  const [version, setVersion] = useState(0);
  const d = useCarga(() => pedirBandeja(api), [f.atleta_id, version]);
  const [i, setI] = useState(0);
  const [comparar, setComparar] = useState(null);
  const [repetir, setRepetir] = useState(false);
  const videos = (d.datos?.archivos || []).filter((a) => a.tipo === 'video_tecnica' && (a.atleta?.id || a.atleta_id) === f.atleta_id)
    .sort((x, y) => (String(x.fecha || '') + String(x.creado_en || '') < String(y.fecha || '') + String(y.creado_en || '') ? -1 : 1));
  useEffect(() => { if (i >= videos.length && videos.length) setI(videos.length - 1); }, [videos.length]);
  if (d.cargando && !d.datos) return <p class="peq secundario" role="status">Cargando sus vídeos...</p>;
  if (d.error) return <p class="peq">No se han podido cargar sus vídeos. <button type="button" class="btn-texto mini" onClick={() => { olvidarBandeja(); setVersion((n) => n + 1); }}>Reintentar</button></p>;
  if (!videos.length) return <p class="peq secundario">No tiene vídeos por revisar.</p>;
  const a = videos[Math.min(i, videos.length - 1)];
  const primer = f.nombre.split(' ')[0];
  const delDia = videos.filter((x) => x.fecha && x.fecha === a.fecha).length;
  const revisado = async () => {
    try {
      await api.marcarRevisado('archivo', a.id);
      aviso('Vídeo revisado', 'ok', { texto: 'Deshacer', fn: async () => { await api.marcarRevisado('archivo', a.id, false).catch(() => {}); olvidarBandeja(); setVersion((n) => n + 1); alCambiar?.(1); } });
      olvidarBandeja(); setVersion((n) => n + 1); alCambiar?.(-1);
    } catch (e) { aviso(e?.message || 'No se ha podido', 'error'); }
  };
  const verAnterior = async () => {
    try { const o = await api.videoAnterior(a); if (!o) { aviso(`No hay un vídeo anterior de ${a.ejercicio?.nombre || 'ese ejercicio'}`); return; } setComparar([o, a]); } catch (e) { aviso(e?.message || 'No se ha podido', 'error'); }
  };
  return (
    <div class="rev-video-panel pila-s">
      <div class="fila-envolver rev-video-cab">
        <strong>{a.ejercicio?.nombre || 'Vídeo de técnica'}</strong>
        <span class="peq secundario">{a.fecha ? fmtConDia(a.fecha) : ''}{delDia > 1 ? ` · ${delDia} vídeos de ese día` : ''}</span>
        {videos.length > 1 && (
          <span class="rev-video-nav">
            <button type="button" class="btn btn-peq" disabled={i === 0} onClick={() => setI((n) => Math.max(0, n - 1))}><span aria-hidden="true">‹</span> Anterior</button>
            <span class="num peq" aria-live="polite">Vídeo {Math.min(i, videos.length - 1) + 1} de {videos.length}</span>
            <button type="button" class="btn btn-peq" disabled={i >= videos.length - 1} onClick={() => setI((n) => Math.min(videos.length - 1, n + 1))}>Siguiente vídeo <span aria-hidden="true">›</span></button>
          </span>
        )}
      </div>
      {(a.serie || a.nota_atleta) && (
        <div class="fila-envolver">
          {a.serie && <span class="chip num">Serie {a.serie.numero}{a.serie.texto ? `: ${a.serie.texto}` : ''}</span>}
          {a.nota_atleta && <span class="cita">«{a.nota_atleta}»</span>}
        </div>
      )}
      <VerArchivo key={a.id} archivo={a} />
      <PanelCorreccion key={`c-${a.id}`} video={a} esCoach nombreAtleta={f.nombre} />
      <Hilo key={`h-${a.id}`} atletaId={f.atleta_id} archivoId={a.id} nombreAtleta={f.nombre} placeholder={`Qué le dices a ${primer} de este vídeo...`} />
      <div class="fila-envolver">
        <button type="button" class="btn btn-peq btn-primario" onClick={revisado}><Icono n="hecho" /> Vídeo revisado</button>
        {a.ejercicio_id && <button type="button" class="btn btn-peq" onClick={verAnterior}><Icono n="duplicar" /> Comparar con el anterior</button>}
        <button type="button" class="btn btn-peq" onClick={() => setRepetir(true)}><Icono n="video" /> Pedir que lo repita</button>
      </div>
      {comparar && <CompararVideos videos={comparar} nombreDe={(v) => (v.id === a.id ? 'El nuevo' : 'El anterior')} inicialA={a.id} inicialB={comparar[0].id} alCerrar={() => setComparar(null)} />}
      {repetir && <HojaNuevaTarea atleta={{ id: f.atleta_id, nombre: f.nombre }} inicial={{ tipo: 'video', ejercicio_id: a.ejercicio_id || '', titulo: `Repite el vídeo${a.ejercicio?.nombre ? ` de ${a.ejercicio.nombre.toLowerCase()}` : ''}` }} alCerrar={() => setRepetir(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------- el editor de su programa, sin salir
// modo: null | 'fbe' (lanza «Programar según FBE» al abrir); ejercicio: el que se quiere retocar (se va a su fila)
export function ProgramarRevision({ f, atleta = null, modo = null, ejercicio = null, abrirAtleta, alCambiar = null }) {
  const { api } = useApp();
  const datos = useCarga(() => (atleta ? Promise.resolve(atleta) : api.atletas().then((xs) => xs.find((x) => x.id === f.atleta_id) || null).catch(() => null)), [f.atleta_id]);
  const a = atleta || datos.datos;
  useEffect(() => () => { alCambiar?.(); }, []);
  if (f.servicio === 'nutricion') return <p class="peq secundario">Solo lleva nutrición: no tiene programa de entrenamiento.</p>;
  if (!f.bloque?.id) return <p class="peq">Aún no tiene un bloque. <button type="button" class="btn-texto mini" onClick={() => abrirAtleta(f.atleta_id, 'programa', null)}>Crearlo en su ficha</button></p>;
  return (
    <div class="rev-editor">
      <EditorBloque key={`${f.bloque.id}-${modo || ''}-${ejercicio || ''}`} bloqueId={f.bloque.id} volumenObjetivo={a?.volumen_objetivo ?? null} nivel={a?.nivel || null}
        carreraDe={a?.carrera && a?.entrenamiento !== false ? f.atleta_id : null} alEntrar={modo} ejercicioFoco={ejercicio} alBorrar={() => abrirAtleta(f.atleta_id, 'programa', null)} />
    </div>
  );
}
// La ventana al editor desde una tarjeta de la lista
export function HojaProgramar({ f, modo = null, ejercicio = null, abrirAtleta, alCerrar, lado = null }) {
  return (
    <Hoja titulo={`Programa de ${f.nombre.split(' ')[0]}`} alCerrar={alCerrar} ancho={1500} clase="rev-hoja-editor">
      <div class={`rev-editor-env ${lado ? 'con-lado' : ''}`}>
        {lado && <aside class="rev-editor-lado" aria-label="Su semana">{lado}</aside>}
        <ProgramarRevision f={f} modo={modo} ejercicio={ejercicio} abrirAtleta={abrirAtleta} />
      </div>
    </Hoja>
  );
}

// ---------------------------------------------------------------- el cierre de la revisión
export function CierreRevision({ filas, alSeguir, abrirAtleta }) {
  const r = resumenRevision(filas);
  const pendientes = filas.filter((x) => !x.hecha);
  return (
    <div class="panel panel-pad pila rev-cierre" role="status">
      <h2>{pendientes.length ? 'Revisión, por ahora' : 'Revisión terminada'}</h2>
      <ul class="rev-cierre-cifras">
        <li><strong class="num">{r.revisados} de {r.total}</strong><span class="peq secundario">revisados</span></li>
        <li><strong class="num">{r.conRepaso}</strong><span class="peq secundario">con mensaje tuyo esta semana</span></li>
        <li><strong class="num">{r.porProgramar.length}</strong><span class="peq secundario">sin la semana que viene</span></li>
      </ul>
      {r.porProgramar.length > 0 && (
        <div class="pila-xs"><span class="peq secundario">Falta programar a:</span>
          <div class="fila-envolver">{filas.filter((x) => x.proxima === 'sin' || x.proxima === 'borrador').map((x) => <button key={x.atleta_id} type="button" class="btn btn-peq" onClick={() => abrirAtleta(x.atleta_id, 'programa', null)}>{x.nombre.split(' ')[0]}</button>)}</div>
        </div>
      )}
      {r.esperando.length > 0 && <p class="peq">Esperando respuesta de: {r.esperando.join(', ')}.</p>}
      {r.sinCheckin.length > 0 && <p class="peq">Sin check-in: {r.sinCheckin.join(', ')}.</p>}
      <button type="button" class="btn btn-primario" onClick={alSeguir}>{pendientes.length ? 'Volver a la lista' : 'Hecho'}</button>
    </div>
  );
}
