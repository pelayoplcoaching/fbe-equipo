// (v0.184) El editor manual del programa: las cuentas (deshacer, valores de partida, atajos, + y −, reordenar) y las
// operaciones nuevas contra la demo (copiar una sesión, duplicar un ejercicio, ordenar, añadir varios).
//   node test/editor.test.mjs
import { CAMPOS_PAUTA, filaDe, antesDe, etiquetaCambio, apilar, cambiarId, basePauta, tipoDe, DESCANSO_TIPO, comoLaAnterior, detalleDeHechas, pasoDe, saltoKg, igualarSeries, reordenar, resumenSesion } from '../web/src/logica/editor.js';
import { REGLAS_FBE, resolverReglas } from '../web/src/logica/motor/index.js';
import { crearBackendMemoria } from '../web/src/datos/backend-memoria.js';
import { semillaDemo } from '../web/src/datos/semilla-demo.js';
import { crearApi } from '../web/src/datos/api.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
process.on('unhandledRejection', (e) => { console.error('ERROR:', e.stack); process.exit(1); });

console.log('Deshacer');
const d = { bloque: { id: 'b', nombre: 'Uno' }, semanas: [{ id: 'w1', foco: null }], sesiones: { w1: [{ id: 's1', nombre: 'Torso' }] },
  pautas: { s1: [{ id: 'p1', series: 3, reps_min: 6, reps_max: 8, carga_sugerida_kg: 50, series_detalle: null }, { id: 'p2', series: 2 }] } };
check(filaDe(d, 'sesion_ejercicios', 'p2').series === 2 && filaDe(d, 'sesiones', 's1').nombre === 'Torso' && filaDe(d, 'semanas', 'w1').id === 'w1' && filaDe(d, 'bloques', 'b').nombre === 'Uno' && filaDe(d, 'sesion_ejercicios', 'x') === null, 'encuentra la fila en lo cargado (bloque, semana, sesión, ejercicio)');
check(igual(antesDe(d, 'sesion_ejercicios', 'p1', { carga_sugerida_kg: 52.5 }), { carga_sugerida_kg: 50 }), 'guarda lo que había en el campo que cambia');
check(antesDe(d, 'sesion_ejercicios', 'p1', { carga_sugerida_kg: 50 }) === null, 'si no cambia nada, no hay nada que deshacer');
check(igual(antesDe(d, 'sesion_ejercicios', 'p1', ['series', 'rpe_objetivo']), { series: 3, rpe_objetivo: null }), 'con una lista de campos, la foto de todos (los que faltan, null)');
check(etiquetaCambio('sesion_ejercicios', { carga_sugerida_kg: 1 }, 'Sentadilla') === 'Kilos de Sentadilla' && etiquetaCambio('sesiones', { nombre: 'x' }) === 'Nombre de la sesión' && etiquetaCambio('sesion_ejercicios', { a: 1, b: 2, c: 3 }, 'Remo') === 'Cambios de Remo', 'el botón dice qué deshace');
let pila = [];
for (let i = 0; i < 35; i++) pila = apilar(pila, { id: `p${i}` });
check(pila.length === 30 && pila[29].id === 'p34' && pila[0].id === 'p5', 'la pila guarda los 30 últimos');
check(igual(cambiarId([{ id: 'a' }, { id: 'b' }, { fila: { id: 'a' } }], 'a', 'z'), [{ id: 'z' }, { id: 'b' }, { fila: { id: 'z' } }]), 'un ejercicio que vuelve con otro id: los pasos anteriores le siguen');

console.log('Valores de partida de un ejercicio nuevo');
const basico = { nombre: 'Sentadilla', tipo: ['basico'] }, multi = { nombre: 'Remo en polea', tipo: ['multiarticular'] }, aisla = { nombre: 'Curl de bíceps', tipo: ['aislamiento'] }, hip = { nombre: 'Hip thrust con barra', tipo: ['basico'] };
check(tipoDe(basico) === 'basico' && tipoDe(multi) === 'multiarticular' && tipoDe(aisla) === 'aislamiento' && tipoDe({}) === 'multiarticular', 'el tipo sale de la biblioteca (sin tipo, multiarticular)');
const R = resolverReglas({});
check(igual(basePauta(basico, R), { prioridad: 'media', series: 3, reps_min: 6, reps_max: 10, descanso_seg: 180 }), 'un básico: 3 × 6–10 y 3 min');
check(igual(basePauta(multi, R), { prioridad: 'media', series: 3, reps_min: 8, reps_max: 12, descanso_seg: 120 }), 'un multiarticular: 3 × 8–12 y 2 min');
check(igual(basePauta(aisla, R), { prioridad: 'media', series: 3, reps_min: 10, reps_max: 15, descanso_seg: 90 }), 'un aislamiento: 3 × 10–15 y 1:30');
check(basePauta(hip, R).reps_min === 8 && basePauta(hip, R).reps_max === 12, 'el hip thrust, de 8 a 12 aunque sea básico');
check(igual(Object.keys(DESCANSO_TIPO), ['basico', 'multiarticular', 'aislamiento']), 'un descanso por tipo');

