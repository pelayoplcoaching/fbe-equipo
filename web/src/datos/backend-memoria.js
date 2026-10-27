// Backend de la demo: todo en el navegador, con el mismo interfaz que el de Supabase.
// No hay permisos por fila: la demo la usa una sola persona que puede cambiar de rol. Sí imita los
// triggers que cambian lo que ve la app (autor de los comentarios, revisiones pendientes…).
import { hoyISO, sumarDias as sumar, diasEntre as diasEntreIso } from '../logica/fechas.js';
import { textoVisible } from '../logica/texto.js';
import { resultadoCribado } from '../logica/cuestionario.js';
import { respuestaValida } from '../logica/preguntas.js';
import { dibujoValido } from '../logica/dibujo.js';
import { cardioValido, cardioHechoValido } from '../logica/cardio.js';

const ahora = () => new Date().toISOString();
const uuid = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16)));

export const CODIGO_MFA_DEMO = '123456';

const DEFECTOS = {
  perfiles: () => ({ rol: 'atleta', creado_en: ahora(), exige_2fa: false, foto: null }),
  atletas: () => ({ estado: 'invitado', fecha_alta: hoyISO(), creado_en: ahora(), perfil_id: null, email: null, objetivo: null, notion_url: null, progresion_auto: true, volumen_objetivo: null, checkin_apartados: null, nutricion: true, nivel: null }),
  invitaciones: () => ({ creada_en: ahora(), usada_en: null }),
  consentimientos: () => ({ aceptado_en: ahora(), revocado_en: null }),
  ejercicios: () => ({ grupos_musculares: [], activo: true, variante: null, video_url: null, instrucciones: null, errores: null, alternativas: [], tipo: [], rango_reps: null, creado_en: ahora() }),
  bloques: () => ({ es_plantilla: false, estado: 'planificado', atleta_id: null, numero: null, foco: null, objetivo: null, descripcion: null, fecha_inicio: null, fecha_fin: null, creado_en: ahora() }),
  semanas: () => ({ programacion: 'no_iniciada', foco: null, fecha_inicio: null, nota_coach: null }),
  sesiones: () => ({ tipo: 'fuerza', completada: false, intencion: null, dinamica: null, fecha_realizada: null, nota_atleta: null, duracion_min: null, rpe_sesion: null, revisada_en: null, preparacion: null, dia_previsto: null, cardio: null, cardio_hecho: null }),
  sesion_ejercicios: () => ({ prioridad: 'media', superserie: null, reps_min: null, reps_max: null, rir_objetivo: null, rpe_objetivo: null, carga_sugerida_kg: null, descanso_seg: null, tempo: null, notas_coach: null, variante: null, backoff_pct: null }),
  series: () => ({ registrada_en: ahora(), kg: null, reps: null, rpe: null, rir: null, nota: null, sustituto_id: null }),
  pesos: () => ({ fecha: hoyISO(), notas: null }),
  checkins: () => ({ creado_en: ahora(), revisado_en: null, respuestas: null }),
  molestias: () => ({ notas: null }),
  notas_coach: () => ({ creado_en: ahora() }),
  medidas: () => ({ fecha: hoyISO(), cintura_cm: null, cadera_cm: null, pecho_cm: null, brazo_cm: null, muslo_cm: null, pantorrilla_cm: null, notas: null }),
  marcas: () => ({ fecha: hoyISO(), reps: 1, tipo: 'test', notas: null }),
  objetivos: () => ({ progreso_pct: 0, estado: 'no_iniciado', descripcion: null, fecha_limite: null, ejercicio_id: null, kg_objetivo: null, reps_objetivo: null, e1rm_inicio: null, creado_en: ahora() }),
  archivos: () => ({ fecha: hoyISO(), sesion_ejercicio_id: null, ejercicio_id: null, comentario_coach: null, nota_atleta: null, mime: null, bytes: null, revisado_en: null, creado_en: ahora(), pose: null, poster_ruta: null, duracion_seg: null, destacado: false }),
  comentarios: () => ({ sesion_id: null, checkin_id: null, archivo_id: null, leido_en: null, creado_en: ahora(), dibujo: null, adjunto: false }),
  recursos: () => ({ atleta_id: null, categoria: 'general', descripcion: null, url: null, orden: 0, creado_en: ahora() }),
  notas_ejercicio: () => ({ actualizado_en: ahora() }),
  respuestas_guardadas: () => ({ orden: 0, creado_en: ahora() }),
  avisos: () => ({ atleta_id: null, desde: hoyISO(), hasta: null, creado_en: ahora() }),
  habitos: () => ({ tipo: 'numero', objetivo: null, unidad: null, sentido: 'al_menos', dias_semana: 7, icono: 'libre', orden: 0, activo: true, creado_en: ahora() }),
  registros_habito: () => ({ actualizado_en: ahora() }),
  planes_nutricion: () => ({ modo: 'macros', fase: 'mantener', ritmo_pct: null, kcal: null, proteina_g: null, carbos_g: null, grasa_g: null, fibra_g: null, kcal_descanso: null, carbos_descanso_g: null, grasa_descanso_g: null, pautas: null, motivo: null, creado_en: ahora() }),
  registros_nutricion: () => ({ kcal: null, proteina_g: null, carbos_g: null, grasa_g: null, fibra_g: null, completo: true, cumplido: null, nota: null, actualizado_en: ahora() }),
  preferencias_notificaciones: () => ({ desactivados: ['sesion_hecha'], hora_manana: '08:30:00', hora_tarde: '21:00:00', dia_checkin: 7, silencio_desde: '22:30:00', silencio_hasta: '08:00:00', email: false, actualizado_en: ahora() }),
  suscripciones_push: () => ({ dispositivo: null, creada_en: ahora(), usada_en: null, fallos: 0, ultimo_error: null }),
  cuestionarios: () => ({ objetivo: null, objetivos: null, objetivo_detalle: null, experiencia: null, dias_semana: null, minutos_sesion: null, lugar: null, material: [],
    otros_deportes: null, activo: null, enfermedad: null, enfermedad_detalle: null, sintomas: null, otras: null, medicacion_detalle: null,
    lesiones: null, alergias: null, resultado: null, completado_en: null, pedido_en: null, revisado_en: null, creado_en: ahora(), actualizado_en: ahora() }),
  preguntas_checkin: () => ({ atleta_id: null, tipo: 'escala', unidad: null, ayuda: null, etiqueta_min: null, etiqueta_max: null, orden: 0, activa: true, creado_en: ahora() }),
};

