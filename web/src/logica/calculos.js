// Cálculos de entrenamiento y del resumen del coach. Funciones puras, probadas en test/logica.test.mjs.
import { diasEntre, lunesDe, sumarDias, hoyISO } from './fechas.js';
import { cardioHechoDe } from './cardio.js';

// ---------- Formato numérico (es-ES) ----------

export function num(v, dec = 1) {
  if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  const s = Number.isInteger(n) ? String(n) : n.toFixed(dec).replace(/\.?0+$/, '');
  return s.replace('.', ',');
}

// Lo que se escribe a mano en un campo numérico: «8.000» y «8 000» son ocho mil (separador de miles),
// «2,5» y «2.5» son dos y medio, «12.500,5» doce mil quinientos y medio. null si no es un número.
export function leerNumero(texto) {
  let t = String(texto ?? '').trim().replace(/[\s\u00a0\u202f]/g, '');
  if (!t) return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '');
  t = t.replace(',', '.');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

export function signo(v, dec = 1) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '';
  const n = Number(v);
  if (n === 0) return '±0';
  return (n > 0 ? '+' : '−') + num(Math.abs(n), dec);
}

export function mmss(seg) {
  const s = Math.max(0, Math.round(seg));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---------- Fuerza ----------

// Repeticiones en reserva de una serie: RIR si lo hay; si no, 10 − RPE; si no hay ninguno, null.
export function enReserva({ rpe, rir }) {
  if (rir !== null && rir !== undefined && rir !== '') return Math.max(0, Number(rir));
  if (rpe !== null && rpe !== undefined && rpe !== '') return Math.max(0, 10 - Number(rpe));
  return null;
}

// 1RM estimado (Epley) ajustado por esfuerzo: suma las repeticiones en reserva.
// Sin RPE ni RIR cuenta como al fallo. Fuera de 1–12 repeticiones no se estima.
// Una sola repetición sin reserva es el propio 1RM (convención de Epley).
export function e1rm({ kg, reps, rpe, rir }) {
  const k = Number(kg), r = Number(reps);
  if (!k || !r || r < 1 || r > 12) return null;
  const total = r + (enReserva({ rpe, rir }) ?? 0);
  if (total <= 1) return Math.round(k * 10) / 10;
  return Math.round(k * (1 + total / 30) * 10) / 10;
}

// La carga que corresponde a un 1RM para hacer `reps` dejando `rir` en recámara (la inversa de e1rm).
export function kgPara(unoRM, reps, rir = 0, paso = 2.5) {
  const m = Number(unoRM);
  if (!m || !reps) return null;
  const total = Number(reps) + Number(rir);
  const kg = total <= 1 ? m : m / (1 + total / 30);
  return Math.round(kg / paso) * paso;
}

// Tabla de cargas por repeticiones y RPE a partir de un 1RM: [{reps, cargas: [{rpe, kg}]}]
export const RPE_TABLA = [10, 9, 8, 7, 6];
export function tablaRpe(unoRM, { repsMax = 10, paso = 2.5 } = {}) {
  return Array.from({ length: repsMax }, (_, i) => ({
    reps: i + 1,
    cargas: RPE_TABLA.map((rpe) => ({ rpe, kg: kgPara(unoRM, i + 1, 10 - rpe, paso) })),
  }));
}

// Mejor e1RM por semana para un ejercicio. series: [{kg, reps, rpe, rir, fecha}]
export function e1rmPorSemana(series) {
  const porSemana = new Map();
  for (const s of series) {
    const v = e1rm(s);
    if (v === null || !s.fecha) continue;
    const sem = lunesDe(s.fecha);
    if (!porSemana.has(sem) || porSemana.get(sem) < v) porSemana.set(sem, v);
  }
  return [...porSemana.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([semana, valor]) => ({ semana, valor }));
}

// Series semanales por grupo muscular. El primer grupo del ejercicio es el principal y cuenta 1;
// los secundarios cuentan 0,5 (series indirectas). series: [{fecha, reps, grupos:[...]}]
// ---------- volumen semanal objetivo por músculo ----------
// Rango orientativo general: por debajo de ~10 series semanales por músculo suele quedarse corto para
// ganar masa muscular (relación dosis-respuesta: Schoenfeld, Ogborn y Krieger, 2017); el máximo útil
// depende de cada persona. El coach lo ajusta por atleta (atletas.volumen_objetivo).
export const VOLUMEN_DEFECTO = [10, 20];
export function rangoVolumen(objetivo, grupo) {
  const r = objetivo?.[grupo];
  return Array.isArray(r) && r.length === 2 && Number.isFinite(r[0]) && Number.isFinite(r[1]) ? r : VOLUMEN_DEFECTO;
}
export function estadoVolumen(n, [min, max]) {
  return n < min ? 'bajo' : n > max ? 'alto' : 'dentro';
}
// Deja solo los grupos con un rango válido y distinto del general (lo que se guarda en la base)
export function limpiarObjetivo(obj) {
  const out = {};
  for (const [g] of GRUPOS) {
    const r = obj?.[g];
    if (!Array.isArray(r)) continue;
    const [a, b] = r.map(Number);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < a || b > 60) continue;
    if (a === VOLUMEN_DEFECTO[0] && b === VOLUMEN_DEFECTO[1]) continue;
    out[g] = [a, b];
  }
  return Object.keys(out).length ? out : null;
}
// Series pautadas por músculo en un conjunto de pautas (una semana): el principal cuenta 1 y los secundarios 0,5
export function seriesPautadasPorGrupo(pautas, ejerciciosPorId) {
  const cuenta = {};
  for (const p of pautas) {
    const grupos = ejerciciosPorId[p.ejercicio_id]?.grupos_musculares || [];
    grupos.forEach((g, i) => { cuenta[g] = (cuenta[g] || 0) + (Number(p.series) || 0) * (i === 0 ? 1 : 0.5); });
  }
  return cuenta;
}

// De dónde sale cada recuento (v0.35): por músculo, cada ejercicio con sus series y si cuentan enteras (es su
// músculo principal) o a medias (secundario). { pectoral: [{ nombre, series, principal }], … }, de más a menos
export function desglosePautadoPorGrupo(pautas, ejerciciosPorId) {
  const por = {};
  for (const p of pautas) {
    const e = ejerciciosPorId[p.ejercicio_id];
    const n = Number(p.series) || 0;
    if (!e || !n) continue;
    (e.grupos_musculares || []).forEach((g, i) => {
      const lista = (por[g] ||= []);
      const ya = lista.find((x) => x.id === e.id);
      if (ya) ya.series += n; else lista.push({ id: e.id, nombre: e.nombre, series: n, principal: i === 0 });
    });
  }
  for (const g of Object.keys(por)) por[g].sort((a, c) => (c.principal - a.principal) || (c.series - a.series) || a.nombre.localeCompare(c.nombre, 'es'));
  return por;
}
// El principal de un ejercicio es su primer grupo: elegirlo lo pone el primero sin cambiar el orden de los demás
export function conPrincipal(grupos, principal) {
  const g = grupos || [];
  return g.includes(principal) ? [principal, ...g.filter((x) => x !== principal)] : g;
}

export function seriesPorGrupo(series, lunes) {
  const fin = sumarDias(lunes, 6);
  const cuenta = {};
  for (const s of series) {
    if (!s.fecha || s.fecha < lunes || s.fecha > fin || !(Number(s.reps) > 0)) continue;
    (s.grupos || []).forEach((g, i) => { cuenta[g] = (cuenta[g] || 0) + (i === 0 ? 1 : 0.5); });
  }
  return cuenta;
}

// Una serie hecha en texto: «62,5×5 @9»; sin carga (peso corporal), «12 rep @8»
export function textoSerie(s) {
  const base = Number(s.kg) > 0 ? `${num(s.kg, 2)}×${s.reps ?? '—'}` : `${s.reps ?? '—'} rep`;
  return s.rpe != null && s.rpe !== '' ? `${base} @${num(s.rpe)}` : base;
}

