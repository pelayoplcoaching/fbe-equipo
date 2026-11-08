// La música (v0.104, migración 050). Sin iniciar sesión con Spotify: enlaces, la ficha pública de cada enlace (su
// nombre y su portada, por oEmbed) y el reproductor de Spotify incrustado, que solo se carga al tocar «Escuchar aquí»
// (así Spotify no entra en la app hasta que el atleta quiere).
//   · MusicaSesion: en la portada, la música de hoy (la del coach para esta sesión o su bloque, la suya, la de descarga,
//     la de su tipo de sesión o la del ritmo de su cardio), «Empezar con tu música» y, si su aviso de descanso le corta
//     la música, la propuesta de avisar solo con vibración
//   · Cadencia: el metrónomo de pasos, pedaladas o saltos de su cardio (suena encima de su música)
//   · CancionRecord: su canción, al batir un récord
//   · ListaEquipo: la lista colaborativa del equipo
import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, Icono } from '../comunes.jsx';
import { spotify, urlIncrustar, altoIncrustado, musicaDeLaSesion, etiquetaOrigen, cadenciaDe, ajustarCadencia } from '../../logica/musica.js';
import { nombreMusica } from '../../logica/personal.js';
import { leerAjustes, guardarAjustes } from '../ajustes.js';
import { prepararAudio, tono, vibrarCorto } from './sesion-comun.jsx';
import { usePersonal } from './Personal.jsx';

// ---------- La ficha pública de un enlace de Spotify (nombre y portada), recordada una semana en el dispositivo ----------
const CLAVE_FICHAS = 'fbe-fichas-musica';
const leerFichas = () => { try { return JSON.parse(localStorage.getItem(CLAVE_FICHAS) || '{}') || {}; } catch { return {}; } };
async function fichaSpotify(url) {
  if (!spotify(url)) return null;
  const todas = leerFichas();
  const ya = todas[url];
  if (ya && Date.now() - ya.t < 7 * 864e5) return ya;
  const r = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, { credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!r.ok) return null;
  const j = await r.json();
  const thumb = /^https:\/\/[a-z0-9.-]+\.(scdn\.co|spotifycdn\.com)\//i.test(String(j.thumbnail_url || '')) ? j.thumbnail_url : null;
  const f = { titulo: String(j.title || '').slice(0, 120), thumb, t: Date.now() };
  const nuevas = Object.fromEntries(Object.entries({ ...todas, [url]: f }).sort((a, b) => b[1].t - a[1].t).slice(0, 40));
  try { localStorage.setItem(CLAVE_FICHAS, JSON.stringify(nuevas)); } catch { /* sin almacenamiento: se pide otra vez */ }
  return f;
}
export function useFicha(url) {
  return useCarga(() => (spotify(url) ? fichaSpotify(url).catch(() => null) : Promise.resolve(null)), [url]);
}

// El reproductor de Spotify, al tocar
export function Reproductor({ url, titulo = 'Spotify' }) {
  const [abierto, setAbierto] = useState(false);
  const src = urlIncrustar(url);
  if (!src) return null;
  if (!abierto) return <button type="button" class="btn btn-peq" onClick={() => setAbierto(true)}><Icono n="play" /> Escuchar aquí</button>;
  return <iframe class="reproductor-spotify" title={`Reproductor de Spotify: ${titulo}`} src={src} width="100%" height={altoIncrustado(url)} loading="lazy"
    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" />;
}

export function TarjetaMusica({ url, etiqueta, alAbrir = null, extra = null }) {
  const ficha = useFicha(url);
  const titulo = ficha.datos?.titulo || nombreMusica(url);
  return (
    <div class="tarjeta-musica">
      <div class="tarjeta-musica-cab">
        {ficha.datos?.thumb ? <img class="tarjeta-musica-portada" src={ficha.datos.thumb} alt="" width="56" height="56" loading="lazy" referrerpolicy="no-referrer" />
          : <span class="tarjeta-musica-portada sin" aria-hidden="true"><Icono n="altavoz" /></span>}
        <span class="pila-xs">
          <span class="mini terciario">{etiqueta}</span>
          <strong class="tarjeta-musica-titulo">{titulo}</strong>
        </span>
      </div>
      <div class="fila-envolver tarjeta-musica-botones">
        <a class="btn btn-peq" href={url} target="_blank" rel="noopener noreferrer" onClick={() => alAbrir?.()}><Icono n="enlace" /> Abrir en {nombreMusica(url)}</a>
        <Reproductor url={url} titulo={titulo} />
        {extra}
      </div>
    </div>
  );
}

