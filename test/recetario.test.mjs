// El recetario al día con el plan: comprobador, corrección de kcal y reescalado por factor. Lógica pura, y lectura y
// guardado contra la demo.
//   node test/recetario.test.mjs
import { kcalDeReceta, desvioKcal, kcalMal, recetasConKcalMal, diaMedio, diferencia, cuadra, kcalCuadran, macrosCuadran, recetasFueraDeLinea,
  comprobarRecetario, textoComprobacion, reescalar, textoMacrosDia, menuPorActualizar, ordenRecetarios,
  ESTADOS_RECETARIO, NOMBRE_ESTADO_RECETARIO, NIVEL_ESTADO_RECETARIO, UMBRALES_RECETARIO } from '../web/src/logica/recetario/index.js';
import { recetarioPorToma } from '../web/src/logica/comidas.js';
import { hoyISO, sumarDias } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
process.on('unhandledRejection', (e) => { console.error('ERROR:', e.stack); process.exit(1); });

const HOY = '2026-11-06';
// Una receta con sus macros (P, H, G) y las kcal que le tocan (o las que se le pongan)
const R = (id, p, c, g, kcal = 4 * p + 4 * c + 9 * g) => ({ id, nombre: `Receta ${id}`, proteina_g: p, carbos_g: c, grasa_g: g, kcal });
// Un recetario: { toma: [recetas] } con factor 1; opciones: tomas, opcional, variantes { id: 'con' | 'sin' }, factores { id: n }
function recetario(porToma, { tomas = Object.keys(porToma), opcional = null, variantes = {}, factores = {} } = {}) {
  const recetas = [], asignaciones = [];
  for (const [t, rs] of Object.entries(porToma)) for (const [i, r] of rs.entries()) {
    if (!recetas.includes(r)) recetas.push(r);
    asignaciones.push({ id: `a-${t}-${r.id}`, atleta_id: 'at', receta_id: r.id, toma: t, factor: factores[r.id] ?? 1, favorita: false, orden: i, variante: variantes[r.id] || null });
  }
  return { tomas, opcional, porToma: recetarioPorToma(asignaciones, recetas), asignaciones, recetas };
}
const plan = (kcal, p, c, g, extra = {}) => [{ id: 'p1', desde: '2026-01-01', modo: 'macros', kcal, proteina_g: p, carbos_g: c, grasa_g: g, ...extra }];
// Un recetario que cuadra con 2.000 kcal, P 150, H 200, G 67 (aprox.): cuatro comidas, tres recetas iguales en macros cada una
const bueno = (cambios = {}) => recetario({
  desayuno: [R('d1', 30, 50, 13), R('d2', 30, 50, 13), R('d3', 30, 50, 13)],
  comida: [R('c1', 50, 60, 20), R('c2', 50, 60, 20), R('c3', 50, 60, 20)],
  merienda: [R('m1', 20, 30, 14), R('m2', 20, 30, 14), R('m3', 20, 30, 14)],
  cena: [R('n1', 50, 60, 20), R('n2', 50, 60, 20), R('n3', 50, 60, 20)],
  ...cambios,
});
const PLAN = plan(2003, 150, 200, 67);

