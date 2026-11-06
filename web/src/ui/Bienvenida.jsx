import { useEffect, useRef, useState } from 'preact/hooks';
import { fechaMadrid } from '../logica/fechas.js';
import { LOBO_CAJA, LOBO_D } from './lobo-trazo.js';
import { Icono } from './comunes.jsx';
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

// Tanda 11 de diseño: el panel de debajo del saludo (logica/bienvenida.js: panelBienvenida y panelCoach). Solo pinta.
const ESTADO_SEMANA = { completa: 'completa', parcial: 'a medias', vacia: 'sin entrenar', sin: 'sin programa' };
function Cifra({ c }) {
  return (
    <div class={`bdia-cifra bdia-cifra-${c.id}`}>
      <dt>{c.etiqueta}</dt>
      <dd>
        <span class="bdia-cifra-v"><span class="num">{c.valor}</span>{c.de != null && <small>de {c.de}</small>}{c.id === 'racha' && c.valor > 0 && <Icono n="llama" />}</span>
        {c.puntos > 0 && <span class="bdia-puntos" aria-hidden="true">{Array.from({ length: c.puntos }, (_, i) => <i key={i} class={i < c.valor ? 'on' : ''} />)}</span>}
        {!c.puntos && c.barra != null && <span class="bdia-barra" aria-hidden="true"><i style={{ width: `${Math.round(Math.max(0, Math.min(1, c.barra)) * 100)}%` }} /></span>}
        {c.detalle && <span class="bdia-cifra-d">{c.detalle}</span>}
      </dd>
    </div>
  );
}
function Tablero({ panel }) {
  const { sesion, cifras, semanas, completas, animo } = panel;
  const cuenta = (e) => semanas.filter((s) => s.estado === e).length;
  const resumen = semanas.length ? ['completa', 'parcial', 'vacia'].map((e) => [cuenta(e), ESTADO_SEMANA[e]]).filter(([n]) => n > 0).map(([n, t]) => `${n} ${t}${n > 1 && t === 'completa' ? 's' : ''}`).join(', ') : '';
  return (
    <div class="bdia-tablero">
      {sesion && (
        <div class="bdia-sesion">
          <span class="bdia-sobre">{sesion.sobre}</span>
          <strong>{sesion.titulo}</strong>
          {sesion.meta && <span class="bdia-sesion-meta">{sesion.meta}</span>}
        </div>
      )}
      {cifras.length > 0 && <dl class={`bdia-cifras bdia-cifras-${cifras.length}`}>{cifras.map((c) => <Cifra key={c.id} c={c} />)}</dl>}
      {semanas.length > 0 && (
        <div class="bdia-doce">
          <div class="bdia-doce-cab"><span class="bdia-sobre">Últimas 12 semanas</span><span class="bdia-doce-n">{completas} {completas === 1 ? 'completa' : 'completas'}</span></div>
          <div class="bdia-semanas" role="img" aria-label={`Tus últimas 12 semanas: ${resumen || 'sin sesiones'}`}>
            {semanas.map((s) => <i key={s.lunes} class={`${s.estado}${s.actual ? ' actual' : ''}`} />)}
          </div>
        </div>
      )}
      {animo && <p class="bdia-animo">{animo}</p>}
    </div>
  );
}
const fechaCorta = () => { try { return new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Madrid' }).format(new Date()).replace(/[.,]/g, ''); } catch { return ''; } };

// datos: null mientras carga; luego lo de mensajeBienvenida (sin el nombre ni el rol, que van aparte)
// panel: lo de panelBienvenida o panelCoach (o null: entonces, solo el saludo y el mensaje, como hasta la v0.87)
export function Bienvenida({ rol = 'atleta', nombre, atletaId = null, datos = null, panel = null, alCerrar }) {
  const boton = useRef(null);
  useEffect(() => { avisarAbierta(true); return () => avisarAbierta(false); }, []);
  const [esperaLarga, setEsperaLarga] = useState(false);
  // (si tarda más de 4 s en cargar, «Empezar» igual: la bienvenida nunca te deja esperando)
  useEffect(() => { const t = setTimeout(() => setEsperaLarga(true), 4000); return () => clearTimeout(t); }, []);
  const listo = rol === 'coach' || !!datos || esperaLarga;
  const m = mensajeBienvenida({ rol, nombre, hoy: fechaMadrid(), record: atletaId ? leerRecord(atletaId) : null, ...(datos || {}) });
  const conPanel = listo && !!panel && (panel.cifras?.length > 0 || !!panel.sesion);
  // En una pantalla baja el cuerpo se desliza (con «Empezar» siempre a la vista): entonces tiene que poder recibir el
  // foco, para deslizarlo con el teclado
  const cuerpo = useRef(null);
  const [desliza, setDesliza] = useState(false);
  useEffect(() => {
    const el = cuerpo.current;
    if (!el) return undefined;
    const mirar = () => setDesliza(el.scrollHeight > el.clientHeight + 1);
    mirar();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(mirar);
    ro?.observe(el);
    for (const h of el.children) ro?.observe(h);
    return () => ro?.disconnect();
  }, [conPanel]);
  useEffect(() => { if (listo) boton.current?.focus(); }, [listo]);
  useEffect(() => {
    const al = (e) => { if (e.key === 'Escape' && listo) alCerrar(); };
    document.addEventListener('keydown', al);
    return () => document.removeEventListener('keydown', al);
  }, [listo]);
  return (
    <div class={`bdia${conPanel ? ' bdia-con-panel' : ''}`} role="dialog" aria-modal="true" aria-labelledby="bdia-titulo" aria-describedby="bdia-mensaje">
      <div class="bdia-cuerpo" ref={cuerpo} {...(desliza ? { tabIndex: 0, role: 'group', 'aria-label': 'Tu resumen de hoy' } : {})}>
        <div class="bdia-arriba">
          <span class="bdia-marca"><svg viewBox={LOBO_CAJA} aria-hidden="true" focusable="false"><path fill-rule="evenodd" d={LOBO_D} /></svg>FBE Equipo</span>
          <span class="bdia-fecha">{fechaCorta()}</span>
        </div>
        <h1 id="bdia-titulo"><span class="bdia-saludo">{m.saludo}</span> <span class="bdia-nombre">{m.nombre}</span></h1>
        <p id="bdia-mensaje" class="bdia-mensaje" aria-live="polite">{listo ? m.mensaje : 'Preparando tu día…'}</p>
        {/* (con el panel, la racha y lo que toca ya van en él: el detalle sobraría) */}
        {listo && !conPanel && m.detalle && <p class="bdia-detalle">{m.detalle}</p>}
        {conPanel && <Tablero panel={panel} />}
      </div>
      <button ref={boton} class="bdia-empezar" disabled={!listo} onClick={alCerrar}>{listo ? 'Empezar' : 'Cargando…'}</button>
    </div>
  );
}
