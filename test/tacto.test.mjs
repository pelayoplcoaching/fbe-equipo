// (v0.271) Tacto (201-250), primera vuelta (lista en «claude/belleza-350-propuesta.md»): la regla de los kilos, de las
// repeticiones y de tu peso (201-203), las escalas que se arrastran (204), el modo cartel, la luz del borde y la pastilla
// que cambia de forma (207-209) y las historias con las manos (226-228). Lo que se puede comprobar sin pantalla: las
// cuentas de cada cosa, que cada pieza está puesta en su sitio y que la hoja de estilos sigue las reglas del sistema.
//   node test/tacto.test.mjs
import { readFileSync } from 'node:fs';
import { REGLA_ANCHO, REGLA_MEDIA, reglaMayor, reglaTopes, reglaIndice, reglaValor, reglaVentana, reglaAlBorde, zonaReps } from '../web/src/logica/regla.js';
import { LUZ_SEG, luzBorde, serieCorta, HECHA_MS, formaPastilla, cartelDe, esTumbado } from '../web/src/logica/descanso-vista.js';
import { PAUSA_MS, decidirGesto, cierraAlBajar, destinoLado, gomaLado } from '../web/src/logica/historia-gesto.js';
import { cifraIngrediente, trozosDePaso, tiemposDePaso, textoReloj, textoDuracion, tengoDe, tengoCon, quedaDe } from '../web/src/logica/cocina.js';
import { atajosDe, LARGO_MS } from '../web/src/logica/barra-atajos.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const src = (r) => readFileSync(new URL(`../web/src/${r}`, import.meta.url), 'utf8');

console.log('La regla (201-203): las marcas');
check(reglaMayor(2.5) === 4 && reglaMayor(1.25) === 4 && reglaMayor(1) === 5 && reglaMayor(2) === 5 && reglaMayor(5) === 4 && reglaMayor(4) === 5 && reglaMayor(0.5) === 4,
  'un número cada cifra redonda: cada 10 kg con saltos de 2,5; cada 5 con saltos de 1 o de 1,25; cada 10 con saltos de 2; cada 20 con saltos de 5 o de 4');
check(reglaMayor(0) === 5 && reglaMayor(null) === 5 && reglaMayor(-1) === 5, 'sin salto (o con uno imposible), cada 5');
check(reglaIndice(85, 2.5) === 34 && reglaValor(34, 2.5) === 85 && reglaIndice(41, 2.5) === 16 && reglaValor(16, 2.5) === 40 && reglaIndice(43.8, 2.5) === 18,
  'un valor cae en su marca; uno que no cae en ninguna (41 kg con saltos de 2,5), en la más cercana');
check(reglaIndice(null, 2.5) === 0 && reglaIndice('', 1) === 0 && reglaIndice(-5, 1) === 0 && reglaIndice(99999, 2.5, { max: 1500 }) === 600 && reglaValor(600, 2.5) === 1500,
  'sin valor, al principio; nunca por debajo de 0 ni por encima del tope (1500 kg)');
check(reglaIndice(72.4, 0.1, { min: 25, max: 350 }) === 724 && reglaValor(724, 0.1) === 72.4 && reglaValor(725, 0.1) === 72.5 && reglaValor(1001, 0.1) === 100.1,
  'tu peso, de 100 en 100 g, sin decimales de más (72,4 · 72,5 · 100,1)');
const tp = reglaTopes(0.1, { min: 25, max: 350 });
check(tp.lo === 250 && tp.hi === 3500 && reglaIndice(10, 0.1, { min: 25, max: 350 }) === 250 && reglaIndice(null, 0.1, { min: 25, max: 350 }) === 250, 'y entre sus topes (25 y 350 kg)');
const v = reglaVentana(34, 2.5, { max: 1500 });
check(v.a === 0 && v.b === 34 + REGLA_MEDIA && v.lo === 0 && v.hi === 600 && REGLA_ANCHO === 12, `se pintan ${REGLA_MEDIA} saltos a cada lado (sin pasar de 0), de 12 px cada uno`);
const v2 = reglaVentana(724, 0.1, { min: 25, max: 350 });
check(v2.a === 724 - REGLA_MEDIA && v2.b === 724 + REGLA_MEDIA && !reglaAlBorde(724, v2) && reglaAlBorde(v2.b - 10, v2) && reglaAlBorde(v2.a + 5, v2) && reglaAlBorde(v2.b + 3, v2),
  'al parar cerca del borde de lo pintado (o fuera, tras teclear), se vuelve a centrar');
check(!reglaAlBorde(5, v) && !reglaAlBorde(0, v), 'pero no junto a un tope de verdad (0 kg): ahí no hay más que pintar');
check(JSON.stringify(zonaReps({ reps_min: 10, reps_max: 12 })) === '[10,12]' && JSON.stringify(zonaReps({ reps_min: 8 })) === '[8,8]' && JSON.stringify(zonaReps({ reps_max: 15 })) === '[15,15]' && zonaReps({}) === null && zonaReps(null) === null,
  '(202) la zona de tu pauta: de 10 a 12; con una sola cifra, esa; sin pauta, ninguna');
