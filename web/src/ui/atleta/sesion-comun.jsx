import { useEffect, useRef, useState } from 'preact/hooks';
import { leerAjustes, guardarAjustes } from '../ajustes.js';
import { faseRespira, retrasoRespira } from '../../logica/respira.js';
import { sinMovimiento } from '../transiciones.js';
import { SONIDOS } from '../../datos/sonidos-descanso.js';
import { Icono, useApp } from '../comunes.jsx';
import { propuestaSerie, sugerenciaProgresion, esBarra, mmss, esTopBackoff, propuestaBackoff, tieneDetalle, objetivoSerie } from '../../logica/calculos.js';
import { hablar, prepararVoz } from '../voz.js';
import { fraseCuenta } from '../../logica/voz.js';
import { vibrar } from '../hapticos.js';
import { descansoEnCurso } from '../en-curso.js';
import { lanzarConfeti } from '../confeti.js';

// Piezas compartidas por la sesión (lista) y el modo enfoque

export const RPES = ['', 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
export const COLOR_DISCO = { alta: 'var(--disco-rojo)', media: 'var(--disco-azul)', baja: 'var(--disco-amarillo)', muy_baja: 'var(--disco-verde)' };

// ---------- sonido y vibración al acabar el descanso (el audio se activa con el primer toque) ----------
// Los sonidos son los de FBE Timer (v0.27.1, a petición de los atletas: el pitido de antes se oía muy bajo).
// Van por Web Audio, como el pitido: en iPhone un <audio> solo suena si arranca en el mismo toque, y el aviso
// llega solo al acabar el descanso (o unos milisegundos después de tocar «Probar»). Así también funciona el
// volumen en iPhone. La sesión de audio va en «ambient» (v0.27.5): se mezcla con la música del atleta en vez de
// cortarla (con «playback», en v0.27.2–0.27.4, iPhone paraba Spotify al entrar a entrenar); a cambio, con el
// móvil en silencio no suena. «Pitido suave» es el de antes.
export const SONIDOS_DESCANSO = [['tres-beeps', 'Tres beeps'], ['estadio', 'Beep estadio'], ['boxeo', 'Campana de boxeo'], ['silbato', 'Silbato'], ['motivador', 'Tono motivador'], ['suave', 'Pitido suave']];
let audio = null;
const buffers = {}; // sonido → Promise<AudioBuffer>
function cargar(k) {
  if (!audio || !SONIDOS[k]) return null;
  if (!buffers[k]) {
    try {
      const b64 = SONIDOS[k].slice(SONIDOS[k].indexOf(',') + 1);
      const bin = atob(b64), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      // (decodeAudioData con callbacks: Safari antiguo no devuelve promesa)
      buffers[k] = new Promise((ok, mal) => { const r = audio.decodeAudioData(bytes.buffer, ok, mal); r?.then?.(ok, mal); });
      buffers[k].catch(() => { delete buffers[k]; });
    } catch { return null; }
  }
  return buffers[k];
}
export function prepararAudio() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch { /* solo Safari */ }
  try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch { audio = null; }
  cargar(leerAjustes().sonidoDescanso);
  // v0.48: el entrenador por voz se «despierta» en el mismo toque (iPhone)
  prepararVoz();
}
function pitidoSuave(volumen = 1) {
  if (!audio) return;
  [0, 0.28].forEach((t) => {
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = 880; o.type = 'sine';
    g.gain.setValueAtTime(0.0001, audio.currentTime + t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.01, 0.5 * volumen), audio.currentTime + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + t + 0.22);
    o.connect(g).connect(audio.destination);
    o.start(audio.currentTime + t); o.stop(audio.currentTime + t + 0.25);
  });
}
let sonando = null;
// sonido: el que hay que tocar (al elegirlo o «Probar»); sin él, el de los ajustes
export function pitar(sonido = null) {
  const a = leerAjustes();
  if (a.vibracion) try { navigator.vibrate?.([200, 100, 200, 100, 400]); } catch { /* */ }
  if (!a.sonido || !audio) return;
  if (audio.state === 'suspended') audio.resume().catch(() => {});
  const volumen = Math.min(1, Math.max(0.1, Number(a.volumen) || 1));
  const carga = cargar(sonido || a.sonidoDescanso);
  if (!carga) { pitidoSuave(volumen); return; }
  carga.then((buffer) => {
    try { sonando?.stop(); } catch { /* ya había acabado */ }
    const fuente = audio.createBufferSource(), g = audio.createGain();
    fuente.buffer = buffer; g.gain.value = volumen;
    fuente.connect(g).connect(audio.destination);
    fuente.start();
    sonando = fuente;
  }).catch(() => pitidoSuave(volumen));
}

