import { useEffect, useRef, useState } from 'preact/hooks';
import { Reproductor, reproductorDe } from './Video.jsx';
import { useApp, Icono, Hoja, Cargando, useCarga } from './comunes.jsx';
import { fmtCorta } from '../logica/fechas.js';
import { LIMITE_ARCHIVO_MB } from '../datos/api.js';
import { sePuedeRecortar, recortarVideo, prepararVideo, megasEstimados, buscarMovimiento } from './recorte.js';
import { recorteUtil, MIN_SEG_RECORTE } from '../logica/movimiento.js';
import { AutoevaluacionEnvio } from './tecnica/Autoevaluacion.jsx';
import { rpeAutoValido } from '../logica/correccion.js';
const rpeDeSerie = (x) => (x != null && rpeAutoValido(Number(x)) ? Number(x) : null);
import { marcasRepeticiones } from '../logica/repeticiones.js';
import { guardarPendiente, quitarPendiente, conCerrojo, ponerSubida, avisarPendientes } from '../datos/pendientes.js';
import { CamaraVideo, puedeGrabarVideo } from './tecnica/CamaraVideo.jsx';
import { encuadreDe, tiempoOtro } from '../logica/tecnica.js';
import { hoyISO } from '../logica/fechas.js';
import { velocidadInicial, esLenta } from '../logica/angulos.js';
import { DifuminarCara, puedeDifuminar } from './tecnica/Difuminar.jsx';
import { ajuste } from './ajustes.js';

// Botón que abre la cámara o la galería y envía el vídeo (o la foto) a la carpeta privada del atleta.
// Vídeos (v0.30): antes de enviarlo se elige dónde empieza y acaba la serie, y el móvil lo recorta y lo aligera
// (720p, sin sonido) si el navegador sabe hacerlo; si no, se envía como está.
const MB = 1048576;
const ALIGERAR_DESDE_MB = 12; // por debajo, si no se recorta, se envía tal cual
const LIMITE_ELEGIR_MB = 2048; // un vídeo largo se puede elegir si luego se va a recortar en el móvil

