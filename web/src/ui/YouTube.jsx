// YouTube dentro de la app: el reproductor (con su miniatura delante hasta que se toca), sus herramientas para la técnica
// (velocidad, el tramo en bucle, las marcas de tiempo del coach), lo que recuerda (por dónde ibas en los vídeos largos) y
// lo que cuenta (lo visto, para el coach). Sin scripts de Google: el reproductor de youtube-nocookie.com se maneja con
// mensajes. Con el ahorro de datos del móvil no se pide la miniatura; sin conexión, se avisa.
import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { useApp, Icono } from './comunes.jsx';
import {
  videoDe, srcIncrustado, miniatura, orden, ESCUCHAR, leerMensaje, ORIGEN_YT, VELOCIDADES, marcasDeTiempo, textoSegundos,
  textoTramo, posicionAGuardar, sumarVisto, vistaAApuntar, urlConTramo, segundosDe, cambiarTramo,
} from '../logica/youtube.js';

const ahorroDatos = () => typeof navigator !== 'undefined' && !!navigator.connection?.saveData;
const sinRed = () => typeof navigator !== 'undefined' && navigator.onLine === false;
const CLAVE_POS = (id) => `fbe-yt-pos:${id}`;
function leerPos(id) { try { const n = Number(localStorage.getItem(CLAVE_POS(id))); return n > 0 ? n : null; } catch { return null; } }
function guardarPos(id, seg) { try { if (seg) localStorage.setItem(CLAVE_POS(id), String(seg)); else localStorage.removeItem(CLAVE_POS(id)); } catch { /* sin almacenamiento */ } }
const fmtVel = (v) => `${String(v).replace('.', ',')}×`;

