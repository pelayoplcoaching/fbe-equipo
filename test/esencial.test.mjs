// FBE Esencial (logica/esencial.js y esencial-alta.js): «te sobran», la plantilla «Primeras 4 semanas» igual que la guía
// del vídeo, las marcas de la semana 4 y, desde la tanda 2, lo de antes de empezar (su lunes, el cribado sin coach, en qué
// punto está), los avisos del coach y la demo (cuestionario → plan; visto bueno → plan; fuera de Revisar).
import { esPorSuCuenta, sobran, sobranDeRpe, textoSobran, etiquetaRpeSobran } from '../web/src/logica/esencial.js';
import { marcasDeSemana, inicioEsencial, fechaLarga, esLunes, estadoEsencial, MENSAJE_ESENCIAL, TANDA_ESENCIAL } from '../web/src/logica/esencial-alta.js';
import { MENSAJE_ATLETA } from '../web/src/logica/cuestionario.js';
import { resumenAtleta } from '../web/src/logica/calculos.js';
import { cumpleMarca } from '../web/src/logica/panel-atletas.js';
import { crearBackendMemoria } from '../web/src/datos/backend-memoria.js';
import { semillaDemo } from '../web/src/datos/semilla-demo.js';
import { crearApi } from '../web/src/datos/api.js';
import { hoyISO, lunesDe, sumarDias, fechaMadrid } from '../web/src/logica/fechas.js';
import { PRIMERAS_4, filasPrimeras4 } from '../web/src/logica/esencial-plantilla.js';
import { pauta, esPorTiempo } from '../web/src/logica/calculos.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

console.log('Quién va por su cuenta');
check(esPorSuCuenta({ modalidad: 'por_su_cuenta' }) && !esPorSuCuenta({ modalidad: 'seguimiento' }) && !esPorSuCuenta({}) && !esPorSuCuenta(null),
  'solo con modalidad «por_su_cuenta» (sin la columna, como hasta ahora)');

console.log('\n«Te sobran»');
check(sobran(4.5) === '4-5' && sobran(3) === '3' && sobran(2) === '2' && sobran(0) === '0' && sobran(null) === null && sobran('') === null,
  'RIR 4,5 se lee «4-5» (como en la guía); RIR 3, «3»');
check(sobranDeRpe(8) === '2' && sobranDeRpe(7.5) === '2-3' && sobranDeRpe(10) === '0' && sobranDeRpe(null) === null, 'del RPE: 10 − RPE (RPE 7,5: «2-3»)');
check(textoSobran('RIR 4,5') === 'Te sobran 4-5' && textoSobran('RIR 3') === 'Te sobran 3' && textoSobran('RPE 8') === 'Te sobran 2' && textoSobran('RIR 0') === 'Sin que te sobre ninguna',
  'el texto del esfuerzo: «Te sobran 4-5», «Te sobran 2» (de RPE 8), «Sin que te sobre ninguna»');
check(textoSobran('60 kg') === '60 kg' && textoSobran('') === '' && textoSobran(null) === '', 'lo que no es esfuerzo, igual');
check(etiquetaRpeSobran(8) === '8 · te sobran 2' && etiquetaRpeSobran(10) === '10 · no te sobra ninguna' && etiquetaRpeSobran('') === '',
  'al apuntar el RPE, cada valor con sus «te sobran»');

console.log('\nLa pauta en la sesión');
const p45 = { series: 1, reps_min: 10, reps_max: 12, rir_objetivo: 4.5 };
check(pauta(p45, { sobran: true }).esfuerzo === 'Te sobran 4-5' && pauta(p45).esfuerzo === 'RIR 4,5' && pauta({ series: 2, reps_min: 8, reps_max: 10, rpe_objetivo: 8 }, { sobran: true }).esfuerzo === 'Te sobran 2',
  'quien va por su cuenta lee «Te sobran 4-5» (y del RPE 8, «Te sobran 2»); el resto, «RIR 4,5» como siempre');
