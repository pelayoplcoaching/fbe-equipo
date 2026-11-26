// Motor de nutrición (v0.252, N1): las reglas R1-R37 del documento del proyecto «claude/nutricion-motor-reglas.md», que
// salen de las respuestas de Pelayo a las 40 preguntas (26/11/2026: todas con la recomendación, salvo la 14, en la que pidió
// un suelo de 1.500 kcal en mujeres y 1.800 en hombres, y nunca más de un 25 % por debajo del mantenimiento). Lógica pura,
// sin pantallas: el cuestionario (N2), la propuesta de menú (N3) y la revisión en la app (N4) se apoyan aquí. Lo marcado
// «(criterio)» no lo decidió Pelayo: es un detalle necesario para calcularlo, coherente con sus respuestas, que puede
// cambiar. Probado en test/nutricion-motor.test.mjs.
//
// Fuentes (con su DOI en «claude/nutricion-motor-preguntas.md»): Mifflin-St Jeor 1990 y Frankenfield 2005 (el gasto en
// reposo), Cunningham 1980 y ten Haaf 2014 (con masa magra), FAO/OMS/UNU 2004 (niveles de actividad), Woolcott 2018 (RFM),
// Helms 2014 y Garthe 2011 (ritmo al perder), Iraki 2019 (ritmo y superávit al ganar), Jensen 2014 (suelos de las guías),
// Morton 2018, Bauer 2013, Moore 2015 y Schoenfeld y Aragon 2018 (proteína), IOM 2005 (grasa 20-35 % e hidratos 130 g),
// Whittaker 2021 (grasa baja y testosterona), EFSA 2010 (fibra 25 g), Steinberg 2015 (pesarse), White 2011 (el ciclo),
// Peos 2021 y Byrne 2018 (pausas de dieta), KDOQI 2020 y Devries 2018 (riñón), Morgan 1999 (SCOFF), NICE NG246 (cintura/altura).
import { diasEntre, sumarDias } from './fechas.js';
import { mifflin, KCAL_POR_KG, kcalDeMacros, fmtKcal, gastoAdaptativo } from './nutricion.js';

// ---------- Constantes (cada una con su regla) ----------
export const SUELO_KCAL = { mujer: 1500, hombre: 1800 };          // R15 (Pelayo)
export const DEFICIT_MAX = 0.25;                                   // R15: nunca más de un 25 % por debajo del mantenimiento
export const SUPERAVIT_MAX = 0.2;                                  // R12 (criterio, por Iraki 2019: un 10-20 %)
export const RITMOS_PERDER = [-0.25, -0.5, -0.75];                 // R11, % del peso a la semana
export const RITMO_PERDER_IMC30 = -1;                              // R11: solo con IMC por encima de 30
export const RITMO_PERDER_RECOMENDADO = -0.5;
export const RITMO_GANAR = { novato: 0.5, intermedio: 0.25, avanzado: 0.1 };   // R12
export const OBJETIVOS = [['perder', 'Perder grasa'], ['mantener', 'Mantener (recomposición)'], ['ganar', 'Ganar músculo']];   // R6
export const TRABAJOS = [['sentado', 'Sentado casi todo el día', 1.4], ['de_pie', 'De pie o andando buena parte del día', 1.55], ['fisico', 'Físico: cargas, obra, campo…', 1.7]];   // R5 y R9
export const PASOS = [[0, 'Menos de 5.000', 0], [5000, 'De 5.000 a 7.499', 0.05], [7500, 'De 7.500 a 9.999', 0.1], [10000, '10.000 o más', 0.15]];   // R5 y R9
export const FACTOR_MAX = 2;                                       // R9 (criterio)
export const PROTEINA_RANGO = { mantener: [1.4, 1.6], ganar: [1.6, 2.2], perder: [1.8, 2.4] };   // R18: los de la calculadora de la web
export const PROTEINA_TOMA = 0.4;                                  // R21, g/kg por comida principal
export const GRASA_GKG = 0.8;                                      // R22
export const GRASA_PCT = [0.2, 0.35];                              // R22 (IOM)
export const HIDRATOS_MIN = 130;                                   // R23 (IOM), g al día
export const FIBRA_G = 25;                                         // R24 (EFSA)
export const KCAL_BEBIDA = 100;                                    // R25 (criterio)
export const ADHERENCIA = { ventana: 28, dias: 20, pesadasSemana: 3 };   // R26
export const REVISION_DIAS = 28;                                   // R28
export const REVISAR_EN_SIN_ADHERENCIA = 14;                       // R29
export const CAMBIO_MAX = 250;                                     // R33
export const BAJADAS_MAX = 3;                                      // R33
export const PAUSA_TRAS_SEMANAS = 12, PAUSA_SEMANAS = 2;           // R17
export const FORMAS_DE_COMER = [['omnivora', 'Como de todo'], ['vegetariana', 'Vegetariana'], ['vegana', 'Vegana'], ['sin_cerdo', 'Sin cerdo'], ['sin_pescado', 'Sin pescado']];   // R7
export const COCINA = [['poco', 'Poco: lo justo'], ['algo', 'Algo, entre semana'], ['mucho', 'Me gusta cocinar']];   // R7
export const COME_FUERA = [['no', 'No'], ['algunos', 'Algunos días'], ['casi_todos', 'Casi todos los días']];   // R7
export const ALIMENTOS_SI = [10, 15], ALIMENTOS_NO_MAX = 10;      // R7 (24a)

