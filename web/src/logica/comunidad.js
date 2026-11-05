// La comunidad del equipo (v0.43): lo que no depende de la pantalla ni de la base.
import { textoVisible } from './texto.js';
import { diasEntre } from './fechas.js';
import { e1rm } from './calculos.js';

// [clave en la base, emoji, nombre]
export const REACCIONES = [['fuerza', '💪', 'Fuerza'], ['fuego', '🔥', 'Fuego'], ['aplauso', '👏', 'Aplauso']];
export const MAX_POST = 2000;
export const MAX_COMENTARIO = 1000;
export const MAX_MOTIVO = 300;

// El nombre que sale en el equipo de entrada: el nombre y la inicial del apellido («Ana López» → «Ana L.»)
export function nombreEquipo(nombre) {
  const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '';
  const n = partes[0].slice(0, 30);
  return partes.length > 1 ? `${n} ${partes[1][0].toUpperCase()}.` : n;
}
// Lo mismo que la base: espacios juntos, de 2 a 40 letras y con algo visible
export const limpiarNombre = (t) => String(t || '').replace(/[\s\u0000-\u001f\u007f]+/g, ' ').trim();
export const nombreValido = (t) => { const v = limpiarNombre(t); return v.length >= 2 && v.length <= 40 && textoVisible(v); };

// Un reto: en marcha, por empezar o terminado (sus fechas incluidas)
export function estadoReto(r, hoy) {
  if (hoy < r.desde) return 'proximo';
  if (hoy > r.hasta) return 'terminado';
  return 'en_marcha';
}
export function textoReto(r, hoy) {
  const e = estadoReto(r, hoy);
  if (e === 'proximo') { const d = diasEntre(hoy, r.desde); return d === 1 ? 'Empieza mañana' : `Empieza en ${d} días`; }
  if (e === 'terminado') return 'Terminado';
  const d = diasEntre(hoy, r.hasta);
  return d === 0 ? 'Último día' : d === 1 ? 'Queda 1 día' : `Quedan ${d} días`;
}

// El ranking de constancia: primero quien lleva más de lo previsto (en proporción), luego quien lleva más sesiones
export function ordenarRanking(filas) {
  return [...filas].sort((a, b) => (b.hechas / (b.previstas || 1)) - (a.hechas / (a.previstas || 1)) || b.hechas - a.hechas || String(a.nombre).localeCompare(String(b.nombre), 'es'));
}