check(pauta({ series: 1, reps_min: 20, reps_max: 30, ejercicio: { por_tiempo: true } }).series === '1 × 20–30 s' && pauta({ series: 3, reps_min: 40, reps_max: 40, por_tiempo: true }).series === '3 × 40 s'
  && pauta({ series: 1, reps_min: 10, reps_max: 12 }).series === '1 × 10–12' && esPorTiempo({ ejercicio: { por_tiempo: true } }) && !esPorTiempo({}),
  'la plancha, en segundos: «1 × 20–30 s»; el resto, igual');

console.log('\nLa plantilla «Primeras 4 semanas» (la guía)');
const f = filasPrimeras4();
const ej = (w, k) => f[w].sesiones[0].ejercicios[k];
check(f.length === 4 && f.every((w) => w.sesiones.length === 2) && f.every((w) => w.sesiones.every((s) => s.ejercicios.length === 5)),
  '4 semanas, 2 sesiones iguales, 5 ejercicios');
check(PRIMERAS_4.ejercicios.map((e) => `${e.nombre}|${e.alternativa}`).join(';') === 'Prensa de piernas|Sentadilla a un banco;Peso muerto rumano con mancuernas|Puente de glúteo;Press de pecho en máquina|Flexiones;Jalón al pecho|Remo en máquina;Plancha abdominal|Curl de bíceps con mancuernas',
  'los cinco ejercicios de la guía, cada uno con su alternativa');
check(f[0].sesiones[0].ejercicios.slice(0, 4).every((e) => e.series === 1 && e.reps_min === 10 && e.reps_max === 12 && e.rir_objetivo === 4.5),
  'semana 1: 1 serie de 10-12, te sobran 4-5');
check(f[1].sesiones[0].ejercicios.slice(0, 4).every((e) => e.series === 2 && e.rir_objetivo === 3 && e.descanso_seg === 90),
  'semana 2: 2 series, te sobran 3, descanso de 1 a 2 minutos');
check(f[2].sesiones[0].ejercicios.slice(0, 4).every((e) => e.series === 2 && e.rir_objetivo === 2) && /más de peso/.test(f[2].nota),
  'semana 3: 2 series con algo más de peso, te sobran 2');
check([3, 3, 2, 2, 2].every((n, k) => ej(3, k).series === n) && ej(3, 0).rir_objetivo === 2 && f[3].marcas && !f[2].marcas,
  'semana 4: 3 series en los dos primeros y 2 en el resto, te sobran 2, y se guardan las marcas');
check([0, 1, 2, 3].map((w) => `${ej(w, 4).reps_min}-${ej(w, 4).reps_max}`).join(' ') === '20-30 25-35 30-40 35-45' && f.every((w, i) => ej(i, 4).por_tiempo && ej(i, 4).rir_objetivo == null),
  'plancha por tiempo: 20-30 s y 5 s más cada semana (25-35, 30-40, 35-45), sin «te sobran»');
check(/curl de bíceps/i.test(ej(0, 4).notas_coach) && /inclinación/.test(ej(0, 2).notas_coach), 'cada ejercicio dice su alternativa (la del curl, con sus repeticiones)');

console.log('\nSus marcas de la semana 4');
const E = { a: { id: 'a', nombre: 'Prensa de piernas' }, b: { id: 'b', nombre: 'Jalón al pecho' }, c: { id: 'c', nombre: 'Plancha abdominal', por_tiempo: true }, d: { id: 'd', nombre: 'Sentadilla a un banco' } };
const pautas = [{ id: 'p1', ejercicio_id: 'a', orden: 1 }, { id: 'p2', ejercicio_id: 'b', orden: 2 }, { id: 'p3', ejercicio_id: 'c', orden: 3 }, { id: 'q1', ejercicio_id: 'a', orden: 1 }];
const series = [
  { sesion_ejercicio_id: 'p1', numero: 1, kg: 60, reps: 12 }, { sesion_ejercicio_id: 'p1', numero: 2, kg: 65, reps: 10 }, { sesion_ejercicio_id: 'q1', numero: 1, kg: 65, reps: 11 },
  { sesion_ejercicio_id: 'p2', numero: 1, kg: 35, reps: 12 }, { sesion_ejercicio_id: 'p2', numero: 2, kg: 0, reps: 0 },
  { sesion_ejercicio_id: 'p3', numero: 1, kg: null, reps: 40 }, { sesion_ejercicio_id: 'p3', numero: 2, kg: null, reps: 44 },
];
const m = marcasDeSemana({ pautas, series, ejercicios: E }).map((x) => ({ ...x, texto: x.texto.replace(/\u00a0/g, ' ') }));
check(m.length === 3 && m[0].texto === '65 kg × 11' && m[1].texto === '35 kg × 12' && m[2].texto === '44 s',
  'la mejor serie de cada ejercicio: más kilos (a igualdad, más repeticiones); la plancha, más segundos');
