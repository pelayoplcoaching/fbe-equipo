// (v0.142) El tiempo para salir (Open-Meteo): en Hoy, para quien tiene cardio de fuera o carrera, el tiempo de ahora,
// las próximas horas, los avisos y la mejor hora para salir; en la sesión, los avisos de ahora encima de la pauta.
//  - La zona la elige el atleta (su ubicación o su ciudad), redondeada a unos 10 km, y se guarda solo en este móvil
//    (fbe-tiempo-zona:<uid>); la previsión, una hora en este móvil (fbe-tiempo-cache). Nada va a la base.
//  - Sin zona, la sesión no pregunta nada: solo Hoy invita (y se puede ocultar).
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { useApp, Icono } from '../comunes.jsx';
import { leerPreferencia, guardarPreferencia } from '../preferencias.js';
import {
  zonaLimpia, urlPrevision, urlAire, urlBuscar, leerPrevision, conAire, leerBusqueda, ahoraTiempo, horasDeHoy, mejorHora, avisosTiempo,
  cielo, textoAire, resumenTiempo,
} from '../../logica/tiempo.js';

const CLAVE_ZONA = (uid) => `fbe-tiempo-zona:${uid || 'sin-cuenta'}`;
const CLAVE_CACHE = 'fbe-tiempo-cache';
const VIGENCIA_MS = 60 * 60 * 1000;
const EVENTO = 'fbe-tiempo-zona';
const VERBO = { carrera: 'correr', andar: 'andar', bici: 'montar en bici' };
const sinRed = () => typeof navigator !== 'undefined' && navigator.onLine === false;

async function pedirJson(url, ms = 9000) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = ctl ? setTimeout(() => ctl.abort(), ms) : null;
  try {
    // sin cookies ni de dónde viene: a Open-Meteo solo le llega la zona redondeada
    const r = await fetch(url, { signal: ctl?.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!r.ok) throw new Error(`Open-Meteo respondió ${r.status}`);
    return await r.json();
  } finally { if (t) clearTimeout(t); }
}

// La previsión de una zona (de este móvil si tiene menos de una hora); la calidad del aire, si llega
export async function cargarTiempo(zona, { forzar = false } = {}) {
  const z = zonaLimpia(zona);
  if (!z) return null;
  const clave = `${z.lat},${z.lon}`;
  if (!forzar) {
    try {
      const c = JSON.parse(localStorage.getItem(CLAVE_CACHE) || 'null');
      if (c?.clave === clave && Date.now() - c.en < VIGENCIA_MS && Array.isArray(c.prev?.horas)) return c.prev;
    } catch { /* sin almacenamiento: se pide */ }
  }
  const [p, a] = await Promise.all([pedirJson(urlPrevision(z)), pedirJson(urlAire(z)).catch(() => null)]);
  const prev = conAire(leerPrevision(p), a);
  if (!prev) throw new Error('La previsión ha llegado vacía');
  try { localStorage.setItem(CLAVE_CACHE, JSON.stringify({ clave, en: Date.now(), prev })); } catch { /* queda en pantalla */ }
  return prev;
}