// inicial (v0.48): un archivo que ya viene elegido (el que llega con «Compartir → FBE Equipo»): se abre directamente la
// hoja (con su recorte) y, si se cierra sin enviarlo, alCancelar
// v0.57: con la cámara guiada («Grabar con guía»: encuadre, nivel, cuenta atrás y parar sola) o de la galería; con su
// serie (series: [{ numero, texto }], de la sesión) y, al grabar de nuevo un vídeo corregido, el original (repiteDe) y sus
// puntos a la vista en la cámara (puntos). abrirCamara: empieza en la cámara.
// v0.60: anguloDe, el vídeo del que este es el otro ángulo (038; «Añadir otro ángulo» también al terminar de enviar uno);
// el ritmo de la cámara lenta (fps_captura) si se grabó así; y «Difuminar la cara» (se envía solo el difuminado).
export function SubirArchivo({ atletaId, tipo = 'video_tecnica', sesionEjercicioId = null, ejercicioId = null, titulo, etiqueta, clase = 'btn-texto', alSubir, inicial = null, alCancelar = null, alGuardarEnMovil = null,
  ejercicio = null, series = null, serieInicial = null, repiteDe = null, puntos = [], abrirCamara = false, directoACamara = false, anguloDe = null }) {
  const { api, aviso, modo } = useApp();
  const [elegir, setElegir] = useState(false);
  const [camara, setCamara] = useState(false);
  const [serie, setSerie] = useState(serieInicial);
  const senal = useRef(null);
  const con035 = useCarga(() => (series?.length || repiteDe ? api.video035().catch(() => false) : Promise.resolve(false)), [!!series?.length, !!repiteDe]);
  const input = useRef(null);
  const [archivo, setArchivo] = useState(null);
  const [vista, setVista] = useState(null);
  const [nota, setNota] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [preparando, setPreparando] = useState(null); // progreso 0…1 mientras se recorta
  const [fallo, setFallo] = useState(null); // el recorte ha fallado: se ofrece enviarlo entero
  const [corte, setCorte] = useState(null); // { dur, inicio, fin }
  const [subida, setSubida] = useState(null); // progreso de la subida (0…1)
  const [enPausa, setEnPausa] = useState(false); // el recorte está en pausa (se salió de la app) y no siguió solo
  const [auto, setAuto] = useState(null); // (v0.59) la valoración del atleta, ya limpia (o null)
  // (v0.60) el otro ángulo (el de la prop, o el que se acaba de enviar), el ritmo de la cámara lenta y el difuminado
  const [anguloSig, setAnguloSig] = useState(null); // { id, serie } del que se acaba de enviar: «¿Otro ángulo?»
  const subidoAntes = useRef(null); // (lo enviado mientras se pregunta por el otro ángulo: alSubir, al terminar)
  const [anguloDeAhora, setAnguloDeAhora] = useState(anguloDe);
  const [otroAngulo, setOtroAngulo] = useState(false);
  const [fps, setFps] = useState(null);
  // (revisión M3) encendido de serie solo donde se puede difuminar: si no, ningún vídeo se podría enviar
  const [difuminar, setDifuminar] = useState(() => tipo === 'video_tecnica' && ajuste('difuminarCara') === true && puedeDifuminar(modo === 'demo'));
  const [difuminado, setDifuminado] = useState(null); // { archivo, dur }
  const con038 = useCarga(() => (tipo === 'video_tecnica' ? api.video038().catch(() => null) : Promise.resolve(false)), []);
  const contenedor = useRef(null);
  const cancelar = useRef(null);
  const controlRecorte = useRef(null);
  const esVideo = tipo === 'video_tecnica';
  const recortable = esVideo && sePuedeRecortar();
  const guiada = esVideo && !inicial && puedeGrabarVideo();
  const enc = esVideo ? encuadreDe(ejercicio?.nombre || '', ejercicio?.grupos_musculares || [], ejercicio?.tipo || []) : null;
  useEffect(() => { if (abrirCamara && guiada) setCamara(true); }, []);
  const abrir = () => { if (guiada && directoACamara) setCamara(true); else if (guiada) setElegir(true); else input.current?.click(); };
  const grabado = (f, meta = null) => { setCamara(false); setArchivo(f); setFps(meta?.fps || null); setCorte(null); setFallo(null); setSinVista(false); try { setVista(URL.createObjectURL(f)); } catch { setVista(null); } };

  useEffect(() => () => { if (vista) URL.revokeObjectURL(vista); }, [vista]);
  useEffect(() => () => cancelar.current?.(), []); // si se va de la pantalla a medias, se para el recorte
  const [sinVista, setSinVista] = useState(false); // el navegador no sabe leer este vídeo: no se puede recortar
  useEffect(() => {
    if (!inicial) return;
    setArchivo(inicial);
    try { setVista(URL.createObjectURL(inicial)); } catch { setVista(null); }
  }, [inicial]);

  function elegido(e) {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!f) return;
    const tope = recortable ? LIMITE_ELEGIR_MB : LIMITE_ARCHIVO_MB;
    if (f.size > tope * MB) { aviso(`Pesa más de ${tope} MB. Graba solo la serie (unos 30 segundos).`, 'error'); return; }
    setArchivo(f); setFps(null); setCorte(null); setFallo(null); setSinVista(false);
    try { setVista(URL.createObjectURL(f)); } catch { setVista(null); }
  }
  const recortado = !!corte && (corte.inicio > 0.25 || corte.fin < corte.dur - 0.25);
  const aligerar = recortable && !!corte && (recortado || archivo?.size > ALIGERAR_DESDE_MB * MB);
  // Muy grande y sin poder recortarlo (aún no ha cargado, o este navegador no lo sabe leer): no se puede enviar
  const grandeSinRecorte = !!archivo && esVideo && !corte && archivo.size > LIMITE_ARCHIVO_MB * MB;

  // Se guarda primero en el móvil (v0.33) y se sube desde ahí: si el móvil cierra la app a medias o no hay cobertura,
  // no se pierde y se envía solo luego (con la misma ruta: reintentar no duplica). Si no se puede guardar, se sube igual.
  async function subir(f, duracion) {
    const opciones = { tipo, sesion_ejercicio_id: sesionEjercicioId, ejercicio_id: ejercicioId, nota_atleta: nota.trim() || null, duracion_seg: duracion, fecha: hoyISO(),
      ...(esVideo && con035.datos && serie && sesionEjercicioId ? { serie_numero: Number(serie) } : {}), ...(esVideo && con035.datos && repiteDe ? { repite_de: repiteDe } : {}),
      ...(esVideo && auto ? { autoevaluacion: auto } : {}),
      ...(esVideo && anguloDeAhora ? { angulo_de: anguloDeAhora } : {}), ...(esVideo && fps && !(difuminar && difuminado) ? { fps_captura: fps } : {}) };
    opciones.ruta = api.rutaArchivo(atletaId, f, opciones);
    const pid = esVideo ? await guardarPendiente({ atletaId, archivo: f, opciones }).catch(() => null) : null;
    let a = null, error = null;
    const r = await conCerrojo(pid || `hoja-${opciones.ruta}`, async () => {
      try {
        // La miniatura y la duración del vídeo se sacan en el móvil antes de subirlo (si no se puede, se sube igual)
        const cap = esVideo ? await capturarPoster(f).catch(() => null) : null;
        setSubida(0);
        const s = senal.current = {};
        let ultimo = 0;
        a = await api.subirArchivo(atletaId, f, { ...opciones, poster: cap?.poster || null, duracion_seg: duracion ?? cap?.duracion ?? null, senal: s,
          alUrlSubida: pid ? (url) => ponerSubida(pid, { url }).catch(() => {}) : null,
          alProgreso: (x) => { setSubida(x); if (pid && x - ultimo >= 0.05) { ultimo = x; ponerSubida(pid, { progreso: x }).catch(() => {}); } } });
      } catch (e) { error = e; }
    });
    if (r === 'ocupado') { // ya lo está enviando la cola de pendientes: avisará al terminar
      aviso('El vídeo se está enviando: te aviso al terminar');
      setArchivo(null); setNota(''); setCorte(null); setFallo(null);
      return;
    }
    senal.current = null;
    if (error?.cancelado) {
      if (pid) await quitarPendiente(pid).catch(() => {});
      await api.descartarSubida(opciones.ruta).catch(() => {});
      aviso('Envío cancelado');
      return;
    }
    if (error) {
      // Sin cobertura: ya está guardado en el móvil y se enviará solo (por donde iba)
      if (error.sinConexion && !error.cancelado && pid) {
        await ponerSubida(pid, {}).catch(() => {}); avisarPendientes();
        aviso(esVideo ? 'Sin cobertura: el vídeo queda guardado en tu móvil y se enviará solo' : 'Sin cobertura: la foto queda guardada en tu móvil y se enviará sola');
        setArchivo(null); setNota(''); setCorte(null); setFallo(null);
        alGuardarEnMovil?.();
        return;
      }
      if (pid) await quitarPendiente(pid).catch(() => {});
      throw error;
    }
    if (pid) await quitarPendiente(pid).catch(() => {});
    if (a?.autoevaluacionError) aviso(`Vídeo enviado, pero tu valoración no se ha guardado: ${a.autoevaluacionError}`, 'error');
    else if (a?.anguloPerdido) aviso('Vídeo enviado, pero ya no va como otro ángulo: el vídeo con el que iba se ha borrado o ya tiene pareja', 'error');
    else aviso(esVideo ? 'Vídeo enviado a tu coach' : 'Foto guardada');
    setArchivo(null); setNota(''); setCorte(null); setFallo(null); setDifuminado(null); setFps(null);
    // (v0.60) «Añadir otro ángulo»: el siguiente va enlazado a este, de la misma serie
    const preguntar = esVideo && otroAngulo && a?.id && !anguloDeAhora;
    setOtroAngulo(false);
    if (anguloDeAhora && !anguloDe) setAnguloDeAhora(null);
    if (preguntar) { subidoAntes.current = a; setAnguloSig({ id: a.id, serie }); } else { subidoAntes.current = null; alSubir?.(a); }
  }
  async function enviar({ entero = false } = {}) {
    if (subiendo) return;
    // (v0.60) Con «Difuminar la cara», solo el difuminado (ya recortado): el original no sale del móvil
    if (esVideo && difuminar) {
      if (!difuminado) { aviso('Prepara antes la vista previa del vídeo difuminado (o apaga «Difuminar la cara»)', 'error'); return; }
      setSubiendo(true);
      try { await subir(difuminado.archivo, Math.round(difuminado.dur)); }
      catch (err) { aviso(err.sinConexion ? 'Sin cobertura y no se ha podido guardar el vídeo en el móvil: cuando vuelva la cobertura, elígelo otra vez para enviarlo' : err.message, 'error'); }
      finally { setSubiendo(false); setSubida(null); }
      return;
    }
    // En el mismo toque (antes de esperar nada): el vídeo que se va a recortar se arranca con el gesto (iPhone)
    const preparado = aligerar && !entero ? prepararVideo(archivo) : null;
    setSubiendo(true);
    let f = archivo, duracion = null;
    try {
      if (preparado) {
        setPreparando(0); setFallo(null);
        const control = { aborted: false };
        cancelar.current = () => { control.aborted = true; };
        controlRecorte.current = control;
        // Pantalla encendida mientras se prepara (al salir de la app el móvil la suelta: se vuelve a pedir al volver)
        let bloqueo = null;
        const pedirPantalla = async () => { try { bloqueo = await navigator.wakeLock?.request('screen'); } catch { /* puede apagarse: se pausa y sigue */ } };
        const alVolver = () => { if (document.visibilityState === 'visible') pedirPantalla(); };
        document.addEventListener('visibilitychange', alVolver);
        await pedirPantalla();
        await new Promise((r) => requestAnimationFrame(() => r())); // que esté pintado el hueco donde se ve el vídeo
        try {
          const nuevo = await recortarVideo(archivo, { inicio: corte.inicio, fin: corte.fin, alProgreso: setPreparando, senal: control, contenedor: contenedor.current, preparado, alPausa: setEnPausa });
          // Si no se ha recortado y aligerado no gana nada, va el original (mejor calidad)
          if (recortado || nuevo.size < archivo.size * 0.9) { f = nuevo; duracion = corte.fin - corte.inicio; }
        } catch (err) {
          if (control.aborted) { setPreparando(null); return; }
          setFallo(err.message || 'No se ha podido recortar');
          setPreparando(null);
          return;
        } finally { document.removeEventListener('visibilitychange', alVolver); bloqueo?.release?.().catch?.(() => {}); cancelar.current = null; controlRecorte.current = null; setEnPausa(false); }
        setPreparando(null);
      }
      if (f.size > LIMITE_ARCHIVO_MB * MB) throw new Error(`Pesa más de ${LIMITE_ARCHIVO_MB} MB. Recórtalo para enviar solo la serie.`);
      await subir(f, duracion);
    } catch (err) {
      aviso(err.sinConexion ? 'Sin cobertura y no se ha podido guardar el vídeo en el móvil: cuando vuelva la cobertura, elígelo otra vez para enviarlo' : err.message, 'error');
    } finally { setSubiendo(false); setPreparando(null); setSubida(null); }
  }
  const mb = (n) => (n < 104858 ? 'menos de 0,1' : (n / MB).toLocaleString('es-ES', { maximumFractionDigits: n < 10 * MB ? 1 : 0 }));
  const cerrar = () => { if (preparando != null) { cancelar.current?.(); return; } if (!subiendo) { setArchivo(null); setFallo(null); if (inicial) alCancelar?.(); } };
  return (
    <>
      {!inicial && <button type="button" class={clase} onClick={abrir} aria-haspopup={guiada ? 'dialog' : undefined}><Icono n={esVideo ? 'camara' : 'imagen'} /> {etiqueta || (esVideo ? 'Vídeo para tu coach' : 'Añadir foto')}</button>}
      {!inicial && <input ref={input} type="file" accept={esVideo ? 'video/*' : 'image/*'} hidden onChange={elegido} aria-label={esVideo ? 'Elegir vídeo' : 'Elegir foto'} />}
      {anguloSig && (
        <Hoja titulo="¿Otro ángulo de la misma serie?" alCerrar={() => { setAnguloSig(null); const a = subidoAntes.current; subidoAntes.current = null; if (a) alSubir?.(a); }}>
          <p class="peq secundario">El mismo momento grabado desde otro sitio (por ejemplo, de frente): tu coach verá los dos a la vez.</p>
          {guiada && <button type="button" class="btn btn-primario btn-grande" onClick={() => { setAnguloDeAhora(anguloSig.id); setSerie(anguloSig.serie); setAnguloSig(null); setCamara(true); }}><Icono n="camara" /> Grabar el otro ángulo</button>}
          <button type="button" class="btn btn-grande" onClick={() => { setAnguloDeAhora(anguloSig.id); setSerie(anguloSig.serie); setAnguloSig(null); input.current?.click(); }}><Icono n="imagen" /> Elegirlo de la galería</button>
          <button type="button" class="btn btn-texto" onClick={() => { setAnguloSig(null); const a = subidoAntes.current; subidoAntes.current = null; if (a) alSubir?.(a); }}>Ahora no</button>
        </Hoja>
      )}
      {elegir && (
        <Hoja titulo={titulo || 'Vídeo de técnica'} alCerrar={() => setElegir(false)}>
          <p class="peq secundario"><b>{enc.titulo}.</b> {enc.texto}</p>
          <button type="button" class="btn btn-primario btn-grande" onClick={() => { setElegir(false); setCamara(true); }}><Icono n="camara" /> Grabar con guía</button>
          <button type="button" class="btn btn-grande" onClick={() => { setElegir(false); input.current?.click(); }}><Icono n="imagen" /> Elegir de la galería</button>
          <p class="mini terciario">Con guía: el encuadre, un nivel para poner el móvil recto, cuenta atrás y, si quieres, que pare sola. Sin sonido.</p>
        </Hoja>
      )}
      {camara && <CamaraVideo ejercicio={ejercicio} titulo={titulo || 'Vídeo de técnica'} puntos={puntos} alCerrar={() => setCamara(false)} alGrabar={grabado} />}
      {archivo && (
        <Hoja titulo={titulo || (esVideo ? 'Vídeo de técnica' : 'Foto de progreso')} alCerrar={cerrar}>
          {preparando != null ? (
            <div class="recorte-preparando" role="status">
              <div ref={contenedor} class="recorte-vista" />
              <div class="recorte-progreso" aria-hidden="true"><span style={{ width: `${Math.round(preparando * 100)}%` }} /></div>
              <p class="peq"><b>{enPausa ? 'En pausa' : `Preparando el vídeo… ${Math.round(preparando * 100)} %`}</b></p>
              {enPausa
                ? <button type="button" class="btn btn-primario" onClick={() => controlRecorte.current?.reanudar?.()}>Continuar</button>
                : <p class="mini terciario">Se queda solo con la serie y lo aligera para que suba rápido. Si sales de la app, se pausa y sigue al volver.</p>}
              <button type="button" class="btn btn-texto" onClick={() => cancelar.current?.()}>Cancelar</button>
            </div>
          ) : (
            <>
              {vista && (esVideo
                ? <div hidden={!!(difuminar && difuminado)}><VistaRecorte src={vista} recortable={recortable && !(difuminar && difuminado)} corte={corte} setCorte={setCorte} alFallar={() => setSinVista(true)} /></div>
                : <img class="medio" src={vista} alt="Vista previa de la foto" />)}
              {esVideo && puedeDifuminar(modo === 'demo') && (
                <DifuminarCara archivo={archivo} corte={corte} activo={difuminar} setActivo={setDifuminar} alListo={setDifuminado} />
              )}
              {esVideo && fps >= 50 && <p class="mini secundario"><Icono n="reloj" /> Grabado en cámara lenta ({fps} fps){con038.datos === false ? '. Abrirlo ya a cámara lenta: disponible tras la migración 038.' : ': tu coach lo abrirá a cámara lenta.'}</p>}
              {esVideo && anguloDeAhora && <p class="mini secundario"><Icono n="duplicar" /> Va como otro ángulo de la misma serie: tu coach verá los dos a la vez.</p>}
              {esVideo && !anguloDeAhora && con038.datos !== false && !repiteDe && (
                <label class="casilla">
                  <input type="checkbox" checked={otroAngulo} onChange={(e) => setOtroAngulo(e.currentTarget.checked)} />
                  <span class="peq">Añadir otro ángulo de esta serie después</span>
                </label>
              )}
              <p class="mini terciario">
                {aligerar && corte
                  ? <>Se enviarán {duracionTexto(corte.fin - corte.inicio)} de vídeo{megasEstimados(corte.fin - corte.inicio) * MB < archivo.size ? <>, unos {mb(megasEstimados(corte.fin - corte.inicio) * MB)} MB (el original pesa {mb(archivo.size)} MB)</> : null}. </>
                  : <>{archivo.name || 'Archivo'}, {mb(archivo.size)} MB. </>}
                Se guarda en tu carpeta privada: solo lo veis tú y tu coach.
              </p>
              {fallo && (
                <div class="error" role="alert">
                  {fallo}
                  {archivo.size <= LIMITE_ARCHIVO_MB * MB && <div class="aviso-variante-botones"><button type="button" class="btn btn-peq" onClick={() => enviar({ entero: true })}>Enviarlo entero, sin recortar</button></div>}
                </div>
              )}
              {esVideo && series?.length > 0 && con035.datos && (
                <div class="campo">
                  <label for="arch-serie">¿De qué serie es?</label>
                  <select id="arch-serie" class="selector" value={serie || ''} onChange={(e) => setSerie(e.currentTarget.value ? Number(e.currentTarget.value) : null)}>
                    <option value="">De ninguna en concreto</option>
                    {series.map((x) => <option key={x.numero} value={x.numero}>Serie {x.numero}{x.texto ? `: ${x.texto}` : ''}</option>)}
                  </select>
                  <span class="ayuda">Tu coach verá los kilos, las repeticiones y el esfuerzo de esa serie encima del vídeo.</span>
                </div>
              )}
              {esVideo && repiteDe && <p class="mini secundario"><Icono n="reiniciar" /> Va como repetición de tu vídeo corregido: tu coach verá los dos lado a lado.</p>}
              {esVideo && <AutoevaluacionEnvio rpeSerie={rpeDeSerie(serie && series?.find((x) => Number(x.numero) === Number(serie))?.rpe)} alCambiar={setAuto} />}
              <div class="campo">
                <label for="arch-nota">{esVideo ? '¿Qué quieres que mire?' : 'Nota (opcional)'}</label>
                <textarea id="arch-nota" class="area" style="min-height:64px" value={nota} onInput={(e) => setNota(e.currentTarget.value)}
                  placeholder={esVideo ? 'Por ejemplo: la profundidad, o si se me van las rodillas' : 'Frente, perfil, espalda…'} />
              </div>
              {grandeSinRecorte && sinVista && <div class="error" role="alert">Este vídeo no se puede recortar en este móvil y pesa más de {LIMITE_ARCHIVO_MB} MB. Grábalo de nuevo, solo la serie.</div>}
              <button class="btn btn-primario btn-grande" disabled={subiendo || (grandeSinRecorte && !(difuminar && difuminado)) || (esVideo && difuminar && !difuminado)} onClick={() => enviar()}>{subiendo ? (subida != null && subida > 0 ? `Subiendo… ${Math.round(subida * 100)} %` : 'Subiendo…') : esVideo && difuminar ? (difuminado ? 'Enviar el difuminado' : 'Primero, la vista previa') : grandeSinRecorte && !sinVista ? 'Cargando el vídeo…' : esVideo ? (recortado ? 'Recortar y enviar' : 'Enviar a tu coach') : 'Guardar foto'}</button>
              {subiendo && subida != null && (
                <>
                  <div class="recorte-progreso subida-progreso" aria-hidden="true"><span style={{ width: `${Math.round(subida * 100)}%` }} /></div>
                  <button type="button" class="btn btn-texto" onClick={() => { const x = senal.current; if (x?.abortar) x.abortar(); else if (x) x.cancelada = true; }}>Cancelar el envío</button>
                  <p class="mini terciario">Si se corta la cobertura o sales de la app, sigue por donde iba.</p>
                </>
              )}
            </>
          )}
        </Hoja>
      )}
    </>
  );
}

