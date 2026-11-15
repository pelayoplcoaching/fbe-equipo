import { e1rm, e1rmPorSemana, num, tendenciaPeso, ritmoPeso } from './calculos.js';
import { pesoTxt } from './unidades.js';
import { sumarDias, diasEntre, lunesDe, aISO } from './fechas.js';

// Objetivos de fuerza enlazados a un ejercicio: «62,5 kg × 1», «80 kg × 3».
// Meta = el 1RM estimado que supone esa marca al fallo (Epley; solo hasta 12 repeticiones, como el resto de la app).
// Actual = su mejor 1RM estimado de las últimas 6 semanas: la misma ventana con la que se fija el punto de partida
// (e1rm_inicio) al enlazar el objetivo, para que justo al crearlo el progreso sea 0 % y no salga negativo.
// Progreso = lo que ha subido desde ese punto de partida respecto a lo que había que subir.
// Conseguido = una serie real con al menos esa carga y esas repeticiones registrada después de poner el objetivo.
// Previsión = la tendencia de su mejor 1RM estimado semanal (últimas 8 semanas con datos), solo si sube y hay datos
// de las últimas 3 semanas.

export const REPS_MAX_OBJETIVO = 12;
export const SEMANAS_REFERENCIA = 6;

export const metaE1rm = (kg, reps) => e1rm({ kg, reps, rir: 0 });
export const textoMarca = (kg, reps) => `${pesoTxt(Number(kg), 2)}${Number(reps) > 1 ? ` × ${reps}` : ' a una repetición'}`;

// Mejor 1RM estimado de las últimas `semanas` (desde el lunes de hace `semanas` semanas hasta `hoy`, incluido)
export function mejorReciente(series, hoy, semanas = SEMANAS_REFERENCIA) {
  const desde = sumarDias(lunesDe(hoy), -7 * semanas);
  const v = series.filter((s) => s.fecha && s.fecha >= desde && s.fecha <= hoy).map((s) => e1rm(s) || 0).filter((x) => x > 0);
  return v.length ? Math.max(...v) : null;
}

// Fecha local (no UTC) del momento en que se puso el objetivo
function diaDe(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? String(ts).slice(0, 10) : aISO(d);
}

const redondeo = (v) => (v == null ? null : Math.round(v * 10) / 10);

export function progresoObjetivo(obj, series, hoy) {
  if (!obj?.ejercicio_id || obj.kg_objetivo == null || obj.reps_objetivo == null) return null;
  const kg = Number(obj.kg_objetivo), reps = Number(obj.reps_objetivo);
  const meta = redondeo(metaE1rm(kg, reps)); // null si la marca no se puede estimar (más de 12 repeticiones)
  const propias = series.filter((s) => s.ejercicio_id === obj.ejercicio_id && Number(s.reps) > 0);
  const semanal = e1rmPorSemana(propias.filter((s) => s.fecha <= hoy));
  const actual = redondeo(mejorReciente(propias, hoy));
  const desde = diaDe(obj.creado_en);
  // Punto de partida: el que se guardó al enlazarlo o, si falta, el mejor de las 6 semanas previas a ese día
  const inicio = obj.e1rm_inicio != null ? Number(obj.e1rm_inicio) : desde ? redondeo(mejorReciente(propias, desde)) : null;
  // Conseguido: la primera serie real, registrada después de poner el objetivo, que iguala o supera la marca
  const tsDesde = obj.creado_en ? new Date(obj.creado_en).getTime() : null;
  const despues = (s) => {
    if (tsDesde == null || Number.isNaN(tsDesde)) return true;
    const t = s.registrada_en ? new Date(s.registrada_en).getTime() : NaN;
    return Number.isNaN(t) ? s.fecha > desde : t >= tsDesde;
  };
  const real = propias.filter((s) => despues(s) && Number(s.kg) >= kg && Number(s.reps) >= reps)
    .sort((a, b) => (`${a.fecha}|${a.registrada_en || ''}` < `${b.fecha}|${b.registrada_en || ''}` ? -1 : 1))[0] || null;
  let pct = 0;
  if (real) pct = 100;
  else if (meta && actual != null && inicio != null && meta > inicio) pct = Math.round(Math.max(0, Math.min(99, ((actual - inicio) / (meta - inicio)) * 100)));
  else if (meta && actual != null) pct = Math.round(Math.max(0, Math.min(99, (actual / meta) * 100)));
  // Previsión por la pendiente de las últimas 8 semanas con datos, si la última es de hace 3 semanas como mucho
  let prevision = null;
  const ult = semanal.slice(-8);
  const reciente = ult.length && diasEntre(ult[ult.length - 1].semana, lunesDe(hoy)) <= 21;
  if (meta && !real && actual != null && actual < meta && ult.length >= 3 && reciente) {
    const x0 = ult[0].semana;
    const xs = ult.map((p) => diasEntre(x0, p.semana) / 7), ys = ult.map((p) => p.valor);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
    const den = xs.reduce((t, x) => t + (x - mx) ** 2, 0);
    const pendiente = den ? xs.reduce((t, x, i) => t + (x - mx) * (ys[i] - my), 0) / den : 0; // kg por semana
    if (pendiente > 0.05) {
      const semanas = Math.ceil((meta - actual) / pendiente);
      if (semanas <= 52) {
        const fecha = sumarDias(hoy, semanas * 7);
        prevision = { semanas, fecha, ritmo: Math.round(pendiente * 10) / 10, aTiempo: obj.fecha_limite ? fecha <= obj.fecha_limite : null };
      }
    }
  }
  return {
    meta, actual, inicio, pct,
    conseguido: real ? { fecha: real.fecha, serie: real } : null,
    yaLoPermite: !!meta && !real && actual != null && actual >= meta,
    sinRecientes: actual == null && semanal.length > 0, // tiene series, pero ninguna en las últimas 6 semanas
    prevision,
  };
}

