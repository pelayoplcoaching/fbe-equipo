// Nutrición: el plan del coach (por versiones), el registro de cada día, el gasto energético adaptativo y el
// ajuste para el ritmo que se busca. Funciones puras, probadas en test/logica.test.mjs.
//
// Gasto adaptativo (como MacroFactor o Carbon): en un periodo, lo que se come de media menos lo que se ha
// guardado o perdido en el cuerpo = lo que se gasta. El cambio de masa sale de la pendiente de los pesos
// (regresión lineal, que filtra el agua y la sal del día a día) y cada kg se cuenta como 7700 kcal, la
// aproximación habitual (Hall, Int J Obes 2008;32:573-576, doi:10.1038/sj.ijo.0803720: el valor real
// depende de cuánto es grasa y cuánto magro, así que es una estimación y por eso se da con su margen).
import { sumarDias, lunesDe, diasEntre, hoyISO } from './fechas.js';
import { signo } from './calculos.js';

export const KCAL_POR_KG = 7700;

export const MODOS_NUTRICION = [['macros', 'Kcal y macros'], ['kcal_proteina', 'Kcal y proteína'], ['sin_contar', 'Sin contar']];
export const FASES_NUTRICION = [['perder', 'Perder grasa'], ['mantener', 'Mantener'], ['ganar', 'Ganar músculo'], ['recomposicion', 'Recomposición']];
export const NOMBRE_FASE = Object.fromEntries(FASES_NUTRICION);
export const NOMBRE_CUMPLIDO = { 2: 'Sí', 1: 'Casi', 0: 'No' };

// Actividad para la calculadora inicial (multiplicador del metabolismo basal)
export const NIVELES_ACTIVIDAD = [
  [1.4, 'Poco activo', 'Trabajo sentado y 2–3 entrenos a la semana'],
  [1.55, 'Activo', '3–5 entrenos y algo de paseo a diario'],
  [1.7, 'Muy activo', '5–6 entrenos o trabajo de pie'],
  [1.85, 'Mucho', 'Trabajo físico y entreno casi diario'],
];

const r5 = (x) => Math.round(x / 5) * 5;
const r10 = (x) => Math.round(x / 10) * 10;
const r50 = (x) => Math.round(x / 50) * 50;
const n = (v) => (v == null || v === '' ? null : Number(v));

export const kcalDeMacros = (p, c, g) => Math.round(4 * (Number(p) || 0) + 4 * (Number(c) || 0) + 9 * (Number(g) || 0));

// El plan que vale un día: el último que empieza ese día o antes
export function planVigente(planes = [], fecha = hoyISO()) {
  let mejor = null;
  for (const p of planes) if (p.desde <= fecha && (!mejor || p.desde > mejor.desde)) mejor = p;
  return mejor;
}
// El siguiente (si el coach ya ha dejado uno preparado para más adelante)
export function planSiguiente(planes = [], fecha = hoyISO()) {
  let mejor = null;
  for (const p of planes) if (p.desde > fecha && (!mejor || p.desde < mejor.desde)) mejor = p;
  return mejor;
}

// Lo que toca un día: con día de descanso propio, si no entrena, sus kcal, hidratos y grasa
export function objetivoDelDia(plan, entrena = true) {
  if (!plan || plan.modo === 'sin_contar' || plan.kcal == null) return null;
  const desc = !entrena && plan.kcal_descanso != null;
  return {
    kcal: n(desc ? plan.kcal_descanso : plan.kcal),
    proteina: n(plan.proteina_g),
    carbos: n(desc && plan.carbos_descanso_g != null ? plan.carbos_descanso_g : plan.carbos_g),
    grasa: n(desc && plan.grasa_descanso_g != null ? plan.grasa_descanso_g : plan.grasa_g),
    fibra: n(plan.fibra_g),
    descanso: desc,
  };
}

// Media diaria del plan en una semana con `diasEntreno` días de entreno
export function kcalMediaPlan(plan, diasEntreno = 4) {
  if (!plan || plan.kcal == null) return null;
  if (plan.kcal_descanso == null) return Number(plan.kcal);
  const d = Math.max(0, Math.min(7, diasEntreno));
  return Math.round((Number(plan.kcal) * d + Number(plan.kcal_descanso) * (7 - d)) / 7);
}

