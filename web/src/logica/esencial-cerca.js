// FBE Esencial (acompañamiento, tanda 5, v0.246): «que no entrenen solos». Lógica pura.
// Lo que la app le dice entre el lunes y el domingo: el saludo de cada día, las agujetas del día después, la vuelta tras unos
// días sin entrenar, si baja el ritmo, sus hitos, su trimestre, el reto de la semana, «¿Te vas?» antes de las vacaciones,
// «¿Cómo vamos?» y el diario de lo que la app ha hecho por él. Para el coach, a quién escribir.
// Sale todo de lo que ya hay (su programa y lo que apunta). Lo que va con la voz de Pelayo (sus notas de los lunes y el día a
// día de las dos primeras semanas) está escrito como borrador y APAGADO (logica/esencial-respuestas.js) hasta que lo vea.
import { num } from './calculos.js';

const DIA = 864e5;
const d10 = (x) => (x ? String(x).slice(0, 10) : null);
const sumar = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * DIA).toISOString().slice(0, 10);
const entre = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DIA);
const dow = (iso) => (new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7;   // 0 lunes … 6 domingo
const cuantas = (n, una, varias) => (n === 1 ? una : varias.replace('%', String(n)));

// Todas sus sesiones (las de todas sus semanas), y las hechas con su fecha
const todasDe = (sesiones = {}) => Object.values(sesiones || {}).flat();
const hechasDe = (sesiones = {}) => todasDe(sesiones).filter((s) => s.completada && s.fecha_realizada).map((s) => ({ ...s, fecha: d10(s.fecha_realizada) }));
// Qué semana es por su nota (la escribe el motor: logica/motor/nota.js)
const esDescarga = (w) => String(w?.nota_coach || '').startsWith('Semana de descarga');
const esVuelta = (w) => String(w?.nota_coach || '').startsWith('Vuelves');

// ---------- (22, 25, 36 y 37) El saludo de Hoy, según el día ----------
// actual: su semana; semanas: las suyas; sesiones: { semana_id: [...] } → null | { tipo, texto, extra }
export function saludoDe({ hoy, actual = null, semanas = [], sesiones = {} } = {}) {
  if (!hoy || !actual?.fecha_inicio || d10(actual.fecha_inicio) > hoy) return null;
  const ss = sesiones[actual.id] || [];
  if (!ss.length) return null;
  const hechas = hechasDe(sesiones);
  const ayer = sumar(hoy, -1), manana = sumar(hoy, 1);
  const pendientes = ss.filter((s) => !s.completada);
  const hechaHoy = hechas.some((s) => s.fecha === hoy);
  const tocaHoy = pendientes.find((s) => d10(s.dia_previsto) === hoy);
  const tocaManana = pendientes.find((s) => d10(s.dia_previsto) === manana);
  const conDias = ss.some((s) => s.dia_previsto);
  const descarga = esDescarga(actual), vuelta = esVuelta(actual);
  let tipo, texto;
  if (hechaHoy) { tipo = 'hecha'; texto = pendientes.length ? 'Sesión de hoy, hecha. Lo que queda del día es recuperar: come bien y duerme.' : 'Semana hecha. Lo que queda es recuperar: come bien y duerme.'; }
  else if (tocaHoy) {
    tipo = 'toca';
    texto = descarga ? `Hoy toca «${tocaHoy.nombre}», en semana de descarga: menos carga, a propósito. No aprietes.`
      : vuelta ? `Qué bien verte de vuelta. Hoy toca «${tocaHoy.nombre}», más suave a propósito.`
        : `Hoy toca «${tocaHoy.nombre}». Sin prisa y sin ir al límite: con hacerla, cumples.`;
  } else if (!pendientes.length) { tipo = 'completa'; texto = 'Semana hecha. Hasta el lunes, descansar también es entrenar.'; }
  else if (hechas.some((s) => s.fecha === ayer)) { tipo = 'despues'; texto = 'Ayer entrenaste: hoy toca descansar. Si notas agujetas, son normales y se pasan antes moviéndote.'; }
  else if (tocaManana) { tipo = 'vispera'; texto = `Mañana toca «${tocaManana.nombre}». Deja la bolsa preparada esta noche: es media sesión hecha.`; }
  else if (!conDias) { tipo = 'libre'; texto = `Esta semana te ${cuantas(pendientes.length, 'queda una sesión', 'quedan % sesiones')}. Elige el día, mejor sin que vayan seguidas.`; }
  else { tipo = 'descanso'; texto = 'Hoy descansas. El descanso es parte del plan, no un hueco.'; }
  // Lo de la semana pasada, sin castigo (solo de lunes a miércoles, para no repetirlo toda la semana)
  const previa = [...semanas].filter((w) => w.fecha_inicio && d10(w.fecha_inicio) < d10(actual.fecha_inicio) && (sesiones[w.id] || []).length)
    .sort((a, b) => d10(b.fecha_inicio).localeCompare(d10(a.fecha_inicio)))[0] || null;
  let extra = null;
  if (previa && dow(hoy) <= 2 && tipo !== 'hecha') {
    const suyas = sesiones[previa.id] || [];
    const sin = suyas.filter((s) => !s.completada).length;
    if (previa.esencial_cierre === 'pausa') extra = 'Vuelves de una semana en pausa: tu plan te esperaba donde lo dejaste.';
    else if (esDescarga(previa) && !descarga) extra = 'Descarga hecha: esta semana retomas donde lo dejaste, con el cuerpo más fresco.';
    else if (sin > 0 && sin < suyas.length) extra = 'La semana pasada quedó a medias. No pasa nada: la que cuenta es la siguiente sesión.';
    else if (sin > 0) extra = 'La semana pasada no pudo ser. No hay nada que recuperar: empiezas esta como si nada.';
  }
  return { tipo, texto, extra, descarga, vuelta };
}

// ---------- (23) El día después de su primera sesión (o de una dura): «¿Qué tal las agujetas?» ----------
export const AGUJETAS = [
  ['nada', 'Nada', 'Perfecto. Que no haya agujetas no significa que entrenaras mal: no dicen si entrenaste bien o mal. Sigue con tu plan.'],
  ['normales', 'Las normales', 'Son normales las dos primeras semanas: luego bajan. Moverte hoy (caminar, estirar suave) ayuda a que se pasen antes.'],
  ['muchas', 'Muchas', 'Suele pasar tras la primera sesión o tras una dura, y baja en dos o tres días. La molestia del músculo que ha trabajado se nota en los dos lados y mejora cuando te mueves. Si es punzante, se queda en una articulación o va a más, eso no son agujetas.'],
];
// hechas: sus sesiones hechas de todos sus bloques [{ id, fecha, rpe }] → null | { motivo: 'primera' | 'dura', sesion }
export function agujetasDe({ hoy, hechas = [] } = {}) {
  if (!hoy) return null;
  const ayer = sumar(hoy, -1);
  const deAyer = hechas.filter((s) => s.fecha === ayer);
  if (!deAyer.length || hechas.some((s) => s.fecha === hoy)) return null;
  if (hechas.length === deAyer.length) return { motivo: 'primera', sesion: deAyer[0].id };
  const dura = deAyer.find((s) => Number(s.rpe) >= 9);
  return dura ? { motivo: 'dura', sesion: dura.id } : null;
}

// ---------- (26) Días sin entrenar: el plan de vuelta ----------
// ss: las sesiones de su semana; hechas: las de todos sus bloques; inicio: el lunes en que empezó su plan
// → null | { dias, sesion: la siguiente por hacer de su semana, nunca: true si aún no ha hecho ninguna }
export function vueltaDe({ hoy, actual = null, ss = [], hechas = [], inicio = null } = {}) {
  if (!hoy || !actual) return null;
  const fechas = hechas.map((s) => s.fecha).filter(Boolean).sort();
  const desde = fechas[fechas.length - 1] || d10(inicio);
  if (!desde || desde > hoy) return null;
  const dias = entre(desde, hoy);
  if (dias < 7) return null;
  const sig = [...ss].filter((s) => !s.completada).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))[0] || null;
  if (!sig || actual.esencial_cierre === 'pausa') return null;
  return { dias, sesion: sig, nunca: !fechas.length };
}

