// (vista 271-273, v0.276) Leer a gusto. La barra de lectura: una línea fina arriba que avanza con lo leído y los minutos
// que quedan (unas 200 palabras por minuto). Sigue al desplazamiento de la página o de la hoja que tenga el texto; nada se
// mueve si no se desplaza. Y las guías leídas (solo su clave, en el móvil), para «Leída ✓».
import { useEffect, useRef, useState } from 'preact/hooks';
import { minutosLectura, avanceLectura, textoQuedan } from '../logica/lectura.js';

// La caja que desplaza un elemento (una hoja) o null si es la página
function cajaQueDesplaza(el) {
  for (let p = el?.parentElement; p && p !== document.body; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 4) return p;
  }
  return null;
}

// raiz: ref del texto que se lee; clave: lo que, al cambiar, vuelve a contar (otra guía)
export function BarraLectura({ raiz, clave = null }) {
  const barra = useRef(null);
  const [min, setMin] = useState(null);
  useEffect(() => {
    const art = raiz.current, b = barra.current;
    if (!art || !b) return undefined;
    const total = minutosLectura(art.textContent || '');
    const caja = cajaQueDesplaza(art);
    b.dataset.en = caja ? 'hoja' : 'pagina';
    // (en la página, justo debajo de la cabecera pegada de arriba, mida lo que mida)
    const colocar = () => {
      if (caja) return;
      const cab = document.querySelector('main .cabecera, .contenido > .cabecera');
      const fin = cab && getComputedStyle(cab).position === 'sticky' ? cab.getBoundingClientRect().height : 0;
      if (fin > 0 && b.style.top !== `${Math.round(fin)}px`) b.style.top = `${Math.round(fin)}px`;
    };
    let raf = 0, ultimo = null;
    const medir = () => {
      raf = 0;
      colocar();
      const r = art.getBoundingClientRect();
      // (el texto acaba donde empieza su final: «Guía leída» y la siguiente no cuentan como lectura)
      const f = art.querySelector('.lec-fin');
      const altoTexto = f ? Math.max(1, f.getBoundingClientRect().top - r.top) : r.height;
      const arriba = caja ? caja.getBoundingClientRect().top : 0;
      const alto = caja ? caja.clientHeight : window.innerHeight;
      const desplazado = caja ? caja.scrollTop : window.scrollY;
      const maxDesplazar = caja ? caja.scrollHeight - caja.clientHeight : document.documentElement.scrollHeight - window.innerHeight;
      const inicio = desplazado + (r.top - arriba);
      const p = avanceLectura({ arriba: r.top - arriba, alto: altoTexto, ventana: alto, maxRecorrido: maxDesplazar - inicio });
      b.style.setProperty('--p', p.toFixed(3));
      b.setAttribute('aria-valuenow', String(Math.round(p * 100)));
      const q = Math.max(0, Math.ceil(total * (1 - p) - 0.05));
      if (q !== ultimo) { ultimo = q; setMin(q); }
    };
    const al = () => { if (!raf) raf = requestAnimationFrame(medir); };
    const redim = () => { colocar(); al(); };
    const blanco = caja || window;
    blanco.addEventListener('scroll', al, { passive: true });
    window.addEventListener('resize', redim);
    colocar();
    medir();
    return () => { cancelAnimationFrame(raf); blanco.removeEventListener('scroll', al); window.removeEventListener('resize', redim); };
  }, [clave]);
  return (
    <div class="lec-barra" ref={barra} role="progressbar" aria-label="Lo que llevas de lectura" aria-valuemin="0" aria-valuemax="100" aria-valuetext={min == null ? undefined : textoQuedan(min, true)}>
      <span class="lec-pista" aria-hidden="true"><i class="lec-lleno" /></span>
      {min != null && <span class="lec-min num" aria-hidden="true">{textoQuedan(min)}</span>}
    </div>
  );
}

const CLAVE_LEIDAS = 'fbe-guias-leidas';
export const guiasLeidas = () => { try { const l = JSON.parse(localStorage.getItem(CLAVE_LEIDAS) || '[]'); return Array.isArray(l) ? l : []; } catch { return []; } };
export const marcarLeida = (clave) => { try { const l = guiasLeidas(); if (!l.includes(clave)) localStorage.setItem(CLAVE_LEIDAS, JSON.stringify([clave, ...l].slice(0, 200))); } catch { /* sin almacenamiento */ } };

// Un aviso cuando algo llega a verse (el final de la guía): vale = la mitad a la vista
export function useAlVerse(ref, fn, deps = []) {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(); } }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, deps);
}
