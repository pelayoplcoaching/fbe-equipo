// FBE Esencial sin coach, tanda 2 (lógica pura y la demo): el cierre de la semana de quien va por su cuenta. La pregunta
// del domingo, pasar o repetir, la semana que viene ya lista (y adelantar su primera sesión), la pausa y sus textos
// (logica/esencial-cierre.js); que «pasar» prepare la siguiente sin esperar al lunes (siguientePaso) y, en memoria, lo
// mismo que hace la base (cerrarSemanaEsencialDemo, como esencial_cerrar_semana de la 098).
import { estadoCierre, textoCierre, puedePausar, cierreDe, horaMadrid, HORA_PREGUNTA, HORA_AUTO, HORA_AUTO_098, MAX_REPETIR } from '../web/src/logica/esencial-cierre.js';
import { siguientePaso } from '../web/src/logica/esencial-semana.js';
import { cerrarSemanaEsencialDemo } from '../web/src/datos/semilla-esencial.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const falla = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };

// Semana del lunes 11/1/2027 al domingo 17/1; la siguiente, el 18
const L = '2027-01-11', D = '2027-01-17', L2 = '2027-01-18';
const w5 = { id: 'w5', bloque_id: 'b', numero: 5, fecha_inicio: L, programacion: 'programada' };
const w6 = { id: 'w6', bloque_id: 'b', numero: 6, fecha_inicio: L2, programacion: 'programada', nota_coach: 'Esta semana subes la prensa.' };
const ses = (hechas, total = 2, extra = {}) => Array.from({ length: total }, (_, i) => ({ id: `s${i + 1}`, orden: i + 1, nombre: `Día ${i + 1}`, completada: i < hechas, fecha_realizada: i < hechas ? '2027-01-12' : null, ...extra }));

console.log('La pregunta del domingo');
check(HORA_PREGUNTA === '21:00' && HORA_AUTO === '22:00' && HORA_AUTO_098 === '23:30' && MAX_REPETIR === 2, 'a las 21:00 se pregunta; a las 22:00, se pasa (a las 23:30 con la base sin la 099); repetir, como mucho dos veces');
const preg = estadoCierre({ semanas: [w5], sesiones: { w5: ses(1) }, hoy: D, hora: '21:00' });
check(preg?.tipo === 'pregunta' && preg.faltan === 1 && preg.total === 2 && preg.puedeRepetir, 'domingo a las 21:00 con una sesión sin hacer: se pregunta');
check(estadoCierre({ semanas: [w5], sesiones: { w5: ses(1) }, hoy: D, hora: '20:59' }) === null && estadoCierre({ semanas: [w5], sesiones: { w5: ses(1) }, hoy: '2027-01-16', hora: '22:00' }) === null,
  'antes de las 21:00 o un sábado, aún no');
check(estadoCierre({ semanas: [w5], sesiones: { w5: ses(2) }, hoy: D, hora: '22:00' }) === null, 'con la semana completa (y la siguiente sin preparar), nada');
check(estadoCierre({ semanas: [{ ...w5, esencial_repetida: 2, esencial_cierre: 'repetir', esencial_cierre_lunes: '2027-01-04' }], sesiones: { w5: ses(1) }, hoy: D, hora: '22:00' })?.puedeRepetir === false,
  'repetida ya dos veces: solo queda pasar');
const tp = textoCierre(preg);
check(/te queda una sesión/.test(tp.titulo) && /antes de las 22:00/.test(tp.plazo) && /no se recupera doblando/.test(tp.pasar) && /lo hecho se queda hecho/.test(tp.repetir), 'sus textos: qué queda, qué hace cada opción y hasta cuándo (las 22:00)');
check(/antes de las 23:30/.test(textoCierre(estadoCierre({ semanas: [w5], sesiones: { w5: ses(1) }, hoy: D, hora: '21:10', horaAuto: HORA_AUTO_098 })).plazo), 'con la base sin la 099, el texto dice las 23:30 (que es cuando lo hace ella)');
check(/te quedan 2 sesiones/.test(textoCierre(estadoCierre({ semanas: [w5], sesiones: { w5: ses(0) }, hoy: D, hora: '23:00' })).titulo), 'con dos sin hacer, en plural');

