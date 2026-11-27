// (vista 274, v0.277) Las cuentas del calendario de la casa (ui/atleta/CalendarioCasa.jsx). Fechas en 'AAAA-MM-DD'.

export const INICIALES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const dos = (n) => String(n).padStart(2, '0');

export const mesDe = (iso) => String(iso || '').slice(0, 7);
// 'diciembre de 2026'
export function nombreMes(mes) {
  const [a, m] = String(mes).split('-').map(Number);
  return m ? `${MESES[m - 1]} de ${a}` : '';
}
// 'lunes 7 de diciembre'
export function nombreDia(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}
// Los días de un mes, de lunes a domingo: delante, los huecos (null) hasta su primer día
export function diasDelMes(mes) {
  const [a, m] = String(mes).split('-').map(Number);
  if (!a || !m) return [];
  const n = new Date(a, m, 0).getDate();
  const blancos = (new Date(a, m - 1, 1).getDay() + 6) % 7;
  return [...Array(blancos).fill(null), ...Array.from({ length: n }, (_, i) => `${a}-${dos(m)}-${dos(i + 1)}`)];
}
// El mismo día n meses después (o antes); si ese mes no lo tiene, su último día
export function sumarMeses(iso, n) {
  const [a, m, d] = String(iso).split('-').map(Number);
  const t = new Date(a, m - 1 + n, 1);
  const ultimo = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  return `${t.getFullYear()}-${dos(t.getMonth() + 1)}-${dos(Math.min(d || 1, ultimo))}`;
}
// Un día dentro de los límites (o el límite más cercano)
export function dentro(d, min = null, max = null) {
  if (!d) return null;
  if (min && d < min) return min;
  if (max && d > max) return max;
  return d;
}
// Un tramo, al tocar un día: sin principio (o con el tramo ya hecho), empieza uno nuevo; con principio y sin final, el
// día es el final si va después (si va antes, es el nuevo principio)
export function elegirEnTramo({ desde = '', hasta = '' } = {}, d) {
  if (!desde || hasta) return { desde: d, hasta: '' };
  if (d < desde) return { desde: d, hasta: '' };
  return { desde, hasta: d };
}
