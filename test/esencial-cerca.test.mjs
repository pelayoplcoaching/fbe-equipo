// FBE Esencial (acompañamiento, tanda 5, v0.246): «que no entrenen solos». El saludo de cada día, las agujetas del día
// después, la vuelta tras unos días sin entrenar, si baja el ritmo, los hitos, «Tu trimestre», el reto de la semana, «¿Te
// vas?», «¿Cómo vamos?», el diario de lo que la app ha hecho y, para el coach, a quién escribir. Y que lo que va con la voz
// de Pelayo esté apagado.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { saludoDe, AGUJETAS, agujetasDe, vueltaDe, ritmoDe, HITOS, hitoDe, trimestreDe, TRIMESTRE_SIGUE, retoSemana, pascua, seVa, comoVamosToca, comoVamosResumen, diarioDe,
  NOTAS_LUNES, VOZ_PELAYO, notaDelLunes, DIA_A_DIA, diaDelPlan, aQuienEscribir } from '../web/src/logica/esencial-cerca.js';
import { APAGADO, encendido, AVISO_ABRE } from '../web/src/logica/esencial-respuestas.js';
import { APARTADOS_SUYO } from '../web/src/logica/esencial-checkin.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const lee = (r) => readFileSync(join(raiz, r), 'utf8');
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

// Una semana de ejemplo: del lunes 1/3/2027, dos sesiones (martes y jueves)
const W = { id: 'w2', bloque_id: 'b', numero: 2, fecha_inicio: '2027-03-01', programacion: 'programada', nota_coach: 'Esta semana subes kilos en prensa.' };
const W1 = { id: 'w1', bloque_id: 'b', numero: 1, fecha_inicio: '2027-02-22', programacion: 'programada' };
const s = (id, dia, hecha = null, mas = {}) => ({ id, nombre: id === 'a' || id === 'c' ? 'Día 1' : 'Día 2', orden: id === 'a' || id === 'c' ? 1 : 2, dia_previsto: dia, completada: !!hecha, fecha_realizada: hecha, ...mas });
const base = (ss, previas = [s('c', '2027-02-23', '2027-02-23'), s('d', '2027-02-25', '2027-02-25')]) => ({ actual: W, semanas: [W1, W], sesiones: { w1: previas, w2: ss } });

console.log('El saludo de cada día');
const plan = [s('a', '2027-03-02'), s('b', '2027-03-04')];
check(saludoDe({ hoy: '2027-03-02', ...base(plan) }).tipo === 'toca' && /Hoy toca «Día 1»/.test(saludoDe({ hoy: '2027-03-02', ...base(plan) }).texto), 'el día que toca: «Hoy toca «Día 1»…»');
check(saludoDe({ hoy: '2027-03-01', ...base(plan) }).tipo === 'vispera' && /Mañana toca «Día 1»/.test(saludoDe({ hoy: '2027-03-01', ...base(plan) }).texto), 'la víspera: «Mañana toca…»');
const unaHecha = [s('a', '2027-03-02', '2027-03-02'), s('b', '2027-03-04')];
check(saludoDe({ hoy: '2027-03-02', ...base(unaHecha) }).tipo === 'hecha' && saludoDe({ hoy: '2027-03-03', ...base(unaHecha) }).tipo === 'despues' && /Ayer entrenaste/.test(saludoDe({ hoy: '2027-03-03', ...base(unaHecha) }).texto),
  'con la de hoy hecha, a recuperar; y el día después, descanso y agujetas');
check(saludoDe({ hoy: '2027-03-06', ...base(unaHecha) }).tipo === 'descanso' && saludoDe({ hoy: '2027-03-06', ...base([s('a', '2027-03-02', '2027-03-02'), s('b', '2027-03-04', '2027-03-04')]) }).tipo === 'completa', 'un día sin nada: descanso; con la semana hecha, «Semana hecha»');
check(saludoDe({ hoy: '2027-03-03', ...base([s('a', null), s('b', null)]) }).tipo === 'libre' && /quedan 2 sesiones/.test(saludoDe({ hoy: '2027-03-03', ...base([s('a', null), s('b', null)]) }).texto), 'sin días puestos: cuántas le quedan');
check(/semana de descarga/.test(saludoDe({ hoy: '2027-03-02', ...base(plan), actual: { ...W, nota_coach: 'Semana de descarga: menos carga y menos series para recuperar.' } }).texto)
  && /Qué bien verte de vuelta/.test(saludoDe({ hoy: '2027-03-02', ...base(plan), actual: { ...W, nota_coach: 'Vuelves después de unos días sin entrenar: esta semana bajamos cargas.' } }).texto), 'en una descarga o a la vuelta de un parón, lo dice');
