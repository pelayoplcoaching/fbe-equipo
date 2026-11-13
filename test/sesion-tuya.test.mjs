// Personalización 3, tanda 5: con el tiempo que tiene (qué podría dejar, sin tocar la pauta), su calentamiento, sus
// alternativas primero y lo de hace un año. Lógica pura.
//   node test/sesion-tuya.test.mjs
import * as T from '../web/src/logica/sesion-tuya.js';
import { duracionEstimada } from '../web/src/logica/calculos.js';
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const ej = (id, nombre, series, prioridad, grupos = []) => ({ id, series, prioridad, descanso_seg: 120, ejercicio: { nombre, grupos_musculares: grupos } });
const sesion = [
  ej('a', 'Sentadilla trasera', 4, 'alta', ['cuadriceps']), ej('b', 'Press banca', 4, 'alta', ['pectoral']),
  ej('c', 'Remo con barra', 3, 'media', ['espalda']), ej('d', 'Curl femoral', 3, 'baja', ['isquiotibiales']),
  ej('e', 'Elevaciones laterales', 3, 'muy_baja', ['deltoides']), ej('f', 'Plancha', 3, 'baja', ['abdominales']),
];
const total = duracionEstimada(sesion);
check(T.siVasJusto(sesion, 90).cabe && !T.siVasJusto(sesion, 90).quitar.length, `con tiempo de sobra, nada que dejar (la sesión, unos ${total} min)`);
const r40 = T.siVasJusto(sesion, 40);
check(r40.quitar[0].id === 'e' && r40.quitar.every((x) => !['a', 'b'].includes(x.id)), 'si va justo: primero lo prescindible y nunca lo obligatorio');
check(r40.quitar.findIndex((x) => x.id === 'e') < r40.quitar.findIndex((x) => x.id === 'f' || x.id === 'd'), 'luego los accesorios');
const r25 = T.siVasJusto(sesion, 25), r15 = T.siVasJusto(sesion, 15);
check(r25.quitar.some((x) => x.id === 'c' && x.que === 'una serie menos'), 'si aún no da: una serie menos en lo muy importante');
check(!r15.cabe && /no llega/.test(T.textoVasJusto(r15, 15)), 'y si ni así llega, lo dice (que haga lo obligatorio y se lo cuente a su coach)');
check(sesion.every((e) => e.series >= 3) && sesion[0].series === 4, 'la sesión no se toca (solo es consejo)');
check(/toda la sesión/.test(T.textoVasJusto(T.siVasJusto(sesion, 90), 90)), 'el texto, cuando le da para todo');

// calentamiento
const cal = T.calentamiento(sesion, ['hombro']);
check(cal[0].startsWith('2 minutos de cardio') && cal.some((x) => /por tu hombro/.test(x)) && /aproximación/.test(cal.at(-1)), 'su calentamiento: cardio suave, lo de su zona y las aproximaciones');
check(cal.some((x) => /Sentadilla sin peso/.test(x)) && cal.length <= 7, 'con los patrones de hoy, sin pasarse de largo');
check(T.calentamiento([{ id: 'x', series: 1, ejercicio: { nombre: 'Correr en cinta' } }], []).length === 0 && T.calentamiento([], []).length === 0, 'una sesión de cardio (o vacía), sin calentamiento de fuerza');

// alternativas
const alts = [{ id: 'p' }, { id: 'q' }, { id: 'r' }];
check(T.ordenarAlternativas(alts, 'r').map((x) => x.id).join() === 'r,p,q' && T.ordenarAlternativas(alts, null) === alts && T.ordenarAlternativas(alts, 'z').map((x) => x.id).join() === 'p,q,r', 'la que eligió la última vez, delante (de las del coach)');

// hace un año
check(T.hastaHaceUnAno('2026-11-13') === '2025-12-18', 'busca lo último de antes de hace 330 días');
const u = { fecha: '2025-11-12', series: [{ kg: 50, reps: 10 }, { kg: 60, reps: 8 }, { kg: 60, reps: 6 }] };
check(T.haceUnAno(u, '2026-11-13').texto === 'Hace un año, por estas fechas: 60 × 8.', 'lo de hace un año: su mejor serie de entonces');
check(T.haceUnAno({ ...u, fecha: '2025-06-01' }, '2026-11-13') === null && T.haceUnAno(null, '2026-11-13') === null, 'si no es de por estas fechas (o no hay), nada');
console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
