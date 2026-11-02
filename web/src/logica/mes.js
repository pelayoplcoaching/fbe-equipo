// «Tu mes» (v0.48, como el resumen mensual de Strava o Hevy): el mes que acaba de terminar en una historia.
// Se calcula con lo ya registrado (no se guarda nada nuevo). Las sesiones previstas son las de las semanas
// publicadas cuyo jueves cae en el mes (la regla de las semanas ISO: así cada semana es de un solo mes).
import { sumarDias, lunesDe, desdeISO, diasEntre, fechaMadrid } from './fechas.js';
import { eventosRecord, racha } from './calculos.js';
import { rachaMaxima } from './logros.js';
import { cumpleHabito } from './habitos.js';
import { planVigente, objetivoDelDia, evaluarDia } from './nutricion.js';
import { cardioHechoValido } from './cardio.js';
import { paraRacha } from './semana-natural.js';

export const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const nombreMes = (mes) => MESES_LARGOS[Number(String(mes).slice(5, 7)) - 1] || '';
// «octubre de 2026»
export const mesConAnio = (mes) => `${nombreMes(mes)} de ${String(mes).slice(0, 4)}`;
export const primerDia = (mes) => `${mes}-01`;
export function ultimoDia(mes) {
  const [a, m] = mes.split('-').map(Number);
  return `${mes}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, '0')}`;
}
export function sumarMes(mes, n) {
  const [a, m] = mes.split('-').map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}
// El mes que se resume: el anterior al de hoy en Madrid (el día 1 ya sale el que acaba de terminar)
export const mesAnterior = (instante = new Date()) => sumarMes(fechaMadrid(instante).slice(0, 7), -1);
const enMes = (f, mes) => !!f && String(f).slice(0, 7) === mes;
const jueves = (lunes) => sumarDias(lunes, 3);

