// El análisis automático de un vídeo de técnica (v0.58, experimental). Se carga solo al usarlo (import dinámico).
//   · Barra y velocidad (el coach y, solo en su móvil, el atleta): en pausa, se toca el centro del disco (y se ajusta el
//     círculo); la app lo sigue fotograma a fotograma en el tramo elegido (todo el vídeo o entre dos marcas); si lo pierde,
//     dice dónde y se vuelve a tocar ahí para seguir. Con la calibración del disco (su tamaño real), la velocidad media y
//     pico de cada subida, su duración y su recorrido; la mejor repetición y la pérdida de velocidad. Las repeticiones se
//     pueden unir o partir.
//   · Puntos del cuerpo (solo el coach): el esqueleto encima del vídeo, los ángulos (rodilla, cadera, tronco y, en los
//     press, codo) del lado que mira a la cámara y, por repetición, la profundidad (rodilla mínima) y el tronco más inclinado.
//   · «Guardar en la corrección» (con la 036): el atleta lo ve en su vídeo corregido y en «Mi técnica».
// Todo se calcula en este dispositivo y queda en memoria durante la sesión (por vídeo); al salir se suelta.
import { useEffect, useId, useMemo, useRef, useState } from 'preact/hooks';
import { useApp, Icono } from '../../comunes.jsx';
import { reproductorDe, textoMomento } from '../../Video.jsx';
import { ponerCapa, leerSesionAnalisis, guardarSesionAnalisis } from '../capas.js';
import { CapaAnalisis } from './Capas.jsx';
import { seguirBarra, detectarPose } from './procesar.js';
import { crearDetector, poseDisponible } from './pose.js';
import { encuadreDe } from '../../../logica/tecnica.js';
import {
  repeticiones, unirReps, partirRep, resumenSerie, desvioHorizontal, fasesTrayectoria, calibracion, calibracionValida, diametroPx, repEn, tramoAnalisis,
  DISCOS_CM, DISCO_CM, MAX_SEG_ANALISIS, textoVel, textoCm, textoPct, textoGrados, ladoProbable, resumenPose, repsDeCadera, angulosDe, poseEn, limpiarAnalisis,
} from '../../../logica/analisis.js';

// Lo de cada vídeo en esta sesión (para no repetir el análisis al cerrar y abrir su tarjeta): en capas.js, por cuenta, de
// los 5 últimos vídeos, y se olvida al cerrar la sesión

export const AVISO_EXPERIMENTAL = 'Experimental: una estimación hecha en este dispositivo a partir del vídeo (no sale de aquí). Con la cámara quieta, de lado y perpendicular a la barra, y el disco entero a la vista, el error suele estar en torno al ±10–15 %: sirve para comparar repeticiones y series grabadas igual, no como medida de laboratorio.';

