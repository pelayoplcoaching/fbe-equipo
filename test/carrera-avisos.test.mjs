// v0.222: carrera, tanda 3. Los avisos de riesgo, el ajuste de la semana siguiente, los choques con la fuerza y el resumen
// de cada corredor (logica/carrera-avisos.js), con las reglas aprobadas por Pelayo.
import { avisosCarrera, ajusteSiguiente, aplicarPropuesta, choquesFuerza, esPiernaPesada, resumenCorredor, resumenSemanas } from '../web/src/logica/carrera-avisos.js';
import { sumarDias } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

const HOY = '2026-11-25'; // miércoles
const L = '2026-11-23';
const run = (f, km, extra = {}, tipo = 'facil') => ({ fecha_realizada: f, completada: true, cardio: { modalidad: 'carrera', tipo }, cardio_hecho: { modalidad: 'carrera', minutos: Math.round(km * 6), km, ...extra } });
const semana = (lunes, kmin, kmax, sesiones = []) => ({ lunes, km_min: kmin, km_max: kmax, sesiones });
const ids = (a) => a.map((x) => x.id).sort().join(',');

console.log('Lo hecho por semana');
const r = resumenSemanas([run(sumarDias(L, -6), 10, { dolor: 2, semaforo: 'verde' }), run(sumarDias(L, -4), 6, { semaforo: 'ambar' }, 'calidad'), run(L, 5)], HOY, 2);
check(r.length === 2 && r[0].km === 16 && r[0].salidas === 2 && r[0].larga === 10 && r[0].dolorMax === 2 && r[0].ambar === 1 && r[0].duras.length === 1 && r[1].km === 5, 'por semana: km, salidas, la más larga, el dolor, los semáforos y las duras');

console.log('Sin nada raro, sin avisos');
const normal = [];
for (let w = 1; w <= 3; w++) for (const d of [1, 3, 6]) normal.push(run(sumarDias(L, -7 * w + d), 6, { dolor: 1, semaforo: 'verde' }, d === 6 ? 'larga' : d === 3 ? 'calidad' : 'facil'));
const planNormal = [1, 2, 3].map((w) => semana(sumarDias(L, -7 * w), 17, 19)).concat([semana(L, 18, 20, [{ tipo: 'calidad', dia: 2 }, { tipo: 'facil', dia: 4 }, { tipo: 'larga', dia: 7 }])]);
check(avisosCarrera({ semanas: planNormal, hechas: normal, hoy: HOY }).length === 0, 'tres semanas de 18 km, en verde y con poco dolor: nada que avisar');

console.log('Subida brusca');
const subida = [...normal.filter((x) => x.fecha_realizada < sumarDias(L, -7)), run(sumarDias(L, -6), 10), run(sumarDias(L, -4), 8), run(sumarDias(L, -1), 9)];
const as = avisosCarrera({ semanas: planNormal, hechas: subida, hoy: HOY });
const sub = as.find((a) => a.id === 'subida');
check(sub && sub.propuesta.tipo === 'tope' && sub.propuesta.km === 29.7 && /un 50 % más/.test(sub.texto), `27 km tras dos de 18: aviso y que esta no pase de un 10 % más (${sub?.texto} → ${sub?.propuesta.texto})`);

console.log('Dolor');
const dolorAlto = [...normal, run(sumarDias(L, -2), 6, { dolor: 6 })];
const da = avisosCarrera({ semanas: planNormal, hechas: dolorAlto, hoy: HOY }).find((a) => a.id === 'dolor-alto');
check(da && da.nivel === 'rojo' && da.propuesta.tipo === 'parar', 'con 6/10: rojo, parar y valorar');
const dolorSube = normal.map((x) => ({ ...x, cardio_hecho: { ...x.cardio_hecho, dolor: x.fecha_realizada >= sumarDias(L, -7) ? 4 : x.fecha_realizada >= sumarDias(L, -14) ? 2 : 1 } }));
const dsu = avisosCarrera({ semanas: planNormal, hechas: dolorSube, hoy: HOY }).find((a) => a.id === 'dolor-sube');
check(dsu && dsu.nivel === 'ambar' && dsu.propuesta.tipo === 'bajar' && dsu.propuesta.pct === 25 && dsu.propuesta.lunes === L, 'de 2 a 4/10 de una semana a otra: va a más, bajar un 25 % esta semana');
check(!avisosCarrera({ semanas: planNormal, hechas: normal.map((x) => ({ ...x, cardio_hecho: { ...x.cardio_hecho, dolor: 4 } })), hoy: HOY }).some((a) => /dolor/.test(a.id)), 'un 4/10 que no empeora está dentro de lo que se acepta: sin aviso');

