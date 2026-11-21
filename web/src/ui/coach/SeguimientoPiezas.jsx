// (v0.203) Piezas de Seguimiento (ficha del coach): el índice que se queda arriba al bajar y la tendencia de cada
// respuesta del check-in en sus últimas semanas.
import { useEffect, useState } from 'preact/hooks';
import { num } from '../../logica/calculos.js';
import { fmtCorta } from '../../logica/fechas.js';
import { tendenciasCheckin } from '../../logica/seguimiento-visual.js';
import { Icono } from '../comunes.jsx';
import { sinMovimiento } from '../transiciones.js';
import { MiniLinea } from '../atleta/ProgresoPiezas.jsx';

// apartados: [[id, texto]] (los id de los envoltorios de cada apartado). El que se está viendo va marcado.
export function IndiceSeguimiento({ apartados = [] }) {
  const [actual, setActual] = useState(apartados[0]?.[0] || null);
  const ids = apartados.map(([id]) => id).join();
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const els = apartados.map(([id]) => document.getElementById(id)).filter(Boolean);
    if (!els.length) return undefined;
    const io = new IntersectionObserver((es) => {
      const vis = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis.length) setActual(vis[0].target.id);
    }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids]);
  if (apartados.length < 2) return null;
  const ir = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: sinMovimiento() ? 'auto' : 'smooth', block: 'start' });
    setActual(id);
    const h = el.querySelector('h2');
    if (h) { if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  };
  return (
    <nav class="indice-seg" aria-label="Apartados de Seguimiento">
      <div class="indice-seg-tira">
        {apartados.map(([id, t]) => <button type="button" key={id} aria-current={actual === id ? 'true' : undefined} onClick={() => ir(id)}>{t}</button>)}
      </div>
    </nav>
  );
}

// Una baldosa por respuesta (sueño, energía, recuperación, motivación y pasos) con su minilínea de 8 semanas
const TEXTO = {
  sueno: (v) => `${num(v, 1)} h`, energia: (v) => `${num(v, 0)}/5`, recuperacion: (v) => `${num(v, 0)}/5`, motivacion: (v) => `${num(v, 0)}/5`, pasos: (v) => num(v, 0),
};
export function TendenciasCheckin({ checkins = [] }) {
  const lista = tendenciasCheckin(checkins, 8);
  if (!lista.length) return null;
  return (
    <ul class="tendencias-checkin" aria-label="Cómo han ido sus respuestas en las últimas semanas">
      {lista.map((t) => (
        <li key={t.clave} class={`tendencia ${t.cambio}`}>
          <span class="tendencia-nombre mini">{t.nombre}</span>
          <span class="tendencia-valor num">{TEXTO[t.clave](t.ultimo)}{t.cambio !== 'igual' && <Icono n={t.cambio === 'sube' ? 'arriba' : 'abajo'} />}</span>
          <MiniLinea valores={t.valores} ancho={88} alto={26} clase="tendencia-linea" />
          <span class="sr">{t.cambio === 'sube' ? 'Sube' : t.cambio === 'baja' ? 'Baja' : 'Igual'} frente a la semana anterior ({TEXTO[t.clave](t.antes)}). Desde el {fmtCorta(t.semanas[0])}: {t.valores.map((v) => TEXTO[t.clave](v)).join(', ')}.</span>
        </li>
      ))}
    </ul>
  );
}
