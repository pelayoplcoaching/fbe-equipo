// (v0.275) Vista (251-300), segunda vuelta: datos que se entienden solos (260-268). El mapa de músculos y sus barras se
// tocan (260 y 268), la línea gris del periodo anterior en la fuerza (261), los récords dorados con su serie (262), la
// huella de cada sesión (263), tu línea en la tarjeta del ejercicio (264), superar a la última (265), tu peso que cae en
// su línea (266) y dos semanas lado a lado (267). Las cuentas, y que cada pieza está en su sitio.
//   node test/vista-2.test.mjs
import { readFileSync } from 'node:fs';
import { ejerciciosDeGrupo, tonoEsfuerzo, leerHuella, huellaDeResumen, textoHuella, lineaUltimas, tendenciaLinea, superaUltima, compararSemanas, elegirSemana, MAX_PUNTOS_HUELLA } from '../web/src/logica/datos-vista.js';
import { e1rmPorSemana } from '../web/src/logica/calculos.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const src = (r) => readFileSync(new URL(`../web/src/${r}`, import.meta.url), 'utf8');

console.log('Lo que sumó un músculo esa semana (260 y 268)');
const hist = [
  { fecha: '2026-11-23', reps: 10, ejercicio_id: 'pb', ejercicio: 'Press banca', grupos: ['pectoral', 'triceps', 'deltoides'] },
  { fecha: '2026-11-23', reps: 10, ejercicio_id: 'pb', ejercicio: 'Press banca', grupos: ['pectoral', 'triceps', 'deltoides'] },
  { fecha: '2026-11-25', reps: 12, ejercicio_id: 'el', ejercicio: 'Elevaciones laterales', grupos: ['deltoides'] },
  { fecha: '2026-11-25', reps: 0, ejercicio_id: 'el', ejercicio: 'Elevaciones laterales', grupos: ['deltoides'] },
  { fecha: '2026-11-16', reps: 12, ejercicio_id: 'el', ejercicio: 'Elevaciones laterales', grupos: ['deltoides'] },
];
const del = ejerciciosDeGrupo(hist, '2026-11-23', 'deltoides');
check(del.length === 2 && del[0].nombre === 'Press banca' && del[0].cuenta === 1 && del[0].series === 2 && !del[0].principal && del[1].cuenta === 1 && del[1].principal,
  'los de esa semana: el principal cuenta 1 por serie; los secundarios, media (dos de press banca = 1); las de 0 repeticiones y las de otra semana, no');
check(ejerciciosDeGrupo(hist, '2026-11-23', 'gemelo').length === 0 && ejerciciosDeGrupo(hist, null, 'pectoral').length === 0, 'un músculo sin series, nada');

console.log('\nLa huella de una sesión (263)');
check(tonoEsfuerzo(null) === 'sin' && tonoEsfuerzo('') === 'sin' && tonoEsfuerzo(6) === 'suave' && tonoEsfuerzo(7) === 'medio' && tonoEsfuerzo(8.5) === 'medio' && tonoEsfuerzo(9) === 'fuerte' && tonoEsfuerzo(10) === 'fuerte',
  'el color de cada serie, por su esfuerzo: suave hasta 6, medio de 7 a 8,5, fuerte desde 9; sin apuntar, gris');
const h = leerHuella([[8, 9, 109], [0, 7], [], [8, 8, 8, 8, 8, 8, 8, 8, 8, 8]]);
check(h.length === 3 && h[0].puntos[2].rec && h[0].puntos[2].t === 'fuerte' && h[1].puntos[0].t === 'sin' && h[2].puntos.length === MAX_PUNTOS_HUELLA && h[2].mas === 2,
  'la de «Tus entrenamientos» (una cifra por serie: su esfuerzo y 100 más si fue récord); sin series, sin fila; con más de 8, «+2»');
const hr = huellaDeResumen([{ nombre: 'Press', series: [{ rpe: 8 }, { rpe: 9, record: true }] }, { nombre: 'Curl', series: [] }]);
check(hr.length === 1 && hr[0].nombre === 'Press' && hr[0].puntos[1].rec && textoHuella(hr) === '1 ejercicio, 2 series, 1 muy exigente, 1 récord', `la del resumen, con su nombre y lo que dice al lector de pantalla («${textoHuella(hr)}»)`);
check(leerHuella(null).length === 0 && leerHuella('x').length === 0, 'sin huella (una lista vieja guardada en el móvil), nada');