check(JSON.stringify(zonaReps({ reps_min: 10, reps_max: 12, series_detalle: [{ reps: 6 }, { reps: 8 }] }, { reps: 8 })) === '[8,8]' && zonaReps({ series_detalle: [{ reps: null }] }, { reps: null }) === null,
  'con la pauta serie a serie, lo de esa serie');

console.log('\nLa regla, en su sitio');
const regla = src('ui/Regla.jsx'), teclado = src('ui/atleta/Teclado.jsx'), hoy = src('ui/atleta/Hoy.jsx'), checkin = src('ui/atleta/Checkin.jsx');
check(/role="slider" tabIndex=\{0\} aria-label=\{etiqueta\} aria-orientation="horizontal"/.test(regla) && /aria-valuenow=\{ahora\} aria-valuetext=/.test(regla) && /e\.key === 'ArrowRight'/.test(regla) && /e\.key === 'PageUp' \? m/.test(regla),
  'es un deslizador para el lector de pantalla y el teclado (flechas, de salto en salto; AvPág y RePág, de número en número)');
check(/if \(!el \|\| !st\.activo\) return;/.test(regla) && /if \(!el \|\| st\.activo\) return;/.test(regla), 'solo cambia el valor mientras la mueve la persona; si el valor cambia desde fuera, va a su sitio sin tocar nada');
check(/const \[p, setP\] = useState\(paso\)/.test(regla) && /if \(paso !== p\) \{ setP\(paso\); return; \}/.test(regla), 'el salto no cambia bajo el dedo (con mancuernas cambia al pasar de 10 kg): se pone al soltar');
check(/if \(t - st\.t > 26\)/.test(regla) && /vibrar\(i % a\.m === 0 \? PATRONES\.serie : PATRONES\.toque\)/.test(regla) && /passive: true/.test(regla), 'un toque por salto (algo más en cada número), sin frenar el desplazamiento');
check(/data-sin-deslizar=""/.test(regla), 'y no se confunde con deslizar entre pestañas');
check(/<Regla key=\{`\$\{clave\}-\$\{campo\}`\}/.test(teclado) && /zona=\{campo === 'reps' \? zona : null\}/.test(teclado) && /max=\{campo === 'kg' \? 1500 : 200\}/.test(teclado) && /<div class="teclado-teclas">/.test(teclado),
  '(201-202) sobre el teclado de la app, en los kilos y en las repeticiones (con la zona de la pauta); el teclado sigue debajo');
check(/zona=\{zonaReps\(e, prop\)\}/.test(src('ui/atleta/Sesion.jsx')) && /zona=\{zonaReps\(e, prop\)\}/.test(src('ui/atleta/Enfoque.jsx')) && /zona=\{zona\}/.test(src('ui/atleta/FilaSerie.jsx')), 'la zona llega desde la sesión y desde el modo enfoque');
check(/const ReglaPeso = perezoso\(\(\) => import\('\.\.\/Regla\.jsx'\), 'Regla', \{ mientras: null \}\)/.test(hoy) && /<ReglaPeso variante="peso" valor=\{kg\} base=\{inicial \?\? 70\} paso=\{0\.1\} min=\{25\} max=\{350\} dec=\{1\} mayor=\{10\}/.test(hoy),
  '(203) en «Tu peso» (Hoy): arranca en tu último peso y va de 100 en 100 g; su código llega al abrir la hoja');
check(/<Regla variante="peso" valor=\{peso\} base=\{ultimoPeso \? Number\(ultimoPeso\.kg\) : 70\} paso=\{0\.1\}/.test(checkin), 'y en el check-in');

console.log('\nLas escalas se arrastran (204)');
const esc = src('ui/arrastrar-escala.js');
check(/fila\.style\.touchAction = 'pan-y'/.test(esc) && /if \(dx < 8 \|\| dx < Math\.abs\(e\.clientY - g\.y\)\) return;/.test(esc) && /b\.getAttribute\('aria-pressed'\) !== 'true'\) \{ b\.click\(\); vibrar\('toque'\); \}/.test(esc),
  'de lado, el dedo va eligiendo el número por el que pasa (con su toque); de arriba abajo, la página se sigue desplazando');
check(/e\.isTrusted && e\.timeStamp - sinClic < 120/.test(esc), 'y el clic que llega al soltar no deshace lo elegido');
check(/ref=\{\(el\) => escalaArrastrable\(el\?\.querySelector\('\.segmentos'\)\)\}/.test(src('ui/atleta/Sesion.jsx')) && /aria-label="Tu nota, del 1 al 10" ref=\{escalaArrastrable\}/.test(src('ui/atleta/EsencialCerca.jsx')),
  'en el esfuerzo de la sesión (del 5 al 10) y en la nota del 1 al 10');