console.log('\nLo elegido');
const pasada = (c) => estadoCierre({ semanas: [{ ...w5, esencial_cierre: c, esencial_cierre_lunes: L }], sesiones: { w5: ses(1) }, hoy: D, hora: '23:45' });
check(pasada('pasar')?.tipo === 'pasada' && !pasada('pasar').auto && pasada('auto')?.auto === true, 'pasar (o pasada sola a las 22:00): ya no se pregunta');
check(/Como no elegiste/.test(textoCierre(pasada('auto')).texto) && /empieza el lunes/.test(textoCierre(pasada('pasar')).texto), 'y se dice cómo fue');
check(cierreDe({ esencial_cierre: 'repetir', esencial_cierre_lunes: '2027-01-04' }, L) === null && cierreDe({ esencial_cierre: 'pasar', esencial_cierre_lunes: `${L}T00:00:00` }, L) === 'pasar',
  'lo elegido otra semana no vale para esta (una repetida se vuelve a preguntar)');
const rep = estadoCierre({ semanas: [{ ...w5, esencial_cierre: 'repetir', esencial_cierre_lunes: '2027-01-04', esencial_repetida: 1 }], sesiones: { w5: ses(1) }, hoy: '2027-01-13', hora: '10:00' });
check(rep?.tipo === 'repite' && rep.veces === 1 && /Repites esta semana: te queda una sesión/.test(textoCierre(rep).titulo), 'la semana repetida, entre semana: «Repites esta semana»');

console.log('\nLa semana que viene, ya lista');
const lista = estadoCierre({ semanas: [w5, w6], sesiones: { w5: ses(2), w6: ses(0) }, hoy: '2027-01-15', hora: '18:00' });
check(lista?.tipo === 'lista' && lista.primera?.nombre === 'Día 1' && lista.puedeAdelantar && lista.siguiente.id === 'w6', 'semana hecha el viernes y la siguiente preparada: se puede adelantar el Día 1');
const hoyMismo = estadoCierre({ semanas: [w5, w6], sesiones: { w5: ses(2, 2, { fecha_realizada: '2027-01-15' }), w6: ses(0) }, hoy: '2027-01-15', hora: '18:00' });
check(hoyMismo?.tipo === 'lista' && !hoyMismo.puedeAdelantar && /Desde mañana/.test(textoCierre(hoyMismo).texto), 'si hoy ya ha hecho una sesión, hoy no (nunca dos el mismo día): «Desde mañana»');
const adel = estadoCierre({ semanas: [w5, w6], sesiones: { w5: ses(2), w6: ses(1, 2, { fecha_realizada: '2027-01-17' }) }, hoy: D, hora: '12:00' });
check(adel?.tipo === 'lista' && adel.empezada && !adel.puedeAdelantar && adel.primera?.nombre === 'Día 2' && /Ya has adelantado/.test(textoCierre(adel).texto), 'adelantada la primera el domingo: cuenta en su semana, y ese día no se adelanta otra');

console.log('\nLa pausa');
const enPausa = estadoCierre({ semanas: [{ ...w5, fecha_inicio: L2, esencial_cierre: 'pausa', esencial_cierre_lunes: L }], sesiones: { w5: ses(1) }, hoy: '2027-01-13', hora: '10:00' });
check(enPausa?.tipo === 'pausa' && enPausa.vuelve === L2 && enPausa.faltan === 1 && /Vuelves el/.test(textoCierre(enPausa).texto), 'en pausa: su semana, corrida al lunes que viene, y cuándo vuelve');
check(puedePausar({ semanas: [w5], sesiones: { w5: ses(1) }, hoy: '2027-01-13' }) && !puedePausar({ semanas: [w5], sesiones: { w5: ses(2) }, hoy: '2027-01-13' })
  && !puedePausar({ semanas: [{ ...w5, fecha_inicio: L2, esencial_cierre: 'pausa', esencial_cierre_lunes: L }], sesiones: { w5: ses(1) }, hoy: '2027-01-13' }) && !puedePausar({ semanas: [], sesiones: {}, hoy: L }),
  'se puede pausar con sesiones sin hacer; no con la semana hecha, ya en pausa o sin semana');
