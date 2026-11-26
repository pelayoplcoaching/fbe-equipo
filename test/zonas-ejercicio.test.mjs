// (v0.257, M8) Las zonas que carga cada ejercicio (zonas-ejercicio.js) y el motor de molestias en la sesión y en la
// semana (dolor-sesion.js): M3 a M7, con las decisiones del formulario de las zonas (la ★ hasta que conteste Pelayo).
import { readFileSync } from 'node:fs';
import * as Z from '../web/src/logica/zonas-ejercicio.js';
import * as S from '../web/src/logica/dolor-sesion.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const igual = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

console.log('Las zonas de cada ejercicio (M8)');
check(igual(Z.zonasDe('Sentadilla con barra'), { rodilla: 2, cadera: 2, zona_lumbar: 1, tobillo_pie: 1 }), 'sentadilla con barra: rodilla y cadera mucho; zona lumbar y tobillo, algo');
check(igual(Z.zonasDe('Sentadilla barra baja'), { rodilla: 2, cadera: 2, zona_lumbar: 1, tobillo_pie: 1, hombro: 1, codo: 1, espalda_alta: 1 }), 'barra baja: además hombro, codo y espalda alta (cómo se sujeta la barra)');
check(igual(Z.zonasDe('Sentadilla goblet con talones elevados'), { rodilla: 2, cadera: 2, tobillo_pie: 1 }), 'una goblet con talones elevados es sentadilla, no gemelo');
check(igual(Z.zonasDe('Elevación de talones de pie'), { tobillo_pie: 2 }) && Z.zonasDe('Gemelo en máquina de pie').zona_lumbar === 1, 'gemelo: tobillo y pie; de pie en máquina, algo de zona lumbar');
check(igual(Z.zonasDe('Peso muerto rumano con mancuernas'), { zona_lumbar: 2, cadera: 2, espalda_alta: 1, muneca_mano: 1 }) && Z.zonasDe('Peso muerto convencional').rodilla === 1 && !Z.zonasDe('Peso muerto rumano con barra').rodilla,
  'el peso muerto convencional carga algo la rodilla; el rumano, no');
check(Z.patronDe('Leg extensions')?.id === 'extension-rodilla' && Z.patronDe('Nórdico inverso')?.id === 'extension-rodilla' && Z.patronDe('Curl nórdico')?.id === 'nordico', 'el nórdico inverso es de cuádriceps; el curl nórdico, de isquios');
check(Z.patronDe('Jalón al pecho en máquina')?.id === 'jalon' && Z.patronDe('Remo con apoyo en el pecho en máquina')?.id === 'remo' && Z.patronDe('Press de pecho en máquina')?.id === 'press-horizontal',
  '«pecho en máquina» no confunde un jalón ni un remo con un press');
check(Z.patronDe('Inclinaciones laterales con mancuerna')?.id === 'inclinacion-lateral' && Z.patronDe('Elevaciones laterales con mancuernas')?.id === 'laterales', 'las inclinaciones laterales no son elevaciones laterales');
check(Z.zonasDe('Press militar con barra').zona_lumbar === 1 && !Z.zonasDe('Press militar sentado con mancuernas').zona_lumbar && !Z.zonasDe('Press militar en máquina').zona_lumbar, 'press militar de pie: algo de zona lumbar; sentado o en máquina, no');
check(Z.zonasDe('Floor press con mancuernas').hombro === 1 && Z.zonasDe('Press banca').hombro === 2 && Z.zonasDe('Press banca agarre cerrado').codo === 2, 'en el suelo, menos hombro; con agarre cerrado, más codo');
check(Z.zonasDe('Remo con barra').zona_lumbar === 2 && !Z.zonasDe('Remo con mancuernas apoyado en banco inclinado').zona_lumbar && Z.zonasDe('Remo con mancuerna a una mano').zona_lumbar === 1,
  'el remo inclinado sin apoyo carga mucho la zona lumbar; con el pecho apoyado, nada');
