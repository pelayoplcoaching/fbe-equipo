// FBE Esencial (v0.244): las ilustraciones de sus tarjetas. Que cada hueco use una imagen del catálogo, que la lista de
// archivos no traiga nada de fuera de él y que los archivos existan (los huecos sin imagen todavía se quedan como estaban).
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARTE, ARTE_HERO, ARTE_CIERRE, ARTE_NUTRI, ARTE_REVISION, ARTE_COMIDA, arteLeccion, arteSemanaHecha } from '../web/src/logica/esencial-arte.js';
import { NECESITAS_COMIDA } from '../web/src/logica/esencial-comida.js';
import { pasosNutricion } from '../web/src/logica/nutricion-cuestionario.js';
import { estadoEsencial } from '../web/src/logica/esencial-alta.js';
import { leccionDe } from '../web/src/logica/esencial-lecciones.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const lee = (r) => readFileSync(join(raiz, r), 'utf8');

console.log('El catálogo');
check(new Set(ARTE).size === ARTE.length && ARTE.length === 108 && ARTE.every((id) => /^esencial-[a-z0-9-]+$/.test(id)), `108 huecos, sin repetir (40 ilustraciones, la de «Elige tu rutina», que es la del poste de señales de sus rutinas, y (v0.253) las 10 del plan de comida, 4 de la revisión de 4 semanas, las 8 de la comida acompañada, las 12 de «¿Qué necesitas?», las 7 de antes de tu lunes, las 3 de tu revisión y tu trimestre y, v0.254, las agujetas, la vuelta, más herramientas y tu medicación, v0.255, las 13 de «Tus pruebas», v0.256, 3 del dolor, y v0.257, 3 más del dolor): ${ARTE.length}`);
// los estados de antes de empezar que pintan la tarjeta grande
const c0 = { completado_en: '2027-01-02', resultado: 'sin_valoracion', experiencia: 'ninguna' };
const estados = [
  estadoEsencial({ hoy: '2027-01-04' }), estadoEsencial({ cuestionario: { completado_en: '2027-01-02' }, hoy: '2027-01-04' }),
  estadoEsencial({ cuestionario: { ...c0, experiencia: '1_3' }, hoy: '2027-01-04', con099: true }),
  estadoEsencial({ cuestionario: { ...c0, resultado: 'valorar_antes' }, ficha: {}, hoy: '2027-01-04' }),
  estadoEsencial({ cuestionario: { ...c0, resultado: 'valorar_antes' }, ficha: { visto_bueno_pedido_en: '2027-01-03' }, hoy: '2027-01-04' }),
  estadoEsencial({ cuestionario: c0, hoy: '2027-01-04' }), estadoEsencial({ bloque: { fecha_inicio: '2027-01-11' }, hoy: '2027-01-04' }),
].map((e) => e?.tipo);
check(estados.join() === 'cuestionario,salud,rutina,visto_bueno,revision,preparando,espera' && estados.every((t) => ARTE.includes(ARTE_HERO[t])) && Object.keys(ARTE_HERO).length === 7,
  'la tarjeta grande de antes de empezar: cada uno de sus siete estados tiene su ilustración');
check([1, 2, 3, 4, 5, 6, 7, 8].every((n) => leccionDe(n) && ARTE.includes(arteLeccion(n))) && arteLeccion(0) === null && arteLeccion(9) === null && arteLeccion(null) === null,
  'cada una de las ocho lecciones tiene la suya (y fuera de ellas, ninguna)');
check(['pregunta', 'pasada', 'lista', 'pausa', 'repite'].every((t) => ARTE.includes(ARTE_CIERRE[t])), 'el cierre de la semana: la pregunta, lista, en pausa y repetida');
check(pasosNutricion(true).every(([k]) => ARTE.includes(ARTE_NUTRI[k])) && Object.keys(ARTE_NUTRI).length === pasosNutricion(true).length, '(v0.253) cada paso del cuestionario de nutrición tiene la suya');
check(['bien', 'recomposicion', 'baja', 'sube', 'suelo', 'profesional', 'simplificar', 'datos'].every((t) => ARTE.includes(ARTE_REVISION[t])), '(v0.253) y cada tipo de revisión de 4 semanas');
check(NECESITAS_COMIDA.every(([id]) => ARTE.includes(ARTE_COMIDA[id])) && Object.keys(ARTE_COMIDA).length === NECESITAS_COMIDA.length, '(v0.253) y cada hoja de comida de «¿Qué necesitas?»');
check(arteSemanaHecha(1) === 'esencial-semana-1-hecha' && arteSemanaHecha(4) === 'esencial-cuatro-semanas' && arteSemanaHecha(8) === 'esencial-cuatro-semanas' && arteSemanaHecha(12) === 'esencial-doce-semanas'
  && arteSemanaHecha(24) === 'esencial-doce-semanas' && arteSemanaHecha(2) === null && arteSemanaHecha(0) === null, '«Semana N hecha»: la primera, cada cuatro y cada doce');

