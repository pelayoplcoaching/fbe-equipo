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
export function filaPiloto(r, hoy) {
  const dias = r.ultimaSesion ? diasEntre(r.ultimaSesion, hoy) : null;
  const avisos = (r.alertas || []).filter((a) => a.nivel !== 'info');
  // (en la semana 2 de su plan o después sin haber entrenado nunca, también ámbar)
  const sinEmpezar = dias == null && (r.semana?.numero || 0) >= 2;
  const nivel = r.estado === 'baja' ? 'rojo' : avisos.some((a) => a.nivel === 'alerta') || (dias != null && dias >= 10) ? 'rojo'
    : avisos.length || (dias != null && dias >= 7) || sinEmpezar ? 'ambar' : 'ok';
  const semana = r.bloque && r.semana?.numero ? `Semana ${r.semana.numero} de «${r.bloque.nombre}»` : r.bloque ? r.bloque.nombre : 'Antes de empezar';
  const ultima = r.estado === 'baja' ? 'De baja' : dias == null ? 'Aún sin entrenar' : dias === 0 ? 'Entrenó hoy' : dias === 1 ? 'Entrenó ayer' : `Hace ${dias} días`;
  return { semana, ultima, nivel, avisos: (r.alertas || []).map((a) => a.texto), sesiones: r.sesiones || { completadas: 0, total: 0 }, comida: r.servicio === 'completo' };
}

// Las cifras del piloto: cuántos hay, cuántos siguen, cuántos han entrenado esta semana, las sesiones apuntadas de las
// pautadas en sus 4 últimas semanas (el listón: 3 de cada 4) y la encuesta (mandadas y contestadas)
export function cifrasPiloto(resumenes = [], hoy, encuesta = []) {
  const suyos = resumenes.filter((r) => r.modalidad === 'por_su_cuenta' && r.estado !== 'invitado');
  const siguen = suyos.filter(vivo);
  const conPlan = siguen.filter((r) => r.bloque);
  const entrenaron = conPlan.filter((r) => r.ultimaSesion && diasEntre(r.ultimaSesion, hoy) < 7).length;
  const sem = conPlan.reduce((t, r) => ({ hechas: t.hechas + (r.sesiones?.completadas || 0), pautadas: t.pautadas + (r.sesiones?.total || 0) }), { hechas: 0, pautadas: 0 });
  // (las sesiones de sus 4 últimas semanas acabadas: cumplimiento() de logica/informe.js)
  const s4 = conPlan.reduce((t, r) => ({ hechas: t.hechas + (r.cumplimiento?.sesiones?.hechas || 0), total: t.total + (r.cumplimiento?.sesiones?.total || 0) }), { hechas: 0, total: 0 });
  const pct = s4.total ? Math.round((100 * s4.hechas) / s4.total) : null;
  const ids = new Set(suyos.map((r) => r.atleta_id));
  // (cada encuesta: a cuántos se mandó y cuántos contestaron; «encuesta» es la última mandada, o la primera si no hay)
  const encuestas = ENCUESTAS_ESENCIAL.map((e) => {
    const tareas = encuesta.filter((t) => ids.has(t.atleta_id) && t.titulo === e.titulo);
    return { id: e.id, nombre: e.nombre, mandadas: tareas.length, contestadas: tareas.filter((t) => t.hecha_en).length };
  });
  return {
    total: suyos.length, siguen: siguen.length, bajas: suyos.length - siguen.length, conPlan: conPlan.length, entrenaron,
    sesionesSemana: sem, sesiones4: { ...s4, pct }, cumpleSesiones: pct != null && pct >= LISTON_ESENCIAL.sesiones,
    conAvisos: siguen.filter((r) => filaPiloto(r, hoy).nivel !== 'ok').length,
    encuestas, encuesta: [...encuestas].reverse().find((e) => e.mandadas) || encuestas[0],
  };
}