// ---------- (27) Si baja el ritmo dos semanas ----------
// Las dos últimas semanas acabadas (antes de la actual), las dos con menos de la mitad de sus sesiones hechas → { hechas, total }
export function ritmoDe({ actual = null, semanas = [], sesiones = {} } = {}) {
  if (!actual?.fecha_inicio) return null;
  const previas = [...semanas].filter((w) => w.fecha_inicio && d10(w.fecha_inicio) < d10(actual.fecha_inicio) && (sesiones[w.id] || []).length >= 2 && w.esencial_cierre !== 'pausa')
    .sort((a, b) => d10(b.fecha_inicio).localeCompare(d10(a.fecha_inicio))).slice(0, 2);
  if (previas.length < 2) return null;
  const cuenta = (w) => { const ss = sesiones[w.id] || []; return [ss.filter((s) => s.completada).length, ss.length]; };
  const [a, b] = previas.map(cuenta);
  if (a[0] * 2 >= a[1] || b[0] * 2 >= b[1]) return null;
  return { hechas: a[0] + b[0], total: a[1] + b[1], dias: Math.max(a[1], b[1]) };
}

// ---------- (28) Celebraciones con sentido ----------
// (la primera ya tiene su celebración: «Tu primera sesión, hecha», en EsencialSesion.jsx)
export const HITOS = {
  10: 'Diez sesiones. Ya no estás probando: estás entrenando.',
  25: 'Veinticinco sesiones. El hábito ya es tuyo.',
  50: 'Cincuenta sesiones. Cincuenta veces que has elegido ir.',
  100: 'Cien sesiones. Esto ya es parte de quién eres.',
};
export const hitoDe = (n) => HITOS[Number(n)] || null;