console.log('Las calorías de una receta frente a sus macros');
{
  check(kcalDeReceta(R('x', 40, 60, 20)) === 580 && kcalDeReceta({ proteina_g: 40, carbos_g: null, grasa_g: 20 }) === null && kcalDeReceta(null) === null, 'las kcal que dan sus macros: 4, 4 y 9 por gramo (sin algún macro, no se sabe)');
  check(igual(desvioKcal(R('x', 40, 60, 20, 640)), { calculadas: 580, dif: 60, pct: 10.3 }) && desvioKcal(R('x', 40, 60, 20)).pct === 0, 'cuánto se alejan las apuntadas de las calculadas');
  check(desvioKcal({ proteina_g: 40, carbos_g: 60, grasa_g: 20, kcal: null }) === null && desvioKcal({ proteina_g: 0, carbos_g: 0, grasa_g: 0, kcal: 5 }) === null, 'sin kcal apuntadas (o sin macros que den algo) no hay desvío');
  check(kcalMal(R('x', 40, 60, 20, 640)) && kcalMal(R('x', 40, 60, 20, 520)), 'mal: más de un 5 % y de 25 kcal, por arriba o por abajo');
  check(!kcalMal(R('x', 40, 60, 20, 605)) && !kcalMal(R('x', 5, 20, 2, 140)) && !kcalMal(R('x', 40, 60, 20)), 'bien: dentro del 5 %, o una diferencia de pocas kcal en algo pequeño (118 → 140)');
  const rec = recetario({ comida: [R('a', 40, 60, 20, 640), R('b', 40, 60, 20), R('c', 40, 60, 20, 700)], cena: [R('a', 40, 60, 20, 640)] });
  rec.recetas = [rec.recetas[0], rec.recetas[1], rec.recetas[2]];
  const mal = recetasConKcalMal(rec);
  check(mal.length === 2 && mal[0].receta.id === 'c' && mal[0].calculadas === 580 && mal[0].pct === 20.7 && mal[1].receta.id === 'a', 'las recetas con las kcal mal, una vez cada una y la peor primero');
  check(recetasConKcalMal(null).length === 0 && recetasConKcalMal({ recetas: [] }).length === 0, 'sin recetario, ninguna');
}

console.log('El día medio');
{
  const d = diaMedio(bueno());
  check(d.kcal === 2003 && d.proteina_g === 150 && d.carbos_g === 200 && d.grasa_g === 67 && d.sinRecetas.length === 0, 'la suma de la media de cada comida: 2.003 kcal, P 150, H 200, G 67');
  check(d.porToma.comida.n === 3 && d.porToma.comida.kcal === 620 && d.porToma.merienda.proteina_g === 20, 'con el detalle de cada comida');
  // La media, no la suma, de recetas distintas; y el factor
  const mixto = diaMedio(recetario({ comida: [R('a', 40, 60, 20), R('b', 60, 40, 20)] }));
  check(mixto.kcal === 580 && mixto.proteina_g === 50 && mixto.carbos_g === 50, 'con recetas distintas en una comida, su media');
  const conFactor = diaMedio(recetario({ comida: [R('a', 40, 60, 20)] }, { factores: { a: 1.5 } }));
  check(conFactor.kcal === 870 && conFactor.proteina_g === 60, 'con el factor del atleta aplicado');
  check(diaMedio(recetario({ comida: [R('a', 40, 60, 20)] }), { factores: { 'a-comida-a': 0.5 } }).kcal === 290, 'o con los factores que se le pasen (para ver cómo quedaría)');
  // Una comida sin recetas
  const falta = diaMedio(recetario({ comida: [R('a', 40, 60, 20)] }, { tomas: ['desayuno', 'comida'] }));
  check(igual(falta.sinRecetas, ['desayuno']) && falta.kcal === 580, 'una comida sin recetas se dice (y no suma)');
  // Las kcal corregidas
  const mal = recetario({ comida: [R('a', 40, 60, 20, 640), R('b', 40, 60, 20, 640)] });
  check(diaMedio(mal).kcal === 640 && diaMedio(mal, { corregirKcal: true }).kcal === 580, 'con las kcal de las recetas tal cual o ya corregidas');
  // Días sin la comida opcional
  const op = recetario({ comida: [R('a', 40, 60, 20), R('g', 60, 80, 30)], merienda: [R('m', 20, 30, 14)] }, { opcional: 'merienda', variantes: { a: 'con', g: 'sin' } });
  check(diaMedio(op).kcal === 906 && diaMedio(op, { sin: true }).kcal === 830 && !diaMedio(op, { sin: true }).porToma.merienda, 'los días sin su comida opcional: sin ella y con las recetas de ese tipo de día');
  check(diaMedio(null).kcal === 0 && diaMedio({ tomas: ['comida'], porToma: {} }).sinRecetas.length === 1, 'sin recetario no rompe');
}

