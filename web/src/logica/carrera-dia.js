// (v0.229) Carrera, mejoras 16 y 17 con la revisión del experto (R33-R41 y R46; doc del proyecto
// «claude/carrera-revision-experto-respuesta.md» y «claude/carrera-reglas-tanda4.md»): el plan del día de la carrera y la
// semana de después. Todo puro; lo marcado como práctica no sale de un estudio, sino de lo habitual entre entrenadores.
//   · R33 Calentar: 5 y 10 km, 10-15 min suaves y 4-6 rectas; media, 5-10 min y 2-3 rectas; maratón, 5 min andando o
//     trotando. Con mucha espera en el cajón: movilidad y 2-3 aceleraciones cortas antes de salir.
//   · R34 Ritmo parejo (Abbiss y Laursen 2008; March 2011); con cuestas, esfuerzo parejo. En el primer maratón o con calor,
//     el extremo lento de la previsión (R5); si el objetivo es más rápido que el extremo rápido, aviso.
//   · R35 Comer antes (Thomas 2016): 5 y 10 km, desayuno ligero conocido 2-3 h antes (en torno a 1 g/kg de hidratos); media
//     y maratón, 1-4 g/kg 1-4 h antes; maratón y media de más de 90 min, 7-10 g/kg/día los 1-2 días de antes, bajos en
//     fibra. Con diabetes con insulina o sulfonilureas, lo pauta el coach.
//   · R36 Durante (Jeukendrup 2014): hasta 45 min, nada; de 45 a 75 min, agua o un poco (o enjuagarse la boca); hasta 2,5 h,
//     30-60 g/h; más de 2,5 h, 60 g/h y hasta 90 g/h solo con mezcla de glucosa y fructosa probada entrenando.
//   · R37 Beber según la sed, sin ganar peso; con más de 4 h, no beber en todos los avituallamientos «por si acaso»
//     (Hew-Butler 2015; Almond 2005).
//   · R38 Cafeína opcional: 3 mg/kg unos 60 min antes si ya la toma y la ha probado (Maughan 2018); no con arritmias,
//     hipertensión mal controlada o embarazo; contar la de los geles.
//   · R39 Si va mal: bajar antes de que sea tarde, andar en los avituallamientos; con calor, bajar antes; confusión,
//     tambaleo o conducta extraña con calor → parar y pedir ayuda (y la alarma de siempre).
//   · R46 Calor y analgésicos: con 20 °C o más, el extremo lento y por sensaciones; con 28 °C o más (o aviso de calor de la
//     organización), sin buscar marca. Nada de analgésicos «por si acaso» las 24 h antes ni durante (Küster 2013).
//   · R40 Después: 5 y 10 km, 2-3 días suaves o de descanso; media, una semana suave sin calidad; maratón, dos semanas
//     (3-5 días de descanso o muy suave, después rodajes cortos y suaves, sin calidad); más de 60 años o primer maratón, 3
//     semanas sin calidad. Las agujetas (difusas, en las dos piernas, mejoran cada día; normales 2-4 días) no avisan: solo
//     el dolor localizado (un punto, un lado, hueso o tendón) de más de 3/10 o que no mejora en 72 h.
//   · R41 Con el resultado: proponer el ritmo umbral nuevo y guardar lo real frente a lo previsto.
import { sumarDias, lunesDe, diasEntre } from './fechas.js';
import { predecirTiempo, ultimaConResultado, umbralDesdeCarrera, fmtTiempo, fmtRitmo, ALARMA } from './carrera.js';

const tramo = (km) => (km >= 40 ? 'maraton' : km >= 20 ? 'media' : km >= 9 ? '10k' : '5k');
const g = (x) => Math.round(x / 5) * 5;

