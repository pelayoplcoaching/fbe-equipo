import { useMarcaPagina } from '../marca-pagina.js';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icono, Hoja, useApp } from '../comunes.jsx';
import { sonarFBE, audioParaMicro } from '../sonido.js';
import { leerAjustes } from '../ajustes.js';
import {
  LIMITE_VOZ_SIN_081, quedaPoco, segundosRestantes, alLimite, formatoGrabacion, ondaDe, ondaViva, gestoVoz, PULSACION_CORTA_MS,
  siguienteVelocidad, textoVelocidad, errorMicro, esPermisoDenegado, ayudaMicro, trasPermiso, siguienteVoz, textoLimite, mmss, duracionGuardada, MIN_VOZ_SEG, VELOCIDADES,
  esSilencio, textoMicro, resultadoPrueba, tipoAudio, opcionesGrabadora,
} from '../../logica/notasVoz.js';

// Las notas de voz del chat (v0.56), como WhatsApp. (v0.179) De hasta DOS minutos (con la migración 081; sin ella, uno) y:
//   · mantener pulsado el micro graba y, al SOLTAR, se envía; deslizar a la izquierda cancela; hacia arriba (el candado) la
//     deja grabando sin el dedo: papelera, pausar y seguir, parar y escucharla, o enviarla;
//   · tocarlo (o Enter/Espacio con el teclado) también empieza, sin mantenerlo;
//   · la primera vez (cuando el sistema pregunta por el micro) no se graba a ciegas: se dice que el micro ya está listo;
//     si está bloqueado, «Cómo activarlo» lo enseña paso a paso para ese aparato;
//   · la onda se ve en vivo; vibra al empezar, al bloquear y al cancelar; la pantalla no se apaga mientras se graba;
//   · si se sale de la app, entra una llamada o el móvil corta el micro, lo grabado no se pierde: queda para escucharlo;
//   · al llegar al límite se para sola (lo grabado se queda, para escucharlo y enviarlo); y lo grabado sin enviar se
//     conserva al cambiar de pantalla.
// El micro se suelta en cuanto se para (no se queda encendido).
// El reloj se puede cambiar en las pruebas (window.__fbeRelojVoz): así se prueba el límite sin esperarlo.
const reloj = () => (typeof globalThis.__fbeRelojVoz === 'function' ? globalThis.__fbeRelojVoz() : performance.now());
const vibrar = (ms = 25) => { try { if (leerAjustes().vibracion) navigator.vibrate?.(ms); } catch { /* */ } };   // ms: milisegundos o un patrón
// Lo grabado y sin enviar, por conversación (se conserva al cambiar de pantalla; no al cerrar la app ni al cerrar sesión)
const borradores = new Map();
// (revisión) Hay navegadores que siguen diciendo «preguntar» después de dar el permiso (no lo recuerdan): si en esta página
// ya se ha conseguido el micro una vez, no se vuelve a tratar como «la primera vez»
let microConcedido = false;
// (v0.180) Y en este aparato: una vez activado, no se vuelve a enseñar la hoja de «Activar el micro» aunque el navegador diga «preguntar»
const CLAVE_MICRO = 'fbe-micro-activado';
const microRecordado = () => { try { return localStorage.getItem(CLAVE_MICRO) === '1'; } catch { return false; } };
const recordarMicro = (si) => { microConcedido = !!si; try { if (si) localStorage.setItem(CLAVE_MICRO, '1'); else localStorage.removeItem(CLAVE_MICRO); } catch { /* */ } try { window.dispatchEvent(new Event('fbe-micro')); } catch { /* */ } };

export function puedeGrabar() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof globalThis.MediaRecorder === 'function'
    && !!formatoGrabacion((t) => globalThis.MediaRecorder.isTypeSupported?.(t));
}
// Lo que dice el navegador del permiso del micro antes de pedirlo ('granted', 'prompt', 'denied') o null si no lo sabe
async function permisoMicro() {
  try { const r = await navigator.permissions?.query?.({ name: 'microphone' }); return r?.state || null; } catch { return null; }
}
// (v0.180) El estado del micro para la app, al día: 'granted' | 'prompt' | 'denied' | null, y si ya se activó en este aparato.
// Se entera solo si el permiso cambia (en los ajustes del móvil) o si se activa desde otra pantalla.
export function useEstadoMicro() {
  const [e, setE] = useState({ estado: null, recordado: microRecordado() });
  useEffect(() => {
    let vivo = true, pr = null;
    const leer = async () => { const estado = await permisoMicro(); if (vivo) setE({ estado, recordado: microRecordado() || microConcedido }); };
    const cambio = () => leer();
    leer();
    (async () => { try { pr = await navigator.permissions?.query?.({ name: 'microphone' }); if (pr && vivo) pr.onchange = cambio; } catch { /* */ } })();
    window.addEventListener('fbe-micro', cambio);
    document.addEventListener('visibilitychange', cambio);
    return () => { vivo = false; if (pr) pr.onchange = null; window.removeEventListener('fbe-micro', cambio); document.removeEventListener('visibilitychange', cambio); };
  }, []);
  return e;
}

