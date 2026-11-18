// (v0.184) El editor manual del programa: las cuentas (deshacer, valores de partida, atajos, + y −, reordenar) y las
// operaciones nuevas contra la demo (copiar una sesión, duplicar un ejercicio, ordenar, añadir varios).
//   node test/editor.test.mjs
import { CAMPOS_PAUTA, filaDe, antesDe, etiquetaCambio, apilar, cambiarId, basePauta, tipoDe, DESCANSO_TIPO, comoLaAnterior, detalleDeHechas, pasoDe, saltoKg, igualarSeries, reordenar, resumenSesion,
  kilosDe, revisarSemana, SALTO_AVISO_PCT, cambiosDeSemana, parejasSiguientes, LLEVAR, cambiosParaPareja, ordenBuscador, conReciente, usosEnBloque, notasFrecuentes, conNota, historialParaEditor } from '../web/src/logica/editor.js';
import { REGLAS_FBE, resolverReglas } from '../web/src/logica/motor/index.js';
import { crearBackendMemoria } from '../web/src/datos/backend-memoria.js';
import { semillaDemo } from '../web/src/datos/semilla-demo.js';
import { crearApi, NOMBRE_GUARDADAS } from '../web/src/datos/api.js';

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
// La base real no admite dos sesiones de una semana con el mismo orden: se vigila cada escritura
let choque = 0;
const update0 = b.update.bind(b);
b.update = async (tabla, cambios, filtro) => {
  const r = await update0(tabla, cambios, filtro);
  if (tabla === 'sesiones' && 'orden' in cambios) { const o = (await b.select('sesiones', { eq: { semana_id: sem.id } })).map((x) => x.orden); if (new Set(o).size !== o.length) choque++; }
  return r;
};
await api.ordenarSesiones(sem.id, reordenar(idsS, idsS.length - 1, 0));
b.update = update0;
check(choque === 0, 'al reordenar sesiones nunca hay dos con el mismo orden a la vez (la base no lo admite)');
dd = await api.bloqueCompleto(bloque.id);
check(dd.sesiones[sem.id][0].id === dup.id && igual(dd.sesiones[sem.id].map((x) => x.orden), idsS.map((_, k) => k + 1)), 'ordenarSesiones: la copia pasa a ser la primera');


// ===================================================================================================== v0.185
console.log('Revisar antes de publicar');
const SS = [{ id: 's1', nombre: 'Torso', tipo: 'fuerza' }, { id: 's2', nombre: 'Pierna', tipo: 'fuerza' }];
const N = { e1: 'Press banca', e2: 'Remo', e3: 'Sentadilla' };
const P = (id, extra = {}) => ({ id, ejercicio_id: 'e1', series: 3, reps_min: 6, reps_max: 8, carga_sugerida_kg: 50, ...extra });
const av = (o) => revisarSemana({ sesiones: SS, nombres: N, ...o }).map((x) => `${x.sesion}|${x.texto}`);
check(igual(av({ pautas: { s1: [P('a')], s2: [P('b', { ejercicio_id: 'e3' })] } }), []), 'una semana normal no avisa de nada');
check(igual(revisarSemana({ sesiones: [] }).map((x) => x.texto), ['La semana no tiene ninguna sesión.']), 'sin sesiones, lo dice');
check(av({ pautas: { s1: [P('a')], s2: [] } }).join() === 'Pierna|Está vacía: sin ejercicios, cardio ni indicaciones.' && av({ pautas: { s1: [P('a')] }, sesiones: [SS[0], { id: 's3', nombre: 'Cardio', tipo: 'cardio' }] }).length === 0
  && av({ pautas: { s1: [P('a')] }, sesiones: [SS[0], { id: 's3', nombre: 'Movilidad', tipo: 'movilidad', dinamica: '10 min de movilidad' }] }).length === 0, 'una sesión vacía avisa; una de cardio o con indicaciones, no');
check(av({ pautas: { s1: [P('a', { reps_min: 10, reps_max: 6 })], s2: [P('b')] } })[0] === 'Torso|Press banca: el rango está al revés (de 10 a 6).', 'un rango al revés');
check(av({ pautas: { s1: [P('a', { reps_min: 60, reps_max: 60 })], s2: [P('b')] } })[0] === 'Torso|Press banca: 60 repeticiones. ¿Son kilos?' && av({ pautas: { s1: [P('a', { series_detalle: [{ reps: 5, kg: 60 }, { reps: 45, kg: 60 }] })], s2: [P('b')] } })[0].includes('45 repeticiones'), 'repeticiones que parecen kilos (también serie a serie)');
const prev = { a: { pauta: P('x', { carga_sugerida_kg: 50 }) } };
check(av({ pautas: { s1: [P('a', { carga_sugerida_kg: 62.5 })], s2: [P('b')] }, previas: prev })[0] === 'Torso|Press banca: de 50 a 62,5 kg (+25 %).' && av({ pautas: { s1: [P('a', { carga_sugerida_kg: 60 })], s2: [P('b')] }, previas: prev }).length === 0 && SALTO_AVISO_PCT === 20, 'un salto de kilos de más del 20 % avisa; uno del 20 %, no');
check(av({ pautas: { s1: [P('a', { carga_sugerida_kg: 35 })], s2: [P('b')] }, previas: prev })[0] === 'Torso|Press banca: de 50 a 35 kg (−30 %).' && av({ pautas: { s1: [P('a', { carga_sugerida_kg: 35 })], s2: [P('b')] }, previas: prev, foco: 'descarga' }).length === 0, 'una bajada grande avisa, salvo en una semana de descarga');
check(kilosDe(P('a')) === 50 && kilosDe(P('a', { carga_sugerida_kg: null })) === null && kilosDe(P('a', { series_detalle: [{ kg: 60 }, { kg: 50 }] })) === 60, 'los kilos de trabajo: los de la casilla o los más altos del serie a serie');

