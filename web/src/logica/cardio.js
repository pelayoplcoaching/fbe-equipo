// Cardio (v0.17): la pauta que escribe el coach en una sesión y lo que registra el atleta al terminar.
// Misma forma exacta que comprueba la base (migración 013): aquí se valida antes de enviar y se escribe en palabras.
import { num, leerNumero } from './calculos.js';
import { sumarDias } from './fechas.js';

export const MODALIDADES = [
  ['carrera', 'Carrera', 'correr'],
  ['andar', 'Andar', 'andar'],
  ['bici', 'Bici', 'bici'],
  ['eliptica', 'Elíptica', 'elíptica'],
  ['remo', 'Remo', 'remo'],
  ['nadar', 'Natación', 'nadar'],
  ['cuerda', 'Comba', 'comba'],
  ['otro', 'Otro', 'cardio'],
];
export const NOMBRE_MODALIDAD = Object.fromEntries(MODALIDADES.map(([v, t]) => [v, t]));
const VERBO = Object.fromEntries(MODALIDADES.map(([v, , x]) => [v, x]));
// (055, carrera) La pauta admite además el tipo de sesión, rangos, zona, ritmo, partes y si es opcional; lo hecho, los
// segundos, el desnivel, el semáforo y (solo con el consentimiento de datos de salud) la FC y el dolor.
const CLAVES_PAUTA = ['modalidad', 'minutos', 'km', 'esfuerzo', 'nota', 'tipo', 'minutos_max', 'km_max', 'zona', 'zona_hasta', 'ritmo', 'partes', 'opcional'];
export const CLAVES_PAUTA_013 = ['modalidad', 'minutos', 'km', 'esfuerzo', 'nota'];
const CLAVES_HECHO = ['modalidad', 'minutos', 'km', 'seg', 'desnivel', 'semaforo', 'fc_media', 'fc_max', 'dolor'];
export const CLAVES_HECHO_013 = ['modalidad', 'minutos', 'km'];
// Lo de salud de lo hecho (la FC, el dolor y cómo llegó): solo con su consentimiento; no sale de entre el atleta y su coach
export const CLAVES_HECHO_SALUD = ['fc_media', 'fc_max', 'dolor', 'semaforo'];
export const TIPOS_SESION_CARRERA = ['facil', 'calidad', 'larga', 'carrera', 'recuperacion', 'cross', 'test', 'tecnica'];
export const FASES_PARTE = ['calentar', 'bloque', 'strides', 'enfriar', 'libre'];
const CLAVES_PARTE = ['fase', 'reps', 'seg', 'm', 'zona', 'zona_hasta', 'ritmo', 'rec_seg', 'rec', 'nota'];

const esObjeto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const minutosOk = (m) => typeof m === 'number' && Number.isInteger(m) && m >= 1 && m <= 600;
const kmOk = (k) => typeof k === 'number' && Number.isFinite(k) && k > 0 && k <= 200;
const entero = (v, lo, hi) => v === undefined || (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi);
const texto = (v, n) => v === undefined || (typeof v === 'string' && v.length >= 1 && v.length <= n);
const zonasOk = (o) => entero(o.zona, 1, 5) && entero(o.zona_hasta, 1, 5) && (!('zona_hasta' in o) || ('zona' in o && o.zona_hasta >= o.zona));
export const ritmoValido = (v) => v === undefined || (Array.isArray(v) && v.length >= 1 && v.length <= 2 && v.every((x) => entero(x, 120, 900)));

export function parteValida(p) {
  if (!esObjeto(p) || Object.keys(p).some((k) => !CLAVES_PARTE.includes(k))) return false;
  if (!FASES_PARTE.includes(p.fase)) return false;
  if (!('seg' in p) && !('m' in p) && !('nota' in p)) return false;
  return entero(p.reps, 1, 50) && entero(p.seg, 5, 21600) && entero(p.m, 10, 100000) && zonasOk(p) && ritmoValido(p.ritmo)
    && entero(p.rec_seg, 0, 1800) && texto(p.rec, 40) && texto(p.nota, 200);
}