// ¿Parece un día a medias? Si se marcó como incompleto, o con muy pocas kcal (menos de 800, o menos del 60 %
// de lo que tocaba: lo típico de apuntar el desayuno y la comida y no volver). No cuenta para el gasto ni para
// las medias, y no se pinta como fallado.
export function diaIncompleto(reg, obj = null) {
  if (!reg) return false;
  if (reg.completo === false) return true;
  const k = n(reg.kcal);
  if (k == null) return false;
  return k < 800 || (obj?.kcal ? k < obj.kcal * 0.6 : false);
}

// Cómo fue un día frente a lo que tocaba:
//  · con cifras: «si» con las kcal a ±10 % (como poco ±100 kcal) y la proteína al 90 % o más; «casi» a ±20 % y
//    con la proteína al 75 %; si no, «no». Lo que no se apuntó no cuenta ni a favor ni en contra, y un día a
//    medias (ver diaIncompleto) queda «incompleto», sin color de fallo.
//  · sin contar: lo que dijo el atleta (sí, casi, no).
export function evaluarDia(reg, obj) {
  if (!reg) return 'sin_dato';
  if (!obj) {
    if (reg.cumplido === 2 || reg.cumplido === '2') return 'si';
    if (reg.cumplido === 1 || reg.cumplido === '1') return 'casi';
    if (reg.cumplido === 0 || reg.cumplido === '0') return 'no';
    return reg.kcal != null || reg.proteina_g != null ? 'dato' : 'sin_dato';
  }
  const k = n(reg.kcal), p = n(reg.proteina_g);
  if (k == null && p == null) return 'sin_dato';
  const dk = k == null || !obj.kcal ? null : Math.abs(k - obj.kcal);
  const fp = p == null || !obj.proteina ? null : p / obj.proteina;
  const kSi = dk == null || dk <= Math.max(100, obj.kcal * 0.1);
  const pSi = fp == null || fp >= 0.9;
  if (kSi && pSi) return 'si';
  if (diaIncompleto(reg, obj)) return 'incompleto';
  const kCasi = dk == null || dk <= Math.max(200, obj.kcal * 0.2);
  const pCasi = fp == null || fp >= 0.75;
  return kCasi && pCasi ? 'casi' : 'no';
}

// Una semana (de lunes a domingo, hasta hoy): cada día con su objetivo y lo apuntado, y las medias.
// entrenos: fechas en que entrenó (o tiene una sesión prevista, para hoy y lo que queda)
export function semanaNutricion({ registros = [], planes = [], entrenos = new Set() }, lunes, hoy = hoyISO()) {
  const porDia = new Map(registros.map((r) => [String(r.fecha).slice(0, 10), r]));
  const dias = Array.from({ length: 7 }, (_, i) => {
    const iso = sumarDias(lunes, i);
    const plan = planVigente(planes, iso);
    const entrena = entrenos.has(iso);
    const obj = objetivoDelDia(plan, entrena);
    const reg = porDia.get(iso) || null;
    let estado = evaluarDia(reg, obj);
    // Hoy aún no ha terminado: si no está ya cumplido, va «en curso» (no cuenta como fallado)
    if (iso === hoy && reg && estado !== 'si') estado = 'en_curso';
    return { iso, plan, entrena, obj, reg, estado, futuro: iso > hoy, hoy: iso === hoy };
  });
  const pasados = dias.filter((d) => !d.futuro);
  // Para las medias, solo los días acabados y completos (hoy y los que parecen a medias falsean la media)
  const cerrados = pasados.filter((d) => d.reg && !d.hoy && !diaIncompleto(d.reg, d.obj));
  const conKcal = cerrados.filter((d) => d.reg.kcal != null);
  const conProt = cerrados.filter((d) => d.reg.proteina_g != null);
  const media = (l, f) => (l.length ? Math.round(l.reduce((t, d) => t + Number(f(d)), 0) / l.length) : null);
  const conObj = conKcal.filter((d) => d.obj?.kcal);
  return {
    lunes,
    dias,
    transcurridos: pasados.length,
    registrados: pasados.filter((d) => d.reg).length,
    incompletos: pasados.filter((d) => d.estado === 'incompleto').length,
    enObjetivo: pasados.filter((d) => d.estado === 'si').length,
    casi: pasados.filter((d) => d.estado === 'casi').length,
    mediaKcal: media(conKcal, (d) => d.reg.kcal),
    mediaProteina: media(conProt, (d) => d.reg.proteina_g),
    // Objetivo medio de los días apuntados (para comparar con la media de lo comido)
    objetivoKcal: media(conObj, (d) => d.obj.kcal),
    objetivoProteina: media(conProt.filter((d) => d.obj?.proteina), (d) => d.obj.proteina),
  };
}