check(/^\d\d:\d\d$/.test(horaMadrid()) && horaMadrid(new Date('2027-01-17T20:05:00Z')) === '21:05' && horaMadrid(new Date('2027-07-18T19:30:00Z')) === '21:30', 'la hora de Madrid (en invierno y en verano)');

console.log('\nPasar prepara la siguiente sin esperar al lunes');
const bloque = { id: 'b', nombre: 'Novato 2 días · FBE Esencial' };
check(siguientePaso({ bloque, semanas: [w5], sesiones: { w5: ses(1) }, hoy: D }) === null, 'el domingo, con la semana a medias y sin elegir: nada');
const paso = siguientePaso({ bloque, semanas: [{ ...w5, esencial_cierre: 'pasar', esencial_cierre_lunes: L }], sesiones: { w5: ses(1) }, hoy: D });
check(paso?.tipo === 'siguiente' && paso.inicio === L2 && paso.adelantada === true, 'con «pasar»: la del lunes, ya (adelantada, para no esperar a una duda)');
check(siguientePaso({ bloque, semanas: [{ ...w5, esencial_cierre: 'auto', esencial_cierre_lunes: L }], sesiones: { w5: ses(0) }, hoy: D })?.inicio === L2, 'y con la que se pasó sola a las 22:00');
check(siguientePaso({ bloque, semanas: [{ ...w5, fecha_inicio: L2, esencial_cierre: 'repetir', esencial_cierre_lunes: L, esencial_repetida: 1 }], sesiones: { w5: ses(1) }, hoy: L2 }) === null,
  'repetida (corrida al lunes): esa semana no se prepara otra');
const hecha = siguientePaso({ bloque, semanas: [w5], sesiones: { w5: ses(2) }, hoy: '2027-01-15' });
check(hecha?.inicio === L2 && !hecha.adelantada, 'con la semana completa el viernes, como siempre (y sin «adelantada»)');
check(siguientePaso({ bloque: { id: 'b', nombre: 'Primeras 4 semanas' }, semanas: [{ ...w5, numero: 2, esencial_cierre: 'pasar', esencial_cierre_lunes: L }], sesiones: { w5: ses(1) }, hoy: D }) === null,
  'en «Primeras 4 semanas» no hay nada que preparar: ya están publicadas');

console.log('\nEn la demo, como en la base');
const base = () => {
  const db = {
    atletas: [{ id: 'a', modalidad: 'por_su_cuenta', estado: 'activo' }, { id: 'c', modalidad: 'seguimiento', estado: 'activo' }],
    bloques: [{ id: 'b', atleta_id: 'a', es_plantilla: false, estado: 'activo', nombre: 'Novato 2 días · FBE Esencial', fecha_inicio: '2026-12-14', fecha_fin: D }],
    semanas: [{ ...w5 }],
    sesiones: [{ id: 's1', semana_id: 'w5', completada: true, dia_previsto: '2027-01-12' }, { id: 's2', semana_id: 'w5', completada: false, dia_previsto: '2027-01-14' }],
  };
  return { db, t: (n) => (db[n] ||= []) };
};
let x = base();
check(/domingo/.test(falla(() => cerrarSemanaEsencialDemo(x.t, { decision: 'repetir', atletaId: 'a', hoy: '2027-01-13' })) || ''), 'repetir o pasar, solo el domingo');
check(/por su cuenta/.test(falla(() => cerrarSemanaEsencialDemo(x.t, { decision: 'pausa', atletaId: 'c', hoy: '2027-01-13' })) || '') && /Elige/.test(falla(() => cerrarSemanaEsencialDemo(x.t, { decision: 'otra', atletaId: 'a', hoy: D })) || ''),
  'solo quien va por su cuenta, y solo esas cuatro cosas');
let r = cerrarSemanaEsencialDemo(x.t, { decision: 'repetir', atletaId: 'a', hoy: D });
check(r.inicio === L2 && r.faltan === 1 && x.db.semanas[0].fecha_inicio === L2 && x.db.semanas[0].esencial_repetida === 1 && x.db.semanas[0].esencial_cierre_lunes === L
  && x.db.sesiones[1].dia_previsto === '2027-01-21' && x.db.sesiones[0].dia_previsto === null && x.db.sesiones[0].completada && x.db.bloques[0].fecha_fin === '2027-01-24',
  'repetir: la semana pasa al lunes que viene con lo que faltaba (su día, una semana después); lo hecho se queda hecho');