const num = (v) => (v == null || v === '' ? null : Number(String(v).replace(',', '.')));
const r5 = (x) => Math.round(x / 5) * 5;
const r10 = (x) => Math.round(x / 10) * 10;
const r50 = (x) => Math.round(x / 50) * 50;
const coma = (x, d = 1) => String(Math.round(x * 10 ** d) / 10 ** d).replace('.', ',');
const pct = (x) => `${coma(Math.abs(x), 2)} %`;

// ---------- Cuerpo ----------
export const imcDe = (peso, altura) => (num(peso) > 0 && num(altura) > 0 ? Math.round((num(peso) / (num(altura) / 100) ** 2) * 10) / 10 : null);
// R4: masa grasa relativa (Woolcott 2018): 64 − 20 × altura/cintura, + 12 en mujeres (en %)
export function rfm({ sexo, altura, cintura }) {
  const a = num(altura), c = num(cintura);
  if (!(a > 0) || !(c > 0) || !['hombre', 'mujer'].includes(sexo)) return null;
  return Math.round((64 - 20 * (a / c) + (sexo === 'mujer' ? 12 : 0)) * 10) / 10;
}
export const cinturaAltura = (cintura, altura) => (num(cintura) > 0 && num(altura) > 0 ? Math.round((num(cintura) / num(altura)) * 100) / 100 : null);

// ---------- R8 y R9: el gasto ----------
// R8: Mifflin-St Jeor; con masa magra medida por DEXA, Cunningham (500 + 22 × masa magra)
export function reposo({ sexo, edad, altura, peso, masaMagraDexa = null }) {
  const mm = num(masaMagraDexa);
  if (mm > 20 && mm < num(peso)) return { kcal: Math.round(500 + 22 * mm), formula: 'cunningham' };
  const k = mifflin({ sexo, edad: num(edad), altura: num(altura), peso: num(peso) });
  return k == null ? null : { kcal: k, formula: 'mifflin' };
}
const sumaPasos = (pasos) => { const p = num(pasos) ?? 0; let s = 0; for (const [desde, , suma] of PASOS) if (p >= desde) s = suma; return s; };
const sumaEntreno = (dias) => { const d = num(dias) ?? 0; return d >= 5 ? 0.15 : d >= 3 ? 0.1 : d >= 1 ? 0.05 : 0; };
// R9 (criterio): el trabajo da la base (1,40, 1,55 o 1,70) y los pasos y los días de entreno suman; como mucho 2,00
export function factorActividad({ trabajo, pasos = 0, diasEntreno = 0 }) {
  const base = TRABAJOS.find(([k]) => k === trabajo)?.[2];
  if (base == null) return null;
  const p = sumaPasos(pasos), e = sumaEntreno(diasEntreno);
  return { factor: Math.min(FACTOR_MAX, Math.round((base + p + e) * 100) / 100), base, pasos: p, entreno: e };
}
export function mantenimiento(d) {
  const rp = reposo(d), fa = factorActividad(d);
  if (!rp || !fa) return null;
  return { kcal: r10(rp.kcal * fa.factor), reposo: rp.kcal, formula: rp.formula, factor: fa.factor };
}

// ---------- R20: el peso de referencia ----------
// Con IMC de 30 o más, el peso a un IMC de 25; entre 25 y 30, también si la cintura es la mitad de la altura o más (el corte
// de NICE); si no, su peso (criterio: en la calculadora lo elige la persona, «bastante sobrepeso»)
export function pesoDeReferencia({ peso, altura, cintura = null }) {
  const p = num(peso), i = imcDe(peso, altura);
  if (!(p > 0) || i == null) return null;
  const a25 = Math.round(25 * (num(altura) / 100) ** 2 * 10) / 10;
  const ca = cinturaAltura(cintura, altura);
  if (i >= 30) return { kg: Math.min(p, a25), motivo: 'imc' };
  if (i > 25 && ca != null && ca >= 0.5) return { kg: Math.min(p, a25), motivo: 'cintura' };
  return { kg: p, motivo: null };
}

