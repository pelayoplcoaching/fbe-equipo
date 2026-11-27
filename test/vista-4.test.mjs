// (v0.277) Vista (251-300), cuarta vuelta: las hojas de FBE Esencial (274-281). Las cuentas del calendario de la casa y
// que cada pieza está en su sitio.
//   node test/vista-4.test.mjs
import { readFileSync } from 'node:fs';
import { INICIALES, mesDe, nombreMes, nombreDia, diasDelMes, sumarMeses, dentro, elegirEnTramo } from '../web/src/logica/calendario.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const src = (r) => readFileSync(new URL(`../web/src/${r}`, import.meta.url), 'utf8');

console.log('El calendario de la casa (274)');
check(INICIALES.join('') === 'LMXJVSD' && mesDe('2026-12-07') === '2026-12' && nombreMes('2026-12') === 'diciembre de 2026' && nombreMes('') === '', 'la semana empieza en lunes y el mes se nombra entero');
check(nombreDia('2026-12-07') === 'lunes 7 de diciembre' && nombreDia('2027-01-03') === 'domingo 3 de enero', 'cada día dice su nombre (para el lector de pantalla)');
const dic = diasDelMes('2026-12');
check(dic.length === 32 && dic[0] === null && dic[1] === '2026-12-01' && dic[31] === '2026-12-31', 'diciembre de 2026 empieza en martes: un hueco delante y sus 31 días');
const feb = diasDelMes('2027-02');
check(feb.filter(Boolean).length === 28 && feb[0] === '2027-02-01' && diasDelMes('2028-02').filter(Boolean).length === 29 && diasDelMes('') .length === 0, 'febrero, con sus 28 días (29 en bisiesto); el de 2027 empieza en lunes, sin huecos');
check(sumarMeses('2026-12-07', 1) === '2027-01-07' && sumarMeses('2027-01-31', 1) === '2027-02-28' && sumarMeses('2027-03-31', -1) === '2027-02-28' && sumarMeses('2026-01-15', -2) === '2025-11-15', 'un mes más o menos: el mismo día o, si no lo hay, el último del mes');
check(dentro('2026-12-01', '2026-12-10', '2027-01-10') === '2026-12-10' && dentro('2027-02-01', '2026-12-10', '2027-01-10') === '2027-01-10' && dentro('2026-12-20', '2026-12-10') === '2026-12-20' && dentro('', '2026-12-10') === null, 'los límites: fuera de ellos, el más cercano');
check(JSON.stringify(elegirEnTramo({}, '2026-12-20')) === '{"desde":"2026-12-20","hasta":""}'
  && JSON.stringify(elegirEnTramo({ desde: '2026-12-20' }, '2026-12-27')) === '{"desde":"2026-12-20","hasta":"2026-12-27"}'
  && JSON.stringify(elegirEnTramo({ desde: '2026-12-20' }, '2026-12-18')) === '{"desde":"2026-12-18","hasta":""}'
  && JSON.stringify(elegirEnTramo({ desde: '2026-12-20', hasta: '2026-12-27' }, '2027-01-02')) === '{"desde":"2027-01-02","hasta":""}'
  && JSON.stringify(elegirEnTramo({ desde: '2026-12-20' }, '2026-12-20')) === '{"desde":"2026-12-20","hasta":"2026-12-20"}',
  'el viaje: el primer toque es la ida y el segundo la vuelta (si va antes, es la nueva ida; con el viaje hecho, empieza otro)');

console.log('\nCada pieza, en su sitio');
const cal = src('ui/atleta/CalendarioCasa.jsx'), vida = src('ui/atleta/EsencialVida.jsx'), ayuda = src('ui/atleta/EsencialAyuda.jsx'), es = src('ui/atleta/Esencial.jsx');
const hojas = src('ui/atleta/DialesHojas.jsx'), diales = src('ui/atleta/Diales.jsx'), casilla = src('ui/atleta/CasillaCasa.jsx');
const cssA = src('vista-a.css'), cssB = src('vista-b.css');
check(/<CalendarioCasa tramo valor=\{\{ desde, hasta \}\}/.test(vida) && /<CalendarioCasa valor=\{fecha\} alCambiar=\{setFecha\} min=\{sumar\(hoy, 14\)\} max=\{sumar\(hoy, 371\)\}/.test(vida) && !/type="date"/.test(vida),
  '(274) el viaje y el objetivo, con el calendario de la casa (ya no queda el selector de fecha del navegador)');