export default function PanelAnalisis({ video, esCoach = false, guardado = null, con036 = false, alGuardado }) {
  const { api, aviso, modo, perfil } = useApp();
  const demo = modo === 'demo';
  const id = video.id;
  const claveSesion = `${perfil?.id || ''}:${id}`;
  const previo = useState(() => leerSesionAnalisis(claveSesion) || {})[0];
  const [pestana, setPestana] = useState('barra');
  const [tramo, setTramo] = useState(previo.tramo || { modo: 'todo', t0: 0, t1: null });
  const [circulo, setCirculo] = useState(previo.circulo || null); // { c: [x, y] de 0 a 1, r: px del vídeo, t }
  const [barra, setBarra] = useState(previo.barra || null); // { puntos, perdida, w, h, dur }
  const [cal, setCal] = useState(previo.cal || null);
  const [discoCm, setDiscoCm] = useState(previo.discoCm || DISCO_CM);
  const [repsEdit, setRepsEdit] = useState(previo.repsEdit || null);
  const [pose, setPose] = useState(previo.pose || null); // { fotos, w, h, lado }
  const [fase, setFase] = useState(null); // null | 'eligiendo' | 'toques' | 'barra' | 'pose'
  const [progreso, setProgreso] = useState(0);
  const [estadoPose, setEstadoPose] = useState('');
  const [error, setError] = useState('');
  const [toques, setToques] = useState([]);
  const [ocupado, setOcupado] = useState(false);
  const [tVideo, setTVideo] = useState(0);
  const control = useRef(null);
  const detector = useRef(null);
  const rep = () => reproductorDe(id);
  const vivo = useRef(true);

  useEffect(() => { guardarSesionAnalisis(claveSesion, { tramo, circulo, barra, cal, discoCm, repsEdit, pose }); }, [claveSesion, tramo, circulo, barra, cal, discoCm, repsEdit, pose]);
  // Al salir: se para lo que esté en marcha y se suelta el modelo (y la capa)
  useEffect(() => () => { vivo.current = false; control.current?.abort(); detector.current?.cerrar(); detector.current = null; rep()?.cancelarEleccion?.(); ponerCapa(id, null); }, [id]);
  // El momento del vídeo (para unir o partir la repetición en la que está)
  useEffect(() => {
    let el = null, t = null;
    const enganchar = () => {
      const x = rep()?.elemento?.();
      if (!x || x === el) return;
      el?.removeEventListener('timeupdate', al); el?.removeEventListener('seeked', al);
      el = x; el.addEventListener('timeupdate', al); el.addEventListener('seeked', al); al();
    };
    const al = () => setTVideo(el?.currentTime || 0);
    enganchar();
    t = setInterval(enganchar, 1000);
    return () => { clearInterval(t); el?.removeEventListener('timeupdate', al); el?.removeEventListener('seeked', al); };
  }, [id]);

  const dims = () => { const el = rep()?.elemento?.(); return { w: barra?.w || el?.videoWidth || 0, h: barra?.h || el?.videoHeight || 0, dur: barra?.dur || el?.duration || video.duracion_seg || 0 }; };
  const ej = video.ejercicio || null;
  const esPress = ['empuje_h', 'empuje_v'].includes(encuadreDe(ej?.nombre || '', ej?.grupos_musculares || [], ej?.tipo || []).patron);

  // Lo que se ve: lo de esta sesión o, si no hay, lo guardado en la corrección
  const vista = useMemo(() => {
    if (barra?.puntos?.length > 1) return { puntos: barra.puntos.map((p) => [p[0], p[1], p[2]]), cal: calibracionValida(cal) ? cal : null, propio: true };
    if (guardado?.barra?.p?.length > 1) return { puntos: guardado.barra.p, cal: guardado.cal || null, reps: guardado.reps || [], propio: false };
    return null;
  }, [barra, cal, guardado]);
  const repsAuto = useMemo(() => (vista?.propio ? repeticiones(vista.puntos, { cal: vista.cal }) : vista?.reps || []), [vista]);
  const reps = vista?.propio && repsEdit ? repsEdit : repsAuto;
  const fases = useMemo(() => (vista ? fasesTrayectoria(vista.puntos) : []), [vista]);
  const desvio = useMemo(() => (vista ? desvioHorizontal(vista.puntos, vista.cal) : null), [vista]);
  const resumen = resumenSerie(reps);
  const poseVista = pose?.fotos?.length ? pose : null;
  const repsPose = useMemo(() => {
    if (!poseVista) return guardado?.pose?.reps && !barra ? guardado.pose.reps : [];
    const base = reps.length ? reps : repsDeCadera(poseVista.fotos, poseVista.lado);
    return resumenPose(poseVista.fotos, base, poseVista.lado, { w: poseVista.w, h: poseVista.h, codo: esPress });
  }, [poseVista, reps, esPress, guardado, barra]);

  // La capa sobre el vídeo
  useEffect(() => {
    const estado = {
      circulo: circulo && fase !== 'eligiendo' && (!vista?.propio || fase === 'barra') ? circulo : null,
      barra: vista ? { puntos: vista.puntos, fases, x0: vista.puntos[0][1] } : null,
      pose: poseVista ? { fotos: poseVista.fotos, lado: poseVista.lado } : null,
      toques,
    };
    const hay = estado.circulo || estado.barra || estado.pose || toques.length;
    ponerCapa(id, hay ? (a) => <CapaAnalisis {...a} estado={estado} /> : null);
  }, [id, circulo, vista, fases, poseVista, toques, fase]);

  const tr = (() => { const d = dims().dur; return tramo.modo === 'todo' ? tramoAnalisis(0, d, d) : tramoAnalisis(tramo.t0, tramo.t1 ?? d, d); })();
  const marcar = (k) => { const t = Math.round((rep()?.ahora() || 0) * 100) / 100; setTramo((x) => ({ ...x, modo: 'marcas', [k]: t })); };
  const fallo = (e) => { if (e?.name === 'AbortError') return; setError(e?.message || String(e)); };

  // 18. Tocar el disco y seguirlo
  async function elegirDisco(enT = null) {
    const r = rep(); if (!r) return null;
    setError('');
    r.ir(enT ?? tr.t0);
    setFase('eligiendo');
    const p = await r.elegirPunto({ texto: 'Toca el centro del disco (o el extremo de la barra)' });
    if (!vivo.current) return null;
    setFase(null);
    if (!p) return null;
    const el = r.elemento();
    const c = { c: p, r: circulo?.r || Math.max(6, Math.round((el?.videoWidth || 360) * 0.06)), t: Math.round((el?.currentTime || 0) * 1000) / 1000 };
    setCirculo(c);
    return c;
  }
  async function seguir(desde = null) {
    const r = rep(); const c = desde || circulo;
    if (!r || !c || fase) return;
    const ac = new AbortController(); control.current = ac;
    setError(''); setProgreso(0); setFase('barra');
    try {
      const res = await seguirBarra({ src: r.fuente(), inicio: { t: c.t, x: c.c[0], y: c.c[1], r: c.r }, t1: tr.t1, alProgreso: (x) => vivo.current && setProgreso(x), senal: ac.signal });
      if (!vivo.current) return;
      const antes = desde && barra ? barra.puntos.filter((p) => p[0] < c.t - 1e-6) : [];
      setBarra({ ...res, puntos: [...antes, ...res.puntos] });
      setRepsEdit(null);
      if (res.perdida != null) aviso(`Se ha perdido la barra en ${textoMomento(res.perdida, true)}`, 'error');
    } catch (e) { fallo(e); } finally { if (vivo.current) { setFase(null); control.current = null; } }
  }
  const cancelar = () => { control.current?.abort(); rep()?.cancelarEleccion?.(); detector.current?.cerrar(); detector.current = null; setFase(null); setToques([]); };
  async function seguirDondeSePerdio() {
    const c = await elegirDisco(barra.perdida);
    if (c) await seguir(c);
  }
  const mover = (dx, dy) => setCirculo((c) => (c ? { ...c, c: [Math.min(1, Math.max(0, c.c[0] + dx)), Math.min(1, Math.max(0, c.c[1] + dy))] } : c));
  const alCentro = () => { const el = rep()?.elemento?.(); rep()?.cancelarEleccion?.(); setCirculo((c) => ({ c: [0.5, 0.5], r: c?.r || Math.max(6, Math.round((el?.videoWidth || 360) * 0.06)), t: Math.round((el?.currentTime || 0) * 1000) / 1000 })); };

  // 19. Calibrar: con el círculo o con dos toques de lado a lado del disco
  const { w: vw, h: vh } = dims();
  const usarCirculo = () => { const x = calibracion(discoCm, circulo.r * 2, vw, vh); if (x) { setCal(x); setRepsEdit(null); } else setError('No se puede calibrar así: revisa el tamaño del disco (de 10 a 60 cm).'); };
  async function dosToques() {
    const r = rep(); if (!r || fase) return;
    setError(''); setFase('toques'); setToques([]);
    const a = await r.elegirPunto({ texto: 'Toca un borde del disco' });
    if (!a || !vivo.current) { setFase(null); setToques([]); return; }
    setToques([a]);
    const b = await r.elegirPunto({ texto: 'Ahora, el borde de enfrente' });
    if (!vivo.current) return;
    setFase(null);
    if (!b) { setToques([]); return; }
    setToques([a, b]);
    const x = calibracion(discoCm, diametroPx(a, b, vw, vh), vw, vh);
    if (x) { setCal(x); setRepsEdit(null); } else setError('No se puede calibrar así: toca los dos bordes del disco.');
    setTimeout(() => vivo.current && setToques([]), 1500);
  }

  // 20. Los puntos del cuerpo
  async function detectar() {
    const r = rep(); if (!r || fase) return;
    const ac = new AbortController(); control.current = ac;
    setError(''); setProgreso(0); setFase('pose'); setEstadoPose('Preparando el modelo…');
    try {
      const det = await crearDetector({ demo, alEstado: (e) => vivo.current && setEstadoPose(e === 'descargando' ? 'Descargando el modelo (unos 12 MB, solo la primera vez)…' : 'Preparando el modelo…') });
      detector.current = det;
      if (ac.signal.aborted) throw Object.assign(new Error('Cancelado'), { name: 'AbortError' });
      setEstadoPose('Buscando los puntos del cuerpo…');
      const res = await detectarPose({ src: r.fuente(), t0: tr.t0, t1: tr.t1, detector: det, alProgreso: (x) => vivo.current && setProgreso(x), senal: ac.signal });
      if (!vivo.current) return;
      if (!res.fotos.length) { setPose(null); setError('No se ha encontrado a nadie en el vídeo: tiene que verse el cuerpo entero, de lado.'); return; }
      setPose({ ...res, lado: ladoProbable(res.fotos) });
    } catch (e) { fallo(e); } finally {
      detector.current?.cerrar(); detector.current = null;
      if (vivo.current) { setFase(null); control.current = null; setEstadoPose(''); }
    }
  }

  // Guardar en la corrección
  const paraGuardar = useMemo(() => limpiarAnalisis({ barra: vista?.propio ? { p: vista.puntos } : null, cal: vista?.propio ? vista.cal : null, reps: vista?.propio ? reps : null,
    pose: poseVista && repsPose.length ? { lado: poseVista.lado, reps: repsPose } : null }), [vista, reps, poseVista, repsPose]);
  async function guardar() {
    if (ocupado || !paraGuardar) return;
    setOcupado(true);
    try { await api.guardarAnalisis(video, paraGuardar); aviso('Análisis guardado en la corrección: tu atleta lo ve en su vídeo'); await alGuardado?.(); }
    catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  }
  async function quitar() {
    setOcupado(true);
    try { await api.guardarAnalisis(video, null); aviso('Análisis quitado de la corrección'); await alGuardado?.(); }
    catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  }

  const enCurso = fase === 'barra' || fase === 'pose';
  const iRep = repEn(reps, tVideo);
  const conVel = reps.some((r) => r.vm != null);
  return (
    <div class="analisis-cuerpo pila-s">
      {esCoach && (
        <div class="segmentos analisis-pestanas" role="group" aria-label="Qué analizar">
          <button type="button" aria-pressed={pestana === 'barra' ? 'true' : 'false'} onClick={() => setPestana('barra')}>Barra y velocidad</button>
          <button type="button" aria-pressed={pestana === 'pose' ? 'true' : 'false'} onClick={() => setPestana('pose')}>Puntos del cuerpo</button>
        </div>
      )}
      <Tramo tramo={tramo} setTramo={setTramo} tr={tr} marcar={marcar} deshabilitado={enCurso} />
      {pestana === 'barra' ? (
        <div class="pila-s">
          {!vista?.propio && (
            <div class="campo">
              <span class="etq">1. El disco</span>
              <div class="fila-envolver">
                <button type="button" class="btn btn-peq" disabled={enCurso || fase === 'toques'} onClick={() => elegirDisco()}><Icono n="diana" /> {circulo ? 'Marcar otra vez' : 'Marcar la barra'}</button>
                {fase === 'eligiendo' && <button type="button" class="btn btn-peq plano" onClick={alCentro}>Ponerlo en el centro</button>}
                {fase === 'eligiendo' && <button type="button" class="btn btn-peq plano" onClick={() => rep()?.cancelarEleccion?.()}>Cancelar</button>}
              </div>
              <span class="ayuda" role="status">{fase === 'eligiendo' ? 'Toca el centro del disco en el vídeo (va al principio del tramo).' : circulo ? `Marcado en el ${textoMomento(circulo.t, true)}. Ajusta el círculo para que rodee el disco.` : 'En pausa, toca el centro del disco (o el extremo de la barra) en el primer fotograma del tramo.'}</span>
              {circulo && fase !== 'eligiendo' && <AjustarCirculo circulo={circulo} setCirculo={setCirculo} mover={mover} vw={vw} deshabilitado={enCurso} />}
            </div>
          )}
          {!vista?.propio && circulo && (
            <div class="fila-envolver">
              <button type="button" class="btn btn-primario" disabled={enCurso || !!fase} onClick={() => seguir()}><Icono n="play" /> Seguir la barra</button>
            </div>
          )}
          {fase === 'barra' && <Progreso texto="Siguiendo la barra" valor={progreso} cancelar={cancelar} />}
          {vista && (
            <>
              {vista.propio && barra?.perdida != null && (
                <div class="analisis-perdida pila-xs" role="alert">
                  <strong>Se ha perdido la barra en {textoMomento(barra.perdida, true)}</strong>
                  <span class="mini">Tócala ahí para seguir desde ese momento (lo de antes se queda).</span>
                  <div class="fila-envolver"><button type="button" class="btn btn-peq btn-primario" disabled={enCurso || !!fase} onClick={seguirDondeSePerdio}><Icono n="diana" /> Tocar la barra ahí y seguir</button></div>
                </div>
              )}
              <p class="mini secundario analisis-leyenda"><span class="punto-fase baja" aria-hidden="true" /> bajada <span class="punto-fase sube" aria-hidden="true" /> subida; la línea discontinua es la vertical desde donde empieza.{desvio ? ` Se separa de ella hasta ${desvio.unidad === 'cm' ? textoCm(desvio.izq) : `${desvio.izq} % del ancho`} a la izquierda y ${desvio.unidad === 'cm' ? textoCm(desvio.der) : `${desvio.der} % del ancho`} a la derecha.` : ''}</p>
              {vista.propio && (
                <Calibrar cal={cal} discoCm={discoCm} setDiscoCm={(x) => { setDiscoCm(x); if (cal) setCal(null); }} circulo={circulo} usarCirculo={usarCirculo} dosToques={dosToques} fase={fase} cancelar={() => rep()?.cancelarEleccion?.()} />
              )}
              <TablaVelocidad reps={reps} resumen={resumen} conVel={conVel} ir={(t) => rep()?.ir(t)} />
              {vista.propio && reps.length > 0 && (
                <div class="fila-envolver analisis-ajustar">
                  <span class="mini secundario">{iRep >= 0 ? `El vídeo está en la repetición ${iRep + 1}:` : 'Lleva el vídeo a una repetición para unirla o partirla.'}</span>
                  {iRep >= 0 && <button type="button" class="btn btn-peq" onClick={() => setRepsEdit(partirRep(vista.puntos, reps, iRep, rep()?.ahora() || tVideo, { cal: vista.cal }))}>Partir aquí</button>}
                  {iRep >= 0 && iRep < reps.length - 1 && <button type="button" class="btn btn-peq" onClick={() => setRepsEdit(unirReps(vista.puntos, reps, iRep, { cal: vista.cal }))}>Unir con la siguiente</button>}
                  {repsEdit && <button type="button" class="btn btn-peq plano" onClick={() => setRepsEdit(null)}>Como al principio</button>}
                </div>
              )}
              {vista.propio && <div class="fila-envolver"><button type="button" class="btn btn-peq plano" disabled={enCurso} onClick={() => { setBarra(null); setRepsEdit(null); setCal(null); }}><Icono n="reiniciar" /> Empezar otra vez</button></div>}
            </>
          )}
        </div>
      ) : (
        <div class="pila-s">
          {!poseDisponible(demo) ? <p class="peq secundario">Los puntos del cuerpo no están disponibles en esta versión de la app.</p> : (
            <div class="fila-envolver">
              <button type="button" class="btn btn-primario" disabled={enCurso || !!fase} onClick={detectar}><Icono n="movilidad" /> {poseVista ? 'Detectar otra vez' : 'Detectar los puntos del cuerpo'}</button>
            </div>
          )}
          {fase === 'pose' && <Progreso texto={estadoPose || 'Buscando los puntos del cuerpo'} valor={progreso} cancelar={cancelar} />}
          {poseVista && <AngulosAhora pose={poseVista} t={tVideo} setLado={(lado) => setPose({ ...pose, lado })} />}
          {repsPose.length > 0 && <TablaPose reps={repsPose} codo={esPress || repsPose.some((r) => r.codo != null)} ir={(t) => rep()?.ir(t)} />}
          {poseVista && !repsPose.length && <p class="mini secundario">No salen repeticiones claras: sigue la barra (o recorta el tramo) para tener los ángulos de cada una.</p>}
          <p class="mini terciario">Los puntos los calcula un modelo (MediaPipe Pose) en este dispositivo, sobre una imagen reducida: con ropa ancha, poca luz o el cuerpo de frente, se equivoca más. Los ángulos son en el plano del vídeo.</p>
        </div>
      )}
      {error && <p class="nota peq" role="alert">{error}</p>}
      <p class="mini terciario analisis-aviso">{esCoach ? AVISO_EXPERIMENTAL : `${AVISO_EXPERIMENTAL} Lo que analizas tú solo lo ves tú, en este móvil: no se guarda.`}</p>
      {esCoach && (
        <div class="fila-envolver analisis-guardar">
          {con036 !== false
            ? <button type="button" class="btn btn-primario" disabled={ocupado || !paraGuardar || enCurso} onClick={guardar}><Icono n="hecho" /> {ocupado ? 'Guardando…' : 'Guardar en la corrección'}</button>
            : <button type="button" class="btn" disabled>Disponible tras la migración 036</button>}
          {con036 !== false && guardado && <button type="button" class="btn btn-peq plano" disabled={ocupado} onClick={quitar}><Icono n="basura" /> Quitar de la corrección</button>}
          <span class="mini terciario">{con036 !== false ? (guardado ? 'Ya hay un análisis guardado: guardar otra vez lo cambia.' : 'Tu atleta lo verá en su vídeo corregido (la trayectoria, la velocidad y los ángulos de cada repetición).') : 'Mientras tanto, el análisis funciona igual, pero no se guarda.'}</span>
        </div>
      )}
    </div>
  );
}