// ---------- La música de hoy, en la portada ----------
export function MusicaSesion({ sesion, semana = null, familia = null, cardio = null, alEmpezar }) {
  const { api, propio } = useApp();
  const personal = usePersonal();
  const coach = useCarga(() => (propio ? Promise.resolve({}) : api.musicaPara(sesion.id, semana?.bloque_id || null).catch(() => ({}))), [sesion.id, semana?.bloque_id]);
  const [mas, setMas] = useState(false);
  const [aviso, setAviso] = useState(() => !!leerAjustes().vozBloqueo && !!leerAjustes().sonido);
  const opciones = musicaDeLaSesion({ coach: coach.datos || {}, personal: personal.datos, familia, foco: semana?.foco || null, sesionId: sesion.id, bloqueId: semana?.bloque_id || null, modalidad: cardio?.modalidad || null });
  if (propio || !opciones.length) return null;
  const [primera, ...otras] = opciones;
  const abrir = () => { api.musicaAbierta(); };
  const empezarConMusica = () => {
    abrir();
    try { window.open(primera.url, '_blank', 'noopener,noreferrer'); } catch { /* bloqueado: queda el enlace */ }
    alEmpezar?.();
  };
  return (
    <section class="seccion musica-sesion" aria-labelledby="musica-sesion-t">
      <h2 id="musica-sesion-t">Tu música de hoy</h2>
      <div class="panel panel-pad pila-s">
        <TarjetaMusica url={primera.url} etiqueta={etiquetaOrigen(primera)} alAbrir={abrir} />
        {otras.length > 0 && (mas
          ? otras.map((x) => <TarjetaMusica key={x.url} url={x.url} etiqueta={etiquetaOrigen(x)} alAbrir={abrir} />)
          : <button type="button" class="btn-texto" style="justify-self:start" onClick={() => setMas(true)}>{otras.length === 1 ? 'Otra opción' : `${otras.length} opciones más`}</button>)}
        {!sesion.completada && <button type="button" class="btn btn-ancho empezar-musica" onClick={empezarConMusica}><Icono n="play" /> Empezar con esta música</button>}
        {aviso && (
          <div class="nota peq musica-aviso">
            <span>Tienes puesto «Avisar aunque bloquees el móvil»: en cada descanso tu música se pausa. ¿Prefieres que te avise solo vibrando?</span>
            <span class="fila">
              <button type="button" class="btn btn-peq btn-primario" onClick={() => { guardarAjustes({ ...leerAjustes(), vozBloqueo: false, vibracion: true }); setAviso(false); }}>Solo vibración</button>
              <button type="button" class="btn btn-peq plano" onClick={() => setAviso(false)}>Dejarlo así</button>
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

// ---------- El metrónomo de cadencia del cardio ----------
export function Cadencia({ modalidad }) {
  const c = cadenciaDe(modalidad);
  const [valor, setValor] = useState(() => { try { return ajustarCadencia(modalidad, Number(localStorage.getItem(`fbe-cadencia-${modalidad}`)) || c?.defecto); } catch { return c?.defecto; } });
  const [en, setEn] = useState(false);
  const golpe = useRef(0);
  useEffect(() => {
    if (!en || !c) return undefined;
    const ms = 60000 / valor;
    const id = setInterval(() => { golpe.current++; tono(golpe.current % 4 === 1 ? 1320 : 990, 0.04, 0.14); if (golpe.current % 4 === 1) vibrarCorto?.(15); }, ms);
    return () => clearInterval(id);
  }, [en, valor]);
  if (!c) return null;
  const cambiar = (d) => { const v = ajustarCadencia(modalidad, valor + d * c.paso); setValor(v); try { localStorage.setItem(`fbe-cadencia-${modalidad}`, String(v)); } catch { /* */ } };
  return (
    <div class="cadencia" role="group" aria-label="Metrónomo de cadencia">
      <span class="mini terciario">Cadencia</span>
      <div class="cadencia-fila">
        <button type="button" class="btn btn-icono" onClick={() => cambiar(-1)} aria-label="Menos" disabled={valor <= c.min}><Icono n="menos" /></button>
        <span class="cadencia-v" aria-live="polite"><b class="num">{valor}</b> <small>{c.unidad}/min</small></span>
        <button type="button" class="btn btn-icono" onClick={() => cambiar(1)} aria-label="Más" disabled={valor >= c.max}><Icono n="mas" /></button>
        <button type="button" class={`btn btn-peq ${en ? 'btn-primario' : ''}`} aria-pressed={en ? 'true' : 'false'} onClick={() => { if (!en) prepararAudio(); setEn(!en); }}>
          <Icono n={en ? 'pausa' : 'play'} /> {en ? 'Parar' : 'Marcar el ritmo'}
        </button>
      </div>
      <span class="mini terciario">{c.ayuda} Suena encima de tu música.</span>
    </div>
  );
}

// ---------- Su canción, al batir un récord ----------
export function CancionRecord() {
  const personal = usePersonal();
  const url = personal.datos?.cancion_url;
  const ficha = useFicha(url);
  if (!url) return null;
  return (
    <div class="panel panel-pad cancion-record">
      <span class="t-sobre">Tu canción de récord</span>
      <TarjetaMusica url={url} etiqueta={ficha.datos?.titulo ? 'Dale al play: te lo has ganado' : 'Tu canción'} />
    </div>
  );
}

// ---------- La lista del equipo (en Equipo) ----------
export function ListaEquipo() {
  const { api } = useApp();
  const m = useCarga(() => api.musicaPara(null, null).catch(() => ({})), []);
  const url = m.datos?.equipo;
  if (!url) return null;
  return (
    <section class="panel panel-pad lista-equipo pila-s" aria-label="La lista del equipo">
      <TarjetaMusica url={url} etiqueta="La lista del equipo" />
      <p class="mini terciario">Es colaborativa: ábrela en Spotify y añade la canción que te hace levantar más. Cada mes, la del equipo.</p>
    </section>
  );
}