// url: el enlace (con su tramo, si lo lleva). titulo: lo que se apunta como visto y lo que lee el lector de pantalla.
// notas: un texto con marcas de tiempo («1:20 los pies»), que salen debajo como saltos. compacto: sin herramientas
// hasta que se abre (en el chat). abierto: empieza ya reproduciendo (el mini-reproductor). alTerminar: al acabar (o al
// verse entero), una vez. alEstado: cada cambio de { tiempo, duracion, estado } (para quien lo necesite).
export function VideoYoutube({ url, titulo = 'Vídeo de YouTube', notas = '', compacto = false, abierto: abiertoInicial = false, alTerminar = null, clase = '', contar = true }) {
  const { api } = useApp();
  const v = useMemo(() => videoDe(url), [url]);
  const marcas = useMemo(() => marcasDeTiempo(notas), [notas]);
  const [abierto, setAbierto] = useState(abiertoInicial);
  const [desde, setDesde] = useState(null);
  const [vel, setVel] = useState(1);
  const [bucle, setBucle] = useState(true);
  const [info, setInfo] = useState({ tiempo: 0, duracion: null, estado: -1 });
  const [pos] = useState(() => (v && !v.inicio ? leerPos(v.id) : null));
  const marco = useRef(null);
  const cuenta = useRef({ visto: 0, ultimo: null });
  const enviado = useRef(0);
  const terminado = useRef(false);
  const ultimaPos = useRef(0);
  const vivo = useRef({});
  vivo.current = { v, titulo, bucle, alTerminar, info };

  const mandar = (func, args = []) => { try { marco.current?.contentWindow?.postMessage(orden(func, args), ORIGEN_YT); } catch { /* aún no está */ } };
  const apuntar = (forzar = false) => {
    const { v: vv, titulo: t, info: i } = vivo.current;
    if (!contar || !vv || !api?.apuntarVistaVideo) return;
    const visto = cuenta.current.visto;
    if (!forzar && visto - enviado.current < 10) return;
    const x = vistaAApuntar({ id: vv.id, titulo: t, visto, duracion: i.duracion, v: vv });
    if (!x) return;
    enviado.current = visto;
    api.apuntarVistaVideo(x).catch(() => { /* lo visto no es importante: si falla, no se insiste */ });
  };

  // Hablar con el reproductor: «te escucho» hasta que conteste, y leer lo que cuenta
  useEffect(() => {
    if (!abierto || !v) return undefined;
    let contesto = false;
    const saludo = setInterval(() => { if (contesto) clearInterval(saludo); else try { marco.current?.contentWindow?.postMessage(ESCUCHAR, ORIGEN_YT); } catch { /* */ } }, 300);
    const oir = (e) => {
      if (e.origin !== ORIGEN_YT || e.source !== marco.current?.contentWindow) return;
      const m = leerMensaje(e.data);
      if (!m) return;
      contesto = true;
      setInfo((i) => {
        const n = { ...i, ...m };
        if (m.tiempo != null) {
          cuenta.current = sumarVisto(cuenta.current, m.tiempo);
          const p = posicionAGuardar(m.tiempo, n.duracion);
          if (p != null && Math.abs(p - ultimaPos.current) >= 5) { ultimaPos.current = p; guardarPos(v.id, p); }
        }
        return n;
      });
      if (m.estado === 0) {
        const { v: vv, bucle: b, alTerminar: fin } = vivo.current;
        if (!vv.inicio && !vv.fin) guardarPos(vv.id, null);
        apuntar(true);
        if (!terminado.current) { terminado.current = true; fin?.(); }
        if (b && (vv.inicio || vv.fin)) { mandar('seekTo', [vv.inicio || 0, true]); mandar('playVideo'); }
      } else if (m.estado === 2) apuntar();
    };
    window.addEventListener('message', oir);
    return () => { clearInterval(saludo); window.removeEventListener('message', oir); apuntar(true); };
  }, [abierto, v?.id]);

  // La velocidad elegida, también tras cada vuelta del bucle
  useEffect(() => { if (abierto && info.estado === 1) mandar('setPlaybackRate', [vel]); }, [vel, abierto, info.estado === 1]);

  if (!v) return null;
  const abrir = (seg = null) => {
    if (sinRed()) return;
    if (abierto) { if (seg != null) { mandar('seekTo', [seg, true]); mandar('playVideo'); } return; }
    setDesde(seg); setAbierto(true);
  };
  const tramo = textoTramo(v);
  const origen = typeof location !== 'undefined' ? location.origin : '';
  const fuera = urlConTramo(v.id, v.inicio, v.fin);
  const ahorro = ahorroDatos();
  return (
    <div class={`yt ${v.vertical ? 'yt-vertical' : ''} ${compacto ? 'yt-compacto' : ''} ${clase}`}>
      {abierto ? (
        <div class="yt-marco">
          <iframe ref={marco} src={srcIncrustado(v, { origen, desde })} title={titulo} allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen referrerpolicy="strict-origin-when-cross-origin" loading="lazy" />
        </div>
      ) : sinRed() ? (
        <div class="yt-marco yt-sin" role="note"><Icono n="video" /><span class="peq">Sin conexión: el vídeo se podrá ver cuando vuelvas a tener red.</span></div>
      ) : (
        <button type="button" class="yt-marco yt-fachada" onClick={() => abrir(null)} aria-label={`Reproducir: ${titulo}`}>
          {!ahorro && miniatura(v.id) && <img src={miniatura(v.id, !compacto)} alt="" loading="lazy" referrerpolicy="no-referrer" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />}
          {ahorro && <span class="yt-ahorro peq">Ahorro de datos: tócalo para verlo</span>}
          <span class="yt-play" aria-hidden="true"><Icono n="play" /></span>
          <span class="yt-pie mini"><Icono n="video" />{tramo ? `YouTube · ${tramo}` : v.directo ? 'YouTube · directo' : 'YouTube'}</span>
        </button>
      )}
      {!abierto && pos && !compacto && (
        <button type="button" class="btn btn-peq plano yt-seguir" onClick={() => abrir(pos)}><Icono n="play" /> Seguir por el {textoSegundos(pos)}</button>
      )}
      {(abierto || !compacto) && (
        <div class="yt-herramientas">
          <div class="selector-chips yt-vel" role="group" aria-label="Velocidad">
            {VELOCIDADES.map((x) => <button type="button" key={x} aria-pressed={vel === x ? 'true' : 'false'} onClick={() => { setVel(x); if (!abierto) abrir(null); }}>{fmtVel(x)}</button>)}
          </div>
          {(v.inicio || v.fin) && <button type="button" class="btn btn-peq plano" aria-pressed={bucle ? 'true' : 'false'} onClick={() => setBucle(!bucle)} title="Repetir el tramo"><Icono n="reiniciar" /> {bucle ? 'En bucle' : 'Una vez'}</button>}
          <a class="btn btn-peq plano yt-fuera" href={fuera} target="_blank" rel="noopener noreferrer" onClick={() => apuntar(true)}>Ver en YouTube</a>
        </div>
      )}
      {marcas.length > 0 && (
        <ol class="yt-marcas" aria-label="Momentos del vídeo">
          {marcas.map((m) => (
            <li key={m.seg}><button type="button" class="yt-marca" onClick={() => abrir(m.seg)} aria-current={abierto && info.tiempo >= m.seg && !marcas.some((o) => o.seg > m.seg && info.tiempo >= o.seg) ? 'true' : undefined}>
              <span class="num">{textoSegundos(m.seg)}</span>{m.texto && <span>{m.texto}</span>}
            </button></li>
          ))}
        </ol>
      )}
    </div>
  );
}

