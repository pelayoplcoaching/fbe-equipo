// (v0.205) Registro y Actividad del atleta, en la ficha del coach: lo que se calcula para pintarlo (sin pantalla, para
// poder probarlo). Registro: la vez anterior de cada ejercicio, su 1RM del día frente a esa vez y a su mejor marca,
// toneladas, lo saltado, el descanso de verdad y la hora de la sesión. Actividad: lo que no hizo (sesiones sin hacer y
// días sin entrenar), su día (hábitos, comidas, suplementos y Salud), la hora de cada cosa, lo nuevo desde tu última
// visita, los filtros y la cabecera.
import { e1rm, num } from './calculos.js';
import { descansoReal } from './conocerte.js';
import { sumarDias, lunesDe, diasEntre, partesMadrid, fmtCorta } from './fechas.js';
import { cumpleHabito } from './habitos.js';
import { miles } from './celebracion.js';
import { textoSueno } from './integraciones.js';

const conReps = (s) => Number(s?.reps) > 0;
const instante = (s) => `${s.fecha || ''}${s.registrada_en || ''}`;

// ---------------------------------------------------------------- Registro
// La última vez que hizo ese ejercicio antes de esta sesión (de su historial): { fecha, sesionId, series } o null
export function vezAnterior(historial = [], ejercicioId, sesionId, fecha = null) {
  const previas = (historial || []).filter((s) => s.ejercicio_id === ejercicioId && s.sesion_id && s.sesion_id !== sesionId && conReps(s) && (!fecha || (s.fecha || '') <= fecha));
  if (!previas.length) return null;
  const ult = previas.reduce((a, s) => (instante(s) > instante(a) ? s : a));
  const series = previas.filter((s) => s.sesion_id === ult.sesion_id).sort((a, b) => ((a.registrada_en || '') < (b.registrada_en || '') ? -1 : 1));
  return { fecha: ult.fecha, sesionId: ult.sesion_id, series };
}
// Lo mejor de unas series: su 1RM estimado más alto (con carga) o sus repeticiones (sin carga)
export function mejorDe(series = []) {
  const conKg = (series || []).filter((s) => conReps(s) && Number(s.kg) > 0);
  if (conKg.length) {
    const rms = conKg.map((s) => e1rm(s)).filter((v) => v > 0);
    if (rms.length) return { tipo: 'kg', valor: Math.max(...rms) };
    // con muchas repeticiones (más de 12) no hay 1RM estimado: la serie que más mueve, kilos por repeticiones
    return { tipo: 'carga', valor: Math.max(...conKg.map((s) => Number(s.kg) * Number(s.reps))) };
  }
  const r = (series || []).filter(conReps);
  return r.length ? { tipo: 'reps', valor: Math.max(...r.map((s) => Number(s.reps))) } : null;
}
// Hoy frente a la vez anterior: { dir: 'sube' | 'baja' | 'igual', d, tipo } (null sin con qué comparar)
export function frenteAnterior(hechas = [], anteriores = []) {
  const a = mejorDe(hechas), b = mejorDe(anteriores);
  if (!a || !b || a.tipo !== b.tipo || !(b.valor > 0)) return null;
  const d = a.valor - b.valor;
  const umbral = a.tipo === 'reps' ? 0.5 : Math.max(0.25, b.valor * 0.005);
  return { dir: d > umbral ? 'sube' : d < -umbral ? 'baja' : 'igual', d: Math.round(d * 10) / 10, tipo: a.tipo };
}
// Su 1RM estimado del día en un ejercicio, frente a la vez anterior y frente a su mejor marca de antes de ese día
export function e1rmDelDia(hechas = [], historial = [], ejercicioId, sesionId, fecha = null, anteriores = null) {
  const hoy = mejorDe(hechas);
  if (!hoy || hoy.tipo !== 'kg') return null;
  const antes = (historial || []).filter((s) => s.ejercicio_id === ejercicioId && s.sesion_id !== sesionId && conReps(s) && Number(s.kg) > 0 && (!fecha || (s.fecha || '') <= fecha));
  const mejor = antes.length ? Math.max(...antes.map((s) => e1rm(s) || 0)) : null;
  const vez = mejorDe(anteriores || []);
  return {
    valor: Math.round(hoy.valor * 10) / 10,
    cambio: vez?.tipo === 'kg' && vez.valor > 0 ? Math.round((hoy.valor - vez.valor) * 10) / 10 : null,
    mejor: mejor ? Math.round(mejor * 10) / 10 : null,
    pct: mejor ? Math.round((hoy.valor / mejor) * 100) : null,
    record: mejor != null && hoy.valor > mejor + 0.05,
  };
}
export const toneladas = (series = []) => (series || []).filter(conReps).reduce((t, s) => t + (Number(s.kg) || 0) * (Number(s.reps) || 0), 0);
// Las series que faltaron de lo pautado (solo si la sesión está terminada) y si se saltó el ejercicio entero
export function faltan(p = {}, hechas = [], completada = false) {
  const pautadas = Number(p.series) || (Array.isArray(p.series_detalle) ? p.series_detalle.length : 0);
  const n = (hechas || []).filter(conReps).length;
  return { n: completada ? Math.max(0, pautadas - n) : 0, saltado: !!completada && pautadas > 0 && n === 0 };
}
// El descanso que hizo de verdad (la mediana entre series, por la hora de cada una) frente al pautado, en segundos
export function descansoFrente(p = {}, hechas = []) {
  const real = descansoReal(hechas);
  if (!real) return null;
  const pautado = Number(p.descanso_seg) || null;
  return { real, pautado, dif: pautado ? real - pautado : null };
}
export const mmss = (seg) => `${Math.floor(seg / 60)}:${String(Math.round(seg % 60)).padStart(2, '0')}`;
// Hora de inicio y de fin de la sesión (la primera y la última serie, en hora de Madrid) y lo que duró
export function horarioSesion(series = []) {
  const ts = (series || []).map((s) => Date.parse(s.registrada_en)).filter(Number.isFinite).sort((a, b) => a - b);
  if (ts.length < 2) return null;
  const minutos = Math.round((ts[ts.length - 1] - ts[0]) / 60000);
  if (minutos <= 0 || minutos > 6 * 60) return null;
  return { inicio: partesMadrid(new Date(ts[0])).hora, fin: partesMadrid(new Date(ts[ts.length - 1])).hora, minutos };
}
// Lo que escribió en cada serie: [{ numero, nota }]
export const notasDeSeries = (hechas = []) => (hechas || []).map((h, i) => ({ numero: h.numero ?? i + 1, nota: String(h.nota || '').trim() })).filter((x) => x.nota);