// ---------- R18 y R19: la proteína ----------
// El rango de la calculadora (con 40 años o más, la mitad alta: el mínimo pasa al centro) y, para el plan, su centro
export function proteinaDelPlan({ objetivo, edad, pesoRef }) {
  const rango = PROTEINA_RANGO[objetivo];
  const p = num(pesoRef);
  if (!rango || !(p > 0)) return null;
  const mayor = num(edad) >= 40;
  const lo = mayor ? (rango[0] + rango[1]) / 2 : rango[0], hi = rango[1];
  const gkg = Math.round(((lo + hi) / 2) * 100) / 100;
  return { g: r5(gkg * p), gkg, rango: [lo, hi], minimoG: r5(lo * p), mayor };
}

// ---------- R11 a R16: el ritmo y las kcal ----------
// El ritmo que le toca (% del peso a la semana): al perder, el que elija (−0,25, −0,5 o −0,75; −1 solo con IMC > 30),
// −0,5 si no elige; al ganar, por su experiencia (novato, intermedio o avanzado); al mantener, 0
export function ritmoDe({ objetivo, ritmo = null, experiencia = 'intermedio', imc: i = null }) {
  if (objetivo === 'mantener') return 0;
  if (objetivo === 'ganar') return RITMO_GANAR[experiencia] ?? RITMO_GANAR.intermedio;
  if (objetivo !== 'perder') return null;
  const r = num(ritmo);
  if (r === RITMO_PERDER_IMC30 && num(i) > 30) return r;
  return RITMOS_PERDER.includes(r) ? r : RITMO_PERDER_RECOMENDADO;
}
export const sueloDe = (sexo, mant) => Math.max(SUELO_KCAL[sexo] ?? SUELO_KCAL.hombre, Math.ceil(((1 - DEFICIT_MAX) * num(mant)) / 10) * 10);
// R14 a R16. limite: null (el ritmo cabe), 'suelo' (1.500 o 1.800), 'deficit' (el 25 %), 'mantenimiento' (el suelo llega
// a su mantenimiento: se queda ahí y la vía es moverse más) o 'superavit' (el 20 % al ganar)
export function kcalObjetivo({ objetivo, ritmo, peso, mant, sexo }) {
  const m = num(mant), p = num(peso), rt = num(ritmo) ?? 0;
  if (!(m > 0) || !(p > 0)) return null;
  const kcalRitmo = Math.round(m + (rt / 100) * p * KCAL_POR_KG / 7);
  if (objetivo === 'mantener' || rt === 0) return { kcal: r10(m), kcalRitmo: m, limite: null };
  if (objetivo === 'ganar') {
    const tope = Math.floor((m * (1 + SUPERAVIT_MAX)) / 10) * 10;
    return kcalRitmo > tope ? { kcal: tope, kcalRitmo, limite: 'superavit' } : { kcal: r50(kcalRitmo), kcalRitmo, limite: null };
  }
  const suelo = SUELO_KCAL[sexo] ?? SUELO_KCAL.hombre;
  const piso = sueloDe(sexo, m);
  if (piso >= m) return { kcal: r10(m), kcalRitmo, limite: 'mantenimiento', suelo };
  let kcal = r50(kcalRitmo);
  let limite = null;
  if (kcal < piso) { kcal = piso; limite = piso === suelo ? 'suelo' : 'deficit'; }
  return { kcal: Math.min(kcal, r10(m)), kcalRitmo, limite, suelo };
}

