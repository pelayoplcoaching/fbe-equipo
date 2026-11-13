// Personalización 2, tanda 2: su meta (y la cuenta atrás), por qué la sesión es para él, el lenguaje de su nivel, su
// historia en una línea y lo de su aniversario. Lógica pura.
//   node test/rumbo.test.mjs
import * as R from '../web/src/logica/rumbo.js';
import { momentoBienvenida } from '../web/src/logica/personal.js';
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const hoy = '2026-11-13';

// la meta
check(R.metaDe(null) === null && R.metaDe({ meta_nombre: '  ' }) === null, 'sin nombre no hay meta');
const m = R.metaDe({ meta_nombre: 'Mi primera competición', meta_fecha: '2027-03-01', meta_cifra: '100', meta_unidad: 'kg' });
check(m.nombre === 'Mi primera competición' && m.fecha === '2027-03-01' && m.cifra === 100 && m.unidad === 'kg', 'la meta: nombre, fecha, cifra y unidad');
check(R.metaDe({ meta_nombre: 'X', meta_fecha: 'mañana' }).fecha === null, 'una fecha que no vale, sin fecha');
check(R.cuentaMeta({ meta_nombre: 'La boda' }, hoy).texto === 'Tu meta: La boda' && R.cuentaMeta({ meta_nombre: 'La boda' }, hoy).dias === null, 'sin fecha: «Tu meta: …»');
check(R.cuentaMeta({ meta_nombre: 'La boda', meta_fecha: '2026-11-14' }, hoy).texto === 'Falta 1 día para La boda', 'a un día: «Falta 1 día»');
check(R.cuentaMeta({ meta_nombre: 'La boda', meta_fecha: '2026-11-18' }, hoy).texto === 'Faltan 5 días para La boda' && R.cuentaMeta({ meta_nombre: 'La boda', meta_fecha: '2026-11-18' }, hoy).cerca, 'a menos de una semana: en días y «cerca»');
check(R.cuentaMeta({ meta_nombre: 'La boda', meta_fecha: '2027-01-20' }, hoy).texto === 'Faltan 10 semanas para La boda' && !R.cuentaMeta({ meta_nombre: 'La boda', meta_fecha: '2027-01-20' }, hoy).cerca, 'a semanas: en semanas');
check(R.cuentaMeta({ meta_nombre: 'El verano', meta_fecha: '2027-07-01' }, hoy).texto === 'Faltan 8 meses para El verano', 'lejos: en meses');
check(R.cuentaMeta({ meta_nombre: 'La carrera', meta_fecha: hoy }, hoy).texto === '¡Hoy es el día: La carrera!', 'el mismo día: «¡Hoy es el día!»');
check(R.cuentaMeta({ meta_nombre: 'La carrera', meta_fecha: '2026-11-01' }, hoy).pasada && /siguiente/.test(R.cuentaMeta({ meta_nombre: 'La carrera', meta_fecha: '2026-11-01' }, hoy).texto), 'pasada: invita a poner la siguiente');
check(R.cuentaMeta({ meta_nombre: 'Correr', meta_fecha: '2027-01-20', meta_cifra: 10, meta_unidad: 'km' }, hoy).texto === 'Faltan 10 semanas para Correr (10 km)'
  && R.cuentaMeta({ meta_nombre: 'Dominadas', meta_cifra: 12.5, meta_unidad: 'reps' }, hoy).texto === 'Tu meta: Dominadas (12,5 repeticiones)', 'con su cifra (y «repeticiones» en vez de «reps»; decimales con coma)');

// por qué esta sesión es para ti
check(/fuerza/.test(R.porQueSesion({ objetivos: ['fuerza'] })) && /músculo/.test(R.porQueSesion({ objetivos: ['musculo'] })) && /salud/.test(R.porQueSesion({ objetivos: ['salud'] })), 'según su objetivo principal (el primero)');
check(/cardio del final/.test(R.porQueSesion({ objetivos: ['perder_grasa'], conCardio: true })) && !/cardio/.test(R.porQueSesion({ objetivos: ['perder_grasa'] })), 'perder grasa: menciona el cardio solo si la sesión lo lleva');
check(/ritmo/.test(R.porQueSesion({ objetivos: ['fuerza'], tipo: 'cardio' })) && /moverte bien/.test(R.porQueSesion({ objetivos: [], tipo: 'movilidad' })), 'una sesión de cardio o de movilidad, por lo que es');
check(R.porQueSesion({ objetivos: [] }) === null && R.porQueSesion({ objetivos: ['otro'] }) === null, 'sin objetivo (o «otro»), nada');
check(/Un paso más hacia la boda\.$/.test(R.porQueSesion({ objetivos: ['fuerza'], meta: { nombre: 'la boda' } })), 'con su meta, el remate');
const directo = R.porQueSesion({ objetivos: ['fuerza'] }, { tono: 'directo' }), tope = R.porQueSesion({ objetivos: ['fuerza'] }, { tono: 'tope' });
check(/^Lo importante/.test(directo) && /¡A por ello!$/.test(tope), 'según su tono: directo (sin rodeos) o a tope');