console.log('¿Cuadra con el plan?');
{
  const obj = { kcal: 2000, proteina: 150, carbos: 200, grasa: 67 };
  const dif = diferencia({ kcal: 2100, proteina_g: 158, carbos_g: 190, grasa_g: 70 }, obj);
  check(igual(dif, { kcal: 100, pct: 5, proteina: 8, carbos: -10, grasa: 3 }), 'la diferencia con el objetivo, en kcal, en % y en gramos de cada macro');
  check(diferencia(null, obj) === null && diferencia({ kcal: 1 }, null) === null && diferencia({ kcal: 2000, proteina_g: 1, carbos_g: 1, grasa_g: 1 }, { kcal: 2000, proteina: null, carbos: null, grasa: null }).proteina === null, 'sin objetivo no hay diferencia; un plan sin macros solo compara kcal');
  check(!kcalCuadran(dif) && kcalCuadran({ pct: 4.9 }) && kcalCuadran({ pct: -4.9 }) && !kcalCuadran({ pct: -5 }) && !kcalCuadran(null), 'las kcal cuadran por debajo del 5 %');
  check(macrosCuadran({ proteina: 10, carbos: -14, grasa: 5 }, obj) && !macrosCuadran({ proteina: 11, carbos: 0, grasa: 0 }, obj) && !macrosCuadran({ proteina: 0, carbos: 0, grasa: -6 }, obj), 'cada macro cuadra dentro del 7 % (o de 5 g)');
  check(macrosCuadran({ proteina: null, carbos: null, grasa: null }, { proteina: null, carbos: null, grasa: null }), 'un plan sin macros no los exige');
  check(cuadra({ pct: 1, proteina: 1, carbos: 1, grasa: 1 }, obj) && !cuadra({ pct: 6, proteina: 0, carbos: 0, grasa: 0 }, obj) && !cuadra({ pct: 0, proteina: 20, carbos: 0, grasa: 0 }, obj), 'cuadra si cuadran las kcal y los macros');
}

console.log('Recetas fuera de línea');
{
  const rec = recetario({ comida: [R('a', 50, 60, 20), R('b', 50, 60, 20), R('c', 50, 60, 20), R('z', 70, 90, 30)], cena: [R('n1', 50, 60, 20), R('n2', 30, 30, 10)] });
  const f = recetasFueraDeLinea(rec);
  check(f.length === 1 && f[0].asignacion.receta_id === 'z' && f[0].toma === 'comida' && f[0].kcal === 910 && f[0].mediana === 620 && f[0].pct === 46.8, 'la receta que se aleja más de un 10 % de lo normal en su comida');
  check(!f.some((x) => x.toma === 'cena'), 'con menos de tres recetas en una comida no se juzga');
  check(recetasFueraDeLinea(recetario({ comida: [R('a', 50, 60, 20), R('b', 50, 62, 20), R('c', 52, 60, 20)] })).length === 0, 'diferencias pequeñas no cuentan');
  // Las de los días sin la comida opcional se comparan entre ellas
  const op = recetario({ comida: [R('a', 50, 60, 20), R('b', 50, 60, 20), R('c', 50, 60, 20), R('g1', 70, 90, 30), R('g2', 70, 90, 30), R('g3', 70, 90, 30)] }, { opcional: 'merienda', tomas: ['comida', 'merienda'], variantes: { g1: 'sin', g2: 'sin', g3: 'sin' } });
  check(recetasFueraDeLinea(op).length === 0, 'las recetas de los días sin la comida opcional (más grandes) se comparan solo entre ellas');
  const conFactor = recetario({ comida: [R('a', 50, 60, 20), R('b', 50, 60, 20), R('c', 50, 60, 20)] }, { factores: { c: 1.5 } });
  check(recetasFueraDeLinea(conFactor).length === 1 && recetasFueraDeLinea(conFactor)[0].kcal === 930, 'cuenta el factor de cada una');
}

