// La música (v0.104, migración 050). Sin iniciar sesión con Spotify: enlaces, la ficha pública de cada enlace (su
// nombre y su portada, por oEmbed) y el reproductor de Spotify incrustado, que solo se carga al tocar «Escuchar aquí»
// (así Spotify no entra en la app hasta que el atleta quiere).
//   · MusicaSesion: en la portada, la música de hoy (la del coach para esta sesión o su bloque, la suya, la de descarga,
//     la de su tipo de sesión o la del ritmo de su cardio), «Empezar con tu música» y, si su aviso de descanso le corta
//     la música, la propuesta de avisar solo con vibración
//   · Cadencia: el metrónomo de pasos, pedaladas o saltos de su cardio (suena encima de su música)
//   · CancionRecord: su canción, al batir un récord
//   · ListaEquipo: la lista colaborativa del equipo
//   · (v0.129) FichaPrevia (lo que se ve al pegar un enlace), NombreLista (el nombre de una lista en una fila),
//     BotonMusica (la música a mano durante la sesión) y la invitación a poner la tuya
import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja } from '../comunes.jsx';
import { spotify, urlIncrustar, altoIncrustado, tieneLista, tipoMusica, esEnlaceCorto, busquedaRitmo, fichaVigente, musicaDeLaSesion, etiquetaOrigen, cadenciaDe, ajustarCadencia, bpmDeToques, encajaRitmo, TOQUE_REINICIO_MS, normalizarTramos, tramoCadencia, duracionTramos, uriSpotify, esSesionTest, vuelveDeParon, musicaDeFase, ETIQUETAS_LISTA, urlIncrustarOtro, altoIncrustadoOtro, portadaYoutube } from '../../logica/musica.js';
import { hoyISO } from '../../logica/fechas.js';
import { apuntarReproductor } from './musica-control.js';
import { nombreMusica, urlMusica } from '../../logica/personal.js';
import { leerAjustes, guardarAjustes } from '../ajustes.js';
import { prepararAudio, tono, vibrarCorto } from './sesion-comun.jsx';
import { usePersonal } from './Personal.jsx';

// ---------- La ficha pública de un enlace de Spotify (nombre y portada), recordada una semana en el dispositivo ----------
const CLAVE_FICHAS = 'fbe-fichas-musica';
const leerFichas = () => { try { return JSON.parse(localStorage.getItem(CLAVE_FICHAS) || '{}') || {}; } catch { return {}; } };
async function fichaSpotify(url) {
  if (!spotify(url)) return null;
  const todas = leerFichas();
  // (v0.129) la de hace más de una semana se pide otra vez, pero si no se puede (sin cobertura), vale la vieja
  const { usar, pedir } = fichaVigente(todas[url]);
  if (usar && !pedir) return usar;
  // (solo el enlace limpio: sin el ?si= de quien lo compartió)
  const s = spotify(url);
  let j;
  try {
    const r = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/${s.tipo}/${s.id}`)}`, { credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!r.ok) return usar;
    j = await r.json();
  } catch { return usar; }
  const thumb = /^https:\/\/[a-z0-9.-]+\.(scdn\.co|spotifycdn\.com)\//i.test(String(j.thumbnail_url || '')) ? j.thumbnail_url : null;
  const f = { titulo: String(j.title || '').slice(0, 120), thumb, t: Date.now() };
  const nuevas = Object.fromEntries(Object.entries({ ...todas, [url]: f }).sort((a, b) => b[1].t - a[1].t).slice(0, 40));
  try { localStorage.setItem(CLAVE_FICHAS, JSON.stringify(nuevas)); } catch { /* sin almacenamiento: se pide otra vez */ }
  return f;
}
export function useFicha(url) {
  // (música 3) de un vídeo de YouTube, su portada (sin pedir nada: i.ytimg.com); el nombre, el del servicio
  return useCarga(() => (spotify(url) ? fichaSpotify(url).catch(() => null) : Promise.resolve(portadaYoutube(url) ? { titulo: null, thumb: portadaYoutube(url), t: Date.now() } : null)), [url]);
}

