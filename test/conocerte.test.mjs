// Personalización 2, tanda 3: «la última vez…» como persona, sus momentos buenos, el descanso que de verdad hace, cómo
// está hoy y su molestia por zona. Lógica pura.
//   node test/conocerte.test.mjs
import * as C from '../web/src/logica/conocerte.js';
import { ZONAS_MOLESTIA, MOMENTO_VALIDO } from '../web/src/logica/personal.js';
import { ZONAS_LESION } from '../web/src/logica/cuestionario.js';
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const ana = { nombre: 'Ana', tono: 'cercano' };
const s = (numero, reps, rpe = null) => ({ numero, reps, rpe });
const pauta = { reps_min: 6, reps_max: 8 };

// 11. la última vez
check(C.fraseUltimaVez({ fecha: '2026-11-10', series: [s(1, 8, 8), s(2, 8, 9), s(3, 7, 9.5)], pauta }, ana, { hoy: '2026-11-13' }) === 'Hace 3 días la tercera serie te costó (RPE 9,5): hoy empieza con calma y escucha al cuerpo.', 'una serie que costó mucho: cuál, con su RPE y cuándo');
check(/se quedó en 4 \(pedía 6–8\)/.test(C.fraseUltimaVez({ series: [s(1, 7), s(2, 4)], pauta }, ana)), 'una que se quedó corta: cuántas y cuántas pedía');
check(/al tope del rango \(8 o más\).*subir un poco, Ana\.$/.test(C.fraseUltimaVez({ series: [s(1, 8), s(2, 9), s(3, 8)], pauta }, ana)), 'todas al tope del rango: quizá toca subir (con su nombre)');
check(/cómodo \(RPE 7 como mucho\)/.test(C.fraseUltimaVez({ series: [s(1, 7, 6), s(2, 7, 7)], pauta }, ana)), 'todo cómodo: hay margen');
check(C.fraseUltimaVez({ series: [s(1, 7, 8), s(2, 7, 8)], pauta }, ana) === null && C.fraseUltimaVez(null, ana) === null && C.fraseUltimaVez({ series: [] }, ana) === null, 'si no pasó nada que contar, nada (sin inventar)');
check(/^Ayer:/.test(C.fraseUltimaVez({ fecha: '2026-11-12', series: [s(1, 8, 10)], pauta }, { tono: 'directo' }, { hoy: '2026-11-13' })) && /guerra/.test(C.fraseUltimaVez({ series: [s(1, 8, 10)], pauta }, { tono: 'tope' })), 'según su tono (y «ayer»)');

// 12. sus momentos buenos
const sesiones = [];
const fecha = (d) => { const x = new Date(Date.UTC(2026, 8, 1 + d)); return x.toISOString().slice(0, 10); };
for (let i = 0; i < 6; i++) { const f = fecha(i * 7); sesiones.push({ fecha: f, inicio: `${f}T16:30:00Z`, records: i < 4 ? 1 : 0 }); } // martes por la tarde (18:30 en Madrid)
for (let i = 0; i < 6; i++) { const f = fecha(i * 7 + 3); sesiones.push({ fecha: f, inicio: `${f}T06:30:00Z`, records: 0 }); } // viernes por la mañana
const m = C.mejorMomento(sesiones, '2026-12-31');
check(m && m.dia === 'martes' && m.franja === 'por la tarde' && m.records === 4 && m.texto === 'Tus martes por la tarde son tu mejor momento: ahí han caído 4 récords en 6 sesiones.', 'su mejor momento: el día y la franja con más récords');
check(/sesión más dura/.test(m.propuesta), 'y la propuesta para su coach');
check(C.mejorMomento(sesiones.slice(0, 8), '2026-12-31') === null && C.mejorMomento(sesiones.map((x) => ({ ...x, records: 0 })), '2026-12-31') === null, 'con pocas sesiones o sin récords, nada');

