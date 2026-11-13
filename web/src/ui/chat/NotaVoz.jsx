import { useEffect, useRef, useState } from 'preact/hooks';
import { Icono, useApp } from '../comunes.jsx';
import { sonarFBE } from '../sonido.js';
import {
  LIMITE_VOZ_SEG, textoContador, quedaPoco, segundosRestantes, alLimite, formatoGrabacion, ondaDe, gestoVoz, PULSACION_CORTA_MS,
  siguienteVelocidad, textoVelocidad, errorMicro, mmss, duracionGuardada, MIN_VOZ_SEG,
} from '../../logica/notasVoz.js';

// Las notas de voz del chat (v0.56), como WhatsApp, pero de UN minuto como mucho (lo pide el coach): el contador dice
// «0:42 / 1:00», avisa en los últimos 10 segundos y al minuto se para sola (lo grabado se queda, para escucharlo y
// enviarlo). Mantener pulsado el micro graba; deslizar a la izquierda cancela; hacia arriba la deja grabando sin el dedo.
// Tocarlo (o Enter/Espacio con el teclado) también empieza, sin mantenerlo, y se para con «Parar». Siempre se escucha
// antes de enviarla (o se borra). El micro se suelta en cuanto se para (no se queda encendido).
// El reloj se puede cambiar en las pruebas (window.__fbeRelojVoz): así se prueba el minuto sin esperarlo.
const reloj = () => (typeof globalThis.__fbeRelojVoz === 'function' ? globalThis.__fbeRelojVoz() : performance.now());

export function puedeGrabar() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof globalThis.MediaRecorder === 'function'
    && !!formatoGrabacion((t) => globalThis.MediaRecorder.isTypeSupported?.(t));
}

// La grabación: estado 'nada' | 'pidiendo' | 'grabando' | 'revisar' y lo grabado ({ blob, tipo, ext, seg, onda, limite })
export function useGrabadora({ alError }) {
  const [estado, setEstado] = useState('nada');
  const [seg, setSeg] = useState(0);
  const [bloqueada, setBloqueada] = useState(false);
  const [grabado, setGrabado] = useState(null);
  const r = useRef({});
  const soltarMicro = () => {
    const x = r.current;
    clearInterval(x.tic);
    try { x.stream?.getTracks().forEach((t) => t.stop()); } catch { /* */ }
    try { x.ctx?.close(); } catch { /* */ }
    x.stream = null; x.ctx = null; x.analizador = null;
  };
  useEffect(() => () => { r.current.cancelada = true; try { r.current.rec?.state !== 'inactive' && r.current.rec?.stop(); } catch { /* */ } soltarMicro(); }, []);

  async function empezar({ manos = false } = {}) {
    if (estado !== 'nada') return;
    if (!puedeGrabar()) { alError(errorMicro({ name: 'NoSoportado' })); return; }
    setEstado('pidiendo'); setBloqueada(manos); setSeg(0); setGrabado(null);
    const x = r.current = { cancelada: false, trozos: [], niveles: [] };
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch (e) { setEstado('nada'); alError(errorMicro(e)); return; }
    if (x.cancelada) { stream.getTracks().forEach((t) => t.stop()); setEstado('nada'); return; }
    x.stream = stream;
    const f = formatoGrabacion((t) => globalThis.MediaRecorder.isTypeSupported(t));
    let rec;
    try { rec = new globalThis.MediaRecorder(stream, { mimeType: f.grabar, audioBitsPerSecond: 32000 }); } catch (e) { soltarMicro(); setEstado('nada'); alError(errorMicro(e)); return; }
    x.rec = rec; x.formato = f;
    // Los niveles, para la forma de onda (si no hay WebAudio, plana)
    try {
      const C = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (C) { x.ctx = new C(); const fuente = x.ctx.createMediaStreamSource(stream); x.analizador = x.ctx.createAnalyser(); x.analizador.fftSize = 512; fuente.connect(x.analizador); x.buf = new Uint8Array(x.analizador.fftSize); }
    } catch { x.analizador = null; }
    rec.ondataavailable = (ev) => { if (ev.data?.size) x.trozos.push(ev.data); };
    rec.onstop = () => {
      soltarMicro();
      if (x.cancelada) { setEstado('nada'); return; }
      const s = Math.min(LIMITE_VOZ_SEG, x.seg || 0);
      if (s < MIN_VOZ_SEG - 0.4 || !x.trozos.length) { setEstado('nada'); alError('Muy corta: mantén pulsado el micro mientras hablas (o tócalo y habla).'); return; }
      const blob = new Blob(x.trozos, { type: f.tipo });
      setGrabado({ blob, tipo: f.tipo, ext: f.ext, seg: duracionGuardada(s), onda: ondaDe(x.niveles, 40), limite: !!x.limite });
      setEstado('revisar');
      sonarFBE('nota-acaba');   // (sonido 2, tanda 7) como en WhatsApp
    };
    // (si el navegador no deja empezar, el micro se suelta y se dice)
    try { rec.start(250); } catch (e) { soltarMicro(); setEstado('nada'); alError(errorMicro(e)); return; }
    x.inicio = reloj();
    setEstado('grabando');
    sonarFBE('nota-empieza');   // (sonido 2, tanda 7)
    x.tic = setInterval(() => {
      const s = (reloj() - x.inicio) / 1000;
      x.seg = s;
      if (x.analizador) {
        x.analizador.getByteTimeDomainData(x.buf);
        let suma = 0;
        for (const v of x.buf) { const d = (v - 128) / 128; suma += d * d; }
        x.niveles.push(Math.min(1, Math.sqrt(suma / x.buf.length) * 3));
      } else x.niveles.push(0);
      setSeg(s);
      // Al minuto, se para sola (y lo grabado se queda)
      if (alLimite(s)) { x.seg = LIMITE_VOZ_SEG; x.limite = true; parar(); }
    }, 100);
  }
  function parar() {
    const x = r.current;
    clearInterval(x.tic);
    try { if (x.rec && x.rec.state !== 'inactive') x.rec.stop(); else soltarMicro(); } catch { soltarMicro(); }
  }
  function cancelar() {
    const x = r.current;
    x.cancelada = true;
    clearInterval(x.tic);
    try { if (x.rec && x.rec.state !== 'inactive') x.rec.stop(); } catch { /* */ }
    soltarMicro();
    setEstado('nada'); setGrabado(null); setSeg(0); setBloqueada(false);
  }
  const descartar = () => { setGrabado(null); setEstado('nada'); setSeg(0); setBloqueada(false); };
  return { estado, seg, bloqueada, setBloqueada, grabado, empezar, parar, cancelar, descartar };
}