// ---------------------------------------------------------------- Actividad
// La hora de un instante (ISO con zona) en Madrid, o null si no es una hora de verdad
export function horaDe(iso) {
  if (!iso || !/T\d\d:\d\d/.test(String(iso)) || !/(Z|[+-]\d\d:?\d\d)$/.test(String(iso))) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? partesMadrid(new Date(t)).hora : null;
}
// Días seguidos sin entrenar (4 o más) entre una sesión y la siguiente, y hasta hoy: [{ desde, hasta, dias, sigue }]
export function paronesDe(fechas = [], hoy, { minimo = 4, desde = null } = {}) {
  const fs = [...new Set((fechas || []).filter(Boolean))].sort();
  const out = [];
  for (let i = 1; i < fs.length; i++) {
    const dias = diasEntre(fs[i - 1], fs[i]) - 1;
    if (dias >= minimo && (!desde || fs[i] >= desde)) out.push({ desde: sumarDias(fs[i - 1], 1), hasta: sumarDias(fs[i], -1), dias, sigue: false });
  }
  if (fs.length) {
    const dias = diasEntre(fs[fs.length - 1], hoy);
    if (dias >= minimo) out.push({ desde: sumarDias(fs[fs.length - 1], 1), hasta: hoy, dias, sigue: true });
  }
  return out;
}
// Su día, en una línea: hábitos cumplidos, comidas apuntadas, fotos de plato, suplementos tomados y lo de Salud
// dias: { fecha: { habitos: { hechos, total }, kcal, prot, fotos, suplementos, pasos, sueno } }
export function textoDia(d = {}) {
  return [
    d.habitos?.total ? `${d.habitos.hechos} de ${d.habitos.total} ${d.habitos.total === 1 ? 'hábito' : 'hábitos'}` : null,
    d.kcal != null ? `${miles(d.kcal)} kcal${d.prot != null ? ` y ${num(d.prot, 0)} g de proteína` : ''}` : d.cumplido != null ? (Number(d.cumplido) === 2 ? 'siguió su plan' : Number(d.cumplido) === 1 ? 'casi siguió su plan' : 'no siguió su plan') : null,
    d.fotos ? `${d.fotos} ${d.fotos === 1 ? 'foto de plato' : 'fotos de plato'}` : null,
    d.suplementos ? `${d.suplementos} ${d.suplementos === 1 ? 'suplemento' : 'suplementos'}` : null,
    d.pasos != null ? `${miles(d.pasos)} pasos` : null,
    d.sueno != null ? `${textoSueno(d.sueno)} de sueño` : null,
  ].filter(Boolean).join(', ');
}
// Junta por día lo de hábitos, nutrición, platos, suplementos y Salud
export function diasDeAtleta({ habitos = [], registrosHabito = [], nutricion = [], fotos = [], tomas = [], salud = [] } = {}, desde) {
  const out = {};
  const dia = (f) => (out[f] ||= {});
  const porId = Object.fromEntries((habitos || []).map((h) => [h.id, h]));
  for (const r of registrosHabito || []) {
    const h = porId[r.habito_id];
    if (!h || !r.fecha || r.fecha < desde || r.valor == null) continue;
    const d = dia(r.fecha);
    d.habitos ||= { hechos: 0, total: 0 };
    d.habitos.total++;
    if (cumpleHabito(h, r.valor)) d.habitos.hechos++;
  }
  for (const n of nutricion || []) {
    if (!n.fecha || n.fecha < desde) continue;
    const d = dia(String(n.fecha).slice(0, 10));
    if (n.kcal != null) d.kcal = Number(n.kcal);
    if (n.proteina_g != null) d.prot = Number(n.proteina_g);
    if (n.cumplido != null) d.cumplido = n.cumplido;
  }
  for (const f of fotos || []) if (f.fecha && f.fecha >= desde) dia(f.fecha).fotos = (dia(f.fecha).fotos || 0) + 1;
  for (const t of tomas || []) if (t.fecha && t.fecha >= desde && t.hecho !== false) dia(t.fecha).suplementos = (dia(t.fecha).suplementos || 0) + 1;
  for (const s of salud || []) {
    if (!s.fecha || s.fecha < desde) continue;
    if (s.pasos != null) dia(s.fecha).pasos = Number(s.pasos);
    if (s.sueno_min != null) dia(s.fecha).sueno = Number(s.sueno_min);
  }
  return out;
}
// Lo nuevo desde tu última visita: la marca de tiempo de cada cosa (la de verdad o, si no la hay, su día)
export const momentoDe = (e) => { const t = Date.parse(e?.cuando || ''); return Number.isFinite(t) ? t : Date.parse(`${e?.fecha}T12:00:00`); };
export function nuevosDesde(eventos = [], vistaMs = null) {
  if (!Number.isFinite(vistaMs)) return new Set();
  return new Set((eventos || []).filter((e) => momentoDe(e) > vistaMs).map((e) => e.clave).filter(Boolean));
}
// Los filtros de la actividad
export const FILTROS_ACTIVIDAD = [['todo', 'Todo'], ['sesion', 'Sesiones'], ['record', 'Récords'], ['checkin', 'Check-ins'], ['mensaje', 'Mensajes'], ['peso', 'Pesos'], ['dia', 'Comidas y hábitos'], ['media', 'Vídeos y fotos'], ['nohecho', 'Lo que no hizo']];
const DE_FILTRO = { media: ['video', 'foto'], nohecho: ['saltada', 'paron'], mensaje: ['mensaje', 'mio'] };
export function filtrarActividad(eventos = [], filtro = 'todo', busca = '') {
  const q = String(busca || '').trim().toLowerCase();
  return (eventos || []).filter((e) => {
    if (filtro !== 'todo' && !(DE_FILTRO[filtro] || [filtro]).includes(e.tipo)) return false;
    if (!q) return true;
    return [e.titulo, e.detalle, ...(e.ejercicios || [])].filter(Boolean).some((t) => String(t).toLowerCase().includes(q));
  });
}
// La cabecera: último entreno, sesiones de esta semana, días desde su último check-in y los 30 últimos días
export function cabeceraActividad(eventos = [], hoy) {
  const ses = (eventos || []).filter((e) => e.tipo === 'sesion').map((e) => e.fecha).sort();
  const ck = (eventos || []).filter((e) => e.tipo === 'checkin').map((e) => e.fecha).sort();
  const lunes = lunesDe(hoy);
  const dias30 = Array.from({ length: 30 }, (_, i) => sumarDias(hoy, i - 29));
  const conSesion = new Set(ses), conRecord = new Set((eventos || []).filter((e) => e.tipo === 'record').map((e) => e.fecha));
  return {
    ultimo: ses.length ? { fecha: ses[ses.length - 1], dias: diasEntre(ses[ses.length - 1], hoy) } : null,
    estaSemana: ses.filter((f) => f >= lunes && f <= hoy).length,
    checkin: ck.length ? { fecha: ck[ck.length - 1], dias: diasEntre(ck[ck.length - 1], hoy) } : null,
    mapa: dias30.map((f) => ({ fecha: f, si: conSesion.has(f), record: conRecord.has(f), hoy: f === hoy })),
    entrenos30: dias30.filter((f) => conSesion.has(f)).length,
  };
}
export const textoParon = (p) => `${p.dias} días sin entrenar${p.sigue ? ' (hasta hoy)' : ''}`;
export const detalleParon = (p) => (p.desde === p.hasta ? `el ${fmtCorta(p.desde)}` : `del ${fmtCorta(p.desde)} al ${fmtCorta(p.hasta)}`);
// Más formas de felicitar
export const FRASES_KUDOS = ['💪 ¡Bien hecho! He visto tu entreno.', '🔥 ¡Qué sesión! Sigue así.', '👏 Muy buen trabajo hoy.', '🙌 Constancia de la buena. ¡Vamos!'];
export const textoKudosRecord = (ejercicio) => `🏆 ¡Récord en ${ejercicio}! Enhorabuena, se nota el trabajo.`;
export const TEXTO_KUDOS_CHECKIN = '🙌 Gracias por el check-in. Lo miro y te digo.';