const m2 = marcasDeSemana({ pautas, series: [{ sesion_ejercicio_id: 'p1', numero: 1, kg: null, reps: 12, sustituto_id: 'd' }], ejercicios: E });
check(/16\u00a0kg \u00d7\u00a012/.test(marcasDeSemana({ pautas, series: [{ sesion_ejercicio_id: 'p1', numero: 1, kg: 16, reps: 12 }], ejercicios: E })[0].texto), 'la cifra no se parte en dos líneas (espacios que no parten)');
check(m2.length === 1 && m2[0].nombre === 'Sentadilla a un banco' && m2[0].texto === '12 repeticiones', 'si hizo la alternativa, la marca es de la alternativa');

console.log('\nSu lunes de inicio');
check(TANDA_ESENCIAL === '2027-01-11' && inicioEsencial('2026-12-14') === '2027-01-11' && inicioEsencial('2027-01-11') === '2027-01-11',
  'hasta el 11 de enero, todos empiezan ese lunes (la primera tanda)');
check(inicioEsencial('2027-01-12') === '2027-01-18' && inicioEsencial('2027-01-17') === '2027-01-18' && inicioEsencial('2027-01-18') === '2027-01-18' && inicioEsencial('x') === TANDA_ESENCIAL,
  'después, el lunes siguiente (o el mismo día, si es lunes)');
check(fechaLarga('2027-01-11') === 'lunes 11 de enero' && fechaLarga('2026-12-02') === 'miércoles 2 de diciembre' && fechaLarga('') === '' && esLunes('2027-01-11') && !esLunes('2027-01-12'),
  '«lunes 11 de enero» (y solo un lunes vale como inicio)');

console.log('\nAntes de empezar: en qué punto está');
const hoyT = '2026-12-20';
const E0 = (x) => estadoEsencial({ hoy: hoyT, ...x });
check(E0({}).tipo === 'cuestionario' && !E0({}).empezado && E0({ cuestionario: { objetivo: 'salud' } }).empezado, 'sin cuestionario enviado: «Rellena tu cuestionario» (o «Termina…» si lo empezó)');
check(E0({ cuestionario: { completado_en: 'x', resultado: null } }).tipo === 'salud', 'enviado sin la parte de salud: sin plan hasta completarla');
check(E0({ cuestionario: { completado_en: 'x', resultado: 'valorar_antes' } }).tipo === 'visto_bueno' && E0({ cuestionario: { completado_en: 'x', resultado: 'valorar_antes_vigoroso' } }).tipo === 'visto_bueno',
  'cualquier resultado que no sea «sin valoración» frena el plan hasta el visto bueno (también «antes de intensidad vigorosa»)');
check(E0({ cuestionario: { completado_en: 'x', resultado: 'parar_y_valorar' }, ficha: { visto_bueno_pedido_en: 't' } }).tipo === 'revision'
  && E0({ cuestionario: { completado_en: 'x', resultado: 'parar_y_valorar' }, ficha: { visto_bueno_pedido_en: 't', visto_bueno_en: 't' } }).tipo === 'preparando',
  'marcado por el atleta: «Pelayo lo está revisando»; confirmado por Pelayo: la app le prepara el plan');
