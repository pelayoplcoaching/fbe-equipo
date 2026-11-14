// El guardián del color (claude/color-mejoras.md, mejora 20): la paleta (logica/paleta.js) y su CSS (color.css, generado),
// el contraste de todas las parejas texto/fondo en claro, oscuro y negro puro con cada acento, y que no aparecen colores
// sueltos nuevos fuera de la paleta.
//   node test/color.test.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import * as P from '../web/src/logica/paleta.js';
import { cssPaleta } from '../web/src/logica/paleta-css.js';
import { acentoValido, parejasVidrio, contrasteCeldas } from '../web/src/logica/acentos.js';
import { paletaDe } from '../web/src/logica/compartir.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const src = (r) => readFileSync(new URL(`../web/src/${r}`, import.meta.url), 'utf8');

console.log('\nLas escalas (1)');
{
  const ks = Object.keys(P.ESCALAS);
  check(ks.length === 10 && ks.every((k) => Object.keys(P.ESCALAS[k]).length === 11), 'diez escalas, de 50 a 950 (once pasos)');
  check(ks.every((k) => P.PASOS.every((p, i) => i === 0 || P.aOklch(P.ESCALAS[k][p])[0] < P.aOklch(P.ESCALAS[k][P.PASOS[i - 1]])[0])), 'en cada una, la luminosidad baja paso a paso (repartida por percepción)');
  const malas600 = ks.filter((k) => P.contraste(P.ESCALAS[k][600], '#FFFFFF') < 4.5);
  check(malas600.length === 0, `el paso 600 pasa AA sobre blanco en todas${malas600.length ? `: falla ${malas600}` : ''}`);
  const malas300 = ks.filter((k) => P.contraste(P.ESCALAS[k][300], P.NOCHE[1]) < 4.5);
  check(malas300.length === 0, `y el 300, sobre el fondo oscuro${malas300.length ? `: falla ${malas300}` : ''}`);
  check(Math.abs(P.aOklch(P.ESCALAS.marca[600])[2] - P.aOklch('#5438D8')[2]) < 4 && P.distancia(P.ESCALAS.marca[600], '#5438D8') < 0.04, 'el morado FBE de siempre queda en el 600 de la marca (afinado, reconocible)');
  check(Math.max(...P.PASOS.map((p) => P.aOklch(P.ESCALAS.neutro[p])[1])) <= 0.035, 'los neutros, con un toque mínimo de la marca (croma ≤ 0,035; antes, 0,04–0,05)');
  check(Object.values(P.NOCHE).every((h, i, a) => i === 0 || P.aOklch(h)[0] > P.aOklch(a[i - 1])[0]), 'la noche: cada nivel del tema oscuro, un poco más claro (la profundidad, con luz)');
}