// ================================================================ (v0.206) segunda tanda
const esfReal = (h) => (h.rpe != null && h.rpe !== '' ? Number(h.rpe) : h.rir != null && h.rir !== '' ? 10 - Number(h.rir) : null);
const esfObjetivo = (p) => (p.rpe_objetivo != null ? Number(p.rpe_objetivo) : p.rir_objetivo != null ? 10 - Number(p.rir_objetivo) : null);
const r1 = (v) => Math.round(v * 10) / 10;

// ---------------------------------------------------------------- Registro
// Cuánto se pasa (o se queda) de media del esfuerzo pautado en un ejercicio: +0,8 / −0,5 (null sin RPE u objetivo)
export function desvioEsfuerzo(p = {}, hechas = []) {
  const obj = esfObjetivo(p);
  if (obj == null) return null;
  const ds = (hechas || []).filter(conReps).map(esfReal).filter((v) => v != null).map((v) => v - obj);
  return ds.length ? r1(ds.reduce((a, b) => a + b, 0) / ds.length) : null;
}
export const tonoDesvio = (d) => (d == null ? '' : d > 0.5 ? 'pasado' : d < -0.5 ? 'suave' : 'justo');
export const textoDesvio = (d) => (d == null ? '' : d === 0 ? 'justo en lo pautado' : `${d > 0 ? '+' : '−'}${num(Math.abs(d), 1)} ${d > 0 ? 'por encima' : 'por debajo'} de lo pautado`);
// Cada ejercicio del bloque con sus semanas: la mejor serie de cada una (y su 1RM), para ver la progresión de un vistazo
// completo: { semanas, sesiones: { semanaId: [s] }, pautas: { sesionId: [p] }, series: { pautaId: [h] } }
export function porEjercicios(completo, nombres = {}) {
  const semanas = [...(completo?.semanas || [])].sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0));
  const out = new Map();
  for (const w of semanas) {
    for (const s of completo.sesiones?.[w.id] || []) {
      for (const p of completo.pautas?.[s.id] || []) {
        for (const h of (completo.series?.[p.id] || []).filter(conReps)) {
          const id = h.sustituto_id || p.ejercicio_id;
          if (!out.has(id)) out.set(id, { id, nombre: nombres[id]?.nombre || 'Ejercicio', orden: out.size, porSemana: {}, pautas: [] });
          const e = out.get(id);
          (e.porSemana[w.id] ||= []).push(h);
          if (!h.sustituto_id && !e.pautas.includes(p)) e.pautas.push(p);
        }
      }
    }
  }
  return [...out.values()].map((e) => {
    const cols = semanas.map((w) => {
      const ss = e.porSemana[w.id] || [];
      if (!ss.length) return { semanaId: w.id, numero: w.numero, n: 0, mejor: null, e1rm: null };
      const m = mejorDe(ss);
      const mejor = m?.tipo === 'kg' ? ss.filter((s) => Number(s.kg) > 0).reduce((a, s) => ((e1rm(s) || 0) > (e1rm(a) || 0) ? s : a)) : ss.reduce((a, s) => (Number(s.reps) > Number(a.reps) ? s : a));
      return { semanaId: w.id, numero: w.numero, n: ss.length, mejor, e1rm: m?.tipo === 'kg' ? r1(m.valor) : null };
    });
    const todas = Object.values(e.porSemana).flat();
    const desv = e.pautas.length ? desvioEsfuerzo(e.pautas[0], todas) : null;
    return { id: e.id, nombre: e.nombre, orden: e.orden, cols, linea: cols.map((c) => c.e1rm).filter((v) => v != null), desvio: desv, series: todas.length };
  }).sort((a, b) => b.series - a.series || a.orden - b.orden);
}
// Una semana del bloque: sesiones hechas, series hechas de las pautadas, toneladas y el esfuerzo medio frente al pautado
export function resumenSemanaBloque(completo, semanaId) {
  const ses = completo?.sesiones?.[semanaId] || [];
  let hechasS = 0, pautadas = 0, ton = 0;
  const ds = [];
  for (const s of ses) {
    for (const p of completo.pautas?.[s.id] || []) {
      const hs = (completo.series?.[p.id] || []).filter(conReps);
      pautadas += Number(p.series) || 0;
      hechasS += Math.min(hs.length, Number(p.series) || hs.length);
      ton += toneladas(hs);
      const obj = esfObjetivo(p);
      if (obj != null) for (const h of hs) { const v = esfReal(h); if (v != null) ds.push(v - obj); }
    }
  }
  return {
    sesiones: { hechas: ses.filter((s) => s.completada).length, total: ses.length },
    series: { hechas: hechasS, pautadas },
    toneladas: ton,
    desvio: ds.length ? r1(ds.reduce((a, b) => a + b, 0) / ds.length) : null,
    porRevisar: ses.filter((s) => s.completada && !s.revisada_en).map((s) => s.id),
  };
}
// Cómo rindió en la sesión frente a la vez anterior: la media del cambio de su 1RM estimado en los ejercicios que puede
// comparar (en %), o null. pares: [{ hoy, antes }] (1RM de hoy y de la vez anterior)
export function rendimientoDia(pares = []) {
  const v = (pares || []).filter((x) => x && x.hoy > 0 && x.antes > 0).map((x) => (x.hoy / x.antes - 1) * 100);
  if (!v.length) return null;
  return { pct: r1(v.reduce((a, b) => a + b, 0) / v.length), n: v.length };
}
// Una sesión como texto, para pegarla en un mensaje
export function textoSesion(s, ps = [], series = {}, nombres = {}, fmtFecha = (f) => f) {
  const lin = [`S${s.semana?.numero ?? ''}: ${s.nombre}${s.fecha_realizada ? ` (${fmtFecha(s.fecha_realizada)})` : ''}${s.rpe_sesion ? `, esfuerzo ${num(s.rpe_sesion)}/10` : ''}`];
  for (const p of ps) {
    const hs = (series[p.id] || []).filter(conReps);
    const id = hs.find((h) => h.sustituto_id)?.sustituto_id || p.ejercicio_id;
    lin.push(`${nombres[id]?.nombre || 'Ejercicio'}: ${hs.length ? hs.map(textoSerieCorta).join(', ') : 'sin hacer'}`);
  }
  return lin.join('\n');
}
const textoSerieCorta = (h) => `${Number(h.kg) > 0 ? `${num(Number(h.kg), 2)}×${h.reps}` : `${h.reps} rep`}${h.rpe != null && h.rpe !== '' ? ` @${num(Number(h.rpe))}` : ''}`;
// Las filas del CSV del bloque (para seriesACsv): una por serie hecha
export function filasCsvBloque(completo, nombres = {}) {
  const out = [];
  const semanas = [...(completo?.semanas || [])].sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0));
  for (const w of semanas) for (const s of completo.sesiones?.[w.id] || []) for (const p of completo.pautas?.[s.id] || []) {
    for (const h of completo.series?.[p.id] || []) {
      out.push({ fecha: s.fecha_realizada || String(h.registrada_en || '').slice(0, 10), pautado: nombres[p.ejercicio_id]?.nombre || 'Ejercicio', ejercicio: h.sustituto_id ? nombres[h.sustituto_id]?.nombre || 'Ejercicio' : nombres[p.ejercicio_id]?.nombre || 'Ejercicio',
        sustituto: !!h.sustituto_id, numero: h.numero, kg: h.kg, reps: h.reps, rpe: h.rpe, rir: h.rir, nota: h.nota || null });
    }
  }
  return out;
}
// Dos sesiones lado a lado: cada ejercicio (por el que hizo de verdad) con lo de una y lo de otra
export function emparejarSesiones(a = { pautas: [], series: {} }, b = { pautas: [], series: {} }) {
  const lado = (x) => {
    const m = new Map();
    for (const p of x.pautas || []) {
      const hs = (x.series?.[p.id] || []).filter(conReps);
      const id = hs.find((h) => h.sustituto_id)?.sustituto_id || p.ejercicio_id;
      m.set(id, [...(m.get(id) || []), ...hs]);
    }
    return m;
  };
  const A = lado(a), B = lado(b);
  return [...new Set([...A.keys(), ...B.keys()])].map((id) => ({ id, a: A.get(id) || [], b: B.get(id) || [], fr: frenteAnterior(A.get(id) || [], B.get(id) || []) }));
}

