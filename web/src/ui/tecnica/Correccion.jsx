// La corrección de un vídeo de técnica (v0.57, migración 035). El coach: la nota de técnica (1 a 5), los puntos clave
// del ejercicio (✓ bien, ✗ a corregir, – no se ve; cada uno con su momento si quiere), el tempo de cada repetición
// (marcando la bajada, abajo y el final de la subida mientras avanza fotograma a fotograma), su voz sobre el vídeo (hasta
// un minuto, al ritmo del vídeo) y mandar el fotograma con su dibujo al chat. El atleta la ve ordenada, oye la voz al
// reproducir el vídeo, puede medir su tempo (solo en su móvil) y «Grabar de nuevo con la corrección».
import { useEffect, useMemo, useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja } from '../comunes.jsx';
import { reproductorDe, textoMomento } from '../Video.jsx';
import { ponerCorrecciones, useCorrecciones } from './correcciones.js';
import { useGrabadora, ReproductorVoz } from '../chat/NotaVoz.jsx';
import { textoContador } from '../../logica/notasVoz.js';
import { AVISO_035 } from '../../datos/api.js';
import { SubirArchivo } from '../Archivos.jsx';
import {
  ESTADOS_PUNTO, NOMBRE_PUNTUACION, checklistSugerido, resumenChecklist, FASES_TEMPO, repsDeMarcas, tablaTempo, textoSegundos, marcaTempoValida, PASOS_ESTADO, limpiarPlantilla, MAX_PUNTOS,
} from '../../logica/tecnica.js';

// Enviado → Visto → Corregido
export function EstadoVideo({ estado }) {
  if (!estado) return null;
  const i = PASOS_ESTADO.findIndex(([k]) => k === estado.estado);
  return (
    <ol class="estado-video" aria-label={`Estado del vídeo: ${estado.texto}`}>
      {PASOS_ESTADO.map(([k, txt], j) => (
        <li key={k} class={j < i ? 'hecho' : j === i ? 'actual' : ''} aria-current={j === i ? 'step' : undefined}>
          <span class="estado-video-punto" aria-hidden="true">{j <= i ? <Icono n="hecho" /> : null}</span>
          <span class="mini">{j === i ? estado.texto : txt}</span>
        </li>
      ))}
    </ol>
  );
}

// La corrección de un vídeo: editable para el coach, ordenada para el atleta
export function PanelCorreccion({ video, esCoach = false, nombreAtleta = 'Atleta', alCambiar }) {
  const { api } = useApp();
  const con035 = useCarga(() => api.video035().catch(() => false), []);
  const rev = useCarga(() => api.revisionVideo(video.id).catch(() => null), [video.id]);
  useEffect(() => { if (!rev.cargando) ponerCorrecciones(video.id, 'revision', rev.datos || null); }, [rev.datos, rev.cargando, video.id]);
  if (con035.cargando && con035.datos == null) return null;
  if (!con035.datos) return esCoach ? <p class="mini terciario">La nota, los puntos clave, el tempo y la voz sobre el vídeo: {AVISO_035}.</p> : null;
  if (rev.cargando && !rev.datos) return null;
  const recargar = async () => { await rev.recargar(true); alCambiar?.(); };
  return esCoach
    ? <CorregirVideo video={video} revision={rev.datos} nombreAtleta={nombreAtleta} alGuardar={recargar} />
    : <VerCorreccion video={video} revision={rev.datos} />;
}

