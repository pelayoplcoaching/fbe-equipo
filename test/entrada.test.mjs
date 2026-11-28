// (v0.288 y v0.289) La entrada (belleza 351-500), tanda G: el primer fotograma; el lobo, la noche y la salida. Aquí, lo puro (las imágenes de
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

// ---------------------------------------------------------------------------------------------------------------------
// (v0.289) Tanda G, segunda parte: el lobo y la noche (369 a 380), la salida (382, 383 y 386) y la portada corta (388)
// El archivo de arranque, en un navegador de mentira: qué decide con cada fecha, hora y lo que haya guardado
function arrancar({ fecha, guardado = {}, busqueda = '', almohadilla = '', automatico = false, azar = 0.5 } = {}) {
  const attrs = {}, estilo = {}, almacen = { ...guardado };
  const document = { documentElement: { setAttribute: (k, v) => { attrs[k] = v; }, style: { setProperty: (k, v) => { estilo[k] = v; } } }, querySelector: () => null, createElement: () => ({ setAttribute() {} }), title: '' };
  const window = { localStorage: { getItem: (k) => (k in almacen ? almacen[k] : null), setItem: (k, v) => { almacen[k] = String(v); } }, location: { search: busqueda, hash: almohadilla }, Promise, setTimeout: () => 0, navigator: { webdriver: automatico } };
  const RealDate = Date;
  const FakeDate = class extends RealDate { constructor(...a) { super(...(a.length ? a : [fecha])); } static now() { return new RealDate(fecha).getTime(); } };
  const FakeMath = Object.create(Math); FakeMath.random = () => azar;
  new Function('document', 'window', 'Date', 'Math', leer('web/arranque.js'))(document, window, FakeDate, FakeMath);
  return { attrs, estilo, almacen };
}
const { momentoDelDia, faseLuna, temporadaDe, SOL_MADRID } = await import('../web/src/logica/cielo.js');
const { ESTACIONES } = await import('../web/src/logica/imagenes.js');
const { ACENTOS } = await import('../web/src/logica/acentos.js');
const { LUPUS, estrellasLupus, OJOS_LOBO } = await import('../scripts/portada.mjs');
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

console.log('372 · El cielo de tu hora, decidido antes de pintar');
{
  let mal = [];
  for (let mes = 0; mes < 12; mes++) for (let h = 0; h < 24; h += 0.5) {
    const d = new Date(2026, mes, 15, Math.floor(h), (h % 1) * 60);
    const a = arrancar({ fecha: d }).attrs['data-cielo'];
    if (a !== momentoDelDia(h, iso(d))) mal.push(`${mes + 1}/${h}: ${a}`);
  }
  check(mal.length === 0 && SOL_MADRID.length === 12, `el mismo momento que el cielo de Hoy, a cualquier hora de cualquier mes ${mal.slice(0, 3).join(' ')}`);
  const css = estiloPortada();
  check(['amanecer', 'dia', 'atardecer'].every((m) => css.includes(`html[data-cielo=${m}] #portada .portada-halo{background:radial-gradient(`)) && css.includes('html[data-cielo=dia] #portada .portada-lupus,html[data-cielo=dia] #portada::after{display:none}'),
    'amanecer (rosado desde abajo), día (luz fría desde arriba, sin estrellas) y atardecer (naranja a la derecha), como una luz encima de la noche');
  check(new RegExp(`#portada\\{[^}]*background:${FONDO_PORTADA};`).test(css), 'la noche de base no cambia: del icono a la portada sigue sin salto');
}

console.log('371 · La luna, con su fase de verdad');
{
  let mal = 0;
  for (let i = 0; i < 60; i++) {
    const d = new Date(2026, 10, 1 + i, 23, 0);
    const a = arrancar({ fecha: d }); const f = faseLuna(d.getTime());
    if (Number(a.estilo['--luna-ilum']) !== Math.round(f.ilum * 100) / 100 || a.estilo['--luna-lado'] !== (f.creciente ? '-1' : '1') || (a.attrs['data-luna'] === 'llena') !== (f.ilum > 0.96)) mal++;
  }
  check(mal === 0, 'la misma luna que el cielo de Hoy, sesenta noches seguidas');
  const css = estiloPortada();
  check(css.includes('html[data-cielo=noche] #portada .portada-luna b{-webkit-mask-image:radial-gradient(ellipse 51% 51% at calc(50% + var(--luna-ilum,1)*var(--luna-lado,1)*104%) 50%') && css.includes('html[data-luna=llena] #portada .portada-luna b{-webkit-mask-image:none;mask-image:none}'),
    'la fase recorta el disco (solo de noche); llena, entera y con más resplandor');
}

