// «Revisar la sesión» (v0.61, 5): los vídeos de técnica que un atleta ha mandado de una misma sesión, uno detrás de otro en
// el orden de los ejercicios de la sesión (y de sus series), a pantalla completa como «Revisar seguidos» (v0.57): con las
// series de la sesión a la vista (la del vídeo, marcada), la corrección de siempre de cada vídeo («Corregido» y «Revisado»
// por vídeo, como hasta ahora) y su hilo. «Siguiente vídeo» y «Anterior» (o → y ←, j y k fuera del reproductor; dentro, el
// reproductor tiene las suyas: espacio o k, j y l). Al final, si quiere, un solo «Resumen de la sesión» para el atleta: va
// al hilo de esa sesión (lo ve en el chat con la sesión de contexto, en Hoy y en la propia sesión) y le avisa una vez, sin
// el texto. Un resumen por sesión.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Avatar, useAtraparFoco, Capa } from '../comunes.jsx';
import { VerArchivo } from '../Archivos.jsx';
import { Hilo } from '../Hilo.jsx';
import { PanelCorreccion } from './Correccion.jsx';
import { correccionesDe } from './correcciones.js';
import { tituloSesion, textoSeriesPauta, borradorResumen, limpiarResumen, progresoSesion, MAX_RESUMEN } from '../../logica/sesionVideos.js';
import { fmtConDia } from '../../logica/fechas.js';

export function RevisionSesion(props) { return <Capa><Pantalla {...props} /></Capa>; }

