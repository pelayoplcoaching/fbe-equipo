// FBE Esencial, el piloto (del 11/1 al 4/4/2027, con la revisión de la semana 6): lo que mira Pelayo de quienes van por
// su cuenta, sacado de los resúmenes que ya carga la lista de Atletas (resumenAtleta), y las encuestas de las semanas 6
// y 12, que se mandan como una tarea de texto (migración 030: sin nada nuevo en la base). Lógica pura.
import { diasEntre } from './fechas.js';

// El listón para abrirlo a todos (plan del 24/11, «claude/por-tu-cuenta-plan.md»)
export const LISTON_ESENCIAL = { sesiones: 75, siguen: 14 / 20 };

// Las encuestas: una tarea de texto (título de hasta 120 letras y detalle de hasta 600), una en la revisión de la semana 6
// y otra al acabar el piloto (semana 12). Pelayo puede retocar las preguntas antes de mandarlas; el título no se toca,
// porque las respuestas se reconocen por él.
const PREGUNTAS = 'Tres preguntas rápidas; contesta en el recuadro, como quieras:\n1. Del 0 al 10, ¿cuánto recomendarías FBE Esencial a un amigo?\n';
export const ENCUESTAS_ESENCIAL = [
  { id: 's6', nombre: 'Semana 6', titulo: 'Tu opinión sobre FBE Esencial (semana 6)',
    detalle: `${PREGUNTAS}2. ¿Qué es lo que más te está ayudando y qué cambiarías?\n3. Si no tuvieras el precio de fundador, ¿seguirías por 19,99 € al mes (29,99 € con nutrición)?` },
  { id: 's12', nombre: 'Al acabar (semana 12)', titulo: 'Tu opinión sobre FBE Esencial (semana 12)',
    detalle: `${PREGUNTAS}2. ¿Qué es lo que más te ha ayudado y qué cambiarías?\n3. ¿Vas a seguir después del piloto? Si no, ¿qué te haría seguir?` },
];
export const ENCUESTA_ESENCIAL = ENCUESTAS_ESENCIAL[0];
export const TITULOS_ENCUESTA = ENCUESTAS_ESENCIAL.map((e) => e.titulo);

const vivo = (r) => r.estado !== 'baja' && r.estado !== 'invitado';

// Una fila del panel: su semana, lo de esta semana, la última sesión y cómo va (ok, ambar o rojo)
// alta: su fila de esencial_alta_estado (097), si la hay: los avisos que tiene y si su semana 1 sigue sin empezar
export function filaPiloto(r, hoy, alta = null) {
  const dias = r.ultimaSesion ? diasEntre(r.ultimaSesion, hoy) : null;
  const avisos = (r.alertas || []).filter((a) => a.nivel !== 'info');
  // (en la semana 2 de su plan o después sin haber entrenado nunca, también ámbar; y desde el jueves de su semana 1)
  const s1 = semana1SinEmpezar(alta, r, hoy);
  const sinEmpezar = (dias == null && (r.semana?.numero || 0) >= 2) || s1;
  const nivel = r.estado === 'baja' ? 'rojo' : avisos.some((a) => a.nivel === 'alerta') || (dias != null && dias >= 10) ? 'rojo'
    : avisos.length || (dias != null && dias >= 7) || sinEmpezar ? 'ambar' : 'ok';
  const semana = r.bloque && r.semana?.numero ? `Semana ${r.semana.numero} de «${r.bloque.nombre}»` : r.bloque ? r.bloque.nombre : 'Antes de empezar';
  const ultima = r.estado === 'baja' ? 'De baja' : dias == null ? 'Aún sin entrenar' : dias === 0 ? 'Entrenó hoy' : dias === 1 ? 'Entrenó ayer' : `Hace ${dias} días`;
  return { semana, ultima, nivel, avisos: [...(s1 ? ['Semana 1 sin empezar'] : []), ...(r.alertas || []).map((a) => a.texto)], sesiones: r.sesiones || { completadas: 0, total: 0 },
    comida: r.servicio === 'completo', notificaciones: alta && r.estado !== 'baja' ? avisosDe(alta) : null };
}

