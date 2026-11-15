// El guardián del diseño (claude/color-mejoras-3.md): las escalas del sistema (logica/sistema.js) y su CSS (sistema.css,
// generado), lo que salió del acento en la tanda 3 (su escala, sus tintes, la secuencial, los avatares, las categorías
// y la elevación en oscuro) y que los estilos no vuelven a escribir valores sueltos: cada medida tiene un tope, que es
// lo que quedaba fuera de escala al cerrar la tanda. El tope solo baja.
//   node test/sistema.test.mjs
import { readFileSync, readdirSync } from 'node:fs';
import * as P from '../web/src/logica/paleta.js';
import * as S from '../web/src/logica/sistema.js';
import { cssSistema } from '../web/src/logica/paleta-css.js';
import { cssAcento, parejasVidrio } from '../web/src/logica/acentos.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const dir = new URL('../web/src/', import.meta.url);
const src = (r) => readFileSync(new URL(r, dir), 'utf8');
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const GENERADAS = ['color.css', 'sistema.css'];
const hojas = readdirSync(dir).filter((x) => x.endsWith('.css') && !GENERADAS.includes(x));
// Las declaraciones de todos los estilos escritos a mano: [archivo, selector, propiedad, valor]
const decls = [];
for (const f of hojas) {
  for (const m of sinComentarios(src(f)).matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    for (const d of m[2].matchAll(/(?:^|;)\s*([a-zA-Z-]+)\s*:\s*([^;]+)/g)) decls.push([f, m[1].replace(/\s+/g, ' ').trim(), d[1], d[2].trim()]);
  }
}
const de = (...props) => decls.filter((d) => props.includes(d[2]));
const cuenta = (lista, re) => lista.reduce((t, d) => t + (d[3].match(re) || []).length, 0);
const tope = (n, max, que) => check(n <= max, `${que}: ${n} fuera de escala (tope ${max})${n > max ? ' — usa un paso de la escala (logica/sistema.js) o, si de verdad hace falta, sube el tope explicando por qué' : ''}`);
// Lo que quedaba fuera de escala al cerrar la tanda 3 (cada uno, con su motivo en claude/color-3-estado.md)
//   radios: los de 20 y 22 px (entre el 18 y el 24, no caen en ninguno sin notarse) y alguno suelto
//   letras: los titulares grandes (de 26 px en adelante), los tamaños en px dentro de las gráficas (SVG) y cuatro raros
//   pesos: 450 y 850;  tiempos: tres transiciones de 0,25 s
//   sombras: solo las capas que se repetían pasaron a token; las demás son propias de cada componente
//   tintes: tres porcentajes que no caen en ningún nivel sin notarse
//   (visual) espacios: los de más de 24 px que no caen en un paso sin notarse (26, 30, 34, 36, 38…) y los medios píxeles
//   iconos: los de La travesía (su propio dibujo) y los de las gráficas, aros y diales (no son iconos)
const TOPES = { radios: 26, letras: 90, pesos: 4, capas: 0, tiempos: 3, sombras: 412, filos: 0, tintes: 3, deshabilitado: 0, espacios: 68, iconos: 66 };