check(/role="group" aria-label=\{etiqueta\}/.test(cal) && /tabIndex=\{d === focoMes \? 0 : -1\}/.test(cal) && /ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7/.test(cal) && /PageUp/.test(cal) && /aria-pressed=/.test(cal) && /Mes anterior: /.test(cal),
  'con el teclado (flechas, Inicio, Fin, AvPág y RePág), un solo día enfocable y cada día con su nombre y si está elegido');
check(/class="ayu-p-q rsp-q"/.test(ayuda) && /querySelector\('\.ayu-p-r'\)\?\.animate/.test(ayuda) && /sinMovimiento\(\)/.test(ayuda), '(275) «Respuestas», con la flecha de la casa y la respuesta que asoma al abrir (sin movimiento, tal cual)');
check(/const media = previas\.length >= 2/.test(hojas) && /franja && w\.lunes !== lunes && <i class="bc-franja"/.test(hojas) && /class="mini terciario bc-ley"/.test(hojas) && /'actual bc-ahora'/.test(hojas),
  '(276) la carga, como las demás gráficas: barras con degradado y la franja de tu media detrás de las semanas acabadas, con su leyenda');
check(/<PictoEjercicio ejercicio=\{\{ nombre: m\.nombre, grupos_musculares: m\.grupos \|\| \[\] \}\} \/>/.test(es) && /class="mrc-titulo"/.test(es) && /mrc-cifra/.test(es), '(277) tus marcas, como vitrina: el dibujo de cada ejercicio y la cifra de marcador');
check(/const ICONO_OPCION = \{ pausa: 'pausa', viaje: 'ubicacion'/.test(vida) && /class="opc-i" aria-hidden="true"/.test(vida) && /class="opc-marca" aria-hidden="true"/.test(vida), '(278) las opciones de las hojas, todas iguales: su icono, su texto y si está elegida');
check(/<Arte id="esencial-bienvenida-lunes" \/>/.test(es) && /<Arte id="esencial-pausa" \/>/.test(es), '(279) «Elige tus días» y «Esta semana no puedo», con su ilustración (de las que ya hay)');
check(/class=\{clase \? `chk-casa \$\{clase\}` : 'chk-casa'\}/.test(casilla) && ['EsencialPruebas', 'EsencialRutinas', 'EsencialDolor'].every((f) => { const t = src(`ui/atleta/${f}.jsx`); return /<CasillaCasa /.test(t) && !/type="checkbox"/.test(t); }),
  '(280) las casillas de la casa en Pruebas, Rutinas y Dolor (un solo componente, para que su estilo no se cargue al abrir)');
check(/\.tramo-fila:not\(#n\):not\(#n\) > \.apuntes-tarjeta \{ grid-template-columns: minmax\(0, 1fr\)/.test(cssA), '(281) tu apunte, en la fila de Hoy, como una tarjeta más (el texto entero, sin cortarse)');
check((diales.match(/perezoso\(\(\) => import\('\.\/DialesHojas\.jsx'\)/g) || []).length === 5 && /kit=\{KIT\}/.test(diales) && /export function HojaCarga/.test(hojas), 'las hojas de los diales, en su propio trozo (llegan antes de tocarlas)');

console.log('\nNada se mueve solo, y todo tiene su versión');
const parte = cssB.slice(cssB.indexOf('(v0.277)'));
check(parte.length > 1000 && !/infinite/.test(parte) && !/@keyframes/.test(parte), 'ni animaciones que se repitan ni fotogramas nuevos (lo poco que se mueve, con WAAPI y una vez)');
check(/@media \(prefers-reduced-motion: no-preference\) \{ \.rsp-q:not\(#n\)::after \{ transition/.test(parte) && /@media \(prefers-reduced-motion: no-preference\) \{ \.chk-casa:not\(#n\)::after \{ transition/.test(parte), 'las transiciones, solo si no se ha pedido reducir el movimiento');
check(/@media \(forced-colors: active\) \{ \.clc-d\.clc-ini/.test(parte) && /@media \(forced-colors: active\) \{ \.rsp-q/.test(parte) && /@media \(forced-colors: active\) \{ \.chk-casa:not\(#n\) \{ -webkit-appearance: auto/.test(parte), 'con colores forzados: el día elegido con su borde, la flecha visible y la casilla del sistema');
check(!/[^\x00-\x7f]/.test(parte) && !/#[0-9a-f]{3,6}\b/i.test(parte.replace(/%23[0-9a-f]+/gi, '')) && !/rgba?\(/.test(parte), 'el CSS nuevo: solo ASCII y colores por fichas');

console.log(`\n${ok} bien, ${fallos} mal`);
if (fallos) process.exit(1);