// El reproductor de Spotify, al tocar. (v0.129) Compacto de entrada (el play y la canción), «Ver la lista entera» en las
// listas y los álbumes, en negro con la app en oscuro y «Quitar el reproductor» (deja de sonar y Spotify sale de la app)
const appOscura = () => {
  const r = document.documentElement.getAttribute('data-theme');
  return r === 'dark' || (r !== 'light' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches);
};
// (música 3) Abrir en la app de Spotify: con «Abrir en la app de Spotify» puesto (se recuerda en el móvil), los enlaces de
// Spotify van a spotify:… (abre la app sin pasar por el navegador). Si en un momento la app no se ha abierto (no está
// instalada), se abre la web. Los demás servicios, como siempre
const CLAVE_APP = 'fbe-musica-app';
export const leerAbrirEnApp = () => { try { return localStorage.getItem(CLAVE_APP) === '1'; } catch { return false; } };
export const guardarAbrirEnApp = (si) => { try { if (si) localStorage.setItem(CLAVE_APP, '1'); else localStorage.removeItem(CLAVE_APP); } catch { /* */ } };
export function abrirMusica(url, e = null) {
  const uri = leerAbrirEnApp() ? uriSpotify(url) : null;
  if (!uri) { if (!e) try { window.open(url, '_blank', 'noopener,noreferrer'); } catch { /* bloqueado */ } return; }
  e?.preventDefault?.();
  let fuera = false;
  const irse = () => { fuera = true; };
  window.addEventListener('blur', irse, { once: true });
  document.addEventListener('visibilitychange', irse, { once: true });
  try { window.location.href = uri; } catch { fuera = false; }
  setTimeout(() => {
    window.removeEventListener('blur', irse); document.removeEventListener('visibilitychange', irse);
    if (!fuera && document.visibilityState === 'visible') try { window.open(url, '_blank', 'noopener,noreferrer'); } catch { /* */ }
  }, 1500);
}
export function AbrirEnApp({ opciones = [] }) {
  const [si, setSi] = useState(leerAbrirEnApp);
  if (!opciones.some((x) => spotify(x.url))) return null;
  return (
    <label class="fila-s mini secundario abrir-en-app">
      <input type="checkbox" checked={si} onChange={(e) => { guardarAbrirEnApp(e.currentTarget.checked); setSi(e.currentTarget.checked); }} />
      Abrir en la app de Spotify (si la tienes)
    </label>
  );
}

export function Reproductor({ url, titulo = 'Spotify' }) {
  const [abierto, setAbierto] = useState(false);
  const [entero, setEntero] = useState(false);
  const [oscuro] = useState(appOscura);
  // (música 3) también YouTube (youtube-nocookie) y Apple Music; la voz del coach solo pausa el de Spotify
  const deSpotify = urlIncrustar(url, { oscuro });
  const src = deSpotify || urlIncrustarOtro(url);
  // (música 3) se apunta para que la voz del coach lo pause y lo reanude (musica-control.js)
  const marco = useRef(null);
  useEffect(() => (abierto && deSpotify ? apuntarReproductor(marco.current) : undefined), [abierto, src]);
  if (!src) return null;
  if (!abierto) return <button type="button" class="btn btn-peq" onClick={() => setAbierto(true)}><Icono n="play" /> Escuchar aquí</button>;
  return (
    <div class="reproductor-caja">
      <iframe ref={marco} class={deSpotify ? 'reproductor-spotify' : 'reproductor-spotify reproductor-otro'} title={`Reproductor de ${deSpotify ? 'Spotify' : nombreMusica(url)}: ${titulo}`} src={src} width="100%" height={deSpotify ? altoIncrustado(url, entero) : altoIncrustadoOtro(url)} loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" />
      <span class="fila-envolver reproductor-acciones">
        {deSpotify && tieneLista(url) && <button type="button" class="btn-texto" aria-expanded={entero ? 'true' : 'false'} onClick={() => setEntero(!entero)}>{entero ? 'Ver solo el reproductor' : `Ver ${tipoMusica(url) === 'Álbum' ? 'el álbum' : tipoMusica(url) === 'Podcast' ? 'los episodios' : 'la lista'} entera`}</button>}
        <button type="button" class="btn-texto" onClick={() => { setAbierto(false); setEntero(false); }}>Quitar el reproductor</button>
      </span>
    </div>
  );
}

// (v0.129) El nombre de una lista (su ficha de Spotify) o, si no lo hay, el del servicio
export function NombreLista({ url }) {
  const ficha = useFicha(url);
  return <>{ficha.datos?.titulo || nombreMusica(url)}</>;
}
export function useNombreLista(url) {
  const ficha = useFicha(url);
  return url ? ficha.datos?.titulo || nombreMusica(url) : null;
}

// (v0.129) Al pegar un enlace: qué es (portada, nombre y tipo), antes de guardarlo. De los enlaces cortos de Spotify,
// cómo copiar el largo; de otros servicios, que se abrirá en su app
export function FichaPrevia({ url, cancion = false }) {
  const u = urlMusica(url);
  const ficha = useFicha(u || null);
  if (!u) return null;
  if (esEnlaceCorto(u)) {
    return <p class="nota peq ficha-previa-aviso">Es un enlace corto de Spotify: se abrirá bien, pero sin su portada ni el reproductor. Para verlos, en Spotify toca los tres puntos → Compartir → Copiar enlace (empieza por open.spotify.com).</p>;
  }
  if (!spotify(u)) return <p class="mini terciario ficha-previa-otro">De {nombreMusica(u)}: saldrá un botón para abrirla en su app.</p>;
  const tipo = tipoMusica(u);
  const malTipo = cancion && spotify(u).tipo !== 'track';
  return (
    <div class="ficha-previa" aria-live="polite">
      {ficha.datos?.thumb ? <img class="ficha-previa-portada" src={ficha.datos.thumb} alt="" width="48" height="48" referrerpolicy="no-referrer" />
        : <span class="ficha-previa-portada sin" aria-hidden="true"><Icono n="altavoz" /></span>}
      <span class="pila-xs">
        <span class="mini terciario">{malTipo ? `${tipo}: para tu canción de récord, comparte una canción` : `${tipo} de Spotify`}</span>
        <strong class="ficha-previa-titulo">{ficha.cargando ? 'Buscando…' : ficha.datos?.titulo || 'No se ha podido ver su nombre (se guardará igual)'}</strong>
      </span>
    </div>
  );
}