// Regresión lineal: pendiente, su error típico y los residuos (para el margen del gasto)
function regresion(xs, ys) {
  const m = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / m, my = ys.reduce((a, b) => a + b, 0) / m;
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  if (!(sxx > 0)) return null;
  const pend = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx;
  const res = xs.map((x, i) => ys[i] - (my + pend * (x - mx)));
  const s2 = m > 2 ? res.reduce((a, r) => a + r * r, 0) / (m - 2) : 0;
  return { pend, error: Math.sqrt(s2 / sxx), res };
}
// Autocorrelación de los residuos de un día al siguiente (el agua y el glucógeno de un día se arrastran al
// siguiente): con ella, cada pesada cuenta menos de lo que parece
function autocorrelacion(res) {
  if (res.length < 4) return 0;
  const var0 = res.reduce((a, r) => a + r * r, 0);
  if (!(var0 > 0)) return 0;
  let c = 0;
  for (let i = 1; i < res.length; i++) c += res[i] * res[i - 1];
  return Math.max(0, Math.min(0.8, c / var0));
}

const cuantos = (k, uno, varios) => `${k} ${k === 1 ? uno : varios}`;

// Gasto energético adaptativo de los últimos `ventana` días (hasta ayer: hoy aún no está entero).
// Hace falta: al menos 10 días con las kcal apuntadas y completos (y repartidos: 4 en cada mitad), al menos 6
// pesadas que abarquen 10 días y una de la última semana. objetivoDe(fecha): las kcal que tocaban ese día
// (para descartar los que parecen a medias). Devuelve { kcal, margen, fiabilidad, ingesta, kgSemana,
// diasConKcal, descartados, pesadas, desde, hasta } o { kcal: null, falta } con lo que falta, en palabras
// («3 días más con las kcal apuntadas y 2 pesadas más»).
export function gastoAdaptativo({ registros = [], pesos = [] }, hoy = hoyISO(), { ventana = 28, objetivoDe = null } = {}) {
  const hasta = sumarDias(hoy, -1);
  const desde = sumarDias(hasta, -(ventana - 1));
  const conKcal = registros.filter((r) => r.fecha >= desde && r.fecha <= hasta && r.kcal != null);
  const buenas = conKcal.filter((r) => !diaIncompleto(r, objetivoDe ? { kcal: objetivoDe(r.fecha) } : null));
  const ingestas = buenas.map((r) => Number(r.kcal));
  const mitad = sumarDias(desde, Math.floor(ventana / 2));
  const enPrimera = buenas.filter((r) => r.fecha < mitad).length;
  const ps = pesos.filter((p) => p.fecha >= desde && p.fecha <= hoy && Number(p.kg) > 0).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const span = ps.length ? diasEntre(ps[0].fecha, ps[ps.length - 1].fecha) : 0;
  const faltan = [];
  if (ingestas.length < 10) faltan.push(`${cuantos(10 - ingestas.length, 'día', 'días')} más con las kcal apuntadas`);
  else if (enPrimera < 4 || ingestas.length - enPrimera < 4) faltan.push('días apuntados repartidos por las 4 semanas');
  if (ps.length < 6) faltan.push(`${cuantos(6 - ps.length, 'pesada', 'pesadas')} más`);
  else if (span < 10) faltan.push('pesadas repartidas en al menos 10 días');
  else if (diasEntre(ps[ps.length - 1].fecha, hoy) > 7) faltan.push('una pesada de esta semana');
  const base = { diasConKcal: ingestas.length, descartados: conKcal.length - buenas.length, pesadas: ps.length, desde, hasta };
  if (faltan.length) return { kcal: null, falta: faltan.join(' y '), ...base };
  const reg = regresion(ps.map((p) => diasEntre(ps[0].fecha, p.fecha)), ps.map((p) => Number(p.kg)));
  if (!reg) return { kcal: null, falta: 'pesadas repartidas en al menos 10 días', ...base };
  const ingesta = ingestas.reduce((a, b) => a + b, 0) / ingestas.length;
  const de = Math.sqrt(ingestas.reduce((a, x) => a + (x - ingesta) ** 2, 0) / Math.max(1, ingestas.length - 1));
  // Margen (≈ 1 error típico): el de la pendiente del peso y el de la media de lo comido, juntos. La pendiente
  // se corrige por la autocorrelación de los residuos (el peso de un día arrastra el del anterior: con pesadas
  // diarias, sin esto, el margen salía hasta 2,5 veces corto en simulación) y por las pocas pesadas.
  const rho = autocorrelacion(reg.res);
  const correccion = Math.sqrt((1 + rho) / (1 - rho)) * (1 + 1 / (ps.length - 2));
  const margen = Math.sqrt((reg.error * KCAL_POR_KG * correccion) ** 2 + (de / Math.sqrt(ingestas.length)) ** 2);
  const kcal = ingesta - reg.pend * KCAL_POR_KG;
  const completos = ingestas.length / ventana;
  const fiabilidad = margen <= 150 && completos >= 0.7 ? 'alta' : margen <= 300 ? 'media' : 'baja';
  return {
    kcal: r10(kcal), margen: r10(margen), fiabilidad,
    ingesta: Math.round(ingesta), kgSemana: Math.round(reg.pend * 7 * 100) / 100, ...base,
  };
}