check(/No tienes una semana en curso/.test(falla(() => cerrarSemanaEsencialDemo(x.t, { decision: 'pasar', atletaId: 'a', hoy: D })) || ''), 'y ya no hay semana en curso que cerrar');
x.db.semanas[0].esencial_repetida = 2;
check(/dos veces/.test(falla(() => cerrarSemanaEsencialDemo(x.t, { decision: 'repetir', atletaId: 'a', hoy: '2027-01-24' })) || ''), 'la tercera vez, no: toca pasar');
x = base();
r = cerrarSemanaEsencialDemo(x.t, { decision: 'pasar', atletaId: 'a', hoy: D });
check(r.decision === 'pasar' && x.db.semanas[0].fecha_inicio === L && x.db.semanas[0].esencial_cierre === 'pasar' && x.db.semanas[0].esencial_cierre_lunes === L, 'pasar: se apunta en la semana y nada se mueve');
x.db.semanas.push({ ...w6 });
check(/ya está preparada/.test(falla(() => cerrarSemanaEsencialDemo(x.t, { decision: 'repetir', atletaId: 'a', hoy: D })) || ''), 'con la siguiente ya preparada, no se puede repetir');
x = base();
r = cerrarSemanaEsencialDemo(x.t, { decision: 'pausa', atletaId: 'a', hoy: '2027-01-13' });
check(r.inicio === L2 && x.db.semanas[0].esencial_cierre === 'pausa' && !x.db.semanas[0].esencial_repetida && estadoCierre({ semanas: x.db.semanas, sesiones: { w5: x.db.sesiones }, hoy: '2027-01-13' })?.tipo === 'pausa',
  'pausa, cualquier día: el plan se corre una semana (y no cuenta como repetida)');
r = cerrarSemanaEsencialDemo(x.t, { decision: 'reanudar', atletaId: 'a', hoy: '2027-01-14' });
check(r.inicio === L && x.db.semanas[0].fecha_inicio === L && x.db.semanas[0].esencial_cierre === null && x.db.sesiones[1].dia_previsto === '2027-01-14' && x.db.bloques[0].fecha_fin === D,
  '«Volver ya» esa misma semana: todo donde estaba');
check(/No tienes la semana en pausa/.test(falla(() => cerrarSemanaEsencialDemo(x.t, { decision: 'reanudar', atletaId: 'a', hoy: '2027-01-14' })) || ''), 'y sin pausa, nada que reanudar');
x = base();
x.db.sesiones.forEach((s) => { s.completada = true; });
check(/ya está completa/.test(falla(() => cerrarSemanaEsencialDemo(x.t, { decision: 'pausa', atletaId: 'a', hoy: '2027-01-13' })) || ''), 'con la semana completa, nada que cerrar');
// «Primeras 4 semanas»: se corren todas las que quedan (y el plan, si era su primera semana)
x = base();
x.db.bloques[0] = { ...x.db.bloques[0], nombre: 'Primeras 4 semanas', fecha_inicio: L, fecha_fin: '2027-02-07' };
x.db.semanas = [{ ...w5, numero: 1 }, { ...w6, numero: 2 }, { id: 'w7', bloque_id: 'b', numero: 3, fecha_inicio: '2027-01-25', programacion: 'programada' }];
r = cerrarSemanaEsencialDemo(x.t, { decision: 'repetir', atletaId: 'a', hoy: D });
check(x.db.semanas.map((w) => w.fecha_inicio).join() === '2027-01-18,2027-01-25,2027-02-01' && x.db.bloques[0].fecha_inicio === L2 && x.db.bloques[0].fecha_fin === '2027-02-14' && x.db.semanas[1].esencial_repetida == null,
  'en «Primeras 4 semanas»: esa y las siguientes, una semana después (solo la repetida cuenta como repetida)');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
if (fallos) process.exit(1);
