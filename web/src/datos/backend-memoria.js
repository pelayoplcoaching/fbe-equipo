// Backend de la demo: todo en el navegador, con el mismo interfaz que el de Supabase.
// No hay permisos por fila: la demo la usa una sola persona que puede cambiar de rol. Sí imita los
// triggers que cambian lo que ve la app (autor de los comentarios, revisiones pendientes…).
import { hoyISO, sumarDias as sumar, diasEntre as diasEntreIso, lunesDe, fechaMadrid } from '../logica/fechas.js';
import { textoVisible } from '../logica/texto.js';
import { resumenCobros } from '../logica/cobros.js';
import { resultadoCribado } from '../logica/cuestionario.js';
import { respuestaValida } from '../logica/preguntas.js';
import { dibujoValido } from '../logica/dibujo.js';
import { cardioValido, cardioHechoValido } from '../logica/cardio.js';
import { VERSION_NORMAS } from './normas-comunidad.js';
import { fechaMadrid as fMadrid, instanteMadrid, partesMadrid } from '../logica/fechas.js';
import { emojiValido } from '../logica/emojis.js';
import { opcionesEncuesta } from '../logica/encuestas.js';
import { checklistValido, tempoValido, plantillaValida, videosViejos } from '../logica/tecnica.js';
import { analisisValido } from '../logica/analisis.js';
import { recordatorioValido, fraseValida, autoevaluacionValida, MAX_RECORDATORIOS } from '../logica/correccion.js';
import { repsManualValidas } from '../logica/repeticiones.js';
import { compararVersiones } from '../logica/privacidad.js';
import { dosAngulosValido } from '../logica/angulos.js';
import { umbralValido } from '../logica/cargaVelocidad.js';
import { retoMaximo, rachaPareja, TEMAS, temaAlPublicar, eventoValido, textoFiltrado, palabrasDeTexto, MAX_PLANTILLAS, MAX_MOTIVO_DESTACADO } from '../logica/comunidad.js';
import { ultimoDia } from '../logica/mes.js';
import { aniversarioDe, REACCIONES_TODAS, pegatinaValida, textoPegatina, limpiarMomento, HITOS, reaccionMasUsada, HORAS_MOMENTO } from '../logica/celebracion.js';
// Como la 033: lo que no lleva el nombre de un documento (control, invisibles y de dirección del texto, barras y <>:"|?*)
const NOMBRE_PROHIBIDO = new RegExp('[/\\\\\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u202a-\\u202e\\u2066-\\u2069\\ufeff<>:"|?*]');

const ahora = () => new Date().toISOString();
const uuid = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16)));

export const CODIGO_MFA_DEMO = '123456';

const DEFECTOS = {
  perfiles: () => ({ rol: 'atleta', creado_en: ahora(), exige_2fa: false, foto: null }),
  atletas: () => ({ estado: 'invitado', fecha_alta: hoyISO(), creado_en: ahora(), perfil_id: null, email: null, objetivo: null, notion_url: null, progresion_auto: true, volumen_objetivo: null, checkin_apartados: null, nutricion: true, entrenamiento: true, nivel: null, peso_frecuencia: 'diario', baja_en: null, dias_semana: null, reglas_motor: null }),
  invitaciones: () => ({ creada_en: ahora(), usada_en: null }),
  consentimientos: () => ({ aceptado_en: ahora(), revocado_en: null }),
  ejercicios: () => ({ grupos_musculares: [], activo: true, variante: null, video_url: null, instrucciones: null, errores: null, alternativas: [], tipo: [], rango_reps: null, creado_en: ahora() }),
  bloques: () => ({ es_plantilla: false, estado: 'planificado', atleta_id: null, numero: null, foco: null, objetivo: null, descripcion: null, fecha_inicio: null, fecha_fin: null, creado_en: ahora() }),
  semanas: () => ({ programacion: 'no_iniciada', foco: null, fecha_inicio: null, nota_coach: null, propuesta_motor: null }),
  sesiones: () => ({ tipo: 'fuerza', completada: false, intencion: null, dinamica: null, fecha_realizada: null, nota_atleta: null, duracion_min: null, rpe_sesion: null, revisada_en: null, preparacion: null, dia_previsto: null, cardio: null, cardio_hecho: null }),
  sesion_ejercicios: () => ({ prioridad: 'media', superserie: null, reps_min: null, reps_max: null, rir_objetivo: null, rpe_objetivo: null, carga_sugerida_kg: null, descanso_seg: null, tempo: null, notas_coach: null, variante: null, backoff_pct: null, series_detalle: null }),
  series: () => ({ registrada_en: ahora(), kg: null, reps: null, rpe: null, rir: null, nota: null, sustituto_id: null }),
  pesos: () => ({ fecha: hoyISO(), notas: null }),
  checkins: () => ({ creado_en: ahora(), revisado_en: null, respuestas: null }),
  molestias: () => ({ notas: null }),
  notas_coach: () => ({ creado_en: ahora() }),
  medidas: () => ({ fecha: hoyISO(), cintura_cm: null, cadera_cm: null, pecho_cm: null, brazo_cm: null, muslo_cm: null, pantorrilla_cm: null, notas: null }),
  marcas: () => ({ fecha: hoyISO(), reps: 1, tipo: 'test', notas: null }),
  objetivos: () => ({ progreso_pct: 0, estado: 'no_iniciado', descripcion: null, fecha_limite: null, ejercicio_id: null, kg_objetivo: null, reps_objetivo: null, e1rm_inicio: null, creado_en: ahora() }),
  archivos: () => ({ fecha: hoyISO(), sesion_ejercicio_id: null, ejercicio_id: null, comentario_coach: null, nota_atleta: null, mime: null, bytes: null, revisado_en: null, creado_en: ahora(), pose: null, poster_ruta: null, duracion_seg: null, destacado: false, nombre: null, paginas: null, serie_numero: null, repite_de: null, angulo_de: null, fps_captura: null }),
  // v0.57 (035): la corrección de cada vídeo y las listas de puntos clave del coach
  video_revisiones: () => ({ puntuacion: null, checklist: null, tempo: null, voz_archivo_id: null, voz_inicio: null, visto_el: null, corregido_en: null, actualizado_en: ahora(), analisis: null, reps_manual: null, dos_angulos: null }),
  tecnica_plantillas: () => ({ actualizado_en: ahora() }),
  // v0.59 (037): recordatorios, frases, vídeos modelo y la valoración del atleta
  recordatorios_tecnica: () => ({ archivo_id: null, segundo: null, activo: true, creado_en: ahora(), actualizado_en: ahora() }),
  frases_correccion: () => ({ ejercicio_id: null, dibujo: null, orden: 0, creado_en: ahora() }),
  // Como la 039: la velocidad mínima de un ejercicio (para el 1RM estimado por la velocidad)
  umbrales_velocidad: () => ({ actualizado_en: ahora() }),
  // Como la 040: la revisión semanal del coach (una por atleta y lunes)
  revisiones_semanales: () => ({ hecha: false, nota: null, actualizado_en: ahora() }),
  videos_modelo: () => ({ poster_ruta: null, duracion_seg: null, mime: null, bytes: null, angulo: null, orden: 0, creado_en: ahora() }),
  video_autoevaluacion: () => ({ rpe: null, nota: null, molestia: null, zona: null, creado_en: ahora(), actualizado_en: ahora() }),
  comentarios: () => ({ sesion_id: null, checkin_id: null, archivo_id: null, leido_en: null, creado_en: ahora(), dibujo: null, adjunto: false, enviar_en: null, responde_a: null, editado_en: null, eliminado_en: null, cliente_id: null, reenviado: false, entregado_en: null, escuchado_en: null, video_respuesta_id: null, resumen_sesion: false }),
  // v0.55 (033): fijar, silenciar y las listas de difusión
  conversacion_fijado: () => ({ hasta: null, fijado_en: ahora() }),
  chat_silencios: () => ({ hasta: null, creado_en: ahora() }),
  listas_difusion: () => ({ creada_en: ahora() }),
  // Migración 032: el chat como WhatsApp
  conversacion_estado: () => ({ fijada_en: null, archivada_en: null, no_leida: false, actualizado_en: ahora() }),
  recursos: () => ({ atleta_id: null, categoria: 'general', descripcion: null, url: null, orden: 0, creado_en: ahora() }),
  notas_ejercicio: () => ({ actualizado_en: ahora() }),
  respuestas_guardadas: () => ({ orden: 0, creado_en: ahora() }),
  avisos: () => ({ atleta_id: null, desde: hoyISO(), hasta: null, creado_en: ahora(), enviar_en: null }),
  // Migración 030: tareas puntuales y sus plantillas
  tareas: () => ({ detalle: null, ejercicio_id: null, fecha: fMadrid(), hecha_en: null, respuesta: null, archivo_id: null, revisada_en: null, creada_en: ahora() }),
  tareas_plantillas: () => ({ detalle: null, ejercicio_id: null, orden: 0, creada_en: ahora() }),
  habitos: () => ({ tipo: 'numero', objetivo: null, unidad: null, sentido: 'al_menos', dias_semana: 7, icono: 'libre', orden: 0, activo: true, creado_en: ahora() }),
  registros_habito: () => ({ actualizado_en: ahora() }),
  planes_nutricion: () => ({ modo: 'macros', fase: 'mantener', ritmo_pct: null, kcal: null, proteina_g: null, carbos_g: null, grasa_g: null, fibra_g: null, kcal_descanso: null, carbos_descanso_g: null, grasa_descanso_g: null, pautas: null, motivo: null, creado_en: ahora() }),
  registros_nutricion: () => ({ kcal: null, proteina_g: null, carbos_g: null, grasa_g: null, fibra_g: null, completo: true, cumplido: null, nota: null, actualizado_en: ahora() }),
  preferencias_notificaciones: () => ({ desactivados: ['sesion_hecha'], hora_manana: '08:30:00', hora_tarde: '21:00:00', dia_checkin: 7, silencio_desde: '22:30:00', silencio_hasta: '08:00:00', email: false, actualizado_en: ahora() }),
  suscripciones_push: () => ({ dispositivo: null, creada_en: ahora(), usada_en: null, fallos: 0, ultimo_error: null }),
  cuestionarios: () => ({ objetivo: null, objetivos: null, objetivo_detalle: null, experiencia: null, dias_semana: null, minutos_sesion: null, lugar: null, material: [],
    otros_deportes: null, activo: null, enfermedad: null, enfermedad_detalle: null, sintomas: null, otras: null, medicacion_detalle: null,
    lesiones: null, alergias: null, resultado: null, completado_en: null, pedido_en: null, revisado_en: null, creado_en: ahora(), actualizado_en: ahora() }),
  cobros_atletas: () => ({ servicio: null, precio_mes: null, ciclo: 'mensual', desde: null, nota: null, actualizado_en: ahora() }),
  pagos: () => ({ estado: 'pendiente', fecha_pago: null, metodo: null, nota: null, creado_en: ahora() }),
  // Migración 022: recetas, recetario de cada atleta, sus comidas del día y su menú
  recetas: () => ({ tomas: [], raciones: 1, kcal: null, proteina_g: null, carbos_g: null, grasa_g: null, ingredientes: [], preparacion: null, minutos: null, etiquetas: [], foto: null, foto_mini: null, creada_en: ahora(), actualizada_en: ahora() }),
  recetas_atleta: () => ({ factor: 1, orden: 0, nota: null, favorita: false, cambio_pedido_en: null, cambio_nota: null, creada_en: ahora() }),
  comidas_atleta: () => ({ tomas: ['desayuno', 'comida', 'merienda', 'cena'], opcional: null, actualizado_en: ahora() }),
  // Migración 023: los días sin su comida opcional
  menu_dias: () => ({ creado_en: ahora() }),
  menu_comidas: () => ({ receta_id: null, raciones: 1, kcal: null, proteina_g: null, carbos_g: null, grasa_g: null, hecho: false, orden: 0, creado_en: ahora() }),
  preguntas_checkin: () => ({ atleta_id: null, tipo: 'escala', unidad: null, ayuda: null, etiqueta_min: null, etiqueta_max: null, orden: 0, activa: true, creado_en: ahora() }),
  // Migración 027: la comunidad del equipo
  comunidad_posts: () => ({ tipo: 'post', texto: null, foto_ruta: null, sesion_id: null, resumen: null, fijada: false, oculta: false, atleta_id: null, creado_en: ahora(), menciones: [], encuesta: null, reto_id: null, tema: null, fotos: null, mejor_comentario: null, publicar_en: null, retenida: false }),
  comunidad_comentarios: () => ({ oculto: false, atleta_id: null, creado_en: ahora(), menciones: [], responde_a: null, retenido: false, pegatina: null }),
  // (044) eventos, plantillas y el atleta de la semana
  comunidad_eventos: () => ({ descripcion: null, plazas: null, cancelado_en: null, creado_en: ahora(), actualizado_en: ahora() }),
  comunidad_plantillas: () => ({ creado_en: ahora() }),
  comunidad_retos: () => ({ descripcion: null, modo: 'individual', medida: 'sesiones', equipos: null, creado_en: ahora() }),
};

// Borrados en cascada, como en el esquema SQL.
const CASCADA = {
  atletas: [['bloques', 'atleta_id'], ['invitaciones', 'atleta_id'], ['series', 'atleta_id'], ['pesos', 'atleta_id'],
    ['checkins', 'atleta_id'], ['molestias', 'atleta_id'], ['notas_coach', 'atleta_id'], ['medidas', 'atleta_id'],
    ['marcas', 'atleta_id'], ['objetivos', 'atleta_id'], ['archivos', 'atleta_id'], ['comentarios', 'atleta_id'], ['recursos', 'atleta_id'],
    ['notas_ejercicio', 'atleta_id'], ['avisos', 'atleta_id'], ['habitos', 'atleta_id'], ['registros_habito', 'atleta_id'],
    ['planes_nutricion', 'atleta_id'], ['registros_nutricion', 'atleta_id'], ['cuestionarios', 'atleta_id'], ['preguntas_checkin', 'atleta_id'],
    ['cobros_atletas', 'atleta_id'], ['pagos', 'atleta_id'], ['recetas_atleta', 'atleta_id'], ['comidas_atleta', 'atleta_id'], ['menu_comidas', 'atleta_id'], ['menu_dias', 'atleta_id'],
    ['comunidad_miembros', 'atleta_id'], ['comunidad_posts', 'atleta_id'], ['comunidad_comentarios', 'atleta_id'], ['comunidad_reacciones', 'atleta_id'],
    ['comunidad_votos', 'atleta_id'], ['comunidad_animos', 'atleta_id'], ['comunidad_animos', 'para_atleta_id'],
    ['comunidad_comentario_reacciones', 'atleta_id'], ['comunidad_bienvenidas', 'atleta_id'], ['comunidad_bienvenidas', 'para_atleta_id'],
    ['comunidad_companeros', 'de_atleta_id'], ['comunidad_companeros', 'para_atleta_id'], ['comunidad_reto_equipos', 'atleta_id'], ['comunidad_evento_asistentes', 'atleta_id'], ['comunidad_destacados', 'atleta_id'], ['tareas', 'atleta_id'], ['conversacion_estado', 'atleta_id'],
    ['conversacion_fijado', 'atleta_id'], ['chat_silencios', 'atleta_id'], ['listas_difusion_miembros', 'atleta_id'], ['encuestas_chat', 'atleta_id'], ['encuesta_votos', 'atleta_id'], ['video_revisiones', 'atleta_id'],
    ['recordatorios_tecnica', 'atleta_id'], ['video_autoevaluacion', 'atleta_id'], ['revisiones_semanales', 'atleta_id']],
  // Como la 035: la corrección se va con su vídeo; la lista de puntos clave, con su ejercicio
  archivos: [['video_revisiones', 'archivo_id'], ['video_autoevaluacion', 'archivo_id']],
  ejercicios: [['tecnica_plantillas', 'ejercicio_id'], ['recordatorios_tecnica', 'ejercicio_id'], ['frases_correccion', 'ejercicio_id'], ['videos_modelo', 'ejercicio_id'], ['umbrales_velocidad', 'ejercicio_id']],
  // Como la 032: las reacciones y los destacados se van con su mensaje; (033) y lo fijado
  comentarios: [['comentario_reacciones', 'comentario_id'], ['comentario_destacados', 'comentario_id'], ['conversacion_fijado', 'comentario_id'], ['encuestas_chat', 'comentario_id']],
  // Como la 034: el voto se va con su encuesta
  encuestas_chat: [['encuesta_votos', 'encuesta_id']],
  listas_difusion: [['listas_difusion_miembros', 'lista_id']],
  // (043: lo guardado y la pregunta frecuente se van con su publicación)
  comunidad_posts: [['comunidad_comentarios', 'post_id'], ['comunidad_reacciones', 'post_id'], ['comunidad_votos', 'post_id'], ['comunidad_guardados', 'post_id'], ['comunidad_preguntas', 'post_id']],
  // Como la 041: los 💪 se van con su comentario
  comunidad_comentarios: [['comunidad_comentario_reacciones', 'comentario_id']],
  // Como la 042: el reparto de un reto por equipos se va con el reto
  comunidad_retos: [['comunidad_reto_equipos', 'reto_id']],
  comunidad_eventos: [['comunidad_evento_asistentes', 'evento_id']],
  recetas: [['recetas_atleta', 'receta_id']],
  habitos: [['registros_habito', 'habito_id']],
  bloques: [['semanas', 'bloque_id']],
  semanas: [['sesiones', 'semana_id']],
  sesiones: [['sesion_ejercicios', 'sesion_id'], ['comentarios', 'sesion_id']],
  sesion_ejercicios: [['series', 'sesion_ejercicio_id']],
};
// Al borrar estas filas, los comentarios se quedan sin el enlace (on delete set null)
const ANULAR = { comentarios: [['comentarios', 'responde_a']], comunidad_retos: [['comunidad_posts', 'reto_id']], sesiones: [['comunidad_posts', 'sesion_id']], comunidad_posts: [['comunidad_reportes', 'post_id']], comunidad_comentarios: [['comunidad_reportes', 'comentario_id'], ['comunidad_comentarios', 'responde_a'], ['comunidad_posts', 'mejor_comentario'], ['comunidad_preguntas', 'comentario_id']], recetas: [['menu_comidas', 'receta_id']], checkins: [['comentarios', 'checkin_id']], archivos: [['comentarios', 'archivo_id'], ['tareas', 'archivo_id'], ['archivos', 'repite_de'], ['video_revisiones', 'voz_archivo_id'], ['recordatorios_tecnica', 'archivo_id'], ['comentarios', 'video_respuesta_id'], ['archivos', 'angulo_de']], ejercicios: [['objetivos', 'ejercicio_id'], ['tareas', 'ejercicio_id'], ['tareas_plantillas', 'ejercicio_id']], sesion_ejercicios: [['archivos', 'sesion_ejercicio_id']] };

const cumple = (fila, f = {}) => {
  for (const [k, v] of Object.entries(f.eq || {})) if ((fila[k] ?? null) !== v) return false;
  for (const [k, v] of Object.entries(f.neq || {})) if (fila[k] === v) return false;
  for (const [k, v] of Object.entries(f.in || {})) if (!v.includes(fila[k])) return false;
  for (const [k, v] of Object.entries(f.gte || {})) if (fila[k] == null || fila[k] < v) return false;
  for (const [k, v] of Object.entries(f.lte || {})) if (fila[k] == null || fila[k] > v) return false;
  for (const k of f.nulo || []) if (fila[k] != null) return false;
  for (const k of f.nonulo || []) if (fila[k] == null) return false;
  return true;
};

const copia = (x) => JSON.parse(JSON.stringify(x));
// Tablas con una fila por atleta y sin «id» (su clave es atleta_id)
const SIN_ID = ['cobros_atletas', 'comidas_atleta', 'menu_dias', 'comunidad_miembros', 'comunidad_reacciones', 'comunidad_votos', 'comunidad_animos', 'comunidad_comentario_reacciones', 'comunidad_bienvenidas', 'comunidad_reto_equipos', 'comunidad_guardados', 'comunidad_evento_asistentes',
  'comentario_reacciones', 'comentario_destacados', 'conversacion_estado', 'presencia', 'chat_cupos', 'storage_por_borrar',
  'conversacion_fijado', 'chat_silencios', 'listas_difusion_miembros', 'encuesta_votos', 'privacidad_vista', 'video_revisiones', 'tecnica_plantillas', 'video_autoevaluacion', 'umbrales_velocidad', 'revisiones_semanales'];
// Como la 032: los seis emojis del chat, y cuánto se puede hacer por hora (el coach no tiene cupo)
const EMOJIS_CHAT = ['❤️', '👍', '💪', '😂', '😮', '🙏'];
const CUPO_CHAT = { reaccion: 120, destacar: 120, edicion: 30, eliminar: 30, presencia: 30, silenciar: 30, voto: 120, autoevaluacion: 30 };
// Como la 033: los del coach (reenviar, mensajes por hora; difundir, envíos por hora)
const CUPO_COACH = { reenviar: 300, difusion: 30, encuesta: 30 };
const AVISO_CUPO_CHAT = { reaccion: 'Has reaccionado muchas veces en la última hora: espera un poco', destacar: 'Has destacado muchos mensajes en la última hora: espera un poco',
  edicion: 'Has editado muchos mensajes en la última hora: espera un poco', eliminar: 'Has eliminado muchos mensajes en la última hora: espera un poco',
  presencia: 'Has cambiado muchas veces «Mostrar cuándo estoy en línea»: espera un poco',
  silenciar: 'Has silenciado y activado el chat muchas veces en la última hora: espera un poco',
  reenviar: 'Has reenviado muchos mensajes en la última hora: espera un poco', difusion: 'Has enviado muchas difusiones en la última hora: espera un poco',
  voto: 'Has votado muchas veces en la última hora: espera un poco', encuesta: 'Has creado muchas encuestas en la última hora: espera un poco',
  autoevaluacion: 'Has cambiado muchas veces tu valoración en la última hora: espera un poco' };

function guardarLocal(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento: la demo vive en memoria */ }
}
function leerLocal(clave) {
  try { const v = localStorage.getItem(clave); return v ? JSON.parse(v) : null; } catch { return null; }
}

// (v0.65, para probar «abrir sin cobertura» en la demo: localStorage «fbe-demo-sin-red» = 1) sin conexión, la demo tampoco
// llega a la «base»: ni lee ni escribe, como el de verdad (si no, sin red sigue funcionando entera, que es lo que hace siempre)
function sinRedDemo() {
  try {
    if (typeof navigator === 'undefined' || navigator.onLine !== false || localStorage.getItem('fbe-demo-sin-red') !== '1') return;
  } catch { return; }
  const e = new Error('Sin conexión.');
  e.sinConexion = true;
  throw e;
}

