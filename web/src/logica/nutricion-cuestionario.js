// Motor de nutrición (v0.252, N2): el cuestionario de nutrición por pasos, en lógica pura (las pantallas están en
// ui/atleta/EsencialNutricionMotor.jsx). Los pasos, lo que se rellena solo (su perfil, su cuestionario de entreno, su
// último peso y su cintura reciente), lo que falta en cada paso, lo que sale para el motor (planMotor) y para la base
// (nutricion_plan_motor) y qué cambia al rehacerlo. Probado en test/nutricion-cuestionario.test.mjs.
// Las preguntas de salud nuevas (exclusiones y SCOFF) solo con «salud_comida» encendido (conSalud); apagado, la pregunta
// de TCA de siempre, el embarazo de su cuestionario de entreno y lo de salud que ya contestó (si lo hay).
import { TRABAJOS, OBJETIVOS, PASOS as TRAMOS_PASOS, RITMOS_PERDER, RITMO_PERDER_IMC30, RITMO_PERDER_RECOMENDADO, SCOFF, imcDe, seguridadNutricion, REVISION_DIAS } from './nutricion-motor.js';
import { fmtKcal } from './nutricion.js';
import { diasEntre } from './fechas.js';

const num = (v) => (v == null || v === '' ? null : Number(String(v).replace(',', '.')));
const coma = (x, d = 1) => String(Math.round(x * 10 ** d) / 10 ** d).replace('.', ',');

// Los pasos (con las preguntas de salud nuevas, uno más: «Tú y la comida», el SCOFF)
export const pasosNutricion = (conSalud = false) => [
  ['tu', 'Tú'], ['salud', 'Tu salud'], ...(conSalud ? [['scoff', 'Tú y la comida']] : []),
  ['medidas', 'Tus medidas'], ['dia', 'Tu día'], ['objetivo', 'Tu objetivo'], ['comer', 'Cómo comes'], ['plan', 'Tu plan'],
];

// R12 (criterio): su experiencia, de la pregunta del cuestionario de entreno
export const EXPERIENCIAS = [['novato', 'Menos de un año'], ['intermedio', 'De 1 a 3 años'], ['avanzado', 'Más de 3 años']];
export const experienciaDe = (e) => (['ninguna', 'menos_1'].includes(e) ? 'novato' : e === '1_3' ? 'intermedio' : ['3_5', 'mas_5'].includes(e) ? 'avanzado' : null);
// R35 con «salud_comida»: lo que se le pregunta (embarazo y lactancia, solo a mujeres)
export const SALUD_NUTRICION = [
  ['embarazo', 'Estoy embarazada', 'mujer'], ['lactancia', 'Estoy dando el pecho', 'mujer'], ['renal', 'Tengo una enfermedad renal crónica', null],
  ['insulina', 'Me pongo insulina o tomo sulfonilureas para la diabetes', null], ['bariatrica', 'Me han operado de cirugía bariátrica (reducción de estómago)', null],
];
export const saludPara = (sexo) => SALUD_NUTRICION.filter(([, , s]) => !s || s === sexo);
// Lo marcado que vale para su sexo (si marcó «embarazada» y luego cambió a hombre, no cuenta)
const exclDe = (d) => (d.excl || []).filter((k) => saludPara(d.sexo).some(([x]) => x === k));
export const METODOS_GRASA = [['dexa', 'DEXA'], ['bioimpedancia', 'Bioimpedancia'], ['pliegues', 'Pliegues']];
// La cintura se rellena sola si se midió hace una semana o menos (si no, que se vuelva a medir)
export const CINTURA_RECIENTE_DIAS = 7;

