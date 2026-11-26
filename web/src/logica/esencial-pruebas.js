// (v0.255) «Tus pruebas» de FBE Esencial: la silla en 30 segundos, 10 segundos sobre una pierna, cintura y altura, la
// prensión (con dinamómetro) y, desde los 65, el SPPB. Decisiones de Pelayo del 26/11/2026 (preguntas 5b a 9a y 24a de
// «claude/esencial-herramientas-integracion.md»; plan en «claude/esencial-tus-pruebas-plan.md»). Los cortes y los textos
// son los de las herramientas de la web (fbe-web: test-silla, equilibrio, cintura-altura, prension y test-sppb), pasados a
// tú: nada de salud nuevo. Fuera de las edades de referencia, solo frente a su resultado anterior; un resultado bajo dice
// «coméntalo con tu médico» y no cambia el plan. Lógica pura (la app, la demo y las pruebas).

export const PRUEBAS = ['silla', 'equilibrio', 'cintura', 'prension', 'sppb'];
export const NOMBRE_PRUEBA = {
  silla: 'Levantarte de la silla en 30 segundos', equilibrio: '10 segundos sobre una pierna', cintura: 'Cintura y altura',
  prension: 'Fuerza de prensión', sppb: 'SPPB: equilibrio, marcha y silla',
};
// En el informe para su médico: el nombre de cada prueba, sin el tú, con su referencia
export const NOMBRE_INFORME = {
  silla: 'Levantarse de la silla en 30 segundos (Rikli y Jones)', equilibrio: '10 segundos sobre una pierna (Araujo 2022)', cintura: 'Índice cintura/altura (NICE)',
  prension: 'Fuerza de prensión con dinamómetro (EWGSOP2)', sppb: 'SPPB (Guralnik)',
};
export const NOMBRE_CORTO = { silla: 'Silla', equilibrio: 'Equilibrio', cintura: 'Cintura/altura', prension: 'Prensión', sppb: 'SPPB' };
export const ICONO_PRUEBA = { silla: 'reloj', equilibrio: 'diana', cintura: 'regla', prension: 'agarre', sppb: 'pasos' };
// Cómo se hace cada una y su aviso: los de las herramientas de la web, tal cual (el SPPB de la web habla de «tus padres»:
// aquí, de tú)
export const COMO_PRUEBA = {
  silla: ['Una silla firme sin brazos, de unos 43 cm de alto, apoyada contra la pared.', 'Sentado en el centro, la espalda recta, los pies apoyados en el suelo y los brazos cruzados sobre el pecho.',
    'Al «ya», levántate del todo y vuelve a sentarte, tantas veces como puedas en 30 segundos.', 'Cuenta cada vez que te pones de pie del todo. Si al acabar el tiempo ya has subido más de la mitad, cuenta.',
    'Si hacen falta los brazos para levantarse, se para: el resultado es 0.'],
  equilibrio: ['De pie, apoya el empeine del pie libre en la parte de atrás de la otra pierna.', 'Brazos pegados al cuerpo y la mirada al frente.',
    'Aguanta 10 segundos sin mover el pie de apoyo ni soltar el otro.', 'Tienes hasta tres intentos, con la pierna que quieras.'],
  cintura: ['Busca la parte de abajo de las costillas y la parte de arriba del hueso de la cadera. Rodea la cintura con la cinta justo a medio camino entre los dos puntos y mide después de soltar el aire con normalidad.'],
  prension: ['Con un dinamómetro de mano. Siéntate en una silla con brazos, apoya los antebrazos, con el codo doblado a unos 90 grados y la muñeca recta. Aprieta lo más fuerte que puedas durante unos segundos. Haz tres intentos con cada mano y quédate con el mejor.'],
};
export const AVISO_PRUEBA = {
  silla: 'Mejor con alguien al lado. Si aparece mareo, dolor en el pecho o falta de aire, para. No es para quien no pueda levantarse sin ayuda.',
  equilibrio: 'Hazlo cerca de una pared o de una silla firme, y mejor con alguien al lado. Si te mareas o tienes una lesión reciente, no lo hagas.',
  sppb: 'Hazlo con alguien al lado y una silla firme sin brazos apoyada en la pared. Si aparece mareo, dolor en el pecho o falta de aire, para. No es para quien no pueda estar de pie sin ayuda.',
};
// Las tres partes del SPPB (de la web, de tú)
export const SPPB_PARTES = {
  equilibrio: ['Equilibrio', 'De pie, sin apoyarte, 10 segundos en cada postura'],
  posturas: [['lado', 'Pies juntos, uno al lado del otro'], ['semi', 'Semitándem: el talón de un pie junto al dedo gordo del otro'], ['tandem', 'Tándem: un pie justo delante del otro, talón con punta']],
  marcha: ['Marcha de 4 metros', 'A tu paso normal. Dos intentos; cuenta el más rápido'],
  silla: ['Levantarte de la silla', 'Brazos cruzados sobre el pecho'],
};
// De dónde salen los números (las de fuentes.json de la web para cada herramienta)
export const FUENTES_PRUEBA = {
  silla: ['Rikli RE, Jones CJ. Functional fitness normative scores for community-residing older adults, ages 60-94. J Aging Phys Act. 1999;7(2):162-81.',
    'Rikli RE, Jones CJ. Development and validation of criterion-referenced clinically relevant fitness standards for maintaining physical independence in later years. Gerontologist. 2013;53(2):255-67.',
    'Centers for Disease Control and Prevention (CDC). STEADI. Assessment: 30-Second Chair Stand. Programa STEADI; 2017.'],
  equilibrio: ['Araujo CG, de Souza e Silva CG, Laukkanen JA y cols. Successful 10-second one-legged stance performance predicts survival in middle-aged and older individuals. Br J Sports Med. 2022;56(17):975-980.'],
  cintura: ['National Institute for Health and Care Excellence (NICE). Overweight, obesity and central adiposity: identifying, assessing and managing (NG246). Guía NICE NG246; 2025.'],
  prension: ['Cruz-Jentoft AJ, Bahat G, Bauer J y cols. Sarcopenia: revised European consensus on definition and diagnosis. Age Ageing. 2019;48(1):16-31.',
    'Roberts HC, Denison HJ, Martin HJ y cols. A review of the measurement of grip strength in clinical and epidemiological studies: towards a standardised approach. Age Ageing. 2011;40(4):423-9.'],
  sppb: ['Guralnik JM, Simonsick EM, Ferrucci L y cols. A short physical performance battery assessing lower extremity function: association with self-reported disability and prediction of mortality and nursing home admission. J Gerontol. 1994;49(2):M85-94.',
    'Guralnik JM, Ferrucci L, Pieper CF y cols. Lower extremity function and subsequent disability: consistency across studies, predictive models, and value of gait speed alone compared with the short physical performance battery. J Gerontol A Biol Sci Med Sci. 2000;55(4):M221-31.',
    'Cruz-Jentoft AJ, Bahat G, Bauer J y cols. Sarcopenia: revised European consensus on definition and diagnosis. Age Ageing. 2019;48(1):16-31.'],
};
export const CADA_DIAS = 84;            // cada 12 semanas, con «Tu trimestre»
export const EDAD_SPPB = 65;            // el SPPB, desde los 65 (pregunta 24a)
const sexoDe = (s) => (s === 'mujer' || s === 'm' ? 'mujer' : s === 'hombre' || s === 'h' ? 'hombre' : null);
const coma = (n, dec = 0) => (Number.isFinite(n) ? n.toFixed(dec).replace('.', ',') : '');
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
// «5 de abril de 2027» (en el informe, con el año)
export const fechaInforme = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(String(iso || '')) ? `${Number(String(iso).slice(8, 10))} de ${MESES[Number(String(iso).slice(5, 7)) - 1]} de ${String(iso).slice(0, 4)}` : '');

