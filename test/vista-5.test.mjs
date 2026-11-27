// (v0.278) Vista (251-300), quinta vuelta: luz y materia (282-289). Las cuentas (la luz de la hora, la luz cálida, la
// inclinación y el arte de los vídeos), el contraste de la luz cálida con los diez acentos y que cada pieza está en su sitio.
//   node test/vista-5.test.mjs
import { readFileSync } from 'node:fs';
import { horaCalida, HORAS_CALIDA } from '../web/src/logica/cielo.js';
import { imagenTemaVideo } from '../web/src/logica/imagenes.js';
import { aOklch, oklch, contraste, neutrosDe, ACENTOS, TEXTOS } from '../web/src/logica/paleta.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const src = (r) => readFileSync(new URL(`../web/src/${r}`, import.meta.url), 'utf8');

console.log('La luz cálida (282)');
check(HORAS_CALIDA.join() === '22,7' && horaCalida(22) && horaCalida(23.9) && horaCalida(0) && horaCalida(6.99) && !horaCalida(7) && !horaCalida(12) && !horaCalida(21.99) && !horaCalida(null), 'la luz cálida: de las 22:00 a las 7:00');

console.log('\nLa luz cálida, con los diez acentos (282): los textos siguen pasando');
const lab = (hex) => { const [L, C, h] = aOklch(hex); const r = (h * Math.PI) / 180; return [L, C * Math.cos(r), C * Math.sin(r)]; };
const deLab = ([L, a, b]) => { const C = Math.hypot(a, b); const h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360; return oklch(L, C, h); };
const mezcla = (x, px, y) => { const A = lab(x), B = lab(y), p = px / 100; return deLab(A.map((v, i) => v * p + B[i] * (1 - p))); };
const color = src('color.css');
const prim = (k) => new RegExp(`--${k}: (#[0-9A-F]{6});`).exec(color)?.[1];
const ambar = prim('ambar-200'), blanco = prim('blanco');
let peor = { ratio: 99 };
const mira = (que, t, f) => { const r = contraste(t, f); if (r < peor.ratio) peor = { que, ratio: r }; return r; };
for (const a of ACENTOS) {
  const n = neutrosDe(a);
  const neu = (p) => (n ? n.neutro[p] : prim(`neutro-${p}`));
  const noche = (i) => (n ? n.noche[i] : prim(`noche-${i}`));
  const claro = { hoja: mezcla(blanco, 94, ambar), 'hoja-2': mezcla(neu(50), 94, ambar), tiza: mezcla(neu(100), 93, ambar) };
  const textos = { tinta: neu(950), 'tinta-2': neu(700), 'tinta-3': neu(600), acento: a.claro.morado };
  for (const [ft, f] of Object.entries(claro)) for (const [tt, t] of Object.entries(textos)) mira(`${a.id}, claro: ${tt} sobre ${ft}`, t, f);
  const tinta = mezcla(neu(100), 88, ambar);
  for (const i of [0, 1, 2, 3]) mira(`${a.id}, oscuro: tinta sobre noche-${i}`, tinta, noche(i));
}
check(peor.ratio >= 4.5, `en claro (tinta, tinta-2, tinta-3 y el acento sobre las tres superficies) y en oscuro (la tinta sobre las cuatro noches), AA con todos: el peor, ${peor.que} (${peor.ratio}:1)`);
const blancoCalido = mezcla(blanco, 94, ambar);
check(blancoCalido !== blanco && aOklch(blancoCalido)[0] > 0.97 && aOklch(blancoCalido)[2] > 40 && aOklch(blancoCalido)[2] < 100, `el blanco de las tarjetas, un punto más cálido (${blancoCalido}), sin oscurecerse`);
check(contraste(mezcla(prim('neutro-100'), 88, ambar), prim('noche-1')) >= contraste(TEXTOS.oscuro.tinta, prim('noche-1')) - 1.2, 'y el texto de la noche, casi igual de claro que el de siempre');

console.log('\nLos vídeos sin miniatura (288)');
check(imagenTemaVideo('entrenamiento') === 'guia-entrenar' && imagenTemaVideo('tecnica') === 'video-tecnica' && imagenTemaVideo('alimentacion') === 'guia-comer' && imagenTemaVideo('descanso') === 'guia-cabeza'
  && imagenTemaVideo('general') === 'guia-mas' && imagenTemaVideo('otra') === 'guia-mas' && imagenTemaVideo(null) === 'guia-entrenar', 'cada tema, su arte (los del canal, el rack)');