// La grabación: estado 'nada' | 'pidiendo' | 'grabando' | 'pausada' | 'revisar' y lo grabado ({ blob, tipo, ext, seg, onda, limite })
export function useGrabadora({ alError, alAviso = null, alAyuda = null, alActivar = null, alEnviar = null, alGrabando = null, limite = LIMITE_VOZ_SIN_081, clave = null }) {
  const [estado, setEstado] = useState(() => (clave && borradores.has(clave) ? 'revisar' : 'nada'));
  const [seg, setSeg] = useState(0);
  const [bloqueada, setBloqueada] = useState(false);
  const [grabado, setGrabado] = useState(() => (clave && borradores.get(clave)) || null);
  const [vivos, setVivos] = useState([]);
  const [recien, setRecien] = useState(false);   // lo de revisar se acaba de grabar (no es un borrador recuperado)
  const r = useRef({});
  const op = useRef({});
  op.current = { alError, alAviso, alAyuda, alActivar, alEnviar, alGrabando, limite, clave };
  const [previa, setPrevia] = useState(null);   // (v0.180) lo grabado hasta la pausa, para escucharlo y seguir
  const guardarBorrador = (g) => { const k = op.current.clave; if (!k) return; if (g) borradores.set(k, g); else borradores.delete(k); };
  const soltarMicro = (x = r.current) => {
    clearInterval(x.tic);
    document.removeEventListener('visibilitychange', x.alOcultar);
    try { x.bloqueo?.release?.().catch?.(() => {}); } catch { /* */ }
    try { x.stream?.getTracks().forEach((t) => { t.onended = null; t.stop(); }); } catch { /* */ }
    if (x.stream) audioParaMicro(false);
    try { x.ctx?.close(); } catch { /* */ }
    x.stream = null; x.ctx = null; x.analizador = null; x.bloqueo = null;
  };
  // Al irse de la pantalla: si aún se pedía el micro, nada; si ya grababa, se para y lo grabado queda de borrador
  useEffect(() => () => {
    const x = r.current;
    x.desmontada = true;
    const grababa = x.rec && x.rec.state !== 'inactive' && !x.cancelada;
    if (!grababa) { x.cancelada = true; soltarMicro(x); return; }
    if (x.desde != null) { x.acum = (x.acum || 0) + (reloj() - x.desde); x.desde = null; }
    if (!x.limite) x.seg = (x.acum || 0) / 1000;
    x.alParar = 'revisar'; x.cortada = x.cortada || 'salida';
    try { x.rec.stop(); } catch { soltarMicro(x); }
  }, []);
  // Los segundos grabados de verdad (sin las pausas)
  const segundos = (x) => ((x.acum || 0) + (x.desde != null ? reloj() - x.desde : 0)) / 1000;

  async function empezar({ manos = false } = {}) {
    if (estado !== 'nada') return;
    if (typeof navigator !== 'undefined' && !navigator.mediaDevices?.getUserMedia && globalThis.isSecureContext === false) { op.current.alError(errorMicro({ name: 'SinContexto' })); return; }
    if (!puedeGrabar()) { op.current.alError(errorMicro({ name: 'NoSoportado' })); return; }
    setEstado('pidiendo'); setBloqueada(manos); setSeg(0); setGrabado(null); setVivos([]);
    const x = r.current = { cancelada: false, trozos: [], niveles: [], dedo: !manos, manos, acum: 0, desde: null, clave: op.current.clave };
    const t0 = performance.now();
    const dicho = await permisoMicro();
    // Ya se activó aquí y el navegador sigue diciendo «preguntar» (no lo recuerda bien): no se sabe, se decide por lo que tarde
    const permiso = dicho === 'denied' ? 'denied' : microConcedido ? 'granted' : dicho === 'prompt' && microRecordado() ? null : dicho;
    if (x.cancelada) { setEstado('nada'); return; }
    // (v0.180) La primera vez en este aparato: en vez del aviso del sistema con el dedo puesto, la hoja «Activar el micro»
    if (permiso === 'prompt' && op.current.alActivar) { setEstado('nada'); setBloqueada(false); op.current.alActivar(); return; }
    // Bloqueado de antes: no se pide (no saldría nada): se enseña cómo activarlo
    if (permiso === 'denied') { setEstado('nada'); setBloqueada(false); if (op.current.alAyuda) op.current.alAyuda(); else op.current.alError(errorMicro({ name: 'NotAllowedError' })); return; }
    let stream;
    audioParaMicro(true);   // (v0.180.2) en el iPhone, el audio en «ambient» no deja abrir el micro
    try {
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } }); }
      // (v0.180.1) si el navegador no acepta esos ajustes (o falla por otra cosa que no sea el permiso), se pide el micro a secas
      catch (e) { if (esPermisoDenegado(e)) throw e; stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    } catch (e) {
      audioParaMicro(false);
      setEstado('nada'); setBloqueada(false);
      if (x.cancelada) return;
      if (esPermisoDenegado(e) && op.current.alAyuda) op.current.alAyuda(); else op.current.alError(errorMicro(e));
      return;
    }
    if (!microConcedido || !microRecordado()) recordarMicro(true);
    if (x.cancelada) { stream.getTracks().forEach((t) => t.stop()); audioParaMicro(false); setEstado('nada'); return; }
    // Acaba de dar el permiso (o lo soltó antes de que llegara el micro): no se graba a ciegas
    const que = trasPermiso({ permiso, tardoMs: performance.now() - t0, dedoPuesto: x.dedo, manos: x.manos });
    if (que !== 'grabar') {
      stream.getTracks().forEach((t) => t.stop()); audioParaMicro(false);
      setEstado('nada'); setBloqueada(false);
      op.current.alAviso?.(que === 'listo' ? 'Micro activado. Ya puedes grabar: mantén pulsado el micro (o tócalo).' : 'Mantén pulsado el micro mientras hablas (o tócalo y habla).');
      return;
    }
    x.stream = stream;
    const f = formatoGrabacion((t) => globalThis.MediaRecorder.isTypeSupported(t));
    let rec;
    // (v0.180.1) si no acepta el formato o los 32 kbps, se prueba sin ellos antes de rendirse
    let fallo = null;
    for (const o of opcionesGrabadora(f.grabar)) { try { rec = new globalThis.MediaRecorder(stream, o); break; } catch (e) { fallo = e; } }
    if (!rec) { soltarMicro(x); setEstado('nada'); op.current.alError(errorMicro(fallo)); return; }
    // El formato de verdad es el que diga la grabadora (si lo eligió ella)
    const real = tipoAudio(rec.mimeType);
    if (real) { f.tipo = real.tipo; f.ext = real.ext; }
    x.rec = rec; x.formato = f;
    // Los niveles, para la forma de onda (si no hay WebAudio, plana)
    try {
      const C = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (C) { x.ctx = new C(); x.ctx.resume?.().catch?.(() => {}); const fuente = x.ctx.createMediaStreamSource(stream); x.analizador = x.ctx.createAnalyser(); x.analizador.fftSize = 512; fuente.connect(x.analizador); x.buf = new Uint8Array(x.analizador.fftSize); x.conNivel = true; }
    } catch { x.analizador = null; }
    rec.ondataavailable = (ev) => { if (ev.data?.size) x.trozos.push(ev.data); };
    rec.onstop = () => {
      const s = Math.min(op.current.limite, x.seg || 0);
      soltarMicro(x);
      const esta = r.current === x && !x.desmontada;   // (revisión) una grabación vieja no toca la pantalla de la nueva
      if (x.cancelada) { if (esta) setEstado('nada'); return; }
      if (esta) setBloqueada(false);
      if (s < MIN_VOZ_SEG - 0.4 || !x.trozos.length) { if (esta) { setEstado('nada'); op.current.alAviso?.('Mantén pulsado el micro mientras hablas (o tócalo y habla).'); } return; }
      const blob = new Blob(x.trozos, { type: f.tipo });
      // (v0.180) no se oye nada (micro tapado o silenciado): no sale sola, se avisa
      const mudo = !!x.conNivel && esSilencio(x.niveles);
      const g = { blob, tipo: f.tipo, ext: f.ext, seg: duracionGuardada(s, op.current.limite), onda: ondaDe(x.niveles, 40), limite: !!x.limite, cortada: x.cortada || null, tope: op.current.limite, mudo };
      // Se fue de la pantalla grabando: queda de borrador (se verá al volver)
      if (x.desmontada) { if (x.clave) borradores.set(x.clave, g); return; }
      if (!esta) return;
      sonarFBE('nota-acaba');   // (sonido 2, tanda 7) como en WhatsApp
      // Al soltar (o con «Enviar»), sale ya; si se paró sola, la cortó el móvil o se pidió escucharla, se revisa
      if (x.alParar === 'enviar' && !x.limite && !x.cortada && !mudo && !leerAjustes().vozRevisar && op.current.alEnviar) { setGrabado(null); setEstado('nada'); setSeg(0); op.current.alEnviar(g); return; }
      setGrabado(g); guardarBorrador(g); setRecien(true);
      setEstado('revisar');
    };
    // El móvil corta el micro (una llamada, otro uso): lo grabado se queda
    rec.onerror = () => { if (r.current === x) { x.cortada = 'micro'; parar(); } };
    stream.getTracks().forEach((t) => { t.onended = () => { if (r.current === x && x.rec?.state !== 'inactive') { x.cortada = 'micro'; parar(); } }; });
    // (si el navegador no deja empezar, el micro se suelta y se dice)
    try { rec.start(250); } catch (e0) { try { rec.start(); } catch (e) { soltarMicro(x); setEstado('nada'); op.current.alError(errorMicro(e)); return; } }
    x.desde = reloj();
    setEstado('grabando');
    try { sonandoAhora?.pause(); } catch { /* */ }   // (v0.180) lo que estuviera sonando se calla
    op.current.alGrabando?.();
    sonarFBE('nota-empieza');   // (sonido 2, tanda 7)
    vibrar();
    // La pantalla, encendida mientras se graba; y si se sale de la app, se para y lo grabado se queda
    try { navigator.wakeLock?.request('screen').then((b) => { if (x.stream) x.bloqueo = b; else b.release().catch(() => {}); }).catch(() => {}); } catch { /* */ }
    x.alOcultar = () => { if (r.current === x && document.visibilityState === 'hidden' && x.rec?.state !== 'inactive') { x.cortada = 'salida'; parar(); } };
    document.addEventListener('visibilitychange', x.alOcultar);
    x.tic = setInterval(() => {
      if (r.current !== x) { clearInterval(x.tic); return; }
      if (x.desde == null) return;   // en pausa
      const s = segundos(x);
      x.seg = s;
      if (x.analizador) {
        x.analizador.getByteTimeDomainData(x.buf);
        let suma = 0;
        for (const v of x.buf) { const d = (v - 128) / 128; suma += d * d; }
        x.niveles.push(Math.min(1, Math.sqrt(suma / x.buf.length) * 3));
      } else x.niveles.push(0);
      setSeg(s); setVivos(ondaViva(x.niveles, 28));
      op.current.alGrabando?.();   // «grabando audio…» para la otra parte (el canal ya lo espacia)
      // (v0.180) a 10 s del final, un toque
      if (!x.avisado && quedaPoco(s, op.current.limite)) { x.avisado = true; vibrar([30, 60, 30]); }
      // Al llegar al límite, se para sola (y lo grabado se queda)
      if (alLimite(s, op.current.limite)) { x.seg = op.current.limite; x.limite = true; vibrar(60); parar(); }
    }, 100);
  }
  // Parar: para escucharla (por defecto) o, con enviar, para que salga ya (al soltar el dedo o con «Enviar»)
  function parar({ enviar = false } = {}) {
    const x = r.current;
    clearInterval(x.tic);
    if (x.desde != null) { x.acum = (x.acum || 0) + (reloj() - x.desde); x.desde = null; }
    if (!x.limite) x.seg = (x.acum || 0) / 1000;
    x.alParar = enviar ? 'enviar' : 'revisar';
    setPrevia(null);
    try { if (x.rec && x.rec.state !== 'inactive') x.rec.stop(); else { soltarMicro(); if (estado !== 'revisar') setEstado('nada'); } } catch { soltarMicro(); setEstado('nada'); }
  }
  const puedePausar = typeof globalThis.MediaRecorder === 'function' && typeof globalThis.MediaRecorder.prototype?.pause === 'function';
  function pausar() {
    const x = r.current;
    if (estado !== 'grabando' || !x.rec || x.rec.state !== 'recording') return;
    try { x.rec.pause(); } catch { return; }
    x.acum = (x.acum || 0) + (reloj() - x.desde); x.desde = null;
    setEstado('pausada');
  }
  // (v0.180) Escuchar lo grabado hasta la pausa, sin parar (como WhatsApp): después se puede seguir grabando
  async function escuchar() {
    const x = r.current;
    if (estado !== 'pausada' || !x.rec) return;
    const antes = x.trozos.length;
    try { x.rec.requestData(); } catch { /* */ }
    for (let i = 0; i < 10 && x.trozos.length === antes; i++) await new Promise((ok) => setTimeout(ok, 50));
    if (r.current !== x || x.rec.state !== 'paused' || !x.trozos.length) return;
    setPrevia({ blob: new Blob(x.trozos, { type: x.formato.tipo }), seg: Math.max(1, Math.round((x.acum || 0) / 1000)), onda: ondaDe(x.niveles, 40) });
  }
  function seguir() {
    const x = r.current;
    if (estado !== 'pausada' || !x.rec || x.rec.state !== 'paused') return;
    try { x.rec.resume(); } catch { return; }
    x.desde = reloj();
    setPrevia(null);
    setEstado('grabando');
  }
  function cancelar() {
    const x = r.current;
    x.cancelada = true;
    clearInterval(x.tic);
    try { if (x.rec && x.rec.state !== 'inactive') x.rec.stop(); } catch { /* */ }
    soltarMicro();
    if (estado === 'grabando' || estado === 'pausada') vibrar(40);
    setPrevia(null);
    setEstado('nada'); setGrabado(null); setSeg(0); setBloqueada(false); guardarBorrador(null);
  }
  const bloquear = () => { if (!bloqueada) vibrar(15); setBloqueada(true); };
  // El dedo ya no está en el micro mientras se pedía (lo soltó, o el aviso del permiso se llevó el toque)
  const dedoFuera = ({ toque = false } = {}) => { const x = r.current; x.dedo = false; if (toque) { x.manos = true; setBloqueada(true); } };
  const descartar = () => { setGrabado(null); setEstado('nada'); setSeg(0); setBloqueada(false); setRecien(false); guardarBorrador(null); };
  return { estado, seg, bloqueada, setBloqueada: (v) => (v ? bloquear() : setBloqueada(false)), grabado, vivos, recien, previa, limite, puedePausar, empezar, parar, pausar, seguir, escuchar, cancelar, descartar, dedoFuera };
}

