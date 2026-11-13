// (personalización 3, tanda 7) Que respete cómo es él: su manual de instrucciones, lo que no quiere ver, su ciclo (su
// propio patrón, sin generalidades) y su informe para el médico o el fisio. Lógica pura.
import { diasEntre, sumarDias, lunesDe } from './fechas.js';

// ---------- 9. Su manual de instrucciones ----------
export const FEEDBACK = [['directo', 'Directo', 'Sin rodeos: lo que hay que mejorar, claro'], ['suave', 'Suave', 'Con tacto: primero lo que va bien']];
export const MOTIVA = [['datos', 'Los datos y las cifras'], ['retos', 'Los retos'], ['reconocimiento', 'Que me reconozcan el esfuerzo'], ['compania', 'Entrenar con otros'], ['progreso', 'Ver mi progreso']];
export function textoManual(p) {
  const fb = FEEDBACK.find(([k]) => k === p?.manual_feedback)?.[1];
  const mot = (p?.manual_motiva || []).map((k) => MOTIVA.find(([x]) => x === k)?.[1]).filter(Boolean);
  if (!fb && !mot.length && !p?.manual_evitar) return null;
  return { feedback: fb ? `Feedback ${fb.toLocaleLowerCase('es')}` : null, motiva: mot.length ? mot.join(', ') : null, evitar: p?.manual_evitar || null };
}
// Para «Para hablarle»: la idea, a su manera
export function ideaSegunManual(idea, p) {
  const m = p?.manual_motiva || [];
  if (!idea) return idea;
  if (m.includes('datos')) return `${idea} Le motivan las cifras: dale alguna.`;
  if (m.includes('reconocimiento')) return `${idea} Le motiva que le reconozcan el esfuerzo.`;
  if (m.includes('retos')) return `${idea} Le motivan los retos: proponle uno.`;
  return idea;
}

// ---------- 10. Lo que no quiere ver ----------
export const OCULTABLES = [['peso', 'Sin báscula', 'Oculta tu peso en Hoy y en Progreso'], ['kcal', 'Sin calorías', 'Oculta las calorías en la comida'], ['ranking', 'Sin rankings', 'Oculta las clasificaciones y las comparaciones con otros']];
export function limpiarOcultar(o) {
  const x = o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  return Object.fromEntries(OCULTABLES.map(([k]) => [k, x[k] === true]));
}
export const textoOcultar = (o) => { const n = OCULTABLES.filter(([k]) => o?.[k]).map(([, t]) => t); return n.length ? n.join(', ') : 'Todo a la vista'; };