console.log('\nCada pieza, en su sitio');
const ajustes = src('ui/ajustes.js'), aj = src('ui/Ajustes.jsx'), incl = src('ui/inclinacion.js'), vids = src('ui/Videos.jsx');
check(/calida: false/.test(ajustes) && /a\.calida = a\.calida === true;/.test(ajustes) && /r\.toggleAttribute\('data-calida', a\.calida === true && !alto && horaCalida\(horaDecimal\(new Date\(\)\)\)\);/.test(ajustes)
  && /<Interruptor id="aj-calida" icono="luna" texto="Luz cálida de noche"/.test(aj), '(282) el ajuste «Luz cálida de noche» (apagado de serie; nunca con alto contraste)');
check(/relojLuz = setInterval/.test(ajustes) && /visibilitychange', alVolverLuz/.test(ajustes) && !/relojSol/.test(ajustes) && !/--luz-x/.test(ajustes) && /hoja\.textContent !== css/.test(ajustes),
  '(282) la hora se mira cada cinco minutos con la app a la vista (sin rehacer la hoja del acento si no cambia)');
check(/export const puedeInclinar = \(\) => !sinMovimiento\(\)/.test(incl) && /IntersectionObserver/.test(incl) && /requestAnimationFrame\(pintar\)/.test(incl) && /removeEventListener\('deviceorientation', alInclinar\)/.test(incl)
  && /marcarInclinacion\(\)/.test(src('ui/atleta/Carnet.jsx')), '(284 y 285) un solo oyente del móvil, solo con algo a la vista, una vez por imagen y nunca con «reducir movimiento»; el permiso del carné vale para el resto');
check(/quitarIncl\.current = el \? seguirInclinacion\(el,/.test(src('ui/atleta/Hoy.jsx')) && /<section ref=\{heroRef\} class=\{`hero-dia/.test(src('ui/atleta/Hoy.jsx')), '(285) la tarjeta de Hoy sigue al móvil (desde que aparece: no siempre está en el primer pintado)');
check(/seguirInclinacion\(svg\.current/.test(src('ui/Logros.jsx')) && /seguirInclinacion\(ol\.current/.test(src('ui/atleta/ProgresoPiezas2.jsx')) && /seguirInclinacion\(rejilla\.current/.test(src('ui/atleta/Progreso.jsx')),
  '(284) y el brillo de las medallas, el podio y la vitrina');
check(/function MiniaturaVideo\(\{ id, categoria = null \}\)/.test(vids) && /onError=\{\(\) => setFalla\(true\)\}/.test(vids) && (vids.match(/<MiniaturaVideo /g) || []).length === 2 && /categoria=\{r\.categoria\}/.test(vids), '(288) la miniatura, o el arte de su tema');

console.log('\nLa hoja de estilos (vista-c.css)');
const css = src('vista-c.css'), sinCom = css.replace(/\/\*[\s\S]*?\*\//g, ''), main = src('main.jsx');
check(!/[^\x00-\x7f]/.test(css) && !/#[0-9a-f]{3,8}\b/i.test(sinCom) && !/rgba?\(/.test(sinCom) && main.indexOf("'./vista-c.css'") > main.indexOf("'./vista-b.css'") && main.indexOf("'./vista-c.css'") < main.indexOf("'./color-capa.css'"),
  'solo ASCII, los colores por su ficha y detrás de la cuarta vuelta');
check(/:root\[data-calida\]:not\(\[data-theme="dark"\]\)/.test(css) && /:root\[data-calida\]\[data-theme="light"\]/.test(css) && /:root\[data-calida\]:not\(\[data-theme="light"\]\)/.test(css) && /:root\[data-calida\]\[data-theme="dark"\]/.test(css),
  '(282) la luz cálida en los tres temas (con el del sistema y con los dos elegidos)');
check(!/--luz-x/.test(sinCom), '(283) las sombras que siguen a la hora, fuera: probadas, no se notan');
check(/@media \(prefers-reduced-motion: no-preference\) and \(prefers-reduced-transparency: no-preference\) and \(prefers-contrast: no-preference\) \{\s*@supports \(animation-timeline: scroll\(\)\)/.test(css) && /animation-timeline: scroll\(root\)/.test(css) && !/infinite/.test(css),
  '(286) el reflejo, ligado al desplazamiento (nada se mueve solo) y fuera con reducir movimiento, transparencia o más contraste');
check(/filter: brightness\(\.88\)/.test(css) && /\.vacio\.con-ilustracion:not\(\.con-escena\) > svg\.ilustracion \{/.test(css) && /@media \(forced-colors: active\)/.test(css), '(287 y 289) las fotos de los platos en oscuro y los dibujos de línea con la noche de la marca (y su versión con colores forzados)');
check(/@media \(prefers-reduced-motion: reduce\) \{ \.hero-dia\[data-incl\]/.test(css), '(285) con «reducir movimiento», la tarjeta de Hoy, quieta');

console.log(`\n${ok} bien, ${fallos} mal`);
if (fallos) process.exit(1);
