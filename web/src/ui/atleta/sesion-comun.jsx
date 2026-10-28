import { useEffect, useRef, useState } from 'preact/hooks';
import { leerAjustes } from '../ajustes.js';
import { SONIDOS } from '../../datos/sonidos-descanso.js';
import { Icono } from '../comunes.jsx';
import { propuestaSerie, sugerenciaProgresion, esBarra, mmss, esTopBackoff, propuestaBackoff } from '../../logica/calculos.js';

// Piezas compartidas por la sesión (lista) y el modo enfoque

export const RPES = ['', 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
export const COLOR_DISCO = { alta: 'var(--disco-rojo)', media: 'var(--disco-azul)', baja: 'var(--disco-amarillo)', muy_baja: 'var(--disco-verde)' };

// ---------- sonido y vibración al acabar el descanso (el audio se activa con el primer toque) ----------
// Los sonidos son los de FBE Timer (v0.27, a petición de los atletas: el pitido de antes se oía muy bajo).
// Van como audio normal del móvil (con su volumen multimedia, y suenan aunque el iPhone esté en silencio);
// «Pitido suave» es el de antes.
export const SONIDOS_DESCANSO = [['tres-beeps', 'Tres beeps'], ['estadio', 'Beep estadio'], ['boxeo', 'Campana de boxeo'], ['silbato', 'Silbato'], ['motivador', 'Tono motivador'], ['suave', 'Pitido suave']];
let audio = null;
const elementos = {};
function elemento(k) {
  if (!SONIDOS[k] || typeof Audio === 'undefined') return null;
  if (!elementos[k]) { elementos[k] = new Audio(SONIDOS[k]); elementos[k].preload = 'auto'; }
  return elementos[k];
}
export function prepararAudio() {
  try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch { audio = null; }
  // iPhone: un audio solo suena solo (al acabar el descanso) si antes se ha puesto en marcha con un toque
  const el = elemento(leerAjustes().sonidoDescanso);
  if (el && !el.dataset?.listo && !el.listo) {
    try {
      el.muted = true;
      el.play().then(() => { el.pause(); el.currentTime = 0; el.muted = false; el.listo = true; }).catch(() => { el.muted = false; });
    } catch { el.muted = false; }
  }
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
// sonido: para «Probar» uno sin haberlo guardado
export function pitar(sonido = null) {
  const a = leerAjustes();
  if (a.vibracion) try { navigator.vibrate?.([200, 100, 200, 100, 400]); } catch { /* */ }
  if (!a.sonido) return;
  const volumen = Math.min(1, Math.max(0.1, Number(a.volumen) || 1));
  const el = elemento(sonido || a.sonidoDescanso);
  if (!el) { pitidoSuave(volumen); return; }
  try {
    el.volume = volumen;
    el.currentTime = 0;
    const p = el.play();
    p?.catch?.(() => pitidoSuave(volumen));
  } catch { pitidoSuave(volumen); }
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

// Récord: vibración más larga y tres notas que suben
export function celebrar() {
  const a = leerAjustes();
  if (a.vibracion) try { navigator.vibrate?.([40, 60, 40, 60, 180]); } catch { /* */ }
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
export function Temporizador({ fin, total, prioridad, texto, alCambiar, clase = '' }) {
  const ahora = useAhora(250);
  const quedan = Math.max(0, (fin - ahora) / 1000);
  const avisado = useRef(false);
  useEffect(() => {
    if (quedan <= 0 && !avisado.current) { avisado.current = true; pitar(); }
    if (quedan > 0) avisado.current = false;
  }, [quedan <= 0]);
  // Como FBE Timer: un pitido corto en cada uno de los 3 últimos segundos
  const segundo = Math.ceil(quedan);
  const contado = useRef(null);
  useEffect(() => {
    if (segundo >= 1 && segundo <= 3 && contado.current !== segundo && leerAjustes().cuentaAtras) {
      tono(660, 0.1, 0.35 * Math.min(1, Math.max(0.1, Number(leerAjustes().volumen) || 1)));
      vibrarCorto(80);
    }
    contado.current = segundo;
  }, [segundo]);
  useEffect(() => {
    if (quedan > 0) return undefined;
    const t = setTimeout(() => alCambiar(null), 6000);
    return () => clearTimeout(t);
  }, [quedan <= 0]);
  const R = 31, C = 2 * Math.PI * R;
  const frac = total ? Math.min(1, quedan / total) : 0;
  const ajustar = (s) => alCambiar({ fin: Math.max(Date.now(), fin) + s * 1000, total: Math.max(total, (Math.max(Date.now(), fin) - Date.now()) / 1000 + s), prioridad, texto });
  return (
    <div class={`temporizador ${clase} ${quedan <= 0 ? 'fin' : ''}`} role="timer" aria-live="off">
      <svg class="disco-t" viewBox="0 0 76 76" aria-hidden="true">
        <circle cx="38" cy="38" r={R} fill="none" stroke="currentColor" stroke-opacity=".18" stroke-width="10" />
        <circle cx="38" cy="38" r={R} fill="none" stroke={COLOR_DISCO[prioridad] || 'var(--morado)'} stroke-width="10"
          stroke-dasharray={C} stroke-dashoffset={C * (1 - frac)} transform="rotate(-90 38 38)" style="transition: stroke-dashoffset .25s linear" />
        <circle cx="38" cy="38" r="9" fill="currentColor" fill-opacity=".9" />
      </svg>
      <div>
        <div class="cuenta num" role="timer" aria-label={quedan > 0 ? `Descanso: quedan ${Math.ceil(quedan)} segundos` : 'Descanso terminado'}>{quedan > 0 ? mmss(quedan) : '¡Vamos!'}</div>
        <div class="que">{quedan > 0 ? `Después: ${texto}` : 'Descanso terminado'}</div>
      </div>
      <div class="acciones">
        <button onClick={() => ajustar(-15)} aria-label="Quitar 15 segundos">−15</button>
        <button onClick={() => ajustar(15)} aria-label="Añadir 15 segundos">+15</button>
        <button class="saltar" onClick={() => alCambiar(null)}>{quedan > 0 ? 'Saltar' : 'Cerrar'}</button>
      </div>
    </div>
  );
}


// Lo que hace falta para proponer cada serie de un ejercicio (con o sin alternativa)
export function prepararEjercicio(e, actual, ultimas, foco, progresionAuto) {
  const ej = actual || e.ejercicio;
  // Con una alternativa no vale la carga pautada para el original: se parte de lo que hizo con la alternativa
  const prescripcion = actual ? { ...e, carga_sugerida_kg: null } : e;
  const sugerencia = progresionAuto ? sugerenciaProgresion(prescripcion, ultimas?.series, { nombre: ej.nombre, foco, pautaAnterior: ultimas?.pauta }) : null;
  const barra = esBarra(ej.nombre);
  const top = esTopBackoff(prescripcion);
  const deLaTop = propuestaSerie(prescripcion, ultimas?.series, 1, { sugerencia, pautaAnterior: ultimas?.pauta });
  const propuesta = (k, hechas = {}) => {
    // Top + back-off: la back-off sale de lo que hizo de verdad en la top (o de lo propuesto, si aún no la ha hecho)
    const bo = top ? propuestaBackoff(prescripcion, k, hechas, deLaTop, ej.nombre) : null;
    if (bo) return bo;
    const previa = hechas[k - 1];
    return previa ? { kg: previa.kg, reps: previa.reps } : propuestaSerie(prescripcion, ultimas?.series, k, { sugerencia, pautaAnterior: ultimas?.pauta });
  };
  return {
    ej, prescripcion, sugerencia, barra, top,
    conAproximacion: barra || (ej.tipo || []).includes('basico'),
    kgTrabajo: deLaTop.kg,
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