// El gasto al final de cada una de las últimas `semanas` semanas (domingo a domingo), para la gráfica
export function gastoPorSemanas(datos, hoy = hoyISO(), semanas = 8, opciones = {}) {
  const out = [];
  const lunesHoy = lunesDe(hoy);
  for (let i = semanas; i >= 1; i--) {
    const domingo = sumarDias(lunesHoy, -7 * (i - 1) - 1);
    const g = gastoAdaptativo(datos, sumarDias(domingo, 1), opciones);
    if (g.kcal != null) out.push({ x: domingo, y: g.kcal, margen: g.margen });
  }
  return out;
}

// Ajuste para el ritmo del plan: kcal = gasto + ritmo × peso × 7700 / 7. Se cambian como mucho `maxCambio`
// kcal de una vez (los cambios grandes se notan en el hambre y el rendimiento, y el gasto también se mueve
// al comer menos), no se baja de `minKcal` (y ese suelo nunca da la vuelta a un ajuste: si toca bajar y ya
// está en el suelo, no se propone nada), y solo si la diferencia pasa de 100 kcal. En «macros», la diferencia
// va a los hidratos: la proteína no se toca; al bajar, la grasa solo baja (nunca sube) si los hidratos
// quedarían por debajo de 50 g, hasta 0,5 g/kg; si ni así caben 50 g de hidratos, se pide revisar el plan.
// Devuelve null si no se puede calcular (sin ritmo, sin cifras o sin gasto).
export function ajusteNutricion({ plan, gasto, pesoKg, diasEntreno = 4 }, { maxCambio = 300, minKcal = 1200 } = {}) {
  if (!plan || plan.modo === 'sin_contar' || plan.kcal == null || plan.ritmo_pct == null || !gasto?.kcal || !(pesoKg > 0)) return null;
  if (gasto.fiabilidad === 'baja') return { tipo: 'esperar', delta: 0, texto: `El gasto aún es poco fiable (±${gasto.margen} kcal): mejor esperar a tener más días apuntados y pesadas.` };
  const ritmo = Number(plan.ritmo_pct);
  const objetivo = gasto.kcal + (ritmo / 100) * pesoKg * KCAL_POR_KG / 7;
  const actual = kcalMediaPlan(plan, diasEntreno);
  const base = { objetivo: r10(objetivo), actual };
  const ideal = r50(objetivo - actual);
  const queToca = `para ${textoRitmo(ritmo)} hacen falta unas ${fmtKcal(objetivo)} kcal y el plan está en ${fmtKcal(actual)}`;
  if (Math.abs(ideal) < 100) return { tipo: 'mantener', delta: 0, ...base, texto: `Va bien: ${queToca}.` };
  let delta = Math.max(-maxCambio, Math.min(maxCambio, ideal));
  let limite = delta !== ideal ? 'cambio' : null;
  const minimo = Math.min(Number(plan.kcal), plan.kcal_descanso != null ? Number(plan.kcal_descanso) : Infinity);
  if (delta < 0 && minimo + delta < minKcal) { delta = Math.min(0, minKcal - minimo); limite = 'minimo'; }
  if (Math.abs(delta) < 50) {
    return { tipo: 'revisar', delta: 0, ...base, texto: `${queToca.replace(/^p/, 'P')}, pero el plan ya está en el mínimo que propone la app (${fmtKcal(minKcal)} kcal): mejor revisar el ritmo.` };
  }
  const nuevo = {
    modo: plan.modo, fase: plan.fase, ritmo_pct: plan.ritmo_pct, pautas: plan.pautas ?? null, fibra_g: plan.fibra_g ?? null,
    kcal: Number(plan.kcal) + delta, proteina_g: n(plan.proteina_g),
    kcal_descanso: plan.kcal_descanso != null ? Number(plan.kcal_descanso) + delta : null,
    carbos_g: null, grasa_g: null, carbos_descanso_g: null, grasa_descanso_g: null,
  };
  if (plan.modo === 'macros') {
    const p = Number(plan.proteina_g);
    const repartir = (g, kcal) => {
      let grasa = Number(g);
      let carbos = (kcal - 4 * p - 9 * grasa) / 4;
      if (carbos < 50 && delta < 0) {
        const minGrasa = Math.min(grasa, Math.max(10, Math.ceil(0.5 * pesoKg)));
        grasa = Math.min(Number(g), Math.max(minGrasa, Math.floor((kcal - 4 * p - 4 * 50) / 9)));
        carbos = (kcal - 4 * p - 9 * grasa) / 4;
      }
      if (delta < 0 && carbos < 50) return null;
      return [Math.max(0, r5(carbos)), grasa];
    };
    const e = repartir(plan.grasa_g, nuevo.kcal);
    const d = plan.kcal_descanso != null ? repartir(plan.grasa_descanso_g ?? plan.grasa_g, nuevo.kcal_descanso) : [null, null];
    if (!e || !d) {
      return { tipo: 'revisar', delta: 0, ...base, texto: `${queToca.replace(/^p/, 'P')}, pero con ${p} g de proteína y la grasa al mínimo los hidratos bajarían de 50 g: mejor revisar la proteína o el ritmo.` };
    }
    [nuevo.carbos_g, nuevo.grasa_g] = e;
    [nuevo.carbos_descanso_g, nuevo.grasa_descanso_g] = d;
    // Las kcal, las de los macros redondeados (para que cuadren con lo que verá el atleta)
    nuevo.kcal = kcalDeMacros(nuevo.proteina_g, nuevo.carbos_g, nuevo.grasa_g);
    if (nuevo.kcal_descanso != null) nuevo.kcal_descanso = kcalDeMacros(nuevo.proteina_g, nuevo.carbos_descanso_g, nuevo.grasa_descanso_g);
  }
  // El cambio real (con los macros ya redondeados), en la media de la semana
  const real = kcalMediaPlan(nuevo, diasEntreno) - actual;
  if (Math.abs(real) < 50 || Math.sign(real) !== Math.sign(delta)) return { tipo: 'mantener', delta: 0, ...base, texto: `Casi en su sitio: ${queToca}.` };
  const nota = limite === 'cambio' ? ` (de una vez, como mucho ${maxCambio})` : limite === 'minimo' ? ` (hasta el mínimo de ${fmtKcal(minKcal)} kcal)` : '';
  return {
    tipo: real < 0 ? 'bajar' : 'subir', delta: real, ...base, limitado: !!limite, limite, nuevo,
    texto: `Gasta unas ${fmtKcal(gasto.kcal)} kcal al día; ${queToca}: ${real < 0 ? 'bajar' : 'subir'} ${fmtKcal(Math.abs(real))} kcal${nota}.`,
  };
}

