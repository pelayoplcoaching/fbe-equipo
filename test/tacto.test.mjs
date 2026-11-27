// (v0.271) Tacto (201-250), primera vuelta (lista en «claude/belleza-350-propuesta.md»): la regla de los kilos, de las
// repeticiones y de tu peso (201-203), las escalas que se arrastran (204), el modo cartel, la luz del borde y la pastilla
// que cambia de forma (207-209) y las historias con las manos (226-228). Lo que se puede comprobar sin pantalla: las
// cuentas de cada cosa, que cada pieza está puesta en su sitio y que la hoja de estilos sigue las reglas del sistema.
//   node test/tacto.test.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { REGLA_ANCHO, REGLA_MEDIA, reglaMayor, reglaTopes, reglaIndice, reglaValor, reglaVentana, reglaAlBorde, zonaReps } from '../web/src/logica/regla.js';
import { LUZ_SEG, luzBorde, serieCorta, HECHA_MS, formaPastilla, cartelDe, esTumbado } from '../web/src/logica/descanso-vista.js';
import { PAUSA_MS, decidirGesto, cierraAlBajar, destinoLado, gomaLado } from '../web/src/logica/historia-gesto.js';
import { cifraIngrediente, trozosDePaso, tiemposDePaso, textoReloj, textoDuracion, tengoDe, tengoCon, quedaDe } from '../web/src/logica/cocina.js';
import { atajosDe, LARGO_MS } from '../web/src/logica/barra-atajos.js';
import { GRADOS_PX, caraDe, giroDestino, duracionGiro, luzGiro, velocidadGiro } from '../web/src/logica/medalla-giro.js';
import { ASOMA_MS, ASOMA_QUIETO, ASOMA_ABRE, asomaSesion, asomaEjercicio, asomaRotulo, sitioAsoma } from '../web/src/logica/asomar.js';
import { PELLIZCO, PELLIZCO_MS, partesPunto, puntoEn, cambioTramo, rangoAlPellizcar } from '../web/src/logica/grafica-dedos.js';
import { NOMBRES_COMPARTIDOS, paresValidos } from '../web/src/logica/vistas.js';
import { llano, puntosDe, buscarTodo, ejerciciosDeHistorial, AJUSTES_BUSCABLES } from '../web/src/logica/buscar-todo.js';
import { conIndice, indiceEn, cortoDe } from '../web/src/logica/indice-lateral.js';

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

console.log('\nLo que tocas viaja (212-220)');
check(NOMBRES_COMPARTIDOS.includes('vt-viaje') && paresValidos([{ nombre: 'vt-viaje', desde: {}, hasta: '.x' }]).length === 1, 'un nombre compartido para todos los viajes (vt-viaje), en la lista de los que se pueden usar');
const piezas2 = src('ui/atleta/ProgresoPiezas2.jsx'), tuSemana = src('ui/atleta/TuSemana.jsx'), logrosJsx = src('ui/Logros.jsx'), heroe = src('ui/MedallaHeroe.jsx'), diales = src('ui/atleta/Diales.jsx');
check(/const abrir = \(r, tarjeta\) => conTransicion\(\(\) => setAbierta\(r\), 'morph', \[\{ nombre: 'vt-viaje', desde: tarjeta\?\.querySelector\('\.receta-foto'\), hasta: '\.receta-equipo \.receta-foto\.grande' \}\]\)/.test(recetario)
  && /hasta: `\[data-receta="\$\{id\}"\] \.receta-foto` \}\]\); \};/.test(recetario), '(212) la foto de la receta crece hasta la cabecera y vuelve a su tarjeta al cerrar');
