// Las guías de antebrazo, aductores y lumbares, con su grupo (migración 075): la restricción de guias.grupo admite los
// trece grupos de la app, y las tres guías del coach con esa clave reciben su grupo si siguen sin ninguno.
//   node test/guias-grupos.test.mjs
import { readFileSync } from 'node:fs';
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const lee = (r) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8');
const C = await import('../web/src/logica/calculos.js');
const { guiaDeGrupo, estanteDe } = await import('../web/src/logica/guias.js');
const { imagenGuia, imagenGrupo } = await import('../web/src/logica/imagenes.js');
  await (await import('../web/src/logica/imagenes.js')).cargarListaImagenes();   // (v0.207: la lista va en su propio trozo)

console.log('En la app');
const nuevos = ['antebrazo', 'aductores', 'lumbares'];
check(nuevos.every((g) => C.GRUPOS.some(([k]) => k === g)), 'los tres grupos están en GRUPOS (el mapa muscular y «Series por músculo» los listan)');
const guias = [{ clave: 'antebrazo', grupo: 'antebrazo', orden: 11, publicada: true, fichas: 4 }, { clave: 'pectoral', grupo: 'pectoral', orden: 1, publicada: true }];
check(guiaDeGrupo(guias, 'antebrazo')?.clave === 'antebrazo' && guiaDeGrupo(guias, 'lumbares') === null, 'con grupo, la guía de antebrazo se encuentra por su grupo');
// (imágenes, tanda 9) los tres ya tienen estatua: con su grupo, la tarjeta de la guía la lleva; sin grupo, cae en el rack
check(nuevos.every((g) => imagenGrupo(g) === `grupo-${g}`) && imagenGuia({ clave: 'antebrazo', grupo: 'antebrazo', fichas: 4 }, estanteDe({ clave: 'antebrazo', grupo: 'antebrazo' })) === 'grupo-antebrazo'
  && imagenGuia({ clave: 'antebrazo', grupo: null, fichas: 4 }, estanteDe({ clave: 'antebrazo', fichas: 4 })) === 'guia-entrenar',
  'con estatua para los tres: la tarjeta de la guía lleva la de su grupo; sin grupo, la de su estantería (el rack), no queda vacía');
check(estanteDe({ clave: 'lumbares', grupo: 'lumbares' }) === 'musculos', 'y sigue en «Músculo a músculo»');
const demo = lee('web/src/datos/backend-memoria.js');
check(/'gemelo', 'antebrazo', 'aductores', 'lumbares'\]\.includes\(f\.grupo\)/.test(demo), 'la demo admite los tres en guias.grupo, como la base');

console.log('\nLa migración 075 (PGlite)');
const { PGlite } = await import('@electric-sql/pglite');
const { aplicarEsquema } = await import('./esquema.mjs');
const db = new PGlite();
await aplicarEsquema(db, { repetirMigraciones: true });
const q = async (sql, p = []) => (await db.query(sql, p)).rows;
const falla = async (sql, p = []) => { try { await db.query(sql, p); return false; } catch { return true; } };
check(!(await falla(`insert into public.guias (clave, titulo, grupo) values ('prueba-ant', 'Prueba', 'antebrazo'), ('prueba-adu', 'Prueba', 'aductores'), ('prueba-lum', 'Prueba', 'lumbares'), ('prueba-pec', 'Prueba', 'pectoral')`)),
  'una guía admite antebrazo, aductores y lumbares (y los de siempre)');
check(await falla(`insert into public.guias (clave, titulo, grupo) values ('prueba-cue', 'Prueba', 'cuello')`), 'y sigue sin admitir grupos que no existen');
check(await falla(`insert into public.guias (clave, titulo) values ('Mal Clave', 'Prueba')`) && await falla(`insert into public.guias (clave, titulo, orden) values ('prueba-orden', 'Prueba', 1000)`),
  'el resto de la restricción, igual que en la 057 (clave y orden)');
check((await q(`select count(*)::int n from pg_constraint where conrelid = 'public.guias'::regclass and conname = 'guias_validas'`))[0].n === 1, 'una sola restricción, también al repetir la migración');
await q(`insert into public.guias (clave, titulo, grupo) values ('antebrazo', 'Antebrazo', null), ('aductores', 'Aductores', null), ('lumbares', 'Lumbares', 'gluteo'), ('otra', 'Otra', null)`);
const mig = lee('supabase/migraciones/075_guias_grupos.sql');
await db.exec(mig.slice(mig.indexOf('-- 2. Las tres guías'), mig.indexOf('-- 3. Permisos')));
const g = Object.fromEntries((await q(`select clave, grupo from public.guias where clave in ('antebrazo', 'aductores', 'lumbares', 'otra')`)).map((r) => [r.clave, r.grupo]));
check(g.antebrazo === 'antebrazo' && g.aductores === 'aductores', 'las guías «antebrazo» y «aductores» reciben su grupo por la clave');
check(g.lumbares === 'gluteo' && g.otra === null, 'lo que el coach ya puso no se pisa, y las demás guías no se tocan');
check(/if v > 75 then/.test(mig) && /numero = 74\) then/.test(mig) && /values \(75\)/.test(mig) && !/create (or replace )?function/.test(mig) && !/create table/.test(mig),
  'pide la 074; no crea tablas ni funciones');
const p74 = lee('supabase/migraciones/074_biblioteca_2.sql');
const permisos = (s) => s.slice(s.indexOf('revoke truncate, references, trigger'), s.indexOf('insert into public.fbe_migraciones'));
check(permisos(mig) === permisos(p74), 'el bloque de permisos, el mismo que el de la 074');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
