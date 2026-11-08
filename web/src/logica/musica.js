// La música (v0.104, migración 050). Sin iniciar sesión con Spotify (la API ya no lo permite a una app como esta: solo
// 5 usuarios en modo desarrollo y la ampliación, para organizaciones con 250 000 usuarios al mes), todo va por enlaces,
// por el reproductor de Spotify incrustado (se carga al tocarlo) y por la ficha pública de cada enlace (oEmbed).
//   · spotify(url) y urlIncrustar(url): qué es un enlace de Spotify y su reproductor
//   · CLAVES_MUSICA, claveValida: lo que enlaza el coach (listas por tipo de sesión, descarga, equipo, ritmo de cada
//     cardio, una sesión o un bloque)
//   · musicaDeLaSesion: qué música ofrecer en la portada y en qué orden
//   · CADENCIAS: el ritmo de cada cardio (pasos, pedaladas, saltos…) para el metrónomo de cadencia
//   · aperturasDe: cuántas veces abrió su música en un mes o en un año
import { urlMusica } from './personal.js';

const TIPOS = ['playlist', 'album', 'track', 'episode', 'show', 'artist'];
// open.spotify.com/{intl-es/}{tipo}/{id}
export function spotify(url) {
  const m = /^https:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?(playlist|album|track|episode|show|artist)\/([A-Za-z0-9]{10,40})(?:[/?#].*)?$/.exec(String(url || '').trim());
  return m && TIPOS.includes(m[1]) ? { tipo: m[1], id: m[2] } : null;
}
// El reproductor incrustado de Spotify (solo de enlaces de Spotify; de los demás sitios, no hay)
export function urlIncrustar(url) {
  const s = spotify(url);
  return s ? `https://open.spotify.com/embed/${s.tipo}/${s.id}?utm_source=fbe-equipo` : null;
}
export const altoIncrustado = (url) => { const t = spotify(url)?.tipo; return t === 'track' || t === 'episode' ? 152 : 352; };
export const esCancion = (url) => !!urlMusica(url) && (spotify(url) ? spotify(url).tipo === 'track' : true);

// ---------- Lo que enlaza el coach ----------
export const FAMILIAS_MUSICA = [['empuje', 'Empuje'], ['tiron', 'Tirón'], ['pierna', 'Pierna'], ['core', 'Core'], ['fullbody', 'Full body'], ['cardio', 'Cardio'], ['movilidad', 'Movilidad']];
export const RITMOS = ['carrera', 'andar', 'bici', 'eliptica', 'remo', 'nadar', 'cuerda'];
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const CLAVE = new RegExp(`^(familia:(${FAMILIAS_MUSICA.map(([k]) => k).join('|')})|descarga|equipo|ritmo:(${RITMOS.join('|')})|sesion:${UUID}|bloque:${UUID})$`);
export const claveValida = (k) => CLAVE.test(String(k || ''));
export const NOMBRE_ORIGEN = { sesion: 'Tu coach, para hoy', bloque: 'Tu coach, para este bloque', propia: 'Tu música', descarga: 'Lista FBE de descarga', familia: 'Lista FBE', ritmo: 'Al ritmo de tu cardio' };

// Lo que se ofrece en la portada, en orden: lo que el coach puso a esta sesión, a su bloque, la del atleta, la de
// descarga (semana de descarga), la de la familia de la sesión y, en cardio, la de su ritmo. Sin repetir enlaces.
// coach: { clave: url } (lo que devuelve musica_para); personal: lo del atleta; foco: el de la semana
export function musicaDeLaSesion({ coach = {}, personal = null, familia = null, foco = null, sesionId = null, bloqueId = null, modalidad = null } = {}) {
  const lista = [
    sesionId && coach[`sesion:${sesionId}`] && { url: coach[`sesion:${sesionId}`], origen: 'sesion' },
    bloqueId && coach[`bloque:${bloqueId}`] && { url: coach[`bloque:${bloqueId}`], origen: 'bloque' },
    personal?.musica_url && { url: personal.musica_url, origen: 'propia' },
    foco === 'descarga' && coach.descarga && { url: coach.descarga, origen: 'descarga' },
    familia && coach[`familia:${familia}`] && { url: coach[`familia:${familia}`], origen: 'familia', familia },
    modalidad && coach[`ritmo:${modalidad}`] && { url: coach[`ritmo:${modalidad}`], origen: 'ritmo', modalidad },
  ].filter((x) => x && urlMusica(x.url));
  const vistos = new Set();
  return lista.filter((x) => (vistos.has(x.url) ? false : vistos.add(x.url)));
}
export function etiquetaOrigen(x) {
  if (x.origen === 'familia') return `${NOMBRE_ORIGEN.familia} · ${(FAMILIAS_MUSICA.find(([k]) => k === x.familia) || [, ''])[1]}`;
  return NOMBRE_ORIGEN[x.origen] || 'Música';
}

// ---------- El ritmo de cada cardio ----------
// por minuto: pasos (carrera, andar), pedaladas (bici), zancadas (elíptica), paladas (remo), saltos (comba)
export const CADENCIAS = {
  carrera: { unidad: 'pasos', min: 150, max: 190, defecto: 170, paso: 2, ayuda: 'Alrededor de 165–180 pasos por minuto suele ser una zancada más corta y eficiente.' },
  andar: { unidad: 'pasos', min: 90, max: 140, defecto: 115, paso: 5, ayuda: 'A partir de unos 100 pasos por minuto ya es caminar a buen ritmo.' },
  bici: { unidad: 'pedaladas', min: 60, max: 110, defecto: 85, paso: 5, ayuda: 'Entre 80 y 95 pedaladas por minuto es una cadencia cómoda para la mayoría.' },
  eliptica: { unidad: 'zancadas', min: 110, max: 170, defecto: 140, paso: 5, ayuda: 'Mantén un ritmo que puedas sostener sin perder la técnica.' },
  remo: { unidad: 'paladas', min: 18, max: 36, defecto: 24, paso: 1, ayuda: 'De 20 a 26 paladas por minuto para trabajo continuo; más arriba, para series cortas.' },
  cuerda: { unidad: 'saltos', min: 90, max: 180, defecto: 120, paso: 5, ayuda: 'Empieza cómodo y sube cuando el salto salga bajo y regular.' },
};
export const cadenciaDe = (modalidad) => CADENCIAS[modalidad] || null;
export const ajustarCadencia = (modalidad, v) => { const c = CADENCIAS[modalidad]; if (!c) return null; const n = Math.round(Number(v) / c.paso) * c.paso; return Math.max(c.min, Math.min(c.max, Number.isFinite(n) ? n : c.defecto)); };

// ---------- Cuántas veces abrió su música ----------
// aperturas: { 'AAAA-MM': n } (la base las cuenta al abrirla desde una sesión)
export function aperturasDe(aperturas, periodo) {
  const p = String(periodo || '');
  return Object.entries(aperturas && typeof aperturas === 'object' ? aperturas : {})
    .filter(([k]) => /^\d{4}-\d{2}$/.test(k) && k.startsWith(p)).reduce((t, [, n]) => t + (Number.isFinite(Number(n)) ? Math.max(0, Math.floor(Number(n))) : 0), 0);
}
