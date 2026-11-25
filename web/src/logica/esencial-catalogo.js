// FBE Esencial (sin coach, tanda 3): el catálogo de rutinas para quien va por su cuenta. Lógica pura y datos: las 63
// plantillas de la base de Pelayo (su nombre exacto, su imagen, sus días, su familia y su opción, dónde se hace y con
// qué, desde qué nivel y para quién), sus textos en llano, la criba del principio (quién necesita «Primeras 4 semanas»)
// y el algoritmo que, con el cuestionario y «Tus gustos», recomienda dos o tres. Los ejercicios de cada rutina no están
// aquí: los da la base (esencial_catalogo). Va en su trozo: solo lo cargan las pantallas que lo usan.
// (este bloque de datos lo escribe un guion a partir de la lista de plantillas de Pelayo del 25/11/2026)

// [nombre, imagen, días, familia, opción, dónde ('g' gimnasio · 'c' casa), material que pide, nivel mínimo (0-4), para quién]
const FILAS = [
  ["Primeras 4 semanas", "rutina-primeras-4-semanas", 2, "primeras", null, "g", [], 0, ["iniciacion"]],
  ["Novato 2 días · FBE Esencial", "rutina-novato-2d", 2, "novato", null, "g", [], 0, ["iniciacion", "general"]],
  ["Novato 3 días · FBE Esencial", "rutina-novato-3d", 3, "novato", null, "g", [], 0, ["iniciacion", "general"]],
  ["2 días · Full body · A · Barra y básicos", "rutina-2d-fullbody-a", 2, "fullbody", "A", "g", ["barra"], 2, ["general"]],
  ["2 días · Full body · B · Máquinas y mancuernas", "rutina-2d-fullbody-b", 2, "fullbody", "B", "g", [], 1, ["general"]],
  ["2 días · Full body · C · Énfasis glúteo y pierna", "rutina-2d-fullbody-c", 2, "fullbody", "C", "g", [], 1, ["gluteo"]],
  ["2 días · Full body en casa, sin material", "rutina-2d-casa", 2, "casa", null, "c", [], 0, ["general"]],
  ["2 días · De viaje (hotel, 25–30 minutos)", "rutina-2d-viaje", 2, "viaje", null, "c", [], 0, ["viaje", "poco_tiempo"]],
  ["2 días · Mantenimiento mínimo (40 minutos)", "rutina-2d-mantenimiento", 2, "mantenimiento", null, "g", [], 1, ["poco_tiempo"]],
  ["2 días · Complemento a otro deporte (pádel, fútbol)", "rutina-2d-otro-deporte", 2, "deporte", null, "g", [], 1, ["deporte"]],
  ["3 días · Full body · A · Barra y básicos", "rutina-3d-fullbody-a", 3, "fullbody", "A", "g", ["barra"], 2, ["general"]],
  ["3 días · Full body · B · Máquinas y mancuernas", "rutina-3d-fullbody-b", 3, "fullbody", "B", "g", [], 1, ["general"]],
  ["3 días · Full body · C · Énfasis glúteo y pierna", "rutina-3d-fullbody-c", 3, "fullbody", "C", "g", [], 1, ["gluteo"]],
  ["3 días · Full body A y B + torso · A · Barra y básicos", "rutina-3d-fullbody-torso-a", 3, "fullbody_torso", "A", "g", ["barra"], 2, ["general", "torso"]],
  ["3 días · Full body A y B + torso · B · Máquinas y mancuernas", "rutina-3d-fullbody-torso-b", 3, "fullbody_torso", "B", "g", [], 1, ["general", "torso"]],
  ["3 días · Full body A y B + torso · C · Énfasis glúteo y pierna", "rutina-3d-fullbody-torso-c", 3, "fullbody_torso", "C", "g", [], 1, ["gluteo"]],
  ["3 días · Pierna, torso y full body · A · Barra y básicos", "rutina-3d-pierna-torso-fb-a", 3, "pierna_torso_fb", "A", "g", ["barra"], 2, ["general"]],
  ["3 días · Pierna, torso y full body · B · Máquinas y mancuernas", "rutina-3d-pierna-torso-fb-b", 3, "pierna_torso_fb", "B", "g", [], 1, ["general"]],
  ["3 días · Pierna, torso y full body · C · Énfasis glúteo y pierna", "rutina-3d-pierna-torso-fb-c", 3, "pierna_torso_fb", "C", "g", [], 1, ["gluteo"]],
  ["3 días · Fuerza en básicos", "rutina-3d-basicos", 3, "basicos", null, "g", ["barra"], 2, ["fuerza"]],
  ["3 días · Calistenia básica", "rutina-3d-calistenia", 3, "calistenia", null, "c", ["dominadas"], 1, ["calistenia"]],
  ["3 días · Fuerza para corredores", "rutina-3d-corredores", 3, "corredores", null, "g", [], 1, ["correr"]],
  ["3 días · Full body con gomas", "rutina-3d-gomas", 3, "gomas", null, "c", ["gomas"], 0, ["general"]],
  ["3 días · Full body con mancuernas y banco", "rutina-3d-mancuernas", 3, "mancuernas", null, "c", ["mancuernas", "banco"], 0, ["general"]],
  ["3 días · Full body en casa, sin material", "rutina-3d-casa", 3, "casa", null, "c", [], 0, ["general"]],
  ["3 días · Full body en estiramiento", "rutina-3d-estiramiento", 3, "estiramiento", null, "g", [], 2, ["general"]],
  ["3 días · Iniciación en casa", "rutina-3d-iniciacion-casa", 3, "iniciacion_casa", null, "c", [], 0, ["iniciacion"]],
  ["3 días · Iniciación en gimnasio, solo máquinas", "rutina-3d-iniciacion-maquinas", 3, "iniciacion", null, "g", [], 0, ["iniciacion"]],
  ["3 días · Salud y mayores de 60", "rutina-3d-salud-60", 3, "salud", null, "g", [], 0, ["salud", "mayores"]],
  ["4 días · Torso-pierna · A · Barra y básicos", "rutina-4d-torso-pierna-a", 4, "torso_pierna", "A", "g", ["barra"], 2, ["general"]],
  ["4 días · Torso-pierna · B · Máquinas y mancuernas", "rutina-4d-torso-pierna-b", 4, "torso_pierna", "B", "g", [], 1, ["general"]],
  ["4 días · Torso-pierna · C · Énfasis glúteo y pierna", "rutina-4d-torso-pierna-c", 4, "torso_pierna", "C", "g", [], 1, ["gluteo"]],
  ["4 días · Pierna, empuje, tirón + full body · A · Barra y básicos", "rutina-4d-pet-fullbody-a", 4, "pet_fullbody", "A", "g", ["barra"], 2, ["general"]],
  ["4 días · Pierna, empuje, tirón + full body · B · Máquinas y mancuernas", "rutina-4d-pet-fullbody-b", 4, "pet_fullbody", "B", "g", [], 2, ["general"]],
  ["4 días · Pierna, empuje, tirón + full body · C · Énfasis glúteo y pierna", "rutina-4d-pet-fullbody-c", 4, "pet_fullbody", "C", "g", [], 2, ["gluteo"]],
  ["4 días · Empuje, tirón, pierna + torso · A · Barra y básicos", "rutina-4d-etp-torso-a", 4, "etp_torso", "A", "g", ["barra"], 2, ["general", "torso"]],
  ["4 días · Empuje, tirón, pierna + torso · B · Máquinas y mancuernas", "rutina-4d-etp-torso-b", 4, "etp_torso", "B", "g", [], 2, ["general", "torso"]],
  ["4 días · Empuje, tirón, pierna + torso · C · Énfasis glúteo y pierna", "rutina-4d-etp-torso-c", 4, "etp_torso", "C", "g", [], 2, ["gluteo"]],
  ["4 días · PHUL (fuerza e hipertrofia)", "rutina-4d-phul", 4, "phul", null, "g", [], 2, ["fuerza", "general"]],
  ["4 días · Anterior-posterior", "rutina-4d-anterior-posterior", 4, "ant_post", null, "g", [], 2, ["general"]],
  ["4 días · Full body de alta frecuencia", "rutina-4d-fullbody-frecuencia", 4, "fb_frecuencia", null, "g", [], 2, ["general"]],
  ["4 días · Fuerza en básicos con variantes", "rutina-4d-basicos-variantes", 4, "basicos", null, "g", ["barra"], 3, ["fuerza"]],
  ["4 días · Torso-pierna con gomas y peso corporal", "rutina-4d-gomas", 4, "gomas", null, "c", ["gomas"], 0, ["general"]],
  ["4 días · Torso-pierna con mancuernas y banco", "rutina-4d-mancuernas", 4, "mancuernas", null, "c", ["mancuernas", "banco"], 0, ["general"]],
  ["4 días · Especialización de espalda", "rutina-4d-esp-espalda", 4, "esp", null, "g", [], 2, ["especializacion", "torso"]],
  ["4 días · Especialización de pecho", "rutina-4d-esp-pecho", 4, "esp", null, "g", [], 2, ["especializacion", "torso"]],
  ["4 días · Especialización de hombro y brazos", "rutina-4d-esp-hombro-brazos", 4, "esp", null, "g", [], 2, ["especializacion", "torso"]],
  ["4 días · Especialización de pierna (cuádriceps e isquios)", "rutina-4d-esp-pierna", 4, "esp", null, "g", [], 2, ["especializacion", "gluteo"]],
  ["4 días · Especialización de glúteo", "rutina-4d-esp-gluteo", 4, "esp", null, "g", [], 2, ["especializacion", "gluteo"]],
  ["5 días · PPL + torso-pierna · A · Barra y básicos", "rutina-5d-ppl-tp-a", 5, "ppl_tp", "A", "g", ["barra"], 2, ["general"]],
  ["5 días · PPL + torso-pierna · B · Máquinas y mancuernas", "rutina-5d-ppl-tp-b", 5, "ppl_tp", "B", "g", [], 2, ["general"]],
  ["5 días · PPL + torso-pierna · C · Énfasis glúteo y pierna", "rutina-5d-ppl-tp-c", 5, "ppl_tp", "C", "g", [], 2, ["gluteo"]],
  ["5 días · PHAT · A · Barra y básicos", "rutina-5d-phat-a", 5, "phat", "A", "g", ["barra"], 3, ["general"]],
  ["5 días · PHAT · B · Máquinas y mancuernas", "rutina-5d-phat-b", 5, "phat", "B", "g", [], 3, ["general"]],
  ["5 días · PHAT · C · Énfasis glúteo y pierna", "rutina-5d-phat-c", 5, "phat", "C", "g", [], 3, ["gluteo"]],
  ["5 días · Density · A · Barra y básicos", "rutina-5d-density-a", 5, "density", "A", "g", ["barra"], 2, ["general"]],
  ["5 días · Density · B · Máquinas y mancuernas", "rutina-5d-density-b", 5, "density", "B", "g", [], 2, ["general"]],
  ["5 días · Density · C · Énfasis glúteo y pierna", "rutina-5d-density-c", 5, "density", "C", "g", [], 2, ["gluteo"]],
  ["5 días · Torso-pierna + full body", "rutina-5d-tp-fullbody", 5, "tp_fb", null, "g", [], 2, ["general"]],
  ["6 días · PPL ×2 · A · Barra y básicos", "rutina-6d-ppl2-a", 6, "ppl2", "A", "g", ["barra"], 3, ["general"]],
  ["6 días · PPL ×2 · B · Máquinas y mancuernas", "rutina-6d-ppl2-b", 6, "ppl2", "B", "g", [], 3, ["general"]],
  ["6 días · PPL ×2 · C · Énfasis glúteo y pierna", "rutina-6d-ppl2-c", 6, "ppl2", "C", "g", [], 3, ["gluteo"]],
  ["6 días · Arnold (pecho-espalda, hombro-brazos, pierna)", "rutina-6d-arnold", 6, "arnold", null, "g", [], 3, ["torso", "general"]],
];