console.log('La comprobación entera');
{
  const c = comprobarRecetario({ recetario: bueno(), planes: PLAN, hoy: HOY });
  check(c.estado === 'cuadra' && c.dif.pct === 0 && c.recetas === 12 && c.kcalMal.length === 0 && c.fuera.length === 0 && c.objetivo.kcal === 2003, 'un recetario que cuadra');
  check(textoComprobacion(c) === 'Un día cualquiera con sus recetas da 2003 kcal y su plan pide 2003.', 'y su frase');
  // Las kcal de las recetas, mal (como en los datos reales: los macros cuadran y las kcal no)
  const inflado = bueno({ comida: [R('c1', 50, 60, 20, 700), R('c2', 50, 60, 20, 700), R('c3', 50, 60, 20, 700)], cena: [R('n1', 50, 60, 20, 700), R('n2', 50, 60, 20, 700), R('n3', 50, 60, 20, 700)] });
  const ci = comprobarRecetario({ recetario: inflado, planes: PLAN, hoy: HOY });
  check(ci.estado === 'kcal_recetas' && ci.dif.pct === 8 && ci.dif.proteina === 0 && ci.kcalMal.length === 6 && ci.corregido.pct === 0, 'kcal de las recetas infladas: no cuadra en kcal, sí en macros, y corregidas cuadraría');
  check(textoComprobacion(ci) === 'Sus macros cuadran con el plan, pero las calorías salen un 8 % por encima porque 6 recetas tienen las calorías mal puestas. Al corregirlas, cuadra.', 'lo explica');
  // Cuadra, pero con alguna receta mal
  const casi = bueno({ merienda: [R('m1', 20, 30, 14, 360), R('m2', 20, 30, 14), R('m3', 20, 30, 14)] });
  const cc = comprobarRecetario({ recetario: casi, planes: PLAN, hoy: HOY });
  check(cc.estado === 'cuadra_kcal_mal' && cc.kcalMal.length === 1 && textoComprobacion(cc) === 'El día cuadra con su plan, pero 1 receta tiene las calorías mal puestas.', 'cuadra en conjunto, pero avisa de la receta con las kcal mal');
  // No cuadra de verdad (el plan ha cambiado)
  const cn = comprobarRecetario({ recetario: bueno(), planes: plan(1803, 150, 150, 67), hoy: HOY });
  check(cn.estado === 'no_cuadra' && cn.dif.pct === 11.1 && cn.dif.carbos === 50 && cn.corregido === null, 'tras un cambio de plan, no cuadra');
  check(textoComprobacion(cn) === 'Un día cualquiera con sus recetas da 2003 kcal y su plan pide 1803 (+11,1 %).', 'y lo dice con las cifras');
  // No cuadra y además corregir las kcal no lo arregla
  const cm = comprobarRecetario({ recetario: inflado, planes: plan(1803, 150, 150, 67), hoy: HOY });
  check(cm.estado === 'no_cuadra' && cm.kcalMal.length === 6 && cm.corregido.pct === 11.1, 'si corregir las kcal no basta, sigue siendo «no cuadra» (y dice cómo quedaría)');
  // Las kcal cuadran pero un macro no
  const cp = comprobarRecetario({ recetario: bueno(), planes: plan(2003, 180, 170, 67), hoy: HOY });
  check(cp.estado === 'no_cuadra' && cp.dif.pct === 0 && cp.dif.proteina === -30, 'con las kcal bien y la proteína lejos, tampoco cuadra');
  check(textoComprobacion(cp) === 'Las calorías cuadran con su plan (2003 frente a 2003), pero los macros no: proteína 150 g (−30), hidratos 200 g (+30), grasa 67 g (=).', 'y dice qué macros se alejan');
  // El plan que vale es el vigente
  const dos = [...plan(1500, 100, 150, 50), { id: 'p2', desde: '2026-11-01', modo: 'macros', kcal: 2003, proteina_g: 150, carbos_g: 200, grasa_g: 67 }, { id: 'p3', desde: '2026-12-01', modo: 'macros', kcal: 3000, proteina_g: 150, carbos_g: 450, grasa_g: 67 }];
  check(comprobarRecetario({ recetario: bueno(), planes: dos, hoy: HOY }).estado === 'cuadra' && comprobarRecetario({ recetario: bueno(), planes: dos, hoy: '2026-12-02' }).estado === 'no_cuadra', 'se compara con el plan vigente ese día');
  // Sin plan, sin recetas, incompleto
  check(comprobarRecetario({ recetario: bueno(), planes: [], hoy: HOY }).estado === 'sin_plan' && comprobarRecetario({ recetario: bueno(), planes: [{ desde: '2026-01-01', modo: 'sin_contar' }], hoy: HOY }).estado === 'sin_plan', 'sin plan con calorías no hay con qué comparar');
  check(comprobarRecetario({ recetario: bueno(), planes: [], hoy: HOY }).dia.kcal === 2003, 'pero el día medio se calcula igual');
  check(comprobarRecetario({ recetario: recetario({}), planes: PLAN, hoy: HOY }).estado === 'sin_recetas' && comprobarRecetario({ recetario: null, planes: PLAN, hoy: HOY }).estado === 'sin_recetas', 'sin recetas');
  const inc = comprobarRecetario({ recetario: { ...bueno(), tomas: ['desayuno', 'media_manana', 'comida', 'merienda', 'cena'] }, planes: PLAN, hoy: HOY });
  check(inc.estado === 'incompleto' && inc.dif === null && textoComprobacion(inc) === 'No hay recetas para media mañana: no se puede comparar el día entero con el plan.', 'una comida sin recetas: no se compara, y dice cuál falta');
  // Días sin la comida opcional
  const op = bueno(); op.opcional = 'merienda';
  const co = comprobarRecetario({ recetario: op, planes: PLAN, hoy: HOY });
  check(co.diaSin.kcal === 1677 && co.difSin.pct === -16.3 && co.estado === 'cuadra', 'con comida opcional, también el día sin ella');
  // Las kcal del plan frente a sus macros
  check(comprobarRecetario({ recetario: bueno(), planes: plan(2100, 150, 200, 67), hoy: HOY }).planKcal.pct === 4.8 && c.planKcal === null, 'avisa si las kcal del plan no coinciden con las de sus macros');
  check(igual(ESTADOS_RECETARIO.map((e) => !!NOMBRE_ESTADO_RECETARIO[e] && !!NIVEL_ESTADO_RECETARIO[e]), ESTADOS_RECETARIO.map(() => true)) && UMBRALES_RECETARIO.plan === 5, 'cada estado tiene su nombre y su color');
}