// ---------- (29) «Tu trimestre», a las doce semanas ----------
// filas: [{ nombre, por_tiempo, antes: { kg, max }, ahora: { kg, max } }] (api-esencial: trimestre) → cada una con su frase
export function trimestreDe({ filas = [], sesiones = 0, semanas = 0, cuerpo = null } = {}) {
  const u = (f) => (f.por_tiempo ? 'segundos' : 'kg');
  const lineas = filas.filter((f) => f.ahora && f.antes).map((f) => {
    const a = f.por_tiempo ? Number(f.antes.max) : Number(f.antes.kg), b = f.por_tiempo ? Number(f.ahora.max) : Number(f.ahora.kg);
    if (!(a > 0) || !(b > 0)) return { nombre: f.nombre, texto: b > 0 ? `ahora, ${num(b)} ${u(f)}` : 'sin kilos apuntados', sube: false };
    const dif = Math.round((b - a) * 10) / 10;
    return { nombre: f.nombre, sube: dif > 0, texto: dif === 0 ? `${num(b)} ${u(f)}, como al empezar` : `de ${num(a)} a ${num(b)} ${u(f)} (${dif > 0 ? '+' : '−'}${num(Math.abs(dif))})` };
  });
  const suben = lineas.filter((l) => l.sube).length;
  // (v0.248, 68) su punto de partida: el peso y la cintura de antes de empezar y los de ahora, si los apuntó
  const medida = (nombre, x, ud) => (x ? { nombre, texto: x.antes === x.ahora ? `${num(x.ahora)} ${ud}, como al empezar` : `de ${num(x.antes)} a ${num(x.ahora)} ${ud}` } : null);
  const cuerpoL = [medida('Tu peso', cuerpo?.peso, 'kg'), medida('Tu cintura', cuerpo?.cintura, 'cm')].filter(Boolean);
  return { lineas, suben, cuerpo: cuerpoL,
    titulo: semanas >= 12 ? `${semanas} semanas: tu trimestre` : `Lo que llevas: ${cuantas(semanas, 'una semana', '% semanas')}`,
    resumen: `${cuantas(sesiones, 'Una sesión hecha', '% sesiones hechas')}${lineas.length ? ` y más carga en ${suben} de ${lineas.length} ejercicios` : ''}.` };
}
export const TRIMESTRE_SIGUE = [
  ['seguir', 'Seguir con mi rutina', 'Si sigues subiendo y te gusta, no la toques: la constancia gana a la novedad.'],
  ['cambiar', 'Ver otras rutinas', 'A las doce semanas es buen momento para cambiar, si te apetece o te has atascado.'],
  ['programa', 'Un programa con seguimiento', 'Si quieres un plan hecho para ti y que Pelayo revise cada semana, es el paso siguiente. Sin prisa: FBE Esencial sigue aquí.'],
];