// ---------- R22, R23 y R25: los macros ----------
// La proteína se queda; la grasa, 0,8 g/kg (de referencia) entre el 20 y el 35 % de las kcal; los hidratos, el resto, con
// 130 g como poco (salvo «pocos hidratos»): si no caben, baja antes la grasa hasta el 20 %, luego la proteína hacia el
// mínimo de su rango. El alcohol que dice beber va dentro de las kcal (unas 100 por bebida, repartidas en la semana).
export function macrosDelPlan({ kcal, proteinaG, proteinaMinG = null, pesoRef, pocosHidratos = false, bebidasSemana = 0 }) {
  const K = num(kcal), pr = num(proteinaG), ref = num(pesoRef);
  if (!(K > 0) || !(pr > 0) || !(ref > 0)) return null;
  const alcohol = Math.round(((num(bebidasSemana) || 0) * KCAL_BEBIDA) / 7);
  const gMin = Math.ceil((GRASA_PCT[0] * K) / 9 / 5) * 5, gMax = Math.floor((GRASA_PCT[1] * K) / 9 / 5) * 5;
  let p = pr;
  let g = Math.min(gMax, Math.max(gMin, r5(GRASA_GKG * ref)));
  const ajustes = [];
  const hidratos = () => (K - alcohol - 4 * p - 9 * g) / 4;
  if (!pocosHidratos && hidratos() < HIDRATOS_MIN) {
    const g2 = Math.max(gMin, Math.floor((K - alcohol - 4 * p - 4 * HIDRATOS_MIN) / 9 / 5) * 5);
    if (g2 < g) { g = g2; ajustes.push('grasa'); }
    if (hidratos() < HIDRATOS_MIN && proteinaMinG != null) {
      const p2 = Math.max(num(proteinaMinG), Math.floor((K - alcohol - 9 * g - 4 * HIDRATOS_MIN) / 4 / 5) * 5);
      if (p2 < p) { p = p2; ajustes.push('proteina'); }
    }
    if (hidratos() < HIDRATOS_MIN) ajustes.push('hidratos');
  }
  let c = Math.max(0, Math.round(hidratos()));
  // que las kcal de los macros (más el alcohol) no se queden por debajo de las del plan por el redondeo
  while (kcalDeMacros(p, c, g) + alcohol < K) c++;
  return { kcal: kcalDeMacros(p, c, g) + alcohol, proteina_g: p, grasa_g: g, carbos_g: c, alcohol_kcal: alcohol, ajustes };
}

// ---------- R35 y R36: la seguridad ----------
// SCOFF (Morgan 1999): cinco preguntas de sí o no; con 2 o más «sí», sospechoso. Textos de salud: pendientes del visto
// bueno de Pelayo (no salen en ninguna pantalla hasta la N2, y entonces con su OK).
export const SCOFF = [
  ['vomito', '¿Te provocas el vómito porque te sientes demasiado lleno o llena?'],
  ['control', '¿Te preocupa haber perdido el control sobre cuánto comes?'],
  ['perdida', '¿Has perdido más de 6 kg en los últimos 3 meses?'],
  ['gordura', '¿Te ves con sobrepeso aunque los demás te digan que estás demasiado delgado o delgada?'],
  ['domina', '¿Dirías que la comida domina tu vida?'],
];
export const scoffPositivo = (resp = {}) => SCOFF.filter(([k]) => resp?.[k] === true).length >= 2;
// Sin plan automático (R35): devuelve el motivo o null. Y solo mantener (R36): antecedente de TCA o SCOFF positivo.
export const EXCLUSIONES = [
  ['menor', 'Eres menor de 18 años.'],
  ['embarazo', 'Estás embarazada.'],
  ['lactancia', 'Estás dando el pecho.'],
  ['imc_bajo', 'Tu IMC está por debajo de 18,5.'],
  ['renal', 'Tienes una enfermedad renal crónica.'],
  ['insulina', 'Te pones insulina o tomas sulfonilureas para la diabetes.'],
  ['bariatrica', 'Te han operado de cirugía bariátrica.'],
];
export function seguridadNutricion({ edad, embarazo = false, lactancia = false, peso = null, altura = null, renal = false, insulina = false, sulfonilureas = false, bariatrica = false, tca = false, scoff = null } = {}) {
  const i = imcDe(peso, altura);
  const motivo = num(edad) != null && num(edad) < 18 ? 'menor' : embarazo ? 'embarazo' : lactancia ? 'lactancia' : i != null && i < 18.5 ? 'imc_bajo'
    : renal ? 'renal' : insulina || sulfonilureas ? 'insulina' : bariatrica ? 'bariatrica' : null;
  const soloMantener = !!tca || scoffPositivo(scoff || {});
  return { automatico: !motivo, motivo, soloMantener, sinPesarse: soloMantener };
}

// ---------- R6: la meta ----------
// Cuántas semanas son a su ritmo y si la meta no es realista (por debajo de un IMC de 20)
export function metaPeso({ peso, meta, altura, ritmo }) {
  const p = num(peso), m = num(meta), r = num(ritmo);
  if (!(p > 0) || !(m > 0) || !r) return null;
  const imcMeta = imcDe(m, altura);
  const semanas = (m < p && r < 0) || (m > p && r > 0) ? Math.ceil(Math.log(m / p) / Math.log(1 + r / 100)) : null;
  return { semanas, aviso: imcMeta != null && imcMeta < 20 ? 'imc' : semanas == null ? 'sentido' : null, imcMeta };
}