// El tramo: todo el vídeo o entre dos marcas (como mucho 60 s)
function Tramo({ tramo, setTramo, tr, marcar, deshabilitado }) {
  const idT = useId();
  return (
    <div class="campo">
      <span class="etq" id={idT}>Tramo</span>
      <div class="segmentos analisis-tramo" role="group" aria-labelledby={idT}>
        <button type="button" disabled={deshabilitado} aria-pressed={tramo.modo === 'todo' ? 'true' : 'false'} onClick={() => setTramo({ ...tramo, modo: 'todo' })}>Todo el vídeo</button>
        <button type="button" disabled={deshabilitado} aria-pressed={tramo.modo === 'marcas' ? 'true' : 'false'} onClick={() => setTramo({ ...tramo, modo: 'marcas' })}>Entre dos marcas</button>
      </div>
      {tramo.modo === 'marcas' && (
        <div class="fila-envolver">
          <button type="button" class="btn btn-peq" disabled={deshabilitado} onClick={() => marcar('t0')}><Icono n="chincheta" /> Inicio aquí</button>
          <button type="button" class="btn btn-peq" disabled={deshabilitado} onClick={() => marcar('t1')}><Icono n="chincheta" /> Fin aquí</button>
        </div>
      )}
      <span class="ayuda num">De {textoMomento(tr.t0, true)} a {textoMomento(tr.t1, true)}{tr.recortado ? ` (como mucho ${MAX_SEG_ANALISIS} s)` : ''}.</span>
    </div>
  );
}

