// Personalización 2, tanda 1: cómo le hablamos (nombre, género, tono, saludo de su hora y qué celebrar). Lógica pura.
//   node test/trato.test.mjs
import * as T from '../web/src/logica/trato.js';
import { textoMensajeCoach, MOMENTOS_COACH } from '../web/src/logica/personal.js';
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

const ana = T.tratoDe({ apodo: 'Anita', genero: 'f', tono: 'tope' }, 'Ana López');
const sin = T.tratoDe(null, 'Carlos Vera');
check(ana.nombre === 'Anita' && ana.genero === 'f' && ana.tono === 'tope' && sin.nombre === 'Carlos' && sin.genero === 'n' && sin.tono === 'cercano', 'el trato: su apodo (o su nombre de pila), su género y su tono (sin elegir: sin marcar y cercano)');
check(T.tratoDe({ genero: 'x', tono: 'borde' }, 'Eva').genero === 'n' && T.tratoDe({ genero: 'x', tono: 'borde' }, 'Eva').tono === 'cercano', 'lo que no vale, como si no hubiera elegido');
check(T.g(ana, 'lista', 'listo', 'a punto') === 'lista' && T.g({ genero: 'm' }, 'lista', 'listo', 'a punto') === 'listo' && T.g(sin, 'lista', 'listo', 'a punto') === 'a punto', 'la palabra según su género (sin marcar, la forma sin género)');
check(T.conNombre(ana, 'Hoy toca pierna') === 'Anita, hoy toca pierna' && T.conNombre({ nombre: '' }, 'Hoy toca pierna') === 'Hoy toca pierna', 'con su nombre delante');
// el saludo de su hora y de su día
check(T.saludoDeHora({ hora: 8 }).saludo === 'Buenos días,' && T.saludoDeHora({ hora: 15 }).saludo === 'Buenas tardes,' && T.saludoDeHora({ hora: 23 }).saludo === 'Buenas noches,' && T.saludoDeHora({ hora: 3 }).saludo === 'Buenas noches,', 'buenos días, buenas tardes o buenas noches según la hora');
check(T.saludoDeHora({ hora: 7, costumbre: { franja: 'manana' } }, ana).saludo === 'Buenos días, madrugadora:' && T.saludoDeHora({ hora: 7, costumbre: { franja: 'manana' } }, { genero: 'm' }).saludo === 'Buenos días, madrugador:'
  && T.saludoDeHora({ hora: 7, costumbre: { franja: 'manana' } }, sin).saludo === 'Buenos días,', 'a quien entrena temprano, «madrugadora» o «madrugador» (sin marcar, nada)');
check(/Primer entreno de la semana/.test(T.saludoDeHora({ hora: 9, primeraDeSemana: true }).detalle) && /Domingo/.test(T.saludoDeHora({ hora: 9, dow: 6 }).detalle) && T.saludoDeHora({ hora: 9, dow: 6 }, { tono: 'directo' }).detalle === null, 'y algo de su día (el domingo, el primer entreno de la semana)');
// los momentos
check(T.antesDelTitulo(ana) === 'Anita, hoy toca' && T.antesDelTitulo(ana, { esHoy: false }) === 'Anita, te espera' && T.antesDelTitulo({ nombre: '' }) === null, 'la portada de la sesión: «Anita, hoy toca»');
check(T.avisoRecord(sin, 'press banca') === '¡Récord en press banca, Carlos!' && T.avisoRecord({ ...sin, tono: 'directo' }, 'press banca') === 'Récord: press banca.' && T.avisoRecord(ana, 'press banca').endsWith('🔥'), 'el récord con su nombre, en su tono');
const r1 = T.titularResumen(sin, { records: 1 }), r2 = T.titularResumen(ana, { records: 0 }), r3 = T.titularResumen({ ...sin, tono: 'directo' }, {});
check(r1.titulo === '¡Qué sesión, Carlos!' && r1.sub === 'Con récord incluido.' && r2.titulo === '¡Sesión hecha, Anita!' && r2.sub === 'Estás hecha una máquina.' && r3.titulo === 'Sesión hecha' && r3.sub === null, 'el titular del resumen: su nombre, su tono y su género');
check(T.bienvenidaPrimera(ana) === '¡Bienvenida,' && T.bienvenidaPrimera({ genero: 'm' }) === '¡Bienvenido,' && T.bienvenidaPrimera(sin) === 'Te damos la bienvenida,', 'la primera vez: bienvenida, bienvenido o una forma sin género');
check(T.rematePorTono(sin, 'Hoy toca Pierna A.') === 'Hoy toca Pierna A.' && T.rematePorTono({ tono: 'directo' }, 'Vienes de un récord en Press. ¡A por más!') === 'Vienes de un récord en Press.' && T.rematePorTono({ tono: 'tope' }, 'Hoy toca Pierna A.') === 'Hoy toca Pierna A! 💪', 'el mensaje del día, en su tono');
// la voz
check(T.vozRecord(ana) === '¡Récord, Anita!' && T.vozUltima(ana, 'Serie 4 de press: 60 kilos por 8.') === 'Última serie, Anita. Serie 4 de press: 60 kilos por 8.' && T.vozFin(sin) === 'Sesión hecha, Carlos. Buen trabajo.', 'la voz del entrenador dice su nombre');
// qué celebrar
check(JSON.stringify(T.limpiarCelebrar({ record: 'nada', racha: 'mal' })) === JSON.stringify({ record: 'nada', racha: 'todo', semana: 'todo', bloque: 'todo', otros: 'todo' }) && T.modoCelebrar({ celebrar: { record: 'vibrar' } }, 'record') === 'vibrar' && T.modoCelebrar({}, 'semana') === 'todo',
  'qué celebrar y cómo (de entrada, todo)');
// los momentos nuevos del coach
check(MOMENTOS_COACH.some(([k]) => k === 'aniversario') && MOMENTOS_COACH.some(([k]) => k === 'meta') && textoMensajeCoach('{tiempo} entrenando juntos, {nombre}.', { tiempo: '6 meses', nombre: 'Ana' }) === '6 meses entrenando juntos, Ana.'
  && textoMensajeCoach('Una semana para {meta}, {nombre}.', { meta: 'tu boda', nombre: 'Ana' }) === 'Una semana para tu boda, Ana.', 'los mensajes del coach ganan el aniversario y la meta ({tiempo} y {meta})');
console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