// Como cardio_pauta_valida (055): exigeVolumen = false para una sesión prevista en el plan
export function pautaValida(c, exigeVolumen = true) {
  if (!esObjeto(c) || Object.keys(c).some((k) => !CLAVES_PAUTA.includes(k))) return false;
  if (JSON.stringify(c).length > 6000) return false;
  if (!Object.hasOwn(NOMBRE_MODALIDAD, c.modalidad)) return false;
  if (exigeVolumen && !('minutos' in c) && !('km' in c) && !('partes' in c)) return false;
  if ('minutos' in c && !minutosOk(c.minutos)) return false;
  if ('km' in c && !kmOk(c.km)) return false;
  if ('esfuerzo' in c && !(typeof c.esfuerzo === 'number' && c.esfuerzo >= 1 && c.esfuerzo <= 10)) return false;
  if ('nota' in c && !(typeof c.nota === 'string' && c.nota.length >= 1 && c.nota.length <= 300)) return false;
  if ('tipo' in c && !TIPOS_SESION_CARRERA.includes(c.tipo)) return false;
  if ('minutos_max' in c && !(minutosOk(c.minutos_max) && 'minutos' in c && c.minutos_max > c.minutos)) return false;
  if ('km_max' in c && !(kmOk(c.km_max) && 'km' in c && c.km_max > c.km)) return false;
  if (!zonasOk(c) || !ritmoValido(c.ritmo)) return false;
  if ('partes' in c && !(Array.isArray(c.partes) && c.partes.length >= 1 && c.partes.length <= 12 && c.partes.every(parteValida))) return false;
  if ('opcional' in c && typeof c.opcional !== 'boolean') return false;
  return true;
}
export const cardioValido = (c) => pautaValida(c, true);

export function cardioHechoValido(c) {
  if (!esObjeto(c) || Object.keys(c).some((k) => !CLAVES_HECHO.includes(k))) return false;
  if (!Object.hasOwn(NOMBRE_MODALIDAD, c.modalidad)) return false;
  if (!minutosOk(c.minutos)) return false;
  if ('km' in c && !kmOk(c.km)) return false;
  if (!entero(c.seg, 0, 59) || !entero(c.desnivel, 0, 10000) || !entero(c.fc_media, 40, 230) || !entero(c.fc_max, 40, 240) || !entero(c.dolor, 0, 10)) return false;
  if ('fc_media' in c && 'fc_max' in c && c.fc_max < c.fc_media) return false;
  if ('semaforo' in c && !['verde', 'ambar', 'rojo'].includes(c.semaforo)) return false;
  return true;
}

// Lo hecho sin lo de salud (para la tarjeta que se comparte y todo lo que sale de entre el atleta y su coach)
export function cardioHechoPublico(h) {
  if (!cardioHechoValido(h)) return null;
  const out = {};
  for (const k of ['modalidad', 'minutos', 'km', 'seg', 'desnivel']) if (k in h) out[k] = h[k];
  return out;
}
// Para una base sin la 055: solo lo que entiende la 013
export const solo013 = (o, claves) => (esObjeto(o) ? Object.fromEntries(Object.entries(o).filter(([k]) => claves.includes(k))) : o);