// ---------- La silla en 30 segundos: rangos normales de Rikli y Jones 1999 (el 50 % central) y umbral de autonomía de
// Rikli y Jones 2013, por sexo y por grupos de 5 años de 60 a 94: [desde, mínimo del rango, máximo del rango, umbral] ----------
export const NORMAS_SILLA = {
  mujer: [[60, 12, 17, 15], [65, 11, 16, 15], [70, 10, 15, 14], [75, 10, 15, 13], [80, 9, 14, 12], [85, 8, 13, 11], [90, 4, 11, 9]],
  hombre: [[60, 14, 19, 17], [65, 12, 18, 16], [70, 12, 17, 15], [75, 11, 17, 14], [80, 10, 15, 13], [85, 8, 14, 11], [90, 7, 12, 9]],
};
// { zona: 'alto' | 'medio' | 'bajo' | null (sin referencia), titulo, texto, a, b, u, grupo }
export function resultadoSilla({ veces, edad, sexo }) {
  const n = Number(veces), e = Number(edad), s = sexoDe(sexo);
  if (!Number.isInteger(n) || n < 0 || n > 60) return null;
  if (!s || !Number.isFinite(e) || e < 60) {
    return { zona: null, titulo: 'Los valores de referencia de esta prueba son para 60 a 94 años.',
      texto: 'Para menores de 60 no hay rangos comparables de este mismo estudio. Te sirve para seguir tu propia evolución: repítela cada 12 semanas y compárate contigo.' };
  }
  const filas = NORMAS_SILLA[s];
  let g = filas[0];
  for (const f of filas) if (e >= f[0]) g = f;
  const [desde, a, b, u] = g;
  const grupo = `${s === 'mujer' ? 'mujeres' : 'hombres'} de ${e > 94 ? '90 a 94' : `${desde} a ${desde + 4}`} años`;
  const extra = e > 94 ? ' (con más de 94 años se usa el grupo de 90 a 94).' : '.';
  const rango = `rango normal para ${grupo} (de ${a} a ${b} veces; umbral de autonomía: ${u})`;
  const base = { a, b, u, grupo, categoria: n === 0 ? `0: sin poder levantarse sin los brazos (${rango})` : `${n < a ? 'Por debajo del' : n <= b ? 'Dentro del' : 'Por encima del'} ${rango}` };
  if (n === 0) return { ...base, zona: 'bajo', titulo: '0: no has podido levantarte sin los brazos', texto: 'Si hacen falta los brazos para levantarse, el resultado cuenta como 0. Merece la pena comentarlo con tu médico.' };
  if (n < a) {
    return { ...base, zona: 'bajo', titulo: 'Por debajo de lo normal para tu edad',
      texto: `El rango normal para ${grupo} es de ${a} a ${b} veces${extra} Por debajo de ese rango, la campaña STEADI de los CDC lo asocia a más riesgo de caídas. La fuerza de piernas se puede entrenar a cualquier edad: coméntalo con tu médico.` };
  }
  if (n <= b) {
    return { ...base, zona: 'medio', titulo: 'Dentro de lo normal para tu edad',
      texto: `El rango normal para ${grupo} es de ${a} a ${b} veces${extra} ${n < u
        ? `Aún estás por debajo del umbral que Rikli y Jones proponen para mantener la autonomía hasta edades avanzadas (${u} veces): hay margen para ganar fuerza.`
        : `Y llegas al umbral que Rikli y Jones proponen para mantener la autonomía hasta edades avanzadas (${u} veces).`}` };
  }
  return { ...base, zona: 'alto', titulo: 'Por encima de lo normal para tu edad',
    texto: `Mejor que 3 de cada 4 ${grupo} (rango normal: de ${a} a ${b} veces)${extra} Mantenerlo es cosa de seguir entrenando la fuerza.` };
}