// el lenguaje de su nivel
check(R.nivelLenguaje({ experiencia: 'ninguna', meses: 2 }) === 'principiante' && R.nivelLenguaje({ experiencia: 'ninguna', meses: 8 }) === 'medio'
  && R.nivelLenguaje({ experiencia: 'mas_5', meses: 0 }) === 'avanzado' && R.nivelLenguaje({ meses: 0 }) === 'principiante' && R.nivelLenguaje({ meses: 3 }) === 'medio', 'el nivel: por su experiencia y lo que lleva aquí');
check(R.explicarEsfuerzo('RIR 2', 'principiante') === 'RIR 2 (que te queden 2)' && R.explicarEsfuerzo('RIR 1-2', 'principiante') === 'RIR 1-2 (que te queden 1 o 2)'
  && R.explicarEsfuerzo('RPE 8', 'principiante') === 'RPE 8 (te quedan unas 2)' && R.explicarEsfuerzo('RPE 10', 'principiante') === 'RPE 10 (sin dejarte ninguna)', 'a quien empieza, el RIR y el RPE explicados');
check(R.explicarEsfuerzo('RIR 2', 'medio') === 'RIR 2' && R.explicarEsfuerzo('', 'principiante') === '', 'a los demás, tal cual');

// su historia en una línea
const prog = { ejercicios: [{ nombre: 'Press banca', puntos: [{ valor: 50 }, { valor: 55 }] }, { nombre: 'Sentadilla', puntos: [{ valor: 60 }, { valor: 85 }, { valor: 80 }] }, { nombre: 'Curl', puntos: [{ valor: 10 }, { valor: 11 }] }] };
const h = R.historiaEnUnaLinea({ fechaAlta: '2026-04-01', sesiones: 80, progreso: prog, coach: 'Tu coach', hoy });
check(h.texto === 'Llevas 7 meses con Tu coach y 80 sesiones. Empezaste con un 1RM estimado de 60 kg en sentadilla; hoy, 85 kg.', 'su historia: tiempo, coach, sesiones y la mayor subida (su mejor marca, no la última)');
check(R.historiaEnUnaLinea({ fechaAlta: '2026-11-05', sesiones: 2, hoy }) === null, 'con menos de dos semanas, todavía no');
check(R.historiaEnUnaLinea({ fechaAlta: '2026-10-01', sesiones: 0, hoy }).texto === 'Llevas 1 mes.' && R.historiaEnUnaLinea({ fechaAlta: '2024-10-01', sesiones: 1, hoy }).texto === 'Llevas 2 años y 1 sesión.', 'sin coach ni subida: lo que haya (con singulares)');
check(R.historiaEnUnaLinea({ fechaAlta: '2026-04-01', progreso: { ejercicios: [{ nombre: 'Curl', puntos: [{ valor: 10 }, { valor: 11 }] }] }, hoy }).mejor === null, 'una subida de menos de 2,5 kg no se cuenta');

// el aniversario
check(R.resumenDesdeAlta({ entrenos: [{ fecha: '2026-03-01' }, { fecha: '2026-05-01' }, { fecha: '2026-06-01' }], fechaAlta: '2026-04-01' }).sesiones === 2 && R.resumenDesdeAlta({ entrenos: [], fechaAlta: '2026-04-01' }) === null, 'el aniversario: las sesiones desde que empezó');

// el mensaje del coach a una semana de su meta
check(momentoBienvenida({ hoy, metaDias: 5 }) === 'meta' && momentoBienvenida({ hoy, metaDias: 9 }) === null && momentoBienvenida({ hoy, metaDias: 3, cumple: true }) === 'cumple'
  && momentoBienvenida({ hoy, metaDias: 3, ultimoDia: '2026-11-01' }) === 'vuelta', 'la bienvenida: a una semana de su meta, el mensaje de la meta (el cumple y la vuelta, antes)');
console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
