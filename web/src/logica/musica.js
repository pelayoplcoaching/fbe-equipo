// La música (v0.104, migración 050). Sin iniciar sesión con Spotify (la API ya no lo permite a una app como esta: solo
// 5 usuarios en modo desarrollo y la ampliación, para organizaciones con 250 000 usuarios al mes), todo va por enlaces,
// por el reproductor de Spotify incrustado (se carga al tocarlo) y por la ficha pública de cada enlace (oEmbed).
//   · spotify(url) y urlIncrustar(url): qué es un enlace de Spotify y su reproductor
//   · CLAVES_MUSICA, claveValida: lo que enlaza el coach (listas por tipo de sesión, descarga, equipo, ritmo de cada
//     cardio, una sesión o un bloque)
//   · musicaDeLaSesion: qué música ofrecer en la portada y en qué orden
//   · CADENCIAS: el ritmo de cada cardio (pasos, pedaladas, saltos…) para el metrónomo de cadencia
//   · aperturasDe: cuántas veces abrió su música en un mes o en un año
//   · (v0.129) tipoMusica, tieneLista, esEnlaceCorto, busquedaRitmo, fichaVigente
import { urlMusica } from './personal.js';

const TIPOS = ['playlist', 'album', 'track', 'episode', 'show', 'artist'];
// open.spotify.com/{intl-es/}{tipo}/{id}
export function spotify(url) {
  const m = /^https:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?(playlist|album|track|episode|show|artist)\/([A-Za-z0-9]{10,40})(?:[/?#].*)?$/.exec(String(url || '').trim());
  return m && TIPOS.includes(m[1]) ? { tipo: m[1], id: m[2] } : null;
}
// El reproductor incrustado de Spotify (solo de enlaces de Spotify; de los demás sitios, no hay)
// (v0.129) oscuro: con la app en oscuro, el reproductor en negro (theme=0) en vez del color de la portada
export function urlIncrustar(url, { oscuro = false } = {}) {
  const s = spotify(url);
  return s ? `https://open.spotify.com/embed/${s.tipo}/${s.id}?utm_source=fbe-equipo${oscuro ? '&theme=0' : ''}` : null;
}
// (v0.129) compacto (152 px, una fila con el play) para todo; entero (352 px, con la lista de canciones) para listas,
// álbumes, podcasts y artistas cuando se pide
export const altoIncrustado = (url, entero = true) => { const t = spotify(url)?.tipo; return !entero || t === 'track' || t === 'episode' ? 152 : 352; };
export const tieneLista = (url) => ['playlist', 'album', 'show', 'artist'].includes(spotify(url)?.tipo);
// (v0.129) qué es cada enlace, para decirlo en su tarjeta
const TIPO_NOMBRE = { playlist: 'Lista', album: 'Álbum', track: 'Canción', episode: 'Episodio de podcast', show: 'Podcast', artist: 'Artista' };
export const tipoMusica = (url) => TIPO_NOMBRE[spotify(url)?.tipo] || null;
// (v0.129) los enlaces cortos de Spotify (spotify.link/…) valen para abrirlos, pero sin su nombre, su portada ni su
// reproductor (la app no puede seguir la redirección): se avisa de cómo copiar el enlace largo
export const esEnlaceCorto = (url) => /^https:\/\/spotify\.link\//i.test(String(url || '').trim());
// (v0.129) buscar en Spotify música a un ritmo (para la cadencia del cardio): en bici, el doble (un golpe por pedalada de
// cada pierna); en remo no hay música a 24 golpes
export function busquedaRitmo(modalidad, valor) {
  if (!CADENCIAS[modalidad] || modalidad === 'remo') return null;
  const bpm = modalidad === 'bici' ? valor * 2 : valor;
  return { bpm, url: `https://open.spotify.com/search/${encodeURIComponent(`${bpm} bpm`)}` };
}
export const esCancion = (url) => !!urlMusica(url) && (spotify(url) ? spotify(url).tipo === 'track' : true);

// ---------- Lo que enlaza el coach ----------
export const FAMILIAS_MUSICA = [['empuje', 'Empuje'], ['tiron', 'Tirón'], ['pierna', 'Pierna'], ['core', 'Core'], ['fullbody', 'Full body'], ['cardio', 'Cardio'], ['movilidad', 'Movilidad']];
export const RITMOS = ['carrera', 'andar', 'bici', 'eliptica', 'remo', 'nadar', 'cuerda'];
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
// (música 3) también las fases (calentamiento y vuelta a la calma), la lista de los días de test y el pódcast
const CLAVE = new RegExp(`^(familia:(${FAMILIAS_MUSICA.map(([k]) => k).join('|')})|descarga|equipo|ritmo:(${RITMOS.join('|')})|fase:(calentamiento|vuelta_calma)|test|podcast|sesion:${UUID}|bloque:${UUID})$`);
export const claveValida = (k) => CLAVE.test(String(k || ''));
export const NOMBRE_ORIGEN = { sesion: 'Tu coach, para hoy', bloque: 'Tu coach, para este bloque', propia: 'Tu música', descarga: 'Lista FBE de descarga', familia: 'Lista FBE', ritmo: 'Al ritmo de tu cardio',
  // (música 3)
  etiqueta: 'Tu lista', animo: 'Para cómo llegas hoy', companero: 'Con tu compañero de racha', test: 'Para tu día de test', podcast: 'El pódcast de FBE' };
// (música 3) Las etiquetas de sus listas: los tipos de sesión, cómo llega y las fases
export const ETIQUETAS_LISTA = [...FAMILIAS_MUSICA, ['energia', 'Para días con energía'], ['tranquila', 'Para días flojos'], ['calentamiento', 'Para calentar'], ['vuelta_calma', 'Para la vuelta a la calma']];
export const nombreEtiqueta = (k) => (ETIQUETAS_LISTA.find(([x]) => x === k) || [, ''])[1];

// Lo que se ofrece en la portada, en orden: lo que el coach puso a esta sesión, a su bloque, la del atleta, la de
// descarga (semana de descarga), la de la familia de la sesión y, en cardio, la de su ritmo. Sin repetir enlaces.
// coach: { clave: url } (lo que devuelve musica_para); personal: lo del atleta; foco: el de la semana
// (música 3) Y además: la lista del día de test (si la sesión lo es), su himno de vuelta (tras un parón), su lista según
// cómo llega (energía o tranquila), su lista con la etiqueta de ese tipo de sesión, la de su compañero de racha y, en el
// cardio largo (30 min o más), el pódcast de FBE. Orden: lo del coach para hoy, el test, el bloque, su vuelta, cómo llega,
// su lista de ese tipo, su lista, la de su compañero, descarga, la lista FBE del tipo, el ritmo y el pódcast
export function musicaDeLaSesion({ coach = {}, personal = null, familia = null, foco = null, sesionId = null, bloqueId = null, modalidad = null,
  prep = null, esTest = false, vuelta = false, companeros = [], minutos = null } = {}) {
  const listas = Array.isArray(personal?.musica_listas) ? personal.musica_listas : [];
  const deEtiqueta = (k) => listas.find((l) => l?.etiqueta === k)?.url;
  const animo = listaAnimo(prep);
  const lista = [
    sesionId && coach[`sesion:${sesionId}`] && { url: coach[`sesion:${sesionId}`], origen: 'sesion' },
    esTest && coach.test && { url: coach.test, origen: 'test' },
    bloqueId && coach[`bloque:${bloqueId}`] && { url: coach[`bloque:${bloqueId}`], origen: 'bloque' },
    vuelta && personal?.himno_vuelta_url && { url: personal.himno_vuelta_url, origen: 'vuelta' },
    animo && deEtiqueta(animo) && { url: deEtiqueta(animo), origen: 'animo', etiqueta: animo },
    familia && deEtiqueta(familia) && { url: deEtiqueta(familia), origen: 'etiqueta', etiqueta: familia },
    personal?.musica_url && { url: personal.musica_url, origen: 'propia' },
    ...(companeros || []).filter((c) => c?.url).map((c) => ({ url: c.url, origen: 'companero', otro: c.otro })),
    foco === 'descarga' && coach.descarga && { url: coach.descarga, origen: 'descarga' },
    familia && coach[`familia:${familia}`] && { url: coach[`familia:${familia}`], origen: 'familia', familia },
    modalidad && coach[`ritmo:${modalidad}`] && { url: coach[`ritmo:${modalidad}`], origen: 'ritmo', modalidad },
    modalidad && Number(minutos) >= 30 && coach.podcast && { url: coach.podcast, origen: 'podcast' },
  ].filter((x) => x && urlMusica(x.url));
  const vistos = new Set();
  return lista.filter((x) => (vistos.has(x.url) ? false : vistos.add(x.url)));
}
export function etiquetaOrigen(x) {
  if (x.origen === 'familia') return `${NOMBRE_ORIGEN.familia} · ${(FAMILIAS_MUSICA.find(([k]) => k === x.familia) || [, ''])[1]}`;
  // (música 3)
  if (x.origen === 'etiqueta') return `${NOMBRE_ORIGEN.etiqueta} · ${nombreEtiqueta(x.etiqueta)}`;
  if (x.origen === 'animo') return `${NOMBRE_ORIGEN.animo} · ${nombreEtiqueta(x.etiqueta)}`;
  if (x.origen === 'companero') return x.otro ? `Con ${x.otro}, tu compañero de racha` : NOMBRE_ORIGEN.companero;
  if (x.origen === 'vuelta') return 'Tu himno de vuelta: bienvenido otra vez';
  if (x.origen === 'fase') return x.fase === 'calentamiento' ? 'Para calentar' : 'Para la vuelta a la calma';
  return NOMBRE_ORIGEN[x.origen] || 'Música';
}

// ---------- (música 3) Según cómo llega, las fases y el día de test ----------
// prep: lo que contestó en «¿Cómo llegas hoy?» ({ sueno, energia, molestias }, de 1 a 3). Tocado o con poca energía, su
// lista tranquila; con todo (energía 3), la de energía. Es una propuesta: lo demás sigue ahí
export function listaAnimo(prep) {
  if (!prep || typeof prep !== 'object') return null;
  const e = Number(prep.energia), s = Number(prep.sueno), m = Number(prep.molestias);
  if (e === 1 || m === 1 || (e + s + m) <= 4) return 'tranquila';
  if (e === 3) return 'energia';
  return null;
}
// La fase de la sesión: antes de la primera serie, calentar; hecho todo, la vuelta a la calma; si no, el trabajo
export function faseDeSesion({ hechas = 0, total = 0 } = {}) {
  if (!total) return null;
  if (hechas <= 0) return 'calentamiento';
  if (hechas >= total) return 'vuelta_calma';
  return 'trabajo';
}
// La música de esa fase: la del coach (fase:…) o su lista con esa etiqueta
export function musicaDeFase({ coach = {}, personal = null, fase = null } = {}) {
  if (fase !== 'calentamiento' && fase !== 'vuelta_calma') return null;
  const suya = (Array.isArray(personal?.musica_listas) ? personal.musica_listas : []).find((l) => l?.etiqueta === fase)?.url;
  const url = coach[`fase:${fase}`] || suya || null;
  return url && urlMusica(url) ? { url, origen: 'fase', fase } : null;
}
// ¿Es un día de test? Una carrera de tipo «test» o una sesión que el coach llama «Test…», «1RM», «RM» o «Evaluación»
export function esSesionTest(sesion) {
  if (!sesion) return false;
  if (sesion.cardio?.tipo === 'test') return true;
  return /(^|[^a-z\u00e1-\u00fa])(test|1\s?rm|rm|evaluaci\u00f3n|evaluacion)([^a-z\u00e1-\u00fa]|$)/i.test(`${sesion.nombre || ''} ${sesion.intencion || ''}`);
}
// ¿Vuelve tras un parón? 7 días o más desde su último entreno hecho (sin contar hoy)
export function vuelveDeParon(entrenos = [], hoy) {
  const f = (entrenos || []).map((x) => x?.fecha).filter((x) => x && x < hoy).sort().pop();
  if (!f) return false;
  const d = Math.round((Date.parse(`${hoy}T12:00:00Z`) - Date.parse(`${f}T12:00:00Z`)) / 864e5);
  return d >= 7;
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

// ---------- (v0.129) La ficha guardada de un enlace ----------
// Se pide otra vez a la semana; sin cobertura (o si Spotify no contesta), vale la que haya aunque sea más vieja: sin
// cobertura en el gimnasio, la tarjeta sigue con el nombre de la lista
export const FICHA_DIAS = 7;
export function fichaVigente(guardada, ahora = Date.now()) {
  if (!guardada || typeof guardada !== 'object' || !Number.isFinite(guardada.t)) return { usar: null, pedir: true };
  return { usar: guardada, pedir: ahora - guardada.t >= FICHA_DIAS * 864e5 };
}

// ---------- (música 3) ¿A cuántos bpm va lo que suena? (tocar al ritmo) ----------
// tiempos: los instantes de cada toque (ms, de menor a mayor). Con 4 toques o más, la mediana de los intervalos (entre
// 30 y 240 bpm: los toques sueltos o dobles se descartan). Si pasa más de TOQUE_REINICIO_MS sin tocar, se empieza otra vez
export const TOQUE_REINICIO_MS = 2500;
export function bpmDeToques(tiempos = []) {
  const t = (Array.isArray(tiempos) ? tiempos : []).filter(Number.isFinite).slice(-9);
  if (t.length < 4) return null;
  const d = [];
  for (let i = 1; i < t.length; i++) d.push(t[i] - t[i - 1]);
  const v = d.filter((x) => x >= 250 && x <= 2000).sort((a, b) => a - b);
  if (v.length < 3) return null;
  const med = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
  return Math.round(60000 / med);
}
// ¿Encaja con su cadencia? En bici, la música va al doble (un golpe por pedalada de cada pierna). Vale también a doble o
// a mitad de tiempo (una canción a 85 bpm marca bien 170 pasos). En remo, la música no marca la palada: no se compara
export function encajaRitmo(bpm, modalidad, valor) {
  const c = CADENCIAS[modalidad];
  if (!c || modalidad === 'remo' || !Number.isFinite(bpm) || bpm <= 0 || !Number.isFinite(valor)) return null;
  const objetivo = modalidad === 'bici' ? valor * 2 : valor;
  const mejor = [bpm, bpm * 2, bpm / 2].reduce((a, b) => (Math.abs(b - objetivo) < Math.abs(a - objetivo) ? b : a));
  const dif = mejor - objetivo;
  const encaja = Math.abs(dif) <= Math.max(3, objetivo * 0.04);
  const tuyo = `tus ${valor} ${c.unidad}/min`;
  const texto = encaja ? `Encaja con ${tuyo}${mejor !== bpm ? ' (a doble o a mitad de tiempo)' : ''}.`
    : `No encaja con ${tuyo}: busca música a unos ${objetivo} bpm (o ${Math.round(objetivo / 2)}).`;
  return { objetivo, encaja, dif: Math.round(dif), doble: mejor !== bpm, texto };
}

// ---------- (música 3) La cadencia por tramos (cardio por intervalos) ----------
// t = { trabajo, descanso (segundos), rondas, alta, baja (la cadencia de cada fase) }; seg: los segundos desde que empezó.
// Avisa 5 s antes de cada cambio (en el último tramo de trabajo, no: después ya no hay descanso)
export const AVISO_TRAMO_S = 5;
export function normalizarTramos(t = {}, modalidad = 'carrera') {
  const c = CADENCIAS[modalidad] || CADENCIAS.carrera;
  const ent = (v, a, b, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : d; };
  return {
    trabajo: ent(t.trabajo, 10, 1800, 60), descanso: ent(t.descanso, 0, 1800, 120), rondas: ent(t.rondas, 1, 30, 6),
    alta: ajustarCadencia(modalidad, t.alta ?? c.max - 2 * c.paso), baja: ajustarCadencia(modalidad, t.baja ?? c.min + 2 * c.paso),
  };
}
export const duracionTramos = (t) => t.rondas * t.trabajo + Math.max(0, t.rondas - 1) * t.descanso;
export function tramoCadencia(t, seg) {
  const total = duracionTramos(t);
  if (!Number.isFinite(seg) || seg < 0) seg = 0;
  if (seg >= total) return { fin: true, total };
  const ciclo = t.trabajo + t.descanso;
  const r = Math.floor(seg / ciclo);
  const dentro = seg - r * ciclo;
  const trabajo = dentro < t.trabajo;
  const quedan = trabajo ? t.trabajo - dentro : ciclo - dentro;
  const ultimo = trabajo && r === t.rondas - 1;
  return { fin: false, total, ronda: r + 1, rondas: t.rondas, fase: trabajo ? 'trabajo' : 'descanso', cadencia: trabajo ? t.alta : t.baja, quedan: Math.ceil(quedan), avisar: !ultimo && quedan <= AVISO_TRAMO_S };
}
// De las partes de una carrera del coach: la primera con repeticiones, tiempo y recuperación (p. ej. 6 × 1 min, rec. 2 min)
export function tramosDeCarrera(pauta) {
  const p = (Array.isArray(pauta?.partes) ? pauta.partes : []).find((x) => Number(x?.reps) > 1 && Number(x?.seg) > 0 && Number(x?.rec_seg) > 0);
  return p ? { trabajo: Number(p.seg), descanso: Number(p.rec_seg), rondas: Number(p.reps) } : null;
}

// ---------- (música 3) Abrir en la app de Spotify ----------
// spotify:playlist:ID abre la app sin pasar por el navegador (si no está instalada, se vuelve a la web)
export function uriSpotify(url) {
  const s = spotify(url);
  return s ? `spotify:${s.tipo}:${s.id}` : null;
}