check(/desde: origen\.current, hasta: '\.grafica-grande \.grafica-caja'/.test(piezas2) && /hasta: '\[data-vuelve\]'/.test(piezas2)
  && /\.grafica-grande:not\(#n\) \.grafica-caja\.trazada :is\(\.linea\[pathLength\], \.area-deg, \.punto, \.pesada, text\.valor\) \{ animation: none; \}/.test(src('tacto-b.css')),
  '(214) la gráfica crece de su tarjeta a la pantalla completa (y vuelve), ya dibujada: no se vuelve a trazar');
check(/export const viajeHistoria = \(cambio, tarjeta\) => conTransicion\(cambio, 'morph', \[\{ nombre: 'vt-viaje', desde: tarjeta, hasta: '\.historia' \}\]\);/.test(tuSemana)
  && /alAbrir=\{\(ev\) => viajeHistoria\(\(\) => setAbierta\(true\), ev\.currentTarget\)\}/.test(hoy) && /viajeHistoria\(\(\) => \{ setAbierta\(true\); setVisto\(mes\); \}, ev\.currentTarget\)/.test(src('ui/atleta/TuMes.jsx'))
  && /viajeHistoria\(\(\) => \{ setAbierta\(true\); setVisto\(anio\); \}, ev\.currentTarget\)/.test(src('ui/atleta/TuAnio.jsx')), '(215) la tarjeta de «Tu semana», «Tu mes» y «Tu año» se abre hasta llenar la pantalla');
check(/onClick=\{\(ev\) => conTransicion\(alAbrir, 'morph', \[\{ nombre: 'vt-viaje', desde: ev\.currentTarget\.firstElementChild, hasta: '\.hoja-dialogo \.yt-marco' \}\]\)\}/.test(src('ui/Videos.jsx')), '(217) la miniatura de un vídeo crece hasta su reproductor');
const diario = src('ui/Diario.jsx'), visor = src('ui/chat/Visor.jsx');
check(/desde: ev\.currentTarget\.querySelector\('\.diario-medio'\)/.test(diario) && /<button type="button" class="vfp-abrir" aria-label="Ver la foto a pantalla completa" onClick=\{abrirVisor\}>/.test(diario)
  && /<Visor inicio=\{visor\.inicio\} urls0=\{visor\.urls0\} alCerrar=/.test(diario) && !/visor-medio|visor-diapo/.test(diario), '(218) la foto de progreso crece desde su miniatura y, al tocarla, se abre en el visor (sin nombrar sus clases: sus estilos viajan con él)');
check(/alResponder = null/.test(visor) && /\{alResponder && <button type="button" class="visor-accion"/.test(visor) && /const quien = m\.quien \?\? nombreDe\(c\.autor\);/.test(visor) && /\{m\.cuando \?\? cuandoInfo\(c\.creado_en\)\}/.test(visor)
  && /useState\(urls0 \|\| \{\}\)/.test(visor), 'el visor del chat vale para ellas: sin «Responder», con su fecha y con la foto que ya está cargada');
check(/const arriba = \(id, estado\) => <span class="dial dial-arriba" data-estado=\{estado\}>\{esf\[id\]\(\)\}<\/span>;/.test(diales) && /hasta: '\.dial-arriba \.dial-esfera'/.test(diales) && (diales.match(/\{arriba\}/g) || []).length === 5
  && /abierto === 'sueno' && su \? arriba\('sueno', su\.estado\)/.test(diales), '(219) el dial que se toca sube a la cabecera de su hoja (las cinco hojas; el del sueño, con el suyo)');
const suave = src('ui/actualizar-suave.js');
check(/import\('\.\/actualizar-suave\.js'\)\.then\(\(m\) => m\.cubrir\(\)\)\.catch\(\(\) => \{\}\)\.then\(\(\) => \{/.test(src('ui/App.jsx')) && /if \(sessionStorage\.getItem\('fbe-vuelta'\)\) import\('\.\/ui\/actualizar-suave\.js'\)\.then\(\(m\) => m\.volver\(\)\)/.test(main)
  && /ahora - v\.t < 30000 && v\.ruta === ruta \? v\.y : 0/.test(suave) && /sessionStorage\.removeItem\(CLAVE\)/.test(suave) && /if \(sinMovimiento\(\) \|\| !d\.animate\) \{ ok\(\); return; \}/.test(suave),
  '(220) actualizar sin pantallazo: funde a la noche de la portada, apunta por dónde ibas (una vez, medio minuto) y vuelve ahí; su código llega al tocar «Actualizar»');

console.log('\nLa medalla se coge (213 y 236)');
check(caraDe(0) === 'frente' && caraDe(180) === 'dorso' && caraDe(-180) === 'dorso' && caraDe(360) === 'frente' && caraDe(80) === 'frente' && caraDe(100) === 'dorso', 'de frente o de espaldas, según el ángulo');
check(giroDestino(70, 0) === 0 && giroDestino(100, 0) === 180 && giroDestino(40, 0.6) === 180 && giroDestino(0, 5) === 540 && giroDestino(0, -5) === -540 && Object.is(giroDestino(-20, 0), 0) && giroDestino(200, -0.9) === 0,
  'al soltarla sigue con su inercia (como mucho vuelta y media) y se para en la cara más cercana');
check(duracionGiro(0, 0) === 320 && duracionGiro(0, 180) === 548 && duracionGiro(0, 720) === 1100 && GRADOS_PX > 1 && GRADOS_PX < 2, 'tarda más cuanto más le queda (entre un tercio de segundo y uno y pico)');
check(JSON.stringify(luzGiro(0)) === '{"x":0,"o":0}' && JSON.stringify(luzGiro(90)) === '{"x":60,"o":1}' && luzGiro(180).o === 0 && JSON.stringify(luzGiro(270)) === '{"x":-60,"o":1}' && velocidadGiro(0, 10, 10) === 0.6 && velocidadGiro(1, 5, 0) === 1,
  'el brillo la cruza al girar (de frente y de espaldas, nada), y la velocidad se suaviza');
check(/const MedallaHeroe = perezoso\(\(\) => import\('\.\/MedallaHeroe\.jsx'\), 'MedallaHeroe', \{ mientras: null \}\);/.test(logrosJsx) && /onPointerDown=\{MedallaHeroe\.precargar\}/.test(logrosJsx)
  && /hasta: '\[data-llega="medalla"\]' \}\]\)\);/.test(logrosJsx) && /<MedallaHeroe logro=\{l\} Metal=\{MedallaMetal\}/.test(logrosJsx), '(213) viaja de su hueco a su hoja; su código se pide al bajar el dedo');
