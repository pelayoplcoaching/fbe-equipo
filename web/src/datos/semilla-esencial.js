// La demo de FBE Esencial (?demo=esencial): dos atletas ficticios que van por su cuenta, con la plantilla
// «Primeras 4 semanas» de la guía del vídeo del 3/1/2027. Sirve para grabar 10-15 segundos de la app (el cuestionario de
// salud, la semana 1 con los cinco ejercicios, apuntar kilos y la pantalla de marcas) y para las capturas de la web.
// Sin datos reales: nombres, cifras y respuestas inventados. Va aparte de la demo de siempre (otra clave en el
// almacenamiento), para no cambiar nada de lo que miran las pruebas.
//   · Marina Ortega: empieza esta semana; aún no ha rellenado el cuestionario (le sale el de salud).
//   · Tomás Rey: ha terminado las cuatro semanas; sus marcas de la semana 4 están para verlas.
import { filasPrimeras4, PRIMERAS_4, MODALIDAD_POR_SU_CUENTA } from '../logica/esencial.js';
import { sumarDias } from '../logica/fechas.js';

// Los ejercicios de la guía con su nombre de la guía (la demo los añade si no están): grupos, tipo y si van por tiempo
const EJERCICIOS_GUIA = [
  ['Prensa de piernas', ['cuadriceps', 'gluteo'], ['multiarticular']],
  ['Sentadilla a un banco', ['cuadriceps', 'gluteo'], ['multiarticular']],
  ['Peso muerto rumano con mancuernas', ['isquiotibiales', 'gluteo'], ['multiarticular']],
  ['Puente de glúteo', ['gluteo', 'isquiotibiales'], ['multiarticular']],
  ['Press de pecho en máquina', ['pectoral', 'triceps', 'deltoides'], ['multiarticular']],
  ['Flexiones', ['pectoral', 'triceps', 'deltoides'], ['multiarticular']],
  ['Jalón al pecho', ['espalda', 'biceps'], ['multiarticular']],
  ['Remo en máquina', ['espalda', 'biceps'], ['multiarticular']],
  ['Plancha abdominal', ['abdominales'], ['aislamiento'], true],
  ['Curl de bíceps', ['biceps'], ['aislamiento']],
];

// Lo que hizo Tomás cada semana (kilos de la mejor serie; la plancha, segundos): sube como dice la guía
const TOMAS = {
  'Prensa de piernas': [60, 70, 80, 85],
  'Peso muerto rumano con mancuernas': [10, 12, 14, 16],
  'Press de pecho en máquina': [25, 30, 32.5, 35],
  'Jalón al pecho': [30, 35, 37.5, 40],
  'Plancha abdominal': [25, 30, 36, 42],
};

