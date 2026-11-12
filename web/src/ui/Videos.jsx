// Los vídeos de YouTube del coach (migración 059): el vídeo de la semana y los directos en Hoy, los vídeos por tema y los
// últimos de su canal en «Aprende», su canal y lo que han visto sus atletas (para el coach).
import { useState, useMemo } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Icono, Hoja, Vacio } from './comunes.jsx';
import { VideoYoutube } from './YouTube.jsx';
import { CATEGORIAS_RECURSO } from '../logica/calculos.js';
import { fmtCorta } from '../logica/fechas.js';
import {
  videoDe, miniatura, videoDeLaSemana, directoALaVista, textoDirecto, listasPorTema, masVistos, textoVista, textoSegundos, urlConTramo, buscarVideos,
} from '../logica/youtube.js';

const ahorroDatos = () => typeof navigator !== 'undefined' && !!navigator.connection?.saveData;
// Los recursos, recordados entre visitas (los usan Hoy, «Aprende» y el Perfil)
export function useRecursos() {
  const { api } = useApp();
  return useCarga(() => api.recursos().catch(() => []), [], { recuerdo: `recursos:${api.uid()}` });
}

// Un vídeo en su hoja: el reproductor, su descripción (con las marcas de tiempo como saltos) y, si lo hay, de qué canal
export function HojaVideo({ titulo, url, descripcion = '', pie = null, alCerrar }) {
  return (
    <Hoja titulo={titulo} alCerrar={alCerrar} ancho>
      <div class="pila">
        <VideoYoutube url={url} titulo={titulo} notas={descripcion || ''} abierto />
        {descripcion && <p class="secundario peq" style="white-space:pre-line">{descripcion}</p>}
        {pie && <p class="mini terciario">{pie}</p>}
      </div>
    </Hoja>
  );
}

// Una tarjeta de vídeo para una estantería (la miniatura y el título); al tocarla, su hoja
function TarjetaVideo({ id, titulo, detalle = null, alAbrir }) {
  return (
    <button type="button" class="tarjeta-video" onClick={alAbrir}>
      <span class="tarjeta-video-img">{!ahorroDatos() && miniatura(id) && <img src={miniatura(id)} alt="" loading="lazy" referrerpolicy="no-referrer" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />}<span class="yt-play" aria-hidden="true"><Icono n="play" /></span></span>
      <span class="pila-xs"><span class="tarjeta-video-titulo">{titulo}</span>{detalle && <span class="mini terciario">{detalle}</span>}</span>
    </button>
  );
}
function Estanteria({ titulo, sub = null, children, id }) {
  return (
    <section class="seccion estanteria-videos" aria-labelledby={id}>
      <div class="seccion-cab"><h2 id={id}>{titulo}</h2>{sub && <span class="mini terciario">{sub}</span>}</div>
      <div class="fila-videos">{children}</div>
    </section>
  );
}

// ------------------------------------------------------------ Hoy
// El vídeo de la semana (el que marca el coach), en su tarjeta
export function VideoSemanaHoy() {
  const recursos = useRecursos();
  const r = videoDeLaSemana(recursos.datos || []);
  if (!r) return null;
  return (
    <section class="panel panel-pad pila-s video-semana" aria-labelledby="video-semana-t">
      <div class="separa"><h2 id="video-semana-t" class="mini video-semana-k"><Icono n="video" /> El vídeo de la semana</h2></div>
      <strong>{r.titulo}</strong>
      <VideoYoutube url={r.url} titulo={r.titulo} notas={r.descripcion || ''} />
      {r.descripcion && !/\d:\d{2}/.test(r.descripcion) && <p class="peq secundario">{r.descripcion}</p>}
    </section>
  );
}
// Un directo: desde el día antes («Directo mañana a las 19:00») y, a su hora, el reproductor
export function DirectoHoy() {
  const recursos = useRecursos();
  const [ahora] = useState(() => Date.now());
  const d = directoALaVista(recursos.datos || [], ahora);
  if (!d) return null;
  const r = d.recurso;
  return (
    <section class={`panel panel-pad pila-s directo-hoy ${d.estado}`} aria-labelledby="directo-t">
      <h2 id="directo-t" class="mini directo-k"><span class="directo-punto" aria-hidden="true" />{d.estado === 'ahora' ? 'En directo' : `Directo ${textoDirecto(r.directo_en, ahora)}`}</h2>
      <strong>{r.titulo}</strong>
      {r.descripcion && <p class="peq secundario">{r.descripcion}</p>}
      {d.estado === 'ahora' ? <VideoYoutube url={r.url} titulo={r.titulo} /> : <a class="btn btn-peq" href={r.url} target="_blank" rel="noopener noreferrer"><Icono n="campana" /> Verlo en YouTube (y activar el aviso)</a>}
    </section>
  );
}

