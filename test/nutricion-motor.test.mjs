// Motor de nutrición (v0.252, N1): las reglas R1-R37 de «claude/nutricion-motor-reglas.md» (respuestas de Pelayo del
// 26/11/2026), con números a mano: el gasto (Mifflin o Cunningham por el factor de trabajo, pasos y entreno), los suelos de
// 1.500 y 1.800 kcal y el 25 % (la 14), el caso en que el suelo llega al mantenimiento, la proteína de la calculadora (con
// 40 años, la mitad alta) sobre el peso de referencia, la grasa entre el 20 y el 35 %, los 130 g de hidratos, la seguridad
// (exclusiones y SCOFF), la meta y la revisión de cada 4 semanas (adherencia, ritmo real, cintura, fuerza y topes).
import { readFileSync } from 'node:fs';
import * as M from '../web/src/logica/nutricion-motor.js';
import { sumarDias } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('El cuerpo y el gasto (R4, R8, R9)');
check(M.imcDe(75, 165) === 27.5 && M.cinturaAltura(88, 165) === 0.53, 'IMC y cintura/altura');
check(M.rfm({ sexo: 'mujer', altura: 165, cintura: 88 }) === 38.5 && M.rfm({ sexo: 'hombre', altura: 180, cintura: 90 }) === 24 && M.rfm({ sexo: 'x', altura: 1, cintura: 1 }) === null,
  'RFM (Woolcott): 64 − 20 × altura/cintura, + 12 en mujeres');
check(igual(M.reposo({ sexo: 'mujer', edad: 45, altura: 165, peso: 75 }), { kcal: 1395, formula: 'mifflin' }), 'Mifflin-St Jeor (mujer de 45, 165 cm, 75 kg: 1395)');
check(igual(M.reposo({ sexo: 'hombre', edad: 30, altura: 180, peso: 80, masaMagraDexa: 66 }), { kcal: 1952, formula: 'cunningham' }), 'con masa magra por DEXA, Cunningham (500 + 22 × 66 = 1952)');
check(M.factorActividad({ trabajo: 'sentado', pasos: 6000, diasEntreno: 3 }).factor === 1.55 && M.factorActividad({ trabajo: 'fisico', pasos: 12000, diasEntreno: 6 }).factor === 2
  && M.factorActividad({ trabajo: 'de_pie', pasos: 0, diasEntreno: 0 }).factor === 1.55 && M.factorActividad({ trabajo: 'nada' }) === null,
  'el factor: trabajo 1,40/1,55/1,70, más pasos y entreno, como mucho 2,00');
check(igual(M.mantenimiento({ sexo: 'mujer', edad: 45, altura: 165, peso: 75, trabajo: 'sentado', pasos: 6000, diasEntreno: 3 }), { kcal: 2160, reposo: 1395, formula: 'mifflin', factor: 1.55 }), 'mantenimiento: 1395 × 1,55 = 2160');

console.log('\nEl peso de referencia y la proteína (R18 a R21)');
check(igual(M.pesoDeReferencia({ peso: 75, altura: 165, cintura: 88 }), { kg: 68.1, motivo: 'cintura' }), 'IMC 27,5 con la cintura por encima de la mitad de la altura: el peso a IMC 25 (68,1 kg)');
check(igual(M.pesoDeReferencia({ peso: 75, altura: 165, cintura: 80 }), { kg: 75, motivo: null }), 'IMC 27,5 con la cintura por debajo de la mitad: su peso');
check(M.pesoDeReferencia({ peso: 100, altura: 170 }).motivo === 'imc' && M.pesoDeReferencia({ peso: 100, altura: 170 }).kg === 72.2, 'IMC 34,6: el peso a IMC 25 (72,2 kg)');
const pr45 = M.proteinaDelPlan({ objetivo: 'perder', edad: 45, pesoRef: 68.1 }), pr30 = M.proteinaDelPlan({ objetivo: 'perder', edad: 30, pesoRef: 68.1 });
check(pr45.gkg === 2.25 && igual(pr45.rango, [2.1, 2.4]) && pr45.g === 155 && pr45.mayor && pr30.gkg === 2.1 && pr30.g === 145,
  'perder: 1,8-2,4 g/kg, el centro (2,1); con 40 años o más, la mitad alta (2,1-2,4) y su centro (2,25)');