console.log('Semáforo antes de salir');
const sema = [...normal, run(L, 5, { semaforo: 'rojo' })];
const se = avisosCarrera({ semanas: planNormal, hechas: sema, hoy: HOY }).find((a) => a.id === 'semaforo');
check(se && /Esta semana: 1 en rojo/.test(se.texto) && se.propuesta.lunes === sumarDias(L, 7), 'un rojo esta semana: la que viene, más suave');
const dosAmbar = normal.map((x, i) => (x.fecha_realizada >= sumarDias(L, -7) && i % 3 !== 2 ? { ...x, cardio_hecho: { ...x.cardio_hecho, semaforo: 'ambar' } } : x));
check(avisosCarrera({ semanas: planNormal, hechas: dosAmbar, hoy: HOY }).find((a) => a.id === 'semaforo')?.propuesta.lunes === L, 'dos ámbar la semana pasada: esta, más suave');

console.log('Cumplimiento, tirada larga y días seguidos');
const poco = normal.filter((x) => !(x.fecha_realizada >= sumarDias(L, -14) && x.fecha_realizada < L && x.cardio.tipo !== 'larga'));
check(avisosCarrera({ semanas: planNormal, hechas: poco, hoy: HOY }).some((a) => a.id === 'cumplimiento' && a.propuesta.tipo === 'rehacer'), 'dos semanas por debajo del 70 %: proponer rehacer el plan');
// (v0.227, R25) El tope de la tirada larga depende de los días: 65 % con 2 salidas, 60 % con 3, 55 % con 4, 45 % con 5 o más
const conLarga = (km) => [...normal.filter((x) => x.fecha_realizada < sumarDias(L, -7)), run(sumarDias(L, -7), 4), run(sumarDias(L, -5), 4), run(sumarDias(L, -1), km, {}, 'larga')];
const larga = conLarga(13);
const al = avisosCarrera({ semanas: planNormal, hechas: larga, hoy: HOY }).find((a) => a.id === 'larga');
check(al && /más del 60 % con 3 salidas/.test(al.texto), `una tirada de 13 km en una semana de 21 con 3 salidas: más del 60 %, aviso («${al?.texto}»)`);
check(!avisosCarrera({ semanas: planNormal, hechas: conLarga(12), hoy: HOY }).some((a) => a.id === 'larga'), '12 km de 20 con 3 salidas: justo el 60 %, sin aviso (antes, con el 35 % fijo, avisaba)');
const cincoLarga = [...normal.filter((x) => x.fecha_realizada < sumarDias(L, -7)), ...[1, 2, 3, 4].map((d) => run(sumarDias(L, -8 + d), 4)), run(sumarDias(L, -1), 14, {}, 'larga')];
check(avisosCarrera({ semanas: planNormal, hechas: cincoLarga, hoy: HOY }).some((a) => a.id === 'larga' && /45 % con 5 salidas/.test(a.texto)), '14 km de 30 con 5 salidas: más del 45 %, aviso');
const planSeguidas = planNormal.slice(0, 3).concat([semana(L, 18, 20, [{ tipo: 'calidad', dia: 2 }, { tipo: 'larga', dia: 3 }, { tipo: 'facil', dia: 5 }])]);
const seg = avisosCarrera({ semanas: planSeguidas, hechas: normal, hoy: HOY }).find((a) => a.id === 'seguidas');
check(seg && seg.propuesta?.tipo === 'mover', 'calidad el martes y tirada larga el miércoles en el plan de esta semana: dos días duros seguidos');