// El botón del micro (con el cuadro vacío, donde va «Enviar»): mantener (y soltar para enviar), deslizar, o tocar
export function BotonMicro({ g, disabled = false, bloqueado = false }) {
  const p = useRef(null);
  const [arrastre, setArrastre] = useState(0);   // cuánto ha subido el dedo hacia el candado (0…1)
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
    if (gesto === 'cancelar') { p.current = null; setArrastre(0); document.documentElement.style.removeProperty('--voz-dx'); g.cancelar(); }
    else if (gesto === 'bloquear') { p.current = null; setArrastre(0); document.documentElement.style.removeProperty('--voz-dx'); g.setBloqueada(true); }
    else { document.documentElement.style.setProperty('--voz-dx', `${Math.min(0, e.clientX - x.x)}px`); setArrastre(Math.max(0, Math.min(1, (x.y - e.clientY) / 80))); }
  };
  const arriba = (e) => {
    const x = p.current;
    if (x && e?.pointerId != null && x.id != null && e.pointerId !== x.id) return;   // otro dedo
    p.current = null;
    setArrastre(0);
    document.documentElement.style.removeProperty('--voz-dx');
    if (!x) return;
    const corta = performance.now() - x.t < PULSACION_CORTA_MS;
    // Aún no ha llegado el micro: si fue un toque, grabará sin el dedo; si lo mantuvo y lo soltó, no se graba
    if (g.estado === 'pidiendo') { g.dedoFuera({ toque: corta }); return; }
    // Un toque corto: sigue grabando sin el dedo; si lo mantuvo, al soltar se envía (como WhatsApp)
    if (corta) g.setBloqueada(true);
    else g.parar({ enviar: true });
  };
  // El sistema se lleva el toque (el aviso del permiso, un gesto del móvil): no se pierde nada. Si aún se pedía el micro, se
  // apunta que el dedo ya no está; si ya grababa, sigue sin el dedo (con sus botones)
  const cancelado = () => {
    const x = p.current;
    p.current = null;
    setArrastre(0);
    document.documentElement.style.removeProperty('--voz-dx');
    if (!x) return;
    if (g.estado === 'pidiendo') g.dedoFuera();
    else if (g.estado === 'grabando') g.setBloqueada(true);
  };
  useEffect(() => () => { document.documentElement.style.removeProperty('--voz-dx'); }, []);
  // Con el teclado (Enter o Espacio) o un lector de pantalla: empieza sin mantener
  const clic = (e) => { if (e.detail === 0 && g.estado === 'nada' && !disabled) g.empezar({ manos: true }); };
  const manteniendo = g.estado === 'grabando' && !g.bloqueada;
  useMarcaPagina('hay-grabando', manteniendo);
  return (
    <span class="chat-micro-caja">
      {manteniendo && <span class="chat-candado" aria-hidden="true" style={{ '--sube': arrastre }}><Icono n="candado" /><Icono n="arriba" /></span>}
      <button type="button" class={`btn btn-primario btn-icono chat-enviar chat-micro ${manteniendo ? 'grabando' : ''} ${bloqueado ? 'sin-permiso' : ''}`} aria-label={`Grabar una nota de voz (hasta ${textoLimite(g.limite)})${bloqueado ? '. El micro está bloqueado: toca para ver cómo activarlo' : ''}`} title="Mantén pulsado para grabar y suelta para enviar (o toca)"
        disabled={disabled} onPointerDown={abajo} onPointerMove={mover} onPointerUp={arriba} onPointerCancel={cancelado}
        onClick={clic} onContextMenu={(e) => e.preventDefault()}>
        <Icono n="micro" />
        {bloqueado && <span class="chat-micro-aviso" aria-hidden="true">!</span>}
      </button>
    </span>
  );
}