check(M.proteinaDelPlan({ objetivo: 'mantener', edad: 30, pesoRef: 80 }).gkg === 1.5 && M.proteinaDelPlan({ objetivo: 'ganar', edad: 30, pesoRef: 80 }).gkg === 1.9 && M.proteinaDelPlan({ objetivo: 'x', edad: 30, pesoRef: 80 }) === null,
  'mantener 1,4-1,6 (1,5) y ganar 1,6-2,2 (1,9): los rangos de la calculadora');

console.log('\nEl ritmo, las kcal y los suelos (R11 a R16; la 14 de Pelayo)');
check(M.ritmoDe({ objetivo: 'perder' }) === -0.5 && M.ritmoDe({ objetivo: 'perder', ritmo: -0.75 }) === -0.75 && M.ritmoDe({ objetivo: 'perder', ritmo: -1, imc: 29 }) === -0.5 && M.ritmoDe({ objetivo: 'perder', ritmo: -1, imc: 31 }) === -1,
  'perder: −0,25, −0,5 (de serie) o −0,75; −1 solo con IMC por encima de 30');
check(M.ritmoDe({ objetivo: 'ganar', experiencia: 'novato' }) === 0.5 && M.ritmoDe({ objetivo: 'ganar', experiencia: 'avanzado' }) === 0.1 && M.ritmoDe({ objetivo: 'ganar' }) === 0.25 && M.ritmoDe({ objetivo: 'mantener' }) === 0,
  'ganar por experiencia (+0,5, +0,25, +0,1) y mantener 0');
check(igual(M.kcalObjetivo({ objetivo: 'perder', ritmo: -0.5, peso: 75, mant: 2160, sexo: 'mujer' }), { kcal: 1750, kcalRitmo: 1748, limite: null, suelo: 1500 }), 'perder −0,5 %: 2160 − 0,005 × 75 × 1100 = 1750');
check(M.kcalObjetivo({ objetivo: 'perder', ritmo: -0.5, peso: 62, mant: 1620, sexo: 'mujer' }).kcal === 1500 && M.kcalObjetivo({ objetivo: 'perder', ritmo: -0.5, peso: 62, mant: 1620, sexo: 'mujer' }).limite === 'suelo',
  'mujer con 1620 de gasto: el ritmo pediría 1300 → el suelo de 1500');
check(M.kcalObjetivo({ objetivo: 'perder', ritmo: -0.75, peso: 90, mant: 2400, sexo: 'hombre' }).kcal === 1800 && M.kcalObjetivo({ objetivo: 'perder', ritmo: -0.75, peso: 90, mant: 2400, sexo: 'hombre' }).limite === 'suelo',
  'hombre con 2400: el ritmo pediría 1660 → el suelo de 1800');
const k25 = M.kcalObjetivo({ objetivo: 'perder', ritmo: -1, peso: 130, mant: 3200, sexo: 'hombre' });
check(k25.kcal === 2400 && k25.limite === 'deficit', `hombre con 3200 de gasto y −1 %: como mucho un 25 % por debajo (2400, no ${k25.kcalRitmo})`);
const kMant = M.kcalObjetivo({ objetivo: 'perder', ritmo: -0.5, peso: 55, mant: 1370, sexo: 'mujer' });
check(kMant.kcal === 1370 && kMant.limite === 'mantenimiento', 'si el suelo llega a su mantenimiento (1370): se queda en 1370 (la vía es moverse más)');
check(M.kcalObjetivo({ objetivo: 'ganar', ritmo: 0.5, peso: 70, mant: 2500, sexo: 'hombre' }).kcal === 2900 && M.kcalObjetivo({ objetivo: 'ganar', ritmo: 0.5, peso: 120, mant: 2400, sexo: 'hombre' }).limite === 'superavit',
  'ganar +0,5 % (2500 + 385 → 2900); con mucho peso, como mucho un 20 % más (2880)');