// ---------- 10 segundos sobre una pierna (Araujo 2022: 1.702 personas de 51 a 75 años; tres intentos) ----------
// intentos: los segundos que aguantó en cada uno (10 = conseguido), como mucho 3
export function resultadoEquilibrio({ intentos = [], edad = null }) {
  const xs = (Array.isArray(intentos) ? intentos : []).map(Number).filter((x) => Number.isFinite(x) && x >= 0 && x <= 10).slice(0, 3);
  if (!xs.length) return null;
  const ok = xs.some((x) => x >= 10);
  if (!ok && xs.length < 3) return null;   // aún le quedan intentos
  const mejor = Math.max(...xs);
  const e = Number(edad);
  const fuera = !Number.isFinite(e) || e < 51 || e > 75;
  const nota = fuera ? ' El estudio es de personas de 51 a 75 años: fuera de esas edades, compárate contigo, frente a la vez anterior.' : '';
  if (ok) {
    const al = xs.findIndex((x) => x >= 10) + 1;
    return { zona: fuera ? null : 'alto', valor: 10, intentos: xs.length, mejor: 10, categoria: `Conseguido${al > 1 ? ` al intento ${al}` : ''}`, titulo: `Diez segundos a una pierna${al > 1 ? ` (al intento ${al})` : ''}`,
      texto: `En el estudio, 8 de cada 10 personas de 51 a 75 años lo consiguieron. Repítelo cada pocos meses: el equilibrio empeora deprisa a partir de mediados de los 50, y se entrena.${nota}` };
  }
  return { zona: fuera ? null : 'bajo', valor: mejor, intentos: 3, mejor, categoria: `No completado en tres intentos (mejor: ${coma(mejor, 1)} s)`, titulo: 'Una señal para trabajar el equilibrio',
    texto: `En el estudio, no completar los 10 segundos se asoció a más riesgo de muerte en los 7 años siguientes, también tras tener en cuenta la edad, el sexo, el peso y las enfermedades. Es una asociación, no una condena: la fuerza y el equilibrio se entrenan a cualquier edad. Coméntalo con tu médico si además te has caído en el último año.${nota}` };
}

