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
check(/<ul class="lista-marcas amb-marcas">/.test(src('ui/atleta/Esencial.jsx')) && /<strong class="num amb-marca-v">\{m\.texto\}<\/strong>/.test(src('ui/atleta/Esencial.jsx'))
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
  check(/Lo siguiente: <strong>\{sigue\.nombre\}<\/strong>/.test(ses) && /Era la última de esta semana\./.test(ses) && /programa=\{programa\.datos\}/.test(src('ui/atleta/AtletaApp.jsx')), '166: y sale bajo «Volver a hoy», con el programa que ya tiene la app (sin pedir nada más)');
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

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