check(M.sueloDe('mujer', 1800) === 1500 && M.sueloDe('mujer', 2400) === 1800 && M.sueloDe('hombre', 2000) === 1800, 'el suelo: el mayor de 1500/1800 y el 75 % del mantenimiento');

console.log('\nLos macros (R22, R23, R25)');
const m1 = M.macrosDelPlan({ kcal: 1750, proteinaG: 155, proteinaMinG: 145, pesoRef: 68.1 });
check(m1.proteina_g === 155 && m1.grasa_g === 55 && m1.carbos_g === 159 && m1.kcal === 1751 && !m1.ajustes.length, 'proteína 155, grasa 0,8 g/kg (55), hidratos el resto (159)');
const m2 = M.macrosDelPlan({ kcal: 1500, proteinaG: 160, proteinaMinG: 135, pesoRef: 72 });
check(m2.carbos_g >= 130 && m2.grasa_g === 35 && m2.proteina_g <= 160 && m2.ajustes.includes('grasa') && m2.kcal >= 1500 && m2.grasa_g * 9 >= 0.2 * 1500 - 9,
  `con 1500 kcal: la grasa baja al 20 % (35 g) para que quepan los 130 g de hidratos (${m2.proteina_g}/${m2.carbos_g}/${m2.grasa_g}, ${m2.ajustes.join(',')})`);
const m3 = M.macrosDelPlan({ kcal: 1500, proteinaG: 200, proteinaMinG: 150, pesoRef: 90 });
check(m3.proteina_g < 200 && m3.proteina_g >= 150 && m3.carbos_g >= 130 && m3.ajustes.includes('proteina'), `si ni así caben, la proteína baja hacia su mínimo (${m3.proteina_g} g)`);
const m4 = M.macrosDelPlan({ kcal: 2000, proteinaG: 150, pesoRef: 120 });
check(m4.grasa_g === 75 && m4.grasa_g * 9 <= 0.35 * 2000, 'la grasa, como mucho el 35 % (con 120 kg de referencia, 75 g y no 95)');
const m5 = M.macrosDelPlan({ kcal: 2000, proteinaG: 150, pesoRef: 70, bebidasSemana: 7 });
check(m5.alcohol_kcal === 100 && m5.carbos_g === 202 && m5.kcal === 2003 && M.macrosDelPlan({ kcal: 2000, proteinaG: 150, pesoRef: 70 }).carbos_g === 227,
  'el alcohol cuenta dentro de las kcal (7 bebidas a la semana: 100 kcal al día, 25 g menos de hidratos)');
const m6 = M.macrosDelPlan({ kcal: 1500, proteinaG: 160, pesoRef: 72, pocosHidratos: true });
check(m6.carbos_g < 130 && !m6.ajustes.length && m6.grasa_g === 55, 'con «pocos hidratos», no se fuerza el mínimo de 130 g (y la grasa, como mucho el 35 %: 55 g)');

console.log('\nLa seguridad (R35, R36)');
check(M.seguridadNutricion({ edad: 40 }).automatico && !M.seguridadNutricion({ edad: 40 }).soloMantener, 'sin nada: plan automático');
for (const [k, d] of [['embarazo', { embarazo: true }], ['lactancia', { lactancia: true }], ['imc_bajo', { peso: 45, altura: 170 }], ['renal', { renal: true }], ['insulina', { insulina: true }], ['insulina', { sulfonilureas: true }], ['bariatrica', { bariatrica: true }], ['menor', { edad: 16 }]])
  check(M.seguridadNutricion({ edad: 40, ...d }).motivo === k && !M.seguridadNutricion({ edad: 40, ...d }).automatico, `sin plan automático: ${k}`);