// El mini-reproductor: un vídeo flotando abajo, encima de la barra, mientras se sigue usando la pantalla (la sesión, con su
// descanso). Se puede encoger (solo la cabecera) y cerrar.
export function MiniYoutube({ url, titulo, notas = '', alCerrar }) {
  const [encogido, setEncogido] = useState(false);
  if (!videoDe(url)) return null;
  return (
    <aside class={`yt-mini ${encogido ? 'encogido' : ''}`} aria-label={`Vídeo: ${titulo}`}>
      <div class="yt-mini-cab">
        <span class="mini yt-mini-titulo"><Icono n="video" /> {titulo}</span>
        <button type="button" class="btn btn-icono plano" aria-label={encogido ? 'Ver el vídeo' : 'Encoger el vídeo'} aria-expanded={encogido ? 'false' : 'true'} onClick={() => setEncogido(!encogido)}><Icono n={encogido ? 'arriba' : 'abajo'} /></button>
        <button type="button" class="btn btn-icono plano" aria-label="Cerrar el vídeo" onClick={alCerrar}><Icono n="cerrar" /></button>
      </div>
      <div class="yt-mini-cuerpo" hidden={encogido}><VideoYoutube url={url} titulo={titulo} notas={notas} abierto compacto={false} /></div>
    </aside>
  );
}

// Para el coach: el enlace de un vídeo y, si es de YouTube, el tramo que importa (desde, hasta) con la vista previa.
// El tramo se guarda dentro del propio enlace (t= y end=), así vale en todas partes sin nada más en la base.
export function CampoVideo({ id, etiqueta = 'Vídeo', valor = '', alCambiar, ayuda = null }) {
  const v = videoDe(valor);
  const [desde, setDesde] = useState(v?.inicio ? textoSegundos(v.inicio) : '');
  const [hasta, setHasta] = useState(v?.fin ? textoSegundos(v.fin) : '');
  const [mal, setMal] = useState(false);
  const aplicar = (d, h) => {
    const a = d.trim() ? segundosDe(d) : null, b = h.trim() ? segundosDe(h) : null;
    const malo = (d.trim() && a == null) || (h.trim() && b == null) || (a != null && b != null && b <= a);
    setMal(!!malo);
    if (!malo && v) alCambiar(cambiarTramo(valor, a, b));
  };
  return (
    <div class="campo pila-s">
      <label for={id}>{etiqueta}</label>
      <input id={id} class="entrada" type="url" value={valor} placeholder="https://youtube.com/…" onInput={(e) => { alCambiar(e.currentTarget.value); setDesde(''); setHasta(''); setMal(false); }} />
      {v ? (
        <>
          <div class="rejilla-campos">
            <div class="campo"><label for={`${id}-desde`}>Desde (m:ss)</label><input id={`${id}-desde`} class="entrada num" inputMode="numeric" placeholder="0:00" value={desde} onInput={(e) => setDesde(e.currentTarget.value)} onBlur={() => aplicar(desde, hasta)} /></div>
            <div class="campo"><label for={`${id}-hasta`}>Hasta (m:ss)</label><input id={`${id}-hasta`} class="entrada num" inputMode="numeric" placeholder="el final" value={hasta} onInput={(e) => setHasta(e.currentTarget.value)} onBlur={() => aplicar(desde, hasta)} /></div>
          </div>
          <span class={mal ? 'error-campo' : 'ayuda'}>{mal ? 'Escribe los tiempos como 1:20 (y «hasta» después de «desde»).' : ayuda || 'Si solo importa un trozo, ponlo: el vídeo empezará ahí y se repetirá en bucle. En las notas, «1:20 la bajada» se convierte en un salto a ese momento.'}</span>
          <VideoYoutube key={valor} url={valor} titulo="Vista previa" compacto contar={false} />
        </>
      ) : ayuda && <span class="ayuda">{ayuda}</span>}
    </div>
  );
}