// La familia de cada reparto con opciones A, B y C: [título en llano, qué es]
const FAMILIAS = {
  fullbody: ["Cuerpo entero", "Todo el cuerpo en cada sesión, con al menos un día de descanso entre una y otra."],
  fullbody_torso: ["Cuerpo entero y un día de torso", "Dos días de cuerpo entero y un tercero de torso: pierna dos veces por semana y algo más de tren superior."],
  pierna_torso_fb: ["Pierna, torso y cuerpo entero", "Un día de pierna, uno de torso y uno de cuerpo entero: cada músculo, dos veces por semana en tres días."],
  torso_pierna: ["Torso y pierna", "Dos días de pierna y dos de torso, alternados: cada músculo, dos veces por semana."],
  pet_fullbody: ["Pierna, empuje, tirón y cuerpo entero", "Un día de pierna, uno de empuje y uno de tirón, y un cuarto de cuerpo entero, más corto, de recordatorio."],
  etp_torso: ["Empuje, tirón, pierna y torso", "Empuje, tirón y pierna, y un cuarto día de torso: para dar prioridad al tren superior."],
  ppl_tp: ["Empuje, tirón, pierna, torso y pierna", "Empuje, tirón y pierna en la primera mitad de la semana, y un torso y una segunda pierna en la segunda."],
  phat: ["Fuerza y volumen en cinco días (PHAT)", "Dos días pesados (torso y pierna), un descanso y tres días con más repeticiones: fuerza y volumen en la misma semana."],
  density: ["Superseries y descansos cortos (Density)", "Superseries de músculos opuestos con descansos cortos: más trabajo por minuto y sesiones de unos 50 minutos."],
  ppl2: ["Empuje, tirón y pierna, dos veces", "Empuje, tirón y pierna dos veces por semana, con ejercicios distintos en la segunda vuelta. Un día de descanso."],
  primeras: ['Primeras 4 semanas', 'Las cuatro semanas de la guía para empezar de cero: dos días, cinco ejercicios y una semana final de marcas.'],
  novato: ['Novato', 'La sesión que ya conoces de tus primeras semanas, subiendo kilos semana a semana.'],
};
// Las que van sueltas: nombre sin los días → [título en llano, qué es]
const SUELTAS = {
  "Complemento a otro deporte (pádel, fútbol)": ["Fuerza para tu otro deporte", "Dos días de fuerza para acompañar al pádel, al fútbol o a otro deporte de cambios de dirección: pierna, laterales, isquios y hombro."],
  "De viaje (hotel, 25–30 minutos)": ["De viaje", "Dos sesiones cortas de cuerpo entero, sin material, en 25-30 minutos: para no perder el hilo cuando estás fuera."],
  "Full body en casa, sin material": ["Cuerpo entero en casa, sin material", "Cuerpo entero en casa sin nada (como mucho, una silla y una mochila cargada). Si tienes una barra de dominadas, mejor."],
  "Mantenimiento mínimo (40 minutos)": ["Mantenimiento mínimo", "Dos sesiones de 40 minutos para épocas de poco tiempo: un ejercicio grande por movimiento y pocas series duras. Mantiene lo ganado."],
  "Calistenia básica": ["Calistenia básica", "Tres días con tu propio peso para dominar dominadas, fondos y la sentadilla a una pierna. Hace falta una barra y unas paralelas."],
  "Fuerza en básicos": ["Fuerza en los básicos", "Sentadilla, press banca y peso muerto, un día para cada uno, con los accesorios justos. Para subir tus marcas."],
  "Fuerza para corredores": ["Fuerza para corredores", "Tres días pensados para quien corre: una pierna cada vez, isquios y gemelo fuertes, cadera estable y lo justo de torso."],
  "Full body con gomas": ["Cuerpo entero con gomas", "Cuerpo entero solo con gomas (una larga y una minibanda)."],
  "Full body con mancuernas y banco": ["Cuerpo entero con mancuernas y banco", "Cuerpo entero con un par de mancuernas y un banco: lo que cabe en casa."],
  "Full body en estiramiento": ["Cuerpo entero en estiramiento", "Ejercicios que cargan el músculo estirado (sentadilla profunda, peso muerto rumano, press con mancuernas), bajando lento y con pausa abajo."],
  "Iniciación en casa": ["Iniciación en casa", "Para empezar en casa: movimientos sencillos y lejos del límite."],
  "Iniciación en gimnasio, solo máquinas": ["Iniciación en el gimnasio, solo máquinas", "Para empezar en el gimnasio solo con máquinas guiadas: fácil de aprender y de progresar."],
  "Salud y mayores de 60": ["Salud y mayores de 60", "Para ganar fuerza con seguridad: máquinas, levantarse de la silla con carga, agarre y equilibrio."],
  "Anterior-posterior": ["Delante y detrás", "La parte de delante del cuerpo un día y la de atrás otro, dos veces cada una: pierna y torso en todas las sesiones."],
  "Especialización de espalda": ["Especialización de espalda", "Tres días con la espalda como protagonista y el resto en mantenimiento. Para 6-8 semanas; después, vuelve a un reparto equilibrado."],
  "Especialización de glúteo": ["Especialización de glúteo", "Tres días de glúteo y pierna, desde todos los ángulos, y uno de torso. Para 6-8 semanas; después, vuelve a un reparto equilibrado."],
  "Especialización de hombro y brazos": ["Especialización de hombro y brazos", "Tres días con hombro y brazos como protagonistas y el resto en mantenimiento. Para 6-8 semanas; después, vuelve a un reparto equilibrado."],
  "Especialización de pecho": ["Especialización de pecho", "Tres días con el pecho como protagonista y el resto en mantenimiento. Para 6-8 semanas; después, vuelve a un reparto equilibrado."],
  "Especialización de pierna (cuádriceps e isquios)": ["Especialización de pierna", "Tres días de pierna (cuádriceps e isquios) y el torso en mantenimiento. Para 6-8 semanas; después, vuelve a un reparto equilibrado."],
  "Fuerza en básicos con variantes": ["Fuerza en los básicos, con variantes", "Cuatro días al estilo powerlifting: sentadilla y banca dos veces y peso muerto, cada uno con la variante que ataca su punto débil."],
  "Full body de alta frecuencia": ["Cuerpo entero, cuatro días", "Cuatro días de cuerpo entero con ejercicios distintos: cada músculo, muchas veces y pocas series cada vez."],
  "PHUL (fuerza e hipertrofia)": ["Fuerza y volumen en cuatro días (PHUL)", "Torso y pierna pesados al principio de la semana, y torso y pierna con más repeticiones al final."],
  "Torso-pierna con gomas y peso corporal": ["Torso y pierna con gomas", "Torso y pierna dos veces por semana con gomas y tu propio peso."],
  "Torso-pierna con mancuernas y banco": ["Torso y pierna con mancuernas y banco", "Torso y pierna dos veces por semana con mancuernas y un banco."],
  "Torso-pierna + full body": ["Torso, pierna y cuerpo entero", "Torso y pierna dos veces y un quinto día de cuerpo entero para repartir más series en la semana."],
  "Arnold (pecho-espalda, hombro-brazos, pierna)": ["Pecho y espalda, hombro y brazos, y pierna", "El reparto clásico: pecho y espalda, hombro y brazos, y pierna, dos veces por semana."],
};
const OPCIONES = {
  A: ['Barra y básicos', 'Con barra: sentadilla, press banca y peso muerto como base. Para quien ya los domina.'],
  B: ['Máquinas y mancuernas', 'Con máquinas, poleas y mancuernas: fácil de aprender y de progresar.'],
  C: ['Énfasis glúteo y pierna', 'Con más series de glúteo y pierna que de torso: hip thrust, búlgara y abducciones.'],
};