// Un tono corto (para el metrónomo de tempo): respeta el ajuste de sonido
export function tono(frecuencia = 880, duracion = 0.08, volumen = 0.18) {
  if (!audio || !leerAjustes().sonido) return;
  try {
    const t = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = frecuencia; o.type = 'sine';
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volumen, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
    o.connect(g).connect(audio.destination);
    o.start(t); o.stop(t + duracion + 0.02);
  } catch { /* sin audio */ }
}
export function vibrarCorto(ms = 30) { if (leerAjustes().vibracion) try { navigator.vibrate?.(ms); } catch { /* */ } }

// Récord: vibración más larga (la de «vibración al tocar», v0.49) y tres notas que suben
export function celebrar() {
  const a = leerAjustes();
  vibrar('record');
  // v0.52: y confeti (nunca con «reducir movimiento»; la vibración ya va aquí arriba)
  lanzarConfeti({ vibracion: null });
  if (!audio || !a.sonido) return;
  [523.25, 659.25, 783.99].forEach((f, i) => {
    const t = audio.currentTime + i * 0.11;
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = f; o.type = 'triangle';
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (i === 2 ? 0.45 : 0.16));
    o.connect(g).connect(audio.destination);
    o.start(t); o.stop(t + 0.5);
  });
}

// Mantiene la pantalla encendida mientras la sesión está abierta
export function usePantallaEncendida() {
  useEffect(() => {
    if (!leerAjustes().pantalla) return undefined;
    let candado = null, vivo = true;
    const pedir = async () => {
      try { if (vivo && document.visibilityState === 'visible') candado = await navigator.wakeLock?.request('screen'); } catch { /* no disponible */ }
    };
    pedir();
    document.addEventListener('visibilitychange', pedir);
    return () => { vivo = false; document.removeEventListener('visibilitychange', pedir); try { candado?.release(); } catch { /* */ } };
  }, []);
}

export function useAhora(cadaMs = 1000) {
  const [t, setT] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setT(Date.now()), cadaMs); return () => clearInterval(i); }, [cadaMs]);
  return t;
}


export { problemaSerie } from '../../logica/calculos.js';

export function aNumero(t) {
  const s = String(t ?? '').replace(',', '.').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}