// la semana pasada, sin castigo (de lunes a miércoles)
const aMedias = [s('c', '2027-02-23', '2027-02-23'), s('d', '2027-02-25')];
check(/quedó a medias\. No pasa nada/.test(saludoDe({ hoy: '2027-03-01', ...base(plan, aMedias) }).extra) && saludoDe({ hoy: '2027-03-05', ...base(plan, aMedias) }).extra === null && saludoDe({ hoy: '2027-03-01', ...base(plan) }).extra === null,
  'si la semana pasada quedó a medias: «No pasa nada…» (de lunes a miércoles; con la semana pasada hecha, nada)');
check(/no pudo ser/.test(saludoDe({ hoy: '2027-03-01', ...base(plan, [s('c', '2027-02-23'), s('d', '2027-02-25')]) }).extra)
  && /semana en pausa/.test(saludoDe({ hoy: '2027-03-01', actual: W, semanas: [{ ...W1, esencial_cierre: 'pausa' }, W], sesiones: { w1: aMedias, w2: plan } }).extra)
  && /Descarga hecha/.test(saludoDe({ hoy: '2027-03-01', actual: W, semanas: [{ ...W1, nota_coach: 'Semana de descarga: menos carga.' }, W], sesiones: { w1: aMedias, w2: plan } }).extra), 'y si no hizo ninguna, vuelve de una pausa o acaba una descarga, también');
check(saludoDe({ hoy: '2027-02-27', ...base(plan) }) === null && saludoDe({ hoy: '2027-03-02', actual: null }) === null, 'antes de que empiece su semana, o sin semana, nada');
check(![saludoDe({ hoy: '2027-03-02', ...base(plan) }), saludoDe({ hoy: '2027-03-03', ...base(unaHecha) }), saludoDe({ hoy: '2027-03-01', ...base(plan, aMedias) })].some((x) => /coach|deberías|tienes que/i.test(`${x.texto} ${x.extra || ''}`)), 'sin «tu coach» ni reproches');

console.log('\nLas agujetas, la vuelta y el ritmo');
const h = (id, fecha, rpe = 7) => ({ id, fecha, rpe });
check(agujetasDe({ hoy: '2027-03-03', hechas: [h('a', '2027-03-02')] })?.motivo === 'primera' && agujetasDe({ hoy: '2027-03-03', hechas: [h('x', '2027-02-20'), h('a', '2027-03-02', 9)] })?.motivo === 'dura'
  && agujetasDe({ hoy: '2027-03-03', hechas: [h('x', '2027-02-20'), h('a', '2027-03-02', 7)] }) === null && agujetasDe({ hoy: '2027-03-04', hechas: [h('a', '2027-03-02')] }) === null
  && agujetasDe({ hoy: '2027-03-03', hechas: [h('a', '2027-03-02'), h('b', '2027-03-03')] }) === null, 'las agujetas: el día después de su primera sesión o de una dura (RPE 9 o más), y nunca si hoy ya ha entrenado');
check(AGUJETAS.length === 3 && /no dicen si entrenaste bien o mal/.test(AGUJETAS[0][2]) && /eso no son agujetas/.test(AGUJETAS[2][2]) && AGUJETAS.every((x) => x[2].length <= 260), 'tres respuestas, con las frases de la guía (y la señal de que «eso no son agujetas»)');
let v = vueltaDe({ hoy: '2027-03-12', actual: W, ss: plan, hechas: [h('x', '2027-03-02')], inicio: '2027-02-01' });
check(v?.dias === 10 && v.sesion.id === 'a' && !v.nunca && vueltaDe({ hoy: '2027-03-05', actual: W, ss: plan, hechas: [h('x', '2027-03-02')] }) === null, 'la vuelta: a los siete días sin entrenar, con su siguiente sesión');
check(vueltaDe({ hoy: '2027-03-12', actual: W, ss: plan, hechas: [], inicio: '2027-03-01' })?.nunca === true && vueltaDe({ hoy: '2027-03-12', actual: { ...W, esencial_cierre: 'pausa' }, ss: plan, hechas: [], inicio: '2027-03-01' }) === null
  && vueltaDe({ hoy: '2027-03-12', actual: W, ss: [s('a', null, '2027-03-01')], hechas: [h('x', '2027-03-01')] }) === null, 'también si aún no ha hecho ninguna; en pausa, o sin nada por hacer, no');