const NIVELES = ['ninguna', 'menos_1', '1_3', '3_5', 'mas_5'];
export const nivelDe = (experiencia) => Math.max(0, NIVELES.indexOf(experiencia || 'ninguna'));
export const NOMBRE_NIVEL = ['Para empezar', 'Desde unos meses entrenando', 'Con un año o más entrenando', 'Con tres años o más entrenando', 'Con cinco años o más entrenando'];
const enGimnasio = (c) => ['gimnasio', 'gimnasio_basico'].includes(c?.lugar || 'gimnasio');

// Cada rutina, con su título y su texto en llano (sin «PHAT» ni «PPL» sin explicar)
export const RUTINAS = FILAS.map(([nombre, imagen, dias, familia, opcion, donde, material, nivel, para]) => {
  const [titulo, texto] = SUELTAS[nombre.replace(/^\d días · /, '')] || FAMILIAS[familia];
  return {
    nombre, imagen, dias, familia, opcion, donde, material, nivel, para,
    titulo: opcion ? `${titulo} · ${OPCIONES[opcion][0]}` : familia === 'novato' ? `Novato, ${dias} días` : titulo,
    texto: opcion ? `${texto} ${OPCIONES[opcion][1]}` : familia === 'novato' && dias === 3 ? `${texto} Con un tercer día de alternativas.` : texto,
  };
});
export const rutinaDe = (nombre) => RUTINAS.find((r) => r.nombre === nombre) || null;
// Las de temporada (unas semanas y volver a la suya) y las que no se eligen (se llega a ellas por su camino)
export const DE_TEMPORADA = ['viaje', 'mantenimiento'];
const NO_ELEGIBLES = ['primeras'];
export const textoDias = (d) => `${d} días a la semana`;
export const textoMaterial = (r) => (r.donde === 'g' ? (r.opcion === 'A' || r.material.includes('barra') ? 'Gimnasio con barra y rack' : 'Gimnasio')
  : r.material.includes('dominadas') ? 'Barra de dominadas y paralelas' : r.material.includes('mancuernas') ? 'Mancuernas y banco' : r.material.includes('gomas') ? 'Gomas' : 'Sin material');