// ---------------------------------------------------------------- el coach
function CorregirVideo({ video, revision, nombreAtleta, alGuardar }) {
  const { api, aviso } = useApp();
  const ej = video.ejercicio || null;
  const plantilla = useCarga(() => (ej?.id ? api.plantillaTecnica(ej.id).catch(() => null) : Promise.resolve(null)), [ej?.id]);
  const base = useMemo(() => (revision?.checklist?.puntos?.length ? revision.checklist.puntos
    : (plantilla.datos || checklistSugerido(ej?.nombre || '', ej?.grupos_musculares || [], ej?.tipo || [])).map((t) => ({ t, e: null }))), [revision?.checklist, plantilla.datos, ej?.id]);
  const [puntos, setPuntos] = useState(base);
  useEffect(() => { setPuntos(base); }, [base]);
  const [nota, setNota] = useState(revision?.puntuacion ?? null);
  useEffect(() => { setNota(revision?.puntuacion ?? null); }, [revision?.puntuacion]);
  const [marcas, setMarcas] = useState(() => (revision?.tempo?.reps || []).flat());
  useEffect(() => { setMarcas((revision?.tempo?.reps || []).flat()); }, [revision?.tempo]);
  const [editarLista, setEditarLista] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const primer = (nombreAtleta || 'Atleta').split(' ')[0];
  const rep = () => reproductorDe(video.id);
  const cambiado = nota !== (revision?.puntuacion ?? null) || JSON.stringify(puntos.filter((p) => p.e)) !== JSON.stringify(revision?.checklist?.puntos || [])
    || JSON.stringify(repsDeMarcas(marcas).reps) !== JSON.stringify(revision?.tempo?.reps || []);
  async function guardar() {
    if (ocupado) return;
    setOcupado(true);
    try {
      const { reps } = repsDeMarcas(marcas);
      await api.guardarRevision(video, { puntuacion: nota, checklist: puntos.filter((p) => p.e), tempo: reps.length ? { reps } : null });
      aviso(revision?.corregido_el ? 'Corrección guardada' : `Corrección guardada: a ${primer} le llega un aviso`);
      await alGuardar?.();
    } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  }
  const ponerPunto = (i, c) => setPuntos((ps) => ps.map((p, j) => (j === i ? { ...p, ...c } : p)));
  return (
    <section class="correccion panel-pad pila-s" aria-label="Corregir el vídeo">
      <div class="correccion-cab separa"><h3>Corrección</h3>{revision?.corregido_el ? <span class="chip ok mini">Corregido</span> : null}</div>
      <div class="campo">
        <span class="etq" id={`nota-${video.id}`}>Nota de técnica</span>
        <div class="segmentos correccion-nota" role="group" aria-labelledby={`nota-${video.id}`}>
          {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" aria-pressed={nota === n ? 'true' : 'false'} aria-label={`${n} de 5: ${NOMBRE_PUNTUACION[n]}`} onClick={() => setNota(nota === n ? null : n)}>{n}</button>)}
        </div>
        <span class="ayuda">{nota ? `${nota}/5: ${NOMBRE_PUNTUACION[nota]}` : 'Sin nota (es opcional).'} {primer} ve cómo evoluciona su nota en cada ejercicio.</span>
      </div>
      <div class="campo">
        <div class="separa"><span class="etq">Puntos clave{ej ? ` de ${ej.nombre}` : ''}</span>
          {ej?.id && <button type="button" class="btn-texto mini" onClick={() => setEditarLista(true)}><Icono n="editar" /> Cambiar la lista</button>}</div>
        <ul class="lista-puntos">
          {puntos.map((p, i) => (
            <li key={`${i}-${p.t}`} class={`punto-clave ${p.e || ''}`}>
              <span class="punto-texto peq">{p.t}{Number.isFinite(p.s) ? <button type="button" class="marca-tiempo num" onClick={() => rep()?.ir(p.s)} aria-label={`Ir al ${textoMomento(p.s, true)} del vídeo`}>{textoMomento(p.s, true)}</button> : null}</span>
              <span class="punto-botones" role="group" aria-label={p.t}>
                {ESTADOS_PUNTO.map(([k, s, nombre]) => (
                  <button key={k} type="button" class={`punto-${k}`} aria-pressed={p.e === k ? 'true' : 'false'} aria-label={nombre} title={nombre} onClick={() => ponerPunto(i, { e: p.e === k ? null : k })}>{s}</button>
                ))}
                <button type="button" class="btn-icono plano punto-momento" aria-label={Number.isFinite(p.s) ? 'Quitar el momento' : 'Marcar este momento del vídeo'} title="Este momento"
                  onClick={() => ponerPunto(i, Number.isFinite(p.s) ? { s: undefined } : { s: Math.round((rep()?.ahora() || 0) * 10) / 10, e: p.e || 'mal' })}><Icono n={Number.isFinite(p.s) ? 'cerrar' : 'reloj'} /></button>
              </span>
            </li>
          ))}
        </ul>
        <span class="ayuda">Solo van los que marques. El reloj apunta el momento en que está el vídeo (sale como marca en la barra).</span>
      </div>
      <MarcarTempo video={video} marcas={marcas} setMarcas={setMarcas} />
      <div class="fila-envolver">
        <button type="button" class="btn btn-primario" disabled={ocupado || !cambiado} onClick={guardar}><Icono n="hecho" /> {ocupado ? 'Guardando…' : 'Guardar la corrección'}</button>
        <ExportarFotograma video={video} nombreAtleta={primer} />
      </div>
      <VozSobreVideo video={video} revision={revision} alGuardar={alGuardar} />
      {editarLista && ej?.id && <EditarLista ejercicio={ej} puntos={puntos.map((p) => p.t)} alCerrar={() => setEditarLista(false)} alGuardar={(ps) => { setPuntos(ps.map((t) => puntos.find((p) => p.t === t) || { t, e: null })); plantilla.recargar(true); setEditarLista(false); }} />}
    </section>
  );
}

// La lista de puntos clave de un ejercicio (la del coach): una línea por punto, hasta 15
function EditarLista({ ejercicio, puntos, alCerrar, alGuardar }) {
  const { api, aviso } = useApp();
  const [texto, setTexto] = useState(puntos.join('\n'));
  const [ocupado, setOcupado] = useState(false);
  const lista = limpiarPlantilla(texto.split('\n'));
  return (
    <Hoja titulo={`Puntos clave de ${ejercicio.nombre}`} alCerrar={alCerrar}>
      <div class="campo">
        <label for="lista-puntos">Un punto por línea (hasta {MAX_PUNTOS})</label>
        <textarea id="lista-puntos" class="area" rows={8} value={texto} onInput={(e) => setTexto(e.currentTarget.value)} />
        <span class="ayuda">{lista.length} {lista.length === 1 ? 'punto' : 'puntos'}. Se usa en los vídeos de {ejercicio.nombre} de todos tus atletas (no la ven ellos: ven lo que marques en cada vídeo).</span>
      </div>
      <div class="fila-envolver">
        <button type="button" class="btn btn-primario" disabled={ocupado || !lista.length} onClick={async () => {
          setOcupado(true);
          try { const ps = await api.guardarPlantillaTecnica(ejercicio.id, lista); aviso('Lista guardada'); alGuardar(ps); } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
        }}>Guardar la lista</button>
        <button type="button" class="btn" onClick={() => setTexto(checklistSugerido(ejercicio.nombre, ejercicio.grupos_musculares || [], ejercicio.tipo || []).join('\n'))}>Usar los sugeridos</button>
      </div>
    </Hoja>
  );
}

// El tempo: tres marcas por repetición (empieza la bajada, abajo, arriba) en el momento en que está el vídeo
export function MarcarTempo({ video, marcas, setMarcas, local = false }) {
  const rep = () => reproductorDe(video.id);
  const [aviso, setAviso] = useState('');
  const { reps, aMedias } = repsDeMarcas(marcas);
  const tabla = tablaTempo({ reps });
  const fase = marcas.length % 3;
  const marcar = () => {
    const t = Math.round((rep()?.ahora() || 0) * 100) / 100;
    if (!marcaTempoValida(marcas, t, rep()?.duracion?.() || null)) { setAviso('Avanza el vídeo: cada marca va después de la anterior.'); return; }
    setAviso('');
    setMarcas([...marcas, t]);
  };
  return (
    <div class="campo tempo-marcar">
      <span class="etq">Tempo por repetición{local ? ' (solo en tu móvil)' : ''}</span>
      <div class="fila-envolver">
        <button type="button" class="btn btn-peq" onClick={marcar}><Icono n="reloj" /> {FASES_TEMPO[fase]} (rep. {reps.length + 1})</button>
        <button type="button" class="btn btn-peq plano" disabled={!marcas.length} onClick={() => setMarcas(marcas.slice(0, -1))}>Deshacer la marca</button>
        {marcas.length > 0 && <button type="button" class="btn btn-peq plano" onClick={() => setMarcas([])}>Borrar el tempo</button>}
      </div>
      <span class="ayuda" role="status">{aviso || (aMedias.length ? `Repetición ${reps.length + 1}: ${aMedias.length} de 3 marcas.` : 'Para el vídeo en cada momento con los fotogramas y marca.')}</span>
      {tabla.reps.length > 0 && <TablaTempo tabla={tabla} />}
    </div>
  );
}
export function TablaTempo({ tabla }) {
  return (
    <table class="tabla-tempo">
      <caption class="sr">Tempo de cada repetición, en segundos</caption>
      <thead><tr><th scope="col">Rep.</th><th scope="col">Bajada</th><th scope="col">Subida</th></tr></thead>
      <tbody>
        {tabla.reps.map((r) => <tr key={r.n}><th scope="row" class="num">{r.n}</th><td class="num">{textoSegundos(r.bajada)}</td><td class="num">{textoSegundos(r.subida)}</td></tr>)}
        {tabla.reps.length > 1 && <tr class="media"><th scope="row">Media</th><td class="num">{textoSegundos(tabla.media.bajada)}</td><td class="num">{textoSegundos(tabla.media.subida)}</td></tr>}
      </tbody>
    </table>
  );
}

// La voz del coach sobre el vídeo: graba desde donde está el vídeo y lo reproduce a la vez (a 1×), hasta un minuto
function VozSobreVideo({ video, revision, alGuardar }) {
  const { api, aviso } = useApp();
  const [inicio, setInicio] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const g = useGrabadora({ alError: (m) => aviso(m, 'error') });
  const rep = () => reproductorDe(video.id);
  useEffect(() => {
    if (g.estado === 'grabando') { const r = rep(); r?.velocidad?.(1); r?.reproducir(); }
    if (g.estado === 'revisar' || g.estado === 'nada') rep()?.pausar();
  }, [g.estado]);
  const empezar = () => { const r = rep(); setInicio(Math.round((r?.ahora() || 0) * 100) / 100); r?.pausar(); g.empezar({ manos: true }); };
  const guardar = async () => {
    if (ocupado || !g.grabado) return;
    setOcupado(true);
    try { await api.guardarVozVideo(video, g.grabado.blob, { inicio, seg: g.grabado.seg, onda: g.grabado.onda }); g.descartar(); aviso('Voz guardada: la oirá al reproducir el vídeo'); await alGuardar?.(); }
    catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  };
  const quitar = async () => { setOcupado(true); try { await api.quitarVozVideo(video); aviso('Voz quitada'); await alGuardar?.(); } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); } };
  const tiene = !!revision?.voz_archivo_id;
  return (
    <div class="campo voz-video">
      <span class="etq">Tu voz sobre el vídeo</span>
      {g.estado === 'grabando' || g.estado === 'pidiendo' ? (
        <div class="fila-envolver voz-video-grabando" role="group" aria-label="Grabando tu voz sobre el vídeo">
          <span class="chat-grabando-punto" aria-hidden="true" />
          <span class="num" role="timer">{g.estado === 'pidiendo' ? 'Abriendo el micro…' : textoContador(g.seg)}</span>
          <button type="button" class="btn btn-peq btn-primario" onClick={g.parar}><Icono n="parar" /> Parar</button>
          <button type="button" class="btn btn-peq plano" onClick={g.cancelar}>Cancelar</button>
        </div>
      ) : g.estado === 'revisar' && g.grabado ? (
        <div class="pila-s">
          <VozPrevia grabado={g.grabado} />
          <span class="ayuda">Empieza en el {textoMomento(inicio, true)} del vídeo.</span>
          <div class="fila-envolver">
            <button type="button" class="btn btn-peq btn-primario" disabled={ocupado} onClick={guardar}><Icono n="hecho" /> {tiene ? 'Cambiar la voz por esta' : 'Guardar la voz'}</button>
            <button type="button" class="btn btn-peq plano" onClick={g.descartar}>Descartar</button>
          </div>
        </div>
      ) : (
        <div class="fila-envolver">
          <button type="button" class="btn btn-peq" onClick={empezar}><Icono n="micro" /> {tiene ? 'Grabarla otra vez desde aquí' : 'Grabar desde aquí'}</button>
          {tiene && <button type="button" class="btn btn-peq plano" disabled={ocupado} onClick={quitar}><Icono n="basura" /> Quitar la voz</button>}
          <span class="ayuda">{tiene ? `Empieza en el ${textoMomento(Number(revision.voz_inicio) || 0, true)} (es la marca del micro).` : 'El vídeo se reproduce mientras hablas (hasta un minuto); tu atleta lo oirá a su ritmo.'}</span>
        </div>
      )}
    </div>
  );
}
function VozPrevia({ grabado }) {
  const [url, setUrl] = useState(null);
  useEffect(() => { const u = URL.createObjectURL(grabado.blob); setUrl(u); return () => URL.revokeObjectURL(u); }, [grabado]);
  return url ? <ReproductorVoz url={url} duracion={grabado.seg} onda={grabado.onda} propio compacto /> : null;
}

