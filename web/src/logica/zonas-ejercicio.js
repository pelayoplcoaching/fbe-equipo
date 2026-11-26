// FBE Esencial (v0.257, M8): qué zonas del cuestionario de lesiones carga cada ejercicio y cuánto (2, mucho; 1, algo),
// para el motor de molestias: qué ejercicios no suben con una molestia en ámbar, cuáles se cambian por su alternativa
// en rojo, qué sesiones cargan esa zona (las preguntas de antes y de la mañana siguiente) y en qué orden se ofrecen las
// alternativas (de la que menos carga esa zona a la que más).
// Sale del nombre (el patrón de movimiento, de lo más concreto a lo más general) y, si el nombre no dice nada, de sus
// grupos musculares. Propuesta de Claude para que la revise Pelayo: hasta su visto bueno no manda en nada (el motor de
// progresión sigue con las zonas musculares de siempre).
import { ZONA_DOLOR_IDS } from './dolor.js';

const plano = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Los patrones, en orden: manda el primero que encaja. z: las zonas con su peso; mas: lo que añade una parte del nombre.
// (Las zonas: cuello, hombro, codo, muneca_mano, espalda_alta, zona_lumbar, cadera, rodilla, tobillo_pie. «Otra» no se
// puede asignar a ejercicios.)
export const PATRONES = [
  // ---- Hombro aislado y agarre ----
  { id: 'rotacion', nombre: 'Rotaciones de hombro', re: /rotacion(es)? (externa|interna)/, z: { hombro: 2 },
    porque: 'Cargan directamente el manguito de los rotadores.' },
  { id: 'colgarse', nombre: 'Colgarse de una barra', re: /colgarse|colgado de|dead hang/, z: { hombro: 2, muneca_mano: 2, codo: 1 },
    porque: 'Tracción del hombro por encima de la cabeza y todo el peso en el agarre.' },
  { id: 'granjero', nombre: 'Paseo del granjero', re: /granjero|farmer/, z: { muneca_mano: 2, hombro: 1, espalda_alta: 1, zona_lumbar: 1, cuello: 1 },
    porque: 'Agarre fuerte, trapecios (cuello y espalda alta) y columna en carga.' },
  { id: 'maleta', nombre: 'Paseo de maleta', re: /paseo de maleta|suitcase/, z: { zona_lumbar: 2, muneca_mano: 2, hombro: 1, cadera: 1 },
    porque: 'El peso de un solo lado: la zona lumbar trabaja para no inclinarse.' },
  // ---- Bisagra de cadera y zona lumbar ----
  { id: 'pm-unilateral', nombre: 'Peso muerto a una pierna', re: /peso muerto (unilateral|a una pierna)/, z: { cadera: 2, zona_lumbar: 1, tobillo_pie: 1, muneca_mano: 1 },
    porque: 'Bisagra sobre una pierna: más cadera y equilibrio, menos columna que el de dos piernas.' },
  { id: 'peso-muerto', nombre: 'Peso muerto (convencional, con déficit, con trap bar)', re: /peso muerto|trap bar|deadlift/,
    excepto: /rumano|rdl/, z: { zona_lumbar: 2, cadera: 2, rodilla: 1, espalda_alta: 1, muneca_mano: 1 },
    porque: 'Mucha carga en la columna y la cadera; algo de rodilla al despegar y el agarre.' },
  { id: 'rumano', nombre: 'Peso muerto rumano', re: /rumano|rdl|stiff/, z: { zona_lumbar: 2, cadera: 2, espalda_alta: 1, muneca_mano: 1 },
    porque: 'Bisagra con las piernas casi rectas: columna y cadera, sin apenas rodilla.' },
  { id: 'buenos-dias', nombre: 'Buenos días', re: /buenos dias|good morning/, z: { zona_lumbar: 2, cadera: 2 },
    porque: 'La carga sobre los hombros y la columna inclinada: zona lumbar y cadera.' },
  { id: 'pull-through', nombre: 'Pull through en polea', re: /pull through/, z: { cadera: 2, zona_lumbar: 1 },
    porque: 'Bisagra de cadera con la carga por detrás: menos columna que el peso muerto.' },
  { id: 'hiperextension', nombre: 'Extensiones a 45 grados', re: /extensiones? en banco inclinado|hiperextension|banco romano/, z: { zona_lumbar: 2, cadera: 2 },
    porque: 'Extensión de cadera y de columna con el tronco en el aire.' },
  { id: 'lumbar-maquina', nombre: 'Extensión lumbar en máquina', re: /extension lumbar/, z: { zona_lumbar: 2 },
    porque: 'Trabaja directamente la extensión de la columna.' },
  { id: 'superman', nombre: 'Superman', re: /superman/, z: { zona_lumbar: 2, cadera: 1, cuello: 1 },
    porque: 'Extensión de columna boca abajo, con el cuello también en extensión.' },
  { id: 'bird-dog', nombre: 'Bird dog', re: /bird dog/, z: { zona_lumbar: 1, hombro: 1, muneca_mano: 1, rodilla: 1 },
    porque: 'Estabilidad lumbar suave, apoyado en las manos y las rodillas.' },
  // ---- Cadera ----
  { id: 'hip-thrust', nombre: 'Hip thrust y puentes de glúteo', re: /hip thrust|puente/, z: { cadera: 2, zona_lumbar: 1, rodilla: 1 },
    porque: 'Extensión de cadera; la zona lumbar si se arquea y la rodilla doblada sosteniendo.' },
  { id: 'abduccion', nombre: 'Abducciones y glúteo aislado (almeja, paso lateral, patada)', re: /abduccion|abducciones|almeja|paso lateral|patada de gluteo|clamshell|monster walk/, z: { cadera: 2 },
    porque: 'Glúteo medio y extensores de cadera, sin carga en la columna.' },
  { id: 'copenhague', nombre: 'Aducción Copenhague', re: /copenhague|copenhagen/, z: { cadera: 2, rodilla: 1, hombro: 1 },
    porque: 'Aductores en plancha lateral: la ingle, el apoyo de la rodilla y el del hombro.' },
  { id: 'aductor', nombre: 'Aductor en máquina', re: /aductor|aduccion|aducciones/, z: { cadera: 2 },
    porque: 'Aductores: la ingle y la cadera.' },
  // ---- Rodilla ----
  { id: 'extension-rodilla', nombre: 'Extensión de rodilla (leg extension, nórdico inverso)', re: /leg extension|extension de (rodilla|cuadriceps)|nordico inverso|sissy/, z: { rodilla: 2 },
    porque: 'Toda la carga en la rodilla (el tendón rotuliano).' },
  { id: 'curl-femoral', nombre: 'Curl femoral (máquina, goma, deslizante)', re: /leg curl|curl de isquios|curl femoral/, z: { rodilla: 2 },
    mas: [[/deslizante/, { cadera: 1 }]], porque: 'Flexión de rodilla con carga; el deslizante, además, con la cadera estirada.' },
  { id: 'nordico', nombre: 'Curl nórdico y glute-ham', re: /nordico|nordic|glute.?ham/, z: { rodilla: 2, cadera: 1 },
    porque: 'Isquios muy cargados al estirarse, desde la rodilla hasta la cadera.' },
  { id: 'espanola', nombre: 'Sentadilla española', re: /sentadilla espanola|spanish squat/, z: { rodilla: 2, cadera: 1 },
    porque: 'Sentadilla con la goma detrás de las rodillas: muy de rodilla.' },
  { id: 'isometrica', nombre: 'Sentadilla isométrica en pared', re: /isometrica en pared|wall sit|sentadilla isometrica/, z: { rodilla: 2, cadera: 1 },
    porque: 'Rodilla doblada sosteniendo el peso del cuerpo.' },
  // ---- Pantorrilla y pie ----
  { id: 'tibial', nombre: 'Elevación de puntas (tibial)', re: /puntas|tibial/, z: { tobillo_pie: 2 },
    porque: 'El tibial anterior: tobillo y pie.' },
  { id: 'gemelo', nombre: 'Gemelo y sóleo', re: /gemelo|talones|soleo|calf/, excepto: /sentadilla|squat/, z: { tobillo_pie: 2 },
    mas: [[/de pie en maquina|en maquina de pie|burro/, { zona_lumbar: 1 }]], porque: 'Tendón de Aquiles y pie; de pie en máquina o tipo burro, la carga pasa por la columna.' },
  // ---- Sentadillas y prensas ----
  { id: 'prensa', nombre: 'Prensa de piernas', re: /prensa|leg press/, z: { rodilla: 2, cadera: 2, zona_lumbar: 1 },
    porque: 'Rodilla y cadera; abajo del todo, la pelvis puede despegar y cargar la zona lumbar.' },
  { id: 'hack', nombre: 'Hack squat, péndulo y belt squat', re: /hack|pendulum|pendulo|belt squat/, z: { rodilla: 2, cadera: 2, tobillo_pie: 1, zona_lumbar: 1 },
    porque: 'Sentadilla guiada: rodilla y cadera, con algo de columna por las hombreras (el belt squat, no).' },
  { id: 'unilateral', nombre: 'Pierna a pierna (búlgara, zancadas, step up, pistol, cosaca)', re: /bulgara|split squat|zancada|lunge|step.?(up|down)|pistol|a una pierna al banco|cosaca|subida(s)? al (banco|cajon)/, z: { rodilla: 2, cadera: 2, tobillo_pie: 1 },
    porque: 'Rodilla y cadera de una pierna, y el tobillo para el equilibrio.' },
  { id: 'sentadilla-barra', nombre: 'Sentadilla con barra (alta, baja, frontal, multipower)', re: /sentadilla (barra|con barra|en multipower|frontal)|back squat|front squat/, z: { rodilla: 2, cadera: 2, zona_lumbar: 1, tobillo_pie: 1 },
    mas: [[/barra baja/, { hombro: 1, codo: 1, espalda_alta: 1 }], [/frontal/, { muneca_mano: 1, espalda_alta: 1 }], [/barra alta|multipower/, { cuello: 1 }]],
    porque: 'Rodilla y cadera con la columna en carga. Barra baja: hombro, codo y espalda alta por cómo se sujeta; frontal: muñecas; alta o multipower: la barra sobre los trapecios.' },
  { id: 'sentadilla', nombre: 'Sentadilla sin barra (goblet, sin peso, con goma, sumo)', re: /sentadilla|squat/, z: { rodilla: 2, cadera: 2, tobillo_pie: 1 },
    porque: 'Rodilla y cadera, y el tobillo al bajar.' },
  // ---- Empuje ----
  { id: 'press-vertical', nombre: 'Press militar y flexiones en pica', re: /press militar|press de hombros?|press arnold|overhead press|flexiones en pica|pike/, z: { hombro: 2, codo: 1, muneca_mano: 1 },
    mas: [[/^(?!.*(sentado|maquina|multipower|banco|pica|pike))/, { zona_lumbar: 1 }], [/pica|pike/, { muneca_mano: 2 }]],
    porque: 'Hombro por encima de la cabeza y codo; de pie (sin máquina ni banco), la zona lumbar para no arquearse; en pica, las muñecas en el suelo.' },
  { id: 'fondos', nombre: 'Fondos en paralelas', re: /fondos/, z: { hombro: 2, codo: 2, muneca_mano: 1 },
    porque: 'Hombro muy estirado por delante al bajar y codo muy cargado.' },
  { id: 'flexiones', nombre: 'Flexiones', re: /flexion(es)?( |$)|push.?up/, z: { hombro: 2, codo: 1, muneca_mano: 2 },
    mas: [[/diamante/, { codo: 2 }]], porque: 'Hombro y codo, con las muñecas dobladas en el suelo (las diamante, más codo).' },
  { id: 'press-horizontal', nombre: 'Press de banca y de pecho', re: /press (banca|inclinado|plano|de pecho|declinado|pecho)|floor press|bench press|pecho en maquina/, excepto: /jalon|remo/, z: { hombro: 2, codo: 1, muneca_mano: 1 },
    mas: [[/agarre cerrado|agarre estrecho/, { codo: 2 }]], menos: [[/floor press/, { hombro: 1 }]],
    porque: 'Hombro por delante y codo; con agarre cerrado, más codo; en el suelo (floor press), menos recorrido de hombro.' },
  { id: 'posterior', nombre: 'Deltoides posterior (pájaros, face pull, pull apart)', re: /pajaros|face pull|pull apart|contractora invertida|delt\.? post|deltoides posterior|reverse fly/, z: { hombro: 1, espalda_alta: 1 },
    porque: 'Parte de atrás del hombro y escápulas, con poca carga.' },
  { id: 'aperturas', nombre: 'Aperturas y cruces', re: /apertura|cruce|pec.?fly|pec.?deck|contractora|\bfly\b/, z: { hombro: 2, codo: 1 },
    porque: 'Hombro estirado por delante con el brazo largo; algo de codo.' },
  { id: 'laterales', nombre: 'Elevaciones laterales y en Y', re: /elevacion(es)? (lateral|laterales|en y)|laterales|egipcias|y.?raise/, excepto: /inclinacion/, z: { hombro: 2 },
    mas: [[/en y|y.?raise/, { espalda_alta: 1 }]], porque: 'El supraespinoso, el músculo del hombro que más se queja; en Y, también la escápula.' },
  // ---- Tirón ----
  { id: 'dominadas', nombre: 'Dominadas', re: /dominada|pull.?up|chin.?up/, z: { hombro: 2, codo: 2, muneca_mano: 1, espalda_alta: 1 },
    porque: 'Hombro por encima de la cabeza y todo el peso del cuerpo en los codos y el agarre.' },
  { id: 'jalon', nombre: 'Jalones', re: /jalon|pulldown/, z: { hombro: 2, codo: 1, muneca_mano: 1, espalda_alta: 1 },
    porque: 'Hombro por encima de la cabeza; codo y agarre, con menos peso que la dominada.' },
  { id: 'pullover', nombre: 'Pullover', re: /pull ?over/, z: { hombro: 2, codo: 1, espalda_alta: 1 },
    porque: 'Hombro estirado por encima de la cabeza con carga.' },
  { id: 'remo-libre', nombre: 'Remo inclinado sin apoyo (con barra, Pendlay, en T)', re: /remo (con barra|pendlay|en t( |$)|yates|inclinado con barra)/, z: { espalda_alta: 2, zona_lumbar: 2, codo: 1, muneca_mano: 1, hombro: 1 },
    porque: 'Espalda alta y, para sostener el tronco inclinado sin apoyo, mucha zona lumbar.' },
  { id: 'remo-mancuerna', nombre: 'Remo con mancuerna a una mano', re: /remo con mancuerna|remo a una mano/, excepto: /apoyado|apoyo en el pecho|banco inclinado/, z: { espalda_alta: 2, codo: 1, muneca_mano: 1, hombro: 1, zona_lumbar: 1 },
    porque: 'Espalda alta, con una mano en el banco: algo de zona lumbar.' },
  { id: 'remo-invertido', nombre: 'Remo invertido', re: /remo invertido|australiano|inverted row/, z: { espalda_alta: 2, hombro: 1, codo: 1, muneca_mano: 1 },
    porque: 'Espalda alta con el peso del cuerpo, tronco recto como en una plancha.' },
  { id: 'remo', nombre: 'Remo con apoyo (máquina, polea, goma)', re: /remo/, z: { espalda_alta: 2, codo: 1, muneca_mano: 1, hombro: 1 },
    mas: [[/gironda|polea baja|sentado/, { zona_lumbar: 1 }]], porque: 'Espalda alta, codo y agarre; sentado en polea, algo de zona lumbar si se balancea.' },
  // ---- Brazos ----
  { id: 'curl', nombre: 'Curl de bíceps', re: /curl/, z: { codo: 2, muneca_mano: 1 },
    mas: [[/bayesian|banco inclinado|inclinado/, { hombro: 1 }], [/inverso/, { muneca_mano: 2 }]],
    porque: 'Codo (el tendón del bíceps) y muñeca; bayesian e inclinado, además el hombro estirado; el inverso, más muñeca (los extensores, los del codo de tenista).' },
  { id: 'triceps', nombre: 'Extensiones de tríceps y press francés', re: /triceps|press frances|katana|trasnuca|extensiones? desde polea|skull/, z: { codo: 2, muneca_mano: 1 },
    mas: [[/trasnuca|katana|frances/, { hombro: 1 }]], porque: 'Codo (el tendón del tríceps); por encima de la cabeza o tumbado, además el hombro.' },
  // ---- Core ----
  { id: 'rueda', nombre: 'Rueda abdominal', re: /ab wheel|rueda abdominal|rollout/, z: { zona_lumbar: 2, hombro: 1, muneca_mano: 1, rodilla: 1 },
    porque: 'Mucha antiextensión lumbar, con hombros, muñecas y, de rodillas, las rodillas.' },
  { id: 'colgado-piernas', nombre: 'Elevaciones de piernas colgado o en paralelas', re: /hanging|en paralelas|l.?sit/, z: { zona_lumbar: 1, cadera: 1, hombro: 1, muneca_mano: 1 },
    mas: [[/paralelas|l.?sit/, { codo: 1 }]], porque: 'Flexores de cadera y abdomen, colgado del agarre o apoyado en los brazos.' },
  { id: 'elevacion-piernas', nombre: 'Elevaciones de piernas tumbado', re: /leg raise|elevacion(es)? de piernas/, z: { zona_lumbar: 1, cadera: 1 },
    porque: 'Flexores de cadera; la zona lumbar si se despega del banco.' },
  { id: 'crunch', nombre: 'Crunch', re: /crunch|sit.?up/, z: { zona_lumbar: 1 },
    mas: [[/tumbado/, { cuello: 1 }]], porque: 'Flexión de columna; tumbado, el cuello si se tira de la cabeza.' },
  { id: 'plancha', nombre: 'Planchas', re: /plancha|plank/, z: { zona_lumbar: 1, hombro: 1 },
    mas: [[/toque de hombros|manos/, { muneca_mano: 1 }]], porque: 'Estabilidad lumbar apoyado en los antebrazos o en las manos.' },
  { id: 'inclinacion-lateral', nombre: 'Inclinaciones laterales con peso', re: /inclinacion(es)? lateral|flexion lateral|side bend/, z: { zona_lumbar: 2, muneca_mano: 1 },
    porque: 'Flexión lateral de la columna con carga.' },
  { id: 'antirrotacion', nombre: 'Antirrotación (press Pallof, leñador)', re: /pallof|lenador|woodchop/, z: { zona_lumbar: 1 },
    mas: [[/lenador|woodchop/, { hombro: 1 }]], porque: 'Estabilidad lumbar frente a un giro, con poca carga.' },
  { id: 'dead-bug', nombre: 'Dead bug y hollow', re: /dead bug|hollow/, z: { zona_lumbar: 1 },
    porque: 'Estabilidad lumbar tumbado, sin carga.' },
];

