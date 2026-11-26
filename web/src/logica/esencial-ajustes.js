// FBE Esencial (tanda 8, v0.249): «Tu panel: lo apagado, en tu mano». Lógica pura del panel del coach: lo que está apagado
// esperando su visto bueno (con su interruptor, su texto editable y «probarlo en una cuenta»), el registro de lo que cambia,
// «Tal cual», la curva del piloto, los candidatos a un programa con seguimiento, lo que ha hecho la app esta semana,
// Stripe frente a la app, la hoja de cálculo del piloto y el tope de avisos.
import { APAGADO, PENDIENTES, RESPUESTAS, LECCIONES_MOMENTO, CATEGORIAS, MOTIVOS_BAJA } from './esencial-respuestas.js';
import { NOTAS_LUNES, DIA_A_DIA } from './esencial-cerca.js';
import { LISTON_ESENCIAL } from './esencial-piloto.js';
import { RESPUESTAS_COMIDA, HOJAS_COMIDA, LECCIONES_COMIDA, AVISOS_PESO } from './esencial-comida.js';

const diasEntre = (a, b) => Math.round((Date.parse(`${String(b).slice(0, 10)}T12:00:00Z`) - Date.parse(`${String(a).slice(0, 10)}T12:00:00Z`)) / 864e5);
const sumar = (iso, n) => new Date(Date.parse(`${String(iso).slice(0, 10)}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const lunesDe = (iso) => { const d = new Date(`${String(iso).slice(0, 10)}T12:00:00Z`); return sumar(iso, -((d.getUTCDay() + 6) % 7)); };

// ---------- (81) Lo apagado: qué es cada cosa, de qué tipo y dónde verla ----------
// tipo: 'texto' (palabras suyas o de salud: se pueden corregir), 'regla' (cambia cómo progresa o qué hace la app) o 'salud'
// ver: en qué persona de la demo se ve (para «Ver como…»); textos: las claves de sus textos editables
const N = (o) => Object.keys(o).map(Number).sort((a, b) => a - b);
const hojaTexto = (k, nombre) => ({ clave: `hoja:${k}`, nombre, campos: { texto: HOJAS_COMIDA[k].lineas.join('\n') } });
const HOJA_FUERA = hojaTexto('fuera', 'Hoy como fuera'), HOJA_HAMBRE = hojaTexto('hambre', 'Tengo mucha hambre');
const HOJA_PASADO = hojaTexto('pasado', 'Me he pasado'), HOJA_CELEBRACION = hojaTexto('celebracion', 'Tengo una celebración');
export const REVISAR = [
  { clave: 'notas_lunes', titulo: 'Tu nota de cada lunes', tipo: 'texto', que: 'Arriba en Hoy, cada lunes, una nota tuya de esa semana del plan (de la 1 a la 12).', ver: ['tomas', 'semana 5'],
    textos: N(NOTAS_LUNES).map((n) => ({ clave: `nota_lunes:${n}`, nombre: `Semana ${n}`, campos: { texto: NOTAS_LUNES[n] } })) },
  { clave: 'salud_nueva', titulo: 'Cuatro respuestas de salud nuevas', tipo: 'salud', que: 'En el centro de respuestas: resfriado, mareo, dormir mal y la regla.', ver: ['tomas', 'Respuestas › Dolor y salud'],
    textos: PENDIENTES.map((x) => ({ clave: `respuesta:${x.id}`, nombre: x.q, campos: { q: x.q, r: x.r } })) },
  { clave: 'lecciones_momento', titulo: 'Lecciones que saltan cuando toca', tipo: 'texto', que: 'Su primera descarga, su primer estancamiento, una semana a medias, la vuelta tras un parón y una rutina nueva.', ver: ['tomas', 'su revisión de la semana'],
    textos: Object.entries(LECCIONES_MOMENTO).map(([id, [t, x]]) => ({ clave: `momento:${id}`, nombre: t, campos: { titulo: t, texto: x } })) },
  { clave: 'dia_a_dia', titulo: 'Sus dos primeras semanas, día a día', tipo: 'texto', que: 'Una línea en Hoy cada día de sus dos primeras semanas.', ver: ['ines', 'Hoy'],
    textos: N(DIA_A_DIA).map((n) => ({ clave: `dia:${n}`, nombre: `Día ${n}`, campos: { texto: DIA_A_DIA[n] } })) },
  { clave: 'checkin_responde', titulo: 'El check-in contesta', tipo: 'salud', que: 'Una línea de qué hacer esta semana con el poco sueño o la poca motivación que marca.', ver: ['tomas', 'el check-in'] },
  { clave: 'enfermo', titulo: '«Estoy enfermo»', tipo: 'salud', que: 'En «¿Qué necesitas?»: qué hacer con su plan si está enfermo y cuándo volver.', ver: ['tomas', '¿Qué necesitas?'] },
  { clave: 'molestia_sigue', titulo: 'El seguimiento de una molestia', tipo: 'salud', que: 'A los tres y a los siete días de marcar una molestia, la app le pregunta cómo va.', ver: ['tomas', 'Me duele algo'] },
  { clave: 'salud_al_dia', titulo: 'Repasar su salud', tipo: 'salud', que: 'Cada seis meses, o si marca un síntoma, la app le pide repasar las preguntas de salud.', ver: ['tomas', 'Hoy'] },
  { clave: 'alarma', titulo: 'La señal de alarma', tipo: 'salud', que: 'Si marca una señal de alarma, «para y consulta», bien claro, y la app no sube hasta que confirme.', ver: ['tomas', 'el check-in'] },
  { clave: 'molestia_frena', titulo: 'Con una molestia, no sube', tipo: 'regla', que: 'Con una molestia moderada en una zona, la app no sube carga en lo que la carga. Lo que dice ya la lección de la semana 5.', ver: ['tomas', 'su semana'] },
  { clave: 'suave', titulo: '«Esta semana la necesito suave»', tipo: 'regla', que: 'Una semana de descarga cuando la pide él: la app mantiene los kilos y quita una serie.', ver: ['tomas', '¿Qué necesitas?'] },
  { clave: 'dos_duras', titulo: 'Dos sesiones duras seguidas: no sube', tipo: 'regla', que: 'Si marca dos sesiones seguidas como duras, la semana siguiente no sube.', ver: ['tomas', 'al acabar una sesión'] },
  { clave: 'variante', titulo: 'Una variante para un ejercicio atascado', tipo: 'regla', que: 'Si un ejercicio lleva tres semanas igual, le propone una variante.', ver: ['tomas', 'Cambiar un ejercicio'] },
  { clave: 'kilos_partida', titulo: 'Sus kilos de partida', tipo: 'regla', que: 'Quien ya entrena apunta antes de empezar con cuántos kilos va; en la semana 1, «¿Qué peso pongo?» se los recuerda.', ver: ['andresm', 'Hoy, antes de su lunes'] },
  { clave: 'medico', titulo: 'Qué pedirle a su médico', tipo: 'salud', que: 'Si su cribado pide valoración médica: un texto para enseñar en la consulta y qué pasa mientras.', ver: ['clara', 'Hoy'] },
  // (v0.250, tanda 9) la comida (solo para quien lleva nutrición; en la demo, Carmen). En las hojas, cada línea es un párrafo
  { clave: 'respuestas_comida', titulo: 'Quince respuestas de comida', tipo: 'salud', que: 'En el centro de respuestas, un tema nuevo, «La comida». Con antecedente de TCA no salen las que hablan de perder, de bajar el plan o de pesarse.', ver: ['carmen', 'Respuestas › La comida'],
    textos: RESPUESTAS_COMIDA.map((x) => ({ clave: `respuesta:${x.id}`, nombre: x.q, campos: { q: x.q, r: x.r } })) },
  { clave: 'comida_fuera', titulo: '«Hoy como fuera»', tipo: 'texto', que: 'En «¿Qué necesitas?»: cómo elegir sin apuntar gramos.', ver: ['carmen', '¿Qué necesitas?'], textos: [HOJA_FUERA] },
  { clave: 'hambre', titulo: '«Tengo mucha hambre»', tipo: 'salud', que: 'En «¿Qué necesitas?»: qué hacer si tiene hambre a menudo.', ver: ['carmen', '¿Qué necesitas?'], textos: [HOJA_HAMBRE] },
  { clave: 'me_he_pasado', titulo: '«Me he pasado»', tipo: 'texto', que: 'En «¿Qué necesitas?»: sin castigo ni compensar; qué hace la app (nada) y por qué. Nunca con antecedente de TCA.', ver: ['carmen', '¿Qué necesitas?'], textos: [HOJA_PASADO] },
  { clave: 'celebracion', titulo: 'Las celebraciones', tipo: 'regla', que: 'En «¿Qué necesitas?», «Tengo una celebración»: apunta el día y la app no usa el peso de ese día ni de los dos siguientes para ajustar su plan.', ver: ['carmen', '¿Qué necesitas?'], textos: [HOJA_CELEBRACION] },
  { clave: 'comida_viaje', titulo: 'La comida, de viaje', tipo: 'regla', que: 'Mientras está de viaje y la semana de la vuelta, la app no ajusta su plan de comida; en Hoy le dice que coma para mantener, con la cifra.', ver: ['carmen', 'Hoy, de viaje'] },
  { clave: 'aviso_peso', titulo: 'Si baja muy deprisa o se para', tipo: 'salud', que: 'En su revisión: si baja más de un 1 % a la semana, o su peso lleva tres semanas parado, qué pasa y qué hacer. Solo si busca perder.', ver: ['carmen', 'su revisión de la semana'],
    textos: [['deprisa', 'Baja muy deprisa'], ['parado', 'Tres semanas parado']].map(([k, nombre]) => ({ clave: `aviso_peso:${k}`, nombre, campos: { titulo: AVISOS_PESO[k][0], texto: AVISOS_PESO[k][1] } })) },
  { clave: 'checkin_comida', titulo: 'El check-in contesta al hambre y a la energía', tipo: 'salud', que: 'Con mucha hambre, o con poca energía comiendo para perder, una línea de qué hacer.', ver: ['carmen', 'el check-in'] },
  { clave: 'lecciones_comida', titulo: 'Cuatro lecciones de comida', tipo: 'texto', que: 'En su revisión, una vez cada una: su primer ajuste, una semana sin bajar, su primer fin de semana y su primera comida fuera.', ver: ['carmen', 'su revisión de la semana'],
    textos: Object.entries(LECCIONES_COMIDA).map(([id, [t, x]]) => ({ clave: `leccion_comida:${id}`, nombre: t, campos: { titulo: t, texto: x } })) },
];
export const REVISAR_POR = Object.fromEntries(REVISAR.map((x) => [x.clave, x]));
// (97 y 98) Los ajustes que no son textos: el tope de avisos y tu resumen de los lunes
export const AJUSTES = [
  { clave: 'tope_dia', titulo: 'Como mucho un aviso al día', que: 'De los avisos automáticos de FBE Esencial, como mucho uno al día por atleta (el primero que toque).' },
  { clave: 'tope_semana', titulo: 'Como mucho N avisos a la semana', que: 'De los avisos automáticos de FBE Esencial, como mucho este número por atleta y semana (de lunes a domingo).', numero: [3, 14, 7] },
  { clave: 'resumen_lunes', titulo: 'Tu resumen de los lunes', que: 'Cada lunes por la mañana, un aviso a ti con cuántos entrenaron la semana pasada, quién lleva siete días sin entrenar y las preguntas nuevas para el directo. Te llega como el resto de tus avisos: al móvil o por correo.' },
];
export const TODAS_LAS_CLAVES = [...REVISAR.map((x) => x.clave), ...AJUSTES.map((x) => x.clave)];
// que las claves de lo apagado y las de REVISAR coincidan (lo comprueban las pruebas)
export const revisarCompleto = () => REVISAR.length === APAGADO.size && REVISAR.every((x) => APAGADO.has(x.clave));

// El estado de cada cosa, con las filas de esencial_ajustes: { clave, encendido, solo_atleta, texto, valor } → por clave
export function estadoDe(filas = []) {
  const por = new Map((filas || []).map((f) => [f.clave, f]));
  return REVISAR.map((x) => {
    const f = por.get(x.clave) || null;
    const editados = (x.textos || []).filter((t) => por.get(t.clave)?.texto).length;
    return { ...x, encendido: f?.encendido === true, solo: f?.solo_atleta || null, editados, estado: f?.encendido ? 'encendido' : f?.solo_atleta ? 'probando' : 'apagado' };
  });
}
// Lo que se guarda al editar un texto: solo los campos que cambian frente a los de la app (null si no cambia nada)
export function textoNuevo(porDefecto = {}, escrito = {}) {
  const out = {};
  for (const [k, v] of Object.entries(porDefecto)) {
    const t = String(escrito?.[k] ?? '').trim();
    if (t && t !== v) {
      if (t.length > 1500) return { error: 'Es demasiado largo (como mucho 1500 caracteres).' };
      out[k] = t;
    }
  }
  return Object.keys(out).length ? out : null;
}
// (86) Una respuesta nueva: { cat, q, r } → lo que se guarda o { error }; id: a partir de la pregunta
export function respuestaNueva({ cat = 'app', q = '', r = '' } = {}, existentes = []) {
  const qq = String(q).trim(), rr = String(r).trim();
  if (qq.length < 5 || rr.length < 10) return { error: 'Escribe la pregunta y la respuesta.' };
  if (qq.length > 140 || rr.length > 1500) return { error: 'Es demasiado largo (la pregunta, como mucho 140; la respuesta, 1500).' };
  const base = qq.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'respuesta';
  const usados = new Set([...RESPUESTAS.map((x) => x.id), ...existentes]);
  let id = base, i = 2;
  while (usados.has(id)) id = `${base}-${i++}`;
  return { clave: `respuesta_nueva:${id}`, texto: { cat: CATEGORIAS.some((c) => c[0] === cat) ? cat : 'app', q: qq, r: rr } };
}

// ---------- (87) El registro: lo que ha cambiado, en palabras ----------
// fila: { clave, antes, despues, en } (antes/despues: la fila entera o null) → texto
export function textoRegistro(f = {}) {
  const x = REVISAR_POR[f.clave] || AJUSTES.find((a) => a.clave === f.clave) || null;
  const t = REVISAR.flatMap((r) => r.textos || []).find((y) => y.clave === f.clave) || null;
  const nombre = x?.titulo || (t ? `${t.nombre}` : /^respuesta_nueva:/.test(f.clave) ? `la respuesta «${f.despues?.texto?.q || f.antes?.texto?.q || ''}»` : /^respuesta:/.test(f.clave) ? `la respuesta «${f.clave.slice(10)}»` : f.clave);
  if (!f.despues) return `Quitaste lo tuyo de ${nombre}`;
  if (!f.antes) return f.despues.texto ? `Escribiste ${nombre}` : f.despues.encendido ? `Encendiste ${nombre}` : f.despues.solo_atleta ? `Probaste ${nombre} en una cuenta` : `Pusiste ${nombre}`;
  if (!!f.antes.encendido !== !!f.despues.encendido) return `${f.despues.encendido ? 'Encendiste' : 'Apagaste'} ${nombre}`;
  if ((f.antes.solo_atleta || null) !== (f.despues.solo_atleta || null)) return f.despues.solo_atleta ? `Probaste ${nombre} en una cuenta` : `Dejaste de probar ${nombre}`;
  if (JSON.stringify(f.antes.texto || null) !== JSON.stringify(f.despues.texto || null)) return `Corregiste ${nombre}`;
  if (f.antes.valor !== f.despues.valor) return `Cambiaste ${nombre} a ${f.despues.valor}`;
  return `Tocaste ${nombre}`;
}

// ---------- (88, 89, 93, 95 y 99) El piloto, semana a semana ----------
// filas: las de esencial_semanas_piloto() [{ atleta_id, semana_id, inicio, numero, bloque, marcas, cierre, total, hechas,
// cambios, sube }]; hoy: 'AAAA-MM-DD'. Solo cuentan las semanas ya terminadas.
const terminada = (w, hoy) => sumar(w.inicio, 6) < hoy;
// (88) «Tal cual»: hecha entera, sin cambiar ningún ejercicio en la sesión y sin repetirla ni pausarla
export const talCual = (w) => Number(w.total) > 0 && Number(w.hechas) >= Number(w.total) && !Number(w.cambios) && !['repetir', 'pausa'].includes(w.cierre);
export function talCualDe(filas = [], hoy) {
  const por = new Map();
  for (const w of (filas || []).filter((x) => terminada(x, hoy) && Number(x.total) > 0)) {
    const a = por.get(w.atleta_id) || { atleta_id: w.atleta_id, semanas: 0, talCual: 0, cambios: 0, repite: 0, pausa: 0, incompletas: 0 };
    a.semanas++;
    if (talCual(w)) a.talCual++;
    if (Number(w.cambios)) a.cambios++;
    if (w.cierre === 'repetir') a.repite++;
    if (w.cierre === 'pausa') a.pausa++;
    if (Number(w.hechas) < Number(w.total) && w.cierre !== 'pausa') a.incompletas++;
    por.set(w.atleta_id, a);
  }
  const lista = [...por.values()];
  const semanas = lista.reduce((n, a) => n + a.semanas, 0), tc = lista.reduce((n, a) => n + a.talCual, 0);
  return { lista, semanas, talCual: tc, pct: semanas ? Math.round((tc / semanas) * 100) : null };
}
// (89) La curva: de los que empezaron, cuántos entrenaron (al menos una sesión) cada semana de su plan, de la 1 a la 12
// (la semana N de cada uno cuenta desde su primer lunes)
export function curvaPiloto(filas = [], hoy, semanas = 12) {
  const inicio = new Map();
  for (const w of filas || []) if (!inicio.has(w.atleta_id) || w.inicio < inicio.get(w.atleta_id)) inicio.set(w.atleta_id, w.inicio);
  const puntos = [];
  for (let n = 1; n <= semanas; n++) {
    const enEsa = [...inicio.entries()].filter(([, i]) => terminada({ inicio: sumar(i, 7 * (n - 1)) }, hoy));
    if (!enEsa.length) break;
    const entrenaron = enEsa.filter(([id, i]) => (filas || []).some((w) => w.atleta_id === id && lunesDe(w.inicio) === sumar(i, 7 * (n - 1)) && Number(w.hechas) > 0)).length;
    puntos.push({ n, total: enEsa.length, entrenaron, pct: Math.round((entrenaron / enEsa.length) * 100) });
  }
  return { puntos, liston: Math.round(LISTON_ESENCIAL.siguen * 100) };
}
// (93) Candidatos a un programa con seguimiento: ocho semanas seguidas (las últimas terminadas) con todas sus sesiones, o
// que ha mirado «hablar con Pelayo» (una nota 'hablar'). hablar: [{ atleta_id, creada_en }]
export function candidatos(filas = [], hoy, hablar = []) {
  const por = new Map();
  for (const w of (filas || []).filter((x) => terminada(x, hoy) && Number(x.total) > 0 && x.cierre !== 'pausa')) (por.get(w.atleta_id) || por.set(w.atleta_id, []).get(w.atleta_id)).push(w);
  const out = new Map();
  for (const [id, ws] of por) {
    const ult = ws.sort((a, b) => String(a.inicio).localeCompare(String(b.inicio))).slice(-8);
    if (ult.length === 8 && ult.every((w) => Number(w.hechas) >= Number(w.total))) out.set(id, { atleta_id: id, motivo: 'ocho semanas seguidas con todo hecho' });
  }
  for (const h of hablar || []) if (!out.has(h.atleta_id)) out.set(h.atleta_id, { atleta_id: h.atleta_id, motivo: `miró «hablar con Pelayo» el ${String(h.creada_en).slice(8, 10)}/${String(h.creada_en).slice(5, 7)}` });
  return [...out.values()];
}
// (95) Lo que ha hecho la app esta semana (la que empieza el lunes de hoy) y la pasada: semanas preparadas, subidas de
// carga, pausas, repeticiones y viajes. viajes: notas 'viaje' [{ desde, hasta }]
export function loQueHizo(filas = [], hoy, viajes = []) {
  const lunes = lunesDe(hoy);
  const de = (l) => (filas || []).filter((w) => lunesDe(w.inicio) === l);
  const esta = de(lunes), pasada = de(sumar(lunes, -7));
  return {
    preparadas: esta.length,
    subidas: esta.reduce((n, w) => n + (Number(w.sube) || 0), 0),
    conSubidas: esta.filter((w) => Number(w.sube) > 0).length,
    pausas: pasada.filter((w) => w.cierre === 'pausa').length + esta.filter((w) => w.cierre === 'pausa').length,
    repiten: pasada.filter((w) => w.cierre === 'repetir').length,
    pasoSolo: pasada.filter((w) => w.cierre === 'auto').length,
    viajes: (viajes || []).filter((v) => v.desde && v.hasta && String(v.desde).slice(0, 10) <= sumar(lunes, 6) && String(v.hasta).slice(0, 10) >= lunes).length,
  };
}
// (99) La hoja de cálculo del piloto: una fila por atleta y semana (CSV con punto y coma, para Excel en español)
const celda = (v) => { const t = v == null ? '' : String(v); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
export function csvPiloto(filas = [], nombres = new Map()) {
  const cab = ['Atleta', 'Semana del plan', 'Lunes', 'Plan', 'Sesiones', 'Hechas', 'Ejercicios cambiados', 'Subidas de carga', 'Cierre', 'Tal cual'];
  const inicio = new Map();
  for (const w of filas || []) if (!inicio.has(w.atleta_id) || w.inicio < inicio.get(w.atleta_id)) inicio.set(w.atleta_id, w.inicio);
  const lineas = [...(filas || [])].sort((a, b) => String(nombres.get(a.atleta_id) || '').localeCompare(String(nombres.get(b.atleta_id) || ''), 'es') || String(a.inicio).localeCompare(String(b.inicio)))
    .map((w) => [nombres.get(w.atleta_id) || 'Sin nombre', Math.floor(diasEntre(inicio.get(w.atleta_id), w.inicio) / 7) + 1, String(w.inicio).slice(0, 10), w.bloque || '', w.total, w.hechas, w.cambios, w.sube, w.cierre || '', talCual(w) ? 'sí' : 'no']);
  return [cab, ...lineas].map((l) => l.map(celda).join(';')).join('\r\n');
}

// ---------- (91) Stripe frente a la app ----------
// texto: lo que pega de Stripe (la lista de suscripciones, copiada o exportada en CSV): por cada línea, el correo y el estado
// (active, trialing, past_due, canceled, incomplete…). atletas: [{ email, estado, nombre }] de FBE Esencial.
// (en inglés, como los exporta Stripe, o en español, como los enseña su panel)
const ESTADOS = {
  incomplete_expired: 'incomplete_expired', past_due: 'past_due', trialing: 'trialing', active: 'active', unpaid: 'unpaid', canceled: 'canceled', cancelled: 'canceled',
  incomplete: 'incomplete', paused: 'paused', activa: 'active', activo: 'active', prueba: 'trialing', vencida: 'past_due', vencido: 'past_due', impagada: 'unpaid',
  cancelada: 'canceled', cancelado: 'canceled', pausada: 'paused', incompleta: 'incomplete',
};
export function leerStripe(texto = '') {
  const out = new Map();
  for (const linea of String(texto).split(/\r?\n/)) {
    const email = (linea.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/) || [])[0];
    if (!email) continue;
    const resto = linea.replace(email, ' ');
    const k = Object.keys(ESTADOS).find((x) => new RegExp(`(^|[^a-z_])${x}([^a-z_]|$)`, 'i').test(resto));
    const est = k ? ESTADOS[k] : null;
    const e = email.toLowerCase();
    if (!out.has(e) || est === 'active' || est === 'trialing') out.set(e, est);
  }
  return out;
}
export function stripeFrenteApp(texto, atletas = []) {
  const stripe = leerStripe(texto);
  const app = new Map((atletas || []).filter((a) => a.email).map((a) => [String(a.email).toLowerCase(), a]));
  const sinAcceso = [], deBajaYDentro = [], impagados = [], sinStripe = [];
  for (const [email, est] of stripe) {
    const a = app.get(email);
    const activa = ['active', 'trialing'].includes(est);
    if (activa && (!a || a.estado === 'invitado')) sinAcceso.push({ email, nombre: a?.nombre || null, motivo: a ? 'no ha activado su cuenta' : 'no tiene ficha en la app' });
    if (['canceled', 'cancelled', 'incomplete_expired'].includes(est) && a && a.estado !== 'baja') deBajaYDentro.push({ email, nombre: a.nombre });
    if (['past_due', 'unpaid'].includes(est) && a) impagados.push({ email, nombre: a.nombre });
  }
  for (const [email, a] of app) if (!stripe.has(email) && a.estado !== 'baja') sinStripe.push({ email, nombre: a.nombre });
  return { leidas: stripe.size, sinAcceso, deBajaYDentro, impagados, sinStripe };
}

// ---------- (92) ¿Por qué te vas? (la lista vive con las respuestas: la usa también la hoja del atleta) ----------
export { MOTIVOS_BAJA };

// ---------- (97) El tope de avisos: cuántos le quedan hoy y esta semana ----------
// enviados: fechas 'AAAA-MM-DD' de sus avisos automáticos de FBE Esencial; tope: { dia: bool, semana: n | null }
export function topeAlcanzado(enviados = [], hoy, tope = {}) {
  const lunes = lunesDe(hoy);
  if (tope.dia && enviados.filter((d) => d === hoy).length >= 1) return 'dia';
  if (Number(tope.semana) > 0 && enviados.filter((d) => d >= lunes && d <= hoy).length >= Number(tope.semana)) return 'semana';
  return null;
}
