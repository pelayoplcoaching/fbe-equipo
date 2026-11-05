// Cálculos de las piezas visuales de la v0.50 (sin pantalla, para poder probarlos): qué tarjeta sale arriba en Hoy
// según cómo va el día, el patrón de movimiento de cada ejercicio (para su pictograma), lo que dura y trabaja cada
// sesión de la semana, la evolución de los récords de un ejercicio, la bandeja del coach por atletas y las cifras
// de un día de nutrición.
import { queToca, diaPrevistoValido } from './plan.js';
import { sumarDias, diasEntre, hoyISO } from './fechas.js';
import { duracionEstimada, eventosRecord, e1rm } from './calculos.js';
import { normal as sinTildes } from './busqueda.js';

// ---------- Hoy: la tarjeta de arriba ----------
// tipo:
//  · 'sin_semana': aún no hay bloque o semana publicada (espera a tu coach)
//  · 'semana': todas las sesiones de la semana hechas
//  · 'hecha': ya ha hecho una sesión hoy y no tiene otra prevista para hoy (celebración y lo siguiente)
//  · 'descanso': con plan, hoy no toca nada y queda algo para otro día (o una semana sin sesiones)
//  · 'entreno': lo de siempre, la sesión que toca
// Lo previsto para hoy manda sobre lo ya hecho: con dos sesiones previstas el mismo día, la segunda sigue tocando.
export function estadoHoy({ bloque = null, semana = null, sesiones = [], hoy = hoyISO() } = {}) {
  if (!bloque || !semana) return { tipo: 'sin_semana', hechas: 0, total: 0, hechaHoy: null, siguiente: null, proxima: null };
  const lista = sesiones || [];
  const total = lista.length;
  const hechas = lista.filter((s) => s.completada);
  const deHoy = hechas.filter((s) => s.fecha_realizada === hoy);
  const toca = queToca(lista, semana, hoy);
  const enSemana = !!semana.fecha_inicio && semana.fecha_inicio <= hoy && hoy <= sumarDias(semana.fecha_inicio, 6);
  const base = { hechas: hechas.length, total, hechaHoy: deHoy[deHoy.length - 1] || null, enSemana, toca };
  // Lo que viene: la siguiente prevista (con su día) o, sin plan, la primera pendiente
  const proxima = toca.proxima || (toca.siguiente ? { sesion: toca.siguiente, dia: null } : null);
  if (total > 0 && hechas.length === total) return { ...base, tipo: 'semana', siguiente: null, proxima: null };
  if (!total) return { ...base, tipo: 'descanso', siguiente: null, proxima: null };
  // Hecha hoy: lo siguiente es lo que se quedó atrás (si hay algo previsto para un día que ya pasó), antes que lo que viene
  if (deHoy.length && !toca.hoy) {
    const atrasada = toca.atrasadas[0];
    return { ...base, tipo: 'hecha', siguiente: toca.siguiente, proxima: atrasada ? { sesion: atrasada, dia: diaPrevistoValido(atrasada, semana), atrasada: true } : proxima };
  }
  if (enSemana && toca.descanso) return { ...base, tipo: 'descanso', siguiente: toca.siguiente, proxima: toca.proxima };
  return { ...base, tipo: 'entreno', siguiente: toca.siguiente, proxima };
}

// Una idea para el día de descanso (cambia cada día, la misma todo el día): moverse un poco, movilidad, dormir y comer
export const SUGERENCIAS_DESCANSO = [
  { id: 'pasos', icono: 'pasos', titulo: 'Camina un rato', texto: 'Un paseo de 30 a 40 minutos (unos 6.000 a 8.000 pasos) te ayuda a recuperar sin cansarte.' },
  { id: 'movilidad', icono: 'movilidad', titulo: '10 minutos de movilidad', texto: 'Cadera, tobillos y espalda alta, suave y sin llegar a molestia.' },
  { id: 'sueno', icono: 'sueno', titulo: 'Duerme bien esta noche', texto: 'Entre 7 y 9 horas: mientras duermes se asienta lo que entrenaste.' },
  { id: 'proteina', icono: 'proteina', titulo: 'La proteína, también hoy', texto: 'Reparte la de tu plan en 3 o 4 comidas, aunque no entrenes.' },
];
export function sugerenciaDescanso(hoy = hoyISO()) {
  const n = SUGERENCIAS_DESCANSO.length;
  const d = diasEntre('2026-01-05', hoy);
  return SUGERENCIAS_DESCANSO[((d % n) + n) % n];
}

