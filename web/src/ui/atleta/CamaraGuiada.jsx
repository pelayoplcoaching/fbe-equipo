// Fotos de progreso guiadas (como ProgressCam): la foto anterior de la misma pose en transparencia para
// encuadrar igual, cuenta atrás con pitidos para hacérsela solo y la foto recortada a 3:4, como se ve.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, Icono, Hoja, Segmentos, usePreferencia, useAtraparFoco } from '../comunes.jsx';
import { LIMITE_ARCHIVO_MB } from '../../datos/api.js';
import { prepararAudio, tono, vibrarCorto } from './sesion-comun.jsx';
import { fmtCorta, hoyISO } from '../../logica/fechas.js';

export const POSES = [['frente', 'Frente'], ['perfil', 'Perfil'], ['espalda', 'Espalda']];
const NOMBRE_POSE = Object.fromEntries(POSES);

// La última foto de esa pose (para la guía)
const ultimaDe = (fotos, pose) => [...fotos].filter((f) => f.pose === pose).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : (a.creado_en < b.creado_en ? 1 : -1)))[0] || null;

// Hoja para añadir una foto: elegir la pose y hacerla con guía o elegirla de la galería
export function NuevaFoto({ fotos, alCerrar, alSubir }) {
  const { api, atleta, aviso } = useApp();
  const [pose, setPose] = useState(() => POSES.map(([p]) => p).find((p) => !fotos.some((f) => f.pose === p && f.fecha === hoyISO())) || 'frente');
  const [camara, setCamara] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [vista, setVista] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const input = useRef(null);
  const puedeCamara = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  useEffect(() => () => { if (vista) URL.revokeObjectURL(vista); }, [vista]);
  const elegir = (f) => {
    if (!f) return;
    if (f.size > LIMITE_ARCHIVO_MB * 1024 * 1024) { aviso(`Pesa más de ${LIMITE_ARCHIVO_MB} MB.`, 'error'); return; }
    setArchivo(f);
    try { setVista(URL.createObjectURL(f)); } catch { setVista(null); }
  };
  const subir = async () => {
    setSubiendo(true);
    try {
      const a = await api.subirArchivo(atleta.id, archivo, { tipo: 'foto_progreso', pose });
      aviso(`Foto de ${NOMBRE_POSE[pose].toLowerCase()} guardada`);
      alSubir?.(a);
      setArchivo(null);
      // La siguiente pose que falte hoy, para hacer las tres seguidas
      const sig = POSES.map(([p]) => p).find((p) => p !== pose && !fotos.some((f) => f.pose === p && f.fecha === hoyISO()));
      if (sig) setPose(sig); else alCerrar();
    } catch (e) { aviso(e.message, 'error'); } finally { setSubiendo(false); }
  };
  const guia = ultimaDe(fotos, pose);
  if (camara) {
    return <CamaraGuiada pose={pose} guia={guia} alCerrar={() => setCamara(false)}
      alCapturar={(blob) => { setCamara(false); elegir(new File([blob], `foto-${pose}.jpg`, { type: 'image/jpeg' })); }} />;
  }
  return (
    <Hoja titulo={archivo ? `Foto de ${NOMBRE_POSE[pose].toLowerCase()}` : 'Nueva foto de progreso'} alCerrar={() => !subiendo && alCerrar()}>
      {archivo ? (
        <>
          {vista && <img class="medio" src={vista} alt={`Vista previa: ${NOMBRE_POSE[pose].toLowerCase()}`} />}
          <p class="mini terciario">Se guarda en tu carpeta privada: solo la veis tú y tu coach.</p>
          <div class="fila-envolver">
            <button class="btn btn-primario btn-grande" disabled={subiendo} onClick={subir}>{subiendo ? 'Subiendo…' : 'Guardar foto'}</button>
            <button class="btn" disabled={subiendo} onClick={() => setArchivo(null)}>Repetir</button>
          </div>
        </>
      ) : (
        <>
          <div class="campo">
            <span class="etq">Pose</span>
            <Segmentos etiqueta="Pose" valor={pose} alCambiar={(v) => v && setPose(v)} opciones={POSES.map(([p, t]) => [p, `${t}${fotos.some((f) => f.pose === p && f.fecha === hoyISO()) ? ' ✓' : ''}`])} />
            <span class="ayuda">{guia ? `Verás tu foto de ${NOMBRE_POSE[pose].toLowerCase()} del ${fmtCorta(guia.fecha)} en transparencia para colocarte igual.` : 'Misma luz, misma ropa y a la misma distancia cada vez: así se ve el cambio de verdad.'}</span>
          </div>
          {puedeCamara && <button class="btn btn-primario btn-grande" onClick={() => { prepararAudio(); setCamara(true); }}><Icono n="camara" /> Hacer la foto con guía</button>}
          <button class="btn btn-grande" onClick={() => input.current?.click()}><Icono n="imagen" /> Elegir de la galería</button>
          <input ref={input} type="file" accept="image/*" hidden aria-label="Elegir foto" onChange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ''; elegir(f); }} />
        </>
      )}
    </Hoja>
  );
}