console.log('El ajuste de la semana siguiente');
const planAj = [semana(sumarDias(L, -14), 17, 19), semana(sumarDias(L, -7), 18, 20), semana(L, 20, 22, [{ tipo: 'facil', titulo: 'Rodaje', km: 8 }, { tipo: 'larga', titulo: 'Tirada', km: 10 }])];
const verde = [run(sumarDias(L, -6), 7, { semaforo: 'verde' }), run(sumarDias(L, -4), 6, { semaforo: 'verde' }), run(sumarDias(L, -1), 6, { semaforo: 'verde' })];
const aj1 = ajusteSiguiente({ semanas: planAj, hechas: verde, hoy: HOY });
check(aj1.decision === 'seguir' && aj1.lunes === L && aj1.nueva === null && aj1.pct === 100, `todo en verde y el ${aj1.pct} %: sigue el plan`);
const conAmbar = verde.map((x, i) => (i === 1 ? { ...x, cardio_hecho: { ...x.cardio_hecho, semaforo: 'ambar' } } : x));
const aj2 = ajusteSiguiente({ semanas: planAj, hechas: conAmbar, hoy: HOY });
check(aj2.decision === 'repetir' && aj2.nueva && aj2.nueva.km_min < 20 && aj2.nueva.sesiones[0].km < 8, `algún ámbar: se repite el volumen (${aj2.nueva?.km_min}-${aj2.nueva?.km_max} km en lugar de 20-22)`);
const corto = verde.slice(0, 2);
const ajc = ajusteSiguiente({ semanas: planAj, hechas: corto, hoy: HOY });
check(ajc.decision === 'bajar' && ajc.pct === 68 && ajc.nueva.km_min === 15, `(R28) el 68 % de los km, por debajo del 70 %: bajar un 25 % («${ajc.motivo}»)`);
const casi = [run(sumarDias(L, -6), 7, { semaforo: 'verde' }), run(sumarDias(L, -4), 6, { semaforo: 'verde' }), run(sumarDias(L, -1), 2.5, { semaforo: 'verde' })];
const ajr = ajusteSiguiente({ semanas: planAj, hechas: casi, hoy: HOY });
check(ajr.decision === 'repetir' && ajr.pct === 82 && ajr.nueva.km_max <= 20, `el 82 %, entre el 70 y el 90 %: se repite el volumen (${ajr.nueva?.km_min}-${ajr.nueva?.km_max} km)`);
const rojo = verde.map((x, i) => (i === 0 ? { ...x, cardio_hecho: { ...x.cardio_hecho, semaforo: 'rojo' } } : x));
const aj3 = ajusteSiguiente({ semanas: planAj, hechas: rojo, hoy: HOY });
check(aj3.decision === 'bajar' && aj3.nueva.km_min === 15 && aj3.nueva.sesiones[1].km === 7.5, `un rojo: bajar un 25 % (${aj3.nueva?.km_min}-${aj3.nueva?.km_max} km; la tirada, ${aj3.nueva?.sesiones[1].km})`);
check(ajusteSiguiente({ semanas: [], hechas: verde, hoy: HOY }) === null, 'sin plan, no propone nada');

console.log('Quien apunta solo minutos');
const soloMin = (f) => ({ fecha_realizada: f, completada: true, cardio: { modalidad: 'carrera', tipo: 'facil' }, cardio_hecho: { modalidad: 'carrera', minutos: 40, semaforo: 'verde' } });
const minutos = [-13, -11, -9, -6, -4, -2].map((d) => soloMin(sumarDias(L, d)));
check(!avisosCarrera({ semanas: planAj, hechas: minutos, hoy: HOY }).some((a) => a.id === 'cumplimiento'), 'con salidas sin km apuntados, no se le dice que va por debajo de lo previsto');
const ajm = ajusteSiguiente({ semanas: planAj, hechas: minutos, hoy: HOY });
check(ajm.decision === 'seguir' && /sin datos para comparar/.test(ajm.motivo) && ajm.pct === null, `el plan va en km y él apunta minutos: el ajuste, por los semáforos («${ajm.motivo}»)`);
// (v0.227, R28) Si el plan también va en minutos, el cumplimiento se calcula en minutos
const planMin = [semana(sumarDias(L, -14), null, null, [{ tipo: 'facil', minutos: 40 }, { tipo: 'facil', minutos: 40 }, { tipo: 'larga', minutos: 60 }]),
  semana(sumarDias(L, -7), null, null, [{ tipo: 'facil', minutos: 40 }, { tipo: 'facil', minutos: 40 }, { tipo: 'larga', minutos: 60 }]),
  semana(L, null, null, [{ tipo: 'facil', minutos: 45 }, { tipo: 'facil', minutos: 45 }, { tipo: 'larga', minutos: 65 }])];