function Pantalla({ grupo, alCerrar, abrirAtleta }) {
  const { api, aviso } = useApp();
  const raiz = useRef(null);
  useAtraparFoco(raiz);
  const videos = grupo.videos;
  const atleta = videos[0]?.atleta || null;
  const nombre = atleta?.nombre || 'Atleta';
  const primero = nombre.split(' ')[0];
  const datos = useCarga(() => api.sesionParaRevisar(grupo.sesionId), [grupo.sesionId]);
  const [i, setI] = useState(0);
  const [hechos, setHechos] = useState(() => new Set());
  const [texto, setTexto] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(null);
  const fin = i >= videos.length;
  const actual = videos[i] || null;
  const fecha = datos.datos?.sesion?.fecha_realizada || videos[0]?.sesionVideo?.fecha || videos[0]?.fecha || null;
  const titulo = tituloSesion(fecha, videos.length);
  const ya = enviado || datos.datos?.resumen || null;
  const cerrarRef = useRef(alCerrar); cerrarRef.current = alCerrar;
  const borrador = () => borradorResumen(videos.map((v) => ({ ...v, revision: correccionesDe(v.id).revision || v.revision || null })), { nombre });
  // (el borrador, en el mismo paso que el resumen: así el cuadro nunca se ve vacío un momento)
  const ir = (n) => { const k = Math.max(0, Math.min(videos.length, n)); if (k >= videos.length && texto == null) setTexto(borrador()); setI(k); };
  const nav = useRef({}); nav.current = { siguiente: () => ir(i + 1), anterior: () => ir(i - 1) };

  // El teclado (como «Revisar seguidos»): → / j siguiente, ← / k anterior; no mientras se escribe ni dentro del
  // reproductor (que usa las suyas); Escape cierra
  useEffect(() => {
    const previo = document.activeElement;
    const tecla = (e) => {
      const modales = document.querySelectorAll('[aria-modal="true"]');
      if (modales.length && modales[modales.length - 1] !== raiz.current) return;
      if (e.key === 'Escape') { e.preventDefault(); cerrarRef.current?.(); return; }
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select, [contenteditable="true"], .reproductor, [role="slider"]')) return;
      if (e.key === 'ArrowRight' || e.key === 'j') { e.preventDefault(); nav.current.siguiente(); }
      else if (e.key === 'ArrowLeft' || e.key === 'k') { e.preventDefault(); nav.current.anterior(); }
    };
    document.addEventListener('keydown', tecla);
    const cuerpo = document.body;
    cuerpo.dataset.hojas = String(Number(cuerpo.dataset.hojas || 0) + 1); cuerpo.style.overflow = 'hidden';
    raiz.current?.querySelector('.seguida-cerrar')?.focus();
    return () => {
      document.removeEventListener('keydown', tecla);
      const quedan = Math.max(0, Number(cuerpo.dataset.hojas || 1) - 1);
      if (quedan) cuerpo.dataset.hojas = String(quedan); else { delete cuerpo.dataset.hojas; cuerpo.style.overflow = ''; }
      if (previo?.isConnected) previo.focus?.();
    };
  }, []);
  useEffect(() => { raiz.current?.querySelector('.seguida-cuerpo')?.scrollTo?.({ top: 0 }); }, [i]);
  // Al llegar al final, el borrador con lo que ya ha corregido (la nota y lo que hay que corregir de cada vídeo)
  useEffect(() => {
    if (!fin || texto != null) return;
    setTexto(borrador());
  }, [fin]);

  const revisado = async () => {
    if (!actual) return;
    try { await api.marcarRevisado('archivo', actual.id); setHechos((h) => new Set(h).add(actual.id)); aviso('Vídeo revisado'); ir(i + 1); }
    catch (e) { aviso(e.message, 'error'); }
  };
  async function enviar() {
    const t = limpiarResumen(texto);
    if (!t) { aviso('Escribe el resumen (hasta 4000 letras)', 'error'); return; }
    setEnviando(true);
    try {
      const c = await api.enviarResumenSesion({ atletaId: grupo.atletaId || atleta?.id, sesionId: grupo.sesionId, texto: t });
      setEnviado(c || { texto: t });
      aviso(`Resumen enviado a ${primero}: lo verá en el chat, en esta sesión`);
    } catch (e) { aviso(e.message, 'error'); } finally { setEnviando(false); }
  }
  const prog = progresoSesion(videos, hechos);
  const pautaDe = (v) => (datos.datos?.pautas || []).find((p) => p.id === v.sesion_ejercicio_id) || null;

  return (
    <div ref={raiz} class="seguida revision-sesion" role="dialog" aria-modal="true" aria-label={`Revisar la sesión: ${titulo}`}>
      <div class="seguida-cab">
        <button type="button" class="btn btn-icono plano seguida-cerrar" aria-label="Cerrar" onClick={alCerrar}><Icono n="cerrar" /></button>
        <span class="seguida-contador num" role="status">{fin ? `${prog.hechos} de ${videos.length} revisados` : `Vídeo ${i + 1} de ${videos.length}`}</span>
        <span class="mini terciario revision-sesion-titulo">{titulo}</span>
      </div>
      <div class="seguida-cuerpo">
        {!fin && actual ? (
          <article key={actual.id} class="seguida-tarjeta pila-s" aria-label={`${nombre}: ${actual.ejercicio?.nombre || 'vídeo de técnica'}`}>
            <div class="separa">
              <button type="button" class="btn-texto nombre-atleta" onClick={() => { alCerrar(); abrirAtleta?.(atleta?.id, 'videos'); }}><Avatar nombre={nombre} foto={atleta?.foto} clase="peq" />{nombre}</button>
              <span class="mini terciario">{actual.ejercicio?.nombre || 'Vídeo'}{actual.serie?.numero ? ` · serie ${actual.serie.numero}` : ''}{hechos.has(actual.id) || actual.revisado_en ? ' · revisado' : ''}</span>
            </div>
            <SeriesSesion pautas={datos.datos?.pautas || []} actual={pautaDe(actual)} serie={actual.serie_numero} sesion={datos.datos?.sesion || null} />
            {actual.nota_atleta && <p class="cita">«{actual.nota_atleta}»</p>}
            <VerArchivo archivo={actual} />
            <PanelCorreccion video={actual} esCoach nombreAtleta={nombre} />
            <Hilo atletaId={actual.atleta_id} archivoId={actual.id} nombreAtleta={nombre} placeholder="Qué corregir, qué está bien…" ejercicio={actual.ejercicio || null}
              alCambiar={() => setHechos((h) => new Set(h).add(actual.id))} />
          </article>
        ) : (
          <section class="seguida-fin pila-s resumen-sesion" aria-labelledby="resumen-sesion-t">
            <strong id="resumen-sesion-t">Resumen de la sesión</strong>
            <p class="peq secundario">{prog.hechos === videos.length ? `Has revisado los ${videos.length} vídeos.` : `Has revisado ${prog.hechos} de ${videos.length}: los demás siguen en Revisar.`} Si quieres, mándale a {primero} un solo resumen de toda la sesión: le llega en el chat, en esta sesión, con un solo aviso (sin el texto).</p>
            {ya ? (
              <div class="pila-xs" role="status">
                <p class="peq"><Icono n="hecho" /> <b>Ya le has mandado el resumen de esta sesión.</b></p>
                <p class="cita resumen-sesion-enviado">{ya.texto}</p>
              </div>
            ) : (
              <>
                <label class="etq" for="resumen-sesion-texto">Tu resumen para {primero}</label>
                <textarea id="resumen-sesion-texto" class="area resumen-sesion-texto" maxLength={MAX_RESUMEN} value={texto || ''} onInput={(e) => setTexto(e.currentTarget.value)} disabled={enviando} />
                <span class="mini terciario">Sale con lo que ya has corregido en cada vídeo: cámbialo a tu gusto.</span>
              </>
            )}
            <div class="fila-envolver">
              {!ya && <button type="button" class="btn btn-primario" disabled={enviando || !limpiarResumen(texto)} onClick={enviar}><Icono n="enviar" /> {enviando ? 'Enviando…' : 'Enviar el resumen'}</button>}
              <button type="button" class={`btn ${ya ? 'btn-primario' : ''}`} onClick={alCerrar}>{ya ? 'Volver a Revisar' : 'Terminar sin resumen'}</button>
            </div>
          </section>
        )}
      </div>
      <div class="seguida-pie">
        <button type="button" class="btn" disabled={i === 0} onClick={() => ir(i - 1)} aria-label="Vídeo anterior"><Icono n="atras" /><span class="texto-ancho"> Anterior</span></button>
        {!fin && actual && <button type="button" class="btn btn-primario" disabled={hechos.has(actual.id) || !!actual.revisado_en} onClick={revisado}><Icono n="hecho" /> Revisado y siguiente</button>}
        <button type="button" class="btn" disabled={fin} onClick={() => ir(i + 1)}>{i === videos.length - 1 ? 'Al resumen' : 'Siguiente vídeo'} <Icono n="derecha" /></button>
      </div>
      <p class="mini terciario seguida-atajos solo-ancho">Con el teclado: <kbd>←</kbd> <kbd>→</kbd> (o <kbd>k</kbd> <kbd>j</kbd>) para cambiar de vídeo; dentro del vídeo, <kbd>k</kbd> o espacio para reproducir, <kbd>j</kbd> <kbd>l</kbd> un segundo atrás o adelante; <kbd>Esc</kbd> para salir.</p>
    </div>
  );
}