// ------------------------------------------------------------ «Aprende»
// Los vídeos del coach: el de la semana, lo último de su canal y sus vídeos por tema. Nada si no hay ninguno.
export function VideotecaAprende() {
  const { api } = useApp();
  const recursos = useRecursos();
  const canal = useCarga(() => api.videosCanal().catch(() => null), [], { recuerdo: `canal-videos:${api.uid()}` });
  const [abierto, setAbierto] = useState(null);
  const listas = useMemo(() => listasPorTema(recursos.datos || [], CATEGORIAS_RECURSO), [recursos.datos]);
  const vids = canal.datos?.videos || [];
  const [q, setQ] = useState('');
  // (YouTube) buscar en los vídeos: por título y por las marcas de tiempo de su descripción
  const todos = useMemo(() => [
    ...listas.flatMap((l) => l.videos.map((r) => ({ titulo: r.titulo, url: r.url, notas: r.descripcion || '' }))),
    ...vids.map((v) => ({ titulo: v.titulo, url: urlConTramo(v.id), notas: v.descripcion || '' })),
  ], [listas, vids]);
  const hallados = useMemo(() => buscarVideos(todos, q, 12), [todos, q]);
  if (!listas.length && !vids.length) return null;
  return (
    <div class="pila videoteca">
      {todos.length >= 4 && (
        <div class="buscador"><Icono n="buscar" /><input class="entrada" type="search" maxLength={60} value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder="Buscar en los vídeos" aria-label="Buscar en los vídeos" /></div>
      )}
      {q.trim() && (
        <div class="panel"><ul class="lista" aria-label="Vídeos encontrados">
          {!hallados.length ? <li class="panel-pad peq secundario">Ningún vídeo con eso.</li> : hallados.map(({ item, marca }, i) => (
            <li key={i}><button type="button" class="fila-video panel-pad" onClick={() => setAbierto({ titulo: item.titulo, url: marca ? urlConTramo(videoDe(item.url).id, marca.seg) : item.url, descripcion: item.notas })}>
              <span class="nombre">{item.titulo}</span>{marca && <span class="mini terciario num">{textoSegundos(marca.seg)} · {marca.texto}</span>}
            </button></li>
          ))}
        </ul></div>
      )}
      {vids.length > 0 && (
        <Estanteria id="canal-t" titulo="Lo último en el canal" sub={canal.datos.canal?.titulo || null}>
          {vids.slice(0, 8).map((v) => <TarjetaVideo key={v.id} id={v.id} titulo={v.titulo} detalle={v.publicado ? fmtCorta(v.publicado.slice(0, 10)) : null}
            alAbrir={() => setAbierto({ titulo: v.titulo, url: urlConTramo(v.id), descripcion: v.descripcion || '', pie: canal.datos.canal?.titulo ? `Del canal ${canal.datos.canal.titulo}` : null })} />)}
        </Estanteria>
      )}
      {listas.map((l) => (
        <Estanteria key={l.categoria} id={`vids-${l.categoria}`} titulo={`Vídeos: ${l.nombre.toLowerCase()}`} sub={l.videos.length === 1 ? '1 vídeo' : `${l.videos.length} vídeos`}>
          {l.videos.map((r) => <TarjetaVideo key={r.id} id={videoDe(r.url).id} titulo={r.titulo} detalle={r.directo_en ? `Directo ${textoDirecto(r.directo_en)}` : null}
            alAbrir={() => setAbierto({ titulo: r.titulo, url: r.url, descripcion: r.descripcion || '' })} />)}
        </Estanteria>
      ))}
      {abierto && <HojaVideo {...abierto} alCerrar={() => setAbierto(null)} />}
    </div>
  );
}