function AjustarCirculo({ circulo, setCirculo, mover, vw, deshabilitado }) {
  const max = Math.max(20, Math.round((vw || 360) * 0.3));
  const d = 0.005;
  return (
    <div class="analisis-circulo pila-xs">
      <label class="superpuestos-opacidad"><span class="mini">Tamaño del círculo</span>
        <input type="range" min="4" max={max} step="1" value={circulo.r} disabled={deshabilitado} aria-valuetext={`${Math.round(circulo.r * 2)} píxeles de diámetro`}
          onInput={(e) => setCirculo({ ...circulo, r: Number(e.currentTarget.value) })} /></label>
      <div class="fila-envolver analisis-mover" role="group" aria-label="Mover el círculo">
        <button type="button" class="btn btn-icono" disabled={deshabilitado} aria-label="Mover el círculo a la izquierda" onClick={() => mover(-d, 0)}><Icono n="atras" /></button>
        <button type="button" class="btn btn-icono" disabled={deshabilitado} aria-label="Mover el círculo arriba" onClick={() => mover(0, -d)}><Icono n="arriba" /></button>
        <button type="button" class="btn btn-icono" disabled={deshabilitado} aria-label="Mover el círculo abajo" onClick={() => mover(0, d)}><Icono n="abajo" /></button>
        <button type="button" class="btn btn-icono" disabled={deshabilitado} aria-label="Mover el círculo a la derecha" onClick={() => mover(d, 0)}><Icono n="derecha" /></button>
      </div>
    </div>
  );
}