// ---------- Objetivos de peso corporal (migración 076) ----------
// Meta = el peso al que quiere llegar. Actual = su tendencia de peso (la media que suaviza el día a día), si se ha
// pesado en los últimos 14 días. Inicio = la tendencia que tenía al ponerse el objetivo (peso_inicio).
// Progreso = lo recorrido desde el inicio respecto a lo que había que recorrer. Llegado = la tendencia ya está en la
// meta (o más allá, en el sentido que buscaba). Previsión = con el ritmo de las últimas 3 semanas (ritmoPeso), solo
// si va hacia la meta: «a este ritmo, hacia el…». Si va en sentido contrario, alejandose.
export const DIAS_PESO_RECIENTE = 14;
export function progresoPeso(obj, pesos = [], hoy) {
  const meta = Number(obj?.peso_objetivo);
  if (!(meta > 0)) return null;
  const serie = tendenciaPeso((pesos || []).filter((p) => p.fecha && p.fecha <= hoy));
  const ult = serie[serie.length - 1] || null;
  const reciente = !!ult && diasEntre(ult.fecha, hoy) <= DIAS_PESO_RECIENTE;
  const actual = reciente ? Math.round(ult.tendencia * 10) / 10 : null;
  // (revisión) sin punto de partida guardado (no se había pesado al ponerlo): la primera tendencia desde ese día
  const desde = obj.creado_en ? diaDe(obj.creado_en) : '';
  const primera = obj.peso_inicio == null && desde ? serie.find((p) => p.fecha >= desde) : null;
  const inicio = obj.peso_inicio != null ? Number(obj.peso_inicio) : primera && primera !== ult ? Math.round(primera.tendencia * 10) / 10 : null;
  const baja = inicio != null ? meta < inicio : actual != null ? meta < actual : null;   // ¿busca bajar?
  const llegado = actual != null && baja != null && (baja ? actual <= meta : actual >= meta);
  let pct = 0;
  if (llegado) pct = 100;
  else if (actual != null && inicio != null && meta !== inicio) pct = Math.round(Math.max(0, Math.min(99, ((actual - inicio) / (meta - inicio)) * 100)));
  let prevision = null, alejandose = false;
  const ritmo = reciente ? ritmoPeso(serie) : null;
  if (ritmo && actual != null && !llegado && Math.abs(ritmo.kgSemana) >= 0.05) {
    const falta = meta - actual;   // con su signo
    if (Math.sign(falta) === Math.sign(ritmo.kgSemana)) {
      const semanas = Math.ceil(falta / ritmo.kgSemana);
      if (semanas <= 104) {
        const fecha = sumarDias(hoy, semanas * 7);
        prevision = { semanas, fecha, ritmo: ritmo.kgSemana, aTiempo: obj.fecha_limite ? fecha <= obj.fecha_limite : null };
      }
    } else alejandose = true;
  }
  return { tipo: 'peso', meta, actual, inicio, pct, llegado, prevision, alejandose, sinRecientes: !reciente && serie.length > 0, sinPesos: !serie.length };
}
