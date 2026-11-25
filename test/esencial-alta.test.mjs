// FBE Esencial, el alta (tandas 2 y 3, lógica pura): sus días de entreno (logica/esencial-dias.js) y lo de la primera semana.
import { nombreDias, seguidos, PROPUESTA_DIAS, diaDeSemana, diasDeSemana, planDias, leerDias, guardarDias } from '../web/src/logica/esencial-dias.js';
import { textoQuePeso, consejoPeso, textoSiguiente, TEXTO_AGUJETAS } from '../web/src/logica/esencial-primera.js';

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

console.log('\nSu primera semana (tanda 3)');
check(/El primer día no lo sabe nadie/.test(textoQuePeso(4.5)) && /te sobren cuatro o cinco\.$/.test(textoQuePeso(4.5)) && /te sobren tres\.$/.test(textoQuePeso(3)),
  '«¿Qué peso pongo?»: lo que le tienen que sobrar, en letra (4,5 → «cuatro o cinco»; 3 → «tres»)');
check(/cuatro o cinco\.$/.test(textoQuePeso(null)) && /cuatro o cinco\.$/.test(textoQuePeso(7)), 'sin dato (o uno raro), lo de la guía: cuatro o cinco');
check(/sube/.test(consejoPeso(1)) && /sube/.test(consejoPeso(2)) && consejoPeso(3) === null && consejoPeso(6) === null && consejoPeso(9) === null && /baja/.test(consejoPeso(10)),
  'tras su primera serie: le sobraban 8 o más → que suba; ninguna → que baje; si no, nada');
check(consejoPeso(null) === null && consejoPeso('') === null && consejoPeso('x') === null, 'sin esfuerzo apuntado, nada');
const fl = (x) => `[${x}]`;
check(textoSiguiente({ nombre: 'Día 2', dia_previsto: '2027-01-14' }, '2027-01-11', fl) === 'La siguiente, «Día 2», el [2027-01-14].', 'la siguiente con día: «el jueves 14 de enero»');
check(/cuando te venga bien esta semana/.test(textoSiguiente({ nombre: 'Día 2' }, '2027-01-11', fl)) && /cuando te venga bien/.test(textoSiguiente({ nombre: 'Día 2', dia_previsto: '2027-01-11' }, '2027-01-11', fl)),
  'sin día (o con uno que ya llegó): «cuando te venga bien esta semana», dejando un día entre una y otra');
check(/«Día 2», cuando puedas, dejando un día/.test(textoSiguiente({ nombre: 'Día 2' }, '2027-01-16', fl)) && /cuando puedas/.test(textoSiguiente({ nombre: 'Día 2' }, '2027-01-17', fl)),
  'en sábado o domingo, sin «esta semana»: «cuando puedas»');
check(textoSiguiente(null, '2027-01-11') === null && /agujetas/.test(TEXTO_AGUJETAS), 'sin siguiente, nada; y lo de las agujetas');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