// El mini-reproductor de la sesión: cualquiera lo abre con abrirMini({ url, titulo, notas }) y lo pinta <MiniGlobal />
// (dentro de la sesión: al salir de ella, se va con ella).
export const abrirMini = (d) => { try { window.dispatchEvent(new CustomEvent('fbe-yt-mini', { detail: d })); } catch { /* */ } };
export function MiniGlobal() {
  const [d, setD] = useState(null);
  useEffect(() => {
    const oir = (e) => setD(e.detail && videoDe(e.detail.url) ? { ...e.detail, k: Date.now() } : null);
    window.addEventListener('fbe-yt-mini', oir);
    return () => window.removeEventListener('fbe-yt-mini', oir);
  }, []);
  return d ? <MiniYoutube key={d.k} url={d.url} titulo={d.titulo || 'Vídeo'} notas={d.notas || ''} alCerrar={() => setD(null)} /> : null;
}

// Para el coach, en el editor de la sesión: «sigue este vídeo» (el enlace, con su tramo, y cómo se llama). Plegado.
export function VideoDeSesionCoach({ sesion, guardar }) {
  const [abierto, setAbierto] = useState(!!sesion.video_url);
  const [url, setUrl] = useState(sesion.video_url || '');
  const [titulo, setTitulo] = useState(sesion.video_titulo || '');
  if (!abierto) return <button type="button" class="btn-texto" style="justify-self:start" onClick={() => setAbierto(true)}><Icono n="video" /> Añadir un vídeo para seguir</button>;
  const valido = !url.trim() || !!videoDe(url.trim());
  const guardarYa = (u = url, t = titulo) => {
    const uu = u.trim();
    if (uu && !videoDe(uu)) return;
    guardar('sesiones', sesion.id, { video_url: uu || null, video_titulo: uu ? (t.trim().slice(0, 80) || null) : null });
  };
  return (
    <div class="pila-s video-sesion-coach">
      <CampoVideo id={`sv-${sesion.id}`} etiqueta="Vídeo para seguir (YouTube)" valor={url} alCambiar={(x) => { setUrl(x); if (!x.trim() || videoDe(x.trim())) guardarYa(x, titulo); }}
        ayuda="El atleta lo verá arriba de la sesión, dentro de la app; al acabarlo, queda como hecho." />
      {!valido && <span class="error-campo">Tiene que ser un enlace de YouTube.</span>}
      {url.trim() && valido && <div class="campo"><label for={`svt-${sesion.id}`}>Cómo se llama</label><input id={`svt-${sesion.id}`} class="entrada" maxLength={80} value={titulo} placeholder="Calentamiento de 10 minutos" onInput={(e) => setTitulo(e.currentTarget.value)} onBlur={() => guardarYa()} /></div>}
    </div>
  );
}
