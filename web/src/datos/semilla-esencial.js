// La demo de FBE Esencial (?demo=esencial): tres atletas ficticios que van por su cuenta y la plantilla «Primeras 4
// semanas» de la guía del vídeo del 3/1/2027, como la crea la migración 091. Sirve para grabar 10-15 segundos de la app
// (el cuestionario de salud, la semana 1 con los cinco ejercicios, apuntar kilos y la pantalla de marcas) y para las
// capturas de la web. Sin datos reales: nombres, cifras y respuestas inventados. Va aparte de la demo de siempre (otra
// clave en el almacenamiento), para no cambiar nada de lo que miran las pruebas.
//   · Marina Ortega: acaba de entrar y aún no ha rellenado el cuestionario. Al enviarlo, la app le prepara «Primeras 4
//     semanas» desde este lunes (en la demo, su tanda es esta semana): la semana 1, para apuntar sus kilos.
//   · Tomás Rey: ha terminado las cuatro semanas; sus marcas de la semana 4 están para verlas.
//   · Clara Prieto: su cribado pide valoración médica y ha marcado que ya tiene el visto bueno. Pelayo lo confirma en su
//     ficha (Datos) y la app le prepara su plan, desde el lunes que viene.
import { MODALIDAD_POR_SU_CUENTA } from '../logica/esencial.js';
import { filasPrimeras4, PRIMERAS_4 } from '../logica/esencial-plantilla.js';
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
  ['Curl de bíceps con mancuernas', ['biceps'], ['aislamiento']],
];

// Lo que hizo Tomás cada semana (kilos de la mejor serie; la plancha, segundos): sube como dice la guía
const TOMAS = {
  'Prensa de piernas': [60, 70, 80, 85],
  'Peso muerto rumano con mancuernas': [10, 12, 14, 16],
  'Press de pecho en máquina': [25, 30, 32.5, 35],
  'Jalón al pecho': [30, 35, 37.5, 40],
  'Plancha abdominal': [25, 30, 36, 42],
};

// La copia de una plantilla a nombre de un atleta, como fbe_privado.esencial_copiar_plantilla() de la 091: un bloque
// suyo desde su lunes (activo si no tiene otro activo), con las semanas publicadas y la semana de marcas. t(nombre) da la
// tabla: la usan la semilla y la función esencial_asignar_plan de la demo (backend-memoria.js).
export function copiarPlantillaEsencial(t, { plantilla, atletaId, inicio, uuid, ahoraISO }) {
  const semanas = t('semanas').filter((w) => w.bloque_id === plantilla.id).sort((a, b) => a.numero - b.numero);
  const previos = t('bloques').filter((x) => x.atleta_id === atletaId && !x.es_plantilla);
  const b = {
    id: uuid(), atleta_id: atletaId, es_plantilla: false, numero: Math.max(0, ...previos.map((x) => x.numero || 0)) + 1, nombre: plantilla.nombre,
    foco: plantilla.foco ?? null, objetivo: plantilla.objetivo ?? null, descripcion: plantilla.descripcion ?? null,
    fecha_inicio: inicio, fecha_fin: sumarDias(inicio, 7 * Math.max(1, semanas.length) - 1),
    estado: previos.some((x) => ['activo', 'ajustado'].includes(x.estado)) ? 'planificado' : 'activo', creado_en: ahoraISO, objetivo_logrado: null,
  };
  t('bloques').push(b);
  for (const w of semanas) {
    const nw = { id: uuid(), bloque_id: b.id, numero: w.numero, foco: w.foco ?? null, fecha_inicio: sumarDias(inicio, 7 * (w.numero - 1)), nota_coach: w.nota_coach ?? null,
      programacion: 'programada', marcas: !!w.marcas };
    t('semanas').push(nw);
    for (const s of t('sesiones').filter((x) => x.semana_id === w.id).sort((a, c) => a.orden - c.orden)) {
      const ns = { id: uuid(), semana_id: nw.id, orden: s.orden, nombre: s.nombre, tipo: s.tipo, intencion: s.intencion ?? null, dinamica: s.dinamica ?? null,
        fecha_realizada: null, completada: false, nota_atleta: null, duracion_min: null, rpe_sesion: null, revisada_en: null };
      t('sesiones').push(ns);
      for (const p of t('sesion_ejercicios').filter((x) => x.sesion_id === s.id)) t('sesion_ejercicios').push({ ...p, id: uuid(), sesion_id: ns.id });
    }
  }
  return b;
}