// d: { series (historial), sesiones (de las semanas que cuentan, con semana_lunes), habitos: [{ habito, registros }],
//      nutricion: { planes, registros } | null, entrenos (Set de fechas de entreno, para la nutrición),
//      semanasNaturales (v0.53, solo con objetivo de días por semana: las de semanasObjetivo(), de lunes a domingo) }
// opciones: { salud, conNutricion, conEntrenamiento }
export function resumenMes(d, mes, { salud = true, conNutricion = true, conEntrenamiento = true } = {}) {
  const ini = primerDia(mes), fin = ultimoDia(mes);
  const series = (d.series || []).filter((s) => enMes(s.fecha, mes) && Number(s.reps) > 0);
  const sesiones = d.sesiones || [];
  const previstas = sesiones.filter((x) => x.semana_lunes && enMes(jueves(x.semana_lunes), mes));
  const hechas = sesiones.filter((x) => x.completada && enMes(x.fecha_realizada, mes));
  const tonelaje = series.reduce((t, s) => t + (Number(s.kg) || 0) * (Number(s.reps) || 0), 0);
  // Días entrenados: con alguna serie o con una sesión terminada (el cardio no lleva series)
  const diasSet = new Set([...series.map((s) => s.fecha), ...hechas.map((x) => x.fecha_realizada)].filter((f) => enMes(f, mes)));
  const dias = [...diasSet].sort();
  const records = eventosRecord(d.series || []).eventos.filter((e) => enMes(e.fecha, mes))
    .map((e) => ({ ejercicio: e.ejercicio, texto: e.record.texto, tipo: e.record.tipo }));
  // Rachas de semanas completas: la mejor dentro del mes y la que lleva al acabarlo
  const porSemana = new Map();
  for (const x of sesiones) {
    if (!x.semana_lunes) continue;
    const s = porSemana.get(x.semana_lunes) || { fecha_inicio: x.semana_lunes, total: 0, hechas: 0 };
    s.total++; if (x.completada) s.hechas++;
    porSemana.set(x.semana_lunes, s);
  }
  // v0.53: con objetivo de días por semana, las semanas naturales con ese objetivo (las previstas, las de su objetivo)
  const naturales = Array.isArray(d.semanasNaturales) ? paraRacha(d.semanasNaturales) : null;
  const semanas = naturales || [...porSemana.values()];
  const delMes = semanas.filter((w) => enMes(jueves(w.fecha_inicio), mes));
  const semanasCompletas = delMes.filter((w) => w.total && w.hechas >= w.total).length;
  const mejorRacha = rachaMaxima(delMes, fin);
  const rachaFin = racha(semanas, fin);
  // Cardio
  const cardio = hechas.reduce((c, x) => {
    const h = cardioHechoValido(x.cardio_hecho) ? x.cardio_hecho : null;
    if (!h) return c;
    return { minutos: c.minutos + Number(h.minutos || 0), km: Math.round((c.km + (Number(h.km) || 0)) * 10) / 10, sesiones: c.sesiones + 1 };
  }, { minutos: 0, km: 0, sesiones: 0 });
  // Hábitos (dato de salud): de lo que se pedía en los días del mes en que existía cada uno, cuánto se cumplió
  let habitos = null;
  if (salud && d.habitos?.length) {
    const lista = d.habitos.map(({ habito: h, registros }) => {
      const desde = h.creado_en ? String(h.creado_en).slice(0, 10) : ini;
      const a = desde > ini ? desde : ini;
      if (a > fin) return null;
      const n = diasEntre(a, fin) + 1;
      const porDia = new Map((registros || []).map((r) => [String(r.fecha).slice(0, 10), r.valor]));
      let cumplidos = 0;
      for (let iso = a; iso <= fin; iso = sumarDias(iso, 1)) if (cumpleHabito(h, porDia.get(iso))) cumplidos++;
      const pedidos = (h.dias_semana * n) / 7;
      return { nombre: h.nombre, icono: h.icono, pct: pedidos ? Math.min(100, Math.round((cumplidos / pedidos) * 100)) : 0, cumplidos };
    }).filter(Boolean);
    if (lista.length) habitos = { lista, media: Math.round(lista.reduce((t, x) => t + x.pct, 0) / lista.length) };
  }
  // Nutrición (dato de salud): días apuntados y cuántos fueron bien frente a su plan
  let nutricion = null;
  if (salud && conNutricion && d.nutricion?.planes?.length) {
    const regs = (d.nutricion.registros || []).filter((r) => enMes(r.fecha, mes));
    let bien = 0, cerca = 0, conPlan = 0;
    for (const r of regs) {
      const plan = planVigente(d.nutricion.planes, r.fecha);
      if (!plan) continue;
      conPlan++;
      const obj = plan.modo === 'sin_contar' ? null : objetivoDelDia(plan, (d.entrenos || new Set()).has(r.fecha));
      const e = evaluarDia(r, obj);
      if (e === 'si') bien++; else if (e === 'casi') cerca++;
    }
    if (conPlan || d.nutricion.planes.some((p) => p.desde <= fin)) nutricion = { dias: regs.length, bien, cerca, adherencia: regs.length ? Math.round((bien / regs.length) * 100) : 0 };
  }
  const entreno = conEntrenamiento && (hechas.length > 0 || previstas.length > 0 || series.length > 0 || (!!naturales && delMes.length > 0));
  return {
    mes, desde: ini, hasta: fin,
    sesiones: { hechas: hechas.length, previstas: naturales ? delMes.reduce((t, w) => t + w.total, 0) : Math.max(previstas.length, previstas.filter((x) => x.completada).length) },
    dias: dias.length, diasEntrenados: dias,
    series: series.length, tonelaje, minutos: hechas.reduce((t, x) => t + (Number(x.duracion_min) || 0), 0),
    records, semanasCompletas, mejorRacha, racha: rachaFin, cardio,
    habitos, nutricion,
    conEntreno: entreno,
    vacio: !entreno && !habitos && !(nutricion && nutricion.dias),
  };
}

// El calendario de constancia: semanas (de lunes a domingo) que tocan el mes, con los días entrenados
export function calendarioMes(mes, diasEntrenados = []) {
  const ini = primerDia(mes), fin = ultimoDia(mes);
  const hechos = new Set(diasEntrenados);
  const semanas = [];
  for (let l = lunesDe(ini); l <= fin; l = sumarDias(l, 7)) {
    semanas.push(Array.from({ length: 7 }, (_, i) => {
      const iso = sumarDias(l, i);
      return { iso, dia: desdeISO(iso).getDate(), fuera: !enMes(iso, mes), entrenado: hechos.has(iso) };
    }));
  }
  return semanas;
}

// Lo que va en la imagen para compartir: nunca peso, medidas, hábitos, nutrición ni nada de salud
export function datosCompartirMes(r) {
  return {
    mes: r.mes, sesiones: r.sesiones.hechas, dias: r.dias, series: r.series, toneladas: Math.round(r.tonelaje / 100) / 10,
    records: r.records.length, racha: r.mejorRacha,
    cardio: r.cardio?.sesiones ? { minutos: r.cardio.minutos, km: r.cardio.km } : null,
    calendario: calendarioMes(r.mes, r.diasEntrenados),
  };
}