const tresMin = [-6, -4, -1].map((d) => soloMin(sumarDias(L, d)));
const ajMin = ajusteSiguiente({ semanas: planMin, hechas: tresMin, hoy: HOY });
const minNueva = (ajMin?.nueva?.sesiones || []).reduce((a, x) => a + x.minutos, 0);
check(ajMin.decision === 'repetir' && ajMin.pct === 86 && minNueva >= 138 && minNueva <= 142, `plan en minutos: 120 de 140 min (el 86 %), se repite el volumen (${minNueva} min en lugar de 155)`);
check(ajusteSiguiente({ semanas: planMin, hechas: tresMin.slice(0, 2), hoy: HOY }).decision === 'bajar', 'plan en minutos: 80 de 140 min (el 57 %), bajar');
const dosRojas = [-13, -11, -6].map((d) => soloMin(sumarDias(L, d)));
check(avisosCarrera({ semanas: planMin, hechas: dosRojas, hoy: HOY }).some((a) => a.id === 'cumplimiento'), 'plan en minutos: dos semanas por debajo del 70 % de los minutos, proponer rehacer');
check(ajusteSiguiente({ semanas: planAj, hechas: [], hoy: HOY }).motivo === 'No apuntó ninguna carrera', 'sin ninguna carrera apuntada, se repite el volumen («No apuntó ninguna carrera»)');

console.log('Aplicar una propuesta');
const bajada = aplicarPropuesta({ tipo: 'bajar', pct: 25 }, planAj[2]);
check(bajada.lunes === L && bajada.km_min === 15 && bajada.sesiones[0].km === 6, 'bajar un 25 %: los km de la semana y de cada sesión');
const tope = aplicarPropuesta({ tipo: 'tope', km: 19.8 }, planAj[2]);
check(tope && tope.km_max <= 19.8 && aplicarPropuesta({ tipo: 'tope', km: 30 }, planAj[2]) === null, 'el tope: si ya está por debajo, nada que cambiar');

console.log('Choques con la fuerza');
check(esPiernaPesada([{ series: 4, grupos_musculares: ['Cuádriceps', 'Glúteo'] }, { series: 3, grupos_musculares: ['Isquiotibiales'] }, { series: 3, grupos_musculares: ['Pecho'] }])
  && !esPiernaPesada([{ series: 4, grupos_musculares: ['Pecho'] }, { series: 3, grupos_musculares: ['Espalda'] }, { series: 2, grupos_musculares: ['Cuádriceps'] }]), 'pierna pesada: la mitad o más de las series, de pierna');
const ch = choquesFuerza({ fuerza: [{ dia: 1, pierna: true, nombre: 'Pierna A' }, { dia: 4, pierna: false, nombre: 'Torso' }], carreras: [{ dia: 2, tipo: 'calidad', titulo: 'Series' }, { dia: 7, tipo: 'larga', titulo: 'Tirada' }, { dia: 5, tipo: 'facil' }] });
check(ch.length === 1 && ch[0].tipo === 'despues' && ch[0].carrera.titulo === 'Series' && ch[0].fuerza.nombre === 'Pierna A' && ch[0].propuesta === 3, `las series el día después de pierna: moverlas al miércoles (día ${ch[0]?.propuesta})`);
// (v0.227, R27) El día antes, solo aviso; el mismo día vale (con la carrera primero); con margen 2, también dos días después
const antes = choquesFuerza({ fuerza: [{ dia: 3, pierna: true }], carreras: [{ dia: 2, tipo: 'calidad' }] });
check(antes.length === 1 && antes[0].tipo === 'antes' && antes[0].propuesta === null, 'las series el día antes de pierna: aviso, sin mover nada');
const mismo = choquesFuerza({ fuerza: [{ dia: 4, pierna: true }], carreras: [{ dia: 4, tipo: 'calidad' }] });
check(mismo.length === 1 && mismo[0].tipo === 'mismo' && mismo[0].propuesta === null, 'series y pierna el mismo día: vale, con un recordatorio (primero la carrera)');
const fz2 = { fuerza: [{ dia: 1, pierna: true }], carreras: [{ dia: 3, tipo: 'calidad' }, { dia: 7, tipo: 'larga' }] };
const m2 = choquesFuerza({ ...fz2, margen: 2 });
check(choquesFuerza(fz2).length === 0 && m2.length === 1 && m2[0].tipo === 'despues' && m2[0].propuesta === 4, `con 48 h de margen (más de 60, nuevo o con agujetas), las series dos días después de pierna también se mueven (al día ${m2[0]?.propuesta})`);
check(choquesFuerza({ fuerza: [{ dia: 3, pierna: true }], carreras: [{ dia: 1, tipo: 'calidad' }, { dia: 6, tipo: 'larga' }] }).length === 0, 'separadas de la pierna, sin choque');

