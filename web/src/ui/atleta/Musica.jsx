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
import { spotify, urlIncrustar, altoIncrustado, tieneLista, tipoMusica, esEnlaceCorto, busquedaRitmo, fichaVigente, musicaDeLaSesion, etiquetaOrigen, cadenciaDe, ajustarCadencia } from '../../logica/musica.js';
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
  return useCarga(() => (spotify(url) ? fichaSpotify(url).catch(() => null) : Promise.resolve(null)), [url]);
}

// El reproductor de Spotify, al tocar. (v0.129) Compacto de entrada (el play y la canción), «Ver la lista entera» en las
// listas y los álbumes, en negro con la app en oscuro y «Quitar el reproductor» (deja de sonar y Spotify sale de la app)
const appOscura = () => {
  const r = document.documentElement.getAttribute('data-theme');
  return r === 'dark' || (r !== 'light' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches);
};
export function Reproductor({ url, titulo = 'Spotify' }) {
  const [abierto, setAbierto] = useState(false);
  const [entero, setEntero] = useState(false);
  const [oscuro] = useState(appOscura);
  const src = urlIncrustar(url, { oscuro });
  if (!src) return null;
  if (!abierto) return <button type="button" class="btn btn-peq" onClick={() => setAbierto(true)}><Icono n="play" /> Escuchar aquí</button>;
  return (
    <div class="reproductor-caja">
      <iframe class="reproductor-spotify" title={`Reproductor de Spotify: ${titulo}`} src={src} width="100%" height={altoIncrustado(url, entero)} loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" />
      <span class="fila-envolver reproductor-acciones">
        {tieneLista(url) && <button type="button" class="btn-texto" aria-expanded={entero ? 'true' : 'false'} onClick={() => setEntero(!entero)}>{entero ? 'Ver solo el reproductor' : `Ver ${tipoMusica(url) === 'Álbum' ? 'el álbum' : tipoMusica(url) === 'Podcast' ? 'los episodios' : 'la lista'} entera`}</button>}
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
        <a class="btn btn-peq" href={url} target="_blank" rel="noopener noreferrer" onClick={() => alAbrir?.()}><Icono n="enlace" /> Abrir en {nombreMusica(url)}</a>
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

export function MusicaSesion({ sesion, semana = null, familia = null, cardio = null, alEmpezar }) {
  const { api, propio } = useApp();
  const personal = usePersonal();
  const coach = useCarga(() => musicaDeTuCoach(api, propio, sesion.id, semana?.bloque_id || null), [sesion.id, semana?.bloque_id, propio]);
  const [mas, setMas] = useState(false);
  const [aviso, setAviso] = useState(() => !!leerAjustes().vozBloqueo && !!leerAjustes().sonido);
  const opciones = musicaDeLaSesion({ coach: coach.datos || {}, personal: personal.datos, familia, foco: semana?.foco || null, sesionId: sesion.id, bloqueId: semana?.bloque_id || null, modalidad: cardio?.modalidad || null });
  // (v0.129) sin ninguna música (ni la del coach ni la suya), una invitación a poner la suya, que se puede cerrar
  // (en el modo atleta del coach no: «Lo tuyo» es de los atletas; sin listas suyas en Cuenta › Música, nada)
  if (!opciones.length) return coach.cargando || personal.cargando || propio ? null : <InvitacionMusica alGuardar={() => personal.recargar(true)} />;
  const [primera, ...otras] = opciones;
  const abrir = () => { if (!propio) api.musicaAbierta(); };
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
    <div class="cadencia" role="group" aria-label="Metrónomo de cadencia" data-en={en ? '1' : undefined} style={{ '--pulso': `${Math.round(60000 / valor)}ms` }}>
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
      {busquedaRitmo(modalidad, valor) && (
        <a class="btn-texto cadencia-buscar" href={busquedaRitmo(modalidad, valor).url} target="_blank" rel="noopener noreferrer">
          <Icono n="buscar" /> Buscar música a {busquedaRitmo(modalidad, valor).bpm} bpm en Spotify
        </a>
      )}
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

// ---------- (v0.129) La música a mano durante la sesión ----------
// Un botón en la sesión ya empezada que abre lo mismo que la portada (para volver a la lista si Spotify se ha parado
// o para cambiar de música a mitad)
export function BotonMusica({ sesion, semana = null, familia = null, cardio = null }) {
  const { api, propio } = useApp();
  const personal = usePersonal();
  const coach = useCarga(() => musicaDeTuCoach(api, propio, sesion.id, semana?.bloque_id || null), [sesion.id, semana?.bloque_id, propio]);
  const [abierta, setAbierta] = useState(false);
  const opciones = musicaDeLaSesion({ coach: coach.datos || {}, personal: personal.datos, familia, foco: semana?.foco || null, sesionId: sesion.id, bloqueId: semana?.bloque_id || null, modalidad: cardio?.modalidad || null });
  if (!opciones.length) return null;
  const abrir = () => { if (!propio) api.musicaAbierta(); };
  return (
    <>
      <button type="button" class="btn btn-peq boton-musica" onClick={() => setAbierta(true)}><Icono n="altavoz" /> Tu música</button>
      {abierta && (
        <Hoja titulo="Tu música" alCerrar={() => setAbierta(false)}>
          <div class="pila-s">{opciones.map((x) => <TarjetaMusica key={x.url} url={x.url} etiqueta={etiquetaOrigen(x)} alAbrir={abrir} />)}</div>
        </Hoja>
      )}
    </>
  );
}