check(M.seguridadNutricion({ edad: 40, tca: true }).soloMantener && M.seguridadNutricion({ edad: 40, scoff: { control: true, domina: true } }).soloMantener && !M.seguridadNutricion({ edad: 40, scoff: { control: true } }).soloMantener,
  'con antecedente de TCA o con 2 o más «sí» en el SCOFF: solo mantener (y sin pesarse)');
check(M.SCOFF.length === 5 && M.SCOFF.every(([k, t]) => k && t.endsWith('?')), 'el SCOFF: cinco preguntas');

console.log('\nEl plan de partida (planMotor)');
const D = { sexo: 'mujer', edad: 45, altura: 165, peso: 75, cintura: 88, trabajo: 'sentado', pasos: 6000, diasEntreno: 3, objetivo: 'perder' };
const p1 = M.planMotor(D);
check(p1.automatico && p1.kcal === 1751 && p1.proteina_g === 155 && p1.grasa_g === 55 && p1.carbos_g === 159 && p1.mantenimiento === 2160 && p1.ritmo_pct === -0.5 && p1.pesoReferencia === 68.1 && p1.fibra_g === 25,
  `la mujer de ejemplo: 1751 kcal, 155 g de proteína, 55 de grasa y 159 de hidratos (${p1.kcal}/${p1.proteina_g}/${p1.grasa_g}/${p1.carbos_g})`);
check(p1.proteinaToma_g === 40 && p1.tomas === 4, 'al menos 40 g de proteína por comida (en 4 tomas, 155/4 ≈ 40; 0,4 × 68,1 = 27)');
check(p1.porque.length >= 4 && /2160 kcal/.test(p1.porque[0]) && /0,5 %/.test(p1.porque[1]) && /2,25 g por kilo de tu peso de referencia, 68,1 kg; con 40 años o más/.test(p1.porque[2]), 'con su porqué, en palabras');
const p2 = M.planMotor({ ...D, tca: true });
check(p2.objetivo === 'mantener' && p2.soloMantener && p2.kcal >= 2160 - 5 && /sin pedirte que te peses/.test(p2.porque[1]), 'con antecedente de TCA: mantener, sin déficit');
const p3 = M.planMotor({ sexo: 'mujer', edad: 70, altura: 150, peso: 55, cintura: 78, trabajo: 'sentado', pasos: 3000, diasEntreno: 0, objetivo: 'perder' });
check(p3.limite === 'mantenimiento' && /moverte más/.test(p3.porque[1]), 'mujer pequeña y sedentaria: se queda en su mantenimiento y le dice que la vía es moverse más');
check(M.planMotor({ ...D, embarazo: true }).automatico === false && /embarazada/.test(M.planMotor({ ...D, embarazo: true }).texto), 'embarazada: sin plan automático, y por qué');
check(M.planMotor({ ...D, cintura: null }) === null && /cintura/.test(M.datosMotorValidos({ ...D, cintura: null })), 'sin la cintura no hay plan (la pide el cuestionario)');

console.log('\nLa meta (R6)');
check(M.metaPeso({ peso: 80, meta: 72, altura: 175, ritmo: -0.5 }).semanas === 22 && M.metaPeso({ peso: 80, meta: 72, altura: 175, ritmo: -0.5 }).aviso === null, 'de 80 a 72 kg al −0,5 %: 22 semanas');
check(M.metaPeso({ peso: 60, meta: 50, altura: 170, ritmo: -0.5 }).aviso === 'imc', 'una meta por debajo de un IMC de 20: avisa');