// Serie top + back-off: la primera serie es la top y las demás van un % por debajo de lo que se hizo en ella
export const esTopBackoff = (se) => se?.backoff_pct != null && Number(se.backoff_pct) > 0 && Number(se.series) >= 2;

// Carga de las back-off: la de la top menos el %, redondeada al salto del ejercicio. Siempre por debajo de la
// top: si el redondeo se come el % (50 kg en máquina al −5 %), un salto menos.
export function cargaBackoff(kgTop, pct, nombre = '') {
  const kg = Number(kgTop);
  if (!(kg > 0) || !(Number(pct) > 0)) return null;
  const paso = incrementoCarga(nombre, kg);
  const bruto = kg * (1 - Number(pct) / 100);
  let redondeado = Math.round(bruto / paso) * paso;
  if (redondeado >= kg) redondeado = kg - paso;
  // Sin un salto por debajo (cargas muy pequeñas), el % tal cual, a medio kilo
  if (!(redondeado > 0)) redondeado = Math.round(bruto * 2) / 2;
  return redondeado > 0 && redondeado < kg ? Math.round(redondeado * 100) / 100 : null;
}

// Propuesta de una back-off (k ≥ 2) en una pauta con top: la segunda sale siempre de la top (la hecha o, si aún
// no, la propuesta); las siguientes, de la top mientras la anterior no esté hecha (si lo está, se repite esa,
// y devuelve null para que se use la regla de siempre). Una serie de más (k > series) también es back-off:
// nunca se propone a la carga de la top. hechas: { numero: serie }.
export function propuestaBackoff(se, k, hechas, deLaTop, nombre = '') {
  if (!esTopBackoff(se) || k < 2) return null;
  if (k > 2 && Number(hechas?.[k - 1]?.kg) > 0) return null;
  const hecha = Number(hechas?.[1]?.kg) > 0;
  const kg = cargaBackoff(hecha ? hechas[1].kg : deLaTop?.kg, se.backoff_pct, nombre);
  if (kg == null) return null;
  return { kg, reps: se.reps_max ?? se.reps_min ?? hechas?.[1]?.reps ?? deLaTop?.reps ?? null, backoff: true, desdeTop: hecha };
}

// Texto de la pauta: "3 × 6–8", "RIR 2", "60 kg", "2:30"; con top + back-off, "1 × 4–6 + 3 × −10 %"
export function pauta(se) {
  const reps = se.reps_min != null && se.reps_max != null && se.reps_min !== se.reps_max
    ? `${se.reps_min}–${se.reps_max}`
    : se.reps_max ?? se.reps_min ?? '';
  const top = esTopBackoff(se);
  if (tieneDetalle(se)) {
    const repsTxt = se.series_detalle.map((x) => x.reps ?? '–');
    const iguales = repsTxt.every((r) => r === repsTxt[0]);
    return {
      series: iguales ? `${se.series_detalle.length} × ${repsTxt[0]}` : `${se.series_detalle.length} series: ${repsTxt.join(' · ')}`,
      top: false, detalle: true,
      esfuerzo: se.rir_objetivo != null ? `RIR ${num(se.rir_objetivo)}` : null,
      carga: null,
      descanso: se.descanso_seg ? mmss(se.descanso_seg) : null,
    };
  }
  return {
    series: top ? `${reps === '' ? 'Top' : `1 × ${reps}`} + ${se.series - 1} × \u2212${num(se.backoff_pct)} %` : `${se.series} × ${reps}`.trim(),
    top,
    esfuerzo: se.rir_objetivo != null ? `RIR ${num(se.rir_objetivo)}` : se.rpe_objetivo != null ? `RPE ${num(se.rpe_objetivo)}` : null,
    carga: se.carga_sugerida_kg != null ? `${num(se.carga_sugerida_kg, 2)} kg` : null,
    descanso: se.descanso_seg ? mmss(se.descanso_seg) : null,
  };
}

// ---------- pauta serie a serie (v0.28, migración 024) ----------
// series_detalle: [{ reps, kg, rpe }, …], una por serie, cada campo opcional. Sin detalle (null), series iguales.
const numeroOk = (v, min, max, entero = false) => {
  if (v === '' || v == null) return null;
  const x = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(x) || x < min || x > max || (entero && !Number.isInteger(x))) return undefined;
  return Math.round(x * 100) / 100;
};
// Limpia un detalle (lo que escribe el coach): null si no vale o está vacío; si no, cada serie con lo que tenga
export function limpiarDetalle(d) {
  if (!Array.isArray(d) || !d.length || d.length > 20) return null;
  const out = [];
  for (const x of d) {
    const reps = numeroOk(x?.reps, 0, 1000, true), kg = numeroOk(x?.kg, 0, 9999.99), rpe = numeroOk(x?.rpe, 1, 10);
    if (reps === undefined || kg === undefined || rpe === undefined) return null;
    out.push({ ...(reps != null ? { reps } : {}), ...(kg != null ? { kg } : {}), ...(rpe != null ? { rpe } : {}) });
  }
  return out;
}
export const tieneDetalle = (se) => Array.isArray(se?.series_detalle) && se.series_detalle.length > 0;
// El resumen de siempre a partir del detalle (para volumen, progreso, avisos…): series, reps mín–máx,
// los kilos de la mayoría de las series (o los de la primera, si todas cambian) y el RPE de la última
export function agregadosDetalle(d) {
  const reps = d.map((x) => x.reps).filter((x) => x != null), kgs = d.map((x) => x.kg).filter((x) => x != null);
  const cuenta = new Map();
  for (const k of kgs) cuenta.set(k, (cuenta.get(k) || 0) + 1);
  const masRepetido = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0];
  const rpes = d.map((x) => x.rpe).filter((x) => x != null);
  return {
    series: d.length,
    reps_min: reps.length ? Math.min(...reps) : null,
    reps_max: reps.length ? Math.max(...reps) : null,
    carga_sugerida_kg: !kgs.length ? null : masRepetido[1] > 1 ? masRepetido[0] : kgs[0],
    rpe_objetivo: rpes.length ? rpes[rpes.length - 1] : null,
  };
}
// Para pasar a serie a serie: cada serie con lo de siempre (reps del tope del rango, kilos y RPE pautados)
export function detalleDesdePauta(se) {
  const reps = se.reps_max ?? se.reps_min ?? null;
  return Array.from({ length: Math.max(1, Math.min(20, Number(se.series) || 1)) }, () => limpiarDetalle([{ reps, kg: se.carga_sugerida_kg, rpe: se.rpe_objetivo }])[0]);
}
// Lo pautado para la serie k (1, 2…), o null sin detalle
export const objetivoSerie = (se, k) => (tieneDetalle(se) ? se.series_detalle[k - 1] || null : null);
// En texto: «10 × 25 kg @8», «12 reps @7», «25 kg»
export function textoObjetivo(o) {
  if (!o) return '';
  const base = o.kg != null ? `${o.reps != null ? `${o.reps} × ` : ''}${num(o.kg, 2)} kg` : o.reps != null ? `${o.reps} reps` : '';
  return `${base}${o.rpe != null ? `${base ? ' ' : ''}@${num(o.rpe)}` : ''}`;
}