console.log('\nsistema.css, generado');
{
  check(src('sistema.css') === cssSistema(), 'sistema.css está al día con logica/sistema.js (npm run paleta)');
  const main = src('main.jsx');
  check(main.indexOf("'./visual.css'") > main.indexOf("'./apuntes.css'") && main.indexOf("'./visual.css'") < main.indexOf("'./color-capa.css'"), '(visual) visual.css se carga después de los estilos de cada parte y antes de color-capa.css');
  check(S.pasoEspacio(3) === 4 && S.pasoEspacio(5) === 4 && S.pasoEspacio(7) === 8 && S.pasoEspacio(1) === null && S.pasoEspacio(30) === null && S.pasoIcono(15) === 16 && S.pasoIcono(40) === null, '(visual) el espaciado va al múltiplo de 4 más cercano (unos suben y otros bajan) y los iconos impares, al par de arriba');
  check(main.indexOf("'./color.css'") < main.indexOf("'./sistema.css'") && main.indexOf("'./sistema.css'") < main.indexOf("'./estilos.css'"), 'se carga después de la paleta y antes de los estilos');
  const css = src('sistema.css');
  const pide = [...S.RADIOS.map((r) => `--r-${r}:`), '--r-pildora:', ...S.LETRAS.map((v) => `--${S.nombreLetra(v)}:`), ...Object.keys(S.CAPAS).map((k) => `--capa-${k}:`), ...S.TIEMPOS_NUEVOS.map((k) => `--mov-${k}:`),
    ...Object.keys(S.FILOS).map((k) => `--filo-${k}:`), ...Object.keys(S.SOMBRAS).map((k) => `--${k}:`), ...Object.keys(S.FILAS).map((k) => `--${k}:`), ...P.TINTES.map((p) => `--acento-a${p}:`), '--seq-5:', '--op-deshabilitado:'];
  pide.push(...S.ESPACIOS.map((v) => `--esp-${v}:`), ...S.ICONOS_TAM.map((v) => `--ico-${v}:`));
  const faltan = pide.filter((t) => !css.includes(t));
  check(faltan.length === 0, `están todos los pasos: radios, letras, capas, tiempos, filos, sombras, filas y tintes (${pide.length})${faltan.length ? `: faltan ${faltan.slice(0, 6)}` : ''}`);
  const capas = Object.values(S.CAPAS);
  check(capas.every((v, i) => i === 0 || v > capas[i - 1]), 'las capas, en orden: cada una por encima de la anterior');
  check(S.pasoRadio(9) === null || typeof S.pasoRadio(9) === 'string', 'un radio va a su paso solo si no se nota');
}

console.log('\nLos ámbitos');
{
  // Una variable se resuelve donde se declara: si un sitio cambia --linea, --hoja o --morado para sí mismo, los tokens
  // que salen de ellos (anillos, halos, tintes, filas, secuencial) tienen que volver a declararse ahí (AMBITOS)
  const propios = S.AMBITOS.filter((a) => a !== ':root');
  const fuera = [];
  for (const f of [...hojas, 'color.css']) {
    for (const m of sinComentarios(src(f)).matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
      if (!/(?:^|;|\s)--(?:linea|hoja|morado)\s*:/.test(m[2])) continue;
      for (const sel of m[1].replace(/\s+/g, ' ').trim().split(/\s*,\s*/)) {
        const raiz = /^(?::root|html)\S*$/.test(sel) || /^\.pal-/.test(sel);
        if (!raiz && !propios.some((a) => sel === a || sel.endsWith(` ${a}`) || sel.endsWith(a))) fuera.push(`${f}: ${sel}`);
      }
    }
  }
  check(fuera.length === 0, `quien cambia la línea, la tarjeta o el acento para sí está en AMBITOS (${propios.length}: ${propios.join(', ')})${fuera.length ? `: faltan ${[...new Set(fuera)].slice(0, 5).join(' | ')}` : ''}`);
  const css = src('sistema.css');
  check(S.AMBITOS.every((a) => css.includes(a)) && P.ELEVADOS.every((e) => S.AMBITOS.includes(e)), 'y sistema.css vuelve a declarar ahí esos tokens (también en las hojas elevadas)');
}