console.log('\nEl descanso, de lejos y de reojo (207-209)');
check(luzBorde({ quedan: 10, total: 90 }) === 0 && luzBorde({ quedan: 5, total: 90 }) === 0.5 && luzBorde({ quedan: 0.5, total: 90 }) === 0.95 && LUZ_SEG === 10, '(208) la luz del borde: de nada a todo en los últimos 10 segundos');
check(luzBorde({ quedan: 11, total: 90 }) === null && luzBorde({ quedan: 0, total: 90 }) === null && luzBorde({ quedan: 5, total: 90, pausado: true }) === null && luzBorde({ quedan: 5, total: 15 }) === null && luzBorde() === null,
  'antes no; ni en pausa, ni al acabar, ni en descansos de menos de 20 segundos');
const toca = { nombre: 'Prensa de piernas', serie: 'Serie 2 de 3', carga: '85 kg × 12', esfuerzo: 'RIR 2', otroEjercicio: false };
check(serieCorta('Serie 2 de 3') === 'Serie 2' && serieCorta('Serie top') === 'Serie top' && serieCorta('Back-off 2 de 3') === 'Back-off 2' && serieCorta(null) === '', '«Serie 2 de 3», en corto: «Serie 2»');
const f1 = formaPastilla({ quedan: 88, desdeInicioMs: 300, toca }), f2 = formaPastilla({ quedan: 87, desdeInicioMs: HECHA_MS + 1, toca }), f3 = formaPastilla({ quedan: 0, toca });
check(f1.estado === 'hecha' && f1.valor === 'Hecha' && f2.estado === 'cuenta' && f2.valor === '1:27' && f3.estado === 'toca' && f3.valor === 'Serie 2 · 85 kg × 12',
  '(209) la pastilla: «Hecha» nada más marcar la serie, lo que queda y, al acabar, «Te toca»: «Serie 2 · 85 kg × 12»');
check(formaPastilla({ quedan: 0, toca: { ...toca, otroEjercicio: true } }).estado === 'otro' && formaPastilla({ quedan: 0, toca: { ...toca, otroEjercicio: true } }).valor === 'Prensa de piernas' && formaPastilla({ quedan: 0 }).valor === '¡Vamos!'
  && formaPastilla({ quedan: 30, pausado: true, desdeInicioMs: 100 }).estado === 'cuenta' && formaPastilla({ quedan: 30 }).estado === 'cuenta',
  'si lo siguiente es otro ejercicio, su nombre; sin nada más que hacer, «¡Vamos!»; en pausa o al volver a la app, lo que queda');
const c1 = cartelDe({ quedan: 85, total: 90, texto: 'Serie 2 de prensa', toca }), c2 = cartelDe({ quedan: 0, total: 90, toca }), c3 = cartelDe({ quedan: 0, total: 90, texto: 'x' });
check(c1.fase === 'cuenta' && c1.cifra === '1:25' && c1.etiqueta === 'Descanso' && Math.abs(c1.frac - 85 / 90) < 1e-9 && c1.despues === 'Prensa de piernas · Serie 2 · 85 kg × 12',
  '(207) el cartel: la cuenta atrás, lo que queda del total y lo que viene después');
check(c2.fase === 'toca' && c2.etiqueta === 'Te toca' && c2.nombre === 'Prensa de piernas' && c2.cifra === '85 kg × 12' && c2.pie === 'Serie 2 de 3 · RIR 2' && c3.fase === 'fin' && c3.cifra === '¡Vamos!',
  'al acabar, «Te toca» con sus kilos en grande (y «¡Vamos!» si no queda nada)');
check(cartelDe({ quedan: 20, total: 90, pausado: true }).etiqueta === 'Descanso en pausa' && cartelDe({ quedan: 0, toca: { ...toca, otroEjercicio: true, carga: null } }).etiqueta === 'Siguiente ejercicio' && cartelDe({ quedan: 0, toca: { ...toca, carga: null } }).cifra === 'Serie 2',
  'en pausa lo dice; si toca otro ejercicio, «Siguiente ejercicio»; sin kilos, la serie');
check(esTumbado({ tipo: 'landscape-primary', ancho: 844, alto: 390, tactil: true }) && !esTumbado({ tipo: 'portrait-primary', ancho: 390, alto: 300, tactil: true }) && !esTumbado({ tipo: 'landscape-primary', ancho: 1280, alto: 800, tactil: true }) && !esTumbado({ tipo: 'landscape-primary', ancho: 844, alto: 390, tactil: false }) && !esTumbado(),
  'tumbado: un móvil apaisado de verdad (no una ventana baja con el teclado abierto, ni una tableta, ni un ordenador)');
const comun = src('ui/atleta/sesion-comun.jsx'), grande = src('ui/atleta/DescansoGrande.jsx');
check(/const conCartel = \(cartel \|\| \(tumbado && !sinCartel\)\) && !juego && !apunte;/.test(comun) && /guardarAjustes\(\{ \.\.\.leerAjustes\(\), cartel: true \}\)/.test(comun) && /aria-label="Ver el descanso en grande \(modo cartel\)"/.test(comun),
  'el cartel sale con el móvil tumbado o con su botón (y se queda puesto de un descanso a otro); el juego y los apuntes mandan');