// Lo que añade una postura, sea el ejercicio que sea: de rodillas, la rodilla; en cuadrupedia, también las muñecas.
const POSTURA = [[/arrodillado|de rodillas|rodillas apoyadas|rodilla apoyada|cuadrupedia/, { rodilla: 1 }], [/cuadrupedia/, { muneca_mano: 1 }]];

// Si el nombre no encaja en ningún patrón: por sus grupos musculares (el principal, su zona; los secundarios, 1).
const POR_GRUPO = {
  cuadriceps: { rodilla: 2, cadera: 1 }, gluteo: { cadera: 2 }, isquiotibiales: { rodilla: 1, cadera: 1 }, aductores: { cadera: 2 },
  gemelo: { tobillo_pie: 2 }, pectoral: { hombro: 2, codo: 1 }, deltoides: { hombro: 2 }, espalda: { espalda_alta: 2, hombro: 1, codo: 1 },
  biceps: { codo: 2 }, triceps: { codo: 2 }, antebrazo: { muneca_mano: 2, codo: 1 }, abdominales: { zona_lumbar: 1 }, lumbares: { zona_lumbar: 2 },
};
const SECUNDARIO = {
  cuadriceps: 'rodilla', gluteo: 'cadera', isquiotibiales: 'cadera', aductores: 'cadera', gemelo: 'tobillo_pie', pectoral: 'hombro',
  deltoides: 'hombro', espalda: 'espalda_alta', biceps: 'codo', triceps: 'codo', antebrazo: 'muneca_mano', abdominales: 'zona_lumbar', lumbares: 'zona_lumbar',
};