// ---------- «Tus gustos»: lo que se pregunta además del cuestionario, para elegir rutina ----------
// si(c): la pregunta solo se hace con ese cuestionario (a quien nunca ha entrenado no se le pregunta por la barra)
export const GUSTOS = [
  { id: 'ahora', titulo: '¿Entrenas fuerza ahora mismo?', opciones: [['si', 'Sí, con regularidad'], ['poco', 'Lo dejé hace menos de tres meses'], ['parado', 'Llevo más de tres meses sin entrenar']], si: (c) => nivelDe(c?.experiencia) > 0 },
  { id: 'tecnica', titulo: '¿Te manejas con la sentadilla o la prensa, los empujes y los remos?', opciones: [['si', 'Sí, sin problema'], ['algunos', 'Con algunos'], ['no', 'No mucho']], si: (c) => nivelDe(c?.experiencia) > 0 },
  { id: 'barra', titulo: '¿Haces sentadilla, press banca y peso muerto con barra, con buena técnica?', opciones: [['si', 'Sí'], ['no', 'No, o no los hago']], si: (c) => nivelDe(c?.experiencia) > 0 && enGimnasio(c) },
  { id: 'prioridad', titulo: '¿Qué quieres priorizar?', opciones: [['equilibrado', 'Todo por igual'], ['gluteo', 'Glúteo y pierna'], ['torso', 'Torso: pecho, espalda y brazos'], ['fuerza', 'Subir mis marcas en los básicos'], ['salud', 'Salud y encontrarme bien']] },
  { id: 'otro', titulo: '¿Haces otro deporte?', opciones: [['no', 'No'], ['correr', 'Corro'], ['deporte', 'Pádel, fútbol u otro de equipo o de raqueta']] },
  { id: 'mayor', titulo: '¿Tienes 60 años o más?', opciones: [['no', 'No'], ['si', 'Sí']] },
];
export const preguntasGustos = (c = {}) => GUSTOS.filter((p) => !p.si || p.si(c));
// Solo lo que vale (cada respuesta, una de sus opciones; lo demás se quita)
export function limpiarGustos(g, c = {}) {
  const out = {};
  for (const p of preguntasGustos(c)) { const v = g?.[p.id]; if (p.opciones.some(([k]) => k === v)) out[p.id] = v; }
  return out;
}
export const gustosCompletos = (g, c = {}) => preguntasGustos(c).every((p) => g?.[p.id] != null);

