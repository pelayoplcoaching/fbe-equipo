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
import { fechaMadrid as fMadrid, instanteMadrid } from '../logica/fechas.js';

const ahora = () => new Date().toISOString();
const uuid = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16)));

export const CODIGO_MFA_DEMO = '123456';

const DEFECTOS = {
  perfiles: () => ({ rol: 'atleta', creado_en: ahora(), exige_2fa: false, foto: null }),
  atletas: () => ({ estado: 'invitado', fecha_alta: hoyISO(), creado_en: ahora(), perfil_id: null, email: null, objetivo: null, notion_url: null, progresion_auto: true, volumen_objetivo: null, checkin_apartados: null, nutricion: true, entrenamiento: true, nivel: null, peso_frecuencia: 'diario', baja_en: null, dias_semana: null }),
  invitaciones: () => ({ creada_en: ahora(), usada_en: null }),
  consentimientos: () => ({ aceptado_en: ahora(), revocado_en: null }),
  ejercicios: () => ({ grupos_musculares: [], activo: true, variante: null, video_url: null, instrucciones: null, errores: null, alternativas: [], tipo: [], rango_reps: null, creado_en: ahora() }),
  bloques: () => ({ es_plantilla: false, estado: 'planificado', atleta_id: null, numero: null, foco: null, objetivo: null, descripcion: null, fecha_inicio: null, fecha_fin: null, creado_en: ahora() }),
  semanas: () => ({ programacion: 'no_iniciada', foco: null, fecha_inicio: null, nota_coach: null }),
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
  archivos: () => ({ fecha: hoyISO(), sesion_ejercicio_id: null, ejercicio_id: null, comentario_coach: null, nota_atleta: null, mime: null, bytes: null, revisado_en: null, creado_en: ahora(), pose: null, poster_ruta: null, duracion_seg: null, destacado: false }),
  comentarios: () => ({ sesion_id: null, checkin_id: null, archivo_id: null, leido_en: null, creado_en: ahora(), dibujo: null, adjunto: false, enviar_en: null, responde_a: null, editado_en: null, eliminado_en: null }),
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
  comunidad_posts: () => ({ tipo: 'post', texto: null, foto_ruta: null, sesion_id: null, resumen: null, fijada: false, oculta: false, atleta_id: null, creado_en: ahora(), menciones: [], encuesta: null, reto_id: null }),
  comunidad_comentarios: () => ({ oculto: false, atleta_id: null, creado_en: ahora(), menciones: [] }),
  comunidad_retos: () => ({ descripcion: null, modo: 'individual', creado_en: ahora() }),
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
    ['comunidad_votos', 'atleta_id'], ['comunidad_animos', 'atleta_id'], ['comunidad_animos', 'para_atleta_id'], ['tareas', 'atleta_id'], ['conversacion_estado', 'atleta_id']],
  // Como la 032: las reacciones y los destacados se van con su mensaje
  comentarios: [['comentario_reacciones', 'comentario_id'], ['comentario_destacados', 'comentario_id']],
  comunidad_posts: [['comunidad_comentarios', 'post_id'], ['comunidad_reacciones', 'post_id'], ['comunidad_votos', 'post_id']],
  recetas: [['recetas_atleta', 'receta_id']],
  habitos: [['registros_habito', 'habito_id']],
  bloques: [['semanas', 'bloque_id']],
  semanas: [['sesiones', 'semana_id']],
  sesiones: [['sesion_ejercicios', 'sesion_id'], ['comentarios', 'sesion_id']],
  sesion_ejercicios: [['series', 'sesion_ejercicio_id']],
};
// Al borrar estas filas, los comentarios se quedan sin el enlace (on delete set null)
const ANULAR = { comentarios: [['comentarios', 'responde_a']], comunidad_retos: [['comunidad_posts', 'reto_id']], sesiones: [['comunidad_posts', 'sesion_id']], comunidad_posts: [['comunidad_reportes', 'post_id']], comunidad_comentarios: [['comunidad_reportes', 'comentario_id']], recetas: [['menu_comidas', 'receta_id']], checkins: [['comentarios', 'checkin_id']], archivos: [['comentarios', 'archivo_id'], ['tareas', 'archivo_id']], ejercicios: [['objetivos', 'ejercicio_id'], ['tareas', 'ejercicio_id'], ['tareas_plantillas', 'ejercicio_id']], sesion_ejercicios: [['archivos', 'sesion_ejercicio_id']] };

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
const SIN_ID = ['cobros_atletas', 'comidas_atleta', 'menu_dias', 'comunidad_miembros', 'comunidad_reacciones', 'comunidad_votos', 'comunidad_animos',
  'comentario_reacciones', 'comentario_destacados', 'conversacion_estado', 'presencia', 'chat_cupos', 'storage_por_borrar'];
