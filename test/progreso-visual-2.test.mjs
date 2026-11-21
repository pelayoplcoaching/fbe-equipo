// (v0.204) Progreso y seguimiento, segunda tanda: lo puro (el periodo anterior, comparar ejercicios, tus cifras frente a
// las 4 semanas de antes, los días de la semana, los récords y check-ins del mapa, la escalera de un récord, los músculos
// con récord, la próxima medalla, los trofeos nuevos, el peso y las medidas de una foto, el bloque frente al anterior,
// el esfuerzo de cada serie y la actividad por semanas) y lo que tiene que estar en su sitio (la hoja
// progreso-visual-2.css, ASCII, con tokens y su oscuro; las piezas, enganchadas).
//   node test/progreso-visual-2.test.mjs
import { readFileSync } from 'node:fs';
import * as P from '../web/src/logica/progreso-visual-2.js';
import * as C from '../web/src/logica/calculos.js';
import { informeBloque, cumplimiento } from '../web/src/logica/informe.js';
import { historiaRecords } from '../web/src/logica/diseno.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const src = (r) => readFileSync(new URL(`../web/src/${r}`, import.meta.url), 'utf8');
const HOY = '2026-11-21';  // sábado

console.log('El periodo anterior, detrás de la línea');
{
  const pesos = [];
  for (let i = 0; i < 200; i += 3) pesos.push({ fecha: new Date(Date.parse(`${HOY}T12:00:00Z`) - i * 864e5).toISOString().slice(0, 10), tendencia: 80 - i / 100 });
  pesos.reverse();
  const ant = P.periodoAnterior(pesos, '1m', HOY, { clave: 'fecha' });
  check(ant.length > 5 && ant.every((p) => p.fecha <= HOY && p.fecha >= '2026-10-21'), 'el mes de antes, movido un mes adelante: cae debajo del de ahora');
  const orig = pesos.find((p) => p.tendencia === ant[0].tendencia);
  check(orig && orig.fecha < '2026-10-21', 'y es de verdad el mes anterior (sus valores son los de antes)');
  check(P.periodoAnterior(pesos, 'todo', HOY, { clave: 'fecha' }).length === 0, 'en «Todo» no hay periodo anterior');
  check(P.periodoAnterior(pesos.slice(-5), '3m', HOY, { clave: 'fecha' }).length === 0, 'sin datos de antes, nada');
  const sem = Array.from({ length: 30 }, (_, i) => ({ semana: new Date(Date.parse('2026-11-16T12:00:00Z') - i * 7 * 864e5).toISOString().slice(0, 10), valor: 1000 + i })).reverse();
  const antS = P.periodoAnterior(sem, '3m', HOY, { clave: 'semana', semanal: true });
  check(antS.length >= 12 && antS.every((p) => new Date(`${p.semana}T12:00:00Z`).getUTCDay() === 1), 'por semanas, se mueve en semanas enteras: siguen cayendo en lunes');
}

console.log('Comparar ejercicios');
{
  const ej = [
    { id: 'a', nombre: 'Sentadilla', puntos: [{ semana: '2026-10-05', valor: 100 }, { semana: '2026-10-19', valor: 105 }, { semana: '2026-11-16', valor: 110 }] },
    { id: 'b', nombre: 'Press banca', puntos: [{ semana: '2026-10-05', valor: 80 }, { semana: '2026-11-16', valor: 80 }] },
    { id: 'c', nombre: 'Curl', puntos: [{ semana: '2026-11-16', valor: 20 }] },
  ];
  const s = P.compararEjercicios(ej, ['a', 'b', 'c'], '3m', HOY);
  check(s.length === 2 && s[0].puntos[0].y === 0 && s[0].cambio === 10 && s[1].cambio === 0, 'cada uno en % desde su primera semana (sentadilla +10 %, banca 0 %); el de un solo punto no sale');
  check(s[0].puntos.map((p) => p.x).join() === '2026-10-05,2026-10-19,2026-11-16', 'con sus semanas de verdad');
}

