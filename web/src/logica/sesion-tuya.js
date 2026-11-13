// (personalización 3, tanda 5) Que la sesión de hoy sea suya, siempre como consejo (la pauta del coach no se toca): con
// el tiempo que tiene, qué podría dejar si va justo; su calentamiento; sus alternativas de siempre, primero; y lo que
// hacía hace un año. Lógica pura.
import { duracionEstimada } from './calculos.js';
import { patronEjercicio } from './diseno.js';
import { diasEntre, sumarDias } from './fechas.js';

// ---------- 1. «¿Cuánto tiempo tienes hoy?» ----------
// ejercicios: las pautas de la sesión ({ id, series, prioridad, descanso_seg, ejercicio: { nombre } }). Lo que se podría
// dejar, por este orden: lo prescindible, los accesorios y, si aún no da, una serie menos en lo muy importante. Lo
// obligatorio, nunca. { quitar: [{ id, nombre, que }], minutos (lo que quedaría), total, cabe }
export const TIEMPOS = [25, 40, 60];
export function siVasJusto(ejercicios = [], minutos) {
  const lista = (ejercicios || []).filter((e) => Number(e.series) > 0);
  const total = duracionEstimada(lista);
  if (!minutos || !lista.length || total <= minutos) return { quitar: [], minutos: total, total, cabe: true };
  const pend = Object.fromEntries(lista.map((e) => [e.id, Number(e.series)]));
  const quitar = [];
  const nombre = (e) => e.ejercicio?.nombre || e.nombre || 'Ejercicio';
  const durar = () => duracionEstimada(lista, pend);
  for (const prio of ['muy_baja', 'baja']) {
    for (const e of [...lista].reverse().filter((x) => x.prioridad === prio)) {
      if (durar() <= minutos) break;
      pend[e.id] = 0;
      quitar.push({ id: e.id, nombre: nombre(e), que: 'dejarlo para otro día' });
    }
  }
  for (const e of [...lista].reverse().filter((x) => x.prioridad === 'media' && Number(x.series) > 2)) {
    if (durar() <= minutos) break;
    pend[e.id] = Number(e.series) - 1;
    quitar.push({ id: e.id, nombre: nombre(e), que: 'una serie menos' });
  }
  const queda = durar();
  return { quitar, minutos: queda, total, cabe: queda <= minutos };
}
export function textoVasJusto(r, minutos) {
  if (!r || r.cabe && !r.quitar.length) return `Con ${minutos} minutos te da para toda la sesión (unos ${r?.total ?? minutos}).`;
  if (!r.quitar.length) return `Con ${minutos} minutos no da para lo obligatorio (unos ${r.minutos}): haz las primeras series de lo importante y cuéntaselo a tu coach.`;
  return r.cabe ? `Con ${minutos} minutos, si vas justo, esto es lo que podrías dejar (te quedaría en unos ${r.minutos}):`
    : `Con ${minutos} minutos no llega ni dejando esto (te quedaría en unos ${r.minutos}): haz lo obligatorio y cuéntaselo a tu coach.`;
}

// ---------- 2. Su calentamiento ----------
// Cinco minutos con los patrones de hoy y sus zonas (las del cuestionario, solo con el consentimiento de salud)
const POR_PATRON = {
  sentadilla: ['Sentadilla sin peso, 10 lentas', 'Tobillo contra la pared, 8 por lado'],
  unilateral: ['Zancada atrás sin peso, 6 por lado'],
  pierna: ['Sentadilla sin peso, 10 lentas'],
  bisagra: ['Buenos días sin peso, 10', 'Puente de glúteo, 10'],
  empuje_h: ['Rotaciones de hombro con banda o palo, 10', 'Flexiones inclinadas, 8'],
  empuje_v: ['Rotaciones de hombro con banda o palo, 10', 'Elevaciones en Y boca abajo, 8'],
  tiron_h: ['Remo con banda, 12'],
  tiron_v: ['Colgarte de la barra, 20 s', 'Remo con banda, 12'],
  core: ['Bicho muerto, 6 por lado'],
};
const POR_ZONA = {
  hombro: 'Rotación externa con banda, 12 por lado (por tu hombro)', rodilla: 'Subidas a un escalón bajo, 8 por lado (por tu rodilla)',
  zona_lumbar: 'Gato-camello, 8, y bird-dog, 6 por lado (por tu zona lumbar)', cadera: '90/90 de cadera, 5 por lado (por tu cadera)',
  tobillo_pie: 'Círculos de tobillo y elevaciones de talón, 10 (por tu tobillo)', codo: 'Extensiones suaves de antebrazo, 10 (por tu codo)',
  muneca_mano: 'Círculos de muñeca y apoyo en palmas, 10 (por tu muñeca)', cuello: 'Retracciones de cuello, 8 (por tu cuello)',
  espalda_alta: 'Rotaciones torácicas en cuadrupedia, 8 por lado (por tu espalda alta)',
};
export function calentamiento(ejercicios = [], zonas = []) {
  const patrones = [...new Set((ejercicios || []).filter((e) => Number(e.series) > 0)
    .map((e) => patronEjercicio(e.ejercicio?.nombre || e.nombre || '', e.ejercicio?.grupos_musculares || e.grupos_musculares || [], e.ejercicio?.tipo || [])))];
  if (!patrones.length || patrones.every((p) => p === 'cardio')) return [];
  const pasos = ['2 minutos de cardio suave (bici, remo o andar rápido)'];
  for (const z of zonas || []) if (POR_ZONA[z] && !pasos.includes(POR_ZONA[z])) pasos.push(POR_ZONA[z]);
  for (const p of patrones) for (const x of POR_PATRON[p] || []) if (!pasos.includes(x) && pasos.length < 6) pasos.push(x);
  pasos.push('Y en el primer ejercicio, tus series de aproximación');
  return pasos;
}

// ---------- 3. Sus alternativas, primero ----------
// elegidas: { ejercicioPautadoId: idDeLaAlternativa } (lo que eligió las otras veces). Las del coach, con la suya delante
export function ordenarAlternativas(alternativas = [], elegida = null) {
  if (!elegida) return alternativas || [];
  const i = (alternativas || []).findIndex((a) => a.id === elegida);
  return i <= 0 ? alternativas || [] : [alternativas[i], ...alternativas.slice(0, i), ...alternativas.slice(i + 1)];
}

// ---------- 4. Su yo de hace un año ----------
// La fecha tope para buscar lo de hace un año (lo último antes de hace 330 días) y si lo que salió vale (de 330 a 400 días)
export const hastaHaceUnAno = (hoy) => sumarDias(hoy, -330);
export function haceUnAno(ultimas, hoy, textoSerie) {
  const f = ultimas?.fecha;
  if (!f || !hoy) return null;
  const d = diasEntre(f, hoy);
  if (d < 330 || d > 400) return null;
  const ss = (ultimas.series || []).filter((s) => Number(s.reps) > 0);
  if (!ss.length) return null;
  const mejor = [...ss].sort((a, b) => (Number(b.kg) || 0) - (Number(a.kg) || 0) || (Number(b.reps) || 0) - (Number(a.reps) || 0))[0];
  return { fecha: f, serie: mejor, texto: `Hace un año, por estas fechas: ${textoSerie ? textoSerie(mejor) : `${mejor.kg} × ${mejor.reps}`}.` };
}