// ---------- pictogramas: el patrón de movimiento de un ejercicio ----------
export const PATRONES = [
  ['empuje_h', 'Empuje horizontal'], ['empuje_v', 'Empuje vertical'], ['tiron_h', 'Tirón horizontal'], ['tiron_v', 'Tirón vertical'],
  ['sentadilla', 'Sentadilla'], ['bisagra', 'Bisagra de cadera'], ['unilateral', 'Zancada o unilateral'], ['brazo', 'Aislamiento de brazo'],
  ['pierna', 'Aislamiento de pierna'], ['core', 'Core'], ['cardio', 'Cardio'], ['otro', 'Otro'],
];
export const NOMBRE_PATRON = Object.fromEntries(PATRONES);

// Por el nombre (sin tildes ni mayúsculas), en orden: lo más concreto antes («curl femoral» es de pierna aunque sea
// un curl; «remo ergómetro» es cardio aunque sea un remo; «press pallof» es core aunque sea un press)
const REGLAS = [
  ['cardio', /\b(ergometro|remoergometro|concept ?2|eliptica|cinta de correr|cinta inclinada|(?:andar|caminar|correr) en (?:la )?cinta|correr|carrera|trote|rodaje|bici(cleta)?|spinning|assault|air ?bike|comba|saltos? a la comba|natacion|nadar|caminar|caminata|sprints?|burpees?|hiit|ski ?erg|escaladora|stepper)\b/],
  ['core', /\b(plancha|planks?|leg raises?|crunch|encogimientos? abdominal(es)?|abdominal(es)?|rueda abdominal|ab ?wheel|pallof|dead ?bug|bicho muerto|hollow|rotaciones?|russian twist|lenador|woodchop|elevaci(on|ones) de piernas|toes? to bar|dragon flag|bird ?dog|farmer|paseo del granjero|suitcase|l-?sit|v-?ups?)\b/],
  ['pierna', /\b(leg curl|leg extensions?|curl femoral|curl de femoral|curl nordico|nordic|isquios? en maquina|extension(es)? de (cuadriceps|rodilla|piernas?)|extension(es)? de cuadriceps|sillon de cuadriceps|gemelos?|talones|elevaci(on|ones) de talones|soleo|aductor(es)?|abductor(es)?|patada de gluteo|kickbacks? de gluteo|abduccion(es)?|aduccion(es)?)\b/],
  ['brazo', /\b(curl|biceps|triceps|press frances|frances|rompecraneos|skull ?crushers?|martillo|pushdowns?|jalon de triceps|extension(es)? de triceps|patada de triceps|elevaci(on|ones) laterales?|elevaci(on|ones) frontales?|laterales|antebrazos?|munecas?|wrist|y-?raises?)\b/],
  ['unilateral', /\b(zancadas?|lunges?|bulgaras?|split ?squat|sentadilla dividida|step[- ]?ups?|subidas? al (cajon|banco)|pistol|cossack|sentadilla lateral)\b/],
  ['bisagra', /\b(peso muerto|rumano|rdl|hip ?thrust|empuje de cadera|puente de gluteo|puentes? de gluteos?|buenos dias|good ?mornings?|swings?|hiperextensi(on|ones)|hyperextensions?|extensiones? en banco (inclinado )?45|extensi(on|ones) lumbar(es)?|pull[- ]?through|deadlift)\b/],
  ['sentadilla', /\b(sentadillas?|squat|prensa|hack|belt squat|goblet|leg press|pendulo|jaca)\b/],
  ['tiron_v', /\b(remo al menton|dominadas?|chin-?ups?|pull-?ups?|jalon(es)?|lat ?pulldown|pull[- ]?over|encogimientos?( de hombros)?|shrugs?)\b/],
  ['tiron_h', /\b(remos?|rows?|face ?pulls?|pajaros?|pajaro|reverse fly|reversos?|contractora invertida|delt\.? post(erior)?|apertura(s)? invertidas?|inverted row|seal row|meadows|pendlay|yates)\b/],
  ['empuje_v', /\b(press militar|militar|press de hombros?|press hombros?|press arnold|arnold|overhead|ohp|push press|press por encima|landmine press|shoulder press|press vertical|pike)\b/],
  ['empuje_h', /\b(press (de )?banca|banca|press plano|press inclinado|press declinado|inclinado|declinado|flexiones|push-?ups?|fondos|dips?|aperturas?|cruces? de poleas|cruce|pec-?(fly|deck)|contractor|chest press|press de pecho|press en maquina|press plano)\b/],
];
const PIERNA = ['cuadriceps', 'isquiotibiales', 'gluteo', 'gemelo'];
const BRAZO = ['biceps', 'triceps', 'deltoides'];