console.log('Tus cifras, frente a las 4 semanas de antes');
{
  const r = (lunes, series, records, dias) => ({ lunes, series, records: Array(records).fill({}), dias: Array(dias).fill('x') });
  const semanas = [r('2026-11-09', 40, 1, 3), r('2026-11-02', 30, 0, 2), r('2026-10-19', 20, 1, 3), r('2026-10-05', 25, 0, 2), r('2026-09-28', 10, 2, 1)];
  const c = P.cifrasFrente(semanas, HOY);
  check(c.ahora.series === 90 && c.ahora.records === 2 && c.ahora.dias === 8 && c.ult.length === 3, 'las 4 últimas semanas acabadas (del 26 oct al 15 nov): 90 series, 2 récords, 8 días');
  check(c.antes && c.antes.series === 35 && c.antes.records === 2 && c.antes.dias === 3, 'y las 4 de antes (del 28 sep al 25 oct)');
  check(P.cifrasFrente(semanas.slice(0, 2), HOY).antes === null, 'si antes no entrenaba, sin flecha');
  const f = P.flechaCifra(90, 35), g = P.flechaCifra(2, 3), h = P.flechaCifra(5, 5);
  check(f.dir === 'sube' && f.texto === '+55' && g.dir === 'baja' && g.texto === '−1' && h.dir === 'igual' && h.texto === '=' && P.flechaCifra(3, null) === null, 'la flecha: +55 sube, −1 baja, = igual; sin lo de antes, nada');
}

console.log('Los días de la semana, en miniatura');
{
  const d = P.diasDeSemana('2026-11-16', ['2026-11-16', '2026-11-18', '2026-11-20']);
  check(d.length === 7 && d.map((x) => x.letra).join('') === 'LMXJVSD' && d.filter((x) => x.si).map((x) => x.letra).join('') === 'LXV', 'de lunes a domingo, con los que entrenó');
  check(P.textoDiasSemana('2026-11-16', ['2026-11-16', '2026-11-18', '2026-11-20']) === 'Entrenaste lunes, miércoles y viernes' && P.textoDiasSemana('2026-11-16', []) === 'Sin días entrenados', 'y en una frase para los lectores de pantalla');
  const series = [{ fecha: '2026-11-16', reps: 5, kg: 50 }, { fecha: '2026-11-16', reps: 5, kg: 50 }, { fecha: '2026-11-19', reps: 0, kg: 50 }];
  const rs = C.resumenSemanal({ series, sesiones: [{ completada: true, fecha_realizada: '2026-11-21', semana_lunes: '2026-11-16' }], pesos: [] }, '2026-11-16');
  check(JSON.stringify(rs.dias) === '["2026-11-16","2026-11-21"]', 'el resumen de la semana trae sus días (con series o con la sesión hecha; una serie sin repeticiones no cuenta)');
}

console.log('El mapa de constancia, con récords y check-ins');
{
  check(P.diasConRecord([{ fecha: '2026-11-02' }, { fecha: '2026-10-20' }, { fecha: '2026-11-02' }]).join() === '2026-10-20,2026-11-02', 'los días con récord, sin repetir y en orden');
  check(P.diasCheckin([{ semana_inicio: '2026-11-09', creado_en: '2026-11-15T19:00:00Z' }, { semana_inicio: '2026-11-02', creado_en: null }]).join() === '2026-11-09,2026-11-15', 'el día del check-in: el que lo envió o, sin él, el lunes siguiente a su semana');
  const ser = [
    { id: 's1', fecha: '2026-11-02', registrada_en: '2026-11-02T10:00:00Z', sesion_id: 'x1', ejercicio_id: 'e', ejercicio: 'Remo', kg: 50, reps: 8, rpe: 8 },
    { id: 's2', fecha: '2026-11-09', registrada_en: '2026-11-09T10:00:00Z', sesion_id: 'x2', ejercicio_id: 'e', ejercicio: 'Remo', kg: 55, reps: 8, rpe: 8 },
  ];
  const er = C.eventosRecord(ser);
  check(er.eventos.length === 1 && er.eventos[0].serie_id === 's2', 'cada récord dice qué serie fue (para pintarla en dorado en el registro del coach)');
  const v1 = C.vitrina(ser, HOY), v2 = C.vitrina(ser, HOY, 30, er);
  check(JSON.stringify(v1) === JSON.stringify(v2), 'la vitrina con los récords ya calculados sale igual');
}