// ---------- (32) El reto de la semana ----------
// ss: sus sesiones de la semana; equipo: { con, completas, entrenando } | null (api: esencial_equipo_semana)
export function retoSemana({ ss = [], equipo = null } = {}) {
  if (!ss.length) return null;
  const hechas = ss.filter((s) => s.completada).length;
  const texto = hechas >= ss.length ? 'Reto de la semana, conseguido.' : `Reto de la semana: ${cuantas(ss.length, 'tu sesión', 'tus % sesiones')}. Llevas ${hechas}.`;
  const gente = equipo && equipo.con >= 5
    ? (equipo.completas > 0 ? `Ya lo ${cuantas(equipo.completas, 'ha conseguido una persona', 'han conseguido % personas')} de FBE Esencial${equipo.entrenando > equipo.completas ? `, y ${equipo.entrenando - equipo.completas} más ${equipo.entrenando - equipo.completas === 1 ? 'va' : 'van'} en ello` : ''}.`
      : equipo.entrenando > 0 ? `Esta semana ya ${cuantas(equipo.entrenando, 'ha entrenado una persona', 'han entrenado % personas')} de FBE Esencial.` : 'Esta semana aún no ha entrenado nadie de FBE Esencial: puedes ser la primera persona.')
    : null;
  return { hechas, total: ss.length, hecho: hechas >= ss.length, texto, gente };
}

// ---------- (35) Antes de Navidad, Semana Santa y agosto: «¿Te vas?» ----------
// El domingo de Pascua de ese año (algoritmo de Butcher), 'AAAA-MM-DD'
export function pascua(anio) {
  const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}
// → null | { id: 'navidad-2026', cuando: 'estas navidades' } en las dos semanas de antes
export function seVa(hoy) {
  if (!hoy) return null;
  const anio = Number(hoy.slice(0, 4));
  const ps = pascua(anio);
  const ventanas = [
    [`navidad-${anio}`, `${anio}-12-08`, `${anio}-12-23`, 'estas navidades'],
    [`pascua-${anio}`, sumar(ps, -21), sumar(ps, -8), 'en Semana Santa'],
    [`agosto-${anio}`, `${anio}-07-17`, `${anio}-07-31`, 'en agosto'],
  ];
  const v = ventanas.find(([, de, a]) => hoy >= de && hoy <= a);
  return v ? { id: v[0], cuando: v[3] } : null;
}

// ---------- (39) «¿Cómo vamos?», al mes y a los tres meses ----------
// n: la semana de su plan; notas: las suyas de tipo 'como_vamos' → null | 'mes' | 'trimestre' (el que toca y no ha contestado)
export function comoVamosToca({ n = null, notas = [] } = {}) {
  const k = Number(n) || 0;
  const momento = k >= 12 && k <= 14 ? 'trimestre' : k >= 4 && k <= 6 ? 'mes' : null;
  if (!momento || (notas || []).some((x) => x?.datos?.momento === momento)) return null;
  return momento;
}
// (el panel del coach) La media y lo que echan de menos
export function comoVamosResumen(notas = []) {
  const con = (notas || []).filter((x) => Number(x?.datos?.nota) >= 1);
  if (!con.length) return null;
  const media = Math.round((con.reduce((t, x) => t + Number(x.datos.nota), 0) / con.length) * 10) / 10;
  return { n: con.length, media, textos: con.filter((x) => x.texto).map((x) => ({ texto: x.texto, nota: Number(x.datos.nota), nombre: x.nombre || '' })) };
}