console.log('Qué cambia respecto a la semana anterior');
const cs = (o) => cambiosDeSemana({ nombres: N, ...o }).map((x) => `${x.tipo}:${x.nombre}:${x.texto}`);
const A1 = P('x1'), A2 = P('x2', { ejercicio_id: 'e2', series: 3 });
check(igual(cs({ actuales: [P('a')], previas: { a: { pauta: A1 } }, anteriores: [A1] }), []), 'si no cambia nada, lista vacía');
check(igual(cs({ actuales: [P('a', { carga_sugerida_kg: 52.5 }), P('b', { ejercicio_id: 'e2', series: 4 })], previas: { a: { pauta: A1 }, b: { pauta: A2 } }, anteriores: [A1, A2] }), ['cambia:Press banca:50 → 52,5 kg', 'cambia:Remo:una serie más']), 'kilos y series');
check(igual(cs({ actuales: [P('a', { reps_min: 5, reps_max: 6, rpe_objetivo: 8 })], previas: { a: { pauta: A1 } }, anteriores: [A1] }), ['cambia:Press banca:6–8 → 5–6 reps · RPE – → 8']), 'repeticiones y RPE, en una línea');
check(igual(cs({ actuales: [P('a'), P('n', { ejercicio_id: 'e3' })], previas: { a: { pauta: A1 } }, anteriores: [A1, A2] }), ['nuevo:Sentadilla:nuevo (3 × 6–8)', 'quitado:Remo:ya no está']), 'los nuevos y los que ya no están');
check(cs({ actuales: [P('a', { series_detalle: [{ reps: 5, kg: 50 }] })], previas: { a: { pauta: A1 } }, anteriores: [A1] })[0].includes('ahora serie a serie'), 'pasar a serie a serie se dice');

console.log('Llevar a las semanas siguientes');
const DB = { semanas: [{ id: 'w1', numero: 1 }, { id: 'w2', numero: 2 }, { id: 'w3', numero: 3 }],
  sesiones: { w1: [{ id: 'a1', orden: 1, nombre: 'Torso' }], w2: [{ id: 'a2', orden: 1, nombre: 'Torso' }], w3: [{ id: 'a3', orden: 1, nombre: 'Torso' }] },
  pautas: { a1: [{ id: 'p1', sesion_id: 'a1', ejercicio_id: 'e9', descanso_seg: 180, notas_coach: 'codos pegados' }, { id: 'q1', sesion_id: 'a1', ejercicio_id: 'e2' }],
    a2: [{ id: 'p2', sesion_id: 'a2', ejercicio_id: 'e1', descanso_seg: 120, notas_coach: null }, { id: 'q2', sesion_id: 'a2', ejercicio_id: 'e2' }],
    a3: [{ id: 'p3', sesion_id: 'a3', ejercicio_id: 'e1', descanso_seg: 120, notas_coach: null }] },
  series: { p3: [{ numero: 1 }] } };
const par = parejasSiguientes(DB, DB.pautas.a1[0], DB.semanas[0]);
check(igual(par.map((x) => [x.semana.numero, x.pauta.id, x.conSeries]), [[2, 'p2', false], [3, 'p3', true]]), 'acabas de sustituir el ejercicio: en las siguientes le corresponde el que ocupa su mismo puesto');
check(igual(parejasSiguientes(DB, DB.pautas.a1[1], DB.semanas[0]).map((x) => x.pauta.id), ['q2']) && parejasSiguientes(DB, DB.pautas.a3[0], DB.semanas[2]).length === 0, 'el mismo ejercicio, por su nombre; y desde la última semana, ninguna');
check(igual(cambiosParaPareja(DB.pautas.a1[0], par[0], ['ejercicio', 'nota', 'descanso']), { ejercicio_id: 'e9', notas_coach: 'codos pegados', descanso_seg: 180 }), 'se lleva solo lo marcado que de verdad cambia');
check(igual(cambiosParaPareja(DB.pautas.a1[0], par[1], ['ejercicio', 'descanso']), { descanso_seg: 180 }) && cambiosParaPareja(DB.pautas.a1[0], par[1], ['ejercicio']) === null, 'con series ya hechas no se le cambia el ejercicio');
check(LLEVAR.map((x) => x[0]).join() === 'ejercicio,variante,nota,descanso,prioridad,pauta', 'lo que se puede llevar');

