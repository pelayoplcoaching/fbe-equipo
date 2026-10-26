import { sugerenciaProgresion, incrementoCarga, enReserva, textoSerie, num, esTopBackoff } from './calculos.js';

// Cargas sugeridas para una semana a partir de lo que hizo el atleta en la anterior del mismo bloque.
// Cada pauta de la semana se empareja con la de la anterior (misma sesión por orden y mismo ejercicio;
// si no, el mismo ejercicio en cualquier sesión). Reglas, en este orden:
//  · semana de descarga → un 10 % menos que lo que movió, redondeado a su salto de carga;
//  · se pasó de esfuerzo (alguna serie de trabajo más de 1 punto por encima de lo pautado) → la misma carga;
//  · doble progresión (llegó al tope del rango en todas sin pasarse) → subir un salto;
//  · si no, la misma carga con la que trabajó.
// Si no hay series de ese ejercicio (o lo cambió por otro), no se propone nada.

const redondear = (kg, paso) => Math.round(kg / paso) * paso;

export function sugerirCargas({ ahora, antes, series, sesionesAhora, sesionesAntes, nombres = {}, foco = null }) {
  const ordenAhora = Object.fromEntries(sesionesAhora.map((s) => [s.id, s.orden]));
  const ordenAntes = Object.fromEntries(sesionesAntes.map((s) => [s.id, s.orden]));
  const usadas = new Set();
  const filas = [];
  for (const p of ahora) {
    let previa = antes.find((q) => !usadas.has(q.id) && q.ejercicio_id === p.ejercicio_id && ordenAntes[q.sesion_id] === ordenAhora[p.sesion_id]);
    if (!previa) previa = antes.find((q) => !usadas.has(q.id) && q.ejercicio_id === p.ejercicio_id);
    const nombre = nombres[p.ejercicio_id] || 'Ejercicio';
    const actual = p.carga_sugerida_kg != null ? Number(p.carga_sugerida_kg) : null;
    const base = { pauta_id: p.id, sesion_id: p.sesion_id, ejercicio: nombre, actual };
    if (!previa) { filas.push({ ...base, propuesta: null, motivo: 'No estaba la semana anterior' }); continue; }
    usadas.add(previa.id);
    const hechas = (series[previa.id] || []).filter((s) => !s.sustituto_id && Number(s.kg) > 0 && Number(s.reps) > 0);
    if (!hechas.length) { filas.push({ ...base, antes: null, propuesta: null, motivo: (series[previa.id] || []).some((s) => s.sustituto_id) ? 'Lo cambió por otro ejercicio' : 'Sin series con carga la semana anterior' }); continue; }
    const kgTrabajo = Math.max(...hechas.map((s) => Number(s.kg)));
    const trabajo = hechas.filter((s) => Number(s.kg) === kgTrabajo);
    const antesTexto = `${num(kgTrabajo, 2)} kg: ${trabajo.map((s) => textoSerie(s).replace(/^[\d,]+\u00d7/, '')).join(', ')}`;
    const paso = incrementoCarga(nombre, kgTrabajo);
    const objetivo = p.rir_objetivo != null ? Number(p.rir_objetivo) : p.rpe_objetivo != null ? 10 - Number(p.rpe_objetivo)
      : previa.rir_objetivo != null ? Number(previa.rir_objetivo) : previa.rpe_objetivo != null ? 10 - Number(previa.rpe_objetivo) : null;
    const reservas = trabajo.map(enReserva).filter((x) => x != null);
    let propuesta, motivo, tipo;
    // De top + back-off a series iguales: la top de la semana pasada no dice qué carga aguantan todas las series
    if (foco !== 'descarga' && esTopBackoff(previa) && !esTopBackoff(p)) {
      filas.push({ ...base, antes: antesTexto, propuesta: null, motivo: 'Pasa de top + back-off a series iguales: ponle tú la carga' });
      continue;
    }
    if (foco === 'descarga') {
      propuesta = redondear(kgTrabajo * 0.9, paso); tipo = 'bajar'; motivo = 'Descarga: un 10 % menos';
    } else if (objetivo != null && reservas.some((r) => r < objetivo - 1)) {
      propuesta = kgTrabajo; tipo = 'mantener'; motivo = 'Se pasó del esfuerzo pautado';
    } else {
      const s = sugerenciaProgresion({ ...p, series: p.series ?? previa.series, reps_min: p.reps_min ?? previa.reps_min, reps_max: p.reps_max ?? previa.reps_max, rir_objetivo: objetivo != null ? objetivo : null, rpe_objetivo: null }, hechas, { nombre });
      if (s?.tipo === 'subir') { propuesta = s.kg; tipo = 'subir'; motivo = `Llegó a ${p.reps_max ?? previa.reps_max} en ${esTopBackoff(p) ? 'la serie top' : 'todas'} sin pasarse`; }
      else if (s?.tipo === 'mantener') { propuesta = kgTrabajo; tipo = 'mantener'; motivo = 'No completó el rango en alguna serie'; }
      else { propuesta = kgTrabajo; tipo = 'mantener'; motivo = 'Dentro del rango: que sume repeticiones'; }
    }
    filas.push({ ...base, antes: antesTexto, propuesta, tipo, motivo, cambia: propuesta !== actual });
  }
  return filas;
}