console.log('\nEl seguimiento y la revisión (R26 a R33)');
const hoy = '2026-03-02';
const desde = sumarDias(hoy, -28);
const dias = (n, f) => Array.from({ length: n }, (_, i) => f(sumarDias(desde, i), i));
// 28 días: 24 «Sí», pesadas los lunes, miércoles y viernes de cada semana
const pesar = (kg0, porSemana) => dias(28, (f, i) => ({ fecha: f, kg: Math.round((kg0 + (porSemana / 7) * i) * 100) / 100 })).filter((_, i) => i % 7 === 0 || i % 7 === 2 || i % 7 === 4);
const cumplir = (n) => dias(28, (f, i) => ({ fecha: f, cumplido: i < n ? 2 : 0 }));
check(M.adherencia({ registros: cumplir(24), pesos: pesar(75, -0.4) }, sumarDias(hoy, -1)).buena && !M.adherencia({ registros: cumplir(18), pesos: pesar(75, -0.4) }, sumarDias(hoy, -1)).buena,
  'buena adherencia: 20 de 28 días en «Sí» o «Casi» y 3 pesadas cada semana');
check(Math.abs(M.ritmoReal(pesar(75, -0.375), desde, hoy) - -0.5) < 0.02, 'el ritmo real: la pendiente de sus pesadas en % a la semana (−0,375 kg en 75 kg = −0,5 %)');
check(M.cambioCintura([{ fecha: desde, cm: 90 }, { fecha: sumarDias(hoy, -1), cm: 88.5 }], sumarDias(hoy, -1)) === -1.5, 'la cintura de hoy frente a la de hace 4 semanas');
const plan = { kcal: 1750, proteina_g: 155, desde, objetivo: 'perder', ritmo_pct: -0.5, mantenimiento: 2160 };
const base = { plan, sexo: 'mujer', pesoRef: 68.1, proteinaMinG: 145, mant: 2160, hoy, cinturas: [] };
check(M.revisionNutricion({ ...base, hoy: sumarDias(desde, 20), registros: [], pesos: [] }).tipo === 'esperar', 'antes de 4 semanas: esperar');
const sinCumplir = M.revisionNutricion({ ...base, registros: cumplir(15), pesos: pesar(75, -0.1) });
check(sinCumplir.tipo === 'simplificar' && sinCumplir.delta === 0 && sinCumplir.revisarEn === 14 && /no tocamos tus kcal/.test(sinCumplir.porque), 'sin buena adherencia: no se tocan las kcal, simplificar y mirarlo en 2 semanas');
const bien = M.revisionNutricion({ ...base, registros: cumplir(24), pesos: pesar(75, -0.375) });
check(bien.tipo === 'bien' && bien.delta === 0, 'cumple y va al ritmo: seguimos igual');
const lento = M.revisionNutricion({ ...base, registros: cumplir(24), pesos: pesar(75, -0.15) });
check(lento.tipo === 'baja' && lento.ritmoReal === -0.2 && lento.delta === -100 && lento.nuevo.proteina_g === 155 && lento.nuevo.kcal >= 1650 && lento.nuevo.kcal < 1660,
  `cumple y va a menos de la mitad (−0,2 %), sin bajar la cintura: baja un 5 % (como poco 100 kcal), de hidratos y grasa (proteína ${lento.nuevo?.proteina_g})`);
