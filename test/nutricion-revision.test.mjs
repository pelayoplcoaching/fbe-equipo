// Motor de nutrición (v0.253, N4): la revisión de cada 4 semanas en la app (logica/nutricion-revision.js): el reloj con su
// historial (28 días desde el último cambio o la última revisión; 14 tras «simplificar» o «faltan datos»), la fuerza como
// señal, las bajadas seguidas, quién no tiene revisión, lo que la app saca de lo que ya carga, lo que manda a la base, que
// la demo la guarda como la base (mismo reloj, mismos topes) y los textos de cada revisión.
//   node test/nutricion-revision.test.mjs
import { readFileSync } from 'node:fs';
import * as R from '../web/src/logica/nutricion-revision.js';
import * as M from '../web/src/logica/nutricion-motor.js';
import { revisionNutricionDemo } from '../web/src/datos/semilla-esencial.js';
import * as N from '../web/src/datos/api-nutricion.js';
import { sumarDias, lunesDe } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const hoy = '2026-03-02';   // (un lunes)
const desde = sumarDias(hoy, -28);
const dias = (n, f) => Array.from({ length: n }, (_, i) => f(sumarDias(desde, i), i));
const pesar = (kg0, porSemana) => dias(28, (f, i) => ({ fecha: f, kg: Math.round((kg0 + (porSemana / 7) * i) * 100) / 100 })).filter((_, i) => i % 7 === 0 || i % 7 === 2 || i % 7 === 4);
const cumplir = (k) => dias(28, (f, i) => ({ fecha: f, cumplido: i < k ? 2 : 0 }));

console.log('El reloj (R28 y R29, como la base)');
const plan0 = { desde, kcal: 1750, proteina_g: 155 };
check(M.proximaRevision(plan0) === hoy && M.proximaRevision(plan0, { fecha: sumarDias(desde, 28), tipo: 'bien' }) === sumarDias(hoy, 28),
  'la primera, a los 28 días del plan; tras «bien», 28 días después de esa revisión');
check(M.proximaRevision(plan0, { fecha: hoy, tipo: 'simplificar' }) === sumarDias(hoy, 14) && M.proximaRevision(plan0, { fecha: hoy, tipo: 'datos' }) === sumarDias(hoy, 14),
  'tras «simplificar» o «faltan datos», 14');
check(M.proximaRevision({ ...plan0, desde: hoy }, { fecha: sumarDias(hoy, -3), tipo: 'simplificar' }) === sumarDias(hoy, 28), 'con un plan nuevo después de esa revisión, 28 desde el plan');
check(M.revisionNutricion({ plan: plan0, hoy: sumarDias(hoy, -1), ultima: null })?.tipo === 'esperar'
  && M.revisionNutricion({ plan: plan0, hoy: sumarDias(hoy, 13), ultima: { fecha: hoy, tipo: 'simplificar' } })?.dias === 1,
  'revisionNutricion espera con el mismo reloj (y dice cuántos días faltan)');

console.log('\nLa fuerza como señal (R32)');
const lunes = lunesDe(hoy);
const serie = (ej, kg0, factor) => [28, 21, 14, 7].map((d, i) => ({ ejercicio_id: ej, fecha: sumarDias(lunes, -d + 1), kg: Math.round(kg0 * factor ** i * 2) / 2, reps: 5, rpe: 8 }));
check(R.fuerzaCae([...serie('a', 100, 0.97), ...serie('b', 80, 0.97)], hoy) === true, 'dos ejercicios que bajan un 3 % cada semana, tres semanas seguidas: caen');
check(R.fuerzaCae(serie('a', 100, 0.97), hoy) === false, 'con un ejercicio solo, no se sabe: no');
check(R.fuerzaCae([...serie('a', 100, 0.97), ...serie('b', 80, 1.03)], hoy) === false, 'si de media no bajan (uno baja y otro sube), no');
check(R.fuerzaCae([...serie('a', 100, 0.97), ...serie('b', 80, 0.97)].filter((s) => s.fecha >= sumarDias(lunes, -21)), hoy) === false, 'sin las cuatro semanas, no');
check(R.fuerzaCae([...serie('a', 100, 0.97), ...serie('b', 80, 0.97)].map((s) => ({ ...s, fecha: sumarDias(s.fecha, 7) })), hoy) === false, 'la semana en curso no cuenta (aún no ha acabado)');