export function CamaraGuiada({ pose, guia, alCerrar, alCapturar }) {
  const { api } = useApp();
  const video = useRef(null);
  const marco = useRef(null);
  const raiz = useRef(null);
  useAtraparFoco(raiz);
  const [frontal, setFrontal] = useState(true);
  const [error, setError] = useState(null);
  const [lista, setLista] = useState(false);
  const [urlGuia, setUrlGuia] = useState(null);
  const [opacidad, setOpacidad] = usePreferencia('fbe-camara-opacidad', 35);
  const [espera, setEspera] = usePreferencia('fbe-camara-espera', 10);
  const [cuenta, setCuenta] = useState(null);
  const [foto, setFoto] = useState(null); // { blob, url }
  const temporizador = useRef(null);

  // La foto anterior de esta pose, para la guía
  useEffect(() => {
    let vivo = true;
    if (guia) api.urlArchivo(guia.ruta).then((u) => vivo && setUrlGuia(u)).catch(() => {});
    return () => { vivo = false; };
  }, [guia?.id]);

  // La cámara: se abre al entrar y al girarla; se apaga al salir
  useEffect(() => {
    let flujo = null, vivo = true;
    setLista(false); setError(null);
    navigator.mediaDevices.getUserMedia({ video: { facingMode: frontal ? 'user' : 'environment', width: { ideal: 1440 }, height: { ideal: 1920 } }, audio: false })
      .then((s) => {
        if (!vivo) { s.getTracks().forEach((t) => t.stop()); return; }
        flujo = s;
        if (video.current) { video.current.srcObject = s; video.current.play?.().catch(() => {}); }
      })
      .catch((e) => vivo && setError(e?.name === 'NotAllowedError' ? 'No has dado permiso para usar la cámara. Puedes darlo en los ajustes del navegador o elegir una foto de la galería.' : 'No se puede abrir la cámara en este dispositivo. Elige una foto de la galería.'));
    return () => { vivo = false; flujo?.getTracks().forEach((t) => t.stop()); };
  }, [frontal]);

  // Escape cierra; la página de detrás no se mueve; la pantalla no se apaga mientras está abierta
  useEffect(() => {
    const previo = document.activeElement;
    const tecla = (e) => { if (e.key === 'Escape') { e.preventDefault(); cancelar(); alCerrar(); } };
    document.addEventListener('keydown', tecla);
    const cuerpo = document.body;
    cuerpo.dataset.hojas = String(Number(cuerpo.dataset.hojas || 0) + 1); cuerpo.style.overflow = 'hidden';
    let candado = null;
    navigator.wakeLock?.request('screen').then((c) => { candado = c; }).catch(() => {});
    marco.current?.closest('.camara')?.querySelector('.camara-cerrar')?.focus();
    return () => {
      document.removeEventListener('keydown', tecla);
      const quedan = Math.max(0, Number(cuerpo.dataset.hojas || 1) - 1);
      if (quedan) cuerpo.dataset.hojas = String(quedan); else { delete cuerpo.dataset.hojas; cuerpo.style.overflow = ''; }
      try { candado?.release(); } catch { /* */ }
      clearInterval(temporizador.current);
      if (previo?.isConnected) previo.focus?.();
    };
  }, []);
  useEffect(() => () => { if (foto?.url) URL.revokeObjectURL(foto.url); }, [foto?.url]);

  const cancelar = () => { clearInterval(temporizador.current); temporizador.current = null; setCuenta(null); };

  // La foto, recortada a 3:4 desde el centro (lo mismo que se ve en el marco) y sin el efecto espejo
  const capturar = () => {
    const v = video.current;
    if (!v?.videoWidth) return;
    const ancho = v.videoWidth, alto = v.videoHeight, objetivo = 3 / 4;
    let sw = ancho, sh = alto;
    if (ancho / alto > objetivo) sw = Math.round(alto * objetivo); else sh = Math.round(ancho / objetivo);
    const sx = Math.round((ancho - sw) / 2), sy = Math.round((alto - sh) / 2);
    const escala = Math.min(1, 1600 / sh);
    const c = document.createElement('canvas');
    c.width = Math.round(sw * escala); c.height = Math.round(sh * escala);
    c.getContext('2d').drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
    c.toBlob((blob) => { if (blob) setFoto({ blob, url: URL.createObjectURL(blob) }); }, 'image/jpeg', 0.88);
    tono(1320, 0.12, 0.25); vibrarCorto(60);
  };
  const disparar = () => {
    if (!espera) { capturar(); return; }
    let n = espera;
    setCuenta(n); tono(880, 0.08);
    temporizador.current = setInterval(() => {
      n -= 1;
      if (n <= 0) { cancelar(); capturar(); return; }
      setCuenta(n);
      tono(n <= 3 ? 1100 : 880, n <= 3 ? 0.12 : 0.06, n <= 3 ? 0.25 : 0.15);
    }, 1000);
  };

  return (
    <div ref={raiz} class="camara" role="dialog" aria-modal="true" aria-label={`Foto de progreso: ${NOMBRE_POSE[pose].toLowerCase()}`}>
      <div class="camara-cab">
        <button class="btn btn-icono plano camara-cerrar" aria-label="Cerrar la cámara" onClick={() => { cancelar(); alCerrar(); }}><Icono n="cerrar" /></button>
        <strong>{NOMBRE_POSE[pose]}</strong>
        {!foto ? <button class="btn btn-icono plano" aria-label={frontal ? 'Usar la cámara de atrás' : 'Usar la cámara de delante'} onClick={() => { cancelar(); setFrontal(!frontal); }}><Icono n="girar" /></button> : <span style="width:44px" />}
      </div>
      <div class={`camara-marco ${frontal ? 'espejo' : ''}`} ref={marco}>
        {/* El vídeo no se desmonta al ver la foto: así «Repetir» vuelve a la cámara, que sigue abierta */}
        <video ref={video} playsInline muted autoPlay onLoadedMetadata={() => setLista(true)} aria-hidden="true" />
        {!foto && (
          <>
            {urlGuia && <img class="camara-guia" src={urlGuia} alt="" aria-hidden="true" style={{ opacity: opacidad / 100 }} />}
            <span class="camara-lineas" aria-hidden="true"><i /><i /><i /></span>
            {cuenta != null && <span class="camara-cuenta num" role="timer" aria-live="assertive">{cuenta}</span>}
            {error && <div class="camara-error" role="alert"><p>{error}</p><button class="btn" onClick={alCerrar}>Elegir de la galería</button></div>}
            {!lista && !error && <span class="camara-espera">Abriendo la cámara…</span>}
          </>
        )}
        {foto && <img class="camara-foto" src={foto.url} alt="La foto que acabas de hacer" />}
      </div>
      <div class="camara-pie">
        {foto ? (
          <div class="fila-envolver camara-decidir">
            <button class="btn btn-grande" onClick={() => setFoto(null)}><Icono n="reiniciar" /> Repetir</button>
            <button class="btn btn-primario btn-grande" onClick={() => alCapturar(foto.blob)}><Icono n="hecho" /> Usar esta foto</button>
          </div>
        ) : (
          <>
            {urlGuia && (
              <label class="camara-opacidad">
                <span class="mini">Foto del {fmtCorta(guia.fecha)}</span>
                <input type="range" min="0" max="70" step="5" value={opacidad} onInput={(e) => setOpacidad(Number(e.currentTarget.value))} aria-label="Transparencia de la foto anterior" aria-valuetext={`${opacidad} %`} />
              </label>
            )}
            <div class="camara-controles">
              <Segmentos etiqueta="Cuenta atrás" clase="camara-espera-seg" valor={espera} alCambiar={(v) => setEspera(v ?? 0)} opciones={[[0, 'Ya'], [3, '3 s'], [10, '10 s']]} />
              <button class={`camara-disparo ${cuenta != null ? 'contando' : ''}`} disabled={!lista || !!error} onClick={() => (cuenta != null ? cancelar() : disparar())}
                aria-label={cuenta != null ? 'Cancelar la cuenta atrás' : espera ? `Hacer la foto en ${espera} segundos` : 'Hacer la foto'}>
                <span />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