// ---------- Cintura y altura (NICE NG246, 2025, con los cortes de 2022) ----------
export function resultadoCintura({ cintura, altura }) {
  const c = Number(cintura), h = Number(altura);
  if (!Number.isFinite(c) || !Number.isFinite(h) || h < 100 || h > 250 || c < 30 || c > 250) return null;
  const r = c / h, rr = Math.round(r * 100) / 100;
  const lim = Math.floor(h * 0.5 * 10) / 10;
  const limite = `${coma(lim, lim % 1 ? 1 : 0)} cm`;
  const base = { valor: rr, limite: lim };
  if (r < 0.4) return { ...base, zona: 'medio', categoria: 'Por debajo de 0,4', titulo: 'Por debajo del rango de la guía', texto: 'La guía de NICE describe como saludable de 0,4 a 0,49. Un valor más bajo no se clasifica ahí: si además has perdido peso sin buscarlo, coméntalo con tu médico.' };
  if (r < 0.5) return { ...base, zona: 'alto', categoria: 'Saludable (0,4 a 0,49)', titulo: 'Grasa abdominal en rango saludable', texto: `Sin aumento del riesgo para la salud por la grasa abdominal. Para tu altura, mantén la cintura por debajo de ${limite}.` };
  if (r < 0.6) return { ...base, zona: 'medio', categoria: 'Aumentada (0,5 a 0,59)', titulo: 'Grasa abdominal aumentada', texto: `Indica más riesgo para la salud (por ejemplo, de diabetes tipo 2 o enfermedad cardiovascular). Para tu altura, la cintura debería quedar por debajo de ${limite}. Pide a tu médico que valore tus factores de riesgo.` };
  return { ...base, zona: 'bajo', categoria: 'Alta (0,6 o más)', titulo: 'Grasa abdominal alta', texto: `Indica un riesgo para la salud más alto todavía. Conviene una valoración de tus factores de riesgo cardiometabólico con tu médico. Para tu altura, la cintura debería quedar por debajo de ${limite}.` };
}