// De lo que se escribe en el editor (textos) a la pauta que se guarda, o null si está vacía.
// Devuelve { pauta, error }: el error dice qué falta, en palabras.
export function limpiarCardio({ modalidad = 'carrera', minutos = '', km = '', esfuerzo = null, nota = '', carrera = null } = {}) {
  const m = leerNumero(String(minutos ?? ''));
  const k = leerNumero(String(km ?? ''));
  const p = { modalidad };
  if (m !== null) p.minutos = Math.round(m);
  if (k !== null) p.km = Math.round(k * 100) / 100;
  if (esfuerzo != null && esfuerzo !== '') p.esfuerzo = Number(esfuerzo);
  const n = String(nota ?? '').trim();
  if (n) p.nota = n.slice(0, 300);
  // (055) lo de carrera: tipo, rangos, zona, ritmo, partes y opcional (ya limpio, de logica/carrera.js)
  const conPartes = !!(carrera && Array.isArray(carrera.partes) && carrera.partes.length);
  if (carrera && modalidad === 'carrera') {
    for (const c of ['tipo', 'zona', 'zona_hasta', 'ritmo', 'partes']) if (carrera[c] != null && !(Array.isArray(carrera[c]) && !carrera[c].length)) p[c] = carrera[c];
    if (carrera.opcional) p.opcional = true;
    const mm = leerNumero(String(carrera.minutos_max ?? ''));
    const kk = leerNumero(String(carrera.km_max ?? ''));
    if (mm !== null && 'minutos' in p && Math.round(mm) > p.minutos) p.minutos_max = Math.round(mm);
    if (kk !== null && 'km' in p && Math.round(kk * 100) / 100 > p.km) p.km_max = Math.round(kk * 100) / 100;
  }
  if (m === null && k === null && !n && (esfuerzo == null || esfuerzo === '') && !conPartes) return { pauta: null, error: null };
  if (m === null && k === null && !conPartes) return { pauta: null, error: 'Pon los minutos o los kilómetros (o los dos).' };
  if ('minutos' in p && !minutosOk(p.minutos)) return { pauta: null, error: 'Los minutos tienen que ir de 1 a 600.' };
  if ('km' in p && !kmOk(p.km)) return { pauta: null, error: 'Los kilómetros tienen que ir de 0,1 a 200.' };
  if (!cardioValido(p)) return { pauta: null, error: 'Revisa la pauta de cardio.' };
  return { pauta: p, error: null };
}

export function limpiarCardioHecho({ modalidad = 'carrera', minutos = null, km = null, seg = null, desnivel = null, semaforo = null, fc_media = null, fc_max = null, dolor = null } = {}) {
  const h = { modalidad, minutos: minutos == null ? null : Math.round(Number(minutos)) };
  const k = km == null || km === '' ? null : Math.round(Number(km) * 100) / 100;
  if (k) h.km = k;
  const ent = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Math.round(Number(v)));
  if (ent(seg)) h.seg = ent(seg);
  if (ent(desnivel) != null && ent(desnivel) > 0) h.desnivel = ent(desnivel);
  if (semaforo) h.semaforo = semaforo;
  if (ent(fc_media) != null) h.fc_media = ent(fc_media);
  if (ent(fc_max) != null) h.fc_max = ent(fc_max);
  if (ent(dolor) != null) h.dolor = ent(dolor);
  return cardioHechoValido(h) ? h : null;
}

// «30 min de carrera a esfuerzo 6», «5 km de carrera», «45 min y 20 km de bici»
const kmTxt = (k) => num(k, k % 1 ? 1 : 0);
export const NOMBRE_TIPO_CARRERA = { facil: 'fácil', calidad: 'de calidad', larga: 'larga', carrera: 'de competición', recuperacion: 'de recuperación', cross: 'cruzada', test: 'test', tecnica: 'de técnica' };
export function textoCardio(c) {
  if (!cardioValido(c)) return '';
  const partes = [];
  if (c.minutos) partes.push(c.minutos_max ? `${c.minutos}–${c.minutos_max} min` : `${c.minutos} min`);
  if (c.km) partes.push(c.km_max ? `${kmTxt(c.km)}–${kmTxt(c.km_max)} km` : `${kmTxt(c.km)} km`);
  const verbo = c.modalidad !== 'carrera' || !c.tipo ? VERBO[c.modalidad] : c.tipo === 'larga' ? 'tirada larga' : c.tipo === 'test' ? 'test de carrera' : 'carrera';
  let t = partes.length ? `${partes.join(' y ')} de ${verbo}` : c.modalidad === 'carrera' ? `Sesión de carrera${c.tipo ? ` ${NOMBRE_TIPO_CARRERA[c.tipo]}` : ''}` : `Sesión de ${verbo}`;
  if (partes.length && c.modalidad === 'carrera' && c.tipo && !['larga', 'test'].includes(c.tipo)) t += ` ${NOMBRE_TIPO_CARRERA[c.tipo]}`;
  if (c.zona) t += ` en Z${c.zona}${c.zona_hasta && c.zona_hasta !== c.zona ? `–Z${c.zona_hasta}` : ''}`;
  if (c.esfuerzo) t += ` a esfuerzo ${num(c.esfuerzo)}`;
  if (c.opcional) t += ' (opcional)';
  return t;
}

