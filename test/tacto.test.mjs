// (v0.271) Tacto (201-250), primera vuelta (lista en «claude/belleza-350-propuesta.md»): la regla de los kilos, de las
// repeticiones y de tu peso (201-203), las escalas que se arrastran (204), el modo cartel, la luz del borde y la pastilla
// que cambia de forma (207-209) y las historias con las manos (226-228). Lo que se puede comprobar sin pantalla: las
// cuentas de cada cosa, que cada pieza está puesta en su sitio y que la hoja de estilos sigue las reglas del sistema.
//   node test/tacto.test.mjs
import { readFileSync } from 'node:fs';
import { REGLA_ANCHO, REGLA_MEDIA, reglaMayor, reglaTopes, reglaIndice, reglaValor, reglaVentana, reglaAlBorde, zonaReps } from '../web/src/logica/regla.js';
import { LUZ_SEG, luzBorde, serieCorta, HECHA_MS, formaPastilla, cartelDe, esTumbado } from '../web/src/logica/descanso-vista.js';
import { PAUSA_MS, decidirGesto, cierraAlBajar, destinoLado, gomaLado } from '../web/src/logica/historia-gesto.js';

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
check(/@media \(max-height: 680px\) \{ \.rg-raiz:not\(\.rg-peso\) \{ display: none; \} \}/.test(sinCom), 'con poca pantalla, el teclado no crece: la regla no sale');
check(/linear-gradient\(var\(--oklab,\) 90deg/.test(sinCom) && !/linear-gradient\(\s*(to |\d)/.test(sinCom), 'los degradados con dirección, con su espacio de color');
check(!/font-size:[^;]*\d(rem|px)/.test(sinCom), 'las letras, por sus nombres (o por lo que mide la pantalla, en el cartel)');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
if (fallos) process.exit(1);