console.log('Reescalar con un factor');
{
  // El plan baja 200 kcal, solo en hidratos (como lo hace la app)
  const nuevo = plan(1803, 150, 150, 67);
  const r = reescalar({ recetario: bueno(), planes: nuevo, hoy: HOY });
  check(r.factor === 0.9 && r.cambios.length === 12 && r.cambios.every((x) => x.antes === 1 && x.despues === 0.9) && r.topados === 0 && !r.imposible && !r.innecesario, 'factor ×0,9 para las 12 recetas');
  check(Math.abs(r.dif.pct) < 0.2 && r.dif.proteina === -15 && r.dif.carbos === 30 && r.dia.kcal === 1802.7, 'las kcal quedan clavadas, pero la proteína baja 15 g y los hidratos quedan 30 g por encima');
  check(!macrosCuadran(r.dif, { proteina: 150, carbos: 150, grasa: 67 }) && r.antes.dif.pct === 11.1, 'los macros ya no cuadran (el factor los mueve todos a la vez); y guarda cómo estaba antes');
  check(textoMacrosDia(r.dia, r.dif) === 'proteína 135 g (−15), hidratos 180 g (+30), grasa 60 g (−7)', 'la frase con cómo quedan los macros');
  check(textoMacrosDia({ proteina_g: 150, carbos_g: 200, grasa_g: 67 }, { proteina: 0, carbos: 3, grasa: null }) === 'proteína 150 g (=), hidratos 200 g (+3), grasa 67 g', 'también cuando alguno cuadra o el plan no lo fija');
  // Solo algunas comidas
  const solo = reescalar({ recetario: bueno(), planes: nuevo, hoy: HOY, tomas: ['desayuno', 'merienda'] });
  check(solo.factor === 0.74 && solo.cambios.length === 6 && solo.cambios.every((x) => ['desayuno', 'merienda'].includes(x.toma)) && Math.abs(solo.dif.pct) < 0.3, 'solo desayuno y merienda: un factor mayor en menos recetas, y las kcal cuadran igual');
  check(solo.dif.proteina === -13 && igual(solo.tomas, ['desayuno', 'merienda']), 'así la proteína baja algo menos (las comidas principales no se tocan)');
  // Ya cuadra
  const ya = reescalar({ recetario: bueno(), planes: PLAN, hoy: HOY });
  check(ya.innecesario && ya.cambios.length === 0 && ya.factor === 1, 'si ya cuadra en kcal, no hace falta factor');
  // Imposible con las comidas elegidas
  const imp = reescalar({ recetario: bueno(), planes: plan(1203, 150, 50, 30), hoy: HOY, tomas: ['merienda'] });
  check(imp.imposible && imp.cambios.length === 0, 'si con esas comidas no se llega (haría falta un factor negativo), lo dice');
  const tope = reescalar({ recetario: bueno(), planes: plan(3633, 150, 607, 67), hoy: HOY, tomas: ['merienda'] });
  check(tope.imposible && tope.topados === 3 && tope.cambios.every((x) => x.despues === 5), 'o si el factor se sale de lo que admite la app (0,25 a 5)');
  const justo = reescalar({ recetario: bueno(), planes: plan(1710, 150, 127, 67), hoy: HOY, tomas: ['merienda'] });
  check(!justo.imposible && justo.topados === 3 && justo.cambios.every((x) => x.despues === 0.25) && Math.abs(justo.dif.pct) < 5, 'si aun topado se queda cerca, vale');
  // Parte del factor que ya tenga cada receta
  const conF = recetario({ comida: [R('a', 50, 60, 20), R('b', 50, 60, 20)] }, { factores: { a: 1.5, b: 1.5 } });
  const rf = reescalar({ recetario: conF, planes: plan(620, 50, 60, 20), hoy: HOY });
  check(rf.factor === 0.67 && rf.cambios.every((x) => x.antes === 1.5 && x.despues === 1) && Math.abs(rf.dif.pct) < 1, 'multiplica el factor que ya tenía cada receta (1,5 × 0,67 = 1)');
  // Sin con qué comparar
  check(reescalar({ recetario: bueno(), planes: [], hoy: HOY }) === null && reescalar({ recetario: null, planes: PLAN, hoy: HOY }) === null
    && reescalar({ recetario: { ...bueno(), tomas: ['desayuno', 'media_manana', 'comida', 'merienda', 'cena'] }, planes: PLAN, hoy: HOY }) === null, 'sin plan, sin recetas o con una comida sin recetas, no se reescala');
  // Las recetas de los dos tipos de día se reescalan a la vez
  const op = recetario({ comida: [R('a', 50, 60, 20), R('g', 70, 90, 30)], merienda: [R('m', 20, 30, 14)] }, { opcional: 'merienda', variantes: { a: 'con', g: 'sin' } });
  check(reescalar({ recetario: op, planes: plan(1000, 80, 100, 30), hoy: HOY }).cambios.length === 3, 'con comida opcional, cambian también las recetas de los días sin ella');
}

