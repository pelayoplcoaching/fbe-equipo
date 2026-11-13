// Personalización (v0.104): lo que la app sabe de cada atleta para hablarle a él, sin pedirle nada nuevo, y lo poco que
// puede elegir (cómo quiere que le llamemos, su porqué, sus tres ejercicios, su música y su cumpleaños), más los
// mensajes que su coach deja escritos para los momentos importantes. Todo puro: sin red ni almacenamiento.
//   · limpiarPersonal / urlMusica / cumpleValido: lo que se guarda (igual que comprueba la migración 050)
//   · nombreSaludo, esCumple, porqueParaHoy: la bienvenida del día
//   · textoMensajeCoach: los mensajes del coach con {nombre}, {ejercicio} y {semanas}
//   · cifraObjetivo: la cifra que se pone delante en Progreso según su objetivo del cuestionario
//   · recuerdoProgreso: «En mayo: 60 kg × 8. Hoy: 75 kg × 8» al terminar una sesión
//   · recordAlAlcance: «Con 62,5 kg × 8 batirías tu récord», en la portada de la sesión
//   · semanaTipo / repartirComoSiempre: los días que suele entrenar y el plan de la semana ya relleno
import { e1rm, mejoresMarcas, tendenciaPeso, num, NOMBRE_GRUPO } from './calculos.js';
import { pesoTxt, pesoNum, etiquetaPeso, difVista, enLibras, vista, deVista, pasoLb } from './unidades.js';
import { sumarDias, diasEntre, desdeISO, lunesDe } from './fechas.js';
import { nombreDePila } from './bienvenida.js';
import { objetivosDe } from './cuestionario.js';