// «32 min, 5,2 km (6:09 min/km)»
// (055) Sin lo de salud: la FC y el dolor van aparte (textoSaludCardio), solo para el atleta y su coach
export function textoCardioHecho(h) {
  if (!cardioHechoValido(h)) return '';
  const partes = [h.seg ? `${h.minutos}:${String(h.seg).padStart(2, '0')} min` : `${h.minutos} min`];
  if (h.km) partes.push(`${num(h.km, h.km % 1 ? 1 : 0)} km`);
  if (h.desnivel) partes.push(`+${h.desnivel} m`);
  const r = ritmo(h.minutos + (h.seg || 0) / 60, h.km, h.modalidad);
  return partes.join(', ') + (r ? ` (${r})` : '');
}
// «FC media 158, máx. 176 · dolor 2/10»
export function textoSaludCardio(h) {
  if (!cardioHechoValido(h)) return '';
  const fc = h.fc_media && h.fc_max ? `FC media ${h.fc_media}, máx. ${h.fc_max}` : h.fc_media ? `FC media ${h.fc_media}` : h.fc_max ? `FC máx. ${h.fc_max}` : '';
  return [fc, h.dolor != null ? `dolor ${h.dolor}/10` : ''].filter(Boolean).join(' · ');
}

// Ritmo en min/km (carrera, andar) o km/h (bici y demás)
export function ritmo(minutos, km, modalidad = 'carrera') {
  if (!minutos || !km) return '';
  if (['bici', 'eliptica', 'remo', 'otro', 'cuerda'].includes(modalidad)) return `${num((km / minutos) * 60, 1)} km/h`;
  const segPorKm = Math.round((minutos * 60) / km);
  return `${Math.floor(segPorKm / 60)}:${String(segPorKm % 60).padStart(2, '0')} min/km`;
}

// Esfuerzo objetivo en palabras (como se le explica al atleta)
export function palabrasEsfuerzo(e) {
  if (e == null) return '';
  if (e <= 4) return 'muy suave: puedes hablar con frases largas';
  if (e <= 6) return 'suave: puedes hablar, pero no cantar';
  if (e <= 7) return 'moderado: frases cortas';
  if (e <= 8) return 'fuerte: solo palabras sueltas';
  return 'muy fuerte: no puedes hablar';
}

// Lo hecho de cardio en una sesión: su registro o, en una sesión de cardio de antes de la v0.17 (sin registro),
// su duración; null si no hay cardio. La misma regla en Progreso, «Tu semana» y el informe.
export function cardioHechoDe(s) {
  if (!s || !s.completada) return null;
  if (cardioHechoValido(s.cardio_hecho)) return s.cardio_hecho;
  if (s.tipo === 'cardio' && Number(s.duracion_min) > 0) return { minutos: Number(s.duracion_min) };
  return null;
}

// Cardio por semana (minutos y km) a partir de las sesiones hechas. semanas: [{ lunes }]; sesiones con
// fecha_realizada, cardio_hecho (o, si no lo hay y es de tipo cardio, duracion_min).
export function cardioPorSemana(sesiones, lunes) {
  return lunes.map((l) => {
    const fin = sumarDias(l, 6);
    const de = sesiones.filter((s) => s.completada && s.fecha_realizada && s.fecha_realizada >= l && s.fecha_realizada <= fin);
    let minutos = 0, km = 0, n = 0;
    for (const s of de) {
      const h = cardioHechoDe(s);
      if (!h) continue;
      n++; minutos += h.minutos; km += h.km || 0;
    }
    return { lunes: l, minutos, km: Math.round(km * 10) / 10, sesiones: n };
  });
}
