// Panel de negocio (v0.48, solo el coach): atletas activos por servicio, altas y bajas por mes, lo cobrado frente a
// lo previsto de los últimos 12 meses, lo que renueva en los próximos 30 días y la constancia media del equipo.
// Sale de los cobros que ya se apuntan a mano (solo los ve el coach: permisos de la 020) y de las fichas.
import { hoyISO, sumarDias, diasEntre } from './fechas.js';
import { siguientePeriodo, importePeriodo } from './cobros.js';
import { nombreMes, sumarMes } from './mes.js';

const r2 = (x) => Math.round(x * 100) / 100;
export const SIN_SERVICIO = 'Sin servicio apuntado';
export const TIPO_SERVICIO = (a) => (a.entrenamiento === false ? 'Solo nutrición' : a.nutricion === false ? 'Solo entrenamiento' : 'Entrenamiento y nutrición');

// d: { atletas (sin la ficha propia del coach), acuerdos (cobros_atletas), pagos, constancia: [% de sesiones de cada
//      atleta activo en las 4 últimas semanas] }
export function panelNegocio(d, hoy = hoyISO(), { meses = 12 } = {}) {
  const atletas = d.atletas || [];
  const acuerdos = Object.fromEntries((d.acuerdos || []).map((x) => [x.atleta_id, x]));
  const pagos = d.pagos || [];
  const activos = atletas.filter((a) => a.estado === 'activo');
  // Activos por servicio (el de sus cobros) y por lo que le llevas
  const cuenta = (lista, clave) => {
    const m = new Map();
    for (const a of lista) { const k = clave(a); m.set(k, (m.get(k) || 0) + 1); }
    return [...m.entries()].map(([nombre, n]) => ({ nombre, n })).sort((a, b) => b.n - a.n || (a.nombre === SIN_SERVICIO) - (b.nombre === SIN_SERVICIO) || a.nombre.localeCompare(b.nombre, 'es'));
  };
  const porServicio = cuenta(activos, (a) => acuerdos[a.id]?.servicio || SIN_SERVICIO);
  const porTipo = cuenta(activos, TIPO_SERVICIO);
  // Lo que pagan al mes los activos (su precio acordado)
  const mrr = r2(activos.reduce((t, a) => t + (Number(acuerdos[a.id]?.precio_mes) || 0), 0));
  // Los últimos 12 meses, del más antiguo al actual
  const mesHoy = hoy.slice(0, 7);
  const lista = Array.from({ length: meses }, (_, i) => sumarMes(mesHoy, i - (meses - 1)));
  const porMes = lista.map((mes) => ({
    mes, nombre: nombreMes(mes),
    altas: atletas.filter((a) => String(a.fecha_alta || '').slice(0, 7) === mes).length,
    bajas: atletas.filter((a) => a.estado === 'baja' && String(a.baja_en || '').slice(0, 7) === mes).length,
    cobrado: r2(pagos.filter((p) => p.estado === 'pagado' && String(p.fecha_pago || '').slice(0, 7) === mes).reduce((t, p) => t + Number(p.importe || 0), 0)),
    previsto: r2(pagos.filter((p) => String(p.periodo_desde || '').slice(0, 7) === mes).reduce((t, p) => t + Number(p.importe || 0), 0)),
  }));
  const bajasSinFecha = atletas.filter((a) => a.estado === 'baja' && !a.baja_en).length;
  // Lo que renueva o acaba en los próximos 30 días: el final del último periodo apuntado de cada activo (o un cobro
  // pendiente que empieza en esos días)
  const tope = sumarDias(hoy, 30);
  const renovaciones = [];
  for (const a of activos) {
    const suyos = pagos.filter((p) => p.atleta_id === a.id);
    if (!suyos.length) continue;
    const acuerdo = acuerdos[a.id] || null;
    const ultimo = [...suyos].sort((x, y) => (x.periodo_hasta < y.periodo_hasta ? 1 : -1))[0];
    const proximoPendiente = suyos.filter((p) => p.estado !== 'pagado' && p.periodo_desde >= hoy && p.periodo_desde <= tope).sort((x, y) => (x.periodo_desde < y.periodo_desde ? -1 : 1))[0];
    if (proximoPendiente) {
      renovaciones.push({ atleta: a, fecha: proximoPendiente.periodo_desde, importe: Number(proximoPendiente.importe), apuntado: true, servicio: acuerdo?.servicio || null });
    } else if (ultimo.periodo_hasta >= hoy && ultimo.periodo_hasta < tope) {
      const sig = siguientePeriodo(suyos, acuerdo, hoy);
      renovaciones.push({ atleta: a, fecha: sumarDias(ultimo.periodo_hasta, 1), importe: sig.importe ?? importePeriodo(acuerdo), apuntado: false, servicio: acuerdo?.servicio || null });
    }
  }
  renovaciones.sort((x, y) => (x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : x.atleta.nombre.localeCompare(y.atleta.nombre, 'es')));
  const constancia = (d.constancia || []).filter((x) => Number.isFinite(x));
  return {
    activos: activos.length, porServicio, porTipo, mrr,
    meses: porMes,
    cobrado12: r2(porMes.reduce((t, m) => t + m.cobrado, 0)), previsto12: r2(porMes.reduce((t, m) => t + m.previsto, 0)),
    altas12: porMes.reduce((t, m) => t + m.altas, 0), bajas12: porMes.reduce((t, m) => t + m.bajas, 0), bajasSinFecha,
    renovaciones: renovaciones.map((x) => ({ ...x, enDias: diasEntre(hoy, x.fecha) })),
    renuevan30: r2(renovaciones.reduce((t, x) => t + (Number(x.importe) || 0), 0)),
    constanciaMedia: constancia.length ? Math.round(constancia.reduce((t, x) => t + x, 0) / constancia.length) : null,
    conConstancia: constancia.length,
  };
}

// Importes a la española («1.308 €», «74,50 €») o tapados, para enseñar la pantalla a alguien
export const OCULTO = '••• €';
export const euros = (x, oculto = false) => (oculto ? OCULTO : `${Number(x || 0).toLocaleString('es-ES', { minimumFractionDigits: Number(x) % 1 ? 2 : 0, maximumFractionDigits: 2, useGrouping: true })} €`);