// 13. el descanso que de verdad hace
const ts = (seg) => ({ registrada_en: new Date(Date.UTC(2026, 10, 10, 10, 0, 0) + seg * 1000).toISOString() });
check(C.descansoReal([ts(0), ts(180), ts(370), ts(550)]) === 150, 'de los huecos entre series (la mediana, menos lo que dura la serie, a 15 s)');
check(C.descansoReal([ts(0), ts(180)]) === null && C.descansoReal([ts(0), ts(20), ts(40)]) === null && C.descansoReal([ts(0), ts(1000), ts(2000)]) === null, 'con un solo hueco, o huecos raros, nada');
check(C.propuestaDescanso({ series: [ts(0), ts(180), ts(370)], actual: 90 }) === 150 && C.propuestaDescanso({ series: [ts(0), ts(180), ts(370)], actual: 135 }) === null, 'se propone si se aleja medio minuto o más del que tiene');
check(C.propuestaDescanso({ series: [ts(0), ts(180), ts(370)], actual: 90, delCoach: true }) === null && C.propuestaDescanso({ series: [ts(0), ts(180), ts(370)], actual: 90, rechazada: true }) === null, 'nunca si lo puso el coach, ni si ya dijo que no');

// 14. hoy, por cómo estás
check(C.hoyPorComoEstas({ suenoMin: 300 }, ana).texto === 'Dormiste 5 horas, Ana: hoy prioriza la técnica y no busques récord.' && C.hoyPorComoEstas({ suenoMin: 300 }, ana).nivel === 'regular', 'poco sueño: técnica y sin récords (con su nombre)');
check(C.hoyPorComoEstas({ prep: { sueno: 2, energia: 2, molestias: 1 } }, ana).nivel === 'malo' && /para y cuéntaselo/.test(C.hoyPorComoEstas({ prep: { sueno: 2, energia: 2, molestias: 1 } }, ana).texto), 'una molestia: sin pasar de lo pautado y, si duele, parar');
check(C.hoyPorComoEstas({ suenoMin: 480 }, ana).nivel === 'bueno' && C.hoyPorComoEstas({ suenoMin: 480, prep: { sueno: 3, energia: 1, molestias: 3 } }, ana).nivel === 'regular', 'buen sueño: a apretar (salvo sin energía)');
check(C.hoyPorComoEstas({}, ana) === null && C.hoyPorComoEstas({ suenoMin: 400 }, ana) === null, 'sin nada que decir, nada');

// 15. su molestia por zona
check(C.zonasDeEjercicio({ nombre: 'Press militar con barra', grupos_musculares: ['deltoides', 'triceps'] }).includes('hombro') && C.zonasDeEjercicio({ nombre: 'Sentadilla trasera', grupos_musculares: ['cuadriceps', 'gluteo'] }).includes('rodilla')
  && !C.zonasDeEjercicio({ nombre: 'Sentadilla trasera', grupos_musculares: ['cuadriceps', 'gluteo'] }).includes('hombro'), 'las zonas que carga cada ejercicio');
const les = [{ zona: 'hombro', limita: 1 }, { zona: 'otra', limita: 1 }];
check(C.avisoZona({ nombre: 'Press militar', grupos_musculares: ['deltoides'] }, les, { hombro: 'rango cómodo y sin dolor.' })?.titulo === 'Tu hombro'
  && C.avisoZona({ nombre: 'Press militar', grupos_musculares: ['deltoides'] }, les, { hombro: 'rango cómodo y sin dolor.' }).texto === 'rango cómodo y sin dolor.', 'su aviso: «Tu hombro: …», con el texto del coach');
check(C.avisoZona({ nombre: 'Press militar', grupos_musculares: ['deltoides'] }, les, {}) === null, 'sin texto del coach, nada (él lo escribe o lo aprueba)');
check(C.avisoZona({ nombre: 'Sentadilla', grupos_musculares: ['cuadriceps'] }, les, { hombro: 'x' }) === null && C.avisoZona({ nombre: 'Press militar', grupos_musculares: ['deltoides'] }, [], { hombro: 'x' }) === null, 'ni en ejercicios que no cargan su zona, ni a quien no la tiene');
check(C.ZONAS_AVISO.join() === ZONAS_MOLESTIA.join() && C.ZONAS_AVISO.every((z) => ZONAS_LESION.some(([k]) => k === z) && C.EJEMPLO_ZONA[z] && MOMENTO_VALIDO.has(C.momentoZona(z))), 'las zonas: las del cuestionario (menos «otra»), con su ejemplo y su momento');
console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
