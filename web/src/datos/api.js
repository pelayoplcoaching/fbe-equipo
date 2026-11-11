// Funciones de la app sobre cualquier backend (Supabase o demo). Toda la lógica vive aquí, una sola vez.
import { hoyISO, lunesDe, sumarDias, aISO, rangoSemana, diasEntre, fechaMadrid, instanteMadrid } from '../logica/fechas.js';
import { semanasCompletas, resumenPautas } from '../logica/diseno.js';
import { tonelajePorDia } from '../logica/destacados.js';
import { resumenAtleta, semanaActual, e1rmPorSemana, seriesPorGrupo, resumenEjercicio, seriesACsv, mejoresMarcas, vitrina, racha, mapaCalor, cargaSemanal, cambioCarga, eventosRecord, resumenSemanal, num, tendenciaPeso, ritmoPeso, limpiarDetalle, agregadosDetalle } from '../logica/calculos.js';
import { rachaMaxima, calcularLogros } from '../logica/logros.js';
import { informeBloque, cumplimiento } from '../logica/informe.js';
import { progresoObjetivo, mejorReciente } from '../logica/objetivos.js';
import { limpiarPersonal, MOMENTO_VALIDO, LIMITES, urlMusica } from '../logica/personal.js';
import { claveValida } from '../logica/musica.js';
import { URL_ATAJO, limpiarTelefono } from '../logica/integraciones.js';
import { resumenHabito, cumplimientoHabitos } from '../logica/habitos.js';
import { progresarPauta, opcionesDe } from '../logica/progresion.js';
import { resumenCobros, cobradoEnMes, sumarMeses } from '../logica/cobros.js';
import { planVigente, planSiguiente, objetivoDelDia, semanaNutricion, gastoAdaptativo, gastoPorSemanas, ajusteNutricion, avisosNutricion } from '../logica/nutricion.js';
import { conDefecto, preferenciasValidas } from '../logica/notificaciones.js';
import { chispaPeso, chispaSesiones } from '../logica/visual.js';
import { limpiarCuestionario, avisoCuestionario, SIN_SALUD } from '../logica/cuestionario.js';
import { APARTADOS_CHECKIN, preguntasDe, respuestasDe } from '../logica/preguntas.js';
import { dibujoValido } from '../logica/dibujo.js';
import { tuDia } from '../logica/dia.js';
import { cardioHechoValido, cardioValido, cardioPorSemana, textoCardioHecho, NOMBRE_MODALIDAD, CLAVES_HECHO_013, solo013 } from '../logica/cardio.js';
import { limpiarPerfil as limpiarPerfilCarrera, limpiarEvento as limpiarEventoCarrera, limpiarSemana as limpiarSemanaCarrera, limpiarRevision as limpiarRevisionCarrera, sesionDesdePlan } from '../logica/carrera.js';
import { pendiente as cuestionarioPendiente } from '../logica/cuestionario.js';
import { revisarVariante, varianteSinMaterial } from '../logica/variantes.js';
import { limpiarReceta, recetarioPorToma, tomasDe, ordenarTomas, entradaMenu, copiarMenu, cambiarRaciones } from '../logica/comidas.js';
import { VERSION_NORMAS } from './normas-comunidad.js';
import { limpiarTarea, limpiarRespuesta } from '../logica/tareas.js';
import { compararCheckins } from '../logica/comparar.js';
import { vistaBloque } from '../logica/bloque.js';
import { resumenMes, sumarMes, mesAnterior } from '../logica/mes.js';
import { panelNegocio } from '../logica/negocio.js';
import { normal as normalTexto } from '../logica/busqueda.js';
import { palabrasMovimiento } from '../logica/variantes.js';
import { esTemporal } from './cola.js';
import { medir } from '../rendimiento.js';
import { copia as copiaDelMovil } from './copia.js';
import { CLAVES_COPIA, sesionesAPreparar, sesionConCola, menuConCola, registrosHabitoConCola, pesosConCola } from '../logica/sin-red.js';
import { textoVisible } from '../logica/texto.js';
import { emojiValido } from '../logica/emojis.js';
import { VERSION_LEGAL, VERSION_LEGAL_SIN_043, VERSION_LEGAL_SIN_044, VERSION_LEGAL_SIN_045, VERSION_LEGAL_SIN_050, VERSION_LEGAL_SIN_MUSICA, VERSION_LEGAL_SIN_051, VERSION_LEGAL_SIN_053, VERSION_LEGAL_SIN_054, VERSION_LEGAL_SIN_055 } from '../legal.js';
import { limpiarMomento, pegatinaValida, hitosDe, momentoVigente, ordenarMomentos } from '../logica/celebracion.js';
import { formatoVersion, versionMayor, clavePrivacidadLocal, compararVersiones, versionSinRevision } from '../logica/privacidad.js';
import { limpiarEncuesta as limpiarEncuestaChat } from '../logica/encuestas.js';
import { tipoAudio, MAX_VOZ_BYTES, duracionGuardada, ondaValida } from '../logica/notasVoz.js';
import { limpiarNombre, recordsDeEquipo, MAX_POST, MAX_COMENTARIO, MAX_MOTIVO, MAX_MENCIONES, RETO_MAX, limpiarEncuesta, resultadosEncuesta, retoConseguido, nuevosParaBienvenida, retoMaximo, insigniasDe, MAX_FOTOS, fotosDe, busquedaValida,
  eventoValido, programadoValido, MAX_PLANTILLAS, MAX_MOTIVO_DESTACADO, palabrasDeTexto, MAX_PALABRAS } from '../logica/comunidad.js';
import { compartieronHoy } from '../logica/tablero.js';
import { semanasObjetivo, paraRacha, semanaEnCurso, diasSemanaValido, semanaDelMicrociclo } from '../logica/semana-natural.js';
import { REACCIONES_CHAT, siguienteReaccion, medioDe } from '../logica/mensajes.js';
import { planDifusion, planReenvio, nombreSeguroPdf, PDF_MAX_MB, hastaFijado, fijadoVigente, hastaSilencio, silenciado } from '../logica/chat.js';
import { textoSerieVideo, serieValida, puntuacionValida, checklistValido, limpiarChecklist, tempoValido, plantillaValida, limpiarPlantilla, estadoVideo, tecnicaPorEjercicio } from '../logica/tecnica.js';
import { analisisValido } from '../logica/analisis.js';
import { limpiarTextoRecordatorio, textoRecordatorioValido, recordatorioValido, sugerenciasRecordatorio, frasesPara, fraseValida, limpiarTextoFrase, frasesSugeridas, limpiarAutoevaluacion, autoevaluacionValida, mejorVideo, estadisticasRevision as estadisticasCola } from '../logica/correccion.js';
import { repsManualValidas } from '../logica/repeticiones.js';
import { tipoBase, tipoRespuestaValido, duracionRespuesta, MAX_BYTES_RESPUESTA, MAX_SEG_RESPUESTA } from '../logica/composicion.js';
import { dosAngulosValido, limitarDesfase, fpsGuardado } from '../logica/angulos.js';
import { umbralValido } from '../logica/cargaVelocidad.js';
import { informeMes, mesValido, textoTarjetaInforme, leerTarjetaInforme, textoMes } from '../logica/informeTecnica.js';
import { limpiarResumen, esResumenSesion, ordenEnSesion } from '../logica/sesionVideos.js';

export const VERSION_CONSENTIMIENTO = '2026-10';
// El texto que se acepta al entrar en la comunidad: como public.comunidad_version() (027; cambió en la 029, v0.47:
// racha, perfil del equipo, votos, ánimos y menciones). Si cambia, cada uno vuelve a aceptarlo.
export const VERSION_COMUNIDAD = 'comunidad-2026-11-b';
export { VERSION_NORMAS };

const porId = (filas) => Object.fromEntries(filas.map((f) => [f.id, f]));
const agrupar = (filas, col) => filas.reduce((m, f) => ((m[f[col]] ||= []).push(f), m), {});
// v0.56 (034): las notas de voz van en su propio bucket de Storage («voz»: 3 MB y solo audio); lo demás, en «archivos».
// Por su tipo si se sabe; si no, por su ruta (la de una nota de voz es siempre <atleta>/audio-…, lo pide la base)
export const cuboDe = (ruta, tipo = null) => (tipo ? (tipo === 'audio' ? 'voz' : 'archivos') : /^[^/]+\/audio-[^/]+$/.test(String(ruta || '')) ? 'voz' : 'archivos');
const porCampo = (filas, col) => Object.fromEntries(filas.map((f) => [f[col], f]));
const unicos = (xs) => [...new Set(xs.filter((x) => x != null))];
// Las menciones de una publicación o un comentario, con el nombre de quien se ve (las de quien ya no está, fuera)
const mencionadosDe = (ids, personas) => (ids || []).filter((id) => personas[id]).map((id) => ({ perfil_id: id, nombre: personas[id].nombre }));
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
// Días sin una comida (v0.27) sin la migración 023
const falta023 = (e) => {
  const m = e?.message || '';
  if (/\b(menu_dias|opcional|variante)\b/.test(m) && /schema cache|does not exist|no existe|column|columna/i.test(m)) {
    throw new Error(`Para los días sin una comida («hoy sin merienda») falta ejecutar la migración 023 en Supabase (supabase/migraciones/023_dia_sin_toma.sql). Detalle: ${m}`);
  }
  throw e;
};
const falta024 = (e) => {
  const m = e?.message || '';
  if (/series_detalle/.test(m) && /schema cache|does not exist|no existe|column|columna/i.test(m)) {
    throw new Error(`Para pautar serie a serie falta ejecutar la migración 024 en Supabase (supabase/migraciones/024_series_detalle.sql). Detalle: ${m}`);
  }
  throw e;
};
const falta026 = (e) => {
  const m = e?.message || '';
  if (/peso_frecuencia/.test(m) && /schema cache|does not exist|no existe|column|columna/i.test(m)) {
    throw new Error(`Para pedir el peso una vez a la semana falta ejecutar la migración 026 en Supabase (supabase/migraciones/026_peso_semanal.sql). Detalle: ${m}`);
  }
  throw e;
};
// Días de entreno por semana (v0.53) sin la migración 031 en la base
const falta031 = (e) => {
  const m = e?.message || '';
  if (/dias_semana/.test(m) && /schema cache|does not exist|no existe|column|columna/i.test(m)) {
    throw new Error(`Para los días de entreno por semana falta ejecutar la migración 031 en Supabase (supabase/migraciones/031_dias_semana.sql). Detalle: ${m}`);
  }
  throw e;
};
// (pulido 3) Sin la migración 048 (las listas ligeras), la app lo pide como antes: no es un error
// (pulido 4, migración 049) ¿El error es que la base aún no tiene las funciones del rendimiento?
// (050) sin la migración de la personalización, no hay nada de eso (y no se rompe nada)
const falta050 = (e) => {
  const m = `${e?.message || ''} ${e?.details || ''} ${e?.hint || ''}`;
  return /personal_(mio|guardar|atletas|musica_abierta)|mensajes?_coach|musica_(coach|para)/.test(m) && /schema cache|does not exist|no existe|function|funci\u00f3n|no disponible/i.test(m);
};
// (051) sin la migración de las integraciones, la app no ofrece nada de eso
const falta051 = (e) => {
  const m = `${e?.message || ''} ${e?.details || ''} ${e?.hint || ''}`;
  return /integraciones_mias|integracion_(crear|quitar)|calendario_opciones|salud_diaria_de|atajos?_(lista|guardar)|contactos|contacto_guardar|contacto_mio|copia_privada/.test(m) && /schema cache|does not exist|no existe|function|funci\u00f3n|no disponible/i.test(m);
};
const AVISO_051 = 'Esto aún no está disponible: falta poner al día la base (migración 051)';
// (053) sin la migración social, la app no ofrece nada de eso: el error de la base se traduce; cualquier otro, tal cual
export const AVISO_053 = 'Esto aún no está disponible: falta poner al día la base (migración 053)';
const falta053 = (e) => {
  const m = `${e?.message || ''} ${e?.details || ''} ${e?.hint || ''}`;
  if (/comunidad_(social_ajustes|cumples|duelo[a-z_]*|intencion[a-z_]*|apadrinar|padrino[a-z_]*|votar_companero|companero_semana|huella|sin_entrenar)|cita_post_id|creado_por|cumple_equipo|ver_ausencia/.test(m)
    && /schema cache|does not exist|no existe|function|funci\u00f3n|column|columna|no disponible|PGRST20/i.test(m)) {
    throw new Error(`${AVISO_053} (supabase/migraciones/053_social.sql).`);
  }
  throw e;
};
const falta049 = (e) => {
  const m = `${e?.message || ''} ${e?.details || ''} ${e?.hint || ''}`;
  return /rendimiento_(apuntar|resumen|borrar)/.test(m) && /schema cache|does not exist|no existe|function|funci\u00f3n|no disponible/i.test(m);
};
const falta048 = (e) => {
  const m = `${e?.message || ''} ${e?.details || ''} ${e?.hint || ''}`;
  return /conversaciones_resumen|ultimas_series|biblioteca_huella|historial_huella/.test(m) && /schema cache|does not exist|no existe|function|funci\u00f3n|no disponible/i.test(m);
};
// La comunidad (v0.43) sin la migración 027
const falta027 = (e) => {
  const m = e?.message || '';
  if (/comunidad_/.test(m) && /schema cache|does not exist|no existe|function|funci\u00f3n/i.test(m)) {
    throw new Error(`Para la comunidad del equipo falta ejecutar la migración 027 en Supabase (supabase/migraciones/027_comunidad.sql). Detalle: ${m}`);
  }
  throw e;
};
// Las mejoras de la comunidad (v0.47) sin la migración 029
const falta029 = (e) => {
  const m = e?.message || '';
  if (/comunidad_|menciones|encuesta|reto_id|modo/.test(m) && /schema cache|does not exist|no existe|function|funci\u00f3n|column|columna/i.test(m)) {
    throw new Error(`Para esta versión de la comunidad del equipo falta ejecutar la migración 029 en Supabase (supabase/migraciones/029_comunidad_mejoras.sql). Detalle: ${m}`);
  }
  throw e;
};
// La primera tanda de mejoras de la comunidad (v0.69) sin la migración 041
export const AVISO_041 = 'Disponible tras la migración 041';
const falta041 = (e) => {
  const m = e?.message || '';
  if (/comunidad_|responde_a|ver_entrenando/.test(m) && /schema cache|does not exist|no existe|function|funci\u00f3n|column|columna|PGRST20/i.test(m)) {
    throw new Error(`${AVISO_041} en Supabase (supabase/migraciones/041_comunidad_animo.sql).`);
  }
  throw e;
};
// La segunda tanda de mejoras de la comunidad (v0.70) sin la migración 042
export const AVISO_042 = 'Disponible tras la migración 042';
const falta042 = (e) => {
  const m = e?.message || '';
  if (/comunidad_|medida|equipos|cardio_en_retos/.test(m) && /schema cache|does not exist|no existe|function|funci\u00f3n|column|columna|PGRST20/i.test(m)) {
    throw new Error(`${AVISO_042} en Supabase (supabase/migraciones/042_comunidad_constancia.sql).`);
  }
  throw e;
};
// La tercera tanda de mejoras de la comunidad (v0.71) sin la migración 043
export const AVISO_043 = 'Disponible tras la migración 043';
const falta043 = (e) => {
  const m = e?.message || '';
  if (/comunidad_|tema|fotos|mejor_comentario/.test(m) && /schema cache|does not exist|no existe|function|funci\u00f3n|column|columna|PGRST20/i.test(m)) {
    throw new Error(`${AVISO_043} en Supabase (supabase/migraciones/043_comunidad_conversacion.sql).`);
  }
  throw e;
};
// La cuarta tanda de mejoras de la comunidad (v0.72) sin la migración 044
export const AVISO_044 = 'Disponible tras la migración 044';
const falta044 = (e) => {
  const m = e?.message || '';
  if (/comunidad_|publicar_en|retenid|silenciado_hasta/.test(m) && /schema cache|does not exist|no existe|function|funci\u00f3n|column|columna|relation|PGRST20/i.test(m)) {
    throw new Error(`${AVISO_044} en Supabase (supabase/migraciones/044_comunidad_coach.sql).`);
  }
  throw e;
};
// La quinta tanda de mejoras de la comunidad (v0.73) sin la migración 045
export const AVISO_045 = 'Disponible tras la migración 045';
const falta045 = (e) => {
  const m = e?.message || '';
  if (/comunidad_|pegatina|momento|reaccion|reacciones_validas|posts_validos/.test(m) && /schema cache|does not exist|no existe|function|funci\u00f3n|column|columna|relation|check constraint|PGRST20|23514/i.test(m)) {
    throw new Error(`${AVISO_045} en Supabase (supabase/migraciones/045_comunidad_momentos.sql).`);
  }
  throw e;
};
// Tareas, mensajes programados y el bloque entero (v0.48) sin la migración 030
const falta030 = (e) => {
  const m = e?.message || '';
  if (/\b(tareas|tareas_plantillas|tarea_completar|enviar_en|bloque_semanas|baja_en)\b/.test(m) && /schema cache|does not exist|no existe|function|funci\u00f3n|column|columna|PGRST20/i.test(m)) {
    throw new Error(`Para las tareas, los mensajes programados y el bloque entero falta ejecutar la migración 030 en Supabase (supabase/migraciones/030_tareas_y_programados.sql). Detalle: ${m}`);
  }
  throw e;
};
// ¿Un mensaje o un aviso programado que aún no ha salido?
const programado = (x) => !!x?.enviar_en && Date.parse(x.enviar_en) > Date.now();
// El chat como WhatsApp (v0.54) sin la migración 032 en la base
const falta032 = (e) => {
  const m = e?.message || '';
  if (/\b(responde_a|editado_en|eliminado_en|comentario_reacciones|comentario_destacados|conversacion_estado|presencia|presencia_marcar|comentario_eliminar|chat_buscar)\b/.test(m) && /schema cache|does not exist|no existe|function|funci\u00f3n|column|columna|PGRST20/i.test(m)) {
    throw new Error(`Para responder, reaccionar, editar o eliminar mensajes falta ejecutar la migración 032 en Supabase (supabase/migraciones/032_chat_whatsapp.sql). Detalle: ${m}`);
  }
  throw e;
};
// El chat, aún más como WhatsApp (v0.55) sin la migración 033: lo de antes sigue igual; lo nuevo lo dice
const AVISO_033 = 'Para esto falta ejecutar la migración 033 en Supabase (supabase/migraciones/033_chat_mas_whatsapp.sql)';
const falta033 = (e) => {
  const m = `${e?.message || ''} ${e?.codigo || e?.code || ''}`;
  // Solo lo que de verdad falta (una tabla, una función o una columna de la 033; o el tipo «documento», que antes de la
  // 033 no deja pasar archivos_tipo_check). Un valor rechazado (un nombre de lista vacío, uno repetido…) es otra cosa.
  const falta = /\b(cliente_id|reenviado|entregado_en|marcar_entregados|conversacion_fijado|chat_silencios|listas_difusion|listas_difusion_miembros|chat_reenviar|chat_difundir|paginas|subido_por|nombre_coach)\b/.test(m)
    && /schema cache|does not exist|no existe|could not find|PGRST20[0-9]|42P01|42883|42703/i.test(m);
  if (falta || (/\barchivos_tipo_check\b/.test(m) && /check constraint|23514/i.test(m))) {
    throw new Error(`${AVISO_033}. Detalle: ${e?.message || e}`);
  }
  throw e;
};
// v0.56 sin la migración 034: notas de voz, encuestas, «escuchado» y otras reacciones dicen qué falta
const AVISO_034 = 'Para esto falta ejecutar la migración 034 en Supabase (supabase/migraciones/034_chat_voz_y_encuestas.sql)';
const falta034 = (e) => {
  const m = `${e?.message || ''} ${e?.codigo || e?.code || ''}`;
  const falta = /\b(escuchado_en|onda|encuestas_chat|encuesta_votos|chat_encuesta|encuesta_votar|marcar_escuchado)\b/.test(m)
    && /schema cache|does not exist|no existe|could not find|PGRST20[0-9]|42P01|42883|42703/i.test(m);
  if (falta || (/\b(archivos_tipo_check|comentario_reacciones_emoji_valido)\b/.test(m) && /check constraint|23514/i.test(m))) throw new Error(`${AVISO_034}. Detalle: ${e?.message || e}`);
  throw e;
};
// (v0.56) La versión de la política vista, en este móvil (por cuenta): solo lo que falta en la base
const almacenNavegador = () => { try { return globalThis.localStorage || null; } catch { return null; } };
const leerPrivacidadLocal = (id) => { try { return almacenNavegador()?.getItem(clavePrivacidadLocal(id)) || null; } catch { return null; } };
const guardarPrivacidadLocal = (id, v) => { try { almacenNavegador()?.setItem(clavePrivacidadLocal(id), v); } catch { /* */ } };
// v0.57 sin la migración 035: los vídeos se ven y se envían como siempre; lo nuevo (la serie, repetir, la corrección, las
// listas de puntos clave, «Visto» y la limpieza) dice qué falta
export const AVISO_035 = 'Disponible tras la migración 035 (supabase/migraciones/035_videos_tecnica.sql)';
const falta035 = (e) => {
  const m = `${e?.message || ''} ${e?.codigo || e?.code || ''}`;
  if (/\b(serie_numero|repite_de|derivado_de|video_revisiones|video_correcciones|tecnica_plantillas|video_visto|videos_limpieza|videos_limpiar)\b/.test(m)
    && /schema cache|does not exist|no existe|could not find|PGRST20[0-9]|42P01|42883|42703/i.test(m)) throw new Error(`${AVISO_035}. Detalle: ${e?.message || e}`);
  throw e;
};
// v0.58 sin la migración 036: el análisis automático de un vídeo funciona igual (en el móvil del coach), pero no se guarda
export const AVISO_036 = 'Disponible tras la migración 036';
const falta036 = (e) => {
  const m = `${e?.message || ''} ${e?.codigo || e?.code || ''}`;
  if (/\banalisis\b/.test(m) && /schema cache|does not exist|no existe|could not find|PGRST20[0-9]|42P01|42883|42703/i.test(m)) throw new Error(`${AVISO_036} (supabase/migraciones/036_videos_analisis.sql). Detalle: ${e?.message || e}`);
  throw e;
};
// v0.59 sin la migración 037: los vídeos funcionan como en la v0.58; lo nuevo (recordatorios, frases, vídeos modelo, la
// valoración del atleta y las marcas de repetición guardadas) dice qué falta
export const AVISO_037 = 'Disponible tras la migración 037';
const falta037 = (e) => {
  const m = `${e?.message || ''} ${e?.codigo || e?.code || ''}`;
  if (/\b(recordatorios_tecnica|recordatorios_activos|frases_correccion|videos_modelo|videos_modelo_de|video_autoevaluacion|reps_manual)\b/.test(m)
    && /schema cache|does not exist|no existe|could not find|PGRST20[0-9]|42P01|42883|42703/i.test(m)) throw new Error(`${AVISO_037} (supabase/migraciones/037_videos_tanda_a.sql). Detalle: ${e?.message || e}`);
  throw e;
};
// v0.60 sin la migración 038: lo de antes, igual; las respuestas en vídeo del hilo, los dos ángulos (enlazarlos y su
// desfase) y el ritmo de la cámara lenta dicen qué falta. Exportar y difuminar la cara (en el móvil) no la necesitan.
export const AVISO_038 = 'Disponible tras la migración 038';
const falta038 = (e) => {
  const m = `${e?.message || ''} ${e?.codigo || e?.code || ''}`;
  if (/\b(video_respuesta_id|angulo_de|fps_captura|dos_angulos)\b/.test(m)
    && /schema cache|does not exist|no existe|could not find|PGRST20[0-9]|42P01|42883|42703/i.test(m)) throw new Error(`${AVISO_038} (supabase/migraciones/038_videos_tanda_b1.sql). Detalle: ${e?.message || e}`);
  throw e;
};
// (v0.61) La 039: la velocidad mínima de cada ejercicio (para el 1RM estimado por la velocidad)
export const AVISO_039 = 'Disponible tras la migración 039';
const falta039 = (e) => {
  const m = `${e?.message || ''} ${e?.code || ''}`;
  if (/umbral/.test(m) && /schema cache|does not exist|no existe|could not find|PGRST20[0-9]|42P01|42883|42703/i.test(m)) throw new Error(`${AVISO_039} (supabase/migraciones/039_videos_tanda_b2.sql). Detalle: ${e?.message || e}`);
  throw e;
};
const sinCliente033 = (e) => /cliente_id/.test(e?.message || '') && /schema cache|does not exist|no existe|column|columna|PGRST20/i.test(e?.message || '');
const duplicado = (e) => /duplicate|23505|Ya existe un registro igual/i.test(`${e?.codigo || e?.code || ''} ${e?.message || ''}`);
// La función de entrar sin la migración 028 (sin el parámetro de las normas)
const sinNormas = (e) => /comunidad_unirme/.test(`${e?.message || ''}`) && /p_normas|schema cache|does not exist|no existe|PGRST202/i.test(`${e?.message || ''} ${e?.code || ''}`);
// (v0.133) Lo de carrera sin la migración 055
const AVISO_055 = 'Para la carrera falta ejecutar la migración 055 en Supabase (supabase/migraciones/055_carrera.sql).';
const falta055 = (e) => {
  const m = `${e?.message || ''} ${e?.code || ''}`;
  if (/carrera/.test(m) && /schema cache|does not exist|no existe|could not find|PGRST20[0-9]|42P01|42703|column|columna/i.test(m)) throw new Error(`${AVISO_055} Detalle: ${e?.message || e}`);
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
const nuevoUuid = () => globalThis.crypto?.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16); });
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
  'rir_objetivo', 'rpe_objetivo', 'carga_sugerida_kg', 'descanso_seg', 'tempo', 'notas_coach', 'variante', 'backoff_pct', 'series_detalle'];

// La comunidad del equipo (v0.43, migración 027)
const TABLAS_COMUNIDAD = ['comunidad_ajustes', 'comunidad_miembros', 'comunidad_posts', 'comunidad_comentarios', 'comunidad_reacciones', 'comunidad_reportes', 'comunidad_retos',
  'comunidad_votos', 'comunidad_animos', 'comunidad_comentario_reacciones', 'comunidad_bienvenidas', 'comunidad_companeros', 'comunidad_reto_equipos', 'comunidad_preguntas',
  // v0.72 (044): eventos, plantillas, atleta de la semana y moderación
  'comunidad_eventos', 'comunidad_evento_asistentes', 'comunidad_plantillas', 'comunidad_destacados', 'comunidad_moderacion',
  // (social, 053): duelos, intenciones, padrinos y los votos al compañero de la semana (el coach las lee enteras)
  'comunidad_duelos', 'comunidad_intenciones', 'comunidad_padrinos', 'comunidad_votos_semana'];
// Lo que la app lee de una publicación del muro (sin la ficha ni la sesión de su autor)
const COLS_POST = 'id,autor_id,tipo,texto,foto_ruta,resumen,fijada,oculta,creado_en,menciones,encuesta,reto_id';
// Los filtros del muro (v0.47), en la propia consulta: así «Ver más» sigue funcionando
const FILTRO_MURO = { entrenos: { in: { tipo: ['entreno'] } }, logros: { in: { tipo: ['logro'] } }, avisos: { in: { tipo: ['aviso', 'encuesta'] } } };
// (v0.71, 043) Con los temas: cada publicación lleva el suyo (los logros, logros; los avisos y las encuestas, avisos)
const COLS_POST_043 = `${COLS_POST},tema,fotos,mejor_comentario`;
// (v0.72, 044) Y si está programada (publicar_en) o retenida por las palabras filtradas
const COLS_POST_044 = `${COLS_POST_043},publicar_en,retenida`;
// (053) la publicación que cita
const COLS_POST_053 = `${COLS_POST_044},cita_post_id`;
const FILTRO_MURO_043 = { entrenos: { in: { tipo: ['entreno'] } }, logros: { in: { tema: ['logros'] } }, avisos: { in: { tema: ['avisos'] } },
  tecnica: { in: { tema: ['tecnica'] } }, charla: { in: { tema: ['charla'] } }, preguntas: { in: { tema: ['pregunta'] } } };
// (v0.133, 055) lo de carrera
const TABLAS_CARRERA = ['carrera_atleta', 'carrera_eventos', 'carrera_semanas', 'carrera_revisiones', 'carrera_recetas'];
// Tablas de una copia completa (todo menos los intentos fallidos de códigos)
const TABLAS_COPIA = ['perfiles', 'atletas', 'invitaciones', 'consentimientos', 'ejercicios', 'bloques', 'semanas', 'sesiones',
  'sesion_ejercicios', 'series', 'pesos', 'checkins', 'molestias', 'notas_coach', 'medidas', 'marcas', 'objetivos',
  'archivos', 'comentarios', 'recursos', 'notas_ejercicio', 'respuestas_guardadas', 'avisos', 'habitos', 'registros_habito',
  'planes_nutricion', 'registros_nutricion', 'cuestionarios', 'preguntas_checkin', 'cobros_atletas', 'pagos',
  'recetas', 'recetas_atleta', 'comidas_atleta', 'menu_comidas', 'menu_dias', ...TABLAS_COMUNIDAD, 'tareas', 'tareas_plantillas',
  'comentario_reacciones', 'comentario_destacados', 'conversacion_estado', 'video_revisiones', 'tecnica_plantillas',
  'recordatorios_tecnica', 'frases_correccion', 'videos_modelo', 'video_autoevaluacion', 'revisiones_semanales', ...TABLAS_CARRERA];
// Las que puede no tener aún una base (cobros, 020; comidas, 022; comunidad, 027; tareas, 030; el chat, 032; los vídeos, 035; la revisión semanal, 040): sin ellas, la copia sale igual
const TABLAS_OPCIONALES = ['cobros_atletas', 'pagos', 'recetas', 'recetas_atleta', 'comidas_atleta', 'menu_comidas', 'menu_dias', ...TABLAS_COMUNIDAD, 'tareas', 'tareas_plantillas',
  'comentario_reacciones', 'comentario_destacados', 'conversacion_estado', 'video_revisiones', 'tecnica_plantillas',
  'recordatorios_tecnica', 'frases_correccion', 'videos_modelo', 'video_autoevaluacion', 'revisiones_semanales', ...TABLAS_CARRERA];
// Las recetas sin la foto grande (para las listas: la miniatura basta)
const COLS_RECETA = 'id,nombre,tomas,raciones,kcal,proteina_g,carbos_g,grasa_g,ingredientes,preparacion,minutos,etiquetas,foto_mini,creada_en,actualizada_en';
// (pulido 2.4) y sin la miniatura (unos 14 kB por receta: el 85 % de lo que pesa un recetario): las miniaturas se piden
// aparte y se recuerdan mientras la receta no cambie (recetasConMini)
const COLS_RECETA_SIN_MINI = COLS_RECETA.replace(',foto_mini', '');

// Qué columna marca la revisión del coach en cada cosa revisable
const REVISION = { sesion: ['sesiones', 'revisada_en'], checkin: ['checkins', 'revisado_en'], archivo: ['archivos', 'revisado_en'], tarea: ['tareas', 'revisada_en'] };

export const LIMITE_ARCHIVO_MB = 200;
// Foto de perfil: tamaño máximo del texto base64 (como la base, perfiles_foto_valida)
export const FOTO_MAX = 80000;
// (pulido 2.1) y la miniatura para las listas (128 px: unos 6 KB)
export const FOTO_MINI_MAX = 16000;

// Funciones de la base que solo consultan (no cambian nada): no invalidan lo que las pantallas recuerdan. Si falta
// alguna, solo pasa que esa pantalla vuelve a cargar en vez de salir al momento
const RPC_DE_CONSULTA = new Set(['mi_cobro', 'nombre_coach', 'foto_coach', 'recordatorios_activos', 'videos_modelo_de', 'video_correcciones', 'umbrales_velocidad_de',
  'storage_pendiente', 'storage_pendiente_cubos', 'chat_buscar', 'chat_privado_disponible', 'bloque_semanas', 'registrar_error', 'presencia_marcar',
  'comunidad_version', 'comunidad_nuevos', 'comunidad_companeros', 'comunidad_buscar', 'comunidad_panel', 'comunidad_personas', 'comunidad_perfil', 'comunidad_ranking',
  'comunidad_rachas', 'comunidad_insignias', 'comunidad_hitos', 'comunidad_mis_datos', 'comunidad_mes_equipo', 'comunidad_resumen_semana', 'comunidad_retos_totales',
  'comunidad_retos_progreso', 'comunidad_retos_equipos', 'comunidad_sesiones_recientes', 'comunidad_entrenando_ahora', 'comunidad_personas', 'foto_grande_de', 'conversaciones_resumen', 'ultimas_series', 'biblioteca_huella', 'historial_huella', 'rendimiento_apuntar', 'rendimiento_resumen', 'personal_mio', 'personal_atletas', 'mensajes_coach', 'musica_coach_lista', 'musica_para',
  'integraciones_mias', 'salud_diaria_de', 'atajos_lista', 'contactos',
  // (053) lo social que solo se lee
  'comunidad_cumples', 'comunidad_duelos_mios', 'comunidad_intenciones', 'comunidad_padrinos_lista', 'comunidad_companero_semana', 'comunidad_huella', 'comunidad_sin_entrenar',
  // (054) las sesiones abiertas y la semana de un vistazo solo se leen
  'sesiones_abiertas', 'atleta_resumen_semana']);
// ¿Esta llamada al backend cambia algo? Todo lo que no es leer, salvo las funciones de consulta (y el latido de
// presencia, que se manda cada minuto y no cambia nada que se enseñe; cambiar si se me ve en línea, sí cuenta)
const esEscritura = (m, a) => m !== 'rpc' || !RPC_DE_CONSULTA.has(a[0]) || (a[0] === 'presencia_marcar' && !!a[1] && Object.keys(a[1]).length > 0);

export function crearApi(backend) {
  // Cualquier escritura invalida lo que se haya guardado en memoria (el historial compartido, abajo)
  let generacion = 0;
  let personalMemo = null, mensajesMemo = null, personalAtletasMemo = null;  // (050) lo de personal_mio, mensajes_coach y personal_atletas, un minuto
  let contactosMemo = null;  // (051) los teléfonos de los atletas, un minuto
  let musicaMemo = new Map();  // (050) lo de musica_para y musica_coach_lista, un minuto
  let olvidarFotos = () => {};   // (se define más abajo, con el recuerdo de las fotos de perfil)
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
  const avisa = (m, t, c) => ((m === 'insert' || m === 'upsert') && ['comentarios', 'avisos', 'checkins', 'semanas', 'comunidad_posts', 'comunidad_comentarios', 'tareas', 'video_revisiones'].includes(t))
    || (m === 'update' && t === 'video_revisiones')
    || (m === 'rpc' && ['comunidad_reaccionar', 'comunidad_avisar_coach', 'comunidad_animar', 'tarea_completar'].includes(t))
    || (m === 'update' && ((t === 'semanas' && c?.programacion === 'programada') || (t === 'sesiones' && c?.completada === true) || (t === 'avisos' && 'texto' in (c || {}))));
  // (pulido 2.2) Lecturas idénticas, compartidas. Al abrir una pantalla, varias piezas piden lo mismo por separado (la
  // ficha del atleta, sus bloques, su plan…): una de cada tres consultas era repetida. Si se pide una lectura igual a
  // otra que está en marcha, o que acabó hace menos de COMPARTIR_MS, y entre medias no se ha escrito nada desde aquí,
  // se reutiliza su respuesta (cada uno recibe sus propias filas, copiadas). Un error no se comparte más allá de quien
  // ya lo esperaba, y nada sobrevive a una escritura ni a un cambio de cuenta.
  const COMPARTIR_MS = 2000;
  const lecturas = new Map();   // clave → { gen, p, pendiente, t }
  // (se llama al backend en el momento, no a una copia de su función: las pruebas la envuelven para contar consultas)
  // (pulido 4) Cuánto tarda la base en contestar una consulta y en guardar algo, y cuántas fallan por la conexión
  // (rendimiento.js: se resume en el dispositivo y el coach lo ve en Cuenta). Solo se mira; lo que se devuelve no cambia
  const ahoraMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const cronometrar = (nombre, r) => {
    const t0 = ahoraMs();
    Promise.resolve(r).then(() => medir(nombre, ahoraMs() - t0), (e) => { if (e?.sinConexion) medir('sin-red', ahoraMs() - t0); });
    return r;
  };
  const leer = (...a) => cronometrar('consulta', backend.select(...a));
  // Las escrituras hechas directamente con el backend (algunas pantallas lo usan sin pasar por la API) también cuentan
  // como «se ha escrito algo»: si no, una lectura compartida podría enseñar lo de antes de ese cambio
  // Tampoco sobrevive a un cambio en la sesión: entrar, salir o pasar el segundo paso cambia lo que la base deja ver
  // con la misma cuenta (un coach sin el segundo paso no ve nada; justo después de pasarlo, todo)
  try { backend.auth?.alCambiar?.(() => { generacion++; }); } catch { /* */ }
  // (pulido 2.6) Cuántas cosas se están guardando ahora mismo (escrituras, subidas de archivos, entrar o salir): se
  // avisa con «fbe-guardando» (detail: cuántas) para que el botón que se acaba de pulsar enseñe que está en ello
  // (ui/pulido.js). No cambia nada de lo que se guarda ni cuándo.
  let guardando = 0;
  const enVuelo = (r) => {
    if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') return r;
    const avisar = (d) => { guardando = Math.max(0, guardando + d); try { window.dispatchEvent(new CustomEvent('fbe-guardando', { detail: guardando })); } catch { /* */ } };
    avisar(1);
    Promise.resolve(r).then(() => avisar(-1), () => avisar(-1));
    return r;
  };
  for (const caja of [backend.auth, backend.auth?.mfa]) {
    for (const k of Object.keys(caja || {})) {
      if (typeof caja[k] !== 'function' || k === 'sesion' || k === 'alCambiar') continue;
      const directo = caja[k].bind(caja);
      caja[k] = (...a) => { const r = directo(...a); Promise.resolve(r).then(() => { generacion++; }, () => { generacion++; }); return enVuelo(r); };
    }
  }
  // Ni a nada que pida datos frescos a propósito: llega un mensaje o una notificación, se vuelve a la app, vuelve la
  // conexión o se tira para recargar. Compartir es solo para la ráfaga de consultas de abrir una pantalla
  if (typeof window !== 'undefined' && window.addEventListener) {
    const fresco = () => { generacion++; };
    for (const ev of ['fbe-mensaje', 'fbe-notificacion', 'fbe-recargar', 'fbe-copia', 'fbe-hilo', 'fbe-salida-enviado', 'online', 'focus', 'pageshow']) window.addEventListener(ev, fresco);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', fresco);
  }
  // (sql: solo lo tiene el backend de las pruebas, que escribe con él por debajo de la app)
  for (const m of ['insert', 'update', 'upsert', 'delete', 'rpc', 'sql']) {
    if (typeof backend[m] !== 'function') continue;
    const directo = backend[m].bind(backend);
    backend[m] = (...a) => {
      // (las que apuntan el propio rendimiento no se miden: cada envío dejaría algo nuevo que enviar)
      if (!esEscritura(m, a)) return m === 'rpc' && /^rendimiento_/.test(a[0]) ? directo(...a) : cronometrar('consulta', directo(...a));
      generacion++;
      const r = enVuelo(cronometrar('guardar', directo(...a)));
      // (pulido 3.4) también lo que se escribe directo en el backend (algunas pantallas lo usan así) avisa a las pantallas
      // de que lo recordado ya no vale; menos marcar como leídos los mensajes que se están viendo (pasa solo al abrir un chat)
      if (typeof window !== 'undefined' && !(m === 'update' && a[0] === 'comentarios' && Object.keys(a[1] || {}).join() === 'leido_en')) {
        const avisar = () => { try { window.dispatchEvent(new Event('fbe-escritura')); } catch { /* */ } };
        avisar();
        Promise.resolve(r).then(avisar, avisar);
      }
      return r;
    };
  }
  if (typeof backend.storage?.subir === 'function') { const subir = backend.storage.subir.bind(backend.storage); backend.storage.subir = (...a) => enVuelo(subir(...a)); }
  const copiarFilas = (r) => (Array.isArray(r) ? r.map((x) => (x && typeof x === 'object' && !Array.isArray(x) ? { ...x } : x)) : r);
  b.select = (t, f, ...resto) => {
    if (resto.length) return leer(t, f, ...resto);
    let clave;
    try { clave = `${uid() || ''}|${t}|${JSON.stringify(f || {})}`; } catch { return leer(t, f); }
    const ya = lecturas.get(clave);
    if (ya && ya.gen === generacion && (ya.pendiente || Date.now() - ya.t < COMPARTIR_MS)) return ya.p.then(copiarFilas);
    if (lecturas.size > 150) for (const [k, e] of lecturas) if (!e.pendiente && Date.now() - e.t >= COMPARTIR_MS) lecturas.delete(k);
    const e = { gen: generacion, pendiente: true, t: 0, p: null };
    let pedida;
    try { pedida = Promise.resolve(leer(t, f)); } catch (err) { pedida = Promise.reject(err); }
    e.p = pedida.then((r) => { e.pendiente = false; e.t = Date.now(); return r; }, (err) => { if (lecturas.get(clave) === e) lecturas.delete(clave); throw err; });
    lecturas.set(clave, e);
    return e.p.then(copiarFilas);
  };
  for (const m of ['insert', 'update', 'upsert', 'delete', 'rpc']) {
    const f = (...a) => backend[m](...a);   // (ya cuenta la escritura, arriba)
    b[m] = (...a) => {
      const r = f(...a);
      if (avisa(m, a[0], a[1])) Promise.resolve(r).then(() => empujar(), () => {});
      // (pulido 4) Lo que las pantallas recuerdan para enseñarlo al volver (useCarga, «recuerdo») deja de valer en
      // cuanto se escribe algo desde aquí: lo que acabas de cambiar nunca se enseña como estaba antes. Se avisa al
      // pedirlo y al acabar (por lo que se estuviera cargando mientras). Las funciones que solo consultan no cuentan
      // (pulido 2.1) un perfil que cambia, o quién está dentro del equipo: las fotos recordadas dejan de valer
      if (a[0] === 'perfiles' || (m === 'rpc' && /^comunidad_(unirme|salir|expulsar|ajustar)$/.test(a[0]))) Promise.resolve(r).then(() => olvidarFotos(), () => olvidarFotos());
      // (ni marcar como leídos los mensajes que se están viendo: pasa solo al abrir un chat)
      const soloLeido = m === 'update' && a[0] === 'comentarios' && Object.keys(a[1] || {}).join() === 'leido_en';
      if (typeof window !== 'undefined' && !soloLeido && esEscritura(m, a)) {
        const avisar = () => { try { window.dispatchEvent(new Event('fbe-escritura')); } catch { /* */ } };
        avisar();
        Promise.resolve(r).then(avisar, avisar);
      }
      // Las pantallas que resumen varias cosas («Tu día») se ponen al día tras cualquier escritura
      // (pulido 3.4: las funciones que solo consultan no avisan; antes, cada una hacía recargar «Tu día», las tareas y
      // la insignia de mensajes sin que hubiera cambiado nada)
      if (typeof window !== 'undefined' && esEscritura(m, a)) Promise.resolve(r).then(() => window.dispatchEvent(new Event('fbe-cambio')), () => {});
      return r;
    };
  }
  // (pulido 3, migración 048) ¿Están las funciones de las listas ligeras? Se sabe al primer intento (null: aún no)
  let con048 = null;
  let con049 = null;   // (pulido 4) lo mismo para las funciones del rendimiento
  const CLAVE_HISTORIAL = (atletaId) => `historial:${atletaId}`;
  const historialesGuardados = new Map();   // «cuenta:atleta» → { corte, huella, filas } (los últimos que se han visto)
  // De quién hay historial guardado en este dispositivo: una nota a mano (localStorage) para no abrir la base del
  // navegador cuando no hay nada que leer (la primera vez, eso solo retrasaría lo que se va a pedir de todos modos)
  const NOTA_HISTORIAL = 'fbe-historial-hay', NOTA_BIBLIOTECA = 'fbe-biblioteca-hay';
  const notaHistorial = () => { try { const x = JSON.parse(localStorage.getItem(NOTA_HISTORIAL) || '[]'); return Array.isArray(x) ? x : []; } catch { return []; } };
  const apuntarHistorial = (k) => { try { localStorage.setItem(NOTA_HISTORIAL, JSON.stringify([k, ...notaHistorial().filter((x) => x !== k)].slice(0, 80))); } catch { /* sin almacenamiento */ } };
  const guardandoHistorial = new Map();   // «cuenta:atleta» → lo que se está guardando (para no pedir entero dos veces seguidas)
  const CLAVE_BIBLIOTECA = 'biblioteca';
  let bibliotecaGuardada = null;   // { de: cuenta, huella, filas }
  async function ultimasSeries(ids) {
    if (con048 !== false) {
      try { const r = await b.rpc('ultimas_series', { p_atletas: ids }); con048 = true; return (r || []).map((x) => [x]); } catch (e) { if (!falta048(e)) throw e; con048 = false; }
    }
    return Promise.all(ids.map((id) => b.select('series', { eq: { atleta_id: id }, order: [['registrada_en', 'desc']], limit: 1, cols: 'atleta_id,registrada_en' })));
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

  // v0.53: su objetivo de días de entreno por semana (migración 031), o null (automático: cada semana del programa).
  // Se lee la ficha entera: sin la 031 en la base no hay columna y vale null (todo como antes)
  async function diasSemanaDe(atletaId) {
    const [a] = await b.select('atletas', { eq: { id: atletaId }, limit: 1 }).catch(() => []);
    return diasSemanaValido(a?.dias_semana);
  }

  // v0.53: para el panel, lo semanal de los atletas con objetivo de días por semana: { [atleta_id]: { diasSemana, actual,
  // chispa (6 semanas), cumplimiento (4 últimas acabadas) } }. Solo consulta las sesiones de esos atletas.
  async function semanasNaturalesPanel(atletas, { todosBloques, todasSemanas, hoy }) {
    const conObjetivo = atletas.filter((a) => diasSemanaValido(a.dias_semana));
    if (!conObjetivo.length) return {};
    const ids = new Set(conObjetivo.map((a) => a.id));
    const bloques = todosBloques.filter((x) => ids.has(x.atleta_id));
    const cuentan = semanasQueCuentan(todasSemanas.filter((w) => bloques.some((x) => x.id === w.bloque_id)), bloques);
    const sesiones = cuentan.length ? await b.select('sesiones', { in: { semana_id: cuentan.map((w) => w.id) }, cols: 'id,semana_id,completada,fecha_realizada,orden' }) : [];
    const blo = porId(bloques), semPorId = porId(cuentan);
    const lunesHoy = lunesDe(hoy), desde4 = sumarDias(lunesHoy, -28);
    const out = {};
    const tocaban = {};
    for (const a of conObjetivo) {
      const misSemanas = cuentan.filter((w) => blo[w.bloque_id]?.atleta_id === a.id);
      const mias = new Set(misSemanas.map((w) => w.id));
      const misSesiones = sesiones.filter((x) => mias.has(x.semana_id));
      const diasSemana = diasSemanaValido(a.dias_semana);
      const lista = semanasObjetivo({ diasSemana, sesiones: misSesiones, semanas: misSemanas, hoy });
      const de = (l) => lista.find((x) => x.lunes === l) || null;
      const chispa = Array.from({ length: 6 }, (_, i) => {
        const l = sumarDias(lunesHoy, -7 * (5 - i));
        const w = de(l);
        return { lunes: l, hechas: w ? w.hechas : 0, total: w ? w.objetivo : 0 };
      });
      const cuatro = lista.filter((x) => x.lunes >= desde4 && x.lunes < lunesHoy);
      const faltan = cuatro.reduce((t, x) => t + Math.max(0, x.objetivo - x.hechas), 0);
      const orden = (x) => { const w = semPorId[x.semana_id]; return [blo[w.bloque_id]?.fecha_inicio || '', String(w.numero ?? 0).padStart(4, '0'), String(x.orden ?? 0).padStart(4, '0')].join('|'); };
      const hechas4 = misSesiones.filter((x) => x.completada && x.fecha_realizada >= desde4 && x.fecha_realizada < lunesHoy);
      const siguientes = misSesiones.filter((x) => !x.completada).sort((x, y) => (orden(x) < orden(y) ? -1 : 1)).slice(0, faltan);
      tocaban[a.id] = [...hechas4, ...siguientes].map((x) => ({ ...x, semana_lunes: sumarDias(lunesHoy, -7) }));
      const sesH = cuatro.reduce((t, x) => t + Math.min(x.hechas, x.objetivo), 0), sesT = cuatro.reduce((t, x) => t + x.objetivo, 0);
      out[a.id] = { diasSemana, actual: semanaEnCurso(lista, hoy), chispa, sesiones4: { hechas: sesH, total: sesT, pct: sesT ? Math.round((sesH / sesT) * 100) : null } };
    }
    const todas = Object.values(tocaban).flat();
    const pautas = todas.length ? await b.select('sesion_ejercicios', { in: { sesion_id: todas.map((x) => x.id) }, cols: 'id,sesion_id,series,rpe_objetivo,rir_objetivo' }) : [];
    const series = pautas.length ? await b.select('series', { in: { sesion_ejercicio_id: pautas.map((x) => x.id) }, cols: 'sesion_ejercicio_id,reps,rpe,rir', limit: 20000 }) : [];
    for (const a of conObjetivo) {
      const ses = tocaban[a.id];
      const o = out[a.id];
      if (!ses.length) { o.cumplimiento = null; continue; }
      const idsS = new Set(ses.map((x) => x.id));
      const p = pautas.filter((x) => idsS.has(x.sesion_id));
      const idsP = new Set(p.map((x) => x.id));
      const c = cumplimiento({ sesiones: ses, pautas: p, series: series.filter((x) => idsP.has(x.sesion_ejercicio_id)) }, hoy);
      o.cumplimiento = { ...c, sesiones: o.sesiones4 };
    }
    return out;
  }

  // (pulido 2.1) Las fotos de perfil van dentro de la fila del perfil y viajaban enteras en cada lista (29 fotos, 1,6 MB
  // cada vez). Ahora se piden una vez y se recuerdan un rato en memoria: las de los atletas del coach, la del coach para
  // sus atletas y las de la gente del equipo. Se olvidan al cambiar de cuenta y al cambiar cualquier perfil desde aquí.
  // (Con la migración 047, además, lo que viaja en «foto» es una miniatura y la grande se pide solo al ampliarla.)
  const FOTOS_VALEN = 10 * 60 * 1000;
  const sinFotos = () => ({ de: uid(), mapa: new Map(), cuando: new Map(), gordas: new Set(), coach: undefined, coachT: 0, personas: null, personasT: 0, fuera: new Set(), grandes: new Map() });
  let fotos = null;
  const misFotos = () => { if (!fotos || fotos.de !== uid()) fotos = sinFotos(); return fotos; };
  olvidarFotos = () => { fotos = null; };
  // Una foto «gorda» es la de siempre (384 px) aún en «foto»: pendiente de aligerar
  const FOTO_GORDA = 20000;
  async function fotosDePerfiles(ids) {
    const f = misFotos(), ahora = Date.now();
    const faltan = ids.filter((id) => !(ahora - (f.cuando.get(id) || 0) < FOTOS_VALEN));
    if (faltan.length) {
      const filas = await b.select('perfiles', { in: { id: faltan }, cols: 'id,foto' }).catch(() => null);
      // (si la consulta falla no se apunta nada: se vuelve a pedir la próxima vez)
      if (filas && fotos === f) {
        const P = porId(filas);
        for (const id of faltan) {
          const foto = P[id]?.foto || null;
          f.mapa.set(id, foto); f.cuando.set(id, ahora);
          if (foto && foto.length > FOTO_GORDA) f.gordas.add(id); else f.gordas.delete(id);
        }
      } else if (filas) return new Map(filas.map((x) => [x.id, x.foto || null]));
    }
    return f.mapa;
  }
  // (pulido 2.4) Las recetas de una lista, con su miniatura. La miniatura de cada receta se pide una vez y se recuerda
  // en memoria mientras la receta no cambie (su «actualizada_en»): un recetario de 80 recetas pesaba 1,4 MB cada vez
  // que se abría Comidas (y Hoy lo pedía en cada visita); ahora, la primera vez de la sesión.
  // Además se guardan en el dispositivo (con la copia de la semana: por cuenta, se borra al cerrar la sesión), para que
  // tampoco haya que bajarlas la primera vez que se abre Comidas cada día.
  const minis = new Map();   // id de receta → { v: actualizada_en, foto_mini }
  let minisDe = null, minisLeidas = null;
  const CLAVE_MINIS = 'minis-recetas';
  const traerMinis = () => {
    const yo = uid();
    if (minisDe !== yo) { minis.clear(); minisDe = yo; minisLeidas = null; }
    return (minisLeidas ||= (async () => {
      try {
        const x = yo ? await copiaDelMovil().leer(yo, CLAVE_MINIS) : null;
        if (minisDe === yo && Array.isArray(x?.datos)) for (const [id, m] of x.datos) if (!minis.has(id) && m && typeof m === 'object') minis.set(id, m);
      } catch { /* sin copia, se piden */ }
    })());
  };
  async function recetasConMini(filtro) {
    const [filas] = await Promise.all([b.select('recetas', { ...filtro, cols: COLS_RECETA_SIN_MINI }), traerMinis()]);
    const alDia = (r) => { const m = minis.get(r.id); return !!m && m.v === (r.actualizada_en || null); };
    const faltan = filas.filter((r) => !alDia(r)).map((r) => r.id);
    if (faltan.length) {
      const fotos = await b.select('recetas', { in: { id: faltan }, cols: 'id,foto_mini' }).catch(() => null);
      if (fotos) {
        const F = porId(fotos);
        if (minis.size > 900) for (const k of [...minis.keys()].slice(0, 300)) minis.delete(k);
        for (const r of filas) if (!alDia(r)) minis.set(r.id, { v: r.actualizada_en || null, foto_mini: F[r.id]?.foto_mini || null });
        const yo = uid();
        if (yo && minisDe === yo) copiaDelMovil().guardar(yo, CLAVE_MINIS, [...minis]).catch(() => {});
      }
    }
    return filas.map((r) => ({ ...r, foto_mini: alDia(r) ? minis.get(r.id).foto_mini : null }));
  }
  const fotoValida = (x, max) => typeof x === 'string' && x.length <= max && /^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(x);
  const falta047 = (e) => /foto_grande/.test(`${e?.message || ''} ${e?.details || ''} ${e?.hint || ''}`);

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
    async cambiarFoto(foto, mini = null) {
      if (foto != null && (typeof foto !== 'string' || foto.length > FOTO_MAX || !/^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(foto))) {
        throw new Error('La foto no es válida. Prueba con otra (JPEG o PNG).');
      }
      // (pulido 2.1, migración 047) con miniatura: en «foto» va la miniatura y la de siempre pasa a «foto_grande». Sin la
      // 047 (o sin miniatura), como antes: la de siempre en «foto»
      if (foto && mini != null && !fotoValida(mini, FOTO_MINI_MAX)) throw new Error('La foto no es válida. Prueba con otra (JPEG o PNG).');
      const como047 = foto ? (mini ? { foto: mini, foto_grande: foto } : null) : { foto: null, foto_grande: null };
      if (como047) {
        try { return (await b.update('perfiles', como047, { eq: { id: uid() } }))[0] || null; } catch (e) { if (!falta047(e)) throw e; }
      }
      return (await b.update('perfiles', { foto: foto || null }, { eq: { id: uid() } }))[0] || null;
    },
    // La foto de alguien en grande (al ampliarla). Sin perfilId, la del coach. Sin la 047, null (se enseña la que hay)
    async fotoGrande(perfilId = null) {
      const f = misFotos(), clave = perfilId || 'coach';
      if (f.grandes.has(clave)) return f.grandes.get(clave);
      const g = (await b.rpc('foto_grande_de', perfilId ? { p_perfil: perfilId } : {}).catch(() => null)) || null;
      if (fotos === f && g) f.grandes.set(clave, g);
      return g;
    },
    // Los perfiles cuya «foto» aún es la de siempre (sin aligerar): el coach, los de todos; un atleta, el suyo. Sin la
    // 047, null (no hay dónde guardar la grande: no se toca nada)
    async fotosPorAligerar() {
      const filas = await b.select('perfiles', { nulo: ['foto_grande'], nonulo: ['foto'], cols: 'id,foto' }).catch(() => null);
      if (!filas) return null;
      // (y las que una versión antigua de la app haya vuelto a guardar enteras: se ven al pedir las de la lista)
      const f = misFotos();
      const mas = [...f.gordas].filter((id) => !filas.some((x) => x.id === id) && f.mapa.get(id)).map((id) => ({ id, foto: f.mapa.get(id) }));
      return [...filas, ...mas].filter((x) => fotoValida(x.foto, FOTO_MAX));
    },
    async guardarFotoLigera(perfilId, mini, grande) {
      if (!fotoValida(mini, FOTO_MINI_MAX) || !fotoValida(grande, FOTO_MAX)) throw new Error('La foto no es válida.');
      // (revisión de la 047) en la base, solo si la foto sigue siendo la que se leyó (si la quitó o la cambió, nada)
      if (b.modo === 'demo') return (await b.update('perfiles', { foto: mini, foto_grande: grande }, { eq: { id: perfilId } }))[0] || null;
      return b.rpc('aligerar_foto', { p_perfil: perfilId, p_mini: mini, p_grande: grande });
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
    // (pulido 4) Cómo va la app en cada dispositivo (rendimiento.js): el resumen del día de este dispositivo, a la base.
    // Devuelve si se guardó. Sin la migración 049 no se guarda nada (y no se vuelve a intentar hasta abrir la app otra vez)
    async apuntarRendimiento({ dia, dispositivo, version = '', entorno = {}, datos = {} }) {
      if (!uid() || con049 === false) return false;
      try {
        await b.rpc('rendimiento_apuntar', { p_dispositivo: dispositivo, p_dia: dia, p_version: version, p_entorno: entorno, p_datos: datos });
        con049 = true;
        return true;
      } catch (e) { if (falta049(e)) con049 = false; return false; }
    },
    // Lo de todos los dispositivos en los últimos días (solo el coach), sin nombres: una fila por dispositivo y día.
    // null si falta la migración 049
    async rendimientoEquipo(dias = 14) {
      try { return (await b.rpc('rendimiento_resumen', { p_dias: dias })) || []; } catch (e) { if (falta049(e)) return null; throw e; }
    },
    async borrarRendimiento() { return b.rpc('rendimiento_borrar'); },
    // ------------------------------------------------------------ personalización (v0.104, migración 050)
    // Lo que el atleta elige (apodo, porqué, sus tres ejercicios, su música y su cumpleaños): null si no hay nada;
    // undefined sin la 050 (así «Lo tuyo» no sale). Se recuerda un minuto por cuenta (lo piden la bienvenida, la portada y Progreso).
    async personal() {
      const k = uid();
      if (personalMemo && personalMemo.k === k && Date.now() - personalMemo.t < 60000) return personalMemo.p;
      const p = b.rpc('personal_mio', {}).then((r) => r || null).catch((e) => { if (falta050(e)) return undefined; throw e; });
      personalMemo = { k, t: Date.now(), p };
      p.catch(() => { if (personalMemo?.p === p) personalMemo = null; });
      return p;
    },
    async guardarPersonal(datos) {
      const limpio = limpiarPersonal(datos);
      try {
        const r = await b.rpc('personal_guardar', { p_datos: limpio });
        personalMemo = { k: uid(), t: Date.now(), p: Promise.resolve(r || null) };
        return r || null;
      } catch (e) { if (falta050(e)) throw new Error('Esto aún no está disponible: tu coach tiene que poner al día la app'); throw e; }
    },
    // Lo de cada atleta, para el coach ([{ atleta_id, apodo, porque, favoritos, musica_url, cumple_mes, cumple_dia }])
    async personalAtletas() {
      // (se recuerda un minuto, como los mensajes del coach: la lista de Atletas lo pide cada vez que se vuelve a ella)
      const k = uid();
      if (personalAtletasMemo && personalAtletasMemo.k === k && Date.now() - personalAtletasMemo.t < 60000) return personalAtletasMemo.p;
      const p = b.rpc('personal_atletas', {}).then((r) => r || []).catch((e) => { if (falta050(e)) return []; throw e; });
      personalAtletasMemo = { k, t: Date.now(), p };
      p.catch(() => { if (personalAtletasMemo?.p === p) personalAtletasMemo = null; });
      return p;
    },
    // Los mensajes del coach para cada momento ([{ momento, texto }]); se recuerdan un minuto
    async mensajesCoach() {
      const k = uid();
      if (mensajesMemo && mensajesMemo.k === k && Date.now() - mensajesMemo.t < 60000) return mensajesMemo.p;
      const p = b.rpc('mensajes_coach', {}).then((r) => (Array.isArray(r) ? r : [])).catch((e) => { if (falta050(e)) return []; throw e; });
      mensajesMemo = { k, t: Date.now(), p };
      p.catch(() => { if (mensajesMemo?.p === p) mensajesMemo = null; });
      return p;
    },
    async guardarMensajeCoach(momento, texto) {
      if (!MOMENTO_VALIDO.has(momento)) throw new Error('Momento no válido');
      const t = String(texto ?? '').trim();
      if (t.length > LIMITES.mensaje) throw new Error(`Como mucho ${LIMITES.mensaje} caracteres`);
      try { await b.rpc('mensaje_coach_guardar', { p_momento: momento, p_texto: t }); } catch (e) { if (falta050(e)) throw new Error('Esto aún no está disponible: falta poner al día la base (migración 050)'); throw e; }
      mensajesMemo = null;
    },
    // La música (050): cada vez que abre su música desde una sesión suma una al mes (para «Tu mes» y «Tu año»)
    async musicaAbierta() {
      try { await b.rpc('personal_musica_abierta', {}); personalMemo = null; } catch { /* sin la 050 o sin conexión: no se cuenta */ }
    },
    // Lo que el coach enlazó para esa sesión: lo general y lo de esa sesión y ese bloque ({ clave: url }; sin la 050, {})
    async musicaPara(sesionId = null, bloqueId = null) {
      const k = `${uid()}:${sesionId || ''}:${bloqueId || ''}`;
      const ya = musicaMemo.get(k);
      if (ya && Date.now() - ya.t < 60000) return ya.p;
      const p = b.rpc('musica_para', { p_sesion: sesionId || null, p_bloque: bloqueId || null }).then((r) => (r && typeof r === 'object' ? r : {})).catch((e) => { if (falta050(e)) return {}; throw e; });
      musicaMemo.set(k, { t: Date.now(), p });
      p.catch(() => musicaMemo.delete(k));
      return p;
    },
    // Todo lo enlazado (solo el coach); sin la 050, null
    async musicaCoach() {
      const k = `${uid()}:lista`;
      const ya = musicaMemo.get(k);
      if (ya && Date.now() - ya.t < 60000) return ya.p;
      const p = b.rpc('musica_coach_lista', {}).then((r) => (r && typeof r === 'object' ? r : {})).catch((e) => { if (falta050(e)) return null; throw e; });
      musicaMemo.set(k, { t: Date.now(), p });
      p.catch(() => musicaMemo.delete(k));
      return p;
    },
    async guardarMusicaCoach(clave, url) {
      if (!claveValida(clave)) throw new Error('No se puede enlazar ahí');
      const u = String(url ?? '').trim();
      if (u && !urlMusica(u)) throw new Error('Tiene que ser un enlace de Spotify, Apple Music, YouTube Music, Amazon Music, Deezer o Tidal');
      try { await b.rpc('musica_coach_guardar', { p_clave: clave, p_url: u ? urlMusica(u) : '' }); } catch (e) { if (falta050(e)) throw new Error('Esto aún no está disponible: falta poner al día la base (migración 050)'); throw e; }
      musicaMemo = new Map();
    },
    // ------------------------------------------------------------ la parte social del equipo (tanda «social», migración 053)
    // ¿Está la 053? true / false / null (no se sabe: un corte). Como comunidad041
    async comunidad053() {
      if (!api._v053) {
        const pr = (async () => {
          try { await b.rpc('comunidad_companero_semana', {}); return true; } catch (e) {
            const m = `${e?.message || ''} ${e?.code || ''}`;
            if (/comunidad_companero_semana|schema cache|does not exist|no existe|could not find|PGRST20[0-9]|42883/i.test(m)) return false;
            return null;
          }
        })();
        api._v053 = pr;
        pr.then((x) => { if (x == null && api._v053 === pr) api._v053 = null; });
      }
      return api._v053;
    },
    // Mis ajustes sociales: { cumple, ausencia } → { cumple_equipo, ver_ausencia }
    async ajustesSociales({ cumple = null, ausencia = null } = {}) {
      return b.rpc('comunidad_social_ajustes', { p_cumple: cumple, p_ausencia: ausencia }).catch(falta053);
    },
    // Los cumpleaños de hoy en el equipo (de quien lo enciende). [] sin la 053
    async cumplesComunidad() {
      return (await b.rpc('comunidad_cumples', {}).catch(() => [])) || [];
    },
    // Quién ha dicho cuándo entrena (hoy y mañana); [] sin la 053
    async intencionesComunidad() {
      return ((await b.rpc('comunidad_intenciones', {}).catch(() => [])) || []).map((x) => ({ ...x, hora: x.hora ? String(x.hora).slice(0, 5) : null }));
    },
    // «Hoy entreno a las…»: { fecha, hora, nota } (null: quitarlo)
    async decirIntencion(i) {
      if (!i) { await b.rpc('comunidad_intencion', { p_fecha: null, p_hora: null, p_nota: null }).catch(falta053); return null; }
      const r = await b.rpc('comunidad_intencion', { p_fecha: i.fecha, p_hora: i.hora || null, p_nota: String(i.nota || '').trim() || null }).catch(falta053);
      return r ? { ...r, hora: r.hora ? String(r.hora).slice(0, 5) : null } : null;
    },
    // Los duelos: míos (o todos, el coach)
    async duelosMios(todos = false) {
      return (await b.rpc('comunidad_duelos_mios', { p_todos: !!todos }).catch(() => [])) || [];
    },
    async proponerDuelo(perfilId, proxima = false) { return b.rpc('comunidad_duelo_proponer', { p_para: perfilId, p_proxima: !!proxima }).catch(falta053); },
    async responderDuelo(id, acepta) { return b.rpc('comunidad_duelo_responder', { p_id: id, p_acepta: !!acepta }).catch(falta053); },
    async retirarDuelo(id) { return b.rpc('comunidad_duelo_retirar', { p_id: id }).catch(falta053); },
    // Los padrinos: { puedo, vigentes: [...], sin_padrino: [...] } (null sin la 053)
    async padrinosComunidad() {
      return (await b.rpc('comunidad_padrinos_lista', {}).catch(() => null)) || null;
    },
    async apadrinar(perfilId) { return b.rpc('comunidad_apadrinar', { p_nuevo: perfilId }).catch(falta053); },
    async quitarPadrino(perfilId = null) { return b.rpc('comunidad_padrino_quitar', { p_nuevo: perfilId }).catch(falta053); },
    // El compañero de la semana: { semana, elegidos, mi_voto, votos, mis_veces } (null sin la 053)
    async companeroSemana() {
      return (await b.rpc('comunidad_companero_semana', {}).catch(() => null)) || null;
    },
    async votarCompanero(perfilId) { return b.rpc('comunidad_votar_companero', { p_para: perfilId }).catch(falta053); },
    // La huella en el equipo (la mía o la de alguien de dentro); null sin la 053
    async huellaComunidad(perfilId = null) {
      return (await b.rpc('comunidad_huella', perfilId ? { p_perfil: perfilId } : {}).catch(() => null)) || null;
    },
    // Quién lleva 5 días o más sin entrenar (de quien lo enciende); [] sin la 053
    async sinEntrenarComunidad() {
      return (await b.rpc('comunidad_sin_entrenar', {}).catch(() => [])) || [];
    },
    // Las fotos del muro para el álbum (hasta 300 publicaciones con foto, las más recientes); [] si no se ve
    async fotosAlbum() {
      const con043 = (await api.comunidad043()) === true;
      const filas = await b.select('comunidad_posts', { neq: { tipo: 'momento' }, order: [['creado_en', 'desc']], limit: 300, cols: con043 ? 'id,autor_id,tipo,creado_en,foto_ruta,fotos' : 'id,autor_id,tipo,creado_en,foto_ruta' }).catch(() => []);
      const conFoto = filas.filter((x) => x.foto_ruta || (Array.isArray(x.fotos) && x.fotos.length));
      if (!conFoto.length) return [];
      const personas = await api.personasComunidad();
      return conFoto.map((x) => ({ ...x, autor: personas[x.autor_id] || { nombre: 'Alguien del equipo' }, fotos: fotosDe(x) }));
    },

    // ------------------------------------------------------------ la carrera (v0.133, migración 055)
    // ¿Está la 055? true / false / null (no se sabe). Sonda: carrera_recetas (el atleta la lee vacía, sin error)
    async carrera055() {
      if (!api._v055) {
        const pr = b.select('carrera_recetas', { cols: 'id', limit: 1 }).then(() => true).catch((e) => {
          const m = `${e?.message || ''} ${e?.code || ''}`;
          return /carrera_recetas|schema cache|does not exist|no existe|could not find|PGRST20[0-9]|42P01/i.test(m) ? false : null;
        });
        api._v055 = pr;
        pr.then((x) => { if (x == null && api._v055 === pr) api._v055 = null; });
      }
      return api._v055;
    },
    // Todo lo de carrera de un atleta: su perfil (zonas y plan), sus carreras, las semanas del plan y las revisiones
    async carrera(atletaId) {
      if ((await api.carrera055().catch(() => null)) === false) return { falta055: true, perfil: null, eventos: [], semanas: [], revisiones: [] };
      const [perfil, eventos, semanas, revisiones] = await Promise.all([
        b.select('carrera_atleta', { eq: { atleta_id: atletaId } }).then((x) => x[0] || null),
        b.select('carrera_eventos', { eq: { atleta_id: atletaId }, order: [['fecha', 'asc']] }),
        b.select('carrera_semanas', { eq: { atleta_id: atletaId }, order: [['lunes', 'asc']] }),
        b.select('carrera_revisiones', { eq: { atleta_id: atletaId }, order: [['fecha', 'asc']] }),
      ]).catch(falta055);
      // Lo hecho de carrera desde que empezó el plan (o las 12 últimas semanas): para los km de cada semana y su registro
      const hoy = hoyISO();
      const desde = [perfil?.plan_inicio, semanas[0]?.lunes, sumarDias(lunesDe(hoy), -7 * 11)].filter(Boolean).sort()[0];
      let hechas = [];
      try {
        const bloques = await b.select('bloques', { eq: { atleta_id: atletaId, es_plantilla: false }, cols: 'id' });
        const ws = bloques.length ? await b.select('semanas', { in: { bloque_id: bloques.map((x) => x.id) }, cols: 'id' }) : [];
        hechas = ws.length ? (await b.select('sesiones', { in: { semana_id: ws.map((x) => x.id) }, eq: { completada: true }, gte: { fecha_realizada: desde },
          cols: 'id,nombre,tipo,fecha_realizada,completada,cardio,cardio_hecho,rpe_sesion,nota_atleta' }))
          .filter((x) => cardioHechoValido(x.cardio_hecho) && x.cardio_hecho.modalidad === 'carrera')
          .sort((x, y) => (x.fecha_realizada < y.fecha_realizada ? 1 : -1)) : [];
      } catch { hechas = []; }
      return { perfil, eventos, semanas, revisiones, hechas };
    },
    async guardarCarreraPerfil(atletaId, datos) {
      const { perfil, error } = limpiarPerfilCarrera(datos);
      if (error) throw new Error(error);
      return (await b.upsert('carrera_atleta', [{ ...perfil, atleta_id: atletaId }], 'atleta_id').catch(falta055))[0];
    },
    async guardarCarreraEvento(atletaId, datos, id = null) {
      const { evento, error } = limpiarEventoCarrera(datos);
      if (error) throw new Error(error);
      if (id) return (await b.update('carrera_eventos', evento, { eq: { id } }).catch(falta055))[0];
      return (await b.insert('carrera_eventos', [{ ...evento, atleta_id: atletaId }]).catch(falta055))[0];
    },
    async borrarCarreraEvento(id) { return b.delete('carrera_eventos', { eq: { id } }).catch(falta055); },
    async guardarCarreraSemana(atletaId, datos) {
      const { semana, error } = limpiarSemanaCarrera(datos);
      if (error) throw new Error(error);
      return (await b.upsert('carrera_semanas', [{ ...semana, atleta_id: atletaId }], 'atleta_id,lunes').catch(falta055))[0];
    },
    async borrarCarreraSemana(atletaId, lunes) { return b.delete('carrera_semanas', { eq: { atleta_id: atletaId, lunes } }).catch(falta055); },
    async guardarCarreraRevision(atletaId, datos, id = null) {
      const { revision, error } = limpiarRevisionCarrera(datos);
      if (error) throw new Error(error);
      if (id) return (await b.update('carrera_revisiones', revision, { eq: { id } }).catch(falta055))[0];
      return (await b.insert('carrera_revisiones', [{ ...revision, atleta_id: atletaId }]).catch(falta055))[0];
    },
    async borrarCarreraRevision(id) { return b.delete('carrera_revisiones', { eq: { id } }).catch(falta055); },
    // La biblioteca de sesiones de calidad del coach
    async carreraRecetas() { return b.select('carrera_recetas', { order: [['orden', 'asc'], ['nombre', 'asc']] }).catch(falta055); },
    async guardarCarreraReceta({ nombre, pauta }, id = null) {
      const n = String(nombre ?? '').trim().slice(0, 80);
      if (!n) throw new Error('Ponle nombre a la sesión de la biblioteca.');
      if (!pauta || !cardioValido(pauta) || !Array.isArray(pauta.partes) || !pauta.partes.length) throw new Error('Para guardarla en la biblioteca, la sesión necesita sus partes.');
      try {
        if (id) return (await b.update('carrera_recetas', { nombre: n, pauta }, { eq: { id } }))[0];
        const ult = await b.select('carrera_recetas', { cols: 'orden', order: [['orden', 'desc']], limit: 1 });
        return (await b.insert('carrera_recetas', [{ nombre: n, pauta, orden: (ult[0]?.orden || 0) + 1 }]))[0];
      } catch (e) {
        if (duplicado(e)) throw new Error(`Ya tienes en la biblioteca una sesión que se llama «${n}». Cámbiale el nombre.`);
        return falta055(e);
      }
    },
    async borrarCarreraReceta(id) { return b.delete('carrera_recetas', { eq: { id } }).catch(falta055); },
    // Pasa a una semana de entreno las sesiones de carrera previstas en el plan para ese lunes (las de descanso, no).
    // Devuelve cuántas ha añadido. Las que ya estén (mismo nombre y de cardio) no se repiten.
    async anadirCarreraASemana(semanaId, items = []) {
      const [semana] = await b.select('semanas', { eq: { id: semanaId } });
      if (!semana) throw new Error('No encuentro esa semana.');
      const ya = await b.select('sesiones', { eq: { semana_id: semanaId }, order: [['orden', 'desc']] });
      let orden = ya[0]?.orden || 0;
      const lunes = semana.fecha_inicio ? lunesDe(semana.fecha_inicio) : null;
      const nombres = new Set(ya.filter((x) => x.tipo === 'cardio').map((x) => x.nombre));
      const filas = [];
      for (const it of items) {
        const s = sesionDesdePlan(it);
        if (!s || nombres.has(s.nombre)) continue;
        nombres.add(s.nombre);
        orden++;
        filas.push({ semana_id: semanaId, orden, nombre: s.nombre, tipo: 'cardio', cardio: s.cardio, ...(s.dinamica ? { dinamica: s.dinamica } : {}),
          ...(lunes && s.dia ? { dia_previsto: sumarDias(lunes, s.dia - 1) } : {}) });
      }
      if (filas.length) await b.insert('sesiones', filas).catch(falta055);
      return filas.length;
    },

    // ------------------------------------------------------------ el cierre de la sesión y lo que el coach necesita (tanda «cierre», migración 054)
    // ¿Está la 054? true / false / null (no se sabe). Sonda: sesiones_abiertas (devuelve una lista, vacía si no hay)
    async cierre054() {
      if (!api._v054) {
        const pr = (async () => {
          try { await b.rpc('sesiones_abiertas', {}); return true; } catch (e) {
            const m = `${e?.message || ''} ${e?.code || ''}`;
            if (/sesiones_abiertas|schema cache|does not exist|no existe|could not find|PGRST20[0-9]|42883/i.test(m)) return false;
            return null;
          }
        })();
        api._v054 = pr;
        pr.then((x) => { if (x == null && api._v054 === pr) api._v054 = null; });
      }
      return api._v054;
    },
    // Las sesiones con series y sin terminar (últimos 14 días): el coach, de todos o de uno; el atleta, las suyas. [] sin la 054
    async sesionesAbiertas(atletaId = null) {
      return (await b.rpc('sesiones_abiertas', atletaId ? { p_atleta: atletaId } : {}).catch(() => [])) || [];
    },
    // La semana de un atleta de un vistazo (atleta_resumen_semana); null sin la 054 o sin permiso
    async resumenSemanaAtleta(atletaId, lunes = null) {
      if (!atletaId) return null;
      return (await b.rpc('atleta_resumen_semana', { p_atleta: atletaId, ...(lunes ? { p_lunes: lunes } : {}) }).catch(() => null)) || null;
    },
    // El atleta activa un hábito sugerido (de logica/cierre.js: HABITOS_SUGERIDOS)
    async activarHabitoSugerido(h) {
      const r = await b.rpc('habito_sugerido_activar', { p_nombre: h.nombre, p_tipo: h.tipo, p_objetivo: h.objetivo ?? null, p_unidad: h.unidad ?? null, p_sentido: h.sentido || 'al_menos', p_dias: h.dias || 7, p_icono: h.icono || 'libre' })
        .catch((e) => { if (/habito_sugerido_activar|schema cache|does not exist|could not find/i.test(`${e?.message || ''}`)) throw new Error('Para activar hábitos sugeridos falta poner al día la base (migración 054).'); throw e; });
      return r;
    },
    // El coach marca si el objetivo del bloque se consiguió (null: sin decidir)
    async objetivoLogrado(bloqueId, valor) {
      return (await b.update('bloques', { objetivo_logrado: valor }, { eq: { id: bloqueId } }).catch((e) => { if (/objetivo_logrado/.test(`${e?.message || ''}`)) throw new Error('Falta poner al día la base (migración 054).'); throw e; }))[0];
    },
    // El esfuerzo de la sesión en un toque (sin terminarla): como marcarSesion, por la cola
    async esfuerzoSesion(sesionId, rpe) {
      return api.marcarSesion(sesionId, { rpe_sesion: rpe == null ? null : Number(rpe) });
    },

    // ------------------------------------------------------------ integraciones (v0.105, migración 051)
    // La dirección de la función «integraciones» (la de Supabase, o integracionesUrl en config.js); en la demo, null
    urlIntegraciones() {
      if (b.modo === 'demo' || typeof window === 'undefined') return null;
      const c = window.FBE_CONFIG || {};
      return c.integracionesUrl || c.supabaseUrl || null;
    },
    // Qué tiene conectado el atleta ({ salud, calendario, atajos }); sin la 051, undefined
    async integraciones() {
      try { return (await b.rpc('integraciones_mias', {})) || null; } catch (e) { if (falta051(e)) return undefined; throw e; }
    },
    // Crea su enlace personal (el anterior deja de valer) y lo devuelve una sola vez
    async crearIntegracion(tipo, opciones = null) {
      if (!['salud', 'calendario'].includes(tipo)) throw new Error('Tipo no válido');
      try { return await b.rpc('integracion_crear', { p_tipo: tipo, p_opciones: opciones }); } catch (e) { if (falta051(e)) throw new Error(AVISO_051); throw e; }
    },
    async opcionesCalendario(opciones) {
      try { return await b.rpc('calendario_opciones', { p_opciones: opciones }); } catch (e) { if (falta051(e)) throw new Error(AVISO_051); throw e; }
    },
    async quitarIntegracion(tipo, borrar = false) {
      try { await b.rpc('integracion_quitar', { p_tipo: tipo, p_borrar: !!borrar }); } catch (e) { if (falta051(e)) throw new Error(AVISO_051); throw e; }
    },
    // Lo que llegó de Salud ({ conectada, ultimo, dias: [{ fecha, pasos, sueno_min, fc_reposo, hrv, peso_kg }] }); sin la 051, null
    async saludDiaria(atletaId, desde = null, hasta = null) {
      if (!atletaId) return null;
      try { return (await b.rpc('salud_diaria_de', { p_atleta: atletaId, p_desde: desde, p_hasta: hasta })) || null; } catch (e) { if (falta051(e)) return null; throw e; }
    },
    // Los atajos del coach ({ salud, entreno }: enlaces de iCloud); sin la 051, null
    async atajos() {
      try { return (await b.rpc('atajos_lista', {})) || {}; } catch (e) { if (falta051(e)) return null; throw e; }
    },
    async guardarAtajo(clave, url) {
      const u = String(url ?? '').trim();
      if (u && !URL_ATAJO.test(u)) throw new Error('Tiene que ser el enlace de iCloud del atajo (https://www.icloud.com/shortcuts/…)');
      try { await b.rpc('atajo_guardar', { p_clave: clave, p_url: u }); } catch (e) { if (falta051(e)) throw new Error(AVISO_051); throw e; }
    },
    // El teléfono de cada atleta ({ atleta_id: teléfono }), solo el coach; sin la 051, null
    // (se recuerdan un minuto, como los cumpleaños: la lista de Atletas y «A quién escribir» los piden cada vez)
    async contactos() {
      const k = uid();
      if (contactosMemo && contactosMemo.k === k && Date.now() - contactosMemo.t < 60000) return contactosMemo.p;
      const p = b.rpc('contactos', {}).then((r) => r || {}).catch((e) => { if (falta051(e)) return null; throw e; });
      contactosMemo = { k, t: Date.now(), p };
      p.catch(() => { if (contactosMemo?.p === p) contactosMemo = null; });
      return p;
    },
    async guardarContacto(atletaId, telefono) {
      const t = limpiarTelefono(telefono);
      try { await b.rpc('contacto_guardar', { p_atleta: atletaId, p_telefono: t }); } catch (e) { if (falta051(e)) throw new Error(AVISO_051); throw e; }
      contactosMemo = null;
    },
    // La foto del coach, para el chat del atleta (la base solo deja ver eso del perfil del coach)
    // v0.55: el nombre corto del coach («Info del contacto» del atleta); sin la 033, null
    async nombreCoach() {
      return (await b.rpc('nombre_coach', {}).catch(() => null)) || null;
    },
    async fotoCoach() {
      const f = misFotos();
      if (f.coach !== undefined && Date.now() - f.coachT < FOTOS_VALEN) return f.coach;
      const foto = await b.rpc('foto_coach', {}).then((x) => x || null, () => undefined);
      if (foto === undefined) return null;   // (no se ha podido pedir: no se recuerda)
      if (fotos === f) { f.coach = foto; f.coachT = Date.now(); }
      return foto;
    },
    async miAtleta() {
      const id = uid();
      if (!id) return null;
      return (await b.select('atletas', { eq: { perfil_id: id }, limit: 1 }))[0] || null;
    },
    // Modo atleta del coach (v0.37): su propia ficha de atleta, vinculada a su cuenta (como la de un atleta a la suya),
    // para programarse y entrenar con la app sin otra cuenta. Solo entrenamiento.
    async crearAtletaPropio() {
      const ya = await api.miAtleta();
      if (ya) return ya;
      const yo = await api.perfil();
      if (yo?.rol !== 'coach') throw new Error('Solo el coach tiene modo atleta');
      const fila = { nombre: yo.nombre || 'Yo', perfil_id: yo.id, estado: 'activo', nutricion: false };
      const creada = (await b.insert('atletas', [fila]).catch(falta018).catch(falta022))[0];
      // Sus datos son suyos: al crearla deja constancia de sus consentimientos (sin ellos, la base no guarda
      // cómo llega a cada sesión: sueño, energía y molestias)
      const tiene = new Set((await api.consentimientos()).filter((c) => !c.revocado_en).map((c) => c.tipo));
      const faltan = ['privacidad', 'datos_salud'].filter((t) => !tiene.has(t));
      if (faltan.length) await api.darConsentimientos(faltan);
      return creada;
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
      const r = await b.insert('consentimientos', tipos.map((tipo) => ({ perfil_id: uid(), tipo, version: VERSION_CONSENTIMIENTO })));
      // (v0.56) quien acepta la política ahora la acepta en su versión actual: no le sale el aviso de novedades
      if (tipos.includes('privacidad')) await api.marcarPrivacidadVista(await api.versionLegal());
      return r;
    },
    // (v0.56) El aviso de privacidad, una vez por versión: cuál ha visto esta cuenta. En la base (034, la misma en todos
    // sus móviles); antes de la 034 o sin conexión, lo de este móvil. Si este móvil sabe de una más nueva que la base
    // (se vio sin la 034 o sin red), se le pasa a la base sin decir nada.
    // (v0.59) La versión de la política vigente para esta base: la de legal.js (2026-12.1) si la base tiene la 037 (que admite
    // revisiones, «AAAA-MM.n»); sin la 037 (la app se publica antes de que Pelayo la ejecute) o si no se sabe, la del mes
    // (2026-12), exactamente como antes: así la base no rechaza lo visto y el aviso no vuelve a salir en cada visita.
    // (v0.71) La 2026-12.10 (revisión de dos cifras) solo con la 043; con la 037 pero sin la 043 (o si no se sabe), la 2026-12.9,
    // la más nueva que admite esa base
    // (v0.72) La 2026-12.11 solo con la 044 (lo que describe: eventos, programados, el panel, el atleta de la semana y la
    // moderación); con la 043 pero sin la 044, la 2026-12.10
    async versionLegal() {
      if (versionSinRevision(VERSION_LEGAL) === VERSION_LEGAL) return VERSION_LEGAL;
      if ((await api.video037().catch(() => null)) !== true) return versionSinRevision(VERSION_LEGAL);
      if ((await api.comunidad043().catch(() => null)) !== true) return VERSION_LEGAL_SIN_043;
      if ((await api.comunidad044().catch(() => null)) !== true) return VERSION_LEGAL_SIN_044;
      // (v0.73) la 2026-12.12 solo con la 045 (los aniversarios, el mes en el equipo, los hitos, las reacciones y pegatinas y
      // los momentos de 24 horas); con la 044 pero sin la 045, la 2026-12.11
      // (v0.95) con la 045, la 2026-12.13 (cómo va la app: se mide en el móvil aunque falte la 049, que solo hace falta para mandarlo)
      if ((await api.comunidad045().catch(() => null)) !== true) return VERSION_LEGAL_SIN_045;
      // (v0.104) la 2026-12.14 solo con la 050 (lo que eliges para tu app); con la 045 pero sin la 050, la 2026-12.13
      if ((await api.personal050().catch(() => null)) !== true) return VERSION_LEGAL_SIN_050;
      // (v0.107) la 2026-12.15 solo con la 050 ampliada (tu música); con la de la v0.104, la 2026-12.14
      if ((await api.musica050().catch(() => null)) !== true) return VERSION_LEGAL_SIN_MUSICA;
      // (v0.110) la 2026-12.16 solo con la 051 (Salud del iPhone, calendario y WhatsApp); sin ella, la 2026-12.15
      if ((await api.integraciones051().catch(() => null)) !== true) return VERSION_LEGAL_SIN_051;
      // (v0.117) la 2026-12.17 solo con la 053 (lo social del equipo); con la 051 pero sin la 053, la 2026-12.16
      if ((await api.comunidad053().catch(() => null)) !== true) return VERSION_LEGAL_SIN_053;
      // (054) el cierre de las sesiones
      if ((await api.cierre054().catch(() => null)) !== true) return VERSION_LEGAL_SIN_054;
      // (v0.133) la carrera
      return (await api.carrera055().catch(() => null)) === true ? VERSION_LEGAL : VERSION_LEGAL_SIN_055;
    },
    // (v0.110) ¿Está la 051? integraciones_mias() la puede llamar cualquiera con sesión (sin ficha de atleta, null)
    async integraciones051() {
      if (!api._v051) {
        const pr = b.rpc('integraciones_mias', {}).then(() => true).catch((e) => (falta051(e) ? false : null));
        api._v051 = pr;
        pr.then((x) => { if (x == null && api._v051 === pr) api._v051 = null; });
      }
      return api._v051;
    },
    // (v0.107) ¿Está la 050 ampliada (la música)? musica_para() la puede llamar cualquiera con sesión
    async musica050() {
      if (!api._vMusica) {
        const pr = b.rpc('musica_para', { p_sesion: null, p_bloque: null }).then(() => true).catch((e) => (falta050(e) ? false : null));
        api._vMusica = pr;
        pr.then((x) => { if (x == null && api._vMusica === pr) api._vMusica = null; });
      }
      return api._vMusica;
    },
    // (v0.104) ¿Está la 050? true / false / null (no se sabe: un corte). mensajes_coach() la puede llamar cualquiera con sesión
    async personal050() {
      if (!api._v050) {
        const pr = b.rpc('mensajes_coach', {}).then(() => true).catch((e) => (falta050(e) ? false : null));
        api._v050 = pr;
        pr.then((x) => { if (x == null && api._v050 === pr) api._v050 = null; });
      }
      return api._v050;
    },
    async privacidadVista() {
      const id = uid();
      if (!id) return { version: null, enBase: false };
      const local = leerPrivacidadLocal(id);
      const filas = await b.select('privacidad_vista', { eq: { usuario_id: id }, cols: 'version', limit: 1 }).catch(() => null);
      const enBase = filas ? filas[0]?.version || null : null;
      if (filas && formatoVersion(local) && (!enBase || compararVersiones(local, enBase) > 0)) {
        // (lo de este móvil, a la base; sin la 037, sin su revisión, que la base no la admite)
        // (y nunca una más nueva que la que admite esta base: sin la 043, como mucho la 2026-12.9)
        const admitida = await api.versionLegal();
        const subir = versionSinRevision(admitida) === admitida ? versionSinRevision(local) : versionMayor(local, admitida) === local ? admitida : local;
        if (!enBase || compararVersiones(subir, enBase) > 0) api.marcarPrivacidadVista(subir).catch(() => {});
      }
      return { version: versionMayor(enBase, local), enBase: !!filas };
    },
    async marcarPrivacidadVista(version) {
      const id = uid();
      if (version === undefined) version = await api.versionLegal();
      if (!id || !formatoVersion(version)) return false;
      // (en este móvil, solo versiones que la app conoce: nunca una «del futuro» que tape los avisos que vengan)
      if (compararVersiones(version, VERSION_LEGAL) <= 0) guardarPrivacidadLocal(id, version);
      try { await b.upsert('privacidad_vista', [{ usuario_id: id, version }], 'usuario_id'); return true; } catch { return false; }
    },
    // El coach, en la ficha: qué versión ha visto ese atleta (null: ninguna o sin la 034)
    async privacidadVistaDe(perfilId) {
      if (!perfilId) return null;
      return (await b.select('privacidad_vista', { eq: { usuario_id: perfilId }, cols: 'version,vista_en', limit: 1 }).catch(() => []))[0] || null;
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
    // v0.39 (migración 025): el aviso al móvil del fin del descanso, por si la app no está delante cuando acaba.
    // Nunca falla hacia fuera (sin la 025, en la demo o sin conexión, simplemente no hay aviso).
    async programarDescanso(fin, despues = '') {
      try { return await b.rpc('programar_descanso', { p_fin: new Date(fin).toISOString(), p_despues: String(despues || '').slice(0, 150) || null }); } catch { return null; }
    },
    async cancelarDescanso() {
      try { await b.rpc('cancelar_descanso', {}); } catch { /* sin aviso que anular */ }
    },
    async ultimasNotificaciones(n = 10) {
      return b.select('notificaciones', { eq: { usuario_id: uid() }, cols: 'id,tipo,titulo,cuerpo,creado_en,enviar_desde,estado,canal,enviada_en,error', order: [['creado_en', 'desc']], limit: n });
    },

    // ------------------------------------------------------------ atleta: programa
    // Bloque actual con sus semanas visibles y sus sesiones. soloProgramadas=false para el coach.
    // v0.53: a quien va por microciclos (objetivo de días por semana), la semana «actual» es la del microciclo que le toca
    // (la primera publicada con algo pendiente, aunque por fechas ya hubiera pasado): sigue el orden del programa
    async programa(atletaId, { soloProgramadas = true, bloqueId = null } = {}) {
      const [bloques, diasSemana] = await Promise.all([
        b.select('bloques', { eq: { atleta_id: atletaId, es_plantilla: false }, order: [['fecha_inicio', 'desc'], ['numero', 'desc']] }),
        diasSemanaDe(atletaId),
      ]);
      const bloque = bloqueId ? bloques.find((x) => x.id === bloqueId) : bloqueActual(bloques) || bloques[0] || null;
      if (!bloque) return { bloques, bloque: null, semanas: [], sesiones: {}, actual: null, diasSemana };
      const filtroSemanas = { eq: { bloque_id: bloque.id }, order: [['numero', 'asc']] };
      if (soloProgramadas) filtroSemanas.eq.programacion = 'programada';
      const semanas = await b.select('semanas', filtroSemanas);
      const sesiones = agrupar(await b.select('sesiones', { in: { semana_id: semanas.map((s) => s.id) }, order: [['orden', 'asc']] }), 'semana_id');
      const porFecha = semanaActual(semanas);
      const actual = diasSemana ? semanaDelMicrociclo(semanas.filter((w) => w.programacion === 'programada'), sesiones, porFecha) : porFecha;
      return { bloques, bloque, semanas, sesiones, actual, diasSemana };
    },

    // v0.50: las cifras de la cabecera del perfil, sin el historial de entrenamientos entero: cuántas sesiones ha
    // terminado (solo sus identificadores) y cuántos récords ha batido (los mismos de la vitrina, de su historial)
    async cuantasSesionesHechas(atletaId) {
      const bloques = await b.select('bloques', { eq: { atleta_id: atletaId, es_plantilla: false }, cols: 'id' });
      const semanas = bloques.length ? await b.select('semanas', { in: { bloque_id: bloques.map((x) => x.id) }, cols: 'id' }) : [];
      if (!semanas.length) return 0;
      return (await b.select('sesiones', { in: { semana_id: semanas.map((x) => x.id) }, eq: { completada: true }, cols: 'id' })).length;
    },
    async cuantosRecords(atletaId) {
      return eventosRecord(await api.historial(atletaId)).eventos.length;
    },
    // v0.50: lo que trae cada sesión de una semana (para sus tarjetas en Semana): cuántos ejercicios y series, los
    // minutos estimados y los músculos que más trabaja. Solo lee la pauta y los grupos de cada ejercicio.
    async pautasSemana(sesionIds = []) {
      const ids = unicos(sesionIds || []);
      if (!ids.length) return {};
      const pautas = await b.select('sesion_ejercicios', { in: { sesion_id: ids }, order: [['orden', 'asc']], cols: 'id,sesion_id,ejercicio_id,orden,series,descanso_seg,superserie' });
      const ejercicios = pautas.length ? porId(await b.select('ejercicios', { in: { id: unicos(pautas.map((x) => x.ejercicio_id)) }, cols: 'id,nombre,grupos_musculares' })) : {};
      const porSesion = agrupar(pautas.map((x) => ({ ...x, ejercicio: ejercicios[x.ejercicio_id] || null })), 'sesion_id');
      return Object.fromEntries(ids.map((id) => [id, resumenPautas(porSesion[id] || [])]));
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
      const [ultimas, notas, coach] = await Promise.all([
        api.ultimasPorEjercicio(atletaId, unicos([...pautados.map((p) => p.ejercicio_id), ...extraIds]), sesionId),
        api.notasEjercicio(atletaId),
        // v0.48: lo que le dijo el coach de cada ejercicio en vídeos y sesiones anteriores (si falla, la sesión sigue)
        api.dichoPorCoach(atletaId, unicos([...pautados.map((p) => p.ejercicio_id), ...extraIds]), sesionId, todos).catch(() => ({})),
      ]);
      return {
        notas,
        coach,
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
    // hasta (ISO, opcional): solo series registradas antes (el editor del coach mira «la última vez» antes de una semana)
    async ultimasPorEjercicio(atletaId, ejercicioIds, excluirSesionId, hasta = null) {
      if (!ejercicioIds.length) return {};
      const res = {};
      // excluirSesionId: una sesión o varias (el editor del coach quita las de la semana que está mirando)
      const fuera = new Set([].concat(excluirSesionId || []));
      const tope = hasta ? new Date(hasta) : null; // «hasta» sin zona = hora local (lunes a las 0:00 en España)
      const repasar = (series, pautas) => {
        for (const s of series) {
          const p = pautas[s.sesion_ejercicio_id];
          if (!p || fuera.has(p.sesion_id) || (tope && new Date(s.registrada_en) >= tope)) continue;
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
      // (v0.133) Sin la 055, lo hecho de cardio solo con lo que entiende la 013 (modalidad, minutos y km)
      if (limpio.cardio_hecho && Object.keys(limpio.cardio_hecho).some((k) => !CLAVES_HECHO_013.includes(k)) && (await api.carrera055().catch(() => null)) === false) {
        limpio.cardio_hecho = solo013(limpio.cardio_hecho, CLAVES_HECHO_013);
      }
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
        recetasConMini({ order: [['nombre', 'asc']] }).catch(falta022),
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
      const recetas = asignaciones.length ? await recetasConMini({ in: { id: unicos(asignaciones.map((a) => a.receta_id)) } }) : [];
      const tomas = tomasDe(comidas[0]);
      const porToma = recetarioPorToma(asignaciones, recetas);
      // Tomas con recetas que no están entre sus comidas (p. ej. le asignaste una merienda y él quitó la merienda)
      const conRecetas = ordenarTomas(Object.keys(porToma));
      // La comida que algunos días no hace (v0.27), si sigue entre sus comidas
      const opcional = comidas[0]?.opcional && tomas.includes(comidas[0].opcional) && tomas.length >= 2 ? comidas[0].opcional : null;
      return { tomas, opcional, eligio: !!comidas[0], conRecetas, porToma, asignaciones, recetas, cambios: asignaciones.filter((a) => a.cambio_pedido_en).length };
    },
    // (pulido 2.4) Lo que «Tu menú de hoy» necesita del recetario, sin bajarlo: qué comidas hace y si tiene recetas
    async recetarioDeHoy(atletaId) {
      const [asignaciones, comidas] = await Promise.all([
        b.select('recetas_atleta', { eq: { atleta_id: atletaId }, cols: 'id,receta_id,toma' }).catch(falta022),
        b.select('comidas_atleta', { eq: { atleta_id: atletaId } }).catch(() => []),
      ]);
      return { tomas: tomasDe(comidas[0]), asignaciones };
    },
    // Cuántas comidas hace al día (las elige el atleta o el coach). opcional (solo el coach; undefined = no se
    // toca): la que algunos días no hace
    async guardarComidas(atletaId, tomas, opcional) {
      const xs = ordenarTomas(tomas);
      if (!xs.length) throw new Error('Elige al menos una comida.');
      const fila = { atleta_id: atletaId, tomas: xs };
      if (opcional !== undefined) fila.opcional = opcional && xs.includes(opcional) && xs.length >= 2 ? opcional : null;
      return (await b.upsert('comidas_atleta', [fila], 'atleta_id').catch(falta022).catch(falta023))[0];
    },
    // Coach: poner una receta en su recetario (en una o varias tomas). Si ya la tiene en esa toma, se deja como
    // está (su factor y tu nota no se pierden: se cambian desde la asignación)
    async asignarReceta(atletaId, recetaId, tomas, { factor = 1, nota = null, variante = null } = {}) {
      const lista = Array.isArray(tomas) ? tomas : [tomas];
      if (!lista.length) throw new Error('Elige en qué comida va.');
      // (para el mismo tipo de día: con días sin una comida, puede estar una vez para cada tipo)
      const ya = new Set((await b.select('recetas_atleta', { eq: { atleta_id: atletaId, receta_id: recetaId } }).catch(falta022))
        .filter((x) => (x.variante || null) === (variante || null)).map((x) => x.toma));
      const filas = lista.filter((toma) => !ya.has(toma)).map((toma) => ({ atleta_id: atletaId, receta_id: recetaId, toma, factor: Number(factor) || 1, nota: nota?.trim() || null,
        ...(variante ? { variante } : {}) }));
      if (!filas.length) return [];
      return b.insert('recetas_atleta', filas).catch(falta022).catch(falta023);
    },
    async cambiarAsignacion(id, cambios) {
      const c = {};
      for (const k of ['factor', 'nota', 'orden', 'toma', 'variante']) if (k in cambios) c[k] = cambios[k] === '' ? null : cambios[k];
      if ('nota' in c && typeof c.nota === 'string') c.nota = c.nota.trim() || null;
      return (await b.update('recetas_atleta', c, { eq: { id } }).catch(falta023))[0];
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
    // Los días de una semana en que no hace su comida opcional (v0.27): ['2026-11-03', …]. Sin la 023, ninguno
    async diasSin(atletaId, lunes) {
      return (await b.select('menu_dias', { eq: { atleta_id: atletaId }, gte: { fecha: lunes }, lte: { fecha: sumarDias(lunes, 6) }, cols: 'fecha' })
        .catch((e) => { if (/menu_dias/.test(e?.message || '') && /schema cache|does not exist|no existe/i.test(e?.message || '')) return []; throw e; })).map((x) => x.fecha);
    },
    async marcarDiaSin(atletaId, fecha, sin) {
      // (insert y no upsert: el atleta no tiene permiso de cambiar filas, solo de crearlas y borrarlas)
      if (sin) return (await b.insert('menu_dias', [{ atleta_id: atletaId, fecha }]).catch((e) => { if (/duplicate|23505|ya existe/i.test(`${e?.message} ${e?.code}`)) return [{ atleta_id: atletaId, fecha }]; return falta023(e); }))[0];
      return b.delete('menu_dias', { eq: { atleta_id: atletaId, fecha } });
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
      // Y los días sin su comida opcional, igual
      const [sinO, sinD] = await Promise.all([api.diasSin(atletaId, lunesOrigen), api.diasSin(atletaId, lunesDestino)]);
      const dias = sinO.map((f) => sumarDias(lunesDestino, diasEntre(lunesOrigen, f))).filter((f) => !sinD.includes(f));
      for (const fecha of dias) await api.marcarDiaSin(atletaId, fecha, true); // uno a uno: si alguno ya estaba, los demás se copian igual
      if (!filas.length) return [];
      return b.insert('menu_comidas', filas);
    },
    // Vaciar una semana del menú
    async vaciarMenuSemana(atletaId, lunes) {
      await b.delete('menu_dias', { eq: { atleta_id: atletaId }, gte: { fecha: lunes }, lte: { fecha: sumarDias(lunes, 6) } })
        .catch((e) => { if (!(/menu_dias/.test(e?.message || '') && /schema cache|does not exist|no existe/i.test(e?.message || ''))) throw e; });
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
      const [molestias, pesos, medidas, atleta, preguntas, anterior] = await Promise.all([
        b.select('molestias', { eq: { atleta_id: atletaId, semana_inicio: lunes } }),
        b.select('pesos', { eq: { atleta_id: atletaId }, order: [['fecha', 'desc']], limit: 2 }),
        b.select('medidas', { eq: { atleta_id: atletaId }, order: [['fecha', 'desc']], limit: 2 }),
        // Toda la fila (sin nombrar columnas: así funciona también sin la migración 018)
        b.select('atletas', { eq: { id: atletaId } }).then((x) => x[0] || null).catch(() => null),
        api.preguntasCheckin(atletaId).catch(() => []),
        // (054) el de la semana anterior, para «igual que la semana pasada»
        b.select('checkins', { eq: { atleta_id: atletaId, semana_inicio: sumarDias(lunes, -7) } }).then((x) => x[0] || null).catch(() => null),
      ]);
      return { checkin: checkin || null, molestias, pesos, medidas, apartados: atleta?.checkin_apartados ?? null, nutricion: atleta?.nutricion !== false, preguntas, anterior };
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
    // El peso: 'diario' (en «Tu día», de entrada) o 'semanal' (en el check-in). Migración 026.
    async guardarFrecuenciaPeso(atletaId, frecuencia) {
      if (!['diario', 'semanal'].includes(frecuencia)) throw new Error('El peso va a diario o una vez a la semana');
      return (await b.update('atletas', { peso_frecuencia: frecuencia }, { eq: { id: atletaId } }).catch(falta026))[0];
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
    // (pulido 3.1) El historial ya no se baja entero en cada visita. Lo antiguo (las series anteriores a un «corte»)
    // se guarda en el dispositivo, con la copia de siempre (por cuenta, se borra al cerrar la sesión), y cada vez se
    // pregunta a la base por su huella (migración 048: una respuesta de unas letras). Si es la de lo guardado, solo
    // se piden las series desde el corte; si no (se cambió o se borró algo antiguo), se baja todo otra vez. El corte
    // se va adelantando solo. Sin la migración, se baja entero como hasta ahora (ya sin las columnas que no se usan).
    async historialSinCompartir(atletaId) {
      const yo = uid();
      let g = null;
      const k = `${yo}:${atletaId}`;
      if (guardandoHistorial.has(k)) await guardandoHistorial.get(k);
      if (yo && atletaId && con048 !== false) {
        g = historialesGuardados.get(k) || (notaHistorial().includes(k) ? (await copiaDelMovil().leer(yo, CLAVE_HISTORIAL(atletaId)).catch(() => null))?.datos : null) || null;
        if (g && !(typeof g.corte === 'string' && typeof g.huella === 'string' && Array.isArray(g.filas))) g = null;
        if (g) {
          try { if ((await b.rpc('historial_huella', { p_atleta: atletaId, p_antes: g.corte })) === g.huella) con048 = true; else g = null; } catch (e) { if (!falta048(e)) throw e; con048 = false; g = null; }
        }
      }
      // Lo nuevo (o todo): las series con, de su pauta, la sesión y el ejercicio, y el día de la sesión
      // (todas: el adaptador de Supabase pagina de 1000 en 1000; con un tope, a los pocos años se perderían las más nuevas)
      const series = await b.select('series', { eq: { atleta_id: atletaId }, ...(g ? { gte: { registrada_en: g.corte } } : {}), order: [['registrada_en', 'asc']] });
      const pautas = porId(series.length ? await b.select('sesion_ejercicios', { in: { id: unicos(series.map((s) => s.sesion_ejercicio_id)) }, cols: 'id,sesion_id,ejercicio_id' }) : []);
      const sesIds = unicos(Object.values(pautas).map((p) => p.sesion_id));
      const sesiones = porId(sesIds.length ? await b.select('sesiones', { in: { id: sesIds }, cols: 'id,fecha_realizada' }) : []);
      const nuevas = series.map((s) => { const p = pautas[s.sesion_ejercicio_id] || {}; return { ...s, _sesion: p.sesion_id || null, _pautado: p.ejercicio_id || null, _dia: sesiones[p.sesion_id]?.fecha_realizada || null }; });
      const todas = g ? [...g.filas, ...nuevas] : nuevas;
      // Los nombres de los ejercicios, siempre de ahora (son pocos y pueden cambiar)
      const ejIds = unicos(todas.flatMap((s) => [s._pautado, s.sustituto_id]));
      const ejercicios = porId(ejIds.length ? await b.select('ejercicios', { in: { id: ejIds }, cols: 'id,nombre,grupos_musculares' }) : []);
      // Adelantar el corte: la primera vez, cuando lo nuevo ya es mucho o cuando el corte se queda viejo. Lo de la última
      // semana se pide siempre (es lo que se corrige); lo anterior queda guardado con la huella que da la base ahora
      if (yo && atletaId && con048 !== false && todas.length && (!g || nuevas.length > 250 || Date.now() - Date.parse(g.corte) > 21 * 86400000)) {
        const corte = new Date(Date.now() - 7 * 86400000).toISOString();
        const antiguas = todas.filter((s) => Date.parse(s.registrada_en) < Date.parse(corte));
        // (sin esperar: lo que se va a enseñar ya está; guardar para la próxima vez no tiene por qué retrasarlo)
        const guardar = (async () => {
          try {
            const huella = await b.rpc('historial_huella', { p_atleta: atletaId, p_antes: corte });
            con048 = true;
            // (solo si cuadra con lo que hay aquí: si alguien registró o borró algo entre medias, ya se guardará a la siguiente)
            if (uid() === yo && Number(String(huella).split(':')[0]) === antiguas.length) {
              const nuevo = { corte, huella, filas: antiguas };
              historialesGuardados.delete(k);
              historialesGuardados.set(k, nuevo);
              for (const x of [...historialesGuardados.keys()].slice(0, Math.max(0, historialesGuardados.size - 6))) historialesGuardados.delete(x);
              if (await copiaDelMovil().guardar(yo, CLAVE_HISTORIAL(atletaId), nuevo).catch(() => false)) apuntarHistorial(k);
            }
          } catch (e) { if (falta048(e)) con048 = false; }
        })().finally(() => { if (guardandoHistorial.get(k) === guardar) guardandoHistorial.delete(k); });
        guardandoHistorial.set(k, guardar);
      } else if (g && yo) historialesGuardados.set(k, g);
      return todas.map(({ _sesion, _pautado, _dia, ...s }) => {
        const ef = s.sustituto_id || _pautado;
        const e = ejercicios[ef] || {};
        return {
          ...s,
          fecha: _dia || fechaDe(s.registrada_en),
          sesion_id: _sesion,
          ejercicio_id: ef, ejercicio: e.nombre, grupos: e.grupos_musculares || [],
          sustituto: !!s.sustituto_id, pautado: ejercicios[_pautado]?.nombre || null,
        };
      });
    },
    // Constancia a lo largo de todos sus bloques: racha de semanas completas y días entrenados (12 semanas)
    // v0.53: con objetivo de días por semana (microciclos), por semanas de lunes a domingo con ese objetivo
    // (semanasObjetivo); sin él, lo de siempre. «actual»: la semana de hoy ({ lunes, objetivo, hechas, completa } o null)
    async constancia(atletaId, hoy = hoyISO()) {
      const [bloques, diasSemana] = await Promise.all([
        b.select('bloques', { eq: { atleta_id: atletaId, es_plantilla: false }, cols: COLS_BLOQUE }),
        diasSemanaDe(atletaId),
      ]);
      const semanas = bloques.length ? semanasQueCuentan(await b.select('semanas', { in: { bloque_id: bloques.map((x) => x.id) }, eq: { programacion: 'programada' } }), bloques) : [];
      const sesiones = semanas.length ? await b.select('sesiones', { in: { semana_id: semanas.map((x) => x.id) } }) : [];
      const desde = sumarDias(lunesDe(hoy), -7 * 11);
      const series = await b.select('series', { eq: { atleta_id: atletaId }, gte: { registrada_en: desde }, cols: 'registrada_en', limit: 10000 });
      const objetivo = semanasObjetivo({ diasSemana, sesiones, semanas, hoy });
      const lista = paraRacha(objetivo);
      const dias = {};
      for (const x of series) { const d = aISO(new Date(x.registrada_en)); dias[d] = (dias[d] || 0) + 1; }
      for (const x of sesiones) if (x.completada && x.fecha_realizada >= desde && !dias[x.fecha_realizada]) dias[x.fecha_realizada] = 1;
      // (v0.49: el calendario de Progreso sale de sesionesHechas; aquí solo hace falta la cuenta de días)
      const diasEntrenados = mapaCalor(dias, hoy).flatMap((w) => w.dias).filter((d) => d.nivel > 0).length;
      // v0.50: también cuántas semanas completas lleva en total (la cabecera de su perfil)
      // v0.52: y cada semana (lunes, programadas y hechas), para el calendario de la pantalla de la racha
      // v0.68 (la bienvenida): el último día que entrenó (de las últimas 11 semanas) y si ha entrenado alguna vez
      const ultimoDia = Object.keys(dias).filter((d) => d <= hoy).sort().at(-1) || null;
      const algunaVez = !!ultimoDia || sesiones.some((x) => x.completada);
      return { racha: racha(lista, hoy), diasEntrenados, semanasCompletas: semanasCompletas(lista, hoy), semanas: lista,
        diasSemana, actual: semanaEnCurso(objetivo, hoy), ultimoDia, algunaVez };
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
    // pesoDiario (v0.40, migración 026): con el peso semanal no sale «Tu peso» (se lo pide el check-in)
    async tuDia(atletaId, { programa = null, checkin = null, salud = true, nutricion: conNut = true, entrenamiento = true, pesoDiario = true, hoy = hoyISO() } = {}) {
      const semana = entrenamiento ? programa?.actual || null : null;
      const sesiones = semana ? programa.sesiones[semana.id] || [] : null;
      const [pesos, habitos, nutricion, cuestionario, tareas] = await Promise.all([
        salud && pesoDiario ? b.select('pesos', { eq: { atleta_id: atletaId, fecha: hoy }, cols: 'id', limit: 1 }).catch(() => null) : null,
        salud ? api.resumenHabitos(atletaId, hoy).catch(() => []) : [],
        salud && conNut ? api.planesNutricion(atletaId).then(async (planes) => {
          const plan = planVigente(planes, hoy);
          if (!plan) return null;
          const [r] = await api.registrosNutricion(atletaId, hoy, hoy);
          return { plan, hoy: r || null };
        }).catch(() => null) : null,
        api.cuestionario(atletaId).catch(() => null),
        api.tareas(atletaId),
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
        tareas,
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
    // v0.49: sesiones hechas, ligeras (sin el historial entero): desde una fecha (el calendario de 16 semanas) o las de
    // un nombre (la última vez que hizo esa sesión, para el resumen), de la más reciente a la más antigua y con sus
    // series y tonelaje (solo de esas sesiones). limite: cuántas como mucho.
    async sesionesHechas(atletaId, { desde = null, nombre = null, limite = null } = {}) {
      const bloques = await b.select('bloques', { eq: { atleta_id: atletaId, es_plantilla: false }, cols: 'id' });
      const semanas = bloques.length ? await b.select('semanas', { in: { bloque_id: bloques.map((x) => x.id) }, cols: 'id' }) : [];
      if (!semanas.length) return [];
      const filtro = { in: { semana_id: semanas.map((x) => x.id) }, eq: { completada: true, ...(nombre ? { nombre } : {}) }, order: [['fecha_realizada', 'desc']],
        cols: 'id,nombre,tipo,fecha_realizada,duracion_min,cardio_hecho', ...(desde ? { gte: { fecha_realizada: desde } } : {}), ...(limite ? { limit: limite } : {}) };
      const sesiones = (await b.select('sesiones', filtro)).filter((x) => x.fecha_realizada);
      const pautas = sesiones.length ? await b.select('sesion_ejercicios', { in: { sesion_id: sesiones.map((x) => x.id) }, cols: 'id,sesion_id' }) : [];
      const series = pautas.length ? await b.select('series', { in: { sesion_ejercicio_id: pautas.map((x) => x.id) }, cols: 'sesion_ejercicio_id,kg,reps', limit: 20000 }) : [];
      const sesionDe = Object.fromEntries(pautas.map((x) => [x.id, x.sesion_id]));
      const porSesion = agrupar(series.filter((x) => Number(x.reps) > 0).map((x) => ({ ...x, sesion_id: sesionDe[x.sesion_ejercicio_id] })), 'sesion_id');
      return sesiones.map((x) => {
        const ss = porSesion[x.id] || [];
        return { id: x.id, nombre: x.nombre, tipo: x.tipo, fecha: x.fecha_realizada, duracion_min: x.duracion_min, cardio_hecho: x.cardio_hecho || null,
          series: ss.length, tonelaje: ss.reduce((t, s2) => t + (Number(s2.kg) || 0) * (Number(s2.reps) || 0), 0) };
      });
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
          // v0.116 (el perfil): las series por grupo, la hora de la primera serie y los ejercicios que hizo
          grupos: musc, inicio: ss.reduce((m, s) => (s.registrada_en && (!m || s.registrada_en < m) ? s.registrada_en : m), null),
          ejercicios: [...new Map(ss.filter((s) => s.ejercicio_id).map((s) => [s.ejercicio_id, { id: s.ejercicio_id, nombre: s.ejercicio }])).values()],
        };
      }).sort((a, c) => ((a.fecha || '') < (c.fecha || '') ? 1 : -1));
    },
    // «Tu semana»: resumen de las últimas n semanas cerradas (las vacías no salen), de la más reciente a la más antigua
    async resumenesSemanales(atletaId, n = 4, hoy = hoyISO()) {
      const [bloques, diasSemana] = await Promise.all([
        b.select('bloques', { eq: { atleta_id: atletaId, es_plantilla: false }, cols: COLS_BLOQUE }),
        diasSemanaDe(atletaId),
      ]);
      const [series, pesos, todas] = await Promise.all([
        api.historial(atletaId),
        api.pesos(atletaId, 7 * (n + 4)).catch(() => []),
        bloques.length ? b.select('semanas', { in: { bloque_id: bloques.map((x) => x.id) }, eq: { programacion: 'programada' } }) : [],
      ]);
      const semanas = semanasQueCuentan(todas, bloques);
      const sesiones = semanas.length ? await b.select('sesiones', { in: { semana_id: semanas.map((x) => x.id) } }) : [];
      const lunesDeSemana = Object.fromEntries(semanas.map((w) => [w.id, w.fecha_inicio ? lunesDe(w.fecha_inicio) : null]));
      const conLunes = sesiones.map((x) => ({ ...x, semana_lunes: lunesDeSemana[x.semana_id] }));
      // v0.53: con objetivo de días por semana, cada semana natural con su objetivo (la completa, la de su objetivo)
      const objetivo = semanasObjetivo({ diasSemana, sesiones, semanas, hoy });
      const listaRacha = paraRacha(objetivo);
      const { eventos } = eventosRecord(series);
      const lunesHoy = lunesDe(hoy);
      return Array.from({ length: n }, (_, i) => {
        const lunes = sumarDias(lunesHoy, -7 * (i + 1));
        const r = { ...resumenSemanal({ series, sesiones: conLunes, pesos }, lunes, { eventos }), racha: racha(listaRacha, sumarDias(lunes, 6)) };
        if (diasSemana) {
          const w = objetivo.find((x) => x.lunes === lunes);
          r.sesiones = { hechas: r.sesiones.hechas, total: Math.max(w?.objetivo || 0, r.sesiones.hechas), completa: !!w?.completa };
          r.objetivoSemanal = diasSemana;
        }
        return r;
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
        b.select('comentarios', { eq: { atleta_id: atletaId, autor: 'atleta' }, gte: { creado_en: `${desde}T00:00:00` } }).then((xs) => xs.filter((c) => !c.eliminado_en)),
      ]);
      // (v0.66) las sesiones a las que ya le has dicho «Bien hecho» (o le has escrito algo en su hilo)
      const conTuyo = new Set(await b.select('comentarios', { eq: { atleta_id: atletaId, autor: 'coach' }, gte: { creado_en: `${desde}T00:00:00` }, cols: 'sesion_id,eliminado_en' })
        .then((xs) => xs.filter((c) => c.sesion_id && !c.eliminado_en).map((c) => c.sesion_id)).catch(() => []));
      const recordsPorSesion = {};
      for (const e of eventosRecord(series).eventos) if (e.sesion_id) (recordsPorSesion[e.sesion_id] ||= []).push(e);
      const ev = [];
      for (const x of entrenos.filter((e) => e.fecha && e.fecha >= desde)) {
        const rec = recordsPorSesion[x.id] || [];
        ev.push({ tipo: 'sesion', fecha: x.fecha, cuando: `${x.fecha}T20:00`, icono: 'hoy', pestana: 'registro', sesionId: x.id, nombreSesion: x.nombre, comentada: conTuyo.has(x.id),
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
      return (await b.select('avisos', { order: [['desde', 'asc'], ['creado_en', 'asc']] })).map((a) => ({ ...a, programado: programado(a) }));
    },
    // Coach: publicar un aviso o cambiarlo; enviarEn (v0.48): a esa hora (desde ese día) y no antes
    async guardarAviso({ texto, atleta_id = null, desde = hoyISO(), hasta = null, enviarEn = null }, id = null) {
      const t = String(texto || '').trim();
      if (!t || t.length > 600) throw new Error('El aviso, de 1 a 600 letras');
      const fila = { texto: t, atleta_id: atleta_id || null, desde, hasta: hasta || null };
      if (enviarEn) {
        const cuando = Date.parse(enviarEn);
        if (!Number.isFinite(cuando) || cuando <= Date.now() + 60000) throw new Error('Elige una hora que aún no haya pasado');
        if (cuando > Date.now() + 90 * 864e5) throw new Error('Un aviso se programa como mucho a 90 días vista');
        fila.enviar_en = new Date(cuando).toISOString();
        fila.desde = fechaMadrid(new Date(cuando));
        if (fila.hasta && fila.hasta < fila.desde) throw new Error('La fecha de fin es anterior a la de salida');
      } else if (id) fila.enviar_en = null;
      if (id) return (await b.update('avisos', fila, { eq: { id } }).catch(falta030))[0];
      return (await b.insert('avisos', [fila]).catch(falta030))[0];
    },
    // «¿Cómo llegas hoy?» (datos de salud: la base exige el consentimiento)
    async guardarPreparacion(sesionId, preparacion) {
      return (await b.update('sesiones', { preparacion }, { eq: { id: sesionId } }))[0];
    },
    // Informes de sus bloques (los que tienen semanas publicadas), del más reciente al más antiguo
    // v0.53: a quien va por microciclos (objetivo de días por semana), el cumplimiento de lo hecho (las fechas de sus
    // semanas no dicen qué tocaba ya)
    async informes(atletaId, { salud = true, hoy = hoyISO() } = {}) {
      const [bloques, diasSemana] = await Promise.all([
        b.select('bloques', { eq: { atleta_id: atletaId, es_plantilla: false } }),
        diasSemanaDe(atletaId),
      ]);
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
        .map((bl) => informeBloque({ bloque: bl, semanas: semPorBloque[bl.id], sesiones, pautas, series, eventos, pesos, soloHechas: !!diasSemana }, hoy))
        .filter(Boolean)
        .sort((x, y) => (x.inicio < y.inicio ? 1 : -1));
    },
    // Logros: cuentas de toda su historia (sesiones, racha más larga, toneladas, récords, vídeos, check-ins y días con peso)
    async logros(atletaId, { salud = true, hoy = hoyISO() } = {}) {
      const [bloques, diasSemana] = await Promise.all([
        b.select('bloques', { eq: { atleta_id: atletaId, es_plantilla: false }, cols: COLS_BLOQUE }),
        diasSemanaDe(atletaId),
      ]);
      const semanas = bloques.length ? await b.select('semanas', { in: { bloque_id: bloques.map((x) => x.id) }, eq: { programacion: 'programada' }, cols: 'id,bloque_id,fecha_inicio,programacion' }) : [];
      const cuentan = semanasQueCuentan(semanas, bloques);
      const [sesiones, series, videos, checkins, pesos] = await Promise.all([
        semanas.length ? b.select('sesiones', { in: { semana_id: semanas.map((x) => x.id) }, cols: 'id,semana_id,completada,fecha_realizada' }) : [],
        api.historial(atletaId),
        b.select('archivos', { eq: { atleta_id: atletaId, tipo: 'video_tecnica' }, cols: 'id' }),
        salud ? b.select('checkins', { eq: { atleta_id: atletaId }, cols: 'id' }).catch(() => []) : [],
        salud ? b.select('pesos', { eq: { atleta_id: atletaId }, cols: 'fecha' }).catch(() => []) : [],
      ]);
      // v0.53: «Semanas completas», con su objetivo de días por semana si lo tiene
      const listaRacha = paraRacha(semanasObjetivo({ diasSemana, sesiones, semanas: cuentan, hoy }));
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
    // v0.51: las sesiones terminadas de las últimas semanas, para el dial «Carga» de Hoy: solo las columnas de la carga,
    // y con los bloques que Hoy ya tiene (del programa), dos consultas en vez de tres. Las semanas, con margen (una
    // sesión atrasada se puede hacer semanas después de la suya).
    async cargaHoy(atletaId, { bloques = null, hoy = hoyISO(), semanas = 5 } = {}) {
      const ids = bloques?.length ? bloques.map((x) => x.id || x) : (await b.select('bloques', { eq: { atleta_id: atletaId, es_plantilla: false }, cols: 'id' })).map((x) => x.id);
      const desde = sumarDias(lunesDe(hoy), -7 * semanas);
      const sem = ids.length ? await b.select('semanas', { in: { bloque_id: ids }, gte: { fecha_inicio: sumarDias(desde, -56) }, cols: 'id' }) : [];
      if (!sem.length) return [];
      const filas = await b.select('sesiones', { in: { semana_id: sem.map((x) => x.id) }, eq: { completada: true }, gte: { fecha_realizada: desde }, cols: 'id,completada,fecha_realizada,rpe_sesion,duracion_min' });
      return filas.map((x) => ({ id: x.id, completada: x.completada, fecha_realizada: x.fecha_realizada, rpe_sesion: x.rpe_sesion, duracion_min: x.duracion_min }));
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
        // (imágenes) con sus grupos, para que su ficha diga los músculos (y lleve la estatua del principal)
        return { id, nombre: ss[0].ejercicio, grupos_musculares: ss[0].grupos || [], puntos, series: ss.length, mejor: Math.max(0, ...puntos.map((p) => p.valor)) };
      }).filter((e) => e.puntos.length).sort((a, c) => c.series - a.series);
      const lunes = lunesDe(hoyISO());
      return {
        // v0.52: los kilos movidos de cada día (para la gráfica del tonelaje y los destacados), del mismo historial
        pesos, checkins, ejercicios, medidas, vitrina: vitrina(series), volumenObjetivo: ficha?.volumen_objetivo || null, tonelaje: tonelajePorDia(series),
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
    // respondeA (v0.54): el mensaje que cita (de la misma conversación y del mismo hilo; lo comprueba la base)
    // clienteId (v0.55): el id que pone el móvil (el de la bandeja de salida); si ese mensaje ya entró (un reintento sin
    // cobertura cuya respuesta no llegó), devuelve el que ya está, sin repetirlo. Sin la 033, se envía sin él.
    // videoRespuestaId (v0.60, 038): el vídeo de una respuesta en el hilo de un vídeo (ver responderConVideo)
    // resumenSesion (v0.61, 039): el resumen de una sesión (uno por sesión, lo marca y lo comprueba la base)
    // v0.66: «Bien hecho» del coach a un entreno terminado, con un toque: un mensaje en el hilo de esa sesión (le llega el aviso
    // de siempre de un comentario del coach)
    async felicitar(atletaId, sesionId, nombreSesion = '') {
      return api.comentar({ atletaId, sesionId, autor: 'coach', texto: `💪 ¡Bien hecho${nombreSesion ? ` en ${nombreSesion}` : ''}! He visto tu entreno.` });
    },
    async comentar({ atletaId, sesionId = null, checkinId = null, archivoId = null, texto, autor, dibujo = null, respondeA = null, clienteId = null, videoRespuestaId = null, resumenSesion = false }) {
      const fila = { atleta_id: atletaId, sesion_id: sesionId, checkin_id: checkinId, archivo_id: archivoId, texto: texto.trim(), autor };
      if (videoRespuestaId) fila.video_respuesta_id = videoRespuestaId;
      if (resumenSesion) fila.resumen_sesion = true;
      if (archivoId && dibujo) {
        if (!dibujoValido(dibujo)) throw new Error('El dibujo no tiene la forma que toca');
        fila.dibujo = dibujo;
      }
      if (respondeA) fila.responde_a = respondeA;
      if (clienteId) fila.cliente_id = clienteId;
      const insertar = (f) => b.insert('comentarios', [f]).catch(respondeA ? falta032 : videoRespuestaId ? falta038 : resumenSesion ? falta039 : (e) => { throw e; });
      try {
        return (await insertar(fila))[0];
      } catch (e) {
        if (clienteId && duplicado(e)) {
          const [ya] = await b.select('comentarios', { eq: { atleta_id: atletaId, cliente_id: clienteId, autor: autor === 'coach' ? 'coach' : 'atleta' } }).catch(() => []);
          if (ya) return ya;
        }
        if (clienteId && sinCliente033(e)) { const { cliente_id, ...sin } = fila; return (await insertar(sin))[0]; }
        throw e;
      }
    },
    async marcarLeidos(ids) {
      if (!ids.length) return [];
      return b.update('comentarios', { leido_en: new Date().toISOString() }, { in: { id: ids } });
    },
    // Lo que le ha escrito el coach y aún no ha leído
    async noLeidos(atletaId) {
      // (v0.54) lo que el coach eliminó ya no cuenta. (v0.55) Lo que llega, entregado (✓✓ gris para el coach)
      const filas = (await b.select('comentarios', { eq: { atleta_id: atletaId, autor: 'coach' }, nulo: ['leido_en'], order: [['creado_en', 'desc']] })).filter((c) => !c.eliminado_en);
      if (filas.some((c) => !c.entregado_en)) api.marcarEntregados().catch(() => {});
      return filas;
    },
    // Un comentario es «un mensaje del chat» si va suelto o si lleva un adjunto del chat (lo marca la base);
    // lo demás es una respuesta pegada a una sesión, un check-in o un vídeo del diario
    esMensaje(c) { return !!c && (!!c.adjunto || (!c.sesion_id && !c.checkin_id && !c.archivo_id)); },
    // El chat (v0.18): todos los mensajes con un atleta en un solo hilo, con su contexto (sesión, check-in o vídeo)
    // y el archivo si lo hay. Los más antiguos primero.
    // v0.54: cada mensaje, además, con sus reacciones ([{ usuario_id, emoji }]), si lo he destacado yo, qué lleva
    // (medio: 'foto' | 'video' | 'archivo') y si se editó o se eliminó. Sin la migración 032, sin reacciones ni destacados.
    async conversacion(atletaId, { limite = 400 } = {}) {
      const todos = await b.select('comentarios', { eq: { atleta_id: atletaId }, order: [['creado_en', 'desc']], limit: limite });
      const mensajes = todos.reverse();
      // (v0.55) lo de la otra parte que acaba de llegar, entregado
      if (mensajes.some((c) => c.entregado_en === null && !c.eliminado_en)) api.marcarEntregados().catch(() => {});
      const sesIds = unicos(mensajes.map((c) => c.sesion_id).filter(Boolean));
      const arcIds = unicos(mensajes.map((c) => c.archivo_id).filter(Boolean));
      const ids = mensajes.map((c) => c.id);
      const [sesiones, archivos, reacciones, destacados, encuestas] = await Promise.all([
        sesIds.length ? b.select('sesiones', { in: { id: sesIds }, cols: 'id,nombre,semana_id' }).catch(() => []) : [],
        arcIds.length ? b.select('archivos', { in: { id: arcIds } }).catch(() => []) : [],
        ids.length ? b.select('comentario_reacciones', { in: { comentario_id: ids }, cols: 'comentario_id,usuario_id,emoji' }).catch(() => []) : [],
        ids.length && uid() ? b.select('comentario_destacados', { in: { comentario_id: ids }, eq: { usuario_id: uid() }, cols: 'comentario_id' }).catch(() => []) : [],
        // (v0.56) las encuestas y su voto (sin la 034, ninguna)
        ids.length ? b.select('encuestas_chat', { in: { comentario_id: ids } }).catch(() => []) : [],
      ]);
      const votos = encuestas.length ? porCampo(await b.select('encuesta_votos', { in: { encuesta_id: encuestas.map((e) => e.id) } }).catch(() => []), 'encuesta_id') : {};
      const E = porCampo(encuestas, 'comentario_id');
      const S = porId(sesiones), A = porId(archivos), R = agrupar(reacciones, 'comentario_id'), D = new Set(destacados.map((x) => x.comentario_id));
      const vistos = new Set();
      return mensajes.map((c) => {
        const archivo = c.archivo_id ? A[c.archivo_id] || null : null;
        // El vídeo o la foto se enseña en el primer mensaje de su hilo (que no se haya eliminado); los siguientes solo
        // llevan la etiqueta
        const conMedio = !!archivo && !vistos.has(archivo.id) && !c.eliminado_en;
        if (archivo && conMedio) vistos.add(archivo.id);
        const contexto = c.sesion_id ? { tipo: 'sesion', id: c.sesion_id, nombre: S[c.sesion_id]?.nombre || 'una sesión' }
          : c.checkin_id ? { tipo: 'checkin', id: c.checkin_id, nombre: 'check-in' }
          : archivo ? { tipo: 'archivo', id: archivo.id, nombre: archivo.tipo === 'adjunto' || archivo.tipo === 'documento' ? null : /^video/.test(archivo.mime || '') || archivo.tipo === 'video_tecnica' ? 'vídeo' : 'foto' }
          : null;
        const medio = archivo ? medioDe({ archivo }) : null;
        return { ...c, contexto, archivo: conMedio ? archivo : null, archivoId: archivo?.id || null, medio, programado: programado(c), fotograma: !!archivo?.derivado_de,
          reacciones: c.eliminado_en ? [] : (R[c.id] || []).map(({ usuario_id, emoji }) => ({ usuario_id, emoji })), destacado: D.has(c.id),
          encuesta: E[c.id] && !c.eliminado_en ? { id: E[c.id].id, pregunta: E[c.id].pregunta, opciones: E[c.id].opciones, multiple: E[c.id].multiple, voto: votos[E[c.id].id]?.opciones || null, votado_en: votos[E[c.id].id]?.votado_en || null } : null };
      });
    },
    // v0.54: responder, reaccionar, editar, eliminar para todos y destacar (migración 032)
    // Reaccionar: la misma la quita; otra la cambia. Devuelve la que queda (o null). Una por persona y mensaje.
    async reaccionarMensaje(comentarioId, emoji) {
      // (v0.56) cualquier emoji (cada uno elige los suyos); sin la 034, solo los seis de siempre
      if (!emojiValido(emoji)) throw new Error('Esa reacción no es un emoji');
      if (!REACCIONES_CHAT.includes(emoji)) await api.exigir034();
      const yo = uid();
      const [mia] = await b.select('comentario_reacciones', { eq: { comentario_id: comentarioId, usuario_id: yo }, cols: 'emoji' }).catch(falta032);
      const queda = siguienteReaccion(mia?.emoji || null, emoji);
      if (!queda) await b.delete('comentario_reacciones', { eq: { comentario_id: comentarioId, usuario_id: yo } });
      else if (mia) await b.update('comentario_reacciones', { emoji: queda }, { eq: { comentario_id: comentarioId, usuario_id: yo } });
      else await b.insert('comentario_reacciones', [{ comentario_id: comentarioId, emoji: queda }]).catch(falta032).catch(falta034);
      return queda;
    },
    async editarMensaje(id, texto) {
      const t = String(texto || '').trim();
      if (!t) throw new Error('Escribe el mensaje');
      if (t.length > 4000) throw new Error('Un mensaje, hasta 4000 letras');
      const r = (await b.update('comentarios', { texto: t }, { eq: { id } }).catch(falta032))[0];
      if (!r) throw new Error('Ese mensaje ya no se puede editar');
      return r;
    },
    // Eliminar para todos lo propio (48 horas); un programado del coach que aún no ha salido se cancela. Si llevaba una
    // foto o un vídeo del chat, la base lo quita de su tabla (desde ahí nadie más que el coach lo ve) y lo pone en la cola
    // de Storage. El coach lo borra de Storage al momento (y, si falla, se reintenta desde la cola); lo de un atleta lo
    // borra la app del coach desde la cola (Storage no le deja borrar lo que ya no tiene su fila).
    // Devuelve { estado: 'eliminado' | 'cancelado', almacenamiento: 'nada' | 'borrado' | 'pendiente' }
    async eliminarMensaje(c) {
      const r = await b.rpc('comentario_eliminar', { p_comentario: c.id || c }).catch(falta032);
      const rutas = Array.isArray(r?.rutas) ? r.rutas.filter((x) => typeof x === 'string' && x) : [];
      let almacenamiento = 'nada';
      const coach = await api.esCoachAhora();
      if (rutas.length) almacenamiento = coach ? await api.borrarDeStorage(rutas.map((ruta) => ({ ruta, bucket: cuboDe(ruta, c?.archivo?.ruta === ruta ? c.archivo.tipo : null) }))) : 'pendiente';
      if (coach) api.limpiarAlmacenamiento().catch(() => {});
      return { estado: r?.estado || 'eliminado', almacenamiento };
    },
    // ¿La sesión es la del coach? (para la cola de Storage)
    async esCoachAhora() {
      if (!uid()) return false;
      const [p] = await b.select('perfiles', { eq: { id: uid() }, cols: 'rol' }).catch(() => []);
      return p?.rol === 'coach';
    },
    // El coach borra de Storage y lo quita de la cola: 'borrado' o, si Storage falla, 'pendiente' (se reintenta al
    // abrir la app y tras el siguiente borrado)
    // (v0.56) rutas: textos o { ruta, bucket } (cada una de su bucket)
    async borrarDeStorage(rutas) {
      const items = rutas.map((x) => (typeof x === 'string' ? { ruta: x, bucket: cuboDe(x) } : x));
      try {
        // (v0.73) y las fotos de los momentos que caducan (bucket «comunidad», 045)
        // (v0.73, 045) la cola va por bucket y ruta: se quita de la de cada bucket (sin la 045, todas las de esas rutas)
        for (const cubo of ['archivos', 'voz', 'comunidad']) {
          const rs = items.filter((x) => x.bucket === cubo).map((x) => x.ruta);
          if (!rs.length) continue;
          await b.storage.borrar(rs, cubo);
          await b.rpc('storage_borrado_cubo', { p_bucket: cubo, p_rutas: rs }).catch(() => b.rpc('storage_borrado', { p_rutas: rs }).catch(() => {}));
        }
        return 'borrado';
      } catch { return 'pendiente'; }
    },
    // La cola de Storage (lo que ya no tiene su fila en archivos): la vacía el coach. Devuelve cuántas rutas ha quitado.
    async limpiarAlmacenamiento() {
      if (!(await api.esCoachAhora())) return 0;
      let rutas;
      // (v0.56) con su bucket (la 034); sin ella, todo es de «archivos»
      try { rutas = (await b.rpc('storage_pendiente_cubos', { p_limite: 200 }) || []).filter((x) => x?.ruta).map((x) => ({ ruta: x.ruta, bucket: ['voz', 'comunidad'].includes(x.bucket) ? x.bucket : 'archivos' })); }
      catch {
        try { rutas = await b.rpc('storage_pendiente', { p_limite: 200 }); } catch { return 0; }
        rutas = (rutas || []).map((x) => (typeof x === 'string' ? x : x?.storage_pendiente || x?.r || null)).filter(Boolean).map((ruta) => ({ ruta, bucket: 'archivos' }));
      }
      if (!rutas.length) return 0;
      return (await api.borrarDeStorage(rutas)) === 'borrado' ? rutas.length : 0;
    },
    async destacar(comentarioId, si = true) {
      if (si) {
        await b.insert('comentario_destacados', [{ comentario_id: comentarioId }]).catch((e) => {
          if (/duplicate|23505|Ya existe/i.test(`${e?.codigo || ''} ${e?.message || ''}`)) return null;
          return falta032(e);
        });
      } else await b.delete('comentario_destacados', { eq: { comentario_id: comentarioId, usuario_id: uid() } });
      return si;
    },
    // Mis destacados de una conversación (los más recientes primero), con su mensaje
    async destacados(atletaId) {
      const mios = await b.select('comentario_destacados', { eq: { usuario_id: uid() }, order: [['creado_en', 'desc']] }).catch(() => []);
      if (!mios.length) return [];
      const msgs = porId(await b.select('comentarios', { in: { id: mios.map((x) => x.comentario_id) }, eq: { atleta_id: atletaId } }));
      return mios.filter((x) => msgs[x.comentario_id]).map((x) => ({ ...msgs[x.comentario_id], destacado_en: x.creado_en }));
    },
    // Buscar en los mensajes de todas las conversaciones (el coach)
    async buscarMensajes(texto, limite = 40) {
      const t = String(texto || '').trim();
      if (t.length < 2) return [];
      return (await b.rpc('chat_buscar', { p_texto: t.slice(0, 100), p_limite: limite }).catch(falta032)) || [];
    },
    // El estado de las conversaciones del coach: { [atleta_id]: { fijada_en, archivada_en, no_leida } }
    async estadoConversaciones() {
      const filas = await b.select('conversacion_estado', {}).catch(() => []);
      return Object.fromEntries(filas.map((x) => [x.atleta_id, x]));
    },
    // cambios: { fijada?: bool, archivada?: bool, noLeida?: bool }
    async cambiarEstadoConversacion(atletaId, cambios = {}) {
      const fila = { atleta_id: atletaId };
      if ('fijada' in cambios) fila.fijada_en = cambios.fijada ? new Date().toISOString() : null;
      if ('archivada' in cambios) fila.archivada_en = cambios.archivada ? new Date().toISOString() : null;
      if ('noLeida' in cambios) fila.no_leida = !!cambios.noLeida;
      return (await b.upsert('conversacion_estado', [fila], 'atleta_id').catch(falta032))[0];
    },
    // La última conexión: la mía (y si la enseño) y la de la otra parte (el coach, la de un atleta; un atleta, la de su
    // coach). Sin la 032 (o si alguien la oculta), null.
    async marcarPresencia(visible = null) {
      return b.rpc('presencia_marcar', visible == null ? {} : { p_visible: !!visible }).catch(visible == null ? () => null : falta032);
    },
    async miPresencia() {
      const yo = uid();
      if (!yo) return { visible: true, ultima_conexion: null };
      const [x] = await b.select('presencia', { eq: { usuario_id: yo } }).catch(() => []);
      return { visible: x ? x.visible !== false : true, ultima_conexion: x?.ultima_conexion || null };
    },
    async ultimaConexion(usuarioId = null) {
      const yo = uid();
      const filas = await b.select('presencia', usuarioId ? { eq: { usuario_id: usuarioId } } : { neq: { usuario_id: yo } }).catch(() => []);
      const x = filas.find((f) => f.usuario_id !== yo && f.visible !== false);
      return x?.ultima_conexion || null;
    },
    // «escribiendo…» y «en línea» (el canal privado de la conversación); null si este backend no los tiene
    canalChat(atletaId, oyente) {
      return typeof b.canalChat === 'function' ? b.canalChat(atletaId, oyente) : null;
    },
    reiniciarChats() { if (typeof b.reiniciarChats === 'function') b.reiniciarChats(); },

    // ------------------------------------------------------------ v0.55: el chat, aún más como WhatsApp (migración 033)
    // ¿Tiene la base la 033? Lo nuevo (fijar, silenciar, difusión, reenviar, documentos) lo pregunta antes; sin ella, lo
    // de antes funciona igual y lo nuevo dice qué falta. (Un fallo de la red no se recuerda: se vuelve a preguntar.)
    async chat033() {
      if (!api._c033) {
        api._c033 = b.select('conversacion_fijado', { limit: 1, cols: 'atleta_id' }).then(() => true, (e) => {
          const falta = /conversacion_fijado|schema cache|does not exist|no existe|relation|PGRST20/i.test(e?.message || '');
          if (!falta) api._c033 = null;
          return !falta;
        });
      }
      return api._c033;
    },
    async exigir033() { if (!(await api.chat033())) throw new Error(AVISO_033); },
    // v0.56: ¿tiene la base la 034? (notas de voz, encuestas, «escuchado», reacciones a elegir)
    async chat034() {
      if (!api._c034) {
        api._c034 = b.select('encuestas_chat', { limit: 1, cols: 'id' }).then(() => true, (e) => {
          const falta = /encuestas_chat|schema cache|does not exist|no existe|relation|PGRST20/i.test(e?.message || '');
          if (!falta) api._c034 = null;
          return !falta;
        });
      }
      return api._c034;
    },
    async exigir034() { if (!(await api.chat034())) throw new Error(AVISO_034); },
    // «Escuchado» (el micro azul): quien recibe una nota de voz la reproduce. Sin la 034, o con «en línea» apagado, nada.
    async marcarEscuchado(comentarioId) {
      if (!comentarioId || typeof backend.rpc !== 'function') return null;
      try { return await backend.rpc('marcar_escuchado', { p_comentario: comentarioId }); } catch { return null; }
    },
    // Una encuesta (el coach) en el chat de un atleta o en el de cada uno de una lista de difusión. envio: lo de este
    // envío (su id, el mismo al reintentar: no sale dos veces). Devuelve { enviados, saltados }.
    async crearEncuestaChat({ atletaId = null, listaId = null, pregunta, opciones, multiple = false, envio = {} }) {
      await api.exigir034();
      const e = limpiarEncuestaChat({ pregunta, opciones, multiple });
      if (!e.ok) throw new Error(e.error);
      envio.cliente ||= nuevoUuid();
      const r = await b.rpc('chat_encuesta', { p_atleta: atletaId, p_lista: listaId, p_pregunta: e.pregunta, p_opciones: e.opciones, p_multiple: e.multiple, p_cliente: envio.cliente }).catch(falta034);
      return { enviados: Number(r?.enviados) || 0, saltados: Number(r?.saltados) || 0 };
    },
    // El voto del atleta (o quitarlo, con ninguna). Devuelve el que queda
    async votarEncuestaChat(encuestaId, opciones = []) {
      return (await b.rpc('encuesta_votar', { p_encuesta: encuestaId, p_opciones: opciones }).catch(falta034)) || null;
    },
    // Ir a una fecha: cuántos mensajes hay desde ese día (para cargar hasta ahí)
    async mensajesDesde(atletaId, desdeISO) {
      return (await b.select('comentarios', { eq: { atleta_id: atletaId }, gte: { creado_en: desdeISO }, cols: 'id' })).length;
    },
    // «Entregado» (✓✓ gris): lo dirigido a mí que mi app acaba de descargar. Directo al backend (no es «un cambio» de
    // la pantalla) y como mucho cada 8 segundos; sin la 033, nada.
    async marcarEntregados({ ya = false } = {}) {
      if (!uid() || typeof backend.rpc !== 'function') return 0;
      if (!ya && Date.now() - (api._entregados || 0) < 8000) {
        // (lo que llegue dentro de esos 8 segundos, al acabar)
        if (!api._entregadosLuego) api._entregadosLuego = setTimeout(() => { api._entregadosLuego = null; api.marcarEntregados({ ya: true }).catch(() => {}); }, 8000);
        return 0;
      }
      api._entregados = Date.now();
      try { return Number(await backend.rpc('marcar_entregados', {})) || 0; } catch { return 0; }
    },
    // El mensaje fijado de una conversación (con su mensaje), o null (si caducó, se eliminó o no hay)
    async fijado(atletaId) {
      const [f] = await b.select('conversacion_fijado', { eq: { atleta_id: atletaId } }).catch(() => []);
      if (!fijadoVigente(f)) return null;
      const [c] = await b.select('comentarios', { eq: { id: f.comentario_id } }).catch(() => []);
      if (!c || c.eliminado_en) return null;
      return { ...f, mensaje: c };
    },
    // duracion: '24h' | '7d' | '30d' (como WhatsApp). Uno por conversación: fijar otro sustituye al anterior.
    async fijarMensaje(atletaId, comentarioId, duracion = '7d') {
      await api.exigir033();
      return (await b.upsert('conversacion_fijado', [{ atleta_id: atletaId, comentario_id: comentarioId, hasta: hastaFijado(duracion) }], 'atleta_id').catch(falta033))[0];
    },
    async desfijarMensaje(atletaId) { await b.delete('conversacion_fijado', { eq: { atleta_id: atletaId } }).catch(falta033); },
    // Mis conversaciones silenciadas: { [atleta_id]: { hasta } } (solo las que siguen silenciadas)
    async silencios() {
      const filas = await b.select('chat_silencios', { eq: { usuario_id: uid() } }).catch(() => []);
      return Object.fromEntries(filas.filter((x) => silenciado(x)).map((x) => [x.atleta_id, x]));
    },
    // opcion: '8h' | 'semana' | 'siempre'; null la vuelve a activar
    async silenciar(atletaId, opcion) {
      if (opcion == null) { await b.delete('chat_silencios', { eq: { usuario_id: uid(), atleta_id: atletaId } }).catch(falta033); return null; }
      await api.exigir033();
      return (await b.upsert('chat_silencios', [{ usuario_id: uid(), atleta_id: atletaId, hasta: hastaSilencio(opcion) }], 'usuario_id,atleta_id').catch(falta033))[0];
    },
    // Las listas de difusión (solo el coach): [{ id, nombre, miembros: [atleta_id] }]
    async listasDifusion() {
      const [listas, miembros] = await Promise.all([
        b.select('listas_difusion', { order: [['nombre', 'asc']] }).catch(falta033),
        b.select('listas_difusion_miembros', {}).catch(falta033),
      ]);
      const M = agrupar(miembros, 'lista_id');
      return listas.map((l) => ({ ...l, miembros: (M[l.id] || []).map((m) => m.atleta_id) }));
    },
    async guardarListaDifusion({ id = null, nombre, miembros = [] }) {
      await api.exigir033();
      const n = String(nombre || '').replace(/\s+/g, ' ').trim();
      if (!n || !textoVisible(n)) throw new Error('Ponle un nombre a la lista');
      if (n.length > 40) throw new Error('El nombre, hasta 40 letras');
      const ids = [...new Set(miembros)];
      if (ids.length > 256) throw new Error('Una lista, como mucho 256 atletas');
      const lista = id ? (await b.update('listas_difusion', { nombre: n }, { eq: { id } }).catch(falta033))[0] : (await b.insert('listas_difusion', [{ nombre: n }]).catch((e) => {
        if (duplicado(e)) throw new Error('Ya tienes una lista con ese nombre');
        return falta033(e);
      }))[0];
      if (!lista) throw new Error('Esa lista ya no está');
      const antes = id ? (await b.select('listas_difusion_miembros', { eq: { lista_id: lista.id } })).map((m) => m.atleta_id) : [];
      const quitar = antes.filter((x) => !ids.includes(x));
      const poner = ids.filter((x) => !antes.includes(x));
      if (quitar.length) await b.delete('listas_difusion_miembros', { eq: { lista_id: lista.id }, in: { atleta_id: quitar } });
      if (poner.length) await b.insert('listas_difusion_miembros', poner.map((atleta_id) => ({ lista_id: lista.id, atleta_id })));
      return { ...lista, miembros: ids };
    },
    async borrarListaDifusion(id) { await b.delete('listas_difusion', { eq: { id } }).catch(falta033); },
    // Una copia de una foto, un vídeo o un documento del chat en la carpeta de otro atleta (el coach): primero su fila en
    // archivos (con lo que la base comprueba) y después la copia en Storage, con los permisos del coach. Así ese atleta
    // solo ve su copia (lo de la carpeta del otro sigue sin poder verlo).
    async copiarArchivoA(archivo, atletaId) {
      // (v0.57) el fotograma de un vídeo de un atleta es solo suyo (la base tampoco lo deja)
      if (archivo?.derivado_de) throw new Error('Un fotograma del vídeo de un atleta es solo suyo: no se reenvía');
      const ext = (/\.([a-z0-9]{1,5})$/i.exec(archivo.ruta || '') || [])[1]?.toLowerCase() || 'bin';
      const esImagen = /^image\//.test(archivo.mime || '');
      const dia = hoyISO();
      const ruta = archivo.tipo === 'documento' ? `${atletaId}/documento-${dia}-${aleatorio()}.pdf` : archivo.tipo === 'audio' ? `${atletaId}/audio-${dia}-${aleatorio()}.${ext}`
        : `${atletaId}/${esImagen ? 'adjunto' : 'adjunto-video'}-${dia}-${aleatorio()}.${ext}`;
      const poster_ruta = archivo.poster_ruta ? `${ruta}.jpg` : null;
      const [fila] = await b.insert('archivos', [{
        atleta_id: atletaId, tipo: archivo.tipo === 'documento' || archivo.tipo === 'audio' ? archivo.tipo : 'adjunto', ruta, mime: archivo.mime || null, bytes: archivo.bytes ?? null, fecha: dia,
        ...(archivo.duracion_seg != null ? { duracion_seg: archivo.duracion_seg } : {}), ...(poster_ruta ? { poster_ruta } : {}),
        ...(archivo.tipo === 'documento' ? { nombre: archivo.nombre || 'documento.pdf', ...(archivo.paginas ? { paginas: archivo.paginas } : {}) } : {}),
        ...(archivo.tipo === 'audio' && ondaValida(archivo.onda) ? { onda: archivo.onda } : {}),
      }]).catch(falta033);
      try { await b.storage.copiar(archivo.ruta, ruta, cuboDe(archivo.ruta, archivo.tipo)); } catch (e) { await b.delete('archivos', { eq: { id: fila.id } }).catch(() => {}); throw e; }
      if (poster_ruta) await b.storage.copiar(archivo.poster_ruta, poster_ruta).catch(async () => { await b.update('archivos', { poster_ruta: null }, { eq: { id: fila.id } }).catch(() => {}); fila.poster_ruta = null; });
      return fila;
    },
    // Reenviar (el coach) un mensaje suyo a varios atletas. Con archivo, cada uno recibe su copia. Todo en una función de
    // la base (chat_reenviar: comprueba, limita y lo crea todo de una vez).
    // envio: lo de este «Reenviar» (lo guarda la pantalla y lo vuelve a pasar al reintentar): el cliente_id de cada atleta
    // (el mismo en cada intento: la base no lo repite) y las copias ya hechas. Si la respuesta se pierde (sin cobertura)
    // las copias se quedan (puede que ya lleven su mensaje); si la base lo rechaza, se retiran las que no lo llevan.
    // Devuelve { enviados, saltados (de baja), fallidos (no se pudo copiar el archivo) }
    async reenviar(c, atletaIds, envio = {}) {
      await api.exigir033();
      envio.clientes ||= {};
      envio.copias ||= {};
      const { destinos, saltados, demasiados } = planReenvio(atletaIds, await api.atletas());
      if (demasiados) throw new Error('Se reenvía a 50 atletas como mucho');
      if (!destinos.length) throw new Error(saltados ? 'Están de baja: no se les puede reenviar' : 'Elige a quién reenviarlo');
      for (const id of destinos) envio.clientes[id] ||= nuevoUuid();
      // Lo que ya entró en un intento anterior (cuya respuesta se perdió) no se vuelve a mandar
      const yaEstan = await api.yaEnviados(destinos.map((id) => envio.clientes[id]));
      const faltan = destinos.filter((id) => !yaEstan.has(envio.clientes[id]));
      if (!faltan.length) return { enviados: destinos.length, saltados, fallidos: 0 };
      const archivo = c.archivo_id ? (await b.select('archivos', { eq: { id: c.archivo_id } }))[0] || null : null;
      if (c.archivo_id && !archivo) throw new Error('Ese archivo ya no está');
      const lista = [];
      let fallidos = 0;
      for (const atletaId of faltan) {
        let copia = null;
        if (archivo) {
          copia = envio.copias[atletaId] || null;
          if (!copia) {
            try { copia = await api.copiarArchivoA(archivo, atletaId); envio.copias[atletaId] = copia; } catch (e) { if (/033/.test(e?.message || '') || esTemporal(e)) throw e; fallidos++; continue; }
          }
        }
        lista.push({ atleta: atletaId, archivo: copia?.id || null, cliente: envio.clientes[atletaId], copia });
      }
      if (!lista.length) throw new Error('No se ha podido copiar el archivo: vuelve a intentarlo');
      try {
        const r = await b.rpc('chat_reenviar', { p_comentario: c.id, p_destinos: lista.map(({ atleta, archivo: a, cliente }) => ({ atleta, archivo: a, cliente })) }).catch(falta033);
        envio.copias = {};
        return { enviados: (destinos.length - faltan.length) + (Array.isArray(r) ? r.length : lista.length), saltados, fallidos };
      } catch (e) {
        await api.retirarCopias(lista.map((x) => ({ copia: x.copia, cliente: x.cliente, atleta: x.atleta })), e, (x) => { delete envio.copias[x.atleta]; });
        throw e;
      }
    },
    // ¿Cuáles de estos cliente_id (del coach) ya están en la base? (un reintento no repite lo que sí entró)
    async yaEnviados(clientes = []) {
      const ids = clientes.filter(Boolean);
      if (!ids.length) return new Set();
      const filas = await b.select('comentarios', { in: { cliente_id: ids }, eq: { autor: 'coach' }, cols: 'id,atleta_id,cliente_id' });
      return new Set(filas.map((x) => x.cliente_id));
    },
    // Tras un fallo de reenviar o difundir: sin cobertura (o sin sesión) no se toca nada (la base puede haberlo creado
    // y borrar la copia vaciaría su mensaje); si la base lo rechazó, se retiran las copias que no lleven ningún mensaje
    // (lo comprueba antes; si no puede comprobarlo, tampoco las toca).
    async retirarCopias(items, error, alRetirar = () => {}) {
      const conCopia = items.filter((x) => x.copia);
      if (!conCopia.length || esTemporal(error)) return;
      let usadas;
      try {
        const ids = conCopia.map((x) => x.copia.id);
        usadas = new Set((await b.select('comentarios', { in: { archivo_id: ids }, cols: 'id,archivo_id' })).map((x) => x.archivo_id));
      } catch { return; }
      for (const x of conCopia) {
        if (usadas.has(x.copia.id)) continue;
        await api.borrarArchivo(x.copia).then(() => alRetirar(x)).catch(() => {});
      }
    },
    // Una difusión (el coach): el mismo mensaje a cada miembro de la lista, en su chat. Con archivo: se sube una vez (a la
    // carpeta del primero) y se copia a la de cada uno; los mensajes los crea la base de una vez (chat_difundir: todos o
    // ninguno, sin repetir con el mismo id, y saltándose a los de baja). Devuelve { enviados, saltados }.
    // envio: lo de este envío (lo guarda la pantalla para reintentar): su cliente_id (el mismo en cada intento) y lo ya
    // subido. Si ya entró (la respuesta se perdió), no se repite; sin cobertura, lo subido se queda para el reintento.
    async difundir({ listaId, texto = '', archivo = null, enviarEn = null, paginas = null, poster = null, duracion_seg = null, envio = {} }) {
      await api.exigir033();
      const t = String(texto || '').trim();
      if (!t && !archivo) throw new Error('Escribe el mensaje');
      if (t.length > 4000) throw new Error('Un mensaje, hasta 4000 letras');
      if (archivo && enviarEn) throw new Error('Los mensajes con foto, vídeo o documento no se pueden programar');
      if (enviarEn) {
        const cuando = Date.parse(enviarEn);
        if (!Number.isFinite(cuando) || cuando <= Date.now() + 60000) throw new Error('Elige una hora que aún no haya pasado');
        if (cuando > Date.now() + 90 * 864e5) throw new Error('Un mensaje se programa como mucho a 90 días vista');
      }
      envio.cliente ||= nuevoUuid();
      envio.subidas ||= {};
      const [miembros, atletas] = await Promise.all([b.select('listas_difusion_miembros', { eq: { lista_id: listaId } }).catch(falta033), api.atletas()]);
      const { destinos, saltados } = planDifusion(miembros, atletas);
      if (!destinos.length) throw new Error(saltados ? 'Todos los de esta lista están de baja' : 'Esta lista no tiene a nadie');
      // ¿Ya salió en un intento anterior (y se perdió la respuesta)?
      const ya = await b.select('comentarios', { eq: { cliente_id: envio.cliente, autor: 'coach' }, cols: 'id,atleta_id' });
      if (ya.length) { envio.subidas = {}; return { enviados: ya.length, saltados }; }
      const subidas = [];
      try {
        if (archivo) {
          const esPdf = archivo.type === 'application/pdf';
          if (esPdf && archivo.size > PDF_MAX_MB * 1024 * 1024) throw new Error(`El PDF pesa más de ${PDF_MAX_MB} MB`);
          let primera = envio.subidas[destinos[0]] || null;
          if (!primera) {
            primera = await api.subirArchivo(destinos[0], archivo, { tipo: esPdf ? 'documento' : 'adjunto', poster: esPdf ? null : poster, duracion_seg: esPdf ? null : duracion_seg, ...(esPdf ? { nombre: archivo.name, paginas } : {}) });
            envio.subidas[destinos[0]] = primera;
          }
          subidas.push(primera);
          for (const id of destinos.slice(1)) {
            let x = envio.subidas[id] || null;
            if (!x) { x = await api.copiarArchivoA(primera, id); envio.subidas[id] = x; }
            subidas.push(x);
          }
        }
        const r = await b.rpc('chat_difundir', { p_lista: listaId, p_texto: t, p_enviar_en: enviarEn ? new Date(Date.parse(enviarEn)).toISOString() : null,
          p_destinos: subidas.length ? subidas.map((a) => ({ atleta: a.atleta_id, archivo: a.id })) : null, p_cliente: envio.cliente }).catch(falta033);
        envio.subidas = {};
        return { enviados: Number(r?.enviados) || 0, saltados: Number(r?.saltados) || saltados };
      } catch (e) {
        await api.retirarCopias(Object.entries(envio.subidas).map(([atleta, copia]) => ({ atleta, copia })), e, (x) => { delete envio.subidas[x.atleta]; });
        throw e;
      }
    },
    // Un enlace para guardar el archivo (la persona lo pide: «Guardar»), con su nombre
    async urlDescarga(ruta, nombre = null) { return b.storage.url(ruta, 600, 'archivos', { descargar: nombre || String(ruta).split('/').pop() }); },
    // El coach: una conversación por atleta, con el último mensaje y cuántos tiene sin leer; las que tienen
    // algo sin leer primero, luego por el último mensaje
    // (v0.54) con el estado de cada una (fijada, archivada, «no leída»), qué lleva el último (foto o vídeo) y sin contar
    // lo eliminado como sin leer. El orden fino (las fijadas arriba) lo pone la pantalla (ordenarConversaciones).
    async conversaciones() {
      const COLS = 'id,atleta_id,autor,texto,creado_en,leido_en,sesion_id,checkin_id,archivo_id,enviar_en';
      // (pulido 3) Con la migración 048, la base da el resumen de cada conversación (el último mensaje, los no leídos y
      // los programados de cada atleta: unos 10 kB). Sin ella, como antes: los últimos 2.000 mensajes con su texto,
      // contados aquí (y, pasados los 2.000, quien lleve tiempo sin escribir sale sin su último mensaje)
      const resumida = async () => {
        if (con048 === false) return null;
        try {
          const filas = await b.rpc('conversaciones_resumen');
          con048 = true;
          return Object.fromEntries((filas || []).map((f) => [f.atleta_id, { ultimo: f.ultimo || null, sinLeer: Number(f.sin_leer) || 0, programados: Number(f.programados) || 0 }]));
        } catch (e) { if (!falta048(e)) throw e; con048 = false; return null; }
      };
      const contada = async () => {
        const comentarios = await b.select('comentarios', { order: [['creado_en', 'desc']], limit: 2000, cols: `${COLS},adjunto,eliminado_en,editado_en,entregado_en` })
          .catch(() => b.select('comentarios', { order: [['creado_en', 'desc']], limit: 2000, cols: `${COLS},adjunto,eliminado_en,editado_en` }))
          .catch(() => b.select('comentarios', { order: [['creado_en', 'desc']], limit: 2000, cols: COLS }))
          .catch(() => b.select('comentarios', { order: [['creado_en', 'desc']], limit: 2000, cols: 'id,atleta_id,autor,texto,creado_en,leido_en,sesion_id,checkin_id,archivo_id' }));
        // (v0.48) El último mensaje es el último que ya ha salido; los programados se cuentan aparte
        const p = {};
        for (const c of comentarios) {
          const x = (p[c.atleta_id] ||= { ultimo: null, sinLeer: 0, programados: 0 });
          if (programado(c)) { x.programados++; continue; }
          x.ultimo ||= c;
          if (c.autor === 'atleta' && !c.leido_en && !c.eliminado_en) x.sinLeer++;
        }
        return p;
      };
      const [atletas, por, estado] = await Promise.all([
        api.atletas(),
        resumida().then((r) => r || contada()),
        api.estadoConversaciones(),
      ]);
      // Qué lleva el último de cada uno (foto, vídeo o archivo)
      const arcIds = unicos(Object.values(por).map((x) => x.ultimo?.archivo_id));
      const A = arcIds.length ? porId(await b.select('archivos', { in: { id: arcIds }, cols: 'id,tipo,mime' }).catch(() => [])) : {};
      for (const x of Object.values(por)) if (x.ultimo?.archivo_id && A[x.ultimo.archivo_id]) x.ultimo = { ...x.ultimo, medio: medioDe({ archivo: A[x.ultimo.archivo_id] }) };
      return atletas.filter((a) => a.estado !== 'baja' || por[a.id]).map((a) => ({ atleta: a, ultimo: por[a.id]?.ultimo || null, sinLeer: por[a.id]?.sinLeer || 0, programados: por[a.id]?.programados || 0, estado: estado[a.id] || null }))
        .sort((x, y) => (y.sinLeer > 0) - (x.sinLeer > 0) || String(y.ultimo?.creado_en || '').localeCompare(String(x.ultimo?.creado_en || '')) || x.atleta.nombre.localeCompare(y.atleta.nombre));
    },
    // Cuántos mensajes de atletas tiene el coach sin leer (la insignia de Mensajes); lo eliminado no cuenta
    async mensajesSinLeer() {
      const filas = await b.select('comentarios', { eq: { autor: 'atleta' }, nulo: ['leido_en'], cols: 'id,eliminado_en,entregado_en' })
        .catch(() => b.select('comentarios', { eq: { autor: 'atleta' }, nulo: ['leido_en'], cols: 'id,eliminado_en' }))
        .catch(() => b.select('comentarios', { eq: { autor: 'atleta' }, nulo: ['leido_en'], cols: 'id' }));
      // (v0.55) lo que llega a la app del coach queda entregado (✓✓ gris para el atleta)
      if (filas.some((c) => !c.eliminado_en && c.entregado_en === null)) api.marcarEntregados().catch(() => {});
      return filas.filter((c) => !c.eliminado_en).length;
    },
    // Enviar desde el chat: texto, o una foto o un vídeo con texto (adjunto). Si el vídeo es de técnica
    // (enDiario), se guarda como tal: entra en su diario y en tu bandeja de vídeos, con su propio hilo.
    // enviarEn (v0.48): un mensaje del coach programado para esa hora (solo texto); hasta entonces el atleta no lo ve
    // respondeA (v0.54): el mensaje que cita (con foto o vídeo, el primero de varios lo lleva)
    // clienteId (v0.55): el id del móvil (sin repetir al reintentar). Un PDF (v0.55, migración 033) va como documento del
    // chat, con su nombre (saneado) y sus páginas (si se saben); la ruta la genera la app.
    async enviarMensaje(atletaId, { texto = '', archivo = null, autor, enDiario = false, poster = null, duracion_seg = null, enviarEn = null, respondeA = null, clienteId = null, paginas = null, onda = null, alProgreso = null, senal = null, derivado_de = null }) {
      const t = String(texto || '').trim();
      if (enviarEn) {
        if (archivo) throw new Error('Los mensajes con foto o vídeo no se pueden programar');
        if (!t) throw new Error('Escribe el mensaje');
        const cuando = Date.parse(enviarEn);
        if (!Number.isFinite(cuando) || cuando <= Date.now() + 60000) throw new Error('Elige una hora que aún no haya pasado');
        if (cuando > Date.now() + 90 * 864e5) throw new Error('Un mensaje se programa como mucho a 90 días vista');
        return (await b.insert('comentarios', [{ atleta_id: atletaId, sesion_id: null, checkin_id: null, archivo_id: null, texto: t, autor, enviar_en: new Date(cuando).toISOString(), ...(respondeA ? { responde_a: respondeA } : {}) }]).catch(falta030).catch(falta032))[0];
      }
      if (!archivo) return api.comentar({ atletaId, texto: t, autor, respondeA, clienteId });
      const esPdf = archivo.type === 'application/pdf';
      const esVideo = /^video\//.test(archivo.type || '');
      // (v0.56) una nota de voz: hasta un minuto y 3 MB, sin pie
      const esAudio = /^audio\//.test(archivo.type || '');
      if (esPdf && archivo.size > PDF_MAX_MB * 1024 * 1024) throw new Error(`El PDF pesa más de ${PDF_MAX_MB} MB`);
      if (esPdf) await api.exigir033();
      if (esAudio) {
        await api.exigir034();
        if (!tipoAudio(archivo.type)) throw new Error('Ese audio no se puede enviar');
        if (archivo.size > MAX_VOZ_BYTES) throw new Error('La nota de voz pesa demasiado (más de 3 MB)');
      }
      const tipo = esPdf ? 'documento' : esAudio ? 'audio' : enDiario ? (esVideo ? 'video_tecnica' : 'foto_progreso') : 'adjunto';
      const delChat = tipo === 'adjunto' || tipo === 'documento' || tipo === 'audio';
      const fila = await api.subirArchivo(atletaId, archivo, { tipo, nota_atleta: enDiario && t ? t.slice(0, 500) : null, poster: esPdf || esAudio ? null : poster,
        duracion_seg: esPdf ? null : esAudio ? duracionGuardada(duracion_seg) : duracion_seg, alProgreso, senal,
        ...(esPdf ? { nombre: nombreSeguroPdf(archivo.name), paginas } : {}), ...(esAudio && ondaValida(onda) ? { onda } : {}),
        ...(derivado_de && tipo === 'adjunto' && /^image\//.test(archivo.type || '') ? { derivado_de } : {}) });
      // (v0.56) «Cancelar» justo cuando acababa de subirse: no sale (y su archivo se retira)
      if (senal?.cancelada) { if (delChat) await api.borrarArchivo(fila).catch(() => {}); const e = new Error('Cancelado'); e.cancelado = true; throw e; }
      try {
        return await api.comentar({ atletaId, archivoId: fila.id, texto: esAudio ? 'Nota de voz' : t || (esPdf ? 'Documento' : esVideo ? 'Vídeo' : 'Foto'), autor, respondeA: delChat ? respondeA : null, clienteId });
      } catch (e) {
        // Sin su mensaje, un adjunto no es nada: se retira (un vídeo del diario se queda, ya está en el diario)
        if (delChat) await api.borrarArchivo(fila).catch(() => {});
        throw e;
      }
    },
    // Cambiar un mensaje programado antes de que salga (texto y hora); enviarEn null lo manda ya
    async reprogramarMensaje(id, { texto, enviarEn = undefined } = {}) {
      const c = {};
      if (texto !== undefined) { const t = String(texto || '').trim(); if (!t) throw new Error('Escribe el mensaje'); c.texto = t; }
      if (enviarEn !== undefined) {
        if (enviarEn === null) c.enviar_en = null;
        else {
          const cuando = Date.parse(enviarEn);
          if (!Number.isFinite(cuando) || cuando <= Date.now() + 60000) throw new Error('Elige una hora que aún no haya pasado');
          if (cuando > Date.now() + 90 * 864e5) throw new Error('Un mensaje se programa como mucho a 90 días vista');
          c.enviar_en = new Date(cuando).toISOString();
        }
      }
      // (v0.54) solo mientras sigue programado: uno que ya ha salido se edita como cualquier mensaje (en sus 15 minutos)
      const r = (await b.update('comentarios', c, { eq: { id }, gte: { enviar_en: new Date().toISOString() } }).catch(falta030))[0];
      if (!r) throw new Error('Ese mensaje ya ha salido (o ya no está): no se puede cambiar');
      return r;
    },
    // ------------------------------------------------------------ vídeos y fotos (Storage privado)
    async archivos(atletaId, tipo = null) {
      const eq = { atleta_id: atletaId };
      if (tipo) eq.tipo = tipo;
      // Los adjuntos del chat no son vídeos de técnica ni fotos de progreso: solo salen si se piden
      // (v0.55) ni los documentos del chat
      return (await b.select('archivos', { eq, ...(tipo ? {} : { neq: { tipo: 'adjunto' } }), order: [['fecha', 'desc'], ['creado_en', 'desc']] })).filter((a) => tipo || (a.tipo !== 'documento' && a.tipo !== 'audio'));
    },
    // v0.41: cuántos vídeos de técnica ha enviado el atleta de cada ejercicio de una sesión (el aviso «Vídeo enviado»)
    async videosSesion(atletaId, seIds) {
      if (!seIds.length) return {};
      const filas = await b.select('archivos', { eq: { atleta_id: atletaId, tipo: 'video_tecnica' }, in: { sesion_ejercicio_id: seIds } });
      const n = {};
      for (const a of filas) n[a.sesion_ejercicio_id] = (n[a.sesion_ejercicio_id] || 0) + 1;
      return n;
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
      const ejercicios = porId(ejIds.length ? await b.select('ejercicios', { in: { id: ejIds }, cols: 'id,nombre,grupos_musculares,tipo,video_url' }) : []);
      const pautaPorId = porId(pautas);
      const porArchivo = {};
      for (const c of comentarios) { const x = (porArchivo[c.archivo_id] ||= { n: 0, coach: false }); x.n++; if (c.autor === 'coach') x.coach = true; }
      // (v0.57) la corrección de cada vídeo y la serie que se ve en él (sin la 035, sin ellas)
      const extra = await api.extrasVideos(archivos);
      return archivos.map((a) => {
        const ejId = a.ejercicio_id || pautaPorId[a.sesion_ejercicio_id]?.ejercicio_id || null;
        const revision = extra.revisiones[a.id] || null;
        return { ...a, ejercicio: ejId ? ejercicios[ejId] || null : null, comentarios: porArchivo[a.id]?.n || 0, respondido: !!porArchivo[a.id]?.coach,
          revision, serie: extra.series[a.id] || null, estado: a.tipo === 'video_tecnica' ? estadoVideo({ revision, respondido: !!porArchivo[a.id]?.coach }) : null };
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
    // (v0.57) Lo que ocupa todo, sin más (para el aviso del panel: una consulta de una columna)
    async bytesUsados() {
      return (await b.select('archivos', { cols: 'bytes' }).catch(() => [])).reduce((t, a) => t + (Number(a.bytes) || 0), 0);
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
    // alProgreso(0…1) de la subida; fecha: la del día en que se grabó (un vídeo que se queda pendiente sin cobertura
    // y se envía al día siguiente conserva su día)
    // La ruta de un archivo nuevo (se puede pedir antes para guardarla con un envío pendiente: reintentarlo usa la misma)
    rutaArchivo(atletaId, archivo, { tipo, fecha = null } = {}) {
      const ext = String(archivo.name || '').split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5)
        || String(archivo.type || '').split('/')[1] || 'bin';
      const esImagen = /^image\//.test(archivo.type || '') || tipo === 'foto_progreso';
      const dia = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) && fecha <= hoyISO() ? fecha : hoyISO();
      // (v0.55) un documento, siempre .pdf: la ruta nunca sale de su nombre
      if (tipo === 'documento') return `${atletaId}/documento-${dia}-${aleatorio()}.pdf`;
      // (v0.56) una nota de voz, con la extensión de su formato (nunca la del nombre)
      if (tipo === 'audio') return `${atletaId}/audio-${dia}-${aleatorio()}.${tipoAudio(archivo.type)?.ext || 'webm'}`;
      return `${atletaId}/${tipo === 'adjunto' ? (esImagen ? 'adjunto' : 'adjunto-video') : esImagen ? 'foto' : 'video'}-${dia}-${aleatorio()}.${ext}`;
    },
    // alProgreso(0…1) de la subida; fecha: la del día en que se grabó (un vídeo que se queda pendiente sin cobertura
    // y se envía al día siguiente conserva su día). ruta: la de un intento anterior (v0.33): reintentar es seguro,
    // se reutiliza el registro si ya se hizo y, si el archivo llegó entero aunque no la respuesta, no se sube dos veces.
    // (v0.57, 035) serie_numero: la serie del ejercicio de la sesión que se ve en el vídeo; repite_de: el vídeo corregido que
    // se graba de nuevo. Sin la 035, el vídeo sale igual, sin ellos. urlSubida / alUrlSubida: la dirección de la subida por
    // trozos (TUS), para seguir por donde iba si se corta o se cierra la app.
    async subirArchivo(atletaId, archivo, { tipo, sesion_ejercicio_id = null, ejercicio_id = null, nota_atleta = null, pose = null, poster = null, duracion_seg = null, fecha = null, alProgreso = null, senal = null, ruta: rutaDada = null, nombre = null, paginas = null, onda = null,
      serie_numero = null, repite_de = null, urlSubida = null, alUrlSubida = null, derivado_de = null, autoevaluacion = null, angulo_de = null, fps_captura = null }) {
      if (archivo.size > LIMITE_ARCHIVO_MB * 1024 * 1024) throw new Error(`El archivo pesa más de ${LIMITE_ARCHIVO_MB} MB. Graba solo la serie (unos 30 segundos) o recórtalo.`);
      const esImagen = /^image\//.test(archivo.type || '') || tipo === 'foto_progreso';
      const ruta = rutaDada || api.rutaArchivo(atletaId, archivo, { tipo, fecha });
      const dia = (/-(\d{4}-\d{2}-\d{2})-/.exec(ruta) || [])[1] || hoyISO();
      const poster_ruta = poster && !esImagen ? `${ruta}.jpg` : null;
      const dur = Number.isFinite(Number(duracion_seg)) && duracion_seg >= 0 ? Math.min(3600, Math.round(Number(duracion_seg))) : null;
      // Primero se registra (la base comprueba consentimiento, ruta y límite diario) y después se sube:
      // Storage solo acepta archivos ya registrados.
      let fila = rutaDada ? (await b.select('archivos', { eq: { ruta } }))[0] : null;
      const enlaces = tipo === 'video_tecnica' && (serie_numero || repite_de) && await api.video035()
        ? { ...(serie_numero && sesion_ejercicio_id && serieValida(Number(serie_numero)) ? { serie_numero: Number(serie_numero) } : {}), ...(repite_de ? { repite_de } : {}) } : {};
      // (v0.60, 038) el otro ángulo de la misma serie y el ritmo de la cámara lenta; sin la 038, el vídeo sale igual, sin ellos
      const extras038 = tipo === 'video_tecnica' && (angulo_de || fpsGuardado(fps_captura)) && (await api.video038()) !== false
        ? { ...(angulo_de ? { angulo_de } : {}), ...(fpsGuardado(fps_captura) ? { fps_captura: fpsGuardado(fps_captura) } : {}) } : {};
      if (!fila) {
        const registrar = (extras) => b.insert('archivos', [{
          atleta_id: atletaId, tipo, ruta, sesion_ejercicio_id, ejercicio_id, nota_atleta,
          mime: (tipo === 'audio' ? tipoAudio(archivo.type)?.tipo : archivo.type) || null, bytes: archivo.size ?? null, fecha: dia,
          ...(tipo === 'foto_progreso' && pose ? { pose } : {}),
          ...(poster_ruta ? { poster_ruta } : {}), ...(dur != null ? { duracion_seg: dur } : {}),
          ...(tipo === 'documento' ? { nombre: nombreSeguroPdf(nombre || archivo.name), ...(Number.isInteger(paginas) && paginas >= 1 && paginas <= 5000 ? { paginas } : {}) } : {}),
          ...(tipo === 'audio' && ondaValida(onda) ? { onda } : {}),
          ...enlaces, ...extras, ...(derivado_de && tipo === 'adjunto' ? { derivado_de } : {}),
        }]).catch(tipo === 'documento' ? falta033 : tipo === 'audio' ? falta034 : Object.keys(extras).length ? falta038 : Object.keys(enlaces).length || derivado_de ? falta035 : (e) => { throw e; });
        try { [fila] = await registrar(extras038); }
        catch (e) {
          // (v0.60, L4) Un envío que esperaba en el móvil y su otro ángulo ya no está (o ya tiene pareja): sale igual, sin el
          // enlace, y se dice (si no, cada reintento fallaría igual)
          const m = `${e?.message || ''} ${e?.codigo || e?.code || ''}`;
          if (!extras038.angulo_de || !/23503|23514|42501|foreign key|clave ajena|otro \u00e1ngulo|angulo/i.test(m)) throw e;
          const { angulo_de: _sin, ...resto } = extras038;
          [fila] = await registrar(resto);
          fila.anguloPerdido = true;
        }
      }
      try {
        if (senal?.cancelada) { const e = new Error('Cancelado'); e.cancelado = true; throw e; }
        await b.storage.subir(ruta, archivo, (tipo === 'audio' ? tipoAudio(archivo.type)?.tipo : archivo.type) || 'application/octet-stream', { alProgreso, senal, bucket: cuboDe(ruta, tipo), urlSubida, alUrlSubida });
      } catch (e) {
        // Sin cobertura, el registro se queda: el siguiente intento (con la misma ruta) lo reutiliza
        if (!e?.sinConexion) await b.delete('archivos', { eq: { id: fila.id } }).catch(() => {});
        e.ruta = ruta;
        throw e;
      }
      // La miniatura es un extra: si falla, el vídeo queda igualmente (la cuadrícula enseña el primer fotograma)
      if (poster_ruta) await b.storage.subir(poster_ruta, poster, 'image/jpeg').catch(async () => { await b.update('archivos', { poster_ruta: null }, { eq: { id: fila.id } }).catch(() => {}); fila.poster_ruta = null; });
      // (v0.59, 037) la valoración del atleta («¿Cómo la has notado?»), ya limpia; si no se puede guardar, el vídeo sale igual
      if (autoevaluacion && tipo === 'video_tecnica') {
        try { fila.autoevaluacion = await api.guardarAutoevaluacion(fila, autoevaluacion, { limpia: true }); } catch (e) { fila.autoevaluacionError = e?.message || String(e); }
      }
      return fila;
    },
    // Un envío pendiente que se descarta: su registro (si llegó a hacerse) no debe quedar sin archivo
    async descartarSubida(ruta) {
      if (ruta) await b.delete('archivos', { eq: { ruta } }).catch(() => {});
    },
    async urlArchivo(ruta, { tipo = null } = {}) { return b.storage.url(ruta, 3600, cuboDe(ruta, tipo)); },
    // (v0.54) Primero de Storage (mientras tiene su fila: el atleta solo puede borrar ahí lo que tiene fila y puede borrar)
    // y después la fila; lo que no se haya podido borrar de Storage queda en la cola (lo pone la base) y lo vacía el coach.
    // Devuelve 'borrado' | 'pendiente'.
    async borrarArchivo(archivo) {
      const rutas = [archivo.ruta, ...(archivo.poster_ruta ? [archivo.poster_ruta] : [])];
      let hechas = null;
      try { hechas = await b.storage.borrar(rutas, cuboDe(archivo.ruta, archivo.tipo)); } catch { hechas = null; }
      await b.delete('archivos', { eq: { id: archivo.id } });
      const coach = await api.esCoachAhora();
      if (coach) { if (hechas) await b.rpc('storage_borrado', { p_rutas: rutas }).catch(() => {}); api.limpiarAlmacenamiento().catch(() => {}); }
      return hechas ? 'borrado' : 'pendiente';
    },

    // ------------------------------------------------------------ v0.57: los vídeos de técnica (migración 035)
    // ¿Tiene la base la 035? (la serie, repetir, la corrección, las listas de puntos clave, «Visto» y la limpieza)
    async video035() {
      if (!api._v035) {
        api._v035 = b.select('video_revisiones', { limit: 1, cols: 'archivo_id' }).then(() => true, (e) => {
          const falta = /video_revisiones|schema cache|does not exist|no existe|relation|PGRST20/i.test(e?.message || '');
          if (!falta) api._v035 = null;
          return !falta;
        });
      }
      return api._v035;
    },
    async exigir035() { if (!(await api.video035())) throw new Error(AVISO_035); },
    // (v0.58) ¿Tiene la base la 036? (guardar el análisis automático en la corrección). El atleta no lee la tabla, pero si
    // la columna existe la consulta no falla (le sale vacía). true, false o, si no se sabe (sin conexión, un error que no es
    // «falta la columna»), null: no se recuerda y se vuelve a mirar la próxima vez (revisión de seguridad v0.58).
    async video036() {
      if (!api._v036) {
        const pr = (async () => {
          if (!(await api.video035())) return false;
          try { await b.select('video_revisiones', { limit: 1, cols: 'analisis' }); return true; }
          catch (e) {
            const m = `${e?.message || ''} ${e?.codigo || e?.code || ''}`;
            if (/\banalisis\b/.test(m) && /schema cache|does not exist|no existe|could not find|column|columna|PGRST20[0-9]|42703/i.test(m)) return false;
            return null;
          }
        })();
        api._v036 = pr;
        pr.then((x) => { if (x == null && api._v036 === pr) api._v036 = null; });
      }
      return api._v036;
    },
    // El coach guarda en la corrección el análisis de un vídeo (o lo quita con null). Devuelve la corrección.
    async guardarAnalisis(video, analisis) {
      // (si no se sabe si está la 036, se intenta: el error que dé, el de verdad)
      if ((await api.video036()) === false) throw new Error(AVISO_036);
      const dur = Number.isFinite(video?.duracion_seg) ? video.duracion_seg : null;
      if (analisis != null && !analisisValido(analisis, dur)) throw new Error('El análisis no tiene la forma que toca (o se sale del vídeo)');
      await b.upsert('video_revisiones', [{ archivo_id: video.id, atleta_id: video.atleta_id, analisis: analisis ?? null }], 'archivo_id').catch(falta036);
      return api.revisionVideo(video.id);
    },
    // La corrección de varios vídeos y la serie que se ve en cada uno: { revisiones: { id: fila }, series: { id: { texto, kg, reps, rpe, numero } } }
    async extrasVideos(archivos) {
      const vids = (archivos || []).filter((a) => a.tipo === 'video_tecnica');
      if (!vids.length || !(await api.video035())) return { revisiones: {}, series: {} };
      const conSerie = vids.filter((a) => a.serie_numero && a.sesion_ejercicio_id);
      const [revs, series] = await Promise.all([
        api.correccionesDe(vids.map((a) => a.id)).catch(() => []),
        conSerie.length ? b.select('series', { in: { sesion_ejercicio_id: unicos(conSerie.map((a) => a.sesion_ejercicio_id)) }, cols: 'sesion_ejercicio_id,numero,kg,reps,rpe' }).catch(() => []) : [],
      ]);
      const out = { revisiones: porCampo(revs, 'archivo_id'), series: {} };
      for (const a of conSerie) {
        const s = series.find((x) => x.sesion_ejercicio_id === a.sesion_ejercicio_id && Number(x.numero) === Number(a.serie_numero));
        out.series[a.id] = { numero: a.serie_numero, texto: s ? textoSerieVideo(s) : null, kg: s?.kg ?? null, reps: s?.reps ?? null, rpe: s?.rpe ?? null };
      }
      return out;
    },
    // La corrección de unos vídeos como la lee la app (la base: video_correcciones). Sin ninguna hora: de «Visto» y de
    // «Corregido», solo el día (visto_el, corregido_el). El atleta no puede leer la tabla (lleva las horas, del coach).
    async correccionesDe(ids) {
      const todos = unicos(ids || []);
      const out = [];
      for (let i = 0; i < todos.length; i += 1000) out.push(...((await b.rpc('video_correcciones', { p_archivos: todos.slice(i, i + 1000) })) || []));
      return out;
    },
    // La corrección de un vídeo (o null), con su voz ({ ruta, duracion_seg, onda }) si la lleva
    async revisionVideo(archivoId) {
      if (!archivoId || !(await api.video035())) return null;
      const [r] = await api.correccionesDe([archivoId]).catch(() => []);
      if (!r) return null;
      const [voz] = r.voz_archivo_id ? await b.select('archivos', { eq: { id: r.voz_archivo_id }, cols: 'id,ruta,duracion_seg,onda,tipo' }).catch(() => []) : [];
      return { ...r, voz: voz || null };
    },
    // El coach: la nota (1-5), los puntos clave revisados y el tempo (lo que venga; null lo quita). Devuelve la corrección.
    async guardarRevision(video, { puntuacion, checklist, tempo } = {}) {
      await api.exigir035();
      const fila = { archivo_id: video.id, atleta_id: video.atleta_id };
      if (puntuacion !== undefined) { if (!puntuacionValida(puntuacion)) throw new Error('La nota de técnica va de 1 a 5'); fila.puntuacion = puntuacion; }
      if (checklist !== undefined) {
        const c = Array.isArray(checklist) ? limpiarChecklist(checklist) : checklist;
        if (c != null && !checklistValido(c)) throw new Error('Los puntos clave no tienen la forma que toca');
        fila.checklist = c;
      }
      if (tempo !== undefined) {
        if (tempo != null && !tempoValido(tempo, Number.isFinite(video.duracion_seg) ? video.duracion_seg : null)) throw new Error('El tempo tiene que ir en orden y dentro del vídeo');
        fila.tempo = tempo;
      }
      await b.upsert('video_revisiones', [fila], 'archivo_id').catch(falta035);
      return api.revisionVideo(video.id);
    },
    // «Visto por tu coach»: al abrir el vídeo (solo el coach; el día, nunca la hora). Sin la 035, nada.
    async marcarVideoVisto(archivoId) {
      if (!archivoId || !(await api.video035()) || !(await api.esCoachAhora())) return null;
      try { return await b.rpc('video_visto', { p_archivo: archivoId }); } catch { return null; }
    },
    // La voz del coach sobre el vídeo (una nota de voz de hasta un minuto, en el bucket «voz»): empieza en «inicio» (s del
    // vídeo). Si ya había una, la base retira la de antes. Devuelve la corrección.
    async guardarVozVideo(video, audio, { inicio = 0, seg, onda = null } = {}) {
      await api.exigir035();
      if (!tipoAudio(audio?.type)) throw new Error('Ese audio no se puede enviar');
      if (audio.size > MAX_VOZ_BYTES) throw new Error('La voz pesa demasiado (más de 3 MB)');
      const archivo = audio instanceof File ? audio : new File([audio], `voz.${tipoAudio(audio.type).ext}`, { type: audio.type });
      const fila = await api.subirArchivo(video.atleta_id, archivo, { tipo: 'audio', duracion_seg: duracionGuardada(seg), onda: ondaValida(onda) ? onda : null });
      try {
        await b.upsert('video_revisiones', [{ archivo_id: video.id, atleta_id: video.atleta_id, voz_archivo_id: fila.id, voz_inicio: Math.round(Math.max(0, Number(inicio) || 0) * 100) / 100 }], 'archivo_id').catch(falta035);
      } catch (e) { await api.borrarArchivo(fila).catch(() => {}); throw e; }
      api.limpiarAlmacenamiento().catch(() => {});
      return api.revisionVideo(video.id);
    },
    async quitarVozVideo(video) {
      await api.exigir035();
      await b.update('video_revisiones', { voz_archivo_id: null }, { eq: { archivo_id: video.id } }).catch(falta035);
      api.limpiarAlmacenamiento().catch(() => {});
      return api.revisionVideo(video.id);
    },
    // Las listas de puntos clave de cada ejercicio (solo el coach). null si no tiene (o sin la 035)
    async plantillaTecnica(ejercicioId) {
      if (!ejercicioId || !(await api.video035())) return null;
      const [x] = await b.select('tecnica_plantillas', { eq: { ejercicio_id: ejercicioId } }).catch(() => []);
      return x?.puntos || null;
    },
    async guardarPlantillaTecnica(ejercicioId, puntos) {
      await api.exigir035();
      const ps = limpiarPlantilla(puntos);
      if (!plantillaValida(ps)) throw new Error('Una lista lleva de 1 a 15 puntos, de hasta 120 letras');
      await b.upsert('tecnica_plantillas', [{ ejercicio_id: ejercicioId, puntos: ps }], 'ejercicio_id').catch(falta035);
      return ps;
    },
    async borrarPlantillaTecnica(ejercicioId) {
      await api.exigir035();
      await b.delete('tecnica_plantillas', { eq: { ejercicio_id: ejercicioId } }).catch(falta035);
    },
    // Un archivo por su id (el original de una repetición) y las repeticiones de un vídeo
    async archivo(id) { if (!id) return null; const [a] = await b.select('archivos', { eq: { id } }).catch(() => []); return a || null; },
    async repeticionesDe(id) {
      if (!id || !(await api.video035())) return [];
      return b.select('archivos', { eq: { repite_de: id }, order: [['creado_en', 'asc']] }).catch(() => []);
    },
    // «Mi técnica»: los vídeos de un atleta por ejercicio, con sus notas
    async miTecnica(atletaId) {
      return tecnicaPorEjercicio((await api.diario(atletaId)).filter((a) => a.tipo === 'video_tecnica'));
    },
    // Un vídeo de técnica con lo que hace falta para verlo solo (el enlace de un aviso): ejercicio, serie, corrección
    async videoTecnica(archivoId) {
      const [a] = await b.select('archivos', { eq: { id: archivoId } }).catch(() => []);
      if (!a || a.tipo !== 'video_tecnica') return null;
      const lista = await api.diario(a.atleta_id).catch(() => []);
      return lista.find((x) => x.id === a.id) || { ...a, ejercicio: null, revision: null, serie: null, estado: estadoVideo({}) };
    },
    // Limpieza (el coach): lo que se borraría ({ n, bytes, lista: [{ id, atleta, fecha, bytes }] }) y borrarlo
    async limpiezaVideos({ meses, dias = 30 }) {
      await api.exigir035();
      const r = await b.rpc('videos_limpieza', { p_meses: meses, p_dias: dias }).catch(falta035);
      const A = porId(await api.atletas().catch(() => []));
      const lista = (r?.lista || []).map((x) => ({ ...x, atleta: A[x.atleta_id] || null }));
      // La base enseña (y borra) como mucho 300 de una vez, los más antiguos: lo que se borra ahora es «lote»
      return { n: Number(r?.n) || 0, bytes: Number(r?.bytes) || 0, lista, lote: { n: lista.length, bytes: lista.reduce((t, x) => t + (Number(x.bytes) || 0), 0) } };
    },
    async borrarVideosViejos({ meses, dias = 30, ids }) {
      await api.exigir035();
      let n = 0, bytes = 0;
      for (let i = 0; i < ids.length; i += 300) {
        const r = await b.rpc('videos_limpiar', { p_meses: meses, p_dias: dias, p_ids: ids.slice(i, i + 300) }).catch(falta035);
        n += Number(r?.n) || 0; bytes += Number(r?.bytes) || 0;
      }
      const quitados = await api.limpiarAlmacenamiento().catch(() => 0);
      return { n, bytes, almacenamiento: quitados >= 0 ? 'borrado' : 'pendiente' };
    },
    // Un fotograma de un vídeo con su dibujo, como foto en el chat de ese atleta. Lleva de qué vídeo sale (derivado_de, que
    // comprueba la base): es solo de ese atleta, como su vídeo; ni se reenvía ni se difunde. Sin la 035, no se manda.
    async enviarFotograma(video, blob, { texto = '' } = {}) {
      await api.exigir035();
      const f = new File([blob], `fotograma-${hoyISO()}.jpg`, { type: 'image/jpeg' });
      return api.enviarMensaje(video.atleta_id, { archivo: f, texto, autor: 'coach', derivado_de: video.id });
    },

    // ------------------------------------------------------------ v0.59: los vídeos de técnica, tanda A (migración 037)
    // ¿Tiene la base la 037? true, false o, si no se sabe (sin conexión), null: no se recuerda y se vuelve a mirar
    async video037() {
      if (!api._v037) {
        const pr = (async () => {
          try { await b.select('video_autoevaluacion', { limit: 1, cols: 'archivo_id' }); return true; }
          catch (e) {
            const m = `${e?.message || ''} ${e?.codigo || e?.code || ''}`;
            if (/video_autoevaluacion|schema cache|does not exist|no existe|relation|could not find|PGRST20[0-9]|42P01/i.test(m)) return false;
            return null;
          }
        })();
        api._v037 = pr;
        pr.then((x) => { if (x == null && api._v037 === pr) api._v037 = null; });
      }
      return api._v037;
    },
    async exigir037() { if ((await api.video037()) === false) throw new Error(AVISO_037); },

    // 14. Recordatorios de técnica: los activos de un atleta (el atleta, los suyos; sin horas) y, para el coach, todos
    async recordatoriosActivos(atletaId) {
      if (!atletaId || !(await api.video037())) return [];
      return (await b.rpc('recordatorios_activos', { p_atleta: atletaId }).catch(() => [])) || [];
    },
    async recordatoriosCoach(atletaId, ejercicioId = null) {
      if (!atletaId || !(await api.video037())) return [];
      return b.select('recordatorios_tecnica', { eq: { atleta_id: atletaId, ...(ejercicioId ? { ejercicio_id: ejercicioId } : {}) }, order: [['activo', 'desc'], ['creado_en', 'desc']] }).catch(() => []);
    },
    // El coach fija uno (hasta 140 letras; con su vídeo y su momento, si quiere). Como mucho 3 activos por ejercicio.
    async fijarRecordatorio({ atletaId, ejercicioId, texto, archivoId = null, segundo = null }) {
      await api.exigir037();
      const fila = { atleta_id: atletaId, ejercicio_id: ejercicioId, texto: limpiarTextoRecordatorio(texto), archivo_id: archivoId || null,
        segundo: archivoId && Number.isFinite(Number(segundo)) && segundo !== null ? Math.round(Math.min(3600, Math.max(0, Number(segundo))) * 10) / 10 : null, activo: true };
      if (!recordatorioValido(fila)) throw new Error('Un recordatorio lleva de 1 a 140 letras');
      return (await b.insert('recordatorios_tecnica', [fila]).catch(falta037))[0];
    },
    async editarRecordatorio(id, { texto, activo } = {}) {
      await api.exigir037();
      const c = {};
      if (texto !== undefined) { c.texto = limpiarTextoRecordatorio(texto); if (!textoRecordatorioValido(c.texto)) throw new Error('Un recordatorio lleva de 1 a 140 letras'); }
      if (activo !== undefined) c.activo = !!activo;
      return (await b.update('recordatorios_tecnica', c, { eq: { id } }).catch(falta037))[0] || null;
    },
    async borrarRecordatorio(id) { await api.exigir037(); await b.delete('recordatorios_tecnica', { eq: { id } }).catch(falta037); },
    // Lo que se propone fijar: los ✗ del último vídeo corregido de ese ejercicio (sin los que ya son recordatorios)
    async sugerenciasRecordatorio(atletaId, ejercicioId) {
      if (!atletaId || !ejercicioId) return [];
      const [videos, activos] = await Promise.all([api.diario(atletaId).catch(() => []), api.recordatoriosActivos(atletaId)]);
      return sugerenciasRecordatorio(videos, ejercicioId, activos.filter((r) => r.ejercicio_id === ejercicioId));
    },

    // 4. Frases de corrección (solo el coach): las de un ejercicio y las de todos
    async frasesCorreccion(ejercicioId = null) {
      if (!(await api.video037())) return [];
      const filas = await b.select('frases_correccion', { order: [['orden', 'asc'], ['creado_en', 'asc']] }).catch(() => []);
      return frasesPara(filas, ejercicioId);
    },
    async guardarFrase({ id = null, ejercicioId = null, texto, dibujo = null, orden = 0 }) {
      await api.exigir037();
      const fila = { ejercicio_id: ejercicioId || null, texto: limpiarTextoFrase(texto), dibujo: dibujo ?? null, orden: Number.isInteger(orden) ? Math.max(0, Math.min(999, orden)) : 0 };
      if (!fraseValida(fila)) throw new Error('Una frase lleva de 1 a 140 letras (y, si quieres, un dibujo)');
      if (id) return (await b.update('frases_correccion', { texto: fila.texto, dibujo: fila.dibujo, orden: fila.orden }, { eq: { id } }).catch(falta037))[0] || null;
      return (await b.insert('frases_correccion', [fila]).catch(falta037))[0];
    },
    async borrarFrase(id) { await api.exigir037(); await b.delete('frases_correccion', { eq: { id } }).catch(falta037); },
    // Las sugeridas de un ejercicio, a la base (para cambiarlas o borrarlas como las tuyas)
    async guardarFrasesSugeridas(ejercicio) {
      await api.exigir037();
      const ya = (await api.frasesCorreccion(ejercicio.id)).filter((f) => f.ejercicio_id === ejercicio.id).map((f) => f.texto);
      const nuevas = frasesSugeridas(ejercicio.nombre, ejercicio.grupos_musculares || [], ejercicio.tipo || []).filter((t) => !ya.includes(t));
      if (nuevas.length) await b.insert('frases_correccion', nuevas.map((texto, i) => ({ ejercicio_id: ejercicio.id, texto, dibujo: null, orden: ya.length + i }))).catch(falta037);
      return api.frasesCorreccion(ejercicio.id);
    },

    // 6. Vídeos modelo del coach: los de unos ejercicios (el coach y sus atletas; sin horas) y su enlace
    async videosModelo(ejercicioIds) {
      const ids = unicos(ejercicioIds || []);
      if (!ids.length || !(await api.video037())) return [];
      const out = [];
      for (let i = 0; i < ids.length; i += 200) out.push(...((await b.rpc('videos_modelo_de', { p_ejercicios: ids.slice(i, i + 200) }).catch(() => [])) || []));
      return out;
    },
    rutaModelo(ejercicioId, archivo) {
      const t = String(archivo?.type || '');
      const ext = /quicktime/.test(t) ? 'mov' : /webm/.test(t) ? 'webm' : 'mp4';
      return `modelos/${ejercicioId}/modelo-${aleatorio()}${aleatorio()}.${ext}`;
    },
    async urlModelo(m) { return b.storage.url(m.ruta, 3600, 'archivos'); },
    // Primero se registra (la base comprueba la ruta y que no haya más de 6) y después se sube; si la subida falla, el
    // registro se quita
    async subirVideoModelo(ejercicio, archivo, { angulo = null, poster = null, duracion_seg = null, alProgreso = null, senal = null } = {}) {
      await api.exigir037();
      if (!/^video\/(mp4|quicktime|webm)/.test(archivo?.type || '')) throw new Error('Elige un vídeo (MP4, MOV o WebM)');
      if (archivo.size > LIMITE_ARCHIVO_MB * 1024 * 1024) throw new Error(`El vídeo pesa más de ${LIMITE_ARCHIVO_MB} MB: recórtalo`);
      const ruta = api.rutaModelo(ejercicio.id, archivo);
      const dur = Number.isFinite(Number(duracion_seg)) && duracion_seg != null ? Math.min(600, Math.max(0, Math.round(Number(duracion_seg)))) : null;
      const actuales = await api.videosModelo([ejercicio.id]);
      const [fila] = await b.insert('videos_modelo', [{ ejercicio_id: ejercicio.id, ruta, poster_ruta: poster ? `${ruta}.jpg` : null, duracion_seg: dur,
        mime: String(archivo.type).split(';')[0], bytes: archivo.size, angulo: angulo ? limpiarTextoFrase(angulo).slice(0, 40) : null, orden: actuales.length }]).catch(falta037);
      try {
        await b.storage.subir(ruta, archivo, String(archivo.type).split(';')[0], { alProgreso, senal, bucket: 'archivos' });
      } catch (e) { await b.delete('videos_modelo', { eq: { id: fila.id } }).catch(() => {}); api.limpiarAlmacenamiento().catch(() => {}); throw e; }
      if (fila.poster_ruta) await b.storage.subir(fila.poster_ruta, poster, 'image/jpeg', { bucket: 'archivos' }).catch(async () => { await b.update('videos_modelo', { poster_ruta: null }, { eq: { id: fila.id } }).catch(() => {}); fila.poster_ruta = null; });
      return fila;
    },
    async editarVideoModelo(id, { angulo, orden } = {}) {
      await api.exigir037();
      const c = {};
      if (angulo !== undefined) c.angulo = angulo ? limpiarTextoFrase(angulo).slice(0, 40) : null;
      if (orden !== undefined) c.orden = orden;
      return (await b.update('videos_modelo', c, { eq: { id } }).catch(falta037))[0] || null;
    },
    // Al borrarlo, sus archivos van a la cola de Storage (la base) y la app del coach la vacía
    async borrarVideoModelo(m) {
      await api.exigir037();
      await b.delete('videos_modelo', { eq: { id: m.id } }).catch(falta037);
      const quitados = await api.limpiarAlmacenamiento().catch(() => 0);
      return quitados > 0 ? 'borrado' : 'pendiente';
    },

    // 7. «Comparar con su mejor»: de sus vídeos de ese ejercicio ya corregidos, el de mejor nota (después, la mejor
    // velocidad guardada; después, el más reciente). Por el diario (el atleta, solo los suyos)
    async mejorVideoDe(video) {
      if (!video?.atleta_id || video.tipo !== 'video_tecnica') return null;
      const lista = await api.diario(video.atleta_id).catch(() => []);
      const yo = lista.find((x) => x.id === video.id) || video;
      return mejorVideo(lista, { ...yo, ejercicio: yo.ejercicio || video.ejercicio || null });
    },

    // 12. La valoración del atleta antes de enviar un vídeo (la suya; el coach la lee)
    async autoevaluacion(archivoId) {
      if (!archivoId || !(await api.video037())) return null;
      const [x] = await b.select('video_autoevaluacion', { eq: { archivo_id: archivoId } }).catch(() => []);
      return x || null;
    },
    async autoevaluaciones(ids) {
      const todos = unicos(ids || []);
      if (!todos.length || !(await api.video037())) return {};
      return porCampo(await b.select('video_autoevaluacion', { in: { archivo_id: todos } }).catch(() => []), 'archivo_id');
    },
    // datos: { rpe, nota, molestia, zona } (lo de la molestia, solo con salud: si no, se quita aquí y la base lo exige).
    // Sin nada que contar, se quita. Devuelve la guardada (o null).
    async guardarAutoevaluacion(archivo, datos, { salud = false, limpia = false } = {}) {
      await api.exigir037();
      const f = limpia ? datos : limpiarAutoevaluacion(datos || {}, { salud });
      if (!f) { await b.delete('video_autoevaluacion', { eq: { archivo_id: archivo.id } }).catch(falta037); return null; }
      if (!autoevaluacionValida(f)) throw new Error('La valoración no tiene la forma que toca');
      return (await b.upsert('video_autoevaluacion', [{ archivo_id: archivo.id, atleta_id: archivo.atleta_id, ...f }], 'archivo_id').catch(falta037))[0] || null;
    },

    // 15. Las marcas de repetición a mano (el coach; en la corrección): [segundos] o []
    async repsManual(archivoId) {
      if (!archivoId || !(await api.video037()) || !(await api.esCoachAhora())) return [];
      const [x] = await b.select('video_revisiones', { eq: { archivo_id: archivoId }, cols: 'archivo_id,reps_manual' }).catch(() => []);
      return x?.reps_manual?.t || [];
    },
    async guardarRepsManual(video, lista) {
      await api.exigir037();
      const t = [...(lista || [])].filter((x) => Number.isFinite(x)).map((x) => Math.round(x * 100) / 100).sort((a, b2) => a - b2);
      const reps = t.length ? { t } : null;
      if (reps && !repsManualValidas(reps, Number.isFinite(video?.duracion_seg) ? video.duracion_seg : null)) throw new Error('Las marcas tienen que ir en orden y dentro del vídeo (como mucho 30)');
      await b.upsert('video_revisiones', [{ archivo_id: video.id, atleta_id: video.atleta_id, reps_manual: reps }], 'archivo_id').catch(falta037);
      return t;
    },

    // ------------------------------------------------------------ v0.60: los vídeos de técnica, tanda B (migración 038)
    // ¿Tiene la base la 038? true, false o, si no se sabe (sin conexión), null: no se recuerda y se vuelve a mirar
    async video038() {
      if (!api._v038) {
        const pr = (async () => {
          try { await b.select('comentarios', { limit: 1, cols: 'id,video_respuesta_id' }); return true; }
          catch (e) {
            const m = `${e?.message || ''} ${e?.codigo || e?.code || ''}`;
            if (/video_respuesta_id|schema cache|does not exist|no existe|could not find|column|columna|PGRST20[0-9]|42703/i.test(m)) return false;
            return null;
          }
        })();
        api._v038 = pr;
        pr.then((x) => { if (x == null && api._v038 === pr) api._v038 = null; });
      }
      return api._v038;
    },
    async exigir038() { if ((await api.video038()) === false) throw new Error(AVISO_038); },

    // 1 y 2. Una respuesta en vídeo en el hilo de un vídeo de técnica: «Grabar la revisión» del coach (hasta 3 min) o la
    // cámara de delante (hasta 1 min, el coach o el atleta). Se sube como un archivo del chat (con sus reglas) y se manda en
    // el hilo; si el mensaje no sale, el vídeo se retira. senal/alProgreso, como al subir cualquier archivo.
    async responderConVideo(video, blob, { autor, seg, texto = '', poster = null, alProgreso = null, senal = null } = {}) {
      await api.exigir038();
      const quien = autor === 'coach' ? 'coach' : 'atleta';
      const tipo = tipoBase(blob?.type);
      if (!tipoRespuestaValido(tipo)) throw new Error('Ese vídeo no se puede enviar (tiene que ser MP4 o WebM)');
      if (!(blob.size > 0)) throw new Error('El vídeo ha salido vacío: grábalo otra vez');
      if (blob.size > MAX_BYTES_RESPUESTA) throw new Error('El vídeo pesa demasiado (más de 100 MB)');
      if (!(Number(seg) > 0) || Number(seg) > MAX_SEG_RESPUESTA[quien] + 0.5) throw new Error(quien === 'coach' ? 'Como mucho 3 minutos' : 'Como mucho un minuto');
      const f = blob instanceof File && blob.type === tipo ? blob : new File([blob], `respuesta.${tipo === 'video/webm' ? 'webm' : 'mp4'}`, { type: tipo });
      const fila = await api.subirArchivo(video.atleta_id, f, { tipo: 'adjunto', duracion_seg: duracionRespuesta(seg, quien), poster, alProgreso, senal });
      if (senal?.cancelada) { await api.borrarArchivo(fila).catch(() => {}); const e = new Error('Cancelado'); e.cancelado = true; throw e; }
      try {
        return await api.comentar({ atletaId: video.atleta_id, archivoId: video.id, texto: String(texto || '').trim() || (quien === 'coach' && seg > 61 ? 'Revisión grabada' : 'Vídeo'), autor: quien, videoRespuestaId: fila.id });
      } catch (e) { await api.borrarArchivo(fila).catch(() => {}); throw e; }
    },
    // Los vídeos de las respuestas de un hilo: { comentarioId: archivo }
    async videosDeRespuestas(comentarios) {
      const ids = unicos((comentarios || []).map((c) => c.video_respuesta_id));
      if (!ids.length) return {};
      const A = porId(await b.select('archivos', { in: { id: ids } }).catch(() => []));
      return Object.fromEntries((comentarios || []).filter((c) => c.video_respuesta_id && A[c.video_respuesta_id]).map((c) => [c.id, A[c.video_respuesta_id]]));
    },

    // 9. Dos ángulos de la misma serie: enlazar uno con otro (o quitarlo), la pareja de un vídeo y el desfase (el coach, en
    // la corrección; el atleta lo lee con ella)
    async enlazarAngulo(video, otroId) {
      await api.exigir038();
      if (!otroId || otroId === video.id) throw new Error('Elige otro vídeo');
      return (await b.update('archivos', { angulo_de: otroId }, { eq: { id: video.id } }).catch(falta038))[0] || null;
    },
    async desenlazarAngulo(video) {
      await api.exigir038();
      const pareja = await api.parejaAngulo(video);
      const fila = video.angulo_de ? video : pareja?.angulo_de === video.id ? pareja : null;
      if (fila) await b.update('archivos', { angulo_de: null }, { eq: { id: fila.id } }).catch(falta038);
      return true;
    },
    async parejaAngulo(video) {
      if (!video?.id || (await api.video038()) === false) return null;
      const filas = await b.select('archivos', { eq: { angulo_de: video.id }, limit: 1 }).catch(() => []);
      if (filas[0]) return filas[0];
      const [yo] = await b.select('archivos', { eq: { id: video.id }, cols: 'id,angulo_de' }).catch(() => []);
      return yo?.angulo_de ? api.archivo(yo.angulo_de) : null;
    },
    // Los vídeos de técnica del atleta que pueden ser su otro ángulo (sin pareja; los de esa misma serie, primero)
    async candidatosAngulo(video) {
      const todos = (await b.select('archivos', { eq: { atleta_id: video.atleta_id, tipo: 'video_tecnica' }, order: [['fecha', 'desc'], ['creado_en', 'desc']], limit: 60 }).catch(() => []));
      const enlazados = new Set(todos.flatMap((a) => (a.angulo_de ? [a.id, a.angulo_de] : [])));
      const misma = (a) => !!video.sesion_ejercicio_id && a.sesion_ejercicio_id === video.sesion_ejercicio_id && (a.serie_numero ?? null) === (video.serie_numero ?? null);
      return todos.filter((a) => a.id !== video.id && !enlazados.has(a.id)).sort((a, b2) => Number(misma(b2)) - Number(misma(a)));
    },
    async guardarDesfase(video, otroId, desfase) {
      await api.exigir038();
      const j = otroId == null ? null : { con: otroId, desfase: limitarDesfase(desfase) };
      if (j && !dosAngulosValido(j)) throw new Error('El desfase va de −2 a +2 segundos');
      await b.upsert('video_revisiones', [{ archivo_id: video.id, atleta_id: video.atleta_id, dos_angulos: j }], 'archivo_id').catch(falta038);
      return j;
    },

    // ------------------------------------------------------------ v0.61: los vídeos de técnica, tanda B (segunda mitad)
    // 5. «Revisar la sesión»: lo que hace falta para revisar los vídeos de una sesión seguidos (la sesión, sus ejercicios
    // en orden con sus series y si ya se le mandó el resumen) y mandarle ese resumen, una vez, en el hilo de la sesión
    // (avisa una vez, sin el texto, como cualquier respuesta del coach en una sesión)
    async sesionParaRevisar(sesionId) {
      const [s] = await b.select('sesiones', { eq: { id: sesionId }, cols: 'id,nombre,fecha_realizada,semana_id,completada' }).catch(() => []);
      if (!s) return null;
      const pautas = await b.select('sesion_ejercicios', { eq: { sesion_id: sesionId }, order: [['orden', 'asc']], cols: 'id,ejercicio_id,orden,series' }).catch(() => []);
      const [series, ejercicios, coment] = await Promise.all([
        pautas.length ? b.select('series', { in: { sesion_ejercicio_id: pautas.map((p) => p.id) }, order: [['numero', 'asc']], cols: 'sesion_ejercicio_id,numero,kg,reps,rpe,rir' }).catch(() => []) : [],
        pautas.length ? b.select('ejercicios', { in: { id: unicos(pautas.map((p) => p.ejercicio_id)) }, cols: 'id,nombre' }).catch(() => []) : [],
        api.resumenesDeSesion(sesionId),
      ]);
      const EJ = porId(ejercicios), S = agrupar(series, 'sesion_ejercicio_id');
      return { sesion: s, pautas: pautas.map((p) => ({ ...p, ejercicio: EJ[p.ejercicio_id] || null, hechas: S[p.id] || [] })), resumen: coment[0] || null };
    },
    // (revisión M2) El resumen de una sesión: con la 039, el que marca la base (uno por sesión, sin depender del texto); sin
    // ella, como antes, el comentario del coach en esa sesión que empieza por «Resumen de la sesión»
    async resumenesDeSesion(sesionId) {
      const marca = (await api.video039().catch(() => null)) === true;
      const filas = await b.select('comentarios', { eq: { sesion_id: sesionId, autor: 'coach', ...(marca ? { resumen_sesion: true } : {}) }, cols: `id,texto,autor,sesion_id,eliminado_en,creado_en${marca ? ',resumen_sesion' : ''}` }).catch(() => []);
      return filas.filter((c) => !c.eliminado_en && (marca ? c.resumen_sesion === true : esResumenSesion(c)));
    },
    async enviarResumenSesion({ atletaId, sesionId, texto }) {
      const t = limpiarResumen(texto);
      if (!t) throw new Error('Escribe el resumen (hasta 4000 letras)');
      const marca = (await api.video039().catch(() => null)) === true;
      if ((await api.resumenesDeSesion(sesionId)).length) throw new Error('Ya le has mandado el resumen de esta sesión: lo tiene en el hilo de la sesión');
      try {
        return await api.comentar({ atletaId, sesionId, texto: t, autor: 'coach', resumenSesion: marca });
      } catch (e) {
        if (duplicado(e) || /Ya le has mandado el resumen/.test(e?.message || '')) throw new Error('Ya le has mandado el resumen de esta sesión: lo tiene en el hilo de la sesión');
        throw e;
      }
    },

    // 16. El perfil carga–velocidad: la velocidad mínima de cada ejercicio (039; el coach la cambia, todos la leen sin
    // horas). Sin la 039, ninguna (la app usa la de serie de cada ejercicio). { ejercicio_id: m/s }
    async video039() {
      if (!api._v039) {
        const pr = (async () => {
          try { await b.select('umbrales_velocidad', { limit: 1, cols: 'ejercicio_id' }); return true; }
          catch (e) {
            const m = `${e?.message || ''} ${e?.codigo || e?.code || ''}`;
            if (/umbrales_velocidad|schema cache|does not exist|no existe|relation|could not find|PGRST20[0-9]|42P01/i.test(m)) return false;
            return null;
          }
        })();
        api._v039 = pr;
        pr.then((x) => { if (x == null && api._v039 === pr) api._v039 = null; });
      }
      return api._v039;
    },
    async exigir039() { if ((await api.video039()) === false) throw new Error(AVISO_039); },
    // ------------------------------------------------------------ v0.67: «Revisión semanal» (coach)
    // ¿Está la 040 (la tabla de las revisiones)? true / false / null (no se sabe: un corte)
    async revision040() {
      if (!api._v040) {
        const pr = (async () => {
          try { await b.select('revisiones_semanales', { limit: 1, cols: 'atleta_id' }); return true; }
          catch (e) {
            const m = `${e?.message || ''} ${e?.codigo || e?.code || ''}`;
            if (/revisiones_semanales|schema cache|does not exist|no existe|relation|could not find|PGRST20[0-9]|42P01/i.test(m)) return false;
            return null;
          }
        })();
        api._v040 = pr;
        pr.then((x) => { if (x == null && api._v040 === pr) api._v040 = null; });
      }
      return api._v040;
    },
    // Todos los atletas activos para la revisión de la semana (la del lunes de hoy): su resumen (foto, sesiones de la semana,
    // check-in, molestias), cuántos vídeos tiene sin revisar y cuántos mensajes sin leer, y la revisión de esta semana y la
    // nota de la anterior (con la 040; sin ella, revisiones: false)
    async revisionSemanal(hoy = fechaMadrid()) {
      const lunes = lunesDe(hoy), anterior = sumarDias(lunes, -7);
      const [resumenes, sinLeer, videos, con040] = await Promise.all([
        api.resumenes(hoy),
        b.select('comentarios', { eq: { autor: 'atleta' }, nulo: ['leido_en'], cols: 'atleta_id,eliminado_en' }).then((xs) => xs.filter((c) => !c.eliminado_en)).catch(() => []),
        // (054: antes buscaba el tipo «video», que no existe: los vídeos sin revisar nunca salían en la revisión)
        b.select('archivos', { eq: { tipo: 'video_tecnica' }, nulo: ['revisado_en'], cols: 'atleta_id' }).catch(() => []),
        api.revision040().catch(() => null),
      ]);
      const contar = (xs) => xs.reduce((m, x) => { m[x.atleta_id] = (m[x.atleta_id] || 0) + 1; return m; }, {});
      const L = contar(sinLeer), V = contar(videos);
      let revs = [];
      if (con040) revs = await b.select('revisiones_semanales', { in: { lunes: [lunes, anterior] } }).catch(() => []);
      const R = {};
      for (const r of revs) (R[r.atleta_id] ||= {})[r.lunes] = r;
      const filas = resumenes.filter((r) => r.estado !== 'baja').map((r) => {
        const esta = R[r.atleta_id]?.[lunes] || null, pasada = R[r.atleta_id]?.[anterior] || null;
        return {
          atleta_id: r.atleta_id, nombre: r.nombre, foto: r.foto, estado: r.estado, servicio: r.servicio,
          sesiones: r.sesiones || { completadas: 0, total: 0 },
          checkin: !!(r.checkin && r.checkin.semana >= anterior),
          molestia: r.maxMolestia || 0,
          videos: V[r.atleta_id] || 0,
          mensajes: L[r.atleta_id] || 0,
          peso: r.peso || null, ultimaSesion: r.ultimaSesion || null, alertas: r.alertas || [],
          hecha: !!esta?.hecha, nota: esta?.nota || '', notaAnterior: pasada?.nota || '',
        };
      });
      return { lunes, revisiones: con040 === true, filas };
    },
    async marcarRevision(atletaId, lunes, cambios) {
      if ((await api.revision040()) === false) throw new Error('Para guardar la revisión semanal falta ejecutar la migración 040 en Supabase (supabase/migraciones/040_revision_semanal.sql).');
      const fila = { atleta_id: atletaId, lunes };
      if ('hecha' in cambios) fila.hecha = !!cambios.hecha;
      if ('nota' in cambios) {
        const nota = String(cambios.nota ?? '').trim();
        if ([...nota].length > 500) throw new Error('La nota, como mucho 500 caracteres');
        fila.nota = nota || null;
      }
      return (await b.upsert('revisiones_semanales', [fila], 'atleta_id,lunes'))[0];
    },
    async umbralesVelocidad(ejercicioIds = []) {
      const ids = unicos((ejercicioIds || []).filter(Boolean)).slice(0, 200);
      if (!ids.length || !(await api.video039())) return {};
      const filas = (await b.rpc('umbrales_velocidad_de', { p_ejercicios: ids }).catch(() => [])) || [];
      return Object.fromEntries(filas.filter((x) => umbralValido(Number(x.vmin))).map((x) => [x.ejercicio_id, Number(x.vmin)]));
    },
    // El coach la cambia (null: vuelve a la de serie)
    async guardarUmbralVelocidad(ejercicioId, vmin) {
      await api.exigir039();
      if (!ejercicioId) throw new Error('Falta el ejercicio');
      if (vmin == null) { await b.delete('umbrales_velocidad', { eq: { ejercicio_id: ejercicioId } }).catch(falta039); return null; }
      const v = Number(vmin);
      if (!umbralValido(v)) throw new Error('La velocidad mínima va de 0,05 a 1 m/s (con 3 decimales como mucho)');
      const [f] = await b.upsert('umbrales_velocidad', [{ ejercicio_id: ejercicioId, vmin: v }], 'ejercicio_id').catch(falta039);
      return f ? Number(f.vmin) : v;
    },
    // Lo que hace falta para el perfil de un ejercicio: la velocidad mínima propia (si la hay) y sus series (para comparar
    // con el 1RM por repeticiones y RPE)
    async datosPerfilVelocidad(atletaId, ejercicioId) {
      const [umbrales, hist] = await Promise.all([
        api.umbralesVelocidad([ejercicioId]).catch(() => ({})),
        api.historialEjercicio(atletaId, ejercicioId).catch(() => ({ series: [] })),
      ]);
      return { umbrales, series: hist.series || [], con039: (await api.video039().catch(() => null)) !== false };
    },

    // 17. El informe del mes (en el móvil, con lo que ya hay) y mandárselo al atleta: un mensaje del chat que la app enseña
    // como una tarjeta («Tu informe de técnica de octubre de 2026», con «Ver el informe»); avisa una vez, sin el texto
    async informeTecnica(atletaId, mes) {
      if (!mesValido(mes)) throw new Error('Ese mes no vale');
      const videos = (await api.diario(atletaId)).filter((a) => a.tipo === 'video_tecnica');
      const ejIds = unicos(videos.map((v) => v.ejercicio?.id).filter(Boolean));
      const [recordatorios, umbrales] = await Promise.all([api.recordatoriosActivos(atletaId).catch(() => []), api.umbralesVelocidad(ejIds).catch(() => ({}))]);
      return { informe: informeMes(videos, { mes, recordatorios, umbrales }), videos };
    },
    async informeEnviado(atletaId, mes) {
      const t = textoTarjetaInforme(mes);
      if (!t) return false;
      const filas = await b.select('comentarios', { eq: { atleta_id: atletaId, autor: 'coach', texto: t }, cols: 'id,texto,autor,atleta_id,sesion_id,checkin_id,archivo_id,adjunto,eliminado_en' }).catch(() => []);
      return filas.some((c) => leerTarjetaInforme(c) === mes);
    },
    async enviarInformeTecnica(atletaId, mes) {
      const t = textoTarjetaInforme(mes);
      if (!t) throw new Error('Ese mes no vale');
      if (await api.informeEnviado(atletaId, mes)) throw new Error(`Ya le has mandado el informe de ${textoMes(mes)}: lo tiene en el chat`);
      return api.comentar({ atletaId, texto: t, autor: 'coach' });
    },

    // 18. Los tiempos de la cola (el coach): de lo que llega a lo primero entre «Revisado» (o una respuesta) y la
    // corrección. Los de los últimos 30 días, los de esta semana y el que más espera.
    async estadisticasRevision({ ahora = Date.now() } = {}) {
      const desde = new Date(ahora - 120 * 864e5).toISOString();
      const atletas = porId(await api.atletas().catch(() => []));
      const [recientes, pendientes] = await Promise.all([
        b.select('archivos', { eq: { tipo: 'video_tecnica' }, gte: { creado_en: desde }, cols: 'id,atleta_id,creado_en,revisado_en' }).catch(() => []),
        b.select('archivos', { eq: { tipo: 'video_tecnica' }, nulo: ['revisado_en'], cols: 'id,atleta_id,creado_en,revisado_en' }).catch(() => []),
      ]);
      const vids = Object.values(porId([...recientes, ...pendientes])).filter((v) => atletas[v.atleta_id]);
      const revs = (await api.video035().catch(() => false)) && vids.length
        ? porCampo((await Promise.all(Array.from({ length: Math.ceil(vids.length / 200) }, (_, i) => b.select('video_revisiones', { in: { archivo_id: vids.slice(i * 200, i * 200 + 200).map((v) => v.id) }, cols: 'archivo_id,corregido_en' }).catch(() => [])))).flat(), 'archivo_id') : {};
      return estadisticasCola(vids.map((v) => ({ ...v, corregido_en: revs[v.id]?.corregido_en || null })), { ahora });
    },

    // ------------------------------------------------------------ v0.48: lo que le dijo el coach de cada ejercicio
    // De vídeos de técnica de ese ejercicio y de los comentarios del coach en sesiones anteriores que lo nombran
    // (en una sesión en que lo hizo). { ejercicio_id: { lista: [{ texto, fecha, donde, archivoId|sesionId }], total } }
    async dichoPorCoach(atletaId, ejercicioIds, excluirSesionId = null, ejerciciosPorId = {}) {
      if (!ejercicioIds?.length) return {};
      const coment = await b.select('comentarios', { eq: { atleta_id: atletaId, autor: 'coach' }, order: [['creado_en', 'desc']], limit: 300, cols: 'id,texto,creado_en,sesion_id,archivo_id,enviar_en' });
      const delCoach = coment.filter((c) => !programado(c) && c.texto !== 'Se eliminó este mensaje');
      if (!delCoach.length) return {};
      const arcIds = unicos(delCoach.map((c) => c.archivo_id));
      const sesIds = unicos(delCoach.map((c) => c.sesion_id)).filter((id) => id !== excluirSesionId);
      const [archivos, pautasSes, sesiones] = await Promise.all([
        arcIds.length ? b.select('archivos', { in: { id: arcIds }, cols: 'id,tipo,ejercicio_id,sesion_ejercicio_id,fecha' }) : [],
        sesIds.length ? b.select('sesion_ejercicios', { in: { sesion_id: sesIds }, cols: 'id,sesion_id,ejercicio_id' }) : [],
        sesIds.length ? b.select('sesiones', { in: { id: sesIds }, cols: 'id,nombre,fecha_realizada' }) : [],
      ]);
      // El ejercicio de cada vídeo (el suyo o el de la pauta con que se subió)
      const pautaVid = unicos(archivos.filter((a) => !a.ejercicio_id && a.sesion_ejercicio_id).map((a) => a.sesion_ejercicio_id));
      const pv = pautaVid.length ? porId(await b.select('sesion_ejercicios', { in: { id: pautaVid }, cols: 'id,ejercicio_id' })) : {};
      const A = porId(archivos), S = porId(sesiones), P = agrupar(pautasSes, 'sesion_id');
      // Faltan nombres (solo se pasan los de la sesión): se piden
      const sinNombre = ejercicioIds.filter((id) => !ejerciciosPorId[id]);
      const nombres = { ...ejerciciosPorId, ...(sinNombre.length ? porId(await b.select('ejercicios', { in: { id: sinNombre }, cols: 'id,nombre' })) : {}) };
      const out = {};
      const poner = (ej, x) => { if (!ejercicioIds.includes(ej)) return; (out[ej] ||= { lista: [], total: 0 }).lista.push(x); };
      for (const c of delCoach) {
        if (c.archivo_id) {
          const a = A[c.archivo_id];
          if (!a || a.tipo !== 'video_tecnica') continue;
          const ej = a.ejercicio_id || pv[a.sesion_ejercicio_id]?.ejercicio_id;
          if (ej) poner(ej, { texto: c.texto, fecha: fechaDe(c.creado_en), donde: `En tu vídeo del ${a.fecha ? a.fecha.slice(8, 10).replace(/^0/, '') + ' ' + ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][Number(a.fecha.slice(5, 7)) - 1] : ''}`.trim(), archivoId: a.id });
        } else if (c.sesion_id && S[c.sesion_id]) {
          // Que lo nombre: el nombre entero o, si en esa sesión es el único que empieza así, su primera palabra
          const texto = normalTexto(c.texto);
          const enSesion = unicos((P[c.sesion_id] || []).map((p) => p.ejercicio_id));
          for (const ej of enSesion) {
            const nombre = nombres[ej]?.nombre;
            if (!nombre) continue;
            const pal = palabrasMovimiento(nombre);
            const otros = enSesion.filter((x) => x !== ej).map((x) => palabrasMovimiento(nombres[x]?.nombre || ''));
            const corto = pal[0] && pal[0].length >= 5 && !otros.some((o) => o[0] === pal[0]) ? pal[0] : pal.slice(0, 2).join(' ');
            const n = normalTexto(nombre).replace(/\s*\(.*?\)\s*/g, ' ').trim();
            if (texto.includes(n) || (corto && new RegExp(`(^|[^a-z0-9])${corto}`).test(texto))) {
              poner(ej, { texto: c.texto, fecha: S[c.sesion_id].fecha_realizada || fechaDe(c.creado_en), donde: `En ${S[c.sesion_id].nombre}`, sesionId: c.sesion_id });
            }
          }
        }
      }
      for (const x of Object.values(out)) { x.total = x.lista.length; x.lista = x.lista.slice(0, 3); }
      return out;
    },

    // ------------------------------------------------------------ tareas puntuales (v0.48, migración 030)
    // Las de un atleta, de la más reciente a la más antigua (sin la 030, ninguna)
    async tareas(atletaId) {
      return b.select('tareas', { eq: { atleta_id: atletaId }, order: [['fecha', 'desc'], ['creada_en', 'desc']], limit: 200 }).catch(() => []);
    },
    // El coach pone (o corrige) una tarea
    async ponerTarea(atletaId, datos, id = null) {
      const fila = limpiarTarea(datos);
      if (id) return (await b.update('tareas', fila, { eq: { id } }).catch(falta030))[0];
      return (await b.insert('tareas', [{ atleta_id: atletaId, ...fila }]).catch(falta030))[0];
    },
    async borrarTarea(id) { return b.delete('tareas', { eq: { id } }); },
    // El atleta la marca hecha (con su respuesta, y la foto o el vídeo con que la hizo), o lo deshace
    async completarTarea(id, { hecha = true, respuesta = null, archivoId = null } = {}) {
      return b.rpc('tarea_completar', { p_tarea: id, p_hecha: !!hecha, p_respuesta: hecha ? limpiarRespuesta(respuesta) : null, p_archivo: hecha ? archivoId : null }).catch(falta030);
    },
    async plantillasTareas() {
      return b.select('tareas_plantillas', { order: [['orden', 'asc'], ['creada_en', 'asc']] }).catch(() => []);
    },
    async guardarPlantillaTarea(datos) {
      const { fecha, ...fila } = limpiarTarea({ ...datos, fecha: hoyISO() });
      return (await b.insert('tareas_plantillas', [fila]).catch(falta030))[0];
    },
    async borrarPlantillaTarea(id) { return b.delete('tareas_plantillas', { eq: { id } }); },

    // ------------------------------------------------------------ comparar dos check-ins (v0.48)
    async compararCheckins(atletaId, idA, idB) {
      const [checkins, pesos, medidas, molestias, preguntas, fotos] = await Promise.all([
        b.select('checkins', { in: { id: [idA, idB] } }),
        b.select('pesos', { eq: { atleta_id: atletaId }, order: [['fecha', 'asc']] }).catch(() => []),
        b.select('medidas', { eq: { atleta_id: atletaId }, order: [['fecha', 'asc']] }).catch(() => []),
        b.select('molestias', { eq: { atleta_id: atletaId } }).catch(() => []),
        api.preguntasCheckin(atletaId, { archivadas: true }).catch(() => []),
        b.select('archivos', { eq: { atleta_id: atletaId, tipo: 'foto_progreso' }, order: [['fecha', 'asc']] }).catch(() => []),
      ]);
      const a = checkins.find((c) => c.id === idA), c2 = checkins.find((c) => c.id === idB);
      if (!a || !c2) throw new Error('No se encuentran esos check-ins');
      return compararCheckins(a, c2, { pesos, medidas, molestias, preguntas: porId(preguntas), fotos });
    },

    // ------------------------------------------------------------ tu bloque entero (v0.48)
    // El bloque actual con todas sus semanas: las publicadas con sus sesiones y las que no, solo «por publicar»
    async tuBloque(atletaId, { bloqueId = null } = {}) {
      const p = await api.programa(atletaId, { bloqueId });
      if (!p.bloque) return null;
      const todas = await b.rpc('bloque_semanas', { p_bloque: p.bloque.id }).catch(() => null);
      const sesIds = Object.values(p.sesiones).flat().map((x) => x.id);
      const pautas = sesIds.length ? await b.select('sesion_ejercicios', { in: { sesion_id: sesIds }, cols: 'id,sesion_id,ejercicio_id,prioridad,carga_sugerida_kg,series_detalle,series' }) : [];
      const principales = pautas.filter((x) => x.prioridad === 'alta');
      const [series, ejercicios] = await Promise.all([
        principales.length ? b.select('series', { in: { sesion_ejercicio_id: principales.map((x) => x.id) }, cols: 'sesion_ejercicio_id,kg,reps,sustituto_id' }) : [],
        principales.length ? b.select('ejercicios', { in: { id: unicos(principales.map((x) => x.ejercicio_id)) }, cols: 'id,nombre' }).then(porId) : {},
      ]);
      return vistaBloque({ bloque: p.bloque, todas: Array.isArray(todas) ? todas : null, semanas: p.semanas, sesiones: p.sesiones, pautas: principales, series, ejercicios });
    },

    // ------------------------------------------------------------ tu mes (v0.48)
    // Lo que se necesita para resumir los meses, una sola vez
    async datosMes(atletaId, { salud = true, nutricion: conNut = true, desde = null, hoy = hoyISO() } = {}) {
      const [bloques, diasSemana] = await Promise.all([
        b.select('bloques', { eq: { atleta_id: atletaId, es_plantilla: false }, cols: COLS_BLOQUE }),
        diasSemanaDe(atletaId),
      ]);
      const todas = bloques.length ? await b.select('semanas', { in: { bloque_id: bloques.map((x) => x.id) }, eq: { programacion: 'programada' } }) : [];
      const semanas = semanasQueCuentan(todas, bloques);
      const L = Object.fromEntries(semanas.map((w) => [w.id, w.fecha_inicio ? lunesDe(w.fecha_inicio) : null]));
      const [sesiones, series, habitos, planes, registros] = await Promise.all([
        semanas.length ? b.select('sesiones', { in: { semana_id: semanas.map((x) => x.id) } }) : [],
        api.historial(atletaId),
        salud ? b.select('habitos', { eq: { atleta_id: atletaId } }).catch(() => []) : [],
        salud && conNut ? api.planesNutricion(atletaId).catch(() => []) : [],
        salud && conNut ? b.select('registros_nutricion', { eq: { atleta_id: atletaId }, ...(desde ? { gte: { fecha: desde } } : {}) }).catch(() => []) : [],
      ]);
      const regsHab = habitos.length ? await b.select('registros_habito', { in: { habito_id: habitos.map((h) => h.id) }, ...(desde ? { gte: { fecha: desde } } : {}) }).catch(() => []) : [];
      const RH = agrupar(regsHab, 'habito_id');
      return {
        series, sesiones: sesiones.map((x) => ({ ...x, semana_lunes: L[x.semana_id] })),
        habitos: habitos.map((h) => ({ habito: h, registros: RH[h.id] || [] })),
        nutricion: salud && conNut ? { planes, registros } : null,
        entrenos: new Set(sesiones.filter((x) => x.completada && x.fecha_realizada).map((x) => x.fecha_realizada)),
        // v0.53: con objetivo de días por semana, sus semanas naturales (las previstas, las completas y la racha del mes)
        ...(diasSemana ? { semanasNaturales: semanasObjetivo({ diasSemana, sesiones, semanas, hoy }) } : {}),
      };
    },
    async resumenMes(atletaId, mes = mesAnterior(), { salud = true, nutricion: conNut = true, entrenamiento = true } = {}) {
      const d = await api.datosMes(atletaId, { salud, nutricion: conNut, desde: `${mes}-01` });
      return resumenMes(d, mes, { salud, conNutricion: conNut, conEntrenamiento: entrenamiento });
    },
    // Los últimos meses acabados con algo (para Progreso y la ficha), del más reciente al más antiguo
    async resumenesMensuales(atletaId, { n = 6, salud = true, nutricion: conNut = true, entrenamiento = true } = {}) {
      const ultimo = mesAnterior();
      const d = await api.datosMes(atletaId, { salud, nutricion: conNut, desde: `${sumarMes(ultimo, -(n - 1))}-01` });
      return Array.from({ length: n }, (_, i) => resumenMes(d, sumarMes(ultimo, -i), { salud, conNutricion: conNut, conEntrenamiento: entrenamiento })).filter((r) => !r.vacio);
    },

    // ------------------------------------------------------------ panel de negocio (v0.48, solo el coach)
    async panelNegocio(hoy = hoyISO()) {
      const [atletas, acuerdos, pagos, resumenes] = await Promise.all([
        api.atletas(),
        b.select('cobros_atletas', {}).catch(falta020),
        b.select('pagos', {}).catch(falta020),
        api.resumenes(hoy).catch(() => []),
      ]);
      const activos = new Set(atletas.filter((a) => a.estado === 'activo').map((a) => a.id));
      const constancia = resumenes.filter((r) => activos.has(r.atleta_id) && r.cumplimiento?.sesiones?.total > 0).map((r) => r.cumplimiento.sesiones.pct);
      return panelNegocio({ atletas, acuerdos, pagos, constancia }, hoy);
    },

    // ------------------------------------------------------------ recursos
    async recursos() {
      return b.select('recursos', { order: [['orden', 'asc'], ['creado_en', 'asc']] });
    },

    // ------------------------------------------------------------ comunidad del equipo (v0.43, migración 027)
    // Si está abierta. Sin la 027 en la base, no existe (la pestaña no sale y nada falla).
    async comunidad() {
      try {
        const [a] = await b.select('comunidad_ajustes', { cols: 'activa' });
        return { disponible: true, activa: !!a?.activa };
      } catch { return { disponible: false, activa: false }; }
    },
    // El coach la abre o la cierra (Cuenta → Comunidad)
    async abrirComunidad(activa) {
      const r = await b.update('comunidad_ajustes', { activa: !!activa }, { eq: { id: true } }).catch(falta027);
      if (!r?.length) throw new Error('No se ha podido cambiar: solo el coach puede abrir o cerrar la comunidad.');
      return { disponible: true, activa: !!r[0].activa };
    },
    // La fila de quien ha entrado (null si nunca ha entrado; con salido_en si ha salido)
    async miembroComunidad() {
      const id = uid();
      if (!id) return null;
      return (await b.select('comunidad_miembros', { eq: { perfil_id: id } }).catch(() => []))[0] || null;
    },
    // Los que han entrado (el coach: para Cuenta)
    async miembrosComunidad() {
      return b.select('comunidad_miembros', { order: [['nombre', 'asc']] }).catch(() => []);
    },
    // Entrar (o volver, o aceptar lo nuevo) con el texto y las normas vigentes (v0.44). Sin la migración 028 en la
    // base, la función aún no recibe las normas: se entra como en la v0.43 (la app las enseña igual antes de entrar)
    async entrarComunidad(nombre) {
      const p = { p_nombre: limpiarNombre(nombre), p_version: VERSION_COMUNIDAD };
      await b.rpc('comunidad_unirme', { ...p, p_normas: VERSION_NORMAS }).catch(async (e) => {
        // (v0.47) La base aún con el texto de antes: falta la 029
        if (/no es el vigente/.test(e?.message || '')) {
          const enLaBase = await b.rpc('comunidad_version', {}).catch(() => null);
          if (enLaBase && enLaBase !== VERSION_COMUNIDAD) throw new Error('Para entrar con lo que se comparte ahora falta ejecutar la migración 029 en Supabase (supabase/migraciones/029_comunidad_mejoras.sql).');
        }
        if (!sinNormas(e)) throw e;
        return b.rpc('comunidad_unirme', p).catch(falta027);
      });
      return api.miembroComunidad();
    },
    // ¿Está dentro de verdad? (sin haber salido ni haber sido sacado, con el texto y las normas vigentes)
    dentroDeComunidad(m) {
      return !!m && !m.salido_en && !m.bloqueado && m.version === VERSION_COMUNIDAD && !api.faltanNormas(m);
    },
    // ¿Le faltan por leer las normas vigentes? (sin la migración 028 no hay columna: entonces, no)
    faltanNormas(miembro) {
      return !!miembro && 'normas_version' in miembro && miembro.normas_version !== VERSION_NORMAS;
    },
    // Salir: lo suyo deja de verse; con borrar, además se borra (y sus fotos de Storage)
    async salirComunidad({ borrar = false } = {}) {
      const fotos = await b.rpc('comunidad_salir', { p_borrar: !!borrar });
      if (fotos?.length) await b.storage.borrar(fotos, 'comunidad').catch(() => {});
      return api.miembroComunidad();
    },
    async ajustesComunidad({ nombre = null, sinRanking = null } = {}) {
      await b.rpc('comunidad_ajustar', { p_nombre: nombre == null ? null : limpiarNombre(nombre), p_sin_ranking: sinRanking });
      return api.miembroComunidad();
    },
    // Quién se ve (el coach y los que están dentro): perfil_id → { nombre, foto, coach }
    // (pulido 2.1) se recuerdan un rato (traen la foto de cada uno). con: perfiles que tienen que estar; si falta alguno
    // (alguien que acaba de entrar), se vuelven a pedir
    async personasComunidad({ con = null } = {}) {
      const f = misFotos();
      // (quien ya se buscó y no está —alguien que salió del equipo— no hace que se pidan otra vez)
      const vale = f.personas && Date.now() - f.personasT < FOTOS_VALEN && !(con || []).some((id) => id && !f.personas[id] && !f.fuera.has(id));
      if (vale) return f.personas;
      const filas = await b.rpc('comunidad_personas', {}).catch(() => null);
      const personas = Object.fromEntries((filas || []).map((x) => [x.perfil_id, { nombre: x.nombre, foto: x.foto || null, coach: !!x.coach }]));
      if (filas && fotos === f) {
        f.personas = personas; f.personasT = Date.now(); f.fuera = new Set();
        for (const id of con || []) if (id && !personas[id]) f.fuera.add(id);
      }
      return personas;
    },
    // El muro: los avisos fijados arriba y después lo más nuevo, de `limite` en `limite` (antes: el creado_en del
    // último que ya se ve). Cada publicación con su autor, sus reacciones (con quién), cuántos comentarios y la mía.
    // v0.47: con un filtro (todo, entrenos, logros, avisos —también las encuestas— o lo mío), en la propia
    // consulta; las menciones (con su nombre) y, en las encuestas, sus resultados con los votos que se ven.
    // v0.71 (043): cada publicación con su tema, sus fotos (varias), su mejor respuesta y si la he guardado; los filtros de
    // los temas, «Guardados» y una búsqueda (buscar: por el texto y el nombre, en la base, con la misma paginación). Sin la
    // 043, como antes (con043: false).
    async muro({ limite = 20, antes = null, filtro = 'todo', buscar = '' } = {}) {
      const yo = uid();
      const con043 = (await api.comunidad043()) === true;
      // (v0.72, 044) con la publicación programada y la retenida; al coach, lo programado no le sale en el muro (sale en
      // «Programados»): su creado_en es su hora, así que basta con no pedir lo de después de ahora (con un margen)
      const con044 = con043 && (await api.comunidad044()) === true;
      // (v0.73, 045) las reacciones nuevas y las pegatinas
      const con045 = con044 && (await api.comunidad045()) === true;
      // (social, 053) la cita de otra publicación
      const con053 = con045 && (await api.comunidad053()) === true;
      const cols = con053 ? COLS_POST_053 : con044 ? COLS_POST_044 : con043 ? COLS_POST_043 : COLS_POST;
      const tope = con044 ? new Date(Date.now() + 20000).toISOString() : null;
      let f = filtro === 'mio' ? { eq: { autor_id: yo } } : (con043 ? FILTRO_MURO_043 : FILTRO_MURO)[filtro] || {};
      if (con043 && filtro === 'guardados') {
        const g = await b.select('comunidad_guardados', { eq: { perfil_id: yo }, cols: 'post_id' }).catch(() => []);
        f = { in: { id: g.map((x) => x.post_id) } };
      }
      // (v0.73, 045) los momentos de 24 horas van en su tira, no en el muro
      f = { ...f, neq: { ...(f.neq || {}), tipo: 'momento' } };
      const busca = con043 && busquedaValida(buscar);
      let fijadas, sueltas, personas, hayMas;
      if (busca) {
        // (la base da los que coinciden, de limite en limite; después se leen como siempre, con el filtro encima)
        const halladas = (await b.rpc('comunidad_buscar', { p_texto: String(buscar).trim(), p_limite: limite + 1, p_antes: antes }).catch(falta043)) || [];
        hayMas = halladas.length > limite;
        const ids = halladas.slice(0, limite).map((x) => x.id);
        const inIds = f.in?.id ? ids.filter((x) => f.in.id.includes(x)) : ids;
        [sueltas, personas] = await Promise.all([
          b.select('comunidad_posts', { ...f, in: { ...(f.in || {}), id: inIds }, order: [['creado_en', 'desc']], cols }),
          api.personasComunidad(),
        ]);
        fijadas = [];
      } else {
        [fijadas, sueltas, personas] = await Promise.all([
          antes ? [] : b.select('comunidad_posts', { ...f, eq: { ...(f.eq || {}), fijada: true }, order: [['creado_en', 'desc']], limit: 20, cols, ...(tope ? { lte: { creado_en: tope } } : {}) }),
          b.select('comunidad_posts', { ...f, eq: { ...(f.eq || {}), fijada: false }, order: [['creado_en', 'desc']], limit: limite + 1, cols,
            ...(antes || tope ? { lte: { creado_en: antes && (!tope || antes < tope) ? antes : tope } } : {}) }),
          api.personasComunidad(),
        ]).catch(falta029);
      }
      if ([...(fijadas || []), ...(sueltas || [])].some((x) => x.autor_id && !personas[x.autor_id])) personas = await api.personasComunidad({ con: [...(fijadas || []), ...(sueltas || [])].map((x) => x.autor_id) });
      const resto = busca ? sueltas : sueltas.filter((x) => !antes || x.creado_en < antes);
      if (!busca) hayMas = resto.length > limite;
      const posts = [...fijadas, ...resto.slice(0, limite)];
      const ids = posts.map((x) => x.id);
      const encuestas = posts.filter((x) => x.tipo === 'encuesta').map((x) => x.id);
      const [reacciones, comentarios, votos, guardados] = ids.length ? await Promise.all([
        b.select('comunidad_reacciones', { in: { post_id: ids }, cols: 'post_id,autor_id,tipo' }),
        b.select('comunidad_comentarios', { in: { post_id: ids }, cols: 'id,post_id,autor_id' }),
        encuestas.length ? b.select('comunidad_votos', { in: { post_id: encuestas }, cols: 'post_id,autor_id,opcion' }) : [],
        con043 ? b.select('comunidad_guardados', { eq: { perfil_id: yo }, in: { post_id: ids }, cols: 'post_id' }).catch(() => []) : [],
      ]) : [[], [], [], []];
      const R = agrupar(reacciones, 'post_id');
      const C = agrupar(comentarios, 'post_id');
      const V = agrupar(votos, 'post_id');
      const G = new Set(guardados.map((x) => x.post_id));
      const autorDe = (id) => personas[id] || { nombre: 'Alguien del equipo', foto: null, coach: false };
      // (053) las publicaciones citadas (si ya no se ven, la cita sale como «ya no está»)
      const citadas = {};
      const idsCita = [...new Set(posts.map((x) => x.cita_post_id).filter(Boolean))];
      if (idsCita.length) {
        const filas = await b.select('comunidad_posts', { in: { id: idsCita }, cols: COLS_POST_044 }).catch(() => []);
        for (const c of filas) citadas[c.id] = { ...c, autor: autorDe(c.autor_id), fotos: fotosDe(c) };
      }
      return {
        personas,
        hayMas,
        con043,
        con044,
        con045,
        con053,
        posts: posts.filter((x) => !(x.publicar_en && Date.parse(x.publicar_en) > Date.now() + 20000) && x.tipo !== 'momento').map((x) => {
          const rs = R[x.id] || [];
          const porTipo = {};
          for (const r of rs) (porTipo[r.tipo] ||= []).push(autorDe(r.autor_id).nombre);
          const mejor = x.mejor_comentario ? (C[x.id] || []).find((c) => c.id === x.mejor_comentario) : null;
          return {
            ...x, autor: autorDe(x.autor_id), mio: x.autor_id === yo, reacciones: porTipo, miReaccion: rs.find((r) => r.autor_id === yo)?.tipo || null, comentarios: (C[x.id] || []).length,
            mencionados: mencionadosDe(x.menciones, personas), con043, con044, con045, con053, fotos: fotosDe(x), guardado: G.has(x.id), retenida: !!x.retenida,
            // (la mejor respuesta, si se ve; en una pregunta, si es del coach: «Respondida por el coach»)
            mejor_comentario: mejor ? mejor.id : null, respondidaCoach: !!mejor && x.tema === 'pregunta' && !!personas[mejor.autor_id]?.coach,
            ...(x.tipo === 'encuesta' ? { resultados: resultadosEncuesta(x.encuesta, V[x.id] || [], yo, (id) => autorDe(id).nombre) } : {}),
            ...(x.cita_post_id ? { cita: citadas[x.cita_post_id] || { id: x.cita_post_id, borrada: true } } : {}),
          };
        }),
      };
    },
    // Publicaciones nuevas de los demás desde una fecha (la insignia de Equipo; solo si está dentro)
    async novedadesComunidad(desde) {
      const m = await api.miembroComunidad();
      if (!api.dentroDeComunidad(m)) return 0;
      const filas = await b.select('comunidad_posts', { ...(desde ? { gte: { creado_en: desde } } : {}), neq: { autor_id: uid() }, cols: 'id,creado_en', order: [['creado_en', 'desc']], limit: 100 }).catch(() => []);
      return filas.filter((x) => !desde || x.creado_en > desde).length;
    },
    // Publicar: un atleta, texto y una foto opcional (un JPEG ya reducido en el móvil); el coach, un aviso (que puede
    // fijar arriba). Primero se registra y después se sube la foto (Storage solo acepta las ya registradas).
    // v0.47: con menciones (perfil_id de quien se ve, como mucho 5: la base deja solo las válidas) y, el coach, una
    // encuesta ({ pregunta, opciones, cierre }) en lugar del aviso
    // v0.71 (043): con su tema (sin él, el de entrada que pone la base) y hasta 4 fotos (fotos: varios JPEG ya reducidos; foto
    // sigue valiendo para una). Sin la 043, sin tema y con una foto como mucho.
    // v0.72 (044): el coach puede programarlo (publicarEn: ISO; hasta entonces solo lo ve él)
    async publicarEnComunidad({ texto = '', foto = null, fotos = [], tema = null, fijada = false, menciones = [], encuesta = null, publicarEn = null, citaPostId = null } = {}) {
      const yo = await api.perfil();
      const coach = yo?.rol === 'coach';
      const m = { menciones: [...new Set(menciones || [])].slice(0, MAX_MENCIONES) };
      const prog = {};
      if (publicarEn) {
        if (!coach) throw new Error('Solo el coach programa publicaciones.');
        if ((await api.comunidad044()) !== true) throw new Error(`Programar: ${AVISO_044.toLowerCase()}.`);
        if (!programadoValido(publicarEn)) throw new Error('Elige una hora más adelante (como mucho a 90 días).');
        prog.publicar_en = publicarEn;
      }
      if (encuesta) {
        // (053) también los atletas, una al día (lo comprueba la base)
        if (!coach && (await api.comunidad053()) !== true) throw new Error(`Las encuestas de los atletas: ${AVISO_053.toLowerCase()}.`);
        const e = limpiarEncuesta(encuesta);
        if (e.error) throw new Error(e.error);
        return (await b.insert('comunidad_posts', [{ tipo: 'encuesta', texto: e.pregunta, encuesta: e.encuesta, ...(coach && fijada ? { fijada: true } : {}), ...m, ...prog }]).catch(prog.publicar_en ? falta044 : coach ? falta029 : falta053))[0];
      }
      // (053) citar otra publicación: con texto, sin fotos
      const cita = citaPostId && !coach ? { cita_post_id: citaPostId } : {};
      if (citaPostId && !String(texto || '').trim()) throw new Error('Al citar, escribe algo.');
      const blobs = [...(foto ? [foto] : []), ...(fotos || [])].filter(Boolean);
      if (blobs.length > MAX_FOTOS) throw new Error(`Hasta ${MAX_FOTOS} fotos por publicación.`);
      const con043 = (await api.comunidad043()) === true;
      if (blobs.length > 1 && !con043) throw new Error(`Varias fotos: ${AVISO_043.toLowerCase()} (de momento, una).`);
      const t = String(texto || '').trim();
      if (t.length > MAX_POST) throw new Error(`Hasta ${MAX_POST} letras.`);
      if (!t && !(blobs.length && !coach)) throw new Error(coach ? 'Escribe el aviso.' : 'Escribe algo o elige una foto.');
      let rutas = [];
      if (blobs.length) {
        const atleta = coach ? null : await api.miAtleta();
        rutas = blobs.map(() => (coach ? `coach/${aleatorio()}.jpg` : `${atleta.id}/${aleatorio()}.jpg`));
      }
      const fila = { tipo: coach ? 'aviso' : 'post', texto: t || null, foto_ruta: rutas[0] || null, ...(coach && fijada ? { fijada: true } : {}), ...(m.menciones.length ? m : {}),
        ...(con043 && tema ? { tema } : {}), ...(rutas.length > 1 ? { fotos: rutas } : {}), ...prog, ...cita };
      const [post] = await b.insert('comunidad_posts', [fila]).catch(cita.cita_post_id ? falta053 : prog.publicar_en ? falta044 : con043 ? falta043 : falta027);
      if (blobs.length) {
        const subidas = [];
        try {
          for (let i = 0; i < blobs.length; i++) { await b.storage.subir(rutas[i], blobs[i], 'image/jpeg', { bucket: 'comunidad' }); subidas.push(rutas[i]); }
        } catch (e) {
          await b.delete('comunidad_posts', { eq: { id: post.id } }).catch(() => {});
          if (subidas.length) await b.storage.borrar(subidas, 'comunidad').catch(() => {});
          throw e;
        }
      }
      return post;
    },
    // Fijar y ocultar: solo el coach, con sus funciones (la app no puede cambiar publicaciones ni comentarios)
    async fijarEnComunidad(id, fijada = true) {
      return b.rpc('comunidad_moderar', { p_post: id, p_fijada: !!fijada, p_oculta: null });
    },
    async ocultarEnComunidad(id, oculta = true) {
      return b.rpc('comunidad_moderar', { p_post: id, p_fijada: null, p_oculta: !!oculta });
    },
    // Borrar: la publicación y después su foto (la base no deja borrar una foto que aún use una publicación o un
    // aviso abierto al coach: entonces se queda hasta que el coach lo resuelva)
    async borrarDeComunidad(post) {
      await b.delete('comunidad_posts', { eq: { id: post.id } });
      const rutas = fotosDe(post);
      if (rutas.length) await b.storage.borrar(rutas, 'comunidad').catch(() => {});
    },
    // Las fotos del muro, con enlaces que caducan en 5 minutos (la pantalla los pide al abrirla)
    async urlFotoComunidad(ruta) { return b.storage.url(ruta, 300, 'comunidad'); },
    // Una reacción (fuerza, fuego, aplauso): la misma otra vez la quita; otra la cambia. Devuelve la que queda.
    async reaccionar(postId, tipo) {
      return b.rpc('comunidad_reaccionar', { p_post: postId, p_tipo: tipo });
    },
    // v0.69 (041): con a qué comentario responde (responde_a) y sus 💪 (cuántos, de quién y si está el mío). Sin la 041,
    // como antes (responder y 💪 dicen que faltan: con041 = false)
    async comentariosComunidad(postId) {
      const COLS = 'id,post_id,autor_id,texto,oculto,creado_en,menciones';
      // (v0.72, 044) y si está retenido por las palabras filtradas; (v0.73, 045) y si es una pegatina
      const con044 = (await api.comunidad044()) === true;
      const con045 = con044 && (await api.comunidad045()) === true;
      const [filas041, personas] = await Promise.all([
        b.select('comunidad_comentarios', { eq: { post_id: postId }, order: [['creado_en', 'asc']], cols: `${COLS},responde_a${con044 ? ',retenido' : ''}${con045 ? ',pegatina' : ''}` }).catch(() => null),
        api.personasComunidad(),
      ]);
      const con041 = !!filas041;
      const filas = filas041 || await b.select('comunidad_comentarios', { eq: { post_id: postId }, order: [['creado_en', 'asc']], cols: COLS }).catch(falta029);
      const yo = uid();
      const ids = filas.map((c) => c.id);
      const reac = con041 && ids.length ? await b.select('comunidad_comentario_reacciones', { in: { comentario_id: ids }, cols: 'comentario_id,autor_id' }).catch(() => []) : [];
      const R = agrupar(reac, 'comentario_id');
      const nombre = (id) => personas[id]?.nombre || 'Alguien del equipo';
      return filas.map((c) => ({
        ...c, responde_a: c.responde_a || null, con041, retenido: !!c.retenido, pegatina: c.pegatina || null, con045,
        autor: personas[c.autor_id] || { nombre: 'Alguien del equipo', foto: null, coach: false }, mio: c.autor_id === yo, mencionados: mencionadosDe(c.menciones, personas),
        fuerza: (R[c.id] || []).map((r) => nombre(r.autor_id)), miFuerza: (R[c.id] || []).some((r) => r.autor_id === yo),
      }));
    },
    // respondeA (v0.69, 041): el comentario al que responde (la base lo cuelga del primero si es una respuesta)
    async comentarEnComunidad(postId, texto, menciones = [], respondeA = null) {
      const t = String(texto || '').trim();
      if (!t) throw new Error('Escribe el comentario.');
      if (t.length > MAX_COMENTARIO) throw new Error(`Hasta ${MAX_COMENTARIO} letras.`);
      const m = [...new Set(menciones || [])].slice(0, MAX_MENCIONES);
      return (await b.insert('comunidad_comentarios', [{ post_id: postId, texto: t, ...(m.length ? { menciones: m } : {}), ...(respondeA ? { responde_a: respondeA } : {}) }])
        .catch(respondeA ? falta041 : falta029).catch(falta029))[0];
    },
    // (v0.73, 045) Una pegatina de FBE como comentario (la base pone su texto); también como respuesta
    async pegatinaEnComunidad(postId, pegatina, respondeA = null) {
      if (!pegatinaValida(pegatina)) throw new Error('Esa pegatina no existe.');
      return (await b.insert('comunidad_comentarios', [{ post_id: postId, texto: pegatina, pegatina, ...(respondeA ? { responde_a: respondeA } : {}) }]).catch(falta045))[0];
    },
    // 💪 a un comentario (v0.69, 041): otra vez lo quita. Devuelve si queda puesto
    async reaccionarComentario(comentarioId) {
      return b.rpc('comunidad_reaccionar_comentario', { p_comentario: comentarioId }).catch(falta041);
    },
    // Votar en una encuesta (v0.47): votar otra opción cambia el voto, hasta el cierre
    async votarEncuesta(postId, opcion) {
      return b.rpc('comunidad_votar', { p_post: postId, p_opcion: Number(opcion) }).catch(falta029);
    },
    async borrarComentarioComunidad(id) { return b.delete('comunidad_comentarios', { eq: { id } }); },
    async ocultarComentarioComunidad(id, oculto = true) {
      return b.rpc('comunidad_moderar_comentario', { p_comentario: id, p_oculto: !!oculto });
    },
    // «Avisar al coach» de una publicación o de un comentario
    async avisarAlCoach({ postId = null, comentarioId = null, motivo = '' } = {}) {
      const m = String(motivo || '').trim();
      if (m.length > MAX_MOTIVO) throw new Error(`El motivo, hasta ${MAX_MOTIVO} letras.`);
      return b.rpc('comunidad_avisar_coach', { p_post: postId, p_comentario: comentarioId, p_motivo: m || null });
    },
    // Los avisos sin resolver (el coach, en Revisar), con lo avisado y quién avisa. Si su autor lo ha borrado,
    // sale igual con la copia que guardó la base al avisar (borrado: true)
    async reportesComunidad() {
      const reps = await b.select('comunidad_reportes', { nulo: ['resuelto_en'], order: [['creado_en', 'desc']] }).catch(() => []);
      if (!reps.length) return [];
      const [posts, comentarios, miembros, personas] = await Promise.all([
        b.select('comunidad_posts', { in: { id: unicos(reps.map((r) => r.post_id)) } }),
        b.select('comunidad_comentarios', { in: { id: unicos(reps.map((r) => r.comentario_id)) } }),
        b.select('comunidad_miembros', { cols: 'perfil_id,nombre,salido_en' }).catch(() => []),
        api.personasComunidad(),
      ]);
      const P = porId(posts), C = porId(comentarios);
      const nombreDe = (id) => personas[id]?.nombre || miembros.find((m) => m.perfil_id === id)?.nombre || null;
      return reps.map((r) => {
        const post = r.post_id ? P[r.post_id] || null : null;
        const comentario = r.comentario_id ? C[r.comentario_id] || null : null;
        const borrado = r.de_comentario ? !comentario : !post;
        const texto = borrado ? r.copia_texto : r.de_comentario ? comentario.texto
          : post.tipo === 'entreno' ? ['Entreno compartido', post.resumen?.nombre, post.texto].filter(Boolean).join(': ')
            : post.tipo === 'logro' ? ['Logro', post.resumen?.titulo, post.texto].filter(Boolean).join(': ') : post.texto;
        return {
          ...r, post, comentario, borrado, texto: texto || (r.copia_foto ? 'Una foto' : ''), foto: r.copia_foto || null,
          // (v0.71, 043) todas las fotos que guardó la base al avisar (las de varias, en copia_fotos)
          fotos: r.copia_fotos?.length ? r.copia_fotos : r.copia_foto ? [r.copia_foto] : [],
          quienAvisa: nombreDe(r.autor_id) || 'Alguien del equipo',
          autor: nombreDe(r.copia_autor_id) || r.copia_autor_nombre || 'Alguien del equipo',
        };
      });
    },
    // Darlo por resuelto. Si lo avisado ya no está, su foto (que la base guardaba para el coach) se borra
    async resolverReporte(r) {
      const id = typeof r === 'object' ? r.id : r;
      const fila = (await b.update('comunidad_reportes', { resuelto_en: new Date().toISOString() }, { eq: { id } }))[0] || null;
      let copias = [...new Set([fila?.copia_foto, ...(fila?.copia_fotos || [])].filter(Boolean))];
      // (v0.73, revisión) no la que guarda otro aviso abierto (dos avisos de un mismo momento: se borra al resolver el último)
      if (copias.length && !fila.post_id) {
        const abiertos = await b.select('comunidad_reportes', { nulo: ['resuelto_en'], cols: 'id,copia_foto,copia_fotos' }).catch(() => null);
        copias = abiertos ? copias.filter((r) => !abiertos.some((k) => k.id !== id && (k.copia_foto === r || (k.copia_fotos || []).includes(r)))) : [];
        if (copias.length) await b.storage.borrar(copias, 'comunidad').catch(() => {});
      }
      return fila;
    },
    // El coach saca a alguien de la comunidad (y no le deja volver) o le vuelve a admitir
    async expulsarDeComunidad(atletaId, bloquear = true) {
      return b.rpc('comunidad_expulsar', { p_atleta: atletaId, p_bloquear: !!bloquear });
    },
    // Retos (del coach) con el progreso de cada miembro (solo recuentos), los más recientes primero
    // v0.47: cada reto con su modo (individual o de equipo) y, en los de equipo, el total de todos (sin quien no sale
    // en el ranking); y si lo he conseguido (conseguido) y ya lo he compartido (compartido)
    async retosComunidad() {
      const [retos, progreso, totales, personas, miembro, logros, equipos] = await Promise.all([
        b.select('comunidad_retos', { order: [['hasta', 'desc'], ['desde', 'desc']] }),
        b.rpc('comunidad_retos_progreso', {}).catch(() => []),
        b.rpc('comunidad_retos_totales', {}).catch(() => []),
        api.personasComunidad(),
        api.miembroComunidad(),
        b.select('comunidad_posts', { eq: { tipo: 'logro', autor_id: uid() }, cols: 'id,reto_id' }).catch(() => []),
        // v0.70 (042): los dos equipos de cada reto por equipos (sin la 042, ninguno)
        b.rpc('comunidad_retos_equipos', {}).catch(() => []),
      ]);
      const E = agrupar(equipos || [], 'reto_id');
      const G = agrupar(progreso || [], 'reto_id');
      const T = Object.fromEntries((totales || []).map((x) => [x.reto_id, x.total]));
      // (como la base: desde la última vez que entró o volvió, en Madrid)
      const entrada = miembro?.entrado_en || miembro?.creado_en;
      const desde = entrada ? fechaMadrid(new Date(entrada)) : null;
      const compartidos = new Set(logros.map((x) => x.reto_id).filter(Boolean));
      return retos.map((r) => {
        const filas = G[r.id] || [];
        const yo = filas.find((x) => x.yo);
        const reto = {
          ...r, modo: r.modo || 'individual', medida: r.medida || 'sesiones', total: T[r.id] ?? 0,
          progreso: filas.map((x) => ({ ...x, foto: personas[x.perfil_id]?.foto || null }))
            .sort((a, b2) => b2.hechas - a.hechas || String(a.nombre).localeCompare(String(b2.nombre), 'es')),
          // (v0.70) por equipos: [{ equipo, nombre, total, personas, mio }], el 0 y el 1
          equiposReto: (E[r.id] || []).sort((a, b2) => a.equipo - b2.equipo).map((x) => ({ ...x, personas: x.personas || [], mio: (x.personas || []).includes(uid()) })),
        };
        const miEquipo = reto.equiposReto.find((x) => x.mio);
        reto.conseguido = !!yo && retoConseguido(reto, { hechas: yo.hechas, total: reto.total, desde, totalEquipo: miEquipo ? miEquipo.total : null });
        reto.compartido = compartidos.has(r.id);
        return reto;
      });
    },
    // Los retos conseguidos que aún no ha compartido (para celebrarlos)
    async logrosComunidad() {
      return (await api.retosComunidad()).filter((r) => r.conseguido && !r.compartido);
    },
    // Compartir un logro en el muro (la tarjeta la hace la base, que comprueba que está conseguido; una vez por reto)
    async compartirLogro(retoId, texto = '') {
      const t = String(texto || '').trim();
      if (t.length > MAX_POST) throw new Error(`Hasta ${MAX_POST} letras.`);
      return b.rpc('comunidad_compartir_logro', { p_reto: retoId, p_texto: t || null }).catch(falta029);
    },
    // v0.70 (042): medida (sesiones, cardio o semanas), el modo «equipos» con los nombres de los dos equipos (equipos) y su
    // reparto ({ a: [perfil_id], b: [perfil_id] }). Sin la 042, como antes (solo sesiones, cada uno o entre todos).
    async guardarReto({ titulo, descripcion = null, desde, hasta, objetivo, modo = 'individual', medida = 'sesiones', equipos = null, reparto = null }, id = null) {
      const con042 = await api.comunidad042();
      const fila = { titulo: String(titulo || '').trim(), descripcion: String(descripcion || '').trim() || null, desde, hasta, objetivo: Number(objetivo), modo };
      if (!con042 && (medida !== 'sesiones' || modo === 'equipos')) throw new Error(`${AVISO_042} en Supabase (supabase/migraciones/042_comunidad_constancia.sql).`);
      if (con042) Object.assign(fila, { medida, equipos: modo === 'equipos' ? (equipos || []).map((t) => limpiarNombre(t)) : null });
      const max = con042 ? retoMaximo(modo, medida) : RETO_MAX[modo];
      if (!max) throw new Error('El reto: cada uno, entre todos o por equipos.');
      if (!fila.titulo) throw new Error('Ponle un título al reto.');
      if (!desde || !hasta || hasta < desde) throw new Error('El final del reto, el mismo día que el principio o después.');
      const unidad = { sesiones: 'sesiones', cardio: 'minutos de cardio', semanas: 'semanas completas' }[medida] || 'sesiones';
      if (!Number.isInteger(fila.objetivo) || fila.objetivo < 1 || fila.objetivo > max) throw new Error(`El objetivo, de 1 a ${max} ${unidad}${modo === 'equipo' ? ' entre todo el equipo' : modo === 'equipos' ? ' por equipo' : ''}.`);
      if (modo === 'equipos') {
        const [x, y] = fila.equipos;
        if (fila.equipos.length !== 2 || !x || !y || x.length > 30 || y.length > 30 || x.toLowerCase() === y.toLowerCase()) throw new Error('Ponle a cada equipo un nombre distinto (hasta 30 letras).');
        if (!reparto?.a?.length || !reparto?.b?.length) throw new Error('Pon al menos a una persona en cada equipo.');
      }
      const sinModo = (e) => { if (/modo/.test(e?.message || '')) return falta029(e); throw e; };
      const guardado = id ? (await b.update('comunidad_retos', fila, { eq: { id } }).catch(sinModo))[0] : (await b.insert('comunidad_retos', [fila]).catch(sinModo).catch(falta027))[0];
      if (modo === 'equipos' && guardado?.id) await b.rpc('comunidad_reto_equipos_guardar', { p_reto: guardado.id, p_equipo_a: reparto.a, p_equipo_b: reparto.b }).catch(falta042);
      return guardado;
    },
    // (v0.70, el coach) El reparto de un reto por equipos: { a: [perfil_id], b: [perfil_id] }
    async equiposDeReto(retoId) {
      const filas = await b.select('comunidad_reto_equipos', { eq: { reto_id: retoId }, cols: 'perfil_id,equipo' }).catch(() => []);
      return { a: filas.filter((x) => x.equipo === 0).map((x) => x.perfil_id), b: filas.filter((x) => x.equipo === 1).map((x) => x.perfil_id) };
    },
    // (v0.70, el coach) Para repartir los equipos igualados: las sesiones de las últimas 4 semanas de cada uno de dentro
    async recientesComunidad() {
      return (await b.rpc('comunidad_sesiones_recientes', {}).catch(falta042)) || [];
    },
    async borrarReto(id) { return b.delete('comunidad_retos', { eq: { id } }); },
    // Ranking de constancia de esta semana (solo recuentos)
    // v0.47: con la racha de cada uno (sin la 029, 0)
    async rankingComunidad() {
      const [filas, personas, rachas] = await Promise.all([b.rpc('comunidad_ranking', {}), api.personasComunidad(), api.rachasComunidad().catch(() => ({}))]);
      return (filas || []).map((x) => ({ ...x, foto: personas[x.perfil_id]?.foto || null, racha: rachas[x.perfil_id]?.racha || 0 }));
    },
    // v0.51: quién ha compartido un entreno hoy (hora de Madrid), para el aro de su foto. Solo los entrenos del muro que
    // ya se ven (los mismos permisos por fila): nada que no se comparta ya. Una consulta pequeña, de las últimas 30 h.
    async compartieronHoyComunidad() {
      const desde = new Date(Date.now() - 30 * 3600e3).toISOString();
      const [filas, personas] = await Promise.all([
        b.select('comunidad_posts', { eq: { tipo: 'entreno' }, gte: { creado_en: desde }, order: [['creado_en', 'desc']], cols: 'autor_id,tipo,creado_en,oculta', limit: 200 }).catch(() => []),
        api.personasComunidad(),
      ]);
      // Solo quien está dentro ahora (el coach también ve lo de quien ya ha salido)
      return new Set([...compartieronHoy(filas, fechaMadrid())].filter((id) => personas[id]));
    },
    // Rachas de semanas completas (v0.47): perfil_id → { racha, semana_completa, yo }
    async rachasComunidad() {
      const filas = await b.rpc('comunidad_rachas', {});
      return Object.fromEntries((filas || []).map((x) => [x.perfil_id, { racha: x.racha, semana_completa: !!x.semana_completa, yo: !!x.yo }]));
    },
    // El resumen de la semana del equipo (v0.47): solo recuentos; null sin la 029 o fuera
    async resumenSemanaComunidad() {
      const filas = await b.rpc('comunidad_resumen_semana', {}).catch(() => null);
      return (Array.isArray(filas) ? filas[0] : filas) || null;
    },
    // El perfil de alguien del equipo (v0.47): lo que da comunidad_perfil(), sus últimas publicaciones que se ven
    // (5) y si ya le he mandado ánimo esta semana
    async perfilComunidad(perfilId) {
      const lunesM = lunesDe(hoyISO());
      const [filas, posts, animo, personas, conFoto] = await Promise.all([
        b.rpc('comunidad_perfil', { p_perfil: perfilId }).catch(falta029),
        b.select('comunidad_posts', { eq: { autor_id: perfilId }, neq: { tipo: 'momento' }, order: [['creado_en', 'desc']], limit: 5, cols: COLS_POST }).catch(() => []),
        b.select('comunidad_animos', { eq: { de: uid(), para: perfilId, semana: lunesM }, cols: 'semana' }).catch(() => []),
        api.personasComunidad(),
        // v0.114: la galería de su perfil (las fotos de sus últimas publicaciones que se ven, hasta 9)
        b.select('comunidad_posts', { eq: { autor_id: perfilId }, neq: { tipo: 'momento' }, order: [['creado_en', 'desc']], limit: 40, cols: 'id,foto_ruta,creado_en' }).catch(() => []),
      ]);
      const p = (Array.isArray(filas) ? filas[0] : filas) || null;
      if (!p) return null;
      const fotos = conFoto.filter((x) => x.foto_ruta && Date.parse(x.creado_en) <= Date.now() + 20000).slice(0, 9).map((x) => ({ id: x.id, ruta: x.foto_ruta }));
      // (v0.72, 044) el coach ve si está silenciado (la fila del miembro solo la ven él y el coach)
      const silencio = p.coach || p.yo ? null : (await b.select('comunidad_miembros', { eq: { perfil_id: perfilId }, cols: 'silenciado_hasta,sin_ranking' }).catch(() => []))[0] || null;
      return { ...p, posts: posts.filter((x) => Date.parse(x.creado_en) <= Date.now() + 20000 && x.tipo !== 'momento').map((x) => ({ ...x, mencionados: mencionadosDe(x.menciones, personas) })), animado: animo.length > 0,
        silenciado_hasta: silencio?.silenciado_hasta || null, sin_ranking: !!silencio?.sin_ranking, fotos };
    },
    // Mandar ánimo 🙌 a alguien del equipo (v0.47): uno por persona y semana
    async animar(perfilId, texto = '') {
      const t = String(texto || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      // (053) con unas palabras; sin la 053 (o sin texto), como siempre
      if (t && (await api.comunidad053()) === true) return b.rpc('comunidad_animar', { p_perfil: perfilId, p_texto: t }).catch(falta053);
      return b.rpc('comunidad_animar', { p_perfil: perfilId }).catch(falta029);
    },
    animarComunidad(perfilId, texto = '') { return api.animar(perfilId, texto); },
    // Los ánimos de esta semana: quién me ha animado (nombres) y a quién he animado yo (perfil_id)
    async animosComunidad() {
      const yo = uid();
      const lunesM = lunesDe(hoyISO());
      const [filas, personas] = await Promise.all([
        b.select('comunidad_animos', { eq: { semana: lunesM }, cols: 'de,para,creado_en,texto', order: [['creado_en', 'asc']] }).catch(() => b.select('comunidad_animos', { eq: { semana: lunesM }, cols: 'de,para,creado_en', order: [['creado_en', 'asc']] }).catch(() => [])),
        api.personasComunidad(),
      ]);
      return {
        recibidos: filas.filter((x) => x.para === yo && personas[x.de]).map((x) => ({ perfil_id: x.de, nombre: personas[x.de].nombre, texto: x.texto || null })),
        mandados: new Set(filas.filter((x) => x.de === yo).map((x) => x.para)),
      };
    },
    // Compartir con el equipo la sesión terminada: la tarjeta (y sus récords) la hace la base con lo registrado
    async compartirEnEquipo(sesionId, { texto = '', kilos = false } = {}) {
      const t = String(texto || '').trim();
      if (t.length > MAX_POST) throw new Error(`Hasta ${MAX_POST} letras.`);
      return b.rpc('comunidad_compartir_sesion', { p_sesion: sesionId, p_texto: t || null, p_kilos: !!kilos });
    },
    // Los récords que pondrá la base en la tarjeta (para la vista previa): ejercicio_id con récord
    async recordsParaEquipo(atletaId, sesionId) {
      return recordsDeEquipo(await api.historial(atletaId), sesionId);
    },
    // ------------------------------------------------------------ v0.69 (migración 041)
    // ¿Está la 041? true / false / null (no se sabe: un corte). Como revision040
    async comunidad041() {
      if (!api._v041) {
        const pr = (async () => {
          try { await b.rpc('comunidad_nuevos', {}); return true; } catch (e) {
            const m = `${e?.message || ''} ${e?.code || ''}`;
            if (/comunidad_nuevos|schema cache|does not exist|no existe|could not find|PGRST20[0-9]|42883/i.test(m)) return false;
            return null;
          }
        })();
        api._v041 = pr;
        pr.then((x) => { if (x == null && api._v041 === pr) api._v041 = null; });
      }
      return api._v041;
    },
    // Los nuevos (los 7 días después de entrar por primera vez), con si ya les he dado la bienvenida. Sin la 041, ninguno
    async nuevosComunidad() {
      const filas = await b.rpc('comunidad_nuevos', {}).catch(() => []);
      const personas = filas?.length ? await api.personasComunidad() : {};
      return nuevosParaBienvenida((filas || []).map((x) => ({ ...x, foto: x.foto || personas[x.perfil_id]?.foto || null, bienvenida: !!x.bienvenida })), uid());
    },
    async darBienvenida(perfilId) {
      return b.rpc('comunidad_dar_bienvenida', { p_perfil: perfilId }).catch(falta041);
    },
    // Quién me ha dado la bienvenida (nombres; solo de quien sigue dentro)
    async bienvenidasRecibidas() {
      const yo = uid();
      if (!yo) return [];
      const [filas, personas] = await Promise.all([
        b.select('comunidad_bienvenidas', { eq: { para: yo }, cols: 'de,creado_en', order: [['creado_en', 'asc']] }).catch(() => []),
        api.personasComunidad(),
      ]);
      return filas.filter((x) => personas[x.de]).map((x) => ({ perfil_id: x.de, nombre: personas[x.de].nombre }));
    },
    // Quién está entrenando ahora (solo quien lo ha encendido; sin horas). null sin la 041 (no sale nada)
    async entrenandoAhora() {
      try { return (await b.rpc('comunidad_entrenando_ahora', {})) || []; } catch { return null; }
    },
    // «Que el equipo vea cuándo estoy entrenando»
    async verEntrenandoComunidad(visible) {
      await b.rpc('comunidad_entrenando_visible', { p_visible: !!visible }).catch(falta041);
      return api.miembroComunidad();
    },
    // ------------------------------------------------------------ v0.70 (migración 042)
    // ¿Está la 042? true / false / null (no se sabe: un corte). Como comunidad041
    async comunidad042() {
      if (!api._v042) {
        const pr = (async () => {
          try { await b.rpc('comunidad_companeros', {}); return true; } catch (e) {
            const m = `${e?.message || ''} ${e?.code || ''}`;
            if (/comunidad_companeros|schema cache|does not exist|no existe|could not find|PGRST20[0-9]|42883/i.test(m)) return false;
            return null;
          }
        })();
        api._v042 = pr;
        pr.then((x) => { if (x == null && api._v042 === pr) api._v042 = null; });
      }
      return api._v042;
    },
    // ------------------------------------------------------------ v0.71 (migración 043)
    // ¿Está la 043? true / false / null (no se sabe: un corte). Como comunidad042
    async comunidad043() {
      if (!api._v043) {
        const pr = (async () => {
          try { await b.rpc('comunidad_buscar', { p_texto: '' }); return true; } catch (e) {
            const m = `${e?.message || ''} ${e?.code || ''}`;
            if (/comunidad_buscar|schema cache|does not exist|no existe|could not find|PGRST20[0-9]|42883/i.test(m)) return false;
            return null;
          }
        })();
        api._v043 = pr;
        pr.then((x) => { if (x == null && api._v043 === pr) api._v043 = null; });
      }
      return api._v043;
    },
    // Guardar (o dejar de guardar) una publicación: solo lo ve quien la guarda, en todos sus móviles. Devuelve cómo queda
    async guardarPost(postId, guardar = true) {
      return b.rpc('comunidad_guardar', { p_post: postId, p_guardar: !!guardar }).catch(falta043);
    },
    // La mejor respuesta de una publicación (comentarioId null: la quita). Solo quien la publicó o el coach
    async mejorRespuesta(postId, comentarioId) {
      return b.rpc('comunidad_mejor_respuesta', { p_post: postId, p_comentario: comentarioId || null }).catch(falta043);
    },
    // Las preguntas del equipo (preguntas frecuentes que guarda el coach): las más nuevas primero. null sin la 043
    async preguntasEquipo() {
      try { return await b.select('comunidad_preguntas', { order: [['creado_en', 'desc']], cols: 'id,post_id,comentario_id,pregunta,respuesta,creado_en,actualizado_en' }); } catch { return null; }
    },
    // El coach guarda una pregunta (y su respuesta en ella) como pregunta frecuente; pregunta y respuesta, retocadas (si no, las
    // de la publicación y el comentario)
    async guardarPreguntaFrecuente({ postId, comentarioId, pregunta = '', respuesta = '' } = {}) {
      const p = String(pregunta || '').trim(), r = String(respuesta || '').trim();
      if (p.length > MAX_POST || r.length > MAX_POST) throw new Error(`Hasta ${MAX_POST} letras.`);
      return b.rpc('comunidad_guardar_pregunta', { p_post: postId, p_comentario: comentarioId, p_pregunta: p || null, p_respuesta: r || null }).catch(falta043);
    },
    async borrarPreguntaFrecuente(id) {
      return b.delete('comunidad_preguntas', { eq: { id } }).catch(falta043);
    },
    // Los compañeros de racha de alguien (sin perfilId, los míos, también las invitaciones pendientes): [{ id, perfil_id, nombre,
    // foto, estado, invito, racha, mi_semana, su_semana }]. null sin la 042.
    async companerosComunidad(perfilId = null) {
      let filas;
      try { filas = await b.rpc('comunidad_companeros', perfilId ? { p_perfil: perfilId } : {}); } catch { return null; }
      const personas = filas?.length ? await api.personasComunidad() : {};
      return (filas || []).map((x) => ({ ...x, foto: x.foto || personas[x.perfil_id]?.foto || null }));
    },
    async invitarCompanero(perfilId) {
      return b.rpc('comunidad_invitar_companero', { p_perfil: perfilId }).catch(falta042);
    },
    async responderCompanero(id, aceptar) {
      return b.rpc('comunidad_responder_companero', { p_id: id, p_aceptar: !!aceptar }).catch(falta042);
    },
    async dejarCompanero(id) {
      return b.rpc('comunidad_dejar_companero', { p_id: id }).catch(falta042);
    },
    // Las insignias: perfil_id → [{ clave, emoji, nombre, como, meta, valor, conseguida }] (de los demás, solo las conseguidas
    // vienen de la base; las que faltan salen sin progreso). Sin perfilId, de todos los que se ven. {} sin la 042.
    async insigniasComunidad(perfilId = null) {
      const filas = await b.rpc('comunidad_insignias', perfilId ? { p_perfil: perfilId } : {}).catch(() => []);
      return Object.fromEntries(Object.entries(agrupar(filas || [], 'perfil_id')).map(([k, v]) => [k, insigniasDe(v)]));
    },
    // «Contar mis minutos de cardio en los retos» (apagado de entrada)
    async cardioEnRetos(contar) {
      await b.rpc('comunidad_cardio_en_retos', { p_contar: !!contar }).catch(falta042);
      return api.miembroComunidad();
    },
    async sesionCompartida(sesionId) {
      return (await b.select('comunidad_posts', { eq: { sesion_id: sesionId }, cols: 'id', limit: 1 }).catch(() => [])).length > 0;
    },
    // ------------------------------------------------------------ v0.72 (migración 044): para ti como coach
    // ¿Está la 044? true / false / null (no se sabe: un corte). Con una lectura que puede hacer cualquiera (sin la tabla, falla)
    async comunidad044() {
      if (!api._v044) {
        const pr = (async () => {
          try { await b.select('comunidad_eventos', { cols: 'id', limit: 1 }); return true; } catch (e) {
            const m = `${e?.message || ''} ${e?.code || ''}`;
            if (/comunidad_eventos|schema cache|does not exist|no existe|could not find|PGRST20[0-9]|42P01/i.test(m)) return false;
            return null;
          }
        })();
        api._v044 = pr;
        pr.then((x) => { if (x == null && api._v044 === pr) api._v044 = null; });
      }
      return api._v044;
    },
    // Los eventos de la última semana y los que vienen (los cancelados también: salen como tales), cada uno con quién va (los
    // nombres, como en las reacciones: de quien se ve), cuántos no van y mi respuesta (true, false o null). null sin la 044.
    async eventosComunidad() {
      let eventos;
      try {
        eventos = await b.select('comunidad_eventos', { gte: { empieza_en: new Date(Date.now() - 7 * 864e5).toISOString() }, order: [['empieza_en', 'asc']] });
      } catch { return null; }
      if (!eventos.length) return [];
      const yo = uid();
      const [filas, personas] = await Promise.all([
        b.select('comunidad_evento_asistentes', { in: { evento_id: eventos.map((e) => e.id) }, cols: 'evento_id,perfil_id,va,creado_en', order: [['creado_en', 'asc']] }).catch(() => []),
        api.personasComunidad(),
      ]);
      const A = agrupar(filas.filter((x) => personas[x.perfil_id]), 'evento_id');
      return eventos.map((e) => {
        const r = A[e.id] || [];
        const van = r.filter((x) => x.va);
        const mia = r.find((x) => x.perfil_id === yo);
        // (053) propuestaPor: quién la propuso (si es de un atleta y sigue dentro); mia: la propuse yo
        return { ...e, van: van.map((x) => personas[x.perfil_id].nombre), vanIds: van.map((x) => x.perfil_id), noVan: r.filter((x) => !x.va).map((x) => personas[x.perfil_id].nombre), miRespuesta: mia ? !!mia.va : null,
          propuestaPor: e.creado_por ? personas[e.creado_por]?.nombre || 'Alguien del equipo' : null, mia: !!e.creado_por && e.creado_por === yo };
      });
    },
    // «Me apunto» (true), «No voy» (false) o quitar mi respuesta (null)
    async responderEvento(eventoId, va) {
      return b.rpc('comunidad_evento_responder', { p_evento: eventoId, p_va: va == null ? null : !!va }).catch(falta044);
    },
    // El coach crea o cambia un evento: { titulo, fecha, hora (de Madrid), lugar, descripcion, plazas }. (053) Un atleta propone
    // una quedada igual (la base la firma con creado_por; hasta 30 plazas y 3 abiertas)
    async guardarEvento({ titulo, fecha, hora, lugar, descripcion = '', plazas = null }, id = null) {
      const problema = eventoValido({ titulo, lugar, descripcion, plazas });
      if (problema) throw new Error(`${problema}.`);
      const empieza = instanteMadrid(fecha, hora);
      if (!empieza) throw new Error('Elige el día y la hora.');
      if (Date.parse(empieza) <= Date.now() && !id) throw new Error('El evento, más adelante (esa hora ya ha pasado).');
      const coach = (await api.perfil())?.rol === 'coach';
      if (!coach && plazas !== '' && plazas != null && Number(plazas) > 30) throw new Error('Una quedada, hasta 30 plazas.');
      const fila = { titulo: String(titulo).trim(), empieza_en: empieza, lugar: String(lugar).trim(), descripcion: String(descripcion || '').trim() || null,
        plazas: plazas === '' || plazas == null ? null : Number(plazas), ...(coach || id ? {} : { creado_por: uid() }) };
      const r = id ? await b.update('comunidad_eventos', fila, { eq: { id } }).catch(coach ? falta044 : falta053) : await b.insert('comunidad_eventos', [fila]).catch(coach ? falta044 : falta053);
      if (!r?.length) throw new Error('No se ha podido guardar el evento.');
      return r[0];
    },
    // Cancelarlo (a quien va le llega un aviso; se queda como «Cancelado»)
    async cancelarEvento(id) {
      const r = await b.update('comunidad_eventos', { cancelado_en: new Date().toISOString() }, { eq: { id } }).catch(falta044);
      if (!r?.length) throw new Error('No se ha podido cancelar el evento.');
      return r[0];
    },
    // Lo programado del coach (avisos y encuestas que aún no han salido), lo más cercano primero
    async programadosComunidad() {
      return b.select('comunidad_posts', { gte: { publicar_en: new Date().toISOString() }, order: [['publicar_en', 'asc']], cols: COLS_POST_044 }).catch(() => []);
    },
    // Cambiar lo programado: el texto y la hora (publicarEn null: se publica ya). Devuelve la hora a la que sale
    async cambiarProgramado(id, { texto = null, publicarEn = null } = {}) {
      const t = texto == null ? null : String(texto).trim();
      if (t != null && t.length > MAX_POST) throw new Error(`Hasta ${MAX_POST} letras.`);
      if (publicarEn && !programadoValido(publicarEn)) throw new Error('Elige una hora más adelante (como mucho a 90 días).');
      return b.rpc('comunidad_programado_cambiar', { p_post: id, p_texto: t || null, p_publicar_en: publicarEn || null }).catch(falta044);
    },
    // Las plantillas de avisos del coach (como mucho 30), las más nuevas primero. null sin la 044
    async plantillasComunidad() {
      try { return await b.select('comunidad_plantillas', { order: [['creado_en', 'desc']] }); } catch { return null; }
    },
    async guardarPlantilla(texto) {
      const t = String(texto || '').trim();
      if (!t) throw new Error('Escribe el aviso antes de guardarlo como plantilla.');
      if (t.length > MAX_POST) throw new Error(`Hasta ${MAX_POST} letras.`);
      const ya = (await api.plantillasComunidad()) || [];
      if (ya.length >= MAX_PLANTILLAS) throw new Error(`Como mucho ${MAX_PLANTILLAS} plantillas: borra alguna antes.`);
      return (await b.insert('comunidad_plantillas', [{ texto: t }]).catch(falta044))[0];
    },
    async borrarPlantilla(id) {
      return b.delete('comunidad_plantillas', { eq: { id } }).catch(falta044);
    },
    // El panel de la comunidad (el coach): recuentos de las 4 últimas semanas y quién falta. null sin la 044
    async panelComunidad() {
      try { return await b.rpc('comunidad_panel', {}); } catch (e) { if (/coach/.test(e?.message || '')) throw e; return null; }
    },
    // El atleta de la semana: { actual: { id, perfil_id, nombre, foto, motivo, desde, hasta } | null, historial: [...] (el coach) }.
    // null sin la 044
    async destacadoComunidad() {
      let filas;
      try { filas = await b.select('comunidad_destacados', { order: [['desde', 'desc']], limit: 20 }); } catch { return null; }
      const personas = filas.length ? await api.personasComunidad() : {};
      const ahora = Date.now();
      const con = (d) => ({ ...d, nombre: personas[d.perfil_id]?.nombre || 'Alguien que ya no está', foto: personas[d.perfil_id]?.foto || null, dentro: !!personas[d.perfil_id] });
      const lista = filas.map(con);
      return { actual: lista.find((d) => d.dentro && Date.parse(d.desde) <= ahora && Date.parse(d.hasta) > ahora) || null, historial: lista };
    },
    async destacarAtleta(perfilId, motivo) {
      const m = String(motivo || '').replace(/\s+/g, ' ').trim();
      if (!m || m.length > MAX_MOTIVO_DESTACADO) throw new Error(`Escribe por qué, en una línea (hasta ${MAX_MOTIVO_DESTACADO} letras).`);
      return b.rpc('comunidad_destacar', { p_perfil: perfilId, p_motivo: m }).catch(falta044);
    },
    async quitarDestacado() {
      return b.rpc('comunidad_destacado_quitar', {}).catch(falta044);
    },
    // Moderación (el coach): silenciar (horas: 24, 168; 0 lo quita), las palabras filtradas y el modo lento, y lo retenido
    async silenciarComunidad(perfilId, horas) {
      return b.rpc('comunidad_silenciar', { p_perfil: perfilId, p_horas: Number(horas) || 0 }).catch(falta044);
    },
    async moderacionComunidad() {
      try { return (await b.select('comunidad_moderacion', {}))[0] || { palabras: [], lento_min: 0 }; } catch { return null; }
    },
    async guardarModeracion({ palabras = '', lento = 0 } = {}) {
      const lista = Array.isArray(palabras) ? palabras : palabrasDeTexto(palabras);
      if (lista.length > MAX_PALABRAS) throw new Error(`Hasta ${MAX_PALABRAS} palabras.`);
      await b.rpc('comunidad_moderacion_guardar', { p_palabras: lista, p_lento: Number(lento) || 0 }).catch(falta044);
      return api.moderacionComunidad();
    },
    // Lo retenido por las palabras filtradas (publicaciones y comentarios), con quién lo ha escrito, lo más nuevo primero
    async retenidosComunidad() {
      const [posts, comentarios, personas] = await Promise.all([
        b.select('comunidad_posts', { eq: { retenida: true }, order: [['creado_en', 'desc']], cols: COLS_POST_044 }).catch(() => []),
        b.select('comunidad_comentarios', { eq: { retenido: true }, order: [['creado_en', 'desc']], cols: 'id,post_id,autor_id,texto,creado_en' }).catch(() => []),
        api.personasComunidad(),
      ]);
      const nombre = (id) => personas[id]?.nombre || 'Alguien del equipo';
      return [...posts.map((x) => ({ ...x, clase: 'post', autor: nombre(x.autor_id) })), ...comentarios.map((c) => ({ ...c, clase: 'comentario', autor: nombre(c.autor_id) }))]
        .sort((a, c) => (a.creado_en < c.creado_en ? 1 : -1));
    },
    async aprobarComunidad({ postId = null, comentarioId = null } = {}) {
      return b.rpc('comunidad_aprobar', { p_post: postId, p_comentario: comentarioId }).catch(falta044);
    },
    // Los silenciados ahora (el coach)
    async silenciadosComunidad() {
      return (await b.select('comunidad_miembros', { gte: { silenciado_hasta: new Date().toISOString() }, cols: 'perfil_id,nombre,silenciado_hasta', order: [['silenciado_hasta', 'asc']] }).catch(() => []));
    },

    // ------------------------------------------------------------ v0.73 (migración 045): momentos y celebración
    // ¿Está la 045? true / false / null (no se sabe: un corte). Con una lectura que puede hacer cualquiera (sin la columna, falla)
    async comunidad045() {
      if (!api._v045) {
        const pr = (async () => {
          try { await b.select('comunidad_comentarios', { cols: 'id,pegatina', limit: 1 }); return true; } catch (e) {
            const m = `${e?.message || ''} ${e?.code || ''}`;
            if (/pegatina|schema cache|does not exist|no existe|could not find|PGRST20[0-9]|42703/i.test(m)) return false;
            return null;
          }
        })();
        api._v045 = pr;
        pr.then((x) => { if (x == null && api._v045 === pr) api._v045 = null; });
      }
      return api._v045;
    },
    // Los momentos de las últimas 24 horas (la base no da los de antes), el mío primero, cada uno con su autor, sus reacciones (con
    // quién) y la mía. null sin la 045
    async momentosComunidad() {
      if ((await api.comunidad045().catch(() => null)) !== true) return null;
      const yo = uid();
      const desde = new Date(Date.now() - 24 * 3600e3).toISOString();
      const [filas, personas] = await Promise.all([
        b.select('comunidad_posts', { eq: { tipo: 'momento' }, gte: { creado_en: desde }, order: [['creado_en', 'desc']], limit: 60, cols: COLS_POST_044 }).catch(() => []),
        api.personasComunidad(),
      ]);
      const lista = filas.filter((x) => momentoVigente(x) && !x.oculta && (personas[x.autor_id] || x.autor_id === yo));
      const reac = lista.length ? await b.select('comunidad_reacciones', { in: { post_id: lista.map((x) => x.id) }, cols: 'post_id,autor_id,tipo' }).catch(() => []) : [];
      const R = agrupar(reac, 'post_id');
      const autorDe = (id) => personas[id] || { nombre: 'Alguien del equipo', foto: null, coach: false };
      return ordenarMomentos(lista, yo).map((x) => {
        const rs = R[x.id] || [];
        const porTipo = {};
        for (const r of rs) (porTipo[r.tipo] ||= []).push(autorDe(r.autor_id).nombre);
        return { ...x, autor: autorDe(x.autor_id), mio: x.autor_id === yo, reacciones: porTipo, miReaccion: rs.find((r) => r.autor_id === yo)?.tipo || null, retenida: !!x.retenida };
      });
    },
    // Publicar un momento: una foto (ya reducida) y una línea opcional (hasta 140). Lo comprueba la base (moderación incluida)
    async publicarMomento({ foto, texto = '' } = {}) {
      if (!foto) throw new Error('Elige una foto.');
      const l = limpiarMomento(texto);
      if (l.error) throw new Error(l.error);
      const yo = await api.perfil();
      const coach = yo?.rol === 'coach';
      const atleta = coach ? null : await api.miAtleta();
      const ruta = coach ? `coach/${aleatorio()}.jpg` : `${atleta.id}/${aleatorio()}.jpg`;
      const [post] = await b.insert('comunidad_posts', [{ tipo: 'momento', texto: l.texto, foto_ruta: ruta }]).catch(falta045);
      try { await b.storage.subir(ruta, foto, 'image/jpeg', { bucket: 'comunidad' }); } catch (e) {
        await b.delete('comunidad_posts', { eq: { id: post.id } }).catch(() => {});
        throw e;
      }
      return post;
    },
    // «<Mes> en el equipo»: { mes, equipo: { sesiones, semanas_completas, records, retos, reaccion, racha, miembros }, yo: {…} | null }.
    // mes: AAAA-MM (sin él, el pasado). null sin la 045
    async mesEquipoComunidad(mes = null) {
      try { return (await b.rpc('comunidad_mes_equipo', { p_mes: mes ? `${mes}-01` : null })) || null; } catch { return null; }
    },
    // Los hitos del equipo (como hitosDe): [{ clave, medida, meta, valor, alcanzado, titulo }]. null sin la 045
    async hitosComunidad() {
      let filas;
      try { filas = await b.rpc('comunidad_hitos', {}); } catch { return null; }
      const v = {};
      for (const x of filas || []) v[x.medida] = x.valor;
      return hitosDe(v);
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
      // (v0.48) Los mensajes y avisos programados que aún no han salido no son suyos todavía; sus tareas, sí
      out.comentarios = out.comentarios.filter((c) => !programado(c));
      out.avisos = out.avisos.filter((a) => !programado(a));
      out.tareas = await b.select('tareas', { eq: { atleta_id: atletaId } }).catch(() => []);
      // (v0.133, 055) lo de carrera: sus zonas y su plan, sus carreras, las semanas del plan y las revisiones
      for (const t of ['carrera_atleta', 'carrera_eventos', 'carrera_semanas', 'carrera_revisiones']) out[t] = await b.select(t, { eq: { atleta_id: atletaId } }).catch(() => []);
      // (v0.104, 050) lo que eligió para su app (apodo, porqué, ejercicios, música y cumpleaños)
      // (personal() es siempre lo de quien está dentro: solo vale si exporta lo suyo; el coach, con lo de cada atleta)
      out.personal = perfilId && perfilId === uid()
        ? (await api.personal().catch(() => null)) ?? null
        : ((await api.personalAtletas().catch(() => [])).find((x) => x.atleta_id === atletaId) || null);
      // (v0.105, 051) lo que llegó de Salud del iPhone (los 400 últimos días)
      out.salud_diaria = (await api.saludDiaria(atletaId, '2020-01-01', sumarDias(hoyISO(), 1)).catch(() => null))?.dias || [];
      // (revisión) lo suyo de las integraciones: desde cuándo tiene conectado cada cosa, su calendario y su teléfono
      if (perfilId && perfilId === uid()) {
        out.integraciones = (await b.rpc('integraciones_mias', {}).catch(() => null)) || null;
        if (out.integraciones) delete out.integraciones.atajos;
        out.telefono = (await b.rpc('contacto_mio', {}).catch(() => null)) || null;
      } else out.telefono = (await api.contactos().catch(() => ({})))?.[atletaId] || null;
      // (v0.57) la corrección de sus vídeos de técnica (con días, como la ve en la app; sin la 035, ninguna)
      const vids = out.archivos.filter((a) => a.tipo === 'video_tecnica').map((a) => a.id);
      out.video_correcciones = vids.length && await api.video035().catch(() => false) ? await api.correccionesDe(vids).catch(() => []) : [];
      // (v0.59, 037) su valoración de cada vídeo y los recordatorios de técnica activos (sin horas, como los ve)
      out.video_autoevaluacion = vids.length ? Object.values(await api.autoevaluaciones(vids).catch(() => ({}))) : [];
      out.recordatorios_tecnica = await api.recordatoriosActivos(atletaId).catch(() => []);
      // (v0.54) sus reacciones y sus destacados en el chat (los destacados solo los ve su dueño: si exporta el coach, vacíos)
      const idsMsg = out.comentarios.map((c) => c.id);
      out.comentario_reacciones = perfilId && idsMsg.length ? await b.select('comentario_reacciones', { in: { comentario_id: idsMsg }, eq: { usuario_id: perfilId } }).catch(() => []) : [];
      out.comentario_destacados = perfilId && idsMsg.length ? await b.select('comentario_destacados', { in: { comentario_id: idsMsg }, eq: { usuario_id: perfilId } }).catch(() => []) : [];
      // Las preguntas que le hace su coach (también las de todos y las archivadas), para entender sus respuestas
      out.preguntas_checkin = await api.preguntasCheckin(atletaId, { archivadas: true });
      // Las notificaciones solo las ve su dueño (si exporta el coach, salen vacías); de los móviles, sin sus claves
      out.preferencias_notificaciones = perfilId ? await b.select('preferencias_notificaciones', { eq: { usuario_id: perfilId } }) : [];
      out.notificaciones = perfilId ? await b.select('notificaciones', { eq: { usuario_id: perfilId } }) : [];
      out.suscripciones_push = perfilId ? (await b.select('suscripciones_push', { eq: { usuario_id: perfilId } }))
        .map(({ id, dispositivo, creada_en, usada_en }) => ({ id, dispositivo, creada_en, usada_en })) : [];
      // Comidas (v0.26): sus comidas del día, su recetario (con las recetas) y su menú
      for (const t of ['comidas_atleta', 'recetas_atleta', 'menu_comidas', 'menu_dias']) out[t] = await b.select(t, { eq: { atleta_id: atletaId } }).catch(() => []);
      // La comunidad (v0.43): si entró, con qué nombre y lo que ha publicado, comentado, reaccionado y avisado. El
      // propio atleta, con comunidad_mis_datos() (también lo oculto y aunque haya salido); el coach, de las tablas.
      if (perfilId && perfilId === uid()) out.comunidad = await b.rpc('comunidad_mis_datos', {}).catch(() => null);
      else {
        const [miembro, publicaciones, comentarios, reacciones, votos, animos] = await Promise.all(['comunidad_miembros', 'comunidad_posts', 'comunidad_comentarios', 'comunidad_reacciones', 'comunidad_votos', 'comunidad_animos']
          .map((t) => b.select(t, { eq: { atleta_id: atletaId } }).catch(() => [])));
        // (v0.47) sus votos y sus ánimos, sin identificadores de otras personas: de los mandados y los recibidos, solo
        // cuándo; de sus menciones, cuántas (su texto ya dice a quién nombró)
        const animos_recibidos = (await b.select('comunidad_animos', { eq: { para_atleta_id: atletaId }, cols: 'semana,creado_en' }).catch(() => []))
          .map(({ semana, creado_en }) => ({ semana, creado_en }));
        const sinMenciones = (x) => ({ ...x, menciones: (x.menciones || []).length });
        // (v0.69, 041) sus 💪 a comentarios y las bienvenidas, también sin identificadores de otras personas
        const [reacComentarios, bienDadas, bienRecibidas] = await Promise.all([
          b.select('comunidad_comentario_reacciones', { eq: { atleta_id: atletaId }, cols: 'comentario_id,creado_en' }).catch(() => []),
          b.select('comunidad_bienvenidas', { eq: { atleta_id: atletaId }, cols: 'creado_en' }).catch(() => []),
          b.select('comunidad_bienvenidas', { eq: { para_atleta_id: atletaId }, cols: 'creado_en' }).catch(() => []),
        ]);
        out.comunidad = {
          miembro: miembro[0] || null, publicaciones: publicaciones.map(sinMenciones), comentarios: comentarios.map(sinMenciones), reacciones, votos,
          animos_mandados: animos.map(({ semana, creado_en }) => ({ semana, creado_en })), animos_recibidos,
          reacciones_comentarios: reacComentarios.map(({ comentario_id, creado_en }) => ({ comentario_id, creado_en })),
          bienvenidas_dadas: bienDadas.map(({ creado_en }) => ({ creado_en })), bienvenidas_recibidas: bienRecibidas.map(({ creado_en }) => ({ creado_en })),
        };
      }
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
      // (revisión) las tablas que solo se abren con funciones (las de la 050 y la 051): sin la 051, nada
      out.privado = await b.rpc('copia_privada', {}).catch((e) => { if (falta051(e)) return null; throw e; });
      return out;
    },

    // ------------------------------------------------------------ coach: atletas
    // Los atletas, con su foto de perfil (si la han puesto; la foto está en su perfil, no en la ficha)
    // Los atletas del coach. Su propia ficha de atleta (modo atleta, v0.37: la vinculada a su cuenta) no sale en las
    // listas: ni en Atletas ni en Revisar, Mensajes o Cobros
    async atletas() {
      const yo = uid();
      const atletas = (await b.select('atletas', { order: [['nombre', 'asc']] })).filter((a) => !yo || a.perfil_id !== yo);
      const ids = unicos(atletas.map((a) => a.perfil_id).filter(Boolean));
      if (!ids.length) return atletas;
      const deCada = await fotosDePerfiles(ids);
      return atletas.map((a) => ({ ...a, foto: (a.perfil_id && deCada.get(a.perfil_id)) || null }));
    },
    // soloAtleta (v0.49): el de un atleta (la cabecera de su ficha), con los mismos cálculos que el panel
    async resumenes(hoy = hoyISO(), { soloAtleta = null } = {}) {
      const atletas = (await api.atletas()).filter((a) => !soloAtleta || a.id === soloAtleta);
      if (!atletas.length) return [];
      const ids = atletas.map((a) => a.id);
      // (pulido 4) Todo lo que solo depende de la lista de atletas se pide a la vez (antes, una consulta detrás de otra:
      // unas veinte esperas seguidas; ahora, las cinco de la cadena más larga). Los cálculos son los mismos.
      const desde = sumarDias(lunesDe(hoy), -63);
      const lunesHoy = lunesDe(hoy);
      // El bloque de cada atleta: el activo (o ajustado); si no tiene, el planificado más reciente (como lo que ve el atleta)
      const delPrograma = (async () => {
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
        return { bloques, semanasPorBloque, actuales, sesiones };
      })();
      const delSeguimiento = Promise.all([
        b.select('pesos', { in: { atleta_id: ids }, gte: { fecha: desde }, order: [['fecha', 'desc']] }),
        b.select('checkins', { in: { atleta_id: ids }, gte: { semana_inicio: desde }, order: [['semana_inicio', 'desc']] }),
        b.select('molestias', { in: { atleta_id: ids }, gte: { semana_inicio: sumarDias(lunesDe(hoy), -14) } }),
        // la última serie de cada atleta: (pulido 3) con la migración 048, una sola consulta; sin ella, una pequeña
        // por atleta, en paralelo, como antes
        ultimasSeries(ids),
      ]);
      const delHistorial = (async () => {
        // Sesiones hechas en las últimas 6 semanas (para la carga), de todos sus bloques
        const todosBloques = await b.select('bloques', { in: { atleta_id: ids }, eq: { es_plantilla: false }, cols: COLS_BLOQUE });
        const todasSemanas = todosBloques.length ? await b.select('semanas', { in: { bloque_id: todosBloques.map((x) => x.id) }, cols: 'id,bloque_id,fecha_inicio,programacion,numero' }) : [];
        // v0.49: las minigráficas del panel: sesiones hechas de las programadas en las 6 últimas semanas (con la actual)
        const sem6 = semanasQueCuentan(todasSemanas, todosBloques).filter((w) => lunesDe(w.fecha_inicio) >= sumarDias(lunesHoy, -35) && lunesDe(w.fecha_inicio) <= lunesHoy);
        // Cumplimiento de las 4 últimas semanas acabadas: sesiones, series pautadas hechas y esfuerzo frente a la pauta
        const sem4 = semanasQueCuentan(todasSemanas, todosBloques).filter((w) => lunesDe(w.fecha_inicio) >= sumarDias(lunesHoy, -28) && lunesDe(w.fecha_inicio) < lunesHoy);
        const [recientes, ses6, cuatro, NAT] = await Promise.all([
          todasSemanas.length ? b.select('sesiones', { in: { semana_id: todasSemanas.map((x) => x.id) }, eq: { completada: true }, gte: { fecha_realizada: sumarDias(lunesDe(hoy), -42) } }) : [],
          sem6.length ? b.select('sesiones', { in: { semana_id: sem6.map((w) => w.id) }, cols: 'id,semana_id,completada' }) : [],
          (async () => {
            const ses4 = sem4.length ? await b.select('sesiones', { in: { semana_id: sem4.map((w) => w.id) }, cols: 'id,semana_id,completada' }) : [];
            const pau4 = ses4.length ? await b.select('sesion_ejercicios', { in: { sesion_id: ses4.map((x) => x.id) }, cols: 'id,sesion_id,series,rpe_objetivo,rir_objetivo' }) : [];
            const ser4 = pau4.length ? await b.select('series', { in: { sesion_ejercicio_id: pau4.map((x) => x.id) }, cols: 'sesion_ejercicio_id,reps,rpe,rir', limit: 20000 }) : [];
            return { ses4, pau4, ser4 };
          })(),
          // v0.53: quien tiene objetivo de días por semana (microciclos) se mide por semanas de lunes a domingo con ese
          // objetivo: la de hoy (sus sesiones), las 6 de la minigráfica y el cumplimiento de las 4 últimas acabadas (de lo
          // hecho en ellas y, por lo que faltó hasta su objetivo, las siguientes pendientes de su programa, en su orden)
          semanasNaturalesPanel(atletas, { todosBloques, todasSemanas, hoy }),
        ]);
        return { todosBloques, todasSemanas, sem6, sem4, recientes, ses6, ...cuatro, NAT };
      })();
      // Hábitos: cumplimiento de la última semana (7 días hasta hoy) de cada atleta
      const delosHabitos = (async () => {
        const habitosTodos = await b.select('habitos', { in: { atleta_id: ids }, eq: { activo: true } });
        const regsHab = habitosTodos.length ? await b.select('registros_habito', { in: { habito_id: habitosTodos.map((h) => h.id) }, gte: { fecha: sumarDias(hoy, -7) } }) : [];
        return { habitosTodos, regsHab };
      })();
      const [
        { bloques, semanasPorBloque, actuales, sesiones },
        [pesos, checkins, molestias, ultimas],
        { todosBloques, todasSemanas, sem6, sem4, recientes, ses6, ses4, pau4, ser4, NAT },
        { habitosTodos, regsHab },
        planesN, regsN, cambiosR, cuestionarios, pagosTodos, abiertas054,
      ] = await Promise.all([
        delPrograma, delSeguimiento, delHistorial, delosHabitos,
        // Nutrición: sus planes y qué días ha apuntado en la última semana
        b.select('planes_nutricion', { in: { atleta_id: ids } }).catch(() => []),
        b.select('registros_nutricion', { in: { atleta_id: ids }, gte: { fecha: sumarDias(hoy, -7) }, cols: 'atleta_id,fecha' }).catch(() => []),
        // Recetas que piden cambiar (v0.26; sin la migración 022, ninguna)
        b.select('recetas_atleta', { in: { atleta_id: ids }, nonulo: ['cambio_pedido_en'], cols: 'atleta_id' }).catch(() => []),
        // Cuestionarios con algo de salud que revisar
        b.select('cuestionarios', { in: { atleta_id: ids }, cols: 'atleta_id,resultado,otras,completado_en,revisado_en' }).catch(() => []),
        // Cobros (v0.25, solo el coach; sin la migración 020, sin columna): cómo va cada uno, para verlo en el panel
        b.select('pagos', { in: { atleta_id: ids } }).catch(() => null),
        // (054) Las sesiones empezadas y sin terminar (sin la migración, ninguna)
        api.sesionesAbiertas().catch(() => []),
      ]);
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
      const regsPorHabito = agrupar(regsHab, 'habito_id');
      const habitosPorAtleta = agrupar(habitosTodos, 'atleta_id');
      const PN = agrupar(planesN, 'atleta_id'), RN = agrupar(regsN, 'atleta_id');
      const CR = agrupar(cambiosR, 'atleta_id');
      const Q = Object.fromEntries(cuestionarios.map((c) => [c.atleta_id, c]));
      const res = atletas.map((a) => {
        const s4 = S4[a.id] || [];
        const ids4 = new Set(s4.map((x) => x.id));
        const p4 = pau4.filter((p) => ids4.has(p.sesion_id));
        const idsP4 = new Set(p4.map((p) => p.id));
        const nat = NAT[a.id] || null;
        const cumple = nat ? nat.cumplimiento : s4.length ? cumplimiento({ sesiones: s4, pautas: p4, series: ser4.filter((x) => idsP4.has(x.sesion_ejercicio_id)) }, hoy) : null;
        const bloque = bloques.filter((x) => x.atleta_id === a.id).sort((x, y) => (x.fecha_inicio < y.fecha_inicio ? 1 : -1))[0] || null;
        const semana = bloque ? actuales[bloque.id] || null : null;
        const cs = C[a.id] || [];
        const misSemanas = sem6.filter((w) => atletaDeBloque[w.bloque_id] === a.id);
        const idsMias = new Set(misSemanas.map((w) => w.id));
        const chispas = {
          peso: chispaPeso(P[a.id] || [], hoy, 8),
          sesiones: nat ? nat.chispa : chispaSesiones(misSemanas, ses6.filter((x) => idsMias.has(x.semana_id)), hoy, 6),
        };
        return { ...resumenAtleta({
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
          abiertas: (abiertas054 || []).filter((x) => x.atleta_id === a.id),
          cambiosReceta: (CR[a.id] || []).length,
          diasNutricion: a.nutricion === false ? null : unicos((RN[a.id] || []).filter((x) => x.fecha > sumarDias(hoy, -7) && x.fecha <= hoy).map((x) => x.fecha)).length,
          diasSemana: nat ? nat.diasSemana : null, semanaNatural: nat ? nat.actual : null,
        }, hoy), chispas };
      });
      if (pagosTodos) {
        const PG = agrupar(pagosTodos, 'atleta_id');
        for (const r of res) r.cobro = PG[r.atleta_id]?.length ? resumenCobros(PG[r.atleta_id], hoy) : null;
      }
      return res.sort((x, y) => x.prioridad - y.prioridad || x.nombre.localeCompare(y.nombre, 'es'));
    },
    async crearAtleta({ nombre, email = null, objetivo = null, notion_url = null, nivel = null, nutricion = true, entrenamiento = true, carrera = false }) {
      // nivel y nutricion (v0.22) y entrenamiento (v0.26) solo si son distintos de lo de siempre (así una base sin
      // la migración 018 o la 022 sigue dando de alta)
      const fila = { nombre, email, objetivo, notion_url, ...(nivel ? { nivel } : {}), ...(nutricion === false ? { nutricion: false } : {}), ...(entrenamiento === false ? { entrenamiento: false } : {}), ...(carrera ? { carrera: true } : {}) };
      return (await b.insert('atletas', [fila]).catch(falta018).catch(falta022).catch(falta055))[0];
    },
    async actualizarAtleta(id, cambios) {
      // Fecha de contratación del servicio (v0.73): un día válido y no futuro (cuenta para los aniversarios)
      if ('fecha_alta' in cambios) {
        const v = String(cambios.fecha_alta || '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T12:00:00Z`)) || v > fechaMadrid()) throw new Error('La fecha de contratación tiene que ser un día válido, hoy o antes');
      }
      // Días de entreno por semana (v0.53): de 1 a 7, o vacío / null para «Automático»
      if ('dias_semana' in cambios) {
        const v = diasSemanaValido(cambios.dias_semana);
        if (v == null && cambios.dias_semana != null && cambios.dias_semana !== '') throw new Error('Los días de entreno por semana van de 1 a 7 (o «Automático»)');
        cambios = { ...cambios, dias_semana: v };
      }
      return (await b.update('atletas', cambios, { eq: { id } }).catch(falta018).catch(falta022).catch(falta031).catch(falta055))[0];
    },
    // Borra al atleta con todo lo suyo, también sus vídeos y fotos de Storage
    // Borrado completo: todo lo que haya en su carpeta de Storage (registrado o no) y después su ficha,
    // que arrastra el resto de sus datos.
    async borrarAtleta(atletaId) {
      const registrados = await b.select('archivos', { eq: { atleta_id: atletaId }, cols: 'id,ruta' });
      const enCarpeta = await b.storage.listar(atletaId);
      const rutas = [...new Set([...registrados.map((a) => a.ruta), ...enCarpeta])];
      // (v0.56) y sus notas de voz (bucket «voz»; sin la 034, no hay)
      const voces = [...new Set([...registrados.map((a) => a.ruta).filter((r) => cuboDe(r) === 'voz'), ...(await b.storage.listar(atletaId, 'voz').catch(() => []))])];
      // Y sus fotos del muro (v0.43, bucket «comunidad»; sin la migración 027, no hay)
      const delMuro = await b.storage.listar(atletaId, 'comunidad').catch(() => []);
      // (v0.60, revisión H1) Primero la fila (si la base no la deja borrar, sus archivos siguen ahí) y después Storage: lo
      // borrado sale de la cola de Storage (lo que no se pueda borrar ahora se queda en ella y lo vacía el coach)
      const r = await b.delete('atletas', { eq: { id: atletaId } });
      const hechas = [];
      if (rutas.length) hechas.push(...((await b.storage.borrar(rutas.filter((x) => cuboDe(x) === 'archivos')).catch(() => null)) || []));
      if (voces.length) hechas.push(...((await b.storage.borrar(voces, 'voz').catch(() => null)) || []));
      if (delMuro.length) await b.storage.borrar(delMuro, 'comunidad').catch(() => {});
      if (hechas.length) await b.rpc('storage_borrado', { p_rutas: hechas }).catch(() => {});
      return r;
    },
    // Verificación en dos pasos del coach: una vez activada, la base la exige siempre
    async exigirDosPasos(valor) {
      return b.update('perfiles', { exige_2fa: !!valor }, { eq: { id: uid() } });
    },
    async crearInvitacion(atletaId) {
      return b.rpc('crear_invitacion', { p_atleta: atletaId });
    },
    async ficha(atletaId) {
      // (pulido 4) la ficha y lo suyo se piden a la vez; la foto, que sale de su perfil, a la vez que lo demás
      const [atleta, checkins, pesos, molestias, notas] = await Promise.all([
        (async () => {
          const [ficha] = await b.select('atletas', { eq: { id: atletaId } });
          const fotoDe = ficha?.perfil_id ? (await fotosDePerfiles([ficha.perfil_id])).get(ficha.perfil_id) || null : null;
          return ficha ? { ...ficha, foto: fotoDe } : ficha;
        })(),
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
        b.select('atletas', { cols: 'id,nombre,estado,perfil_id', order: [['nombre', 'asc']] }).then((xs) => xs.filter((a) => a.perfil_id == null || a.perfil_id !== uid())),
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
        b.select('comentarios', { eq: { autor: 'atleta' }, nulo: ['leido_en'], order: [['creado_en', 'desc']] }).then((xs) => xs.filter((c) => !c.eliminado_en)),
        b.select('archivos', { nulo: ['revisado_en'], neq: { tipo: 'adjunto' }, order: [['creado_en', 'desc']] }).then((xs) => xs.filter((a) => a.tipo !== 'documento' && a.tipo !== 'audio')),
        api.atletas(),
      ]);
      const A = porId(atletas);
      // (pulido 4) Lo que sale de esa primera tanda se pide a la vez (antes, una consulta detrás de otra: unas quince
      // esperas seguidas; ahora, dos). Lo que se arma con ello es lo mismo.
      const vids = archivos.map((a) => ({ ...a, atleta: A[a.atleta_id] || null })).filter((a) => a.atleta);
      const [
        [semanas, bloques], [pautas, series], molestias, sesionesAdj, preguntas, deVideos, deRecetas, comunidad, deTareas,
      ] = await Promise.all([
        (async () => {
          const semanas = porId(await b.select('semanas', { in: { id: unicos(sesiones.map((s) => s.semana_id)) } }));
          const bloques = porId(await b.select('bloques', { in: { id: unicos(Object.values(semanas).map((w) => w.bloque_id)) } }));
          return [semanas, bloques];
        })(),
        (async () => {
          const pautas = await b.select('sesion_ejercicios', { in: { sesion_id: sesiones.map((s) => s.id) } });
          const series = await b.select('series', { in: { sesion_ejercicio_id: pautas.map((p) => p.id) } });
          return [pautas, series];
        })(),
        checkins.length ? b.select('molestias', { in: { atleta_id: unicos(checkins.map((c) => c.atleta_id)) }, gte: { semana_inicio: desde } }) : [],
        b.select('sesiones', { in: { id: unicos(comentarios.map((c) => c.sesion_id)).filter((id) => !sesiones.some((s) => s.id === id)) } }).then(porId),
        // Las preguntas del coach que se han respondido en esos check-ins
        checkins.some((c) => c.respuestas) ? b.select('preguntas_checkin', {}).catch(() => []).then(porId) : {},
        // (v0.57) los vídeos, con su ejercicio, su serie y su corrección (para «Revisar seguidos»)
        (async () => {
          // (v0.61) de todos los que van con un ejercicio de una sesión: su sesión y su orden en ella (para «Revisar la sesión»)
          const seIds = unicos(vids.filter((a) => a.sesion_ejercicio_id).map((a) => a.sesion_ejercicio_id));
          const [PA, extra, autos] = await Promise.all([
            seIds.length ? b.select('sesion_ejercicios', { in: { id: seIds }, cols: 'id,ejercicio_id,sesion_id,orden' }).catch(() => []).then(porId) : {},
            api.extrasVideos(vids),
            // (v0.59, 037) y lo que nota el atleta (su valoración al enviarlo)
            api.autoevaluaciones(vids.filter((a) => a.tipo === 'video_tecnica').map((a) => a.id)).catch(() => ({})),
          ]);
          const sIds = unicos(Object.values(PA).map((x) => x.sesion_id).filter(Boolean));
          const ejDe = (a) => a.ejercicio_id || PA[a.sesion_ejercicio_id]?.ejercicio_id || null;
          const ejIds = unicos(vids.map(ejDe));
          const [SV, EJ] = await Promise.all([
            sIds.length ? b.select('sesiones', { in: { id: sIds }, cols: 'id,nombre,fecha_realizada' }).catch(() => []).then(porId) : {},
            ejIds.length ? b.select('ejercicios', { in: { id: ejIds }, cols: 'id,nombre,grupos_musculares,tipo' }).catch(() => []).then(porId) : {},
          ]);
          return { PA, SV, EJ, extra, autos, ejDe };
        })(),
        // Recetas que un atleta pide cambiar (v0.26; sin la migración 022, ninguna)
        (async () => {
          const cambios = await b.select('recetas_atleta', { nonulo: ['cambio_pedido_en'], order: [['cambio_pedido_en', 'desc']] }).catch(() => []);
          const R = cambios.length ? porId(await b.select('recetas', { in: { id: unicos(cambios.map((c) => c.receta_id)) }, cols: 'id,nombre,foto_mini' })) : {};
          return { cambios, R };
        })(),
        // Avisos de la comunidad (v0.43; sin la migración 027, ninguno)
        api.reportesComunidad().catch(() => []),
        // Tareas hechas por revisar (v0.48; sin la migración 030, ninguna)
        (async () => {
          const tareas = await b.select('tareas', { nonulo: ['hecha_en'], nulo: ['revisada_en'], order: [['hecha_en', 'desc']] }).catch(() => []);
          const ejT = unicos(tareas.map((t) => t.ejercicio_id));
          const arT = unicos(tareas.map((t) => t.archivo_id));
          const [EJ, AR] = await Promise.all([
            ejT.length ? b.select('ejercicios', { in: { id: ejT }, cols: 'id,nombre' }).then(porId).catch(() => ({})) : {},
            arT.length ? b.select('archivos', { in: { id: arT } }).then(porId).catch(() => ({})) : {},
          ]);
          return { tareas, EJ, AR };
        })(),
      ]);
      const seriesPorPauta = agrupar(series, 'sesion_ejercicio_id');
      const pautasPorSesion = agrupar(pautas, 'sesion_id');
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
        archivos: vids,
        recetas: [],
      };
      {
        const { PA, SV, EJ, extra, autos, ejDe } = deVideos;
        items.archivos = vids.map((a) => {
          const pa = a.sesion_ejercicio_id ? PA[a.sesion_ejercicio_id] || null : null;
          const se = pa?.sesion_id ? SV[pa.sesion_id] || null : null;
          return { ...a, ejercicio: EJ[ejDe(a)] || null, serie: extra.series[a.id] || null, revision: extra.revisiones[a.id] || null, autoevaluacion: autos[a.id] || null,
            pauta: pa ? { sesion_id: pa.sesion_id, orden: pa.orden } : null, sesionVideo: se ? { id: se.id, nombre: se.nombre, fecha: se.fecha_realizada || a.fecha } : null };
        });
      }
      {
        const { cambios, R } = deRecetas;
        if (cambios.length) items.recetas = cambios.map((c) => ({ ...c, receta: R[c.receta_id] || null, atleta: A[c.atleta_id] || null })).filter((c) => c.atleta && c.receta);
      }
      items.comunidad = comunidad;
      {
        const { tareas, EJ, AR } = deTareas;
        items.tareas = tareas.map((t) => ({ ...t, atleta: A[t.atleta_id] || null, ejercicio: EJ[t.ejercicio_id] || null, archivo: AR[t.archivo_id] || null })).filter((t) => t.atleta);
      }
      // Los mensajes cuentan por conversación (como se ven en Revisar), no uno a uno
      const hilo = (c) => c.sesion_id || c.checkin_id || c.archivo_id || `general-${c.atleta_id}`;
      const unicosHilos = [...new Map(items.comentarios.map((c) => [hilo(c), c])).values()];
      const porAtleta = {};
      for (const lista of [items.sesiones, items.checkins, unicosHilos, items.archivos, items.recetas, items.tareas]) for (const x of lista) porAtleta[x.atleta.id] = (porAtleta[x.atleta.id] || 0) + 1;
      return { ...items, total: items.sesiones.length + items.checkins.length + unicosHilos.length + items.archivos.length + items.recetas.length + items.comunidad.length + items.tareas.length, porAtleta };
    },
    async marcarRevisado(tipo, id, revisado = true) {
      const [tabla, col] = REVISION[tipo];
      return (await b.update(tabla, { [col]: revisado ? new Date().toISOString() : null }, { eq: { id } }))[0];
    },

    // ------------------------------------------------------------ coach: programar
    async bloqueCompleto(bloqueId) {
      // (pulido 4) el bloque y sus semanas, a la vez (una espera menos al abrir el editor)
      const [[bloque], semanas] = await Promise.all([
        b.select('bloques', { eq: { id: bloqueId } }),
        b.select('semanas', { eq: { bloque_id: bloqueId }, order: [['numero', 'asc']] }),
      ]);
      if (!bloque) throw new Error('No se encuentra el bloque.');
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
    // (pulido 3.5) La biblioteca de ejercicios (unos 385 kB con sus instrucciones) se guarda en el dispositivo y solo
    // se vuelve a bajar cuando cambia: con la migración 048, la base da una huella de su contenido (una respuesta de
    // unas letras) y, si es la de lo guardado, no se baja nada. Sin la migración, se baja entera como hasta ahora.
    async biblioteca() {
      const entera = () => b.select('ejercicios', { order: [['nombre', 'asc']] });
      const yo = uid();
      if (!yo || con048 === false) return entera();
      let huella;
      try { huella = await b.rpc('biblioteca_huella'); con048 = true; } catch (e) { if (!falta048(e)) throw e; con048 = false; return entera(); }
      const copias = (filas) => filas.map((x) => (typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x))));
      if (bibliotecaGuardada && bibliotecaGuardada.de === yo && bibliotecaGuardada.huella === huella) return copias(bibliotecaGuardada.filas);
      // (la base del navegador solo se abre si hay nota de que se guardó: la primera vez no hay nada que leer)
      let nota = null; try { nota = localStorage.getItem(NOTA_BIBLIOTECA); } catch { /* sin almacenamiento */ }
      const delMovil = nota === yo ? await copiaDelMovil().leer(yo, CLAVE_BIBLIOTECA).catch(() => null) : null;
      if (delMovil?.datos?.huella === huella && Array.isArray(delMovil.datos.filas)) {
        bibliotecaGuardada = { de: yo, huella, filas: delMovil.datos.filas };
        return copias(bibliotecaGuardada.filas);
      }
      const filas = await entera();
      // (si cambiara justo entre la huella y la descarga, la huella siguiente ya no coincide y se vuelve a bajar)
      if (uid() === yo) {
        bibliotecaGuardada = { de: yo, huella, filas };
        copiaDelMovil().guardar(yo, CLAVE_BIBLIOTECA, { huella, filas }).then((ok) => { if (ok) { try { localStorage.setItem(NOTA_BIBLIOTECA, yo); } catch { /* */ } } }, () => {});
      }
      return copias(filas);
    },
    async ejerciciosPorIds(ids) {
      return ids.length ? b.select('ejercicios', { in: { id: ids } }) : [];
    },
    async crear(tabla, fila) { return (await b.insert(tabla, [fila]))[0]; },
    async actualizar(tabla, id, cambios) { return (await b.update(tabla, cambios, { eq: { id } }))[0]; },
    // Pauta serie a serie (migración 024): con detalle, el resumen de siempre sale de él; sin él (null), se deja el
    // resumen como está y vuelven las series iguales. Devuelve los cambios guardados.
    async guardarDetalle(pautaId, detalle) {
      const d = detalle == null ? null : limpiarDetalle(detalle);
      if (detalle != null && !d) throw new Error('Revisa las series: reps entre 0 y 1000, kilos entre 0 y 9999 y RPE entre 1 y 10.');
      const cambios = d ? { series_detalle: d, ...agregadosDetalle(d), backoff_pct: null } : { series_detalle: null };
      await b.update('sesion_ejercicios', cambios, { eq: { id: pautaId } }).catch(falta024);
      return cambios;
    },
    async borrar(tabla, id) { return b.delete(tabla, { eq: { id } }); },
    // Deja las semanas de un bloque seguidas desde la 1 (y, con fecha de inicio, una por semana desde ella)
    async renumerarSemanas(bloqueId) {
      const [bloque] = await b.select('bloques', { eq: { id: bloqueId } });
      const semanas = await b.select('semanas', { eq: { bloque_id: bloqueId }, order: [['numero', 'asc']] });
      for (const [i, w] of semanas.entries()) {
        const cambios = { numero: i + 1, ...(bloque?.fecha_inicio ? { fecha_inicio: sumarDias(bloque.fecha_inicio, 7 * i) } : {}) };
        if (cambios.numero !== w.numero || (cambios.fecha_inicio && cambios.fecha_inicio !== w.fecha_inicio)) await b.update('semanas', cambios, { eq: { id: w.id } });
      }
    },
    // Borrar una semana de un bloque: las de después suben un puesto (la 4 pasa a ser la 3) y una semana antes,
    // para que el bloque siga siendo seguido (antes, al borrar las 3 primeras, la que quedaba seguía siendo la «semana 4»)
    async borrarSemana(semanaId) {
      const [s] = await b.select('semanas', { eq: { id: semanaId } });
      await b.delete('semanas', { eq: { id: semanaId } });
      if (!s) return [];
      const despues = (await b.select('semanas', { eq: { bloque_id: s.bloque_id }, order: [['numero', 'asc']] })).filter((w) => w.numero > s.numero);
      const movidas = [];
      for (const w of despues) {
        const [x] = await b.update('semanas', { numero: w.numero - 1, ...(w.fecha_inicio ? { fecha_inicio: sumarDias(w.fecha_inicio, -7) } : {}) }, { eq: { id: w.id } });
        movidas.push(x);
      }
      return movidas;
    },

    // Variantes de material (v0.30): los ejercicios de los bloques en marcha o por empezar cuya variante nombra un
    // material distinto del ejercicio («Press militar sentado con mancuernas», variante «En máquina»). Uno por bloque,
    // ejercicio y variante (se repite en cada semana), con las propuestas de la biblioteca.
    async variantesPorRevisar() {
      const [bloques, atletas, biblioteca] = await Promise.all([
        b.select('bloques', { eq: { es_plantilla: false }, in: { estado: ['planificado', 'activo', 'ajustado'] } }),
        api.atletas(),
        api.biblioteca(),
      ]);
      const A = porId(atletas), E = porId(biblioteca);
      const vivos = bloques.filter((x) => A[x.atleta_id] && A[x.atleta_id].estado !== 'baja');
      if (!vivos.length) return [];
      // (pulido 3.3) solo las columnas que hacen falta: las pautas enteras de todos los bloques vivos eran 430 kB
      const semanas = await b.select('semanas', { in: { bloque_id: vivos.map((x) => x.id) }, cols: 'id,bloque_id' });
      const sesiones = semanas.length ? await b.select('sesiones', { in: { semana_id: semanas.map((w) => w.id) }, cols: 'id,semana_id,nombre' }) : [];
      const pautas = sesiones.length ? await b.select('sesion_ejercicios', { in: { sesion_id: sesiones.map((x) => x.id) }, nonulo: ['variante'], cols: 'id,sesion_id,ejercicio_id,variante' }) : [];
      const S = porId(sesiones), W = porId(semanas), B = porId(vivos);
      const grupos = new Map();
      for (const p of pautas) {
        const ej = E[p.ejercicio_id];
        const r = ej && revisarVariante(ej, p.variante, biblioteca);
        if (!r) continue;
        const bloque = B[W[S[p.sesion_id]?.semana_id]?.bloque_id];
        if (!bloque) continue;
        const clave = `${bloque.id}|${ej.id}|${p.variante}`;
        if (!grupos.has(clave)) grupos.set(clave, { clave, atleta: A[bloque.atleta_id], bloque, ejercicio: ej, variante: p.variante, revision: r, pautas: 0, sesion: S[p.sesion_id]?.nombre || null });
        grupos.get(clave).pautas++;
      }
      return [...grupos.values()].sort((x, y) => x.atleta.nombre.localeCompare(y.atleta.nombre, 'es') || x.ejercicio.nombre.localeCompare(y.ejercicio.nombre, 'es'));
    },
    // Cambia en todo el bloque (todas las semanas) el ejercicio con esa variante: por el ejercicio que cuadra (lo ya
    // registrado pasa a él, que es el que se hizo) y la variante sin el material; o, sin ejercicio nuevo, quita la variante.
    async corregirVariante({ bloqueId, ejercicioId, variante, nuevoEjercicioId = null }) {
      // Un bloque cerrado es historia: no se le cambia nada de golpe
      const [bloque] = await b.select('bloques', { eq: { id: bloqueId }, cols: 'id,estado' });
      if (!bloque) throw new Error('No se encuentra el bloque.');
      if (['finalizado', 'cancelado'].includes(bloque.estado)) throw new Error('Ese bloque ya está cerrado: cámbialo a mano si hace falta.');
      const semanas = await b.select('semanas', { eq: { bloque_id: bloqueId }, cols: 'id' });
      const sesiones = semanas.length ? await b.select('sesiones', { in: { semana_id: semanas.map((w) => w.id) }, cols: 'id' }) : [];
      const pautas = sesiones.length ? await b.select('sesion_ejercicios', { in: { sesion_id: sesiones.map((x) => x.id) }, eq: { ejercicio_id: ejercicioId, variante }, cols: 'id' }) : [];
      if (!pautas.length) return 0;
      const cambios = nuevoEjercicioId ? { ejercicio_id: nuevoEjercicioId, variante: varianteSinMaterial(variante) } : { variante: null };
      const ids = pautas.map((p) => p.id);
      await b.update('sesion_ejercicios', cambios, { in: { id: ids } });
      // Los vídeos de esas series pasan también al ejercicio nuevo (si no, en su diario saldrían con el viejo)
      if (nuevoEjercicioId) await b.update('archivos', { ejercicio_id: nuevoEjercicioId }, { in: { sesion_ejercicio_id: ids }, eq: { ejercicio_id: ejercicioId } }).catch(() => {});
      return pautas.length;
    },

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
          // (series_detalle solo si la base lo tiene: sin la 024, la fila no trae la columna y no se manda)
          const f = progresarPauta(Object.fromEntries(CAMPOS_SE.filter((c) => c !== 'series_detalle' || c in p).map((c) => [c, p[c] ?? null])), opciones, { nombre: nombres[p.ejercicio_id] || '', descarga });
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

  // ------------------------------------------------------------ v0.65: abrir sin cobertura
  // Lo que hace falta para abrir Hoy y la sesión (tu perfil y tu ficha, los consentimientos, el programa, cada sesión con «ant.»
  // y las notas, tus marcas y los «Recuerda») se guarda en el móvil al llegar de la base (datos/copia.js, por cuenta; solo lo
  // tuyo: lo de otros atletas que ve el coach, nunca). Al pedirlo otra vez, la base tiene ESPERA_RED_MS para contestar; si no
  // contesta (o no hay red), sale la copia, y lo de la base, cuando llega, se guarda y se avisa a la pantalla («fbe-copia») para
  // que se ponga al día sola. Si la red acaba de fallar, durante un rato ni se espera: la copia, al momento.
  const ESPERA_RED_MS = 1200;
  let redFlojaHasta = 0;
  let miAtletaId = null;
  const sinRedAhora = () => typeof navigator !== 'undefined' && navigator.onLine === false;
  const sinConexion = () => { const e = new Error('Sin conexión.'); e.sinConexion = true; return e; };
  // (pulido 3.8) alInstante: lo de abrir la app (tu perfil, tu ficha, los consentimientos y el programa). La primera vez
  // que se pide desde que se abrió la app, si hay copia, sale la copia sin esperar a la base (antes se le daban 1,2 s
  // a cada una, una detrás de otra: con una cobertura regular, Hoy tardaba 2 o 3 segundos en verse); lo de la base llega
  // enseguida por «fbe-copia» y la pantalla se pone al día sola. Las veces siguientes (tras guardar algo, al cambiar de
  // día), como siempre: primero la base. vale: si esa copia sirve para enseñarla sin esperar.
  const abiertas = new Set();
  async function conCopia(clave, pedir, { alInstante = false, vale = null } = {}) {
    const id = uid();
    const red = Promise.resolve().then(pedir);
    if (!id) return red;
    const almacen = copiaDelMovil();
    red.then((d) => { redFlojaHasta = 0; if (uid() === id) almacen.guardar(id, clave, d); }, (e) => { if (esTemporal(e)) redFlojaHasta = Date.now() + 20000; });
    const guardada = await almacen.leer(id, clave);
    const primera = !abiertas.has(`${id}|${clave}`);
    abiertas.add(`${id}|${clave}`);
    if (!guardada) return red;
    let deCopia = false;
    red.then((d) => { if (deCopia && uid() === id && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('fbe-copia', { detail: { clave, datos: d } })); }, () => {});
    let instante = false;
    try { instante = alInstante && primera && (!vale || !!vale(guardada.datos)); } catch { instante = false; }
    const espera = instante || sinRedAhora() || Date.now() < redFlojaHasta ? 0 : ESPERA_RED_MS;
    const r = await Promise.race([red.then((d) => ({ d }), (e) => ({ e })), new Promise((ok) => { setTimeout(() => ok(null), espera); })]);
    if (r && 'd' in r) return r.d;
    if (r && !esTemporal(r.e)) throw r.e;
    // (enseñar la copia al instante no quiere decir que la red vaya mal)
    if (!r && !instante) redFlojaHasta = Date.now() + 20000;
    deCopia = true;
    return guardada.datos;
  }
  // (pulido 3.9) Lo apuntado en Hoy sin conexión (una comida, un hábito, el peso: datos/cola.js) se ve encima de lo que
  // diga la base hasta que se envía: si la pantalla se vuelve a cargar antes, no «se desmarca». usarCola: main.jsx le
  // da aquí lo que espera en la cola
  let enCola = () => [];
  const leido = { menuSemana: api.menuSemana, registrosHabitos: api.registrosHabitos, pesos: api.pesos };
  Object.assign(api, {
    usarCola(fn) { enCola = typeof fn === 'function' ? fn : () => []; },
    menuSemana: async (atletaId, lunes) => menuConCola(await leido.menuSemana(atletaId, lunes), enCola(), atletaId),
    registrosHabitos: async (atletaId, desde, hasta = null) => registrosHabitoConCola(await leido.registrosHabitos(atletaId, desde, hasta), enCola(), atletaId, { desde, hasta }),
    pesos: async (atletaId, dias = 120) => pesosConCola(await leido.pesos(atletaId, dias), enCola(), atletaId, { desde: sumarDias(hoyISO(), -dias) }),
  });
  const propia = (atletaId) => !!atletaId && atletaId === miAtletaId;
  const sinCopia = { perfil: api.perfil, miAtleta: api.miAtleta, consentimientos: api.consentimientos, programa: api.programa, sesion: api.sesion, marcasPrevias: api.marcasPrevias, recordatoriosActivos: api.recordatoriosActivos };
  Object.assign(api, {
    // (al instante solo para atletas: la cuenta de coach comprueba su verificación en dos pasos con lo que diga la base)
    perfil: () => conCopia(CLAVES_COPIA.perfil(), sinCopia.perfil, { alInstante: true, vale: (p) => !!p?.id && p.rol !== 'coach' }),
    async miAtleta() {
      const a = await conCopia(CLAVES_COPIA.atleta(), sinCopia.miAtleta, { alInstante: true, vale: (x) => !!x?.id });
      miAtletaId = a?.id || null;
      return a;
    },
    consentimientos: () => conCopia(CLAVES_COPIA.consentimientos(), sinCopia.consentimientos, { alInstante: true, vale: (x) => Array.isArray(x) }),
    programa: (atletaId, opciones) => (opciones === undefined && propia(atletaId) ? conCopia(CLAVES_COPIA.programa(atletaId), () => sinCopia.programa(atletaId), { alInstante: true, vale: (x) => !!x }) : sinCopia.programa(atletaId, opciones)),
    sesion: (sesionId, atletaId) => (propia(atletaId) ? conCopia(CLAVES_COPIA.sesion(sesionId), () => sinCopia.sesion(sesionId, atletaId)) : sinCopia.sesion(sesionId, atletaId)),
    marcasPrevias: (atletaId, sesionId = null) => (propia(atletaId) && sesionId ? conCopia(CLAVES_COPIA.marcas(sesionId), () => sinCopia.marcasPrevias(atletaId, sesionId)) : sinCopia.marcasPrevias(atletaId, sesionId)),
    // (con la copia, sin red no vale «ninguno»: la de antes no se pisa con una lista vacía)
    recordatoriosActivos: (atletaId) => (!propia(atletaId) ? sinCopia.recordatoriosActivos(atletaId) : conCopia(CLAVES_COPIA.recordatorios(atletaId), async () => {
      const v = await api.video037();
      if (v === null) throw sinConexion();
      return v ? (await b.rpc('recordatorios_activos', { p_atleta: atletaId })) || [] : [];
    })),
    // Tras una visita con conexión: las sesiones que quedan de esta semana (hoy y lo que viene) se dejan en el móvil, con sus
    // marcas y los recordatorios; solo lo que no se ha puesto al día en la última media hora (para no cargar la base)
    async prepararSinRed(p, { n = 3, hace = 30 * 60000 } = {}) {
      const id = uid();
      if (!id || !propia(p?.bloque?.atleta_id) || sinRedAhora()) return 0;
      const almacen = copiaDelMovil();
      const viejo = async (clave) => { const x = await almacen.leer(id, clave); return !x || Date.now() - x.t > hace; };
      let hechas = 0;
      for (const s of sesionesAPreparar(p, n)) {
        if (sinRedAhora() || uid() !== id) break;
        try {
          if (await viejo(CLAVES_COPIA.sesion(s))) { await api.sesion(s, miAtletaId); hechas++; }
          if (await viejo(CLAVES_COPIA.marcas(s))) await api.marcasPrevias(miAtletaId, s);
        } catch { break; }
      }
      if (hechas && await viejo(CLAVES_COPIA.recordatorios(miAtletaId))) await api.recordatoriosActivos(miAtletaId).catch(() => {});
      return hechas;
    },
  });

  // ------------------------------------------------------------ (pulido 2.9) la lista del coach, al abrir
  // La última lista de atletas que cargó el coach se queda en su dispositivo (con la copia de arriba: por cuenta, se
  // borra entera al cerrar la sesión y caduca a los 14 días sin usarse), para enseñarla al abrir la app mientras llega
  // la de ahora. Es lo mismo que enseña la lista (nombre, estado, avisos, cumplimiento, la tendencia de peso), nada más.
  const CLAVE_LISTA = 'lista-atletas';
  const resumenesDeLaBase = api.resumenes;
  Object.assign(api, {
    async resumenes(hoy, opciones) {
      const id = uid();
      const lista = await resumenesDeLaBase(hoy, opciones);
      if (id && hoy === undefined && !opciones?.soloAtleta && uid() === id && Array.isArray(lista)) copiaDelMovil().guardar(id, CLAVE_LISTA, lista).catch(() => {});
      return lista;
    },
    // La guardada (o null): solo para enseñarla mientras llega la de ahora
    async resumenesGuardados() {
      const id = uid();
      if (!id) return null;
      const x = await copiaDelMovil().leer(id, CLAVE_LISTA).catch(() => null);
      return Array.isArray(x?.datos) && uid() === id ? x.datos : null;
    },
  });

  // (v0.65, revisión) lo que se apunta (directo o desde la cola) se pone también en la copia de su sesión: si no, al volver a
  // abrir la app sin red (o con la red lenta) la sesión salía de una copia sin esas series, proponía otra vez la serie 1 y
  // la nueva pisaba la de verdad en la base. Se usa la misma mezcla que pone encima lo que espera en la cola.
  const sesionDeEjercicio = new Map(); // sesion_ejercicio_id → sesion id (de las sesiones propias que se han abierto)
  const anotarSesion = (sesionId, d) => { for (const e of d?.ejercicios || []) sesionDeEjercicio.set(e.id, sesionId); };
  const leerSesion = api.sesion;
  api.sesion = async (sesionId, atletaId) => { const d = await leerSesion(sesionId, atletaId); if (propia(atletaId)) anotarSesion(sesionId, d); return d; };
  let ponerAlDia = Promise.resolve();
  const enLaCopia = (sesionId, op) => {
    const id = uid();
    if (!id || !sesionId) return;
    // (una detrás de otra: dos series seguidas no se pisan al leer y guardar la copia)
    ponerAlDia = ponerAlDia.then(async () => {
      const almacen = copiaDelMovil();
      const clave = CLAVES_COPIA.sesion(sesionId);
      const x = await almacen.leer(id, clave);
      if (x?.datos && uid() === id) await almacen.guardar(id, clave, sesionConCola(x.datos, [op]));
    }).catch(() => {});
  };
  const originales = { guardarSerie: api.guardarSerie, borrarSerie: api.borrarSerie, marcarSesion: api.marcarSesion };
  Object.assign(api, {
    async guardarSerie(datos, atletaId) {
      const fila = await originales.guardarSerie(datos, atletaId);
      enLaCopia(sesionDeEjercicio.get(datos.sesion_ejercicio_id), { tipo: 'serie', datos: { ...datos, ...(fila || {}) } });
      return fila;
    },
    async borrarSerie(sesionEjercicioId, numero) {
      const r = await originales.borrarSerie(sesionEjercicioId, numero);
      enLaCopia(sesionDeEjercicio.get(sesionEjercicioId), { tipo: 'borrarSerie', datos: { sesion_ejercicio_id: sesionEjercicioId, numero } });
      return r;
    },
    async marcarSesion(sesionId, cambios) {
      const r = await originales.marcarSesion(sesionId, cambios);
      enLaCopia(sesionId, { tipo: 'sesion', datos: { id: sesionId, cambios } });
      return r;
    },
  });
  return api;
}
