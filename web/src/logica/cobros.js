// Control de cobros (v0.24, migración 020): solo para el coach. Lo acordado con cada atleta (servicio, precio al
// mes y cada cuánto paga) y sus cobros, uno por periodo, con el importe guardado tal cual. Se lleva a mano.
import { hoyISO, sumarDias, diasEntre } from './fechas.js';

export const CICLOS = [['mensual', 'Mensual', 1], ['trimestral', 'Trimestral', 3], ['semestral', 'Semestral', 6], ['anual', 'Anual', 12]];
export const MESES_CICLO = Object.fromEntries(CICLOS.map(([v, , m]) => [v, m]));
export const NOMBRE_CICLO = Object.fromEntries(CICLOS.map(([v, t]) => [v, t]));
export const ESTADOS_PAGO = [['pendiente', 'Pendiente'], ['retrasado', 'Retrasado'], ['pagado', 'Pagado']];
export const NOMBRE_ESTADO_PAGO = Object.fromEntries(ESTADOS_PAGO);
export const METODOS = [['transferencia', 'Transferencia'], ['efectivo', 'Efectivo'], ['bizum', 'Bizum'], ['tarjeta', 'Tarjeta'], ['otro', 'Otro']];
export const NOMBRE_METODO = Object.fromEntries(METODOS);
// Tu tarifa de servicios (precio de lista al mes); luego cada atleta lleva su precio
export const SERVICIOS = [['Essential', 49], ['Performance', 89], ['Complete', 109], ['Elite', 149], ['Elite Plus', 249], ['Gratuito', 0]];

const pad = (n) => String(n).padStart(2, '0');

// El mismo día, n meses después (si ese mes no tiene ese día, el último del mes: 31 ene + 1 mes = 28 feb)
export function sumarMeses(iso, n) {
  const [a, m, d] = iso.split('-').map(Number);
  const total = a * 12 + (m - 1) + n;
  const anio = Math.floor(total / 12), mes = (total % 12) + 1;
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return `${anio}-${pad(mes)}-${pad(Math.min(d, ultimo))}`;
}

// El último día del periodo que empieza en «desde»: 20 jul trimestral → 19 oct; 1 nov mensual → 30 nov
export const finPeriodo = (desde, ciclo = 'mensual') => sumarDias(sumarMeses(desde, MESES_CICLO[ciclo] || 1), -1);

// Lo que toca cobrar por periodo
export function importePeriodo(acuerdo) {
  if (acuerdo?.precio_mes == null) return null;
  return Math.round(Number(acuerdo.precio_mes) * (MESES_CICLO[acuerdo.ciclo] || 1) * 100) / 100;
}

// El siguiente periodo: el primero que empieza después del último apuntado, contando siempre desde el día en que
// empezó a pagar (así un 31 no se queda en 28 para siempre); sin acuerdo, justo después del último; sin nada, hoy
export function siguientePeriodo(pagos = [], acuerdo = null, hoy = hoyISO()) {
  const ciclo = acuerdo?.ciclo || 'mensual';
  const m = MESES_CICLO[ciclo] || 1;
  const ultimo = [...pagos].sort((a, b) => (a.periodo_hasta < b.periodo_hasta ? 1 : -1))[0];
  const ancla = acuerdo?.desde || null;
  let desde;
  if (!ultimo) desde = ancla || hoy;
  else if (!ancla) desde = sumarDias(ultimo.periodo_hasta, 1);
  else {
    let k = 0;
    while (sumarMeses(ancla, k * m) <= ultimo.periodo_hasta && k < 1200) k++;
    desde = sumarMeses(ancla, k * m);
    return { desde, hasta: sumarDias(sumarMeses(ancla, (k + 1) * m), -1), importe: importePeriodo(acuerdo) };
  }
  return { desde, hasta: finPeriodo(desde, ciclo), importe: importePeriodo(acuerdo) };
}

// Cómo va un atleta: hasta cuándo tiene pagado, lo que debe y una etiqueta para la lista
export function resumenCobros(pagos = [], hoy = hoyISO()) {
  const pagados = pagos.filter((p) => p.estado === 'pagado');
  const debidos = pagos.filter((p) => p.estado !== 'pagado' && p.periodo_desde <= hoy);
  const pagadoHasta = pagados.length ? pagados.map((p) => p.periodo_hasta).sort().pop() : null;
  const debe = Math.round(debidos.reduce((t, p) => t + Number(p.importe || 0), 0) * 100) / 100;
  let estado;
  if (!pagos.length) estado = 'sin_datos';
  else if (debidos.some((p) => p.estado === 'retrasado')) estado = 'retrasado';
  else if (debidos.length) estado = 'pendiente';
  else if (!pagadoHasta) estado = 'primer_cobro';
  else if (pagadoHasta < hoy) estado = 'vencido';
  else if (diasEntre(hoy, pagadoHasta) < 7) estado = 'vence_pronto';
  else estado = 'al_dia';
  return { pagadoHasta, debe, pendientes: debidos.length, estado };
}
export const TEXTO_ESTADO_COBRO = {
  sin_datos: 'Sin cobros apuntados', primer_cobro: 'Primer cobro pendiente', retrasado: 'Retrasado', pendiente: 'Pendiente de cobro', vencido: 'Periodo acabado, sin el siguiente', vence_pronto: 'Vence esta semana', al_dia: 'Al día',
};

// Lo cobrado en un mes (por fecha de pago). mes: 'AAAA-MM'
export function cobradoEnMes(pagos = [], mes = hoyISO().slice(0, 7)) {
  return Math.round(pagos.filter((p) => p.estado === 'pagado' && p.fecha_pago?.slice(0, 7) === mes).reduce((t, p) => t + Number(p.importe || 0), 0) * 100) / 100;
}

export const fmtEuros = (x) => `${Number(x || 0).toLocaleString('es-ES', { minimumFractionDigits: Number(x) % 1 ? 2 : 0, maximumFractionDigits: 2 })} €`;

// Euros escritos a la española: «1.308», «1.250,50», «74,5» o «74.50»
export const leerEuros = (t) => {
  let v = String(t ?? '').replace(/\s|\u20ac/g, '');
  if (v === '') return null;
  if (v.includes(',')) v = v.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, '');
  return /^\d+(\.\d+)?$/.test(v) ? Number(v) : NaN;
};