console.log('\nTu línea, en la tarjeta del ejercicio (264)');
const ss = [['2026-10-30', 60, 8], ['2026-11-06', 62.5, 8], ['2026-11-13', 62.5, 9], ['2026-11-13', 50, 12], ['2026-11-20', 65, 8], ['2026-11-27', 70, 8]].map(([fecha, kg, reps]) => ({ fecha, kg, reps, rpe: 9 }));
const l = lineaUltimas(ss, { antesDe: '2026-11-27' });
check(l.length === 4 && l[0].fecha === '2026-10-30' && l[3].fecha === '2026-11-20' && l[2].valor > l[1].valor, 'por día, su mejor 1RM estimado; lo de hoy no cuenta');
check(lineaUltimas(ss.slice(0, 2)).length === 0 && lineaUltimas([{ fecha: '2026-11-01', kg: 0, reps: 10 }, { fecha: '2026-11-02', kg: 0, reps: 10 }, { fecha: '2026-11-03', kg: 0, reps: 10 }]).length === 0, 'con menos de tres días, o sin kilos, nada');
const muchas = Array.from({ length: 9 }, (_, i) => ({ fecha: `2026-10-${String(10 + i).padStart(2, '0')}`, kg: 60 + i, reps: 5, rpe: 9 }));
check(lineaUltimas(muchas).length === 6 && lineaUltimas(muchas)[0].fecha === '2026-10-13', 'como mucho, las seis últimas');
check(tendenciaLinea(l).sentido === 'sube' && tendenciaLinea([{ valor: 80 }, { valor: 80.4 }]).sentido === 'igual' && tendenciaLinea([{ valor: 80 }, { valor: 70 }]).sentido === 'baja', 'cómo va: sube, igual (menos de un 1 %) o baja');

console.log('\nSuperar a la última (265)');
const antes = [{ ejercicio: 'a', kg: 60, reps: 8 }, { ejercicio: 'a', kg: 60, reps: 8 }, { ejercicio: 'b', kg: 20, reps: 10 }];
check(!superaUltima([{ ejercicio: 'a', kg: 60, reps: 8 }, { ejercicio: 'a', kg: 60, reps: 8 }], antes).supera && superaUltima([{ ejercicio: 'a', kg: 60, reps: 8 }, { ejercicio: 'a', kg: 62.5, reps: 8 }, { ejercicio: 'b', kg: 20, reps: 10 }], antes).supera,
  'con kilos, por toneladas: igualar no es superar; pasarse, sí');
check(!superaUltima([{ ejercicio: 'c', kg: 200, reps: 10 }], antes).supera, 'lo de un ejercicio que la última vez no estaba no cuenta');
const sinKg = superaUltima([{ ejercicio: 'd', kg: 0, reps: 13 }], [{ ejercicio: 'd', kg: 0, reps: 12 }]);
check(sinKg.por === 'reps' && sinKg.supera && superaUltima([], []).por === null, 'sin kilos (peso corporal), por repeticiones; sin última vez, nada');

console.log('\nDos semanas, lado a lado (267)');
const w1 = { lunes: '2026-11-09', sesiones: { hechas: 3 }, series: 51, tonelaje: 9800, records: [1, 2] };
const w2 = { lunes: '2026-11-16', sesiones: { hechas: 2 }, series: 53, tonelaje: 10420, records: [1] };
const c = compararSemanas(w2, w1);
check(c.antes === w1 && c.despues === w2 && c.filas.map((f) => `${f.id}:${f.a}>${f.b}=${f.dif}`).join(' ') === 'sesiones:3>2=-1 series:51>53=2 toneladas:9.8>10.4=0.6 records:2>1=-1',
  'de la más antigua a la más reciente: sesiones, series, toneladas (con un decimal) y récords, con lo que cambia');
check(elegirSemana([], 'a').join() === 'a' && elegirSemana(['a'], 'b').join() === 'a,b' && elegirSemana(['a', 'b'], 'c').join() === 'b,c' && elegirSemana(['a', 'b'], 'a').join() === 'b', 'elegir: tocar añade, tocar otra vez quita y con dos la tercera sustituye a la primera');