console.log('\nLas bajadas seguidas (R33)');
const rv = (fecha, tipo, plan_id = null) => ({ id: `${fecha}-${tipo}`, fecha, tipo, plan_id, creado_en: `${fecha}T09:00:00Z` });
const planes = [{ id: 'p0', desde: '2025-11-03' }, { id: 'p1', desde: '2025-12-01' }, { id: 'p2', desde: '2026-01-12' }, { id: 'p3', desde: '2026-02-09' }];
const tres = [rv('2025-12-01', 'baja', 'p1'), rv('2025-12-29', 'simplificar'), rv('2026-01-12', 'baja', 'p2'), rv('2026-02-09', 'baja', 'p3')];
check(R.bajadasSeguidas(tres, planes, hoy) === 3, 'tres bajadas (un «simplificar» en medio no corta la cuenta)');
check(R.bajadasSeguidas([...tres.slice(0, 2), rv('2026-01-05', 'bien'), ...tres.slice(2)], planes, hoy) === 2, 'un «bien» en medio, sí');
check(R.bajadasSeguidas(tres, [...planes, { id: 'p9', desde: '2026-01-20' }], hoy) === 1, 'rehacer el cuestionario empieza de cero (solo cuentan las de después)');
check(R.bajadasSeguidas([...tres, rv('2026-03-02', 'profesional')], planes, hoy) === 3, '«profesional» no cuenta como bajada ni corta');

console.log('\nQuién no tiene revisión (R36)');
check(R.sinRevision({ cuestionario: { tca: true } }) && R.sinRevision({ tca: true }) && R.sinRevision({ cuestionario: { tca: false, nutricion_salud: { scoff: { control: true, domina: true } } } }),
  'con antecedente de TCA o el SCOFF positivo, no hay revisión');
check(!R.sinRevision({ cuestionario: { tca: false, nutricion_salud: { scoff: { control: true } } } }) && !R.sinRevision({ cuestionario: null }), 'con un «sí» en el SCOFF, o sin cuestionario, sí');

console.log('\nLo que necesita, de lo que ya carga la app');
const plan = { id: 'plan1', desde, modo: 'macros', fase: 'perder', ritmo_pct: -0.5, kcal: 1750, proteina_g: 155, carbos_g: 167, grasa_g: 55, mantenimiento: 2160 };
const r = { plan, planes: [plan], registros: cumplir(24), pesos: pesar(75, -0.15), pesoKg: 74.4 };
const perfil = { sexo: 'mujer', altura: 165, pocos_hidratos: false, bebidas_semana: 0 };
const medidas = [{ fecha: desde, cintura_cm: 90 }, { fecha: sumarDias(hoy, -2), cintura_cm: 90.5 }];
const e = R.datosParaRevision({ r, perfil, medidas, revisiones: [], series: [], hoy });
check(e.plan.objetivo === 'perder' && e.plan.desde === desde && e.pesoRef === 68.1 && e.mant === 2160 && e.cinturas.length === 2 && e.bajadasSeguidas === 0 && e.ultima === null && e.fuerzaCae === false,
  `su plan con su objetivo, su peso de referencia (${e.pesoRef}: IMC de 27 y cintura de más de la mitad de su altura), su mantenimiento y sus cinturas`);
check(R.datosParaRevision({ r: { ...r, plan: { ...plan, mantenimiento: null } }, perfil, hoy }) === null, 'un plan que no es del motor: nada');
const res = R.revisionDeHoy(e);
check(res?.tipo === 'baja' && res.delta === -100 && res.nuevo.proteina_g === 155 && res.ritmoReal === -0.2 && res.cintura === 0.5 && /más despacio de lo previsto/.test(res.porque),
  `a los 28 días, con buena adherencia, a −0,2 % y la cintura sin bajar: baja ${res?.delta} kcal (la proteína igual)`);
check(R.revisionDeHoy(R.datosParaRevision({ r, perfil, medidas, revisiones: [rv(sumarDias(hoy, -10), 'bien')], hoy })) === null, 'con una revisión de hace 10 días: aún no toca');
const conGasto = R.datosParaRevision({ r: { ...r, registros: r.registros.map((x) => ({ ...x, kcal: 2400 })) }, perfil, medidas, hoy });
check(conGasto.mant > 2160, `con lo que apunta, su gasto real si sale más alto (${conGasto.mant}): el suelo del 25 %, desde ahí`);

console.log('\nLo que manda a la base');
let llamada = null;
const bFalso = { rpc: async (nombre, args) => { llamada = { nombre, args }; return 'rev-1'; } };
check(await N.revision(bFalso, res) === 'rev-1' && llamada.nombre === 'nutricion_revision' && llamada.args.p.tipo === 'baja' && llamada.args.p.kcal === res.nuevo.kcal
  && llamada.args.p.proteina_g === 155 && llamada.args.p.ritmo_real === -0.2 && llamada.args.p.cintura_cambio === 0.5 && llamada.args.p.motivo === res.porque && !('p_atleta' in llamada.args),
  'una bajada: el tipo, el plan nuevo, su ritmo, su cintura y el porqué (la suya, sin atleta)');