// La zona de este móvil y su previsión (lo comparten Hoy y la sesión: al cambiar la zona en uno, cambia en el otro)
export function useTiempo() {
  const { api } = useApp();
  const clave = CLAVE_ZONA(api?.uid?.());
  const [zona, setZona] = useState(() => zonaLimpia(leerPreferencia(clave, null)));
  const [st, setSt] = useState({ prev: null, cargando: false, error: null });
  const [vuelta, setVuelta] = useState(0);
  const forzar = useRef(false);
  const [refresco, setRefresco] = useState(0);
  useEffect(() => {
    const al = () => setZona(zonaLimpia(leerPreferencia(clave, null)));
    // al volver a la app, «ahora» y la mejor hora se recalculan (y la previsión, si ya tiene más de una hora)
    const visible = () => { if (document.visibilityState === 'visible') setRefresco((n) => n + 1); };
    window.addEventListener(EVENTO, al);
    document.addEventListener('visibilitychange', visible);
    return () => { window.removeEventListener(EVENTO, al); document.removeEventListener('visibilitychange', visible); };
  }, [clave]);
  useEffect(() => {
    if (!zona) { setSt({ prev: null, cargando: false, error: null }); return undefined; }
    let vivo = true;
    setSt((s) => ({ ...s, cargando: !s.prev, error: null }));
    const f = forzar.current;
    forzar.current = false;
    cargarTiempo(zona, { forzar: f })
      .then((prev) => { if (vivo) setSt({ prev, cargando: false, error: null }); })
      .catch(() => { if (vivo) setSt((s) => ({ prev: s.prev, cargando: false, error: sinRed() ? 'sin-red' : 'fallo' })); });
    return () => { vivo = false; };
  }, [zona?.lat, zona?.lon, vuelta, refresco]);
  const fijarZona = useCallback((z) => {
    const limpia = z ? zonaLimpia(z) : null;
    guardarPreferencia(clave, limpia);
    if (!limpia) { try { localStorage.removeItem(CLAVE_CACHE); } catch { /* nada que borrar */ } }
    setZona(limpia);
    window.dispatchEvent(new Event(EVENTO));
  }, [clave]);
  const ahora = st.prev ? ahoraTiempo(st.prev) : null;
  return { zona, fijarZona, ...st, ahora, reintentar: () => { forzar.current = true; setVuelta((v) => v + 1); } };
}

