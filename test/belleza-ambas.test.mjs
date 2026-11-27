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

console.log('\nSegunda vuelta (v0.264): lo que quedaba de B y C');
const cssD = src('ambas-d.css'), sinComD = cssD.replace(/\/\*[\s\S]*?\*\//g, '');
check(!/[^\x00-\x7F]/.test(cssD) && !/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(sinComD) && main.indexOf("'./ambas-d.css'") > main.indexOf("'./ambas-c.css'") && main.indexOf("'./ambas-d.css'") < main.indexOf("'./color-capa.css'"),
  'ambas-d.css: solo ASCII, los colores por su nombre y detrás de la tanda C');
const piezas = src('ui/atleta/ProgresoPiezas.jsx'), prog = src('ui/atleta/Progreso.jsx');
check(/export function LineaAncha\(/.test(piezas) && /<LineaAncha valores=\{c\.serie\} clase="mini-linea cifra-objetivo-linea" \/>/.test(src('ui/atleta/Personal.jsx')) && /return <LineaAncha valores=\{vs\} clase="mini-grafica amb-mg" \/>;/.test(prog)
  && /\.amb-linea-ancha\.amb-linea-ancha \{[^}]*width: 100%/.test(sinComD), 'B81 y B88: la línea de tu objetivo y la de los destacados, a todo el ancho, con su área y el punto de ahora');
check(/semanas=\{d\.id === 'records' \? semanasRecords : null\}/.test(prog) && /'Esta semana'/.test(prog) && /class="amb-mg-n"/.test(prog) && /\.destacado\[data-tipo="records"\] \{ --t: var\(--oro\); --t-barra: var\(--oro-400\); \}/.test(src('diseno.css')),
  'B89: los récords, con la cifra encima de cada barra, su semana debajo y la de ahora en dorado');
check(/\.mini-grafica rect\.resaltada \{ fill: var\(--t-barra, var\(--t, var\(--morado\)\)\); \}/.test(src('estilos.css')) && !/\.mini-grafica polyline/.test(src('estilos.css')), 'B88: las barras, del color de su tarjeta (y sin la línea vieja de 132 px)');
const com = src('ui/comunes.jsx');
check(/classList\.toggle\('hoja-bajada', e\.currentTarget\.scrollTop > 2\)/.test(com) && /\.hoja-bajada > \.hoja-cab \{ background-color: var\(--hoja\); \}/.test(sinComD) && !/\.hoja-cab \{[^}]*background: var\(--hoja\)/.test(src('visual.css')),
  'C116: la cabecera de las hojas sin banda blanca arriba del todo; con su fondo al bajar');
check((com.match(/y=\{yCifra\(/g) || []).length === 2 && /const yCifra = \(yUlt, yAnt, suelo\) =>/.test(com), 'B87: la cifra del último punto no se cruza con la línea (debajo si el anterior quedó más alto)');
check(/\.seg-rango\.seg-rango \{ justify-self: stretch; \}/.test(sinComD) && /class="fila-semana amb-con-sello"/.test(prog) && /\.fila-semana\.amb-con-sello \{ grid-template-columns: minmax\(0, 1fr\) auto; \}/.test(sinComD),
  'el rango de las gráficas a todo el ancho y el sello de «Tus semanas» dentro de su tarjeta');
check(/nombreBloque\(tituloBloque\(b\)\)/.test(src('ui/InformeBloque.jsx')) && /<strong>\{tituloVisto\(r\.bloque, coach\)\}<\/strong>/.test(src('ui/InformeBloque.jsx')), 'A13 (repaso): «Tus bloques» y su informe, sin «· FBE Esencial» para el atleta (el coach lo ve entero)');
const rut = src('ui/atleta/EsencialRutinas.jsx');
check(/<span class="peq secundario">\{desde\}<\/span>/.test(rut) && /\\u00a0· \$\{s\.semanas === 1/.test(rut), '«Tu rutina»: la fecha como texto (no como marcador) y el punto pegado a lo de antes');
check(/\.ayu-claro-t::-webkit-details-marker \{ display: none; \}/.test(sinComD) && /\.ayu-claro\[open\] > \.ayu-claro-t::after \{ rotate: 180deg; \}/.test(sinComD), 'C127: «Tu sesión, en claro» con la flecha de la app');
check(/'--verde': `\$\{enRevision \? 100 : \(paso \/ \(paso \+ 1\)\) \* 100\}%`/.test(src('ui/atleta/Checkin.jsx')) && /\.ck-barra\.ck-barra > span \{ background: linear-gradient\(var\(--oklab,\) 90deg, color-mix\(in srgb, var\(--ok\) 65%, var\(--blanco\)\), var\(--ok\) var\(--verde, 0%\), var\(--morado\) var\(--verde, 0%\)\); \}/.test(sinComD),
  'C147: el check-in, con las preguntas hechas en verde y la de ahora en morado');
check(/class="pista-cerrar" aria-label="Ahora no"/.test(src('ui/PruebaSonido.jsx')) && /\.aviso-prueba-sonido > span \{ flex: 1 1 0%; min-width: min\(100%, 9\.5rem\); \}/.test(src('belleza-a.css')), 'B54: «¿Se oye bien el sonido?» en una línea, con la X de las pistas (el lector oye «Ahora no»)');
check(/\.cll-caja > \.separa > \.btn-texto \{ flex: none; align-self: flex-start; white-space: nowrap; font-size: var\(--letra-14\); \}/.test(src('estilos.css')) && /amb-cara-\$\{c\}/.test(src('ui/atleta/ComoLlegas.jsx')) && /\.amb-cara-mal \{ color: var\(--alerta\); \}/.test(sinComD),
  'B51 y B55: el «Ahora no» de «¿Cómo llegas hoy?» en una línea y las caras con su color');
check(/document\.title = nombreApp/.test(app) && /const nombreApp = esPorSuCuenta\(atleta\) \? 'FBE Esencial' : 'FBE Equipo';/.test(app), 'C148 (en parte): la pestaña del navegador con el nombre de su app');
const { atajosValidos, alternarAtajo } = await import('../web/src/logica/perfil-mas.js');
check(atajosValidos(null).join() === 'checkin,progreso,mensajes' && atajosValidos(null, ['mensajes']).join() === 'checkin,progreso,semana' && atajosValidos(['mensajes', 'carne'], ['mensajes']).join() === 'carne'
  && alternarAtajo(['checkin'], 'mensajes', ['mensajes']).join() === 'checkin' && /const fuera = esPorSuCuenta\(atleta\) \? \['mensajes'\] : \[\];/.test(src('ui/atleta/PerfilMas.jsx')),
  'los atajos del perfil: a quien va por su cuenta no le sale «Mensajes» (en su lugar, «Tu semana»)');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
