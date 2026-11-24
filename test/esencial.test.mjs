// FBE Esencial, tanda 1 (logica/esencial.js): «te sobran», la plantilla «Primeras 4 semanas» igual que la guía del
// vídeo y las marcas de la semana 4.
import { esPorSuCuenta, sobran, sobranDeRpe, textoSobran, etiquetaRpeSobran, marcasDeSemana } from '../web/src/logica/esencial.js';
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

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