// «1950», «2300» (en español, las de cuatro cifras van sin punto), «12.000»
export const fmtKcal = (v) => (v == null ? '—' : Math.round(v).toLocaleString('es-ES'));
export const textoRitmo = (r) => (Number(r) === 0 ? 'mantener el peso' : `${Number(r) < 0 ? 'bajar' : 'subir'} un ${String(Math.abs(Number(r))).replace('.', ',')} % del peso a la semana`);

// Metabolismo basal de Mifflin-St Jeor (Am J Clin Nutr 1990;51:241-247, doi:10.1093/ajcn/51.2.241; validada de
// 19 a 78 años)
export function mifflin({ sexo, edad, altura, peso }) {
  if (!(peso > 0) || !(altura > 0) || !(edad > 0)) return null;
  return Math.round(10 * peso + 6.25 * altura - 5 * edad + (sexo === 'mujer' ? -161 : 5));
}

// Proteína recomendada por kg de peso: 1,6 g/kg es donde se estabiliza la ganancia de masa magra y hasta
// 2,2 g/kg cabe en el intervalo (Morton y cols., Br J Sports Med 2018;52:376-384, doi:10.1136/bjsports-2017-097608);
// en déficit, hacia arriba (Helms y cols., JISSN 2014;11:20, doi:10.1186/1550-2783-11-20, lo da por kg de masa
// magra). Con mucho peso, los g/kg se cuentan sobre un peso de referencia (el de un IMC de 25), para no
// disparar la proteína y dejar sin hidratos.
export const proteinaPorKg = (fase) => (fase === 'perder' ? 2.0 : 1.8);
export const pesoReferencia = (peso, altura) => (altura > 0 ? Math.min(peso, Math.round(25 * (altura / 100) ** 2 * 10) / 10) : peso);