// ---------- superseries ----------
// Ejercicios seguidos con la misma letra se hacen alternando (A1, A2, A1, A2…) y se descansa al acabar
// cada ronda. Una letra con un solo ejercicio no es superserie.
export const LETRAS_SUPERSERIE = ['A', 'B', 'C', 'D', 'E'];
export function gruposSuperserie(ejercicios) {
  const grupos = [];
  for (const e of ejercicios) {
    const letra = e.superserie || null;
    const ultimo = grupos[grupos.length - 1];
    if (letra && ultimo?.letra === letra) ultimo.items.push(e);
    else grupos.push({ letra, items: [e] });
  }
  return grupos.flatMap((g) => (g.letra && g.items.length < 2 ? [{ letra: null, items: g.items }] : [g]));
}
export function etiquetasSuperserie(ejercicios) {
  const m = {};
  for (const g of gruposSuperserie(ejercicios)) if (g.letra) g.items.forEach((e, i) => { m[e.id] = `${g.letra}${i + 1}`; });
  return m;
}
// Descanso tras una ronda: el mayor de los pautados en el grupo
export function descansoGrupo(g) {
  return Math.max(0, ...g.items.map((x) => Number(x.descanso_seg) || 0)) || null;
}

// Qué toca después de registrar una serie de `eid`. hechas: id → series hechas (contando ya la nueva).
// Devuelve { descanso (segundos, 0 = pasar sin descanso, null = sin temporizador), siguiente: { id, numero } | null, enRonda }
export function trasSerie(ejercicios, hechas, eid) {
  const h = (x) => hechas[x.id] || 0;
  const pendiente = (x) => h(x) < x.series;
  const grupos = gruposSuperserie(ejercicios);
  const gi = grupos.findIndex((g) => g.items.some((x) => x.id === eid));
  if (gi < 0) return { descanso: null, siguiente: null, enRonda: false };
  const g = grupos[gi];
  const e = g.items.find((x) => x.id === eid);
  const sig = (x) => (x ? { id: x.id, numero: h(x) + 1 } : null);
  // El siguiente pendiente fuera del grupo: primero los que vienen después, luego los de antes
  const fuera = () => sig([...grupos.slice(gi + 1), ...grupos.slice(0, gi)].flatMap((x) => x.items).find(pendiente));
  if (g.letra) {
    const n = h(e);
    const i = g.items.indexOf(e);
    const resto = [...g.items.slice(i + 1), ...g.items.slice(0, i)];
    const enRonda = resto.find((x) => h(x) < n && pendiente(x));
    if (enRonda) return { descanso: 0, siguiente: sig(enRonda), enRonda: true };
    const proxima = g.items.find(pendiente);
    return { descanso: descansoGrupo(g), siguiente: proxima ? sig(proxima) : fuera(), enRonda: false };
  }
  return { descanso: Number(e.descanso_seg) || null, siguiente: pendiente(e) ? sig(e) : fuera(), enRonda: false };
}

// Valores con los que se rellena una serie nueva. Carga: la mayor entre la pautada, la de la última vez
// y la que sugiere la doble progresión, para que una progresión del coach no se pierda y tampoco se
// retroceda si el atleta ya la superó. Excepción: si el coach ha BAJADO la carga respecto a la pauta
// anterior (una descarga), manda la pauta.
export function propuestaSerie(se, ultimas, numero, { sugerencia = null, pautaAnterior = null } = {}) {
  const previa = (ultimas || []).find((u) => u.numero === numero) || (ultimas || [])[0];
  const pautada = se.carga_sugerida_kg != null ? Number(se.carga_sugerida_kg) : null;
  let kg;
  if (bajaDelCoach(se, pautaAnterior)) kg = pautada;
  else {
    const candidatas = [previa?.kg, pautada, sugerencia?.tipo === 'subir' ? sugerencia.kg : null].filter((x) => x != null).map(Number);
    kg = candidatas.length ? Math.max(...candidatas) : null;
  }
  const reps = se.reps_max ?? se.reps_min ?? previa?.reps ?? null;
  return { kg: kg === null ? null : Number(kg), reps: reps === null ? null : Number(reps) };
}

const bajaDelCoach = (se, anterior) => se.carga_sugerida_kg != null && anterior?.carga_sugerida_kg != null
  && Number(se.carga_sugerida_kg) < Number(anterior.carga_sugerida_kg);

// Salto de carga habitual: 2,5 kg en barra; 2 kg en mancuernas; en máquinas y poleas, 2,5 o 5 kg.
export function incrementoCarga(nombre = '', kg = 0) {
  if (esBarra(nombre)) return 2.5;
  if (/mancuerna|b\u00falgara|bulgara|kettlebell/i.test(nombre)) return 2;
  return Number(kg) >= 50 ? 5 : 2.5;
}

// Doble progresión sobre lo que hizo la última vez con la carga más alta (sus series de trabajo):
//  · llegó al tope del rango en todas las series pautadas sin pasarse del esfuerzo objetivo → subir;
//  · se quedó por debajo del mínimo en alguna → mantener la carga;
//  · dentro del rango → misma carga, sumando repeticiones.
// No sugiere nada en semanas de descarga ni si el coach ha bajado la carga.
export function sugerenciaProgresion(se, ultimas, { nombre = '', foco = null, pautaAnterior = null } = {}) {
  let hechas = (ultimas || []).filter((s) => Number(s.kg) > 0 && Number(s.reps) > 0);
  // Con top + back-off solo cuenta la top (las back-off la siguen solas)
  const top = esTopBackoff(se);
  // Si la vez anterior fue top + back-off y hoy son series iguales, lo de entonces no dice qué carga aguantan
  // todas: no se sugiere nada (la pauta del coach o lo hecho serie a serie mandan)
  if (!top && esTopBackoff(pautaAnterior)) return null;
  if (top) hechas = hechas.filter((s) => Number(s.numero) === 1).slice(0, 1);
  if (!hechas.length || se.reps_max == null || foco === 'descarga' || bajaDelCoach(se, pautaAnterior)) return null;
  const kg = Math.max(...hechas.map((s) => Number(s.kg)));
  const trabajo = hechas.filter((s) => Number(s.kg) === kg);
  const objetivo = se.rir_objetivo != null ? Number(se.rir_objetivo) : se.rpe_objetivo != null ? 10 - Number(se.rpe_objetivo) : null;
  const reservas = trabajo.map(enReserva).filter((x) => x != null);
  const sinPasarse = objetivo == null || !reservas.length || reservas.every((r) => r >= objetivo - 0.5);
  const min = se.reps_min ?? se.reps_max;
  if (trabajo.length >= (top ? 1 : se.series || 1) && trabajo.every((s) => Number(s.reps) >= se.reps_max) && sinPasarse) {
    const nuevo = Math.round((kg + incrementoCarga(nombre, kg)) * 100) / 100;
    return { tipo: 'subir', kg: nuevo, texto: `La última vez llegaste a ${se.reps_max} en ${top ? 'la serie top' : 'todas las series'}${reservas.length && objetivo != null ? ' sin pasarte de esfuerzo' : ''}: prueba con ${num(nuevo, 2)} kg${top ? ' en la top' : ''}.` };
  }
  if (trabajo.some((s) => Number(s.reps) < min)) {
    return { tipo: 'mantener', kg, texto: `La última vez no llegaste a ${min} en alguna serie: repite ${num(kg, 2)} kg hasta completar el rango.` };
  }
  return { tipo: 'repetir', kg, texto: `Misma carga (${num(kg, 2)} kg) e intenta sumar una repetición hasta llegar a ${se.reps_max}.` };
}

// Series de aproximación hasta la carga de trabajo. Con barra: empieza con la barra vacía y redondea a 2,5 kg.
export function aproximaciones(kgTrabajo, repsTrabajo = 5, { barra = 20, paso = 2.5 } = {}) {
  const kg = Number(kgTrabajo);
  const minimo = barra || paso;
  if (!kg || kg <= minimo * 1.5) return [];
  let plan;
  if (!barra) plan = [[0.5, 8], [0.75, 4]];
  else if (kg >= 100) plan = [[0, 10], [0.4, 5], [0.6, 3], [0.75, 2], [0.85, 1]];
  else if (kg >= 60) plan = [[0, 10], [0.5, 5], [0.7, 3], [0.85, 1]];
  else plan = [[0, 10], [0.6, 5], [0.8, 2]];
  if (repsTrabajo >= 8) plan = plan.filter(([p]) => p < 0.85);
  const out = [];
  for (const [p, reps] of plan) {
    const c = p === 0 ? barra : Math.max(minimo, Math.round((kg * p) / paso) * paso);
    if (c >= kg || out.some((x) => x.kg === c)) continue;
    out.push({ kg: c, reps, discos: barra ? discosPorLado(c, barra) : null });
  }
  return out;
}

