// «Tu año en FBE» (v0.104, como el resumen anual de Strava o el Wrapped de Spotify): el año entero en una historia.
// Sale en diciembre (el año en curso) y en enero (el que acaba de terminar). Solo entrenamiento: nada de peso, medidas,
// nutrición, hábitos ni datos de salud. Se calcula con lo ya registrado, como «Tu mes» (logica/mes.js).
import { sumarDias, diasEntre } from './fechas.js';
import { eventosRecord, e1rm } from './calculos.js';
import { rachaMaxima } from './logros.js';
import { cardioHechoValido } from './cardio.js';
import { paraRacha } from './semana-natural.js';
import { MESES_LARGOS } from './mes.js';

// Diciembre: el año en curso; enero: el anterior; el resto del año, ninguno
export function anioParaResumen(hoy) {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(hoy || ''));
  if (!m) return null;
  return m[2] === '12' ? Number(m[1]) : m[2] === '01' ? Number(m[1]) - 1 : null;
}

const enAnio = (f, anio) => !!f && String(f).slice(0, 4) === String(anio);
const jueves = (lunes) => sumarDias(lunes, 3);

// d: lo de api.datosMes (series, sesiones con semana_lunes, semanasNaturales); hoy: para no contar lo que aún no ha pasado
export function resumenAnio(d, anio, hoy) {
  const fin = `${anio}-12-31` < hoy ? `${anio}-12-31` : hoy;
  const series = (d.series || []).filter((s) => enAnio(s.fecha, anio) && s.fecha <= fin && Number(s.reps) > 0);
  const sesiones = d.sesiones || [];
  const hechas = sesiones.filter((x) => x.completada && enAnio(x.fecha_realizada, anio));
  const tonelaje = series.reduce((t, s) => t + (Number(s.kg) || 0) * (Number(s.reps) || 0), 0);
  const dias = [...new Set([...series.map((s) => s.fecha), ...hechas.map((x) => x.fecha_realizada)].filter((f) => enAnio(f, anio)))].sort();
  const records = eventosRecord(d.series || []).eventos.filter((e) => enAnio(e.fecha, anio));
  // Por meses: sesiones hechas en cada uno (el que más, para una pantalla)
  const porMes = Array(12).fill(0);
  for (const x of hechas) porMes[Number(String(x.fecha_realizada).slice(5, 7)) - 1]++;
  const mesTop = porMes.some((n) => n > 0) ? porMes.indexOf(Math.max(...porMes)) : null;
  // La mejor racha de semanas completas del año
  const porSemana = new Map();
  for (const x of sesiones) {
    if (!x.semana_lunes) continue;
    const s = porSemana.get(x.semana_lunes) || { fecha_inicio: x.semana_lunes, total: 0, hechas: 0 };
    s.total++; if (x.completada) s.hechas++;
    porSemana.set(x.semana_lunes, s);
  }
  const naturales = Array.isArray(d.semanasNaturales) ? paraRacha(d.semanasNaturales) : null;
  const delAnio = (naturales || [...porSemana.values()]).filter((w) => enAnio(jueves(w.fecha_inicio), anio));
  const mejorRacha = rachaMaxima(delAnio, fin);
  const semanasCompletas = delAnio.filter((w) => w.total && w.hechas >= w.total && w.fecha_inicio <= fin).length;
  // El ejercicio que más ha subido: su mejor 1RM estimado del primer mes en que lo hizo este año frente al mejor del
  // año (al menos 6 semanas entre medias y 4 sesiones con él)
  const porEj = new Map();
  for (const s of series) if (s.ejercicio_id && Number(s.kg) > 0) (porEj.get(s.ejercicio_id) || porEj.set(s.ejercicio_id, []).get(s.ejercicio_id)).push(s);
  let progreso = null;
  for (const [id, lista] of porEj) {
    const fechas = [...new Set(lista.map((s) => s.fecha))].sort();
    if (fechas.length < 4 || diasEntre(fechas[0], fechas.at(-1)) < 42) continue;
    const ini = lista.filter((s) => diasEntre(fechas[0], s.fecha) < 28).map(e1rm).filter((v) => v != null);
    const todo = lista.map(e1rm).filter((v) => v != null);
    if (!ini.length || !todo.length) continue;
    const a = Math.max(...ini), b = Math.max(...todo);
    const pct = (b - a) / a;
    if (pct > 0.02 && (!progreso || pct > progreso.pct)) progreso = { ejercicio_id: id, ejercicio: lista[0].ejercicio || 'Ejercicio', antes: a, ahora: b, pct: Math.round(pct * 1000) / 10 };
  }
  const cardio = hechas.reduce((c, x) => {
    const h = cardioHechoValido(x.cardio_hecho) ? x.cardio_hecho : null;
    return h ? { minutos: c.minutos + Number(h.minutos || 0), km: Math.round((c.km + (Number(h.km) || 0)) * 10) / 10, sesiones: c.sesiones + 1 } : c;
  }, { minutos: 0, km: 0, sesiones: 0 });
  return {
    anio, hasta: fin, sesiones: hechas.length, dias: dias.length, series: series.length, tonelaje,
    minutos: hechas.reduce((t, x) => t + (Number(x.duracion_min) || 0), 0),
    records: records.length, ejerciciosConRecord: new Set(records.map((e) => e.ejercicio_id)).size,
    porMes, mesTop: mesTop == null ? null : { mes: MESES_LARGOS[mesTop], sesiones: porMes[mesTop] },
    mejorRacha, semanasCompletas, progreso, cardio,
    primerDia: dias[0] || null,
    vacio: hechas.length === 0 && series.length === 0,
  };
}

// Lo que va en la imagen para compartir (solo entrenamiento)
export function datosCompartirAnio(r) {
  return {
    nombre: `Mi ${r.anio} en FBE`, subtitulo: 'El año en cifras', fecha: r.hasta, etiquetaFecha: String(r.anio), fondo: 'bloque',
    cifras: [[String(r.sesiones), r.sesiones === 1 ? 'sesión' : 'sesiones'], [String(r.dias), r.dias === 1 ? 'día entrenando' : 'días entrenando'], [String(Math.round(r.tonelaje / 100) / 10).replace('.', ','), 'toneladas']],
    series: r.series, tonelaje: r.tonelaje, minutos: null, records: [],
    mejores: [
      ...(r.records ? [{ nombre: 'Récords', serie: String(r.records) }] : []),
      ...(r.mejorRacha ? [{ nombre: 'Mejor racha', serie: `${r.mejorRacha} ${r.mejorRacha === 1 ? 'semana' : 'semanas'}` }] : []),
      ...(r.progreso ? [{ nombre: r.progreso.ejercicio, serie: `+${String(r.progreso.pct).replace('.', ',')} %` }] : []),
      ...(r.cardio?.sesiones ? [{ nombre: 'Cardio', serie: `${r.cardio.minutos} min` }] : []),
    ].slice(0, 3),
    tituloMejores: 'Lo mejor del año',
  };
}