check(Z.zonasDe('Crunch con goma arrodillado').rodilla === 1 && Z.zonasDe('Patada de glúteo en cuadrupedia').muneca_mano === 1, 'la postura: de rodillas, algo de rodilla; en cuadrupedia, también las muñecas');
check(Z.zonasDe('Curl inverso con barra').muneca_mano === 2 && Z.zonasDe('Curl bayesian en polea').hombro === 1, 'curl inverso: mucha muñeca; bayesian: el hombro estirado');
// por sus grupos musculares, si el nombre no dice nada
check(igual(Z.zonasDe({ nombre: 'Ejercicio raro', grupos_musculares: ['cuadriceps', 'gluteo'] }), { rodilla: 2, cadera: 1 }) && igual(Z.zonasDe({ nombre: 'Algo', grupos_musculares: ['espalda', 'biceps'] }), { espalda_alta: 2, hombro: 1, codo: 1 }),
  'sin patrón en el nombre, por sus grupos: el principal, su zona; los secundarios, 1');
check(Object.keys(Z.zonasDe({ nombre: 'Nada', grupos_musculares: [] })).length === 0 && Z.cargaDe('otra', 'Sentadilla') === 0 && Z.cargaDe('rodilla', null) === 0, 'sin nada, ninguna zona; «otra» nunca');
check(Z.PATRONES.every((p) => Object.values(p.z).every((v) => v === 1 || v === 2) && p.nombre && p.porque) && new Set(Z.PATRONES.map((p) => p.id)).size === Z.PATRONES.length, 'cada patrón: id único, nombre, por qué y pesos de 1 o 2');
const src = readFileSync(new URL('../web/src/logica/zonas-ejercicio.js', import.meta.url), 'utf8').replace(/\/\/[^\n]*/g, '').replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
check(!/[^\x00-\x7f]/.test(src), 'las expresiones regulares, solo ASCII (con una tilde dentro, la compilación falla)');
const alts = [{ nombre: 'Sentadilla con barra' }, { nombre: 'Hip thrust' }, { nombre: 'Leg extensions' }, { nombre: 'Puente de glúteo' }];
check(Z.ordenarAlternativas('rodilla', alts).map((a) => a.nombre).join() === 'Hip thrust,Puente de glúteo,Sentadilla con barra,Leg extensions', 'las alternativas, de la que menos carga la rodilla a la que más (a igualdad, en su orden)');

console.log('\nEn la sesión (M3, M4, M5 y el rojo de M7)');
const hoy = '2027-02-10';
const ejs = {
  sq: { id: 'sq', nombre: 'Sentadilla con barra', alternativas: ['ht', 'le'] }, ht: { id: 'ht', nombre: 'Hip thrust', alternativas: [] }, le: { id: 'le', nombre: 'Leg extensions', alternativas: [] },
  pb: { id: 'pb', nombre: 'Press banca', alternativas: ['fp'] }, fp: { id: 'fp', nombre: 'Floor press con mancuernas', alternativas: [] },
  pl: { id: 'pl', nombre: 'Plancha', por_tiempo: true, alternativas: ['pb'] }, pr: { id: 'pr', nombre: 'Prensa de piernas', alternativas: ['le'] },
};
const pautas = [{ id: 'p1', ejercicio_id: 'sq', series: 3, carga_sugerida_kg: 60 }, { id: 'p2', ejercicio_id: 'pb', series: 3, carga_sugerida_kg: 40 }, { id: 'p3', ejercicio_id: 'ht', series: 3, carga_sugerida_kg: 50 }];
const rod = { zona: 'rodilla', nombre: 'Rodilla', valor: 4, semaforo: 'ambar', abierta: true }, hom = { zona: 'hombro', nombre: 'Hombro', valor: 7, semaforo: 'rojo', abierta: true };
const zs = S.zonasDeLaSesion({ pautas, ejercicios: ejs, estado: [rod, { zona: 'codo', valor: 2, semaforo: 'verde', abierta: false }, { zona: 'otra', valor: 5, abierta: true, semaforo: 'ambar' }] });
check(zs.length === 1 && zs[0].zona === 'rodilla' && zs[0].pautas.join() === 'p1' && zs[0].nombres.join() === 'Sentadilla con barra',
  'antes de la sesión (M3): pregunta por la rodilla porque la sentadilla la carga mucho (el hip thrust, solo algo: no cuenta); «otra» y las cerradas, no');