console.log('\nNi un valor suelto más');
{
  // radios: en px, fuera de la escala (se permiten 0, 50 % y los calc con --r)
  tope(cuenta(de('border-radius', 'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius'), /(?<![\w.-])\d*\.?\d+px/g), TOPES.radios, 'radios en px');
  tope(cuenta(de('font-size'), /(?<![\w.(-])\d*\.?\d+(?:rem|px)/g), TOPES.letras, 'tamaños de letra a mano');
  tope(de('font-weight').filter((d) => /^\d+$/.test(d[3]) && !S.PESOS.includes(Number(d[3]))).length, TOPES.pesos, 'pesos fuera de la escala');
  tope(de('z-index').filter((d) => /^-?\d+$/.test(d[3]) && Math.abs(Number(d[3])) > 9).length, TOPES.capas, 'capas (z-index) a mano');
  const tiempos = Object.values(S.TIEMPOS);
  const sueltos = de('transition', 'transition-duration').flatMap((d) => (d[3].match(/(?<![\w.-])\d*\.?\d+m?s\b/g) || []).filter((t) => { const s = t.endsWith('ms') ? parseFloat(t) / 1000 : parseFloat(t); return s > 0 && s <= 0.6 && tiempos.some((x) => Math.abs(x - s) < 0.011); }));
  tope(sueltos.length, TOPES.tiempos, 'duraciones de transición que ya tienen paso y se escriben a mano (las animaciones llevan su propio compás)');
  tope(de('box-shadow').filter((d) => !/^(?:none|var\(--[\w-]+\)(?:\s*,\s*var\(--[\w-]+\))*|inherit|unset)$/.test(d[3])).length, TOPES.sombras, 'sombras con algún trozo a mano');
  tope(cuenta(de('border', 'border-top', 'border-bottom', 'border-left', 'border-right', 'border-width'), /(?<![\w.-])(?:1|1\.5|2|3)px(?= (?:solid|dashed|dotted))/g), TOPES.filos, 'filos de borde a mano (los anillos de foco van aparte)');
  tope(cuenta(decls, /color-mix\(in srgb, var\(--morado\) [\d.]+%, transparent\)/g), TOPES.tintes, 'tintes del acento a mano');
  const ESP = /^(?:padding|margin|gap|row-gap|column-gap|scroll-padding|scroll-margin)(?:-[a-z-]+)?$/;
  tope(decls.filter((d) => ESP.test(d[2])).reduce((t, d) => t + (d[3].match(/(?<![\w.-])(?!1px)\d+(?:\.\d+)?px\b/g) || []).filter((x) => x !== '0px').length, 0), TOPES.espacios, '(visual 1) márgenes, rellenos y huecos a mano');
  tope(decls.filter((d) => /\bsvg(?::[a-z-]+(\([^)]*\))?)*\s*$/.test(d[1]) && (d[2] === 'width' || d[2] === 'height') && /^\d+px$/.test(d[3]) && Number.parseInt(d[3], 10) <= 32).length, TOPES.iconos, '(visual 14) tamaños de icono a mano');
  const desh = decls.filter((d) => /:disabled|\[disabled\]|aria-disabled/.test(d[1]) && d[2] === 'opacity' && d[3] !== 'var(--op-deshabilitado)' && d[3] !== '1');
  tope(desh.length, TOPES.deshabilitado, 'deshabilitados con otra opacidad');
}