// El fotograma con su dibujo, como foto en el chat del atleta (o guardarlo)
function ExportarFotograma({ video, nombreAtleta }) {
  const { api, aviso } = useApp();
  const [ocupado, setOcupado] = useState(false);
  const enviar = async () => {
    setOcupado(true);
    try {
      const blob = await reproductorDe(video.id)?.fotograma();
      if (!blob) throw new Error('El vídeo aún no está listo');
      await api.enviarFotograma(video, blob, { texto: `En el ${textoMomento(reproductorDe(video.id)?.ahora() || 0, true)} de tu vídeo` });
      aviso(`Fotograma enviado al chat de ${nombreAtleta}`);
    } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  };
  const guardar = async () => {
    try {
      const blob = await reproductorDe(video.id)?.fotograma();
      if (!blob) return;
      const f = new File([blob], 'fotograma.jpg', { type: 'image/jpeg' });
      if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f] }).catch(() => {}); return; }
      const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = 'fotograma.jpg'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000);
    } catch (e) { aviso(e.message, 'error'); }
  };
  return (
    <>
      <button type="button" class="btn btn-peq" disabled={ocupado} onClick={enviar}><Icono n="imagen" /> {ocupado ? 'Enviando…' : 'Fotograma al chat'}</button>
      <button type="button" class="btn btn-peq plano" onClick={guardar}><Icono n="descargar" /> Guardar la imagen</button>
    </>
  );
}

