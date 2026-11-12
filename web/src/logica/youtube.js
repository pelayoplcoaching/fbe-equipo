// YouTube dentro de la app: el vídeo de un enlace (con su tramo), las marcas de tiempo de un texto, lo que se recuerda
// de cada vídeo y la cuenta de lo visto. Funciones puras, probadas en test/youtube.test.mjs.
//
// El reproductor es el de youtube-nocookie.com (no pone cookies hasta que se le da a reproducir) y se maneja con
// mensajes (postMessage, el «enablejsapi» del reproductor), sin cargar ningún script de Google en la app.
import { idYoutube, trozosConEnlaces } from './enlaces.js';

export const ORIGEN_YT = 'https://www.youtube-nocookie.com';
export const VELOCIDADES = [1, 0.75, 0.5, 0.25];
// A partir de cuánto un vídeo es «largo» (se recuerda por dónde iba) y cuándo cuenta como visto entero
export const LARGO_SEG = 120;
export const VISTO_PCT = 0.9;

// «1:20», «01:02:03», «80», «1m20s», «2m», «45s» → segundos (o null)
export function segundosDe(x) {
  if (x == null || x === '') return null;
  if (typeof x === 'number') return Number.isFinite(x) && x >= 0 ? Math.floor(x) : null;
  const s = String(x).trim().toLowerCase();
  if (/^\d{1,6}$/.test(s)) return Number(s);
  let m = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/.exec(s);
  if (m) return (m[1] ? Number(m[1]) * 3600 : 0) + Number(m[2]) * 60 + Number(m[3]);
  m = /^(?:(\d{1,2})h)?(?:(\d{1,3})m)?(?:(\d{1,4})s)?$/.exec(s);
  if (m && (m[1] || m[2] || m[3])) return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
  return null;
}
// 80 → «1:20»; 3725 → «1:02:05»
export function textoSegundos(seg) {
  const s = Math.max(0, Math.floor(Number(seg) || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

// El vídeo de un enlace: { id, inicio, fin, vertical, directo } o null. El tramo va en el propio enlace: t= o start= para
// el principio y end= para el final (YouTube ignora end= al abrirlo fuera, pero empieza en t=).
export function videoDe(url) {
  const id = idYoutube(url);
  if (!id) return null;
  let u;
  try { u = new URL(String(url)); } catch { return null; }
  const inicio = segundosDe(u.searchParams.get('t') ?? u.searchParams.get('start'));
  let fin = segundosDe(u.searchParams.get('end'));
  if (fin != null && inicio != null && fin <= inicio) fin = null;
  return { id, inicio: inicio || null, fin: fin || null, vertical: /\/shorts\//.test(u.pathname), directo: /\/live\//.test(u.pathname) };
}
export const esYoutube = (url) => !!idYoutube(url);

// El enlace normal de un vídeo con su tramo (lo que se guarda y lo que abre «Ver en YouTube»)
export function urlConTramo(id, inicio = null, fin = null) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(String(id || ''))) return null;
  const a = segundosDe(inicio), b = segundosDe(fin);
  const p = [`v=${id}`];
  if (a) p.push(`t=${a}s`);
  if (b && (!a || b > a)) p.push(`end=${b}`);
  return `https://www.youtube.com/watch?${p.join('&')}`;
}
// El mismo enlace con el tramo cambiado (vale cualquier forma del enlace de entrada)
export function cambiarTramo(url, inicio, fin) {
  const v = videoDe(url);
  return v ? urlConTramo(v.id, inicio, fin) : url;
}
export const textoTramo = (v) => (v?.inicio || v?.fin ? `${textoSegundos(v.inicio || 0)}${v.fin ? `–${textoSegundos(v.fin)}` : ' en adelante'}` : '');

// La dirección del reproductor incrustado. origen: el de la app (lo pide YouTube para hablar por mensajes).
export function srcIncrustado(v, { origen = '', desde = null, autoplay = true } = {}) {
  if (!v?.id) return null;
  const p = new URLSearchParams({ enablejsapi: '1', playsinline: '1', rel: '0', modestbranding: '1', iv_load_policy: '3' });
  if (autoplay) p.set('autoplay', '1');
  const empieza = desde ?? v.inicio;
  if (empieza) p.set('start', String(Math.floor(empieza)));
  if (v.fin) p.set('end', String(v.fin));
  if (origen) p.set('origin', origen);
  return `${ORIGEN_YT}/embed/${v.id}?${p.toString()}`;
}
// (los vídeos inventados de la demo, «FBEdemo…», no existen: sin miniatura, para no pedir a YouTube lo que no hay)
export const miniatura = (id, grande = false) => (/^FBEdemo/.test(String(id)) ? null : `https://i.ytimg.com/vi/${id}/${grande ? 'hqdefault' : 'mqdefault'}.jpg`);

// Un mensaje para el reproductor: { event: 'command', func, args }
export const orden = (func, args = []) => JSON.stringify({ event: 'command', func, args, id: 1, channel: 'widget' });
export const ESCUCHAR = JSON.stringify({ event: 'listening', id: 1, channel: 'widget' });
// Lo que cuenta el reproductor (infoDelivery / onStateChange / onReady): { estado, tiempo, duracion, velocidad } o null
// estado: -1 sin empezar, 0 terminado, 1 reproduciendo, 2 en pausa, 3 cargando, 5 listo
export function leerMensaje(data) {
  let d = data;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch { return null; } }
  if (!d || typeof d !== 'object') return null;
  if (d.event === 'onReady') return { listo: true };
  if (d.event === 'onStateChange') return { estado: Number(d.info) };
  if (d.event === 'infoDelivery' && d.info && typeof d.info === 'object') {
    const i = d.info, out = {};
    if (Number.isFinite(i.playerState)) out.estado = i.playerState;
    if (Number.isFinite(i.currentTime)) out.tiempo = i.currentTime;
    if (Number.isFinite(i.duration) && i.duration > 0) out.duracion = i.duration;
    if (Number.isFinite(i.playbackRate)) out.velocidad = i.playbackRate;
    return Object.keys(out).length ? out : null;
  }
  return null;
}

// ------------------------------------------------------------ marcas de tiempo
// Las marcas de un texto del coach: una por línea (o tras «·» o «;») que empieza por un tiempo: «1:20 colocación de
// los pies», «- 0:45: la bajada». [{ seg, texto }] en orden, sin repetir, como mucho 20.
// (el tiempo, al principio de la línea: «quedamos a las 10:30» en mitad de una frase no es una marca)
const MARCA_RE = /^[\s(\[\u2022\-\u2013\u2014*]*((?:\d{1,2}:)?\d{1,2}:\d{2})(?=$|[\s)\].,:;-])/;
export function marcasDeTiempo(texto, duracion = null) {
  const out = [];
  const vistos = new Set();
  for (const linea of String(texto || '').split(/\r?\n|\u00b7|;/)) {
    const m = MARCA_RE.exec(linea);
    if (!m) continue;
    const seg = segundosDe(m[1]);
    if (seg == null || vistos.has(seg) || (duracion && seg > duracion)) continue;
    const resto = (linea.slice(0, m.index) + ' ' + linea.slice(m.index + m[0].length)).replace(/^[\s:\u2022\-\u2013\u2014)\]]+|[\s:\u2022\-\u2013\u2014(\[]+$/g, '').replace(/\s+/g, ' ').trim();
    vistos.add(seg);
    out.push({ seg, texto: resto.slice(0, 80) });
  }
  return out.sort((a, b) => a.seg - b.seg).slice(0, 20);
}

// ------------------------------------------------------------ por dónde iba (en el móvil)
// Se guarda solo si el vídeo es largo, ya se ha visto algo (más de 15 s) y no está acabando.
export function posicionAGuardar(tiempo, duracion) {
  const t = Number(tiempo), d = Number(duracion);
  if (!(d >= LARGO_SEG) || !(t > 15) || t > d - 20) return null;
  return Math.floor(t);
}

// ------------------------------------------------------------ lo visto
// Lo visto de verdad: se suman los avances normales del reproductor (no los saltos), a cualquier velocidad.
// cuenta: { visto, ultimo } → la nueva tras un tiempo «t» del reproductor.
export function sumarVisto(cuenta, t) {
  const c = cuenta || { visto: 0, ultimo: null };
  const x = Number(t);
  if (!Number.isFinite(x)) return c;
  const paso = c.ultimo == null ? 0 : x - c.ultimo;
  return { visto: c.visto + (paso > 0 && paso <= 3 ? paso : 0), ultimo: x };
}
// ¿Cuenta como visto entero? (90 % de lo que dura, o de su tramo)
export function vistoEntero(visto, duracion, v = null) {
  const d = Number(duracion);
  if (!(d > 0)) return false;
  const largo = v?.fin ? v.fin - (v.inicio || 0) : v?.inicio ? d - v.inicio : d;
  return Number(visto) >= Math.max(1, largo * VISTO_PCT);
}
// Lo que se apunta: { video, titulo, segundos, completo } (null si no hay nada que contar)
export function vistaAApuntar({ id, titulo = null, visto = 0, duracion = null, v = null } = {}) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(String(id || ''))) return null;
  const segundos = Math.round(Number(visto) || 0);
  if (segundos < 5) return null;
  const t = String(titulo || '').replace(/\s+/g, ' ').trim().slice(0, 120) || null;
  return { video: id, titulo: t, segundos: Math.min(segundos, 6 * 3600), completo: vistoEntero(visto, duracion, v) };
}

