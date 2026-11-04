// v0.59 (19): la tira de miniaturas bajo el reproductor (de 12 a 20, unas dos por segundo), sacadas en este móvil: otro
// <video> del mismo archivo va a cada momento y se pinta en un lienzo de 80 px de alto. Sin prisa (una cada poco, para
// no trabar el vídeo que se ve), se para si se cierra y se guarda para la sesión (por vídeo; como mucho de 8). Al cerrar
// la sesión se olvida (olvidarTiras, con las demás cachés). Ni en un vídeo muy corto ni en un móvil con poca memoria.
// Tocar o arrastrar en ella lleva el vídeo a ese momento; con el teclado, ← → de miniatura en miniatura, Inicio y Fin.
import { useEffect, useRef, useState } from 'preact/hooks';
import { momentosTira, tiraDisponible, momentoEnTira, indiceTira, ALTO_TIRA } from '../../logica/movimiento.js';
import { textoMomento } from '../../logica/momentos.js';

const MAX_TIRAS = 8;
const cache = new Map(); // clave → { momentos, lienzos: [canvas | null], completa }
export function olvidarTiras() { cache.clear(); }
export const tirasGuardadas = () => [...cache.keys()];
const tomar = (clave) => { const x = cache.get(clave); if (x) { cache.delete(clave); cache.set(clave, x); } return x || null; };
const guardar = (clave, x) => { cache.delete(clave); cache.set(clave, x); while (cache.size > MAX_TIRAS) cache.delete(cache.keys().next().value); };
const esperar = (el, ev, ms) => new Promise((ok, mal) => {
  const t = setTimeout(() => { quitar(); mal(new Error('tarde')); }, ms);
  const bien = () => { quitar(); ok(); };
  const fallo = () => { quitar(); mal(new Error('error')); };
  const quitar = () => { clearTimeout(t); el.removeEventListener(ev, bien); el.removeEventListener('error', fallo); };
  el.addEventListener(ev, bien, { once: true }); el.addEventListener('error', fallo, { once: true });
});
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const memoria = () => { try { return typeof navigator !== 'undefined' ? navigator.deviceMemory ?? null : null; } catch { return null; } };

// Saca las miniaturas (alAvanzar con cada una); para con senal.parar
async function sacarMiniaturas(src, momentos, { senal, alAvanzar }) {
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto';
  v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
  const lienzos = momentos.map(() => null);
  try {
    v.src = src;
    await esperar(v, 'loadedmetadata', 10000);
    const vw = v.videoWidth || 9, vh = v.videoHeight || 16;
    const h = ALTO_TIRA, w = Math.max(1, Math.round((ALTO_TIRA * vw) / vh));
    for (let i = 0; i < momentos.length; i++) {
      if (senal.parar) return null;
      v.currentTime = Math.min(momentos[i], Math.max(0, (v.duration || momentos[i]) - 0.05));
      await esperar(v, 'seeked', 5000);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(v, 0, 0, w, h);
      lienzos[i] = c;
      alAvanzar([...lienzos]);
      await pausa(40);
    }
    return lienzos;
  } catch { return lienzos.some(Boolean) ? lienzos : null; } finally {
    try { v.removeAttribute('src'); v.load(); } catch { /* */ }
  }
}

function Miniatura({ lienzo, t }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !lienzo) return;
    c.width = lienzo.width; c.height = lienzo.height;
    try { c.getContext('2d').drawImage(lienzo, 0, 0); } catch { /* */ }
  }, [lienzo]);
  return <span class={`tira-celda ${lienzo ? '' : 'vacia'}`} data-t={t}>{lienzo && <canvas ref={ref} aria-hidden="true" />}</span>;
}

export function TiraMiniaturas({ src, clave, dur, t, irA, listo }) {
  const [lienzos, setLienzos] = useState(() => tomar(clave)?.lienzos || null);
  const caja = useRef(null);
  const arrastre = useRef(false);
  const momentos = momentosTira(dur);
  const disponible = listo && tiraDisponible({ dur, memoria: memoria() });
  useEffect(() => {
    if (!disponible || !src) return undefined;
    const ya = tomar(clave);
    if (ya?.completa && ya.momentos.length === momentos.length) { setLienzos(ya.lienzos); return undefined; }
    const senal = { parar: false };
    // Un poco después de abrir el vídeo (que arranque antes el que se ve)
    const t0 = setTimeout(() => {
      sacarMiniaturas(src, momentos, { senal, alAvanzar: (ls) => { if (!senal.parar) setLienzos(ls); } }).then((ls) => {
        if (ls && !senal.parar) guardar(clave, { momentos, lienzos: ls, completa: ls.every(Boolean) });
      });
    }, 500);
    return () => { senal.parar = true; clearTimeout(t0); };
  }, [clave, src, disponible, momentos.length]);
  if (!disponible) return null;
  const i = indiceTira(momentos, t);
  const ir = (k) => { const j = Math.max(0, Math.min(momentos.length - 1, k)); irA(momentos[j]); };
  const aMomento = (e) => { const b = caja.current?.getBoundingClientRect(); if (!b?.width) return; irA(momentoEnTira((e.clientX - b.left) / b.width, dur)); };
  const tecla = (e) => {
    const m = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
    if (m != null) { e.preventDefault(); e.stopPropagation(); ir(i + m); }
    else if (e.key === 'Home') { e.preventDefault(); e.stopPropagation(); ir(0); }
    else if (e.key === 'End') { e.preventDefault(); e.stopPropagation(); ir(momentos.length - 1); }
  };
  return (
    <div class="rep-tira" ref={caja} role="slider" tabIndex={0} aria-label="Miniaturas del vídeo: toca una para ir a ese momento"
      aria-valuemin={0} aria-valuemax={Math.round(dur * 10) / 10} aria-valuenow={Math.round(t * 10) / 10} aria-valuetext={`${textoMomento(t, true)}, miniatura ${i + 1} de ${momentos.length}`}
      onKeyDown={tecla}
      onPointerDown={(e) => { if (e.button > 0) return; arrastre.current = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ } aMomento(e); }}
      onPointerMove={(e) => { if (arrastre.current) aMomento(e); }}
      onPointerUp={() => { arrastre.current = false; }} onPointerCancel={() => { arrastre.current = false; }}>
      {momentos.map((m, k) => <Miniatura key={k} lienzo={lienzos?.[k] || null} t={m} />)}
      <span class="tira-cursor" aria-hidden="true" style={{ left: `${dur > 0 ? Math.min(100, (t / dur) * 100) : 0}%` }} />
    </div>
  );
}
