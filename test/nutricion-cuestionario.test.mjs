// Motor de nutrición (v0.252, N2): el cuestionario de nutrición por pasos (logica/nutricion-cuestionario.js): los pasos,
// lo que se rellena solo, lo que falta en cada paso, la salud que ve el motor (con y sin «salud_comida»), lo que se manda
// a la base (y que la demo lo calcula igual que la vista previa) y los textos de rehacerlo y de la meta.
//   node test/nutricion-cuestionario.test.mjs
import { readFileSync } from 'node:fs';
import * as C from '../web/src/logica/nutricion-cuestionario.js';
import * as M from '../web/src/logica/nutricion-motor.js';
import { planMotorDemo } from '../web/src/datos/semilla-esencial.js';
import * as N from '../web/src/datos/api-nutricion.js';
import { sumarDias } from '../web/src/logica/fechas.js';
import { fmtKcal } from '../web/src/logica/nutricion.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const hoy = '2026-11-26';

console.log('Los pasos');
const p0 = C.pasosNutricion(false).map(([k]) => k), p1 = C.pasosNutricion(true).map(([k]) => k);
check(p0.join() === 'tu,salud,medidas,dia,objetivo,comer,plan' && p1.join() === 'tu,salud,scoff,medidas,dia,objetivo,comer,plan',
  'siete pasos; con las preguntas de salud nuevas, ocho (el SCOFF, tras «Tu salud»)');
check(C.experienciaDe('ninguna') === 'novato' && C.experienciaDe('menos_1') === 'novato' && C.experienciaDe('1_3') === 'intermedio'
  && C.experienciaDe('3_5') === 'avanzado' && C.experienciaDe('mas_5') === 'avanzado' && C.experienciaDe(null) === null, 'su experiencia, de la del cuestionario de entreno');
check(C.saludPara('hombre').map(([k]) => k).join() === 'renal,insulina,bariatrica' && C.saludPara('mujer').length === 5, 'embarazo y lactancia, solo a mujeres');

console.log('\nLo que se rellena solo');
const vacio = C.inicialNutricion({ hoy });
check(vacio.sexo === null && vacio.cintura === null && vacio.tomas === 4 && vacio.formaComer === 'omnivora' && vacio.bebidasSemana === 0 && vacio.ritmo === -0.5
  && vacio.experiencia === 'intermedio' && vacio.tca === null && vacio.excl === null, 'sin nada: lo de partida (4 comidas, como de todo, 0 bebidas, −0,5 %)');
const cu = { dias_semana: 3, experiencia: 'menos_1', tca: false, otras: ['medicacion'] };
const med = [{ fecha: sumarDias(hoy, -20), cintura_cm: 90 }, { fecha: sumarDias(hoy, -3), cintura_cm: 86.5, cadera_cm: 101 }];
const i1 = C.inicialNutricion({ cuestionario: cu, pesoKg: 68.44, medidas: med, hoy });
check(i1.diasEntreno === 3 && i1.experiencia === 'novato' && i1.tca === false && i1.peso === 68.4 && i1.cintura === 86.5 && i1.cadera === 101,
  'de su cuestionario de entreno (días, experiencia, TCA), su último peso y su cintura de hace 3 días');
check(C.inicialNutricion({ medidas: [{ fecha: sumarDias(hoy, -8), cintura_cm: 86 }], hoy }).cintura === null, 'una cintura de hace 8 días no se rellena (que se vuelva a medir)');
const pf = { sexo: 'mujer', anio_nacimiento: 1990, altura: 168, trabajo: 'de_pie', pasos: 7500, dias_entreno: 4, objetivo: 'perder', ritmo_pct: -0.25, experiencia: null,
  meta_peso: 62, meta_cintura: null, forma_comer: 'vegetariana', tomas: 3, bebidas_semana: 2, pocos_hidratos: false, alimentos_si: ['pollo'], alimentos_no: [] };
const i2 = C.inicialNutricion({ perfil: pf, cuestionario: { ...cu, nutricion_salud: { renal: false, lactancia: true, scoff: { control: true } } }, hoy });
check(i2.edad === 36 && i2.altura === 168 && i2.diasEntreno === 4 && i2.ritmo === -0.25 && i2.meta === 'peso' && i2.metaPeso === 62 && i2.formaComer === 'vegetariana'
  && i2.tomas === 3 && i2.excl.join() === 'lactancia' && i2.scoff.control === true && i2.scoff.vomito === null, 'con su perfil: lo que contestó la última vez (y su salud, si la contestó)');