const sem = (id, lunes, mas = {}) => ({ id, bloque_id: 'b', fecha_inicio: lunes, programacion: 'programada', ...mas });
const R = { actual: sem('w3', '2027-03-08'), semanas: [sem('w1', '2027-02-22'), sem('w2', '2027-03-01'), sem('w3', '2027-03-08')] };
check(ritmoDe({ ...R, sesiones: { w1: [s('a', null), s('b', null), s('c', null, '2027-02-23')], w2: [s('a', null), s('b', null)], w3: plan } })?.hechas === 1
  && ritmoDe({ ...R, sesiones: { w1: [s('a', null, '2027-02-23'), s('b', null)], w2: [s('a', null), s('b', null)], w3: plan } }) === null
  && ritmoDe({ ...R, semanas: [sem('w1', '2027-02-22', { esencial_cierre: 'pausa' }), sem('w2', '2027-03-01'), sem('w3', '2027-03-08')], sesiones: { w1: [s('a', null), s('b', null)], w2: [s('a', null), s('b', null)], w3: plan } }) === null,
  'el ritmo: dos semanas seguidas con menos de la mitad de sus sesiones (una en pausa no cuenta)');

console.log('\nLos hitos, su trimestre y el reto de la semana');
check(Object.keys(HITOS).join() === '10,25,50,100' && hitoDe(10) && hitoDe(11) === null && hitoDe(1) === null && hitoDe(null) === null && Object.values(HITOS).every((t) => t.length <= 90), 'sus hitos: la sesión 10, la 25, la 50 y la 100 (la primera ya tiene su celebración)');
const t = trimestreDe({ semanas: 12, sesiones: 23, filas: [{ nombre: 'Prensa', antes: { kg: 85, max: 12 }, ahora: { kg: 100, max: 10 } }, { nombre: 'Curl', antes: { kg: 8, max: 12 }, ahora: { kg: 8, max: 12 } },
  { nombre: 'Plancha', por_tiempo: true, antes: { kg: null, max: 30 }, ahora: { kg: null, max: 45 } }, { nombre: 'Nuevo', antes: null, ahora: { kg: 20, max: 12 } }] });
check(t.titulo === '12 semanas: tu trimestre' && t.lineas.length === 3 && t.lineas[0].texto === 'de 85 a 100 kg (+15)' && t.lineas[1].texto === '8 kg, como al empezar' && t.lineas[2].texto === 'de 30 a 45 segundos (+15)' && t.suben === 2
  && t.resumen === '23 sesiones hechas y más carga en 2 de 3 ejercicios.', `su trimestre: cada ejercicio, de cómo empezó a cómo va («${t.lineas[0].texto}»; la plancha, en segundos)`);
check(TRIMESTRE_SIGUE.length === 3 && /Sin prisa/.test(TRIMESTRE_SIGUE[2][2]), 'y qué toca: seguir, cambiar de rutina o un programa con seguimiento, sin presión');
let r = retoSemana({ ss: unaHecha, equipo: { con: 12, completas: 3, entrenando: 7 } });
check(r.texto === 'Reto de la semana: tus 2 sesiones. Llevas 1.' && r.gente === 'Ya lo han conseguido 3 personas de FBE Esencial, y 4 más van en ello.' && !r.hecho, `el reto de la semana, con cuántos lo llevan («${r.gente}»)`);
check(retoSemana({ ss: unaHecha, equipo: null }).gente === null && retoSemana({ ss: unaHecha, equipo: { con: 3, completas: 1, entrenando: 2 } }).gente === null && retoSemana({ ss: [] }) === null
  && retoSemana({ ss: [s('a', null, '2027-03-02')], equipo: { con: 6, completas: 1, entrenando: 1 } }).hecho === true, 'sin cifras (o con menos de cinco personas), solo el suyo');