// nombre: el del ejercicio; grupos: sus grupos musculares (el primero, el principal); tipo: básico, multiarticular,
// aislamiento (de la biblioteca), si los hay
export function patronEjercicio(nombre = '', grupos = [], tipo = []) {
  const t = ` ${sinTildes(nombre || '')} `.replace(/[()/,.;:]+/g, ' ').replace(/\s+/g, ' ');
  for (const [p, re] of REGLAS) if (re.test(t)) return p;
  const g = (Array.isArray(grupos) ? grupos : []).filter(Boolean);
  const tipos = Array.isArray(tipo) ? tipo : tipo ? [tipo] : [];
  const principal = g[0];
  if (!principal) return 'otro';
  if (tipos.includes('aislamiento')) {
    if (PIERNA.includes(principal)) return 'pierna';
    if (BRAZO.includes(principal)) return 'brazo';
  }
  return {
    pectoral: 'empuje_h', deltoides: 'empuje_v', espalda: 'tiron_h', cuadriceps: 'sentadilla', gluteo: 'bisagra', isquiotibiales: 'bisagra',
    biceps: 'brazo', triceps: 'brazo', abdominales: 'core', gemelo: 'pierna',
  }[principal] || 'otro';
}

// ---------- Semana: lo que dura y lo que trabaja cada sesión ----------
// pautas: los ejercicios pautados de una sesión ({ series, descanso_seg, superserie, ejercicio: { grupos_musculares } }).
// minutos: cada serie, unos 40 s de trabajo más su descanso (90 s si no lo pone), en una superserie el descanso al
// acabar la ronda; redondeado a 5 min (como en Hoy). grupos: los músculos que más series se llevan (el principal de
// cada ejercicio cuenta 1 por serie y los secundarios, media), como mucho n; patrones: los de sus ejercicios.
export function resumenPautas(pautas = [], n = 3) {
  const lista = (pautas || []).filter((e) => e && Number(e.series) > 0);
  const peso = {};
  for (const e of lista) {
    const gs = e.ejercicio?.grupos_musculares || e.grupos_musculares || [];
    gs.forEach((g, i) => { peso[g] = (peso[g] || 0) + Number(e.series) * (i === 0 ? 1 : 0.5); });
  }
  const grupos = Object.entries(peso).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, n).map(([g]) => g);
  // Los patrones de movimiento de la sesión, en su orden y sin repetir (para sus pictogramas), como mucho 4
  const patrones = [...new Set(lista.map((e) => patronEjercicio(e.ejercicio?.nombre || e.nombre || '', e.ejercicio?.grupos_musculares || e.grupos_musculares || [], e.ejercicio?.tipo || e.tipo || [])))].slice(0, 4);
  return { ejercicios: lista.length, series: lista.reduce((t, e) => t + Number(e.series), 0), minutos: lista.length ? duracionEstimada(lista) : 0, grupos, patrones };
}