console.log('\nLa salud que ve el motor');
const base = { sexo: 'mujer', edad: 36, altura: 168, peso: 68.4, tca: false, excl: null, scoff: {} };
check(C.saludEfectiva(base, { cuestionario: { otras: ['embarazo'] } }).embarazo === true && C.saludEfectiva({ ...base, sexo: 'hombre' }, { cuestionario: { otras: ['embarazo'] } }).embarazo === false,
  'apagado: el embarazo de su cuestionario de entreno (solo en mujeres)');
check(C.exclusionNutricion(base, { cuestionario: { otras: ['embarazo'] } }) === 'embarazo' && C.exclusionNutricion({ ...base, peso: 50 }, {}) === 'imc_bajo'
  && C.exclusionNutricion(base, {}) === null, 'sin plan automático: embarazada (de su cuestionario) o con un IMC por debajo de 18,5; si no, nada');
check(C.exclusionNutricion({ ...base, excl: ['renal'] }, { conSalud: true }) === 'renal' && C.exclusionNutricion({ ...base, excl: ['renal'] }, { conSalud: false }) === null,
  'encendido: lo que marca en este cuestionario; apagado, no se le pregunta');
check(C.exclusionNutricion(base, { conSalud: false, cuestionario: { nutricion_salud: { bariatrica: true } } }) === 'bariatrica', 'apagado: lo de salud que ya contestó sigue contando');
const s2 = { vomito: false, control: true, perdida: false, gordura: false, domina: true };
check(C.soloMantener({ ...base, tca: true }) && C.soloMantener({ ...base, scoff: s2 }, { conSalud: true }) && !C.soloMantener({ ...base, scoff: { ...s2, domina: false } }, { conSalud: true })
  && C.soloMantener(base, { cuestionario: { nutricion_salud: { scoff: s2 } } }), 'solo mantener: con antecedente de TCA o con 2 «sí» en el SCOFF (también el que ya contestó)');

console.log('\nLo que falta en cada paso');
const lleno = { ...base, cintura: 84, cadera: null, trabajo: 'sentado', pasos: 0, diasEntreno: 2, objetivo: 'perder', ritmo: -0.5, meta: null, tomas: 4, bebidasSemana: 0, composicionMetodo: null };
const falta = (k, d, o) => C.faltaEnPaso(k, d, o);
check(/sexo/.test(falta('tu', { ...lleno, sexo: null })) && /edad/.test(falta('tu', { ...lleno, edad: 17 })) && falta('tu', lleno) === null, 'Tú: sexo, edad (18 a 90), altura y peso');
check(/trastorno/.test(falta('salud', { ...lleno, tca: null })) && falta('salud', lleno) === null && /Ninguna de estas/.test(falta('salud', lleno, { conSalud: true }))
  && falta('salud', { ...lleno, excl: [] }, { conSalud: true }) === null, 'Tu salud: la pregunta de TCA y, encendido, lo de la lista (o «Ninguna de estas»)');
check(/cinco/.test(falta('scoff', { ...lleno, scoff: { ...s2, vomito: null } })) && falta('scoff', { ...lleno, scoff: s2 }) === null, 'el SCOFF: las cinco');
check(/cintura/.test(falta('medidas', { ...lleno, cintura: null })) && /cadera/.test(falta('medidas', { ...lleno, cadera: 30 })) && /grasa/.test(falta('medidas', { ...lleno, composicionGrasa: 80 }))
  && /masa magra/.test(falta('medidas', { ...lleno, composicionMetodo: 'dexa', masaMagraDexa: 70 })) && falta('medidas', { ...lleno, composicionMetodo: 'dexa', masaMagraDexa: 48 }) === null,
'Tus medidas: la cintura; la cadera y la composición, opcionales pero con sentido (la masa magra, menos que su peso)');
check(falta('dia', lleno) === null && /pasos/.test(falta('dia', { ...lleno, pasos: null })) && /trabajo/.test(falta('dia', { ...lleno, trabajo: 'x' })), 'Tu día: trabajo y pasos (menos de 5.000 vale: es el 0)');
check(/objetivo/.test(falta('objetivo', { ...lleno, objetivo: null })) && falta('objetivo', { ...lleno, objetivo: null, tca: true }) === null
  && /peso al que/.test(falta('objetivo', { ...lleno, meta: 'peso', metaPeso: null })), 'Tu objetivo (con TCA no se pregunta: solo mantener) y la meta, si la pone');
check(/comidas/.test(falta('comer', { ...lleno, tomas: 6 })) && falta('comer', lleno) === null, 'Cómo comes: 3 a 5 comidas');