// ---------- El plan de partida (R3 a R25) ----------
// d: { sexo, edad, altura, peso, cintura, cadera?, masaMagraDexa?, trabajo, pasos, diasEntreno, objetivo, ritmo?,
//      experiencia?, pocosHidratos?, bebidasSemana?, tomas?, + lo de seguridadNutricion }
export function datosMotorValidos(d = {}) {
  if (!['hombre', 'mujer'].includes(d.sexo)) return 'Elige tu sexo (lo usa la fórmula del gasto).';
  if (!(num(d.edad) >= 18 && num(d.edad) <= 90)) return 'Escribe tu edad (de 18 a 90 años).';
  if (!(num(d.altura) >= 130 && num(d.altura) <= 220)) return 'Escribe tu altura en centímetros (de 130 a 220).';
  if (!(num(d.peso) >= 35 && num(d.peso) <= 250)) return 'Escribe tu peso en kilos (de 35 a 250).';
  if (!(num(d.cintura) >= 45 && num(d.cintura) <= 200)) return 'Escribe tu cintura en centímetros (de 45 a 200).';
  if (!TRABAJOS.some(([k]) => k === d.trabajo)) return 'Elige cómo es tu trabajo.';
  if (!OBJETIVOS.some(([k]) => k === d.objetivo)) return 'Elige tu objetivo.';
  return null;
}
export function planMotor(d = {}) {
  if (datosMotorValidos(d)) return null;
  const seg = seguridadNutricion(d);
  if (!seg.automatico) return { automatico: false, motivo: seg.motivo, texto: EXCLUSIONES.find(([k]) => k === seg.motivo)?.[1] || '' };
  const objetivo = seg.soloMantener ? 'mantener' : d.objetivo;
  const mt = mantenimiento(d);
  const ref = pesoDeReferencia(d);
  const i = imcDe(d.peso, d.altura);
  const ritmo = ritmoDe({ objetivo, ritmo: d.ritmo, experiencia: d.experiencia, imc: i });
  const ko = kcalObjetivo({ objetivo, ritmo, peso: d.peso, mant: mt.kcal, sexo: d.sexo });
  const pr = proteinaDelPlan({ objetivo, edad: d.edad, pesoRef: ref.kg });
  const mc = macrosDelPlan({ kcal: ko.kcal, proteinaG: pr.g, proteinaMinG: pr.minimoG, pesoRef: ref.kg, pocosHidratos: !!d.pocosHidratos, bebidasSemana: d.bebidasSemana });
  const tomas = [3, 4, 5].includes(num(d.tomas)) ? num(d.tomas) : 4;
  const plan = {
    automatico: true, soloMantener: seg.soloMantener, sinPesarse: seg.sinPesarse, objetivo, ritmo_pct: ritmo,
    mantenimiento: mt.kcal, reposo: mt.reposo, formula: mt.formula, factor: mt.factor, limite: ko.limite,
    pesoReferencia: ref.kg < num(d.peso) ? ref.kg : null, motivoReferencia: ref.motivo, rfm: rfm(d),
    kcal: mc.kcal, proteina_g: mc.proteina_g, grasa_g: mc.grasa_g, carbos_g: mc.carbos_g, alcohol_kcal: mc.alcohol_kcal, ajustes: mc.ajustes,
    fibra_g: FIBRA_G, tomas, proteinaToma_g: Math.max(r5(PROTEINA_TOMA * ref.kg), r5(mc.proteina_g / tomas)),
  };
  return { ...plan, porque: porqueDelPlan(plan, d, pr) };
}