console.log('«Como la semana pasada» y «Lo que hizo»');
const previa = { series: 3, reps_min: 6, reps_max: 8, rir_objetivo: 2, rpe_objetivo: null, carga_sugerida_kg: 47.5, backoff_pct: null, series_detalle: null, notas_coach: 'no se copia' };
const c = comoLaAnterior(previa);
check(igual(Object.keys(c), CAMPOS_PAUTA) && c.carga_sugerida_kg === 47.5 && c.series_detalle === null && !('notas_coach' in c), 'copia la prescripción entera y nada más');
const conDetalle = comoLaAnterior({ series: 2, series_detalle: [{ reps: 5, kg: 60, rpe: 8 }, { reps: 8, kg: 50, rpe: 8 }] });
check(conDetalle.series_detalle.length === 2, 'si iba serie a serie, serie a serie');
check(igual(detalleDeHechas([{ numero: 2, reps: 7, kg: 42.5, rpe: 8.5 }, { numero: 1, reps: 8, kg: 42.5, rir: 2 }]), [{ reps: 8, kg: 42.5, rpe: 8 }, { reps: 7, kg: 42.5, rpe: 8.5 }]), 'lo que hizo: una fila por serie, en orden, con el RPE (o 10 − RIR)');
check(detalleDeHechas([]) === null && detalleDeHechas([{ numero: 1, reps: null, kg: null }]) === null, 'sin series hechas, nada');

console.log('Botones + y −');
check(pasoDe('50', 2.5, 1) === 52.5 && pasoDe('50', 2.5, -1) === 47.5 && pasoDe('52,5', 2.5, 1) === 55, 'sube y baja con el salto (con coma o punto)');
check(pasoDe('', 2.5, 1) === 2.5 && pasoDe('', 2.5, -1) === null && pasoDe('1', 2.5, -1) === 0 && pasoDe('abc', 1, 1) === null, 'de vacío parte del salto; nunca baja de 0; texto raro, nada');
check(pasoDe('8', 1, 1) === 9 && pasoDe('0.1', 0.1, 1) === 0.2, 'repeticiones de una en una; sin decimales raros');
check(saltoKg('Sentadilla', 100) === 2.5 && saltoKg('Press con mancuernas', 20, resolverReglas({ atleta: { salto: { mancuernas: 2 } } })) === 2 && saltoKg('Curl', 10, { ...REGLAS_FBE, salto: { tipo: 'kg', valor: 1 } }) === 1, 'el salto: 2,5 de partida, las mancuernas de su gimnasio y el fijo de la regla');

console.log('Igualar series, reordenar y el resumen de una sesión plegada');
check(igual(igualarSeries([{ reps: 5, kg: 60, rpe: 8 }, { reps: 8, kg: 50, rpe: 7 }, { reps: 8 }]), [{ reps: 5, kg: 60, rpe: 8 }, { reps: 5, kg: 60, rpe: 8 }, { reps: 5, kg: 60, rpe: 8 }]), 'las demás series quedan como la primera');
check(igual(reordenar(['a', 'b', 'c', 'd'], 0, 2), ['b', 'c', 'a', 'd']) && igual(reordenar(['a', 'b', 'c', 'd'], 3, 0), ['d', 'a', 'b', 'c']) && igual(reordenar(['a', 'b'], 1, 1), ['a', 'b']) && igual(reordenar(['a', 'b'], 0, 9), ['b', 'a']), 'mover un elemento a otra posición');
check(resumenSesion({ tipo: 'fuerza' }, [{ series: 3 }, { series: 4 }]) === '2 ejercicios · 7 series' && resumenSesion({ tipo: 'cardio' }, []) === 'cardio' && resumenSesion({}, []) === 'vacía' && resumenSesion({ cardio: {} }, [{ series: 1 }]) === '1 ejercicio · 1 serie · cardio', 'el resumen de la sesión plegada');