console.log('Buscador, notas e historial');
const L = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
check(igual(ordenBuscador(L, { recientes: ['c'], usos: { d: 3, b: 1 } }).map((x) => `${x.ejercicio.id}${x.marca ? `:${x.marca}` : ''}`), ['c:reciente', 'd:bloque', 'b:bloque', 'a']), 'arriba los recientes, luego los del bloque (más usados primero), luego el resto');
check(igual(ordenBuscador(L).map((x) => x.ejercicio.id), ['a', 'b', 'c', 'd']), 'sin recientes ni usos, el orden de siempre');
check(igual(conReciente(['a', 'b'], 'b'), ['b', 'a']) && conReciente(['1', '2', '3', '4', '5', '6', '7', '8'], '9').length === 8, 'los recientes: el último primero, sin repetir, ocho como mucho');
check(igual(usosEnBloque(DB), { e9: 1, e2: 2, e1: 2 }), 'cuántas veces sale cada ejercicio en el bloque');
check(igual(notasFrecuentes({ pautas: { x: [{ notas_coach: 'pausa abajo' }, { notas_coach: 'pausa abajo' }, { notas_coach: 'codos pegados' }, { notas_coach: '  ' }] } }, ['controla la bajada', 'pausa abajo']), ['controla la bajada', 'pausa abajo', 'codos pegados']), 'notas frecuentes: las tuyas y las del bloque, sin repetir');
check(igual(conNota(['a'], ' b '), ['b', 'a']) && igual(conNota(['a'], ''), ['a']) && conNota([], 'x'.repeat(200)).length === 0, 'una nota nueva se recuerda (las muy largas, no)');
const hs = historialParaEditor([{ fecha: '2026-11-10', sesion_id: 's9', series: [{ numero: 1 }], mejor: 70, record: true }, { fecha: '2026-11-03', sesion_id: 's8', series: [], mejor: null }], { s9: { id: 'pp' } }, 1);
check(hs.length === 1 && hs[0].pauta.id === 'pp' && hs[0].record && hs[0].mejor === 70, 'el historial: las últimas sesiones, con lo pautado si es de este bloque');

console.log('Contra la demo: mover y copiar un ejercicio, y las sesiones guardadas');
dd = await api.bloqueCompleto(bloque.id);
const [sA, sB] = dd.sesiones[sem.id];
const nA = dd.pautas[sA.id].length, nB = dd.pautas[sB.id].length;
const mov = dd.pautas[sA.id][nA - 1];
const cop = await api.copiarPautaA(mov.id, sB.id);
dd = await api.bloqueCompleto(bloque.id);
check(dd.pautas[sA.id].length === nA && dd.pautas[sB.id].length === nB + 1 && dd.pautas[sB.id][nB].id === cop.id && cop.ejercicio_id === mov.ejercicio_id && cop.series === mov.series, 'copiarPautaA: el ejercicio aparece al final de la otra sesión, con su prescripción');
await api.borrar('sesion_ejercicios', cop.id);
await api.moverPautaA(mov.id, sB.id);
dd = await api.bloqueCompleto(bloque.id);
check(dd.pautas[sA.id].length === nA - 1 && dd.pautas[sB.id][nB].id === mov.id, 'moverPautaA: sale de una sesión y entra al final de la otra, con el mismo id (lo registrado va con él)');
await api.moverPautaA(mov.id, sA.id);
check((await api.sesionesGuardadas()).length === 0, 'sin sesiones guardadas, lista vacía');
const g1 = await api.guardarSesion(sA.id);
const g2 = await api.guardarSesion(sB.id, 'Pierna de viaje');
const gs = await api.sesionesGuardadas();
check(gs.length === 2 && gs[0].id === g1.id && gs[0].nombre === sA.nombre && gs[0].ejercicios === nA && gs[1].nombre === 'Pierna de viaje', 'guardarSesion: se guardan con sus ejercicios (y con otro nombre si se da)');
const plant = (await b.select('bloques', { eq: { es_plantilla: true } })).filter((x) => x.nombre === NOMBRE_GUARDADAS);
check(plant.length === 1 && plant[0].atleta_id == null, 'viven en una sola plantilla, «Sesiones guardadas»');
const antesS = (await api.bloqueCompleto(bloque.id)).sesiones[otra.id].length;
const usada = await api.copiarSesion(g2.id, otra.id);
dd = await api.bloqueCompleto(bloque.id);
check(dd.sesiones[otra.id].length === antesS + 1 && dd.sesiones[otra.id].find((x) => x.id === usada.id).nombre === 'Pierna de viaje' && dd.pautas[usada.id].length === nB, 'y se añaden a cualquier semana con todos sus ejercicios');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
