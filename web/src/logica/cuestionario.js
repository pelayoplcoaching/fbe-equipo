// Cuestionario inicial: las opciones (las mismas que acepta la migración 011), la recomendación del cribado de
// salud previo al ejercicio (ACSM 2015: Riebe y cols., Med Sci Sports Exerc 2015;47:2473-9,
// doi:10.1249/MSS.0000000000000664) y lo que ve el coach. Las preguntas son propias, no las del PAR-Q+.

export const OBJETIVOS = [
  ['fuerza', 'Ganar fuerza'], ['musculo', 'Ganar músculo'], ['perder_grasa', 'Perder grasa'],
  ['salud', 'Salud y bienestar'], ['rendimiento', 'Rendir más en mi deporte'], ['otro', 'Otro'],
];
export const EXPERIENCIA = [
  ['ninguna', 'Nunca he entrenado fuerza'], ['menos_1', 'Menos de un año'], ['1_3', 'De 1 a 3 años'],
  ['3_5', 'De 3 a 5 años'], ['mas_5', 'Más de 5 años'],
];
export const LUGARES = [
  ['gimnasio', 'Gimnasio completo'], ['gimnasio_basico', 'Gimnasio pequeño'], ['casa', 'En casa'], ['aire_libre', 'Al aire libre'],
];
export const MATERIAL = [
  ['barra', 'Barra y discos'], ['rack', 'Rack o jaula'], ['banco', 'Banco'], ['mancuernas', 'Mancuernas'],
  ['kettlebells', 'Kettlebells'], ['poleas', 'Poleas'], ['maquinas', 'Máquinas'], ['gomas', 'Gomas'],
  ['dominadas', 'Barra de dominadas'], ['cardio', 'Bici, cinta o remo'],
];
// Los signos y síntomas de la ACSM que hacen pensar en una enfermedad cardiovascular, metabólica o renal
export const SINTOMAS = [
  ['dolor_pecho', 'Dolor, presión o molestia en el pecho, el cuello, la mandíbula o los brazos (en reposo o al esforzarte)'],
  ['falta_aire', 'Falta de aire en reposo o con esfuerzos pequeños'],
  ['mareo', 'Mareos o desmayos'],
  ['ortopnea', 'Falta de aire al tumbarte o que te despierta por la noche'],
  ['tobillos', 'Tobillos hinchados'],
  ['palpitaciones', 'Palpitaciones o el corazón muy rápido sin motivo'],
  ['claudicacion', 'Dolor en las piernas al caminar que se quita al parar'],
  ['soplo', 'Te han dicho que tienes un soplo en el corazón'],
  ['fatiga', 'Cansancio o falta de aire raros con lo que haces normalmente'],
];
export const OTRAS = [
  ['embarazo', 'Estoy embarazada'], ['posparto', 'He dado a luz en los últimos 6 meses'],
  ['cirugia', 'Me han operado en los últimos 6 meses'], ['medicacion', 'Tomo alguna medicación a diario'],
  ['limitacion_medica', 'Un médico me ha dicho que limite el ejercicio'],
];
export const ZONAS_LESION = [
  ['cuello', 'Cuello'], ['hombro', 'Hombro'], ['codo', 'Codo'], ['muneca_mano', 'Muñeca o mano'], ['espalda_alta', 'Espalda alta'],
  ['zona_lumbar', 'Zona lumbar'], ['cadera', 'Cadera'], ['rodilla', 'Rodilla'], ['tobillo_pie', 'Tobillo o pie'], ['otra', 'Otra'],
];
export const LIMITA = ['No me limita', 'Me limita algo', 'Me limita mucho'];
export const MINUTOS = [30, 45, 60, 75, 90, 120];

export const nombre = (lista, v) => (lista.find(([k]) => k === v) || [])[1] || v;

// Igual que resultado_cribado() en la base
export function resultadoCribado({ activo, enfermedad, sintomas }) {
  if (activo == null || enfermedad == null || sintomas == null) return null;
  if (sintomas.length) return activo ? 'parar_y_valorar' : 'valorar_antes';
  if (enfermedad) return activo ? 'valorar_antes_vigoroso' : 'valorar_antes';
  return 'sin_valoracion';
}

// Lo que lee el atleta al terminar
export const MENSAJE_ATLETA = {
  sin_valoracion: 'No hace falta que te vea un médico antes de empezar. Si alguna vez notas dolor en el pecho, mucha falta de aire o mareo al entrenar, para y consulta con tu médico.',
  valorar_antes_vigoroso: 'Puedes seguir entrenando a intensidad moderada. Antes de subir a intensidades altas, conviene que lo valore tu médico. Tu coach lo tendrá en cuenta al programarte.',
  valorar_antes: 'Antes de empezar, conviene que te valore tu médico. Tu coach lo verá y te dirá cómo seguir.',
  parar_y_valorar: 'Con lo que nos cuentas, lo prudente es dejar el ejercicio intenso hasta que te valore tu médico. Tu coach lo verá enseguida. Si ahora mismo tienes dolor en el pecho o te falta mucho el aire, llama al 112.',
};
// Lo que lee el coach
export const RESULTADO_COACH = {
  sin_valoracion: ['No necesita valoración médica previa', 'ok'],
  valorar_antes_vigoroso: ['Valoración médica antes de intensidad vigorosa', 'aviso'],
  valorar_antes: ['Valoración médica antes de empezar', 'aviso'],
  parar_y_valorar: ['Síntomas: que pare y lo valore su médico', 'alerta'],
};