// La previsión para la carrera (R5) con la última carrera con resultado; null sin ella
export function previsionCarrera({ evento, eventos = [], kmSemana = null }) {
  if (!evento?.distancia_km) return null;
  const base = ultimaConResultado(eventos, evento.id);
  if (!base) return null;
  const primero = !(eventos || []).some((e) => e.id !== evento.id && e.fecha < evento.fecha && Number(e.distancia_km) >= 40 && Number(e.resultado_seg) > 0);
  return predecirTiempo(base.resultado_seg, base.distancia_km, evento.distancia_km, { kmSemana, primero });
}

// Los pasos de una carrera a ritmo parejo: cada km (5 y 10 km) o cada 5 km (media y maratón), y la meta.
// → [{ km, seg (acumulado) }]
export function pasosCarrera(km, segObjetivo) {
  const d = Number(km), t = Number(segObjetivo);
  if (!(d > 0 && t > 0)) return [];
  const cada = d >= 20 ? 5 : 1;
  const out = [];
  for (let k = cada; k < d - 0.05; k += cada) out.push({ km: k, seg: Math.round((t * k) / d) });
  out.push({ km: Math.round(d * 100) / 100, seg: Math.round(t) });
  return out;
}

// El plan del día. evento: la carrera; eventos: todas (para la previsión); pesoKg: su último peso (o null);
// temperatura: la prevista a la hora de salida (o null); prudente: más de 60 o lesión (su ficha de salud).
// → { tramo, objetivo, previsto, ritmo, pasos, avisos[], secciones: [{ id, titulo, lineas[] }] }
export function planDiaCarrera({ evento, eventos = [], pesoKg = null, temperatura = null, kmSemana = null }) {
  if (!evento?.distancia_km) return null;
  const km = Number(evento.distancia_km);
  const t = tramo(km);
  const prev = previsionCarrera({ evento, eventos, kmSemana });
  const primero = t === 'maraton' && !(eventos || []).some((e) => e.id !== evento.id && e.fecha < evento.fecha && Number(e.distancia_km) >= 40 && Number(e.resultado_seg) > 0);
  const calor = Number.isFinite(Number(temperatura)) && temperatura !== null && temperatura !== '' ? Number(temperatura) : null;
  const avisos = [];
  // (R34, R46) El tiempo al que salir: el objetivo del coach o, sin él, lo previsto; en el primer maratón o con calor, el
  // extremo lento de la previsión
  let objetivo = Number(evento.objetivo_seg) || (prev ? prev.seg : null);
  let porQue = evento.objetivo_seg ? 'el objetivo de tu coach' : prev ? 'tu tiempo previsto' : null;
  if (prev?.hasta && (primero || (calor != null && calor >= 20)) && (!objetivo || objetivo <= prev.hasta)) {
    objetivo = prev.hasta;
    porQue = primero ? 'el extremo prudente de tu previsión, por ser tu primer maratón' : 'el extremo prudente de tu previsión, por el calor';
  }
  if (evento.objetivo_seg && prev && Number(evento.objetivo_seg) < (prev.desde || prev.seg) * 0.995) {
    avisos.push(`El objetivo (${fmtTiempo(evento.objetivo_seg)}) es más rápido que lo que dicen tus carreras (${fmtTiempo(prev.desde || prev.seg)}${prev.hasta ? `-${fmtTiempo(prev.hasta)}` : ''}): sal con calma.`);
  }
  if (calor != null && calor >= 28) avisos.push('Con 28 °C o más (o si la organización avisa de calor), hoy no es día de buscar marca: corre por sensaciones.');
  else if (calor != null && calor >= 20) avisos.push('Con 20 °C o más, mejor un ritmo algo más lento y correr por sensaciones.');
  const ritmo = objetivo ? Math.round(objetivo / km) : null;
  const horas = objetivo ? objetivo / 3600 : null;
  const secciones = [];
  // R33 Calentar
  secciones.push({ id: 'calentar', titulo: 'Calentar', lineas: [
    t === 'maraton' ? '5 minutos andando o trotando, sin gastar.' : t === 'media' ? '5-10 minutos suaves y 2-3 rectas.' : '10-15 minutos suaves y 4-6 rectas.',
    'Si hay mucha espera en el cajón: movilidad y 2-3 aceleraciones cortas antes de salir.',
  ] });
  // R34 Ritmo
  secciones.push({ id: 'ritmo', titulo: 'El ritmo', lineas: [
    ritmo ? `A ritmo parejo: ${fmtRitmo(ritmo)} min/km, para ${fmtTiempo(objetivo)} (${porQue}).` : 'A ritmo parejo, de principio a fin: salir más rápido de la cuenta se paga al final.',
    ...(t === 'media' || t === 'maraton' ? ['El primer kilómetro, unos segundos más lento.'] : []),
    'Con cuestas, el esfuerzo parejo, no el ritmo: subiendo se va más lento y bajando se recupera.',
  ] });
  // R35 Comer antes
  const peso = Number(pesoKg) > 30 && Number(pesoKg) < 250 ? Number(pesoKg) : null;
  const gKg = (a, b) => (peso ? ` (unos ${g(a * peso)}${b ? `-${g(b * peso)}` : ''} g de hidratos)` : '');
  const antes = t === '5k' || t === '10k'
    ? [`Un desayuno ligero que ya conozcas, 2-3 horas antes${gKg(1)}.`]
    : [`Una comida conocida, rica en hidratos y baja en grasa y fibra, 1-4 horas antes: 1-4 g por kg${gKg(1, 4)}.`];
  if (t === 'maraton' || (t === 'media' && horas != null && horas > 1.5)) antes.push(`Los 1-2 días de antes, más hidratos: 7-10 g por kg al día${peso ? ` (unos ${g(7 * peso)}-${g(10 * peso)} g)` : ''}, bajos en fibra.`);
  antes.push('Nada nuevo el día de la carrera.', 'Si tienes diabetes y te pinchas insulina o tomas sulfonilureas, esto te lo pauta tu coach.');
  secciones.push({ id: 'antes', titulo: 'Comer antes', lineas: antes });
  // R36, R37 Durante
  const durante = [];
  if (horas == null) durante.push('Hasta 45 minutos, nada; hasta 75, agua o un poco; hasta 2 horas y media, 30-60 g de hidratos por hora; más, 60 g por hora.');
  else if (horas < 0.75) durante.push('No hace falta comer nada; agua si hace calor.');
  else if (horas <= 1.25) durante.push('Agua o un poco de hidratos (o enjuagarte la boca con una bebida con azúcar).');
  else if (horas <= 2.5) durante.push('30-60 g de hidratos por hora (geles o bebida), los que ya hayas probado entrenando.');
  else durante.push('60 g de hidratos por hora; hasta 90 g solo si has probado entrenando geles con mezcla de glucosa y fructosa.');
  durante.push('Bebe según la sed, sin pasarte: ganar peso bebiendo es peligroso.');
  if (horas != null && horas > 4) durante.push('Si vas a tardar más de 4 horas, no bebas en todos los avituallamientos «por si acaso».');
  secciones.push({ id: 'durante', titulo: 'Durante', lineas: durante });
  // R38 Cafeína
  secciones.push({ id: 'cafeina', titulo: 'Cafeína (si quieres)', lineas: [
    `${peso ? `Unos ${Math.round((3 * peso) / 10) * 10} mg` : '3 mg por kg'}, unos 60 minutos antes, solo si ya la tomas y la has probado entrenando. Cuenta la de los geles.`,
    'No con arritmias, tensión alta mal controlada o embarazo.',
  ] });
  // R46 Analgésicos
  secciones.push({ id: 'analgesicos', titulo: 'Analgésicos', lineas: [
    'Nada de analgésicos «por si acaso» (ibuprofeno, aspirina…) las 24 horas antes ni durante. La medicación que te ha pautado tu médico, como siempre.',
  ] });
  // R39 Si va mal
  secciones.push({ id: 'mal', titulo: 'Si va mal', lineas: [
    'Baja el ritmo antes de que sea tarde y, si hace falta, anda en los avituallamientos: lo importante es llegar bien.',
    'Con calor, baja antes. Si notas confusión, tambaleo o algo raro, para y pide ayuda.',
    ALARMA,
  ] });
  return { tramo: t, km, objetivo, porQue, previsto: prev, ritmo, pasos: pasosCarrera(km, objetivo), avisos, secciones, primero };
}

