// v0.229: carrera, mejoras 16 y 17 con la revisión del experto (R33-R41 y R46): el plan del día de la carrera, la
// recuperación y lo que sale del resultado (logica/carrera-dia.js).
import { planDiaCarrera, pasosCarrera, recuperacion, semanasRecuperacion, trasLaCarrera, previsionCarrera, esSemanaDeCarrera } from '../web/src/logica/carrera-dia.js';
import { semanaPlanValida, fmtTiempo } from '../web/src/logica/carrera.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const diez = { id: 'a', nombre: '10K', fecha: '2026-10-01', distancia_km: 10, resultado_seg: 2910 };
const mar = { id: 'm', nombre: 'Maratón', fecha: '2027-04-18', distancia_km: 42.195 };
const sec = (p, id) => p.secciones.find((x) => x.id === id)?.lineas.join(' ') || '';

console.log('El plan del día (mejora 16)');
const p0 = planDiaCarrera({ evento: mar, eventos: [diez, mar] });
check(p0.tramo === 'maraton' && p0.primero && p0.objetivo === previsionCarrera({ evento: mar, eventos: [diez, mar] }).hasta && /primer maratón/.test(p0.porQue),
  `(R34) primer maratón sin objetivo: el extremo prudente de la previsión (${fmtTiempo(p0.objetivo)})`);
check(/5 minutos andando o trotando/.test(sec(p0, 'calentar')) && /cajón/.test(sec(p0, 'calentar')), '(R33) calentar en maratón: 5 minutos, y movilidad si hay espera en el cajón');
check(/primer kilómetro/.test(sec(p0, 'ritmo')) && /cuestas, el esfuerzo parejo/.test(sec(p0, 'ritmo')), '(R34) ritmo parejo, el primer km algo más lento y, con cuestas, esfuerzo parejo');
check(/1-4 g por kg/.test(sec(p0, 'antes')) && /7-10 g por kg/.test(sec(p0, 'antes')) && /insulina o tomas sulfonilureas/.test(sec(p0, 'antes')) && !/unos/.test(sec(p0, 'antes')),
  '(R35) comer antes: 1-4 g/kg 1-4 h antes, 7-10 g/kg los días de antes, la diabetes la pauta el coach (sin su peso, sin gramos)');
check(/60 g de hidratos por hora/.test(sec(p0, 'durante')) && /mezcla de glucosa y fructosa/.test(sec(p0, 'durante')) && /más de 4 horas/.test(sec(p0, 'durante')),
  '(R36, R37) más de 2 h y media: 60 g/h (90 solo con mezcla probada); más de 4 h, no beber en todos los avituallamientos');
const p70 = planDiaCarrera({ evento: mar, eventos: [diez, mar], pesoKg: 70 });
check(/unos 70-280 g/.test(sec(p70, 'antes')) && /unos 490-700 g/.test(sec(p70, 'antes')) && /Unos 210 mg/.test(sec(p70, 'cafeina')),
  '(R35, R38) con su peso (70 kg): los gramos de hidratos y 210 mg de cafeína (3 mg/kg)');
check(/arritmias/.test(sec(p0, 'cafeina')) && /Cuenta la de los geles/.test(sec(p0, 'cafeina')) && /24 horas antes ni durante/.test(sec(p0, 'analgesicos')) && /pide ayuda/.test(sec(p0, 'mal')),
  '(R38, R46, R39) cafeína con sus límites, nada de analgésicos «por si acaso» y qué hacer si va mal');
const rapido = { ...mar, objetivo_seg: 13000 };
check(planDiaCarrera({ evento: rapido, eventos: [diez, rapido] }).avisos.some((a) => /más rápido que lo que dicen tus carreras/.test(a)), '(R34) un objetivo más rápido que la previsión: aviso');
const dosM = [diez, { id: 'x', nombre: 'Otro', fecha: '2026-04-01', distancia_km: 42.195, resultado_seg: 14000 }, { ...mar, objetivo_seg: 14200 }];
const pC = planDiaCarrera({ evento: dosM[2], eventos: dosM, temperatura: 24 });
check(pC.objetivo === previsionCarrera({ evento: dosM[2], eventos: dosM }).hasta && /calor/.test(pC.porQue) && pC.avisos.some((a) => /20 °C o más/.test(a)),
  '(R46) con 20 °C o más, el extremo lento de la previsión y por sensaciones');
check(planDiaCarrera({ evento: dosM[2], eventos: dosM, temperatura: 29 }).avisos.some((a) => /no es día de buscar marca/.test(a)), '(R46) con 28 °C o más, sin buscar marca');
const p10 = planDiaCarrera({ evento: { id: 'b', nombre: '10K', fecha: '2027-01-10', distancia_km: 10, objetivo_seg: 2700 }, eventos: [diez], pesoKg: 60 });
check(/10-15 minutos suaves y 4-6 rectas/.test(sec(p10, 'calentar')) && /2-3 horas antes \(unos 60 g/.test(sec(p10, 'antes')) && !/7-10 g/.test(sec(p10, 'antes')) && /Agua o un poco/.test(sec(p10, 'durante')),
  '(R33, R35, R36) un 10 km de 45 min: calentar 10-15 min y rectas, desayuno ligero de 1 g/kg, agua o un poco durante');
check(p10.ritmo === 270 && p10.pasos.length === 10 && p10.pasos[0].seg === 270 && p10.pasos[9].seg === 2700, 'sus pasos, km a km, a ritmo parejo (4:30 min/km)');
check(pasosCarrera(21.0975, 6300).map((x) => x.km).join() === '5,10,15,20,21.1' && pasosCarrera(5, 0).length === 0, 'en la media y el maratón, cada 5 km y la meta');
check(esSemanaDeCarrera({ fecha: '2026-12-01' }, '2026-11-25') && !esSemanaDeCarrera({ fecha: '2026-12-05' }, '2026-11-25') && !esSemanaDeCarrera({ fecha: '2026-11-20' }, '2026-11-25'), 'la semana de la carrera: 7 días o menos');

console.log('\nDespués de la carrera (mejora 17, R40 y R41)');
check(recuperacion({ km: 10 }).semanas === 0 && recuperacion({ km: 21.1 }).semanas === 1 && recuperacion({ km: 42.195 }).semanas === 2 && recuperacion({ km: 42.195, primero: true }).semanas === 3 && recuperacion({ km: 42.195, prudente: true }).semanas === 3,
  '(R40) 5-10 km, 2-3 días; media, una semana; maratón, dos (tres si es el primero o tiene más de 60 o vuelve de lesión)');
const sr = semanasRecuperacion({ fecha: '2027-04-18', km: 42.195, dias: 4, kmAntes: 50 });
check(sr.length === 2 && sr[0].lunes === '2027-04-19' && sr.every((w) => semanaPlanValida(w) && w.etiqueta === 'Recuperación' && !w.sesiones.some((x) => x.tipo === 'calidad')) && sr[0].sesiones[0].tipo === 'recuperacion' && sr[0].km_max < sr[1].km_max,
  '(R40) las semanas de recuperación para su plan: desde el lunes siguiente, sin calidad, de menos a más (la base las acepta)');
const t = trasLaCarrera({ evento: { ...mar, resultado_seg: 14100 }, eventos: [diez, mar] });
check(t.umbral > 0 && t.ratio === 0.96 && t.real === 14100, '(R41) con el resultado: el ritmo umbral que sale de él y lo real frente a lo previsto (0,96)');
check(trasLaCarrera({ evento: mar, eventos: [mar] }) === null && planDiaCarrera({ evento: {} }) === null, 'sin resultado o sin distancia, nada');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
