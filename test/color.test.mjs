// El guardián del color (claude/color-mejoras.md y claude/color-mejoras-2.md): la paleta (logica/paleta.js) y su CSS
// (color.css, generado), el contraste de todas las parejas texto/fondo en claro, oscuro y negro puro con cada acento (y
// con sus neutros, con alto contraste y con la ayuda para daltonismo), y que no vuelven los colores sueltos: ni hex, ni
// rgba teñidos, ni degradados sin OKLab, fuera de la paleta.
//   node test/color.test.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import * as P from '../web/src/logica/paleta.js';
import { cssPaleta } from '../web/src/logica/paleta-css.js';
import { acentoValido, parejasVidrio, contrasteCeldas, cssAcento, mezclar } from '../web/src/logica/acentos.js';
import { paletaDe } from '../web/src/logica/compartir.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const src = (r) => readFileSync(new URL(`../web/src/${r}`, import.meta.url), 'utf8');
const dir = new URL('../web/src/', import.meta.url);
const hojas = readdirSync(dir).filter((x) => x.endsWith('.css') && x !== 'color.css');
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const paso = (v) => (typeof v === 'string' ? v : v[0] === 'noche' ? P.NOCHE[v[1]] : P.ESCALAS[v[0]][v[1]]);

console.log('\nLas escalas');
{
  const ks = Object.keys(P.ESCALAS);
  check(ks.length === 13 && ks.every((k) => Object.keys(P.ESCALAS[k]).length === 11) && ['indigo', 'purpura', 'cielo'].every((k) => ks.includes(k)), 'trece escalas, de 50 a 950 (con índigo, púrpura y cielo, de la tanda 2)');
  check(ks.every((k) => P.PASOS.every((p, i) => i === 0 || P.aOklch(P.ESCALAS[k][p])[0] < P.aOklch(P.ESCALAS[k][P.PASOS[i - 1]])[0])), 'en cada una, la luminosidad baja paso a paso (repartida por percepción)');
  const malas600 = ks.filter((k) => P.contraste(P.ESCALAS[k][600], '#FFFFFF') < 4.5);
  check(malas600.length === 0, `el paso 600 pasa AA sobre blanco en todas${malas600.length ? `: falla ${malas600}` : ''}`);
  const malas300 = ks.filter((k) => P.contraste(P.ESCALAS[k][300], P.NOCHE[1]) < 4.5);
  check(malas300.length === 0, `y el 300, sobre el fondo oscuro${malas300.length ? `: falla ${malas300}` : ''}`);
  check(Math.abs(P.aOklch(P.ESCALAS.marca[600])[2] - P.aOklch('#5438D8')[2]) < 4 && P.distancia(P.ESCALAS.marca[600], '#5438D8') < 0.04, 'el morado FBE de siempre queda en el 600 de la marca (afinado, reconocible)');
  check(Math.max(...P.PASOS.map((p) => P.aOklch(P.ESCALAS.neutro[p])[1])) <= 0.035, 'los neutros, con un toque mínimo de la marca (croma ≤ 0,035; antes, 0,04–0,05)');
  check(Object.values(P.NOCHE).every((h, i, a) => i === 0 || P.aOklch(h)[0] > P.aOklch(a[i - 1])[0]), 'la noche: cada nivel del tema oscuro, un poco más claro (la profundidad, con luz)');
}