// «Rubén M., Carlos V. y 2 más»
export function quienes(nombres, max = 2) {
  if (!nombres.length) return '';
  if (nombres.length <= max) return nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`;
  return `${nombres.slice(0, max).join(', ')} y ${nombres.length - max} más`;
}

// Los récords de una sesión, como los decide la base al compartirla (comunidad_compartir_sesion): en cada
// ejercicio, el mejor 1RM estimado de esa sesión supera al mejor de antes de empezarla; en uno sin carga, más
// repeticiones que nunca. series: el historial del atleta ({ sesion_id, ejercicio_id, kg, reps, rpe, rir,
// registrada_en }). Devuelve los ejercicio_id con récord.
export function recordsDeEquipo(series, sesionId) {
  const conReps = series.filter((s) => Number(s.reps) > 0);
  const hoy = conReps.filter((s) => s.sesion_id === sesionId);
  const inicio = series.filter((s) => s.sesion_id === sesionId).map((s) => s.registrada_en).filter(Boolean).sort()[0] || '9999';
  const antes = conReps.filter((s) => s.sesion_id !== sesionId && s.registrada_en && s.registrada_en < inicio);
  const maxE = (l) => l.reduce((m, s) => { const v = e1rm({ kg: s.kg, reps: s.reps, rpe: s.rpe ?? null, rir: s.rir ?? null }); return v != null && (m == null || v > m) ? v : m; }, null);
  const maxR = (l) => l.filter((s) => !(Number(s.kg) > 0)).reduce((m, s) => (m == null || Number(s.reps) > m ? Number(s.reps) : m), null);
  const out = new Set();
  for (const id of new Set(hoy.map((s) => s.ejercicio_id))) {
    const h = hoy.filter((s) => s.ejercicio_id === id), a = antes.filter((s) => s.ejercicio_id === id);
    const eh = maxE(h), ea = maxE(a);
    if ((eh != null && ea != null && eh > ea) || (!h.some((s) => Number(s.kg) > 0) && maxR(a) != null && maxR(h) > maxR(a))) out.add(id);
  }
  return out;
}

// ---------------------------------------------------------------- v0.47
export const MAX_MENCIONES = 5;
export const MAX_PREGUNTA = 300;
export const MAX_OPCION = 80;
export const ANIMOS_AL_DIA = 40;
export const RETO_MAX = { individual: 100, equipo: 5000 };
// Los filtros del muro: [clave, texto]
export const FILTROS_MURO = [['todo', 'Todo'], ['entrenos', 'Entrenos'], ['logros', 'Logros'], ['avisos', 'Avisos'], ['mio', 'Lo mío']];

const DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g'); // (en un texto: el empaquetado deja ASCII puro)
const sinTildes = (t) => String(t || '').toLowerCase().normalize('NFD').replace(DIACRITICOS, '');

// El podio y el ranking: la posición de cada fila (ya ordenada con ordenarRanking), con los empates en la misma
// posición (1, 1, 3): mismo porcentaje y mismas sesiones
export function posicionesRanking(filas) {
  const pos = [];
  filas.forEach((x, i) => {
    const a = filas[i - 1];
    const igual = a && a.hechas / (a.previstas || 1) === x.hechas / (x.previstas || 1) && a.hechas === x.hechas;
    pos.push(igual ? pos[i - 1] : i + 1);
  });
  return pos;
}
export const MEDALLAS = { 1: ['🥇', 'Primer puesto'], 2: ['🥈', 'Segundo puesto'], 3: ['🥉', 'Tercer puesto'] };

// «🔥 3 semanas»
export const textoRacha = (n) => (n === 1 ? '1 semana seguida' : `${n} semanas seguidas`);

// La mención que se está escribiendo justo antes del cursor («… @Rub» → { inicio, consulta: 'Rub' }), o null
export function mencionEnCurso(texto, cursor = String(texto || '').length) {
  const antes = String(texto || '').slice(0, cursor);
  const m = antes.match(/(^|\s)@([^\s@]{0,30}(?: [^\s@]{0,3})?)$/u);
  if (!m) return null;
  return { inicio: antes.length - m[2].length - 1, consulta: m[2] };
}
// Las personas que encajan con lo escrito tras «@» (por el principio de su nombre o de cualquier palabra), sin uno
// mismo; como mucho 5. personas: [{ perfil_id, nombre, foto, coach }]
export function sugerenciasMencion(consulta, personas, yo = null, max = 5) {
  const q = sinTildes(consulta).trim();
  return personas.filter((p) => p.perfil_id !== yo).filter((p) => {
    const n = sinTildes(p.nombre);
    return !q || n.startsWith(q) || n.split(/\s+/).some((w) => w.startsWith(q));
  }).sort((a, b) => Number(!!b.coach) - Number(!!a.coach) || String(a.nombre).localeCompare(String(b.nombre), 'es')).slice(0, max);
}
// Pone «@Nombre » en lugar de lo que se estaba escribiendo. Devuelve { texto, cursor }
export function insertarMencion(texto, en, nombre) {
  const t = String(texto || '');
  const fin = en.inicio + 1 + en.consulta.length;
  const nuevo = `${t.slice(0, en.inicio)}@${nombre} ${t.slice(fin).replace(/^ /, '')}`;
  return { texto: nuevo, cursor: en.inicio + nombre.length + 2 };
}
// Las menciones que siguen en el texto (si se borró «@Nombre», ya no va), sin repetir y como mucho 5
export function mencionesDeTexto(texto, elegidas) {
  const t = String(texto || '');
  const ids = [];
  for (const p of elegidas) if (t.includes(`@${p.nombre}`) && !ids.includes(p.perfil_id)) ids.push(p.perfil_id);
  return ids.slice(0, MAX_MENCIONES);
}
// El texto en trozos, con «@Nombre» marcado solo para quien está mencionado de verdad (mencionados: [{ perfil_id,
// nombre }]); los nombres largos primero (que «@Ana L.» gane a «@Ana»)
export function trozosConMenciones(texto, mencionados = []) {
  const t = String(texto || '');
  const lista = mencionados.filter((p) => p?.nombre).sort((a, b) => b.nombre.length - a.nombre.length);
  if (!lista.length) return [{ texto: t }];
  const out = [];
  let i = 0, desde = 0;
  while (i < t.length) {
    const p = t[i] === '@' && lista.find((x) => t.startsWith(`@${x.nombre}`, i));
    if (p) {
      if (i > desde) out.push({ texto: t.slice(desde, i) });
      out.push({ texto: `@${p.nombre}`, perfil_id: p.perfil_id });
      i += p.nombre.length + 1;
      desde = i;
    } else i++;
  }
  if (desde < t.length) out.push({ texto: t.slice(desde) });
  return out;
}

// Una encuesta: ¿cerrada? (con su cierre ya pasado)
export const encuestaCerrada = (encuesta, ahora = Date.now()) => !!encuesta?.cierre && Date.parse(encuesta.cierre) <= ahora;
// Los resultados de una encuesta a partir de los votos que se ven ([{ autor_id, opcion }]): cuántos y qué % cada
// opción (que sumen 100), el mío, el total y quién ha votado cada una (nombres)
export function resultadosEncuesta(encuesta, votos = [], yo = null, nombreDe = () => 'Alguien del equipo') {
  const n = encuesta?.opciones?.length || 0;
  const conteos = Array.from({ length: n }, () => 0);
  const quien = Array.from({ length: n }, () => []);
  for (const v of votos) if (v.opcion >= 0 && v.opcion < n) { conteos[v.opcion]++; quien[v.opcion].push(nombreDe(v.autor_id)); }
  const total = conteos.reduce((a, b) => a + b, 0);
  // Porcentajes enteros que suman 100 (el resto, a los de mayor decimal)
  const crudos = conteos.map((c) => (total ? (c * 100) / total : 0));
  const pct = crudos.map(Math.floor);
  let resto = total ? 100 - pct.reduce((a, b) => a + b, 0) : 0;
  for (const i of crudos.map((c, k) => [c - Math.floor(c), k]).sort((a, b) => b[0] - a[0]).map(([, k]) => k)) { if (resto <= 0) break; pct[i]++; resto--; }
  const mio = votos.find((v) => v.autor_id === yo);
  return { conteos, porcentajes: pct, total, miVoto: mio ? mio.opcion : null, quien };
}
// Lo que se manda a la base al crear una encuesta (o el problema que tiene)
export function limpiarEncuesta({ pregunta, opciones, cierre = null }, ahora = Date.now()) {
  const p = String(pregunta || '').trim();
  const ops = (opciones || []).map((o) => String(o || '').trim()).filter(Boolean);
  if (!p || p.length > MAX_PREGUNTA || !textoVisible(p)) return { error: `La pregunta, de 1 a ${MAX_PREGUNTA} letras.` };
  if (ops.length < 2 || ops.length > 4) return { error: 'Pon de 2 a 4 opciones.' };
  if (ops.some((o) => o.length > MAX_OPCION || !textoVisible(o))) return { error: `Cada opción, hasta ${MAX_OPCION} letras.` };
  if (new Set(ops.map((o) => o.toLowerCase())).size !== ops.length) return { error: 'Hay dos opciones iguales.' };
  let c = null;
  if (cierre) {
    const t = Date.parse(cierre);
    if (!Number.isFinite(t)) return { error: 'El cierre no es una fecha válida.' };
    if (t <= ahora + 5 * 60000) return { error: 'El cierre, más adelante (o sin cierre).' };
    c = new Date(t).toISOString();
  }
  return { pregunta: p, encuesta: { opciones: ops, cierre: c } };
}

// ¿Ha conseguido el reto? Como la base (comunidad_reto_conseguido): individual, su objetivo; de equipo, el total
// del equipo; y no cuenta uno que ya había acabado cuando entró por primera vez (desde: su fecha de entrada).
export function retoConseguido(r, { hechas = 0, total = 0, desde = null } = {}) {
  if (desde && r.hasta < desde) return false;
  return (r.modo === 'equipo' ? total : hechas) >= r.objetivo;
}

// ---------------------------------------------------------------- v0.69 (migración 041)
// Bienvenida a los nuevos: la tarjeta sale 7 días desde que entró por primera vez
export const DIAS_BIENVENIDA = 7;
// «Entrenando ahora»: una serie apuntada en los últimos 20 minutos de una sesión sin terminar (lo decide la base)
export const MINUTOS_ENTRENANDO = 20;
// Los que se ven en la tarjeta de bienvenida: de los demás, en su primera semana, los más nuevos primero (como la base)
export function nuevosParaBienvenida(filas = [], yo = null, ahora = Date.now()) {
  return (filas || []).filter((x) => x && x.perfil_id !== yo && Date.parse(x.desde) > ahora - DIAS_BIENVENIDA * 864e5)
    .sort((a, b) => Date.parse(b.desde) - Date.parse(a.desde));
}
// El resumen del domingo (como public.comunidad_texto_resumen de la 041): sin sesiones, nada
export function textoResumenDomingo({ sesiones = 0, records = 0, semana_completa = 0 } = {}) {
  const s = Number(sesiones) || 0, r = Number(records) || 0, c = Number(semana_completa) || 0;
  if (s < 1) return null;
  return {
    titulo: `Esta semana en el equipo: ${s} ${s === 1 ? 'sesión' : 'sesiones'}${r > 0 ? `, ${r} ${r === 1 ? 'récord' : 'récords'}` : ''}`,
    cuerpo: `${c > 0 ? `${c} con la semana completa. ` : ''}Míralo en Equipo.`,
  };
}
// Los comentarios con sus respuestas debajo (un nivel). Una respuesta cuyo comentario ya no se ve (borrado u oculto) sale
// suelta, en su sitio. Devuelve [{ ...comentario, respuestas: [...] }] en orden.
export function hilosComentarios(lista = []) {
  const ids = new Set(lista.map((c) => c.id));
  const raiz = [];
  const por = new Map();
  for (const c of lista) {
    if (c.responde_a && ids.has(c.responde_a)) continue;
    const x = { ...c, respuestas: [] };
    por.set(c.id, x);
    raiz.push(x);
  }
  for (const c of lista) {
    if (!c.responde_a || !ids.has(c.responde_a)) continue;
    const padre = por.get(c.responde_a) || por.get(lista.find((y) => y.id === c.responde_a)?.responde_a);
    if (padre) padre.respuestas.push({ ...c, respuestas: [] });
    else raiz.push({ ...c, respuestas: [] });
  }
  return raiz;
}