console.log('\nEl ritmo, la vista previa y lo que se manda');
check(C.ritmosPerder(lleno).map((x) => x.r).join() === '-0.25,-0.5,-0.75' && C.ritmosPerder(lleno).find((x) => x.recomendado).gramos === 340
  && C.ritmosPerder({ ...lleno, peso: 95, altura: 170 }).length === 4, 'perder: tres ritmos (−1 % solo con IMC por encima de 30); −0,5 % con 68,4 kg, unos 340 g a la semana');
const env = C.paraEnviar({ ...lleno, objetivo: 'ganar', ritmo: -0.5, experiencia: 'novato', meta: 'cintura', metaCintura: 80, composicionMetodo: 'bioimpedancia', composicionGrasa: 24 });
check(env.ritmo === null && env.experiencia === 'novato' && env.metaPeso === null && env.metaCintura === 80 && env.masaMagraDexa === null && env.composicionGrasa === 24 && env.salud === null,
  'a la base: el ritmo solo al perder, la experiencia solo al ganar, la meta que eligió y, apagado, la salud a null');
const envS = C.paraEnviar({ ...lleno, excl: ['renal'], scoff: s2 }, { conSalud: true });
check(envS.salud.renal === true && envS.salud.embarazo === false && envS.salud.scoff.domina === true, 'encendido: su salud, con el SCOFF');
const envB = C.paraEnviar(lleno, { basico: true });
check(Object.keys(envB).sort().join() === 'altura,edad,peso,salud,sexo,tca', 'para una exclusión, solo lo básico');
check(C.paraEnviar({ ...lleno, tca: true }).objetivo === 'mantener' && C.datosParaMotor({ ...lleno, tca: true }).objetivo === 'mantener', 'con antecedente de TCA, el objetivo va como «mantener»');

// La demo (como la base) calcula lo mismo que la vista previa, con lo que manda api-nutricion
const atletaId = 'a1';
const db = { atletas: [{ id: atletaId, modalidad: 'por_su_cuenta', estado: 'activo', nutricion: true }], cuestionarios: [{ atleta_id: atletaId, tca: false, otras: [] }],
  nutricion_perfiles: [], pesos: [], medidas: [], planes_nutricion: [] };
const t = (n) => (db[n] ||= []);
let k = 0;
const b = { rpc: async (nombre, args) => planMotorDemo(t, { p: args.p, atletaId, hoy, uuid: () => `id-${++k}`, ahoraISO: `${hoy}T10:00:00Z` }) };
let iguales = 0, total = 0, ejemplo = '';
for (const d of [lleno, { ...lleno, sexo: 'hombre', peso: 92, altura: 178, cintura: 101, objetivo: 'ganar', experiencia: 'avanzado' },
  { ...lleno, objetivo: 'mantener', pasos: 10000, diasEntreno: 5, trabajo: 'fisico', bebidasSemana: 7, tomas: 5 },
  { ...lleno, objetivo: 'perder', ritmo: -0.75, composicionMetodo: 'dexa', masaMagraDexa: 48, pocosHidratos: true },
  { ...lleno, tca: true }]) {
  total++;
  const vista = M.planMotor(C.datosParaMotor(d));
  const guardado = await N.planMotor(b, C.paraEnviar(d));
  const mismo = ['kcal', 'proteina_g', 'carbos_g', 'grasa_g', 'mantenimiento', 'objetivo'].every((x) => vista[x] === guardado[x]);
  if (mismo) iguales++; else ejemplo = JSON.stringify({ vista: [vista.kcal, vista.proteina_g, vista.objetivo], guardado: [guardado.kcal, guardado.proteina_g, guardado.objetivo] });
}
check(iguales === total, `la vista previa y lo que guarda la demo, igual en ${total} casos${ejemplo ? `: ${ejemplo}` : ''}`);
const per = db.nutricion_perfiles[0];
check(per && per.dias_entreno === 2 && per.ritmo_pct === null && per.pasos === 0, 'y el perfil, con sus días de entreno (dias_entreno), sin ritmo si no pierde');

console.log('\nRehacerlo y la meta');
check(C.cambioDePlan({ kcal: 1800, proteina_g: 130 }, { kcal: 1650, proteina_g: 140 }) === `Pasas de ${fmtKcal(1800)} a ${fmtKcal(1650)} kcal al día y de 130 a 140 g de proteína. Tu plan nuevo empieza hoy y la app lo revisa cada 4 semanas.`
  && /se quedan en/.test(C.cambioDePlan({ kcal: 1800, proteina_g: 130 }, { kcal: 1800, proteina_g: 130 })), 'qué cambia al rehacerlo (y que se revisa cada 4 semanas, no cada semana)');
