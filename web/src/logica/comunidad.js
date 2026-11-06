// La comunidad del equipo (v0.43): lo que no depende de la pantalla ni de la base.
import { textoVisible } from './texto.js';
import { diasEntre, lunesDe, sumarDias } from './fechas.js';
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
// v0.70: por equipos, el total de su equipo (totalEquipo; sin equipo, no)
export function retoConseguido(r, { hechas = 0, total = 0, desde = null, totalEquipo = null } = {}) {
  if (desde && r.hasta < desde) return false;
  if (r.modo === 'equipos') return totalEquipo != null && totalEquipo >= r.objetivo;
  return (r.modo === 'equipo' ? total : hechas) >= r.objetivo;
}

// ---------------------------------------------------------------- v0.69 (migración 041)
// Bienvenida a los nuevos: «nuevo» en su perfil 7 días desde que entró por primera vez; la tarjeta del muro, solo sus
// primeras 24 horas (v0.80, Pelayo: con varias altas seguidas ocupaban medio muro durante una semana)
export const DIAS_BIENVENIDA = 7;
export const HORAS_TARJETA_BIENVENIDA = 24;
// «Entrenando ahora»: una serie apuntada en los últimos 20 minutos de una sesión sin terminar (lo decide la base)
export const MINUTOS_ENTRENANDO = 20;
// Los que se ven en la tarjeta de bienvenida: de los demás, en sus primeras 24 horas, los más nuevos primero (la base
// los da de su primera semana, y la bienvenida se puede dar toda esa semana desde su perfil o su primera publicación)
export function nuevosParaBienvenida(filas = [], yo = null, ahora = Date.now()) {
  return (filas || []).filter((x) => x && x.perfil_id !== yo && Date.parse(x.desde) > ahora - HORAS_TARJETA_BIENVENIDA * 3600e3)
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

// ---------------------------------------------------------------- v0.70 (migración 042): constancia en compañía
// Compañeros de racha: hasta 3 (contando las invitaciones que has mandado)
export const MAX_COMPANEROS = 3;
// Qué cuenta un reto: [clave, nombre en el formulario]
export const MEDIDAS_RETO = [['sesiones', 'Sesiones'], ['cardio', 'Minutos de cardio'], ['semanas', 'Semanas completas']];
// Cómo se consigue: [clave, nombre]
export const MODOS_RETO = [['individual', 'Cada uno'], ['equipo', 'Entre todos'], ['equipos', 'Por equipos']];
// El objetivo más alto (como public.comunidad_reto_maximo de la 042)
export function retoMaximo(modo = 'individual', medida = 'sesiones') {
  if (!['individual', 'equipo', 'equipos'].includes(modo)) return 0;
  const uno = modo === 'individual';
  return { sesiones: uno ? 100 : 5000, cardio: uno ? 3000 : 30000, semanas: uno ? 52 : 1000 }[medida] || 0;
}
// «12 sesiones», «1 minuto de cardio», «4 semanas completas»
export function unidadReto(medida = 'sesiones', n = 2, { corta = false } = {}) {
  const uno = Number(n) === 1;
  if (medida === 'cardio') return corta ? (uno ? 'minuto' : 'minutos') : uno ? 'minuto de cardio' : 'minutos de cardio';
  if (medida === 'semanas') return corta ? (uno ? 'semana' : 'semanas') : uno ? 'semana completa' : 'semanas completas';
  return uno ? 'sesión' : 'sesiones';
}
// Los nombres de los equipos de entrada
export const EQUIPOS_DE_ENTRADA = ['Equipo rojo', 'Equipo azul'];
// Plantillas de un toque para el coach: rellenan el formulario (las fechas se pueden cambiar). con042: las que necesitan la 042
// (cardio, semanas completas o por equipos) solo salen con ella.
export const PLANTILLAS_RETO = [
  ['semana_perfecta', 'Semana perfecta'],
  ['tres_por_semana', '3 por semana durante el mes'],
  ['mil_entre_todos', '1.000 sesiones entre todos este mes'],
  ['cuatro_semanas', 'Semana completa 4 semanas seguidas'],
  ['cardio', 'Minutos de cardio'],
];
export function plantillaReto(clave, hoy) {
  const lunes = lunesDe(hoy);
  const [y, m] = hoy.split('-').map(Number);
  const inicioMes = `${y}-${String(m).padStart(2, '0')}-01`;
  const finMes = sumarDias(m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`, -1);
  const base = { descripcion: '', modo: 'individual', medida: 'sesiones', equipos: null };
  switch (clave) {
    case 'semana_perfecta': return { ...base, titulo: 'Semana perfecta', descripcion: 'Esta semana, todas tus sesiones hechas.', desde: lunes, hasta: sumarDias(lunes, 6), objetivo: 1, medida: 'semanas' };
    case 'tres_por_semana': return { ...base, titulo: '3 por semana durante el mes', descripcion: 'Tres sesiones cada semana durante cuatro semanas: 12 en total.', desde: lunes, hasta: sumarDias(lunes, 27), objetivo: 12 };
    case 'mil_entre_todos': return { ...base, titulo: '1.000 sesiones entre todos', descripcion: 'Sumamos las sesiones de todo el equipo este mes. Cada una cuenta.', desde: inicioMes, hasta: finMes, objetivo: 1000, modo: 'equipo' };
    case 'cuatro_semanas': return { ...base, titulo: 'Semana completa 4 semanas seguidas', descripcion: 'Cuatro semanas seguidas con todo lo que tienes publicado hecho.', desde: lunes, hasta: sumarDias(lunes, 27), objetivo: 4, medida: 'semanas' };
    case 'cardio': return { ...base, titulo: 'Minutos de cardio', descripcion: 'Entre todos, 1.000 minutos de cardio en cuatro semanas (de quien cuenta sus minutos).', desde: lunes, hasta: sumarDias(lunes, 27), objetivo: 1000, modo: 'equipo', medida: 'cardio' };
    default: return null;
  }
}
export const plantillaCon042 = (p) => !!p && (p.medida !== 'sesiones' || p.modo === 'equipos');
// Repartir en dos equipos igualados por las sesiones recientes: de más a menos, cada uno al equipo que suma menos (si suman
// igual, al que tiene menos gente). personas: [{ perfil_id, sesiones }]. Devuelve { a: [perfil_id], b: [perfil_id] }.
export function repartirEquipos(personas = []) {
  const orden = [...personas].sort((x, y) => (Number(y.sesiones) || 0) - (Number(x.sesiones) || 0) || String(x.nombre || '').localeCompare(String(y.nombre || ''), 'es'));
  const a = [], b = [];
  let sa = 0, sb = 0;
  for (const p of orden) {
    const n = Number(p.sesiones) || 0;
    if (sa < sb || (sa === sb && a.length <= b.length)) { a.push(p.perfil_id); sa += n; } else { b.push(p.perfil_id); sb += n; }
  }
  return { a, b };
}
// La racha de dos (como fbe_privado.comunidad_rachas_pareja de la 042): semanas en las que los dos han completado la suya,
// desde la semana de «desde». La semana sin nada publicado de uno no suma ni rompe; la de esta semana suma si los dos la tienen
// completa y, si no, no rompe. semanas: [{ lunes, previstas, hechas }] (solo las que tienen algo publicado). Con las mismas
// semanas dos veces, la racha de siempre. Devuelve { racha, mejor }.
export function rachaPareja(semanasA = [], semanasB = [], { lunesHoy, desde = null } = {}) {
  const desdeL = desde ? lunesDe(desde) : '0000-00-00';
  const porLunes = new Map();
  const poner = (lista, k) => {
    for (const s of lista) {
      if (!s?.lunes || !(s.previstas > 0) || s.lunes < desdeL || (lunesHoy && s.lunes > lunesHoy)) continue;
      const x = porLunes.get(s.lunes) || {};
      x[k] = s.hechas >= s.previstas;
      porLunes.set(s.lunes, x);
    }
  };
  poner(semanasA, 'a');
  poner(semanasB, 'b');
  let racha = 0, mejor = 0;
  for (const [l, x] of [...porLunes.entries()].sort((p, q) => (p[0] < q[0] ? -1 : 1))) {
    if (x.a === false || x.b === false) { if (!lunesHoy || l < lunesHoy) racha = 0; continue; }
    if (x.a && x.b) { racha++; mejor = Math.max(mejor, racha); }
  }
  return { racha, mejor };
}
// «Tú y Rubén M. · 🔥 4 semanas»
export const textoPareja = (nombre, racha = 0) => `Tú y ${nombre}${racha > 0 ? ` · 🔥 ${racha} ${racha === 1 ? 'semana' : 'semanas'}` : ''}`;
// Las insignias del equipo: [clave, emoji, nombre, cómo se consigue, meta] (las calcula la base: comunidad_insignias, 042)
export const INSIGNIAS = [
  ['primera_publicacion', '✍️', 'Primera publicación', 'Publica algo en el muro', 1],
  ['animos_10', '🙌', '10 ánimos', 'Manda 10 ánimos a los del equipo', 10],
  ['reacciones_25', '💪', '25 reacciones', 'Reacciona 25 veces a lo del equipo', 25],
  ['retos_5', '🏆', '5 retos', 'Consigue 5 retos', 5],
  ['racha_4', '🔥', 'Racha de 4', 'Completa 4 semanas seguidas', 4],
  ['pareja_4', '🤝', 'Pareja de 4', 'Llega a 4 semanas seguidas con un compañero de racha', 4],
];
// Las de alguien, en el orden de INSIGNIAS: [{ clave, emoji, nombre, como, meta, valor, conseguida }]. filas: lo que da la base
// ([{ clave, valor, meta }]); las que no vienen, sin progreso.
export function insigniasDe(filas = []) {
  const por = new Map((filas || []).map((f) => [f.clave, f]));
  return INSIGNIAS.map(([clave, emoji, nombre, como, meta]) => {
    const valor = Math.min(meta, Math.max(0, Number(por.get(clave)?.valor) || 0));
    return { clave, emoji, nombre, como, meta, valor, conseguida: valor >= meta };
  });
}
// La siguiente que puede conseguir: la que tiene más hecho (en proporción) de las que le faltan; si las tiene todas, null
export function siguienteInsignia(lista = []) {
  const faltan = lista.filter((x) => !x.conseguida);
  if (!faltan.length) return null;
  return [...faltan].sort((a, b) => b.valor / b.meta - a.valor / a.meta)[0];
}

// ---------------------------------------------------------------- v0.71 (migración 043): conversación útil
// Los temas del muro (como public.comunidad_tema_valido): [clave, nombre]. «Avisos» es solo del coach y «Pregunta para el
// coach», solo de los atletas.
export const TEMAS = [['charla', 'Charla'], ['tecnica', 'Técnica'], ['logros', 'Logros'], ['pregunta', 'Pregunta para el coach'], ['avisos', 'Avisos']];
export const nombreTema = (k) => TEMAS.find(([t]) => t === k)?.[1] || null;
export const temasPara = (coach) => (coach ? ['avisos', 'tecnica', 'logros', 'charla'] : ['charla', 'tecnica', 'logros', 'pregunta']).map((k) => [k, nombreTema(k)]);
export const temaPorDefecto = (coach) => (coach ? 'avisos' : 'charla');
// El tema que pone la base (comunidad_post_tema, 043): el de entrada si no vale para quien publica
export function temaAlPublicar(tipo, tema, coach) {
  if (tipo === 'entreno') return null;
  if (tipo === 'logro') return 'logros';
  if (tipo === 'encuesta') return 'avisos';
  const validos = temasPara(coach).map(([k]) => k);
  return validos.includes(tema) ? tema : temaPorDefecto(coach);
}
// Los filtros del muro con la 043: los de antes y los temas, lo guardado y lo mío
export const FILTROS_MURO_043 = [['todo', 'Todo'], ['entrenos', 'Entrenos'], ['logros', 'Logros'], ['tecnica', 'Técnica'], ['charla', 'Charla'],
  ['preguntas', 'Preguntas'], ['avisos', 'Avisos'], ['guardados', 'Guardados'], ['mio', 'Lo mío']];
// Varias fotos por publicación (con la 043): hasta 4. Las de una publicación (las de antes, la única que tenían)
export const MAX_FOTOS = 4;
export const fotosDe = (post) => (Array.isArray(post?.fotos) && post.fotos.length ? post.fotos : post?.foto_ruta ? [post.foto_ruta] : []);
// Buscar en el muro: de 2 a 100 letras (como comunidad_buscar)
export const busquedaValida = (t) => { const v = String(t || '').trim(); return v.length >= 2 && v.length <= 100; };
// La mejor respuesta: la eligen quien publicó o el coach, de un comentario de otra persona (como comunidad_mejor_respuesta)
export const puedeElegirMejor = ({ post, comentario, coach = false, yo = null }) =>
  !!post && !!comentario && !comentario.oculto && (coach || post.autor_id === yo) && comentario.autor_id !== post.autor_id;
// Cómo se llama: en una pregunta, la del coach es la «Respuesta del coach»
export const etiquetaMejor = (post, comentario) => (post?.tema === 'pregunta' && comentario?.autor?.coach ? 'Respuesta del coach' : 'Mejor respuesta');
// Los hilos de comentarios con el de la mejor respuesta primero (si es una respuesta, su hilo entero)
export function mejorPrimero(hilos = [], mejorId = null) {
  if (!mejorId) return hilos;
  const i = hilos.findIndex((c) => c.id === mejorId || (c.respuestas || []).some((r) => r.id === mejorId));
  return i <= 0 ? hilos : [hilos[i], ...hilos.slice(0, i), ...hilos.slice(i + 1)];
}

// ---------------------------------------------------------------- v0.72 (migración 044): para ti como coach
// Eventos y quedadas (como public.comunidad_evento_valido): título hasta 80, sitio o enlace hasta 300, descripción hasta 1000 y
// plazas de 1 a 500 (opcional)
export const MAX_TITULO_EVENTO = 80;
export const MAX_LUGAR_EVENTO = 300;
export const MAX_DESCRIPCION_EVENTO = 1000;
export const MAX_PLAZAS_EVENTO = 500;
export function eventoValido({ titulo, lugar, descripcion = null, plazas = null } = {}) {
  const t = String(titulo ?? '').trim(), l = String(lugar ?? '').trim(), d = String(descripcion ?? '').trim();
  if (!t || t.length > MAX_TITULO_EVENTO || !textoVisible(t)) return `El título, de 1 a ${MAX_TITULO_EVENTO} letras`;
  if (!l || l.length > MAX_LUGAR_EVENTO || !textoVisible(l)) return 'Pon el sitio o el enlace';
  if (d.length > MAX_DESCRIPCION_EVENTO) return `La descripción, hasta ${MAX_DESCRIPCION_EVENTO} letras`;
  if (plazas != null && plazas !== '' && !(Number.isInteger(Number(plazas)) && Number(plazas) >= 1 && Number(plazas) <= MAX_PLAZAS_EVENTO)) return `Las plazas, de 1 a ${MAX_PLAZAS_EVENTO} (o sin límite)`;
  return null;
}
// En qué está: cancelado, pasado (ya ha empezado) o próximo
export const estadoEvento = (e, ahora = Date.now()) => (e?.cancelado_en ? 'cancelado' : Date.parse(e?.empieza_en) <= ahora ? 'pasado' : 'proximo');
// Los próximos (no cancelados y sin empezar), del más cercano al más lejano
export const eventosProximos = (lista = [], ahora = Date.now()) =>
  lista.filter((e) => estadoEvento(e, ahora) === 'proximo').sort((a, b) => Date.parse(a.empieza_en) - Date.parse(b.empieza_en));
// Plazas libres (null: sin límite)
export const plazasLibres = (e) => (e?.plazas == null ? null : Math.max(0, Number(e.plazas) - (e.van?.length ?? e.nVan ?? 0)));
// En el muro, cada evento como una tarjeta más, en su sitio por la fecha en que se creó: los de la última semana o por llegar, solo
// entre lo que ya se ve (si hay más páginas, los más antiguos esperan a «Ver más»)
export function mezclarEventos(posts = [], eventos = [], { hayMas = false, ahora = Date.now() } = {}) {
  const fijadas = posts.filter((p) => p.fijada);
  const resto = posts.filter((p) => !p.fijada);
  const desde = hayMas && resto.length ? resto.at(-1).creado_en : '';
  const ev = eventos.filter((e) => Date.parse(e.empieza_en) > ahora - 7 * 864e5 && e.creado_en >= desde).map((e) => ({ ...e, esEvento: true }));
  const mezcla = [...resto, ...ev].sort((a, b) => (a.creado_en < b.creado_en ? 1 : a.creado_en > b.creado_en ? -1 : 0));
  return [...fijadas, ...mezcla];
}
// El .ics de un evento (con el día y la hora de Madrid, el sitio y un aviso 2 h antes)
export function datosICSEvento(e, partes) {
  const p = partes(e.empieza_en);
  return { id: `evento-${e.id}`, dia: p.fecha, hora: p.hora, minutos: 90, titulo: e.titulo, descripcion: [e.descripcion, e.lugar].filter(Boolean).join('\n\n'),
    lugar: e.lugar, aviso: `En 2 horas: ${e.titulo}`, avisoMin: 120 };
}

// Avisos programados y plantillas (como la 044): como mucho a 90 días; 30 plantillas
export const MAX_PLANTILLAS = 30;
export const programadoValido = (iso, ahora = Date.now()) => !!iso && Date.parse(iso) > ahora + 30000 && Date.parse(iso) <= ahora + 90 * 864e5;

// El atleta de la semana: una línea de hasta 140 letras, 7 días
export const MAX_MOTIVO_DESTACADO = 140;
export const DIAS_DESTACADO = 7;
export const textoDestacado = (nombre, motivo) => `Atleta de la semana: ${nombre}${String(motivo || '').trim() ? ` · ${String(motivo).trim()}` : ''}`;
export const destacadoActivo = (lista = [], ahora = Date.now()) => lista.find((d) => Date.parse(d.desde) <= ahora && Date.parse(d.hasta) > ahora) || null;

// Moderación: silenciar 24 h o 7 días; el modo lento (minutos); las palabras filtradas, como las guarda la base
export const SILENCIOS = [[24, '24 h'], [168, '7 días']];
export const MODOS_LENTO = [[0, 'Apagado'], [5, '5 min'], [10, '10 min'], [30, '30 min'], [60, '1 hora']];
export const MAX_PALABRAS = 100;
export const silenciadoHasta = (miembro, ahora = Date.now()) => (miembro?.silenciado_hasta && Date.parse(miembro.silenciado_hasta) > ahora ? miembro.silenciado_hasta : null);
// Como fbe_privado.comunidad_normal: minúsculas, sin tildes y solo letras y cifras, separadas por un espacio
// (las letras con tilde, escritas como \u: el empaquetado tiene que quedar en ASCII puro, también dentro de una expresión regular)
const CON_TILDE = '\u00e1\u00e0\u00e4\u00e2\u00e9\u00e8\u00eb\u00ea\u00ed\u00ec\u00ef\u00ee\u00f3\u00f2\u00f6\u00f4\u00fa\u00f9\u00fc\u00fb\u00e7';
const SIN_TILDE = 'aaaaeeeeiiiioooouuuuc';
export const normalPalabra = (t) => [...String(t ?? '').toLowerCase()].map((c) => { const i = CON_TILDE.indexOf(c); return i >= 0 ? SIN_TILDE[i] : c; }).join('')
  .replace(/[^a-z0-9\u00f1]+/g, ' ').trim();
// Lo escrito por el coach (una por línea o separadas por comas) → la lista que guarda la base (sin repetir, en orden)
export const palabrasDeTexto = (texto) => [...new Set(String(texto ?? '').split(/[\n,;]+/).map(normalPalabra).filter((w) => w.length >= 2 && w.length <= 40))].sort();
// ¿Lleva alguna? (palabras enteras: «tonto» no salta con «tontería»)
export function textoFiltrado(texto, palabras = []) {
  if (!palabras?.length || texto == null) return false;
  const t = ` ${normalPalabra(texto)} `;
  return palabras.some((w) => w && t.includes(` ${w} `));
}