// Historial de un ejercicio: sesiones (la más reciente primero) con su mejor serie, récords y evolución.
// series: [{fecha, sesion_id, numero, kg, reps, rpe, rir}]
export function resumenEjercicio(series) {
  const grupos = new Map();
  for (const s of series) {
    const k = s.sesion_id || s.fecha;
    if (!grupos.has(k)) grupos.set(k, { fecha: s.fecha, sesion_id: s.sesion_id || null, series: [] });
    grupos.get(k).series.push(s);
  }
  const cronologico = [...grupos.values()].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  let mejorHastaAhora = 0;
  const sesiones = cronologico.map((g) => {
    g.series.sort((a, b) => a.numero - b.numero);
    let top = null, mejor = null;
    for (const s of g.series) { const v = e1rm(s); if (v != null && (mejor == null || v > mejor)) { mejor = v; top = s; } }
    const volumen = g.series.reduce((t, s) => t + (Number(s.kg) || 0) * (Number(s.reps) || 0), 0);
    const record = mejor != null && mejorHastaAhora > 0 && mejor > mejorHastaAhora;
    if (mejor != null) mejorHastaAhora = Math.max(mejorHastaAhora, mejor);
    return { ...g, mejor, top, volumen, record };
  }).reverse();
  const conE = sesiones.filter((s) => s.mejor != null);
  const mejor = conE.reduce((m, s) => (!m || s.mejor > m.mejor ? s : m), null);
  // Mejor carga movida para cada número de repeticiones (récords por repeticiones)
  const porReps = {};
  for (const s of series) {
    const r = Number(s.reps), k = Number(s.kg);
    if (!(r > 0 && r <= 12 && k > 0)) continue;
    if (!porReps[r] || k > porReps[r].kg) porReps[r] = { kg: k, fecha: s.fecha };
  }
  return { sesiones, mejor: mejor ? { valor: mejor.mejor, fecha: mejor.fecha, serie: mejor.top } : null, porReps, puntos: e1rmPorSemana(series) };
}

