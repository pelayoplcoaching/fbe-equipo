// Las ilustraciones de la app: qué portada toca a cada sesión, qué archivos se sirven y que la lista y los archivos
// coinciden (y pesan poco). Sin navegador.
//   node test/imagenes.test.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { familiaPortada, fuenteImagen, imagenHabito, FAMILIAS_PORTADA, IMAGENES } from '../web/src/logica/imagenes.js';
import { ICONOS_HABITO } from '../web/src/logica/habitos.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const raiz = new URL('..', import.meta.url).pathname;
const ej = (nombre, grupos, tipo = ['multiarticular']) => ({ nombre, grupos_musculares: grupos, tipo });
const p = (e, series) => ({ series, ejercicio: e });
const BANCA = ej('Press banca', ['pectoral', 'triceps'], ['basico']);
const MILITAR = ej('Press militar', ['deltoides', 'triceps']);
const REMO = ej('Remo con barra', ['espalda', 'biceps']);
const DOMINADA = ej('Dominadas', ['espalda', 'biceps']);
const SENTADILLA = ej('Sentadilla trasera', ['cuadriceps', 'gluteo'], ['basico']);
const PESO_MUERTO = ej('Peso muerto rumano', ['isquiotibiales', 'gluteo']);
const CURL = ej('Curl de bíceps', ['biceps'], ['aislamiento']);
const EXTENSION = ej('Extensión de tríceps en polea', ['triceps'], ['aislamiento']);
const PLANCHA = ej('Plancha', ['abdominales']);

console.log('La portada de cada sesión');
check(familiaPortada({ tipo: 'cardio', pautas: [p(BANCA, 4)] }) === 'cardio', 'una sesión de cardio lleva la de cardio, lleve lo que lleve');
check(familiaPortada({ tipo: 'movilidad' }) === 'movilidad', 'una de movilidad, la de movilidad');
check(familiaPortada({ pautas: [p(BANCA, 4), p(MILITAR, 3), p(EXTENSION, 3)] }) === 'empuje', 'un torso de empuje (banca, militar, tríceps), la de empuje');
check(familiaPortada({ pautas: [p(DOMINADA, 4), p(REMO, 4), p(CURL, 3)] }) === 'tiron', 'uno de tirón (dominadas, remo, bíceps), la de tirón');
check(familiaPortada({ pautas: [p(BANCA, 4), p(REMO, 4), p(DOMINADA, 3)] }) === 'tiron', 'un torso con más tirón que empuje, la de tirón');
check(familiaPortada({ pautas: [p(SENTADILLA, 4), p(PESO_MUERTO, 3)] }) === 'pierna', 'una de pierna, la de pierna');
check(familiaPortada({ pautas: [p(SENTADILLA, 3), p(BANCA, 3), p(REMO, 3)] }) === 'fullbody', 'pierna y torso a partes parecidas, full body');
check(familiaPortada({ pautas: [p(SENTADILLA, 6), p(PESO_MUERTO, 4), p(BANCA, 2)] }) === 'pierna', 'una de pierna con un poco de torso (menos de un cuarto) sigue siendo de pierna');
check(familiaPortada({ pautas: [p(PLANCHA, 4)] }) === 'core', 'solo core, la de core');
check(familiaPortada({ pautas: [] }) === 'fullbody' && familiaPortada() === 'fullbody', 'sin ejercicios, la más genérica (full body)');
check(familiaPortada({ pautas: [], cardio: true }) === 'cardio', 'una «de fuerza» que solo lleva el cardio pautado, la de cardio');
check(familiaPortada({ pautas: [p(BANCA, 0), p(SENTADILLA, 3)] }) === 'pierna', 'lo que no lleva series no cuenta');
check(familiaPortada({ pautas: [{ series: 3, ejercicio: null }, p(REMO, 3)] }) === 'tiron', 'una pauta sin ejercicio no rompe nada');
check(familiaPortada({ pautas: [{ series: 3, nombre: 'Press banca', grupos_musculares: ['pectoral'], tipo: [] }] }) === 'empuje', 'vale también con el ejercicio en la propia pauta');