check(!/from '\.\/Logros\.jsx'|logica\/tablero/.test(heroe) && /aria-pressed=\{dorso\}/.test(heroe) && /if \(e\.button > 0 \|\| st\.g \|\| sinMovimiento\(\)\) return;/.test(heroe) && /if \(sinMovimiento\(\) \|\| desde === hasta\) \{ poner\(hasta\); return; \}/.test(heroe)
  && /<span class="mdl-como">\{l\.nivel \? l\.conseguido : l\.niveles\[0\]\.texto\}<\/span>/.test(heroe), 'es un botón (un toque o Intro le dan la vuelta), detrás dice cómo se ganó, quieta con «reducir movimiento», y no importa nada del arranque (lo recibe)');

console.log('\nAsomarse (221-223)');
const ej = (nombre, extra = {}) => ({ series: 3, reps_min: 8, reps_max: 10, descanso_seg: 90, ejercicio: { nombre, grupos_musculares: ['pectoral'] }, ...extra });
const pend = asomaSesion({ sesion: { nombre: 'Torso B', completada: false }, ejercicios: [ej('Press inclinado'), ej('Dominadas', { reps_min: 6, reps_max: 6 }), ej('Fondos'), ej('Remo'), ej('Face pull'), ej('Extensiones'), ej('Curl')] });
check(pend.titulo === 'Torso B' && /^7 ejercicios · unos \d+ min$/.test(pend.sub) && pend.lineas.length === 6 && pend.mas === 1 && pend.lineas[0].join('|') === 'Press inclinado|3 × 8–10' && pend.lineas[1][1] === '3 × 6' && pend.pie === '',
  `una sesión por hacer: sus ejercicios con su pauta (los seis primeros y «y 1 más») y lo que dura («${pend.sub}»)`);
const hecha = asomaSesion({ sesion: { nombre: 'Torso A', completada: true, fecha_realizada: '2026-11-23', duracion_min: 65, rpe_sesion: 7, nota_atleta: 'Buena sesión' },
  ejercicios: [ej('Press banca', { hechas: [{ kg: 45, reps: 6, rpe: 8 }, { kg: 47.5, reps: 6, rpe: 8.5 }, { kg: 47.5, reps: 5, rpe: 9 }] }), ej('Plancha', { hechas: [] })] });
check(hecha.sub === 'Hecha el lun 23 nov · 65 min · esfuerzo 7/10' && hecha.lineas[0].join('|') === 'Press banca|3 × 47,5×6 @8,5' && hecha.lineas[1][1] === 'Sin apuntar' && hecha.pie === '«Buena sesión»' && asomaSesion(null) === null && asomaSesion({}) === null,
  'una hecha: el día, el tiempo y el esfuerzo, lo que hiciste en cada ejercicio (series y la mejor) y tu nota');
const sEj = (fecha, sesion_id, numero, kg, reps, rpe) => ({ fecha, sesion_id, numero, kg, reps, rpe });
const aEj = asomaEjercicio('Press inclinado', [sEj('2026-11-13', 'a', 1, 16, 10, 8.5), sEj('2026-11-20', 'b', 1, 16, 9, 8), sEj('2026-11-20', 'b', 2, 16, 9, 8.5)]);
check(aEj.sub === '2 veces' && aEj.lineas[0].join('|') === 'Última vez, vie 20 nov|16×9 @8 · 16×9 @8,5' && /^Mejor marca, vie 13 nov\|16×10 @8,5 \(1RM estimado \d+[,.]\d kg\)$/.test(aEj.lineas[1].join('|'))
  && asomaEjercicio('Dominadas', []).sub === 'Aún no lo has hecho' && asomaEjercicio('Dominadas', [sEj('2026-11-20', 'b', 1, null, 7, 8)]).lineas.length === 1,
  `un ejercicio: su última vez y su mejor marca («${aEj.lineas[1][1]}»); sin carga, solo la última vez; sin historia, lo dice`);
const rot = asomaRotulo('Constancia: medalla de plata, 10 sesiones hechas. Siguiente: 50 sesiones hechas. Es la que tienes más cerca: te faltan 39');
check(rot.titulo === 'Constancia' && rot.sub === 'Medalla de plata, 10 sesiones hechas' && rot.pie === 'Siguiente: 50 sesiones hechas. Es la que tienes más cerca: te faltan 39' && asomaRotulo('') === null && asomaRotulo('Sin dos puntos').titulo === 'Sin dos puntos',
  'una medalla: lo que ya dice su rótulo (su metal y cuánto falta para la siguiente)');