const r = (v, i) => S.reglaDurante({ valor: v, inicio: i, zona: 'rodilla' });
check(r(2, null).nivel === 'sigue' && r(3, 2).nivel === 'sigue' && r(4, 3).nivel === 'igual' && r(5, 5).nivel === 'baja' && r(3, 1).nivel === 'baja' && r(4, 2).nivel === 'baja' && r(null) === null && r(11) === null,
  'durante (M4): hasta 3 sigue; con 4 justo, sin subir; si pasa de 4 o sube 2 o más desde el principio, baja o cambia');
check(/no subas/.test(r(4).texto) && /«Cambiar»/.test(r(6).texto) && /ha subido 2 puntos/.test(r(3, 1).texto), 'con su texto en cada caso');
check(S.peorQueAntes({ antes: 2, manana: 4 }) && !S.peorQueAntes({ antes: 2, manana: 3 }) && !S.peorQueAntes({ antes: null, manana: 6 }), 'peor a la mañana siguiente (M5): 2 puntos o más por encima de antes de entrenar');
const ayer = { id: 's1', fecha: '2027-02-09', pautas };
const regs = [{ zona: 'rodilla', valor: 3, fecha: '2027-02-09', momento: 'antes', sesion_id: 's1' }];
const pm = S.preguntaManana({ sesion: ayer, ejercicios: ejs, estado: [rod], registros: regs, hoy });
check(pm.length === 1 && pm[0].zona === 'rodilla' && pm[0].antes === 3 && pm[0].sesionId === 's1', 'esta mañana: «¿cómo amaneció tu rodilla?», con cómo estaba antes de entrenar');
check(!S.preguntaManana({ sesion: ayer, ejercicios: ejs, estado: [rod], registros: [...regs, { zona: 'rodilla', valor: 3, fecha: hoy, momento: 'manana', sesion_id: 's1' }], hoy }).length
  && !S.preguntaManana({ sesion: { ...ayer, fecha: '2027-02-07' }, ejercicios: ejs, estado: [rod], registros: regs, hoy }).length, 'una vez contestada, no; ni si la sesión no fue ayer');
