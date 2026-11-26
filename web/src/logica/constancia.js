// FBE Esencial (v0.260, la constancia: C1 a C11 de «claude/motores-siguientes-reglas.md», decididas por Pelayo el 26/11/2026;
// plan en «claude/constancia-plan.md»). Cuando se tuerce: los tres niveles, la vuelta tras un parón con su escala, el plan
// mínimo, el plan B de antes de empezar, la revisión de la semana 6, antes de la baja y la lista por riesgo del panel. Lo
// marcado «(criterio de Claude)» es un detalle de programación que no decidió Pelayo, coherente con sus respuestas. Lógica pura.
import { diasEntre, sumarDias, lunesDe } from './fechas.js';
import { principalesDe } from './como-llegas.js';

const d10 = (x) => (x ? String(x).slice(0, 10) : null);
const fechaDe = (s) => d10(s?.fecha_realizada ?? s?.fecha);

// ---------- C1: los tres niveles ----------
// (criterio de Claude, ya en las reglas) 1: dos sesiones seguidas sin hacer; 2: dos semanas flojas (menos de la mitad de sus
// sesiones en cada una); 3: diez días sin entrenar. En una semana en pausa o de viaje, nada.
export const NIVEL3_DIAS = 10;
export const FALTADAS_NIVEL1 = 2;
export const FLOJAS_NIVEL2 = 2;

// Las sesiones con día previsto que se han pasado sin hacer, seguidas, hasta hoy (sin contar las de hoy). Si desde la
// primera de ellas ha hecho alguna sesión (otra, otro día), no se le ha pasado nada. → { n, desde }
export function faltadasSeguidas({ hoy, sesiones = [] } = {}) {
  const previstas = (sesiones || []).filter((s) => d10(s?.dia_previsto) && d10(s.dia_previsto) < hoy)
    .sort((a, b) => d10(a.dia_previsto).localeCompare(d10(b.dia_previsto)) || (a.orden ?? 0) - (b.orden ?? 0));
  let n = 0;
  for (let i = previstas.length - 1; i >= 0 && !previstas[i].completada; i--) n++;
  if (!n) return { n: 0, desde: null };
  const desde = d10(previstas[previstas.length - n].dia_previsto);
  if ((sesiones || []).some((s) => s?.completada && fechaDe(s) && fechaDe(s) >= desde)) return { n: 0, desde: null };
  return { n, desde };
}

// Las semanas flojas seguidas antes de la actual: las acabadas, con dos o más sesiones y sin pausa, de la más reciente hacia
// atrás, mientras tengan menos de la mitad hechas → { n, hechas, total } (de esas semanas)
export function semanasFlojas({ actual = null, semanas = [], sesiones = {} } = {}) {
  if (!actual?.fecha_inicio) return { n: 0, hechas: 0, total: 0 };
  const previas = [...(semanas || [])].filter((w) => w?.fecha_inicio && d10(w.fecha_inicio) < d10(actual.fecha_inicio) && w.esencial_cierre !== 'pausa' && (sesiones[w.id] || []).length >= 2)
    .sort((a, b) => d10(b.fecha_inicio).localeCompare(d10(a.fecha_inicio)));
  let n = 0, hechas = 0, total = 0;
  for (const w of previas) {
    const ss = sesiones[w.id] || [];
    const h = ss.filter((s) => s.completada).length;
    if (h * 2 >= ss.length) break;
    n++; hechas += h; total += ss.length;
  }
  return { n, hechas, total };
}

// Días sin entrenar: desde la última sesión hecha (o, si aún no ha hecho ninguna, desde el lunes en que empezó su plan)
export function diasSinEntrenar({ hoy, hechas = [], inicio = null } = {}) {
  const fechas = (hechas || []).map(fechaDe).filter(Boolean).sort();
  const desde = fechas[fechas.length - 1] || d10(inicio);
  if (!desde || desde > hoy) return { dias: null, nunca: !fechas.length };
  return { dias: diasEntre(desde, hoy), nunca: !fechas.length };
}

