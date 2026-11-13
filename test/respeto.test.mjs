// Personalización 3, tanda 7: su manual, lo que no quiere ver, su ciclo (su propio patrón) y su informe para el médico
// o el fisio. Lógica pura.
//   node test/respeto.test.mjs
import * as R from '../web/src/logica/respeto.js';
import { normalizarAjustes } from '../web/src/ui/ajustes.js';
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

// 9. manual
const man = R.textoManual({ manual_feedback: 'suave', manual_motiva: ['retos', 'datos'], manual_evitar: 'Comparaciones' });
check(man.feedback === 'Feedback suave' && man.motiva === 'Los retos, Los datos y las cifras' && man.evitar === 'Comparaciones', 'su manual, en palabras');
check(R.textoManual({}) === null && R.textoManual(null) === null, 'sin manual, nada');
check(/dale alguna/.test(R.ideaSegunManual('Felicítale.', { manual_motiva: ['datos'] })) && /proponle uno/.test(R.ideaSegunManual('Felicítale.', { manual_motiva: ['retos'] })) && R.ideaSegunManual('Felicítale.', {}) === 'Felicítale.', 'la idea para el coach, a su manera');

// 10. ocultar
check(JSON.stringify(R.limpiarOcultar({ peso: true, kcal: 'si', otra: true })) === JSON.stringify({ peso: true, kcal: false, ranking: false }), 'solo lo que se puede ocultar, y solo con «true»');
check(R.textoOcultar({ peso: true, ranking: true }) === 'Sin báscula, Sin rankings' && R.textoOcultar({}) === 'Todo a la vista', 'el texto de la fila');
check(normalizarAjustes({ ocultar: { peso: true } }).ocultar.peso === true && normalizarAjustes({}).ocultar.kcal === false, 'va en los ajustes del móvil');

// 11. ciclo
const inicios = ['2026-07-01', '2026-07-29', '2026-08-26', '2026-09-23'];
check(R.duracionCiclo(inicios) === 28 && R.duracionCiclo(['2026-07-01', '2026-08-02']) === 32 && R.duracionCiclo(['2026-07-01']) === 28, 'la duración de su ciclo (su mediana)');
check(R.faseDe('2026-09-24', inicios) === 'menstruacion' && R.faseDe('2026-09-30', inicios) === 'folicular' && R.faseDe('2026-10-06', inicios) === 'ovulacion' && R.faseDe('2026-10-15', inicios) === 'lutea', 'la fase de cada día');
check(R.faseDe('2026-06-01', inicios) === null && R.faseDe('2026-11-30', inicios) === null, 'antes de apuntar, o mucho después del último inicio, no se sabe');
check(!R.patronCiclo([], inicios.slice(0, 2)).listo && /tres inicios/.test(R.patronCiclo([], inicios.slice(0, 2)).motivo), 'con menos de tres inicios, aún no');
const ent = [];
const fecha = (d) => new Date(Date.UTC(2026, 6, 1 + d)).toISOString().slice(0, 10);
for (let d = 0; d < 100; d += 3) ent.push({ fecha: fecha(d), records: 0, rpe_sesion: 7 });
const plano = R.patronCiclo(ent, inicios);
check(plano.listo && /rindes parecido/.test(plano.texto), 'sin diferencias, lo dice: no hay patrón');
const conRec = ent.map((x) => ({ ...x, records: R.faseDe(x.fecha, inicios) === 'folicular' ? 2 : 0 }));
check(/fase folicular/.test(R.patronCiclo(conRec, inicios).texto), 'con diferencias claras, la fase en que rinde más (de sus datos)');
check(!R.patronCiclo(ent.slice(0, 5), inicios).listo, 'con pocas sesiones, aún no');

// 12. informe
const inf = R.informeSalud({ entrenos: [{ fecha: '2026-11-10', duracion_min: 60, rpe_sesion: 8 }, { fecha: '2026-11-12', duracion_min: 50, rpe_sesion: 7 }, { fecha: '2026-09-01' }],
  molestias: [{ semana_inicio: '2026-11-09', zona: 'zona_lumbar', intensidad: 1 }], sueno: [{ fecha: '2026-11-10', sueno_min: 420 }, { fecha: '2026-11-11', sueno_min: 360 }], hoy: '2026-11-13', nombre: 'Ana' });
const ult = inf.semanas.at(-1);
check(inf.semanas.length === 8 && ult.lunes === '2026-11-09' && ult.sesiones === 2 && ult.minutos === 110 && ult.rpe === 7.5, 'por semana: sesiones, minutos y esfuerzo');
check(ult.molestias[0].zona === 'zona_lumbar' && inf.suenoMedio === 390 && inf.totalSesiones === 2, 'sus molestias y su sueño medio (solo de esas semanas)');
console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