console.log('\ncolor.css, generado y única fuente');
{
  check(src('color.css') === cssPaleta(), 'color.css está al día con logica/paleta.js (npm run paleta)');
  const est = src('estilos.css');
  const raiz = est.slice(est.indexOf(':root {'), est.indexOf('\n}', est.indexOf(':root {')));
  check(!/--(tiza|hoja|tinta|morado|ok|alerta|aviso|hero):/.test(raiz) && !/:root\[data-oled\]\[data-theme="dark"\] \{\n  --tiza/.test(est) && !/:root \{ --oro:/.test(src('diseno.css')),
    'estilos.css y diseno.css ya no definen los colores de los temas, ni el negro puro, ni el dorado: vienen de color.css');
  check(/import '\.\/color\.css';\nimport '\.\/estilos\.css';/.test(src('main.jsx')) && /import '\.\/color-capa\.css';/.test(src('main.jsx')), 'color.css se carga antes que todo y la capa de color, la última');
  const css = src('color.css');
  check(['--superficie-1', '--texto-2', '--accion', '--accion-pulsado', '--info-solido', '--ok-borde', '--grad-noche', '--grad-record', '--serie-8', '--seq-5', '--div-5', '--confeti-6', '--zona-5-t', '--oro-claro', '--fuego'].every((t) => css.includes(`${t}:`)),
    'los tokens con significado (superficies, textos, acción, estados, degradados, gráficas, zonas, celebraciones y dorado)');
  check(/@supports \(background: linear-gradient\(in oklch, red, blue\)\)/.test(css) && /linear-gradient\(in oklch 160deg/.test(css), 'los degradados de marca se interpolan en OKLCH donde se puede');
  check(/--sombra-tarjeta: 0 0 0 1px var\(--borde\), inset 0 1px 0 rgba\(255, 255, 255/.test(src('color-capa.css')), 'en oscuro, la profundidad con un filo de luz');
  check(/:root\[data-theme="dark"\]\[data-oled\] \{\n  --tiza: #000000;\n  --hoja: #0C0B12;/.test(css) && P.SUPERFICIES.oled.hoja === P.OLED.hoja, '(tanda 2) el negro puro sale también de la paleta');
}

console.log('\nContraste de todas las parejas');
{
  const malas = [];
  for (const tema of ['claro', 'oscuro', 'oled']) {
    const sup = Object.values(P.SUPERFICIES[tema]);
    const textos = ['tinta', 'tinta-2', 'tinta-3', 'ok', 'aviso', 'alerta', 'info', 'oro'];
    for (const t of textos) for (const f of sup) { const r = P.contraste(P.valor(tema, t), f); if (r < 4.5) malas.push(`${tema} ${t}/${f} ${r}`); }
    for (const k of ['ok', 'aviso', 'alerta', 'info', 'oro']) { const r = P.contraste(P.valor(tema, k), P.valor(tema, `${k}-suave`)); if (r < 4.5) malas.push(`${tema} ${k} sobre su fondo ${r}`); }
    for (const k of ['ok', 'aviso', 'alerta', 'info']) for (const f of sup) { const r = P.contraste(P.valor(tema, `${k}-borde`), f); if (r < 1.3) malas.push(`${tema} ${k}-borde apenas se ve ${r}`); }
    const hero = [P.valor(tema, 'hero'), ...P.ACENTOS.map((a) => (tema === 'claro' ? a.claro : a.oscuro).hero2), ...['azul', 'turquesa', 'ambar', 'verde'].map((k) => P.ESCALAS[k][900])];
    for (const f of hero) { if (P.contraste(P.valor(tema, 'sobre-hero'), f) < 4.5) malas.push(`${tema} texto de la tarjeta del día sobre ${f}`); }
    if (P.contraste(P.valor(tema, 'sobre-hero-2'), P.valor(tema, 'hero')) < 4.5) malas.push(`${tema} texto 2 de la tarjeta`);
    for (const k of ['int-trabajo', 'int-descanso', 'int-preparar', 'int-fin']) if (P.contraste('#FFFFFF', P.valor(tema, k)) < 4.5) malas.push(`${tema} blanco sobre ${k}`);
  }
  for (const k of ['disco-rojo', 'disco-azul', 'disco-verde', 'av-1', 'av-2', 'av-3', 'av-4', 'av-5', 'av-6']) if (P.contraste('#FFFFFF', P.valor('claro', k)) < 4.5) malas.push(`blanco sobre ${k}`);
  check(malas.length === 0, `textos, estados, dorado, tarjeta del día (con cada tono y acento) e intervalos pasan AA en claro, oscuro y negro puro${malas.length ? `: ${malas.slice(0, 4).join('; ')}` : ''}`);
  const dalt = [];
  for (const tema of ['claro', 'oscuro']) for (const k of ['ok', 'alerta']) for (const f of Object.values(P.SUPERFICIES[tema])) if (P.contraste(P.DALTONISMO[tema][k], f) < 4.5) dalt.push(`${tema} ${k}`);
  const tono = (h) => P.aOklch(h)[2];
  check(dalt.length === 0 && tono(P.DALTONISMO.claro.ok) > 220 && tono(P.DALTONISMO.claro.ok) < 280 && tono(P.DALTONISMO.claro.alerta) > 30 && tono(P.DALTONISMO.claro.alerta) < 70, 'con la ayuda para daltonismo: lo hecho en azul y lo que falla en naranja, y siguen pasando AA');
  const alto = [];
  for (const tema of ['claro', 'oscuro']) for (const k of ['tinta', 'tinta-2', 'tinta-3']) for (const f of Object.values(P.SUPERFICIES[tema])) { const r = P.contraste(P.ALTO_CONTRASTE[tema][k], f); if (r < 7) alto.push(`${tema} ${k} ${r}`); }
  check(alto.length === 0, `con alto contraste, todos los textos llegan a AAA (7:1)${alto.length ? `: ${alto.slice(0, 3)}` : ''}`);
  // (tanda 2) las gráficas y las zonas
  const series = [];
  for (const [t, sup] of [['claro', P.SUPERFICIES.claro], ['oscuro', P.SUPERFICIES.oscuro], ['oscuro', P.SUPERFICIES.oled]]) for (const c of P.SERIES[t]) if (Math.min(...Object.values(sup).map((f) => P.contraste(c, f))) < 3) series.push(`${t} ${c}`);
  check(series.length === 0 && new Set(P.SERIES.claro).size === 8, `las ocho series de las gráficas se ven (≥ 3:1) sobre todas las superficies${series.length ? `: ${series}` : ''}`);
  const zonas = [];
  for (const [nombre, Z] of [['zonas', P.ZONAS], ['zonas con daltonismo', P.ZONAS_DALTONISMO]]) for (const t of ['claro', 'oscuro']) {
    const hoja = P.SUPERFICIES[t].hoja;
    Z[t].relleno.forEach((v, i) => { const fondo = mezclar(paso(v), hoja, t === 'claro' ? 14 : 22), r = P.contraste(paso(Z[t].texto[i]), fondo); if (r < 4.5) zonas.push(`${nombre} ${t} Z${i + 1} ${r}`); });
  }
  check(zonas.length === 0 && new Set(P.ZONAS.claro.relleno.map((v) => paso(v))).size === 5, `las cinco zonas de carrera: su texto pasa AA sobre su fondo suave, en claro y oscuro y con daltonismo${zonas.length ? `: ${zonas.slice(0, 4)}` : ''}`);
  const dz = P.ZONAS_DALTONISMO.claro.relleno.map((v) => P.aOklch(paso(v))).filter(([, C]) => C > 0.05).map(([, , h]) => h);
  check(dz.every((h) => !(h > 100 && h < 200) && !(h < 35 || h > 340)), 'y con daltonismo, las zonas no usan ni verdes ni rojos (del azul al naranja)');
}

console.log('\nLos acentos');
{
  check(P.ACENTOS.length === 9 && ['oceano', 'lima', 'orquidea'].every((id) => P.ACENTOS.some((a) => a.id === id)), 'nueve acentos: los seis de siempre, Océano, Lima y Orquídea (tanda 2)');
  const malos = P.ACENTOS.filter((a) => !acentoValido(a)).map((a) => a.id);
  check(malos.length === 0, `todos pasan AA como texto, en botones y en la tarjeta del día, en claro, oscuro y negro puro (cada uno, sobre sus neutros)${malos.length ? `: ${malos}` : ''}`);
  const vid = P.ACENTOS.flatMap((a) => ['claro', 'oscuro', 'oled'].flatMap((t) => ['barra', 'cabecera', 'hoja'].flatMap((tipo) => parejasVidrio(a, t, tipo).filter((x) => x.ratio < 4.5).map((x) => `${a.id}/${t}/${x.que}`))));
  const cel = P.ACENTOS.flatMap((a) => ['claro', 'oscuro', 'oled'].filter((t) => contrasteCeldas(a, t).ratio < 3).map((t) => `${a.id}/${t}`));
  check(vid.length === 0 && cel.length === 0, `también sobre el vidrio y en el calendario de constancia${vid.length + cel.length ? `: ${[...vid, ...cel].slice(0, 3)}` : ''}`);
  const n = paletaDe('noche'), az = paletaDe('noche', 'azul'), cl = paletaDe('clara', 'azul');
  check(paletaDe('noche', 'morado') === n && az.morado !== n.morado && az.noche === P.ACENTOS.find((a) => a.id === 'azul').claro.hero2 && cl === paletaDe('clara'), 'la tarjeta de compartir «Noche» sigue el acento elegido (con el morado, la de siempre; las demás paletas, igual)');
  check(/else acentoTravesia\(ac\.claro\.morado, ac\.oscuro\.morado\)/.test(src('ui/atleta/Travesia.jsx')) && /--serie-1: var\(--morado\)/.test(src('color.css')) && /var\(--morado\) 0%, var\(--rosa-400\)/.test(src('color.css')), 'y el juego del descanso, la primera serie de las gráficas y el degradado Amanecer');
}

console.log('\n(tanda 2) Los neutros siguen al acento, y el acento con alto contraste');
{
  check(P.neutrosDe(P.ACENTOS[0]) === null && cssAcento('morado') === '', 'con el morado FBE, los neutros de siempre (y ninguna hoja de acento)');
  const az = P.ACENTOS.find((a) => a.id === 'azul'), nz = P.neutrosDe(az);
  const dTono = (a, b) => { const d = Math.abs(a - b); return d > 180 ? 360 - d : d; };
  check(dTono(P.aOklch(nz.neutro[800])[2], P.aOklch(az.claro.morado)[2]) < 12 && dTono(P.aOklch(nz.noche[2])[2], P.aOklch(az.claro.morado)[2]) < 12, 'con otro acento, los grises y la noche toman su tono');
  check(P.PASOS.every((p) => Math.abs(P.aOklch(nz.neutro[p])[0] - P.aOklch(P.ESCALAS.neutro[p])[0]) < 0.012) && [0, 1, 2, 3, 4].every((i) => Math.abs(P.aOklch(nz.noche[i])[0] - P.aOklch(P.NOCHE[i])[0]) < 0.012), 'con la misma luminosidad paso a paso (el contraste no cambia)');
  const gr = P.neutrosDe(P.ACENTOS.find((a) => a.id === 'grafito'));
  check(Object.values(gr.neutro).every((h) => P.aOklch(h)[1] < 0.004) && Object.values(gr.noche).every((h) => P.aOklch(h)[1] < 0.004), 'con Grafito, gris puro (sin tinte)');
  const css = cssAcento('azul');
  check(css.includes(`--neutro-100:${nz.neutro[100]};`) && css.includes(`--noche-0:${nz.noche[0]};`) && css.includes(`--morado:${az.claro.morado}`), 'la hoja del acento lleva sus neutros y su noche');
  const textos = [];
  for (const a of P.ACENTOS) for (const t of ['claro', 'oscuro']) for (const x of Object.values(P.textosDe(a, t))) for (const f of Object.values(P.superficiesDe(a, t))) if (P.contraste(x, f) < 4.5) textos.push(`${a.id}/${t}`);
  check(textos.length === 0, `los textos pasan AA sobre las superficies de cada acento${textos.length ? `: ${[...new Set(textos)]}` : ''}`);
  const flojos = [];
  for (const a of P.ACENTOS) { const v = P.acentoAlto(a);
    for (const f of [...Object.values(P.superficiesDe(a, 'claro')), a.claro.suave]) if (P.contraste(v.claro.morado, f) < 7) flojos.push(`${a.id} claro`);
    for (const f of [...Object.values(P.superficiesDe(a, 'oscuro')), ...Object.values(P.SUPERFICIES.oled), a.oscuro.suave]) if (P.contraste(v.oscuro.morado, f) < 7) flojos.push(`${a.id} oscuro`);
    if (P.contraste(v.claro.sobre, v.claro.morado) < 4.5 || P.contraste(v.oscuro.sobre, v.oscuro.morado) < 4.5) flojos.push(`${a.id} botón`);
  }
  check(flojos.length === 0, `con alto contraste, el acento llega a 7:1 (AAA) sobre todas sus superficies, y el texto de los botones sigue pasando${flojos.length ? `: ${[...new Set(flojos)]}` : ''}`);
  const alto = cssAcento('morado', { alto: true });
  check(alto.includes(':root[data-contraste="alto"]{') && alto.includes(`--morado:${P.acentoAlto(P.ACENTOS[0]).claro.morado}`) && alto.includes(':root[data-contraste="alto"][data-theme="dark"]{'), 'y su hoja va con el atributo (también con el morado)');
  const aj = src('ui/ajustes.js');
  check(/prefers-contrast: more/.test(aj) && /const alto = !!a\.altoContraste \|\| pideContraste\(\);/.test(aj) && /cssAcento\(a\.acento, \{ alto \}\)/.test(aj), '«Alto contraste» se enciende solo si lo pide el sistema');
  check(/coloresBarra\(acentoDe\(a\.acento\)\)/.test(aj) && src('../index.html').includes(`content="${P.valor('claro', 'tiza')}" media="(prefers-color-scheme: light)"`) && src('../index.html').includes(`content="${P.valor('oscuro', 'tiza')}" media="(prefers-color-scheme: dark)"`),
    'la barra del sistema, del color exacto del fondo de cada tema con el acento elegido');
  const t = P.parejasPaleta({ tema: 'oscuro', acento: az, alto: true });
  check(t.length === 9 && t.find((x) => x.nombre === 'Acento').color === P.acentoAlto(az).oscuro.morado && t.every((x) => x.tarjeta >= 4.5) && P.sobre('#FFEEAA') !== '#FFFFFF' && P.sobre(P.ESCALAS.marca[700]) === '#FFFFFF', 'la tabla de contraste de «Paleta» se calcula con el tema, el acento y el alto contraste elegidos');
}

console.log('\nLa tarjeta del día, los iconos y la interacción');
{
  check(P.tonoDia({ hero: 'entreno', sesion: 'fuerza' }) === 'fuerza' && P.tonoDia({ hero: 'entreno', sesion: 'cardio' }) === 'cardio' && P.tonoDia({ hero: 'entreno', sesion: 'movilidad' }) === 'movilidad'
    && P.tonoDia({ hero: 'entreno', sesion: 'fuerza', foco: 'descarga' }) === 'descarga' && P.tonoDia({ hero: 'descanso' }) === 'descanso' && P.tonoDia({ hero: 'hecha' }) === 'hecha' && P.tonoDia() === 'fuerza',
  'el tono de la tarjeta: fuerza, cardio, movilidad, descarga, descanso y hecha');
  const capa = src('color-capa.css');
  check(['cardio', 'movilidad', 'descanso', 'descarga', 'hecha'].every((t) => capa.includes(`:is(.hero-dia, .pal-tono)[data-tono="${t}"]`)) && /data-tono=\{tonoDia\(/.test(src('ui/atleta/Hoy.jsx')), 'cada tono tiene su brillo y la tarjeta del día lo lleva');
  check(P.trozosCerrados('M3 3h4v4H3zM12 12l4 4') === 'M3 3h4v4H3z' && P.trozosCerrados('M5 12l5 5') === '' && P.trozosCerrados('M2 2h2v2H2z m4 0h2v2h-2z') === 'M2 2h2v2H2z ', 'los iconos a dos tintas rellenan solo las formas cerradas (y no los trozos relativos)');
  check(/\.btn-primario:not\(:disabled\):active \{ background: var\(--accion-pulsado\)/.test(capa) && /color-mix\(in oklch, var\(--morado\) 82%, var\(--tinta\)\)/.test(src('color.css')), 'al pulsar, el acento mezclado con la tinta (igual con cualquier acento)');
  check(/@media \(forced-colors: active\)/.test(capa) && !/@keyframes|transition/.test(capa), 'colores forzados del sistema atendidos, y la capa de color no anima nada');
  // (tanda 2)
  check(/:root \{ accent-color: var\(--morado\); caret-color: var\(--morado\); \}/.test(capa) && /::selection \{ background: color-mix\(in srgb, var\(--morado\) 26%, transparent\)/.test(capa), '(tanda 2) los controles nativos, el cursor y el texto seleccionado, con el acento');
  check(/\.chip\.ok \{ border-color: var\(--ok-borde\); \}/.test(capa) && /\.chip\.alerta \{ border-color: var\(--alerta-borde\); \}/.test(capa), '(tanda 2) los estados llevan su filo');
  check(/:is\(\.hero-dia, \.carnet,[^)]*\) :focus-visible \{ outline-color: var\(--sobre-hero\); \}/.test(capa), '(tanda 2) el foco va en claro sobre las superficies oscuras');
  check(/:root\[data-contraste="alto"\]\[data-contraste\]\[data-contraste\] \{ --vidrio: var\(--hoja\);/.test(capa), '(tanda 2) con «Alto contraste», el vidrio se vuelve opaco (como con el del sistema)');
  check(/--anillo-habitos: var\(--serie-2\); --anillo-checkin: var\(--serie-4\);/.test(capa) && P.MACROS.claro.carbos === P.ESCALAS.ambar[500], '(tanda 2) los aros de «Tu semana» y los hidratos usan la paleta de datos (sin dorados pardos)');
}

console.log('\nLos ajustes');
{
  const aj = src('ui/ajustes.js');
  check(/altoContraste: false, daltonismo: false/.test(aj) && /setAttribute\('data-contraste', 'alto'\)/.test(aj) && /setAttribute\('data-daltonismo', ''\)/.test(aj), 'alto contraste y daltonismo: apagados de serie, y se aplican en la raíz');
  check(/id="aj-contraste"/.test(src('ui/Ajustes.jsx')) && /id="aj-daltonismo"/.test(src('ui/Ajustes.jsx')), 'y se encienden desde Perfil');
  check(/theme_color: FONDO_PORTADA/.test(readFileSync(new URL('../scripts/build.mjs', import.meta.url), 'utf8')), 'el manifiesto, en la tinta noche de la portada');
}

console.log('\nPantallas de gama ancha y degradados (tanda 2)');
{
  const css = src('color.css');
  check(/@supports \(color: oklch\(0% 0 0\)\) and \(background: linear-gradient\(in oklch, red, blue\)\) \{\n  @media \(color-gamut: p3\) \{/.test(css) && /--confeti-1: oklch\(/.test(css) && !/--(tinta|ok|aviso|alerta|info|morado)[a-z0-9-]*: oklch\(/.test(css), 'en las pantallas P3, lo decorativo gana viveza; el texto no cambia');
  const [L0, C0, h0] = P.aOklch(P.ESCALAS.oro[400]), v = /oklch\(([\d.]+)% ([\d.]+) ([\d.]+)\)/.exec(P.vivo(P.ESCALAS.oro[400]));
  check(Math.abs(Number(v[1]) / 100 - L0) < 0.002 && Number(v[2]) > C0 * 1.2 && Math.abs(Number(v[3]) - h0) < 0.2, 'misma luminosidad y tono, más croma');
  check(/@supports \(background: linear-gradient\(in oklab, red, blue\)\) \{\n  :root \{ --oklab: in oklab; \}/.test(css), 'donde el navegador puede, los degradados se interpolan en OKLab');
  let conDireccion = 0, sinOklab = 0;
  for (const f of hojas) for (const m of sinComentarios(src(f)).matchAll(/(?<!repeating-)linear-gradient\(\s*(var\(--oklab,\)\s*)?(?:-?[\d.]+(?:deg|turn|rad|grad)|to\s+[a-z ]+)\s*,/g)) { conDireccion++; if (!m[1]) sinOklab++; }
  check(conDireccion > 250 && sinOklab === 0, `todos los degradados lineales con dirección llevan «var(--oklab,)» (${conDireccion})`);
}

console.log('\nSin colores sueltos');
{
  // Los únicos hex que quedan en los CSS, con su motivo. Si aparece otro, hay que usar un paso de escala (o añadirlo aquí, con motivo).
  const PERMITIDOS = {
    'diseno.css': ['#A6F04A', '#A6F04A', '#F0386B', '#FF2D6A'],                 // los aros de «Salud» (los de la app del móvil: se reconocen por su color)
    'travesia.css': ['#4A5FC4', '#4A5FC4', '#6B46A8', '#6B46A8'],               // los cielos de la tarjeta del juego (ilustración, como el juego)
  };
  const sueltos = {};
  for (const f of hojas) {
    const n = (sinComentarios(src(f)).match(/(?<![%\w&])#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b(?![0-9A-Fa-f])/g) || []).map((h) => h.toUpperCase()).sort();
    if (n.length) sueltos[f] = n;
  }
  const distintos = Object.keys({ ...sueltos, ...PERMITIDOS }).filter((f) => (sueltos[f] || []).join() !== (PERMITIDOS[f] || []).join());
  const total = Object.values(sueltos).reduce((t, n) => t + n.length, 0);
  check(distintos.length === 0, `en los CSS quedan ${total} colores sueltos, todos con su motivo (eran 1092)${distintos.length ? `: ${distintos.map((f) => `${f} ${sueltos[f] || '—'}`).join('; ')}` : ''}`);
  // rgba teñidos (ni blanco, ni negro, ni gris): ninguno; se escriben con color-mix sobre un paso de escala
  const tenidos = [];
  for (const f of hojas) for (const m of sinComentarios(src(f)).replace(/url\((?:"[^"]*"|'[^']*'|[^)]*)\)/g, '').matchAll(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/g)) if (!(m[1] === m[2] && m[2] === m[3])) tenidos.push(`${f} ${m[0]}`);
  check(tenidos.length === 0, `ningún rgba teñido suelto: las transparencias de color salen de las escalas${tenidos.length ? `: ${tenidos.slice(0, 4)}` : ''}`);
  const usos = hojas.reduce((t, f) => t + (src(f).match(/var\(--(marca|neutro|verde|ambar|rojo|azul|oro|rosa|turquesa|naranja|indigo|purpura|cielo|noche)-\d+\)/g) || []).length, 0);
  check(usos > 850, `los estilos usan las escalas (${usos} referencias a sus pasos)`);
  // En el JS, todo de la paleta salvo la ilustración del juego del descanso y los colores del dibujo sobre vídeo (se guardan)
  const ILUSTRACION = ['ui/atleta/travesia-pinta.js', 'ui/atleta/TravesiaHoja.jsx', 'ui/atleta/EscenaFinal.jsx', 'ui/atleta/travesia-compartir.js', 'ui/atleta/Travesia.jsx', 'logica/travesia-ruta.js', 'logica/dibujo.js'];
  const prims = new Set([...Object.values(P.ESCALAS).flatMap((e) => Object.values(e)), ...Object.values(P.NOCHE), '#FFFFFF', '#000000', P.PORTADA, P.FUEGO, P.ORO_TINTA]);
  const archivos = execSync("find ui logica datos -name '*.js' -o -name '*.jsx'", { cwd: dir }).toString().trim().split('\n').filter((f) => !/logica\/(paleta|paleta-css|acentos)\.js$/.test(f) && !ILUSTRACION.includes(f));
  const fuera = [];
  for (const f of archivos) for (const m of readFileSync(new URL(f, dir), 'utf8').matchAll(/(['"`])#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\1/g)) {
    let h = m[2].toUpperCase(); if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    if (!prims.has(`#${h}`) && m[0] !== "'#FBE'") fuera.push(`${f} #${h}`);
  }
  check(fuera.length === 0, `en el JS de la app, todos los colores son de la paleta (el juego del descanso y el dibujo sobre vídeo conservan los suyos)${fuera.length ? `: ${fuera.slice(0, 5)}` : ''}`);
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