// El nivel de hoy → { nivel: 0 | 1 | 2 | 3, motivo, dias, faltadas, flojas, nunca }
//   actual: su semana en curso · semanas, sesiones ({ semana_id: [...] }): las de su plan · hechas: las hechas de todos sus
//   bloques ([{ fecha }]) · inicio: el lunes en que empezó · deViaje: si hoy está de viaje (lo apuntó)
export function nivelConstancia({ hoy, actual = null, semanas = [], sesiones = {}, hechas = [], inicio = null, deViaje = false } = {}) {
  const fuera = { nivel: 0, motivo: null, dias: null, faltadas: 0, flojas: 0, nunca: false };
  if (!hoy || !actual || actual.esencial_cierre === 'pausa' || deViaje) return fuera;
  if (inicio && d10(inicio) > hoy) return fuera;
  const { dias, nunca } = diasSinEntrenar({ hoy, hechas, inicio });
  const fl = semanasFlojas({ actual, semanas, sesiones });
  const fa = faltadasSeguidas({ hoy, sesiones: sesiones[actual.id] ? [...(sesiones[actual.id] || []), ...semanaAnterior(actual, semanas, sesiones)] : [] });
  const base = { dias, faltadas: fa.n, flojas: fl.n, nunca };
  if (dias != null && dias >= NIVEL3_DIAS) return { ...base, nivel: 3, motivo: nunca ? `Tiene su plan desde hace ${dias} días y aún no ha hecho su primera sesión` : `Lleva ${dias} días sin entrenar` };
  if (fl.n >= FLOJAS_NIVEL2) return { ...base, nivel: 2, motivo: `${fl.n === 2 ? 'Dos' : fl.n} semanas seguidas con menos de la mitad de sus sesiones (${fl.hechas} de ${fl.total})` };
  if (fa.n >= FALTADAS_NIVEL1) return { ...base, nivel: 1, motivo: `Se le han pasado ${fa.n === 2 ? 'dos' : fa.n} sesiones seguidas` };
  return { ...base, nivel: 0, motivo: null };
}
function semanaAnterior(actual, semanas, sesiones) {
  const l = sumarDias(d10(actual.fecha_inicio), -7);
  const w = (semanas || []).find((x) => d10(x?.fecha_inicio) === l && x.esencial_cierre !== 'pausa');
  return w ? (sesiones[w.id] || []) : [];
}

// ---------- C5: el plan B de antes de empezar («cuándo y qué hago si…»; Gollwitzer y Sheeran 2006) ----------
// Su hora (la usan también los avisos de constancia, C4) y qué hace si un día no puede
export const HORAS_PLAN = [['manana', 'Por la mañana', 9], ['mediodia', 'A mediodía', 14], ['tarde', 'Por la tarde', 18], ['noche', 'Por la noche', 20]];
export const PLANES_B = [
  ['siguiente', 'La hago al día siguiente', 'Si un día no puedes, la haces al día siguiente: nada más.'],
  ['minima', 'Hago la sesión mínima', 'Si un día vas justo, haces la sesión mínima: lo principal, con dos series.'],
  ['finde', 'La paso al fin de semana', 'Si entre semana no llegas, la pasas al sábado o al domingo.'],
];
export const planBValido = (x) => !!x && HORAS_PLAN.some(([k]) => k === x.hora) && PLANES_B.some(([k]) => k === x.b);
export const textoPlanB = (x) => (planBValido(x) ? PLANES_B.find(([k]) => k === x.b)[2] : null);
export const horaDelPlan = (x) => (planBValido(x) ? HORAS_PLAN.find(([k]) => k === x.hora)[2] : null);

// El texto del nivel 1 (un aviso suave; con su plan B, si lo tiene)
export function textoNivel1({ faltadas = 2, planB = null } = {}) {
  const b = textoPlanB(planB);
  return {
    titulo: `Se te han pasado ${faltadas === 2 ? 'dos' : faltadas} sesiones`,
    texto: `No pasa nada y no hay nada que recuperar: la siguiente, cuando puedas.${b ? ` Tu plan B: ${b.charAt(0).toLowerCase()}${b.slice(1)}` : ''}`,
  };
}