// Borrados en cascada, como en el esquema SQL.
const CASCADA = {
  atletas: [['bloques', 'atleta_id'], ['invitaciones', 'atleta_id'], ['series', 'atleta_id'], ['pesos', 'atleta_id'],
    ['checkins', 'atleta_id'], ['molestias', 'atleta_id'], ['notas_coach', 'atleta_id'], ['medidas', 'atleta_id'],
    ['marcas', 'atleta_id'], ['objetivos', 'atleta_id'], ['archivos', 'atleta_id'], ['comentarios', 'atleta_id'], ['recursos', 'atleta_id'],
    ['notas_ejercicio', 'atleta_id'], ['avisos', 'atleta_id'], ['habitos', 'atleta_id'], ['registros_habito', 'atleta_id'],
    ['planes_nutricion', 'atleta_id'], ['registros_nutricion', 'atleta_id'], ['cuestionarios', 'atleta_id'], ['preguntas_checkin', 'atleta_id']],
  habitos: [['registros_habito', 'habito_id']],
  bloques: [['semanas', 'bloque_id']],
  semanas: [['sesiones', 'semana_id']],
  sesiones: [['sesion_ejercicios', 'sesion_id'], ['comentarios', 'sesion_id']],
  sesion_ejercicios: [['series', 'sesion_ejercicio_id']],
};
// Al borrar estas filas, los comentarios se quedan sin el enlace (on delete set null)
const ANULAR = { checkins: [['comentarios', 'checkin_id']], archivos: [['comentarios', 'archivo_id']], ejercicios: [['objetivos', 'ejercicio_id']], sesion_ejercicios: [['archivos', 'sesion_ejercicio_id']] };

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
  const ESCRIBE_ATLETA = ['series', 'pesos', 'checkins', 'molestias', 'medidas', 'marcas', 'comentarios', 'archivos', 'sesiones', 'notas_ejercicio', 'registros_habito', 'registros_nutricion', 'cuestionarios'];
  const comprobarAlta = (t) => {
    if (ESCRIBE_ATLETA.includes(t) && deBaja()) throw new Error('Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada');
  };
  const atletaDeSesion = (sesionId) => {
    const s = buscar('sesiones', sesionId);
    const w = s && buscar('semanas', s.semana_id);
    return (w && buscar('bloques', w.bloque_id))?.atleta_id ?? null;
  };

  // Lo que en Supabase hacen los triggers
  function antesDeInsertar(t, f) {
    comprobarAlta(t);
    if (t === 'series' && !f.atleta_id) {
      const se = buscar('sesion_ejercicios', f.sesion_ejercicio_id);
      f.atleta_id = se ? atletaDeSesion(se.sesion_id) : null;
    }
    if (t === 'comentarios') {
      f.autor = esCoach() ? 'coach' : 'atleta';
      if (f.sesion_id) f.atleta_id = atletaDeSesion(f.sesion_id);
      else if (f.checkin_id) f.atleta_id = buscar('checkins', f.checkin_id)?.atleta_id;
      else if (f.archivo_id) f.atleta_id = buscar('archivos', f.archivo_id)?.atleta_id;
      if (!f.atleta_id) throw new Error('No se puede comentar aquí');
      // Como la 014: el adjunto lo fija la base según el tipo del archivo
      f.adjunto = !!f.archivo_id && buscar('archivos', f.archivo_id)?.tipo === 'adjunto';
      f.leido_en = null;
      f.creado_en = ahora();
    }
    if (!esCoach()) {
      if (t === 'checkins') f.revisado_en = null;
      if (t === 'archivos') { f.revisado_en = null; f.comentario_coach = null; }
    }
    if (t === 'registros_habito') prepararRegistroHabito(f);
    if (t === 'registros_nutricion') prepararRegistroNutricion(f);
    if (t === 'sesiones') comprobarDiaPrevisto(f);
    if (t === 'cuestionarios') prepararCuestionario(f, null);
    if (t === 'checkins') validarRespuestas(f, null);
  }
  function despuesDeInsertar(t, f) {
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
    if (t === 'perfiles' && c.exige_2fa === false && miPerfil()?.exige_2fa && sesion?.aal !== 'aal2') {
      throw new Error('Para desactivar la verificación en dos pasos tienes que haber entrado con ella');
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
  const CHECKS = {
    // Como la migración 015: la foto de perfil, una imagen pequeña en base64
    perfiles: (f) => f.foto == null || (String(f.foto).length <= 80000 && /^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(String(f.foto))),
    sesion_ejercicios: (f) => {
      const series = n(f.series), rmin = n(f.reps_min), rmax = n(f.reps_max);
      return series !== null && entero(series) && entre(series, 1, 20) && entero(rmin) && entre(rmin, 0, 1e6) && entero(rmax) && entre(rmax, 0, 1e6)
        && (rmin === null || rmax === null || rmin <= rmax) && entre(n(f.rir_objetivo), 0, 10) && entre(n(f.rpe_objetivo), 1, 10)
        && entre(n(f.carga_sugerida_kg), 0, 9999.99) && entero(n(f.descanso_seg)) && entre(n(f.descanso_seg), 0, 900)
        && (n(f.backoff_pct) === null || (n(f.backoff_pct) >= 1 && n(f.backoff_pct) <= 50 && series >= 2));
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
      const tipos = ['respuesta', 'semana', 'aviso', 'sesion_hoy', 'checkin', 'habitos', 'nutricion', 'cuestionario', 'mensaje', 'checkin_recibido', 'video_recibido', 'sesion_hecha', 'cuestionario_recibido'];
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
      && (f.nivel == null || ['novato', 'novato_intermedio', 'intermedio', 'avanzado'].includes(f.nivel)) && (f.nutricion === undefined || typeof f.nutricion === 'boolean'),
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

  function insertar(t, fila) {
    const nueva = { id: uuid(), ...(DEFECTOS[t]?.() || {}), ...copia(fila) };
    antesDeInsertar(t, nueva);
    if (t === 'objetivos') comprobarMarca(nueva);
    comprobarChecks(t, nueva);
    tabla(t).push(nueva);
    despuesDeInsertar(t, nueva);
    return nueva;
  }

  function borrarCascada(t, ids) {
    // Como la 014: el mensaje de un adjunto del chat se va con el archivo
    if (t === 'archivos') {
      const adj = tabla('archivos').filter((a) => ids.includes(a.id) && a.tipo === 'adjunto').map((a) => a.id);
      if (adj.length) db.comentarios = tabla('comentarios').filter((c) => !adj.includes(c.archivo_id));
    }
    for (const [hija, col] of CASCADA[t] || []) {
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

  const b = {
    modo: 'demo',
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
      async subir(ruta, archivo) { ficheros.set(ruta, archivo); },
      async url(ruta) {
        if (urls.has(ruta)) return urls.get(ruta);
        const f = ficheros.get(ruta);
        // Los ejemplos de la demo van incrustados en base64: se sirven como blob (la política de seguridad de
        // la app no deja cargar «data:» en vídeos e imágenes)
        // (la promesa se guarda antes de esperar: dos peticiones a la vez de la misma ruta comparten el blob)
        if (!f && ruta.endsWith('/ejemplo-sentadilla.mp4')) { const pr = import('./video-demo.js').then((m) => aBlob(m.VIDEO_EJEMPLO, ruta)); urls.set(ruta, pr); return pr; }
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
      async borrar(rutas) {
        for (const r of rutas) { ficheros.delete(r); if (urls.has(r)) { try { URL.revokeObjectURL(urls.get(r)); } catch { /* */ } urls.delete(r); } }
      },
      async listar(carpeta) { return [...ficheros.keys()].filter((r) => r.startsWith(`${carpeta}/`)); },
    },
    async select(t, f = {}) {
      // Para ver las siluetas de carga en la demo: localStorage «fbe-demo-retraso» = milisegundos por consulta
      const retraso = (() => { try { return Math.min(5000, Number(localStorage.getItem('fbe-demo-retraso')) || 0); } catch { return 0; } })();
      if (retraso) await new Promise((r) => setTimeout(r, retraso));
      // En la demo, el coach con la verificación activada y sin el segundo paso no ve nada (como en Supabase)
      const u = usuario();
      if (esCoach() && sesion?.aal !== 'aal2' && (miPerfil()?.exige_2fa || (u?.mfa || []).some((x) => x.estado === 'verified')) && !['perfiles'].includes(t)) return [];
      let filas = tabla(t).filter((x) => cumple(x, f));
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
      const res = [];
      const c = antesDeActualizar(t, cambios);
      const filas = tabla(t).filter((fila) => cumple(fila, f));
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
      if ((t === 'planes_nutricion' || t === 'registros_nutricion') && 'atleta_id' in c && filas.some((fila) => fila.atleta_id !== c.atleta_id)) throw new Error('No se puede pasar a otro atleta');
      if (t === 'registros_nutricion') for (const fila of filas) prepararRegistroNutricion({ ...fila, ...c });
      if (t === 'objetivos') for (const fila of filas) comprobarMarca({ ...fila, ...copia(c) });
      if (t === 'preguntas_checkin') for (const fila of filas) protegerPregunta(fila, c);
      if (t === 'checkins' && 'respuestas' in c) for (const fila of filas) validarRespuestas({ ...fila, ...copia(c) }, fila);
      // Cuestionarios: lo que pone el trigger depende de cada fila
      const porFila = new Map();
      if (t === 'cuestionarios') for (const fila of filas) { const m = { ...copia(fila), ...copia(c) }; prepararCuestionario(m, fila); porFila.set(fila, m); }
      for (const fila of filas) comprobarChecks(t, porFila.get(fila) || { ...fila, ...copia(c) });
      for (const fila of filas) {
        if (porFila.has(fila)) { Object.assign(fila, porFila.get(fila)); res.push(fila); continue; }
        // Como la migración 008: si la sesión cambia de semana, su día previsto se quita (salvo que venga uno nuevo)
        if (t === 'sesiones' && 'semana_id' in c && c.semana_id !== fila.semana_id && !('dia_previsto' in c)) fila.dia_previsto = null;
        Object.assign(fila, copia(c)); if (t === 'objetivos') comprobarMarca(fila); res.push(fila);
      }
      persistirYa();
      return copia(res);
    },
    async upsert(t, filas, onConflict) {
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
          return existente;
        }
        return insertar(t, f);
      });
      persistirYa();
      return copia(res);
    },
    async delete(t, f) {
      const ids = tabla(t).filter((x) => cumple(x, f)).map((x) => x.id);
      if (t === 'preguntas_checkin' && ids.some(conRespuestas)) throw new Error('Esta pregunta ya tiene respuestas: archívala para no perderlas');
      borrarCascada(t, ids);
      persistirYa();
    },
    async rpc(nombre, args) {
      const uid = sesion?.user.id;
      const perfil = tabla('perfiles').find((p) => p.id === uid);
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
      throw new Error(`Función no disponible en la demo: ${nombre}`);
    },
  };
  return b;
}
