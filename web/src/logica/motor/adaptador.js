// «Programar según FBE»: del bloque que tiene cargado el editor a la entrada del motor, y de la propuesta a lo que
// se guarda. Lógica pura: no lee ni escribe nada.
//   d: lo que devuelve api.bloqueCompleto → { bloque, semanas, sesiones: { semana_id: [] }, pautas: { sesion_id: [] },
//      series: { pauta_id: [] } }
import { num, cargaSemanal, cambioCarga, tieneDetalle, esTopBackoff } from '../calculos.js';
import { hoyISO } from '../fechas.js';
import { esMalDia, diasParado } from './semana.js';
import { CAMPOS, campos } from './modelos.js';

const numero = (v) => (v == null || v === '' ? null : Number(v));
const pautaLimpia = (p) => ({ ...p, series: numero(p.series), reps_min: numero(p.reps_min), reps_max: numero(p.reps_max), carga_sugerida_kg: numero(p.carga_sugerida_kg),
  rpe_objetivo: numero(p.rpe_objetivo), rir_objetivo: numero(p.rir_objetivo), backoff_pct: numero(p.backoff_pct), series_detalle: Array.isArray(p.series_detalle) && p.series_detalle.length ? p.series_detalle : null });
const serieLimpia = (s) => ({ ...s, numero: numero(s.numero), kg: numero(s.kg), reps: numero(s.reps), rpe: numero(s.rpe), rir: numero(s.rir) });
const deFuerza = (s) => (s.tipo || 'fuerza') === 'fuerza';

