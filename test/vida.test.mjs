// Personalización 3, tanda 6: su agenda (y preguntarle qué tal), la semana difícil (lo obligatorio, como consejo), sus
// guardias y el check-in que sigue la conversación. Lógica pura.
//   node test/vida.test.mjs
import * as V from '../web/src/logica/vida.js';
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const hoy = '2026-11-13'; // viernes
const agenda = [
  { id: '1', tipo: 'evento', fecha: '2026-11-10', titulo: 'El examen de la oposición' },
  { id: '2', tipo: 'evento', fecha: '2026-11-13', titulo: 'La mudanza' },
  { id: '3', tipo: 'evento', fecha: '2026-11-01', titulo: 'Boda de mi hermana' },
  { id: '4', tipo: 'evento', fecha: '2026-11-12', titulo: 'Entrevista', respuesta: 'bien' },
  { id: '5', tipo: 'evento', fecha: '2026-12-20', titulo: 'Viaje a Roma' },
  { id: '6', tipo: 'dificil', fecha: '2026-11-09' },
  { id: '7', tipo: 'guardia', fecha: '2026-11-16' },
];
check(V.eventoDeHoy(agenda, hoy, { nombre: 'Ana' }).texto === 'Hoy: La mudanza. ¡Mucho ánimo, Ana!' && /^¡Hoy es el día/.test(V.eventoDeHoy(agenda, hoy, { tono: 'tope' }).texto), 'lo de hoy, con su nombre y en su tono');
const p = V.preguntaPendiente(agenda, hoy);
check(p.id === '1' && p.pregunta === '¿Qué tal el examen de la oposición?', 'pregunta por lo último de esta semana sin contestar');
check(V.preguntaPendiente([agenda[2]], hoy) === null && V.preguntaPendiente([agenda[3]], hoy) === null, 'no por lo de hace más de una semana ni lo ya contestado');
check(V.preguntaPendiente([{ tipo: 'evento', fecha: '2026-11-12', titulo: 'Entrevista' }], hoy).pregunta === '¿Qué tal «Entrevista»?', 'con comillas si no lleva artículo');
check(V.proximos(agenda, hoy, 60).map((x) => x.id).join() === '2,5', 'lo que viene');
// semana difícil
check(V.semanaDificil(agenda, hoy)?.id === '6' && V.semanaDificil(agenda, '2026-11-17') === null, 'la semana difícil, la de esta semana');
const ses = [{ id: 'a', nombre: 'Torso A', completada: true, ejercicios: [{ nombre: 'Press', prioridad: 'alta' }] },
  { id: 'b', nombre: 'Pierna B', ejercicios: [{ nombre: 'Sentadilla', prioridad: 'alta' }, { nombre: 'Curl femoral', prioridad: 'baja' }, { nombre: 'Peso muerto rumano', prioridad: 'alta' }] }];
check(JSON.stringify(V.minimoDeSemana(ses)) === JSON.stringify([{ id: 'b', nombre: 'Pierna B', obligatorios: ['Sentadilla', 'Peso muerto rumano'] }]), 'lo obligatorio de lo que le queda (consejo, sin tocar las sesiones)');
check(ses[1].ejercicios.length === 3, 'las sesiones siguen igual');
check(V.mensajeSemanaDificil('exámenes') === 'Esta semana va a ser difícil (exámenes). Intentaré hacer al menos lo obligatorio de cada sesión.', 'el mensaje para su coach');
// guardias
const semana = [{ id: 's1', nombre: 'Torso A', dia_previsto: '2026-11-16' }, { id: 's2', nombre: 'Pierna B', dia_previsto: '2026-11-17' }, { id: 's3', nombre: 'Full', dia_previsto: '2026-11-19' }, { id: 's4', nombre: 'Hecha', dia_previsto: '2026-11-16', completada: true }];
const ch = V.choquesGuardia(agenda, semana, hoy);
check(ch.length === 2 && ch[0].que === 'guardia' && /El lunes tienes guardia/.test(ch[0].texto) && ch[1].que === 'saliente' && /sales de guardia/.test(ch[1].texto), 'sesiones el día de guardia o al salir de una: consejo de cambiarla');
check(V.choquesGuardia([], semana, hoy).length === 0 && V.guardiasProximas(agenda, hoy).join() === '2026-11-16', 'sin guardias, nada; y sus próximas guardias');
// check-in
check(V.seguimientoCheckin('sueno', { horas_sueno: '5-6' }) === 'La semana pasada dormías 5–6 horas: ¿ha ido mejor?' && V.seguimientoCheckin('sueno', { horas_sueno: '7-8' }) === null, 'el sueño, si fue poco');
check(/cansado/.test(V.seguimientoCheckin('energia', { energia: 2 })) && V.seguimientoCheckin('energia', { energia: 4 }) === null && /motivación/.test(V.seguimientoCheckin('motivacion', { motivacion: 1 })), 'la energía y la motivación, si fueron bajas');
check(V.seguimientoCheckin('molestias', null, [{ zona: 'zona_lumbar', intensidad: 2 }, { zona: 'hombros', intensidad: 1 }, { zona: 'pectoral', intensidad: 0 }]) === 'La semana pasada notabas molestias en la zona lumbar y los hombros: ¿cómo siguen?', 'sus molestias de la semana pasada');
check(V.seguimientoCheckin('sueno', null) === null && V.seguimientoCheckin('peso', { horas_sueno: '<5' }) === null, 'sin semana pasada (o en otra pregunta), nada');
console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