const m = M.metaPeso({ peso: 68.4, meta: 62, altura: 168, ritmo: -0.5 });
check(/a unas \d+ semanas/.test(C.textoMeta(m, { meta: 62, peso: 68.4 })) && /IMC de 20/.test(C.textoMeta(M.metaPeso({ peso: 68.4, meta: 50, altura: 168, ritmo: -0.5 }), { meta: 50 }))
  && /dirección/.test(C.textoMeta(M.metaPeso({ peso: 68.4, meta: 75, altura: 168, ritmo: -0.5 }), { meta: 75, peso: 68.4 })), 'la meta: cuántas semanas a su ritmo, o el aviso (IMC por debajo de 20, o al revés de su objetivo)');

console.log('\nEn Hoy, con un plan del motor');
const { porQueNoCambia, comidaDeLaSemana } = await import('../web/src/logica/esencial-comida.js');
const pm = { modo: 'macros', kcal: 1750, proteina_g: 145, desde: sumarDias(hoy, -10), mantenimiento: 2160, ritmo_pct: -0.5 };
const pq = porQueNoCambia({ plan: pm, gasto: null }, { hoy });
check(pq?.clave === 'motor' && /cada 4 semanas, no cada semana/.test(pq.texto) && /el 14\/12/.test(pq.texto), '«¿Por qué no cambia?»: se revisa cada 4 semanas (la próxima, a los 28 días: el 14/12), no cada semana');
check(porQueNoCambia({ plan: pm }, { hoy, tca: true }).clave === 'tca' && porQueNoCambia({ plan: { ...pm, mantenimiento: null, desde: sumarDias(hoy, -3) } }, { hoy }).clave === 'nuevo',
  'con antecedente de TCA, que no baja nunca; un plan de la 093, lo de siempre (cada semana)');
check(comidaDeLaSemana({ plan: pm, planes: [pm] }, { hoy }).lineas.some((x) => x.k === 'motor'), 'y lo mismo en «Tu comida esta semana»');

console.log('\nLa privacidad (2026-12.43, solo con la 105)');
const legal = await import('../web/src/legal.js');
const PN = await import('../web/src/logica/privacidad-novedades.js');
const sec = legal.PRIVACIDAD.find((x) => x[0] === 'FBE Esencial con nutrición: tu cuestionario de nutrición')?.[1] || '';
check(legal.VERSION_LEGAL_SIN_107 === '2026-12.43' && legal.VERSION_LEGAL_SIN_105 === '2026-12.42' && PN.NOVEDADES_PRIVACIDAD[1][3] === '2026-12.43' && PN.NOVEDADES_PRIVACIDAD[1][2].length <= 260
  && PN.novedadesDesde('2026-12.42', '2026-12.43').length === 1, 'la versión 2026-12.43 (sin la 105, la 2026-12.42; v0.254: la de antes de la 107) y su novedad, corta');
check(/tu cintura/.test(sec) && /año de nacimiento/.test(sec) && /cada 4 semanas/.test(sec) && /1\.500 kcal en mujeres/.test(sec) && /25 %/.test(sec) && /consentimiento/.test(sec)
  && /cinco preguntas/.test(sec) && /Descargar mis datos/.test(sec), 'su sección cuenta lo que se guarda, la revisión de cada 4 semanas con sus límites y las preguntas de salud (con el consentimiento)');
const aviso = readFileSync(new URL('../web/src/ui/AvisoPrivacidad.jsx', import.meta.url), 'utf8');
const priv = readFileSync(new URL('../web/src/logica/privacidad.js', import.meta.url), 'utf8');
check(/import\('\.\.\/logica\/privacidad-novedades\.js'\)/.test(aviso) && !/NOVEDADES_PRIVACIDAD = \[/.test(priv) && !/from '\.\/privacidad-novedades\.js'/.test(priv),
  'la lista de novedades, fuera de lo que se carga al abrir: la pide el aviso cuando sale (privacidad.js no la importa)');
const apiSrc = readFileSync(new URL('../web/src/datos/api.js', import.meta.url), 'utf8');
check(/'esencial_notas', 'nutricion_perfiles', 'nutricion_revisiones', 'medicacion_atleta'\]\) out\[t\]/.test(apiSrc) && /VERSION_LEGAL_SIN_105/.test(apiSrc), 'su perfil de nutrición va en «Descargar mis datos»; la versión, según esté la 105');

console.log('\nLos estilos');
const css = readFileSync(new URL('../web/src/nutricion-motor.css', import.meta.url), 'utf8');
check(/^[\x00-\x7F]*$/.test(css) && !/margin|font-size|font-weight/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')) && (css.match(/^\.([a-z0-9-]+)/gm) || []).every((x) => /^\.nm-/.test(x)),
  'nutricion-motor.css: ASCII, sin márgenes ni tamaños de letra y solo clases nm-*');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