// ---------- 11. Su ciclo ----------
// inicios: las fechas en que empezó cada regla (las apunta ella, en el móvil). Su duración: la mediana de sus ciclos
// (21 a 40 días; si no, 28). Las fases, por días desde el inicio: menstruación (1–5), folicular, ovulación (unos 3 días
// a mitad de ciclo) y lútea.
export const FASES = [['menstruacion', 'Menstruación'], ['folicular', 'Fase folicular'], ['ovulacion', 'Ovulación'], ['lutea', 'Fase lútea']];
export function duracionCiclo(inicios = []) {
  const f = [...new Set(inicios || [])].sort();
  const d = [];
  for (let i = 1; i < f.length; i++) { const x = diasEntre(f[i - 1], f[i]); if (x >= 21 && x <= 40) d.push(x); }
  if (!d.length) return 28;
  d.sort((a, b) => a - b);
  return d.length % 2 ? d[(d.length - 1) / 2] : Math.round((d[d.length / 2 - 1] + d[d.length / 2]) / 2);
}
export function faseDe(fecha, inicios = []) {
  const f = [...new Set(inicios || [])].sort().filter((x) => x <= fecha);
  if (!f.length) return null;
  const ultimo = f[f.length - 1];
  const largo = duracionCiclo(inicios);
  const dia = diasEntre(ultimo, fecha) + 1;
  if (dia > largo + 7) return null; // sin apuntar el siguiente: no se sabe
  const ov = largo - 14;
  if (dia <= 5) return 'menstruacion';
  if (dia < ov - 1) return 'folicular';
  if (dia <= ov + 1) return 'ovulacion';
  return 'lutea';
}
// Su propio patrón: por fase, sus sesiones, sus récords por sesión y su esfuerzo medio. Con al menos 3 inicios y 12
// sesiones con fase; si las diferencias son pequeñas, lo dice («rindes parecido»). Nada que no salga de sus datos.
export function patronCiclo(entrenos = [], inicios = []) {
  if ([...new Set(inicios || [])].length < 3) return { listo: false, motivo: 'Apunta al menos tres inicios para empezar a ver tu patrón.' };
  const por = Object.fromEntries(FASES.map(([k]) => [k, { sesiones: 0, records: 0, rpe: [], }]));
  for (const x of entrenos || []) {
    const fase = x?.fecha ? faseDe(x.fecha, inicios) : null;
    if (!fase) continue;
    por[fase].sesiones += 1; por[fase].records += Number(x.records) || 0;
    if (Number(x.rpe_sesion) > 0) por[fase].rpe.push(Number(x.rpe_sesion));
  }
  const total = Object.values(por).reduce((t, f) => t + f.sesiones, 0);
  if (total < 12) return { listo: false, motivo: `Con ${total} ${total === 1 ? 'sesión' : 'sesiones'} en tus ciclos aún es pronto: hacen falta unas 12.` };
  const fases = FASES.map(([k, n]) => { const f = por[k]; return { fase: k, nombre: n, sesiones: f.sesiones, records: f.sesiones ? f.records / f.sesiones : null, rpe: f.rpe.length ? f.rpe.reduce((a, b) => a + b, 0) / f.rpe.length : null }; });
  const con = fases.filter((f) => f.sesiones >= 3);
  const tasas = con.map((f) => f.records);
  const media = tasas.reduce((a, b) => a + b, 0) / (tasas.length || 1);
  const mejor = [...con].sort((a, b) => b.records - a.records)[0];
  const parecido = !mejor || con.length < 2 || (Math.max(...tasas) - Math.min(...tasas)) < Math.max(0.15, media * 0.3);
  return {
    listo: true, fases,
    texto: parecido ? 'Con tus datos, rindes parecido en todas las fases: no hay un patrón claro.'
      : `Con tus datos, tus récords caen más en la ${mejor.nombre.toLocaleLowerCase('es').replace(/^fase /, 'fase ')} (${String(Math.round(mejor.records * 100) / 100).replace('.', ',')} por sesión).`,
  };
}

// ---------- 12. Su informe para el médico o el fisio ----------
// Las últimas N semanas: sesiones, minutos y esfuerzo por semana, sus molestias (del check-in) y su sueño (si lo tiene)
export function informeSalud({ entrenos = [], molestias = [], sueno = [], hoy, semanas = 8, nombre = '' } = {}) {
  const desde = sumarDias(lunesDe(hoy), -7 * (semanas - 1));
  const filas = [];
  for (let i = 0; i < semanas; i++) {
    const l = sumarDias(desde, 7 * i), fin = sumarDias(l, 6);
    const es = (entrenos || []).filter((x) => x.fecha >= l && x.fecha <= fin);
    const rpes = es.map((x) => Number(x.rpe_sesion)).filter((v) => v > 0);
    const mol = (molestias || []).filter((m) => m.semana_inicio === l && Number(m.intensidad) > 0).map((m) => ({ zona: m.zona, intensidad: Number(m.intensidad) }));
    filas.push({ lunes: l, sesiones: es.length, minutos: es.reduce((t, x) => t + (Number(x.duracion_min) || 0), 0), rpe: rpes.length ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null, molestias: mol });
  }
  const conSueno = (sueno || []).filter((d) => d.fecha >= desde && Number(d.sueno_min) > 0);
  const suenoMedio = conSueno.length ? Math.round(conSueno.reduce((t, d) => t + Number(d.sueno_min), 0) / conSueno.length) : null;
  const totalSes = filas.reduce((t, f) => t + f.sesiones, 0);
  return { nombre, desde, hasta: hoy, semanas: filas, totalSesiones: totalSes, mediaSemanal: Math.round((totalSes / semanas) * 10) / 10, suenoMedio };
}