// Las series de la sesión (lo que hizo en cada ejercicio), con el del vídeo abierto y su serie marcados
function SeriesSesion({ pautas, actual, serie, sesion }) {
  const [abierto, setAbierto] = useState(false);
  if (!pautas.length) return null;
  const delVideo = actual ? textoSeriesPauta(actual.hechas, serie) : [];
  return (
    <div class="sesion-series panel panel-pad pila-xs">
      <div class="separa">
        <span class="etq">{sesion?.nombre || 'La sesión'}{sesion?.fecha_realizada ? ` · ${fmtConDia(sesion.fecha_realizada)}` : ''}</span>
        <button type="button" class="btn-texto mini" aria-expanded={abierto ? 'true' : 'false'} onClick={() => setAbierto(!abierto)}>{abierto ? 'Solo este ejercicio' : 'Toda la sesión'}</button>
      </div>
      {!abierto ? (
        actual ? (
          <p class="peq"><b>{actual.ejercicio?.nombre || 'Ejercicio'}:</b>{' '}
            {delVideo.length ? delVideo.map((s, k) => <span key={s.numero} class={`num ${s.delVideo ? 'serie-del-video' : ''}`}>{k ? ', ' : ''}{s.texto}{s.delVideo ? ' (la del vídeo)' : ''}</span>) : <span class="terciario">sin series apuntadas</span>}
          </p>
        ) : <p class="peq terciario">Este vídeo no va con un ejercicio de la sesión.</p>
      ) : (
        <ol class="sesion-series-lista">
          {pautas.map((p) => {
            const ss = textoSeriesPauta(p.hechas, p.id === actual?.id ? serie : null);
            return (
              <li key={p.id} class={p.id === actual?.id ? 'actual' : ''} aria-current={p.id === actual?.id ? 'true' : undefined}>
                <b>{p.ejercicio?.nombre || 'Ejercicio'}</b>{' '}
                <span class="mini secundario num">{ss.length ? ss.map((s) => s.texto).join(' · ') : 'sin series apuntadas'}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