// ---------- (21) «Lo que la app ha hecho por ti» ----------
// bloques: los suyos; semanas: las suyas; sesiones: { semana_id: [...] } → [{ fecha, icono, titulo, texto }], lo último primero
export function diarioDe({ bloques = [], semanas = [], sesiones = {}, hoy } = {}) {
  const out = [];
  const nombreDe = Object.fromEntries((bloques || []).map((b) => [b.id, b.nombre]));
  const porBloque = {};
  for (const w of semanas) (porBloque[w.bloque_id] ||= []).push(w);
  for (const b of bloques || []) {
    if (b.estado === 'cancelado' || !b.fecha_inicio) continue;
    // (v0.247) de dónde sale cada plan: las cuatro primeras, de su cuestionario; la de novato que viene después, de sus marcas
    const tras = (bloques || []).some((x) => x.nombre === 'Primeras 4 semanas' && x.fecha_inicio && d10(x.fecha_inicio) < d10(b.fecha_inicio));
    const texto = b.nombre === 'Primeras 4 semanas' ? 'Con tus respuestas del cuestionario: las cuatro semanas de la guía, para empezar.'
      : /^Novato \d d.as/.test(b.nombre) && tras ? 'Al acabar tus cuatro primeras semanas, con tus marcas.'
        : 'Con tus respuestas del cuestionario y la rutina que elegiste.';
    out.push({ fecha: d10(b.fecha_inicio), icono: 'plantillas', titulo: `Te preparó tu plan: «${b.nombre}»`, texto });
  }
  for (const w of semanas) {
    if (!w.fecha_inicio || w.programacion !== 'programada' || (hoy && d10(w.fecha_inicio) > sumar(hoy, 7))) continue;
    const primera = Math.min(...(porBloque[w.bloque_id] || []).map((x) => x.numero)) === w.numero;
    if (!primera && w.nota_coach) out.push({ fecha: d10(w.fecha_inicio), icono: 'calendario', titulo: `Te preparó la semana ${w.numero} de «${nombreDe[w.bloque_id] || 'tu plan'}»`, texto: w.nota_coach });
    const lunes = d10(w.esencial_cierre_lunes);
    if (w.esencial_cierre === 'auto' && lunes) out.push({ fecha: sumar(lunes, 6), icono: 'reloj', titulo: 'Pasó sola a la semana siguiente', texto: 'No elegiste el domingo, así que te dejó la siguiente programada. Lo que no hiciste no se recupera doblando.' });
    if (w.esencial_cierre === 'pasar' && lunes) out.push({ fecha: sumar(lunes, 6), icono: 'derecha', titulo: 'Pasaste a la semana siguiente', texto: 'Lo elegiste tú el domingo: la app te la preparó con lo que habías apuntado.' });
    if (w.esencial_cierre === 'repetir' && lunes) out.push({ fecha: sumar(lunes, 6), icono: 'reiniciar', titulo: `Repetiste la semana ${w.numero}`, texto: 'Tu plan se corrió una semana: lo hecho se quedó hecho.' });
    if (w.esencial_cierre === 'pausa' && lunes) out.push({ fecha: lunes, icono: 'pausa', titulo: 'Semana en pausa', texto: 'Tu plan se corrió una semana y no te llegaron avisos de entreno.' });
    const cerradas = (sesiones[w.id] || []).filter((s) => s.cerrada_sola_en);
    for (const s of cerradas) out.push({ fecha: d10(s.cerrada_sola_en), icono: 'hecho', titulo: `Cerró «${s.nombre}» por ti`, texto: 'Te la dejaste abierta: la dio por terminada con lo que habías apuntado.' });
  }
  return out.filter((x) => x.fecha && (!hoy || x.fecha <= sumar(hoy, 7))).sort((a, b) => b.fecha.localeCompare(a.fecha));
}

// ---------- (30 y 31, P: APAGADO) Una nota de Pelayo cada lunes, y su voz ----------
// Borradores para que Pelayo los reescriba con su voz. La semana es la de su plan. No salen hasta que los apruebe.
export const NOTAS_LUNES = {
  1: 'Te doy la bienvenida. Esta semana solo tienes un trabajo: ir. Poco peso, apuntarlo todo y salir con ganas de volver.',
  2: 'Segunda semana: las agujetas mandan menos y el gimnasio ya no es un sitio raro. Dos series, sin prisa.',
  3: 'Hoy sube un poco el peso. Si sale, perfecto. Si no, lo apuntas tal cual: para eso está el registro.',
  4: 'Semana de marcas. No es un examen: es la foto de dónde estás. Apunta bien cada serie.',
  5: 'Desde hoy la app te prepara cada semana. Fíate del proceso: sube poco, pero sube siempre.',
  6: 'Que cada serie cuente. Mejor tres series bien hechas que cinco de trámite.',
  8: 'Dos meses. Lo difícil ya no es entrenar: es no dejarlo. Vas bien.',
  12: 'Doce semanas. Mira tus marcas del primer día y las de hoy. Eso lo has hecho tú.',
};
// Su voz (un audio corto grabado una vez): la ruta del archivo cuando lo haya. Sin archivo, no sale nada.
export const VOZ_PELAYO = { 1: null, 4: null, 12: null };
export const notaDelLunes = (n) => NOTAS_LUNES[Number(n)] || null;