console.log('\n¿Te vas? y ¿Cómo vamos?');
check(pascua(2027) === '2027-03-28' && pascua(2026) === '2026-04-05' && pascua(2028) === '2028-04-16', 'el domingo de Pascua de cada año');
check(seVa('2026-12-15')?.cuando === 'estas navidades' && seVa('2027-03-10')?.cuando === 'en Semana Santa' && seVa('2027-07-20')?.cuando === 'en agosto' && seVa('2027-03-22') === null && seVa('2027-05-05') === null && seVa('2026-12-24') === null,
  'las dos semanas de antes de Navidad, de Semana Santa y de agosto');
check(comoVamosToca({ n: 4, notas: [] }) === 'mes' && comoVamosToca({ n: 12, notas: [{ datos: { momento: 'mes' } }] }) === 'trimestre' && comoVamosToca({ n: 5, notas: [{ datos: { momento: 'mes' } }] }) === null && comoVamosToca({ n: 8, notas: [] }) === null,
  '«¿Cómo vamos?»: al mes y a los tres meses, una vez cada uno');
const cv = comoVamosResumen([{ datos: { nota: 9 }, texto: 'Me falta ver mis vídeos', nombre: 'Tomás' }, { datos: { nota: 8 } }, { datos: {} }]);
check(cv.n === 2 && cv.media === 8.5 && cv.textos.length === 1 && comoVamosResumen([]) === null, 'para el coach: la media y lo que echan de menos');

console.log('\nLo que la app ha hecho por ti');
const d = diarioDe({ hoy: '2027-03-10', bloques: [{ id: 'b', nombre: 'Novato 2 días · FBE Esencial', fecha_inicio: '2027-02-22', estado: 'activo' }],
  semanas: [sem('w1', '2027-02-22', { numero: 1 }), sem('w2', '2027-03-01', { numero: 2, nota_coach: 'Esta semana subes kilos en prensa.', esencial_cierre: 'auto', esencial_cierre_lunes: '2027-03-01' }), sem('w3', '2027-03-08', { numero: 3, nota_coach: 'Repites.' }),
    sem('w9', '2027-04-19', { numero: 9, nota_coach: 'Del futuro' })], sesiones: { w2: [{ id: 'x', nombre: 'Día 2', cerrada_sola_en: '2027-03-05T21:00:00Z' }] } });
check(d.length === 5 && d[0].titulo === 'Te preparó la semana 3 de «Novato 2 días · FBE Esencial»' && d.some((x) => x.titulo === 'Pasó sola a la semana siguiente' && x.fecha === '2027-03-07') && d.some((x) => /Cerró «Día 2» por ti/.test(x.titulo))
  && d[d.length - 1].titulo.startsWith('Te preparó tu plan') && !d.some((x) => /futuro/.test(x.texto)), 'cada decisión con su porqué, lo último primero (su plan, cada semana, el cierre del domingo, una sesión que cerró por él)');

console.log('\nApagado hasta que Pelayo lo vea');
check(APAGADO.has('notas_lunes') && APAGADO.has('dia_a_dia') && !encendido('notas_lunes') && encendido('notas_lunes', true), 'su nota de los lunes y el día a día de las dos primeras semanas: apagados (se ven con la vista previa)');
check(Object.keys(NOTAS_LUNES).length >= 8 && notaDelLunes(1) && notaDelLunes(7) === null && Object.values(NOTAS_LUNES).every((x) => x.length <= 160) && Object.values(VOZ_PELAYO).every((x) => x === null), 'sus notas, en borrador; su voz, sin grabar');
check(diaDelPlan({ hoy: '2027-03-01', inicio: '2027-03-01' }) === 1 && diaDelPlan({ hoy: '2027-03-14', inicio: '2027-03-01' }) === 14 && diaDelPlan({ hoy: '2027-03-15', inicio: '2027-03-01' }) === null && DIA_A_DIA[1] && DIA_A_DIA[14], 'el día a día: del 1 al 14 de su plan');
check(!/la mitad de la gente|poca gente/i.test(JSON.stringify([HITOS, DIA_A_DIA, NOTAS_LUNES])), 'sin cifras inventadas');