// Lo que se rellena solo al abrir: su perfil (si ya lo contestó), su cuestionario de entreno (días, experiencia, TCA y lo
// de salud que ya contestó), su último peso y su cintura de esta semana
export function inicialNutricion({ perfil = null, cuestionario = null, pesoKg = null, medidas = [], hoy } = {}) {
  const c = cuestionario || {};
  const ultima = [...(medidas || [])].filter((m) => num(m.cintura_cm) > 0 && m.fecha <= hoy).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0];
  const reciente = ultima && diasEntre(ultima.fecha, hoy) <= CINTURA_RECIENTE_DIAS ? ultima : null;
  const s = c.nutricion_salud || {};
  const pf = perfil || {};
  const exp = pf.experiencia || experienciaDe(c.experiencia);
  return {
    sexo: pf.sexo || null, edad: pf.anio_nacimiento ? Number(String(hoy).slice(0, 4)) - Number(pf.anio_nacimiento) : null, altura: num(pf.altura),
    peso: num(pesoKg) > 0 ? Math.round(num(pesoKg) * 10) / 10 : null,
    cintura: reciente ? num(reciente.cintura_cm) : null, cadera: reciente && num(reciente.cadera_cm) > 0 ? num(reciente.cadera_cm) : null,
    composicionMetodo: pf.composicion_metodo || null, composicionGrasa: num(pf.composicion_grasa), masaMagraDexa: num(pf.masa_magra),
    trabajo: pf.trabajo || null, pasos: pf.pasos != null ? Number(pf.pasos) : null,
    diasEntreno: pf.dias_entreno != null ? Number(pf.dias_entreno) : c.dias_semana != null ? Number(c.dias_semana) : null,
    objetivo: pf.objetivo || null, ritmo: num(pf.ritmo_pct) ?? RITMO_PERDER_RECOMENDADO, experiencia: exp || 'intermedio',
    meta: pf.meta_peso != null ? 'peso' : pf.meta_cintura != null ? 'cintura' : null, metaPeso: num(pf.meta_peso), metaCintura: num(pf.meta_cintura),
    formaComer: pf.forma_comer || 'omnivora', tomas: pf.tomas != null ? Number(pf.tomas) : 4, cocina: pf.cocina || null, comeFuera: pf.come_fuera || null,
    bebidasSemana: pf.bebidas_semana != null ? Number(pf.bebidas_semana) : 0, pocosHidratos: !!pf.pocos_hidratos,
    alimentosSi: [...(pf.alimentos_si || [])], alimentosNo: [...(pf.alimentos_no || [])],
    tca: typeof c.tca === 'boolean' ? c.tca : null,
    // (con «salud_comida»: lo que contestó la última vez; sin contestar, null)
    excl: c.nutricion_salud ? SALUD_NUTRICION.map(([k]) => k).filter((k) => s[k] === true) : null,
    scoff: Object.fromEntries(SCOFF.map(([k]) => [k, typeof s.scoff?.[k] === 'boolean' ? s.scoff[k] : null])),
  };
}

// Su salud, como la ve el motor: con «salud_comida», lo de este cuestionario; sin él, lo que ya contestó (si lo hay). El
// embarazo, también si lo marcó en su cuestionario de entreno (como en la base).
export function saludEfectiva(d, { conSalud = false, cuestionario = null } = {}) {
  const guardada = cuestionario?.nutricion_salud || {};
  const otras = cuestionario?.otras || [];
  const s = conSalud ? { ...Object.fromEntries(exclDe(d).map((k) => [k, true])), scoff: d.scoff } : guardada;
  return {
    embarazo: !!s.embarazo || (d.sexo === 'mujer' && otras.includes('embarazo')), lactancia: !!s.lactancia, renal: !!s.renal,
    insulina: !!s.insulina, bariatrica: !!s.bariatrica, scoff: s.scoff || null,
  };
}
// La exclusión (R35) con lo que ya se sabe tras «Tu salud»: null o el motivo
export function exclusionNutricion(d, opciones = {}) {
  const seg = seguridadNutricion({ edad: d.edad, peso: d.peso, altura: d.altura, ...saludEfectiva(d, opciones) });
  return seg.automatico ? null : seg.motivo;
}
// ¿Solo mantener? (R36: antecedente de TCA o SCOFF positivo)
export const soloMantener = (d, opciones = {}) => seguridadNutricion({ tca: d.tca === true, scoff: saludEfectiva(d, opciones).scoff }).soloMantener;