// ---------------------------------------------------------------- Actividad
// «Para mirar»: lo de los últimos días que pide atención, con su motivo
export function paraMirar(eventos = [], hoy, dias = 7) {
  const desde = sumarDias(hoy, -dias + 1);
  return (eventos || []).filter((e) => e.fecha >= desde && !e.mio && (e.aviso || e.tipo === 'saltada' || e.tipo === 'paron'))
    .map((e) => ({ ...e, motivo: e.tipo === 'checkin' ? 'Energía o motivación baja' : e.tipo === 'video' || e.tipo === 'foto' ? 'Sin revisar' : e.tipo === 'saltada' ? 'Sesión sin hacer' : e.tipo === 'paron' ? 'Días sin entrenar' : 'Mírale' }));
}
// Los récords y los comentarios de una sesión, colgando de ella (si la sesión está en la lista): la lista sin ellos y,
// en cada sesión, sus hijos { records, mensajes }
export function colgarDeSesion(items = []) {
  const ses = new Map((items || []).filter((e) => e.tipo === 'sesion' && e.sesionId).map((e) => [e.sesionId, { ...e, hijos: { records: [], mensajes: [] } }]));
  const out = [];
  for (const e of items || []) {
    if (e.tipo === 'sesion' && ses.has(e.sesionId)) { out.push(ses.get(e.sesionId)); continue; }
    const padre = e.tipo === 'record' ? ses.get(e.sesionId) : e.tipo === 'mensaje' ? ses.get(e.hilo?.sesionId) : null;
    if (padre) padre.hijos[e.tipo === 'record' ? 'records' : 'mensajes'].push(e);
    else out.push(e);
  }
  return out;
}
// La semana entera (al desplegar su banda): sesiones hechas de las previstas, récords, días con comidas, peso y su check-in
// previstas: { lunes: total } (de la constancia)
export function detalleSemana(eventos = [], lunes, previstas = {}) {
  const fin = sumarDias(lunes, 6);
  const de = (t) => (eventos || []).filter((e) => e.tipo === t && e.fecha >= lunes && e.fecha <= fin && !e.mio);
  const ck = de('checkin')[0] || null, peso = de('peso')[0] || null;
  return {
    lunes,
    sesiones: de('sesion').length, previstas: previstas[lunes] ?? null,
    records: de('record').length,
    comidas: de('dia').filter((d) => /kcal|plan|plato/.test(d.detalle || '')).length,
    peso: peso ? { kg: peso.kg, tendencia: peso.tendencia ?? null, cambio: peso.cambioSemana ?? null } : null,
    checkin: ck ? (ck.detalle || 'enviado') : null,
    noHizo: de('saltada').map((e) => e.titulo.replace(/^No hizo /, '')),
  };
}
export function textoResumenSemana(d, nombre = '') {
  if (!d) return '';
  const l = [`${nombre ? `${nombre}, s` : 'S'}emana del ${fmtCorta(d.lunes)}:`];
  l.push(`- Sesiones: ${d.sesiones}${d.previstas != null ? ` de ${d.previstas}` : ''}${d.noHizo.length ? ` (sin hacer: ${d.noHizo.join(', ')})` : ''}`);
  if (d.records) l.push(`- Récords: ${d.records}`);
  if (d.comidas) l.push(`- Días con la comida apuntada: ${d.comidas}`);
  if (d.peso) l.push(`- Peso: ${num(d.peso.kg)} kg${d.peso.tendencia != null ? ` (tendencia ${num(d.peso.tendencia)}${d.peso.cambio != null ? `, ${d.peso.cambio > 0 ? '+' : d.peso.cambio < 0 ? '−' : '±'}${num(Math.abs(d.peso.cambio))} en la semana` : ''})` : ''}`);
  l.push(`- Check-in: ${d.checkin || 'sin enviar'}`);
  return l.join('\n');
}
// El calendario de un mes: semanas de lunes a domingo, cada día con lo que hubo (sesión, récord, check-in, peso, mensaje,
// lo que no hizo)
export function calendarioActividad(eventos = [], mes, hoy) {
  const [y, m] = mes.split('-').map(Number);
  const primero = `${mes}-01`;
  const ultimo = sumarDias(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`, -1);
  const porDia = {};
  for (const e of eventos || []) if (!e.mio && e.fecha >= primero && e.fecha <= ultimo) (porDia[e.fecha] ||= new Set()).add(e.tipo === 'records' ? 'record' : e.tipo);
  const semanas = [];
  let d = lunesDe(primero);
  while (d <= ultimo) {
    const fila = [];
    for (let i = 0; i < 7; i++) { const f = sumarDias(d, i); fila.push({ fecha: f, fuera: f < primero || f > ultimo, futuro: f > hoy, tipos: [...(porDia[f] || [])] }); }
    semanas.push(fila);
    d = sumarDias(d, 7);
  }
  return semanas;
}
// Su ritmo: entrenos y duración media de las 4 últimas semanas frente a las 4 de antes. entrenos: [{ fecha, duracion_min }]
export function ritmoEntrenos(entrenos = [], hoy) {
  const tramo = (a, b) => {
    const xs = (entrenos || []).filter((e) => e.fecha && e.fecha > a && e.fecha <= b);
    const conMin = xs.filter((e) => Number(e.duracion_min) > 0);
    return { n: xs.length, minutos: conMin.length ? Math.round(conMin.reduce((t, e) => t + Number(e.duracion_min), 0) / conMin.length) : null };
  };
  return { ahora: tramo(sumarDias(hoy, -28), hoy), antes: tramo(sumarDias(hoy, -56), sumarDias(hoy, -28)) };
}
// Lo que ya has marcado como visto (en este aparato), como mucho 500
export const MAX_VISTOS = 500;
export function sumarVistos(vistos = [], claves = []) {
  const s = [...new Set([...(vistos || []), ...(claves || [])].filter(Boolean))];
  return s.slice(Math.max(0, s.length - MAX_VISTOS));
}
