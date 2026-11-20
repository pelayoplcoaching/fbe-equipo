// (v0.200, belleza) La escena de la versión 200: una sola vez en este móvil, a quien ya usaba la app. El lobo se dibuja de un
// trazo, se llena, y debajo sube el «200» cifra a cifra; con el «200», confeti del color de cada uno (si celebra «lo
// demás» con todo). Con «reducir movimiento», todo quieto desde el principio. Después, la hoja «Novedades» de siempre.
import { useEffect, useRef, useState } from 'preact/hooks';
import { LOBO_CAJA, LOBO_D } from './lobo-trazo.js';
import { lanzarConfeti } from './confeti.js';
import { sinMovimiento } from './transiciones.js';
import { tocaEscena200, CLAVE_ESCENA_200 } from '../logica/belleza.js';
import { claveVersionVista } from '../logica/novedades-app.js';

/* global __APP_VERSION__ */
const VERSION_APP = typeof __APP_VERSION__ !== 'undefined' ? String(__APP_VERSION__) : '0.0.0';
const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento: sale una vez por visita */ } };

// [ver, cerrar]: se decide una vez, al llegar la cuenta (con la versión que vio esa cuenta en este móvil)
export function useEscena200(uid) {
  const [ver, setVer] = useState(() => !!uid && tocaEscena200({
    vista: leer(CLAVE_ESCENA_200), vistaVersion: leer(claveVersionVista(uid)), actual: VERSION_APP,
    automatico: typeof navigator !== 'undefined' && !!navigator.webdriver && !leer('fbe-probar-escena-200'),
  }));
  const cerrar = () => { guardar(CLAVE_ESCENA_200, '1'); setVer(false); };
  return [ver, cerrar];
}

const TEXTO = {
  atleta: 'Doscientas versiones desde la primera. Esta trae un cielo que cambia con la hora, copos en Navidad, dos colores nuevos y muchos detalles. Gracias por entrenar con nosotros.',
  coach: 'Doscientas versiones de tu app. Esta trae el cielo de la hora, la decoración de temporada, dos colores nuevos y una lista de Atletas más bonita.',
};

export function Escena200({ rol = 'atleta', alCerrar }) {
  const boton = useRef(null);
  const quieto = sinMovimiento();
  const [listo, setListo] = useState(quieto);
  useEffect(() => {
    const previo = document.activeElement;
    // (el foco, al botón cuando aparece; con Escape también se sigue)
    const t1 = setTimeout(() => boton.current?.focus({ preventScroll: true }), quieto ? 0 : 1900);
    const t2 = quieto ? 0 : setTimeout(() => { setListo(true); lanzarConfeti({ vibracion: 'record', momento: 'otros' }); }, 1700);
    const tecla = (e) => { if (e.key === 'Escape') { e.preventDefault(); alCerrar?.(); } };
    document.addEventListener('keydown', tecla);
    return () => { clearTimeout(t1); clearTimeout(t2); document.removeEventListener('keydown', tecla); try { previo?.focus?.({ preventScroll: true }); } catch { /* */ } };
  }, []);
  return (
    <div class={`escena-200${listo ? ' lista' : ''}`} role="dialog" aria-modal="true" aria-labelledby="e200-titulo" aria-describedby="e200-texto">
      <div class="e200-cuerpo">
        <svg class="e200-lobo" viewBox={LOBO_CAJA} aria-hidden="true" focusable="false">
          <path class="e200-trazo" d={LOBO_D} pathLength="1" fill="none" />
          <path class="e200-lleno" d={LOBO_D} fill-rule="evenodd" />
        </svg>
        <p class="e200-cifra" aria-hidden="true"><span>2</span><span>0</span><span>0</span></p>
        <h1 id="e200-titulo">La app llega a la versión 200</h1>
        <p id="e200-texto" class="e200-texto">{TEXTO[rol] || TEXTO.atleta}</p>
        <button ref={boton} type="button" class="btn btn-primario btn-grande e200-seguir" onClick={alCerrar}>Seguir</button>
      </div>
    </div>
  );
}