export function crearBackendMemoria({ semilla, clave = 'fbe-demo-v2', persistir = true } = {}) {
  let db = (persistir && leerLocal(clave)) || semilla();
  let sesion = (persistir && leerLocal(clave + '-sesion')) || null;
  const oyentes = new Set();
  const ficheros = new Map();  // ruta → Blob (solo en memoria: no sobreviven a recargar la página)
  const urls = new Map();
  const alias = new Map();     // v0.55: ruta de una copia → la del original (los ejemplos de la demo no son blobs)
  const trozos = new Map();    // v0.57: lo subido de cada subida «por trozos» a medias (de 0 a 10), por su dirección
  let temporizador = null;

  const tabla = (t) => (db[t] ||= []);
  const persistirYa = () => {
    if (!persistir) return;
    clearTimeout(temporizador);
    temporizador = setTimeout(() => guardarLocal(clave, db), 150);
  };
  const avisar = () => { guardarLocal(clave + '-sesion', persistir ? sesion : null); oyentes.forEach((f) => f(sesion)); };
  const esCoach = () => tabla('perfiles').find((p) => p.id === sesion?.user.id)?.rol === 'coach';
  const buscar = (t, id) => tabla(t).find((x) => x.id === id);
  const miPerfil = () => tabla('perfiles').find((p) => p.id === sesion?.user.id);
  const deBaja = () => !esCoach() && tabla('atletas').some((a) => a.perfil_id === sesion?.user.id && a.estado === 'baja');
  const ESCRIBE_ATLETA = ['series', 'pesos', 'checkins', 'molestias', 'medidas', 'marcas', 'comentarios', 'archivos', 'sesiones', 'notas_ejercicio', 'registros_habito', 'registros_nutricion', 'cuestionarios', 'menu_comidas', 'comidas_atleta', 'recetas_atleta', 'menu_dias', 'comunidad_posts', 'comunidad_comentarios'];
  const comprobarAlta = (t) => {
    if (ESCRIBE_ATLETA.includes(t) && deBaja()) throw new Error('Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada');
  };
  const atletaDeSesion = (sesionId) => {
    const s = buscar('sesiones', sesionId);
    const w = s && buscar('semanas', s.semana_id);
    return (w && buscar('bloques', w.bloque_id))?.atleta_id ?? null;
  };

  // Como la migración 027: la comunidad. Lo de los demás solo se ve dentro (abierta, sin haber salido ni haber
  // sido sacado, con el texto vigente aceptado, sin estar de baja y sin ser la ficha del coach); el coach, todo.
  // (El texto cambió en la 029, v0.47: como VERSION_COMUNIDAD de api.js)
  const VERSION_COMUNIDAD = 'comunidad-2026-11-b';
  const perfilDe = (id) => tabla('perfiles').find((p) => p.id === id);
  const comunidadActiva = () => !!tabla('comunidad_ajustes').find((x) => x.id === true)?.activa;
  const miembroVisto = (m) => { const a = m && buscar('atletas', m.atleta_id); return !!a && !m.salido_en && !m.bloqueado && m.version === VERSION_COMUNIDAD && m.normas_version === VERSION_NORMAS && a.perfil_id === m.perfil_id && a.estado !== 'baja' && perfilDe(m.perfil_id)?.rol !== 'coach'; };
  const esMiembro = (pid) => miembroVisto(tabla('comunidad_miembros').find((x) => x.perfil_id === pid));
  const soyMiembro = () => !!sesion && comunidadActiva() && esMiembro(sesion.user.id);
  const veComunidad = () => esCoach() || soyMiembro();
  const autorVisible = (pid) => veComunidad() && (perfilDe(pid)?.rol === 'coach' || esMiembro(pid));
  // (044) lo programado, hasta su hora, y lo retenido (salvo a su autor), solo el coach
  // (045) y un momento, solo sus 24 horas
  const postALaVista = (x) => !x.oculta && (!x.retenida || x.autor_id === sesion?.user.id) && (!x.publicar_en || Date.parse(x.publicar_en) <= Date.now())
    && (x.tipo !== 'momento' || Date.parse(x.creado_en) > Date.now() - HORAS_MOMENTO * 3600e3)
    // (revisión) un aniversario, los demás solo mientras su autor sale en el ranking
    && (x.tipo !== 'aniversario' || x.autor_id === sesion?.user.id || !tabla('comunidad_miembros').some((m) => m.perfil_id === x.autor_id && m.sin_ranking));
  const postVisible = (id) => { const x = buscar('comunidad_posts', id); return !!x && (esCoach() || (postALaVista(x) && soyMiembro() && autorVisible(x.autor_id))); };
  const comentarioALaVista = (k) => !k.oculto && (!k.retenido || k.autor_id === sesion?.user.id);
  const comentarioEquipoVisible = (id) => { const k = buscar('comunidad_comentarios', id); return !!k && (esCoach() || (comentarioALaVista(k) && soyMiembro() && autorVisible(k.autor_id) && postVisible(k.post_id))); };
  // (044) el atleta de la semana: el de ahora, si sigue dentro y sale en el ranking (el coach, todos)
  const destacadoVisible = (d) => { const m = tabla('comunidad_miembros').find((x) => x.perfil_id === d.perfil_id); return soyMiembro() && esMiembro(d.perfil_id) && !m?.sin_ranking && Date.parse(d.desde) <= Date.now() && Date.parse(d.hasta) > Date.now(); };
  const VISIBLE = {
    comunidad_miembros: (x) => esCoach() || x.perfil_id === sesion?.user.id,
    comunidad_posts: (x) => esCoach() || (postALaVista(x) && soyMiembro() && autorVisible(x.autor_id)),
    comunidad_comentarios: (x) => esCoach() || (comentarioALaVista(x) && soyMiembro() && autorVisible(x.autor_id) && postVisible(x.post_id)),
    comunidad_reacciones: (x) => esCoach() || (soyMiembro() && autorVisible(x.autor_id) && postVisible(x.post_id)),
    comunidad_reportes: () => esCoach(),
    comunidad_retos: () => esCoach() || soyMiembro(),
    comunidad_cupos: () => false,
    // Como la 029: los votos, como las reacciones; los ánimos, los que uno manda y los que recibe
    comunidad_votos: (x) => esCoach() || (soyMiembro() && autorVisible(x.autor_id) && postVisible(x.post_id)),
    comunidad_animos: (x) => esCoach() || (soyMiembro() && ((x.para === sesion?.user.id && autorVisible(x.de)) || (x.de === sesion?.user.id && autorVisible(x.para)))),
    // Como la 041: los 💪 a comentarios, como las reacciones (del comentario que se ve); las bienvenidas, como los ánimos
    comunidad_comentario_reacciones: (x) => esCoach() || (soyMiembro() && autorVisible(x.autor_id) && comentarioEquipoVisible(x.comentario_id)),
    comunidad_bienvenidas: (x) => esCoach() || (soyMiembro() && ((x.para === sesion?.user.id && autorVisible(x.de)) || (x.de === sesion?.user.id && autorVisible(x.para)))),
    // Como la 042: las parejas, cada uno las suyas (con quien sigue dentro; el coach, todas); el reparto de los equipos, solo el coach
    comunidad_companeros: (x) => esCoach() || (soyMiembro() && ((x.de === sesion?.user.id && autorVisible(x.para)) || (x.para === sesion?.user.id && autorVisible(x.de)))),
    comunidad_reto_equipos: () => esCoach(),
    // Como la 043: lo guardado, solo su dueño; las preguntas frecuentes, los de dentro y el coach
    comunidad_guardados: (x) => x.perfil_id === sesion?.user.id,
    comunidad_preguntas: () => esCoach() || soyMiembro(),
    // Como la 044: los eventos, dentro; quién va, como las reacciones; las plantillas y la moderación, el coach
    comunidad_eventos: () => esCoach() || soyMiembro(),
    comunidad_evento_asistentes: (x) => esCoach() || (soyMiembro() && autorVisible(x.perfil_id)),
    comunidad_plantillas: () => esCoach(),
    comunidad_destacados: (d) => esCoach() || destacadoVisible(d),
    comunidad_moderacion: () => esCoach(),
    // (045) los aniversarios ya puestos, solo la base
    comunidad_aniversarios: () => false,
    // Como la 030: los mensajes y avisos programados no los ve el atleta hasta su hora; las tareas, el coach y su atleta
    // (y, como en la base, cada atleta solo ve sus mensajes y los avisos para todos o para él)
    comentarios: (x) => esCoach() || (x.atleta_id === miAtletaId() && (!x.enviar_en || Date.parse(x.enviar_en) <= Date.now())),
    avisos: (x) => esCoach() || ((x.atleta_id == null || x.atleta_id === miAtletaId()) && (!x.enviar_en || Date.parse(x.enviar_en) <= Date.now())),
    // Las notificaciones, cada uno las suyas; el atleta, las pendientes solo cuando ya tocan (las de lo programado)
    notificaciones: (x) => x.usuario_id === sesion?.user.id && (esCoach() || x.estado !== 'pendiente' || Date.parse(x.enviar_desde) <= Date.now()),
    tareas: (x) => esCoach() || x.atleta_id === miAtletaId(),
    tareas_plantillas: () => esCoach(),
    // Como la 032: reacciones, de las dos partes y en lo que se ve; destacados, cada uno los suyos; el estado de las
    // conversaciones, solo el coach; la presencia, la propia y la de la otra parte (si los dos la enseñan)
    comentario_reacciones: (x) => comentarioVisible(x.comentario_id),
    comentario_destacados: (x) => x.usuario_id === sesion?.user.id && comentarioVisible(x.comentario_id),
    conversacion_estado: () => esCoach(),
    presencia: (x) => x.usuario_id === sesion?.user.id || (x.visible !== false && presenciaPuedoVer(x.usuario_id)),
    chat_cupos: () => false,
    // Como la 033: lo fijado, el coach y ese atleta (mientras no caduca); los silencios, cada uno los suyos; las listas
    // de difusión, solo el coach
    conversacion_fijado: (x) => esCoach() || (!!miAtletaId() && x.atleta_id === miAtletaId() && (x.hasta == null || Date.parse(x.hasta) > Date.now())),
    chat_silencios: (x) => x.usuario_id === sesion?.user.id,
    listas_difusion: () => esCoach(),
    listas_difusion_miembros: () => esCoach(),
    // Como la 034: las encuestas, el coach y el atleta de esa conversación (de mensajes ya salidos); el voto, el coach y él
    encuestas_chat: (x) => esCoach() || (!!miAtletaId() && x.atleta_id === miAtletaId() && comentarioVisible(x.comentario_id)),
    encuesta_votos: (x) => esCoach() || (!!miAtletaId() && x.atleta_id === miAtletaId()),
    // Como la 034: la versión de la política vista, la propia (y el coach, todas)
    privacidad_vista: (x) => x.usuario_id === sesion?.user.id || esCoach(),
    // Como la 035: la corrección (con sus horas), solo el coach: el atleta lee la suya con video_correcciones() (días);
    // las listas de puntos clave, solo el coach
    video_revisiones: () => esCoach(),
    tecnica_plantillas: () => esCoach(),
    // Como la 037: recordatorios, frases y vídeos modelo, solo el coach (el atleta lee sus recordatorios activos con
    // recordatorios_activos() y los vídeos modelo con videos_modelo_de()); la valoración, el coach y su atleta
    recordatorios_tecnica: () => esCoach(),
    frases_correccion: () => esCoach(),
    videos_modelo: () => esCoach(),
    // Como la 039: la velocidad mínima de cada ejercicio, solo el coach (el atleta la lee con umbrales_velocidad_de())
    umbrales_velocidad: () => esCoach(),
    // Como la 040: la revisión semanal, solo el coach
    revisiones_semanales: () => esCoach(),
    video_autoevaluacion: (x) => esCoach() || (!!miAtletaId() && x.atleta_id === miAtletaId()),
  };
  const comentarioVisible = (id) => { const c = buscar('comentarios', id); return !!c && VISIBLE.comentarios(c); };
  const programadoAun = (c) => !!c?.enviar_en && Date.parse(c.enviar_en) > Date.now();
  const comentarioReaccionable = (id) => { const c = buscar('comentarios', id); return !!c && !c.eliminado_en && !programadoAun(c) && (esCoach() || (!!miAtletaId() && c.atleta_id === miAtletaId())); };
  const presenciaMiaVisible = () => tabla('presencia').find((x) => x.usuario_id === sesion?.user.id)?.visible !== false;
  const presenciaPuedoVer = (pid) => !!sesion && pid !== sesion.user.id && presenciaMiaVisible()
    && ((esCoach() && tabla('atletas').some((a) => a.perfil_id === pid)) || (!!miAtletaId() && perfilDe(pid)?.rol === 'coach'));
  function gastarCupoChat(tipo) {
    const uid = sesion?.user.id;
    if (!uid || esCoach()) return;
    db.chat_cupos = tabla('chat_cupos').filter((c) => Date.parse(c.creado_en) > Date.now() - 2 * 3600000);
    if (tabla('chat_cupos').filter((c) => c.perfil_id === uid && c.tipo === tipo && Date.parse(c.creado_en) > Date.now() - 3600000).length >= CUPO_CHAT[tipo]) throw new Error(AVISO_CUPO_CHAT[tipo]);
    tabla('chat_cupos').push({ perfil_id: uid, tipo, creado_en: ahora() });
  }
  // Como la 032: el hilo de un mensaje (el chat, una sesión, un check-in o un vídeo del diario)
  function gastarCupoCoach(tipo, n) {
    const uid = sesion?.user.id;
    db.chat_cupos = tabla('chat_cupos').filter((c) => Date.parse(c.creado_en) > Date.now() - 2 * 3600000);
    if (tabla('chat_cupos').filter((c) => c.perfil_id === uid && c.tipo === tipo && Date.parse(c.creado_en) > Date.now() - 3600000).length + n > CUPO_COACH[tipo]) throw new Error(AVISO_CUPO_CHAT[tipo]);
    for (let i = 0; i < n; i++) tabla('chat_cupos').push({ perfil_id: uid, tipo, creado_en: ahora() });
  }
  const hiloDe = (c) => [c.sesion_id || null, c.checkin_id || null, c.adjunto ? null : c.archivo_id || null].join('|');
  // Como la 032: las horas del estado de una conversación las pone la base; archivar desfija; 3 fijadas como mucho
  function prepararEstadoConversacion(f, antes) {
    f.fijada_en = f.fijada_en == null ? null : antes?.fijada_en || ahora();
    f.archivada_en = f.archivada_en == null ? null : antes?.archivada_en || ahora();
    if (f.archivada_en) f.fijada_en = null;
    f.no_leida = !!f.no_leida;
    if (f.fijada_en && tabla('conversacion_estado').filter((e) => e.fijada_en && e.atleta_id !== f.atleta_id).length >= 3) throw new Error('Puedes fijar 3 conversaciones como mucho');
    f.actualizado_en = ahora();
  }
  // Como la 032 (revisión): vaciar un mensaje (eliminar para todos), la cola de Storage y lo que Storage deja ver y borrar
  function vaciarComentario(c) {
    Object.assign(c, { texto: 'Se eliminó este mensaje', dibujo: null, responde_a: null, editado_en: null, eliminado_en: c.eliminado_en || ahora(), archivo_id: c.adjunto ? null : c.archivo_id, resumen_sesion: false });
    db.comentario_reacciones = tabla('comentario_reacciones').filter((r) => r.comentario_id !== c.id);
    db.comentario_destacados = tabla('comentario_destacados').filter((d) => d.comentario_id !== c.id);
    // Como la 033: si estaba fijado, se desfija
    db.conversacion_fijado = tabla('conversacion_fijado').filter((f) => f.comentario_id !== c.id);
    // Como la 034: su encuesta (y su voto), fuera
    const enc = tabla('encuestas_chat').filter((e) => e.comentario_id === c.id).map((e) => e.id);
    if (enc.length) { db.encuestas_chat = tabla('encuestas_chat').filter((e) => !enc.includes(e.id)); db.encuesta_votos = tabla('encuesta_votos').filter((v) => !enc.includes(v.encuesta_id)); }
    db.notificaciones = tabla('notificaciones').filter((n) => !(n.clave === `comentario:${c.id}` && n.estado === 'pendiente'));
    // Como la 038: su respuesta en vídeo se va con él
    if (c.video_respuesta_id && buscar('archivos', c.video_respuesta_id)?.tipo === 'adjunto') borrarCascada('archivos', [c.video_respuesta_id]);
  }
  // (045: la clave es el bucket y la ruta)
  const encolar = (rutas, bucket = 'archivos') => { for (const r of rutas) if (r && !tabla('storage_por_borrar').some((x) => x.ruta === r && (x.bucket || 'archivos') === bucket)) tabla('storage_por_borrar').push({ ruta: r, bucket, creado_en: ahora() }); };
  // (038) también el vídeo de una respuesta en el hilo de un vídeo
  const archivoConMensajes = (id) => tabla('comentarios').some((c) => c.archivo_id === id || c.video_respuesta_id === id);
  // Como la 033: quién subió un archivo (lo pone la base; los de la demo de antes, de quien escribió su mensaje)
  const subidoPor = (a) => a?.subido_por ?? (tabla('comentarios').some((c) => c.archivo_id === a?.id && c.autor === 'atleta') ? 'atleta'
    : tabla('comentarios').some((c) => c.archivo_id === a?.id && c.autor === 'coach') ? 'coach' : null);
  const archivoDeRuta = (ruta) => tabla('archivos').find((a) => a.ruta === ruta || a.poster_ruta === ruta);
  const archivoVisible = (ruta) => { if (esCoach()) return true; if (modeloVisible(ruta)) return true; const a = archivoDeRuta(ruta); return !!a && !!miAtletaId() && a.atleta_id === miAtletaId() && ruta.split('/')[0] === miAtletaId(); };
  // Como la 037 (fbe_modelos_ver): un vídeo modelo (o su miniatura), a los atletas vinculados que no están de baja; nada más de modelos/
  const modeloVisible = (ruta) => String(ruta || '').split('/')[0] === 'modelos' && !!miAtletaId() && !deBaja() && tabla('videos_modelo').some((m) => m.ruta === ruta || m.poster_ruta === ruta);
  const archivoBorrable = (ruta) => { if (esCoach()) return true; const a = archivoDeRuta(ruta); return !!a && archivoVisible(ruta) && !DEL_CHAT.includes(a.tipo); };
  // Como la 033: las fotos, los vídeos y los documentos del chat; (034) y las notas de voz
  const DEL_CHAT = ['adjunto', 'documento', 'audio'];
  const deBajaYo = () => !esCoach() && deBaja();
  const miAtletaId = () => tabla('atletas').find((a) => a.perfil_id === sesion?.user.id)?.id || null;
  // (043: también las de comunidad_posts.fotos)
  const usaFoto = (x, ruta) => x.foto_ruta === ruta || (Array.isArray(x.fotos) && x.fotos.includes(ruta));
  const fotoVisible = (ruta) => esCoach() || (!!miAtletaId() && ruta.split('/')[0] === miAtletaId()) || tabla('comunidad_posts').some((x) => usaFoto(x, ruta) && postVisible(x.id));
  const fotoRegistrada = (ruta) => tabla('comunidad_posts').some((x) => usaFoto(x, ruta) && x.autor_id === sesion?.user.id && !x.oculta && Date.parse(x.creado_en) > Date.now() - 15 * 60000 && veComunidad());
  const fotoBorrable = (ruta) => !!miAtletaId() && ruta.split('/')[0] === miAtletaId() && !tabla('comunidad_posts').some((x) => usaFoto(x, ruta))
    && !tabla('comunidad_reportes').some((r) => usaCopia(r, ruta) && !r.resuelto_en);
  // (043, revisión) el aviso al coach guarda todas las fotos de lo avisado (copia_fotos) hasta que se resuelve
  function usaCopia(r, ruta) { return r.copia_foto === ruta || (Array.isArray(r.copia_fotos) && r.copia_fotos.includes(ruta)); }
  const sinPermiso = () => new Error('new row violates row-level security policy');
  // Cupos diarios (comunidad_cupos: no se borra con lo publicado)
  function gastarCupo(tipo) {
    const uid = sesion?.user.id;
    if (!uid || esCoach()) return;
    const max = tipo === 'comentario' ? 100 : tipo === 'animo' ? 40 : tipo === 'voto' ? 30 : 20;
    const usados = tabla('comunidad_cupos').filter((c) => c.perfil_id === uid && c.tipo === tipo && Date.parse(c.creado_en) > Date.now() - 864e5).length;
    if (usados >= max) throw new Error(tipo === 'post' ? 'Has publicado 20 veces en las últimas 24 horas: espera un poco' : tipo === 'comentario' ? 'Has escrito 100 comentarios en las últimas 24 horas: espera un poco'
      : tipo === 'animo' ? 'Has mandado 40 ánimos en las últimas 24 horas: mañana, más' : tipo === 'voto' ? 'Has votado 30 veces en las últimas 24 horas: mañana, más'
        : 'Has avisado 20 veces en las últimas 24 horas: escribe a tu coach');
    tabla('comunidad_cupos').push({ id: tabla('comunidad_cupos').length + 1, perfil_id: uid, tipo, creado_en: ahora() });
  }
  // Un nombre que se puede usar en el equipo (null) o por qué no
  const DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g'); // (en un texto: el empaquetado deja ASCII puro)
  const normal = (t) => String(t || '').toLowerCase().normalize('NFD').replace(DIACRITICOS, '');
  function problemaNombre(v, atletaId) {
    if (!(v.length >= 2 && v.length <= 40 && textoVisible(v))) return 'Tu nombre en el equipo, de 2 a 40 letras';
    const n = normal(v);
    if (/(^|[^a-z0-9])(coach|entrenador|entrenadora|fbe)([^a-z0-9]|$)/.test(n)) return 'Ese nombre se confunde con el del coach: elige otro';
    if (tabla('perfiles').some((p) => p.rol === 'coach' && String(p.nombre || '').trim() && n.split(' ')[0] === normal(String(p.nombre).trim()).split(' ')[0])) return 'Ese nombre se confunde con el del coach: elige otro';
    if (tabla('comunidad_miembros').some((m) => !m.salido_en && m.atleta_id !== atletaId && m.nombre.toLowerCase() === v.toLowerCase())) return 'Ya hay alguien en el equipo con ese nombre: elige otro';
    return null;
  }
  // Como la 029: de las menciones quedan solo quienes están dentro (o el coach), nunca el autor, sin repetir y 5 como mucho
  const limpiarMenciones = (ids, autor) => [...new Set((Array.isArray(ids) ? ids : []).filter((x) => x && x !== autor && (perfilDe(x)?.rol === 'coach' || esMiembro(x))))].slice(0, 5);
  function prepararPost(f) {
    const uid = sesion?.user.id;
    Object.assign(f, { autor_id: uid, creado_en: ahora(), oculta: false, sesion_id: null, resumen: null, reto_id: null });
    if (esCoach()) {
      f.atleta_id = null;
      if (f.tipo !== 'aviso' && f.tipo !== 'encuesta' && f.tipo !== 'momento') throw new Error('Como coach, en el muro publicas avisos, encuestas y momentos');
      if (f.foto_ruta && (!['aviso', 'momento'].includes(f.tipo) || !String(f.foto_ruta).startsWith('coach/'))) throw new Error('La foto no va en su sitio');
      if (f.tipo === 'encuesta') {
        const e = f.encuesta;
        if (!e || typeof e !== 'object' || !Array.isArray(e.opciones)) throw new Error('Una encuesta lleva de 2 a 4 opciones');
        const cierre = e.cierre ? Date.parse(e.cierre) : null;
        if (e.cierre && !Number.isFinite(cierre)) throw new Error('El cierre de la encuesta no es una fecha válida');
        if (cierre != null && cierre <= Date.now() + 5 * 60000) throw new Error('El cierre de la encuesta, más adelante (o sin cierre)');
        f.encuesta = { opciones: e.opciones.map((o) => String(o ?? '').trim()), cierre: cierre != null ? new Date(cierre).toISOString() : null };
      } else f.encuesta = null;
    } else {
      if (!soyMiembro()) throw sinPermiso();
      f.atleta_id = miAtletaId();
      f.fijada = false;
      f.encuesta = null;
      if (f.tipo !== 'post' && f.tipo !== 'momento') throw new Error('Los avisos y las encuestas son del coach, y los entrenos y los logros se comparten desde su sitio');
      if (f.foto_ruta && !String(f.foto_ruta).startsWith(`${f.atleta_id}/`)) throw new Error('La foto no va en su sitio');
    }
    f.menciones = limpiarMenciones(f.menciones, uid);
    // Como la 043 (comunidad_post_tema): el tema que toca, las fotos en la carpeta de la primera y sin mejor respuesta
    f.mejor_comentario = null;
    if (f.tipo === 'post' && f.tema === 'avisos') throw new Error('Los avisos son del coach: elige otro tema');
    f.tema = temaAlPublicar(f.tipo, f.tema, esCoach());
    // Como la 045 (comunidad_post_momento): un momento, una foto y una línea de hasta 140, sin tema, varias fotos ni menciones
    if (f.tipo === 'momento') {
      const l = limpiarMomento(f.texto);
      if (l.error) throw new Error('La línea de un momento, hasta 140 letras');
      if (!f.foto_ruta) throw new Error('Un momento lleva una foto');
      Object.assign(f, { texto: l.texto, tema: null, fotos: null, menciones: [] });
    }
    if (f.fotos != null && (!Array.isArray(f.fotos) || f.fotos.some((x) => !x || String(x).split('/')[0] !== String(f.foto_ruta || '').split('/')[0]))) throw new Error('La foto no va en su sitio');
    // (revisión) una foto, en una sola publicación (aunque la otra esté oculta) y no la de un aviso abierto al coach
    const rutas = [f.foto_ruta, ...(Array.isArray(f.fotos) ? f.fotos : [])].filter(Boolean);
    // (045, revisión) ni la de un momento caducado que espera a borrarse de Storage
    if (rutas.some((r) => tabla('comunidad_posts').some((x) => x.id !== f.id && usaFoto(x, r)) || tabla('comunidad_reportes').some((k) => !k.resuelto_en && usaCopia(k, r))
      || tabla('storage_por_borrar').some((x) => x.bucket === 'comunidad' && x.ruta === r))) throw new Error('Esa foto ya está en otra publicación');
    // Como la 044 (comunidad_post_programar): lo programado, un aviso o una encuesta del coach de 30 s a 90 días vista; sale con la
    // fecha de su hora y sin menciones
    if (f.publicar_en != null && !(Date.parse(f.publicar_en) > Date.now() + 30000)) f.publicar_en = null;
    if (f.publicar_en != null) {
      if (!esCoach()) throw new Error('Solo el coach programa publicaciones');
      if (!['aviso', 'encuesta'].includes(f.tipo)) throw new Error('Se programan los avisos y las encuestas');
      if (Date.parse(f.publicar_en) > Date.now() + 90 * 864e5) throw new Error('Como mucho a 90 días vista');
      if (f.tipo === 'encuesta' && f.encuesta?.cierre && Date.parse(f.encuesta.cierre) <= Date.parse(f.publicar_en) + 5 * 60000) throw new Error('El cierre de la encuesta, después de publicarla');
      f.publicar_en = new Date(Date.parse(f.publicar_en)).toISOString();
      f.creado_en = f.publicar_en;
      f.menciones = [];
    }
    // (044, comunidad_post_moderar) silenciado no; el modo lento; con una palabra filtrada, retenida
    f.retenida = !['aviso', 'encuesta'].includes(f.tipo) && moderarEntrada(uid, ['post', 'momento'].includes(f.tipo), f.texto);
    gastarCupo('post');
  }
  // Como fbe_privado.comunidad_moderar_entrada (044): para un atleta (el coach nunca), silenciado no publica ni comenta; con el modo
  // lento, una publicación cada X minutos; devuelve si lleva una palabra filtrada (y entonces se retiene)
  function moderarEntrada(autor, publicacion, texto) {
    if (!autor || perfilDe(autor)?.rol === 'coach') return false;
    const hasta = tabla('comunidad_miembros').find((m) => m.perfil_id === autor)?.silenciado_hasta;
    if (hasta && Date.parse(hasta) > Date.now()) {
      const p = partesMadrid(hasta);
      throw new Error(`Tu coach ha pausado tus publicaciones y comentarios hasta el ${Number(p.fecha.slice(8))}/${Number(p.fecha.slice(5, 7))} a las ${p.hora}. Mientras, puedes leer y reaccionar.`);
    }
    const m = tabla('comunidad_moderacion').find((x) => x.id === true) || { palabras: [], lento_min: 0 };
    if (publicacion && m.lento_min > 0) {
      const ultima = tabla('comunidad_posts').filter((x) => x.autor_id === autor && ['post', 'momento'].includes(x.tipo)).map((x) => x.creado_en).sort().at(-1); // (045: y los momentos)
      if (ultima && Date.parse(ultima) > Date.now() - m.lento_min * 60000) {
        throw new Error(`Modo lento: una publicación cada ${m.lento_min} minutos. Podrás volver a publicar a las ${partesMadrid(new Date(Date.parse(ultima) + m.lento_min * 60000)).hora}.`);
      }
    }
    return textoFiltrado(texto, m.palabras || []);
  }
  // Como comunidad_evento_preparar (044): las fechas las pone la base; nuevo (o con otra hora), más adelante y como mucho a un
  // año; cancelado, no se descancela
  function prepararEvento(f, antes = null) {
    if (!antes) { f.creado_en = ahora(); f.cancelado_en = null; } else {
      f.creado_en = antes.creado_en;
      f.cancelado_en = antes.cancelado_en || (f.cancelado_en ? ahora() : null);
    }
    f.actualizado_en = ahora();
    f.titulo = String(f.titulo ?? '').trim();
    f.lugar = String(f.lugar ?? '').trim();
    f.descripcion = String(f.descripcion ?? '').trim() || null;
    f.plazas = f.plazas == null || f.plazas === '' ? null : Number(f.plazas);
    if ((!antes || f.empieza_en !== antes.empieza_en) && !f.cancelado_en) {
      const t = Date.parse(f.empieza_en);
      if (!(t > Date.now())) throw new Error('El evento, más adelante (esa hora ya ha pasado)');
      if (t > Date.now() + 366 * 864e5) throw new Error('El evento, como mucho dentro de un año');
      f.empieza_en = new Date(t).toISOString();
    }
  }
  function prepararComentarioComunidad(f) {
    const uid = sesion?.user.id;
    if (!(esCoach() || soyMiembro()) || !postVisible(f.post_id)) throw sinPermiso();
    Object.assign(f, { autor_id: uid, creado_en: ahora(), oculto: false, atleta_id: esCoach() ? null : miAtletaId() });
    f.menciones = limpiarMenciones(f.menciones, uid);
    // (045) un momento no lleva comentarios; una pegatina lleva su texto y ninguna mención
    if (buscar('comunidad_posts', f.post_id)?.tipo === 'momento') throw new Error('Los momentos no llevan comentarios: reacciona');
    if (f.pegatina != null) {
      if (!pegatinaValida(f.pegatina)) throw new Error('Esa pegatina no existe');
      Object.assign(f, { texto: textoPegatina(f.pegatina), menciones: [] });
    }
    f.retenido = moderarEntrada(uid, false, f.texto); // (044)
    // Como la 041: una respuesta, a un comentario de la misma publicación que se ve; a una respuesta, cuelga del mismo
    if (f.responde_a) {
      const padre = buscar('comunidad_comentarios', f.responde_a);
      if (padre?.responde_a) f.responde_a = padre.responde_a;
      const k = buscar('comunidad_comentarios', f.responde_a);
      if (!k || k.post_id !== f.post_id || !comentarioEquipoVisible(k.id)) throw new Error('Ese comentario ya no está');
    } else f.responde_a = null;
    gastarCupo('comentario');
  }
  // La mejor serie de cada ejercicio de una sesión y su 1RM estimado (como comunidad_compartir_sesion)
  const e1rmBase = (s) => {
    const k = Number(s.kg), r = Number(s.reps);
    if (!(k > 0) || !(r >= 1 && r <= 12)) return null;
    const res = s.rir != null ? Math.max(0, Number(s.rir)) : s.rpe != null ? Math.max(0, 10 - Number(s.rpe)) : 0;
    return Math.round(k * (r + res <= 1 ? 1 : 1 + (r + res) / 30) * 10) / 10;
  };

  // Lo que en Supabase hacen los triggers
  function antesDeInsertar(t, f, { interno = false } = {}) {
    comprobarAlta(t);
    if (t === 'comunidad_posts') prepararPost(f);
    if (t === 'comunidad_comentarios') prepararComentarioComunidad(f);
    // (044) los eventos y las plantillas (como mucho 30)
    if (t === 'comunidad_eventos') prepararEvento(f);
    if (t === 'comunidad_plantillas') {
      if (tabla(t).length >= MAX_PLANTILLAS) throw new Error(`Como mucho ${MAX_PLANTILLAS} plantillas: borra alguna antes`);
      f.texto = String(f.texto ?? '').trim();
      f.creado_en = ahora();
    }
    if (t === 'series' && !f.atleta_id) {
      const se = buscar('sesion_ejercicios', f.sesion_ejercicio_id);
      f.atleta_id = se ? atletaDeSesion(se.sesion_id) : null;
    }
    if (t === 'comentarios') {
      f.autor = esCoach() ? 'coach' : 'atleta';
      // Como la 030: programar, solo el coach y en el chat; como mucho a 90 días; uno para «ya mismo» sale ya
      if (f.enviar_en != null) {
        if (f.autor !== 'coach' || f.sesion_id || f.checkin_id || f.archivo_id) throw new Error('Solo los mensajes del coach en el chat se pueden programar');
        if (Date.parse(f.enviar_en) > Date.now() + 90 * 864e5) throw new Error('Un mensaje se programa como mucho a 90 días vista');
        if (!(Date.parse(f.enviar_en) > Date.now() + 30000)) f.enviar_en = null;
      }
      if (f.sesion_id) f.atleta_id = atletaDeSesion(f.sesion_id);
      else if (f.checkin_id) f.atleta_id = buscar('checkins', f.checkin_id)?.atleta_id;
      else if (f.archivo_id) f.atleta_id = buscar('archivos', f.archivo_id)?.atleta_id;
      if (!f.atleta_id) throw new Error('No se puede comentar aquí');
      // Como la 035: la voz del coach sobre un vídeo no va en un mensaje (al borrar el vídeo, se borra)
      if (f.archivo_id && esVozDeVideo(f.archivo_id)) throw new Error('Esa nota de voz es la voz de tu coach sobre un vídeo: no va en un mensaje');
      // Como atleta_crear (002): un atleta solo escribe en su conversación
      if (!esCoach() && f.atleta_id !== miAtletaId()) throw sinPermiso();
      // Como la 014: el adjunto lo fija la base según el tipo del archivo (033: también un documento)
      f.adjunto = !!f.archivo_id && DEL_CHAT.includes(buscar('archivos', f.archivo_id)?.tipo);
      // Como la 033: una foto, un vídeo o un documento del chat, en un mensaje de quien lo subió
      if (!interno && f.adjunto && subidoPor(buscar('archivos', f.archivo_id)) !== f.autor) throw new Error('Ese archivo no lo has subido tú');
      f.leido_en = null;
      // Como la 033: «Reenviado» solo lo pone chat_reenviar; «entregado», la base; el id del móvil no se repite
      if (!interno) f.reenviado = false;
      f.entregado_en = null;
      f.escuchado_en = null;
      f.cliente_id = f.cliente_id || null;
      if (f.cliente_id && tabla('comentarios').some((x) => x.atleta_id === f.atleta_id && x.autor === f.autor && x.cliente_id === f.cliente_id)) {
        throw new Error('duplicate key value violates unique constraint "comentarios_cliente_unico"');
      }
      f.creado_en = f.enviar_en ? new Date(Date.parse(f.enviar_en)).toISOString() : ahora();
      // Como la 032: nadie crea un mensaje ya editado o eliminado; la cita, de la misma conversación y del mismo hilo,
      // de algo que quien escribe ya ve, que ya ha salido y que no se ha eliminado
      f.editado_en = null; f.eliminado_en = null;
      comprobarRespuestaVideo(f, interno);
      // Como la 039: el resumen de una sesión, solo del coach, en el hilo de una sesión y uno por sesión
      if (f.resumen_sesion) {
        if (f.autor !== 'coach' || !esCoach()) throw new Error('El resumen de una sesión lo escribe tu coach');
        if (!f.sesion_id || f.archivo_id || f.checkin_id) throw new Error('El resumen va en el hilo de una sesión');
        if (tabla('comentarios').some((c) => c.sesion_id === f.sesion_id && c.resumen_sesion && !c.eliminado_en)) throw new Error('Ya le has mandado el resumen de esta sesión: lo tiene en el hilo de la sesión (si quieres cambiarlo, edítalo)');
        f.resumen_sesion = true;
      } else f.resumen_sesion = false;
      if (f.responde_a) {
        const c = buscar('comentarios', f.responde_a);
        if (!c || !VISIBLE.comentarios(c) || c.atleta_id !== f.atleta_id || hiloDe(c) !== hiloDe(f) || c.eliminado_en || programadoAun(c)) {
          throw new Error('Solo puedes responder a un mensaje de esta conversación');
        }
      } else f.responde_a = null;
    }
    if (t === 'avisos') prepararAviso(f, null);
    if (t === 'tareas') f.creada_en = ahora();
    if (t === 'tareas_plantillas') {
      if (tabla('tareas_plantillas').length >= 30) throw new Error('Ya tienes 30 plantillas de tareas: borra alguna antes de guardar otra');
      f.creada_en = ahora();
    }
    if (t === 'atletas') fechaBaja(f, null);
    if (t === 'archivos') {
      // Como la 035: el día de un archivo del atleta, como mucho mañana (en Madrid)
      if (!esCoach() && f.fecha && f.fecha > sumar(fechaMadrid(), 1)) f.fecha = sumar(fechaMadrid(), 1);
      comprobarEnlaces(f);
      comprobarAngulo(f, null);
      // Como la 035: el fotograma de un vídeo, solo del coach y de un vídeo de técnica de ese atleta
      if (f.derivado_de != null) {
        if (!esCoach()) throw new Error('Solo el coach manda un fotograma de un vídeo');
        const v = buscar('archivos', f.derivado_de);
        if (!v || v.tipo !== 'video_tecnica' || v.atleta_id !== f.atleta_id || f.tipo !== 'adjunto' || !/^image\//.test(f.mime || '')) throw new Error('El fotograma tiene que ser de un vídeo de técnica de este atleta');
      } else f.derivado_de = null;
    }
    if (t === 'video_revisiones') {
      if (tabla(t).some((x) => x.archivo_id === f.archivo_id)) throw new Error('duplicate key value violates unique constraint "video_revisiones_pkey"');
      prepararRevision(f, null);
    }
    if (t === 'recordatorios_tecnica') prepararRecordatorio(f, null);
    if (t === 'frases_correccion') prepararFrase(f, null);
    if (t === 'videos_modelo') prepararModelo(f, null);
    if (t === 'umbrales_velocidad') prepararUmbral(f, null);
    if (t === 'video_autoevaluacion') {
      if (tabla(t).some((x) => x.archivo_id === f.archivo_id)) throw new Error('duplicate key value violates unique constraint "video_autoevaluacion_pkey"');
      prepararAutoevaluacion(f, null);
    }
    if (t === 'umbrales_velocidad' && tabla(t).some((x) => x.ejercicio_id === f.ejercicio_id)) throw new Error('duplicate key value violates unique constraint "umbrales_velocidad_pkey"');
    if (t === 'tecnica_plantillas') {
      if (tabla(t).some((x) => x.ejercicio_id === f.ejercicio_id)) throw new Error('duplicate key value violates unique constraint "tecnica_plantillas_pkey"');
      f.puntos = (f.puntos || []).map((x) => String(x).trim()); f.actualizado_en = ahora();
    }
    if (t === 'archivos') {
      f.subido_por = esCoach() ? 'coach' : 'atleta';
      // Como la 034: una ruta que espera a borrarse de Storage no se vuelve a registrar
      if (tabla('storage_por_borrar').some((x) => x.ruta === f.ruta || (f.poster_ruta && x.ruta === f.poster_ruta))) throw new Error('Esa ruta ya se usó para un archivo eliminado: no se puede volver a registrar');
    }
    if (!esCoach()) {
      if (t === 'checkins') f.revisado_en = null;
      if (t === 'archivos') {
        // (como archivo_proteger, 003: cuándo llegó lo pone la base; la limpieza de la 035 cuenta desde ahí)
        f.revisado_en = null; f.comentario_coach = null; f.creado_en = ahora();
        // Como la 034: las notas de voz, 60 al día (aparte)
        if (f.tipo === 'audio' && tabla('archivos').filter((a) => a.atleta_id === f.atleta_id && a.tipo === 'audio' && Date.parse(a.creado_en) > Date.now() - 864e5).length >= 60) {
          throw new Error('Has enviado 60 notas de voz en las últimas 24 horas: espera un poco');
        }
        // Como la 033: como mucho 10 documentos al día (el atleta)
        if (f.tipo === 'documento' && tabla('archivos').filter((a) => a.atleta_id === f.atleta_id && a.tipo === 'documento' && Date.parse(a.creado_en) > Date.now() - 864e5).length >= 10) {
          throw new Error('Has enviado 10 documentos en las últimas 24 horas: espera un poco');
        }
      }
    }
    if (t === 'registros_habito') prepararRegistroHabito(f);
    if (t === 'registros_nutricion') prepararRegistroNutricion(f);
    if (t === 'sesiones') comprobarDiaPrevisto(f);
    if (t === 'cuestionarios') prepararCuestionario(f, null);
    if (t === 'checkins') validarRespuestas(f, null);
    // Como la 022: el menú es dato de salud (con su consentimiento, lo escriba quien lo escriba) y el atleta solo
    // apunta recetas de su recetario (o texto libre)
    if (t === 'menu_comidas') comprobarMenu(f, null);
    // Como la 023: un día sin la comida opcional es dato de salud (con consentimiento) y va una vez por día
    if (t === 'menu_dias') {
      if (!consentimientoDe(f.atleta_id)) throw new Error('Para organizar el menú hace falta el consentimiento de datos de salud del atleta');
      if (tabla('menu_dias').some((x) => x.atleta_id === f.atleta_id && x.fecha === f.fecha)) throw new Error('duplicate key value violates unique constraint "menu_dias_pkey"');
    }
    // Como la 023: una receta, una vez por comida y tipo de día en cada recetario
    if (t === 'recetas_atleta' && tabla('recetas_atleta').some((x) => x.atleta_id === f.atleta_id && x.receta_id === f.receta_id && x.toma === f.toma && (x.variante || null) === (f.variante || null))) {
      throw new Error('duplicate key value violates unique constraint "recetas_atleta_unica"');
    }
    // Como la 023: cuál es la comida opcional lo decide el coach
    if (t === 'comidas_atleta') { if (!esCoach()) f.opcional = null; normalizarOpcional(f); }
  }
  // Como la 030: un aviso con hora de salida empieza ese día (en Madrid); uno para «ya mismo» sale ya
  function prepararAviso(f, antes) {
    if (f.enviar_en != null && (!antes || f.enviar_en !== antes.enviar_en)) {
      if (Date.parse(f.enviar_en) > Date.now() + 90 * 864e5) throw new Error('Un aviso se programa como mucho a 90 días vista');
      if (!(Date.parse(f.enviar_en) > Date.now() + 30000)) f.enviar_en = null;
    }
    // Uno que ya ha salido no se vuelve a esconder programándolo
    if (antes && f.enviar_en != null && f.enviar_en !== antes.enviar_en
        && ((antes.enviar_en && Date.parse(antes.enviar_en) <= Date.now()) || (!antes.enviar_en && antes.desde <= fMadrid()))) {
      throw new Error('Este aviso ya ha salido: no se puede volver a programar (publica uno nuevo)');
    }
    if (f.enviar_en) f.desde = fMadrid(new Date(f.enviar_en));
  }
  // Como la 030: el día de la baja lo pone la base al pasar a «baja» y se quita al volver
  function fechaBaja(f, antes) {
    if (f.estado !== 'baja') f.baja_en = null;
    else if (!antes || antes.estado !== 'baja') f.baja_en = f.baja_en || fMadrid();
    // (como la 042: darse de baja termina sus parejas de racha)
    if (antes?.perfil_id && f.estado === 'baja' && antes.estado !== 'baja') db.comunidad_companeros = tabla('comunidad_companeros').filter((c) => c.de !== antes.perfil_id && c.para !== antes.perfil_id);
    if (f.baja_en && (f.baja_en < '2020-01-01' || f.baja_en > fMadrid())) throw new Error('El día de la baja, entre 2020 y hoy');
  }
  // Como la 030 (comentario_preparar): de un mensaje programado que aún no ha salido, el coach cambia el texto y la
  // hora (o lo manda ya); lo demás no se edita
  // v0.54 (032): además, editar lo propio (solo el texto, de un mensaje sin foto ni vídeo y en sus 15 minutos; la hora
  // de la edición la pone la base); «editado», «eliminado» y la cita no se tocan (eliminar va por comentario_eliminar)
  // Como la 033: el id del móvil, «Reenviado» y «entregado» no se cambian después
  // (038) y la respuesta en vídeo de un mensaje
  const FIJOS_033 = ['cliente_id', 'reenviado', 'entregado_en', 'escuchado_en', 'video_respuesta_id'];
  function prepararComentario(m, antes) {
    const yo = esCoach() ? 'coach' : 'atleta';
    // Como la 039: la marca del resumen de una sesión no se pone ni se quita después
    if ((m.resumen_sesion ?? false) !== (antes.resumen_sesion ?? false)) throw new Error('Un mensaje no pasa a ser (ni deja de ser) el resumen de una sesión');
    const igual = (k) => (m[k] ?? null) === (antes[k] ?? null);
    if (esCoach() && antes.autor === 'coach' && antes.enviar_en && Date.parse(antes.enviar_en) > Date.now()) {
      if (!['responde_a', 'editado_en', 'eliminado_en', 'archivo_id', 'atleta_id', 'sesion_id', 'checkin_id', 'autor', 'dibujo', 'adjunto', ...FIJOS_033].every(igual)) throw new Error('De un mensaje programado solo se cambian el texto y la hora');
      if (m.enviar_en != null && Date.parse(m.enviar_en) > Date.now() + 90 * 864e5) throw new Error('Un mensaje se programa como mucho a 90 días vista');
      if (m.enviar_en != null && !(Date.parse(m.enviar_en) > Date.now() + 30000)) m.enviar_en = null;
      m.creado_en = m.enviar_en ? new Date(Date.parse(m.enviar_en)).toISOString() : ahora();
      m.leido_en = null;
      return;
    }
    if (m.texto !== antes.texto) {
      if (antes.autor !== yo) throw new Error('Solo quien escribió un mensaje puede editarlo');
      if (deBajaYo()) throw new Error('Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada');
      if (antes.eliminado_en) throw new Error('Ese mensaje se eliminó: ya no se puede editar');
      if (antes.archivo_id || antes.dibujo || tabla('encuestas_chat').some((e) => e.comentario_id === antes.id)) throw new Error('Solo se editan los mensajes de texto');
      if (Date.parse(antes.creado_en) < Date.now() - 15 * 60000) throw new Error('Un mensaje se edita en los 15 minutos siguientes a enviarlo');
      if (!['atleta_id', 'sesion_id', 'checkin_id', 'archivo_id', 'autor', 'creado_en', 'dibujo', 'adjunto', 'enviar_en', 'responde_a', 'eliminado_en', 'leido_en', ...FIJOS_033].every(igual)) throw new Error('De un mensaje solo se cambia el texto');
      if (!textoVisible(String(m.texto || ''))) throw new Error('Escribe el mensaje');
      gastarCupoChat('edicion');
      m.editado_en = ahora();
      return;
    }
    if (!['enviar_en', 'responde_a', 'editado_en', 'eliminado_en', 'atleta_id', 'sesion_id', 'checkin_id', 'autor', 'archivo_id', 'creado_en', 'dibujo', 'adjunto', ...FIJOS_033].every(igual)) throw new Error('Un comentario no se puede editar');
    if (antes.autor === yo && !igual('leido_en')) throw new Error('Solo quien recibe un comentario lo marca como leído');
    // «Leído» lo fecha la base, una vez y para siempre; sin «Mostrar cuándo estoy en línea», solo el día
    if (!igual('leido_en')) {
      if (m.leido_en == null) throw new Error('Un mensaje leído no vuelve a «no leído»');
      m.leido_en = antes.leido_en || (presenciaMiaVisible() ? ahora() : new Date(Date.parse(instanteMadrid(fMadrid(), '00:00'))).toISOString());
      // Como la 033: leído es también entregado
      m.entregado_en = antes.entregado_en || (Date.parse(m.leido_en) < Date.parse(antes.creado_en) ? antes.creado_en : m.leido_en);
    }
  }
  function despuesDeInsertar(t, f) {
    // Como la 032: un mensaje nuevo del atleta saca su conversación de archivadas
    if (t === 'comentarios' && f.autor === 'atleta') for (const e of tabla('conversacion_estado')) if (e.atleta_id === f.atleta_id) e.archivada_en = null;
    if (t === 'comentarios' && f.autor === 'coach') {
      const [tb, col, id] = f.sesion_id ? ['sesiones', 'revisada_en', f.sesion_id] : f.checkin_id ? ['checkins', 'revisado_en', f.checkin_id] : f.archivo_id ? ['archivos', 'revisado_en', f.archivo_id] : [];
      const fila = tb && buscar(tb, id);
      if (fila && !fila[col]) fila[col] = ahora();
    }
  }
  function antesDeActualizar(t, cambios) {
    const c = { ...cambios };
    if (t !== 'comentarios') comprobarAlta(t);
    if (t === 'archivos' && 'subido_por' in c) throw new Error('No se cambia quién subió un archivo');
    if (t === 'archivos' && 'derivado_de' in c) throw new Error('No se cambia de qué vídeo sale un fotograma');
    if (t === 'notas_ejercicio') c.actualizado_en = ahora();
    if (t === 'recetas') { c.actualizada_en = ahora(); delete c.creada_en; }
    if (t === 'comidas_atleta' && !esCoach()) delete c.opcional;
    // Como la 022: de su recetario, el atleta solo cambia la favorita y la petición de cambio (la fecha la pone la base)
    if (t === 'recetas_atleta' && !esCoach()) {
      if (Object.keys(c).some((k) => !['favorita', 'cambio_pedido_en', 'cambio_nota'].includes(k))) throw new Error('Solo el coach puede cambiar tu recetario: pídele el cambio');
      if ('cambio_pedido_en' in c) c.cambio_pedido_en = c.cambio_pedido_en ? ahora() : null; // por fila, ver update
    }
    if (t === 'recetas_atleta' && 'cambio_pedido_en' in c && c.cambio_pedido_en == null) c.cambio_nota = null;
    if (t === 'perfiles' && c.exige_2fa === false && miPerfil()?.exige_2fa && sesion?.aal !== 'aal2') {
      throw new Error('Para desactivar la verificación en dos pasos tienes que haber entrado con ella');
    }
    // Como la 029 (proteger_sesion): el atleta no fecha una sesión después de mañana (en Madrid)
    if (t === 'sesiones' && !esCoach() && c.fecha_realizada && c.fecha_realizada > sumar(fechaMadrid(), 1)) {
      throw new Error('La fecha de la sesión no puede ser posterior a hoy: elige el día en que la hiciste');
    }
    if (!esCoach()) {
      // Como la migración 008: planificar el día no deja la sesión pendiente de revisar
      if (t === 'sesiones') { if (Object.keys(c).some((k) => k !== 'dia_previsto' && k !== 'revisada_en')) c.revisada_en = null; else delete c.revisada_en; }
      if (t === 'checkins') c.revisado_en = null;
      // Como la migración 014: de un archivo, el atleta solo cambia el pie, el ejercicio y si está destacado
      // (y puede quitar la miniatura si no llegó a subirse: poster_ruta a null)
      // (como la 038: y su otro ángulo, que mira su propio disparador; el ritmo de grabación, nadie)
      if (t === 'archivos' && Object.keys(c).some((k) => !['nota_atleta', 'ejercicio_id', 'destacado', 'angulo_de'].includes(k) && !(k === 'poster_ruta' && c[k] == null))) {
        throw new Error('De un archivo solo puedes cambiar el pie, el ejercicio y si está destacado');
      }
    }
    return c;
  }

  // Como la migración 008: el registro va al atleta del hábito; sí/no solo 0 o 1; ni días futuros ni hábitos archivados
  function prepararRegistroHabito(f) {
    const h = buscar('habitos', f.habito_id);
    if (!h) throw new Error('No puedes apuntar en ese hábito');
    f.atleta_id = h.atleta_id;
    f.actualizado_en = ahora();
    const v = Number(f.valor);
    if (!Number.isFinite(v) || v < 0 || v >= 1e6) throw new Error('Algún valor está fuera de rango.');
    if (h.tipo === 'si_no' && v !== 0 && v !== 1) throw new Error('Un hábito de sí o no se apunta con 1 (hecho) o 0 (no)');
    f.valor = Math.round(v * 100) / 100; // numeric(9,2), como en la base
    // Datos de salud: con el consentimiento del atleta, los escriba quien los escriba (también el coach)
    const atleta = buscar('atletas', h.atleta_id);
    if (!tabla('consentimientos').some((x) => atleta && x.perfil_id === atleta.perfil_id && x.tipo === 'datos_salud' && !x.revocado_en)) {
      throw new Error(esCoach() ? 'Para apuntar hábitos hace falta el consentimiento de datos de salud del atleta' : 'Para apuntar tus hábitos hace falta el consentimiento de datos de salud');
    }
    if (!esCoach()) {
      if (!h.activo) throw new Error('Ese hábito ya no está activo');
      if (f.fecha > sumar(hoyISO(), 1)) throw new Error('No se puede apuntar un día que aún no ha llegado');
    }
  }
  // Como la migración 008: un hábito no cambia de atleta, ni de tipo si ya tiene días apuntados
  function protegerHabito(fila, c) {
    if ('atleta_id' in c && c.atleta_id !== fila.atleta_id) throw new Error('Un hábito no se puede pasar a otro atleta: créale uno nuevo');
    if ('tipo' in c && c.tipo !== fila.tipo && tabla('registros_habito').some((r) => r.habito_id === fila.id)) {
      throw new Error('Este hábito ya tiene días apuntados: para apuntarlo de otra forma, quítalo y crea otro');
    }
  }
  // Como la migración 009: datos de salud con el consentimiento del atleta (lo escriba quien lo escriba),
  // y el atleta nada en días que no han llegado
  function prepararRegistroNutricion(f) {
    f.actualizado_en = ahora();
    const atleta = buscar('atletas', f.atleta_id);
    if (!tabla('consentimientos').some((x) => atleta && x.perfil_id === atleta.perfil_id && x.tipo === 'datos_salud' && !x.revocado_en)) {
      throw new Error('Para apuntar la nutrición hace falta el consentimiento de datos de salud del atleta');
    }
    if (!esCoach() && f.fecha > sumar(hoyISO(), 1)) throw new Error('No se puede apuntar un día que aún no ha llegado');
  }
  function normalizarOpcional(f) {
    if (f.opcional && !(Array.isArray(f.tomas) && f.tomas.includes(f.opcional) && f.tomas.length >= 2)) f.opcional = null;
  }
  function comprobarMenu(nueva, antes) {
    if (!consentimientoDe(nueva.atleta_id)) throw new Error('Para organizar el menú hace falta el consentimiento de datos de salud del atleta');
    if (nueva.receta_id && !esCoach() && (!antes || nueva.receta_id !== antes.receta_id)
      && !tabla('recetas_atleta').some((a) => a.atleta_id === nueva.atleta_id && a.receta_id === nueva.receta_id)) throw new Error('Esa receta no está en tu recetario');
  }
  const consentimientoDe = (atletaId) => {
    const atleta = buscar('atletas', atletaId);
    return tabla('consentimientos').some((x) => atleta && x.perfil_id === atleta.perfil_id && x.tipo === 'datos_salud' && !x.revocado_en);
  };
  // Como la migración 011: un valor de salud nuevo pide el consentimiento (dejarlo igual o borrarlo, no); la
  // recomendación la pone la base; la revisión y la petición, solo el coach y con la hora de la base; si cambia
  // lo de salud, vuelve a estar por revisar; la fecha de completado, la de ahora (y no la cambia el coach)
  const SALUD_CUESTIONARIO = ['activo', 'enfermedad', 'enfermedad_detalle', 'sintomas', 'otras', 'medicacion_detalle', 'lesiones', 'alergias'];
  // Como la migración 016: «objetivos» y «objetivo» (el principal) siempre de acuerdo
  function armonizarObjetivos(nueva, antes) {
    const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    if (Array.isArray(nueva.objetivos) && !nueva.objetivos.length) nueva.objetivos = null;
    if (!antes || !igual(nueva.objetivos, antes.objetivos)) {
      if (nueva.objetivos != null) { nueva.objetivos = [...new Set(nueva.objetivos)]; nueva.objetivo = nueva.objetivos[0]; }
      else if (antes && nueva.objetivo === antes.objetivo) nueva.objetivo = null;
      else nueva.objetivos = nueva.objetivo == null ? null : [nueva.objetivo];
    } else if (nueva.objetivo !== antes.objetivo) {
      const previos = antes.objetivos || [];
      nueva.objetivos = nueva.objetivo == null ? null
        : previos.includes(nueva.objetivo) ? [nueva.objetivo, ...previos.filter((o) => o !== nueva.objetivo)] : [nueva.objetivo, ...previos.slice(1)];
    }
  }
  function prepararCuestionario(nueva, antes) {
    if (antes && nueva.atleta_id !== antes.atleta_id) throw new Error('Un cuestionario no se puede pasar a otro atleta');
    armonizarObjetivos(nueva, antes);
    const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    const pide = SALUD_CUESTIONARIO.some((k) => nueva[k] != null && !igual(nueva[k], antes?.[k]));
    if (pide && !consentimientoDe(nueva.atleta_id)) throw new Error('Para responder lo de salud hace falta el consentimiento de datos de salud del atleta');
    const cambia = !!antes && SALUD_CUESTIONARIO.some((k) => !igual(nueva[k], antes[k]));
    nueva.resultado = resultadoCribado(nueva);
    const coach = esCoach();
    if (!coach) { nueva.revisado_en = antes?.revisado_en ?? null; nueva.pedido_en = antes?.pedido_en ?? null; }
    if (coach) {
      if (nueva.pedido_en && nueva.pedido_en !== antes?.pedido_en) nueva.pedido_en = ahora();
      if (nueva.revisado_en && nueva.revisado_en !== antes?.revisado_en) nueva.revisado_en = ahora();
    }
    if (cambia) nueva.revisado_en = null;
    if (nueva.completado_en && (!antes || nueva.completado_en !== antes.completado_en)) nueva.completado_en = ahora();
    if (coach && antes && nueva.completado_en !== antes.completado_en) nueva.completado_en = antes.completado_en;
    nueva.actualizado_en = ahora();
  }
  // Como la migración 011: cada respuesta, de una pregunta de ese atleta (o para todos) y con su forma; las que
  // ya estaban y no cambian se dejan
  function validarRespuestas(nueva, antes) {
    const r = nueva.respuestas;
    if (r == null) return;
    if (typeof r !== 'object' || Array.isArray(r) || Object.keys(r).length > 100) throw new Error('Respuestas del check-in no válidas');
    // Lo que ya estaba: el check-in de esa semana (en un alta que en realidad es un upsert, también)
    const previas = (antes || tabla('checkins').find((x) => x.atleta_id === nueva.atleta_id && x.semana_inicio === nueva.semana_inicio))?.respuestas;
    for (const [k, v] of Object.entries(r)) {
      if (previas && k in previas && JSON.stringify(previas[k]) === JSON.stringify(v)) continue;
      const p = tabla('preguntas_checkin').find((q) => q.id === k && (q.atleta_id === nueva.atleta_id || q.atleta_id == null));
      if (!p) throw new Error('Una de las respuestas no es de una pregunta de tu check-in');
      if (!respuestaValida(p, v)) throw new Error(`La respuesta a «${p.texto.slice(0, 60)}» no tiene la forma que toca`);
    }
  }
  // Como la migración 011: con respuestas, una pregunta no se borra (se archiva) ni cambia de tipo o de atleta
  const conRespuestas = (id) => tabla('checkins').some((x) => x.respuestas && id in x.respuestas);
  function protegerPregunta(fila, c) {
    const cambia = ('tipo' in c && c.tipo !== fila.tipo) || ('atleta_id' in c && (c.atleta_id ?? null) !== (fila.atleta_id ?? null));
    if (cambia && conRespuestas(fila.id)) {
      throw new Error('Esta pregunta ya tiene respuestas: para cambiarle el tipo o a quién va, archívala y crea otra');
    }
  }

  // El día previsto, dentro de la semana de la sesión
  function comprobarDiaPrevisto(f) {
    if (!f.dia_previsto) return;
    const w = buscar('semanas', f.semana_id);
    if (!w?.fecha_inicio || f.dia_previsto < w.fecha_inicio || f.dia_previsto > sumar(w.fecha_inicio, 6)) {
      throw new Error('El día previsto tiene que estar dentro de la semana de la sesión');
    }
  }

  // Como la migración 005: forma exacta y consentimiento de salud del atleta dueño de la sesión
  // (si cambia el valor; vaciarla se puede siempre)
  function comprobarPreparacion(fila, p) {
    if (p == null) return;
    const ok = typeof p === 'object' && !Array.isArray(p) && Object.keys(p).length === 3
      && ['sueno', 'energia', 'molestias'].every((k) => [1, 2, 3].includes(p[k]));
    if (!ok) throw new Error('new row for relation "sesiones" violates check constraint "sesiones_preparacion_valida"');
    if (JSON.stringify(p) === JSON.stringify(fila.preparacion ?? null)) return;
    const atleta = buscar('atletas', atletaDeSesion(fila.id));
    if (!tabla('consentimientos').some((x) => atleta && x.perfil_id === atleta.perfil_id && x.tipo === 'datos_salud' && !x.revocado_en)) {
      throw new Error('Para guardar cómo llega a la sesión hace falta el consentimiento de datos de salud del atleta');
    }
  }

  // Las restricciones CHECK de la base que la app puede tocar desde la interfaz (para que la demo rechace lo mismo)
  const n = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
  const entre = (v, a, b) => v === null || (Number.isFinite(v) && v >= a && v <= b);
  const entero = (v) => v === null || Number.isInteger(v);
  // Como numeric(…,1) y las fechas de las restricciones de la base (de 2020 a 2099)
  const unDecimal = (v) => n(v) === null || Math.round(n(v) * 10) / 10 === n(v);
  const fechaValida = (f) => typeof f === 'string' && f >= '2020-01-01' && f < '2100-01-01';
  const FOCOS_BLOQUE = ['tecnica', 'volumen', 'intensidad', 'adaptacion', 'descarga', 'mixto'];
  const FOCOS_SEMANA = ['tecnica', 'volumen', 'intensidad', 'adaptacion', 'descarga', 'evaluacion', 'peaking'];
  const esFecha = (f) => typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f);
  const textoCorto = (v, max) => v == null || (String(v).length >= 1 && String(v).length <= max && textoVisible(v));
  const TOMAS = ['desayuno', 'media_manana', 'comida', 'merienda', 'cena', 'recena'];
  // Como public.comunidad_encuesta_valida (029): de 2 a 4 opciones distintas, de 1 a 80 letras, y el cierre
  const encuestaValida = (e) => !!e && typeof e === 'object' && !Array.isArray(e) && Object.keys(e).every((k) => ['opciones', 'cierre'].includes(k))
    && Array.isArray(e.opciones) && e.opciones.length >= 2 && e.opciones.length <= 4 && e.opciones.every((o) => typeof o === 'string' && textoCorto(o, 80) && o != null)
    && new Set(e.opciones.map((o) => o.trim().toLowerCase())).size === e.opciones.length && (e.cierre == null || typeof e.cierre === 'string');
  // Como public.comunidad_equipos_validos (042): dos nombres distintos, de 1 a 30 letras, sin espacios sobrantes
  const equiposValidos = (e) => Array.isArray(e) && e.length === 2 && e.every((t) => typeof t === 'string' && t.length >= 1 && t.length <= 30 && t === t.trim() && textoVisible(t))
    && e[0].trim().toLowerCase() !== e[1].trim().toLowerCase();
  // Como public.comunidad_fotos_validas (043): de 2 a 4, sin repetir, con la ruta de siempre y la primera es foto_ruta
  const fotosValidas = (fotos, primera) => fotos == null || (Array.isArray(fotos) && fotos.length >= 2 && fotos.length <= 4 && fotos[0] === primera && new Set(fotos).size === fotos.length
    && fotos.every((x) => typeof x === 'string' && /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|coach)\/[A-Za-z0-9]{8,40}\.jpg$/.test(x)));
  const FOTO_OK = (v, max) => v == null || (String(v).length <= max && /^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(String(v)));
  // Como tareas_validas (030)
  const tareaValida = (f) => ['foto', 'medida', 'video', 'texto'].includes(f.tipo) && textoCorto(f.titulo, 120) && f.titulo != null && textoCorto(f.detalle, 600)
    && (f.ejercicio_id == null || f.tipo === 'video');
  const CHECKS = {
    tareas: (f) => tareaValida(f) && fechaValida(f.fecha) && textoCorto(f.respuesta, 500) && (f.hecha_en != null || (f.respuesta == null && f.archivo_id == null && f.revisada_en == null)),
    tareas_plantillas: (f) => tareaValida(f) && entre(n(f.orden), 0, 999),
    // Migración 027: la comunidad
    // (029: logros, encuestas y menciones)
    comunidad_posts: (f) => ['aviso', 'post', 'entreno', 'logro', 'encuesta', 'momento', 'aniversario'].includes(f.tipo) && textoCorto(f.texto, 2000) && (!['aviso', 'encuesta'].includes(f.tipo) || f.texto != null)
      && (f.tipo !== 'encuesta' || String(f.texto).length <= 300)
      && (f.tipo !== 'post' || f.texto != null || f.foto_ruta != null) && ['entreno', 'logro', 'aniversario'].includes(f.tipo) === (f.resumen != null) && (!f.fijada || ['aviso', 'encuesta'].includes(f.tipo))
      && (f.tipo === 'logro' || f.reto_id == null) && (['post', 'aviso', 'momento'].includes(f.tipo) || f.foto_ruta == null)
      // (045: un momento, con su foto y hasta 140; un aniversario, sin texto ni foto)
      && (f.tipo !== 'momento' || (f.foto_ruta != null && f.fotos == null && (f.texto == null || String(f.texto).length <= 140) && f.publicar_en == null && !(f.menciones || []).length && f.tema == null))
      && (f.tipo !== 'aniversario' || (f.texto == null && f.foto_ruta == null && typeof f.resumen?.meses === 'number'))
      && (f.tipo === 'encuesta') === (f.encuesta != null) && (f.encuesta == null || encuestaValida(f.encuesta)) && Array.isArray(f.menciones) && f.menciones.length <= 5
      // (043: el tema y las fotos, como comunidad_posts_043_validos)
      && (f.tema == null || TEMAS.some(([k]) => k === f.tema)) && (f.tema !== 'pregunta' || f.tipo === 'post') && (f.tema !== 'avisos' || ['aviso', 'encuesta'].includes(f.tipo))
      && (f.fotos == null || ['post', 'aviso'].includes(f.tipo)) && fotosValidas(f.fotos, f.foto_ruta)
      && (f.publicar_en == null || ['aviso', 'encuesta'].includes(f.tipo)) && !(f.retenida && ['aviso', 'encuesta'].includes(f.tipo)),
    // (044) eventos, plantillas, el atleta de la semana y lo programado
    comunidad_eventos: (f) => !eventoValido(f) && f.empieza_en != null,
    comunidad_plantillas: (f) => f.texto != null && textoCorto(f.texto, 2000),
    comunidad_preguntas: (f) => f.pregunta != null && textoCorto(f.pregunta, 2000) && f.respuesta != null && textoCorto(f.respuesta, 2000),
    comunidad_comentarios: (f) => f.texto != null && textoCorto(f.texto, 1000) && Array.isArray(f.menciones) && f.menciones.length <= 5 && (f.pegatina == null || pegatinaValida(f.pegatina)),
    comunidad_retos: (f) => textoCorto(f.titulo, 80) && f.titulo != null && textoCorto(f.descripcion, 500) && esFecha(f.desde) && esFecha(f.hasta) && f.hasta >= f.desde
      && diasEntreIso(f.desde, f.hasta) <= 366 && ['individual', 'equipo', 'equipos'].includes(f.modo ?? 'individual') && ['sesiones', 'cardio', 'semanas'].includes(f.medida ?? 'sesiones')
      && Number.isInteger(n(f.objetivo)) && entre(n(f.objetivo), 1, retoMaximo(f.modo ?? 'individual', f.medida ?? 'sesiones'))
      // (042: por equipos, con los nombres de los dos)
      && ((f.modo === 'equipos') === (f.equipos != null)) && (f.equipos == null || equiposValidos(f.equipos)),
    // Migración 022: recetas, recetario, comidas del día y menú
    recetas: (f) => textoCorto(f.nombre, 80) && f.nombre != null && Array.isArray(f.tomas) && f.tomas.length <= 6 && f.tomas.every((t) => TOMAS.includes(t))
      && Number.isInteger(n(f.raciones)) && entre(n(f.raciones), 1, 20) && entre(n(f.kcal), 0, 5000) && entre(n(f.proteina_g), 0, 500) && entre(n(f.carbos_g), 0, 800) && entre(n(f.grasa_g), 0, 400)
      && Array.isArray(f.ingredientes) && f.ingredientes.length <= 40 && f.ingredientes.every((i) => i && typeof i === 'object' && Object.keys(i).every((k) => ['nombre', 'cantidad', 'unidad'].includes(k)) && textoCorto(i.nombre, 80) && i.nombre != null
        && (i.cantidad == null || (typeof i.cantidad === 'number' && i.cantidad > 0 && i.cantidad <= 100000)) && (i.unidad == null || textoCorto(i.unidad, 16)))
      && textoCorto(f.preparacion, 4000) && (f.minutos == null || entre(n(f.minutos), 0, 600)) && Array.isArray(f.etiquetas) && f.etiquetas.length <= 8 && f.etiquetas.every((e) => textoCorto(e, 24) && e != null)
      && FOTO_OK(f.foto, 250000) && FOTO_OK(f.foto_mini, 40000),
    recetas_atleta: (f) => (f.variante == null || ['con', 'sin'].includes(f.variante)) && TOMAS.includes(f.toma) && entre(Number(f.factor), 0.25, 5) && entre(n(f.orden), 0, 999) && textoCorto(f.nota, 300) && (f.cambio_nota == null || (f.cambio_pedido_en != null && textoCorto(f.cambio_nota, 300))),
    comidas_atleta: (f) => Array.isArray(f.tomas) && f.tomas.length >= 1 && f.tomas.length <= 6 && f.tomas.every((t) => TOMAS.includes(t)) && new Set(f.tomas).size === f.tomas.length,
    menu_comidas: (f) => fechaValida(f.fecha) && TOMAS.includes(f.toma) && textoCorto(f.texto, 120) && f.texto != null && entre(Number(f.raciones), 0.25, 10)
      && entre(n(f.kcal), 0, 15000) && entre(n(f.proteina_g), 0, 1500) && entre(n(f.carbos_g), 0, 2500) && entre(n(f.grasa_g), 0, 1000) && entre(n(f.orden), 0, 99),
    // Migración 020: cobros
    cobros_atletas: (f) => ['mensual', 'trimestral', 'semestral', 'anual'].includes(f.ciclo) && (f.precio_mes == null || entre(Number(f.precio_mes), 0, 10000))
      && textoCorto(f.servicio, 60) && textoCorto(f.nota, 500),
    pagos: (f) => esFecha(f.periodo_desde) && esFecha(f.periodo_hasta) && f.periodo_hasta >= f.periodo_desde && diasEntreIso(f.periodo_desde, f.periodo_hasta) <= 400
      && entre(Number(f.importe), 0, 100000) && ['pendiente', 'retrasado', 'pagado'].includes(f.estado)
      && (f.metodo == null || ['transferencia', 'efectivo', 'bizum', 'tarjeta', 'otro'].includes(f.metodo))
      && (f.fecha_pago == null || (f.estado === 'pagado' && esFecha(f.fecha_pago))) && textoCorto(f.nota, 300),
    // Como la migración 015: la foto de perfil, una imagen pequeña en base64
    perfiles: (f) => f.foto == null || (String(f.foto).length <= 80000 && /^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(String(f.foto))),
    sesion_ejercicios: (f) => {
      const series = n(f.series), rmin = n(f.reps_min), rmax = n(f.reps_max);
      return series !== null && entero(series) && entre(series, 1, 20) && entero(rmin) && entre(rmin, 0, 1e6) && entero(rmax) && entre(rmax, 0, 1e6)
        && (rmin === null || rmax === null || rmin <= rmax) && entre(n(f.rir_objetivo), 0, 10) && entre(n(f.rpe_objetivo), 1, 10)
        && entre(n(f.carga_sugerida_kg), 0, 9999.99) && entero(n(f.descanso_seg)) && entre(n(f.descanso_seg), 0, 900)
        && (n(f.backoff_pct) === null || (n(f.backoff_pct) >= 1 && n(f.backoff_pct) <= 50 && series >= 2))
        // Como la migración 024: el detalle serie a serie, una por serie y sin top + back-off
        && (f.series_detalle == null || (Array.isArray(f.series_detalle) && f.series_detalle.length === series && n(f.backoff_pct) === null
          && f.series_detalle.every((x) => x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).every((k) => ['reps', 'kg', 'rpe'].includes(k))
            && (x.reps == null || (typeof x.reps === 'number' && Number.isInteger(x.reps) && x.reps >= 0 && x.reps <= 1000))
            && (x.kg == null || (typeof x.kg === 'number' && x.kg >= 0 && x.kg <= 9999.99))
            && (x.rpe == null || (typeof x.rpe === 'number' && x.rpe >= 1 && x.rpe <= 10)))));
    },
    series: (f) => entero(n(f.numero)) && n(f.numero) >= 1 && entre(n(f.kg), 0, 9999.99) && entero(n(f.reps)) && entre(n(f.reps), 0, 1e6)
      && entre(n(f.rpe), 1, 10) && entre(n(f.rir), 0, 10),
    // Como la migración 013: la pauta de cardio y lo hecho, con su forma exacta
    sesiones: (f) => (f.cardio == null || cardioValido(f.cardio)) && (f.cardio_hecho == null || cardioHechoValido(f.cardio_hecho)),
    // Como la migración 014: tipos, miniatura en su carpeta y duración
    archivos: (f) => (f.pose == null || (f.tipo === 'foto_progreso' && ['frente', 'perfil', 'espalda'].includes(f.pose)))
      && ['video_tecnica', 'foto_progreso', 'adjunto', 'documento', 'audio'].includes(f.tipo)
      // Como la 034: una nota de voz, audio de 1 a 61 segundos y hasta 3 MB, con su ruta audio-…; su onda, de 8 a 64 barras
      && (f.tipo !== 'audio' || (['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac'].includes(f.mime) && n(f.bytes) >= 1 && n(f.bytes) <= 3145728
        && entero(n(f.duracion_seg)) && entre(n(f.duracion_seg), 1, 61) && /\/audio-[A-Za-z0-9._-]+\.(webm|ogg|m4a|mp4|mp3|aac)$/.test(String(f.ruta)) && f.nombre == null && f.poster_ruta == null && f.paginas == null))
      && (f.onda == null || (f.tipo === 'audio' && Array.isArray(f.onda) && f.onda.length >= 8 && f.onda.length <= 64 && f.onda.every((x) => Number.isInteger(x) && x >= 0 && x <= 100)))
      // Como la 033: un documento es un PDF de hasta 20 MB, con su nombre (saneado) y una ruta .pdf
      && (f.tipo !== 'documento' || (f.mime === 'application/pdf' && n(f.bytes) >= 1 && n(f.bytes) <= 20971520 && /\.pdf$/.test(String(f.ruta)) && /\.pdf$/i.test(String(f.nombre ?? '')) && f.poster_ruta == null))
      // (sin barras, «..», caracteres de control ni invisibles, ni <>:"|?*, ni punto o espacio al principio)
      && (f.nombre == null || ([...String(f.nombre)].length >= 1 && [...String(f.nombre)].length <= 120 && !NOMBRE_PROHIBIDO.test(String(f.nombre)) && !String(f.nombre).includes('..') && !/^[.\s]/.test(String(f.nombre)) && textoVisible(String(f.nombre))))
      && (f.paginas == null || (entero(n(f.paginas)) && entre(n(f.paginas), 1, 5000)))
      && (f.poster_ruta == null || (new RegExp(`^${f.atleta_id}/[A-Za-z0-9_-][A-Za-z0-9._-]{0,150}$`).test(String(f.poster_ruta)) && !String(f.poster_ruta).includes('..') && f.poster_ruta !== f.ruta))
      && (f.duracion_seg == null || (entero(n(f.duracion_seg)) && entre(n(f.duracion_seg), 0, 3600)))
      // Como la 035: la serie (de 1 a 30) y la repetición, solo en un vídeo de técnica
      && (f.serie_numero == null || (f.tipo === 'video_tecnica' && entero(n(f.serie_numero)) && entre(n(f.serie_numero), 1, 30)))
      && (f.repite_de == null || (f.tipo === 'video_tecnica' && f.repite_de !== f.id))
      // Como la 038: el otro ángulo y el ritmo de grabación, solo en un vídeo de técnica
      && (f.angulo_de == null || (f.tipo === 'video_tecnica' && f.angulo_de !== f.id))
      && (f.fps_captura == null || (f.tipo === 'video_tecnica' && entero(n(f.fps_captura)) && entre(n(f.fps_captura), 24, 240))),
    video_revisiones: (f) => (f.puntuacion == null || (entero(n(f.puntuacion)) && entre(n(f.puntuacion), 1, 5)))
      && (f.checklist == null || checklistValido(f.checklist)) && (f.tempo == null || tempoValido(f.tempo))
      && (f.voz_inicio == null || (n(f.voz_inicio) >= 0 && n(f.voz_inicio) < 3600))
      // Como la 036: el análisis automático, con su forma exacta (analisis_valido)
      && (f.analisis == null || analisisValido(f.analisis))
      // Como la 037: las marcas de repetición a mano
      && (f.reps_manual == null || repsManualValidas(f.reps_manual))
      // Como la 038: el desfase de los dos ángulos
      && (f.dos_angulos == null || dosAngulosValido(f.dos_angulos)),
    tecnica_plantillas: (f) => plantillaValida(f.puntos),
    // Como la 037
    recordatorios_tecnica: (f) => recordatorioValido(f),
    frases_correccion: (f) => fraseValida(f),
    videos_modelo: (f) => new RegExp(`^modelos/${f.ejercicio_id}/modelo-[A-Za-z0-9_-]{6,40}\\.(mp4|mov|webm)$`).test(String(f.ruta)) && (f.poster_ruta == null || f.poster_ruta === `${f.ruta}.jpg`)
      && (f.duracion_seg == null || (entero(n(f.duracion_seg)) && entre(n(f.duracion_seg), 0, 600))) && (f.mime == null || ['video/mp4', 'video/quicktime', 'video/webm'].includes(f.mime))
      && (f.bytes == null || (entero(n(f.bytes)) && entre(n(f.bytes), 1, 209715200))) && (f.angulo == null || ([...String(f.angulo)].length >= 1 && [...String(f.angulo)].length <= 40 && textoVisible(f.angulo)))
      && entero(n(f.orden)) && entre(n(f.orden), 0, 99),
    video_autoevaluacion: (f) => autoevaluacionValida(f),
    // Como la 039: de 0,05 a 1 m/s con 3 decimales como mucho (umbral_velocidad_valido)
    umbrales_velocidad: (f) => umbralValido(f.vmin),
    // Como la 040: el lunes, un lunes; la nota, de 500 caracteres como mucho
    revisiones_semanales: (f) => /^\d{4}-\d{2}-\d{2}$/.test(String(f.lunes)) && new Date(`${f.lunes}T12:00:00Z`).getUTCDay() === 1 && (f.nota == null || [...String(f.nota)].length <= 500),
    semanas: (f) => f.foco == null || FOCOS_SEMANA.includes(f.foco),
    bloques: (f) => f.foco == null || FOCOS_BLOQUE.includes(f.foco),
    habitos: (f) => {
      const nombre = String(f.nombre ?? '');
      const visible = textoVisible(nombre);
      const base = nombre.length >= 1 && nombre.length <= 60 && visible && ['numero', 'si_no'].includes(f.tipo) && ['al_menos', 'como_mucho'].includes(f.sentido)
        && entero(n(f.dias_semana)) && entre(n(f.dias_semana), 1, 7) && ['pasos', 'proteina', 'agua', 'sueno', 'movilidad', 'verdura', 'libre'].includes(f.icono)
        && (f.unidad == null || (String(f.unidad).length >= 1 && String(f.unidad).length <= 12 && textoVisible(f.unidad)));
      if (!base) return false;
      return f.tipo === 'numero' ? n(f.objetivo) !== null && n(f.objetivo) > 0 && n(f.objetivo) < 1e6 : f.objetivo == null && f.unidad == null && f.sentido === 'al_menos';
    },
    // Como la migración 009
    avisos: (f) => String(f.texto ?? '').length >= 1 && String(f.texto).length <= 600 && textoVisible(f.texto),
    planes_nutricion: (f) => {
      const k = n(f.kcal), kd = n(f.kcal_descanso), r = n(f.ritmo_pct);
      const cifras = [f.kcal, f.kcal_descanso, f.proteina_g, f.carbos_g, f.grasa_g, f.carbos_descanso_g, f.grasa_descanso_g, f.fibra_g].map(n);
      const base = cifras.every(entero) && (r === null || Math.round(r * 100) / 100 === r) && fechaValida(f.desde)
        && ['macros', 'kcal_proteina', 'sin_contar'].includes(f.modo) && ['perder', 'mantener', 'ganar', 'recomposicion'].includes(f.fase)
        && !!f.desde && entre(r, -1.5, 1) && (f.fase !== 'perder' || r === null || r < 0) && (f.fase !== 'ganar' || r === null || r > 0)
        && entre(k, 800, 8000) && entre(kd, 800, 8000) && entre(n(f.proteina_g), 20, 600) && entre(n(f.carbos_g), 0, 1500) && entre(n(f.carbos_descanso_g), 0, 1500)
        && entre(n(f.grasa_g), 10, 500) && entre(n(f.grasa_descanso_g), 10, 500) && entre(n(f.fibra_g), 5, 150)
        && (f.pautas == null || (String(f.pautas).length <= 4000 && textoVisible(f.pautas))) && (f.motivo == null || (String(f.motivo).length <= 280 && textoVisible(f.motivo)))
        && (f.fase !== 'mantener' || r === null || r === 0);
      if (!base) return false;
      const p = n(f.proteina_g);
      const cuadra = (kcal, c, g) => Math.abs(kcal - (4 * p + 4 * c + 9 * g)) <= Math.max(50, kcal * 0.05);
      if (f.modo === 'macros') return k !== null && p !== null && n(f.carbos_g) !== null && n(f.grasa_g) !== null && (kd === null) === (n(f.carbos_descanso_g) === null) && (kd === null) === (n(f.grasa_descanso_g) === null)
        && cuadra(k, n(f.carbos_g), n(f.grasa_g)) && (kd === null || cuadra(kd, n(f.carbos_descanso_g), n(f.grasa_descanso_g)));
      if (f.modo === 'kcal_proteina') return k !== null && p !== null && k >= 4 * p && (kd === null || kd >= 4 * p) && [f.carbos_g, f.grasa_g, f.carbos_descanso_g, f.grasa_descanso_g].every((x) => n(x) === null);
      return [f.kcal, f.kcal_descanso, f.proteina_g, f.carbos_g, f.grasa_g, f.carbos_descanso_g, f.grasa_descanso_g, f.fibra_g].every((x) => n(x) === null);
    },
    // Como la migración 010
    preferencias_notificaciones: (f) => {
      const hora = (h) => /^\d\d:\d\d(:00)?$/.test(String(h ?? ''));
      const h5 = (h) => String(h).slice(0, 5);
      const tipos = ['respuesta', 'semana', 'aviso', 'sesion_hoy', 'checkin', 'habitos', 'nutricion', 'cuestionario', 'mensaje', 'checkin_recibido', 'video_recibido', 'sesion_hecha', 'cuestionario_recibido', 'descanso', 'comunidad', 'tarea', 'tarea_hecha'];
      return Array.isArray(f.desactivados) && f.desactivados.every((t) => tipos.includes(t))
        && hora(f.hora_manana) && h5(f.hora_manana) >= '05:00' && h5(f.hora_manana) <= '12:00'
        && hora(f.hora_tarde) && h5(f.hora_tarde) >= '12:00' && h5(f.hora_tarde) <= '23:30'
        && Number.isInteger(Number(f.dia_checkin)) && Number(f.dia_checkin) >= 1 && Number(f.dia_checkin) <= 7
        && (f.silencio_desde == null) === (f.silencio_hasta == null)
        && (f.silencio_desde == null || (hora(f.silencio_desde) && hora(f.silencio_hasta) && h5(f.silencio_desde) !== h5(f.silencio_hasta)));
    },
    // Como la migración 012: el dibujo, solo en comentarios de un vídeo y con su forma
    comentarios: (f) => f.dibujo == null || (f.archivo_id != null && dibujoValido(f.dibujo)),
    // Como la migración 011
    cuestionarios: (f) => {
      const en = (v, lista) => v == null || lista.includes(v);
      const todos = (v, lista) => v == null || (Array.isArray(v) && v.every((x) => lista.includes(x)));
      const txt = (v, max) => v == null || (String(v).length <= max && textoVisible(v));
      const ZONAS = ['cuello', 'hombro', 'codo', 'muneca_mano', 'espalda_alta', 'zona_lumbar', 'cadera', 'rodilla', 'tobillo_pie', 'otra'];
      const lesiones = f.lesiones == null || (Array.isArray(f.lesiones) && f.lesiones.length <= 10 && f.lesiones.every((l) => l && typeof l === 'object' && !Array.isArray(l)
        && Object.keys(l).every((k) => ['zona', 'limita', 'nota'].includes(k)) && ZONAS.includes(l.zona) && [0, 1, 2].includes(l.limita)
        && (l.nota == null || (typeof l.nota === 'string' && l.nota.length <= 200 && textoVisible(l.nota)))));
      const OBJ = ['fuerza', 'musculo', 'perder_grasa', 'salud', 'rendimiento', 'otro'];
      return en(f.objetivo, OBJ) && (f.objetivos == null || (Array.isArray(f.objetivos) && f.objetivos.length >= 1 && f.objetivos.length <= 6 && f.objetivos.every((o) => OBJ.includes(o)) && f.objetivo === f.objetivos[0])) && txt(f.objetivo_detalle, 600)
        && en(f.experiencia, ['ninguna', 'menos_1', '1_3', '3_5', 'mas_5']) && (f.dias_semana == null || (Number.isInteger(f.dias_semana) && f.dias_semana >= 1 && f.dias_semana <= 7))
        && (f.minutos_sesion == null || (Number.isInteger(f.minutos_sesion) && f.minutos_sesion >= 15 && f.minutos_sesion <= 240))
        && en(f.lugar, ['gimnasio', 'gimnasio_basico', 'casa', 'aire_libre']) && Array.isArray(f.material)
        && todos(f.material, ['barra', 'rack', 'banco', 'mancuernas', 'kettlebells', 'poleas', 'maquinas', 'gomas', 'dominadas', 'cardio'])
        && txt(f.otros_deportes, 200) && txt(f.enfermedad_detalle, 300) && txt(f.medicacion_detalle, 300) && txt(f.alergias, 300)
        && todos(f.sintomas, ['dolor_pecho', 'falta_aire', 'mareo', 'palpitaciones', 'tobillos', 'claudicacion', 'soplo', 'fatiga', 'ortopnea'])
        && todos(f.otras, ['embarazo', 'posparto', 'cirugia', 'medicacion', 'limitacion_medica']) && lesiones;
    },
    preguntas_checkin: (f) => {
      const txt = (v, max) => v == null || (String(v).length <= max && textoVisible(v));
      return typeof f.texto === 'string' && f.texto.length >= 1 && f.texto.length <= 160 && textoVisible(f.texto)
        && ['escala', 'numero', 'si_no', 'texto'].includes(f.tipo) && (f.unidad == null || (f.tipo === 'numero' && txt(f.unidad, 12)))
        && txt(f.ayuda, 200) && (f.etiqueta_min == null || (f.tipo === 'escala' && txt(f.etiqueta_min, 30)))
        && (f.etiqueta_max == null || (f.tipo === 'escala' && txt(f.etiqueta_max, 30))) && Number.isInteger(f.orden) && f.orden >= 0 && f.orden <= 99;
    },
    atletas: (f) => (f.checkin_apartados == null || (Array.isArray(f.checkin_apartados) && f.checkin_apartados.every((x) => ['peso', 'descanso', 'molestias', 'alimentacion', 'medidas', 'reloj'].includes(x))))
      && (f.nivel == null || ['novato', 'novato_intermedio', 'intermedio', 'avanzado'].includes(f.nivel)) && (f.nutricion === undefined || typeof f.nutricion === 'boolean')
      && (f.entrenamiento === undefined || typeof f.entrenamiento === 'boolean') && (f.entrenamiento !== false || f.nutricion !== false)
      // Como la 031: días de entreno por semana, null (automático) o de 1 a 7
      && (f.dias_semana == null || (Number.isInteger(f.dias_semana) && f.dias_semana >= 1 && f.dias_semana <= 7)),
    registros_nutricion: (f) => fechaValida(f.fecha) && unDecimal(f.proteina_g) && unDecimal(f.carbos_g) && unDecimal(f.grasa_g) && unDecimal(f.fibra_g)
      && entre(n(f.kcal), 0, 15000) && entero(n(f.kcal)) && entre(n(f.proteina_g), 0, 1500) && entre(n(f.carbos_g), 0, 2500) && entre(n(f.grasa_g), 0, 1000)
      && entre(n(f.fibra_g), 0, 300) && (f.cumplido == null || [0, 1, 2].includes(Number(f.cumplido))) && (f.nota == null || (String(f.nota).length <= 280 && textoVisible(f.nota)))
      && (n(f.kcal) !== null || n(f.proteina_g) !== null || f.cumplido != null),
  };
  function comprobarChecks(t, fila) {
    if (CHECKS[t] && !CHECKS[t](fila)) throw new Error('Algún valor está fuera de rango.');
  }

  // Como la migración 007: sin ejercicio no hay marca; con ejercicio, una marca razonable (hasta 12 repeticiones)
  function comprobarMarca(f) {
    if (f.ejercicio_id == null) { f.kg_objetivo = null; f.reps_objetivo = null; f.e1rm_inicio = null; return; }
    const kg = Number(f.kg_objetivo), reps = Number(f.reps_objetivo);
    if (f.kg_objetivo == null || f.reps_objetivo == null || !(kg >= 0.5 && kg <= 1000) || !(reps >= 1 && reps <= 12)) {
      throw new Error('new row for relation "objetivos" violates check constraint "objetivos_marca_valida"');
    }
  }

  const soloCoach = (t) => { if (['cobros_atletas', 'pagos', 'recetas', 'tareas', 'tareas_plantillas', 'conversacion_estado', 'conversacion_fijado', 'listas_difusion', 'listas_difusion_miembros', 'video_revisiones', 'tecnica_plantillas', 'recordatorios_tecnica', 'frases_correccion', 'videos_modelo', 'umbrales_velocidad', 'revisiones_semanales'].includes(t) && !esCoach()) throw new Error('new row violates row-level security policy'); };
  // Como la 035 (archivo_enlaces): la serie, de un ejercicio de una sesión de ese atleta; la repetición, de un vídeo suyo
  // (si el coach lo pasa a otro atleta, la serie y la repetición que no son de ese atleta se quitan)
  function comprobarEnlaces(f, antes = null) {
    const mueve = !!antes && f.atleta_id !== antes.atleta_id;
    if (f.sesion_ejercicio_id == null) f.serie_numero = null;
    if (f.serie_numero != null && (!antes || f.serie_numero !== antes.serie_numero || f.sesion_ejercicio_id !== antes.sesion_ejercicio_id || mueve)) {
      const se = buscar('sesion_ejercicios', f.sesion_ejercicio_id);
      if (!se || atletaDeSesion(se.sesion_id) !== f.atleta_id) {
        if (mueve && f.serie_numero === antes.serie_numero && f.sesion_ejercicio_id === antes.sesion_ejercicio_id) f.serie_numero = null;
        else throw new Error('Esa serie no es de este atleta');
      }
    }
    if (f.repite_de != null && (!antes || f.repite_de !== antes.repite_de || mueve)) {
      const o = buscar('archivos', f.repite_de);
      if (!o || o.atleta_id !== f.atleta_id || o.tipo !== 'video_tecnica' || o.id === f.id) {
        if (mueve && f.repite_de === antes.repite_de) f.repite_de = null;
        else throw new Error('Solo se repite un vídeo de técnica tuyo');
      }
    }
  }
  // Como la 038 (comentario_respuesta_video): una respuesta en vídeo, en el hilo de un vídeo de técnica; su vídeo, un
  // archivo del chat (mp4 o webm) de quien escribe y de ese atleta, recién subido, de 1 s al tope (3 min el coach, 1 el
  // atleta, con un segundo de margen), hasta 100 MB y en ningún otro mensaje. Y un vídeo de respuesta no va en otro mensaje.
  function comprobarRespuestaVideo(f) {
    if (f.archivo_id && tabla('comentarios').some((c) => c.video_respuesta_id === f.archivo_id && c.id !== f.id)) throw new Error('Ese vídeo es una respuesta en el hilo de un vídeo: no va en otro mensaje');
    if (f.video_respuesta_id == null) { f.video_respuesta_id = null; return; }
    const v = buscar('archivos', f.archivo_id);
    if (!v || v.tipo !== 'video_tecnica' || f.adjunto || f.sesion_id || f.checkin_id) throw new Error('Una respuesta en vídeo va en el hilo de un vídeo de técnica');
    const a = buscar('archivos', f.video_respuesta_id);
    const tope = f.autor === 'coach' ? 181 : 61;
    if (!a || a.tipo !== 'adjunto' || a.atleta_id !== f.atleta_id || subidoPor(a) !== f.autor || !['video/mp4', 'video/webm'].includes(a.mime)
      || !(Number(a.duracion_seg) >= 1 && Number(a.duracion_seg) <= tope) || !(Number(a.bytes) >= 1 && Number(a.bytes) <= 104857600)
      || Date.parse(a.creado_en) < Date.now() - 3600e3 || archivoConMensajes(a.id)
      // (como la 038: ya subido, y de 100 MB como mucho según Storage, no según la fila)
      || !(Number(ficheros.get(a.ruta)?.size) >= 1 && Number(ficheros.get(a.ruta)?.size) <= 104857600)) {
      throw new Error(`La respuesta tiene que ser un vídeo tuyo recién grabado para este hilo (de hasta ${f.autor === 'coach' ? 3 : 1} min)`);
    }
  }
  // Como la 038 (archivo_angulo_fps): el otro ángulo, otro vídeo de técnica del mismo atleta sin pareja (sin cadenas); al
  // pasarlo a otro atleta, se desenlaza; el ritmo de grabación no se cambia después
  function comprobarAngulo(f, antes) {
    if (antes && (f.fps_captura ?? null) !== (antes.fps_captura ?? null)) throw new Error('El ritmo de grabación de un vídeo no se cambia');
    if (antes && f.atleta_id !== antes.atleta_id) f.angulo_de = null;
    f.angulo_de = f.angulo_de ?? null;
    // (como la 038: al desenlazarlos o cambiar de pareja, el desfase de los dos se quita)
    if (antes?.angulo_de && f.angulo_de !== antes.angulo_de) {
      for (const r of tabla('video_revisiones')) if (r.dos_angulos && ((r.archivo_id === antes.id && r.dos_angulos.con === antes.angulo_de) || (r.archivo_id === antes.angulo_de && r.dos_angulos.con === antes.id))) r.dos_angulos = null;
    }
    if (f.angulo_de == null || (antes && f.angulo_de === antes.angulo_de)) return;
    if (antes && deBajaYo()) throw new Error('Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada');
    const p = buscar('archivos', f.angulo_de);
    if (!p || p.tipo !== 'video_tecnica' || f.tipo !== 'video_tecnica' || p.atleta_id !== f.atleta_id || p.id === f.id) throw new Error('El otro ángulo tiene que ser otro vídeo de técnica del mismo atleta');
    if (p.angulo_de || tabla('archivos').some((x) => x.angulo_de === p.id && x.id !== f.id) || (antes && tabla('archivos').some((x) => x.angulo_de === f.id))) {
      throw new Error('Ese vídeo ya tiene su otro ángulo: como mucho dos ángulos de una serie');
    }
  }
  // Como la 038: al borrar un vídeo de técnica, sus respuestas en vídeo y el desfase que lo nombra
  function antesDeBorrarVideos(ids) {
    const respuestas = tabla('comentarios').filter((c) => ids.includes(c.archivo_id) && c.video_respuesta_id && !ids.includes(c.video_respuesta_id)).map((c) => c.video_respuesta_id)
      .filter((id) => buscar('archivos', id)?.tipo === 'adjunto');
    for (const r of tabla('video_revisiones')) if (r.dos_angulos && ids.includes(r.dos_angulos.con)) r.dos_angulos = null;
    return respuestas;
  }
  // Como la 035 (al_mover_archivo): el vídeo que pasa a otro atleta se lleva su corrección (sin la voz del coach, que era
  // del primero) y las repeticiones del primero se quedan sueltas
  function alMoverArchivo(fila, atletaAntes) {
    if (fila.atleta_id === atletaAntes) return;
    for (const r of tabla('video_revisiones')) {
      if (r.archivo_id !== fila.id) continue;
      const voz = r.voz_archivo_id;
      if (voz) { r.voz_archivo_id = null; r.voz_inicio = null; r.actualizado_en = ahora(); }
      r.atleta_id = fila.atleta_id;
      if (voz) soltarVoz(voz);
    }
    for (const x of tabla('archivos')) if (x.repite_de === fila.id && x.atleta_id !== fila.atleta_id) x.repite_de = null;
    db.notificaciones = tabla('notificaciones').filter((n) => !(n.estado === 'pendiente' && [`video:${fila.id}`, `archivo:${fila.id}`].includes(n.clave)));
    // Como la 038: sus dos ángulos (los dos lados) y el desfase guardado
    fila.angulo_de = null;
    for (const x of tabla('archivos')) if (x.angulo_de === fila.id) x.angulo_de = null;
    for (const r of tabla('video_revisiones')) if (r.dos_angulos && (r.archivo_id === fila.id || r.dos_angulos.con === fila.id)) r.dos_angulos = null;
    // Como la 037: del hilo del vídeo (no los adjuntos del chat), lo del atleta de antes se borra y lo del coach va con
    // el vídeo (sin «leído» ni las reacciones y los destacados del de antes); sus avisos pendientes, fuera
    const perfilAntes = buscar('atletas', atletaAntes)?.perfil_id || null;
    const hilo = tabla('comentarios').filter((c) => c.archivo_id === fila.id && !c.adjunto);
    const ids = hilo.map((c) => c.id);
    if (ids.length) {
      // Como la 038: sus respuestas en vídeo, fuera (y a la cola de Storage)
      const resp = hilo.map((c) => c.video_respuesta_id).filter((id) => id && buscar('archivos', id)?.tipo === 'adjunto');
      if (resp.length) borrarCascada('archivos', resp);
      db.notificaciones = tabla('notificaciones').filter((n) => !(n.estado === 'pendiente' && ids.some((id) => n.clave === `comentario:${id}`)));
      const delAtleta = hilo.filter((c) => c.autor !== 'coach').map((c) => c.id);
      if (delAtleta.length) borrarCascada('comentarios', delAtleta);
      if (perfilAntes) {
        db.comentario_reacciones = tabla('comentario_reacciones').filter((r) => !(ids.includes(r.comentario_id) && r.usuario_id === perfilAntes));
        db.comentario_destacados = tabla('comentario_destacados').filter((r) => !(ids.includes(r.comentario_id) && r.usuario_id === perfilAntes));
      }
      db.conversacion_fijado = tabla('conversacion_fijado').filter((x) => !ids.includes(x.comentario_id));
      for (const c of tabla('comentarios')) if (ids.includes(c.id) && c.autor === 'coach') Object.assign(c, { atleta_id: fila.atleta_id, leido_en: null, entregado_en: null, escuchado_en: null });
    }
    // Su valoración (del de antes) se borra; sus recordatorios van con él (activos solo si caben)
    db.video_autoevaluacion = tabla('video_autoevaluacion').filter((x) => x.archivo_id !== fila.id);
    const recs = tabla('recordatorios_tecnica').filter((x) => x.archivo_id === fila.id && x.atleta_id === atletaAntes)
      .sort((a, b) => (b.activo - a.activo) || String(b.actualizado_en).localeCompare(String(a.actualizado_en)));
    for (const r of recs) {
      const caben = tabla('recordatorios_tecnica').filter((y) => y.atleta_id === fila.atleta_id && y.ejercicio_id === r.ejercicio_id && y.activo).length < MAX_RECORDATORIOS;
      Object.assign(r, { atleta_id: fila.atleta_id, activo: r.activo && caben, actualizado_en: ahora() });
    }
  }
  // Como la 037 (recordatorio_preparar): el vídeo, uno de técnica de ese atleta; como mucho 3 activos por atleta y
  // ejercicio; no cambia de atleta ni de ejercicio; las fechas, de la base
  function prepararRecordatorio(f, antes) {
    if (antes && (f.atleta_id !== antes.atleta_id || f.ejercicio_id !== antes.ejercicio_id)) throw new Error('Un recordatorio no cambia de atleta ni de ejercicio: fija otro');
    f.texto = String(f.texto ?? '').replace(/\s+/g, ' ').trim();
    if (f.archivo_id == null) { if (antes?.archivo_id) f.segundo = null; }
    else if (!antes || f.archivo_id !== antes.archivo_id) {
      const a = buscar('archivos', f.archivo_id);
      if (!a || a.tipo !== 'video_tecnica' || a.atleta_id !== f.atleta_id) throw new Error('El vídeo del recordatorio tiene que ser un vídeo de técnica de este atleta');
    }
    if (f.segundo != null) f.segundo = Number(f.segundo);
    if (f.activo && (!antes || !antes.activo) && tabla('recordatorios_tecnica').filter((r) => r !== antes && r.id !== f.id && r.atleta_id === f.atleta_id && r.ejercicio_id === f.ejercicio_id && r.activo).length >= MAX_RECORDATORIOS) {
      throw new Error('Como mucho 3 recordatorios activos por ejercicio: quita alguno antes');
    }
    f.creado_en = antes ? antes.creado_en : ahora();
    f.actualizado_en = ahora();
  }
  // Como la 037 (frase_preparar): sin espacios de más; como mucho 300 (y 40 por ejercicio)
  function prepararFrase(f, antes) {
    f.texto = String(f.texto ?? '').replace(/\s+/g, ' ').trim();
    if (!antes) {
      if (tabla('frases_correccion').length >= 300) throw new Error('Como mucho 300 frases: borra alguna antes');
      if (tabla('frases_correccion').filter((x) => (x.ejercicio_id ?? null) === (f.ejercicio_id ?? null)).length >= 40) throw new Error('Como mucho 40 frases por ejercicio: borra alguna antes');
      f.creado_en = ahora();
    } else f.creado_en = antes.creado_en;
  }
  // Como la 039 (umbral_velocidad_preparar): no cambia de ejercicio, sin ceros de más, la fecha de la base, 1000 como mucho
  function prepararUmbral(f, antes) {
    if (antes && f.ejercicio_id !== antes.ejercicio_id) throw new Error('Una velocidad mínima no cambia de ejercicio');
    if (typeof f.vmin === 'string' && f.vmin.trim() !== '') f.vmin = Number(f.vmin);
    if (!antes && tabla('umbrales_velocidad').length >= 1000) throw new Error('Como mucho 1000 velocidades mínimas: quita alguna antes');
    f.actualizado_en = ahora();
  }
  // Como la 037 (video_modelo_preparar): 6 por ejercicio; una ruta de la cola de Storage no vuelve; de uno subido solo
  // cambian el ángulo, el orden, la duración y quitar la miniatura
  function prepararModelo(f, antes) {
    f.angulo = f.angulo == null ? null : String(f.angulo).replace(/\s+/g, ' ').trim() || null;
    if (!antes) {
      if (tabla('storage_por_borrar').some((x) => x.ruta === f.ruta || (f.poster_ruta && x.ruta === f.poster_ruta))) throw new Error('Esa ruta ya se usó para un archivo eliminado: no se puede volver a registrar');
      if (tabla('videos_modelo').filter((m) => m.ejercicio_id === f.ejercicio_id).length >= 6) throw new Error('Como mucho 6 vídeos modelo por ejercicio: borra alguno antes');
      if (tabla('videos_modelo').some((m) => m.ruta === f.ruta)) throw new Error('duplicate key value violates unique constraint "videos_modelo_ruta_unica"');
      f.creado_en = ahora();
    } else if (['id', 'ejercicio_id', 'ruta', 'mime', 'bytes', 'creado_en'].some((k) => f[k] !== antes[k]) || (f.poster_ruta != null && f.poster_ruta !== antes.poster_ruta)) {
      throw new Error('De un vídeo modelo solo se cambian el ángulo, el orden y la duración');
    }
  }
  // Como la 037 (video_autoevaluacion_preparar): de un vídeo de técnica; el atleta, de los suyos (no de baja) mientras su
  // coach no lo ha revisado ni corregido; la molestia, con su consentimiento de salud; con su cupo; el coach, no la escribe
  function prepararAutoevaluacion(f, antes) {
    if (antes && f.archivo_id !== antes.archivo_id) throw new Error('Una valoración no cambia de vídeo');
    const a = buscar('archivos', f.archivo_id);
    // (como la 037: el mismo error si no existe, no es un vídeo de técnica o es de otro)
    if (!a || a.tipo !== 'video_tecnica' || (!esCoach() && a.atleta_id !== miAtletaId())) throw new Error('Solo valoras tus vídeos de técnica');
    f.atleta_id = a.atleta_id;
    f.nota = f.nota == null ? null : String(f.nota).trim() || null;
    if (f.molestia !== true) f.zona = null;
    if (esCoach()) throw new Error('La valoración es del atleta: tú la lees');
    if (deBaja()) throw new Error('Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada');
    if (a.revisado_en || tabla('video_revisiones').some((r) => r.archivo_id === a.id && r.corregido_en)) throw new Error('Tu coach ya ha revisado este vídeo: tu valoración ya no se cambia');
    if ((f.molestia != null || f.zona != null) && (!antes || f.molestia !== antes.molestia || f.zona !== antes.zona) && !consentimientoDe(a.atleta_id)) {
      throw new Error('Para contar si notas alguna molestia hace falta tu consentimiento de datos de salud');
    }
    // (como la 037: una vez por cambio; lo que no cambia nada, no cuenta)
    if (!antes || ['rpe', 'nota', 'molestia', 'zona'].some((k) => (f[k] ?? null) !== (antes[k] ?? null))) gastarCupoChat('autoevaluacion');
    f.creado_en = antes ? antes.creado_en : ahora();
    f.actualizado_en = ahora();
  }
  // Como la 035 (video_revision_preparar): de un vídeo de técnica; el tempo, dentro del vídeo; la voz, una nota de voz de
  // ese atleta subida por el coach; «Visto», el día de hoy (y se queda); «Corregido», la primera vez que lleva algo
  function prepararRevision(f, antes) {
    if (antes && f.archivo_id !== antes.archivo_id) throw new Error('Una corrección no cambia de vídeo');
    const a = buscar('archivos', f.archivo_id);
    if (!a || a.tipo !== 'video_tecnica') throw new Error('Solo se corrige un vídeo de técnica');
    f.atleta_id = a.atleta_id;
    const dur = (Number.isFinite(a.duracion_seg) ? a.duracion_seg : 3599) + 1;
    if (f.tempo != null && f.tempo.reps?.flat().some((x) => x > dur)) throw new Error('El tempo se sale del vídeo');
    // Como la 036: el análisis, dentro del vídeo
    if (f.analisis != null && analisisValido(f.analisis) && !analisisValido(f.analisis, dur - 1)) throw new Error('El análisis se sale del vídeo');
    // Como la 037: las marcas de repetición a mano, dentro del vídeo
    if (f.reps_manual != null && repsManualValidas(f.reps_manual) && (!antes || JSON.stringify(f.reps_manual) !== JSON.stringify(antes.reps_manual)) && !repsManualValidas(f.reps_manual, dur - 1)) throw new Error('Las marcas de repetición se salen del vídeo');
    // Como la 038: el desfase, con el otro ángulo de este vídeo
    if (f.dos_angulos != null && dosAngulosValido(f.dos_angulos) && JSON.stringify(f.dos_angulos) !== JSON.stringify(antes?.dos_angulos ?? null)) {
      const con = f.dos_angulos.con;
      if (!(a.angulo_de === con || buscar('archivos', con)?.angulo_de === a.id)) throw new Error('El desfase es con el otro ángulo de este vídeo');
    }
    if (f.voz_archivo_id == null) f.voz_inicio = null;
    else if (!antes || f.voz_archivo_id !== antes.voz_archivo_id) {
      const v = buscar('archivos', f.voz_archivo_id);
      if (!v || v.tipo !== 'audio' || v.atleta_id !== a.atleta_id || subidoPor(v) !== 'coach') throw new Error('La voz tiene que ser una nota de voz tuya para este atleta');
      if (archivoConMensajes(v.id)) throw new Error('Esa nota de voz ya está en el chat: graba la voz para el vídeo');
      if (tabla('video_revisiones').some((r) => r !== antes && r.voz_archivo_id === f.voz_archivo_id && r.archivo_id !== f.archivo_id)) throw new Error('duplicate key value violates unique constraint "video_revisiones_voz_unica"');
    }
    if (f.voz_archivo_id != null) { f.voz_inicio = Number(f.voz_inicio) || 0; if (f.voz_inicio > dur) throw new Error('La voz empieza después de que acabe el vídeo'); }
    const hoy = fMadrid();
    f.visto_el = antes ? (antes.visto_el || (f.visto_el ? hoy : null)) : (f.visto_el ? hoy : null);
    f.corregido_en = antes ? antes.corregido_en || null : null;
    if (!f.corregido_en && (f.puntuacion != null || f.checklist != null || f.tempo != null || f.voz_archivo_id != null || f.analisis != null)) f.corregido_en = ahora();
    // actualizado_en, solo cuando cambia la corrección (abrir el vídeo no la cambia)
    const igualQue = (k) => JSON.stringify(f[k] ?? null) === JSON.stringify(antes?.[k] ?? null);
    f.actualizado_en = antes && ['puntuacion', 'checklist', 'tempo', 'voz_archivo_id', 'voz_inicio', 'analisis'].every(igualQue) ? antes.actualizado_en : ahora();
  }
  // La voz de una corrección que se quita (o se cambia por otra) se va con su archivo (como la 035)
  const soltarVoz = (id) => { if (id && buscar('archivos', id)?.tipo === 'audio') borrarCascada('archivos', [id]); };
  const esVozDeVideo = (id) => tabla('video_revisiones').some((r) => r.voz_archivo_id === id);
  // Como la 033: lo fijado (de esa conversación, ya salido y sin eliminar; de 1 hora a 30 días o sin límite)
  function prepararFijado(f, antes) {
    if (antes && f.atleta_id !== antes.atleta_id) throw new Error('No se puede pasar a otro atleta');
    const c = buscar('comentarios', f.comentario_id);
    if (!c || c.atleta_id !== f.atleta_id || c.eliminado_en || programadoAun(c)) throw new Error('Solo se fija un mensaje de esta conversación que ya ha salido');
    if (f.hasta != null && (Date.parse(f.hasta) < Date.now() + 55 * 60000 || Date.parse(f.hasta) > Date.now() + 31 * 864e5)) throw new Error('Un mensaje se fija de 1 hora a 30 días (o sin límite)');
    f.fijado_en = ahora();
  }
  // Como la 033: cada uno silencia lo suyo (el coach, cualquier atleta; un atleta, su conversación), 8 horas, 1 semana o siempre
  function prepararSilencio(f, antes) {
    if (antes && (f.atleta_id !== antes.atleta_id || f.usuario_id !== antes.usuario_id)) throw new Error('De un silencio solo se cambia hasta cuándo');
    f.usuario_id = sesion?.user.id || null;
    if (!f.usuario_id || !(esCoach() || (miAtletaId() && f.atleta_id === miAtletaId()))) throw new Error('Solo puedes silenciar tus conversaciones');
    if (!buscar('atletas', f.atleta_id)) throw new Error('Falta un dato relacionado (puede que se haya borrado).');
    gastarCupoChat('silenciar');
    if (f.hasta != null && (!(Date.parse(f.hasta) > Date.now()) || Date.parse(f.hasta) > Date.now() + 8 * 864e5)) throw new Error('Se silencia 8 horas, 1 semana o siempre');
    f.creado_en = ahora();
    // Las notificaciones pendientes de esa conversación que saldrían mientras dura, fuera
    // (solo las del chat: las que llevan a #mensajes; un comentario en una sesión, un check-in o un vídeo sigue avisando)
    db.notificaciones = tabla('notificaciones').filter((x) => !(x.usuario_id === f.usuario_id && x.estado === 'pendiente' && ['respuesta', 'mensaje'].includes(x.tipo)
      && /^#mensajes(\/|$)/.test(String(x.url || ''))
      && (f.hasta == null || Date.parse(x.enviar_desde) < Date.parse(f.hasta))
      && (String(x.clave).startsWith(`mensaje:${f.atleta_id}:`) || (String(x.clave).startsWith('comentario:') && buscar('comentarios', String(x.clave).slice(11))?.atleta_id === f.atleta_id))));
  }
  // Como la 033: las listas, 30 como mucho, con nombre (sin repetir); 256 atletas por lista
  function prepararLista(t, f, antes) {
    if (t === 'listas_difusion') {
      f.nombre = String(f.nombre ?? '').trim();
      if (!(f.nombre.length >= 1 && f.nombre.length <= 40 && textoVisible(f.nombre))) throw new Error('Algún valor está fuera de rango.');
      if (tabla(t).some((x) => x !== antes && x.id !== f.id && x.nombre.trim().toLowerCase() === f.nombre.toLowerCase())) throw new Error('duplicate key value violates unique constraint "listas_difusion_nombre_unico"');
      if (!antes && tabla(t).length >= 30) throw new Error('Como mucho 30 listas de difusión');
      f.creada_en = antes ? antes.creada_en : ahora();
    } else {
      if (!buscar('listas_difusion', f.lista_id) || !buscar('atletas', f.atleta_id)) throw new Error('Falta un dato relacionado (puede que se haya borrado).');
      if (tabla(t).some((x) => x.lista_id === f.lista_id && x.atleta_id === f.atleta_id)) throw new Error('duplicate key value violates unique constraint "listas_difusion_miembros_pkey"');
      if (tabla(t).filter((x) => x.lista_id === f.lista_id).length >= 256) throw new Error('Una lista de difusión, como mucho 256 atletas');
    }
  }
  // Como la 034: la versión de la política vista, a su nombre; una que exista (no más de un mes vista), con su formato, y
  // nunca hacia atrás; la hora, la del servidor
  function prepararPrivacidad(f, antes) {
    f.usuario_id = sesion?.user.id || null;
    if (!f.usuario_id) throw new Error('Necesitas iniciar sesión');
    if (antes && f.usuario_id !== antes.usuario_id) throw new Error('Solo la tuya');
    // (como la 037: «AAAA-MM» o con su revisión, «AAAA-MM.n»; el mes, como mucho el que viene; se compara por partes)
    // (como la 043: la revisión, de una o dos cifras)
    if (!/^20[0-9]{2}-(0[1-9]|1[0-2])(\.[1-9][0-9]?)?$/.test(String(f.version ?? ''))) throw new Error('Algún valor está fuera de rango.');
    const [y, m] = fMadrid(new Date()).split('-').map(Number);
    const tope = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    if (f.version.slice(0, 7) > tope) throw new Error('Esa versión de la política aún no existe');
    if (antes && compararVersiones(f.version, antes.version) < 0) f.version = antes.version;
    f.vista_en = ahora();
  }
  // Como la 032: la presencia solo se escribe con presencia_marcar(); los cupos, nadie
  const sinPermisoTabla = (t) => new Error(`permission denied for table ${t}`);
  // Como la 032: reaccionar y destacar, a su nombre, en mensajes que ya han salido y no se han eliminado; una por persona
  function prepararReaccionODestacado(t, f) {
    if (deBajaYo()) throw new Error('Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada');
    f.usuario_id = sesion?.user.id || null;
    // Como la 034: cualquier emoji (uno), no solo los seis de siempre
    if (t === 'comentario_reacciones' && !emojiValido(f.emoji)) throw new Error('Algún valor está fuera de rango.');
    if (!f.usuario_id || !comentarioReaccionable(f.comentario_id)) throw sinPermiso();
    if (tabla(t).some((x) => x.comentario_id === f.comentario_id && x.usuario_id === f.usuario_id)) throw new Error(`duplicate key value violates unique constraint "${t}_pkey"`);
    gastarCupoChat(t === 'comentario_reacciones' ? 'reaccion' : 'destacar');
    f.creado_en = ahora();
  }
  function insertar(t, fila, opciones = {}) {
    soloCoach(t);
    if (['presencia', 'chat_cupos', 'encuestas_chat', 'encuesta_votos'].includes(t)) throw sinPermisoTabla(t);
    // Como la 027: entrar, reaccionar y avisar al coach van por sus funciones; los retos, solo el coach
    if (['comunidad_ajustes', 'comunidad_miembros', 'comunidad_reacciones', 'comunidad_reportes', 'comunidad_cupos', 'comunidad_votos', 'comunidad_animos', 'comunidad_comentario_reacciones', 'comunidad_bienvenidas', 'comunidad_companeros', 'comunidad_reto_equipos', 'comunidad_guardados', 'comunidad_preguntas',
      'comunidad_evento_asistentes', 'comunidad_destacados', 'comunidad_moderacion'].includes(t)) throw sinPermiso();
    if (['comunidad_retos', 'comunidad_eventos', 'comunidad_plantillas'].includes(t) && !esCoach()) throw sinPermiso();
    if (t === 'recetas_atleta' && !esCoach()) throw new Error('new row violates row-level security policy');
    const nueva = { ...(SIN_ID.includes(t) ? {} : { id: uuid() }), ...(DEFECTOS[t]?.() || {}), ...copia(fila) };
    if (t === 'comentario_reacciones' || t === 'comentario_destacados') prepararReaccionODestacado(t, nueva);
    if (t === 'conversacion_estado') {
      if (tabla(t).some((x) => x.atleta_id === nueva.atleta_id)) throw new Error('duplicate key value violates unique constraint "conversacion_estado_pkey"');
      prepararEstadoConversacion(nueva, null);
    }
    if (t === 'conversacion_fijado') {
      if (tabla(t).some((x) => x.atleta_id === nueva.atleta_id)) throw new Error('duplicate key value violates unique constraint "conversacion_fijado_pkey"');
      prepararFijado(nueva, null);
    }
    if (t === 'privacidad_vista') {
      prepararPrivacidad(nueva, null);
      if (tabla(t).some((x) => x.usuario_id === nueva.usuario_id)) throw new Error('duplicate key value violates unique constraint "privacidad_vista_pkey"');
    }
    if (t === 'chat_silencios') {
      prepararSilencio(nueva, null);
      if (tabla(t).some((x) => x.usuario_id === nueva.usuario_id && x.atleta_id === nueva.atleta_id)) throw new Error('duplicate key value violates unique constraint "chat_silencios_pkey"');
    }
    if (t === 'listas_difusion' || t === 'listas_difusion_miembros') prepararLista(t, nueva, null);
    antesDeInsertar(t, nueva, opciones);
    if (t === 'objetivos') comprobarMarca(nueva);
    comprobarChecks(t, nueva);
    tabla(t).push(nueva);
    despuesDeInsertar(t, nueva);
    return nueva;
  }

  function borrarCascada(t, ids) {
    // Como la 032 (revisión): al borrar un archivo, su ruta y su miniatura a la cola de Storage; los mensajes de un
    // adjunto del chat quedan como eliminados (salvo si se borra el atleta entero: se va todo)
    // Como la 035: la voz del coach de las correcciones que se van con su vídeo, también
    // Como la 038: un mensaje con respuesta en vídeo que se borra se lleva su vídeo
    if (t === 'comentarios') {
      const resp = tabla('comentarios').filter((c) => ids.includes(c.id) && c.video_respuesta_id && buscar('archivos', c.video_respuesta_id)?.tipo === 'adjunto').map((c) => c.video_respuesta_id);
      if (resp.length) borrarCascada('archivos', resp);
    }
    if (t === 'archivos') {
      const respuestas = antesDeBorrarVideos(tabla('archivos').filter((x) => ids.includes(x.id) && x.tipo === 'video_tecnica').map((x) => x.id));
      if (respuestas.length) ids = [...ids, ...respuestas.filter((r) => !ids.includes(r))];
      const voces = tabla('video_revisiones').filter((r) => ids.includes(r.archivo_id) && r.voz_archivo_id && !ids.includes(r.voz_archivo_id)).map((r) => r.voz_archivo_id);
      // (y, como la 035, un dibujo sin su vídeo no vale: se quita de sus comentarios)
      for (const c of tabla('comentarios')) if (ids.includes(c.archivo_id) && c.dibujo) c.dibujo = null;
      if (voces.length) { ids = [...ids, ...voces]; }
      for (const a of tabla('archivos').filter((x) => ids.includes(x.id))) {
        encolar([a.ruta, a.poster_ruta], a.tipo === 'audio' ? 'voz' : 'archivos');
        // Como la 038: el archivo de una respuesta en vídeo que se borra deja su mensaje como eliminado (si su hilo sigue)
        if (a.tipo === 'adjunto' && buscar('atletas', a.atleta_id)) {
          for (const c of tabla('comentarios').filter((k) => k.video_respuesta_id === a.id && k.archivo_id && !ids.includes(k.archivo_id) && buscar('archivos', k.archivo_id))) {
            c.video_respuesta_id = null;
            if (!c.eliminado_en) vaciarComentario(c);
          }
        }
        if (DEL_CHAT.includes(a.tipo) && buscar('atletas', a.atleta_id)) {
          for (const c of tabla('comentarios').filter((k) => k.archivo_id === a.id)) vaciarComentario(c);
          for (const c of tabla('comentarios').filter((k) => k.archivo_id === a.id)) c.archivo_id = null;
        }
      }
    }
    // Como la 037: un vídeo modelo que se va (o el ejercicio con los suyos), a la cola de Storage
    if (t === 'videos_modelo') for (const m of tabla('videos_modelo').filter((x) => ids.includes(x.id))) encolar([m.ruta, m.poster_ruta], 'archivos');
    for (const [hija, col] of CASCADA[t] || []) {
      // Las que no tienen «id» (una fila por atleta) se borran por su columna
      if (SIN_ID.includes(hija)) { db[hija] = tabla(hija).filter((x) => !ids.includes(x[col])); continue; }
      const idsHijas = tabla(hija).filter((x) => ids.includes(x[col])).map((x) => x.id);
      if (idsHijas.length) borrarCascada(hija, idsHijas);
    }
    for (const [hija, col] of ANULAR[t] || []) for (const x of tabla(hija)) if (ids.includes(x[col])) { x[col] = null; if (hija === 'objetivos') comprobarMarca(x); if (hija === 'video_revisiones') x.voz_inicio = null; if (hija === 'recordatorios_tecnica') x.segundo = null; }
    db[t] = tabla(t).filter((x) => !ids.includes(x.id));
  }

  const usuario = () => tabla('auth_users').find((x) => x.id === sesion?.user.id);
  // «data:tipo;base64,…» → URL de blob (una vez por ruta)
  const aBlob = (dataUrl, ruta) => {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:') || typeof URL?.createObjectURL !== 'function' || typeof atob !== 'function') return dataUrl;
    try {
      const coma = dataUrl.indexOf(',');
      const tipo = dataUrl.slice(5, coma).replace(/;base64$/, '');
      const bin = atob(dataUrl.slice(coma + 1));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const u = URL.createObjectURL(new Blob([bytes], { type: tipo }));
      urls.set(ruta, u);
      return u;
    } catch { return dataUrl; }
  };

  // Las funciones de la comunidad (como las de la migración 027)
  const limpiarNombre = (t) => String(t || '').replace(/[\s\u0000-\u001f\u007f]+/g, ' ').trim();
  const sesionesDe = (atletaId) => {
    const bloques = new Set(tabla('bloques').filter((x) => x.atleta_id === atletaId && !x.es_plantilla).map((x) => x.id));
    const semanas = new Set(tabla('semanas').filter((w) => bloques.has(w.bloque_id)).map((w) => w.id));
    return tabla('sesiones').filter((x) => semanas.has(x.semana_id));
  };
  const nombreDe = (pid) => tabla('comunidad_miembros').find((m) => m.perfil_id === pid)?.nombre
    || (perfilDe(pid)?.rol === 'coach' ? String(perfilDe(pid).nombre || '').trim().split(/\s+/)[0] || 'Coach' : 'Alguien del equipo');
  // Como la 029: semanas publicadas (una por lunes: la del bloque más reciente), rachas, retos conseguidos
  const lunesHoy = () => lunesDe(fechaMadrid());
  // Como la 029: las sesiones que cuentan (terminadas, de semanas publicadas de bloques no cancelados, con fecha de
  // hasta hoy en Madrid, como mucho 2 por día: las de la semana más antigua)
  function sesionesValidas(atletaId) {
    const hoy = fechaMadrid();
    const bl = Object.fromEntries(tabla('bloques').filter((x) => x.atleta_id === atletaId && !x.es_plantilla && x.estado !== 'cancelado').map((x) => [x.id, x]));
    const ws = Object.fromEntries(tabla('semanas').filter((w) => bl[w.bloque_id] && w.programacion === 'programada').map((w) => [w.id, w]));
    const hechas = tabla('sesiones').filter((x) => ws[x.semana_id] && x.completada && x.fecha_realizada && x.fecha_realizada <= hoy)
      .sort((a, b2) => String(ws[a.semana_id].fecha_inicio || '').localeCompare(String(ws[b2.semana_id].fecha_inicio || '')) || (a.orden || 0) - (b2.orden || 0) || String(a.id).localeCompare(String(b2.id)));
    const porDia = {};
    return hechas.filter((x) => (porDia[x.fecha_realizada] = (porDia[x.fecha_realizada] || 0) + 1) <= 2);
  }
  function semanasDe(atletaId) {
    const bl = tabla('bloques').filter((x) => x.atleta_id === atletaId && !x.es_plantilla && x.estado !== 'cancelado')
      .sort((x, y) => String(y.fecha_inicio || '').localeCompare(String(x.fecha_inicio || '')) || (y.numero || 0) - (x.numero || 0));
    const porLunes = new Map();
    for (const x of bl) {
      for (const w of tabla('semanas').filter((s2) => s2.bloque_id === x.id && s2.programacion === 'programada' && s2.fecha_inicio)) {
        const l = lunesDe(w.fecha_inicio);
        if (l <= lunesHoy() && !porLunes.has(l)) porLunes.set(l, w);
      }
    }
    const validas = sesionesValidas(atletaId);
    return [...porLunes.entries()].map(([lunes, w]) => {
      const ss = tabla('sesiones').filter((x) => x.semana_id === w.id);
      return { lunes, previstas: ss.length, hechas: validas.filter((x) => x.semana_id === w.id).length };
    }).filter((x) => x.previstas > 0).sort((a, b2) => (a.lunes < b2.lunes ? 1 : -1));
  }
  function rachaDe(atletaId) {
    const semanas = semanasDe(atletaId);
    const cuentan = semanas.filter((x) => x.lunes < lunesHoy() || x.hechas >= x.previstas);
    const rota = cuentan.findIndex((x) => x.hechas < x.previstas);
    return { racha: rota === -1 ? cuentan.length : rota, semana_completa: semanas.some((x) => x.lunes === lunesHoy() && x.hechas >= x.previstas) };
  }
  const hechasEntre = (atletaId, desde, hasta) => sesionesValidas(atletaId).filter((x) => x.fecha_realizada >= desde && x.fecha_realizada <= hasta).length;
  const dentroTodos = () => tabla('comunidad_miembros').filter(miembroVisto);
  // Como la 042: lo que cuenta cada reto (sesiones, minutos de cardio de quien los cuenta o semanas completas), los equipos
  const valor = (medida, atletaId, desde, hasta) => {
    if (medida === 'cardio') {
      return sesionesValidas(atletaId).filter((x) => x.fecha_realizada >= desde && x.fecha_realizada <= hasta)
        .reduce((a, x) => a + (typeof x.cardio_hecho?.minutos === 'number' ? Math.floor(x.cardio_hecho.minutos) : 0), 0);
    }
    if (medida === 'semanas') return semanasDe(atletaId).filter((x) => x.lunes >= lunesDe(desde) && x.lunes <= hasta && x.hechas >= x.previstas).length;
    return hechasEntre(atletaId, desde, hasta);
  };
  const valorReto = (r, atletaId) => {
    const medida = r.medida || 'sesiones';
    if (medida === 'cardio' && !tabla('comunidad_miembros').find((x) => x.atleta_id === atletaId)?.cardio_en_retos) return 0;
    return valor(medida, atletaId, r.desde, r.hasta);
  };
  const equipoDe = (r, atletaId) => tabla('comunidad_reto_equipos').find((x) => x.reto_id === r.id && x.atleta_id === atletaId)?.equipo ?? null;
  // (sin quien no sale en el ranking: puede estar en el equipo, pero lo suyo no suma, así no se le adivina restando)
  const totalEquipo = (r, equipo) => dentroTodos().filter((m) => !m.sin_ranking && equipoDe(r, m.atleta_id) === equipo).reduce((a, m) => a + valorReto(r, m.atleta_id), 0);
  const totalReto = (r) => (r.modo === 'equipos' ? totalEquipo(r, 0) + totalEquipo(r, 1)
    : dentroTodos().filter((m) => !m.sin_ranking).reduce((a, m) => a + valorReto(r, m.atleta_id), 0));
  const retoConseguido = (r, atletaId) => {
    const m = tabla('comunidad_miembros').find((x) => x.atleta_id === atletaId);
    if (!m || r.hasta < fechaMadrid(new Date(m.entrado_en || m.creado_en))) return false;
    const modo = r.modo || 'individual';
    const eq = equipoDe(r, atletaId);
    return (modo === 'equipo' ? totalReto(r) : modo === 'equipos' ? (eq == null ? 0 : totalEquipo(r, eq)) : valorReto(r, atletaId)) >= r.objetivo;
  };
  // Como la 042: la racha de dos (y la mejor) y si ha completado esta semana
  const rachasPareja = (a, b2, desde = null) => rachaPareja(semanasDe(a), semanasDe(b2), { lunesHoy: lunesHoy(), desde });
  const semanaCompleta = (atletaId) => { const x = semanasDe(atletaId).find((w) => w.lunes === lunesHoy()); return x ? x.hechas >= x.previstas : null; };
  const otroDe = (c, pid) => (c.de === pid ? c.para : c.de);
  // (como la 042: esté como esté el otro; las parejas de quien sale, es sacado o se da de baja ya se borran)
  const companerosOcupados = (pid) => tabla('comunidad_companeros').filter((c) => (c.de === pid || c.para === pid) && (c.estado === 'aceptada' || c.de === pid)).length;
  const insigniasDe = (m) => {
    const pid = m.perfil_id;
    const parejas = tabla('comunidad_companeros').filter((c) => c.estado === 'aceptada' && (c.de === pid || c.para === pid)).map((c) => {
      const o = dentroTodos().find((x) => x.perfil_id === otroDe(c, pid));
      return o ? rachasPareja(m.atleta_id, o.atleta_id, fechaMadrid(new Date(c.aceptado_en))).mejor : 0;
    });
    return [
      ['primera_publicacion', tabla('comunidad_posts').filter((x) => x.autor_id === pid && !x.oculta && x.tipo !== 'aniversario').length, 1],
      ['animos_10', tabla('comunidad_animos').filter((x) => x.de === pid).length, 10],
      ['reacciones_25', tabla('comunidad_reacciones').filter((x) => x.autor_id === pid).length, 25],
      ['retos_5', tabla('comunidad_retos').filter((r) => retoConseguido(r, m.atleta_id)).length, 5],
      ['racha_4', rachasPareja(m.atleta_id, m.atleta_id).mejor, 4],
      ['pareja_4', Math.max(0, ...parejas), 4],
    ];
  };
  // Como crear_recordatorios() de la 045 (en la demo no hay servidor: se hace al leer el muro): el aniversario del día en el muro
  // (una vez por persona y aniversario; de quien está dentro y sale en el ranking) y borrar los momentos de hace más de 24 horas
  // (su foto, a la cola de Storage, salvo la de un aviso abierto al coach)
  function pasadaComunidadDemo() {
    let cambio = false;
    const hoy = fechaMadrid();
    if (comunidadActiva()) {
      for (const m of dentroTodos().filter((x) => !x.sin_ranking)) {
        const an = aniversarioDe(buscar('atletas', m.atleta_id)?.fecha_alta, hoy);
        if (!an || tabla('comunidad_aniversarios').some((h) => h.perfil_id === m.perfil_id && h.meses === an.meses)) continue;
        tabla('comunidad_aniversarios').push({ perfil_id: m.perfil_id, meses: an.meses, fecha: hoy, creado_en: ahora() });
        tabla('comunidad_posts').push({ id: uuid(), autor_id: m.perfil_id, atleta_id: m.atleta_id, tipo: 'aniversario', texto: null, foto_ruta: null, sesion_id: null, resumen: { meses: an.meses, fecha: hoy },
          fijada: false, oculta: false, creado_en: ahora(), menciones: [], encuesta: null, reto_id: null, tema: null, fotos: null, mejor_comentario: null, publicar_en: null, retenida: false });
        cambio = true;
      }
    }
    const caducados = tabla('comunidad_posts').filter((x) => x.tipo === 'momento' && Date.parse(x.creado_en) <= Date.now() - HORAS_MOMENTO * 3600e3);
    if (caducados.length) {
      encolar(caducados.map((x) => x.foto_ruta).filter((r) => r && !tabla('comunidad_reportes').some((k) => !k.resuelto_en && usaCopia(k, r))), 'comunidad');
      borrarCascada('comunidad_posts', caducados.map((x) => x.id));
      cambio = true;
    }
    if (cambio) persistirYa();
  }
  function rpcComunidad(nombre, args, uid, perfil) {
    const yo = tabla('atletas').find((a) => a.perfil_id === uid);
    const coach = perfil?.rol === 'coach';
    if (nombre === 'comunidad_unirme') {
      if (!uid) throw new Error('Necesitas iniciar sesión');
      if (coach) throw new Error('El coach está en la comunidad como coach, no como miembro');
      if (!yo) throw new Error('Solo los atletas del equipo pueden entrar');
      if (yo.estado === 'baja') throw new Error('Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada');
      if (!comunidadActiva()) throw new Error('La comunidad no está abierta');
      const m = tabla('comunidad_miembros').find((x) => x.atleta_id === yo.id);
      if (m?.bloqueado) throw new Error('Tu coach te ha sacado de la comunidad: habla con él si quieres volver');
      if (args.p_version !== VERSION_COMUNIDAD) throw new Error('El texto que aceptas no es el vigente: recarga la app y vuelve a intentarlo');
      // Como la 028: con las normas vigentes leídas
      if (args.p_normas !== VERSION_NORMAS) throw new Error(args.p_normas === undefined ? 'Para entrar hay que leer antes las normas del equipo: actualiza la app y vuelve a intentarlo' : 'Antes de entrar, lee las normas del equipo vigentes: recarga la app y vuelve a intentarlo');
      const v = limpiarNombre(args.p_nombre);
      const problema = problemaNombre(v, yo.id);
      if (problema) throw new Error(problema);
      const normas = { normas_version: args.p_normas, normas_leidas_en: ahora() };
      // (como la 029: entrado_en, la última vez que entró o volvió; aceptar lo nuevo estando dentro no la cambia)
      if (m) Object.assign(m, { perfil_id: uid, nombre: v, version: args.p_version, aceptado_en: ahora(), salido_en: null, nombre_cambiado_en: null, ...normas, entrado_en: m.salido_en ? ahora() : (m.entrado_en || m.creado_en) });
      else tabla('comunidad_miembros').push({ atleta_id: yo.id, perfil_id: uid, nombre: v, version: args.p_version, aceptado_en: ahora(), salido_en: null, sin_ranking: false, bloqueado: false, nombre_cambiado_en: null, creado_en: ahora(), entrado_en: ahora(), ver_entrenando: false, cardio_en_retos: false, ...normas });
      return null;
    }
    if (nombre === 'comunidad_salir') {
      if (!uid) throw new Error('Necesitas iniciar sesión');
      // (como la 041, revisión: al salir se apaga «Entrenando ahora»)
      for (const m of tabla('comunidad_miembros')) if (m.perfil_id === uid && !m.salido_en) { m.salido_en = ahora(); m.ver_entrenando = false; }
      let fotos = [];
      if (args.p_borrar && !coach) {
        // (043: también las de varias fotos, y lo que ha guardado)
        fotos = [...new Set(tabla('comunidad_posts').filter((x) => x.autor_id === uid).flatMap((x) => (Array.isArray(x.fotos) && x.fotos.length ? x.fotos : [x.foto_ruta]))
          .filter((r) => r && !tabla('comunidad_reportes').some((k) => usaCopia(k, r) && !k.resuelto_en)))];
        db.comunidad_guardados = tabla('comunidad_guardados').filter((x) => x.perfil_id !== uid);
        db.comunidad_evento_asistentes = tabla('comunidad_evento_asistentes').filter((x) => x.perfil_id !== uid); // (044)
        db.comunidad_reacciones = tabla('comunidad_reacciones').filter((x) => x.autor_id !== uid);
        // (029) también sus votos y los ánimos que ha mandado
        db.comunidad_votos = tabla('comunidad_votos').filter((x) => x.autor_id !== uid);
        db.comunidad_animos = tabla('comunidad_animos').filter((x) => x.de !== uid && x.para !== uid);
        // (como la 041: también sus 💪 a comentarios y las bienvenidas, dadas y recibidas)
        db.comunidad_comentario_reacciones = tabla('comunidad_comentario_reacciones').filter((x) => x.autor_id !== uid);
        db.comunidad_bienvenidas = tabla('comunidad_bienvenidas').filter((x) => x.de !== uid && x.para !== uid);
        borrarCascada('comunidad_comentarios', tabla('comunidad_comentarios').filter((x) => x.autor_id === uid).map((x) => x.id));
        borrarCascada('comunidad_posts', tabla('comunidad_posts').filter((x) => x.autor_id === uid).map((x) => x.id));
      }
      // (como la 042: salir termina sus parejas)
      db.comunidad_companeros = tabla('comunidad_companeros').filter((c) => c.de !== uid && c.para !== uid);
      return fotos;
    }
    if (nombre === 'comunidad_ajustar') {
      if (!soyMiembro()) throw new Error('No estás en la comunidad');
      const m = tabla('comunidad_miembros').find((x) => x.perfil_id === uid && !x.salido_en);
      if (args.p_nombre != null) {
        const v = limpiarNombre(args.p_nombre);
        if (v !== m.nombre) {
          if (m.nombre_cambiado_en && Date.parse(m.nombre_cambiado_en) > Date.now() - 864e5) throw new Error('Ya has cambiado tu nombre hoy: podrás volver a hacerlo mañana');
          const problema = problemaNombre(v, m.atleta_id);
          if (problema) throw new Error(problema);
          Object.assign(m, { nombre: v, nombre_cambiado_en: ahora() });
        }
      }
      if (args.p_sin_ranking != null) m.sin_ranking = !!args.p_sin_ranking;
      return null;
    }
    if (nombre === 'comunidad_expulsar') {
      if (!esCoach()) throw new Error('Solo el coach puede sacar a alguien de la comunidad');
      const m = tabla('comunidad_miembros').find((x) => x.atleta_id === args.p_atleta);
      if (!m) throw new Error('Ese atleta no ha entrado en la comunidad');
      if (args.p_bloquear !== false) Object.assign(m, { salido_en: m.salido_en || ahora(), bloqueado: true, ver_entrenando: false });
      else m.bloqueado = false;
      // (como la 042: que el coach le saque termina sus parejas de racha)
      if (args.p_bloquear !== false) db.comunidad_companeros = tabla('comunidad_companeros').filter((c) => c.de !== m.perfil_id && c.para !== m.perfil_id);
      return null;
    }
    if (nombre === 'comunidad_moderar' || nombre === 'comunidad_moderar_comentario') {
      if (!esCoach()) throw new Error('Fijar u ocultar es cosa del coach');
      const x = nombre === 'comunidad_moderar' ? buscar('comunidad_posts', args.p_post) : buscar('comunidad_comentarios', args.p_comentario);
      if (!x) throw new Error('Ya no está');
      if (nombre === 'comunidad_moderar') {
        const nueva = { ...x, fijada: args.p_fijada ?? x.fijada, oculta: args.p_oculta ?? x.oculta };
        comprobarChecks('comunidad_posts', nueva);
        Object.assign(x, { fijada: nueva.fijada, oculta: nueva.oculta });
      } else if (args.p_oculto != null) x.oculto = !!args.p_oculto;
      return null;
    }
    if (nombre === 'comunidad_personas') {
      if (!veComunidad()) return [];
      return [
        ...tabla('perfiles').filter((p) => p.rol === 'coach').map((p) => ({ perfil_id: p.id, nombre: String(p.nombre || '').trim() || 'Coach', foto: p.foto || null, coach: true })),
        ...tabla('comunidad_miembros').filter(miembroVisto).map((m) => ({ perfil_id: m.perfil_id, nombre: m.nombre, foto: perfilDe(m.perfil_id)?.foto || null, coach: false })),
      ];
    }
    if (nombre === 'comunidad_reaccionar') {
      if (!veComunidad()) throw new Error('Para reaccionar tienes que estar en la comunidad');
      if (!postVisible(args.p_post)) throw new Error('Esa publicación ya no está');
      if (args.p_tipo != null && !REACCIONES_TODAS.some(([k]) => k === args.p_tipo)) throw new Error('Esa reacción no existe'); // (las seis de la 045)
      const ya = tabla('comunidad_reacciones').find((x) => x.post_id === args.p_post && x.autor_id === uid);
      if (args.p_tipo == null || ya?.tipo === args.p_tipo) { db.comunidad_reacciones = tabla('comunidad_reacciones').filter((x) => x !== ya); return null; }
      if (ya) Object.assign(ya, { tipo: args.p_tipo, creado_en: ahora() });
      else tabla('comunidad_reacciones').push({ post_id: args.p_post, autor_id: uid, atleta_id: coach ? null : yo?.id || null, tipo: args.p_tipo, creado_en: ahora() });
      return args.p_tipo;
    }
    if (nombre === 'comunidad_avisar_coach') {
      if (!soyMiembro()) throw new Error('Para avisar al coach tienes que estar en la comunidad');
      let c = null, x = null;
      if (args.p_comentario) {
        c = buscar('comunidad_comentarios', args.p_comentario);
        if (!c || !VISIBLE.comunidad_comentarios(c)) throw new Error('Ese comentario ya no está');
        x = buscar('comunidad_posts', c.post_id);
      } else {
        x = args.p_post && buscar('comunidad_posts', args.p_post);
        if (!x || !postVisible(x.id)) throw new Error('Esa publicación ya no está');
      }
      const motivo = String(args.p_motivo || '').trim() || null;
      if (motivo && motivo.length > 300) throw new Error('El motivo, hasta 300 letras');
      const ya = tabla('comunidad_reportes').find((r) => r.autor_id === uid && r.post_id === x.id && (r.comentario_id || null) === (args.p_comentario || null) && !r.resuelto_en);
      if (ya) return ya.id;
      gastarCupo('reporte');
      const de = c || x;
      const r = {
        id: uuid(), post_id: x.id, comentario_id: c?.id || null, autor_id: uid, motivo, creado_en: ahora(), resuelto_en: null, de_comentario: !!c,
        copia_tipo: c ? 'comentario' : x.tipo, copia_texto: c ? c.texto : x.tipo === 'entreno' ? ['Entreno compartido', x.resumen?.nombre, x.texto].filter(Boolean).join(': ')
          : x.tipo === 'logro' ? ['Logro', x.resumen?.titulo, x.texto].filter(Boolean).join(': ') : x.texto,
        copia_foto: c ? null : x.foto_ruta, copia_fotos: c ? null : x.fotos || null, copia_autor_id: de.autor_id, copia_autor_nombre: nombreDe(de.autor_id), copia_atleta_id: de.atleta_id, copia_creado_en: de.creado_en,
      };
      tabla('comunidad_reportes').push(r);
      return r.id;
    }
    if (nombre === 'comunidad_retos_progreso') {
      if (!veComunidad()) return [];
      const ms = tabla('comunidad_miembros').filter((m) => miembroVisto(m) && (!m.sin_ranking || m.perfil_id === uid));
      // (como la 042: lo que cuenta cada reto; en uno de cardio, solo quien cuenta sus minutos; por equipos, los de algún equipo)
      return tabla('comunidad_retos').flatMap((r) => ms.filter((m) => m.perfil_id === uid || (((r.medida || 'sesiones') !== 'cardio' || m.cardio_en_retos) && (r.modo !== 'equipos' || equipoDe(r, m.atleta_id) != null)))
        .map((m) => ({ reto_id: r.id, perfil_id: m.perfil_id, nombre: m.nombre, objetivo: r.objetivo, yo: m.perfil_id === uid, hechas: valorReto(r, m.atleta_id) })));
    }
    // Como la 042: los equipos de los retos por equipos, repartirlos, las sesiones recientes y los minutos de cardio
    if (nombre === 'comunidad_retos_equipos') {
      if (!uid || !veComunidad()) return [];
      return tabla('comunidad_retos').filter((r) => r.modo === 'equipos').flatMap((r) => [0, 1].map((e) => ({
        reto_id: r.id, equipo: e, nombre: r.equipos?.[e] || null, total: totalEquipo(r, e),
        personas: dentroTodos().filter((m) => equipoDe(r, m.atleta_id) === e && (esCoach() || !m.sin_ranking || m.perfil_id === uid))
          .sort((a, b2) => a.nombre.localeCompare(b2.nombre)).map((m) => m.perfil_id),
      })));
    }
    if (nombre === 'comunidad_reto_equipos_guardar') {
      if (!esCoach()) throw new Error('Solo el coach reparte los equipos');
      const r = buscar('comunidad_retos', args.p_reto);
      if (!r || r.modo !== 'equipos') throw new Error('Ese reto no es por equipos');
      const a = args.p_equipo_a || [], b2 = args.p_equipo_b || [];
      if (a.some((x) => b2.includes(x))) throw new Error('Una persona no puede estar en los dos equipos');
      db.comunidad_reto_equipos = tabla('comunidad_reto_equipos').filter((x) => x.reto_id !== r.id);
      const filas = [[a, 0], [b2, 1]].flatMap(([lista, equipo]) => dentroTodos().filter((m) => lista.includes(m.perfil_id)).map((m) => ({ reto_id: r.id, atleta_id: m.atleta_id, perfil_id: m.perfil_id, equipo })));
      tabla('comunidad_reto_equipos').push(...filas);
      return filas.length;
    }
    if (nombre === 'comunidad_sesiones_recientes') {
      if (!esCoach()) return [];
      const desde = sumar(fechaMadrid(), -27);
      return dentroTodos().map((m) => ({ perfil_id: m.perfil_id, nombre: m.nombre, sesiones: hechasEntre(m.atleta_id, desde, fechaMadrid()) })).sort((a, b2) => a.nombre.localeCompare(b2.nombre));
    }
    if (nombre === 'comunidad_cardio_en_retos') {
      if (!soyMiembro()) throw new Error('No estás en la comunidad');
      tabla('comunidad_miembros').find((x) => x.perfil_id === uid).cardio_en_retos = !!args.p_contar;
      return !!args.p_contar;
    }
    // Como la 042: compañeros de racha
    if (nombre === 'comunidad_invitar_companero') {
      if (!uid || !soyMiembro()) throw new Error('Para tener compañeros de racha tienes que estar en la comunidad');
      if (!args.p_perfil || args.p_perfil === uid) throw new Error('Tu compañero de racha tiene que ser otra persona del equipo');
      const m = dentroTodos().find((x) => x.perfil_id === args.p_perfil);
      if (!m) throw new Error('Esa persona ya no está en el equipo');
      if (tabla('comunidad_companeros').some((c) => (c.de === uid && c.para === m.perfil_id) || (c.para === uid && c.de === m.perfil_id))) throw new Error('Ya sois compañeros de racha (o hay una invitación pendiente)');
      if (companerosOcupados(uid) >= 3) throw new Error('Puedes tener hasta 3 compañeros de racha (contando las invitaciones que has mandado)');
      if (companerosOcupados(m.perfil_id) >= 3) throw new Error('Esa persona ya tiene 3 compañeros de racha');
      gastarCupo('animo');
      const c = { id: uuid(), de: uid, para: m.perfil_id, de_atleta_id: yo?.id || null, para_atleta_id: m.atleta_id, estado: 'pendiente', creado_en: ahora(), aceptado_en: null };
      tabla('comunidad_companeros').push(c);
      return c.id;
    }
    if (nombre === 'comunidad_responder_companero') {
      if (!uid || !soyMiembro()) throw new Error('Para tener compañeros de racha tienes que estar en la comunidad');
      const c = tabla('comunidad_companeros').find((x) => x.id === args.p_id && x.para === uid && x.estado === 'pendiente' && esMiembro(x.de));
      if (!c) throw new Error('Esa invitación ya no está');
      if (!args.p_aceptar) { db.comunidad_companeros = tabla('comunidad_companeros').filter((x) => x !== c); return false; }
      if (companerosOcupados(uid) >= 3) throw new Error('Ya tienes 3 compañeros de racha: termina con alguno antes de aceptar');
      if (companerosOcupados(c.de) > 3) throw new Error('Esa persona ya tiene 3 compañeros de racha');
      Object.assign(c, { estado: 'aceptada', aceptado_en: ahora() });
      return true;
    }
    if (nombre === 'comunidad_dejar_companero') {
      if (!uid) throw new Error('Necesitas iniciar sesión');
      const c = tabla('comunidad_companeros').find((x) => x.id === args.p_id && (x.de === uid || x.para === uid));
      if (!c) throw new Error('Esa pareja ya no está');
      db.comunidad_companeros = tabla('comunidad_companeros').filter((x) => x !== c);
      return null;
    }
    if (nombre === 'comunidad_companeros') {
      if (!uid || !veComunidad()) return [];
      const quien = args.p_perfil || uid;
      const y = dentroTodos().find((x) => x.perfil_id === quien);
      if (!y) return [];
      return tabla('comunidad_companeros').filter((c) => c.de === quien || c.para === quien).flatMap((c) => {
        const o = dentroTodos().find((x) => x.perfil_id === otroDe(c, quien));
        const mia = c.de === uid || c.para === uid;
        if (!o || (c.estado !== 'aceptada' && !mia) || !(esCoach() || mia || (!y.sin_ranking && !o.sin_ranking))) return [];
        const ok = c.estado === 'aceptada';
        return [{ id: c.id, perfil_id: o.perfil_id, nombre: o.nombre, foto: perfilDe(o.perfil_id)?.foto || null, estado: c.estado, invito: c.de === quien,
          racha: ok ? rachasPareja(y.atleta_id, o.atleta_id, fechaMadrid(new Date(c.aceptado_en))).racha : null,
          mi_semana: ok && (esCoach() || mia) ? semanaCompleta(y.atleta_id) : null, su_semana: ok && (esCoach() || mia) ? semanaCompleta(o.atleta_id) : null, creado_en: c.creado_en }];
      }).sort((a, b2) => a.estado.localeCompare(b2.estado) || a.nombre.localeCompare(b2.nombre));
    }
    if (nombre === 'comunidad_insignias') {
      if (!uid || !veComunidad()) return [];
      return dentroTodos().filter((m) => !args.p_perfil || m.perfil_id === args.p_perfil).flatMap((m) => insigniasDe(m)
        .filter(([, v, meta]) => esCoach() || m.perfil_id === uid || (!m.sin_ranking && v >= meta))
        .map(([clave, v, meta]) => ({ perfil_id: m.perfil_id, clave, valor: Math.min(v, meta), meta })));
    }
    // Como la 029: el total del equipo en cada reto (sin quien no sale en el ranking)
    if (nombre === 'comunidad_retos_totales') {
      if (!veComunidad()) return [];
      return tabla('comunidad_retos').map((r) => ({ reto_id: r.id, modo: r.modo || 'individual', total: totalReto(r) }));
    }
    // Como la 043: guardar, buscar, la mejor respuesta y las preguntas frecuentes
    if (nombre === 'comunidad_guardar') {
      if (!uid || !veComunidad()) throw new Error('Para guardar publicaciones tienes que estar en la comunidad');
      if (args.p_guardar === false) { db.comunidad_guardados = tabla('comunidad_guardados').filter((x) => !(x.perfil_id === uid && x.post_id === args.p_post)); return false; }
      if (!postVisible(args.p_post)) throw new Error('Esa publicación ya no está');
      if (!tabla('comunidad_guardados').some((x) => x.perfil_id === uid && x.post_id === args.p_post)) tabla('comunidad_guardados').push({ perfil_id: uid, post_id: args.p_post, creado_en: ahora() });
      return true;
    }
    if (nombre === 'comunidad_buscar') {
      const t = String(args.p_texto ?? '').trim();
      if (!uid || !veComunidad() || t.length < 2 || t.length > 100) return [];
      const q = normal(t);
      return tabla('comunidad_posts').filter((x) => postVisible(x.id) && (!args.p_antes || x.creado_en < args.p_antes)
        && normal([x.texto, x.resumen?.nombre, x.resumen?.titulo, nombreDe(x.autor_id)].filter(Boolean).join(' ')).includes(q))
        .sort((a, b2) => (a.creado_en < b2.creado_en ? 1 : -1)).slice(0, Math.min(101, Math.max(1, Number(args.p_limite) || 20))).map((x) => ({ id: x.id, creado_en: x.creado_en }));
    }
    if (nombre === 'comunidad_mejor_respuesta') {
      if (!uid) throw new Error('Necesitas iniciar sesión');
      const x = postVisible(args.p_post) ? buscar('comunidad_posts', args.p_post) : null;
      if (!x) throw new Error('Esa publicación ya no está');
      if (!(coach || (x.autor_id === uid && soyMiembro()))) throw new Error('La mejor respuesta la elige quien ha publicado (o el coach)');
      if (args.p_comentario) {
        const k = buscar('comunidad_comentarios', args.p_comentario);
        if (!k || k.post_id !== x.id || k.oculto || !comentarioEquipoVisible(k.id)) throw new Error('Ese comentario ya no está');
        if (k.autor_id === x.autor_id) throw new Error('La mejor respuesta tiene que ser de otra persona');
      }
      x.mejor_comentario = args.p_comentario || null;
      return x.mejor_comentario;
    }
    if (nombre === 'comunidad_guardar_pregunta') {
      if (!coach) throw new Error('Las preguntas frecuentes las guarda el coach');
      const x = buscar('comunidad_posts', args.p_post);
      if (!x) throw new Error('Esa publicación ya no está');
      if (x.tema !== 'pregunta') throw new Error('Solo las preguntas para el coach se guardan como preguntas frecuentes');
      const k = buscar('comunidad_comentarios', args.p_comentario);
      if (!k || k.post_id !== x.id || perfilDe(k.autor_id)?.rol !== 'coach') throw new Error('La respuesta tiene que ser un comentario tuyo en esa pregunta');
      const pregunta = String(args.p_pregunta ?? '').trim() || x.texto, respuesta = String(args.p_respuesta ?? '').trim() || k.texto;
      if (!pregunta || !textoCorto(pregunta, 2000)) throw new Error('Escribe la pregunta (hasta 2000 letras)');
      if (!textoCorto(respuesta, 2000)) throw new Error('Escribe la respuesta (hasta 2000 letras)');
      let q = tabla('comunidad_preguntas').find((y) => y.post_id === x.id);
      if (q) Object.assign(q, { comentario_id: k.id, pregunta, respuesta, actualizado_en: ahora() });
      else { q = { id: uuid(), post_id: x.id, comentario_id: k.id, pregunta, respuesta, creado_en: ahora(), actualizado_en: ahora() }; tabla('comunidad_preguntas').push(q); }
      x.mejor_comentario = k.id;
      return q.id;
    }
    // Como la 044: eventos, lo programado, el atleta de la semana, la moderación y el panel
    if (nombre === 'comunidad_evento_responder') {
      if (!uid || !soyMiembro()) throw new Error('Para apuntarte tienes que estar en la comunidad');
      const e = buscar('comunidad_eventos', args.p_evento);
      if (!e) throw new Error('Ese evento ya no está');
      if (e.cancelado_en) throw new Error('Ese evento está cancelado');
      if (Date.parse(e.empieza_en) <= Date.now()) throw new Error('Ese evento ya ha empezado');
      const resto = tabla('comunidad_evento_asistentes').filter((x) => !(x.evento_id === e.id && x.perfil_id === uid));
      if (args.p_va == null) { db.comunidad_evento_asistentes = resto; return null; }
      if (args.p_va && e.plazas != null && resto.filter((x) => x.evento_id === e.id && x.va && esMiembro(x.perfil_id)).length >= e.plazas) throw new Error('No quedan plazas');
      db.comunidad_evento_asistentes = [...resto, { evento_id: e.id, perfil_id: uid, atleta_id: yo?.id || null, va: !!args.p_va, creado_en: ahora() }];
      return !!args.p_va;
    }
    if (nombre === 'comunidad_programado_cambiar') {
      if (!coach) throw new Error('Lo programado lo cambia el coach');
      const x = buscar('comunidad_posts', args.p_post);
      if (!x) throw new Error('Esa publicación ya no está');
      if (!x.publicar_en || Date.parse(x.publicar_en) <= Date.now()) throw new Error('Ya se ha publicado: no se puede cambiar');
      const texto = String(args.p_texto ?? '').trim() || x.texto;
      let cuando = args.p_publicar_en && Date.parse(args.p_publicar_en) > Date.now() + 30000 ? new Date(Date.parse(args.p_publicar_en)).toISOString() : ahora();
      if (Date.parse(cuando) > Date.now() + 90 * 864e5) throw new Error('Como mucho a 90 días vista');
      if (x.tipo === 'encuesta' && x.encuesta?.cierre && Date.parse(x.encuesta.cierre) <= Date.parse(cuando) + 5 * 60000) throw new Error('El cierre de la encuesta, después de publicarla');
      comprobarChecks('comunidad_posts', { ...x, texto });
      Object.assign(x, { texto, publicar_en: cuando, creado_en: cuando });
      return cuando;
    }
    if (nombre === 'comunidad_destacar') {
      if (!coach) throw new Error('El atleta de la semana lo elige el coach');
      const motivo = String(args.p_motivo ?? '').replace(/\s+/g, ' ').trim();
      if (!motivo || motivo.length > MAX_MOTIVO_DESTACADO || !textoVisible(motivo)) throw new Error('Escribe por qué, en una línea (hasta 140 letras)');
      const m = dentroTodos().find((x) => x.perfil_id === args.p_perfil);
      if (!m) throw new Error('Esa persona no está en la comunidad');
      if (m.sin_ranking) throw new Error('Ha elegido no salir en el ranking: elige a otra persona');
      for (const d of tabla('comunidad_destacados')) if (Date.parse(d.hasta) > Date.now()) d.hasta = new Date(Math.max(Date.parse(d.desde), Date.now())).toISOString();
      const d = { id: uuid(), perfil_id: m.perfil_id, atleta_id: m.atleta_id, motivo, desde: ahora(), hasta: new Date(Date.now() + 7 * 864e5).toISOString(), creado_en: ahora() };
      tabla('comunidad_destacados').push(d);
      return d.id;
    }
    if (nombre === 'comunidad_destacado_quitar') {
      if (!coach) throw new Error('El atleta de la semana lo elige el coach');
      for (const d of tabla('comunidad_destacados')) if (Date.parse(d.hasta) > Date.now()) d.hasta = new Date(Math.max(Date.parse(d.desde), Date.now())).toISOString();
      return null;
    }
    if (nombre === 'comunidad_silenciar') {
      if (!coach) throw new Error('Silenciar es cosa del coach');
      const m = tabla('comunidad_miembros').find((x) => x.perfil_id === args.p_perfil);
      if (!m) throw new Error('Esa persona no ha entrado en la comunidad');
      const h = Number(args.p_horas) || 0;
      m.silenciado_hasta = h > 0 ? new Date(Date.now() + Math.min(h, 24 * 30) * 3600e3).toISOString() : null;
      return m.silenciado_hasta;
    }
    if (nombre === 'comunidad_moderacion_guardar') {
      if (!coach) throw new Error('La moderación es cosa del coach');
      const palabras = palabrasDeTexto((args.p_palabras || []).join('\n'));
      if (palabras.length > 100) throw new Error('Hasta 100 palabras, de 2 a 40 letras cada una');
      const lento = Number(args.p_lento) || 0;
      if (lento < 0 || lento > 1440) throw new Error('El modo lento, de 0 a 1440 minutos');
      let m = tabla('comunidad_moderacion').find((x) => x.id === true);
      if (!m) { m = { id: true }; tabla('comunidad_moderacion').push(m); }
      Object.assign(m, { palabras, lento_min: lento, actualizado_en: ahora() });
      return null;
    }
    if (nombre === 'comunidad_aprobar') {
      if (!coach) throw new Error('Aprobar es cosa del coach');
      const x = args.p_comentario ? buscar('comunidad_comentarios', args.p_comentario) : buscar('comunidad_posts', args.p_post);
      if (!x) throw new Error('Ya no está');
      if (args.p_comentario) x.retenido = false; else x.retenida = false;
      return null;
    }
    if (nombre === 'comunidad_panel') {
      if (!coach) throw new Error('El panel de la comunidad es del coach');
      const lunes = lunesHoy();
      const desde = Date.now() - 35 * 864e5;
      const act = [...tabla('comunidad_posts').filter((x) => x.atleta_id && x.tipo !== 'aniversario').map((x) => [x.autor_id, x.creado_en, 'p']),
        ...tabla('comunidad_comentarios').filter((x) => x.atleta_id).map((x) => [x.autor_id, x.creado_en, 'c']),
        ...tabla('comunidad_reacciones').filter((x) => x.atleta_id).map((x) => [x.autor_id, x.creado_en, 'r'])]
        .filter(([, c]) => Date.parse(c) >= desde && Date.parse(c) <= Date.now());
      const enSemana = (l) => act.filter(([, c]) => { const d = fechaMadrid(new Date(c)); return d >= l && d <= sumar(l, 6); });
      const dentro = dentroTodos();
      const ultimaDe = (pid) => [...tabla('comunidad_posts').filter((x) => x.tipo !== 'aniversario'), ...tabla('comunidad_comentarios'), ...tabla('comunidad_reacciones')].filter((x) => x.autor_id === pid).map((x) => x.creado_en).sort().at(-1) || null;
      const hace28 = Date.now() - 28 * 864e5, hace30 = Date.now() - 30 * 864e5;
      return {
        semanas: [3, 2, 1, 0].map((i) => { const l = sumar(lunes, -7 * i); const a = enSemana(l); return { lunes: l, activos: new Set(a.map(([pid]) => pid)).size, publicaciones: a.filter((x) => x[2] === 'p').length, reacciones: a.filter((x) => x[2] === 'r').length, comentarios: a.filter((x) => x[2] === 'c').length }; }),
        miembros: dentro.length,
        nunca: tabla('atletas').filter((a) => a.perfil_id && a.estado !== 'baja' && perfilDe(a.perfil_id)?.rol !== 'coach' && !tabla('comunidad_miembros').some((m) => m.atleta_id === a.id))
          .map((a) => ({ atleta_id: a.id, nombre: a.nombre })).sort((a, b2) => a.nombre.localeCompare(b2.nombre)),
        inactivos: dentro.filter((m) => !(ultimaDe(m.perfil_id) && Date.parse(ultimaDe(m.perfil_id)) > hace30))
          .map((m) => ({ perfil_id: m.perfil_id, nombre: m.nombre, sin_ranking: !!m.sin_ranking, ultima: ultimaDe(m.perfil_id) })).sort((a, b2) => a.nombre.localeCompare(b2.nombre)),
        reportes: tabla('comunidad_reportes').filter((r) => !r.resuelto_en).length,
        retenidos: tabla('comunidad_posts').filter((x) => x.retenida).length + tabla('comunidad_comentarios').filter((x) => x.retenido).length,
        activos: dentro.map((m) => { const a = act.filter(([pid, c]) => pid === m.perfil_id && Date.parse(c) > hace28); const n = (k) => a.filter((x) => x[2] === k).length;
          return { perfil_id: m.perfil_id, nombre: m.nombre, sin_ranking: !!m.sin_ranking, publicaciones: n('p'), comentarios: n('c'), reacciones: n('r'), total: a.length }; })
          .filter((x) => x.total > 0).sort((a, b2) => b2.total - a.total || a.nombre.localeCompare(b2.nombre)).slice(0, 5),
      };
    }
    // Como la 045: «<Mes> en el equipo» (solo recuentos; sin quien no sale en el ranking ni quien ya no está; lo oculto, lo retenido y
    // lo programado no cuenta) y los hitos del equipo
    if (nombre === 'comunidad_mes_equipo') {
      if (!uid || !veComunidad()) return null;
      const hoy = fechaMadrid();
      const dia = args.p_mes || sumar(hoy, -Number(hoy.slice(8, 10)));
      const desde = `${dia.slice(0, 7)}-01`, hasta = ultimoDia(dia.slice(0, 7));
      if (desde > hoy) return null;
      const cuentan = dentroTodos().filter((m) => !m.sin_ranking);
      const enMes = (iso) => { const d = fechaMadrid(new Date(iso)); return d >= desde && d <= hasta; };
      const sigue = (pid) => perfilDe(pid)?.rol === 'coach' || dentroTodos().some((m) => m.perfil_id === pid);
      const cuenta = (pid) => perfilDe(pid)?.rol === 'coach' || cuentan.some((m) => m.perfil_id === pid);
      const aLaVista = (x) => !!x && !x.oculta && !x.retenida && (!x.publicar_en || Date.parse(x.publicar_en) <= Date.now());
      const recordsDe = (ps) => tabla('comunidad_posts').filter((x) => x.tipo === 'entreno' && aLaVista(x) && ps.has(x.autor_id) && enMes(x.creado_en))
        .reduce((a, x) => a + (x.resumen?.ejercicios || []).filter((e) => e.record).length, 0);
      const reac = tabla('comunidad_reacciones').filter((r) => { const x = buscar('comunidad_posts', r.post_id); return enMes(r.creado_en) && aLaVista(x) && cuenta(r.autor_id) && cuenta(x.autor_id); });
      const mio = coach ? null : dentroTodos().find((m) => m.perfil_id === uid);
      return {
        mes: desde.slice(0, 7),
        equipo: {
          sesiones: cuentan.reduce((a, m) => a + hechasEntre(m.atleta_id, desde, hasta), 0),
          semanas_completas: cuentan.reduce((a, m) => a + semanasDe(m.atleta_id).filter((x) => x.lunes >= desde && x.lunes <= hasta && x.hechas >= x.previstas).length, 0),
          records: recordsDe(new Set(cuentan.map((m) => m.perfil_id))),
          retos: tabla('comunidad_retos').filter((r) => r.hasta >= desde && r.hasta <= hasta && cuentan.some((m) => retoConseguido(r, m.atleta_id))).length,
          reaccion: reaccionMasUsada(reac.map((r) => r.tipo)),
          racha: Math.max(0, ...cuentan.map((m) => rachaDe(m.atleta_id).racha)),
          miembros: cuentan.length,
        },
        yo: mio ? {
          sesiones: hechasEntre(mio.atleta_id, desde, hasta), records: recordsDe(new Set([uid])), racha: rachaDe(mio.atleta_id).racha,
          animos_dados: tabla('comunidad_animos').filter((a) => a.de === uid && enMes(a.creado_en) && sigue(a.para)).length,
          animos_recibidos: tabla('comunidad_animos').filter((a) => a.para === uid && enMes(a.creado_en) && sigue(a.de)).length,
        } : null,
      };
    }
    if (nombre === 'comunidad_hitos') {
      if (!uid || !veComunidad()) return [];
      const hoy = fechaMadrid();
      const desde = tabla('comunidad_miembros').map((m) => fechaMadrid(new Date(m.creado_en))).sort()[0] || hoy;
      const cuentan = dentroTodos().filter((m) => !m.sin_ranking);
      const ps = new Set(cuentan.map((m) => m.perfil_id));
      const v = {
        sesiones: cuentan.reduce((a, m) => a + hechasEntre(m.atleta_id, desde, hoy), 0),
        records: tabla('comunidad_posts').filter((x) => x.tipo === 'entreno' && !x.oculta && !x.retenida && ps.has(x.autor_id) && fechaMadrid(new Date(x.creado_en)) >= desde)
          .reduce((a, x) => a + (x.resumen?.ejercicios || []).filter((e) => e.record).length, 0),
        retos: tabla('comunidad_retos').filter((r) => r.hasta >= desde && cuentan.some((m) => retoConseguido(r, m.atleta_id))).length,
      };
      return HITOS.map(([clave, medida, meta]) => ({ clave, medida, meta, valor: v[medida] }));
    }
    if (nombre === 'comunidad_version') return VERSION_COMUNIDAD;
    if (nombre === 'comunidad_rachas') {
      if (!veComunidad()) return [];
      return dentroTodos().filter((m) => esCoach() || !m.sin_ranking || m.perfil_id === uid)
        .map((m) => ({ perfil_id: m.perfil_id, nombre: m.nombre, ...rachaDe(m.atleta_id), yo: m.perfil_id === uid })).filter((x) => x.racha >= 1);
    }
    if (nombre === 'comunidad_resumen_semana') {
      if (!veComunidad()) return [];
      const l = lunesHoy(), dom = sumar(l, 6), hoy = fechaMadrid();
      const cuentan = dentroTodos().filter((m) => !m.sin_ranking);
      const perfiles = new Set(cuentan.map((m) => m.perfil_id));
      return [{
        sesiones: cuentan.reduce((a, m) => a + hechasEntre(m.atleta_id, l, dom), 0),
        semana_completa: cuentan.filter((m) => semanasDe(m.atleta_id).some((x) => x.lunes === l && x.hechas >= x.previstas)).length,
        miembros: cuentan.length,
        records: tabla('comunidad_posts').filter((x) => x.tipo === 'entreno' && !x.oculta && !x.retenida && perfiles.has(x.autor_id) && fechaMadrid(new Date(x.creado_en)) >= l && fechaMadrid(new Date(x.creado_en)) <= dom)
          .reduce((a, x) => a + (x.resumen?.ejercicios || []).filter((e) => e.record).length, 0),
        retos: tabla('comunidad_retos').filter((r) => hoy >= r.desde && hoy <= r.hasta).length,
      }];
    }
    if (nombre === 'comunidad_perfil') {
      if (!uid || !veComunidad()) return [];
      const p = perfilDe(args.p_perfil);
      if (p?.rol === 'coach') return [{ perfil_id: p.id, nombre: String(p.nombre || '').trim() || 'Coach', foto: p.foto || null, coach: true, desde: null, racha: null, retos: null, retos_titulos: null, entrenos: 0, yo: p.id === uid }];
      const m = dentroTodos().find((x) => x.perfil_id === args.p_perfil);
      if (!m) return [];
      const ver = esCoach() || !m.sin_ranking || m.perfil_id === uid;
      const conseguidos = tabla('comunidad_retos').filter((r) => retoConseguido(r, m.atleta_id)).sort((a, b2) => (a.hasta < b2.hasta ? 1 : a.hasta > b2.hasta ? -1 : a.titulo.localeCompare(b2.titulo)));
      return [{
        perfil_id: m.perfil_id, nombre: m.nombre, foto: p?.foto || null, coach: false, desde: m.creado_en,
        // (como la 029: sin racha ni retos sale igual que sin ranking, null)
        racha: ver ? rachaDe(m.atleta_id).racha || null : null, retos: ver ? conseguidos.length || null : null, retos_titulos: ver && conseguidos.length ? conseguidos.slice(0, 20).map((r) => r.titulo) : null,
        entrenos: tabla('comunidad_posts').filter((x) => x.autor_id === m.perfil_id && x.tipo === 'entreno' && (esCoach() || (!x.oculta && !x.retenida))).length, yo: m.perfil_id === uid,
      }];
    }
    if (nombre === 'comunidad_compartir_logro') {
      if (!uid || !soyMiembro()) throw new Error('Para compartir en el equipo tienes que estar en la comunidad');
      const r = buscar('comunidad_retos', args.p_reto);
      if (!r) throw new Error('Ese reto ya no está');
      if (!retoConseguido(r, yo.id)) throw new Error('Ese reto aún no está conseguido');
      if (tabla('comunidad_posts').some((x) => x.autor_id === uid && x.reto_id === r.id && x.tipo === 'logro')) throw new Error('Este logro ya está compartido en el equipo');
      gastarCupo('post');
      const modo = r.modo || 'individual';
      const post = {
        id: uuid(), autor_id: uid, atleta_id: yo.id, tipo: 'logro', texto: String(args.p_texto || '').trim() || null, foto_ruta: null, sesion_id: null, reto_id: r.id, menciones: [], encuesta: null,
        fijada: false, oculta: false, creado_en: ahora(), tema: 'logros', fotos: null, mejor_comentario: null, // (043: con su tema)
        // (como la 042: con lo que cuenta el reto y, por equipos, el total y el nombre de su equipo)
        resumen: { titulo: r.titulo, modo, medida: r.medida || 'sesiones', objetivo: r.objetivo, desde: r.desde, hasta: r.hasta,
          hechas: modo === 'equipo' ? totalReto(r) : modo === 'equipos' ? totalEquipo(r, equipoDe(r, yo.id)) : valorReto(r, yo.id),
          ...(modo === 'equipos' && equipoDe(r, yo.id) != null ? { equipo: r.equipos?.[equipoDe(r, yo.id)] } : {}) },
      };
      post.publicar_en = null;
      post.retenida = moderarEntrada(uid, false, post.texto); // (como la 044)
      comprobarChecks('comunidad_posts', post);
      tabla('comunidad_posts').push(post);
      return post.id;
    }
    if (nombre === 'comunidad_votar') {
      if (!uid || !soyMiembro()) throw new Error('Para votar tienes que estar en la comunidad');
      const x = buscar('comunidad_posts', args.p_post);
      if (!x || x.tipo !== 'encuesta' || !postVisible(x.id)) throw new Error('Esa encuesta ya no está');
      const op = args.p_opcion;
      if (!Number.isInteger(op) || op < 0 || op >= x.encuesta.opciones.length) throw new Error('Esa opción no existe');
      if (x.encuesta.cierre && Date.parse(x.encuesta.cierre) <= Date.now()) throw new Error('La encuesta ya está cerrada');
      const ya = tabla('comunidad_votos').find((v) => v.post_id === x.id && v.autor_id === uid);
      if (ya?.opcion === op) return op;
      gastarCupo('voto');
      if (ya) Object.assign(ya, { opcion: op, creado_en: ahora() });
      else tabla('comunidad_votos').push({ post_id: x.id, autor_id: uid, atleta_id: yo?.id || null, opcion: op, creado_en: ahora() });
      return op;
    }
    if (nombre === 'comunidad_animar') {
      if (!uid || !comunidadActiva() || !veComunidad()) throw new Error('Para animar tienes que estar en la comunidad (y abierta)');
      if (!args.p_perfil || args.p_perfil === uid) throw new Error('A ti no te puedes mandar ánimo (¡pero vas bien!)');
      const m = dentroTodos().find((x) => x.perfil_id === args.p_perfil);
      if (!m) throw new Error('Esa persona ya no está en el equipo');
      const semana = lunesHoy();
      if (tabla('comunidad_animos').some((a) => a.de === uid && a.para === args.p_perfil && a.semana === semana)) throw new Error('Ya le has mandado ánimo esta semana');
      gastarCupo('animo');
      tabla('comunidad_animos').push({ de: uid, para: args.p_perfil, atleta_id: coach ? null : yo?.id || null, para_atleta_id: m.atleta_id, semana, creado_en: ahora() });
      return semana;
    }
    // Como la 041: 💪 a comentarios, bienvenida a los nuevos y «entrenando ahora»
    if (nombre === 'comunidad_reaccionar_comentario') {
      if (!uid || !veComunidad()) throw new Error('Para reaccionar tienes que estar en la comunidad');
      if (!comentarioEquipoVisible(args.p_comentario)) throw new Error('Ese comentario ya no está');
      const ya = tabla('comunidad_comentario_reacciones').find((x) => x.comentario_id === args.p_comentario && x.autor_id === uid);
      if (ya) { db.comunidad_comentario_reacciones = tabla('comunidad_comentario_reacciones').filter((x) => x !== ya); return false; }
      tabla('comunidad_comentario_reacciones').push({ comentario_id: args.p_comentario, autor_id: uid, atleta_id: coach ? null : yo?.id || null, creado_en: ahora() });
      return true;
    }
    if (nombre === 'comunidad_nuevos') {
      if (!uid || !veComunidad()) return [];
      return dentroTodos().filter((m) => m.perfil_id !== uid && Date.parse(m.creado_en) > Date.now() - 7 * 864e5)
        .sort((a, b2) => Date.parse(b2.creado_en) - Date.parse(a.creado_en)).slice(0, 20)
        .map((m) => ({ perfil_id: m.perfil_id, nombre: m.nombre, foto: perfilDe(m.perfil_id)?.foto || null, desde: m.creado_en,
          bienvenida: tabla('comunidad_bienvenidas').some((x) => x.de === uid && x.para === m.perfil_id) }));
    }
    if (nombre === 'comunidad_dar_bienvenida') {
      if (!uid || !comunidadActiva() || !veComunidad()) throw new Error('Para dar la bienvenida tienes que estar en la comunidad (y abierta)');
      if (!args.p_perfil || args.p_perfil === uid) throw new Error('A ti no te puedes dar la bienvenida');
      const m = dentroTodos().find((x) => x.perfil_id === args.p_perfil);
      if (!m) throw new Error('Esa persona ya no está en el equipo');
      if (Date.parse(m.creado_en) <= Date.now() - 7 * 864e5) throw new Error('La bienvenida se da en su primera semana en el equipo');
      if (tabla('comunidad_bienvenidas').some((x) => x.de === uid && x.para === args.p_perfil)) throw new Error('Ya le has dado la bienvenida');
      gastarCupo('animo');
      tabla('comunidad_bienvenidas').push({ de: uid, para: args.p_perfil, atleta_id: coach ? null : yo?.id || null, para_atleta_id: m.atleta_id, creado_en: ahora() });
      return null;
    }
    if (nombre === 'comunidad_entrenando_visible') {
      if (!soyMiembro()) throw new Error('No estás en la comunidad');
      const m = tabla('comunidad_miembros').find((x) => x.perfil_id === uid);
      m.ver_entrenando = !!args.p_visible;
      return !!args.p_visible;
    }
    if (nombre === 'comunidad_entrenando_ahora') {
      if (!uid || !veComunidad()) return [];
      const desde = Date.now() - 20 * 60000, hasta = Date.now() + 60000;
      return dentroTodos().filter((m) => m.ver_entrenando && m.perfil_id !== uid && tabla('series').some((x) => {
        if (x.atleta_id !== m.atleta_id) return false;
        const t = Date.parse(x.registrada_en);
        if (!(t > desde && t <= hasta)) return false;
        const se = buscar('sesion_ejercicios', x.sesion_ejercicio_id);
        const s = se && buscar('sesiones', se.sesion_id);
        return !!s && !s.completada;
      })).sort((a, b2) => a.nombre.localeCompare(b2.nombre)).slice(0, 30).map((m) => ({ perfil_id: m.perfil_id, nombre: m.nombre, foto: perfilDe(m.perfil_id)?.foto || null }));
    }
    if (nombre === 'comunidad_ranking') {
      if (!veComunidad()) return [];
      const lunes = lunesHoy();
      const out = [];
      for (const m of tabla('comunidad_miembros').filter((x) => miembroVisto(x) && (!x.sin_ranking || x.perfil_id === uid))) {
        const bl = tabla('bloques').filter((x) => x.atleta_id === m.atleta_id && !x.es_plantilla && x.estado !== 'cancelado')
          .sort((x, y) => String(y.fecha_inicio || '').localeCompare(String(x.fecha_inicio || '')) || (y.numero || 0) - (x.numero || 0));
        let w = null;
        for (const x of bl) { w = tabla('semanas').find((s2) => s2.bloque_id === x.id && s2.programacion === 'programada' && s2.fecha_inicio === lunes); if (w) break; }
        const ss = w ? tabla('sesiones').filter((x) => x.semana_id === w.id) : [];
        // (como la 029: solo las sesiones que cuentan)
        if (ss.length) out.push({ perfil_id: m.perfil_id, nombre: m.nombre, hechas: sesionesValidas(m.atleta_id).filter((x) => x.semana_id === w.id).length, previstas: ss.length, yo: m.perfil_id === uid });
      }
      return out;
    }
    if (nombre === 'comunidad_mis_datos') {
      if (!uid) return null;
      const m = tabla('comunidad_miembros').find((x) => x.perfil_id === uid);
      return {
        miembro: m ? (({ perfil_id, ...resto }) => resto)(m) : null,
        // (como la 029: de las menciones, cuántas)
        publicaciones: tabla('comunidad_posts').filter((x) => x.autor_id === uid).map((x) => ({ ...x, menciones: (x.menciones || []).length })),
        comentarios: tabla('comunidad_comentarios').filter((x) => x.autor_id === uid).map((x) => ({ ...x, menciones: (x.menciones || []).length })),
        reacciones: tabla('comunidad_reacciones').filter((x) => x.autor_id === uid),
        votos: tabla('comunidad_votos').filter((x) => x.autor_id === uid),
        animos_mandados: tabla('comunidad_animos').filter((x) => x.de === uid).map((a) => (esMiembro(a.para)
          ? { para: a.para, para_nombre: nombreDe(a.para), semana: a.semana, creado_en: a.creado_en } : { para_nombre: 'Alguien del equipo', semana: a.semana, creado_en: a.creado_en })),
        animos_recibidos: tabla('comunidad_animos').filter((x) => x.para === uid).map((a) => ({ semana: a.semana, creado_en: a.creado_en })),
        // (como la 041)
        reacciones_comentarios: tabla('comunidad_comentario_reacciones').filter((x) => x.autor_id === uid).map((r) => ({ comentario_id: r.comentario_id, creado_en: r.creado_en })),
        // (como la 042: sus compañeros de racha, con quién solo si sigue dentro)
        companeros: tabla('comunidad_companeros').filter((c) => c.de === uid || c.para === uid).map((c) => ({ con: esMiembro(otroDe(c, uid)) ? nombreDe(otroDe(c, uid)) : 'Alguien del equipo',
          estado: c.estado, invitaste: c.de === uid, creado_en: c.creado_en, aceptado_en: c.aceptado_en })),
        bienvenidas_dadas: tabla('comunidad_bienvenidas').filter((x) => x.de === uid).map((b2) => (esMiembro(b2.para)
          ? { para: b2.para, para_nombre: nombreDe(b2.para), creado_en: b2.creado_en } : { para_nombre: 'Alguien del equipo', creado_en: b2.creado_en })),
        bienvenidas_recibidas: tabla('comunidad_bienvenidas').filter((x) => x.para === uid).map((b2) => ({ creado_en: b2.creado_en })),
        // (como la 043: lo que ha guardado y las preguntas frecuentes que salen de sus preguntas)
        guardados: tabla('comunidad_guardados').filter((x) => x.perfil_id === uid).map((g) => ({ post_id: g.post_id, creado_en: g.creado_en })),
        preguntas_frecuentes: tabla('comunidad_preguntas').filter((q) => buscar('comunidad_posts', q.post_id)?.autor_id === uid).map((q) => ({ post_id: q.post_id, pregunta: q.pregunta, respuesta: q.respuesta, creado_en: q.creado_en })),
        // (como la 044: sus respuestas a los eventos y las veces que ha sido atleta de la semana)
        eventos: tabla('comunidad_evento_asistentes').filter((x) => x.perfil_id === uid).map((a) => ({ evento: buscar('comunidad_eventos', a.evento_id)?.titulo || null, empieza_en: buscar('comunidad_eventos', a.evento_id)?.empieza_en || null, va: a.va, creado_en: a.creado_en })),
        atleta_de_la_semana: tabla('comunidad_destacados').filter((d) => d.perfil_id === uid).map((d) => ({ motivo: d.motivo, desde: d.desde, hasta: d.hasta })),
        avisos_al_coach: tabla('comunidad_reportes').filter((x) => x.autor_id === uid).map((r) => ({ id: r.id, post_id: r.post_id, comentario_id: r.comentario_id, motivo: r.motivo, creado_en: r.creado_en, resuelto_en: r.resuelto_en })),
      };
    }
    if (nombre === 'comunidad_compartir_sesion') {
      if (!uid || !soyMiembro()) throw new Error('Para compartir en el equipo tienes que estar en la comunidad');
      const s = buscar('sesiones', args.p_sesion);
      const w = s && buscar('semanas', s.semana_id);
      const bl = w && buscar('bloques', w.bloque_id);
      if (!s || !bl || bl.es_plantilla || bl.atleta_id !== yo?.id || w.programacion !== 'programada') throw new Error('Esa sesión no es tuya');
      if (!s.completada) throw new Error('Solo se comparte una sesión terminada');
      if (tabla('comunidad_posts').some((x) => x.sesion_id === s.id)) throw new Error('Esta sesión ya está compartida en el equipo');
      gastarCupo('post');
      const kilos = !!args.p_kilos;
      const pautaDe = (id) => buscar('sesion_ejercicios', id);
      const todas = tabla('series').filter((x) => x.atleta_id === yo.id && Number(x.reps) > 0 && pautaDe(x.sesion_ejercicio_id))
        .map((x) => { const p = pautaDe(x.sesion_ejercicio_id); return { ...x, ejercicio_id: x.sustituto_id || p.ejercicio_id, sesion_id: p.sesion_id, orden: p.orden, e1rm: e1rmBase(x) }; });
      const hechas = todas.filter((x) => x.sesion_id === s.id);
      const inicio = tabla('series').filter((x) => x.atleta_id === yo.id && pautaDe(x.sesion_ejercicio_id)?.sesion_id === s.id).map((x) => x.registrada_en).sort()[0] || ahora();
      const previas = todas.filter((x) => x.sesion_id !== s.id && x.registrada_en < inicio);
      const porEj = new Map();
      for (const x of hechas) {
        const ya = porEj.get(x.ejercicio_id);
        const mejor = !ya || (x.e1rm ?? -1) > (ya.e1rm ?? -1) || ((x.e1rm ?? -1) === (ya.e1rm ?? -1) && (Number(x.kg) || 0) > (Number(ya.kg) || 0)) || ((x.e1rm ?? -1) === (ya.e1rm ?? -1) && (Number(x.kg) || 0) === (Number(ya.kg) || 0) && x.reps > ya.reps);
        porEj.set(x.ejercicio_id, { ...(mejor ? x : ya), orden: Math.min(x.orden, ya?.orden ?? x.orden) });
      }
      const esRecord = (x) => {
        const hoy = hechas.filter((y) => y.ejercicio_id === x.ejercicio_id);
        const antes = previas.filter((y) => y.ejercicio_id === x.ejercicio_id);
        const maxE = (l) => l.reduce((m, y) => (y.e1rm != null && (m == null || y.e1rm > m) ? y.e1rm : m), null);
        const maxR = (l) => l.filter((y) => !(Number(y.kg) > 0)).reduce((m, y) => (m == null || y.reps > m ? y.reps : m), null);
        const eHoy = maxE(hoy), eAntes = maxE(antes);
        if (eHoy != null && eAntes != null && eHoy > eAntes) return true;
        const conCarga = hoy.some((y) => Number(y.kg) > 0);
        return !conCarga && maxR(antes) != null && maxR(hoy) > maxR(antes);
      };
      const nombreEj = (id) => buscar('ejercicios', id)?.nombre || 'Ejercicio';
      const ejercicios = [...porEj.values()].sort((a, b2) => a.orden - b2.orden || nombreEj(a.ejercicio_id).localeCompare(nombreEj(b2.ejercicio_id))).slice(0, 30).map((x) => {
        const record = esRecord(x);
        return { nombre: nombreEj(x.ejercicio_id).slice(0, 80), record, ...(kilos && Number(x.kg) > 0 ? { kg: Number(x.kg) } : {}), ...(kilos ? { reps: x.reps } : {}), ...(kilos && record && x.e1rm != null ? { e1rm: x.e1rm } : {}) };
      });
      const texto = String(args.p_texto || '').trim() || null;
      const post = {
        id: uuid(), autor_id: uid, atleta_id: yo.id, tipo: 'entreno', texto, foto_ruta: null, sesion_id: s.id, fijada: false, oculta: false, creado_en: ahora(), menciones: [], encuesta: null, reto_id: null, tema: null, fotos: null, mejor_comentario: null,
        resumen: { nombre: s.nombre, tipo: s.tipo, fecha: s.fecha_realizada || hoyISO(), ...(s.duracion_min != null ? { minutos: s.duracion_min } : {}), series: hechas.length, con_kilos: kilos, ejercicios },
      };
      post.publicar_en = null;
      post.retenida = moderarEntrada(uid, false, post.texto); // (como la 044)
      comprobarChecks('comunidad_posts', post);
      tabla('comunidad_posts').push(post);
      return post.id;
    }
    throw new Error(`Función no disponible en la demo: ${nombre}`);
  }

  // v0.54: «escribiendo…» y «en línea» en la demo, entre pestañas del mismo navegador (BroadcastChannel), con las
  // mismas reglas que las políticas de realtime.messages de la 032: solo el coach y ese atleta; la presencia, solo si
  // enseñas la tuya (y entonces ves la de los demás)
  const canales = new Set();
  function canalChat(atletaId, oyente = {}) {
    if (typeof BroadcastChannel === 'undefined' || !sesion) return null;
    const atleta = buscar('atletas', atletaId);
    if (!atleta || !(esCoach() || (atleta.perfil_id && atleta.perfil_id === sesion.user.id))) { oyente.alEstado?.(false); return null; }
    const yo = sesion.user.id;
    const visible = presenciaMiaVisible();
    // (revisión) Sin «Mostrar cuándo estoy en línea», ni «en línea» ni «escribiendo…»: el canal entero
    if (!visible) { setTimeout(() => oyente.alEstado?.(false), 0); return null; }
    const bc = new BroadcastChannel(`fbe-demo-chat:${atletaId}`);
    const vistos = new Map();
    const enLinea = () => visible && [...vistos.entries()].some(([id, t]) => id !== yo && Date.now() - t < 12000);
    const decir = (tipo, extra = {}) => { try { bc.postMessage({ tipo, de: yo, ...extra }); } catch { /* */ } };
    bc.onmessage = ({ data }) => {
      if (!data || data.de === yo) return;
      if (data.tipo === 'escribiendo') oyente.alEscribir?.(data.r === 'coach' ? 'coach' : 'atleta');
      else if (data.tipo === 'cambio') oyente.alCambio?.();
      else if (visible && (data.tipo === 'hola' || data.tipo === 'aqui')) { vistos.set(data.de, Date.now()); oyente.alPresencia?.(enLinea()); if (data.tipo === 'hola') decir('aqui'); }
      else if (visible && data.tipo === 'adios') { vistos.delete(data.de); oyente.alPresencia?.(enLinea()); }
    };
    if (visible) decir('hola');
    const latido = setInterval(() => { if (visible) decir('aqui'); oyente.alPresencia?.(enLinea()); }, 4000);
    const x = { cerrar: () => { clearInterval(latido); if (visible) decir('adios'); try { bc.close(); } catch { /* */ } } };
    canales.add(x);
    setTimeout(() => oyente.alEstado?.(true), 0);
    let ultimo = 0;
    return {
      escribiendo(rol) { if (Date.now() - ultimo < 2500) return; ultimo = Date.now(); decir('escribiendo', { r: rol === 'coach' ? 'coach' : 'atleta' }); },
      cambio() { decir('cambio'); },
      soltar() { canales.delete(x); x.cerrar(); },
    };
  }

  const b = {
    modo: 'demo',
    canalChat,
    reiniciarChats() { for (const x of canales) x.cerrar(); canales.clear(); },
    async iniciar() {},
    reiniciar() {
      db = semilla();
      sesion = null;
      guardarLocal(clave, db);
      avisar();
    },
    auth: {
      sesion: () => sesion,
      async entrar(email, password) {
        const u = tabla('auth_users').find((x) => x.email.toLowerCase() === String(email).trim().toLowerCase());
        if (!u || u.password !== password) throw new Error('Email o contraseña incorrectos.');
        sesion = { user: { id: u.id, email: u.email }, aal: 'aal1' };
        avisar();
      },
      async registrar(email, password, nombre) {
        email = String(email).trim().toLowerCase();
        if (tabla('auth_users').some((x) => x.email === email)) throw new Error('Ya hay una cuenta con ese email. Entra con tu contraseña.');
        if (String(password).length < 10) throw new Error('La contraseña es demasiado débil: usa al menos 10 caracteres.');
        const id = uuid();
        tabla('auth_users').push({ id, email, password });
        insertar('perfiles', { id, nombre: nombre || email.split('@')[0] });
        sesion = { user: { id, email }, aal: 'aal1' };
        persistirYa();
        avisar();
        return { confirmarEmail: false };
      },
      async salir() { sesion = null; avisar(); },
      async recuperar() {},
      async cambiarPassword(password) {
        const u = usuario();
        if (u) u.password = password;
        persistirYa();
      },
      alCambiar(f) { oyentes.add(f); return () => oyentes.delete(f); },
      // En la demo, el código de la app de verificación es siempre 123456
      mfa: {
        async nivel() {
          const verificados = (usuario()?.mfa || []).filter((f) => f.estado === 'verified');
          return { actual: sesion?.aal || 'aal1', siguiente: verificados.length ? 'aal2' : 'aal1' };
        },
        async factores() { return copia(usuario()?.mfa || []); },
        async inscribir(nombre) {
          const u = usuario();
          u.mfa = (u.mfa || []).filter((f) => f.estado === 'verified');
          const f = { id: uuid(), nombre, estado: 'unverified', creado: ahora() };
          u.mfa.push(f);
          persistirYa();
          const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21" shape-rendering="crispEdges"><rect width="21" height="21" fill="#fff"/><path d="M1 1h7v7H1zM13 1h7v7h-7zM1 13h7v7H1z" fill="none" stroke="#000"/><path d="M3 3h3v3H3zM15 3h3v3h-3zM3 15h3v3H3zM10 2h1v2h-1zM9 9h3v3H9zM14 10h2v1h-2zM10 14h1v4h-1zM13 13h1v1h-1zM15 15h3v1h-3zM17 17h1v2h-1z"/></svg>';
          return { id: f.id, qr: `data:image/svg+xml;utf-8,${encodeURIComponent(svg)}`, secreto: 'DEMO DEMO DEMO DEMO' };
        },
        async verificar(factorId, codigo) {
          const f = (usuario()?.mfa || []).find((x) => x.id === factorId);
          if (!f || String(codigo).replace(/\s/g, '') !== CODIGO_MFA_DEMO) throw new Error('Código incorrecto o caducado. En la demo es 123456.');
          f.estado = 'verified';
          sesion = { ...sesion, aal: 'aal2' };
          persistirYa();
          avisar();
        },
        async quitar(factorId) {
          const u = usuario();
          u.mfa = (u.mfa || []).filter((x) => x.id !== factorId);
          persistirYa();
        },
      },
    },
    storage: {
      // Sin conexión (el navegador lo dice), como en el de verdad: así la demo enseña cómo un vídeo se queda guardado
      // en el móvil y se envía solo al volver la cobertura
      // bucket «comunidad» (v0.43): las fotos del muro, con las reglas de la 027 (verlas si se ve su publicación;
      // borrarlas solo si ya nadie las usa; subirlas si su publicación ya está registrada)
      async subir(ruta, archivo, tipo, { alProgreso = null, senal = null, bucket = 'archivos', urlSubida = null, alUrlSubida = null } = {}) {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) { const e = new Error('Sin conexión.'); e.sinConexion = true; throw e; }
        // (v0.56, para probar el progreso y «Cancelar»): con «fbe-demo-subida-lenta» (ms), la subida va por pasos
        // (v0.57) como la subida por trozos (TUS): si se corta la conexión a medias, se queda lo subido y, con su dirección
        // (urlSubida), sigue por ahí
        const lenta = (() => { try { return Math.min(20000, Number(localStorage.getItem('fbe-demo-subida-lenta')) || 0); } catch { return 0; } })();
        if (lenta && bucket === 'archivos') {
          const dir = urlSubida && trozos.has(urlSubida) ? urlSubida : `demo-tus:${ruta}:${uuid()}`;
          if (!trozos.has(dir)) trozos.set(dir, 0);
          alUrlSubida?.(dir);
          await new Promise((ok, mal) => {
            let i = trozos.get(dir);
            if (i > 0) alProgreso?.(Math.min(0.95, i / 10));
            const t = setInterval(() => {
              if (typeof navigator !== 'undefined' && navigator.onLine === false) { clearInterval(t); const e = new Error('Sin conexión.'); e.sinConexion = true; mal(e); return; }
              i++; trozos.set(dir, i); alProgreso?.(Math.min(0.95, i / 10));
              if (i >= 10) { clearInterval(t); trozos.delete(dir); ok(); }
            }, lenta / 10);
            if (senal) senal.abortar = () => { clearInterval(t); trozos.delete(dir); const e = new Error('Cancelado'); e.cancelado = true; mal(e); };
          });
        }
        if (bucket === 'comunidad') {
          if (!fotoRegistrada(ruta)) throw sinPermiso();
          if (archivo?.size > 614400) throw new Error('El archivo supera el tamaño máximo permitido.');
          ficheros.set(`comunidad:${ruta}`, archivo); alProgreso?.(1); return;
        }
        // Como la 034: las notas de voz, en su bucket («voz»: 3 MB y solo audio, registradas como nota de voz); en
        // «archivos», nunca una nota de voz
        const a = archivoDeRuta(ruta);
        if (bucket === 'voz') {
          if (a?.tipo !== 'audio' || a.ruta !== ruta || !(esCoach() || (a.atleta_id === miAtletaId() && ruta.split('/')[0] === miAtletaId()))) throw sinPermiso();
          if (archivo?.size > 3145728) throw new Error('The object exceeded the maximum allowed size');
          if (!['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac'].includes(String(tipo || '').split(';')[0])) throw new Error('mime type not supported');
        } else if (bucket === 'archivos' && a?.tipo === 'audio') throw sinPermiso();
        // Como la 037: en modelos/ solo sube el coach
        else if (bucket === 'archivos' && String(ruta).split('/')[0] === 'modelos' && !esCoach()) throw sinPermiso();
        ficheros.set(ruta, archivo); alProgreso?.(1);
      },
      // Como la 033: copiar en Storage (con los permisos de quien copia: ver el de origen y poder subir el de destino, que
      // tiene que estar registrado si no es el coach)
      async copiar(desde, hasta, bucket = 'archivos') {
        if (!['archivos', 'voz'].includes(bucket) || !archivoVisible(desde) || (bucket === 'voz') !== (archivoDeRuta(desde)?.tipo === 'audio')) throw new Error('No tienes permiso para ver ese archivo.');
        if ((bucket === 'voz') !== (archivoDeRuta(hasta)?.tipo === 'audio')) throw sinPermiso();
        if (!esCoach() && !(archivoDeRuta(hasta)?.atleta_id === miAtletaId() && hasta.split('/')[0] === miAtletaId())) throw sinPermiso();
        if (ficheros.has(hasta) || alias.has(hasta)) throw new Error('The resource already exists');
        if (ficheros.has(desde)) ficheros.set(hasta, ficheros.get(desde)); else alias.set(hasta, alias.get(desde) || desde);
      },
      async url(ruta, segundos = 3600, bucket = 'archivos') {
        if (bucket === 'comunidad') {
          if (!fotoVisible(ruta)) throw new Error('No tienes permiso para ver ese archivo.');
          ruta = `comunidad:${ruta}`;
        }
        // Como la 032 (revisión): un atleta solo ve lo de su carpeta que tiene su fila en archivos; (034) cada cosa en su bucket
        else if (!archivoVisible(ruta) || (bucket === 'voz') !== (archivoDeRuta(ruta)?.tipo === 'audio')) throw new Error('No tienes permiso para ver ese archivo.');
        if (urls.has(ruta)) return urls.get(ruta);
        // Una copia (033) de un ejemplo de la demo: se sirve como el original
        if (!ficheros.has(ruta) && alias.has(ruta)) ruta = alias.get(ruta);
        if (urls.has(ruta)) return urls.get(ruta);
        const f = ficheros.get(ruta);
        // Los ejemplos de la demo van incrustados en base64: se sirven como blob (la política de seguridad de
        // la app no deja cargar «data:» en vídeos e imágenes)
        // (la promesa se guarda antes de esperar: dos peticiones a la vez de la misma ruta comparten el blob)
        if (!f && /(\/|-)ejemplo-sentadilla\.mp4$/.test(ruta)) { const pr = import('./video-demo.js').then((m) => aBlob(m.VIDEO_EJEMPLO, ruta)); urls.set(ruta, pr); return pr; }
        // v0.58: el del análisis de la barra (un disco que hace 3 repeticiones; WebM)
        if (!f && ruta.endsWith('/ejemplo-barra.webm')) { const pr = import('./video-barra-demo.js').then((m) => aBlob(m.VIDEO_BARRA, ruta)); urls.set(ruta, pr); return pr; }
        // v0.50: la miniatura del vídeo de ejemplo (para la bandeja del coach y el diario)
        if (!f && /(\/|-)ejemplo-sentadilla\.mp4\.jpg$/.test(ruta)) { const pr = import('./poster-demo.js').then((m) => aBlob(m.POSTER_EJEMPLO, ruta)); urls.set(ruta, pr); return pr; }
        const foto = !f && ruta.match(/\/ejemplo-foto-(\d)\.jpg$/);
        if (foto) { const pr = import('./fotos-demo.js').then((m) => aBlob(m.FOTOS_EJEMPLO[foto[1]], ruta)); urls.set(ruta, pr); return pr; }
        if (!f) {
          const e = new Error('En la demo, los vídeos y fotos solo se guardan hasta recargar la página.');
          e.noDisponible = true;
          throw e;
        }
        const u = URL.createObjectURL(f);
        urls.set(ruta, u);
        return u;
      },
      async borrar(rutas, bucket = 'archivos') {
        const hechas = [];
        for (let r of rutas) {
          const nombre = r;
          if (bucket === 'comunidad') { if (!esCoach() && !fotoBorrable(r)) continue; r = `comunidad:${r}`; }
          // Como la 032 (revisión): un atleta solo borra lo suyo que puede borrar (con su fila; no un adjunto con mensajes);
          // (034) de «voz», solo el coach
          else if (bucket === 'voz' ? !esCoach() : !archivoBorrable(r)) continue;
          // (v0.58) Los ejemplos de la demo (vídeos y fotos incrustados) los comparten varios archivos con la misma ruta: su
          // blob se queda toda la sesión (si se soltara, el otro vídeo que lo está cargando daría ERR_FILE_NOT_FOUND). Lo que
          // se subió de verdad se suelta, pero un rato después, cuando ya nadie lo está cargando.
          const subido = ficheros.has(r);
          ficheros.delete(r); alias.delete(r);
          if (subido && urls.has(r)) { const u = urls.get(r); urls.delete(r); if (typeof u === 'string') setTimeout(() => { try { URL.revokeObjectURL(u); } catch { /* */ } }, 10000); }
          hechas.push(nombre);
        }
        return hechas;
      },
      async listar(carpeta, bucket = 'archivos') {
        const pre = bucket === 'comunidad' ? `comunidad:${carpeta}/` : `${carpeta}/`;
        return [...ficheros.keys()].filter((r) => r.startsWith(pre)).map((r) => (bucket === 'comunidad' ? r.slice('comunidad:'.length) : r));
      },
    },
    async select(t, f = {}) {
      sinRedDemo();
      // Para ver las siluetas de carga en la demo: localStorage «fbe-demo-retraso» = milisegundos por consulta
      const retraso = (() => { try { return Math.min(5000, Number(localStorage.getItem('fbe-demo-retraso')) || 0); } catch { return 0; } })();
      if (retraso) await new Promise((r) => setTimeout(r, retraso));
      // En la demo, el coach con la verificación activada y sin el segundo paso no ve nada (como en Supabase)
      const u = usuario();
      if (esCoach() && sesion?.aal !== 'aal2' && (miPerfil()?.exige_2fa || (u?.mfa || []).some((x) => x.estado === 'verified')) && !['perfiles'].includes(t)) return [];
      // Los cobros solo los ve el coach (migración 020)
      if (['cobros_atletas', 'pagos'].includes(t) && !esCoach()) return [];
      if (t === 'comunidad_posts') pasadaComunidadDemo(); // (045)
      let filas = tabla(t).filter((x) => cumple(x, f) && (!VISIBLE[t] || VISIBLE[t](x)));
      for (const [col, dir] of [...(f.order || [])].reverse()) {
        filas = filas.sort((a, b2) => {
          const x = a[col], y = b2[col];
          if (x == null && y == null) return 0;
          if (x == null) return 1;
          if (y == null) return -1;
          return (x < y ? -1 : x > y ? 1 : 0) * (dir === 'desc' ? -1 : 1);
        });
      }
      if (f.limit) filas = filas.slice(0, f.limit);
      // (pulido 3) Como en Supabase, solo viajan las columnas que se piden: así las pruebas notan si una pantalla usa
      // una columna que su consulta no pide (antes la demo las daba todas y el fallo solo salía con la base de verdad)
      if (f.cols && typeof f.cols === 'string' && f.cols !== '*') {
        const cols = f.cols.split(',').map((c) => c.trim()).filter(Boolean);
        return copia(filas.map((x) => Object.fromEntries(cols.filter((c) => c in x).map((c) => [c, x[c]]))));
      }
      return copia(filas);
    },
    async insert(t, filas) {
      sinRedDemo();
      // Sin conexión (el navegador lo dice), los mensajes no salen (como en el de verdad): así la demo enseña la bandeja de
      // salida (⏱) y cómo se envían solos al volver la cobertura
      if (t === 'comentarios' && typeof navigator !== 'undefined' && navigator.onLine === false) { const e = new Error('Sin conexión.'); e.sinConexion = true; throw e; }
      // (para probar «!» con «Reintentar» y «Eliminar» en la demo: localStorage «fbe-demo-rechazar» = 1 rechaza el siguiente)
      if (t === 'comentarios') { let r = null; try { r = localStorage.getItem('fbe-demo-rechazar'); if (r) localStorage.removeItem('fbe-demo-rechazar'); } catch { /* */ } if (r) throw new Error('La demo ha rechazado este mensaje (prueba)'); }
      const lista = Array.isArray(filas) ? filas : [filas];
      const res = lista.map((f) => insertar(t, f));
      persistirYa();
      return copia(res);
    },
    async update(t, cambios, f) {
      sinRedDemo();
      if (['cobros_atletas', 'pagos', 'recetas', 'video_revisiones', 'tecnica_plantillas', 'recordatorios_tecnica', 'frases_correccion', 'videos_modelo', 'umbrales_velocidad'].includes(t) && !esCoach()) return [];
      // Como la 037: recordatorios, frases y vídeos modelo (el coach, con sus triggers); la valoración, el atleta de la suya
      if (['recordatorios_tecnica', 'frases_correccion', 'videos_modelo', 'video_autoevaluacion', 'umbrales_velocidad'].includes(t)) {
        const filas = tabla(t).filter((x) => cumple(x, f) && VISIBLE[t](x));
        const nuevas = filas.map((x) => {
          const m = { ...x, ...copia(cambios) };
          if (t === 'recordatorios_tecnica') prepararRecordatorio(m, x);
          else if (t === 'frases_correccion') prepararFrase(m, x);
          else if (t === 'videos_modelo') prepararModelo(m, x);
          else if (t === 'umbrales_velocidad') prepararUmbral(m, x);
          else { if (m.atleta_id !== x.atleta_id && 'atleta_id' in cambios && cambios.atleta_id !== miAtletaId()) throw sinPermiso(); prepararAutoevaluacion(m, x); }
          comprobarChecks(t, m);
          return [x, m];
        });
        for (const [x, m] of nuevas) {
          const posterAntes = t === 'videos_modelo' ? x.poster_ruta : null;
          Object.assign(x, m);
          if (posterAntes && !x.poster_ruta) encolar([posterAntes], 'archivos');
        }
        persistirYa();
        return copia(filas);
      }
      // Como la 035: la corrección (con su trigger) y las listas de puntos clave, el coach
      if (t === 'video_revisiones' || t === 'tecnica_plantillas') {
        const filas = tabla(t).filter((x) => cumple(x, f));
        for (const x of filas) {
          const m = { ...x, ...copia(cambios) };
          if (t === 'video_revisiones') prepararRevision(m, x); else { m.puntos = (m.puntos || []).map((p) => String(p).trim()); m.actualizado_en = ahora(); }
          comprobarChecks(t, m);
          const vozAntes = x.voz_archivo_id;
          Object.assign(x, m);
          if (t === 'video_revisiones' && vozAntes && vozAntes !== x.voz_archivo_id) soltarVoz(vozAntes);
        }
        persistirYa();
        return copia(filas);
      }
      // Como la 032: de una reacción, solo el emoji de la propia (en un mensaje en que aún se puede reaccionar); el estado
      // de las conversaciones, el coach; la presencia (solo con su función), los destacados y los cupos no se cambian
      if (['presencia', 'chat_cupos', 'comentario_destacados', 'encuestas_chat', 'encuesta_votos'].includes(t)) throw sinPermisoTabla(t);
      if (t === 'comentario_reacciones') {
        if (Object.keys(cambios).some((k) => k !== 'emoji')) throw new Error('De una reacción solo se cambia el emoji');
        if (!emojiValido(cambios.emoji)) throw new Error('Algún valor está fuera de rango.');
        const filas = tabla(t).filter((x) => cumple(x, f) && x.usuario_id === sesion?.user.id);
        if (filas.length && deBajaYo()) throw new Error('Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada');
        for (const x of filas) { if (!comentarioReaccionable(x.comentario_id)) throw sinPermiso(); gastarCupoChat('reaccion'); Object.assign(x, { emoji: cambios.emoji, creado_en: ahora() }); }
        persistirYa();
        return copia(filas);
      }
      // Como la 033: lo fijado y las listas, el coach; cada silencio, quien lo puso; los miembros no se cambian (se quitan y se ponen)
      if (t === 'listas_difusion_miembros') throw sinPermisoTabla(t);
      if (t === 'privacidad_vista') {
        const filas = tabla(t).filter((x) => cumple(x, f) && x.usuario_id === sesion?.user.id);
        for (const x of filas) { const m = { ...x, ...copia(cambios) }; prepararPrivacidad(m, x); Object.assign(x, m); }
        persistirYa();
        return copia(filas);
      }
      if (t === 'conversacion_fijado' || t === 'listas_difusion' || t === 'chat_silencios') {
        if (t !== 'chat_silencios' && !esCoach()) return [];
        const filas = tabla(t).filter((x) => cumple(x, f) && VISIBLE[t](x));
        for (const x of filas) {
          const m = { ...x, ...copia(cambios) };
          if (t === 'conversacion_fijado') prepararFijado(m, x); else if (t === 'chat_silencios') prepararSilencio(m, x); else prepararLista(t, m, x);
          Object.assign(x, m);
        }
        persistirYa();
        return copia(filas);
      }
      if (t === 'conversacion_estado') {
        if (!esCoach()) return [];
        const filas = tabla(t).filter((x) => cumple(x, f));
        for (const x of filas) { const m = { ...x, ...copia(cambios), atleta_id: x.atleta_id }; prepararEstadoConversacion(m, x); Object.assign(x, m); }
        persistirYa();
        return copia(filas);
      }
      // Como la 027: en la comunidad, los atletas no cambian nada directamente; el coach abre o cierra, resuelve
      // avisos y cambia sus retos. Publicaciones y comentarios no se cambian (fijar y ocultar van por funciones).
      if (t.startsWith('comunidad_')) {
        if (['comunidad_posts', 'comunidad_comentarios', 'comunidad_miembros', 'comunidad_reacciones', 'comunidad_cupos', 'comunidad_votos', 'comunidad_animos', 'comunidad_companeros', 'comunidad_reto_equipos'].includes(t)) throw new Error('permission denied for table ' + t);
        if (!esCoach()) return [];
        if (['comunidad_evento_asistentes', 'comunidad_destacados', 'comunidad_moderacion', 'comunidad_plantillas'].includes(t)) throw new Error('permission denied for table ' + t);
        // (044) un evento: como comunidad_evento_preparar (y al cancelarlo se queda cancelado)
        if (t === 'comunidad_eventos') {
          const filas = tabla(t).filter((fila) => cumple(fila, f));
          const nuevas = filas.map((fila) => { const m = { ...fila, ...copia(cambios) }; prepararEvento(m, fila); comprobarChecks(t, m); return [fila, m]; });
          for (const [fila, m] of nuevas) Object.assign(fila, m);
          persistirYa();
          return copia(filas);
        }
        const permitidas = { comunidad_ajustes: ['activa'], comunidad_reportes: ['resuelto_en'] }[t];
        if (permitidas && Object.keys(cambios).some((k) => !permitidas.includes(k))) throw new Error('De un aviso solo se cambia si está resuelto');
        const filas = tabla(t).filter((fila) => cumple(fila, f));
        if (t === 'comunidad_retos') for (const fila of filas) comprobarChecks(t, { ...fila, ...cambios });
        for (const fila of filas) {
          const c = { ...copia(cambios) };
          if (t === 'comunidad_reportes') c.resuelto_en = c.resuelto_en ? fila.resuelto_en || ahora() : null;
          if (t === 'comunidad_ajustes') c.actualizado_en = ahora();
          if (t === 'comunidad_retos') delete c.creado_en;
          Object.assign(fila, c);
        }
        persistirYa();
        return copia(filas);
      }
      const res = [];
      // Como la 030 (y la 031): los avisos y la ficha del atleta solo los cambia el coach (el atleta, ni su estado ni su baja,
      // ni sus días de entreno por semana)
      if ((t === 'avisos' || t === 'atletas') && !esCoach()) return [];
      const c = antesDeActualizar(t, cambios);
      // Como en la base (RLS): nadie cambia lo que no ve (el atleta no marca leído un mensaje que aún no ha salido)
      const filas = tabla(t).filter((fila) => cumple(fila, f) && (esCoach() || !VISIBLE[t] || VISIBLE[t](fila)));
      const porFilaFecha = new Map();
      if (t === 'sesiones' && 'preparacion' in c) for (const fila of filas) comprobarPreparacion(fila, c.preparacion);
      if (t === 'sesiones' && 'dia_previsto' in c) for (const fila of filas) comprobarDiaPrevisto({ ...fila, ...c });
      // Como la migración 008: si el coach mueve una semana, el plan del atleta se mueve con ella
      if (t === 'semanas' && 'fecha_inicio' in c) {
        for (const fila of filas) {
          if (fila.fecha_inicio === c.fecha_inicio) continue;
          for (const ses of tabla('sesiones')) {
            if (ses.semana_id !== fila.id || !ses.dia_previsto) continue;
            ses.dia_previsto = fila.fecha_inicio && c.fecha_inicio ? sumar(ses.dia_previsto, diasEntreIso(fila.fecha_inicio, c.fecha_inicio)) : null;
          }
        }
      }
      if (t === 'habitos') for (const fila of filas) protegerHabito(fila, c);
      if (t === 'menu_comidas') for (const fila of filas) comprobarMenu({ ...fila, ...c }, fila);
      // Como la 023: tampoco al cambiarla, la misma receta dos veces en una comida para el mismo tipo de día
      if (t === 'recetas_atleta' && ('toma' in c || 'variante' in c)) for (const fila of filas) {
        const m = { ...fila, ...c };
        if (tabla('recetas_atleta').some((x) => x !== fila && x.atleta_id === m.atleta_id && x.receta_id === m.receta_id && x.toma === m.toma && (x.variante || null) === (m.variante || null))) {
          throw new Error('duplicate key value violates unique constraint "recetas_atleta_unica"');
        }
      }
      if (t === 'recetas_atleta' && !esCoach() && c.cambio_pedido_en) {
        // Como la 022: la fecha de la petición solo cambia al pedirla o al cambiar la nota
        for (const fila of filas) if (fila.cambio_pedido_en && ('cambio_nota' in c ? c.cambio_nota : fila.cambio_nota) === fila.cambio_nota) porFilaFecha.set(fila, fila.cambio_pedido_en);
      }
      if ((t === 'planes_nutricion' || t === 'registros_nutricion') && 'atleta_id' in c && filas.some((fila) => fila.atleta_id !== c.atleta_id)) throw new Error('No se puede pasar a otro atleta');
      if (t === 'registros_nutricion') for (const fila of filas) prepararRegistroNutricion({ ...fila, ...c });
      if (t === 'objetivos') for (const fila of filas) comprobarMarca({ ...fila, ...copia(c) });
      if (t === 'preguntas_checkin') for (const fila of filas) protegerPregunta(fila, c);
      if (t === 'checkins' && 'respuestas' in c) for (const fila of filas) validarRespuestas({ ...fila, ...copia(c) }, fila);
      const porFila = new Map();
      // Como la 030: tareas (no cambian de atleta; solo el coach), avisos programados, bajas y mensajes programados
      if (t === 'tareas' || t === 'tareas_plantillas') { if (!esCoach()) return []; if ('atleta_id' in c && filas.some((fila) => fila.atleta_id !== c.atleta_id)) throw new Error('Una tarea no se puede pasar a otro atleta: ponle una nueva'); delete c.creada_en; }
      if (t === 'avisos' || t === 'atletas' || t === 'comentarios') {
        for (const fila of filas) {
          const m = { ...fila, ...copia(c) };
          if (t === 'avisos') prepararAviso(m, fila);
          if (t === 'atletas' && ('estado' in c || 'baja_en' in c)) fechaBaja(m, fila);
          if (t === 'comentarios') prepararComentario(m, fila);
          porFila.set(fila, m);
        }
      }
      // Cuestionarios: lo que pone el trigger depende de cada fila
      if (t === 'cuestionarios') for (const fila of filas) { const m = { ...copia(fila), ...copia(c) }; prepararCuestionario(m, fila); porFila.set(fila, m); }
      // (lo que ajusta comprobarEnlaces en cada fila, como el trigger: se aplica después)
      const ajustes = new Map();
      // (como la 037, archivos_aa_mover: al pasar a otro atleta, ni el pie, ni la estrella, ni la serie del de antes)
      const LIMPIAR_AL_MOVER = { nota_atleta: null, destacado: false, sesion_ejercicio_id: null, serie_numero: null };
      if (t === 'archivos') for (const fila of filas) { const m = porFila.get(fila) || { ...fila, ...copia(c) }; const mueve = m.atleta_id !== fila.atleta_id; if (mueve) Object.assign(m, LIMPIAR_AL_MOVER); comprobarEnlaces(m, fila); comprobarAngulo(m, fila); ajustes.set(fila, { serie_numero: m.serie_numero ?? null, repite_de: m.repite_de ?? null, angulo_de: m.angulo_de ?? null, atleta: fila.atleta_id, mueve }); }
      for (const fila of filas) comprobarChecks(t, porFila.get(fila) || { ...fila, ...copia(c) });
      for (const fila of filas) {
        if (porFila.has(fila)) { Object.assign(fila, porFila.get(fila)); res.push(fila); continue; }
        // Como la migración 008: si la sesión cambia de semana, su día previsto se quita (salvo que venga uno nuevo)
        if (t === 'sesiones' && 'semana_id' in c && c.semana_id !== fila.semana_id && !('dia_previsto' in c)) fila.dia_previsto = null;
        // Como la 032: la ruta o la miniatura que deja de estar registrada, a la cola de Storage
        const antes = t === 'archivos' ? [fila.ruta, fila.poster_ruta] : [];
        Object.assign(fila, copia(c));
        if (t === 'archivos') {
          encolar(antes.filter((r) => r && r !== fila.ruta && r !== fila.poster_ruta));
          const aj = ajustes.get(fila);
          if (aj) { if (aj.mueve) Object.assign(fila, LIMPIAR_AL_MOVER); fila.serie_numero = aj.serie_numero; fila.repite_de = aj.repite_de; fila.angulo_de = aj.angulo_de; alMoverArchivo(fila, aj.atleta); }
        }
        if (porFilaFecha.has(fila)) fila.cambio_pedido_en = porFilaFecha.get(fila);
        if (t === 'comidas_atleta') normalizarOpcional(fila);
        if (t === 'objetivos') comprobarMarca(fila); res.push(fila);
      }
      persistirYa();
      return copia(res);
    },
    async upsert(t, filas, onConflict) {
      sinRedDemo();
      soloCoach(t);
      // Como la 037: la valoración del atleta (una por vídeo)
      if (t === 'video_autoevaluacion') {
        const res = (Array.isArray(filas) ? filas : [filas]).map((fila) => {
          const existente = tabla(t).find((x) => x.archivo_id === fila.archivo_id);
          if (!existente) return insertar(t, fila);
          if (!VISIBLE[t](existente) || esCoach()) throw sinPermiso();
          const m = { ...existente, ...copia(fila) };
          prepararAutoevaluacion(m, existente);
          comprobarChecks(t, m);
          return Object.assign(existente, m);
        });
        persistirYa();
        return copia(res);
      }
      // Como la 039: la velocidad mínima, una por ejercicio (solo el coach, con su trigger)
      if (t === 'umbrales_velocidad') {
        const res = (Array.isArray(filas) ? filas : [filas]).map((fila) => {
          const existente = tabla(t).find((x) => x.ejercicio_id === fila.ejercicio_id);
          if (!existente) return insertar(t, fila);
          const m = { ...existente, ...copia(fila) };
          prepararUmbral(m, existente);
          comprobarChecks(t, m);
          return Object.assign(existente, m);
        });
        persistirYa();
        return copia(res);
      }
      // Como la 040: una por atleta y lunes (el trigger pone la hora y deja la nota vacía en null)
      if (t === 'revisiones_semanales') {
        const res = (Array.isArray(filas) ? filas : [filas]).map((fila) => {
          const limpia = (m) => { m.actualizado_en = ahora(); if (m.nota != null && !String(m.nota).trim()) m.nota = null; return m; };
          const existente = tabla(t).find((x) => x.atleta_id === fila.atleta_id && x.lunes === fila.lunes);
          if (!existente) return insertar(t, limpia({ ...copia(fila) }));
          const m = limpia({ ...existente, ...copia(fila) });
          comprobarChecks(t, m);
          return Object.assign(existente, m);
        });
        persistirYa();
        return copia(res);
      }
      if (t === 'video_revisiones' || t === 'tecnica_plantillas') {
        const clave = t === 'video_revisiones' ? 'archivo_id' : 'ejercicio_id';
        const res = (Array.isArray(filas) ? filas : [filas]).map((fila) => {
          const existente = tabla(t).find((x) => x[clave] === fila[clave]);
          if (!existente) return insertar(t, fila);
          const m = { ...existente, ...copia(fila) };
          if (t === 'video_revisiones') prepararRevision(m, existente); else { m.puntos = (m.puntos || []).map((p) => String(p).trim()); m.actualizado_en = ahora(); }
          comprobarChecks(t, m);
          const vozAntes = existente.voz_archivo_id;
          Object.assign(existente, m);
          if (t === 'video_revisiones' && vozAntes && vozAntes !== existente.voz_archivo_id) soltarVoz(vozAntes);
          return existente;
        });
        persistirYa();
        return copia(res);
      }
      if (['presencia', 'chat_cupos', 'comentario_destacados', 'encuestas_chat', 'encuesta_votos'].includes(t)) throw sinPermisoTabla(t);
      // Como la 034: la versión vista (con el usuario que sea, la base la pone a tu nombre: es la tuya la que cambia)
      if (t === 'privacidad_vista') {
        const res = (Array.isArray(filas) ? filas : [filas]).map((f) => {
          const existente = tabla(t).find((x) => x.usuario_id === sesion?.user.id);
          if (!existente) return insertar(t, f);
          const m = { ...existente, ...copia(f) };
          prepararPrivacidad(m, existente);
          return Object.assign(existente, m);
        });
        persistirYa();
        return copia(res);
      }
      // Como la 033: lo fijado (uno por conversación) y el silencio propio
      if (t === 'conversacion_fijado' || t === 'chat_silencios') {
        const res = (Array.isArray(filas) ? filas : [filas]).map((f) => {
          const existente = t === 'conversacion_fijado' ? tabla(t).find((x) => x.atleta_id === f.atleta_id)
            : tabla(t).find((x) => x.atleta_id === f.atleta_id && x.usuario_id === sesion?.user.id);
          if (!existente) return insertar(t, f);
          const m = { ...existente, ...copia(f) };
          if (t === 'conversacion_fijado') prepararFijado(m, existente); else prepararSilencio(m, existente);
          return Object.assign(existente, m);
        });
        persistirYa();
        return copia(res);
      }
      // Como la 032: el estado de una conversación (el coach) y la reacción propia (insertar o cambiar el emoji)
      if (t === 'conversacion_estado' || t === 'comentario_reacciones') {
        const res = (Array.isArray(filas) ? filas : [filas]).map((f) => {
          const existente = t === 'conversacion_estado' ? tabla(t).find((x) => x.atleta_id === f.atleta_id)
            : tabla(t).find((x) => x.comentario_id === f.comentario_id && x.usuario_id === sesion?.user.id);
          if (!existente) return insertar(t, f);
          if (t === 'comentario_reacciones') {
            if (deBajaYo()) throw new Error('Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada');
            if (!EMOJIS_CHAT.includes(f.emoji)) throw new Error('Algún valor está fuera de rango.');
            if (!comentarioReaccionable(existente.comentario_id)) throw sinPermiso();
            gastarCupoChat('reaccion');
            return Object.assign(existente, { emoji: f.emoji, creado_en: ahora() });
          }
          const m = { ...existente, ...copia(f) };
          prepararEstadoConversacion(m, existente);
          return Object.assign(existente, m);
        });
        persistirYa();
        return copia(res);
      }
      const cols = onConflict.split(',').map((c) => c.trim());
      const lista = Array.isArray(filas) ? filas : [filas];
      const res = lista.map((f) => {
        const existente = tabla(t).find((x) => cols.every((c) => x[c] === f[c]));
        if (existente) {
          const c = copia(antesDeActualizar(t, f));
          if (t === 'registros_habito') prepararRegistroHabito(Object.assign(c, { habito_id: existente.habito_id, fecha: existente.fecha }));
          if (t === 'registros_nutricion') { const m = { ...existente, ...c }; prepararRegistroNutricion(m); c.actualizado_en = m.actualizado_en; }
          if (t === 'checkins' && 'respuestas' in c) validarRespuestas({ ...existente, ...c }, existente);
          if (t === 'cuestionarios') { const m = { ...copia(existente), ...c }; prepararCuestionario(m, existente); Object.assign(c, m); }
          comprobarChecks(t, { ...existente, ...c });
          Object.assign(existente, c, { id: existente.id });
          if (t === 'comidas_atleta') normalizarOpcional(existente);
          return existente;
        }
        return insertar(t, f);
      });
      persistirYa();
      return copia(res);
    },
    async delete(t, f) {
      sinRedDemo();
      if (['cobros_atletas', 'pagos', 'recetas', 'recetas_atleta', 'tareas', 'tareas_plantillas', 'conversacion_estado', 'video_revisiones', 'tecnica_plantillas', 'recordatorios_tecnica', 'frases_correccion', 'videos_modelo', 'umbrales_velocidad'].includes(t) && !esCoach()) return [];
      // Como la 037: la valoración la quita su atleta (el coach solo la lee)
      if (t === 'video_autoevaluacion') {
        if (esCoach() || !miAtletaId()) return [];
        db[t] = tabla(t).filter((x) => !(cumple(x, f) && x.atleta_id === miAtletaId()));
        persistirYa();
        return [];
      }
      // Como la 035: al quitar una corrección, su voz se va con ella
      if (t === 'video_revisiones') {
        const fuera = tabla(t).filter((x) => cumple(x, f));
        db[t] = tabla(t).filter((x) => !fuera.includes(x));
        for (const x of fuera) soltarVoz(x.voz_archivo_id);
        persistirYa();
        return [];
      }
      // Como la 032: el atleta no borra mensajes a mano (los elimina para todos con comentario_eliminar); reacciones y
      // destacados, cada uno los suyos; la presencia y los cupos, nadie
      if (t === 'comentarios' && !esCoach()) return [];
      if (['presencia', 'chat_cupos', 'encuestas_chat', 'encuesta_votos'].includes(t)) throw sinPermisoTabla(t);
      if (['conversacion_fijado', 'listas_difusion', 'listas_difusion_miembros'].includes(t) && !esCoach()) return [];
      if (t === 'listas_difusion') { borrarCascada(t, tabla(t).filter((x) => cumple(x, f)).map((x) => x.id)); persistirYa(); return []; }
      if (t === 'comentario_reacciones' || t === 'comentario_destacados' || t === 'chat_silencios') {
        db[t] = tabla(t).filter((x) => !(cumple(x, f) && x.usuario_id === sesion?.user.id));
        persistirYa();
        return [];
      }
      // Como la 027: cada uno borra lo suyo (que ve); el coach, cualquier publicación o comentario, sus retos y avisos
      if (t.startsWith('comunidad_')) {
        if (['comunidad_ajustes', 'comunidad_miembros', 'comunidad_reacciones', 'comunidad_reportes', 'comunidad_cupos', 'comunidad_votos', 'comunidad_animos', 'comunidad_companeros', 'comunidad_reto_equipos', 'comunidad_guardados',
          'comunidad_evento_asistentes', 'comunidad_destacados', 'comunidad_moderacion'].includes(t)) return [];
        if (['comunidad_retos', 'comunidad_eventos', 'comunidad_plantillas'].includes(t) && !esCoach()) return [];
        const ids = tabla(t).filter((x) => cumple(x, f) && (esCoach() || (x.autor_id === sesion?.user.id && VISIBLE[t](x)))).map((x) => x.id);
        borrarCascada(t, ids);
        persistirYa();
        return [];
      }
      if (SIN_ID.includes(t)) { db[t] = tabla(t).filter((x) => !cumple(x, f)); persistirYa(); return; }
      // Como la 032 (revisión): el atleta borra sus archivos, pero no un adjunto del chat que lleva mensajes
      // (035) ni la voz del coach de una corrección
      const ids = tabla(t).filter((x) => cumple(x, f) && (t !== 'archivos' || esCoach() || (x.atleta_id === miAtletaId() && (!DEL_CHAT.includes(x.tipo) || !archivoConMensajes(x.id)) && !esVozDeVideo(x.id)))).map((x) => x.id);
      if (t === 'preguntas_checkin' && ids.some(conRespuestas)) throw new Error('Esta pregunta ya tiene respuestas: archívala para no perderlas');
      // Como la 030: si se borra el archivo con que se hizo una tarea aún sin revisar, la tarea vuelve a pendiente
      if (t === 'archivos') for (const k of tabla('tareas')) if (ids.includes(k.archivo_id) && !k.revisada_en) Object.assign(k, { hecha_en: null, respuesta: null, archivo_id: null });
      borrarCascada(t, ids);
      persistirYa();
    },
    async rpc(nombre, args) {
      sinRedDemo();
      const uid = sesion?.user.id;
      const perfil = tabla('perfiles').find((p) => p.id === uid);
      // Migración 021: el resumen de los pagos del atleta con la sesión abierta (solo eso)
      if (nombre === 'mi_cobro') {
        const yo = tabla('atletas').find((a) => a.perfil_id === uid);
        const pagos = yo ? tabla('pagos').filter((x) => x.atleta_id === yo.id) : [];
        if (!pagos.length) return [];
        const r = resumenCobros(pagos, hoyISO());
        const debeDesde = pagos.filter((x) => x.estado !== 'pagado' && x.periodo_desde <= hoyISO()).map((x) => x.periodo_desde).sort()[0] || null;
        return [{ pagado_hasta: r.pagadoHasta, debe: r.debe, debe_desde: debeDesde, estado: r.estado === 'sin_datos' ? 'al_dia' : r.estado }];
      }
      if (nombre === 'nombre_coach') return uid && (esCoach() || miAtletaId()) ? String(tabla('perfiles').filter((p) => p.rol === 'coach').sort((a, b) => String(a.creado_en).localeCompare(String(b.creado_en)))[0]?.nombre || '').trim().split(/\s+/)[0].slice(0, 30) || null : null;
      // (048) el resumen de cada conversación y la última serie de cada atleta: con lo que ve quien llama
      // (lo que deja ver la base, sin pasar por select: el coach sin el segundo paso no ve nada)
      const veo048 = (t) => (esCoach() && sesion?.aal !== 'aal2' && (miPerfil()?.exige_2fa || (usuario()?.mfa || []).some((x) => x.estado === 'verified')) ? [] : tabla(t).filter((x) => !VISIBLE[t] || VISIBLE[t](x)));
      if (nombre === 'conversaciones_resumen') {
        const visibles = veo048('comentarios');
        const futuro = (x) => !!x.enviar_en && Date.parse(x.enviar_en) > Date.now();
        const por = new Map();
        for (const x of visibles) { if (!por.has(x.atleta_id)) por.set(x.atleta_id, []); por.get(x.atleta_id).push(x); }
        return [...por].map(([atleta_id, xs]) => {
          const salidos = xs.filter((x) => !futuro(x)).sort((x, y) => String(y.creado_en).localeCompare(String(x.creado_en)) || String(y.id).localeCompare(String(x.id)));
          const u = salidos[0];
          return {
            atleta_id,
            sin_leer: salidos.filter((x) => x.autor === 'atleta' && !x.leido_en && !x.eliminado_en).length,
            programados: xs.filter(futuro).length,
            ultimo: u ? { id: u.id, atleta_id: u.atleta_id, autor: u.autor, texto: String(u.texto ?? '').slice(0, 300), creado_en: u.creado_en, leido_en: u.leido_en ?? null, sesion_id: u.sesion_id ?? null, checkin_id: u.checkin_id ?? null,
              archivo_id: u.archivo_id ?? null, enviar_en: u.enviar_en ?? null, adjunto: !!u.adjunto, eliminado_en: u.eliminado_en ?? null, editado_en: u.editado_en ?? null, entregado_en: u.entregado_en ?? null } : null,
          };
        });
      }
      if (nombre === 'biblioteca_huella') {
        const filas = veo048('ejercicios').slice().sort((x, y) => String(x.id).localeCompare(String(y.id)));
        let h = 5381; for (const ch of JSON.stringify(filas)) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0;   // (un resumen cualquiera de su contenido)
        return `${filas.length}:${h.toString(16)}`;
      }
      if (nombre === 'ultimas_series') {
        const ids = new Set(args?.p_atletas || []);
        const ult = new Map();
        for (const x of veo048('series')) if (ids.has(x.atleta_id) && (!ult.has(x.atleta_id) || String(x.registrada_en) > String(ult.get(x.atleta_id)))) ult.set(x.atleta_id, x.registrada_en);
        return [...ult].map(([atleta_id, registrada_en]) => ({ atleta_id, registrada_en }));
      }
      // (047) la foto de alguien en grande, para quien ya puede ver su foto (sin p_perfil, la del coach)
      if (nombre === 'foto_grande_de') {
        if (!uid) return null;
        const coach = tabla('perfiles').filter((p) => p.rol === 'coach').sort((a, b) => String(a.creado_en).localeCompare(String(b.creado_en)))[0];
        const p = tabla('perfiles').find((x) => x.id === (args.p_perfil || coach?.id));
        if (!p) return null;
        const puede = p.id === uid || esCoach() || p.rol === 'coach' || (soyMiembro() && esMiembro(p.id));
        return puede ? p.foto_grande || p.foto || null : null;
      }
      if (nombre === 'foto_coach') return uid ? tabla('perfiles').filter((p) => p.rol === 'coach').sort((a, b) => String(a.creado_en).localeCompare(String(b.creado_en)))[0]?.foto || null : null;
      if (nombre === 'crear_invitacion') {
        if (perfil?.rol !== 'coach') throw new Error('Solo el coach puede crear invitaciones');
        const atleta = tabla('atletas').find((a) => a.id === args.p_atleta && !a.perfil_id);
        if (!atleta) throw new Error('El atleta no existe o ya tiene cuenta');
        const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const bytes = new Uint8Array(10);
        crypto.getRandomValues(bytes);
        const crudo = [...bytes].map((x) => alfabeto[x % 32]).join('');
        const codigo = `FBE-${crudo.slice(0, 5)}-${crudo.slice(5)}`;
        for (const i of tabla('invitaciones')) if (i.atleta_id === atleta.id && !i.usada_en) i.caduca_en = ahora();
        insertar('invitaciones', { atleta_id: atleta.id, codigo, caduca_en: new Date(Date.now() + (args.p_dias || 14) * 864e5).toISOString() });
        persistirYa();
        return codigo;
      }
      if (nombre === 'canjear_invitacion') {
        if (!uid) throw new Error('Necesitas iniciar sesión');
        if (perfil?.rol === 'coach' || tabla('atletas').some((a) => a.perfil_id === uid)) throw new Error('Esta cuenta ya está vinculada');
        const canon = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const inv = tabla('invitaciones').find((i) => canon(i.codigo) === canon(args.p_codigo) && !i.usada_en && i.caduca_en > ahora());
        const atleta = inv && tabla('atletas').find((a) => a.id === inv.atleta_id && !a.perfil_id);
        if (!atleta) return null;
        atleta.perfil_id = uid;
        atleta.estado = 'activo';
        inv.usada_en = ahora();
        persistirYa();
        return atleta.id;
      }
      // Notificaciones: en la demo no hay móviles a los que enviar
      if (nombre === 'probar_notificacion') {
        if (!uid) throw new Error('Necesitas iniciar sesión');
        const email = tabla('preferencias_notificaciones').some((p) => p.usuario_id === uid && p.email);
        return email || tabla('suscripciones_push').some((x) => x.usuario_id === uid) ? 'ok' : 'sin_canal';
      }
      if (nombre === 'registrar_suscripcion_push' || nombre === 'actualizar_suscripcion_push') throw new Error('En la demo no se pueden activar las notificaciones');
      if (nombre === 'programar_descanso') return 'sin_canal'; // en la demo no hay notificaciones
      if (nombre === 'cancelar_descanso') return null;
      // Migración 035: «Visto por tu coach» (el día, el primero) y la limpieza de vídeos antiguos (solo el coach)
      if (nombre === 'video_visto') {
        if (!esCoach()) throw new Error('Solo el coach');
        const a = buscar('archivos', args.p_archivo);
        if (!a || a.tipo !== 'video_tecnica') return null;
        let r = tabla('video_revisiones').find((x) => x.archivo_id === a.id);
        if (!r) r = insertar('video_revisiones', { archivo_id: a.id, atleta_id: a.atleta_id, visto_el: fMadrid() });
        else if (!r.visto_el) { const m = { ...r, visto_el: fMadrid() }; prepararRevision(m, r); Object.assign(r, m); }
        persistirYa();
        return r.visto_el;
      }
      // Como la 035: la corrección como la lee la app, sin ninguna hora (de «Visto» y «Corregido», el día en Madrid)
      if (nombre === 'video_correcciones') {
        if (!uid || !(esCoach() || miAtletaId())) throw new Error('Necesitas iniciar sesión');
        const ids = args.p_archivos;
        if (!Array.isArray(ids) || ids.length > 1000) throw new Error('De 0 a 1000 vídeos de una vez');
        return copia(tabla('video_revisiones').filter((r) => ids.includes(r.archivo_id) && (esCoach() || r.atleta_id === miAtletaId()))
          .map((r) => ({ archivo_id: r.archivo_id, atleta_id: r.atleta_id, puntuacion: r.puntuacion ?? null, checklist: r.checklist ?? null, tempo: r.tempo ?? null,
            voz_archivo_id: r.voz_archivo_id ?? null, voz_inicio: r.voz_inicio ?? null, visto_el: r.visto_el ?? null, corregido_el: r.corregido_en ? fMadrid(new Date(r.corregido_en)) : null,
            // (036) y el análisis automático que guardó el coach
            analisis: r.analisis ?? null, dos_angulos: r.dos_angulos ?? null })));
      }
      // Como la 037: los recordatorios activos de un atleta (el atleta, los suyos; sin horas) y los vídeos modelo
      if (nombre === 'recordatorios_activos') {
        if (!uid || !(esCoach() || miAtletaId())) throw new Error('Necesitas iniciar sesión');
        const enlace = (r) => { const a = r.archivo_id && buscar('archivos', r.archivo_id); return a && a.atleta_id === r.atleta_id && a.tipo === 'video_tecnica'; };
        return copia(tabla('recordatorios_tecnica').filter((r) => r.activo && r.atleta_id === args.p_atleta && (esCoach() || r.atleta_id === miAtletaId()))
          .sort((a, b) => String(a.ejercicio_id).localeCompare(String(b.ejercicio_id)) || String(a.creado_en).localeCompare(String(b.creado_en)))
          .map((r) => ({ id: r.id, ejercicio_id: r.ejercicio_id, texto: r.texto, archivo_id: enlace(r) ? r.archivo_id : null, segundo: enlace(r) ? r.segundo ?? null : null,
            actualizado_el: r.actualizado_en ? fMadrid(new Date(r.actualizado_en)) : null })));
      }
      // Como la 039: la velocidad mínima de unos ejercicios (el coach y los atletas vinculados; sin horas)
      if (nombre === 'umbrales_velocidad_de') {
        if (!uid || !(esCoach() || miAtletaId())) throw new Error('Necesitas iniciar sesión');
        const ids = args.p_ejercicios;
        if (!Array.isArray(ids) || ids.length > 200) throw new Error('De 0 a 200 ejercicios de una vez');
        return copia(tabla('umbrales_velocidad').filter((u) => ids.includes(u.ejercicio_id) && umbralValido(Number(u.vmin)))
          .sort((a, b) => String(a.ejercicio_id).localeCompare(String(b.ejercicio_id))).map((u) => ({ ejercicio_id: u.ejercicio_id, vmin: Number(u.vmin) })));
      }
      if (nombre === 'videos_modelo_de') {
        if (!uid || !(esCoach() || miAtletaId())) throw new Error('Necesitas iniciar sesión');
        const ids = args.p_ejercicios;
        if (!Array.isArray(ids) || ids.length > 200) throw new Error('De 0 a 200 ejercicios de una vez');
        if (!esCoach() && deBaja()) return [];
        return copia(tabla('videos_modelo').filter((m) => ids.includes(m.ejercicio_id))
          .sort((a, b) => String(a.ejercicio_id).localeCompare(String(b.ejercicio_id)) || (a.orden - b.orden) || String(a.creado_en).localeCompare(String(b.creado_en)))
          .map(({ id, ejercicio_id, ruta, poster_ruta, duracion_seg, angulo, orden }) => ({ id, ejercicio_id, ruta, poster_ruta: poster_ruta ?? null, duracion_seg: duracion_seg ?? null, angulo: angulo ?? null, orden })));
      }
      if (nombre === 'videos_limpieza' || nombre === 'videos_limpiar') {
        if (!esCoach()) throw new Error('Solo el coach');
        const meses = Number(args.p_meses), dias = Number(args.p_dias ?? 30);
        if (!Number.isInteger(meses) || meses < 1 || meses > 60 || !Number.isInteger(dias) || dias < 7 || dias > 365) throw new Error('De 1 a 60 meses y de 7 a 365 días');
        const viejos = videosViejos(tabla('archivos'), { comentarios: tabla('comentarios'), revisiones: tabla('video_revisiones'), tareas: tabla('tareas'), meses, dias, hoy: fMadrid() })
          .sort((x, y) => (x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : x.id < y.id ? -1 : 1));
        if (nombre === 'videos_limpieza') {
          return { n: viejos.length, bytes: viejos.reduce((t, a) => t + (Number(a.bytes) || 0), 0),
            lista: viejos.slice(0, 300).map((a) => ({ id: a.id, atleta_id: a.atleta_id, fecha: a.fecha, bytes: a.bytes ?? null, ejercicio_id: a.ejercicio_id ?? null })) };
        }
        const pedidos = Array.isArray(args.p_ids) ? args.p_ids : [];
        if (pedidos.length < 1 || pedidos.length > 300) throw new Error('De 1 a 300 vídeos de una vez');
        const fuera = viejos.filter((a) => pedidos.includes(a.id));
        for (const k of tabla('tareas')) if (fuera.some((a) => a.id === k.archivo_id) && !k.revisada_en) Object.assign(k, { hecha_en: null, respuesta: null, archivo_id: null });
        borrarCascada('archivos', fuera.map((a) => a.id));
        persistirYa();
        return { n: fuera.length, bytes: fuera.reduce((t, a) => t + (Number(a.bytes) || 0), 0) };
      }
      // Migración 030: el atleta marca una tarea suya; las semanas de un bloque (sin nada de las no publicadas)
      if (nombre === 'tarea_completar') {
        const yo = tabla('atletas').find((a) => a.perfil_id === uid);
        if (!uid || !yo) throw new Error('Solo el atleta de la tarea puede marcarla');
        if (yo.estado === 'baja') throw new Error('Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada');
        const x = tabla('tareas').find((k) => k.id === args.p_tarea && k.atleta_id === yo.id);
        if (!x) throw new Error('Esa tarea ya no está');
        if (x.revisada_en) throw new Error('Tu coach ya la ha revisado: si quieres cambiar algo, escríbele');
        if (args.p_hecha === false) { Object.assign(x, { hecha_en: null, respuesta: null, archivo_id: null }); persistirYa(); return null; }
        if (x.fecha > fMadrid()) throw new Error('Esta tarea es para otro día: podrás hacerla ese día');
        const resp = String(args.p_respuesta || '').trim() || null;
        if (resp && (resp.length > 500 || !textoVisible(resp))) throw new Error('La respuesta, hasta 500 letras');
        if (x.tipo === 'foto' || x.tipo === 'video') {
          const a = buscar('archivos', args.p_archivo);
          if (!a || a.atleta_id !== yo.id || a.tipo !== (x.tipo === 'foto' ? 'foto_progreso' : 'video_tecnica')) throw new Error(`Para esta tarea hace falta ${x.tipo === 'foto' ? 'tu foto de progreso' : 'tu vídeo de técnica'}`);
          if (x.tipo === 'video' && x.ejercicio_id && a.ejercicio_id !== x.ejercicio_id && buscar('sesion_ejercicios', a.sesion_ejercicio_id)?.ejercicio_id !== x.ejercicio_id) {
            throw new Error(`Ese vídeo es de otro ejercicio: para esta tarea hace falta uno de ${buscar('ejercicios', x.ejercicio_id)?.nombre || 'su ejercicio'}`);
          }
          if (tabla('tareas').some((k) => k.archivo_id === a.id && k.id !== x.id)) throw new Error('Esa foto o ese vídeo ya sirvió para otra tarea: haz uno nuevo');
        } else if (args.p_archivo) throw new Error('Esta tarea no lleva foto ni vídeo');
        if (x.tipo === 'medida' && !tabla('pesos').some((p) => p.atleta_id === yo.id && p.fecha >= x.fecha) && !tabla('medidas').some((m) => m.atleta_id === yo.id && m.fecha >= x.fecha)) throw new Error('Apunta antes tu peso o tus medidas');
        Object.assign(x, { hecha_en: x.hecha_en || ahora(), respuesta: resp, archivo_id: args.p_archivo || null });
        persistirYa();
        return x.hecha_en;
      }
      // Migración 032: eliminar para todos, la última conexión y buscar en los mensajes
      if (nombre === 'comentario_eliminar') {
        const c = buscar('comentarios', args.p_comentario);
        if (!uid) throw new Error('Necesitas iniciar sesión');
        if (!c || !(esCoach() || (miAtletaId() && c.atleta_id === miAtletaId() && !programadoAun(c)))) throw new Error('Ese mensaje ya no está');
        if (c.autor !== (esCoach() ? 'coach' : 'atleta')) throw new Error('Solo puedes eliminar tus mensajes');
        if (c.eliminado_en) return { estado: 'eliminado', rutas: [] };
        if (deBaja()) throw new Error('Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada');
        if (programadoAun(c)) { borrarCascada('comentarios', [c.id]); db.notificaciones = tabla('notificaciones').filter((n) => n.clave !== `comentario:${c.id}`); persistirYa(); return { estado: 'cancelado', rutas: [] }; }
        if (Date.parse(c.creado_en) < Date.now() - 48 * 3600000) throw new Error('Un mensaje se elimina para todos en las 48 horas siguientes a enviarlo');
        gastarCupoChat('eliminar');
        const adj = c.adjunto && c.archivo_id ? buscar('archivos', c.archivo_id) : null;
        const rutas = adj && DEL_CHAT.includes(adj.tipo) ? [adj.ruta, adj.poster_ruta].filter(Boolean) : [];
        // (como la 038: al coach, también las del vídeo de una respuesta en vídeo)
        const resp = esCoach() && c.video_respuesta_id ? buscar('archivos', c.video_respuesta_id) : null;
        if (resp) rutas.push(...[resp.ruta, resp.poster_ruta].filter(Boolean));
        vaciarComentario(c);
        if (adj && DEL_CHAT.includes(adj.tipo)) { for (const k of tabla('comentarios')) if (k.archivo_id === adj.id && k.id !== c.id) k.archivo_id = null; borrarCascada('archivos', [adj.id]); }
        persistirYa();
        return { estado: 'eliminado', rutas };
      }
      // La cola de Storage, para el coach
      if (nombre === 'storage_pendiente') {
        if (!esCoach()) throw new Error('Solo el coach');
        return tabla('storage_por_borrar').slice(0, Math.min(1000, Math.max(1, args?.p_limite || 200))).map((x) => x.ruta);
      }
      if (nombre === 'storage_pendiente_cubos') {
        if (!esCoach()) throw new Error('Solo el coach');
        return tabla('storage_por_borrar').slice(0, Math.min(1000, Math.max(1, args?.p_limite || 200))).map((x) => ({ ruta: x.ruta, bucket: x.bucket || 'archivos' }));
      }
      // Como la 045: quitar de la cola lo borrado de un bucket (la clave es el bucket y la ruta)
      if (nombre === 'storage_borrado_cubo') {
        if (!esCoach()) throw new Error('Solo el coach');
        const antes = tabla('storage_por_borrar').length;
        db.storage_por_borrar = tabla('storage_por_borrar').filter((x) => !((x.bucket || 'archivos') === args.p_bucket && (args.p_rutas || []).includes(x.ruta)));
        persistirYa();
        return antes - tabla('storage_por_borrar').length;
      }
      if (nombre === 'storage_borrado') {
        if (!esCoach()) throw new Error('Solo el coach');
        const antes = tabla('storage_por_borrar').length;
        db.storage_por_borrar = tabla('storage_por_borrar').filter((x) => !(args.p_rutas || []).includes(x.ruta));
        persistirYa();
        return antes - tabla('storage_por_borrar').length;
      }
      if (nombre === 'presencia_marcar') {
        if (!uid) throw new Error('Necesitas iniciar sesión');
        let r = tabla('presencia').find((x) => x.usuario_id === uid);
        const visible = args?.p_visible ?? r?.visible ?? true;
        if (r && visible === r.visible && (!visible || (r.ultima_conexion && Date.parse(r.ultima_conexion) > Date.now() - 55000))) return { visible: r.visible, ultima_conexion: r.ultima_conexion };
        if (r && visible !== r.visible) gastarCupoChat('presencia');
        if (!r) { r = { usuario_id: uid }; tabla('presencia').push(r); }
        Object.assign(r, { visible, ultima_conexion: visible ? ahora() : null, actualizado_en: ahora() });
        persistirYa();
        return { visible: r.visible, ultima_conexion: r.ultima_conexion };
      }
      if (nombre === 'chat_buscar') {
        const sin = (t) => String(t || '').toLowerCase().normalize('NFD').replace(DIACRITICOS, '');
        const q = sin(String(args.p_texto || '').trim());
        if (!esCoach() || q.length < 2 || q.length > 100) return [];
        return copia(tabla('comentarios').filter((c) => !c.eliminado_en && !(c.archivo_id && ['Foto', 'Vídeo', 'Documento', 'Nota de voz'].includes(c.texto)) && sin(c.texto).includes(q))
          .sort((a, b2) => String(b2.creado_en).localeCompare(String(a.creado_en))).slice(0, Math.min(100, Math.max(1, args.p_limite || 40)))
          .map(({ id, atleta_id, autor, texto, creado_en, enviar_en }) => ({ id, atleta_id, autor, texto: String(texto).slice(0, 300), creado_en, enviar_en: enviar_en || null })));
      }
      // Migración 033: entregado, reenviar y difundir
      if (nombre === 'marcar_entregados') {
        // Sin «Mostrar cuándo estoy en línea», nada (diría cuándo abre la app): se da por entregado al leerlo
        if (!uid || !presenciaMiaVisible()) return 0;
        const cuando = ahora();
        const mio = miAtletaId();
        let n = 0;
        for (const c of tabla('comentarios')) {
          if (c.entregado_en || c.eliminado_en) continue;
          if ((esCoach() && c.autor === 'atleta') || (!esCoach() && mio && c.autor === 'coach' && c.atleta_id === mio && !programadoAun(c))) { c.entregado_en = cuando; n++; }
        }
        if (n) persistirYa();
        return n;
      }
      if (nombre === 'chat_reenviar' || nombre === 'chat_difundir') {
        if (!uid || !esCoach()) throw new Error(nombre === 'chat_reenviar' ? 'Solo el coach puede reenviar mensajes' : 'Solo el coach envía difusiones');
        // ¿Es esta la copia de ese archivo para ese atleta? (del chat, suya, recién registrada, del mismo formato y sin mensajes)
        const copiaValida = (id, atletaId, tipo, mime) => { const a = buscar('archivos', id); return !!a && a.atleta_id === atletaId && DEL_CHAT.includes(a.tipo) && subidoPor(a) === 'coach' && (!tipo || a.tipo === tipo) && (!mime || a.mime === mime) && Date.parse(a.creado_en) > Date.now() - 3600000 && !a.derivado_de && !archivoConMensajes(a.id); };
        const nuevo = (fila, reenviado) => {
          const ya = fila.cliente_id && tabla('comentarios').find((x) => x.atleta_id === fila.atleta_id && x.autor === 'coach' && x.cliente_id === fila.cliente_id);
          if (ya) return null;
          const c = insertar('comentarios', fila, { interno: true });
          c.reenviado = !!reenviado;
          return c;
        };
        const antes = copia(db);
        try {
          if (nombre === 'chat_reenviar') {
            const c = buscar('comentarios', args.p_comentario);
            if (!c || c.autor !== 'coach' || c.eliminado_en || programadoAun(c) || c.sesion_id || c.checkin_id || (c.archivo_id && !c.adjunto) || c.dibujo) throw new Error('Solo se reenvían tus mensajes del chat que ya han salido');
            if (tabla('encuestas_chat').some((e) => e.comentario_id === c.id)) throw new Error('Una encuesta no se reenvía: crea otra (o mándala a una lista de difusión)');
            const a = c.archivo_id ? buscar('archivos', c.archivo_id) : null;
            // Solo lo que subió el coach: nunca la foto o el PDF de un atleta al chat de otro
            if (c.archivo_id && (!a || subidoPor(a) !== 'coach' || tabla('comentarios').some((k) => k.archivo_id === a.id && k.autor === 'atleta'))) throw new Error('Solo se reenvían las fotos, vídeos y documentos que has enviado tú');
            // Como la 035: ni el fotograma del vídeo de un atleta
            if (a?.derivado_de) throw new Error('Un fotograma del vídeo de un atleta es solo suyo: no se reenvía');
            const ds = Array.isArray(args.p_destinos) ? args.p_destinos : [];
            if (ds.length < 1 || ds.length > 50) throw new Error('Se reenvía a entre 1 y 50 atletas');
            if (new Set(ds.map((d) => d.atleta)).size !== ds.length) throw new Error('Un atleta, una vez');
            gastarCupoCoach('reenviar', ds.length);
            const out = [];
            for (const d of ds) {
              const at = buscar('atletas', d.atleta);
              if (!at || at.estado === 'baja') throw new Error('Uno de los atletas no está (o está de baja)');
              if (a && (!d.archivo || !copiaValida(d.archivo, d.atleta, a.tipo, a.mime))) throw new Error('Falta la copia del archivo para uno de los atletas');
              if (!a && d.archivo) throw new Error('Este mensaje no lleva archivo');
              const k = nuevo({ atleta_id: d.atleta, texto: c.texto, archivo_id: d.archivo || null, cliente_id: d.cliente || null }, true);
              if (k) out.push({ atleta_id: d.atleta, id: k.id });
            }
            persistirYa();
            return out;
          }
          if (!buscar('listas_difusion', args.p_lista)) throw new Error('Esa lista ya no está');
          let t = String(args.p_texto || '').trim();
          const ds = Array.isArray(args.p_destinos) && args.p_destinos.length ? args.p_destinos : null;
          if (t.length > 4000) throw new Error('Un mensaje, hasta 4000 letras');
          if (!ds && !textoVisible(t)) throw new Error('Escribe el mensaje');
          if (ds && args.p_enviar_en) throw new Error('Los mensajes con foto, vídeo o documento no se pueden programar');
          const a0 = ds ? buscar('archivos', ds[0].archivo) : null;
          if (ds && !a0) throw new Error('Falta el archivo');
          if (ds && !textoVisible(t)) t = a0.tipo === 'documento' ? 'Documento' : a0.tipo === 'audio' ? 'Nota de voz' : /^image\//.test(a0.mime || '') ? 'Foto' : 'Vídeo';
          gastarCupoCoach('difusion', 1);
          const miembros = tabla('listas_difusion_miembros').filter((m) => m.lista_id === args.p_lista).map((m) => buscar('atletas', m.atleta_id)).filter(Boolean)
            .sort((x, y) => x.nombre.localeCompare(y.nombre));
          const ids = [];
          let saltados = 0;
          for (const m of miembros) {
            if (m.estado === 'baja') { saltados++; continue; }
            let archivoId = null;
            if (ds) {
              archivoId = ds.find((d) => d.atleta === m.id)?.archivo || null;
              if (!archivoId || !copiaValida(archivoId, m.id, a0.tipo, a0.mime)) throw new Error('Falta la copia del archivo para uno de los atletas de la lista');
            }
            const k = nuevo({ atleta_id: m.id, texto: t, archivo_id: archivoId, enviar_en: args.p_enviar_en || null, cliente_id: args.p_cliente || null }, false);
            if (k) ids.push(k.id);
          }
          persistirYa();
          return { enviados: ids.length, saltados, ids };
        } catch (e) { db = antes; throw e; }
      }
      // Migración 034: «escuchado», encuestas y votos
      if (nombre === 'marcar_escuchado') {
        if (!uid || !(esCoach() || miAtletaId())) throw new Error('Necesitas iniciar sesión');
        const c = buscar('comentarios', args.p_comentario);
        const a = c?.archivo_id ? buscar('archivos', c.archivo_id) : null;
        if (!c || c.eliminado_en || a?.tipo !== 'audio' || !((esCoach() && c.autor === 'atleta') || (!esCoach() && c.atleta_id === miAtletaId() && c.autor === 'coach' && !programadoAun(c)))) throw new Error('Esa nota de voz no es para ti');
        if (c.escuchado_en || !presenciaMiaVisible()) return c.escuchado_en || null;
        const t = ahora();
        Object.assign(c, { escuchado_en: t, leido_en: c.leido_en || t, entregado_en: c.entregado_en || t });
        persistirYa();
        return t;
      }
      if (nombre === 'chat_encuesta') {
        if (!uid || !esCoach()) throw new Error('Solo el coach crea encuestas');
        if (!!args.p_atleta === !!args.p_lista) throw new Error('Una encuesta va a un atleta o a una lista');
        const pregunta = String(args.p_pregunta || '').trim();
        if (!pregunta || pregunta.length > 300 || !textoVisible(pregunta)) throw new Error('Escribe la pregunta (hasta 300 letras)');
        const ops = opcionesEncuesta(args.p_opciones);
        if (!ops.ok) throw new Error(ops.error);
        if (args.p_lista && !buscar('listas_difusion', args.p_lista)) throw new Error('Esa lista ya no está');
        const antes = copia(db);
        try {
          gastarCupoCoach('encuesta', 1);
          const destinos = args.p_atleta ? [buscar('atletas', args.p_atleta)].filter(Boolean)
            : tabla('listas_difusion_miembros').filter((m) => m.lista_id === args.p_lista).map((m) => buscar('atletas', m.atleta_id)).filter(Boolean).sort((x, y) => x.nombre.localeCompare(y.nombre));
          if (args.p_atleta && !destinos.length) throw new Error('Ese atleta no está');
          const ids = [];
          let saltados = 0;
          for (const m of destinos) {
            if (m.estado === 'baja') { if (args.p_atleta) throw new Error('Está de baja: no se le puede enviar'); saltados++; continue; }
            if (args.p_cliente && tabla('comentarios').some((x) => x.atleta_id === m.id && x.autor === 'coach' && x.cliente_id === args.p_cliente)) continue;
            const k = insertar('comentarios', { atleta_id: m.id, texto: pregunta, cliente_id: args.p_cliente || null }, { interno: true });
            tabla('encuestas_chat').push({ id: uuid(), comentario_id: k.id, atleta_id: m.id, pregunta, opciones: ops.opciones, multiple: !!args.p_multiple, creada_en: ahora() });
            ids.push(k.id);
          }
          persistirYa();
          return { enviados: ids.length, saltados, ids };
        } catch (e) { db = antes; throw e; }
      }
      if (nombre === 'encuesta_votar') {
        const mio = miAtletaId();
        if (!uid || !mio || esCoach()) throw new Error('Solo el atleta de la conversación vota');
        const e = buscar('encuestas_chat', args.p_encuesta);
        const c = e ? buscar('comentarios', e.comentario_id) : null;
        if (!e || e.atleta_id !== mio || !c || c.eliminado_en || programadoAun(c)) throw new Error('Esa encuesta no está');
        if (deBaja()) throw new Error('Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada');
        const pedido = Array.isArray(args.p_opciones) ? args.p_opciones : [];
        const voto = [...new Set(pedido)].sort((x, y) => x - y);
        if (voto.length !== pedido.length || voto.some((x) => !Number.isInteger(x) || x < 0 || x >= e.opciones.length)) throw new Error('Esa opción no está en la encuesta');
        if (!e.multiple && voto.length > 1) throw new Error('En esta encuesta se elige una opción');
        gastarCupoChat('voto');
        db.encuesta_votos = tabla('encuesta_votos').filter((v) => v.encuesta_id !== e.id);
        if (voto.length) tabla('encuesta_votos').push({ encuesta_id: e.id, atleta_id: mio, opciones: voto, votado_en: ahora() });
        persistirYa();
        return voto.length ? voto : null;
      }
      if (nombre === 'bloque_semanas') {
        const bl = buscar('bloques', args.p_bloque);
        const mio = tabla('atletas').find((a) => a.perfil_id === uid)?.id;
        if (!bl || bl.es_plantilla || !(esCoach() || (bl.atleta_id && bl.atleta_id === mio))) return [];
        return tabla('semanas').filter((w) => w.bloque_id === bl.id).sort((a, b2) => a.numero - b2.numero).map((w) => ({ numero: w.numero, fecha_inicio: w.fecha_inicio, publicada: w.programacion === 'programada' }));
      }
      // Migración 027: la comunidad del equipo
      if (nombre.startsWith('comunidad_')) {
        const r = rpcComunidad(nombre, args || {}, uid, perfil);
        persistirYa();
        return copia(r ?? null);
      }
      throw new Error(`Función no disponible en la demo: ${nombre}`);
    },
  };
  return b;
}
