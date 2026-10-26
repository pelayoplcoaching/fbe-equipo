import { sumarDias, lunesDe } from './fechas.js';
import { e1rm, tendenciaPeso } from './calculos.js';

// ---------- Informe de un bloque y cumplimiento ----------
// Cumplimiento: de lo que ya tocaba hacer (sesiones de semanas acabadas, o hechas), cuánto se hizo.
// Una serie cuenta si tiene repeticiones; por ejercicio, como mucho las series pautadas.
// Esfuerzo: series con RPE (o RIR) frente al objetivo de su pauta; «por encima» = más de medio punto por encima.

const esfuerzoDe = (x) => (x.rpe != null && x.rpe !== '' ? Number(x.rpe) : x.rir != null && x.rir !== '' ? 10 - Number(x.rir) : null);
const objetivoDe = (p) => (p.rpe_objetivo != null ? Number(p.rpe_objetivo) : p.rir_objetivo != null ? 10 - Number(p.rir_objetivo) : null);
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);
const conRepes = (s) => Number(s.reps) > 0;

// Cumplimiento de un conjunto de sesiones (con sus pautas y series). hoy decide qué sesiones «tocaban» ya.
// sesiones: [{ id, completada, semana_lunes }]; pautas: [{ id, sesion_id, series, rpe_objetivo, rir_objetivo }];
// series: [{ sesion_ejercicio_id, reps, rpe, rir }]
export function cumplimiento({ sesiones, pautas, series }, hoy) {
  const lunesHoy = lunesDe(hoy);
  const tocaban = sesiones.filter((x) => x.completada || (x.semana_lunes && x.semana_lunes < lunesHoy));
  const ids = new Set(tocaban.map((x) => x.id));
  const misPautas = pautas.filter((p) => ids.has(p.sesion_id));
  const porPauta = {};
  for (const s of series) if (conRepes(s)) (porPauta[s.sesion_ejercicio_id] ||= []).push(s);
  let hechas = 0, pautadas = 0, conEsfuerzo = 0, encima = 0;
  for (const p of misPautas) {
    const ss = porPauta[p.id] || [];
    pautadas += Number(p.series) || 0;
    hechas += Math.min(ss.length, Number(p.series) || 0);
    const obj = objetivoDe(p);
    if (obj == null) continue;
    for (const s of ss) {
      const e = esfuerzoDe(s);
      if (e == null) continue;
      conEsfuerzo++;
      if (e > obj + 0.5) encima++;
    }
  }
  const sesHechas = tocaban.filter((x) => x.completada).length;
  return {
    sesiones: { hechas: sesHechas, total: tocaban.length, pct: pct(sesHechas, tocaban.length) },
    series: { hechas, pautadas, pct: pct(hechas, pautadas) },
    esfuerzo: { conEsfuerzo, encima, pctEncima: pct(encima, conEsfuerzo) },
  };
}