// El botón del micro (con el cuadro vacío, donde va «Enviar»): mantener, deslizar, o tocar
export function BotonMicro({ g, disabled = false }) {
  const p = useRef(null);
  const abajo = (e) => {
    if (disabled || e.button > 0 || g.estado !== 'nada') return;
    e.preventDefault();
    p.current = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, gesto: null };
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* */ }
    g.empezar({ manos: false });
  };
  const mover = (e) => {
    const x = p.current;
    if (!x || g.bloqueada) return;
    const gesto = gestoVoz(e.clientX - x.x, e.clientY - x.y);
    if (gesto === 'cancelar') { p.current = null; g.cancelar(); }
    else if (gesto === 'bloquear') { p.current = null; g.setBloqueada(true); }
    else document.documentElement.style.setProperty('--voz-dx', `${Math.min(0, e.clientX - x.x)}px`);
  };
  const arriba = () => {
    const x = p.current;
    p.current = null;
    document.documentElement.style.removeProperty('--voz-dx');
    if (!x) return;
    // Un toque corto: sigue grabando sin el dedo (se para con «Parar»); si lo mantuvo, al soltar se para y se escucha
    if (performance.now() - x.t < PULSACION_CORTA_MS) g.setBloqueada(true);
    else g.parar();
  };
  // Con el teclado (Enter o Espacio) o un lector de pantalla: empieza sin mantener
  const clic = (e) => { if (e.detail === 0 && g.estado === 'nada' && !disabled) g.empezar({ manos: true }); };
  return (
    <button type="button" class="btn btn-primario btn-icono chat-enviar chat-micro" aria-label="Grabar una nota de voz (hasta 1 minuto)" title="Mantén pulsado para grabar (o toca)"
      disabled={disabled} onPointerDown={abajo} onPointerMove={mover} onPointerUp={arriba} onPointerCancel={() => { p.current = null; if (g.estado !== 'nada') g.cancelar(); }}
      onClick={clic} onContextMenu={(e) => e.preventDefault()}>
      <Icono n="micro" />
    </button>
  );
}