export function sembrarEsencial(db, { hoy, lunesHoy, ahoraISO, uuid, usuario, versionLegal }) {
  // Los ejercicios (con sus alternativas, por id, como en Supabase)
  const ej = Object.fromEntries(db.ejercicios.map((e) => [e.nombre, e]));
  for (const [nombre, grupos, tipo, porTiempo] of EJERCICIOS_GUIA) {
    if (!ej[nombre]) {
      ej[nombre] = { id: uuid(), nombre, variante: null, grupos_musculares: grupos, video_url: null, instrucciones: null, errores: null, tipo, rango_reps: null, activo: true, creado_en: ahoraISO, alternativas: [] };
      db.ejercicios.push(ej[nombre]);
    }
    if (porTiempo) ej[nombre].por_tiempo = true;
  }
  for (const e of PRIMERAS_4.ejercicios) {
    const a = ej[e.nombre], b = ej[e.alternativa];
    if (a && b && !a.alternativas.includes(b.id)) a.alternativas = [b.id, ...a.alternativas];
  }

  const atleta = ({ email, nombre, alta, objetivo }) => {
    const perfil = usuario(email, nombre.split(' ')[0], 'atleta');
    const a = { id: uuid(), perfil_id: perfil, nombre, email, estado: 'activo', fecha_alta: alta, objetivo, notion_url: null, progresion_auto: true, volumen_objetivo: null,
      creado_en: ahoraISO, nivel: 'novato', nutricion: false, modalidad: MODALIDAD_POR_SU_CUENTA };
    db.atletas.push(a);
    for (const tipo of ['privacidad', 'datos_salud']) db.consentimientos.push({ id: uuid(), perfil_id: perfil, tipo, version: '2026-10', aceptado_en: ahoraISO, revocado_en: null });
    (db.privacidad_vista ||= []).push({ usuario_id: perfil, version: versionLegal, vista_en: ahoraISO });
    // (el cuestionario de objetivos es para quien lleva seguimiento: aquí no sale)
    (db.objetivos_rondas ||= []).push({ atleta_id: a.id, contestado_en: ahoraISO });
    return a;
  };

  // El bloque de la plantilla, desde un lunes; con `hecho(semana, ejercicio, serie)` se apuntan las series de las semanas
  // que ya han pasado (devuelve { kg, reps } o null)
  function bloque(a, inicio, hecho = null) {
    const b = { id: uuid(), atleta_id: a.id, es_plantilla: false, numero: 1, nombre: PRIMERAS_4.nombre, foco: PRIMERAS_4.foco, objetivo: PRIMERAS_4.objetivo, descripcion: PRIMERAS_4.descripcion,
      fecha_inicio: inicio, fecha_fin: sumarDias(inicio, 7 * PRIMERAS_4.semanas.length - 1), estado: 'activo', creado_en: ahoraISO, objetivo_logrado: null };
    db.bloques.push(b);
    for (const w of filasPrimeras4()) {
      const fecha = sumarDias(inicio, 7 * (w.numero - 1));
      const semana = { id: uuid(), bloque_id: b.id, numero: w.numero, foco: PRIMERAS_4.foco, fecha_inicio: fecha, nota_coach: w.nota, programacion: 'programada', marcas: w.marcas };
      db.semanas.push(semana);
      for (const s of w.sesiones) {
        const dia = sumarDias(fecha, s.orden === 1 ? 0 : 3);   // dos días que no vayan seguidos: lunes y jueves
        const sesion = { id: uuid(), semana_id: semana.id, orden: s.orden, nombre: s.nombre, tipo: 'fuerza', intencion: null, dinamica: null, fecha_realizada: null, completada: false,
          nota_atleta: null, duracion_min: null, rpe_sesion: null, revisada_en: null };
        db.sesiones.push(sesion);
        let minuto = 0;
        for (const e of s.ejercicios) {
          const p = { id: uuid(), sesion_id: sesion.id, ejercicio_id: ej[e.nombre].id, orden: e.orden, superserie: null, prioridad: e.prioridad, series: e.series,
            reps_min: e.reps_min, reps_max: e.reps_max, rir_objetivo: e.rir_objetivo, rpe_objetivo: null, carga_sugerida_kg: null, descanso_seg: e.descanso_seg,
            tempo: null, notas_coach: e.notas_coach, variante: null };
          db.sesion_ejercicios.push(p);
          if (!hecho || dia > hoy) continue;
          for (let n = 1; n <= e.series; n++) {
            const x = hecho(w.numero, e.nombre, n, s.orden);
            if (!x) continue;
            minuto += 3;
            db.series.push({ id: uuid(), sesion_ejercicio_id: p.id, atleta_id: a.id, numero: n, kg: x.kg, reps: x.reps, rpe: x.rpe ?? null, rir: null, nota: null, sustituto_id: null,
              registrada_en: new Date(`${dia}T18:${String(Math.min(59, minuto)).padStart(2, '0')}:00`).toISOString() });
          }
        }
        if (hecho && dia <= hoy) Object.assign(sesion, { completada: true, fecha_realizada: dia, duracion_min: w.numero === 1 ? 30 : w.numero === 4 ? 45 : 38, rpe_sesion: 6, revisada_en: null });
      }
    }
    return b;
  }

  // Marina: empieza esta semana (sin cuestionario: le sale el de salud antes de empezar)
  const marina = atleta({ email: 'marina@fbe.demo', nombre: 'Marina Ortega', alta: sumarDias(lunesHoy, -3), objetivo: 'Empezar en el gimnasio este enero' });
  bloque(marina, lunesHoy);

  // Tomás: las cuatro semanas hechas (la última terminó el domingo pasado); su cuestionario, sin necesidad de valoración
  const tomas = atleta({ email: 'tomas@fbe.demo', nombre: 'Tomás Rey', alta: sumarDias(lunesHoy, -31), objetivo: 'Coger fuerza y el hábito a los 52' });
  bloque(tomas, sumarDias(lunesHoy, -28), (semana, nombre, n, dia) => {
    const kg = TOMAS[nombre]?.[semana - 1];
    if (kg == null) return null;
    if (nombre === 'Plancha abdominal') return { kg: null, reps: kg - (n - 1) * 3 - (dia === 1 ? 2 : 0) };
    return { kg, reps: Math.max(10, 12 - (n - 1) - (dia === 1 && semana === 4 ? 1 : 0)), rpe: semana === 1 ? 5.5 : semana === 2 ? 7 : 8 };
  });
  db.cuestionarios.push({ id: uuid(), atleta_id: tomas.id, objetivo: 'salud', objetivos: ['salud', 'fuerza'], objetivo_detalle: 'Llevo años sin hacer nada y quiero empezar bien.', otros_deportes: null,
    experiencia: 'ninguna', dias_semana: 2, minutos_sesion: 45, lugar: 'gimnasio', material: ['maquinas', 'mancuernas', 'banco', 'poleas'], activo: false, enfermedad: false, sintomas: [], otras: [],
    enfermedad_detalle: null, medicacion_detalle: null, alergias: null, lesiones: [], resultado: 'sin_valoracion', pedido_en: null, revisado_en: null,
    completado_en: `${sumarDias(lunesHoy, -30)}T20:00:00.000Z`, creado_en: `${sumarDias(lunesHoy, -30)}T20:00:00.000Z`, actualizado_en: `${sumarDias(lunesHoy, -30)}T20:00:00.000Z` });
  // Su peso, una vez por semana
  for (let k = 4; k >= 0; k--) db.pesos.push({ id: uuid(), atleta_id: tomas.id, fecha: k === 0 ? hoy : sumarDias(lunesHoy, -7 * k), kg: Math.round((86.4 - (4 - k) * 0.3) * 10) / 10, notas: null });
  return { marina, tomas };
}
