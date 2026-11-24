// (v0.228) Carrera, tanda 2 de la revisión del experto («claude/carrera-revision-experto-respuesta.md»): la mañana siguiente
// (R45) y el dolor de hueso (R22). Todo puro. La ficha de salud para correr (R44) está en carrera.js (saludCarrera).
//   · R45 Tras una salida con dolor de 3/10 o más, o tras calidad, tirada larga, carrera o test, una pregunta a la mañana
//     siguiente: el dolor de 0 a 10; mejor, igual o peor que antes de salir; dónde y, si es en la pierna, si duele en un
//     punto del hueso y al saltar a la pata coja (Silbernagel 2007, Warden 2021).
//   · La escala del dolor, una sola (pregunta 6 de la revisión): 0-2, verde; 3-5, se acepta si a la mañana siguiente está
//     como antes de salir y no empeora de semana en semana, pero no se sube; 6 o más, o peor dos mañanas seguidas, parar y
//     valorar. El dolor en un punto del hueso (o en la cadera o la ingle) sale de la escala: desde 3/10, parar y valorar.
import { sumarDias, lunesDe } from './fechas.js';

export const DONDE_MANANA = [['pie', 'Pie o tobillo'], ['tibia', 'Espinilla'], ['gemelo', 'Gemelo o Aquiles'], ['rodilla', 'Rodilla'],
  ['muslo', 'Muslo'], ['cadera', 'Cadera o ingle'], ['espalda', 'Espalda'], ['otro', 'Otro sitio']];
// Dónde se pregunta por el hueso y el salto (la pierna)
export const PIERNA_MANANA = ['pie', 'tibia', 'gemelo', 'rodilla', 'muslo', 'cadera'];
export const COMO_MANANA = [['mejor', 'Mejor'], ['igual', 'Igual'], ['peor', 'Peor']];
const nombreDonde = (k) => (DONDE_MANANA.find(([x]) => x === k) || [])[1] || k || '';
const DURAS = ['calidad', 'larga', 'carrera', 'test'];

// La salida de ayer que pide la pregunta de esta mañana (o null): con dolor de 3/10 o más, o de calidad, tirada larga,
// carrera o test; y solo si aún no ha contestado hoy
export function mananaPendiente({ hechas = [], mananas = [], hoy }) {
  if (!hoy || (mananas || []).some((m) => m?.fecha === hoy)) return null;
  const ayer = sumarDias(hoy, -1);
  return (hechas || []).find((x) => String(x?.fecha_realizada || '').slice(0, 10) === ayer && x?.cardio_hecho?.modalidad === 'carrera'
    && ((Number(x.cardio_hecho.dolor) || 0) >= 3 || DURAS.includes(x?.cardio?.tipo))) || null;
}

// Lo que se guarda: { fecha, sesion_id, dolor, como, donde, hueso, salto } (hueso y salto, solo en la pierna) o { error }
export function limpiarManana(x = {}) {
  const dolor = Number(x.dolor);
  if (!Number.isInteger(dolor) || dolor < 0 || dolor > 10) return { error: 'El dolor, de 0 a 10.' };
  if (!COMO_MANANA.some(([k]) => k === x.como)) return { error: 'Di si estás mejor, igual o peor que antes de salir.' };
  if (!x.fecha) return { error: 'Falta el día.' };
  const donde = dolor > 0 && DONDE_MANANA.some(([k]) => k === x.donde) ? x.donde : null;
  const pierna = donde && PIERNA_MANANA.includes(donde);
  return {
    manana: { fecha: x.fecha, sesion_id: x.sesion_id || null, dolor, como: x.como, donde,
      hueso: pierna ? x.hueso === true : null, salto: pierna ? x.salto === true : null },
    error: null,
  };
}

// ¿Puede ser el hueso? Duele en un punto del hueso o al saltar a la pata coja, o en la cadera o la ingle
export const esHueso = (m) => !!m && (m.hueso === true || m.salto === true || m.donde === 'cadera');

// Lo que dice una respuesta, para enseñarla: «Peor que antes de salir · 4/10 en la espinilla · en un punto del hueso»
export function textoManana(m) {
  if (!m) return '';
  const como = { mejor: 'Mejor que antes de salir', igual: 'Igual que antes de salir', peor: 'Peor que antes de salir' }[m.como] || '';
  const dolor = m.dolor > 0 ? `${m.dolor}/10${m.donde ? ` (${nombreDonde(m.donde).toLowerCase()})` : ''}` : 'sin dolor';
  const hueso = [m.hueso ? 'en un punto del hueso' : '', m.salto ? 'duele al saltar' : ''].filter(Boolean).join(' y ');
  return [como, dolor, hueso].filter(Boolean).join(' · ');
}