const muyLento = M.revisionNutricion({ ...base, registros: cumplir(24), pesos: pesar(75, 0.05) });
check(muyLento.tipo === 'baja' && muyLento.delta === -130 && muyLento.nuevo.kcal >= 1620, 'y si va a menos de un cuarto (o sube), un 10 % (180 kcal), sin pasar del 25 % por debajo de su gasto (1620): baja 130');
const recompo = M.revisionNutricion({ ...base, registros: cumplir(24), pesos: pesar(75, -0.05), cinturas: [{ fecha: desde, cm: 90 }, { fecha: sumarDias(hoy, -1), cm: 88.8 }] });
check(recompo.tipo === 'recomposicion' && recompo.delta === 0, 'el peso no baja pero la cintura sí (−1,2 cm): no se toca (recomposición)');
const deprisa = M.revisionNutricion({ ...base, registros: cumplir(24), pesos: pesar(75, -0.9) });
check(deprisa.tipo === 'sube' && deprisa.delta === 180, `demasiado deprisa (−1,2 %): sube un 10 % (${deprisa.delta} kcal)`);
const fuerza = M.revisionNutricion({ ...base, registros: cumplir(24), pesos: pesar(75, -0.15), fuerzaCae: true });
check(fuerza.tipo === 'bien' && fuerza.delta === 0 && /marcas caen/.test(fuerza.porque), 'en déficit con sus marcas cayendo 3 semanas: no baja más');
const fuerza2 = M.revisionNutricion({ ...base, registros: cumplir(24), pesos: pesar(75, -0.4), fuerzaCae: true });
check(fuerza2.tipo === 'sube' && fuerza2.delta === 100, 'y si además va al ritmo: sube 100');
const suelo = M.revisionNutricion({ ...base, plan: { ...plan, kcal: 1500 }, mant: 1900, registros: cumplir(24), pesos: pesar(75, -0.1) });
check(suelo.tipo === 'suelo' && suelo.delta === 0 && /mínimo/.test(suelo.porque), 'tocaría bajar pero ya está en su suelo (1500): no baja y le dice que se mueva más');
const tres = M.revisionNutricion({ ...base, registros: cumplir(24), pesos: pesar(75, -0.1), bajadasSeguidas: 3 });
check(tres.tipo === 'profesional' && /profesional/.test(tres.porque), 'tras tres bajadas seguidas sin avanzar: no baja más y recomienda un profesional');
const planG = { kcal: 2900, proteina_g: 150, desde, objetivo: 'ganar', ritmo_pct: 0.25, mantenimiento: 2500 };
const ganaPoco = M.revisionNutricion({ ...base, plan: planG, sexo: 'hombre', pesoRef: 80, mant: 2500, registros: cumplir(24), pesos: pesar(80, 0.05) });
const ganaMucho = M.revisionNutricion({ ...base, plan: planG, sexo: 'hombre', pesoRef: 80, mant: 2500, registros: cumplir(24), pesos: pesar(80, 0.6), bajadasSeguidas: 5 });
check(ganaPoco.tipo === 'sube' && ganaPoco.delta === 150 && ganaMucho.tipo === 'baja' && ganaMucho.delta === -150,
  'ganar: sube poco → +100-150; sube más del doble → −100-150 (y ahí no cuenta lo de las tres bajadas)');
check(M.CAMBIO_MAX === 250 && [lento, deprisa, ganaPoco, ganaMucho].every((r) => Math.abs(r.delta) <= 250), 'ningún cambio de más de 250 kcal');

console.log('\nLa pausa de dieta (R17)');
const hist = [{ desde: '2026-01-05', fase: 'perder', ritmo_pct: -0.5 }, { desde: '2026-02-02', fase: 'perder', ritmo_pct: -0.5 }, { desde: '2025-12-01', fase: 'mantener', ritmo_pct: 0 }];
check(M.semanasEnDeficit(hist, '2026-03-30') === 12 && M.tocaPausa(hist, '2026-03-30') && !M.tocaPausa(hist, '2026-03-16'), 'a las 12 semanas seguidas en déficit, le ofrece la pausa');

console.log('\nEl código');
const src = readFileSync(new URL('../web/src/logica/nutricion-motor.js', import.meta.url), 'utf8');
check(!/from '\.\.\/ui|from 'preact/.test(src), 'lógica pura: sin pantallas ni Preact');
check(!/\/[^/\n]*[^\x00-\x7f][^/\n]*\/[gimsuy]*\.test|new RegExp\([^)]*[^\x00-\x7f]/.test(src.replace(/\/\/.*$/gm, '').replace(/'[^'\n]*'|`[^`]*`/g, "''")), 'sin caracteres fuera de ASCII dentro de las expresiones regulares');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