// Las cifras del piloto: cuántos hay, cuántos siguen, cuántos han entrenado esta semana, las sesiones apuntadas de las
// pautadas en sus 4 últimas semanas (el listón: 3 de cada 4) y la encuesta (mandadas y contestadas)
export function cifrasPiloto(resumenes = [], hoy, encuesta = [], altas = null) {
  const altaDe = new Map((altas || []).map((x) => [x.atleta_id, x]));
  const suyos = resumenes.filter((r) => r.modalidad === 'por_su_cuenta' && r.estado !== 'invitado');
  const siguen = suyos.filter(vivo);
  const conPlan = siguen.filter((r) => r.bloque);
  const entrenaron = conPlan.filter((r) => r.ultimaSesion && diasEntre(r.ultimaSesion, hoy) < 7).length;
  const sem = conPlan.reduce((t, r) => ({ hechas: t.hechas + (r.sesiones?.completadas || 0), pautadas: t.pautadas + (r.sesiones?.total || 0) }), { hechas: 0, pautadas: 0 });
  // (las sesiones de sus 4 últimas semanas acabadas: cumplimiento() de logica/informe.js)
  const s4 = conPlan.reduce((t, r) => ({ hechas: t.hechas + (r.cumplimiento?.sesiones?.hechas || 0), total: t.total + (r.cumplimiento?.sesiones?.total || 0) }), { hechas: 0, total: 0 });
  const pct = s4.total ? Math.round((100 * s4.hechas) / s4.total) : null;
  // (las series pautadas hechas en esas 4 semanas: si hacen la semana tal cual se la prepara la app)
  const se = conPlan.reduce((t, r) => ({ hechas: t.hechas + (r.cumplimiento?.series?.hechas || 0), pautadas: t.pautadas + (r.cumplimiento?.series?.pautadas || 0) }), { hechas: 0, pautadas: 0 });
  const ids = new Set(suyos.map((r) => r.atleta_id));
  // (cada encuesta: a cuántos se mandó y cuántos contestaron; «encuesta» es la última mandada, o la primera si no hay)
  const encuestas = ENCUESTAS_ESENCIAL.map((e) => {
    const tareas = encuesta.filter((t) => ids.has(t.atleta_id) && t.titulo === e.titulo);
    return { id: e.id, nombre: e.nombre, mandadas: tareas.length, contestadas: tareas.filter((t) => t.hecha_en).length };
  });
  return {
    total: suyos.length, siguen: siguen.length, bajas: suyos.length - siguen.length, conPlan: conPlan.length, entrenaron,
    // (dados de alta que aún no han activado su cuenta con su código)
    sinActivar: resumenes.filter((r) => r.modalidad === 'por_su_cuenta' && r.estado === 'invitado').map((r) => r.nombre),
    series4: { ...se, pct: se.pautadas ? Math.round((100 * se.hechas) / se.pautadas) : null },
    sesionesSemana: sem, sesiones4: { ...s4, pct }, cumpleSesiones: pct != null && pct >= LISTON_ESENCIAL.sesiones,
    conAvisos: siguen.filter((r) => filaPiloto(r, hoy, altaDe.get(r.atleta_id)).nivel !== 'ok').length,
    encuestas, encuesta: [...encuestas].reverse().find((e) => e.mandadas) || encuestas[0],
  };
}

// ---------- El alta (las 60 mejoras del alta, 25/11/2026; datos de esencial_alta_estado, migración 097) ----------
// altas: las filas de esencial_alta_estado; resumenes: los de la lista de Atletas (para el nombre, el estado y la baja).
const dia = (t) => (t ? String(t).slice(0, 10) : null);