console.log('\nEl coach: a quién escribir');
const lista = aQuienEscribir([
  { atleta_id: '1', nombre: 'Tomás Rey', email: 't@x.es', estado: 'activo', dias: 12 }, { atleta_id: '2', nombre: 'Inés Gil', email: 'i@x.es', estado: 'activo', dias: 2, grave: true },
  { atleta_id: '3', nombre: 'Clara Prieto', email: 'c@x.es', estado: 'activo', dias: 3, semanasFalladas: 2 }, { atleta_id: '4', nombre: 'Marina Ortega', email: 'm@x.es', estado: 'activo', dias: null, sinEmpezar: true },
  { atleta_id: '5', nombre: 'De baja', email: 'b@x.es', estado: 'baja', dias: 40 }, { atleta_id: '6', nombre: 'Va bien', email: 'v@x.es', estado: 'activo', dias: 1 }, { atleta_id: '7', nombre: 'Sin correo', estado: 'activo', dias: 30 }]);
check(lista.map((x) => x.atleta_id).join() === '2,1,3,4' && /molestia grave/.test(lista[0].motivo) && /12 días sin entrenar/.test(lista[1].motivo) && lista.every((x) => x.cuerpo.startsWith(`Hola, ${x.nombre.split(' ')[0]}:`) && x.cuerpo.endsWith('Pelayo') && x.asunto),
  'la molestia grave, primero; luego quien lleva diez días, dos semanas flojas o no ha empezado. Cada uno con su mensaje preparado; ni los de baja ni quien va bien');
check(/valore un médico o un fisioterapeuta/.test(lista[0].cuerpo) && !/diagn/i.test(lista[0].cuerpo), 'el de la molestia: que se la valoren (sin diagnosticar nada)');

console.log('\nLas pantallas y el check-in');
check(APARTADOS_SUYO.join() === 'peso,descanso,molestias,alimentacion' && /suyo \? APARTADOS_SUYO : null/.test(lee('web/src/ui/atleta/Checkin.jsx')), 'el check-in de quien va por su cuenta, más corto: sin las medidas ni los datos del reloj');
check(AVISO_ABRE.agujetas === 'agujetas' && AVISO_ABRE.retomar === 'vuelta' && /data-cerca="agujetas"/.test(lee('web/src/ui/atleta/EsencialCerca.jsx')) && /data-cerca="vuelta"/.test(lee('web/src/ui/atleta/EsencialCerca.jsx')), 'los avisos de las agujetas y de los días sin entrenar llevan a su tarjeta');
const cerca = lee('web/src/ui/atleta/EsencialCerca.jsx');
const css = lee('web/src/cerca.css').replace(/\/\*[\s\S]*?\*\//g, '');
const enCss = [...new Set([...css.matchAll(/\.(cer-[a-z0-9-]+)/g)].map((m) => m[1]))];
check(enCss.length >= 30 && enCss.every((k) => new RegExp(`['" ]${k}['" ]`).test(cerca)) && !/[^\x00-\x7F]/.test(lee('web/src/cerca.css')), 'cada clase de cerca.css está escrita tal cual en su pantalla; y el archivo, solo ASCII');
check(!/\.cer-[a-z-]+\[/.test(css) && !/\.cer-[a-z-]+ [.a-z]/.test(css.replace(/\{[^}]*\}/g, '{}')) && !/margin|font-size|font-weight/.test(css), 'reglas de una sola clase, sin atributos, márgenes ni tamaños de letra (así no hacen volver al común reglas de otros trozos)');
const esencial = lee('web/src/ui/atleta/Esencial.jsx');
check(/const CercaArriba = perezoso\(\(\) => import\('\.\/EsencialCerca\.jsx'\), 'CercaArriba'/.test(esencial) && /<CercaArriba /.test(esencial) && /<CercaAbajo /.test(esencial) && !/EsencialCerca/.test(lee('web/src/ui/atleta/Hoy.jsx')), 'arriba y abajo en Hoy, dentro de la pieza de FBE Esencial (Hoy.jsx no cambia)');
check(/const AQuienEscribir = perezoso/.test(lee('web/src/ui/coach/EsencialPanel.jsx')) && /La app no envía nada/.test(lee('web/src/ui/coach/EsencialPreguntas.jsx')) && !/body=/.test(lee('web/src/ui/coach/EsencialPreguntas.jsx')), 'en el panel del coach, «A quién escribir»: el mensaje se copia (no va en el enlace) y lo manda él');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
