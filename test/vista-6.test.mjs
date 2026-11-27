// (v0.279) Vista (251-300), sexta vuelta: el afinado que se ve (290-300), medido pantalla a pantalla. Aquí, que cada
// arreglo está en su sitio y que la hoja de estilos sigue las reglas; las medidas, en test/e2e-vista-6.mjs.
//   node test/vista-6.test.mjs
import { readFileSync } from 'node:fs';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const src = (r) => readFileSync(new URL(`../web/src/${r}`, import.meta.url), 'utf8');
const css = src('vista-c.css');
const parte = css.slice(css.indexOf('(v0.279)'));
const sinCom = parte.replace(/\/\*[\s\S]*?\*\//g, '');

console.log('El afinado (290-300)');
check(/\.cabecera-grande\.compacta \.titulo h1 \{ font-stretch: 100%; white-space: normal; display: -webkit-box;[^}]*-webkit-line-clamp: 2/.test(parte) && /\.enfoque-despues span:last-child \{ white-space: normal; text-overflow: clip;[^}]*-webkit-line-clamp: 2/.test(parte)
  && /\.apuntes-tarjeta-texto \.peq \{ white-space: normal;[^}]*-webkit-line-clamp: 2/.test(parte), '(290) los nombres que salían cortados, en dos líneas (la cabecera pegada, además, con letra un punto más estrecha)');
check(/\.amb-ficha > \.esa-franja \{ border-radius: calc\(var\(--r-14\) - var\(--esp-10\)\); \}/.test(parte), '(293) la esquina del arte dentro de la ficha de una marca, concéntrica con la ficha');
check(/\.tramo:not\(#n\):not\(#n\) \{ gap: var\(--esp-10\); \}/.test(parte), '(294) el hueco bajo el título de las filas de Hoy, como en el resto (10 px)');
check(/\.cer-n \{ min-height: calc\(var\(--esp-40\) \+ var\(--esp-4\)\); \}/.test(parte) && /\.mmt-fila:not\(#n\) \{ min-height: calc\(var\(--esp-40\) \+ var\(--esp-4\)\); \}/.test(parte) && /\.tres-mas:not\(#n\):not\(#n\)::after \{ content: ""; position: absolute; inset: calc\(var\(--esp-8\) \* -1\) 0; \}/.test(parte),
  '(295) 44 px de toque en la nota de «Cerca», las filas de los músculos y «Leer más»');
check(['encuesta-opcion', 'novedad-fila', 'lun-alt', 'vid-alt', 'fila-boton'].every((c) => new RegExp(`\\.${c}:not\\(:disabled\\):active \\{`).test(parte) && new RegExp(`\\.${c}:disabled \\{ opacity: var\\(--op-deshabilitado\\);`).test(parte)) && /\.mnt-boton:not\(#n\):disabled/.test(parte),
  '(296) los controles que no tenían pulsado ni apagado, ya los tienen (el enfocado es el de toda la app)');
check(/html\[data-letra="muy-grande"\] \.cabecera \.marca \{ font-stretch: 112%; \}/.test(parte) && /\.cabecera-grande \.titulo h1 \{ overflow-wrap: break-word; hyphens: auto; \}/.test(parte) && /\.barra-fila \{ grid-template-columns: max\(96px, 6\.9em\)/.test(parte),
  '(298) con «Muy grande» y 360 px: la marca, el título de Semana y los nombres de los músculos caben');
check(/:focus-visible \{ outline: 2px solid var\(--foco\)/.test(src('estilos.css')), '(296) el enfocado: el anillo de toda la app (ya estaba)');
const historia = src('estilos.css');
check(/\.historia \{[\s\S]*?padding: calc\(var\(--esp-14\) \+ env\(safe-area-inset-top, 0px\)\) max\(var\(--esp-20\), env\(safe-area-inset-right, 0px\)\)/.test(historia) && /\.enfoque \{[^}]*padding-top: env\(safe-area-inset-top, 0px\)/.test(historia)
  && /\.ct-raiz \{[\s\S]*?padding: max\(var\(--esp-16\), env\(safe-area-inset-top, 0px\)\)/.test(src('tacto-a.css')), '(297) las pantallas a sangre (historias, cartel y enfoque) ya respetaban la isla y las esquinas');
check(!/[^\x00-\x7f]/.test(parte) && !/#[0-9a-f]{3,8}\b/i.test(sinCom) && !/rgba?\(/.test(sinCom) && !/infinite|@keyframes/.test(sinCom), 'la hoja: solo ASCII, colores por ficha y nada que se mueva');

console.log(`\n${ok} bien, ${fallos} mal`);
if (fallos) process.exit(1);