// Como la 032: los seis emojis del chat, y cuánto se puede hacer por hora (el coach no tiene cupo)
const EMOJIS_CHAT = ['❤️', '👍', '💪', '😂', '😮', '🙏'];
const CUPO_CHAT = { reaccion: 120, destacar: 120, edicion: 30, eliminar: 30, presencia: 30 };
const AVISO_CUPO_CHAT = { reaccion: 'Has reaccionado muchas veces en la última hora: espera un poco', destacar: 'Has destacado muchos mensajes en la última hora: espera un poco',
  edicion: 'Has editado muchos mensajes en la última hora: espera un poco', eliminar: 'Has eliminado muchos mensajes en la última hora: espera un poco',
  presencia: 'Has cambiado muchas veces «Mostrar cuándo estoy en línea»: espera un poco' };

function guardarLocal(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento: la demo vive en memoria */ }
}
function leerLocal(clave) {
  try { const v = localStorage.getItem(clave); return v ? JSON.parse(v) : null; } catch { return null; }
}

export function crearBackendMemoria({ semilla, clave = 'fbe-demo-v2', persistir = true } = {}) {
  let db = (persistir && leerLocal(clave)) || semilla();
  let sesion = (persistir && leerLocal(clave + '-sesion')) || null;
  const oyentes = new Set();
  const ficheros = new Map();  // ruta → Blob (solo en memoria: no sobreviven a recargar la página)
  const urls = new Map();
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
  const postVisible = (id) => { const x = buscar('comunidad_posts', id); return !!x && (esCoach() || (!x.oculta && soyMiembro() && autorVisible(x.autor_id))); };
  const VISIBLE = {
    comunidad_miembros: (x) => esCoach() || x.perfil_id === sesion?.user.id,
    comunidad_posts: (x) => esCoach() || (!x.oculta && soyMiembro() && autorVisible(x.autor_id)),
    comunidad_comentarios: (x) => esCoach() || (!x.oculto && soyMiembro() && autorVisible(x.autor_id) && postVisible(x.post_id)),
    comunidad_reacciones: (x) => esCoach() || (soyMiembro() && autorVisible(x.autor_id) && postVisible(x.post_id)),
    comunidad_reportes: () => esCoach(),
    comunidad_retos: () => esCoach() || soyMiembro(),
    comunidad_cupos: () => false,
    // Como la 029: los votos, como las reacciones; los ánimos, los que uno manda y los que recibe
    comunidad_votos: (x) => esCoach() || (soyMiembro() && autorVisible(x.autor_id) && postVisible(x.post_id)),
    comunidad_animos: (x) => esCoach() || (soyMiembro() && ((x.para === sesion?.user.id && autorVisible(x.de)) || (x.de === sesion?.user.id && autorVisible(x.para)))),
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
    Object.assign(c, { texto: 'Se eliminó este mensaje', dibujo: null, responde_a: null, editado_en: null, eliminado_en: c.eliminado_en || ahora(), archivo_id: c.adjunto ? null : c.archivo_id });
    db.comentario_reacciones = tabla('comentario_reacciones').filter((r) => r.comentario_id !== c.id);
    db.comentario_destacados = tabla('comentario_destacados').filter((d) => d.comentario_id !== c.id);
    db.notificaciones = tabla('notificaciones').filter((n) => !(n.clave === `comentario:${c.id}` && n.estado === 'pendiente'));
  }
  const encolar = (rutas) => { for (const r of rutas) if (r && !tabla('storage_por_borrar').some((x) => x.ruta === r)) tabla('storage_por_borrar').push({ ruta: r, bucket: 'archivos', creado_en: ahora() }); };
  const archivoConMensajes = (id) => tabla('comentarios').some((c) => c.archivo_id === id);
  const archivoDeRuta = (ruta) => tabla('archivos').find((a) => a.ruta === ruta || a.poster_ruta === ruta);
  const archivoVisible = (ruta) => { if (esCoach()) return true; const a = archivoDeRuta(ruta); return !!a && !!miAtletaId() && a.atleta_id === miAtletaId() && ruta.split('/')[0] === miAtletaId(); };
  const archivoBorrable = (ruta) => { if (esCoach()) return true; const a = archivoDeRuta(ruta); return archivoVisible(ruta) && a.tipo !== 'adjunto'; };
  const deBajaYo = () => !esCoach() && deBaja();
  const miAtletaId = () => tabla('atletas').find((a) => a.perfil_id === sesion?.user.id)?.id || null;
  const fotoVisible = (ruta) => esCoach() || (!!miAtletaId() && ruta.split('/')[0] === miAtletaId()) || tabla('comunidad_posts').some((x) => x.foto_ruta === ruta && postVisible(x.id));
  const fotoRegistrada = (ruta) => tabla('comunidad_posts').some((x) => x.foto_ruta === ruta && x.autor_id === sesion?.user.id && !x.oculta && Date.parse(x.creado_en) > Date.now() - 15 * 60000 && veComunidad());
  const fotoBorrable = (ruta) => !!miAtletaId() && ruta.split('/')[0] === miAtletaId() && !tabla('comunidad_posts').some((x) => x.foto_ruta === ruta)
    && !tabla('comunidad_reportes').some((r) => r.copia_foto === ruta && !r.resuelto_en);
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
      if (f.tipo !== 'aviso' && f.tipo !== 'encuesta') throw new Error('Como coach, en el muro publicas avisos y encuestas');
      if (f.foto_ruta && (f.tipo !== 'aviso' || !String(f.foto_ruta).startsWith('coach/'))) throw new Error('La foto no va en su sitio');
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
      if (f.tipo !== 'post') throw new Error('Los avisos y las encuestas son del coach, y los entrenos y los logros se comparten desde su sitio');
      if (f.foto_ruta && !String(f.foto_ruta).startsWith(`${f.atleta_id}/`)) throw new Error('La foto no va en su sitio');
    }
    f.menciones = limpiarMenciones(f.menciones, uid);
    gastarCupo('post');
  }
  function prepararComentarioComunidad(f) {
    const uid = sesion?.user.id;
    if (!(esCoach() || soyMiembro()) || !postVisible(f.post_id)) throw sinPermiso();
    Object.assign(f, { autor_id: uid, creado_en: ahora(), oculto: false, atleta_id: esCoach() ? null : miAtletaId() });
    f.menciones = limpiarMenciones(f.menciones, uid);
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
  function antesDeInsertar(t, f) {
    comprobarAlta(t);
    if (t === 'comunidad_posts') prepararPost(f);
    if (t === 'comunidad_comentarios') prepararComentarioComunidad(f);
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
      // Como atleta_crear (002): un atleta solo escribe en su conversación
      if (!esCoach() && f.atleta_id !== miAtletaId()) throw sinPermiso();
      // Como la 014: el adjunto lo fija la base según el tipo del archivo
      f.adjunto = !!f.archivo_id && buscar('archivos', f.archivo_id)?.tipo === 'adjunto';
      f.leido_en = null;
      f.creado_en = f.enviar_en ? new Date(Date.parse(f.enviar_en)).toISOString() : ahora();
      // Como la 032: nadie crea un mensaje ya editado o eliminado; la cita, de la misma conversación y del mismo hilo,
      // de algo que quien escribe ya ve, que ya ha salido y que no se ha eliminado
      f.editado_en = null; f.eliminado_en = null;
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
    if (!esCoach()) {
      if (t === 'checkins') f.revisado_en = null;
      if (t === 'archivos') { f.revisado_en = null; f.comentario_coach = null; }
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
    if (f.baja_en && (f.baja_en < '2020-01-01' || f.baja_en > fMadrid())) throw new Error('El día de la baja, entre 2020 y hoy');
  }
  // Como la 030 (comentario_preparar): de un mensaje programado que aún no ha salido, el coach cambia el texto y la
  // hora (o lo manda ya); lo demás no se edita
  // v0.54 (032): además, editar lo propio (solo el texto, de un mensaje sin foto ni vídeo y en sus 15 minutos; la hora
  // de la edición la pone la base); «editado», «eliminado» y la cita no se tocan (eliminar va por comentario_eliminar)
  function prepararComentario(m, antes) {
    const yo = esCoach() ? 'coach' : 'atleta';
    const igual = (k) => (m[k] ?? null) === (antes[k] ?? null);
    if (esCoach() && antes.autor === 'coach' && antes.enviar_en && Date.parse(antes.enviar_en) > Date.now()) {
      if (!['responde_a', 'editado_en', 'eliminado_en', 'archivo_id', 'atleta_id', 'sesion_id', 'checkin_id', 'autor', 'dibujo', 'adjunto'].every(igual)) throw new Error('De un mensaje programado solo se cambian el texto y la hora');
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
      if (antes.archivo_id || antes.dibujo) throw new Error('Solo se editan los mensajes de texto');
      if (Date.parse(antes.creado_en) < Date.now() - 15 * 60000) throw new Error('Un mensaje se edita en los 15 minutos siguientes a enviarlo');
      if (!['atleta_id', 'sesion_id', 'checkin_id', 'archivo_id', 'autor', 'creado_en', 'dibujo', 'adjunto', 'enviar_en', 'responde_a', 'eliminado_en', 'leido_en'].every(igual)) throw new Error('De un mensaje solo se cambia el texto');
      if (!textoVisible(String(m.texto || ''))) throw new Error('Escribe el mensaje');
      gastarCupoChat('edicion');
      m.editado_en = ahora();
      return;
    }
    if (!['enviar_en', 'responde_a', 'editado_en', 'eliminado_en', 'atleta_id', 'sesion_id', 'checkin_id', 'autor', 'archivo_id', 'creado_en', 'dibujo', 'adjunto'].every(igual)) throw new Error('Un comentario no se puede editar');
    if (antes.autor === yo && !igual('leido_en')) throw new Error('Solo quien recibe un comentario lo marca como leído');
    // «Leído» lo fecha la base, una vez y para siempre; sin «Mostrar cuándo estoy en línea», solo el día
    if (!igual('leido_en')) {
      if (m.leido_en == null) throw new Error('Un mensaje leído no vuelve a «no leído»');
      m.leido_en = antes.leido_en || (presenciaMiaVisible() ? ahora() : new Date(Date.parse(instanteMadrid(fMadrid(), '00:00'))).toISOString());
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
      if (t === 'archivos' && Object.keys(c).some((k) => !['nota_atleta', 'ejercicio_id', 'destacado'].includes(k) && !(k === 'poster_ruta' && c[k] == null))) {
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
  const FOTO_OK = (v, max) => v == null || (String(v).length <= max && /^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(String(v)));
  // Como tareas_validas (030)
  const tareaValida = (f) => ['foto', 'medida', 'video', 'texto'].includes(f.tipo) && textoCorto(f.titulo, 120) && f.titulo != null && textoCorto(f.detalle, 600)
    && (f.ejercicio_id == null || f.tipo === 'video');
  const CHECKS = {
    tareas: (f) => tareaValida(f) && fechaValida(f.fecha) && textoCorto(f.respuesta, 500) && (f.hecha_en != null || (f.respuesta == null && f.archivo_id == null && f.revisada_en == null)),
    tareas_plantillas: (f) => tareaValida(f) && entre(n(f.orden), 0, 999),
    // Migración 027: la comunidad
    // (029: logros, encuestas y menciones)
    comunidad_posts: (f) => ['aviso', 'post', 'entreno', 'logro', 'encuesta'].includes(f.tipo) && textoCorto(f.texto, 2000) && (!['aviso', 'encuesta'].includes(f.tipo) || f.texto != null)
      && (f.tipo !== 'encuesta' || String(f.texto).length <= 300)
      && (f.tipo !== 'post' || f.texto != null || f.foto_ruta != null) && ['entreno', 'logro'].includes(f.tipo) === (f.resumen != null) && (!f.fijada || ['aviso', 'encuesta'].includes(f.tipo))
      && (f.tipo === 'logro' || f.reto_id == null) && (['post', 'aviso'].includes(f.tipo) || f.foto_ruta == null)
      && (f.tipo === 'encuesta') === (f.encuesta != null) && (f.encuesta == null || encuestaValida(f.encuesta)) && Array.isArray(f.menciones) && f.menciones.length <= 5,
    comunidad_comentarios: (f) => f.texto != null && textoCorto(f.texto, 1000) && Array.isArray(f.menciones) && f.menciones.length <= 5,
    comunidad_retos: (f) => textoCorto(f.titulo, 80) && f.titulo != null && textoCorto(f.descripcion, 500) && esFecha(f.desde) && esFecha(f.hasta) && f.hasta >= f.desde
      && diasEntreIso(f.desde, f.hasta) <= 366 && ['individual', 'equipo'].includes(f.modo ?? 'individual') && Number.isInteger(n(f.objetivo)) && entre(n(f.objetivo), 1, f.modo === 'equipo' ? 5000 : 100),
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
      && ['video_tecnica', 'foto_progreso', 'adjunto'].includes(f.tipo) && (f.poster_ruta == null || (new RegExp(`^${f.atleta_id}/[A-Za-z0-9_-][A-Za-z0-9._-]{0,150}$`).test(String(f.poster_ruta)) && !String(f.poster_ruta).includes('..') && f.poster_ruta !== f.ruta))
      && (f.duracion_seg == null || (entero(n(f.duracion_seg)) && entre(n(f.duracion_seg), 0, 3600))),
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

  const soloCoach = (t) => { if (['cobros_atletas', 'pagos', 'recetas', 'tareas', 'tareas_plantillas', 'conversacion_estado'].includes(t) && !esCoach()) throw new Error('new row violates row-level security policy'); };
  // Como la 032: la presencia solo se escribe con presencia_marcar(); los cupos, nadie
  const sinPermisoTabla = (t) => new Error(`permission denied for table ${t}`);
  // Como la 032: reaccionar y destacar, a su nombre, en mensajes que ya han salido y no se han eliminado; una por persona
  function prepararReaccionODestacado(t, f) {
    if (deBajaYo()) throw new Error('Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada');
    f.usuario_id = sesion?.user.id || null;
    if (t === 'comentario_reacciones' && !EMOJIS_CHAT.includes(f.emoji)) throw new Error('Algún valor está fuera de rango.');
    if (!f.usuario_id || !comentarioReaccionable(f.comentario_id)) throw sinPermiso();
    if (tabla(t).some((x) => x.comentario_id === f.comentario_id && x.usuario_id === f.usuario_id)) throw new Error(`duplicate key value violates unique constraint "${t}_pkey"`);
    gastarCupoChat(t === 'comentario_reacciones' ? 'reaccion' : 'destacar');
    f.creado_en = ahora();
  }
  function insertar(t, fila) {
    soloCoach(t);
    if (['presencia', 'chat_cupos'].includes(t)) throw sinPermisoTabla(t);
    // Como la 027: entrar, reaccionar y avisar al coach van por sus funciones; los retos, solo el coach
    if (['comunidad_ajustes', 'comunidad_miembros', 'comunidad_reacciones', 'comunidad_reportes', 'comunidad_cupos', 'comunidad_votos', 'comunidad_animos'].includes(t)) throw sinPermiso();
    if (t === 'comunidad_retos' && !esCoach()) throw sinPermiso();
    if (t === 'recetas_atleta' && !esCoach()) throw new Error('new row violates row-level security policy');
    const nueva = { ...(SIN_ID.includes(t) ? {} : { id: uuid() }), ...(DEFECTOS[t]?.() || {}), ...copia(fila) };
    if (t === 'comentario_reacciones' || t === 'comentario_destacados') prepararReaccionODestacado(t, nueva);
    if (t === 'conversacion_estado') {
      if (tabla(t).some((x) => x.atleta_id === nueva.atleta_id)) throw new Error('duplicate key value violates unique constraint "conversacion_estado_pkey"');
      prepararEstadoConversacion(nueva, null);
    }
    antesDeInsertar(t, nueva);
    if (t === 'objetivos') comprobarMarca(nueva);
    comprobarChecks(t, nueva);
    tabla(t).push(nueva);
    despuesDeInsertar(t, nueva);
    return nueva;
  }

  function borrarCascada(t, ids) {
    // Como la 032 (revisión): al borrar un archivo, su ruta y su miniatura a la cola de Storage; los mensajes de un
    // adjunto del chat quedan como eliminados (salvo si se borra el atleta entero: se va todo)
    if (t === 'archivos') {
      for (const a of tabla('archivos').filter((x) => ids.includes(x.id))) {
        encolar([a.ruta, a.poster_ruta]);
        if (a.tipo === 'adjunto' && buscar('atletas', a.atleta_id)) {
          for (const c of tabla('comentarios').filter((k) => k.archivo_id === a.id)) vaciarComentario(c);
          for (const c of tabla('comentarios').filter((k) => k.archivo_id === a.id)) c.archivo_id = null;
        }
      }
    }
    for (const [hija, col] of CASCADA[t] || []) {
      // Las que no tienen «id» (una fila por atleta) se borran por su columna
      if (SIN_ID.includes(hija)) { db[hija] = tabla(hija).filter((x) => !ids.includes(x[col])); continue; }
      const idsHijas = tabla(hija).filter((x) => ids.includes(x[col])).map((x) => x.id);
      if (idsHijas.length) borrarCascada(hija, idsHijas);
    }
    for (const [hija, col] of ANULAR[t] || []) for (const x of tabla(hija)) if (ids.includes(x[col])) { x[col] = null; if (hija === 'objetivos') comprobarMarca(x); }
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
  const totalReto = (r) => dentroTodos().filter((m) => !m.sin_ranking).reduce((a, m) => a + hechasEntre(m.atleta_id, r.desde, r.hasta), 0);
  const retoConseguido = (r, atletaId) => {
    const m = tabla('comunidad_miembros').find((x) => x.atleta_id === atletaId);
    if (!m || r.hasta < fechaMadrid(new Date(m.entrado_en || m.creado_en))) return false;
    return ((r.modo || 'individual') === 'equipo' ? totalReto(r) : hechasEntre(atletaId, r.desde, r.hasta)) >= r.objetivo;
  };
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
      else tabla('comunidad_miembros').push({ atleta_id: yo.id, perfil_id: uid, nombre: v, version: args.p_version, aceptado_en: ahora(), salido_en: null, sin_ranking: false, bloqueado: false, nombre_cambiado_en: null, creado_en: ahora(), entrado_en: ahora(), ...normas });
      return null;
    }
    if (nombre === 'comunidad_salir') {
      if (!uid) throw new Error('Necesitas iniciar sesión');
      for (const m of tabla('comunidad_miembros')) if (m.perfil_id === uid && !m.salido_en) m.salido_en = ahora();
      let fotos = [];
      if (args.p_borrar && !coach) {
        fotos = tabla('comunidad_posts').filter((x) => x.autor_id === uid && x.foto_ruta && !tabla('comunidad_reportes').some((r) => r.copia_foto === x.foto_ruta && !r.resuelto_en)).map((x) => x.foto_ruta);
        db.comunidad_reacciones = tabla('comunidad_reacciones').filter((x) => x.autor_id !== uid);
        // (029) también sus votos y los ánimos que ha mandado
        db.comunidad_votos = tabla('comunidad_votos').filter((x) => x.autor_id !== uid);
        db.comunidad_animos = tabla('comunidad_animos').filter((x) => x.de !== uid && x.para !== uid);
        borrarCascada('comunidad_comentarios', tabla('comunidad_comentarios').filter((x) => x.autor_id === uid).map((x) => x.id));
        borrarCascada('comunidad_posts', tabla('comunidad_posts').filter((x) => x.autor_id === uid).map((x) => x.id));
      }
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
      if (args.p_bloquear !== false) Object.assign(m, { salido_en: m.salido_en || ahora(), bloqueado: true });
      else m.bloqueado = false;
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
      if (args.p_tipo != null && !['fuerza', 'fuego', 'aplauso'].includes(args.p_tipo)) throw new Error('Esa reacción no existe');
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
        copia_foto: c ? null : x.foto_ruta, copia_autor_id: de.autor_id, copia_autor_nombre: nombreDe(de.autor_id), copia_atleta_id: de.atleta_id, copia_creado_en: de.creado_en,
      };
      tabla('comunidad_reportes').push(r);
      return r.id;
    }
    if (nombre === 'comunidad_retos_progreso') {
      if (!veComunidad()) return [];
      const ms = tabla('comunidad_miembros').filter((m) => miembroVisto(m) && (!m.sin_ranking || m.perfil_id === uid));
      return tabla('comunidad_retos').flatMap((r) => ms.map((m) => ({
        reto_id: r.id, perfil_id: m.perfil_id, nombre: m.nombre, objetivo: r.objetivo, yo: m.perfil_id === uid,
        hechas: hechasEntre(m.atleta_id, r.desde, r.hasta),
      })));
    }
    // Como la 029: el total del equipo en cada reto (sin quien no sale en el ranking)
    if (nombre === 'comunidad_retos_totales') {
      if (!veComunidad()) return [];
      return tabla('comunidad_retos').map((r) => ({ reto_id: r.id, modo: r.modo || 'individual', total: totalReto(r) }));
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
        records: tabla('comunidad_posts').filter((x) => x.tipo === 'entreno' && !x.oculta && perfiles.has(x.autor_id) && fechaMadrid(new Date(x.creado_en)) >= l && fechaMadrid(new Date(x.creado_en)) <= dom)
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
        entrenos: tabla('comunidad_posts').filter((x) => x.autor_id === m.perfil_id && x.tipo === 'entreno' && (esCoach() || !x.oculta)).length, yo: m.perfil_id === uid,
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
        fijada: false, oculta: false, creado_en: ahora(),
        resumen: { titulo: r.titulo, modo, objetivo: r.objetivo, hechas: modo === 'equipo' ? totalReto(r) : hechasEntre(yo.id, r.desde, r.hasta), desde: r.desde, hasta: r.hasta },
      };
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
        id: uuid(), autor_id: uid, atleta_id: yo.id, tipo: 'entreno', texto, foto_ruta: null, sesion_id: s.id, fijada: false, oculta: false, creado_en: ahora(), menciones: [], encuesta: null, reto_id: null,
        resumen: { nombre: s.nombre, tipo: s.tipo, fecha: s.fecha_realizada || hoyISO(), ...(s.duracion_min != null ? { minutos: s.duracion_min } : {}), series: hechas.length, con_kilos: kilos, ejercicios },
      };
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
      async subir(ruta, archivo, tipo, { alProgreso = null, bucket = 'archivos' } = {}) {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) { const e = new Error('Sin conexión.'); e.sinConexion = true; throw e; }
        if (bucket === 'comunidad') {
          if (!fotoRegistrada(ruta)) throw sinPermiso();
          if (archivo?.size > 614400) throw new Error('El archivo supera el tamaño máximo permitido.');
          ficheros.set(`comunidad:${ruta}`, archivo); alProgreso?.(1); return;
        }
        ficheros.set(ruta, archivo); alProgreso?.(1);
      },
      async url(ruta, segundos = 3600, bucket = 'archivos') {
        if (bucket === 'comunidad') {
          if (!fotoVisible(ruta)) throw new Error('No tienes permiso para ver ese archivo.');
          ruta = `comunidad:${ruta}`;
        }
        // Como la 032 (revisión): un atleta solo ve lo de su carpeta que tiene su fila en archivos
        else if (!archivoVisible(ruta)) throw new Error('No tienes permiso para ver ese archivo.');
        if (urls.has(ruta)) return urls.get(ruta);
        const f = ficheros.get(ruta);
        // Los ejemplos de la demo van incrustados en base64: se sirven como blob (la política de seguridad de
        // la app no deja cargar «data:» en vídeos e imágenes)
        // (la promesa se guarda antes de esperar: dos peticiones a la vez de la misma ruta comparten el blob)
        if (!f && ruta.endsWith('/ejemplo-sentadilla.mp4')) { const pr = import('./video-demo.js').then((m) => aBlob(m.VIDEO_EJEMPLO, ruta)); urls.set(ruta, pr); return pr; }
        // v0.50: la miniatura del vídeo de ejemplo (para la bandeja del coach y el diario)
        if (!f && ruta.endsWith('/ejemplo-sentadilla.mp4.jpg')) { const pr = import('./poster-demo.js').then((m) => aBlob(m.POSTER_EJEMPLO, ruta)); urls.set(ruta, pr); return pr; }
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
          // Como la 032 (revisión): un atleta solo borra lo suyo que puede borrar (con su fila; no un adjunto con mensajes)
          else if (!archivoBorrable(r)) continue;
          ficheros.delete(r); if (urls.has(r)) { try { URL.revokeObjectURL(urls.get(r)); } catch { /* */ } urls.delete(r); }
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
      // Para ver las siluetas de carga en la demo: localStorage «fbe-demo-retraso» = milisegundos por consulta
      const retraso = (() => { try { return Math.min(5000, Number(localStorage.getItem('fbe-demo-retraso')) || 0); } catch { return 0; } })();
      if (retraso) await new Promise((r) => setTimeout(r, retraso));
      // En la demo, el coach con la verificación activada y sin el segundo paso no ve nada (como en Supabase)
      const u = usuario();
      if (esCoach() && sesion?.aal !== 'aal2' && (miPerfil()?.exige_2fa || (u?.mfa || []).some((x) => x.estado === 'verified')) && !['perfiles'].includes(t)) return [];
      // Los cobros solo los ve el coach (migración 020)
      if (['cobros_atletas', 'pagos'].includes(t) && !esCoach()) return [];
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
      return copia(filas);
    },
    async insert(t, filas) {
      const lista = Array.isArray(filas) ? filas : [filas];
      const res = lista.map((f) => insertar(t, f));
      persistirYa();
      return copia(res);
    },
    async update(t, cambios, f) {
      if (['cobros_atletas', 'pagos', 'recetas'].includes(t) && !esCoach()) return [];
      // Como la 032: de una reacción, solo el emoji de la propia (en un mensaje en que aún se puede reaccionar); el estado
      // de las conversaciones, el coach; la presencia (solo con su función), los destacados y los cupos no se cambian
      if (['presencia', 'chat_cupos', 'comentario_destacados'].includes(t)) throw sinPermisoTabla(t);
      if (t === 'comentario_reacciones') {
        if (Object.keys(cambios).some((k) => k !== 'emoji')) throw new Error('De una reacción solo se cambia el emoji');
        if (!EMOJIS_CHAT.includes(cambios.emoji)) throw new Error('Algún valor está fuera de rango.');
        const filas = tabla(t).filter((x) => cumple(x, f) && x.usuario_id === sesion?.user.id);
        if (filas.length && deBajaYo()) throw new Error('Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada');
        for (const x of filas) { if (!comentarioReaccionable(x.comentario_id)) throw sinPermiso(); gastarCupoChat('reaccion'); Object.assign(x, { emoji: cambios.emoji, creado_en: ahora() }); }
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
        if (['comunidad_posts', 'comunidad_comentarios', 'comunidad_miembros', 'comunidad_reacciones', 'comunidad_cupos', 'comunidad_votos', 'comunidad_animos'].includes(t)) throw new Error('permission denied for table ' + t);
        if (!esCoach()) return [];
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
      for (const fila of filas) comprobarChecks(t, porFila.get(fila) || { ...fila, ...copia(c) });
      for (const fila of filas) {
        if (porFila.has(fila)) { Object.assign(fila, porFila.get(fila)); res.push(fila); continue; }
        // Como la migración 008: si la sesión cambia de semana, su día previsto se quita (salvo que venga uno nuevo)
        if (t === 'sesiones' && 'semana_id' in c && c.semana_id !== fila.semana_id && !('dia_previsto' in c)) fila.dia_previsto = null;
        // Como la 032: la ruta o la miniatura que deja de estar registrada, a la cola de Storage
        const antes = t === 'archivos' ? [fila.ruta, fila.poster_ruta] : [];
        Object.assign(fila, copia(c));
        if (t === 'archivos') encolar(antes.filter((r) => r && r !== fila.ruta && r !== fila.poster_ruta)); if (porFilaFecha.has(fila)) fila.cambio_pedido_en = porFilaFecha.get(fila);
        if (t === 'comidas_atleta') normalizarOpcional(fila);
        if (t === 'objetivos') comprobarMarca(fila); res.push(fila);
      }
      persistirYa();
      return copia(res);
    },
    async upsert(t, filas, onConflict) {
      soloCoach(t);
      if (['presencia', 'chat_cupos', 'comentario_destacados'].includes(t)) throw sinPermisoTabla(t);
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
      if (['cobros_atletas', 'pagos', 'recetas', 'recetas_atleta', 'tareas', 'tareas_plantillas', 'conversacion_estado'].includes(t) && !esCoach()) return [];
      // Como la 032: el atleta no borra mensajes a mano (los elimina para todos con comentario_eliminar); reacciones y
      // destacados, cada uno los suyos; la presencia y los cupos, nadie
      if (t === 'comentarios' && !esCoach()) return [];
      if (['presencia', 'chat_cupos'].includes(t)) throw sinPermisoTabla(t);
      if (t === 'comentario_reacciones' || t === 'comentario_destacados') {
        db[t] = tabla(t).filter((x) => !(cumple(x, f) && x.usuario_id === sesion?.user.id));
        persistirYa();
        return [];
      }
      // Como la 027: cada uno borra lo suyo (que ve); el coach, cualquier publicación o comentario, sus retos y avisos
      if (t.startsWith('comunidad_')) {
        if (['comunidad_ajustes', 'comunidad_miembros', 'comunidad_reacciones', 'comunidad_reportes', 'comunidad_cupos', 'comunidad_votos', 'comunidad_animos'].includes(t)) return [];
        if (t === 'comunidad_retos' && !esCoach()) return [];
        const ids = tabla(t).filter((x) => cumple(x, f) && (esCoach() || (x.autor_id === sesion?.user.id && VISIBLE[t](x)))).map((x) => x.id);
        borrarCascada(t, ids);
        persistirYa();
        return [];
      }
      if (SIN_ID.includes(t)) { db[t] = tabla(t).filter((x) => !cumple(x, f)); persistirYa(); return; }
      // Como la 032 (revisión): el atleta borra sus archivos, pero no un adjunto del chat que lleva mensajes
      const ids = tabla(t).filter((x) => cumple(x, f) && (t !== 'archivos' || esCoach() || (x.atleta_id === miAtletaId() && (x.tipo !== 'adjunto' || !archivoConMensajes(x.id))))).map((x) => x.id);
      if (t === 'preguntas_checkin' && ids.some(conRespuestas)) throw new Error('Esta pregunta ya tiene respuestas: archívala para no perderlas');
      // Como la 030: si se borra el archivo con que se hizo una tarea aún sin revisar, la tarea vuelve a pendiente
      if (t === 'archivos') for (const k of tabla('tareas')) if (ids.includes(k.archivo_id) && !k.revisada_en) Object.assign(k, { hecha_en: null, respuesta: null, archivo_id: null });
      borrarCascada(t, ids);
      persistirYa();
    },
    async rpc(nombre, args) {
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
        const rutas = adj && adj.tipo === 'adjunto' ? [adj.ruta, adj.poster_ruta].filter(Boolean) : [];
        vaciarComentario(c);
        if (rutas.length) { for (const k of tabla('comentarios')) if (k.archivo_id === adj.id && k.id !== c.id) k.archivo_id = null; borrarCascada('archivos', [adj.id]); }
        persistirYa();
        return { estado: 'eliminado', rutas };
      }
      // La cola de Storage, para el coach
      if (nombre === 'storage_pendiente') {
        if (!esCoach()) throw new Error('Solo el coach');
        return tabla('storage_por_borrar').slice(0, Math.min(1000, Math.max(1, args?.p_limite || 200))).map((x) => x.ruta);
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
        return copia(tabla('comentarios').filter((c) => !c.eliminado_en && !(c.archivo_id && ['Foto', 'Vídeo'].includes(c.texto)) && sin(c.texto).includes(q))
          .sort((a, b2) => String(b2.creado_en).localeCompare(String(a.creado_en))).slice(0, Math.min(100, Math.max(1, args.p_limite || 40)))
          .map(({ id, atleta_id, autor, texto, creado_en, enviar_en }) => ({ id, atleta_id, autor, texto: String(texto).slice(0, 300), creado_en, enviar_en: enviar_en || null })));
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