// ------------------------------------------------------------ vídeos de un texto
// Los vídeos de YouTube de un texto, con su tramo: [{ url, id, inicio, fin, vertical }] (sin repetir, como mucho 3)
export function videosDeTexto(texto, max = 3) {
  const out = [];
  for (const x of trozosConEnlaces(texto)) {
    if (!x.youtube || out.some((y) => y.id === x.youtube)) continue;
    out.push({ url: x.valor, ...videoDe(x.valor) });
    if (out.length >= max) break;
  }
  return out;
}

// ------------------------------------------------------------ resumen para el coach
// Las vistas de varios atletas → los vídeos más vistos: [{ video, titulo, atletas, veces, completos, segundos }]
export function masVistos(vistas = [], max = 10) {
  const g = new Map();
  for (const x of vistas) {
    const k = x.video;
    const o = g.get(k) || { video: k, titulo: null, atletas: new Set(), veces: 0, completos: 0, segundos: 0, ultima: null };
    o.titulo = o.titulo || x.titulo || null;
    o.atletas.add(x.atleta_id);
    o.veces += Number(x.veces || 1);
    o.completos += x.completo ? 1 : 0;
    o.segundos += Number(x.segundos || 0);
    if (!o.ultima || (x.ultima_vez && x.ultima_vez > o.ultima)) o.ultima = x.ultima_vez || o.ultima;
    g.set(k, o);
  }
  return [...g.values()].map((o) => ({ ...o, atletas: o.atletas.size }))
    .sort((a, b) => b.atletas - a.atletas || b.veces - a.veces || b.segundos - a.segundos).slice(0, max);
}
// «Visto 2 veces, hasta el final» / «Visto una vez (1:20)»
export function textoVista(x) {
  if (!x) return '';
  const veces = Number(x.veces || 1);
  const v = veces === 1 ? 'Visto una vez' : `Visto ${veces} veces`;
  return x.completo ? `${v}, hasta el final` : `${v} (${textoSegundos(x.segundos || 0)})`;
}