console.log('La escalera de un récord');
{
  const ser = [5, 6, 7].map((kg, i) => ({ id: `r${i}`, fecha: `2026-10-0${i + 1}`, registrada_en: `2026-10-0${i + 1}T10:00:00Z`, sesion_id: `x${i}`, ejercicio_id: 'e', ejercicio: 'Remo', kg: kg * 10, reps: 8, rpe: 8 }));
  const h = historiaRecords(ser, 'e');
  const esc = P.escaleraRecords(h.veces);
  check(h.veces[0].record && esc.length === 2 && esc[0].fecha < esc[1].fecha, 'de la primera vez a la última (la historia trae cada récord con su cifra)');
  check(esc[0].alto === 0.3 && esc[1].alto === 1 && /^60/.test(esc[0].cifra.replace(/\s/g, '')) === false && esc.every((x) => x.cifra), 'los escalones suben (de 0,3 a 1) y cada uno lleva su cifra');
  check(P.escaleraRecords([{ fecha: '2026-10-01', texto: 'x', tipo: 'reps', record: { tipo: 'reps', reps: 12 } }])[0].cifra === '12 rep', 'sin carga, las repeticiones');
}

console.log('Los músculos con récord, la próxima medalla y los trofeos nuevos');
{
  const m = P.musculosRecord([{ ejercicio_id: 'a' }, { ejercicio_id: 'a' }, { ejercicio_id: 'b' }, { ejercicio_id: 'z' }], [{ id: 'a', grupos_musculares: ['pectoral', 'triceps'] }, { id: 'b', grupos_musculares: ['cuadriceps'] }]);
  check(m.pectoral === 2 && m.cuadriceps === 1 && !m.triceps, 'cuenta el músculo principal de cada récord');
  const lista = [
    { id: 'a', siguiente: { falta: 5 }, progreso: 0.5 },
    { id: 'b', siguiente: { falta: 2 }, progreso: 0.8 },
    { id: 'c', siguiente: null, progreso: 1 },
    { id: 'd', siguiente: { falta: 1 }, progreso: 0 },
  ];
  check(P.proximaMedalla(lista) === 'b' && P.proximaMedalla([lista[2]]) === null, 'la más cerca de la siguiente (sin contar las completas ni las que no han empezado)');
  const ej = [{ id: 'a', ultimoRecord: '2026-11-10' }, { id: 'b', ultimoRecord: '2026-11-20' }, { id: 'c', ultimoRecord: null }];
  check(P.trofeosNuevos(ej, null).length === 0, 'la primera vez no destella ninguno');
  check(P.trofeosNuevos(ej, { a: '2026-11-10', b: '2026-11-01' }).join() === 'b', 'después, los que tienen un récord posterior al visto');
  check(JSON.stringify(P.trofeosVistos(ej)) === '{"a":"2026-11-10","b":"2026-11-20"}', 'y se guarda lo visto');
}

console.log('Tus fotos con su peso');
{
  const pesos = [{ fecha: '2026-10-01', kg: 82 }, { fecha: '2026-10-08', kg: 81.6 }, { fecha: '2026-11-01', kg: 80 }, { fecha: '2026-11-15', kg: 79.4 }];
  const t = C.tendenciaPeso(pesos);
  check(P.pesoEnFecha(pesos, '2026-11-16') === t[3].tendencia && P.pesoEnFecha(pesos, '2026-10-30') === null, 'la tendencia de ese día (como mucho de 7 días antes; si no, nada)');
  const medidas = [{ fecha: '2026-10-03', cintura_cm: 90 }, { fecha: '2026-11-14', cintura_cm: 87.5 }];
  const c = P.cambiosEntreFotos({ pesos, medidas }, '2026-10-08', '2026-11-15');
  check(c.length === 2 && c[0].k === 'peso' && c[0].cambio < 0 && c[1].k === 'cintura_cm' && c[1].cambio === -2.5, 'entre dos fotos: el peso y la cintura (la toma más cercana a cada una)');
  check(P.cambiosEntreFotos({ pesos: [], medidas }, '2026-10-08', '2026-10-09').length === 0, 'si las medidas son la misma toma, no hay cambio que enseñar');
}