// ------------------------------------------------------------ el coach
// «https://www.youtube.com/@fbe», «youtube.com/channel/UC…», «@fbe» o «UC…» → el canal tal como se guarda (o null)
export function canalDeEnlace(texto) {
  const t = String(texto || '').trim();
  let m = /(?:youtube\.com\/)?(@[A-Za-z0-9._-]{3,30})(?:[/?#].*)?$/.exec(t);
  if (m) return m[1];
  m = /(?:youtube\.com\/channel\/)?(UC[A-Za-z0-9_-]{22})(?:[/?#].*)?$/.exec(t);
  return m ? m[1] : null;
}
// Su canal: dónde está, si sale en «Aprende» y sus últimos vídeos (cada uno se puede poner como vídeo de la semana)
export function CanalYoutubeCoach({ alCambiarRecursos = null }) {
  const { api, aviso } = useApp();
  const fila = useCarga(() => api.canalYoutube(), []);
  const [texto, setTexto] = useState(null);
  const [activo, setActivo] = useState(null);
  const [ocupado, una] = useUnaVez();
  const [ver, setVer] = useState(false);
  const vids = useCarga(() => (ver ? api.videosCanal({ forzar: true }) : Promise.resolve(null)), [ver]);
  const [abierto, setAbierto] = useState(null);
  if (fila.cargando && fila.datos === undefined) return null;
  const valor = texto ?? fila.datos?.canal ?? '';
  const act = activo ?? fila.datos?.activo ?? true;
  const canal = canalDeEnlace(valor);
  const guardar = () => una(async () => {
    try {
      if (valor.trim() && !canal) { aviso('Pega el enlace de tu canal (youtube.com/@tu-canal) o su id (UC…).', 'error'); return; }
      await api.guardarCanalYoutube({ canal: canal || '', activo: act });
      aviso(canal ? 'Canal guardado' : 'Canal quitado'); fila.recargar(true); setVer(!!canal);
    } catch (e) { aviso(e.message, 'error'); }
  });
  const destacar = (v) => una(async () => {
    try {
      const todos = await api.recursos();
      for (const r of todos.filter((x) => x.destacado)) await api.actualizar('recursos', r.id, { destacado: false });
      await api.crear('recursos', { titulo: v.titulo.slice(0, 120), categoria: 'general', descripcion: v.descripcion || null, url: urlConTramo(v.id), destacado: true, orden: 0 });
      aviso('Es el vídeo de la semana: sale en Hoy'); alCambiarRecursos?.();
    } catch (e) { aviso(e.message, 'error'); }
  });
  return (
    <section class="panel panel-pad pila-s canal-coach" aria-labelledby="canal-coach-t">
      <h3 id="canal-coach-t" class="peq"><Icono n="video" /> Tu canal de YouTube</h3>
      <p class="mini secundario">Sus últimos vídeos salen en «Aprende» de tus atletas. Hace falta la función «youtube-canal» desplegada en Supabase.</p>
      <div class="campo"><label for="canal-yt">Enlace o id del canal</label>
        <input id="canal-yt" class="entrada" value={valor} placeholder="https://www.youtube.com/@tu-canal" onInput={(e) => setTexto(e.currentTarget.value)} /></div>
      <label class="casilla"><input type="checkbox" checked={act} onChange={(e) => setActivo(e.currentTarget.checked)} /><span>Enseñar sus vídeos a mis atletas</span></label>
      <div class="fila-envolver">
        <button class="btn btn-primario btn-peq" disabled={ocupado} onClick={guardar}>Guardar</button>
        {fila.datos && <button class="btn btn-peq" onClick={() => setVer(!ver)} aria-expanded={ver ? 'true' : 'false'}>{ver ? 'Ocultar sus vídeos' : 'Ver sus últimos vídeos'}</button>}
      </div>
      {ver && (vids.cargando ? <p class="mini terciario">Buscando sus vídeos…</p> : !vids.datos?.videos?.length ? <p class="mini terciario">No han llegado vídeos: revisa el enlace y que la función «youtube-canal» esté desplegada.</p> : (
        <ul class="lista canal-lista">
          {vids.datos.videos.slice(0, 8).map((v) => (
            <li key={v.id} class="separa">
              <button type="button" class="btn-texto canal-video" onClick={() => setAbierto(v)}>{v.titulo}</button>
              <button type="button" class="btn btn-peq plano" disabled={ocupado} onClick={() => destacar(v)}><Icono n="estrella" /> Vídeo de la semana</button>
            </li>
          ))}
        </ul>
      ))}
      {abierto && <HojaVideo titulo={abierto.titulo} url={urlConTramo(abierto.id)} descripcion={abierto.descripcion || ''} alCerrar={() => setAbierto(null)} />}
    </section>
  );
}

// Los más vistos del equipo (lo que funciona y lo que nadie ve)
export function MasVistosEquipo() {
  const { api } = useApp();
  const vistas = useCarga(() => api.videosVistosEquipo(), []);
  const lista = useMemo(() => masVistos(vistas.datos || [], 8), [vistas.datos]);
  const [abierto, setAbierto] = useState(null);
  if (!lista.length) return null;
  return (
    <section class="panel panel-pad pila-s mas-vistos" aria-labelledby="mas-vistos-t">
      <h3 id="mas-vistos-t" class="peq"><Icono n="ojo" /> Los vídeos más vistos del equipo</h3>
      <ol class="lista mas-vistos-lista">
        {lista.map((v) => (
          <li key={v.video}>
            <button type="button" class="fila-video" onClick={() => setAbierto(v)}>
              <span class="nombre">{v.titulo || 'Vídeo de YouTube'}</span>
              <span class="mini terciario num">{v.atletas === 1 ? '1 atleta' : `${v.atletas} atletas`} · {v.veces === 1 ? '1 vez' : `${v.veces} veces`}{v.completos ? ` · ${v.completos} hasta el final` : ''} · {textoSegundos(v.segundos)} en total</span>
            </button>
          </li>
        ))}
      </ol>
      <p class="mini terciario">Solo cuenta lo visto dentro de la app.</p>
      {abierto && <HojaVideo titulo={abierto.titulo || 'Vídeo'} url={urlConTramo(abierto.video)} alCerrar={() => setAbierto(null)} />}
    </section>
  );
}

// Lo que ha visto un atleta (para el coach, en su ficha)
export function VideosVistosAtleta({ atletaId }) {
  const { api } = useApp();
  const vistas = useCarga(() => api.videosVistos(atletaId), [atletaId]);
  const xs = vistas.datos || [];
  if (vistas.cargando && !vistas.datos) return null;
  return (
    <section class="panel panel-pad pila-s vistos-atleta" aria-labelledby="vistos-atleta-t">
      <h3 id="vistos-atleta-t" class="peq"><Icono n="video" /> Vídeos que ha visto</h3>
      {!xs.length ? <Vacio icono="video" titulo="Aún ninguno">Cuando vea un vídeo de YouTube dentro de la app (la técnica de un ejercicio, uno que le mandes), saldrá aquí.</Vacio> : (
        <ul class="lista">
          {xs.slice(0, 30).map((x) => (
            <li key={x.video} class="separa vistos-fila">
              <span class="pila-xs"><span class="nombre">{x.titulo || 'Vídeo de YouTube'}</span><span class="mini terciario">{textoVista(x)} · {fmtCorta(String(x.ultima_vez).slice(0, 10))}</span></span>
              {x.completo ? <span class="chip ok"><Icono n="hecho" />Entero</span> : <span class="chip">A medias</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
