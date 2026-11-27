// (v0.276) Vista (251-300), tercera vuelta: los primeros días (269 y 270) y leer a gusto (271-273). Las cuentas de la
// barra de lectura y que cada pieza está en su sitio.
//   node test/vista-3.test.mjs
import { readFileSync } from 'node:fs';
import { minutosLectura, avanceLectura, textoQuedan, PALABRAS_MINUTO } from '../web/src/logica/lectura.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const src = (r) => readFileSync(new URL(`../web/src/${r}`, import.meta.url), 'utf8');

console.log('La barra de lectura (271)');
const palabras = (n) => Array.from({ length: n }, () => 'fuerza').join(' ');
check(PALABRAS_MINUTO === 200 && minutosLectura('') === 0 && minutosLectura(palabras(30)) === 1 && minutosLectura(palabras(1000)) === 5 && minutosLectura(`  ${palabras(500)}\n `) === 3, 'los minutos: unas 200 palabras por minuto, como poco uno (sin texto, nada)');
check(avanceLectura({ arriba: 100, alto: 3000, ventana: 800 }) === 0 && avanceLectura({ arriba: -1200, alto: 3000, ventana: 800 }) === 0.5 && avanceLectura({ arriba: -5000, alto: 3000, ventana: 800 }) === 1,
  'lo leído: nada mientras el texto no ha subido; la mitad, a medio recorrido; todo al llegar su final al último cuarto de la pantalla');
check(avanceLectura({ arriba: -300, alto: 3000, ventana: 800, maxRecorrido: 300 }) === 1 && avanceLectura({ arriba: 0, alto: 500, ventana: 800, maxRecorrido: 0 }) === 1,
  'si debajo no hay bastante página, leído al llegar abajo del todo (o si cabe entero)');
check(avanceLectura({ arriba: 0, alto: 0, ventana: 800 }) === 0, 'sin texto, nada');
check(textoQuedan(3) === 'Te quedan 3 min' && textoQuedan(1) === 'Te queda 1 min' && textoQuedan(0) === 'Leído' && textoQuedan(1, true) === 'Te queda 1 minuto' && textoQuedan(4, true) === 'Te quedan 4 minutos', 'lo que dice: «Te quedan 3 min», «Te queda 1 min», «Leído»');

console.log('\nCada pieza, en su sitio');
const guias = src('ui/Guias.jsx'), prog = src('ui/atleta/Progreso.jsx'), lec = src('ui/lectura.jsx'), ayuda = src('ui/atleta/EsencialAyuda.jsx');
check(/class="pila lector-guia lec-modo"/.test(guias) && /<BarraLectura raiz=\{raiz\} clave=\{clave\} \/>/.test(guias), '(271, 272) las guías: la barra de lectura y el modo lectura');
check(/<BarraLectura raiz=\{texto\} clave=\{r\.id\} \/>/.test(ayuda), '(271) y la revisión semanal, con su barra');
check(/<FinGuia clave=\{clave\} alSiguiente=\{alSiguiente\} \/>/.test(guias) && /Guía leída/.test(guias) && /La siguiente/.test(guias) && /alSiguiente=\{\(g\) => \{ setAbierta/.test(guias), '(273) al acabar: «Guía leída» y, en «Aprende», la siguiente');
check(/leida=\{leidas\.has\(g\.clave\)\}/.test(guias) && /fbe-guias-leidas/.test(lec), 'y en la lista, las leídas con su «Leída» (en el móvil, solo su clave)');
check(/requestAnimationFrame/.test(lec) && /passive: true/.test(lec) && !/setInterval/.test(lec), 'la barra sigue al desplazamiento (una vez por imagen y sin frenarlo); nada que se mueva solo');
check(/GraficaFantasma texto=\{esCoach \?/.test(prog) && /semanasTon\.length <= 1/.test(prog) && /Tu primera semana/.test(prog), '(269) el primer día: la silueta de la fuerza y del tonelaje, y tu primera semana dibujada');
check(/class="vitrina-rejilla vit-huecos"/.test(prog) && /Tu primer récord/.test(prog), '(270) la vitrina, con los marcos de tus primeros récords');
check(/if \(!lista\.datos \|\| lista\.datos\.length\) return null;/.test(prog), 'la primera semana dibujada, solo a quien aún no ha acabado ninguna (no a quien vuelve de un parón)');

console.log('\nLa hoja de estilos (lo de esta vuelta, en vista-b.css)');
const css = src('vista-b.css');
const parte = css.slice(css.indexOf('(v0.276)'));
const sinNotas = parte.replace(/\/\*[\s\S]*?\*\//g, '');
check(parte.length > 100 && /^[\x00-\x7F]*$/.test(parte), 'solo ASCII');
check(!/@keyframes|animation:|infinite|transition:/.test(sinNotas), 'nada se mueve solo (la barra va con el desplazamiento)');
check(!/#[0-9a-f]{3,8}\b/i.test(sinNotas.replace(/:not\(#n\)/g, '')) && !/\brgba?\(/.test(sinNotas) && !/font-size:\s*\d/.test(sinNotas), 'colores y letras, por fichas');
check(/prefers-reduced-transparency/.test(parte) && /prefers-contrast: more/.test(parte), 'con «reducir transparencia» y «más contraste»');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
if (fallos) process.exit(1);