// Las pautas de una semana, en orden (sesión y, dentro, su orden), solo de las sesiones de fuerza
export function pautasDeSemana(d, semana) {
  const sesiones = [...(d.sesiones?.[semana?.id] || [])].filter(deFuerza).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  const pautas = sesiones.flatMap((s) => [...(d.pautas?.[s.id] || [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)).map(pautaLimpia));
  return { sesiones, pautas };
}

// Empareja las pautas de dos semanas: la misma sesión (por su orden) y el mismo ejercicio, en el orden en que
// aparecen; si no, el mismo ejercicio en cualquier otra sesión. Devuelve { id de la pauta A: pauta B }.
export function emparejar(pautasA, sesionesA, pautasB, sesionesB) {
  const ordenA = Object.fromEntries(sesionesA.map((s) => [s.id, s.orden])), ordenB = Object.fromEntries(sesionesB.map((s) => [s.id, s.orden]));
  const usadas = new Set(), pares = {};
  for (const a of pautasA) {
    const b = pautasB.find((x) => !usadas.has(x.id) && x.ejercicio_id === a.ejercicio_id && ordenB[x.sesion_id] === ordenA[a.sesion_id]);
    if (b) { usadas.add(b.id); pares[a.id] = b; }
  }
  for (const a of pautasA) {
    if (pares[a.id]) continue;
    const b = pautasB.find((x) => !usadas.has(x.id) && x.ejercicio_id === a.ejercicio_id);
    if (b) { usadas.add(b.id); pares[a.id] = b; }
  }
  return pares;
}

// La entrada de proponerSemana para programar la semana que sigue a `base`.
//   ejercicios: { id: ejercicio } · atleta: { nivel, perfil, volumen_objetivo } · reglas: capas ya limpias
//   checkins: los del atleta (cualquier semana) · molestias: las del atleta (cualquier semana) · destino: la semana a programar
export function entradaDesdeBloque({ d, base, destino = null, ejercicios = {}, atleta = {}, reglas = {}, checkins = [], molestias = [], hoy = hoyISO() }) {
  const { sesiones, pautas } = pautasDeSemana(d, base);
  const series = Object.fromEntries(pautas.map((p) => [p.id, (d.series?.[p.id] || []).map(serieLimpia)]));
  // Historial por pauta: lo que hizo en las semanas anteriores del bloque en ese mismo hueco (sesión y ejercicio)
  const historial = Object.fromEntries(pautas.map((p) => [p.id, []]));
  const anteriores = (d.semanas || []).filter((w) => w.numero < base.numero).sort((a, b) => a.numero - b.numero);
  for (const w of anteriores) {
    const previa = pautasDeSemana(d, w);
    const sesionDe = Object.fromEntries(previa.sesiones.map((s) => [s.id, s]));
    const pares = emparejar(pautas, sesiones, previa.pautas, previa.sesiones);
    for (const p of pautas) {
      const q = pares[p.id];
      if (!q) continue;
      const hechas = (d.series?.[q.id] || []).map(serieLimpia);
      const sesion = sesionDe[q.sesion_id];
      // Una semana sin nada de ese ejercicio (ni hecho ni con la sesión cerrada) no cuenta como historial
      if (!hechas.length && !sesion?.completada) continue;
      historial[p.id].push({ foco: w.foco || null, pauta: q, series: hechas, malDia: esMalDia(sesion) });
    }
  }
  const todas = Object.values(d.sesiones || {}).flat();
  const lunes = base.fecha_inicio || null;
  const carga = cambioCarga(cargaSemanal(todas, hoy));
  return {
    pautas, sesiones, series, ejercicios, historial, atleta, reglas,
    contexto: {
      checkins: (checkins || []).filter((c) => c?.semana_inicio && (!lunes || c.semana_inicio <= lunes)).map((c) => ({ semana_inicio: c.semana_inicio, energia: numero(c.energia), recuperacion: numero(c.recuperacion) })),
      molestias: (molestias || []).filter((m) => lunes && m?.semana_inicio === lunes).map((m) => ({ zona: m.zona, intensidad: numero(m.intensidad) })),
      carga: carga ? { ratio: carga.ratio } : null,
      diasSinEntrenar: diasParado(todas.filter((s) => s.completada).map((s) => s.fecha_realizada), hoy),
      focoAnterior: base.foco || null,
      focoSiguiente: destino?.foco || null,
    },
  };
}

// Lo que se guarda en la pauta de destino al aceptar una propuesta
export const cambiosDePropuesta = (propuesta) => Object.fromEntries(CAMPOS.map((c) => [c, propuesta[c] ?? null]));
// ¿Cambia algo de la pauta de destino si se aplica esta propuesta? Devuelve los campos que cambian.
export function diferencias(pautaDestino, propuesta) {
  const a = campos(pautaLimpia(pautaDestino)), b = cambiosDePropuesta(propuesta);
  const iguales = (x, y) => (x == null && y == null) || (typeof x === 'number' || typeof y === 'number' ? x != null && y != null && Math.abs(Number(x) - Number(y)) < 0.005 : JSON.stringify(x) === JSON.stringify(y));
  return CAMPOS.filter((c) => !iguales(a[c], b[c]));
}

// Una pauta en una línea, para la revisión: «8×82,5 · 8×82,5 · 9×80 kg @8», «3 × 8–12 · 80 kg · RPE 8»
export function textoPauta(p) {
  if (!p) return '';
  if (tieneDetalle(p)) {
    const conKg = p.series_detalle.some((x) => x.kg != null);
    const rpes = [...new Set(p.series_detalle.map((x) => x.rpe ?? null))];
    const serie = (x) => `${x.reps ?? '–'}${x.kg != null ? `×${num(x.kg, 2)}` : ''}${rpes.length > 1 && x.rpe != null ? ` @${num(x.rpe)}` : ''}`;
    return `${p.series_detalle.map(serie).join(' · ')}${conKg ? ' kg' : ' rep'}${rpes.length === 1 && rpes[0] != null ? ` · RPE ${num(rpes[0])}` : ''}`;
  }
  const reps = p.reps_min != null && p.reps_max != null && p.reps_min !== p.reps_max ? `${p.reps_min}–${p.reps_max}` : `${p.reps_max ?? p.reps_min ?? '–'}`;
  const series = esTopBackoff(p) ? `1 × ${reps} + ${p.series - 1} × −${num(p.backoff_pct)} %` : `${p.series} × ${reps}`;
  const esfuerzo = p.rir_objetivo != null ? `RIR ${num(p.rir_objetivo)}` : p.rpe_objetivo != null ? `RPE ${num(p.rpe_objetivo)}` : null;
  return [series, p.carga_sugerida_kg != null ? `${num(p.carga_sugerida_kg, 2)} kg` : null, esfuerzo].filter(Boolean).join(' · ');
}