// ------------------------------------------------------------ los vídeos del coach (recursos con un enlace de YouTube)
// El vídeo de la semana (el destacado), si es de YouTube
export const videoDeLaSemana = (recursos = []) => recursos.find((r) => r.destacado && videoDe(r.url)) || null;
// Un directo «a la vista»: desde 24 h antes hasta 3 h después de su hora. { recurso, estado: 'pronto' | 'ahora' } o null
export function directoALaVista(recursos = [], ahora = Date.now()) {
  let mejor = null;
  for (const r of recursos) {
    if (!r.directo_en || !videoDe(r.url)) continue;
    const t = Date.parse(r.directo_en);
    if (!Number.isFinite(t) || ahora < t - 24 * 3600000 || ahora > t + 3 * 3600000) continue;
    if (!mejor || t < Date.parse(mejor.directo_en)) mejor = r;
  }
  if (!mejor) return null;
  return { recurso: mejor, estado: ahora >= Date.parse(mejor.directo_en) - 10 * 60000 ? 'ahora' : 'pronto' };
}
// «hoy a las 19:00» / «mañana a las 19:00» / «el jue 13 a las 19:00» (hora de Madrid, la de la app)
export function textoDirecto(iso, ahora = Date.now()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const zona = 'Europe/Madrid';
  const dia = (x) => new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(x);
  const hora = new Intl.DateTimeFormat('es-ES', { timeZone: zona, hour: '2-digit', minute: '2-digit' }).format(d);
  const hoy = dia(new Date(ahora)), manana = dia(new Date(ahora + 86400000)), ese = dia(d);
  if (ese === hoy) return `hoy a las ${hora}`;
  if (ese === manana) return `mañana a las ${hora}`;
  return `el ${new Intl.DateTimeFormat('es-ES', { timeZone: zona, weekday: 'short', day: 'numeric' }).format(d).replace(',', '')} a las ${hora}`;
}
// Los vídeos de los recursos, por tema (su categoría), sin los directos que ya pasaron hace más de una semana:
// [{ categoria, videos: [recurso] }] en el orden de las categorías
export function listasPorTema(recursos = [], categorias = [], ahora = Date.now()) {
  const vids = recursos.filter((r) => r.categoria !== 'faq' && videoDe(r.url) && (!r.directo_en || Date.parse(r.directo_en) > ahora - 7 * 86400000));
  const orden = categorias.map(([c]) => c);
  const out = categorias.map(([c, t]) => ({ categoria: c, nombre: t, videos: vids.filter((r) => r.categoria === c) })).filter((x) => x.videos.length);
  const otros = vids.filter((r) => !orden.includes(r.categoria));
  if (otros.length) out.push({ categoria: 'otra', nombre: 'Otros', videos: otros });
  return out;
}

// ------------------------------------------------------------ buscar en los vídeos
const plano = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const casaTodas = (fichas, texto) => { const ws = plano(texto).split(/[^a-z0-9]+/).filter(Boolean); return fichas.every((f) => ws.some((w) => w.startsWith(f))); };
// items: [{ titulo, url, notas }] → [{ item, marca }]: los que casan por título (marca null) y los momentos de sus
// marcas de tiempo que casan («bajada» → «Sentadilla · 0:50 la bajada», que abre el vídeo en ese momento)
export function buscarVideos(items = [], q = '', max = 12) {
  const fichas = plano(q).split(/\s+/).filter(Boolean);
  if (!fichas.length) return [];
  const out = [];
  for (const it of items) {
    if (!videoDe(it.url)) continue;
    if (casaTodas(fichas, it.titulo)) out.push({ item: it, marca: null });
    for (const m of marcasDeTiempo(it.notas || '')) if (m.texto && casaTodas(fichas, m.texto)) out.push({ item: it, marca: m });
  }
  return out.slice(0, max);
}
