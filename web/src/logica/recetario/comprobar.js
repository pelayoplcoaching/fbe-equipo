// El recetario al día con el plan: ¿lo que come un día cualquiera con sus recetas cuadra con su plan? Lógica pura.
//
// Tres comprobaciones y dos arreglos, para el coach:
//   · el «día medio» del recetario (la media de las recetas de cada comida, con su factor) frente a las kcal y los macros
//     del plan vigente;
//   · las recetas cuyas kcal no coinciden con lo que dan sus macros (4 kcal por gramo de proteína e hidratos, 9 por gramo
//     de grasa). Arreglo: recalcular las kcal a partir de los macros (mandan los macros; decisión de Pelayo);
//   · las recetas que se salen de lo normal en su comida.
//   · Arreglo 2: un factor para todo el recetario (o para las comidas que se elijan) que deja las kcal del día en las del
//     plan. Ojo: el factor multiplica todos los macros a la vez; si el plan cambió solo en hidratos, la proteína se mueve
//     con él. Por eso antes de aplicarlo se enseña cómo quedarían proteína, hidratos y grasa.
import { paraElDia, ordenarTomas, macrosDe, NOMBRE_TOMA } from '../comidas.js';
import { planVigente, objetivoDelDia, kcalDeMacros } from '../nutricion.js';

export const UMBRALES_RECETARIO = {
  kcalReceta: 5,      // % a partir del cual las kcal de una receta no cuadran con sus macros…
  kcalRecetaMin: 25,  // …si además son al menos tantas kcal
  plan: 5,            // % de kcal del día medio frente al plan
  macroPct: 7,        // un macro cuadra si se queda a menos de este % del objetivo…
  macroMin: 5,        // …o a menos de tantos gramos
  fuera: 10,          // % de la mediana de su comida a partir del cual una receta está fuera de línea
  planKcal: 3,        // % a partir del cual las kcal del plan no cuadran con sus propios macros
  factorMinimo: 0.02, // un factor a menos de esto de 1 no merece la pena
};
const U = UMBRALES_RECETARIO;
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const MACROS = ['kcal', 'proteina_g', 'carbos_g', 'grasa_g'];
const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };
const tieneMacros = (r) => !!r && ['proteina_g', 'carbos_g', 'grasa_g'].every((k) => r[k] != null && r[k] !== '');

// Las kcal que dan los macros de una receta (null si le falta alguno)
export const kcalDeReceta = (r) => (tieneMacros(r) ? kcalDeMacros(r.proteina_g, r.carbos_g, r.grasa_g) : null);
// Cuánto se alejan sus kcal de las de sus macros: { calculadas, dif, pct } (null si falta algún dato)
export function desvioKcal(r) {
  const calculadas = kcalDeReceta(r);
  if (calculadas == null || r.kcal == null || r.kcal === '' || !(calculadas > 0)) return null;
  const dif = Number(r.kcal) - calculadas;
  return { calculadas, dif: Math.round(dif), pct: r1((dif / calculadas) * 100) };
}
export function kcalMal(r) {
  const d = desvioKcal(r);
  return !!d && Math.abs(d.pct) > U.kcalReceta && Math.abs(d.dif) >= U.kcalRecetaMin;
}

// Las recetas del recetario (cada una, una vez) con las kcal mal: [{ receta, calculadas, dif, pct }], la peor primero
export function recetasConKcalMal(recetario) {
  return (recetario?.recetas || []).filter(kcalMal).map((receta) => ({ receta, ...desvioKcal(receta) }))
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct) || String(a.receta.nombre).localeCompare(String(b.receta.nombre), 'es'));
}

// La receta con las kcal de sus macros, si las tiene mal (para ver cómo quedaría el día al corregirlas)
const corregida = (r) => (kcalMal(r) ? { ...r, kcal: kcalDeReceta(r) } : r);