export function TarjetaMusica({ url, etiqueta, alAbrir = null, extra = null }) {
  const ficha = useFicha(url);
  const titulo = ficha.datos?.titulo || nombreMusica(url);
  return (
    <div class="tarjeta-musica" data-servicio={spotify(url) ? 'spotify' : 'otro'}>
      <div class="tarjeta-musica-cab">
        {ficha.datos?.thumb ? <img class="tarjeta-musica-portada" src={ficha.datos.thumb} alt="" width="56" height="56" loading="lazy" referrerpolicy="no-referrer" />
          : <span class="tarjeta-musica-portada sin" aria-hidden="true"><Icono n="altavoz" /></span>}
        <span class="pila-xs">
          <span class="mini terciario">{etiqueta}</span>
          <strong class="tarjeta-musica-titulo">{titulo}</strong>
          {tipoMusica(url) && <span class="tarjeta-musica-tipo">{tipoMusica(url)}</span>}
        </span>
      </div>
      <div class="fila-envolver tarjeta-musica-botones">
        <a class="btn btn-peq" href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => { alAbrir?.(); abrirMusica(url, e); }}><Icono n="enlace" /> Abrir en {nombreMusica(url)}</a>
        <Reproductor url={url} titulo={titulo} />
        {extra}
      </div>
    </div>
  );
}

// ---------- La música de hoy, en la portada ----------
// Lo que el coach enlazó para esta sesión ({ clave: url }). En su modo atleta (propio), sus propias listas de Cuenta ›
// Música: musica_coach_lista las trae todas y musicaDeLaSesion escoge las que tocan (su sesión, su bloque, descarga,
// la familia y el ritmo). (Las aperturas no se cuentan: son para «Tu mes» y «Tu año» de los atletas.)
function musicaDeTuCoach(api, propio, sesionId, bloqueId) {
  const p = propio ? api.musicaCoach().then((r) => r || {}) : api.musicaPara(sesionId, bloqueId);
  return p.catch(() => ({}));
}

// (música 3) Lo que hace falta para elegir la música de una sesión: la del coach, lo suyo, la lista de sus compañeros de
// racha y si vuelve tras un parón (sus entrenos, los mismos que lee el reto del mes). Y abrir una: se cuenta en su mes y se
// apunta a esa sesión («Lo batiste con…»)
export function useMusicaDeSesion({ sesion, semana = null, familia = null, cardio = null, prep = null }) {
  const { api, atleta, propio } = useApp();
  const personal = usePersonal();
  const coach = useCarga(() => musicaDeTuCoach(api, propio, sesion.id, semana?.bloque_id || null), [sesion.id, semana?.bloque_id, propio]);
  const comp = useCarga(() => (propio ? Promise.resolve([]) : (api.listasCompaneros?.() || Promise.resolve([])).catch(() => [])), [propio]);
  const conHimno = !propio && !!personal.datos?.himno_vuelta_url && !!atleta?.id;
  const entrenos = useCarga(() => (conHimno ? api.entrenamientos(atleta.id).catch(() => []) : Promise.resolve([])), [atleta?.id, conHimno], { recuerdo: conHimno ? `reto-entrenos:${atleta.id}` : null });
  const opciones = musicaDeLaSesion({ coach: coach.datos || {}, personal: personal.datos, familia, foco: semana?.foco || null, sesionId: sesion.id, bloqueId: semana?.bloque_id || null,
    modalidad: cardio?.modalidad || null, minutos: cardio?.minutos || null, prep, esTest: esSesionTest(sesion), vuelta: conHimno && vuelveDeParon(entrenos.datos || [], hoyISO()), companeros: comp.datos || [] });
  const abrir = (url) => { if (propio) return; api.musicaAbierta(); api.musicaAbiertaLista?.(url, sesion.id); };
  return { opciones, abrir, coach, personal, cargando: coach.cargando || personal.cargando };
}