// ---------- C2: la vuelta tras un parón, con la escala de Pelayo (Bosquet 2013) ----------
// Menos de 2 semanas, sigue igual; de 2 a 4, una serie menos y un 10 % menos la primera semana; más de 4, un 20 % menos y
// dos semanas de vuelta. Se le pasa a su motor como sus reglas (el motor de los atletas con seguimiento no cambia).
// (criterio de Claude) Con más de 4 semanas también una serie menos (no va a ser más suave que con 2 a 4), y la segunda
// semana repite los kilos de la primera, sin subir.
export const PARON_ESENCIAL = 14;
export const VUELTA_ESENCIAL = [{ desde: 14, kgPct: 10, series: 1, rpeMax: null }, { desde: 29, kgPct: 20, series: 1, rpeMax: null }];
export const VUELTA_DOS_SEMANAS = 29;
// Las capas de reglas del motor con la vuelta de FBE Esencial (si Pelayo ya le hubiera puesto la suya, se respeta)
export function reglasVueltaEsencial(reglas = {}) {
  const atleta = reglas?.atleta || {};
  return { ...reglas, atleta: { ...atleta, vuelta: atleta.vuelta ?? VUELTA_ESENCIAL, frenos: { ...(atleta.frenos || {}), paron: atleta.frenos?.paron ?? PARON_ESENCIAL } } };
}
// ¿La semana que acaba (base) fue la primera de una vuelta tras más de 4 semanas parado? (entonces la siguiente, también de vuelta)
//   d: lo del motor ({ semanas, sesiones: { semana_id: [...] } })
export function segundaSemanaVuelta({ d, base } = {}) {
  if (!base?.fecha_inicio) return null;
  const ini = d10(base.fecha_inicio);
  const todas = Object.values(d?.sesiones || {}).flat().filter((s) => s?.completada && fechaDe(s));
  const enBase = (d?.sesiones?.[base.id] || []).filter((s) => s?.completada && fechaDe(s)).map(fechaDe).sort();
  if (!enBase.length) return null;
  const antes = todas.map(fechaDe).filter((f) => f < ini).sort();
  if (!antes.length) return null;
  const dias = diasEntre(antes[antes.length - 1], enBase[0]);
  return dias >= VUELTA_DOS_SEMANAS ? { dias } : null;
}

// ---------- C3: el plan mínimo (Spiering 2021) ----------
// Tras dos semanas flojas: dos semanas con 2 días de unos 30 minutos y lo principal con 2 series (la sesión mínima de D3).
// (criterio de Claude) Dura dos semanas desde el lunes en que se acepta; después vuelve el plan normal y, si se vuelve a
// torcer, se vuelve a ofrecer.
export const PLAN_MINIMO = { semanas: 2, dias: 2, minutos: 30 };
export function planMinimoDe({ notas = [], hoy } = {}) {
  const x = [...(notas || [])].filter((n) => n?.tipo === 'plan_minimo' && d10(n.desde) && d10(n.hasta)).sort((a, b) => d10(b.desde).localeCompare(d10(a.desde)))[0];
  if (!x || d10(x.hasta) < hoy || d10(x.desde) > hoy) return null;
  return { desde: d10(x.desde), hasta: d10(x.hasta), semana: Math.min(PLAN_MINIMO.semanas, Math.floor(diasEntre(d10(x.desde), hoy) / 7) + 1) };
}
// Del lunes de esta semana al domingo de la siguiente
export const fechasPlanMinimo = (hoy) => { const l = lunesDe(hoy); return { desde: l, hasta: sumarDias(l, PLAN_MINIMO.semanas * 7 - 1) }; };
// En la sesión: lo principal, con 2 series (lo que ya está hecho no se quita)
export const propuestaPlanMinimo = (pautas = []) => {
  const ps = principalesDe(pautas);
  return ps.length ? { tipo: 'minima', ids: ps.map((e) => e.id), plan: true, texto: `Tu plan mínimo: lo principal (${ps.map((e) => (e?.ejercicio?.nombre || e?.nombre || 'Ejercicio').toLowerCase()).join(', ')}), con 2 series.` } : null;
};

// ---------- C7: la revisión de la semana 6 (Lally 2010) ----------
export const SEMANA_REVISION = 6;
export function revisionSemana6({ n = null, semanas = [], sesiones = {}, actual = null } = {}) {
  if (Number(n) !== SEMANA_REVISION || !actual?.fecha_inicio) return null;
  const previas = (semanas || []).filter((w) => w?.fecha_inicio && d10(w.fecha_inicio) < d10(actual.fecha_inicio));
  const total = previas.reduce((t, w) => t + (sesiones[w.id] || []).length, 0);
  const hechas = previas.reduce((t, w) => t + (sesiones[w.id] || []).filter((s) => s.completada).length, 0);
  const completas = previas.filter((w) => (sesiones[w.id] || []).length && (sesiones[w.id] || []).every((s) => s.completada)).length;
  return { semanas: previas.length, hechas, total, completas };
}