// ---------- La prensión con dinamómetro (EWGSOP2: menos de 27 kg en hombres y de 16 en mujeres; cuenta el mejor de 3) ----------
export function resultadoPrension({ intentos = [], sexo }) {
  const s = sexoDe(sexo);
  const xs = (Array.isArray(intentos) ? intentos : []).map(Number).filter((x) => Number.isFinite(x) && x > 0 && x < 200).slice(0, 3);
  if (!s || !xs.length) return null;
  const m = Math.max(...xs), cor = s === 'hombre' ? 27 : 16, quien = s === 'hombre' ? 'hombres' : 'mujeres';
  const fiable = xs.length < 3 ? ' Con tres intentos el resultado es más fiable.' : '';
  const categoria = `${m < cor ? 'Por debajo' : 'Por encima'} del punto de corte de EWGSOP2 para ${quien} (${cor} kg)`;
  if (m < cor) {
    return { zona: 'bajo', valor: m, corte: cor, categoria, titulo: 'Fuerza de prensión baja',
      texto: `Por debajo de ${cor} kg en ${quien}, el punto de corte del consenso europeo de sarcopenia (EWGSOP2). Para ellos, una fuerza baja hace «probable» la sarcopenia: coméntalo con tu médico. El entrenamiento de fuerza es el tratamiento principal.${fiable}` };
  }
  return { zona: 'alto', valor: m, corte: cor, categoria, titulo: 'Por encima del punto de corte',
    texto: `Estás por encima de ${cor} kg, el umbral de fuerza baja del consenso europeo para ${quien}. Repetirlo cada pocos meses sirve para ver la tendencia.${fiable}` };
}

// ---------- El SPPB (Guralnik 1994 y 2000): equilibrio, marcha de 4 metros y cinco levantadas, de 0 a 4 cada una ----------
// lado, semi, tandem: segundos que aguantó cada postura (lado y semi: 10 = conseguido; tándem: 10, de 3 a 9,99 o menos de 3)
// marcha: los segundos de los dos intentos (cuenta el mejor) o null si no pudo; silla: los segundos de las cinco
// levantadas, o 0 si no pudo levantarse sin los brazos (o tardó más de 60)
export function puntuarSPPB({ lado = null, semi = null, tandem = null, marcha = [], silla = null } = {}) {
  let eq = null;
  if (lado != null) {
    if (lado < 10) eq = 0;
    else if (semi != null) {
      if (semi < 10) eq = 1;
      else if (tandem != null) eq = 2 + (tandem >= 10 ? 2 : tandem >= 3 ? 1 : 0);
    }
  }
  const ts = (Array.isArray(marcha) ? marcha : []).map(Number).filter((x) => Number.isFinite(x) && x > 0);
  const mt = ts.length ? Math.min(...ts) : null;
  const mp = marcha === null ? 0 : mt == null ? null : mt < 4.82 ? 4 : mt <= 6.2 ? 3 : mt <= 8.7 ? 2 : 1;
  const sp = silla == null ? null : silla <= 0 ? 0 : silla <= 11.19 ? 4 : silla <= 13.69 ? 3 : silla <= 16.69 ? 2 : silla <= 60 ? 1 : 0;
  const partes = { equilibrio: eq, marcha: mp, silla: sp };
  if (eq == null || mp == null || sp == null) return { partes, total: null };
  return { partes, ...resultadoSPPB(eq + mp + sp) };
}
// Con el total (de 0 a 12): la categoría de la web (10-12, 7-9, 0-6)
export function resultadoSPPB(total) {
  const t = Number(total);
  if (!Number.isInteger(t) || t < 0 || t > 12) return { total: null };
  if (t >= 10) return { total: t, zona: 'alto', categoria: 'Rendimiento alto (10-12)', titulo: 'Rendimiento alto', texto: 'Buen equilibrio, buena marcha y buena fuerza de piernas. Lo que lo mantiene es seguir entrenando fuerza y equilibrio.' };
  if (t >= 7) {
    return { total: t, zona: 'medio', categoria: 'Rendimiento intermedio (7-9)', titulo: 'Rendimiento intermedio',
      texto: `Hay margen de mejora, y el ejercicio de fuerza y equilibrio adaptado suele mejorarlo.${t <= 8 ? ' Una puntuación de 8 o menos es la que el consenso europeo de sarcopenia considera bajo rendimiento físico: conviene comentarlo con tu médico.' : ''}` };
  }
  return { total: t, zona: 'bajo', categoria: 'Rendimiento bajo (0-6)', titulo: 'Rendimiento bajo', texto: 'Conviene comentarlo con tu médico y empezar con un programa de ejercicio adaptado, mejor supervisado.' };
}

