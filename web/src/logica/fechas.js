// Fechas en hora local, como cadenas ISO 'YYYY-MM-DD' (las que guarda Postgres en columnas date).

const pad = (n) => String(n).padStart(2, '0');

export function aISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function desdeISO(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function hoyISO(ahora = new Date()) {
  return aISO(ahora);
}

export function sumarDias(iso, n) {
  const d = desdeISO(iso);
  d.setDate(d.getDate() + n);
  return aISO(d);
}

// Lunes de la semana de una fecha (semana ISO: empieza en lunes).
export function lunesDe(iso) {
  const d = desdeISO(iso);
  const dia = (d.getDay() + 6) % 7; // 0 = lunes
  d.setDate(d.getDate() - dia);
  return aISO(d);
}

export function diasEntre(desde, hasta) {
  return Math.round((desdeISO(hasta) - desdeISO(desde)) / 864e5);
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function fmtCorta(iso) {
  const d = desdeISO(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

export function fmtConDia(iso) {
  const d = desdeISO(iso);
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`;
}

// "hoy", "ayer", "hace 3 días", "hace 2 semanas"
export function hace(iso, hoy = hoyISO()) {
  const n = diasEntre(iso, hoy);
  if (n <= 0) return 'hoy';
  if (n === 1) return 'ayer';
  if (n < 14) return `hace ${n} días`;
  return `hace ${Math.floor(n / 7)} semanas`;
}

export function rangoSemana(lunes) {
  const fin = sumarDias(lunes, 6);
  const a = desdeISO(lunes), b = desdeISO(fin);
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${MESES[b.getMonth()]}`
    : `${fmtCorta(lunes)} – ${fmtCorta(fin)}`;
}

// La semana a la que corresponde el check-in de hoy: el lunes todavía es el de la semana que acaba de terminar
// (se hace el domingo o el lunes); el resto de días, el de la semana en curso.
export function semanaCheckin(hoy = hoyISO()) {
  return new Date(`${hoy}T12:00:00`).getDay() === 1 ? sumarDias(lunesDe(hoy), -7) : lunesDe(hoy);
}
// Días en los que se recuerda el check-in pendiente: de viernes a lunes
export const diaDeCheckin = (fecha = new Date()) => [5, 6, 0, 1].includes(fecha.getDay());