const manana = { zona: 'rodilla', valor: 6, fecha: hoy, momento: 'manana', sesion_id: 's1' };
const aj = S.ajusteManana({ registros: [...regs, manana], hechas: [ayer], sesion: { id: 's2', pautas }, ejercicios: ejs, hoy });
check(aj.length === 1 && aj[0].pautas.join() === 'p1' && aj[0].series === 1 && aj[0].pct === 10 && aj[0].manana === 6 && aj[0].antes === 3, 'la siguiente sesión que carga la rodilla: una serie menos y un 10 % menos en la sentadilla');
check(!S.ajusteManana({ registros: [...regs, { ...manana, valor: 4 }], hechas: [ayer], sesion: { id: 's2', pautas }, ejercicios: ejs, hoy }).length, 'si solo subió un punto, nada');
check(!S.ajusteManana({ registros: [...regs, manana], hechas: [ayer, { id: 's3', fecha: hoy, pautas }], sesion: { id: 's4', pautas }, ejercicios: ejs, hoy: '2027-02-12' }).length, 'si ya hizo otra sesión que la carga después de esa mañana, el ajuste ya pasó');
check(S.recorteKg(60) === 55 && S.recorteKg(40) === 35 && S.recorteKg(10) === 7.5 && S.recorteKg(null) === null, 'un 10 % menos, al salto más cercano de 2,5 kg (como el motor) y siempre por debajo');
const c = S.conAjuste({ id: 'p1', series: 3, carga_sugerida_kg: 60, series_detalle: null });
check(c.series === 2 && c.carga_sugerida_kg === 55 && S.conAjuste({ series: 1, carga_sugerida_kg: null }).series === 1, 'la pauta ajustada: una serie menos (nunca menos de una) y su carga');
const cd = S.conAjuste({ series: 3, carga_sugerida_kg: null, series_detalle: [{ kg: 80, reps: 5 }, { kg: 70, reps: 8 }, { kg: 70, reps: 8 }] });
check(cd.series_detalle.length === 2 && cd.series_detalle[0].kg === 72.5 && cd.series_detalle[1].kg === 62.5, 'con series detalladas, quita la última y baja cada una');
const ro = S.rojoEnSesion({ pautas, ejercicios: ejs, estado: [hom] });
check(ro.length === 1 && ro[0].pauta_id === 'p2' && ro[0].alternativa?.id === 'fp', 'en rojo (M7): el press banca pasa al floor press, que carga menos el hombro');
check(S.alternativaMenos({ zona: 'rodilla', ejercicio: ejs.sq, ejercicios: ejs })?.ejercicio.id === 'ht' && S.alternativaMenos({ zona: 'rodilla', ejercicio: ejs.pr, ejercicios: ejs }) === null,
  'la alternativa que menos carga esa zona; si ninguna la carga menos (prensa → leg extensions), ninguna');
check(S.alternativaMenos({ zona: 'hombro', ejercicio: ejs.pl, ejercicios: ejs }) === null, 'solo entre ejercicios que se miden igual (la plancha va por tiempo)');

console.log('\nEn la semana (M6 y el ámbar de M7)');
const lect = (zona, valor, fecha) => ({ zona, valor, fecha, momento: 'ahora' });
const fr = S.frenosSemana({ estado: [rod], registros: [lect('rodilla', 4, '2027-02-09')], ejercicios: ejs, ids: ['sq', 'pb', 'ht'], hoy });
check(fr.sq?.motivo === 'ambar' && fr.ht?.zona === 'rodilla' && !fr.pb, 'en ámbar no suben los que cargan la rodilla, mucho o algo (sentadilla y hip thrust); el press banca, sí');
const mej = [lect('rodilla', 5, '2027-01-25'), lect('rodilla', 4, '2027-02-01'), lect('rodilla', 3, '2027-02-09')];
check(!Object.keys(S.frenosSemana({ estado: [{ ...rod, valor: 3 }], registros: mej, ejercicios: ejs, ids: ['sq'], hoy })).length, 'si mejora dos semanas seguidas, vuelve a progresar aunque siga en ámbar (M6)');
const peor = [lect('rodilla', 1, '2027-02-01'), lect('rodilla', 2, '2027-02-09')];
check(S.frenosSemana({ estado: [{ zona: 'rodilla', valor: 2, semaforo: 'verde', abierta: false }], registros: peor, ejercicios: ejs, ids: ['sq'], hoy }).sq?.motivo === 'peor', 'si va a peor de una semana a otra, no progresa aunque esté en verde (M6)');
check(/Como tu rodilla está en ámbar, esta semana no suben/.test(S.notaFrenos(fr, ejs)) && /sentadilla con barra y hip thrust/.test(S.notaFrenos(fr, ejs)), 'la frase de la nota de la semana');
check(/No sube: tu rodilla está en ámbar/.test(S.textoFreno(fr.sq)) && S.textoFreno(null) === null, 'y la del «¿Por qué?» de cada ejercicio');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
if (fallos) process.exit(1);