console.log('373 a 375 · La constelación del Lobo, la estrella fugaz y la estación');
{
  const e = estrellasLupus();
  const de = (n) => e.find((x) => x.n === n);
  check(LUPUS.length === 16 && e.length === 16 && e.every((x) => x.x >= 6 && x.x <= 94 && x.y >= 6 && x.y <= 94) && new Set(e.map((x) => `${x.x},${x.y}`)).size === 16, 'dieciséis estrellas, cada una en su sitio y dentro de su caja');
  check(de('alfa').r === 2.6 && de('mu').r === 1.5 && de('eta').x < de('alfa').x && de('iota').x > de('alfa').x && de('ji').y < de('zeta').y && de('zeta').y === Math.max(...e.map((x) => x.y)),
    'como se ve en el cielo: el norte arriba, el este a la izquierda y las más brillantes, más grandes');
  const css = estiloPortada();
  check(veces(css.slice(css.indexOf('#portada .portada-lupus{'), css.indexOf('#portada::after{')), 'radial-gradient(') === 16 && marcadoPortada.includes('<i class="portada-lupus"></i>'), 'van dibujadas en la portada (sin imágenes)');
  const noche = new Date(2026, 5, 10, 2, 0);
  check('data-fugaz' in arrancar({ fecha: noche, azar: 0.05 }).attrs && !('data-fugaz' in arrancar({ fecha: noche, azar: 0.5 }).attrs) && !('data-fugaz' in arrancar({ fecha: new Date(2026, 5, 10, 12, 0), azar: 0.05 }).attrs),
    'una estrella fugaz, una de cada diez veces y solo de noche');
  let malE = [];
  for (let mes = 0; mes < 12; mes++) for (const dia of [1, 6, 7, 19, 20, 28]) {
    const d = new Date(2026, mes, dia, 12, 0);
    const a = arrancar({ fecha: d }).attrs['data-estacion'] || '';
    const esperada = temporadaDe(iso(d)) || (ESTACIONES[mes] === 'otono' ? 'otono' : '');
    if (a !== esperada) malE.push(`${dia}/${mes + 1}: ${a}`);
  }
  check(malE.length === 0, `la estación de la app: Navidad e invierno (copos) y otoño (dos hojas); en primavera y verano, nada ${malE.slice(0, 3).join(' ')}`);
  check(veces(marcadoPortada, 'class="portada-e') === 7 && veces(marcadoPortada, 'class="portada-e hoja"') === 2 && /@keyframes portada-cae\{from\{transform:translateY\(-12vh\)\}\}/.test(css) && !/portada-(cae|hoja|fugaz) [^;}]*infinite/.test(css),
    'caen una vez y se quedan quietos');
}