// El embudo: invitados, cuenta activa, cuestionario, con plan y primera sesión (de quienes no están de baja); los vistos
// buenos por confirmar; quién tiene la cuenta activa sin ningún aviso (no le llegará ninguno) y cuántos días tarda la
// mitad desde la invitación hasta su primera sesión.
export function embudoAlta(altas = [], resumenes = []) {
  const vivos = new Map(resumenes.filter((r) => r.modalidad === 'por_su_cuenta' && r.estado !== 'baja').map((r) => [r.atleta_id, r]));
  const xs = (altas || []).filter((a) => vivos.has(a.atleta_id));
  const n = (f) => xs.filter(f).length;
  const activa = (a) => !!a.activado_en || vivos.get(a.atleta_id)?.estado === 'activo';
  const dias = xs.filter((a) => a.invitado_en && a.primera_sesion).map((a) => Math.max(0, diasEntre(dia(a.invitado_en), a.primera_sesion))).sort((a, b) => a - b);
  return {
    pasos: [
      { id: 'invitados', nombre: 'Invitados', n: xs.length },
      { id: 'cuenta', nombre: 'Cuenta activa', n: n(activa) },
      { id: 'cuestionario', nombre: 'Cuestionario', n: n((a) => a.cuestionario_en) },
      { id: 'plan', nombre: 'Con plan', n: n((a) => a.plan_inicio) },
      { id: 'sesion', nombre: 'Primera sesión', n: n((a) => a.primera_sesion) },
    ],
    porConfirmar: xs.filter((a) => a.visto_bueno_pedido_en && !a.visto_bueno_en && a.resultado && a.resultado !== 'sin_valoracion')
      .map((a) => ({ ...a, nombre: vivos.get(a.atleta_id).nombre })).sort((a, b) => String(a.visto_bueno_pedido_en).localeCompare(String(b.visto_bueno_pedido_en))),
    sinAvisos: xs.filter((a) => activa(a) && !a.push && !a.email).map((a) => vivos.get(a.atleta_id).nombre),
    mediana: dias.length ? dias[Math.floor((dias.length - 1) / 2)] : null,
  };
}

// Quién no ha activado su cuenta: su lunes, cuántos días faltan, si su código ya no vale y si es urgente (a 7 días o menos
// de su lunes, o ya pasado). Sin la 097 (altas null), solo los nombres de la lista.
export function sinActivarAlta(altas, resumenes = [], hoy) {
  const por = new Map((altas || []).map((a) => [a.atleta_id, a]));
  return resumenes.filter((r) => r.modalidad === 'por_su_cuenta' && r.estado === 'invitado').map((r) => {
    const a = por.get(r.atleta_id) || {};
    const faltan = a.inicio ? diasEntre(hoy, a.inicio) : null;
    return { atleta_id: r.atleta_id, nombre: r.nombre, modalidad: r.modalidad, inicio: a.inicio || null, invitado_en: a.invitado_en || null, caduca_en: a.caduca_en || null,
      faltan, caducado: !!a.caduca_en && dia(a.caduca_en) < hoy, urgente: faltan != null && faltan <= 7 };
  }).sort((x, y) => (y.urgente - x.urgente) || ((x.faltan ?? 999) - (y.faltan ?? 999)) || x.nombre.localeCompare(y.nombre, 'es'));
}

// Los avisos de cada uno, en palabras: «en el móvil», «por correo» o «sin avisos» (null si aún no lo sabemos)
export const avisosDe = (a) => (!a ? null : a.push ? 'Avisos en el móvil' : a.email ? 'Avisos por correo' : 'Sin avisos');

// (alta, 56) Su semana 1, empezada el lunes de esta semana, sigue sin ninguna sesión hecha desde el jueves
export function semana1SinEmpezar(alta, r, hoy) {
  if (!alta?.plan_inicio || !r || r.ultimaSesion || alta.primera_sesion) return false;
  const d = diasEntre(alta.plan_inicio, hoy);
  return d >= 3 && d <= 6;
}