// Lo que se le dice al contestar: { nivel: 'verde' | 'ambar' | 'rojo', texto } (tú)
export function respuestaManana(m, anterior = null) {
  if (!m) return null;
  if (esHueso(m) && m.dolor >= 3) return { nivel: 'rojo', texto: 'Puede ser el hueso: hoy no corras ni saltes y cuéntaselo a tu coach. Ahí no vale el límite de 5 sobre 10.' };
  if (m.dolor >= 6) return { nivel: 'rojo', texto: 'Con 6 sobre 10 o más, hoy no corras y cuéntaselo a tu coach.' };
  if (m.como === 'peor' && anterior?.como === 'peor') return { nivel: 'rojo', texto: 'Dos mañanas seguidas peor que antes de salir: para y cuéntaselo a tu coach.' };
  if (m.como === 'peor' || m.dolor >= 3 || esHueso(m)) return { nivel: 'ambar', texto: 'Se acepta, pero esta semana sin subir. Si mañana sigues peor, para y avisa a tu coach.' };
  return { nivel: 'verde', texto: 'Bien: sigue con lo previsto.' };
}

// Los avisos para el coach con las mañanas de los últimos 7 días (la más reciente, primero)
// → [{ id, nivel, titulo, texto, propuesta }]
export function avisosMananas(mananas = [], hoy) {
  if (!hoy) return [];
  const desde = sumarDias(hoy, -7);
  const fecha = (l) => l.slice(8, 10).replace(/^0/, '') + '/' + l.slice(5, 7).replace(/^0/, '');
  const recientes = (mananas || []).filter((m) => m?.fecha && m.fecha >= desde && m.fecha <= hoy).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const out = [];
  const hueso = recientes.find((m) => esHueso(m) && m.dolor >= 1);
  if (hueso) {
    const rojo = hueso.dolor >= 3;
    out.push({ id: 'manana-hueso', nivel: rojo ? 'rojo' : 'ambar', titulo: rojo ? 'Puede ser el hueso' : 'Vigilar: ¿el hueso?',
      texto: `El ${fecha(hueso.fecha)}, a la mañana siguiente: ${textoManana(hueso).toLowerCase()}. ${rojo
        ? 'El dolor de hueso no entra en el límite de 5/10: parar de correr y que lo valore un médico.' : 'Con dolor de hueso, sin subir; si llega a 3/10, parar y valorar.'}`,
      propuesta: rojo ? { tipo: 'parar', texto: 'Parar y valorar' } : null });
  }
  const alto = recientes.find((m) => m.dolor >= 6);
  if (alto && !(hueso && hueso.dolor >= 3)) {
    out.push({ id: 'manana-alto', nivel: 'rojo', titulo: `Se levantó con ${alto.dolor}/10`,
      texto: `El ${fecha(alto.fecha)}, a la mañana siguiente. Con 6/10 o más, mejor parar y valorarlo antes de seguir.`, propuesta: { tipo: 'parar', texto: 'Parar y valorar' } });
  }
  const [m0, m1] = (mananas || []).filter((m) => m?.fecha && m.fecha <= hoy && m.fecha >= sumarDias(hoy, -14)).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  if (m0?.como === 'peor' && m1?.como === 'peor' && m0.fecha >= desde && !out.some((a) => a.nivel === 'rojo')) {
    out.push({ id: 'manana-peor', nivel: 'rojo', titulo: 'Dos mañanas seguidas peor',
      texto: `El ${fecha(m1.fecha)} y el ${fecha(m0.fecha)} se levantó peor que antes de salir: parar y valorar.`, propuesta: { tipo: 'parar', texto: 'Parar y valorar' } });
  } else if (m0?.como === 'peor' && m0.fecha >= desde && !out.length) {
    out.push({ id: 'manana-peor', nivel: 'ambar', titulo: 'Una mañana peor',
      texto: `El ${fecha(m0.fecha)} se levantó peor que antes de salir: esta semana, sin subir.`, propuesta: null });
  }
  return out;
}

// Las de una semana (por su lunes): para el ajuste de la siguiente
export const mananasDeSemana = (mananas = [], lunes) => (mananas || []).filter((m) => m?.fecha && lunesDe(m.fecha) === lunes);