// Lo que falta en cada paso (o null)
const entre = (v, a, b) => num(v) != null && num(v) >= a && num(v) <= b;
export function faltaEnPaso(clave, d, { conSalud = false, cuestionario = null } = {}) {
  if (clave === 'tu') {
    if (!['mujer', 'hombre'].includes(d.sexo)) return 'Elige tu sexo (lo usa la fórmula del gasto).';
    if (!entre(d.edad, 18, 90)) return 'Escribe tu edad (de 18 a 90 años).';
    if (!entre(d.altura, 130, 220)) return 'Escribe tu altura en centímetros (de 130 a 220).';
    if (!entre(d.peso, 35, 250)) return 'Escribe tu peso en kilos (de 35 a 250).';
  }
  if (clave === 'salud') {
    if (typeof d.tca !== 'boolean') return 'Contesta la pregunta del trastorno de la conducta alimentaria.';
    if (conSalud && !Array.isArray(d.excl)) return 'Marca lo que te pase o «Ninguna de estas».';
  }
  if (clave === 'scoff' && SCOFF.some(([k]) => typeof d.scoff?.[k] !== 'boolean')) return 'Contesta las cinco preguntas (sí o no).';
  if (clave === 'medidas') {
    if (!entre(d.cintura, 45, 200)) return 'Escribe tu cintura en centímetros (de 45 a 200).';
    if (d.cadera != null && d.cadera !== '' && !entre(d.cadera, 50, 200)) return 'La cadera, de 50 a 200 cm (o déjala vacía).';
    if (d.composicionGrasa != null && d.composicionGrasa !== '' && !entre(d.composicionGrasa, 3, 70)) return 'Tu grasa corporal, de 3 a 70 % (o déjala vacía).';
    if (d.composicionMetodo === 'dexa' && d.masaMagraDexa != null && d.masaMagraDexa !== '' && !(num(d.masaMagraDexa) > 20 && num(d.masaMagraDexa) < num(d.peso))) return 'Tu masa magra, en kilos: más de 20 y menos que tu peso (o déjala vacía).';
  }
  if (clave === 'dia') {
    if (!TRABAJOS.some(([k]) => k === d.trabajo)) return 'Elige cómo es tu trabajo.';
    if (!TRAMOS_PASOS.some(([k]) => k === d.pasos)) return 'Elige cuántos pasos das al día.';
    if (!entre(d.diasEntreno, 0, 7)) return 'Escribe cuántos días entrenas a la semana (de 0 a 7).';
  }
  if (clave === 'objetivo' && !soloMantener(d, { conSalud, cuestionario })) {
    if (!OBJETIVOS.some(([k]) => k === d.objetivo)) return 'Elige tu objetivo.';
    if (d.meta === 'peso' && !entre(d.metaPeso, 35, 250)) return 'Escribe el peso al que quieres llegar (o elige «Sin meta»).';
    if (d.meta === 'cintura' && !entre(d.metaCintura, 45, 200)) return 'Escribe la cintura a la que quieres llegar (o elige «Sin meta»).';
  }
  if (clave === 'comer') {
    if (![3, 4, 5].includes(num(d.tomas))) return 'Elige cuántas comidas haces al día.';
    if (!entre(d.bebidasSemana, 0, 70)) return 'Las bebidas con alcohol a la semana, de 0 a 70.';
  }
  return null;
}

// Los ritmos para perder (con su IMC: −1 % solo por encima de 30) y lo que es cada uno en gramos a la semana
export function ritmosPerder(d) {
  const i = imcDe(d.peso, d.altura);
  return [...RITMOS_PERDER, ...(i != null && i > 30 ? [RITMO_PERDER_IMC30] : [])]
    .map((r) => ({ r, gramos: num(d.peso) > 0 ? Math.round((num(d.peso) * Math.abs(r) * 10) / 10) * 10 : null, recomendado: r === RITMO_PERDER_RECOMENDADO }));
}