// Exportación de series a CSV para Excel en español (punto y coma, coma decimal, BOM).
// ---------- peso: tendencia y ritmo ----------
// Tendencia: media móvil exponencial por días (como The Hacker's Diet o MacroFactor). Suaviza el agua,
// la sal y el glucógeno del día a día; con días sin pesarse, el peso del día cuenta más.
export function tendenciaPeso(pesos, alfa = 0.1) {
  const lista = [...pesos].filter((p) => p.fecha && Number(p.kg) > 0).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  // Arranca en la media de la primera semana, para no heredar el sesgo del primer día
  const primeros = lista.filter((p) => lista.length && diasEntre(lista[0].fecha, p.fecha) < 7).map((p) => Number(p.kg));
  let t = null, antes = null;
  return lista.map((p) => {
    const kg = Number(p.kg);
    if (t == null) t = primeros.reduce((a, b) => a + b, 0) / primeros.length;
    else t += (1 - Math.pow(1 - alfa, Math.max(1, diasEntre(antes, p.fecha)))) * (kg - t);
    antes = p.fecha;
    return { fecha: p.fecha, kg, tendencia: Math.round(t * 100) / 100 };
  });
}
// Ritmo: pendiente de los pesos de los últimos `dias` (regresión lineal), en kg y % por semana.
// Hace falta al menos 3 pesos que abarquen una semana.
export function ritmoPeso(serie, dias = 21) {
  if (!serie.length) return null;
  const fin = serie[serie.length - 1].fecha;
  const tramo = serie.filter((p) => diasEntre(p.fecha, fin) <= dias);
  if (tramo.length < 3 || diasEntre(tramo[0].fecha, fin) < 7) return null;
  const xs = tramo.map((p) => diasEntre(tramo[0].fecha, p.fecha)), ys = tramo.map((p) => p.kg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  const pend = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx;
  const kgSemana = Math.round(pend * 7 * 100) / 100;
  const actual = tramo[tramo.length - 1].tendencia;
  return { kgSemana, pctSemana: Math.round((kgSemana / actual) * 1000) / 10, dias: diasEntre(tramo[0].fecha, fin) };
}

// Cómo va el peso, sin cifras (para Hoy): la tendencia de las últimas semanas (ritmo, de ritmoPeso) frente a
// lo que busca su plan de nutrición: el ritmo que eligió el coach (ritmo_pct, % del peso por semana) o, sin él,
// uno típico de su fase. En camino: a ±0,25 %/semana de lo buscado. Aviso (que lo hable con su coach): moverse
// un 1 %/semana o más fuera de lo buscado, en cualquier sentido. Por debajo de un 0,15 %/semana cuenta como
// estable. diasSinPesar: días desde el último peso (si pasan de 10, la tendencia ya no dice mucho).
// Devuelve { titulo, detalle, tono: 'ok' | 'aviso' | 'neutro', sentido: 'baja' | 'estable' | 'sube' | null }.
const RITMO_TIPICO = { perder: -0.5, ganar: 0.25, mantener: 0, recomposicion: 0 };
export function estadoPeso(ritmo, plan = null, diasSinPesar = 0) {
  if (diasSinPesar > 10) return { titulo: 'Hace días que no te pesas', detalle: 'Con unos pesos más verás cómo va tu tendencia', tono: 'neutro', sentido: null };
  if (!ritmo) return { titulo: 'Tu tendencia, en unos días', detalle: 'Con una semana de pesos verás hacia dónde va', tono: 'neutro', sentido: null };
  const pct = Number(ritmo.pctSemana) || 0;
  const sentido = Math.abs(pct) < 0.15 ? 'estable' : pct < 0 ? 'baja' : 'sube';
  const fase = plan?.fase || null;
  const elegido = plan?.ritmo_pct;
  const busca = elegido != null && elegido !== '' && Number.isFinite(Number(elegido)) ? Number(elegido) : RITMO_TIPICO[fase];
  if (busca == null) {
    return { titulo: sentido === 'estable' ? 'Tu tendencia se mantiene' : sentido === 'baja' ? 'Tu tendencia baja' : 'Tu tendencia sube', detalle: 'En las últimas semanas', tono: 'neutro', sentido };
  }
  const desvio = pct - busca;
  if (Math.abs(desvio) <= 0.25) {
    return { titulo: 'Vas hacia tu objetivo', detalle: sentido === 'estable' ? 'Tu tendencia se mantiene, como buscamos' : sentido === 'baja' ? 'Tu tendencia baja, como buscamos' : 'Tu tendencia sube, como buscamos', tono: 'ok', sentido };
  }
  const verbo = sentido === 'baja' ? 'Bajas' : 'Subes';
  if (Math.abs(pct) >= 1 && sentido !== 'estable') {
    return { titulo: `${verbo} rápido`, detalle: 'Coméntalo con tu coach para ajustar tu plan', tono: 'aviso', sentido };
  }
  if (sentido === 'estable') return { titulo: 'Estable estas semanas', detalle: 'A veces tarda en moverse: sigue con lo tuyo y lo vemos en el check-in', tono: 'neutro', sentido };
  const mismoSentido = Math.sign(pct) === Math.sign(busca);
  return { titulo: sentido === 'baja' ? 'Tu tendencia baja' : 'Tu tendencia sube',
    detalle: mismoSentido ? (Math.abs(pct) > Math.abs(busca) ? 'Algo más rápido de lo previsto: lo vemos en el check-in' : 'Algo más despacio de lo previsto: lo vemos en el check-in') : 'Lo vemos en el check-in', tono: 'neutro', sentido };
}

// ---------- carga de entrenamiento (RPE de la sesión × minutos; Foster y cols., 2001) ----------
// sesiones: [{ completada, fecha_realizada, rpe_sesion, duracion_min }]. Devuelve las últimas `semanas`
// (de lunes a domingo, hasta la actual) con su carga en unidades arbitrarias (UA).
export function cargaSemanal(sesiones, hoy = hoyISO(), semanas = 8) {
  const lunes = lunesDe(hoy);
  const porLunes = {};
  for (const s of sesiones) {
    if (!s.completada || !s.fecha_realizada || !(s.rpe_sesion > 0) || !(s.duracion_min > 0)) continue;
    const k = lunesDe(s.fecha_realizada);
    const x = (porLunes[k] ||= { carga: 0, sesiones: 0 });
    x.carga += s.rpe_sesion * s.duracion_min;
    x.sesiones++;
  }
  return Array.from({ length: semanas }, (_, i) => {
    const l = sumarDias(lunes, -7 * (semanas - 1 - i));
    return { lunes: l, carga: porLunes[l]?.carga || 0, sesiones: porLunes[l]?.sesiones || 0, enCurso: l === lunes };
  });
}
// La última semana completa frente a la media de las 4 anteriores (sin contar semanas a 0).
export function cambioCarga(lista) {
  const cerradas = lista.filter((w) => !w.enCurso);
  const ultima = cerradas[cerradas.length - 1];
  const previas = cerradas.slice(-5, -1).filter((w) => w.carga > 0);
  if (!ultima || previas.length < 2) return null;
  const media = previas.reduce((t, w) => t + w.carga, 0) / previas.length;
  return { semana: ultima.lunes, carga: ultima.carga, media: Math.round(media), ratio: Math.round((ultima.carga / media) * 100) / 100 };
}

// ---------- duración ----------
// Minutos aproximados de una lista de ejercicios: 40 s por serie más los descansos (en una superserie, uno por ronda).
// pendientes: id → series que faltan (si no se da, se cuentan todas)
export function duracionEstimada(ejercicios, pendientes = null) {
  const n = (e) => (pendientes ? Math.max(0, pendientes[e.id] ?? 0) : e.series);
  const seg = gruposSuperserie(ejercicios).reduce((t, g) => {
    if (!g.letra) return t + g.items.reduce((u, e) => u + n(e) * (40 + (e.descanso_seg || 90)), 0);
    const rondas = Math.max(0, ...g.items.map(n));
    return t + g.items.reduce((u, e) => u + n(e) * 40, 0) + rondas * (descansoGrupo(g) || 90);
  }, 0);
  return Math.round(seg / 60 / 5) * 5;
}

// ---------- récords ----------
// Mejores marcas de cada ejercicio: 1RM estimado, la carga más alta movida con al menos N repeticiones
// y, en ejercicios sin carga, el máximo de repeticiones.
export function sumarMarca(m, s) {
  if (!s.ejercicio_id) return m;
  const x = (m[s.ejercicio_id] ||= { n: 0, e1rm: null, kgPorReps: {}, repsSinCarga: 0 });
  x.n++;
  const r = Number(s.reps) || 0, k = Number(s.kg) || 0;
  if (r <= 0) return m;
  if (k > 0) {
    const v = e1rm(s);
    if (v != null && (!x.e1rm || v > x.e1rm.valor)) x.e1rm = { valor: v, kg: k, reps: r, rpe: s.rpe ?? null, fecha: s.fecha || null };
    for (let i = 1; i <= Math.min(r, 12); i++) if (!x.kgPorReps[i] || k > x.kgPorReps[i].kg) x.kgPorReps[i] = { kg: k, reps: r, fecha: s.fecha || null };
  } else if (r > x.repsSinCarga) x.repsSinCarga = r;
  return m;
}
export function mejoresMarcas(series) {
  const m = {};
  for (const s of series) sumarMarca(m, s);
  return m;
}
// ¿Bate esta serie lo anterior? Sin historial del ejercicio no hay récord (la primera vez todo lo sería).
export function recordDe(s, prev) {
  if (!prev?.n) return null;
  const r = Number(s.reps) || 0, k = Number(s.kg) || 0;
  if (r <= 0) return null;
  if (k <= 0) {
    return prev.repsSinCarga > 0 && r > prev.repsSinCarga
      ? { tipo: 'reps', reps: r, antes: prev.repsSinCarga, texto: `${r} repeticiones (antes ${prev.repsSinCarga})` } : null;
  }
  // El 1RM estimado solo se compara si la serie dice cuánto costó (sin RPE se supondría al fallo y saldría inflado)
  const conEsfuerzo = (s.rpe != null && s.rpe !== '') || (s.rir != null && s.rir !== '');
  const v = conEsfuerzo ? e1rm(s) : null;
  if (v != null && prev.e1rm && v > prev.e1rm.valor) {
    return { tipo: 'e1rm', valor: v, antes: prev.e1rm.valor, texto: `1RM estimado ${num(v)} kg (antes ${num(prev.e1rm.valor)})` };
  }
  const ant = r <= 12 ? prev.kgPorReps[r] : null;
  if (ant && k > ant.kg) {
    return { tipo: 'kg', reps: r, kg: k, antes: ant.kg, texto: `${num(k, 2)} kg a ${r} repeticiones (antes ${num(ant.kg, 2)})` };
  }
  return null;
}
// Récords de una tanda de series en orden (las de hoy): cada una frente a lo anterior y a las previas del día.
// clave(s) identifica cada serie en el resultado.
export function recordsDeSesion(series, previas, clave = (s) => s.id) {
  const m = JSON.parse(JSON.stringify(previas || {}));
  const conHistorial = new Set(Object.keys(m).filter((k) => m[k].n > 0));
  const out = {};
  for (const s of series) {
    if (conHistorial.has(s.ejercicio_id)) {
      const r = recordDe(s, m[s.ejercicio_id]);
      if (r) out[clave(s)] = r;
    }
    sumarMarca(m, s);
  }
  return out;
}
// Vitrina: la mejor marca de cada ejercicio y cuándo se hizo, más los récords de los últimos días.
// Récords de todo el historial, sesión a sesión y en orden: [{ fecha, sesion_id, ejercicio_id, ejercicio, record }]
// (uno por ejercicio y sesión). Devuelve también las mejores marcas finales.
export function eventosRecord(series) {
  const orden = [...series].sort((a, b) => ((a.fecha || '') + (a.registrada_en || '') < (b.fecha || '') + (b.registrada_en || '') ? -1 : 1));
  const m = {};
  const eventos = [];
  const porSesion = new Map();
  for (const s of orden) { const k = s.sesion_id || s.fecha; if (!porSesion.has(k)) porSesion.set(k, []); porSesion.get(k).push(s); }
  for (const lote of porSesion.values()) {
    const rec = recordsDeSesion(lote, m, (s) => s.id);
    const vistos = new Set();
    for (const s of lote) {
      if (rec[s.id] && !vistos.has(s.ejercicio_id)) {
        vistos.add(s.ejercicio_id);
        eventos.push({ fecha: s.fecha, sesion_id: s.sesion_id || null, ejercicio_id: s.ejercicio_id, ejercicio: s.ejercicio, record: rec[s.id] });
      }
    }
    for (const s of lote) sumarMarca(m, s);
  }
  return { eventos, marcas: m };
}
export function vitrina(series, hoy = hoyISO(), dias = 30) {
  const { eventos, marcas: m } = eventosRecord(series);
  const desde = sumarDias(hoy, -dias);
  const nombres = Object.fromEntries(series.map((s) => [s.ejercicio_id, s.ejercicio]));
  const ultimo = {};
  for (const e of eventos) ultimo[e.ejercicio_id] = e.fecha;
  const ejercicios = Object.entries(m).filter(([, x]) => x.e1rm || x.repsSinCarga).map(([id, x]) => ({
    id, nombre: nombres[id] || 'Ejercicio', e1rm: x.e1rm, kgPorReps: x.kgPorReps, repsSinCarga: x.repsSinCarga,
    ultimoRecord: ultimo[id] || null,
  })).sort((a, b) => ((b.ultimoRecord || b.e1rm?.fecha || '') > (a.ultimoRecord || a.e1rm?.fecha || '') ? 1 : -1));
  return { ejercicios, recientes: eventos.filter((e) => e.fecha >= desde).reverse() };
}

// ---------- resumen de una semana (para «Tu semana») ----------
// d: { series (historial), sesiones (programadas, con semana_lunes, completada, fecha_realizada, duracion_min), pesos }
export function resumenSemanal(d, lunes, { eventos = null } = {}) {
  const domingo = sumarDias(lunes, 6);
  const enSemana = (f) => f && f >= lunes && f <= domingo;
  const series = (d.series || []).filter((s) => enSemana(s.fecha) && Number(s.reps) > 0);
  const tonelaje = (lista) => lista.reduce((t, s) => t + (Number(s.kg) || 0) * (Number(s.reps) || 0), 0);
  const programadas = (d.sesiones || []).filter((x) => x.semana_lunes === lunes);
  const hechas = (d.sesiones || []).filter((x) => x.completada && enSemana(x.fecha_realizada));
  const antes = (d.series || []).filter((s) => s.fecha >= sumarDias(lunes, -7) && s.fecha < lunes && Number(s.reps) > 0);
  const ev = (eventos || eventosRecord(d.series || []).eventos).filter((e) => enSemana(e.fecha));
  // Mejor serie de la semana: la de 1RM estimado más alto
  let mejor = null;
  for (const s of series) { const v = e1rm(s); if (v && (!mejor || v > mejor.e1rm)) mejor = { ejercicio: s.ejercicio, serie: s, e1rm: v }; }
  const musculos = seriesPorGrupo(series, lunes);
  const top = Object.entries(musculos).sort((a, b) => b[1] - a[1])[0] || null;
  // Peso: tendencia al acabar la semana frente a la de la semana anterior
  const tend = tendenciaPeso(d.pesos || []);
  const hasta = (f) => [...tend].reverse().find((p) => p.fecha <= f) || null;
  const pFin = hasta(domingo), pAntes = hasta(sumarDias(lunes, -1));
  const peso = pFin && pAntes && pFin.fecha >= lunes ? { antes: pAntes.tendencia, despues: pFin.tendencia, cambio: Math.round((pFin.tendencia - pAntes.tendencia) * 100) / 100 } : null;
  const ton = tonelaje(series), tonAntes = tonelaje(antes);
  return {
    lunes, domingo,
    // completa: todas las sesiones programadas para esa semana hechas (como en la racha); una sesión atrasada de otra
    // semana suma a «hechas» pero no completa esta
    sesiones: { hechas: hechas.length, total: Math.max(programadas.length, hechas.length), completa: programadas.length > 0 && programadas.every((x) => x.completada) },
    series: series.length,
    tonelaje: ton,
    cambioTonelaje: tonAntes > 0 ? Math.round(((ton - tonAntes) / tonAntes) * 100) : null,
    minutos: hechas.reduce((t, x) => t + (Number(x.duracion_min) || 0), 0),
    // Cardio de la semana (v0.17): lo apuntado al terminar (modalidad, minutos y km)
    cardio: hechas.reduce((c, x) => {
      const h = cardioHechoDe(x);
      if (!h) return c;
      return { minutos: c.minutos + Number(h.minutos), km: Math.round((c.km + (Number(h.km) || 0)) * 10) / 10, sesiones: c.sesiones + 1 };
    }, { minutos: 0, km: 0, sesiones: 0 }),
    records: ev.map((e) => ({ ejercicio: e.ejercicio, texto: e.record.texto, tipo: e.record.tipo })),
    mejor,
    musculos,
    musculoTop: top ? { grupo: top[0], series: top[1] } : null,
    peso,
    vacia: !series.length && !hechas.length,
  };
}

export function seriesACsv(series) {
  const c = (v) => {
    if (v === null || v === undefined || v === '') return '';
    let t = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
    // Un texto que empieza por = + - @ (o tabulador/retorno) lo ejecutaría Excel como fórmula: se neutraliza con '
    if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(t)) t = `'${t}`;
    return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const filas = [['Fecha', 'Ejercicio', 'Serie', 'Kg', 'Repeticiones', 'RPE', 'RIR', '1RM estimado', 'Hecho como', 'Nota']];
  for (const s of series) filas.push([s.fecha, s.pautado || s.ejercicio, s.numero, s.kg == null ? null : Number(s.kg), s.reps, s.rpe == null ? null : Number(s.rpe), s.rir == null ? null : Number(s.rir), e1rm(s), s.sustituto ? s.ejercicio : null, s.nota]);
  return '﻿' + filas.map((f) => f.map(c).join(';')).join('\r\n') + '\r\n';
}

// ---------- Discos ----------

// ¿Se carga con discos en una barra olímpica? (por el nombre del ejercicio)
export function esBarra(nombre = '') {
  const n = nombre.toLowerCase();
  if (/mancuerna|m\u00e1quina|maquina|multipower|polea|unilateral|landmine|trap bar|kettlebell/.test(n)) return false;
  return /barra|press banca|peso muerto convencional|remo pendlay|hip thrust$|rack pull|good morning/.test(n);
}

// Discos por lado para llegar a una carga total con barra de 20 kg (los que hay en cualquier gimnasio).
// Devuelve null si no se puede cargar exacto.
export const DISCOS = [25, 20, 15, 10, 5, 2.5, 1.25];
export function discosPorLado(total, barra = 20) {
  const kg = Number(total);
  if (!kg || kg < barra) return null;
  let resto = Math.round(((kg - barra) / 2) * 100) / 100;
  const lado = [];
  for (const d of DISCOS) while (resto >= d - 1e-9) { lado.push(d); resto = Math.round((resto - d) * 100) / 100; }
  return resto > 0.001 ? null : lado;
}

// ---------- Escalas del check-in ----------

export const ESCALAS = {
  energia: ['Exhausto, necesito descansar', 'Cansancio que afecta al rendimiento', 'Cansancio moderado, puedo seguir', 'Algo de cansancio leve', 'Descansado y con energía'],
  recuperacion: ['Agotado, fatiga considerable', 'Bastante fatigado, rindo menos', 'Algo de fatiga, puedo seguir', 'Ligera fatiga, bien en general', 'Al 100 %, sin fatiga ni dolor'],
  motivacion: ['Sin motivación', 'Poca motivación', 'Neutral', 'Motivado', 'Muy motivado'],
  adherencia: ['<25 %', '25–50 %', '50–75 %', '>75 %', '100 %'],
  saciedad: ['Me quedo con mucha hambre', 'Me quedo con algo de hambre', 'Acabo bien', 'Acabo muy lleno'],
  satisfaccion: ['No disfruto ninguna comida', 'Disfruto menos de la mitad', 'Disfruto la mitad', 'Disfruto más de la mitad', 'Disfruto casi todas'],
  molestia: ['Sin dolor', 'Molestia leve', 'Dolor moderado', 'Dolor grave'],
};

export const HORAS_SUENO = ['<5', '5-6', '6-7', '7-8', '>8'];

export const ZONAS = [
  ['hombros', 'Hombros'], ['pectoral', 'Pectoral'], ['triceps', 'Tríceps'], ['espalda_alta', 'Espalda alta'],
  ['zona_lumbar', 'Zona lumbar'], ['femoral_gluteo', 'Femoral y glúteo'], ['cuadriceps', 'Cuádriceps'],
  ['aductor', 'Aductor'], ['otra', 'Otra zona'],
];
export const NOMBRE_ZONA = Object.fromEntries(ZONAS);

export const GRUPOS = [
  ['pectoral', 'Pectoral'], ['espalda', 'Espalda'], ['deltoides', 'Deltoides'], ['cuadriceps', 'Cuádriceps'],
  ['gluteo', 'Glúteo'], ['isquiotibiales', 'Isquiotibiales'], ['biceps', 'Bíceps'], ['triceps', 'Tríceps'],
  ['abdominales', 'Abdominales'], ['gemelo', 'Gemelo'],
];
export const NOMBRE_GRUPO = Object.fromEntries(GRUPOS);

export const PRIORIDADES = [
  ['alta', 'Obligatorio'], ['media', 'Muy importante'], ['baja', 'Accesorio'], ['muy_baja', 'Prescindible'],
];
export const NOMBRE_PRIORIDAD = Object.fromEntries(PRIORIDADES);

export const FOCOS = [
  ['adaptacion', 'Adaptación'], ['tecnica', 'Técnica'], ['volumen', 'Volumen'], ['intensidad', 'Intensidad'],
  ['descarga', 'Descarga'], ['mixto', 'Mixto'], ['evaluacion', 'Evaluación'], ['peaking', 'Peaking'],
];
export const NOMBRE_FOCO = Object.fromEntries(FOCOS);

export const INTENCIONES = [
  ['rendimiento', 'Rendimiento'], ['volumen', 'Volumen'], ['tecnica', 'Técnica'], ['recuperacion_activa', 'Recuperación activa'],
];
export const NOMBRE_INTENCION = Object.fromEntries(INTENCIONES);

export const TIPOS_SESION = [['fuerza', 'Fuerza'], ['cardio', 'Cardio'], ['movilidad', 'Movilidad']];
export const NOMBRE_TIPO_SESION = Object.fromEntries(TIPOS_SESION);

export const TIPOS_EJERCICIO = [['basico', 'Básico'], ['multiarticular', 'Multiarticular'], ['aislamiento', 'Aislamiento']];
export const NOMBRE_TIPO_EJERCICIO = Object.fromEntries(TIPOS_EJERCICIO);

export const MEDIDAS = [
  ['cintura_cm', 'Cintura'], ['cadera_cm', 'Cadera'], ['pecho_cm', 'Pecho'],
  ['brazo_cm', 'Brazo'], ['muslo_cm', 'Muslo'], ['pantorrilla_cm', 'Pantorrilla'],
];
export const NOMBRE_MEDIDA = Object.fromEntries(MEDIDAS);

export const CATEGORIAS_RECURSO = [
  ['entrenamiento', 'Entrenamiento'], ['tecnica', 'Técnica'], ['alimentacion', 'Alimentación'],
  ['descanso', 'Descanso'], ['faq', 'Preguntas frecuentes'], ['general', 'General'],
];
export const NOMBRE_CATEGORIA = Object.fromEntries(CATEGORIAS_RECURSO);

export const ESTADOS_OBJETIVO = [['no_iniciado', 'Sin empezar'], ['en_curso', 'En curso'], ['completado', 'Conseguido'], ['descartado', 'Descartado']];
export const NOMBRE_ESTADO_OBJETIVO = Object.fromEntries(ESTADOS_OBJETIVO);

// ---------- Semana actual ----------

// La semana programada que contiene hoy; si no hay, la última ya empezada; si no, la primera futura.
export function semanaActual(semanas, hoy = hoyISO()) {
  const conFecha = semanas.filter((s) => s.fecha_inicio).sort((a, b) => (a.fecha_inicio < b.fecha_inicio ? -1 : 1));
  const dentro = conFecha.find((s) => s.fecha_inicio <= hoy && hoy <= sumarDias(s.fecha_inicio, 6));
  if (dentro) return dentro;
  const pasadas = conFecha.filter((s) => s.fecha_inicio <= hoy);
  if (pasadas.length) return pasadas[pasadas.length - 1];
  return conFecha[0] || semanas[0] || null;
}

// ---------- constancia ----------
// Racha: semanas seguidas con todas las sesiones programadas hechas, de la más reciente hacia atrás.
// La semana en curso suma si ya está completa y no rompe la racha si aún no lo está.
// Las semanas sin nada programado (descansos entre bloques) no cuentan ni rompen.
// semanas: [{ fecha_inicio, total, hechas }] (pueden repetirse lunes: se suman)
export function racha(semanas, hoy = hoyISO()) {
  const lunes = lunesDe(hoy);
  const porLunes = new Map();
  for (const s of semanas) {
    if (!s.fecha_inicio || !s.total) continue;
    const k = lunesDe(s.fecha_inicio);
    const x = porLunes.get(k) || { total: 0, hechas: 0 };
    x.total += s.total; x.hechas += s.hechas;
    porLunes.set(k, x);
  }
  const lista = [...porLunes.entries()].filter(([k]) => k <= lunes).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  let n = 0;
  for (const [k, x] of lista) {
    const completa = x.hechas >= x.total;
    if (k === lunes) { if (completa) n++; continue; }
    if (!completa) break;
    n++;
  }
  return n;
}

// Mapa de días entrenados: columnas de semanas (de lunes a domingo), de la más antigua a la actual.
// dias: { 'AAAA-MM-DD': nº de series (o 1 si solo hay una sesión sin series, como el cardio) }
export function mapaCalor(dias, hoy = hoyISO(), semanas = 12) {
  const lunes = lunesDe(hoy);
  const max = Math.max(1, ...Object.values(dias));
  const nivel = (n) => (!n ? 0 : n <= max / 3 ? 1 : n <= (2 * max) / 3 ? 2 : 3);
  return Array.from({ length: semanas }, (_, i) => {
    const l = sumarDias(lunes, -7 * (semanas - 1 - i));
    return {
      lunes: l,
      dias: Array.from({ length: 7 }, (_, d) => {
        const iso = sumarDias(l, d);
        return { iso, n: dias[iso] || 0, nivel: iso > hoy ? -1 : nivel(dias[iso] || 0) };
      }),
    };
  });
}

// ---------- Resumen y avisos del coach ----------

// d: { atleta, bloque, semanas (todas las del bloque), semana (actual), sesiones (de la actual),
//      sesionesPrevias (de la semana anterior), pesos (desc), checkins (desc), molestias (de la semana del último check-in),
//      ultimaSerie (fecha ISO o null) }
export function resumenAtleta(d, hoy = hoyISO()) {
  const alertas = [];
  const { atleta, bloque, semanas = [], semana, sesiones = [], pesos = [], checkins = [], molestias = [] } = d;
  const lunesHoy = lunesDe(hoy);

  const completadas = sesiones.filter((s) => s.completada).length;
  const peso = pesos[0] || null;
  const pesoAnterior = pesos[1] || null;
  const checkin = checkins[0] || null;
  const maxMolestia = molestias.reduce((m, x) => Math.max(m, x.intensidad || 0), 0);
  const zonasMolestia = molestias.filter((x) => x.intensidad >= 2).map((x) => NOMBRE_ZONA[x.zona] || x.zona);

  if (atleta.estado === 'invitado') {
    alertas.push({ tipo: 'invitado', nivel: 'info', texto: 'Aún no ha activado su cuenta' });
  }
  // Solo nutrición (v0.26): nada de avisos de entrenamiento
  const entrena = atleta.entrenamiento !== false;
  if (atleta.estado === 'activo') {
    if (entrena && !bloque) alertas.push({ tipo: 'sin_bloque', nivel: 'aviso', texto: 'Sin bloque activo' });

    const diasSinEntrenar = d.ultimaSerie ? diasEntre(d.ultimaSerie, hoy) : null;
    // Días desde que empezó el bloque (negativo si aún no ha empezado): un bloque que empieza el lunes
    // que viene, o que empezó hace dos días tras una semana de descanso, no es «no entrena»
    const diasBloque = bloque?.fecha_inicio ? diasEntre(bloque.fecha_inicio, hoy) : null;
    const empezado = diasBloque === null || diasBloque >= 0;
    const parado = diasBloque === null ? diasSinEntrenar : Math.min(diasSinEntrenar ?? Infinity, diasBloque);
    if (entrena && bloque && empezado && (parado === null || parado >= 5)) {
      alertas.push({
        tipo: 'sin_entrenar', nivel: 'aviso',
        texto: diasSinEntrenar === null ? 'Todavía no ha registrado ninguna serie' : `${diasSinEntrenar} días sin registrar series`,
      });
    }
    if (maxMolestia >= 2 && checkin && diasEntre(checkin.semana_inicio, lunesHoy) <= 7) {
      alertas.push({
        tipo: 'molestia', nivel: maxMolestia >= 3 ? 'alerta' : 'aviso',
        texto: `${maxMolestia >= 3 ? 'Dolor grave' : 'Dolor moderado'}: ${zonasMolestia.join(', ').toLowerCase()}`,
      });
    }
    const semanaPasada = sumarDias(lunesHoy, -7);
    const tieneReciente = checkins.some((c) => c.semana_inicio >= semanaPasada);
    if (!tieneReciente) alertas.push({ tipo: 'sin_checkin', nivel: 'info', texto: 'Sin check-in la semana pasada' });

    // Carga de la semana pasada muy por encima o por debajo de su media (descriptivo: es para mirarlo, no un diagnóstico)
    const cc = entrena && d.sesionesRecientes ? cambioCarga(cargaSemanal(d.sesionesRecientes, hoy, 6)) : null;
    if (cc && cc.ratio >= 1.5) alertas.push({ tipo: 'carga', nivel: 'info', texto: `Carga de la semana pasada: ${num(cc.ratio)} veces su media` });
    // Cumplimiento de las 4 últimas semanas acabadas
    const cu = entrena ? d.cumplimiento : null;
    if (cu && cu.series.pautadas >= 12 && cu.series.pct < 80) alertas.push({ tipo: 'cumplimiento', nivel: 'aviso', texto: `Solo el ${cu.series.pct} % de lo pautado (4 sem.)` });
    if (cu && cu.esfuerzo.conEsfuerzo >= 20 && cu.esfuerzo.pctEncima >= 40) alertas.push({ tipo: 'esfuerzo', nivel: 'info', texto: `Se pasa del RPE en el ${cu.esfuerzo.pctEncima} % de las series` });
    // Hábitos de la última semana (solo los que llevan al menos una semana puestos)
    if (d.habitos && d.habitos.pct < 50) alertas.push({ tipo: 'habitos', nivel: 'info', texto: `Hábitos: ${d.habitos.pct} % la última semana` });
    // Nutrición: registra poco o el peso se aleja del ritmo del plan
    for (const x of d.nutricion || []) alertas.push({ tipo: x.tipo, nivel: 'info', texto: x.texto });
    // Cuestionario: lo de salud que aún no ha revisado
    if (d.cuestionario) alertas.push({ tipo: d.cuestionario.tipo, nivel: d.cuestionario.nivel, texto: d.cuestionario.texto });
    // Recetas que pide cambiar (v0.26)
    if (d.cambiosReceta) alertas.push({ tipo: 'receta', nivel: 'aviso', texto: d.cambiosReceta === 1 ? 'Pide cambiar una receta' : `Pide cambiar ${d.cambiosReceta} recetas` });
    // Bloque en marcha sin ninguna semana publicada: el atleta abre la app y no ve nada
    if (entrena && bloque && empezado && !semana) {
      const borrador = semanas.filter((s) => s.programacion !== 'programada').sort((a, b) => a.numero - b.numero)[0];
      alertas.push({
        tipo: 'publicar', nivel: 'aviso',
        texto: borrador ? `Publica la semana ${borrador.numero}: aún no ve nada` : 'El bloque no tiene semanas',
      });
    }
    if (entrena && bloque && semana) {
      const ultimaProgramada = semanas.filter((s) => s.programacion === 'programada').sort((a, b) => b.numero - a.numero)[0];
      const esUltimaDelBloque = semana.numero === Math.max(...semanas.map((s) => s.numero));
      const diasDentro = semana.fecha_inicio ? diasEntre(semana.fecha_inicio, hoy) : 0;
      if (ultimaProgramada && ultimaProgramada.id === semana.id && diasDentro >= 3) {
        alertas.push({
          tipo: 'programar', nivel: 'aviso',
          texto: esUltimaDelBloque ? 'Termina el bloque: prepara el siguiente' : `Programa la semana ${semana.numero + 1}`,
        });
      }
    }
  }

  const orden = { alerta: 0, aviso: 1, info: 2 };
  alertas.sort((a, b) => orden[a.nivel] - orden[b.nivel]);

  return {
    atleta_id: atleta.id,
    nombre: atleta.nombre,
    foto: atleta.foto || null,
    estado: atleta.estado,
    servicio: !entrena ? 'nutricion' : atleta.nutricion === false ? 'entrenamiento' : 'completo',
    diasNutricion: d.diasNutricion ?? null,
    bloque: bloque ? { id: bloque.id, numero: bloque.numero, nombre: bloque.nombre, foco: bloque.foco } : null,
    semana: semana ? { id: semana.id, numero: semana.numero, foco: semana.foco, total: semanas.length } : null,
    sesiones: { completadas, total: sesiones.length },
    peso: peso ? { kg: Number(peso.kg), fecha: peso.fecha, cambio: pesoAnterior ? Math.round((peso.kg - pesoAnterior.kg) * 10) / 10 : null, ritmo: ritmoPeso(tendenciaPeso(pesos)) } : null,
    checkin: checkin ? { semana: checkin.semana_inicio, horas_sueno: checkin.horas_sueno, energia: checkin.energia, motivacion: checkin.motivacion } : null,
    maxMolestia,
    ultimaSerie: d.ultimaSerie || null,
    carga: d.sesionesRecientes ? cambioCarga(cargaSemanal(d.sesionesRecientes, hoy, 6)) : null,
    cumplimiento: d.cumplimiento || null,
    habitos: d.habitos || null,
    alertas,
    prioridad: alertas.length ? orden[alertas[0].nivel] : 3,
  };
}

// Cuándo empezó la tanda de series en curso: las series seguidas sin un hueco de más de 3 horas, contando hacia
// atrás desde la última; si la última es de hace más de 3 horas, no hay tanda en curso (el cronómetro empieza de cero).
// Así una sesión que pasa de la medianoche no reinicia el reloj, y retomarla al día siguiente sí.
export function inicioDeTanda(series, ahora = Date.now(), hueco = 3 * 3600e3) {
  const t = series.map((s) => Date.parse(s.registrada_en)).filter((x) => Number.isFinite(x)).sort((a, b) => b - a);
  if (!t.length || ahora - t[0] > hueco) return null;
  let inicio = t[0];
  for (let i = 1; i < t.length && inicio - t[i] <= hueco; i++) inicio = t[i];
  return inicio;
}

// Lo que admite la base para una serie: repeticiones enteras y kilos razonables. Devuelve el problema o null.
export function problemaSerie({ kg, reps }) {
  if (reps == null || !Number.isInteger(Number(reps)) || reps < 0 || reps > 200) return 'Las repeticiones tienen que ser un número entero (por ejemplo, 8).';
  if (kg != null && (!Number.isFinite(Number(kg)) || kg < 0 || kg > 1500)) return 'Revisa los kilos: tienen que estar entre 0 y 1500.';
  return null;
}