check(E0({ cuestionario: { completado_en: 'x', resultado: 'sin_valoracion' } }).tipo === 'preparando', 'con el cribado limpio, el plan sin esperar a nadie');
check(E0({ bloque: { fecha_inicio: '2027-01-11' } }).tipo === 'espera' && E0({ bloque: { fecha_inicio: '2027-01-11' } }).faltan === 22 && E0({ bloque: { fecha_inicio: '2026-12-14' } }) === null,
  'con su plan, antes de su lunes: «Empiezas el lunes 11 de enero» (faltan 22 días); ya empezado, nada');
check(Object.keys(MENSAJE_ATLETA).every((k) => MENSAJE_ESENCIAL[k]) && Object.values(MENSAJE_ESENCIAL).every((t) => !/coach/i.test(t)) && /112/.test(MENSAJE_ESENCIAL.parar_y_valorar),
  'el mensaje del cribado de quien va por su cuenta: uno por resultado, sin «tu coach lo verá» (y con el 112 si cuenta síntomas)');

console.log('\nLos avisos del coach');
const at = (x = {}) => ({ id: 'z', nombre: 'Z', estado: 'activo', modalidad: 'por_su_cuenta', ...x });
const tipos = (d) => resumenAtleta({ semanas: [], sesiones: [], pesos: [], checkins: [], molestias: [], ...d }, hoyT).alertas.map((x) => x.tipo);
check(tipos({ atleta: at(), esencial: { cuestionario: null } }).join() === 'esencial_cuestionario' && tipos({ atleta: at({ modalidad: null }) }).includes('sin_bloque'),
  'sin plan: dónde está antes de empezar (no «Sin bloque activo»); a quien lleva seguimiento, como siempre');
check(tipos({ atleta: at({ visto_bueno_pedido_en: 't' }), esencial: { cuestionario: { completado_en: 'x', resultado: 'valorar_antes' } } })[0] === 'esencial_visto_bueno'
  && tipos({ atleta: at(), esencial: { cuestionario: { completado_en: 'x', resultado: 'sin_valoracion' } } })[0] === 'esencial_sin_plan',
  '«confirma su visto bueno» cuando lo marca; «listo y sin plan» si la app no ha podido asignarlo');
const conBloque = { bloque: { id: 'b1', fecha_inicio: '2026-11-30' }, semana: { id: 's', numero: 3, fecha_inicio: '2026-12-14' }, semanas: [{ id: 's', numero: 3, programacion: 'programada' }] };
const tz = tipos({ atleta: at(), ...conBloque, ultimaSerie: '2026-12-13' });
check(!tz.includes('sin_entrenar') && !tz.includes('sin_checkin') && !tz.includes('programar') && tipos({ atleta: at(), ...conBloque, ultimaSerie: '2026-12-09' }).includes('sin_entrenar'),
  'ya empezado: «sin entrenar» a los 10 días (no a los 5); sin «sin check-in» ni «programa la semana»');
check(tipos({ atleta: at({ modalidad: null }), ...conBloque, ultimaSerie: '2026-12-13' }).includes('sin_entrenar'), '(a quien lleva seguimiento, a los 5 días como siempre)');
check(cumpleMarca('esencial', { modalidad: 'por_su_cuenta' }) && !cumpleMarca('esencial', {}) && cumpleMarca('seguimiento', {}) && !cumpleMarca('seguimiento', { modalidad: 'por_su_cuenta' }),
  'en la lista, filtrar a los de FBE Esencial o a los de seguimiento');