// ---------- récords de un ejercicio, a lo largo del tiempo ----------
// puntos: su mejor 1RM estimado hasta cada día en que lo mejoró (el primero, el de la primera vez); sin carga, las
// repeticiones. veces: cada vez que batió un récord (los mismos de la vitrina y del resumen), de la más reciente a la
// más antigua.
const instante = (s) => `${s.fecha || ''}${s.registrada_en || ''}`;
export function historiaRecords(series = [], ejercicioId) {
  const propias = (series || []).filter((s) => s.ejercicio_id === ejercicioId && Number(s.reps) > 0);
  const orden = [...propias].sort((a, b) => (instante(a) < instante(b) ? -1 : instante(a) > instante(b) ? 1 : 0));
  const conKg = [], sinKg = [];
  let mejor = 0, mejorReps = 0;
  const poner = (lista, x, y) => { const u = lista[lista.length - 1]; if (u && u.x === x) u.y = y; else lista.push({ x, y }); };
  for (const s of orden) {
    if (!s.fecha) continue;
    const v = Number(s.kg) > 0 ? e1rm(s) : null;
    if (v != null && v > mejor) { mejor = v; poner(conKg, s.fecha, v); }
    if (!(Number(s.kg) > 0) && Number(s.reps) > mejorReps) { mejorReps = Number(s.reps); poner(sinKg, s.fecha, mejorReps); }
  }
  const { eventos } = eventosRecord(propias);
  const kg = conKg.length > 0;
  return {
    unidad: kg ? 'kg' : 'rep',
    puntos: kg ? conKg : sinKg,
    veces: eventos.map((e) => ({ fecha: e.fecha, texto: e.record.texto, tipo: e.record.tipo })).reverse(),
  };
}
// ¿Récord reciente? (menos de 30 días, como la vitrina)
export const esReciente = (fecha, hoy = hoyISO(), dias = 30) => !!fecha && fecha <= hoy && diasEntre(fecha, hoy) < dias;