const duracionTexto = (s) => { const t = Math.max(0, Math.round(s)); return t < 60 ? `${t} s` : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} min`; };
const reloj = (s) => { const t = Math.max(0, s); const m = Math.floor(t / 60); const r = t - m * 60; return `${m}:${r.toFixed(1).padStart(4, '0').replace('.', ',')}`; };

// Vista previa con el recorte: dos deslizadores (dónde empieza y dónde acaba la serie); al moverlos, el vídeo va a
// ese momento. «Aquí» usa el momento en que está el vídeo. Mientras se ve, solo se reproduce el trozo elegido.
function VistaRecorte({ src, recortable, corte, setCorte, alFallar }) {
  const v = useRef(null);
  // (v0.59) El recorte automático: dónde empieza y acaba el movimiento (con un segundo de margen), propuesto sin tocar nada;
  // si se mueve un deslizador o se elige «Sin recortar», manda lo de la persona
  const [auto, setAuto] = useState(null); // null | 'buscando' | 'nada' | 'quitado' | { desde, hasta }
  const tocado = useRef(false);
  const senalAuto = useRef(null);
  const dur = corte?.dur || 0;
  useEffect(() => {
    if (!recortable || !(dur >= MIN_SEG_RECORTE)) return undefined;
    const senal = { aborted: false };
    senalAuto.current = senal;
    tocado.current = false;
    setAuto('buscando');
    buscarMovimiento(src, { dur, senal }).then((det) => {
      if (senal.aborted) return;
      if (det && recorteUtil(det, dur) && !tocado.current) { setCorte((c) => (c ? { ...c, inicio: det.desde, fin: det.hasta } : c)); setAuto(det); }
      else setAuto('nada');
    }, () => { if (!senal.aborted) setAuto('nada'); });
    return () => { senal.aborted = true; };
  }, [src, dur > 0, recortable]);
  const tocar = () => { tocado.current = true; if (senalAuto.current) senalAuto.current.aborted = true; setAuto((a) => (a === 'buscando' ? 'nada' : a)); };
  const sinRecortar = () => { tocar(); setAuto('quitado'); setCorte((c) => (c ? { ...c, inicio: 0, fin: c.dur } : c)); };
  const autoVigente = auto && typeof auto === 'object' && corte && Math.abs(corte.inicio - auto.desde) < 0.01 && Math.abs(corte.fin - auto.hasta) < 0.01;
  const ir = (t) => { const x = v.current; if (!x) return; x.pause(); x.currentTime = t; };
  const fijar = (campo, valor) => {
    tocar();
    setCorte((c) => {
      if (!c) return c;
      const n = { ...c, [campo]: valor };
      if (campo === 'inicio') n.inicio = Math.min(Math.max(0, valor), c.fin - 0.5);
      else n.fin = Math.max(Math.min(c.dur, valor), c.inicio + 0.5);
      return n;
    });
  };
  return (
    <>
      <video ref={v} class="medio medio-recorte" src={src} controls playsInline preload="metadata"
        onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) setCorte((c) => c || { dur: d, inicio: 0, fin: d }); else alFallar?.(); }}
        onError={() => alFallar?.()}
        onTimeUpdate={(e) => { const x = e.currentTarget; if (corte && !x.paused && x.currentTime >= corte.fin) { x.pause(); x.currentTime = corte.inicio; } }}
        onPlay={(e) => { const x = e.currentTarget; if (corte && (x.currentTime < corte.inicio - 0.05 || x.currentTime >= corte.fin - 0.05)) x.currentTime = corte.inicio; }} />
      {recortable && corte && corte.dur > 1.5 && (
        <div class="recorte" role="group" aria-label="Recortar el vídeo">
          <div class="recorte-titulo"><b>Recorta lo que sobra</b><span class="mini terciario">Deja solo la serie: sube antes y ocupa menos.</span></div>
          {auto === 'buscando' && <p class="mini terciario recorte-auto" role="status">Buscando dónde empieza y acaba la serie…</p>}
          {autoVigente && (
            <div class="recorte-auto fila-envolver" role="status">
              <span class="mini"><Icono n="recortar" /> Recortado solo: de <b class="num">{reloj(auto.desde)}</b> a <b class="num">{reloj(auto.hasta)}</b>, donde te mueves (con un segundo de margen). Ajústalo si quieres.</span>
              <button type="button" class="btn btn-peq" onClick={sinRecortar}>Sin recortar</button>
            </div>
          )}
          <div class="recorte-barra" aria-hidden="true">
            <span style={{ left: `${(corte.inicio / corte.dur) * 100}%`, width: `${((corte.fin - corte.inicio) / corte.dur) * 100}%` }} />
          </div>
          {[['inicio', 'Empieza en'], ['fin', 'Acaba en']].map(([campo, texto]) => (
            <div key={campo} class="recorte-fila">
              <label for={`recorte-${campo}`}>{texto} <b class="num">{reloj(corte[campo])}</b></label>
              <input id={`recorte-${campo}`} type="range" min="0" max={corte.dur} step="0.1" value={corte[campo]}
                onInput={(e) => { const t = Number(e.currentTarget.value); fijar(campo, t); ir(campo === 'inicio' ? Math.min(t, corte.fin - 0.5) : Math.max(t, corte.inicio + 0.5)); }} />
              <button type="button" class="btn btn-peq" aria-label={campo === 'inicio' ? 'Que empiece donde está el vídeo ahora' : 'Que acabe donde está el vídeo ahora'}
                onClick={() => v.current && fijar(campo, v.current.currentTime)}>Aquí</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// Muestra un vídeo o una foto del bucket privado con un enlace firmado (caduca en una hora).
// Miniatura (JPEG de 480 px de ancho) y duración de un vídeo, sacadas en el navegador: se pinta un fotograma
// del principio en un lienzo. Si el formato no se puede leer (algunos HEVC) o tarda, se devuelve null.
export function capturarPoster(archivo, { ancho = 480, segundo = 0.5, tiempo = 7000 } = {}) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') { resolve(null); return; }
    let url;
    try { url = URL.createObjectURL(archivo); } catch { resolve(null); return; }
    const v = document.createElement('video');
    let listo = false;
    const fin = (r) => { if (listo) return; listo = true; clearTimeout(t); try { URL.revokeObjectURL(url); v.removeAttribute('src'); v.load(); } catch { /* */ } resolve(r); };
    const t = setTimeout(() => fin(null), tiempo);
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.onerror = () => fin(null);
    v.onloadedmetadata = () => {
      try { v.currentTime = Math.min(segundo, Math.max(0.1, (v.duration || 1) / 10)); } catch { fin(null); }
    };
    v.onseeked = () => {
      try {
        const w = v.videoWidth || 0, h = v.videoHeight || 0;
        if (!w || !h) { fin(null); return; }
        const esc = Math.min(1, ancho / w);
        const c = document.createElement('canvas');
        c.width = Math.round(w * esc); c.height = Math.round(h * esc);
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        c.toBlob((b) => fin(b ? { poster: b, duracion: Number.isFinite(v.duration) ? Math.round(v.duration) : null } : null), 'image/jpeg', 0.8);
      } catch { fin(null); }
    };
    v.src = url;
  });
}

// v0.57: con la serie que se ve en él (archivo.serie: «Serie 2 · 60 kg × 8 @8») encima, y al abrirlo el coach queda
// «Visto» para el atleta (solo el día)
export const textoChipSerie = (serie) => (serie?.numero ? `Serie ${serie.numero}${serie.texto ? ` · ${serie.texto}` : ''}` : null);
// v0.60 (11): un vídeo grabado en cámara lenta (fps_captura, 038) se abre a 0,25× o 0,5×. cors y compacto: ver Reproductor.
export function VerArchivo({ archivo, cors = false, compacto = false, etiqueta = null }) {
  const { api, perfil } = useApp();
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let vivo = true;
    api.urlArchivo(archivo.ruta).then((u) => vivo && setUrl(u)).catch((e) => vivo && setError(e.message));
    return () => { vivo = false; };
  }, [archivo.ruta]);
  useEffect(() => { if (perfil?.rol === 'coach' && archivo.tipo === 'video_tecnica' && archivo.id) api.marcarVideoVisto(archivo.id).catch?.(() => {}); }, [archivo.id]);
  if (error) return <div class="nota peq">{error}</div>;
  if (!url) return <div class="medio medio-cargando"><Cargando texto="Cargando el archivo" /></div>;
  const esFoto = archivo.tipo === 'foto_progreso' || (archivo.tipo === 'adjunto' && /^image\//.test(archivo.mime || ''));
  return esFoto
    ? <img class="medio" src={url} alt={archivo.tipo === 'adjunto' ? 'Foto enviada en el chat' : `Foto de progreso del ${archivo.fecha}`} loading="lazy" />
    : (
      <>
        <Reproductor src={url} archivoId={archivo.id} serie={textoChipSerie(archivo.serie)} repeticiones={archivo.tipo === 'video_tecnica' && !compacto}
          cors={cors} compacto={compacto} etiqueta={etiqueta} velocidadInicial={velocidadInicial(archivo.fps_captura)} />
        {esLenta(archivo.fps_captura) && <p class="mini secundario chip-lenta"><Icono n="reloj" /> Grabado en cámara lenta ({archivo.fps_captura} fps): se abre a {velocidadInicial(archivo.fps_captura) === 0.25 ? '0,25×' : '0,5×'}.</p>}
      </>
    );
}

// Dos vídeos lado a lado (el mismo ejercicio hace dos meses y hoy, o dos intentos): cada uno con su
// reproductor y un mando común para arrancar, parar y volver al principio los dos a la vez
// v0.57: o superpuestos (el de encima, con su transparencia); y alineados: se marca el inicio de la repetición en cada uno
// y van a la vez desde ahí. La demostración de la biblioteca es de YouTube: se abre aparte (no se puede superponer).
// v0.59 (6): con los vídeos modelo del coach de esos ejercicios (037) como uno más: se superponen y se alinean como los
// demás (inicialB = 'modelo': empieza con el modelo a la derecha). La demostración de YouTube, solo si no hay modelo.
// Y si los dos traen sus repeticiones (del análisis o del tempo), se alinean por la primera con un toque.
export function CompararVideos({ videos: propios, nombreDe: nombrePropio, alCerrar, inicialA = null, inicialB = null, demostracion = null, conModelos = true }) {
  const { api } = useApp();
  const ejIds = [...new Set(propios.map((v) => v.ejercicio?.id || v.ejercicio_id).filter(Boolean))];
  const modelos = useCarga(() => (conModelos && ejIds.length ? api.videosModelo(ejIds).catch(() => []) : Promise.resolve([])), [ejIds.join(',')]);
  const deModelo = (modelos.datos || []).map((m) => ({ ...m, id: `modelo:${m.id}`, modeloId: m.id, tipo: 'modelo', fecha: null, ejercicio: propios.find((v) => (v.ejercicio?.id || v.ejercicio_id) === m.ejercicio_id)?.ejercicio || null }));
  const videos = [...propios, ...deModelo];
  const nombreDe = (v) => (v.tipo === 'modelo' ? `Vídeo modelo${v.angulo ? ` (${v.angulo})` : ''}` : nombrePropio(v));
  const [a, setA] = useState(inicialA || propios[propios.length - 1]?.id || null);
  const [b, setB] = useState(inicialB && inicialB !== 'modelo' ? inicialB : (propios.length > 1 && inicialB !== 'modelo' ? propios[propios.length - 2].id : null));
  useEffect(() => { if (!b && deModelo.length) setB(deModelo[0].id); }, [deModelo.length]);
  const [modo, setModo] = useState('lado');
  const [marcas, setMarcas] = useState({}); // id → segundo en que empieza la repetición
  const va = videos.find((v) => v.id === a), vb = videos.find((v) => v.id === b);
  const ambos = (f) => [va, vb].forEach((v) => v && f(reproductorDe(v.id), v));
  const opciones = videos.map((v) => <option key={v.id} value={v.id}>{nombreDe(v)}{v.fecha ? `, ${fmtCorta(v.fecha)}` : ''}</option>);
  const alineados = va && vb && marcas[va.id] != null && marcas[vb.id] != null;
  const primeraRep = (v) => marcasRepeticiones({ analisis: v?.revision?.analisis || null, tempo: v?.revision?.tempo || null, duracion: v?.duracion_seg || null }).reps[0]?.t ?? null;
  const repsA = primeraRep(va), repsB = primeraRep(vb);
  // La demostración de la biblioteca de ese ejercicio (si los dos son del mismo, la tiene y no hay vídeo modelo)
  const demo = deModelo.length ? null : demostracion ?? (va?.ejercicio?.id && va.ejercicio.id === vb?.ejercicio?.id && /^https:\/\//.test(va.ejercicio.video_url || '') ? va.ejercicio.video_url : null);
  const aLaVez = () => {
    if (alineados) {
      const ra = reproductorDe(va.id), rb = reproductorDe(vb.id);
      rb?.ir(tiempoOtro(ra?.ahora() || 0, marcas[va.id], marcas[vb.id], rb?.duracion?.() || null));
    }
    ambos((r) => r?.reproducir?.());
  };
  const alInicio = () => ambos((r, v) => r?.ir?.(marcas[v.id] ?? 0));
  return (
    <Hoja titulo="Comparar dos vídeos" alCerrar={alCerrar} ancho={960}>
      <div class="segmentos comparar-modo" role="group" aria-label="Cómo compararlos">
        <button type="button" aria-pressed={modo === 'lado' ? 'true' : 'false'} onClick={() => setModo('lado')}>Lado a lado</button>
        <button type="button" aria-pressed={modo === 'encima' ? 'true' : 'false'} onClick={() => setModo('encima')}>Superpuestos</button>
      </div>
      {modo === 'lado' ? (
        <>
          <div class="comparar-videos">
            {[['a', a, setA, va], ['b', b, setB, vb]].map(([k, id, set, v]) => (
              <div class="pila-s" key={k}>
                <select class="selector" aria-label={k === 'a' ? 'Vídeo de la izquierda' : 'Vídeo de la derecha'} value={id || ''} onChange={(e) => set(e.currentTarget.value)}>{opciones}</select>
                {v ? <VerArchivo archivo={v} key={v.id} /> : <div class="medio medio-cargando peq secundario">Elige un vídeo</div>}
                {v && (
                  <div class="fila-envolver comparar-marca">
                    <button type="button" class="btn btn-peq" onClick={() => setMarcas((m) => ({ ...m, [v.id]: Math.round((reproductorDe(v.id)?.ahora() || 0) * 100) / 100 }))}
                      aria-label={`Marcar aquí el inicio de la repetición (${k === 'a' ? 'izquierda' : 'derecha'})`}><Icono n="chincheta" /> Empieza aquí</button>
                    {marcas[v.id] != null && <span class="mini secundario num">Inicio: {textoMomentoCorto(marcas[v.id])}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div class="fila-envolver">
            <button class="btn btn-primario" onClick={aLaVez}><Icono n="play" /> Los dos a la vez</button>
            <button class="btn" onClick={() => ambos((r) => r?.pausar?.())}><Icono n="pausa" /> Pausar los dos</button>
            <button class="btn" onClick={alInicio}><Icono n="reiniciar" /> {alineados ? 'Al inicio de la repetición' : 'Al principio'}</button>
          </div>
          {repsA != null && repsB != null && <button type="button" class="btn btn-peq" onClick={() => setMarcas((m) => ({ ...m, [va.id]: repsA, [vb.id]: repsB }))}><Icono n="chincheta" /> Alinear por la 1.ª repetición</button>}
          <p class="mini terciario">{alineados ? 'Alineados: los dos empiezan la repetición a la vez.' : 'Para alinearlos, para cada vídeo justo cuando empieza la repetición y toca «Empieza aquí».'} Pon los dos a 0,25× y avanza fotograma a fotograma en cada uno para comparar la misma posición.</p>
        </>
      ) : (
        <Superpuestos videos={videos} opciones={opciones} a={a} b={b} setA={setA} setB={setB} marcas={marcas} setMarcas={setMarcas} />
      )}
      {demo && (
        <p class="mini secundario"><a href={demo} target="_blank" rel="noopener">Ver la demostración de la biblioteca</a> (YouTube: se abre aparte, no se puede superponer).</p>
      )}
    </Hoja>
  );
}
const textoMomentoCorto = (t) => { const d = Math.floor(Math.max(0, t) * 10 + 1e-6); return `${Math.floor(d / 600)}:${String(Math.floor((d % 600) / 10)).padStart(2, '0')},${d % 10}`; };

// Los dos vídeos uno encima del otro: el de abajo manda; el de encima va a su mismo punto de la repetición (si están
// marcados) y se ve con la transparencia que elijas. Fotograma a fotograma, mueve el que elijas (o los dos).
function Superpuestos({ videos, opciones, a, b, setA, setB, marcas, setMarcas }) {
  const { api } = useApp();
  const abajo = useRef(null), encima = useRef(null);
  const [urls, setUrls] = useState({});
  const [opacidad, setOpacidad] = useState(50);
  const [mover, setMover] = useState('los dos');
  const [vel, setVel] = useState(1);
  const [jugando, setJugando] = useState(false);
  const va = videos.find((v) => v.id === a), vb = videos.find((v) => v.id === b);
  useEffect(() => {
    let vivo = true;
    for (const v of [va, vb]) if (v && !urls[v.id]) api.urlArchivo(v.ruta).then((u) => vivo && setUrls((x) => ({ ...x, [v.id]: u }))).catch(() => {});
    return () => { vivo = false; };
  }, [a, b]);
  const mA = va ? marcas[va.id] ?? 0 : 0, mB = vb ? marcas[vb.id] ?? 0 : 0;
  const alinear = () => { const x = abajo.current, y = encima.current; if (x && y) { const t = tiempoOtro(x.currentTime, mA, mB, y.duration || null); if (Math.abs(y.currentTime - t) > 0.06) y.currentTime = t; } };
  const reproducir = () => { const x = abajo.current, y = encima.current; if (!x || !y) return; x.playbackRate = vel; y.playbackRate = vel; alinear(); x.play().catch(() => {}); y.play().catch(() => {}); };
  const pausar = () => { abajo.current?.pause(); encima.current?.pause(); };
  const paso = (n) => {
    pausar();
    const d = n / 30;
    if (mover !== 'encima' && abajo.current) abajo.current.currentTime = Math.max(0, abajo.current.currentTime + d);
    if (mover === 'encima' && encima.current) encima.current.currentTime = Math.max(0, encima.current.currentTime + d);
    if (mover === 'los dos') setTimeout(alinear, 0);
  };
  const marcar = (v, el) => v && el && setMarcas((m) => ({ ...m, [v.id]: Math.round(el.currentTime * 100) / 100 }));
  const alInicio = () => { pausar(); if (abajo.current) abajo.current.currentTime = mA; if (encima.current) encima.current.currentTime = mB; };
  return (
    <div class="pila-s superpuestos">
      <div class="comparar-selectores">
        <select class="selector" aria-label="Vídeo de abajo" value={a || ''} onChange={(e) => setA(e.currentTarget.value)}>{opciones}</select>
        <select class="selector" aria-label="Vídeo de encima" value={b || ''} onChange={(e) => setB(e.currentTarget.value)}>{opciones}</select>
      </div>
      <div class="superpuestos-marco">
        {va && urls[va.id] && <video ref={abajo} class="superpuesto-abajo" src={urls[va.id]} playsInline muted preload="auto" onTimeUpdate={() => { if (jugando) alinear(); }} onPlay={() => setJugando(true)} onPause={() => setJugando(false)} aria-label="Vídeo de abajo" />}
        {vb && urls[vb.id] && <video ref={encima} class="superpuesto-encima" src={urls[vb.id]} playsInline muted preload="auto" style={{ opacity: opacidad / 100 }} aria-label="Vídeo de encima" />}
        {(!va || !vb) && <div class="medio medio-cargando peq secundario">Elige los dos vídeos</div>}
      </div>
      <label class="superpuestos-opacidad">
        <span class="mini">Transparencia del de encima</span>
        <input type="range" min="0" max="100" step="5" value={opacidad} onInput={(e) => setOpacidad(Number(e.currentTarget.value))} aria-valuetext={`${opacidad} %`} />
      </label>
      <div class="fila-envolver">
        <button class="btn btn-primario" onClick={jugando ? pausar : reproducir}><Icono n={jugando ? 'pausa' : 'play'} /> {jugando ? 'Pausar' : 'Reproducir los dos'}</button>
        <div class="segmentos" role="group" aria-label="Velocidad de los dos">
          {[[0.25, '0,25×'], [0.5, '0,5×'], [1, '1×']].map(([r, t]) => <button key={r} type="button" aria-pressed={vel === r ? 'true' : 'false'} onClick={() => { setVel(r); if (abajo.current) abajo.current.playbackRate = r; if (encima.current) encima.current.playbackRate = r; }}>{t}</button>)}
        </div>
        <button class="btn" onClick={alInicio}><Icono n="reiniciar" /> Al inicio</button>
      </div>
      <div class="fila-envolver">
        <label class="campo-linea"><span class="mini">Fotograma a fotograma:</span>
          <select class="selector" value={mover} onChange={(e) => setMover(e.currentTarget.value)} aria-label="Qué vídeo se mueve">
            <option value="los dos">los dos</option><option value="abajo">el de abajo</option><option value="encima">el de encima</option>
          </select></label>
        <button class="btn btn-icono" onClick={() => paso(-1)} aria-label="Fotograma anterior"><Icono n="atras" /></button>
        <button class="btn btn-icono" onClick={() => paso(1)} aria-label="Fotograma siguiente"><Icono n="derecha" /></button>
      </div>
      <div class="fila-envolver">
        <button type="button" class="btn btn-peq" onClick={() => marcar(va, abajo.current)}><Icono n="chincheta" /> Empieza aquí (abajo)</button>
        <button type="button" class="btn btn-peq" onClick={() => marcar(vb, encima.current)}><Icono n="chincheta" /> Empieza aquí (encima)</button>
        <span class="mini secundario num">{va && marcas[va.id] != null ? `Abajo: ${textoMomentoCorto(mA)}` : ''}{vb && marcas[vb.id] != null ? ` · Encima: ${textoMomentoCorto(mB)}` : ''}</span>
      </div>
      <p class="mini terciario">Mueve primero el de abajo hasta el inicio de la repetición y márcalo; luego, solo el de encima, y márcalo: al reproducir, van a la vez.</p>
    </div>
  );
}
