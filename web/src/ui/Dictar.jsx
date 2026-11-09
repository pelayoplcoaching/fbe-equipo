// (054) Dictar en vez de escribir: un botón que escucha con el reconocimiento de voz del navegador (en el iPhone, el de Safari;
// en Android, el de Chrome) y va pasando el texto a quien lo pide. Si el navegador no lo tiene, el botón no sale.
// Nada se graba ni se guarda: el texto reconocido va al campo como si se hubiera tecleado.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icono, useApp } from './comunes.jsx';

const Reconocedor = () => (typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null);
export const hayDictado = () => !!Reconocedor();

export function Dictar({ alTexto, etiqueta = 'Dictar', idioma = 'es-ES', clase = '' }) {
  const { aviso } = useApp();
  const [escuchando, setEscuchando] = useState(false);
  const rec = useRef(null);
  useEffect(() => () => { try { rec.current?.abort(); } catch { /* nada */ } }, []);
  if (!hayDictado()) return null;
  const parar = () => { try { rec.current?.stop(); } catch { /* nada */ } setEscuchando(false); };
  const empezar = () => {
    const R = Reconocedor();
    if (!R) return;
    try {
      const r = new R();
      r.lang = idioma; r.interimResults = false; r.continuous = false; r.maxAlternatives = 1;
      r.onresult = (ev) => {
        const t = Array.from(ev.results).map((x) => x[0]?.transcript || '').join(' ').replace(/\s+/g, ' ').trim();
        if (t) alTexto(t.charAt(0).toUpperCase() + t.slice(1));
      };
      r.onerror = (ev) => { setEscuchando(false); if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') aviso('Para dictar, permite el micrófono a la app en los ajustes del navegador', 'error'); else if (ev.error !== 'aborted' && ev.error !== 'no-speech') aviso('No se ha entendido: prueba otra vez o escríbelo', 'error'); };
      r.onend = () => setEscuchando(false);
      rec.current = r;
      r.start();
      setEscuchando(true);
    } catch { setEscuchando(false); aviso('El dictado no está disponible en este navegador', 'error'); }
  };
  return (
    <button type="button" class={`btn btn-peq dictar ${escuchando ? 'escuchando' : ''} ${clase}`} aria-pressed={escuchando ? 'true' : 'false'} aria-label={escuchando ? 'Parar el dictado' : etiqueta}
      onClick={() => (escuchando ? parar() : empezar())}>
      <Icono n="micro" /> {escuchando ? 'Escuchando…' : etiqueta}
    </button>
  );
}