// Lo que recibe planMotor (la vista previa del plan, igual que lo que calcula la base)
export function datosParaMotor(d, opciones = {}) {
  const s = saludEfectiva(d, opciones);
  const solo = soloMantener(d, opciones);
  return {
    sexo: d.sexo, edad: num(d.edad), altura: num(d.altura), peso: num(d.peso), cintura: num(d.cintura), cadera: num(d.cadera),
    masaMagraDexa: d.composicionMetodo === 'dexa' ? num(d.masaMagraDexa) : null,
    trabajo: d.trabajo, pasos: num(d.pasos) ?? 0, diasEntreno: num(d.diasEntreno) ?? 0, objetivo: solo ? 'mantener' : d.objetivo,
    ritmo: d.objetivo === 'perder' ? num(d.ritmo) : null, experiencia: d.objetivo === 'ganar' ? d.experiencia : null,
    pocosHidratos: !!d.pocosHidratos, bebidasSemana: num(d.bebidasSemana) ?? 0, tomas: num(d.tomas) ?? 4,
    tca: d.tca === true, ...s,
  };
}
// Lo que se manda a la base (api-nutricion.planMotor). La salud, solo con «salud_comida» (si no, null: la base usa la que ya
// contestó y el embarazo de su cuestionario de entreno). basico: para una exclusión (sin lo demás)
export function paraEnviar(d, { conSalud = false, cuestionario = null, basico = false } = {}) {
  const salud = conSalud ? { ...Object.fromEntries(SALUD_NUTRICION.map(([k]) => [k, exclDe(d).includes(k)])), ...(SCOFF.every(([k]) => typeof d.scoff?.[k] === 'boolean') ? { scoff: { ...d.scoff } } : {}) } : null;
  const base = { sexo: d.sexo, edad: num(d.edad), altura: num(d.altura), peso: num(d.peso), tca: d.tca === true, salud };
  if (basico) return base;
  const solo = soloMantener(d, { conSalud, cuestionario });
  return {
    ...base, cintura: num(d.cintura), cadera: num(d.cadera), trabajo: d.trabajo, pasos: num(d.pasos) ?? 0, diasEntreno: num(d.diasEntreno) ?? 0,
    objetivo: solo ? 'mantener' : d.objetivo, ritmo: !solo && d.objetivo === 'perder' ? num(d.ritmo) : null, experiencia: !solo && d.objetivo === 'ganar' ? d.experiencia : null,
    metaPeso: !solo && d.meta === 'peso' ? num(d.metaPeso) : null, metaCintura: !solo && d.meta === 'cintura' ? num(d.metaCintura) : null,
    composicionMetodo: d.composicionMetodo || null, composicionGrasa: d.composicionMetodo ? num(d.composicionGrasa) : null,
    masaMagraDexa: d.composicionMetodo === 'dexa' ? num(d.masaMagraDexa) : null,
    bebidasSemana: num(d.bebidasSemana) ?? 0, formaComer: d.formaComer || 'omnivora', tomas: num(d.tomas) ?? 4, cocina: d.cocina || null,
    comeFuera: d.comeFuera || null, pocosHidratos: !!d.pocosHidratos, alimentosSi: d.alimentosSi || [], alimentosNo: d.alimentosNo || [],
  };
}

// Al rehacerlo: qué cambia frente a su plan de ahora (o null)
export function cambioDePlan(actual = null, nuevo = null) {
  if (!actual || !nuevo || !(Number(actual.kcal) > 0) || !(Number(nuevo.kcal) > 0)) return null;
  const dk = Math.round(Number(nuevo.kcal) - Number(actual.kcal));
  const kcal = dk === 0 ? `Tus kcal se quedan en ${fmtKcal(nuevo.kcal)} al día` : `Pasas de ${fmtKcal(actual.kcal)} a ${fmtKcal(nuevo.kcal)} kcal al día`;
  const prot = Number(actual.proteina_g) !== Number(nuevo.proteina_g) ? ` y de ${Math.round(Number(actual.proteina_g))} a ${Math.round(Number(nuevo.proteina_g))} g de proteína` : '';
  return `${kcal}${prot}. Tu plan nuevo empieza hoy y la app lo revisa cada ${REVISION_DIAS / 7} semanas.`;
}
// La meta de peso en semanas, a su ritmo (R6), en palabras (o null)
export function textoMeta(m, { meta, peso } = {}) {
  if (!m) return null;
  if (m.aviso === 'imc') return `Ojo: ${coma(num(meta))} kg queda por debajo de un IMC de 20. Mejor una meta algo más alta.`;
  if (m.aviso === 'sentido') return num(meta) === num(peso) ? 'Ya estás en esa meta.' : 'Esa meta no va en la dirección de tu objetivo.';
  return m.semanas != null ? `A tu ritmo, ${coma(num(meta))} kg queda a unas ${m.semanas} semanas.` : null;
}