// ---------- La criba: ¿necesita «Primeras 4 semanas»? ----------
// Quien nunca ha entrenado fuerza, sí. Y quien lleva menos de un año y lleva más de tres meses parado o no se maneja con
// los movimientos básicos. Los demás van directos a elegir entre sus rutinas recomendadas.
export function necesitaPrimeras({ experiencia = null, gustos = {} } = {}) {
  const n = nivelDe(experiencia);
  if (n === 0) return true;
  return n === 1 && (gustos?.ahora === 'parado' || gustos?.tecnica === 'no');
}

// ---------- El algoritmo: dos o tres rutinas recomendadas, cada una con su porqué ----------
// cuestionario: { experiencia, dias_semana, minutos_sesion, lugar, material, objetivos }; gustos: los de arriba;
// disponibles: los nombres que hay en el catálogo (null: todos); actual: la que lleva ahora (no se recomienda otra vez).
// Devuelve [{ rutina, porque: [frases], nota }] (la primera, la recomendada) y nunca menos de dos.
export function recomendar({ cuestionario: c = {}, gustos: g = {}, disponibles = null, actual = null } = {}) {
  const n = nivelDe(c.experiencia);
  const gym = enGimnasio(c);
  const mat = Array.isArray(c.material) ? c.material : [];
  const objetivos = Array.isArray(c.objetivos) ? c.objetivos : c.objetivo ? [c.objetivo] : [];
  const hay = (r) => !disponibles || disponibles.includes(r.nombre);
  // Nivel con el que se elige: tras un parón largo o sin soltura con los movimientos, uno menos
  const nEfectivo = Math.max(1, n - (g.ahora === 'parado' || g.tecnica === 'no' ? 1 : 0));
  const tope = nEfectivo <= 1 ? 4 : nEfectivo === 2 ? 5 : 6;
  const pedidos = Math.min(Math.max(Math.round(Number(c.dias_semana)) || 3, 2), 6);
  const dias = Math.min(pedidos, tope);
  const conBarra = gym && g.barra === 'si' && n >= 2 && (!mat.length || mat.includes('barra'));
  const puede = (r) => hay(r) && !NO_ELEGIBLES.includes(r.familia) && !DE_TEMPORADA.includes(r.familia) && r.nombre !== actual
    && r.nivel <= nEfectivo && (r.donde === 'g' ? gym && (!r.material.includes('barra') || conBarra) : !gym && r.material.every((m) => mat.includes(m)));
  const DE_SERIE = { 2: 'fullbody', 3: 'fullbody', 4: 'torso_pierna', 5: 'ppl_tp', 6: 'ppl2' };
  const opcion = g.prioridad === 'gluteo' ? 'C' : conBarra && (g.prioridad === 'fuerza' || n >= 3) ? 'A' : 'B';
  const puntos = (r) => {
    const porque = [];
    let p = 0;
    if (r.dias === dias) { p += 6; porque.push(dias === pedidos ? `Son los ${dias} días que tienes` : `Con tu experiencia, mejor ${dias} días que ${pedidos}`); } else p -= 3 * Math.abs(r.dias - dias);
    if (r.opcion && r.opcion === opcion) { p += 3; porque.push(opcion === 'C' ? 'Da prioridad a glúteo y pierna, como pides' : opcion === 'A' ? 'Dominas los básicos con barra' : 'Con máquinas y mancuernas: fácil de progresar'); }
    if (r.familia === DE_SERIE[r.dias]) p += 2;
    // (lo suyo va primero aunque no sea de sus días: quien corre, quien hace otro deporte y quien tiene 60 o más)
    if (g.otro === 'correr' && r.para.includes('correr')) { p += 16; porque.unshift('Pensada para quien corre'); }
    if (g.otro === 'deporte' && r.para.includes('deporte')) { p += 16; porque.unshift('Acompaña a tu otro deporte sin cargarte de más'); }
    if ((g.mayor === 'si' || g.prioridad === 'salud') && r.para.includes('salud')) { p += g.mayor === 'si' ? 16 : 4; porque.unshift(g.mayor === 'si' ? 'Hecha para ganar fuerza con seguridad a partir de los 60' : 'Para ganar fuerza con seguridad'); }
    if (g.prioridad === 'fuerza' && r.para.includes('fuerza')) { p += 4; porque.push('Gira alrededor de tus marcas en los básicos'); }
    const masTorso = ['etp_torso', 'fullbody_torso'].includes(r.familia);
    if (g.prioridad === 'torso' && (masTorso || (r.para.includes('torso') && !r.para.includes('especializacion')))) { p += 3; porque.push('Con algo más de trabajo de torso'); }
    if (g.prioridad === 'gluteo' && masTorso) p -= 3;
    if (g.prioridad === 'gluteo' && r.para.includes('gluteo') && !r.opcion && !r.para.includes('especializacion')) p += 2;
    if (r.para.includes('especializacion')) p -= 6;   // (las especializaciones se eligen a mano, para unas semanas)
    if (r.para.includes('iniciacion') && n >= 2) p -= 5;
    if (r.para.includes('iniciacion') && nEfectivo <= 1 && (g.tecnica === 'no' || g.ahora === 'parado')) { p += 3; porque.push('Para volver a coger el hilo sin prisa'); }
    if (Number(c.minutos_sesion) > 0 && Number(c.minutos_sesion) <= 45 && r.familia === 'density') { p += 2; porque.push('Sesiones más cortas, con descansos breves'); }
    if (!gym) porque.push(r.material.length ? `Con lo que tienes en casa: ${textoMaterial(r).toLowerCase()}` : 'Sin material: en casa o donde estés');
    if (!porque.length) porque.push(objetivos.includes('musculo') ? 'Un reparto equilibrado para ganar músculo' : 'Un reparto equilibrado para tu nivel');
    return { p, porque };
  };
  const todas = RUTINAS.filter(puede).map((r) => ({ rutina: r, ...puntos(r) })).sort((a, b) => b.p - a.p || a.rutina.dias - b.rutina.dias || a.rutina.nombre.localeCompare(b.rutina.nombre));
  // Variedad: no tres veces la misma familia (la misma con otra opción puede ir, una vez)
  const out = [];
  for (const x of todas) {
    if (out.length >= 3) break;
    const misma = out.filter((y) => y.rutina.familia === x.rutina.familia).length;
    if (misma >= (out.length < 2 ? 1 : 2) && todas.some((z) => !out.includes(z) && z.rutina.familia !== x.rutina.familia && z.p > -8)) continue;
    out.push(x);
  }
  // Nunca menos de dos: si no hay más que encajen, las de siempre de su sitio (aunque no sean de sus días)
  if (out.length < 2) {
    const reserva = RUTINAS.filter((r) => hay(r) && r.nombre !== actual && !out.some((y) => y.rutina === r) && !NO_ELEGIBLES.includes(r.familia) && !DE_TEMPORADA.includes(r.familia)
      && (gym ? r.donde === 'g' && !r.material.length && r.nivel <= Math.max(1, nEfectivo) : r.donde === 'c' && !r.material.length))
      .sort((a, b) => Math.abs(a.dias - dias) - Math.abs(b.dias - dias) || a.nivel - b.nivel);
    for (const r of reserva) { if (out.length >= 2) break; out.push({ rutina: r, p: -99, porque: [gym ? 'Una opción segura para tu nivel' : 'Sin material: en casa o donde estés'] }); }
  }
  return out.map(({ rutina, porque }) => ({ rutina, porque: porque.slice(0, 2), nota: rutina.dias !== pedidos ? `Es de ${rutina.dias} días: al elegirla, tus días pasan a ser ${rutina.dias}.` : null }));
}