// ---------- temporizador de descanso: un disco que se vacía ----------
// v0.39: con la app en segundo plano (Spotify o YouTube delante, la pantalla bloqueada), el iPhone la congela y no
// puede sonar. Por eso, al empezar el descanso (y con cada +15 / −15), se programa un aviso al móvil para cuando
// acabe (migración 025); si suena aquí, con la app delante, se anula, y también al saltarlo o cerrarlo. Si la app
// vuelve tarde (el aviso ya sonó en el móvil), no suena otra vez.
const conAvisoAlMovil = () => typeof Notification !== 'undefined' && Notification.permission === 'granted';
export function Temporizador({ fin, total, prioridad, texto, voz = null, tras = null, inicio = null, alCambiar, clase = '' }) {
  const { api, atleta } = useApp() || {};
  const ahora = useAhora(250);
  const finRef = useRef(fin);
  finRef.current = fin;
  const quedan = Math.max(0, (fin - ahora) / 1000);
  const avisado = useRef(false);
  const programado = useRef(false);
  useEffect(() => {
    if (!api?.programarDescanso || !conAvisoAlMovil() || fin <= Date.now()) return undefined;
    // (un momento después: con varios +15 seguidos, solo el último)
    const t = setTimeout(() => { programado.current = true; api.programarDescanso(fin, texto); }, 700);
    return () => clearTimeout(t);
  }, [fin]);
  // Al quitarse el temporizador (saltar, cerrar), fuera el aviso. v0.52: si se sale de la sesión con el descanso en
  // marcha, lo sigue llevando la píldora «Sesión en curso» (y el aviso al móvil se queda)
  useEffect(() => () => { if (programado.current && !descansoEnCurso(atleta?.id, finRef.current)) api?.cancelarDescanso?.(); }, []);
  useEffect(() => {
    if (quedan <= 0 && !avisado.current) {
      avisado.current = true;
      const tarde = Date.now() - fin > 4000; // la app estaba congelada: ya avisó el móvil
      if (document.visibilityState === 'visible' && programado.current) { programado.current = false; api?.cancelarDescanso?.(); }
      if (!tarde) {
        pitar();
        // v0.48: con el entrenador por voz, lo que toca ahora («Serie 3 de press banca: 80 kilos por 6»)
        if (leerAjustes().voz) setTimeout(() => hablar(voz || '¡Vamos!'), leerAjustes().sonido ? 900 : 0);
      }
    }
    if (quedan > 0) avisado.current = false;
  }, [quedan <= 0]);
  // Como FBE Timer: un pitido corto en cada uno de los 3 últimos segundos
  const segundo = Math.ceil(quedan);
  const contado = useRef(null);
  useEffect(() => {
    const a = leerAjustes();
    // Con el entrenador por voz, la cuenta se dice (a los 10 y en los 3 últimos); si no, los pitidos de siempre
    if (a.voz && contado.current !== segundo && fraseCuenta(segundo) && (segundo === 10 ? total > 20 : true)) {
      hablar(fraseCuenta(segundo));
      if (segundo <= 3) vibrarCorto(80);
    } else if (segundo >= 1 && segundo <= 3 && contado.current !== segundo && a.cuentaAtras) {
      tono(660, 0.1, 0.35 * Math.min(1, Math.max(0.1, Number(a.volumen) || 1)));
      vibrarCorto(80);
    }
    contado.current = segundo;
  }, [segundo]);
  useEffect(() => {
    if (quedan > 0) return undefined;
    const t = setTimeout(() => alCambiar(null), 6000);
    return () => clearTimeout(t);
  }, [quedan <= 0]);
  // v0.50: el temporizador va en la página, debajo del ejercicio; si se queda fuera de la vista al desplazarse,
  // una píldora flotante con lo que queda (al tocarla, vuelve a él). Con IntersectionObserver, sin escuchar el scroll.
  // En el modo enfoque, que es una pantalla aparte, no hace falta.
  const caja = useRef(null);
  const [fuera, setFuera] = useState(false);
  const conPildora = !clase.includes('en-enfoque');
  useEffect(() => {
    const el = caja.current?.querySelector('.reloj-descanso');
    if (!conPildora || !el || typeof IntersectionObserver === 'undefined') return undefined;
    // (la cabecera de la sesión va pegada arriba: lo que queda debajo de ella no se ve)
    // (en iOS el aviso puede llegar con el anillo aún medio fuera: cuenta como fuera si se ve menos de una cuarta parte)
    const io = new IntersectionObserver(([e]) => setFuera(!e.isIntersecting || e.intersectionRatio < 0.25), { rootMargin: '-64px 0px -8px 0px', threshold: [0, 0.25, 0.5] });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const volver = () => {
    const quieto = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    caja.current?.scrollIntoView({ block: 'center', behavior: quieto ? 'auto' : 'smooth' });
    setTimeout(() => caja.current?.querySelector('.saltar')?.focus({ preventScroll: true }), quieto ? 0 : 350);
  };
  // v0.52: «Respira» (se recuerda en el móvil): un círculo que crece al inspirar (4 s) y encoge al soltar (6 s), contado
  // desde que empezó el descanso; el texto «Inspira» / «Suelta» no se anuncia (la cuenta sigue mandando). Con «reducir
  // movimiento», solo el texto.
  const [respira, setRespira] = useState(() => leerAjustes().respira === true);
  // (revisión: el ciclo cuenta desde el inicio de cada descanso, que viaja con él y no cambia con ±15 s ni ±1 min; el
  // temporizador de un mismo ejercicio se reutiliza de una serie a otra, así que no vale lo del primer pintado)
  // (sin él, de un descanso de antes de esta versión, el que sale de su final y su duración)
  const inicioR = inicio || fin - total * 1000;
  const cambiarRespira = () => { const v = !respira; setRespira(v); guardarAjustes({ ...leerAjustes(), respira: v }); };
  const fase = respira && quedan > 0 ? faseRespira((ahora - inicioR) / 1000) : null;
  const quietoRespira = sinMovimiento();
  // (el retraso de la animación se fija cuando aparece el círculo, con lo que lleva el descanso en ese momento: cambiarlo
  // después la haría saltar; y un círculo nuevo, por cada descanso)
  const ponerRetraso = (el) => { if (el && !el.dataset.retraso) { el.dataset.retraso = '1'; el.style.animationDelay = `${retrasoRespira((Date.now() - inicioR) / 1000)}s`; } };
  const R = 88, C = 2 * Math.PI * R;
  const frac = total ? Math.min(1, quedan / total) : 0;
  const ajustar = (s) => alCambiar({ fin: Math.max(Date.now(), fin) + s * 1000, total: Math.max(total, (Math.max(Date.now(), fin) - Date.now()) / 1000 + s), prioridad, texto, voz, tras, inicio: inicioR });
  const color = COLOR_DISCO[prioridad] || 'var(--morado)';
  const r2 = 9, c2 = 2 * Math.PI * r2;
  return (
    <>
    <div ref={caja} class={`temporizador ${clase} ${quedan <= 0 ? 'fin' : ''}`} role="timer" aria-live="off" aria-label="Descanso" style={{ '--c-disco': color }}>
      <div class="temporizador-cab">
        <span class="temporizador-etq">{quedan > 0 ? 'Descanso' : 'Descanso terminado'}</span>
        <span class="que">{quedan > 0 ? `Después: ${texto}` : `Ahora: ${texto}`}</span>
      </div>
      <div class={`reloj-descanso ${fase ? 'respirando' : ''}`}>
        {fase && !quietoRespira && <span key={inicioR} ref={ponerRetraso} class="respira-circulo" aria-hidden="true" />}
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <circle class="carril" cx="100" cy="100" r={R} />
          <circle class="arco" cx="100" cy="100" r={R} stroke-dasharray={C} stroke-dashoffset={C * (1 - frac)} transform="rotate(-90 100 100)" />
        </svg>
        <div class="reloj-centro">
          <div class="cuenta num" role="timer" aria-label={quedan > 0 ? `Descanso: quedan ${Math.ceil(quedan)} segundos` : 'Descanso terminado'}>{quedan > 0 ? mmss(quedan) : '¡Vamos!'}</div>
          {quedan > 0 && total > 0 && !fase && <div class="de num">de {mmss(total)}</div>}
          {fase && <div class={`respira-texto ${fase.fase}`} aria-hidden="true">{fase.texto}</div>}
        </div>
      </div>
      {quedan > 0 && (
        <button type="button" class="respira-boton" aria-pressed={respira ? 'true' : 'false'} onClick={cambiarRespira} title="Un círculo para acompasar la respiración mientras descansas">
          <Icono n="sueno" />Respira
        </button>
      )}
      {/* v0.42: también ±1 minuto, para alargar el descanso por un imprevisto o acortarlo si hay prisa */}
      <div class="ajustes">
        <button onClick={() => ajustar(-60)} aria-label="Quitar 1 minuto">−1 min</button>
        <button onClick={() => ajustar(-15)} aria-label="Quitar 15 segundos">−15 s</button>
        <button onClick={() => ajustar(15)} aria-label="Añadir 15 segundos">+15 s</button>
        <button onClick={() => ajustar(60)} aria-label="Añadir 1 minuto">+1 min</button>
      </div>
      <button class="saltar" onClick={() => alCambiar(null)}>{quedan > 0 ? 'Saltar' : 'Cerrar'}</button>
    </div>
      {/* (fuera de la tarjeta: con su latido al sonar, una «fixed» dentro se movería con ella) */}
      {conPildora && fuera && (
        <button type="button" class={`pildora-descanso ${quedan <= 0 ? 'fin' : ''}`} onClick={volver} aria-live="off"
          aria-label={quedan > 0 ? 'Descanso en curso, toca para volver' : 'Descanso terminado, toca para volver'}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle class="carril" cx="12" cy="12" r={r2} />
            <circle class="arco" cx="12" cy="12" r={r2} stroke-dasharray={c2} stroke-dashoffset={c2 * (1 - frac)} transform="rotate(-90 12 12)" />
          </svg>
          <span class="num">{quedan > 0 ? mmss(quedan) : '¡Vamos!'}</span>
          <Icono n="arriba" />
        </button>
      )}
    </>
  );
}

// Lo que hace falta para proponer cada serie de un ejercicio (con o sin alternativa)
export function prepararEjercicio(e, actual, ultimas, foco, progresionAuto) {
  const ej = actual || e.ejercicio;
  // Con una alternativa no vale la carga pautada para el original: se parte de lo que hizo con la alternativa
  // (y, pautado serie a serie, sin los kilos de cada serie: eran para el original)
  const prescripcion = actual ? { ...e, carga_sugerida_kg: null, series_detalle: e.series_detalle ? e.series_detalle.map(({ kg, ...resto }) => resto) : e.series_detalle } : e;
  // Pautado serie a serie: cada serie trae lo suyo del coach (sin sugerencia de la app, que es para series iguales)
  const detalle = tieneDetalle(prescripcion);
  const sugerencia = progresionAuto && !detalle ? sugerenciaProgresion(prescripcion, ultimas?.series, { nombre: ej.nombre, foco, pautaAnterior: ultimas?.pauta }) : null;
  const barra = esBarra(ej.nombre);
  const top = esTopBackoff(prescripcion);
  const deLaTop = propuestaSerie(prescripcion, ultimas?.series, 1, { sugerencia, pautaAnterior: ultimas?.pauta });
  const propuesta = (k, hechas = {}) => {
    // Top + back-off: la back-off sale de lo que hizo de verdad en la top (o de lo propuesto, si aún no la ha hecho)
    const bo = top ? propuestaBackoff(prescripcion, k, hechas, deLaTop, ej.nombre) : null;
    if (bo) return bo;
    const previa = hechas[k - 1];
    const o = objetivoSerie(prescripcion, k);
    if (o) {
      // Lo de esa serie; lo que el coach no puso, como siempre (la anterior de hoy o su última vez)
      const base = previa ? { kg: previa.kg, reps: previa.reps } : propuestaSerie(prescripcion, ultimas?.series, k, { pautaAnterior: ultimas?.pauta });
      return { kg: o.kg ?? base.kg, reps: o.reps ?? base.reps, rpe: o.rpe ?? null, objetivo: o };
    }
    return previa ? { kg: previa.kg, reps: previa.reps } : propuestaSerie(prescripcion, ultimas?.series, k, { sugerencia, pautaAnterior: ultimas?.pauta });
  };
  return {
    ej, prescripcion, sugerencia, barra, top, detalle,
    conAproximacion: barra || (ej.tipo || []).includes('basico'),
    // Para la aproximación: la serie más pesada que le toca
    kgTrabajo: detalle && prescripcion.series_detalle.some((x) => x.kg != null) ? Math.max(...prescripcion.series_detalle.map((x) => x.kg ?? 0)) : deLaTop.kg,
    propuesta,
  };
}

// Nota fijada del atleta para un ejercicio («sillín en el 4»): se ve cada vez que lo hace.
// editando / alEditar los lleva quien la usa (para abrirla desde un botón «Nota»).
export function NotaFijada({ nota, alGuardar, editando, alEditar }) {
  const [texto, setTexto] = useState(nota?.texto || '');
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { if (!editando) setTexto(nota?.texto || ''); }, [nota?.texto, editando]);
  if (!editando) {
    return nota ? (
      <button type="button" class="nota-fijada" onClick={() => alEditar(true)} aria-label={`Tu nota: ${nota.texto}. Tocar para cambiarla`}>
        <Icono n="chincheta" /><span>{nota.texto}</span>
      </button>
    ) : null;
  }
  const guardar = async (t) => {
    setOcupado(true);
    try { await alGuardar(t); alEditar(false); } catch { /* el aviso lo da quien guarda */ } finally { setOcupado(false); }
  };
  return (
    <div class="nota-fijada-editar">
      <textarea class="area" rows="2" maxLength={500} value={texto} autoFocus aria-label="Tu nota para este ejercicio"
        placeholder="Ajustes de la máquina, agarre, lo que quieras recordar cada vez" onInput={(e) => setTexto(e.currentTarget.value)} />
      <div class="fila-envolver">
        <button type="button" class="btn btn-peq btn-primario" disabled={ocupado} onClick={() => guardar(texto)}>Guardar nota</button>
        <button type="button" class="btn btn-peq" onClick={() => alEditar(false)}>Cancelar</button>
        {nota && <button type="button" class="btn btn-peq btn-peligro" disabled={ocupado} onClick={() => guardar('')}>Quitar</button>}
      </div>
    </div>
  );
}