function Progreso({ texto, valor, cancelar }) {
  const pct = Math.round(Math.max(0, Math.min(1, valor)) * 100);
  return (
    <div class="analisis-progreso" role="status">
      <progress max="100" value={pct} aria-label={texto} />
      <span class="mini num">{texto}… {pct} %</span>
      <button type="button" class="btn btn-peq" onClick={cancelar}>Cancelar</button>
    </div>
  );
}

function Calibrar({ cal, discoCm, setDiscoCm, circulo, usarCirculo, dosToques, fase, cancelar }) {
  const otro = !DISCOS_CM.includes(discoCm);
  const [texto, setTexto] = useState(otro ? String(discoCm).replace('.', ',') : '');
  const idD = useId();
  return (
    <div class="campo analisis-calibrar">
      <span class="etq" id={idD}>Calibrar con el disco</span>
      <div class="segmentos analisis-discos" role="group" aria-labelledby={idD}>
        {DISCOS_CM.map((cm) => <button key={cm} type="button" aria-pressed={discoCm === cm ? 'true' : 'false'} onClick={() => setDiscoCm(cm)}>{cm} cm</button>)}
        <button type="button" aria-pressed={otro ? 'true' : 'false'} onClick={() => setDiscoCm(Number(texto.replace(',', '.')) || 30)}>Otro</button>
      </div>
      {otro && (
        <label class="campo-linea"><span class="mini">Diámetro real (cm)</span>
          <input class="entrada analisis-cm" type="text" inputMode="decimal" value={texto} onInput={(e) => { setTexto(e.currentTarget.value); const n = Number(e.currentTarget.value.replace(',', '.')); if (n >= 10 && n <= 60) setDiscoCm(n); }} /></label>
      )}
      <div class="fila-envolver">
        {circulo && <button type="button" class="btn btn-peq" disabled={!!fase} onClick={usarCirculo}>Usar el círculo</button>}
        <button type="button" class="btn btn-peq" disabled={!!fase} onClick={dosToques}>Marcar el diámetro con dos toques</button>
        {fase === 'toques' && <button type="button" class="btn btn-peq plano" onClick={cancelar}>Cancelar</button>}
      </div>
      <span class="ayuda" role="status">{fase === 'toques' ? 'Toca los dos bordes del disco, de lado a lado.' : cal ? `Calibrado: disco de ${String(cal.cm).replace('.', ',')} cm = ${Math.round(cal.px)} px del vídeo.` : 'Sin calibrar: se ven las repeticiones y lo que dura cada subida; para la velocidad en m/s, calibra con el disco (el estándar mide 45 cm).'}</span>
    </div>
  );
}