// Sus objetivos (v0.20: puede marcar varios; el primero es el principal). Los cuestionarios de antes solo tienen uno
export const objetivosDe = (c) => (c?.objetivos?.length ? c.objetivos : c?.objetivo ? [c.objetivo] : []);
export const textoObjetivos = (c) => {
  const n = objetivosDe(c).map((o, i) => { const t = nombre(OBJETIVOS, o); return i ? t.charAt(0).toLowerCase() + t.slice(1) : t; });
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n.at(-1)}` : n[0] || '';
};

// Qué pasos tiene hechos (para la hoja y los primeros pasos)
export function pasosHechos(c) {
  if (!c) return { objetivo: false, tiempo: false, lugar: false, salud: false, lesiones: false };
  return {
    objetivo: objetivosDe(c).length > 0,
    tiempo: !!(c.experiencia && c.dias_semana && c.minutos_sesion),
    lugar: !!c.lugar,
    salud: c.activo != null && c.enfermedad != null && c.sintomas != null,
    lesiones: c.lesiones != null,
  };
}

// Aviso en el panel del coach: si recomienda valoración médica o hay algo que revisar (embarazo, cirugía,
// medicación…) y aún no lo ha revisado. También si aún no lo ha enviado: lo de salud se guarda en su paso
// (si tiene síntomas y entrena, que pare es lo primero que tiene que ver el coach)
export function avisoCuestionario(c) {
  if (!c || c.revisado_en) return null;
  const otras = (c.otras || []).map((o) => nombre(OTRAS, o));
  if (c.resultado && c.resultado !== 'sin_valoracion') {
    const [texto] = RESULTADO_COACH[c.resultado];
    const nivel = c.resultado === 'parar_y_valorar' ? 'alerta' : c.resultado === 'valorar_antes_vigoroso' ? 'info' : 'aviso';
    return { tipo: 'cuestionario', nivel, texto: `Cuestionario: ${texto.charAt(0).toLowerCase()}${texto.slice(1)}` };
  }
  if (otras.length && c.completado_en) return { tipo: 'cuestionario', nivel: 'info', texto: 'Cuestionario: revisa lo de salud' };
  return null;
}

// Resumen de una línea para la ficha: «Ganar fuerza, 4 días × 60 min, gimnasio completo»
export function resumenCuestionario(c) {
  if (!c) return '';
  const partes = [textoObjetivos(c),
    c.dias_semana && `${c.dias_semana} ${c.dias_semana === 1 ? 'día' : 'días'}${c.minutos_sesion ? ` × ${c.minutos_sesion} min` : ''}`,
    c.lugar && nombre(LUGARES, c.lugar)].filter(Boolean);
  return partes.map((x, i) => (i ? x.charAt(0).toLowerCase() + x.slice(1) : x)).join(', ');
}

// ¿Hay una petición del coach sin atender? (nunca lo ha rellenado, o se lo ha vuelto a pedir después)
export const pendiente = (c) => !!c?.pedido_en && (!c.completado_en || c.pedido_en > c.completado_en);

// ¿Tiene algo de salud apuntado? (para saber si se puede ver o borrar)
export const conSalud = (c) => !!c && ['activo', 'enfermedad', 'enfermedad_detalle', 'sintomas', 'otras', 'medicacion_detalle', 'lesiones', 'alergias'].some((k) => c[k] != null);
export const SIN_SALUD = { activo: null, enfermedad: null, enfermedad_detalle: null, sintomas: null, otras: null, medicacion_detalle: null, lesiones: null, alergias: null };

// Los datos que se guardan (sin campos vacíos ni espacios sueltos)
export function limpiarCuestionario(d) {
  const t = (v, max) => { const s = String(v ?? '').replace(/\s+/g, ' ').trim(); return s ? s.slice(0, max) : null; };
  const out = {};
  if ('objetivos' in d) {
    const validos = OBJETIVOS.map(([v]) => v);
    const lista = [...new Set((d.objetivos || []).filter((o) => validos.includes(o)))];
    out.objetivos = lista.length ? lista : null;
    out.objetivo = lista[0] || null;
  } else if ('objetivo' in d) out.objetivo = d.objetivo || null;
  if ('objetivo_detalle' in d) out.objetivo_detalle = t(d.objetivo_detalle, 600);
  if ('experiencia' in d) out.experiencia = d.experiencia || null;
  if ('dias_semana' in d) out.dias_semana = d.dias_semana ? Number(d.dias_semana) : null;
  if ('minutos_sesion' in d) out.minutos_sesion = d.minutos_sesion ? Number(d.minutos_sesion) : null;
  if ('lugar' in d) out.lugar = d.lugar || null;
  if ('material' in d) out.material = [...new Set(d.material || [])];
  if ('otros_deportes' in d) out.otros_deportes = t(d.otros_deportes, 200);
  if ('activo' in d) out.activo = d.activo == null ? null : !!d.activo;
  if ('enfermedad' in d) out.enfermedad = d.enfermedad == null ? null : !!d.enfermedad;
  if ('enfermedad_detalle' in d) out.enfermedad_detalle = d.enfermedad ? t(d.enfermedad_detalle, 300) : null;
  if ('sintomas' in d) out.sintomas = d.sintomas == null ? null : [...new Set(d.sintomas)];
  if ('otras' in d) out.otras = d.otras == null ? null : [...new Set(d.otras)];
  if ('medicacion_detalle' in d) out.medicacion_detalle = (d.otras || []).includes('medicacion') ? t(d.medicacion_detalle, 300) : null;
  if ('lesiones' in d) {
    out.lesiones = d.lesiones == null ? null : d.lesiones.filter((l) => l?.zona).slice(0, 10)
      .map((l) => ({ zona: l.zona, limita: Math.max(0, Math.min(2, Number(l.limita) || 0)), ...(t(l.nota, 200) ? { nota: t(l.nota, 200) } : {}) }));
  }
  if ('alergias' in d) out.alergias = t(d.alergias, 300);
  return out;
}