const subir = (z, mas) => { for (const [k, v] of Object.entries(mas)) z[k] = Math.max(z[k] || 0, v); };
const bajar = (z, menos) => { for (const [k, v] of Object.entries(menos)) if (z[k] != null) z[k] = Math.min(z[k], v); };

export function patronDe(ejercicio) {
  const n = plano(typeof ejercicio === 'string' ? ejercicio : ejercicio?.nombre);
  if (!n) return null;
  return PATRONES.find((p) => p.re.test(n) && !(p.excepto && p.excepto.test(n))) || null;
}

// { zona: 1 | 2 } de un ejercicio ({ nombre, grupos_musculares }). Nunca «otra».
export function zonasDe(ejercicio) {
  const n = plano(typeof ejercicio === 'string' ? ejercicio : ejercicio?.nombre);
  const p = patronDe(n);
  const z = {};
  if (p) {
    subir(z, p.z);
    for (const [re, mas] of p.mas || []) if (re.test(n)) subir(z, mas);
    for (const [re, menos] of p.menos || []) if (re.test(n)) bajar(z, menos);
  } else {
    const grupos = (typeof ejercicio === 'object' && ejercicio?.grupos_musculares) || [];
    if (POR_GRUPO[grupos[0]]) subir(z, POR_GRUPO[grupos[0]]);
    for (const g of grupos.slice(1)) if (SECUNDARIO[g]) subir(z, { [SECUNDARIO[g]]: 1 });
  }
  for (const [re, mas] of POSTURA) if (re.test(n)) subir(z, mas);
  for (const k of Object.keys(z)) if (!ZONA_DOLOR_IDS.includes(k) || k === 'otra' || !z[k]) delete z[k];
  return z;
}

// Cuánto carga un ejercicio esa zona: 0 (nada), 1 (algo) o 2 (mucho)
export const cargaDe = (zona, ejercicio) => zonasDe(ejercicio)[zona] || 0;

// Las alternativas de un ejercicio, de la que menos carga esa zona a la que más (a igualdad, en su orden de siempre)
export function ordenarAlternativas(zona, alternativas = []) {
  return alternativas.map((a, i) => ({ a, i, c: cargaDe(zona, a) })).sort((x, y) => x.c - y.c || x.i - y.i).map((x) => x.a);
}