check(/role="dialog" aria-modal="true" aria-label="El descanso, en grande"/.test(grande) && /if \(e\.key === 'Escape'\) \{ e\.preventDefault\(\); e\.stopImmediatePropagation\(\); alCerrar\(\); return; \}/.test(grande) && /aria-label="Salir del modo cartel"/.test(grande),
  'es un diálogo: el foco entra, Escape lo cierra (solo a él) y tiene su botón de salir');
check(/<LuzBorde quedan=\{quedan\} total=\{total\} pausado=\{pausado\} fin=\{fin\} \/>/.test(comun) && /class=\{`lb-borde\$\{final \? ' lb-fin' : ''\}`\} aria-hidden="true"/.test(grande) && /el\.style\.animationDelay = `\$\{-\(luz \* LUZ_SEG\)\.toFixed\(2\)\}s`/.test(grande),
  'la luz es de adorno (no se anuncia) y es una sola animación que arranca por donde va la cuenta');
check(/class=\{`pildora-descanso pst-forma \$\{quedan <= 0 \? 'fin' : ''\}`\} data-pst=\{forma\.estado\}/.test(comun) && /useForma\(pastilla, conPildora && fuera \? forma\.estado : null\)/.test(comun)
  && /aria-label=\{quedan > 0 \? 'Descanso en curso, toca para volver' : 'Descanso terminado, toca para volver'\}/.test(comun), 'la pastilla es la misma (no desaparece y vuelve) y su nombre para el lector de pantalla no cambia');

console.log('\nLas historias, con las manos (226-228)');
check(decidirGesto(3, 4) === null && decidirGesto(2, 40) === 'baja' && decidirGesto(2, -40) === null && decidirGesto(-40, 5) === 'lado' && decidirGesto(40, 5) === 'lado' && decidirGesto(20, 20) === null && PAUSA_MS >= 200,
  'el dedo quieto, una pausa; hacia abajo, cerrar; de lado, pasar; hacia arriba o en diagonal, nada');
check(cierraAlBajar(130) && !cierraAlBajar(60) && cierraAlBajar(60, 0.8) && !cierraAlBajar(20, 2), '(227) se cierra si baja bastante o si va deprisa; si no, vuelve');
check(destinoLado(-80, 0, { i: 0, n: 3 }) === 1 && destinoLado(80, 0, { i: 1, n: 3 }) === -1 && destinoLado(-30, -0.8, { i: 0, n: 3 }) === 1 && destinoLado(-30, 0, { i: 0, n: 3 }) === 0,
  '(228) de lado: la siguiente o la anterior (también con poco recorrido si va deprisa); con poco y despacio, se queda');
check(destinoLado(-80, 0, { i: 2, n: 3 }) === 'cerrar' && destinoLado(80, 0, { i: 0, n: 3 }) === 0 && gomaLado(100, { i: 0 }) === 28 && gomaLado(100, { i: 1 }) === 100 && gomaLado(-100, { i: 0 }) === -100,
  'hacia delante en la última, cierra (como al tocar); hacia atrás en la primera, cede un poco y vuelve');