console.log('\nLos hábitos');
check(imagenHabito('pasos') === 'habito-pasos' && imagenHabito('sueno') === 'habito-sueno' && imagenHabito('verdura') === 'habito-verdura', 'cada icono de hábito, su imagen');
check(imagenHabito('libre') === 'habito-otro' && imagenHabito(null) === 'habito-otro' && imagenHabito('inventado') === 'habito-otro', '«Otro», sin icono o uno desconocido: la de «otro»');
check(ICONOS_HABITO.every(([i]) => IMAGENES.includes(imagenHabito(i))), `hay imagen para los ${ICONOS_HABITO.length} iconos que puede elegir el coach`);

console.log('\nLos archivos que se sirven');
{
  const lista = { a: { proporcion: [16, 9], archivos: { 1440: 'imagenes/x/a-1440.00000000.webp', 720: 'imagenes/x/a-720.00000000.webp', 1080: 'imagenes/x/a-1080.00000000.webp' } } };
  const f = fuenteImagen('a', lista);
  check(f && f.src === 'imagenes/x/a-1080.00000000.webp' && f.ancho === 1080 && f.alto === 608, 'la de en medio como src, con su ancho y su alto según la proporción');
  check(f.srcset === 'imagenes/x/a-720.00000000.webp 720w, imagenes/x/a-1080.00000000.webp 1080w, imagenes/x/a-1440.00000000.webp 1440w', 'todas en srcset, de menor a mayor');
  const una = fuenteImagen('b', { b: { proporcion: [1, 1], archivos: { 500: 'imagenes/x/b-500.00000000.webp' } } });
  check(una && una.src.endsWith('b-500.00000000.webp') && una.alto === 500, 'con un solo tamaño, ese');
  check(fuenteImagen('nada', lista) === null && fuenteImagen(null, lista) === null && fuenteImagen('toString', lista) === null, 'lo que no está en la lista, nada (tampoco lo heredado de un objeto)');
  check(fuenteImagen('c', { c: { archivos: {} } }) === null, 'sin archivos, nada');
}

console.log('\nLa lista y la carpeta');
{
  const lista = JSON.parse(readFileSync(join(raiz, 'web/src/datos/imagenes.json'), 'utf8'));
  const enLista = Object.values(lista).flatMap((x) => Object.values(x.archivos));
  const listar = (d) => (existsSync(d) ? readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? listar(join(d, f)) : [join(d, f)])) : []);
  const enCarpeta = listar(join(raiz, 'web/imagenes')).map((f) => f.slice(join(raiz, 'web').length + 1));
  check(enLista.every((f) => enCarpeta.includes(f)), `cada archivo de la lista está en web/imagenes (${enLista.length})`);
  check(enCarpeta.every((f) => enLista.includes(f)), 'y no sobra ninguno en la carpeta');
  check(enLista.every((f) => /^imagenes\/[a-z0-9-]+\/[a-z0-9-]+-\d+\.[0-9a-f]{8}\.webp$/.test(f)), 'todos con el nombre que espera la construcción (bloque, id, ancho y huella)');
  const pesos = enLista.map((f) => statSync(join(raiz, 'web', f)).size);
  check(Math.max(...pesos) <= 120 * 1024, `ninguno pasa de 120 KB (el mayor, ${(Math.max(...pesos) / 1024).toFixed(0)} KB)`);
  check(FAMILIAS_PORTADA.every((fa) => IMAGENES.includes(`sesion-${fa}`)), 'están las siete portadas de sesión');
  check(Object.entries(lista).every(([id, x]) => Object.values(x.archivos).every((f) => f.split('/').pop().startsWith(`${id}-`))), 'cada archivo lleva el nombre de su imagen');
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