export function sembrarEsencial(db, { hoy, lunesHoy, ahoraISO, uuid, usuario, versionLegal }) {
  const t = (nombre) => (db[nombre] ||= []);
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

  // La plantilla, como la crea la 091 (sin fechas: las pone la copia)
  const plantilla = { id: uuid(), atleta_id: null, es_plantilla: true, numero: null, nombre: PRIMERAS_4.nombre, foco: PRIMERAS_4.foco, objetivo: PRIMERAS_4.objetivo,
    descripcion: PRIMERAS_4.descripcion, fecha_inicio: null, fecha_fin: null, estado: 'planificado', creado_en: ahoraISO, objetivo_logrado: null };
  t('bloques').push(plantilla);
  for (const w of filasPrimeras4()) {
    const semana = { id: uuid(), bloque_id: plantilla.id, numero: w.numero, foco: PRIMERAS_4.foco, fecha_inicio: null, nota_coach: w.nota, programacion: 'no_iniciada', marcas: w.marcas };
    t('semanas').push(semana);
    for (const s of w.sesiones) {
      const sesion = { id: uuid(), semana_id: semana.id, orden: s.orden, nombre: s.nombre, tipo: 'fuerza', intencion: null, dinamica: null, fecha_realizada: null, completada: false,
        nota_atleta: null, duracion_min: null, rpe_sesion: null, revisada_en: null };
      t('sesiones').push(sesion);
      for (const e of s.ejercicios) {
        t('sesion_ejercicios').push({ id: uuid(), sesion_id: sesion.id, ejercicio_id: ej[e.nombre].id, orden: e.orden, superserie: null, prioridad: e.prioridad, series: e.series,
          reps_min: e.reps_min, reps_max: e.reps_max, rir_objetivo: e.rir_objetivo, rpe_objetivo: null, carga_sugerida_kg: null, descanso_seg: e.descanso_seg,
          tempo: null, notas_coach: e.notas_coach, variante: null });
      }
    }
  }

  const atleta = ({ email, nombre, alta, objetivo, inicio, extra = {} }) => {
    const perfil = usuario(email, nombre.split(' ')[0], 'atleta');
    const a = { id: uuid(), perfil_id: perfil, nombre, email, estado: 'activo', fecha_alta: alta, objetivo, notion_url: null, progresion_auto: true, volumen_objetivo: null,
      creado_en: ahoraISO, nivel: 'novato', nutricion: false, modalidad: MODALIDAD_POR_SU_CUENTA, esencial_inicio: inicio, visto_bueno_pedido_en: null, visto_bueno_en: null, ...extra };
    db.atletas.push(a);
    for (const tipo of ['privacidad', 'datos_salud']) db.consentimientos.push({ id: uuid(), perfil_id: perfil, tipo, version: '2026-10', aceptado_en: ahoraISO, revocado_en: null });
    t('privacidad_vista').push({ usuario_id: perfil, version: versionLegal, vista_en: ahoraISO });
    // (el cuestionario de objetivos es para quien lleva seguimiento: aquí no sale)
    t('objetivos_rondas').push({ atleta_id: a.id, contestado_en: ahoraISO });
    return a;
  };
  const cuestionario = (a, dias, campos) => db.cuestionarios.push({ id: uuid(), atleta_id: a.id, objetivo: 'salud', objetivos: ['salud', 'fuerza'], otros_deportes: null,
    experiencia: 'ninguna', dias_semana: 2, minutos_sesion: 45, lugar: 'gimnasio', material: ['maquinas', 'mancuernas', 'banco', 'poleas'], activo: false, enfermedad: false, sintomas: [],
    otras: [], enfermedad_detalle: null, medicacion_detalle: null, alergias: null, lesiones: [], resultado: 'sin_valoracion', pedido_en: null, revisado_en: null,
    completado_en: `${sumarDias(lunesHoy, -dias)}T20:00:00.000Z`, creado_en: `${sumarDias(lunesHoy, -dias)}T20:00:00.000Z`, actualizado_en: `${sumarDias(lunesHoy, -dias)}T20:00:00.000Z`, ...campos });

  // Marina: acaba de entrar (su tanda, en la demo, es esta semana); sin cuestionario ni plan
  const marina = atleta({ email: 'marina@fbe.demo', nombre: 'Marina Ortega', alta: sumarDias(lunesHoy, -3), objetivo: 'FBE Esencial · Entrenamiento', inicio: lunesHoy });

  // Tomás: las cuatro semanas hechas (la última terminó el domingo pasado); su cuestionario, sin necesidad de valoración
  const tomas = atleta({ email: 'tomas@fbe.demo', nombre: 'Tomás Rey', alta: sumarDias(lunesHoy, -31), objetivo: 'FBE Esencial · Entrenamiento', inicio: sumarDias(lunesHoy, -28) });
  cuestionario(tomas, 30, { objetivo_detalle: 'Llevo años sin hacer nada y quiero empezar bien.' });
  const nombreDe = Object.fromEntries(db.ejercicios.map((e) => [e.id, e.nombre]));
  const bt = copiarPlantillaEsencial(t, { plantilla, atletaId: tomas.id, inicio: sumarDias(lunesHoy, -28), uuid, ahoraISO });
  for (const w of t('semanas').filter((x) => x.bloque_id === bt.id)) {
    for (const s of t('sesiones').filter((x) => x.semana_id === w.id)) {
      const dia = sumarDias(w.fecha_inicio, s.orden === 1 ? 0 : 3);   // dos días que no vayan seguidos: lunes y jueves
      if (dia > hoy) continue;
      let minuto = 0;
      for (const p of t('sesion_ejercicios').filter((x) => x.sesion_id === s.id).sort((a, b) => a.orden - b.orden)) {
        const nombre = nombreDe[p.ejercicio_id];
        const kg = TOMAS[nombre]?.[w.numero - 1];
        if (kg == null) continue;
        for (let n = 1; n <= p.series; n++) {
          const x = nombre === 'Plancha abdominal' ? { kg: null, reps: kg - (n - 1) * 3 - (s.orden === 1 ? 2 : 0), rpe: null }
            : { kg, reps: Math.max(10, 12 - (n - 1) - (s.orden === 1 && w.numero === 4 ? 1 : 0)), rpe: w.numero === 1 ? 5.5 : w.numero === 2 ? 7 : 8 };
          minuto += 3;
          db.series.push({ id: uuid(), sesion_ejercicio_id: p.id, atleta_id: tomas.id, numero: n, kg: x.kg, reps: x.reps, rpe: x.rpe, rir: null, nota: null, sustituto_id: null,
            registrada_en: new Date(`${dia}T18:${String(Math.min(59, minuto)).padStart(2, '0')}:00`).toISOString() });
        }
      }
      Object.assign(s, { completada: true, fecha_realizada: dia, duracion_min: w.numero === 1 ? 30 : w.numero === 4 ? 45 : 38, rpe_sesion: 6, revisada_en: null });
    }
  }
  // Su peso, una vez por semana
  for (let k = 4; k >= 0; k--) db.pesos.push({ id: uuid(), atleta_id: tomas.id, fecha: k === 0 ? hoy : sumarDias(lunesHoy, -7 * k), kg: Math.round((86.4 - (4 - k) * 0.3) * 10) / 10, notas: null });

  // Clara: su cribado pide valoración médica (una enfermedad diagnosticada, sin hacer ejercicio) y ayer marcó que ya tiene
  // el visto bueno de su médico: le falta que Pelayo lo confirme. Su tanda empieza el lunes que viene.
  const clara = atleta({ email: 'clara@fbe.demo', nombre: 'Clara Prieto', alta: sumarDias(lunesHoy, -6), objetivo: 'FBE Esencial · Entrenamiento', inicio: sumarDias(lunesHoy, 7),
    extra: { visto_bueno_pedido_en: `${sumarDias(hoy, -1)}T19:30:00.000Z` } });
  cuestionario(clara, 5, { objetivo_detalle: 'Mi médico me ha dicho que me venía bien hacer fuerza.', enfermedad: true, enfermedad_detalle: 'Diabetes tipo 2', resultado: 'valorar_antes' });
  return { marina, tomas, clara, plantilla };
}