// ---------- Todo el catálogo: cada rutina con su aviso, si no es para él ----------
// → [{ rutina, aviso }] (aviso null: le encaja). Sin «Primeras 4 semanas» (a esa se llega por la criba).
export function catalogoPara({ cuestionario: c = {}, gustos: g = {}, disponibles = null } = {}) {
  const n = nivelDe(c.experiencia), gym = enGimnasio(c), mat = Array.isArray(c.material) ? c.material : [];
  return RUTINAS.filter((r) => (!disponibles || disponibles.includes(r.nombre)) && !NO_ELEGIBLES.includes(r.familia)).map((r) => {
    const avisos = [];
    if (r.nivel > Math.max(1, n)) avisos.push(`${NOMBRE_NIVEL[r.nivel]}: con menos, mejor una de las recomendadas.`);
    if (r.donde === 'g' && !gym) avisos.push('Es de gimnasio, y dijiste que entrenas en casa.');
    if (r.donde === 'c' && r.material.some((m) => !mat.includes(m)) && !gym) avisos.push(`Pide ${textoMaterial(r).toLowerCase()}.`);
    if (r.material.includes('barra') && gym && g.barra === 'no') avisos.push('Va con barra: sentadilla, press banca y peso muerto. Dijiste que aún no los dominas.');
    if (r.para.includes('especializacion')) avisos.push('Es para unas semanas (6-8), no para todo el año.');
    return { rutina: r, aviso: avisos.length ? avisos.join(' ') : null };
  });
}

// ---------- Cuánto mantenerla ----------
// (Pelayo, 25/11) La misma rutina, al menos 12 semanas; antes, solo si se estanca (tres semanas sin subir: la app le pone
// la descarga y le ofrece elegir la siguiente). semanas: las que lleva con ella.
export const SEMANAS_RUTINA = 12;
export function consejoCambio({ semanas = 0, estancado = false, temporada = false } = {}) {
  if (temporada) return 'Es una rutina de temporada: cuando acabe el viaje o la mala racha, vuelve a la tuya.';
  if (estancado) return 'Llevas tres semanas sin subir en varios ejercicios: buen momento para una semana de descarga y cambiar de rutina.';
  if (semanas >= SEMANAS_RUTINA) return `Llevas ${semanas} semanas con esta rutina: ya puedes cambiar si te apetece.`;
  return `Llevas ${semanas === 1 ? 'una semana' : `${semanas} semanas`} con esta rutina. Lo recomendable es mantenerla al menos ${SEMANAS_RUTINA}: los cambios frecuentes frenan el progreso.`;
}