// ---------- Lo que elige el atleta ----------
export const LIMITES = { apodo: 30, porque: 140, musica: 300, mensaje: 400, favoritos: 3 };
// Las listas de música que se abren desde la portada: solo de estos sitios (la app no abre cualquier enlace)
const MUSICA = /^https:\/\/(open\.spotify\.com|spotify\.link|music\.apple\.com|music\.youtube\.com|(www\.|m\.)?youtube\.com|youtu\.be|music\.amazon\.(es|com)|(www\.)?deezer\.com|link\.deezer\.com|(www\.)?tidal\.com|listen\.tidal\.com)\/[^\s<>"']*$/i;
export function urlMusica(u) {
  const t = sinSeguimiento(String(u ?? '').trim());
  if (!t) return null;
  return t.length <= LIMITES.musica && MUSICA.test(t) ? t : false;
}
// (v0.107) Los enlaces que se comparten desde Spotify llevan quién los compartió (?si=…) y de dónde (utm_…): fuera
export function sinSeguimiento(t) {
  if (!/^https:\/\/open\.spotify\.com\//i.test(t)) return t;
  try {
    const u = new URL(t);
    for (const k of [...u.searchParams.keys()]) if (k === 'si' || k === 'context' || k.startsWith('utm_')) u.searchParams.delete(k);
    return u.toString().replace(/\?$/, '');
  } catch { return t; }
}
// (v0.107) En Spotify, la canción de récord tiene que ser una canción (open.spotify.com/{intl-xx/}track/…)
export const CANCION_SPOTIFY = /^https:\/\/open\.spotify\.com\/(intl-[a-z-]+\/)?track\//;
export function nombreMusica(u) {
  const h = (/^https:\/\/([^/]+)/i.exec(String(u || '')) || [])[1]?.toLowerCase() || '';
  return /spotify/.test(h) ? 'Spotify' : /apple/.test(h) ? 'Apple Music' : /youtu/.test(h) ? 'YouTube Music' : /amazon/.test(h) ? 'Amazon Music' : /deezer/.test(h) ? 'Deezer' : /tidal/.test(h) ? 'Tidal' : 'tu música';
}
const DIAS_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const cumpleValido = (mes, dia) => Number.isInteger(mes) && Number.isInteger(dia) && mes >= 1 && mes <= 12 && dia >= 1 && dia <= DIAS_MES[mes - 1];
const texto = (v, max) => {
  const t = String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : null;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Lo que el atleta guarda, limpio. Lanza un error con el motivo si algo no vale (la base lo rechazaría igual).
export function limpiarPersonal(p = {}) {
  const musica = urlMusica(p.musica_url);
  if (musica === false) throw new Error('Ese enlace no es de una lista de Spotify, Apple Music, YouTube Music, Amazon Music, Deezer o Tidal');
  const mes = p.cumple_mes == null || p.cumple_mes === '' ? null : Number(p.cumple_mes);
  const dia = p.cumple_dia == null || p.cumple_dia === '' ? null : Number(p.cumple_dia);
  if ((mes == null) !== (dia == null)) throw new Error('Para el cumpleaños hacen falta el día y el mes');
  if (mes != null && !cumpleValido(mes, dia)) throw new Error('Ese día no existe en ese mes');
  const cancion = urlMusica(p.cancion_url);
  if (cancion === false) throw new Error('Tu canción de récord tiene que ser un enlace de Spotify, Apple Music, YouTube Music, Amazon Music, Deezer o Tidal');
  if (cancion && /^https:\/\/open\.spotify\.com\//i.test(cancion) && !CANCION_SPOTIFY.test(cancion)) throw new Error('Para tu canción de récord, comparte una canción (no una lista)');
  const favoritos = [...new Set((Array.isArray(p.favoritos) ? p.favoritos : []).filter((x) => UUID.test(String(x))))];
  if (favoritos.length > LIMITES.favoritos) throw new Error(`Como mucho ${LIMITES.favoritos} ejercicios`);
  return { apodo: texto(p.apodo, LIMITES.apodo), porque: texto(p.porque, LIMITES.porque), favoritos, musica_url: musica, cancion_url: cancion, cumple_mes: mes, cumple_dia: dia };
}
export const personalVacio = (p) => !p || (!p.apodo && !p.porque && !p.favoritos?.length && !p.musica_url && !p.cancion_url && p.cumple_mes == null);

// ---------- La bienvenida del día ----------
export const nombreSaludo = (personal, nombre) => personal?.apodo || nombreDePila(nombre);
// ¿Es hoy su cumpleaños? (hoy en ISO, de Madrid). Quien nació el 29 de febrero lo celebra el 28 los años que no son bisiestos.
export function esCumple(personal, hoy) {
  const m = Number(personal?.cumple_mes), d = Number(personal?.cumple_dia);
  if (!cumpleValido(m, d) || !/^\d{4}-\d{2}-\d{2}$/.test(String(hoy || ''))) return false;
  const [a, mh, dh] = String(hoy).split('-').map(Number);
  const bisiesto = (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
  if (m === 2 && d === 29 && !bisiesto) return mh === 2 && dh === 28;
  return mh === m && dh === d;
}
// Su porqué sale cuando más falta hace: al volver tras cuatro días o más sin entrenar, o tras mucho tiempo
export function porqueParaHoy({ porque, ultimoDia = null, hoy, haceMucho = false } = {}) {
  if (!porque) return null;
  const dias = ultimoDia && hoy ? diasEntre(ultimoDia, hoy) : null;
  return haceMucho || (dias != null && dias >= 4) ? porque : null;
}
// El momento de la bienvenida para el mensaje del coach: el cumpleaños manda; si no, la vuelta tras una semana o más
export function momentoBienvenida({ cumple = false, ultimoDia = null, hoy, haceMucho = false, metaDias = null } = {}) {
  if (cumple) return 'cumple';
  const dias = ultimoDia && hoy ? diasEntre(ultimoDia, hoy) : null;
  if (haceMucho || (dias != null && dias >= 7)) return 'vuelta';
  // (personalización 2, tanda 2) a una semana (o menos) de su meta
  return metaDias != null && metaDias >= 0 && metaDias <= 7 ? 'meta' : null;
}

// ---------- Los mensajes del coach ----------
export const MOMENTOS_COACH = [
  ['record', 'Al batir un récord', '¡Ese récord en {ejercicio}, {nombre}! Así se hace.'],
  ['bloque', 'Al terminar un bloque', 'Bloque terminado, {nombre}. Lo que has construido estas semanas se queda: a por el siguiente.'],
  ['racha', 'En un hito de la racha', '{semanas} semanas seguidas, {nombre}. Esto ya es tuyo.'],
  ['vuelta', 'Al volver tras un parón', 'Qué bien verte de vuelta, {nombre}. Sin prisa: lo importante es haber vuelto.'],
  ['cumple', 'En su cumpleaños', '¡Feliz cumpleaños, {nombre}! Que este año venga cargado de récords.'],
  // (personalización 2, migración 066) su aniversario en el equipo y su meta, a una semana
  ['aniversario', 'En su aniversario en el equipo', '{tiempo} entrenando juntos, {nombre}. Gracias por la constancia: lo mejor está por venir.'],
  ['meta', 'Cuando falta una semana para su meta', 'Una semana para {meta}, {nombre}. Lo has trabajado: ahora, a disfrutarlo.'],
  // (personalización 2, tanda 4; migración 067)
  ['primera_vez', 'La primera vez que hace un ejercicio', 'Primera vez con {ejercicio}, {nombre}: sin prisa, la técnica primero. Luego me cuentas.'],
  ['viaje', 'Al volver al gimnasio tras un viaje', 'De vuelta en casa, {nombre}. Hoy, a coger el ritmo sin pasarte.'],
];
// (personalización 2, tanda 3; migración 067) los avisos del coach por zona, para quien dijo que le molesta
export const ZONAS_MOLESTIA = ['cuello', 'hombro', 'codo', 'muneca_mano', 'espalda_alta', 'zona_lumbar', 'cadera', 'rodilla', 'tobillo_pie'];
export const MOMENTO_VALIDO = new Set([...MOMENTOS_COACH.map(([k]) => k), ...ZONAS_MOLESTIA.map((z) => `molestia_${z}`)]);
export function textoMensajeCoach(plantilla, { nombre = '', ejercicio = '', semanas = '', tiempo = '', meta = '' } = {}) {
  const t = String(plantilla || '').trim();
  if (!t) return null;
  const vars = { nombre: String(nombre || '').trim(), ejercicio: String(ejercicio || '').trim(), semanas: semanas === '' || semanas == null ? '' : String(semanas), tiempo: String(tiempo || '').trim(), meta: String(meta || '').trim() };
  return t.replace(/\{(nombre|ejercicio|semanas|tiempo|meta)\}/g, (_, k) => vars[k])
    // (un «{tiempo}» al principio: con mayúscula)
    .replace(/^([a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1])/, (x) => x.toLocaleUpperCase('es'))
    // sin nombre, «, {nombre}» no deja una coma colgando
    .replace(/,\s*([!.?]|$)/g, '$1').replace(/^\s*,\s*/, '').replace(/\s{2,}/g, ' ').replace(/\s+([!.?,])/g, '$1').trim() || null;
}
// El de ese momento, de la lista que devuelve la base: [{ momento, texto }]
export const mensajeDe = (lista, momento) => (Array.isArray(lista) ? lista.find((m) => m?.momento === momento)?.texto : null) || null;

// ---------- La cifra de su objetivo (Progreso) ----------
// progreso: lo de api.progreso (ejercicios con su 1RM por semana, pesos, volumen); constancia: lo de api.constancia
export function cifraObjetivo({ cuestionario = null, progreso = null, constancia = null, salud = false, hoy } = {}) {
  const lista = objetivosDe(cuestionario);
  for (const o of lista) {
    const c = cifraDe(o, { progreso, constancia, salud, hoy });
    if (c) return { ...c, objetivo: o, otros: lista.filter((x) => x !== o) };
  }
  return null;
}
function cifraDe(o, { progreso, constancia, salud, hoy }) {
  if (o === 'fuerza' || o === 'rendimiento') {
    // El ejercicio con más historial que tenga al menos dos semanas con 1RM: lo de ahora frente a hace unas 8 semanas
    const ej = (progreso?.ejercicios || []).filter((e) => (e.puntos || []).length >= 2)[0];
    if (!ej) return null;
    const ultimo = ej.puntos[ej.puntos.length - 1];
    const limite = sumarDias(lunesDe(hoy), -7 * 8);
    const antes = [...ej.puntos].reverse().find((p) => p.semana <= limite) || ej.puntos[0];
    const cambio = Math.round((ultimo.valor - antes.valor) * 10) / 10;
    const semanas = Math.max(1, Math.round(diasEntre(antes.semana, ultimo.semana) / 7));
    return { titulo: o === 'fuerza' ? 'Ganar fuerza' : 'Rendir más', etiqueta: `${ej.nombre}: 1RM estimado`, cifra: pesoNum(ultimo.valor, 1), unidad: etiquetaPeso(),
      detalle: cambio > 0 ? `+${num(difVista(cambio))} ${etiquetaPeso()} en ${semanas} ${semanas === 1 ? 'semana' : 'semanas'}` : cambio < 0 ? `${num(difVista(cambio))} ${etiquetaPeso()} en ${semanas} ${semanas === 1 ? 'semana' : 'semanas'}` : `igual que hace ${semanas} ${semanas === 1 ? 'semana' : 'semanas'}`,
      sube: cambio > 0 ? true : cambio < 0 ? false : null };
  }
  if (o === 'musculo') {
    const v = progreso?.volumen;
    if (!v) return null;
    const total = (x) => Math.round(Object.values(x || {}).reduce((t, n) => t + n, 0));
    const ahora = total(v.estaSemana), antes = total(v.anterior);
    if (!ahora && !antes) return null;
    const top = Object.entries(v.estaSemana || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g, n]) => `${(NOMBRE_GRUPO[g] || g).toLowerCase()} ${num(Math.round(n * 2) / 2)}`);
    return { titulo: 'Ganar músculo', etiqueta: 'Series esta semana', cifra: String(ahora), unidad: ahora === 1 ? 'serie' : 'series',
      detalle: top.length ? `${top.join(', ')} · la anterior, ${antes}` : `la semana anterior, ${antes}`, sube: ahora > antes ? true : ahora < antes ? false : null };
  }
  if (o === 'perder_grasa') {
    if (!salud) return null;
    const t = tendenciaPeso(progreso?.pesos || []);
    if (t.length < 2) return null;
    const ult = t[t.length - 1];
    const ref = [...t].reverse().find((p) => diasEntre(p.fecha, ult.fecha) >= 28) || t[0];
    const dias = diasEntre(ref.fecha, ult.fecha);
    if (dias < 7) return null;
    const cambio = Math.round((ult.tendencia - ref.tendencia) * 10) / 10;
    const semanas = Math.round(dias / 7);
    return { titulo: 'Perder grasa', etiqueta: 'Tu peso (tendencia)', cifra: num(ult.tendencia, 1), unidad: 'kg',
      detalle: `${cambio > 0 ? '+' : ''}${num(cambio, 1)} kg en ${semanas} ${semanas === 1 ? 'semana' : 'semanas'}`, sube: cambio < 0 ? true : cambio > 0 ? false : null };
  }
  if (o === 'salud') {
    if (!constancia) return null;
    const r = constancia.racha || 0, n = constancia.semanasCompletas || 0;
    return { titulo: 'Salud y bienestar', etiqueta: 'Tu constancia', cifra: String(r), unidad: r === 1 ? 'semana completa' : 'semanas completas seguidas',
      detalle: `${n} ${n === 1 ? 'semana completa' : 'semanas completas'} en total`, sube: r > 0 ? true : null };
  }
  return null;
}

// ---------- «Hace seis meses…» (al terminar una sesión) ----------
// hoySeries: las series de la sesión de hoy; historial: todas las suyas. Busca cada ejercicio de hoy en una ventana de
// hace unos 6 meses (o 3, o un año) y devuelve el que más ha mejorado (por 1RM estimado), si es al menos un 2,5 %.
const VENTANAS = [['6 meses', 165, 200], ['3 meses', 80, 105], ['un año', 350, 385]];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function mejorSerie(lista) {
  let m = null;
  for (const s of lista) { const v = e1rm(s); if (v != null && (!m || v > m.v)) m = { s, v }; }
  return m;
}
export function recuerdoProgreso(hoySeries = [], historial = [], hoy) {
  const porEj = new Map();
  for (const s of hoySeries) if (s.ejercicio_id && Number(s.kg) > 0 && Number(s.reps) > 0) (porEj.get(s.ejercicio_id) || porEj.set(s.ejercicio_id, []).get(s.ejercicio_id)).push(s);
  let mejor = null;
  for (const [id, lista] of porEj) {
    const h = mejorSerie(lista);
    if (!h) continue;
    const pasadas = historial.filter((s) => s.ejercicio_id === id && s.fecha && Number(s.kg) > 0);
    for (const [cuando, desde, hasta] of VENTANAS) {
      const enVentana = pasadas.filter((s) => { const d = diasEntre(s.fecha, hoy); return d >= desde && d <= hasta; });
      const a = mejorSerie(enVentana);
      if (!a) continue;
      const pct = (h.v - a.v) / a.v;
      if (pct >= 0.025 && (!mejor || pct > mejor.pct)) {
        mejor = { ejercicio_id: id, ejercicio: lista[0].ejercicio || h.s.ejercicio || 'Ejercicio', hace: cuando, fecha: a.s.fecha, mes: MESES[desdeISO(a.s.fecha).getMonth()],
          antes: { kg: Number(a.s.kg), reps: Number(a.s.reps) }, hoy: { kg: Number(h.s.kg), reps: Number(h.s.reps) }, pct: Math.round(pct * 1000) / 10 };
      }
      break; // la ventana más cercana con datos es la que cuenta para este ejercicio
    }
  }
  return mejor;
}
export const textoSerieCorta = (x) => `${pesoTxt(x.kg, 2)} × ${x.reps}`;

// ---------- Récord al alcance (portada de la sesión) ----------
// Para cada ejercicio de hoy con unas repeticiones objetivo, la carga que batiría su mejor marca a esas repeticiones,
// si lo que ha hecho en las últimas 6 semanas dice que la tiene a mano (su 1RM estimado reciente llega al que pide).
const PASO_MANCUERNA = /mancuerna|kettlebell|pesa rusa|dumbbell/i;
export function recordAlAlcance(ejercicios = [], historial = [], hoy, { max = 2 } = {}) {
  const out = [];
  for (const e of ejercicios) {
    const id = e.ejercicio_id || e.ejercicio?.id;
    const reps = Number(e.reps_max ?? e.reps_min);
    if (!id || !Number.isInteger(reps) || reps < 1 || reps > 12) continue;
    const suyas = historial.filter((s) => s.ejercicio_id === id && s.fecha && s.fecha < hoy);
    if (suyas.length < 2) continue;
    const marca = mejoresMarcas(suyas)[id]?.kgPorReps?.[reps];
    if (!marca || !(marca.kg > 0)) continue;
    const nombre = e.ejercicio?.nombre || suyas[0].ejercicio || '';
    const paso = PASO_MANCUERNA.test(nombre) ? 2 : 2.5;
    // (v0.112: en libras, 5 lb más que su marca, que es lo que se carga con discos en libras)
    const kg = enLibras() ? deVista(vista(marca.kg) + pasoLb(vista(marca.kg))) : Math.round((marca.kg + paso) * 100) / 100;
    const rir = e.rir_objetivo != null ? Number(e.rir_objetivo) : e.rpe_objetivo != null ? Math.max(0, 10 - Number(e.rpe_objetivo)) : 1;
    const pide = e1rm({ kg, reps, rir });
    // lo reciente, solo con series que dicen cuánto costaron (sin RPE se supondría al fallo y saldría inflado)
    const recientes = suyas.filter((s) => diasEntre(s.fecha, hoy) <= 42 && ((s.rpe != null && s.rpe !== '') || (s.rir != null && s.rir !== '')));
    const tiene = Math.max(0, ...recientes.map((s) => e1rm(s) || 0));
    if (!pide || !tiene || tiene < pide * 0.98) continue;
    out.push({ id: e.id, ejercicio_id: id, ejercicio: nombre, kg, reps, antes: marca.kg, holgura: tiene / pide });
  }
  return out.sort((a, b) => b.holgura - a.holgura).slice(0, max);
}

// ---------- Su semana tipo (plan de la semana) ----------
// Los días de la semana (0 = lunes … 6 = domingo) en que suele entrenar: los que ha usado en al menos la mitad de las
// semanas en que entrenó, de las últimas `semanas`, ordenados. fechas: días en que entrenó (ISO). Hacen falta 3 semanas.
export function semanaTipo(fechas = [], hoy, { semanas = 8 } = {}) {
  const desde = sumarDias(lunesDe(hoy), -7 * semanas);
  const dias = [...new Set(fechas.filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(String(f)) && f >= desde && f < lunesDe(hoy)))];
  const conEntreno = new Set(dias.map((f) => lunesDe(f)));
  if (conEntreno.size < 3) return [];
  const cuenta = Array(7).fill(0);
  for (const f of dias) cuenta[(desdeISO(f).getDay() + 6) % 7]++;
  return cuenta.map((n, i) => [i, n]).filter(([, n]) => n >= conEntreno.size / 2).map(([i]) => i);
}
// Reparte las sesiones sin día en sus días de siempre (de hoy en adelante y libres), en orden. { idSesion: fechaISO }
// (desde y hasta: la semana del programa, si no va de lunes a domingo; los días de su semana tipo que caen dentro, en orden)
export function repartirComoSiempre({ sinDia = [], ocupados = [], lunes, hoy, dias = [], desde = null, hasta = null } = {}) {
  if (!lunes || !dias.length) return {};
  const ini = desde || lunes, fin = hasta || sumarDias(ini, 6);
  const fechas = [0, 7].flatMap((k) => dias.map((i) => sumarDias(lunesDe(ini), i + k))).filter((d) => d >= ini && d <= fin).sort();
  const libres = fechas.filter((d) => d >= hoy && !ocupados.includes(d));
  const out = {};
  sinDia.forEach((s, i) => { if (libres[i]) out[s.id] = libres[i]; });
  return out;
}
const NOMBRES_DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
export function textoDias(dias = []) {
  const n = dias.map((i) => NOMBRES_DIAS[i]).filter(Boolean);
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n.at(-1)}` : n[0] || '';
}