console.log('\nLo que usan las pantallas');
const usados = new Set();
for (const f of ['Esencial.jsx', 'EsencialSesion.jsx', 'EsencialRutinas.jsx', 'Checkin.jsx', 'EsencialNutricionMotor.jsx', 'NutricionRevision.jsx', 'EsencialComidaMas.jsx', 'EsencialAyuda.jsx', 'EsencialVida.jsx', 'EsencialEspera.jsx', 'EsencialCerca.jsx', 'EsencialHerramientas.jsx', 'EsencialPruebas.jsx', 'EsencialDolor.jsx', 'EsencialDolorSesion.jsx']) {
  // (solo las líneas que pintan una ilustración: <Arte …>, <ArteDuo …> o foto(…) de la bienvenida)
  for (const linea of lee(`web/src/ui/atleta/${f}`).split('\n').filter((l) => /<Arte|foto\('/.test(l))) {
    for (const m of linea.matchAll(/'(esencial-[a-z0-9-]+)'|"(esencial-[a-z0-9-]+)"/g)) usados.add(m[1] || m[2]);
  }
}
const deFuera = [...usados].filter((id) => !ARTE.includes(id));
check(deFuera.length === 0 && usados.size >= 15, `cada ilustración escrita en una pantalla está en el catálogo (${usados.size} escritas tal cual)${deFuera.length ? `: sobran ${deFuera.join(', ')}` : ''}`);
const porMapa = [...Object.values(ARTE_HERO), ...Object.values(ARTE_CIERRE), ...Object.values(ARTE_NUTRI), ...Object.values(ARTE_REVISION), ...Object.values(ARTE_COMIDA), ...[1, 2, 3, 4, 5, 6, 7, 8].map(arteLeccion), ...[1, 4, 12].map(arteSemanaHecha)];
const sinSitio = ARTE.filter((id) => !usados.has(id) && !porMapa.includes(id));
check(sinSitio.length === 0, `y cada ilustración del catálogo tiene su sitio en la app${sinSitio.length ? `: sin sitio, ${sinSitio.join(', ')}` : ''}`);

console.log('\nLa lista de archivos');
const lista = JSON.parse(lee('web/src/datos/imagenes-esencial.json'));
const ids = Object.keys(lista);
check(ids.every((id) => ARTE.includes(id)), `no trae nada que no esté en el catálogo (${ids.length} de ${ARTE.length} colocadas)`);
const faltan = ids.flatMap((id) => Object.values(lista[id].archivos || {}).filter((a) => !existsSync(join(raiz, 'web', a))));
check(faltan.length === 0 && ids.every((id) => Object.keys(lista[id].archivos || {}).length === 3), 'cada una, con sus tres anchos, y los archivos están');
const enCarpeta = existsSync(join(raiz, 'web/imagenes/esencial')) ? readdirSync(join(raiz, 'web/imagenes/esencial')) : [];
const deLista = new Set(ids.flatMap((id) => Object.values(lista[id].archivos).map((a) => a.split('/').pop())));
check(enCarpeta.every((a) => deLista.has(a)), 'y en su carpeta no hay archivos sueltos (de una versión anterior de una imagen)');
const css = lee('web/src/esencial-arte.css').replace(/\/\*[\s\S]*?\*\//g, '');
check(!/[^\x00-\x7F]/.test(lee('web/src/esencial-arte.css')) && [...css.matchAll(/\.([a-z][a-z0-9-]*)/g)].every((m) => m[1].startsWith('esa-') || /^\d/.test(m[1])), 'sus estilos: solo ASCII y solo clases esa-*');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
if (fallos) process.exit(1);