const gestos = src('ui/atleta/historia-gestos.js'), gancho = src('ui/historia-tacto.js');
check(/import\('\.\/atleta\/historia-gestos\.js'\)/.test(gancho) && !/historia-gestos/.test(src('ui/atleta/TuSemana.jsx')), 'el código de los gestos llega al abrir la primera historia (no pesa al abrir la app)');
check(['ui/atleta/TuSemana.jsx', 'ui/atleta/TuMes.jsx', 'ui/atleta/TuAnio.jsx', 'ui/atleta/HistoriaSesion.jsx'].every((f) => /const pausa = useHistoriaTacto\(caja, \{ i, n: pantallas\.length, ir, alCerrar/.test(src(f)) && /if \(quieto \|\| ultima \|\| (compartir \|\| )?pausa\) return undefined;/.test(src(f))),
  'en las cuatro: la sesión, tu semana, tu mes y tu año; en pausa no avanzan solas');
check(/b\.style\.animationPlayState = 'paused'/.test(gestos) && /adornos\('hidden'\)/.test(gestos) && /b\.style\.animation = 'none'; void b\.offsetWidth; b\.style\.animation = '';/.test(gestos),
  '(226) en pausa se para la barra y se quitan las barras y la ✕; al soltar, la tarjeta vuelve a tener su tiempo entero');
check(/button:not\(\.historia-zona\), a, input/.test(gestos) && /if \(e\.timeStamp - sinClic < 120\)/.test(gestos) && /if \(!modo\) return;/.test(gestos), 'los botones de dentro siguen siendo botones, y un toque normal sigue pasando de tarjeta');
check(/sinMovimiento\(\) \|\| !el\.animate\) \{ o\.alCerrar\(\); return; \}/.test(gestos) && /if \(!nodo \|\| sinMovimiento\(\) \|\| !nodo\.animate\) return;/.test(gestos), 'con «reducir movimiento», al soltar va a su sitio de golpe');

console.log('\nLa hoja de estilos (tacto-a.css)');
const css = src('tacto-a.css'), main = src('main.jsx'), sinCom = css.replace(/\/\*[\s\S]*?\*\//g, '');
check(!/[^\x00-\x7F]/.test(css), 'solo ASCII (también los comentarios)');
check(!/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(sinCom), 'los colores, siempre por su nombre (sin valores sueltos)');
check(main.indexOf("'./tacto-a.css'") > main.indexOf("'./ambas-j.css'") && main.indexOf("'./tacto-a.css'") < main.indexOf("'./color-capa.css'"), 'se carga detrás de la última de belleza y antes de color-capa.css');
check(!/@keyframes/.test(sinCom) && /animation: llega 10s linear both/.test(sinCom) && /@keyframes llega \{ from \{ opacity: 0; \} \}/.test(src('diseno.css')) && /@keyframes vt-se-va \{ to \{ opacity: 0; \} \}/.test(src('diseno.css')) && /@keyframes cuenta-vamos/.test(src('diseno.css')),
  'sin animaciones nuevas (usa tres que ya había): las @keyframes se quedarían en los estilos del arranque');
check(!/(^|[\s,{}])\.(rg|ct|lb|pst)(?![-\w])/.test(sinCom), 'ninguna clase de dos o tres letras sola (coincidiría con el código ya empaquetado y sus reglas se quedarían en el arranque)');
check(/@media \(prefers-reduced-motion: no-preference\) \{\s*\.lb-borde \{ opacity: 1; animation: llega 10s linear both; \}/.test(sinCom) && /@media \(prefers-reduced-motion: reduce\) \{ \.lb-borde \{ opacity: \.75; \} \.lb-borde\.lb-fin \{ display: none; \} \}/.test(sinCom),
  'la luz del borde solo crece si se puede; con «reducir movimiento», fija');
check(/@media \(prefers-contrast: more\) \{ \.lb-borde/.test(sinCom) && /@media \(prefers-contrast: more\) \{ \.rg-caja/.test(sinCom), 'con «más contraste», el borde y la regla, sin difuminados');
check((sinCom.match(/box-shadow:/g) || []).length - (sinCom.match(/box-shadow: (none|var\(--[\w-]+\));/g) || []).length === 1, 'una sola sombra hecha a mano (el resplandor del borde): lo demás, con las del sistema, filos o contornos');
check(/@media \(max-height: 680px\) \{ \.rg-raiz:not\(\.rg-peso\) \{ display: none; \} \}/.test(sinCom), 'con poca pantalla, el teclado no crece: la regla no sale');
check(/linear-gradient\(var\(--oklab,\) 90deg/.test(sinCom) && !/linear-gradient\(\s*(to |\d)/.test(sinCom), 'los degradados con dirección, con su espacio de color');
check(!/font-size:[^;]*\d(rem|px)/.test(sinCom), 'las letras, por sus nombres (o por lo que mide la pantalla, en el cartel)');

// ================================================================ Segunda vuelta (v0.272)
console.log('\nSegunda vuelta (v0.272). Recetas con las manos (237-241)');
const tz = trozosDePaso('Cuece el arroz 10 minutos y deja reposar 2-3 min. Hornea de 1 a 2 horas. Añade 200 g de harina y 1 huevo. Saltea 30 segundos.');
check(tz.filter((x) => x.seg).map((x) => `${x.t}=${x.seg}`).join('|') === '10 minutos=600|2-3 min=120|1 a 2 horas=3600|30 segundos=30' && tz.map((x) => x.t).join('') === 'Cuece el arroz 10 minutos y deja reposar 2-3 min. Hornea de 1 a 2 horas. Añade 200 g de harina y 1 huevo. Saltea 30 segundos.',
  '(239) los tiempos de un paso («10 minutos», «2-3 min», «1 a 2 horas», «30 segundos»): de un intervalo, lo menos; y el texto queda entero');
check(tiemposDePaso('Añade 200 g de harina, 1 huevo y 2 hojas de laurel').length === 0 && tiemposDePaso('Bate 2 segundos').length === 0 && tiemposDePaso('Macera 12 horas').length === 0 && tiemposDePaso('Reposa 1 h').length === 1 && tiemposDePaso('').length === 0 && trozosDePaso('Sirve.').length === 1,
  'ni los gramos ni los huevos son tiempos; tampoco lo de menos de 5 segundos o más de 4 horas');
check(tiemposDePaso('Cuece 8–10 minutos')[0]?.seg === 480 && tiemposDePaso('Hornea 1,5 horas')[0]?.seg === 5400 && tiemposDePaso('Espera 5 o 6 minutos')[0]?.seg === 300, 'con raya, con coma decimal y con «o»');
check(textoReloj(599) === '9:59' && textoReloj(3900) === '1:05:00' && textoReloj(0) === '0:00' && textoReloj(59.2) === '1:00' && textoDuracion(600) === '10 minutos' && textoDuracion(60) === '1 minuto' && textoDuracion(3900) === '1 hora y 5 minutos' && textoDuracion(30) === '30 segundos' && textoDuracion(7200) === '2 horas',
  'lo que queda, para verlo («9:59») y para decirlo («10 minutos», «1 hora y 5 minutos»)');
check(quedaDe({ fin: 10000 }, 4000) === 6 && quedaDe({ fin: 10000 }, 12000) === 0 && quedaDe(null, 0) === 0, 'y lo que le queda a un temporizador');
check(JSON.stringify(cifraIngrediente('150 g de arroz')) === '{"cifra":"150","resto":" g de arroz"}' && cifraIngrediente('1,5 cdas. de AOVE').cifra === '1,5' && cifraIngrediente('Sal').cifra === null && cifraIngrediente('Sal').resto === 'Sal' && cifraIngrediente(null).resto === '',
  '(241) la cifra de un ingrediente, aparte, para que ruede al cambiar las raciones');
let tg = tengoCon({}, 'r1', '2026-11-27', 2, true); tg = tengoCon(tg, 'r1', '2026-11-27', 0, true);
check(JSON.stringify(tg) === '{"r1":{"f":"2026-11-27","k":[0,2]}}' && tengoDe(tg, 'r1', '2026-11-27').join() === '0,2' && tengoDe(tg, 'r1', '2026-11-28').length === 0 && tengoDe(tg, 'r2', '2026-11-27').length === 0 && tengoDe(null, 'r1', '2026-11-27').length === 0,
  '(237) lo que ya tienes, por receta y solo ese día (mañana, la lista limpia)');
check(JSON.stringify(tengoCon(tg, 'r1', '2026-11-27', 0, false)) === '{"r1":{"f":"2026-11-27","k":[2]}}' && JSON.stringify(tengoCon(tengoCon(tg, 'r1', '2026-11-27', 0, false), 'r1', '2026-11-27', 2, false)) === '{}' && JSON.stringify(tengoCon(tg, 'r2', '2026-11-28', 1, true)) === '{"r2":{"f":"2026-11-28","k":[1]}}',
  'se destacha, y lo de otros días no se guarda');
const cocina = src('ui/Cocina.jsx'), recetario = src('ui/RecetarioEquipo.jsx');
check(/<Ingredientes receta=\{r\.id\} lineas=\{lineas\} \/>/.test(recetario) && /<input type="checkbox" class="coc-casilla" checked=\{si\}/.test(cocina) && /aria-label="Ingredientes: marca los que ya tienes"/.test(cocina) && /\{c\.cifra != null && <Odometro texto=\{c\.cifra\} \/>\}/.test(cocina),
  'los ingredientes son casillas de verdad (con su nombre para el lector de pantalla) y su cifra rueda');
check(/<PasoConTiempos texto=\{p\} receta=\{r\.id\} nombre=\{r\.nombre\} \/>/.test(recetario) && /aria-label=\{`\$\{x\.t\}: poner un temporizador de \$\{textoDuracion\(x\.seg\)\}`\}/.test(cocina) && /<PastillaCocina \/>/.test(recetario)
  && /sonarFBE\('fin-descanso'\)/.test(cocina) && /aria-label="Un minuto más"/.test(cocina), 'cada tiempo es un botón que arranca su temporizador; su pastilla sigue en la receta, con «+1 min», y avisa al acabar');
check(/if \(!favorita\) \{ estrellaSalta\(estrella\.current\); vibrar\('hecho'\); \}/.test(recetario) && /<FotoGuardable puede=\{!esCoach && !!alMarcar && !favorita && !ocupado\} alGuardar=\{marcar\}>/.test(recetario) && /if \(t - ultimo\.current > 340\)/.test(cocina),
  '(240) al guardar, la estrella salta con tres chispas y su toque; dos toques seguidos en la foto también guardan (el botón sigue ahí)');
check(/\{cocina && <ModoCocina receta=\{r\.id\} nombre=\{r\.nombre\} pasos=\{pasos\} lineas=\{lineas\}/.test(recetario) && /role="dialog" aria-modal="true" aria-label=\{`Modo cocina: \$\{nombre\}`\}/.test(cocina) && /navigator\.wakeLock\?\.request\('screen'\)/.test(cocina) && /useAtraparFoco\(raiz\)/.test(cocina)
  && /destinoLado\(e\.clientX - s\.x, s\.vx, \{ i, n \}\)/.test(cocina) && /aria-label="Salir del modo cocina"/.test(cocina),
  '(238) el modo cocina: un diálogo a pantalla completa, un paso cada vez (deslizando o con sus botones) y la pantalla encendida');

console.log('\nLo delicado, manteniendo pulsado (206); lo que cambia de sitio se ve (210-211); deshacer (249)');
const mantener = src('ui/Mantener.jsx');
check(/setTimeout\(\(\) => \{ hecho\.current = Date\.now\(\); setLlena\(false\); vibrar\('hecho'\); alConfirmar\(\); \}, MANTENER_MS\)/.test(mantener) && /const clic = \(\) => \{ if \(Date\.now\(\) - hecho\.current > 800\) alPreguntar\(\); \};/.test(mantener),
  'mantenerlo un segundo lo hace sin preguntar; un toque (y el teclado y el lector de pantalla) abre la pregunta de siempre');
check(/<BotonMantener clase="btn-texto peq" deshabilitado=\{ocupado\} alConfirmar=\{borrarTodas\} alPreguntar=\{\(\) => setBorrar\(true\)\}>/.test(src('ui/atleta/EsencialPruebas.jsx')) && /<BotonMantener clase="btn-texto mini dol-quitar" deshabilitado=\{ocupado\} alConfirmar=\{borrarTodo\} alPreguntar=\{\(\) => setBorrar\(true\)\}>/.test(src('ui/atleta/EsencialDolor.jsx')),
  'en los dos «Borrar todo» que hay (tus pruebas y lo apuntado de molestias); la pregunta sigue estando');
const sesion = src('ui/atleta/Sesion.jsx'), viaje = src('ui/atleta/viaje-tarjetas.js');
check(/const foto = fotoTarjetas\(\);/.test(sesion) && /viajarTarjetas\(foto\);/.test(sesion) && /viajarTarjetas\(foto2\);/.test(sesion) && /if \(!foto\?\.size \|\| sinMovimiento\(\)\) return;/.test(viaje) && /Math\.max\(-tope, Math\.min\(tope, d\)\)/.test(viaje),
  '(210) al dejar un ejercicio para luego (y al deshacerlo), cada tarjeta viaja de donde estaba a donde queda');
check(/girarTarjeta\(e\.id\);\s*if \(!siempre\) aviso\(`Ahora: \$\{ej\.nombre\}`, 'ok', \{ texto: 'Deshacer'/.test(sesion) && /elegir\(x, \{ siempre: !!fijo \}\)/.test(sesion) && /rotateY\(-86deg\)/.test(viaje),
  '(211) al cambiar un ejercicio, su tarjeta gira al nuevo y la pastilla trae «Deshacer» (el cambio «para siempre» lo dice con su aviso)');
check(/aviso\(`Serie \$\{numero\} quitada`, 'ok', previa && previa\.reps != null \? \{ texto: 'Deshacer'/.test(sesion) && /aviso\('Quitado de tu rincón', 'ok', \{ texto: 'Deshacer'/.test(src('ui/atleta/PerfilMas.jsx'))
  && /aviso\('Foto quitada', 'ok', \{ texto: 'Deshacer'/.test(src('ui/atleta/Suyo.jsx')) && /aviso\('Descartado', 'ok', \{ texto: 'Deshacer'/.test(hoy) && /const ms = toast\.accion \? 6000/.test(src('ui/App.jsx')),
  '(249) «Deshacer» en la misma pastilla (6 segundos) al quitar una serie, algo de tu rincón, tu foto o una tarjeta de Hoy');

console.log('\nLa barra de abajo, con el dedo (224-225) y el modo zurdo (205)');
const SUBS = [['resumen', 'Resumen'], ['fuerza', 'Fuerza'], ['cuerpo', 'Cuerpo'], ['logros', 'Logros']];
const MAS = [['checkin', 'Check-in', 'checkin'], ['equipo', 'Equipo', 'equipo'], ['perfil', 'Perfil', 'perfil']];
check(atajosDe('hoy', { tabs: ['hoy', 'semana', 'checkin'], conPeso: true }).map((a) => `${a.que}:${a.texto}`).join('|') === 'empezar:Empezar la sesión|ir:Check-in|peso:Tu peso'
  && atajosDe('hoy', { tabs: ['hoy'], conPeso: false }).map((a) => a.que).join() === 'empezar', '(224) mantener «Hoy»: «Empezar la sesión», «Check-in» (si lo tiene) y «Tu peso» (si lo apunta)');
check(atajosDe('progreso', { subs: SUBS }).map((a) => `${a.id}:${a.texto}`).join('|') === 'resumen:Resumen|fuerza:Fuerza|cuerpo:Cuerpo|logros:Logros' && atajosDe('progreso', { subs: SUBS }).every((a) => a.que === 'sub' && a.icono),
  '«Progreso»: sus cuatro partes');
check(JSON.stringify(atajosDe('mas', { mas: MAS, ultimo: 'equipo' })) === '[{"que":"ir","id":"equipo","texto":"Equipo","icono":"equipo"}]' && atajosDe('mas', { mas: MAS, ultimo: null }).length === 0 && atajosDe('mas', { mas: MAS, ultimo: 'semana' }).length === 0
  && atajosDe('semana', {}).length === 0 && atajosDe('hoy').length === 1 && LARGO_MS >= 400, '«Más»: lo último que abriste desde ahí (si lo hay); las demás pestañas no tienen atajos');
const barra = src('ui/atleta/barra-gestos.jsx'), atletaApp = src('ui/atleta/AtletaApp.jsx');
check(/import\('\.\/barra-gestos\.jsx'\)\.then\(\(m\) => \{ if \(!fuera\) quitar = m\.instalarBarra\(\(\) => paraBarra\.current\); \}\)/.test(atletaApp) && /<button key=\{id\} data-tab=\{id\} class=/.test(atletaApp),
  'su código llega con la app ya abierta (en el arranque solo va el gancho y la marca de cada pestaña)');
check(/role="menu" aria-label=/.test(barra) && /role="menuitem" class="bg-item"/.test(barra) && /document\.addEventListener\('contextmenu', contexto\)/.test(barra) && /if \(e\.key === 'Escape'\)/.test(barra) && /e\.key !== 'ArrowDown' && e\.key !== 'ArrowUp'/.test(barra),
  'los atajos son un menú (flechas y Escape), y también salen con la tecla o el gesto de menú del sistema');
check(/if \(Math\.abs\(dx\) < 10 \|\| Math\.abs\(dx\) < Math\.abs\(dy\)\) return;/.test(barra) && /if \(destino && destino !== actual\) \{ aIcono\(s\.cont, destino\); vibrar\('elegir'\); destino\.click\(\); \}/.test(barra) && /if \(!s\.modo\) return;/.test(barra),
  '(225) deslizar el pulgar por la barra: la píldora sigue al dedo y, al soltar, se va a esa pestaña; un toque normal, lo de siempre');
check(/data-atajo="empezar"/.test(hoy) && (hoy.match(/data-atajo="peso"/g) || []).length === 2 && /details\[data-plegable="peso"\]/.test(barra) && /o\.aviso\?\.\('Hoy no tienes una sesión por empezar'\)/.test(barra), '«Empezar» y «Tu peso» tocan el botón de Hoy que lleva su marca (y si hoy no hay sesión, lo dice)');
check(/r\.toggleAttribute\('data-zurdo', a\.zurdo === true\)/.test(src('ui/ajustes.js')) && /<Interruptor id="aj-zurdo" icono="intercambiar" texto="Modo zurdo" valor=\{a\.zurdo === true\}/.test(src('ui/Ajustes.jsx'))
  && /class=\{`serie zd-fila /.test(src('ui/atleta/FilaSerie.jsx')) && /class="hecho-btn zd-visto"/.test(src('ui/atleta/FilaSerie.jsx')) && /class="series-cab zd-cab"/.test(sesion), '(205) el modo zurdo es un ajuste de este móvil (apagado de serie) y marca la página');

console.log('\nLa hoja de estilos (tacto-b.css)');
const cssB = src('tacto-b.css'), sinComB = cssB.replace(/\/\*[\s\S]*?\*\//g, '');
check(!/[^\x00-\x7F]/.test(cssB) && !/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(sinComB) && !/@keyframes/.test(sinComB), 'solo ASCII, los colores por su nombre y sin @keyframes (lo que se mueve una vez lo mueve el código)');
check(main.indexOf("'./tacto-b.css'") > main.indexOf("'./tacto-a.css'") && main.indexOf("'./tacto-b.css'") < main.indexOf("'./color-capa.css'"), 'se carga detrás de la primera vuelta y antes de color-capa.css');
const sueltas = sinComB.split('}').map((r) => r.split('{')[0].trim()).filter((sel) => /^[.:]/.test(sel) && sel.split(',').some((x) => !x.includes(':not(#n)') && !/^\s*\.tabs-flota /.test(x)));
check(sueltas.length === 0, `todas sus reglas llevan :not(#n) (viajan con su trozo sin empatar con las de otros)${sueltas.length ? `: ${sueltas.slice(0, 3).join(' | ')}` : ''}`);
check(/:root\[data-zurdo\] \.zd-fila:not\(#n\), :root\[data-zurdo\] \.zd-cab:not\(#n\) \{ grid-template-columns: 52px 26px/.test(sinComB) && /:root\[data-zurdo\] \.zd-fila:not\(#n\) > \.zd-visto, :root\[data-zurdo\] \.zd-cab:not\(#n\) > :last-child \{ order: -1; \}/.test(sinComB)
  && /:root\[data-zurdo\] \.teclado-teclas:not\(#n\) > \.tecla-siguiente \{ grid-area: 4 \/ 1 \/ auto \/ span 2; \}/.test(sinComB) && (sinComB.match(/:root\[data-zurdo\]\[data-gimnasio\]/g) || []).length === 4,
  'zurdo: el visto, primero en la fila (también en modo gimnasio y en pantallas estrechas); en el teclado, −, + y «Siguiente» a la izquierda');
check(/\.mnt-boton:not\(#n\)\[data-llena\] \.mnt-fondo \{ transform: scaleX\(1\); transition: transform 1s linear; \}/.test(sinComB) && /@media \(prefers-reduced-motion: reduce\) \{ \.mnt-boton:not\(#n\)\[data-llena\] \.mnt-fondo \{ transition: none; \} \}/.test(sinComB),
  'el botón que se mantiene se llena en un segundo (con «reducir movimiento», de golpe)');
check(!/font-size:[^;]*\d(rem|px)/.test(sinComB) && (sinComB.match(/box-shadow:/g) || []).length === (sinComB.match(/box-shadow: var\(--[\w-]+\);/g) || []).length, 'las letras y las sombras, por sus nombres');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
if (fallos) process.exit(1);