// ---------- (24, P: APAGADO) Sus dos primeras semanas, día a día ----------
// El día de su plan (1 = su primer lunes) → lo de hoy. Borradores con frases de la guía.
export const DIA_A_DIA = {
  1: 'Día 1. Hoy o mañana, tu primera sesión. Pide que te ajusten las máquinas y empieza con poco.',
  2: 'Día 2. Si entrenaste ayer, hoy descansas. Si no, hoy es buen día.',
  3: 'Día 3. Las agujetas de estos días son normales. Moverte ayuda.',
  4: 'Día 4. Segunda sesión de la semana: mismos ejercicios, ya sabes dónde está todo.',
  7: 'Día 7. Primera semana hecha o casi. El domingo, la app te pregunta cómo seguimos.',
  8: 'Día 8. Semana 2: dos series de cada ejercicio, y que te sobren 3.',
  10: 'Día 10. Si un peso se te queda corto, súbelo un poco. Si se te queda grande, bájalo. Y apúntalo.',
  14: 'Día 14. Dos semanas. Lo más difícil de empezar ya lo has hecho.',
};
export function diaDelPlan({ hoy, inicio } = {}) {
  if (!hoy || !inicio || d10(inicio) > hoy) return null;
  const n = entre(d10(inicio), hoy) + 1;
  return n >= 1 && n <= 14 ? n : null;
}

// ---------- (38) El panel del coach: a quién escribir ----------
// filas: [{ atleta_id, nombre, email, estado, dias (sin entrenar, o null), semanasFalladas, grave (molestia grave), sinAbrir (días) }]
// → [{ atleta_id, nombre, email, motivo, asunto, cuerpo }], lo más urgente primero. Los textos, borradores para que Pelayo los mande él.
export function aQuienEscribir(filas = []) {
  const out = [];
  for (const r of filas) {
    if (r.estado === 'baja' || !r.email) continue;
    const nombre = String(r.nombre || '').split(' ')[0];
    if (r.grave) out.push({ ...r, orden: 0, motivo: 'Ha marcado una molestia grave en su check-in', asunto: 'Tu check-in de esta semana',
      cuerpo: `Hola, ${nombre}:\n\nHe visto que has marcado una molestia grave en tu check-in. Antes de seguir cargando esa zona conviene que te la valore un médico o un fisioterapeuta. Mientras tanto, en la app puedes cambiar el ejercicio que moleste por su alternativa.\n\nSi quieres contarme cómo estás, contéstame a este correo.\n\nPelayo` });
    else if (r.dias != null && r.dias >= 10) out.push({ ...r, orden: 1, motivo: `Lleva ${r.dias} días sin entrenar`, asunto: '¿Cómo vas?',
      cuerpo: `Hola, ${nombre}:\n\nHe visto que llevas unos días sin entrenar. No pasa nada, y no hay nada que recuperar: tu semana sigue en la app, lista para cuando vuelvas. Si esta semana no puedes, en Hoy tienes «Esta semana no puedo» para ponerla en pausa.\n\nSi hay algo de la app o del plan que te lo esté poniendo difícil, cuéntamelo.\n\nPelayo` });
    else if (r.semanasFalladas >= 2) out.push({ ...r, orden: 2, motivo: 'Dos semanas seguidas con menos de la mitad de sus sesiones', asunto: 'Tu plan, ¿encaja en tu semana?',
      cuerpo: `Hola, ${nombre}:\n\nEstas dos semanas el plan no ha encajado del todo en tu vida, y eso se arregla ajustando el plan, no apretando tú. En la app, en «Tu rutina», tienes opciones de dos días y una de mantenimiento mínimo para semanas complicadas.\n\nSi me cuentas qué te lo impide, te digo cuál elegiría yo.\n\nPelayo` });
    else if (r.dias == null && r.sinEmpezar) out.push({ ...r, orden: 3, motivo: 'Tiene su plan y aún no ha hecho su primera sesión', asunto: 'Tu primera sesión',
      cuerpo: `Hola, ${nombre}:\n\nTu plan ya está en la app y la primera sesión es la más difícil de todas. No hace falta que salga bien: hace falta que salga. Poco peso, apuntar lo que hagas y a casa.\n\nSi algo te frena (el gimnasio, la app, no saber por dónde empezar), dímelo.\n\nPelayo` });
  }
  return out.sort((a, b) => a.orden - b.orden || String(a.nombre).localeCompare(String(b.nombre), 'es'));
}