// El día medio del recetario: de cada comida, la media de sus recetas (con su factor); y la suma.
//   sin: un día sin su comida opcional (con las recetas de ese tipo de día)
//   corregirKcal: con las kcal de las recetas ya corregidas; factores: { [id de asignación]: factor } en vez del guardado
// Devuelve { kcal, proteina_g, carbos_g, grasa_g, porToma: { [toma]: { n, kcal, … } }, sinRecetas: [tomas] }
export function diaMedio(recetario, { sin = false, corregirKcal = false, factores = null } = {}) {
  const op = recetario?.opcional || null;
  const tomas = ordenarTomas(recetario?.tomas || []).filter((t) => !(sin && op && t === op));
  const out = { kcal: 0, proteina_g: 0, carbos_g: 0, grasa_g: 0, porToma: {}, sinRecetas: [] };
  for (const t of tomas) {
    const as = paraElDia(recetario?.porToma?.[t] || [], !!op && sin).filter((a) => a.receta && a.receta.kcal != null);
    if (!as.length) { out.sinRecetas.push(t); continue; }
    const suma = { kcal: 0, proteina_g: 0, carbos_g: 0, grasa_g: 0 };
    for (const a of as) {
      const m = macrosDe(corregirKcal ? corregida(a.receta) : a.receta, factores?.[a.id] ?? a.factor);
      for (const k of MACROS) suma[k] += Number(m[k]) || 0;
    }
    out.porToma[t] = { n: as.length };
    for (const k of MACROS) { out.porToma[t][k] = r1(suma[k] / as.length); out[k] += suma[k] / as.length; }
  }
  for (const k of MACROS) out[k] = r1(out[k]);
  return out;
}

// La diferencia de un día con el objetivo: { kcal, pct, proteina, carbos, grasa } (cada macro, null si el plan no lo fija)
export function diferencia(dia, obj) {
  if (!dia || !obj?.kcal) return null;
  const d = (v, o) => (o == null ? null : Math.round(v - o));
  return { kcal: Math.round(dia.kcal - obj.kcal), pct: r1(((dia.kcal - obj.kcal) / obj.kcal) * 100), proteina: d(dia.proteina_g, obj.proteina), carbos: d(dia.carbos_g, obj.carbos), grasa: d(dia.grasa_g, obj.grasa) };
}
const macroCuadra = (dif, o) => dif == null || o == null || Math.abs(dif) <= Math.max(U.macroMin, (U.macroPct / 100) * o);
export const kcalCuadran = (dif) => !!dif && Math.abs(dif.pct) < U.plan;
export const macrosCuadran = (dif, obj) => !!dif && macroCuadra(dif.proteina, obj.proteina) && macroCuadra(dif.carbos, obj.carbos) && macroCuadra(dif.grasa, obj.grasa);
export const cuadra = (dif, obj) => kcalCuadran(dif) && macrosCuadran(dif, obj);

// Las recetas que se alejan de lo normal en su comida (más de un 10 % de la mediana; con tres o más recetas del mismo
// tipo de día): [{ asignacion, toma, kcal, mediana, pct }]
export function recetasFueraDeLinea(recetario) {
  const out = [];
  for (const [toma, as] of Object.entries(recetario?.porToma || {})) {
    const grupos = {};
    for (const a of as) if (a.receta?.kcal != null) (grupos[a.variante || 'todos'] ||= []).push({ a, kcal: Number(macrosDe(a.receta, a.factor).kcal) });
    for (const g of Object.values(grupos)) {
      if (g.length < 3) continue;
      const med = mediana(g.map((x) => x.kcal));
      for (const x of g) {
        const pct = med > 0 ? r1(((x.kcal - med) / med) * 100) : 0;
        if (Math.abs(pct) > U.fuera) out.push({ asignacion: x.a, toma, kcal: Math.round(x.kcal), mediana: Math.round(med), pct });
      }
    }
  }
  return out.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
}

export const ESTADOS_RECETARIO = ['no_cuadra', 'kcal_recetas', 'cuadra_kcal_mal', 'incompleto', 'sin_plan', 'sin_recetas', 'cuadra'];
export const NOMBRE_ESTADO_RECETARIO = {
  no_cuadra: 'No cuadra con el plan', kcal_recetas: 'Calorías de las recetas mal', cuadra_kcal_mal: 'Cuadra; recetas con calorías mal',
  incompleto: 'Faltan recetas', sin_plan: 'Sin plan con calorías', sin_recetas: 'Sin recetas', cuadra: 'Cuadra con el plan',
};
export const NIVEL_ESTADO_RECETARIO = { no_cuadra: 'alerta', kcal_recetas: 'aviso', cuadra_kcal_mal: 'aviso', incompleto: 'info', sin_plan: 'info', sin_recetas: 'info', cuadra: 'ok' };

