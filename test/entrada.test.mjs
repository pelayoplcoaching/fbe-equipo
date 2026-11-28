// (v0.288) La entrada (belleza 351-500), tanda G, primera parte: el primer fotograma. Aquí, lo puro (las imágenes de
// arranque de iOS, la portada tal como va escrita en la página, la barra de carga, el color de la barra del sistema, qué
// app es) y que cada pieza está en su sitio; en el navegador, la parte principal de test/e2e.test.mjs.
//   node test/entrada.test.mjs
import { readFileSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { PANTALLAS_IOS, pngLiso } from '../scripts/arranque-ios.mjs';
import { estiloPortada, marcadoPortada, spriteLobo, FONDO_PORTADA } from '../scripts/portada.mjs';
import { LOBO_D } from '../web/src/ui/lobo-trazo.js';
import { mezclaColor, rematarLobo } from '../web/src/ui/portada.js';
import { appDe } from '../web/src/ui/app-movil.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const raiz = (r) => new URL(`../${r}`, import.meta.url);
const leer = (r) => readFileSync(raiz(r), 'utf8');
const veces = (t, x) => t.split(x).length - 1;

console.log('351 · iPhone y iPad instalados: la noche desde el toque');
{
  const claves = PANTALLAS_IOS.map(([w, h, d]) => `${w}x${h}@${d}`);
  check(PANTALLAS_IOS.length >= 19 && new Set(claves).size === claves.length && PANTALLAS_IOS.every(([w, h, d]) => w < h && (d === 2 || d === 3)), `una por pantalla (${PANTALLAS_IOS.length}), en vertical y sin repetir`);
  const pix = new Set(PANTALLAS_IOS.flatMap(([w, h, d, a]) => [`${w * d}x${h * d}`, ...(a ? [`${h * d}x${w * d}`] : [])]));
  check(pix.size === PANTALLAS_IOS.length + PANTALLAS_IOS.filter((x) => x[3]).length, 'ningún tamaño en píxeles pisa a otro (cada una, su archivo)');
  check(PANTALLAS_IOS.filter((x) => x[3]).every(([w]) => w >= 744) && PANTALLAS_IOS.filter((x) => !x[3]).every(([w]) => w < 744), 'las tabletas, también apaisadas');
  const png = pngLiso(1170, 2532, FONDO_PORTADA);
  const firma = png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const trozos = []; for (let i = 8; i < png.length;) { const n = png.readUInt32BE(i); trozos.push([png.toString('ascii', i + 4, i + 8), png.subarray(i + 8, i + 8 + n)]); i += 12 + n; }
  const de = (t) => trozos.find((x) => x[0] === t)?.[1];
  check(firma && trozos.map((x) => x[0]).join(',') === 'IHDR,PLTE,IDAT,IEND' && de('IHDR').readUInt32BE(0) === 1170 && de('IHDR').readUInt32BE(4) === 2532 && de('IHDR')[8] === 8 && de('IHDR')[9] === 3, 'un PNG de verdad, de su tamaño exacto');
  const puntos = inflateSync(de('IDAT'));
  check([...de('PLTE')].join(',') === '30,21,72' && puntos.length === (1 + 1170) * 2532 && puntos.every((b) => b === 0), 'liso, del color de la noche de la portada');
  check(png.length < 6000, `y casi no pesa (${png.length} bytes)`);
  let mal = 0; try { pngLiso(0, 10, '#000000'); } catch { mal++; } try { pngLiso(10, 10, 'morado'); } catch { mal++; }
  check(mal === 2, 'con medidas o color que no valen, no escribe nada');
  const b = leer('scripts/build.mjs');
  check(b.includes('apple-touch-startup-image') && b.includes('pngLiso(an, al, FONDO_PORTADA)') && /soloInstalar = \(f\) => f\.startsWith\('arranque\/'\) \|\| f\.startsWith\('instalar\/'\)/.test(b), 'se hacen al construir, con su enlace en la página, y no se guardan para usar sin conexión');
}

console.log('353 a 357 · Lo que pide el móvil al instalar');
{
  const b = leer('scripts/build.mjs');
  const iconos = ['icono-maskable-512.png', 'lobo-mono-512.png', 'esencial.svg', 'esencial-180.png', 'esencial-192.png', 'esencial-512.png', 'esencial-maskable-512.png',
    'atajo-sesion-192.png', 'atajo-checkin-192.png', 'atajo-mensajes-192.png', 'atajo-revisar-192.png', 'atajo-e-sesion-192.png', 'atajo-e-semana-192.png', 'atajo-e-progreso-192.png'];
  check(iconos.every((n) => existsSync(raiz(`web/iconos/${n}`)) && b.includes(`'${n}'`)), 'cada icono nuevo está en web/iconos/ y se copia');
  const medida = (n) => { const f = readFileSync(raiz(`web/iconos/${n}`)); return `${f.readUInt32BE(16)}x${f.readUInt32BE(20)}`; };
  check(iconos.filter((n) => n.endsWith('.png')).every((n) => medida(n) === `${/-(\d+)\.png$/.exec(n)[1]}x${/-(\d+)\.png$/.exec(n)[1]}`), 'y mide lo que dice su nombre');
  check(['equipo', 'esencial'].every((a) => ['hoy', 'sesion', 'progreso'].every((x) => existsSync(raiz(`web/instalar/${a}-${x}.webp`)))), 'tres capturas por app para la ficha de instalar de Android');
  check(b.includes("'manifest-esencial.webmanifest'") && b.includes("name: 'FBE Esencial', short_name: 'FBE Esencial'") && !/\bid:\s*'/.test(b.slice(b.indexOf('Dos manifiestos'), b.indexOf('// config.js y sw.js'))), 'FBE Esencial, con su manifiesto (y los dos sin id: es la misma app instalada)');
  check(b.includes("'maskable')") && b.includes("'monochrome')") && !b.includes("'any maskable'"), 'el icono con zona segura y el de un color, aparte del normal');
  check(veces(b, "atajo('") === 7 && iconos.filter((n) => n.startsWith('atajo-')).every((n) => veces(b, `'${n}')`) === 1), 'cada atajo, con su dibujo');
  const m = leer('web/src/ui/app-movil.js');
  check(appDe(true) === 'esencial' && appDe(false) === 'equipo' && m.includes("'fbe-app'") && !/nombre|email|atleta\./.test(m.replace(/\/\/.*$/gm, '').replace(/\/\*.*?\*\//g, '')), 'en el móvil solo se apunta qué app es (nada de la cuenta)');
  check(leer('web/src/ui/App.jsx').includes("apuntarApp(appDe(estado.fase === 'atleta' && esPorSuCuenta(estado.atleta)), { recordar: backend.modo !== 'demo' })"), 'se apunta al entrar (en la demo, no)');
}

console.log('361 y 362 · La portada se pinta antes que nada, y cada app con su nombre');
{
  const a = leer('web/arranque.js');
  const sinCom = a.replace(/^\s*\/\/.*$/gm, '');
  check(!/=>|\bconst\b|\blet\b|`|\?\.|\?\?|\bimport\b|\bclass\b/.test(sinCom), 'el archivo de arranque, sin sintaxis moderna (vale en cualquier navegador)');
  check(/l\.media = 'print'/.test(a) && /l\.media = 'all'/.test(a) && a.includes('w.__fbeEstilos = new Promise') && a.includes('w.setTimeout(fin, 10000)'), 'pone los estilos sin frenar el primer pintado, y avisa cuando están');
  check(a.includes("leer('fbe-app')") && a.includes("setAttribute('data-app', 'esencial')") && a.includes("d.title = 'FBE Esencial'") && a.includes("'manifest-esencial.webmanifest'") && a.includes("'esencial-180.png'"), 'y dice qué app es antes de pintar: nombre, pestaña, manifiesto e icono');
  const app = (q, guardada) => (/[?&]demo=esencial(&|$)/.test(q) || /[?&]plan=esencial(&|$)/.test(q) ? 'esencial' : /[?&]demo(=|&|$)/.test(q) ? 'equipo' : guardada);
  check(a.includes('/[?&]demo=esencial(&|$)/') && a.includes('/[?&]plan=esencial(&|$)/') && a.includes('/[?&]demo(=|&|$)/')
    && app('?demo=esencial', 'equipo') === 'esencial' && app('?codigo=FBE-1&plan=esencial', null) === 'esencial' && app('?demo', 'esencial') === 'equipo' && app('?demo&paleta', 'esencial') === 'equipo' && app('', 'esencial') === 'esencial' && app('?plan=esencialx', null) === null,
    'por la demo, por la invitación o por la última cuenta de este móvil');
  const h = leer('web/index.html');
  const pos = (x) => h.indexOf(x);
  check(pos('rel="preload" href="app.css') > 0 && !/rel="stylesheet"/.test(h) && pos('<!--PORTADA-ESTILO-->') < pos('<script src="arranque.js') && pos('<script src="arranque.js') < pos('<script src="config.js') && !/<script(?![^>]*\bsrc=)/.test(h),
    'la página precarga los estilos (no los enlaza) y el arranque va en su archivo, delante de todo (sin guiones escritos dentro)');
  const e = leer('web/src/ui/estilos-app.js');
  check(e.includes('globalThis.__fbeEstilos') && e.includes('pre.after(l)') && veces(leer('web/src/main.jsx'), 'estilosApp()') === 2 && leer('web/src/main.jsx').indexOf('await estilosApp();') < leer('web/src/main.jsx').indexOf('render(<App'),
    'la app espera a sus estilos antes de montar nada (y si el arranque no llegó, los pone ella)');
  const b = leer('scripts/build.mjs');
  check(b.includes("f === 'arranque.js' ? `${f}?v=${version}`") && b.includes("for (const f of ['sw.js', 'config.js', 'arranque.js']) soloAscii"), 'el arranque se guarda para abrir sin cobertura, con su versión, y va en ASCII');
  check(veces(marcadoPortada, 'FBE Equipo') === 2 && veces(marcadoPortada, 'FBE Esencial') === 2 && veces(marcadoPortada, 'class="pn-equipo"') + veces(marcadoPortada, ' pn-equipo"') === 2 && !marcadoPortada.includes('aria-label'),
    'los dos nombres van escritos (a la vista y para el lector) y se enseña el de su app');
  const css = estiloPortada();
  check(css.includes('#portada .pn-esencial,html[data-app=esencial] #portada .pn-equipo{display:none}') && css.includes('html[data-app=esencial] #portada .pn-esencial{display:revert}'), 'eligiendo con <html data-app>');
  check(!/[^\x00-\x7f]/.test(marcadoPortada) && !/[^\x00-\x7f]/.test(css), 'la portada, en ASCII (la demo es una página sin juego de caracteres)');
}

console.log('351 y 352 · Del icono a la portada, sin salto');
{
  const css = estiloPortada();
  check(css.includes(`html.hay-portada{background:${FONDO_PORTADA}}`) && new RegExp(`#portada\\{[^}]*background:${FONDO_PORTADA};`).test(css), 'el primer fotograma es la noche lisa (la de la imagen de arranque y la del manifiesto)');
  check(/#portada \.portada-halo\{[^}]*z-index:-1[^}]*radial-gradient[^}]*animation:portada-halo \.5s/.test(css) && css.includes('@keyframes portada-halo{from{opacity:0}}') && marcadoPortada.includes('<span class="portada-halo" aria-hidden="true"></span>'),
    'y la luz de detrás del lobo llega encima, en medio segundo');
  check(/prefers-reduced-motion:reduce\)\{[^@]*#portada \.portada-halo\{animation:none\}|prefers-reduced-motion:reduce\)\{[^@]*#portada \.portada-halo[^{]*\{animation:none\}/.test(css), 'con «reducir movimiento», puesta desde el principio');
  check(leer('scripts/build.mjs').includes('background_color: FONDO_PORTADA, theme_color: FONDO_PORTADA'), 'Android arranca en ese mismo color');
}

console.log('364 a 366 · La barra de carga dice la verdad y el lobo termina su gesto');
{
  const css = estiloPortada();
  check(/#portada \.portada-carga\{[^}]*visibility:hidden;animation:portada-ver 0s \.5s forwards\}/.test(css), 'la barra solo aparece si la carga pasa de medio segundo');
  check(css.includes('transform:scaleX(var(--carga,.3))') && css.includes('#portada[data-carga] .portada-carga span{animation:none}') && !/portada-carga [^;}]*infinite/.test(css), 'avanza con --carga (ya no va y viene sin fin)');
  const m = leer('web/src/main.jsx'); const p = leer('web/src/ui/portada.js');
  const tramos = [m.indexOf('avanzarPortada(0.45)'), m.indexOf('await backend.iniciar()'), m.indexOf('avanzarPortada(0.65)')];
  check(tramos.every((x) => x > 0) && tramos[0] < tramos[1] && tramos[1] < tramos[2] && p.includes('avanzarPortada(0.85)') && p.includes('avanzarPortada(1)'), 'por tramos de verdad: el código, la cuenta, tu día, y llena al entrar');
  check(/Math\.max\(Number\(el\.style\.getPropertyValue\('--carga'\)\) \|\| 0/.test(p), 'y nunca hacia atrás');
  check(/INSTANTE_MS = 150/.test(p) && /REMATE_MS = 300/.test(p) && p.includes("if (t < INSTANTE_MS) { quitarYa({ sinSalida: true }); return; }"), 'si todo estaba listo antes de 150 ms, sin portada');
}
// el lobo acaba su gesto: animaciones de mentira
const anim = (nombre, fin, ahora, estado = 'running') => ({ animationName: nombre, playState: estado, currentTime: ahora, effect: { getComputedTiming: () => ({ endTime: fin }) }, ritmo: 1, updatePlaybackRate(r) { this.ritmo = r; }, finish() { this.playState = 'finished'; } });
{
  const a = [anim('portada-traza', 850, 250), anim('portada-rellena', 950, 250), anim('portada-estrellas', Infinity, 100), anim('portada-carga', 2600, 100)];
  const el = { getAnimations: () => a };
  const t0 = Date.now();
  const espera = await rematarLobo(el);
  const tardo = Date.now() - t0;
  check(espera === 300 && tardo >= 280 && tardo < 600 && Math.abs(a[0].ritmo - 700 / 300) < 0.01 && a[1].ritmo === a[0].ritmo && a[2].ritmo === 1 && a[3].ritmo === 1 && a[0].playState === 'finished' && a[1].playState === 'finished' && a[2].playState === 'running', `a mitad del dibujo, el trazo se acelera y acaba en 300 ms como mucho (${tardo} ms; ni las estrellas ni la barra se tocan)`);
  const b = [anim('portada-traza', 850, 700), anim('portada-rellena', 950, 800)];
  const t1 = Date.now(); const e2 = await rematarLobo({ getAnimations: () => b });
  check(e2 === 150 && Date.now() - t1 < 400 && b[0].ritmo === 1, 'si le falta menos, a su paso');
  const c = [anim('portada-traza', 850, 850, 'finished')];
  check(await rematarLobo({ getAnimations: () => c }) === 0 && await rematarLobo({}) === 0 && await rematarLobo({ getAnimations: () => { throw new Error('x'); } }) === 0, 'y si ya acabó (o no hay animaciones), no se espera nada');
}

console.log('358 · La barra del sistema, de la noche al color de la app');
check(mezclaColor('#1E1548', '#EEEEF2', 0) === '#1e1548' && mezclaColor('#1E1548', '#EEEEF2', 1) === '#eeeef2' && mezclaColor('#000000', '#ffffff', 0.5) === '#808080', 'en pasos intermedios');
check(mezclaColor('#1E1548', 'tomato', 0.5) === 'tomato' && mezclaColor('#000000', '#ffffff', 7) === '#ffffff' && mezclaColor('#000000', '#ffffff', -1) === '#000000', 'con un color que no entiende, el de destino; y sin pasarse');
{
  const p = leer('web/src/ui/portada.js');
  check(p.includes("el.dataset.sale = ''") && p.includes('fundirBarra()') && p.includes("if (quieto() || !aRgb(destino) || !aRgb(desde) || typeof requestAnimationFrame !== 'function') { tc.remove(); return; }"), 'solo al salir la portada; con «reducir movimiento», de una vez');
}

console.log('363 · Mientras se ve la portada, la app adelanta trabajo');
{
  const a = leer('web/src/ui/adelanto.js'); const m = leer('web/src/main.jsx');
  check(m.includes('listaImagenes.then(() => { adelantarBienvenida(); })') && m.indexOf('adelantarBienvenida();') < m.indexOf('await backend.iniciar()'), 'el fondo de la bienvenida de esta hora se pide antes de resolver la cuenta');
  check(a.includes('navigator.connection?.saveData') && a.includes("localStorage.getItem('fbe-ultimo-rol') === 'coach'") && a.includes('imagenBienvenida(ahora.getHours(), hoyISO(ahora))'), 'no con el ahorro de datos, ni en el móvil del coach');
}

console.log('367 y 368 · El trazado del lobo, una sola vez; y sin salto de letra');
{
  check(veces(spriteLobo, LOBO_D) === 1 && veces(marcadoPortada, LOBO_D) === 1 && veces(marcadoPortada, 'href="#fbe-lobo"') === 2 && spriteLobo.includes('pathLength="1"'), 'la portada dibuja el lobo con el trazado que ya va en la página');
  const css = estiloPortada({ fuente: "@font-face{font-family:'Archivo Variable';font-display:block;src:url(x)}" });
  check(css.startsWith("<style>\n@font-face{font-family:'Archivo Variable';font-display:block") && leer('scripts/build.mjs').includes(".replace('font-display:swap', 'font-display:block')") && leer('web/index.html').includes('rel="preload" href="fonts/archivo-latin.woff2"'),
    'la portada lleva su letra y la espera (ya se precarga): el nombre no cambia de letra a media portada');
}

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