// Mientras graba: el punto rojo, «0:42 / 1:00», el aviso de los últimos 10 s y, sin el dedo, «Eliminar» y «Parar»
export function PanelGrabando({ g }) {
  const poco = quedaPoco(g.seg);
  const restan = segundosRestantes(g.seg);
  // El aviso para el lector de pantalla, una vez (no cada décima)
  const [dicho, setDicho] = useState('');
  useEffect(() => { if (poco && !dicho) setDicho(`Quedan ${restan} segundos: al minuto se para sola`); if (!poco && dicho) setDicho(''); }, [poco]);
  useEffect(() => {
    if (!g.bloqueada) return undefined;
    const tecla = (e) => { if (e.key === 'Escape' && !document.querySelector('[aria-modal="true"]')) { e.preventDefault(); g.cancelar(); } };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [g.bloqueada]);
  const parar = useRef(null);
  useEffect(() => { if (g.bloqueada && g.estado === 'grabando') setTimeout(() => parar.current?.focus(), 0); }, [g.bloqueada, g.estado]);
  return (
    <div class={`chat-grabando ${poco ? 'acaba' : ''} ${g.bloqueada ? 'bloqueada' : ''}`} role="group" aria-label="Grabando una nota de voz">
      <span class="chat-grabando-punto" aria-hidden="true" />
      <span class="chat-grabando-tiempo num" role="timer" aria-label={`Grabando: ${textoContador(g.seg)}`}>{g.estado === 'pidiendo' ? 'Abriendo el micro…' : textoContador(g.seg)}</span>
      <span class="mini chat-grabando-aviso">{poco ? `Quedan ${restan} s · máx. 1 minuto` : g.bloqueada ? 'Máximo 1 minuto' : '‹ Desliza para cancelar · ↑ para no mantener'}</span>
      <span class="sr" aria-live="assertive">{dicho}</span>
      {g.bloqueada && (
        <span class="fila chat-grabando-acciones">
          <button type="button" class="btn btn-icono plano" aria-label="Eliminar la grabación" onClick={g.cancelar}><Icono n="basura" /></button>
          <button type="button" ref={parar} class="btn btn-primario btn-icono" aria-label="Parar y escucharla" onClick={g.parar}><Icono n="parar" /></button>
        </span>
      )}
    </div>
  );
}

// Lo grabado, antes de enviarlo: escucharlo, borrarlo o enviarlo
export function PanelRevisar({ g, alEnviar, enviando = false }) {
  const x = g.grabado;
  const [url, setUrl] = useState(null);
  useEffect(() => { if (!x) return undefined; const u = URL.createObjectURL(x.blob); setUrl(u); return () => URL.revokeObjectURL(u); }, [x]);
  const enviar = useRef(null);
  useEffect(() => { setTimeout(() => enviar.current?.focus(), 0); }, []);
  if (!x) return null;
  return (
    <div class="chat-revisar-voz" role="group" aria-label="Nota de voz grabada">
      <button type="button" class="btn btn-icono plano" aria-label="Eliminar la nota de voz" onClick={g.descartar}><Icono n="basura" /></button>
      <ReproductorVoz url={url} duracion={x.seg} onda={x.onda} propio compacto />
      <button type="button" ref={enviar} class="btn btn-primario btn-icono chat-enviar" aria-label="Enviar la nota de voz" disabled={enviando} onClick={() => alEnviar(x)}><Icono n="enviar" /></button>
      {x.limite && <p class="mini chat-revisar-aviso" role="status">Has llegado al minuto: se ha parado sola. Escúchala y envíala.</p>}
    </div>
  );
}

// El reproductor (en la burbuja y al revisar): ▶/❚❚, la onda con lo escuchado, el tiempo y 1×/1,5×/2×. url: la del
// audio, o pedirUrl() la primera vez que se reproduce (así no se descarga nada hasta que se toca).
export function ReproductorVoz({ url: urlDada = null, pedirUrl = null, duracion = 0, onda = null, propio = false, escuchada = false, alReproducir = null, compacto = false }) {
  const audio = useRef(null);
  const [url, setUrl] = useState(urlDada);
  const [sonando, setSonando] = useState(false);
  const [t, setT] = useState(0);
  const [vel, setVel] = useState(1);
  const [cargando, setCargando] = useState(false);
  const [fallo, setFallo] = useState(false);
  useEffect(() => { if (urlDada) setUrl(urlDada); }, [urlDada]);
  const total = Math.max(1, Number(duracion) || 0);
  const barras = Array.isArray(onda) && onda.length ? onda : Array(32).fill(18);
  async function alternar() {
    const a = audio.current;
    if (sonando) { a?.pause(); return; }
    let u = url;
    if (!u && pedirUrl) {
      setCargando(true); setFallo(false);
      try { u = await pedirUrl(); setUrl(u); } catch { setFallo(true); setCargando(false); return; }
      setCargando(false);
    }
    if (!u) return;
    setTimeout(() => { const b = audio.current; if (!b) return; b.playbackRate = vel; b.play().catch(() => setFallo(true)); }, 0);
  }
  const cambiarVel = () => { const v = siguienteVelocidad(vel); setVel(v); if (audio.current) audio.current.playbackRate = v; };
  const buscar = (e) => { const v = Number(e.currentTarget.value); setT(v); if (audio.current) audio.current.currentTime = v; };
  const hecho = Math.min(1, t / total);
  return (
    <div class={`voz ${propio ? 'propia' : ''} ${compacto ? 'compacta' : ''}`}>
      <button type="button" class="btn btn-icono voz-play" aria-label={sonando ? 'Pausar la nota de voz' : `Escuchar la nota de voz (${mmss(total)})`} onClick={alternar} disabled={cargando}>
        <Icono n={sonando ? 'pausa' : 'play'} />
      </button>
      <span class="voz-cuerpo">
        <span class="voz-onda" aria-hidden="true">
          {barras.map((h, i) => <span key={i} class={(i + 0.5) / barras.length <= hecho ? 'hecha' : ''} style={{ height: `${Math.max(12, h)}%` }} />)}
        </span>
        <input type="range" class="voz-barra" min="0" max={total} step="0.1" value={t} onInput={buscar} aria-label="Posición en la nota de voz" aria-valuetext={`${mmss(t)} de ${mmss(total)}`} />
        <span class="mini num voz-tiempo">{fallo ? 'No se pudo reproducir' : sonando || t > 0 ? mmss(t) : mmss(total)}</span>
      </span>
      <button type="button" class="btn btn-peq voz-vel num" aria-label={`Velocidad: ${textoVelocidad(vel)}. Cambiar`} onClick={cambiarVel}>{textoVelocidad(vel)}</button>
      {!compacto && <span class={`voz-micro ${escuchada ? 'escuchada' : ''}`} title={escuchada ? 'Escuchada' : 'Sin escuchar'}><Icono n="micro" /><span class="sr">{escuchada ? 'Escuchada' : 'Sin escuchar'}</span></span>}
      {url && (
        <audio ref={audio} src={url} preload="metadata" onPlay={() => { setSonando(true); alReproducir?.(); }} onPause={() => setSonando(false)}
          onEnded={() => { setSonando(false); setT(0); if (audio.current) audio.current.currentTime = 0; }} onTimeUpdate={(e) => setT(e.currentTarget.currentTime)} onError={() => setFallo(true)} />
      )}
    </div>
  );
}

// La nota de voz en la burbuja: se descarga al tocar ▶ (con su enlace firmado); a quien la recibe, al reproducirla,
// le cuenta como escuchada (el micro azul del otro lado), si tiene «en línea» activado
export function NotaVozChat({ c, mio, alEscuchada }) {
  const { api } = useApp();
  const a = c.archivo;
  return (
    <ReproductorVoz pedirUrl={() => api.urlArchivo(a.ruta, { tipo: 'audio' })} duracion={a.duracion_seg} onda={a.onda} propio={mio} escuchada={!!c.escuchado_en}
      alReproducir={() => { if (!mio && !c.escuchado_en) api.marcarEscuchado(c.id).then((x) => { if (x) alEscuchada?.(); }); }} />
  );
}