console.log('\ncolor.css, generado y única fuente (2)');
{
  check(src('color.css') === cssPaleta(), 'color.css está al día con logica/paleta.js (npm run paleta)');
  const est = src('estilos.css');
  const raiz = est.slice(est.indexOf(':root {'), est.indexOf('\n}', est.indexOf(':root {')));
  check(!/--(tiza|hoja|tinta|morado|ok|alerta|aviso|hero):/.test(raiz), 'estilos.css ya no define los colores de los temas: vienen de color.css');
  check(/import '\.\/color\.css';\nimport '\.\/estilos\.css';/.test(src('main.jsx')) && /import '\.\/color-capa\.css';/.test(src('main.jsx')), 'color.css se carga antes que todo y la capa de color, la última');
  const css = src('color.css');
  check(['--superficie-1', '--texto-2', '--accion', '--accion-pulsado', '--info-solido', '--ok-borde', '--grad-noche', '--grad-record', '--serie-8', '--seq-5', '--div-5', '--confeti-6'].every((t) => css.includes(`${t}:`)), 'los tokens con significado (superficies, textos, acción, estados, degradados, gráficas, celebraciones y sombras)');
  check(/@supports \(background: linear-gradient\(in oklch, red, blue\)\)/.test(css) && /linear-gradient\(in oklch 160deg/.test(css), 'los degradados se interpolan en OKLCH donde se puede (8)');
  check(/--sombra-tarjeta: 0 0 0 1px var\(--borde\), inset 0 1px 0 rgba\(255, 255, 255/.test(src('color-capa.css')), 'en oscuro, la profundidad con un filo de luz (7, 10)');
}

console.log('\nContraste de todas las parejas (4–7, 17, 18)');
{
  const malas = [];
  for (const tema of ['claro', 'oscuro', 'oled']) {
    const sup = Object.values(P.SUPERFICIES[tema]);
    const textos = ['tinta', 'tinta-2', 'tinta-3', 'ok', 'aviso', 'alerta', 'info', 'oro-texto'];
    for (const t of textos) for (const f of sup) { const r = P.contraste(P.valor(tema, t), f); if (r < 4.5) malas.push(`${tema} ${t}/${f} ${r}`); }
    for (const k of ['ok', 'aviso', 'alerta', 'info']) { const r = P.contraste(P.valor(tema, k), P.valor(tema, `${k}-suave`)); if (r < 4.5) malas.push(`${tema} ${k} sobre su fondo ${r}`); }
    for (const k of ['ok', 'aviso', 'alerta', 'info']) for (const f of sup) { const r = P.contraste(P.valor(tema, `${k}-borde`), f); if (r < 1.3) malas.push(`${tema} ${k}-borde apenas se ve ${r}`); }
    const hero = [P.valor(tema, 'hero'), ...P.ACENTOS.map((a) => (tema === 'claro' ? a.claro : a.oscuro).hero2), ...['azul', 'turquesa', 'ambar', 'verde'].map((k) => P.ESCALAS[k][900])];
    for (const f of hero) { if (P.contraste(P.valor(tema, 'sobre-hero'), f) < 4.5) malas.push(`${tema} texto de la tarjeta del día sobre ${f}`); }
    if (P.contraste(P.valor(tema, 'sobre-hero-2'), P.valor(tema, 'hero')) < 4.5) malas.push(`${tema} texto 2 de la tarjeta`);
    for (const k of ['int-trabajo', 'int-descanso', 'int-preparar', 'int-fin']) if (P.contraste('#FFFFFF', P.valor(tema, k)) < 4.5) malas.push(`${tema} blanco sobre ${k}`);
  }
  for (const k of ['disco-rojo', 'disco-azul', 'disco-verde', 'av-1', 'av-2', 'av-3', 'av-4', 'av-5', 'av-6']) if (P.contraste('#FFFFFF', P.valor('claro', k)) < 4.5) malas.push(`blanco sobre ${k}`);
  check(malas.length === 0, `textos, estados, tarjeta del día (con cada tono y acento) e intervalos pasan AA en claro, oscuro y negro puro${malas.length ? `: ${malas.slice(0, 4).join('; ')}` : ''}`);
  const dalt = [];
  for (const tema of ['claro', 'oscuro']) for (const k of ['ok', 'alerta']) for (const f of Object.values(P.SUPERFICIES[tema])) if (P.contraste(P.DALTONISMO[tema][k], f) < 4.5) dalt.push(`${tema} ${k}`);
  const tono = (h) => P.aOklch(h)[2];
  check(dalt.length === 0 && tono(P.DALTONISMO.claro.ok) > 220 && tono(P.DALTONISMO.claro.ok) < 280 && tono(P.DALTONISMO.claro.alerta) > 30 && tono(P.DALTONISMO.claro.alerta) < 70, 'con la ayuda para daltonismo: lo hecho en azul y lo que falla en naranja, y siguen pasando AA (18)');
  const alto = [];
  for (const tema of ['claro', 'oscuro']) for (const k of ['tinta', 'tinta-2', 'tinta-3']) for (const f of Object.values(P.SUPERFICIES[tema])) { const r = P.contraste(P.ALTO_CONTRASTE[tema][k], f); if (r < 7) alto.push(`${tema} ${k} ${r}`); }
  check(alto.length === 0, `con alto contraste, todos los textos llegan a AAA (7:1) (17)${alto.length ? `: ${alto.slice(0, 3)}` : ''}`);
}

console.log('\nLos acentos (16)');
{
  check(P.ACENTOS.length === 8 && ['oceano', 'lima'].every((id) => P.ACENTOS.some((a) => a.id === id)), 'ocho acentos: los seis de siempre, Océano y Lima');
  const malos = P.ACENTOS.filter((a) => !acentoValido(a)).map((a) => a.id);
  check(malos.length === 0, `todos pasan AA como texto, en botones y en la tarjeta del día, en claro, oscuro y negro puro${malos.length ? `: ${malos}` : ''}`);
  const vid = P.ACENTOS.flatMap((a) => ['claro', 'oscuro', 'oled'].flatMap((t) => ['barra', 'cabecera', 'hoja'].flatMap((tipo) => parejasVidrio(a, t, tipo).filter((x) => x.ratio < 4.5).map((x) => `${a.id}/${t}/${x.que}`))));
  const cel = P.ACENTOS.flatMap((a) => ['claro', 'oscuro', 'oled'].filter((t) => contrasteCeldas(a, t).ratio < 3).map((t) => `${a.id}/${t}`));
  check(vid.length === 0 && cel.length === 0, `también sobre el vidrio y en el calendario de constancia${vid.length + cel.length ? `: ${[...vid, ...cel].slice(0, 3)}` : ''}`);
  const n = paletaDe('noche'), az = paletaDe('noche', 'azul'), cl = paletaDe('clara', 'azul');
  check(paletaDe('noche', 'morado') === n && az.morado !== n.morado && az.noche === P.ACENTOS.find((a) => a.id === 'azul').claro.hero2 && cl === paletaDe('clara'), 'la tarjeta de compartir «Noche» sigue el acento elegido (con el morado, la de siempre; las demás paletas, igual)');
  check(/else acentoTravesia\(ac\.claro\.morado, ac\.oscuro\.morado\)/.test(src('ui/atleta/Travesia.jsx')) && /--serie-1: var\(--morado\)/.test(src('color.css')) && /var\(--morado\) 0%, var\(--rosa-400\)/.test(src('color.css')), 'y el juego del descanso, la primera serie de las gráficas y el degradado Amanecer');
}

console.log('\nLa tarjeta del día, los iconos y la interacción (9, 11, 13)');
{
  check(P.tonoDia({ hero: 'entreno', sesion: 'fuerza' }) === 'fuerza' && P.tonoDia({ hero: 'entreno', sesion: 'cardio' }) === 'cardio' && P.tonoDia({ hero: 'entreno', sesion: 'movilidad' }) === 'movilidad'
    && P.tonoDia({ hero: 'entreno', sesion: 'fuerza', foco: 'descarga' }) === 'descarga' && P.tonoDia({ hero: 'descanso' }) === 'descanso' && P.tonoDia({ hero: 'hecha' }) === 'hecha' && P.tonoDia() === 'fuerza',
  'el tono de la tarjeta: fuerza, cardio, movilidad, descarga, descanso y hecha');
  const capa = src('color-capa.css');
  check(['cardio', 'movilidad', 'descanso', 'descarga', 'hecha'].every((t) => capa.includes(`.hero-dia[data-tono="${t}"]`)) && /data-tono=\{tonoDia\(/.test(src('ui/atleta/Hoy.jsx')), 'cada tono tiene su brillo y la tarjeta del día lo lleva');
  check(P.trozosCerrados('M3 3h4v4H3zM12 12l4 4') === 'M3 3h4v4H3z' && P.trozosCerrados('M5 12l5 5') === '' && P.trozosCerrados('M2 2h2v2H2z m4 0h2v2h-2z') === 'M2 2h2v2H2z ', 'los iconos a dos tintas rellenan solo las formas cerradas (y no los trozos relativos)');
  check(/\.btn-primario:not\(:disabled\):active \{ background: var\(--accion-pulsado\)/.test(capa) && /color-mix\(in oklch, var\(--morado\) 82%, var\(--tinta\)\)/.test(src('color.css')), 'al pulsar, el acento mezclado con la tinta (igual con cualquier acento)');
  check(/@media \(forced-colors: active\)/.test(capa) && !/@keyframes|transition/.test(capa), 'colores forzados del sistema atendidos, y la capa de color no anima nada');
}

console.log('\nLos ajustes y la barra del sistema (17–19)');
{
  const aj = src('ui/ajustes.js');
  check(/altoContraste: false, daltonismo: false/.test(aj) && /setAttribute\('data-contraste', 'alto'\)/.test(aj) && /setAttribute\('data-daltonismo', ''\)/.test(aj), 'alto contraste y daltonismo: apagados de serie, y se aplican en la raíz');
  check(/id="aj-contraste"/.test(src('ui/Ajustes.jsx')) && /id="aj-daltonismo"/.test(src('ui/Ajustes.jsx')), 'y se encienden desde Apariencia');
  check(/valorPaleta\('claro', 'tiza'\), oscuro: valorPaleta\('oscuro', 'tiza'\)/.test(aj) && src('../index.html').includes(`content="${P.valor('claro', 'tiza')}" media="(prefers-color-scheme: light)"`) && src('../index.html').includes(`content="${P.valor('oscuro', 'tiza')}" media="(prefers-color-scheme: dark)"`), 'la barra del sistema, del color exacto del fondo de cada tema (19)');
  check(/theme_color: FONDO_PORTADA/.test(readFileSync(new URL('../scripts/build.mjs', import.meta.url), 'utf8')), 'el manifiesto, en la tinta noche de la portada');
}

console.log('\nSin colores sueltos nuevos (3, 20)');
{
  const dir = new URL('../web/src/', import.meta.url);
  // lo que queda tras el barrido: si aparece uno más en un archivo, hay que usar un token (o subir aquí el tope, con motivo)
  const TOPE_CSS = { 'apuntes.css': 8, 'carrera.css': 4, 'diseno.css': 50, 'equipo-belleza.css': 2, 'estilos.css': 6, 'perfil.css': 9, 'personal.css': 11, 'travesia.css': 5 };
  const sueltos = {};
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.css') && x !== 'color.css')) {
    const s = readFileSync(new URL(f, dir), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const n = (s.match(/(?<![%\w&])#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b(?![0-9A-Fa-f])/g) || []).length;
    if (n) sueltos[f] = n;
  }
  const pasados = Object.entries(sueltos).filter(([f, n]) => n > (TOPE_CSS[f] || 0));
  const total = Object.values(sueltos).reduce((t, n) => t + n, 0);
  check(pasados.length === 0, `ningún CSS pasa de su tope de colores sueltos (quedan ${total} en total, de 1092 antes del barrido)${pasados.length ? `: ${pasados.map(([f, n]) => `${f} ${n}`)}` : ''}`);
  const usos = readdirSync(dir).filter((x) => x.endsWith('.css') && x !== 'color.css').reduce((t, f) => t + (readFileSync(new URL(f, dir), 'utf8').match(/var\(--(marca|neutro|verde|ambar|rojo|azul|oro|rosa|turquesa|naranja|noche)-\d+\)/g) || []).length, 0);
  check(usos > 700, `los estilos usan las escalas (${usos} referencias a sus pasos)`);
  const prims = new Set([...Object.values(P.ESCALAS).flatMap((e) => Object.values(e)), ...Object.values(P.NOCHE), '#FFFFFF', '#000000', P.PORTADA]);
  const archivos = execSync("find ui logica -name '*.js' -o -name '*.jsx'", { cwd: dir }).toString().trim().split('\n').filter((f) => !/logica\/(paleta|paleta-css|acentos)\.js$/.test(f));
  let fuera = 0;
  for (const f of archivos) for (const m of readFileSync(new URL(f, dir), 'utf8').matchAll(/(['"`])#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\1/g)) {
    let h = m[2].toUpperCase(); if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    if (!prims.has(`#${h}`) && m[0] !== "'#FBE'") fuera++;
  }
  check(fuera <= 180, `en el JS, los colores son de la paleta salvo ${fuera} (tope 180: el juego del descanso conserva su paleta de ilustración, y algunas tarjetas, sus tonos)`);
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