console.log('\nLo que sale del acento');
{
  check(P.ACENTOS.every((a) => { const e = P.escalaAcento(a); return P.PASOS.every((p, i) => i === 0 || P.aOklch(e[p])[0] < P.aOklch(e[P.PASOS[i - 1]])[0]); }) && P.escalaAcento(P.ACENTOS[0]) === P.ESCALAS.marca,
    'cada acento tiene su escala de 50 a 950 (la del morado, la de la marca)');
  const lima = cssAcento('lima');
  check(/--acento-600:#/.test(lima) && cssAcento('morado') === '' && !cssAcento('morado', { alto: true }).includes('--acento-'), 'y su hoja la lleva (--acento-N); el morado no necesita nada');
  const mal = [];
  for (const a of P.ACENTOS) {
    const t = P.textosDe(a, 'oscuro'), n = P.neutrosDe(a)?.noche || P.NOCHE;
    for (const [k, c] of Object.entries(t)) for (const i of [1, 2, 3, 4]) if (!(k === 'tinta-3' && i === 4 ? P.contraste(c, n[i]) >= 4.5 : P.contraste(c, n[i]) >= 4.5)) mal.push(`${a.id} ${k} sobre noche-${i}`);
    for (const i of [1, 2, 3, 4]) if (P.contraste(a.oscuro.morado, n[i]) < 4.5) mal.push(`${a.id} acento sobre noche-${i}`);
  }
  check(mal.length === 0, `en oscuro, los textos (con el tono del acento) y el acento pasan AA en los cuatro niveles (también en las hojas elevadas)${mal.length ? `: ${mal.slice(0, 4)}` : ''}`);
  const base = P.TEXTOS?.oscuro;
  check(P.ACENTOS.slice(1).every((a) => { const t = P.textosDe(a, 'oscuro'); return !base || Object.keys(t).every((k) => Math.abs(P.aOklch(t[k])[0] - P.aOklch(base[k])[0]) < 0.012); }), 'el tono cambia; la luminosidad de los textos, no');
  check(P.TINTES.every((p, i) => i === 0 || p > P.TINTES[i - 1]) && P.nivelTinte(13) === 12 && P.nivelTinte(26) !== null && P.nivelTinte(100) === null, `los tintes: ${P.TINTES.length} niveles, y un porcentaje va al suyo solo si no se nota`);
  check(P.SECUENCIAL.length === 5 && P.SECUENCIAL.at(-1) === 100 && /\.mapa-muscular \.m4[^{]*\{ fill: var\(--seq-5\)/.test(src('estilos.css')) && /\.grafica-carga \.barra \{ fill: var\(--seq-3\)/.test(src('estilos.css')), 'la escala secuencial sale del acento y la usan el mapa muscular y las barras');
}

console.log('\nAvatares, categorías, elevación y filas');
{
  const sep = (t) => { let m = 9; for (let i = 1; i <= P.AVATARES; i++) for (let j = i + 1; j <= P.AVATARES; j++) m = Math.min(m, P.distancia(P.valor(t, `av-${i}`), P.valor(t, `av-${j}`))); return m; };
  check(P.AVATARES === 9 && sep('claro') >= 0.06 && sep('oscuro') >= 0.06, `nueve avatares, y ninguno se confunde con otro (separación mínima ${sep('claro').toFixed(3)} en claro y ${sep('oscuro').toFixed(3)} en oscuro)`);
  const avMal = [];
  for (let i = 1; i <= P.AVATARES; i++) {
    if (P.contraste('#FFFFFF', P.valor('claro', `av-${i}`)) < 4.5 || P.contraste(P.valor('claro', `av-${i}`), '#FFFFFF') < 4.5) avMal.push(`claro ${i}`);
    if (P.contraste(P.NOCHE[1], P.valor('oscuro', `av-${i}`)) < 4.5 || P.contraste(P.valor('oscuro', `av-${i}`), P.NOCHE[2]) < 4.5) avMal.push(`oscuro ${i}`);
  }
  check(avMal.length === 0, `sus iniciales se leen, llenos y sin llenar, en los dos temas${avMal.length ? `: ${avMal}` : ''}`);
  const nombres = ['Ana', 'Luis', 'Marta', 'Noa', 'Iván', 'Sara', 'Leo', 'Eva', 'Hugo', 'Inés', 'Raúl', 'Olga', 'Teo', 'Vera', 'Unai', 'Zoe', 'Paz', 'Gael', 'Lola', 'Río'];
  check(nombres.every((n) => P.avatarDe(n) === P.avatarDe(n) && P.avatarDe(n) >= 1 && P.avatarDe(n) <= 9) && new Set(nombres.map(P.avatarDe)).size >= 6 && /avatarDe\(nombre\)/.test(src('ui/comunes.jsx')) && !/--av-\d:/.test(src('diseno.css')),
    'cada nombre, siempre el mismo color, y los nueve salen de la paleta (sin pisarlos en los estilos)');
  const cat = Object.entries(P.CATEGORIAS).filter(([, fam]) => P.contraste('#FFFFFF', P.ESCALAS[fam][P.PASO_CATEGORIA]) < 3);
  const luces = Object.values(P.CATEGORIAS).map((fam) => P.aOklch(P.ESCALAS[fam][P.PASO_CATEGORIA])[0]);
  check(cat.length === 0 && Math.max(...luces) - Math.min(...luces) < 0.02, `las ${Object.keys(P.CATEGORIAS).length} categorías pesan lo mismo (misma luminosidad) y aguantan un icono blanco (3:1)`);
  const usosCat = hojas.reduce((t, f) => t + (src(f).match(/var\(--cat-[a-z]+\)/g) || []).length, 0);
  check(usosCat >= 70, `y los estilos las usan por su nombre (${usosCat})`);
  // la elevación
  const color = src('color.css');
  check(Object.keys(P.NOCHE).length === 6 && P.ELEVACION.hoja === 2 && P.ELEVACION.linea === 5 && /:root\[data-theme="dark"\]:not\(\[data-oled\]\):not\(\[data-contraste="alto"\]\) \.hoja-dialogo \{\n  --tiza: var\(--noche-1\);\n  --hoja: var\(--noche-2\);/.test(color),
    'en oscuro, las hojas van un nivel más claras y lo de dentro con ellas (en negro puro y con alto contraste, no)');
  const vid = P.ACENTOS.flatMap((a) => parejasVidrio(a, 'oscuro', 'hoja').filter((x) => x.ratio < 4.5).map((x) => `${a.id} ${x.que}`));
  check(vid.length === 0 && parejasVidrio(P.ACENTOS[0], 'oscuro', 'hoja')[0].fondo !== parejasVidrio(P.ACENTOS[0], 'oled', 'hoja')[0].fondo, `y su vidrio, con el peor fondo detrás, sigue pasando AA con cada acento${vid.length ? `: ${vid.slice(0, 3)}` : ''}`);
  // las filas
  const dis = src('diseno.css');
  check(/\.atletas-tabla tbody tr:hover \{ background: var\(--fila-hover\); \}/.test(dis) && /\.conversacion\.actual[^{]*\{ background: var\(--fila-elegida\)/.test(dis) && (dis.match(/background: var\(--fila-cebra\)/g) || []).length === 3,
    'pasar por encima, fila elegida y cebra: los mismos tres tokens en listas y tablas');
  // lo que se estrenó de la paleta
  const est = src('estilos.css');
  check(/\.banda-conexion \{ background: var\(--info-suave\); color: var\(--info\)/.test(est) && /\.banda-conexion\.sin-red \{ background: var\(--hoja-2\)/.test(est), '«info» en uso: enviar lo guardado es información, no un aviso (y sin conexión, la línea tranquila de siempre)');
  const usos = (t) => hojas.reduce((n, f) => n + (src(f).match(new RegExp(`var\\(${t}\\)`, 'g')) || []).length, 0);
  check(usos('--medalla') >= 4 && usos('--grad-record') >= 2 && usos('--grad-fuego') >= 1 && usos('--aro-amanecer') >= 1, `los degradados de marca, en uso (medalla ${usos('--medalla')}, récord ${usos('--grad-record')}, fuego ${usos('--grad-fuego')}, aro Amanecer ${usos('--aro-amanecer')})`);
  const oro = P.ESCALAS.oro[900], malGrad = [...P.CELEBRACION.record.filter((c) => P.contraste(oro, c) < 4.5), ...P.CELEBRACION.fuego.filter((c) => P.contraste(P.ESCALAS.naranja[950], c) < 4.5)];
  check(malGrad.length === 0, 'y Récord y Fuego aguantan su texto oscuro de punta a punta');
}

console.log('\nVisual (claude/visual-mejoras.md)');
{
  const lista = JSON.parse(readFileSync(new URL('datos/imagenes.json', dir), 'utf8'));
  const sin = Object.entries(lista).filter(([, x]) => !/^#[0-9a-f]{6}$/.test(x.color || '')).map(([k]) => k);
  check(sin.length === 0, `(12) cada ilustración lleva su color para mientras carga (${Object.keys(lista).length}; si añades imágenes: python3 scripts/colores-imagenes.py)${sin.length ? `: faltan ${sin.slice(0, 5)}` : ''}`);
  const perfil = src('ui/atleta/Perfil.jsx'), vis = src('visual.css');
  check(/opciones=\{\[\['tu', 'Tú'\], \['ajustes', 'Ajustes'\]\]\}/.test(perfil) && /class="perfil-cuerpo"/.test(perfil) && /function IndiceAjustes/.test(perfil), '(3 y 4) Perfil en dos vistas, «Tú» y «Ajustes», con el índice de los ajustes');
  check(!/\.perfil-panel\s*\{\s*display:\s*contents/.test(vis) && /\.perfil-cuerpo \{ display: contents/.test(vis), '(3) el cuerpo de Perfil es .perfil-cuerpo (.perfil-panel es el de «Tu actividad»)');
  check(/\(h === 'ajustes'/.test(src('ui/atleta/AtletaApp.jsx')) && /pedirVistaPerfil\('ajustes'\)/.test(src('ui/atleta/Hoy.jsx')), '(3) #ajustes y las preguntas frecuentes de Hoy llevan a «Ajustes»');
  check(/@container \(max-width: 479px\)/.test(vis) && /container-type: inline-size/.test(vis), '(5) lo que se reparte en columnas mira el ancho de su sección');
  check(/@media \(min-width: 1000px\)[\s\S]*columns: 2/.test(vis), '(6) Progreso y Perfil, a dos columnas en pantallas anchas');
  check(/useRaspado\(n, xs\)/.test(src('ui/NutricionComun.jsx')) && /<CajaGrafica/.test(src('ui/NutricionComun.jsx')), '(11) las barras de lo comido se leen tocando, como las gráficas de línea');
  check(/function SelloSemana/.test(src('ui/atleta/Progreso.jsx')) && !/PortadaHistoria/.test(src('ui/atleta/Progreso.jsx')), '(9) cada semana, su miniatura (y no el mismo lobo)');
  check(/\.hoja-cab \{ position: sticky/.test(vis) && /animation-timeline: scroll\(nearest\)/.test(vis), '(17) la cabecera de las hojas se queda arriba y su filo sale con el desplazamiento');
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