// Mientras graba: el punto rojo, el tiempo, la onda en vivo y el aviso de los últimos 10 s; sin el dedo, la papelera,
// pausar o seguir, «Parar y escucharla» y «Enviar»
export function PanelGrabando({ g }) {
  const poco = quedaPoco(g.seg, g.limite);
  const restan = segundosRestantes(g.seg, g.limite);
  const pausada = g.estado === 'pausada';
  // El aviso para el lector de pantalla, una vez (no cada décima)
  const [dicho, setDicho] = useState('');
  useEffect(() => { if (poco && !dicho) setDicho(`Quedan ${restan} segundos: al llegar a ${textoLimite(g.limite)} se para sola`); if (!poco && dicho) setDicho(''); }, [poco]);
  useEffect(() => {
    if (!g.bloqueada) return undefined;
    const tecla = (e) => { if (e.key === 'Escape' && !document.querySelector('[aria-modal="true"]')) { e.preventDefault(); g.cancelar(); } };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [g.bloqueada]);
  const parar = useRef(null);
  const enfocado = useRef(false);
  useEffect(() => { if (g.bloqueada && g.estado === 'grabando' && !enfocado.current) { enfocado.current = true; setTimeout(() => parar.current?.focus(), 0); } }, [g.bloqueada, g.estado]);
  const barras = g.vivos?.length ? g.vivos : Array(28).fill(0);
  // (v0.180) en pausa, lo grabado se puede escuchar sin parar; y después, seguir
  const [urlPrevia, setUrlPrevia] = useState(null);
  useEffect(() => { if (!g.previa) { setUrlPrevia(null); return undefined; } const u = URL.createObjectURL(g.previa.blob); setUrlPrevia(u); return () => URL.revokeObjectURL(u); }, [g.previa]);
  if (pausada && g.previa && urlPrevia) return (
    <div class="chat-revisar-voz chat-previa-voz" role="group" aria-label="Grabando una nota de voz">
      <button type="button" class="btn btn-icono plano chat-grabando-borrar" aria-label="Eliminar la grabación" onClick={g.cancelar}><Icono n="basura" /></button>
      <ReproductorVoz url={urlPrevia} duracion={g.previa.seg} onda={g.previa.onda} propio compacto />
      <button type="button" class="btn btn-icono plano chat-grabando-seguir" aria-label="Seguir grabando" onClick={g.seguir}><Icono n="micro" /></button>
      <button type="button" class="btn btn-primario btn-icono chat-enviar" aria-label="Enviar la nota de voz" onClick={() => g.parar({ enviar: true })}><Icono n="enviar" /></button>
    </div>
  );
  return (
    <div class={`chat-grabando ${poco ? 'acaba' : ''} ${g.bloqueada ? 'bloqueada' : ''} ${pausada ? 'pausada' : ''}`} role="group" aria-label="Grabando una nota de voz">
      {g.bloqueada && <button type="button" class="btn btn-icono plano chat-grabando-borrar" aria-label="Eliminar la grabación" onClick={g.cancelar}><Icono n="basura" /></button>}
      <span class="chat-grabando-punto" aria-hidden="true" />
      <span class="chat-grabando-tiempo num" role="timer" aria-label={`${pausada ? 'En pausa' : 'Grabando'}: ${mmss(Math.min(g.seg, g.limite))} de ${mmss(g.limite)}`}>{g.estado === 'pidiendo' ? 'Abriendo el micro…' : mmss(Math.min(g.seg, g.limite))}</span>
      {g.estado !== 'pidiendo' && <span class="chat-grabando-onda" aria-hidden="true">{barras.map((h, i) => <span key={i} style={{ height: `${Math.max(10, h)}%` }} />)}</span>}
      <span class="mini chat-grabando-aviso">{poco ? `Quedan ${restan} s` : pausada ? 'En pausa' : g.bloqueada ? `Hasta ${textoLimite(g.limite)}` : g.estado === 'pidiendo' ? '' : '‹ Desliza para cancelar'}</span>
      <span class="sr" aria-live="assertive">{dicho}</span>
      {g.estado !== 'pidiendo' && <span class="chat-grabando-progreso" aria-hidden="true" style={{ '--hecho': Math.min(1, g.seg / g.limite) }} />}
      {g.bloqueada && g.estado !== 'pidiendo' && (
        <span class="fila chat-grabando-acciones">
          {g.puedePausar && (pausada
            ? <button type="button" class="btn btn-icono plano chat-grabando-seguir" aria-label="Seguir grabando" onClick={g.seguir}><Icono n="micro" /></button>
            : <button type="button" class="btn btn-icono plano" aria-label="Pausar la grabación" onClick={g.pausar}><Icono n="pausa" /></button>)}
          <button type="button" ref={parar} class="btn btn-icono plano" aria-label={pausada ? 'Escuchar lo grabado' : 'Parar y escucharla'} onClick={() => (pausada ? g.escuchar() : g.parar())}><Icono n="play" /></button>
          <button type="button" class="btn btn-primario btn-icono chat-enviar" aria-label="Enviar la nota de voz" onClick={() => g.parar({ enviar: true })}><Icono n="enviar" /></button>
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
  // El foco va a «Enviar» solo si se acaba de grabar (con un borrador recuperado al abrir el chat, no: un Enter la mandaría)
  useEffect(() => { if (g.recien) setTimeout(() => enviar.current?.focus(), 0); }, []);
  if (!x) return null;
  const tope = x.tope || g.limite;
  return (
    <div class="chat-revisar-voz" role="group" aria-label="Nota de voz grabada">
      <button type="button" class="btn btn-icono plano" aria-label="Eliminar la nota de voz" onClick={g.descartar}><Icono n="basura" /></button>
      <ReproductorVoz url={url} duracion={x.seg} onda={x.onda} propio compacto />
      <button type="button" ref={enviar} class="btn btn-primario btn-icono chat-enviar" aria-label="Enviar la nota de voz" disabled={enviando} onClick={() => alEnviar(x)}><Icono n="enviar" /></button>
      {x.limite && <p class="mini chat-revisar-aviso" role="status">{tope === 60 ? 'Has llegado al minuto' : `Has llegado a los ${textoLimite(tope)}`}: se ha parado sola. Escúchala y envíala.</p>}
      {x.mudo && <p class="mini chat-revisar-aviso" role="status">No se oye nada en la grabación. Mira que el micro no esté tapado ni silenciado (o los auriculares) antes de enviarla.</p>}
      {!x.limite && x.cortada && <p class="mini chat-revisar-aviso" role="status">{x.cortada === 'salida' ? 'Has salido de la app y la grabación se ha parado' : 'El móvil ha cortado el micro'}: lo grabado está aquí. Escúchala y envíala, o bórrala.</p>}
    </div>
  );
}

// (v0.180) Activar el micro con un botón (la primera vez, o desde Ajustes): pide el permiso, lo prueba unos segundos
// («di algo») y dice si se oye. Si está bloqueado, los pasos. Devuelve por alCerrar(true) si quedó activado.
export function ActivarMicro({ alCerrar, soloProbar = false }) {
  const [fase, setFase] = useState('inicio');   // inicio | pidiendo | probando | hecho | bloqueado | fallo
  const [nivel, setNivel] = useState(0);
  const [pico, setPico] = useState(0);
  const [error, setError] = useState(null);
  const x = useRef({});
  const soltar = () => { const y = x.current; clearInterval(y.tic); clearTimeout(y.fin); try { y.stream?.getTracks().forEach((t) => t.stop()); } catch { /* */ } if (y.stream) audioParaMicro(false); try { y.ctx?.close(); } catch { /* */ } x.current = {}; };
  useEffect(() => soltar, []);
  async function activar() {
    if (!navigator.mediaDevices?.getUserMedia) { setError(errorMicro({ name: globalThis.isSecureContext === false ? 'SinContexto' : 'NoSoportado' })); setFase('fallo'); return; }
    setFase('pidiendo'); setError(null);
    let stream;
    audioParaMicro(true);
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { audioParaMicro(false); if (esPermisoDenegado(e)) { recordarMicro(false); setFase('bloqueado'); } else { setError(errorMicro(e)); setFase('fallo'); } return; }
    recordarMicro(true);
    const y = x.current = { stream, pico: 0 };
    try {
      const C = globalThis.AudioContext || globalThis.webkitAudioContext;
      y.ctx = new C(); y.ctx.resume?.().catch?.(() => {});
      const an = y.ctx.createAnalyser(); an.fftSize = 512; y.ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.fftSize);
      y.tic = setInterval(() => {
        an.getByteTimeDomainData(buf);
        let suma = 0; for (const v of buf) { const d = (v - 128) / 128; suma += d * d; }
        const n = Math.min(1, Math.sqrt(suma / buf.length) * 3);
        y.pico = Math.max(y.pico, n); setNivel(n); setPico(y.pico);
      }, 100);
    } catch { /* sin medidor: se da por activado */ }
    setFase('probando');
    y.fin = setTimeout(() => { const p = x.current.pico || 0; soltar(); setPico(p); setFase('hecho'); }, 4000);
  }
  const instalada = typeof matchMedia === 'function' && (matchMedia('(display-mode: standalone)').matches || globalThis.navigator?.standalone === true);
  const a = ayudaMicro(globalThis.navigator?.userAgent || '', instalada);
  const res = resultadoPrueba(pico);
  return (
    <Hoja titulo={soloProbar ? 'Probar el micro' : 'Activar el micro'} alCerrar={() => { soltar(); alCerrar(fase === 'hecho' || fase === 'probando'); }}>
      {fase === 'inicio' && (
        <>
          <p class="peq secundario">{soloProbar ? 'Vamos a escucharte unos segundos para comprobar que el micro funciona. No se graba ni se guarda nada.' : 'Para mandar notas de voz, la app necesita tu micro. Actívalo ahora y no te lo preguntará en mitad de una grabación.'}</p>
          {!soloProbar && <p class="mini terciario">Al tocar el botón, el móvil te preguntará: elige «Permitir». Solo se usa mientras grabas.</p>}
          <button type="button" class="btn btn-primario btn-grande" onClick={activar}><Icono n="micro" /> {soloProbar ? 'Probar el micro' : 'Activar el micro'}</button>
        </>
      )}
      {fase === 'pidiendo' && <p class="peq secundario" role="status">Abriendo el micro… Si el móvil pregunta, elige «Permitir».</p>}
      {fase === 'probando' && (
        <>
          <p class="peq" role="status"><b>Micro activado.</b> Di algo para probarlo:</p>
          <div class="micro-medidor" role="meter" aria-label="Nivel del micro" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(nivel * 100)}><span style={{ '--nivel': nivel }} /></div>
          <p class="mini terciario">No se graba ni se guarda nada.</p>
        </>
      )}
      {fase === 'hecho' && (
        <>
          <p class="peq" role="status">{res === 'bien' ? <><b>Se te oye bien.</b> Ya puedes grabar: mantén pulsado el micro del chat y suelta para enviar.</> : res === 'bajo' ? <><b>Micro activado, pero se te oye bajo.</b> Acércate al móvil o mira que no esté tapado.</> : <><b>Micro activado, pero no se oye nada.</b> Mira que no esté tapado ni silenciado, o prueba sin auriculares.</>}</p>
          <div class="fila">
            {res !== 'bien' && <button type="button" class="btn plano" onClick={activar}>Probar otra vez</button>}
            <button type="button" class="btn btn-primario" onClick={() => alCerrar(true)}>Listo</button>
          </div>
        </>
      )}
      {fase === 'bloqueado' && (
        <>
          <p class="peq secundario">El micro está bloqueado para la app. Se activa una vez, en tu {a.aparato}:</p>
          <ol class="ayuda-micro">{a.pasos.map((t) => <li key={t} class="peq">{t}</li>)}</ol>
          {a.nota && <p class="mini terciario">{a.nota}</p>}
          <div class="fila"><button type="button" class="btn plano" onClick={activar}>Volver a probar</button><button type="button" class="btn btn-primario" onClick={() => alCerrar(false)}>Entendido</button></div>
        </>
      )}
      {fase === 'fallo' && (<><p class="peq" role="alert">{error}</p><div class="fila"><button type="button" class="btn plano" onClick={activar}>Volver a probar</button><button type="button" class="btn btn-primario" onClick={() => alCerrar(false)}>Cerrar</button></div></>)}
    </Hoja>
  );
}

// «Cómo activarlo»: el micro está bloqueado para la app; los pasos, para este aparato
export function AyudaMicro({ alCerrar }) {
  const instalada = typeof matchMedia === 'function' && (matchMedia('(display-mode: standalone)').matches || globalThis.navigator?.standalone === true);
  const a = ayudaMicro(globalThis.navigator?.userAgent || '', instalada);
  return (
    <Hoja titulo="Activar el micro" alCerrar={alCerrar}>
      <p class="peq secundario">El micro está bloqueado para la app, así que no puede grabar. Se activa una vez, en tu {a.aparato}:</p>
      <ol class="ayuda-micro">{a.pasos.map((t) => <li key={t} class="peq">{t}</li>)}</ol>
      {a.nota && <p class="mini terciario">{a.nota}</p>}
      <p class="mini terciario">Solo se usa mientras grabas: al parar, el micro se suelta.</p>
      <button type="button" class="btn btn-primario btn-grande" onClick={alCerrar}>Entendido</button>
    </Hoja>
  );
}

// (v0.179) Como WhatsApp: solo suena una nota a la vez; la velocidad elegida se recuerda (en este aparato); cada nota recuerda
// por dónde se dejó; y al acabar una suena la siguiente, si va justo después (ordenVoz lo dice el chat)
let sonandoAhora = null;
const posiciones = new Map();
let orden = [];
export const ponerOrdenVoz = (mensajes) => { orden = Array.isArray(mensajes) ? mensajes : []; };
// Al cerrar sesión: ni borradores ni posiciones de otra cuenta
export const olvidarVoz = () => { borradores.clear(); posiciones.clear(); orden = []; };
try { if (typeof window !== 'undefined') window.addEventListener('fbe-voz-olvidar', olvidarVoz); } catch { /* */ }
const CLAVE_VEL = 'fbe-voz-velocidad';
const leerVel = () => { try { const v = Number(localStorage.getItem(CLAVE_VEL)); return VELOCIDADES.includes(v) ? v : 1; } catch { return 1; } };
const guardarVel = (v) => { try { localStorage.setItem(CLAVE_VEL, String(v)); } catch { /* */ } try { window.dispatchEvent(new CustomEvent('fbe-voz-velocidad', { detail: v })); } catch { /* */ } };

// El reproductor (en la burbuja y al revisar): ▶/❚❚, la onda con lo escuchado, el tiempo y 1×/1,5×/2×. url: la del
// audio, o pedirUrl() la primera vez que se reproduce (así no se descarga nada hasta que se toca). clave: para recordar por
// dónde se dejó. Si el enlace ha caducado (el chat lleva mucho abierto), se pide otro y sigue por donde iba.
export function ReproductorVoz({ url: urlDada = null, pedirUrl = null, duracion = 0, onda = null, propio = false, escuchada = false, alReproducir = null, compacto = false, clave = null, mime = null, alAcabar = null, control = null, nueva = false, titulo = null }) {
  const audio = useRef(null);
  const [url, setUrl] = useState(urlDada);
  const [sonando, setSonando] = useState(false);
  const [t, setT] = useState(() => (clave && posiciones.get(clave)) || 0);
  const [vel, setVel] = useState(leerVel);
  const [cargando, setCargando] = useState(false);
  const [fallo, setFallo] = useState(null);
  const x = useRef({ reintentado: false, pendiente: null });
  useEffect(() => { if (urlDada) setUrl(urlDada); }, [urlDada]);
  useEffect(() => {
    const f = (e) => { const v = Number(e.detail); if (VELOCIDADES.includes(v)) { setVel(v); if (audio.current) audio.current.playbackRate = v; } };
    window.addEventListener('fbe-voz-velocidad', f);
    return () => { window.removeEventListener('fbe-voz-velocidad', f); if (sonandoAhora && sonandoAhora === audio.current) sonandoAhora = null; };
  }, []);
  const total = Math.max(1, Number(duracion) || 0);
  const barras = Array.isArray(onda) && onda.length ? onda : Array(32).fill(18);
  const recordar = (v) => { if (!clave) return; if (v > 0.3 && v < total - 0.3) posiciones.set(clave, v); else posiciones.delete(clave); };
  // Empieza a sonar (desde donde se dejó); silencioso: no enseña el fallo (cuando suena sola tras la anterior y el móvil no deja)
  async function sonar({ silencioso = false, nuevoEnlace = false } = {}) {
    if (mime) { try { if (document.createElement('audio').canPlayType(mime) === '') { if (!silencioso) setFallo('Este móvil no puede abrir este audio'); return; } } catch { /* */ } }
    let u = nuevoEnlace ? null : url;
    if (!u && pedirUrl) {
      setCargando(true); setFallo(null);
      try { u = await pedirUrl(); setUrl(u); } catch { if (!silencioso) setFallo('No se pudo descargar: toca para reintentar'); setCargando(false); return; }
      setCargando(false);
    }
    if (!u) return;
    x.current.pendiente = t; x.current.intento = true;
    setTimeout(() => {
      const b = audio.current;
      if (!b) return;
      b.playbackRate = vel;
      if (x.current.pendiente > 0.3 && b.readyState >= 1) { try { b.currentTime = x.current.pendiente; x.current.pendiente = 0; } catch { /* al cargar */ } }
      b.play().then(() => setFallo(null)).catch(() => { if (!silencioso) setFallo('No se pudo reproducir: toca para reintentar'); });
    }, 0);
  }
  if (control) control.current = { sonar };
  const alternar = () => { if (sonando) { audio.current?.pause(); return; } sonar({ nuevoEnlace: !!fallo && !!pedirUrl }); };
  const cambiarVel = () => { const v = siguienteVelocidad(vel); setVel(v); if (audio.current) audio.current.playbackRate = v; guardarVel(v); };
  const buscar = (e) => { const v = Number(e.currentTarget.value); setT(v); recordar(v); if (audio.current) audio.current.currentTime = v; };
  // El enlace caduca a la hora: si falla con uno pedido, se pide otro (una vez) y sigue por donde iba
  const alFallar = () => {
    // (revisión) solo se vuelve a intentar si se quería oír (no al mover la barra de una nota parada)
    const queria = sonando || x.current.intento;
    x.current.intento = false;
    if (!queria) return;
    if (pedirUrl && !x.current.reintentado) { x.current.reintentado = true; setSonando(false); sonar({ nuevoEnlace: true }); return; }
    setSonando(false); setFallo('No se pudo reproducir: toca para reintentar'); x.current.reintentado = false;
  };
  // (v0.180) Mientras suena: los mandos de la pantalla de bloqueo y de los auriculares, y la pantalla encendida
  const fuera = useRef({});
  const alSonar = (b) => {
    try {
      const ms = navigator.mediaSession;
      if (ms && globalThis.MediaMetadata && !ms.metadata) {   // (si ya los lleva otra cosa, como la pista del descanso, no se tocan)
        ms.metadata = new globalThis.MediaMetadata({ title: titulo || 'Nota de voz', artist: 'FBE Equipo' });
        ms.setActionHandler('play', () => b.play().catch(() => {}));
        ms.setActionHandler('pause', () => b.pause());
        fuera.current.ms = true;
      }
    } catch { /* */ }
    try { navigator.wakeLock?.request('screen').then((w) => { if (b.paused) w.release().catch(() => {}); else fuera.current.w = w; }).catch(() => {}); } catch { /* */ }
  };
  const alCallar = () => {
    try { fuera.current.w?.release?.().catch?.(() => {}); } catch { /* */ }
    fuera.current.w = null;
    try { if (fuera.current.ms && navigator.mediaSession) { navigator.mediaSession.setActionHandler('play', null); navigator.mediaSession.setActionHandler('pause', null); navigator.mediaSession.metadata = null; } } catch { /* */ }
    fuera.current.ms = false;
  };
  useEffect(() => alCallar, []);
  const hecho = Math.min(1, t / total);
  return (
    <div class={`voz ${propio ? 'propia' : ''} ${compacto ? 'compacta' : ''} ${sonando ? 'sonando' : ''} ${nueva ? 'nueva' : ''}`}>
      <button type="button" class="btn btn-icono voz-play" aria-label={sonando ? 'Pausar la nota de voz' : `Escuchar la nota de voz (${mmss(total)})`} onClick={alternar} disabled={cargando}>
        <Icono n={sonando ? 'pausa' : 'play'} />
      </button>
      <span class="voz-cuerpo">
        <span class="voz-onda" aria-hidden="true">
          {barras.map((h, i) => <span key={i} class={(i + 0.5) / barras.length <= hecho ? 'hecha' : ''} style={{ height: `${Math.max(12, h)}%` }} />)}
        </span>
        <input type="range" class="voz-barra" min="0" max={total} step="0.1" value={t} onInput={buscar} aria-label="Posición en la nota de voz" aria-valuetext={`${mmss(t)} de ${mmss(total)}`} />
        <span class="mini num voz-tiempo" role={fallo ? 'alert' : undefined}>{fallo || (cargando ? 'Descargando…' : sonando || t > 0 ? mmss(t) : mmss(total))}</span>
      </span>
      <button type="button" class="btn btn-peq voz-vel num" aria-label={`Velocidad: ${textoVelocidad(vel)}. Cambiar`} onClick={cambiarVel}>{textoVelocidad(vel)}</button>
      {!compacto && <span class={`voz-micro ${escuchada ? 'escuchada' : ''}`} title={escuchada ? 'Escuchada' : 'Sin escuchar'}><Icono n="micro" /><span class="sr">{escuchada ? 'Escuchada' : 'Sin escuchar'}</span></span>}
      {url && (
        <audio ref={audio} src={url} preload="metadata" data-pausa-musica
          onPlay={(e) => { if (sonandoAhora && sonandoAhora !== e.currentTarget) { try { sonandoAhora.pause(); } catch { /* */ } } sonandoAhora = e.currentTarget; x.current.reintentado = false; x.current.intento = false; setSonando(true); alSonar(e.currentTarget); alReproducir?.(); }}
          onPause={(e) => { setSonando(false); alCallar(); if (!e.currentTarget.ended) recordar(e.currentTarget.currentTime); }}
          onEnded={() => { setSonando(false); setT(0); if (clave) posiciones.delete(clave); if (audio.current) audio.current.currentTime = 0; if (sonandoAhora === audio.current) sonandoAhora = null; alAcabar?.(); }}
          onLoadedMetadata={(e) => { if (x.current.pendiente > 0.3) { try { e.currentTarget.currentTime = x.current.pendiente; } catch { /* */ } x.current.pendiente = 0; } }}
          onTimeUpdate={(e) => setT(e.currentTarget.currentTime)} onError={alFallar} />
      )}
    </div>
  );
}

// La nota de voz en la burbuja: se descarga al tocar ▶ (con su enlace firmado); a quien la recibe, al reproducirla,
// le cuenta como escuchada (el micro azul del otro lado), si tiene «en línea» activado. (v0.179) Al acabar, suena la
// siguiente si va justo después (como WhatsApp).
export function NotaVozChat({ c, mio, alEscuchada, encadena = true, de = null }) {
  const { api } = useApp();
  const a = c.archivo;
  const control = useRef(null);
  useEffect(() => {
    if (!encadena) return undefined;   // (revisión) solo la burbuja: en «Archivos» la misma nota no suena dos veces
    const f = (e) => { if (String(e.detail) === String(c.id)) control.current?.sonar({ silencioso: true }); };
    window.addEventListener('fbe-voz-siguiente', f);
    return () => window.removeEventListener('fbe-voz-siguiente', f);
  }, [c.id]);
  const acabar = () => {
    if (!encadena) return;
    const sig = siguienteVoz(orden, c.id);
    if (sig == null) return;
    sonarFBE('nota-acaba');
    try { window.dispatchEvent(new CustomEvent('fbe-voz-siguiente', { detail: sig })); } catch { /* */ }
  };
  return (
    <ReproductorVoz pedirUrl={() => api.urlArchivo(a.ruta, { tipo: 'audio' })} duracion={a.duracion_seg} onda={a.onda} propio={mio} escuchada={!!c.escuchado_en}
      clave={a.id || a.ruta} mime={a.mime || null} control={control} alAcabar={acabar} nueva={!mio && !c.escuchado_en} titulo={de ? `Nota de voz de ${de}` : 'Nota de voz'}
      alReproducir={() => { if (!mio && !c.escuchado_en) api.marcarEscuchado(c.id).then((x) => { if (x) alEscuchada?.(); }); }} />
  );
}