// ---------------------------------------------------------------- el atleta
function VerCorreccion({ video, revision }) {
  const corr = useCorrecciones(video.id);
  const [tempo, setTempo] = useState(false);
  const [marcas, setMarcas] = useState([]);
  const rep = () => reproductorDe(video.id);
  const r = revision;
  const ps = r?.checklist?.puntos || [];
  const res = resumenChecklist(r?.checklist);
  const tabla = tablaTempo(r?.tempo);
  const delCoach = (corr.comentarios || []).filter((c) => c.autor === 'coach' && !c.eliminado_en);
  const corregido = !!r?.corregido_el || delCoach.length > 0;
  // Lo que se lleva a la cámara al grabar de nuevo: lo marcado para corregir (o lo que dijo tu coach)
  const puntosRepetir = ps.filter((p) => p.e === 'mal').map((p) => p.t);
  const paraRepetir = puntosRepetir.length ? puntosRepetir : delCoach.slice(-2).map((c) => (c.texto.length > 120 ? `${c.texto.slice(0, 117)}…` : c.texto));
  return (
    <section class="correccion panel-pad pila-s" aria-label="La corrección de tu coach">
      {r?.corregido_el && (
        <>
          <h3>La corrección de tu coach</h3>
          {r.puntuacion != null && <p class="correccion-nota-ver"><span class="num nota-grande">{r.puntuacion}<span class="terciario">/5</span></span> <span class="peq">Técnica: {NOMBRE_PUNTUACION[r.puntuacion].toLowerCase()}</span></p>}
          {ps.length > 0 && (
            <>
              <p class="mini secundario">{res.bien} bien{res.mal ? `, ${res.mal} a corregir` : ''}{res.na ? `, ${res.na} no se ven` : ''}</p>
              <ul class="lista-puntos ver">
                {ps.map((p, i) => (
                  <li key={i} class={`punto-clave ${p.e}`}>
                    <span class={`punto-icono punto-${p.e}`} aria-hidden="true">{ESTADOS_PUNTO.find(([k]) => k === p.e)?.[1]}</span>
                    <span class="peq"><span class="sr">{ESTADOS_PUNTO.find(([k]) => k === p.e)?.[2]}: </span>{p.t}</span>
                    {Number.isFinite(p.s) && <button type="button" class="marca-tiempo num" onClick={() => rep()?.ir(p.s)} aria-label={`Ir al ${textoMomento(p.s, true)} del vídeo`}>{textoMomento(p.s, true)}</button>}
                  </li>
                ))}
              </ul>
            </>
          )}
          {tabla.reps.length > 0 && (<><span class="etq">Tu tempo</span><TablaTempo tabla={tabla} /></>)}
          {r.voz_archivo_id && <p class="mini secundario"><Icono n="micro" /> Tu coach te habla sobre el vídeo: dale a ▶ y lo oirás a su ritmo (si lo pausas, se pausa).</p>}
        </>
      )}
      <div class="fila-envolver">
        {corregido && <RepetirVideo video={video} puntos={paraRepetir} />}
        <button type="button" class="btn btn-peq plano" aria-expanded={tempo ? 'true' : 'false'} onClick={() => setTempo(!tempo)}><Icono n="reloj" /> Medir tu tempo</button>
      </div>
      {tempo && <MarcarTempo video={video} marcas={marcas} setMarcas={setMarcas} local />}
    </section>
  );
}

// «Grabar de nuevo con la corrección»: la cámara guiada con lo corregido a la vista; se envía como repetición del original
function RepetirVideo({ video, puntos }) {
  const { atleta } = useApp();
  if (!atleta || atleta.id !== video.atleta_id) return null;
  const ej = video.ejercicio || null;
  return (
    <SubirArchivo atletaId={atleta.id} ejercicioId={ej?.id || video.ejercicio_id || null} ejercicio={ej} titulo={`Repetir: ${ej?.nombre || 'vídeo de técnica'}`}
      etiqueta="Grabar de nuevo con la corrección" clase="btn btn-peq btn-primario" repiteDe={video.id} puntos={puntos} directoACamara
      alSubir={() => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('fbe-video-repetido')); }} />
  );
}