await N.revision(bFalso, { tipo: 'bien', porque: 'Vas a buen ritmo.', ritmoReal: -0.5, cintura: null });
check(llamada.args.p.tipo === 'bien' && !('kcal' in llamada.args.p) && llamada.args.p.cintura_cambio === null, '«bien»: sin plan nuevo');
check(await N.revision({ rpc: async () => { throw new Error('relation "public.nutricion_revisiones" does not exist'); } }, res).then((x) => x?.falta106 === true), 'sin la 106: { falta106 }');

console.log('\nLa demo la guarda como la base (reloj, tipos y topes)');
const atletaId = 'a1';
const db = { atletas: [{ id: atletaId, modalidad: 'por_su_cuenta', estado: 'activo', nutricion: true }], cuestionarios: [{ atleta_id: atletaId, tca: false }],
  nutricion_perfiles: [{ atleta_id: atletaId, sexo: 'mujer' }], planes_nutricion: [{ ...plan, atleta_id: atletaId }], registros_nutricion: [], pesos: [], nutricion_revisiones: [] };
const t = (x) => (db[x] ||= []);
let k = 0;
const demo = (p, dia = hoy) => revisionNutricionDemo(t, { p, atletaId, hoy: dia, uuid: () => `id-${++k}`, ahoraISO: `${dia}T10:00:${String(k).padStart(2, '0')}Z` });
const falla = (fn) => { try { fn(); return null; } catch (x) { return x; } };
check(/no vale/.test(falla(() => demo({ tipo: 'otra' }))?.message || ''), 'un tipo que no existe: no');
check(demo({ tipo: 'bien' }, sumarDias(hoy, -1)) === null, 'antes de los 28 días: null');
const d1 = demo({ tipo: 'simplificar', motivo: 'No tocamos tus kcal.' });
check(typeof d1 === 'string' && db.nutricion_revisiones.length === 1 && db.nutricion_revisiones[0].kcal_despues === 1750 && db.nutricion_revisiones[0].dias_cumplidos === 0 && db.planes_nutricion.length === 1,
  '«simplificar»: al historial, sin tocar el plan');
check(demo({ tipo: 'bien' }, sumarDias(hoy, 13)) === null && typeof demo({ tipo: 'datos' }, sumarDias(hoy, 14)) === 'string', 'la siguiente, a los 14 días');
const dia2 = sumarDias(hoy, 28);
check(demo({ tipo: 'bien' }, sumarDias(dia2, -1)) === null, 'tras «faltan datos», otros 14 (a los 13, no)');
const desde2 = sumarDias(dia2, -28);
for (let i = 1; i <= 28; i++) {
  const f = sumarDias(dia2, -i);
  if (i <= 24) db.registros_nutricion.push({ atleta_id: atletaId, fecha: f, cumplido: 2 });
  if (i % 2 === 0 || i % 7 === 1) db.pesos.push({ atleta_id: atletaId, fecha: f, kg: 75 });
}
check(desde2 < dia2, '(sus 28 días, con buena adherencia)');
const baja = M.macrosDelPlan({ kcal: 1650, proteinaG: 155, pesoRef: 68.1 });
check(/topes/.test(falla(() => demo({ tipo: 'baja', ...M.macrosDelPlan({ kcal: 1850, proteinaG: 155, pesoRef: 68.1 }) }, dia2))?.message || '')
  && /topes/.test(falla(() => demo({ tipo: 'sube', ...baja }, dia2))?.message || ''), 'baja con más kcal o sube con menos: no');
check(/no vale/.test(falla(() => demo({ tipo: 'baja', ...baja, ritmo_real: 50 }, dia2))?.message || ''), 'un ritmo imposible: no');
const d3 = demo({ tipo: 'baja', ...baja, motivo: 'Vas más despacio de lo previsto: bajamos un poco.', ritmo_real: -0.1 }, dia2);
const nuevoPlan = db.planes_nutricion.find((x) => x.desde === dia2);
const rev3 = db.nutricion_revisiones.find((x) => x.id === d3);
check(nuevoPlan && nuevoPlan.kcal === baja.kcal && nuevoPlan.proteina_g === 155 && nuevoPlan.mantenimiento === 2160 && rev3.plan_id === nuevoPlan.id && rev3.kcal_antes === 1750 && rev3.dias_cumplidos === 24 && rev3.ritmo_real === -0.1,
  'con buena adherencia, la bajada: plan nuevo y su revisión apuntando a él');
check(demo({ tipo: 'bien' }, sumarDias(dia2, 27)) === null && typeof demo({ tipo: 'bien' }, sumarDias(dia2, 28)) === 'string', 'y la siguiente, a los 28 días del cambio');