// Su porqué, en palabras (para la pantalla del plan; textos de la N2, pendientes del visto bueno de Pelayo)
export function porqueDelPlan(plan, d = {}, pr = null) {
  const out = [];
  out.push(`Gastas unas ${fmtKcal(plan.mantenimiento)} kcal al día: tu gasto en reposo (${fmtKcal(plan.reposo)}, ${plan.formula === 'cunningham' ? 'con tu masa magra' : 'con tu edad, tu altura y tu peso'}) por lo que te mueves (×${coma(plan.factor, 2)}).`);
  if (plan.soloMantener) out.push('Tu plan es para mantener tu peso, sin déficit y sin pedirte que te peses.');
  else if (plan.objetivo === 'perder') {
    if (plan.limite === 'mantenimiento') out.push('Con tu gasto, comer menos no es buena idea: tu plan se queda en tu mantenimiento y, para perder, la vía es moverte más (más pasos al día).');
    else out.push(`Para bajar un ${pct(plan.ritmo_pct)} de tu peso a la semana, unas ${fmtKcal(plan.kcal)} kcal${plan.limite === 'suelo' ? ` (el mínimo para ${d.sexo === 'mujer' ? 'mujeres' : 'hombres'}: no bajamos de ahí)` : plan.limite === 'deficit' ? ' (como mucho un 25 % por debajo de lo que gastas)' : ''}.`);
  } else if (plan.objetivo === 'ganar') out.push(`Para subir un ${pct(plan.ritmo_pct)} de tu peso a la semana, unas ${fmtKcal(plan.kcal)} kcal${plan.limite === 'superavit' ? ' (como mucho un 20 % por encima de lo que gastas)' : ''}.`);
  else out.push(`Para mantener tu peso mientras entrenas, unas ${fmtKcal(plan.kcal)} kcal.`);
  if (pr) out.push(`Proteína: ${plan.proteina_g} g (${coma(pr.gkg, 2)} g por kilo${plan.pesoReferencia ? ` de tu peso de referencia, ${coma(plan.pesoReferencia)} kg` : ''}${pr.mayor ? '; con 40 años o más, la parte alta' : ''}); al menos ${plan.proteinaToma_g} g en cada comida principal.`);
  out.push(`Grasa: ${plan.grasa_g} g. Hidratos: ${plan.carbos_g} g, el resto.${plan.alcohol_kcal ? ` Tus bebidas con alcohol cuentan: unas ${plan.alcohol_kcal} kcal al día de media.` : ''}`);
  return out;
}

// ---------- R26 a R28: el seguimiento ----------
// registros: [{ fecha, kcal?, cumplido?: 2 sí · 1 casi · 0 no }]; pesos: [{ fecha, kg }]; hasta: el último día que cuenta
export function adherencia({ registros = [], pesos = [] }, hasta, { ventana = ADHERENCIA.ventana } = {}) {
  const desde = sumarDias(hasta, -(ventana - 1));
  const dentro = (f) => f >= desde && f <= hasta;
  const dias = new Set(registros.filter((r) => dentro(r.fecha) && (Number(r.cumplido) === 2 || Number(r.cumplido) === 1)).map((r) => r.fecha)).size;
  const ps = pesos.filter((p) => dentro(p.fecha) && num(p.kg) > 0);
  const semanas = [];
  for (let i = 0; i < Math.floor(ventana / 7); i++) {
    const a = sumarDias(desde, i * 7), b = sumarDias(desde, i * 7 + 6);
    semanas.push(new Set(ps.filter((p) => p.fecha >= a && p.fecha <= b).map((p) => p.fecha)).size);
  }
  const buena = dias >= ADHERENCIA.dias && semanas.every((n) => n >= ADHERENCIA.pesadasSemana);
  return { dias, pesadasSemana: semanas, buena, desde, hasta };
}
// La pendiente de sus pesadas (regresión lineal), en % de su peso medio a la semana; null con menos de 6 o en menos de 10 días
export function ritmoReal(pesos = [], desde, hasta) {
  const ps = pesos.filter((p) => p.fecha >= desde && p.fecha <= hasta && num(p.kg) > 0).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  if (ps.length < 6 || diasEntre(ps[0].fecha, ps[ps.length - 1].fecha) < 10) return null;
  const xs = ps.map((p) => diasEntre(ps[0].fecha, p.fecha)), ys = ps.map((p) => num(p.kg));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  if (!(sxx > 0)) return null;
  const pend = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx;
  return Math.round(((pend * 7) / my) * 100 * 100) / 100;
}
// La cintura de hoy frente a la de hace 4 semanas (la medida más cercana a ese día, de 3 semanas atrás a 5): cm, null sin datos
export function cambioCintura(cinturas = [], hasta) {
  const cs = cinturas.filter((c) => num(c.cm) > 0 && c.fecha <= hasta).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  if (cs.length < 2) return null;
  const ultima = cs[cs.length - 1];
  if (diasEntre(ultima.fecha, hasta) > 7) return null;
  const objetivo = sumarDias(ultima.fecha, -28);
  const antes = cs.filter((c) => c.fecha <= sumarDias(ultima.fecha, -21) && c.fecha >= sumarDias(ultima.fecha, -35))
    .sort((a, b) => Math.abs(diasEntre(a.fecha, objetivo)) - Math.abs(diasEntre(b.fecha, objetivo)))[0];
  return antes ? Math.round((num(ultima.cm) - num(antes.cm)) * 10) / 10 : null;
}
// R10: el gasto real. Con al menos 10 días apuntados, el de la app (gastoAdaptativo); si no, con buena adherencia, las kcal
// del plan (lo que se come en los días «Sí» y «Casi») menos lo que cambia el peso (criterio)
export function gastoReal({ registros = [], pesos = [], plan }, hoy) {
  const g = gastoAdaptativo({ registros, pesos }, hoy);
  if (g.kcal != null) return { kcal: g.kcal, de: 'apuntado' };
  const hasta = sumarDias(hoy, -1);
  const ad = adherencia({ registros, pesos }, hasta);
  const rr = ritmoReal(pesos, ad.desde, hasta);
  const pesoMedio = (() => { const ps = pesos.filter((p) => p.fecha >= ad.desde && p.fecha <= hasta && num(p.kg) > 0); return ps.length ? ps.reduce((a, p) => a + num(p.kg), 0) / ps.length : null; })();
  if (!ad.buena || rr == null || !(num(plan?.kcal) > 0) || !pesoMedio) return { kcal: null, de: null };
  return { kcal: r10(num(plan.kcal) - ((rr / 100) * pesoMedio * KCAL_POR_KG) / 7), de: 'plan' };
}