console.log('Contra la demo: copiar, duplicar, ordenar y añadir varios');
const b = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
const api = crearApi(b);
await b.auth.entrar('pelayo@fbe.demo', 'demo');
const anaId = (await api.resumenes()).find((x) => x.nombre === 'Ana López').atleta_id;
const bloques = (await b.select('bloques', { eq: { atleta_id: anaId } })).filter((x) => !x.es_plantilla);
const bloque = bloques.find((x) => ['activo', 'ajustado'].includes(x.estado)) || bloques[0];
let dd = await api.bloqueCompleto(bloque.id);
const sem = dd.semanas[dd.semanas.length - 1], otra = dd.semanas[0];
const ses = dd.sesiones[sem.id][0];
const pautas0 = dd.pautas[ses.id];
check(pautas0.length >= 3, `la sesión de prueba tiene ejercicios (${pautas0.length})`);
// ordenar
const ids = pautas0.map((p) => p.id);
await api.ordenarPautas(ses.id, reordenar(ids, 0, 2));
dd = await api.bloqueCompleto(bloque.id);
check(igual(dd.pautas[ses.id].map((p) => p.id), reordenar(ids, 0, 2)) && igual(dd.pautas[ses.id].map((p) => p.orden), ids.map((_, k) => k + 1)), 'ordenarPautas deja el orden pedido, del 1 en adelante');
await api.ordenarPautas(ses.id, ids);
// duplicar
const copia = await api.duplicarPauta(ids[1]);
dd = await api.bloqueCompleto(bloque.id);
const tras = dd.pautas[ses.id];
check(tras.length === ids.length + 1 && tras[2].id === copia.id && tras[2].ejercicio_id === tras[1].ejercicio_id && tras[2].series === tras[1].series && tras[2].reps_max === tras[1].reps_max && (dd.series[copia.id] || []).length === 0, 'duplicarPauta: el mismo ejercicio justo debajo, con su prescripción y sin series registradas');
await api.borrar('sesion_ejercicios', copia.id);
// añadir varios
const lib = (await api.biblioteca()).slice(0, 2);
const nuevas = await api.nuevasPautas(ses.id, lib.map((e) => ({ ejercicio_id: e.id, ...basePauta(e, R) })));
dd = await api.bloqueCompleto(bloque.id);
const fin = dd.pautas[ses.id].slice(-2);
check(nuevas.length === 2 && igual(fin.map((p) => p.ejercicio_id), lib.map((e) => e.id)) && fin[0].orden < fin[1].orden && fin[0].series === 3 && fin[0].reps_min === basePauta(lib[0], R).reps_min && fin[0].descanso_seg === basePauta(lib[0], R).descanso_seg && fin[0].rir_objetivo === 2, 'nuevasPautas: varios de una vez, al final, en orden y con sus valores de partida');
for (const n of nuevas) await api.borrar('sesion_ejercicios', n.id);
check((await api.nuevasPautas(ses.id, [])).length === 0, 'sin lista, no hace nada');
// copiar sesión
const nSes = dd.sesiones[sem.id].length, nOtra = dd.sesiones[otra.id].length;
const dup = await api.copiarSesion(ses.id, sem.id);
const aOtra = await api.copiarSesion(ses.id, otra.id);
dd = await api.bloqueCompleto(bloque.id);
const sDup = dd.sesiones[sem.id].find((x) => x.id === dup.id), sOtra = dd.sesiones[otra.id].find((x) => x.id === aOtra.id);
check(dd.sesiones[sem.id].length === nSes + 1 && sDup.nombre === `${ses.nombre} (copia)` && dd.sesiones[sem.id][nSes].id === dup.id, 'copiarSesion en la misma semana: «(copia)», al final');
check(dd.sesiones[otra.id].length === nOtra + 1 && sOtra.nombre === ses.nombre && sOtra.completada !== true, 'copiarSesion a otra semana: con su nombre, sin marcar como hecha');
const pd = dd.pautas[dup.id], po = dd.pautas[ses.id];
check(pd.length === po.length && pd.every((p, k) => p.ejercicio_id === po[k].ejercicio_id && p.series === po[k].series && p.carga_sugerida_kg === po[k].carga_sugerida_kg && p.id !== po[k].id) && pd.every((p) => !(dd.series[p.id] || []).length), 'lleva sus ejercicios con la misma prescripción y nada de lo registrado');
// ordenar sesiones
const idsS = dd.sesiones[sem.id].map((x) => x.id);
await api.ordenarSesiones(sem.id, reordenar(idsS, idsS.length - 1, 0));
dd = await api.bloqueCompleto(bloque.id);
check(dd.sesiones[sem.id][0].id === dup.id && igual(dd.sesiones[sem.id].map((x) => x.orden), idsS.map((_, k) => k + 1)), 'ordenarSesiones: la copia pasa a ser la primera');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
