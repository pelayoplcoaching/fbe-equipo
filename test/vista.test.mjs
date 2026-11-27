// (v0.274) Vista (251-300), primera vuelta (lista en «claude/belleza-350-propuesta.md»): Hoy, más tranquilo. Los tramos
// con su título fino (255), lo de aprender en un estante y tus historias en su fila (251 y 252), los avisos apilados en
// FBE Esencial (253), los enlaces sueltos como filas de acciones (254), un solo botón relleno (256), los textos largos en
// tres líneas (257), el primer vistazo (258) y «¿Qué necesitas?» recogida (259). Lo que se puede comprobar sin pantalla:
// las cuentas, que cada pieza está en su sitio y que la hoja de estilos sigue las reglas del sistema.
//   node test/vista.test.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { MIN_PILA, seApila, cimaDe, rotuloPila, debajoDe } from '../web/src/logica/pila-avisos.js';
import { NECESITAS, NEC_A_LA_VISTA, NEC_CONTABLES, necesitasALaVista, contarUso } from '../web/src/logica/esencial-respuestas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const src = (r) => readFileSync(new URL(`../web/src/${r}`, import.meta.url), 'utf8');

console.log('Los avisos, apilados (253): las cuentas');
check(MIN_PILA === 3 && !seApila(2) && seApila(3) && seApila(7) && !seApila(5, false) && !seApila(0), 'con tres o más se apilan; con dos, no; con el ajuste apagado, nunca');
check(cimaDe([]) === -1 && cimaDe(null) === -1 && cimaDe([{}, {}, {}]) === 0 && cimaDe([{}, { cima: true }, { cima: true }]) === 1, 'encima, el primero de los principales (tus marcas, tu revisión); si no hay, el primero');
check(rotuloPila(5, false) === 'Ver los 5 avisos' && rotuloPila(5, true) === 'Recoger los avisos', 'el botón: «Ver los 5 avisos» y, abierta, «Recoger los avisos»');
check(debajoDe(['A', 'B', 'C', 'D', 'E'], 1) === 'A · C · y 2 más' && debajoDe(['A', 'B', 'C'], 0) === 'B · C' && debajoDe(['A'], 0) === '' && debajoDe(['A', '', 'C'], 0) === 'C',
  'debajo, los dos primeros por su nombre y «y N más» (sin el de encima ni los que no tienen nombre)');

console.log('\n«¿Qué necesitas?», recogida (259)');
const ids = NECESITAS.map(([id]) => id).concat('otra');
const vista0 = necesitasALaVista(ids, {});
check(NEC_A_LA_VISTA === 4 && vista0.length === 4 && vista0.includes('duele') && vista0.join() === 'falle,viaje,duele,enfermo', `al principio, las cuatro primeras, con «Me duele algo» (${vista0.join()})`);
const usos = { dias: 9, rutina: 4, plan: 7, objetivo: 1 };
const vista1 = necesitasALaVista(ids, usos);
check(vista1.length === 4 && vista1.includes('dias') && vista1.includes('plan') && vista1.includes('rutina') && vista1.includes('duele') && vista1.indexOf('duele') < vista1.indexOf('dias'),
  `con el uso: las que más abre (días, plan, rutina) y siempre «Me duele algo», en su orden de siempre (${vista1.join()})`);
check(necesitasALaVista(ids, { enfermo: 50, duele: 50, falle: 0 }).join() === vista0.join(), 'lo de salud no cuenta (ni «Me duele algo» ni «Estoy enfermo»): no se apunta cuántas veces se abre');
check(necesitasALaVista(['a', 'b', 'c', 'd', 'e'], {}).length === 5 && necesitasALaVista(['a', 'b'], {}).length === 2, 'con cinco o menos no se esconde nada (no merece un botón)');
check(contarUso({}, 'dias').dias === 1 && contarUso({ dias: 999 }, 'dias').dias === 999 && contarUso({}, 'duele').duele === undefined && contarUso({}, 'c-pasado').pasado === undefined && contarUso(null, 'plan').plan === 1,
  'cada vez que abre una, una más (tope 999); las de salud y las de comida no se cuentan');