// ---------- Cuándo toca y la vez anterior ----------
const dias = (a, b) => Math.round((Date.parse(`${String(b).slice(0, 10)}T12:00:00Z`) - Date.parse(`${String(a).slice(0, 10)}T12:00:00Z`)) / 864e5);
// filas: [{ prueba, fecha, valor, ... }] → la última de cada prueba y la anterior a ella
export function ultimasPruebas(filas = []) {
  const por = {};
  const xs = (Array.isArray(filas) ? filas : []).filter((f) => f && PRUEBAS.includes(f.prueba) && /^\d{4}-\d{2}-\d{2}/.test(String(f.fecha || '')))
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.creado_en || '').localeCompare(String(a.creado_en || '')));
  for (const f of xs) {
    const p = por[f.prueba] ||= { ultima: null, anterior: null };
    if (!p.ultima) p.ultima = f;
    else if (!p.anterior && String(f.fecha).slice(0, 10) !== String(p.ultima.fecha).slice(0, 10)) p.anterior = f;
  }
  return por;
}
// ¿Toca repetirlas? Cada 12 semanas desde la última (de cualquiera de las tres sin material); sin ninguna, toca ya
export function tocaPruebas(filas = [], hoy) {
  const fechas = (Array.isArray(filas) ? filas : []).filter((f) => ['silla', 'equilibrio', 'cintura'].includes(f?.prueba)).map((f) => String(f.fecha).slice(0, 10)).sort();
  if (!fechas.length) return { toca: true, desde: null, dias: null };
  const ult = fechas[fechas.length - 1];
  const d = dias(ult, hoy);
  return { toca: d >= CADA_DIAS, desde: ult, dias: d, cuando: d >= CADA_DIAS ? 0 : CADA_DIAS - d };
}
// Mejor o peor que la vez anterior (en la cintura/altura, bajar es mejorar): 'mejor' | 'igual' | 'peor' | null
export function comparar(prueba, ahora, antes) {
  const a = Number(ahora?.valor), b = Number(antes?.valor);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const tol = prueba === 'cintura' ? 0.005 : prueba === 'prension' ? 0.5 : 0;
  if (Math.abs(a - b) <= tol) return 'igual';
  if (prueba === 'cintura' && (a < 0.4 || b < 0.4)) return null;   // (por debajo de 0,4, bajar ya no es mejorar: como en la web)
  const sube = a > b;
  return (prueba === 'cintura' ? !sube : sube) ? 'mejor' : 'peor';
}
// Qué pruebas le tocan: las tres sin material, la prensión si tiene dinamómetro y el SPPB desde los 65
export function pruebasDe({ edad = null, dinamometro = false } = {}) {
  const e = Number(edad);
  return ['silla', 'equilibrio', 'cintura', ...(dinamometro ? ['prension'] : []), ...(Number.isFinite(e) && e >= EDAD_SPPB ? ['sppb'] : [])];
}
// Lo que se guarda de cada prueba (migración 108): { prueba, valor, detalle } con sus límites, o { error }
export function filaPrueba(prueba, d = {}) {
  if (prueba === 'silla') { const r = resultadoSilla(d); return r ? { prueba, valor: Number(d.veces), detalle: null } : { error: 'Apunta cuántas veces te has levantado (de 0 a 60).' }; }
  if (prueba === 'equilibrio') { const r = resultadoEquilibrio(d); return r ? { prueba, valor: r.valor, detalle: { intentos: d.intentos.slice(0, 3).map(Number) } } : { error: 'Haz los intentos que faltan.' }; }
  if (prueba === 'cintura') { const r = resultadoCintura(d); return r ? { prueba, valor: r.valor, detalle: { cintura: Number(d.cintura), altura: Number(d.altura) } } : { error: 'Revisa tu cintura y tu altura.' }; }
  if (prueba === 'prension') { const r = resultadoPrension(d); return r ? { prueba, valor: r.valor, detalle: { intentos: d.intentos.map(Number).filter((x) => x > 0).slice(0, 3) } } : { error: 'Apunta al menos un intento.' }; }
  if (prueba === 'sppb') { const r = puntuarSPPB(d); return r?.total != null ? { prueba, valor: r.total, detalle: { partes: r.partes } } : { error: 'Faltan pruebas del SPPB.' }; }
  return { error: 'Esa prueba no existe.' };
}
// El valor, para leer: «14 veces», «10 s», «0,48», «32 kg», «11 de 12»
export function valorTexto(prueba, valor) {
  const v = Number(valor);
  if (!Number.isFinite(v)) return '';
  if (prueba === 'silla') return `${v} ${v === 1 ? 'vez' : 'veces'}`;
  if (prueba === 'equilibrio') return v >= 10 ? '10 s' : `${coma(v, 1)} s`;
  if (prueba === 'cintura') return coma(v, 2);
  if (prueba === 'prension') return `${coma(v, v % 1 ? 1 : 0)} kg`;
  if (prueba === 'sppb') return `${v} de 12`;
  return String(v);
}