// R40 La recuperación propuesta tras la carrera: { dias, semanas, sinCalidad, texto, semanasPlan (para el plan) }
export function recuperacion({ km, prudente = false, primero = false }) {
  const t = tramo(Number(km));
  if (t === '5k' || t === '10k') return { tramo: t, semanas: 0, sinCalidad: 3, texto: '2-3 días suaves o de descanso y, desde ahí, el plan normal.' };
  if (t === 'media') return { tramo: t, semanas: 1, sinCalidad: 7, texto: 'Una semana suave, sin calidad.' };
  const tres = prudente || primero;
  return { tramo: t, semanas: tres ? 3 : 2, sinCalidad: tres ? 21 : 14,
    texto: `${tres ? 'Tres' : 'Dos'} semanas: los primeros 3-5 días, descanso o muy suave (andar, bici suave); después, rodajes cortos y suaves, sin calidad${tres ? ` (${prudente ? 'más de 60 años o vuelta de una lesión' : 'su primer maratón'})` : ''}.` };
}

// Las semanas de recuperación para su plan (desde el lunes siguiente a la carrera): rodajes cortos y suaves, sin calidad
export function semanasRecuperacion({ fecha, km, dias = 3, kmAntes = 20, prudente = false, primero = false }) {
  const r = recuperacion({ km, prudente, primero });
  if (!r.semanas) return [];
  const d = Math.max(2, Math.min(4, Number(dias) || 3));
  const out = [];
  for (let i = 0; i < r.semanas; i++) {
    const lunes = sumarDias(lunesDe(fecha), 7 * (i + 1));
    const f = i === 0 ? 0.3 : i === 1 ? 0.5 : 0.65;
    const kmSem = Math.max(d * 3, Math.round(Number(kmAntes || 20) * f));
    const dias7 = d === 2 ? [3, 6] : d === 3 ? [2, 4, 7] : [1, 3, 5, 7];
    const sesiones = dias7.map((dia, j) => (i === 0 && j === 0
      ? { tipo: 'recuperacion', titulo: 'Andar o bici suave', dia, minutos: 30, nota: 'Muy suave: las agujetas son normales los primeros días.' }
      : { tipo: 'facil', titulo: 'Rodaje suave', dia, km: Math.max(3, Math.round((kmSem / d) * 10) / 10), zona: 2 }));
    const suma = Math.round(sesiones.reduce((a, x) => a + (Number(x.km) || 0), 0));
    out.push({ lunes, etiqueta: 'Recuperación', km_min: Math.max(1, Math.round(suma * 0.9)), km_max: Math.max(2, Math.round(suma * 1.1)),
      clave: 'Recuperar: corto, suave y sin calidad. Agujetas, normales; un dolor en un punto de más de 3/10 o que no mejora en 72 h, no.', sesiones });
  }
  return out;
}

// R41 Con el resultado: el ritmo umbral que sale de él y lo real frente a lo previsto (1,04 = un 4 % más lento)
export function trasLaCarrera({ evento, eventos = [], kmSemana = null }) {
  if (!evento?.resultado_seg || !evento?.distancia_km) return null;
  const prev = previsionCarrera({ evento, eventos, kmSemana });
  const umbral = umbralDesdeCarrera(evento.resultado_seg, evento.distancia_km);
  return { umbral, real: Number(evento.resultado_seg), previsto: prev?.seg || null, ratio: prev?.seg ? Math.round((evento.resultado_seg / prev.seg) * 100) / 100 : null };
}

// ¿Es la semana de la carrera (o la carrera es en 7 días o menos)?
export const esSemanaDeCarrera = (evento, hoy) => !!evento?.fecha && !!hoy && evento.fecha >= hoy && diasEntre(hoy, evento.fecha) <= 7;
