import { useEffect, useRef, useState } from 'preact/hooks';
import { fechaMadrid } from '../logica/fechas.js';
import { tocaBienvenida, mensajeBienvenida } from '../logica/bienvenida.js';

// v0.68: la bienvenida personalizada, una vez al día (la primera vez que se abre la app ese día, en este móvil y con esta
// cuenta). Sigue a la portada de arranque (el mismo fondo) y dice algo según cómo va: la primera vez, un récord reciente,
// días sin entrenar, lo que toca hoy, la racha… y «Empezar» cuando ya está todo cargado. Nunca con una sesión a medias.
const claveVista = (uid) => `fbe-bienvenida-${uid}`;
const claveRecord = (atletaId) => `fbe-ultimo-record-${atletaId}`;
const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento: sale una vez por visita */ } };

// El último récord (para la bienvenida de los dos días siguientes): solo en este móvil
export function apuntarRecord(atletaId, ejercicio) {
  if (atletaId && ejercicio) guardar(claveRecord(atletaId), JSON.stringify({ fecha: fechaMadrid(), ejercicio: String(ejercicio).slice(0, 80) }));
}
const leerRecord = (atletaId) => { try { const x = JSON.parse(leer(claveRecord(atletaId)) || 'null'); return x && typeof x.ejercicio === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.fecha) ? x : null; } catch { return null; } };

// (se decide la primera vez que llega la cuenta: mientras uid es null, por ejemplo cargando, todavía no)
export function useBienvenida(uid, { sesionEnCurso = false } = {}) {
  const decidida = useRef(null);
  const [cerrada, setCerrada] = useState(false);
  // (en un navegador automático, las pruebas, solo si la prueba la pide: si no, taparía todas las demás)
  const automatico = typeof navigator !== 'undefined' && navigator.webdriver && !leer('fbe-probar-bienvenida');
  if (uid && decidida.current === null) decidida.current = !automatico && tocaBienvenida({ vista: leer(claveVista(uid)), hoy: fechaMadrid(), sesionEnCurso });
  const cerrar = () => { if (uid) guardar(claveVista(uid), fechaMadrid()); setCerrada(true); };
  return [!!uid && decidida.current === true && !cerrada, cerrar];
}

// (v0.72) ¿Está abierta la bienvenida del día? Para que otra hoja (la de las medallas nuevas) espere a que se cierre y no se
// le ponga encima quitándole el foco
let abiertaAhora = false;
const oyentes = new Set();
const avisarAbierta = (v) => { abiertaAhora = v; oyentes.forEach((f) => f(v)); };
export function useBienvenidaAbierta() {
  const [v, setV] = useState(abiertaAhora);
  useEffect(() => { oyentes.add(setV); setV(abiertaAhora); return () => oyentes.delete(setV); }, []);
  return v;
}

// datos: null mientras carga; luego lo de mensajeBienvenida (sin el nombre ni el rol, que van aparte)
export function Bienvenida({ rol = 'atleta', nombre, atletaId = null, datos = null, alCerrar }) {
  const boton = useRef(null);
  useEffect(() => { avisarAbierta(true); return () => avisarAbierta(false); }, []);
  const [esperaLarga, setEsperaLarga] = useState(false);
  // (si tarda más de 4 s en cargar, «Empezar» igual: la bienvenida nunca te deja esperando)
  useEffect(() => { const t = setTimeout(() => setEsperaLarga(true), 4000); return () => clearTimeout(t); }, []);
  const listo = rol === 'coach' || !!datos || esperaLarga;
  const m = mensajeBienvenida({ rol, nombre, hoy: fechaMadrid(), record: atletaId ? leerRecord(atletaId) : null, ...(datos || {}) });
  useEffect(() => { if (listo) boton.current?.focus(); }, [listo]);
  useEffect(() => {
    const al = (e) => { if (e.key === 'Escape' && listo) alCerrar(); };
    document.addEventListener('keydown', al);
    return () => document.removeEventListener('keydown', al);
  }, [listo]);
  return (
    <div class="bdia" role="dialog" aria-modal="true" aria-labelledby="bdia-titulo" aria-describedby="bdia-mensaje">
      <div class="bdia-cuerpo">
        <h1 id="bdia-titulo"><span class="bdia-saludo">{m.saludo}</span> <span class="bdia-nombre">{m.nombre}</span></h1>
        <p id="bdia-mensaje" class="bdia-mensaje" aria-live="polite">{listo ? m.mensaje : 'Preparando tu día…'}</p>
        {listo && m.detalle && <p class="bdia-detalle">{m.detalle}</p>}
      </div>
      <button ref={boton} class="bdia-empezar" disabled={!listo} onClick={alCerrar}>{listo ? 'Empezar' : 'Cargando…'}</button>
    </div>
  );
}
