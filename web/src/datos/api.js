// Funciones de la app sobre cualquier backend (Supabase o demo). Toda la lógica vive aquí, una sola vez.
import { hoyISO, lunesDe, sumarDias, aISO, rangoSemana, diasEntre } from '../logica/fechas.js';
import { resumenAtleta, semanaActual, e1rmPorSemana, seriesPorGrupo, resumenEjercicio, seriesACsv, mejoresMarcas, vitrina, racha, mapaCalor, cargaSemanal, cambioCarga, eventosRecord, resumenSemanal, num, tendenciaPeso, ritmoPeso } from '../logica/calculos.js';
import { rachaMaxima, calcularLogros } from '../logica/logros.js';
import { informeBloque, cumplimiento } from '../logica/informe.js';
import { progresoObjetivo, mejorReciente } from '../logica/objetivos.js';
import { resumenHabito, cumplimientoHabitos } from '../logica/habitos.js';
import { progresarPauta, opcionesDe } from '../logica/progresion.js';
import { resumenCobros, cobradoEnMes, sumarMeses } from '../logica/cobros.js';
import { planVigente, planSiguiente, objetivoDelDia, semanaNutricion, gastoAdaptativo, gastoPorSemanas, ajusteNutricion, avisosNutricion } from '../logica/nutricion.js';
import { conDefecto, preferenciasValidas } from '../logica/notificaciones.js';
import { limpiarCuestionario, avisoCuestionario, SIN_SALUD } from '../logica/cuestionario.js';
import { APARTADOS_CHECKIN, preguntasDe, respuestasDe } from '../logica/preguntas.js';
import { dibujoValido } from '../logica/dibujo.js';
import { tuDia } from '../logica/dia.js';
import { cardioHechoValido, cardioPorSemana, textoCardioHecho, NOMBRE_MODALIDAD } from '../logica/cardio.js';
import { pendiente as cuestionarioPendiente } from '../logica/cuestionario.js';
import { limpiarReceta, recetarioPorToma, tomasDe, ordenarTomas, entradaMenu, copiarMenu, cambiarRaciones } from '../logica/comidas.js';

export const VERSION_CONSENTIMIENTO = '2026-10';

const porId = (filas) => Object.fromEntries(filas.map((f) => [f.id, f]));
const agrupar = (filas, col) => filas.reduce((m, f) => ((m[f[col]] ||= []).push(f), m), {});
const unicos = (xs) => [...new Set(xs.filter((x) => x != null))];
// Servicio y nivel (v0.22) sin la migración 018 en la base: un aviso que diga qué falta, no el error técnico
const falta020 = (e) => {
  const m = e?.message || '';
  if (/\b(pagos|cobros_atletas)\b/.test(m) && /schema cache|does not exist|no existe/i.test(m)) {
    throw new Error(`Para el control de cobros falta ejecutar la migración 020 en Supabase (supabase/migraciones/020_cobros.sql). Detalle: ${m}`);
  }
  if (/\b(pagos|cobros_atletas)\b/.test(m) && /permission denied|permiso denegado/i.test(m)) {
    throw new Error(`La base no deja leer los cobros (permisos de la migración 020). Detalle: ${m}`);
  }
  throw e;
};
// Comidas (v0.26) sin la migración 022 en la base
const TABLAS_022 = /\b(recetas|recetas_atleta|comidas_atleta|menu_comidas|entrenamiento)\b/;
const falta022 = (e) => {
  const m = e?.message || '';
  if (TABLAS_022.test(m) && /schema cache|does not exist|no existe|column|columna/i.test(m)) {
    throw new Error(`Para las recetas, el menú y el servicio «solo nutrición» falta ejecutar la migración 022 en Supabase (supabase/migraciones/022_comidas.sql). Detalle: ${m}`);
  }
  throw e;
};
const falta018 = (e) => {
  if (/\b(nivel|nutricion)\b/.test(e?.message || '') && /column|columna|schema cache/i.test(e?.message || '')) {
    throw new Error('Para elegir servicio y nivel falta ejecutar la migración 018 en Supabase (supabase/migraciones/018_servicio_y_nivel.sql).');
  }
  throw e;
};
// Día local (en España, no en UTC) de una marca de tiempo; una fecha sin hora se deja tal cual
const fechaDe = (iso) => {
  if (!iso) return null;
  const t = String(iso);
  if (t.length <= 10) return t;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? t.slice(0, 10) : aISO(d);
};
const aleatorio = () => (globalThis.crypto?.randomUUID?.() || String(Math.random()).slice(2)).replace(/-/g, '').slice(0, 10);

// Semanas que cuentan para la racha y el cumplimiento: las publicadas de bloques no cancelados; si dos bloques
// publican la misma semana (el nuevo empezó antes de acabar el viejo), manda la del bloque más reciente.
function semanasQueCuentan(semanas, bloques) {
  const bl = Object.fromEntries(bloques.map((x) => [x.id, x]));
  const reciente = (x) => [x.fecha_inicio || '', String(x.numero || 0).padStart(4, '0')].join('|');
  const elegida = new Map();
  for (const w of semanas) {
    const x = bl[w.bloque_id];
    if (!x || x.estado === 'cancelado' || (w.programacion && w.programacion !== 'programada') || !w.fecha_inicio) continue;
    const k = `${x.atleta_id || ''}|${lunesDe(w.fecha_inicio)}`;
    const otra = elegida.get(k);
    if (!otra || reciente(bl[otra.bloque_id]) < reciente(x)) elegida.set(k, w);
  }
  const quedan = new Set(elegida.values());
  return semanas.filter((w) => quedan.has(w));
}
// «Mixto» es un foco de bloque, no de semana (la base no lo admite en semanas)
const focoSemana = (f) => (f === 'mixto' ? null : f ?? null);
const COLS_BLOQUE = 'id,atleta_id,estado,fecha_inicio,numero';
// El bloque «actual» de un atleta (lo que ve y lo que sale en el panel): el activo o ajustado; si no hay, el
// planificado más reciente
function bloqueActual(bloques) {
  const orden = [...bloques].sort((x, y) => ((x.fecha_inicio || '') === (y.fecha_inicio || '') ? (y.numero || 0) - (x.numero || 0) : (x.fecha_inicio || '') < (y.fecha_inicio || '') ? 1 : -1));
  return orden.find((x) => ['activo', 'ajustado'].includes(x.estado)) || orden.find((x) => x.estado === 'planificado') || null;
}

// Campos que se copian al duplicar prescripción
const CAMPOS_SE = ['ejercicio_id', 'orden', 'superserie', 'prioridad', 'series', 'reps_min', 'reps_max',
  'rir_objetivo', 'rpe_objetivo', 'carga_sugerida_kg', 'descanso_seg', 'tempo', 'notas_coach', 'variante', 'backoff_pct'];

// Tablas de una copia completa (todo menos los intentos fallidos de códigos)
const TABLAS_COPIA = ['perfiles', 'atletas', 'invitaciones', 'consentimientos', 'ejercicios', 'bloques', 'semanas', 'sesiones',
  'sesion_ejercicios', 'series', 'pesos', 'checkins', 'molestias', 'notas_coach', 'medidas', 'marcas', 'objetivos',
  'archivos', 'comentarios', 'recursos', 'notas_ejercicio', 'respuestas_guardadas', 'avisos', 'habitos', 'registros_habito',
  'planes_nutricion', 'registros_nutricion', 'cuestionarios', 'preguntas_checkin', 'cobros_atletas', 'pagos',
  'recetas', 'recetas_atleta', 'comidas_atleta', 'menu_comidas'];
// Las que puede no tener aún una base (cobros, 020; comidas, 022): sin ellas, la copia sale igual
const TABLAS_OPCIONALES = ['cobros_atletas', 'pagos', 'recetas', 'recetas_atleta', 'comidas_atleta', 'menu_comidas'];
// Las recetas sin la foto grande (para las listas: la miniatura basta)
const COLS_RECETA = 'id,nombre,tomas,raciones,kcal,proteina_g,carbos_g,grasa_g,ingredientes,preparacion,minutos,etiquetas,foto_mini,creada_en,actualizada_en';

// Qué columna marca la revisión del coach en cada cosa revisable
const REVISION = { sesion: ['sesiones', 'revisada_en'], checkin: ['checkins', 'revisado_en'], archivo: ['archivos', 'revisado_en'] };

export const LIMITE_ARCHIVO_MB = 200;
// Foto de perfil: tamaño máximo del texto base64 (como la base, perfiles_foto_valida)
export const FOTO_MAX = 80000;