console.log('369, 370 y 376 a 379 · El lobo despierta, la luz de tu acento y las letras');
{
  const css = estiloPortada();
  check(OJOS_LOBO.length === 2 && veces(marcadoPortada, 'class="portada-ojo"') === 2 && /#portada \.portada-ojo\{[^}]*animation:portada-ojo \.7s ease-out 1s both\}/.test(css) && css.includes('@keyframes portada-ojo{0%{opacity:0}35%{opacity:.95}100%{opacity:0}}'),
    'los ojos se encienden un instante al acabar de dibujarse (y se apagan solos)');
  check(!/portada-(traza|rellena|lobo)\$/.test('portada-ojo') && leer('web/src/ui/portada.js').includes('/^portada-(traza|rellena|lobo)$/'), 'sin alargar la entrada: lo que se espera es el dibujo, no los ojos');
  check(css.includes('@keyframes portada-rellena{from{opacity:0;clip-path:inset(0 0 100% 0)}'), 'el relleno baja como una luz, de arriba abajo');
  const luz = (a) => { const h = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16)); const c = h(a.claro.morado), o = h(a.oscuro.morado); return c.map((v, i) => Math.round((v + o[i]) / 2)).join(','); };
  const fallan = ACENTOS.filter((a) => a.id !== 'morado').filter((a) => arrancar({ fecha: new Date(2026, 5, 10, 12, 0), guardado: { 'fbe-ajustes': JSON.stringify({ acento: a.id }) } }).estilo['--portada-luz'] !== luz(a)).map((a) => a.id);
  check(fallan.length === 0 && ACENTOS.length === 11 && !('--portada-luz' in arrancar({ fecha: new Date(2026, 5, 10, 12, 0), guardado: { 'fbe-ajustes': '{"acento":"morado"}' } }).estilo)
    && !('--portada-luz' in arrancar({ fecha: new Date(2026, 5, 10, 12, 0), guardado: { 'fbe-ajustes': '{"acento":"constructor"}' } }).estilo) && 'data-cielo' in arrancar({ fecha: new Date(2026, 5, 10, 12, 0), guardado: { 'fbe-ajustes': '{roto' } }).attrs,
    `la luz de detrás del lobo, del color de tu acento (los once; con ajustes rotos, la de siempre) ${fallan.join(' ')}`);
  check(css.includes('rgba(var(--portada-luz,96,68,228),.5)') && css.includes('#portada .portada-grano{') && marcadoPortada.includes('class="portada-grano"'), 'y con el grano de la casa encima');
  const entradas = ['portada-nombre', 'portada-filo', 'portada-palabra'].map((k) => css.slice(css.indexOf(`@keyframes ${k}{`), css.indexOf('}}', css.indexOf(`@keyframes ${k}{`))));
  check(entradas.every((k) => k.length > 20 && !k.includes('opacity')) && css.includes('@keyframes portada-nombre{from{font-stretch:62%;') && css.includes('@keyframes portada-filo{from{transform:scaleX(0)}}') && veces(marcadoPortada.slice(marcadoPortada.indexOf('class="portada-lema"'), marcadoPortada.indexOf('class="portada-pie"')), '<span>') === 3,
    'el nombre se abre de la letra estrecha a la ancha, el filo se dibuja del centro a los lados y el lema entra palabra a palabra (ninguno cambiando la opacidad)');
  const quieto = css.slice(css.indexOf('@media (prefers-reduced-motion:reduce)'));
  check(['.portada-lupus', '.portada-luna', '.portada-halo', '.portada-e', '.portada-lobo-relleno', '.portada-nombre', '.portada-filo', '.portada-lema span', '.portada-firma'].every((k) => quieto.includes(k)) && quieto.includes('#portada .portada-lobo-trazo,#portada .portada-ojo,#portada .portada-fugaz{display:none!important}'),
    'con «reducir movimiento», todo quieto y entero desde el principio');
  check(veces(css, 'infinite') === 2, 'lo único que no para mientras carga son las estrellas (como antes)');
}

console.log('380 y 388 · La firma, solo la primera vez del día; después, la portada corta');
{
  const d = new Date(2026, 10, 28, 9, 0);
  const primera = arrancar({ fecha: d });
  check(!('data-portada' in primera.attrs) && primera.almacen['fbe-portada-dia'] === '2026-11-28', 'la primera vez del día, la portada entera (y se apunta el día, solo eso)');
  check(arrancar({ fecha: d, guardado: primera.almacen }).attrs['data-portada'] === 'corta' && !('data-portada' in arrancar({ fecha: new Date(2026, 10, 29, 9, 0), guardado: primera.almacen }).attrs), 'si vuelves el mismo día, corta; al día siguiente, entera otra vez');
  check(arrancar({ fecha: d, almohadilla: '#mensajes/0a1b' }).attrs['data-portada'] === 'corta' && arrancar({ fecha: d, busqueda: '?accion=sesion', almohadilla: '#hoy' }).attrs['data-portada'] === 'corta' && !('data-portada' in arrancar({ fecha: d, almohadilla: '#hoy' }).attrs) && !('data-portada' in arrancar({ fecha: d, busqueda: '?demo' }).attrs),
    'y también si vienes de un aviso o de un atajo');
  check(!('data-fugaz' in arrancar({ fecha: new Date(2026, 5, 10, 2, 0), guardado: { 'fbe-portada-dia': '2026-06-10' }, azar: 0.01 }).attrs), 'en la corta, sin estrella fugaz');
  const css = estiloPortada();
  check(/html\[data-portada=corta\] #portada \.portada-nombre,[^{]*\.portada-firma-2,[^{]*\{display:none!important\}/.test(css) && css.includes('html[data-portada=corta] #portada .portada-lobo{width:min(112px,34vw,20vh);animation-duration:.26s}') && css.includes('html[data-portada=corta] #portada .portada-lobo-relleno{animation:none}'),
    'solo el lobo pequeño y la noche: sin nombre, lema ni firma, y sin dibujo que esperar');
  check(arrancar({ fecha: d, guardado: { 'fbe-probar-portada': '{"corta":true}' } }).attrs['data-portada'] !== 'corta' && arrancar({ fecha: d, guardado: { 'fbe-probar-portada': '{"corta":true,"cielo":"dia"}' }, automatico: true }).attrs['data-cielo'] === 'dia',
    'lo de las pruebas solo vale en un navegador automático');
}