// ---------- Revisar: la bandeja por atletas ----------
// items: [{ tipo, clave, atleta: { id, nombre, foto }, ... }]. Cada atleta con lo suyo (en el orden de llegada) y
// cuántas cosas tiene; primero quien más tiene por revisar (a igualdad, por nombre). Lo que no es de un atleta (los
// avisos de la comunidad) va aparte, al final.
export function agruparPorAtleta(items = []) {
  const grupos = new Map();
  const sueltos = [];
  for (const x of items || []) {
    const id = x?.atleta?.id;
    if (!id) { sueltos.push(x); continue; }
    if (!grupos.has(id)) grupos.set(id, { id, atleta: x.atleta, items: [] });
    grupos.get(id).items.push(x);
  }
  const lista = [...grupos.values()].map((g) => ({ ...g, n: g.items.length, tipos: contarTipos(g.items) }))
    .sort((a, b) => b.n - a.n || String(a.atleta.nombre || '').localeCompare(String(b.atleta.nombre || ''), 'es'));
  if (sueltos.length) lista.push({ id: 'equipo', atleta: null, items: sueltos, n: sueltos.length, tipos: contarTipos(sueltos) });
  return lista;
}
function contarTipos(items) {
  const t = {};
  for (const x of items) t[x.tipo] = (t[x.tipo] || 0) + 1;
  return t;
}
const NOMBRE_TIPO_REVISAR = { mensajes: ['mensaje', 'mensajes'], sesiones: ['sesión', 'sesiones'], checkins: ['check-in', 'check-ins'], videos: ['vídeo', 'vídeos'], tareas: ['tarea', 'tareas'], recetas: ['receta', 'recetas'], comunidad: ['aviso', 'avisos'] };
// «2 sesiones, 1 vídeo»
export function textoTipos(tipos = {}) {
  return Object.keys(NOMBRE_TIPO_REVISAR).filter((k) => tipos[k]).map((k) => `${tipos[k]} ${NOMBRE_TIPO_REVISAR[k][tipos[k] === 1 ? 0 : 1]}`).join(', ');
}
// Un gesto horizontal: ¿cuenta como deslizar para marcarlo? (más de un 35 % del ancho o 96 px, bastante más en
// horizontal que en vertical y hacia la derecha)
export function esDeslizar(dx, dy, ancho = 360) {
  return dx > Math.min(96, ancho * 0.35) && Math.abs(dx) > Math.abs(dy) * 1.5;
}
// Duración de un vídeo: «0:42», «1:05»
export const duracionCorta = (s) => {
  const t = Math.max(0, Math.round(Number(s) || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

// ---------- nutrición: el día ----------
// reg: lo apuntado ese día; obj: su objetivo (objetivoDelDia). kcal con lo comido, lo que tocaba y lo que queda (o
// lo que se ha pasado), y un anillo por macro con objetivo (proteína siempre; hidratos y grasa, si el plan los pone).
const n0 = (x) => (x == null || x === '' || Number.isNaN(Number(x)) ? null : Number(x));
const fraccion = (v, o) => (v == null || !o ? 0 : Math.max(0, Math.min(1.5, v / o)));
export function macrosDia(reg, obj) {
  if (!obj || !(Number(obj.kcal) > 0)) return null;
  const kcal = n0(reg?.kcal);
  const objetivo = Number(obj.kcal);
  const f = fraccion(kcal, objetivo);
  const kc = {
    valor: kcal, objetivo, frac: f,
    quedan: kcal == null ? objetivo : Math.round(objetivo - kcal),
    estado: kcal == null ? 'sin_dato' : f > 1.1 ? 'pasado' : f >= 0.9 ? 'cumple' : 'falta',
  };
  const macro = (id, nombre, valor, o) => {
    const v = n0(valor);
    return { id, nombre, valor: v, objetivo: Number(o), frac: fraccion(v, Number(o)), estado: v == null ? 'sin_dato' : v >= Number(o) * 0.9 ? 'cumple' : 'falta' };
  };
  const macros = [macro('proteina', 'Proteína', reg?.proteina_g, obj.proteina)];
  if (obj.carbos != null) macros.push(macro('carbos', 'Hidratos', reg?.carbos_g, obj.carbos));
  if (obj.grasa != null) macros.push(macro('grasa', 'Grasa', reg?.grasa_g, obj.grasa));
  return { kcal: kc, macros: macros.filter((m) => m.objetivo > 0) };
}

// Los colores de los macros, para cada tema (los mismos que --macro-* en estilos.css; las pruebas los comparan): cada
// uno, al menos 3:1 sobre todas las superficies del tema (contraste de lo que no es texto), también sobre el negro
// puro. Entre sí se distinguen por el tono (rojo frambuesa, ámbar y azul), y siempre van con su nombre y su cifra.
export const COLORES_MACRO = {
  claro: { proteina: '#5438D8', carbos: '#8F5E00', grasa: '#1F5BC6' },
  oscuro: { proteina: '#A596FF', carbos: '#F0BE3C', grasa: '#7AA8FF' },
};

// ---------- Perfil: las cifras de la cabecera ----------
// Semanas completas en total (no solo la racha actual): las de lunes ya pasados con todas sus sesiones hechas, y la de
// esta semana si ya está completa. semanas: [{ fecha_inicio, total, hechas }] (varias del mismo lunes se suman).
export function semanasCompletas(semanas = [], hoy = hoyISO()) {
  const porLunes = new Map();
  for (const s of semanas || []) {
    if (!s?.fecha_inicio || !s.total) continue;
    const k = s.fecha_inicio;
    const x = porLunes.get(k) || { total: 0, hechas: 0 };
    x.total += s.total; x.hechas += s.hechas || 0;
    porLunes.set(k, x);
  }
  let n = 0;
  for (const [k, x] of porLunes) if (k <= hoy && x.hechas >= x.total) n++;
  return n;
}

// Un enlace que se pinta como enlace (la página de Notion del atleta, que escribe el coach): solo https
export function urlSegura(u) {
  if (typeof u !== 'string' || !u.trim()) return null;
  try { const x = new URL(u.trim()); return x.protocol === 'https:' ? x.href : null; } catch { return null; }
}