export function crearApi(backend) {
  // Cualquier escritura invalida lo que se haya guardado en memoria (el historial compartido, abajo)
  let generacion = 0;
  const escribe = (f) => (...a) => { generacion++; return f(...a); };
  const b = Object.create(backend);
  // Notificaciones: después de algo que avisa a otra persona (un comentario, un aviso, un check-in, una semana
  // publicada, una sesión terminada), se pide al servidor que envíe ya lo que haya en la cola, para que llegue
  // al momento y no en el siguiente minuto. Una sola llamada por ráfaga; si falla, el programador lo envía igual.
  let temporizadorEnvio = null;
  const empujar = (ms = 1500) => {
    if (typeof backend.funcion !== 'function') return;
    clearTimeout(temporizadorEnvio);
    temporizadorEnvio = setTimeout(() => { Promise.resolve().then(() => backend.funcion('enviar-notificaciones')).catch(() => {}); }, ms);
  };
  const avisa = (m, t, c) => ((m === 'insert' || m === 'upsert') && ['comentarios', 'avisos', 'checkins', 'semanas'].includes(t))
    || (m === 'update' && ((t === 'semanas' && c?.programacion === 'programada') || (t === 'sesiones' && c?.completada === true) || (t === 'avisos' && 'texto' in (c || {}))));
  for (const m of ['insert', 'update', 'upsert', 'delete', 'rpc']) {
    const f = escribe(backend[m].bind(backend));
    b[m] = (...a) => {
      const r = f(...a);
      if (avisa(m, a[0], a[1])) Promise.resolve(r).then(() => empujar(), () => {});
      // Las pantallas que resumen varias cosas («Tu día») se ponen al día tras cualquier escritura
      if (typeof window !== 'undefined') Promise.resolve(r).then(() => window.dispatchEvent(new Event('fbe-cambio')), () => {});
      return r;
    };
  }
  // El historial completo lo piden a la vez varias partes de una pantalla (gráficas, récords, actividad…):
  // se descarga una vez y se reparte, mientras no haya escrituras y durante unos segundos como mucho
  const historiales = new Map();
  const uid = () => b.auth.sesion()?.user?.id || null;

  // Como mucho 15 preguntas activas solo para un atleta y 10 para todos (un check-in que se rellena en un minuto)
  const CUPO_PREGUNTAS = { atleta: 15, todos: 10 };
  async function comprobarCupoPreguntas(atletaId) {
    const activas = await b.select('preguntas_checkin', atletaId ? { eq: { atleta_id: atletaId, activa: true }, cols: 'id' } : { eq: { activa: true }, nulo: ['atleta_id'], cols: 'id' });
    const cupo = atletaId ? CUPO_PREGUNTAS.atleta : CUPO_PREGUNTAS.todos;
    if (activas.length >= cupo) throw new Error(`Ya hay ${cupo} preguntas activas ${atletaId ? 'solo para este atleta' : 'para todos'}: archiva alguna antes de añadir otra`);
  }

  const api = {
    backend: b,
    uid,

    // ------------------------------------------------------------ sesión y perfil
    async perfil() {
      const id = uid();
      if (!id) return null;
      return (await b.select('perfiles', { eq: { id } }))[0] || null;
    },
    // Foto de perfil propia (v0.19): una imagen ya recortada y comprimida (data:image/jpeg;base64,…) o null para quitarla
    async cambiarFoto(foto) {
      if (foto != null && (typeof foto !== 'string' || foto.length > FOTO_MAX || !/^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(foto))) {
        throw new Error('La foto no es válida. Prueba con otra (JPEG o PNG).');
      }
      return (await b.update('perfiles', { foto: foto || null }, { eq: { id: uid() } }))[0] || null;
    },
    // El nombre propio (el coach: el que ven sus atletas en el chat y en las notificaciones)
    async cambiarNombre(nombre) {
      const n = String(nombre || '').trim().replace(/\s+/g, ' ');
      if (!n || n.length > 60) throw new Error('Escribe un nombre (hasta 60 letras).');
      return (await b.update('perfiles', { nombre: n }, { eq: { id: uid() } }))[0] || null;
    },
    // Registro de errores (v0.21): lo apunta la base a nombre de quien tiene la sesión; en la demo, nada
    async registrarError({ mensaje, pantalla = null, detalle = null, version = null, navegador = null }) {
      if (b.modo === 'demo' || !uid()) return;
      await b.rpc('registrar_error', { p_mensaje: mensaje, p_pantalla: pantalla, p_detalle: detalle, p_version: version, p_navegador: navegador });
    },
    // Los errores de los últimos días, con el nombre de quien los tuvo (solo el coach)
    async erroresApp({ limite = 200 } = {}) {
      const [errores, perfiles, atletas] = await Promise.all([
        b.select('errores_app', { order: [['creado_en', 'desc']], limit: limite }),
        b.select('perfiles', { cols: 'id,nombre,rol' }).catch(() => []),
        b.select('atletas', { cols: 'perfil_id,nombre' }).catch(() => []),
      ]);
      const P = porId(perfiles);
      const nombreDe = (id) => atletas.find((a) => a.perfil_id === id)?.nombre || (P[id]?.rol === 'coach' ? 'Tú' : P[id]?.nombre) || 'Alguien';
      return errores.map((e) => ({ ...e, quien: nombreDe(e.perfil_id) }));
    },
    async borrarErroresApp() {
      return b.delete('errores_app', { gte: { creado_en: '2000-01-01' } });
    },
    // La foto del coach, para el chat del atleta (la base solo deja ver eso del perfil del coach)
    async fotoCoach() {
      return (await b.rpc('foto_coach', {}).catch(() => null)) || null;
    },
    async miAtleta() {
      const id = uid();
      if (!id) return null;
      return (await b.select('atletas', { eq: { perfil_id: id }, limit: 1 }))[0] || null;
    },
    async canjearCodigo(codigo) {
      return b.rpc('canjear_invitacion', { p_codigo: codigo });
    },
    async consentimientos() {
      return b.select('consentimientos', { eq: { perfil_id: uid() }, order: [['aceptado_en', 'desc']] });
    },
    async tieneConsentimientoSalud() {
      const c = await api.consentimientos();
      return c.some((x) => x.tipo === 'datos_salud' && !x.revocado_en);
    },
    async darConsentimientos(tipos = ['privacidad', 'datos_salud']) {
      return b.insert('consentimientos', tipos.map((tipo) => ({ perfil_id: uid(), tipo, version: VERSION_CONSENTIMIENTO })));
    },
    async revocarConsentimiento(id) {
      return b.update('consentimientos', { revocado_en: new Date().toISOString() }, { eq: { id } });
    },

    // ------------------------------------------------------------ notificaciones (de la cuenta que ha entrado)
    async preferenciasNotificaciones() {
      return conDefecto((await b.select('preferencias_notificaciones', { eq: { usuario_id: uid() } }))[0]);
    },
    async guardarPreferenciasNotificaciones(p) {
      const v = conDefecto(p);
      const fila = {
        usuario_id: uid(), desactivados: [...new Set(v.desactivados)], hora_manana: v.hora_manana, hora_tarde: v.hora_tarde,
        dia_checkin: v.dia_checkin, silencio_desde: v.silencio_desde || null, silencio_hasta: v.silencio_hasta || null, email: v.email,
      };
      if (!preferenciasValidas(fila)) throw new Error('Revisa las horas: la de la mañana, de 5:00 a 12:00; la de la tarde, de 12:00 a 23:30; y el «no molestar», con principio y final distintos.');
      return conDefecto((await b.upsert('preferencias_notificaciones', fila, 'usuario_id'))[0]);
    },
    async suscripcionesPush() {
      return b.select('suscripciones_push', { eq: { usuario_id: uid() }, cols: 'id,endpoint,dispositivo,creada_en,usada_en,fallos,ultimo_error', order: [['creada_en', 'desc']] });
    },
    async registrarSuscripcion({ endpoint, p256dh, auth, dispositivo = null, vapid = null }) {
      return b.rpc('registrar_suscripcion_push', { p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth, p_dispositivo: dispositivo, p_vapid: vapid });
    },
    // Pone al día la de este navegador (si el navegador la renovó); false si ya no está (se quitó desde otro móvil)
    async actualizarSuscripcion({ anterior, endpoint, p256dh, auth, vapid = null }) {
      return b.rpc('actualizar_suscripcion_push', { p_anterior: anterior, p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth, p_vapid: vapid });
    },
    async borrarSuscripcion(endpoint) {
      await b.delete('suscripciones_push', { eq: { endpoint, usuario_id: uid() } });
    },
    async quitarDispositivo(id) {
      await b.delete('suscripciones_push', { eq: { id, usuario_id: uid() } });
    },
    // 'ok' (y se envía ya), 'sin_canal' (ni móvil ni email) o 'espera' (ya se mandó una este minuto)
    async probarNotificacion() {
      const r = await b.rpc('probar_notificacion', {});
      if (r === 'ok') empujar(0);
      return r;
    },
    async ultimasNotificaciones(n = 10) {
      return b.select('notificaciones', { eq: { usuario_id: uid() }, cols: 'id,tipo,titulo,cuerpo,creado_en,enviar_desde,estado,canal,enviada_en,error', order: [['creado_en', 'desc']], limit: n });
    },

    // ------------------------------------------------------------ atleta: programa
    // Bloque actual con sus semanas visibles y sus sesiones. soloProgramadas=false para el coach.
    async programa(atletaId, { soloProgramadas = true, bloqueId = null } = {}) {
      const bloques = await b.select('bloques', { eq: { atleta_id: atletaId, es_plantilla: false }, order: [['fecha_inicio', 'desc'], ['numero', 'desc']] });
      const bloque = bloqueId ? bloques.find((x) => x.id === bloqueId) : bloqueActual(bloques) || bloques[0] || null;
      if (!bloque) return { bloques, bloque: null, semanas: [], sesiones: {}, actual: null };
      const filtroSemanas = { eq: { bloque_id: bloque.id }, order: [['numero', 'asc']] };
      if (soloProgramadas) filtroSemanas.eq.programacion = 'programada';
      const semanas = await b.select('semanas', filtroSemanas);
      const sesiones = await b.select('sesiones', { in: { semana_id: semanas.map((s) => s.id) }, order: [['orden', 'asc']] });
      return { bloques, bloque, semanas, sesiones: agrupar(sesiones, 'semana_id'), actual: semanaActual(semanas) };
    },

    // Una sesión con su prescripción, las series ya hechas, lo que hizo la última vez en cada ejercicio
    // y las alternativas equivalentes de cada uno (con su propia «última vez», por si cambia).
    async sesion(sesionId, atletaId) {
      const [sesion] = await b.select('sesiones', { eq: { id: sesionId } });
      if (!sesion) throw new Error('No se encuentra la sesión.');
      const [[semana], pautados, [atleta]] = await Promise.all([
        b.select('semanas', { eq: { id: sesion.semana_id } }),
        b.select('sesion_ejercicios', { eq: { sesion_id: sesionId }, order: [['orden', 'asc']] }),
        b.select('atletas', { eq: { id: atletaId } }),
      ]);
      const [base, hechasLista] = await Promise.all([
        b.select('ejercicios', { in: { id: unicos(pautados.map((p) => p.ejercicio_id)) } }).then(porId),
        b.select('series', { in: { sesion_ejercicio_id: pautados.map((p) => p.id) }, order: [['numero', 'asc']] }),
      ]);
      const extraIds = unicos([...Object.values(base).flatMap((e) => e.alternativas || []), ...hechasLista.map((s) => s.sustituto_id)]).filter((id) => !base[id]);
      const extra = extraIds.length ? porId(await b.select('ejercicios', { in: { id: extraIds } })) : {};
      const todos = { ...base, ...extra };
      const hechas = agrupar(hechasLista, 'sesion_ejercicio_id');
      const [ultimas, notas] = await Promise.all([
        api.ultimasPorEjercicio(atletaId, unicos([...pautados.map((p) => p.ejercicio_id), ...extraIds]), sesionId),
        api.notasEjercicio(atletaId),
      ]);
      return {
        notas,
        sesion,
        semana: semana || null,
        progresionAuto: atleta?.progresion_auto !== false,
        ejercicios: pautados.map((p) => {
          const ejercicio = todos[p.ejercicio_id] || { id: p.ejercicio_id, nombre: 'Ejercicio', grupos_musculares: [], alternativas: [] };
          return {
            ...p,
            ejercicio,
            alternativas: (ejercicio.alternativas || []).map((id) => todos[id]).filter((e) => e && e.activo !== false),
            hechas: hechas[p.id] || [],
            ultimas: ultimas[p.ejercicio_id] || null,
          };
        }),
        ejerciciosPorId: todos,
        ultimas,
      };
    },

    // Notas fijadas del atleta por ejercicio: { ejercicio_id: { id, texto, actualizado_en } }
    async notasEjercicio(atletaId) {
      const filas = await b.select('notas_ejercicio', { eq: { atleta_id: atletaId } }).catch(() => []);
      return Object.fromEntries(filas.map((n) => [n.ejercicio_id, n]));
    },
    // Guarda (o borra, si queda vacía) la nota de un ejercicio
    async guardarNotaEjercicio(atletaId, ejercicioId, texto) {
      const t = String(texto || '').trim().slice(0, 500);
      if (!t) { await b.delete('notas_ejercicio', { eq: { atleta_id: atletaId, ejercicio_id: ejercicioId } }); return null; }
      return (await b.upsert('notas_ejercicio', [{ atleta_id: atletaId, ejercicio_id: ejercicioId, texto: t }], 'atleta_id,ejercicio_id'))[0];
    },
    // Respuestas guardadas del coach
    async respuestasGuardadas() {
      return b.select('respuestas_guardadas', { order: [['orden', 'asc'], ['creado_en', 'asc']] });
    },

    // Para cada ejercicio, las series de la última sesión anterior en que lo hizo (también como alternativa):
    // { ejercicio_id: { sesion_id, fecha, series, pauta } }. pauta es lo que tenía pautado aquella vez (si era el pautado).
    async ultimasPorEjercicio(atletaId, ejercicioIds, excluirSesionId) {
      if (!ejercicioIds.length) return {};
      const res = {};
      const repasar = (series, pautas) => {
        for (const s of series) {
          const p = pautas[s.sesion_ejercicio_id];
          if (!p || p.sesion_id === excluirSesionId) continue;
          const ef = s.sustituto_id || p.ejercicio_id;
          if (!ejercicioIds.includes(ef)) continue;
          const r = res[ef];
          if (!r) {
            res[ef] = {
              sesion_id: p.sesion_id, fecha: fechaDe(s.registrada_en), series: [s],
              pauta: s.sustituto_id ? null : { carga_sugerida_kg: p.carga_sugerida_kg, reps_min: p.reps_min, reps_max: p.reps_max },
            };
          } else if (r.sesion_id === p.sesion_id && !r.series.some((x) => x.id === s.id)) r.series.push(s);
        }
      };
      // Lo normal: está entre sus últimas 800 series
      const recientes = await b.select('series', { eq: { atleta_id: atletaId }, order: [['registrada_en', 'desc']], limit: 800 });
      if (!recientes.length) return {};
      repasar(recientes, porId(await b.select('sesion_ejercicios', { in: { id: unicos(recientes.map((s) => s.sesion_ejercicio_id)) } })));
      // Si no (un ejercicio que no hace desde hace meses), se busca solo ese
      const faltan = recientes.length >= 800 ? ejercicioIds.filter((id) => !res[id]) : [];
      if (faltan.length) {
        const pautasEj = await b.select('sesion_ejercicios', { in: { ejercicio_id: faltan } });
        const [conPauta, comoAlternativa] = await Promise.all([
          pautasEj.length ? b.select('series', { eq: { atleta_id: atletaId }, in: { sesion_ejercicio_id: pautasEj.map((x) => x.id) }, order: [['registrada_en', 'desc']], limit: 400 }) : [],
          b.select('series', { eq: { atleta_id: atletaId }, in: { sustituto_id: faltan }, order: [['registrada_en', 'desc']], limit: 200 }),
        ]);
        const viejas = [...conPauta, ...comoAlternativa].sort((a, c) => (a.registrada_en < c.registrada_en ? 1 : -1));
        const pautas = { ...porId(pautasEj), ...porId(await b.select('sesion_ejercicios', { in: { id: unicos(comoAlternativa.map((s) => s.sesion_ejercicio_id)) } })) };
        repasar(viejas, pautas);
      }
      // La fecha es la del día en que hizo la sesión (si se apuntó otro día, la que eligió)
      const sesiones = porId(await b.select('sesiones', { in: { id: unicos(Object.values(res).map((r) => r.sesion_id)) }, cols: 'id,fecha_realizada' }));
      for (const r of Object.values(res)) {
        r.series.sort((a, c) => a.numero - c.numero);
        if (sesiones[r.sesion_id]?.fecha_realizada) r.fecha = sesiones[r.sesion_id].fecha_realizada;
      }
      return res;
    },

    // registrada_en: cuándo se hizo la serie (la primera vez que se marcó). Corregirla después o enviarla
    // desde la cola sin conexión no cambia esa hora; si no viene, ahora. Nunca en el futuro.
    async guardarSerie({ sesion_ejercicio_id, numero, kg, reps, rpe = null, rir = null, nota = null, sustituto_id = null, registrada_en = null }, atletaId) {
      const t = registrada_en ? Date.parse(registrada_en) : NaN;
      const cuando = Number.isNaN(t) || t > Date.now() + 60000 ? new Date().toISOString() : new Date(t).toISOString();
      const fila = { sesion_ejercicio_id, numero, kg, reps, rpe, rir, nota, sustituto_id, atleta_id: atletaId, registrada_en: cuando };
      return (await b.upsert('series', [fila], 'sesion_ejercicio_id,numero'))[0];
    },
    async borrarSerie(sesionEjercicioId, numero) {
      return b.delete('series', { eq: { sesion_ejercicio_id: sesionEjercicioId, numero } });
    },
    async marcarSesion(sesionId, cambios) {
      const permitidos = ['completada', 'fecha_realizada', 'nota_atleta', 'rpe_sesion', 'duracion_min', 'dia_previsto', 'cardio_hecho'];
      if ('cardio_hecho' in cambios && cambios.cardio_hecho != null && !cardioHechoValido(cambios.cardio_hecho)) throw new Error('Revisa lo que has apuntado de cardio: modalidad y minutos enteros; los kilómetros, de 0,1 a 200');
      const limpio = Object.fromEntries(Object.entries(cambios).filter(([k]) => permitidos.includes(k)));
      return (await b.update('sesiones', limpio, { eq: { id: sesionId } }))[0];
    },

    // ------------------------------------------------------------ hábitos diarios
    async habitos(atletaId, { todos = false } = {}) {
      const filas = await b.select('habitos', { eq: { atleta_id: atletaId }, order: [['orden', 'asc'], ['creado_en', 'asc']] });
      return todos ? filas : filas.filter((h) => h.activo !== false);
    },
    async registrosHabitos(atletaId, desde, hasta = null) {
      const f = { eq: { atleta_id: atletaId }, gte: { fecha: desde }, order: [['fecha', 'asc']] };
      if (hasta) f.lte = { fecha: hasta };
      return b.select('registros_habito', f);
    },
    // Apunta (o corrige) lo de un día; null lo borra
    async apuntarHabito(habitoId, fecha, valor) {
      if (valor == null) { await b.delete('registros_habito', { eq: { habito_id: habitoId, fecha } }); return null; }
      return (await b.upsert('registros_habito', [{ habito_id: habitoId, fecha, valor }], 'habito_id,fecha'))[0];
    },
    // Cada hábito activo con su día de hoy, su semana, sus rachas y su cumplimiento. Se cargan 10 semanas; si
    // una racha llega hasta el principio de lo cargado, se cargan de ese hábito hasta 400 días para contarla
    // entera (uno a uno, para no pasar del máximo de filas por consulta)
    async resumenHabitos(atletaId, hoy = hoyISO(), { todos = false } = {}) {
      const habitos = await api.habitos(atletaId, { todos });
      if (!habitos.length) return [];
      const por = agrupar(await api.registrosHabitos(atletaId, sumarDias(hoy, -70)), 'habito_id');
      return Promise.all(habitos.map(async (h) => {
        const r = resumenHabito(h, por[h.id] || [], hoy);
        if (r.rachaDias < 70 && r.rachaSemanas < 9) return r;
        const largos = await b.select('registros_habito', { eq: { habito_id: h.id }, gte: { fecha: sumarDias(hoy, -400) }, order: [['fecha', 'asc']] });
        return resumenHabito(h, largos, hoy);
      }));
    },
    async guardarHabito(atletaId, fila, id = null) {
      const campos = ['nombre', 'tipo', 'objetivo', 'unidad', 'sentido', 'dias_semana', 'icono', 'orden', 'activo'];
      const limpio = Object.fromEntries(campos.filter((c) => c in fila).map((c) => [c, fila[c]]));
      if (limpio.tipo === 'si_no') { limpio.objetivo = null; limpio.unidad = null; limpio.sentido = 'al_menos'; }
      if (id) return (await b.update('habitos', limpio, { eq: { id } }))[0];
      const actuales = await api.habitos(atletaId);
      return (await b.insert('habitos', [{ ...limpio, atleta_id: atletaId, orden: limpio.orden ?? Math.min(99, actuales.length) }]))[0];
    },
    // Quitar un hábito: si ya tiene días apuntados, se archiva (no se pierde lo hecho); si no, se borra
    async quitarHabito(id) {
      const hay = await b.select('registros_habito', { eq: { habito_id: id }, cols: 'id', limit: 1 });
      if (hay.length) return { archivado: true, habito: (await b.update('habitos', { activo: false }, { eq: { id } }))[0] };
      await b.delete('habitos', { eq: { id } });
      return { archivado: false };
    },

    // ------------------------------------------------------------ nutrición
    async planesNutricion(atletaId) {
      return b.select('planes_nutricion', { eq: { atleta_id: atletaId }, order: [['desde', 'asc']] });
    },
    // Un plan vale desde una fecha; si ya hay uno ese mismo día, se sustituye (es la misma versión, corregida)
    async guardarPlanNutricion(atletaId, fila) {
      const cifras = ['kcal', 'proteina_g', 'carbos_g', 'grasa_g', 'fibra_g', 'kcal_descanso', 'carbos_descanso_g', 'grasa_descanso_g'];
      const campos = ['desde', 'modo', 'fase', 'ritmo_pct', ...cifras, 'pautas', 'motivo'];
      const limpio = Object.fromEntries(campos.map((c) => [c, fila[c] === '' || fila[c] === undefined ? null : fila[c]]));
      if (limpio.modo === 'sin_contar') for (const c of cifras) limpio[c] = null;
      if (limpio.modo === 'kcal_proteina') for (const c of ['carbos_g', 'grasa_g', 'carbos_descanso_g', 'grasa_descanso_g']) limpio[c] = null;
      // Sin kcal de descanso no hay día de descanso: sus hidratos y grasa sobran
      if (limpio.kcal_descanso == null) { limpio.carbos_descanso_g = null; limpio.grasa_descanso_g = null; }
      for (const c of ['pautas', 'motivo']) if (limpio[c] != null) limpio[c] = String(limpio[c]).trim() || null;
      return (await b.upsert('planes_nutricion', [{ ...limpio, atleta_id: atletaId }], 'atleta_id,desde'))[0];
    },
    async borrarPlanNutricion(id) {
      return b.delete('planes_nutricion', { eq: { id } });
    },
    async registrosNutricion(atletaId, desde, hasta = null) {
      const f = { eq: { atleta_id: atletaId }, gte: { fecha: desde }, order: [['fecha', 'asc']] };
      if (hasta) f.lte = { fecha: hasta };
      return b.select('registros_nutricion', f);
    },
    // Apunta (o corrige) un día; null lo borra
    async apuntarNutricion(atletaId, fecha, datos) {
      if (datos == null) { await b.delete('registros_nutricion', { eq: { atleta_id: atletaId, fecha } }); return null; }
      const campos = ['kcal', 'proteina_g', 'carbos_g', 'grasa_g', 'fibra_g', 'completo', 'cumplido', 'nota'];
      const fila = { atleta_id: atletaId, fecha };
      for (const c of campos) if (c in datos) fila[c] = datos[c] === '' || datos[c] === undefined ? null : datos[c];
      if (typeof fila.nota === 'string') fila.nota = fila.nota.trim() || null;
      return (await b.upsert('registros_nutricion', [fila], 'atleta_id,fecha'))[0];
    },
    // Días en que entrenó (sesiones hechas) o tiene una sesión prevista, desde una fecha: para saber qué
    // objetivo tocaba (con día de descanso propio, cambia)
    async diasDeEntreno(atletaId, desde, hoy = hoyISO()) {
      const bloques = await b.select('bloques', { eq: { atleta_id: atletaId, es_plantilla: false }, cols: 'id' });
      const semanas = bloques.length ? await b.select('semanas', { in: { bloque_id: bloques.map((x) => x.id) }, gte: { fecha_inicio: sumarDias(desde, -7) }, cols: 'id' }) : [];
      const sesiones = semanas.length ? await b.select('sesiones', { in: { semana_id: semanas.map((x) => x.id) }, cols: 'completada,fecha_realizada,dia_previsto' }) : [];
      const out = new Set();
      for (const x of sesiones) {
        // Una sesión prevista para un día que ya pasó y no se hizo no lo convierte en día de entreno
        const f = x.completada ? x.fecha_realizada : x.dia_previsto && x.dia_previsto >= hoy ? x.dia_previsto : null;
        if (f && f >= desde) out.add(f);
      }
      return out;
    },
    // Todo lo de nutrición de un atleta a una fecha: planes, 9 semanas de registros y pesos, la semana en curso y
    // las tres anteriores, el gasto adaptativo (y su evolución) y el ajuste para el ritmo del plan.
    // entrenaHoy: lo sabe la pantalla de Hoy (sesión de hoy prevista o hecha) aunque aún no esté en la base.
    // entrenaHoy: true o false si la pantalla lo sabe (sesión de hoy, o lo que elige el atleta); null, lo de la base.
    async resumenNutricion(atletaId, hoy = hoyISO(), { entrenaHoy = null } = {}) {
      // 12 semanas: las 8 de la gráfica del gasto, cada una con sus 28 días detrás
      const desde = sumarDias(lunesDe(hoy), -84);
      const [planes, registros, pesos, entrenos] = await Promise.all([
        api.planesNutricion(atletaId),
        api.registrosNutricion(atletaId, desde),
        b.select('pesos', { eq: { atleta_id: atletaId }, gte: { fecha: desde }, order: [['fecha', 'asc']] }).catch(() => []),
        api.diasDeEntreno(atletaId, desde, hoy).catch(() => new Set()),
      ]);
      if (entrenaHoy === true) entrenos.add(hoy);
      if (entrenaHoy === false) entrenos.delete(hoy);
      const plan = planVigente(planes, hoy);
      const siguiente = planSiguiente(planes, hoy);
      const datos = { registros, pesos };
      // Las kcal que tocaban cada día (para descartar del gasto los días que parecen a medias)
      const objetivoDe = (f) => objetivoDelDia(planVigente(planes, f), entrenos.has(f))?.kcal ?? null;
      const gasto = gastoAdaptativo(datos, hoy, { objetivoDe });
      const tend = tendenciaPeso(pesos);
      const pesoKg = tend.length ? tend[tend.length - 1].tendencia : null;
      // Días de entreno a la semana: los de las últimas 4 semanas, divididos por las semanas que de verdad hay
      // datos (quien empezó hace dos semanas no entrena la mitad); si no hay, 4
      const recientes = [...entrenos].filter((f) => f > sumarDias(hoy, -28) && f <= hoy).sort();
      const semanasCubiertas = recientes.length ? Math.max(1, Math.min(4, Math.ceil((diasEntre(recientes[0], hoy) + 1) / 7))) : 4;
      const diasEntreno = recientes.length ? Math.max(1, Math.min(7, Math.round(recientes.length / semanasCubiertas))) : 4;
      const lunes = lunesDe(hoy);
      return {
        planes, plan, siguiente, registros, pesos, entrenos,
        hoy: registros.find((r) => r.fecha === hoy) || null,
        objetivoHoy: objetivoDelDia(plan, entrenos.has(hoy)),
        semana: semanaNutricion({ registros, planes, entrenos }, lunes, hoy),
        anteriores: [1, 2, 3].map((i) => semanaNutricion({ registros, planes, entrenos }, sumarDias(lunes, -7 * i), hoy)),
        gasto, gastoSemanas: gastoPorSemanas(datos, hoy, 8, { objetivoDe }),
        pesoKg, ritmo: ritmoPeso(tend), diasEntreno,
        // Si ya hay una versión preparada para más adelante, el ajuste se calcula sobre ella (así, al aplicarlo,
        // deja de proponerse lo mismo)
        ajuste: ajusteNutricion({ plan: siguiente || plan, gasto, pesoKg, diasEntreno }),
      };
    },

    // ------------------------------------------------------------ comidas (v0.26, migración 022)
    // Tu recetario (coach): todas las recetas, sin la foto grande, y a cuántos atletas tiene asignada cada una
    async recetas() {
      const [recetas, asignadas] = await Promise.all([
        b.select('recetas', { cols: COLS_RECETA, order: [['nombre', 'asc']] }).catch(falta022),
        b.select('recetas_atleta', { cols: 'id,receta_id,atleta_id,toma' }).catch(() => []),
      ]);
      const A = agrupar(asignadas, 'receta_id');
      return recetas.map((r) => ({ ...r, atletas: unicos((A[r.id] || []).map((x) => x.atleta_id)).length }));
    },
    // Una receta con su foto grande
    async receta(id) {
      return (await b.select('recetas', { eq: { id } }).catch(falta022))[0] || null;
    },
    async guardarReceta(datos, id = null) {
      const { fila, error } = limpiarReceta(datos);
      if (error) throw new Error(error);
      if (id) return (await b.update('recetas', fila, { eq: { id } }).catch(falta022))[0];
      return (await b.insert('recetas', [fila]).catch(falta022))[0];
    },
    async borrarReceta(id) {
      return b.delete('recetas', { eq: { id } });
    },
    // Copia de una receta (para cambiarle algo a un atleta sin tocar la original)
    async duplicarReceta(id) {
      const r = await api.receta(id);
      if (!r) throw new Error('No se encuentra la receta.');
      const { id: _i, creada_en: _c, actualizada_en: _a, ...resto } = r;
      return (await b.insert('recetas', [{ ...resto, nombre: `${r.nombre} (copia)`.slice(0, 80) }]))[0];
    },
    // El recetario de un atleta (lo ve él y su coach): sus comidas del día, sus asignaciones y las recetas, por toma
    async recetario(atletaId) {
      const [asignaciones, comidas] = await Promise.all([
        b.select('recetas_atleta', { eq: { atleta_id: atletaId }, order: [['orden', 'asc']] }).catch(falta022),
        b.select('comidas_atleta', { eq: { atleta_id: atletaId } }).catch(() => []),
      ]);
      const recetas = asignaciones.length ? await b.select('recetas', { in: { id: unicos(asignaciones.map((a) => a.receta_id)) }, cols: COLS_RECETA }) : [];
      const tomas = tomasDe(comidas[0]);
      const porToma = recetarioPorToma(asignaciones, recetas);
      // Tomas con recetas que no están entre sus comidas (p. ej. le asignaste una merienda y él quitó la merienda)
      const conRecetas = ordenarTomas(Object.keys(porToma));
      return { tomas, eligio: !!comidas[0], conRecetas, porToma, asignaciones, recetas, cambios: asignaciones.filter((a) => a.cambio_pedido_en).length };
    },
    // Cuántas comidas hace al día (las elige el atleta o el coach)
    async guardarComidas(atletaId, tomas) {
      const xs = ordenarTomas(tomas);
      if (!xs.length) throw new Error('Elige al menos una comida.');
      return (await b.upsert('comidas_atleta', [{ atleta_id: atletaId, tomas: xs }], 'atleta_id').catch(falta022))[0];
    },
    // Coach: poner una receta en su recetario (en una o varias tomas). Si ya la tiene en esa toma, se deja como
    // está (su factor y tu nota no se pierden: se cambian desde la asignación)
    async asignarReceta(atletaId, recetaId, tomas, { factor = 1, nota = null } = {}) {
      const lista = Array.isArray(tomas) ? tomas : [tomas];
      if (!lista.length) throw new Error('Elige en qué comida va.');
      const ya = new Set((await b.select('recetas_atleta', { eq: { atleta_id: atletaId, receta_id: recetaId }, cols: 'toma' }).catch(falta022)).map((x) => x.toma));
      const filas = lista.filter((toma) => !ya.has(toma)).map((toma) => ({ atleta_id: atletaId, receta_id: recetaId, toma, factor: Number(factor) || 1, nota: nota?.trim() || null }));
      if (!filas.length) return [];
      return b.insert('recetas_atleta', filas).catch(falta022);
    },
    async cambiarAsignacion(id, cambios) {
      const c = {};
      for (const k of ['factor', 'nota', 'orden', 'toma']) if (k in cambios) c[k] = cambios[k] === '' ? null : cambios[k];
      if ('nota' in c && typeof c.nota === 'string') c.nota = c.nota.trim() || null;
      return (await b.update('recetas_atleta', c, { eq: { id } }))[0];
    },
    async quitarReceta(asignacionId) {
      return b.delete('recetas_atleta', { eq: { id: asignacionId } });
    },
    // Atleta: favorita, y pedir (o retirar) que se la cambien
    async recetaFavorita(asignacionId, favorita) {
      return (await b.update('recetas_atleta', { favorita: !!favorita }, { eq: { id: asignacionId } }))[0];
    },
    async pedirCambioReceta(asignacionId, nota = null) {
      const t = nota == null ? null : String(nota).trim().slice(0, 300) || null;
      return (await b.update('recetas_atleta', nota === false ? { cambio_pedido_en: null, cambio_nota: null } : { cambio_pedido_en: new Date().toISOString(), cambio_nota: t }, { eq: { id: asignacionId } }))[0];
    },
    // Coach: dar por resuelta la petición
    async resolverCambioReceta(asignacionId) {
      return (await b.update('recetas_atleta', { cambio_pedido_en: null, cambio_nota: null }, { eq: { id: asignacionId } }))[0];
    },
    // El menú de una semana (de lunes a domingo)
    async menuSemana(atletaId, lunes) {
      return b.select('menu_comidas', { eq: { atleta_id: atletaId }, gte: { fecha: lunes }, lte: { fecha: sumarDias(lunes, 6) }, order: [['fecha', 'asc'], ['orden', 'asc']] }).catch(falta022);
    },
    // Apuntar en el menú una receta del recetario ({ asignacion }) o un texto ({ texto, macros })
    async apuntarMenu(atletaId, datos) {
      const fila = entradaMenu(datos);
      if (!fila) throw new Error('Escribe qué vas a comer.');
      return (await b.insert('menu_comidas', [{ ...fila, atleta_id: atletaId }]).catch(falta022))[0];
    },
    async cambiarMenu(entrada, cambios) {
      const c = { ...cambios };
      if ('raciones' in c) Object.assign(c, cambiarRaciones(entrada, c.raciones));
      if ('texto' in c) { c.texto = String(c.texto || '').trim().slice(0, 120); if (!c.texto) throw new Error('Escribe qué vas a comer.'); }
      return (await b.update('menu_comidas', c, { eq: { id: entrada.id } }))[0];
    },
    async borrarMenu(id) {
      return b.delete('menu_comidas', { eq: { id } });
    },
    // Copiar el menú de una semana a otra (lo que ya hubiera en la de destino se queda)
    async copiarMenuSemana(atletaId, lunesOrigen, lunesDestino) {
      const [origen, destino, asignadas] = await Promise.all([api.menuSemana(atletaId, lunesOrigen), api.menuSemana(atletaId, lunesDestino),
        b.select('recetas_atleta', { eq: { atleta_id: atletaId }, cols: 'receta_id' }).catch(falta022)]);
      // Una receta que ya no está en su recetario se copia como texto (la base no deja ponerla); lo que ya está
      // en la semana de destino no se duplica (al darle dos veces, por ejemplo)
      const enRecetario = new Set(asignadas.map((x) => x.receta_id));
      const yaEsta = new Set(destino.map((e) => `${e.fecha}|${e.toma}|${e.texto}`));
      const filas = copiarMenu(origen, lunesOrigen, lunesDestino)
        .filter((f) => !yaEsta.has(`${f.fecha}|${f.toma}|${f.texto}`))
        .map((f) => ({ ...f, receta_id: f.receta_id && enRecetario.has(f.receta_id) ? f.receta_id : null, atleta_id: atletaId }));
      if (!filas.length) return [];
      return b.insert('menu_comidas', filas);
    },
    // Vaciar una semana del menú
    async vaciarMenuSemana(atletaId, lunes) {
      return b.delete('menu_comidas', { eq: { atleta_id: atletaId }, gte: { fecha: lunes }, lte: { fecha: sumarDias(lunes, 6) } });
    },

    // ------------------------------------------------------------ plan de la semana
    // El día que el atleta piensa hacer una sesión (null = sin día). Pasa por la cola si no hay conexión.
    async planificarSesion(sesionId, dia) {
      return (await b.update('sesiones', { dia_previsto: dia || null }, { eq: { id: sesionId } }))[0];
    },

    // ------------------------------------------------------------ atleta: check-in
    // Con lo que le pregunta su coach: los apartados (null = todos) y sus preguntas
    async checkin(atletaId, lunes) {
      const [checkin] = await b.select('checkins', { eq: { atleta_id: atletaId, semana_inicio: lunes } });
      const [molestias, pesos, medidas, atleta, preguntas] = await Promise.all([
        b.select('molestias', { eq: { atleta_id: atletaId, semana_inicio: lunes } }),
        b.select('pesos', { eq: { atleta_id: atletaId }, order: [['fecha', 'desc']], limit: 2 }),
        b.select('medidas', { eq: { atleta_id: atletaId }, order: [['fecha', 'desc']], limit: 2 }),
        // Toda la fila (sin nombrar columnas: así funciona también sin la migración 018)
        b.select('atletas', { eq: { id: atletaId } }).then((x) => x[0] || null).catch(() => null),
        api.preguntasCheckin(atletaId).catch(() => []),
      ]);
      return { checkin: checkin || null, molestias, pesos, medidas, apartados: atleta?.checkin_apartados ?? null, nutricion: atleta?.nutricion !== false, preguntas };
    },
    async guardarCheckin(atletaId, lunes, datos, molestias = {}, pesoKg = null) {
      const campos = ['horas_sueno', 'energia', 'recuperacion', 'motivacion', 'fc_reposo', 'hrv', 'adherencia_desayuno',
        'adherencia_comida', 'adherencia_merienda', 'adherencia_cena', 'calorias_media', 'pasos_media', 'saciedad',
        'satisfaccion_dieta', 'notas'];
      const fila = { atleta_id: atletaId, semana_inicio: lunes };
      for (const c of campos) fila[c] = datos[c] === '' || datos[c] === undefined ? null : datos[c];
      // Las respuestas a las preguntas del coach ({ id de la pregunta: valor }); si no vienen, no se tocan
      if ('respuestas' in datos) fila.respuestas = datos.respuestas && Object.keys(datos.respuestas).length ? datos.respuestas : null;
      const [guardado] = await b.upsert('checkins', [fila], 'atleta_id,semana_inicio');
      const conDolor = Object.entries(molestias).filter(([, v]) => Number(v) > 0);
      if (conDolor.length) {
        await b.upsert('molestias', conDolor.map(([zona, intensidad]) => ({ atleta_id: atletaId, semana_inicio: lunes, zona, intensidad: Number(intensidad) })),
          'atleta_id,semana_inicio,zona');
      }
      const sinDolor = Object.entries(molestias).filter(([, v]) => Number(v) === 0).map(([z]) => z);
      if (sinDolor.length) await b.delete('molestias', { eq: { atleta_id: atletaId, semana_inicio: lunes }, in: { zona: sinDolor } });
      if (pesoKg) await api.guardarPeso(atletaId, hoyISO(), pesoKg);
      return guardado;
    },
    // ------------------------------------------------------------ check-in a medida
    // Las preguntas del coach para ese atleta: las suyas y las de todos, en orden (archivadas, si se piden)
    async preguntasCheckin(atletaId, { archivadas = false } = {}) {
      const [suyas, todos] = await Promise.all([
        b.select('preguntas_checkin', { eq: { atleta_id: atletaId } }),
        b.select('preguntas_checkin', { nulo: ['atleta_id'] }),
      ]);
      return preguntasDe([...suyas, ...todos], atletaId, { archivadas });
    },
    // Crea o cambia una pregunta (atleta_id null = para todos). La unidad solo va en las de número y las
    // etiquetas, en las de escala.
    async guardarPregunta(fila, id = null) {
      const t = (v) => { const x = String(v ?? '').replace(/\s+/g, ' ').trim(); return x || null; };
      const tipo = fila.tipo || 'escala';
      const limpio = {
        texto: t(fila.texto), tipo,
        unidad: tipo === 'numero' ? t(fila.unidad) : null,
        ayuda: t(fila.ayuda),
        etiqueta_min: tipo === 'escala' ? t(fila.etiqueta_min) : null,
        etiqueta_max: tipo === 'escala' ? t(fila.etiqueta_max) : null,
      };
      if (!limpio.texto) throw new Error('Escribe la pregunta');
      if (!id) await comprobarCupoPreguntas(fila.atleta_id || null);
      if (id) {
        if ('atleta_id' in fila) limpio.atleta_id = fila.atleta_id || null;
        if ('activa' in fila) limpio.activa = !!fila.activa;
        return (await b.update('preguntas_checkin', limpio, { eq: { id } }))[0];
      }
      // Al final de las que ya tiene
      const ya = fila.atleta_id ? await api.preguntasCheckin(fila.atleta_id, { archivadas: true }) : await b.select('preguntas_checkin', { nulo: ['atleta_id'] });
      const orden = Math.min(99, ya.reduce((m, p) => Math.max(m, (p.orden ?? 0) + 1), 0));
      return (await b.insert('preguntas_checkin', [{ ...limpio, atleta_id: fila.atleta_id || null, orden }]))[0];
    },
    // Quitar una pregunta: si ya tiene respuestas, se archiva (para no perderlas); si no, se borra. La base no
    // deja borrar una con respuestas: si alguien la responde justo ahora, se archiva igual.
    async quitarPregunta(id) {
      const [p] = await b.select('preguntas_checkin', { eq: { id } });
      if (!p) return { archivado: false };
      const archivar = async () => ({ archivado: true, pregunta: (await b.update('preguntas_checkin', { activa: false }, { eq: { id } }))[0] });
      const checkins = await b.select('checkins', { ...(p.atleta_id ? { eq: { atleta_id: p.atleta_id } } : {}), cols: 'id,respuestas' });
      if (checkins.some((c) => c.respuestas && id in c.respuestas)) return archivar();
      try { await b.delete('preguntas_checkin', { eq: { id } }); } catch (e) { if (/para no perderlas/.test(e.message || '')) return archivar(); throw e; }
      return { archivado: false };
    },
    async recuperarPregunta(id) {
      const [p] = await b.select('preguntas_checkin', { eq: { id } });
      if (p && p.activa === false) await comprobarCupoPreguntas(p.atleta_id ?? null);
      return (await b.update('preguntas_checkin', { activa: true }, { eq: { id } }))[0];
    },
    // Qué apartados del check-in se le preguntan (null o todos = todos)
    async guardarApartadosCheckin(atletaId, lista) {
      const validos = lista == null ? null : APARTADOS_CHECKIN.map(([k]) => k).filter((k) => lista.includes(k));
      const valor = validos == null || validos.length === APARTADOS_CHECKIN.length ? null : validos;
      return (await b.update('atletas', { checkin_apartados: valor }, { eq: { id: atletaId } }))[0];
    },

    // ------------------------------------------------------------ cuestionario inicial
    async cuestionario(atletaId) {
      return (await b.select('cuestionarios', { eq: { atleta_id: atletaId } }))[0] || null;
    },
    // Guarda lo que venga (se puede ir paso a paso); completar lo da por terminado (la fecha la pone la base)
    async guardarCuestionario(atletaId, datos, { completar = false } = {}) {
      const fila = { atleta_id: atletaId, ...limpiarCuestionario(datos) };
      if (completar) fila.completado_en = new Date().toISOString();
      try {
        return (await b.upsert('cuestionarios', [fila], 'atleta_id'))[0];
      } catch (e) {
        // Una base sin la migración 016 aún no tiene «objetivos»: se guarda el principal, como antes
        if (!('objetivos' in fila) || !/objetivos/.test(String(e?.message || ''))) throw e;
        const { objetivos, ...sinLista } = fila;
        return (await b.upsert('cuestionarios', [sinLista], 'atleta_id'))[0];
      }
    },
    // El coach le pide que lo rellene (o que lo actualice): le llega un aviso y lo ve en Hoy
    async pedirCuestionario(atletaId) {
      return (await b.upsert('cuestionarios', [{ atleta_id: atletaId, pedido_en: new Date().toISOString() }], 'atleta_id'))[0];
    },
    async revisarCuestionario(id, revisado = true) {
      return (await b.update('cuestionarios', { revisado_en: revisado ? new Date().toISOString() : null }, { eq: { id } }))[0];
    },
    async borrarCuestionario(id) {
      return b.delete('cuestionarios', { eq: { id } });
    },
    // Borra solo lo de salud (también sin consentimiento: por ejemplo, después de retirarlo)
    async borrarSaludCuestionario(atletaId) {
      return (await b.update('cuestionarios', { ...SIN_SALUD }, { eq: { atleta_id: atletaId } }))[0] || null;
    },

    // Pesos de los últimos días (para la tendencia), del más antiguo al más reciente
    async pesos(atletaId, dias = 120) {
      return b.select('pesos', { eq: { atleta_id: atletaId }, gte: { fecha: sumarDias(hoyISO(), -dias) }, order: [['fecha', 'asc']] });
    },
    async guardarPeso(atletaId, fecha, kg) {
      return (await b.upsert('pesos', [{ atleta_id: atletaId, fecha, kg: Number(kg) }], 'atleta_id,fecha'))[0];
    },
    async medidas(atletaId) {
      return b.select('medidas', { eq: { atleta_id: atletaId }, order: [['fecha', 'asc']] });
    },
    // Solo cambia las medidas que vienen (apuntar el pecho no borra la cintura que ya estaba de ese día);
    // una medida vacía ('') sí se borra
    async guardarMedidas(atletaId, fecha, datos) {
      const fila = { atleta_id: atletaId, fecha };
      for (const k of ['cintura_cm', 'cadera_cm', 'pecho_cm', 'brazo_cm', 'muslo_cm', 'pantorrilla_cm', 'notas']) {
        if (datos[k] !== undefined) fila[k] = datos[k] === '' ? null : datos[k];
      }
      return (await b.upsert('medidas', [fila], 'atleta_id,fecha'))[0];
    },

    // ------------------------------------------------------------ progreso (atleta y coach)
    // Todas las series del atleta con su fecha y el ejercicio con el que se hicieron (la alternativa, si cambió).
    async historial(atletaId) {
      const clave = `${uid()}:${atletaId}`;  // por usuario: con otra sesión, otra respuesta (y otros permisos)
      const ya = historiales.get(clave);
      if (ya && ya.gen === generacion && Date.now() - ya.t < 4000) return (await ya.p).map((s) => ({ ...s }));
      const p = api.historialSinCompartir(atletaId);
      const entrada = { gen: generacion, t: Date.now(), p };
      historiales.clear();
      historiales.set(clave, entrada);
      p.catch(() => { if (historiales.get(clave) === entrada) historiales.delete(clave); });
      return (await p).map((s) => ({ ...s }));
    },
    async historialSinCompartir(atletaId) {
      // Todas (el adaptador de Supabase pagina de 1000 en 1000): con un tope, a los pocos años se perderían las más nuevas
      const series = await b.select('series', { eq: { atleta_id: atletaId }, order: [['registrada_en', 'asc']] });
      const pautas = porId(await b.select('sesion_ejercicios', { in: { id: unicos(series.map((s) => s.sesion_ejercicio_id)) } }));
      const [sesiones, ejercicios] = await Promise.all([
        b.select('sesiones', { in: { id: unicos(Object.values(pautas).map((p) => p.sesion_id)) } }).then(porId),
        b.select('ejercicios', { in: { id: unicos([...Object.values(pautas).map((p) => p.ejercicio_id), ...series.map((s) => s.sustituto_id)]) } }).then(porId),
      ]);
      return series.map((s) => {
        const p = pautas[s.sesion_ejercicio_id] || {};
        const ef = s.sustituto_id || p.ejercicio_id;
        const e = ejercicios[ef] || {};
        return {
          ...s,
          fecha: sesiones[p.sesion_id]?.fecha_realizada || fechaDe(s.registrada_en),
          sesion_id: p.sesion_id || null,
          ejercicio_id: ef, ejercicio: e.nombre, grupos: e.grupos_musculares || [],
          sustituto: !!s.sustituto_id, pautado: ejercicios[p.ejercicio_id]?.nombre || null,
        };
      });
    },
    // Constancia a lo largo de todos sus bloques: racha de semanas completas y días entrenados (12 semanas)
    async constancia(atletaId, hoy = hoyISO()) {
      const bloques = await b.select('bloques', { eq: { atleta_id: atletaId, es_plantilla: false }, cols: COLS_BLOQUE });
      const semanas = bloques.length ? semanasQueCuentan(await b.select('semanas', { in: { bloque_id: bloques.map((x) => x.id) }, eq: { programacion: 'programada' } }), bloques) : [];
      const sesiones = semanas.length ? await b.select('sesiones', { in: { semana_id: semanas.map((x) => x.id) } }) : [];
      const desde = sumarDias(lunesDe(hoy), -7 * 11);
      const series = await b.select('series', { eq: { atleta_id: atletaId }, gte: { registrada_en: desde }, cols: 'registrada_en', limit: 10000 });
      const porSemana = agrupar(sesiones, 'semana_id');
      const lista = semanas.map((w) => {
        const ss = porSemana[w.id] || [];
        return { fecha_inicio: w.fecha_inicio, total: ss.length, hechas: ss.filter((x) => x.completada).length };
      });
      const dias = {};
      for (const x of series) { const d = aISO(new Date(x.registrada_en)); dias[d] = (dias[d] || 0) + 1; }
      for (const x of sesiones) if (x.completada && x.fecha_realizada >= desde && !dias[x.fecha_realizada]) dias[x.fecha_realizada] = 1;
      const mapa = mapaCalor(dias, hoy);
      return { racha: racha(lista, hoy), mapa, diasEntrenados: mapa.flatMap((w) => w.dias).filter((d) => d.nivel > 0).length };
    },
    // Cardio hecho por semana (minutos, km y sesiones) en las últimas n semanas, para la gráfica de Progreso
    async cardioSemanas(atletaId, n = 8, hoy = hoyISO()) {
      const bloques = await b.select('bloques', { eq: { atleta_id: atletaId, es_plantilla: false }, cols: 'id' });
      if (!bloques.length) return [];
      const semanas = await b.select('semanas', { in: { bloque_id: bloques.map((x) => x.id) }, cols: 'id' });
      const desde = sumarDias(lunesDe(hoy), -7 * (n - 1));
      const sesiones = semanas.length ? await b.select('sesiones', { in: { semana_id: semanas.map((x) => x.id) }, eq: { completada: true }, gte: { fecha_realizada: desde } }) : [];
      const lunes = Array.from({ length: n }, (_, i) => sumarDias(desde, 7 * i));
      return cardioPorSemana(sesiones, lunes);
    },

    // «Tu día»: lo que le toca hoy en una lista (sesión, hábitos, nutrición, peso, check-in, cuestionario). El programa
    // y el check-in de la semana ya los tiene la pantalla; el resto se consulta aquí (solo lo que aplica).
    async tuDia(atletaId, { programa = null, checkin = null, salud = true, nutricion: conNut = true, entrenamiento = true, hoy = hoyISO() } = {}) {
      const semana = entrenamiento ? programa?.actual || null : null;
      const sesiones = semana ? programa.sesiones[semana.id] || [] : null;
      const [pesos, habitos, nutricion, cuestionario] = await Promise.all([
        salud ? b.select('pesos', { eq: { atleta_id: atletaId, fecha: hoy }, cols: 'id', limit: 1 }).catch(() => null) : null,
        salud ? api.resumenHabitos(atletaId, hoy).catch(() => []) : [],
        salud && conNut ? api.planesNutricion(atletaId).then(async (planes) => {
          const plan = planVigente(planes, hoy);
          if (!plan) return null;
          const [r] = await api.registrosNutricion(atletaId, hoy, hoy);
          return { plan, hoy: r || null };
        }).catch(() => null) : null,
        api.cuestionario(atletaId).catch(() => null),
      ]);
      // Su menú de hoy (v0.26), si lo ha organizado
      const menuHoy = salud && conNut ? await b.select('menu_comidas', { eq: { atleta_id: atletaId, fecha: hoy }, cols: 'id,hecho' }).catch(() => []) : [];
      return tuDia({
        menu: menuHoy.length ? { total: menuHoy.length, hechas: menuHoy.filter((x) => x.hecho).length } : null,
        semana, sesiones,
        pesoHoy: salud && pesos ? pesos.length > 0 : null,
        habitos: salud ? habitos : null,
        nutricion,
        checkin: salud && checkin !== null ? { hecho: !!checkin?.checkin, pendiente: !checkin?.checkin } : null,
        cuestionario: { pendiente: cuestionarioPendiente(cuestionario) },
      }, hoy);
    },
    // Primeros pasos de un atleta nuevo: ¿ha hecho ya una sesión, apuntado su peso, enviado un check-in?
    async primerosPasos(atletaId) {
      const bloques = await b.select('bloques', { eq: { atleta_id: atletaId, es_plantilla: false }, cols: 'id' });
      const semanas = bloques.length ? await b.select('semanas', { in: { bloque_id: bloques.map((x) => x.id) }, cols: 'id' }) : [];
      const [ses, pes, ck, cu] = await Promise.all([
        semanas.length ? b.select('sesiones', { in: { semana_id: semanas.map((x) => x.id) }, eq: { completada: true }, cols: 'id', limit: 1 }) : [],
        b.select('pesos', { eq: { atleta_id: atletaId }, cols: 'id', limit: 1 }),
        b.select('checkins', { eq: { atleta_id: atletaId }, cols: 'id', limit: 1 }),
        b.select('cuestionarios', { eq: { atleta_id: atletaId }, cols: 'id,completado_en', limit: 1 }).catch(() => []),
      ]);
      return { sesion: ses.length > 0, peso: pes.length > 0, checkin: ck.length > 0, cuestionario: !!cu[0]?.completado_en };
    },
    // Historial de entrenamientos: sesiones hechas de todos sus bloques, de la más reciente a la más antigua,
    // con sus cifras (series, tonelaje, récords, músculos principales)
    async entrenamientos(atletaId) {
      const bloques = await b.select('bloques', { eq: { atleta_id: atletaId, es_plantilla: false }, cols: 'id,numero,nombre' });
      const semanas = bloques.length ? await b.select('semanas', { in: { bloque_id: bloques.map((x) => x.id) }, cols: 'id,bloque_id,numero' }) : [];
      const [sesiones, series] = await Promise.all([
        semanas.length ? b.select('sesiones', { in: { semana_id: semanas.map((x) => x.id) }, eq: { completada: true } }) : [],
        api.historial(atletaId),
      ]);
      const sem = porId(semanas), blo = porId(bloques);
      const porSesion = agrupar(series.filter((x) => x.sesion_id), 'sesion_id');
      const recordsPorSesion = {};
      for (const e of eventosRecord(series).eventos) if (e.sesion_id) recordsPorSesion[e.sesion_id] = (recordsPorSesion[e.sesion_id] || 0) + 1;
      return sesiones.map((x) => {
        const ss = (porSesion[x.id] || []).filter((s) => Number(s.reps) > 0);
        const musc = {};
        for (const s of ss) (s.grupos || []).forEach((g, i) => { musc[g] = (musc[g] || 0) + (i === 0 ? 1 : 0.5); });
        const w = sem[x.semana_id], bl = w ? blo[w.bloque_id] : null;
        return {
          id: x.id, nombre: x.nombre, tipo: x.tipo, fecha: x.fecha_realizada || fechaDe(ss[0]?.registrada_en), duracion_min: x.duracion_min, rpe_sesion: x.rpe_sesion, cardio_hecho: x.cardio_hecho || null,
          series: ss.length, tonelaje: ss.reduce((t, s) => t + (Number(s.kg) || 0) * (Number(s.reps) || 0), 0),
          records: recordsPorSesion[x.id] || 0,
          musculos: Object.entries(musc).sort((a, c) => c[1] - a[1]).slice(0, 3).map(([g]) => g),
          bloque: bl ? { numero: bl.numero, nombre: bl.nombre } : null, semana: w?.numero ?? null,
        };
      }).sort((a, c) => ((a.fecha || '') < (c.fecha || '') ? 1 : -1));
    },
    // «Tu semana»: resumen de las últimas n semanas cerradas (las vacías no salen), de la más reciente a la más antigua
    async resumenesSemanales(atletaId, n = 4, hoy = hoyISO()) {
      const bloques = await b.select('bloques', { eq: { atleta_id: atletaId, es_plantilla: false }, cols: COLS_BLOQUE });
      const [series, pesos, todas] = await Promise.all([
        api.historial(atletaId),
        api.pesos(atletaId, 7 * (n + 4)).catch(() => []),
        bloques.length ? b.select('semanas', { in: { bloque_id: bloques.map((x) => x.id) }, eq: { programacion: 'programada' } }) : [],
      ]);
      const semanas = semanasQueCuentan(todas, bloques);
      const sesiones = semanas.length ? await b.select('sesiones', { in: { semana_id: semanas.map((x) => x.id) } }) : [];
      const lunesDeSemana = Object.fromEntries(semanas.map((w) => [w.id, w.fecha_inicio ? lunesDe(w.fecha_inicio) : null]));
      const conLunes = sesiones.map((x) => ({ ...x, semana_lunes: lunesDeSemana[x.semana_id] }));
      const porSemana = agrupar(sesiones, 'semana_id');
      const listaRacha = semanas.map((w) => ({ fecha_inicio: w.fecha_inicio, total: (porSemana[w.id] || []).length, hechas: (porSemana[w.id] || []).filter((x) => x.completada).length }));
      const { eventos } = eventosRecord(series);
      const lunesHoy = lunesDe(hoy);
      return Array.from({ length: n }, (_, i) => {
        const lunes = sumarDias(lunesHoy, -7 * (i + 1));
        return { ...resumenSemanal({ series, sesiones: conLunes, pesos }, lunes, { eventos }), racha: racha(listaRacha, sumarDias(lunes, 6)) };
      }).filter((r) => !r.vacia);
    },
    // Actividad de un atleta (para el coach): lo que ha hecho en los últimos días, de lo más reciente a lo más antiguo.
    // [{ tipo, fecha, cuando, titulo, detalle, icono, pestana, aviso }]
    async actividad(atletaId, dias = 45, hoy = hoyISO()) {
      const desde = sumarDias(hoy, -dias);
      const [entrenos, series, checkins, pesos, archivos, comentarios] = await Promise.all([
        api.entrenamientos(atletaId),
        api.historial(atletaId),
        b.select('checkins', { eq: { atleta_id: atletaId }, gte: { semana_inicio: sumarDias(desde, -7) } }).catch(() => []),
        b.select('pesos', { eq: { atleta_id: atletaId }, gte: { fecha: desde }, order: [['fecha', 'asc']] }).catch(() => []),
        b.select('archivos', { eq: { atleta_id: atletaId }, gte: { fecha: desde } }),
        b.select('comentarios', { eq: { atleta_id: atletaId, autor: 'atleta' }, gte: { creado_en: `${desde}T00:00:00` } }),
      ]);
      const recordsPorSesion = {};
      for (const e of eventosRecord(series).eventos) if (e.sesion_id) (recordsPorSesion[e.sesion_id] ||= []).push(e);
      const ev = [];
      for (const x of entrenos.filter((e) => e.fecha && e.fecha >= desde)) {
        const rec = recordsPorSesion[x.id] || [];
        ev.push({ tipo: 'sesion', fecha: x.fecha, cuando: `${x.fecha}T20:00`, icono: 'hoy', pestana: 'registro',
          titulo: `Hizo ${x.nombre}`, detalle: [x.series ? `${x.series} series` : null, x.tonelaje ? `${num(Math.round(x.tonelaje / 100) / 10, 1)} t` : null, cardioHechoValido(x.cardio_hecho) ? `${NOMBRE_MODALIDAD[x.cardio_hecho.modalidad].toLowerCase()}: ${textoCardioHecho(x.cardio_hecho)}` : x.duracion_min ? `${x.duracion_min} min` : null, x.rpe_sesion ? `esfuerzo ${num(x.rpe_sesion)}/10` : null].filter(Boolean).join(', ') });
        for (const r of rec) ev.push({ tipo: 'record', fecha: x.fecha, cuando: `${x.fecha}T19:59`, icono: 'trofeo', pestana: 'seguimiento', titulo: `Récord en ${r.ejercicio}`, detalle: r.record.texto });
      }
      for (const c of checkins) {
        // Se cuenta el día en que lo envió (como muy tarde, el lunes siguiente a su semana)
        const f = [fechaDe(c.creado_en), sumarDias(c.semana_inicio, 7)].filter(Boolean).sort()[0];
        if (f < desde) continue;
        ev.push({ tipo: 'checkin', fecha: f, cuando: c.creado_en || `${f}T09:00`, icono: 'checkin', pestana: 'seguimiento', titulo: `Envió su check-in (${rangoSemana(c.semana_inicio)})`,
          detalle: [c.energia ? `energía ${c.energia}/5` : null, c.motivacion ? `motivación ${c.motivacion}/5` : null, c.horas_sueno ? `sueño ${c.horas_sueno.replace('-', '–')} h` : null].filter(Boolean).join(', '), aviso: (c.energia && c.energia <= 2) || (c.motivacion && c.motivacion <= 2) });
      }
      // Pesos: uno por semana (la última pesada), para no llenar la lista
      const porSemana = {};
      for (const p of pesos) (porSemana[lunesDe(p.fecha)] ||= []).push(p);
      for (const lista of Object.values(porSemana)) {
        const u = lista[lista.length - 1];
        ev.push({ tipo: 'peso', fecha: u.fecha, cuando: `${u.fecha}T08:00`, icono: 'bascula', pestana: 'seguimiento', titulo: `Se pesó: ${num(Number(u.kg))} kg`, detalle: lista.length > 1 ? `${lista.length} pesadas esa semana` : '' });
      }
      for (const a of archivos) ev.push({ tipo: a.tipo === 'foto_progreso' ? 'foto' : 'video', fecha: fechaDe(a.creado_en) || a.fecha, cuando: a.creado_en || `${a.fecha}T19:00`, icono: a.tipo === 'foto_progreso' ? 'camara' : 'video', pestana: 'videos',
        titulo: a.tipo === 'foto_progreso' ? 'Subió una foto de progreso' : 'Envió un vídeo de técnica', detalle: a.nota_atleta || '', aviso: !a.revisado_en });
      for (const c of comentarios) ev.push({ tipo: 'mensaje', fecha: fechaDe(c.creado_en), cuando: c.creado_en, icono: 'mensaje', pestana: c.sesion_id ? 'registro' : c.checkin_id ? 'seguimiento' : c.archivo_id ? 'videos' : 'programa',
        titulo: 'Te escribió', detalle: `«${c.texto.length > 140 ? `${c.texto.slice(0, 140)}…` : c.texto}»` });
      // Por día (lo más reciente primero) y, dentro del día, por hora
      return ev.filter((e) => e.fecha >= desde).sort((x, y) => (`${x.fecha}|${x.cuando}` < `${y.fecha}|${y.cuando}` ? 1 : -1));
    },
    // Avisos del coach en vigor para este atleta (los generales y los suyos), del más reciente al más antiguo
    async avisos(atletaId, hoy = hoyISO()) {
      const [generales, suyos] = await Promise.all([
        b.select('avisos', { nulo: ['atleta_id'], lte: { desde: hoy } }),
        b.select('avisos', { eq: { atleta_id: atletaId }, lte: { desde: hoy } }),
      ]);
      return [...generales, ...suyos].filter((a) => !a.hasta || a.hasta >= hoy).sort((x, y) => (x.creado_en < y.creado_en ? 1 : -1));
    },
    // Coach: todos sus avisos (la hoja separa los caducados, que se pueden borrar)
    async avisosCoach() {
      return b.select('avisos', { order: [['desde', 'asc'], ['creado_en', 'asc']] });
    },
    // «¿Cómo llegas hoy?» (datos de salud: la base exige el consentimiento)
    async guardarPreparacion(sesionId, preparacion) {
      return (await b.update('sesiones', { preparacion }, { eq: { id: sesionId } }))[0];
    },
    // Informes de sus bloques (los que tienen semanas publicadas), del más reciente al más antiguo
    async informes(atletaId, { salud = true, hoy = hoyISO() } = {}) {
      const bloques = await b.select('bloques', { eq: { atleta_id: atletaId, es_plantilla: false } });
      if (!bloques.length) return [];
      const semanas = await b.select('semanas', { in: { bloque_id: bloques.map((x) => x.id) }, eq: { programacion: 'programada' } });
      if (!semanas.length) return [];
      const sesiones = await b.select('sesiones', { in: { semana_id: semanas.map((x) => x.id) } });
      const [pautas, series, pesos] = await Promise.all([
        sesiones.length ? b.select('sesion_ejercicios', { in: { sesion_id: sesiones.map((x) => x.id) } }) : [],
        api.historial(atletaId),
        salud ? b.select('pesos', { eq: { atleta_id: atletaId }, order: [['fecha', 'asc']] }).catch(() => []) : [],
      ]);
      const { eventos } = eventosRecord(series);
      const semPorBloque = agrupar(semanas, 'bloque_id');
      return bloques.filter((bl) => semPorBloque[bl.id]?.length)
        .map((bl) => informeBloque({ bloque: bl, semanas: semPorBloque[bl.id], sesiones, pautas, series, eventos, pesos }, hoy))
        .filter(Boolean)
        .sort((x, y) => (x.inicio < y.inicio ? 1 : -1));
    },
    // Logros: cuentas de toda su historia (sesiones, racha más larga, toneladas, récords, vídeos, check-ins y días con peso)
    async logros(atletaId, { salud = true, hoy = hoyISO() } = {}) {
      const bloques = await b.select('bloques', { eq: { atleta_id: atletaId, es_plantilla: false }, cols: COLS_BLOQUE });
      const semanas = bloques.length ? await b.select('semanas', { in: { bloque_id: bloques.map((x) => x.id) }, eq: { programacion: 'programada' }, cols: 'id,bloque_id,fecha_inicio,programacion' }) : [];
      const cuentan = semanasQueCuentan(semanas, bloques);
      const [sesiones, series, videos, checkins, pesos] = await Promise.all([
        semanas.length ? b.select('sesiones', { in: { semana_id: semanas.map((x) => x.id) }, cols: 'id,semana_id,completada' }) : [],
        api.historial(atletaId),
        b.select('archivos', { eq: { atleta_id: atletaId, tipo: 'video_tecnica' }, cols: 'id' }),
        salud ? b.select('checkins', { eq: { atleta_id: atletaId }, cols: 'id' }).catch(() => []) : [],
        salud ? b.select('pesos', { eq: { atleta_id: atletaId }, cols: 'fecha' }).catch(() => []) : [],
      ]);
      const porSemana = agrupar(sesiones, 'semana_id');
      const listaRacha = cuentan.map((w) => ({ fecha_inicio: w.fecha_inicio, total: (porSemana[w.id] || []).length, hechas: (porSemana[w.id] || []).filter((x) => x.completada).length }));
      const hechas = series.filter((s) => Number(s.reps) > 0);
      const cuentas = {
        sesiones: sesiones.filter((x) => x.completada).length,
        racha: rachaMaxima(listaRacha, hoy),
        toneladas: Math.floor(hechas.reduce((t, s) => t + (Number(s.kg) || 0) * (Number(s.reps) || 0), 0) / 1000),
        records: eventosRecord(series).eventos.length,
        videos: videos.length,
        checkins: checkins.length,
        peso: new Set(pesos.map((p) => p.fecha)).size,
      };
      return { cuentas, lista: calcularLogros(cuentas, { salud }) };
    },
    // Carga de entrenamiento (RPE de sesión × minutos) de las últimas semanas, en todos sus bloques
    async carga(atletaId, semanas = 8, hoy = hoyISO()) {
      const bloques = await b.select('bloques', { eq: { atleta_id: atletaId, es_plantilla: false }, cols: 'id' });
      const sem = bloques.length ? await b.select('semanas', { in: { bloque_id: bloques.map((x) => x.id) }, cols: 'id' }) : [];
      const desde = sumarDias(lunesDe(hoy), -7 * semanas);
      const sesiones = sem.length ? await b.select('sesiones', { in: { semana_id: sem.map((x) => x.id) }, eq: { completada: true }, gte: { fecha_realizada: desde } }) : [];
      const lista = cargaSemanal(sesiones, hoy, semanas);
      return { semanas: lista, cambio: cambioCarga(lista) };
    },
    // Mejores marcas de cada ejercicio sin contar una sesión (la que se está haciendo), para detectar récords en directo
    async marcasPrevias(atletaId, sesionId = null) {
      const todas = await api.historial(atletaId);
      return mejoresMarcas(todas.filter((s) => !sesionId || s.sesion_id !== sesionId));
    },
    async vitrina(atletaId) {
      return vitrina(await api.historial(atletaId));
    },
    async historialEjercicio(atletaId, ejercicioId) {
      const todas = await api.historial(atletaId);
      const lista = todas.filter((s) => s.ejercicio_id === ejercicioId);
      return { ...resumenEjercicio(lista), series: lista };
    },
    async progreso(atletaId) {
      const [series, pesos, checkins, medidas, [ficha]] = await Promise.all([
        api.historial(atletaId),
        b.select('pesos', { eq: { atleta_id: atletaId }, order: [['fecha', 'asc']] }),
        b.select('checkins', { eq: { atleta_id: atletaId }, order: [['semana_inicio', 'asc']] }),
        b.select('medidas', { eq: { atleta_id: atletaId }, order: [['fecha', 'asc']] }),
        b.select('atletas', { eq: { id: atletaId }, cols: 'volumen_objetivo' }),
      ]);
      const porEjercicio = agrupar(series.filter((s) => s.ejercicio_id), 'ejercicio_id');
      const ejercicios = Object.entries(porEjercicio).map(([id, ss]) => {
        const puntos = e1rmPorSemana(ss);
        return { id, nombre: ss[0].ejercicio, puntos, series: ss.length, mejor: Math.max(0, ...puntos.map((p) => p.valor)) };
      }).filter((e) => e.puntos.length).sort((a, c) => c.series - a.series);
      const lunes = lunesDe(hoyISO());
      return {
        pesos, checkins, ejercicios, medidas, vitrina: vitrina(series), volumenObjetivo: ficha?.volumen_objetivo || null,
        volumen: { estaSemana: seriesPorGrupo(series, lunes), anterior: seriesPorGrupo(series, sumarDias(lunes, -7)) },
      };
    },
    async marcas(atletaId) {
      const marcas = await b.select('marcas', { eq: { atleta_id: atletaId }, order: [['fecha', 'desc']] });
      const ej = porId(await b.select('ejercicios', { in: { id: unicos(marcas.map((m) => m.ejercicio_id)) } }));
      return marcas.map((m) => ({ ...m, ejercicio: ej[m.ejercicio_id]?.nombre || 'Ejercicio' }));
    },
    async guardarMarca({ atleta_id, ejercicio_id, fecha = hoyISO(), kg, reps = 1, tipo = 'test', notas = null }) {
      return (await b.insert('marcas', [{ atleta_id, ejercicio_id, fecha, kg, reps, tipo, notas }]))[0];
    },
    async borrarMarca(id) { return b.delete('marcas', { eq: { id } }); },
    // Objetivos; los enlazados a un ejercicio traen su progreso calculado (auto) y el nombre del ejercicio
    async objetivos(atletaId, hoy = hoyISO()) {
      const lista = await b.select('objetivos', { eq: { atleta_id: atletaId }, order: [['fecha_limite', 'asc']] });
      const enlazados = lista.filter((o) => o.ejercicio_id);
      if (!enlazados.length) return lista;
      const [series, ejercicios] = await Promise.all([
        api.historial(atletaId),
        b.select('ejercicios', { in: { id: unicos(enlazados.map((o) => o.ejercicio_id)) }, cols: 'id,nombre' }).then(porId),
      ]);
      return lista.map((o) => (o.ejercicio_id ? { ...o, ejercicio: ejercicios[o.ejercicio_id]?.nombre || null, auto: progresoObjetivo(o, series, hoy) } : o));
    },
    // Al enlazar un objetivo: su mejor 1RM estimado de ahora, para medir el progreso desde ahí
    async e1rmActual(atletaId, ejercicioId, hoy = hoyISO()) {
      const series = (await api.historial(atletaId)).filter((s) => s.ejercicio_id === ejercicioId);
      const v = mejorReciente(series, hoy);
      return v ? Math.round(v * 10) / 10 : null;
    },

    // ------------------------------------------------------------ comentarios
    // Hilo de una sesión, un check-in o un archivo (o los generales del atleta si no se indica ninguno).
    async comentarios({ atletaId = null, sesionId = null, checkinId = null, archivoId = null }) {
      const eq = {};
      if (sesionId) eq.sesion_id = sesionId;
      else if (checkinId) eq.checkin_id = checkinId;
      else if (archivoId) eq.archivo_id = archivoId;
      else Object.assign(eq, { atleta_id: atletaId, sesion_id: null, checkin_id: null, archivo_id: null });
      return b.select('comentarios', { eq, order: [['creado_en', 'asc']] });
    },
    // dibujo: líneas y ángulos sobre un fotograma del vídeo ({ t, formas }), solo en comentarios de un vídeo
    async comentar({ atletaId, sesionId = null, checkinId = null, archivoId = null, texto, autor, dibujo = null }) {
      const fila = { atleta_id: atletaId, sesion_id: sesionId, checkin_id: checkinId, archivo_id: archivoId, texto: texto.trim(), autor };
      if (archivoId && dibujo) {
        if (!dibujoValido(dibujo)) throw new Error('El dibujo no tiene la forma que toca');
        fila.dibujo = dibujo;
      }
      return (await b.insert('comentarios', [fila]))[0];
    },
    async marcarLeidos(ids) {
      if (!ids.length) return [];
      return b.update('comentarios', { leido_en: new Date().toISOString() }, { in: { id: ids } });
    },
    // Lo que le ha escrito el coach y aún no ha leído
    async noLeidos(atletaId) {
      return b.select('comentarios', { eq: { atleta_id: atletaId, autor: 'coach' }, nulo: ['leido_en'], order: [['creado_en', 'desc']] });
    },
    // Un comentario es «un mensaje del chat» si va suelto o si lleva un adjunto del chat (lo marca la base);
    // lo demás es una respuesta pegada a una sesión, un check-in o un vídeo del diario
    esMensaje(c) { return !!c && (!!c.adjunto || (!c.sesion_id && !c.checkin_id && !c.archivo_id)); },
    // El chat (v0.18): todos los mensajes con un atleta en un solo hilo, con su contexto (sesión, check-in o vídeo)
    // y el archivo si lo hay. Los más antiguos primero.
    async conversacion(atletaId, { limite = 400 } = {}) {
      const todos = await b.select('comentarios', { eq: { atleta_id: atletaId }, order: [['creado_en', 'desc']], limit: limite });
      const mensajes = todos.reverse();
      const sesIds = unicos(mensajes.map((c) => c.sesion_id).filter(Boolean));
      const arcIds = unicos(mensajes.map((c) => c.archivo_id).filter(Boolean));
      const [sesiones, archivos] = await Promise.all([
        sesIds.length ? b.select('sesiones', { in: { id: sesIds }, cols: 'id,nombre,semana_id' }).catch(() => []) : [],
        arcIds.length ? b.select('archivos', { in: { id: arcIds } }).catch(() => []) : [],
      ]);
      const S = porId(sesiones), A = porId(archivos);
      const vistos = new Set();
      return mensajes.map((c) => {
        const archivo = c.archivo_id ? A[c.archivo_id] || null : null;
        // El vídeo o la foto se enseña en el primer mensaje de su hilo; los siguientes solo llevan la etiqueta
        const conMedio = !!archivo && !vistos.has(archivo.id);
        if (archivo) vistos.add(archivo.id);
        const contexto = c.sesion_id ? { tipo: 'sesion', id: c.sesion_id, nombre: S[c.sesion_id]?.nombre || 'una sesión' }
          : c.checkin_id ? { tipo: 'checkin', id: c.checkin_id, nombre: 'check-in' }
          : archivo ? { tipo: 'archivo', id: archivo.id, nombre: archivo.tipo === 'adjunto' ? null : /^video/.test(archivo.mime || '') || archivo.tipo === 'video_tecnica' ? 'vídeo' : 'foto' }
          : null;
        return { ...c, contexto, archivo: conMedio ? archivo : null, archivoId: archivo?.id || null };
      });
    },
    // El coach: una conversación por atleta, con el último mensaje y cuántos tiene sin leer; las que tienen
    // algo sin leer primero, luego por el último mensaje
    async conversaciones() {
      const [atletas, comentarios] = await Promise.all([
        api.atletas(),
        b.select('comentarios', { order: [['creado_en', 'desc']], limit: 2000, cols: 'id,atleta_id,autor,texto,creado_en,leido_en,sesion_id,checkin_id,archivo_id' }),
      ]);
      const por = {};
      for (const c of comentarios) {
        const x = (por[c.atleta_id] ||= { ultimo: c, sinLeer: 0 });
        if (c.autor === 'atleta' && !c.leido_en) x.sinLeer++;
      }
      return atletas.filter((a) => a.estado !== 'baja' || por[a.id]).map((a) => ({ atleta: a, ultimo: por[a.id]?.ultimo || null, sinLeer: por[a.id]?.sinLeer || 0 }))
        .sort((x, y) => (y.sinLeer > 0) - (x.sinLeer > 0) || String(y.ultimo?.creado_en || '').localeCompare(String(x.ultimo?.creado_en || '')) || x.atleta.nombre.localeCompare(y.atleta.nombre));
    },
    // Cuántos mensajes de atletas tiene el coach sin leer (la insignia de Mensajes)
    async mensajesSinLeer() {
      const filas = await b.select('comentarios', { eq: { autor: 'atleta' }, nulo: ['leido_en'], cols: 'id' });
      return filas.length;
    },
    // Enviar desde el chat: texto, o una foto o un vídeo con texto (adjunto). Si el vídeo es de técnica
    // (enDiario), se guarda como tal: entra en su diario y en tu bandeja de vídeos, con su propio hilo.
    async enviarMensaje(atletaId, { texto = '', archivo = null, autor, enDiario = false, poster = null, duracion_seg = null }) {
      const t = String(texto || '').trim();
      if (!archivo) return api.comentar({ atletaId, texto: t, autor });
      const esVideo = /^video\//.test(archivo.type || '');
      const tipo = enDiario ? (esVideo ? 'video_tecnica' : 'foto_progreso') : 'adjunto';
      const fila = await api.subirArchivo(atletaId, archivo, { tipo, nota_atleta: enDiario && t ? t.slice(0, 500) : null, poster, duracion_seg });
      try {
        return await api.comentar({ atletaId, archivoId: fila.id, texto: t || (esVideo ? 'Vídeo' : 'Foto'), autor });
      } catch (e) {
        // Sin su mensaje, un adjunto no es nada: se retira (un vídeo del diario se queda, ya está en el diario)
        if (tipo === 'adjunto') await api.borrarArchivo(fila).catch(() => {});
        throw e;
      }
    },
    // Borrar un mensaje propio (el coach, cualquiera); si llevaba un adjunto del chat, se va con él
    async borrarMensaje(c) {
      await b.delete('comentarios', { eq: { id: c.id } });
      if (c.archivoId && c.archivo?.tipo === 'adjunto') await api.borrarArchivo(c.archivo).catch(() => {});
    },

    // ------------------------------------------------------------ vídeos y fotos (Storage privado)
    async archivos(atletaId, tipo = null) {
      const eq = { atleta_id: atletaId };
      if (tipo) eq.tipo = tipo;
      // Los adjuntos del chat no son vídeos de técnica ni fotos de progreso: solo salen si se piden
      return b.select('archivos', { eq, ...(tipo ? {} : { neq: { tipo: 'adjunto' } }), order: [['fecha', 'desc'], ['creado_en', 'desc']] });
    },
    // El diario de entrenamiento: vídeos y fotos (sin adjuntos) con lo que hace falta para la cuadrícula:
    // el ejercicio, si el coach ha contestado y cuántos comentarios tiene cada uno
    async diario(atletaId) {
      const [archivos, comentarios] = await Promise.all([
        api.archivos(atletaId),
        b.select('comentarios', { eq: { atleta_id: atletaId }, nonulo: ['archivo_id'], cols: 'archivo_id,autor,creado_en' }).catch(() => []),
      ]);
      const seIds = unicos(archivos.filter((a) => !a.ejercicio_id && a.sesion_ejercicio_id).map((a) => a.sesion_ejercicio_id));
      const pautas = seIds.length ? await b.select('sesion_ejercicios', { in: { id: seIds }, cols: 'id,ejercicio_id' }).catch(() => []) : [];
      const ejIds = unicos([...archivos.map((a) => a.ejercicio_id), ...pautas.map((p) => p.ejercicio_id)].filter(Boolean));
      const ejercicios = porId(ejIds.length ? await b.select('ejercicios', { in: { id: ejIds }, cols: 'id,nombre' }) : []);
      const pautaPorId = porId(pautas);
      const porArchivo = {};
      for (const c of comentarios) { const x = (porArchivo[c.archivo_id] ||= { n: 0, coach: false }); x.n++; if (c.autor === 'coach') x.coach = true; }
      return archivos.map((a) => {
        const ejId = a.ejercicio_id || pautaPorId[a.sesion_ejercicio_id]?.ejercicio_id || null;
        return { ...a, ejercicio: ejId ? ejercicios[ejId] || null : null, comentarios: porArchivo[a.id]?.n || 0, respondido: !!porArchivo[a.id]?.coach };
      });
    },
    // Lo que el atleta puede cambiar de un archivo suyo (el coach, también): pie, ejercicio y destacado
    async editarArchivo(id, { nota_atleta, ejercicio_id, destacado } = {}) {
      const c = {};
      if (nota_atleta !== undefined) c.nota_atleta = nota_atleta;
      if (ejercicio_id !== undefined) c.ejercicio_id = ejercicio_id;
      if (destacado !== undefined) c.destacado = !!destacado;
      return (await b.update('archivos', c, { eq: { id } }))[0];
    },
    // Espacio ocupado en Storage, por atleta (para que el coach sepa por dónde va el plan)
    async espacioUsado() {
      const [archivos, atletas] = await Promise.all([b.select('archivos', { cols: 'atleta_id,bytes,tipo' }), api.atletas()]);
      const por = {};
      for (const a of archivos) { const x = (por[a.atleta_id] ||= { bytes: 0, n: 0 }); x.bytes += Number(a.bytes) || 0; x.n++; }
      const lista = atletas.map((a) => ({ atleta: a, bytes: por[a.id]?.bytes || 0, n: por[a.id]?.n || 0 })).sort((x, y) => y.bytes - x.bytes);
      return { total: lista.reduce((t, x) => t + x.bytes, 0), archivos: archivos.length, lista };
    },
    // poster: miniatura (Blob JPEG) de un vídeo, generada en el móvil; duracion_seg: su duración
    async subirArchivo(atletaId, archivo, { tipo, sesion_ejercicio_id = null, ejercicio_id = null, nota_atleta = null, pose = null, poster = null, duracion_seg = null }) {
      if (archivo.size > LIMITE_ARCHIVO_MB * 1024 * 1024) throw new Error(`El archivo pesa más de ${LIMITE_ARCHIVO_MB} MB. Graba solo la serie (unos 30 segundos) o recórtalo.`);
      const ext = String(archivo.name || '').split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5)
        || String(archivo.type || '').split('/')[1] || 'bin';
      const esImagen = /^image\//.test(archivo.type || '') || tipo === 'foto_progreso';
      const ruta = `${atletaId}/${tipo === 'adjunto' ? (esImagen ? 'adjunto' : 'adjunto-video') : esImagen ? 'foto' : 'video'}-${hoyISO()}-${aleatorio()}.${ext}`;
      const poster_ruta = poster && !esImagen ? `${ruta}.jpg` : null;
      const dur = Number.isFinite(Number(duracion_seg)) && duracion_seg >= 0 ? Math.min(3600, Math.round(Number(duracion_seg))) : null;
      // Primero se registra (la base comprueba consentimiento, ruta y límite diario) y después se sube:
      // Storage solo acepta archivos ya registrados.
      const [fila] = await b.insert('archivos', [{
        atleta_id: atletaId, tipo, ruta, sesion_ejercicio_id, ejercicio_id, nota_atleta,
        mime: archivo.type || null, bytes: archivo.size ?? null, fecha: hoyISO(),
        ...(tipo === 'foto_progreso' && pose ? { pose } : {}),
        ...(poster_ruta ? { poster_ruta } : {}), ...(dur != null ? { duracion_seg: dur } : {}),
      }]);
      try {
        await b.storage.subir(ruta, archivo, archivo.type || 'application/octet-stream');
        // La miniatura es un extra: si falla, el vídeo queda igualmente (la cuadrícula enseña el primer fotograma)
        if (poster_ruta) await b.storage.subir(poster_ruta, poster, 'image/jpeg').catch(async () => { await b.update('archivos', { poster_ruta: null }, { eq: { id: fila.id } }).catch(() => {}); fila.poster_ruta = null; });
      } catch (e) {
        await b.delete('archivos', { eq: { id: fila.id } }).catch(() => {});
        throw e;
      }
      return fila;
    },
    async urlArchivo(ruta) { return b.storage.url(ruta); },
    async borrarArchivo(archivo) {
      await b.delete('archivos', { eq: { id: archivo.id } });
      await b.storage.borrar([archivo.ruta, ...(archivo.poster_ruta ? [archivo.poster_ruta] : [])]).catch(() => {});
    },

    // ------------------------------------------------------------ recursos
    async recursos() {
      return b.select('recursos', { order: [['orden', 'asc'], ['creado_en', 'asc']] });
    },

    // ------------------------------------------------------------ exportaciones
    async exportar(atletaId) {
      const [atleta] = await b.select('atletas', { eq: { id: atletaId } });
      const perfilId = atleta?.perfil_id || null;
      const out = {
        exportado_en: new Date().toISOString(),
        perfil: perfilId ? (await b.select('perfiles', { eq: { id: perfilId } }))[0] || null : null,
        consentimientos: perfilId ? await b.select('consentimientos', { eq: { perfil_id: perfilId } }) : [],
        atletas: atleta ? [atleta] : [],
      };
      // notas_coach: solo las ve el coach (si exporta el atleta, salen vacías)
      // Los cobros no van aquí (es el archivo que se le da al atleta): están en la copia completa del coach
      for (const t of ['bloques', 'series', 'pesos', 'checkins', 'molestias', 'notas_coach', 'medidas', 'marcas', 'objetivos', 'comentarios', 'archivos', 'notas_ejercicio', 'avisos', 'recursos', 'habitos', 'registros_habito', 'planes_nutricion', 'registros_nutricion', 'cuestionarios']) {
        out[t] = await b.select(t, { eq: { atleta_id: atletaId } });
      }
      // Las preguntas que le hace su coach (también las de todos y las archivadas), para entender sus respuestas
      out.preguntas_checkin = await api.preguntasCheckin(atletaId, { archivadas: true });
      // Las notificaciones solo las ve su dueño (si exporta el coach, salen vacías); de los móviles, sin sus claves
      out.preferencias_notificaciones = perfilId ? await b.select('preferencias_notificaciones', { eq: { usuario_id: perfilId } }) : [];
      out.notificaciones = perfilId ? await b.select('notificaciones', { eq: { usuario_id: perfilId } }) : [];
      out.suscripciones_push = perfilId ? (await b.select('suscripciones_push', { eq: { usuario_id: perfilId } }))
        .map(({ id, dispositivo, creada_en, usada_en }) => ({ id, dispositivo, creada_en, usada_en })) : [];
      // Comidas (v0.26): sus comidas del día, su recetario (con las recetas) y su menú
      for (const t of ['comidas_atleta', 'recetas_atleta', 'menu_comidas']) out[t] = await b.select(t, { eq: { atleta_id: atletaId } }).catch(() => []);
      out.recetas = out.recetas_atleta.length ? await b.select('recetas', { in: { id: unicos(out.recetas_atleta.map((x) => x.receta_id)) } }).catch(() => []) : [];
      out.semanas = await b.select('semanas', { in: { bloque_id: out.bloques.map((x) => x.id) } });
      out.sesiones = await b.select('sesiones', { in: { semana_id: out.semanas.map((s) => s.id) } });
      out.sesion_ejercicios = await b.select('sesion_ejercicios', { in: { sesion_id: out.sesiones.map((s) => s.id) } });
      return out;
    },
    async seriesCsv(atletaId) {
      return seriesACsv(await api.historial(atletaId));
    },
    // Copia de todo (coach): para guardarla tú una vez al mes, además de las copias de Supabase
    async copiaCompleta() {
      const out = { exportado_en: new Date().toISOString(), version: 2 };
      // (los cobros, si la base aún no tiene la migración 020, vacíos: la copia no se queda a medias)
      // Solo si la tabla no existe: cualquier otro fallo (un corte, un tiempo de espera) para la copia, para que
      // nunca parezca completa sin estarlo
      const noExiste = (e) => /schema cache|does not exist|no existe|PGRST205|42P01/i.test(`${e?.message || ''} ${e?.code || ''}`);
      for (const t of TABLAS_COPIA) out[t] = await b.select(t, t === 'recetas' ? { pagina: 50 } : {}).catch((e) => { if (TABLAS_OPCIONALES.includes(t) && noExiste(e)) return []; throw e; });
      return out;
    },

    // ------------------------------------------------------------ coach: atletas
    // Los atletas, con su foto de perfil (si la han puesto; la foto está en su perfil, no en la ficha)
    async atletas() {
      const atletas = await b.select('atletas', { order: [['nombre', 'asc']] });
      const ids = unicos(atletas.map((a) => a.perfil_id).filter(Boolean));
      if (!ids.length) return atletas;
      const perfiles = porId(await b.select('perfiles', { in: { id: ids }, cols: 'id,foto' }).catch(() => []));
      return atletas.map((a) => ({ ...a, foto: (a.perfil_id && perfiles[a.perfil_id]?.foto) || null }));
    },
    async resumenes(hoy = hoyISO()) {
      const atletas = await api.atletas();
      if (!atletas.length) return [];
      const ids = atletas.map((a) => a.id);
      // El bloque de cada atleta: el activo (o ajustado); si no tiene, el planificado más reciente (como lo que ve el atleta)
      const candidatos = await b.select('bloques', { in: { atleta_id: ids, estado: ['activo', 'ajustado', 'planificado'] }, eq: { es_plantilla: false } });
      const bloques = ids.map((id) => bloqueActual(candidatos.filter((x) => x.atleta_id === id))).filter(Boolean);
      const semanas = await b.select('semanas', { in: { bloque_id: bloques.map((x) => x.id) } });
      const semanasPorBloque = agrupar(semanas, 'bloque_id');
      const actuales = {};
      for (const bl of bloques) {
        const visibles = (semanasPorBloque[bl.id] || []).filter((s) => s.programacion === 'programada');
        const act = semanaActual(visibles, hoy);
        if (act) actuales[bl.id] = act;
      }
      const sesiones = agrupar(await b.select('sesiones', { in: { semana_id: Object.values(actuales).map((s) => s.id) } }), 'semana_id');
      const desde = sumarDias(lunesDe(hoy), -63);
      const [pesos, checkins, molestias, ultimas] = await Promise.all([
        b.select('pesos', { in: { atleta_id: ids }, gte: { fecha: desde }, order: [['fecha', 'desc']] }),
        b.select('checkins', { in: { atleta_id: ids }, gte: { semana_inicio: desde }, order: [['semana_inicio', 'desc']] }),
        b.select('molestias', { in: { atleta_id: ids }, gte: { semana_inicio: sumarDias(lunesDe(hoy), -14) } }),
        // la última serie de cada atleta: una consulta pequeña por atleta, en paralelo
        Promise.all(ids.map((id) => b.select('series', { eq: { atleta_id: id }, order: [['registrada_en', 'desc']], limit: 1, cols: 'atleta_id,registrada_en' }))),
      ]);
      // Sesiones hechas en las últimas 6 semanas (para la carga), de todos sus bloques
      const todosBloques = await b.select('bloques', { in: { atleta_id: ids }, eq: { es_plantilla: false }, cols: COLS_BLOQUE });
      const todasSemanas = todosBloques.length ? await b.select('semanas', { in: { bloque_id: todosBloques.map((x) => x.id) }, cols: 'id,bloque_id,fecha_inicio,programacion' }) : [];
      const recientes = todasSemanas.length ? await b.select('sesiones', { in: { semana_id: todasSemanas.map((x) => x.id) }, eq: { completada: true }, gte: { fecha_realizada: sumarDias(lunesDe(hoy), -42) } }) : [];
      // Cumplimiento de las 4 últimas semanas acabadas: sesiones, series pautadas hechas y esfuerzo frente a la pauta
      const lunesHoy = lunesDe(hoy);
      const sem4 = semanasQueCuentan(todasSemanas, todosBloques).filter((w) => lunesDe(w.fecha_inicio) >= sumarDias(lunesHoy, -28) && lunesDe(w.fecha_inicio) < lunesHoy);
      const ses4 = sem4.length ? await b.select('sesiones', { in: { semana_id: sem4.map((w) => w.id) }, cols: 'id,semana_id,completada' }) : [];
      const pau4 = ses4.length ? await b.select('sesion_ejercicios', { in: { sesion_id: ses4.map((x) => x.id) }, cols: 'id,sesion_id,series,rpe_objetivo,rir_objetivo' }) : [];
      const ser4 = pau4.length ? await b.select('series', { in: { sesion_ejercicio_id: pau4.map((x) => x.id) }, cols: 'sesion_ejercicio_id,reps,rpe,rir', limit: 20000 }) : [];
      const lunesSem4 = Object.fromEntries(sem4.map((w) => [w.id, lunesDe(w.fecha_inicio)]));
      const bloqueDeSemana = Object.fromEntries(todasSemanas.map((w) => [w.id, w.bloque_id]));
      const atletaDeBloque = Object.fromEntries(todosBloques.map((x) => [x.id, x.atleta_id]));
      const R = {};
      for (const x of recientes) (R[atletaDeBloque[bloqueDeSemana[x.semana_id]]] ||= []).push(x);
      const P = agrupar(pesos, 'atleta_id'), C = agrupar(checkins, 'atleta_id'), M = agrupar(molestias, 'atleta_id');
      const ultima = {};
      for (const [s] of ultimas) if (s) ultima[s.atleta_id] = fechaDe(s.registrada_en);
      const S4 = {};
      for (const x of ses4) (S4[atletaDeBloque[bloqueDeSemana[x.semana_id]]] ||= []).push({ ...x, semana_lunes: lunesSem4[x.semana_id] });
      // Hábitos: cumplimiento de la última semana (7 días hasta hoy) de cada atleta
      const habitosTodos = await b.select('habitos', { in: { atleta_id: ids }, eq: { activo: true } });
      const regsHab = habitosTodos.length ? await b.select('registros_habito', { in: { habito_id: habitosTodos.map((h) => h.id) }, gte: { fecha: sumarDias(hoy, -7) } }) : [];
      const regsPorHabito = agrupar(regsHab, 'habito_id');
      const habitosPorAtleta = agrupar(habitosTodos, 'atleta_id');
      // Nutrición: sus planes y qué días ha apuntado en la última semana
      const [planesN, regsN] = await Promise.all([
        b.select('planes_nutricion', { in: { atleta_id: ids } }).catch(() => []),
        b.select('registros_nutricion', { in: { atleta_id: ids }, gte: { fecha: sumarDias(hoy, -7) }, cols: 'atleta_id,fecha' }).catch(() => []),
      ]);
      const PN = agrupar(planesN, 'atleta_id'), RN = agrupar(regsN, 'atleta_id');
      // Recetas que piden cambiar (v0.26; sin la migración 022, ninguna)
      const cambiosR = await b.select('recetas_atleta', { in: { atleta_id: ids }, nonulo: ['cambio_pedido_en'], cols: 'atleta_id' }).catch(() => []);
      const CR = agrupar(cambiosR, 'atleta_id');
      // Cuestionarios con algo de salud que revisar
      const cuestionarios = await b.select('cuestionarios', { in: { atleta_id: ids }, cols: 'atleta_id,resultado,otras,completado_en,revisado_en' }).catch(() => []);
      const Q = Object.fromEntries(cuestionarios.map((c) => [c.atleta_id, c]));
      const res = atletas.map((a) => {
        const s4 = S4[a.id] || [];
        const ids4 = new Set(s4.map((x) => x.id));
        const p4 = pau4.filter((p) => ids4.has(p.sesion_id));
        const idsP4 = new Set(p4.map((p) => p.id));
        const cumple = s4.length ? cumplimiento({ sesiones: s4, pautas: p4, series: ser4.filter((x) => idsP4.has(x.sesion_ejercicio_id)) }, hoy) : null;
        const bloque = bloques.filter((x) => x.atleta_id === a.id).sort((x, y) => (x.fecha_inicio < y.fecha_inicio ? 1 : -1))[0] || null;
        const semana = bloque ? actuales[bloque.id] || null : null;
        const cs = C[a.id] || [];
        return resumenAtleta({
          atleta: a, bloque, semana,
          semanas: bloque ? semanasPorBloque[bloque.id] || [] : [],
          sesiones: semana ? sesiones[semana.id] || [] : [],
          pesos: P[a.id] || [], checkins: cs,
          molestias: (M[a.id] || []).filter((m) => cs[0] && m.semana_inicio === cs[0].semana_inicio),
          ultimaSerie: ultima[a.id] || null,
          sesionesRecientes: R[a.id] || [],
          cumplimiento: cumple,
          habitos: cumplimientoHabitos(habitosPorAtleta[a.id] || [], regsPorHabito, hoy),
          nutricion: a.nutricion === false ? [] : avisosNutricion({ planes: PN[a.id] || [], registros: RN[a.id] || [], ritmoReal: ritmoPeso(tendenciaPeso(P[a.id] || [])) }, hoy),
          cuestionario: avisoCuestionario(Q[a.id]),
          cambiosReceta: (CR[a.id] || []).length,
          diasNutricion: a.nutricion === false ? null : unicos((RN[a.id] || []).filter((x) => x.fecha > sumarDias(hoy, -7) && x.fecha <= hoy).map((x) => x.fecha)).length,
        }, hoy);
      });
      // Cobros (v0.25, solo el coach; sin la migración 020, sin columna): cómo va cada uno, para verlo en el panel
      const pagosTodos = await b.select('pagos', { in: { atleta_id: ids } }).catch(() => null);
      if (pagosTodos) {
        const PG = agrupar(pagosTodos, 'atleta_id');
        for (const r of res) r.cobro = PG[r.atleta_id]?.length ? resumenCobros(PG[r.atleta_id], hoy) : null;
      }
      return res.sort((x, y) => x.prioridad - y.prioridad || x.nombre.localeCompare(y.nombre, 'es'));
    },
    async crearAtleta({ nombre, email = null, objetivo = null, notion_url = null, nivel = null, nutricion = true, entrenamiento = true }) {
      // nivel y nutricion (v0.22) y entrenamiento (v0.26) solo si son distintos de lo de siempre (así una base sin
      // la migración 018 o la 022 sigue dando de alta)
      const fila = { nombre, email, objetivo, notion_url, ...(nivel ? { nivel } : {}), ...(nutricion === false ? { nutricion: false } : {}), ...(entrenamiento === false ? { entrenamiento: false } : {}) };
      return (await b.insert('atletas', [fila]).catch(falta018).catch(falta022))[0];
    },
    async actualizarAtleta(id, cambios) {
      return (await b.update('atletas', cambios, { eq: { id } }).catch(falta018).catch(falta022))[0];
    },
    // Borra al atleta con todo lo suyo, también sus vídeos y fotos de Storage
    // Borrado completo: todo lo que haya en su carpeta de Storage (registrado o no) y después su ficha,
    // que arrastra el resto de sus datos.
    async borrarAtleta(atletaId) {
      const registrados = await b.select('archivos', { eq: { atleta_id: atletaId }, cols: 'id,ruta' });
      const enCarpeta = await b.storage.listar(atletaId);
      const rutas = [...new Set([...registrados.map((a) => a.ruta), ...enCarpeta])];
      if (rutas.length) await b.storage.borrar(rutas);
      return b.delete('atletas', { eq: { id: atletaId } });
    },
    // Verificación en dos pasos del coach: una vez activada, la base la exige siempre
    async exigirDosPasos(valor) {
      return b.update('perfiles', { exige_2fa: !!valor }, { eq: { id: uid() } });
    },
    async crearInvitacion(atletaId) {
      return b.rpc('crear_invitacion', { p_atleta: atletaId });
    },
    async ficha(atletaId) {
      const [ficha] = await b.select('atletas', { eq: { id: atletaId } });
      const fotoDe = ficha?.perfil_id ? (await b.select('perfiles', { eq: { id: ficha.perfil_id }, cols: 'id,foto' }).catch(() => []))[0]?.foto || null : null;
      const atleta = ficha ? { ...ficha, foto: fotoDe } : ficha;
      const [checkins, pesos, molestias, notas] = await Promise.all([
        b.select('checkins', { eq: { atleta_id: atletaId }, order: [['semana_inicio', 'desc']], limit: 26 }),
        b.select('pesos', { eq: { atleta_id: atletaId }, order: [['fecha', 'asc']] }),
        b.select('molestias', { eq: { atleta_id: atletaId }, order: [['semana_inicio', 'desc']], limit: 100 }),
        b.select('notas_coach', { eq: { atleta_id: atletaId }, order: [['creado_en', 'desc']] }),
      ]);
      return { atleta, checkins, pesos, molestias, notas };
    },
    // Lo que tiene puesto este atleta (para que el coach vea de un vistazo cuánto le pide la app y lo mantenga sencillo)
    async funcionesAtleta(atletaId) {
      const [habitos, planes, preguntas, cuestionario, atleta] = await Promise.all([
        b.select('habitos', { eq: { atleta_id: atletaId, activo: true }, cols: 'id' }).catch(() => []),
        api.planesNutricion(atletaId).catch(() => []),
        api.preguntasCheckin(atletaId).catch(() => []),
        api.cuestionario(atletaId).catch(() => null),
        b.select('atletas', { eq: { id: atletaId } }).then((x) => x[0]).catch(() => null),
      ]);
      const hoy = hoyISO();
      return {
        habitos: habitos.length,
        nutricion: planVigente(planes, hoy)?.modo || null,
        conNutricion: atleta?.nutricion !== false,
        preguntas: preguntas.length,
        apartados: atleta?.checkin_apartados ?? null,
        cuestionario: cuestionario?.completado_en ? 'hecho' : cuestionario?.pedido_en ? 'pedido' : 'no',
      };
    },
    // El atleta: solo cómo va con sus pagos (v0.25, migración 021). Sin cobros apuntados (o sin la 021), null
    async miCobro() {
      const r = await b.rpc('mi_cobro', {}).catch(() => null);
      const f = Array.isArray(r) ? r[0] : r;
      if (!f || !f.estado) return null;
      const dia = (x) => (x == null ? null : typeof x === 'string' ? x.slice(0, 10) : x.toISOString?.().slice(0, 10) ?? null);
      return { pagadoHasta: dia(f.pagado_hasta), debe: Number(f.debe) || 0, debeDesde: dia(f.debe_desde), estado: f.estado };
    },
    // ------------------------------------------------------------ coach: cobros (v0.24, solo el coach)
    async cobrosAtleta(atletaId) {
      const [acuerdo, pagos] = await Promise.all([
        b.select('cobros_atletas', { eq: { atleta_id: atletaId } }).then((x) => x[0] || null),
        b.select('pagos', { eq: { atleta_id: atletaId }, order: [['periodo_desde', 'desc']] }),
      ]).catch(falta020);
      return { acuerdo, pagos };
    },
    async guardarAcuerdoCobro(atletaId, campos) {
      const fila = { atleta_id: atletaId, servicio: campos.servicio?.trim() || null, precio_mes: campos.precio_mes ?? null, ciclo: campos.ciclo || 'mensual',
        desde: campos.desde || null, nota: campos.nota?.trim() || null, actualizado_en: new Date().toISOString() };
      return (await b.upsert('cobros_atletas', [fila], 'atleta_id').catch(falta020))[0];
    },
    async guardarPago(fila) {
      const limpio = {
        atleta_id: fila.atleta_id, periodo_desde: fila.periodo_desde, periodo_hasta: fila.periodo_hasta, importe: Number(fila.importe),
        estado: fila.estado || 'pendiente', fecha_pago: fila.estado === 'pagado' ? fila.fecha_pago || hoyISO() : null,
        metodo: fila.metodo || null, nota: fila.nota?.trim() || null,
      };
      if (fila.id) return (await b.update('pagos', limpio, { eq: { id: fila.id } }).catch(falta020))[0];
      return (await b.insert('pagos', [limpio]).catch(falta020))[0];
    },
    async marcarPagado(id, { fecha_pago = hoyISO(), metodo = null } = {}) {
      return (await b.update('pagos', { estado: 'pagado', fecha_pago, ...(metodo ? { metodo } : {}) }, { eq: { id } }))[0];
    },
    async borrarPago(id) {
      return b.delete('pagos', { eq: { id } });
    },
    // Todos los atletas de un vistazo (Cuenta → Cobros): cómo va cada uno y lo cobrado este mes
    async cobrosTodos(hoy = hoyISO()) {
      const [atletas, acuerdos, pagos] = await Promise.all([
        b.select('atletas', { cols: 'id,nombre,estado', order: [['nombre', 'asc']] }),
        b.select('cobros_atletas', {}),
        b.select('pagos', {}), // pocos: todos (una deuda vieja o un pago atrasado de hace un año también cuentan)
      ]).catch(falta020);
      const A = Object.fromEntries(acuerdos.map((x) => [x.atleta_id, x]));
      const P = agrupar(pagos, 'atleta_id');
      // Los de baja, solo si aún deben algo
      const filas = atletas.filter((a) => A[a.id] || P[a.id]?.length).map((a) => ({ atleta: a, acuerdo: A[a.id] || null, ...resumenCobros(P[a.id] || [], hoy) }))
        .filter((x) => x.atleta.estado !== 'baja' || x.debe > 0);
      return { filas, cobradoMes: cobradoEnMes(pagos, hoy.slice(0, 7)), cobradoMesAnterior: cobradoEnMes(pagos, sumarMeses(`${hoy.slice(0, 7)}-01`, -1).slice(0, 7)) };
    },
    async crearNota(atletaId, texto) {
      return (await b.insert('notas_coach', [{ atleta_id: atletaId, texto }]))[0];
    },
    async borrarNota(id) {
      return b.delete('notas_coach', { eq: { id } });
    },

    // ------------------------------------------------------------ coach: bandeja de revisión
    // Lo que espera tu respuesta: sesiones hechas y check-ins sin revisar (últimas 4 semanas),
    // comentarios de atletas sin leer y vídeos sin revisar.
    async bandeja(hoy = hoyISO()) {
      const desde = sumarDias(hoy, -28);
      const [sesiones, checkins, comentarios, archivos, atletas] = await Promise.all([
        b.select('sesiones', { eq: { completada: true }, nulo: ['revisada_en'], gte: { fecha_realizada: desde }, order: [['fecha_realizada', 'desc']] }),
        b.select('checkins', { nulo: ['revisado_en'], gte: { semana_inicio: desde }, order: [['semana_inicio', 'desc']] }),
        b.select('comentarios', { eq: { autor: 'atleta' }, nulo: ['leido_en'], order: [['creado_en', 'desc']] }),
        b.select('archivos', { nulo: ['revisado_en'], neq: { tipo: 'adjunto' }, order: [['creado_en', 'desc']] }),
        api.atletas(),
      ]);
      const A = porId(atletas);
      const semanas = porId(await b.select('semanas', { in: { id: unicos(sesiones.map((s) => s.semana_id)) } }));
      const bloques = porId(await b.select('bloques', { in: { id: unicos(Object.values(semanas).map((w) => w.bloque_id)) } }));
      const pautas = await b.select('sesion_ejercicios', { in: { sesion_id: sesiones.map((s) => s.id) } });
      const series = await b.select('series', { in: { sesion_ejercicio_id: pautas.map((p) => p.id) } });
      const seriesPorPauta = agrupar(series, 'sesion_ejercicio_id');
      const pautasPorSesion = agrupar(pautas, 'sesion_id');
      const molestias = checkins.length
        ? await b.select('molestias', { in: { atleta_id: unicos(checkins.map((c) => c.atleta_id)) }, gte: { semana_inicio: desde } })
        : [];
      const sesionesAdj = porId(await b.select('sesiones', { in: { id: unicos(comentarios.map((c) => c.sesion_id)).filter((id) => !sesiones.some((s) => s.id === id)) } }));
      // Las preguntas del coach que se han respondido en esos check-ins
      const preguntas = checkins.some((c) => c.respuestas) ? porId(await b.select('preguntas_checkin', {}).catch(() => [])) : {};
      const todasSesiones = { ...porId(sesiones), ...sesionesAdj };
      const items = {
        sesiones: sesiones.map((s) => {
          const w = semanas[s.semana_id];
          const atletaId = bloques[w?.bloque_id]?.atleta_id;
          const ps = pautasPorSesion[s.id] || [];
          const hechas = ps.flatMap((p) => seriesPorPauta[p.id] || []);
          return {
            ...s, semana: w || null, atleta: A[atletaId] || null,
            series: { hechas: hechas.length, pautadas: ps.reduce((t, p) => t + p.series, 0) },
            rpeMax: Math.max(0, ...hechas.map((x) => Number(x.rpe) || 0)) || null,
            cortas: ps.filter((p) => (seriesPorPauta[p.id] || []).some((x) => p.reps_min != null && x.reps < p.reps_min)).length,
          };
        }).filter((s) => s.atleta),
        checkins: checkins.map((c) => ({ ...c, atleta: A[c.atleta_id] || null, molestias: molestias.filter((m) => m.atleta_id === c.atleta_id && m.semana_inicio === c.semana_inicio && m.intensidad > 0),
          respuestasLeidas: respuestasDe(c, preguntas) })).filter((c) => c.atleta),
        comentarios: comentarios.map((c) => ({ ...c, atleta: A[c.atleta_id] || null, sesion: c.sesion_id ? todasSesiones[c.sesion_id] || null : null })).filter((c) => c.atleta),
        archivos: archivos.map((a) => ({ ...a, atleta: A[a.atleta_id] || null })).filter((a) => a.atleta),
        recetas: [],
      };
      // Recetas que un atleta pide cambiar (v0.26; sin la migración 022, ninguna)
      const cambios = await b.select('recetas_atleta', { nonulo: ['cambio_pedido_en'], order: [['cambio_pedido_en', 'desc']] }).catch(() => []);
      if (cambios.length) {
        const R = porId(await b.select('recetas', { in: { id: unicos(cambios.map((c) => c.receta_id)) }, cols: 'id,nombre,foto_mini' }));
        items.recetas = cambios.map((c) => ({ ...c, receta: R[c.receta_id] || null, atleta: A[c.atleta_id] || null })).filter((c) => c.atleta && c.receta);
      }
      // Los mensajes cuentan por conversación (como se ven en Revisar), no uno a uno
      const hilo = (c) => c.sesion_id || c.checkin_id || c.archivo_id || `general-${c.atleta_id}`;
      const unicosHilos = [...new Map(items.comentarios.map((c) => [hilo(c), c])).values()];
      const porAtleta = {};
      for (const lista of [items.sesiones, items.checkins, unicosHilos, items.archivos, items.recetas]) for (const x of lista) porAtleta[x.atleta.id] = (porAtleta[x.atleta.id] || 0) + 1;
      return { ...items, total: items.sesiones.length + items.checkins.length + unicosHilos.length + items.archivos.length + items.recetas.length, porAtleta };
    },
    async marcarRevisado(tipo, id, revisado = true) {
      const [tabla, col] = REVISION[tipo];
      return (await b.update(tabla, { [col]: revisado ? new Date().toISOString() : null }, { eq: { id } }))[0];
    },

    // ------------------------------------------------------------ coach: programar
    async bloqueCompleto(bloqueId) {
      const [bloque] = await b.select('bloques', { eq: { id: bloqueId } });
      if (!bloque) throw new Error('No se encuentra el bloque.');
      const semanas = await b.select('semanas', { eq: { bloque_id: bloqueId }, order: [['numero', 'asc']] });
      const sesiones = await b.select('sesiones', { in: { semana_id: semanas.map((s) => s.id) }, order: [['orden', 'asc']] });
      const pautas = await b.select('sesion_ejercicios', { in: { sesion_id: sesiones.map((s) => s.id) }, order: [['orden', 'asc']] });
      const series = bloque.es_plantilla ? [] : await b.select('series', { in: { sesion_ejercicio_id: pautas.map((p) => p.id) }, order: [['numero', 'asc']] });
      return {
        bloque, semanas,
        sesiones: agrupar(sesiones, 'semana_id'),
        pautas: agrupar(pautas, 'sesion_id'),
        series: agrupar(series, 'sesion_ejercicio_id'),
      };
    },
    async bloquesDe(atletaId) {
      return b.select('bloques', { eq: { atleta_id: atletaId, es_plantilla: false }, order: [['fecha_inicio', 'desc'], ['numero', 'desc']] });
    },
    async plantillas() {
      return b.select('bloques', { eq: { es_plantilla: true }, order: [['nombre', 'asc']] });
    },
    async biblioteca() {
      return b.select('ejercicios', { order: [['nombre', 'asc']] });
    },
    async ejerciciosPorIds(ids) {
      return ids.length ? b.select('ejercicios', { in: { id: ids } }) : [];
    },
    async crear(tabla, fila) { return (await b.insert(tabla, [fila]))[0]; },
    async actualizar(tabla, id, cambios) { return (await b.update(tabla, cambios, { eq: { id } }))[0]; },
    async borrar(tabla, id) { return b.delete(tabla, { eq: { id } }); },

    // Copia una semana (sesiones y prescripción) a un bloque, con progresión opcional.
    // conNota: al copiar un bloque entero (plantillas) la nota de cada semana va con ella; al duplicar una semana, no
    // destinoId: copiar dentro de una semana que ya existe (vacía) en lugar de crear otra
    async copiarSemana(semanaId, { bloque_id, numero, fecha_inicio = null, progresion = {}, programacion = 'en_programacion', conNota = false, destinoId = null }) {
      const [origen] = await b.select('semanas', { eq: { id: semanaId } });
      let nueva;
      if (destinoId) {
        [nueva] = await b.select('semanas', { eq: { id: destinoId } });
        // Se rellena en borrador (aunque estuviera publicada vacía) y conserva su foco; si ya era de descarga, se
        // prepara como descarga
        const cambios = { ...(!nueva.foco && origen.foco ? { foco: origen.foco } : {}), ...(nueva.programacion === 'programada' ? { programacion: 'en_programacion' } : {}) };
        if (Object.keys(cambios).length) [nueva] = await b.update('semanas', cambios, { eq: { id: destinoId } });
      } else {
        [nueva] = await b.insert('semanas', [{ bloque_id, numero, foco: focoSemana(origen.foco), fecha_inicio, nota_coach: conNota ? origen.nota_coach ?? null : null, programacion }]);
      }
      const sesiones = await b.select('sesiones', { eq: { semana_id: semanaId }, order: [['orden', 'asc']] });
      const opciones = opcionesDe(progresion);
      const descarga = !!progresion.descarga || (!!destinoId && nueva.foco === 'descarga');
      if (descarga) [nueva] = await b.update('semanas', { foco: 'descarga' }, { eq: { id: nueva.id } });
      // El nombre de cada ejercicio, para el salto de carga (barra, mancuernas, máquina)
      const todas = sesiones.length ? await b.select('sesion_ejercicios', { in: { sesion_id: sesiones.map((x) => x.id) }, cols: 'ejercicio_id' }) : [];
      const ids = unicos(todas.map((x) => x.ejercicio_id));
      const nombres = ids.length ? Object.fromEntries((await b.select('ejercicios', { in: { id: ids }, cols: 'id,nombre' })).map((e) => [e.id, e.nombre])) : {};
      for (const s of sesiones) {
        const [copiaSesion] = await b.insert('sesiones', [{ semana_id: nueva.id, orden: s.orden, nombre: s.nombre, tipo: s.tipo, intencion: s.intencion, dinamica: s.dinamica, cardio: s.cardio ?? null }]);
        const pautas = await b.select('sesion_ejercicios', { eq: { sesion_id: s.id }, order: [['orden', 'asc']] });
        if (!pautas.length) continue;
        await b.insert('sesion_ejercicios', pautas.map((p) => {
          const f = progresarPauta(Object.fromEntries(CAMPOS_SE.map((c) => [c, p[c] ?? null])), opciones, { nombre: nombres[p.ejercicio_id] || '', descarga });
          f.sesion_id = copiaSesion.id;
          return f;
        }));
      }
      return nueva;
    },
    // Duplica una semana con progresión: en la siguiente si está vacía (los bloques nacen con sus semanas creadas),
    // y si no, en una semana nueva al final
    async duplicarSemana(semanaId, progresion = {}) {
      const [origen] = await b.select('semanas', { eq: { id: semanaId } });
      const hermanas = await b.select('semanas', { eq: { bloque_id: origen.bloque_id } });
      const siguiente = hermanas.find((w) => w.numero === origen.numero + 1);
      if (siguiente && !(await b.select('sesiones', { eq: { semana_id: siguiente.id }, cols: 'id', limit: 1 })).length) {
        return api.copiarSemana(semanaId, { bloque_id: origen.bloque_id, numero: siguiente.numero, progresion, destinoId: siguiente.id });
      }
      const numero = Math.max(...hermanas.map((s) => s.numero)) + 1;
      const ultima = hermanas.sort((x, y) => y.numero - x.numero)[0];
      return api.copiarSemana(semanaId, {
        bloque_id: origen.bloque_id, numero, progresion,
        fecha_inicio: ultima.fecha_inicio ? sumarDias(ultima.fecha_inicio, 7) : null,
      });
    },
    // Preparar varias semanas de un golpe (el mes): cada una sale de la anterior con su progresión, en borrador.
    // opciones: { n: 1-4, kg, rpe, rir, reps, descargaUltima }. Devuelve las semanas nuevas, en orden.
    async prepararSemanas(semanaId, { n = 1, descargaUltima = false, ...progresion } = {}) {
      const total = Math.max(1, Math.min(4, Math.round(Number(n) || 1)));
      const nuevas = [];
      let origen = semanaId;
      for (let i = 1; i <= total; i++) {
        const nueva = await api.duplicarSemana(origen, { ...progresion, descarga: descargaUltima && i === total });
        nuevas.push(nueva);
        origen = nueva.id;
      }
      return nuevas;
    },
    async publicarSemana(semanaId, publicar = true) {
      return (await b.update('semanas', { programacion: publicar ? 'programada' : 'en_programacion' }, { eq: { id: semanaId } }))[0];
    },
    // Copia un bloque entero: para un atleta (desde plantilla o bloque anterior) o como plantilla nueva.
    async copiarBloque(origenId, { atleta_id = null, fecha_inicio = null, numero = null, nombre = null }) {
      fecha_inicio = fecha_inicio ? lunesDe(fecha_inicio) : null;
      const [origen] = await b.select('bloques', { eq: { id: origenId } });
      const esPlantilla = !atleta_id;
      let n = numero;
      if (!esPlantilla && n == null) {
        const previos = await api.bloquesDe(atleta_id);
        n = Math.max(0, ...previos.map((x) => x.numero || 0)) + 1;
      }
      const [nuevo] = await b.insert('bloques', [{
        atleta_id, es_plantilla: esPlantilla, numero: esPlantilla ? null : n, nombre: nombre || origen.nombre,
        foco: origen.foco, objetivo: origen.objetivo, descripcion: origen.descripcion,
        fecha_inicio: esPlantilla ? null : fecha_inicio, estado: 'planificado',
      }]);
      const semanas = await b.select('semanas', { eq: { bloque_id: origenId }, order: [['numero', 'asc']] });
      for (const s of semanas) {
        await api.copiarSemana(s.id, {
          bloque_id: nuevo.id, numero: s.numero,
          fecha_inicio: !esPlantilla && fecha_inicio ? sumarDias(fecha_inicio, (s.numero - 1) * 7) : null,
          programacion: esPlantilla ? 'no_iniciada' : 'en_programacion',
          conNota: true,
        });
      }
      return nuevo;
    },
    // Una plantilla a varios atletas a la vez: un bloque (en borrador) para cada uno, uno detrás de otro
    async asignarPlantilla(plantillaId, atletaIds, fecha_inicio, alAvanzar = null) {
      const res = [];
      for (const atleta_id of atletaIds) {
        try { res.push({ atleta_id, ok: true, bloque: await api.copiarBloque(plantillaId, { atleta_id, fecha_inicio }) }); }
        catch (e) { res.push({ atleta_id, ok: false, error: e.message }); }
        alAvanzar?.(res.length);
      }
      return res;
    },
    async nuevoBloque(atletaId, { nombre, foco = null, objetivo = null, fecha_inicio, semanas = 4, sesionesPorSemana = 3 }) {
      fecha_inicio = fecha_inicio ? lunesDe(fecha_inicio) : null; // las semanas van de lunes a domingo
      const previos = await api.bloquesDe(atletaId);
      const numero = Math.max(0, ...previos.map((x) => x.numero || 0)) + 1;
      const [bloque] = await b.insert('bloques', [{ atleta_id: atletaId, numero, nombre, foco, objetivo, fecha_inicio, estado: 'planificado' }]);
      for (let i = 1; i <= semanas; i++) {
        const [s] = await b.insert('semanas', [{ bloque_id: bloque.id, numero: i, foco: focoSemana(foco), fecha_inicio: fecha_inicio ? sumarDias(fecha_inicio, (i - 1) * 7) : null, programacion: 'en_programacion' }]);
        if (i === 1) {
          await b.insert('sesiones', Array.from({ length: sesionesPorSemana }, (_, k) => ({ semana_id: s.id, orden: k + 1, nombre: `Día ${k + 1}` })));
        }
      }
      return bloque;
    },
    async nuevaPlantilla({ nombre, foco = null, semanas = 4, sesionesPorSemana = 3 }) {
      const [bloque] = await b.insert('bloques', [{ es_plantilla: true, atleta_id: null, nombre, foco, estado: 'planificado' }]);
      for (let i = 1; i <= semanas; i++) {
        const [s] = await b.insert('semanas', [{ bloque_id: bloque.id, numero: i, foco: focoSemana(foco), programacion: 'no_iniciada' }]);
        if (i === 1) await b.insert('sesiones', Array.from({ length: sesionesPorSemana }, (_, k) => ({ semana_id: s.id, orden: k + 1, nombre: `Día ${k + 1}` })));
      }
      return bloque;
    },
    async nuevaSemana(bloqueId) {
      const hermanas = await b.select('semanas', { eq: { bloque_id: bloqueId }, order: [['numero', 'desc']] });
      const [bloque] = await b.select('bloques', { eq: { id: bloqueId } });
      const ultima = hermanas[0];
      return (await b.insert('semanas', [{
        bloque_id: bloqueId, numero: (ultima?.numero || 0) + 1, foco: ultima?.foco ?? focoSemana(bloque.foco),
        fecha_inicio: ultima?.fecha_inicio ? sumarDias(ultima.fecha_inicio, 7) : bloque.fecha_inicio,
        programacion: bloque.es_plantilla ? 'no_iniciada' : 'en_programacion',
      }]))[0];
    },
    async nuevaSesion(semanaId) {
      const ss = await b.select('sesiones', { eq: { semana_id: semanaId }, order: [['orden', 'desc']], limit: 1 });
      const orden = (ss[0]?.orden || 0) + 1;
      return (await b.insert('sesiones', [{ semana_id: semanaId, orden, nombre: `Día ${orden}` }]))[0];
    },
    async nuevaPauta(sesionId, ejercicioId, base = {}) {
      const ps = await b.select('sesion_ejercicios', { eq: { sesion_id: sesionId }, order: [['orden', 'desc']], limit: 1 });
      return (await b.insert('sesion_ejercicios', [{
        sesion_id: sesionId, ejercicio_id: ejercicioId, orden: (ps[0]?.orden || 0) + 1,
        prioridad: 'media', series: 3, reps_min: 8, reps_max: 10, rir_objetivo: 2, descanso_seg: 120, ...base,
      }]))[0];
    },
    // Cambiar el lunes en que empieza un bloque mueve con él todas sus semanas
    async cambiarInicioBloque(bloqueId, fecha) {
      const lunes = fecha ? lunesDe(fecha) : null;
      const [bloque] = await b.update('bloques', { fecha_inicio: lunes }, { eq: { id: bloqueId } });
      if (lunes) {
        const semanas = await b.select('semanas', { eq: { bloque_id: bloqueId } });
        await Promise.all(semanas.map((w) => b.update('semanas', { fecha_inicio: sumarDias(lunes, (w.numero - 1) * 7) }, { eq: { id: w.id } })));
      }
      return bloque;
    },
    async activarBloque(bloqueId, atletaId) {
      const otros = await b.select('bloques', { eq: { atleta_id: atletaId, es_plantilla: false }, in: { estado: ['activo', 'ajustado'] } });
      for (const o of otros) if (o.id !== bloqueId) await b.update('bloques', { estado: 'finalizado' }, { eq: { id: o.id } });
      return (await b.update('bloques', { estado: 'activo' }, { eq: { id: bloqueId } }))[0];
    },
    async moverPauta(sesionId, pautaId, delta) {
      const pautas = await b.select('sesion_ejercicios', { eq: { sesion_id: sesionId }, order: [['orden', 'asc']] });
      const i = pautas.findIndex((p) => p.id === pautaId);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= pautas.length) return;
      [pautas[i], pautas[j]] = [pautas[j], pautas[i]];
      await Promise.all(pautas.map((p, k) => (p.orden !== k + 1 ? b.update('sesion_ejercicios', { orden: k + 1 }, { eq: { id: p.id } }) : null)));
    },
  };
  return api;
}
