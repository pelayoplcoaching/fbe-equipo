// Integraciones (v0.105, migración 051): Salud del iPhone por la app Atajos, el calendario que se actualiza solo y
// WhatsApp. Lógica pura: la usan la app y la función «integraciones» de Supabase (la misma limpieza en los dos sitios).
import { sumarDias, hoyISO, diasEntre, fechaMadrid } from './fechas.js';

// Los nombres de los dos atajos (el atleta los instala con estos nombres; la app los llama por el nombre)
export const ATAJO_SALUD = 'FBE Salud';
export const ATAJO_ENTRENO = 'FBE a Salud';
export const URL_ATAJO = /^https:\/\/www\.icloud\.com\/shortcuts\/[0-9A-Za-z]{16,64}$/;
export const ENLACE = /^[0-9a-f]{64}$/;
// (revisión) Ningún valor de verdad es más largo: un texto enorme y raro dejaba las expresiones de abajo segundos pensando
export const LARGO_VALOR = 32;

// ---------------------------------------------------------------- números y fechas como los manda Atajos
// Atajos escribe los números como el iPhone: en español, «8.432» son ocho mil y «72,5» es una coma decimal. A veces con
// la unidad detrás («72,5 kg», «8.432 recuento»). Con entero: true, «8.432» y «8,432» son 8432 (los pasos nunca llevan decimales).
export function numero(v, { entero = false } = {}) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string' || v.length > LARGO_VALOR) return null;
  const m = v.trim().replace(/ | /g, ' ').match(/^[+-]?\d[\d.,' ]*/);
  if (!m) return null;
  let t = m[0].replace(/[' ]/g, '');
  const punto = t.lastIndexOf('.'), coma = t.lastIndexOf(',');
  if (punto >= 0 && coma >= 0) {
    // los dos: el último es el decimal
    t = punto > coma ? t.replace(/,/g, '') : t.replace(/\./g, '').replace(',', '.');
  } else if (punto >= 0 || coma >= 0) {
    const sep = punto >= 0 ? '.' : ',';
    const grupos = new RegExp(`^[+-]?\\d{1,3}(\\${sep}\\d{3})+$`).test(t);
    if (grupos && (entero || t.split(sep).length > 2)) t = t.split(sep).join('');
    else if (sep === ',') t = t.replace(',', '.');
    if (t.split('.').length > 2) return null;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// El sueño: en minutos (número), «7 h 32 min», «7:32», «7,5 h», en horas si es un número pequeño (≤ 24) o en segundos si es grande
export function minutosSueno(v, { horas = false } = {}) {
  if (v == null || v === '') return null;
  if (typeof v === 'string') {
    if (v.length > LARGO_VALOR) return null;
    const s = v.trim().toLowerCase();
    const hm = s.match(/^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?$/);
    if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
    const h = s.match(/(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hora|horas)\b/);
    const mi = s.match(/(\d+)\s*(min|mins|minutos|m)\b/);
    if (h || mi) return Math.round((h ? numero(h[1]) * 60 : 0) + (mi ? Number(mi[1]) : 0));
  }
  const n = numero(v);
  if (n == null) return null;
  // Más de 18 h no puede ser en minutos: son segundos (lo que da Atajos al sumar las duraciones)
  return Math.round(horas || n <= 24 ? n * 60 : n > 1080 ? n / 60 : n);
}

// Una fecha: «2026-11-08», «2026-11-08T07:00:00+01:00», «8/11/2026» o «08-11-2026». Si no se entiende, null.
export function fechaDe(v) {
  if (typeof v !== 'string' || v.length > LARGO_VALOR) return null;
  const s = v.trim();
  let a, m, d;
  let r = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (r) [, a, m, d] = r;
  else if ((r = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/))) [, d, m, a] = r;
  else return null;
  const iso = `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const f = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(f.getTime()) && f.toISOString().slice(0, 10) === iso ? iso : null;
}

const RANGOS = { pasos: [0, 100000], sueno_min: [1, 1080], fc_reposo: [25, 150], hrv: [1, 300], peso_kg: [25, 350] };
const enRango = (k, n) => (n != null && n >= RANGOS[k][0] && n <= RANGOS[k][1] ? n : null);
const red = (n, dec) => (n == null ? null : Math.round(n * 10 ** dec) / 10 ** dec);

// Lo que manda el atajo, limpio: [{ fecha, pasos, sueno_min, fc_reposo, hrv, peso_kg }] (de los 60 últimos días, hasta
// 31, uno por fecha). Vale un día ({ … }), varios ([…] o { dias: […] }) y nombres en inglés (steps, sleep, weight…).
// «pasos_ayer» va al día anterior a «fecha» (el atajo de la mañana manda los pasos de ayer y el sueño de esta noche).
export function limpiarSalud(cuerpo, hoy = hoyISO()) {
  let lista = Array.isArray(cuerpo) ? cuerpo : cuerpo && typeof cuerpo === 'object' ? (Array.isArray(cuerpo.dias) ? cuerpo.dias : [cuerpo]) : [];
  lista = lista.slice(0, 62);
  const porFecha = new Map();
  const poner = (fecha, k, n) => {
    if (n == null || !fecha || fecha < sumarDias(hoy, -60) || fecha > sumarDias(hoy, 1)) return;
    const d = porFecha.get(fecha) || { fecha };
    d[k] = k === 'pasos' ? Math.max(d.pasos ?? 0, n) : n;
    porFecha.set(fecha, d);
  };
  for (const x of lista) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) continue;
    const fecha = x.fecha != null || x.date != null ? fechaDe(String(x.fecha ?? x.date)) : hoy;
    if (!fecha) continue;
    const pasos = enRango('pasos', red(numero(x.pasos ?? x.steps, { entero: true }), 0));
    const ayer = enRango('pasos', red(numero(x.pasos_ayer ?? x.steps_yesterday, { entero: true }), 0));
    const sueno = enRango('sueno_min', x.sueno_h != null || x.sleep_h != null ? minutosSueno(x.sueno_h ?? x.sleep_h, { horas: true })
      : minutosSueno(x.sueno_min ?? x.sueno ?? x.sleep_min ?? x.sleep));
    const fc = enRango('fc_reposo', red(numero(x.fc_reposo ?? x.resting_hr ?? x.fc), 0));
    const hrv = enRango('hrv', red(numero(x.hrv), 1));
    const peso = enRango('peso_kg', red(numero(x.peso_kg ?? x.peso ?? x.weight), 2));
    poner(fecha, 'pasos', pasos);
    poner(sumarDias(fecha, -1), 'pasos', ayer);
    poner(fecha, 'sueno_min', sueno);
    poner(fecha, 'fc_reposo', fc);
    poner(fecha, 'hrv', hrv);
    poner(fecha, 'peso_kg', peso);
  }
  return [...porFecha.values()].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 31);
}

// ---------------------------------------------------------------- direcciones
const sinBarra = (u) => String(u || '').replace(/\/+$/, '');
export const urlFuncion = (base) => (base ? `${sinBarra(base)}/functions/v1/integraciones` : null);
export function urlSalud(base, enlace) {
  return base && ENLACE.test(enlace || '') ? `${urlFuncion(base)}/salud?t=${enlace}` : null;
}
// El calendario: https (para copiar), webcal (el iPhone y el Mac se suscriben al tocarlo) y Google Calendar
export function urlsCalendario(base, enlace) {
  if (!base || !ENLACE.test(enlace || '')) return null;
  const https = `${urlFuncion(base)}/calendario?t=${enlace}`;
  const webcal = https.replace(/^https:\/\//, 'webcal://');
  return { https, webcal, google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}` };
}

// El atajo que apunta el entreno en Salud, con lo de esta sesión (lo lee como diccionario)
export function tipoSalud(sesion = {}) {
  if (sesion.tipo === 'movilidad') return 'flexibilidad';
  if (sesion.tipo !== 'cardio') return 'fuerza';
  const m = String(sesion.modalidad || sesion.cardio?.modalidad || '').toLowerCase();
  return { carrera: 'carrera', correr: 'carrera', bici: 'bici', ciclismo: 'bici', remo: 'remo', eliptica: 'eliptica', natacion: 'natacion', caminar: 'caminar', andar: 'caminar' }[m] || 'cardio';
}
export function urlAtajoEntreno({ nombre = '', minutos = null, fin = new Date(), tipo = 'fuerza' } = {}) {
  const min = Math.max(1, Math.min(600, Math.round(Number(minutos) || 60)));
  const finD = fin instanceof Date ? fin : new Date(fin);
  const inicio = new Date(finD.getTime() - min * 60000);
  const datos = { nombre: String(nombre).slice(0, 80), tipo, minutos: min, inicio: inicio.toISOString(), fin: finD.toISOString() };
  return `shortcuts://run-shortcut?name=${encodeURIComponent(ATAJO_ENTRENO)}&input=text&text=${encodeURIComponent(JSON.stringify(datos))}`;
}

// ---------------------------------------------------------------- WhatsApp
// El teléfono como lo quiere wa.me: solo cifras, con el prefijo del país (un móvil español de 9 cifras, con el 34)
export function telefonoWa(t) {
  let s = String(t || '').replace(/[\s().-]/g, '');
  if (!s) return null;
  if (s.startsWith('00')) s = s.slice(2);
  else if (s.startsWith('+')) s = s.slice(1);
  else if (/^[6789]\d{8}$/.test(s)) s = `34${s}`;
  return /^\d{8,15}$/.test(s) ? s : null;
}
export function limpiarTelefono(t) {
  const s = String(t || '').replace(/[\s().-]/g, '');
  if (!s) return '';
  const n = s.startsWith('00') ? `+${s.slice(2)}` : s;
  if (!/^\+?\d{6,15}$/.test(n)) throw new Error('Escribe el teléfono con cifras (con el prefijo si no es de España)');
  return n;
}
export function enlaceWhatsApp(telefono, texto = '') {
  const n = telefonoWa(telefono);
  const t = String(texto || '').trim();
  return `https://wa.me/${n || ''}${t ? `?text=${encodeURIComponent(t)}` : ''}`;
}

// ---------------------------------------------------------------- lo que llegó de Salud, para la app
const media = (xs) => (xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : null);
export function horasSuenoTramo(min) {
  if (min == null) return null;
  const h = min / 60;
  return h < 5 ? '<5' : h < 6 ? '5-6' : h < 7 ? '6-7' : h < 8 ? '7-8' : '>8';
}
// La semana del check-in (de lunes a domingo, sin hoy si aún no ha acabado): medias de lo que llegó y el último peso
export function semanaSalud(dias = [], lunes, hoy = hoyISO()) {
  const enSemana = (dias || []).filter((d) => d.fecha >= lunes && d.fecha <= sumarDias(lunes, 6) && d.fecha <= hoy);
  const de = (k, cond = () => true) => enSemana.filter((d) => d[k] != null && cond(d)).map((d) => Number(d[k]));
  // los pasos de hoy aún no están completos
  const pasos = de('pasos', (d) => d.fecha < hoy);
  const sueno = de('sueno_min'), fc = de('fc_reposo'), hrv = de('hrv');
  const conPeso = enSemana.filter((d) => d.peso_kg != null).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const r = {
    pasos_media: pasos.length ? Math.round(media(pasos) / 10) * 10 : null, dias_pasos: pasos.length,
    sueno_min: sueno.length ? Math.round(media(sueno)) : null, dias_sueno: sueno.length,
    horas_sueno: horasSuenoTramo(sueno.length ? media(sueno) : null),
    fc_reposo: fc.length ? Math.round(media(fc)) : null, hrv: hrv.length ? red(media(hrv), 0) : null,
    peso: conPeso.length ? Number(conPeso[0].peso_kg) : null, peso_fecha: conPeso[0]?.fecha || null,
  };
  r.hay = [r.pasos_media, r.sueno_min, r.fc_reposo, r.hrv, r.peso].some((x) => x != null);
  return r;
}

// Para la ficha del coach: la media de los 7 últimos días y la de los 7 anteriores
export function resumenSalud(dias = [], hoy = hoyISO()) {
  const tramo = (desde, hasta) => {
    const ds = (dias || []).filter((d) => d.fecha >= desde && d.fecha <= hasta);
    const m = (k, dec = 0) => { const xs = ds.filter((d) => d[k] != null && !(k === 'pasos' && d.fecha >= hoy)).map((d) => Number(d[k])); return xs.length ? red(media(xs), dec) : null; };
    return { pasos: m('pasos'), sueno_min: m('sueno_min'), fc_reposo: m('fc_reposo'), hrv: m('hrv'), peso_kg: m('peso_kg', 1), dias: ds.length };
  };
  return { ultimos: tramo(sumarDias(hoy, -6), hoy), anteriores: tramo(sumarDias(hoy, -13), sumarDias(hoy, -7)) };
}

export const textoSueno = (min) => (min == null ? '—' : `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')}`);

// «hoy», «ayer», «hace 3 días» (para «Último envío»)
export function haceDias(iso, hoy = hoyISO()) {
  if (!iso) return null;
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(String(iso)) ? String(iso) : fechaMadrid(new Date(iso));
  const n = diasEntre(dia, hoy);
  return n <= 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} días`;
}