console.log('382, 383 y 386 · La salida: la portada se abre y el lobo viaja siempre');
{
  const css = estiloPortada(); const p = leer('web/src/ui/portada.js');
  check(css.includes('@property --portada-r{syntax:"<length>";inherits:false;initial-value:0px}') && /#portada\.abre\{[^}]*mask-image:radial-gradient\(circle at var\(--ox,50%\) var\(--oy,40%\),transparent var\(--portada-r\)[^}]*animation:portada-abre \.3s/.test(css) && css.includes('@keyframes portada-abre{to{--portada-r:var(--portada-rmax,150vmax)}}'),
    'un círculo crece desde la luna y deja ver la app, en 300 ms');
  check(p.includes("if (puedeAbrirse() && !document.querySelector('.bdia')) {") && estiloPortada().includes('#portada.abre .portada-lupus,#portada.abre::after,#portada.fuera .portada-lupus,#portada.fuera::after{animation:none}'),
    'sobre la bienvenida del d\u00eda, que es la misma noche, la portada se funde (no hay nada que abrir); y al salir, sus estrellas se paran');
  check(p.includes("typeof CSS.registerProperty === 'function' && !document.documentElement.hasAttribute('data-ligero')") && p.includes("el.classList.add('fuera')") && /if \(sinSalida \|\| quieto\(\) \|\| document\.visibilityState === 'hidden'\)/.test(p),
    'donde no se puede (o en un móvil lento), el fundido de siempre; con «reducir movimiento», un corte');
  check(p.includes("const DESTINOS = '.bdia-marca svg, .marca img';") && !p.includes('startViewTransition') && !leer('web/src/diseno.css').includes('vt-lobo') && p.includes("copia.animate(["),
    'el lobo vuela al que haya debajo (la bienvenida, la cabecera de Hoy o la de entrar), sin transiciones de vista');
  check(p.includes("const fondo = document.querySelector('img.bdia-fondo');") && p.includes('if (fondo && !fondo.complete)') && /const tope = setTimeout\(acabar, TOPE_MS\);/.test(p), 'y la portada espera al fondo de la bienvenida (con su tope de siempre)');
}
// el vuelo, con elementos de mentira
{
  const { volarLobo } = await import('../web/src/ui/portada.js');
  const quitados = []; let animado = null;
  const copia = { style: {}, removeAttribute() {}, setAttribute() {}, querySelectorAll: () => [], remove() { quitados.push('copia'); }, animate(k, o) { animado = { k, o }; return { finished: new Promise(() => {}) }; } };
  const lobo = { style: {}, getBoundingClientRect: () => ({ left: 67, top: 190, width: 256, height: 293 }), animate() {}, cloneNode: () => copia };
  const destino = { style: { visibility: '' }, getBoundingClientRect: () => ({ left: 16, top: 12, width: 28, height: 28 }) };
  const cuerpo = []; globalThis.document = { body: { appendChild: (x) => cuerpo.push(x) } };
  const a = volarLobo(lobo, destino, 40);
  const fin = animado?.k?.[2]?.transform || '';
  const m = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([\d.]+)\)/.exec(fin);
  const k = Number(m?.[3]), x = Number(m?.[1]), y = Number(m?.[2]);
  check(!!a && cuerpo.length === 1 && lobo.style.visibility === 'hidden' && destino.style.visibility === 'hidden' && copia.style.position === 'fixed' && Math.abs(k - 28 / 293) < 0.001
    && Math.abs((67 + x) + (256 * k) / 2 - 30) < 0.5 && Math.abs((190 + y) + (293 * k) / 2 - 26) < 0.5,
    'la copia sale de donde está el lobo y aterriza centrada y entera en su destino');
  await new Promise((r) => setTimeout(r, 300));
  check(destino.style.visibility === '' && quitados.length === 1, 'al llegar, el lobo de destino vuelve a verse y la copia se quita (aunque la animación no avise)');
  check(volarLobo({ getBoundingClientRect: () => ({ width: 0 }) }, destino) === null && volarLobo({}, {}) === null, 'sin medidas, no vuela (y no rompe nada)');
  delete globalThis.document;
}

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
