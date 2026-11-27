// (v0.261) Belleza para las dos apps, tanda A: la carcasa y Hoy (lista en «claude/belleza-150-ambas.md», A1 a A50). Lo
// que se puede comprobar sin pantalla: el nombre de cada app, el de la rutina sin «· FBE Esencial», la barra flotante (y
// sus marcas en <html>), la nota de la semana con «Leer más» y que la hoja de estilos sigue las reglas del sistema.
//   node test/belleza-ambas.test.mjs
import { readFileSync } from 'node:fs';
import { nombreBloque } from '../web/src/logica/esencial.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const src = (r) => readFileSync(new URL(`../web/src/${r}`, import.meta.url), 'utf8');

console.log('Cada app con su nombre (A1) y la rutina sin «· FBE Esencial» (A13)');
check(nombreBloque('Novato 2 días · FBE Esencial') === 'Novato 2 días' && nombreBloque('Novato 3 días · FBE Esencial') === 'Novato 3 días', 'las dos de novato, sin «· FBE Esencial»');
check(nombreBloque('Fuerza base') === 'Fuerza base' && nombreBloque('2 días · Full body · A · Barra y básicos') === '2 días · Full body · A · Barra y básicos' && nombreBloque(null) === '', 'las demás, igual (también las que llevan puntos en medio)');
const hoy = src('ui/atleta/Hoy.jsx'), app = src('ui/atleta/AtletaApp.jsx');
check(/export function Marca\(\{ nombre = 'FBE Equipo' \}\)/.test(src('ui/comunes.jsx')) && /<Marca nombre=\{porSuCuenta \? 'FBE Esencial' : undefined\} \/>/.test(hoy) && /<Marca nombre=\{esPorSuCuenta\(atleta\) \? 'FBE Esencial' : undefined\} \/>/.test(app),
  'la cabecera de Hoy y el consentimiento dicen «FBE Esencial» a quien va por su cuenta (los demás, «FBE Equipo»)');
check(/Bloque \{p\.bloque\.numero\}: \{nombreBloque\(p\.bloque\.nombre\)\}/.test(hoy) && /nombreBloque\(p\.bloque\.nombre\)/.test(src('ui/atleta/Semana.jsx')) && /nombreBloque\(p\?\.bloque\?\.nombre\)/.test(src('ui/atleta/EsencialAyuda.jsx')),
  'en Hoy, Semana y «Entender mi plan», con el nombre corto');