// La comprobación entera de un recetario.
//   recetario: el de api.recetario; planes: los del atleta; hoy: para saber qué plan vale
// Devuelve { estado, plan, objetivo, dia, dif, diaSin, difSin, kcalMal, corregido, fuera, planKcal, recetas }
//   estado: 'cuadra' | 'cuadra_kcal_mal' (cuadra, pero hay recetas con las kcal mal) | 'kcal_recetas' (no cuadra en kcal y,
//   corrigiendo las kcal de las recetas, cuadraría) | 'no_cuadra' | 'incompleto' (una comida sin recetas) | 'sin_plan' | 'sin_recetas'
export function comprobarRecetario({ recetario, planes = [], hoy }) {
  const recetas = (recetario?.recetas || []).length;
  const plan = planVigente(planes, hoy);
  const objetivo = objetivoDelDia(plan, true);
  const mal = recetasConKcalMal(recetario);
  const base = { plan, objetivo, recetas, kcalMal: mal, fuera: recetasFueraDeLinea(recetario), dia: null, dif: null, diaSin: null, difSin: null, corregido: null, planKcal: null };
  if (!recetas) return { ...base, estado: 'sin_recetas' };
  const dia = diaMedio(recetario);
  base.dia = dia;
  if (recetario.opcional) base.diaSin = diaMedio(recetario, { sin: true });
  // Las kcal del plan frente a sus propios macros
  if (plan && tieneMacros(plan) && plan.kcal != null) {
    const calculadas = kcalDeMacros(plan.proteina_g, plan.carbos_g, plan.grasa_g);
    const pct = calculadas > 0 ? r1(((Number(plan.kcal) - calculadas) / calculadas) * 100) : 0;
    if (Math.abs(pct) > U.planKcal) base.planKcal = { kcal: Number(plan.kcal), calculadas, pct };
  }
  if (!objetivo) return { ...base, estado: 'sin_plan' };
  if (dia.sinRecetas.length) return { ...base, estado: 'incompleto' };
  const dif = diferencia(dia, objetivo);
  base.dif = dif;
  if (base.diaSin && !base.diaSin.sinRecetas.length) base.difSin = diferencia(base.diaSin, objetivo);
  if (mal.length) base.corregido = diferencia(diaMedio(recetario, { corregirKcal: true }), objetivo);
  let estado;
  if (cuadra(dif, objetivo)) estado = mal.length ? 'cuadra_kcal_mal' : 'cuadra';
  else if (mal.length && cuadra(base.corregido, objetivo)) estado = 'kcal_recetas';
  else estado = 'no_cuadra';
  return { ...base, estado };
}

const signo = (v) => (v > 0 ? `+${v}` : `${v}`.replace('-', '−'));
const pctTexto = (v) => String(Math.abs(v)).replace('.', ',');
const kc = (v) => Math.round(v).toLocaleString('es-ES');

// Una frase con lo que pasa
export function textoComprobacion(c) {
  if (!c) return '';
  const n = c.kcalMal.length;
  const recetasMal = n === 1 ? '1 receta tiene' : `${n} recetas tienen`;
  switch (c.estado) {
    case 'sin_recetas': return 'Aún no tiene recetas en su recetario.';
    case 'sin_plan': return 'No tiene un plan con calorías con el que comparar.';
    case 'incompleto': return `No hay recetas para ${c.dia.sinRecetas.map((t) => NOMBRE_TOMA[t].toLowerCase()).join(', ')}: no se puede comparar el día entero con el plan.`;
    case 'cuadra': return `Un día cualquiera con sus recetas da ${kc(c.dia.kcal)} kcal y su plan pide ${kc(c.objetivo.kcal)}.`;
    case 'cuadra_kcal_mal': return `El día cuadra con su plan, pero ${recetasMal} las calorías mal puestas.`;
    case 'kcal_recetas': return `Sus macros cuadran con el plan, pero las calorías salen un ${pctTexto(c.dif.pct)} % por ${c.dif.pct > 0 ? 'encima' : 'debajo'} porque ${recetasMal} las calorías mal puestas. Al corregirlas, cuadra.`;
    default:
      // Las kcal cuadran y algún macro no (lo que deja un factor tras un cambio de plan solo en hidratos)
      if (kcalCuadran(c.dif)) return `Las calorías cuadran con su plan (${kc(c.dia.kcal)} frente a ${kc(c.objetivo.kcal)}), pero los macros no: ${textoMacrosDia(c.dia, c.dif)}.`;
      return `Un día cualquiera con sus recetas da ${kc(c.dia.kcal)} kcal y su plan pide ${kc(c.objetivo.kcal)} (${signo(c.dif.pct).replace('.', ',')} %).`;
  }
}