console.log('Tope por salida (R42), lo de más (R24) y la subida como aviso suave (R21)');
const conSalida = (km, tipo = 'facil') => [...normal.filter((x) => x.fecha_realizada < sumarDias(L, -7)), run(sumarDias(L, -7), 6), run(sumarDias(L, -5), 6), run(sumarDias(L, -1), km, {}, tipo)];
const sal = (km, tipo) => avisosCarrera({ semanas: planNormal, hechas: conSalida(km, tipo), hoy: HOY }).find((a) => a.id === 'salida');
check(!sal(6.5), '6,5 km cuando la más larga del mes fue de 6: menos de un 10 % más, sin aviso');
const s7 = sal(7.5);
check(s7 && s7.nivel === 'ambar' && s7.propuesta === null && /un 25 % más/.test(s7.texto), `7,5 km frente a 6: aviso, sin tocar la semana («${s7?.texto}»)`);
const s9 = sal(9, 'larga');
check(s9 && s9.propuesta?.tipo === 'tope' && s9.propuesta.lunes === L && s9.propuesta.km === 21, `9 km frente a 6 (un 50 % más): aviso y que esta semana no suba (${s9?.propuesta?.texto})`);
check(!sal(21, 'carrera'), 'una carrera de 21 km no cuenta: el tope es para los entrenamientos');
const mas = [...normal.filter((x) => x.fecha_realizada < sumarDias(L, -7)), run(sumarDias(L, -7), 6.5), run(sumarDias(L, -5), 6.5), run(sumarDias(L, -3), 6.5), run(sumarDias(L, -1), 2.5)];
const avMas = avisosCarrera({ semanas: planNormal, hechas: mas, hoy: HOY });
check(ids(avMas) === 'exceso' && /el 122 % de lo previsto/.test(avMas[0].texto), `22 km de 18 previstos: más del 115 %, aviso (${ids(avMas)})`);
const ajMas = ajusteSiguiente({ semanas: planNormal, hechas: mas, hoy: HOY });
check(ajMas.decision === 'repetir' && /más de lo previsto/.test(ajMas.motivo) && ajMas.nueva.km_max <= 19, `y el ajuste: no subir («${ajMas.motivo}»)`);
const cinco = [...normal.filter((x) => x.fecha_realizada < sumarDias(L, -7)), ...[1, 2, 3, 4, 5].map((d) => run(sumarDias(L, -8 + d), 6))];
const planSin = planNormal.filter((s) => s.lunes !== sumarDias(L, -7));
const av5 = avisosCarrera({ semanas: planSin, hechas: cinco, hoy: HOY });
check(ids(av5) === 'subida' && av5[0].nivel === 'info' && resumenCorredor({ semanas: planSin, hechas: cinco, hoy: HOY }).nivel === 'verde', `cinco salidas de 6 km tras semanas de 18: la subida, como aviso suave que no pinta al corredor de ámbar (${ids(av5)})`);
const conCarrera = [...normal, run(sumarDias(L, -2), 21, {}, 'carrera')];
const rs = resumenSemanas(conCarrera, HOY, 2);
check(rs[0].km === 18 && rs[0].salidas === 4 && rs[0].larga === 6 && rs[0].entrenos === 3, 'la carrera cuenta como salida, pero no en los km ni como la más larga (el plan va sin ella)');

console.log('El resumen de un corredor');
const rc = resumenCorredor({ semanas: planNormal, hechas: [...normal, run(L, 5, { semaforo: 'ambar' })], eventos: [{ nombre: 'Media', fecha: sumarDias(HOY, 30), decision: 'va' }, { nombre: 'Vieja', fecha: sumarDias(HOY, -3) }], hoy: HOY });
check(rc.km === 5 && rc.salidas === 1 && rc.plan.km_min === 18 && rc.plan.sesiones === 3 && rc.semaforos.ambar === 1 && rc.proxima.nombre === 'Media' && rc.dias === 30 && rc.nivel === 'verde',
  'esta semana: sus km frente al plan, sus semáforos, la próxima carrera y su color');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