// ---------- C9: antes de la baja ----------
// Con tres semanas flojas o un «¿Cómo vamos?» bajo (5 o menos, criterio de Claude): ofrecer una pausa, el plan mínimo o
// cambiar de rutina
export const FLOJAS_RIESGO = 3;
export const NOTA_BAJA = 5;
export function riesgoBaja({ flojas = 0, comoVamos = [] } = {}) {
  const ultima = [...(comoVamos || [])].filter((x) => Number(x?.datos?.nota) >= 1).sort((a, b) => String(b.creada_en || '').localeCompare(String(a.creada_en || '')))[0];
  const nota = ultima ? Number(ultima.datos.nota) : null;
  if (flojas >= FLOJAS_RIESGO) return { por: 'flojas', flojas, nota };
  if (nota != null && nota <= NOTA_BAJA) return { por: 'nota', flojas, nota };
  return null;
}
export const OPCIONES_ANTES_BAJA = [
  ['pausa', 'Esta semana, en pausa', 'Tu plan se queda donde está, sin perder nada, y sigues cuando puedas.'],
  ['minimo', 'Dos semanas con el plan mínimo', 'Dos días de unos 30 minutos con lo principal. Después, tu plan de siempre.'],
  ['rutina', 'Una rutina que encaje mejor', 'De dos días o de mantenimiento mínimo, para semanas complicadas.'],
];

// ---------- C11: el panel, por riesgo ----------
// filas: [{ atleta_id, nombre, modalidad, nivel, motivo }] → las que tienen nivel, de más a menos riesgo
export const ordenRiesgo = (filas = []) => [...(filas || [])].filter((f) => f?.nivel > 0)
  .sort((a, b) => b.nivel - a.nivel || String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
// (atletas con seguimiento, del resumen del panel) el nivel con lo que ya sabe el panel: 3, diez días o más sin registrar;
// 2, el aviso de cumplimiento (menos del 80 % en 4 semanas); 1, el aviso de «sin entrenar» (de 5 a 9 días) o, de jueves a
// domingo, menos de la mitad de las sesiones de la semana
// (FBE Esencial: flojas, las semanas flojas seguidas que ya calcula su panel; con dos, nivel 2)
export function nivelDeResumen(r = {}, hoy, { flojas = 0 } = {}) {
  if (!r || r.servicio === 'nutricion' || r.estado === 'baja' || r.estado === 'invitado') return { nivel: 0, motivo: null };
  const al = (t) => (r.alertas || []).find((a) => a?.tipo === t) || null;
  const ult = r.ultimaSerie ?? r.ultimaSesion ?? null;
  const dias = ult ? diasEntre(d10(ult), hoy) : null;
  if (dias != null && dias >= NIVEL3_DIAS) return { nivel: 3, motivo: `Lleva ${dias} días sin registrar` };
  if (flojas >= FLOJAS_NIVEL2) return { nivel: 2, motivo: 'Dos semanas seguidas con menos de la mitad de sus sesiones' };
  if (al('cumplimiento')) return { nivel: 2, motivo: al('cumplimiento').texto || 'Cumplimiento bajo en las últimas 4 semanas' };
  if (al('sin_entrenar')) return { nivel: 1, motivo: al('sin_entrenar').texto || 'Lleva unos días sin registrar' };
  const { completadas = 0, total = 0 } = r.sesiones || {};
  const dia = (new Date(`${hoy}T12:00:00Z`).getUTCDay() + 6) % 7;
  if (total > 1 && dia >= 3 && completadas * 2 < total) return { nivel: 1, motivo: `${completadas} de ${total} sesiones esta semana` };
  return { nivel: 0, motivo: null };
}
export const NOMBRE_NIVEL = { 1: 'Un aviso suave', 2: 'Un plan de vuelta', 3: 'Un mensaje tuyo' };
