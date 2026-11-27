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
check(/<ol class="alta-guia-pasos amb-fichas" tabIndex=\{0\} aria-labelledby="alta-guia-t">/.test(guia) && (guia.match(/<li class="amb-ficha">/g) || []).length === 3 && /<ArteMini id="esencial-ajustar-maquina" \/>/.test(guia) && !/ArteDuo/.test(guia),
  'B52: «Tu primera sesión», en tres fichas que se deslizan, también con el teclado (y las máquinas, en una fila con su miniatura)');
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
check(/\.seg-rango\.seg-rango \{ justify-self: stretch; \}/.test(sinComD) && /class=("|\{`)fila-semana amb-con-sello( amb-sem)?/.test(prog) && /\.fila-semana\.amb-con-sello \{ grid-template-columns: minmax\(0, 1fr\) auto; \}/.test(sinComD),
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

console.log('\nTercera vuelta (v0.265): letra grande, oscuro e interruptores');
const cssE = src('ambas-e.css'), sinComE = cssE.replace(/\/\*[\s\S]*?\*\//g, '');
check(!/[^\x00-\x7F]/.test(cssE) && !/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(sinComE) && main.indexOf("'./ambas-e.css'") > main.indexOf("'./ambas-d.css'") && main.indexOf("'./ambas-e.css'") < main.indexOf("'./color-capa.css'"),
  'ambas-e.css: solo ASCII, los colores por su nombre y detrás de la segunda vuelta');
check(/\.nota-coach \.btn svg \{ color: inherit; margin-top: 0; \}/.test(src('estilos.css')), 'los iconos de los botones dentro de las notas, del color de su botón (antes, morado sobre morado en «Hacer «Día 1»»)');
check(/:root\[data-letra\] \.pestanas-progreso \{[^}]*grid-auto-flow: column;[^}]*overflow-x: auto;/.test(sinComE) && /\.cifra-objetivo-v\.cifra-objetivo-v \{ display: flex; align-items: baseline;/.test(sinComE),
  'C108: con la letra grande, las pestañas de Progreso no se pisan y la cifra de tu objetivo lleva su texto al lado');
check(/Vas por el \{pct\} % del camino/.test(src('ui/atleta/Personal.jsx')), 'B82: el camino a tu meta, dicho con palabras');
check(/:root\[data-theme="dark"\] img\[data-imagen\] \{ outline: var\(--filo-fino\) solid var\(--vidrio-brillo\);/.test(sinComE) && /prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\) img\[data-imagen\]/.test(sinComE),
  'C106: en oscuro, las ilustraciones con su filo de luz (en el oscuro del sistema y en el elegido)');
check(/\.interruptor\.interruptor \{\s*background-image: radial-gradient\(/.test(sinComE) && /\.interruptor\.interruptor:checked \{\s*background-image: linear-gradient\(var\(--sobre-morado\), var\(--sobre-morado\)\);/.test(sinComE) && !/\.interruptor[^{]*::before/.test(sinComE),
  'C132: los interruptores con su forma (aro apagado, raya encendido), en su fondo y sin pseudo-elementos nuevos');
check(/clase="amb-seg-pila"/.test(src('ui/Ajustes.jsx')) && /\.amb-seg-pila > button \{ display: flex; flex-direction: column;/.test(sinComE), 'el tema, cada opción con su icono encima de su nombre');
check(/\{toast\.tipo !== 'record' && toast\.tipo !== 'error' && <Icono n="hecho" \/>\}/.test(src('ui/App.jsx')), 'C124: los avisos de un momento con su icono (✓; el error y el récord, con el suyo)');

console.log('\nCuarta vuelta (v0.266): lo que quedaba de las tandas B y C');
const cssF = src('ambas-f.css'), sinComF = cssF.replace(/\/\*[\s\S]*?\*\//g, '');
check(!/[^\x00-\x7F]/.test(cssF) && !/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(sinComF) && main.indexOf("'./ambas-f.css'") > main.indexOf("'./ambas-e.css'") && main.indexOf("'./ambas-f.css'") < main.indexOf("'./color-capa.css'"),
  'ambas-f.css: solo ASCII, los colores por su nombre y detrás de la tercera vuelta');
check(/<ul class="lista-marcas amb-marcas( mrc-vitrina)?">/.test(src('ui/atleta/Esencial.jsx')) && /<strong class="num amb-marca-v( mrc-cifra)?">\{m\.texto\}<\/strong>/.test(src('ui/atleta/Esencial.jsx'))
  && /\.amb-marca-v \{ font-size: var\(--letra-19\); white-space: nowrap;/.test(sinComF) && /\.amb-marca \{ flex: 1 1 calc\(50% - var\(--esp-4\)\); min-width: 0;/.test(sinComF) && !/grid-column/.test(sinComF),
  'B96: tus marcas, cada una en su ficha con la cifra grande (sin partirse) y el ejercicio debajo');
const sem = src('ui/atleta/Semana.jsx');
check(/<div class="amb-viene" role="note">/.test(sem) && /semana\.id === p\.actual\?\.id && !posterior && sesiones\.length > 0 && !propio &&/.test(sem)
  && /'La prepara la app con lo que apuntes esta semana\.' : 'La prepara tu coach\.'/.test(sem) && /\.amb-viene \{[^}]*border: var\(--filo-medio\) dashed var\(--linea\);/.test(sinComF),
  'B80: la semana que viene, en gris mientras no está, con quién la prepara (la app o tu coach)');
const TRES_ICO = "[[2, 'Sí', 'hecho'], [1, 'Casi', 'menos'], [0, 'No', 'cerrar']]";
check(src('ui/atleta/Nutricion.jsx').includes(TRES_ICO) && src('ui/atleta/EsencialComida.jsx').includes(TRES_ICO)
  && (src('ui/atleta/Nutricion.jsx') + src('ui/atleta/EsencialComida.jsx')).split('<Icono n={ico} />{t}</button>').length === 3
  && /\.si-casi-no \.btn \{ min-height: 48px; border-radius: var\(--r-pildora\); gap: var\(--esp-6\); \}/.test(src('estilos.css')),
  'B100: «¿Has seguido tu plan?», las tres opciones en cápsula y con su icono (la forma además del color), en las dos apps');

console.log('\n151-200, primera vuelta (v0.267): la sesión y el final');
const cssG = src('ambas-g.css'), sinComG = cssG.replace(/\/\*[\s\S]*?\*\//g, '');
check(!/[^\x00-\x7F]/.test(cssG) && !/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(sinComG) && main.indexOf("'./ambas-g.css'") > main.indexOf("'./ambas-f.css'") && main.indexOf("'./ambas-g.css'") < main.indexOf("'./color-capa.css'"),
  'ambas-g.css: solo ASCII, los colores por su nombre y detrás de la cuarta vuelta');
const ses = src('ui/atleta/Sesion.jsx');
check(/const quedanMin = !sesion\.completada && quedanSeries > 0 \? Math\.max\(5, duracionEstimada\(ejercicios, pendientesSes\)\) : null;/.test(ses) && /\{queda != null && <div class="queda-min">faltan unos \{queda\} min<\/div>\}/.test(ses),
  '151: lo que te queda junto al crono, con la misma cuenta que el modo enfoque (y nada si ya no quedan series)');
const tuya = src('ui/atleta/SesionTuya.jsx');
check(/class="calent-paso" aria-pressed=\{hechos\.includes\(i\) \? 'true' : 'false'\}/.test(tuya) && /Calentamiento hecho/.test(tuya) && /setTimeout\(\(\) => setAbierto\(false\), 450\)/.test(tuya)
  && /sessionStorage\.setItem\(k, JSON\.stringify\(nuevos\)\)/.test(tuya) && /<Calentamiento clave=\{sesion\.id\}/.test(src('ui/atleta/Portada.jsx')),
  '159: el calentamiento, con una casilla por paso; con todos, se pliega y dice «Calentamiento hecho» (en esta pestaña, solo los números de los pasos)');
const { compararConAnterior: cca, textoComparacion: tc } = await import('../web/src/logica/visual.js');
const { textoComparacionHecho, imagenCierre, siguienteTras } = await import('../web/src/logica/sesion-final.js');
const cBaja = cca({ id: 'b', nombre: 'Torso A', fecha: '2026-11-20', tonelaje: 3200, series: 15 }, [{ id: 'a', nombre: 'Torso A', fecha: '2026-11-13', tonelaje: 3450, series: 16 }]);
check(cBaja?.tonelaje === -250 && cBaja.hoy === 3200 && cBaja.antes === 3450 && textoComparacionHecho(cBaja) === '3200 kg de tonelaje hoy' && tc(cBaja) === '250 kg menos de tonelaje que la última vez',
  '162: con menos tonelaje que la última vez, lo que has hecho («3200 kg de tonelaje hoy») y las dos cifras para el paréntesis');
check(/comparacion && comparacion\.tonelaje < 0 \? <><Icono n="hecho" \/>/.test(ses) && !/'abajo'/.test(ses.slice(ses.indexOf('resumen-compara'), ses.indexOf('resumen-compara') + 1600)) && !/resumen-compara\.baja/.test(src('diseno.css')),
  '162: y sin la flecha azul de bajada (un ✓ y el color de siempre)');
const cierres = Array.from({ length: 20 }, (_, i) => imagenCierre('pierna', null, `s-${i}`, () => true));
check(imagenCierre('cardio', 'cuerda') === 'fin-comba' && imagenCierre('cardio', 'carrera') === 'fin-carrera' && imagenCierre('cardio', 'otro') === 'fin-cardio' && imagenCierre('movilidad') === 'fin-movilidad'
  && imagenCierre(null) === null && imagenCierre('rara') === null && new Set(cierres).size === 2 && cierres.every((x) => /^fin-pierna(-2)?$/.test(x)) && imagenCierre('pierna', null, 's-3', () => true) === imagenCierre('pierna', null, 's-3', () => true)
  && Array.from({ length: 20 }, (_, i) => imagenCierre('pierna', null, `s-${i}`)).every((x) => x === 'fin-pierna'),
  '164: el final de cada sesión, por familia (dos en las de fuerza, siempre la misma para cada sesión) y por modalidad de cardio');
check(/const fondoFin = hayImagen\(cierre\) \? cierre : imagenPortada\(familia, modFin, sesion\?\.id\);/.test(ses) && !/`fin-\$\{|'fin-' \+/.test(src('logica/sesion-final.js')),
  '164: si el final aún no está, el resumen sigue con la portada (y los nombres van enteros, sin «fin-» armado a trozos)');

{
  const sem = { id: 'w1', fecha_inicio: '2026-11-23' };
  const prog = { actual: sem, sesiones: { w1: [{ id: 'a', nombre: 'Día 1', orden: 1, completada: true }, { id: 'b', nombre: 'Día 2', orden: 2, completada: false, dia_previsto: '2026-11-26' }, { id: 'c', nombre: 'Día 3', orden: 3, completada: false, dia_previsto: '2026-11-28' }] } };
  const tras = siguienteTras(prog, 'b', { hoy: '2026-11-26' });
  const ultima = siguienteTras({ actual: sem, sesiones: { w1: [{ id: 'a', nombre: 'Día 1', completada: true }, { id: 'b', nombre: 'Día 2', completada: false }] } }, 'b', { hoy: '2026-11-26' });
  check(tras?.nombre === 'Día 3' && tras.dia === '2026-11-28' && ultima?.ultima === true && siguienteTras(null, 'b') === null && siguienteTras({ actual: sem, sesiones: { w1: [{ id: 'b' }] } }, 'b') === null
    && siguienteTras(prog, 'b', { hoy: '2026-11-26', excluir: (x) => x.id === 'c' })?.ultima === true,
    '166: tras cerrar una sesión, la siguiente de la semana con su día (sin contar la recién hecha), o que era la última');
  check(/Lo siguiente: <strong>\{sigue\.nombre\}<\/strong>\{sigue\.dia \? `, \$\{cuandoDia\(sigue\.dia\)\}` : ''\}/.test(ses) && /Era la última de esta semana\./.test(ses) && /programa=\{programa\.datos\}/.test(src('ui/atleta/AtletaApp.jsx')), '166: y sale bajo «Volver a hoy» como en Hoy («mañana», «el jueves»), con el programa que ya tiene la app (sin pedir nada más)');
}

check(/class=\{`ahora-nombre\$\{a\.imagen && hayImagen\(a\.imagen\) \? ' ahora-con-mini' : ''\}`\}/.test(src('ui/atleta/sesion-comun.jsx')) && /imagen: otro \? imagenDe\(se\) \|\| null : null,/.test(src('logica/ahora-toca.js'))
  && /imagenDe: \(x\) => imagenEjercicio\(actualDe\(x\)\)/.test(ses), '152: en el descanso, «Siguiente ejercicio» con su miniatura (la pauta ya iba debajo)');
{
  const { ahoraToca } = await import('../web/src/logica/ahora-toca.js');
  const ejs = [{ id: 'p1', series: 1, ejercicio: { nombre: 'Prensa' } }, { id: 'p2', series: 2, ejercicio: { nombre: 'Remo' } }];
  const otro = ahoraToca({ ejercicios: ejs, hechas: { p1: { 1: { reps: 10 } } }, tras: 'p1', imagenDe: (x) => `img-${x.id}` });
  const mismo = ahoraToca({ ejercicios: ejs, hechas: { p1: { 1: { reps: 10 } }, p2: { 1: { reps: 8 } } }, tras: 'p2', imagenDe: (x) => `img-${x.id}` });
  check(otro?.otroEjercicio && otro.imagen === 'img-p2' && mismo && !mismo.otroEjercicio && mismo.imagen === null, '152: la miniatura solo cuando lo que viene es otro ejercicio');
}
const VACIOS = [['ui/Chat.jsx', 'vacio-mensajes'], ['ui/atleta/Comidas.jsx', 'vacio-recetas'], ['ui/Guias.jsx', 'vacio-guias'], ['ui/atleta/Progreso.jsx', 'vacio-progreso'], ['ui/atleta/Progreso.jsx', 'vacio-records'],
  ['ui/atleta/PerfilSocial.jsx', 'vacio-entrenos'], ['ui/atleta/TuBloque.jsx', 'vacio-espera'], ['ui/atleta/Semana.jsx', 'vacio-espera'], ['ui/Diario.jsx', 'vacio-diario'], ['ui/Tareas.jsx', 'vacio-tareas'],
  ['ui/Comunidad.jsx', 'vacio-preguntas'], ['ui/coach/Revisar.jsx', 'coach-al-dia'], ['ui/coach/Ficha.jsx', 'coach-checkins'], ['ui/coach/Ficha.jsx', 'coach-objetivos'], ['ui/coach/HabitosCoach.jsx', 'coach-habitos'], ['ui/coach/NutricionCoach.jsx', 'coach-nutricion']];
check(VACIOS.every(([f, id]) => new RegExp(`<Vacio [^>]*ilustracion="[a-z]+" imagen="${id}"`).test(src(f))),
  '195 (preparado): los vacíos de las dos apps y los del panel, con el hueco de su imagen nueva (mientras no llega, el dibujo de siempre)');
const appj = src('ui/App.jsx');
check(/<AvisoVersion nombre=\{estado\.fase === 'atleta' && esPorSuCuenta\(estado\.atleta\) \? 'FBE Esencial' : 'FBE Equipo'\} \/>/.test(appj) && /Hay una versión nueva de \{nombre\}\./.test(appj)
  && /<Imagen id="estado-error" clase="paso-foto"[^>]*alternativa=\{<Ilustracion n="fallo"/.test(appj),
  '193: «Hay una versión nueva» con el nombre de su app, y el hueco de la ilustración del error al abrir');

console.log('\n151-200, segunda vuelta (v0.268): Hoy, Semana y Progreso');
const cssH = src('ambas-h.css'), sinComH = cssH.replace(/\/\*[\s\S]*?\*\//g, '');
check(!/[^\x00-\x7F]/.test(cssH) && !/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(sinComH) && main.indexOf("'./ambas-h.css'") > main.indexOf("'./ambas-g.css'") && main.indexOf("'./ambas-h.css'") < main.indexOf("'./color-capa.css'"),
  'ambas-h.css: solo ASCII, los colores por su nombre y detrás de la primera vuelta de 151-200');
check(/\.tu-dia \.fila-dia:not\(#n\) \{ background-image: linear-gradient\(var\(--linea\), var\(--linea\)\);/.test(sinComH) && /\.tu-dia li:first-child > \.fila-dia \{ --hy: 100%; --hh: 50%; \}/.test(sinComH)
  && !/\.tu-dia \.lista > li \+ li::before/.test(src('diseno.css')), '168: «Tu día» como línea de tiempo (los discos unidos por un hilo, sin las rayas entre filas)');
check(/class=\{`fila-semana amb-con-sello amb-sem\$\{comparando \? ' csm-fila' : ''\}`\} data-c=\{r\.sesiones\.total > 0 && r\.sesiones\.hechas >= r\.sesiones\.total \? 'completa' : r\.sesiones\.hechas > 0 \? 'media' : 'pausa'\}/.test(src('ui/atleta/Progreso.jsx'))
  && /\.amb-sem\[data-c="completa"\] \{ --amb-c: var\(--ok\); \}/.test(sinComH), '179: cada semana con el color de su constancia en el borde (completa, a medias, sin sesiones)');
const meses = src('ui/atleta/TusMeses.jsx');
check(/'con-mini amb-mes' : ''/.test(meses) && /<i class="amb-mes-velo" aria-hidden="true" \/>/.test(meses) && !/export function TusMeses/.test(src('ui/atleta/TuMes.jsx'))
  && /from '\.\/TusMeses\.jsx'/.test(src('ui/atleta/Progreso.jsx')) && /from '\.\.\/atleta\/TusMeses\.jsx'/.test(src('ui/coach/Ficha.jsx')),
  '180: «Tus meses» con su paisaje a sangre (y aparte de TuMes.jsx, que sale al abrir, para que sus estilos vayan con su trozo)');
check(/const planHecho = sesiones\.length > 0 && sesiones\.every\(\(s\) => s\.completada \|\| diaPrevistoValido\(s, semana\)\);/.test(src('ui/atleta/Plan.jsx')) && /\{planHecho && !delDia\.length && <i class="tira-descanso" aria-hidden="true" \/>\}/.test(src('ui/atleta/Plan.jsx')),
  '183: en la tira de la semana, los días de descanso con su aro (solo con todos los días puestos)');

{
  const { serieCifras } = await import('../web/src/logica/progreso-visual-2.js');
  const sem = (lunes, hechas, total, series, records, dias) => ({ lunes, sesiones: { hechas, total }, series, records: Array(records).fill({}), dias: Array(dias).fill('x') });
  const sc = serieCifras([sem('2026-11-16', 2, 2, 24, 3, 2), sem('2026-11-02', 1, 2, 10, 0, 1), sem('2026-11-23', 0, 2, 0, 0, 0), sem('2026-11-09', 2, 2, 20, 1, 2), sem('2026-09-21', 2, 2, 5, 5, 2)], '2026-11-27');
  check(sc.llama.join() === '0,1,1' && sc.hoy.join() === '10,20,24' && sc.trofeo.join() === '0,1,3' && sc.calendario.join() === '1,2,2',
    '178: las 8 semanas acabadas de cada cifra, de la más antigua a la última (sin la de ahora ni las de hace más de 8)');
  check(/<rect key=\{i\} x=\{\(8 - w\.length \+ i\) \* 3\}/.test(src('ui/atleta/Progreso.jsx')) && /\.amb-mini:not\(#n\) rect:last-child \{ fill: var\(--t, var\(--morado\)\); \}/.test(sinComH),
    '178: detrás de cada cifra, sus barritas (siempre en el sitio de 8, pegadas a la derecha; la última, en su color)');
}
check(['ui/RecetarioEquipo.jsx', 'ui/ComidasComun.jsx'].every((f) => /<span class="chip amb-prot num"><b>\{num\(m\.proteina_g, 0\)\} g<\/b>prot\.<\/span>/.test(src(f))),
  '186 y B99: en las tarjetas de recetas, la proteína en su pastilla (y fuera de la línea de macros)');

console.log('\n151-200, tercera vuelta (v0.269): el mapa de músculos, el vaso de proteína, el carné y los vacíos con imagen');
const cssI = src('ambas-i.css'), sinComI = cssI.replace(/\/\*[\s\S]*?\*\//g, '');
check(!/[^\x00-\x7F]/.test(cssI) && !/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(sinComI) && main.indexOf("'./ambas-i.css'") > main.indexOf("'./ambas-h.css'") && main.indexOf("'./ambas-i.css'") < main.indexOf("'./color-capa.css'"),
  'ambas-i.css: solo ASCII, los colores por su nombre y detrás de la segunda vuelta de 151-200');
const mapa = src('ui/MapaMuscular.jsx');
check(/const dg = `mm\$\{useId\(\)\}`;/.test(mapa) && /<stop offset="0" class="mm-a" \/>/.test(mapa) && /<stop offset="1" class="mm-b" \/>/.test(mapa)
  && /deg\('n', '--hoja-2'\)\}\{\[0, 1, 2, 3, 4\]\.map\(\(n\) => deg\(n, `--mm-\$\{n\}`\)\)/.test(mapa) && /style=\{`fill:url\(#\$\{dg\}-\$\{nivel\(series\[g\]\)\}\)`\}/.test(mapa)
  && /\.mapa-muscular \.mm-a:not\(#n\) \{ stop-color: color-mix\(in srgb, var\(--c\) var\(--mm-k, 72%\), var\(--blanco\)\); \}/.test(sinComI) && (src('belleza-a.css').match(/--mm-k: 88%;/g) || []).length === 2
  && /\.mapa-muscular\.mapa-oro:not\(#n\) \{ --mm-4: var\(--oro-400\); \}/.test(sinComI),
  '163: el mapa de músculos con relieve (cada parte con su degradado, con ids propios de cada mapa; en oscuro, más suave; el de récords, en dorado)');
const nutri = src('ui/NutricionComun.jsx');
check(/const VASO = 'M15 8 H49 L44\.5 54 Q44 58 40 58 H24 Q20 58 19\.5 54 Z';/.test(nutri) && /<svg viewBox="0 0 64 64" aria-hidden="true" class="amb-vaso">/.test(nutri) && /x\.valor != null && f > 0 && <path d=\{liquido\(f\)\}/.test(nutri),
  '187: la proteína del día como un vaso que se llena (el resto de macros, con su aro)');
{
  const m = nutri.match(/const liquido = \(f\) => \{([^\n]*)\};/);
  const liquido = m && new Function('f', m[1]);
  const y = (f) => Number(liquido(f).match(/^M[\d.]+ ([\d.-]+)/)[1]);
  check(!!liquido && y(0) === 58 && y(1) === 8 && y(0.5) === 33 && /^M15 8 H49 /.test(liquido(1)), '187: el nivel del vaso, de abajo (nada) a arriba (el objetivo), con los lados del vaso');
}
const carne = src('ui/atleta/Carnet.jsx');
check(/const conPermisoOrientacion = \(\) => typeof window !== 'undefined' && typeof window\.DeviceOrientationEvent\?\.requestPermission === 'function';/.test(carne)
  && /requestPermission\(\)\.then\(\(r\) => setConMovil\(r === 'granted'\)\)/.test(carne) && /\{conPermisoOrientacion\(\) && !conMovil && !sinMovimiento\(\) && <button type="button" class="btn-texto mini carnet-movil"/.test(carne)
  && /if \(\(sinPermisoOrientacion\(\) \|\| conMovil\) && typeof IntersectionObserver !== 'undefined'\)/.test(carne) && /\}, \[conMovil\]\);/.test(carne),
  '192: en iPhone, el carné se mueve al inclinar el móvil solo si lo pides con su botón (y nunca con «reducir movimiento»)');
{
  const { existsSync } = await import('node:fs');
  const lista = JSON.parse(src('datos/imagenes.json'));
  const nuevas = ['vacio-entrenos', 'vacio-records', 'vacio-mensajes', 'vacio-progreso', 'vacio-guias', 'vacio-diario', 'vacio-tareas', 'vacio-preguntas', 'vacio-espera'];
  check(nuevas.every((id) => lista[id]?.proporcion?.join() === '1,1' && Object.keys(lista[id].archivos).join() === '240,360' && /^#[0-9a-f]{6}$/.test(lista[id].color)
    && Object.values(lista[id].archivos).every((f) => existsSync(new URL(`../web/${f}`, import.meta.url)))),
    '195: los vacíos con su imagen nueva (cuadrada, en 240 y 360, con su color mientras carga y sus archivos)');
  const { readdirSync } = await import('node:fs');
  const todo = readdirSync(new URL('../web/src/ui/', import.meta.url), { recursive: true }).filter((f) => f.endsWith('.jsx')).map((f) => src(`ui/${f}`)).join('\n');
  check([...nuevas, 'vacio-recetas'].every((id) => todo.includes(`imagen="${id}"`)) && lista['vacio-recetas']?.proporcion?.join() === '1,1', '195: cada imagen nueva, en su vacío (las diez del bloque 1)');
  const trozos = JSON.parse(src('datos/imagenes-trozos.json'));
  const { PORTADAS_IMG, imagenPortadaPerfil } = await import('../web/src/logica/perfil.js');
  check(PORTADAS_IMG.length === 8 && PORTADAS_IMG.every(([id]) => trozos[id]?.proporcion?.join() === '3,1' && Object.keys(trozos[id].archivos).join() === '480,960,1440' && !lista[id])
    && imagenPortadaPerfil('perfil-mar') === 'perfil-mar' && imagenPortadaPerfil('bosque') === null && imagenPortadaPerfil(undefined) === null
    && !PORTADAS_IMG.some(([, t]) => /^(Noche|Aurora|Atardecer|Bosque|Océano)$/.test(t)),
    '189: las ocho portadas ilustradas, en la lista que viaja con el perfil (no en la del arranque), y sin repetir el nombre de un color');
  const perf = src('ui/atleta/Perfil.jsx');
  check(/import LISTA_TROZOS from '\.\.\/\.\.\/datos\/imagenes-trozos\.json';/.test(perf) && /^anadirImagenes\(LISTA_TROZOS\);$/m.test(perf)
    && /foto=\{portadaFoto\.datos \|\| \(ilu \? null : imagenSuya\) \|\| null\} imagen=\{portadaFoto\.datos \? null : ilu\}/.test(perf) && !/perfil-\$\{/.test(perf + src('logica/perfil.js')),
    '189: tu foto manda; si no, la ilustración elegida (sobre la imagen de tu coach); los id, enteros (sin armar a trozos)');
  const { imagenCierre } = await import('../web/src/logica/sesion-final.js');
  const hay = (id) => !!trozos[id];
  const fines = ['empuje', 'tiron', 'pierna', 'core', 'fullbody'].flatMap((f) => [imagenCierre(f, null, 'a', hay), imagenCierre(f, null, 'b', hay), imagenCierre(f, null, 'c', hay)])
    .concat(['carrera', 'andar', 'bici', 'eliptica', 'remo', 'nadar', 'cuerda'].map((m) => imagenCierre('cardio', m, 'a', hay)), imagenCierre('cardio', null, 'a', hay), imagenCierre('movilidad', null, 'a', hay));
  check(Object.keys(trozos).filter((id) => id.startsWith('fin-')).length === 19 && Object.keys(trozos).filter((id) => id.startsWith('fin-')).every((id) => trozos[id].proporcion.join() === '16,9' && Object.keys(trozos[id].archivos).join() === '720,1080,1440')
    && fines.every(hay) && new Set(fines.filter((id) => /^fin-(empuje|tiron|pierna|core|fullbody)/.test(id))).size === 10,
    '164: los finales de cada tipo de sesión (dos por cada familia de fuerza, que se alternan) y de cada modalidad de cardio, en 16:9 como las portadas');
  check(/import LISTA_TROZOS from '\.\.\/\.\.\/datos\/imagenes-trozos\.json';/.test(src('ui/atleta/Sesion.jsx')) && /^anadirImagenes\(LISTA_TROZOS\);$/m.test(src('ui/atleta/Sesion.jsx'))
    && /const fondoFin = hayImagen\(cierre\) \? cierre : imagenPortada\(familia, modFin, sesion\?\.id\);/.test(src('ui/atleta/Sesion.jsx')),
    '164: la sesión trae la lista de sus finales (sin ella, el resumen sigue con la portada)');
}
{
  const { cambiosQueViene: cv } = await import('../web/src/logica/semana-viene.js');
  const ss = (...n) => n.map((nombre) => ({ nombre }));
  check(cv({ actual: { foco: 'volumen' }, sesActual: ss('Torso A', 'Pierna A', 'Torso B'), siguiente: { foco: 'descarga' }, sesSiguiente: ss('Torso A', 'Pierna A') }).join(' · ') === 'Foco: descarga · 2 sesiones (una menos)'
    && cv({ actual: { foco: 'volumen' }, sesActual: ss('Torso A', 'Pierna A'), siguiente: { foco: 'volumen' }, sesSiguiente: ss('torso a ', 'Pierna A') }).join() === 'Las mismas 2 sesiones'
    && cv({ actual: {}, sesActual: ss('A'), siguiente: {}, sesSiguiente: ss('A', 'B', 'C', 'D') }).join(' · ') === '4 sesiones (3 más) · Nuevas: B, C y una más'
    && cv({ actual: {}, sesActual: ss('A'), siguiente: {}, sesSiguiente: [] }).join() === 'Aún sin sesiones' && cv({ siguiente: null }).length === 0,
    '185: la semana que viene, de un vistazo (el foco si cambia, cuántas sesiones y las nuevas)');
  const sem = src('ui/atleta/Semana.jsx');
  check(/\{semana\.id === p\.actual\?\.id && posterior && \(\s*<button type="button" class="amb-viene amb-viene-ir" onClick=\{\(\) => irA\(1\)\}>/.test(sem) && /cambiosQueViene\(\{ actual: semana, sesActual: sesiones, siguiente: posterior, sesSiguiente: sinCarreras\(p\.sesiones\[posterior\.id\] \|\| \[\]\) \}\)/.test(sem)
    && /\.amb-viene-ir:not\(#n\) \{ width: 100%; background: none; font: inherit; text-align: start; cursor: pointer; \}/.test(sinComI), '185: en Semana, la ficha en gris de la que viene, ya publicada, que se toca para verla');
  const inf = src('ui/InformeFrente.jsx');
  check(/const FrenteBloques = perezoso\(\(\) => import\('\.\/InformeFrente\.jsx'\), 'FrenteBloques', \{ mientras: null \}\);/.test(src('ui/InformeBloque.jsx')) && /\{ant && <FrenteBloques r=\{r\} ant=\{ant\} \/>\}/.test(src('ui/InformeBloque.jsx'))
    && /<h3>Este bloque y el anterior<\/h3>/.test(inf) && /<table class="amb-frente">/.test(inf) && /<th scope="col">Este bloque<\/th><th scope="col">\{ant\.numero \? `Bloque \$\{ant\.numero\}` : 'El anterior'\}<\/th>/.test(inf)
    && /<th scope="row">Sesiones<\/th><td class="num">\{r\.sesiones\.hechas\}<\/td><td class="num">\{ant\.sesiones \?\? '—'\}<\/td>/.test(inf) && !/r\.peso|salud/.test(inf.slice(inf.indexOf('<table class="amb-frente">'), inf.indexOf('</table>'))),
    '177: el informe del bloque con este bloque y el anterior en dos columnas (sin el peso corporal)');
}

console.log('\n151-200, cuarta vuelta (v0.270): el podio de un récord y tocar un punto de una gráfica');
const cssJ = src('ambas-j.css'), sinComJ = cssJ.replace(/\/\*[\s\S]*?\*\//g, '');
check(!/[^\x00-\x7F]/.test(cssJ) && !/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(sinComJ) && main.indexOf("'./ambas-j.css'") > main.indexOf("'./ambas-i.css'") && main.indexOf("'./ambas-j.css'") < main.indexOf("'./color-capa.css'"),
  'ambas-j.css: solo ASCII, los colores por su nombre y detrás de la tercera vuelta de 151-200');
{
  const { podioRecords } = await import('../web/src/logica/progreso-visual-2.js');
  const pts = [{ x: '2026-10-01', y: 60 }, { x: '2026-10-08', y: 62.5 }, { x: '2026-10-15', y: 65 }, { x: '2026-10-22', y: 70 }];
  const pod = podioRecords(pts);
  check(pod.map((x) => `${x.puesto}:${x.valor}:${x.fecha}`).join() === 'oro:70:2026-10-22,plata:65:2026-10-15,bronce:62.5:2026-10-08' && podioRecords(pts.slice(0, 2)).length === 2 && podioRecords([]).length === 0 && podioRecords(null).length === 0,
    '176: el podio, con las tres últimas marcas del récord (cada una supera a la anterior), la mejor primero');
  const piezas = src('ui/atleta/ProgresoPiezas2.jsx');
  check(/const MEDALLA = \{ oro: 'medalla-records-oro', plata: 'medalla-records-plata', bronce: 'medalla-records-bronce' \};/.test(piezas) && /<li key=\{x\.puesto\} data-m=\{x\.puesto\}>/.test(piezas)
    && /\.amb-podio:not\(#n\) > li\[data-m="plata"\] \{ order: -1;/.test(sinComJ) && /clip-path: circle\(47% at 50% 50%\)/.test(sinComJ) && /<PodioRecords puntos=\{d\.puntos\} unidad=\{d\.unidad\} \/>/.test(src('ui/atleta/Progreso.jsx')),
    '176: en la hoja de un récord, el podio con las medallas de la app (en la lista, de la mejor a la tercera; a la vista, la plata a la izquierda)');
  const com = src('ui/comunes.jsx'), prog = src('ui/atleta/Progreso.jsx');
  check(/onPointerUp: \(e\) => \{ eventos\.onPointerUp\(e\); setFijo\(raspado\.ultimo\.current\); \}/.test(com) && /\{puedeAbrir\(fijo\) && <button type="button" class="btn-texto mini" onPointerDown=\{\(e\) => e\.preventDefault\(\)\} onClick=\{\(\) => alAbrir\(fijo\)\}>/.test(com)
    && /if \(e\.key === 'Enter' && puedeAbrir\(sel \?\? n - 1\)\)/.test(com) && /abrible: \(i\) => !!pts\[i\] && pts\[i\]\.x < lunesDe\(hoy\)/.test(prog) && /\{semanaVer && <HojaSemanaGrafica atletaId=\{atletaId\} lunes=\{semanaVer\}/.test(prog),
    '181: tocar un punto de una gráfica semanal deja su botón «Ver la semana del…» (con Intro desde el teclado) y abre la historia de esa semana');
  const { cifrasHistoriaSesion } = await import('../web/src/logica/sesion-final.js');
  check(cifrasHistoriaSesion({ series: 12, tonelaje: 4706, minutos: 52 }).map((c) => `${c.v} ${c.t}`).join(' · ') === '12 series · 4,7 toneladas · 52 minutos'
    && cifrasHistoriaSesion({ series: 1, tonelaje: 0 }).map((c) => `${c.v} ${c.t}`).join() === '1 serie'
    && cifrasHistoriaSesion({ series: 0, cardio: { modalidad: 'carrera', minutos: 30, km: 5.2 } }).map((c) => `${c.v} ${c.t}`).join(' · ') === '30 min de carrera · 5,2 km',
    '161: las cifras de la primera tarjeta de la historia, como las del resumen (fuerza o cardio)');
  const ses = src('ui/atleta/Sesion.jsx'), hs = src('ui/atleta/HistoriaSesion.jsx');
  check(/if \(conEscena\) \{ setEscena\(\{ records: res\.records\?\.length \|\| 0, semana: await semanaHecha \}\); setHistoria\(hayHistoriaSesion\(\) && /.test(ses) && /navigator\.webdriver && !leer\('fbe-probar-historia'\)/.test(hs) && /\{historia && !escena && <HistoriaSesion resumen=\{resumen\} nombre=\{sesion\?\.nombre\} alCerrar=\{\(\) => setHistoria\(false\)\} \/>\}/.test(ses)
    && /const FONDO = \{ hecho: 'historia-hecho', records: 'historia-records', musculos: 'historia-musculos' \};/.test(hs) && /class="historia historia-sesion" role="dialog" aria-modal="true"/.test(hs) && /Ver el resumen/.test(hs),
    '161: el final como historia de tres tarjetas (lo hecho, los récords si los hay y los músculos), detrás de la escena y solo cuando esta sale; con la ✕ o «Ver el resumen», al resumen');
}

{
  // Las últimas 17 de las 52 imágenes de 151-200: la historia, las cabeceras de Progreso, los avisos, el panel y dos finales
  const { existsSync } = await import('node:fs');
  const lista = JSON.parse(src('datos/imagenes.json')), trozos = JSON.parse(src('datos/imagenes-trozos.json'));
  const forma = (l, ids, prop, anchos) => ids.every((id) => l[id]?.proporcion?.join() === prop && Object.keys(l[id].archivos).join() === anchos && /^#[0-9a-f]{6}$/.test(l[id].color)
    && Object.values(l[id].archivos).every((f) => existsSync(new URL(`../web/${f}`, import.meta.url))));
  const historia = ['historia-hecho', 'historia-records', 'historia-musculos'], cabs = ['progreso-resumen', 'progreso-fuerza', 'progreso-cuerpo', 'progreso-logros'];
  const coach = ['coach-al-dia', 'coach-checkins', 'coach-objetivos', 'coach-habitos', 'coach-nutricion'];
  check(forma(trozos, historia, '2,3', '480,720,1024') && forma(trozos, cabs, '5,2', '720,1080,1440') && forma(trozos, coach, '1,1', '240,360') && forma(trozos, ['fin-movilidad', 'fin-andar'], '16,9', '720,1080,1440')
    && [...historia, ...cabs, ...coach].every((id) => !lista[id]), '161, 175 y el panel: sus imágenes, en la lista que viaja con sus pantallas (no en la del arranque)');
  check(forma(lista, ['estado-version-nueva', 'estado-instalar'], '1,1', '240,360') && forma(lista, ['estado-error'], '16,9', '480,720,1080'),
    '193: las de los avisos, en la lista del arranque (salen nada más abrir); la del error, en 16:9 como la de sin conexión');
  const cap = src('ui/coach/CoachApp.jsx'), coachSrc = ['Revisar', 'Ficha', 'NutricionCoach', 'HabitosCoach'].map((f) => src(`ui/coach/${f}.jsx`)).join('\n');
  check(/import LISTA_TROZOS from '\.\.\/\.\.\/datos\/imagenes-trozos\.json';/.test(cap) && /^anadirImagenes\(LISTA_TROZOS\);$/m.test(cap) && coach.every((id) => coachSrc.includes(`imagen="${id}"`)),
    'el panel de coach trae la lista de sus vacíos ilustrados (Revisar, la ficha, nutrición y hábitos)');
  const app = src('ui/App.jsx'), hoy = src('ui/atleta/Hoy.jsx'), cssJ2 = src('ambas-j.css').replace(/\/\*[\s\S]*?\*\//g, '');
  check(/const conImg = hayImagen\('estado-version-nueva'\);/.test(app) && /<Imagen id="estado-version-nueva" clase="amb-aviso-img" tamanos="36px" alternativa=\{lobo\} \/> : lobo\}/.test(app)
    && /<Imagen id="estado-instalar" clase="amb-instalar-img" tamanos="72px" alternativa=\{<Icono n="movil" \/>\} \/> : <Icono n="movil" \/>\}/.test(hoy)
    && /\.amb-aviso-img \{ width: 36px; height: 36px; flex: none; border-radius: 50%;/.test(cssJ2) && /\.aviso-instalar\.amb-con-img \{ grid-template-columns: 72px minmax\(0, 1fr\);/.test(cssJ2)
    && /<Imagen id="estado-error" clase="paso-foto"/.test(app), '193: la versión nueva con sus zapatillas en el círculo de la píldora, «Ponla en tu pantalla de inicio» con el móvil en la mesilla y el error al abrir con su barra');
  check(/@media \(min-width: 460px\) \{\s*\.amb-cab-prog-img:not\(#n\) \{ left: auto; width: auto; max-width: 100%;/.test(cssJ2)
    && /\.historia-sesion\[data-p="musculos"\]:not\(#n\) \.historia-fondo \{ -webkit-mask-image: linear-gradient\(var\(--oklab,\) 180deg, transparent 12%, var\(--tinta\) 34%\);/.test(cssJ2)
    && /\.hs-cifras:not\(#n\) \.historia-cifra \{ font-size: var\(--cifra-xl\); \}/.test(cssJ2),
    '175 y 161 con sus imágenes: en pantallas anchas la cabecera lleva la escena entera a la derecha; en la tarjeta de los músculos la luz se funde arriba, donde va el texto');
  const todas = ['entrenos', 'records', 'mensajes', 'progreso', 'guias', 'diario', 'tareas', 'preguntas', 'espera', 'recetas'].map((v) => `vacio-${v}`)
    .concat(Object.keys(trozos).filter((id) => /^(perfil|fin)-/.test(id)), historia, cabs, coach, ['estado-version-nueva', 'estado-error', 'estado-instalar']);
  check(todas.length === 52 && new Set(todas).size === 52 && todas.every((id) => lista[id] || trozos[id]), 'las 52 imágenes de 151-200, todas en su sitio');
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