// El factor que deja las kcal del día medio en las del plan, para todo el recetario o solo para algunas comidas.
//   tomas: las comidas que se reescalan (null = todas). Las demás se quedan como están.
// Devuelve null si no hay con qué comparar, o { factor, tomas, cambios: [{ id, receta_id, toma, antes, despues }], topados,
//   dia, dif, innecesario, imposible }
//   factor: por cuánto se multiplica el factor de cada receta; innecesario: ya está a menos de un 2 %; imposible: con esas
//   comidas no se llega (haría falta un factor negativo o fuera de 0,25–5)
export function reescalar({ recetario, planes = [], hoy, tomas = null }) {
  const objetivo = objetivoDelDia(planVigente(planes, hoy), true);
  if (!objetivo || !(recetario?.recetas || []).length) return null;
  const dia = diaMedio(recetario);
  if (dia.sinRecetas.length) return null;
  const elegidas = ordenarTomas(tomas || Object.keys(dia.porToma)).filter((t) => dia.porToma[t]);
  const sube = elegidas.reduce((s, t) => s + dia.porToma[t].kcal, 0);
  const resto = dia.kcal - sube;
  const exacto = sube > 0 ? (objetivo.kcal - resto) / sube : NaN;
  const base = { tomas: elegidas, cambios: [], topados: 0, dia, dif: diferencia(dia, objetivo), innecesario: false, imposible: false, factor: 1 };
  if (!Number.isFinite(exacto) || exacto <= 0) return { ...base, imposible: true };
  const factor = r2(exacto);
  if (Math.abs(factor - 1) < U.factorMinimo) return { ...base, innecesario: true };
  const factores = {};
  let topados = 0;
  const cambios = [];
  for (const t of elegidas) {
    for (const a of recetario.porToma[t] || []) {
      const libre = r2(Number(a.factor) * exacto);   // con el multiplicador sin redondear: 1,5 × 0,6667 = 1, no 1,01
      const nuevo = Math.min(5, Math.max(0.25, libre));
      if (nuevo !== libre) topados++;
      factores[a.id] = nuevo;
      if (nuevo !== Number(a.factor)) cambios.push({ id: a.id, receta_id: a.receta_id, toma: t, antes: Number(a.factor), despues: nuevo });
    }
  }
  const despues = diaMedio(recetario, { factores });
  return { ...base, factor, cambios, topados, imposible: topados > 0 && !kcalCuadran(diferencia(despues, objetivo)), dia: despues, dif: diferencia(despues, objetivo), antes: { dia, dif: base.dif } };
}

// «Proteína 152 g (−14), hidratos 259 g (+29), grasa 70 g (−6)»
export function textoMacrosDia(dia, dif) {
  const parte = (nombre, v, d) => `${nombre} ${Math.round(v)} g${d == null ? '' : ` (${d === 0 ? '=' : signo(d)})`}`;
  return [parte('proteína', dia.proteina_g, dif?.proteina), parte('hidratos', dia.carbos_g, dif?.carbos), parte('grasa', dia.grasa_g, dif?.grasa)].join(', ');
}

// Lo ya apuntado en su menú desde hoy (sin comer todavía) lleva los macros de cuando se apuntó: lo que hay que cambiar
// para que siga a su recetario de ahora. entradas: menu_comidas; recetario: el ya actualizado.
// Devuelve [{ id, cambios: { kcal, proteina_g, carbos_g, grasa_g } }]
export function menuPorActualizar(entradas = [], recetario, hoy) {
  const out = [];
  const todas = Object.values(recetario?.porToma || {}).flat();
  for (const e of entradas) {
    if (!e.receta_id || e.hecho || e.fecha < hoy) continue;
    const a = (recetario?.porToma?.[e.toma] || []).find((x) => x.receta_id === e.receta_id) || todas.find((x) => x.receta_id === e.receta_id);
    if (!a?.receta) continue;
    const m = macrosDe(a.receta, a.factor, e.raciones);
    if (MACROS.some((k) => (m[k] == null ? null : Number(m[k])) !== (e[k] == null ? null : Number(e[k])))) out.push({ id: e.id, cambios: m });
  }
  return out;
}

// El orden de la lista del equipo: primero lo que no cuadra
export function ordenRecetarios(lista = []) {
  return [...lista].sort((a, b) => (ESTADOS_RECETARIO.indexOf(a.comprobacion.estado) - ESTADOS_RECETARIO.indexOf(b.comprobacion.estado))
    || (Math.abs(b.comprobacion.dif?.pct || 0) - Math.abs(a.comprobacion.dif?.pct || 0))
    || String(a.atleta?.nombre || '').localeCompare(String(b.atleta?.nombre || ''), 'es'));
}