export function MusicaSesion({ sesion, semana = null, familia = null, cardio = null, alEmpezar, prep = null }) {
  const { api, propio } = useApp();
  const { opciones, abrir, cargando, personal } = useMusicaDeSesion({ sesion, semana, familia, cardio, prep });
  const [mas, setMas] = useState(false);
  const [aviso, setAviso] = useState(() => !!leerAjustes().vozBloqueo && !!leerAjustes().sonido);
  // (v0.129) sin ninguna música (ni la del coach ni la suya), una invitación a poner la suya, que se puede cerrar
  // (en el modo atleta del coach no: «Lo tuyo» es de los atletas; sin listas suyas en Cuenta › Música, nada)
  if (!opciones.length) return cargando || propio ? null : <InvitacionMusica alGuardar={() => personal.recargar(true)} />;
  const [primera, ...otras] = opciones;
  const empezarConMusica = () => {
    abrir(primera.url);
    abrirMusica(primera.url);
    alEmpezar?.();
  };
  return (
    <section class="seccion musica-sesion" aria-labelledby="musica-sesion-t">
      <h2 id="musica-sesion-t">Tu música de hoy</h2>
      <div class="panel panel-pad pila-s">
        <TarjetaMusica url={primera.url} etiqueta={etiquetaOrigen(primera)} alAbrir={() => abrir(primera.url)} />
        {otras.length > 0 && (mas
          ? otras.map((x) => <TarjetaMusica key={x.url} url={x.url} etiqueta={etiquetaOrigen(x)} alAbrir={() => abrir(x.url)} />)
          : <button type="button" class="btn-texto" style="justify-self:start" onClick={() => setMas(true)}>{otras.length === 1 ? 'Otra opción' : `${otras.length} opciones más`}</button>)}
        {!sesion.completada && <button type="button" class="btn btn-ancho empezar-musica" onClick={empezarConMusica}><Icono n="play" /> Empezar con esta música</button>}
        <AbrirEnApp opciones={opciones} />
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
// (música 3) Dos modos: fijo (el de siempre) o por tramos (cardio por intervalos: cambia solo de cadencia con cada tramo
// y avisa 5 s antes). Debajo, «¿A cuántos bpm va lo que suena?»: toca al ritmo y te dice si encaja con tu cadencia.
const leerNum = (k, d) => { try { const v = Number(localStorage.getItem(k)); return Number.isFinite(v) && v > 0 ? v : d; } catch { return d; } };
const guardarNum = (k, v) => { try { localStorage.setItem(k, String(v)); } catch { /* */ } };
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
export function Cadencia({ modalidad, tramos: delCoach = null }) {
  const c = cadenciaDe(modalidad);
  const [valor, setValor] = useState(() => ajustarCadencia(modalidad, leerNum(`fbe-cadencia-${modalidad}`, c?.defecto)) ?? c?.defecto);
  const [modo, setModo] = useState('fijo');
  const [t, setT] = useState(() => {
    let g = null; try { g = JSON.parse(localStorage.getItem(`fbe-cadencia-tramos-${modalidad}`) || 'null'); } catch { /* */ }
    return normalizarTramos({ ...(g || {}), ...(delCoach || {}) }, modalidad);
  });
  const [en, setEn] = useState(false);
  const [estado, setEstado] = useState(null); // por tramos: el tramo de ahora
  const golpe = useRef(0);
  // fijo: un golpe cada 60000/valor ms
  useEffect(() => {
    if (!en || !c || modo !== 'fijo') return undefined;
    const id = setInterval(() => { golpe.current++; tono(golpe.current % 4 === 1 ? 1320 : 990, 0.04, 0.14); if (golpe.current % 4 === 1) vibrarCorto?.(15); }, 60000 / valor);
    return () => clearInterval(id);
  }, [en, valor, modo]);
  // por tramos: cada golpe mira en qué tramo va (se programa el siguiente con la cadencia de ese momento)
  useEffect(() => {
    if (!en || !c || modo !== 'tramos') return undefined;
    const inicio = Date.now();
    let avisado = -1, fase = null, id = 0, vivo = true;
    const paso = () => {
      if (!vivo) return;
      const seg = (Date.now() - inicio) / 1000;
      const e = tramoCadencia(t, seg);
      setEstado(e);
      if (e.fin) { tono(1320, 0.12, 0.18); setTimeout(() => tono(1760, 0.18, 0.18), 180); vibrarCorto?.(60); setEn(false); return; }
      const clave = `${e.ronda}-${e.fase}`;
      if (fase && fase !== clave) { tono(660, 0.1, 0.2); setTimeout(() => tono(990, 0.12, 0.2), 140); vibrarCorto?.(40); }
      fase = clave;
      if (e.avisar && avisado !== clave) { avisado = clave; tono(880, 0.06, 0.16); setTimeout(() => tono(880, 0.06, 0.16), 160); }
      golpe.current++; tono(golpe.current % 4 === 1 ? 1320 : 990, 0.04, 0.14);
      id = setTimeout(paso, 60000 / e.cadencia);
    };
    paso();
    return () => { vivo = false; clearTimeout(id); setEstado(null); };
  }, [en, modo, t]);
  if (!c) return null;
  const cambiar = (d) => { const v = ajustarCadencia(modalidad, valor + d * c.paso); setValor(v); guardarNum(`fbe-cadencia-${modalidad}`, v); };
  const cambiarT = (k, d) => {
    const pasos = { trabajo: 10, descanso: 10, rondas: 1, alta: c.paso, baja: c.paso };
    const n = normalizarTramos({ ...t, [k]: t[k] + d * pasos[k] }, modalidad);
    setT(n); try { localStorage.setItem(`fbe-cadencia-tramos-${modalidad}`, JSON.stringify(n)); } catch { /* */ }
  };
  const ahora = modo === 'tramos' && estado && !estado.fin ? estado.cadencia : valor;
  const Paso = ({ k, nombre, txt }) => (
    <span class="cadencia-tramo-campo">
      <span class="mini terciario">{nombre}</span>
      <span class="fila">
        <button type="button" class="btn btn-icono plano" onClick={() => cambiarT(k, -1)} aria-label={`${nombre}: menos`} disabled={en}><Icono n="menos" /></button>
        <b class="num">{txt}</b>
        <button type="button" class="btn btn-icono plano" onClick={() => cambiarT(k, 1)} aria-label={`${nombre}: más`} disabled={en}><Icono n="mas" /></button>
      </span>
    </span>
  );
  return (
    <div class="cadencia" role="group" aria-label="Metrónomo de cadencia" data-en={en ? '1' : undefined} style={{ '--pulso': `${Math.round(60000 / ahora)}ms` }}>
      <span class="cadencia-cab">
        <span class="mini terciario">Cadencia</span>
        <span class="segmentos segmentos-peq" role="group" aria-label="Modo de la cadencia">
          <button type="button" aria-pressed={modo === 'fijo' ? 'true' : 'false'} disabled={en} onClick={() => setModo('fijo')}>Fija</button>
          <button type="button" aria-pressed={modo === 'tramos' ? 'true' : 'false'} disabled={en} onClick={() => setModo('tramos')}>Por tramos</button>
        </span>
      </span>
      {modo === 'fijo' ? (
        <div class="cadencia-fila">
          <button type="button" class="btn btn-icono" onClick={() => cambiar(-1)} aria-label="Menos" disabled={valor <= c.min}><Icono n="menos" /></button>
          <span class="cadencia-v" aria-live="polite"><b class="num">{valor}</b> <small>{c.unidad}/min</small></span>
          <button type="button" class="btn btn-icono" onClick={() => cambiar(1)} aria-label="Más" disabled={valor >= c.max}><Icono n="mas" /></button>
          <button type="button" class={`btn btn-peq ${en ? 'btn-primario' : ''}`} aria-pressed={en ? 'true' : 'false'} onClick={() => { if (!en) prepararAudio(); setEn(!en); }}>
            <Icono n={en ? 'pausa' : 'play'} /> {en ? 'Parar' : 'Marcar el ritmo'}
          </button>
        </div>
      ) : (
        <div class="pila-xs cadencia-tramos">
          {delCoach && <span class="mini secundario">Con los tramos de tu coach: {delCoach.rondas} × {mmss(delCoach.trabajo)}, recuperación {mmss(delCoach.descanso)}.</span>}
          <div class="cadencia-tramos-rejilla">
            <Paso k="trabajo" nombre="Trabajo" txt={mmss(t.trabajo)} />
            <Paso k="alta" nombre={`${c.unidad}/min`} txt={t.alta} />
            <Paso k="descanso" nombre="Recuperación" txt={mmss(t.descanso)} />
            <Paso k="baja" nombre={`${c.unidad}/min`} txt={t.baja} />
            <Paso k="rondas" nombre="Rondas" txt={t.rondas} />
          </div>
          {en && estado && !estado.fin
            ? <span class="cadencia-tramo-ahora" aria-live="polite"><b>{estado.fase === 'trabajo' ? 'Trabajo' : 'Recuperación'}</b> · ronda {estado.ronda} de {estado.rondas} · <span class="num">{estado.cadencia}</span> {c.unidad}/min · quedan <span class="num">{mmss(estado.quedan)}</span></span>
            : <span class="mini terciario">En total, {mmss(duracionTramos(t))}. Cambia sola de cadencia y te avisa 5 s antes de cada cambio.</span>}
          <button type="button" class={`btn btn-peq ${en ? 'btn-primario' : ''}`} style="justify-self:start" aria-pressed={en ? 'true' : 'false'} onClick={() => { if (!en) prepararAudio(); setEn(!en); }}>
            <Icono n={en ? 'pausa' : 'play'} /> {en ? 'Parar' : 'Empezar los tramos'}
          </button>
        </div>
      )}
      <span class="mini terciario">{c.ayuda} Suena encima de tu música.</span>
      {busquedaRitmo(modalidad, valor) && (
        <a class="btn-texto cadencia-buscar" href={busquedaRitmo(modalidad, valor).url} target="_blank" rel="noopener noreferrer">
          <Icono n="buscar" /> Buscar música a {busquedaRitmo(modalidad, valor).bpm} bpm en Spotify
        </a>
      )}
      <TocarRitmo modalidad={modalidad} valor={ahora} />
    </div>
  );
}

// (música 3) «¿A cuántos bpm va lo que suena?»: toca al ritmo de la canción (4 toques o más)
export function TocarRitmo({ modalidad, valor }) {
  const [abierto, setAbierto] = useState(false);
  const [toques, setToques] = useState([]);
  if (!abierto) return <button type="button" class="btn-texto tocar-ritmo-abrir" onClick={() => setAbierto(true)}><Icono n="altavoz" /> ¿A cuántos bpm va lo que suena?</button>;
  const bpm = bpmDeToques(toques);
  const r = bpm ? encajaRitmo(bpm, modalidad, valor) : null;
  const tocar = () => {
    const ahora = Date.now();
    setToques((l) => (l.length && ahora - l[l.length - 1] > TOQUE_REINICIO_MS ? [ahora] : [...l, ahora].slice(-9)));
    vibrarCorto?.(10);
  };
  return (
    <div class="tocar-ritmo pila-xs">
      <button type="button" class="btn btn-ancho tocar-ritmo-boton" onClick={tocar}>{toques.length ? 'Toca al ritmo' : 'Toca al ritmo de lo que suena'}</button>
      <span class="tocar-ritmo-r" aria-live="polite">
        {bpm ? <><b class="num">{bpm}</b> bpm{r ? ` · ${r.texto}` : ''}</> : <span class="mini terciario">{toques.length ? `Sigue tocando (${toques.length} de 4)` : 'Con 4 toques ya lo sabes. Si paras un momento, empieza de nuevo.'}</span>}
      </span>
      <button type="button" class="btn-texto" style="justify-self:start" onClick={() => { setAbierto(false); setToques([]); }}>Cerrar</button>
    </div>
  );
}

// (música 3) «Pon tu canción» antes de la serie grande: en el ejercicio que toca, si es de prioridad alta y aún no ha
// hecho ninguna serie, un botón para poner su canción de récord justo antes (abre su app: los navegadores no dejan que
// suene sola)
// (música 3, tanda 2) y su himno de la última serie: en el último ejercicio, cuando le queda una serie
export function PonTuCancion({ sesionId = null, himno = 'record' }) {
  const { api, propio } = useApp();
  const personal = usePersonal();
  const url = himno === 'ultima' ? personal.datos?.himno_ultima_url : personal.datos?.cancion_url;
  const nombre = useNombreLista(url);
  if (propio || !url) return null;
  return (
    <a class={`btn btn-peq pon-tu-cancion${himno === 'ultima' ? ' himno-ultima' : ''}`} href={url} target="_blank" rel="noopener noreferrer"
      onClick={(e) => { api.musicaAbierta?.(); api.musicaAbiertaLista?.(url, sesionId); abrirMusica(url, e); }}>
      <Icono n="altavoz" /> {himno === 'ultima' ? 'La última: tu himno' : 'Pon tu canción'}{nombre ? `: ${nombre}` : ''}
    </a>
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
      <p class="mini terciario">Es colaborativa: ábrela en {nombreMusica(url)} y añade la canción que te hace levantar más. Cada mes, la del equipo.</p>
      {spotify(url) && <a class="btn btn-ancho lista-equipo-anadir" href={url} target="_blank" rel="noopener noreferrer"><Icono n="mas" /> Añadir mi canción en Spotify</a>}
    </section>
  );
}

// ---------- (v0.129) Sin música en la portada: la invitación a poner la tuya ----------
const CLAVE_INVITACION = 'fbe-musica-invitacion';
function InvitacionMusica({ alGuardar }) {
  const [cerrada, setCerrada] = useState(() => { try { return !!localStorage.getItem(CLAVE_INVITACION); } catch { return false; } });
  const [editar, setEditar] = useState(false);
  const { api } = useApp();
  if (cerrada) return null;
  const cerrar = () => { try { localStorage.setItem(CLAVE_INVITACION, '1'); } catch { /* */ } setCerrada(true); };
  return (
    <section class="seccion musica-invitacion" aria-labelledby="musica-invitacion-t">
      <div class="panel panel-pad pila-s">
        <span class="musica-invitacion-cab"><span class="musica-invitacion-ico" aria-hidden="true"><Icono n="altavoz" /></span><strong id="musica-invitacion-t">¿Entrenas con música?</strong></span>
        <p class="peq secundario">Pon el enlace a tu lista y la tendrás aquí, a un toque, en cada sesión.</p>
        <span class="fila-envolver">
          <button type="button" class="btn btn-peq btn-primario" onClick={() => setEditar(true)}><Icono n="enlace" /> Poner mi lista</button>
          <button type="button" class="btn btn-peq plano" onClick={cerrar}>No, gracias</button>
        </span>
      </div>
      {editar && <HojaMiLista api={api} alCerrar={() => setEditar(false)} alGuardar={() => { setEditar(false); alGuardar?.(); }} />}
    </section>
  );
}
function HojaMiLista({ api, alCerrar, alGuardar }) {
  const { aviso } = useApp();
  const [u, setU] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const mal = u.trim() && urlMusica(u) === false;
  const guardar = async (e) => {
    e.preventDefault();
    if (!u.trim() || mal) return;
    setGuardando(true);
    try { const actual = (await api.personal()) || {}; await api.guardarPersonal({ ...actual, musica_url: urlMusica(u) }); aviso('Guardada: la tienes en cada sesión'); alGuardar(); }
    catch (err) { setError(err.message); } finally { setGuardando(false); }
  };
  return (
    <Hoja titulo="Tu música" alCerrar={alCerrar}>
      <form class="pila" onSubmit={guardar}>
        <div class="campo">
          <label for="mi-lista">Enlace a tu lista</label>
          <input id="mi-lista" class="entrada" type="url" inputMode="url" value={u} onInput={(e) => { setU(e.currentTarget.value); setError(null); }} placeholder="https://open.spotify.com/playlist/…" autoFocus aria-invalid={mal ? 'true' : undefined} />
          <span class={mal ? 'error-campo' : 'ayuda'}>{mal ? 'Tiene que ser un enlace de Spotify, Apple Music, YouTube Music, Amazon Music, Deezer o Tidal.' : 'En tu app de música: Compartir → Copiar enlace. Puedes cambiarla en Perfil → Lo tuyo.'}</span>
          <FichaPrevia url={u} />
        </div>
        {error && <p class="error" role="alert">{error}</p>}
        <button class="btn btn-primario btn-grande" disabled={guardando || mal || !u.trim()}><Icono n="hecho" /> {guardando ? 'Guardando…' : 'Guardar'}</button>
      </form>
    </Hoja>
  );
}

// ---------- (música 3) En «Lo tuyo»: sus listas con etiqueta y sus himnos ----------
// Hasta 12 listas, cada una con su momento (un tipo de sesión, cómo llega o una fase). La portada elige la que encaja
export function HojaListasMusica({ actual, alCerrar, alGuardar }) {
  const { api, aviso } = useApp();
  const [listas, setListas] = useState(() => (Array.isArray(actual?.musica_listas) ? actual.musica_listas : []).map((l) => ({ ...l })));
  const [u, setU] = useState('');
  const [etq, setEtq] = useState('pierna');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const mal = u.trim() && urlMusica(u) === false;
  const anadir = () => { if (!u.trim() || mal || listas.length >= 12) return; setListas([...listas, { url: urlMusica(u), etiqueta: etq }]); setU(''); };
  const guardar = async () => {
    setGuardando(true); setError(null);
    try { await api.guardarMusicaPersonal({ musica_listas: listas }); aviso('Guardadas: la portada elige la que encaja'); alGuardar?.(); } catch (e) { setError(e.message); } finally { setGuardando(false); }
  };
  return (
    <Hoja titulo="Tus listas por momento" alCerrar={alCerrar}>
      <div class="pila listas-musica-hoja">
        <p class="peq secundario">Una lista para pierna, otra para los días flojos, otra para calentar… En la portada de cada sesión sale la que encaja (por el tipo de sesión, por cómo llegas o por la fase). Lo ve tu coach.</p>
        {listas.length > 0 ? (
          <ul class="lista listas-musica">
            {listas.map((l, i) => (
              <li key={`${l.url}-${i}`} class="lista-musica-fila">
                <span class="pila-xs"><strong><NombreLista url={l.url} /></strong>
                  <select class="entrada entrada-peq" aria-label="Para qué momento" value={l.etiqueta} onChange={(e) => setListas(listas.map((x, j) => (j === i ? { ...x, etiqueta: e.currentTarget.value } : x)))}>
                    {ETIQUETAS_LISTA.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                  </select></span>
                <button type="button" class="btn btn-icono plano" aria-label="Quitar esta lista" onClick={() => setListas(listas.filter((_, j) => j !== i))}><Icono n="basura" /></button>
              </li>
            ))}
          </ul>
        ) : <p class="peq terciario">Aún no tienes ninguna.</p>}
        {listas.length < 12 && (
          <div class="pila-s listas-musica-nueva">
            <div class="campo">
              <label for="lm-url">Enlace a la lista</label>
              <input id="lm-url" class="entrada" type="url" inputMode="url" value={u} onInput={(e) => setU(e.currentTarget.value)} placeholder="https://open.spotify.com/playlist/…" aria-invalid={mal ? 'true' : undefined} />
              {mal ? <span class="error-campo">Tiene que ser un enlace de Spotify, Apple Music, YouTube Music, Amazon Music, Deezer o Tidal.</span> : <FichaPrevia url={u} />}
            </div>
            <div class="campo">
              <label for="lm-etq">Para</label>
              <select id="lm-etq" class="entrada" value={etq} onChange={(e) => setEtq(e.currentTarget.value)}>{ETIQUETAS_LISTA.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
            </div>
            <button type="button" class="btn" disabled={!u.trim() || mal} onClick={anadir}><Icono n="mas" /> Añadir a la lista</button>
          </div>
        )}
        {error && <p class="error" role="alert">{error}</p>}
        <button type="button" class="btn btn-primario btn-grande" disabled={guardando} onClick={guardar}><Icono n="hecho" /> {guardando ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </Hoja>
  );
}
// Sus himnos: el de la última serie (en el último ejercicio, a una serie del final) y el de vuelta (tras 7 días o más
// sin entrenar, el primero en la portada). El del récord es su canción de récord, de siempre
export function HojaHimnos({ actual, alCerrar, alGuardar }) {
  const { api, aviso } = useApp();
  const [ultima, setUltima] = useState(actual?.himno_ultima_url || '');
  const [vuelta, setVuelta] = useState(actual?.himno_vuelta_url || '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const malU = ultima.trim() && urlMusica(ultima) === false, malV = vuelta.trim() && urlMusica(vuelta) === false;
  const guardar = async () => {
    setGuardando(true); setError(null);
    try { await api.guardarMusicaPersonal({ himno_ultima_url: ultima.trim() || null, himno_vuelta_url: vuelta.trim() || null }); aviso('Guardados'); alGuardar?.(); } catch (e) { setError(e.message); } finally { setGuardando(false); }
  };
  return (
    <Hoja titulo="Tus himnos" alCerrar={alCerrar}>
      <div class="pila">
        <p class="peq secundario">Una canción para cada momento grande. La del récord es tu canción de récord (en «Lo tuyo»). Lo ve tu coach.</p>
        <div class="campo">
          <label for="hm-ultima">Para la última serie</label>
          <input id="hm-ultima" class="entrada" type="url" inputMode="url" value={ultima} onInput={(e) => setUltima(e.currentTarget.value)} placeholder="https://open.spotify.com/track/…" aria-invalid={malU ? 'true' : undefined} />
          {malU ? <span class="error-campo">Tiene que ser un enlace de música.</span> : <><span class="ayuda">Sale en el último ejercicio, cuando te queda una serie.</span><FichaPrevia url={ultima} /></>}
        </div>
        <div class="campo">
          <label for="hm-vuelta">Para volver tras un parón</label>
          <input id="hm-vuelta" class="entrada" type="url" inputMode="url" value={vuelta} onInput={(e) => setVuelta(e.currentTarget.value)} placeholder="https://open.spotify.com/track/…" aria-invalid={malV ? 'true' : undefined} />
          {malV ? <span class="error-campo">Tiene que ser un enlace de música.</span> : <><span class="ayuda">La primera en la portada si llevas 7 días o más sin entrenar.</span><FichaPrevia url={vuelta} /></>}
        </div>
        {error && <p class="error" role="alert">{error}</p>}
        <button type="button" class="btn btn-primario btn-grande" disabled={guardando || malU || malV} onClick={guardar}><Icono n="hecho" /> {guardando ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </Hoja>
  );
}

// ---------- (música 3) Lo que más te acompaña (en «Tu mes» y «Tu año») ----------
// Las listas que más abrió desde la app en esos meses («AAAA-MM»), con su nombre: solo lo abierto desde la app
export function LoQueMasTeAcompana({ desde, hasta }) {
  const { api, propio } = useApp();
  const l = useCarga(() => (propio ? Promise.resolve([]) : (api.musicaMasAbierta?.(desde, hasta) || Promise.resolve([])).catch(() => [])), [desde, hasta, propio]);
  const top = (l.datos || []).slice(0, 3);
  if (!top.length) return null;
  return <p class="historia-texto lo-que-mas">Lo que más te ha acompañado: {top.map((x, i) => <span key={x.url}>{i ? (i === top.length - 1 ? ' y ' : ', ') : ''}<NombreMasAbierta url={x.url} n={x.n} /></span>)}.</p>;
}
function NombreMasAbierta({ url, n }) {
  const nombre = useNombreLista(url);
  return <strong>«{nombre}»{n > 1 ? <span class="num"> ({n})</span> : null}</strong>;
}

// ---------- (v0.129) La música a mano durante la sesión ----------
// Un botón en la sesión ya empezada que abre lo mismo que la portada (para volver a la lista si Spotify se ha parado
// o para cambiar de música a mitad)
// (música 3) y, en la sesión, la música de la fase en la que va: para calentar (antes de la primera serie) y para la
// vuelta a la calma (hecho todo), si el coach o él la tienen; al pasar al trabajo, un aviso para volver a la de siempre
export function BotonMusica({ sesion, semana = null, familia = null, cardio = null, prep = null, fase = null }) {
  const { opciones, abrir, coach, personal } = useMusicaDeSesion({ sesion, semana, familia, cardio, prep });
  const [abierta, setAbierta] = useState(false);
  const deFase = musicaDeFase({ coach: coach.datos || {}, personal: personal.datos, fase });
  const huboCalentar = !!musicaDeFase({ coach: coach.datos || {}, personal: personal.datos, fase: 'calentamiento' });
  const lista = deFase ? [deFase, ...opciones.filter((x) => x.url !== deFase.url)] : opciones;
  if (!lista.length) return null;
  return (
    <>
      {deFase && <MusicaDeFase x={deFase} alAbrir={() => abrir(deFase.url)} />}
      {!deFase && fase === 'trabajo' && huboCalentar && opciones[0] && <MusicaDeFase x={{ ...opciones[0], trabajo: true }} alAbrir={() => abrir(opciones[0].url)} />}
      <button type="button" class="btn btn-peq boton-musica" onClick={() => setAbierta(true)}><Icono n="altavoz" /> Tu música</button>
      {abierta && (
        <Hoja titulo="Tu música" alCerrar={() => setAbierta(false)}>
          <div class="pila-s">{lista.map((x) => <TarjetaMusica key={x.url} url={x.url} etiqueta={etiquetaOrigen(x)} alAbrir={() => abrir(x.url)} />)}</div>
        </Hoja>
      )}
    </>
  );
}
// La tarjeta pequeña de la fase (se puede cerrar: cerrada, no vuelve en esa fase de esta sesión)
function MusicaDeFase({ x, alAbrir }) {
  const nombre = useNombreLista(x.url);
  const clave = x.trabajo ? 'trabajo' : x.fase;
  const [cerrada, setCerrada] = useState(null);
  if (cerrada === clave) return null;
  const titulo = x.trabajo ? 'Calentado: ahora, tu música de trabajo' : x.fase === 'calentamiento' ? 'Para calentar' : 'Para la vuelta a la calma';
  return (
    <div class="musica-fase" data-fase={clave} role="status">
      <Icono n="altavoz" />
      <span class="pila-xs"><strong>{titulo}</strong><span class="mini secundario">{nombre}</span></span>
      <a class="btn btn-peq" href={x.url} target="_blank" rel="noopener noreferrer" onClick={(e) => { alAbrir?.(); abrirMusica(x.url, e); }}>Ponerla</a>
      <button type="button" class="btn btn-icono plano" aria-label="Cerrar" onClick={() => setCerrada(clave)}><Icono n="cerrar" /></button>
    </div>
  );
}