// La tabla de la velocidad (y su gráfica): cada repetición, la mejor y la pérdida de velocidad
export function TablaVelocidad({ reps, resumen, conVel, ir }) {
  if (!reps.length) return <p class="peq secundario">No salen repeticiones claras en la trayectoria (¿se ha seguido bien el disco?).</p>;
  return (
    <div class="pila-s">
      <table class="tabla-tempo tabla-velocidad">
        <caption class="sr">{conVel ? 'Cada repetición: velocidad media y pico de la subida (m/s), lo que dura la subida (s) y el recorrido (cm)' : 'Cada repetición: lo que dura la subida (s)'}</caption>
        <thead><tr><th scope="col">Rep.</th>{conVel && <><th scope="col">Media</th><th scope="col">Pico</th></>}<th scope="col">Subida</th>{conVel && <th scope="col">ROM</th>}</tr></thead>
        <tbody>
          {reps.map((r, i) => (
            <tr key={i} class={resumen?.mejor === i ? 'mejor' : ''}>
              <th scope="row"><button type="button" class="btn-texto num" onClick={() => ir?.(r.t[0])} aria-label={`Ir a la repetición ${i + 1}`}>{i + 1}</button></th>
              {conVel && <><td class="num">{r.vm != null ? String(r.vm.toFixed(2)).replace('.', ',') : '—'}</td><td class="num">{r.vp != null ? String(r.vp.toFixed(2)).replace('.', ',') : '—'}</td></>}
              <td class="num">{r.dc != null ? String(r.dc.toFixed(2)).replace('.', ',') : '—'}</td>
              {conVel && <td class="num">{r.rom != null ? Math.round(r.rom) : '—'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {conVel && <span class="mini terciario">Media y pico en m/s; subida en s; ROM (recorrido) en cm.</span>}
      {conVel && resumen && (
        <>
          <GraficaReps reps={reps} mejor={resumen.mejor} />
          <p class="peq analisis-resumen"><strong>Mejor: la {resumen.mejor + 1}.ª ({textoVel(resumen.vmMejor)})</strong>{reps.length > 1 && resumen.perdidaMejor != null ? <> · Pérdida de velocidad: {textoPct(resumen.perdidaMejor)} de la mejor a la última{resumen.perdidaPrimera != null && resumen.perdidaPrimera !== resumen.perdidaMejor ? ` (${textoPct(resumen.perdidaPrimera)} desde la primera)` : ''}</> : null}</p>
        </>
      )}
    </div>
  );
}
// Una barra por repetición (la mejor, resaltada), como las gráficas de la app
function GraficaReps({ reps, mejor }) {
  const W = 300, H = 96, abj = 16, arr = 14;
  const vs = reps.map((r) => r.vm ?? 0);
  const max = Math.max(0.1, ...vs);
  const paso = W / Math.max(1, vs.length), ancho = Math.min(36, paso * 0.62);
  const resumen = `Velocidad media de cada repetición: ${vs.map((v, i) => `${i + 1}.ª, ${textoVel(v)}`).join('; ')}.`;
  return (
    <svg class="grafica grafica-carga grafica-reps" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={resumen}>
      {vs.map((v, i) => {
        const h = ((H - abj - arr) * v) / max, x = i * paso + (paso - ancho) / 2, y = H - abj - h;
        return (
          <g key={i}>
            <rect class={`barra ${i === mejor ? 'ultima' : ''}`} x={x} y={y} width={ancho} height={Math.max(1, h)} rx="3" />
            {vs.length <= 12 && <text class="valor-barra" x={x + ancho / 2} y={y - 3} text-anchor="middle">{String(v.toFixed(2)).replace('.', ',')}</text>}
            <text x={x + ancho / 2} y={H - 3} text-anchor="middle">{i + 1}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Los ángulos del fotograma en el que está el vídeo, y el lado
function AngulosAhora({ pose, t, setLado }) {
  const f = poseEn(pose.fotos, t);
  const g = f ? angulosDe(f.kp, pose.lado, pose.w, pose.h) : null;
  const idL = useId();
  return (
    <div class="pila-xs">
      <div class="fila-envolver">
        <span class="etq" id={idL}>Lado</span>
        <div class="segmentos analisis-lado" role="group" aria-labelledby={idL}>
          <button type="button" aria-pressed={pose.lado === 'izq' ? 'true' : 'false'} onClick={() => setLado('izq')}>Izquierdo</button>
          <button type="button" aria-pressed={pose.lado === 'der' ? 'true' : 'false'} onClick={() => setLado('der')}>Derecho</button>
        </div>
      </div>
      <p class="peq num analisis-angulos" role="status">{g ? <>En el {textoMomento(t, true)}: rodilla {textoGrados(g.rodilla)} · cadera {textoGrados(g.cadera)} · tronco {textoGrados(g.tronco)} (de la vertical) · codo {textoGrados(g.codo)}</> : `En el ${textoMomento(t, true)} no se ven los puntos del cuerpo.`}</p>
    </div>
  );
}
export function TablaPose({ reps, codo, ir }) {
  return (
    <table class="tabla-tempo tabla-pose">
      <caption class="sr">Por repetición: el ángulo mínimo de la rodilla (la profundidad), la inclinación máxima del tronco{codo ? ' y el ángulo mínimo del codo' : ''}, en grados</caption>
      <thead><tr><th scope="col">Rep.</th><th scope="col">Rodilla mín.</th><th scope="col">Tronco máx.</th>{codo && <th scope="col">Codo mín.</th>}</tr></thead>
      <tbody>
        {reps.map((r, i) => (
          <tr key={i}>
            <th scope="row">{ir ? <button type="button" class="btn-texto num" onClick={() => ir(r.t[0])} aria-label={`Ir a la repetición ${i + 1}`}>{i + 1}</button> : <span class="num">{i + 1}</span>}</th>
            <td class="num">{textoGrados(r.rodilla)}</td><td class="num">{textoGrados(r.tronco)}</td>{codo && <td class="num">{textoGrados(r.codo)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Lo guardado en la corrección, para el atleta (y el coach): la trayectoria encima del vídeo, la velocidad y los ángulos
export function VerAnalisis({ video, analisis }) {
  const id = video.id;
  const rep = () => reproductorDe(id);
  const puntos = analisis?.barra?.p || [];
  const fases = useMemo(() => fasesTrayectoria(puntos), [analisis]);
  const desvio = useMemo(() => desvioHorizontal(puntos, analisis?.cal || null), [analisis]);
  useEffect(() => {
    if (puntos.length < 2) return undefined;
    const estado = { barra: { puntos, fases, x0: puntos[0][1] } };
    ponerCapa(id, (a) => <CapaAnalisis {...a} estado={estado} />);
    return () => ponerCapa(id, null);
  }, [id, analisis]);
  const reps = analisis?.reps || [];
  const conVel = reps.some((r) => r.vm != null);
  return (
    <div class="pila-s">
      {puntos.length > 1 && <p class="mini secundario analisis-leyenda"><span class="punto-fase baja" aria-hidden="true" /> bajada <span class="punto-fase sube" aria-hidden="true" /> subida: la trayectoria de la barra va encima del vídeo.{desvio?.unidad === 'cm' ? ` Se separa de la vertical hasta ${textoCm(desvio.izq)} a la izquierda y ${textoCm(desvio.der)} a la derecha.` : ''}</p>}
      {reps.length > 0 && <TablaVelocidad reps={reps} resumen={resumenSerie(reps)} conVel={conVel} ir={(t) => rep()?.ir(t)} />}
      {analisis?.pose?.reps?.length > 0 && (<><span class="etq">Ángulos por repetición ({analisis.pose.lado === 'der' ? 'lado derecho' : 'lado izquierdo'})</span><TablaPose reps={analisis.pose.reps} codo={analisis.pose.reps.some((r) => r.codo != null)} ir={(t) => rep()?.ir(t)} /></>)}
      <p class="mini terciario analisis-aviso">{AVISO_EXPERIMENTAL}</p>
    </div>
  );
}