check(NEC_CONTABLES.every((id) => NECESITAS.some(([x]) => x === id)) && !NEC_CONTABLES.includes('duele') && !NEC_CONTABLES.includes('enfermo') && !NEC_CONTABLES.includes('suave'),
  'solo cuentan las que no son de salud');

console.log('\nCada pieza, en su sitio');
const hoy = src('ui/atleta/Hoy.jsx'), es = src('ui/atleta/Esencial.jsx'), ayuda = src('ui/atleta/EsencialAyuda.jsx'), pila = src('ui/atleta/pila-avisos.jsx'), orden = src('ui/atleta/OrdenarHoy.jsx');
check(/<Tramo titulo="Tus historias">/.test(hoy) && /<Tramo titulo="Para aprender">/.test(hoy) && /<Tramo titulo="El detalle de hoy" apilado>/.test(hoy) && (hoy.match(/titulo=\{esPorSuCuenta\(atleta\) \? 'De Pelayo' : 'De tu coach'\} apilado/g) || []).length === 2,
  'Hoy, por tramos: lo de tu coach (o de Pelayo), tus historias, para aprender y el detalle de hoy');
check(/<VideoSemanaHoy enFila \/>/.test(hoy) && /<TarjetaTravesia compacta \/>/.test(hoy) && /<MitoDeLaSemana \/>/.test(hoy) && /<TarjetaApuntes \/>/.test(hoy), 'el estante: el mito, el vídeo de la semana (en pequeño), el apunte y la travesía');
check(/<TarjetaMes salud=\{salud\} \/>/.test(hoy) && /<TarjetaAnio \/>/.test(hoy) && /<BloqueTerminado salud=\{salud\} \/>/.test(hoy) && /<SemanaPasada salud=\{salud\} \/>/.test(hoy), 'tus historias: tu mes, tu año, el bloque terminado y tu semana');
const iHero = hoy.indexOf('<Diales sesiones='), iFrase = hoy.indexOf('<FraseDeHoy estado='), iTuDia = hoy.indexOf('{tuDia}', iHero);
check(iHero > 0 && iTuDia > iHero && iFrase > iTuDia, '(258) primero la tarjeta de hoy y los diales; luego «Tu día»; luego lo que te deja tu coach');
check(/data-sin-deslizar=""/.test(hoy.slice(hoy.indexOf('function Tramo('), hoy.indexOf('function Tramo(') + 900)), 'la fila que se desliza no cambia de pestaña al deslizarla');
check(/data-aviso="info" data-aviso-cima=""/.test(es) && /data-aviso="info" data-aviso-cima=""/.test(ayuda) && (es.match(/data-aviso="info"/g) || []).length === 3,
  'avisos que solo cuentan algo: tus marcas y tu revisión (los principales), lo de esta semana y la semana hecha');