// ---------- elegir la zona: la ubicación del móvil (una vez) o una ciudad ----------
export function ElegirZona({ alElegir }) {
  const [pidiendo, setPidiendo] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState(null);
  const [error, setError] = useState('');
  const usarUbicacion = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setError('Este navegador no da la ubicación: escribe tu ciudad.'); return; }
    setPidiendo(true); setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setPidiendo(false); alElegir({ lat: pos.coords.latitude, lon: pos.coords.longitude, origen: 'ubicacion' }); },
      (e) => { setPidiendo(false); setError(e?.code === 1 ? 'La app no tiene permiso para tu ubicación. Puedes escribir tu ciudad.' : 'No se ha podido saber dónde estás. Prueba a escribir tu ciudad.'); },
      { enableHighAccuracy: false, maximumAge: 30 * 60 * 1000, timeout: 12000 },
    );
  };
  const buscar = async (ev) => {
    ev.preventDefault();
    const url = urlBuscar(texto);
    if (!url) { setError('Escribe al menos dos letras.'); return; }
    setBuscando(true); setError(''); setResultados(null);
    try {
      const r = leerBusqueda(await pedirJson(url));
      setResultados(r);
      if (!r.length) setError(`No sale ningún sitio que se llame «${texto.trim()}».`);
    } catch { setError(sinRed() ? 'Sin conexión: prueba cuando vuelva.' : 'No se ha podido buscar ahora. Prueba otra vez.'); }
    finally { setBuscando(false); }
  };
  return (
    <div class="elegir-zona pila-s">
      <button type="button" class="btn btn-ancho" onClick={usarUbicacion} aria-busy={pidiendo ? 'true' : undefined}>
        <Icono n="ubicacion" /> {pidiendo ? 'Mirando dónde estás…' : 'Usar mi ubicación'}
      </button>
      <form class="buscar-zona" onSubmit={buscar}>
        <label class="sr" for="tiempo-ciudad">Tu ciudad</label>
        <input id="tiempo-ciudad" class="entrada" type="search" value={texto} onInput={(e) => setTexto(e.currentTarget.value)} placeholder="O escribe tu ciudad" maxLength={60} enterkeyhint="search" autocomplete="address-level2" />
        <button type="submit" class="btn" aria-busy={buscando ? 'true' : undefined}>Buscar</button>
      </form>
      {resultados?.length > 0 && (
        <ul class="lista zonas-encontradas" aria-label="Sitios encontrados">
          {resultados.map((r) => (
            <li key={`${r.lat},${r.lon},${r.nombre}`}>
              <button type="button" class="zona-opcion" onClick={() => alElegir({ ...r, origen: 'ciudad' })}>
                <strong>{r.nombre}</strong>{r.detalle && <span class="mini terciario">{r.detalle}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p class="peq aviso-texto" role="status">{error}</p>
      <p class="mini terciario">Tu zona, redondeada a unos 10 km, va a Open-Meteo para pedir la previsión. Se guarda solo en este móvil, no en tu ficha.</p>
    </div>
  );
}

function AvisosLista({ avisos }) {
  if (!avisos.length) return null;
  return (
    <ul class="tiempo-avisos">
      {avisos.map((a) => (
        <li key={a.clave} class="tiempo-aviso" data-nivel={a.nivel}>
          <Icono n="alerta" />
          <span class="pila-xs"><strong>{a.titulo}</strong><span class="peq">{a.texto}</span></span>
        </li>
      ))}
    </ul>
  );
}

const grados = (x) => (x == null ? '—' : String(Math.round(x)));

// ---------- en Hoy (dentro de su plegable) ----------
export function TiempoHoy({ t, modalidad = 'carrera', ocultar = null }) {
  const [cambiando, setCambiando] = useState(false);
  if (!t.zona || cambiando) {
    return (
      <section class="tiempo-hoy pila-s" aria-label="El tiempo para salir">
        {!t.zona && <p class="peq">La temperatura, la lluvia y el viento de hoy, los avisos si hace falta y la mejor hora para salir a {VERBO[modalidad] || 'entrenar'}.</p>}
        <ElegirZona alElegir={(z) => { t.fijarZona(z); setCambiando(false); }} />
        {cambiando
          ? <button type="button" class="btn-texto" onClick={() => setCambiando(false)}>Dejar la zona que tenía</button>
          : ocultar && <button type="button" class="btn-texto" onClick={ocultar}>Ahora no (lo pliego al final)</button>}
      </section>
    );
  }
  if (!t.prev) {
    return (
      <section class="tiempo-hoy pila-s" aria-label="El tiempo para salir">
        {t.cargando || !t.error ? <p class="peq secundario" role="status">Mirando el tiempo…</p> : (
          <>
            <p class="peq" role="status">{t.error === 'sin-red' ? 'Sin conexión: el tiempo se mira cuando vuelva.' : 'No se ha podido mirar el tiempo ahora.'}</p>
            <button type="button" class="btn" onClick={t.reintentar}>Probar otra vez</button>
          </>
        )}
        <PieZona t={t} cambiar={() => setCambiando(true)} />
      </section>
    );
  }
  const h = t.ahora;
  const c = h ? cielo(h.codigo, h.dia) : null;
  const m = mejorHora(t.prev);
  const avisos = avisosTiempo(h, { modalidad });
  const horas = horasDeHoy(t.prev).filter((x) => Number(x.hora.slice(11, 13)) >= 6).slice(0, 18);
  return (
    <section class="tiempo-hoy pila-s" aria-label="El tiempo para salir">
      {h && (
        <div class="tiempo-ahora">
          <span class="tiempo-ico" aria-hidden="true"><Icono n={c.icono} /></span>
          <span class="pila-xs tiempo-ahora-txt">
            <span class="tiempo-grados num">{grados(h.t)}<small> °C</small></span>
            <span class="peq secundario">{c.texto}{h.st != null && Math.round(h.st) !== Math.round(h.t) ? `, sensación de ${grados(h.st)} °C` : ''}</span>
          </span>
          <dl class="tiempo-datos">
            <div><dt>Lluvia</dt><dd class="num">{grados(h.lluvia ?? 0)} %</dd></div>
            <div><dt>Viento</dt><dd class="num">{grados(h.viento ?? 0)} km/h</dd></div>
            {h.ica != null && <div><dt>Aire</dt><dd>{textoAire(h.ica)}</dd></div>}
          </dl>
        </div>
      )}
      {m && (
        <p class="tiempo-mejor peq">
          <Icono n="reloj" />
          <span>{m.ahora ? <><strong>Buen momento para salir ahora</strong>: {m.motivo}.</> : <>La mejor hora para salir hoy: <strong class="num">{m.hora}</strong> ({m.motivo}).</>}</span>
        </p>
      )}
      <AvisosLista avisos={avisos} />
      {horas.length > 1 && (
        // (se desliza en horizontal: enfocable para poder moverla con el teclado)
        <ol class="tiempo-horas" tabindex="0" aria-label="Las próximas horas">
          {horas.map((x) => {
            const cx = cielo(x.codigo, x.dia);
            const mejor = m && x.hora === m.h.hora;
            return (
              <li key={x.hora} class={mejor ? 'mejor' : undefined} aria-label={`${x.hora.slice(11, 16)}: ${grados(x.t)} °C, ${cx.texto.toLowerCase()}, ${grados(x.lluvia ?? 0)} % de lluvia${mejor ? ' (la mejor)' : ''}`}>
                <span class="mini num" aria-hidden="true">{x.hora.slice(11, 16)}</span>
                <Icono n={cx.icono} />
                <span class="num" aria-hidden="true">{grados(x.t)}°</span>
                <span class="mini num terciario" aria-hidden="true">{grados(x.lluvia ?? 0)} %</span>
              </li>
            );
          })}
        </ol>
      )}
      <PieZona t={t} cambiar={() => setCambiando(true)} />
    </section>
  );
}

function PieZona({ t, cambiar }) {
  return (
    <p class="mini terciario tiempo-pie">
      <span>{t.zona.nombre || 'Tu zona (por tu ubicación)'} · Previsión de Open-Meteo</span>
      <span class="fila-envolver">
        <button type="button" class="btn-texto" onClick={cambiar}>Cambiar la zona</button>
        <button type="button" class="btn-texto" onClick={() => t.fijarZona(null)}>Quitar el tiempo</button>
      </span>
    </p>
  );
}

// Una línea para el resumen del plegable de Hoy y su icono
export function resumenParaHoy(t) {
  if (!t.zona) return { detalle: 'La temperatura, la lluvia y la mejor hora para salir', icono: 'sol' };
  if (!t.prev) return { detalle: t.cargando || !t.error ? 'Mirando el tiempo…' : 'Sin previsión ahora', icono: 'nube' };
  return { detalle: resumenTiempo(t.prev) || 'Previsión de Open-Meteo', icono: t.ahora ? cielo(t.ahora.codigo, t.ahora.dia).icono : 'nube' };
}

// ---------- en la sesión: el tiempo de ahora y sus avisos (solo si ya eligió zona) ----------
export function TiempoSesion({ modalidad }) {
  const t = useTiempo();
  const h = t.ahora;
  if (!t.zona || !h) return null;
  const c = cielo(h.codigo, h.dia);
  const avisos = avisosTiempo(h, { modalidad });
  return (
    <div class="tiempo-sesion pila-s" role="group" aria-label="El tiempo ahora">
      <p class="peq tiempo-sesion-linea">
        <Icono n={c.icono} />
        <span>Ahora, {grados(h.t)} °C{h.st != null && Math.round(h.st) !== Math.round(h.t) ? ` (sensación de ${grados(h.st)} °C)` : ''}, {c.texto.toLowerCase()}{(h.lluvia ?? 0) >= 20 ? `, ${grados(h.lluvia)} % de lluvia` : ''}.{avisos.length ? '' : ' Buen tiempo para salir.'}</span>
      </p>
      <AvisosLista avisos={avisos} />
    </div>
  );
}