// ---------- R28 a R33: la revisión de cada 4 semanas ----------
// e: { plan: { kcal, proteina_g, desde, objetivo, ritmo_pct, mantenimiento? }, sexo, pesoRef, mant (su gasto: el real si lo hay),
//      registros, pesos, cinturas, fuerzaCae (sus marcas caen 3 semanas seguidas), bajadasSeguidas, pocosHidratos?,
//      bebidasSemana?, ultima? (su última revisión: { fecha, tipo }), hoy }
// Devuelve { tipo, delta, nuevo?, porque, ... }. tipo: 'esperar' (aún no toca), 'simplificar' (sin buena adherencia: no se
// tocan las kcal), 'bien', 'recomposicion', 'baja', 'sube', 'suelo' (tocaría bajar y ya está en su suelo), 'profesional'
// (tres bajadas seguidas sin avanzar), 'datos' (le faltan pesadas para calcular su ritmo)
const delta5a10 = (kcal, lejos) => Math.min(200, Math.max(100, r10((lejos ? 0.1 : 0.05) * kcal)));
// (v0.253, 106) El día de la revisión siguiente, como la base: 28 días desde el último cambio o la última revisión; 14 si
// la última, ya con este plan, dijo «simplificar» o «faltan datos» (R29). ultima: { fecha, tipo } de su última revisión
export function proximaRevision(plan, ultima = null) {
  if (!plan?.desde) return null;
  const f = ultima?.fecha || null;
  const corta = f && f >= plan.desde && (ultima.tipo === 'simplificar' || ultima.tipo === 'datos');
  return sumarDias(f && f > plan.desde ? f : plan.desde, corta ? REVISAR_EN_SIN_ADHERENCIA : REVISION_DIAS);
}
export function revisionNutricion(e) {
  const { plan, sexo, hoy } = e;
  const desde = plan?.desde;
  if (!plan || !(num(plan.kcal) > 0) || !desde) return null;
  // (e.ultima: su última revisión, si la hay; sin ella, 28 días desde el plan)
  const toca = proximaRevision(plan, e.ultima);
  if (hoy < toca) return { tipo: 'esperar', dias: diasEntre(hoy, toca), delta: 0, toca };
  const hasta = sumarDias(hoy, -1);
  const ad = adherencia(e, hasta);
  if (!ad.buena) return { tipo: 'simplificar', delta: 0, revisarEn: REVISAR_EN_SIN_ADHERENCIA, adherencia: ad,
    porque: `Estas cuatro semanas has seguido el plan ${ad.dias} días de 28 (hacen falta 20) o te has pesado menos de 3 veces alguna semana: no tocamos tus kcal. Mejor hacerlo más fácil de seguir (otras recetas, menos tomas o cómo comer fuera) y lo volvemos a mirar en 2 semanas.` };
  const real = ritmoReal(e.pesos, ad.desde, hasta);
  if (real == null) return { tipo: 'datos', delta: 0, porque: 'Faltan pesadas repartidas para saber a qué ritmo vas.' };
  const previsto = num(plan.ritmo_pct) ?? 0;
  const cintura = cambioCintura(e.cinturas || [], hasta);
  const kcal = num(plan.kcal);
  const base = { ritmoReal: real, previsto, cintura, adherencia: ad };
  // (R30: la proteína no se toca nunca en una revisión, aunque los hidratos queden por debajo de 130 g)
  const nuevoCon = (k) => macrosDelPlan({ kcal: k, proteinaG: plan.proteina_g, proteinaMinG: null, pesoRef: e.pesoRef, pocosHidratos: e.pocosHidratos, bebidasSemana: e.bebidasSemana });
  const sube = (d, porque) => { const k = kcal + Math.min(CAMBIO_MAX, d); return { ...base, tipo: 'sube', delta: k - kcal, nuevo: nuevoCon(k), porque }; };
  const perdiendo = plan.objetivo === 'perder' || (plan.objetivo == null && previsto < 0);
  const baja = (d, porque) => {
    if (perdiendo && (num(e.bajadasSeguidas) || 0) >= BAJADAS_MAX) return { ...base, tipo: 'profesional', delta: 0, porque: 'Llevas tres bajadas seguidas sin avanzar: otra bajada ya no ayuda. Conviene que lo mire un profesional (tu médico o una Puesta a punto).' };
    const piso = sueloDe(sexo, num(e.mant) || num(plan.mantenimiento) || kcal);
    const k = Math.max(piso, kcal - Math.min(CAMBIO_MAX, d));
    if (k >= kcal) return { ...base, tipo: 'suelo', delta: 0, porque: 'Ya estás en tu mínimo de kcal: no bajamos más. Para seguir avanzando, la vía es moverte más (más pasos al día).' };
    return { ...base, tipo: 'baja', delta: k - kcal, nuevo: nuevoCon(k), porque };
  };
  const txt = `${real < 0 ? 'bajas' : 'subes'} un ${pct(real)} a la semana`;
  if (perdiendo) {
    if (real <= -1 || real <= 2 * previsto) return sube(delta5a10(kcal, true), `Vas muy deprisa (${txt}): perder tan rápido cuesta músculo. Subimos un poco.`);
    if (e.fuerzaCae) return real <= previsto ? sube(100, `Tus marcas caen desde hace tres semanas y vas a buen ritmo (${txt}): subimos un poco para que no pierdas fuerza.`)
      : { ...base, tipo: 'bien', delta: 0, porque: 'Tus marcas caen desde hace tres semanas: no bajamos más tus kcal.' };
    if (real > previsto / 2) {
      if (cintura != null && cintura <= -1) return { ...base, tipo: 'recomposicion', delta: 0, porque: `Tu peso apenas se mueve (${txt}), pero tu cintura ha bajado ${coma(Math.abs(cintura))} cm: estás perdiendo grasa y ganando músculo. No tocamos nada.` };
      return baja(delta5a10(kcal, real > previsto / 4), `Has seguido el plan y vas más despacio de lo previsto (${txt}; buscábamos un ${pct(previsto)}) y tu cintura no ha bajado: bajamos un poco, de hidratos y grasa (la proteína no se toca).`);
    }
    return { ...base, tipo: 'bien', delta: 0, porque: `Vas a buen ritmo (${txt}). Seguimos igual.` };
  }
  if (plan.objetivo === 'ganar' || (plan.objetivo == null && previsto > 0)) {
    const d = Math.min(150, Math.max(100, r10(0.05 * kcal)));
    if (real > 2 * previsto || (cintura != null && cintura > 2)) return baja(d, `Subes más deprisa de lo previsto (${txt}${cintura != null && cintura > 2 ? `; tu cintura ha crecido ${coma(cintura)} cm` : ''}): bajamos un poco para ganar menos grasa.`);
    if (real < previsto / 2) return sube(d, `Has seguido el plan y subes menos de lo previsto (${txt}; buscábamos un ${pct(previsto)}): subimos un poco.`);
    return { ...base, tipo: 'bien', delta: 0, porque: `Vas a buen ritmo (${txt}). Seguimos igual.` };
  }
  // Mantener (criterio): si se aleja más de un 0,25 % a la semana, ±100 kcal hacia su peso
  if (real > 0.25 && !(cintura != null && cintura <= -1)) return baja(100, `Querías mantener y ${txt}: bajamos un poco.`);
  if (real < -0.25) return sube(100, `Querías mantener y ${txt}: subimos un poco.`);
  return { ...base, tipo: 'bien', delta: 0, porque: 'Tu peso se mantiene. Seguimos igual.' };
}

// ---------- R17: la pausa de dieta ----------
// planes: su historial [{ desde, objetivo|fase, ritmo_pct }]. ¿Lleva 12 semanas seguidas en déficit? Devuelve las semanas.
export function semanasEnDeficit(planes = [], hoy) {
  const ps = [...planes].filter((p) => p.desde && p.desde <= hoy).sort((a, b) => (a.desde < b.desde ? 1 : -1));
  let inicio = null;
  for (const p of ps) { if (num(p.ritmo_pct) < 0 || p.fase === 'perder' || p.objetivo === 'perder') inicio = p.desde; else break; }
  return inicio ? Math.floor(diasEntre(inicio, hoy) / 7) : 0;
}
export const tocaPausa = (planes, hoy) => semanasEnDeficit(planes, hoy) >= PAUSA_TRAS_SEMANAS;
