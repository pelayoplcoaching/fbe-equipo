// «Tu día»: lo que le toca hoy al atleta, en una lista corta y en orden. Una sola cosa a la vez: la app
// tiene muchas funciones, pero el atleta solo necesita saber qué hacer hoy y qué está hecho.
import { hoyISO, diaDeCheckin, sumarDias as sumar } from './fechas.js';
import { queToca, diaPrevistoValido } from './plan.js';

// d: { semana, sesiones, pesoHoy (bool|null = no aplica), habitos ([resumenHabito] | null), nutricion ({ plan, hoy } | null),
//      checkin ({ hecho, pendiente } | null), cuestionario ({ pendiente } | null) }
// Devuelve [{ id, texto, detalle, estado: 'hecho' | 'toca' | 'luego' | 'descanso', accion }]
export function tuDia(d, hoy = hoyISO()) {
  const out = [];
  if (d.cuestionario?.pendiente) out.push({ id: 'cuestionario', texto: 'Tu cuestionario', detalle: 'Tu coach te lo pide: son unos minutos', estado: 'toca', accion: 'cuestionario' });

  if (d.semana && d.sesiones) {
    const toca = queToca(d.sesiones, d.semana, hoy);
    const hechaHoy = d.sesiones.find((s) => s.completada && s.fecha_realizada === hoy);
    const enSemana = !!d.semana.fecha_inicio && d.semana.fecha_inicio <= hoy && hoy <= sumar(d.semana.fecha_inicio, 6);
    if (hechaHoy) out.push({ id: 'sesion', texto: hechaHoy.nombre, detalle: 'Sesión hecha', estado: 'hecho', accion: 'sesion', sesionId: hechaHoy.id });
    else if (enSemana && toca.descanso) out.push({ id: 'sesion', texto: 'Descanso', detalle: toca.proxima ? `La próxima, ${toca.proxima.sesion.nombre}` : 'Semana completada', estado: 'descanso', accion: 'plan' });
    else if (toca.siguiente) {
      const previsto = diaPrevistoValido(toca.siguiente, d.semana);
      const atrasada = previsto && previsto < hoy;
      out.push({ id: 'sesion', texto: toca.siguiente.nombre, detalle: toca.hoy ? 'Hoy toca entrenar' : atrasada ? 'La tenías prevista: cuando puedas' : 'Tu siguiente sesión', estado: toca.hoy || atrasada || !previsto ? 'toca' : 'luego', accion: 'sesion', sesionId: toca.siguiente.id });
    } else out.push({ id: 'sesion', texto: 'Semana completada', detalle: 'Todas las sesiones hechas', estado: 'hecho', accion: 'semana' });
  }

  if (d.habitos?.length) {
    const hoyToca = d.habitos.filter((h) => h.habito.dias_semana >= 7 || !h.semana?.llega);
    const hechos = d.habitos.filter((h) => h.cumpleHoy).length;
    const n = d.habitos.length;
    out.push({ id: 'habitos', texto: n === 1 ? d.habitos[0].habito.nombre : 'Tus hábitos', detalle: hechos >= n ? 'Todos apuntados' : `${hechos} de ${n} hechos hoy`, estado: hechos >= n ? 'hecho' : hoyToca.length ? 'toca' : 'luego', accion: 'habitos' });
  }

  if (d.nutricion?.plan) {
    const sinContar = d.nutricion.plan.modo === 'sin_contar';
    const apuntado = !!d.nutricion.hoy;
    out.push({ id: 'nutricion', texto: 'Nutrición', detalle: apuntado ? (d.nutricion.hoy.completo === false ? 'Apuntada a medias' : 'Apuntada') : sinContar ? '¿Has seguido el plan hoy?' : 'Apunta lo que has comido', estado: apuntado ? 'hecho' : 'luego', accion: 'nutricion' });
  }

  if (d.pesoHoy != null) {
    out.push({ id: 'peso', texto: 'Tu peso', detalle: d.pesoHoy ? 'Apuntado' : 'Un toque, en ayunas', estado: d.pesoHoy ? 'hecho' : 'luego', accion: 'peso' });
  }

  if (d.checkin) {
    if (d.checkin.hecho) out.push({ id: 'checkin', texto: 'Check-in semanal', detalle: 'Enviado a tu coach', estado: 'hecho', accion: 'checkin' });
    else if (d.checkin.pendiente || diaDeCheckin()) out.push({ id: 'checkin', texto: 'Check-in semanal', detalle: 'Un minuto, cuando acabes la semana', estado: 'toca', accion: 'checkin' });
  }

  return out;
}

// «2 de 4 hechas» para la cabecera; sin nada que hacer, null
export function resumenDia(items) {
  const hechas = items.filter((x) => x.estado === 'hecho').length;
  const total = items.filter((x) => x.estado !== 'descanso').length;
  if (!total) return null;
  return { hechas, total, todo: hechas >= total, pendientes: items.filter((x) => x.estado === 'toca').length };
}