console.log('\nLa barra flotante (A2 a A5) y la tarjeta grande (A14 a A17)');
check(/<nav class="tabs tabs-flota" aria-label="Secciones">/.test(app) && /useMarcaPagina\('barra-flota', !sesionId\)/.test(app), 'la barra del atleta flota (la del coach, no) y avisa a <html> para dejar su hueco');
check(/useMarcaPagina\('hay-a-mano', fuera\)/.test(hoy), '«Tu sesión», apoyada en la barra, deja su hueco al final de Hoy mientras se ve');
check(/function NotaHero\(/.test(hoy) && /'Leer más'/.test(hoy) && /amb-nota-corta/.test(hoy), 'la nota de la semana, en tres líneas con «Leer más» si es larga');
check(/<Icono n="hoy" \/><span><b>\{ejercicios\.length\}<\/b> ejercicios<\/span>/.test(hoy) && /<Icono n="reloj" \/><span>unos <b>/.test(hoy), '«5 ejercicios» y «unos 30 min», con su icono');
check(/<b class="amb-racha-n">\{racha\}<\/b>\{texto\.slice\(String\(racha\)\.length\)\}/.test(hoy), 'la racha, con la cifra aparte y el mismo texto');

console.log('\nLa hoja de estilos (ambas-a.css)');
const css = src('ambas-a.css'), main = src('main.jsx');
check(!/[^\x00-\x7F]/.test(css), 'solo ASCII (también los comentarios)');
check(main.indexOf("'./ambas-a.css'") > main.indexOf("'./constancia.css'") && main.indexOf("'./ambas-a.css'") < main.indexOf("'./color-capa.css'"), 'se carga después de lo de cada parte y antes de color-capa.css');
const sinCom = css.replace(/\/\*[\s\S]*?\*\//g, '');
check(!/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(sinCom), 'los colores, siempre por su nombre (sin valores sueltos)');
check(/@media \(prefers-reduced-motion: no-preference\) \{\s*@supports \(animation-timeline: scroll\(\)\) \{\s*\.tabs-flota\.tabs-flota \{ animation: amb-tabs-baja/.test(css), 'la barra solo se encoge si se puede (y nunca con «reducir movimiento»)');
check(/prefers-reduced-transparency: reduce\), \(prefers-contrast: more\) \{\s*\.tabs-flota\.tabs-flota/.test(css) && /prefers-reduced-transparency: reduce\), \(prefers-contrast: more\) \{\s*\.hoy-a-mano/.test(css), 'con «reducir transparencia» o «más contraste», la barra y «Tu sesión» van en sólido');
check(!/(html|body|:root|\.app)[^{,]*:has\(/.test(sinCom) && /html\.barra-flota \.contenido/.test(sinCom) && /html\.hay-a-mano \.contenido/.test(sinCom), 'sin «:has()» que mire la página entera: el hueco de abajo sale de las marcas de <html>');

console.log('\nTanda B (v0.262): el entrenamiento y tus datos');
const cssB = src('ambas-b.css'), sinComB = cssB.replace(/\/\*[\s\S]*?\*\//g, '');
check(!/[^\x00-\x7F]/.test(cssB) && !/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(sinComB), 'ambas-b.css: solo ASCII y los colores por su nombre');
check(main.indexOf("'./ambas-b.css'") > main.indexOf("'./ambas-a.css'") && main.indexOf("'./ambas-b.css'") < main.indexOf("'./color-capa.css'"), 'y se carga detrás de la tanda A, antes de color-capa.css');
const guia = src('ui/atleta/EsencialSesion.jsx');
check(/<ol class="alta-guia-pasos amb-fichas">/.test(guia) && (guia.match(/<li class="amb-ficha">/g) || []).length === 3 && /<ArteMini id="esencial-ajustar-maquina" \/>/.test(guia) && !/ArteDuo/.test(guia),
  'B52: «Tu primera sesión», en tres fichas que se deslizan (y las máquinas, en una fila con su miniatura)');
check(/export function ArteMini\(/.test(src('ui/atleta/EsencialArte.jsx')) && /\.esa-mini \{/.test(src('esencial-arte.css')), 'la miniatura cuadrada, con su estilo esa-* (va con su trozo)');
const aros = src('ui/atleta/Anillos.jsx');
check(/class="amb-aro-salida"/.test(aros) && /a\.frac === 0 &&/.test(aros) && /class="amb-aro-cifra"/.test(aros), 'B90: los aros vacíos, con su marca de salida y las sesiones en el centro');
check(/\.cifras\.cifras > div\.destaca dd \{ color: var\(--tinta\); \}/.test(cssB) && /\.cifra-objetivo-img \{ float: none; grid-column: 1;/.test(cssB), 'B92 y B83: las cuatro cifras en tinta y el dibujo de tu objetivo a la izquierda del título');
check(/\.pista\.pista p \{ hyphens: manual;/.test(cssB), 'las pistas cortas, sin cortes con guion');

console.log('\nTanda C (v0.263): acabado y para todos');
const cssC = src('ambas-c.css'), sinComC = cssC.replace(/\/\*[\s\S]*?\*\//g, '');
check(!/[^\x00-\x7F]/.test(cssC) && !/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(sinComC) && main.indexOf("'./ambas-c.css'") > main.indexOf("'./ambas-b.css'") && main.indexOf("'./ambas-c.css'") < main.indexOf("'./color-capa.css'"),
  'ambas-c.css: solo ASCII, los colores por su nombre y detrás de la tanda B');
const comp = src('ui/Compartir.jsx');
check(/let MARCA_APP = 'FBE Equipo';/.test(comp) && /MARCA_APP = !propio && esPorSuCuenta\(atleta\) \? 'FBE Esencial' : 'FBE Equipo';/.test(comp) && /x\.fillText\(MARCA_APP, /.test(comp) && !/fillText\('FBE Equipo'/.test(comp),
  'C140: la tarjeta de compartir lleva la marca de su app (FBE Esencial a quien va por su cuenta)');
check(/ck-vl ck-vl-\$\{/.test(src('ui/atleta/Checkin.jsx')) && /\.ck-vl-bascula \{ --ico-l: var\(--ico-bascula\); \}/.test(cssC), 'C146: el vistazo del check-in, en fichas con su icono');
check(/atajo-perfil atajo-k-\$\{k\}/.test(src('ui/atleta/PerfilMas.jsx')) && /\.atajo-k-progreso \.atajo-ico/.test(cssC), 'C144: los atajos del perfil, cada uno con su color');
check(/\.cerrar-hoja\.cerrar-hoja \{[^}]*width: 2\.75rem/.test(sinComC) && /\.bloque-equipo\.bloque-equipo \{[^}]*position: sticky/.test(sinComC), 'C110 y C129: la X de las hojas con 44 px y las etiquetas de Recetas pegadas arriba');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