// ---------- Lo guardado: su resultado, el antes y el ahora, su entreno y el informe para su médico ----------
// El resultado de una fila guardada (con su edad y su sexo de ese día)
export function resultadoDeFila(f) {
  if (!f || !PRUEBAS.includes(f.prueba)) return null;
  const d = f.detalle && typeof f.detalle === 'object' ? f.detalle : {};
  const v = Number(f.valor);
  if (f.prueba === 'silla') return resultadoSilla({ veces: v, edad: f.edad, sexo: f.sexo });
  if (f.prueba === 'equilibrio') return resultadoEquilibrio({ intentos: Array.isArray(d.intentos) ? d.intentos : v >= 10 ? [10] : [v, v, v], edad: f.edad });
  if (f.prueba === 'cintura') return resultadoCintura({ cintura: d.cintura, altura: d.altura });
  if (f.prueba === 'prension') return resultadoPrension({ intentos: Array.isArray(d.intentos) ? d.intentos : [v], sexo: f.sexo });
  const r = resultadoSPPB(v);
  return r.total == null ? null : { ...r, partes: d.partes || null };
}
// Lo que acompaña al valor (las medidas, los intentos o las partes)
export function detalleTexto(f) {
  const d = f?.detalle && typeof f.detalle === 'object' ? f.detalle : {};
  if (f?.prueba === 'cintura' && d.cintura && d.altura) return `cintura ${coma(Number(d.cintura), Number(d.cintura) % 1 ? 1 : 0)} cm, altura ${coma(Number(d.altura), Number(d.altura) % 1 ? 1 : 0)} cm`;
  if (f?.prueba === 'prension' && Array.isArray(d.intentos)) return `mejor de ${d.intentos.length} ${d.intentos.length === 1 ? 'intento' : 'intentos'}`;
  if (f?.prueba === 'sppb' && d.partes) return `equilibrio ${d.partes.equilibrio}, marcha ${d.partes.marcha}, levantarse ${d.partes.silla}`;
  return '';
}
// «Tu trimestre»: de cada prueba hecha dos veces (en días distintos), la vez anterior y la última
export function antesYAhora(filas = []) {
  const u = ultimasPruebas(filas);
  return PRUEBAS.filter((k) => u[k]?.ultima && u[k]?.anterior).map((k) => {
    const c = comparar(k, u[k].ultima, u[k].anterior);
    return { prueba: k, nombre: NOMBRE_PRUEBA[k], texto: `${valorTexto(k, u[k].anterior.valor)} → ${valorTexto(k, u[k].ultima.valor)}`, c, mejor: c === 'mejor' };
  });
}
// Su entreno, para el informe: desde cuándo y cuántas sesiones en las últimas 4 semanas (fechas: las de las sesiones hechas)
export function textoEntreno({ inicio = null, fechas = [], hoy, fecha = fechaInforme } = {}) {
  if (!inicio || !hoy || String(inicio).slice(0, 10) > String(hoy).slice(0, 10)) return null;
  const n = (Array.isArray(fechas) ? fechas : []).map((x) => String(x || '').slice(0, 10)).filter((x) => x && x <= hoy && dias(x, hoy) < 28).length;
  return `Mi entreno: fuerza con FBE Esencial desde el ${fecha(String(inicio).slice(0, 10))}; ${n} ${n === 1 ? 'sesión' : 'sesiones'} en las últimas 4 semanas.`;
}
// El informe para su médico: un texto para compartir o copiar (lo genera el móvil; el nombre no se guarda)
export function informeMedico({ filas = [], hoy, nombre = '', entreno = null, fecha = fechaInforme } = {}) {
  const u = ultimasPruebas(filas);
  const ps = PRUEBAS.filter((k) => u[k]?.ultima);
  if (!ps.length) return null;
  const ult = ps.map((k) => u[k].ultima).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))[0];
  const L = ['Resultados de mis pruebas físicas', 'FBE Esencial · Fuerza Basada en Evidencia', `Fecha del informe: ${fecha(hoy)}`];
  const nom = String(nombre || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (nom) L.push(`Nombre: ${nom}`);
  const quien = [ult.edad ? `Edad: ${ult.edad} años` : null, ult.sexo ? `Sexo: ${ult.sexo}` : null].filter(Boolean).join(' · ');
  if (quien) L.push(quien);
  L.push('Pruebas que he hecho y apuntado yo en la app de FBE. Son orientativas, no un diagnóstico.', '');
  for (const k of ps) {
    const { ultima, anterior } = u[k];
    const r = resultadoDeFila(ultima), dt = detalleTexto(ultima);
    L.push(`${NOMBRE_INFORME[k]}: ${valorTexto(k, ultima.valor)}${dt ? ` (${dt})` : ''}, el ${fecha(String(ultima.fecha).slice(0, 10))}.`);
    if (r?.categoria) L.push(`${r.categoria}.`);
    if (anterior) L.push(`Anterior: ${valorTexto(k, anterior.valor)}, el ${fecha(String(anterior.fecha).slice(0, 10))}.`);
    L.push('');
  }
  if (entreno) L.push(entreno, '');
  L.push('Fuentes:', ...[...new Set(ps.flatMap((k) => FUENTES_PRUEBA[k]))].map((f, i) => `${i + 1}. ${f}`), '', 'Informe hecho en mi móvil con la app de FBE.');
  return L.join('\n');
}