console.log('El menú ya apuntado y el orden del equipo');
{
  const rec = recetario({ comida: [R('a', 50, 60, 20)], cena: [R('b', 40, 50, 10)] }, { factores: { a: 0.9 } });
  const E = (id, fecha, toma, receta_id, extra = {}) => ({ id, fecha, toma, receta_id, raciones: 1, kcal: 620, proteina_g: 50, carbos_g: 60, grasa_g: 20, hecho: false, ...extra });
  const entradas = [E('e1', HOY, 'comida', 'a'), E('e2', sumarDias(HOY, 1), 'comida', 'a', { raciones: 2, kcal: 1240, proteina_g: 100, carbos_g: 120, grasa_g: 40 }), E('e3', sumarDias(HOY, -1), 'comida', 'a'),
    E('e4', HOY, 'comida', 'a', { hecho: true }), E('e5', HOY, 'cena', null, { texto: 'Cena fuera' }), E('e6', HOY, 'cena', 'b', { kcal: 450, proteina_g: 40, carbos_g: 50, grasa_g: 10 }), E('e7', HOY, 'merienda', 'a'), E('e8', HOY, 'cena', 'zz')];
  const m = menuPorActualizar(entradas, rec, HOY);
  check(igual(m.map((x) => x.id), ['e1', 'e2', 'e7']), 'se ponen al día las comidas apuntadas desde hoy con receta del recetario (ni las pasadas, ni las ya comidas, ni los textos, ni lo que ya está bien)');
  check(igual(m[0].cambios, { kcal: 558, proteina_g: 45, carbos_g: 54, grasa_g: 18 }) && m[1].cambios.kcal === 1116, 'con los macros de ahora (su factor y sus raciones)');
  check(menuPorActualizar([], rec, HOY).length === 0 && menuPorActualizar(entradas, null, HOY).length === 0, 'sin menú o sin recetario, nada');
  const fila = (nombre, estado, pct = 0) => ({ atleta: { nombre }, comprobacion: { estado, dif: { pct } } });
  const orden = ordenRecetarios([fila('Zoe', 'cuadra'), fila('Ana', 'cuadra'), fila('Leo', 'kcal_recetas', 5), fila('Eva', 'no_cuadra', -6), fila('Gil', 'no_cuadra', 12), fila('Pau', 'sin_plan')]).map((x) => x.atleta.nombre);
  check(igual(orden, ['Gil', 'Eva', 'Leo', 'Pau', 'Ana', 'Zoe']), 'en la lista del equipo, primero lo que no cuadra (lo más lejos, antes) y al final lo que cuadra, por nombre');
  check(ordenRecetarios().length === 0, 'ordenar nada no rompe');
}