// Plan de partida con la calculadora: mantenimiento = basal × actividad; kcal = mantenimiento + ritmo (como poco
// 1200); proteína y grasa por kg (de referencia) y el resto en hidratos, con al menos 50 g: si no caben, primero
// baja la grasa (hasta 0,5 g/kg), luego la proteína (hasta 1,6 g/kg) y, si aun así no caben, suben las kcal.
export function planInicial({ sexo, edad, altura, peso, actividad = 1.55, fase = 'mantener', ritmo = 0, proteinaGkg = null, grasaGkg = 0.8, modo = 'macros' }) {
  const basal = mifflin({ sexo, edad, altura, peso });
  if (basal == null) return null;
  const ref = pesoReferencia(peso, altura);
  const mantenimiento = Math.round(basal * actividad);
  const kcalBruto = mantenimiento + (Number(ritmo) / 100) * peso * KCAL_POR_KG / 7;
  let kcal = Math.max(1200, r50(kcalBruto));
  let proteina = r5((proteinaGkg ?? proteinaPorKg(fase)) * ref);
  const out = { basal, mantenimiento, modo, fase, ritmo_pct: ritmo == null || ritmo === '' ? null : Number(ritmo), pesoReferencia: ref < peso ? ref : null };
  if (modo !== 'macros') return { ...out, kcal: Math.max(kcal, r50(4 * proteina + 400)), proteina_g: proteina };
  let grasa = r5(grasaGkg * ref);
  const hidratos = () => (kcal - 4 * proteina - 9 * grasa) / 4;
  if (hidratos() < 50) grasa = Math.max(Math.ceil(0.5 * ref), Math.floor((kcal - 4 * proteina - 200) / 9));
  if (hidratos() < 50) proteina = Math.max(r5(1.6 * ref), Math.floor((kcal - 9 * grasa - 200) / 4));
  let carbos = Math.max(50, r5(hidratos()));
  kcal = kcalDeMacros(proteina, carbos, grasa);
  if (kcal < 1200) { carbos += r5((1200 - kcal) / 4) + 5; kcal = kcalDeMacros(proteina, carbos, grasa); }
  return { ...out, kcal, proteina_g: proteina, grasa_g: grasa, carbos_g: carbos };
}

// Para el panel del coach: avisos de nutrición de un atleta (o nada)
//  · registra poco: menos de 3 días en los últimos 7 (con un plan desde hace al menos una semana);
//  · se desvía del ritmo: con el plan con ritmo desde hace al menos 3 semanas, el peso de las 3 últimas va a
//    más de 0,25 % por semana de distancia del objetivo.
export function avisosNutricion({ planes = [], registros = [], ritmoReal = null }, hoy = hoyISO()) {
  const plan = planVigente(planes, hoy);
  if (!plan) return [];
  const out = [];
  const primero = [...planes].sort((a, b) => (a.desde < b.desde ? -1 : 1))[0];
  const dias7 = registros.filter((r) => r.fecha > sumarDias(hoy, -7) && r.fecha <= hoy).length;
  if (diasEntre(primero.desde, hoy) >= 7 && dias7 < 3) out.push({ tipo: 'nutricion_registro', texto: dias7 ? `Nutrición: ${cuantos(dias7, 'día apuntado', 'días apuntados')} en los últimos 7` : 'Nutrición: nada apuntado en 7 días' });
  if (plan.ritmo_pct != null && ritmoReal && diasEntre(plan.desde, hoy) >= 21 && ritmoReal.dias >= 14) {
    const dif = ritmoReal.pctSemana - Number(plan.ritmo_pct);
    if (Math.abs(dif) > 0.25) out.push({ tipo: 'nutricion_ritmo', texto: `Peso a ${signo(ritmoReal.pctSemana, 2)} %/sem (objetivo ${signo(Number(plan.ritmo_pct), 2)})` });
  }
  return out;
}
