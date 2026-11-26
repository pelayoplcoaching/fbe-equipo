// La copia completa del coach (Cuenta → Copia completa): qué tablas lleva y cuáles no, y por qué.
// (v0.209) Antes, cada migración nueva tenía que acordarse de añadir sus tablas aquí, y unas cuantas se quedaron fuera.
// Ahora test/copia.test.mjs lee todas las tablas que crean schema.sql y las migraciones y falla si alguna no está en la
// copia (aquí), en la copia privada (la función copia_privada de la base, para las que solo se abren con funciones) o
// en FUERA_DE_COPIA con su motivo.

// La comunidad del equipo (v0.43, migración 027)
const TABLAS_COMUNIDAD = ['comunidad_ajustes', 'comunidad_miembros', 'comunidad_posts', 'comunidad_comentarios', 'comunidad_reacciones', 'comunidad_reportes', 'comunidad_retos',
  'comunidad_votos', 'comunidad_animos', 'comunidad_comentario_reacciones', 'comunidad_bienvenidas', 'comunidad_companeros', 'comunidad_reto_equipos', 'comunidad_preguntas',
  // v0.72 (044): eventos, plantillas, atleta de la semana y moderación
  'comunidad_eventos', 'comunidad_evento_asistentes', 'comunidad_plantillas', 'comunidad_destacados', 'comunidad_moderacion',
  // (social, 053): duelos, intenciones, padrinos y los votos al compañero de la semana (el coach las lee enteras)
  'comunidad_duelos', 'comunidad_intenciones', 'comunidad_padrinos', 'comunidad_votos_semana',
  // (v0.209, 043) las publicaciones guardadas (las tuyas: las de cada atleta solo las ve él)
  'comunidad_guardados'];
// (v0.133, 056) lo de carrera; (v0.228, 089) y la mañana siguiente
const TABLAS_CARRERA = ['carrera_atleta', 'carrera_eventos', 'carrera_semanas', 'carrera_revisiones', 'carrera_recetas', 'carrera_mananas'];
// (059) lo de YouTube: el canal del coach y lo que ve cada atleta
const TABLAS_YOUTUBE = ['youtube_canal', 'videos_vistos'];
// (060) los descansos: la novedad de la semana, la travesía y los apuntes vistos
const TABLAS_DESCANSOS = ['novedades', 'travesia_semanas', 'apuntes_vistos', 'travesia_perfil', 'travesia_dia', 'travesia_aullidos', 'travesia_liga', 'travesia_reto_equipo', 'travesia_fiesta', 'apuntes_semanas', 'apuntes_duelos'];
// (068) las frases del coach, con su voz (los audios van en su bucket; aquí, sus filas)
const TABLAS_SONIDO = ['voces_coach'];
// (v0.209) las que se quedaron fuera: el chat (fijados, silencios, listas de difusión y encuestas, 033 y 034), la
// privacidad leída (034), los umbrales de velocidad (039), las imágenes «a su medida» (080) y tus ajustes de la
// revisión, de Revisar, del panel de atletas y de «A quién escribir» (082 a 086). (Los silencios y las preferencias de
// avisos, las tuyas: las de cada atleta solo las ve él)
const TABLAS_209 = ['conversacion_fijado', 'chat_silencios', 'listas_difusion', 'listas_difusion_miembros', 'encuestas_chat', 'encuesta_votos',
  'privacidad_vista', 'preferencias_notificaciones', 'umbrales_velocidad', 'atletas_imagenes', 'revision_ajustes', 'revisar_apartados', 'atletas_panel', 'panel_ajustes', 'radar_ajustes'];

// (100) FBE Esencial: lo que quien va por su cuenta le cuenta a la app (su pregunta para el directo, «¿Cómo vamos?»); (103) lo
// que enciendes o escribes en tu panel (con su registro), a quién has escrito, por qué se van y lo que más se consulta
const TABLAS_ESENCIAL = ['esencial_notas', 'esencial_ajustes', 'esencial_ajustes_registro', 'esencial_contactos', 'esencial_bajas', 'esencial_consultas',
  // (105) el perfil del cuestionario de nutrición
  'nutricion_perfiles'];

// Las que puede no tener aún una base (cobros, 020; comidas, 022; comunidad, 027; tareas, 030; el chat, 032; los
// vídeos, 035; la revisión semanal, 040…): sin ellas, la copia sale igual
export const TABLAS_OPCIONALES = ['cobros_atletas', 'pagos', 'recetas', 'recetas_atleta', 'comidas_atleta', 'menu_comidas', 'menu_dias', 'recetas_favoritas', 'guias', 'fichas_ejercicio', 'ejercicios_fichas', ...TABLAS_COMUNIDAD, 'tareas', 'tareas_plantillas',
  'comentario_reacciones', 'comentario_destacados', 'conversacion_estado', 'video_revisiones', 'tecnica_plantillas',
  'recordatorios_tecnica', 'frases_correccion', 'videos_modelo', 'video_autoevaluacion', 'revisiones_semanales', ...TABLAS_CARRERA, ...TABLAS_YOUTUBE, ...TABLAS_DESCANSOS, ...TABLAS_SONIDO, ...TABLAS_209, ...TABLAS_ESENCIAL];

// Tablas de una copia completa (todo lo que el coach puede leer, menos lo de FUERA_DE_COPIA)
export const TABLAS_COPIA = ['perfiles', 'atletas', 'invitaciones', 'consentimientos', 'ejercicios', 'bloques', 'semanas', 'sesiones',
  'sesion_ejercicios', 'series', 'pesos', 'checkins', 'molestias', 'notas_coach', 'medidas', 'marcas', 'objetivos',
  'archivos', 'comentarios', 'recursos', 'notas_ejercicio', 'respuestas_guardadas', 'avisos', 'habitos', 'registros_habito',
  'planes_nutricion', 'registros_nutricion', 'cuestionarios', 'preguntas_checkin', ...TABLAS_OPCIONALES];

// Lo que no va en la copia, a propósito (no son datos que haga falta recuperar, o no se pueden leer ni hace falta)
export const FUERA_DE_COPIA = Object.freeze({
  fbe_migraciones: 'qué migraciones tiene la base: es de la base, no de tus datos (Cuenta te avisa si falta alguna)',
  intentos_invitacion: 'los intentos fallidos de códigos de invitación: son para frenar a quien prueba códigos al azar',
  suscripciones_push: 'las direcciones de los avisos de cada móvil: cada móvil las vuelve a dar al abrir la app',
  notificaciones: 'la cola de avisos ya enviados o por enviar',
  errores_app: 'los errores de la app: un registro técnico que se vacía solo',
  rendimiento_app: 'los tiempos de la app: un registro técnico que se vacía solo',
  presencia: 'quién está conectado ahora mismo',
  chat_cupos: 'el contador del límite de mensajes por minuto',
  comunidad_cupos: 'el contador del límite de publicaciones por minuto',
  travesia_envios: 'el registro de envíos de La travesía, solo para que no se repitan',
  reloj: 'el enlace del reloj de cada atleta: se vuelve a vincular desde el reloj',
  menu_fotos: 'las fotos de los platos: pesan mucho y se borran solas a los 30 días',
  animo_fijados: 'el rincón de ánimo de cada atleta: solo lo ve él, ni siquiera su coach',
});