console.log('\nLos textos de cada revisión');
const tBaja = R.textoRevision({ ...rev3, fecha: dia2, cintura_cambio: 0.5 }, nuevoPlan);
check(tBaja.titulo === `Tu plan baja a ${baja.kcal} kcal` && tBaja.tono === 'cambio' && tBaja.cifras.some((c) => c === '24 de 28 días con tu plan') && tBaja.cifras.some((c) => /Tu peso: −0,1 % a la semana \(buscábamos −0,5 %\)/.test(c))
  && tBaja.cifras.some((c) => c === 'Tu cintura: +0,5 cm en 4 semanas') && tBaja.cifras.some((c) => /Antes, 1750 kcal/.test(c)) && /^[a-zé]{3} \d+ [a-z]{3}$/.test(tBaja.siguiente),
  `una bajada: «${tBaja.titulo}», sus cifras y la siguiente (${tBaja.siguiente})`);
const tSimp = R.textoRevision({ id: 'x', fecha: hoy, tipo: 'simplificar', kcal_antes: 1750, kcal_despues: 1750, dias_cumplidos: 12, ritmo_real: null, ritmo_previsto: -0.5, cintura_cambio: null }, plan);
check(tSimp.titulo === 'No tocamos tus kcal' && tSimp.tono === 'aviso' && tSimp.cifras.length === 1 && tSimp.siguiente === 'lun 16 mar', '«simplificar»: sin tocar las kcal, y la siguiente en 2 semanas');
check(R.textoRevision({ tipo: 'bien', ritmo_real: 0.02, ritmo_previsto: 0 }).cifras[0] === 'Tu peso: +0,02 % a la semana (buscábamos mantenerlo)' && R.textoRevision({ tipo: 'recomposicion' }).tono === 'ok',
  'manteniendo: «buscábamos mantenerlo»');
check(R.textoRevision({ tipo: 'baja', kcal_antes: 1803, kcal_despues: 1623, ritmo_real: 0, ritmo_previsto: -0.5 }).cifras[0] === 'Tu peso: sin cambios (buscábamos −0,5 % a la semana)'
  && /\(tu peso no se mueve; buscábamos bajar un 0,5 % a la semana\)/.test(M.revisionNutricion({ ...e, pesos: pesar(75, 0) })?.porque || ''),
  'con el peso quieto: «sin cambios» y «tu peso no se mueve» (no «subes un 0 %»)');
check(R.lineaRevision({ ...rev3, fecha: '2026-03-30' }) === `lun 30 mar: Tu plan baja a ${baja.kcal} kcal (24 de 28 días)`, 'su línea en «Tus revisiones»');
const vistas = new Set(['b']);
const revs = [{ id: 'a', fecha: sumarDias(hoy, -20), tipo: 'bien' }, { id: 'b', fecha: sumarDias(hoy, -2), tipo: 'baja' }];
check(R.revisionReciente(revs, hoy, (id) => vistas.has(id)) === null && R.revisionReciente(revs, hoy)?.id === 'b' && R.revisionReciente(revs, sumarDias(hoy, 5))?.id === 'b' && R.revisionReciente(revs, sumarDias(hoy, 6)) === null,
  'en Hoy, la última una semana (o hasta «Entendido»)');
check(R.pesadasSemana(r.pesos.map((x) => ({ ...x, fecha: sumarDias(x.fecha, 28) })), hoy) === 1 && R.tocaCintura(medidas, hoy) === false && R.tocaCintura(medidas, sumarDias(hoy, 12)) === true && R.tocaCintura([], hoy),
  'sus pesadas de esta semana; la cintura, cada 2 semanas');

console.log('\nLo de alrededor');
const css = readFileSync(new URL('../web/src/nutricion-motor.css', import.meta.url), 'utf8');
check(/\.nm-rev \{/.test(css) && /\.nm-rev-ok \{/.test(css) && /\.nm-prox \{/.test(css) && /\.nm-hist-i \{/.test(css), 'los estilos de la tarjeta, de la siguiente y de «Tus revisiones»');
const ui = readFileSync(new URL('../web/src/ui/atleta/NutricionRevision.jsx', import.meta.url), 'utf8');
check(/sinRevision\(/.test(ui) && /sessionStorage/.test(ui) && /puesta-a-punto\.html/.test(ui) && !/margin|font-size/.test(ui), 'la pantalla: sin revisión con TCA o SCOFF, una vez al día, la Puesta a punto si lo tiene que mirar un profesional');
const copia = readFileSync(new URL('../web/src/datos/copia-tablas.js', import.meta.url), 'utf8');
const apiSrc = readFileSync(new URL('../web/src/datos/api.js', import.meta.url), 'utf8');
check(/'nutricion_perfiles', 'nutricion_revisiones'\]/.test(copia) && /'nutricion_perfiles', 'nutricion_revisiones'\]\) out\[t\]/.test(apiSrc), 'sus revisiones, en la copia completa y en «Descargar mis datos»');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