console.log('Tu bloque frente al anterior y el esfuerzo de cada semana');
{
  const c = cumplimiento({ sesiones: [{ id: 's', completada: true }], pautas: [{ id: 'p', sesion_id: 's', series: 4, rpe_objetivo: 8 }],
    series: [{ sesion_ejercicio_id: 'p', reps: 8, rpe: 9 }, { sesion_ejercicio_id: 'p', reps: 8, rpe: 8 }, { sesion_ejercicio_id: 'p', reps: 8, rpe: 7 }, { sesion_ejercicio_id: 'p', reps: 8, rpe: 6.5 }] }, HOY);
  check(c.esfuerzo.encima === 1 && c.esfuerzo.debajo === 2 && c.esfuerzo.pctEncima === 25 && c.esfuerzo.pctDebajo === 50, 'el esfuerzo cuenta también lo más suave de lo pautado (para la barra de cada semana)');
  const r = P.resumenAnterior({ bloque: { numero: 2, nombre: 'Fuerza' }, sesiones: { hechas: 10 }, cumplimiento: { series: { pct: 88 } }, series: 120, tonelaje: 30500, records: [1, 2], principales: [{ ejercicio_id: 'e', fin: { e1rm: 120 } }] });
  check(r.numero === 2 && r.sesiones === 10 && r.pctSeries === 88 && r.tonelaje === 30500 && r.records === 2 && r.e1rm.e === 120, 'lo que se compara del bloque anterior');
  check(P.resumenAnterior({ vacio: true }) === null && P.resumenAnterior(null) === null, 'sin bloque de antes (o vacío), nada');
  check(/anterior: resumenAnterior\(/.test(src('datos/api.js')), 'los informes traen el suyo (api.informes)');
}

console.log('El registro del coach: el esfuerzo de cada serie');
{
  const p = { rpe_objetivo: 8, reps_min: 6 };
  check(P.esfuerzoSerie(p, { reps: 8, rpe: 8 }) === 'justo' && P.esfuerzoSerie(p, { reps: 8, rpe: 9 }) === 'pasado' && P.esfuerzoSerie(p, { reps: 8, rpe: 7 }) === 'suave'
    && P.esfuerzoSerie(p, { reps: 4, rpe: 8 }) === 'corto' && P.esfuerzoSerie(p, { reps: 8 }) === 'sin' && P.esfuerzoSerie({}, { reps: 8, rpe: 8 }) === 'sin', 'justo, pasado, suave, corto o sin RPE');
  check(P.esfuerzoSerie({ rir_objetivo: 2 }, { reps: 8, rir: 2 }) === 'justo' && P.esfuerzoSerie(p, { reps: 8, rpe: 8.5 }) === 'justo', 'con RIR también, y medio punto de margen');
  check(P.tonoEsfuerzo(null) === 'sin' && P.tonoEsfuerzo(6) === 'suave' && P.tonoEsfuerzo(7.5) === 'medio' && P.tonoEsfuerzo(9) === 'duro', 'el tono de la sesión por su RPE');
}

console.log('La actividad del coach, por semanas');
{
  const ev = [
    { tipo: 'sesion', fecha: '2026-11-20' }, { tipo: 'record', fecha: '2026-11-20', titulo: 'Récord en Remo' }, { tipo: 'record', fecha: '2026-11-20', titulo: 'Récord en Press' },
    { tipo: 'peso', fecha: '2026-11-18', kg: 80.2 }, { tipo: 'peso', fecha: '2026-11-19', kg: 80 }, { tipo: 'checkin', fecha: '2026-11-16' }, { tipo: 'sesion', fecha: '2026-11-12' },
  ];
  const w = P.semanasActividad(ev);
  check(w['2026-11-16'].sesiones === 1 && w['2026-11-16'].records === 2 && w['2026-11-16'].checkin && w['2026-11-16'].kg === 80 && w['2026-11-09'].sesiones === 1, 'cada semana con sus sesiones, récords, check-in y la última pesada');
  check(P.textoSemanaActividad(w['2026-11-16']) === '1 sesión, 2 récords, check-in enviado, 80 kg' && P.textoSemanaActividad(w['2026-11-09']) === '1 sesión, sin check-in', 'y en una línea');
  const g = P.agruparRecords(ev.slice(0, 3));
  check(g.length === 2 && g[1].tipo === 'records' && g[1].records.length === 2 && g[1].titulo === '2 récords', 'los récords de un mismo día, en una tarjeta');
  check(P.agruparRecords(ev.slice(0, 2)).length === 2 && P.agruparRecords(ev.slice(0, 2))[1].tipo === 'record', 'con uno solo, su fila de siempre');
  check(/kg: Number\(u\.kg\)/.test(src('datos/api.js')), 'la actividad trae los kilos de cada pesada');
}

console.log('Lo que tiene que estar en su sitio');
{
  const css = src('progreso-visual-2.css');
  check(/^[\x00-\x7F]*$/.test(css), 'progreso-visual-2.css, solo ASCII');
  check(/@media \(prefers-color-scheme: dark\) \{ :root:not\(\[data-theme="light"\]\) \{ --pv2-previa/.test(css) && /:root\[data-theme="dark"\] \{ --pv2-previa/.test(css), 'sus colores, con versión oscura');
  check(!/opacity/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'ningún texto entra con opacidad');
  check(/prefers-reduced-motion: reduce\) \{ \.trofeo-tarjeta\.destella::after \{ animation: none/.test(css), 'el destello del trofeo respeta «reducir movimiento»');
  check(src('main.jsx').indexOf("'./progreso-visual-2.css'") > src('main.jsx').indexOf("'./progreso-visual.css'"), 'se carga después de la primera tanda');
  const pr = src('ui/atleta/Progreso.jsx');
  check(/<Ampliable titulo="Peso corporal">/.test(pr) && /<Ampliable titulo="Tonelaje por semana">/.test(pr) && /GraficaComparar/.test(pr) && /previo=\{previoPeso\}/.test(pr) && /previo=\{previoTon\}/.test(pr), 'Progreso: pantalla completa, comparar y el periodo anterior');
  check(/<FlechaCifra/.test(pr) && /<DiasSemanaMini/.test(pr) && /records=\{datos\.diasRecord\}/.test(pr) && /<EscaleraRecords/.test(pr) && /tono="oro"/.test(pr) && /useTrofeosNuevos/.test(pr) && /cuerpo=\{salud && progreso\.datos/.test(pr), 'y las cifras, las semanas, el mapa, la escalera, los músculos, el destello y las fotos');
  check(/class="tira-bascula"/.test(src('ui/comunes.jsx')) && /linea-previa/.test(src('ui/comunes.jsx')), 'las gráficas: la tira de la báscula y la línea del periodo anterior');
  check(/proximaMedalla\(lista\)/.test(src('ui/Logros.jsx')) && /GraficaProteina/.test(src('ui/atleta/Nutricion.jsx')) && /<EsfuerzoSemanas/.test(src('ui/InformeBloque.jsx')) && /<FrenteAnterior/.test(src('ui/InformeBloque.jsx')), 'medallas, proteína, bloque frente al anterior y esfuerzo por semana');
  const fi = src('ui/coach/Ficha.jsx');
  check(/<MedidorSesion/.test(fi) && /serie-ficha esf-/.test(fi) && /<ModoLlamada/.test(fi) && /agruparRecords/.test(src('ui/coach/Actividad.jsx')) && /actividad-semana/.test(src('ui/coach/Actividad.jsx')), 'la ficha del coach: fichas, medidor, modo llamada y la actividad');
  check(!/[^\x00-\x7F]/.test((src('ui/coach/Actividad.jsx').match(/\/\^[^/]*\//g) || []).join('')), 'sin letras con tilde dentro de una expresión regular (rompen la compilación)');
}

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