const piden = ['cer-vuelta', 'cer-agujetas', 'cer-ritmo', 'cer-va', 'vid-mudo', 'vid-viaje-t', 'vid-sube', 'dias-esencial', 'alta-perdida', 'cierre-semana', 'alta-tus-dias', 'pregunta-errata', 'cns-caja'];
const todo = readdirSync(new URL('../web/src/ui/atleta/', import.meta.url)).filter((f) => /^Esencial.*\.jsx$/.test(f)).map((f) => src(`ui/atleta/${f}`)).join('\n');
check(piden.every((c) => !new RegExp(`class="nota-coach ${c}"[^>]*data-aviso="info"`).test(todo)), 'los que piden algo (volver, contestar, elegir, activar avisos…) nunca entran en la pila');
check(/import\('\.\/pila-avisos\.jsx'\)/.test(es) && !/from '\.\/pila-avisos\.jsx'/.test(es), 'la pila llega aparte, con Hoy ya pintado');
check(/dataset\.bajo/.test(pila) && /aria-expanded/.test(pila) && /sinMovimiento\(\)/.test(pila) && /MutationObserver/.test(pila), 'la pila: los de debajo se esconden, el botón dice si está abierta, sin movimiento si se pide y al día si cambian las tarjetas');
check(/Apilar los avisos/.test(orden) && /fijarApilar/.test(orden), '«Apilar los avisos», en «Ordenar Hoy»');
check(/fac-grupo/.test(hoy) && /cierre-pausa fac-grupo/.test(es) && /cer-pie fac-grupo/.test(src('ui/atleta/EsencialCerca.jsx')) && /ayu-rev-linea fac-grupo/.test(ayuda), '(254) los enlaces sueltos, en filas de acciones: «Esta semana no puedo», «Lo que la app ha hecho por ti», «Ordenar Hoy»…');
check(/necesitasALaVista\(ids, usos0\.current\)/.test(ayuda) && /Ver todas \(\$\{ids\.length\}\)/.test(ayuda) && /fbe-nec-todas/.test(ayuda), '(259) «¿Qué necesitas?»: cuatro a la vista y «Ver todas (N)», que se queda como lo dejes');
check(/<TresLineas/.test(src('ui/Avisos.jsx')) && /<TresLineas/.test(src('ui/atleta/EsencialCerca.jsx')) && /<TresLineas mas="Seguir leyendo">/.test(es), '(257) tres líneas con «Leer más»: los avisos de tu coach, «Llevas N días sin entrenar» y lo de esta semana («Seguir leyendo»: ya tiene su «Leer más»)');
check(/export function useTresLineas/.test(src('ui/comunes.jsx')) && /useTresLineas\(vista\)/.test(src('ui/comunes.jsx')), 'las pistas usan la misma medida');

console.log('\nLa hoja de estilos (vista-a.css)');
const css = src('vista-a.css');
check(/^[\x00-\x7F]*$/.test(css), 'solo ASCII');
const reglas = css.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((r) => r.trim()).filter((r) => r.includes('{') && !r.startsWith('@'));
const selectores = reglas.map((r) => r.slice(0, r.indexOf('{')).replace(/^@media[^{]*\{/, '').trim());
check(selectores.every((s) => s.split(/,(?![^(]*\))/).every((x) => /:not\(#n\):not\(#n\)/.test(x))), 'cada regla, con :not(#n):not(#n) (no empata con las de los trozos)');
check(!/#[0-9a-f]{3,8}\b/i.test(css.replace(/:not\(#n\)/g, '')) && !/\brgba?\(/.test(css), 'colores, solo por fichas (sin colores a mano)');
const sinNotas = css.replace(/\/\*[\s\S]*?\*\//g, '');
check(!/@keyframes/.test(sinNotas) && !/animation:/.test(sinNotas) && !/infinite/.test(sinNotas), 'nada se mueve sin parar');
check(!/font-size:\s*\d/.test(css) && !/font-weight:\s*(?!400|500|560|600|650|700|750|800|900)\d/.test(css), 'tamaños de letra por fichas y pesos de la lista');
check(/prefers-reduced-transparency/.test(css) && /prefers-contrast: more/.test(css), 'con «reducir transparencia» y «más contraste», el título sin cristal');
const fichas = new Set(readdirSync(new URL('../web/src/', import.meta.url)).filter((f) => f.endsWith('.css')).flatMap((f) => [...src(f).matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1])));
const usadas = [...new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]))];
check(usadas.every((t) => fichas.has(t)), `todas las fichas existen (${usadas.filter((t) => !fichas.has(t)).join(', ') || 'sí'})`);

console.log(`\n${ok} correctas, ${fallos} fallidas`);
if (fallos) process.exit(1);