console.log('\nLa demo (?demo=esencial)');
const bd = crearBackendMemoria({ semilla: () => semillaDemo(hoyISO(), { esencial: true }), persistir: false });
const apiD = crearApi(bd);
await bd.auth.entrar('pelayo@fbe.demo', 'demo');
const resD = await apiD.resumenes();
const esD = resD.filter((r) => r.modalidad === 'por_su_cuenta').map((r) => r.nombre).sort();
check(esD.join() === 'Andrés Mora,Carmen Soto,Clara Prieto,Inés Gil,Lucía Vidal,Marina Ortega,Tomás Rey', 'siete atletas de FBE Esencial: Marina, Tomás, Clara, Inés (con nutrición, desde la tanda 4), en la espera (v0.248) Lucía y Andrés y, con su plan de comida (v0.250), Carmen');
const bjD = await apiD.bandeja();
check(![...bjD.sesiones, ...bjD.checkins, ...bjD.comentarios].some((x) => x.atleta?.modalidad === 'por_su_cuenta') && bjD.sesiones.length > 0,
  'fuera de Revisar (las sesiones de Tomás no esperan respuesta; las de los demás, sí)');
const rsD = await apiD.revisionSemanal();
check(!JSON.stringify(rsD).includes('Tomás Rey') && JSON.stringify(rsD).includes('Ana'), 'fuera de la revisión semanal');
const marinaD = (await bd.select('atletas', { eq: { email: 'marina@fbe.demo' } }))[0];
const claraD = (await bd.select('atletas', { eq: { email: 'clara@fbe.demo' } }))[0];
await bd.auth.entrar('marina@fbe.demo', 'demo');
check(!(await apiD.programa(marinaD.id)).bloque, 'Marina, sin plan hasta su cuestionario');
await apiD.guardarCuestionario(marinaD.id, { objetivos: ['salud'], experiencia: 'ninguna', dias_semana: 2, minutos_sesion: 45, otros_deportes: null }, {});
await apiD.guardarCuestionario(marinaD.id, { lugar: 'gimnasio', material: ['maquinas'] }, {});
await apiD.guardarCuestionario(marinaD.id, { activo: false, enfermedad: false, enfermedad_detalle: null, sintomas: [], otras: [], medicacion_detalle: null }, {});
await apiD.guardarCuestionario(marinaD.id, { lesiones: [], alergias: null }, { completar: true });
const asig = await apiD.esencialAsignarPlan();
const pM = await apiD.programa(marinaD.id);
// (097) su tanda es este lunes: de lunes a miércoles empieza este lunes; desde el jueves, el siguiente (sin semana 1 perdida)
const tardeD = Math.round((Date.parse(`${fechaMadrid()}T12:00:00Z`) - Date.parse(`${lunesDe(fechaMadrid())}T12:00:00Z`)) / 864e5) > 2;
const inicioD = tardeD ? sumarDias(lunesDe(fechaMadrid()), 7) : lunesDe(fechaMadrid());
check(asig?.nuevo && asig.plantilla === 'Primeras 4 semanas' && pM.bloque?.fecha_inicio === inicioD && pM.semanas.length === 4 && pM.semanas.every((w) => w.programacion === 'programada'),
  `con el cuestionario limpio, la app le pone «Primeras 4 semanas» desde su lunes (este, de lunes a miércoles; si no, el siguiente: ${inicioD}), con las cuatro semanas publicadas`);
const s1D = [...pM.semanas].sort((x, y) => x.numero - y.numero)[0];
check((pM.sesiones[s1D.id] || []).length === 2 && (await apiD.esencialAsignarPlan()).nuevo === false, 'la semana 1 con sus dos días; pedirlo otra vez no hace otro');
await bd.auth.entrar('clara@fbe.demo', 'demo');
check(/visto bueno/.test(await apiD.esencialAsignarPlan().then(() => '', (e) => e.message)), 'Clara (cribado que pide valoración), sin plan hasta que Pelayo confirme su visto bueno');
await bd.auth.entrar('pelayo@fbe.demo', 'demo');
const confD = await apiD.esencialConfirmarVistoBueno(claraD.id);
await bd.auth.entrar('clara@fbe.demo', 'demo');
const pC = await apiD.programa(claraD.id);
check(confD?.nuevo && pC.bloque?.fecha_inicio === sumarDias(lunesDe(fechaMadrid()), 7) && estadoEsencial({ bloque: pC.bloque, hoy: fechaMadrid() })?.tipo === 'espera',
  'Pelayo lo confirma y la app le prepara el plan, desde su lunes (el que viene): «Empiezas el lunes…»');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