const s1 = sitioAsoma({ left: 20, top: 400, bottom: 470, width: 350 }, 200), s2 = sitioAsoma({ left: 20, top: 100, bottom: 170, width: 350 }, 200), s3 = sitioAsoma({ left: 300, top: 700, bottom: 800, width: 80 }, 300, { vw: 390, vh: 844 });
check(s1.arriba && s1.y === 188 && s1.x === 35 && s1.w === 320 && !s2.arriba && s2.y === 182 && s3.x === 58 && s3.arriba && ASOMA_MS >= 350 && ASOMA_MS <= 500 && ASOMA_QUIETO === 10 && ASOMA_ABRE >= 44,
  'la tarjeta sale encima de lo que se toca si cabe (si no, debajo), sin salirse por los lados');
const asomarJsx = src('ui/atleta/asomar.jsx');
check(/if \(g \|\| e\.button > 0 \|\| e\.pointerType === 'mouse'\) return;/.test(asomarJsx) && /el\.addEventListener\('touchmove', frena, \{ passive: false \}\);/.test(asomarJsx) && /function frena\(e\) \{ if \(g\?\.abierta && e\.cancelable\) e\.preventDefault\(\); \}/.test(asomarJsx)
  && /if \(!g\.abierta\) \{ if \(Math\.hypot\(dx, dy\) > ASOMA_QUIETO\) \{ soltar\(g\.el\); g = null; \} return; \}/.test(asomarJsx) && /if \(s\.abre && e\.type !== 'pointercancel'\) \{ vibrar\('elegir'\); s\.el\.click\(\); \}/.test(asomarJsx),
  'solo con el dedo: si se mueve antes, es desplazar la página; con la tarjeta fuera, el dedo ya no la desplaza; subirlo y soltar la abre');
check(!/entreno-nombre|ss-etq|\.chip/.test(asomarJsx) && /nodo\.setAttribute\('aria-hidden', 'true'\)/.test(asomarJsx) && /const quitarAsomar = instalarAsomar\(leer\);/.test(barra) && /api: apiG, atleta: atletaG \};/.test(atletaApp),
  'llega con los gestos de la barra (nada en el arranque), no nombra clases de otras pantallas y no estorba al lector de pantalla');