// d: { bloque, semanas (programadas), sesiones, pautas, ejercicios {id: {nombre}}, series (historial: con fecha,
//      sesion_id, ejercicio_id, ejercicio, grupos), eventos (récords de toda la historia), pesos }
export function informeBloque(d, hoy) {
  const semanas = [...(d.semanas || [])].filter((w) => w.fecha_inicio).sort((a, b) => a.numero - b.numero);
  if (!semanas.length) return null;
  const lunesDeSemana = Object.fromEntries(semanas.map((w) => [w.id, lunesDe(w.fecha_inicio)]));
  const sesiones = (d.sesiones || []).filter((x) => lunesDeSemana[x.semana_id]).map((x) => ({ ...x, semana_lunes: lunesDeSemana[x.semana_id] }));
  const idsSes = new Set(sesiones.map((x) => x.id));
  const pautas = (d.pautas || []).filter((p) => idsSes.has(p.sesion_id));
  const pautaPorId = Object.fromEntries(pautas.map((p) => [p.id, p]));
  const series = (d.series || []).filter((s) => idsSes.has(s.sesion_id));
  const hechas = series.filter(conRepes);
  const inicio = lunesDe(semanas[0].fecha_inicio);
  const fin = sumarDias(lunesDe(semanas[semanas.length - 1].fecha_inicio), 6);
  const tonelaje = (lista) => lista.reduce((t, s) => t + (Number(s.kg) || 0) * (Number(s.reps) || 0), 0);

  // Semana a semana
  const porSemana = semanas.map((w) => {
    const ses = sesiones.filter((x) => x.semana_id === w.id);
    const ids = new Set(ses.map((x) => x.id));
    const ss = hechas.filter((s) => ids.has(s.sesion_id));
    const c = cumplimiento({ sesiones: ses, pautas: pautas.filter((p) => ids.has(p.sesion_id)), series: ss }, hoy);
    return {
      numero: w.numero, foco: w.foco || null, lunes: lunesDeSemana[w.id],
      sesiones: { hechas: ses.filter((x) => x.completada).length, total: ses.length },
      series: ss.length, tonelaje: tonelaje(ss), cumplimiento: c,
      futura: lunesDeSemana[w.id] > hoy,
      ids,
    };
  });

  // Ejercicios principales: los de prioridad alta (si no hay, los de más series); su mejor 1RM estimado por semana
  const seriesPorEj = {};
  for (const s of hechas) (seriesPorEj[s.ejercicio_id] ||= []).push(s);
  const altas = new Set(hechas.filter((s) => pautaPorId[s.sesion_ejercicio_id]?.prioridad === 'alta').map((s) => s.ejercicio_id));
  let candidatos = Object.keys(seriesPorEj).filter((id) => altas.has(id));
  if (!candidatos.length) candidatos = Object.keys(seriesPorEj).sort((a, b) => seriesPorEj[b].length - seriesPorEj[a].length).slice(0, 3);
  const principales = candidatos.map((id) => {
    const ss = seriesPorEj[id].filter((s) => Number(s.kg) > 0);
    const conEsf = ss.filter((s) => esfuerzoDe(s) != null);
    const usar = conEsf.length ? conEsf : ss; // sin RPE, al menos comparables entre sí
    const valores = porSemana.map((w) => {
      const deSemana = usar.filter((s) => w.ids.has(s.sesion_id)); // por la semana de la sesión, aunque se hiciera otro día
      const v = Math.max(0, ...deSemana.map((s) => e1rm(s) || 0));
      return v > 0 ? Math.round(v * 10) / 10 : null;
    });
    const con = valores.map((v, i) => [v, i]).filter(([v]) => v != null);
    if (!con.length) return null;
    const [a, ia] = con[0], [z, iz] = con[con.length - 1];
    return {
      ejercicio_id: id, nombre: seriesPorEj[id][0].ejercicio || 'Ejercicio', valores, conEsfuerzo: conEsf.length > 0,
      inicio: { e1rm: a, semana: porSemana[ia].numero }, fin: { e1rm: z, semana: porSemana[iz].numero },
      cambio: iz > ia ? Math.round(((z - a) / a) * 1000) / 10 : null,
    };
  }).filter(Boolean).sort((x, y) => (y.cambio ?? -999) - (x.cambio ?? -999)).slice(0, 5);

  // Músculos: series semanales medias en las semanas con algo hecho
  const conAlgo = porSemana.filter((w) => w.series > 0);
  const musculos = {};
  for (const s of hechas) (s.grupos || []).forEach((g, i) => { musculos[g] = (musculos[g] || 0) + (i === 0 ? 1 : 0.5); });
  for (const g of Object.keys(musculos)) musculos[g] = Math.round((musculos[g] / conAlgo.length) * 10) / 10;

  // Peso (tendencia) al empezar y al acabar (o hoy, si sigue en curso)
  const tend = tendenciaPeso(d.pesos || []);
  const hasta = (f) => [...tend].reverse().find((p) => p.fecha <= f) || null;
  const pIni = hasta(sumarDias(inicio, 1)) || tend.find((p) => p.fecha >= inicio && p.fecha <= fin) || null;
  const pFin = hasta(fin < hoy ? fin : hoy);
  const peso = pIni && pFin && pFin.fecha > pIni.fecha ? { inicio: pIni.tendencia, fin: pFin.tendencia, cambio: Math.round((pFin.tendencia - pIni.tendencia) * 10) / 10 } : null;

  const records = (d.eventos || []).filter((e) => idsSes.has(e.sesion_id)).map((e) => ({ ejercicio: e.ejercicio, texto: e.record.texto, tipo: e.record.tipo, fecha: e.fecha }));
  const total = cumplimiento({ sesiones, pautas, series: hechas }, hoy);
  const sesHechas = sesiones.filter((x) => x.completada);
  return {
    bloque: { id: d.bloque.id, nombre: d.bloque.nombre, numero: d.bloque.numero, foco: d.bloque.foco || null, objetivo: d.bloque.objetivo || null },
    inicio, fin, terminado: fin < hoy, semanasTotal: semanas.length,
    sesiones: { hechas: sesHechas.length, total: sesiones.length },
    cumplimiento: total,
    series: hechas.length, tonelaje: tonelaje(hechas),
    minutos: sesHechas.reduce((t, x) => t + (Number(x.duracion_min) || 0), 0),
    semanas: porSemana.map(({ ids, ...w }) => w), principales, musculos, peso, records,
    vacio: !sesHechas.length && !hechas.length,
  };
}
