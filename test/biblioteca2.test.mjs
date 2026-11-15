// La biblioteca de ejercicios, ampliada (rama biblioteca-2): tres grupos más (antebrazo, aductores, lumbares), los 161
// ejercicios nuevos de la demo y la migración «biblioteca 2» en un Postgres local (PGlite).
//   node test/biblioteca2.test.mjs
import { readFileSync } from 'node:fs';
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const lee = (r) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8');
const C = await import('../web/src/logica/calculos.js');
const { materialNecesario, sePuedeCon } = await import('../web/src/logica/material.js');
const { cargaZona } = await import('../web/src/logica/motor/proponer.js');
const { BIBLIOTECA_BASE } = await import('../web/src/datos/biblioteca-base.js');
const AMP = JSON.parse(lee('web/src/datos/biblioteca-ampliacion.json'));
const GEN = JSON.parse(lee('web/src/datos/biblioteca-generica.json'));

console.log('Los grupos nuevos');
const claves = C.GRUPOS.map(([g]) => g);
check(claves.length === 13 && claves.slice(0, 10).join() === 'pectoral,espalda,deltoides,cuadriceps,gluteo,isquiotibiales,biceps,triceps,abdominales,gemelo' && claves.slice(10).join() === 'antebrazo,aductores,lumbares', 'trece grupos: los diez de siempre en su orden y, al final, antebrazo, aductores y lumbares');
check(C.rangoVolumen(null, 'lumbares').join() === '0,20' && C.rangoVolumen(null, 'antebrazo')[0] === 0 && C.rangoVolumen(null, 'pectoral').join() === '10,20' && C.estadoVolumen(2, C.rangoVolumen(null, 'aductores')) === 'dentro', 'los tres nuevos no tienen mínimo de series: con 2 series no salen como «bajo»');
check(C.rangoVolumen({ lumbares: [4, 8] }, 'lumbares').join() === '4,8' && JSON.stringify(C.limpiarObjetivo({ lumbares: [0, 20], antebrazo: [2, 6], pectoral: [10, 20] })) === '{"antebrazo":[2,6]}', 'el coach puede darles rango propio; el general no se guarda');
const cuenta = C.seriesPautadasPorGrupo([{ ejercicio_id: 'a', series: 4 }], { a: { grupos_musculares: ['isquiotibiales', 'gluteo', 'lumbares'] } });
check(cuenta.lumbares === 2 && cuenta.isquiotibiales === 4, 'como secundario, lumbares cuenta media serie');
check(cargaZona('zona_lumbar', { nombre: 'Superman', grupos_musculares: ['lumbares'] }) && cargaZona('aductor', { nombre: 'x', grupos_musculares: ['aductores'] }) && !cargaZona('aductor', { nombre: 'x', grupos_musculares: ['gluteo'] }) && cargaZona('zona_lumbar', { nombre: 'Peso muerto rumano con barra RDL', grupos_musculares: ['isquiotibiales'] }), 'el motor: una molestia lumbar o de aductor ya encuentra sus ejercicios (y las bisagras con barra, como antes)');
const mapa = lee('web/src/ui/MapaMuscular.jsx');
check(/\['antebrazo', ANTEBRAZO\]/.test(mapa) && /\['aductores', /.test(mapa) && /\['lumbares', /.test(mapa), 'el mapa muscular dibuja los tres');
check(['diseno.css', 'perfil.css'].every((f) => ['antebrazo', 'aductores', 'lumbares'].every((g) => lee(`web/src/${f}`).includes(`[data-g="${g}"]`))), 'y cada uno tiene su color');

console.log('\nLa ampliación (demo)');
const G = new Set(claves), T = new Set(['basico', 'multiarticular', 'aislamiento']);
const nombres = AMP.map((e) => e.nombre);
check(AMP.length === 161 && new Set(nombres.map((n) => n.toLowerCase())).size === 161, '161 ejercicios nuevos, sin repetir');
const viejos = new Set(GEN.map((e) => e.nombre.toLowerCase()));
check(nombres.every((n) => !viejos.has(n.toLowerCase())) && BIBLIOTECA_BASE.length === GEN.length + 161, `ninguno repite uno de los ${GEN.length} de siempre (total en la demo: ${BIBLIOTECA_BASE.length})`);
check(AMP.every((e) => e.grupos_musculares.every((g) => G.has(g)) && e.tipo.length && e.tipo.every((t) => T.has(t)) && e.rango_reps), 'todos con grupos válidos, tipo y rango de repeticiones');
const todos = new Set(BIBLIOTECA_BASE.map((e) => e.nombre));
check(AMP.every((e) => e.alternativas.length >= 1 && e.alternativas.every((a) => todos.has(a) && a !== e.nombre)), 'las alternativas existen en la biblioteca (y ninguno es alternativa de sí mismo)');
check(AMP.every((e) => !('instrucciones' in e) && !('errores' in e) && !('video_url' in e)), 'la técnica no va en el repositorio');
const sinGrupo = AMP.filter((e) => !e.grupos_musculares.length).map((e) => e.nombre);
// Los secundarios siguen el criterio de scripts/grupos-revisados.mjs: lo que solo estabiliza no cuenta
const gr = (n) => AMP.find((e) => e.nombre === n).grupos_musculares.join();
check(gr('Peso muerto sumo con barra') === 'gluteo,aductores,isquiotibiales' && gr('Buenos días con barra') === 'isquiotibiales,gluteo' && gr('Remo con goma sentado') === 'espalda,biceps,deltoides' && gr('Paseo de maleta con mancuerna') === 'abdominales' && AMP.filter((e) => e.grupos_musculares.includes('lumbares')).every((e) => e.grupos_musculares[0] === 'lumbares'), 'los secundarios, con el criterio de siempre: la espalda de una bisagra o el tronco de un paseo no cuentan; lumbares, solo donde la columna se mueve');
check(sinGrupo.length === 3 && sinGrupo.every((n) => /^Rotación externa/.test(n)), 'sin grupo, solo las rotaciones externas de hombro (no cuentan como series de deltoides)');
check(GEN.filter((e) => !e.grupos_musculares.length).length === 0 && GEN.find((e) => e.nombre === 'Aducciones Copenhague').grupos_musculares[0] === 'aductores' && GEN.find((e) => e.nombre === 'Kettlebell wrist turns').grupos_musculares[0] === 'antebrazo', 'los 8 de siempre sin grupo ya tienen el suyo');
const porGrupo = {};
for (const e of BIBLIOTECA_BASE) porGrupo[e.grupos_musculares[0] || '-'] = (porGrupo[e.grupos_musculares[0] || '-'] || 0) + 1;
check(claves.every((g) => porGrupo[g] >= 5), `todos los grupos tienen al menos 5 ejercicios (${claves.map((g) => `${g} ${porGrupo[g]}`).join(', ')})`);

console.log('\nEl material de los nuevos (por su nombre)');
const m = (n) => JSON.stringify(materialNecesario(n));
check(m('Jalón con goma arrodillado') === '[["gomas"]]' && m('Face pull con goma') === '[["gomas"]]' && m('Buenos días con goma') === '[["gomas"]]' && m('Press pallof con goma') === '[["gomas"]]', '«con goma» es solo la goma (ni polea ni barra)');
check(m('Dominadas asistidas con goma') === '[["gomas","dominadas"]]' && m('Dominadas asistidas en máquina') === '[["maquinas"]]' && m('Jalón al pecho en máquina') === '[["maquinas"]]' && m('Colgarse de la barra de dominadas') === '[["dominadas"]]', '«en máquina» manda, y la barra de dominadas no es una barra con discos');
check(['Curl nórdico', 'Sentadilla pistol', 'Dead bug', 'Superman', 'Sentadilla búlgara sin peso', 'Elevación de talones a una pierna sin peso', 'Flexiones diamante', 'Plancha lateral'].every((n) => m(n) === '[]'), 'los de peso corporal no piden nada');
check(m('Fondos entre bancos') === '[["banco"]]' && m('Hip thrust unilateral sin peso') === '[["banco"]]' && m('Sentadilla a una pierna al banco') === '[["banco"]]', 'y los que solo piden un banco');
check(m('Leg curl de pie en máquina/polea baja') === '[["maquinas"],["poleas"]]' && m('Hip thrust') === '[["barra","banco"]]' && m('Remo al mentón en MP/con barra/en polea baja') === '[["multipower"],["poleas"],["barra"]]', 'los de siempre, como antes');
const casa = AMP.filter((e) => materialNecesario(e.nombre) && sePuedeCon(e.nombre, ['mancuernas', 'gomas', 'banco'])).length;
check(casa >= 80, `${casa} de los nuevos se pueden hacer en casa con mancuernas, gomas y banco`);
check(AMP.filter((e) => materialNecesario(e.nombre) == null).length <= 2, 'casi ninguno se queda sin material reconocido');

console.log('\nLa migración «biblioteca 2» (PGlite)');
const { PGlite } = await import('@electric-sql/pglite');
const { aplicarEsquema } = await import('./esquema.mjs');
const db = new PGlite();
await aplicarEsquema(db, { repetirMigraciones: true });
const q = async (sql, p = []) => (await db.query(sql, p)).rows;
const falla = async (sql, p = []) => { try { await db.query(sql, p); return false; } catch { return true; } };
check(!(await falla(`insert into public.ejercicios (nombre, grupos_musculares) values ('Prueba lumbar', '{lumbares,gluteo}'), ('Prueba antebrazo', '{antebrazo}'), ('Prueba aductores', '{aductores}')`)), 'la base admite los tres grupos');
check(await falla(`insert into public.ejercicios (nombre, grupos_musculares) values ('Prueba rara', '{cuello}')`), 'y sigue sin admitir grupos que no existen');
check((await q(`select count(*)::int n from pg_constraint where conrelid = 'public.ejercicios'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%isquiotibiales%'`))[0].n === 1, 'una sola restricción de grupos, también al repetir la migración');
await q(`insert into public.ejercicios (nombre, grupos_musculares) values ('Aducciones Copenhague', '{}'), ('Kettlebell wrist turns', '{}'), ('Aductor en máquina sentado', '{gluteo}')`);
const mig = lee('supabase/migraciones/074_biblioteca_2.sql');
const parte2 = mig.slice(mig.indexOf('-- 2. Los de siempre'), mig.indexOf('-- 3. Permisos'));
await db.exec(parte2);
const g = Object.fromEntries((await q(`select nombre, grupos_musculares from public.ejercicios where nombre in ('Aducciones Copenhague', 'Kettlebell wrist turns', 'Aductor en máquina sentado')`)).map((r) => [r.nombre, r.grupos_musculares.join()]));
check(g['Aducciones Copenhague'] === 'aductores' && g['Kettlebell wrist turns'] === 'antebrazo' && g['Aductor en máquina sentado'] === 'gluteo', 'los de siempre sin grupo reciben el suyo; lo que el coach ya puso no se pisa');
check(/if v > 74 then/.test(mig) && /numero = 73\) then/.test(mig) && /values \(74\)/.test(mig) && !/create (or replace )?function/.test(mig) && !/create table/.test(mig), 'pide la 073; no crea tablas ni funciones (nada que revocar)');

console.log('\nAprende');
const Gs = await import('../web/src/logica/guias.js');
check(Gs.estanteDe({ clave: 'proteina' }) === 'comer' && Gs.estanteDe({ clave: 'suplementacion' }) === 'comer' && Gs.estanteDe({ clave: 'otra' }) === 'mas', 'la guía de proteína, en la estantería «Comer»');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