check(/data-asoma=\{`sesion:\$\{sesion\.id\}`\}/.test(hoy) && /data-asoma=\{`ejercicio:\$\{e\.ejercicio_id\}`\}/.test(hoy) && /data-asoma=\{`ejercicio:\$\{e\.ejercicio_id\}`\}/.test(src('ui/atleta/Portada.jsx'))
  && /data-asoma=\{`sesion:\$\{e\.id\}`\} data-asoma-t=\{e\.nombre\}/.test(src('ui/atleta/Semana.jsx')) && /data-asoma="rotulo"/.test(logrosJsx) && /data-asoma="suyo" ref=\{\(el\) => \{ if \(el\) el\.__asoma = \(\) => \(\{ titulo: r\.nombre/.test(recetario),
  'se asoman las sesiones (Semana y «Tus entrenamientos»), los ejercicios de «Lo que vas a hacer», las recetas y las medallas');

console.log('\nLa semana y las gráficas, con las manos (229-235)');
const plan = src('ui/atleta/Plan.jsx'), vuelo = src('ui/atleta/vuelo-plan.js');
check(/data-d=\{d\}/.test(plan) && (plan.match(/data-ses=\{s\.id\}/g) || []).length === 3 && /const desde = d \? raiz\.current\?\.querySelector\(`\[data-ses="\$\{s\.id\}"\]`\)\?\.getBoundingClientRect\(\) : null;/.test(plan)
  && /if \(desde\) import\('\.\/vuelo-plan\.js'\)\.then\(\(m\) => m\.volarAlDia\(raiz\.current, s\.id, d, desde\)\)/.test(plan) && /if \(!raiz \|\| !desde \|\| sinMovimiento\(\)\) return;/.test(vuelo) && /raiz\.querySelector\(`\[data-d="\$\{dia\}"\] \[data-ses="\$\{id\}"\]`\)/.test(vuelo),
  '(229 y 230) la ficha de una sesión vuela desde donde estaba hasta su día de la tira (una detrás de otra al repartir); quieta con «reducir movimiento»');
check(/ref=\{\(el\) => \{ if \(el && el\.scrollWidth <= el\.clientWidth \+ 2\) escalaArrastrable\(el\); \}\}/.test(src('ui/atleta/Semana.jsx')), '(231) el bloque como una regla: el dedo pasa de semana al deslizar por S1, S2… (si caben; si no, la tira se desplaza como siempre)');
const pA = partesPunto('2 nov: 66,9 kg'), pB = partesPunto('23 nov: 76 kg, récord, semana en curso'), pT = partesPunto('26 oct: 62,2 kg (tendencia 62,5)');
check(pB.cifra === '76' && pB.valor === 76 && pB.unidad === 'kg' && pB.pie === 'kg · 23 nov · récord, semana en curso' && pT.cifra === '62,5' && pT.valor === 62.5 && pT.pie === 'kg de tendencia · 26 oct'
  && partesPunto('sin fecha') === null && partesPunto('1 ene: sin datos') === null && partesPunto('3 mar: −1.250,5 kcal').valor === -1250.5,
  '(234) el titular sigue al dedo: la cifra del punto y su fecha (en el peso, la tendencia, como el titular)');
check(cambioTramo(pA, pB, '2026-11-02', '2026-11-23') === '+9,1 kg en 3 semanas' && cambioTramo(pB, pA, '2026-11-23', '2026-11-02') === '−9,1 kg en 3 semanas' && cambioTramo(pA, pB, '2026-11-02', '2026-11-07') === '+9,1 kg en 5 días'
  && cambioTramo(pA, pB) === '+9,1 kg del 2 nov al 23 nov' && cambioTramo(pA, pA, '2026-11-02', '2026-11-03') === '±0 kg en 1 día' && cambioTramo(null, pB) === '' && puntoEn([10, 50, 90], 60) === 1 && puntoEn([10, 50, 90], 500) === 2,
  '(235) dos dedos marcan un tramo: cuánto ha cambiado y en cuánto tiempo («+9,1 kg en 3 semanas»)');
check(rangoAlPellizcar(4, 1, 1.4) === 0 && rangoAlPellizcar(4, 1, 0.7) === 2 && rangoAlPellizcar(4, 0, 1.4) === null && rangoAlPellizcar(4, 3, 0.7) === null && rangoAlPellizcar(4, 1, 1.1) === null && rangoAlPellizcar(1, 0, 2) === null
  && rangoAlPellizcar(4, -1, 2) === null && PELLIZCO > 1.2 && PELLIZCO_MS >= 300, '(233) pellizcar cambia el rango: abrir los dedos acerca (más corto) y juntarlos aleja, de uno en uno y sin pasarse');
const gdd = src('ui/grafica-dedos.js'), comunes = src('ui/comunes.jsx');
check(/useEffect\(\(\) => \{ if \(caja\.current\) caja\.current\.__graf = \{ W, xs, textoPunto, fechas \}; \}\);/.test(comunes) && /fechas=\{conFechas \? fx : null\}/.test(comunes) && /fechas=\{serie\.map\(\(p\) => p\.fecha\)\}/.test(comunes)
  && /const quitarGraficas = instalarGraficaDedos\(\);/.test(barra) && /if \(e\.pointerType === 'mouse'\) return;/.test(gdd) && /querySelector\('\[role="group"\]\[aria-label\^="Rango"\]'\)/.test(gdd) && /bs\[sig\]\.click\(\);/.test(gdd),
  'cada gráfica deja lo suyo en su caja y los gestos llegan aparte; el rango se cambia tocando su botón de siempre (que sigue ahí)');

console.log('\nTercera vuelta (v0.273). Un solo buscador (243)');
check(llano('  Sentadilla BÚLGARA ') === 'sentadilla bulgara' && puntosDe('Press banca', '', 'press') === 3 && puntosDe('Press banca', '', 'banca') === 2 && puntosDe('Superpress', '', 'press') === 1
  && puntosDe('Press banca', '', 'remo') === 0 && puntosDe('Modo zurdo', 'mano izquierda', 'izquierda') === 1 && puntosDe('Press banca', '', 'press ban') === 3 && puntosDe('Press banca', '', '  ') === 0
  && puntosDe('«Tu peso» (Hoy)', '', 'tu') === 2, 'compara sin tildes ni mayúsculas; primero lo que empieza por lo buscado, luego la palabra que empieza, luego lo que lo contiene (todas las palabras tienen que estar)');
const fuentes = { secciones: [['progreso', 'Progreso', 'progreso'], ['perfil', 'Perfil', 'perfil']], sesiones: [{ id: 's1', nombre: 'Torso A', fecha: '2026-11-23' }, { id: 's2', nombre: 'Pierna A', fecha: '2026-11-25' }],
  ejercicios: [{ id: 'e1', nombre: 'Press banca', veces: 12 }, { id: 'e2', nombre: 'Press militar', veces: 1 }, { id: 'e3', nombre: 'Remo con barra', veces: 9 }], recetas: [{ id: 'r1', nombre: 'Pollo al curry' }], guias: [{ clave: 'pecho', titulo: 'Pecho', subtitulo: 'Press y aperturas', publicada: true }] };
const bPress = buscarTodo('press', fuentes, { fecha: (f) => `el ${f}` });
check(bPress.map((g) => `${g.grupo}:${g.items.map((i) => i.titulo).join('/')}`).join('|') === 'Ejercicios:Press banca/Press militar|Guías:Pecho' && bPress[0].items[0].detalle === '12 series apuntadas' && bPress[0].items[1].detalle === '1 serie apuntada'
  && bPress[0].items[0].dato.id === 'e1' && buscarTodo('p', fuentes).length === 0 && buscarTodo('zzz', fuentes).length === 0, '«press»: sus ejercicios (con cuánto los ha hecho) y la guía que lo nombra; con una letra, nada');
const bTorso = buscarTodo('torso', fuentes, { fecha: (f) => `el ${f}` }), bZurdo = buscarTodo('zurdo', fuentes), bPro = buscarTodo('pro', fuentes), bIzq = buscarTodo('mano izquierda', fuentes);
check(bTorso[0].grupo === 'Tus sesiones' && bTorso[0].items[0].detalle === 'el 2026-11-23' && bTorso[0].items[0].tipo === 'sesion' && bZurdo.length === 1 && bZurdo[0].items[0].ancla === 'aj-zurdo' && bPro[0].grupo === 'Secciones' && bPro[0].items[0].id === 'progreso'
  && bIzq[0]?.items[0]?.titulo === 'Modo zurdo' && buscarTodo('pollo', fuentes)[0].items[0].tipo === 'receta', 'una sesión con su día, una sección, una receta y un ajuste (también por lo que hace: «mano izquierda» → Modo zurdo)');
const muchos = { ejercicios: Array.from({ length: 9 }, (_, k) => ({ id: `x${k}`, nombre: `Curl ${k}`, veces: 9 - k })) };
check(buscarTodo('curl', muchos)[0].items.length === 5 && buscarTodo('curl', muchos)[0].total === 9 && buscarTodo('curl', muchos, { tope: 3 })[0].items.length === 3, 'como mucho cinco por grupo, y dice cuántos hay');
check(JSON.stringify(ejerciciosDeHistorial([{ ejercicio_id: 'a', ejercicio: 'Remo', grupos: ['dorsal'] }, { ejercicio_id: 'b', ejercicio: 'Press' }, { ejercicio_id: 'b', ejercicio: 'Press' }, { ejercicio: 'sin id' }]).map((e) => [e.id, e.veces])) === '[["b",2],["a",1]]'
  && ejerciciosDeHistorial(null).length === 0, 'tus ejercicios salen de tus series, del más hecho al menos');
const ajustesJsx = src('ui/Ajustes.jsx');
check(AJUSTES_BUSCABLES.every(([texto, id]) => (id ? ajustesJsx.includes(`id="${id}"`) : ajustesJsx.includes(`titulo="${texto.split(' (')[0]}"`))) && AJUSTES_BUSCABLES.length >= 12,
  `los ${AJUSTES_BUSCABLES.length} ajustes que se pueden buscar existen en Ajustes (por su control o por el título de su fila)`);
const buscador = src('ui/atleta/BuscadorTodo.jsx'), barraMas = src('ui/BarraMas.jsx'), pedida = src('ui/busqueda-pedida.js');
check(/\{alBuscar && <FilaIos icono="buscar" titulo="Buscar en la app" detalle="Sesiones, ejercicios, recetas, guías y ajustes" alTocar=\{alBuscar\}/.test(barraMas) && /const BuscadorTodo = perezoso\(\(\) => import\('\.\/BuscadorTodo\.jsx'\), 'BuscadorTodo', \{ mientras: null \}\);/.test(atletaApp)
  && /leerRecetas=\{\(\) => recetarioEquipo\(\{ backend: backendG \}, atletaId\)\}/.test(atletaApp) && !/recetario-equipo/.test(buscador), 'está en «Más», arriba, y su código llega al tocarlo (las recetas se las da la app: importarlas ahí sacaría otro archivo al arranque)');
check(/if \(it\.tipo === 'ejercicio'\) \{ setEjercicio\(it\.dato\); return; \}/.test(buscador) && /if \(it\.tipo === 'sesion'\) abrirSesion\(it\.id\);/.test(buscador) && /pedirBusqueda\('recetas', it\.titulo\); irA\('recetas'\);/.test(buscador) && /pedirBusqueda\('aprende', it\.titulo\); irA\('aprende'\);/.test(buscador)
  && /location\.hash = '#ajustes';/.test(buscador) && /<p class="sr" role="status">/.test(buscador), 'cada cosa se abre en su sitio: la sesión, la ficha del ejercicio, la receta o la guía ya buscadas y el ajuste con su fila a la vista; el lector de pantalla oye cuántos resultados hay');
check(/useState\(\(\) => tomarBusqueda\('aprende'\)\)/.test(src('ui/Guias.jsx')) && /useState\(\(\) => tomarBusqueda\('recetas'\)\)/.test(recetario) && /window\.dispatchEvent\(new CustomEvent\(EVENTO_BUSCA, \{ detail: donde \}\)\)/.test(pedida) && /delete pedidas\[donde\];/.test(pedida),
  'Recetas y Aprende se abren con el texto ya puesto (una vez), también si ya estaban a la vista');

console.log('\nÍndice lateral (242), volver donde estabas (244) y esperas (245-248)');
check(conIndice(3, 2000, 844) && !conIndice(2, 5000, 844) && !conIndice(5, 1500, 844) && !conIndice(5, 5000, 0) && indiceEn(0, 100, 4) === 0 && indiceEn(26, 100, 4) === 1 && indiceEn(99, 100, 4) === 3 && indiceEn(-20, 100, 4) === 0 && indiceEn(500, 100, 4) === 3
  && indiceEn(10, 0, 4) === 0 && cortoDe('Desayunos') === 'Des' && cortoDe('noviembre de 2026') === 'Nov' && cortoDe('') === '', 'el índice sale con tres capítulos o más y más de dos pantallas; el dedo elige el suyo sin salirse; se lee con tres letras');
const indice = src('ui/IndiceLateral.jsx');
check(/aria-hidden="true" data-sin-deslizar=""/.test(indice) && /scrollIntoView\(\{ block: 'start', behavior: 'instant' \}\)/.test(indice) && /if \(k === st\.k\) return;/.test(indice) && /vibrar\('toque'\);/.test(indice)
  && /<IndiceLateral items=\{grupos\.map\(\(c\) => \(\{ id: `cap-\$\{c\.capitulo\}`, texto: c\.capitulo \}\)\)\} \/>/.test(recetario) && /<IndiceLateral items=\{estantes\.map\(\(e\) => \(\{ id: `est-\$\{e\.id\}`, texto: e\.nombre \}\)\)\} \/>/.test(src('ui/Guias.jsx'))
  && /\{meses\.length >= 3 && <IndiceLateral items=/.test(src('ui/atleta/Semana.jsx')), 'una tira en el borde (de adorno para el lector de pantalla): un toque por capítulo y salta a su título; en Recetas, Aprende y «Tus entrenamientos»');
check(/import\('\.\/barra-gestos\.jsx'\)\.then\(\(m\) => m\.marcarVuelta\(`\[data-asoma="sesion:\$\{id\}"\]`\)\)/.test(atletaApp) && /export function marcarVuelta\(selector\) \{/.test(barra) && /easing: sinMovimiento\(\) \? 'steps\(1, end\)' : 'ease-out'/.test(barra),
  '(244) al volver de una sesión, su fila se marca un instante (el sitio ya se guardaba: ui/posiciones.js); con «reducir movimiento», sin fundido');
check(/const PANTALLA = \{ semana: Semana, progreso: Progreso, mensajes: Mensajes, perfil: Perfil, comidas: Comidas, recetas: Recetas, aprende: Aprende, equipo: Equipo, checkin: Checkin \};/.test(atletaApp) && /onPointerDown=\{\(\) => PANTALLA\[id\]\?\.precargar\(\)\}/.test(atletaApp)
  && /if \(e\.target\.closest\?\.\('\[data-atajo="empezar"\], \[data-asoma\^="sesion:"\]'\)\) Sesion\.precargar\(\);/.test(atletaApp), '(245) al bajar el dedo sobre una pestaña, «Empezar» o una sesión, su pantalla ya se está pidiendo');
check(/\.siluetas \{ animation: sil-aparece \.25s ease-out \.2s both; \}/.test(src('estilos.css')), '(246) el esqueleto no sale si los datos llegan en menos de 0,2 s (y entra fundiéndose: no da un destello)');

console.log('\nLa hoja de estilos (tacto-b.css)');
const cssB = src('tacto-b.css'), sinComB = cssB.replace(/\/\*[\s\S]*?\*\//g, '');
check(!/[^\x00-\x7F]/.test(cssB) && !/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(sinComB) && !/@keyframes/.test(sinComB), 'solo ASCII, los colores por su nombre y sin @keyframes (lo que se mueve una vez lo mueve el código)');
check(main.indexOf("'./tacto-b.css'") > main.indexOf("'./tacto-a.css'") && main.indexOf("'./tacto-b.css'") < main.indexOf("'./color-capa.css'"), 'se carga detrás de la primera vuelta y antes de color-capa.css');
const sueltas = sinComB.split('}').map((r) => r.split('{')[0].trim()).filter((sel) => /^[.:]/.test(sel) && sel.split(/,(?![^(]*\))/).some((x) => !x.includes(':not(#n)') && !/^\s*(\.tabs-flota |::view-transition-(group|old|new)\(vt-viaje\)|\.dial-arriba$)/.test(x)));
check(sueltas.length === 0, `todas sus reglas llevan :not(#n) (viajan con su trozo sin empatar con las de otros)${sueltas.length ? `: ${sueltas.slice(0, 3).join(' | ')}` : ''}`);
check(/::view-transition-group\(vt-viaje\) \{ animation-duration: 380ms; animation-timing-function: cubic-bezier\(\.2, \.9, \.25, 1\); \}/.test(sinComB) && /::view-transition-old\(vt-viaje\), ::view-transition-new\(vt-viaje\) \{ animation-duration: 380ms; height: 100%; object-fit: cover; \}/.test(sinComB)
  && /\.dial-arriba \{[^}]*pointer-events: none; zoom: 1\.4; \}/.test(sinComB), 'los viajes duran lo que los demás elementos compartidos y recortan la foto a su hueco; el dial de la hoja, más grande y sin toque');
check((sinComB.match(/^\.gdd-[a-z-]+:not\(#n\):not\(#n\)/gm) || []).length === 5 && /^\.aso-capa\.capa:not\(#n\) \{/m.test(sinComB), 'las reglas que empataban con las de otra pantalla llevan su propio peso (no arrastran estilos al arranque)');
const tokens = new Set([...readdirSync(new URL('../web/src/', import.meta.url)).filter((f) => f.endsWith('.css')).map(src).join('\n').matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1]));
const sinDefinir = [...new Set([...`${sinCom}\n${sinComB}`.matchAll(/var\((--[a-zA-Z0-9-]+)/g)].map((m) => m[1]))].filter((t) => !tokens.has(t) && !/^--(mdl|rg|ct|lb|pst|coc|mnt|bg|aso|gdd|ind|bus)-/.test(t));
check(sinDefinir.length === 0, `las dos hojas solo usan medidas y colores que existen${sinDefinir.length ? `: no existe ${sinDefinir.join(', ')}` : ''} (un nombre que no existe no da error: deja la regla sin efecto)`);
check((sinComB.match(/^\.(ind|bus)-[a-z-]+:not\(#n\):not\(#n\)/gm) || []).length >= 12 && /\.ind-raiz:not\(#n\):not\(#n\) \{[^}]*touch-action: none;/.test(sinComB) && /@media \(prefers-reduced-transparency: reduce\) \{ \.ind-raiz:not\(#n\):not\(#n\) \{ background: var\(--hoja\); \} \}/.test(sinComB),
  'el índice y el buscador, con su propio peso; el índice no desplaza la página y, con «reducir transparencia», va opaco');
check(/\.mdl-giro:not\(#n\) \{[^}]*transform-style: preserve-3d;[^}]*touch-action: pan-y;/.test(sinComB) && /\.mdl-cara:not\(#n\) \{[^}]*backface-visibility: hidden;/.test(sinComB) && /\.mdl-dorso:not\(#n\) \{ transform: rotateY\(180deg\);/.test(sinComB)
  && /@media \(prefers-contrast: more\) \{ \.mdl-luz:not\(#n\) \{ display: none; \} \}/.test(sinComB), 'la medalla tiene dos caras de verdad; con más contraste, sin el brillo');
check(/:root\[data-zurdo\] \.zd-fila:not\(#n\), :root\[data-zurdo\] \.zd-cab:not\(#n\) \{ grid-template-columns: 52px 26px/.test(sinComB) && /:root\[data-zurdo\] \.zd-fila:not\(#n\) > \.zd-visto, :root\[data-zurdo\] \.zd-cab:not\(#n\) > :last-child \{ order: -1; \}/.test(sinComB)
  && /:root\[data-zurdo\] \.teclado-teclas:not\(#n\) > \.tecla-siguiente \{ grid-area: 4 \/ 1 \/ auto \/ span 2; \}/.test(sinComB) && (sinComB.match(/:root\[data-zurdo\]\[data-gimnasio\]/g) || []).length === 4,
  'zurdo: el visto, primero en la fila (también en modo gimnasio y en pantallas estrechas); en el teclado, −, + y «Siguiente» a la izquierda');
check(/\.mnt-boton:not\(#n\)\[data-llena\] \.mnt-fondo \{ transform: scaleX\(1\); transition: transform 1s linear; \}/.test(sinComB) && /@media \(prefers-reduced-motion: reduce\) \{ \.mnt-boton:not\(#n\)\[data-llena\] \.mnt-fondo \{ transition: none; \} \}/.test(sinComB),
  'el botón que se mantiene se llena en un segundo (con «reducir movimiento», de golpe)');
check(!/font-size:[^;]*\d(rem|px)/.test(sinComB) && (sinComB.match(/box-shadow:/g) || []).length === (sinComB.match(/box-shadow: var\(--[\w-]+\);/g) || []).length, 'las letras y las sombras, por sus nombres');

// (v0.273) en la CI de main, un «+» tocado justo al soltar la regla se perdía: la regla, al pararse, devolvía su valor
check(/const fuera = st\.emitido != null && a\.valor != null/.test(src('ui/Regla.jsx')) && /if \(!fuera\) a\.alSoltar/.test(src('ui/Regla.jsx')),
  'la regla: un «+» o una tecla tocados justo al soltarla ganan (al pararse no devuelve su valor si cambió desde fuera)');
console.log(`\n${ok} correctas, ${fallos} fallidas`);
if (fallos) process.exit(1);