console.log('\nLos récords, con su serie (262)');
const ps = e1rmPorSemana([{ fecha: '2026-11-02', kg: 60, reps: 8, rpe: 9 }, { fecha: '2026-11-03', kg: 65, reps: 6, rpe: 9 }]);
check(ps.length === 1 && ps[0].kg === 65 && ps[0].reps === 6, 'el mejor de cada semana guarda la serie que lo dio (65 kg × 6)');
check(/prs\.includes\(i\) \? `, récord\$\{puntos\[i\]\.texto \? ` \(\$\{puntos\[i\]\.texto\}\)` : ''\}`/.test(src('ui/comunes.jsx')), 'al tocar un récord en la gráfica, su marca (la serie) y su fecha');
check(/\.grafica \.punto\.record \{ fill: var\(--oro-300\); stroke: var\(--oro\)/.test(src('estilos.css')), 'los récords, dorados (como los rombos de los tests)');

console.log('\nCada pieza, en su sitio');
const prog = src('ui/atleta/Progreso.jsx'), ses = src('ui/atleta/Sesion.jsx'), sem = src('ui/atleta/Semana.jsx'), api = src('datos/api.js');
check(/class="mmt-raiz"/.test(prog) && /data-g=\{g\}/.test(src('ui/MapaMuscular.jsx')) && /<DetalleMusculo g=\{musc\.g\}/.test(prog), '(260) el mapa se toca y, debajo, sus series y con qué ejercicios');
check(/class=\{`barra-fila mmt-fila vol-\$\{estado\}`\} aria-expanded=/.test(prog) && /<DetalleMusculo g=\{g\}/.test(prog), '(268) cada barra es un botón que abre sus ejercicios');
check(/previo=\{previoF\} textoPrevio=\{PREVIO\[rFuerzaV\]\}/.test(prog), '(261) en la fuerza, la línea gris del periodo anterior (como en el peso y el tonelaje)');
check(/huella: \[\.\.\.ss\.reduce/.test(api) && /<Huella filas=\{leerHuella\(e\.huella\)\} \/>/.test(sem) && /<Huella filas=\{resumen\.huella\} nombres \/>/.test(ses), '(263) la huella, en «Tus entrenamientos» y en el resumen de la sesión');
check(/\{ultimas && <LineaEjercicio ejercicioId=\{ej\.id\} \/>\}/.test(ses), '(264) tu línea, junto a «La última vez»');
check(/superaUltima\(hoyS, antesS\)/.test(ses) && /marcarSupera\(sesion\.id\)/.test(ses) && /\{supera && <AvisoSupera s=\{supera\} \/>\}/.test(ses), '(265) superar a la última: la cabecera lo dice, una vez por sesión');
check(/CLAVE_PESO_VISTO = 'fbe-peso-visto'/.test(prog) && /data-f=\{p\.fecha\}/.test(src('ui/comunes.jsx')) && /IntersectionObserver/.test(prog), '(266) tu peso cae en su línea al verla (en el móvil, solo la fecha vista)');
check(/Comparar dos/.test(prog) && /<DosSemanas a=\{dos\[0\]\} b=\{dos\[1\]\}/.test(prog), '(267) «Comparar dos» en «Tus semanas»');
check(!/import .* from '\.\/datos-vista\.jsx'/.test(src('ui/atleta/Hoy.jsx')) && !/datos-vista/.test(src('ui/atleta/AtletaApp.jsx')), 'nada de esto llega al abrir la app: va con Progreso, la sesión y Semana');

console.log('\nLa hoja de estilos (vista-b.css)');
const css = src('vista-b.css');
const sinNotas = css.replace(/\/\*[\s\S]*?\*\//g, '');
check(/^[\x00-\x7F]*$/.test(css), 'solo ASCII');
check(!/@keyframes|animation:|infinite/.test(sinNotas), 'nada se mueve sin parar');
check(!/#[0-9a-f]{3,8}\b/i.test(sinNotas.replace(/:not\(#n\)/g, '')) && !/\brgba?\(/.test(sinNotas), 'colores, solo por fichas');
check(!/font-size:\s*\d/.test(sinNotas), 'tamaños de letra por fichas');
check(/prefers-reduced-motion/.test(css) && /prefers-reduced-transparency/.test(css) && /prefers-contrast: more/.test(css), 'con «reducir movimiento», «reducir transparencia» y «más contraste»');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
if (fallos) process.exit(1);