console.log('Con la demo (lo que lee y lo que guarda)');
{
  const { crearBackendMemoria } = await import('../web/src/datos/backend-memoria.js');
  const { semillaDemo } = await import('../web/src/datos/semilla-demo.js');
  const { crearApi } = await import('../web/src/datos/api.js');
  const { datosRecetario, corregirKcal, aplicarFactores, recetariosDelEquipo } = await import('../web/src/datos/recetario.js');
  const b = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  const api = crearApi(b);
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  const hoy = hoyISO();
  const equipo = await recetariosDelEquipo({ api, backend: b });
  const lucia = equipo.find((x) => x.atleta.nombre === 'Lucía Ferrer');
  check(equipo.length >= 2 && equipo.every((x) => x.atleta.estado === 'activo' && x.atleta.nutricion !== false) && !equipo.some((x) => x.atleta.nombre === 'Carlos Vera'), 'los recetarios del equipo: solo los atletas activos con nutrición');
  check(lucia.recetario.recetas.length === 9 && lucia.recetario.opcional === 'merienda' && lucia.planes.length >= 1, 'cada uno con su recetario (sus comidas, la opcional) y sus planes');
  const uno = await datosRecetario({ api }, lucia.atleta.id);
  check(igual(Object.keys(uno.recetario.porToma).sort(), Object.keys(lucia.recetario.porToma).sort())
    && comprobarRecetario({ ...uno, hoy }).dia.kcal === comprobarRecetario({ recetario: lucia.recetario, planes: lucia.planes, hoy }).dia.kcal, 'el recetario leído de una vez para todos da lo mismo que el de la ficha');
  const c0 = comprobarRecetario({ ...uno, hoy });
  check(c0.estado === 'no_cuadra' && c0.dif.pct < -5 && c0.kcalMal.length === 0, 'en la demo, el recetario de Lucía se queda corto para su plan');
  // Estropear las kcal de dos recetas y corregirlas
  const [r1, r2] = uno.recetario.recetas;
  await b.update('recetas', { kcal: Math.round(Number(r1.kcal) * 1.2) }, { eq: { id: r1.id } });
  await b.update('recetas', { kcal: Math.round(Number(r2.kcal) * 0.8) }, { eq: { id: r2.id } });
  // …y una comida suya ya apuntada para mañana con la primera
  const a1 = uno.recetario.asignaciones.find((a) => a.receta_id === r1.id);
  const manana = sumarDias(hoy, 1);
  const [apuntada] = await b.insert('menu_comidas', [{ atleta_id: lucia.atleta.id, fecha: manana, toma: a1.toma, receta_id: r1.id, texto: r1.nombre, raciones: 1, kcal: 999, proteina_g: 1, carbos_g: 1, grasa_g: 1, hecho: false, orden: 9 }]);
  const mal = comprobarRecetario({ ...(await datosRecetario({ api }, lucia.atleta.id)), hoy });
  check(mal.kcalMal.length === 2 && mal.kcalMal.every((x) => [r1.id, r2.id].includes(x.receta.id)), 'detecta las dos recetas con las kcal cambiadas');
  const res = await corregirKcal({ api, backend: b }, lucia.atleta.id, mal.kcalMal, { hoy });
  const tras = comprobarRecetario({ ...(await datosRecetario({ api }, lucia.atleta.id)), hoy });
  check(res.recetas === 2 && tras.kcalMal.length === 0, 'al corregir, sus kcal pasan a ser las de sus macros');
  const [fila] = await b.select('menu_comidas', { eq: { id: apuntada.id } });
  check(res.menu >= 1 && Number(fila.kcal) !== 999 && Number(fila.proteina_g) === Number(r1.proteina_g) * Number(a1.factor), 'y la comida que ya tenía apuntada para mañana lleva los macros de ahora');
  const [intacta] = await b.select('recetas', { eq: { id: r1.id } });
  check(Number(intacta.proteina_g) === Number(r1.proteina_g) && Number(intacta.carbos_g) === Number(r1.carbos_g) && intacta.nombre === r1.nombre && igual(intacta.ingredientes, (await b.select('recetas', { eq: { id: r1.id } }))[0].ingredientes), 'sin tocar sus macros, su nombre ni sus ingredientes');
  // Reescalar
  const antes = await datosRecetario({ api }, lucia.atleta.id);
  const r = reescalar({ ...antes, hoy });
  check(r && !r.innecesario && !r.imposible && r.factor > 1 && r.cambios.length === antes.recetario.asignaciones.length, 'propone un factor mayor que 1 para todo su recetario');
  const ap = await aplicarFactores({ api, backend: b }, lucia.atleta.id, r.cambios, { hoy });
  const despues = await datosRecetario({ api }, lucia.atleta.id);
  const cd = comprobarRecetario({ ...despues, hoy });
  check(ap.recetas === r.cambios.length && despues.recetario.asignaciones.every((a) => Number(a.factor) === r.cambios.find((x) => x.id === a.id).despues) && kcalCuadran(cd.dif), 'al aplicarlo, cada receta lleva su factor nuevo y las kcal del día cuadran con el plan');
  check(reescalar({ ...despues, hoy }).innecesario, 'y ya no hace falta otro factor');
  const [fila2] = await b.select('menu_comidas', { eq: { id: apuntada.id } });
  check(Math.abs(Number(fila2.proteina_g) - Number(r1.proteina_g) * r.cambios.find((x) => x.id === a1.id).despues) < 0.11, 'y lo apuntado para mañana sigue al factor nuevo');
  // Un atleta no puede tocar nada de esto
  await b.auth.salir();
  await b.auth.entrar('ana@fbe.demo', 'demo');
  let pudo = true;
  try { const x = await b.update('recetas', { kcal: 1 }, { eq: { id: r1.id } }); pudo = (x || []).length > 0; } catch { pudo = false; }
  check(!pudo, 'una atleta no puede cambiar las kcal de una receta (lo cierra la base, no esta pantalla)');
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
