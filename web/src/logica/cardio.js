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
const CLAVES_PAUTA = ['modalidad', 'minutos', 'km', 'esfuerzo', 'nota'];
const CLAVES_HECHO = ['modalidad', 'minutos', 'km'];

const esObjeto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const minutosOk = (m) => typeof m === 'number' && Number.isInteger(m) && m >= 1 && m <= 600;
const kmOk = (k) => typeof k === 'number' && Number.isFinite(k) && k > 0 && k <= 200;

export function cardioValido(c) {
  if (!esObjeto(c) || Object.keys(c).some((k) => !CLAVES_PAUTA.includes(k))) return false;
  if (!Object.hasOwn(NOMBRE_MODALIDAD, c.modalidad)) return false;
  if (!('minutos' in c) && !('km' in c)) return false;
  if ('minutos' in c && !minutosOk(c.minutos)) return false;
  if ('km' in c && !kmOk(c.km)) return false;
  if ('esfuerzo' in c && !(typeof c.esfuerzo === 'number' && c.esfuerzo >= 1 && c.esfuerzo <= 10)) return false;
  if ('nota' in c && !(typeof c.nota === 'string' && c.nota.length >= 1 && c.nota.length <= 300)) return false;
  return true;
}

export function cardioHechoValido(c) {
  if (!esObjeto(c) || Object.keys(c).some((k) => !CLAVES_HECHO.includes(k))) return false;
  if (!Object.hasOwn(NOMBRE_MODALIDAD, c.modalidad)) return false;
  if (!minutosOk(c.minutos)) return false;
  if ('km' in c && !kmOk(c.km)) return false;
  return true;
}

// De lo que se escribe en el editor (textos) a la pauta que se guarda, o null si está vacía.
// Devuelve { pauta, error }: el error dice qué falta, en palabras.
export function limpiarCardio({ modalidad = 'carrera', minutos = '', km = '', esfuerzo = null, nota = '' } = {}) {
  const m = leerNumero(String(minutos ?? ''));
  const k = leerNumero(String(km ?? ''));
  const p = { modalidad };
  if (m !== null) p.minutos = Math.round(m);
  if (k !== null) p.km = Math.round(k * 100) / 100;
  if (esfuerzo != null && esfuerzo !== '') p.esfuerzo = Number(esfuerzo);
  const n = String(nota ?? '').trim();
  if (n) p.nota = n.slice(0, 300);
  if (m === null && k === null && !n && (esfuerzo == null || esfuerzo === '')) return { pauta: null, error: null };
  if (m === null && k === null) return { pauta: null, error: 'Pon los minutos o los kilómetros (o los dos).' };
  if ('minutos' in p && !minutosOk(p.minutos)) return { pauta: null, error: 'Los minutos tienen que ir de 1 a 600.' };
  if ('km' in p && !kmOk(p.km)) return { pauta: null, error: 'Los kilómetros tienen que ir de 0,1 a 200.' };
  if (!cardioValido(p)) return { pauta: null, error: 'Revisa la pauta de cardio.' };
  return { pauta: p, error: null };
}

export function limpiarCardioHecho({ modalidad = 'carrera', minutos = null, km = null } = {}) {
  const h = { modalidad, minutos: minutos == null ? null : Math.round(Number(minutos)) };
  const k = km == null || km === '' ? null : Math.round(Number(km) * 100) / 100;
  if (k) h.km = k;
  return cardioHechoValido(h) ? h : null;
}

// «30 min de carrera a esfuerzo 6», «5 km de carrera», «45 min y 20 km de bici»
export function textoCardio(c) {
  if (!cardioValido(c)) return '';
  const partes = [];
  if (c.minutos) partes.push(`${c.minutos} min`);
  if (c.km) partes.push(`${num(c.km, c.km % 1 ? 1 : 0)} km`);
  let t = `${partes.join(' y ')} de ${VERBO[c.modalidad]}`;
  if (c.esfuerzo) t += ` a esfuerzo ${num(c.esfuerzo)}`;
  return t;
}

// «32 min, 5,2 km (6:09 min/km)»
export function textoCardioHecho(h) {
  if (!cardioHechoValido(h)) return '';
  const partes = [`${h.minutos} min`];
  if (h.km) partes.push(`${num(h.km, h.km % 1 ? 1 : 0)} km`);
  const r = ritmo(h.minutos, h.km, h.modalidad);
  return partes.join(', ') + (r ? ` (${r})` : '');
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
