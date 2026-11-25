// FBE Esencial, el alta (tandas 2 y 3, lógica pura): sus días de entreno (logica/esencial-dias.js) y lo de la primera semana.
import { nombreDias, seguidos, PROPUESTA_DIAS, diaDeSemana, diasDeSemana, planDias, leerDias, guardarDias } from '../web/src/logica/esencial-dias.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

console.log('Sus días');
check(nombreDias([4, 1]) === 'lunes y jueves' && nombreDias([1, 3, 5]) === 'lunes, miércoles y viernes' && nombreDias([]) === '' && nombreDias([7]) === 'domingo', 'en palabras: «lunes y jueves»');
check(seguidos([1, 2]) && seguidos([7, 1]) && !seguidos([1, 4]) && !seguidos([1, 3, 5]) && !seguidos([2]), '¿van seguidos? (también domingo y lunes)');
check(Object.entries(PROPUESTA_DIAS).every(([n, d]) => d.length === Number(n)) && !seguidos(PROPUESTA_DIAS[2]) && !seguidos(PROPUESTA_DIAS[3]), 'la propuesta de días: tantos como sesiones y, con 2 o 3, sin ir seguidos');
check(diaDeSemana('2027-01-11') === 1 && diaDeSemana('2027-01-17') === 7, 'el día de la semana de una fecha (el 11/1/2027, lunes)');
check(JSON.stringify(diasDeSemana([{ dia_previsto: '2027-01-14' }, { dia_previsto: '2027-01-11' }])) === '[1,4]' && diasDeSemana([{ dia_previsto: '2027-01-11' }, { dia_previsto: null }]) === null,
  'los días que ya tiene puestos (todos) o ninguno');

console.log('\nQué sesión va en qué día');
const semanas = [
  { id: 'w0', numero: 1, fecha_inicio: '2027-01-04', programacion: 'programada' },
  { id: 'w1', numero: 1, fecha_inicio: '2027-01-11', programacion: 'programada' },
  { id: 'w2', numero: 2, fecha_inicio: '2027-01-18', programacion: 'programada' },
  { id: 'w3', numero: 3, fecha_inicio: '2027-01-25', programacion: 'programada' },
];
const sesiones = {
  w0: [{ id: 'a0', orden: 1 }, { id: 'b0', orden: 2 }],
  w1: [{ id: 'b1', orden: 2 }, { id: 'a1', orden: 1, completada: true }],
  w2: [{ id: 'a2', orden: 1, dia_previsto: '2027-01-19' }, { id: 'b2', orden: 2 }],
  w3: [{ id: 'a3', orden: 1 }, { id: 'b3', orden: 2 }, { id: 'c3', orden: 3 }],
};
const c = planDias({ semanas, sesiones, dias: [4, 1], hoy: '2027-01-13' });
check(JSON.stringify(c) === JSON.stringify([{ id: 'b1', dia: '2027-01-14' }, { id: 'a2', dia: '2027-01-18' }, { id: 'b2', dia: '2027-01-21' }]),
  `lunes y jueves: la sesión 1 el lunes y la 2 el jueves; sin semanas pasadas, ni hechas, ni días que ya pasaron, ni semanas con otras sesiones (${c.map((x) => `${x.id} ${x.dia}`).join(', ')})`);
const s = planDias({ semanas, sesiones, dias: [1, 4], hoy: '2027-01-13', soloSinDia: true });
check(s.map((x) => x.id).join() === 'b1,b2', 'para las semanas que prepara la app: sin tocar las que ya tienen día');
check(planDias({ semanas, sesiones, dias: [], hoy: '2027-01-13' }).length === 0, 'sin días, nada');

console.log('\nLo elegido, en este móvil');
const mem = new Map();
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
check(leerDias('a') === null, 'sin elegir, nada');
guardarDias('a', [4, 1, 4]);
check(JSON.stringify(leerDias('a')) === '[1,4]' && leerDias('b') === null, 'se guarda ordenado y sin repetir, por atleta');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
